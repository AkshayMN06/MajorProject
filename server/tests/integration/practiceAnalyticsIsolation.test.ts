import { describe, it, expect, beforeEach, vi } from 'vitest';

// The critical regression-protection test: Practice Labs must never touch
// any table the assessment analytics pipeline reads from. The mocked Prisma
// client below wires up delegates for BOTH the practice_* tables (including
// the v2 case_studies / practice_question_pools tables) AND every
// analytics-adjacent table (score, analytics, assessmentSnapshot, attempt,
// event, recommendation) — a full start->submit practice flow is run
// against it, then every analytics-adjacent delegate is asserted to have
// zero calls.
const mocks = vi.hoisted(() => ({
  scenario: { findMany: vi.fn() },
  caseStudy: { findMany: vi.fn() },
  practiceQuestionPool: { findMany: vi.fn() },
  practiceQuestion: { findMany: vi.fn() },
  practiceSession: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceResponse: { createMany: vi.fn() },
  // Analytics-adjacent tables — must stay untouched by Practice Labs.
  score: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  analytics: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  assessmentSnapshot: { create: vi.fn(), findMany: vi.fn() },
  attempt: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  event: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  recommendation: { create: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mocks),
}));

import { startSession, submitSession } from '../../src/services/practiceEngine';

function fakeQuestion(id: string, poolId: string, correctOption: 'A' | 'B' | 'C' | 'D' = 'A') {
  return {
    id,
    poolId,
    module: 'Web Security',
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

const ANALYTICS_ADJACENT = ['score', 'analytics', 'assessmentSnapshot', 'attempt', 'event', 'recommendation'] as const;

describe('Practice Labs analytics isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a full start -> submit practice session (case study + pool selection included) never calls any analytics-adjacent Prisma delegate', async () => {
    mocks.scenario.findMany.mockResolvedValue([{ category: 'Web Security' }]);
    mocks.caseStudy.findMany.mockResolvedValue([
      { id: 'cs1', module: 'Web Security', title: 'A Case Study', description: 'Scenario text.', isActive: true },
    ]);
    mocks.practiceSession.findFirst.mockResolvedValue(null);
    mocks.practiceQuestionPool.findMany.mockResolvedValue([{ id: 'p1', caseStudyId: 'cs1', name: 'Identification', isActive: true }]);
    const pool = Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p1'));
    mocks.practiceQuestion.findMany.mockResolvedValue(pool);
    mocks.practiceSession.create.mockResolvedValue({ id: 'session-1', module: 'Web Security' });

    const started = await startSession('user-1', 'Web Security');
    expect(started.questions).toHaveLength(8);
    expect(started.caseStudy.id).toBe('cs1');

    mocks.practiceSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      module: 'Web Security',
      caseStudyId: 'cs1',
      poolId: 'p1',
      questionIds: started.questions.map((q) => q.id),
      status: 'in_progress',
      totalQuestions: 8,
    });
    mocks.practiceResponse.createMany.mockResolvedValue({ count: 8 });
    mocks.practiceSession.update.mockResolvedValue({});

    const responses = started.questions.map((q) => ({ questionId: q.id, selectedOption: 'A' as const }));
    const result = await submitSession('session-1', 'user-1', responses);

    expect(result.totalQuestions).toBe(8);

    for (const table of ANALYTICS_ADJACENT) {
      for (const [methodName, mockFn] of Object.entries(mocks[table])) {
        expect(mockFn, `${table}.${methodName} should never be called by Practice Labs`).not.toHaveBeenCalled();
      }
    }

    // Sanity check the assertion above isn't vacuous — practice's own
    // tables (including the new case-study/pool tables) *were* used.
    expect(mocks.caseStudy.findMany).toHaveBeenCalled();
    expect(mocks.practiceQuestionPool.findMany).toHaveBeenCalled();
    expect(mocks.practiceSession.create).toHaveBeenCalled();
    expect(mocks.practiceResponse.createMany).toHaveBeenCalled();
    expect(mocks.practiceSession.update).toHaveBeenCalled();
  });
});
