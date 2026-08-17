import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Target, Shield, BarChart2, TrendingUp, TrendingDown,
  BookOpen, Download, RefreshCw, CheckCircle, XCircle, MinusCircle, Lightbulb, GraduationCap,
  FileSpreadsheet, Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AssessmentReport as ReportType } from '../../hooks/useScenarioSession';
import { exportApi } from '../../services/api';

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
  const myLearningOutcomes = role === 'attacker' ? report.attackerLearningOutcomes : report.defenderLearningOutcomes;

  const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);

  const handleCsvDownload = async (
    key: string,
    fetcher: (sessionId: string) => Promise<{ data: Blob }>,
    filename: string
  ) => {
    setDownloadingCsv(key);
    try {
      const response = await fetcher(report.sessionId);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to download ${filename}`, err);
    } finally {
      setDownloadingCsv(null);
    }
  };

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
      `Attacker Accuracy: ${report.attackerAccuracy}%`,
      `Defender Accuracy: ${report.defenderAccuracy}%`,
      `Average Accuracy: ${report.averageAccuracy}%`,
      '',
      'OUTCOMES',
      `Defended (Defender wins): ${report.defenderWins}`,
      `Breached (Attacker wins): ${report.attackerWins}`,
      `Partial: ${report.partials}`,
      '',
      'LEARNING OUTCOMES (your role)',
      myLearningOutcomes.hasPreTest ? `  Pre-test Score: ${myLearningOutcomes.preTestScore}%` : '  Pre-test Score: Not completed',
      myLearningOutcomes.hasPostTest ? `  Post-test Score: ${myLearningOutcomes.postTestScore}%` : '  Post-test Score: Not completed',
      myLearningOutcomes.learningGain !== null
        ? `  Learning Gain: ${myLearningOutcomes.learningGain >= 0 ? '+' : ''}${myLearningOutcomes.learningGain}pp (${myLearningOutcomes.learningGainPercent! >= 0 ? '+' : ''}${myLearningOutcomes.learningGainPercent}% relative)`
        : '  Learning Gain: Not available (complete both tests)',
      ...(myLearningOutcomes.modulePerformance.length > 0
        ? ['  Module Performance:', ...myLearningOutcomes.modulePerformance.map(m => `    ${m.moduleTag}: Pre ${m.preAccuracy ?? '—'}% -> Post ${m.postAccuracy ?? '—'}%`)]
        : []),
      ...(myLearningOutcomes.weakTopics.length > 0 ? [`  Topics to Review: ${myLearningOutcomes.weakTopics.join(', ')}`] : []),
      '',
      'ATTACKER — STRONG TOPICS',
      report.attackerStrongTopics.length > 0 ? report.attackerStrongTopics.join(', ') : 'None identified',
      'ATTACKER — WEAK TOPICS',
      report.attackerWeakTopics.length > 0 ? report.attackerWeakTopics.join(', ') : 'None identified',
      '',
      'DEFENDER — STRONG TOPICS',
      report.defenderStrongTopics.length > 0 ? report.defenderStrongTopics.join(', ') : 'None identified',
      'DEFENDER — WEAK TOPICS',
      report.defenderWeakTopics.length > 0 ? report.defenderWeakTopics.join(', ') : 'None identified',
      '',
      'ATTACKER CATEGORY BREAKDOWN',
      ...report.attackerCategories.map(c => `  ${c.category}: ${c.accuracy}% (${c.succeeded}/${c.total} successful attacks)`),
      '',
      'DEFENDER CATEGORY BREAKDOWN',
      ...report.defenderCategories.map(c => `  ${c.category}: ${c.accuracy}% (${c.succeeded}/${c.total} successful defenses)`),
      '',
      'ATTACKER RECOMMENDATIONS',
      ...(report.attackerRecommendations.length > 0
        ? report.attackerRecommendations.map(r => `  ${r.title}: ${r.description}`)
        : ['  None']),
      '',
      'DEFENDER RECOMMENDATIONS',
      ...(report.defenderRecommendations.length > 0
        ? report.defenderRecommendations.map(r => `  ${r.title}: ${r.description}`)
        : ['  None']),
      '',
      'PERFORMANCE TIMELINE',
      ...report.performanceTimeline.map(p =>
        `  Round ${p.round}: Attacker +${p.attackerRoundScore} (total ${p.attackerCumulativeScore}) | Defender +${p.defenderRoundScore} (total ${p.defenderCumulativeScore})`
      ),
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

        {/* Accuracy */}
        <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">Average Accuracy</span>
            </div>
            <span className="text-2xl font-bold text-white">{report.averageAccuracy}%</span>
          </div>
          {[
            { label: 'Attacker Accuracy', value: report.attackerAccuracy, from: 'from-red-500', to: 'to-rose-500' },
            { label: 'Defender Accuracy', value: report.defenderAccuracy, from: 'from-teal-500', to: 'to-emerald-500' },
          ].map(({ label, value, from, to }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-semibold text-white">{value}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${from} ${to} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>
            </div>
          ))}
        </motion.div>

        {/* Learning Outcomes — Pre-test / Post-test */}
        <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <GraduationCap size={15} className="text-indigo-400" />
            Learning Outcomes
          </h3>

          {!myLearningOutcomes.hasPreTest && !myLearningOutcomes.hasPostTest ? (
            <p className="text-sm text-gray-500">
              Complete a Pre-test and Post-test to see your learning outcomes here.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Pre-test / Post-test scores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0f1629]/60 border border-[#1e293b] rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pre-test Score</p>
                  <p className="text-2xl font-bold text-white">
                    {myLearningOutcomes.hasPreTest ? `${myLearningOutcomes.preTestScore}%` : '—'}
                  </p>
                  {!myLearningOutcomes.hasPreTest && <p className="text-[10px] text-gray-600 mt-1">Not completed</p>}
                </div>
                <div className="bg-[#0f1629]/60 border border-[#1e293b] rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Post-test Score</p>
                  <p className="text-2xl font-bold text-white">
                    {myLearningOutcomes.hasPostTest ? `${myLearningOutcomes.postTestScore}%` : '—'}
                  </p>
                  {!myLearningOutcomes.hasPostTest && <p className="text-[10px] text-gray-600 mt-1">Not completed</p>}
                </div>
              </div>

              {/* Learning Gain */}
              {myLearningOutcomes.learningGain !== null && myLearningOutcomes.learningGainPercent !== null ? (
                <div className="bg-[#0f1629]/60 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Learning Gain</p>
                    <p className={`text-2xl font-bold ${myLearningOutcomes.learningGain >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                      {myLearningOutcomes.learningGain >= 0 ? '+' : ''}{myLearningOutcomes.learningGain} pp
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Relative Change</p>
                    <p className={`text-lg font-semibold ${myLearningOutcomes.learningGainPercent >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                      {myLearningOutcomes.learningGainPercent >= 0 ? '+' : ''}{myLearningOutcomes.learningGainPercent}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {myLearningOutcomes.hasPreTest ? 'Complete the Post-test' : 'Complete the Pre-test and Post-test'} to see your Learning Gain.
                </p>
              )}

              {/* Module Performance */}
              {myLearningOutcomes.modulePerformance.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Module Performance</p>
                  <div className="space-y-3">
                    {myLearningOutcomes.modulePerformance.map((m) => (
                      <div key={m.moduleTag}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">{m.moduleTag}</span>
                          <span className="text-xs font-semibold text-white">
                            Pre {m.preAccuracy !== null ? `${m.preAccuracy}%` : '—'} &rarr; Post {m.postAccuracy !== null ? `${m.postAccuracy}%` : '—'}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${m.preAccuracy ?? 0}%` }} />
                          </div>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${m.postAccuracy ?? 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics to Review */}
              {myLearningOutcomes.weakTopics.length > 0 && (
                <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={14} className="text-red-400" />
                    <span className="text-sm font-semibold text-red-400">Topics to Review</span>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {myLearningOutcomes.weakTopics.map((t) => (
                      <li key={t} className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 bg-red-500/10">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {myLearningOutcomes.recommendations.length > 0 && (
                <div className="space-y-2">
                  {myLearningOutcomes.recommendations.map((rec) => (
                    <div key={rec.title} className="bg-[#0f1629]/60 border border-[#1e293b] rounded-xl p-3">
                      <p className="text-sm font-semibold text-white">{rec.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{rec.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Performance timeline */}
        {report.performanceTimeline.length > 0 && (
          <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-indigo-400" />
              Performance Timeline
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.performanceTimeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="round" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(r) => `R${r}`} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f1629', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(r) => `Round ${r}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="attackerCumulativeScore" name="Attacker Total" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="defenderCumulativeScore" name="Defender Total" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Category breakdown — attacker & defender, separately */}
        {[
          { label: 'Attacker Category Breakdown', accent: 'text-red-400', unit: 'successful attacks', categories: report.attackerCategories },
          { label: 'Defender Category Breakdown', accent: 'text-teal-400', unit: 'successful defenses', categories: report.defenderCategories },
        ].map(({ label, accent, unit, categories }) => categories.length > 0 && (
          <motion.div key={label} variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${accent}`}>
              <BarChart2 size={15} />
              {label}
            </h3>
            <div className="space-y-3">
              {categories.map(c => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{c.category}</span>
                    <span className="text-xs font-semibold text-white">
                      {c.succeeded}/{c.total} {unit} ({c.accuracy}%)
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
        ))}

        {/* Strong & Weak topics — attacker & defender, separately */}
        {[
          { role: 'Attacker', strong: report.attackerStrongTopics, weak: report.attackerWeakTopics },
          { role: 'Defender', strong: report.defenderStrongTopics, weak: report.defenderWeakTopics },
        ].map(({ role, strong, weak }) => (strong.length > 0 || weak.length > 0) && (
          <motion.div key={role} variants={itemVariants} className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium px-1">{role} Topics</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strong.length > 0 && (
                <div className="bg-teal-950/10 border border-teal-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={15} className="text-teal-400" />
                    <span className="text-sm font-semibold text-teal-400">Strong Topics</span>
                  </div>
                  <ul className="space-y-1.5">
                    {strong.map(t => (
                      <li key={t} className="flex items-center gap-2 text-sm text-gray-300">
                        <CheckCircle size={12} className="text-teal-400 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {weak.length > 0 && (
                <div className="bg-red-950/10 border border-red-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={15} className="text-red-400" />
                    <span className="text-sm font-semibold text-red-400">Topics to Review</span>
                  </div>
                  <ul className="space-y-1.5">
                    {weak.map(t => (
                      <li key={t} className="flex items-center gap-2 text-sm text-gray-300">
                        <BookOpen size={12} className="text-red-400 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Recommendations — attacker & defender, separate lists */}
        {[
          { label: 'Attacker Recommendations', accent: 'text-red-400', recs: report.attackerRecommendations },
          { label: 'Defender Recommendations', accent: 'text-teal-400', recs: report.defenderRecommendations },
        ].map(({ label, accent, recs }) => recs.length > 0 && (
          <motion.div key={label} variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${accent}`}>
              <Lightbulb size={15} className="text-yellow-400" />
              {label}
            </h3>
            <ul className="space-y-3">
              {recs.map(rec => (
                <li key={rec.category + rec.title} className="bg-[#0f1629]/60 border border-[#1e293b] rounded-xl p-3">
                  <p className="text-sm font-semibold text-white">{rec.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{rec.description}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}

        {/* CSV Data Export */}
        <motion.div variants={itemVariants} className="bg-[#0a0f1e] border border-[#1e293b] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <FileSpreadsheet size={15} className="text-indigo-400" />
            Export Data
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Raw CSV exports for this session, identified by participant ID rather than name.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'events', label: 'Download Event Log CSV', fetcher: exportApi.downloadEventsCsv, filename: `events-${report.sessionId}.csv` },
              { key: 'attempts', label: 'Download Learner Attempts CSV', fetcher: exportApi.downloadAttemptsCsv, filename: `attempts-${report.sessionId}.csv` },
              { key: 'results', label: 'Download Assessment Results CSV', fetcher: exportApi.downloadResultsCsv, filename: `results-${report.sessionId}.csv` },
            ].map(({ key, label, fetcher, filename }) => (
              <button
                key={key}
                onClick={() => handleCsvDownload(key, fetcher, filename)}
                disabled={downloadingCsv !== null}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800/50 disabled:opacity-50 transition-colors text-xs font-medium text-center"
              >
                {downloadingCsv === key ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                {label}
              </button>
            ))}
          </div>
        </motion.div>

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
