import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAddonManifest, manifestToCollectionTrees } from './addonCatalogWidgets';

const MANIFEST = {
  id: 'community.elcinema.metadata',
  name: 'ArabCinemeta',
  catalogs: [
    { type: 'movie', id: 'elcinema-now', name: 'elCinema · Now Playing' },
    { type: 'movie', id: 'elcinema-boxoffice', name: 'elCinema · Box Office' },
    { type: 'series', id: 'watchit-series', name: 'WATCH IT · Shows' },
    { type: 'movie', id: 'elcinema-search-movies', name: 'elCinema · Movie Search', extra: [{ name: 'search', isRequired: true }] },
    { type: 'movie', id: 'loose', name: 'Loose Catalog' },
    { type: 'movie' }, // missing id — skipped entirely
  ],
};

function mockFetch(impl: (url: string) => Promise<Partial<Response>> | Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => impl(String(input))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAddonManifest', () => {
  it('keeps id/name, marks search-required catalogs, drops malformed ones', async () => {
    mockFetch(() => ({ ok: true, json: async () => MANIFEST }));
    const manifest = await fetchAddonManifest('https://example.com/manifest.json');
    expect(manifest.id).toBe('community.elcinema.metadata');
    expect(manifest.name).toBe('ArabCinemeta');
    expect(manifest.catalogs.map((c) => c.id)).toEqual([
      'elcinema-now', 'elcinema-boxoffice', 'watchit-series', 'elcinema-search-movies', 'loose',
    ]);
    expect(manifest.catalogs.find((c) => c.id === 'elcinema-search-movies')?.searchRequired).toBe(true);
  });

  it('names the HTTP and network failure modes', async () => {
    mockFetch(() => ({ ok: false, status: 404 }));
    await expect(fetchAddonManifest('https://example.com/manifest.json')).rejects.toThrow('HTTP 404');

    mockFetch(() => { throw new Error('blocked'); });
    await expect(fetchAddonManifest('https://example.com/manifest.json')).rejects.toThrow(/block browser fetches/);
  });
});

describe('manifestToCollectionTrees', () => {
  it('groups catalogs by their name prefix into one widget per provider', () => {
    const manifest = {
      id: 'community.elcinema.metadata',
      name: 'ArabCinemeta',
      catalogs: [
        { id: 'elcinema-now', type: 'movie', name: 'elCinema · Now Playing', searchRequired: false },
        { id: 'elcinema-boxoffice', type: 'movie', name: 'elCinema · Box Office', searchRequired: false },
        { id: 'watchit-series', type: 'series', name: 'WATCH IT · Shows', searchRequired: false },
        { id: 'loose', type: 'movie', name: 'Loose Catalog', searchRequired: false },
      ],
    };
    const { trees, skipped } = manifestToCollectionTrees(manifest);

    expect(skipped).toEqual([]);
    expect(trees.map((t) => [t.name, t.folders.map((f) => f.name)])).toEqual([
      ['elCinema', ['Now Playing', 'Box Office']],
      ['WATCH IT', ['Shows']],
      ['ArabCinemeta', ['Loose Catalog']],
    ]);

    const first = trees[0];
    expect(first.externalId).toBe('addon:community.elcinema.metadata:group:elCinema');
    expect(first.presetSourceId).toBe('addon:community.elcinema.metadata:group:elCinema');
    expect(first.folders[0]).toMatchObject({
      externalId: 'addon:community.elcinema.metadata:group:elCinema:movie:elcinema-now',
      tileShape: 'landscape',
      sources: [{ kind: 'catalog', catalogId: 'elcinema-now', mediaType: 'movie', genre: null }],
    });
  });

  it('skips catalogs that cannot render without a search term', () => {
    const manifest = {
      id: 'addon-id',
      name: 'Add-on',
      catalogs: [
        { id: 'top', type: 'movie', name: 'Add-on · Top', searchRequired: false },
        { id: 'search-movies', type: 'movie', name: 'Add-on · Search', searchRequired: true },
      ],
    };
    const { trees, skipped } = manifestToCollectionTrees(manifest);
    expect(skipped).toEqual(['Add-on · Search']);
    expect(trees).toHaveLength(1);
    expect(trees[0].folders.map((f) => f.name)).toEqual(['Top']);
  });

  it('produces stable identities across runs (re-import syncs, never duplicates)', () => {
    const manifest = {
      id: 'addon-id',
      name: 'Add-on',
      catalogs: [{ id: 'top', type: 'series', name: 'Provider · Top', searchRequired: false }],
    };
    const first = manifestToCollectionTrees(manifest).trees[0];
    const second = manifestToCollectionTrees(manifest).trees[0];
    expect(first.externalId).toBe(second.externalId);
    expect(first.folders[0].externalId).toBe(second.folders[0].externalId);
  });
});
