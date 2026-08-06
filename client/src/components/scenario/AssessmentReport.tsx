import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Target, Shield, BarChart2, TrendingUp, TrendingDown,
  BookOpen, Download, RefreshCw, CheckCircle, XCircle, MinusCircle
} from 'lucide-react';
import { AssessmentReport as ReportType } from '../../hooks/useScenarioSession';

interface AssessmentReportProps {
  report: ReportType;
  role: 'attacker' | 'defender';
  onReset: () => void;
}

const AssessmentReport: React.FC<AssessmentReportProps> = ({ report, role, onReset }) => {
  const myScore = role === 'attacker' ? report.attackerFinalScore : report.defenderFinalScore;
  const partnerScore = role === 'attacker' ? report.defenderFinalScore : report.attackerFinalScore;
  const myName = role === 'attacker' ? report.attackerName : report.defenderName;
  const partnerName = role === 'attacker' ? report.defenderName : report.attackerName;

  const handleDownload = () => {
    const lines = [
      'CyberLearn — Assessment Report',
      '================================',
      `Session: ${report.sessionId}`,
      `Attacker: ${report.attackerName}`,
      `Defender: ${report.defenderName}`,
      `Total Rounds: ${report.totalRounds}`,
      '',
      'SCORES',
      `Attacker Final Score: ${report.attackerFinalScore}`,
      `Defender Final Score: ${report.defenderFinalScore}`,
      `Defender Accuracy: ${report.defenderAccuracy}%`,
      '',
      'OUTCOMES',
      `Defended (Defender wins): ${report.defenderWins}`,
      `Breached (Attacker wins): ${report.attackerWins}`,
      `Partial: ${report.partials}`,
      '',
      'STRONG TOPICS',
      report.strongTopics.length > 0 ? report.strongTopics.join(', ') : 'None identified',
      '',
      'WEAK TOPICS',
      report.weakTopics.length > 0 ? report.weakTopics.join(', ') : 'None identified',
      '',
      'CATEGORY BREAKDOWN',
      ...report.categories.map(c => `  ${c.category}: ${c.accuracy}% (${c.defended}/${c.total})`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberlearn-report-${report.sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark p-4 md:p-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Hero */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Trophy size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Assessment Complete</h1>
          <p className="text-gray-400 text-sm">
            {report.totalRounds} rounds completed — full analysis below
          </p>
        </motion.div>

        {/* My score vs partner */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
          <div className={`rounded-2xl p-6 border ${
            role === 'attacker'
              ? 'bg-red-950/20 border-red-500/30'
              : 'bg-teal-950/20 border-teal-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {role === 'attacker' ? (
                <Target size={16} className="text-red-400" />
              ) : (
                <Shield size={16} className="text-teal-400" />
              )}
              <span className={`text-xs font-bold uppercase tracking-wider ${
                role === 'attacker' ? 'text-red-400' : 'text-teal-400'
              }`}>Your Score</span>
            </div>
            <p className="text-4xl font-bold text-white mb-1">{myScore}</p>
            <p className="text-xs text-gray-500 truncate">{myName}</p>
          </div>

          <div className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              {role === 'defender' ? (
                <Target size={16} className="text-red-400" />
              ) : (
                <Shield size={16} className="text-teal-400" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Partner</span>
            </div>
            <p className="text-4xl font-bold text-white mb-1">{partnerScore}</p>
            <p className="text-xs text-gray-500 truncate">{partnerName}</p>
          </div>
        </motion.div>

        {/* Outcome summary */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          <div className="bg-teal-950/20 border border-teal-500/20 rounded-xl p-4 text-center">
            <CheckCircle size={20} className="text-teal-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{report.defenderWins}</p>
            <p className="text-xs text-gray-500 mt-0.5">Defended</p>
          </div>
          <div className="bg-yellow-950/10 border border-yellow-500/20 rounded-xl p-4 text-center">
            <MinusCircle size={20} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{report.partials}</p>
            <p className="text-xs text-gray-500 mt-0.5">Partial</p>
          </div>
          <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 text-center">
            <XCircle size={20} className="text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{report.attackerWins}</p>
            <p className="text-xs text-gray-500 mt-0.5">Breached</p>
          </div>
        </motion.div>

        {/* Defender accuracy */}
        {role === 'defender' && (
          <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Defense Accuracy</span>
              </div>
              <span className="text-2xl font-bold text-white">{report.defenderAccuracy}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${report.defenderAccuracy}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Category breakdown */}
        {report.categories.length > 0 && (
          <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart2 size={15} className="text-indigo-400" />
              Category Breakdown
            </h3>
            <div className="space-y-3">
              {report.categories.map(c => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{c.category}</span>
                    <span className="text-xs font-semibold text-white">
                      {c.defended}/{c.total} defended ({c.accuracy}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        c.accuracy >= 70 ? 'bg-teal-500' : c.accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${c.accuracy}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Strong & Weak topics */}
        {(report.strongTopics.length > 0 || report.weakTopics.length > 0) && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.strongTopics.length > 0 && (
              <div className="bg-teal-950/10 border border-teal-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-teal-400" />
                  <span className="text-sm font-semibold text-teal-400">Strong Topics</span>
                </div>
                <ul className="space-y-1.5">
                  {report.strongTopics.map(t => (
                    <li key={t} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle size={12} className="text-teal-400 flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.weakTopics.length > 0 && (
              <div className="bg-red-950/10 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={15} className="text-red-400" />
                  <span className="text-sm font-semibold text-red-400">Topics to Review</span>
                </div>
                <ul className="space-y-1.5">
                  {report.weakTopics.map(t => (
                    <li key={t} className="flex items-center gap-2 text-sm text-gray-300">
                      <BookOpen size={12} className="text-red-400 flex-shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800/50 transition-colors text-sm font-medium"
          >
            <Download size={15} /> Download Report
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white transition-colors text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <RefreshCw size={15} /> New Assessment
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AssessmentReport;
