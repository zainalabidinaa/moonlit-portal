create or replace function expire_friends_family_role()
returns void as $$
begin
  update profiles
  set role = 'free', role_expires_at = null
  where user_id = auth.uid()
    and role = 'friends_family'
    and role_expires_at is not null
    and role_expires_at <= now();
end;
$$ language plpgsql security definer;
