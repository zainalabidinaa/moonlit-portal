import { supabase } from './supabase';
import type { HomePresetItem } from '../types';

/**
 * A profile's personal Home layout ("Your Widgets" in the apps), stored as
 * one `home_widgets` row per profile with the whole `[HomeWidget]` array in
 * `widgets`. The shapes below mirror MoonlitCore's `HomeWidget` /
 * `WidgetDataSource` Codable encoding exactly (WidgetModels.swift in
 * moonlit-web), so the apps decode what the portal writes with no
 * translation layer.
 *
 * Personal, never shared: `home_widgets` RLS is owner-only, so nothing here
 * can touch the admin-authored presets every other account syncs from.
 *
 * Sync: the apps adopt this row on launch when its `updated_at` is newer
 * than their local copy (WidgetsPreferenceStore.reconcileWithSupabase). They
 * keep each widget's display style locally, so `style` is written but a
 * device may override it.
 */

export type WidgetTab = 'home' | 'movies' | 'series';

export type WidgetDataSource =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'filtering'; query: string }
  | { kind: 'browseHub'; hub: 'genre' | 'language' | string }
  | { kind: 'watchlist' }
  | { kind: 'addonCatalog'; addonId: string; catalogId: string; mediaType: string }
  | { kind: 'traktList'; listId: string; query?: string }
  | { kind: 'definition'; definitionId: string }
  | { kind: 'collectionsRow'; entries: unknown[] };

export interface HomeWidget {
  id: string;
  title?: string;
  dataSource: WidgetDataSource;
  style: string;
  isHidden: boolean;
  mediaType?: 'movie' | 'series';
  tabs: WidgetTab[];
  expandFolders: boolean;
  folderIds?: string[];
  genreHub: boolean;
  sourceArt: boolean;
}

/** Kinds the portal can create. The rest are preserved untouched when saving. */
export type CreatableKind = 'collection' | 'filtering' | 'browseHub' | 'watchlist';

export function newWidgetId(): string {
  return crypto.randomUUID().toUpperCase();
}

/** Fills defaults the same way HomeWidget's Swift decoder does for older rows. */
export function normalizeWidget(raw: Partial<HomeWidget> & { dataSource: WidgetDataSource }): HomeWidget {
  return {
    id: raw.id ?? newWidgetId(),
    title: raw.title ?? undefined,
    dataSource: raw.dataSource,
    style: raw.style ?? 'standard',
    isHidden: raw.isHidden ?? false,
    mediaType: raw.mediaType ?? undefined,
    tabs: raw.tabs && raw.tabs.length ? raw.tabs : ['home'],
    expandFolders: raw.expandFolders ?? false,
    folderIds: raw.folderIds ?? undefined,
    genreHub: raw.genreHub ?? false,
    sourceArt: raw.sourceArt ?? false,
  };
}

/** Swift's synthesized encoder omits nil optionals; do the same so rows match. */
export function encodeWidget(w: HomeWidget): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: w.id,
    dataSource: w.dataSource,
    style: w.style,
    isHidden: w.isHidden,
    tabs: w.tabs,
    expandFolders: w.expandFolders,
    genreHub: w.genreHub,
    sourceArt: w.sourceArt,
  };
  if (w.title) out.title = w.title;
  if (w.mediaType) out.mediaType = w.mediaType;
  if (w.folderIds && w.folderIds.length) out.folderIds = w.folderIds;
  return out;
}

/** Collection ids in widgets can carry the app's `collection_` row prefix. */
export function widgetCollectionId(w: HomeWidget): string | null {
  if (w.dataSource.kind !== 'collection') return null;
  const id = w.dataSource.collectionId;
  return id.startsWith('collection_') ? id.slice('collection_'.length) : id;
}

/**
 * Turns an admin preset's items into a personal starting layout — the same
 * data source shape, so the copy renders exactly like the synced rows did,
 * but from then on it is the profile's own and preset edits don't touch it.
 */
export function widgetsFromPresetItems(items: HomePresetItem[]): HomeWidget[] {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) =>
      normalizeWidget({
        id: newWidgetId(),
        title: item.title ?? undefined,
        dataSource: item.data_source as WidgetDataSource,
        style: item.style,
        mediaType: item.media_type ?? undefined,
        tabs: [item.tab],
        expandFolders: item.expand_folders ?? false,
        folderIds: item.folder_ids ?? undefined,
        genreHub: item.genre_hub ?? false,
        sourceArt: item.source_art ?? false,
      })
    );
}

export interface StoredWidgets {
  widgets: HomeWidget[];
  updatedAt: string | null;
  /** True when the profile has never saved a layout (apps show Moonlit's Home). */
  isNew: boolean;
}

export async function loadHomeWidgets(profileId: string): Promise<StoredWidgets> {
  const { data, error } = await supabase
    .from('home_widgets')
    .select('widgets, updated_at')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { widgets: [], updatedAt: null, isNew: true };
  const list = Array.isArray(data.widgets) ? (data.widgets as HomeWidget[]) : [];
  return { widgets: list.map(normalizeWidget), updatedAt: data.updated_at ?? null, isNew: false };
}

/**
 * Upserts the whole layout. `updated_at` is set here (and by the table's
 * update trigger) so the apps' "newest wins" check adopts this copy.
 */
export async function saveHomeWidgets(profileId: string, widgets: HomeWidget[]): Promise<string> {
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('home_widgets')
    .upsert(
      { profile_id: profileId, widgets: widgets.map(encodeWidget), updated_at: updatedAt },
      { onConflict: 'profile_id' }
    )
    .select('updated_at')
    .single();
  if (error) throw new Error(error.message);
  return (data?.updated_at as string | undefined) ?? updatedAt;
}

/** The layout a profile's Home falls back to: the active admin preset for one tab. */
export async function loadActivePresetItems(): Promise<{ presetName: string; items: HomePresetItem[] } | null> {
  const { data: presets } = await supabase.from('home_presets').select('id, slug, name, is_active').eq('is_active', true).order('sort_order');
  const list = (presets ?? []) as { id: string; slug: string; name: string; is_active: boolean }[];
  const preset = list.find((p) => p.slug === 'signature') ?? list[0];
  if (!preset) return null;
  const { data: items } = await supabase.from('home_preset_items').select('*').eq('preset_id', preset.id).order('sort_order');
  return { presetName: preset.name, items: (items ?? []) as HomePresetItem[] };
}
