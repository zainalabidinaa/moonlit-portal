-- Personal collections: a NULL owner is a shared/admin-curated collection
-- (today's only kind, behavior unchanged). A non-null owner scopes the
-- collection — and everything under it — to one profile.
--
-- IDENTITY NOTE: profiles.id is a PROFILE id; auth.uid() is an AUTH USER id
-- matched by profiles.user_id. One auth user owns several profiles, so every
-- ownership check below joins through profiles.user_id = auth.uid().

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS collections_owner_profile_id_idx
  ON collections (owner_profile_id);

-- Links a catalog source back to the installed_addons row it was picked from,
-- so the UI can show the addon's name and validate the catalog still exists in
-- that addon's manifest. Nullable: pre-existing admin rows have no addon link.
-- ON DELETE SET NULL (not CASCADE) — removing an addon must not delete the
-- user's curated source rows, only orphan the "which addon" link.
ALTER TABLE folder_catalogs
  ADD COLUMN IF NOT EXISTS addon_id uuid REFERENCES installed_addons(id) ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- The old read policies were `auth.uid() IS NOT NULL`, i.e. every logged-in
-- user could read every row. That cannot stand once rows are personal.

DROP POLICY IF EXISTS "Authenticated users can read collections" ON collections;
CREATE POLICY "Read shared and own collections" ON collections
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      owner_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = collections.owner_profile_id AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Manage own personal collections" ON collections
  FOR ALL USING (
    owner_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = collections.owner_profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read folders" ON folders;
CREATE POLICY "Read shared and own folders" ON folders
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = folders.collection_id AND (
        c.owner_profile_id IS NULL
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = c.owner_profile_id AND p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Manage own personal folders" ON folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections c JOIN profiles p ON p.id = c.owner_profile_id
      WHERE c.id = folders.collection_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read folder_catalogs" ON folder_catalogs;
CREATE POLICY "Read shared and own folder_catalogs" ON folder_catalogs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f JOIN collections c ON c.id = f.collection_id
      WHERE f.id = folder_catalogs.folder_id AND (
        c.owner_profile_id IS NULL
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = c.owner_profile_id AND p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Manage own personal folder_catalogs" ON folder_catalogs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM folders f
      JOIN collections c ON c.id = f.collection_id
      JOIN profiles p ON p.id = c.owner_profile_id
      WHERE f.id = folder_catalogs.folder_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read folder_sources" ON folder_sources;
CREATE POLICY "Read shared and own folder_sources" ON folder_sources
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f JOIN collections c ON c.id = f.collection_id
      WHERE f.id = folder_sources.folder_id AND (
        c.owner_profile_id IS NULL
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = c.owner_profile_id AND p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Manage own personal folder_sources" ON folder_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM folders f
      JOIN collections c ON c.id = f.collection_id
      JOIN profiles p ON p.id = c.owner_profile_id
      WHERE f.id = folder_sources.folder_id AND p.user_id = auth.uid()
    )
  );
