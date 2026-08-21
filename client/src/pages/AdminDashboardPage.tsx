import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, ClipboardCheck, TrendingUp, TrendingDown, Minus, Download,
  Search, Loader2, AlertTriangle, ShieldCheck, Filter, X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { adminApi } from '../services/api';
import type { AdminStats, AdminOverallStats, AdminImprovementRow, AdminCategoryAggregate, AdminUser, AdminAnalyticsFilters } from '../services/api';

const MODULES = ['Web Security', 'Network Security', 'System Security', 'Social Engineering', 'Cryptography'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function formatPP(n: number): string {
  return `${n > 0 ? '+' : ''}${n} pp`;
}

function formatPct(n: number): string {
  return `${n}%`;
}

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AdminAnalyticsFilters>({});
  const [overall, setOverall] = useState<AdminOverallStats | null>(null);
  const [rows, setRows] = useState<AdminImprovementRow[]>([]);
  const [moduleSummary, setModuleSummary] = useState<AdminCategoryAggregate[]>([]);
  const [difficultySummary, setDifficultySummary] = useState<AdminCategoryAggregate[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const analyticsSeq = useRef(0);

  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const USERS_PAGE_SIZE = 10;

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Global, unfiltered summary cards — fetched once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminApi.getStats();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStatsError('Could not load dashboard statistics.');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filtered analytics — re-fetches whenever filters change. Uses a
  // sequence ref rather than a bare `cancelled` boolean so an overlapping
  // slow response from an earlier filter can never overwrite a newer one.
  useEffect(() => {
    const seq = ++analyticsSeq.current;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    (async () => {
      try {
        const data = await adminApi.getAnalytics(filters);
        if (analyticsSeq.current !== seq) return;
        setOverall(data.overall);
        setRows(data.rows);
        setModuleSummary(data.moduleSummary);
        setDifficultySummary(data.difficultySummary);
      } catch {
        if (analyticsSeq.current === seq) setAnalyticsError('Could not load improvement analytics.');
      } finally {
        if (analyticsSeq.current === seq) setAnalyticsLoading(false);
      }
    })();
  }, [filters]);

  // Debounced user search + pagination.
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await adminApi.getUsers({ search: userSearch || undefined, page: userPage, pageSize: USERS_PAGE_SIZE });
        if (cancelled) return;
        setUsers(data.users);
        setUsersTotal(data.total);
      } catch {
        // Non-fatal — leave the previous page's rows visible rather than blanking the table.
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }, userSearch ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userSearch, userPage]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await adminApi.exportExcel(filters);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      let message = 'Failed to export the Excel report.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          message = JSON.parse(text).error ?? message;
        } catch { /* fall back to the generic message */ }
      }
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  const totalUserPages = Math.max(1, Math.ceil(usersTotal / USERS_PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <ShieldCheck className="text-cyan-400" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">User participation & Pre-Test/Post-Test improvement analytics</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Signed in as <span className="text-white font-semibold">{user?.name}</span>
        </div>
      </div>

      {statsError && <ErrorPill message={statsError} />}

      {/* Global summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="TOTAL USERS" value={statsLoading ? '—' : String(stats?.totalUsers ?? 0)} icon={<Users size={18} />} iconColor="text-cyan-400" iconBg="bg-cyan-500/20" delay={0.05} />
        <MetricCard title="ASSESSMENT ATTEMPTS" value={statsLoading ? '—' : String(stats?.pairCount ?? 0)} icon={<ClipboardCheck size={18} />} iconColor="text-purple-400" iconBg="bg-purple-500/20" delay={0.1} />
        <MetricCard title="AVG PRE-TEST" value={statsLoading ? '—' : formatPct(stats?.avgPrePct ?? 0)} icon={<TrendingDown size={18} />} iconColor="text-amber-400" iconBg="bg-amber-500/20" delay={0.15} />
        <MetricCard title="AVG POST-TEST" value={statsLoading ? '—' : formatPct(stats?.avgPostPct ?? 0)} icon={<TrendingUp size={18} />} iconColor="text-green-400" iconBg="bg-green-500/20" delay={0.2} />
        <MetricCard title="AVG IMPROVEMENT" value={statsLoading ? '—' : formatPP(stats?.avgImprovementPP ?? 0)} icon={<TrendingUp size={18} />} iconColor="text-cyan-400" iconBg="bg-cyan-500/20" delay={0.25} />
      </div>

      {/* Filters */}
      <div className="glass-card p-5 rounded-xl border border-cyber-border bg-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Filters</h3>
          {(filters.module || filters.difficulty || filters.startDate || filters.endDate) && (
            <button onClick={() => setFilters({})} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FilterSelect
            label="Module"
            value={filters.module ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, module: v || undefined }))}
            options={[{ value: '', label: 'All Modules' }, ...MODULES.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            label="Difficulty"
            value={filters.difficulty ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, difficulty: v || undefined }))}
            options={[{ value: '', label: 'All Difficulties' }, ...DIFFICULTIES.map((d) => ({ value: d, label: d }))]}
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Start Date</label>
            <input
              type="date"
              value={filters.startDate?.slice(0, 10) ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
              className="w-full bg-black/30 border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">End Date</label>
            <input
              type="date"
              value={filters.endDate?.slice(0, 10) ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
              className="w-full bg-black/30 border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      </div>

      {/* Pre-test vs Post-test numerical summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
        <h3 className="text-lg font-bold text-white mb-1">Pre-Test vs Post-Test Improvement</h3>
        <p className="text-xs text-gray-500 mb-6">Numbers reflect the filters above. Only fully completed Pre-Test → Scenario Assessment → Post-Test cycles are counted; Practice Labs and incomplete attempts are excluded.</p>

        {analyticsError && <ErrorPill message={analyticsError} />}

        {analyticsLoading ? (
          <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-cyber-blue" size={28} /></div>
        ) : !overall || overall.pairCount === 0 ? (
          <EmptyPanel text="No completed Pre-Test/Post-Test cycles match these filters yet." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="grid grid-cols-3 gap-4">
              <NumberStat label="Average Pre-Test" value={formatPct(overall.avgPrePct)} />
              <NumberStat label="Average Post-Test" value={formatPct(overall.avgPostPct)} />
              <NumberStat label="Average Improvement" value={formatPP(overall.avgImprovementPP)} highlight={overall.avgImprovementPP >= 0 ? 'positive' : 'negative'} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Attempt Improvement Summary</p>
              <div className="space-y-2">
                <CategoryBar icon={<TrendingUp size={14} />} label="Attempts Improved" count={overall.improved} total={overall.pairCount} color="bg-green-500" textColor="text-green-400" />
                <CategoryBar icon={<Minus size={14} />} label="Attempts Unchanged" count={overall.unchanged} total={overall.pairCount} color="bg-gray-500" textColor="text-gray-400" />
                <CategoryBar icon={<TrendingDown size={14} />} label="Attempts Decreased" count={overall.decreased} total={overall.pairCount} color="bg-red-500" textColor="text-red-400" />
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Module / Difficulty breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryTable title="Module Performance" rows={moduleSummary} loading={analyticsLoading} emptyText="No module data for these filters." />
        <CategoryTable title="Difficulty Performance" rows={difficultySummary} loading={analyticsLoading} emptyText="No difficulty data for these filters." />
      </div>

      {/* User-level improvement rows */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
        <h3 className="text-lg font-bold text-white mb-4">User-Level Improvement</h3>
        {analyticsLoading ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-cyber-blue" size={24} /></div>
        ) : rows.length === 0 ? (
          <EmptyPanel text="No completed attempts to show for these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-black/20">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">User</th>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2">Difficulty</th>
                  <th className="px-3 py-2">Pre-Test</th>
                  <th className="px-3 py-2">Post-Test</th>
                  <th className="px-3 py-2 rounded-r-lg">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={`${r.sessionId}:${r.userId}`} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-200">{r.userName}</div>
                      <div className="text-xs text-gray-500">{r.userEmail}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{r.moduleTag ?? 'Not Available'}</td>
                    <td className="px-3 py-3 text-gray-300">{r.difficulty ?? 'Not Available'}</td>
                    <td className="px-3 py-3 text-gray-300">{r.preScore}/{r.preTotal} <span className="text-gray-500">({formatPct(r.prePct)})</span></td>
                    <td className="px-3 py-3 text-gray-300">{r.postScore}/{r.postTotal} <span className="text-gray-500">({formatPct(r.postPct)})</span></td>
                    <td className={`px-3 py-3 font-bold ${r.category === 'improved' ? 'text-green-400' : r.category === 'decreased' ? 'text-red-400' : 'text-gray-400'}`}>
                      {r.ppImprovement > 0 ? '+' : ''}{r.ppImprovement}pp ({r.rawImprovement >= 0 ? '+' : ''}{r.rawImprovement})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="text-xs text-gray-500 mt-3">Showing 50 of {rows.length} attempts — export the Excel report for the full list.</p>}
          </div>
        )}
      </motion.div>

      {/* Registered users */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-white">Registered Users {usersTotal > 0 && <span className="text-gray-500 font-normal text-sm">({usersTotal})</span>}</h3>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
              placeholder="Search users..."
              className="w-full bg-black/30 border border-cyber-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-cyber-blue" size={24} /></div>
        ) : users.length === 0 ? (
          <EmptyPanel text="No users found." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-black/20">
                  <tr>
                    <th className="px-3 py-2 rounded-l-lg">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Joined</th>
                    <th className="px-3 py-2 rounded-r-lg">Quiz Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-3 font-medium text-gray-200">{u.name}</td>
                      <td className="px-3 py-3 text-gray-400">{u.email}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/10 text-gray-400 border border-white/10'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-gray-300">{u.quizAttemptCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalUserPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                <span>Page {userPage} of {totalUserPages}</span>
                <div className="flex gap-2">
                  <button disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-cyber-border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors">Previous</button>
                  <button disabled={userPage >= totalUserPages} onClick={() => setUserPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-cyber-border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Export */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {exportError && <ErrorPill message={exportError} />}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold text-sm transition-colors shadow-[0_0_20px_rgba(34,211,238,0.25)] disabled:shadow-none"
        >
          {exporting ? <><Loader2 size={16} className="animate-spin" /> Generating report...</> : <><Download size={16} /> Export Excel Report</>}
        </button>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, iconColor, iconBg, delay }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="glass-card p-5 rounded-xl border border-cyber-border bg-white/5 flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-gray-400 text-xs font-bold tracking-wider">{title}</h3>
      <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
    </div>
    <div className="mt-auto text-2xl font-bold text-white">{value}</div>
  </motion.div>
);

const NumberStat = ({ label, value, highlight }: { label: string; value: string; highlight?: 'positive' | 'negative' }) => (
  <div>
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${highlight === 'positive' ? 'text-green-400' : highlight === 'negative' ? 'text-red-400' : 'text-white'}`}>{value}</p>
  </div>
);

const CategoryBar = ({ icon, label, count, total, color, textColor }: { icon: React.ReactNode; label: string; count: number; total: number; color: string; textColor: string }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`flex items-center gap-1.5 ${textColor}`}>{icon} {label}</span>
        <span className="text-gray-300 font-semibold">{count} ({pct}%)</span>
      </div>
      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const CategoryTable = ({ title, rows, loading, emptyText }: { title: string; rows: AdminCategoryAggregate[]; loading: boolean; emptyText: string }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
    <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
    {loading ? (
      <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-cyber-blue" size={24} /></div>
    ) : rows.length === 0 ? (
      <EmptyPanel text={emptyText} />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-black/20">
            <tr>
              <th className="px-3 py-2 rounded-l-lg">{title.includes('Module') ? 'Module' : 'Difficulty'}</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Avg Pre</th>
              <th className="px-3 py-2">Avg Post</th>
              <th className="px-3 py-2 rounded-r-lg">Improvement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-3 font-medium text-gray-200">{r.category}</td>
                <td className="px-3 py-3 text-gray-400">{r.attempts}</td>
                <td className="px-3 py-3 text-gray-300">{formatPct(r.avgPrePct)}</td>
                <td className="px-3 py-3 text-gray-300">{formatPct(r.avgPostPct)}</td>
                <td className={`px-3 py-3 font-bold ${r.avgImprovementPP > 0 ? 'text-green-400' : r.avgImprovementPP < 0 ? 'text-red-400' : 'text-gray-400'}`}>{formatPP(r.avgImprovementPP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </motion.div>
);

const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/30 border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const EmptyPanel = ({ text }: { text: string }) => (
  <div className="h-32 flex items-center justify-center text-center text-sm text-gray-500 px-6">{text}</div>
);

const ErrorPill = ({ message }: { message: string }) => (
  <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 text-red-200 text-sm px-4 py-3 rounded-xl mb-4">
    <AlertTriangle size={16} className="flex-shrink-0 text-red-400" />
    <span>{message}</span>
  </div>
);

export default AdminDashboardPage;
