import { describe, expect, it } from 'vitest';
import { buildOrganizerPayload } from './organizer';

const collection = {
  id: 'genre', name: 'Genre', sort_order: 0, enabled: true,
};

const horror = {
  id: 'horror', collection_id: 'genre', name: 'Horror', sort_order: 0,
  parent_folder_id: null, enabled: true,
};

const franchises = {
  id: 'franchises', collection_id: 'genre', name: 'Horror Franchises', sort_order: 0,
  parent_folder_id: 'horror', enabled: true,
};

describe('buildOrganizerPayload', () => {
  it('retains navigation-only folders and serializes their parent ID', () => {
    const payload = buildOrganizerPayload({
      collections: [collection],
      folders: [horror, franchises],
      catalogs: [],
      folderSources: [],
      folderEntries: [{
        parent_folder_id: 'horror', entry_kind: 'folder', folder_id: 'franchises',
        folder_catalog_id: null, folder_source_id: null, sort_order: 0,
      }],
    });

    expect(payload[0].folders.find((folder) => folder.id === 'horror')).toMatchObject({ parentFolderId: null });
    expect(payload[0].folders.find((folder) => folder.id === 'franchises')).toMatchObject({ parentFolderId: 'horror', sources: [] });
  });

  it('serializes mixed entries in parent and portal sort order', () => {
    const mood = {
      id: 'mood', collection_id: 'genre', name: 'Horror Mood & Vibe', sort_order: 1,
      parent_folder_id: 'horror', enabled: true,
    };
    const payload = buildOrganizerPayload({
      collections: [collection],
      folders: [horror, franchises, mood],
      catalogs: [{ id: 'catalog', folder_id: 'horror', media_type: 'movie', genre: null, catalog_id: 'popular' }],
      folderSources: [],
      folderEntries: [
        { parent_folder_id: 'horror', entry_kind: 'folder', folder_id: 'franchises', folder_catalog_id: null, folder_source_id: null, sort_order: 2 },
        { parent_folder_id: 'horror', entry_kind: 'catalog', folder_id: null, folder_catalog_id: 'catalog', folder_source_id: null, sort_order: 1 },
        { parent_folder_id: 'horror', entry_kind: 'folder', folder_id: 'mood', folder_catalog_id: null, folder_source_id: null, sort_order: 0 },
      ],
    });

    expect(payload[0].folderEntries.map((entry) => [entry.entryKind, entry.sortOrder])).toEqual([
      ['folder', 0],
      ['catalog', 1],
      ['folder', 2],
    ]);
  });

  it('sorts entries by parent before their portal order', () => {
    const payload = buildOrganizerPayload({
      collections: [collection], folders: [horror, franchises], catalogs: [], folderSources: [],
      folderEntries: [
        { parent_folder_id: 'horror', entry_kind: 'folder', folder_id: 'franchises', folder_catalog_id: null, folder_source_id: null, sort_order: 0 },
        { parent_folder_id: 'franchises', entry_kind: 'source', folder_id: null, folder_catalog_id: null, folder_source_id: 'source', sort_order: 9 },
      ],
    });

    expect(payload[0].folderEntries.map((entry) => [entry.parentFolderId, entry.sortOrder])).toEqual([
      ['franchises', 9],
      ['horror', 0],
    ]);
  });

  it('preserves the legacy sources payload', () => {
    const payload = buildOrganizerPayload({
      collections: [collection], folders: [horror], folderEntries: [],
      catalogs: [{ id: 'catalog', folder_id: 'horror', media_type: 'movie', genre: 'Horror', catalog_id: 'popular' }],
      folderSources: [{ id: 'source', folder_id: 'horror', media_type: 'series', provider: 'tmdb', tmdb_id: '99', tmdb_source_type: 'LIST', sort_order: 0 }],
    });

    expect(payload[0].folders[0].sources).toEqual([
      { type: 'movie', genre: 'Horror', addonId: 'aio-metadata', provider: 'addon', catalogId: 'popular' },
      { type: 'series', genre: 'None', title: '', provider: 'tmdb', tmdbId: '99', tmdbSourceType: 'LIST' },
    ]);
  });
});
