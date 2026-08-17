import { DEFINITION_QUESTIONS } from './quizDefinitionQuestions';
import { APPLICATION_QUESTIONS } from './quizApplicationQuestions';
import type { QuizQuestionSeed } from './quizQuestionTypes';

export type { QuizQuestionSeed };

// 25 definition questions (derived from the existing draft glossary CSV) +
// 12 application questions (hand-authored, each verified against a real
// seeded scenario/attack/defense pairing) = 37 total, split across two
// parallel forms (PRE_A / POST_B) so the post-test isn't just the same
// questions repeated.
export const QUIZ_QUESTIONS: QuizQuestionSeed[] = [
  ...DEFINITION_QUESTIONS,
  ...APPLICATION_QUESTIONS,
];
