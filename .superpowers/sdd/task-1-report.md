# Task 1 report: nested folder persistence contract

## Implementation summary

Added `supabase/migrations/20260713_nested_folder_entries.sql`.

- Adds nullable `folders.parent_folder_id` with a self-referential cascade FK.
- Adds `folder_entries`, with exactly-one-child checks, parent-order uniqueness,
  and unique child indexes.
- Adds a before-write trigger that rejects missing children, cross-collection
  folder nesting, self/cycle attempts, parent-pointer mismatches, and content
  entries that do not belong to their containing folder.
- Backfills source and catalog entries. Existing sources retain their relative
  `folder_sources.sort_order`; existing catalogs follow them deterministically.
- Adds `move_folder` and `replace_folder_entries` RPCs. The replacement RPC
  locks the parent and siblings, validates the full payload before deleting
  anything, then changes the child-folder pointers and writes an exact ordered
  entry list in the same transaction.

## RED/GREEN evidence

### RED script prepared

`/tmp/nested_folder_entries_red.sql` was created before the migration:

```sql
select * from public.folder_entries limit 1;
select public.move_folder('00000000-0000-0000-0000-000000000000', null, 0);
```

Command run before writing the migration:

```text
supabase db query --local --file /tmp/nested_folder_entries_red.sql
Connecting to local database...
failed to connect to postgres: failed to connect to `host=127.0.0.1 user=postgres database=postgres`: dial error (dial tcp 127.0.0.1:54322: connect: connection refused)
```

This environment has neither a running local Supabase Postgres instance nor a
Docker daemon, so the required pre-migration missing-relation failure could not
be observed. No production SQL was present before this attempt.

### GREEN/static verification

Commands run after adding the migration:

```text
git diff --check
exit 0 (no whitespace errors)

supabase db push --dry-run
Cannot find project ref. Have you run supabase link?
Try rerunning the command with --debug to troubleshoot the error.
```

`supabase db reset` cannot be used in this repository: there is no
`supabase/config.toml`, no linked project reference, no local Postgres/Docker,
and the portal's historical base migrations for `collections`, `folders`,
`folder_catalogs`, and `folder_sources` are not committed. The migration is
therefore deliberately idempotent and targets the deployed schema contract.

## Changed files

- `supabase/migrations/20260713_nested_folder_entries.sql`
- `.superpowers/sdd/task-1-report.md`

## Self-review

- `replace_folder_entries` validates all supplied IDs and collection/parent
  ownership before it deletes the previous sibling order, so an invalid payload
  leaves the old list untouched (and the function transaction provides a second
  rollback guarantee).
- `move_folder` and replacement both establish `folders.parent_folder_id`
  before inserting a folder entry, satisfying the trigger's structural
  consistency check.
- Reorder operations use a temporary offset before compacting, avoiding the
  unique `(parent_folder_id, sort_order)` constraint during an in-place shift.
- Backfill cannot create an entry for a root folder because the required schema
  has `folder_entries.parent_folder_id NOT NULL` and references `folders`; root
  folders are represented by `folders.parent_folder_id IS NULL` and retain
  `folders.sort_order` as specified by the schema itself.

## Concerns / follow-up verification

Run this migration against a disposable database cloned from the deployed
schema before deployment, then execute assertions for mixed ordering, self /
cycle / cross-collection rejection, and an invalid `replace_folder_entries`
payload preserving the old order. The supplied worktree cannot perform that
database verification because its base schema and Supabase project configuration
are absent.

## Review-fix addendum

The review found that direct SQL writes to `folders.parent_folder_id` or
`folders.collection_id` could bypass the `folder_entries` trigger, and that a
SQL `NULL` `p_entries` value could pass the prior JSON type check.

- Added `validate_folder_hierarchy_before_write`, a `BEFORE INSERT OR UPDATE OF
  parent_folder_id, collection_id` trigger on `folders`. It rejects a missing
  parent, self-parenting, parent/child cross-collection relationships, cycles,
  and a collection update that would leave an existing descendant in another
  collection.
- Changed `replace_folder_entries` to reject `p_entries IS NULL` before any
  parent/sibling lock or deletion.

### Review-fix verification

```text
git diff --check
exit 0 (no whitespace errors)
```

Database execution remains unavailable for the same reason documented above:
no running local Postgres/Docker, no linked project/configuration, and no
committed base schema to reset. The folder trigger is intentionally database
level rather than RPC-only, so direct `INSERT`/`UPDATE` writes are covered when
the migration is run against a disposable deployed-schema clone.
