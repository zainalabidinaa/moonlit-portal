import type { ImportedWidget } from './importWidgets';

/** The subset of a Stremio/Fusion addon manifest this feature reads. */
export interface AddonManifestCatalog {
  id: string;
  type: string;
  name: string;
}

export interface AddonManifestInfo {
  /** The manifest's own `id` — exactly what the app's
   *  `WidgetContentResolver.resolveAddonCatalog` matches an installed addon
   *  by, so it is kept verbatim (falling back to the URL only when the
   *  manifest omits it). */
  id: string;
  name: string;
  catalogs: AddonManifestCatalog[];
}

/** Fetches an addon manifest — same direct browser fetch the portal's own
 *  addon pages already use (Xperience-style hosts send
 *  `access-control-allow-origin: *`), with the realistic failures named. */
export async function fetchAddonManifest(url: string): Promise<AddonManifestInfo> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Couldn't reach that add-on's manifest — check the URL, or that host may block browser fetches.");
  }
  if (!response.ok) throw new Error(`That manifest returned HTTP ${response.status}.`);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error('That manifest is not valid JSON.');
  }

  const manifest = json as {
    id?: string;
    name?: string;
    catalogs?: Array<{ id?: string; type?: string; name?: string }>;
  };
  const id = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : url;
  const seen = new Set<string>();
  const catalogs: AddonManifestCatalog[] = [];
  for (const raw of manifest.catalogs ?? []) {
    if (typeof raw?.id !== 'string' || typeof raw?.type !== 'string') continue;
    const catalogId = raw.id.trim();
    const type = raw.type.trim();
    if (!catalogId || !type) continue;
    const key = `${type}:${catalogId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    catalogs.push({ id: catalogId, type, name: (raw.name ?? '').trim() || catalogId });
  }
  return { id, name: (manifest.name ?? '').trim() || 'Add-on', catalogs };
}

/** One external-catalog widget per declared catalog — the same preset shape
 *  the app's own add-widget flow produces
 *  (`WidgetDataSource.addonCatalog(addonId:catalogId:mediaType:)`), with a
 *  stable `sourceId` so re-running this for the same add-on updates those
 *  rows in place instead of inserting duplicates. */
export function catalogsToWidgets(manifest: AddonManifestInfo): ImportedWidget[] {
  return manifest.catalogs.map((catalog) => ({
    title: catalog.name,
    style: 'standard' as const,
    dataSource: {
      kind: 'addonCatalog' as const,
      addonId: manifest.id,
      catalogId: catalog.id,
      mediaType: catalog.type,
    },
    sourceId: `addon:${manifest.id}:${catalog.type}:${catalog.id}`,
  }));
}
