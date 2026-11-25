import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { buildAssessmentReport } from './reportBuilder';

const prisma = new PrismaClient();

export class AnalyticsEngine {
  /**
   * Adds one attempt to the learner's per-category aggregate in a single
   * atomic statement: insert the first row, or fold the attempt into the
   * existing one (unique on userId+category). The database evaluates every SET
   * expression against the pre-update row, so count, accuracy and weighted
   * average time always come from the same snapshot — no read-modify-write
   * window, whether or not the caller is inside a transaction. (PostgreSQL
   * evaluates SET expressions against the existing row, and the conflicting
   * row is locked for the update.)
   */
  static async updateAnalytics(userId: string, category: string, isCorrect: boolean, timeTaken: number, db: Prisma.TransactionClient = prisma) {
    const correct = isCorrect ? 1 : 0;
    const now = new Date();
    await db.$executeRaw`
      INSERT INTO "analytics" AS a ("id", "userId", "category", "totalAttempts", "correctAttempts", "averageTime", "accuracy", "lastUpdated")
      VALUES (${randomUUID()}, ${userId}, ${category}, 1, ${correct}, ${timeTaken}, ${correct * 100.0}, ${now})
      ON CONFLICT ("userId", "category") DO UPDATE SET
        "averageTime"     = (a."averageTime" * a."totalAttempts" + excluded."averageTime") / (a."totalAttempts" + 1),
        "accuracy"        = (a."correctAttempts" + excluded."correctAttempts") * 100.0 / (a."totalAttempts" + 1),
        "correctAttempts" = a."correctAttempts" + excluded."correctAttempts",
        "totalAttempts"   = a."totalAttempts" + 1,
        "lastUpdated"     = excluded."lastUpdated"`;
    return db.analytics.findUniqueOrThrow({ where: { userId_category: { userId, category } } });
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
  static async recordAssessmentCompletion(sessionId: string, db: Prisma.TransactionClient = prisma) {
    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const report = await buildAssessmentReport(sessionId, db);
    if (!report) return;

    // In SOLO mode attackerId === defenderId (the same human occupies both
    // slots) — only the role the human actually played should get a
    // snapshot, not a phantom empty one for the system-controlled side.
    const participants: { userId: string; role: 'attacker' | 'defender'; finalScore: number; accuracy: number }[] =
      session.mode === 'SOLO'
        ? [
            session.soloRole === 'DEFENDER'
              ? { userId: session.attackerId, role: 'defender' as const, finalScore: report.defenderFinalScore, accuracy: report.defenderAccuracy }
              : { userId: session.attackerId, role: 'attacker' as const, finalScore: report.attackerFinalScore, accuracy: report.attackerAccuracy },
          ]
        : [{ userId: session.attackerId, role: 'attacker', finalScore: report.attackerFinalScore, accuracy: report.attackerAccuracy }];
    if (session.mode !== 'SOLO' && session.defenderId) {
      participants.push({
        userId: session.defenderId,
        role: 'defender',
        finalScore: report.defenderFinalScore,
        accuracy: report.defenderAccuracy,
      });
    }

    for (const p of participants) {
      const exists = await db.assessmentSnapshot.findFirst({
        where: { userId: p.userId, sessionId, role: p.role },
        select: { id: true },
      });
      if (exists) continue;

      // Event.timeTaken is always the defender's time (see ruleEngine.ts),
      // so role-specific timing has to come from this participant's own
      // Attempt rows instead.
      const attempts = await db.attempt.findMany({ where: { sessionId, userId: p.userId, role: p.role } });
      const successOutcome = p.role === 'attacker' ? 'breached' : 'defended';
      const correctRounds = attempts.filter((a) => a.outcome === successOutcome).length;
      const averageTime = attempts.length > 0 ? attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length : 0;

      await db.assessmentSnapshot.create({
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
          completedAt: session.completedAt ?? undefined,
        },
      });
    }
  }

  static async getUserAnalytics(userId: string, db: Prisma.TransactionClient = prisma) {
    return db.analytics.findMany({
      where: { userId },
    });
  }

  static async getAnalyticsSummary(userId: string, db: Prisma.TransactionClient = prisma) {
    const analytics = await this.getUserAnalytics(userId, db);
    const sessions = await db.session.count({
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
      db.assessmentSnapshot.findMany({ where: { userId, completedAt: { gte: oneWeekAgo } } }),
      db.assessmentSnapshot.findMany({ where: { userId, completedAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
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
    const recentAttempts = await db.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { timeTaken: true },
    });
    const times = recentAttempts.map((a) => a.timeTaken).sort((a, b) => a - b);
    const lowerMiddle = Math.floor((times.length - 1) / 2);
    const upperMiddle = Math.floor(times.length / 2);
    const responseTimeStats = times.length > 0
      ? { fastest: times[0], median: (times[lowerMiddle] + times[upperMiddle]) / 2, slowest: times[times.length - 1] }
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
   * complete zero or several assessments on a given day, and two same-day
   * points must still be visually distinct on the chart), for the
   * "Performance Over Time" chart. `session` is a sequential, always-unique
   * label ("Session 1", "Session 2", ...) meant for the X axis itself —
   * `date`/`time` are the real completion timestamp, for the tooltip.
   *
   * Fetches the most recent `limit` completions (not the oldest — an
   * account with more than `limit` total sessions must still show its
   * *current* trend, not get stuck forever on its earliest history), then
   * reverses to chronological order so the chart still reads oldest-to-
   * newest left-to-right.
   */
  static async getPerformanceTrends(userId: string, limit = 10) {
    const snapshots = await prisma.assessmentSnapshot.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
    const chronological = snapshots.reverse();
    return chronological.map((s, i) => ({
      session: `Session ${i + 1}`,
      date: s.completedAt.toISOString().split('T')[0],
      time: s.completedAt.toISOString().split('T')[1].slice(0, 5),
      accuracy: Math.round(s.accuracy),
      responseTime: Math.round(s.averageTime),
    }));
  }

  static async getCategoryAccuracy(userId: string, db: Prisma.TransactionClient = prisma) {
    const analytics = await this.getUserAnalytics(userId, db);
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
