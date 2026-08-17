import { describe, it, expect } from 'vitest';
import { buildRuleRows } from '../../prisma/ruleGeneration';
import type { ScenarioDef } from '../../prisma/scenarioData';

// A synthetic scenario shaped like the bug report: two attacks and two
// defenses that all share the same category tag, where only one pairing
// per attack is an actual, designed countermeasure.
const sameCategoryScenario: ScenarioDef = {
  name: 'Test Scenario — Same Category Trap',
  description: 'test',
  category: 'Web Security',
  difficulty: 'Medium',
  targetSystem: 'Web Application',
  context: 'test',
  attackOptions: [
    { id: 'a1', name: 'SQL Injection', description: 'test', category: 'Web Security' },
    { id: 'a2', name: 'CSRF', description: 'test', category: 'Web Security' },
  ],
  defenseOptions: [
    { id: 'd1', name: 'Parameterized Queries', description: 'test', category: 'Web Security' },
    { id: 'd2', name: 'Anti-CSRF Tokens', description: 'test', category: 'Web Security' },
  ],
};

describe('buildRuleRows', () => {
  it('never assigns partially_defended just because attack.category === defense.category', () => {
    const rows = buildRuleRows('scenario-1', sameCategoryScenario);

    // a1 (SQL Injection) vs d2 (Anti-CSRF Tokens): same category, unrelated
    // defense. Old logic gave "partially_defended" here — must not anymore.
    const mismatch = rows.find((r) => r.attackType === 'a1' && r.defenseType === 'd2');
    expect(mismatch?.outcome).toBe('breached');

    // No row in this same-category scenario should be partially_defended,
    // since none of these pairings were explicitly authored as such.
    expect(rows.some((r) => r.outcome === 'partially_defended')).toBe(false);
  });

  it('outcome: defended for an attack\'s designated (same-index) counter', () => {
    const rows = buildRuleRows('scenario-1', sameCategoryScenario);
    const designated = rows.find((r) => r.attackType === 'a1' && r.defenseType === 'd1');
    expect(designated?.outcome).toBe('defended');
  });

  it('outcome: breached for every other, unreviewed pairing', () => {
    const rows = buildRuleRows('scenario-1', sameCategoryScenario);
    const unrelated = rows.find((r) => r.attackType === 'a2' && r.defenseType === 'd1');
    expect(unrelated?.outcome).toBe('breached');
  });

  it('uses an explicit mapping from explicitRules.ts when one exists, regardless of category', () => {
    // "Online Banking Portal" has an explicit partially_defended entry for
    // a2 (CSRF) vs d3 (Object-Level Authorization) even though the seed
    // scenario data isn't reproduced here — this test uses the real
    // scenario name so findExplicitRule() actually matches.
    const onlineBanking: ScenarioDef = {
      ...sameCategoryScenario,
      name: 'Online Banking Portal',
      attackOptions: [
        ...sameCategoryScenario.attackOptions,
        { id: 'a3', name: 'IDOR', description: 'test', category: 'Access Control' },
      ],
      defenseOptions: [
        ...sameCategoryScenario.defenseOptions,
        { id: 'd3', name: 'Object-Level Authorization', description: 'test', category: 'Access Control' },
      ],
    };

    const rows = buildRuleRows('scenario-1', onlineBanking);
    const explicit = rows.find((r) => r.attackType === 'a2' && r.defenseType === 'd3');
    expect(explicit?.outcome).toBe('partially_defended');
  });

  it('produces exactly one row per (attack, defense) combination', () => {
    const rows = buildRuleRows('scenario-1', sameCategoryScenario);
    expect(rows).toHaveLength(4); // 2 attacks x 2 defenses
  });
});
