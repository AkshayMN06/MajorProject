export interface QuizQuestionSeed {
  questionId: string;
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
  testForm: 'PRE_A' | 'POST_B';
  explanation: string;
  isActive: boolean;
}
