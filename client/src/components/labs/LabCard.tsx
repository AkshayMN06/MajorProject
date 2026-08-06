import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Star, Play, Bug, Database, Shield, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type LabType = 'attack' | 'defense';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface LabCardProps {
  id: string;
  name: string;
  description: string;
  type: LabType;
  difficulty: Difficulty;
  rating: number;
  ratingCount: number;
  duration: number;
  iconName: 'bug' | 'database' | 'shield' | 'radio';
}

const iconMap: Record<string, LucideIcon> = {
  bug: Bug,
  database: Database,
  shield: Shield,
  radio: Radio,
};

export const LabCard: React.FC<LabCardProps> = ({
  name,
  description,
  type,
  difficulty,
  rating,
  ratingCount,
  duration,
  iconName,
}) => {
  const Icon = iconMap[iconName] || Shield;
  const isAttack = type === 'attack';
  
  const badgeClass = isAttack 
    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
    : 'bg-green-500/20 text-green-400 border border-green-500/30';
    
  const typeText = isAttack ? 'Attack Lab' : 'Defense Lab';
  
  const difficultyColor = {
    Easy: 'text-green-400',
    Medium: 'text-yellow-400',
    Hard: 'text-red-400',
  }[difficulty];

  return (
    <motion.div 
      whileHover={{ y: -5, boxShadow: isAttack ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(34, 197, 94, 0.2)' }}
      className="glass-card rounded-xl p-6 border border-cyber-border bg-cyber-bg-dark/80 backdrop-blur-md flex flex-col h-full transition-all duration-300 relative overflow-hidden group"
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 w-full h-1 ${isAttack ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-green-600 to-green-400'}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${isAttack ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
          <Icon size={24} />
        </div>
        <div className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${badgeClass}`}>
          {typeText}
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
      <p className="text-gray-400 text-sm mb-6 flex-grow">{description}</p>
      
      <div className="space-y-4 mt-auto">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1">
            <span className={`font-medium ${difficultyColor}`}>{difficulty}</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-300">
            <Star size={14} className="text-yellow-400 fill-yellow-400" />
            <span>{rating} ({ratingCount})</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-400">
            <Clock size={14} />
            <span>{duration}m</span>
          </div>
        </div>
        
        <button 
          className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all duration-300 ${
            isAttack 
              ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 hover:neon-red' 
              : 'bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500/20 hover:neon-green'
          }`}
        >
          <span>Start Lab</span>
          <Play size={16} />
        </button>
      </div>
    </motion.div>
  );
};
