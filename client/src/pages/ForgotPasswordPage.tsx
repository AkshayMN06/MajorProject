import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Shield, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

export const ForgotPasswordPage: React.FC = () => {
  usePageTitle('Forgot Password');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
    } catch {
      // Intentionally ignored — the backend already returns the same
      // generic success response regardless of outcome, so there is
      // nothing more specific to show here even on a network error.
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-gray-200 flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyber-blue/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative z-10 border border-cyber-border shadow-[0_0_40px_rgba(0,212,255,0.1)]"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,212,255,0.3)]">
            <Shield size={32} className="text-cyber-blue" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-white">Forgot Password</h1>
          <p className="text-sm text-gray-400 mt-2 text-center">
            Enter your account email and we'll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-5">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-green-900/20 border border-green-500/30 text-green-300 text-sm">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>If an account exists, a reset link has been sent.</span>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-cyber-blue hover:underline">
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm text-gray-400 pl-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-900/80 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue transition-all placeholder:text-gray-600"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-cyber-blue transition-colors">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
