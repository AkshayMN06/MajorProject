import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Info, Activity, Target, CheckCircle, XCircle,
  TrendingUp, Clock, AlertTriangle, Shield, Award, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell
} from 'recharts';
import { analyticsApi } from '../services/api';
import type { AnalyticsSummary, PerformanceTrendPoint, CategoryAccuracy, RecentActivityItem } from '../services/api';

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<PerformanceTrendPoint[]>([]);
  const [categories, setCategories] = useState<CategoryAccuracy[]>([]);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, t, c, a] = await Promise.all([
          analyticsApi.getSummary(),
          analyticsApi.getTrends(),
          analyticsApi.getCategories(),
          analyticsApi.getActivity(),
        ]);
        if (cancelled) return;
        setSummary(s);
        setTrends(t);
        setCategories(c);
        setActivity(a);
      } catch {
        if (!cancelled) setError('Could not load your analytics. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-cyber-blue" size={32} />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 text-red-200 text-sm px-5 py-4 rounded-xl max-w-md">
          <AlertTriangle size={16} className="flex-shrink-0 text-red-400" />
          <span>{error ?? 'Could not load your analytics.'}</span>
        </div>
      </div>
    );
  }

  const correctPct = Math.round(summary.averageScore);
  const incorrectPct = 100 - correctPct;
  const totalDecisions = summary.correctDecisions + summary.incorrectDecisions;
  const decisionData = [
    { name: 'Correct', value: summary.correctDecisions, color: '#22c55e' },
    { name: 'Incorrect', value: summary.incorrectDecisions, color: '#ef4444' },
  ];

  const strongCategories = [...categories].sort((a, b) => b.accuracy - a.accuracy).filter((c) => c.accuracy >= 70).slice(0, 2);
  const weakCategory = [...categories].sort((a, b) => a.accuracy - b.accuracy).find((c) => c.accuracy < 70);

  if (summary.scenariosAttempted === 0) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">ANALYTICS DASHBOARD</h1>
          <div className="glass-card p-10 rounded-xl border border-cyber-border bg-white/5 text-center">
            <Activity className="mx-auto mb-4 text-gray-500" size={32} />
            <p className="text-gray-300 font-medium">No activity yet.</p>
            <p className="text-gray-500 text-sm mt-2">Complete a Scenario Assessment to start building your analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12 overflow-hidden">

      {/* Background ambient glows */}
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header Row */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">ANALYTICS DASHBOARD</h1>
          </motion.div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="TOTAL SESSIONS"
            value={String(summary.totalSessions)}
            icon={<Activity size={20} />}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/20"
            delay={0.1}
          />
          <MetricCard
            title="SCENARIOS ATTEMPTED"
            value={String(summary.scenariosAttempted)}
            icon={<Target size={20} />}
            iconColor="text-purple-400"
            iconBg="bg-purple-500/20"
            delay={0.2}
          />
          <MetricCard
            title="CORRECT DECISIONS"
            value={`${correctPct}%`}
            icon={<CheckCircle size={20} />}
            iconColor="text-green-400"
            iconBg="bg-green-500/20"
            delay={0.3}
          />
          <MetricCard
            title="INCORRECT DECISIONS"
            value={`${incorrectPct}%`}
            icon={<XCircle size={20} />}
            iconColor="text-red-400"
            iconBg="bg-red-500/20"
            delay={0.4}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Performance Over Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5"
          >
            <div className="flex items-center space-x-2 mb-6">
              <h3 className="text-lg font-bold">PERFORMANCE OVER TIME</h3>
              <Info size={16} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
            </div>

            {trends.length > 0 ? (
              <>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis yAxisId="left" stroke="#a855f7" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke="#22d3ee" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="accuracy" name="Accuracy (%)" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#a855f7' }} activeDot={{ r: 6 }} />
                      <Line yAxisId="right" type="monotone" dataKey="responseTime" name="Avg Time (s)" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center space-x-6 mt-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-gray-400">Accuracy (%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                    <span className="text-gray-400">Response Time (s)</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel text="Complete an assessment to start plotting your progress over time." />
            )}
          </motion.div>

          {/* Accuracy By Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5"
          >
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-bold">ACCURACY BY CATEGORY</h3>
              <Info size={16} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
            </div>

            {categories.length > 0 ? (
              <div className="h-80 w-full flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={categories.map((c) => ({ subject: c.category, A: Math.round(c.accuracy), fullMark: 100 }))}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b' }} axisLine={false} />
                    <Radar name="Accuracy" dataKey="A" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel text="No category data yet." />
            )}
          </motion.div>

        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Decision Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5 flex flex-col"
          >
            <div className="flex items-center space-x-2 mb-6">
              <h3 className="text-lg font-bold">DECISION BREAKDOWN</h3>
              <Info size={16} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
            </div>

            {totalDecisions > 0 ? (
              <>
                <div className="flex-1 relative flex justify-center items-center min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={decisionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {decisionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-white">{totalDecisions}</span>
                    <span className="text-xs text-gray-400">Total Decisions</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-300">Correct</span>
                    </div>
                    <span className="font-bold text-white">{summary.correctDecisions} ({correctPct}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-gray-300">Incorrect</span>
                    </div>
                    <span className="font-bold text-white">{summary.incorrectDecisions} ({incorrectPct}%)</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel text="No decisions recorded yet." />
            )}
          </motion.div>

          {/* Response Time Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5 flex flex-col"
          >
            <div className="flex items-center space-x-2 mb-6">
              <h3 className="text-lg font-bold">RESPONSE TIME</h3>
              <Info size={16} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
            </div>

            <div className="flex-1 flex flex-col justify-center items-center py-6">
              <div className="w-24 h-24 rounded-full border-4 border-cyan-500/30 flex items-center justify-center relative mb-4">
                <div className="absolute inset-0 rounded-full border-t-4 border-cyan-400 animate-spin" style={{ animationDuration: '3s' }}></div>
                <Clock className="text-cyan-400 absolute opacity-20" size={48} />
                <span className="text-2xl font-bold text-white relative z-10">{summary.averageResponseTime.toFixed(1)}s</span>
              </div>
              <p className="text-gray-400 text-sm">Average Response Time</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-white/10">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Fastest</p>
                <p className="text-sm font-bold text-green-400">{summary.responseTimeStats ? `${summary.responseTimeStats.fastest}s` : '—'}</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-xs text-gray-500 mb-1">Median</p>
                <p className="text-sm font-bold text-white">{summary.responseTimeStats ? `${summary.responseTimeStats.median}s` : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Slowest</p>
                <p className="text-sm font-bold text-red-400">{summary.responseTimeStats ? `${summary.responseTimeStats.slowest}s` : '—'}</p>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5 lg:col-span-1"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold">RECENT ACTIVITY</h3>
                <Info size={16} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
              </div>
            </div>

            {activity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-black/20">
                    <tr>
                      <th className="px-3 py-2 rounded-l-lg">Scenario</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Acc</th>
                      <th className="px-3 py-2 rounded-r-lg">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-3 font-medium text-gray-300 truncate max-w-[120px] xl:max-w-[150px]" title={item.scenario}>
                          {item.scenario}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            item.role === 'defender'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {item.role === 'defender' ? <Shield size={10} className="inline mr-1" /> : <Target size={10} className="inline mr-1" />}
                            {item.role === 'defender' ? 'Defender' : 'Attacker'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-white">{item.accuracy}%</td>
                        <td className="px-3 py-3 text-gray-400">{item.time}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel text="No recent activity yet." />
            )}
          </motion.div>

        </div>

        {/* Bottom Banner: Key Insights */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="glass-card p-6 rounded-xl border border-cyber-border bg-gradient-to-br from-gray-900/80 to-black mt-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold flex items-center space-x-2 text-white">
              <span className="w-1 h-6 bg-yellow-400 rounded"></span>
              <span>KEY INSIGHTS</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-4 items-start">
              <div className={`p-2 rounded-lg shrink-0 mt-1 ${summary.accuracyChangeVsLastWeek !== null && summary.accuracyChangeVsLastWeek < 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                <TrendingUp size={20} />
              </div>
              <p className="text-sm text-gray-300">
                {summary.accuracyChangeVsLastWeek === null ? (
                  <>Not enough history yet to compare against last week.</>
                ) : summary.accuracyChangeVsLastWeek >= 0 ? (
                  <>Your accuracy has improved by <span className="font-bold text-green-400">{summary.accuracyChangeVsLastWeek}%</span> compared to last week.</>
                ) : (
                  <>Your accuracy has dropped by <span className="font-bold text-red-400">{Math.abs(summary.accuracyChangeVsLastWeek)}%</span> compared to last week.</>
                )}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-4 items-start">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg shrink-0 mt-1">
                <Award size={20} />
              </div>
              <p className="text-sm text-gray-300">
                {strongCategories.length > 0 ? (
                  <>Strong performance in <span className="font-bold text-white">{strongCategories.map((c) => c.category).join(' and ')}</span>.</>
                ) : (
                  <>Complete more assessments to surface your strongest areas.</>
                )}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex gap-4 items-start">
              <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg shrink-0 mt-1">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm text-gray-300">
                {weakCategory ? (
                  <>Focus more on <span className="font-bold text-white">{weakCategory.category}</span> to improve weak areas.</>
                ) : (
                  <>No weak areas detected yet.</>
                )}
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

const EmptyPanel = ({ text }: { text: string }) => (
  <div className="h-40 flex items-center justify-center text-center text-sm text-gray-500 px-6">{text}</div>
);

// Helper Component for Top Metrics
const MetricCard = ({ title, value, icon, iconColor, iconBg, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-5 rounded-xl border border-cyber-border bg-white/5 flex flex-col"
  >
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-gray-400 text-xs font-bold tracking-wider">{title}</h3>
      <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>
        {icon}
      </div>
    </div>
    <div className="mt-auto">
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  </motion.div>
);

export default AnalyticsPage;
