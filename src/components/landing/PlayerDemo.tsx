import { useEffect, useState } from 'react';

const badges = ['4K UHD', 'DOLBY VISION', 'HDR10+', 'HEVC', 'AV1', 'ATMOS', 'TRUEHD', 'DTS-HD', 'REMUX'];
const lit = new Set(['4K UHD', 'DOLBY VISION', 'HEVC', 'ATMOS']);

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h ? h + ':' : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}

interface PlayerDemoProps {
  /** Still used as the video surface. Falls back to a graded gradient. */
  backdrop?: string | null;
  title?: string;
  subtitle?: string;
}

/**
 * A live-feeling player: the still zooms slowly, the scrubber creeps, the
 * clock ticks, the active codec chips catch a light sweep. No video.
 */
export function PlayerDemo({ backdrop, title = 'Tonight on Moonlit', subtitle = 'Direct play · no transcoding' }: PlayerDemoProps) {
  const [secs, setSecs] = useState(51 * 60 + 42);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden bg-black">
        {backdrop ? (
          <img src={backdrop} alt="" className="animate-slowzoom absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 30% 20%, #3a2030, #0a0605 70%), radial-gradient(90% 90% at 85% 90%, rgba(255,140,80,.28), transparent 60%)' }} />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.85),transparent_45%),linear-gradient(180deg,rgba(0,0,0,.5),transparent_35%)]" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 md:p-5">
          <div>
            <strong className="block text-lg font-semibold tracking-tight text-white">{title}</strong>
            <small className="text-[12.5px] text-white/65">{subtitle}</small>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[.08em] text-white backdrop-blur">
            <i className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_#ff7a3d]" />
            4K Dolby Vision
          </span>
        </div>

        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-[68px] w-[68px] place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md transition-transform duration-300 hover:scale-105">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          <div className="relative h-1 rounded-full bg-white/20">
            <i className="animate-scrub absolute inset-y-0 left-0 rounded-full bg-white after:absolute after:-right-1.5 after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:rounded-full after:bg-white after:shadow-[0_0_0_4px_rgba(255,255,255,.2)]" />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11.5px] text-white/80">
            <div className="flex items-center gap-4"><span>▶</span><span>{fmt(secs)}</span><span>/ 2:46:08</span></div>
            <div className="flex items-center gap-4"><span>CC</span><span>Atmos 7.1</span><span>⤢</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 pb-5 pt-3.5">
        {badges.map((b) => (
          <span
            key={b}
            className={`relative overflow-hidden rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[.06em] ${
              lit.has(b) ? 'border-accent/45 bg-accent-light text-accent' : 'border-border bg-bg2 text-muted'
            }`}
          >
            {b}
            {lit.has(b) && (
              <i className="animate-sheen absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,.18)_50%,transparent_70%)]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
