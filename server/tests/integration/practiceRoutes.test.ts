import { describe, it, expect, beforeEach, vi } from 'vitest';

// These tests exercise practiceEngine's exported functions directly (the
// same functions practice.routes.ts calls), asserting the exact response
// contract the frontend depends on: startSession's response shape
// (including the new `caseStudy` field), and submitSession's
// ownership/resubmit/stray-id error behavior.
const mocks = vi.hoisted(() => ({
  scenario: { findMany: vi.fn() },
  caseStudy: { findMany: vi.fn() },
  practiceQuestionPool: { findMany: vi.fn() },
  practiceQuestion: { findMany: vi.fn() },
  practiceSession: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  practiceResponse: { createMany: vi.fn() },
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

describe('practice session response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scenario.findMany.mockResolvedValue([{ category: 'Web Security' }]);
  });

  describe('POST /api/practice/:module/session (startSession)', () => {
    it('rejects an unknown module with a 400-style error', async () => {
      await expect(startSession('user-1', 'Not A Real Module')).rejects.toMatchObject({ status: 400 });
    });

    it("response includes sessionId, module, caseStudy {id,title,description}, totalQuestions, and 8 questions", async () => {
      mocks.caseStudy.findMany.mockResolvedValue([{ id: 'cs1', module: 'Web Security', title: 'A Case Study', description: 'Scenario text.', isActive: true }]);
      mocks.practiceSession.findFirst.mockResolvedValue(null);
      mocks.practiceQuestionPool.findMany.mockResolvedValue([{ id: 'p1', caseStudyId: 'cs1', name: 'Identification', isActive: true }]);
      mocks.practiceQuestion.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p1')));
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-1', module: 'Web Security' });

      const result = await startSession('user-1', 'Web Security');

      expect(result).toMatchObject({
        sessionId: 'session-1',
        module: 'Web Security',
        caseStudy: { id: 'cs1', title: 'A Case Study', description: 'Scenario text.' },
        totalQuestions: 8,
      });
      expect(result.questions).toHaveLength(8);
    });

    it('never leaks correctOption or explanation on any returned question', async () => {
      mocks.caseStudy.findMany.mockResolvedValue([{ id: 'cs1', module: 'Web Security', title: 'A Case Study', description: 'Scenario text.', isActive: true }]);
      mocks.practiceSession.findFirst.mockResolvedValue(null);
      mocks.practiceQuestionPool.findMany.mockResolvedValue([{ id: 'p1', caseStudyId: 'cs1', name: 'Identification', isActive: true }]);
      mocks.practiceQuestion.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => fakeQuestion(`q${i}`, 'p1')));
      mocks.practiceSession.create.mockResolvedValue({ id: 'session-1', module: 'Web Security' });

      const result = await startSession('user-1', 'Web Security');

      for (const q of result.questions) {
        expect(Object.keys(q).sort()).toEqual(['difficulty', 'id', 'optionA', 'optionB', 'optionC', 'optionD', 'question', 'topicTag'].sort());
      }
    });
  });

  describe('POST /api/practice/session/:sessionId/submit (submitSession)', () => {
    const sessionQuestionIds = Array.from({ length: 8 }, (_, i) => `q${i}`);
    const sessionQuestions = sessionQuestionIds.map((id, i) => fakeQuestion(id, 'p1', i === 0 ? 'A' : 'B'));

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

    it('returns a 404-style error when the session does not exist', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(null);
      await expect(submitSession('missing', 'user-1', [])).rejects.toMatchObject({ status: 404 });
    });

    it("returns a 403-style error when the session belongs to a different user (ownership check)", async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow({ userId: 'someone-else' }));
      await expect(submitSession('session-1', 'user-1', [])).rejects.toMatchObject({ status: 403 });
    });

    it('returns a 400-style error when resubmitting an already-completed session', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow({ status: 'completed' }));
      await expect(submitSession('session-1', 'user-1', [])).rejects.toMatchObject({ status: 400 });
    });

    it('silently drops a stray question id that does not belong to this session, without failing the whole submit', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow());
      mocks.practiceQuestion.findMany.mockResolvedValue(sessionQuestions);
      mocks.practiceResponse.createMany.mockResolvedValue({ count: 1 });
      mocks.practiceSession.update.mockResolvedValue({});

      const result = await submitSession('session-1', 'user-1', [
        { questionId: 'q0', selectedOption: 'A' },
        { questionId: 'stray-question-from-another-session', selectedOption: 'A' },
      ]);

      expect(result.score).toBe(1);
      expect(mocks.practiceResponse.createMany).toHaveBeenCalledWith({
        data: [{ sessionId: 'session-1', questionId: 'q0', selectedOption: 'A', isCorrect: true }],
      });
    });

    it('response includes full review data (question text, options, selected/correct option, explanation) for every session question', async () => {
      mocks.practiceSession.findUnique.mockResolvedValue(mockSessionRow());
      mocks.practiceQuestion.findMany.mockResolvedValue(sessionQuestions);
      mocks.practiceResponse.createMany.mockResolvedValue({ count: 8 });
      mocks.practiceSession.update.mockResolvedValue({});

      const responses = sessionQuestionIds.map((id) => ({ questionId: id, selectedOption: 'A' as const }));
      const result = await submitSession('session-1', 'user-1', responses);

      expect(result.responses).toHaveLength(8);
      for (const r of result.responses) {
        expect(r).toMatchObject({
          questionId: expect.any(String),
          question: expect.any(String),
          optionA: expect.any(String),
          optionB: expect.any(String),
          optionC: expect.any(String),
          optionD: expect.any(String),
          correctOption: expect.any(String),
          isCorrect: expect.any(Boolean),
          explanation: expect.any(String),
        });
      }
    });
  });
});
