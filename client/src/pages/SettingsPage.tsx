import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, Eye, EyeOff,
  LogOut, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';

// ─── Inline toast ─────────────────────────────────────────────────────────────
interface ToastProps { type: 'success' | 'error'; message: string; }
const Toast: React.FC<ToastProps> = ({ type, message }) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className={`flex items-center gap-2 mt-4 px-4 py-3 rounded-lg text-sm font-medium border ${
      type === 'success'
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}
  >
    {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
    {message}
  </motion.div>
);

// ─── Delete confirmation modal ────────────────────────────────────────────────
interface DeleteModalProps {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}
const DeleteModal: React.FC<DeleteModalProps> = ({ onConfirm, onCancel, isLoading }) => {
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const canDelete = confirmText === 'DELETE' && password.length >= 6;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-[#0f1629] border border-red-500/40 rounded-2xl p-8 max-w-md w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Trash2 className="text-red-500" size={20} />
          </div>
          <h3 className="text-xl font-bold text-white">Delete Account</h3>
        </div>

        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          This action is <span className="text-red-400 font-semibold">permanent and irreversible</span>.
          All your sessions, analytics, and data will be erased forever.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-4 text-white font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Enter your password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your current password"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-9 pr-10 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(password)}
            disabled={!canDelete || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {isLoading ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  usePageTitle('Settings');
  const navigate = useNavigate();
  const { logout, changePassword, deleteAccount, isLoading } = useAuthStore();

  // Password form state
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwStatus({ type: 'error', message: 'All fields are required.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwStatus({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPwStatus({ type: 'error', message: 'New password must differ from current password.' });
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwStatus({ type: 'success', message: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (password: string) => {
    setDeleteLoading(true);
    try {
      await deleteAccount(password);
      // deleteAccount in the store redirects to /login automatically
    } catch (err: any) {
      setShowDeleteModal(false);
      setDeleteLoading(false);
      // Error is stored in authStore but we surface it via alert for clarity
      alert(err.message || 'Failed to delete account. Please try again.');
    }
  };

  const passwordStrength = (pw: string) => {
    if (!pw) return null;
    if (pw.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '25%' };
    if (pw.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: '50%' };
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))
      return { label: 'Strong', color: 'bg-green-500', width: '100%' };
    return { label: 'Medium', color: 'bg-yellow-500', width: '75%' };
  };
  const strength = passwordStrength(newPassword);

  return (
    <>
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteModal
            onConfirm={handleDeleteAccount}
            onCancel={() => { if (!deleteLoading) setShowDeleteModal(false); }}
            isLoading={deleteLoading}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-cyber-bg-dark text-gray-200 p-6 pt-6 font-sans max-w-3xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your security and account preferences.</p>
        </motion.div>

        {/* ── Security: Change Password ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6 border border-cyber-border"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Shield className="text-cyber-blue" size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Security</h2>
              <p className="text-xs text-gray-500">Change your login password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {/* Current password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                id="settings-current-password"
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current Password"
                autoComplete="current-password"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* New password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                id="settings-new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New Password"
                autoComplete="new-password"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue transition-all"
              />
            </div>

            {/* Password strength bar */}
            {strength && (
              <div className="space-y-1">
                <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: strength.width }}
                    transition={{ duration: 0.3 }}
                    className={`h-full rounded-full ${strength.color}`}
                  />
                </div>
                <p className="text-xs text-gray-500">Password strength: <span className="text-gray-300">{strength.label}</span></p>
              </div>
            )}

            {/* Confirm new password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                id="settings-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                autoComplete="new-password"
                className={`w-full bg-gray-900 border rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none transition-all focus:ring-1 ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-700 focus:border-cyber-blue focus:ring-cyber-blue'
                }`}
              />
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-400 -mt-2">Passwords don't match</p>
            )}

            <AnimatePresence mode="wait">
              {pwStatus && <Toast key={pwStatus.message} type={pwStatus.type} message={pwStatus.message} />}
            </AnimatePresence>

            <button
              id="settings-update-password-btn"
              type="submit"
              disabled={pwLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyber-blue/10 border border-cyber-blue text-cyber-blue rounded-lg hover:bg-cyber-blue hover:text-black transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </motion.div>

        {/* ── Account Actions ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6 border border-red-900/50 bg-red-900/5"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="text-red-500" size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-400">Account Actions</h2>
              <p className="text-xs text-gray-500">Danger zone — proceed with caution</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Log Out */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-200">Log Out</h3>
                <p className="text-sm text-gray-500 mt-0.5">Sign out of your current session on this device.</p>
              </div>
              <button
                id="settings-logout-btn"
                onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors text-sm font-medium"
              >
                <LogOut size={15} /> Log Out
              </button>
            </div>

            {/* Delete Account */}
            <div className="pt-6 border-t border-red-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-red-400">Delete Account</h3>
                <p className="text-sm text-gray-500 mt-0.5 max-w-sm">
                  Permanently delete your account and all associated data. This action <span className="text-red-400">cannot be undone</span>.
                </p>
              </div>
              <button
                id="settings-delete-account-btn"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-600/20 hover:border-red-500 transition-all text-sm font-medium whitespace-nowrap"
              >
                <Trash2 size={15} /> Delete my account
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
