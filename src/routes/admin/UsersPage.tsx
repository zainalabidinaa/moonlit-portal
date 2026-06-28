import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import type { UserRole } from '../../types';

type AdminUser = {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  role: UserRole;
  role_expires_at: string | null;
  created_at: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  friends_family: 'F&F',
  premium: 'Premium',
  premium_plus: 'Premium+',
  free: 'Free',
  restricted: 'Restricted',
};

const ROLE_BADGE: Record<UserRole, 'default' | 'success' | 'warning' | 'danger' | 'purple'> = {
  admin: 'purple',
  friends_family: 'success',
  premium: 'warning',
  premium_plus: 'default',
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

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [changingExpiry, setChangingExpiry] = useState<string | null>(null);
  const [customUsers, setCustomUsers] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        setUsers(data.users ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message || 'Failed to load users'); setLoading(false); });
  }, [session]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setChangingRole(userId);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      setError((e as Error).message || 'Failed to change role');
      setTimeout(() => setError(''), 4000);
    } finally {
      setChangingRole(null);
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
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ userId, role, role_expires_at: iso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role_expires_at: iso } : u));
    } catch (e) {
      setError((e as Error).message || 'Failed to update expiration');
      setTimeout(() => setError(''), 4000);
    }
  }

  function isoToDisplay(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-6">Users</h1>

        {loading && <p className="text-muted text-sm">Loading…</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-3 font-medium text-muted">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{u.email ?? u.user_id.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3">
                      {isRoleExpired(u) ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="warning">Expired</Badge>
                          <span className="text-xs text-muted">{new Date(u.role_expires_at!).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'friends_family' ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={customUsers.has(u.user_id) ? 'custom' : expiryPreset(u.role_expires_at)}
                            onChange={e => handleExpiryPreset(u.user_id, e.target.value)}
                            disabled={changingExpiry === u.user_id}
                            className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text disabled:opacity-50"
                          >
                            <option value="7d">7 days</option>
                            <option value="30d">30 days</option>
                            <option value="90d">90 days</option>
                            <option value="custom">Custom…</option>
                            <option value="never">Never</option>
                          </select>
                          {customUsers.has(u.user_id) && (
                            <input
                              type="datetime-local"
                              value={customValues[u.user_id] ?? toDateTimeInput(u.role_expires_at)}
                              onChange={e => handleCustomExpiry(u.user_id, e.target.value)}
                              className="w-44 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted/60">{isoToDisplay(u.role_expires_at)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.user_id, e.target.value as UserRole)}
                        disabled={changingRole === u.user_id}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text disabled:opacity-50"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
