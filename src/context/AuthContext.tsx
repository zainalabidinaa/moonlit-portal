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
  /** True when the currently ACTIVE profile is profile_index 0 — the account's
   *  first-ever profile, the one the signup gate creates. This gates
   *  owner-only actions (billing, adding/deleting other profiles), matching
   *  Netflix's "Primary profile" distinction. NOTE: this is a UI-level
   *  convenience, not a security boundary — every profile shares one login,
   *  and profiles.pin_enabled exists in the schema but isn't enforced
   *  anywhere, so nothing actually stops selecting the owner's own profile
   *  directly. Real separation would mean wiring up per-profile PIN entry
   *  before a profile switch is allowed. */
  isOwner: boolean;
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
  // `profiles` is fetched ordered by profile_index ascending, so profiles[0]
  // is whichever profile actually has the lowest index right now — NOT a
  // hardcoded "index must literally be 0". That distinction matters for any
  // account whose original first profile was deleted before this owner
  // concept existed: comparing against profile_index === 0 directly would
  // leave that account with no profile anyone could ever be recognized as
  // owning again, whereas this self-heals to whichever profile is now
  // earliest.
  const isOwner = !!activeProfile && activeProfile.id === profiles[0]?.id;

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, profiles, activeProfile, setActiveProfile, isOwner, loading, refreshProfiles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
