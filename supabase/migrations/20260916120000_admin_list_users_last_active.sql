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
