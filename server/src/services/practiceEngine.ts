import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const QUESTIONS_PER_SESSION = 8;

/**
 * Fisher-Yates shuffle + slice — sampling without replacement from a real
 * array, so the result is always exactly `n` unique items (as long as
 * pool.length >= n) with a genuinely randomized order each call.
 */
export function sampleQuestions<T>(pool: T[], n: number): T[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

async function liveModules(): Promise<string[]> {
  const scenarios = await prisma.scenario.findMany({ select: { category: true }, distinct: ['category'] });
  return scenarios.map((s) => s.category).sort();
}

// GET /api/practice/modules — one card per live Scenario Assessment module.
export async function getModules() {
  const modules = await liveModules();
  const result = [];
  for (const module of modules) {
    const questionCount = await prisma.practiceQuestion.count({ where: { module, isActive: true } });
    result.push({ module, questionCount, questionsPerSession: QUESTIONS_PER_SESSION, difficulty: 'Beginner' as const });
  }
  return result;
}

/**
 * Selects exactly one case study and, within it, exactly one question pool
 * for a new session — the core "one session = one case study = one pool"
 * rule. Avoids immediately repeating the learner's last case study for this
 * module when an alternative exists, and (only when the case study repeats
 * because none other is available) avoids repeating the last pool too.
 */
async function selectCaseStudyAndPool(userId: string, module: string) {
  const caseStudies = await prisma.caseStudy.findMany({ where: { module, isActive: true } });
  if (caseStudies.length === 0) {
    throw httpError(400, `No case studies available for module "${module}"`);
  }

  const lastSession = await prisma.practiceSession.findFirst({
    where: { userId, module },
    orderBy: { startedAt: 'desc' },
  });

  let caseStudyCandidates = caseStudies;
  if (lastSession && caseStudies.length > 1) {
    const withoutLast = caseStudies.filter((cs) => cs.id !== lastSession.caseStudyId);
    if (withoutLast.length > 0) caseStudyCandidates = withoutLast;
  }
  const caseStudy = pickOne(caseStudyCandidates);

  const pools = await prisma.practiceQuestionPool.findMany({ where: { caseStudyId: caseStudy.id, isActive: true } });
  if (pools.length === 0) {
    throw httpError(400, `No question pools available for case study "${caseStudy.title}"`);
  }

  let poolCandidates = pools;
  // Only need to avoid the previous pool when we've landed on the SAME case
  // study as last time (i.e. no alternative case study existed) — otherwise
  // a different case study already guarantees a different pool.
  if (lastSession && lastSession.caseStudyId === caseStudy.id && pools.length > 1) {
    const withoutLastPool = pools.filter((p) => p.id !== lastSession.poolId);
    if (withoutLastPool.length > 0) poolCandidates = withoutLastPool;
  }
  const pool = pickOne(poolCandidates);

  return { caseStudy, pool };
}

// POST /api/practice/:module/session
export async function startSession(userId: string, module: string) {
  const modules = await liveModules();
  if (!modules.includes(module)) {
    throw httpError(400, `Unknown module: ${module}`);
  }

  const { caseStudy, pool } = await selectCaseStudyAndPool(userId, module);

  const poolQuestions = await prisma.practiceQuestion.findMany({ where: { poolId: pool.id, isActive: true } });
  if (poolQuestions.length < QUESTIONS_PER_SESSION) {
    throw httpError(
      400,
      `Not enough active practice questions in pool "${pool.name}" (${poolQuestions.length} available, need ${QUESTIONS_PER_SESSION}).`
    );
  }

  const selected = sampleQuestions(poolQuestions, QUESTIONS_PER_SESSION);
  const session = await prisma.practiceSession.create({
    data: {
      userId,
      module,
      caseStudyId: caseStudy.id,
      poolId: pool.id,
      questionIds: selected.map((q) => q.id),
      totalQuestions: QUESTIONS_PER_SESSION,
    },
  });

  return {
    sessionId: session.id,
    module,
    caseStudy: { id: caseStudy.id, title: caseStudy.title, description: caseStudy.description },
    totalQuestions: QUESTIONS_PER_SESSION,
    // correctOption/explanation deliberately withheld until submit.
    questions: selected.map((q) => ({
      id: q.id,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      topicTag: q.topicTag,
      difficulty: q.difficulty,
    })),
  };
}

export interface PracticeAnswer {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
}

// POST /api/practice/session/:sessionId/submit — never touches score,
// analytics, assessmentSnapshot, attempt, or event; only the practice_*
// tables. That's the actual analytics-isolation mechanism.
export async function submitSession(sessionId: string, userId: string, responses: PracticeAnswer[]) {
  const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw httpError(404, 'Session not found');
  if (session.userId !== userId) throw httpError(403, 'You are not the owner of this practice session');
  if (session.status === 'completed') throw httpError(400, 'This practice session was already submitted');

  const sessionQuestionIds = session.questionIds as string[];
  const sessionQuestionIdSet = new Set(sessionQuestionIds);

  // Dedupe by questionId (last write wins) and silently drop any id that
  // doesn't belong to this session, rather than failing the whole submit.
  const answerByQuestion = new Map<string, 'A' | 'B' | 'C' | 'D'>();
  for (const r of responses) {
    if (!sessionQuestionIdSet.has(r.questionId)) continue;
    answerByQuestion.set(r.questionId, r.selectedOption);
  }

  const questions = await prisma.practiceQuestion.findMany({ where: { id: { in: sessionQuestionIds } } });
  const questionById = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  const responseRows: { sessionId: string; questionId: string; selectedOption: string; isCorrect: boolean }[] = [];
  const review = [];
  for (const questionId of sessionQuestionIds) {
    const question = questionById.get(questionId);
    if (!question) continue;
    const selectedOption = answerByQuestion.get(questionId) ?? null;
    const isCorrect = selectedOption !== null && question.correctOption === selectedOption;
    if (isCorrect) score++;
    if (selectedOption !== null) {
      responseRows.push({ sessionId, questionId, selectedOption, isCorrect });
    }
    review.push({
      questionId,
      question: question.question,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      selectedOption,
      correctOption: question.correctOption,
      isCorrect,
      explanation: question.explanation,
      topicTag: question.topicTag,
    });
  }

  if (responseRows.length > 0) {
    await prisma.practiceResponse.createMany({ data: responseRows });
  }
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { status: 'completed', score, completedAt: new Date() },
  });

  return {
    sessionId,
    module: session.module,
    score,
    totalQuestions: session.totalQuestions,
    responses: review,
  };
}
