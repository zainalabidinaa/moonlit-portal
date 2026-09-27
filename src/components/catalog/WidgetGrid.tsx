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
      /** `home_preset_items.source_art` — on a genre hub, render the tiles
       *  from each folder's own catalog sources instead of the default TMDB
       *  genre art. */
      sourceArt?: boolean;
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
      /** The raw TMDB query — shown summarized on the card; the detail
       *  dialog now authors the same facets in the portal. */
      query: string;
      /** The raw preset row, so the dialog can write edits back to exactly
       *  this placement. */
      presetItem: HomePresetItem;
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
      /** Depends on an add-on: only the admin server can resolve it, users
       *  never see it. Shown as a red badge on the card. */
      adminOnly?: boolean;
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
  onSelectCollection: (c: Collection, folderId?: string) => void;
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
  /** Toggles `home_preset_items.source_art` — on a genre hub, the tiles
   *  preview each folder's own catalog sources instead of TMDB genre art. */
  onToggleSourceArt: (item: CollectionCardItem, value: boolean) => void;
  /** Replaces this widget with one widget per (selected) folder — each a
   *  single-folder preset item via `folder_ids`. */
  onSplitFolders: (item: CollectionCardItem) => void;
}

export function WidgetGrid({ items, folders, activeTab, mode, onSelectCollection, onOpenBrowseHub, onOpenPresetItem, onAddWidget, onDeleteCard, onReorderCard, onSetExpandFolders, onOpenFolderSelection, onToggleGenreHub, onToggleSourceArt, onSplitFolders }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const tabLabel = activeTab[0].toUpperCase() + activeTab.slice(1);

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <WidgetCard
            key={item.key}
            index={index}
            item={item}
            childFolders={item.kind === 'collection' ? folders.filter((f) => f.collection_id === item.collection.id && !f.parent_folder_id) : []}
            mode={mode}
            isHomeTab={activeTab === 'home'}
            onClick={
              item.kind === 'collection'
                ? () => onSelectCollection(item.collection, item.folderIds?.length === 1 ? item.folderIds[0] : undefined)
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
            onToggleSourceArt={item.kind === 'collection' ? onToggleSourceArt : undefined}
            onSplitFolders={item.kind === 'collection' ? onSplitFolders : undefined}
            onOpenFolder={item.kind === 'collection' ? (folderId) => onSelectCollection(item.collection, folderId) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={onAddWidget}
          className="grid min-h-[210px] place-items-center rounded-2xl border border-dashed border-border-strong p-5 text-center font-medium text-muted transition-colors hover:border-accent hover:text-text"
        >
          <span><span className="block text-[26px] font-light leading-none text-faint">+</span><span className="mt-2 block">Add a widget to {tabLabel}</span></span>
        </button>
      </div>

      {items.length === 0 && (
        <p className="mt-4 text-sm text-faint">
          {mode === 'preset'
            ? `No widgets in this preset's ${tabLabel} list yet. Add one above.`
            : `No widgets assigned to ${tabLabel} yet. Add one, or edit an existing widget's Tab visibility in its Collection settings.`}
        </p>
      )}
    </div>
  );
}

const BROWSE_HUB_LABELS: Record<'genre' | 'language', string> = {
  genre: 'Browse by Genre',
  language: 'Browse by Language',
};

const HUB_PREVIEW: Record<'genre' | 'language', { label: string; bg: string }[]> = {
  genre: [{ label: 'Thriller', bg: '#3a2f5c' }, { label: 'Sci-fi', bg: '#2f4a5c' }, { label: 'Drama', bg: '#5c2f3a' }, { label: 'Comedy', bg: '#2f5c3d' }],
  language: [{ label: 'Korean', bg: '#3a2f5c' }, { label: 'Japanese', bg: '#2f4a5c' }, { label: 'French', bg: '#5c2f3a' }, { label: 'Spanish', bg: '#2f5c3d' }],
};

type Tone = 'collection' | 'hub' | 'filtering' | 'generic' | 'warn';
const TONE: Record<Tone, string> = {
  collection: 'border-cyan/35 text-cyan',
  hub: 'border-magenta/35 text-magenta',
  filtering: 'border-accent/40 text-accent',
  generic: 'border-amber-300/35 text-amber-200',
  warn: 'border-fuchsia-400/40 text-fuchsia-300',
};

const iconBtn = 'grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30';
const footBtn = 'h-7 rounded-full border border-border-strong px-2.5 text-xs font-medium text-muted transition-colors hover:text-text';
const removeBtn = 'h-7 rounded-full border border-border-strong px-2.5 text-xs font-medium text-muted transition-colors hover:border-red-400/50 hover:text-red-400';
const pill = (on: boolean) =>
  `h-7 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors ${on ? 'border-accent/50 bg-accent-light text-accent' : 'border-border-strong text-muted hover:text-text'}`;

/** The one card chrome every widget kind shares: position, kind, reorder on top; body; actions below. */
function CardShell({
  index, kind, tone, badge, onDragStart, onDrop, onMoveUp, onMoveDown, children, footer,
}: {
  index: number;
  kind: string;
  tone: Tone;
  badge?: React.ReactNode;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-border bg-surface transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-border-strong"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="w-5 font-mono text-[11px] text-faint">{String(index + 1).padStart(2, '0')}</span>
        <span className={`rounded-[5px] border px-1.5 py-0.5 font-mono text-[10.5px] tracking-[.06em] ${TONE[tone]}`}>{kind}</span>
        {badge}
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} disabled={!onMoveUp} title="Move earlier" aria-label="Move earlier" className={iconBtn}>↑</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} disabled={!onMoveDown} title="Move later" aria-label="Move later" className={iconBtn}>↓</button>
          <span className="cursor-grab px-1 text-base tracking-[-2px] text-faint" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
        </span>
      </div>
      <div className="min-w-0 px-4 pb-1 pt-2.5">{children}</div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border px-4 py-3">{footer}</div>
    </div>
  );
}

function CardTitle({ title, subtitle, onClick, clickTitle }: { title: string; subtitle: string; onClick?: () => void; clickTitle?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={clickTitle} className="block w-full min-w-0 text-left disabled:cursor-default">
      <b className="block truncate text-[15px] font-semibold text-text">{title}</b>
      <small className="mt-0.5 block truncate text-[12.5px] text-muted">{subtitle}</small>
    </button>
  );
}

function tileWidthClass(shape: string | null | undefined): string {
  switch (shape) {
    case 'landscape': return 'w-[104px]';
    case 'square': return 'w-[66px]';
    default: return 'w-11';
  }
}

function WidgetCard({
  index, item, childFolders, mode, isHomeTab, onClick, onDelete, onDragStart, onDrop, onMoveUp, onMoveDown,
  onSetExpandFolders, onOpenFolderSelection, onToggleGenreHub, onToggleSourceArt, onSplitFolders, onOpenFolder,
}: {
  index: number;
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
  onToggleSourceArt?: (item: CollectionCardItem, value: boolean) => void;
  onSplitFolders?: (item: CollectionCardItem) => void;
  /** Open one folder of this collection in the editor (a card tile click). */
  onOpenFolder?: (folderId: string) => void;
}) {
  // Hooks run unconditionally, before any early return: `item.kind` is
  // normally stable per card, but a re-decoded preset row can flip it, and
  // the poster hook used to sit after the returns below — the same React
  // #310 shape that crashed the widget editor.
  const collectionItem = item.kind === 'collection' ? item : null;
  const effectiveFolders = collectionItem
    ? (collectionItem.folderIds && collectionItem.folderIds.length
        ? childFolders.filter((f) => collectionItem.folderIds!.includes(f.id))
        : childFolders)
    : [];
  const sourcePosters = useFolderPreviewPosters(effectiveFolders.length === 1 ? effectiveFolders[0].id : null);
  const shell = { index, onDragStart, onDrop, onMoveUp, onMoveDown };

  if (item.kind === 'browseHub') {
    return (
      <CardShell
        {...shell}
        kind="Browse hub"
        tone="hub"
        footer={
          <>
            <span className="text-xs text-faint">Hub · hardcoded UI</span>
            <span className="flex gap-1.5">
              <button type="button" onClick={onClick} className={footBtn}>Edit tiles</button>
              <button type="button" onClick={() => { if (confirm(`Remove "${BROWSE_HUB_LABELS[item.hub]}" from this preset's Home list?`)) onDelete(); }} className={removeBtn}>Remove</button>
            </span>
          </>
        }
      >
        <CardTitle title={BROWSE_HUB_LABELS[item.hub]} subtitle="Tiles open a room for each one" onClick={onClick} clickTitle="Edit tile names" />
        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {HUB_PREVIEW[item.hub].map((t) => (
            <span key={t.label} className="grid aspect-[16/10] w-[72px] flex-none place-items-center rounded-md text-[11px] font-semibold text-white" style={{ background: `linear-gradient(140deg, ${t.bg}, #111)` }}>{t.label}</span>
          ))}
        </div>
      </CardShell>
    );
  }

  if (item.kind === 'filtering') {
    return (
      <CardShell
        {...shell}
        kind="Filtering"
        tone="filtering"
        footer={
          <>
            <span className="text-xs text-faint">TMDB · live</span>
            <span className="flex gap-1.5">
              <button type="button" onClick={onClick} className={footBtn}>Edit</button>
              <button type="button" onClick={() => { if (confirm(`Remove "${item.title}" from this preset's list? The widget itself stays on the curator's device.`)) onDelete(); }} className={removeBtn}>Remove</button>
            </span>
          </>
        }
      >
        <CardTitle title={item.title} subtitle={filteringSummary(item.query)} onClick={onClick} />
        <span className="mt-3 grid h-[66px] place-items-center rounded-md border border-dashed border-border text-xs text-faint">Titles load live from TMDB</span>
      </CardShell>
    );
  }

  if (item.kind === 'generic') {
    const dsKind = (item.presetItem.data_source as { kind?: string }).kind;
    const label = dsKind === 'addonCatalog' ? 'Add-on catalog' : dsKind === 'collectionsRow' ? 'Collections row' : 'App widget';
    return (
      <CardShell
        {...shell}
        kind={label}
        tone="generic"
        badge={item.adminOnly ? (
          <span className="rounded-[5px] border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-red-300" title="This widget depends on an add-on. Users never see add-on sources, so it will be empty for them.">Admin-only</span>
        ) : undefined}
        footer={
          <>
            <span className="text-xs text-faint">Edited on-device</span>
            <span className="flex gap-1.5">
              <button type="button" onClick={onClick} className={footBtn}>Details</button>
              <button type="button" onClick={() => { if (confirm(`Remove "${item.title}" from this preset's list? The widget itself stays on the curator's device.`)) onDelete(); }} className={removeBtn}>Remove</button>
            </span>
          </>
        }
      >
        <CardTitle title={item.title} subtitle={item.subtitle} onClick={onClick} />
        <span className="mt-3 grid h-[66px] place-items-center rounded-md border border-dashed border-border text-xs text-faint">Published from the app</span>
      </CardShell>
    );
  }

  const { collection } = item;
  // Non-null alias for the controls below (narrowing is lost in the hoisted
  // version used by the hook call, which must run before the early returns).
  const cardItem: CollectionCardItem = item;
  const totalFolderCount = childFolders.length;
  const folderCount = effectiveFolders.length;
  // Per-placement folder controls: only meaningful in "preset" mode (the
  // flag lives on the preset item, not the collection itself) and only when
  // the widget actually spans 2+ folders — a single-folder widget (a split
  // child) has nothing to choose, switch or split.
  const canChooseFolders = mode === 'preset' && item.presetItemId != null
    && totalFolderCount >= 2 && folderCount > 1;
  const genreHubOn = item.genreHub === true;
  const sourceArtOn = item.sourceArt === true;
  const folderSelectionLabel = folderCount === totalFolderCount
    ? (totalFolderCount === 1 ? '1 folder' : `${totalFolderCount} folders`)
    : `${folderCount} of ${totalFolderCount} folders`;
  // "Hardcoded UI" is only true of Home's genre/language tile strip; a
  // Movies/Series hub renders through the generic group-tile path.
  const subtitle = canChooseFolders
    ? genreHubOn
      ? `Genre hub · ${sourceArtOn ? 'Source art · ' : ''}${folderSelectionLabel}`
      : folderCount === 1
        ? `Folder · content row · ${folderSelectionLabel}`
        : `${item.expandFolders ? 'Rows' : 'Hub'} · ${folderSelectionLabel}`
    : collection.display_section === 'hub' ? (isHomeTab ? 'Hub · hardcoded UI' : `Hub · ${folderCount} folders`)
    : collection.display_section === 'rows' ? 'Rows'
    : folderCount >= 2 ? `Hub · ${folderCount} folders`
    : folderCount === 1 ? 'Folder · content row' : 'Empty';
  const styleLabel = item.style ? STYLE_LABELS[item.style] ?? item.style : mode === 'all' ? 'All widgets' : 'Row Classic';

  const isFolderWidget = folderCount >= 2;
  const hubTiles = isFolderWidget ? effectiveFolders.slice(0, 5) : [];
  // A single-folder widget shows that folder's own artwork, so split
  // children don't all read as the same collection backdrop.
  const singleFolderArt = !isFolderWidget && effectiveFolders.length === 1
    ? effectiveFolders[0].cover_image ?? effectiveFolders[0].hero_backdrop
    : null;
  const confirmRemove = mode === 'preset'
    ? `Remove "${collection.name}" from this preset's list? The widget itself is untouched.`
    : `Delete the "${collection.name}" widget entirely? This removes it everywhere, including from any preset that references it.`;

  return (
    <CardShell
      {...shell}
      kind={isFolderWidget ? 'Hub' : 'Collection'}
      tone="collection"
      badge={collection.status === 'draft' ? (
        <span className="rounded-[5px] border border-fuchsia-400/40 bg-fuchsia-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fuchsia-300">Draft</span>
      ) : undefined}
      footer={
        <>
          <span className="text-xs text-faint">{styleLabel}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={onClick} className={footBtn}>Edit</button>
            <button type="button" onClick={() => { if (confirm(confirmRemove)) onDelete(); }} title={mode === 'preset' ? 'Remove from this preset' : 'Delete widget'} className={removeBtn}>{mode === 'preset' ? 'Remove' : 'Delete'}</button>
          </span>
        </>
      }
    >
      <CardTitle title={item.presetTitle || collection.name} subtitle={subtitle} onClick={onClick} />

      <div className="mt-3 flex gap-1.5 overflow-hidden">
        {isFolderWidget ? (
          hubTiles.map((f) => (
            // Each tile opens ITS folder in the editor.
            <button
              key={f.id}
              type="button"
              onClick={() => onOpenFolder?.(f.id)}
              title={`Open ${f.name}`}
              className={`${tileWidthClass(f.tile_shape)} flex-none overflow-hidden rounded ring-1 ring-transparent transition hover:ring-accent`}
            >
              <HubTile folder={f} />
            </button>
          ))
        ) : sourcePosters.length > 0 ? (
          [0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="block w-11 flex-none overflow-hidden rounded">
              <FallbackPosterImg pool={sourcePosters} slot={i} totalSlots={5} className="aspect-[2/3] w-full object-cover" />
            </span>
          ))
        ) : singleFolderArt || collection.backdrop_image ? (
          <img src={(singleFolderArt || collection.backdrop_image) as string} alt="" className="h-[66px] w-[118px] flex-none rounded object-cover" />
        ) : (
          <span className="grid h-[66px] w-full place-items-center rounded-md border border-dashed border-border text-xs text-faint">No artwork yet</span>
        )}
      </div>

      {canChooseFolders && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onOpenFolderSelection?.(cardItem)} title="Choose which folders this widget shows" className={pill(false)}>
            Choose folders
          </button>
          <button
            type="button"
            onClick={() => onToggleGenreHub?.(cardItem, !genreHubOn)}
            aria-pressed={genreHubOn}
            title={genreHubOn
              ? 'Rendering through the app’s hardcoded genre UI — click to turn off'
              : 'Render through the app’s hardcoded genre UI (editorial genre tiles + genre rooms), using these folders as genres'}
            className={pill(genreHubOn)}
          >
            Genre hub
          </button>
          {genreHubOn ? (
            <button
              type="button"
              onClick={() => onToggleSourceArt?.(cardItem, !sourceArtOn)}
              aria-pressed={sourceArtOn}
              title={sourceArtOn
                ? 'Tiles preview each folder’s own sources — click for the default TMDB genre art'
                : 'Show each folder’s own source artwork on the genre tiles (needed for genres TMDB art can’t resolve, e.g. Arabic names) instead of the default TMDB genre art'}
              className={pill(sourceArtOn)}
            >
              Source art
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onSplitFolders?.(cardItem)} title="Replace this widget with one widget per folder" className={pill(false)}>
                Split folders
              </button>
              <span className="ml-auto inline-flex rounded-full border border-border-strong p-0.5 text-[11.5px] font-medium">
                <button
                  type="button"
                  onClick={() => { if (cardItem.expandFolders) onSetExpandFolders?.(cardItem, false); }}
                  aria-pressed={!cardItem.expandFolders}
                  title="Show the folders as one hub of tiles"
                  className={`h-6 rounded-full px-2.5 transition-colors ${cardItem.expandFolders ? 'text-muted hover:text-text' : 'bg-surface-2 text-text'}`}
                >
                  Folders
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cardItem.expandFolders) return;
                    onSetExpandFolders?.(cardItem, true);
                    // Switching to Rows opens the picker so "all or a few" is a
                    // deliberate choice — Apply with everything on keeps All.
                    onOpenFolderSelection?.(cardItem);
                  }}
                  aria-pressed={!!cardItem.expandFolders}
                  title="Give every selected folder its own content row"
                  className={`h-6 rounded-full px-2.5 transition-colors ${cardItem.expandFolders ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
                >
                  Rows
                </button>
              </span>
            </>
          )}
        </div>
      )}
    </CardShell>
  );
}

// A "Filtering" widget's query, summarized for the card subtitle.
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
