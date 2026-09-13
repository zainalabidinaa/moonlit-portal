import { supabase } from './supabase';
import type { Collection, Folder, HomePresetItem } from '../types';
import type { WidgetTab } from '../components/catalog/WidgetGrid';

/** Mirrors `WidgetGrid.TAB_FLAG` — a collection only renders as a preset
 *  widget in a tab it is visible in, so a split child enables the tab its
 *  widget lands on. */
const TAB_FLAGS: Record<WidgetTab, { ios: string; mac: string }> = {
  home: { ios: 'show_ios_home', mac: 'show_mac_home' },
  movies: { ios: 'show_ios_movies', mac: 'show_mac_movies' },
  series: { ios: 'show_ios_series', mac: 'show_mac_series' },
};

export interface SplitOutcome {
  collections: Collection[];
  folders: Folder[];
  items: HomePresetItem[];
  errors: string[];
}

/**
 * "Split folders" — each chosen folder becomes a **standalone widget**: a new
 * collection containing a copy of that folder and all of its sources, plus a
 * preset item pointing at it. This is deliberately not a folder-scoped view
 * of the original collection (that still showed "Part of <original>" in the
 * editor and inherited the original's name in the app): the new widget has
 * its own root — tabs, publish state, rename, reuse — and editing its sources
 * can never touch the original.
 */
export async function splitFoldersIntoStandaloneWidgets(opts: {
  folders: Folder[];
  presetId: string;
  tab: WidgetTab;
  /** The original preset item — style/media type carry over, and its id
   *  seeds each child's stable `source_widget_id`. */
  template: HomePresetItem;
  baseCollectionSortOrder: number;
  baseItemSortOrder: number;
}): Promise<SplitOutcome> {
  const out: SplitOutcome = { collections: [], folders: [], items: [], errors: [] };
  const folderIds = opts.folders.map((f) => f.id);

  // Every source row for the chosen folders, fetched once.
  const [{ data: allCats }, { data: allSrcs }] = await Promise.all([
    supabase.from('folder_catalogs').select('*').in('folder_id', folderIds),
    supabase.from('folder_sources').select('*').in('folder_id', folderIds),
  ]);

  for (const [index, folder] of opts.folders.entries()) {
    const { data: col, error: colErr } = await supabase.from('collections').insert({
      name: folder.name,
      view_mode: 'FOLLOW_LAYOUT',
      status: 'published',
      sort_order: opts.baseCollectionSortOrder + index,
      [TAB_FLAGS[opts.tab].ios]: true,
      [TAB_FLAGS[opts.tab].mac]: true,
    }).select().single();
    if (colErr || !col) {
      out.errors.push(`${folder.name}: ${colErr?.message ?? 'collection insert failed'}`);
      continue;
    }

    const { data: newFolder, error: folderErr } = await supabase.from('folders').insert({
      collection_id: col.id,
      name: folder.name,
      sort_order: 0,
      cover_image: folder.cover_image,
      focus_gif: folder.focus_gif,
      title_logo: folder.title_logo,
      hero_backdrop: folder.hero_backdrop,
      hero_video_url: folder.hero_video_url,
      hide_title: folder.hide_title,
      tile_shape: folder.tile_shape,
      focus_gif_enabled: folder.focus_gif_enabled,
      source_rows: folder.source_rows,
      enabled: true,
    }).select().single();
    if (folderErr || !newFolder) {
      out.errors.push(`${folder.name}: ${folderErr?.message ?? 'folder insert failed'}`);
      continue;
    }

    // Copy every source column verbatim (minus identity) so a folder built
    // from filter_params, genres, raw providers, etc. behaves identically.
    const catRows = (allCats ?? [])
      .filter((c) => c.folder_id === folder.id)
      .map(({ id: _id, folder_id: _folderId, created_at: _createdAt, ...rest }) => ({
        folder_id: newFolder.id,
        ...rest,
      }));
    if (catRows.length) {
      const { error } = await supabase.from('folder_catalogs').insert(catRows);
      if (error) out.errors.push(`${folder.name} catalogs: ${error.message}`);
    }
    const srcRows = (allSrcs ?? [])
      .filter((s) => s.folder_id === folder.id)
      .map(({ id: _id, folder_id: _folderId, created_at: _createdAt, ...rest }) => ({
        folder_id: newFolder.id,
        ...rest,
      }));
    if (srcRows.length) {
      const { error } = await supabase.from('folder_sources').insert(srcRows);
      if (error) out.errors.push(`${folder.name} sources: ${error.message}`);
    }

    // A single-folder collection resolves straight to its folder's content
    // row, so no `folder_ids` selection is needed — and the card shows no
    // folder controls, which is the point of a standalone child.
    const { data: item, error: itemErr } = await supabase.from('home_preset_items').insert({
      preset_id: opts.presetId,
      tab: opts.tab,
      data_source: { kind: 'collection', collectionId: col.id },
      media_type: opts.template.media_type,
      style: opts.template.style,
      sort_order: opts.baseItemSortOrder + index,
      title: folder.name,
      source_widget_id: `${opts.template.source_widget_id ?? opts.template.id}:folder:${folder.id}:widget`,
    }).select().single();
    if (itemErr || !item) {
      out.errors.push(`${folder.name}: ${itemErr?.message ?? 'preset item insert failed'}`);
      continue;
    }

    out.collections.push(col as Collection);
    out.folders.push(newFolder as Folder);
    out.items.push(item as HomePresetItem);
  }

  return out;
}
