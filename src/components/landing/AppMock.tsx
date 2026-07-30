import type { ReactNode } from 'react';

/**
 * A fully in-code mockup of the Moonlit streaming UI. Mirrors the real app:
 * a floating glass pill navbar centred over a full-bleed cinematic hero, then
 * poster rows. No screenshots — every tile is a warm gradient so it stays crisp
 * at any size and always matches the brand.
 */

const posterGradients = [
  'linear-gradient(160deg,#3a2418,#1a0f09)',
  'linear-gradient(160deg,#5a2d16,#241009)',
  'linear-gradient(160deg,#2c3340,#12161c)',
  'linear-gradient(160deg,#4a2033,#1c0d15)',
  'linear-gradient(160deg,#fa824d,#7a2f14)',
  'linear-gradient(160deg,#2f3d2a,#141a10)',
  'linear-gradient(160deg,#463019,#1e140a)',
  'linear-gradient(160deg,#3d2440,#170d18)',
];

function Poster({ i, className = '' }: { i: number; className?: string }) {
  return (
    <div
      className={`aspect-[2/3] flex-none rounded-md ${className}`}
      style={{
        background: posterGradients[i % posterGradients.length],
        boxShadow: 'inset 0 -30px 40px -20px rgba(0,0,0,.6)',
      }}
    />
  );
}

/* — nav glyphs, echoing the app's SF Symbols — */
const HouseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
    <path d="M12 3 2 12h3v9h6v-6h2v6h6v-9h3L12 3Z" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
    <path d="M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2V4Zm2 15h11v-2H6a1 1 0 0 0 0 2Z" />
  </svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4a8.9 8.9 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a9 9 0 0 0-3-1.8L15 2H9l-.4 2.4a9 9 0 0 0-3 1.8l-2.4-1-2 3.4 2 1.6a9 9 0 0 0 0 3.6l-2 1.6 2 3.4 2.4-1a9 9 0 0 0 3 1.8L9 22h6l.4-2.4a9 9 0 0 0 3-1.8l2.4 1 2-3.4-2-1.6c.13-.59.2-1.19.2-1.8Z" />
  </svg>
);

function NavPill({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-medium ${
        active ? 'text-white' : 'text-white/50'
      }`}
      style={
        active
          ? { background: 'rgba(250,130,77,.9)', boxShadow: '0 0 12px rgba(250,130,77,.45)' }
          : undefined
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

export function AppMock() {
  return (
    <div className="relative h-full min-h-[300px] overflow-hidden bg-bg text-left">
      {/* cinematic hero — full bleed, no sidebar */}
      <div className="relative h-[52%] min-h-[172px] overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg,#5a2d16,#241009 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(110% 100% at 82% 8%, rgba(250,130,77,.38), transparent 55%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg,#0d0604 3%, transparent 62%), linear-gradient(90deg,#0d0604 1%, transparent 48%)' }} />

        <div className="absolute bottom-4 left-5 right-5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-accent">Featured tonight</div>
          <div className="font-display text-xl font-extrabold uppercase leading-none sm:text-[30px]">Midnight Reel</div>
          <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-muted">
            <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-accent">4K</span>
            <span className="rounded border border-border bg-surface px-1.5 py-0.5">HDR</span>
            <span>2026 · Drama</span>
          </div>
        </div>
      </div>

      {/* floating glass pill navbar — mirrors the app's real nav */}
      <nav
        className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-1.5 shadow-xl shadow-black/50"
        style={{
          background: 'rgba(18,18,22,0.80)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <NavPill icon={<HouseIcon />} label="Home" active />
        <NavPill icon={<SearchIcon />} label="Search" />
        <NavPill icon={<BookIcon />} label="Library" />
        <NavPill icon={<GearIcon />} label="Settings" />
        <span className="mx-1 h-3.5 w-px bg-white/10" />
        <span className="flex items-center gap-1.5 pl-0.5 pr-2">
          <span
            className="h-4 w-4 rounded-full ring-1 ring-white/20"
            style={{ background: 'linear-gradient(160deg,#fa824d,#ff6a2b)' }}
          />
          <span className="text-[9px] font-medium text-white/70 hidden sm:inline">Jordan</span>
        </span>
      </nav>

      {/* rows */}
      <div className="space-y-3 px-5 py-4">
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-faint">Continue watching</div>
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Poster key={i} i={i} className="w-[44px] sm:w-[58px]" />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-faint">Curated collections</div>
          <div className="flex gap-2 overflow-hidden">
            {[3, 4, 5, 6, 7, 0, 1, 2].map((i) => (
              <Poster key={i} i={i} className="w-[44px] sm:w-[58px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
