import { PrismaClient } from '@prisma/client';
import { sampleQuestions } from './practiceEngine';

const prisma = new PrismaClient();

export const QUESTIONS_PER_ATTEMPT = 8;

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// A session's module/difficulty can be the UI's "any" sentinel value
// ('All Modules' / 'All') rather than a specific one — in that case the
// pool spans every module or every difficulty instead of filtering to one.
function resolvePoolWhere(moduleTag: string | null, difficulty: string | null) {
  const where: { isActive: boolean; moduleTag?: string; difficulty?: string } = { isActive: true };
  if (moduleTag && moduleTag !== 'All Modules') where.moduleTag = moduleTag;
  if (difficulty && difficulty !== 'All') where.difficulty = difficulty;
  return where;
}

/**
 * Builds the 8-question set for a new attempt, avoiding recently-seen
 * questions where possible without ever failing to produce a full set (the
 * spec's "graceful degradation" requirement) — each exclusion only applies
 * if enough candidates remain afterward.
 *
 * Priority order:
 *   1. This session's own PRE attempt's questions, when selecting POST
 *      (keeps Pre/Post distinct within one attempt).
 *   2. The user's most recent OTHER session's attempt with the same
 *      (moduleTag, difficulty, testType) (avoids repeating across attempts).
 *   3. Random selection from whatever remains.
 */
async function selectQuestions(
  userId: string,
  sessionId: string,
  testType: string,
  moduleTag: string | null,
  difficulty: string | null
) {
  const pool = await prisma.question.findMany({ where: resolvePoolWhere(moduleTag, difficulty) });
  if (pool.length < QUESTIONS_PER_ATTEMPT) {
    throw httpError(
      400,
      `Not enough active questions for module "${moduleTag ?? 'All Modules'}" / difficulty "${difficulty ?? 'All'}" (${pool.length} available, need ${QUESTIONS_PER_ATTEMPT}).`
    );
  }

  let candidates = pool;

  if (testType === 'POST') {
    const ownPreAttempt = await prisma.quizAttempt.findUnique({
      where: { sessionId_userId_testType: { sessionId, userId, testType: 'PRE' } },
    });
    const preQuestionIds = (ownPreAttempt?.questionIds as string[] | undefined) ?? [];
    if (preQuestionIds.length > 0) {
      const withoutPre = candidates.filter((q) => !preQuestionIds.includes(q.id));
      if (withoutPre.length >= QUESTIONS_PER_ATTEMPT) candidates = withoutPre;
    }
  }

  const lastOtherAttempt = await prisma.quizAttempt.findFirst({
    where: {
      userId,
      testType,
      moduleTag,
      difficulty,
      sessionId: { not: sessionId },
    },
    orderBy: { startedAt: 'desc' },
  });
  const lastQuestionIds = (lastOtherAttempt?.questionIds as string[] | undefined) ?? [];
  if (lastQuestionIds.length > 0) {
    const withoutLast = candidates.filter((q) => !lastQuestionIds.includes(q.id));
    if (withoutLast.length >= QUESTIONS_PER_ATTEMPT) candidates = withoutLast;
  }

  return sampleQuestions(candidates, QUESTIONS_PER_ATTEMPT);
}

/**
 * The idempotent entry point: returns the existing (sessionId, userId,
 * testType) attempt untouched if one already exists — whatever its status —
 * so a refresh or duplicate call never re-selects questions or creates a
 * second row. Only creates + selects when no attempt exists yet. The
 * QuizAttempt @@unique([sessionId, userId, testType]) constraint is the
 * race-condition safety net if two requests land concurrently.
 */
export async function getOrStartAttempt(userId: string, sessionId: string, testType: 'PRE' | 'POST') {
  const existing = await prisma.quizAttempt.findUnique({
    where: { sessionId_userId_testType: { sessionId, userId, testType } },
  });
  if (existing) return existing;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw httpError(404, 'Session not found');
  if (session.attackerId !== userId && session.defenderId !== userId) {
    throw httpError(403, 'You are not a participant in this session');
  }

  const selected = await selectQuestions(userId, sessionId, testType, session.module, session.difficulty);

  try {
    return await prisma.quizAttempt.create({
      data: {
        userId,
        sessionId,
        moduleTag: session.module,
        difficulty: session.difficulty,
        questionIds: selected.map((q) => q.id),
        testType,
        totalQuestions: QUESTIONS_PER_ATTEMPT,
      },
    });
  } catch (err: any) {
    // Concurrent request already created it — fall back to the now-existing row.
    if (err.code === 'P2002') {
      const raced = await prisma.quizAttempt.findUnique({
        where: { sessionId_userId_testType: { sessionId, userId, testType } },
      });
      if (raced) return raced;
    }
    throw err;
  }
}

// Resolves an attempt's stored questionIds (fixed for the life of the
// attempt) back into full question rows, in the original selection order,
// so a refresh always shows the same 8 questions rather than reshuffling.
export async function getAttemptQuestions(attempt: { questionIds: unknown }) {
  const ids = (attempt.questionIds as string[] | null) ?? [];
  if (ids.length === 0) return [];
  const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));
}
