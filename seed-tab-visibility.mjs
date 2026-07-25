import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';

const MOVIES = [
  'trending movies', 'popular movies', 'top rated', 'coming soon movies',
  'film collections', 'genres',
  'action essentials', 'comedy favorites', 'crime vault', 'drama must-sees',
  'family & animation collections', 'fantasy realm', 'horror vault',
  'mystery vault', 'sci-fi vault', 'thriller picks', 'war stories',
];

const SERIES = [
  'trending shows', 'popular shows', 'top rated', 'coming soon tv shows',
  'latest', 'series universes', 'genres',
];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Strip zero-width/invisible marks (e.g. "‎Genres" has a leading LRM) and normalise.
const norm = (s) => s.replace(/[\u200e\u200f\u200b\ufeff]/g, '').trim().toLowerCase();

async function main() {
  const { data: collections, error } = await sb
    .from('collections').select('*').order('sort_order');
  if (error) throw new Error(error.message);

  for (const c of collections) {
    const key = norm(c.name);
    const patch = {
      show_ios_home: c.show_on_home ?? true,
      show_mac_home: c.show_on_home ?? true,
      show_ios_movies: MOVIES.includes(key),
      show_mac_movies: MOVIES.includes(key),
      show_ios_series: SERIES.includes(key),
      show_mac_series: SERIES.includes(key),
    };
    const { error: upErr } = await sb.from('collections').update(patch).eq('id', c.id);
    if (upErr) throw new Error(`${c.name}: ${upErr.message}`);
    const tabs = [
      patch.show_ios_home || patch.show_mac_home ? 'home' : null,
      patch.show_ios_movies ? 'movies' : null,
      patch.show_ios_series ? 'series' : null,
    ].filter(Boolean).join(',') || '-';
    console.log(`  [${String(c.sort_order).padStart(2)}] ${c.name} → ${tabs}`);
  }

  for (const name of [...MOVIES, ...SERIES]) {
    if (!collections.some((c) => norm(c.name) === name)) {
      console.warn(`  ! no collection matched "${name}"`);
    }
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
