-- Tracks whether a support request has been emailed to the team inbox, so the
-- support-notify function can be retried without sending twice.
alter table public.support_requests
  add column if not exists notified_at timestamptz;

create index if not exists support_requests_notified_at_idx
  on public.support_requests (notified_at)
  where notified_at is null;
