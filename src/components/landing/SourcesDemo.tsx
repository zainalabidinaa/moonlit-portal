const sources = [
  { q: '4K', t: '2160p REMUX · Dolby Vision · TrueHD 7.1', s: '54.2 GB · 312 seeds', state: 'Playing', top: true },
  { q: '4K', t: '2160p WEB-DL · HEVC · DDP 5.1', s: '21.8 GB · 190 seeds', state: 'Ready' },
  { q: '1080p', t: '1080p BluRay · x264 · DTS-HD', s: '14.1 GB · 84 seeds', state: 'Ready' },
  { q: 'CAM', t: 'HDCAM.x264.AAC', s: 'Filtered: cam rip', state: 'Hidden', dim: true },
];

/** Ranked-sources mockup: junk filtered, top pick selected. No live data. */
export function SourcesDemo() {
  return (
    <div className="grid gap-2 px-4 pb-5 md:px-[18px]">
      {sources.map((src) => (
        <div
          key={src.t}
          className={`grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] border px-3 py-2.5 ${
            src.top ? 'border-accent/50 bg-accent-light' : 'border-border bg-bg2'
          } ${src.dim ? 'opacity-40' : ''}`}
        >
          <span className={`rounded-md px-2 py-1 font-mono text-[11px] ${src.top ? 'bg-accent font-medium text-[#1a0b04]' : 'bg-surface-2 text-muted'}`}>
            {src.q}
          </span>
          <div className="min-w-0">
            <b className={`block truncate text-[13px] font-semibold ${src.dim ? 'line-through' : ''}`}>{src.t}</b>
            <small className="block truncate text-[11.5px] text-faint">{src.s}</small>
          </div>
          <span className={`text-[11.5px] font-medium ${src.top ? 'text-accent' : 'text-faint'}`}>{src.state}</span>
        </div>
      ))}
    </div>
  );
}
