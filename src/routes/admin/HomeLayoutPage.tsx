import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import type { Collection, Folder, FolderCatalog } from '../../types';

const FUNCTION_URL = 'https://hvfsntdyowapjxobtyli.supabase.co/functions/v1/home-organizer';

// ── Types ───────────────────────────────────────────────────────────────────

interface CollectionWithFolders extends Collection {
  folders: FolderWithCatalogs[];
}

interface FolderWithCatalogs extends Folder {
  catalogs: FolderCatalog[];
}

// ── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'border border-border bg-surface-2'}`}
      title={on ? 'Enabled — visible in app' : 'Disabled — hidden in app'}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Catalog chip ─────────────────────────────────────────────────────────────

function CatalogChip({ cat, onDelete }: { cat: FolderCatalog; onDelete: () => void }) {
  return (
    <span className="group flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-text">
      <span className="text-accent">{cat.media_type}</span>
      <span className="text-faint">·</span>
      <span className="max-w-[200px] truncate">{cat.catalog_id}</span>
      {cat.genre && <span className="text-faint">· {cat.genre}</span>}
      <button
        onClick={onDelete}
        className="ml-1 text-faint opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
      >
        ×
      </button>
    </span>
  );
}

// ── Add catalog form ──────────────────────────────────────────────────────────

function AddCatalogForm({ onAdd }: { onAdd: (catalogId: string, mediaType: string, genre: string | null) => Promise<void> }) {
  const [catalogId, setCatalogId] = useState('');
  const [mediaType, setMediaType] = useState('movie');
  const [genre, setGenre] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogId.trim()) return;
    setSaving(true);
    await onAdd(catalogId.trim(), mediaType, genre.trim() || null);
    setCatalogId('');
    setGenre('');
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <input
        value={catalogId}
        onChange={(e) => setCatalogId(e.target.value)}
        placeholder="catalog_id  e.g. tmdb.trending_series"
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-[12px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <select
        value={mediaType}
        onChange={(e) => setMediaType(e.target.value)}
        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 font-mono text-[12px] text-text focus:border-accent focus:outline-none"
      >
        <option value="movie">movie</option>
        <option value="series">series</option>
        <option value="all">all</option>
      </select>
      <input
        value={genre}
        onChange={(e) => setGenre(e.target.value)}
        placeholder="genre (optional)"
        className="w-36 rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-[12px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <Button size="sm" type="submit" loading={saving} disabled={!catalogId.trim()}>
        + Add
      </Button>
    </form>
  );
}

// ── Folder row ────────────────────────────────────────────────────────────────

function FolderRow({
  folder,
  onAddCatalog,
  onDeleteCatalog,
}: {
  folder: FolderWithCatalogs;
  onAddCatalog: (folderId: string, catalogId: string, mediaType: string, genre: string | null) => Promise<void>;
  onDeleteCatalog: (catalogId: string, folderId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        {folder.cover_image && (
          <img src={folder.cover_image} alt="" className="h-7 w-7 flex-none rounded-md object-cover" />
        )}
        <span className="text-[13px] font-semibold">{folder.name}</span>
        <span className="ml-auto font-mono text-[10px] text-faint">{folder.tile_shape?.toLowerCase()} · {folder.catalogs.length} sources</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {folder.catalogs.map((cat) => (
          <CatalogChip
            key={cat.id}
            cat={cat}
            onDelete={() => onDeleteCatalog(cat.id, folder.id)}
          />
        ))}
      </div>

      <AddCatalogForm
        onAdd={(cid, mt, g) => onAddCatalog(folder.id, cid, mt, g)}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomeLayoutPage() {
  const [collections, setCollections] = useState<CollectionWithFolders[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewJson, setPreviewJson] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: cols } = await supabase
      .from('collections')
      .select('*')
      .order('sort_order');

    if (!cols || cols.length === 0) { setCollections([]); setLoading(false); return; }

    const colIds = cols.map((c: Collection) => c.id);

    const [{ data: allFolders }, { data: allCatalogs }] = await Promise.all([
      supabase.from('folders').select('*').in('collection_id', colIds).order('sort_order'),
      supabase.from('folder_catalogs').select('*'),
    ]);

    const folders = (allFolders ?? []) as Folder[];
    const catalogs = (allCatalogs ?? []) as FolderCatalog[];

    const catsByFolder: Record<string, FolderCatalog[]> = {};
    for (const c of catalogs) {
      if (!catsByFolder[c.folder_id]) catsByFolder[c.folder_id] = [];
      catsByFolder[c.folder_id].push(c);
    }

    const foldersByCol: Record<string, FolderWithCatalogs[]> = {};
    for (const f of folders) {
      if (!foldersByCol[f.collection_id]) foldersByCol[f.collection_id] = [];
      foldersByCol[f.collection_id].push({ ...f, catalogs: catsByFolder[f.id] ?? [] });
    }

    setCollections(
      cols.map((c: Collection) => ({ ...c, enabled: c.enabled ?? true, folders: foldersByCol[c.id] ?? [] }))
    );
    setLoading(false);
  }

  // ── Toggle enabled ────────────────────────────────────────────────────────

  async function toggleEnabled(id: string, enabled: boolean) {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
    await supabase.from('collections').update({ enabled }).eq('id', id);
  }

  // ── Reorder ───────────────────────────────────────────────────────────────

  async function handleDrop(toIdx: number) {
    if (dragIdx.current === null || dragIdx.current === toIdx) return;
    const next = [...collections];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(toIdx, 0, moved);
    dragIdx.current = null;
    setCollections(next);
    await Promise.all(next.map((c, i) => supabase.from('collections').update({ sort_order: i }).eq('id', c.id)));
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  async function renameCollection(id: string) {
    const col = collections.find((c) => c.id === id);
    const name = prompt('New name', col?.name)?.trim();
    if (!name || name === col?.name) return;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    await supabase.from('collections').update({ name }).eq('id', id);
  }

  // ── Catalog CRUD ──────────────────────────────────────────────────────────

  async function addCatalog(folderId: string, catalogId: string, mediaType: string, genre: string | null) {
    const { data } = await supabase
      .from('folder_catalogs')
      .insert({ folder_id: folderId, catalog_id: catalogId, media_type: mediaType, genre })
      .select()
      .single();
    if (!data) return;
    setCollections((prev) =>
      prev.map((col) => ({
        ...col,
        folders: col.folders.map((f) =>
          f.id === folderId ? { ...f, catalogs: [...f.catalogs, data as FolderCatalog] } : f
        ),
      }))
    );
  }

  async function deleteCatalog(catalogId: string, folderId: string) {
    await supabase.from('folder_catalogs').delete().eq('id', catalogId);
    setCollections((prev) =>
      prev.map((col) => ({
        ...col,
        folders: col.folders.map((f) =>
          f.id === folderId ? { ...f, catalogs: f.catalogs.filter((c) => c.id !== catalogId) } : f
        ),
      }))
    );
  }

  // ── Preview JSON ──────────────────────────────────────────────────────────

  async function fetchPreview() {
    setPreviewLoading(true);
    setPreviewJson(null);
    try {
      const res = await fetch(FUNCTION_URL);
      const json = await res.json();
      setPreviewJson(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setPreviewJson(`Error: ${e.message}`);
    }
    setPreviewLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">Admin · Home Layout</p>
          <h1 className="font-display text-[clamp(30px,4vw,46px)] font-extrabold uppercase">Home organizer</h1>
          <p className="mt-1 text-sm text-muted">
            Drag to reorder, toggle visibility, and edit catalog sources. Changes are{' '}
            <span className="text-accent">live in the app</span> on next launch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[10px] text-faint">{FUNCTION_URL}</span>
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); loadAll(); }}>↺ Refresh</Button>
          <Button size="sm" onClick={fetchPreview} loading={previewLoading}>
            Preview JSON ↗
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex flex-wrap gap-4">
        {[
          { label: 'Collections', value: collections.length },
          { label: 'Enabled', value: collections.filter((c) => c.enabled).length },
          { label: 'Total folders', value: collections.reduce((n, c) => n + c.folders.length, 0) },
          { label: 'Total sources', value: collections.reduce((n, c) => n + c.folders.reduce((m, f) => m + f.catalogs.length, 0), 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface px-5 py-3">
            <div className="font-display text-2xl font-extrabold">{s.value}</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Collection list */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
            Collections · drag to reorder
          </span>
          <span className="font-mono text-[10px] text-faint">toggle = show/hide in app</span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <p className="p-8 text-center font-mono text-[11px] text-faint">
            No collections. Import a JSON pack from the Collection manager.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {collections.map((col, i) => (
              <div
                key={col.id}
                draggable
                onDragStart={() => { dragIdx.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                className="group"
              >
                {/* Collection header row */}
                <div
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${col.enabled ? '' : 'opacity-50'}`}
                >
                  {/* Drag handle */}
                  <span className="cursor-grab select-none text-faint opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
                    ⠿
                  </span>

                  {/* Thumbnail */}
                  <div className="h-9 w-9 flex-none overflow-hidden rounded-lg bg-surface-2">
                    {col.backdrop_image && (
                      <img src={col.backdrop_image} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => renameCollection(col.id)}
                      className="block truncate text-left text-[14px] font-semibold hover:text-accent"
                      title="Click to rename"
                    >
                      {col.name}
                    </button>
                    <span className="font-mono text-[10px] text-faint">
                      {col.folders.length} folder{col.folders.length !== 1 ? 's' : ''} ·{' '}
                      {col.folders.reduce((n, f) => n + f.catalogs.length, 0)} sources
                    </span>
                  </div>

                  {/* Enabled toggle */}
                  <Toggle on={col.enabled} onChange={(v) => toggleEnabled(col.id, v)} />

                  {/* Expand button */}
                  <button
                    onClick={() => toggleExpand(col.id)}
                    className={`rounded-lg border px-3 py-1 font-mono text-[11px] transition-colors ${
                      expanded.has(col.id)
                        ? 'border-accent/40 bg-accent-light text-accent'
                        : 'border-border text-faint hover:border-border-strong hover:text-text'
                    }`}
                  >
                    {expanded.has(col.id) ? '▲ Close' : '▼ Edit sources'}
                  </button>
                </div>

                {/* Expanded folder editor */}
                {expanded.has(col.id) && (
                  <div className="border-t border-border bg-bg px-5 py-4">
                    {col.folders.length === 0 ? (
                      <p className="font-mono text-[11px] text-faint">
                        No folders. Add them from the Collection manager.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {col.folders.map((f) => (
                          <FolderRow
                            key={f.id}
                            folder={f}
                            onAddCatalog={addCatalog}
                            onDeleteCatalog={deleteCatalog}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON preview modal */}
      {previewJson !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-accent">Live JSON output</span>
              <button
                onClick={() => setPreviewJson(null)}
                className="font-mono text-[11px] text-faint hover:text-text"
              >
                ✕ Close
              </button>
            </div>
            <pre className="overflow-auto p-5 font-mono text-[11px] leading-relaxed text-text">
              {previewJson}
            </pre>
          </div>
        </div>
      )}
    </AppShell>
  );
}
