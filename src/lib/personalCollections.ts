import { supabase } from './supabase';
import type { Collection, Folder, FolderCatalog } from '../types';

/** Collections owned by one profile. Shared/admin rows (owner_profile_id NULL)
 *  are deliberately excluded — this module is only the personal surface. */
export async function listPersonalCollections(profileId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('owner_profile_id', profileId)
    .order('sort_order');
  if (error) return [];
  return (data ?? []) as Collection[];
}

export async function createPersonalCollection(
  profileId: string,
  name: string,
  sortOrder: number,
): Promise<Collection | null> {
  const { data, error } = await supabase
    .from('collections')
    .insert({
      name,
      owner_profile_id: profileId,
      view_mode: 'FOLLOW_LAYOUT',
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) return null;
  return data as Collection;
}

export async function deletePersonalCollection(id: string): Promise<void> {
  await supabase.from('collections').delete().eq('id', id);
}

export async function listFolders(collectionId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('collection_id', collectionId)
    .order('sort_order');
  if (error) return [];
  return (data ?? []) as Folder[];
}

export async function createFolder(
  collectionId: string,
  name: string,
  sortOrder: number,
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      collection_id: collectionId,
      name,
      sort_order: sortOrder,
      tile_shape: 'POSTER',
      enabled: true,
    })
    .select()
    .single();
  if (error) return null;
  return data as Folder;
}

export async function deleteFolder(id: string): Promise<void> {
  await supabase.from('folder_catalogs').delete().eq('folder_id', id);
  await supabase.from('folder_sources').delete().eq('folder_id', id);
  await supabase.from('folders').delete().eq('id', id);
}

export async function listCatalogSources(folderId: string): Promise<FolderCatalog[]> {
  const { data, error } = await supabase
    .from('folder_catalogs')
    .select('*')
    .eq('folder_id', folderId);
  if (error) return [];
  return (data ?? []) as FolderCatalog[];
}

export interface AddCatalogSourceInput {
  folderId: string;
  catalogId: string;
  mediaType: string;
  genre: string | null;
  addonId: string | null;
}

export async function addCatalogSource(
  input: AddCatalogSourceInput,
): Promise<FolderCatalog | null> {
  const { data, error } = await supabase
    .from('folder_catalogs')
    .insert({
      folder_id: input.folderId,
      catalog_id: input.catalogId,
      media_type: input.mediaType,
      genre: input.genre,
      addon_id: input.addonId,
    })
    .select()
    .single();
  if (error) return null;
  return data as FolderCatalog;
}

export async function deleteCatalogSource(id: string): Promise<void> {
  await supabase.from('folder_catalogs').delete().eq('id', id);
}
