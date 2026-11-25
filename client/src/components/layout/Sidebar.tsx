import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, Target, FlaskConical, BarChart3, User, Settings, ShieldCheck, BookOpen, ShieldAlert, Library, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Scenario Assessment', path: '/scenario', icon: Target },
  { name: 'Modules', path: '/modules', icon: BookOpen },
  { name: 'Practice Labs', path: '/labs', icon: FlaskConical },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Profile', path: '/profile', icon: User },
  { name: 'Settings', path: '/settings', icon: Settings },
];

// Admin accounts get an entirely separate nav — the learner-facing pages
// (Dashboard, Scenario Assessment, Practice Labs, Analytics) aren't
// relevant to an admin. UserRoute (App.tsx) also blocks direct navigation
// to those routes, so this isn't just a cosmetic hide.
const ADMIN_NAV_ITEMS = [
  { name: 'Admin', path: '/admin', icon: ShieldCheck },
  { name: 'Module Management', path: '/admin/modules', icon: Library },
  { name: 'Security', path: '/admin/security', icon: ShieldAlert },
  { name: 'Profile', path: '/profile', icon: User },
  { name: 'Settings', path: '/settings', icon: Settings },
];

// Fixed on md+ screens; an off-canvas drawer (with backdrop) below md.
export const Sidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useAuthStore();
  // Teachers keep the learner pages and also author modules.
  const items =
    user?.role === 'ADMIN' ? ADMIN_NAV_ITEMS
    : user?.role === 'TEACHER' ? [...NAV_ITEMS.slice(0, 3), { name: 'Module Management', path: '/admin/modules', icon: Library }, ...NAV_ITEMS.slice(3)]
    : NAV_ITEMS;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
    {open && <div className="md:hidden fixed inset-0 z-[49] bg-black/60" onClick={onClose} aria-hidden="true" />}
    <div
      id="app-sidebar"
      className={`w-[240px] h-screen fixed left-0 top-0 bg-[#0a0e1a] border-r border-[#1e293b] flex flex-col overflow-y-auto z-50 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Logo Area */}
      <div className="p-6 flex items-center space-x-3 border-b border-[#1e293b]">
        <Shield className="w-8 h-8 text-[#00d4ff] flex-shrink-0 drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
        <div className="flex flex-col flex-1">
          <span className="text-white font-bold tracking-widest text-lg">CYBER LEARN</span>
          <span className="text-[#0ea5e9] text-[10px] tracking-wider mt-0.5">LEARN. ASSESS. IMPROVE.</span>
        </div>
        <button onClick={onClose} aria-label="Close navigation" className="md:hidden text-gray-400 hover:text-white p-1"><X size={18} /></button>
      </div>

      {/* Navigation */}
      <nav className="mt-8 px-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || item.path === '/admin'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 relative ${
                  isActive
                    ? 'bg-blue-500/20 text-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.15)] backdrop-blur-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/10 to-transparent rounded-lg border-l-2 border-[#00d4ff]"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="font-medium text-sm relative z-10">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
    </>
  );
};
