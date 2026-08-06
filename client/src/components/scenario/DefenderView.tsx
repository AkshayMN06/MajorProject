import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Send, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { Scenario } from '../../hooks/useScenarioSession';
import { StrategyCard, ScenarioHeader, ParamsForm, WaitingOverlay } from './ScenarioShared';

interface IncomingAttack {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
}

interface DefenderViewProps {
  scenario: Scenario;
  currentRound: number;
  totalRounds: number;
  attackerScore: number;
  defenderScore: number;
  sessionCode: string | null;
  incomingAttack: IncomingAttack | null;  // null means attack not submitted yet
  isWaiting: boolean;                      // true after submitting defense
  onSubmit: (optionId: string, params: Record<string, string>) => void;
}

const DefenderView: React.FC<DefenderViewProps> = ({
  scenario,
  currentRound,
  totalRounds,
  attackerScore,
  defenderScore,
  sessionCode,
  incomingAttack,
  isWaiting,
  onSubmit,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selectedId || submitted) return;
    setSubmitted(true);
    onSubmit(selectedId, params);
  };

  const selected = scenario.defenseOptions.find(o => o.id === selectedId);
  const canInteract = !!incomingAttack && !submitted && !isWaiting;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* Role badge */}
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
          <Shield size={16} className="text-teal-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Scenario Assessment</h1>
        <span className="px-2 py-0.5 text-xs font-semibold rounded border border-teal-500/30 text-teal-400 bg-teal-500/10 tracking-wider">
          DEFENDER
        </span>
      </div>

      {/* Scenario header */}
      <ScenarioHeader
        scenario={scenario}
        role="defender"
        currentRound={currentRound}
        totalRounds={totalRounds}
        attackerScore={attackerScore}
        defenderScore={defenderScore}
        sessionCode={sessionCode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Incoming Threat Panel */}
          <AnimatePresence mode="wait">
            {!incomingAttack ? (
              <motion.div
                key="waiting-attack"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-6 flex flex-col items-center gap-3"
              >
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-gray-600 rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500">Waiting for attacker to submit their strategy...</p>
              </motion.div>
            ) : (
              <motion.div
                key="incoming-attack"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-950/20 border border-red-500/40 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Incoming Threat Detected</h3>
                </div>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-white mb-1">{incomingAttack.name}</p>
                    <p className="text-sm text-gray-400 leading-relaxed">{incomingAttack.description}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10">
                      {incomingAttack.category}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
                      {incomingAttack.difficulty}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Choose the most effective countermeasure to neutralize this threat.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Defense strategy grid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span className="text-teal-500 font-bold">01</span>
              Select Defense Strategy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scenario.defenseOptions.map(opt => (
                <StrategyCard
                  key={opt.id}
                  option={opt}
                  isSelected={selectedId === opt.id}
                  isAttack={false}
                  onSelect={() => canInteract && setSelectedId(opt.id)}
                  disabled={!canInteract}
                />
              ))}
            </div>
          </div>

          {/* Optional params */}
          {selectedId && canInteract && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span className="text-teal-500 font-bold">02</span>
                Configure Defense
              </h3>
              <ParamsForm isAttack={false} params={params} onChange={setParams} />
            </motion.div>
          )}

          {/* Submit / waiting */}
          <div>
            {isWaiting || submitted ? (
              <WaitingOverlay
                message="Defense submitted — waiting for evaluation..."
                color="teal"
              />
            ) : (
              <motion.button
                whileHover={canInteract && selectedId ? { scale: 1.01 } : {}}
                whileTap={canInteract && selectedId ? { scale: 0.99 } : {}}
                onClick={handleSubmit}
                disabled={!canInteract || !selectedId}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide transition-all
                  ${canInteract && selectedId
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_28px_rgba(20,184,166,0.5)]'
                    : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'
                  }`}
              >
                <Send size={16} />
                {!incomingAttack ? 'Awaiting Incoming Threat...' : 'Submit Defense Strategy'}
              </motion.button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-teal-950/20 border border-teal-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-teal-400">
              <Info size={14} />
              <h3 className="text-xs font-bold tracking-widest uppercase">Defense Guide</h3>
            </div>
            <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
              <li>• Match your defense to the category of the incoming attack</li>
              <li>• A directly relevant control scores highest</li>
              <li>• Add configuration notes for bonus points</li>
              <li>• Consistent correct defenses build your accuracy score</li>
            </ul>
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0a0f1e] border border-teal-500/30 rounded-xl p-4 space-y-2"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider">Selected</p>
              <p className="text-sm font-semibold text-white">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.description}</p>
              <span className="inline-block text-xs px-2 py-0.5 rounded border border-teal-500/30 text-teal-400 bg-teal-500/10">
                {selected.category}
              </span>
            </motion.div>
          )}

          <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-4 text-xs space-y-2.5">
            <p className="text-gray-500 uppercase tracking-wider font-medium mb-1">Scoring</p>
            <div className="flex justify-between text-gray-400"><span>Correct concept</span><span className="text-green-400">+20</span></div>
            <div className="flex justify-between text-gray-400"><span>Full block</span><span className="text-green-400">+30</span></div>
            <div className="flex justify-between text-gray-400"><span>Partial block</span><span className="text-green-400">+15</span></div>
            <div className="flex justify-between text-gray-400"><span>Repeated mistake</span><span className="text-red-400">-5 each</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefenderView;
