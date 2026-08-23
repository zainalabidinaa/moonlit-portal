import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

import {
  listPersonalCollections,
  createPersonalCollection,
  addCatalogSource,
} from './personalCollections';

/** Minimal chainable stub of the supabase query builder. */
function builder(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'eq', 'order', 'delete']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return chain;
}

beforeEach(() => { mockFrom.mockReset(); });

describe('listPersonalCollections', () => {
  it('filters to the given profile only', async () => {
    const chain = builder({ data: [{ id: 'c1', name: 'Mine' }], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await listPersonalCollections('profile-1');

    expect(mockFrom).toHaveBeenCalledWith('collections');
    expect(chain.eq).toHaveBeenCalledWith('owner_profile_id', 'profile-1');
    expect(result).toEqual([{ id: 'c1', name: 'Mine' }]);
  });

  it('returns [] when the query errors', async () => {
    mockFrom.mockReturnValue(builder({ data: null, error: { message: 'nope' } }));
    expect(await listPersonalCollections('profile-1')).toEqual([]);
  });
});

describe('createPersonalCollection', () => {
  it('stamps owner_profile_id on insert', async () => {
    const chain = builder({ data: { id: 'c2' }, error: null });
    mockFrom.mockReturnValue(chain);

    await createPersonalCollection('profile-1', 'My Stuff', 0);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_profile_id: 'profile-1', name: 'My Stuff' }),
    );
  });
});

describe('addCatalogSource', () => {
  it('persists addon_id alongside catalog_id', async () => {
    const chain = builder({ data: { id: 'fc1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await addCatalogSource({
      folderId: 'f1', catalogId: 'mdblist.2194', mediaType: 'series',
      genre: null, addonId: 'addon-9',
    });

    expect(chain.insert).toHaveBeenCalledWith({
      folder_id: 'f1',
      catalog_id: 'mdblist.2194',
      media_type: 'series',
      genre: null,
      addon_id: 'addon-9',
    });
  });
});
