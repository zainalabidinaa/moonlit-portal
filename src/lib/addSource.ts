import {
  buildFilteringQuery,
  filteringValidationMessage,
  parseFilteringParams,
  type FilteringState,
} from './filteringQuery';

/** A row to insert into `folder_catalogs`. No add-on is ever attached. */
export interface NativeSourceRow {
  catalog_id: string;
  media_type: 'movie' | 'series';
  genre: string | null;
  filter_params: Record<string, string> | null;
}

export type BuildResult = { row: NativeSourceRow } | { error: string };

const defaultSuffix = () => Math.random().toString(36).slice(2, 8);

export function filterSource(state: FilteringState, suffix: () => string = defaultSuffix): BuildResult {
  const problem = filteringValidationMessage(state);
  if (problem) return { error: problem };
  return {
    row: {
      catalog_id: `tmdb.discover.custom.${suffix()}`,
      media_type: state.mediaKind,
      genre: null,
      filter_params: parseFilteringParams(buildFilteringQuery(state)),
    },
  };
}

/**
 * A Moonlit list becomes a folder row by copying its TMDB settings: the apps
 * resolve `catalog_definitions` only as widget sources, never inside folders.
 */
export function definitionSource(def: {
  id: string;
  media_type: string;
  params: Record<string, unknown> | null;
}): BuildResult {
  if (def.media_type !== 'movie' && def.media_type !== 'series') return { error: 'This list has no media type.' };
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(def.params ?? {})) {
    if (v !== null && v !== undefined && v !== '') params[k] = String(v);
  }
  if (Object.keys(params).length === 0) return { error: 'This list has no settings to copy.' };
  return {
    row: {
      catalog_id: `tmdb.discover.moonlit.${def.id}`,
      media_type: def.media_type,
      genre: null,
      filter_params: params,
    },
  };
}

const DIGITS = /^\d+$/;

export function collectionSource(idText: string): BuildResult {
  const id = idText.trim();
  if (!DIGITS.test(id)) {
    return { error: 'Enter the collection number, e.g. 295 from themoviedb.org/collection/295.' };
  }
  return { row: { catalog_id: `tmdb.collection.${id}`, media_type: 'movie', genre: null, filter_params: null } };
}

export function listSource(
  provider: 'trakt' | 'mdblist',
  idText: string,
  mediaType: 'movie' | 'series',
): BuildResult {
  const id = idText.trim();
  if (!DIGITS.test(id)) {
    return { error: `Enter the ${provider === 'trakt' ? 'Trakt' : 'MDBList'} list number.` };
  }
  const catalog_id = provider === 'trakt' ? `trakt.list.${id}` : `mdblist.${id}`;
  return { row: { catalog_id, media_type: mediaType, genre: null, filter_params: null } };
}
