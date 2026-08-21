import { PrismaClient } from '@prisma/client';

// Everything in this file only ever touches Session/QuizAttempt/QuizResponse/
// User — never the Practice*/CaseStudy tables — so Practice Labs is excluded
// from these analytics by construction, matching the isolation already
// mandated in schema.prisma's comment above `model CaseStudy`.

export interface PairedResult {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  moduleTag: string | null; // snapshot on the attempt — may be the 'All Modules' sentinel
  difficulty: string | null; // snapshot on the attempt — may be the 'All' sentinel
  preScore: number;
  preTotal: number;
  postScore: number;
  postTotal: number;
  postCompletedAt: Date;
  preResponses: { isCorrect: boolean; moduleTag: string; difficulty: string }[];
  postResponses: { isCorrect: boolean; moduleTag: string; difficulty: string }[];
}

export interface CompletedPairFilters {
  module?: string;
  difficulty?: string;
  startDate?: Date;
  endDate?: Date;
}

// Operates in UTC deliberately — dates stored/compared here (QuizAttempt
// .completedAt, and the startDate/endDate filter values themselves) are all
// UTC instants. Using local-time setHours would shift the boundary by the
// server's timezone offset and silently mis-include/exclude rows near
// midnight.
function nextDayMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

/**
 * A "completed pair" = one (sessionId, userId) with both a completed PRE and
 * a completed POST QuizAttempt. Module/difficulty filters narrow which
 * attempts are fetched (snapshot-based — matches the session's own
 * configuration); the date range filter is applied afterwards against the
 * pair's postCompletedAt, since that's the moment the whole Pre->Assessment
 * ->Post cycle actually finished.
 */
export async function fetchCompletedPairs(
  prisma: PrismaClient,
  filters: CompletedPairFilters = {}
): Promise<PairedResult[]> {
  const where: any = {
    testType: { in: ['PRE', 'POST'] },
    status: 'completed',
    sessionId: { not: null },
  };
  if (filters.module) where.moduleTag = filters.module;
  if (filters.difficulty) where.difficulty = filters.difficulty;

  const attempts = await prisma.quizAttempt.findMany({
    where,
    select: {
      userId: true,
      sessionId: true,
      moduleTag: true,
      difficulty: true,
      testType: true,
      score: true,
      totalQuestions: true,
      completedAt: true,
      user: { select: { name: true, email: true } },
      responses: {
        select: { isCorrect: true, question: { select: { moduleTag: true, difficulty: true } } },
      },
    },
  });

  const byKey = new Map<string, { pre?: (typeof attempts)[number]; post?: (typeof attempts)[number] }>();
  for (const a of attempts) {
    const key = `${a.sessionId}:${a.userId}`;
    const entry = byKey.get(key) ?? {};
    if (a.testType === 'PRE') entry.pre = a;
    else if (a.testType === 'POST') entry.post = a;
    byKey.set(key, entry);
  }

  const pairs: PairedResult[] = [];
  for (const [key, entry] of byKey) {
    if (!entry.pre || !entry.post) continue; // incomplete cycle — excluded per spec §18
    if (entry.pre.score == null || entry.post.score == null) continue;
    if (entry.pre.totalQuestions === 0 || entry.post.totalQuestions === 0) continue;
    if (!entry.post.completedAt) continue;
    const [sessionId, userId] = key.split(':');
    pairs.push({
      sessionId,
      userId,
      userName: entry.post.user.name,
      userEmail: entry.post.user.email,
      moduleTag: entry.post.moduleTag,
      difficulty: entry.post.difficulty,
      preScore: entry.pre.score,
      preTotal: entry.pre.totalQuestions,
      postScore: entry.post.score,
      postTotal: entry.post.totalQuestions,
      postCompletedAt: entry.post.completedAt,
      preResponses: entry.pre.responses.map((r) => ({
        isCorrect: r.isCorrect,
        moduleTag: r.question.moduleTag,
        difficulty: r.question.difficulty,
      })),
      postResponses: entry.post.responses.map((r) => ({
        isCorrect: r.isCorrect,
        moduleTag: r.question.moduleTag,
        difficulty: r.question.difficulty,
      })),
    });
  }

  return pairs.filter((p) => {
    if (filters.startDate && p.postCompletedAt < filters.startDate) return false;
    if (filters.endDate && p.postCompletedAt >= nextDayMidnightUTC(filters.endDate)) return false;
    return true;
  });
}

// ─── Pure computation layer — no prisma, independently unit-testable ──────

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface PairMath {
  prePct: number;
  postPct: number;
  rawImprovement: number; // question-count delta, e.g. +3
  ppImprovement: number; // percentage-POINT delta, e.g. +37.5 — never post/pre division
  category: 'improved' | 'unchanged' | 'decreased';
}

export function computePairMath(pair: PairedResult): PairMath {
  const prePct = round1((pair.preScore / pair.preTotal) * 100);
  const postPct = round1((pair.postScore / pair.postTotal) * 100);
  const rawImprovement = pair.postScore - pair.preScore;
  const ppImprovement = round1(postPct - prePct);
  const category: PairMath['category'] = ppImprovement > 0 ? 'improved' : ppImprovement < 0 ? 'decreased' : 'unchanged';
  return { prePct, postPct, rawImprovement, ppImprovement, category };
}

export interface OverallStats {
  pairCount: number;
  avgPrePct: number;
  avgPostPct: number;
  avgImprovementPP: number;
  improved: number;
  unchanged: number;
  decreased: number;
}

export function computeOverall(pairs: PairedResult[]): OverallStats {
  if (pairs.length === 0) {
    return { pairCount: 0, avgPrePct: 0, avgPostPct: 0, avgImprovementPP: 0, improved: 0, unchanged: 0, decreased: 0 };
  }
  const mathByPair = pairs.map(computePairMath);
  const count = mathByPair.length;
  const avgPrePct = round1(mathByPair.reduce((s, m) => s + m.prePct, 0) / count);
  const avgPostPct = round1(mathByPair.reduce((s, m) => s + m.postPct, 0) / count);
  const avgImprovementPP = round1(mathByPair.reduce((s, m) => s + m.ppImprovement, 0) / count);
  const improved = mathByPair.filter((m) => m.category === 'improved').length;
  const unchanged = mathByPair.filter((m) => m.category === 'unchanged').length;
  const decreased = mathByPair.filter((m) => m.category === 'decreased').length;
  return { pairCount: count, avgPrePct, avgPostPct, avgImprovementPP, improved, unchanged, decreased };
}

export interface CategoryAggregate {
  category: string;
  attempts: number; // distinct pairs contributing at least one question in this category
  avgPrePct: number;
  avgPostPct: number;
  avgImprovementPP: number;
}

/**
 * Aggregates by the ACTUAL question's moduleTag/difficulty rather than the
 * attempt-level snapshot, so a session created with the 'All Modules'/'All'
 * sentinel still contributes correctly to each real module/difficulty's
 * average instead of forming a meaningless bucket. Mirrors the same
 * per-question attribution technique learningOutcomes.ts already uses
 * per-user (accuracyByModule), just aggregated across every user.
 */
function aggregateByQuestionAttribute(pairs: PairedResult[], attr: 'moduleTag' | 'difficulty'): CategoryAggregate[] {
  const buckets = new Map<
    string,
    { preCorrect: number; preTotal: number; postCorrect: number; postTotal: number; pairKeys: Set<string> }
  >();

  for (const pair of pairs) {
    const pairKey = `${pair.sessionId}:${pair.userId}`;
    for (const r of pair.preResponses) {
      const key = r[attr];
      if (!key) continue;
      const b = buckets.get(key) ?? { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0, pairKeys: new Set<string>() };
      b.preTotal++;
      if (r.isCorrect) b.preCorrect++;
      b.pairKeys.add(pairKey);
      buckets.set(key, b);
    }
    for (const r of pair.postResponses) {
      const key = r[attr];
      if (!key) continue;
      const b = buckets.get(key) ?? { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0, pairKeys: new Set<string>() };
      b.postTotal++;
      if (r.isCorrect) b.postCorrect++;
      b.pairKeys.add(pairKey);
      buckets.set(key, b);
    }
  }

  const result: CategoryAggregate[] = [];
  for (const [category, b] of buckets) {
    if (b.preTotal === 0 || b.postTotal === 0) continue;
    const avgPrePct = round1((b.preCorrect / b.preTotal) * 100);
    const avgPostPct = round1((b.postCorrect / b.postTotal) * 100);
    result.push({ category, attempts: b.pairKeys.size, avgPrePct, avgPostPct, avgImprovementPP: round1(avgPostPct - avgPrePct) });
  }
  return result.sort((a, b) => a.category.localeCompare(b.category));
}

export function computeModuleSummary(pairs: PairedResult[]): CategoryAggregate[] {
  return aggregateByQuestionAttribute(pairs, 'moduleTag');
}

export function computeDifficultySummary(pairs: PairedResult[]): CategoryAggregate[] {
  return aggregateByQuestionAttribute(pairs, 'difficulty');
}
