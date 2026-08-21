export interface QuizQuestionSeed {
  questionId: string; // stable external id, e.g. "web-easy-7"
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  topic: string;
  moduleTag: string;
  topicTag: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  explanation: string;
  isActive: boolean;
}

// Exactly 50 questions per difficulty tier — 150 per module file, 750 total
// across all 5 modules.
export interface QuizModuleSeed {
  Easy: QuizQuestionSeed[];
  Medium: QuizQuestionSeed[];
  Hard: QuizQuestionSeed[];
}
