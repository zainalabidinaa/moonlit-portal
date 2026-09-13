import type { CollectionTree, TreeFolder } from './collectionTrees';

/** The subset of a Stremio/Fusion addon manifest this feature reads. */
export interface AddonManifestCatalog {
  id: string;
  type: string;
  name: string;
  /** A catalog that can't render without a search term ("Movie Search")
   *  can't back a row widget — the group builder skips it. */
  searchRequired: boolean;
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

/** How a manifest structures its catalog names: `<Provider> · <Section>`
 *  (e.g. arabcinemeta's "elCinema · Now Playing", "WATCH IT · Shows"). */
const GROUP_SEPARATOR = ' · ';

/** Addon catalog rows are section tiles inside their provider widget —
 *  wide/landscape reads better than a poster for a whole section. */
const GROUP_TILE_SHAPE = 'landscape';

/** Parses an already-fetched manifest JSON into `AddonManifestInfo`.
 *  `fallbackId` (the URL it came from) stands in when the manifest omits its
 *  own `id` — the app matches installed addons by that id. */
export function parseAddonManifest(json: unknown, fallbackId: string): AddonManifestInfo {
  const manifest = (json ?? {}) as {
    id?: string;
    name?: string;
    catalogs?: Array<{
      id?: string;
      type?: string;
      name?: string;
      extra?: Array<{ name?: string; isRequired?: boolean }>;
    }>;
  };
  const id = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : fallbackId;
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
    catalogs.push({
      id: catalogId,
      type,
      name: (raw.name ?? '').trim() || catalogId,
      searchRequired: (raw.extra ?? []).some((e) => e?.name === 'search' && e?.isRequired === true),
    });
  }
  return { id, name: (manifest.name ?? '').trim() || 'Add-on', catalogs };
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
  return parseAddonManifest(json, url);
}

/**
 * Groups a manifest's catalogs the way the manifest itself structures them:
 * one collection tree per name prefix (`<Provider> · <Section>` → a
 * "Provider" widget whose folders are its sections), with catalogs that
 * have no prefix grouped under the add-on's own name. Each tree syncs into
 * a real collection + folders + sources and one preset widget, so the app
 * shows the provider as a hub of section tiles — or, with the widget's
 * Rows toggle, one content row per section.
 */
export function manifestToCollectionTrees(
  manifest: AddonManifestInfo
): { trees: CollectionTree[]; skipped: string[] } {
  const groups = new Map<string, TreeFolder[]>();
  const skipped: string[] = [];

  for (const catalog of manifest.catalogs) {
    if (catalog.searchRequired) {
      skipped.push(catalog.name);
      continue;
    }
    const parts = catalog.name.split(GROUP_SEPARATOR);
    const groupName = (parts.length > 1 ? parts[0] : manifest.name).trim();
    const sectionName = (parts.length > 1 ? parts.slice(1).join(GROUP_SEPARATOR) : catalog.name).trim();
    const folders = groups.get(groupName) ?? [];
    folders.push({
      externalId: `addon:${manifest.id}:group:${groupName}:${catalog.type}:${catalog.id}`,
      name: sectionName || catalog.name,
      tileShape: GROUP_TILE_SHAPE,
      sources: [{ kind: 'catalog', catalogId: catalog.id, mediaType: catalog.type, genre: null }],
    });
    groups.set(groupName, folders);
  }

  const trees: CollectionTree[] = [...groups.entries()].map(([groupName, folders]) => ({
    externalId: `addon:${manifest.id}:group:${groupName}`,
    presetSourceId: `addon:${manifest.id}:group:${groupName}`,
    name: groupName,
    folders,
  }));
  return { trees, skipped };
}
