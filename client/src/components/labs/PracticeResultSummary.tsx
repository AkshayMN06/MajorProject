import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, CheckCircle, XCircle, RotateCcw, ArrowLeft, Info } from 'lucide-react';
import type { PracticeResult } from '../../services/api';

interface PracticeResultSummaryProps {
  result: PracticeResult;
  onPracticeAgain: () => void;
}

export const PracticeResultSummary: React.FC<PracticeResultSummaryProps> = ({ result, onPracticeAgain }) => {
  const navigate = useNavigate();
  const percent = Math.round((result.score / result.totalQuestions) * 100);
  const incorrect = result.totalQuestions - result.score;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark p-4 md:p-8">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
        {/* Hero */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-8 text-center relative overflow-hidden"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <GraduationCap size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Practice Complete!</h1>
          <p className="text-gray-400 text-sm">{result.module}</p>
        </motion.div>

        {/* Score */}
        <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6 text-center">
          <p className="text-5xl font-bold text-white mb-1">
            {result.score}
            <span className="text-2xl text-gray-500">/{result.totalQuestions}</span>
          </p>
          <p className="text-sm text-gray-400 mb-4">{percent}% correct</p>
          <div className="flex justify-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-teal-400"><CheckCircle size={14} /> Correct: {result.score}</span>
            <span className="flex items-center gap-1.5 text-red-400"><XCircle size={14} /> Incorrect: {incorrect}</span>
          </div>
        </motion.div>

        {/* Analytics isolation notice */}
        <motion.div
          variants={itemVariants}
          className="flex items-start gap-3 bg-indigo-950/20 border border-indigo-500/20 text-indigo-200 text-xs px-4 py-3 rounded-xl"
        >
          <Info size={14} className="flex-shrink-0 mt-0.5 text-indigo-400" />
          <span>This practice session does not affect your assessment analytics, scores, or leaderboard — it's for learning only.</span>
        </motion.div>

        {/* Review */}
        <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Question Review</h3>
          <div className="space-y-4">
            {result.responses.map((r, i) => (
              <div
                key={r.questionId}
                className={`rounded-xl p-4 border ${
                  r.isCorrect ? 'bg-teal-950/10 border-teal-500/20' : 'bg-red-950/10 border-red-500/20'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {r.isCorrect ? (
                    <CheckCircle size={16} className="text-teal-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium text-white leading-relaxed">
                    {i + 1}. {r.question}
                  </p>
                </div>
                <div className="ml-6 space-y-1 text-xs">
                  <p className="text-gray-400">
                    Your answer: <span className={r.isCorrect ? 'text-teal-400' : 'text-red-400'}>{r.selectedOption ?? '(no answer)'}</span>
                    {!r.isCorrect && <span className="text-gray-500"> — Correct answer: <span className="text-teal-400">{r.correctOption}</span></span>}
                  </p>
                  <p className="text-gray-500 leading-relaxed">{r.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/labs')}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800/50 transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Back to Modules
          </button>
          <button
            onClick={onPracticeAgain}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <RotateCcw size={16} /> Practice Again
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PracticeResultSummary;
