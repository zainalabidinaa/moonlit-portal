-- Label sign-in sessions with the real device when a Moonlit app reported one.
--
-- auth.sessions only has the User-Agent, which for the native apps is the
-- same `Moonlit/… Darwin/…` on iPhone, iPad, Mac and Apple TV. The apps now
-- call register_device() (Moonlit/supabase/migrations/20261029_user_devices.sql),
-- which stores the hardware model against the session it was signed in on —
-- so both session lists can join user_devices on session_id and show
-- "iPhone 16 Pro · iOS 26.0". Sessions with no device row (browsers, apps
-- from before register_device) come back with null device columns and keep
-- their User-Agent label.
--
-- The return type changes, which `create or replace` can't do, so each
-- function is dropped and recreated. Run once in the Supabase SQL editor
-- (it runs as postgres there), after 20261029_user_devices.sql.

drop function if exists public.my_sessions(integer);

create function public.my_sessions(limit_count integer default 20)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text,
  device_platform text,
  device_model text,
  device_os_version text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip),
         d.platform, d.model, d.os_version
  from auth.sessions s
  left join lateral (
    select platform, model, os_version
    from public.user_devices ud
    where ud.session_id = s.id
    order by ud.last_seen_at desc
    limit 1
  ) d on true
  where s.user_id = (select auth.uid())
  order by coalesce(s.updated_at, s.created_at) desc
  limit least(greatest(coalesce(limit_count, 20), 1), 50);
$$;

revoke all on function public.my_sessions(integer) from public;
revoke all on function public.my_sessions(integer) from anon;
grant execute on function public.my_sessions(integer) to authenticated;

drop function if exists public.admin_list_user_sessions(uuid, integer);

create function public.admin_list_user_sessions(
  target_user_id uuid,
  limit_count integer default 10
)
returns table (
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text,
  device_platform text,
  device_model text,
  device_os_version text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.created_at, s.updated_at, s.user_agent, s.ip::text,
         d.platform, d.model, d.os_version
  from auth.sessions s
  left join lateral (
    select platform, model, os_version
    from public.user_devices ud
    where ud.session_id = s.id
    order by ud.last_seen_at desc
    limit 1
  ) d on true
  where s.user_id = target_user_id
  order by s.updated_at desc
  limit limit_count;
$$;

-- See 20260903120000_admin_list_user_sessions.sql: default privileges grant
-- EXECUTE to anon/authenticated directly, so revoke each explicitly.
revoke all on function public.admin_list_user_sessions(uuid, integer) from public;
revoke all on function public.admin_list_user_sessions(uuid, integer) from anon;
revoke all on function public.admin_list_user_sessions(uuid, integer) from authenticated;
grant execute on function public.admin_list_user_sessions(uuid, integer) to service_role;

notify pgrst, 'reload schema';
