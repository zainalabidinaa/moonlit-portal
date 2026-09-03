export type WatchProgressRow = {
  name: string | null;
  media_type: string | null;
  season: number | null;
  episode: number | null;
  updated_at: string;
  completed: boolean;
};

export type WatchedItemRow = {
  name: string | null;
  media_type: string | null;
  season: number | null;
  episode: number | null;
  marked_at: string;
};

export type LikedItemRow = {
  name: string | null;
  media_type: string | null;
  liked_at: string;
};

export type ActivityKind = 'in_progress' | 'watched' | 'liked';

export type ActivityEntry = {
  kind: ActivityKind;
  name: string | null;
  media_type: string | null;
  season: number | null;
  episode: number | null;
  at: string;
};

const DEFAULT_LIMIT = 10;

/**
 * Merges in-progress, completed, and liked rows into one feed, newest first.
 * completed watch_progress rows are dropped — watched_items is the record of
 * completion, so keeping both would show the same item twice.
 */
export function mergeActivity(
  inProgress: WatchProgressRow[],
  watched: WatchedItemRow[],
  liked: LikedItemRow[],
  limit: number = DEFAULT_LIMIT,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...inProgress
      // index.ts also filters completed=false at the query level so the
      // limit(10) row budget isn't spent on rows we'd discard anyway — this
      // filter stays too as a safety net for any other caller.
      .filter((r) => !r.completed)
      .map((r) => ({
        kind: 'in_progress' as const,
        name: r.name,
        media_type: r.media_type,
        season: r.season,
        episode: r.episode,
        at: r.updated_at,
      })),
    ...watched.map((r) => ({
      kind: 'watched' as const,
      name: r.name,
      media_type: r.media_type,
      season: r.season,
      episode: r.episode,
      at: r.marked_at,
    })),
    ...liked.map((r) => ({
      kind: 'liked' as const,
      name: r.name,
      media_type: r.media_type,
      season: null,
      episode: null,
      at: r.liked_at,
    })),
  ];

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
