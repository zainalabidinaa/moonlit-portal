-- Per-role visibility for the app's own navigation tabs (Home/Search/Library/
-- Live TV/Settings) — distinct from `show_ios_home`-style columns on
-- `collections`, which control which *catalog* tab a collection surfaces
-- under, not which nav tabs exist at all.
CREATE TABLE IF NOT EXISTS role_tab_visibility (
  role     TEXT NOT NULL,
  tab_key  TEXT NOT NULL,
  visible  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role, tab_key)
);

ALTER TABLE role_tab_visibility ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read the visibility grid (they only need their
-- own role's rows, but the table is small and non-sensitive); only admins
-- can change it.
CREATE POLICY "role_tab_visibility_read" ON role_tab_visibility
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "role_tab_visibility_admin_write" ON role_tab_visibility
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Seed every known tab visible for every role; admin is always visible and
-- is enforced client-side regardless of what's stored here.
INSERT INTO role_tab_visibility (role, tab_key, visible)
SELECT r.role, t.tab_key, true
FROM (VALUES ('admin'), ('premium'), ('friends_family'), ('free')) AS r(role)
CROSS JOIN (VALUES ('home'), ('search'), ('library'), ('live_tv'), ('settings')) AS t(tab_key)
ON CONFLICT (role, tab_key) DO NOTHING;
