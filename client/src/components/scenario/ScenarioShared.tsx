import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Shield, ChevronDown, ChevronUp, Send, Check,
  AlertTriangle, Clock, Loader2, Zap, Lock, Info, BadgeCheck
} from 'lucide-react';
import { Scenario, AttackOption, DefenseOption } from '../../hooks/useScenarioSession';

// ─── Strategy Card (shared for attack & defense) ──────────────────────────────

interface StrategyCardProps {
  option: AttackOption | DefenseOption;
  isSelected: boolean;
  isAttack: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  option,
  isSelected,
  isAttack,
  onSelect,
  disabled = false,
}) => {
  const accentColor = isAttack ? 'red' : 'teal';
  const meta = isAttack
    ? `Difficulty: ${(option as AttackOption).difficulty}`
    : `Effectiveness: ${(option as DefenseOption).effectiveness}`;

  const diffOrEff = isAttack
    ? (option as AttackOption).difficulty
    : (option as DefenseOption).effectiveness;

  const metaColor =
    diffOrEff === 'Easy' || diffOrEff === 'Low'
      ? 'text-green-400 bg-green-400/10 border-green-400/20'
      : diffOrEff === 'Medium'
      ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      : diffOrEff === 'Hard' || diffOrEff === 'High'
      ? 'text-red-400 bg-red-400/10 border-red-400/20'
      : 'text-blue-400 bg-blue-400/10 border-blue-400/20';

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 relative focus:outline-none
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${
          isSelected
            ? accentColor === 'red'
              ? 'bg-red-950/30 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
              : 'bg-teal-950/30 border-teal-500 shadow-[0_0_16px_rgba(20,184,166,0.25)]'
            : 'bg-[#0a0f1e] border-[#1e293b] hover:border-gray-600'
        }`}
    >
      {isSelected && (
        <span
          className={`absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full
            ${accentColor === 'red' ? 'bg-red-500' : 'bg-teal-500'} text-white`}
        >
          <Check size={12} />
        </span>
      )}

      <div className="flex items-start gap-3 mb-2">
        <div
          className={`p-2 rounded-lg flex-shrink-0
            ${isSelected
              ? accentColor === 'red'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-teal-500/20 text-teal-400'
              : 'bg-gray-800/60 text-gray-400'
            }`}
        >
          {isAttack ? <Zap size={16} /> : <Lock size={16} />}
        </div>
        <div>
          <h4 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
            {option.name}
          </h4>
          <span className="text-xs text-gray-500">{option.category}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-3">{option.description}</p>

      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${metaColor}`}>
        {meta}
      </span>
    </motion.button>
  );
};

// ─── Round Progress Bar ───────────────────────────────────────────────────────

interface RoundProgressProps {
  current: number;
  total: number;
  role: 'attacker' | 'defender';
}

export const RoundProgress: React.FC<RoundProgressProps> = ({ current, total, role }) => {
  const pct = Math.min((current / total) * 100, 100);
  const color = role === 'attacker' ? 'bg-red-500' : 'bg-teal-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 whitespace-nowrap">
        Round {current} of {total}
      </span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

// ─── Scenario Header ──────────────────────────────────────────────────────────

interface ScenarioHeaderProps {
  scenario: Scenario;
  role: 'attacker' | 'defender';
  currentRound: number;
  totalRounds: number;
  attackerScore: number;
  defenderScore: number;
  sessionCode: string | null;
}

export const ScenarioHeader: React.FC<ScenarioHeaderProps> = ({
  scenario, role, currentRound, totalRounds, attackerScore, defenderScore, sessionCode
}) => {
  const diffColor =
    scenario.difficulty === 'Easy'
      ? 'text-green-400 bg-green-400/10 border-green-400/20'
      : scenario.difficulty === 'Medium'
      ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      : 'text-red-400 bg-red-400/10 border-red-400/20';

  return (
    <div className="bg-[#0a0f1e]/80 border border-[#1e293b] rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-start gap-4 mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${diffColor}`}>
              {scenario.difficulty}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/10">
              {scenario.category}
            </span>
            {sessionCode && (
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-gray-700 text-gray-400 bg-gray-900">
                {sessionCode}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{scenario.name}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{scenario.context}</p>
        </div>

        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 text-sm flex-shrink-0">
          <div className="flex items-center gap-1.5 text-red-400">
            <Target size={14} />
            <span className="font-bold">{attackerScore}</span>
            <span className="text-gray-500 text-xs">ATK</span>
          </div>
          <div className="flex items-center gap-1.5 text-teal-400">
            <Shield size={14} />
            <span className="font-bold">{defenderScore}</span>
            <span className="text-gray-500 text-xs">DEF</span>
          </div>
        </div>
      </div>

      <RoundProgress current={currentRound} total={totalRounds} role={role} />
    </div>
  );
};

// ─── Parameters Form ──────────────────────────────────────────────────────────

interface ParamsFormProps {
  isAttack: boolean;
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}

export const ParamsForm: React.FC<ParamsFormProps> = ({ isAttack, params, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  const attackFields = [
    { key: 'target', label: 'Target', placeholder: 'e.g. Login page, Admin panel' },
    { key: 'technique', label: 'Technique', placeholder: 'e.g. Dictionary attack, Zero-day' },
    { key: 'notes', label: 'Notes', placeholder: 'Additional context or reasoning' },
  ];

  const defenseFields = [
    { key: 'securityLevel', label: 'Security Level', placeholder: 'e.g. High, Enterprise-grade' },
    { key: 'configNotes', label: 'Configuration Notes', placeholder: 'How this control is configured' },
    { key: 'notes', label: 'Notes', placeholder: 'Additional reasoning' },
  ];

  const fields = isAttack ? attackFields : defenseFields;
  const accentColor = isAttack ? 'border-red-500/50 text-red-400' : 'border-teal-500/50 text-teal-400';

  return (
    <div className="border border-[#1e293b] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#0a0f1e]/60 hover:bg-[#0a0f1e] transition-colors text-sm text-gray-400"
      >
        <span className="flex items-center gap-2">
          <Info size={14} />
          Optional Parameters{' '}
          <span className="text-xs text-gray-600">(adds bonus points)</span>
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-[#0a0f1e]/30">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                  <input
                    value={params[f.key] ?? ''}
                    onChange={e => onChange({ ...params, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Waiting Overlay ─────────────────────────────────────────────────────────

interface WaitingOverlayProps {
  message: string;
  color: 'red' | 'teal' | 'blue';
}

export const WaitingOverlay: React.FC<WaitingOverlayProps> = ({ message, color }) => {
  const dotColor =
    color === 'red' ? 'bg-red-500' : color === 'teal' ? 'bg-teal-500' : 'bg-blue-500';
  const textColor =
    color === 'red' ? 'text-red-400' : color === 'teal' ? 'text-teal-400' : 'text-blue-400';

  return (
    <div className="w-full bg-[#0a0f1e] border border-[#1e293b] rounded-xl py-6 flex flex-col items-center justify-center gap-3">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-2.5 h-2.5 ${dotColor} rounded-full animate-bounce`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className={`text-sm font-medium tracking-wide ${textColor}`}>{message}</p>
    </div>
  );
};

// ─── Outcome Badge ────────────────────────────────────────────────────────────

export const OutcomeBadge: React.FC<{ outcome: string }> = ({ outcome }) => {
  const cfg =
    outcome === 'defended'
      ? { label: 'Defended', cls: 'bg-teal-500/10 border-teal-500/40 text-teal-400' }
      : outcome === 'partially_defended'
      ? { label: 'Partially Defended', cls: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400' }
      : { label: 'Breached', cls: 'bg-red-500/10 border-red-500/40 text-red-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.cls}`}>
      {outcome === 'defended' ? <BadgeCheck size={14} /> : outcome === 'breached' ? <AlertTriangle size={14} /> : <Clock size={14} />}
      {cfg.label}
    </span>
  );
};
