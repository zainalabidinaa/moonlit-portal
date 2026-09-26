import { describe, expect, it } from 'vitest';
import { collectionSource, definitionSource, filterSource, listSource } from './addSource';
import { DEFAULT_FILTERING_STATE } from './filteringQuery';

describe('filterSource', () => {
  it('turns a valid state into a filter row with no add-on', () => {
    const r = filterSource({ ...DEFAULT_FILTERING_STATE, genreIds: [28] }, () => 'abc123');
    if ('error' in r) throw new Error(r.error);
    expect(r.row.catalog_id).toBe('tmdb.discover.custom.abc123');
    expect(r.row.filter_params?.with_genres).toBe('28');
    expect(r.row.media_type).toBe(DEFAULT_FILTERING_STATE.mediaKind);
  });
});

describe('definitionSource', () => {
  it('copies TMDB params as strings', () => {
    const r = definitionSource({ id: 'top-drama', media_type: 'movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 300, with_genres: '18' } });
    if ('error' in r) throw new Error(r.error);
    expect(r.row.catalog_id).toBe('tmdb.discover.moonlit.top-drama');
    expect(r.row.filter_params).toEqual({ sort_by: 'vote_average.desc', 'vote_count.gte': '300', with_genres: '18' });
  });

  it('refuses a list without settings or media type', () => {
    expect('error' in definitionSource({ id: 'x', media_type: 'movie', params: {} })).toBe(true);
    expect('error' in definitionSource({ id: 'x', media_type: 'music', params: { a: 1 } })).toBe(true);
  });
});

describe('collectionSource', () => {
  it('accepts a number and rejects anything else', () => {
    expect(collectionSource(' 295 ')).toEqual({ row: { catalog_id: 'tmdb.collection.295', media_type: 'movie', genre: null, filter_params: null } });
    expect('error' in collectionSource('john wick')).toBe(true);
    expect('error' in collectionSource('')).toBe(true);
  });
});

describe('listSource', () => {
  it('builds the ids the apps already read', () => {
    expect(listSource('trakt', '21779826', 'series')).toEqual({ row: { catalog_id: 'trakt.list.21779826', media_type: 'series', genre: null, filter_params: null } });
    expect(listSource('mdblist', '3882', 'movie')).toEqual({ row: { catalog_id: 'mdblist.3882', media_type: 'movie', genre: null, filter_params: null } });
  });

  it('rejects a non-numeric list id', () => {
    expect('error' in listSource('trakt', 'my-list', 'movie')).toBe(true);
  });
});
