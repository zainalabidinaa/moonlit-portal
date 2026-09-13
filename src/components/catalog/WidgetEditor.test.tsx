import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

/**
 * Renders the widget editor against the exact shapes the Nuvio import
 * produces (collection copied from `collections`, six folders from
 * `folders`, one `folder_catalogs` row each) — imported widgets are how the
 * "can't open any folder" reports started, and this catches a render crash
 * that would otherwise be a silent blank page in the browser.
 */
const subtree = vi.hoisted(() => {
  const collection = {
    id: 'ebce0afb-fecd-4e5f-9cb5-e3311d2d1884',
    name: "Everyone's Watching",
    status: 'published',
    view_mode: 'TABBED_GRID',
    show_ios_home: true,
    show_ios_movies: false,
    show_ios_series: false,
    show_mac_home: true,
    show_mac_movies: false,
    show_mac_series: false,
    show_on_home: true,
    show_all_tab: false,
    pin_to_top: true,
    backdrop_image: null,
    display_section: null,
    focus_glow_enabled: true,
    sort_order: 133,
    parent_collection_id: null,
    parent_folder_id: null,
    enabled: true,
    external_id: 'collection-6cf19756-community-2',
  };
  const names = ['Trending Anime', 'Trending Movies', 'Trending Shows', 'Latest Anime', 'Latest Movies', 'Latest Shows'];
  const ids = [
    '1734941e-3872-4814-9f6d-57cd78a9285a',
    '35b0c6c2-3ef4-4b1d-8e58-ef3730814c4c',
    '21296b42-9aea-428f-8ad5-62895f0b228b',
    '071a897c-d8d9-449e-83cc-feeb09d0d082',
    '734189a1-daee-460c-b539-ce5a5a9894d7',
    '1c6b760f-cc81-413d-8510-1a7a94c1b418',
  ];
  const folders = names.map((name, i) => ({
    id: ids[i],
    collection_id: collection.id,
    name,
    sort_order: i,
    cover_image: null,
    focus_gif: null,
    title_logo: null,
    hero_backdrop: null,
    hero_video_url: null,
    hide_title: false,
    tile_shape: 'landscape',
    focus_gif_enabled: false,
    enabled: true,
    genre: null,
    parent_folder_id: null,
    source_rows: false,
  }));
  const catalogsByFolder: Record<string, unknown[]> = {};
  ids.forEach((id, i) => {
    catalogsByFolder[id] = [{
      id: `catalog-${i}`,
      folder_id: id,
      catalog_id: 'aicat_external_149836',
      media_type: 'series',
      genre: null,
      extras: null,
      addon_id: null,
      filter_params: null,
    }];
  });
  return {
    collection,
    folders,
    sourcesByFolder: {} as Record<string, unknown[]>,
    catalogsByFolder,
    loading: false,
    saveCollectionSettings: vi.fn(),
    addFolder: vi.fn(),
    deleteFolder: vi.fn(),
    reorderFolderSiblings: vi.fn(),
    saveFolderArtwork: vi.fn(),
    addSource: vi.fn(),
    deleteSource: vi.fn(),
    addCatalog: vi.fn(),
    deleteCatalog: vi.fn(),
    importFolder: vi.fn(),
  };
});

vi.mock('../../hooks/useCollectionSubtree', () => ({ useCollectionSubtree: () => subtree }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ activeProfile: null }) }));
vi.mock('../../hooks/useAddonManifest', () => ({
  useAllAddonManifests: () => ({ catalogFor: () => null, catalogById: () => null, lookupById: () => null, loadingIds: new Set() }),
}));
vi.mock('../../hooks/useFolderSearch', () => ({ useFolderSearch: () => ({ results: [], loading: false }) }));
vi.mock('../../hooks/useAddonCatalogSearch', () => ({ useAddonCatalogSearch: () => ({ catalogs: [], loading: false }) }));
vi.mock('../../hooks/useFolderPreviewPosters', () => ({
  useFolderPreviewPosters: () => [],
  useFolderTileImage: () => null,
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [] }) }),
        order: async () => ({ data: [] }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  },
}));

import { WidgetEditor } from './WidgetEditor';

describe('WidgetEditor · imported collection', () => {
  it('renders the collection root', () => {
    render(<WidgetEditor collectionId={subtree.collection.id} onBack={() => {}} />);
    expect(screen.getByDisplayValue("Everyone's Watching")).toBeInTheDocument();
  });

  it('renders each imported folder as a tile', () => {
    render(<WidgetEditor collectionId={subtree.collection.id} onBack={() => {}} />);
    for (const folder of subtree.folders) {
      expect(screen.getAllByText(folder.name).length).toBeGreaterThan(0);
    }
  });

  it('renders drilled into one folder (split child)', () => {
    render(
      <WidgetEditor
        collectionId={subtree.collection.id}
        initialFolderId={subtree.folders[0].id}
        onBack={() => {}}
      />
    );
    expect(screen.getByText(/Part of/)).toBeInTheDocument();
    expect(screen.getAllByText('Trending Anime').length).toBeGreaterThan(0);
  });
});
