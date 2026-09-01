# "Run setup now" button on the Users admin page

## Problem

`install_curated_setup(p_profile_id)` re-provisions a user's curated addons/catalogs.
Today it only runs server-side when an admin toggles `stream_addons_enabled` on the
Users page (`src/routes/admin/UsersPage.tsx`), or via the periodic cron sync. There's
no way to force a re-provision for a user without flipping that unrelated flag.

## Change

**Frontend** (`src/routes/admin/UsersPage.tsx`):
- Add a `Button size="sm" variant="ghost"` labeled "Run setup" to each user row,
  next to the existing "Delete" button.
- New state: `runningSetup: string | null` (mirrors `changingStreams`), disables the
  button and shows "Running…" while in flight.
- On click, `PATCH /admin-users` with `{ userId, runSetup: true }`.
- On success/failure, reuse the existing `error` banner pattern (transient message,
  cleared after 4s) — no persistent row state changes, so no success banner needed
  beyond the button returning to its normal state.
- No confirmation modal: the action is idempotent and non-destructive, same trust
  level as the streams checkbox.

**Backend** (`supabase/functions/admin-users/index.ts`, PATCH handler):
- Accept a new `runSetup?: boolean` field in the request body.
- Resolve the user's first profile id the same way the existing
  `stream_addons_enabled` branch does.
- If `runSetup` is true, call `supabaseAdmin.rpc('install_curated_setup', { p_profile_id: profileId })`
  regardless of whether `role` or `stream_addons_enabled` were also present in the
  request.
- No new RPC or migration needed — reuses `install_curated_setup`.

## Out of scope

- Bulk/multi-user "run setup" action.
- Changing what `install_curated_setup` provisions.
- Any change to the free-vs-non-free catalog gating logic.
