import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle, Circle, Shield, Target, Copy, Check, Loader2, BookOpen } from 'lucide-react';
import { useState } from 'react';

interface WaitingRoomProps {
  role: 'attacker' | 'defender';
  sessionCode: string | null;
  difficulty: string;
  totalRounds: number;
  attackerName: string | null;
  defenderName: string | null;
  partnerConnected: boolean;
  myReady: boolean;
  partnerReady: boolean;
  onReady: () => void;
  // Attacker-only: waiting for defender to join
  waitingForParticipant?: boolean;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  role,
  sessionCode,
  difficulty,
  totalRounds,
  attackerName,
  defenderName,
  partnerConnected,
  myReady,
  partnerReady,
  onReady,
  waitingForParticipant = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!sessionCode) return;
    navigator.clipboard.writeText(sessionCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const diffColor =
    difficulty === 'Easy'
      ? 'text-green-400 bg-green-400/10 border-green-400/20'
      : difficulty === 'Medium'
      ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      : 'text-red-400 bg-red-400/10 border-red-400/20';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cyber-bg-dark">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl"
      >
        {/* Card */}
        <div className="bg-[#0f1629]/90 border border-[#1e293b] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-8 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users size={18} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {waitingForParticipant ? 'Waiting for Defender' : 'Assessment Lobby'}
                </h2>
                <p className="text-xs text-gray-500">
                  {waitingForParticipant
                    ? 'Share the session code with your partner'
                    : 'Both participants ready — click Ready to begin'}
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded border ${
              role === 'attacker'
                ? 'border-red-500/30 text-red-400 bg-red-500/10'
                : 'border-teal-500/30 text-teal-400 bg-teal-500/10'
            }`}>
              {role.toUpperCase()}
            </span>
          </div>

          {/* Session Code */}
          {sessionCode && (
            <div className="mb-6 relative">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Session Code</p>
              <div className="flex items-center gap-3 bg-[#0a0f1e] border border-[#1e293b] rounded-xl p-4">
                <span className="font-mono text-2xl font-bold text-white tracking-widest flex-1">
                  {sessionCode}
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </motion.button>
              </div>
              {waitingForParticipant && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Share this code with your partner so they can join
                </p>
              )}
            </div>
          )}

          {/* Session Details */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Difficulty</p>
              <span className={`text-sm font-semibold ${diffColor.split(' ')[0]}`}>{difficulty}</span>
            </div>
            <div className="bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Rounds</p>
              <span className="text-sm font-semibold text-white">{totalRounds} scenarios</span>
            </div>
          </div>

          {/* Participants */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Participants</p>
            <div className="space-y-2">
              {/* Attacker */}
              <div className="flex items-center gap-3 bg-[#0a0f1e]/60 border border-[#1e293b] rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Target size={14} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Attacker</p>
                  <p className="text-sm font-medium text-white truncate">{attackerName ?? '—'}</p>
                </div>
                <AnimatePresence>
                  {!waitingForParticipant && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        (role === 'attacker' ? myReady : partnerReady)
                          ? 'text-green-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {(role === 'attacker' ? myReady : partnerReady)
                        ? <CheckCircle size={14} />
                        : <Circle size={14} />}
                      {(role === 'attacker' ? myReady : partnerReady) ? 'Ready' : 'Not Ready'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Defender */}
              <div className={`flex items-center gap-3 border rounded-xl p-3 transition-colors ${
                partnerConnected || role === 'defender'
                  ? 'bg-[#0a0f1e]/60 border-[#1e293b]'
                  : 'bg-[#0a0f1e]/30 border-dashed border-gray-800'
              }`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                  partnerConnected || role === 'defender'
                    ? 'bg-teal-500/10 border-teal-500/20'
                    : 'bg-gray-800/40 border-gray-700'
                }`}>
                  <Shield size={14} className={partnerConnected || role === 'defender' ? 'text-teal-400' : 'text-gray-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Defender</p>
                  {partnerConnected || role === 'defender' ? (
                    <p className="text-sm font-medium text-white truncate">
                      {defenderName ?? 'Connecting...'}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      Waiting for participant...
                    </p>
                  )}
                </div>
                <AnimatePresence>
                  {(partnerConnected || role === 'defender') && !waitingForParticipant && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        (role === 'defender' ? myReady : partnerReady)
                          ? 'text-green-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {(role === 'defender' ? myReady : partnerReady)
                        ? <CheckCircle size={14} />
                        : <Circle size={14} />}
                      {(role === 'defender' ? myReady : partnerReady) ? 'Ready' : 'Not Ready'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Ready button */}
          {!waitingForParticipant && (partnerConnected || role === 'defender') && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={!myReady ? { scale: 1.01 } : {}}
              whileTap={!myReady ? { scale: 0.99 } : {}}
              onClick={!myReady ? onReady : undefined}
              disabled={myReady}
              className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2
                ${myReady
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default'
                  : role === 'attacker'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_28px_rgba(239,68,68,0.4)]'
                  : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_28px_rgba(20,184,166,0.4)]'
                }`}
            >
              {myReady ? (
                <><CheckCircle size={16} /> You're Ready — Waiting for partner</>
              ) : (
                <><BookOpen size={16} /> I'm Ready to Begin</>
              )}
            </motion.button>
          )}

          {waitingForParticipant && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-2">
              <Loader2 size={14} className="animate-spin" />
              Waiting for defender to join...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default WaitingRoom;
