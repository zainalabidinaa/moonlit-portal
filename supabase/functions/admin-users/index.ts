import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id);

    if (profileErr) throw profileErr;

    const isAdmin = (profiles ?? []).some((p: any) => p.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const idsParam = url.searchParams.get('ids');

      if (idsParam) {
        // Resolve specific user IDs to emails (used by invite codes page)
        const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
        let allAuthUsers: any[] = [];
        let page = 1;
        const perPage = 500;
        while (true) {
          const { data: pageData, error: pageErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (pageErr) throw pageErr;
          if (!pageData?.users?.length) break;
          allAuthUsers = allAuthUsers.concat(pageData.users);
          if (pageData.users.length < perPage) break;
          page++;
        }

        // Streams entitlement is the LIVE state on the profile, not the
        // includes_streams flag on whichever invite code was redeemed — the
        // admin can grant/revoke it directly, and old codes predate the
        // column entirely. The invite page needs the real answer, not a
        // frozen snapshot of what the code said the day it was made.
        const { data: matchedProfiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, stream_addons_enabled')
          .in('user_id', ids);
        const streamsMap = new Map((matchedProfiles ?? []).map((p: any) => [p.user_id, p.stream_addons_enabled]));

        const users = allAuthUsers
          .filter(u => ids.includes(u.id))
          .map(u => ({ id: u.id, email: u.email, stream_addons_enabled: streamsMap.get(u.id) ?? false }));

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List all auth users with their profile roles
      let allAuthUsers: any[] = [];
      let page = 1;
      const perPage = 500;
      while (true) {
        const { data: pageData, error: pageErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (pageErr) throw pageErr;
        if (!pageData?.users?.length) break;
        allAuthUsers = allAuthUsers.concat(pageData.users);
        if (pageData.users.length < perPage) break;
        page++;
      }

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, role, name, role_expires_at, stream_addons_enabled');
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const users = allAuthUsers.map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          user_id: u.id,
          email: u.email,
          name: p?.name ?? u.email?.split('@')[0] ?? null,
          role: p?.role ?? 'premium',
          role_expires_at: p?.role_expires_at ?? null,
          stream_addons_enabled: p?.stream_addons_enabled ?? false,
          created_at: u.created_at,
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PATCH') {
      const { userId, role, role_expires_at, stream_addons_enabled, runSetup } = await req.json();
      if (!userId || (!role && stream_addons_enabled === undefined && !runSetup)) {
        return new Response(JSON.stringify({ error: 'userId and (role, stream_addons_enabled, or runSetup) are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validRoles = ['admin', 'friends_family', 'premium', 'premium_plus', 'free', 'restricted'];
      if (role && !validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Role lives on `accounts` now, not `profiles` — the profiles sync
      // trigger (20260812_account_level_role.sql) fans this out to every
      // profile for the user automatically.
      if (role || role_expires_at !== undefined) {
        const accountFields: Record<string, any> = {};
        if (role) accountFields.role = role;
        if (role_expires_at !== undefined) {
          accountFields.role_expires_at = role_expires_at || null;
        }
        const { error: accountErr } = await supabaseAdmin
          .from('accounts')
          .upsert({ user_id: userId, ...accountFields }, { onConflict: 'user_id' });
        if (accountErr) throw accountErr;
      }

      const profileFields: Record<string, any> = {};
      if (stream_addons_enabled !== undefined) {
        profileFields.stream_addons_enabled = stream_addons_enabled;
      }

      // Update the first profile for this user, or insert if none exists
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .order('profile_index')
        .limit(1);

      let profileId: string | null = null;

      if (existing && existing.length > 0) {
        profileId = existing[0].id;
        if (Object.keys(profileFields).length > 0) {
          const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update(profileFields)
            .eq('id', profileId);

          if (updateErr) throw updateErr;
        }
      } else {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: userId,
            role: role ?? 'premium',
            name: 'User',
            profile_index: 0,
            ...profileFields,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        profileId = inserted?.id ?? null;
      }

      // Re-provision immediately when the streams grant changed, rather than
      // waiting for the next cron sync — the admin flipping this switch
      // should be reflected the next time that user's app loads addons.
      // `runSetup` triggers the same RPC on demand, independent of any flag
      // change, so an admin can force a re-provision without touching state.
      if ((stream_addons_enabled !== undefined || runSetup) && profileId) {
        const { error: rpcErr } = await supabaseAdmin.rpc('install_curated_setup', { p_profile_id: profileId });
        if (rpcErr) throw rpcErr;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      const { userId, confirmEmail } = await req.json();
      if (!userId || !confirmEmail) {
        return new Response(JSON.stringify({ error: 'userId and confirmEmail are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Never let the admin delete their own account through this path — the
      // portal's own account-deletion flow (with its own confirmation) exists
      // for that; this button is for OTHER users only.
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account here' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: targetAuthUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (getUserErr || !targetAuthUser?.user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // The confirmation must match the ACTUAL target email, checked server-side
      // — not just whatever the client claims. This is what makes "type the
      // email to confirm" a real guard instead of a UI-only speed bump: a
      // crafted request without the right email is rejected exactly like a
      // careless click would be.
      if (confirmEmail.trim().toLowerCase() !== (targetAuthUser.user.email ?? '').toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Email confirmation did not match' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: targetProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('user_id', userId);

      // Deleting the last admin account would lock everyone out of this page.
      if ((targetProfiles ?? []).some((p: any) => p.role === 'admin')) {
        return new Response(JSON.stringify({ error: 'Cannot delete an admin account from here' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete profile rows first. installed_addons, user_lists, list_items and
      // profile_recommendations all reference profiles(id) ON DELETE CASCADE, so
      // this takes their data with it before the auth user (and thus their
      // login) is removed.
      const profileIds = (targetProfiles ?? []).map((p: any) => p.id);
      if (profileIds.length > 0) {
        const { error: deleteProfilesErr } = await supabaseAdmin
          .from('profiles')
          .delete()
          .in('id', profileIds);
        if (deleteProfilesErr) throw deleteProfilesErr;
      }

      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthErr) throw deleteAuthErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
