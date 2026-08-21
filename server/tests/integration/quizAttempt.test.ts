import { describe, it, expect, beforeEach, vi } from 'vitest';

// This is the core regression-protection suite for the Pre-Test/Post-Test
// rewrite: every Scenario Assessment attempt (= Session) must get its own
// independent Pre-test and Post-test, never gated by "has this user ever
// completed one." A lightweight in-memory fake backs the quizAttempt table
// so multi-call, multi-session sequences can be exercised realistically —
// including the DB-level @@unique([sessionId, userId, testType]) constraint
// that is simultaneously the idempotency guarantee and the mechanism that
// gives every session its own attempt pair.
let attempts: any[] = [];
let attemptIdCounter = 0;

const mocks = vi.hoisted(() => ({
  question: { findMany: vi.fn() },
  quizAttempt: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  session: { findUnique: vi.fn() },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mocks),
}));

import { getOrStartAttempt } from '../../src/services/quizEngine';

function fakeQuestionPool(count: number, moduleTag: string, difficulty: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${moduleTag}-${difficulty}-q${i}`,
    questionId: `${moduleTag}-${difficulty}-q${i}`,
    question: `Question ${i}`,
    optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
    correctOption: 'A',
    topic: 'topic',
    moduleTag,
    topicTag: 'tag',
    difficulty,
    explanation: 'because',
    isActive: true,
  }));
}

const SESSIONS: Record<string, any> = {
  'session-1': { id: 'session-1', attackerId: 'user-1', defenderId: 'user-2', module: 'Web Security', difficulty: 'Easy' },
  'session-2': { id: 'session-2', attackerId: 'user-1', defenderId: 'user-3', module: 'Web Security', difficulty: 'Easy' },
  'session-3': { id: 'session-3', attackerId: 'user-1', defenderId: 'user-4', module: 'Web Security', difficulty: 'Easy' },
};

function setup() {
  attempts = [];
  attemptIdCounter = 0;
  vi.clearAllMocks();

  mocks.session.findUnique.mockImplementation(async ({ where }: any) => SESSIONS[where.id] ?? null);

  mocks.question.findMany.mockImplementation(async ({ where }: any) => {
    const pool = fakeQuestionPool(50, where.moduleTag ?? 'Web Security', where.difficulty ?? 'Easy');
    return pool;
  });

  mocks.quizAttempt.findUnique.mockImplementation(async ({ where }: any) => {
    const key = where.sessionId_userId_testType;
    if (!key) return null;
    return attempts.find((a) => a.sessionId === key.sessionId && a.userId === key.userId && a.testType === key.testType) ?? null;
  });

  mocks.quizAttempt.findFirst.mockImplementation(async ({ where }: any) => {
    let candidates = attempts.filter((a) => a.userId === where.userId && a.testType === where.testType);
    if ('moduleTag' in where) candidates = candidates.filter((a) => a.moduleTag === where.moduleTag);
    if ('difficulty' in where) candidates = candidates.filter((a) => a.difficulty === where.difficulty);
    if (where.sessionId?.not) candidates = candidates.filter((a) => a.sessionId !== where.sessionId.not);
    candidates.sort((a, b) => b.startedAt - a.startedAt);
    return candidates[0] ?? null;
  });

  mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => {
    const dup = attempts.find((a) => a.sessionId === data.sessionId && a.userId === data.userId && a.testType === data.testType);
    if (dup) {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    }
    const row = { id: `attempt-${++attemptIdCounter}`, status: 'in_progress', score: null, completedAt: null, startedAt: Date.now(), ...data };
    attempts.push(row);
    return row;
  });
}

describe('Quiz attempt lifecycle — per-session, never account-level', () => {
  beforeEach(setup);

  it('an existing user with a previously-completed PRE/POST elsewhere gets a NEW Pre-test on a new session, not skipped', async () => {
    // Simulate the user already having a completed PRE+POST on session-1.
    await getOrStartAttempt('user-1', 'session-1', 'PRE');
    await getOrStartAttempt('user-1', 'session-1', 'POST');
    for (const a of attempts) {
      a.status = 'completed';
      a.score = 6;
      a.completedAt = new Date();
    }

    // A brand-new session for the same user must NOT see an existing attempt.
    const newPre = await getOrStartAttempt('user-1', 'session-2', 'PRE');
    expect(newPre.status).toBe('in_progress');
    expect(newPre.score).toBeNull();
    expect(newPre.sessionId).toBe('session-2');
  });

  it('three sequential sessions for the same user produce three independent, non-overwritten attempt pairs', async () => {
    for (const sessionId of ['session-1', 'session-2', 'session-3']) {
      const pre = await getOrStartAttempt('user-1', sessionId, 'PRE');
      const post = await getOrStartAttempt('user-1', sessionId, 'POST');
      expect(pre.sessionId).toBe(sessionId);
      expect(post.sessionId).toBe(sessionId);
    }

    const preAttempts = attempts.filter((a) => a.testType === 'PRE');
    const postAttempts = attempts.filter((a) => a.testType === 'POST');
    expect(preAttempts).toHaveLength(3);
    expect(postAttempts).toHaveLength(3);
    // Every attempt has a distinct id and is linked to its own session.
    expect(new Set(attempts.map((a) => a.id)).size).toBe(6);
    expect(new Set(attempts.map((a) => a.sessionId))).toEqual(new Set(['session-1', 'session-2', 'session-3']));
  });

  it("attempt #1's scores remain intact and distinct after attempt #2 is created and scored", async () => {
    const pre1 = await getOrStartAttempt('user-1', 'session-1', 'PRE');
    pre1.status = 'completed';
    pre1.score = 3;

    const pre2 = await getOrStartAttempt('user-1', 'session-2', 'PRE');
    pre2.status = 'completed';
    pre2.score = 7;

    // Re-fetching attempt #1 by its own key must still show its own score.
    const refetched1 = await mocks.quizAttempt.findUnique({ where: { sessionId_userId_testType: { sessionId: 'session-1', userId: 'user-1', testType: 'PRE' } } });
    expect(refetched1.score).toBe(3);
    const refetched2 = await mocks.quizAttempt.findUnique({ where: { sessionId_userId_testType: { sessionId: 'session-2', userId: 'user-1', testType: 'PRE' } } });
    expect(refetched2.score).toBe(7);
  });

  it('refreshing mid-attempt (calling getOrStartAttempt again for the same session/testType) resumes the same row rather than duplicating', async () => {
    const first = await getOrStartAttempt('user-1', 'session-1', 'PRE');
    const second = await getOrStartAttempt('user-1', 'session-1', 'PRE');
    const third = await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(attempts.filter((a) => a.sessionId === 'session-1' && a.testType === 'PRE')).toHaveLength(1);
    expect(mocks.quizAttempt.create).toHaveBeenCalledTimes(1);
  });

  it('refreshing mid-Post-test also resumes rather than duplicating, independently of the Pre-test row', async () => {
    await getOrStartAttempt('user-1', 'session-1', 'PRE');
    const post1 = await getOrStartAttempt('user-1', 'session-1', 'POST');
    const post2 = await getOrStartAttempt('user-1', 'session-1', 'POST');

    expect(post2.id).toBe(post1.id);
    expect(attempts.filter((a) => a.sessionId === 'session-1' && a.testType === 'POST')).toHaveLength(1);
    expect(attempts.filter((a) => a.sessionId === 'session-1')).toHaveLength(2); // PRE + POST, distinct rows
  });

  it('a new user (no prior attempts anywhere) gets Pre-test and Post-test attempts exactly like a returning user', async () => {
    // user-2 is session-1's defender and has no prior attempts anywhere —
    // stands in for a first-time user in this session's context.
    const pre = await getOrStartAttempt('user-2', 'session-1', 'PRE');
    expect(pre.status).toBe('in_progress');
    expect(pre.questionIds).toHaveLength(8);
  });
});
