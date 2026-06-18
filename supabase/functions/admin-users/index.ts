import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
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
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, name, role')
          .in('user_id', ids);
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        const users = (authUsers?.users ?? [])
          .filter(u => ids.includes(u.id))
          .map(u => {
            const p = profileMap.get(u.id);
            return { id: u.id, email: u.email, name: p?.name };
          });

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List all auth users with their profile roles
      const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      if (authErr) throw authErr;

      const { data: profiles } = await supabaseAdmin.from('profiles').select('user_id, role, name');
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const users = authUsers.users.map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          user_id: u.id,
          email: u.email,
          name: p?.name ?? u.email?.split('@')[0] ?? null,
          role: p?.role ?? 'premium',
          created_at: u.created_at,
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PATCH') {
      const { userId, role } = await req.json();
      if (!userId || !role) {
        return new Response(JSON.stringify({ error: 'userId and role are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validRoles = ['admin', 'friends_family', 'premium', 'premium_plus'];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert profile with new role
      const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert({
        user_id: userId,
        role,
        name: 'User',
        profile_index: 0,
      }, { onConflict: 'user_id' });

      if (upsertErr) throw upsertErr;

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
