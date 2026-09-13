import { describe, expect, it } from 'vitest';
import { collectionsToTrees, parseCollectionsProfile } from './nuvioCollections';

/** One collection modelled on the real Nuvio profile
 *  (`nuvio-collections-profile-2-2026-09-13.json`): an addon catalog, a
 *  Trakt list, a TMDB discover folder, an unaddressable source, and a folder
 *  with no usable sources at all. */
const PROFILE = [
  {
    id: 'collection-17e5aab0',
    title: 'Trending Shows',
    folders: [
      {
        id: 'folder-1',
        title: 'Trending',
        tileShape: 'POSTER',
        heroBackdropUrl: 'https://example.com/hero.jpg',
        sources: [
          { type: 'series', genre: 'None', provider: 'addon', addonId: 'aio-metadata', catalogId: 'tmdb.trending_series' },
          { type: 'series', genre: 'Day', provider: 'addon', addonId: 'aio-metadata', catalogId: 'mdblist.3882' },
          { mediaType: 'TV', provider: 'trakt', traktListId: 33032835, title: 'Trending Anime Shows' },
          {
            title: 'Anime Movies',
            provider: 'tmdb',
            type: 'movie',
            sortBy: 'primary_release_date.desc',
            tmdbId: 0,
            filters: {
              year: null,
              withGenres: '16',
              watchRegion: null,
              voteCountGte: 5,
              voteAverageGte: 0,
              withOriginalLanguage: 'ja',
              releaseDateGte: null,
            },
          },
          {},
        ],
      },
      { id: 'folder-2', title: 'Empty', sources: [{}] },
    ],
    pinToTop: false,
    viewMode: 'FOLLOW_LAYOUT',
    showAllTab: false,
    backdropImageUrl: null,
  },
];

describe('parseCollectionsProfile', () => {
  it('accepts a Nuvio/Moonlit collections array', () => {
    expect(parseCollectionsProfile(JSON.stringify(PROFILE))).toHaveLength(1);
  });

  it('rejects widget exports, empty arrays and bad JSON', () => {
    expect(() => parseCollectionsProfile(JSON.stringify([{ id: 'w', dataSource: { kind: 'collection' } }])))
      .toThrow(/collections profile/);
    expect(() => parseCollectionsProfile('[]')).toThrow(/non-empty/);
    expect(() => parseCollectionsProfile('{oops')).toThrow(/not valid JSON/);
  });
});

describe('collectionsToTrees', () => {
  it('maps a profile onto syncable collection trees', () => {
    const { trees, skippedSources } = collectionsToTrees(PROFILE);

    expect(skippedSources).toBe(2); // the `{}` in folder-1 and the one in folder-2
    expect(trees).toHaveLength(1);

    const tree = trees[0];
    expect(tree.externalId).toBe('collection-17e5aab0');
    expect(tree.presetSourceId).toBe('nuvio:collection-17e5aab0');
    expect(tree.name).toBe('Trending Shows');
    expect(tree.backdropImage).toBe('https://example.com/hero.jpg');
    expect(tree.folders).toHaveLength(1); // the source-less folder is dropped

    const folder = tree.folders[0];
    expect(folder).toMatchObject({
      externalId: 'folder-1',
      name: 'Trending',
      tileShape: 'poster',
      heroBackdrop: 'https://example.com/hero.jpg',
    });
    expect(folder.sources).toEqual([
      { kind: 'catalog', catalogId: 'tmdb.trending_series', mediaType: 'series', genre: null },
      { kind: 'catalog', catalogId: 'mdblist.3882', mediaType: 'series', genre: 'Day' },
      { kind: 'catalog', catalogId: 'trakt.list.33032835', mediaType: 'series', genre: null },
      {
        kind: 'catalog',
        catalogId: 'tmdb.discover.custom.anime-movies',
        mediaType: 'movie',
        filterParams: {
          sort_by: 'primary_release_date.desc',
          with_genres: '16',
          'vote_count.gte': '5',
          with_original_language: 'ja',
        },
      },
    ]);
  });

  it('uses TMDB tv date params for series discover folders', () => {
    const { trees } = collectionsToTrees([
      {
        id: 'c1',
        title: 'Shows',
        folders: [
          {
            id: 'f1',
            title: 'Recent',
            sources: [
              { title: 'Recent Shows', provider: 'tmdb', mediaType: 'TV', filters: { releaseDateGte: '2026-01-01' } },
            ],
          },
        ],
      },
    ]);
    expect(trees[0].folders[0].sources[0]).toMatchObject({
      kind: 'catalog',
      catalogId: 'tmdb.discover.custom.recent-shows',
      mediaType: 'series',
      filterParams: { 'first_air_date.gte': '2026-01-01' },
    });
  });

  it('produces stable identities across runs (re-import syncs, never duplicates)', () => {
    const first = collectionsToTrees(PROFILE).trees[0];
    const second = collectionsToTrees(PROFILE).trees[0];
    expect(first.externalId).toBe(second.externalId);
    expect(first.presetSourceId).toBe(second.presetSourceId);
    expect(first.folders[0].externalId).toBe(second.folders[0].externalId);
  });
});
