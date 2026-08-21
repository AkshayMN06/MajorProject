import { describe, it, expect } from 'vitest';
import { WEB_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/webSecurity';
import { NETWORK_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/networkSecurity';
import { SYSTEM_SECURITY_CASE_STUDIES } from '../../prisma/practiceContent/systemSecurity';
import { SOCIAL_ENGINEERING_CASE_STUDIES } from '../../prisma/practiceContent/socialEngineering';
import { CRYPTOGRAPHY_CASE_STUDIES } from '../../prisma/practiceContent/cryptography';
import type { CaseStudySeed } from '../../prisma/practiceContent/caseStudyType';
import { WEB_SECURITY_QUIZ } from '../../prisma/quizContent/webSecurity';
import { NETWORK_SECURITY_QUIZ } from '../../prisma/quizContent/networkSecurity';
import { SYSTEM_SECURITY_QUIZ } from '../../prisma/quizContent/systemSecurity';
import { SOCIAL_ENGINEERING_QUIZ } from '../../prisma/quizContent/socialEngineering';
import { CRYPTOGRAPHY_QUIZ } from '../../prisma/quizContent/cryptography';
import type { QuizModuleSeed } from '../../prisma/quizContent/quizContentType';
import { findOverlaps } from '../../prisma/practiceDedupe';
import { checkOptionBalance, validateQuestionStructure } from '../../prisma/practiceQuality';

const QUIZ_BY_MODULE: Record<string, QuizModuleSeed> = {
  'Web Security': WEB_SECURITY_QUIZ,
  'Network Security': NETWORK_SECURITY_QUIZ,
  'System Security': SYSTEM_SECURITY_QUIZ,
  'Social Engineering': SOCIAL_ENGINEERING_QUIZ,
  'Cryptography': CRYPTOGRAPHY_QUIZ,
};

const SCENARIO_MODULES = ['Web Security', 'Network Security', 'System Security', 'Social Engineering', 'Cryptography'];

const CASE_STUDIES_BY_MODULE: Record<string, CaseStudySeed[]> = {
  'Web Security': WEB_SECURITY_CASE_STUDIES,
  'Network Security': NETWORK_SECURITY_CASE_STUDIES,
  'System Security': SYSTEM_SECURITY_CASE_STUDIES,
  'Social Engineering': SOCIAL_ENGINEERING_CASE_STUDIES,
  'Cryptography': CRYPTOGRAPHY_CASE_STUDIES,
};

const CASE_STUDIES_PER_MODULE = 6;
const POOLS_PER_CASE_STUDY = 4;
const QUESTIONS_PER_POOL = 12;

describe('Practice Labs case-study question content', () => {
  it('has exactly the 5 live Scenario Assessment modules, no more, no fewer', () => {
    expect(Object.keys(CASE_STUDIES_BY_MODULE).sort()).toEqual([...SCENARIO_MODULES].sort());
  });

  for (const module of SCENARIO_MODULES) {
    describe(`module: ${module}`, () => {
      const caseStudies = CASE_STUDIES_BY_MODULE[module];

      it(`has exactly ${CASE_STUDIES_PER_MODULE} case studies`, () => {
        expect(caseStudies).toHaveLength(CASE_STUDIES_PER_MODULE);
      });

      it('every case study has a non-empty title and description', () => {
        for (const cs of caseStudies) {
          expect(cs.title.trim().length).toBeGreaterThan(0);
          expect(cs.description.trim().length).toBeGreaterThan(0);
        }
      });

      it(`every case study has exactly ${POOLS_PER_CASE_STUDY} question pools`, () => {
        for (const cs of caseStudies) {
          expect(cs.pools).toHaveLength(POOLS_PER_CASE_STUDY);
        }
      });

      it(`every pool has exactly ${QUESTIONS_PER_POOL} questions`, () => {
        for (const cs of caseStudies) {
          for (const pool of cs.pools) {
            expect(pool.questions).toHaveLength(QUESTIONS_PER_POOL);
          }
        }
      });

      it('every question has exactly 4 non-empty options, a valid correctOption, and a non-empty explanation', () => {
        for (const cs of caseStudies) {
          for (const pool of cs.pools) {
            for (const q of pool.questions) {
              expect(validateQuestionStructure(q)).toEqual([]);
            }
          }
        }
      });

      it('every question has concept metadata of attacker, defender, or both', () => {
        for (const cs of caseStudies) {
          for (const pool of cs.pools) {
            for (const q of pool.questions) {
              expect(['attacker', 'defender', 'both']).toContain(q.concept);
            }
          }
        }
      });

      it("no question's correct option is a length-based giveaway over the distractors", () => {
        for (const cs of caseStudies) {
          for (const pool of cs.pools) {
            for (const q of pool.questions) {
              expect(checkOptionBalance(q)).toBeNull();
            }
          }
        }
      });

      it('has no duplicate question text within any single case study', () => {
        for (const cs of caseStudies) {
          const seen = new Set<string>();
          for (const pool of cs.pools) {
            for (const q of pool.questions) {
              const norm = q.question.trim().toLowerCase();
              expect(seen.has(norm)).toBe(false);
              seen.add(norm);
            }
          }
        }
      });

      it(`totals exactly ${CASE_STUDIES_PER_MODULE * POOLS_PER_CASE_STUDY * QUESTIONS_PER_POOL} questions for this module`, () => {
        const total = caseStudies.reduce((sum, cs) => sum + cs.pools.reduce((s, p) => s + p.questions.length, 0), 0);
        expect(total).toBe(CASE_STUDIES_PER_MODULE * POOLS_PER_CASE_STUDY * QUESTIONS_PER_POOL);
      });

      it('contains zero questions that exactly or near-duplicate an existing Pre/Post-test quiz question in this module', () => {
        const quiz = QUIZ_BY_MODULE[module];
        const existing = (['Easy', 'Medium', 'Hard'] as const).flatMap((difficulty) =>
          quiz[difficulty].map((q) => ({ question: q.question, moduleTag: q.moduleTag, questionId: q.questionId }))
        );
        const candidates = caseStudies.flatMap((cs) =>
          cs.pools.flatMap((pool) => pool.questions.map((q) => ({ question: q.question, module })))
        );
        const overlaps = findOverlaps(candidates, existing);
        expect(overlaps).toEqual([]);
      });
    });
  }

  it('totals exactly 1,440 questions across all modules (5 x 6 x 4 x 12, not hard-coded)', () => {
    const total = Object.values(CASE_STUDIES_BY_MODULE).reduce(
      (sum, caseStudies) => sum + caseStudies.reduce((s, cs) => s + cs.pools.reduce((s2, p) => s2 + p.questions.length, 0), 0),
      0
    );
    expect(total).toBe(SCENARIO_MODULES.length * CASE_STUDIES_PER_MODULE * POOLS_PER_CASE_STUDY * QUESTIONS_PER_POOL);
  });

  it('has 30 case studies and 120 question pools in total', () => {
    const allCaseStudies = Object.values(CASE_STUDIES_BY_MODULE).flat();
    expect(allCaseStudies).toHaveLength(30);
    const allPools = allCaseStudies.flatMap((cs) => cs.pools);
    expect(allPools).toHaveLength(120);
  });
});
