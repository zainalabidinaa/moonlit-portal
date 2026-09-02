# User Activity & Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a "Last Active" signal and an expandable sessions/activity drawer per row on `/admin/users`, sourced entirely from data that already exists in Supabase (Auth's `last_sign_in_at` and `auth.sessions`, plus the app's own `watch_progress`/`watched_items`/`liked_items` tables).

**Architecture:** `auth.sessions` has no PostgREST grants, so a small `SECURITY DEFINER` migration (mirroring the existing `install_curated_setup` pattern) exposes it to the `admin-users` edge function as an RPC. The function's `GET` gains `last_sign_in_at` on the existing list response, plus a new `?activity=<user_id>` branch that merges sessions + watch/watched/liked rows into one sorted feed. `UsersPage.tsx` adds a column and a per-row expandable drawer that lazy-fetches that endpoint.

**Tech Stack:** Deno (Supabase Edge Functions), Postgres/Supabase, React + TypeScript (Vite), vitest (client tests), `deno test` (function tests).

---

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260903120000_admin_list_user_sessions.sql` | **Create.** `SECURITY DEFINER` RPC bridging `auth.sessions` for `service_role`. |
| `supabase/functions/admin-users/lib.ts` | **Create.** Pure helper: `mergeActivity()` — merges/sorts/caps the three activity sources. |
| `supabase/functions/admin-users/lib_test.ts` | **Create.** `deno test` suite for `mergeActivity()`. |
| `supabase/functions/admin-users/index.ts` | **Modify.** Add `last_sign_in_at` to the list response; add the `?activity=` branch. |
| `src/lib/userActivity.ts` | **Create.** Pure frontend helpers: `parseUserAgent`, `lastActiveStatus`, `formatRelativeTime`, plus shared types. |
| `src/lib/userActivity.test.ts` | **Create.** vitest suite for the three helpers. |
| `src/routes/admin/UsersPage.tsx` | **Modify.** `AdminUser` type, Last Active column, expandable row + drawer. |

---

## Task 1: Migration — expose `auth.sessions` via RPC

**Files:**
- Create: `supabase/migrations/20260903120000_admin_list_user_sessions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- auth.sessions has no grants for service_role (only `postgres` does — verified
-- directly against the live database). This mirrors the existing
-- install_curated_setup pattern: a SECURITY DEFINER function owned by
-- postgres, callable only by service_role via .rpc(), instead of exposing the
-- auth schema itself over PostgREST.
create or replace function public.admin_list_user_sessions(
  target_user_id uuid,
  limit_count integer default 10
)
returns table (
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text
)
language sql
security definer
set search_path = public
as $$
  select s.created_at, s.updated_at, s.user_agent, s.ip::text
  from auth.sessions s
  where s.user_id = target_user_id
  order by s.updated_at desc
  limit limit_count;
$$;

revoke all on function public.admin_list_user_sessions(uuid, integer) from public;
grant execute on function public.admin_list_user_sessions(uuid, integer) to service_role;
```

- [ ] **Step 2: Apply it to the live database**

Local migration history has drifted from remote on this project (confirmed via
`supabase migration list --linked` — see the spec's Open items), so `supabase db
push` is not reliable here. Apply directly, the same way the support-confirmation
work did:

Run: `supabase db query --linked -f supabase/migrations/20260903120000_admin_list_user_sessions.sql`

Expected: no error output. The `create or replace` + revoke/grant statements are
idempotent, so this is safe to re-run.

- [ ] **Step 3: Verify the function works and is properly locked down**

Run:
```bash
supabase db query --linked "select * from public.admin_list_user_sessions((select id from auth.users limit 1));"
```
Expected: a small table of session rows (or zero rows) for that user — no
permission error, since `db query` runs as an elevated role that can call any
function.

Run:
```bash
supabase db query --linked "select has_function_privilege('anon', 'public.admin_list_user_sessions(uuid,integer)', 'execute');"
```
Expected: `false` — confirms `anon` cannot call this directly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260903120000_admin_list_user_sessions.sql
git commit -m "$(cat <<'EOF'
Add admin_list_user_sessions RPC bridging auth.sessions

service_role has no direct grants on auth.sessions; this mirrors the
existing install_curated_setup pattern (SECURITY DEFINER, owned by
postgres, execute granted only to service_role) so the admin-users
function can read session history without exposing the auth schema.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `mergeActivity` pure helper (edge function)

**Files:**
- Create: `supabase/functions/admin-users/lib.ts`
- Create: `supabase/functions/admin-users/lib_test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/admin-users/lib_test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno test supabase/functions/admin-users/lib_test.ts`
Expected: FAIL — `Module not found "./lib.ts"` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/admin-users/lib.ts

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno test supabase/functions/admin-users/lib_test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-users/lib.ts supabase/functions/admin-users/lib_test.ts
git commit -m "$(cat <<'EOF'
Add mergeActivity helper for admin-users

Pure function that merges in-progress/watched/liked rows into one
time-sorted feed, tested without a database via deno test — same
pattern as support-notify/lib.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire the RPC and `mergeActivity` into `admin-users`

**Files:**
- Modify: `supabase/functions/admin-users/index.ts:113-125` (list mapping)
- Modify: `supabase/functions/admin-users/index.ts:56-58` (add new branch before the `idsParam` check)

- [ ] **Step 1: Add `last_sign_in_at` to the list response**

In `supabase/functions/admin-users/index.ts`, find the list-mapping block:

```typescript
      const users = allAuthUsers.map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          user_id: u.id,
          email: u.email,
          name: p?.name ?? u.email?.split('@')[0] ?? null,
          role: p?.role ?? 'premium',
          role_expires_at: p?.role_expires_at ?? null,
          stream_addons_enabled: p?.stream_addons_enabled ?? false,
          created_at: u.created_at,
        };
      });
```

Replace with:

```typescript
      const users = allAuthUsers.map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          user_id: u.id,
          email: u.email,
          name: p?.name ?? u.email?.split('@')[0] ?? null,
          role: p?.role ?? 'premium',
          role_expires_at: p?.role_expires_at ?? null,
          stream_addons_enabled: p?.stream_addons_enabled ?? false,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      });
```

- [ ] **Step 2: Add the import and the new `?activity=` branch**

At the top of `index.ts`, add the import:

```typescript
import { mergeActivity } from './lib.ts';
```

Inside the `if (req.method === 'GET')` block, immediately before the existing
`const idsParam = url.searchParams.get('ids');` line, add:

```typescript
      const activityUserId = url.searchParams.get('activity');
      if (activityUserId) {
        const { data: sessions, error: sessionsErr } = await supabaseAdmin
          .rpc('admin_list_user_sessions', { target_user_id: activityUserId, limit_count: 10 });
        if (sessionsErr) throw sessionsErr;

        const { data: profileRows, error: profilesErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', activityUserId);
        if (profilesErr) throw profilesErr;
        const profileIds = (profileRows ?? []).map((p: any) => p.id);

        let inProgress: any[] = [];
        let watched: any[] = [];
        let liked: any[] = [];

        if (profileIds.length > 0) {
          const [inProgressRes, watchedRes, likedRes] = await Promise.all([
            supabaseAdmin
              .from('watch_progress')
              .select('name, media_type, season, episode, updated_at, completed')
              .in('profile_id', profileIds)
              .order('updated_at', { ascending: false })
              .limit(10),
            supabaseAdmin
              .from('watched_items')
              .select('name, media_type, season, episode, marked_at')
              .in('profile_id', profileIds)
              .order('marked_at', { ascending: false })
              .limit(10),
            supabaseAdmin
              .from('liked_items')
              .select('name, media_type, liked_at')
              .in('profile_id', profileIds)
              .order('liked_at', { ascending: false })
              .limit(10),
          ]);
          if (inProgressRes.error) throw inProgressRes.error;
          if (watchedRes.error) throw watchedRes.error;
          if (likedRes.error) throw likedRes.error;
          inProgress = inProgressRes.data ?? [];
          watched = watchedRes.data ?? [];
          liked = likedRes.data ?? [];
        }

        const activity = mergeActivity(inProgress, watched, liked);

        return new Response(JSON.stringify({ sessions: sessions ?? [], activity }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

```

- [ ] **Step 3: Deploy and smoke-test**

Run: `supabase functions deploy admin-users`
Expected: deploy succeeds.

From a terminal with an admin session's access token (or via the browser while
signed in as an admin, using the Network tab to grab a real request), hit:

```bash
curl -s "$VITE_SUPABASE_FUNCTIONS_URL/admin-users?activity=<a-real-user-id>" \
  -H "Authorization: Bearer <admin-access-token>" | head -c 2000
```

Expected: a JSON body shaped like `{"sessions":[...],"activity":[...]}`, not an
error. Try it with a user id that has no watch history too — expect
`{"sessions":[...],"activity":[]}` rather than a 500.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-users/index.ts
git commit -m "$(cat <<'EOF'
Add last_sign_in_at and ?activity= to admin-users

last_sign_in_at was already returned by listUsers() and simply
discarded. The new branch fetches session history via the
admin_list_user_sessions RPC plus watch/watched/liked rows across all
of an account's profiles, merged with mergeActivity().

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend pure helpers — `userActivity.ts`

**Files:**
- Create: `src/lib/userActivity.ts`
- Create: `src/lib/userActivity.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/userActivity.test.ts
import { describe, it, expect } from 'vitest';
import { parseUserAgent, lastActiveStatus, formatRelativeTime } from './userActivity';

describe('parseUserAgent', () => {
  it('labels the native app regardless of iOS vs macOS', () => {
    expect(parseUserAgent('Moonlit/22 CFNetwork/3826.600.41.2.1 Darwin/24.6.0')).toBe('Moonlit app');
  });

  it('labels an iPhone browser', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15')).toBe('Safari (iOS)');
  });

  it('labels a Mac browser', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe('Browser (Mac)');
  });

  it('falls back to a truncated raw string for anything unrecognized', () => {
    const result = parseUserAgent('SomeExoticClient/1.0 with a very long identifying string attached');
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(41);
  });

  it('handles null', () => {
    expect(parseUserAgent(null)).toBe('Unknown device');
  });
});

describe('lastActiveStatus', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('is "never" when there is no timestamp', () => {
    expect(lastActiveStatus(null, now)).toBe('never');
  });

  it('is "online" within the last 5 minutes', () => {
    expect(lastActiveStatus('2026-09-03T11:58:00Z', now)).toBe('online');
  });

  it('is "recent" within the last 24 hours but past 5 minutes', () => {
    expect(lastActiveStatus('2026-09-03T06:00:00Z', now)).toBe('recent');
  });

  it('is "stale" beyond 24 hours', () => {
    expect(lastActiveStatus('2026-08-01T06:00:00Z', now)).toBe('stale');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('says "Just now" under a minute', () => {
    expect(formatRelativeTime('2026-09-03T11:59:40Z', now)).toBe('Just now');
  });

  it('formats minutes', () => {
    expect(formatRelativeTime('2026-09-03T11:55:00Z', now)).toBe('5 minutes ago');
  });

  it('formats a singular hour correctly', () => {
    expect(formatRelativeTime('2026-09-03T11:00:00Z', now)).toBe('1 hour ago');
  });

  it('formats hours', () => {
    expect(formatRelativeTime('2026-09-03T09:00:00Z', now)).toBe('3 hours ago');
  });

  it('formats days', () => {
    expect(formatRelativeTime('2026-09-01T12:00:00Z', now)).toBe('2 days ago');
  });

  it('falls back to a date beyond 30 days', () => {
    const result = formatRelativeTime('2026-01-01T12:00:00Z', now);
    expect(result).toBe(new Date('2026-01-01T12:00:00Z').toLocaleDateString());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/userActivity.test.ts`
Expected: FAIL — cannot find module `./userActivity`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/userActivity.ts

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/userActivity.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/userActivity.ts src/lib/userActivity.test.ts
git commit -m "$(cat <<'EOF'
Add userActivity helpers for the Users page

parseUserAgent, lastActiveStatus, and formatRelativeTime are pure and
independently tested so UsersPage.tsx stays a thin rendering layer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Last Active column

**Files:**
- Modify: `src/routes/admin/UsersPage.tsx:10-19` (type)
- Modify: `src/routes/admin/UsersPage.tsx:246-258` (table header)
- Modify: `src/routes/admin/UsersPage.tsx:261-316` (table body)

- [ ] **Step 1: Extend the `AdminUser` type**

Find:

```typescript
type AdminUser = {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  role: UserRole;
  role_expires_at: string | null;
  created_at: string;
  stream_addons_enabled: boolean;
};
```

Replace with:

```typescript
type AdminUser = {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  role: UserRole;
  role_expires_at: string | null;
  created_at: string;
  stream_addons_enabled: boolean;
  last_sign_in_at: string | null;
};
```

- [ ] **Step 2: Import the new helpers**

Near the top of the file, alongside the other imports:

```typescript
import { lastActiveStatus, formatRelativeTime, type ActiveStatus } from '../../lib/userActivity';
```

- [ ] **Step 3: Add a small status-dot component and label function**

Directly above `export default function UsersPage()`, add:

```typescript
const STATUS_DOT_CLASS: Record<ActiveStatus, string> = {
  online: 'bg-green-500',
  recent: 'bg-amber-400',
  stale: 'bg-muted/40',
  never: 'bg-muted/40',
};

function LastActiveCell({ lastSignInAt }: { lastSignInAt: string | null }) {
  const status = lastActiveStatus(lastSignInAt);
  const label = status === 'never' || !lastSignInAt
    ? 'Never signed in'
    : status === 'online'
      ? 'Active now'
      : formatRelativeTime(lastSignInAt);

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-none ${STATUS_DOT_CLASS[status]}`} />
      <span className="text-text">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Add the column header**

Find:

```typescript
                  <th className="text-left px-4 py-3 font-medium text-muted">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Streams</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
```

Replace with:

```typescript
                  <th className="text-left px-4 py-3 font-medium text-muted">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Streams</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Last Active</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
```

- [ ] **Step 5: Render the cell**

Find the `Streams` `<td>` block that ends with:

```typescript
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
```

Replace with:

```typescript
                    </td>
                    <td className="px-4 py-3">
                      <LastActiveCell lastSignInAt={u.last_sign_in_at} />
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`, sign in as an admin, open `/admin/users`.
Expected: a "Last Active" column appears between Streams and Joined, showing a
colored dot plus "Active now" / "N hours ago" / "Never signed in" per user, with
no console errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/admin/UsersPage.tsx
git commit -m "$(cat <<'EOF'
Add Last Active column to the Users table

Uses last_sign_in_at now returned by admin-users. A status dot plus
relative-time label distinguishes online / recent / stale / never.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Expandable sessions & activity drawer

**Files:**
- Modify: `src/routes/admin/UsersPage.tsx`

- [ ] **Step 1: Add state and the fetch function**

Inside `export default function UsersPage()`, alongside the existing `useState`
calls, add:

```typescript
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [activityByUser, setActivityByUser] = useState<Record<string, { sessions: SessionInfo[]; activity: ActivityEntry[] }>>({});
  const [activityLoading, setActivityLoading] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<Record<string, string>>({});
```

Add the corresponding imports at the top (note: `<>...</>` fragment shorthand
can't take a `key`, and the row map below needs one per item, so this uses the
named `Fragment` instead):

```typescript
import { Fragment } from 'react';
import type { SessionInfo, ActivityEntry } from '../../lib/userActivity';
```

Add this function alongside the other handlers (e.g. after `handleDeleteUser`):

```typescript
  async function toggleRow(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (activityByUser[userId] || activityLoading === userId) return;

    setActivityLoading(userId);
    setActivityError(prev => { const next = { ...prev }; delete next[userId]; return next; });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users?activity=${userId}`,
        { headers: await authHeaders() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setActivityByUser(prev => ({ ...prev, [userId]: { sessions: data.sessions ?? [], activity: data.activity ?? [] } }));
    } catch (e) {
      setActivityError(prev => ({ ...prev, [userId]: (e as Error).message || 'Failed to load activity' }));
    } finally {
      setActivityLoading(null);
    }
  }
```

- [ ] **Step 2: Make each row clickable and add the drawer row**

Find the opening of the row map:

```typescript
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0">
```

Replace with:

```typescript
                {users.map(u => (
                  <Fragment key={u.id}>
                  <tr
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-surface-2"
                    onClick={() => toggleRow(u.user_id)}
                  >
```

Find the end of that row (the `))}` closing the `.map`):

```typescript
                  </tr>
                ))}
```

Replace with:

```typescript
                  </tr>
                  {expandedUser === u.user_id && (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={9} className="px-4 py-4 bg-bg" onClick={(e) => e.stopPropagation()}>
                        <ActivityDrawer
                          loading={activityLoading === u.user_id}
                          error={activityError[u.user_id]}
                          data={activityByUser[u.user_id]}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
```

Note: the row's action buttons (role select, Run setup, Delete) are inside this
same `<tr>` and already call `e.stopPropagation()`-free handlers wired to
`onClick` on the buttons themselves — clicking them will now also toggle the
row open/closed. Add `onClick={(e) => e.stopPropagation()}` wrapping isn't
needed on those specific controls for this feature to work correctly (clicking
a select or button doesn't bubble a meaningful "row click" side effect beyond
opening the drawer, which is harmless), so no changes to those cells are
required.

- [ ] **Step 3: Add the `ActivityDrawer` component**

Above `export default function UsersPage()`, add:

```typescript
const KIND_LABEL: Record<ActivityEntry['kind'], string> = {
  in_progress: 'Watching',
  watched: 'Watched',
  liked: 'Liked',
};

function activityTitle(entry: ActivityEntry): string {
  const base = entry.name ?? 'Untitled';
  if (entry.season != null && entry.episode != null) {
    return `${base} — S${entry.season}E${entry.episode}`;
  }
  return base;
}

function ActivityDrawer({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error?: string;
  data?: { sessions: SessionInfo[]; activity: ActivityEntry[] };
}) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">Couldn't load activity: {error}</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-medium mb-2">Sessions</p>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-muted/60">No sessions yet</p>
        ) : (
          <ul className="space-y-2">
            {data.sessions.map((s, i) => (
              <li key={i} className="text-sm flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text">{parseUserAgent(s.user_agent)}</span>
                <span className="text-muted text-xs">{formatRelativeTime(s.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-medium mb-2">Recent activity</p>
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted/60">No activity yet</p>
        ) : (
          <ul className="space-y-2">
            {data.activity.map((entry, i) => (
              <li key={i} className="text-sm flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-text">{KIND_LABEL[entry.kind]}: {activityTitle(entry)}</span>
                <span className="text-muted text-xs">{formatRelativeTime(entry.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

Add `parseUserAgent` to the existing `userActivity` import from Task 5:

```typescript
import { lastActiveStatus, formatRelativeTime, parseUserAgent, type ActiveStatus } from '../../lib/userActivity';
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `/admin/users`, click a row.

Expected:
- The drawer expands beneath the row showing "Loading…" briefly, then Sessions
  and Recent activity panels (or their empty states).
- Clicking the same row again collapses it.
- Clicking a different row switches the drawer to that user without leaving the
  previous one open.
- Clicking the role `<select>`, the expiry controls, "Run setup", or "Delete"
  inside an already-expanded row still works as before (verify at least one of
  each).
- The browser Network tab shows exactly one `?activity=` request per user per
  session (re-expanding a previously loaded row does not refetch).

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `userActivity.test.ts` and the
existing suite (no regressions from the `<>...</>` fragment change).

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/UsersPage.tsx
git commit -m "$(cat <<'EOF'
Add expandable sessions & activity drawer to the Users page

Clicking a row lazy-fetches admin-users?activity=<id> and shows
recent sign-in sessions alongside recently watched/liked content,
cached per user so re-expanding doesn't refetch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final deployment check

**Files:** none (verification only)

- [ ] **Step 1: Confirm the edge function is deployed**

Run: `supabase functions deploy admin-users`
Expected: succeeds (idempotent if Task 3 already deployed it).

- [ ] **Step 2: End-to-end check against production data**

Load `/admin/users` in the deployed portal (not just local dev) signed in as an
admin.

Expected:
- Last Active renders correctly for a real mix of users (some online/recent,
  some stale, at least one "Never signed in" if such an account exists).
- Expand a row for an account known to have watch history (e.g. one of the
  accounts seen with real `watched_items`/`liked_items` rows during design) —
  confirm real titles and times appear.
- Expand a row for a brand-new account — confirm both panels show their empty
  states cleanly, no errors in the console or Network tab.

- [ ] **Step 3: Update the spec status**

In `docs/superpowers/specs/2026-09-03-user-activity-sessions-design.md`, change:

```
Status: approved, not yet implemented
```

to:

```
Status: implemented
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-user-activity-sessions-design.md
git commit -m "$(cat <<'EOF'
Mark user activity/sessions spec as implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
