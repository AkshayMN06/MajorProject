import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Send } from 'lucide-react';
import type { Scenario } from '../../hooks/useScenarioSession';
import { StrategyCard, ScenarioHeader, AssessmentGuide, WaitingOverlay } from './ScenarioShared';

interface AttackerViewProps {
  scenario: Scenario;
  currentRound: number;
  totalRounds: number;
  attackerScore: number;
  defenderScore: number;
  sessionCode: string | null;
  isWaiting: boolean; // true after submitting
  onSubmit: (optionId: string) => void;
}

const AttackerView: React.FC<AttackerViewProps> = ({
  scenario,
  currentRound,
  totalRounds,
  attackerScore,
  defenderScore,
  sessionCode,
  isWaiting,
  onSubmit,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selectedId || submitted) return;
    setSubmitted(true);
    onSubmit(selectedId);
  };

  const selected = scenario.attackOptions.find(o => o.id === selectedId);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* Role badge */}
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <Target size={16} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Scenario Assessment</h1>
        <span className="px-2 py-0.5 text-xs font-semibold rounded border border-red-500/30 text-red-400 bg-red-500/10 tracking-wider">
          ATTACKER
        </span>
      </div>

      {/* Scenario header */}
      <ScenarioHeader
        scenario={scenario}
        role="attacker"
        currentRound={currentRound}
        totalRounds={totalRounds}
        attackerScore={attackerScore}
        defenderScore={defenderScore}
        sessionCode={sessionCode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main: strategy selection */}
        <div className="lg:col-span-2 space-y-5">

          {/* Target info */}
          <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Target System</p>
            <p className="text-sm text-gray-200 font-medium">{scenario.targetSystem}</p>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{scenario.description}</p>
          </div>

          {/* Attack strategy grid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="text-red-500 font-bold">01</span>
              Select Attack Strategy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scenario.attackOptions.map(opt => (
                <StrategyCard
                  key={opt.id}
                  option={opt}
                  isSelected={selectedId === opt.id}
                  isAttack={true}
                  onSelect={() => !submitted && !isWaiting && setSelectedId(opt.id)}
                  disabled={submitted || isWaiting}
                />
              ))}
            </div>
          </div>

          {/* Submit / waiting */}
          <div>
            {isWaiting || submitted ? (
              <WaitingOverlay
                message="Strategy submitted — waiting for defender to respond..."
                color="red"
              />
            ) : (
              <motion.button
                whileHover={selectedId ? { scale: 1.01 } : {}}
                whileTap={selectedId ? { scale: 0.99 } : {}}
                onClick={handleSubmit}
                disabled={!selectedId}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all
                  ${selectedId
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_28px_rgba(239,68,68,0.5)]'
                    : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'
                  }`}
              >
                <Send size={16} />
                Submit Attack Strategy
              </motion.button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AssessmentGuide role="attacker" />

          {selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0a0f1e] border border-red-500/30 rounded-xl p-4 space-y-2"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider">Selected</p>
              <p className="text-sm font-semibold text-white">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.description}</p>
              <span className="inline-block text-xs px-2 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10">
                {selected.category}
              </span>
            </motion.div>
          )}

          <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-4 text-xs space-y-2.5">
            <p className="text-gray-500 uppercase tracking-wider font-medium mb-1">Scoring</p>
            <div className="flex justify-between text-gray-400"><span>Breach</span><span className="text-green-400">+30</span></div>
            <div className="flex justify-between text-gray-400"><span>Partial breach</span><span className="text-green-400">+25</span></div>
            <div className="flex justify-between text-gray-400"><span>Blocked</span><span className="text-green-400">+5</span></div>
            <div className="flex justify-between text-gray-400"><span>Fast submission</span><span className="text-green-400">up to +10</span></div>
            <div className="flex justify-between text-gray-400"><span>Consistency bonus</span><span className="text-green-400">up to +10</span></div>
            <div className="flex justify-between text-gray-400"><span>Repeated mistakes</span><span className="text-red-400">-5 each</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttackerView;
