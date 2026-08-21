export interface PracticeQuestionSeed {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  topicTag: string;
  concept: 'attacker' | 'defender' | 'both';
  difficulty: 'Easy' | 'Medium';
}

export interface CaseStudyPoolSeed {
  name: string; // the angle this pool tests, e.g. "Identification"
  questions: PracticeQuestionSeed[];
}

export interface CaseStudySeed {
  title: string;
  description: string;
  pools: CaseStudyPoolSeed[]; // 4 pools, 12 questions each
}
