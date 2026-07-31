-- Support / contact inbox for messages sent from the public contact page.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  topic text not null default 'general',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);

create index if not exists support_requests_status_idx
  on public.support_requests (status);

alter table public.support_requests enable row level security;

-- Anyone can send a message, signed in or not — the contact page is public.
drop policy if exists support_requests_insert_any on public.support_requests;
create policy support_requests_insert_any
  on public.support_requests for insert
  to anon, authenticated
  with check (true);

-- Signed-in users can read back the requests they sent.
drop policy if exists support_requests_select_own on public.support_requests;
create policy support_requests_select_own
  on public.support_requests for select
  to authenticated
  using (user_id = auth.uid());

-- Admins read and triage everything.
drop policy if exists support_requests_select_admin on public.support_requests;
create policy support_requests_select_admin
  on public.support_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists support_requests_update_admin on public.support_requests;
create policy support_requests_update_admin
  on public.support_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
