export type SessionInfo = {
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
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

export type ActiveStatus = 'online' | 'recent' | 'stale' | 'never';

const FIVE_MINUTES_MS = 5 * 60_000;
const ONE_DAY_MS = 24 * 60 * 60_000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

/**
 * Labels a session's device from its user agent. Deliberately coarse: the
 * native app sends the same `Moonlit/… Darwin/…` pattern from both iOS and
 * macOS with nothing to tell them apart, and the product doesn't need that
 * distinction — see the design's non-goals.
 */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (ua.startsWith('Moonlit/')) return 'Moonlit app';
  if (/iPhone|iPad/.test(ua)) return 'Safari (iOS)';
  if (/Macintosh/.test(ua)) return 'Browser (Mac)';
  if (/Windows/.test(ua)) return 'Browser (Windows)';
  if (/Android/.test(ua)) return 'Browser (Android)';
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}

export function lastActiveStatus(iso: string | null, now: Date = new Date()): ActiveStatus {
  if (!iso) return 'never';
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < FIVE_MINUTES_MS) return 'online';
  if (diffMs < ONE_DAY_MS) return 'recent';
  return 'stale';
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffMs < THIRTY_DAYS_MS) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return new Date(iso).toLocaleDateString();
}
