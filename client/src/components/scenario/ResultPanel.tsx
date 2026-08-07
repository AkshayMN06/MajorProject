import React from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, ArrowRight, BookOpen, ChevronRight } from 'lucide-react';
import type { RoundResult as RoundResultType } from '../../hooks/useScenarioSession';
import { OutcomeBadge, RoundProgress } from './ScenarioShared';

interface ResultPanelProps {
  result: RoundResultType;
  role: 'attacker' | 'defender';
  onContinue: () => void;
}

const ResultPanel: React.FC<ResultPanelProps> = ({ result, role, onContinue }) => {
  const isLastRound = result.roundNumber >= result.totalRounds;

  const outcomeGlow =
    result.outcome === 'defended'
      ? 'shadow-[0_0_40px_rgba(20,184,166,0.15)]'
      : result.outcome === 'breached'
      ? 'shadow-[0_0_40px_rgba(239,68,68,0.15)]'
      : 'shadow-[0_0_40px_rgba(234,179,8,0.1)]';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cyber-bg-dark">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className={`w-full max-w-2xl bg-[#0f1629]/90 border border-[#1e293b] rounded-2xl p-8 ${outcomeGlow}`}
      >
        {/* Round & outcome header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Round {result.roundNumber} Result
            </p>
            <h2 className="text-xl font-bold text-white">{result.scenarioName}</h2>
          </div>
          <OutcomeBadge outcome={result.outcome} />
        </div>

        {/* Progress */}
        <div className="mb-6">
          <RoundProgress current={result.roundNumber} total={result.totalRounds} role={role} />
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Attack */}
          <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-red-400" />
              <span className="text-xs text-red-400 font-bold uppercase tracking-wider">Attack Used</span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">{result.attackOptionName}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{result.attackOptionDescription}</p>
          </div>

          {/* Defense */}
          <div className="bg-teal-950/20 border border-teal-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-teal-400" />
              <span className="text-xs text-teal-400 font-bold uppercase tracking-wider">Defense Applied</span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">{result.defenseOptionName}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{result.defenseOptionDescription}</p>
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-[#0a0f1e] border border-[#1e293b] rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-blue-400" />
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Analysis</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{result.explanation}</p>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Attacker score */}
          <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Target size={13} className="text-red-400" />
              <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Attacker</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-white">+{result.attackerRoundScore}</span>
              <span className="text-xs text-gray-500">this round</span>
            </div>
            <div className="text-xs text-gray-400">
              Total: <span className="text-white font-semibold">{result.attackerTotalScore}</span>
            </div>
          </div>

          {/* Defender score */}
          <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Shield size={13} className="text-teal-400" />
              <span className="text-xs text-teal-400 font-semibold uppercase tracking-wider">Defender</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-white">+{result.defenderRoundScore}</span>
              <span className="text-xs text-gray-500">this round</span>
            </div>
            <div className="text-xs text-gray-400">
              Total: <span className="text-white font-semibold">{result.defenderTotalScore}</span>
            </div>
          </div>
        </div>

        {/* Score breakdown — both sides */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Attacker Breakdown', accent: 'text-red-400', breakdown: result.attackerScoreBreakdown },
            { label: 'Defender Breakdown', accent: 'text-teal-400', breakdown: result.defenderScoreBreakdown },
          ].map(({ label, accent, breakdown }) => (
            <div key={label} className="bg-[#0a0f1e]/40 border border-[#1e293b] rounded-xl p-4">
              <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${accent}`}>{label}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Correct Choice</span>
                  <span className={breakdown.correctChoice > 0 ? 'text-green-400' : 'text-gray-600'}>+{breakdown.correctChoice}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Time Efficiency</span>
                  <span className={breakdown.timeEfficiency > 0 ? 'text-green-400' : 'text-gray-600'}>+{breakdown.timeEfficiency}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Consistency</span>
                  <span className={breakdown.consistency > 0 ? 'text-green-400' : 'text-gray-600'}>+{breakdown.consistency}</span>
                </div>
                {breakdown.repeatedMistakes > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Repeated Mistakes</span>
                    <span className="text-red-400">-{breakdown.repeatedMistakes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Continue */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onContinue}
          className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all
            ${isLastRound
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
            }`}
        >
          {isLastRound ? (
            <><BookOpen size={16} /> View Assessment Report</>
          ) : (
            <>Next Round <ChevronRight size={16} /></>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ResultPanel;
