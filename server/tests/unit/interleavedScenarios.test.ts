import { describe, it, expect } from 'vitest';
import { buildInterleavedScenarioSet, type ScenarioLike } from '../../src/services/interleavedScenarios';

function makeScenarios(counts: Record<string, number>): ScenarioLike[] {
  const scenarios: ScenarioLike[] = [];
  for (const [category, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      scenarios.push({ id: `${category}-${i}`, category });
    }
  }
  return scenarios;
}

describe('interleavedScenarios.buildInterleavedScenarioSet', () => {
  it('spans every distinct category when there are at least as many rounds as categories', () => {
    const scenarios = makeScenarios({ 'Web Security': 10, 'Network Security': 10, Cryptography: 10, 'Social Engineering': 10 });
    const selected = buildInterleavedScenarioSet(scenarios, 5);

    expect(selected).toHaveLength(5);
    const categoriesUsed = new Set(selected.map((id) => id.split('-')[0]));
    expect(categoriesUsed.size).toBeGreaterThanOrEqual(4);
  });

  it('never returns duplicate scenario ids', () => {
    const scenarios = makeScenarios({ 'Web Security': 10, 'Network Security': 10, Cryptography: 10 });
    const selected = buildInterleavedScenarioSet(scenarios, 8);
    expect(new Set(selected).size).toBe(selected.length);
  });

  it('caps at the total number of scenarios available across all categories', () => {
    const scenarios = makeScenarios({ 'Web Security': 2, 'Network Security': 1 });
    const selected = buildInterleavedScenarioSet(scenarios, 10);
    expect(selected).toHaveLength(3);
  });

  it('returns an empty set when given no scenarios', () => {
    expect(buildInterleavedScenarioSet([], 5)).toEqual([]);
  });

  it('draws roughly evenly rather than exhausting one category before touching another', () => {
    // 1 huge category, 3 tiny ones — a correct round-robin still visits the
    // tiny categories on the very first lap instead of only ever picking
    // from the huge one.
    const scenarios = makeScenarios({ Huge: 100, TinyA: 1, TinyB: 1, TinyC: 1 });
    const selected = buildInterleavedScenarioSet(scenarios, 4);
    const categoriesUsed = new Set(selected.map((id) => id.split('-')[0]));
    expect(categoriesUsed.size).toBe(4);
  });
});
