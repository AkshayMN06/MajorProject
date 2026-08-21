import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getOrStartAttempt, getAttemptQuestions } from '../services/quizEngine';
import {
  quizQuestionsQuerySchema,
  quizStartSchema,
  quizSubmitSchema,
  quizResultParamsSchema,
} from '../validation/quizSchemas';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

function handleError(res: Response, err: any) {
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ success: false, error: err.message });
}

// GET /api/quiz/questions?testType=PRE&sessionId=xxx
// Never includes correctOption or explanation — those are only revealed
// after a submitted attempt, via GET /result/:attemptId. Reports the
// existing attempt for this (session, user, testType) at any status — not
// just completed — so the frontend can resume an in-progress attempt
// (refresh-safe) as well as gate on a completed one. When no attempt
// exists yet, `existingAttempt` is null and `questions` is empty; the
// frontend then calls POST /start to create one.
router.get('/questions', validate(quizQuestionsQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const testType = String(req.query.testType) as 'PRE' | 'POST';
    const sessionId = String(req.query.sessionId);

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.attackerId !== req.user.id && session.defenderId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You are not a participant in this session' });
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { sessionId_userId_testType: { sessionId, userId: req.user.id, testType } },
    });

    const questions = attempt ? await getAttemptQuestions(attempt) : [];

    res.json({
      success: true,
      data: {
        testType,
        moduleTag: session.module,
        difficulty: session.difficulty,
        existingAttempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              score: attempt.score,
              totalQuestions: attempt.totalQuestions,
              completedAt: attempt.completedAt,
            }
          : null,
        questions: questions.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          topic: q.topic,
          moduleTag: q.moduleTag,
          topicTag: q.topicTag,
          difficulty: q.difficulty,
        })),
      },
    });
  } catch (err: any) {
    handleError(res, err);
  }
});

// POST /api/quiz/start
// Idempotent — delegates to getOrStartAttempt, which returns the existing
// attempt untouched if one already exists for this (session, user,
// testType) rather than re-selecting or duplicating.
router.post('/start', validate(quizStartSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { testType, sessionId } = req.body as { testType: 'PRE' | 'POST'; sessionId: string };

    const attempt = await getOrStartAttempt(req.user.id, sessionId, testType);
    const questions = await getAttemptQuestions(attempt);

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt.id,
        testType,
        moduleTag: attempt.moduleTag,
        difficulty: attempt.difficulty,
        totalQuestions: attempt.totalQuestions,
        status: attempt.status,
        questions: questions.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          topic: q.topic,
          moduleTag: q.moduleTag,
          topicTag: q.topicTag,
          difficulty: q.difficulty,
        })),
      },
    });
  } catch (err: any) {
    handleError(res, err);
  }
});

// POST /api/quiz/submit
// The server computes the score from each question's stored correctOption
// — the client only ever sends which option the learner selected, never a
// score or correctness flag. This is the sole place scoring happens.
router.post('/submit', validate(quizSubmitSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId, responses } = req.body;

    const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });
    if (attempt.status === 'completed') {
      return res.status(400).json({ success: false, error: 'This attempt was already submitted' });
    }

    const questionIds = responses.map((r: { questionId: string }) => r.questionId);
    const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
    const questionById = new Map(questions.map((q) => [q.id, q]));

    let score = 0;
    const responseRows = [];
    for (const r of responses as { questionId: string; selectedOption: string }[]) {
      const question = questionById.get(r.questionId);
      if (!question) continue; // ignore unknown/stale question ids rather than failing the whole submission
      const isCorrect = question.correctOption === r.selectedOption;
      if (isCorrect) score++;
      responseRows.push({
        attemptId,
        questionId: r.questionId,
        selectedOption: r.selectedOption,
        isCorrect,
      });
    }

    await prisma.quizResponse.createMany({ data: responseRows });
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { status: 'completed', score, completedAt: new Date() },
    });

    res.json({ success: true, data: { attemptId, score, totalQuestions: attempt.totalQuestions } });
  } catch (err: any) {
    handleError(res, err);
  }
});

// GET /api/quiz/result/:attemptId
// Full per-question review, including correctOption and explanation — safe
// to reveal now because the attempt is already submitted and scored.
router.get('/result/:attemptId', validate(quizResultParamsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: String(req.params.attemptId) },
      include: { responses: { include: { question: true } } },
    });
    if (!attempt) return res.status(404).json({ success: false, error: 'Attempt not found' });
    if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });
    if (attempt.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'This attempt has not been submitted yet' });
    }

    res.json({
      success: true,
      data: {
        attemptId: attempt.id,
        testType: attempt.testType,
        moduleTag: attempt.moduleTag,
        difficulty: attempt.difficulty,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        completedAt: attempt.completedAt,
        responses: attempt.responses.map((r) => ({
          questionId: r.questionId,
          question: r.question.question,
          optionA: r.question.optionA,
          optionB: r.question.optionB,
          optionC: r.question.optionC,
          optionD: r.question.optionD,
          selectedOption: r.selectedOption,
          correctOption: r.question.correctOption,
          isCorrect: r.isCorrect,
          explanation: r.question.explanation,
          topic: r.question.topic,
          moduleTag: r.question.moduleTag,
        })),
      },
    });
  } catch (err: any) {
    handleError(res, err);
  }
});

export default router;
