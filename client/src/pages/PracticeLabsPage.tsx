import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ModuleCard } from '../components/labs/ModuleCard';
import { practiceApi } from '../services/api';
import type { PracticeModule } from '../services/api';

export const PracticeLabsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<PracticeModule[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await practiceApi.getModules();
        if (!cancelled) setModules(data);
      } catch {
        if (!cancelled) setError('Could not load practice modules. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12 overflow-hidden">

      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">PRACTICE LABS</h1>
          <p className="text-gray-400">Learn and test your cybersecurity knowledge through quick MCQs.</p>
        </motion.div>

        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center space-x-2 text-gray-200">
            <span className="w-1 h-6 bg-cyber-blue rounded"></span>
            <span>CHOOSE A MODULE TO PRACTICE</span>
          </h2>

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
              {modules.map((m, idx) => (
                <motion.div
                  key={m.module}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <ModuleCard
                    module={m.module}
                    questionCount={m.questionCount}
                    questionsPerSession={m.questionsPerSession}
                    difficulty={m.difficulty}
                    onStart={() => navigate(`/labs/${encodeURIComponent(m.module)}`)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PracticeLabsPage;
