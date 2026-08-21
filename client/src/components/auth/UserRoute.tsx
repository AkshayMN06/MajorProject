import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

// The inverse of AdminRoute — guards the learner-facing pages (Dashboard,
// Scenario Assessment, Practice Labs, Analytics) so an admin account can't
// reach them by typing the URL directly, matching the sidebar already
// hiding those links for admins. Profile/Settings stay outside this guard
// since both roles use them.
export const UserRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading || user == null) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
      </div>
    );
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
