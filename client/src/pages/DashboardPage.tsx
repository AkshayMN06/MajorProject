import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, FlaskConical, BarChart3, ArrowRight } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Panel */}
      <motion.div variants={itemVariants} className="text-center py-10">
        <h2 className="text-4xl font-extrabold text-white tracking-wide mb-4">
          Welcome,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9]">
            Decrypt your potential
          </span>
        </h2>
        <p className="text-[#0ea5e9] text-base font-medium tracking-wide max-w-2xl mx-auto leading-relaxed">
          Assess your cybersecurity journey, strengthen your defenses, and stay one step ahead of evolving cyber threats.
        </p>
      </motion.div>

      {/* Feature Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Scenario Assessment */}
        <motion.div variants={itemVariants} onClick={() => navigate('/scenario')} className="relative group rounded-2xl overflow-hidden bg-[#0f1629]/80 backdrop-blur-md border border-[#1e293b] hover:border-red-500/50 transition-colors duration-500 shadow-xl cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="absolute -right-8 -top-8 w-48 h-48 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors duration-500"></div>
          <div className="absolute right-6 top-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
            <Target className="w-32 h-32 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" strokeWidth={1} />
          </div>

          <div className="relative p-8 flex flex-col h-full z-10">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <Target className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-wide">SCENARIO ASSESSMENT</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed flex-1">
              Assess your knowledge with real-world cybersecurity scenarios.
            </p>
            <button onClick={() => navigate('/scenario')} className="flex items-center text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors w-max">
              Start Assessment <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Practice Labs */}
        <motion.div variants={itemVariants} onClick={() => navigate('/labs')} className="relative group rounded-2xl overflow-hidden bg-[#0f1629]/80 backdrop-blur-md border border-[#1e293b] hover:border-teal-500/50 transition-colors duration-500 shadow-xl cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="absolute -right-8 -top-8 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-colors duration-500"></div>
          <div className="absolute right-6 top-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
            <FlaskConical className="w-32 h-32 text-teal-500 drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]" strokeWidth={1} />
          </div>

          <div className="relative p-8 flex flex-col h-full z-10">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(20,184,166,0.2)]">
              <FlaskConical className="w-6 h-6 text-teal-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-wide">PRACTICE LABS</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed flex-1">
              Hands-on labs to strengthen your practical skills.
            </p>
            <button onClick={() => navigate('/labs')} className="flex items-center text-sm font-semibold text-teal-400 group-hover:text-teal-300 transition-colors w-max">
              Go to Labs <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Analytics */}
        <motion.div variants={itemVariants} onClick={() => navigate('/analytics')} className="relative group rounded-2xl overflow-hidden bg-[#0f1629]/80 backdrop-blur-md border border-[#1e293b] hover:border-purple-500/50 transition-colors duration-500 shadow-xl cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="absolute -right-8 -top-8 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors duration-500"></div>
          <div className="absolute right-6 top-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
            <BarChart3 className="w-32 h-32 text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" strokeWidth={1} />
          </div>

          <div className="relative p-8 flex flex-col h-full z-10">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-6 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              <BarChart3 className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-wide">ANALYTICS</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed flex-1">
              Track your performance and identify areas to improve.
            </p>
            <button onClick={() => navigate('/analytics')} className="flex items-center text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors w-max">
              View Analytics <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
