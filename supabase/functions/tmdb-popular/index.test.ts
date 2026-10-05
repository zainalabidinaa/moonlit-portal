import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('serves a broad, unique mix of movies and scripted series with posters', async () => {
  vi.resetModules();
  let handler!: (req: Request) => Promise<Response>;
  vi.stubGlobal('Deno', {
    env: { get: () => 'test-key' },
    serve: (fn: typeof handler) => { handler = fn; },
  });
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input);
    const kind = url.pathname.includes('movie') ? 'movie' : 'tv';
    const page = Number(url.searchParams.get('page'));
    const item = (id: number, extra = {}) => ({
      id, title: `Movie ${id}`, name: `Series ${id}`,
      poster_path: `/${kind}-${id}.jpg`, genre_ids: [18], adult: false, ...extra,
    });
    const scriptedQuery = url.pathname === '/3/discover/tv' &&
      url.searchParams.get('with_type') === '2|4' &&
      url.searchParams.get('vote_count.gte') === '100';
    return Response.json({ results: [
      ...(kind === 'tv' && !scriptedQuery ? [item(920)] : []),
      ...[10767, 10763, 10764, 10766].map((genre, i) => item(900 + i, { genre_ids: [genre] })),
      item(910, { adult: true }), item(911, { poster_path: null }),
      item(912, { poster_path: '' }), item(913, { poster_path: `/${kind}-1.jpg` }),
      item(1), item(1),
      ...Array.from({ length: 20 }, (_, i) => item((page - 1) * 20 + i + 1)),
    ] });
  });
  await import('./index');
  const response = await handler(new Request('https://example.test/tmdb-popular'));
  const items = await response.json();
  expect(items).toHaveLength(60);
  expect(items.filter((item: any) => item.media_type === 'movie')).toHaveLength(30);
  expect(items.filter((item: any) => item.media_type === 'tv')).toHaveLength(30);
  expect(items.every((item: any) => item.id < 900 || item.id === 913)).toBe(true);
  expect(items.every((item: any) => Boolean(item.poster_path))).toBe(true);
  expect(new Set(items.map((item: any) => `${item.media_type}:${item.id}`)).size).toBe(60);
  expect(new Set(items.map((item: any) => item.poster_path)).size).toBe(60);
  expect(items.slice(0, 4).map((item: any) => item.media_type)).toEqual(['movie', 'tv', 'movie', 'tv']);
});
