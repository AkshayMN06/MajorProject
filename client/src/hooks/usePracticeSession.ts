import { useEffect, useState, useCallback } from 'react';
import { practiceApi } from '../services/api';
import type { PracticeResult, PracticeCaseStudy } from '../services/api';
import type { QuizQuestion } from '../services/api';

export type PracticeFlowPhase = 'loading' | 'caseStudy' | 'taking' | 'submitting' | 'result' | 'error';

/**
 * Mirrors useQuizFlow's fetch/answer/submit phase machine, against
 * practiceApi instead of quizApi. A fresh session (one case study, 8 random
 * questions from one of its pools) is started every time this hook mounts
 * for a module — unlike the Pre/Post quiz, Practice Labs has no notion of
 * "already completed, show that result instead"; every visit is a new
 * practice attempt. The case study is shown first (`caseStudy` phase) before
 * the learner opts into the question phase (`taking`) via beginQuestions().
 */
export function usePracticeSession(module: string) {
  const [phase, setPhase] = useState<PracticeFlowPhase>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [caseStudy, setCaseStudy] = useState<PracticeCaseStudy | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    setAnswers({});
    setResult(null);
    setError(null);
    (async () => {
      try {
        const { sessionId: newSessionId, caseStudy: newCaseStudy, questions: qs } = await practiceApi.startSession(module);
        if (cancelled) return;
        // Adapted to QuizQuestion's shape so QuizQuestionCard can render it unmodified.
        setQuestions(
          qs.map((q) => ({
            id: q.id,
            questionId: q.id,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            topic: q.topicTag,
            moduleTag: module,
            topicTag: q.topicTag,
            difficulty: q.difficulty,
          }))
        );
        setSessionId(newSessionId);
        setCaseStudy(newCaseStudy);
        setPhase('caseStudy');
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error ?? err.message ?? 'Failed to start the practice session.');
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [module]);

  useEffect(() => start(), [start]);

  const beginQuestions = useCallback(() => {
    setPhase('taking');
  }, []);

  const selectAnswer = useCallback((questionId: string, option: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const submit = useCallback(async () => {
    if (!sessionId) return;
    setPhase('submitting');
    setError(null);
    try {
      const responses = Object.entries(answers).map(([questionId, selectedOption]) => ({ questionId, selectedOption }));
      const fullResult = await practiceApi.submitSession(sessionId, responses);
      setResult(fullResult);
      setPhase('result');
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to submit the practice session.');
      setPhase('taking');
    }
  }, [sessionId, answers]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  return { phase, caseStudy, questions, answers, selectAnswer, submit, result, error, answeredCount, allAnswered, beginQuestions, restart: start };
}
