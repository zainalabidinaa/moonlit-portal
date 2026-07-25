ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_ios_home BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_ios_movies BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_ios_series BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_mac_home BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_mac_movies BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_mac_series BOOLEAN NOT NULL DEFAULT false;

-- Seed home flags from the legacy column
UPDATE collections SET show_ios_home = show_on_home, show_mac_home = show_on_home;
