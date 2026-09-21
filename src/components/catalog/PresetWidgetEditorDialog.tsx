import { useState } from 'react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import type { HomePresetItem } from '../../types';
import type { WidgetCardItem } from './WidgetGrid';
import { FilteringWidgetFields } from './FilteringWidgetFields';
import {
  filteringValidationMessage,
  mergeFilteringQuery,
  parseFilteringState,
  type FilteringMediaKind,
  type FilteringState,
} from '../../lib/filteringQuery';

const STYLE_LABELS: Record<string, string> = {
  standard: 'Row Classic',
  topTen: 'Row Numbered',
  cardStack: 'Card Stack',
  carouselCinematic: 'Carousel',
  heroBanner: 'Hero',
  collectionsRow: 'Collections Row',
};

type TileShape = 'poster' | 'landscape' | 'square';

interface EditorEntry {
  id: string;
  title: string;
  coverImage?: string;
  tileShape: TileShape;
  source?: { addonCatalog: { addonId: string; catalogId: string; mediaType: string } };
}

interface Props {
  item: WidgetCardItem;
  onClose: () => void;
  onRemove: () => void;
  /** Called with the updated row after a successful save. */
  onSaved: (item: HomePresetItem) => void;
}

/**
 * Editor for preset items that aren't collection- or hub-shaped: the widgets
 * the app/import publishes (Collections Rows, external-catalog and Filtering
 * widgets). All three are editable here — Collections Rows and external
 * catalogs edit their tiles/source, and Filtering gets the portal's own facet
 * editor (ordering, genres, period, release status, rating/vote floors,
 * runtime, language, row cap) writing the same TMDB query the app resolves.
 */
export function PresetWidgetEditorDialog({ item, onClose, onRemove, onSaved }: Props) {
  const [tab, setTab] = useState<'details' | 'json'>('details');
  const [title, setTitle] = useState(item.kind === 'generic' ? item.title : item.kind === 'filtering' ? item.title : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presetItem: HomePresetItem | null = item.kind === 'generic'
    ? item.presetItem
    : item.kind === 'filtering' ? item.presetItem : null;
  const initialSource = presetItem?.data_source as
    | { kind?: string; entries?: EditorEntry[]; addonId?: string; catalogId?: string; mediaType?: string }
    | undefined;

  const isCollectionsRow = initialSource?.kind === 'collectionsRow';
  const isAddonCatalog = initialSource?.kind === 'addonCatalog';
  const isFiltering = item.kind === 'filtering';
  const editable = isCollectionsRow || isAddonCatalog || isFiltering;

  const [filtering, setFiltering] = useState<FilteringState | null>(() =>
    isFiltering
      ? parseFilteringState(
          item.query,
          (presetItem?.media_type as FilteringMediaKind | null) ?? 'movie',
        )
      : null,
  );

  const [entries, setEntries] = useState<EditorEntry[]>(initialSource?.entries ?? []);
  const [addonId, setAddonId] = useState(initialSource?.addonId ?? '');
  const [catalogId, setCatalogId] = useState(initialSource?.catalogId ?? '');
  const [mediaType, setMediaType] = useState(initialSource?.mediaType ?? 'movie');

  const kindLabel = item.kind === 'filtering' ? 'Filtering'
    : item.kind === 'generic' ? STYLE_LABELS[item.presetItem.style] ?? item.presetItem.style
    : item.kind === 'browseHub' ? 'Hub · hardcoded UI'
    : 'Collection';

  const filteringParams = item.kind === 'filtering'
    ? [...new URLSearchParams(item.query).entries()]
    : [];

  function draftDataSource() {
    if (isCollectionsRow) {
      return {
        kind: 'collectionsRow',
        entries: entries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          ...(entry.coverImage ? { coverImage: entry.coverImage } : {}),
          tileShape: entry.tileShape,
          ...(entry.source ? { source: entry.source } : {}),
        })),
      };
    }
    if (isAddonCatalog) {
      return { kind: 'addonCatalog', addonId, catalogId, mediaType };
    }
    if (isFiltering && filtering) {
      // Merge, don't rebuild: the id-based facets this editor doesn't expose
      // yet live only in the original query, and rebuilding was silently
      // deleting them on save.
      return { kind: 'filtering', query: mergeFilteringQuery(item.query, filtering) };
    }
    return initialSource ?? {};
  }

  const filteringBlocked = isFiltering && filtering ? filteringValidationMessage(filtering) : null

  async function save() {
    if (!presetItem) return;
    if (filteringBlocked) {
      setError(filteringBlocked)
      return
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('home_preset_items')
        .update({
          title: title.trim() || null,
          data_source: draftDataSource(),
          // The content kind lives in the row's own column, not the query —
          // the app reads it as the widget's `mediaType` to pick
          // /discover/movie vs /discover/tv.
          ...(isFiltering && filtering ? { media_type: filtering.mediaKind } : {}),
        })
        .eq('id', presetItem.id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      onSaved(data as HomePresetItem);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateEntry(index: number, patch: Partial<EditorEntry>) {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function moveEntry(index: number, delta: number) {
    setEntries((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[88vh] w-[680px] max-w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">{title || 'Widget'}</h2>
            <p className="mt-0.5 text-xs text-faint">{kindLabel} · preset item</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted transition-colors hover:text-text" aria-label="Close">✕</button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 py-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('details')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${tab === 'details' ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
            >
              {editable ? 'Edit' : 'Details'}
            </button>
            <button
              onClick={() => setTab('json')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${tab === 'json' ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
            >
              Raw JSON
            </button>
          </div>

          {tab === 'json' ? (
            <pre className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-muted">
              {JSON.stringify({ title: title.trim() || null, ...draftDataSource() }, null, 2)}
            </pre>
          ) : isFiltering && filtering ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-faint">Name</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Widget name" />
              </label>
              <FilteringWidgetFields value={filtering} onChange={setFiltering} />
              {filteringParams.length > 0 && (
                <details className="rounded-xl border border-border px-4 py-2">
                  <summary className="cursor-pointer py-1 text-xs font-semibold uppercase tracking-wide text-faint">
                    Published parameters
                  </summary>
                  {filteringParams.map(([key, value]) => (
                    <div key={key} className="flex gap-4 border-b border-border py-2 text-sm last:border-b-0">
                      <span className="w-40 flex-none text-faint">{key}</span>
                      <span className="min-w-0 flex-1 break-words text-text">{value}</span>
                    </div>
                  ))}
                </details>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-faint">Name</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Widget name" />
              </label>

              {isAddonCatalog && (
                <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-faint">External catalog</span>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">Addon manifest id / URL</span>
                    <input value={addonId} onChange={(e) => setAddonId(e.target.value)} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">Catalog id</span>
                    <input value={catalogId} onChange={(e) => setCatalogId(e.target.value)} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">Media type</span>
                    <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className={inputClass}>
                      <option value="movie">movie</option>
                      <option value="series">series</option>
                    </select>
                  </label>
                </div>
              )}

              {isCollectionsRow && (
                <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
                  <div className="flex items-center">
                    <span className="text-xs font-semibold uppercase tracking-wide text-faint">{entries.length} tiles</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => setEntries((prev) => [...prev, {
                        id: crypto.randomUUID(), title: 'New tile', tileShape: 'poster',
                      }])}
                    >
                      + Add tile
                    </Button>
                  </div>
                  {entries.map((entry, index) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border bg-bg2 p-2.5">
                      {entry.coverImage
                        ? <img src={entry.coverImage} alt="" className="h-14 w-20 flex-none rounded-lg object-cover" />
                        : <div className="h-14 w-20 flex-none rounded-lg bg-surface-2" />}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <input
                          value={entry.title}
                          onChange={(e) => updateEntry(index, { title: e.target.value })}
                          className={inputClass}
                          placeholder="Tile title"
                        />
                        <div className="flex gap-1.5">
                          <input
                            value={entry.coverImage ?? ''}
                            onChange={(e) => updateEntry(index, { coverImage: e.target.value })}
                            className={inputClass}
                            placeholder="Cover image URL"
                          />
                          <select
                            value={entry.tileShape}
                            onChange={(e) => updateEntry(index, { tileShape: e.target.value as TileShape })}
                            className="w-28 flex-none rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                          >
                            <option value="poster">poster</option>
                            <option value="landscape">landscape</option>
                            <option value="square">square</option>
                          </select>
                        </div>
                        <p className={`truncate text-[10px] ${entry.source ? 'text-muted' : 'text-amber-400/80'}`}>
                          {entry.source ? entry.source.addonCatalog.catalogId : 'No source — placeholder tile'}
                        </p>
                      </div>
                      <div className="flex flex-none flex-col gap-1">
                        <button onClick={() => moveEntry(index, -1)} disabled={index === 0} className="text-muted transition-colors hover:text-text disabled:opacity-30" title="Move up">↑</button>
                        <button onClick={() => moveEntry(index, 1)} disabled={index === entries.length - 1} className="text-muted transition-colors hover:text-text disabled:opacity-30" title="Move down">↓</button>
                        <button onClick={() => setEntries((prev) => prev.filter((_, i) => i !== index))} className="text-muted transition-colors hover:text-red-400" title="Remove tile">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-faint">
                A re-import or the app's Save &amp; Publish updates this row in place — matched by the widget's id, not its name.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="danger" size="sm" onClick={onRemove}>Remove from preset</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          {editable && (
            <Button
              size="sm"
              onClick={save}
              loading={saving}
              disabled={saving || Boolean(filteringBlocked)}
              title={filteringBlocked ?? undefined}
            >
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
