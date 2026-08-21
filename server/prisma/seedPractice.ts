// Seeds Practice Labs (CaseStudy -> PracticeQuestionPool -> PracticeQuestion)
// for all 5 modules. Validates every module thoroughly before writing
// anything to the database:
//   - exactly 6 case studies per module
//   - exactly 4 question pools per case study
//   - exactly 12 questions per pool (1,440 questions total)
//   - structural validity of every question (validateQuestionStructure)
//   - no question's correct option is a length-based giveaway (checkOptionBalance)
//   - no duplicate question text within a case study
//   - zero overlap with the existing Pre/Post-test quiz bank (practiceDedupe.ts)
// A single violation anywhere fails the whole seed loudly rather than
// silently importing bad content.
//
// After validation passes, every question pool's correct-answer letter is
// mechanically redistributed via round-robin (A/B/C/D, 3 of each per
// 12-question pool) — this guarantees the answer-position band requirement
// exactly, regardless of how the letters landed while the content was
// authored. Sessions already shuffle which 8 of 12 questions are chosen and
// their presentation order (see practiceEngine.ts), so this pool-level
// pattern is never visible to a learner.
//
// Dev-only content with no stable external id, so re-running clears prior
// case_studies/practice_question_pools/practice_questions rows (and, since
// they reference these, any PracticeSession/PracticeResponse rows) before
// reinserting — safe and idempotent.
import { PrismaClient } from '@prisma/client';
import { WEB_SECURITY_CASE_STUDIES } from './practiceContent/webSecurity';
import { NETWORK_SECURITY_CASE_STUDIES } from './practiceContent/networkSecurity';
import { SYSTEM_SECURITY_CASE_STUDIES } from './practiceContent/systemSecurity';
import { SOCIAL_ENGINEERING_CASE_STUDIES } from './practiceContent/socialEngineering';
import { CRYPTOGRAPHY_CASE_STUDIES } from './practiceContent/cryptography';
import type { CaseStudySeed, PracticeQuestionSeed } from './practiceContent/caseStudyType';
import { WEB_SECURITY_QUIZ } from './quizContent/webSecurity';
import { NETWORK_SECURITY_QUIZ } from './quizContent/networkSecurity';
import { SYSTEM_SECURITY_QUIZ } from './quizContent/systemSecurity';
import { SOCIAL_ENGINEERING_QUIZ } from './quizContent/socialEngineering';
import { CRYPTOGRAPHY_QUIZ } from './quizContent/cryptography';
import type { QuizModuleSeed } from './quizContent/quizContentType';
import { findOverlaps } from './practiceDedupe';
import { checkOptionBalance, validateQuestionStructure, type OptionKey } from './practiceQuality';

const prisma = new PrismaClient();

const CASE_STUDIES_PER_MODULE = 6;
const POOLS_PER_CASE_STUDY = 4;
const QUESTIONS_PER_POOL = 12;

// Module names match Scenario.category exactly — the single source of
// truth for what a "module" is (see GET /api/scenarios/categories).
const CASE_STUDIES_BY_MODULE: Record<string, CaseStudySeed[]> = {
  'Web Security': WEB_SECURITY_CASE_STUDIES,
  'Network Security': NETWORK_SECURITY_CASE_STUDIES,
  'System Security': SYSTEM_SECURITY_CASE_STUDIES,
  'Social Engineering': SOCIAL_ENGINEERING_CASE_STUDIES,
  'Cryptography': CRYPTOGRAPHY_CASE_STUDIES,
};

function validateShape(module: string, caseStudies: CaseStudySeed[]) {
  if (caseStudies.length !== CASE_STUDIES_PER_MODULE) {
    throw new Error(`Module "${module}" has ${caseStudies.length} case studies, expected exactly ${CASE_STUDIES_PER_MODULE}.`);
  }
  for (const cs of caseStudies) {
    if (cs.pools.length !== POOLS_PER_CASE_STUDY) {
      throw new Error(`Case study "${cs.title}" (${module}) has ${cs.pools.length} pools, expected exactly ${POOLS_PER_CASE_STUDY}.`);
    }
    const seenInCaseStudy = new Set<string>();
    for (const pool of cs.pools) {
      if (pool.questions.length !== QUESTIONS_PER_POOL) {
        throw new Error(`Pool "${pool.name}" in "${cs.title}" (${module}) has ${pool.questions.length} questions, expected exactly ${QUESTIONS_PER_POOL}.`);
      }
      for (const q of pool.questions) {
        const problems = validateQuestionStructure(q);
        if (problems.length > 0) {
          throw new Error(`Structure problem in "${cs.title}" / "${pool.name}" (${module}): ${problems.join('; ')}`);
        }
        const balanceIssue = checkOptionBalance(q);
        if (balanceIssue) {
          throw new Error(
            `Option-balance problem in "${cs.title}" / "${pool.name}" (${module}): "${balanceIssue.question}" — correct option is ${balanceIssue.ratio}x the average distractor length.`
          );
        }
        const norm = q.question.trim().toLowerCase();
        if (seenInCaseStudy.has(norm)) {
          throw new Error(`Duplicate question text within case study "${cs.title}" (${module}): "${q.question}"`);
        }
        seenInCaseStudy.add(norm);
      }
    }
  }
}

const QUIZ_BY_MODULE: Record<string, QuizModuleSeed> = {
  'Web Security': WEB_SECURITY_QUIZ,
  'Network Security': NETWORK_SECURITY_QUIZ,
  'System Security': SYSTEM_SECURITY_QUIZ,
  'Social Engineering': SOCIAL_ENGINEERING_QUIZ,
  'Cryptography': CRYPTOGRAPHY_QUIZ,
};

function validateNoQuizOverlap(module: string, caseStudies: CaseStudySeed[]) {
  const quiz = QUIZ_BY_MODULE[module];
  const existingQuizQuestions = (['Easy', 'Medium', 'Hard'] as const).flatMap((difficulty) =>
    quiz[difficulty].map((q) => ({ question: q.question, moduleTag: q.moduleTag, questionId: q.questionId }))
  );
  const candidates = caseStudies.flatMap((cs) => cs.pools.flatMap((pool) => pool.questions.map((q) => ({ question: q.question, module }))));
  const overlaps = findOverlaps(candidates, existingQuizQuestions);
  if (overlaps.length > 0) {
    const details = overlaps.map((o) => `  "${o.question}" ~= "${o.matchedAgainst}" (${o.source})`).join('\n');
    throw new Error(`Found ${overlaps.length} Practice question(s) in "${module}" too similar to an existing quiz question:\n${details}`);
  }
}

const LETTERS: OptionKey[] = ['A', 'B', 'C', 'D'];

// Reassigns which option text sits at which letter so the correct answer
// lands at `targetLetter`, without changing the set of four option texts or
// which one is correct. Distractors keep their relative order in whatever
// letters remain.
function redistributeQuestion(q: PracticeQuestionSeed, targetLetter: OptionKey): PracticeQuestionSeed {
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

// Round-robins A/B/C/D across each pool's 12 questions (3 of each letter),
// guaranteeing the answer-position band regardless of authoring-time
// distribution. Presentation order to learners is randomized separately by
// practiceEngine.ts, so this pool-level pattern is never learner-visible.
function redistributePool(questions: PracticeQuestionSeed[]): PracticeQuestionSeed[] {
  return questions.map((q, i) => redistributeQuestion(q, LETTERS[i % 4]));
}

async function main() {
  const modules = Object.keys(CASE_STUDIES_BY_MODULE);
  console.log(`Validating ${modules.length} modules...`);

  for (const [module, caseStudies] of Object.entries(CASE_STUDIES_BY_MODULE)) {
    validateShape(module, caseStudies);
    validateNoQuizOverlap(module, caseStudies);
  }

  const totalQuestions = modules.length * CASE_STUDIES_PER_MODULE * POOLS_PER_CASE_STUDY * QUESTIONS_PER_POOL;
  console.log(
    `Validation passed — ${modules.length} modules x ${CASE_STUDIES_PER_MODULE} case studies x ${POOLS_PER_CASE_STUDY} pools x ${QUESTIONS_PER_POOL} questions = ${totalQuestions} total.`
  );

  console.log('Clearing prior Practice Labs data...');
  await prisma.practiceResponse.deleteMany({});
  await prisma.practiceSession.deleteMany({});
  await prisma.practiceQuestion.deleteMany({});
  await prisma.practiceQuestionPool.deleteMany({});
  await prisma.caseStudy.deleteMany({});

  console.log('Importing case studies, pools, and questions...');
  for (const [module, caseStudies] of Object.entries(CASE_STUDIES_BY_MODULE)) {
    for (const cs of caseStudies) {
      const caseStudy = await prisma.caseStudy.create({
        data: { module, title: cs.title, description: cs.description },
      });

      for (const pool of cs.pools) {
        const createdPool = await prisma.practiceQuestionPool.create({
          data: { caseStudyId: caseStudy.id, name: pool.name },
        });

        const redistributed = redistributePool(pool.questions);
        await prisma.practiceQuestion.createMany({
          data: redistributed.map((q) => ({
            poolId: createdPool.id,
            module,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            explanation: q.explanation,
            topicTag: q.topicTag,
            concept: q.concept,
            difficulty: q.difficulty,
          })),
        });
      }
    }
    console.log(`  ${module}: ${caseStudies.length} case studies imported.`);
  }

  const caseStudyCount = await prisma.caseStudy.count();
  const poolCount = await prisma.practiceQuestionPool.count();
  const questionCount = await prisma.practiceQuestion.count();
  const byModule = await prisma.practiceQuestion.groupBy({ by: ['module'], _count: true });
  console.log(
    `Import complete. Case studies: ${caseStudyCount}, pools: ${poolCount}, questions: ${questionCount}.`
  );
  console.log(byModule.map((m) => `  ${m.module}: ${m._count}`).join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
