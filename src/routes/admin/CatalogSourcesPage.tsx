import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useCatalogSources } from '../../hooks/useCatalogSources';
import {
  KIND_LABEL,
  REFRESH_LABEL,
  summarize,
  type SourceHealth,
  type SourceKind,
} from '../../lib/catalogSources';

const PAGE_SIZE = 250;

const HEALTH_LABEL: Record<SourceHealth, string> = {
  ok: 'OK',
  empty: 'Empty',
  failed: 'Failed',
  stale: 'Stale',
  missing: 'Missing',
};

const HEALTH_VARIANT: Record<SourceHealth, 'success' | 'warning' | 'danger' | 'default'> = {
  ok: 'success',
  empty: 'warning',
  stale: 'warning',
  failed: 'danger',
  missing: 'danger',
};

const KIND_ORDER: SourceKind[] = ['tmdb-filter', 'tmdb-collection', 'trakt', 'mdblist', 'copy', 'unresolved'];
const PROBLEM_HEALTH: SourceHealth[] = ['failed', 'empty', 'stale', 'missing'];

function ago(iso: string | null): string {
  if (!iso) return '—';
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function CatalogSourcesPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const { rows, loading, error } = useCatalogSources(reloadKey);
  const [kind, setKind] = useState<SourceKind | 'all'>('all');
  const [health, setHealth] = useState<SourceHealth | 'all' | 'problems'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const summary = useMemo(() => summarize(rows), [rows]);
  const problemCount = PROBLEM_HEALTH.reduce((n, h) => n + summary.byHealth[h], 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (health === 'problems' ? !PROBLEM_HEALTH.includes(r.health) : health !== 'all' && r.health !== health) return false;
      if (!q) return true;
      return (
        r.catalogId.toLowerCase().includes(q) ||
        r.folderName.toLowerCase().includes(q) ||
        r.collectionName.toLowerCase().includes(q)
      );
    });
  }, [rows, kind, health, query]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? 'border-accent bg-accent-light text-accent' : 'border-border text-muted hover:text-text'
    }`;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">Catalog sources</h1>
            <p className="mt-1 text-sm text-muted">
              Every list the apps read, where it comes from, and whether it is healthy.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setReloadKey((k) => k + 1)}>Refresh</Button>
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <button className={`rounded-xl border p-3 text-left ${kind === 'all' ? 'border-accent' : 'border-border'} bg-surface`} onClick={() => setKind('all')}>
                <div className="text-xl font-semibold text-text">{summary.total}</div>
                <div className="text-xs text-muted">All sources</div>
              </button>
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  className={`rounded-xl border p-3 text-left ${kind === k ? 'border-accent' : 'border-border'} bg-surface`}
                  onClick={() => setKind(kind === k ? 'all' : k)}
                >
                  <div className="text-xl font-semibold text-text">{summary.byKind[k]}</div>
                  <div className="text-xs text-muted">{KIND_LABEL[k]}</div>
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                placeholder="Search by list, folder or collection"
                className="w-72 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
              />
              <button className={chip(health === 'all')} onClick={() => setHealth('all')}>Any health</button>
              <button className={chip(health === 'problems')} onClick={() => setHealth('problems')}>
                Needs attention · {problemCount}
              </button>
              {PROBLEM_HEALTH.map((h) => (
                <button key={h} className={chip(health === h)} onClick={() => setHealth(health === h ? 'all' : h)}>
                  {HEALTH_LABEL[h]} · {summary.byHealth[h]}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg">
                    <th className="px-4 py-3 text-left font-medium text-muted">List</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Refresh</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Last refresh</th>
                    <th className="px-4 py-3 text-right font-medium text-muted">Items</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Health</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <div className="text-text">{r.folderName}{r.genre ? <span className="text-muted"> · {r.genre}</span> : null}</div>
                        <div className="font-mono text-[11px] text-faint">{r.collectionName} · {r.catalogId}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={r.kind === 'unresolved' ? 'danger' : 'default'}>{KIND_LABEL[r.kind]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{REFRESH_LABEL[r.refresh]}</td>
                      <td className="px-4 py-2.5 text-muted" title={r.error ?? undefined}>{ago(r.fetchedAt)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text">{r.itemCount ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={HEALTH_VARIANT[r.health]}>{HEALTH_LABEL[r.health]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.collectionId && (
                          <Link className="text-xs text-accent hover:underline" to={`/admin/catalog?collection=${r.collectionId}`}>
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Nothing matches these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Showing {Math.min(limit, filtered.length)} of {filtered.length}</span>
              {filtered.length > limit && (
                <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Show more</Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
