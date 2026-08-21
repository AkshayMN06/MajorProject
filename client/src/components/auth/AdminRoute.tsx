import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

// Frontend-side gate only — defense in depth. Every /api/admin/* endpoint
// independently re-checks the role server-side (requireAdmin middleware),
// so this component existing/being bypassed can never expose real data.
export const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore();

  // Treat "user not yet loaded" the same as "loading" — avoids a flash
  // redirect to "/" while loadUser() is still in flight on first mount.
  if (isLoading || user == null) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00d4ff] animate-spin" />
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
