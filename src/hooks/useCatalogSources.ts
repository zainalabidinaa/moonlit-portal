import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildSourceRows, type SnapshotRow, type SourceRow } from '../lib/catalogSources';
import type { FolderCatalog, FolderSource } from '../types';

const PAGE = 1000;

// PostgREST caps a request at 1000 rows; the catalog has thousands.
async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export interface SourceListRow extends SourceRow {
  collectionId: string;
  collectionName: string;
  folderName: string;
}

export function useCatalogSources(reloadKey = 0) {
  const [rows, setRows] = useState<SourceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [collections, folders, catalogs, sources, snapshots] = await Promise.all([
          fetchAll<{ id: string; name: string }>('collections', 'id,name'),
          fetchAll<{ id: string; name: string; collection_id: string }>('folders', 'id,name,collection_id'),
          fetchAll<FolderCatalog>('folder_catalogs', '*'),
          fetchAll<FolderSource>('folder_sources', '*'),
          fetchAll<SnapshotRow>('catalog_snapshots', 'catalog_id,media_type,variant,item_count,error,fetched_at'),
        ]);
        if (cancelled) return;
        const collectionById = new Map(collections.map((c) => [c.id, c]));
        const folderById = new Map(folders.map((f) => [f.id, f]));
        const built = buildSourceRows({
          catalogs,
          sources,
          snapshots,
          folderName: (id) => folderById.get(id)?.name ?? '',
        });
        setRows(
          built.map((r) => {
            const folder = folderById.get(r.folderId);
            const collection = folder ? collectionById.get(folder.collection_id) : undefined;
            return {
              ...r,
              collectionId: folder?.collection_id ?? '',
              collectionName: collection?.name ?? '—',
              folderName: folder?.name ?? '—',
            };
          }),
        );
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { rows, loading, error };
}
