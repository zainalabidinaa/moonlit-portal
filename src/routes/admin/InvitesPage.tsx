import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import type { InviteCode } from '../../types';

type InviteRow = InviteCode & { redeemed_by_label?: string | null };

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function InvitesPage() {
  const { user, session } = useAuth();
  const [codes, setCodes] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: inviteCodes } = await supabase.from('invite_codes').select('*').order('created_at', { ascending: false });
    const codes = (inviteCodes ?? []) as InviteRow[];
    const usedIds = Array.from(new Set(codes.map(c => c.used_by).filter(Boolean))) as string[];

    if (usedIds.length > 0) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users?ids=${usedIds.join(',')}`,
          { headers: { Authorization: `Bearer ${session!.access_token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          const userMap = new Map<string, string>((data.users ?? []).map((u: { id: string; email: string }) => [u.id, u.email]));
          setCodes(codes.map(c => ({
            ...c,
            redeemed_by_label: c.used_email || (c.used_by ? userMap.get(c.used_by) || null : null),
          })));
        } else {
          setCodes(codes);
        }
      } catch {
        setCodes(codes);
      }
    } else {
      setCodes(codes);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    const code = generateCode();
    const { error } = await supabase.from('invite_codes').insert({
      code,
      created_by: user.id,
      is_active: true,
      max_uses: 1,
      expires_at: dateTimeInputToISO(newCodeExpiresAt),
    });
    if (!error) { setLastGenerated(code); load(); }
    setGenerating(false);
  }

  async function updateExpiration(code: string, value: string) {
    const expiresAt = dateTimeInputToISO(value);
    const { error } = await supabase.from('invite_codes').update({ expires_at: expiresAt }).eq('code', code);
    if (!error) setCodes(prev => prev.map(c => c.code === code ? { ...c, expires_at: expiresAt } : c));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  function dateTimeInputToISO(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function isoToDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function isExpired(code: InviteCode): boolean {
    return !!code.expires_at && new Date(code.expires_at) <= new Date();
  }

  function statusFor(code: InviteCode): { label: string; variant: 'default' | 'success' | 'danger' | 'warning' } {
    if (code.used_by) return { label: 'Used', variant: 'default' };
    if (!code.is_active) return { label: 'Inactive', variant: 'danger' };
    if (isExpired(code)) return { label: 'Expired', variant: 'warning' };
    return { label: 'Active', variant: 'success' };
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text">Invite Codes</h1>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={newCodeExpiresAt}
              onChange={e => setNewCodeExpiresAt(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
            <Button size="sm" variant="ghost" onClick={() => setNewCodeExpiresAt('')}>Never</Button>
            <Button onClick={handleGenerate} loading={generating}>Generate Code</Button>
          </div>
        </div>

        {lastGenerated && (
          <Card className="p-4 mb-6 flex items-center gap-3 border-accent">
            <div className="flex-1">
              <p className="text-xs text-muted mb-1">New invite code</p>
              <p className="text-xl font-mono font-bold text-accent tracking-widest">{lastGenerated}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => copyCode(lastGenerated)}>Copy</Button>
          </Card>
        )}

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-3 font-medium text-muted">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Used by</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.code} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold text-text">{c.code}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusFor(c).variant}>{statusFor(c).label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {c.used_by ? (
                        <div>
                          <p className="text-text">{(c as InviteCode & { redeemed_by_label?: string | null }).redeemed_by_label || c.used_email || c.used_by}</p>
                          {c.used_at && <p className="text-xs text-muted">{new Date(c.used_at).toLocaleString()}</p>}
                        </div>
                      ) : (
                        <span className="text-muted/60">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={isoToDateTimeInput(c.expires_at)}
                          onChange={e => updateExpiration(c.code, e.target.value)}
                          className="w-44 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                        />
                        <button onClick={() => updateExpiration(c.code, '')} className="text-xs text-muted hover:text-text">Never</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {!c.used_by && <Button size="sm" variant="ghost" onClick={() => copyCode(c.code)}>Copy</Button>}
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
