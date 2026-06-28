create or replace function create_invite_code(
  p_code text,
  p_created_by uuid,
  p_expires_at timestamptz,
  p_role_duration_days integer
)
returns void as $$
begin
  insert into invite_codes (code, created_by, is_active, max_uses, expires_at, role_duration_days)
  values (p_code, p_created_by, true, 1, p_expires_at, p_role_duration_days);
end;
$$ language plpgsql security definer;

create or replace function update_invite_expiration(
  p_code text,
  p_expires_at timestamptz
)
returns void as $$
begin
  update invite_codes set expires_at = p_expires_at where code = p_code;
end;
$$ language plpgsql security definer;
