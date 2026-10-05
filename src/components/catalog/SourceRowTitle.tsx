import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FolderCatalog } from '../../types';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type TitlePatch = Partial<Pick<FolderCatalog, 'title' | 'person_tmdb_id'>>;

interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
}

/**
 * The names the server saved with its copies of these lists
 * (`catalog_snapshots.name`), by catalog id. Admin-readable only; anyone else
 * gets an empty map and the editor falls back to the catalog id.
 */
export function useListNames(catalogIds: string[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = [...new Set(catalogIds)].sort().join('|');
  useEffect(() => {
    const ids = key ? key.split('|') : [];
    if (ids.length === 0) { setNames({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('catalog_snapshots').select('catalog_id, name').in('catalog_id', ids);
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of (data ?? []) as { catalog_id: string; name: string | null }[]) {
          if (row.name) next[row.catalog_id] = row.name;
        }
        setNames(next);
      } catch {
        // Names are a nicety — the editor still works with catalog ids.
        if (!cancelled) setNames({});
      }
    })();
    return () => { cancelled = true; };
  }, [key]);
  return names;
}

/** Saves a row-title/portrait change on one folder source. */
export async function saveSourceTitle(id: string, patch: TitlePatch): Promise<void> {
  const { error } = await supabase.from('folder_catalogs').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

async function searchPeople(query: string): Promise<PersonResult[]> {
  const params = new URLSearchParams({ kind: 'person', query });
  const res = await fetch(`${FUNCTIONS_URL}/tmdb-discover?${params.toString()}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: PersonResult[] };
  return (json.results ?? []).slice(0, 6);
}

/**
 * Row title + portrait for one folder source, as the app's genre/language
 * hub shows it. The title falls back to the list's own name, then the folder
 * name; the portrait is matched from the title unless pinned or turned off.
 */
export function SourceRowTitle({
  catalog,
  listName,
  onSave,
}: {
  catalog: FolderCatalog;
  listName?: string | null;
  onSave: (patch: TitlePatch) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(catalog.title ?? '');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [pinnedName, setPinnedName] = useState<string | null>(null);

  useEffect(() => { setDraft(catalog.title ?? ''); }, [catalog.title]);

  useEffect(() => {
    if (!picking || query.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchPeople(query.trim()).then((r) => { if (!cancelled) setResults(r); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [picking, query]);

  async function commitTitle(value: string) {
    const next = value.trim() || null;
    if (next === (catalog.title ?? null)) return;
    setSaving(true);
    try { await onSave({ title: next }); } finally { setSaving(false); }
  }

  const portraitMode = catalog.person_tmdb_id === 0 ? 'off' : catalog.person_tmdb_id ? 'pinned' : 'auto';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commitTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={listName ?? 'Row title'}
        aria-label="Row title"
        className="w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[12.5px] text-text outline-none focus:border-accent"
      />
      <p className="text-[11px] text-faint">
        {catalog.title ? (
          <>
            Your title{saving ? ' · saving…' : ''}
            {' · '}
            <button className="text-accent hover:underline" onClick={() => { setDraft(''); commitTitle(''); }}>
              Use list name
            </button>
          </>
        ) : listName ? (
          <>List name: “{listName}”</>
        ) : (
          <>Uses the folder name until the server saves this list&apos;s name</>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
        <span>Portrait:</span>
        <select
          value={portraitMode}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === 'auto') onSave({ person_tmdb_id: null });
            if (mode === 'off') onSave({ person_tmdb_id: 0 });
            if (mode === 'pinned') { setPicking(true); setQuery(catalog.title ?? listName ?? ''); }
          }}
          className="rounded border border-border bg-bg2 px-1.5 py-0.5 text-[11px] text-text"
        >
          <option value="auto">Match the title</option>
          <option value="pinned">{portraitMode === 'pinned' ? (pinnedName ?? `Person #${catalog.person_tmdb_id}`) : 'Pick a person…'}</option>
          <option value="off">None</option>
        </select>
        {portraitMode === 'pinned' && !picking && (
          <button className="text-accent hover:underline" onClick={() => setPicking(true)}>change</button>
        )}
      </div>
      {picking && (
        <div className="mt-1 rounded-lg border border-border bg-surface p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people on TMDB"
            className="mb-1.5 w-full rounded border border-border bg-bg2 px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-1">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPinnedName(p.name); setPicking(false); onSave({ person_tmdb_id: p.id }); }}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] text-text hover:bg-surface-2"
              >
                {p.profile_path ? (
                  <img src={`https://image.tmdb.org/t/p/w92${p.profile_path}`} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-surface-2" />
                )}
                <span className="truncate">{p.name}</span>
                {p.known_for_department && <span className="text-faint">· {p.known_for_department}</span>}
              </button>
            ))}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="px-1.5 py-1 text-[11px] text-faint">No matches</p>
            )}
          </div>
          <button className="mt-1 text-[11px] text-faint hover:text-text" onClick={() => setPicking(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
