#!/usr/bin/env node
/**
 * Seeds and maintains the "Asian" home preset (Home / Movies / Series).
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node asian-preset-setup.mjs             # dry run (default)
 *   SUPABASE_SERVICE_ROLE_KEY=... node asian-preset-setup.mjs --apply     # write
 *   ... --activate          # flip the preset live + normalize sort orders (after review)
 *   ... --skip-preflight    # skip live catalog validation
 *   ... --skip-anime-repair # skip filling the Anime hub's empty folders
 *
 * Idempotent: rows are matched by stable `external_id`s / `source_widget_id`s.
 * Re-running updates in place; admin placement (sort order, style) is never
 * clobbered. Everything it writes is the shared Supabase data every client
 * (portal, iOS, macOS, Android TV, web) already reads.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIO_BASE = 'https://aiometadata.fortheweak.cloud/stremio/1bf2cd94-2057-4992-9ed7-a8464f12e4a4';
const ASIAN_PRESET_ID = '1f96d63b-21f5-40de-aa63-9304d56768c4';
const ANIME_COLLECTION_ID = '0181f526-7e74-478a-8cf6-99b545ea20f7';
const COVERS = 'https://raw.githubusercontent.com/zainalabidinaa/moonlit-covers/main/languages';
const PREFIX = 'moonlit:asian:';

const APPLY = process.argv.includes('--apply');
const ACTIVATE = process.argv.includes('--activate');
const SKIP_PREFLIGHT = process.argv.includes('--skip-preflight');
const SKIP_ANIME_REPAIR = process.argv.includes('--skip-anime-repair');
const REORDER = process.argv.includes('--reorder');

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run as: SUPABASE_SERVICE_ROLE_KEY=<key> node asian-preset-setup.mjs [--apply]');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TAB_FLAGS = {
  home: { ios: 'show_ios_home', mac: 'show_mac_home' },
  movies: { ios: 'show_ios_movies', mac: 'show_mac_movies' },
  series: { ios: 'show_ios_series', mac: 'show_mac_series' },
};

const catalog = (catalogId, mediaType) => ({ catalogId, mediaType });
const folder = (name, sources, cover = null) => ({ name, sources, cover });
const rail = (slug, mediaType, params) => ({
  catalogId: `tmdb.discover.custom.${slug}`,
  mediaType,
  filterParams: params,
});

/** Southeast Asia rails — fetched by the app straight from TMDB (filter_params),
 *  no addon involved. Thresholds verified live: every language returns depth. */
const seaRails = (slug, code) => [
  rail(`sea-${slug}-popular-movies`, 'movie', { with_original_language: code, sort_by: 'popularity.desc', 'vote_count.gte': '5', include_adult: 'false' }),
  rail(`sea-${slug}-top-movies`, 'movie', { with_original_language: code, sort_by: 'vote_average.desc', 'vote_count.gte': '20', include_adult: 'false' }),
  rail(`sea-${slug}-popular-shows`, 'series', { with_original_language: code, sort_by: 'popularity.desc', 'vote_count.gte': '3', include_adult: 'false' }),
  rail(`sea-${slug}-top-shows`, 'series', { with_original_language: code, sort_by: 'vote_average.desc', 'vote_count.gte': '10', include_adult: 'false' }),
];
const seaMovieRails = (slug, code) => [
  rail(`sea-${slug}-popular-movies`, 'movie', { with_original_language: code, sort_by: 'popularity.desc', 'vote_count.gte': '5', include_adult: 'false' }),
  rail(`sea-${slug}-top-movies`, 'movie', { with_original_language: code, sort_by: 'vote_average.desc', 'vote_count.gte': '20', include_adult: 'false' }),
];

const SEA = [
  { name: 'Thai', slug: 'th', code: 'th', cover: `${COVERS}/Thailand.jpeg` },
  { name: 'Filipino', slug: 'tl', code: 'tl', cover: `${COVERS}/Asian%20Wide.jpg` },
  { name: 'Indonesian', slug: 'id', code: 'id', cover: `${COVERS}/Asian%20Wide.jpg` },
  { name: 'Vietnamese', slug: 'vi', code: 'vi', cover: `${COVERS}/Asian%20Wide.jpg` },
];

const md = (id, mediaType = 'movie') => catalog(`mdblist.${id}`, mediaType);

const WIDGETS = [
  // ── HOME — one standard row widget per category (single folder, all of the
  //    category's sources merged into that one row; no hub tiles). ──────────
  {
    tab: 'home', slug: 'home-k-drama', title: 'K-Drama', expand: false,
    folders: [
      folder('K-Drama', [catalog('letterboxd.bU4aw', 'all'), catalog('letterboxd.tkcY0', 'all')], `${COVERS}/Kdrama.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'home-kdrama-top', title: '150 Highest-Rated Kdramas', expand: false,
    folders: [
      folder('150 Highest-Rated Kdramas', [catalog('letterboxd.bU4aw', 'all')], `${COVERS}/Kdrama.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'home-j-drama', title: 'J-Drama', expand: false,
    folders: [
      folder('J-Drama', [catalog('letterboxd.rNBAM', 'all'), md(127250, 'series')], `${COVERS}/Jdrama.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'home-c-drama', title: 'C-Drama', expand: false,
    folders: [
      folder('C-Drama', [catalog('letterboxd.cWV7y', 'all'), md(93371, 'series')], `${COVERS}/Cdrama.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'korean', title: 'Korean', expand: false,
    folders: [
      folder('Korean', [
        md(75500), md(75496), md(12721),
        md(75497, 'series'), md(3584, 'series'), md(75563, 'series'),
        md(75506, 'series'), md(75566, 'series'), md(75567, 'series'), md(17204, 'series'),
      ], `${COVERS}/Korea.jpeg`),
    ],
  },
  {
    tab: 'home', slug: 'japanese', title: 'Japanese', expand: false,
    folders: [
      folder('Japanese', [
        md(4326, 'series'), md(4527), md(6468), md(10338),
        md(10337, 'series'), md(8808, 'series'), md(41528),
      ], `${COVERS}/Asian%20Wide.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'home-jp-crime', title: 'Japanese Crime & Mystery', expand: false,
    folders: [
      folder('Japanese Crime & Mystery', [
        rail('jp-crime-mystery', 'movie', { with_original_language: 'ja', with_genres: '80|9648', sort_by: 'popularity.desc', 'vote_count.gte': '30', include_adult: 'false' }),
      ], `${COVERS}/Asian%20Wide.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'chinese', title: 'Chinese', expand: false,
    folders: [
      folder('Chinese', [
        md(2336), md(4570), md(124970), md(4328, 'series'), md(10199, 'series'), md(10201),
      ], `${COVERS}/China.jpeg`),
    ],
  },
  {
    tab: 'home', slug: 'southeast-asia', title: 'Southeast Asia', expand: false,
    folders: [
      folder('Southeast Asia', SEA.flatMap(({ slug, code }) => seaRails(slug, code)), `${COVERS}/Thailand.jpeg`),
    ],
  },
  {
    tab: 'home', slug: 'home-thai-action', title: 'Thai Action', expand: false,
    folders: [
      folder('Thai Action', [
        rail('thai-action', 'movie', { with_original_language: 'th', with_genres: '28', sort_by: 'popularity.desc', 'vote_count.gte': '5', include_adult: 'false' }),
      ], `${COVERS}/Thailand.jpeg`),
    ],
  },
  {
    tab: 'home', slug: 'home-anime', title: 'Anime', expand: false,
    folders: [
      folder('Anime', [
        catalog('tmdb.discover.movie.anime-movies.8caaddea', 'movie'),
        catalog('tmdb.discover.series.anime-series.193e8308', 'series'),
        catalog('trakt.list.33032836', 'movie'),
        catalog('trakt.list.33032835', 'series'),
        catalog('tmdb.discover.movie.top-anime-movies.ef410dcc', 'movie'),
        catalog('tmdb.discover.series.top-anime-series.63ff4f07', 'series'),
        catalog('tmdb.discover.movie.upcoming-anime-movies.e57db259', 'movie'),
        catalog('tmdb.discover.series.upcoming-anime-series.e71e22cf', 'series'),
        catalog('trakt.list.27063895', 'series'),
        catalog('trakt.list.32351243', 'movie'),
        catalog('trakt.list.34815415', 'series'),
        catalog('trakt.list.34815417', 'series'),
        catalog('trakt.list.34815419', 'series'),
        catalog('trakt.list.34815421', 'series'),
      ], `${COVERS}/Asian%20Wide.jpg`),
    ],
  },

  {
    tab: 'home', slug: 'home-anime-top100-movies', title: '100 Best Anime Movies', expand: false,
    folders: [
      folder('100 Best Anime Movies', [catalog('trakt.list.23438792', 'movie')], `${COVERS}/Asian%20Wide.jpg`),
    ],
  },
  {
    tab: 'home', slug: 'home-ghibli', title: 'Studio Ghibli', expand: false,
    folders: [
      folder('Studio Ghibli', [
        rail('ghibli', 'movie', { with_companies: '10342', sort_by: 'vote_average.desc', 'vote_count.gte': '50', include_adult: 'false' }),
      ], `${COVERS}/Asian%20Wide.jpg`),
    ],
  },

  // ── MOVIES (expanded rows) ────────────────────────────────────────────────
  {
    tab: 'movies', slug: 'korean-movies', title: 'Korean Movies',
    folders: [
      folder('Popular Korean Movies', [md(75500)]),
      folder('Latest Korean Movies', [md(75496)]),
      folder('Top Rated Korean Movies', [md(12721)]),
    ],
  },
  {
    tab: 'movies', slug: 'japanese-movies', title: 'Japanese Movies',
    folders: [
      folder('New Japanese Movies', [md(4527)]),
      folder('Top 100 Japanese Films', [md(6468)]),
      folder('Japanese Live Action Movies', [md(10338)]),
      folder('Japanese Horror', [md(41528)]),
    ],
  },
  {
    tab: 'movies', slug: 'chinese-movies', title: 'Chinese Movies',
    folders: [
      folder('Best Chinese Movies', [md(2336)]),
      folder('New Chinese Movies', [md(4570)]),
      folder('Chinese Movies', [md(124970)]),
    ],
  },
  {
    tab: 'movies', slug: 'anime-movies', title: 'Anime Movies',
    folders: [
      folder('Anime Movies', [catalog('tmdb.discover.movie.anime-movies.8caaddea', 'movie')]),
      folder('Top Anime Movies', [catalog('tmdb.discover.movie.top-anime-movies.ef410dcc', 'movie')]),
      folder('Upcoming Anime Movies', [catalog('tmdb.discover.movie.upcoming-anime-movies.e57db259', 'movie')]),
      folder('Trending Anime Movies', [catalog('trakt.list.33032836', 'movie')]),
    ],
  },
  {
    tab: 'movies', slug: 'asian-horror', title: 'Asian Horror',
    folders: [
      folder('Japanese Horror', [md(41528)]),
      folder('Korean Horror', [md(41529)]),
      folder('International Horror · Japanese', [catalog('trakt.list.9750663.movies', 'movie')]),
      folder('Japanese Horror · Extended', [catalog('trakt.list.31596343.movies', 'movie')]),
      folder('International Horror · Korean', [catalog('trakt.list.23359384.movies', 'movie')]),
      folder('Korean Horror · Extended', [catalog('trakt.list.5365902.movies', 'movie')]),
    ],
  },
  {
    tab: 'movies', slug: 'sea-movies', title: 'Southeast Asia Movies',
    folders: SEA.map(({ name, slug, code }) => folder(`${name} Movies`, seaMovieRails(slug, code))),
  },

  // ── SERIES (expanded rows) ────────────────────────────────────────────────
  {
    tab: 'series', slug: 'k-drama', title: 'K-Drama',
    folders: [
      folder('150 Highest-Rated Kdramas on Letterboxd', [catalog('letterboxd.bU4aw', 'all')]),
      folder('K-drama (Korean Dramas/Korean Series)', [catalog('letterboxd.tkcY0', 'all')]),
    ],
  },
  {
    tab: 'series', slug: 'j-drama', title: 'J-Drama',
    folders: [
      folder('J-Drama', [catalog('letterboxd.rNBAM', 'all')]),
      folder('JDRAMA', [md(127250, 'series')]),
    ],
  },
  {
    tab: 'series', slug: 'c-drama', title: 'C-Drama',
    folders: [
      folder('C-drama (Chinese drama series)', [catalog('letterboxd.cWV7y', 'all')]),
      folder('Cdrama - Released Date', [md(93371, 'series')]),
    ],
  },
  {
    tab: 'series', slug: 'anime-series', title: 'Anime Series',
    folders: [
      folder('Anime Series', [catalog('tmdb.discover.series.anime-series.193e8308', 'series')]),
      folder('Top Anime Series', [catalog('tmdb.discover.series.top-anime-series.63ff4f07', 'series')]),
      folder('Upcoming Anime Series', [catalog('tmdb.discover.series.upcoming-anime-series.e71e22cf', 'series')]),
      folder('Trending Anime Shows', [catalog('trakt.list.33032835', 'series')]),
      folder('100 Animes To Watch Before You Die', [catalog('trakt.list.5707382', 'series')]),
    ],
  },
  {
    tab: 'series', slug: 'korean-shows', title: 'Korean Shows',
    folders: [
      folder('Popular Korean Shows', [md(75497, 'series')]),
      folder('Top Rated Korean TV Shows', [md(3584, 'series')]),
      folder('Korean Drama Shows', [md(75563, 'series')]),
      folder('Korean Action Shows', [md(75506, 'series')]),
      folder('Korean Thriller Shows', [md(75566, 'series')]),
      folder('Korean Romance Shows', [md(75567, 'series')]),
    ],
  },
  {
    tab: 'series', slug: 'jp-cn-shows', title: 'Japanese & Chinese Shows',
    folders: [
      folder('Seasonal Japanese Dramas', [md(4326, 'series')]),
      folder('Japanese Live Action Shows', [md(10337, 'series')]),
      folder('Seasonal Chinese Dramas', [md(4328, 'series')]),
      folder('Donghua Shows', [md(10199, 'series')]),
    ],
  },
];

/** The Anime hub collection's three folders are empty in the DB today (they
 *  render blank tiles). Fill them with the verified TMDb anime catalogs. */
const ANIME_REPAIR = [
  { folder: 'Latest Release', add: [catalog('tmdb.discover.movie.anime-movies.8caaddea', 'movie'), catalog('tmdb.discover.series.anime-series.193e8308', 'series')] },
  { folder: 'Top Rated All-Time', add: [catalog('tmdb.discover.movie.top-anime-movies.ef410dcc', 'movie'), catalog('tmdb.discover.series.top-anime-series.63ff4f07', 'series')] },
  { folder: 'Upcoming', add: [catalog('tmdb.discover.movie.upcoming-anime-movies.e57db259', 'movie'), catalog('tmdb.discover.series.upcoming-anime-series.e71e22cf', 'series')] },
];

/** Dead/mislabeled sources to strip from reused collections. `mdblist.144727`
 *  ("kdrama ranked") no longer resolves to a kdrama list — aiometadata falls
 *  back to a generic top-series list (Breaking Bad, Planet Earth II, …), which
 *  polluted the reused Asian Dramas K-Drama row. */
const SOURCE_REMOVALS = [
  { collectionName: 'Asian Dramas', folderName: 'K-Drama', catalogId: 'mdblist.144727' },
];

/** Preset items from earlier layout iterations that no longer exist in the
 *  plan (the reused multi-folder "Asian Dramas" / "Anime" hub widgets, now
 *  replaced by single standard row widgets). Removed on apply. */
const RETIRED_WIDGETS = [
  'moonlit:asian:widget:home:asian-dramas',
  'moonlit:asian:widget:home:anime',
];

// ── helpers ─────────────────────────────────────────────────────────────────

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const normalizeName = (s) => (s || '').replace(/[\u200E\u200F\uFEFF]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const collectionExternalId = (widget) => `${PREFIX}collection:${widget.slug}`;
const folderExternalId = (widget, f) => `${PREFIX}folder:${widget.slug}:${slugify(f.name)}`;
const presetWidgetId = (widget) => `${PREFIX}widget:${widget.tab}:${widget.slug}`;

async function chunked(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

function readTMDBKey() {
  const p = path.resolve(__dirname, '../Packages/MoonlitCore/Sources/MoonlitCore/Supabase/SupabaseConfig.swift');
  try {
    const m = fs.readFileSync(p, 'utf8').match(/tmdbApiKey\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// ── preflight ───────────────────────────────────────────────────────────────

async function preflight() {
  const specs = [];
  for (const w of WIDGETS) for (const f of w.folders || []) for (const s of f.sources) specs.push(s);
  const unique = new Map();
  for (const s of specs) unique.set(`${s.mediaType}:${s.catalogId}`, s);
  const list = [...unique.values()];

  const addon = list.filter((s) => !s.filterParams);
  const rails = list.filter((s) => s.filterParams);
  const failures = [];

  console.log(`Preflight: ${addon.length} addon catalogs · ${rails.length} TMDB rails`);
  const addonResults = await chunked(addon, 4, async (s) => {
    let lastError = 'unknown failure';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${AIO_BASE}/catalog/${s.mediaType}/${s.catalogId}.json`, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const n = (json.metas || []).length;
        if (!n) throw new Error('0 items');
        return { s, n };
      } catch (e) {
        lastError = e.message;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    failures.push(`${s.mediaType}/${s.catalogId}: ${lastError}`);
    return null;
  });
  for (const r of addonResults.filter(Boolean)) {
    if (r.n < 3) console.log(`  note: ${r.s.catalogId} returns only ${r.n} item(s)`);
  }

  if (rails.length) {
    const tmdbKey = readTMDBKey();
    if (!tmdbKey) {
      failures.push('TMDB API key not found in SupabaseConfig.swift — cannot preflight rails (use --skip-preflight to override)');
    } else {
      await chunked(rails, 4, async (s) => {
        try {
          const kind = s.mediaType === 'series' ? 'tv' : 'movie';
          const params = new URLSearchParams({ ...s.filterParams, api_key: tmdbKey });
          const res = await fetch(`https://api.themoviedb.org/3/discover/${kind}?${params}`, { signal: AbortSignal.timeout(25000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!json.total_results) throw new Error('0 results');
          return json.total_results;
        } catch (e) {
          failures.push(`${s.catalogId}: ${e.message}`);
          return null;
        }
      });
    }
  }

  if (failures.length) {
    console.error(`\nPreflight failed for ${failures.length} source(s):`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('\nNothing was written. Fix the plan or use --skip-preflight to override.');
    process.exit(1);
  }
  console.log(`Preflight OK — ${addon.length + rails.length} sources all return content.\n`);
}

// ── db sync ─────────────────────────────────────────────────────────────────

async function verifyPreset() {
  const { data, error } = await sb.from('home_presets').select('id, slug, name, is_active, sort_order').eq('id', ASIAN_PRESET_ID).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Preset ${ASIAN_PRESET_ID} not found`);
  if (data.slug !== 'asian') throw new Error(`Preset ${ASIAN_PRESET_ID} has slug "${data.slug}", expected "asian"`);
  return data;
}

async function syncCollection(widget, tab, nextCollectionOrder) {
  if (widget.reuse) return { id: widget.reuse, action: 'reuse' };

  const externalId = collectionExternalId(widget);
  const { data: existing } = await sb.from('collections').select('id, name').eq('external_id', externalId).maybeSingle();
  const flags = { [TAB_FLAGS[tab].ios]: true, [TAB_FLAGS[tab].mac]: true };

  if (existing) {
    if (APPLY) {
      const { error } = await sb.from('collections').update({ name: widget.title, status: 'published', ...flags }).eq('id', existing.id);
      if (error) throw new Error(`collection update: ${error.message}`);
    }
    return { id: existing.id, action: 'update' };
  }

  if (!APPLY) return { id: null, action: 'create' };
  const { data, error } = await sb.from('collections').insert({
    name: widget.title,
    view_mode: 'FOLLOW_LAYOUT',
    status: 'published',
    sort_order: nextCollectionOrder,
    external_id: externalId,
    ...flags,
  }).select('id').single();
  if (error || !data) throw new Error(`collection insert: ${error?.message}`);
  return { id: data.id, action: 'create' };
}

async function syncFolders(widget, collectionId) {
  const specs = widget.folders || [];
  const { data: existingFolders } = await sb.from('folders').select('id, external_id').eq('collection_id', collectionId);
  const byExternal = new Map((existingFolders || []).filter((f) => f.external_id).map((f) => [f.external_id, f.id]));
  const plannedIds = new Set();
  let created = 0, updated = 0, sources = 0;

  for (let i = 0; i < specs.length; i++) {
    const f = specs[i];
    const externalId = folderExternalId(widget, f);
    plannedIds.add(externalId);
    const patch = {
      collection_id: collectionId,
      name: f.name,
      cover_image: f.cover ?? null,
      tile_shape: 'poster',
      sort_order: i,
    };

    let folderId = byExternal.get(externalId) ?? null;
    if (folderId) {
      updated++;
      if (APPLY) {
        const { error } = await sb.from('folders').update(patch).eq('id', folderId);
        if (error) throw new Error(`folder update (${f.name}): ${error.message}`);
      }
    } else {
      created++;
      if (APPLY) {
        const { data, error } = await sb.from('folders').insert({ ...patch, external_id: externalId }).select('id').single();
        if (error || !data) throw new Error(`folder insert (${f.name}): ${error?.message}`);
        folderId = data.id;
      }
    }

    if (APPLY && folderId) {
      await sb.from('folder_catalogs').delete().eq('folder_id', folderId);
      await sb.from('folder_sources').delete().eq('folder_id', folderId);
      const rows = f.sources.map((s) => ({
        folder_id: folderId,
        catalog_id: s.catalogId,
        media_type: s.mediaType,
        genre: null,
        extras: null,
        filter_params: s.filterParams ?? null,
      }));
      const { error } = await sb.from('folder_catalogs').insert(rows);
      if (error) throw new Error(`sources insert (${f.name}): ${error.message}`);
    }
    sources += f.sources.length;
  }

  // Prune imported folders that vanished from the plan (only ours).
  for (const [externalId, folderId] of byExternal) {
    if (!externalId.startsWith(`${PREFIX}folder:${widget.slug}:`) || plannedIds.has(externalId)) continue;
    if (APPLY) {
      await sb.from('folder_catalogs').delete().eq('folder_id', folderId);
      await sb.from('folder_sources').delete().eq('folder_id', folderId);
      await sb.from('folders').delete().eq('id', folderId);
    }
    console.log(`  prune: ${APPLY ? 'removed' : 'would remove'} stale folder ${externalId}`);
  }

  return { created, updated, sources };
}

async function upsertPresetItem(widget, collectionId, order, existingByKey) {
  const sourceWidgetId = presetWidgetId(widget);
  const existing = existingByKey.get(sourceWidgetId);
  const patch = {
    title: widget.title,
    data_source: { kind: 'collection', collectionId },
    expand_folders: widget.expand ?? (widget.tab !== 'home'),
  };

  if (existing) {
    if (APPLY) {
      const { error } = await sb.from('home_preset_items').update(patch).eq('id', existing.id);
      if (error) throw new Error(`preset item update (${widget.title}): ${error.message}`);
    }
    return 'updated';
  }

  if (!APPLY) return 'created';
  const { error } = await sb.from('home_preset_items').insert({
    preset_id: ASIAN_PRESET_ID,
    tab: widget.tab,
    media_type: null,
    style: 'standard',
    sort_order: order,
    source_widget_id: sourceWidgetId,
    ...patch,
  });
  if (error) throw new Error(`preset item insert (${widget.title}): ${error.message}`);
  return 'created';
}

/** Strips the dead/mislabeled sources listed in `SOURCE_REMOVALS` from reused
 *  collections. Idempotent — reports "already absent" on a re-run. */
async function removeBadSources() {
  const lines = [];
  const { data: collections } = await sb.from('collections').select('id, name');
  for (const removal of SOURCE_REMOVALS) {
    const collection = (collections || []).find((c) => normalizeName(c.name) === normalizeName(removal.collectionName));
    if (!collection) { lines.push(`${removal.collectionName}: collection not found — skipped`); continue; }
    const { data: folders } = await sb.from('folders').select('id, name').eq('collection_id', collection.id);
    const folder = (folders || []).find((f) => normalizeName(f.name) === normalizeName(removal.folderName));
    if (!folder) { lines.push(`${removal.collectionName}/${removal.folderName}: folder not found — skipped`); continue; }
    const { data: existing } = await sb
      .from('folder_catalogs')
      .select('catalog_id')
      .eq('folder_id', folder.id)
      .eq('catalog_id', removal.catalogId);
    if (!existing?.length) {
      lines.push(`${removal.collectionName}/${removal.folderName}: ${removal.catalogId} already absent`);
      continue;
    }
    if (APPLY) {
      const { error } = await sb
        .from('folder_catalogs')
        .delete()
        .eq('folder_id', folder.id)
        .eq('catalog_id', removal.catalogId);
      if (error) throw new Error(`source removal (${removal.catalogId}): ${error.message}`);
    }
    lines.push(`${removal.collectionName}/${removal.folderName}: ${APPLY ? 'removed' : 'would remove'} ${removal.catalogId} (${existing.length} row${existing.length === 1 ? '' : 's'})`);
  }
  return lines;
}

/** Removes preset items from earlier layout iterations (see RETIRED_WIDGETS).
 *  Idempotent — reports "already absent" on a re-run. */
async function removeRetiredItems() {
  const lines = [];
  for (const sourceWidgetId of RETIRED_WIDGETS) {
    const { data } = await sb
      .from('home_preset_items')
      .select('id, title')
      .eq('preset_id', ASIAN_PRESET_ID)
      .eq('source_widget_id', sourceWidgetId);
    if (!data?.length) { lines.push(`${sourceWidgetId}: already absent`); continue; }
    if (APPLY) {
      const { error } = await sb.from('home_preset_items').delete().eq('source_widget_id', sourceWidgetId).eq('preset_id', ASIAN_PRESET_ID);
      if (error) throw new Error(`retired item removal (${sourceWidgetId}): ${error.message}`);
    }
    lines.push(`${APPLY ? 'removed' : 'would remove'} ${data.length} item(s) · ${sourceWidgetId}`);
  }
  return lines;
}

/** One-time (opt-in `--reorder`) renumbering of our own preset items per tab
 *  to match the WIDGETS order — used when a layout rebuild appends new rows
 *  below existing ones. Never touches items we don't own; the default apply
 *  path still preserves admin-arranged order. */
async function reorderItems() {
  const { data: items } = await sb
    .from('home_preset_items')
    .select('id, tab, source_widget_id, sort_order')
    .eq('preset_id', ASIAN_PRESET_ID);
  const lines = [];
  for (const tab of ['home', 'movies', 'series']) {
    const order = WIDGETS.filter((w) => w.tab === tab).map(presetWidgetId);
    const ours = new Map(
      (items || [])
        .filter((i) => i.tab === tab && i.source_widget_id?.startsWith(PREFIX))
        .map((i) => [i.source_widget_id, i])
    );
    let index = 0;
    for (const key of order) {
      const item = ours.get(key);
      if (!item) continue;
      if (item.sort_order !== index) {
        if (APPLY) {
          const { error } = await sb.from('home_preset_items').update({ sort_order: index }).eq('id', item.id);
          if (error) throw new Error(`reorder (${key}): ${error.message}`);
        }
        lines.push(`${tab}: ${key.slice(PREFIX.length)} ${item.sort_order} → ${index}`);
      }
      index++;
    }
  }
  return lines;
}

async function repairAnimeHub() {
  const { data: folders, error } = await sb
    .from('folders')
    .select('id, name')
    .eq('collection_id', ANIME_COLLECTION_ID);
  if (error) throw new Error(`anime repair read: ${error.message}`);

  let added = 0, skipped = 0;
  for (const repair of ANIME_REPAIR) {
    const folder = (folders || []).find((f) => normalizeName(f.name) === normalizeName(repair.folder));
    if (!folder) {
      console.log(`  anime repair: folder "${repair.folder}" not found — skipped`);
      continue;
    }
    const { data: existing } = await sb
      .from('folder_catalogs')
      .select('catalog_id, media_type')
      .eq('folder_id', folder.id);
    const present = new Set((existing || []).map((r) => `${r.media_type}:${r.catalog_id}`));
    for (const s of repair.add) {
      if (present.has(`${s.mediaType}:${s.catalogId}`)) {
        skipped++;
        continue;
      }
      added++;
      if (APPLY) {
        const { error: insertError } = await sb.from('folder_catalogs').insert({
          folder_id: folder.id,
          catalog_id: s.catalogId,
          media_type: s.mediaType,
          genre: null,
          extras: null,
          filter_params: null,
        });
        if (insertError) throw new Error(`anime repair (${repair.folder}): ${insertError.message}`);
      }
    }
  }
  return { added, skipped };
}

async function activate() {
  const patch = { is_active: true, sort_order: 3 };
  if (APPLY) {
    const { error } = await sb.from('home_presets').update(patch).eq('id', ASIAN_PRESET_ID);
    if (error) throw new Error(`activate asian: ${error.message}`);
    const { error: animeError } = await sb.from('home_presets').update({ sort_order: 2 }).eq('slug', 'anime');
    if (animeError) throw new Error(`anime sort: ${animeError.message}`);
  }
  console.log(`\n${APPLY ? 'Activated' : 'Would activate'}: asian (sort 3), anime sort 2.`);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`== Moonlit Asian preset seed — ${APPLY ? 'APPLY' : 'DRY RUN'} ==\n`);

  if (!SKIP_PREFLIGHT) await preflight();
  else console.log('Preflight skipped.\n');

  const preset = await verifyPreset();

  if (RETIRED_WIDGETS.length) {
    console.log('RETIRED WIDGETS');
    for (const line of await removeRetiredItems()) console.log(`  ${line}`);
    console.log('');
  }

  if (SOURCE_REMOVALS.length) {
    console.log('SOURCE CLEANUP');
    for (const line of await removeBadSources()) console.log(`  ${line}`);
    console.log('');
  }

  const { data: existingItems } = await sb
    .from('home_preset_items')
    .select('id, tab, source_widget_id, sort_order')
    .eq('preset_id', ASIAN_PRESET_ID);
  const itemsByKey = new Map((existingItems || []).filter((i) => i.source_widget_id).map((i) => [i.source_widget_id, i]));
  const nextOrderByTab = {};
  for (const tab of ['home', 'movies', 'series']) {
    const max = Math.max(-1, ...(existingItems || []).filter((i) => i.tab === tab).map((i) => i.sort_order ?? 0));
    nextOrderByTab[tab] = max + 1;
  }

  const { data: maxCollection } = await sb
    .from('collections')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  let nextCollectionOrder = ((maxCollection?.[0]?.sort_order ?? -1) + 1);

  console.log(`Preset: "${preset.name}" (${preset.slug}) · active=${preset.is_active} · existing items=${(existingItems || []).length}\n`);

  const stats = { collectionsCreated: 0, collectionsUpdated: 0, reused: 0, foldersCreated: 0, foldersUpdated: 0, sources: 0, itemsCreated: 0, itemsUpdated: 0 };

  for (const tab of ['home', 'movies', 'series']) {
    console.log(tab.toUpperCase());
    for (const widget of WIDGETS.filter((w) => w.tab === tab)) {
      const collection = await syncCollection(widget, tab, nextCollectionOrder);
      if (collection.action === 'create') nextCollectionOrder++;
      if (collection.action === 'reuse') stats.reused++;
      if (collection.action === 'create') stats.collectionsCreated++;
      if (collection.action === 'update') stats.collectionsUpdated++;

      let folderStats = {
        created: (widget.folders || []).length,
        updated: 0,
        sources: (widget.folders || []).reduce((n, f) => n + f.sources.length, 0),
      };
      if (collection.id) folderStats = await syncFolders(widget, collection.id);
      stats.foldersCreated += folderStats.created;
      stats.foldersUpdated += folderStats.updated;
      stats.sources += folderStats.sources;

      const itemAction = await upsertPresetItem(widget, collection.id ?? '<created>', nextOrderByTab[tab]++, itemsByKey);
      if (itemAction === 'created') stats.itemsCreated++;
      else stats.itemsUpdated++;

      const detail = widget.reuse
        ? 'reuse existing collection'
        : `${widget.folders.length} folders · ${folderStats.sources} sources (${folderStats.created} new, ${folderStats.updated} updated)`;
      console.log(`  [${collection.action}/${itemAction}] ${widget.title.padEnd(30)} ${detail}`);
    }
    console.log('');
  }

  if (REORDER) {
    console.log('REORDER');
    const lines = await reorderItems();
    if (lines.length) for (const line of lines) console.log(`  ${line}`);
    else console.log('  already in plan order');
    console.log('');
  }

  let repair = { added: 0, skipped: 0 };
  if (!SKIP_ANIME_REPAIR) {
    console.log('ANIME HUB REPAIR');
    repair = await repairAnimeHub();
    console.log(`  ${repair.added} source(s) to add · ${repair.skipped} already present\n`);
  }

  if (ACTIVATE) await activate();

  console.log('Summary');
  console.log(`  collections: ${stats.collectionsCreated} created · ${stats.collectionsUpdated} updated · ${stats.reused} reused`);
  console.log(`  folders:     ${stats.foldersCreated} created · ${stats.foldersUpdated} updated`);
  console.log(`  sources:     ${stats.sources} written`);
  console.log(`  preset items:${stats.itemsCreated} created · ${stats.itemsUpdated} updated`);
  console.log(`  anime repair: ${repair.added} added · ${repair.skipped} already present`);
  console.log(APPLY ? '\nDone.' : '\nDry run — nothing written. Re-run with --apply.');
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
