// Question-quality gates enforced at seed time (server/prisma/seedPractice.ts)
// and re-checked by tests — not just an authoring guideline. Two concerns:
// 1. the correct option must not be identifiable purely by being the
//    longest/most-detailed choice, and 2. the correct answer's position
//    (A/B/C/D) must be reasonably spread out across the question set, not
//    clustered on one letter.

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface OptionBalanceQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
}

export interface OptionBalanceIssue {
  question: string;
  correctLength: number;
  avgDistractorLength: number;
  ratio: number;
}

/**
 * Flags a question if its correct option is disproportionately longer than
 * the average of the three distractors — the exact "give-away by length"
 * pattern this feature must avoid. `maxRatio` of 1.5 means the correct
 * option may be at most 50% longer than the distractors' average; anything
 * beyond that is rejected rather than silently accepted.
 */
export function checkOptionBalance(q: OptionBalanceQuestion, maxRatio = 1.6): OptionBalanceIssue | null {
  const options: Record<OptionKey, string> = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
  const correctLength = options[q.correctOption].length;
  const distractorLengths = (['A', 'B', 'C', 'D'] as OptionKey[])
    .filter((k) => k !== q.correctOption)
    .map((k) => options[k].length);
  const avgDistractorLength = distractorLengths.reduce((a, b) => a + b, 0) / distractorLengths.length;
  const ratio = avgDistractorLength === 0 ? Infinity : correctLength / avgDistractorLength;

  if (ratio > maxRatio) {
    return { question: q.question, correctLength, avgDistractorLength: Math.round(avgDistractorLength * 10) / 10, ratio: Math.round(ratio * 100) / 100 };
  }
  return null;
}

export interface AnswerDistributionResult {
  counts: Record<OptionKey, number>;
  percentages: Record<OptionKey, number>;
  withinBand: boolean;
  outliers: OptionKey[];
}

/**
 * Checks that across a set of questions, no single letter dominates (or is
 * absent from) the correct-answer position. A loose 15%-35% band per
 * letter — not a forced exact 25/25/25/25 split, which would itself be a
 * detectable, gameable pattern.
 */
export function checkAnswerDistribution(
  questions: { correctOption: OptionKey }[],
  minPct = 0.15,
  maxPct = 0.35
): AnswerDistributionResult {
  const counts: Record<OptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of questions) counts[q.correctOption]++;
  const total = questions.length;
  const percentages = {
    A: counts.A / total,
    B: counts.B / total,
    C: counts.C / total,
    D: counts.D / total,
  };
  const outliers = (['A', 'B', 'C', 'D'] as OptionKey[]).filter(
    (k) => percentages[k] < minPct || percentages[k] > maxPct
  );
  return { counts, percentages, withinBand: outliers.length === 0, outliers };
}

export interface StructureQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  explanation: string;
}

/**
 * Basic structural validation: 4 non-empty options, a valid correctOption,
 * no duplicate options, a non-empty explanation. Returns a list of human
 * -readable problems (empty = valid).
 */
export function validateQuestionStructure(q: StructureQuestion): string[] {
  const problems: string[] = [];
  const options = [q.optionA, q.optionB, q.optionC, q.optionD];

  if (options.some((o) => !o || !o.trim())) {
    problems.push(`Question "${q.question}" has an empty option.`);
  }
  if (!(['A', 'B', 'C', 'D'] as OptionKey[]).includes(q.correctOption)) {
    problems.push(`Question "${q.question}" has an invalid correctOption "${q.correctOption}".`);
  }
  const normalized = options.map((o) => o.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    problems.push(`Question "${q.question}" has duplicate options.`);
  }
  if (!q.explanation || !q.explanation.trim()) {
    problems.push(`Question "${q.question}" is missing an explanation.`);
  }
  return problems;
}
