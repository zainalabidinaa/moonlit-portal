-- The signed-in user's own sign-in sessions, for "Connected devices" and
-- "Sign-in activity" on the portal's Profiles page.
--
-- Same shape and pattern as admin_list_user_sessions
-- (20260903120000_admin_list_user_sessions.sql): auth.sessions is only
-- readable by `postgres`, so a SECURITY DEFINER function owned by postgres
-- reads it. The difference is scope — this one takes no user id at all and
-- filters on auth.uid(), so a caller can only ever see their own sessions,
-- which is what makes it safe to grant to `authenticated`.
--
-- Run it once in the Supabase SQL editor (it runs as postgres there).

create or replace function public.my_sessions(limit_count integer default 20)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip)
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by coalesce(s.updated_at, s.created_at) desc
  limit least(greatest(coalesce(limit_count, 20), 1), 50);
$$;

-- This schema grants EXECUTE on new functions to anon/authenticated by
-- default (see the note in 20260903120000_admin_list_user_sessions.sql), so
-- revoke explicitly and re-grant only to signed-in users.
revoke all on function public.my_sessions(integer) from public;
revoke all on function public.my_sessions(integer) from anon;
grant execute on function public.my_sessions(integer) to authenticated;
