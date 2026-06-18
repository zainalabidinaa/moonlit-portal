import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Navbar } from '../../components/layout/Navbar';
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
  if (id.startsWith('trakt.list.')) return `Trakt list`;
  if (id.startsWith('tmdb.collection.')) return `TMDB collection`;
  if (id.startsWith('tmdb.trending_')) return `TMDB trending ${c.media_type}s`;
  if (id.startsWith('tmdb.discover.')) return `TMDB discover`;
  if (id.startsWith('tmdb.top_')) return `TMDB top`;
  if (id.startsWith('mdblist.')) return `MDBList`;
  return id.split('.').slice(0, 2).join('.');
}

function mediaTypeIcon(mt: string) {
  return mt === 'series' ? '📺' : '🎬';
}

function FolderCard({ folder, index }: { folder: FolderWithSources; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const img = folder.hero_backdrop ?? folder.cover_image;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface transition-all">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="relative flex w-full flex-col text-left"
      >
        {/* Hero image */}
        <div className="relative h-[120px] overflow-hidden bg-bg2">
          {img ? (
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-[11px] text-faint">no image</span>
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(0deg,rgba(13,6,4,.88),transparent 55%)' }}
          />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <span className="rounded-full bg-bg/70 px-2 py-0.5 font-mono text-[9px] tracking-wide text-muted backdrop-blur">
              #{index + 1}
            </span>
            {folder.tile_shape && (
              <span className="rounded-full bg-bg/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-faint backdrop-blur">
                {folder.tile_shape}
              </span>
            )}
          </div>
          {folder.sourceCount > 0 && (
            <div className="absolute left-3 bottom-3">
              <span className="rounded-full bg-accent/20 px-2.5 py-1 font-mono text-[10px] text-accent">
                {folder.sourceCount} source{folder.sourceCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3">
          <span className="truncate text-[13px] font-semibold">{folder.name}</span>
          <span className="ml-2 flex-none text-faint">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && folder.catalogs.length > 0 && (
        <div className="border-t border-border px-3 pb-3">
          <div className="mt-2 flex flex-col gap-1.5">
            {folder.catalogs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl bg-bg2 px-3 py-2">
                <span className="text-sm">{mediaTypeIcon(c.media_type)}</span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-text">{catalogLabel(c)}</span>
                  <span className="block truncate font-mono text-[9px] text-faint">{c.catalog_id}{c.genre ? ` · ${c.genre}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionCard({ col }: { col: CollectionWithFolders }) {
  const [open, setOpen] = useState(false);
  const isGrouped = col.folders.length > 1;
  const heroImg = col.backdrop_image ?? col.folders[0]?.hero_backdrop ?? col.folders[0]?.cover_image;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">
      {/* Collection hero */}
      <button onClick={() => setOpen((v) => !v)} className="relative w-full text-left">
        <div className="relative h-[200px] overflow-hidden bg-bg2">
          {heroImg ? (
            <img src={heroImg} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-bg2">
              <span className="font-mono text-[11px] text-faint">no backdrop</span>
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg,rgba(200,148,26,.08),transparent 40%),linear-gradient(0deg,rgba(13,6,4,.96),transparent 50%)' }}
          />

          {/* Badges */}
          <div className="absolute right-4 top-4 flex gap-2">
            {isGrouped && (
              <span className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 font-mono text-[10px] text-accent">
                {col.folders.length} groups
              </span>
            )}
            <span className="rounded-full border border-border bg-bg/70 px-3 py-1 font-mono text-[10px] text-muted backdrop-blur">
              {col.folders.reduce((s, f) => s + f.sourceCount, 0)} sources
            </span>
          </div>

          {/* Title */}
          <div className="absolute inset-x-5 bottom-5">
            <h3 className="font-display text-2xl font-extrabold uppercase leading-tight">{col.name}</h3>
            {isGrouped && (
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                {col.folders.map((f) => f.name).slice(0, 4).join(' · ')}{col.folders.length > 4 ? ` +${col.folders.length - 4} more` : ''}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expand toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-border px-5 py-3 text-sm text-muted transition-colors hover:text-text"
      >
        <span className="font-mono text-[11px] uppercase tracking-wide">
          {open ? 'Hide' : 'Show'} {isGrouped ? `${col.folders.length} groups` : 'folder'}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded folder grid */}
      {open && (
        <div className="border-t border-border p-5">
          {isGrouped ? (
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
              {col.folders.map((f, i) => (
                <FolderCard key={f.id} folder={f} index={i} />
              ))}
            </div>
          ) : (
            // Single folder — show sources inline
            <div className="flex flex-col gap-2">
              {col.folders[0]?.catalogs.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-bg2 px-4 py-3">
                  <span className="text-base">{mediaTypeIcon(c.media_type)}</span>
                  <div>
                    <span className="block font-mono text-[12px] text-text">{catalogLabel(c)}</span>
                    <span className="block font-mono text-[10px] text-faint">{c.catalog_id}{c.genre ? ` · ${c.genre}` : ''}</span>
                  </div>
                </div>
              ))}
              {col.folders[0]?.sourceCount === 0 && (
                <p className="font-mono text-[11px] text-faint">No sources configured</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionWithFolders[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: cols }, { data: folders }, { data: catalogs }] = await Promise.all([
          supabase.from('collections').select('*').order('sort_order'),
          supabase.from('folders').select('*').order('sort_order'),
          supabase.from('folder_catalogs').select('*'),
        ]);

        if (!cols) { setError('Could not load collections.'); return; }

        const folderList = (folders ?? []) as Folder[];
        const catalogList = (catalogs ?? []) as FolderCatalog[];

        const enriched: CollectionWithFolders[] = (cols as Collection[]).map((col) => {
          const colFolders = folderList
            .filter((f) => f.collection_id === col.id)
            .map((f) => {
              const fc = catalogList.filter((c) => c.folder_id === f.id);
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

  const totalFolders = collections.reduce((s, c) => s + c.folders.length, 0);
  const totalSources = collections.reduce((s, c) => s + c.folders.reduce((sf, f) => sf + f.sourceCount, 0), 0);
  const multiGroupCollections = collections.filter((c) => c.folders.length > 1);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      {/* Header */}
      <section className="mx-auto max-w-7xl px-5 pb-8 pt-16">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">trymoonlit.app</p>
        <h1 className="font-display text-[clamp(40px,6vw,80px)] font-extrabold uppercase leading-[1.02]">
          The Catalog
        </h1>
        <p className="mt-4 max-w-xl text-[17px] text-muted">
          {loading
            ? 'Loading collections…'
            : `${collections.length} collections · ${totalFolders} groups · ${totalSources} catalog sources`}
        </p>

        {!loading && !error && (
          <div className="mt-6 flex flex-wrap gap-2.5">
            {[
              { n: collections.length, l: 'Collections' },
              { n: multiGroupCollections.length, l: 'Grouped collections' },
              { n: totalFolders, l: 'Total groups' },
              { n: totalSources, l: 'Catalog sources' },
            ].map((s) => (
              <div key={s.l} className="rounded-full border border-border bg-surface px-4 py-2 text-center">
                <span className="font-display text-lg font-extrabold text-accent">{s.n}</span>
                <span className="ml-2 font-mono text-[11px] text-muted">{s.l}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="font-mono text-[13px] text-muted">Loading collections…</div>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-6 py-5 font-mono text-[12px] text-red-400">
            {error} — <span className="underline cursor-pointer" onClick={() => navigate('/login')}>Sign in</span> if collections require authentication.
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Multi-group collections first */}
            {multiGroupCollections.length > 0 && (
              <div className="mb-12">
                <div className="mb-6 flex items-center gap-3">
                  <h2 className="font-display text-xl font-extrabold uppercase">Grouped collections</h2>
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 font-mono text-[10px] text-accent">{multiGroupCollections.length}</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {multiGroupCollections.map((col) => (
                    <CollectionCard key={col.id} col={col} />
                  ))}
                </div>
              </div>
            )}

            {/* Single-folder collections */}
            {collections.filter((c) => c.folders.length <= 1).length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <h2 className="font-display text-xl font-extrabold uppercase">Featured rows</h2>
                  <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] text-muted border border-border">
                    {collections.filter((c) => c.folders.length <= 1).length}
                  </span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {collections
                    .filter((c) => c.folders.length <= 1)
                    .map((col) => <CollectionCard key={col.id} col={col} />)}
                </div>
              </div>
            )}

            {collections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="font-mono text-sm text-faint">No collections found.</p>
                <p className="mt-2 text-xs text-faint">Collections are managed by your Moonlit admin.</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 text-center">
        <div className="font-display text-3xl font-extrabold tracking-tight">NIGHTARC</div>
        <div className="mt-3 flex flex-wrap justify-center gap-5 text-sm text-muted">
          <button onClick={() => navigate('/')}>Home</button>
          <button onClick={() => navigate('/pricing')}>Pricing</button>
          <button onClick={() => navigate('/login')}>Sign in</button>
        </div>
        <p className="mt-3 font-mono text-xs text-faint">© 2026 Moonlit</p>
      </footer>
    </div>
  );
}
