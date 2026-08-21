// Seeds the Pre/Post-test question bank (Question table) for all 5 modules
// x 3 difficulties, 50 questions each (750 total). Validates every module
// thoroughly before writing anything to the database:
//   - exactly 50 questions per (moduleTag, difficulty)
//   - structural validity of every question (validateQuestionStructure)
//   - no question's correct option is a length-based giveaway (checkOptionBalance)
//   - no duplicate questionId or question text within a (module, difficulty) pool
//   - zero overlap with the existing Practice Labs question bank (practiceDedupe.ts),
//     checked in the reverse direction from seedPractice.ts's own check
// A single violation anywhere fails the whole seed loudly rather than
// silently importing bad content.
//
// After validation passes, every (module, difficulty) pool's correct-answer
// letter is mechanically redistributed via round-robin (A/B/C/D, as evenly
// as 50/4 allows) — this guarantees the answer-position band requirement
// exactly, regardless of how the letters landed while the content was
// authored. quizEngine.ts randomly samples 8 of 50 and can further shuffle
// presentation order, so this pool-level pattern is never learner-visible.
//
// Dev-only content with no stable cross-run identity beyond questionId, so
// re-running clears prior questions/quiz_attempts/quiz_responses rows before
// reinserting — safe and idempotent.
import { PrismaClient } from '@prisma/client';
import { WEB_SECURITY_QUIZ } from './quizContent/webSecurity';
import { NETWORK_SECURITY_QUIZ } from './quizContent/networkSecurity';
import { SYSTEM_SECURITY_QUIZ } from './quizContent/systemSecurity';
import { SOCIAL_ENGINEERING_QUIZ } from './quizContent/socialEngineering';
import { CRYPTOGRAPHY_QUIZ } from './quizContent/cryptography';
import type { QuizModuleSeed, QuizQuestionSeed } from './quizContent/quizContentType';
import { WEB_SECURITY_CASE_STUDIES } from './practiceContent/webSecurity';
import { NETWORK_SECURITY_CASE_STUDIES } from './practiceContent/networkSecurity';
import { SYSTEM_SECURITY_CASE_STUDIES } from './practiceContent/systemSecurity';
import { SOCIAL_ENGINEERING_CASE_STUDIES } from './practiceContent/socialEngineering';
import { CRYPTOGRAPHY_CASE_STUDIES } from './practiceContent/cryptography';
import type { CaseStudySeed } from './practiceContent/caseStudyType';
import { findOverlaps } from './practiceDedupe';
import { checkOptionBalance, validateQuestionStructure, type OptionKey } from './practiceQuality';

const prisma = new PrismaClient();

const QUESTIONS_PER_POOL = 50;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

// Module names match Scenario.category exactly — the single source of
// truth for what a "module" is (see GET /api/scenarios/categories).
const QUIZ_BY_MODULE: Record<string, QuizModuleSeed> = {
  'Web Security': WEB_SECURITY_QUIZ,
  'Network Security': NETWORK_SECURITY_QUIZ,
  'System Security': SYSTEM_SECURITY_QUIZ,
  'Social Engineering': SOCIAL_ENGINEERING_QUIZ,
  'Cryptography': CRYPTOGRAPHY_QUIZ,
};

const PRACTICE_CASE_STUDIES_BY_MODULE: Record<string, CaseStudySeed[]> = {
  'Web Security': WEB_SECURITY_CASE_STUDIES,
  'Network Security': NETWORK_SECURITY_CASE_STUDIES,
  'System Security': SYSTEM_SECURITY_CASE_STUDIES,
  'Social Engineering': SOCIAL_ENGINEERING_CASE_STUDIES,
  'Cryptography': CRYPTOGRAPHY_CASE_STUDIES,
};

function validateShape(module: string, quiz: QuizModuleSeed) {
  const seenIds = new Set<string>();
  for (const difficulty of DIFFICULTIES) {
    const questions = quiz[difficulty];
    if (questions.length !== QUESTIONS_PER_POOL) {
      throw new Error(`Module "${module}" difficulty "${difficulty}" has ${questions.length} questions, expected exactly ${QUESTIONS_PER_POOL}.`);
    }
    const seenInPool = new Set<string>();
    for (const q of questions) {
      if (q.moduleTag !== module) {
        throw new Error(`Question "${q.questionId}" has moduleTag "${q.moduleTag}", expected "${module}".`);
      }
      if (q.difficulty !== difficulty) {
        throw new Error(`Question "${q.questionId}" has difficulty "${q.difficulty}", expected "${difficulty}".`);
      }
      const problems = validateQuestionStructure(q);
      if (problems.length > 0) {
        throw new Error(`Structure problem in "${module}" / ${difficulty} (${q.questionId}): ${problems.join('; ')}`);
      }
      const balanceIssue = checkOptionBalance(q);
      if (balanceIssue) {
        throw new Error(
          `Option-balance problem in "${module}" / ${difficulty} (${q.questionId}): "${balanceIssue.question}" — correct option is ${balanceIssue.ratio}x the average distractor length.`
        );
      }
      if (seenIds.has(q.questionId)) {
        throw new Error(`Duplicate questionId "${q.questionId}" in module "${module}".`);
      }
      seenIds.add(q.questionId);
      const norm = q.question.trim().toLowerCase();
      if (seenInPool.has(norm)) {
        throw new Error(`Duplicate question text within "${module}" / ${difficulty}: "${q.question}"`);
      }
      seenInPool.add(norm);
    }
  }
}

// Reverse direction of seedPractice.ts's validateNoQuizOverlap — the quiz
// bank must also never overlap the Practice Labs bank, checked per module.
function validateNoPracticeOverlap(module: string, quiz: QuizModuleSeed) {
  const practiceCaseStudies = PRACTICE_CASE_STUDIES_BY_MODULE[module] ?? [];
  const existingPracticeQuestions = practiceCaseStudies.flatMap((cs, csIdx) =>
    cs.pools.flatMap((pool, poolIdx) =>
      pool.questions.map((q, qIdx) => ({
        question: q.question,
        moduleTag: module,
        questionId: `practice-${csIdx}-${poolIdx}-${qIdx}`,
      }))
    )
  );
  const candidates = DIFFICULTIES.flatMap((difficulty) => quiz[difficulty].map((q) => ({ question: q.question, module })));
  const overlaps = findOverlaps(candidates, existingPracticeQuestions);
  if (overlaps.length > 0) {
    const details = overlaps.map((o) => `  "${o.question}" ~= "${o.matchedAgainst}"`).join('\n');
    throw new Error(`Found ${overlaps.length} quiz question(s) in "${module}" too similar to an existing Practice Lab question:\n${details}`);
  }
}

const LETTERS: OptionKey[] = ['A', 'B', 'C', 'D'];

// Reassigns which option text sits at which letter so the correct answer
// lands at `targetLetter`, without changing the set of four option texts or
// which one is correct. Distractors keep their relative order in whatever
// letters remain.
function redistributeQuestion(q: QuizQuestionSeed, targetLetter: OptionKey): QuizQuestionSeed {
  const options: Record<OptionKey, string> = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
  const correctText = options[q.correctOption];
  const distractorTexts = LETTERS.filter((l) => l !== q.correctOption).map((l) => options[l]);

  const newOptions: Record<OptionKey, string> = { A: '', B: '', C: '', D: '' };
  newOptions[targetLetter] = correctText;
  const remainingLetters = LETTERS.filter((l) => l !== targetLetter);
  remainingLetters.forEach((letter, i) => {
    newOptions[letter] = distractorTexts[i];
  });

  return {
    ...q,
    optionA: newOptions.A,
    optionB: newOptions.B,
    optionC: newOptions.C,
    optionD: newOptions.D,
    correctOption: targetLetter,
  };
}

// Round-robins A/B/C/D across each pool's 50 questions (as evenly as
// possible — 13/13/12/12), guaranteeing the answer-position band
// requirement regardless of how the letters landed during authoring.
// quizEngine.ts randomly samples 8-of-50 per attempt, so this pool-level
// pattern is never learner-visible.
function redistributePool(questions: QuizQuestionSeed[]): QuizQuestionSeed[] {
  return questions.map((q, i) => redistributeQuestion(q, LETTERS[i % 4]));
}

async function main() {
  const modules = Object.keys(QUIZ_BY_MODULE);
  console.log(`Validating ${modules.length} modules...`);

  for (const [module, quiz] of Object.entries(QUIZ_BY_MODULE)) {
    validateShape(module, quiz);
    validateNoPracticeOverlap(module, quiz);
  }

  const totalQuestions = modules.length * DIFFICULTIES.length * QUESTIONS_PER_POOL;
  console.log(
    `Validation passed — ${modules.length} modules x ${DIFFICULTIES.length} difficulties x ${QUESTIONS_PER_POOL} questions = ${totalQuestions} total.`
  );

  console.log('Clearing prior quiz data...');
  await prisma.quizResponse.deleteMany({});
  await prisma.quizAttempt.deleteMany({});
  await prisma.question.deleteMany({});

  console.log('Importing questions...');
  for (const [module, quiz] of Object.entries(QUIZ_BY_MODULE)) {
    for (const difficulty of DIFFICULTIES) {
      const redistributed = redistributePool(quiz[difficulty]);
      await prisma.question.createMany({
        data: redistributed.map((q) => ({
          questionId: q.questionId,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          topic: q.topic,
          moduleTag: q.moduleTag,
          topicTag: q.topicTag,
          difficulty: q.difficulty,
          explanation: q.explanation,
          isActive: q.isActive,
        })),
      });
    }
    console.log(`  ${module}: ${DIFFICULTIES.length * QUESTIONS_PER_POOL} questions imported.`);
  }

  const questionCount = await prisma.question.count();
  const byModuleDifficulty = await prisma.question.groupBy({ by: ['moduleTag', 'difficulty'], _count: true });
  console.log(`Import complete. Questions: ${questionCount}.`);
  console.log(byModuleDifficulty.map((m) => `  ${m.moduleTag} / ${m.difficulty}: ${m._count}`).join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
