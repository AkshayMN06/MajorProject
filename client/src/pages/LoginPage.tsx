import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';

export const LoginPage: React.FC = () => {
  usePageTitle('Sign In');
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error is handled in store, but we catch to prevent unhandled rejections
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-gray-200 flex items-center justify-center relative overflow-hidden p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyber-blue/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative z-10 border border-cyber-border shadow-[0_0_40px_rgba(0,212,255,0.1)]"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,212,255,0.3)]">
            <Shield size={32} className="text-cyber-blue" />
          </div>
          <h1 className="text-3xl font-bold tracking-wider text-white">CYBER<span className="text-cyber-blue">LEARN</span></h1>
          <p className="text-xs text-cyber-blue tracking-widest mt-2 font-mono">LEARN. ASSESS. IMPROVE.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/50 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-white">&times;</button>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-gray-400 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="defender@example.com"
                className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue transition-all placeholder:text-gray-600"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-400 pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-10 pr-10 text-white focus:outline-none focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue transition-all placeholder:text-gray-600"
                required
                disabled={isLoading}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <a href="#" className="text-xs text-cyber-blue hover:underline">Forgot password?</a>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Don't have an account? <a href="/register" className="text-cyber-blue hover:underline font-medium">Sign up</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
