import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/': return 'Dashboard';
    case '/scenario': return 'Scenario Assessment';
    case '/labs': return 'Practice Labs';
    case '/analytics': return 'Analytics';
    case '/modules': return 'Modules';
    case '/admin/modules': return 'Module Management';
    case '/profile': return 'Profile';
    case '/settings': return 'Settings';
    default: return 'CyberLearn';
  }
};

export const TopBar: React.FC<{ onMenu: () => void; menuOpen: boolean }> = ({ onMenu, menuOpen }) => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div className="h-20 md:ml-[240px] fixed top-0 right-0 left-0 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-[#1e293b] z-40 px-4 md:px-8 flex items-center gap-3">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="md:hidden p-2 -ml-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
      >
        <Menu size={22} />
      </button>
      <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide truncate">{title}</h1>
    </div>
  );
};
