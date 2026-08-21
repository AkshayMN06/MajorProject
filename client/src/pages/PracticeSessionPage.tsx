import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, BookOpen, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { PracticeResultSummary } from '../components/labs/PracticeResultSummary';

export const PracticeSessionPage: React.FC = () => {
  const { module: encodedModule } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const module = decodeURIComponent(encodedModule ?? '');
  const [caseStudyExpanded, setCaseStudyExpanded] = useState(false);

  const { phase, caseStudy, questions, answers, selectAnswer, submit, result, error, answeredCount, allAnswered, beginQuestions, restart } =
    usePracticeSession(module);

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
    return <PracticeResultSummary result={result} onPracticeAgain={restart} />;
  }

  if (phase === 'caseStudy' && caseStudy) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center p-4 md:p-8">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4">
              <FileText className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="text-xs uppercase tracking-wider text-indigo-400 font-semibold mb-2">{module} — Case Study</p>
            <h1 className="text-3xl font-bold text-white mb-4">{caseStudy.title}</h1>
          </div>

          <div className="bg-[#0f1629]/80 border border-[#1e293b] rounded-2xl p-6">
            <p className="text-sm text-gray-300 leading-relaxed">{caseStudy.description}</p>
          </div>

          <p className="text-center text-xs text-gray-500">
            Read the scenario carefully — you'll answer 8 questions about it, and it stays available to review while you answer.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/labs')}
              className="flex-shrink-0 px-6 py-4 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800/50 transition-colors text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={beginQuestions}
              className="flex-1 py-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              Start Questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg-dark p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4">
            <BookOpen className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{module}</h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
            Practice questions covering both attack and defense concepts for this module.
          </p>
        </div>

        {caseStudy && (
          <div className="bg-[#0f1629]/80 border border-[#1e293b] rounded-xl overflow-hidden">
            <button
              onClick={() => setCaseStudyExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileText size={14} className="text-indigo-400" /> Case Study: {caseStudy.title}
              </span>
              {caseStudyExpanded ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>
            {caseStudyExpanded && (
              <div className="px-4 pb-4 text-sm text-gray-300 leading-relaxed border-t border-[#1e293b] pt-3">
                {caseStudy.description}
              </div>
            )}
          </div>
        )}

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

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/labs')}
            className="flex-shrink-0 px-6 py-4 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800/50 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!allAnswered || phase === 'submitting'}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:shadow-none"
          >
            {phase === 'submitting' ? (
              <><Loader2 size={16} className="animate-spin" /> Submitting...</>
            ) : allAnswered ? (
              'Submit Practice'
            ) : (
              `Answer all questions to submit (${answeredCount}/${questions.length})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeSessionPage;
