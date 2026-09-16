# Users page stuck loading + Last Active correctness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/users` always leave its loading state (with a retry path) and compute Last Active from real session heartbeats and viewing activity, not just `last_sign_in_at`.

**Architecture:** One new SECURITY DEFINER SQL RPC aggregates per-user activity timestamps (mirroring the existing `admin_list_user_sessions`); the `admin-users` edge function returns `last_active_at`; the portal renders it and wraps all admin requests in a timeout/abort helper. No new dependencies.

**Tech Stack:** Vite + React 18 + TS, Supabase JS v2, Deno edge function + `deno test`, Vitest, Supabase CLI (linked project `hvfsntdyowapjxobtyli`).

**Spec:** `docs/superpowers/specs/2026-09-03-user-activity-sessions-design.md` (original feature; extended here).

## Global Constraints

- No new npm/Deno dependencies. Function tests use `deno test`; portal tests use `vitest` (`npm run test`).
- Follow existing comment style (explain *why*, not *what*). Tailwind classes for UI.
- The migration must be applied via `supabase db query --linked -f …` (the migration ledger is known-drifted; do not run `supabase db push`).
- New RPC: `security definer`, owned by `postgres`, `revoke all` from `public`/`anon`/`authenticated`, `grant execute` to `service_role` only (this schema grants EXECUTE to those roles directly via default privileges).
- Do not push to any remote. Commits are local only.

## Root causes (evidence-based)

**Bug 1 — stuck on "Loading…".** The page's `loading` flag clears only when the promise chain settles (`src/routes/admin/UsersPage.tsx:182-193`), and both awaits are unbounded: `authHeaders()` → `supabase.auth.getSession()` (waits on auth init/token refresh) and `fetch()` (no `AbortController`, no timeout). When either stalls — live auth logs show this account had refresh-token trouble (`400 Invalid Refresh Token: Refresh Token Not Found` at 09:06 local, `token_revoked` at 10:07 local) — neither `.then` nor `.catch` runs → permanent "Loading…", no error, no retry. The function itself is healthy: deployed v32 matches the repo and returned 15/15 successful invocations that morning.

Related defects fixed in the same pass:
1. `supabase/functions/admin-users/index.ts:164-166` ignores the `profiles` select error → silently marks every user `premium`.
2. Admin gate reads only `profiles.role` (mirror) while writes go to `accounts.role` (source of truth).
3. `accounts_fanout_role` fires on UPDATE only, so an `accounts` row inserted by the admin PATCH upsert never mirrors into `profiles`.
4. Unpaged profiles read silently drops rows past PostgREST's 1000-row cap.

**Bug 2 — Last Active stale.** It is `auth.users.last_sign_in_at` only (`index.ts:180` → `UsersPage.tsx:440` → `src/lib/userActivity.ts:44`), which is stamped only on a fresh sign-in. Live DB proves sessions/viewing are fresher, e.g. eyowti46@gmail.com: sign-in Aug 13, session heartbeat Sep 15 20:05, watch progress Sep 15 20:48 → UI said "~1 month ago".

---

## Task 1: Migration — `last_active` RPC + fan-out trigger on INSERT

**Files:**
- Create: `supabase/migrations/20260916120000_admin_list_users_last_active.sql`

- [ ] 1. Write the migration:

```sql
-- Last Active used to come from auth.users.last_sign_in_at alone, which is
-- only stamped on a fresh sign-in — a client that stays signed in (token
-- refresh) or watches something never moved it. The freshest heartbeat for
-- an account is the greatest of:
--   * its last sign-in,
--   * its newest session heartbeat (auth.sessions.updated_at is bumped on
--     token refresh, and session rows survive sign-out, so this is a real
--     "last seen"),
--   * its newest content activity (watch_progress.updated_at — completed
--     rows included, unlike the activity drawer; watched_items.marked_at;
--     liked_items.liked_at).
-- auth.sessions is only readable by the postgres role, so this has to be a
-- SECURITY DEFINER RPC, mirroring admin_list_user_sessions.
create or replace function public.admin_list_users_last_active()
returns table (user_id uuid, last_active_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    u.id as user_id,
    greatest(
      u.last_sign_in_at,
      (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
      (select max(wp.updated_at)
         from watch_progress wp
         join profiles p on p.id = wp.profile_id
        where p.user_id = u.id),
      (select max(wi.marked_at)
         from watched_items wi
         join profiles p on p.id = wi.profile_id
        where p.user_id = u.id),
      (select max(li.liked_at)
         from liked_items li
         join profiles p on p.id = li.profile_id
        where p.user_id = u.id)
    ) as last_active_at
  from auth.users u;
$$;

-- This schema grants EXECUTE to anon/authenticated/service_role directly via
-- default privileges, so revoke from PUBLIC alone is not enough.
revoke all on function public.admin_list_users_last_active() from public;
revoke all on function public.admin_list_users_last_active() from anon;
revoke all on function public.admin_list_users_last_active() from authenticated;
grant execute on function public.admin_list_users_last_active() to service_role;

-- 20260812_account_level_role.sql created accounts_fanout_role for UPDATE
-- only, so an accounts row created by the admin-users PATCH upsert (INSERT
-- path) never fanned out to profiles — profiles.role (what the admin gate
-- and every client still reads) would go stale. Fire on INSERT too.
drop trigger if exists accounts_fanout_role on public.accounts;
create trigger accounts_fanout_role
  after insert or update of role, role_expires_at, subscription_source on public.accounts
  for each row
  execute function public.tg_accounts_fanout_role();
```

- [ ] 2. Apply it:

```bash
supabase db query --linked -f supabase/migrations/20260916120000_admin_list_users_last_active.sql
```

- [ ] 3. Verify the RPC returns the expected max (must match raw queries):

```bash
supabase db query --linked "select * from admin_list_users_last_active() order by last_active_at desc nulls last limit 5"
supabase db query --linked "select max(updated_at) from watch_progress wp join profiles p on p.id = wp.profile_id where p.user_id = '59fb625c-c564-4338-8f72-29ae87fa8681'"
```

- [ ] 4. Verify permissions (`proacl` must show only `postgres`/`service_role`):

```bash
supabase db query --linked "select proacl from pg_proc where proname = 'admin_list_users_last_active'"
```

- [ ] 5. Commit: `fix(admin): derive last-active from sessions + viewing activity`

---

## Task 2: Edge function — return `last_active_at`, harden the list branch

**Files:**
- Modify: `supabase/functions/admin-users/index.ts` (gate 42–55; list branch 151–187)

**Interfaces produced:** `GET /admin-users` response items gain `last_active_at: string | null` (keeps `last_sign_in_at`). RPC consumed: `admin_list_users_last_active() → { user_id, last_active_at }`.

- [ ] 1. Replace the admin gate (lines 42–55) with an accounts-first check (both queries in parallel so a mirror lag can't lock out a real admin):

```ts
    // Role is account-level now: accounts.role is the source of truth and
    // profiles.role is a trigger-maintained mirror (20260812_account_level_role.sql).
    // Check both so a mirror lag can never 403 a real admin.
    const [
      { data: accountRows, error: accountErr },
      { data: roleProfiles, error: profileErr },
    ] = await Promise.all([
      supabaseAdmin.from('accounts').select('role').eq('user_id', user.id),
      supabaseAdmin.from('profiles').select('role').eq('user_id', user.id),
    ]);

    if (accountErr) throw accountErr;
    if (profileErr) throw profileErr;

    const isAdmin = [...(accountRows ?? []), ...(roleProfiles ?? [])]
      .some((r: any) => r.role === 'admin');
    if (!isAdmin) {
```

- [ ] 2. In the list branch, replace lines 164–167 with a paged read + error check + the RPC lookup:

```ts
      // A single PostgREST response is capped at the project max-rows (1000),
      // so an unpaginated read silently drops the tail once profiles grows —
      // same fix the portal made in src/lib/fetchAllRows.ts.
      let allProfiles: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error: pageErr } = await supabaseAdmin
          .from('profiles')
          .select('user_id, role, name, role_expires_at, stream_addons_enabled')
          .order('user_id')
          .order('id')
          .range(from, from + 999);
        if (pageErr) throw pageErr;
        allProfiles = allProfiles.concat(page ?? []);
        if (!page || page.length < 1000) break;
      }
      const profileMap = new Map(allProfiles.map((p: any) => [p.user_id, p]));

      const { data: lastActiveRows, error: lastActiveErr } = await supabaseAdmin
        .rpc('admin_list_users_last_active');
      if (lastActiveErr) throw lastActiveErr;
      const lastActiveMap = new Map(
        (lastActiveRows ?? []).map((r: any) => [r.user_id, r.last_active_at]),
      );
```

- [ ] 3. Add `last_active_at` to the mapped user (after line 180):

```ts
          last_sign_in_at: u.last_sign_in_at ?? null,
          last_active_at: lastActiveMap.get(u.id) ?? u.last_sign_in_at ?? null,
```

- [ ] 4. Run tests + typecheck from the portal root:

```bash
deno test supabase/functions/admin-users/lib_test.ts
deno check supabase/functions/admin-users/index.ts
```

- [ ] 5. Deploy:

```bash
supabase functions deploy admin-users
```

- [ ] 6. Commit: `feat(admin): return last_active_at from admin-users`

---

## Task 3: Frontend — render `last_active_at`

**Files:**
- Modify: `src/lib/userActivity.ts`
- Modify: `src/lib/userActivity.test.ts`
- Modify: `src/routes/admin/UsersPage.tsx` (type 12–22; `LastActiveCell` 85–99; render 440)

- [ ] 1. Write the failing tests in `src/lib/userActivity.test.ts`:

```ts
import { parseUserAgent, lastActiveStatus, lastActiveLabel, formatRelativeTime } from './userActivity';

describe('lastActiveLabel', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('is "No activity yet" when there is no timestamp', () => {
    expect(lastActiveLabel(null, now)).toBe('No activity yet');
  });

  it('is "Active now" within five minutes', () => {
    expect(lastActiveLabel('2026-09-03T11:58:00Z', now)).toBe('Active now');
  });

  it('is relative time for older activity', () => {
    expect(lastActiveLabel('2026-09-03T09:00:00Z', now)).toBe('3 hours ago');
  });
});
```

- [ ] 2. Run to verify failure: `npx vitest run src/lib/userActivity.test.ts` → fails (no export).
- [ ] 3. Add to `src/lib/userActivity.ts`:

```ts
/** Label for the Last Active cell. Kept here, not inline in the page, so the
 *  never/online fallbacks stay unit-tested next to the thresholds they use. */
export function lastActiveLabel(iso: string | null, now: Date = new Date()): string {
  const status = lastActiveStatus(iso, now);
  if (!iso || status === 'never') return 'No activity yet';
  if (status === 'online') return 'Active now';
  return formatRelativeTime(iso, now);
}
```

- [ ] 4. Run tests → pass.
- [ ] 5. Update `UsersPage.tsx`:
  - `AdminUser`: replace `last_sign_in_at: string | null;` with `last_active_at: string | null;`
  - `LastActiveCell` takes `lastActiveAt` and renders `lastActiveLabel(lastActiveAt)` + `lastActiveStatus(lastActiveAt)` for the dot.
  - Line 440: `<LastActiveCell lastActiveAt={u.last_active_at} />`.

- [ ] 6. Run `npm run test` → all pass. Commit: `fix(admin): compute Last Active from sessions and viewing activity`

---

## Task 4: Frontend — bounded requests so "Loading…" can never stick

**Files:**
- Create: `src/lib/authed-fetch.ts`
- Create: `src/lib/authed-fetch.test.ts`
- Modify: `src/routes/admin/UsersPage.tsx` (list effect 182–193, `toggleRow` 273–296, mutations 195–348)

- [ ] 1. Write `src/lib/authed-fetch.test.ts` first:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authedFetchJson, SessionExpiredError, withTimeout } from './authed-fetch';
import { authHeaders } from './auth-headers';

vi.mock('./auth-headers', () => ({ authHeaders: vi.fn() }));

const mockAuthHeaders = vi.mocked(authHeaders);

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuthHeaders.mockResolvedValue({ Authorization: 'Bearer test' });
});

describe('withTimeout', () => {
  it('resolves when the promise beats the timer', async () => {
    await expect(withTimeout(Promise.resolve(1), 50, 'too slow')).resolves.toBe(1);
  });

  it('rejects with the given message when the promise never settles', async () => {
    await expect(withTimeout(new Promise(() => {}), 20, 'too slow')).rejects.toThrow('too slow');
  });
});

describe('authedFetchJson', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), { status: 200 }),
    ));
    await expect(authedFetchJson('https://x.test')).resolves.toEqual({ users: [] });
  });

  it('rejects with SessionExpiredError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    ));
    await expect(authedFetchJson('https://x.test')).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('rejects with the server message on other errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    ));
    await expect(authedFetchJson('https://x.test')).rejects.toThrow('boom');
  });

  it('times out when fetch never settles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    await expect(
      authedFetchJson('https://x.test', {}, { requestMs: 20 }),
    ).rejects.toThrow('timed out');
  });
});
```

- [ ] 2. Run → fails (module missing).
- [ ] 3. Implement `src/lib/authed-fetch.ts`:

```ts
import { authHeaders } from './auth-headers';

/** Thrown when the endpoint answers 401: the access token is dead (expired,
 *  revoked, or from a session that was signed out elsewhere). Callers should
 *  sign out so the route guards send the user to /login. */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

const SESSION_READ_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 20_000;
const TIMEOUT_MESSAGE = 'The request timed out — check your connection and try again.';

/** Races a promise against a timer so a stalled await surfaces as an error
 *  instead of leaving a page stuck on "Loading…" forever. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type JsonRequestInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

/** Authed JSON fetch for edge functions: fresh token, bounded in both the
 *  session read and the request itself, one consistent error shape. */
export async function authedFetchJson<T>(
  url: string,
  init: JsonRequestInit = {},
  timeouts: { sessionMs?: number; requestMs?: number } = {},
): Promise<T> {
  const headers = await withTimeout(
    authHeaders(init.headers ?? {}),
    timeouts.sessionMs ?? SESSION_READ_TIMEOUT_MS,
    'Could not read your session — please refresh the page and sign in again.',
  );

  const controller = new AbortController();
  const requestMs = timeouts.requestMs ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), requestMs);
  try {
    const res = await withTimeout(
      fetch(url, { ...init, headers, signal: controller.signal }),
      requestMs,
      TIMEOUT_MESSAGE,
    );
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      throw new SessionExpiredError(data?.error ?? undefined);
    }
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(TIMEOUT_MESSAGE);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] 4. Run tests → pass.
- [ ] 5. Update `UsersPage.tsx`:
  - Import `authedFetchJson, SessionExpiredError` and `supabase` from `../../lib/supabase`.
  - Replace the list effect with a `reloadKey`-driven loader; `setLoading(false)` in `finally`; on `SessionExpiredError` call `supabase.auth.signOut()` so `AdminRoute` redirects to `/login`:

```tsx
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authedFetchJson<{ users: AdminUser[] }>(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/admin-users`,
        );
        if (!cancelled) setUsers(data.users ?? []);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          // The token is dead: sign out so AdminRoute sends us to /login
          // instead of leaving this page stuck with a permissions error.
          await supabase.auth.signOut();
          return;
        }
        if (!cancelled) setError((e as Error).message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session, reloadKey]);
```

  - Error render gains retry: `<Button size="sm" variant="ghost" onClick={() => setReloadKey(k => k + 1)}>Try again</Button>`.
  - `toggleRow` GET and all PATCH/DELETE/activity call sites switch to `authedFetchJson` (drop the manual `res.json()`/`if (!res.ok) throw` blocks). In each mutation `catch`, add: `if (e instanceof SessionExpiredError) { void supabase.auth.signOut(); return; }` before setting the inline error.

- [ ] 6. Run `npm run test` and `npm run build` → pass. Commit: `fix(admin): timeout-bound admin requests so the users page can't hang`

---

## Task 5: End-to-end verification

- [ ] 1. `npm run test && npm run build`.
- [ ] 2. Re-run Task 1 verification SQL and compare the RPC output for 2–3 known users against raw `max()` queries.
- [ ] 3. Load `/admin/users` in the browser:
  - Last Active now shows session/viewing recency (e.g. eyowti46@gmail.com should read "yesterday"/hours, not "~1 month ago").
  - Expand two rows: sessions and activity still render.
  - DevTools → Network → Offline → try again/reload: page shows the timeout/offline error and a working Try again button; it never sits on "Loading…".
- [ ] 4. An admin account with a revoked session should land on `/login` rather than a stuck page.

## Out of scope (noted for later)

- Auto-refresh/polling of the list (page-load refresh was chosen).
- Reconciling the drifted migration ledger.
- Adopting `authedFetchJson` on other admin pages (`InvitesPage`), same pattern applies.
