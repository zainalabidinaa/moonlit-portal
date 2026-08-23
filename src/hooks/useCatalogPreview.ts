import { useCallback, useEffect, useState } from 'react';

export interface PreviewItem {
  id: string;
  name: string;
  poster: string | null;
}

/** Stremio catalog endpoint for one catalog on one addon. Addon URLs are
 *  stored as their manifest URL, so swap the manifest suffix for the catalog
 *  path. */
export function catalogUrlFor(addonUrl: string, type: string, catalogId: string): string {
  const base = addonUrl.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
  return `${base}/catalog/${type}/${catalogId}.json`;
}

/** Fetches the first few items of one catalog for an inline preview. Lazy:
 *  nothing is requested until `enabled` flips true, so collapsed rows cost
 *  nothing. A failed/slow addon yields an error string rather than throwing —
 *  a preview is best-effort and must never break the surrounding editor. */
export function useCatalogPreview(
  addonUrl: string | null,
  type: string,
  catalogId: string,
  enabled: boolean,
) {
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!addonUrl) {
      setError('No addon linked');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(catalogUrlFor(addonUrl, type, catalogId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const metas = Array.isArray(json.metas) ? json.metas : [];
      setItems(
        metas.slice(0, 6).map((m: Record<string, unknown>) => ({
          id: String(m.id ?? ''),
          name: String(m.name ?? ''),
          poster: typeof m.poster === 'string' ? m.poster : null,
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [addonUrl, type, catalogId]);

  useEffect(() => {
    if (enabled && items === null && !loading && !error) load();
  }, [enabled, items, loading, error, load]);

  return { items, loading, error, reload: load };
}
