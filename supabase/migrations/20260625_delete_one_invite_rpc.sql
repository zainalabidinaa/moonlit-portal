create or replace function delete_invite_code(p_code text)
returns boolean as $$
begin
  delete from invite_codes where code = p_code;
  return found;
end;
$$ language plpgsql security definer;
