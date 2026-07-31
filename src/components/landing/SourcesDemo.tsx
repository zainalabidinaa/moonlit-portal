const sources = [
  { q: '4K', t: 'Midnight.Reel.2026.2160p.UHD.BluRay.REMUX.DV.Atmos', s: '54.2 GB · DV · TrueHD 7.1', top: true },
  { q: '4K', t: 'Midnight.Reel.2026.2160p.WEB-DL.DDP5.1.Atmos.HEVC', s: '21.8 GB · HEVC · DV' },
  { q: '1080p', t: 'Midnight.Reel.2026.1080p.BluRay.x264.DTS-HD.MA.5.1', s: '14.1 GB · x264 · DTS-HD' },
  { q: '720p', t: 'Midnight.Reel.2026.720p.WEBRip.AAC2.0.x264', s: '2.9 GB · x264 · AAC' },
];

/**
 * Ranked-sources mockup: a sheen sweeps across the list ("scanning"), the top
 * pick is highlighted and auto-selected. In-code, no live torrent data.
 */
export function SourcesDemo() {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border-strong bg-bg2 p-3 md:p-4 shadow-2xl">
      {/* scan sheen */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sheen"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(250,130,77,.10),transparent)' }} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">Sources · ranked</span>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9px] text-accent">
          Best pick auto-selected
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {sources.map((src) => (
          <div
            key={src.t}
            className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 sm:gap-3 sm:px-3 ${
              src.top ? 'border-accent/50 bg-accent/[0.07]' : 'border-border bg-surface'
            }`}
          >
            <span
              className={`flex-none rounded-md px-2 py-1 font-mono text-[9px] font-bold ${
                src.top ? 'bg-accent text-[#2a1206]' : 'bg-bg text-faint'
              }`}
            >
              {src.q}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[10px] text-text sm:text-[11px]">{src.t}</div>
              <div className="truncate font-mono text-[9px] text-faint">{src.s}</div>
            </div>
            {src.top && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 font-mono text-[9px] leading-relaxed text-faint">
        <span className="flex-none text-accent">●</span>
        <span className="min-w-0">Cam rips, dead links &amp; wrong episodes filtered before ranking</span>
      </div>
    </div>
  );
}
