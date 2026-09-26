import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FilteringWidgetFields } from './FilteringWidgetFields';
import { DEFAULT_FILTERING_STATE, type FilteringState } from '../../lib/filteringQuery';
import {
  collectionSource,
  definitionSource,
  filterSource,
  listSource,
  type BuildResult,
  type NativeSourceRow,
} from '../../lib/addSource';

type Tab = 'filter' | 'moonlit' | 'collection' | 'list';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'filter', label: 'TMDB filter', hint: 'Build a list from genres, years, ratings and more.' },
  { id: 'moonlit', label: 'Moonlit list', hint: 'Start from one of Moonlit’s ready-made lists.' },
  { id: 'collection', label: 'Collection', hint: 'A TMDB franchise, like John Wick or the MCU.' },
  { id: 'list', label: 'Trakt / MDBList', hint: 'A public list from Trakt or MDBList.' },
];

interface Definition {
  id: string;
  title: string;
  media_type: string;
  params: Record<string, unknown> | null;
}

interface Props {
  open: boolean;
  folderName: string;
  onClose: () => void;
  onAdd: (row: NativeSourceRow) => Promise<void>;
}

export function AddSourceDialog({ open, folderName, onClose, onAdd }: Props) {
  const [tab, setTab] = useState<Tab>('filter');
  const [filter, setFilter] = useState<FilteringState>(DEFAULT_FILTERING_STATE);
  const [definitions, setDefinitions] = useState<Definition[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState('');
  const [provider, setProvider] = useState<'trakt' | 'mdblist'>('trakt');
  const [listId, setListId] = useState('');
  const [listKind, setListKind] = useState<'movie' | 'series'>('movie');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || tab !== 'moonlit' || definitions) return;
    supabase
      .from('catalog_definitions')
      .select('id,title,media_type,params')
      .eq('enabled', true)
      .order('sort_order')
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        setDefinitions((data ?? []) as Definition[]);
      });
  }, [open, tab, definitions]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (definitions ?? []).filter((d) => !q || d.title.toLowerCase().includes(q));
  }, [definitions, query]);

  function build(): BuildResult {
    switch (tab) {
      case 'filter':
        return filterSource(filter);
      case 'moonlit': {
        const def = (definitions ?? []).find((d) => d.id === picked);
        return def ? definitionSource(def) : { error: 'Pick a list first.' };
      }
      case 'collection':
        return collectionSource(collectionId);
      case 'list':
        return listSource(provider, listId, listKind);
    }
  }

  async function submit() {
    const result = build();
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAdd(result.row);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not add the source.');
    } finally {
      setSaving(false);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition-colors ${
      active ? 'border-accent bg-accent-light text-accent' : 'border-border text-muted hover:text-text'
    }`;

  return (
    <Modal open={open} onClose={onClose} title={`Add source · ${folderName}`} width="max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} className={chip(tab === t.id)} onClick={() => { setTab(t.id); setError(null); }}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{TABS.find((t) => t.id === tab)?.hint}</p>

        {tab === 'filter' && <FilteringWidgetFields value={filter} onChange={setFilter} />}

        {tab === 'moonlit' && (
          <div className="flex flex-col gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Moonlit lists" />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
              {definitions === null && <p className="p-4 text-sm text-muted">Loading…</p>}
              {shown.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPicked(d.id)}
                  className={`flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-left text-sm last:border-0 ${
                    picked === d.id ? 'bg-accent-light text-accent' : 'text-text hover:bg-surface-2'
                  }`}
                >
                  <span>{d.title}</span>
                  <span className="font-mono text-[10px] uppercase text-faint">{d.media_type}</span>
                </button>
              ))}
              {definitions !== null && shown.length === 0 && <p className="p-4 text-sm text-muted">No lists match.</p>}
            </div>
            <p className="text-[11px] text-faint">
              This adds a copy of the list&apos;s settings to the folder. Later changes to the Moonlit list won&apos;t carry over.
            </p>
          </div>
        )}

        {tab === 'collection' && (
          <div className="flex flex-col gap-2">
            <Input value={collectionId} onChange={(e) => setCollectionId(e.target.value)} placeholder="Collection number, e.g. 295" />
            <p className="text-[11px] text-faint">It&apos;s the number at the end of the collection&apos;s page on themoviedb.org.</p>
          </div>
        )}

        {tab === 'list' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button className={chip(provider === 'trakt')} onClick={() => setProvider('trakt')}>Trakt</button>
              <button className={chip(provider === 'mdblist')} onClick={() => setProvider('mdblist')}>MDBList</button>
              <span className="mx-1 w-px bg-border" />
              <button className={chip(listKind === 'movie')} onClick={() => setListKind('movie')}>Movies</button>
              <button className={chip(listKind === 'series')} onClick={() => setListKind('series')}>Series</button>
            </div>
            <Input value={listId} onChange={(e) => setListId(e.target.value)} placeholder="List number" />
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit}>Add source</Button>
        </div>
      </div>
    </Modal>
  );
}
