import { ScenarioDef } from './scenarioData';
import { findExplicitRule } from './explicitRules';

export interface RuleRow {
  scenarioId: string;
  attackType: string;
  defenseType: string;
  outcome: string;
  explanation: string;
  scoreModifier: number;
}

/**
 * Builds every Rule row for one scenario. Outcome is determined by, in
 * order:
 *   1. An explicit, hand-authored mapping from explicitRules.ts, if one
 *      exists for this (scenario, attack, defense) triple.
 *   2. "defended", if this defense is the attack's designated counter (the
 *      same-index pairing deliberately built as its intended countermeasure
 *      when the scenario's content was authored — a real designed
 *      relationship, not a coincidence).
 *   3. A conservative "breached" default for every other, not-yet-reviewed
 *      pairing.
 *
 * Category tags are never consulted here — matching categories no longer
 * implies any outcome.
 */
export function buildRuleRows(scenarioId: string, sData: ScenarioDef): RuleRow[] {
  const rows: RuleRow[] = [];

  for (const attack of sData.attackOptions) {
    for (const defense of sData.defenseOptions) {
      const explicitRule = findExplicitRule(sData.name, attack.id, defense.id);

      if (explicitRule) {
        rows.push({
          scenarioId,
          attackType: attack.id,
          defenseType: defense.id,
          outcome: explicitRule.outcome,
          explanation: explicitRule.explanation,
          scoreModifier: explicitRule.scoreModifier,
        });
        continue;
      }

      const isDesignatedCounter = attack.id.replace('a', 'd') === defense.id;
      rows.push({
        scenarioId,
        attackType: attack.id,
        defenseType: defense.id,
        outcome: isDesignatedCounter ? 'defended' : 'breached',
        explanation: isDesignatedCounter
          ? 'This defense was purpose-built as the intended countermeasure for this attack.'
          : 'No specific countermeasure has been established for this combination. This pairing has not yet been reviewed for the possibility of partial mitigation, so it conservatively defaults to breached rather than assuming an unverified partial credit.',
        scoreModifier: isDesignatedCounter ? 20 : -10,
      });
    }
  }

  return rows;
}
