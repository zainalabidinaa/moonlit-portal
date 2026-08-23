import { describe, it, expect } from 'vitest';
import { catalogUrlFor } from './useCatalogPreview';

describe('catalogUrlFor', () => {
  it('swaps manifest.json for the catalog path', () => {
    expect(
      catalogUrlFor('https://example.com/stremio/abc/manifest.json', 'series', 'mdblist.2194'),
    ).toBe('https://example.com/stremio/abc/catalog/series/mdblist.2194.json');
  });

  it('handles an addon url with no trailing manifest.json', () => {
    expect(catalogUrlFor('https://example.com/stremio/abc', 'movie', 'top')).toBe(
      'https://example.com/stremio/abc/catalog/movie/top.json',
    );
  });

  it('strips a trailing slash before appending', () => {
    expect(catalogUrlFor('https://example.com/abc/', 'movie', 'top')).toBe(
      'https://example.com/abc/catalog/movie/top.json',
    );
  });
});
