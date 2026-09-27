import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { CheckIcon } from './PlatformIcons';

interface CtaBandProps {
  /** Real TMDB poster URLs. The first five are fanned out like a hand of cards. */
  posters: string[];
  signedIn?: boolean;
}

// Fan geometry for five cards, outermost to centre to outermost.
const fan = [
  { rot: -16, x: -132, y: 30, z: 1 },
  { rot: -8, x: -68, y: 8, z: 2 },
  { rot: 0, x: 0, y: 0, z: 3 },
  { rot: 8, x: 68, y: 8, z: 2 },
  { rot: 16, x: 132, y: 30, z: 1 },
];

/**
 * Closing call to action. Copy on the left; on the right a hand of real
 * posters that spreads wider when the band is hovered.
 */
export function CtaBand({ posters, signedIn }: CtaBandProps) {
  const cards = fan.map((f, i) => ({ ...f, src: posters[i] }));

  return (
    <section className="pb-20 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal>
          <div className="group relative grid overflow-hidden rounded-3xl border border-border bg-surface lg:grid-cols-[1.05fr_.95fr]">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(60% 80% at 85% 60%, rgba(255,122,61,.22), transparent 60%), radial-gradient(40% 50% at 10% 0%, rgba(255,255,255,.05), transparent 70%)',
              }}
            />

            <div className="relative grid content-center gap-4 px-7 pb-4 pt-10 md:px-12 md:pt-14 lg:py-16">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Ready when you are</p>
              <h2 className="max-w-[12em] text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.04]">
                Tonight is already picked.
              </h2>
              <p className="max-w-[30em] text-[17px] leading-relaxed text-muted">
                {signedIn
                  ? 'Your collections, your profiles and your place in every show are waiting on every screen.'
                  : 'Sign up in a minute, open Moonlit on any screen, and start with something good. No setup, no scrolling.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  to={signedIn ? '/profiles' : '/signup'}
                  className="inline-flex h-[54px] items-center gap-2 rounded-full bg-text px-7 text-base font-semibold text-[#0a0a0c] transition-[transform,box-shadow] hover:-translate-y-px hover:bg-white hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,.35)]"
                >
                  {signedIn ? 'Open Moonlit' : 'Get Moonlit'} <span aria-hidden="true">→</span>
                </Link>
                <Link
                  to="/download"
                  className="inline-flex h-[54px] items-center rounded-full border border-border-strong bg-white/[.06] px-7 text-base font-semibold backdrop-blur transition-[transform,background] hover:-translate-y-px hover:bg-white/10"
                >
                  Download for Mac
                </Link>
              </div>
              {!signedIn && (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted">
                  {['Cancel anytime', 'No ads', 'Every device'].map((m) => (
                    <span key={m} className="inline-flex items-center gap-2"><CheckIcon className="h-4 w-4 text-accent" />{m}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative h-[230px] md:h-[340px] lg:h-auto lg:min-h-[420px]" aria-hidden="true">
              <div className="absolute bottom-[-20px] left-1/2 h-[260px] w-0 scale-[.72] md:bottom-[-10px] md:scale-[.9] lg:bottom-[72px] lg:left-[46%] lg:scale-100">
                {cards.map((c, i) => (
                  <div
                    key={i}
                    className="fan-card absolute bottom-0 left-0 aspect-[2/3] w-[150px] origin-bottom overflow-hidden rounded-xl bg-surface-2 shadow-[0_30px_60px_-20px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,.1)] transition-transform duration-700 ease-out md:w-[170px]"
                    style={{
                      zIndex: c.z,
                      transform: `translateX(calc(-50% + ${c.x}px)) translateY(${c.y}px) rotate(${c.rot}deg)`,
                      ['--spread' as string]: `translateX(calc(-50% + ${c.x * 1.22}px)) translateY(${c.y * 1.3 - 14}px) rotate(${c.rot * 1.2}deg)`,
                    }}
                  >
                    {c.src ? (
                      <img src={c.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[linear-gradient(160deg,#2a1a12,#0e0e11)]" />
                    )}
                    {i !== 2 && <div className="absolute inset-0 bg-black/25" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
