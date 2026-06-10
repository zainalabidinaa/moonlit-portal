import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import type { Profile, UserRole } from '../../types';

type AdminUser = Profile & { email?: string };

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  friends_family: 'Friends & Family',
  premium: 'Premium',
  premium_plus: 'Premium+',
};

const ROLE_BADGE: Record<UserRole, 'default' | 'success' | 'warning' | 'danger' | 'purple'> = {
  admin: 'purple',
  friends_family: 'success',
  premium: 'warning',
  premium_plus: 'default',
};

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => { setUsers(data.users ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load users'); setLoading(false); });
  }, [session]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ userId, role: newRole }),
    });
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
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
                  <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{u.email ?? u.user_id.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.user_id, e.target.value as UserRole)}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text"
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
