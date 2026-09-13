import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAllAddonManifests, type ManifestCatalog } from './useAddonManifest';
import type { Folder, InstalledAddon } from '../types';

// Fallback only: a catalog whose declaring addon isn't installed/known is
// still attempted against the default bundled addon (trakt.list.*,
// mdblist.*, tmdb.discover.*, …) — see CatalogRepository.swift's own
// "aiometadata" preference. Everything else now resolves through the
// profile's own installed addons, so a folder sourced from e.g. Bingecat
// gets real posters instead of falling back to collection art.
const AIOMETADATA_BASE = 'https://aiometadata.fortheweak.cloud/stremio/1bf2cd94-2057-4992-9ed7-a8464f12e4a4';
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string;

interface StremioMeta {
  poster?: string;
  _rawPosterUrl?: string;
}
interface StremioCatalogResponse {
  metas?: StremioMeta[];
}
interface TmdbDiscoverResponse {
  results?: Array<{ poster_path?: string }>;
}

/** A catalog's declaring addon install URL → the transport base the
 *  catalog-proxy expects (everything before `/manifest.json`). */
function addonBaseUrl(manifestUrl: string): string {
  if (manifestUrl.endsWith('/manifest.json')) return manifestUrl.slice(0, -'/manifest.json'.length);
  const lastSlash = manifestUrl.lastIndexOf('/');
  return lastSlash > 0 ? manifestUrl.slice(0, lastSlash) : manifestUrl;
}

type CatalogLookup = (catalogId: string) => { catalog: ManifestCatalog; addonUrl: string } | null;

// btttr (Moonlit's own poster-badge proxy, see poster URL scheme notes)
// lags on caching brand-new/unreleased titles and 404s until it catches up.
// TMDB's own CDN url is populated as soon as TMDB itself has the poster —
// far more reliable for "coming soon" style catalogs — so it's preferred,
// falling back to btttr only when TMDB has nothing either. A small in-app
// preview doesn't need btttr's badge treatment anyway.
function pickPoster(m: StremioMeta): string | null {
  if (m._rawPosterUrl && !m._rawPosterUrl.includes('missing_poster')) return m._rawPosterUrl;
  return m.poster ?? null;
}

/** A `filter_params` catalog row is TMDB-direct (the app fetches `/discover`
 *  itself, no addon involved) — previews go through the same `tmdb-discover`
 *  proxy the portal already uses for genre tiles, so those folders preview
 *  correctly without any addon serving the catalog id. */
async function fetchPostersForFilterParams(
  mediaType: string,
  params: Record<string, string>,
): Promise<string[]> {
  const kind = mediaType === 'series' ? 'tv' : 'movie';
  const search = new URLSearchParams({ kind, ...params });
  try {
    const res = await fetch(`${FUNCTIONS_URL}/tmdb-discover?${search.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as TmdbDiscoverResponse;
    return (data.results ?? [])
      .map((r) => (r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null))
      .filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}

async function fetchPostersForCatalog(
  catalogId: string,
  mediaType: string,
  baseUrl: string,
  extras?: Record<string, string>,
): Promise<string[]> {
  const params = new URLSearchParams({ url: baseUrl, type: mediaType, id: catalogId });
  if (extras && Object.keys(extras).length) params.set('extras', JSON.stringify(extras));
  try {
    const res = await fetch(`${FUNCTIONS_URL}/catalog-proxy?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as StremioCatalogResponse;
    return (data.metas ?? []).map(pickPoster).filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}

// Cached per folder — both in-memory (this page load) and in localStorage
// for a week (real content art changes rarely, and re-resolving it on every
// admin page load/refresh is wasted addon/TMDB round trips). A folder whose
// actual catalogs change will simply look stale for up to a week; that's an
// acceptable trade for an admin preview, not the end-user app.
const posterCache = new Map<string, Promise<string[]>>();
const STORAGE_PREFIX = 'moonlit.folderPosters.';
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readStoredPosters(folderId: string): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + folderId);
    if (!raw) return null;
    const { posters, savedAt } = JSON.parse(raw) as { posters: string[]; savedAt: number };
    if (Date.now() - savedAt > STORAGE_TTL_MS) return null;
    return posters;
  } catch {
    return null;
  }
}

function writeStoredPosters(folderId: string, posters: string[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + folderId, JSON.stringify({ posters, savedAt: Date.now() }));
  } catch {
    // Storage full/unavailable (private window, etc.) — the in-memory cache
    // for this page load still works, just doesn't persist across reloads.
  }
}

/** A folder's own real posters, gathered across ALL its catalogs (not just
 *  the first) until there are enough to fill a preview — a single sparse
 *  catalog (e.g. a time-boxed "coming soon" list) shouldn't leave a mostly-
 *  empty mosaic when a second catalog on the same folder has more.
 *
 *  Each catalog is queried on its declaring addon when that is known, then
 *  on every other installed addon in turn — the catalog-proxy fetches
 *  server-side, so this works even for an addon whose manifest the browser
 *  cannot read (CORS), which previously left its folders preview-less. */
function resolveFolderPosters(
  folderId: string,
  want = 4,
  addonBases: string[] = [],
  lookup?: CatalogLookup,
): Promise<string[]> {
  let promise = posterCache.get(folderId);
  if (!promise) {
    const stored = readStoredPosters(folderId);
    if (stored && stored.length >= want) {
      promise = Promise.resolve(stored);
    } else {
      promise = (async () => {
        const { data } = await supabase
          .from('folder_catalogs')
          .select('catalog_id,media_type,genre,extras,filter_params')
          .eq('folder_id', folderId);
        const results: string[] = [];
        for (const row of data ?? []) {
          if (results.length >= want) break;
          // TMDB-direct rows (`filter_params`, e.g. a decade folder) belong
          // to no addon — resolve them through the TMDB proxy instead.
          if (row.filter_params && Object.keys(row.filter_params).length) {
            const found = await fetchPostersForFilterParams(row.media_type, row.filter_params);
            for (const p of found) {
              if (results.length >= want) break;
              if (!results.includes(p)) results.push(p);
            }
            continue;
          }
          const declarer = lookup?.(row.catalog_id);
          const candidates = declarer
            ? [addonBaseUrl(declarer.addonUrl), ...addonBases]
            : addonBases;
          const bases = candidates.length ? [...new Set(candidates)] : [AIOMETADATA_BASE];
          // A catalog row can be parameterized (elcinema-*-year needs its
          // `genre`; filtering here too keeps previews faithful).
          const extras: Record<string, string> = { ...(row.extras ?? {}) };
          if (row.genre && row.genre.toLowerCase() !== 'none') extras.genre = row.genre;
          for (const baseUrl of bases) {
            const found = await fetchPostersForCatalog(row.catalog_id, row.media_type, baseUrl, extras);
            if (!found.length) continue;
            for (const p of found) {
              if (results.length >= want) break;
              if (!results.includes(p)) results.push(p);
            }
            break;
          }
        }
        writeStoredPosters(folderId, results);
        // An empty result must not stick for the session: the addon that
        // declares this catalog may just not have been installed yet.
        if (results.length === 0) posterCache.delete(folderId);
        return results;
      })();
    }
    posterCache.set(folderId, promise);
  }
  return promise;
}

// Deliberately larger than any consumer's visible tile count: some fraction
// of picked poster URLs 404 (btttr/TMDB simply have no art yet for a
// brand-new or unreleased title — see pickPoster's comment), and there's no
// way to know that from the metadata alone. Consumers render their visible
// slots via FallbackPosterImg, which cycles into this backing pool on a
// real <img> load failure instead of leaving a gap.
const POOL_SIZE = 12;

/**
 * Real poster art for a folder's own content sources — a backing pool, not
 * just the first few. Used anywhere the admin UI needs to show "what does
 * this row actually contain" instead of a metadata backdrop or a color
 * placeholder; pair with FallbackPosterImg to render it.
 */
export function useFolderPreviewPosters(folderId: string | null): string[] {
  const { activeProfile } = useAuth();
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[]>([]);
  const [addonsLoaded, setAddonsLoaded] = useState(false);
  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    if (!activeProfile) {
      setInstalledAddons([]);
      setAddonsLoaded(true);
      return;
    }
    let cancelled = false;
    setAddonsLoaded(false);
    supabase.from('installed_addons').select('*')
      .eq('profile_id', activeProfile.id).order('sort_order')
      .then(({ data }) => {
        if (cancelled) return;
        setInstalledAddons((data as InstalledAddon[]) ?? []);
        setAddonsLoaded(true);
      });
    return () => { cancelled = true; };
  }, [activeProfile]);

  const { lookupById } = useAllAddonManifests(installedAddons);
  // Every installed addon's transport base, from the DB rows alone — no
  // manifest fetch needed, so an addon the browser can't read still gets
  // queried (server-side, via the proxy). AIOMetadata is the last resort.
  const addonBases = useMemo(() => {
    const bases = installedAddons.map((addon) => addonBaseUrl(addon.addon_url));
    const unique = [...new Set(bases)];
    if (!unique.includes(AIOMETADATA_BASE)) unique.push(AIOMETADATA_BASE);
    return unique;
  }, [installedAddons]);

  useEffect(() => {
    if (!folderId || !addonsLoaded) {
      setPosters([]);
      return;
    }
    let cancelled = false;
    resolveFolderPosters(folderId, POOL_SIZE, addonBases, lookupById).then((result) => {
      if (!cancelled) setPosters(result);
    });
    return () => {
      cancelled = true;
    };
  }, [folderId, addonsLoaded, addonBases, lookupById]);

  return posters;
}

const childCache = new Map<string, Promise<Folder | null>>();
function firstChildFolder(parentFolderId: string): Promise<Folder | null> {
  let promise = childCache.get(parentFolderId);
  if (!promise) {
    promise = (async () => {
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('parent_folder_id', parentFolderId)
        .order('sort_order')
        .limit(1);
      return (data?.[0] as Folder) ?? null;
    })();
    childCache.set(parentFolderId, promise);
  }
  return promise;
}

/**
 * One representative image for a hub's child-folder tile (Genre Hub's
 * "Horror", Language Hub's "Korean", …). Most hub children already carry
 * their own curated cover_image/hero_backdrop (Genre Hub's icon art) — used
 * as-is when present. A hub child with neither its own image nor its own
 * catalogs (Language Hub's per-language folders: the real content sources
 * live one level down, on folders like "Popular Korean Movies") falls back
 * to that first child's image or resolved poster instead of showing nothing.
 */
export function useFolderTileImage(folder: Folder | null): string | null {
  const staticImage = folder?.cover_image ?? folder?.hero_backdrop ?? null;
  const ownPosters = useFolderPreviewPosters(staticImage ? null : folder?.id ?? null);
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);

  useEffect(() => {
    setFallbackImage(null);
    if (staticImage || !folder || ownPosters.length > 0) return;
    let cancelled = false;
    (async () => {
      const child = await firstChildFolder(folder.id);
      if (!child) return;
      const childStatic = child.cover_image ?? child.hero_backdrop;
      if (childStatic) {
        if (!cancelled) setFallbackImage(childStatic);
        return;
      }
      const posters = await resolveFolderPosters(child.id, 1);
      if (!cancelled && posters[0]) setFallbackImage(posters[0]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder?.id, staticImage, ownPosters.length]);

  return staticImage ?? ownPosters[0] ?? fallbackImage;
}
