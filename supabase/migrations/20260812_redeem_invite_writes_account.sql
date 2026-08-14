-- Role now lives on `accounts`, not `profiles` (see the root repo's
-- 20260812_account_level_role.sql). redeem_invite_code used to just consume
-- the code and hand the duration back to the client, which then did its own
-- `profiles.update({role: 'friends_family', ...})` — that write is now a
-- no-op (the profiles sync trigger overrides it back to the account's
-- current role). Grant the role here instead, atomically with consuming the
-- code, so there's no separate client write needed at all.
create or replace function redeem_invite_code(
  p_code text,
  p_user_id uuid,
  p_email text
)
returns integer as $$
declare
  v_duration integer;
  v_valid boolean;
  v_expires_at timestamptz;
begin
  select role_duration_days
  into v_duration
  from invite_codes
  where code = p_code;

  select is_active
    and used_by is null
    and (expires_at is null or expires_at > now())
  into v_valid
  from invite_codes
  where code = p_code;

  if not coalesce(v_valid, false) then
    raise exception 'Invalid, expired, or already used invite code.';
  end if;

  update invite_codes
  set used_by = p_user_id,
      used_email = p_email,
      used_at = now()
  where code = p_code;

  v_expires_at := case
    when v_duration is null then null
    else now() + (v_duration || ' days')::interval
  end;

  insert into accounts (user_id, role, role_expires_at)
  values (p_user_id, 'friends_family', v_expires_at)
  on conflict (user_id) do update
    set role = excluded.role,
        role_expires_at = excluded.role_expires_at;

  return v_duration;
end;
$$ language plpgsql security definer;
