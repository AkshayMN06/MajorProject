import { PrismaClient } from '@prisma/client';
import { buildLearningOutcomes } from './learningOutcomes';

const prisma = new PrismaClient();

interface CategoryStat {
  category: string;
  total: number;
  succeeded: number;
  accuracy: number;
}

interface RoundRecommendation {
  category: string;
  title: string;
  description: string;
}

function buildCategoryStats(
  events: { scenarioId: string; outcome: string }[],
  scenarioCategoryMap: Map<string, string>,
  isSuccess: (outcome: string) => boolean
): CategoryStat[] {
  const map: Record<string, { total: number; succeeded: number }> = {};
  for (const event of events) {
    const category = scenarioCategoryMap.get(event.scenarioId);
    if (!category) continue;
    if (!map[category]) map[category] = { total: 0, succeeded: 0 };
    map[category].total += 1;
    if (isSuccess(event.outcome)) map[category].succeeded += 1;
  }
  return Object.entries(map).map(([category, { total, succeeded }]) => ({
    category,
    total,
    succeeded,
    accuracy: Math.round((succeeded / total) * 100),
  }));
}

/**
 * Round-wise recommendations — derived from this session's own round-by-round
 * category performance, not lifetime history. Separate lists per role.
 */
function buildRecommendations(categories: CategoryStat[], role: 'attacker' | 'defender'): RoundRecommendation[] {
  const recs: RoundRecommendation[] = [];
  for (const c of categories) {
    if (c.accuracy < 50) {
      recs.push({
        category: c.category,
        title: role === 'attacker' ? `Review ${c.category} attack techniques` : `Review ${c.category} countermeasures`,
        description: role === 'attacker'
          ? `Your attacks in ${c.category} succeeded in ${c.accuracy}% of this assessment's rounds (${c.succeeded}/${c.total}). Study more effective techniques for this category.`
          : `Your defenses in ${c.category} succeeded in ${c.accuracy}% of this assessment's rounds (${c.succeeded}/${c.total}). Review stronger countermeasures for this category.`,
      });
    } else if (c.accuracy < 70) {
      recs.push({
        category: c.category,
        title: role === 'attacker' ? `Sharpen ${c.category} strategy` : `Strengthen ${c.category} strategy`,
        description: `You succeeded in ${c.accuracy}% of ${c.category} rounds this assessment (${c.succeeded}/${c.total}) — more practice here would make it a strong area.`,
      });
    }
  }
  return recs;
}

/**
 * Builds the final assessment report for a completed (or in-progress, for
 * reconnect purposes) session. Single source of truth used by both the
 * assessmentCompleted socket emit and the REST report endpoints, so the two
 * transports never disagree on shape.
 */
export async function buildAssessmentReport(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { attacker: true, defender: true },
  });
  if (!session) return null;

  const events = await prisma.event.findMany({
    where: { sessionId },
    orderBy: { turnId: 'asc' },
  });
  const scores = await prisma.score.findMany({
    where: { sessionId },
    orderBy: { roundNumber: 'asc' },
  });

  const totalRounds = events.length;
  const attackerWins = events.filter((e) => e.outcome === 'breached').length;
  const defenderWins = events.filter((e) => e.outcome === 'defended').length;
  const partials = events.filter((e) => e.outcome === 'partially_defended').length;

  const scenarioIds = Array.from(new Set(events.map((e) => e.scenarioId)));
  const scenarios = await prisma.scenario.findMany({ where: { id: { in: scenarioIds } } });
  const scenarioCategoryMap = new Map(scenarios.map((s) => [s.id, s.category]));

  // Attacker "succeeds" on breached; defender "succeeds" on defended.
  // Each role gets its own category breakdown, not a shared defender-only one.
  const attackerCategories = buildCategoryStats(events, scenarioCategoryMap, (o) => o === 'breached');
  const defenderCategories = buildCategoryStats(events, scenarioCategoryMap, (o) => o === 'defended');

  const attackerStrongTopics = attackerCategories.filter((c) => c.accuracy >= 70).map((c) => c.category);
  const attackerWeakTopics = attackerCategories.filter((c) => c.accuracy < 50).map((c) => c.category);
  const defenderStrongTopics = defenderCategories.filter((c) => c.accuracy >= 70).map((c) => c.category);
  const defenderWeakTopics = defenderCategories.filter((c) => c.accuracy < 50).map((c) => c.category);

  const attackerRecommendations = buildRecommendations(attackerCategories, 'attacker');
  const defenderRecommendations = buildRecommendations(defenderCategories, 'defender');

  const defenderAccuracy = totalRounds > 0 ? Math.round((defenderWins / totalRounds) * 100) : 0;
  const attackerAccuracy = totalRounds > 0 ? Math.round((attackerWins / totalRounds) * 100) : 0;

  // Learning Outcomes — Pre-test/Post-test, computed server-side per user
  // from their own QuizAttempt/QuizResponse rows (never trusts a client-
  // supplied score). These are one-time, account-level checkpoints, not
  // scoped to this session — see learningOutcomes.ts.
  const emptyLearningOutcomes = {
    hasPreTest: false,
    hasPostTest: false,
    preTestScore: null,
    postTestScore: null,
    learningGain: null,
    learningGainPercent: null,
    modulePerformance: [],
    weakTopics: [],
    recommendations: [],
  };
  const [attackerLearningOutcomes, defenderLearningOutcomes] = await Promise.all([
    buildLearningOutcomes(prisma, session.attackerId),
    session.defenderId ? buildLearningOutcomes(prisma, session.defenderId) : Promise.resolve(emptyLearningOutcomes),
  ]);

  const rounds = Array.from(
    new Set(scores.map((s) => s.roundNumber).filter((r): r is number => r != null))
  ).sort((a, b) => a - b);

  let attackerCumulative = 0;
  let defenderCumulative = 0;
  const performanceTimeline = rounds.map((round) => {
    const attackerScore = scores.find((s) => s.roundNumber === round && s.role === 'attacker');
    const defenderScore = scores.find((s) => s.roundNumber === round && s.role === 'defender');
    attackerCumulative += attackerScore?.totalScore ?? 0;
    defenderCumulative += defenderScore?.totalScore ?? 0;
    return {
      round,
      attackerRoundScore: attackerScore?.totalScore ?? 0,
      defenderRoundScore: defenderScore?.totalScore ?? 0,
      attackerCumulativeScore: attackerCumulative,
      defenderCumulativeScore: defenderCumulative,
    };
  });

  return {
    sessionId,
    sessionCode: session.sessionCode,
    attackerName: session.attacker.name,
    defenderName: session.defender?.name ?? 'Unknown',
    totalRounds,
    attackerFinalScore: session.attackerScore,
    defenderFinalScore: session.defenderScore,
    attackerWins,
    defenderWins,
    partials,
    attackerAccuracy,
    defenderAccuracy,
    averageAccuracy: Math.round((attackerAccuracy + defenderAccuracy) / 2),
    attackerCategories,
    defenderCategories,
    attackerStrongTopics,
    attackerWeakTopics,
    defenderStrongTopics,
    defenderWeakTopics,
    attackerRecommendations,
    defenderRecommendations,
    attackerLearningOutcomes,
    defenderLearningOutcomes,
    performanceTimeline,
    events: events.map((e) => ({
      turnId: e.turnId,
      scenarioId: e.scenarioId,
      attackerChoice: e.attackerChoice,
      defenderChoice: e.defenderChoice,
      outcome: e.outcome,
      score: e.score,
      timeTaken: e.timeTaken,
      timestamp: e.timestamp,
    })),
  };
}
