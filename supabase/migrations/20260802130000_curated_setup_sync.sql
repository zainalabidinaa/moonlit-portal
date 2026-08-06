-- Keeps a profile's curated addon set in sync with whatever the admin
-- currently curates, after the user has explicitly opted in via "Install
-- curated setup" in the portal (see AddonsPage.tsx). Nothing changes
-- automatically before that tap; this only re-applies the same install for
-- profiles that already asked for it once.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS curated_setup_installed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS curated_setup_synced_at TIMESTAMPTZ;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store the service-role key once via the Supabase dashboard (SQL editor):
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- The cron job below reads it from Vault rather than embedding it in the
-- migration, so the key never lands in git history.
SELECT cron.schedule(
  'curated-setup-sync',
  '0 6 */2 * *', -- every 2 days at 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://hvfsntdyowapjxobtyli.supabase.co/functions/v1/curated-setup-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
  $$
);
