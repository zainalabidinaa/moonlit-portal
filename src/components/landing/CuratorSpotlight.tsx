import { useEffect, useState } from 'react';
import { Reveal } from './Reveal';

interface TrendingItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
}

function useTrendingNow() {
  const [items, setItems] = useState<TrendingItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/tmdb-popular`)
      .then(async (r) => {
        if (!r.ok) {
          console.error('tmdb-popular fetch failed:', r.status, r.statusText);
          return [];
        }
        return (await r.json()) as TrendingItem[];
      })
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('tmdb-popular fetch error:', err);
        // Fail silent for the visitor (no trending strip rendered) — this backs a
        // public marketing page, not a critical path. Logged above for debugging
        // a broken VITE_SUPABASE_FUNCTIONS_URL, CORS issue, or downed function.
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return items;
}

export function CuratorSpotlight() {
  const trending = useTrendingNow();

  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
          From the team
        </p>
        <h2 className="font-display text-[clamp(32px,5vw,60px)] font-extrabold uppercase">
          Why we built Moonlit
        </h2>
        <p className="mt-4 text-[16px] text-muted">
          We got tired of juggling five apps just to find something to watch with
          the people we live with. Every collection here is picked by hand, on
          purpose — no clutter, no dead ends, just press play.
        </p>
      </Reveal>

      {trending.length > 0 && (
        <div className="mt-16">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-faint">
            Trending now
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {trending.map((item) => (
              <div key={`${item.media_type}-${item.id}`} className="w-32 flex-none">
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-bg2">
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-mono text-[9px] text-faint">no image</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs text-muted">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
