import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Target, Shield, Plus, LogIn,
  ChevronDown, Loader2, X, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// ─── Create Session Modal ─────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onCreate: (opts: { difficulty: string; totalScenarios: number }) => void;
  isLoading: boolean;
  error: string | null;
}

export const CreateSessionModal: React.FC<CreateModalProps> = ({
  onClose, onCreate, isLoading, error,
}) => {
  const [difficulty, setDifficulty] = useState('Medium');
  const [rounds, setRounds] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ difficulty, totalScenarios: rounds });
  };

  const inputClass = 'w-full bg-[#0a0f1e] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-[#0f1629] border border-[#1e293b] rounded-2xl p-7 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Plus size={17} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Create Session</h3>
              <p className="text-xs text-gray-500">You will be assigned as Attacker</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {['Easy', 'Medium', 'Hard'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    difficulty === d
                      ? d === 'Easy'
                        ? 'bg-green-500/15 border-green-500/50 text-green-400'
                        : d === 'Medium'
                        ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400'
                        : 'bg-red-500/15 border-red-500/50 text-red-400'
                      : 'bg-[#0a0f1e] border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">
              Number of Rounds: <span className="text-white">{rounds}</span>
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={rounds}
              onChange={e => setRounds(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>2</span><span>10</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800/50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-shadow"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />}
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Join Session Modal ───────────────────────────────────────────────────────
interface JoinModalProps {
  onClose: () => void;
  onJoin: (code: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const JoinSessionModal: React.FC<JoinModalProps> = ({
  onClose, onJoin, isLoading, error,
}) => {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) onJoin(code.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-[#0f1629] border border-[#1e293b] rounded-2xl p-7 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <LogIn size={17} className="text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Join Session</h3>
              <p className="text-xs text-gray-500">You will be assigned as Defender</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Session Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="CYB-0000"
              maxLength={8}
              className="w-full bg-[#0a0f1e] border border-gray-700 rounded-xl py-4 px-5 text-white font-mono text-2xl tracking-widest text-center focus:outline-none focus:border-teal-500 transition-colors placeholder-gray-700"
            />
            <p className="text-xs text-gray-600 mt-2 text-center">
              Enter the code shared by the session host
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800/50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || code.length < 4}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-shadow"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
              {isLoading ? 'Joining...' : 'Join as Defender'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Landing View ─────────────────────────────────────────────────────────────
interface LandingViewProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onCreateClick, onJoinClick }) => {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-5">
            <Terminal className="w-8 h-8 text-cyber-blue" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Scenario Assessment
          </h1>
          <p className="text-gray-400 text-base max-w-lg mx-auto leading-relaxed">
            A collaborative cybersecurity assessment where two students take on the roles of
            Attacker and Defender across real-world scenarios.
          </p>
          {user && (
            <p className="text-sm text-gray-600 mt-3">
              Signed in as <span className="text-gray-400">{user.name}</span>
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreateClick}
            className="bg-[#0f1629]/80 border border-red-500/20 hover:border-red-500/50 p-7 rounded-2xl flex flex-col items-center text-center transition-all group hover:bg-red-950/10"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Target className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Create Session</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Start a new assessment session. You'll be assigned the <span className="text-red-400">Attacker</span> role and receive a shareable session code.
            </p>
            <span className="flex items-center gap-2 text-sm font-semibold text-red-400 group-hover:text-red-300">
              <Plus size={15} /> Create & Get Code
            </span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onJoinClick}
            className="bg-[#0f1629]/80 border border-teal-500/20 hover:border-teal-500/50 p-7 rounded-2xl flex flex-col items-center text-center transition-all group hover:bg-teal-950/10"
          >
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-7 h-7 text-teal-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Join Session</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Enter a session code from your partner. You'll be assigned the <span className="text-teal-400">Defender</span> role automatically.
            </p>
            <span className="flex items-center gap-2 text-sm font-semibold text-teal-400 group-hover:text-teal-300">
              <LogIn size={15} /> Enter Session Code
            </span>
          </motion.button>
        </div>

        {/* Info strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0f1629]/60 border border-[#1e293b] rounded-2xl p-5 grid grid-cols-3 gap-4 text-center"
        >
          {[
            { label: 'Real Scenarios', desc: '15 categories' },
            { label: 'Live Scoring', desc: 'Rule-based engine' },
            { label: 'Full Report', desc: 'After all rounds' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
