const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TmdbItem {
  id: number;
  title: string;
  poster_path: string | null;
  /** Landscape still, for player and continue-watching mockups. */
  backdrop_path: string | null;
  media_type: 'movie' | 'tv';
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { items: TmdbItem[]; fetchedAt: number } | null = null;

const PER_TYPE = 16;

async function fetchPages(apiKey: string, kind: 'movie' | 'tv'): Promise<any[]> {
  const responses = await Promise.all(
    [1, 2].map((page) =>
      fetch(`https://api.themoviedb.org/3/${kind}/popular?api_key=${apiKey}&language=en-US&page=${page}`)
    )
  );
  for (const r of responses) {
    if (!r.ok) throw new Error(`TMDB ${kind} request failed: ${r.status}`);
  }
  const pages = await Promise.all(responses.map((r) => r.json()));
  return pages.flatMap((p) => p.results ?? []);
}

async function fetchTmdbPopular(apiKey: string): Promise<TmdbItem[]> {
  const [movieResults, tvResults] = await Promise.all([fetchPages(apiKey, 'movie'), fetchPages(apiKey, 'tv')]);

  // Two pages of each, posters only, so the marketing page has enough real
  // artwork for its rails and grids without repeating the same few titles.
  const movies: TmdbItem[] = movieResults
    .filter((m: any) => m.poster_path)
    .slice(0, PER_TYPE)
    .map((m: any) => ({ id: m.id, title: m.title, poster_path: m.poster_path, backdrop_path: m.backdrop_path ?? null, media_type: 'movie' as const }));

  const shows: TmdbItem[] = tvResults
    .filter((t: any) => t.poster_path)
    .slice(0, PER_TYPE)
    .map((t: any) => ({ id: t.id, title: t.name, poster_path: t.poster_path, backdrop_path: t.backdrop_path ?? null, media_type: 'tv' as const }));

  // Interleave movies and shows so the strip isn't all-movies-then-all-tv.
  const merged: TmdbItem[] = [];
  for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
    if (movies[i]) merged.push(movies[i]);
    if (shows[i]) merged.push(shows[i]);
  }
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cache.items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const apiKey = Deno.env.get('TMDB_API_KEY');
    if (!apiKey) {
      throw new Error('TMDB_API_KEY is not configured');
    }

    const items = await fetchTmdbPopular(apiKey);
    cache = { items, fetchedAt: now };

    return new Response(JSON.stringify(items), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('tmdb-popular error:', err);
    // Fail silent for the caller (empty list) — this backs a public marketing page,
    // not a critical path. The error is logged above for debugging.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
