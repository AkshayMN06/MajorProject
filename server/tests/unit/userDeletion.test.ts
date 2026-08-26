import { describe, it, expect, vi } from 'vitest';
import { buildUserDeletionOps } from '../../src/services/userDeletion';

// Every FK in this schema is RESTRICT, so the ONLY thing that actually
// matters here is relative ORDER: every child-row delete must be queued
// before prisma.user.delete, and every delete of a session-scoped table
// must be queued before the session itself is deleted. A mocked prisma
// can't enforce real FK constraints, so this test asserts ordering — the
// live-DB verification (documented in the PR/commit notes) is what proves
// the constraints themselves are satisfied.
function fakePrisma() {
  const calls: string[] = [];
  const stub = (name: string) => ({ deleteMany: vi.fn(() => { calls.push(`${name}.deleteMany`); return 'op'; }) });
  return {
    calls,
    prisma: {
      quizResponse: stub('quizResponse'),
      quizAttempt: stub('quizAttempt'),
      practiceResponse: stub('practiceResponse'),
      practiceSession: stub('practiceSession'),
      assessmentSnapshot: stub('assessmentSnapshot'),
      event: stub('event'),
      attempt: stub('attempt'),
      score: stub('score'),
      session: stub('session'),
      recommendation: stub('recommendation'),
      analytics: stub('analytics'),
      user: { delete: vi.fn(() => { calls.push('user.delete'); return 'op'; }) },
    } as any,
  };
}

describe('buildUserDeletionOps', () => {
  it('queues prisma.user.delete strictly last', () => {
    const { prisma, calls } = fakePrisma();
    const ops = buildUserDeletionOps(prisma, 'user-1');
    // Executing the returned ops in order (as $transaction([...]) would)
    // reproduces the call order for this assertion.
    expect(ops.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBe('user.delete');
  });

  it('deletes every session-scoped table before the session itself', () => {
    const { prisma, calls } = fakePrisma();
    buildUserDeletionOps(prisma, 'user-1');
    const sessionIdx = calls.indexOf('session.deleteMany');
    expect(sessionIdx).toBeGreaterThan(-1);
    for (const table of ['quizResponse', 'quizAttempt', 'assessmentSnapshot', 'event', 'attempt', 'score']) {
      const idx = calls.lastIndexOf(`${table}.deleteMany`);
      expect(idx, `${table}.deleteMany should run before session.deleteMany`).toBeLessThan(sessionIdx);
    }
  });

  it('deletes quizResponse before quizAttempt (response FKs to attempt)', () => {
    const { prisma, calls } = fakePrisma();
    buildUserDeletionOps(prisma, 'user-1');
    expect(calls.indexOf('quizResponse.deleteMany')).toBeLessThan(calls.lastIndexOf('quizAttempt.deleteMany'));
  });

  it('deletes practiceResponse before practiceSession (response FKs to session)', () => {
    const { prisma, calls } = fakePrisma();
    buildUserDeletionOps(prisma, 'user-1');
    expect(calls.indexOf('practiceResponse.deleteMany')).toBeLessThan(calls.indexOf('practiceSession.deleteMany'));
  });

  it("filters shared-session tables by attackerId OR defenderId, not just the target's own rows", () => {
    const { prisma } = fakePrisma();
    buildUserDeletionOps(prisma, 'user-1');
    const call = (prisma.quizAttempt.deleteMany as any).mock.calls[0][0];
    expect(call.where.session.OR).toEqual([{ attackerId: 'user-1' }, { defenderId: 'user-1' }]);
  });
});
