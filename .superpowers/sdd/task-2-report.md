# Task 2: Publish hierarchy and ordered entries through the organizer

## Summary

The home organizer now fetches `folder_entries` in folder-ID batches and delegates serialization to a Deno-independent `buildOrganizerPayload` function. Folder records include `parentFolderId`, navigation-only folders are retained with `sources: []`, and each collection exposes an ordered `folderEntries` array. Legacy `sources` serialization is unchanged.

## RED evidence

1. Added `supabase/functions/home-organizer/organizer.test.ts` before the builder existed.
2. Initial `npm test -- organizer` could not run because this fresh worktree did not have `node_modules` (`sh: vitest: command not found`). Ran `npm ci` to install the lockfile dependencies; this did not modify tracked project files.
3. Re-ran `npm test -- organizer`; it failed as expected because `./organizer` did not exist:

   ```text
   Error: Failed to resolve import "./organizer" from "supabase/functions/home-organizer/organizer.test.ts". Does the file exist?
   ```

## GREEN evidence

Implemented the minimal pure serializer and wired the existing Deno handler to query rows and call it.

```text
$ npm test -- organizer
✓ supabase/functions/home-organizer/organizer.test.ts (4 tests)
Test Files  1 passed (1)
Tests  4 passed (4)
```

The tests cover:

- navigation-only folders and `parentFolderId`;
- mixed entry serialization in portal order;
- parent grouping before `sortOrder`;
- unchanged legacy `sources` shape.

Additional verification:

```text
$ npm run build
✓ built in 5.10s
```

`npm test` ran the new organizer tests and existing AuthContext tests successfully, but an unrelated existing `RouteGuards.test.tsx` suite fails because the test environment has no `VITE_SUPABASE_URL` and creates a real Supabase client.

## HTTP smoke test

Attempted the required local function smoke test:

```text
$ supabase functions serve home-organizer --no-verify-jwt
failed to inspect service: Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
Docker Desktop is a prerequisite for local development.
```

The Supabase CLI is installed (`2.98.1`), but Docker is not running, so the local edge runtime and curl verification could not be performed.

## Changed files

- `supabase/functions/home-organizer/index.ts`
- `supabase/functions/home-organizer/organizer.ts`
- `supabase/functions/home-organizer/organizer.test.ts`

## Self-review

- The entry-point change only adds batched `folder_entries` retrieval and delegates response construction; it does not change authorization, caching, or existing source query behavior.
- Sorting is explicit and deterministic: `parent_folder_id`, then `sort_order`.
- Legacy source serialization, including Trakt/TVDB/TMDB special cases, was moved without changing its output fields.
- Collections with folders remain emitted, and folders are no longer discarded merely because their legacy source list is empty.

## Concerns

- Local HTTP smoke testing remains blocked until Docker Desktop/the Docker daemon is available.
- The full portal suite has a pre-existing environment configuration failure in `RouteGuards.test.tsx`; Task 2's focused tests pass.

## Review follow-up: malformed folder entries

### RED evidence

Added a test with malformed rows interleaved between valid sibling entries: a non-string parent, unknown kind, missing reference, extra non-matching reference, and fractional sort order. The focused test failed before the implementation change:

```text
× buildOrganizerPayload > drops malformed entries without disturbing valid sibling order
expected [ [ 'folder', +0 ], …(6) ] to deeply equal [ [ 'folder', +0 ], …(2) ]
```

### Fix and GREEN evidence

`buildOrganizerPayload` now drops a row before sorting unless its parent is an emitted folder; kind is `folder`, `catalog`, or `source`; exactly its matching reference is present; the reference exists beneath that exact parent; and `sort_order` is a finite integer.

```text
$ npm test -- organizer
✓ supabase/functions/home-organizer/organizer.test.ts (5 tests)
Test Files  1 passed (1)
Tests  5 passed (5)

$ npm run build
✓ built in 1.65s
```
