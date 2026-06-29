import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';
const TMDB_KEY = '1e818317d3086727eceecf0571621527';
const FRAN_COL = '3b7e79f5-c885-45b5-ad96-dceff010c0c2';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function tmdbFetch(path) {
  const res = await fetch(`https://api.themoviedb.org/3${path}&api_key=${TMDB_KEY}`);
  if (!res.ok) return null;
  return res.json();
}

function backdropUrl(path) {
  return path ? `https://image.tmdb.org/t/p/w1280${path}` : null;
}

async function getBackdropForCollection(collectionId) {
  const data = await tmdbFetch(`/collection/${collectionId}?language=en-US`);
  return backdropUrl(data?.backdrop_path);
}

async function searchCollectionBackdrop(name) {
  const data = await tmdbFetch(`/search/collection?query=${encodeURIComponent(name)}&language=en-US`);
  const first = data?.results?.[0];
  if (!first) return null;
  // Fetch full details to get backdrop
  return getBackdropForCollection(first.id);
}

async function main() {
  // Get all POSTER folders in Franchises
  const { data: folders } = await sb
    .from('folders')
    .select('id, name, cover_image')
    .eq('collection_id', FRAN_COL)
    .eq('tile_shape', 'POSTER');

  console.log(`Found ${folders?.length ?? 0} POSTER folders to fix\n`);

  const noBackdrop = [];

  for (const f of folders ?? []) {
    // Try to find tmdb.collection.X catalog ID
    const { data: cats } = await sb
      .from('folder_catalogs')
      .select('catalog_id')
      .eq('folder_id', f.id);

    const tmdbCat = cats?.find(c => c.catalog_id?.startsWith('tmdb.collection.'));
    const collectionId = tmdbCat?.catalog_id?.replace('tmdb.collection.', '');

    let backdrop = null;
    if (collectionId) {
      backdrop = await getBackdropForCollection(collectionId);
    }

    // Fall back to name search
    if (!backdrop) {
      backdrop = await searchCollectionBackdrop(f.name);
    }

    if (backdrop) {
      await sb.from('folders').update({ tile_shape: 'LANDSCAPE', cover_image: backdrop }).eq('id', f.id);
      console.log(`✓ ${f.name} → ${backdrop}`);
    } else {
      // Still switch to LANDSCAPE tile_shape, just flag the image
      await sb.from('folders').update({ tile_shape: 'LANDSCAPE' }).eq('id', f.id);
      noBackdrop.push(f.name);
      console.log(`⚠ ${f.name} — no backdrop found, shape fixed but image unchanged`);
    }
  }

  console.log(`\nDone.`);
  if (noBackdrop.length) {
    console.log(`\nNeeds manual cover image (${noBackdrop.length}):`);
    noBackdrop.forEach(n => console.log(' ', n));
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
