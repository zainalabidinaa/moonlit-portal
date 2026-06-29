import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = 'https://hvfsntdyowapjxobtyli.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZnNudGR5b3dhcGp4b2J0eWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3ODQ5NSwiZXhwIjoyMDk1NzU0NDk1fQ.sB0HwWmcM8c5JQoqNnjvWoM0_Yd7IkXeNcweaGq-CuU';
const FRAN_COL = '3b7e79f5-c885-45b5-ad96-dceff010c0c2';
const BUCKET = 'genre-covers';
const SKIP = new Set(['batman']); // symbol logos, not text

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function compositeLogoOnBackdrop(backdropBuf, logoBuf) {
  const W = 1280, H = 720;

  // Resize backdrop to 1280×720
  const base = await sharp(backdropBuf)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // Get logo metadata to calculate proportional size
  const logoMeta = await sharp(logoBuf).metadata();
  const maxLogoW = Math.round(W * 0.55);
  const maxLogoH = Math.round(H * 0.38);
  const scale = Math.min(maxLogoW / logoMeta.width, maxLogoH / logoMeta.height, 1);
  const logoW = Math.round(logoMeta.width * scale);
  const logoH = Math.round(logoMeta.height * scale);

  // Resize logo (keep alpha)
  const logoResized = await sharp(logoBuf)
    .resize(logoW, logoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Dark gradient overlay so logo pops
  const gradient = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

  // Position logo: horizontally centred, vertically centred
  const left = Math.round((W - logoW) / 2);
  const top = Math.round((H - logoH) / 2);

  return sharp(base)
    .composite([
      // subtle darkening vignette
      {
        input: Buffer.from(
          `<svg width="${W}" height="${H}">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stop-color="black" stop-opacity="0"/>
                <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
              </radialGradient>
            </defs>
            <rect width="${W}" height="${H}" fill="url(#g)"/>
          </svg>`
        ),
        blend: 'over',
      },
      // logo centred
      { input: logoResized, left, top, blend: 'over' },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const { data: folders } = await sb
    .from('folders')
    .select('id, name, cover_image, title_logo')
    .eq('collection_id', FRAN_COL)
    .not('title_logo', 'is', null)
    .not('cover_image', 'is', null)
    .order('name');

  console.log(`Processing ${folders?.length ?? 0} folders with logos\n`);

  const failed = [];

  for (const f of folders ?? []) {
    if (SKIP.has(f.name.toLowerCase())) {
      console.log(`⊘ skip  ${f.name}`);
      continue;
    }

    try {
      const [backdropBuf, logoBuf] = await Promise.all([
        fetchBuf(f.cover_image),
        fetchBuf(f.title_logo),
      ]);

      const composite = await compositeLogoOnBackdrop(backdropBuf, logoBuf);

      const storagePath = `franchise-covers/${f.id}.jpg`;

      // Upsert into storage
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, composite, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (upErr) throw new Error(upErr.message);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

      await sb.from('folders').update({ cover_image: publicUrl }).eq('id', f.id);

      console.log(`✓ ${f.name}`);
    } catch (e) {
      console.log(`✗ ${f.name}: ${e.message}`);
      failed.push(f.name);
    }
  }

  console.log('\nDone.');
  if (failed.length) {
    console.log(`\nFailed (${failed.length}):`);
    failed.forEach(n => console.log(' ', n));
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
