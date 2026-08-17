import { describe, it, expect, vi } from 'vitest';
import { resolveOutcome } from '../../src/services/ruleResolver';

// A minimal fake of the one Prisma delegate resolveOutcome() touches —
// no need to mock the whole PrismaClient module for a pure lookup function.
function fakePrisma(row: { outcome: string; explanation: string } | null) {
  return { rule: { findUnique: vi.fn().mockResolvedValue(row) } };
}

describe('ruleResolver.resolveOutcome', () => {
  // Real pairing from the "Online Banking Portal" scenario (see
  // server/prisma/explicitRules.ts) — the defense purpose-built for this attack.
  it('outcome: defended — SQL Injection vs. Parameterized Queries', async () => {
    const prisma = fakePrisma({
      outcome: 'defended',
      explanation: 'Parameterized queries separate SQL code from user-supplied data...',
    });

    const result = await resolveOutcome(prisma as any, 'scenario-1', 'a1', 'd1');

    expect(result.outcome).toBe('defended');
    expect(prisma.rule.findUnique).toHaveBeenCalledWith({
      where: { scenarioId_attackType_defenseType: { scenarioId: 'scenario-1', attackType: 'a1', defenseType: 'd1' } },
    });
  });

  // Real pairing from "Online Banking Portal" — CSRF vs. Object-Level
  // Authorization: doesn't stop the forged request, but limits which
  // resources it can touch. A genuine partial-credit case, not a
  // category-matching guess.
  it('outcome: partially_defended — CSRF vs. Object-Level Authorization', async () => {
    const prisma = fakePrisma({
      outcome: 'partially_defended',
      explanation: 'Object-level authorization does not stop the forged request from being processed...',
    });

    const result = await resolveOutcome(prisma as any, 'scenario-1', 'a2', 'd3');

    expect(result.outcome).toBe('partially_defended');
  });

  // The exact bug report case: SQL Injection vs. Anti-CSRF Tokens share the
  // "Web Security" category tag, but Anti-CSRF Tokens provides no
  // protection against SQL injection. Must resolve to breached, not the old
  // category-matched partially_defended.
  it('outcome: breached — SQL Injection vs. Anti-CSRF Tokens (same category, unrelated defense)', async () => {
    const prisma = fakePrisma({
      outcome: 'breached',
      explanation: 'Anti-CSRF tokens verify that a request originated from the application\'s own form...',
    });

    const result = await resolveOutcome(prisma as any, 'scenario-1', 'a1', 'd2');

    expect(result.outcome).toBe('breached');
  });

  it('is deterministic — the same inputs always return the same outcome', async () => {
    const prisma = fakePrisma({ outcome: 'breached', explanation: 'No relationship.' });

    const first = await resolveOutcome(prisma as any, 'scenario-1', 'a1', 'd2');
    const second = await resolveOutcome(prisma as any, 'scenario-1', 'a1', 'd2');

    expect(first).toEqual(second);
  });

  it('falls back to breached (never partially_defended) when no Rule row exists', async () => {
    const prisma = fakePrisma(null);

    const result = await resolveOutcome(prisma as any, 'scenario-1', 'a9', 'd9');

    expect(result.outcome).toBe('breached');
  });
});
