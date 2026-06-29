import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';
const JSON_PATH = '/Users/zain/Downloads/nuvio-collections-profile-2-2026-06-28.json';
const AIO_PATH = '/Users/zain/Downloads/aiometadata and nuevio collections/aiometadata-config-2026-06-12.json';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Build title→catalogId lookup from AIOMetadata config (covers all named catalogs)
const aioConfig = JSON.parse(readFileSync(AIO_PATH, 'utf-8'));
const discoverMap = new Map();
for (const c of aioConfig?.config?.catalogs ?? []) {
  if (typeof c.id === 'string' && typeof c.name === 'string') {
    discoverMap.set(c.name.toLowerCase(), c.id);
  }
}
const ALIASES = { 'top rated movies': 'top all time movies', 'top rated series': 'top all time series' };
for (const [alias, canonical] of Object.entries(ALIASES)) {
  if (!discoverMap.has(alias) && discoverMap.has(canonical)) discoverMap.set(alias, discoverMap.get(canonical));
}
console.log(`Loaded ${discoverMap.size} named catalog IDs from AIOMetadata config`);

function resolveCatalogId(src) {
  if (src.catalogId) return src.catalogId;
  if (src.traktListId) return `trakt.list.${src.traktListId}`;
  if (src.tmdbSourceType === 'COLLECTION' && src.tmdbId) return `tmdb.collection.${src.tmdbId}`;
  if (src.tmdbSourceType === 'DISCOVER' || src.tmdbSourceType === 'DIRECTOR') {
    return discoverMap.get((src.title ?? '').toLowerCase()) ?? null;
  }
  return null;
}

function normalizeMediaType(v) {
  if (!v) return 'movie';
  const u = v.toUpperCase();
  if (u === 'TV' || u === 'SERIES') return 'series';
  if (u === 'MOVIE') return 'movie';
  return v.toLowerCase();
}

function normalizeShape(v) {
  if (!v) return 'poster';
  const u = v.toUpperCase();
  if (u === 'LANDSCAPE') return 'landscape';
  if (u === 'SQUARE') return 'square';
  return 'poster';
}

async function main() {
  const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  console.log(`Loaded ${data.length} collections from JSON\n`);

  // Load ALL existing collections and folders once up front for dedup checks
  const { data: existingCols } = await sb.from('collections').select('id, name, sort_order');
  const existingColByName = new Map((existingCols ?? []).map(c => [c.name.toLowerCase(), c]));
  const maxSort = Math.max(-1, ...(existingCols ?? []).map(c => c.sort_order ?? -1));

  // Load all existing folder_catalogs for dedup
  const { data: existingCats } = await sb.from('folder_catalogs').select('folder_id, catalog_id, genre');
  const existingCatKeys = new Set(
    (existingCats ?? []).map(c => `${c.folder_id}:${c.catalog_id}:${c.genre ?? ''}`)
  );

  // Load all existing folder_sources for dedup (by folder_id + tmdb_id + provider)
  const { data: existingSrcs } = await sb.from('folder_sources').select('folder_id, tmdb_id, provider');
  const existingSrcKeys = new Set(
    (existingSrcs ?? []).map(s => `${s.folder_id}:${s.provider}:${s.tmdb_id ?? ''}`)
  );

  let sortBase = maxSort + 1;
  let totalCols = 0, totalColsReused = 0;
  let totalFolders = 0, totalFoldersReused = 0;
  let totalSources = 0, totalSourcesDuped = 0, totalSkipped = 0;

  for (let ci = 0; ci < data.length; ci++) {
    const col = data[ci];
    const colName = col.title ?? col.name ?? `Collection ${ci + 1}`;

    // Reuse existing collection with same name instead of inserting duplicate
    let collectionId;
    const existingCol = existingColByName.get(colName.toLowerCase());
    if (existingCol) {
      collectionId = existingCol.id;
      totalColsReused++;
      console.log(`[reuse] collection "${colName}"`);
    } else {
      const firstHero = col.folders?.[0]?.heroBackdropUrl ?? null;
      const { data: colRow, error: colErr } = await sb.from('collections').insert({
        name: colName,
        view_mode: col.viewMode ?? 'FOLLOW_LAYOUT',
        show_all_tab: col.showAllTab ?? false,
        pin_to_top: col.pinToTop ?? false,
        focus_glow_enabled: col.focusGlowEnabled ?? false,
        backdrop_image: col.backdropImageUrl ?? firstHero,
        sort_order: sortBase + ci,
      }).select().single();
      if (colErr || !colRow) { console.warn(`  ⚠ Skip collection "${colName}": ${colErr?.message}`); continue; }
      collectionId = colRow.id;
      totalCols++;
    }

    // Load existing folders for this collection (for dedup by name)
    const { data: existingFolders } = await sb.from('folders').select('id, name').eq('collection_id', collectionId);
    const existingFolderByName = new Map((existingFolders ?? []).map(f => [f.name.toLowerCase(), f]));

    const folders = Array.isArray(col.folders) ? col.folders : [];
    for (let fi = 0; fi < folders.length; fi++) {
      const f = folders[fi];
      const folderName = f.title ?? f.name ?? `Folder ${fi + 1}`;

      // Reuse existing folder with same name in this collection
      let folderId;
      const existingFolder = existingFolderByName.get(folderName.toLowerCase());
      if (existingFolder) {
        folderId = existingFolder.id;
        totalFoldersReused++;
      } else {
        const { data: folderRow, error: folderErr } = await sb.from('folders').insert({
          collection_id: collectionId,
          name: folderName,
          cover_image: f.coverImageUrl ?? f.cover_image ?? null,
          hero_backdrop: f.heroBackdropUrl ?? f.hero_backdrop ?? null,
          focus_gif: f.focusGifUrl ?? f.focus_gif ?? null,
          title_logo: f.titleLogoUrl ?? f.title_logo ?? null,
          hero_video_url: f.heroVideoUrl ?? f.hero_video_url ?? null,
          hide_title: f.hideTitle ?? f.hide_title ?? false,
          tile_shape: normalizeShape(f.tileShape ?? f.tile_shape),
          focus_gif_enabled: f.focusGifEnabled ?? f.focus_gif_enabled ?? false,
          sort_order: fi,
        }).select().single();
        if (folderErr || !folderRow) { console.warn(`    ⚠ Skip folder "${folderName}": ${folderErr?.message}`); continue; }
        folderId = folderRow.id;
        totalFolders++;
      }

      // Use catalogSources if non-empty (richer), else fall back to sources
      const srcs = Array.isArray(f.catalogSources) && f.catalogSources.length > 0
        ? f.catalogSources
        : (Array.isArray(f.sources) ? f.sources : []);

      const seenThisFolder = new Set();
      let folderNew = 0, folderDuped = 0, folderSkipped = 0;

      for (const src of srcs) {
        const mediaType = normalizeMediaType(src.type ?? src.mediaType);
        const genre = src.genre && src.genre.toLowerCase() !== 'none' ? src.genre : null;

        // DIRECTOR / LIST sources → folder_sources (TMDB person/list query)
        if ((src.tmdbSourceType === 'DIRECTOR' || src.tmdbSourceType === 'LIST') && src.tmdbId) {
          const srcKey = `${folderId}:tmdb:${src.tmdbId}`;
          if (existingSrcKeys.has(srcKey)) { folderDuped++; totalSourcesDuped++; continue; }
          const { error } = await sb.from('folder_sources').insert({
            folder_id: folderId,
            provider: 'tmdb',
            title: src.title ?? null,
            tmdb_id: String(src.tmdbId),
            media_type: mediaType,
            sort_order: 0,
          });
          if (!error) { folderNew++; totalSources++; existingSrcKeys.add(srcKey); }
          continue;
        }

        const catalogId = resolveCatalogId(src);
        if (!catalogId) { folderSkipped++; totalSkipped++; continue; }

        // Skip if already in DB or already seen in this folder's batch
        const dbKey = `${folderId}:${catalogId}:${genre ?? ''}`;
        const batchKey = `${catalogId}:${genre ?? ''}`;
        if (existingCatKeys.has(dbKey) || seenThisFolder.has(batchKey)) {
          folderDuped++; totalSourcesDuped++;
          continue;
        }
        seenThisFolder.add(batchKey);

        const { error } = await sb.from('folder_catalogs').insert({
          folder_id: folderId,
          catalog_id: catalogId,
          media_type: mediaType,
          genre,
        });
        if (!error) {
          folderNew++;
          totalSources++;
          existingCatKeys.add(dbKey);
        }
      }

      const parts = [`${folderNew} new`];
      if (folderDuped) parts.push(`${folderDuped} already existed`);
      if (folderSkipped) parts.push(`${folderSkipped} skipped`);
      console.log(`  ${colName} > ${folderName}: ${parts.join(', ')}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Collections: ${totalCols} created, ${totalColsReused} reused`);
  console.log(`Folders:     ${totalFolders} created, ${totalFoldersReused} reused`);
  console.log(`Sources:     ${totalSources} added, ${totalSourcesDuped} already existed, ${totalSkipped} unresolvable (no catalog ID or tmdb_id)`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
