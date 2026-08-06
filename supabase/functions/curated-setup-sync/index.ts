import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Re-applies "Install curated setup" for every profile that has already
 * opted in once (`profiles.curated_setup_installed = true`), so Friends &
 * Family / Premium accounts stay in sync with whatever the admin currently
 * curates instead of drifting after their one-time install.
 *
 * Triggered every 2 days by the `curated-setup-sync` pg_cron job
 * (see 20260802130000_curated_setup_sync.sql). Runs with the service role,
 * so it can read/write `installed_addons` across profiles despite the
 * owner-only RLS that scopes normal client access to one's own rows.
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

  const { data: sharedAddons, error: sharedErr } = await supabase.rpc('get_shared_addons');
  if (sharedErr) {
    return new Response(JSON.stringify({ error: sharedErr.message }), { status: 500 });
  }
  const curatedUrls: string[] = (sharedAddons ?? []).map((r: { addon_url: string }) => r.addon_url);

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('curated_setup_installed', true);
  if (profilesErr) {
    return new Response(JSON.stringify({ error: profilesErr.message }), { status: 500 });
  }

  const results: { profileId: string; added: number }[] = [];

  for (const profile of profiles ?? []) {
    const { data: own } = await supabase
      .from('installed_addons')
      .select('addon_url')
      .eq('profile_id', profile.id);
    const existing = new Set((own ?? []).map((a: { addon_url: string }) => a.addon_url));

    const missing = curatedUrls.filter((u) => !existing.has(u));
    if (missing.length > 0) {
      const rows = missing.map((addon_url, i) => ({
        profile_id: profile.id,
        addon_url,
        enabled: true,
        sort_order: existing.size + i,
      }));
      await supabase.from('installed_addons').insert(rows);
    }

    await supabase
      .from('profiles')
      .update({ curated_setup_synced_at: new Date().toISOString() })
      .eq('id', profile.id);

    results.push({ profileId: profile.id, added: missing.length });
  }

  return new Response(JSON.stringify({ synced: results.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
