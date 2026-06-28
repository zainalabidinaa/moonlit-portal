alter table public.profiles
  add column if not exists role_expires_at timestamptz;

create index if not exists profiles_role_expires_at_idx
  on public.profiles (role_expires_at)
  where role_expires_at is not null;
