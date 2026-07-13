export type OrganizerRows = {
  collections: any[];
  folders: any[];
  catalogs: any[];
  folderSources: any[];
  folderEntries: any[];
};

function serializeSource(source: any) {
  const base: any = {
    type: source.media_type ?? 'all',
    genre: 'None',
    title: source.title ?? '',
    provider: source.provider,
  };
  if (source.provider === 'trakt' && source.tmdb_id) {
    base.traktListId = parseInt(source.tmdb_id, 10) || 0;
  } else if (source.provider === 'tvdb' && source.tmdb_id) {
    base.catalogId = `tvdb.discover.${base.type}.${source.tmdb_id}`;
  } else {
    base.tmdbId = source.tmdb_id;
    base.tmdbSourceType = source.tmdb_source_type ?? 'DISCOVER';
  }
  return base;
}

function serializeEntry(entry: any) {
  return {
    parentFolderId: entry.parent_folder_id,
    entryKind: entry.entry_kind,
    ...(entry.folder_id ? { folderId: entry.folder_id } : {}),
    ...(entry.folder_catalog_id ? { folderCatalogId: entry.folder_catalog_id } : {}),
    ...(entry.folder_source_id ? { folderSourceId: entry.folder_source_id } : {}),
    sortOrder: entry.sort_order,
  };
}

export function buildOrganizerPayload({
  collections,
  folders,
  catalogs,
  folderSources,
  folderEntries,
}: OrganizerRows) {
  const foldersByCollection: Record<string, any[]> = {};
  for (const folder of folders) {
    (foldersByCollection[folder.collection_id] ??= []).push(folder);
  }
  const catalogsByFolder: Record<string, any[]> = {};
  for (const catalog of catalogs) {
    (catalogsByFolder[catalog.folder_id] ??= []).push(catalog);
  }
  const sourcesByFolder: Record<string, any[]> = {};
  for (const source of folderSources) {
    (sourcesByFolder[source.folder_id] ??= []).push(source);
  }

  return collections.map((collection) => {
    const collectionFolders = foldersByCollection[collection.id] ?? [];
    const folderIds = new Set(collectionFolders.map((folder) => folder.id));
    const entries = folderEntries
      .filter((entry) => folderIds.has(entry.parent_folder_id))
      .sort((a, b) => a.parent_folder_id.localeCompare(b.parent_folder_id) || a.sort_order - b.sort_order)
      .map(serializeEntry);

    return {
      id: collection.id,
      title: collection.name,
      folders: collectionFolders.map((folder) => ({
        id: folder.id,
        title: folder.name,
        sources: [
          ...(catalogsByFolder[folder.id] ?? []).map((catalog) => ({
            type: catalog.media_type,
            genre: catalog.genre ?? 'None',
            addonId: 'aio-metadata',
            provider: 'addon',
            catalogId: catalog.catalog_id,
          })),
          ...(sourcesByFolder[folder.id] ?? []).map(serializeSource),
        ],
        parentFolderId: folder.parent_folder_id ?? null,
        genre: folder.genre ?? null,
        hideTitle: folder.hide_title ?? false,
        tileShape: (folder.tile_shape ?? 'poster').toUpperCase(),
        focusGifEnabled: folder.focus_gif_enabled ?? false,
        heroBackdropUrl: folder.hero_backdrop ?? null,
        coverImageUrl: folder.cover_image ?? null,
        titleLogoUrl: folder.title_logo ?? null,
        focusGifUrl: folder.focus_gif ?? null,
        heroVideoUrl: folder.hero_video_url ?? null,
        enabled: folder.enabled ?? true,
      })),
      folderEntries: entries,
      pinToTop: collection.pin_to_top ?? false,
      viewMode: collection.view_mode ?? 'FOLLOW_LAYOUT',
      showAllTab: collection.show_all_tab ?? false,
      focusGlowEnabled: collection.focus_glow_enabled ?? false,
      backdropImageUrl: collection.backdrop_image ?? null,
      showOnHome: collection.show_on_home ?? true,
    };
  }).filter((collection) => collection.folders.length > 0);
}
