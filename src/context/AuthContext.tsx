import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (p: Profile) => void;
  loading: boolean;
  refreshProfiles: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  async function fetchProfiles(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .order('profile_index');
    const rows = (data ?? []) as Profile[];

    const primary = rows[0];
    if (primary && primary.role === 'friends_family' && primary.role_expires_at) {
      const expiresAt = new Date(primary.role_expires_at);
      if (expiresAt <= new Date()) {
        await supabase.rpc('expire_friends_family_role');
        primary.role = 'free';
      }
    }

    setProfiles(rows);
    setActiveProfile(primary ?? null);
    setLoading(false);
  }

  function refreshProfiles() {
    const uid = userIdRef.current ?? session?.user?.id;
    if (uid) return fetchProfiles(uid);
    return Promise.resolve();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        userIdRef.current = data.session.user.id;
        fetchProfiles(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        userIdRef.current = s.user.id;
        fetchProfiles(s.user.id);
      } else {
        setProfiles([]);
        setActiveProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const role = profiles[0]?.role ?? null;

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, profiles, activeProfile, setActiveProfile, loading, refreshProfiles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
