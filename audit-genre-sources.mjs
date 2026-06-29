import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';

const CATEGORIES_ID = '0a814bbf-c733-44d3-a70e-889141f8604e';
const GENRES_ID = 'c215fd93-262f-4a66-9b59-108221471e13';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function catKey(c) {
  return `${c.catalog_id}::${c.media_type}::${c.genre ?? ''}`;
}

function srcKey(s) {
  return `${s.provider}::${s.tmdb_id ?? ''}::${s.media_type ?? ''}`;
}

function normName(n) {
  return n.toLowerCase().trim();
}

async function main() {
  console.log('=== Genre Sources Audit ===\n');

  // 1. Fetch Categories data
  const { data: catFolders } = await sb
    .from('folders').select('*').eq('collection_id', CATEGORIES_ID).order('name');
  if (!catFolders) { console.error('Failed to load Categories folders'); return; }

  const catIds = catFolders.map(f => f.id);
  const [catCatsRes, catSrcsRes] = await Promise.all([
    catIds.length ? sb.from('folder_catalogs').select('*').in('folder_id', catIds) : { data: [] },
    catIds.length ? sb.from('folder_sources').select('*').in('folder_id', catIds) : { data: [] },
  ]);
  const catCats = catCatsRes.data ?? [];
  const catSrcs = catSrcsRes.data ?? [];

  // Build lookup: normalized name → { folder, catalogs, sources }
  const catMap = new Map();
  for (const f of catFolders) {
    const nm = normName(f.name);
    catMap.set(nm, {
      folder: f,
      catalogs: catCats.filter(c => c.folder_id === f.id),
      sources: catSrcs.filter(s => s.folder_id === f.id),
    });
  }

  // 2. Fetch Genres data
  const { data: genFolders } = await sb
    .from('folders').select('*').eq('collection_id', GENRES_ID).order('name');
  if (!genFolders) { console.error('Failed to load Genres folders'); return; }

  const genIds = genFolders.map(f => f.id);
  const [genCatsRes, genSrcsRes] = await Promise.all([
    genIds.length ? sb.from('folder_catalogs').select('*').in('folder_id', genIds) : { data: [] },
    genIds.length ? sb.from('folder_sources').select('*').in('folder_id', genIds) : { data: [] },
  ]);
  const genCats = genCatsRes.data ?? [];
  const genSrcs = genSrcsRes.data ?? [];

  const genMap = new Map();
  for (const f of genFolders) {
    const nm = normName(f.name);
    genMap.set(nm, {
      folder: f,
      catalogs: genCats.filter(c => c.folder_id === f.id),
      sources: genSrcs.filter(s => s.folder_id === f.id),
    });
  }

  // 3. Compare
  const allNames = new Set([...catMap.keys(), ...genMap.keys()]);
  const sorted = [...allNames].sort();

  let totalSynced = 0, totalMismatches = 0;

  for (const nm of sorted) {
    const cat = catMap.get(nm);
    const gen = genMap.get(nm);

    if (!cat) {
      console.log(`⚠ ORPHAN in Genres (no Categories source): "${gen.folder.name}"`);
      continue;
    }
    if (!gen) {
      console.log(`⚠ MISSING in Genres (never copied):     "${cat.folder.name}"`);
      continue;
    }

    const catCatKeys = new Set(cat.catalogs.map(catKey));
    const genCatKeys = new Set(gen.catalogs.map(catKey));
    const catSrcKeys = new Set(cat.sources.map(srcKey));
    const genSrcKeys = new Set(gen.sources.map(srcKey));

    // Diff catalogs
    const missingCats = cat.catalogs.filter(c => !genCatKeys.has(catKey(c)));
    const extraCats = gen.catalogs.filter(c => !catCatKeys.has(catKey(c)));

    // Diff sources
    const missingSrcs = cat.sources.filter(s => !genSrcKeys.has(srcKey(s)));
    const extraSrcs = gen.sources.filter(s => !catSrcKeys.has(srcKey(s)));

    const hasIssues = missingCats.length > 0 || extraCats.length > 0 ||
                      missingSrcs.length > 0 || extraSrcs.length > 0;

    if (hasIssues) {
      console.log(`\n❌ MISMATCH: "${cat.folder.name}"`);
      for (const c of missingCats) {
        console.log(`   ├─ missing catalog:  ${catKey(c)}`);
      }
      for (const c of extraCats) {
        console.log(`   ├─ extra catalog:    ${catKey(c)}`);
      }
      for (const s of missingSrcs) {
        console.log(`   ├─ missing source:   ${srcKey(s)}${s.title ? ` "${s.title}"` : ''}`);
      }
      for (const s of extraSrcs) {
        console.log(`   ├─ extra source:     ${srcKey(s)}${s.title ? ` "${s.title}"` : ''}`);
      }
      totalMismatches++;
    } else {
      totalSynced++;
    }
  }

  // 4. Summary
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\nSUMMARY`);
  console.log(`  Categories folders: ${catFolders.length}`);
  console.log(`  Genres folders:     ${genFolders.length}`);
  console.log(`  ✅ In sync:         ${totalSynced}`);
  console.log(`  ❌ Mismatches:      ${totalMismatches}`);
  console.log(`\n=== Done ===`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
