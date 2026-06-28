import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';

const SAMPLE = `{
  "pack": { "title": "B.E.S.T", "image_url": "https://…/cover.gif" },
  "collections": [
    { "name": "B.E.S.T", "view_mode": "FOLLOW_LAYOUT", "backdrop_image": "https://…/playlists.jpg" }
  ],
  "folders": [
    { "name": "Trending Shows", "cover_image": "https://…/cover.jpg",
      "hero_backdrop": "https://…/hero.jpg", "focus_gif": "https://…/focus.gif",
      "title_logo": "https://…/logo.png", "tile_shape": "POSTER", "hide_title": true }
  ],
  "folder_catalogs": [
    { "folder": "Trending Shows", "provider": "tmdb.top", "tmdb_id": "100088", "media_type": "series" }
  ]
}`;

const IMAGE_KEY = /(image|logo|backdrop|cover|gif|poster|art|icon)/i;

interface ImageEntry { path: string; url: string }

/** Recursively collect every image-ish URL in the parsed pack. */
function collectImages(obj: unknown, path = '', out: ImageEntry[] = []): ImageEntry[] {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectImages(v, `${path}[${i}]`, out));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const next = path ? `${path}.${k}` : k;
      if (typeof v === 'string' && IMAGE_KEY.test(k) && /^https?:\/\//.test(v)) {
        out.push({ path: next, url: v });
      } else {
        collectImages(v, next, out);
      }
    }
  }
  return out;
}

interface Props {
  onImport: (pack: Record<string, unknown>, discoverMap?: Map<string, string>) => Promise<{ collections: number; folders: number; sources: number; skipped: number }>;
}

/** Build title→catalogId map from an AIOMetadata config JSON */
function buildDiscoverMap(aioRaw: string): Map<string, string> | null {
  try {
    const cfg = JSON.parse(aioRaw);
    const catalogs: any[] = cfg?.config?.catalogs ?? cfg?.catalogs ?? [];
    const map = new Map<string, string>();
    for (const c of catalogs) {
      if (typeof c.id === 'string' && c.id.startsWith('tmdb.discover.') && typeof c.name === 'string') {
        map.set(c.name.toLowerCase(), c.id);
      }
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

export function JsonImport({ onImport }: Props) {
  const [raw, setRaw] = useState(SAMPLE);
  const [aioRaw, setAioRaw] = useState('');
  const [showAio, setShowAio] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(raw) as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [raw]);

  const discoverMap = useMemo(() => aioRaw.trim() ? buildDiscoverMap(aioRaw) : null, [aioRaw]);
  const images = parsed.ok ? collectImages(parsed.value) : [];

  async function handleImport() {
    if (!parsed.ok) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await onImport(parsed.value, discoverMap ?? undefined);
      setResult(
        `Imported ${r.collections} collection(s), ${r.folders} folder(s), ${r.sources} source(s).` +
        (r.skipped > 0 ? ` ${r.skipped} sources skipped (no catalog ID).` : '')
      );
    } catch (e) {
      setResult(`Import failed: ${(e as Error).message}`);
    }
    setImporting(false);
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Paste a pack like <span className="font-mono text-accent">BEST-restructured.json</span> — every image is previewed before import.
        </p>
        <Button size="sm" loading={importing} disabled={!parsed.ok} onClick={handleImport}>Import &amp; sync →</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative">
          <textarea
            value={raw}
            spellCheck={false}
            onChange={(e) => setRaw(e.target.value)}
            className="h-[440px] w-full resize-y rounded-2xl border border-border bg-bg p-4 font-mono text-[11.5px] leading-relaxed text-[#f3c9a8] outline-none focus:border-accent"
          />
          {!parsed.ok && (
            <p className="mt-2 font-mono text-[11px] text-red-400">JSON error: {parsed.error}</p>
          )}
          {result && <p className="mt-2 font-mono text-[11px] text-accent">{result}</p>}

          {/* AIOMetadata config (optional) */}
          <div className="mt-3">
            <button
              onClick={() => setShowAio((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-text"
            >
              <span>{showAio ? '▼' : '▶'}</span>
              AIOMetadata config <span className="text-faint">(optional — resolves TMDB Discover catalog IDs)</span>
              {discoverMap && <span className="ml-1 rounded-full bg-accent/20 px-2 py-0.5 text-[9px] text-accent">{discoverMap.size} catalogs loaded</span>}
            </button>
            {showAio && (
              <textarea
                value={aioRaw}
                spellCheck={false}
                onChange={(e) => setAioRaw(e.target.value)}
                placeholder="Paste your aiometadata-config.json here…"
                className="mt-2 h-[160px] w-full resize-y rounded-2xl border border-border bg-bg p-4 font-mono text-[11px] leading-relaxed text-muted outline-none focus:border-accent"
              />
            )}
            {showAio && aioRaw.trim() && !discoverMap && (
              <p className="mt-1 font-mono text-[11px] text-red-400">Could not parse AIOMetadata config — check the JSON.</p>
            )}
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-border bg-bg2 p-4">
          <h4 className="mb-3.5 font-mono text-[11px] uppercase tracking-wide text-muted">
            Image manifest · {images.length} found
          </h4>
          {images.length === 0 ? (
            <p className="font-mono text-[11px] text-faint">No image URLs detected.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {images.map((img) => (
                <div key={img.path} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2">
                  <img src={img.url} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <b className="block text-xs">{img.path}</b>
                    <small className="block truncate font-mono text-[9px] text-faint">{img.url}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
