import { PrismaClient } from '@prisma/client';

export interface ResolvedOutcome {
  outcome: string;
  explanation: string;
}

/**
 * Pure, deterministic Rule lookup — extracted from ruleEngine.ts so it can
 * be unit tested without mocking the full evaluate() pipeline (scoring,
 * event logging, attempts, analytics). Same inputs always return the same
 * outcome; no category-matching or other inference happens here — every
 * possible outcome comes from a seeded Rule row (see
 * server/prisma/ruleGeneration.ts and server/prisma/explicitRules.ts).
 *
 * findUnique (not findFirst) is deliberate: the Rule model's
 * (scenarioId, attackType, defenseType) unique index guarantees at the
 * database level that at most one row can ever match.
 */
export async function resolveOutcome(
  prisma: Pick<PrismaClient, 'rule'>,
  scenarioId: string,
  attackerChoice: string,
  defenderChoice: string
): Promise<ResolvedOutcome> {
  const rule = await prisma.rule.findUnique({
    where: {
      scenarioId_attackType_defenseType: {
        scenarioId,
        attackType: attackerChoice,
        defenseType: defenderChoice,
      },
    },
  });

  if (rule) {
    return { outcome: rule.outcome, explanation: rule.explanation };
  }

  // Every reachable (attack, defense) pairing within a scenario is seeded
  // with an explicit row, so reaching this branch means seed data is
  // incomplete for this pairing — a data-integrity bug, not an expected
  // "no relationship" case. Log it loudly and fail safe (no unearned
  // credit) rather than silently guessing an outcome.
  console.error(
    `[ruleResolver] No Rule row for scenario=${scenarioId} attack=${attackerChoice} defense=${defenderChoice} — seed data is incomplete for this pairing.`
  );
  return {
    outcome: 'breached',
    explanation: 'No specific countermeasure was found for this combination — the defense provided no protection against this attack.',
  };
}
