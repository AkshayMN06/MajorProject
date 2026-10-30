import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Loader2, AlertTriangle, Filter, X, Lock, LogIn, LogOut, KeyRound, Mail } from 'lucide-react';
import { adminApi } from '../services/api';
import type { SecurityEvent } from '../services/api';

const EVENT_TYPES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'ACCOUNT_LOCKED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
];

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  LOGIN_SUCCESS: { label: 'Login Success', icon: <LogIn size={13} />, color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  LOGIN_FAILURE: { label: 'Login Failure', icon: <LogOut size={13} />, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  ACCOUNT_LOCKED: { label: 'Account Locked', icon: <Lock size={13} />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  PASSWORD_CHANGED: { label: 'Password Changed', icon: <KeyRound size={13} />, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset Requested', icon: <Mail size={13} />, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  PASSWORD_RESET_COMPLETED: { label: 'Reset Completed', icon: <KeyRound size={13} />, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

const PAGE_SIZE = 20;

export const AdminSecurityPage: React.FC = () => {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await adminApi.getSecurityEvents({ type: type || undefined, page, pageSize: PAGE_SIZE });
        if (cancelled) return;
        setEvents(data.events);
        setTotal(data.total);
      } catch {
        if (!cancelled) setError('Could not load the security event log.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <ShieldAlert className="text-amber-400" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Security Events</h1>
            <p className="text-sm text-gray-400 mt-0.5">Login attempts, lockouts, and password changes across all accounts</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 rounded-xl border border-cyber-border bg-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Filter by type</h3>
          {type && (
            <button onClick={() => { setType(''); setPage(1); }} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
              <X size={12} /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setType(type === t ? '' : t); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                type === t ? TYPE_META[t].color : 'bg-black/30 border-cyber-border text-gray-400 hover:text-white'
              }`}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
        {error && (
          <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 text-red-200 text-sm px-4 py-3 rounded-xl mb-4">
            <AlertTriangle size={16} className="flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-cyber-blue" size={28} /></div>
        ) : events.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-center text-sm text-gray-500 px-6">No security events match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-black/20">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">Type</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">IP Address</th>
                  <th className="px-3 py-2">User Agent</th>
                  <th className="px-3 py-2 rounded-r-lg">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const meta = TYPE_META[ev.type] ?? { label: ev.type, icon: null, color: 'text-gray-400 bg-white/5 border-white/10' };
                  return (
                    <tr key={ev.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-200">{ev.user?.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{ev.email ?? ev.user?.email ?? 'unknown'}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-400 font-mono text-xs">{ev.ip ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs max-w-xs truncate" title={ev.userAgent ?? undefined}>{ev.userAgent ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-400 text-xs">{new Date(ev.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
            <span>Page {page} of {totalPages} &middot; {total} events</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-cyber-border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-cyber-border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors">Next</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminSecurityPage;
