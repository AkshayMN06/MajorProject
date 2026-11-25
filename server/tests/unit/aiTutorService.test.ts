import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scenarioFindMany: vi.fn(),
  ruleFindMany: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    scenario: { findMany: mocks.scenarioFindMany },
    rule: { findMany: mocks.ruleFindMany },
  })),
}));

import { chatWithTutor } from '../../src/services/aiTutorService';

it('batches scenario rules and retains scenario-specific answers on cached requests', async () => {
  mocks.scenarioFindMany.mockResolvedValue([
    {
      id: 'first', name: 'First Scenario', category: 'Network Security',
      attackOptions: [{ id: 'a1', name: 'Sample Choice', description: 'First description.', difficulty: 'Easy' }],
      defenseOptions: [{ id: 'd1', name: 'First Control', description: '', effectiveness: 'High' }],
    },
    {
      id: 'second', name: 'Second Scenario', category: 'Web Security',
      attackOptions: [{ id: 'a1', name: 'Sample Choice', description: 'Second description.', difficulty: 'Medium' }],
      defenseOptions: [{ id: 'd1', name: 'Second Control', description: '', effectiveness: 'High' }],
    },
  ]);
  mocks.ruleFindMany.mockResolvedValue([
    { scenarioId: 'first', attackType: 'a1', defenseType: 'd1' },
  ]);

  const answer = await chatWithTutor('Sample Choice');
  expect(answer).toBe(
    'In the "First Scenario" scenario (Network Security): **Sample Choice** — First description. (difficulty: Easy). ' +
    'The countermeasure that stops it here is **First Control**.\n\n' +
    'In the "Second Scenario" scenario (Web Security): **Sample Choice** — Second description. (difficulty: Medium).',
  );
  expect(await chatWithTutor('Sample Choice')).toBe(answer);
  expect(mocks.scenarioFindMany).toHaveBeenCalledTimes(1);
  expect(mocks.ruleFindMany).toHaveBeenCalledTimes(1);
  expect(mocks.ruleFindMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { scenarioId: { in: ['first', 'second'] }, outcome: 'defended' },
  }));
});
