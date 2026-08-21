import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scenario: { findMany: vi.fn() },
  caseStudy: { findMany: vi.fn() },
  practiceQuestionPool: { findMany: vi.fn() },
  practiceQuestion: { count: vi.fn(), findMany: vi.fn() },
  practiceSession: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceResponse: { createMany: vi.fn() },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mocks),
}));

import { sampleQuestions, getModules, startSession, submitSession, QUESTIONS_PER_SESSION } from '../../src/services/practiceEngine';

const LIVE_CATEGORIES = [
  { category: 'Web Security' },
  { category: 'Network Security' },
  { category: 'System Security' },
  { category: 'Social Engineering' },
  { category: 'Cryptography' },
];

function fakeCaseStudy(id: string, module = 'Web Security') {
  return { id, module, title: `Case Study ${id}`, description: `Description for ${id}`, isActive: true };
}

function fakePool(id: string, caseStudyId: string, name = 'Identification') {
  return { id, caseStudyId, name, isActive: true };
}

function fakeQuestion(id: string, poolId: string, module = 'Web Security', correctOption: 'A' | 'B' | 'C' | 'D' = 'A') {
  return {
    id,
    poolId,
    module,
    question: `Question ${id}`,
    optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
    correctOption,
    explanation: `Explanation for ${id}`,
    topicTag: 'Some Topic',
    concept: 'both',
    difficulty: 'Easy',
    isActive: true,
  };
}

describe('practiceEngine.sampleQuestions', () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({ id: `q${i + 1}` }));

  it('returns exactly n items when the pool is larger than n', () => {
    const result = sampleQuestions(pool, 8);
    expect(result).toHaveLength(8);
  });

  it('returns items that are all unique (sampling without replacement)', () => {
    const result = sampleQuestions(pool, 8);
    const ids = result.map((q) => q.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('returns items that are all drawn from the original pool', () => {
    const result = sampleQuestions(pool, 8);
    const poolIds = new Set(pool.map((q) => q.id));
    for (const q of result) {
      expect(poolIds.has(q.id)).toBe(true);
    }
  });

  it('does not mutate the original pool array', () => {
    const before = pool.map((q) => q.id);
    sampleQuestions(pool, 8);
    expect(pool.map((q) => q.id)).toEqual(before);
  });

  it('returns the full pool, still shuffled, when n equals pool length', () => {
    const result = sampleQuestions(pool, pool.length);
    expect(result).toHaveLength(pool.length);
    expect(new Set(result.map((q) => q.id)).size).toBe(pool.length);
  });

  // A genuine property test, not a flaky "two runs must differ" comparison:
  // across many independent samples, the results should NOT all be
  // identical — if they were, the shuffle would be broken.
  it('produces varying selections/orderings across many independent calls', () => {
    const runs = Array.from({ length: 30 }, () => sampleQuestions(pool, 8).map((q) => q.id).join(','));
    const distinctRuns = new Set(runs);
    expect(distinctRuns.size).toBeGreaterThan(1);
  });
});

describe('practiceEngine — module, case-study, and session validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scenario.findMany.mockResolvedValue(LIVE_CATEGORIES);
  });

  describe('getModules', () => {
    it('returns exactly the live Scenario categories, no attacker/defender entries', async () => {
      mocks.practiceQuestion.count.mockResolvedValue(288);

      const result = await getModules();

      expect(result.map((m) => m.module).sort()).toEqual(LIVE_CATEGORIES.map((c) => c.category).sort());
      for (const m of result) {
        expect(m.questionsPerSession).toBe(QUESTIONS_PER_SESSION);
        expect(m.questionsPerSession).toBe(8);
        expect(m.questionCount).toBe(288);
        expect(m.difficulty).toBe('Beginner');
      }
    });
  });

  describe('startSession', () => {
    it('rejects a module that is not a live Scenario Assessment category', async () => {
      await expect(startSession('user-1', 'Not A Real Module')).rejects.toThrow('Unknown module');
    });

    it('rejects when no case studies exist for the module', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([]);
      await expect(startSession('user-1', 'Web Security')).rejects.toThrow('No case studies available');
    });

    it('rejects when no question pools exist for the chosen case study', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([fakeCaseStudy('cs1')]);
      mocks.practiceSession.findFirst.mockResolvedValue(null);
      mocks.practiceQuestionPool.findMany.mockResolvedValue([]);
      await expect(startSession('user-1', 'Web Security')).rejects.toThrow('No question pools available');
    });

    it('rejects when fewer than 8 active questions exist in the chosen pool', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([fakeCaseStudy('cs1')]);
      mocks.practiceSession.findFirst.mockResolvedValue(null);
      mocks.practiceQuestionPool.findMany.mockResolvedValue([fakePool('p1', 'cs1')]);
      mocks.practiceQuestion.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => fakeQuestion(`q${i}`, 'p1'))
      );

      await expect(startSession('user-1', 'Web Security')).rejects.toThrow('Not enough active practice questions');
    });

    it('returns exactly 8 questions, all unique, all from the same pool, with correctOption/explanation withheld', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([fakeCaseStudy('cs1')]);
      mocks.practiceSession.findFirst.mockResolvedValue(null);
      mocks.practiceQuestionPool.findMany.mockResolvedValue([fakePool('p1', 'cs1')]);
      const pool = Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p1'));
      mocks.practiceQuestion.findMany.mockResolvedValue(pool);
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-1', module: 'Web Security' });

      const result = await startSession('user-1', 'Web Security');

      expect(result.questions).toHaveLength(8);
      expect(new Set(result.questions.map((q) => q.id)).size).toBe(8);
      const poolIds = new Set(pool.map((q) => q.id));
      for (const q of result.questions) {
        expect(poolIds.has(q.id)).toBe(true);
        expect(q).not.toHaveProperty('correctOption');
        expect(q).not.toHaveProperty('explanation');
      }
      expect(result.caseStudy).toEqual({ id: 'cs1', title: 'Case Study cs1', description: 'Description for cs1' });
      expect(mocks.practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            module: 'Web Security',
            caseStudyId: 'cs1',
            poolId: 'p1',
            totalQuestions: 8,
          }),
        })
      );
    });

    it('never re-selects the same case study as the learner\'s last session when an alternative exists', async () => {
      const caseStudies = [fakeCaseStudy('cs1'), fakeCaseStudy('cs2'), fakeCaseStudy('cs3')];
      mocks.caseStudy.findMany.mockResolvedValue(caseStudies);
      mocks.practiceSession.findFirst.mockResolvedValue({ caseStudyId: 'cs1', poolId: 'p1' });
      mocks.practiceQuestionPool.findMany.mockResolvedValue([fakePool('p2', 'cs2')]);
      mocks.practiceQuestion.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p2')));
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-2', module: 'Web Security' });

      // Run many times — since the code deterministically filters out the
      // last case study whenever an alternative exists, cs1 must never
      // reappear, regardless of the random pick among the remaining ones.
      for (let i = 0; i < 20; i++) {
        const result = await startSession('user-1', 'Web Security');
        expect(result.caseStudy.id).not.toBe('cs1');
      }
    });

    it('reuses the same case study when it is the only one available, but avoids the last pool when an alternative exists', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([fakeCaseStudy('cs1')]);
      mocks.practiceSession.findFirst.mockResolvedValue({ caseStudyId: 'cs1', poolId: 'p1' });
      mocks.practiceQuestionPool.findMany.mockResolvedValue([fakePool('p1', 'cs1'), fakePool('p2', 'cs1')]);
      mocks.practiceQuestion.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p2')));
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-2', module: 'Web Security' });

      for (let i = 0; i < 20; i++) {
        const result = await startSession('user-1', 'Web Security');
        expect(result.caseStudy.id).toBe('cs1');
        expect(mocks.practiceQuestion.findMany).toHaveBeenLastCalledWith({ where: { poolId: 'p2', isActive: true } });
      }
    });

    it('falls back to repeating the case study and pool when no alternative exists at all', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([fakeCaseStudy('cs1')]);
      mocks.practiceSession.findFirst.mockResolvedValue({ caseStudyId: 'cs1', poolId: 'p1' });
      mocks.practiceQuestionPool.findMany.mockResolvedValue([fakePool('p1', 'cs1')]);
      mocks.practiceQuestion.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p1')));
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-2', module: 'Web Security' });

      const result = await startSession('user-1', 'Web Security');
      expect(result.caseStudy.id).toBe('cs1');
    });
  });

  describe('submitSession', () => {
    const sessionQuestionIds = Array.from({ length: 8 }, (_, i) => `q${i}`);
    const sessionQuestions = sessionQuestionIds.map((id, i) => fakeQuestion(id, 'p1', 'Web Security', i === 0 ? 'A' : 'B'));

    function mockSessionRow(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'session-1',
        userId: 'user-1',
        module: 'Web Security',
        caseStudyId: 'cs1',
        poolId: 'p1',
        questionIds: sessionQuestionIds,
        status: 'in_progress',
        totalQuestions: 8,
        ...overrides,
      };
    }

    it('404s when the session does not exist', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(null);
      await expect(submitSession('missing', 'user-1', [])).rejects.toMatchObject({ status: 404 });
    });

    it('403s when the session belongs to a different user', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow({ userId: 'someone-else' }));
      await expect(submitSession('session-1', 'user-1', [])).rejects.toMatchObject({ status: 403 });
    });

    it('rejects resubmitting an already-completed session', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow({ status: 'completed' }));
      await expect(submitSession('session-1', 'user-1', [])).rejects.toMatchObject({ status: 400 });
    });

    it('ignores question ids that do not belong to the session, and scores correctly', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow());
      mocks.practiceQuestion.findMany.mockResolvedValue(sessionQuestions);
      mocks.practiceResponse.createMany.mockResolvedValue({ count: 1 });
      mocks.practiceSession.update.mockResolvedValue({});

      const result = await submitSession('session-1', 'user-1', [
        { questionId: 'q0', selectedOption: 'A' }, // correct
        { questionId: 'not-in-this-session', selectedOption: 'A' }, // must be ignored
      ]);

      expect(result.score).toBe(1);
      expect(result.totalQuestions).toBe(8);
      expect(mocks.practiceResponse.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: 'session-1', questionId: 'q0', selectedOption: 'A', isCorrect: true }],
      });
      expect(mocks.practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' }, data: expect.objectContaining({ status: 'completed', score: 1 }) })
      );
    });

    it('deduplicates a question answered twice (last write wins), never double-counting', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow());
      mocks.practiceQuestion.findMany.mockResolvedValue(sessionQuestions);
      mocks.practiceResponse.createMany.mockResolvedValue({ count: 1 });
      mocks.practiceSession.update.mockResolvedValue({});

      const result = await submitSession('session-1', 'user-1', [
        { questionId: 'q0', selectedOption: 'B' }, // wrong first
        { questionId: 'q0', selectedOption: 'A' }, // correct, should win
      ]);

      expect(result.score).toBe(1);
      expect(mocks.practiceResponse.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: 'session-1', questionId: 'q0', selectedOption: 'A', isCorrect: true }],
      });
    });
  });
});
