import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, ShieldCheck, Sparkles, Filter, ChevronDown, CheckCircle, Activity, Lightbulb } from 'lucide-react';
import { LabCard } from '../components/labs/LabCard';
import type { LabCardProps } from '../components/labs/LabCard';
import { AIChatPanel } from '../components/labs/AIChatPanel';

const MOCK_LABS: LabCardProps[] = [
  {
    id: '1',
    name: 'Phishing Simulation',
    description: 'Learn to craft and identify sophisticated phishing campaigns to test organizational awareness.',
    type: 'attack',
    difficulty: 'Easy',
    rating: 4.6,
    ratingCount: 120,
    duration: 30,
    iconName: 'bug',
  },
  {
    id: '2',
    name: 'SQL Injection Lab',
    description: 'Exploit vulnerable database queries to extract sensitive information and understand mitigation.',
    type: 'attack',
    difficulty: 'Medium',
    rating: 4.8,
    ratingCount: 210,
    duration: 45,
    iconName: 'database',
  },
  {
    id: '3',
    name: 'Firewall Configuration',
    description: 'Set up rules to block malicious traffic while allowing legitimate services to function normally.',
    type: 'defense',
    difficulty: 'Medium',
    rating: 4.7,
    ratingCount: 160,
    duration: 40,
    iconName: 'shield',
  },
  {
    id: '4',
    name: 'IDS Response Lab',
    description: 'Analyze Intrusion Detection System alerts and respond to simulated network attacks.',
    type: 'defense',
    difficulty: 'Hard',
    rating: 4.9,
    ratingCount: 190,
    duration: 50,
    iconName: 'radio',
  },
];

const TABS = ['All Labs', 'Web Security', 'Network Security', 'System Security', 'Social Engineering'];

export const PracticeLabsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('All Labs');

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12 overflow-hidden">
      
      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyber-blue/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">PRACTICE LABS</h1>
          <p className="text-gray-400">Master cybersecurity skills through hands-on scenarios.</p>
        </motion.div>

        {/* Layout with Main Content and Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Content Area */}
          <div className="flex-1 space-y-12">
            
            {/* Section 1: Choose Mode */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center space-x-2 text-gray-200">
                <span className="w-1 h-6 bg-cyber-blue rounded"></span>
                <span>CHOOSE YOUR PRACTICE MODE</span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Attack Mode Card */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="glass-card p-6 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-900/20 to-black relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                  <div className="p-3 bg-red-500/20 text-red-400 rounded-lg w-fit mb-4">
                    <Target size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">ATTACK MODE</h3>
                  <p className="text-gray-400 text-sm mb-6">Learn offensive techniques. Execute attacks in a safe environment and understand how they work.</p>
                  <button className="text-red-400 font-semibold hover:text-red-300 transition-colors flex items-center group-hover:underline">
                    Choose Attack Mode &rarr;
                  </button>
                </motion.div>

                {/* Defense Mode Card */}
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="glass-card p-6 rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-900/20 to-black relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
                  <div className="p-3 bg-teal-500/20 text-teal-400 rounded-lg w-fit mb-4">
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">DEFENSE MODE</h3>
                  <p className="text-gray-400 text-sm mb-6">Learn defensive strategies. Protect systems, detect threats and respond effectively.</p>
                  <button className="text-teal-400 font-semibold hover:text-teal-300 transition-colors flex items-center group-hover:underline">
                    Choose Defense Mode &rarr;
                  </button>
                </motion.div>

                {/* How it Works Card */}
                <div className="glass-card p-6 rounded-xl border border-cyber-border bg-white/5">
                  <h3 className="text-lg font-bold text-white mb-4">HOW IT WORKS</h3>
                  <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex gap-3"><span className="text-cyber-blue font-bold">1</span> Choose Mode - Attack or Defense</li>
                    <li className="flex gap-3"><span className="text-cyber-blue font-bold">2</span> Select Lab - Pick a lab to practice</li>
                    <li className="flex gap-3"><span className="text-cyber-blue font-bold">3</span> Interact & Learn - Perform actions in the lab</li>
                    <li className="flex gap-3"><span className="text-cyber-blue font-bold">4</span> Get Feedback - AI evaluates and gives insights</li>
                    <li className="flex gap-3"><span className="text-cyber-blue font-bold">5</span> Improve Skills - Track progress and level up</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2: Select a Lab */}
            <section>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold flex items-center space-x-2 text-gray-200">
                  <span className="w-1 h-6 bg-cyber-blue rounded"></span>
                  <span>SELECT A LAB</span>
                </h2>
                
                {/* Tabs */}
                <div className="flex space-x-2 overflow-x-auto max-w-full pb-2 hide-scrollbar">
                  {TABS.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                        activeTab === tab 
                          ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50' 
                          : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lab Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {MOCK_LABS.map((lab, idx) => (
                  <motion.div
                    key={lab.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <LabCard {...lab} />
                  </motion.div>
                ))}
              </div>
            </section>

            {/* AI Powered Banner */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="glass-card rounded-xl p-6 border border-indigo-500/30 bg-gradient-to-r from-indigo-900/30 to-purple-900/10 flex flex-col sm:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">AI-POWERED LEARNING</h3>
                  <p className="text-gray-300 text-sm">Our AI analyzes your actions and provides real-time feedback, hints, and personalized recommendations.</p>
                </div>
              </div>
              <button className="shrink-0 px-6 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-500/30 rounded-lg font-medium transition-colors whitespace-nowrap">
                Learn More &rarr;
              </button>
            </motion.div>

          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 space-y-6 shrink-0">
            
            {/* AI Tutor Card - Now a full chat panel */}
            <AIChatPanel />

            {/* Your Stats */}
            <div className="glass-card rounded-xl border border-cyber-border bg-white/5 p-5">
              <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                <Activity size={18} className="text-cyber-blue" />
                YOUR STATS
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Labs Completed</span>
                  <span className="font-bold text-white">12</span>
                </div>
                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                  <div className="bg-cyber-blue h-full w-[60%]"></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Best Score</span>
                  <span className="font-bold text-green-400">92%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Average Score</span>
                  <span className="font-bold text-yellow-400">78%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Time Spent</span>
                  <span className="font-bold text-white">6h 45m</span>
                </div>
              </div>
            </div>

            {/* Learning Tips */}
            <div className="glass-card rounded-xl border border-cyber-border bg-white/5 p-5">
              <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                <Lightbulb size={18} className="text-yellow-400" />
                LEARNING TIPS
              </h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-cyber-blue mt-1 shrink-0" />
                  <span>Review network logs before taking action in defense labs.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-cyber-blue mt-1 shrink-0" />
                  <span>Use the AI tutor if you get stuck for more than 5 minutes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-cyber-blue mt-1 shrink-0" />
                  <span>Try both attack and defense sides of the same vulnerability.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeLabsPage;
