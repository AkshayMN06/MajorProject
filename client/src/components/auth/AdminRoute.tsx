import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

// Frontend-side gate only — defense in depth. Every /api/admin/* endpoint
// independently re-checks the role server-side (requireAdmin middleware),
// so this component existing/being bypassed can never expose real data.
// `roles` widens the gate for pages other roles may use (Module Management
// is open to teachers); everything else stays admin-only by default.
export const AdminRoute = ({ children, roles = ['ADMIN'] }: { children?: React.ReactNode; roles?: string[] }) => {
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

  if (!roles.includes(user.role ?? 'USER')) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
