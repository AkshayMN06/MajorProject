import { PrismaClient } from '@prisma/client';
import { CYBER_GLOSSARY } from '../data/cyberGlossary';

const prisma = new PrismaClient();

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface KnowledgeEntry {
  keywords: string[];
  answer: string;
}

interface KnowledgeBaseCache {
  entries: KnowledgeEntry[];
  expiresAt: number;
}

let kbCache: KnowledgeBaseCache | null = null;
const KB_TTL_MS = 10 * 60 * 1000;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the deterministic knowledge base from the platform's own DB data
 * (scenarios, attack/defense options, and the rules that connect them)
 * plus the static cybersecurity glossary. Cached briefly since scenario
 * data rarely changes between requests.
 */
async function buildKnowledgeBase(): Promise<KnowledgeEntry[]> {
  const now = Date.now();
  if (kbCache && kbCache.expiresAt > now) {
    return kbCache.entries;
  }

  const entries: KnowledgeEntry[] = [];

  for (const g of CYBER_GLOSSARY) {
    entries.push({ keywords: g.terms.map((t) => t.toLowerCase()), answer: g.definition });
  }

  const scenarios = await prisma.scenario.findMany({ orderBy: { category: 'asc' } });

  const attackBlurbs = new Map<string, string[]>();
  const defenseBlurbs = new Map<string, string[]>();

  for (const s of scenarios) {
    const attacks = (s.attackOptions as any[]) ?? [];
    const defenses = (s.defenseOptions as any[]) ?? [];
    const rules = await prisma.rule.findMany({ where: { scenarioId: s.id } });

    for (const a of attacks) {
      const winningRule = rules.find((r) => r.attackType === a.id && r.outcome === 'defended');
      const defenseName = winningRule ? defenses.find((d) => d.id === winningRule.defenseType)?.name : null;
      const blurb =
        `In the "${s.name}" scenario (${s.category}): **${a.name}** — ${a.description} (difficulty: ${a.difficulty}).` +
        (defenseName ? ` The countermeasure that stops it here is **${defenseName}**.` : '');
      const key = a.name.toLowerCase();
      if (!attackBlurbs.has(key)) attackBlurbs.set(key, []);
      attackBlurbs.get(key)!.push(blurb);
    }

    for (const d of defenses) {
      const stoppedAttacks = rules
        .filter((r) => r.defenseType === d.id && r.outcome === 'defended')
        .map((r) => attacks.find((a) => a.id === r.attackType)?.name)
        .filter((name): name is string => Boolean(name));
      const blurb =
        `In the "${s.name}" scenario (${s.category}): **${d.name}** — ${d.description} (effectiveness: ${d.effectiveness}).` +
        (stoppedAttacks.length ? ` It stops: ${stoppedAttacks.join(', ')}.` : '');
      const key = d.name.toLowerCase();
      if (!defenseBlurbs.has(key)) defenseBlurbs.set(key, []);
      defenseBlurbs.get(key)!.push(blurb);
    }

    const attackNames = attacks.map((a) => a.name).join(', ') || 'none listed';
    const defenseNames = defenses.map((d) => d.name).join(', ') || 'none listed';
    entries.push({
      keywords: [s.name.toLowerCase()],
      answer: `**${s.name}** (${s.category}, ${s.difficulty}) — Target: ${s.targetSystem}\n${s.description}\n${s.context}\n\nAttacks available: ${attackNames}\nDefenses available: ${defenseNames}`,
    });
  }

  for (const [key, blurbs] of attackBlurbs) {
    entries.push({ keywords: [key], answer: blurbs.join('\n\n') });
  }
  for (const [key, blurbs] of defenseBlurbs) {
    entries.push({ keywords: [key], answer: blurbs.join('\n\n') });
  }

  kbCache = { entries, expiresAt: now + KB_TTL_MS };
  return entries;
}

function scoreEntry(query: string, entry: KnowledgeEntry): number {
  let score = 0;
  for (const kw of entry.keywords) {
    if (!kw) continue;
    const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
    if (re.test(query)) {
      score += kw.length;
    }
  }
  return score;
}

const FALLBACK_MESSAGE =
  'I don\'t have a specific answer for that yet. Try asking about a specific attack (e.g. "What is Phishing?"), a defense (e.g. "What is Multi-Factor Authentication?"), one of the practice scenarios (e.g. "Explain the DNS Infrastructure scenario"), or a general term (e.g. "What is a zero-day exploit?").';

/**
 * Matches a student question against the deterministic knowledge base
 * (no external API or LLM) and returns the best matching canned answer.
 * `history` is accepted for API-contract compatibility but unused, since
 * matching is stateless per-question.
 */
export async function chatWithTutor(userMessage: string, _history: ChatTurn[] = []): Promise<string> {
  const kb = await buildKnowledgeBase();
  const normalized = userMessage.toLowerCase();

  const scored = kb
    .map((entry) => ({ entry, score: scoreEntry(normalized, entry) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return FALLBACK_MESSAGE;
  }

  const top = scored[0];
  const results = [top.entry];
  const second = scored.find((x) => x.entry !== top.entry && x.score >= top.score * 0.6);
  if (second) {
    results.push(second.entry);
  }

  return results.map((r) => r.answer).join('\n\n---\n\n');
}
