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

    // Fetch all folders for those collections in one query
    const { data: allFolders, error: folderErr } = await supabase
      .from('folders')
      .select('*')
      .in('collection_id', collectionIds)
      .order('sort_order');

    if (folderErr) throw folderErr;
    const folders = allFolders ?? [];
    const folderIds = folders.map((f: any) => f.id);

    // Fetch all folder_catalogs in one query
    const { data: allCatalogs, error: catErr } = folderIds.length > 0
      ? await supabase.from('folder_catalogs').select('*').in('folder_id', folderIds)
      : { data: [], error: null };

    if (catErr) throw catErr;
    const catalogs = allCatalogs ?? [];

    // Build lookup maps
    const foldersByCollection: Record<string, any[]> = {};
    for (const f of folders) {
      if (!foldersByCollection[f.collection_id]) foldersByCollection[f.collection_id] = [];
      foldersByCollection[f.collection_id].push(f);
    }
    const catalogsByFolder: Record<string, any[]> = {};
    for (const c of catalogs) {
      if (!catalogsByFolder[c.folder_id]) catalogsByFolder[c.folder_id] = [];
      catalogsByFolder[c.folder_id].push(c);
    }

    // Serialize to Nuvio JSON format (what the iOS app's CollectionOrganizerParser expects)
    const output = collections
      .map((col: any) => {
        const colFolders = (foldersByCollection[col.id] ?? []).map((f: any) => {
          const folderCatalogs = catalogsByFolder[f.id] ?? [];
          const sources = folderCatalogs.map((cat: any) => ({
            type: cat.media_type,
            genre: cat.genre ?? 'None',
            addonId: 'aio-metadata',
            provider: 'addon',
            catalogId: cat.catalog_id,
          }));
          if (sources.length === 0) return null;
          return {
            id: f.id,
            title: f.name,
            sources,
            hideTitle: f.hide_title ?? false,
            tileShape: (f.tile_shape ?? 'poster').toUpperCase(),
            focusGifEnabled: f.focus_gif_enabled ?? false,
            heroBackdropUrl: f.hero_backdrop ?? null,
            coverImageUrl: f.cover_image ?? null,
            titleLogoUrl: f.title_logo ?? null,
            focusGifUrl: f.focus_gif ?? null,
            heroVideoUrl: f.hero_video_url ?? null,
          };
        }).filter(Boolean);

        if (colFolders.length === 0) return null;
        return {
          id: col.id,
          title: col.name,
          folders: colFolders,
          pinToTop: col.pin_to_top ?? false,
          viewMode: col.view_mode ?? 'FOLLOW_LAYOUT',
          showAllTab: col.show_all_tab ?? false,
          focusGlowEnabled: col.focus_glow_enabled ?? false,
          backdropImageUrl: col.backdrop_image ?? null,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(output), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
