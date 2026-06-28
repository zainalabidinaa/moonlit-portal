drop function if exists delete_all_invite_codes();

create or replace function delete_all_invite_codes()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from invite_codes;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;
