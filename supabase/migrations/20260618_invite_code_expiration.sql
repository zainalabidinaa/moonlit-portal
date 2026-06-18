alter table public.invite_codes
  add column if not exists expires_at timestamptz;

alter table public.invite_codes
  add column if not exists used_email text;

create index if not exists invite_codes_expires_at_idx
  on public.invite_codes (expires_at);

create or replace function validate_invite_code(p_code text)
returns boolean as $$
declare
  v_valid boolean;
begin
  select is_active
    and used_by is null
    and (expires_at is null or expires_at > now())
  into v_valid
  from invite_codes
  where code = p_code;

  return coalesce(v_valid, false);
end;
$$ language plpgsql security definer;
