-- Tracks the confirmation sent to the person who wrote in. Kept separate from
-- notified_at because the two sends fail independently — one column would let a
-- failed confirmation hide behind a successful team notification.
alter table public.support_requests
  add column if not exists confirmed_at timestamptz,
  add column if not exists submitter_ip_hash text;

-- Salted SHA-256 of the client IP, never the address itself: rate limiting only
-- needs to recognise a repeat submitter, which a hash answers exactly.
comment on column public.support_requests.submitter_ip_hash is
  'sha256(client ip + SUPPORT_IP_SALT). Never store the raw address.';

create index if not exists support_requests_ip_hash_idx
  on public.support_requests (submitter_ip_hash, created_at desc);

create index if not exists support_requests_email_idx
  on public.support_requests (email, created_at desc);
