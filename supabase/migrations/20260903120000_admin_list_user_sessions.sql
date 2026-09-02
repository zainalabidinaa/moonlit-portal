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

-- Revoking from PUBLIC alone is not enough on this project: this schema has
-- `alter default privileges in schema public grant execute on functions to
-- anon, authenticated, service_role`, which grants EXECUTE directly to those
-- roles (not via PUBLIC) on every newly created function. Revoke from them
-- explicitly so anon/authenticated cannot call this RPC.
revoke all on function public.admin_list_user_sessions(uuid, integer) from public;
revoke all on function public.admin_list_user_sessions(uuid, integer) from anon;
revoke all on function public.admin_list_user_sessions(uuid, integer) from authenticated;
grant execute on function public.admin_list_user_sessions(uuid, integer) to service_role;
