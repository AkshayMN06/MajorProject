import { useEffect, useState, useCallback } from 'react';
import { quizApi } from '../services/api';
import type { QuizQuestion, QuizResult, QuizTestType } from '../services/api';

export type QuizFlowPhase = 'loading' | 'taking' | 'submitting' | 'result' | 'error';

/**
 * Shared fetch/answer/submit logic for the Pre-test and Post-test pages,
 * scoped to one Scenario Assessment session's attempt. Three cases on load:
 *  - a completed attempt already exists for this (session, testType) -> skip
 *    straight to its result instead of making the learner retake it.
 *  - an in-progress attempt already exists (e.g. the page was refreshed
 *    mid-test) -> resume directly into 'taking' with its already-selected
 *    questions, WITHOUT calling start() again (that would be the duplicate
 *    bug this hook exists to avoid).
 *  - no attempt exists yet -> call start() to select questions and create one.
 */
export function useQuizFlow(testType: QuizTestType, sessionId: string | null) {
  const [phase, setPhase] = useState<QuizFlowPhase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No active session to attach this test to.');
      setPhase('error');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { existingAttempt, questions: qs } = await quizApi.getQuestions(testType, sessionId);
        if (cancelled) return;

        if (existingAttempt?.status === 'completed') {
          const fullResult = await quizApi.getResult(existingAttempt.id);
          if (cancelled) return;
          setResult(fullResult);
          setPhase('result');
          return;
        }

        if (existingAttempt?.status === 'in_progress') {
          setQuestions(qs);
          setAttemptId(existingAttempt.id);
          setPhase('taking');
          return;
        }

        const { attemptId: newAttemptId, questions: newQs } = await quizApi.start(testType, sessionId);
        if (cancelled) return;
        setQuestions(newQs);
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
  }, [testType, sessionId]);

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
