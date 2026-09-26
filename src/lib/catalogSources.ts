import type { FolderCatalog, FolderSource } from '../types';

export type SourceKind =
  | 'tmdb-filter'
  | 'tmdb-collection'
  | 'trakt'
  | 'mdblist'
  | 'copy'
  | 'unresolved';

export type RefreshTier = 'none' | 'cache' | 'daily' | 'weekly';

export type SourceHealth = 'ok' | 'empty' | 'failed' | 'stale' | 'missing';

export interface SnapshotRow {
  catalog_id: string;
  media_type: string;
  variant: string;
  item_count: number;
  error: string | null;
  fetched_at: string;
}

export interface SourceRow {
  key: string;
  origin: 'catalog' | 'provider';
  folderId: string;
  catalogId: string;
  mediaType: string | null;
  genre: string | null;
  kind: SourceKind;
  refresh: RefreshTier;
  health: SourceHealth;
  itemCount: number | null;
  fetchedAt: string | null;
  error: string | null;
}

export const KIND_LABEL: Record<SourceKind, string> = {
  'tmdb-filter': 'TMDB filter',
  'tmdb-collection': 'TMDB collection',
  trakt: 'Trakt',
  mdblist: 'MDBList',
  copy: 'Copy',
  unresolved: 'Needs an add-on',
};

export const REFRESH_LABEL: Record<RefreshTier, string> = {
  none: 'Live',
  cache: 'Server cache',
  daily: 'Daily',
  weekly: 'Weekly',
};

/**
 * Same rule the bridge uses to schedule copied lists (see `isDailyTarget` in
 * the bridge's materialize-catalogs). The bridge matches on the addon's own
 * list name; the portal only knows the folder name and the id, so this is an
 * estimate for display, not a control.
 */
export function isDailyTarget(catalogId: string, name: string): boolean {
  if (catalogId.startsWith('elcinema-curated-person')) return false;
  return /latest|top ?10|top ?50|popular|now playing|box office|today/i.test(name);
}

const HOUR = 3_600_000;

export function snapshotKey(catalogId: string, mediaType: string | null, genre: string | null): string {
  return `${catalogId}|${mediaType ?? ''}|${genre ?? ''}`;
}

export function classifyCatalogId(
  catalogId: string,
  hasFilterParams: boolean,
  hasSnapshot: boolean,
): SourceKind {
  if (hasFilterParams) return 'tmdb-filter';
  if (catalogId.startsWith('tmdb.collection.')) return 'tmdb-collection';
  if (catalogId.startsWith('tmdb.')) return 'tmdb-filter';
  if (catalogId.startsWith('trakt.')) return 'trakt';
  if (catalogId.startsWith('mdblist.')) return 'mdblist';
  return hasSnapshot ? 'copy' : 'unresolved';
}

function refreshFor(kind: SourceKind, catalogId: string, folderName: string): RefreshTier {
  switch (kind) {
    case 'tmdb-filter':
    case 'tmdb-collection':
      return 'none';
    case 'trakt':
    case 'mdblist':
      return 'cache';
    case 'copy':
      return isDailyTarget(catalogId, folderName) ? 'daily' : 'weekly';
    case 'unresolved':
      return 'none';
  }
}

export function healthFor(
  kind: SourceKind,
  refresh: RefreshTier,
  snapshot: SnapshotRow | undefined,
  now: number,
): SourceHealth {
  if (kind === 'unresolved') return 'missing';
  if (kind !== 'copy') return 'ok';
  if (!snapshot) return 'missing';
  if (snapshot.item_count === 0) return snapshot.error ? 'failed' : 'empty';
  const age = now - new Date(snapshot.fetched_at).getTime();
  const limit = (refresh === 'daily' ? 48 : 14 * 24) * HOUR;
  return age > limit ? 'stale' : 'ok';
}

export function buildSourceRows(input: {
  catalogs: FolderCatalog[];
  sources: FolderSource[];
  snapshots: SnapshotRow[];
  folderName: (folderId: string) => string;
  now?: number;
}): SourceRow[] {
  const now = input.now ?? Date.now();
  const snaps = new Map<string, SnapshotRow>();
  for (const s of input.snapshots) snaps.set(snapshotKey(s.catalog_id, s.media_type, s.variant || null), s);

  const rows: SourceRow[] = [];
  for (const c of input.catalogs) {
    const snap = snaps.get(snapshotKey(c.catalog_id, c.media_type, c.genre));
    const kind = classifyCatalogId(c.catalog_id, c.filter_params != null, snap != null);
    const refresh = refreshFor(kind, c.catalog_id, input.folderName(c.folder_id));
    rows.push({
      key: `c:${c.id}`,
      origin: 'catalog',
      folderId: c.folder_id,
      catalogId: c.catalog_id,
      mediaType: c.media_type,
      genre: c.genre,
      kind,
      refresh,
      health: healthFor(kind, refresh, snap, now),
      itemCount: kind === 'copy' && snap ? snap.item_count : null,
      fetchedAt: kind === 'copy' && snap ? snap.fetched_at : null,
      error: kind === 'copy' && snap ? snap.error : null,
    });
  }
  for (const s of input.sources) {
    const kind = classifyCatalogId(s.provider, false, false);
    rows.push({
      key: `s:${s.id}`,
      origin: 'provider',
      folderId: s.folder_id,
      catalogId: s.provider,
      mediaType: s.media_type,
      genre: null,
      kind: kind === 'unresolved' ? 'tmdb-collection' : kind,
      refresh: kind === 'trakt' || kind === 'mdblist' ? 'cache' : 'none',
      health: 'ok',
      itemCount: null,
      fetchedAt: null,
      error: null,
    });
  }
  return rows;
}

export function summarize(rows: SourceRow[]): {
  total: number;
  byKind: Record<SourceKind, number>;
  byHealth: Record<SourceHealth, number>;
} {
  const byKind: Record<SourceKind, number> = {
    'tmdb-filter': 0, 'tmdb-collection': 0, trakt: 0, mdblist: 0, copy: 0, unresolved: 0,
  };
  const byHealth: Record<SourceHealth, number> = { ok: 0, empty: 0, failed: 0, stale: 0, missing: 0 };
  for (const r of rows) {
    byKind[r.kind]++;
    byHealth[r.health]++;
  }
  return { total: rows.length, byKind, byHealth };
}
