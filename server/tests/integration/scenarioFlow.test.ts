import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindUniqueScenario: vi.fn(),
  mockFindUniqueSession: vi.fn(),
  mockFindFirstRule: vi.fn(),
  mockCountEvent: vi.fn(),
  mockCreateEvent: vi.fn(),
  mockCreateAttempt: vi.fn(),
  mockFindManyAttempt: vi.fn(),
  mockCountAttempt: vi.fn(),
  mockFindFirstAnalytics: vi.fn(),
  mockCreateAnalytics: vi.fn(),
  mockUpdateAnalytics: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    scenario: { findUnique: mocks.mockFindUniqueScenario },
    session: { findUnique: mocks.mockFindUniqueSession },
    rule: { findFirst: mocks.mockFindFirstRule },
    event: { count: mocks.mockCountEvent, create: mocks.mockCreateEvent },
    attempt: { create: mocks.mockCreateAttempt, findMany: mocks.mockFindManyAttempt, count: mocks.mockCountAttempt },
    analytics: { findFirst: mocks.mockFindFirstAnalytics, create: mocks.mockCreateAnalytics, update: mocks.mockUpdateAnalytics },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { RuleEngine } from '../../src/services/ruleEngine';
const ruleEngine = new RuleEngine();

describe('Scenario Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Full defended flow', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue({ id: 'sess1', defenderId: 'u1', status: 'IN_PROGRESS' });
    mocks.mockFindFirstRule.mockResolvedValue({ outcome: 'defended', explanation: 'Good job.' });
    mocks.mockCountEvent.mockResolvedValue(0);
    mocks.mockFindManyAttempt.mockResolvedValue([]);
    mocks.mockCountAttempt.mockResolvedValue(0);
    mocks.mockFindFirstAnalytics.mockResolvedValue(null);

    const result = await ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 20);

    expect(result.outcome).toBe('defended');
    expect(result.scoreBreakdown.total).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/^Success!/);
    expect(mocks.mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateAnalytics).toHaveBeenCalledTimes(1);
  });

  it('Full breached flow', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue({ id: 'sess1', defenderId: 'u1', status: 'IN_PROGRESS' });
    mocks.mockFindFirstRule.mockResolvedValue({ outcome: 'breached', explanation: 'Failed.' });
    mocks.mockCountEvent.mockResolvedValue(0);
    mocks.mockFindManyAttempt.mockResolvedValue([]);
    mocks.mockCountAttempt.mockResolvedValue(0);
    mocks.mockFindFirstAnalytics.mockResolvedValue(null);

    const result = await ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 100);

    expect(result.outcome).toBe('breached');
    expect(result.scoreBreakdown.correctDefense).toBe(0);
    expect(result.explanation).toMatch(/^Breach Detected\./);
  });

  it('Partial defense flow', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue({ id: 'sess1', defenderId: 'u1', status: 'IN_PROGRESS' });
    mocks.mockFindFirstRule.mockResolvedValue({ outcome: 'partially_defended', explanation: 'Okay.' });
    mocks.mockCountEvent.mockResolvedValue(0);
    mocks.mockFindManyAttempt.mockResolvedValue([]);
    mocks.mockCountAttempt.mockResolvedValue(0);
    mocks.mockFindFirstAnalytics.mockResolvedValue(null);

    const result = await ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 45);

    expect(result.outcome).toBe('partially_defended');
    expect(result.scoreBreakdown.correctDefense).toBe(15);
  });

  it('No rule found fallback', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue({ id: 'sess1', defenderId: 'u1', status: 'IN_PROGRESS' });
    mocks.mockFindFirstRule.mockResolvedValue(null);
    mocks.mockCountEvent.mockResolvedValue(0);
    mocks.mockFindManyAttempt.mockResolvedValue([]);
    mocks.mockCountAttempt.mockResolvedValue(0);
    mocks.mockFindFirstAnalytics.mockResolvedValue(null);

    const result = await ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 50);

    expect(result.outcome).toBe('breached');
  });

  it('Invalid session', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue(null);

    await expect(ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 50)).rejects.toThrow('Session sess1 not found');
  });

  it('Invalid scenario', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue(null);

    await expect(ruleEngine.evaluate('sess1', 'scenX', 'atk', 'def', {}, {}, 50)).rejects.toThrow('Scenario scenX not found');
  });

  it('Completed session', async () => {
    mocks.mockFindUniqueScenario.mockResolvedValue({ id: 'scen1', category: 'NetSec' });
    mocks.mockFindUniqueSession.mockResolvedValue({ id: 'sess1', defenderId: 'u1', status: 'SESSION_COMPLETE' });

    await expect(ruleEngine.evaluate('sess1', 'scen1', 'atk', 'def', {}, {}, 50)).rejects.toThrow('Session is already complete');
  });
});
