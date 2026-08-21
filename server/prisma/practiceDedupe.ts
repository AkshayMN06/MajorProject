// Similarity check used to guarantee the Practice Lab question pool and the
// Pre/Post-test quiz bank (prisma/quizContent/) never exactly-duplicate or
// closely rephrase each other within the same module. Deliberately
// dependency-free (no embeddings/LLM call in a seed script) — token-Jaccard
// similarity on the normalized question text is enough to catch both
// literal duplicates and light rewording ("primary purpose" -> "main
// function") while staying fast and fully offline.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'to', 'for',
  'and', 'or', 'which', 'what', 'best', 'describes', 'following', 'this',
  'that', 'does', 'do', 'you', 'your', 'it', 'its', 'be', 'by', 'as', 'with',
  // Module/domain names that legitimately appear in nearly every question of
  // a module — without stripping these, two genuinely different questions
  // that both happen to mention their own module name (e.g. "Social
  // Engineering") score as artificially similar on the content-word signal.
  'social', 'engineering', 'network', 'web', 'system', 'security', 'cryptography',
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text: string, dropStopwords: boolean): Set<string> {
  const words = normalizeText(text).split(' ').filter(Boolean);
  return new Set(dropStopwords ? words.filter((w) => !STOPWORDS.has(w)) : words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * True if `a` and `b` are close enough to be considered the same question —
 * either near-identical full text (catches literal duplicates and minor
 * rewording), or heavy overlap in the meaningful (non-stopword) terms
 * (catches "different template, same concept" paraphrases).
 */
export function isSimilar(a: string, b: string, fullThreshold = 0.55, contentThreshold = 0.55): boolean {
  const fullScore = jaccard(tokenSet(a, false), tokenSet(b, false));
  const contentScore = jaccard(tokenSet(a, true), tokenSet(b, true));
  return fullScore >= fullThreshold || contentScore >= contentThreshold;
}

export interface OverlapMatch {
  question: string;
  matchedAgainst: string;
  source: string;
}

/**
 * Compares every question in `candidates` against every question in
 * `existing` that belongs to the same module, returning every pair that's
 * too similar. An empty result means the pools are genuinely independent.
 */
export function findOverlaps(
  candidates: { question: string; module: string }[],
  existing: { question: string; moduleTag: string; questionId: string }[]
): OverlapMatch[] {
  const overlaps: OverlapMatch[] = [];
  const existingByModule = new Map<string, typeof existing>();
  for (const e of existing) {
    const list = existingByModule.get(e.moduleTag) ?? [];
    list.push(e);
    existingByModule.set(e.moduleTag, list);
  }

  for (const candidate of candidates) {
    const sameModule = existingByModule.get(candidate.module) ?? [];
    for (const e of sameModule) {
      if (isSimilar(candidate.question, e.question)) {
        overlaps.push({ question: candidate.question, matchedAgainst: e.question, source: e.questionId });
      }
    }
  }
  return overlaps;
}
