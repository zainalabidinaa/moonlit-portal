import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';

const FILM_COLLECTIONS_ID = '451a741e-3572-44ab-95b8-79fc74965c91';
const INSERT_AT = 13; // Film Collections' current sort_order

// Genre bundle folders to promote, in desired collection order.
const TARGET_FOLDER_IDS = [
  'c5c8b407-2ee2-42c9-a910-c080936ccbb1', // Action Essentials
  'f4ccecc3-5e85-4f38-a8a5-5c95f70584d2', // Comedy Favorites
  'ab15d8d4-1fb9-4bdd-97d3-00efddb62f13', // Crime Vault
  '21437a31-d417-467b-a0ba-8e2fd0c2b139', // Drama Must-Sees
  '5f1eef3f-c1d6-4ff0-852b-27d9d1d49197', // Family & Animation Collections
  '4dddf2f4-6362-4e60-bb2d-2d8b09edcb0e', // Fantasy Realm
  'c40e6142-bd0c-4a03-8271-2a02c44e94df', // Horror Vault
  'e9ec4fb5-eb88-410b-b465-da6627bbed34', // Mystery Vault
  'b78dfc08-ebea-4b17-a89c-d42a6dac911c', // Sci-Fi Vault
  '51650c66-d923-4e6d-9a5d-69cdf3531f3e', // Thriller Picks
  '932303ec-cf60-456b-8728-5c4bb3ad95a4', // War Stories
];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function fail(label, error) {
  throw new Error(`${label}: ${error.message}`);
}

async function main() {
  // ── Load current state ────────────────────────────────────────────────────
  const { data: collections, error: colErr } = await sb
    .from('collections').select('*').order('sort_order', { ascending: true });
  if (colErr) fail('load collections', colErr);

  const { data: folders, error: folErr } = await sb
    .from('folders').select('*').in('id', TARGET_FOLDER_IDS);
  if (folErr) fail('load folders', folErr);

  const foldersById = new Map(folders.map(f => [f.id, f]));
  const missing = TARGET_FOLDER_IDS.filter(id => !foldersById.has(id));
  if (missing.length) throw new Error(`missing folders: ${missing.join(', ')}`);

  const collectionsByName = new Map(
    collections.map(c => [c.name.trim().toLowerCase(), c])
  );

  const alreadyPromoted = folders.filter(f => f.collection_id !== FILM_COLLECTIONS_ID);
  const toPromote = TARGET_FOLDER_IDS
    .map(id => foldersById.get(id))
    .filter(f => f.collection_id === FILM_COLLECTIONS_ID
      || !collectionsByName.has(f.name.trim().toLowerCase()));

  console.log('Before:');
  for (const f of TARGET_FOLDER_IDS.map(id => foldersById.get(id))) {
    console.log(`  ${f.name} — parent ${f.collection_id === FILM_COLLECTIONS_ID ? 'Film Collections' : f.collection_id}`);
  }
  if (alreadyPromoted.length === TARGET_FOLDER_IDS.length) {
    console.log('\nAll folders already re-parented. Nothing to do.');
    return;
  }

  // ── 1. Shift sort_order of collections at/after INSERT_AT ────────────────
  const needsShift = !collections.some(
    c => TARGET_FOLDER_IDS.some(id =>
      foldersById.get(id).name.trim().toLowerCase() === c.name.trim().toLowerCase())
  );
  if (needsShift) {
    const toShift = collections
      .filter(c => c.sort_order >= INSERT_AT)
      .sort((a, b) => b.sort_order - a.sort_order);
    console.log(`\nShifting ${toShift.length} collections by +${TARGET_FOLDER_IDS.length}...`);
    for (const c of toShift) {
      const { error } = await sb
        .from('collections')
        .update({ sort_order: c.sort_order + TARGET_FOLDER_IDS.length })
        .eq('id', c.id);
      if (error) fail(`shift ${c.name}`, error);
      console.log(`  ${c.name}: ${c.sort_order} → ${c.sort_order + TARGET_FOLDER_IDS.length}`);
    }
  } else {
    console.log('\nShift already applied (new collections detected) — skipping.');
  }

  // ── 2. Insert new collections + re-parent folders ─────────────────────────
  console.log('\nPromoting folders...');
  for (let i = 0; i < TARGET_FOLDER_IDS.length; i++) {
    const folder = foldersById.get(TARGET_FOLDER_IDS[i]);
    const key = folder.name.trim().toLowerCase();
    let collection = collectionsByName.get(key);

    if (!collection) {
      const { data, error } = await sb
        .from('collections')
        .insert({
          name: folder.name,
          sort_order: INSERT_AT + i,
          view_mode: 'FOLLOW_LAYOUT',
          enabled: true,
          show_on_home: true,
          backdrop_image: folder.hero_backdrop ?? folder.cover_image ?? null,
        })
        .select()
        .single();
      if (error) fail(`insert collection ${folder.name}`, error);
      collection = data;
      collectionsByName.set(key, collection);
      console.log(`  + collection "${collection.name}" (${collection.id}) @ sort ${collection.sort_order}`);
    } else {
      console.log(`  = collection "${collection.name}" already exists (${collection.id})`);
    }

    if (folder.collection_id !== collection.id) {
      const { error } = await sb
        .from('folders')
        .update({ collection_id: collection.id, hide_title: true, sort_order: 0 })
        .eq('id', folder.id);
      if (error) fail(`re-parent ${folder.name}`, error);
      console.log(`    ↳ folder re-parented`);
    } else {
      console.log(`    ↳ folder already re-parented`);
    }
  }

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  const { data: after, error: aftErr } = await sb
    .from('collections').select('id, name, sort_order, enabled, show_on_home')
    .order('sort_order', { ascending: true });
  if (aftErr) fail('reload collections', aftErr);

  const { count: remaining } = await sb
    .from('folders').select('id', { count: 'exact', head: true })
    .eq('collection_id', FILM_COLLECTIONS_ID);

  console.log('\nAfter — collections:');
  for (const c of after) {
    console.log(`  [${String(c.sort_order).padStart(2)}] ${c.name}${c.show_on_home ? ' (home)' : ''}${c.enabled ? '' : ' (disabled)'}`);
  }
  console.log(`\nFilm Collections now holds ${remaining} folders.`);

  for (const id of TARGET_FOLDER_IDS) {
    const folder = foldersById.get(id);
    const { count } = await sb
      .from('folder_catalogs').select('id', { count: 'exact', head: true })
      .eq('folder_id', id);
    console.log(`  ${folder.name}: ${count} catalogs intact`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
