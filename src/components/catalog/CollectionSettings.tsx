// src/components/catalog/CollectionSettings.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import type { Collection, Folder, FolderCatalog, FolderSource } from '../../types';

const VIEW_MODES = ['FOLLOW_LAYOUT', 'GRID', 'LIST'];

interface Props {
  collection: Collection;
  folders: Folder[];
  allCollections: Collection[];
  onSave: (patch: Partial<Collection>) => Promise<void>;
}

export function CollectionSettings({ collection, folders, allCollections, onSave }: Props) {
  const [draft, setDraft] = useState<Collection>(collection);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => setDraft(collection), [collection]);

  const dirty =
    draft.name !== collection.name ||
    (draft.backdrop_image ?? '') !== (collection.backdrop_image ?? '') ||
    draft.view_mode !== collection.view_mode ||
    draft.show_all_tab !== collection.show_all_tab ||
    draft.focus_glow_enabled !== collection.focus_glow_enabled ||
    draft.pin_to_top !== collection.pin_to_top ||
    draft.enabled !== collection.enabled;

  function set<K extends keyof Collection>(key: K, value: Collection[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim() || collection.name,
        backdrop_image: draft.backdrop_image || null,
        view_mode: draft.view_mode,
        show_all_tab: draft.show_all_tab,
        focus_glow_enabled: draft.focus_glow_enabled,
        pin_to_top: draft.pin_to_top,
        enabled: draft.enabled,
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportCollection() {
    setExporting(true);
    try {
      const folderIds = folders.map((f) => f.id);
      let cats: FolderCatalog[] = [];
      let srcs: FolderSource[] = [];
      if (folderIds.length) {
        [cats, srcs] = await Promise.all([
          fetchAll<FolderCatalog>('folder_catalogs', folderIds),
          fetchAll<FolderSource>('folder_sources', folderIds),
        ]);
      }
      const payload = buildPayload([collection], folders, cats, srcs);
      triggerDownload(payload, `${slugify(collection.name)}.json`);
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const { data: allFolders, error: fErr } = await supabase
        .from('folders')
        .select('*')
        .in('collection_id', allCollections.map((c) => c.id))
        .order('sort_order');
      if (fErr) throw new Error(fErr.message);

      const folderRows = (allFolders ?? []) as Folder[];
      const allFolderIds = folderRows.map((f) => f.id);

      let allCats: FolderCatalog[] = [];
      let allSrcs: FolderSource[] = [];
      if (allFolderIds.length) {
        [allCats, allSrcs] = await Promise.all([
          fetchAll<FolderCatalog>('folder_catalogs', allFolderIds),
          fetchAll<FolderSource>('folder_sources', allFolderIds),
        ]);
      }

      const payload = buildPayload(allCollections, folderRows, allCats, allSrcs);
      triggerDownload(payload, `moonlit-all-collections.json`);
    } finally {
      setExporting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 font-mono text-[10.5px] text-muted outline-none focus:border-accent';
  const labelClass = 'mb-1 block font-mono text-[10px] uppercase tracking-widest text-faint';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
            Collection · {collection.name}
          </p>
          <p className="mt-1 text-sm text-muted">
            Edit backdrop, display settings, then save. Export to re-import elsewhere.
          </p>
        </div>
        <Button size="sm" loading={saving} disabled={!dirty} onClick={handleSave}>
          {dirty ? 'Save settings' : 'Saved'}
        </Button>
      </div>

      {/* Settings grid */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {/* Backdrop image slot */}
        <div className="overflow-hidden rounded-2xl border border-border bg-bg2">
          <div className="relative flex h-[130px] items-center justify-center overflow-hidden bg-surface-2">
            {draft.backdrop_image ? (
              <img src={draft.backdrop_image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 font-mono text-[11px] text-faint">
                <svg className="h-6 w-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                not set
              </div>
            )}
          </div>
          <div className="p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-text">Backdrop</span>
              <span className="flex-none rounded border border-accent/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-accent">
                backdrop_image
              </span>
            </div>
            <input
              value={draft.backdrop_image ?? ''}
              onChange={(e) => set('backdrop_image', e.target.value || null)}
              placeholder="https://…"
              className={inputClass}
            />
            <p className="mt-1.5 text-[11px] text-faint">
              Hero image shown on the collection card
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="overflow-hidden rounded-2xl border border-border bg-bg2 p-3.5">
          <label className={labelClass}>Name</label>
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px] text-faint">Display name of the collection</p>

          {/* View mode */}
          <label className={`mt-4 block ${labelClass}`}>View mode</label>
          <div className="flex gap-1.5">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => set('view_mode', mode)}
                className={`flex-1 rounded-md border px-1 py-1.5 font-mono text-[9px] uppercase tracking-wide transition-colors ${
                  draft.view_mode === mode
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-border text-muted hover:border-accent/40'
                }`}
              >
                {mode.split('_').pop()}
              </button>
            ))}
          </div>
        </div>

        {/* Display flags */}
        <div className="overflow-hidden rounded-2xl border border-border bg-bg2">
          <div className="flex h-[130px] flex-wrap content-center items-center justify-center gap-5 bg-surface-2 p-4">
            <Toggle label="Show all tab" on={draft.show_all_tab} onClick={() => set('show_all_tab', !draft.show_all_tab)} />
            <Toggle label="Focus glow" on={draft.focus_glow_enabled} onClick={() => set('focus_glow_enabled', !draft.focus_glow_enabled)} />
            <Toggle label="Pin to top" on={draft.pin_to_top} onClick={() => set('pin_to_top', !draft.pin_to_top)} />
            <Toggle label="Enabled" on={draft.enabled} onClick={() => set('enabled', !draft.enabled)} />
          </div>
          <div className="p-3.5">
            <span className="text-[13px] font-semibold text-text">Display flags</span>
            <p className="mt-1 text-[11px] text-faint">Controls how this collection is rendered in the app</p>
          </div>
        </div>
      </div>

      {/* Export section */}
      <div className="mt-8">
        <h3 className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted">Export JSON</h3>
        <p className="mb-4 text-[12px] text-faint">
          Downloads a BEST-format JSON that can be re-imported via the JSON tab.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" loading={exporting} onClick={exportCollection}>
            ⬇ Export this collection
          </Button>
          <Button variant="ghost" size="sm" loading={exporting} onClick={exportAll}>
            ⬇ Export all collections
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

async function fetchAll<T>(table: string, folderIds: string[]): Promise<T[]> {
  let allRows: T[] = [];
  for (let i = 0; i < folderIds.length; i += ID_CHUNK) {
    const chunk = folderIds.slice(i, i + ID_CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('folder_id', chunk)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as T[];
      allRows = allRows.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return allRows;
}


function buildPayload(
  collections: Collection[],
  folders: Folder[],
  catalogs: FolderCatalog[],
  sources: FolderSource[] = [],
) {
  const folderIdToName: Record<string, string> = {};
  for (const f of folders) folderIdToName[f.id] = f.name;

  return {
    collections: collections.map((c) => ({
      name: c.name,
      backdrop_image: c.backdrop_image,
      view_mode: c.view_mode,
      show_all_tab: c.show_all_tab,
      focus_glow_enabled: c.focus_glow_enabled,
      pin_to_top: c.pin_to_top,
      enabled: c.enabled,
    })),
    folders: folders.map((f) => ({
      name: f.name,
      cover_image: f.cover_image,
      hero_backdrop: f.hero_backdrop,
      title_logo: f.title_logo,
      focus_gif: f.focus_gif,
      hero_video_url: f.hero_video_url,
      hide_title: f.hide_title,
      tile_shape: f.tile_shape,
      focus_gif_enabled: f.focus_gif_enabled,
      sort_order: f.sort_order,
    })),
    folder_catalogs: catalogs.map((c) => ({
      folder_name: folderIdToName[c.folder_id] ?? c.folder_id,
      catalog_id: c.catalog_id,
      media_type: c.media_type,
      genre: c.genre,
      extras: c.extras,
    })),
    folder_sources: sources.map((s) => ({
      folder_name: folderIdToName[s.folder_id] ?? s.folder_id,
      provider: s.provider,
      title: s.title,
      tmdb_id: s.tmdb_id,
      media_type: s.media_type,
      sort_order: s.sort_order,
    })),
  };
}

function triggerDownload(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1.5 text-xs text-muted" onClick={onClick}>
      <span
        className={`relative h-6 w-11 flex-none rounded-full border transition-colors ${
          on ? 'border-transparent bg-accent' : 'border-border bg-surface-2'
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${
            on ? 'left-[22px] bg-[#2a1206]' : 'left-0.5 bg-white'
          }`}
        />
      </span>
      {label}
    </label>
  );
}
