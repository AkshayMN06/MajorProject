import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  quizQuestionsQuerySchema,
  quizStartSchema,
  quizSubmitSchema,
  quizResultParamsSchema,
} from '../validation/quizSchemas';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// Pre-test uses form A, post-test uses form B — different questions
// covering the same modules, so the post-test isn't just a memorized
// repeat of the pre-test.
const TEST_FORM: Record<string, string> = { PRE: 'PRE_A', POST: 'POST_B' };

// GET /api/quiz/questions?testType=PRE
// Never includes correctOption or explanation — those are only revealed
// after a submitted attempt, via GET /result/:attemptId. Also reports
// whether this user already has a completed attempt of this testType, so
// the frontend can gate (pre-test before Scenario Assessment, post-test
// before the Assessment Report) without a separate status endpoint.
router.get('/questions', validate(quizQuestionsQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const testType = String(req.query.testType);
    const testForm = TEST_FORM[testType];

    const questions = await prisma.question.findMany({
      where: { testForm, isActive: true },
      select: {
        id: true,
        questionId: true,
        question: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        topic: true,
        moduleTag: true,
        topicTag: true,
        difficulty: true,
      },
    });

    const completedAttempt = await prisma.quizAttempt.findFirst({
      where: { userId: req.user.id, testType, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { id: true, score: true, totalQuestions: true, completedAt: true },
    });

    res.json({ success: true, data: { testType, testForm, questions, completedAttempt } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quiz/start
router.post('/start', validate(quizStartSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { testType } = req.body;
    const testForm = TEST_FORM[testType];

    const totalQuestions = await prisma.question.count({ where: { testForm, isActive: true } });
    if (totalQuestions === 0) {
      return res.status(400).json({ success: false, error: `No active questions for ${testType}` });
    }

    const attempt = await prisma.quizAttempt.create({
      data: { userId: req.user.id, testType, testForm, status: 'in_progress', totalQuestions },
    });

    res.status(201).json({
      success: true,
      data: { attemptId: attempt.id, testType, testForm, totalQuestions },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
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
        testForm: attempt.testForm,
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
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
