import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { encodeWidget, normalizeWidget, widgetCollectionId, widgetsFromPresetItems } from './homeWidgets';
import type { HomePresetItem } from '../types';

describe('homeWidgets', () => {
  it('fills the defaults HomeWidget’s Swift decoder applies to older rows', () => {
    const w = normalizeWidget({ id: 'A', dataSource: { kind: 'watchlist' } } as never);
    expect(w).toMatchObject({ style: 'standard', isHidden: false, tabs: ['home'], expandFolders: false, genreHub: false, sourceArt: false });
  });

  it('omits nil optionals like the synthesized Swift encoder', () => {
    const encoded = encodeWidget(normalizeWidget({ id: 'A', dataSource: { kind: 'browseHub', hub: 'genre' } } as never));
    expect(Object.keys(encoded).sort()).toEqual(['dataSource', 'expandFolders', 'genreHub', 'id', 'isHidden', 'sourceArt', 'style', 'tabs']);
    expect(encoded.dataSource).toEqual({ kind: 'browseHub', hub: 'genre' });
  });

  it('keeps title, media type and folder selection when set', () => {
    const encoded = encodeWidget(normalizeWidget({ id: 'A', title: 'Horror', mediaType: 'movie', folderIds: ['f1'], dataSource: { kind: 'collection', collectionId: 'c1' } } as never));
    expect(encoded).toMatchObject({ title: 'Horror', mediaType: 'movie', folderIds: ['f1'] });
  });

  it('strips the app’s collection_ row prefix when resolving a collection id', () => {
    expect(widgetCollectionId(normalizeWidget({ dataSource: { kind: 'collection', collectionId: 'collection_abc' } } as never))).toBe('abc');
    expect(widgetCollectionId(normalizeWidget({ dataSource: { kind: 'collection', collectionId: 'abc' } } as never))).toBe('abc');
    expect(widgetCollectionId(normalizeWidget({ dataSource: { kind: 'watchlist' } } as never))).toBeNull();
  });

  it('copies preset items into an ordered personal layout with fresh ids', () => {
    const items = [
      { id: 'i2', preset_id: 'p', tab: 'movies', data_source: { kind: 'filtering', query: 'sort_by=popularity.desc' }, media_type: 'movie', style: 'heroBanner', sort_order: 2, title: 'Popular' },
      { id: 'i1', preset_id: 'p', tab: 'home', data_source: { kind: 'collection', collectionId: 'c1' }, media_type: null, style: 'standard', sort_order: 1, expand_folders: true, folder_ids: ['f1'], genre_hub: false, source_art: false },
    ] as HomePresetItem[];
    const widgets = widgetsFromPresetItems(items);
    expect(widgets.map((w) => w.tabs[0])).toEqual(['home', 'movies']);
    expect(widgets[0]).toMatchObject({ dataSource: { kind: 'collection', collectionId: 'c1' }, expandFolders: true, folderIds: ['f1'] });
    expect(widgets[1]).toMatchObject({ title: 'Popular', mediaType: 'movie', style: 'heroBanner' });
    expect(new Set(widgets.map((w) => w.id)).size).toBe(2);
    expect(widgets.every((w) => w.id !== 'i1' && w.id !== 'i2')).toBe(true);
  });
});
