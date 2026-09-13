import { supabase } from './supabase';
import type { HomePresetItem } from '../types';
import type { WidgetTab } from '../components/catalog/WidgetGrid';

/** Presentation styles the portal can store — mirrors `RowDisplayStyle`'s
 *  raw values in MoonlitCore (WidgetModels.swift). */
export type ImportedStyle =
  | 'standard'
  | 'heroBanner'
  | 'cardStack'
  | 'carouselCinematic'
  | 'topTen'
  | 'collectionsRow';

/** Wire shape of `CollectionsRowEntry.EntrySource` in Swift — a synthesized
 *  enum-with-associated-values encoding: `{ addonCatalog: { … } }` or
 *  `{ unresolved: {} }`. */
type EntrySourceWire =
  | { addonCatalog: { addonId: string; catalogId: string; mediaType: string } }
  | { unresolved: Record<string, never> };

/** Wire shape of `CollectionsRowEntry` (synthesized Codable): `id`, `title`
 *  and `tileShape` required; `coverImage`/`source` omitted when nil. */
interface CollectionsRowEntryWire {
  id: string;
  title: string;
  coverImage?: string;
  tileShape: string;
  source?: EntrySourceWire;
}

/** The jsonb written to `home_preset_items.data_source` — must encode exactly
 *  like `WidgetDataSource` (kind-discriminated flat object). */
export type ImportedDataSource =
  | { kind: 'addonCatalog'; addonId: string; catalogId: string; mediaType: string }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'collectionsRow'; entries: CollectionsRowEntryWire[] }
  | { kind: 'filtering'; query: string }
  | { kind: 'browseHub'; hub: string }
  | { kind: 'watchlist' }
  | { kind: 'traktList'; listId: string; query?: string };

export interface ImportedWidget {
  title: string;
  style: ImportedStyle;
  dataSource: ImportedDataSource;
}

export interface ParsedWidgetsExport {
  widgets: ImportedWidget[];
  /** Titles (or kinds) of entries that aren't representable — surfaced in the
   *  preview rather than silently dropped. */
  skipped: string[];
}

/** Fusion's widget-type strings → Moonlit `RowDisplayStyle` raw values.
 *  Same mapping as the app's `FusionWidgetsImport.style(for:)`. */
function styleForFusionType(type: string | undefined): ImportedStyle {
  switch (type) {
    case 'row.numbered':
    case 'row.numbered.classic':
      return 'topTen';
    case 'card.stack':
      return 'cardStack';
    case 'carousel.cinematic':
      return 'carouselCinematic';
    case 'hero':
    case 'hero.banner':
      return 'heroBanner';
    case 'collection.row':
      return 'collectionsRow';
    default:
      return 'standard';
  }
}

/** Fusion's `imageAspect` → Moonlit's `tileShape` vocabulary
 *  ("poster"/"landscape"/"square", see `Folder.tile_shape`). */
function tileShapeForAspect(aspect: unknown): string {
  if (aspect === 'wide' || aspect === 'landscape') return 'landscape';
  if (aspect === 'square') return 'square';
  return 'poster';
}

/** Fusion's per-tile `dataSources[0].payload` → a `CollectionsRowEntry`
 *  source. `undefined` leaves the entry `.unresolved` (the Swift model's own
 *  "imported without a matching installed addon" state). */
function sourceForFusionEntry(item: Record<string, unknown>): EntrySourceWire | undefined {
  const dataSources = item.dataSources;
  if (!Array.isArray(dataSources)) return undefined;
  for (const entry of dataSources) {
    const payload = (entry as { payload?: Record<string, unknown> } | undefined)?.payload;
    const addonId = payload?.addonId;
    const catalogId = payload?.catalogId;
    const mediaType = payload?.type;
    if (typeof addonId === 'string' && typeof catalogId === 'string' && typeof mediaType === 'string') {
      return { addonCatalog: { addonId, catalogId, mediaType } };
    }
  }
  return undefined;
}

/** Decodes either a native Moonlit `[HomeWidget]` export or a real Fusion
 *  export (`{exportType:'fusionWidgets', widgets:[…]}`) into preset-shaped
 *  widgets. Throws for anything else. */
export function parseWidgetsExport(text: string): ParsedWidgetsExport {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That is not valid JSON.');
  }

  // Native Moonlit export: already the wire shape the app/preset use.
  if (Array.isArray(json)) {
    const widgets: ImportedWidget[] = [];
    for (const raw of json) {
      const w = raw as { title?: string; style?: string; dataSource?: ImportedDataSource };
      if (!w || typeof w !== 'object' || !w.dataSource) continue;
      widgets.push({
        title: w.title?.trim() || 'Widget',
        style: (w.style as ImportedStyle) ?? 'standard',
        dataSource: w.dataSource,
      });
    }
    if (!widgets.length) throw new Error('No widgets found in that JSON.');
    return { widgets, skipped: [] };
  }

  const exportObj = json as { exportType?: string; widgets?: unknown[] };
  if (exportObj?.exportType === 'fusionWidgets' && Array.isArray(exportObj.widgets)) {
    const widgets: ImportedWidget[] = [];
    const skipped: string[] = [];
    for (const raw of exportObj.widgets) {
      const w = raw as {
        title?: string;
        type?: string;
        dataSource?: { kind?: string; payload?: Record<string, unknown> };
      };
      const ds = w?.dataSource ?? {};
      const payload = ds.payload ?? {};

      if (ds.kind === 'addonCatalog') {
        const addonId = payload.addonId;
        const catalogId = payload.catalogId;
        const mediaType = payload.type;
        if (typeof addonId === 'string' && typeof catalogId === 'string' && typeof mediaType === 'string') {
          widgets.push({
            title: w.title?.trim() || 'Widget',
            style: styleForFusionType(w.type),
            dataSource: { kind: 'addonCatalog', addonId, catalogId, mediaType },
          });
          continue;
        }
        skipped.push(w.title?.trim() || 'External catalog');
        continue;
      }

      // Fusion's `collection.row` — a row of tiles embedded in the widget.
      // Maps 1:1 onto Moonlit's Collections Row (`.collectionsRow(entries:)`):
      // each tile keeps its title/cover and its own nested source, and no
      // `collections`/`folders` rows are created.
      if (ds.kind === 'collection' && Array.isArray(payload.items)) {
        const entries: CollectionsRowEntryWire[] = (payload.items as Record<string, unknown>[]).map((item) => {
          const source = sourceForFusionEntry(item);
          return {
            id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : 'Collection',
            ...(typeof item.imageURL === 'string' && item.imageURL ? { coverImage: item.imageURL } : {}),
            tileShape: tileShapeForAspect(item.imageAspect),
            ...(source ? { source } : {}),
          };
        });
        widgets.push({
          title: w.title?.trim() || 'Collections',
          style: 'collectionsRow',
          dataSource: { kind: 'collectionsRow', entries },
        });
        continue;
      }

      skipped.push(w.title?.trim() || ds.kind || 'Unknown widget');
    }
    return { widgets, skipped };
  }

  throw new Error(
    "Unrecognised JSON — expected a Moonlit [HomeWidget] array or a Fusion {exportType:'fusionWidgets'} export.",
  );
}

/** Fetches a widgets export URL. Xperience-style manifest URLs send
 *  `access-control-allow-origin: *`, so a direct browser fetch works; the
 *  error messages name the two realistic failures (network/CORS, HTTP). */
export async function fetchWidgetsExport(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Couldn't reach that URL — check it, or that host may block browser fetches.");
  }
  if (!response.ok) throw new Error(`That URL returned HTTP ${response.status}.`);
  return response.text();
}

/** Appends imported widgets to one preset + tab as `home_preset_items` rows.
 *  `startSortOrder` continues after the tab's current last item, so the
 *  import lands at the end of the list rather than reshuffling it. */
export async function importWidgetsIntoPreset(opts: {
  presetId: string;
  tab: WidgetTab;
  widgets: ImportedWidget[];
  startSortOrder: number;
}): Promise<HomePresetItem[]> {
  const rows = opts.widgets.map((widget, index) => ({
    preset_id: opts.presetId,
    tab: opts.tab,
    data_source: widget.dataSource,
    media_type: null,
    style: widget.style,
    sort_order: opts.startSortOrder + index,
    title: widget.title || null,
  }));
  const { data, error } = await supabase.from('home_preset_items').insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as HomePresetItem[];
}
