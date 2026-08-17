import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same pattern as tests/integration/scenarioFlow.test.ts: fake the Prisma
// client's delegates rather than a real database, since RuleEngine.evaluate()
// is the thing under test, not Prisma itself.
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

/**
 * Mocks for everything RuleEngine.evaluate() touches that ISN'T the rule
 * lookup itself: session-status gate, turn numbering, per-user consistency
 * history, and analytics. Kept as "no prior history" defaults so each test
 * only has to set up the one (attack, defense) pairing it's about.
 */
function mockCollaborators(sessionId: string) {
  mocks.session.findUnique.mockResolvedValue({ id: sessionId, status: 'IN_PROGRESS' });
  mocks.event.count.mockResolvedValue(0);
  mocks.attempt.findMany.mockResolvedValue([]);
  mocks.attempt.count.mockResolvedValue(0);
  mocks.analytics.findFirst.mockResolvedValue(null);
}

const baseInput = {
  sessionId: 'session-1',
  attackerId: 'attacker-1',
  defenderId: 'defender-1',
  attackerTimeTaken: 20,
  defenderTimeTaken: 20,
};

describe('RuleEngine.evaluate — deterministic rule cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Spear Phishing + Security Awareness Training => defended', async () => {
    const scenario = {
      id: 'scenario-hr-onboarding',
      category: 'Social Engineering',
      attackOptions: [{ id: 'a1', name: 'Spear Phishing', description: 'Send a targeted, personalized phishing email.' }],
      defenseOptions: [{ id: 'd1', name: 'Security Awareness Training', description: 'Train staff to recognize targeted lures.' }],
    };
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mockCollaborators(baseInput.sessionId);

    // The explicit Rule record for this (attack, defense) pairing — this is
    // what "seeds" the deterministic outcome; resolveOutcome() just looks it
    // up by its (scenarioId, attackType, defenseType) unique key.
    mocks.rule.findUnique.mockResolvedValue({
      outcome: 'defended',
      explanation:
        "Security awareness training conditions staff to verify unexpected, urgent requests through a separate channel rather than trusting the email's claimed authority, which is exactly what a personalized spear-phishing lure depends on.",
    });

    const result = await ruleEngine.evaluate({
      ...baseInput,
      scenarioId: scenario.id,
      attackerChoice: 'a1',
      defenderChoice: 'd1',
    });

    // Outcome + explanation
    expect(result.outcome).toBe('defended');
    expect(result.explanation).toBe(
      "Outcome: Defended. Spear Phishing vs. Security Awareness Training. Security awareness training conditions staff to verify unexpected, urgent requests through a separate channel rather than trusting the email's claimed authority, which is exactly what a personalized spear-phishing lure depends on. Concept: Social Engineering."
    );

    // The explicit Rule record was looked up by the correct compound key
    expect(mocks.rule.findUnique).toHaveBeenCalledWith({
      where: { scenarioId_attackType_defenseType: { scenarioId: scenario.id, attackType: 'a1', defenseType: 'd1' } },
    });

    // An Event record is created for this round
    expect(mocks.event.create).toHaveBeenCalledTimes(1);
    expect(mocks.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        turnId: 1,
        sessionId: baseInput.sessionId,
        scenarioId: scenario.id,
        attackerChoice: 'a1',
        defenderChoice: 'd1',
        resolvedRule: 'a1_vs_d1',
        outcome: 'defended',
      }),
    });
  });

  it('SQL Injection + Web Application Firewall => partially_defended', async () => {
    const scenario = {
      id: 'scenario-checkout',
      category: 'Web Security',
      attackOptions: [{ id: 'a1', name: 'SQL Injection', description: 'Exploit unsanitized database queries.' }],
      defenseOptions: [
        { id: 'd1', name: 'Parameterized Queries', description: 'Use prepared statements for all queries.' },
        { id: 'd2', name: 'Web Application Firewall', description: 'Filters and blocks common attack patterns at the application layer.' },
      ],
    };
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mockCollaborators(baseInput.sessionId);

    mocks.rule.findUnique.mockResolvedValue({
      outcome: 'partially_defended',
      explanation:
        'A Web Application Firewall blocks many common SQL injection payload patterns at the network edge, but it inspects request signatures rather than validating the query itself — a payload that evades its pattern list can still reach an unsanitized query, so some risk remains.',
    });
    // Non-defended outcomes look up the pairing's actual countermeasure
    // (findRecommendedControl) — Parameterized Queries is the one that
    // resolves to "defended" for SQL Injection in this scenario.
    mocks.rule.findFirst.mockResolvedValue({ defenseType: 'd1' });

    const result = await ruleEngine.evaluate({
      ...baseInput,
      scenarioId: scenario.id,
      attackerChoice: 'a1',
      defenderChoice: 'd2',
    });

    expect(result.outcome).toBe('partially_defended');
    expect(result.explanation).toBe(
      'Outcome: Partially Defended. SQL Injection vs. Web Application Firewall. A Web Application Firewall blocks many common SQL injection payload patterns at the network edge, but it inspects request signatures rather than validating the query itself — a payload that evades its pattern list can still reach an unsanitized query, so some risk remains. Concept: Web Security. Recommended control: Parameterized Queries — Use prepared statements for all queries.'
    );

    expect(mocks.rule.findUnique).toHaveBeenCalledWith({
      where: { scenarioId_attackType_defenseType: { scenarioId: scenario.id, attackType: 'a1', defenseType: 'd2' } },
    });

    expect(mocks.event.create).toHaveBeenCalledTimes(1);
    expect(mocks.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        turnId: 1,
        sessionId: baseInput.sessionId,
        scenarioId: scenario.id,
        attackerChoice: 'a1',
        defenderChoice: 'd2',
        resolvedRule: 'a1_vs_d2',
        outcome: 'partially_defended',
      }),
    });
  });

  it('SQL Injection + Anti-CSRF Tokens => breached', async () => {
    const scenario = {
      id: 'scenario-online-banking',
      category: 'Web Security',
      attackOptions: [{ id: 'a1', name: 'SQL Injection', description: 'Exploit unsanitized database queries.' }],
      defenseOptions: [
        { id: 'd1', name: 'Parameterized Queries', description: 'Use prepared statements for all queries.' },
        { id: 'd2', name: 'Anti-CSRF Tokens', description: 'Require a per-session token on state-changing requests.' },
      ],
    };
    mocks.scenario.findUnique.mockResolvedValue(scenario);
    mockCollaborators(baseInput.sessionId);

    // Real bug-fix case from server/prisma/explicitRules.ts: SQL Injection
    // and Anti-CSRF Tokens share the "Web Security" category tag, but a
    // forged-request check provides no protection against SQL injection —
    // must resolve to breached, not a category-matched partial credit.
    mocks.rule.findUnique.mockResolvedValue({
      outcome: 'breached',
      explanation:
        "Anti-CSRF tokens verify that a request originated from the application's own form, not that its parameters are safe to use in a database query. A forged-request check does nothing to stop malicious SQL inside a legitimately-submitted field.",
    });
    mocks.rule.findFirst.mockResolvedValue({ defenseType: 'd1' });

    const result = await ruleEngine.evaluate({
      ...baseInput,
      scenarioId: scenario.id,
      attackerChoice: 'a1',
      defenderChoice: 'd2',
    });

    expect(result.outcome).toBe('breached');
    expect(result.explanation).toBe(
      "Outcome: Breached. SQL Injection vs. Anti-CSRF Tokens. Anti-CSRF tokens verify that a request originated from the application's own form, not that its parameters are safe to use in a database query. A forged-request check does nothing to stop malicious SQL inside a legitimately-submitted field. Concept: Web Security. Recommended control: Parameterized Queries — Use prepared statements for all queries."
    );

    expect(mocks.rule.findUnique).toHaveBeenCalledWith({
      where: { scenarioId_attackType_defenseType: { scenarioId: scenario.id, attackType: 'a1', defenseType: 'd2' } },
    });

    expect(mocks.event.create).toHaveBeenCalledTimes(1);
    expect(mocks.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        turnId: 1,
        sessionId: baseInput.sessionId,
        scenarioId: scenario.id,
        attackerChoice: 'a1',
        defenderChoice: 'd2',
        resolvedRule: 'a1_vs_d2',
        outcome: 'breached',
      }),
    });
  });
});
