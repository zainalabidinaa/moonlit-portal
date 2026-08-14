-- Role now lives on `accounts` (see root repo's 20260812_account_level_role.sql).
-- Expiring a friends_family grant must update the account, not a single
-- profile row — the profiles sync trigger then fans the 'free' reset out to
-- every profile for that user automatically.
create or replace function expire_friends_family_role()
returns void as $$
begin
  update accounts
  set role = 'free', role_expires_at = null
  where user_id = auth.uid()
    and role = 'friends_family'
    and role_expires_at is not null
    and role_expires_at <= now();
end;
$$ language plpgsql security definer;
