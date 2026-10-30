import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { moduleApi, type ModuleSummary } from '../services/api';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];

const difficultyClass = (d: string) =>
  d === 'Easy'
    ? 'bg-green-500/15 border-green-500/40 text-green-400'
    : d === 'Hard'
    ? 'bg-red-500/15 border-red-500/40 text-red-400'
    : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400';

const ModuleCard: React.FC<{ mod: ModuleSummary; onOpen: () => void; delay: number }> = ({ mod, onOpen, delay }) => {
  const pct = mod.lessonCount > 0 ? Math.round((mod.completedLessonCount / mod.lessonCount) * 100) : 0;
  const done = pct === 100;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02 }}
      onClick={onOpen}
      className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5 flex flex-col text-left w-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg w-fit">
          <BookOpen size={24} />
        </div>
        {done && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-400">
            <CheckCircle2 size={14} /> Completed
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold text-white mb-1">{mod.name}</h3>
      <p className="text-xs text-indigo-400 mb-3">{mod.category}</p>
      <p className="text-sm text-gray-400 mb-6 flex-1">{mod.description}</p>

      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
        <span className={`px-2 py-0.5 rounded-full border font-medium ${difficultyClass(mod.difficulty)}`}>
          {mod.difficulty}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {mod.duration} min
        </span>
      </div>

      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>{mod.completedLessonCount} / {mod.lessonCount} lessons</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </motion.button>
  );
};

export const ModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [difficulty, setDifficulty] = useState('All');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await moduleApi.getAll();
        if (!cancelled) setModules(data);
      } catch {
        if (!cancelled) setError('Could not load modules. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = difficulty === 'All' ? modules : modules.filter((m) => m.difficulty === difficulty);

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12 overflow-hidden">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">MODULES</h1>
          <p className="text-gray-400">Study the concepts behind each Scenario Assessment category before you're tested on them.</p>
        </motion.div>

        <div className="flex items-center gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                difficulty === d
                  ? 'bg-indigo-600/90 border-indigo-500 text-white'
                  : 'bg-white/5 border-cyber-border text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm px-5 py-4 rounded-xl max-w-md">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((m, idx) => (
              <ModuleCard key={m.id} mod={m} delay={idx * 0.08} onOpen={() => navigate(`/modules/${m.id}`)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-gray-500 text-sm col-span-full text-center py-12">No modules match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulesPage;
