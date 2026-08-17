import { useEffect, useState, useCallback } from 'react';
import { quizApi } from '../services/api';
import type { QuizQuestion, QuizResult, QuizTestType } from '../services/api';

export type QuizFlowPhase = 'loading' | 'taking' | 'submitting' | 'result' | 'error';

/**
 * Shared fetch/answer/submit logic for the Pre-test and Post-test pages.
 * If the learner already has a completed attempt for this testType, skips
 * straight to its result instead of making them retake it.
 */
export function useQuizFlow(testType: QuizTestType) {
  const [phase, setPhase] = useState<QuizFlowPhase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { questions: qs, completedAttempt } = await quizApi.getQuestions(testType);
        if (cancelled) return;

        if (completedAttempt) {
          const fullResult = await quizApi.getResult(completedAttempt.id);
          if (cancelled) return;
          setResult(fullResult);
          setPhase('result');
          return;
        }

        const { attemptId: newAttemptId } = await quizApi.start(testType);
        if (cancelled) return;
        setQuestions(qs);
        setAttemptId(newAttemptId);
        setPhase('taking');
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error ?? err.message ?? 'Failed to load the test.');
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [testType]);

  const selectAnswer = useCallback((questionId: string, option: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const submit = useCallback(async () => {
    if (!attemptId) return;
    setPhase('submitting');
    setError(null);
    try {
      const responses = Object.entries(answers).map(([questionId, selectedOption]) => ({ questionId, selectedOption }));
      await quizApi.submit(attemptId, responses);
      const fullResult = await quizApi.getResult(attemptId);
      setResult(fullResult);
      setPhase('result');
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to submit the test.');
      setPhase('taking');
    }
  }, [attemptId, answers]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  return { phase, questions, answers, selectAnswer, submit, result, error, answeredCount, allAnswered };
}
