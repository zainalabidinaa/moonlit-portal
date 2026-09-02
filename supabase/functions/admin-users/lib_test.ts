import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mergeActivity } from './lib.ts';

Deno.test('mergeActivity sorts all three sources by time, newest first', () => {
  const result = mergeActivity(
    [{ name: 'Tones II', media_type: 'lesson', season: null, episode: null, updated_at: '2026-09-01T10:00:00Z', completed: false }],
    [{ name: 'Night Market Vlog', media_type: 'stream', season: null, episode: null, marked_at: '2026-09-02T10:00:00Z' }],
    [{ name: 'Ordering Coffee', media_type: 'video', liked_at: '2026-08-30T10:00:00Z' }],
  );
  assertEquals(result.map(r => r.name), ['Night Market Vlog', 'Tones II', 'Ordering Coffee']);
});

Deno.test('mergeActivity tags each entry with its source kind', () => {
  const result = mergeActivity(
    [{ name: 'A', media_type: null, season: null, episode: null, updated_at: '2026-09-01T00:00:00Z', completed: false }],
    [{ name: 'B', media_type: null, season: null, episode: null, marked_at: '2026-08-01T00:00:00Z' }],
    [{ name: 'C', media_type: null, liked_at: '2026-07-01T00:00:00Z' }],
  );
  assertEquals(result.find(r => r.name === 'A')?.kind, 'in_progress');
  assertEquals(result.find(r => r.name === 'B')?.kind, 'watched');
  assertEquals(result.find(r => r.name === 'C')?.kind, 'liked');
});

Deno.test('mergeActivity excludes completed watch_progress rows — those show up via watched_items instead', () => {
  const result = mergeActivity(
    [{ name: 'Done Already', media_type: null, season: null, episode: null, updated_at: '2026-09-01T00:00:00Z', completed: true }],
    [],
    [],
  );
  assertEquals(result.length, 0);
});

Deno.test('mergeActivity gives liked_items null season/episode', () => {
  const result = mergeActivity([], [], [{ name: 'C', media_type: null, liked_at: '2026-07-01T00:00:00Z' }]);
  assertEquals(result[0].season, null);
  assertEquals(result[0].episode, null);
});

Deno.test('mergeActivity caps to the given limit, keeping the most recent', () => {
  const watched = Array.from({ length: 15 }, (_, i) => ({
    name: `Item ${i}`,
    media_type: null,
    season: null,
    episode: null,
    marked_at: new Date(2026, 0, i + 1).toISOString(),
  }));
  const result = mergeActivity([], watched, [], 10);
  assertEquals(result.length, 10);
  assertEquals(result[0].name, 'Item 14');
});

Deno.test('mergeActivity defaults the limit to 10', () => {
  const watched = Array.from({ length: 12 }, (_, i) => ({
    name: `Item ${i}`,
    media_type: null,
    season: null,
    episode: null,
    marked_at: new Date(2026, 0, i + 1).toISOString(),
  }));
  const result = mergeActivity([], watched, []);
  assertEquals(result.length, 10);
});
