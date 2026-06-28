alter table public.invite_codes
  add column if not exists role_duration_days integer;

create or replace function redeem_invite_code(
  p_code text,
  p_user_id uuid,
  p_email text
)
returns integer as $$
declare
  v_duration integer;
  v_valid boolean;
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

  return v_duration;
end;
$$ language plpgsql security definer;
