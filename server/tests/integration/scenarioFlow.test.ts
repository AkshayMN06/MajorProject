import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scenario: { findUnique: vi.fn() },
  session: { findUnique: vi.fn() },
  rule: { findUnique: vi.fn(), findFirst: vi.fn() },
  event: { count: vi.fn(), create: vi.fn() },
  attempt: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  score: { create: vi.fn() },
  analytics: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mocks),
}));

import { RuleEngine } from '../../src/services/ruleEngine';
const ruleEngine = new RuleEngine();

const scenario = {
  id: 'scen1',
  category: 'NetSec',
  attackOptions: [{ id: 'atk', name: 'Attack', description: 'An attack.' }],
  defenseOptions: [{ id: 'def', name: 'Defense', description: 'A defense.' }],
};

const evaluateInput = {
  sessionId: 'sess1',
  scenarioId: 'scen1',
  attackerId: 'attacker-1',
  defenderId: 'defender-1',
  attackerChoice: 'atk',
  defenderChoice: 'def',
  attackerTimeTaken: 20,
  defenderTimeTaken: 20,
};

// Defaults shared by every case: valid scenario, in-progress session, no
// prior attempt history, no existing analytics row. Each test only needs to
// set the Rule outcome (and findFirst for the recommended-control lookup).
function mockHappyPathCollaborators() {
  mocks.scenario.findUnique.mockResolvedValue(scenario);
  mocks.session.findUnique.mockResolvedValue({ id: 'sess1', status: 'IN_PROGRESS' });
  mocks.event.count.mockResolvedValue(0);
  mocks.attempt.findMany.mockResolvedValue([]);
  mocks.attempt.count.mockResolvedValue(0);
  mocks.analytics.findFirst.mockResolvedValue(null);
}

describe('Scenario Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Full defended flow', async () => {
    mockHappyPathCollaborators();
    mocks.rule.findUnique.mockResolvedValue({ outcome: 'defended', explanation: 'Good job.' });

    const result = await ruleEngine.evaluate(evaluateInput);

    expect(result.outcome).toBe('defended');
    expect(result.defenderScoreBreakdown.total).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/^Outcome: Defended\./);
    expect(mocks.event.create).toHaveBeenCalledTimes(1);
    expect(mocks.attempt.create).toHaveBeenCalledTimes(2);
    expect(mocks.analytics.create).toHaveBeenCalledTimes(2);
  });

  it('Full breached flow', async () => {
    mockHappyPathCollaborators();
    mocks.rule.findUnique.mockResolvedValue({ outcome: 'breached', explanation: 'Failed.' });
    mocks.rule.findFirst.mockResolvedValue(null); // no recommended-control row seeded for this pairing

    const result = await ruleEngine.evaluate(evaluateInput);

    expect(result.outcome).toBe('breached');
    expect(result.defenderScoreBreakdown.correctChoice).toBe(0);
    expect(result.explanation).toMatch(/^Outcome: Breached\./);
  });

  it('Partial defense flow', async () => {
    mockHappyPathCollaborators();
    mocks.rule.findUnique.mockResolvedValue({ outcome: 'partially_defended', explanation: 'Okay.' });
    mocks.rule.findFirst.mockResolvedValue(null);

    const result = await ruleEngine.evaluate(evaluateInput);

    expect(result.outcome).toBe('partially_defended');
    expect(result.defenderScoreBreakdown.correctChoice).toBe(25);
  });

  it('No rule found fallback', async () => {
    mockHappyPathCollaborators();
    mocks.rule.findUnique.mockResolvedValue(null); // no explicit Rule row for this pairing
    mocks.rule.findFirst.mockResolvedValue(null);

    const result = await ruleEngine.evaluate(evaluateInput);

    expect(result.outcome).toBe('breached');
  });

  it('Invalid session', async () => {
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mocks.session.findUnique.mockResolvedValue(null);

    await expect(ruleEngine.evaluate(evaluateInput)).rejects.toThrow('Session sess1 not found');
  });

  it('Invalid scenario', async () => {
    mocks.scenario.findUnique.mockResolvedValue(null);

    await expect(ruleEngine.evaluate(evaluateInput)).rejects.toThrow('Scenario scen1 not found');
  });

  it('Completed session', async () => {
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mocks.session.findUnique.mockResolvedValue({ id: 'sess1', status: 'ASSESSMENT_COMPLETE' });

    await expect(ruleEngine.evaluate(evaluateInput)).rejects.toThrow('Session is already complete');
  });

  it('Invalid attack choice is rejected before touching the Rule table', async () => {
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mocks.session.findUnique.mockResolvedValue({ id: 'sess1', status: 'IN_PROGRESS' });

    await expect(ruleEngine.evaluate({ ...evaluateInput, attackerChoice: 'not-a-real-option' })).rejects.toThrow(
      'Invalid attack choice: not-a-real-option'
    );
    expect(mocks.rule.findUnique).not.toHaveBeenCalled();
  });
});
