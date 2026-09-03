# User activity & sessions on the Users page — design

Date: 2026-09-03
Status: implemented

## Problem

`/admin/users` shows role, expiry, streams access, and join date, but nothing about
whether an account is actually being used: when they last signed in, what device
they're on, or what they've been watching. Support and account questions ("did
this person ever activate?", "are they even using it?") currently require going
into the Supabase dashboard by hand.

## Goals

- Show a "Last Active" signal per user directly in the users table.
- On demand (per row), show recent sign-in sessions and recent content activity
  (watched/in-progress/liked) for that account.
- Ship entirely from this repo — no changes to the iOS/macOS apps.

## Non-goals

- Per-device/platform breakdown as a first-class dimension. `user_agent` is stored
  and shown as a human-readable label where it's free, but nothing is built around
  distinguishing iOS vs macOS vs web.
- Any new event pipeline for the native/web apps to report activity into. Deferred
  — see Open items.
- Editing or clearing session/activity data from the admin UI. Read-only.

## Discovery: the data already exists

Nothing here needs a new table. The live database (checked directly via
`supabase db query --linked`, since local migrations have drifted from remote —
see Open items) already has:

- **`auth.users.last_sign_in_at`** — set by Supabase Auth on every sign-in.
  `admin-users` already fetches full `auth.users` rows via `listUsers()` but
  discards everything except `id`, `email`, `created_at`.
- **`auth.sessions`** — one row per active/past session, written by Supabase Auth
  itself, not by app code. Confirmed live and populated (31 rows as of this
  writing): `user_id`, `created_at`, `updated_at` (bumped on token refresh, so
  it's a real "last seen" per session), `user_agent`, `ip`. This covers native
  apps too — a `Moonlit/22 CFNetwork/… Darwin/…` user agent is a macOS/iOS app
  session, both showing up next to plain browser sessions with no extra work.
  (`auth.audit_log_entries` was also checked as a candidate source and is empty
  on this project — not usable.)
- **`profiles.user_id`** — links an account to its profile(s) (this app has
  Netflix-style multi-profile accounts).
- **`watch_progress`**, **`watched_items`**, **`liked_items`** — all keyed by
  `profile_id`, already written by the client apps today: in-progress position,
  completed watches, and likes, each with `name`, `media_type`, `season`/
  `episode`, and a timestamp (`updated_at` / `marked_at` / `liked_at`). None of
  these appear in local migration files — they were created directly against the
  remote database.

This turns the feature into a read-only surface over existing data, not a new
data pipeline. One small migration is still needed — a `SECURITY DEFINER`
bridge function, not a table — see below.

## Design

### Backend — `supabase/functions/admin-users/index.ts`

**1. `GET` (list) gains one field.** The existing `listUsers()` call already
returns `last_sign_in_at` on every auth user object; it's just not mapped into
the response. Add it alongside `created_at`.

**2. New `GET ?activity=<user_id>` branch**, gated by the same admin check
already at the top of the function. Given a `user_id`:

- **Sessions**: `auth.sessions` has no grants for `anon`/`authenticated`/
  `service_role` (checked directly — only the `postgres` role can touch it), so
  it isn't reachable through `supabaseAdmin.from(...)` (PostgREST). This project
  already has precedent for this exact bridge: `install_curated_setup` is a
  `SECURITY DEFINER` function owned by `postgres`, callable by `service_role` via
  `.rpc()`. A new migration adds `public.admin_list_user_sessions(target_user_id
  uuid, limit_count integer default 10)` the same way — `security definer`,
  `execute` revoked from `public` and granted only to `service_role` — returning
  `created_at, updated_at, user_agent, ip` ordered by `updated_at desc`.
- **Activity**: resolve `profile_id`s for the account (`select id from profiles
  where user_id = $1`), then fetch the most recent ~10 rows total across
  `watch_progress` (`completed = false`, i.e. in-progress), `watched_items`, and
  `liked_items` for those profile ids, tag each with its source table, merge, sort
  by timestamp descending, and cap to 10. Three small queries plus an in-memory
  merge — no view or join needed for this volume.

This is fetched lazily, only when a row is expanded in the UI — not prefetched
for the whole list — so the list endpoint stays a single `listUsers()` +
`profiles` query regardless of how many users exist.

Response shape:

```ts
{
  sessions: Array<{
    created_at: string;
    updated_at: string;
    user_agent: string | null;
    ip: string | null;
  }>;
  activity: Array<{
    kind: 'in_progress' | 'watched' | 'liked';
    name: string | null;
    media_type: string | null;
    season: number | null;
    episode: number | null;
    at: string; // updated_at / marked_at / liked_at, whichever applies
  }>;
}
```

`ip` is returned but the UI does not render it (see Privacy below) — kept in the
response for a future support-tooling use, not displayed today.

### Frontend — `src/routes/admin/UsersPage.tsx`

- `AdminUser` type gains `last_sign_in_at: string | null`.
- New **Last Active** column between Role and Joined: a status dot (online in
  last 5 min / active in last 24h / stale) plus a relative time
  ("3 hours ago", "Never signed in" when `last_sign_in_at` is null).
- Rows become expandable (click anywhere on the row outside existing controls
  toggles it, matching the interaction already prototyped). Expanding a row:
  - Lazy-fetches `admin-users?activity=<user_id>` on first expand, caches the
    result in component state so re-toggling doesn't refetch.
  - Renders two panels side by side (stacked on narrow viewports): **Sessions**
    (device label parsed from `user_agent`, relative time, a "LIVE" chip when
    `updated_at` is within the last few minutes) and **Recent activity** (icon by
    `kind`, title, `season`/`episode` context, relative time).
  - `user_agent` only distinguishes "Moonlit app" (native) from a browser label
    — per Non-goals, nothing tries to tell iOS and macOS apart, since both send
    the same `Moonlit/… Darwin/…` pattern with no reliable marker between them.
  - Empty states: "No sessions yet" / "No activity yet" rather than a blank panel.
- A tiny `parseUserAgent(ua: string | null): string` helper maps the known
  patterns (`Moonlit/… Darwin` → "Moonlit app (Mac/iOS)", a browser UA → browser +
  OS via existing substring checks) to a short label. Unrecognized strings fall
  back to a truncated raw UA rather than guessing.

### Privacy

`ip` is stored by Supabase Auth already and is fetched by the new endpoint, but
is **not rendered** in the admin UI in this iteration — there's no product need
for it yet, and admins seeing raw visitor IPs by default is worth avoiding until
there's an actual reason (e.g. abuse investigation tooling).

### Error handling

If the activity fetch fails (network error, function error), the drawer shows an
inline "Couldn't load activity" message with the raw error, not a silent empty
state — consistent with how the rest of this page surfaces errors today.

### Testing

No existing test suite covers `UsersPage.tsx` or `admin-users`. Given the low
complexity (read-only, additive), this ships without new automated tests; manual
verification is via the deployment steps below. `parseUserAgent` is a pure
function and is the one place worth a couple of inline `deno test` cases if the
pattern list grows past the two cases above.

## Deployment

1. Deploy the updated `admin-users` function: `supabase functions deploy
   admin-users`.
2. Load `/admin/users`, confirm Last Active renders for a mix of recent and
   never-signed-in accounts.
3. Expand a row for an account known to have watch history and one known to have
   none; confirm both the populated and empty states render correctly.

## Open items

- **Migration drift**: `watch_progress`, `watched_items`, `liked_items`,
  `device_codes`, and several other tables exist on the remote database with no
  corresponding file in `supabase/migrations/`, and `supabase migration list
  --linked` shows local/remote history diverging in both directions. This predates
  this feature and isn't blocking it (the new code only reads these tables), but
  `supabase db push` will not work cleanly until someone reconciles migration
  history — worth its own task.
- **Cross-app activity beyond watch/like data** (explicit page-view or
  action-level analytics) would need a real event pipeline and changes inside the
  iOS/macOS app repos. Out of scope here; flagged for later per the user.
