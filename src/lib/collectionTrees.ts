import { supabase } from './supabase';
import type { WidgetTab } from '../components/catalog/WidgetGrid';

/** Mirrors `WidgetGrid.TAB_FLAG` — a collection only *renders* as a preset
 *  widget in a tab it's visible in (`DBCollection.isVisible(in:)`; movies/
 *  series default to false), so imports enable the tab their widget lands on
 *  for both platforms. */
const TAB_FLAGS: Record<WidgetTab, { ios: string; mac: string }> = {
  home: { ios: 'show_ios_home', mac: 'show_mac_home' },
  movies: { ios: 'show_ios_movies', mac: 'show_mac_movies' },
  series: { ios: 'show_ios_series', mac: 'show_mac_series' },
};

/** A folder source expressed the way the portal stores it: either an
 *  addon-served catalog (`folder_catalogs`) or a raw provider row
 *  (`folder_sources`, used when a source can't be resolved to one catalog
 *  id — TMDB discover leftovers, Trakt lists, …). */
export type TreeSource =
  | {
      kind: 'catalog';
      catalogId: string;
      mediaType: string;
      genre?: string | null;
      extras?: Record<string, string> | null;
      filterParams?: Record<string, string> | null;
    }
  | {
      kind: 'raw';
      provider: string;
      title?: string | null;
      tmdbId?: string | null;
      mediaType?: string | null;
      tmdbSourceType?: string | null;
      sortBy?: string | null;
      filtersJson?: string | null;
      rawJson?: string | null;
    };

export interface TreeFolder {
  /** Stable identity within the collection — re-import matches on this, so a
   *  rename in the source updates the row instead of duplicating it. */
  externalId: string;
  name: string;
  tileShape?: string;
  coverImage?: string | null;
  heroBackdrop?: string | null;
  focusGif?: string | null;
  titleLogo?: string | null;
  heroVideoUrl?: string | null;
  hideTitle?: boolean;
  focusGifEnabled?: boolean;
  sources: TreeSource[];
}

export interface CollectionTree {
  /** `collections.external_id` — e.g. a Nuvio collection id. */
  externalId: string;
  /** `home_preset_items.source_widget_id` for this tree's preset widget —
   *  keeps the placement identity separate from the collection's own. */
  presetSourceId: string;
  name: string;
  viewMode?: string;
  showAllTab?: boolean;
  pinToTop?: boolean;
  backdropImage?: string | null;
  folders: TreeFolder[];
}

export interface TreeSyncResult {
  collectionsCreated: number;
  collectionsUpdated: number;
  foldersCreated: number;
  foldersUpdated: number;
  foldersRemoved: number;
  sourcesWritten: number;
  presetItemsCreated: number;
  presetItemsUpdated: number;
  errors: string[];
}

/**
 * Syncs collection trees into real `collections`/`folders`/
 * `folder_catalogs`/`folder_sources` rows and adds one widget per tree to a
 * preset + tab. Identity is `external_id` (and `source_widget_id` for the
 * preset item) — re-running with an updated source updates the same rows in
 * place: retitles, reorders, replaces each folder's sources, and removes
 * imported folders that vanished from the source. Hand-authored folders
 * (no `external_id`) are never touched, and nothing is ever wiped globally.
 */
export async function syncCollectionTrees(opts: {
  presetId: string;
  tab: WidgetTab;
  trees: CollectionTree[];
  /** Sort order for the first *new* preset item — existing items keep theirs. */
  startSortOrder: number;
  onProgress?: (message: string) => void;
}): Promise<TreeSyncResult> {
  const result: TreeSyncResult = {
    collectionsCreated: 0,
    collectionsUpdated: 0,
    foldersCreated: 0,
    foldersUpdated: 0,
    foldersRemoved: 0,
    sourcesWritten: 0,
    presetItemsCreated: 0,
    presetItemsUpdated: 0,
    errors: [],
  };

  // New collections append after the current last one; they carry no tab
  // flags, so they only ever surface through the preset widget created below.
  const { data: maxCollection } = await supabase
    .from('collections').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  let nextCollectionOrder = ((maxCollection?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  let nextPresetOrder = opts.startSortOrder;

  for (const tree of opts.trees) {
    opts.onProgress?.(`Syncing “${tree.name}” (${tree.folders.length} folders)…`);
    try {
      // ── collection ──────────────────────────────────────────────────────
      const { data: existingCollection } = await supabase
        .from('collections').select('id').eq('external_id', tree.externalId).maybeSingle();

      let collectionId: string;
      if (existingCollection?.id) {
        collectionId = existingCollection.id as string;
        const { error } = await supabase.from('collections').update({
          name: tree.name,
          view_mode: tree.viewMode ?? 'FOLLOW_LAYOUT',
          show_all_tab: tree.showAllTab ?? false,
          pin_to_top: tree.pinToTop ?? false,
          backdrop_image: tree.backdropImage ?? null,
          [TAB_FLAGS[opts.tab].ios]: true,
          [TAB_FLAGS[opts.tab].mac]: true,
        }).eq('id', collectionId);
        if (error) throw new Error(error.message);
        result.collectionsUpdated++;
      } else {
        const { data, error } = await supabase.from('collections').insert({
          name: tree.name,
          view_mode: tree.viewMode ?? 'FOLLOW_LAYOUT',
          show_all_tab: tree.showAllTab ?? false,
          pin_to_top: tree.pinToTop ?? false,
          backdrop_image: tree.backdropImage ?? null,
          status: 'published',
          sort_order: nextCollectionOrder++,
          external_id: tree.externalId,
          [TAB_FLAGS[opts.tab].ios]: true,
          [TAB_FLAGS[opts.tab].mac]: true,
        }).select('id').single();
        if (error || !data) throw new Error(error?.message ?? 'collection insert failed');
        collectionId = data.id as string;
        result.collectionsCreated++;
      }

      // ── folders ─────────────────────────────────────────────────────────
      const { data: existingFolders } = await supabase
        .from('folders').select('id, external_id')
        .eq('collection_id', collectionId)
        .not('external_id', 'is', null);
      const folderIdByExternalId = new Map<string, string>(
        (existingFolders ?? []).map((f) => [f.external_id as string, f.id as string]),
      );

      const folderIdByInput = new Map<string, string>();
      for (let index = 0; index < tree.folders.length; index++) {
        const folder = tree.folders[index];
        const patch = {
          collection_id: collectionId,
          name: folder.name,
          cover_image: folder.coverImage ?? null,
          hero_backdrop: folder.heroBackdrop ?? null,
          focus_gif: folder.focusGif ?? null,
          title_logo: folder.titleLogo ?? null,
          hero_video_url: folder.heroVideoUrl ?? null,
          hide_title: folder.hideTitle ?? false,
          tile_shape: folder.tileShape ?? 'poster',
          focus_gif_enabled: folder.focusGifEnabled ?? false,
          sort_order: index,
        };
        const existingId = folderIdByExternalId.get(folder.externalId);
        if (existingId) {
          const { error } = await supabase.from('folders').update(patch).eq('id', existingId);
          if (error) throw new Error(error.message);
          folderIdByInput.set(folder.externalId, existingId);
          result.foldersUpdated++;
        } else {
          const { data, error } = await supabase.from('folders')
            .insert({ ...patch, external_id: folder.externalId }).select('id').single();
          if (error || !data) throw new Error(error?.message ?? 'folder insert failed');
          folderIdByInput.set(folder.externalId, data.id as string);
          result.foldersCreated++;
        }
      }

      // Imported folders that vanished from the source are removed — with
      // their sources — so the import stays a faithful mirror. A folder
      // without an `external_id` was authored by hand and is left alone.
      for (const [externalId, folderId] of folderIdByExternalId) {
        if (folderIdByInput.has(externalId)) continue;
        await supabase.from('folder_catalogs').delete().eq('folder_id', folderId);
        await supabase.from('folder_sources').delete().eq('folder_id', folderId);
        await supabase.from('folders').delete().eq('id', folderId);
        result.foldersRemoved++;
      }

      // ── sources (replaced per folder, order preserved) ─────────────────
      for (const folder of tree.folders) {
        const folderId = folderIdByInput.get(folder.externalId);
        if (!folderId) continue;
        await supabase.from('folder_catalogs').delete().eq('folder_id', folderId);
        await supabase.from('folder_sources').delete().eq('folder_id', folderId);

        const catalogRows = folder.sources
          .filter((s): s is Extract<TreeSource, { kind: 'catalog' }> => s.kind === 'catalog')
          .map((s) => ({
            folder_id: folderId,
            catalog_id: s.catalogId,
            media_type: s.mediaType,
            genre: s.genre ?? null,
            extras: s.extras ?? null,
            filter_params: s.filterParams ?? null,
          }));
        const rawRows = folder.sources
          .filter((s): s is Extract<TreeSource, { kind: 'raw' }> => s.kind === 'raw')
          .map((s) => ({
            folder_id: folderId,
            provider: s.provider,
            title: s.title ?? null,
            tmdb_id: s.tmdbId ?? null,
            media_type: s.mediaType ?? null,
            tmdb_source_type: s.tmdbSourceType ?? null,
            sort_by: s.sortBy ?? null,
            filters_json: s.filtersJson ?? null,
            raw_json: s.rawJson ?? null,
          }));

        if (catalogRows.length) {
          const { error } = await supabase.from('folder_catalogs').insert(catalogRows);
          if (error) throw new Error(error.message);
          result.sourcesWritten += catalogRows.length;
        }
        if (rawRows.length) {
          const { error } = await supabase.from('folder_sources').insert(rawRows);
          if (error) throw new Error(error.message);
          result.sourcesWritten += rawRows.length;
        }
      }

      // ── preset widget ───────────────────────────────────────────────────
      const { data: existingItem } = await supabase
        .from('home_preset_items').select('id')
        .eq('preset_id', opts.presetId)
        .eq('tab', opts.tab)
        .eq('source_widget_id', tree.presetSourceId)
        .maybeSingle();
      if (existingItem?.id) {
        // Placement fields (style, folder modes, sort order) stay the
        // admin's — only the source link and label sync.
        const { error } = await supabase.from('home_preset_items').update({
          title: tree.name,
          data_source: { kind: 'collection', collectionId },
        }).eq('id', existingItem.id);
        if (error) throw new Error(error.message);
        result.presetItemsUpdated++;
      } else {
        const { error } = await supabase.from('home_preset_items').insert({
          preset_id: opts.presetId,
          tab: opts.tab,
          data_source: { kind: 'collection', collectionId },
          media_type: null,
          style: 'standard',
          sort_order: nextPresetOrder++,
          title: tree.name,
          source_widget_id: tree.presetSourceId,
        });
        if (error) throw new Error(error.message);
        result.presetItemsCreated++;
      }
      opts.onProgress?.(`  → “${tree.name}” synced`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push(`${tree.name}: ${message}`);
      opts.onProgress?.(`  → error: ${message}`);
    }
  }

  return result;
}
