import { PrismaClient } from '@prisma/client';

export interface RecommendedControl {
  name: string;
  description: string;
}

export interface FeedbackInput {
  outcome: string; // 'defended' | 'partially_defended' | 'breached'
  baseExplanation: string; // the specific, per-Rule-record reason (explicitRules.ts / ruleGeneration.ts)
  attackName: string;
  defenseName: string;
  concept: string; // scenario category — the cybersecurity module this round belongs to
  recommendedControl: RecommendedControl | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  defended: 'Defended',
  partially_defended: 'Partially Defended',
  breached: 'Breached',
};

/**
 * Deterministically composes the final feedback text shown to the learner
 * from fixed, data-sourced parts — outcome label, attack name, defense
 * name, the Rule record's specific base explanation, the concept/module,
 * and (for breached/partially_defended) the recommended control. No LLM or
 * external API is involved; the same input always produces the same
 * string.
 */
export function buildFeedback(input: FeedbackInput): string {
  const label = OUTCOME_LABELS[input.outcome] ?? input.outcome;

  let text = `Outcome: ${label}. ${input.attackName} vs. ${input.defenseName}. ${input.baseExplanation} Concept: ${input.concept}.`;

  if (input.recommendedControl) {
    text += ` Recommended control: ${input.recommendedControl.name} — ${input.recommendedControl.description}`;
  }

  return text;
}

/**
 * The recommended control for a breached/partially_defended round is the
 * defense that this exact attack actually resolves to "defended" against,
 * within this scenario — looked up from the seeded Rule data itself (not
 * assumed from option ordering), so it stays correct even if a scenario's
 * designated counter isn't the same-index option.
 */
export async function findRecommendedControl(
  prisma: Pick<PrismaClient, 'rule'>,
  scenarioId: string,
  attackId: string,
  defenseOptions: { id: string; name: string; description: string }[]
): Promise<RecommendedControl | null> {
  const winningRule = await prisma.rule.findFirst({
    where: { scenarioId, attackType: attackId, outcome: 'defended' },
  });
  if (!winningRule) return null;

  const option = defenseOptions.find((d) => d.id === winningRule.defenseType);
  return option ? { name: option.name, description: option.description } : null;
}
