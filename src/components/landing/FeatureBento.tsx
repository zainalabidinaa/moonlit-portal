import type { ReactNode } from 'react';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';
import { PlayerDemo } from './PlayerDemo';
import { SourcesDemo } from './SourcesDemo';

function Cell({ title, body, children, span2, delay }: { title: string; body: string; children: ReactNode; span2?: boolean; delay?: number }) {
  return (
    <Reveal delay={delay} className={`min-w-0 ${span2 ? 'xl:col-span-2' : ''}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="px-6 pt-6">
          <h3 className="text-[22px] font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 max-w-[34em] text-[15px] text-muted">{body}</p>
        </div>
        <div className="mt-5 min-h-0 flex-1">{children}</div>
      </div>
    </Reveal>
  );
}

const household = [
  { n: 'Jordan', bg: 'linear-gradient(140deg,#ff8a35,#ff6a2b)' },
  { n: 'Sam', bg: 'linear-gradient(140deg,#4f7cff,#2b4bd6)' },
  { n: 'Mia', bg: 'linear-gradient(140deg,#2fbf8f,#128f66)', kid: true },
  { n: 'Ada', bg: 'linear-gradient(140deg,#c65cff,#7d2bd6)' },
];

interface FeatureBentoProps {
  /** Landscape still for the player surface. */
  playerBackdrop?: string | null;
  playerTitle?: string;
  /** Landscape stills for the continue-watching cards (up to 3). */
  continueArt: { src: string; title: string; sub: string; pct: number; device: string }[];
  /** Poster-shaped covers for the curated mini grid (up to 8). */
  curatedArt: string[];
}

export function FeatureBento({ playerBackdrop, playerTitle, continueArt, curatedArt }: FeatureBentoProps) {
  return (
    <section id="features" className="py-20 md:py-[120px]">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal className="mb-11">
          <SectionHead
            kicker="Built for the couch"
            title="A player that earns the big screen."
            lede="Native playback, ranked sources and a home screen someone actually designed. The same on every device you sign in from."
          />
        </Reveal>

        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <Cell
            span2
            title="Every format, on the first try."
            body="An MPV-grade playback core decodes the demanding files web players choke on. Direct play, no transcoding, no stutter."
          >
            <PlayerDemo backdrop={playerBackdrop} title={playerTitle} />
          </Cell>

          <Cell
            delay={80}
            title="The best stream, picked for you."
            body="Junk is filtered before ranking. The top result is selected, and you can override it anytime."
          >
            <SourcesDemo />
          </Cell>

          <Cell title="Pick up where you left off." body="Progress syncs across Mac, iPhone and the web. Episodes open on the one you would actually watch next.">
            <div className="grid gap-2.5 px-4 pb-5 md:px-[18px]">
              {continueArt.length > 0 ? continueArt.map((c) => (
                <div key={c.title} className="relative grid grid-cols-[96px_1fr] items-center gap-3 rounded-xl border border-border bg-bg2 p-2">
                  <div className="relative aspect-video overflow-hidden rounded-[7px] bg-surface-2">
                    <img src={c.src} alt="" className="h-full w-full object-cover" />
                    <i className="absolute bottom-0 left-0 h-[3px] bg-accent" style={{ width: `${c.pct}%` }} />
                  </div>
                  <div className="min-w-0">
                    <b className="block truncate text-sm font-semibold">{c.title}</b>
                    <small className="block text-xs text-muted">{c.sub}</small>
                  </div>
                  <span className="absolute right-3 top-3 font-mono text-[10px] text-faint">{c.device}</span>
                </div>
              )) : (
                <p className="px-1 pb-2 text-sm text-faint">Continue watching appears once a household has started something.</p>
              )}
            </div>
          </Cell>

          <Cell delay={80} title="A profile for everyone." body="Up to four profiles with their own library, watch history and recommendations. A kids profile only sees the kids catalog.">
            <div className="flex flex-wrap gap-3.5 px-6 pb-6">
              {household.map((p) => (
                <div key={p.n} className="group grid justify-items-center gap-2 text-[12.5px] font-medium text-muted">
                  <span
                    className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-transparent text-lg font-semibold text-white transition-[transform,border-color] duration-300 group-hover:-translate-y-1 group-hover:border-text"
                    style={{ background: p.bg }}
                  >
                    {p.n[0]}
                  </span>
                  <span>
                    {p.n}
                    {p.kid && <em className="ml-1 rounded bg-accent-light px-1.5 py-px font-mono text-[9.5px] not-italic text-accent">KIDS</em>}
                  </span>
                </div>
              ))}
            </div>
          </Cell>

          <Cell delay={160} title="Curated by people, not a feed." body="Every collection has a curator, a theme and its own artwork. No autoplay trailers, no algorithmic sludge.">
            <div className="grid grid-cols-4 gap-2 px-4 pb-5 md:px-[18px]">
              {curatedArt.slice(0, 8).map((src, i) => (
                <div key={i} className="aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
              {curatedArt.length === 0 && [0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[2/3] rounded-lg bg-surface-2" />
              ))}
            </div>
          </Cell>
        </div>
      </div>
    </section>
  );
}
