import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchAllRows } from '../../lib/fetchAllRows';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { SectionHead } from '../../components/landing/SectionHead';
import { useTrending, posterUrl } from '../../hooks/useTrending';
import type { Collection, Folder, FolderCatalog } from '../../types';

interface FolderWithSources extends Folder {
  sourceCount: number;
  catalogs: FolderCatalog[];
}

interface CollectionWithFolders extends Collection {
  folders: FolderWithSources[];
}

function catalogLabel(c: FolderCatalog): string {
  const id = c.catalog_id;
  if (id.startsWith('trakt.list.')) return 'Trakt list';
  if (id.startsWith('tmdb.collection.')) return 'TMDB collection';
  if (id.startsWith('tmdb.trending_')) return `TMDB trending ${c.media_type}s`;
  if (id.startsWith('tmdb.discover.')) return 'TMDB discover';
  if (id.startsWith('tmdb.top_')) return 'TMDB top';
  if (id.startsWith('mdblist.')) return 'MDBList';
  return id.split('.').slice(0, 2).join('.');
}

type Filter = 'all' | 'grouped' | 'rows';

function CollectionCard({ col }: { col: CollectionWithFolders }) {
  const [open, setOpen] = useState(false);
  const isGrouped = col.folders.length > 1;
  const cover = col.backdrop_image ?? col.folders.find((f) => f.hero_backdrop)?.hero_backdrop ?? col.folders.find((f) => f.cover_image)?.cover_image;
  const sources = col.folders.reduce((s, f) => s + f.sourceCount, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} className="group relative block aspect-[16/10] w-full overflow-hidden text-left">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-surface-2" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,8,10,.92),rgba(8,8,10,.2)_60%,transparent)]" />
        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-black/55 px-2 py-1 font-mono text-[10.5px]">
          {isGrouped ? `${col.folders.length} groups` : `${sources} source${sources === 1 ? '' : 's'}`}
        </span>
        <div className="absolute inset-x-3.5 bottom-3">
          <strong className="block text-[17px] font-semibold tracking-tight">{col.name}</strong>
          <small className="mt-0.5 block truncate text-xs text-muted">
            {isGrouped ? col.folders.slice(0, 3).map((f) => f.name).join(' · ') : 'Curated row'}
          </small>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <span>{open ? 'Hide' : 'Show'} {isGrouped ? 'groups' : 'sources'}</span>
        <span className={`h-2 w-2 rotate-45 border-b-[1.5px] border-r-[1.5px] border-muted transition-transform ${open ? '-rotate-[135deg]' : ''}`} />
      </button>

      {open && (
        <div className="grid gap-2 border-t border-border p-4">
          {isGrouped
            ? col.folders.map((f) => (
                <div key={f.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border border-border bg-bg2 p-2">
                  <div className="aspect-[2/3] overflow-hidden rounded-md bg-surface-2">
                    {(f.cover_image ?? f.hero_backdrop) && <img src={f.cover_image ?? f.hero_backdrop ?? ''} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <b className="block truncate text-sm font-semibold">{f.name}</b>
                    <small className="block truncate text-xs text-faint">{f.catalogs.map(catalogLabel).slice(0, 2).join(' · ') || 'No sources configured'}</small>
                  </div>
                  <span className="font-mono text-[11px] text-muted">{f.sourceCount} src</span>
                </div>
              ))
            : (col.folders[0]?.catalogs ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg2 px-3 py-2.5">
                  <span className="font-mono text-[10.5px] uppercase text-faint">{c.media_type}</span>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">{catalogLabel(c)}</span>
                    <span className="block truncate font-mono text-[11px] text-faint">{c.catalog_id}{c.genre ? ` · ${c.genre}` : ''}</span>
                  </div>
                </div>
              ))}
          {!isGrouped && (col.folders[0]?.sourceCount ?? 0) === 0 && <p className="text-sm text-faint">No sources configured</p>}
        </div>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionWithFolders[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const trending = useTrending();

  useEffect(() => {
    async function load() {
      try {
        const [{ data: cols }, folders, catalogs] = await Promise.all([
          supabase.from('collections').select('*').order('sort_order'),
          fetchAllRows<Folder>('folders'),
          fetchAllRows<FolderCatalog>('folder_catalogs', 'id'),
        ]);

        if (!cols) { setError('Could not load collections.'); return; }

        const enriched: CollectionWithFolders[] = (cols as Collection[]).map((col) => {
          const colFolders = folders
            .filter((f) => f.collection_id === col.id)
            .map((f) => {
              const fc = catalogs.filter((c) => c.folder_id === f.id);
              return { ...f, sourceCount: fc.length, catalogs: fc };
            });
          return { ...col, folders: colFolders };
        });

        setCollections(enriched);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const shown = useMemo(
    () => collections.filter((c) => (filter === 'all' ? true : filter === 'grouped' ? c.folders.length > 1 : c.folders.length <= 1)),
    [collections, filter]
  );
  const totalGroups = collections.reduce((s, c) => s + c.folders.length, 0);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'grouped', label: 'Grouped collections' },
    { id: 'rows', label: 'Featured rows' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-5 pb-24 pt-[calc(var(--nav-h)+72px)] md:px-8 md:pt-[calc(var(--nav-h)+110px)]">
        <div className="mb-10 grid max-w-[720px] gap-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">The catalog</p>
          <h1 className="text-[clamp(40px,6vw,72px)] font-semibold leading-[1.05]">Every collection on Moonlit.</h1>
          <p className="max-w-[36em] text-lg text-muted">
            {loading ? 'Loading collections…' : `${collections.length} collections and ${totalGroups} groups, put together by curators with their own artwork. Open one in the app and start at the top.`}
          </p>
        </div>

        {!loading && !error && collections.length > 0 && (
          <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filter collections">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={filter === c.id}
                onClick={() => setFilter(c.id)}
                className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${filter === c.id ? 'border-transparent bg-text text-[#0a0a0c]' : 'border-border-strong text-muted hover:text-text'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-6 py-5 text-sm text-red-300">
            {error}. <Link to="/login" className="underline">Sign in</Link> if collections require authentication.
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {shown.map((col) => <CollectionCard key={col.id} col={col} />)}
          </div>
        )}

        {!loading && !error && collections.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-sm text-faint">No collections found.</p>
            <p className="mt-2 text-xs text-faint">Collections are managed by your Moonlit admin.</p>
          </div>
        )}

        {trending.length > 0 && (
          <div className="mt-20">
            <SectionHead kicker="Trending now" title="What households are watching this week." className="mb-9" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
              {trending.map((t) => {
                const src = posterUrl(t);
                return src ? (
                  <div key={`${t.media_type}-${t.id}`} className="group relative aspect-[2/3] overflow-hidden rounded-[10px] bg-surface-2 transition-transform duration-500 hover:-translate-y-1.5">
                    <img src={src} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2.5 pt-7 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">{t.title}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
