import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FilteringWidgetFields } from '../../components/catalog/FilteringWidgetFields';
import { useCollectionPreviews, collectionCover, folderArt, type CollectionPreview } from '../../hooks/useCollectionPreviews';
import {
  DEFAULT_FILTERING_STATE,
  buildFilteringQuery,
  filteringValidationMessage,
  parseFilteringState,
  ORDERING_OPTIONS,
  genresFor,
  type FilteringState,
} from '../../lib/filteringQuery';
import {
  loadActivePresetItems,
  loadHomeWidgets,
  newWidgetId,
  normalizeWidget,
  saveHomeWidgets,
  widgetCollectionId,
  widgetsFromPresetItems,
  type CreatableKind,
  type HomeWidget,
  type WidgetTab,
} from '../../lib/homeWidgets';

const TABS: { id: WidgetTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
];

const KIND_LABEL: Record<string, string> = {
  collection: 'Collection',
  filtering: 'Filtering',
  browseHub: 'Browse hub',
  watchlist: 'Watchlist',
  addonCatalog: 'Add-on catalog',
  traktList: 'Trakt list',
  definition: 'Moonlit list',
  collectionsRow: 'Collections row',
};
const KIND_COLOR: Record<string, string> = {
  collection: 'border-cyan/35 text-cyan',
  filtering: 'border-accent/40 text-accent',
  browseHub: 'border-magenta/35 text-magenta',
  watchlist: 'border-amber-300/35 text-amber-200',
};
const HUB_TILES: Record<string, { label: string; bg: string }[]> = {
  genre: [
    { label: 'Thriller', bg: '#3a2f5c' }, { label: 'Sci-fi', bg: '#2f4a5c' }, { label: 'Drama', bg: '#5c2f3a' }, { label: 'Comedy', bg: '#2f5c3d' },
  ],
  language: [
    { label: 'Korean', bg: '#3a2f5c' }, { label: 'Japanese', bg: '#2f4a5c' }, { label: 'French', bg: '#5c2f3a' }, { label: 'Spanish', bg: '#2f5c3d' },
  ],
};

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error'; message: string };

function filteringSummary(query: string): string {
  const s = parseFilteringState(query, query.includes('first_air_date') || query.includes('with_status') ? 'series' : 'movie');
  const order = ORDERING_OPTIONS.find((o) => o.value === s.ordering)?.label ?? 'Popular';
  const genres = genresFor(s.mediaKind).filter((g) => s.genreIds.includes(g.id)).map((g) => g.name);
  return [s.mediaKind === 'series' ? 'Series' : 'Movies', order, genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / edit dialog

interface EditorProps {
  open: boolean;
  initial: HomeWidget | null;
  defaultTab: WidgetTab;
  collections: CollectionPreview[];
  onClose: () => void;
  onSave: (w: HomeWidget) => void;
}

function WidgetEditorDialog({ open, initial, defaultTab, collections, onClose, onSave }: EditorProps) {
  const initialKind = (initial?.dataSource.kind as CreatableKind | undefined) ?? null;
  const [kind, setKind] = useState<CreatableKind | null>(initialKind);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [tabs, setTabs] = useState<WidgetTab[]>(initial?.tabs ?? [defaultTab]);
  const [mediaType, setMediaType] = useState<'' | 'movie' | 'series'>(initial?.mediaType ?? '');
  const [collectionId, setCollectionId] = useState<string | null>(initial ? widgetCollectionId(initial) : null);
  const [hub, setHub] = useState<string>(initial?.dataSource.kind === 'browseHub' ? initial.dataSource.hub : 'genre');
  const [filtering, setFiltering] = useState<FilteringState>(
    initial?.dataSource.kind === 'filtering' ? parseFilteringState(initial.dataSource.query) : DEFAULT_FILTERING_STATE
  );
  const [search, setSearch] = useState('');

  const isEdit = !!initial;
  const shown = collections.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteringError = kind === 'filtering' ? filteringValidationMessage(filtering) : null;
  const problem =
    !kind ? 'Choose what the widget shows.' :
    tabs.length === 0 ? 'Pick at least one tab.' :
    kind === 'collection' && !collectionId ? 'Choose a collection.' :
    kind === 'filtering' && !title.trim() ? 'Give the widget a name.' :
    filteringError;

  function submit() {
    if (problem || !kind) return;
    const dataSource =
      kind === 'collection' ? { kind: 'collection' as const, collectionId: collectionId! } :
      kind === 'filtering' ? { kind: 'filtering' as const, query: buildFilteringQuery(filtering) } :
      kind === 'browseHub' ? { kind: 'browseHub' as const, hub } :
      { kind: 'watchlist' as const };
    onSave(normalizeWidget({
      ...(initial ?? {}),
      id: initial?.id ?? newWidgetId(),
      title: title.trim() || undefined,
      dataSource,
      tabs,
      mediaType: kind === 'collection' && mediaType ? mediaType : undefined,
      style: initial?.style ?? 'standard',
    }));
  }

  const kinds: { id: CreatableKind; title: string; body: string }[] = [
    { id: 'collection', title: 'A Moonlit collection', body: 'A curated collection, as a row of its groups or titles.' },
    { id: 'filtering', title: 'Filtering', body: 'Your own rules on TMDB: genres, years, rating, what is airing.' },
    { id: 'browseHub', title: 'Browse hub', body: 'The Browse by Genre or Browse by Language tiles.' },
    { id: 'watchlist', title: 'Watchlist', body: 'Everything you saved for later.' },
  ];
  const field = 'h-[46px] w-full rounded-[10px] border border-border-strong bg-bg2 px-3.5 text-[15px] text-text outline-none focus:border-accent';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit widget' : 'Add a widget'} width="max-w-2xl">
      <div className="grid gap-5 p-6">
        {!isEdit && (
          <div className="grid gap-2 sm:grid-cols-2">
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={`grid gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${kind === k.id ? 'border-accent bg-accent-light' : 'border-border-strong hover:border-muted'}`}
              >
                <b className="text-[15px] font-semibold">{k.title}</b>
                <span className="text-[13px] text-muted">{k.body}</span>
              </button>
            ))}
          </div>
        )}

        {kind && (
          <label className="grid gap-1.5">
            <span className="text-[13.5px] font-medium text-muted">Name {kind === 'filtering' ? '' : <em className="not-italic text-faint">(optional)</em>}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder={kind === 'filtering' ? 'Friday horror' : 'Uses the source’s own name'} />
          </label>
        )}

        {kind === 'collection' && (
          <div className="grid gap-2.5">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search collections" className={field} />
            <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {shown.map((c) => {
                const cover = collectionCover(c);
                const on = collectionId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCollectionId(c.id)}
                    aria-pressed={on}
                    className={`grid grid-cols-[72px_1fr] items-center gap-3 rounded-xl border p-2 text-left transition-colors ${on ? 'border-accent bg-accent-light' : 'border-border hover:border-border-strong'}`}
                  >
                    <span className="block aspect-video overflow-hidden rounded-md bg-surface-2">
                      {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-sm font-semibold">{c.name}</b>
                      <small className="text-xs text-faint">{c.folders.length > 1 ? `${c.folders.length} groups` : 'Single row'}</small>
                    </span>
                  </button>
                );
              })}
              {shown.length === 0 && <p className="text-sm text-faint">No collections match.</p>}
            </div>
            <label className="grid gap-1.5 sm:max-w-[240px]">
              <span className="text-[13.5px] font-medium text-muted">Show</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as '' | 'movie' | 'series')} className={field}>
                <option value="">Movies and series</option>
                <option value="movie">Movies only</option>
                <option value="series">Series only</option>
              </select>
            </label>
          </div>
        )}

        {kind === 'filtering' && <FilteringWidgetFields value={filtering} onChange={setFiltering} />}

        {kind === 'browseHub' && (
          <div className="flex gap-2">
            {(['genre', 'language'] as const).map((h) => (
              <button key={h} type="button" aria-pressed={hub === h} onClick={() => setHub(h)}
                className={`h-10 rounded-full border px-4 text-sm font-medium ${hub === h ? 'border-accent bg-accent-light text-accent' : 'border-border-strong text-muted'}`}>
                {h === 'genre' ? 'Browse by genre' : 'Browse by language'}
              </button>
            ))}
          </div>
        )}

        {kind && (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[13.5px] font-medium text-muted">Show on</legend>
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => {
                const on = tabs.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on}
                    onClick={() => setTabs((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                    className={`h-9 rounded-full border px-4 text-sm font-medium ${on ? 'border-transparent bg-text text-[#0a0a0c]' : 'border-border-strong text-muted'}`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[13px] text-faint">{problem ?? 'Saved to your Home on every device.'}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={!!problem}>{isEdit ? 'Save widget' : 'Add widget'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card

function WidgetCard({
  w, index, count, collection, onToggle, onMove, onEdit, onRemove,
}: {
  w: HomeWidget; index: number; count: number; collection: CollectionPreview | undefined;
  onToggle: () => void; onMove: (dir: -1 | 1) => void; onEdit: () => void; onRemove: () => void;
}) {
  const kind = w.dataSource.kind;
  const editable = ['collection', 'filtering', 'browseHub', 'watchlist'].includes(kind);
  const name =
    w.title ||
    collection?.name ||
    (kind === 'browseHub' ? (w.dataSource.kind === 'browseHub' && w.dataSource.hub === 'language' ? 'Browse by language' : 'Browse by genre') :
     kind === 'watchlist' ? 'Watchlist' : KIND_LABEL[kind] ?? 'Widget');
  const sub =
    kind === 'collection' ? (collection ? `${collection.folders.length > 1 ? `${collection.folders.length} groups` : 'Collection row'}${w.mediaType ? ` · ${w.mediaType === 'movie' ? 'movies only' : 'series only'}` : ''}` : 'Collection no longer available') :
    kind === 'filtering' && w.dataSource.kind === 'filtering' ? filteringSummary(w.dataSource.query) :
    kind === 'browseHub' ? 'Tiles open a room for each one' :
    kind === 'watchlist' ? 'Titles you saved for later' :
    'Made in the app';
  const art = collection ? folderArt(collection, 5) : [];
  const hubTiles = w.dataSource.kind === 'browseHub' ? HUB_TILES[w.dataSource.hub] ?? HUB_TILES.genre : null;

  return (
    <div className={`grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-border bg-surface transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-border-strong ${w.isHidden ? 'opacity-55' : ''}`}>
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="w-5 font-mono text-[11px] text-faint">{String(index + 1).padStart(2, '0')}</span>
        <span className={`rounded-[5px] border px-1.5 py-0.5 font-mono text-[10.5px] tracking-[.06em] ${KIND_COLOR[kind] ?? 'border-border-strong text-muted'}`}>{KIND_LABEL[kind] ?? kind}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30">↑</button>
          <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30">↓</button>
        </span>
      </div>
      <div className="px-4 pb-1 pt-2.5">
        <b className="block text-[15px] font-semibold">{name}</b>
        <small className="mt-0.5 block text-[12.5px] text-muted">{sub}</small>
        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {hubTiles
            ? hubTiles.map((t) => (
                <span key={t.label} className="grid aspect-[16/10] w-[72px] flex-none place-items-center rounded-md text-[11px] font-semibold text-white" style={{ background: `linear-gradient(140deg, ${t.bg}, #111)` }}>{t.label}</span>
              ))
            : art.map((src) => <img key={src} src={src} alt="" loading="lazy" className="aspect-[2/3] w-11 flex-none rounded object-cover" />)}
          {!hubTiles && art.length === 0 && (
            <span className="grid h-[66px] w-full place-items-center rounded-md border border-dashed border-border text-xs text-faint">
              {kind === 'filtering' ? 'Titles load live from TMDB' : kind === 'watchlist' ? 'Your saved titles' : 'No preview'}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border px-4 py-3">
        <button type="button" onClick={onToggle} aria-pressed={!w.isHidden} className="inline-flex items-center gap-2 text-[13px] text-muted">
          <i className={`relative inline-block h-5 w-[34px] rounded-full border transition-colors ${w.isHidden ? 'border-border-strong bg-surface-2' : 'border-transparent bg-accent'}`}>
            <i className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${w.isHidden ? 'left-0.5' : 'left-0.5 translate-x-3.5'}`} />
          </i>
          {w.isHidden ? 'Hidden' : 'Showing'}
        </button>
        <span className="flex gap-1.5">
          {editable && <button type="button" onClick={onEdit} className="h-7 rounded-full border border-border-strong px-2.5 text-xs font-medium text-muted hover:text-text">Edit</button>}
          <button type="button" onClick={onRemove} className="h-7 rounded-full border border-border-strong px-2.5 text-xs font-medium text-muted hover:border-red-400/50 hover:text-red-400">Remove</button>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export default function MyWidgetsPage() {
  const { role, activeProfile } = useAuth();
  const { collections } = useCollectionPreviews();
  const [widgets, setWidgets] = useState<HomeWidget[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [tab, setTab] = useState<WidgetTab>('home');
  const [editor, setEditor] = useState<{ open: boolean; widget: HomeWidget | null }>({ open: false, widget: null });
  const [preset, setPreset] = useState<{ presetName: string; count: number } | null>(null);
  const [starting, setStarting] = useState(false);

  const eligible = role === 'spotlight' || role === 'studio' || role === 'admin';
  const profileId = activeProfile?.id;

  useEffect(() => {
    if (!eligible || !profileId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    Promise.all([loadHomeWidgets(profileId), loadActivePresetItems().catch(() => null)])
      .then(([stored, active]) => {
        if (cancelled) return;
        setWidgets(stored.widgets);
        setIsNew(stored.isNew);
        if (stored.updatedAt) setSave({ kind: 'saved', at: stored.updatedAt });
        setPreset(active ? { presetName: active.presetName, count: active.items.length } : null);
      })
      .catch((e) => !cancelled && setLoadError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [eligible, profileId]);

  const byId = useMemo(() => Object.fromEntries(collections.map((c) => [c.id, c])), [collections]);
  const inTab = widgets.filter((w) => w.tabs.includes(tab));
  const counts = Object.fromEntries(TABS.map((t) => [t.id, widgets.filter((w) => w.tabs.includes(t.id)).length])) as Record<WidgetTab, number>;

  async function persist(next: HomeWidget[]) {
    if (!profileId) return;
    const prev = widgets;
    setWidgets(next);
    setIsNew(false);
    setSave({ kind: 'saving' });
    try {
      const at = await saveHomeWidgets(profileId, next);
      setSave({ kind: 'saved', at });
    } catch (e) {
      setWidgets(prev);
      setSave({ kind: 'error', message: (e as Error).message });
    }
  }

  async function startFromPreset() {
    setStarting(true);
    try {
      const active = await loadActivePresetItems();
      await persist(active ? widgetsFromPresetItems(active.items) : []);
    } finally {
      setStarting(false);
    }
  }

  function move(w: HomeWidget, dir: -1 | 1) {
    // Reorder within the visible tab, keeping every other widget where it is.
    const tabIds = inTab.map((x) => x.id);
    const i = tabIds.indexOf(w.id);
    const j = i + dir;
    if (j < 0 || j >= tabIds.length) return;
    const a = widgets.findIndex((x) => x.id === tabIds[i]);
    const b = widgets.findIndex((x) => x.id === tabIds[j]);
    const next = [...widgets];
    [next[a], next[b]] = [next[b], next[a]];
    void persist(next);
  }

  function upsert(w: HomeWidget) {
    const exists = widgets.some((x) => x.id === w.id);
    void persist(exists ? widgets.map((x) => (x.id === w.id ? w : x)) : [...widgets, w]);
    setEditor({ open: false, widget: null });
  }

  const savedLabel =
    save.kind === 'saving' ? 'Saving…' :
    save.kind === 'error' ? `Not saved: ${save.message}` :
    save.kind === 'saved' ? `Saved ${new Date(save.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : '';

  if (!eligible) {
    return (
      <AppShell wide={false}>
        <div className="grid gap-6">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight">My widgets</h1>
            <p className="mt-1.5 text-[15px] text-muted">Your own rows on Home, built from Moonlit’s collections and your own filters.</p>
          </div>
          <div className="grid gap-3.5 rounded-2xl border border-accent/35 bg-[linear-gradient(135deg,rgba(255,122,61,.12),transparent_60%)] bg-surface p-[22px]">
            <b className="text-base font-semibold">{role === 'friends_family' ? 'Friends & Family accounts use the shared Moonlit Home.' : 'My widgets comes with Spotlight and Studio.'}</b>
            <p className="text-sm text-muted">Subscribe to build your own Home rows that sync to every device.</p>
            <Link to="/pricing" className="inline-flex h-[38px] w-fit items-center rounded-full bg-text px-4 text-sm font-semibold text-[#0a0a0c] hover:bg-white">See plans</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Your Home</p>
          <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-tight">My widgets</h1>
          <p className="mt-2 max-w-[46em] text-[15px] text-muted">
            Your own rows on Moonlit’s Home, Movies and Series tabs. They belong to this profile only and sync to Mac, iPhone and the web. Moonlit’s shared layout is never changed.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditor({ open: true, widget: null })} disabled={loading || !!loadError}>Add widget</Button>
      </div>

      <div className="mb-6 mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1.5">
            Editing <b className="font-semibold text-text">{activeProfile?.name ?? 'this profile'}</b>
            <Link to="/profiles" className="text-accent">Switch</Link>
          </span>
          {savedLabel && <span className={save.kind === 'error' ? 'text-red-400' : 'text-faint'}>{savedLabel}</span>}
        </div>
        <div className="inline-flex gap-0.5 rounded-full border border-border bg-bg2 p-1" role="group" aria-label="App tab">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}
              className={`h-8 rounded-full px-4 text-[13px] font-medium transition-colors ${tab === t.id ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}>
              {t.label}<span className="ml-1.5 font-mono text-[10.5px] opacity-60">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading your widgets…</p>}
      {loadError && <p className="text-sm text-red-400">Couldn’t load your widgets: {loadError}</p>}

      {!loading && !loadError && isNew && (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-surface p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <b className="text-base font-semibold">This profile uses Moonlit’s shared Home{preset ? ` (${preset.presetName})` : ''}.</b>
            <p className="mt-1 text-sm text-muted">
              Start from a copy of it{preset ? ` — ${preset.count} rows` : ''} and change what you like, or start empty and add only your own rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {preset && <Button size="sm" loading={starting} onClick={startFromPreset}>Start from Moonlit’s Home</Button>}
            <Button size="sm" variant="ghost" onClick={() => setEditor({ open: true, widget: null })}>Start empty</Button>
          </div>
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inTab.map((w, i) => (
            <WidgetCard
              key={w.id}
              w={w}
              index={i}
              count={inTab.length}
              collection={(() => { const id = widgetCollectionId(w); return id ? byId[id] : undefined; })()}
              onToggle={() => persist(widgets.map((x) => (x.id === w.id ? { ...x, isHidden: !x.isHidden } : x)))}
              onMove={(d) => move(w, d)}
              onEdit={() => setEditor({ open: true, widget: w })}
              onRemove={() => persist(widgets.filter((x) => x.id !== w.id))}
            />
          ))}
          <button
            type="button"
            onClick={() => setEditor({ open: true, widget: null })}
            className="grid min-h-[210px] place-items-center rounded-2xl border border-dashed border-border-strong p-5 text-center font-medium text-muted transition-colors hover:border-accent hover:text-text"
          >
            <span><span className="block text-[26px] font-light text-faint">+</span>Add a widget to {TABS.find((t) => t.id === tab)?.label}</span>
          </button>
        </div>
      )}

      {editor.open && (
        <WidgetEditorDialog
          open
          initial={editor.widget}
          defaultTab={tab}
          collections={collections}
          onClose={() => setEditor({ open: false, widget: null })}
          onSave={upsert}
        />
      )}
    </AppShell>
  );
}
