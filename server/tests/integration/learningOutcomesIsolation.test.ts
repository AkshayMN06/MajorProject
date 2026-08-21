import { describe, it, expect, beforeEach, vi } from 'vitest';

// The data-integrity requirement this rewrite fixes: two different Scenario
// Assessment sessions for the same user must produce two independently
// correct learningOutcomes (Pre/Post scores), never flattened to "whichever
// completed most recently across the whole account."
const mocks = vi.hoisted(() => ({
  quizAttempt: { findFirst: vi.fn() },
}));

import { buildLearningOutcomes } from '../../src/services/learningOutcomes';

function fakeAttempt(sessionId: string, testType: 'PRE' | 'POST', score: number, total: number, responses: any[] = []) {
  return { sessionId, testType, status: 'completed', score, totalQuestions: total, responses };
}

describe('learningOutcomes — scoped per session, not global-latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two sessions for the same user produce two different, independently-correct learningOutcomes", async () => {
    const attemptsBySessionAndType: Record<string, any> = {
      'session-1:PRE': fakeAttempt('session-1', 'PRE', 3, 8),
      'session-1:POST': fakeAttempt('session-1', 'POST', 5, 8),
      'session-2:PRE': fakeAttempt('session-2', 'PRE', 6, 8),
      'session-2:POST': fakeAttempt('session-2', 'POST', 8, 8),
    };
    mocks.quizAttempt.findFirst.mockImplementation(async ({ where }: any) => {
      return attemptsBySessionAndType[`${where.sessionId}:${where.testType}`] ?? null;
    });

    const outcomes1 = await buildLearningOutcomes(mocks as any, 'user-1', 'session-1');
    const outcomes2 = await buildLearningOutcomes(mocks as any, 'user-1', 'session-2');

    expect(outcomes1.preTestScore).toBe(Math.round((3 / 8) * 100));
    expect(outcomes1.postTestScore).toBe(Math.round((5 / 8) * 100));
    expect(outcomes2.preTestScore).toBe(Math.round((6 / 8) * 100));
    expect(outcomes2.postTestScore).toBe(Math.round((8 / 8) * 100));

    // The critical assertion: session-1's report is untouched by session-2
    // existing — no flattening to "latest attempt ever."
    expect(outcomes1.preTestScore).not.toBe(outcomes2.preTestScore);
    expect(outcomes1.postTestScore).not.toBe(outcomes2.postTestScore);
  });

  it('queries are scoped by sessionId — never a global "latest for this user" lookup', async () => {
    mocks.quizAttempt.findFirst.mockResolvedValue(null);

    await buildLearningOutcomes(mocks as any, 'user-1', 'session-1');

    for (const call of mocks.quizAttempt.findFirst.mock.calls) {
      const where = call[0].where;
      expect(where.sessionId).toBe('session-1');
      expect(where.userId).toBe('user-1');
      expect(where.status).toBe('completed');
    }
    expect(mocks.quizAttempt.findFirst).toHaveBeenCalledTimes(2); // PRE + POST
  });

  it('reports hasPreTest/hasPostTest as false, with null scores, when this session has no completed attempts yet', async () => {
    mocks.quizAttempt.findFirst.mockResolvedValue(null);

    const outcomes = await buildLearningOutcomes(mocks as any, 'user-1', 'session-3');

    expect(outcomes.hasPreTest).toBe(false);
    expect(outcomes.hasPostTest).toBe(false);
    expect(outcomes.preTestScore).toBeNull();
    expect(outcomes.postTestScore).toBeNull();
    expect(outcomes.learningGain).toBeNull();
  });
});
