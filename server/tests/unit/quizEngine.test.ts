import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  question: { findMany: vi.fn() },
  quizAttempt: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  session: { findUnique: vi.fn() },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mocks),
}));

import { getOrStartAttempt, QUESTIONS_PER_ATTEMPT } from '../../src/services/quizEngine';

function fakeQuestion(id: string, moduleTag = 'Web Security', difficulty = 'Easy') {
  return {
    id,
    questionId: id,
    question: `Question ${id}`,
    optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
    correctOption: 'A',
    topic: 'topic',
    moduleTag,
    topicTag: 'tag',
    difficulty,
    explanation: 'because',
    isActive: true,
  };
}

function fakeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'session-1',
    attackerId: 'user-1',
    defenderId: 'user-2',
    module: 'Web Security',
    difficulty: 'Easy',
    ...overrides,
  };
}

describe('quizEngine.getOrStartAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quizAttempt.findFirst.mockResolvedValue(null);
  });

  it('returns the existing attempt untouched when one already exists — never re-selects or duplicates', async () => {
    const existing = { id: 'attempt-1', sessionId: 'session-1', userId: 'user-1', testType: 'PRE', status: 'in_progress', questionIds: ['q1'] };
    mocks.quizAttempt.findUnique.mockResolvedValue(existing);

    const result = await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(result).toBe(existing);
    expect(mocks.session.findUnique).not.toHaveBeenCalled();
    expect(mocks.quizAttempt.create).not.toHaveBeenCalled();
  });

  it('404s when the session does not exist', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(null);

    await expect(getOrStartAttempt('user-1', 'missing-session', 'PRE')).rejects.toMatchObject({ status: 404 });
  });

  it('403s when the user is neither the attacker nor defender of the session', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());

    await expect(getOrStartAttempt('some-other-user', 'session-1', 'PRE')).rejects.toMatchObject({ status: 403 });
  });

  it('rejects when fewer than 8 active questions exist in the resolved pool', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());
    mocks.question.findMany.mockResolvedValue(Array.from({ length: 5 }, (_, i) => fakeQuestion(`q${i}`)));

    await expect(getOrStartAttempt('user-1', 'session-1', 'PRE')).rejects.toMatchObject({ status: 400 });
  });

  it('selects exactly 8 unique questions filtered to the session\'s module and difficulty', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());
    const pool = Array.from({ length: 50 }, (_, i) => fakeQuestion(`q${i}`));
    mocks.question.findMany.mockResolvedValue(pool);
    mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-new', ...data }));

    const result = await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(result.questionIds).toHaveLength(QUESTIONS_PER_ATTEMPT);
    expect(new Set(result.questionIds).size).toBe(QUESTIONS_PER_ATTEMPT);
    expect(mocks.question.findMany).toHaveBeenCalledWith({ where: { isActive: true, moduleTag: 'Web Security', difficulty: 'Easy' } });
    expect(mocks.quizAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
          moduleTag: 'Web Security',
          difficulty: 'Easy',
          testType: 'PRE',
          totalQuestions: QUESTIONS_PER_ATTEMPT,
        }),
      })
    );
  });

  it('omits the module filter for the "All Modules" sentinel, spanning every module', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession({ module: 'All Modules' }));
    mocks.question.findMany.mockResolvedValue(Array.from({ length: 50 }, (_, i) => fakeQuestion(`q${i}`)));
    mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-new', ...data }));

    await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(mocks.question.findMany).toHaveBeenCalledWith({ where: { isActive: true, difficulty: 'Easy' } });
  });

  it('omits the difficulty filter for the "All" sentinel, spanning every difficulty', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession({ difficulty: 'All' }));
    mocks.question.findMany.mockResolvedValue(Array.from({ length: 50 }, (_, i) => fakeQuestion(`q${i}`)));
    mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-new', ...data }));

    await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(mocks.question.findMany).toHaveBeenCalledWith({ where: { isActive: true, moduleTag: 'Web Security' } });
  });

  it('avoids this session\'s own PRE questions when selecting POST, when enough candidates remain', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());
    const pool = Array.from({ length: 50 }, (_, i) => fakeQuestion(`q${i}`));
    mocks.question.findMany.mockResolvedValue(pool);
    const preQuestionIds = pool.slice(0, 8).map((q) => q.id);
    mocks.quizAttempt.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.testType === 'PRE') return { questionIds: preQuestionIds };
      return null;
    });
    // findUnique is also used to look up the own-session PRE attempt via the
    // composite unique key — mock it to return the PRE attempt for that call
    // and null for the (sessionId,userId,testType) idempotency check.
    mocks.quizAttempt.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.sessionId_userId_testType?.testType === 'PRE') return { questionIds: preQuestionIds };
      return null;
    });
    mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-new', ...data }));

    const result = await getOrStartAttempt('user-1', 'session-1', 'POST');

    for (const id of result.questionIds as string[]) {
      expect(preQuestionIds).not.toContain(id);
    }
  });

  it('avoids the user\'s most recent other-session attempt for the same module/difficulty/testType, when enough candidates remain', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());
    const pool = Array.from({ length: 50 }, (_, i) => fakeQuestion(`q${i}`));
    mocks.question.findMany.mockResolvedValue(pool);
    const lastQuestionIds = pool.slice(0, 8).map((q) => q.id);
    mocks.quizAttempt.findFirst.mockResolvedValue({ questionIds: lastQuestionIds });

    const result = await getOrStartAttempt('user-1', 'session-1', 'PRE');

    for (const id of result.questionIds as string[]) {
      expect(lastQuestionIds).not.toContain(id);
    }
  });

  it('gracefully falls back to reusing questions when excluding them would drop below 8 candidates', async () => {
    mocks.quizAttempt.findUnique.mockResolvedValue(null);
    mocks.session.findUnique.mockResolvedValue(fakeSession());
    // Exactly 8 questions in the pool — excluding the "last attempt" ids
    // would leave 0 candidates, so the exclusion must NOT be applied.
    const pool = Array.from({ length: 8 }, (_, i) => fakeQuestion(`q${i}`));
    mocks.question.findMany.mockResolvedValue(pool);
    const lastQuestionIds = pool.map((q) => q.id);
    mocks.quizAttempt.findFirst.mockResolvedValue({ questionIds: lastQuestionIds });
    mocks.quizAttempt.create.mockImplementation(async ({ data }: any) => ({ id: 'attempt-new', ...data }));

    const result = await getOrStartAttempt('user-1', 'session-1', 'PRE');

    expect(result.questionIds).toHaveLength(8);
  });
});
