// Seeds the "Languages" collection with a parent folder per language and,
// for the 5 languages with real MDBList curation (see the accompanying
// mdblist-language-sources.md), a child folder per curated row — each child
// gets exactly one folder_catalogs attachment. This is what
// LanguageCatalog.browseRails(for:in:) in the app reads: a language's own
// folder's child folders become individually titled rails (the child's
// `name` IS the rail title), falling back to one merged rail when a
// language folder has catalogs attached directly and no children.
//
// Unlike genre-setup.mjs / repair-genre-sources.mjs / audit-genre-sources.mjs
// (which hardcode the service-role key in plaintext — a real exposure,
// flagged separately), this script reads it from the environment:
//
//   SUPABASE_SERVICE_ROLE_KEY=<key> node language-hub-setup.mjs
//
// Idempotent: re-running with the same data updates in place rather than
// duplicating rows (matched by normalized name under the right parent).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  console.error('Run as: SUPABASE_SERVICE_ROLE_KEY=<key> node language-hub-setup.mjs');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Matches TMDBLanguageIDs.canonicalOrder's naming exactly — LanguageCatalog
// matches on normalized folder name against the canonical language name.
const LANGUAGES = {
  Korean: [
    ['Popular Korean Movies', '75500', 'movie'],
    ['Latest Korean Movies', '75496', 'movie'],
    ['Top Rated Korean Movies', '12721', 'movie'],
    ['Popular Korean Shows', '75497', 'series'],
    ['Top Rated Korean TV Shows', '3584', 'series'],
    ['Korean Drama Shows', '75563', 'series'],
    ['Korean Action Shows', '75506', 'series'],
    ['Korean Thriller Shows', '75566', 'series'],
    ['Korean Romance Shows', '75567', 'series'],
    ['Korean Netflix', '17204', 'series'],
  ],
  Indian: [
    ['New Hindi Movies', '32281', 'movie'],
    ['Popular Indian Movies', '21009', 'movie'],
    ['Latest Hindi Movies', '20956', 'movie'],
    ['New Hindi Series', '89471', 'series'],
    ['Hindi Shows', '20958', 'series'],
    ['HindiTV', '6483', 'series'],
  ],
  Japanese: [
    ['Seasonal Japanese Dramas', '4326', 'series'],
    ['New Japanese Movies', '4527', 'movie'],
    ['Top 100 Japanese Films', '6468', 'movie'],
    ['Japanese Live Action Movies', '10338', 'movie'],
    ['Japanese Live Action Shows', '10337', 'series'],
    ['New Japanese Anime', '8808', 'series'],
  ],
  Mandarin: [
    ['Best Chinese Movies', '2336', 'movie'],
    ['New Chinese Movies', '4570', 'movie'],
    ['Chinese Movies', '124970', 'movie'],
    ['Seasonal Chinese Dramas', '4328', 'series'],
    ['Donghua Shows', '10199', 'series'],
    ['Donghua Movies', '10201', 'movie'],
  ],
  Arabic: [
    ['Films in Arabic', '63160', 'movie'],
    ['Arabic TV Shows', '19413', 'series'],
    ['Egypt Comedy Movies', '186696', 'movie'],
    ['Egypt Drama Movies', '186677', 'movie'],
    ['Best Egyptian Movies', '185030', 'movie'],
    ['New Egyptian Movies', '185031', 'movie'],
    ['Best Egyptian Shows', '185033', 'series'],
    ['New Egyptian Shows', '185034', 'series'],
    ['Egyptian Comedy', '130700', 'movie'],
    ['Arab Horror', '146471', 'movie'],
    ['Saudi Films', '137494', 'movie'],
    ['Palestinian Movies', '156972', 'movie'],
    ['Lebanese Movies', '156973', 'movie'],
  ],
};

async function findOrCreateCollection(name) {
  const { data: existing, error: findErr } = await sb.from('collections').select('*');
  if (findErr) throw findErr;
  const hit = existing.find((c) => normalize(c.name) === normalize(name));
  if (hit) {
    console.log(`Collection "${name}" already exists (${hit.id})`);
    return hit.id;
  }
  const sortOrder = existing.length;
  const { data, error } = await sb
    .from('collections')
    .insert({ name, view_mode: 'FOLLOW_LAYOUT', sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  console.log(`Created collection "${name}" (${data.id})`);
  return data.id;
}

async function findOrCreateFolder(collectionId, name, parentFolderId, sortOrder) {
  const { data: existing, error: findErr } = await sb
    .from('folders')
    .select('*')
    .eq('collection_id', collectionId);
  if (findErr) throw findErr;
  const hit = existing.find(
    (f) => normalize(f.name) === normalize(name) && (f.parent_folder_id ?? null) === (parentFolderId ?? null)
  );
  if (hit) return hit.id;
  const { data, error } = await sb
    .from('folders')
    .insert({
      collection_id: collectionId,
      name,
      parent_folder_id: parentFolderId ?? null,
      tile_shape: 'POSTER',
      enabled: true,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureFolderCatalog(folderId, catalogId, mediaType) {
  const { data: existing, error: findErr } = await sb
    .from('folder_catalogs')
    .select('*')
    .eq('folder_id', folderId)
    .eq('catalog_id', catalogId)
    .eq('media_type', mediaType);
  if (findErr) throw findErr;
  if (existing.length > 0) return;
  const { error } = await sb.from('folder_catalogs').insert({
    folder_id: folderId,
    catalog_id: catalogId,
    media_type: mediaType,
    genre: null,
  });
  if (error) throw error;
}

async function main() {
  const languagesCollectionId = await findOrCreateCollection('Languages');

  let langSortOrder = 0;
  for (const [languageName, rows] of Object.entries(LANGUAGES)) {
    const languageFolderId = await findOrCreateFolder(
      languagesCollectionId,
      languageName,
      null,
      langSortOrder++
    );
    console.log(`\n${languageName} (${languageFolderId})`);

    let rowSortOrder = 0;
    for (const [title, mdblistId, mediaType] of rows) {
      const childFolderId = await findOrCreateFolder(
        languagesCollectionId,
        title,
        languageFolderId,
        rowSortOrder++
      );
      await ensureFolderCatalog(childFolderId, `mdblist.${mdblistId}`, mediaType);
      console.log(`  ✓ ${title} -> mdblist.${mdblistId} (${mediaType})`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
