import { describe, expect, it } from 'vitest';
import {
  buildSourceRows,
  classifyCatalogId,
  healthFor,
  isDailyTarget,
  snapshotKey,
  summarize,
  type SnapshotRow,
} from './catalogSources';
import type { FolderCatalog, FolderSource } from '../types';

const NOW = Date.parse('2026-09-27T12:00:00Z');

function snap(over: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    catalog_id: 'streaming_netflix_movies',
    media_type: 'movie',
    variant: '',
    item_count: 40,
    error: null,
    fetched_at: '2026-09-27T06:00:00Z',
    ...over,
  };
}

function catalog(over: Partial<FolderCatalog>): FolderCatalog {
  return {
    id: 'c1', folder_id: 'f1', catalog_id: 'x', media_type: 'movie',
    genre: null, extras: null, addon_id: null, filter_params: null,
    ...over,
  } as FolderCatalog;
}

describe('isDailyTarget (mirrors the bridge rule)', () => {
  // These four cases are copied from bridge/tests/materialize-catalogs.test.ts.
  it('matches the bridge for its own cases', () => {
    expect(isDailyTarget('streaming_netflix_movies', 'Netflix')).toBe(false);
    expect(isDailyTarget('snoak_latest_netflix_movies', 'Latest Netflix')).toBe(true);
    expect(isDailyTarget('elcinema-curated-person-1-movie', 'أحمد داش · أفلام')).toBe(false);
    expect(isDailyTarget('elcinema-now-playing', 'elCinema · Now Playing')).toBe(true);
  });

  it('never treats actor pages as daily, even with a ranking-like name', () => {
    expect(isDailyTarget('elcinema-curated-person-9-movie', 'Top 10 Popular')).toBe(false);
  });
});

describe('classifyCatalogId', () => {
  it('reads the kind from filters and id prefixes', () => {
    expect(classifyCatalogId('tmdb.discover.custom.x', true, false)).toBe('tmdb-filter');
    expect(classifyCatalogId('tmdb.collection.295', false, false)).toBe('tmdb-collection');
    expect(classifyCatalogId('tmdb.something', false, false)).toBe('tmdb-filter');
    expect(classifyCatalogId('trakt.list.21779826', false, false)).toBe('trakt');
    expect(classifyCatalogId('mdblist.3882', false, false)).toBe('mdblist');
  });

  it('is a copy only when a snapshot exists, otherwise it needs an add-on', () => {
    expect(classifyCatalogId('aicat_top', false, true)).toBe('copy');
    expect(classifyCatalogId('aicat_top', false, false)).toBe('unresolved');
  });

  it('lets a filter win over the id prefix', () => {
    expect(classifyCatalogId('mdblist.1', true, false)).toBe('tmdb-filter');
  });
});

describe('healthFor', () => {
  it('is ok for a fresh copy', () => {
    expect(healthFor('copy', 'daily', snap(), NOW)).toBe('ok');
  });

  it('separates empty from failed by the recorded error', () => {
    expect(healthFor('copy', 'weekly', snap({ item_count: 0 }), NOW)).toBe('empty');
    expect(healthFor('copy', 'weekly', snap({ item_count: 0, error: 'timeout' }), NOW)).toBe('failed');
  });

  it('marks a daily copy stale after 48h and a weekly one after 14 days', () => {
    expect(healthFor('copy', 'daily', snap({ fetched_at: '2026-09-25T00:00:00Z' }), NOW)).toBe('stale');
    expect(healthFor('copy', 'weekly', snap({ fetched_at: '2026-09-20T00:00:00Z' }), NOW)).toBe('ok');
    expect(healthFor('copy', 'weekly', snap({ fetched_at: '2026-09-10T00:00:00Z' }), NOW)).toBe('stale');
  });

  it('treats a copy with no snapshot, and any unresolved source, as missing', () => {
    expect(healthFor('copy', 'weekly', undefined, NOW)).toBe('missing');
    expect(healthFor('unresolved', 'none', undefined, NOW)).toBe('missing');
  });

  it('does not judge native sources', () => {
    expect(healthFor('tmdb-filter', 'none', undefined, NOW)).toBe('ok');
    expect(healthFor('trakt', 'cache', undefined, NOW)).toBe('ok');
  });
});

describe('buildSourceRows', () => {
  it('joins snapshots by id, media type and genre variant', () => {
    const rows = buildSourceRows({
      catalogs: [
        catalog({ id: 'a', catalog_id: 'aicat_top', genre: 'Drama' }),
        catalog({ id: 'b', catalog_id: 'aicat_top', genre: 'Comedy' }),
      ],
      sources: [],
      snapshots: [{ ...snap({ catalog_id: 'aicat_top', variant: 'Drama' }) }],
      folderName: () => 'Latest picks',
      now: NOW,
    });
    expect(rows[0].kind).toBe('copy');
    expect(rows[0].itemCount).toBe(40);
    expect(rows[0].refresh).toBe('daily');
    expect(rows[1].kind).toBe('unresolved');
    expect(rows[1].health).toBe('missing');
  });

  it('includes folder provider sources and summarizes everything', () => {
    const sources: FolderSource[] = [
      { id: 's1', folder_id: 'f1', provider: 'tmdb.collection.10', title: null, tmdb_id: null, media_type: 'movie', sort_order: 0 },
      { id: 's2', folder_id: 'f1', provider: 'mdblist.55', title: null, tmdb_id: null, media_type: 'movie', sort_order: 1 },
    ];
    const rows = buildSourceRows({
      catalogs: [catalog({ id: 'a', catalog_id: 'trakt.list.1' })],
      sources,
      snapshots: [],
      folderName: () => 'x',
      now: NOW,
    });
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.byKind.trakt).toBe(1);
    expect(s.byKind['tmdb-collection']).toBe(1);
    expect(s.byKind.mdblist).toBe(1);
  });

  it('builds the same snapshot key the bridge writes (variant is empty for no genre)', () => {
    expect(snapshotKey('x', 'movie', null)).toBe('x|movie|');
    expect(snapshotKey('x', 'movie', 'Drama')).toBe('x|movie|Drama');
  });
});
