-- Nested folders and a single, portal-controlled ordering for folder contents.
-- Root folders continue to use folders.sort_order within their collection.

alter table public.folders
  add column if not exists parent_folder_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'folders_parent_folder_id_fkey'
      and conrelid = 'public.folders'::regclass
  ) then
    alter table public.folders
      add constraint folders_parent_folder_id_fkey
      foreign key (parent_folder_id) references public.folders(id) on delete cascade;
  end if;
end;
$$;

create table if not exists public.folder_entries (
  id uuid primary key default gen_random_uuid(),
  parent_folder_id uuid not null references public.folders(id) on delete cascade,
  entry_kind text not null check (entry_kind in ('folder', 'catalog', 'source')),
  folder_id uuid references public.folders(id) on delete cascade,
  folder_catalog_id uuid references public.folder_catalogs(id) on delete cascade,
  folder_source_id uuid references public.folder_sources(id) on delete cascade,
  sort_order integer not null,
  unique (parent_folder_id, sort_order),
  check ((entry_kind = 'folder' and folder_id is not null and folder_catalog_id is null and folder_source_id is null)
      or (entry_kind = 'catalog' and folder_id is null and folder_catalog_id is not null and folder_source_id is null)
      or (entry_kind = 'source' and folder_id is null and folder_catalog_id is null and folder_source_id is not null))
);

-- A child/content record may appear at most once in the hierarchy.
create unique index if not exists folder_entries_folder_id_unique
  on public.folder_entries (folder_id) where folder_id is not null;
create unique index if not exists folder_entries_catalog_id_unique
  on public.folder_entries (folder_catalog_id) where folder_catalog_id is not null;
create unique index if not exists folder_entries_source_id_unique
  on public.folder_entries (folder_source_id) where folder_source_id is not null;

create or replace function public.validate_folder_hierarchy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_collection_id uuid;
  v_has_cross_collection_descendant boolean;
  v_would_cycle boolean;
begin
  if new.parent_folder_id is not null then
    if new.id = new.parent_folder_id then
      raise exception 'a folder cannot contain itself';
    end if;

    select collection_id into v_parent_collection_id
    from folders
    where id = new.parent_folder_id;
    if v_parent_collection_id is null then
      raise exception 'parent folder % does not exist', new.parent_folder_id;
    end if;
    if new.collection_id <> v_parent_collection_id then
      raise exception 'folders cannot cross collections';
    end if;

    with recursive ancestors(id) as (
      select new.parent_folder_id
      union all
      select f.parent_folder_id
      from folders f
      join ancestors a on a.id = f.id
      where f.parent_folder_id is not null
    )
    select exists (select 1 from ancestors where id = new.id) into v_would_cycle;
    if v_would_cycle then
      raise exception 'folder parent would introduce a cycle';
    end if;
  end if;

  -- A direct collection update must not leave an existing descendant attached
  -- to a parent in another collection.
  with recursive descendants(id) as (
    select f.id from folders f where f.parent_folder_id = new.id
    union all
    select f.id
    from folders f
    join descendants d on f.parent_folder_id = d.id
  )
  select exists (
    select 1
    from descendants d
    join folders f on f.id = d.id
    where f.collection_id <> new.collection_id
  ) into v_has_cross_collection_descendant;
  if v_has_cross_collection_descendant then
    raise exception 'folder collection change would cross collection boundaries';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_folder_hierarchy_before_write on public.folders;
create trigger validate_folder_hierarchy_before_write
before insert or update of parent_folder_id, collection_id on public.folders
for each row execute function public.validate_folder_hierarchy();

create or replace function public.validate_folder_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_collection_id uuid;
  v_child_collection_id uuid;
  v_child_parent_folder_id uuid;
  v_content_parent_id uuid;
  v_would_cycle boolean;
begin
  select collection_id into v_parent_collection_id
  from folders
  where id = new.parent_folder_id;

  if v_parent_collection_id is null then
    raise exception 'folder entry parent % does not exist', new.parent_folder_id;
  end if;

  if new.entry_kind = 'folder' then
    select collection_id, parent_folder_id
      into v_child_collection_id, v_child_parent_folder_id
    from folders
    where id = new.folder_id;

    if v_child_collection_id is null then
      raise exception 'folder entry child % does not exist', new.folder_id;
    end if;
    if v_child_collection_id <> v_parent_collection_id then
      raise exception 'folder entries cannot cross collections';
    end if;
    if v_child_parent_folder_id is distinct from new.parent_folder_id then
      raise exception 'folder entry must match the child folder parent';
    end if;
    if new.folder_id = new.parent_folder_id then
      raise exception 'a folder cannot contain itself';
    end if;

    with recursive ancestors(id) as (
      select new.parent_folder_id
      union all
      select f.parent_folder_id
      from folders f
      join ancestors a on a.id = f.id
      where f.parent_folder_id is not null
    )
    select exists (select 1 from ancestors where id = new.folder_id)
      into v_would_cycle;

    if v_would_cycle then
      raise exception 'folder entry would introduce a cycle';
    end if;
  elsif new.entry_kind = 'catalog' then
    select folder_id into v_content_parent_id
    from folder_catalogs
    where id = new.folder_catalog_id;

    if v_content_parent_id is null then
      raise exception 'catalog entry child % does not exist', new.folder_catalog_id;
    end if;
    if v_content_parent_id <> new.parent_folder_id then
      raise exception 'catalog entry must belong to its parent folder';
    end if;
  elsif new.entry_kind = 'source' then
    select folder_id into v_content_parent_id
    from folder_sources
    where id = new.folder_source_id;

    if v_content_parent_id is null then
      raise exception 'source entry child % does not exist', new.folder_source_id;
    end if;
    if v_content_parent_id <> new.parent_folder_id then
      raise exception 'source entry must belong to its parent folder';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_folder_entry_before_write on public.folder_entries;
create trigger validate_folder_entry_before_write
before insert or update on public.folder_entries
for each row execute function public.validate_folder_entry();

-- Existing folders are roots (parent_folder_id remains NULL). Materialize existing
-- folder content so its previous source order is retained in the new unified list.
insert into public.folder_entries (parent_folder_id, entry_kind, folder_source_id, sort_order)
select
  ranked.folder_id,
  'source',
  ranked.id,
  ranked.position - 1
from (
  select
    fs.id,
    fs.folder_id,
    row_number() over (partition by fs.folder_id order by fs.sort_order, fs.id) as position
  from public.folder_sources fs
) ranked
on conflict (folder_source_id) where folder_source_id is not null do nothing;

insert into public.folder_entries (parent_folder_id, entry_kind, folder_catalog_id, sort_order)
select
  ranked.folder_id,
  'catalog',
  ranked.id,
  ranked.source_count + ranked.position - 1
from (
  select
    fc.id,
    fc.folder_id,
    coalesce(source_counts.source_count, 0) as source_count,
    row_number() over (partition by fc.folder_id order by fc.id) as position
  from public.folder_catalogs fc
  left join (
    select folder_id, count(*) as source_count
    from public.folder_sources
    group by folder_id
  ) source_counts on source_counts.folder_id = fc.folder_id
) ranked
on conflict (folder_catalog_id) where folder_catalog_id is not null do nothing;

-- Moving a folder keeps folders.parent_folder_id and folder_entries synchronized.
create or replace function public.move_folder(
  p_folder_id uuid,
  p_parent_folder_id uuid,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folder_collection_id uuid;
  v_parent_collection_id uuid;
  v_would_cycle boolean;
begin
  if p_sort_order < 0 then
    raise exception 'sort order must be non-negative';
  end if;

  select collection_id into v_folder_collection_id
  from folders
  where id = p_folder_id
  for update;
  if v_folder_collection_id is null then
    raise exception 'folder % does not exist', p_folder_id;
  end if;

  if p_parent_folder_id is null then
    -- Make room among collection-root folders without briefly violating an order.
    update folders
    set sort_order = sort_order + 1000000
    where collection_id = v_folder_collection_id
      and parent_folder_id is null
      and id <> p_folder_id
      and sort_order >= p_sort_order;
    update folders
    set sort_order = sort_order - 999999
    where collection_id = v_folder_collection_id
      and parent_folder_id is null
      and id <> p_folder_id
      and sort_order >= p_sort_order + 1000000;

    delete from folder_entries where folder_id = p_folder_id;
    update folders
    set parent_folder_id = null, sort_order = p_sort_order
    where id = p_folder_id;
    return;
  end if;

  select collection_id into v_parent_collection_id
  from folders
  where id = p_parent_folder_id
  for update;
  if v_parent_collection_id is null then
    raise exception 'parent folder % does not exist', p_parent_folder_id;
  end if;
  if v_folder_collection_id <> v_parent_collection_id then
    raise exception 'folders cannot cross collections';
  end if;
  if p_folder_id = p_parent_folder_id then
    raise exception 'a folder cannot contain itself';
  end if;

  with recursive ancestors(id) as (
    select p_parent_folder_id
    union all
    select f.parent_folder_id
    from folders f
    join ancestors a on a.id = f.id
    where f.parent_folder_id is not null
  )
  select exists (select 1 from ancestors where id = p_folder_id)
    into v_would_cycle;
  if v_would_cycle then
    raise exception 'moving this folder would introduce a cycle';
  end if;

  delete from folder_entries where folder_id = p_folder_id;
  perform 1 from folder_entries where parent_folder_id = p_parent_folder_id for update;
  update folder_entries
  set sort_order = sort_order + 1000000
  where parent_folder_id = p_parent_folder_id and sort_order >= p_sort_order;
  update folder_entries
  set sort_order = sort_order - 999999
  where parent_folder_id = p_parent_folder_id and sort_order >= p_sort_order + 1000000;

  update folders set parent_folder_id = p_parent_folder_id where id = p_folder_id;
  insert into folder_entries (parent_folder_id, entry_kind, folder_id, sort_order)
  values (p_parent_folder_id, 'folder', p_folder_id, p_sort_order);
end;
$$;

-- Replace a folder's ordered children atomically. p_entries is an array of objects:
-- {"entry_kind":"folder","folder_id":"..."},
-- {"entry_kind":"catalog","folder_catalog_id":"..."}, or
-- {"entry_kind":"source","folder_source_id":"..."}.
create or replace function public.replace_folder_entries(
  p_parent_folder_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_collection_id uuid;
  v_invalid_count integer;
  v_would_cycle boolean;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'entries must be a JSON array';
  end if;

  select collection_id into v_parent_collection_id
  from folders where id = p_parent_folder_id for update;
  if v_parent_collection_id is null then
    raise exception 'parent folder % does not exist', p_parent_folder_id;
  end if;
  perform 1 from folder_entries where parent_folder_id = p_parent_folder_id for update;

  with entries as (
    select value as entry
    from jsonb_array_elements(p_entries)
  )
  select count(*) into v_invalid_count
  from entries
  where jsonb_typeof(entry) <> 'object'
     or entry->>'entry_kind' not in ('folder', 'catalog', 'source')
     or (entry->>'entry_kind' = 'folder' and (entry->>'folder_id' is null or entry ? 'folder_catalog_id' or entry ? 'folder_source_id'))
     or (entry->>'entry_kind' = 'catalog' and (entry->>'folder_catalog_id' is null or entry ? 'folder_id' or entry ? 'folder_source_id'))
     or (entry->>'entry_kind' = 'source' and (entry->>'folder_source_id' is null or entry ? 'folder_id' or entry ? 'folder_catalog_id'));
  if v_invalid_count > 0 then
    raise exception 'each entry must have exactly one ID matching its entry_kind';
  end if;

  with entries as (
    select value as entry
    from jsonb_array_elements(p_entries)
  ), identities as (
    select entry->>'entry_kind' as entry_kind,
      coalesce(entry->>'folder_id', entry->>'folder_catalog_id', entry->>'folder_source_id') as id
    from entries
  )
  select count(*) - count(distinct (entry_kind, id)) into v_invalid_count from identities;
  if v_invalid_count > 0 then
    raise exception 'entries cannot contain the same child more than once';
  end if;

  -- Validate every reference before deleting any prior order.
  with entries as (
    select value as entry from jsonb_array_elements(p_entries)
  )
  select count(*) into v_invalid_count
  from entries e
  left join folders f on e.entry->>'entry_kind' = 'folder'
    and f.id = (e.entry->>'folder_id')::uuid
  left join folder_catalogs fc on e.entry->>'entry_kind' = 'catalog'
    and fc.id = (e.entry->>'folder_catalog_id')::uuid
  left join folder_sources fs on e.entry->>'entry_kind' = 'source'
    and fs.id = (e.entry->>'folder_source_id')::uuid
  where (e.entry->>'entry_kind' = 'folder' and (f.id is null or f.collection_id <> v_parent_collection_id))
     or (e.entry->>'entry_kind' = 'catalog' and (fc.id is null or fc.folder_id <> p_parent_folder_id))
     or (e.entry->>'entry_kind' = 'source' and (fs.id is null or fs.folder_id <> p_parent_folder_id));
  if v_invalid_count > 0 then
    raise exception 'entries contain a missing or invalid cross-parent reference';
  end if;

  with entries as (
    select (value->>'folder_id')::uuid as folder_id
    from jsonb_array_elements(p_entries)
    where value->>'entry_kind' = 'folder'
  ), ancestors as (
    with recursive path(id) as (
      select p_parent_folder_id
      union all
      select f.parent_folder_id
      from folders f join path on path.id = f.id
      where f.parent_folder_id is not null
    ) select id from path
  )
  select exists (
    select 1
    from entries
    join ancestors on ancestors.id = entries.folder_id
  ) into v_would_cycle;
  if v_would_cycle then
    raise exception 'entries would introduce a folder cycle';
  end if;

  -- Free selected children from an old parent before their new entries are written.
  delete from folder_entries fe
  using (
    select (value->>'folder_id')::uuid as folder_id
    from jsonb_array_elements(p_entries)
    where value->>'entry_kind' = 'folder'
  ) selected
  where fe.folder_id = selected.folder_id;

  update folders
  set parent_folder_id = null
  where id in (
    select folder_id from folder_entries
    where parent_folder_id = p_parent_folder_id and entry_kind = 'folder'
  );
  delete from folder_entries where parent_folder_id = p_parent_folder_id;

  update folders
  set parent_folder_id = p_parent_folder_id
  where id in (
    select (value->>'folder_id')::uuid
    from jsonb_array_elements(p_entries)
    where value->>'entry_kind' = 'folder'
  );

  insert into folder_entries (
    parent_folder_id, entry_kind, folder_id, folder_catalog_id, folder_source_id, sort_order
  )
  select
    p_parent_folder_id,
    value->>'entry_kind',
    case when value->>'entry_kind' = 'folder' then (value->>'folder_id')::uuid end,
    case when value->>'entry_kind' = 'catalog' then (value->>'folder_catalog_id')::uuid end,
    case when value->>'entry_kind' = 'source' then (value->>'folder_source_id')::uuid end,
    ordinal - 1
  from jsonb_array_elements(p_entries) with ordinality as entries(value, ordinal);
end;
$$;

grant execute on function public.move_folder(uuid, uuid, integer) to authenticated;
grant execute on function public.replace_folder_entries(uuid, jsonb) to authenticated;
