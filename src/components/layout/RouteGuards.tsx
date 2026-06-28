import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session && !(window as any).__recoveryInProgress) return <Navigate to="/profiles" replace />;
  return <>{children}</>;
}

export function UserRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, role, refreshProfiles } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      if (role === 'friends_family') {
        await supabase.rpc('expire_friends_family_role');
        await refreshProfiles();
      }
      setChecked(true);
    }
    check();
  }, []);

  if (loading || !checked) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (role === 'free' || role === 'restricted') return <Navigate to="/billing" replace />;
  return <>{children}</>;
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
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
