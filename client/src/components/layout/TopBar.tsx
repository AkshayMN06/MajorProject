import React from 'react';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/': return 'Dashboard';
    case '/scenario': return 'Scenario Assessment';
    case '/labs': return 'Practice Labs';
    case '/analytics': return 'Analytics';
    case '/profile': return 'Profile';
    case '/settings': return 'Settings';
    default: return 'CyberLearn';
  }
};

export const TopBar: React.FC = () => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div className="h-20 ml-[240px] fixed top-0 right-0 left-0 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-[#1e293b] z-40 px-8 flex items-center justify-between">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-white tracking-wide">{title}</h1>
      </div>
    </div>
  );
};
