import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/profiles" replace />;
  return <>{children}</>;
}

export function UserRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/profiles" replace />;
  return <>{children}</>;
}
