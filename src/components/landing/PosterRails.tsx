export interface RailPoster {
  key: string;
  src: string;
  title: string;
  sub?: string;
}

function Poster({ p }: { p: RailPoster }) {
  return (
    <div className="group relative aspect-[2/3] w-32 flex-none overflow-hidden rounded-[10px] bg-surface-2 shadow-[0_10px_30px_-14px_rgba(0,0,0,.9)] transition-[transform,box-shadow] duration-500 ease-out hover:z-10 hover:-translate-y-2 hover:scale-[1.04] hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,.12)] md:w-40">
      <img src={p.src} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 translate-y-1.5 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2.5 pt-7 text-xs font-semibold opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        {p.title}
        {p.sub && <span className="mt-0.5 block text-[11px] font-medium text-muted">{p.sub}</span>}
      </div>
    </div>
  );
}

function Rail({ posters, reverse }: { posters: RailPoster[]; reverse?: boolean }) {
  if (posters.length === 0) return null;
  // Duplicate so the -50% drift loops seamlessly.
  const row = [...posters, ...posters];
  return (
    <div className={`flex w-max gap-3.5 py-2 ${reverse ? 'animate-drift-rev' : 'animate-drift'}`}>
      {row.map((p, i) => <Poster key={`${p.key}-${i}`} p={p} />)}
    </div>
  );
}

/**
 * Two rows of poster art drifting in opposite directions. Pauses on hover.
 * Fed by whatever artwork the page has: trending posters and folder covers.
 */
export function PosterRails({ posters, caption }: { posters: RailPoster[]; caption?: string }) {
  if (posters.length < 4) return null;
  const half = Math.ceil(posters.length / 2);
  const a = posters.slice(0, half);
  const b = posters.slice(half);
  return (
    <div className="rails overflow-hidden pt-16" aria-label="Titles available on Moonlit">
      <Rail posters={a} />
      <Rail posters={b.length >= 4 ? b : a} reverse />
      {caption && <p className="mx-auto mt-7 max-w-[1240px] px-5 text-center text-[13px] text-faint">{caption}</p>}
    </div>
  );
}
