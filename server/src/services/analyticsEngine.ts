import { PrismaClient } from '@prisma/client';
import { buildAssessmentReport } from './reportBuilder';

const prisma = new PrismaClient();

export class AnalyticsEngine {
  static async updateAnalytics(userId: string, category: string, isCorrect: boolean, timeTaken: number) {
    const existing = await prisma.analytics.findFirst({
      where: { userId, category },
    });

    if (existing) {
      const totalAttempts = existing.totalAttempts + 1;
      const correctAttempts = existing.correctAttempts + (isCorrect ? 1 : 0);
      const accuracy = (correctAttempts / totalAttempts) * 100;
      const averageTime = ((existing.averageTime * existing.totalAttempts) + timeTaken) / totalAttempts;

      return prisma.analytics.update({
        where: { id: existing.id },
        data: {
          totalAttempts,
          correctAttempts,
          accuracy,
          averageTime,
          lastUpdated: new Date(),
        },
      });
    } else {
      return prisma.analytics.create({
        data: {
          userId,
          category,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          accuracy: isCorrect ? 100 : 0,
          averageTime: timeTaken,
          lastUpdated: new Date(),
        },
      });
    }
  }

  /**
   * Writes one AssessmentSnapshot per participant, at the moment a full
   * assessment finishes (called from sessionActions.advanceRound once the
   * session transitions to ASSESSMENT_COMPLETE). This is what backs
   * "Performance Over Time" and "Recent Activity" on the dashboard — the
   * per-round updateAnalytics() above already keeps per-category totals
   * current, but has no notion of a completed assessment or a date to plot.
   * Reuses buildAssessmentReport() (the same source of truth as the on-screen
   * report) for scoring, rather than recomputing it here.
   */
  static async recordAssessmentCompletion(sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const report = await buildAssessmentReport(sessionId);
    if (!report) return;

    const participants: { userId: string; role: 'attacker' | 'defender'; finalScore: number; accuracy: number }[] = [
      { userId: session.attackerId, role: 'attacker', finalScore: report.attackerFinalScore, accuracy: report.attackerAccuracy },
    ];
    if (session.defenderId) {
      participants.push({
        userId: session.defenderId,
        role: 'defender',
        finalScore: report.defenderFinalScore,
        accuracy: report.defenderAccuracy,
      });
    }

    for (const p of participants) {
      // Event.timeTaken is always the defender's time (see ruleEngine.ts),
      // so role-specific timing has to come from this participant's own
      // Attempt rows instead.
      const attempts = await prisma.attempt.findMany({ where: { sessionId, userId: p.userId, role: p.role } });
      const successOutcome = p.role === 'attacker' ? 'breached' : 'defended';
      const correctRounds = attempts.filter((a) => a.outcome === successOutcome).length;
      const averageTime = attempts.length > 0 ? attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length : 0;

      await prisma.assessmentSnapshot.create({
        data: {
          userId: p.userId,
          sessionId,
          role: p.role,
          module: session.module,
          totalRounds: report.totalRounds,
          finalScore: p.finalScore,
          accuracy: p.accuracy,
          correctRounds,
          incorrectRounds: attempts.length - correctRounds,
          averageTime,
        },
      });
    }
  }

  static async getUserAnalytics(userId: string) {
    return prisma.analytics.findMany({
      where: { userId },
    });
  }

  static async getAnalyticsSummary(userId: string) {
    const analytics = await this.getUserAnalytics(userId);
    const sessions = await prisma.session.count({
      where: {
        OR: [
          { attackerId: userId },
          { defenderId: userId },
        ],
      },
    });

    let totalAttempts = 0;
    let correctAttempts = 0;
    let totalTime = 0;

    analytics.forEach(a => {
      totalAttempts += a.totalAttempts;
      correctAttempts += a.correctAttempts;
      totalTime += (a.averageTime * a.totalAttempts);
    });

    // Week-over-week accuracy: compares the average AssessmentSnapshot
    // accuracy in the last 7 days against the 7 days before that. Either
    // side is null (not a misleading 0) when there isn't enough history yet.
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeek, lastWeek] = await Promise.all([
      prisma.assessmentSnapshot.findMany({ where: { userId, completedAt: { gte: oneWeekAgo } } }),
      prisma.assessmentSnapshot.findMany({ where: { userId, completedAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    ]);
    const avgAccuracy = (rows: { accuracy: number }[]) =>
      rows.length > 0 ? rows.reduce((sum, r) => sum + r.accuracy, 0) / rows.length : null;
    const thisWeekAvg = avgAccuracy(thisWeek);
    const lastWeekAvg = avgAccuracy(lastWeek);
    const accuracyChangeVsLastWeek =
      thisWeekAvg !== null && lastWeekAvg !== null ? Math.round(thisWeekAvg - lastWeekAvg) : null;

    // Response-time distribution from recent individual round attempts —
    // the Analytics table only stores a per-category running average, not
    // enough to derive fastest/median/slowest.
    const recentAttempts = await prisma.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { timeTaken: true },
    });
    const times = recentAttempts.map((a) => a.timeTaken).sort((a, b) => a - b);
    const responseTimeStats = times.length > 0
      ? { fastest: times[0], median: times[Math.floor(times.length / 2)], slowest: times[times.length - 1] }
      : null;

    return {
      totalSessions: sessions,
      scenariosAttempted: totalAttempts,
      correctDecisions: correctAttempts,
      incorrectDecisions: totalAttempts - correctAttempts,
      averageScore: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      averageResponseTime: totalAttempts > 0 ? totalTime / totalAttempts : 0,
      accuracyChangeVsLastWeek,
      responseTimeStats,
    };
  }

  /**
   * One point per completed assessment (not per calendar day — a learner may
   * complete zero or several assessments on a given day), oldest first, for
   * the "Performance Over Time" chart.
   */
  static async getPerformanceTrends(userId: string, limit = 10) {
    const snapshots = await prisma.assessmentSnapshot.findMany({
      where: { userId },
      orderBy: { completedAt: 'asc' },
      take: limit,
    });
    return snapshots.map((s) => ({
      date: s.completedAt.toISOString().split('T')[0],
      accuracy: Math.round(s.accuracy),
      responseTime: Math.round(s.averageTime),
    }));
  }

  static async getCategoryAccuracy(userId: string) {
    const analytics = await this.getUserAnalytics(userId);
    return analytics.map(a => ({
      category: a.category,
      accuracy: a.accuracy,
    }));
  }

  /**
   * Most recent individual scenario rounds (not assessments) — one row per
   * Attempt — for the "Recent Activity" table.
   */
  static async getRecentActivity(userId: string, limit = 10) {
    const attempts = await prisma.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { scenario: true },
    });
    return attempts.map((a) => {
      const successOutcome = a.role === 'attacker' ? 'breached' : 'defended';
      const accuracy = a.outcome === successOutcome ? 100 : a.outcome === 'partially_defended' ? 50 : 0;
      return {
        id: a.id,
        date: a.createdAt.toISOString().split('T')[0],
        scenario: a.scenario.name,
        role: a.role,
        accuracy,
        time: a.timeTaken,
      };
    });
  }
}
