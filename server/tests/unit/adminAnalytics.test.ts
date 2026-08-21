import { describe, it, expect, vi } from 'vitest';
import {
  computePairMath,
  computeOverall,
  computeModuleSummary,
  computeDifficultySummary,
  fetchCompletedPairs,
  type PairedResult,
} from '../../src/services/adminAnalytics';

function fakePair(overrides: Partial<PairedResult> = {}): PairedResult {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    userName: 'Test User',
    userEmail: 'test@example.com',
    moduleTag: 'Web Security',
    difficulty: 'Medium',
    preScore: 4,
    preTotal: 8,
    postScore: 7,
    postTotal: 8,
    postCompletedAt: new Date('2026-08-20T12:00:00Z'),
    preResponses: [],
    postResponses: [],
    ...overrides,
  };
}

describe('computePairMath', () => {
  it('computes percentage-point improvement correctly for the spec\'s own 4/8 -> 7/8 example (not a ratio)', () => {
    // NOTE: 7/8 = 87.5%, 4/8 = 50%. A wrong "87.5 / 50" implementation would
    // yield 1.75 (or 175%) here instead of the correct +37.5 percentage points.
    const math = computePairMath(fakePair({ preScore: 4, preTotal: 8, postScore: 7, postTotal: 8 }));
    expect(math.prePct).toBe(50);
    expect(math.postPct).toBe(87.5);
    expect(math.rawImprovement).toBe(3);
    expect(math.ppImprovement).toBe(37.5);
    expect(math.category).toBe('improved');
  });

  it('categorizes an unchanged score as "unchanged" with zero improvement', () => {
    const math = computePairMath(fakePair({ preScore: 5, preTotal: 8, postScore: 5, postTotal: 8 }));
    expect(math.ppImprovement).toBe(0);
    expect(math.rawImprovement).toBe(0);
    expect(math.category).toBe('unchanged');
  });

  it('categorizes a lower post-test score as "decreased" with negative improvement', () => {
    const math = computePairMath(fakePair({ preScore: 6, preTotal: 8, postScore: 3, postTotal: 8 }));
    expect(math.ppImprovement).toBe(-37.5);
    expect(math.rawImprovement).toBe(-3);
    expect(math.category).toBe('decreased');
  });

  it('handles a perfect 8/8 post-test score', () => {
    const math = computePairMath(fakePair({ preScore: 4, preTotal: 8, postScore: 8, postTotal: 8 }));
    expect(math.postPct).toBe(100);
    expect(math.ppImprovement).toBe(50);
  });
});

describe('computeOverall', () => {
  it('returns all-zero, non-NaN stats for an empty pair list', () => {
    const overall = computeOverall([]);
    expect(overall).toEqual({ pairCount: 0, avgPrePct: 0, avgPostPct: 0, avgImprovementPP: 0, improved: 0, unchanged: 0, decreased: 0 });
    for (const v of Object.values(overall)) expect(Number.isNaN(v)).toBe(false);
  });

  it('averages correctly and categorizes each pair independently', () => {
    const pairs = [
      fakePair({ preScore: 4, postScore: 7 }), // improved, +37.5pp
      fakePair({ preScore: 5, postScore: 5 }), // unchanged
      fakePair({ preScore: 6, postScore: 3 }), // decreased, -37.5pp
    ];
    const overall = computeOverall(pairs);
    expect(overall.pairCount).toBe(3);
    expect(overall.improved).toBe(1);
    expect(overall.unchanged).toBe(1);
    expect(overall.decreased).toBe(1);
    // (50 + 62.5 + 75) / 3 = 62.5
    expect(overall.avgPrePct).toBe(62.5);
  });
});

describe('computeModuleSummary / computeDifficultySummary — per-question attribution', () => {
  it('attributes a session tagged "All Modules" to each REAL module its questions actually belong to, not a fake bucket', () => {
    const pair = fakePair({
      moduleTag: 'All Modules', // the session-level snapshot sentinel
      preResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: false, moduleTag: 'Cryptography', difficulty: 'Easy' },
      ],
      postResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: true, moduleTag: 'Cryptography', difficulty: 'Easy' },
      ],
    });
    const summary = computeModuleSummary([pair]);
    const categories = summary.map((s) => s.category);
    expect(categories).toContain('Web Security');
    expect(categories).toContain('Cryptography');
    expect(categories).not.toContain('All Modules');

    const webSecurity = summary.find((s) => s.category === 'Web Security')!;
    expect(webSecurity.avgPrePct).toBe(100); // 1/1 correct
    expect(webSecurity.avgPostPct).toBe(100);
    const crypto = summary.find((s) => s.category === 'Cryptography')!;
    expect(crypto.avgPrePct).toBe(0); // 0/1 correct
    expect(crypto.avgPostPct).toBe(100); // 1/1 correct -> improved
    expect(crypto.avgImprovementPP).toBe(100);
  });

  it('counts distinct pairs contributing to a module, not raw question count', () => {
    const pairA = fakePair({
      sessionId: 's1',
      userId: 'u1',
      preResponses: [{ isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' }],
      postResponses: [{ isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' }],
    });
    const pairB = fakePair({
      sessionId: 's2',
      userId: 'u2',
      preResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
      ],
      postResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
      ],
    });
    const summary = computeModuleSummary([pairA, pairB]);
    expect(summary.find((s) => s.category === 'Web Security')!.attempts).toBe(2);
  });

  it('difficulty summary attributes per-question difficulty independently of the module', () => {
    const pair = fakePair({
      difficulty: 'All',
      preResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: false, moduleTag: 'Web Security', difficulty: 'Hard' },
      ],
      postResponses: [
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' },
        { isCorrect: true, moduleTag: 'Web Security', difficulty: 'Hard' },
      ],
    });
    const summary = computeDifficultySummary([pair]);
    expect(summary.map((s) => s.category)).not.toContain('All');
    expect(summary.find((s) => s.category === 'Hard')!.avgImprovementPP).toBe(100);
  });

  it('excludes a category with no responses on one side (avoids a NaN/division-by-zero row)', () => {
    const pair = fakePair({
      preResponses: [{ isCorrect: true, moduleTag: 'Web Security', difficulty: 'Easy' }],
      postResponses: [], // no post responses at all for this module
    });
    const summary = computeModuleSummary([pair]);
    expect(summary.find((s) => s.category === 'Web Security')).toBeUndefined();
  });
});

describe('fetchCompletedPairs', () => {
  function fakeAttempt(overrides: Record<string, unknown> = {}) {
    return {
      userId: 'user-1',
      sessionId: 'session-1',
      moduleTag: 'Web Security',
      difficulty: 'Easy',
      testType: 'PRE',
      score: 4,
      totalQuestions: 8,
      completedAt: new Date('2026-08-20T12:00:00Z'),
      user: { name: 'Test User', email: 'test@example.com' },
      responses: [],
      ...overrides,
    };
  }

  it('pairs a completed PRE and POST for the same (sessionId, userId) into one result', async () => {
    const prisma = {
      quizAttempt: {
        findMany: vi.fn().mockResolvedValue([
          fakeAttempt({ testType: 'PRE', score: 4 }),
          fakeAttempt({ testType: 'POST', score: 7 }),
        ]),
      },
    };
    const pairs = await fetchCompletedPairs(prisma as any);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].preScore).toBe(4);
    expect(pairs[0].postScore).toBe(7);
  });

  it('produces two independent pairs when both attacker and defender complete Pre+Post in the same session', async () => {
    const prisma = {
      quizAttempt: {
        findMany: vi.fn().mockResolvedValue([
          fakeAttempt({ userId: 'attacker-1', testType: 'PRE', score: 3 }),
          fakeAttempt({ userId: 'attacker-1', testType: 'POST', score: 6 }),
          fakeAttempt({ userId: 'defender-1', testType: 'PRE', score: 5 }),
          fakeAttempt({ userId: 'defender-1', testType: 'POST', score: 8 }),
        ]),
      },
    };
    const pairs = await fetchCompletedPairs(prisma as any);
    expect(pairs).toHaveLength(2);
    expect(new Set(pairs.map((p) => p.userId))).toEqual(new Set(['attacker-1', 'defender-1']));
  });

  it('excludes an incomplete cycle — only a PRE exists, no POST', async () => {
    const prisma = {
      quizAttempt: { findMany: vi.fn().mockResolvedValue([fakeAttempt({ testType: 'PRE' })]) },
    };
    const pairs = await fetchCompletedPairs(prisma as any);
    expect(pairs).toHaveLength(0);
  });

  it('excludes a pair where score is null (should never happen for status:completed, but guarded anyway)', async () => {
    const prisma = {
      quizAttempt: {
        findMany: vi.fn().mockResolvedValue([
          fakeAttempt({ testType: 'PRE', score: null }),
          fakeAttempt({ testType: 'POST', score: 7 }),
        ]),
      },
    };
    const pairs = await fetchCompletedPairs(prisma as any);
    expect(pairs).toHaveLength(0);
  });

  it('excludes a pair with totalQuestions of 0 to avoid a division-by-zero percentage', async () => {
    const prisma = {
      quizAttempt: {
        findMany: vi.fn().mockResolvedValue([
          fakeAttempt({ testType: 'PRE', totalQuestions: 0 }),
          fakeAttempt({ testType: 'POST' }),
        ]),
      },
    };
    const pairs = await fetchCompletedPairs(prisma as any);
    expect(pairs).toHaveLength(0);
  });

  it('passes module/difficulty filters through to the prisma query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { quizAttempt: { findMany } };
    await fetchCompletedPairs(prisma as any, { module: 'Cryptography', difficulty: 'Hard' });
    const whereArg = findMany.mock.calls[0][0].where;
    expect(whereArg.moduleTag).toBe('Cryptography');
    expect(whereArg.difficulty).toBe('Hard');
    expect(whereArg.sessionId).toEqual({ not: null });
  });

  it('excludes pairs outside a startDate/endDate window based on the post completedAt, with an inclusive end date', async () => {
    const prisma = {
      quizAttempt: {
        findMany: vi.fn().mockResolvedValue([
          fakeAttempt({ testType: 'PRE' }),
          fakeAttempt({ testType: 'POST', completedAt: new Date('2026-08-20T23:59:00Z') }),
        ]),
      },
    };
    const withinRange = await fetchCompletedPairs(prisma as any, {
      startDate: new Date('2026-08-20T00:00:00Z'),
      endDate: new Date('2026-08-20T00:00:00Z'), // same calendar day — must still include the 23:59 completion
    });
    expect(withinRange).toHaveLength(1);

    const outsideRange = await fetchCompletedPairs(prisma as any, {
      startDate: new Date('2026-08-21T00:00:00Z'),
      endDate: new Date('2026-08-25T00:00:00Z'),
    });
    expect(outsideRange).toHaveLength(0);
  });
});
