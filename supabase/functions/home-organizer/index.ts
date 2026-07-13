import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildOrganizerPayload } from './organizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch all enabled collections ordered by sort_order
    const { data: collections, error: colErr } = await supabase
      .from('collections')
      .select('*')
      .eq('enabled', true)
      .order('sort_order');

    if (colErr) throw colErr;
    if (!collections || collections.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      });
    }

    const collectionIds = collections.map((c: any) => c.id);

    // Fetch all folders for those collections in batches
    let allFolders: any[] = [];
    if (collectionIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < collectionIds.length; i += batchSize) {
        const batch = collectionIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('folders')
          .select('*')
          .in('collection_id', batch)
          .eq('enabled', true)
          .order('sort_order');
        if (error) throw error;
        if (data) allFolders.push(...data);
      }
    }
    const folders = allFolders;
    const folderIds = folders.map((f: any) => f.id);

    // Fetch all folder_catalogs in batches to avoid URL length limits
    let allCatalogs: any[] = [];
    if (folderIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < folderIds.length; i += batchSize) {
        const batch = folderIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('folder_catalogs')
          .select('*')
          .in('folder_id', batch);
        if (error) throw error;
        if (data) allCatalogs.push(...data);
      }
    }
    const catalogs = allCatalogs;

    // Fetch all folder_sources in batches
    let allSources: any[] = [];
    if (folderIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < folderIds.length; i += batchSize) {
        const batch = folderIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('folder_sources')
          .select('*')
          .in('folder_id', batch)
          .order('sort_order');
        if (error) throw error;
        if (data) allSources.push(...data);
      }
    }
    const folderSources = allSources;

    // Fetch all folder_entries in batches so clients can render the portal's mixed ordering.
    let allEntries: any[] = [];
    if (folderIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < folderIds.length; i += batchSize) {
        const batch = folderIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('folder_entries')
          .select('*')
          .in('parent_folder_id', batch);
        if (error) throw error;
        if (data) allEntries.push(...data);
      }
    }

    const output = buildOrganizerPayload({
      collections,
      folders,
      catalogs,
      folderSources,
      folderEntries: allEntries,
    });

    return new Response(JSON.stringify(output), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
