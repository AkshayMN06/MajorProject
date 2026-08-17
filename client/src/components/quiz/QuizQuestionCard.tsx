import React from 'react';
import { motion } from 'framer-motion';
import type { QuizQuestion } from '../../services/api';

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedOption: string | null;
  onSelect: (option: 'A' | 'B' | 'C' | 'D') => void;
}

const OPTION_KEYS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

export const QuizQuestionCard: React.FC<QuizQuestionCardProps> = ({
  question,
  index,
  total,
  selectedOption,
  onSelect,
}) => {
  const options: Record<'A' | 'B' | 'C' | 'D', string> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0f1629]/80 border border-[#1e293b] rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Question {index + 1} of {total}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
            {question.moduleTag}
          </span>
          <span className="text-xs px-2 py-0.5 rounded border border-gray-600/40 text-gray-400 bg-gray-700/10">
            {question.difficulty}
          </span>
        </div>
      </div>

      <p className="text-base font-semibold text-white mb-5 leading-relaxed">{question.question}</p>

      <div className="space-y-3">
        {OPTION_KEYS.map((key) => {
          const isSelected = selectedOption === key;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(key)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3
                ${isSelected
                  ? 'bg-indigo-950/30 border-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.25)]'
                  : 'bg-[#0a0f1e] border-[#1e293b] hover:border-gray-600'
                }`}
            >
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold
                  ${isSelected ? 'border-indigo-400 text-indigo-300 bg-indigo-500/20' : 'border-gray-600 text-gray-500'}`}
              >
                {key}
              </span>
              <span className="text-sm text-gray-200 leading-relaxed">{options[key]}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default QuizQuestionCard;
