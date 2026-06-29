import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';
const GENRES_ID = '861c4a7a-74d5-4cb8-ae0b-a0641d07043e';
const NUVIO_PATH = '/Users/zain/Downloads/nuvio-collections-profile-1-2026-06-29 (1).json';

const GENRE_CATALOG_MOVIE = 'tmdb.discover.movie.movies.mo7bd2ar';
const GENRE_CATALOG_SERIES = 'tmdb.discover.series.series.mo7biroh';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function normName(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Genre definitions: movieGenre, seriesGenre, specific trakt lists with types
const FOLDER_DEFS = {
  'stand-up comedy': {
    movieGenre: 'Comedy',
    seriesGenre: 'Comedy',
    traktLists: [
      { id: 'trakt.list.34808698', type: 'movie' },
      { id: 'trakt.list.34808719', type: 'series' },
    ],
  },
  'romantic comedy': {
    movieGenre: 'Romance',
    seriesGenre: null,
    traktLists: [
      { id: 'trakt.list.34808696', type: 'movie' },
      { id: 'trakt.list.34808717', type: 'series' },
    ],
  },
  adventure: {
    movieGenre: 'Adventure',
    seriesGenre: 'Action & Adventure',
    traktLists: [
      { id: 'trakt.list.34808683', type: 'movie' },
      { id: 'trakt.list.34808703', type: 'series' },
    ],
  },
  crime: {
    movieGenre: 'Crime',
    seriesGenre: 'Crime',
    traktLists: [
      { id: 'trakt.list.34808687', type: 'movie' },
      { id: 'trakt.list.34808707', type: 'series' },
    ],
  },
  history: {
    movieGenre: 'History',
    seriesGenre: 'History',
    traktLists: [
      { id: 'trakt.list.34808692', type: 'movie' },
      { id: 'trakt.list.34808712', type: 'series' },
    ],
  },
  mafia: {
    movieGenre: 'Crime',
    seriesGenre: 'Crime',
    traktLists: [],
  },
};

function buildEntries(nuvioFolder, dbNameNorm) {
  const entries = [];
  const def = FOLDER_DEFS[dbNameNorm];

  // 1. TMDB genre discovery catalogs (for folders that need them)
  if (def && def.movieGenre) {
    entries.push({
      catalog_id: GENRE_CATALOG_MOVIE, media_type: 'movie', genre: def.movieGenre,
    });
  }
  if (def && def.seriesGenre) {
    entries.push({
      catalog_id: GENRE_CATALOG_SERIES, media_type: 'series', genre: def.seriesGenre,
    });
  }

  // 2. Specific Trakt lists
  if (def && def.traktLists) {
    for (const tl of def.traktLists) {
      entries.push({
        catalog_id: tl.id,
        media_type: tl.type,
        genre: null,
      });
    }
  }

  // 3. Original catalogSources from nuvio (for folders that have them)
  if (nuvioFolder) {
    for (const cs of (nuvioFolder.catalogSources || [])) {
      entries.push({
        catalog_id: cs.catalogId,
        media_type: cs.type,
        genre: cs.genre === 'None' ? null : cs.genre,
      });
    }
  }

  return deduplicate(entries);
}

function deduplicate(entries) {
  const seen = new Set();
  const result = [];
  for (const e of entries) {
    const key = `${e.catalog_id}|${e.media_type}|${e.genre ?? '__null__'}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }
  return result;
}

async function main() {
  const nuvioRaw = JSON.parse(readFileSync(NUVIO_PATH, 'utf8'));
  const genresCollection = nuvioRaw.find(
    c => c.title.includes('Genres') && c.folders.length > 20
  );
  if (!genresCollection) throw new Error('Genres collection not found in nuvio profile');

  const nuvioByName = new Map();
  for (const nf of genresCollection.folders) {
    nuvioByName.set(normName(nf.title), nf);
  }
  console.log(`Loaded ${nuvioByName.size} nuvio genre folders`);

  const { data: dbFolders, error: fErr } = await sb
    .from('folders').select('*').eq('collection_id', GENRES_ID).order('name');
  if (fErr) throw new Error(fErr.message);
  console.log(`Found ${dbFolders.length} Genres folders in DB\n`);

  let totalBefore = 0, totalAfter = 0, repaired = 0, created = 0;

  // Build set of existing DB folder names for lookup
  const dbNameSet = new Set(dbFolders.map(f => normName(f.name)));

  for (const dbFolder of dbFolders) {
    const dbNameNorm = normName(dbFolder.name);
    const nuvioFolder = nuvioByName.get(dbNameNorm);

    const entries = buildEntries(nuvioFolder, dbNameNorm);

    const { data: existing } = await sb
      .from('folder_catalogs').select('id').eq('folder_id', dbFolder.id);
    const oldCount = (existing || []).length;
    totalBefore += oldCount;

    await sb.from('folder_catalogs').delete().eq('folder_id', dbFolder.id);

    if (entries.length > 0) {
      await sb.from('folder_catalogs').insert(
        entries.map(e => ({
          folder_id: dbFolder.id,
          catalog_id: e.catalog_id,
          media_type: e.media_type,
          genre: e.genre,
        }))
      );
    }

    totalAfter += entries.length;
    const flag = FOLDER_DEFS[dbNameNorm] ? ' [fixed specific sources]' : '';
    console.log(`  "${dbFolder.name}": ${oldCount} → ${entries.length}${flag}`);
    repaired++;
  }

  // 5. Create folders missing from Genres but present in nuvio
  for (const [nameNorm, nuvioFolder] of nuvioByName) {
    if (dbNameSet.has(nameNorm)) continue;

    const entries = buildEntries(nuvioFolder, nameNorm);
    if (entries.length === 0) continue;

    const coverUrl = nuvioFolder.coverImageUrl || nuvioFolder.cover_image || null;

    const { data: newFolder, error: insertErr } = await sb.from('folders').insert({
      collection_id: GENRES_ID,
      name: nuvioFolder.title,
      cover_image: coverUrl,
      hero_backdrop: nuvioFolder.heroBackdropUrl || nuvioFolder.hero_backdrop || null,
      title_logo: nuvioFolder.titleLogoUrl || nuvioFolder.title_logo || null,
      focus_gif: nuvioFolder.focusGifUrl || nuvioFolder.focus_gif || null,
      hero_video_url: nuvioFolder.heroVideoUrl || nuvioFolder.hero_video_url || null,
      hide_title: nuvioFolder.hideTitle ?? nuvioFolder.hide_title ?? false,
      tile_shape: (nuvioFolder.tileShape || 'POSTER').toUpperCase() === 'LANDSCAPE' ? 'LANDSCAPE' : 'POSTER',
      focus_gif_enabled: nuvioFolder.focusGifEnabled ?? nuvioFolder.focus_gif_enabled ?? true,
      sort_order: 9999,
    }).select().single();

    if (insertErr) {
      console.log(`  ⚠ "${nuvioFolder.title}" create failed: ${insertErr.message}`);
      continue;
    }

    await sb.from('folder_catalogs').insert(
      entries.map(e => ({
        folder_id: newFolder.id,
        catalog_id: e.catalog_id,
        media_type: e.media_type,
        genre: e.genre,
      }))
    );

    totalAfter += entries.length;
    console.log(`  + "${nuvioFolder.title}": created → ${entries.length} [new]`);
    created++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Folders repaired: ${repaired}`);
  console.log(`Folders created:  ${created}`);
  console.log(`Total catalogs before: ${totalBefore}`);
  console.log(`Total catalogs after:  ${totalAfter}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
