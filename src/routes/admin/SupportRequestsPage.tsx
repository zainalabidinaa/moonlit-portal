import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { SupportRequest, SupportStatus, SupportTopic } from '../../types';

const TOPIC_LABELS: Record<SupportTopic, string> = {
  general: 'General',
  account: 'Account',
  billing: 'Billing',
  playback: 'Playback',
  bug: 'Bug',
};

const STATUS_LABELS: Record<SupportStatus, string> = {
  new: 'New',
  open: 'Open',
  resolved: 'Resolved',
};

const STATUS_BADGE: Record<SupportStatus, 'default' | 'success' | 'warning' | 'purple'> = {
  new: 'purple',
  open: 'warning',
  resolved: 'success',
};

type Filter = 'all' | SupportStatus;

const filters: Filter[] = ['all', 'new', 'open', 'resolved'];

export default function SupportRequestsPage() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    load();
  }, [session]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setRequests((data ?? []) as SupportRequest[]);
    setLoading(false);
  }

  async function setStatus(id: string, status: SupportStatus) {
    setUpdating(id);
    const { error: err } = await supabase
      .from('support_requests')
      .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
      .eq('id', id);
    setUpdating(null);
    if (err) {
      setError(err.message);
      return;
    }
    setRequests(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }
          : r,
      ),
    );
  }

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const newCount = requests.filter(r => r.status === 'new').length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase">Support requests</h1>
          <p className="mt-1 text-sm text-muted">
            {newCount > 0 ? `${newCount} waiting on a first reply.` : 'Nothing new in the queue.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                filter === f
                  ? 'border-accent text-accent'
                  : 'border-border text-faint hover:text-text'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">No requests here yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(r => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text">{r.name}</span>
                    <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    <Badge>{TOPIC_LABELS[r.topic] ?? r.topic}</Badge>
                    {!r.notified_at && (
                      <span
                        title="Saved here, but the email notification never went out — check the support-notify function logs."
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-400"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Not emailed
                      </span>
                    )}
                    {r.notified_at && !r.confirmed_at && (
                      <span
                        title="Reached the team, but the sender never got their confirmation copy — rate limited, or check the support-notify logs."
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-faint"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                        No confirmation
                      </span>
                    )}
                  </div>
                  <a href={`mailto:${r.email}`} className="mt-1 block text-sm text-accent">{r.email}</a>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{r.message}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: Your Moonlit support request — ${TOPIC_LABELS[r.topic] ?? r.topic}`)}`}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  Reply by email
                </a>
                {r.status !== 'open' && (
                  <Button variant="ghost" size="sm" loading={updating === r.id} onClick={() => setStatus(r.id, 'open')}>
                    Mark open
                  </Button>
                )}
                {r.status !== 'resolved' && (
                  <Button variant="secondary" size="sm" loading={updating === r.id} onClick={() => setStatus(r.id, 'resolved')}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
