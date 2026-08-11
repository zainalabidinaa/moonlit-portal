import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Re-applies the admin's curated addon set to EVERY non-admin profile, so all
 * accounts stay mirrored to whatever the admin currently curates.
 *
 * The work itself lives in the `sync_all_curated_setups()` SQL function (see
 * 20260811_curated_addons_auto_install.sql), which adds missing curated addons,
 * removes curated ones the admin dropped, and leaves the user's own additions
 * alone. New profiles are provisioned on insert by a trigger; this pass keeps
 * everyone in sync afterwards.
 *
 * Triggered every 2 days by the `curated-setup-sync` pg_cron job
 * (see 20260802130000_curated_setup_sync.sql). Runs with the service role, which
 * bypasses both the owner-only RLS on `installed_addons` and the deliberate lack
 * of an `authenticated` grant on `sync_all_curated_setups()`.
 *
 * Deploy with:
 *   supabase functions deploy curated-setup-sync
 */

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.rpc('sync_all_curated_setups');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = (data ?? []) as { profile_id: string; changed: number }[];
  return new Response(
    JSON.stringify({
      synced: results.length,
      changed: results.filter((r) => r.changed > 0).length,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
