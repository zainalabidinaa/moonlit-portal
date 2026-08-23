-- Personal collections: a NULL owner is a shared/admin-curated collection
-- (today's only kind, behavior unchanged). A non-null owner scopes the
-- collection — and everything under it — to one profile.
--
-- IDENTITY NOTE: profiles.id is a PROFILE id; auth.uid() is an AUTH USER id
-- matched by profiles.user_id. One auth user owns several profiles, so every
-- ownership check below joins through profiles.user_id = auth.uid().

-- ── RLS enabled (belt-and-braces; already on in production) ─────────────

ALTER TABLE collections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_sources  ENABLE ROW LEVEL SECURITY;

-- ── Columns ──────────────────────────────────────────────────────────────

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Links a catalog source back to the installed_addons row it was picked from,
-- so the UI can show the addon's name and validate the catalog still exists in
-- that addon's manifest. Nullable: pre-existing admin rows have no addon link.
-- ON DELETE SET NULL (not CASCADE) — removing an addon must not delete the
-- user's curated source rows, only orphan the "which addon" link.
ALTER TABLE folder_catalogs
  ADD COLUMN IF NOT EXISTS addon_id uuid REFERENCES installed_addons(id) ON DELETE SET NULL;

-- ── Ownership helpers ────────────────────────────────────────────────────
-- SECURITY DEFINER, not inline subqueries: a subquery on `collections` inside
-- a `collections` policy raises 42P17 infinite recursion detected in policy.
-- These also fix a performance problem — auth.uid() evaluated once per call
-- instead of per row, and no nested RLS re-evaluation on every check.

CREATE OR REPLACE FUNCTION public.owns_profile(p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p
                 WHERE p.id = p_profile_id AND p.user_id = (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.owns_collection(p_collection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM collections c JOIN profiles p ON p.id = c.owner_profile_id
                 WHERE c.id = p_collection_id AND p.user_id = (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.owns_folder(p_folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM folders f JOIN collections c ON c.id = f.collection_id
                 JOIN profiles p ON p.id = c.owner_profile_id
                 WHERE f.id = p_folder_id AND p.user_id = (SELECT auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.owns_profile(uuid), public.owns_collection(uuid),
                       public.owns_folder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_profile(uuid), public.owns_collection(uuid),
                          public.owns_folder(uuid) TO authenticated;

-- ── Ownership inheritance trigger ───────────────────────────────────────
-- A nested sub-collection is judged only by its OWN owner_profile_id; if any
-- path creates a child under a personal collection without setting it, that
-- child and its whole subtree become world-readable. Force inheritance from
-- the parent collection/folder on insert or reparent.

CREATE OR REPLACE FUNCTION public.collections_inherit_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_collection_id IS NOT NULL THEN
    SELECT owner_profile_id INTO NEW.owner_profile_id
    FROM collections WHERE id = NEW.parent_collection_id;
  ELSIF NEW.parent_folder_id IS NOT NULL THEN
    SELECT c.owner_profile_id INTO NEW.owner_profile_id
    FROM folders f JOIN collections c ON c.id = f.collection_id
    WHERE f.id = NEW.parent_folder_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS collections_inherit_owner_trg ON collections;
CREATE TRIGGER collections_inherit_owner_trg
  BEFORE INSERT OR UPDATE OF parent_collection_id, parent_folder_id, owner_profile_id
  ON collections FOR EACH ROW EXECUTE FUNCTION public.collections_inherit_owner();

-- ── RLS policies ─────────────────────────────────────────────────────────
-- The old read policies were `auth.uid() IS NOT NULL`, i.e. every logged-in
-- user could read every row. That cannot stand once rows are personal.
-- Every CREATE POLICY is preceded by its own DROP POLICY IF EXISTS so a
-- partial re-apply of this migration can't fail with 42710 policy already
-- exists and leave tables half-tightened.

DROP POLICY IF EXISTS "Authenticated users can read collections" ON collections;
DROP POLICY IF EXISTS "Read shared and own collections" ON collections;
CREATE POLICY "Read shared and own collections" ON collections
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      owner_profile_id IS NULL
      OR public.owns_profile(owner_profile_id)
    )
  );

DROP POLICY IF EXISTS "Manage own personal collections" ON collections;
CREATE POLICY "Manage own personal collections" ON collections
  FOR ALL TO authenticated
  USING (owner_profile_id IS NOT NULL AND public.owns_profile(owner_profile_id))
  WITH CHECK (
    owner_profile_id IS NOT NULL
    AND public.owns_profile(owner_profile_id)
    AND (parent_collection_id IS NULL OR public.owns_collection(parent_collection_id))
    AND (parent_folder_id     IS NULL OR public.owns_folder(parent_folder_id))
  );

DROP POLICY IF EXISTS "Authenticated users can read folders" ON folders;
DROP POLICY IF EXISTS "Read shared and own folders" ON folders;
CREATE POLICY "Read shared and own folders" ON folders
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = folders.collection_id AND (
        c.owner_profile_id IS NULL
        OR public.owns_profile(c.owner_profile_id)
      )
    )
  );

DROP POLICY IF EXISTS "Manage own personal folders" ON folders;
CREATE POLICY "Manage own personal folders" ON folders
  FOR ALL TO authenticated
  USING (public.owns_collection(collection_id))
  WITH CHECK (
    public.owns_collection(collection_id)
    AND (parent_folder_id IS NULL OR public.owns_folder(parent_folder_id))
  );

DROP POLICY IF EXISTS "Authenticated users can read folder_catalogs" ON folder_catalogs;
DROP POLICY IF EXISTS "Read shared and own folder_catalogs" ON folder_catalogs;
CREATE POLICY "Read shared and own folder_catalogs" ON folder_catalogs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f JOIN collections c ON c.id = f.collection_id
      WHERE f.id = folder_catalogs.folder_id AND (
        c.owner_profile_id IS NULL
        OR public.owns_profile(c.owner_profile_id)
      )
    )
  );

DROP POLICY IF EXISTS "Manage own personal folder_catalogs" ON folder_catalogs;
CREATE POLICY "Manage own personal folder_catalogs" ON folder_catalogs
  FOR ALL TO authenticated
  USING (public.owns_folder(folder_id))
  WITH CHECK (
    public.owns_folder(folder_id)
    AND (addon_id IS NULL OR EXISTS (
      SELECT 1 FROM installed_addons ia
      WHERE ia.id = addon_id AND public.owns_profile(ia.profile_id)
    ))
  );

DROP POLICY IF EXISTS "Authenticated users can read folder_sources" ON folder_sources;
DROP POLICY IF EXISTS "Read shared and own folder_sources" ON folder_sources;
CREATE POLICY "Read shared and own folder_sources" ON folder_sources
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f JOIN collections c ON c.id = f.collection_id
      WHERE f.id = folder_sources.folder_id AND (
        c.owner_profile_id IS NULL
        OR public.owns_profile(c.owner_profile_id)
      )
    )
  );

DROP POLICY IF EXISTS "Manage own personal folder_sources" ON folder_sources;
CREATE POLICY "Manage own personal folder_sources" ON folder_sources
  FOR ALL TO authenticated
  USING (public.owns_folder(folder_id))
  WITH CHECK (public.owns_folder(folder_id));

-- ── Indexes ──────────────────────────────────────────────────────────────
-- Postgres does not auto-index foreign keys; without these the new policies
-- seq-scan, and e.g. DELETE FROM installed_addons seq-scans folder_catalogs.

CREATE INDEX IF NOT EXISTS collections_owner_profile_id_idx ON collections (owner_profile_id);
CREATE INDEX IF NOT EXISTS folders_collection_id_idx        ON folders (collection_id);
CREATE INDEX IF NOT EXISTS folder_catalogs_folder_id_idx    ON folder_catalogs (folder_id);
CREATE INDEX IF NOT EXISTS folder_sources_folder_id_idx     ON folder_sources (folder_id);
CREATE INDEX IF NOT EXISTS folder_catalogs_addon_id_idx     ON folder_catalogs (addon_id);
CREATE INDEX IF NOT EXISTS profiles_user_id_idx             ON profiles (user_id);
