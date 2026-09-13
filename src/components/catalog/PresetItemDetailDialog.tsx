import { useState } from 'react';
import { Button } from '../ui/Button';
import type { HomePresetItem } from '../../types';
import type { WidgetCardItem } from './WidgetGrid';

const STYLE_LABELS: Record<string, string> = {
  standard: 'Row Classic',
  topTen: 'Row Numbered',
  cardStack: 'Card Stack',
  carouselCinematic: 'Carousel',
  heroBanner: 'Hero',
  collectionsRow: 'Collections Row',
};

interface Props {
  item: WidgetCardItem;
  onClose: () => void;
  onRemove: () => void;
}

/**
 * Read-only detail sheet for preset items with no collection editor on the
 * portal — Filtering, external-catalog and Collections Row widgets. Shows
 * what the item actually contains (TMDB params, embedded tiles + their
 * source ids, or the addon catalog reference) so a click on these cards
 * isn't a dead end; the content itself is authored on-device.
 */
export function PresetItemDetailDialog({ item, onClose, onRemove }: Props) {
  const [tab, setTab] = useState<'details' | 'json'>('details');

  const title = item.kind === 'collection' ? item.collection.name
    : item.kind === 'browseHub' ? `Browse by ${item.hub === 'genre' ? 'Genre' : 'Language'}`
    : item.kind === 'filtering' ? item.title
    : item.title;
  const kindLabel = item.kind === 'filtering' ? 'Filtering'
    : item.kind === 'generic' ? STYLE_LABELS[item.presetItem.style] ?? item.presetItem.style
    : item.kind === 'browseHub' ? 'Hub · hardcoded UI'
    : 'Collection';

  const presetItem: HomePresetItem | null = item.kind === 'generic' ? item.presetItem : null;
  const dataSource = presetItem?.data_source as
    | { kind?: string; entries?: unknown[]; addonId?: string; catalogId?: string; mediaType?: string }
    | undefined;

  const filteringParams = item.kind === 'filtering'
    ? [...new URLSearchParams(item.query).entries()]
    : [];

  const row = (label: string, value: string) => (
    <div key={label} className="flex gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <span className="w-28 flex-none text-faint">{label}</span>
      <span className="min-w-0 flex-1 break-words text-text">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[88vh] w-[600px] max-w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">{title}</h2>
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
              Details
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
              {JSON.stringify(presetItem?.data_source ?? { kind: 'filtering', query: item.kind === 'filtering' ? item.query : '' }, null, 2)}
            </pre>
          ) : item.kind === 'filtering' ? (
            <div className="rounded-xl border border-border px-4 py-2">
              <p className="py-2 text-xs font-semibold uppercase tracking-wide text-faint">TMDB discover parameters</p>
              {filteringParams.length === 0
                ? <p className="py-2 text-sm text-muted">No parameters — defaults (popular movies).</p>
                : filteringParams.map(([key, value]) => row(key, value))}
            </div>
          ) : dataSource?.kind === 'collectionsRow' ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-faint">
                {(dataSource.entries ?? []).length} tiles · each tile's own source is stored with it
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {((dataSource.entries ?? []) as unknown[]).map((entry, index) => {
                  const tile = entry as {
                    id?: string; title?: string; coverImage?: string;
                    source?: { addonCatalog?: { catalogId?: string } };
                  };
                  const hasSource = !!tile.source?.addonCatalog;
                  return (
                    <div key={tile.id ?? index} className="overflow-hidden rounded-xl border border-border bg-bg2">
                      {tile.coverImage
                        ? <img src={tile.coverImage} alt="" className="aspect-[16/10] w-full object-cover" />
                        : <div className="aspect-[16/10] w-full bg-surface-2" />}
                      <div className="flex flex-col gap-1 p-2">
                        <span className="truncate text-xs font-semibold text-text">{tile.title ?? 'Collection'}</span>
                        <span className={`truncate text-[10px] ${hasSource ? 'text-muted' : 'text-amber-400/80'}`}>
                          {hasSource ? tile.source?.addonCatalog?.catalogId : 'No source — placeholder'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : dataSource?.kind === 'addonCatalog' ? (
            <div className="rounded-xl border border-border px-4 py-2">
              {row('Source', 'External catalog (addon)')}
              {row('Addon', dataSource.addonId ?? '—')}
              {row('Catalog', dataSource.catalogId ?? '—')}
              {row('Media type', dataSource.mediaType ?? '—')}
            </div>
          ) : (
            <pre className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-muted">
              {JSON.stringify(dataSource ?? {}, null, 2)}
            </pre>
          )}

          <p className="text-xs text-faint">
            Content is authored on-device — the app's Save &amp; Publish updates this row in place
            (matched by the widget's id, not its name). Reorder here, or remove it from the preset below.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="danger" size="sm" onClick={onRemove}>Remove from preset</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
