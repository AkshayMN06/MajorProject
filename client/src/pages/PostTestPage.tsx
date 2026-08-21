import React from 'react';
import { Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { useQuizFlow } from '../hooks/useQuizFlow';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { QuizResultSummary } from '../components/quiz/QuizResultSummary';

interface PostTestPageProps {
  /** The Scenario Assessment session this Post-test attempt belongs to. */
  sessionId: string | null;
  /** Rendered inline right after a Scenario Assessment completes, so the
   * Learning Summary's "continue" reveals the Assessment Report already
   * held in the parent's state rather than navigating away. */
  onComplete: () => void;
}

export const PostTestPage: React.FC<PostTestPageProps> = ({ sessionId, onComplete }) => {
  const { phase, questions, answers, selectAnswer, submit, result, error, answeredCount, allAnswered } =
    useQuizFlow('POST', sessionId);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center p-4">
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm px-5 py-4 rounded-xl max-w-md">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <QuizResultSummary
        title="Learning Summary"
        subtitle="Your knowledge after the Scenario Assessment. Compare this against your Pre-test to see what changed."
        result={result}
        onContinue={onComplete}
        continueLabel="View Assessment Report"
      />
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg-dark p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4">
            <GraduationCap className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Post-test</h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
            You've completed the Scenario Assessment — this short test measures what you've learned before your Learning Summary and report.
          </p>
        </div>

        <div className="sticky top-2 z-10 bg-[#0a0f1e]/95 backdrop-blur border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs text-gray-400 flex items-center justify-between">
          <span>{answeredCount} of {questions.length} answered</span>
          <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuizQuestionCard
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              selectedOption={answers[q.id] ?? null}
              onSelect={(option) => selectAnswer(q.id, option)}
            />
          ))}
        </div>

        <button
          onClick={submit}
          disabled={!allAnswered || phase === 'submitting'}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:shadow-none"
        >
          {phase === 'submitting' ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          ) : allAnswered ? (
            'Submit Post-test'
          ) : (
            `Answer all questions to submit (${answeredCount}/${questions.length})`
          )}
        </button>
      </div>
    </div>
  );
};

export default PostTestPage;
