import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';
const IMAGE_DIR = '/Users/zain/Downloads/new';
const BUCKET = 'genre-covers';

// IDs from the DB
const CATEGORIES_ID = '0a814bbf-c733-44d3-a70e-889141f8604e'; // "Categories" (may not exist)
const GENRES_ID     = '861c4a7a-74d5-4cb8-ae0b-a0641d07043e'; // "‎Genres"

// Folder name → normalised key overrides (for names that don't match image filenames)
const NAME_OVERRIDES = {
  'documentaries':    'documentary',
  'romantic comedy':  'rom com',
  'reality tv':       'reality',
  'stand-up comedy':  'stand up',
  'fantasy & sci-fi': 'fantasy',   // falls back to fantasy image
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function norm(s) {
  const stripped = s.toLowerCase()
    .replace(/\s*\(\d+\)\s*/g, '')  // strip "(1)", "(4)"
    .replace(/\s+/g, ' ').trim();
  if (NAME_OVERRIDES[stripped]) return NAME_OVERRIDES[stripped];
  const lower = stripped
    .replace(/[_\-]/g, ' ')          // _ and - → space
    .replace(/[^a-z0-9 ]/g, '')      // drop remaining special chars
    .replace(/\s+/g, ' ').trim();
  return NAME_OVERRIDES[lower] ?? lower;
}

// ── 1. Build image URL map ──────────────────────────────────────────────────

function buildUrlMap() {
  const files = readdirSync(IMAGE_DIR).filter(f => f.toLowerCase().endsWith('.png'));
  const map = new Map();
  for (const f of files) {
    const key = norm(basename(f, '.png'));
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(f)}`;
    map.set(key, url);
  }
  console.log(`✓ ${map.size} images mapped`);
  return map;
}

// ── 2. Copy Categories folders into Genres ──────────────────────────────────

async function copyFolders(urlMap) {
  // Load Categories folders + their catalogs + their sources
  const { data: srcFolders, error: sfErr } = await sb
    .from('folders').select('*').eq('collection_id', CATEGORIES_ID).order('name');
  if (sfErr) throw new Error(sfErr.message);
  console.log(`\n✓ Found ${srcFolders.length} folders in Categories`);

  const srcIds = srcFolders.map(f => f.id);
  const [srcCatsRes, srcSrcsRes] = await Promise.all([
    srcIds.length
      ? sb.from('folder_catalogs').select('*').in('folder_id', srcIds)
      : { data: [] },
    srcIds.length
      ? sb.from('folder_sources').select('*').in('folder_id', srcIds)
      : { data: [] },
  ]);
  const srcCats = srcCatsRes.data ?? [];
  const srcSrcs = srcSrcsRes.data ?? [];

  // Load existing Genres folders (name → { id, name })
  const { data: existingFolders } = await sb
    .from('folders').select('id, name').eq('collection_id', GENRES_ID);
  const existingByName = new Map((existingFolders ?? []).map(f => [f.name.toLowerCase(), f]));
  console.log(`  Genres already has ${existingByName.size} folders`);

  console.log('\nSyncing folders...');
  let copied = 0, synced = 0;
  const newFolderIds = [];

  for (const src of srcFolders) {
    const key = norm(src.name);
    const coverUrl = urlMap.get(key) ?? null;
    const srcNameLow = src.name.toLowerCase();
    const existing = existingByName.get(srcNameLow);
    const srcCatList = (srcCats).filter(c => c.folder_id === src.id);
    const srcSrcList = (srcSrcs).filter(s => s.folder_id === src.id);

    if (existing) {
      // Folder exists — sync catalogs and sources
      const fid = existing.id;

      // Delete stale catalogs, re-insert current ones
      await sb.from('folder_catalogs').delete().eq('folder_id', fid);
      if (srcCatList.length) {
        await sb.from('folder_catalogs').insert(
          srcCatList.map(({ catalog_id, media_type, genre, extras }) => ({
            folder_id: fid, catalog_id, media_type, genre, extras,
          }))
        );
      }

      // Delete stale sources, re-insert current ones
      await sb.from('folder_sources').delete().eq('folder_id', fid);
      if (srcSrcList.length) {
        await sb.from('folder_sources').insert(
          srcSrcList.map(({ provider, title, tmdb_id, media_type, sort_order }) => ({
            folder_id: fid, provider, title, tmdb_id, media_type, sort_order,
          }))
        );
      }

      console.log(`  sync  "${src.name}" — ${srcCatList.length} catalogs, ${srcSrcList.length} sources${coverUrl ? ' 🖼' : ''}`);
      synced++;
      continue;
    }

    const { data: newFolder, error } = await sb.from('folders').insert({
      collection_id: GENRES_ID,
      name: src.name,
      cover_image: coverUrl,
      hero_backdrop: src.hero_backdrop ?? null,
      title_logo: src.title_logo ?? null,
      focus_gif: src.focus_gif ?? null,
      hero_video_url: src.hero_video_url ?? null,
      hide_title: src.hide_title ?? false,
      tile_shape: src.tile_shape ?? 'POSTER',
      focus_gif_enabled: src.focus_gif_enabled ?? true,
      sort_order: 9999,
    }).select().single();

    if (error) { console.warn(`  ⚠ "${src.name}": ${error.message}`); continue; }

    if (srcCatList.length) {
      await sb.from('folder_catalogs').insert(
        srcCatList.map(({ catalog_id, media_type, genre, extras }) => ({
          folder_id: newFolder.id, catalog_id, media_type, genre, extras,
        }))
      );
    }

    if (srcSrcList.length) {
      await sb.from('folder_sources').insert(
        srcSrcList.map(({ provider, title, tmdb_id, media_type, sort_order }) => ({
          folder_id: newFolder.id, provider, title, tmdb_id, media_type, sort_order,
        }))
      );
    }

    console.log(`  copy  "${src.name}" — ${srcCatList.length} catalogs, ${srcSrcList.length} sources${coverUrl ? ' 🖼' : ' (no img)'}`);
    newFolderIds.push(newFolder.id);
    copied++;
  }

  console.log(`\n✓ Copied ${copied} new, synced ${synced} existing`);
}

// ── 3. Set cover images on ALL Genres folders + sort alphabetically ─────────

async function applyCoversAndSort(urlMap) {
  const { data: all, error } = await sb
    .from('folders').select('id, name').eq('collection_id', GENRES_ID).order('name');
  if (error) throw new Error(error.message);

  console.log(`\nSetting covers + sorting ${all.length} Genres folders alphabetically...`);
  let matched = 0, unmatched = [];

  for (let i = 0; i < all.length; i++) {
    const f = all[i];
    const key = norm(f.name);
    const coverUrl = urlMap.get(key) ?? null;
    if (coverUrl) matched++; else unmatched.push(f.name);

    await sb.from('folders').update({ cover_image: coverUrl, sort_order: i }).eq('id', f.id);
  }

  console.log(`  ✓ Cover matched: ${matched}/${all.length}`);
  if (unmatched.length) {
    console.log(`  ⚠ No image for: ${unmatched.join(', ')}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Genre Setup ===\n');
  const urlMap = buildUrlMap();
  await copyFolders(urlMap);
  await applyCoversAndSort(urlMap);
  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
