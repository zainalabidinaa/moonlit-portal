import { useEffect, useState } from 'react';

export interface TrendingItem {
  id: number;
  title: string;
  poster_path: string | null;
  /** Present once the tmdb-popular function returns backdrops. */
  backdrop_path?: string | null;
  media_type: 'movie' | 'tv';
}

export function posterUrl(item: TrendingItem, size: 'w342' | 'w500' = 'w342'): string | null {
  return item.poster_path ? `https://image.tmdb.org/t/p/${size}${item.poster_path}` : null;
}

export function backdropUrl(item: TrendingItem, size: 'w780' | 'w1280' = 'w780'): string | null {
  return item.backdrop_path ? `https://image.tmdb.org/t/p/${size}${item.backdrop_path}` : null;
}

/**
 * Popular movies and shows from the `tmdb-popular` edge function. Fails
 * silent for the visitor (an empty list); the error is logged for debugging
 * a broken VITE_SUPABASE_FUNCTIONS_URL, CORS issue or downed function.
 */
export function useTrending(): TrendingItem[] {
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
        if (!cancelled) setItems(Array.isArray(data) ? data.filter((d) => d.poster_path) : []);
      })
      .catch((err) => {
        console.error('tmdb-popular fetch error:', err);
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return items;
}
