import type { CollectionTree, TreeFolder, TreeSource } from './collectionTrees';
import { mapSource, normalizeMediaType, normalizeShape } from './importCollections';

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'collection';
}

/** Nuvio's camelCase TMDB filter keys → the snake_case `/discover` query
 *  params the app's `folder_catalogs.filter_params` rows consume. Date fields
 *  differ by media type (TMDB's own movie/tv vocabulary). */
const TMDB_FILTER_KEYS: Record<string, (mediaType: string) => string> = {
  releaseDateGte: (mt) => (mt === 'series' ? 'first_air_date.gte' : 'primary_release_date.gte'),
  releaseDateLte: (mt) => (mt === 'series' ? 'first_air_date.lte' : 'primary_release_date.lte'),
  voteCountGte: () => 'vote_count.gte',
  voteAverageGte: () => 'vote_average.gte',
  voteAverageLte: () => 'vote_average.lte',
  withGenres: () => 'with_genres',
  withKeywords: () => 'with_keywords',
  withNetworks: () => 'with_networks',
  withCompanies: () => 'with_companies',
  withOriginCountry: () => 'with_origin_country',
  withWatchProviders: () => 'with_watch_providers',
  withOriginalLanguage: () => 'with_original_language',
  watchRegion: () => 'watch_region',
  year: (mt) => (mt === 'series' ? 'first_air_date_year' : 'year'),
};

/** A TMDB discover source's `filters` + `sortBy` → `/discover` params, or
 *  `null` when nothing usable is set. Nuvio writes 0 / null for "unset". */
function tmdbFilterParams(src: Record<string, unknown>, mediaType: string): Record<string, string> | null {
  const filters = src.filters as Record<string, unknown> | undefined;
  const params: Record<string, string> = {};
  if (filters) {
    for (const [key, paramName] of Object.entries(TMDB_FILTER_KEYS)) {
      const value = filters[key];
      if (value === null || value === undefined || value === '' || value === 0) continue;
      params[paramName(mediaType)] = String(value);
    }
  }
  const sortBy = asString(src.sortBy);
  if (sortBy) {
    const sortHow = asString(src.sortHow);
    params.sort_by = sortBy.includes('.') ? sortBy : sortHow ? `${sortBy}.${sortHow}` : sortBy;
  }
  return Object.keys(params).length ? params : null;
}

/** Nuvio's per-source shape → the portal's storage shape. Addon catalogs and
 *  Trakt lists go through the shared mapping; TMDB discover sources become
 *  `filter_params` rows (fetched straight from TMDB by the app) instead of
 *  the dead raw `tmdb_id = 0` rows the generic fallback would produce. */
function mapNuvioSource(src: Record<string, unknown>, discoverMap: Record<string, string>): TreeSource | null {
  const mediaType = normalizeMediaType((src.type ?? src.mediaType) as string | undefined);
  const provider = ((src.provider as string) ?? '').toLowerCase();
  const hasFilters = Boolean(src.filters || src.sortBy || src.tmdbSourceType || src.tmdbId);
  if (!src.catalogId && !src.traktListId && (provider === 'tmdb' || hasFilters)) {
    const params = tmdbFilterParams(src, mediaType);
    if (params) {
      return {
        kind: 'catalog',
        catalogId: `tmdb.discover.custom.${slugify(asString(src.title) ?? 'discover')}`,
        mediaType,
        filterParams: params,
      };
    }
  }
  const mapped = mapSource(src, discoverMap);
  if (!mapped) return null;
  if (mapped.catalog) return { kind: 'catalog', ...mapped.catalog };
  if (mapped.raw) return { kind: 'raw', ...mapped.raw };
  return null;
}

/** Validates that `text` is a Nuvio/Moonlit collections profile —
 *  `[{title, folders:[{title, sources:[…]}]}]` — and returns its raw
 *  collection objects. Throws for anything else, naming the failure. */
export function parseCollectionsProfile(text: string): Record<string, unknown>[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That is not valid JSON.');
  }
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error('Expected a non-empty list of collections.');
  }
  const items = json as Record<string, unknown>[];
  const looksLikeCollections = items.every(
    (item) => item && typeof item === 'object' && Array.isArray((item as { folders?: unknown }).folders),
  );
  if (!looksLikeCollections) {
    throw new Error("That JSON isn't a collections profile (its items have no `folders` list).");
  }
  return items;
}

/**
 * Maps a Nuvio/Moonlit collections profile onto `CollectionTree`s the tree
 * sync can persist: every collection becomes a real Moonlit collection
 * (folders + sources), and one preset widget per collection. Identity comes
 * from the profile's own ids, so re-importing an updated profile syncs the
 * same rows instead of duplicating them. Folders whose sources all fail to
 * map are skipped, and unaddressable sources are counted for reporting.
 */
export function collectionsToTrees(
  collections: Record<string, unknown>[],
  discoverMap: Record<string, string> = {}
): { trees: CollectionTree[]; skippedSources: number } {
  let skippedSources = 0;
  const trees: CollectionTree[] = [];

  collections.forEach((col, ci) => {
    const title = asString(col.title) ?? asString(col.name) ?? `Collection ${ci + 1}`;
    const externalId = asString(col.id) ?? `collection-${slugify(title)}`;
    const rawFolders = (col.folders as Record<string, unknown>[]) ?? [];

    const folders: TreeFolder[] = [];
    rawFolders.forEach((f, fi) => {
      const sources = Array.isArray(f.sources) ? (f.sources as Record<string, unknown>[]) : [];
      const mapped: TreeSource[] = [];
      for (const src of sources) {
        const result = mapNuvioSource(src, discoverMap);
        if (!result) { skippedSources++; continue; }
        mapped.push(result);
      }
      if (!mapped.length) return;
      folders.push({
        externalId: asString(f.id) ?? `folder-${ci}-${fi}`,
        name: asString(f.title) ?? asString(f.name) ?? `Folder ${fi + 1}`,
        tileShape: normalizeShape(asString(f.tileShape) ?? asString(f.tile_shape) ?? undefined),
        coverImage: asString(f.coverImageUrl) ?? asString(f.cover_image),
        heroBackdrop: asString(f.heroBackdropUrl) ?? asString(f.hero_backdrop),
        focusGif: asString(f.focusGifUrl) ?? asString(f.focus_gif),
        titleLogo: asString(f.titleLogoUrl) ?? asString(f.title_logo),
        heroVideoUrl: asString(f.heroVideoUrl) ?? asString(f.hero_video_url),
        hideTitle: Boolean(f.hideTitle ?? f.hide_title ?? false),
        focusGifEnabled: Boolean(f.focusGifEnabled ?? f.focus_gif_enabled ?? false),
        sources: mapped,
      });
    });

    if (!folders.length) return;
    const firstHero = asString(rawFolders[0]?.heroBackdropUrl);
    trees.push({
      externalId,
      presetSourceId: `nuvio:${externalId}`,
      name: title,
      viewMode: asString(col.viewMode) ?? 'FOLLOW_LAYOUT',
      showAllTab: Boolean(col.showAllTab ?? false),
      pinToTop: Boolean(col.pinToTop ?? false),
      backdropImage: asString(col.backdropImageUrl) ?? firstHero,
      folders,
    });
  });

  return { trees, skippedSources };
}
