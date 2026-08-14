import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';

type Role = 'premium' | 'friends_family' | 'free';
type TabKey = 'home' | 'search' | 'library' | 'live_tv' | 'settings';

const ROLES: { key: Role; label: string }[] = [
  { key: 'premium', label: 'Premium' },
  { key: 'friends_family', label: 'Friends & Family' },
  { key: 'free', label: 'Regular' },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'search', label: 'Search' },
  { key: 'library', label: 'Library' },
  { key: 'live_tv', label: 'Live TV' },
  { key: 'settings', label: 'Settings' },
];

export default function TabVisibilityPage() {
  const { session } = useAuth();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    load();
  }, [session]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('role_tab_visibility').select('role, tab_key, visible');
    const map: Record<string, boolean> = {};
    for (const row of data ?? []) {
      map[`${row.role}|${row.tab_key}`] = row.visible;
    }
    setVisibility(map);
    setLoading(false);
  }

  function isVisible(role: Role, tab: TabKey): boolean {
    return visibility[`${role}|${tab}`] ?? true;
  }

  async function toggle(role: Role, tab: TabKey) {
    const next = !isVisible(role, tab);
    const key = `${role}|${tab}`;
    setVisibility(prev => ({ ...prev, [key]: next }));
    setSaving(key);
    const { error } = await supabase
      .from('role_tab_visibility')
      .upsert({ role, tab_key: tab, visible: next }, { onConflict: 'role,tab_key' });
    if (error) {
      // Revert on failure so the toggle never silently drifts from the DB.
      setVisibility(prev => ({ ...prev, [key]: !next }));
    }
    setSaving(null);
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-1">Tab visibility</h1>
        <p className="text-sm text-muted mb-6">
          Choose which app tabs each role can see. Admin always sees every tab.
        </p>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-3 font-medium text-muted">Tab</th>
                  {ROLES.map(r => (
                    <th key={r.key} className="text-center px-4 py-3 font-medium text-muted">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABS.map(tab => (
                  <tr key={tab.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-text">{tab.label}</td>
                    {ROLES.map(role => {
                      const key = `${role.key}|${tab.key}`;
                      const visible = isVisible(role.key, tab.key);
                      return (
                        <td key={role.key} className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggle(role.key, tab.key)}
                            disabled={saving === key}
                            aria-pressed={visible}
                            aria-label={`${tab.label} visible for ${role.label}`}
                            className={`inline-block h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                              visible ? 'bg-accent' : 'bg-border'
                            }`}
                          >
                            <span
                              className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                visible ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted mt-4">
          Changes apply next time each app opens or reconnects — no forced update required.
        </p>
      </div>
    </AppShell>
  );
}
