import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Edit2, X, Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';

// ─── Inline toast ─────────────────────────────────────────────────────────────
interface ToastProps { type: 'success' | 'error'; message: string }
const Toast: React.FC<ToastProps> = ({ type, message }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border ${
      type === 'success'
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}
  >
    {type === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
    {message}
  </motion.div>
);

// ─── Edit Profile Modal ────────────────────────────────────────────────────────
interface EditModalProps {
  initialData: {
    name: string;
    usn: string;
    department: string;
    college: string;
    semester: string;
    bio: string;
    location: string;
    preferredRole: string;
  };
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  isSaving: boolean;
}

const EditModal: React.FC<EditModalProps> = ({ initialData, onClose, onSave, isSaving }) => {
  const [form, setForm] = useState(initialData);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...form,
      semester: form.semester ? parseInt(form.semester, 10) : undefined,
    });
  };

  const inputClass =
    'w-full bg-[#0a0f1e] border border-gray-700 rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-[#0f1629] border border-white/10 rounded-2xl p-7 w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Edit2 size={16} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Edit Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors rounded-lg p-1 hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Full Name <span className="text-red-400">*</span></label>
            <input
              id="edit-name"
              value={form.name}
              onChange={set('name')}
              placeholder="Your full name"
              required
              className={inputClass}
            />
          </div>

          {/* USN + Semester row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">USN</label>
              <input
                id="edit-usn"
                value={form.usn}
                onChange={set('usn')}
                placeholder="e.g. 1AZ20CS001"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Semester</label>
              <select
                id="edit-semester"
                value={form.semester}
                onChange={set('semester')}
                className={inputClass}
              >
                <option value="">Select</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Department</label>
            <input
              id="edit-department"
              value={form.department}
              onChange={set('department')}
              placeholder="e.g. Computer Science"
              className={inputClass}
            />
          </div>

          {/* College */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">College</label>
            <input
              id="edit-college"
              value={form.college}
              onChange={set('college')}
              placeholder="Your college name"
              className={inputClass}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Location</label>
            <input
              id="edit-location"
              value={form.location}
              onChange={set('location')}
              placeholder="City, Country"
              className={inputClass}
            />
          </div>

          {/* Preferred Role */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Preferred Role</label>
            <select
              id="edit-preferred-role"
              value={form.preferredRole}
              onChange={set('preferredRole')}
              className={inputClass}
            >
              <option value="">Select a role</option>
              <option value="Attacker">Attacker</option>
              <option value="Defender">Defender</option>
              <option value="Both">Both</option>
            </select>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Bio</label>
            <textarea
              id="edit-bio"
              value={form.bio}
              onChange={set('bio')}
              placeholder="A short bio about yourself…"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-white/5 transition-colors text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="edit-profile-save-btn"
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Profile Page ──────────────────────────────────────────────────────────────
export const ProfilePage: React.FC = () => {
  usePageTitle('Profile');
  const { user, updateProfile } = useAuthStore();

  const [showEdit, setShowEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (data: Record<string, any>) => {
    setIsSaving(true);
    try {
      await updateProfile(data);
      setShowEdit(false);
      showToast('success', 'Profile updated successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Email', value: user?.email },
    { label: 'College', value: user?.college },
    { label: 'Department', value: user?.department },
    { label: 'USN', value: user?.usn },
    { label: 'Semester', value: user?.semester ? `Semester ${user.semester}` : undefined },
    { label: 'Location', value: user?.location },
    { label: 'Preferred Role', value: user?.preferredRole },
  ].filter(d => d.value);

  const initialEditData = {
    name: user?.name || '',
    usn: user?.usn || '',
    department: user?.department || '',
    college: user?.college || '',
    semester: user?.semester ? String(user.semester) : '',
    bio: user?.bio || '',
    location: user?.location || '',
    preferredRole: user?.preferredRole || '',
  };

  return (
    <>
      <AnimatePresence>
        {showEdit && (
          <EditModal
            key="edit-modal"
            initialData={initialEditData}
            onClose={() => { if (!isSaving) setShowEdit(false); }}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-cyber-bg-dark text-gray-200 font-sans">
        {/* Top bar */}
        <div className="px-8 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
        </div>

        {/* Toast */}
        <div className="px-8">
          <AnimatePresence mode="wait">
            {toast && <Toast key={toast.message} type={toast.type} message={toast.message} />}
          </AnimatePresence>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-5 px-8 pb-8 mt-4">

          {/* Left — Avatar card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-60 flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4"
          >
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-indigo-500/80 flex items-center justify-center text-white ring-4 ring-indigo-500/20">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={40} strokeWidth={1.5} />
              )}
            </div>

            {/* Name */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">{user?.name || 'User'}</h2>
              {user?.email && (
                <p className="text-xs text-gray-500 mt-0.5 break-all">{user.email}</p>
              )}
            </div>

            {/* Bio */}
            {user?.bio && (
              <p className="text-xs text-gray-400 text-center leading-relaxed border-t border-white/5 pt-4 w-full">
                {user.bio}
              </p>
            )}

            {/* Edit shortcut */}
            <button
              onClick={() => setShowEdit(true)}
              className="w-full mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors text-sm font-medium"
            >
              <Edit2 size={14} /> Edit Profile
            </button>
          </motion.div>

          {/* Right — Personal Details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-7"
          >
            <h2 className="text-base font-semibold text-white mb-5">Personal Details</h2>

            {details.length > 0 ? (
              <div className="divide-y divide-white/5">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex py-3.5 gap-4">
                    <span className="w-36 flex-shrink-0 text-sm text-gray-500">{label}</span>
                    <span className="text-sm text-gray-100 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <User size={26} className="text-indigo-400" strokeWidth={1.5} />
                </div>
                <p className="text-gray-400 text-sm mb-1">No details added yet</p>
                <p className="text-gray-600 text-xs">Click Edit Profile to fill in your information</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
