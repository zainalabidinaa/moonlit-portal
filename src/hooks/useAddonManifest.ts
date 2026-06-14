import { useCallback, useEffect, useRef, useState } from 'react';

export const AIO_MANIFEST_URL =
  'https://aiometadata.fortheweak.cloud/stremio/67df96d7-9709-4759-8fee-9b516b83e576/manifest.json';

export interface ManifestCatalog {
  id: string;
  type: string;
  name: string;
  genres: string[];
  genreRequired: boolean;
}

interface ManifestState {
  name: string;
  catalogs: ManifestCatalog[];
  fetchedAt: Date;
  catalogCount: number;
}

function parseCatalogs(raw: any[]): ManifestCatalog[] {
  return raw
    .map((c) => {
      const genreExtra = (c.extra ?? []).find((e: any) => e.name === 'genre');
      return {
        id: c.id as string,
        type: c.type as string,
        name: c.name as string,
        genres: (genreExtra?.options ?? []).filter((g: string) => g !== 'None'),
        genreRequired: genreExtra?.isRequired === true,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useAddonManifest(url = AIO_MANIFEST_URL) {
  const [state, setState] = useState<ManifestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const prevCount = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async (isPolled = false) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const catalogs = parseCatalogs(json.catalogs ?? []);
      const count = catalogs.length;

      if (isPolled && prevCount.current !== null && count !== prevCount.current) {
        setHasUpdate(true);
      }
      prevCount.current = count;

      setState({ name: json.name ?? 'Addon', catalogs, fetchedAt: new Date(), catalogCount: count });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const refresh = useCallback(() => {
    setHasUpdate(false);
    setLoading(true);
    fetch_(false);
  }, [fetch_]);

  useEffect(() => {
    fetch_(false);
    timerRef.current = setInterval(() => fetch_(true), 5 * 60 * 1000); // poll every 5 min
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch_]);

  const catalogById = useCallback(
    (id: string) => state?.catalogs.find((c) => c.id === id) ?? null,
    [state],
  );

  return { manifest: state, loading, error, hasUpdate, refresh, catalogById };
}
