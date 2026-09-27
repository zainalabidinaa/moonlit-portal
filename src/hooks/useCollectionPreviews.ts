import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/fetchAllRows';
import type { Collection, Folder } from '../types';

export interface CollectionPreview extends Collection {
  folders: Folder[];
}

/** Best available cover for a collection: its own backdrop, else the first folder's art. */
export function collectionCover(c: CollectionPreview): string | null {
  return c.backdrop_image ?? c.folders.find((f) => f.hero_backdrop)?.hero_backdrop ?? c.folders.find((f) => f.cover_image)?.cover_image ?? null;
}

/** Folder cover images across a collection, for poster fans and mini grids. */
export function folderArt(c: CollectionPreview, max = 4): string[] {
  return c.folders.map((f) => f.cover_image ?? f.hero_backdrop).filter((s): s is string => !!s).slice(0, max);
}

/**
 * The public collections with their folders, ordered as the admin sorted
 * them. Read-only and tolerant: if RLS blocks the anonymous read the page
 * simply renders without the sections that need it.
 */
export function useCollectionPreviews(limit?: number) {
  const [items, setItems] = useState<CollectionPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let query = supabase.from('collections').select('*').order('sort_order');
        if (limit) query = query.limit(limit);
        const [{ data: cols }, folders] = await Promise.all([query, fetchAllRows<Folder>('folders')]);
        if (cancelled || !cols) return;
        setItems(
          (cols as Collection[]).map((c) => ({
            ...c,
            folders: folders.filter((f) => f.collection_id === c.id),
          }))
        );
      } catch {
        /* public page: render without collections */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { collections: items, loading };
}
