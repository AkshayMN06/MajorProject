import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, HelpCircle, Layers, Gauge } from 'lucide-react';

export interface ModuleCardProps {
  module: string;
  questionCount: number;
  questionsPerSession: number;
  difficulty: string;
  onStart: () => void;
}

// Role-neutral practice module card — no attacker/defense theming, unlike
// the old LabCard this replaces.
export const ModuleCard: React.FC<ModuleCardProps> = ({ module, questionCount, questionsPerSession, difficulty, onStart }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5 flex flex-col"
    >
      <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg w-fit mb-4">
        <BookOpen size={24} />
      </div>
      <h3 className="text-lg font-bold text-white mb-3">{module}</h3>

      <div className="space-y-2 text-xs text-gray-400 mb-6">
        <div className="flex items-center gap-2">
          <HelpCircle size={14} className="text-gray-500" />
          <span>{questionCount} practice questions available</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-gray-500" />
          <span>{questionsPerSession} questions per session</span>
        </div>
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-gray-500" />
          <span>{difficulty}</span>
        </div>
      </div>

      <button
        onClick={onStart}
        className="mt-auto w-full py-2.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
      >
        Start Practice
      </button>
    </motion.div>
  );
};

export default ModuleCard;
