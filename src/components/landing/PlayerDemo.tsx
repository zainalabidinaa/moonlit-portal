import { useEffect, useState } from 'react';

const badges = ['4K UHD', 'HDR10+', 'DOLBY VISION', 'HEVC', 'AV1', 'ATMOS', 'DTS-HD', 'REMUX'];

/**
 * A live-feeling player mockup: the scrubber sweeps (CSS), quality/codec badges
 * cycle their "active" highlight, and a now-playing equaliser pulses. Built in
 * code — no video, no screenshot — so it always matches the brand.
 */
export function PlayerDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % badges.length), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-black shadow-2xl">
      {/* video surface */}
      <div className="relative aspect-video">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 30% 20%, #4a2033, #0a0605 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 90% at 80% 90%, rgba(250,130,77,.25), transparent 60%)' }} />

        {/* center play glyph */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/30 backdrop-blur-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>

        {/* top: title + live badges */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div>
            <div className="font-display text-lg font-extrabold uppercase leading-none text-white">Midnight Reel</div>
            <div className="mt-1 font-mono text-[10px] text-white/60">Chapter 3 · The Long Drive</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-eq rounded-full bg-accent" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/70">Streaming</span>
          </div>
        </div>

        {/* bottom: scrubber + controls */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
            <div className="animate-scrub h-full rounded-full bg-accent" style={{ boxShadow: '0 0 12px var(--accent-glow)' }} />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-white/70">
            <div className="flex items-center gap-3">
              <span>▶</span>
              <span>1:24:07</span>
            </div>
            <div className="flex items-center gap-3">
              <span>CC</span>
              <span>1.0×</span>
              <span>⤢</span>
            </div>
          </div>
        </div>
      </div>

      {/* codec / quality strip */}
      <div className="flex flex-wrap gap-1.5 border-t border-border bg-bg2 p-3">
        {badges.map((b, i) => (
          <span
            key={b}
            className={`rounded-md border px-2 py-1 font-mono text-[9px] tracking-wide transition-colors duration-300 ${
              i === active
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-border bg-surface text-faint'
            }`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
