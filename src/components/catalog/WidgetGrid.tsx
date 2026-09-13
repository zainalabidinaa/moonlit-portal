import { useState } from 'react';
import { useFolderPreviewPosters, useFolderTileImage } from '../../hooks/useFolderPreviewPosters';
import { FallbackPosterImg } from './FallbackPosterImg';
import type { Collection, Folder, HomePresetItem } from '../../types';

export type WidgetTab = 'home' | 'movies' | 'series';
export const TAB_FLAG: Record<WidgetTab, { ios: keyof Collection; mac: keyof Collection }> = {
  home: { ios: 'show_ios_home', mac: 'show_mac_home' },
  movies: { ios: 'show_ios_movies', mac: 'show_mac_movies' },
  series: { ios: 'show_ios_series', mac: 'show_mac_series' },
};

/** A root-level collection belongs to `tab` if either platform shows it
 *  there — the portal authors content once, not per-platform, so a curator
 *  deciding "does this belong on Movies" shouldn't have to think about iOS
 *  vs Mac separately. */
export function isOnWidgetTab(c: Collection, tab: WidgetTab): boolean {
  const { ios, mac } = TAB_FLAG[tab];
  return Boolean(c[ios]) || Boolean(c[mac]);
}

/** One card's worth of identity. In "all" mode `key === collection.id`. In
 *  "preset" mode `key` is the owning `home_preset_items.id` instead — the
 *  same collection can legitimately appear more than once across tabs/
 *  presets (e.g. a widget shown on both Home and Movies), so the card's
 *  identity for delete/reorder purposes must be the *item*, not the
 *  collection, or those two appearances would be indistinguishable.
 *
 *  `browseHub` cards ("Browse by Genre"/"Browse by Language") are
 *  preset-only (mode 'preset', Home tab) — they aren't collections
 *  themselves, but a real ordered `home_preset_items` row
 *  (`data_source: {kind:'browseHub', hub:'genre'|'language'}`) controlling
 *  only where the strip sits among other widgets. Clicking one opens the
 *  real "Genres"/"Languages" collection instead (see `onOpenBrowseHub`) —
 *  that's where its actual content (one real folder per genre/language,
 *  each with its own sources) lives, same as any other widget. */
export type WidgetCardItem =
  | {
      key: string;
      kind: 'collection';
      collection: Collection;
      /** The preset item's own render style (only meaningful in "preset"
       *  mode — style is a property of a widget's *placement*, not of the
       *  collection itself, so "all widgets" mode has no style to show). */
      style?: string;
      /** Present in "preset" mode: this card's `home_preset_items` row id,
       *  so the folder-mode controls persist to exactly this placement. */
      presetItemId?: string;
      /** `home_preset_items.expand_folders` — one content row per selected
       *  folder instead of a single hub row of folder tiles. */
      expandFolders?: boolean;
      /** `home_preset_items.folder_ids` — the chosen root-folder subset;
       *  null/empty = every folder. */
      folderIds?: string[] | null;
      /** `home_preset_items.genre_hub` — render through the app's hardcoded
       *  genre UI (editorial genre tiles, genre rooms) using these folders
       *  as genres, whatever language they're named in. */
      genreHub?: boolean;
      /** The preset item's own display name (`home_preset_items.title`) —
       *  shown instead of the collection name when set (a split child is
       *  named after its single folder, for instance). */
      presetTitle?: string;
    }
  | { key: string; kind: 'browseHub'; hub: 'genre' | 'language' }
  | {
      key: string;
      kind: 'filtering';
      /** The widget's own published name (`home_preset_items.title`),
       *  falling back to "Filtering" for rows published before that column
       *  existed. */
      title: string;
      /** The raw TMDB query the app published — shown summarized on the
       *  card; editing the filters themselves stays on-device. */
      query: string;
    }
  | {
      /** Preset items the app/import published that aren't collection- or
       *  hub-shaped and have no dedicated editor here yet: external-catalog
       *  widgets and Collections Rows. Visible + reorderable + removable,
       *  and clickable for a read-only detail view; content is edited
       *  on-device. */
      key: string;
      kind: 'generic';
      title: string;
      subtitle: string;
      accent?: boolean;
      /** The raw preset row, so the detail sheet can show the tiles / source
       *  ids without a re-fetch. */
      presetItem: HomePresetItem;
    };

/** The folder-mode controls only ever apply to collection-backed cards. */
export type CollectionCardItem = Extract<WidgetCardItem, { kind: 'collection' }>;

const STYLE_LABELS: Record<string, string> = {
  standard: 'Row Classic',
  heroBanner: 'Hero',
  cardStack: 'Card Stack',
  carouselCinematic: 'Carousel',
  topTen: 'Row Numbered',
};

interface Props {
  items: WidgetCardItem[];
  folders: Folder[];
  activeTab: WidgetTab;
  mode: 'all' | 'preset';
  onSelectCollection: (c: Collection) => void;
  /** Opens the real "Genres"/"Languages" collection in `WidgetEditor` for a
   *  `browseHub` card — its own position in this grid is just
   *  drag-and-drop like everything else; this is only for editing its
   *  actual content (folders/sources/artwork). */
  onOpenBrowseHub: (hub: 'genre' | 'language') => void;
  /** Opens the read-only detail sheet for a preset item with no collection
   *  editor on the portal (Filtering / external-catalog / Collections Row
   *  widgets) — their content is authored on-device. */
  onOpenPresetItem: (item: WidgetCardItem) => void;
  onAddWidget: () => void;
  onDeleteCard: (item: WidgetCardItem) => void;
  onReorderCard: (draggedKey: string, targetKey: string, zone: 'before' | 'after') => void;
  /** Switches a widget between the folder-tile hub and per-folder content
   *  rows (`home_preset_items.expand_folders`). */
  onSetExpandFolders: (item: CollectionCardItem, expand: boolean) => void;
  /** Opens the folder picker (`home_preset_items.folder_ids`) for a widget. */
  onOpenFolderSelection: (item: CollectionCardItem) => void;
  /** Toggles `home_preset_items.genre_hub` — the widget renders through the
   *  app's hardcoded genre UI with its own folder names as genres. */
  onToggleGenreHub: (item: CollectionCardItem, value: boolean) => void;
  /** Replaces this widget with one widget per (selected) folder — each a
   *  single-folder preset item via `folder_ids`. */
  onSplitFolders: (item: CollectionCardItem) => void;
}

export function WidgetGrid({ items, folders, activeTab, mode, onSelectCollection, onOpenBrowseHub, onOpenPresetItem, onAddWidget, onDeleteCard, onReorderCard, onSetExpandFolders, onOpenFolderSelection, onToggleGenreHub, onSplitFolders }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null);

  return (
    <div>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {items.map((item, index) => (
          <WidgetCard
            key={item.key}
            item={item}
            childFolders={item.kind === 'collection' ? folders.filter((f) => f.collection_id === item.collection.id && !f.parent_folder_id) : []}
            mode={mode}
            isHomeTab={activeTab === 'home'}
            onClick={
              item.kind === 'collection' ? () => onSelectCollection(item.collection)
              : item.kind === 'browseHub' ? () => onOpenBrowseHub(item.hub)
              : () => onOpenPresetItem(item)
            }
            onDelete={() => onDeleteCard(item)}
            onDragStart={() => setDragKey(item.key)}
            onDrop={() => { if (dragKey && dragKey !== item.key) onReorderCard(dragKey, item.key, 'before'); setDragKey(null); }}
            // Explicit buttons alongside drag-and-drop — dragging a card
            // precisely into a many-item grid is fiddly, especially on a
            // trackpad; a plain click to nudge one slot at a time is a lot
            // more reliable for "move this one thing up/down".
            onMoveUp={index > 0 ? () => onReorderCard(item.key, items[index - 1].key, 'before') : undefined}
            onMoveDown={index < items.length - 1 ? () => onReorderCard(item.key, items[index + 1].key, 'after') : undefined}
            onSetExpandFolders={item.kind === 'collection' ? onSetExpandFolders : undefined}
            onOpenFolderSelection={item.kind === 'collection' ? onOpenFolderSelection : undefined}
            onToggleGenreHub={item.kind === 'collection' ? onToggleGenreHub : undefined}
            onSplitFolders={item.kind === 'collection' ? onSplitFolders : undefined}
          />
        ))}
        <button
          onClick={onAddWidget}
          className="flex min-h-[178px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <span className="text-2xl leading-none">+</span>
          <span>Add Widget</span>
        </button>
      </div>

      {items.length === 0 && (
        <p className="mt-2 text-sm text-faint">
          {mode === 'preset'
            ? `No widgets in this preset's ${activeTab[0].toUpperCase() + activeTab.slice(1)} list yet — add one below.`
            : `No widgets assigned to ${activeTab[0].toUpperCase() + activeTab.slice(1)} yet — add one, or edit an existing widget's Tab visibility in its Collection settings.`}
        </p>
      )}
    </div>
  );
}

const BROWSE_HUB_LABELS: Record<'genre' | 'language', string> = {
  genre: 'Browse by Genre',
  language: 'Browse by Language',
};

function WidgetCard({
  item, childFolders, mode, isHomeTab, onClick, onDelete, onDragStart, onDrop, onMoveUp, onMoveDown,
  onSetExpandFolders, onOpenFolderSelection, onToggleGenreHub, onSplitFolders,
}: {
  item: WidgetCardItem;
  childFolders: Folder[];
  mode: 'all' | 'preset';
  isHomeTab: boolean;
  onClick?: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSetExpandFolders?: (item: CollectionCardItem, expand: boolean) => void;
  onOpenFolderSelection?: (item: CollectionCardItem) => void;
  onToggleGenreHub?: (item: CollectionCardItem, value: boolean) => void;
  onSplitFolders?: (item: CollectionCardItem) => void;
}) {
  if (item.kind === 'browseHub') {
    return (
      <BrowseHubCard
        hub={item.hub}
        onClick={onClick}
        onDelete={onDelete}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );
  }

  if (item.kind === 'filtering') {
    return (
      <FilteringCard
        title={item.title}
        query={item.query}
        onClick={onClick}
        onDelete={onDelete}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );
  }

  if (item.kind === 'generic') {
    return (
      <GenericPresetCard
        title={item.title}
        subtitle={item.subtitle}
        accent={item.accent ?? false}
        onClick={onClick}
        onDelete={onDelete}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );
  }

  const { collection } = item;
  // Capture the narrowed variant so the controls' closures keep the
  // collection-card type (TS drops parameter narrowing inside callbacks).
  const collectionItem = item;
  const totalFolderCount = childFolders.length;
  // A widget's own folder selection defines what it *shows*: a split child
  // (`folder_ids` = one id) is that single folder's content, not a renamed
  // copy of the whole hub — so its art, counts and previews come from the
  // chosen folders alone.
  const effectiveFolders = item.folderIds && item.folderIds.length
    ? childFolders.filter((f) => item.folderIds!.includes(f.id))
    : childFolders;
  const folderCount = effectiveFolders.length;
  // Per-placement folder controls: only meaningful in "preset" mode (the
  // flag lives on the preset item, not the collection itself) and only when
  // the collection has 2+ folders — a single-folder collection already
  // resolves straight to its content row, so there is nothing to switch.
  const canChooseFolders = mode === 'preset' && item.presetItemId != null && totalFolderCount >= 2;
  const genreHubOn = item.genreHub === true;
  const folderSelectionLabel = folderCount === totalFolderCount
    ? (totalFolderCount === 1 ? '1 folder' : `${totalFolderCount} folders`)
    : `${folderCount} of ${totalFolderCount} folders`;
  // In "preset" mode the item's own placement style is the more useful
  // label (it's what the real on-device "Your Widgets" screen shows —
  // Row Classic / Hero / Card Stack / Row Numbered). "All widgets" mode has
  // no style (it's not a property of the collection itself), so it falls
  // back to the structural description instead. A folder widget the admin
  // has given folder controls shows its mode + selection instead.
  //
  // "Hardcoded UI" is only true of Home's genre/language tile strip
  // (MacHomeView's homeGenres/homeLanguages, a one-off SwiftUI view with no
  // tie to `collections` at all). A Movies/Series widget with
  // display_section === 'hub' renders through the same generic
  // CatalogRepository.displayRows group-tile path as everything else, so it
  // gets the plain folder-count label instead of the misleading one.
  const subtitle = canChooseFolders
    ? genreHubOn
      ? `Genre hub · ${folderSelectionLabel}`
      : folderCount === 1
        ? `Folder · content row · ${folderSelectionLabel}`
        : `${item.expandFolders ? 'Rows' : 'Hub'} · ${folderSelectionLabel}`
    : item.style
    ? STYLE_LABELS[item.style] ?? item.style
    : collection.display_section === 'hub' ? (isHomeTab ? 'Hub · hardcoded UI' : `Hub · ${folderCount} folders`)
    : collection.display_section === 'rows' ? 'Rows'
    : folderCount >= 2 ? `Hub · ${folderCount} folders`
    : folderCount === 1 ? 'Folder · content row' : 'Empty';

  const isFolderWidget = folderCount >= 2;
  // A standard/content-row widget has one folder holding real catalog
  // sources — its own cover_image/hero_backdrop is admin metadata, not
  // representative of the many titles inside, so real poster art is fetched
  // from that folder's actual source instead (see useFolderPreviewPosters).
  const sourcePosters = useFolderPreviewPosters(!isFolderWidget ? effectiveFolders[0]?.id ?? null : null);
  const hubTiles = isFolderWidget ? effectiveFolders.slice(0, 4) : [];
  // Before (or without) source posters, a single-folder widget shows that
  // folder's own artwork — otherwise every split child would fall back to
  // the same collection backdrop and read as a duplicate.
  const singleFolderArt = !isFolderWidget && effectiveFolders.length === 1
    ? effectiveFolders[0].cover_image ?? effectiveFolders[0].hero_backdrop
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group relative overflow-hidden rounded-2xl border border-border bg-bg2 transition-all hover:-translate-y-1 hover:border-accent"
    >
      <button onClick={onClick} className="relative block w-full text-left">
        {isFolderWidget ? (
          <div className="grid grid-cols-2 gap-0.5 bg-border">
            {hubTiles.map((f) => (
              <HubTile key={f.id} folder={f} />
            ))}
            {Array.from({ length: Math.max(0, 4 - hubTiles.length) }).map((_, i) => (
              <div key={`pad-${i}`} className={`${tileAspectClass(hubTiles[0]?.tile_shape)} w-full bg-surface-2`} />
            ))}
          </div>
        ) : sourcePosters.length > 0 ? (
          <div className="grid grid-cols-2 gap-0.5 bg-border">
            {[0, 1, 2, 3].map((i) => (
              <FallbackPosterImg key={i} pool={sourcePosters} slot={i} totalSlots={4} className="aspect-[2/3] w-full object-cover" />
            ))}
          </div>
        ) : singleFolderArt ? (
          <img src={singleFolderArt} alt="" className="aspect-square w-full object-cover" />
        ) : collection.backdrop_image ? (
          <img src={collection.backdrop_image} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="aspect-square w-full bg-surface-2" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(13,6,4,.8) 0%,rgba(13,6,4,.35) 32%,transparent 60%)' }} />
        {collection.status === 'draft' && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-fuchsia-500/85 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-[#1a0512]">
            Draft
          </span>
        )}
        <div className="absolute inset-x-0 top-0 p-3">
          <p className="truncate text-[15px] font-semibold text-white">{item.presetTitle || collection.name}</p>
          <p className="mt-0.5 text-[12px] text-white/60">{subtitle}</p>
          {canChooseFolders && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onOpenFolderSelection?.(collectionItem); }}
                title="Choose which folders this widget shows"
                className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/85 transition-colors hover:bg-black/75"
              >
                Choose folders
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleGenreHub?.(collectionItem, !genreHubOn); }}
                title={genreHubOn
                  ? 'Rendering through the app’s hardcoded genre UI — click to turn off'
                  : 'Render through the app’s hardcoded genre UI (editorial genre tiles + genre rooms), using these folders as genres'}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${genreHubOn ? 'bg-accent text-[#2a1206]' : 'bg-black/50 text-white/85 hover:bg-black/75'}`}
              >
                {genreHubOn ? 'Genre hub ✓' : 'Genre hub'}
              </button>
              {!genreHubOn && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSplitFolders?.(collectionItem); }}
                  title="Replace this widget with one widget per folder"
                  className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/85 transition-colors hover:bg-black/75"
                >
                  Split folders
                </button>
              )}
            </span>
          )}
        </div>
      </button>
      {canChooseFolders && !genreHubOn && (
        <div className="absolute bottom-2.5 left-1/2 z-[2] -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
          <div className="flex overflow-hidden rounded-full border border-white/15 bg-black/55 text-[11px] font-semibold">
            <button
              onClick={() => { if (collectionItem.expandFolders) onSetExpandFolders?.(collectionItem, false); }}
              title="Show the folders as one hub of tiles"
              className={`px-2.5 py-1 transition-colors ${collectionItem.expandFolders ? 'text-white/70 hover:text-white' : 'bg-accent text-[#2a1206]'}`}
            >
              Folders
            </button>
            <button
              onClick={() => {
                if (collectionItem.expandFolders) return;
                onSetExpandFolders?.(collectionItem, true);
                // Switching to Rows opens the picker so "all or a few" is a
                // deliberate choice — Apply with everything on keeps All.
                onOpenFolderSelection?.(collectionItem);
              }}
              title="Give every selected folder its own content row"
              className={`px-2.5 py-1 transition-colors ${collectionItem.expandFolders ? 'bg-accent text-[#2a1206]' : 'text-white/70 hover:text-white'}`}
            >
              Rows
            </button>
          </div>
        </div>
      )}
      <div className="absolute bottom-2.5 left-2.5 z-[2] flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
          disabled={!onMoveUp}
          title="Move earlier"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ↑
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
          disabled={!onMoveDown}
          title="Move later"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ↓
        </button>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const msg = mode === 'preset'
            ? `Remove "${collection.name}" from this preset's list? The widget itself is untouched.`
            : `Delete the "${collection.name}" widget entirely? This removes it everywhere, including from any preset that references it.`;
          if (confirm(msg)) onDelete();
        }}
        title={mode === 'preset' ? 'Remove from this preset' : 'Delete widget'}
        className="absolute bottom-2.5 right-2.5 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
      >
        🗑
      </button>
    </div>
  );
}

// "Browse by Genre"/"Browse by Language" are a hardcoded SwiftUI tile strip
// on-device (MacHomeView's homeGenres/homeLanguages), not a real collection —
// this card exists purely so admins can drag/reorder them alongside other
// Home widgets; there's nothing to click through to.
function BrowseHubCard({
  hub, onClick, onDelete, onDragStart, onDrop, onMoveUp, onMoveDown,
}: {
  hub: 'genre' | 'language';
  onClick?: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-border bg-bg2 p-3 transition-all hover:-translate-y-1 hover:border-accent"
    >
      <button onClick={onClick} className="block w-full text-left" title="Edit tile names">
        <p className="truncate text-[15px] font-semibold text-white">{BROWSE_HUB_LABELS[hub]}</p>
        <p className="mt-0.5 text-[12px] text-white/60">Hub · hardcoded UI</p>
      </button>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!onMoveUp}
            title="Move earlier"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!onMoveDown}
            title="Move later"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove "${BROWSE_HUB_LABELS[hub]}" from this preset's Home list?`)) onDelete();
          }}
          title="Remove from this preset"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// A "Filtering" widget the app published into this preset via "Save &
// Publish" — a real TMDB-query-backed row on-device. The portal can see,
// reorder, and remove it; authoring/editing its filters stays on-device.
const FILTER_SUMMARY_SORTS: Record<string, string> = {
  'popularity.desc': 'Popular',
  'vote_average.desc': 'Top Rated',
  'primary_release_date.desc': 'Newest',
  'primary_release_date.asc': 'Oldest',
  'revenue.desc': 'Revenue',
};

function filteringSummary(query: string): string {
  const params = new URLSearchParams(query);
  const parts: string[] = [];
  const sort = params.get('sort_by') ?? '';
  if (sort === 'trending.day') parts.push('Trending Today');
  else if (sort === 'trending.week') parts.push('Trending This Week');
  else if (sort) parts.push(FILTER_SUMMARY_SORTS[sort] ?? sort);
  const genres = params.get('with_genres');
  if (genres) {
    const count = genres.split(',').filter(Boolean).length;
    parts.push(`${count} genre${count === 1 ? '' : 's'}`);
  }
  if (params.get('with_keywords')) parts.push('keywords');
  if (params.get('without_keywords')) parts.push('excluded keywords');
  if (params.get('with_watch_providers')) parts.push('providers');
  if (params.get('with_companies')) parts.push('studios');
  if (params.get('with_cast')) parts.push('cast');
  if (params.get('with_crew')) parts.push('crew');
  if (params.get('with_original_language') || params.get('with_origin_country')) parts.push('language');
  if (params.get('with_runtime.gte') || params.get('with_runtime.lte')) parts.push('runtime');
  if (params.get('vote_average.gte') || params.get('vote_average.lte') || params.get('vote_count.gte')) parts.push('score');
  if (params.get('primary_release_date.gte') || params.get('first_air_date.gte') || params.get('primary_release_date.lte') || params.get('first_air_date.lte')) parts.push('period');
  if (params.get('with_release_type')) parts.push('release');
  const limit = params.get('limit');
  if (limit) parts.push(`max ${limit}`);
  return parts.length ? parts.join(' · ') : 'TMDB filter';
}

function FilteringCard({
  title, query, onClick, onDelete, onDragStart, onDrop, onMoveUp, onMoveDown,
}: {
  title: string;
  query: string;
  onClick?: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-border bg-bg2 p-3 transition-all hover:-translate-y-1 hover:border-accent"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ background: 'radial-gradient(120% 90% at 85% 0%, #d9a94f 0%, transparent 55%)' }}
      />
      <button onClick={onClick} className="relative block w-full text-left" disabled={!onClick}>
        <p className="truncate text-[15px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 truncate text-[12px] text-white/60">Filtering · {filteringSummary(query)}</p>
      </button>
      <div className="relative flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!onMoveUp}
            title="Move earlier"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!onMoveDown}
            title="Move later"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove "${title}" from this preset's list? The widget itself stays on the curator's device.`)) onDelete();
          }}
          title="Remove from this preset"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// A preset item the app/import published that has no dedicated portal
// editor yet (external-catalog widgets, Collections Rows). Same chrome as the
// Filtering card: title + subtitle, reorder/remove, edited on-device.
function GenericPresetCard({
  title, subtitle, accent, onClick, onDelete, onDragStart, onDrop, onMoveUp, onMoveDown,
}: {
  title: string;
  subtitle: string;
  accent: boolean;
  onClick?: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-border bg-bg2 p-3 transition-all hover:-translate-y-1 hover:border-accent"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: accent ? 'radial-gradient(120% 90% at 85% 0%, #d9a94f 0%, transparent 55%)' : 'radial-gradient(120% 90% at 85% 0%, #6b7a8c 0%, transparent 55%)', opacity: 0.14 }}
      />
      <button onClick={onClick} className="relative block w-full text-left" disabled={!onClick}>
        <p className="truncate text-[15px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 truncate text-[12px] text-white/60">{subtitle}</p>
      </button>
      <div className="relative flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!onMoveUp}
            title="Move earlier"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!onMoveDown}
            title="Move later"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove "${title}" from this preset's list? The widget itself stays on the curator's device.`)) onDelete();
          }}
          title="Remove from this preset"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// Lowercase — must match `PosterShape`'s raw values in MoonlitCore
// (Models/MetaModels.swift), which the on-device apps decode case-
// sensitively. A mismatched case (e.g. legacy 'POSTER' rows) silently falls
// back to `.landscape` there, so every writer of `tile_shape` in this portal
// must use these exact strings.
export const TILE_SHAPES = ['poster', 'landscape', 'square'] as const;

export function tileAspectClass(shape: string | null | undefined): string {
  switch (shape) {
    case 'landscape': return 'aspect-video';
    case 'square': return 'aspect-square';
    default: return 'aspect-[2/3]';
  }
}

// A hub's own child-folder tile — Genre Hub's folders already carry curated
// icon art (cover_image/hero_backdrop), used as-is. Language Hub's folders
// have neither their own image nor their own catalogs (the real sources
// live one level down, e.g. "Korean" > "Popular Korean Movies"), so
// useFolderTileImage falls back to that child automatically.
export function HubTile({ folder }: { folder: Folder }) {
  const image = useFolderTileImage(folder);
  const aspect = tileAspectClass(folder.tile_shape);
  return image ? (
    <img src={image} alt="" className={`${aspect} w-full object-cover`} />
  ) : (
    <div className={`${aspect} w-full bg-surface-2`} />
  );
}
