import { PrismaClient } from '@prisma/client';

const WEAK_TOPIC_THRESHOLD = 60; // post-test accuracy below this = "needs review"
const WEAK_MODULE_THRESHOLD = 60;
const MAX_RECOMMENDATIONS = 3;

export interface ModulePerformance {
  moduleTag: string;
  preAccuracy: number | null; // percentage 0-100, null if this module wasn't covered by the user's pre-test
  postAccuracy: number | null;
}

export interface LearningRecommendation {
  title: string;
  description: string;
}

export interface LearningOutcomes {
  hasPreTest: boolean;
  hasPostTest: boolean;
  preTestScore: number | null; // percentage 0-100
  postTestScore: number | null; // percentage 0-100
  learningGain: number | null; // percentage points, postTestScore - preTestScore
  learningGainPercent: number | null; // relative % change
  modulePerformance: ModulePerformance[];
  weakTopics: string[]; // topics with post-test accuracy < 60%
  recommendations: LearningRecommendation[];
}

type ResponseWithQuestion = {
  isCorrect: boolean;
  question: { moduleTag: string; topicTag: string };
};

// At most one row can match — enforced by the QuizAttempt
// @@unique([sessionId, userId, testType]) constraint.
async function getAttempt(prisma: PrismaClient, sessionId: string, userId: string, testType: 'PRE' | 'POST') {
  return prisma.quizAttempt.findFirst({
    where: { sessionId, userId, testType, status: 'completed' },
    include: { responses: { include: { question: true } } },
  });
}

function accuracyByModule(responses: ResponseWithQuestion[]): Map<string, { correct: number; total: number }> {
  const map = new Map<string, { correct: number; total: number }>();
  for (const r of responses) {
    const key = r.question.moduleTag;
    const entry = map.get(key) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (r.isCorrect) entry.correct += 1;
    map.set(key, entry);
  }
  return map;
}

function accuracyByTopic(responses: ResponseWithQuestion[]): Map<string, { correct: number; total: number; moduleTag: string }> {
  const map = new Map<string, { correct: number; total: number; moduleTag: string }>();
  for (const r of responses) {
    const key = r.question.topicTag;
    const entry = map.get(key) ?? { correct: 0, total: 0, moduleTag: r.question.moduleTag };
    entry.total += 1;
    if (r.isCorrect) entry.correct += 1;
    map.set(key, entry);
  }
  return map;
}

/**
 * Computes this user's Pre-test -> Post-test learning outcomes for one
 * specific Scenario Assessment session, entirely server-side from their
 * stored QuizAttempt/QuizResponse rows. Every session gets its own
 * independent Pre-test and Post-test attempt (see quizEngine.ts), so this
 * must be scoped to `sessionId` rather than reporting the user's latest
 * attempt ever — otherwise a newer session's report would overwrite an
 * older session's scores.
 */
export async function buildLearningOutcomes(prisma: PrismaClient, userId: string, sessionId: string): Promise<LearningOutcomes> {
  const [preAttempt, postAttempt] = await Promise.all([
    getAttempt(prisma, sessionId, userId, 'PRE'),
    getAttempt(prisma, sessionId, userId, 'POST'),
  ]);

  const hasPreTest = !!preAttempt;
  const hasPostTest = !!postAttempt;

  const preTestScore = preAttempt ? Math.round((preAttempt.score! / preAttempt.totalQuestions) * 100) : null;
  const postTestScore = postAttempt ? Math.round((postAttempt.score! / postAttempt.totalQuestions) * 100) : null;

  const learningGain = preTestScore !== null && postTestScore !== null ? postTestScore - preTestScore : null;
  const learningGainPercent =
    preTestScore !== null && postTestScore !== null
      ? Math.round(((postTestScore - preTestScore) / Math.max(1, preTestScore)) * 100)
      : null;

  const preByModule = preAttempt ? accuracyByModule(preAttempt.responses as ResponseWithQuestion[]) : new Map();
  const postByModule = postAttempt ? accuracyByModule(postAttempt.responses as ResponseWithQuestion[]) : new Map();
  const allModules = new Set<string>([...preByModule.keys(), ...postByModule.keys()]);

  const modulePerformance: ModulePerformance[] = Array.from(allModules)
    .sort()
    .map((moduleTag) => {
      const pre = preByModule.get(moduleTag);
      const post = postByModule.get(moduleTag);
      return {
        moduleTag,
        preAccuracy: pre ? Math.round((pre.correct / pre.total) * 100) : null,
        postAccuracy: post ? Math.round((post.correct / post.total) * 100) : null,
      };
    });

  const postByTopic = postAttempt ? accuracyByTopic(postAttempt.responses as ResponseWithQuestion[]) : new Map();
  const weakTopics: string[] = [];
  const weakTopicsByModule = new Map<string, string[]>();
  for (const [topic, stat] of postByTopic) {
    const accuracy = (stat.correct / stat.total) * 100;
    if (accuracy < WEAK_TOPIC_THRESHOLD) {
      weakTopics.push(topic);
      const list = weakTopicsByModule.get(stat.moduleTag) ?? [];
      list.push(topic);
      weakTopicsByModule.set(stat.moduleTag, list);
    }
  }

  const weakModules = modulePerformance
    .filter((m) => m.postAccuracy !== null && m.postAccuracy < WEAK_MODULE_THRESHOLD)
    .sort((a, b) => (a.postAccuracy ?? 0) - (b.postAccuracy ?? 0));

  const recommendations: LearningRecommendation[] = weakModules.slice(0, MAX_RECOMMENDATIONS).map((m) => {
    const topics = weakTopicsByModule.get(m.moduleTag) ?? [];
    return {
      title: `Review ${m.moduleTag}`,
      description: topics.length
        ? `Your post-test accuracy in ${m.moduleTag} was ${m.postAccuracy}%. Focus on: ${topics.join(', ')}.`
        : `Your post-test accuracy in ${m.moduleTag} was ${m.postAccuracy}%. Revisit the core concepts in this module.`,
    };
  });

  return {
    hasPreTest,
    hasPostTest,
    preTestScore,
    postTestScore,
    learningGain,
    learningGainPercent,
    modulePerformance,
    weakTopics,
    recommendations,
  };
}
