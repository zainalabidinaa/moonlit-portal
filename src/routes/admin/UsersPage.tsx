import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authedFetchJson, SessionExpiredError } from '../../lib/authed-fetch';
import { supabase } from '../../lib/supabase';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DeleteUserModal } from '../../components/admin/DeleteUserModal';
import { ServerAccessCell } from '../../components/admin/ServerAccessCell';
import { StatTile, adminKicker, adminLede, adminSelect, adminTh, adminTitle } from '../../components/admin/AdminUI';
import { grantExpiry, matchesServerFilter, serverAccessState, type ServerAccessFilter, type ServerAccessSource } from '../../lib/serverAccess';
import { lastActiveStatus, lastActiveLabel, formatRelativeTime, parseUserAgent, type ActiveStatus } from '../../lib/userActivity';
import type { SessionInfo, ActivityEntry } from '../../lib/userActivity';
import { deviceName, osLabel, summarizeDevices, type UserDevice } from '../../lib/devices';
import type { UserRole } from '../../types';

type AdminUser = {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  role: UserRole;
  role_expires_at: string | null;
  created_at: string;
  stream_addons_enabled: boolean;
  server_access: boolean;
  server_access_expires_at: string | null;
  server_access_source: ServerAccessSource | null;
  last_active_at: string | null;
  devices: UserDevice[];
};

const SERVER_FILTERS: { value: ServerAccessFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Has server access' },
  { value: 'manual', label: 'Granted by you' },
  { value: 'subscription', label: 'Via subscription' },
  { value: 'store', label: 'Bought on store' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'No access' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  friends_family: 'F&F',
  spotlight: 'Spotlight',
  studio: 'Studio',
  free: 'Free',
  restricted: 'Restricted',
};

const ROLE_BADGE: Record<UserRole, 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'info'> = {
  admin: 'purple',
  friends_family: 'default',
  spotlight: 'success',
  studio: 'info',
  free: 'danger',
  restricted: 'danger',
};

function isRoleExpired(u: AdminUser): boolean {
  return u.role === 'free' && !!u.role_expires_at && new Date(u.role_expires_at) <= new Date();
}

function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function expiryPreset(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const day = 86_400_000;
  if (Math.abs(d - (now + 7 * day)) < day) return '7d';
  if (Math.abs(d - (now + 30 * day)) < day) return '30d';
  if (Math.abs(d - (now + 90 * day)) < day) return '90d';
  return 'custom';
}

function presetToISO(preset: string, customValue: string): string | null {
  if (preset === 'never') return null;
  if (preset === 'custom') return dateTimeInputToISO(customValue);
  const days = parseInt(preset);
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const STATUS_DOT_CLASS: Record<ActiveStatus, string> = {
  online: 'bg-green-500',
  recent: 'bg-amber-400',
  stale: 'bg-muted/40',
  never: 'bg-muted/40',
};

function LastActiveCell({ lastActiveAt }: { lastActiveAt: string | null }) {
  // One clock read for the dot and the label, which share thresholds: two
  // separate new Date() calls could straddle a boundary (say five minutes)
  // and render a fresh dot next to a stale label.
  const now = new Date();
  const status = lastActiveStatus(lastActiveAt, now);

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-none ${STATUS_DOT_CLASS[status]}`} />
      <span className="text-text">{lastActiveLabel(lastActiveAt, now)}</span>
    </div>
  );
}

const KIND_LABEL: Record<ActivityEntry['kind'], string> = {
  in_progress: 'Watching',
  watched: 'Watched',
  liked: 'Liked',
};

function activityTitle(entry: ActivityEntry): string {
  const base = entry.name ?? 'Untitled';
  if (entry.season != null && entry.episode != null) {
    return `${base} — S${entry.season}E${entry.episode}`;
  }
  return base;
}

function DevicesList({ devices }: { devices: UserDevice[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted font-medium mb-2">Devices</p>
      {devices.length === 0 ? (
        <p className="text-sm text-muted/60">No app devices yet</p>
      ) : (
        <ul className="space-y-2">
          {devices.map(d => (
            <li key={d.device_id} className="text-sm flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-none ${d.signed_in ? 'bg-green-500' : 'bg-muted/40'}`}
                  title={d.signed_in ? 'Signed in' : 'Signed out'}
                />
                <span className="text-text truncate">{deviceName(d.model, d.platform)}</span>
                <span className="text-muted text-xs whitespace-nowrap">
                  {osLabel(d)}{d.app_version ? ` · v${d.app_version}` : ''}
                </span>
              </span>
              <span className="text-muted text-xs whitespace-nowrap">{formatRelativeTime(d.last_seen_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityDrawer({
  loading,
  error,
  data,
  devices,
}: {
  loading: boolean;
  error?: string;
  data?: { sessions: SessionInfo[]; activity: ActivityEntry[] };
  devices: UserDevice[];
}) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">Couldn't load activity: {error}</p>;
  if (!data) return null;

  return (
    <div className="grid gap-6">
      <DevicesList devices={devices} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-medium mb-2">Sign-ins</p>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-muted/60">No sessions yet</p>
        ) : (
          <ul className="space-y-2">
            {data.sessions.map((s, i) => (
              <li key={i} className="text-sm flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text">{parseUserAgent(s.user_agent)}</span>
                <span className="text-muted text-xs">{formatRelativeTime(s.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-medium mb-2">Recent activity</p>
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted/60">No activity yet</p>
        ) : (
          <ul className="space-y-2">
            {data.activity.map((entry, i) => (
              <li key={i} className="text-sm flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text">{KIND_LABEL[entry.kind]}: {activityTitle(entry)}</span>
                <span className="text-muted text-xs">{formatRelativeTime(entry.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-light pl-2.5 pr-1 text-[13px] text-accent">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent/15">×</button>
    </span>
  );
}

/** One "Filter" button; plan and server-access filters live in its menu. */
function FilterMenu({
  roleFilter, serverFilter, roleCounts, serverCounts, onRole, onServer, activeCount,
}: {
  roleFilter: UserRole | 'all';
  serverFilter: ServerAccessFilter;
  roleCounts: Record<UserRole | 'all', number>;
  serverCounts: Record<ServerAccessFilter, number>;
  onRole: (r: UserRole | 'all') => void;
  onServer: (f: ServerAccessFilter) => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const roles: (UserRole | 'all')[] = ['all', 'spotlight', 'studio', 'friends_family', 'admin', 'free', 'restricted'];
  const option = (on: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${on ? 'bg-accent-light text-accent' : 'text-text hover:bg-surface-2'}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${open || activeCount ? 'border-accent/50 text-text' : 'border-border-strong text-muted hover:text-text'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filter
        {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-[#1a0b04]">{activeCount}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-20 grid w-[520px] max-w-[calc(100vw-40px)] grid-cols-2 gap-4 rounded-2xl border border-border-strong bg-surface p-4 shadow-card">
          <div>
            <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Plan</p>
            {roles.map(r => (
              <button key={r} type="button" onClick={() => onRole(r)} className={option(roleFilter === r)}>
                {r === 'all' ? 'All plans' : r === 'friends_family' ? 'Friends & Family' : ROLE_LABELS[r]}
                <span className="font-mono text-[11px] text-faint">{roleCounts[r] ?? 0}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[.08em] text-faint">Server access</p>
            {SERVER_FILTERS.map(f => (
              <button key={f.value} type="button" onClick={() => onServer(f.value)} className={option(serverFilter === f.value)}>
                {f.value === 'all' ? 'Any' : f.label}
                <span className="font-mono text-[11px] text-faint">{serverCounts[f.value] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="col-span-2 flex justify-between border-t border-border pt-3">
            <button type="button" onClick={() => { onRole('all'); onServer('all'); }} className="text-sm text-muted hover:text-text">Clear filters</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-accent">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [changingServer, setChangingServer] = useState<string | null>(null);
  const [serverFilter, setServerFilter] = useState<ServerAccessFilter>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [changingExpiry, setChangingExpiry] = useState<string | null>(null);
  const [runningSetup, setRunningSetup] = useState<string | null>(null);
  const [setupDone, setSetupDone] = useState<string | null>(null);
  const [customUsers, setCustomUsers] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [activityByUser, setActivityByUser] = useState<Record<string, { sessions: SessionInfo[]; activity: ActivityEntry[] }>>({});
  const [activityLoading, setActivityLoading] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<Record<string, string>>({});

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authedFetchJson<{ users: AdminUser[] }>(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`,
        );
        if (!cancelled) setUsers(data.users ?? []);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          // The token is dead: sign out so AdminRoute sends us to /login
          // instead of leaving this page stuck with a permissions error.
          // The token is already dead, so a server-side revoke buys nothing
          // here — a local-only sign-out can't block on the network and fires
          // SIGNED_OUT immediately for AdminRoute. Keep it non-blocking so
          // the finally below always runs.
          void supabase.auth.signOut({ scope: 'local' });
          return;
        }
        if (!cancelled) setError((e as Error).message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session, reloadKey]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setChangingRole(userId);
    try {
      await authedFetchJson(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      setError((e as Error).message || 'Failed to change role');
      setTimeout(() => setError(''), 4000);
    } finally {
      setChangingRole(null);
    }
  }

  // Toggling this re-runs install_curated_setup() server-side immediately (see
  // the admin-users PATCH handler), so it takes effect the next time that
  // user's app loads addons — not on the next cron pass two days from now.
  async function patchServerAccess(userId: string, grant: boolean, expiresAt: string | null) {
    setChangingServer(userId);
    try {
      await authedFetchJson(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, server_access: grant, server_access_expires_at: grant ? expiresAt : null }),
      });
      setUsers(prev => prev.map(u => u.user_id === userId
        ? { ...u, server_access: grant, server_access_expires_at: grant ? expiresAt : null, server_access_source: grant ? 'manual' : null }
        : u));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      setError((e as Error).message || 'Failed to update server access');
      setTimeout(() => setError(''), 4000);
    } finally {
      setChangingServer(null);
    }
  }


  // Forces a full install_curated_setup() re-run for this user right now —
  // catalogs AND streams — regardless of their current Streams flag. Also
  // flips stream_addons_enabled server-side so the checkbox reflects it.
  async function handleRunSetup(userId: string) {
    setRunningSetup(userId);
    try {
      await authedFetchJson(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, runSetup: true }),
      });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, stream_addons_enabled: true } : u));
      setSetupDone(userId);
      setTimeout(() => setSetupDone(prev => prev === userId ? null : prev), 2000);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      setError((e as Error).message || 'Failed to run setup');
      setTimeout(() => setError(''), 4000);
    } finally {
      setRunningSetup(null);
    }
  }

  // The server independently re-checks confirmEmail against the target's real
  // email (see the admin-users DELETE handler) — this isn't just UI trust.
  async function handleDeleteUser(userId: string, confirmEmail: string) {
    try {
      await authedFetchJson(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, confirmEmail }),
      });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void supabase.auth.signOut({ scope: 'local' });
      }
      // The modal owns the failure UI, so always rethrow — including a dead
      // session, where the sign-out above unmounts the page mid-close.
      throw e;
    }
  }

  async function toggleRow(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (activityByUser[userId] || activityLoading === userId) return;

    setActivityLoading(userId);
    setActivityError(prev => { const next = { ...prev }; delete next[userId]; return next; });
    try {
      const data = await authedFetchJson<{ sessions?: SessionInfo[]; activity?: ActivityEntry[] }>(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users?activity=${userId}`,
      );
      setActivityByUser(prev => ({ ...prev, [userId]: { sessions: data.sessions ?? [], activity: data.activity ?? [] } }));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        // A dead token here means every other call on this page is dead too,
        // so redirect through AdminRoute instead of leaving a drawer open
        // with a stale "expired session" error.
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      setActivityError(prev => ({ ...prev, [userId]: (e as Error).message || 'Failed to load activity' }));
    } finally {
      setActivityLoading(null);
    }
  }

  async function handleExpiryPreset(userId: string, preset: string) {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    setChangingExpiry(userId);
    const iso = presetToISO(preset, customValues[userId] ?? '');

    if (preset === 'custom') {
      setCustomUsers(prev => new Set([...prev, userId]));
      if (iso) {
        await patchExpiry(userId, user.role, iso);
      }
      setChangingExpiry(null);
      return;
    }

    setCustomUsers(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

    await patchExpiry(userId, user.role, iso);
    setChangingExpiry(null);
  }

  async function handleCustomExpiry(userId: string, value: string) {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    setCustomValues(prev => ({ ...prev, [userId]: value }));
    const iso = dateTimeInputToISO(value);
    if (!iso) return;
    setChangingExpiry(userId);
    await patchExpiry(userId, user.role, iso);
    setChangingExpiry(null);
  }

  async function patchExpiry(userId: string, role: UserRole, iso: string | null) {
    try {
      await authedFetchJson(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role, role_expires_at: iso }),
      });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role_expires_at: iso } : u));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      setError((e as Error).message || 'Failed to update expiration');
      setTimeout(() => setError(''), 4000);
    }
  }

  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;
    const byRole: Record<UserRole, number> = { admin: 0, friends_family: 0, spotlight: 0, studio: 0, free: 0, restricted: 0 };
    let online = 0, expiringSoon = 0, newThisMonth = 0, withServer = 0;
    for (const u of users) {
      byRole[u.role] += 1;
      if (lastActiveStatus(u.last_active_at) === 'online') online += 1;
      if (u.role === 'friends_family' && u.role_expires_at) {
        const left = new Date(u.role_expires_at).getTime() - now;
        if (left > 0 && left < 30 * DAY) expiringSoon += 1;
      }
      if (now - new Date(u.created_at).getTime() < 30 * DAY) newThisMonth += 1;
      if (matchesServerFilter(serverAccessState(u), 'active')) withServer += 1;
    }
    return { total: users.length, byRole, online, expiringSoon, newThisMonth, withServer };
  }, [users]);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u =>
      matchesServerFilter(serverAccessState(u), serverFilter) &&
      (roleFilter === 'all' || u.role === roleFilter) &&
      (!q || (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
    );
  }, [users, serverFilter, roleFilter, query]);

  function isoToDisplay(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  }

  const activeFilters = (roleFilter !== 'all' ? 1 : 0) + (serverFilter !== 'all' ? 1 : 0);
  const serverCounts = Object.fromEntries(
    SERVER_FILTERS.map(f => [f.value, users.filter(u => matchesServerFilter(serverAccessState(u), f.value)).length])
  ) as Record<ServerAccessFilter, number>;

  return (
    <AppShell>
      <div>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={adminKicker}>People</p>
            <h1 className={`mt-2 ${adminTitle}`}>Users</h1>
            <p className={adminLede}>Everyone with a Moonlit account. Select a person to change their plan or access, and to see their devices and recent activity.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setReloadKey(k => k + 1)}>Refresh</Button>
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && (
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <Button size="sm" variant="ghost" onClick={() => setReloadKey(k => k + 1)}>Try again</Button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Accounts" value={stats.total} note={`${stats.online} active now`} tone={stats.online ? 'ok' : undefined} />
              <StatTile label="Spotlight" value={stats.byRole.spotlight} note={`${stats.newThisMonth} joined in the last 30 days`} />
              <StatTile label="Studio" value={stats.byRole.studio} note={`${stats.withServer} accounts with server access`} />
              <StatTile label="Friends & Family" value={stats.byRole.friends_family} note={stats.expiringSoon ? `${stats.expiringSoon} expire within 30 days` : 'None expiring soon'} tone={stats.expiringSoon ? 'warn' : undefined} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
                <label className="relative">
                  <span className="sr-only">Search by email</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by email or name"
                    className="h-9 w-72 rounded-lg border border-border-strong bg-bg2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-faint focus:border-accent"
                  />
                </label>
                <FilterMenu
                  roleFilter={roleFilter}
                  serverFilter={serverFilter}
                  roleCounts={{ all: stats.total, ...stats.byRole }}
                  serverCounts={serverCounts}
                  onRole={setRoleFilter}
                  onServer={setServerFilter}
                  activeCount={activeFilters}
                />
                {roleFilter !== 'all' && (
                  <ActiveFilter label={`Plan: ${roleFilter === 'friends_family' ? 'Friends & Family' : ROLE_LABELS[roleFilter]}`} onClear={() => setRoleFilter('all')} />
                )}
                {serverFilter !== 'all' && (
                  <ActiveFilter label={`Server: ${SERVER_FILTERS.find(f => f.value === serverFilter)?.label}`} onClear={() => setServerFilter('all')} />
                )}
                <span className="ml-auto text-[13px] text-faint">
                  {visibleUsers.length === users.length ? `${users.length} people` : `${visibleUsers.length} of ${users.length} people`}
                </span>
              </div>

              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[24%]" />
                  <col className="w-[15%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border">
                    <th className={adminTh}>Person</th>
                    <th className={adminTh}>Plan</th>
                    <th className={adminTh}>Access ends</th>
                    <th className={adminTh}>Server access</th>
                    <th className={adminTh}>Last active</th>
                    <th className={adminTh}><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map(u => {
                    const open = expandedUser === u.user_id;
                    return (
                      <Fragment key={u.id}>
                        <tr
                          className={`cursor-pointer border-b border-border align-middle transition-colors last:border-0 hover:bg-white/[.03] ${open ? 'bg-white/[.03]' : ''}`}
                          onClick={() => toggleRow(u.user_id)}
                          aria-expanded={open}
                        >
                          <td className="px-4 py-3.5">
                            <div className="truncate font-medium text-text">{u.email ?? u.user_id.slice(0, 8) + '…'}</div>
                            <div className="mt-0.5 truncate text-xs text-faint">Joined {new Date(u.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            {isRoleExpired(u) ? <Badge variant="warning">Expired</Badge> : <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>}
                          </td>
                          <td className="px-4 py-3.5 text-muted">
                            {u.role === 'friends_family' ? (u.role_expires_at ? isoToDisplay(u.role_expires_at) : 'Never') : <span className="text-faint">—</span>}
                          </td>
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            <ServerAccessCell
                              user={u}
                              busy={changingServer === u.user_id}
                              onGrant={(preset) => patchServerAccess(u.user_id, true, grantExpiry(preset))}
                              onRevoke={() => patchServerAccess(u.user_id, false, null)}
                            />
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <LastActiveCell lastActiveAt={u.last_active_at} />
                            <div className="mt-0.5 truncate text-xs text-faint">{summarizeDevices(u.devices ?? [])}</div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`inline-block h-2 w-2 rotate-45 border-b-[1.5px] border-r-[1.5px] border-muted transition-transform ${open ? '-rotate-[135deg]' : ''}`} aria-hidden="true" />
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-border last:border-0">
                            <td colSpan={6} className="bg-bg2 px-5 py-5" onClick={(e) => e.stopPropagation()}>
                              <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                                <div className="grid content-start gap-4">
                                  <p className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Manage</p>
                                  <label className="grid gap-1.5">
                                    <span className="text-xs text-muted">Plan</span>
                                    <select
                                      value={u.role}
                                      onChange={e => handleRoleChange(u.user_id, e.target.value as UserRole)}
                                      disabled={changingRole === u.user_id}
                                      className={`${adminSelect} h-9 w-full text-sm`}
                                    >
                                      {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                                        <option key={r} value={r}>{r === 'friends_family' ? 'Friends & Family' : ROLE_LABELS[r]}</option>
                                      ))}
                                    </select>
                                  </label>
                                  {u.role === 'friends_family' && (
                                    <label className="grid gap-1.5">
                                      <span className="text-xs text-muted">Access ends</span>
                                      <div className="flex gap-2">
                                        <select
                                          value={customUsers.has(u.user_id) ? 'custom' : expiryPreset(u.role_expires_at)}
                                          onChange={e => handleExpiryPreset(u.user_id, e.target.value)}
                                          disabled={changingExpiry === u.user_id}
                                          className={`${adminSelect} h-9 flex-1 text-sm`}
                                        >
                                          <option value="7d">In 7 days</option>
                                          <option value="30d">In 30 days</option>
                                          <option value="90d">In 90 days</option>
                                          <option value="custom">Custom date…</option>
                                          <option value="never">Never</option>
                                        </select>
                                        {customUsers.has(u.user_id) && (
                                          <input
                                            type="datetime-local"
                                            value={customValues[u.user_id] ?? toDateTimeInput(u.role_expires_at)}
                                            onChange={e => handleCustomExpiry(u.user_id, e.target.value)}
                                            className={`${adminSelect} h-9 flex-1 text-sm`}
                                          />
                                        )}
                                      </div>
                                    </label>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="ghost" loading={runningSetup === u.user_id} onClick={() => handleRunSetup(u.user_id)}>
                                      {setupDone === u.user_id ? 'Setup done ✓' : 'Run setup again'}
                                    </Button>
                                    {/* Admin accounts can't be deleted from here at all — the
                                        server rejects it too, but hiding the affordance keeps
                                        the intent visible before the modal is even opened. */}
                                    {u.role !== 'admin' && (
                                      <Button size="sm" variant="ghost" className="hover:!border-red-400/50 hover:!text-red-400" onClick={() => setDeleteTarget(u)}>
                                        Delete account
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <ActivityDrawer
                                    loading={activityLoading === u.user_id}
                                    error={activityError[u.user_id]}
                                    data={activityByUser[u.user_id]}
                                    devices={u.devices ?? []}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {visibleUsers.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-faint">No one matches these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <DeleteUserModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          userEmail={deleteTarget.email ?? deleteTarget.user_id}
          onConfirm={() => handleDeleteUser(deleteTarget.user_id, deleteTarget.email ?? '')}
        />
      )}
    </AppShell>
  );
}
