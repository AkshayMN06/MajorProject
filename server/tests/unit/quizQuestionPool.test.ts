import { describe, it, expect } from 'vitest';
import { WEB_SECURITY_QUIZ } from '../../prisma/quizContent/webSecurity';
import { NETWORK_SECURITY_QUIZ } from '../../prisma/quizContent/networkSecurity';
import { SYSTEM_SECURITY_QUIZ } from '../../prisma/quizContent/systemSecurity';
import { SOCIAL_ENGINEERING_QUIZ } from '../../prisma/quizContent/socialEngineering';
import { CRYPTOGRAPHY_QUIZ } from '../../prisma/quizContent/cryptography';
import type { QuizModuleSeed } from '../../prisma/quizContent/quizContentType';
import { WEB_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/webSecurity';
import { NETWORK_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/networkSecurity';
import { SYSTEM_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/systemSecurity';
import { SOCIAL_ENGINEERING_CASE_STUDIES } from '../../prisma/practiceContent/socialEngineering';
import { CRYPTOGRAPHY_CASE_STUDIES } from '../../prisma/practiceContent/cryptography';
import type { CaseStudySeed } from '../../prisma/practiceContent/caseStudyType';
import { findOverlaps } from '../../prisma/practiceDedupe';
import { checkOptionBalance, validateQuestionStructure } from '../../prisma/practiceQuality';

const SCENARIO_MODULES = ['Web Security', 'Network Security', 'System Security', 'Social Engineering', 'Cryptography'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
const QUESTIONS_PER_POOL = 50;

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

describe('Pre/Post-test quiz question bank content', () => {
  it('has exactly the 5 live Scenario Assessment modules, no more, no fewer', () => {
    expect(Object.keys(QUIZ_BY_MODULE).sort()).toEqual([...SCENARIO_MODULES].sort());
  });

  for (const module of SCENARIO_MODULES) {
    describe(`module: ${module}`, () => {
      const quiz = QUIZ_BY_MODULE[module];

      for (const difficulty of DIFFICULTIES) {
        describe(`difficulty: ${difficulty}`, () => {
          it(`has exactly ${QUESTIONS_PER_POOL} questions`, () => {
            expect(quiz[difficulty]).toHaveLength(QUESTIONS_PER_POOL);
          });

          it('every question is tagged with this exact module and difficulty', () => {
            for (const q of quiz[difficulty]) {
              expect(q.moduleTag).toBe(module);
              expect(q.difficulty).toBe(difficulty);
            }
          });

          it('every question has exactly 4 non-empty options, a valid correctOption, and a non-empty explanation', () => {
            for (const q of quiz[difficulty]) {
              expect(validateQuestionStructure(q)).toEqual([]);
            }
          });

          it("no question's correct option is a length-based giveaway over the distractors", () => {
            for (const q of quiz[difficulty]) {
              expect(checkOptionBalance(q)).toBeNull();
            }
          });

          it('has no duplicate question text within this (module, difficulty) pool', () => {
            const seen = new Set<string>();
            for (const q of quiz[difficulty]) {
              const norm = q.question.trim().toLowerCase();
              expect(seen.has(norm)).toBe(false);
              seen.add(norm);
            }
          });

          it('has no duplicate questionId within this (module, difficulty) pool', () => {
            const ids = quiz[difficulty].map((q) => q.questionId);
            expect(new Set(ids).size).toBe(ids.length);
          });
        });
      }

      it(`totals exactly ${DIFFICULTIES.length * QUESTIONS_PER_POOL} questions across all 3 difficulties for this module`, () => {
        const total = DIFFICULTIES.reduce((sum, d) => sum + quiz[d].length, 0);
        expect(total).toBe(DIFFICULTIES.length * QUESTIONS_PER_POOL);
      });

      it('has zero questionId collisions across its own 3 difficulty tiers', () => {
        const allIds = DIFFICULTIES.flatMap((d) => quiz[d].map((q) => q.questionId));
        expect(new Set(allIds).size).toBe(allIds.length);
      });

      it('contains zero questions that exactly or near-duplicate an existing Practice Lab question in this module (reverse-direction dedupe)', () => {
        const practiceCaseStudies = PRACTICE_CASE_STUDIES_BY_MODULE[module];
        const existing = practiceCaseStudies.flatMap((cs, csIdx) =>
          cs.pools.flatMap((pool, poolIdx) =>
            pool.questions.map((q, qIdx) => ({ question: q.question, moduleTag: module, questionId: `practice-${csIdx}-${poolIdx}-${qIdx}` }))
          )
        );
        const candidates = DIFFICULTIES.flatMap((difficulty) => quiz[difficulty].map((q) => ({ question: q.question, module })));
        const overlaps = findOverlaps(candidates, existing);
        expect(overlaps).toEqual([]);
      });
    });
  }

  it('totals exactly 750 questions across all modules (5 x 3 x 50, not hard-coded)', () => {
    const total = Object.values(QUIZ_BY_MODULE).reduce(
      (sum, quiz) => sum + DIFFICULTIES.reduce((s, d) => s + quiz[d].length, 0),
      0
    );
    expect(total).toBe(SCENARIO_MODULES.length * DIFFICULTIES.length * QUESTIONS_PER_POOL);
  });

  it('has zero questionId collisions across the entire 750-question bank', () => {
    const allIds = Object.values(QUIZ_BY_MODULE).flatMap((quiz) => DIFFICULTIES.flatMap((d) => quiz[d].map((q) => q.questionId)));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
