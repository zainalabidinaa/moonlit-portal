import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogsToWidgets, fetchAddonManifest } from './addonCatalogWidgets';

const MANIFEST = {
  id: 'app.xperience.1e6dad94',
  name: 'Xperience',
  catalogs: [
    { type: 'movie', id: 'actor_sandler_movies', name: 'Adam Sandler' },
    { type: 'series', id: 'trending_series', name: 'Trending' },
    { type: 'movie', id: 'dup_movies', name: 'First' },
    { type: 'movie', id: 'dup_movies', name: 'Duplicate' },
    { type: 'movie' }, // missing id — skipped
    { id: 'missing_type' }, // missing type — skipped
  ],
};

function mockFetch(impl: (url: string) => Promise<Partial<Response>> | Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => impl(String(input))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAddonManifest', () => {
  it('reads id/name and keeps only well-formed catalogs, deduped', async () => {
    mockFetch(() => ({ ok: true, json: async () => MANIFEST }));
    const manifest = await fetchAddonManifest('https://example.com/manifest.json');
    expect(manifest.id).toBe('app.xperience.1e6dad94');
    expect(manifest.name).toBe('Xperience');
    expect(manifest.catalogs).toEqual([
      { id: 'actor_sandler_movies', type: 'movie', name: 'Adam Sandler' },
      { id: 'trending_series', type: 'series', name: 'Trending' },
      { id: 'dup_movies', type: 'movie', name: 'First' },
    ]);
  });

  it('falls back to the URL when the manifest has no id, and to the catalog id for a missing name', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ catalogs: [{ type: 'movie', id: 'top' }] }) }));
    const manifest = await fetchAddonManifest('https://example.com/manifest.json');
    expect(manifest.id).toBe('https://example.com/manifest.json');
    expect(manifest.name).toBe('Add-on');
    expect(manifest.catalogs).toEqual([{ id: 'top', type: 'movie', name: 'top' }]);
  });

  it('names the HTTP and network failure modes', async () => {
    mockFetch(() => ({ ok: false, status: 404 }));
    await expect(fetchAddonManifest('https://example.com/manifest.json')).rejects.toThrow('HTTP 404');

    mockFetch(() => { throw new Error('blocked'); });
    await expect(fetchAddonManifest('https://example.com/manifest.json')).rejects.toThrow(/block browser fetches/);
  });

  it('rejects non-JSON bodies', async () => {
    mockFetch(() => ({ ok: true, json: async () => { throw new Error('bad json'); } }));
    await expect(fetchAddonManifest('https://example.com/manifest.json')).rejects.toThrow('not valid JSON');
  });
});

describe('catalogsToWidgets', () => {
  it('maps every catalog to an external-catalog widget with a stable source id', () => {
    const widgets = catalogsToWidgets({
      id: 'app.xperience.1e6dad94',
      name: 'Xperience',
      catalogs: [{ id: 'actor_sandler_movies', type: 'movie', name: 'Adam Sandler' }],
    });
    expect(widgets).toEqual([
      {
        title: 'Adam Sandler',
        style: 'standard',
        dataSource: {
          kind: 'addonCatalog',
          addonId: 'app.xperience.1e6dad94',
          catalogId: 'actor_sandler_movies',
          mediaType: 'movie',
        },
        sourceId: 'addon:app.xperience.1e6dad94:movie:actor_sandler_movies',
      },
    ]);
  });

  it('produces the same source id across runs (re-import updates, never duplicates)', () => {
    const manifest = {
      id: 'addon-id',
      name: 'Add-on',
      catalogs: [{ id: 'top', type: 'series', name: 'Top' }],
    };
    const first = catalogsToWidgets(manifest);
    const second = catalogsToWidgets(manifest);
    expect(first[0].sourceId).toBe(second[0].sourceId);
  });
});
