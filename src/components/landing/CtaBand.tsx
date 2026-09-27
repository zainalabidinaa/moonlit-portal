import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';

interface CtaBandProps {
  /** Landscape still behind the copy. Falls back to a warm gradient. */
  backdrop?: string | null;
  signedIn?: boolean;
}

export function CtaBand({ backdrop, signedIn }: CtaBandProps) {
  return (
    <section className="pb-20 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal>
          <div className="relative grid min-h-[380px] items-end overflow-hidden rounded-3xl border border-border bg-surface">
            {backdrop ? (
              <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-[center_35%]" />
            ) : (
              <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 70% at 50% 0%, rgba(255,122,61,.35), transparent 70%)' }} />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,8,10,.95)_0%,rgba(8,8,10,.6)_50%,rgba(8,8,10,.25)_100%)]" />
            <div className="relative grid justify-items-center gap-3.5 px-7 py-10 text-center">
              <h2 className="text-[clamp(32px,4.8vw,56px)] font-semibold leading-[1.05]">Tonight is already picked.</h2>
              <p className="max-w-[32em] text-[#d0d0d6]">
                {signedIn ? 'Open Moonlit on any screen and start with something good.' : 'Sign up in a minute, open Moonlit on any screen, and start with something good.'}
              </p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-3">
                <Link to={signedIn ? '/profiles' : '/signup'} className="inline-flex h-[54px] items-center rounded-full bg-text px-7 text-base font-semibold text-[#0a0a0c] hover:bg-white">
                  {signedIn ? 'Open Moonlit' : 'Get Moonlit'}
                </Link>
                <Link to="/download" className="inline-flex h-[54px] items-center rounded-full border border-border-strong bg-white/[.06] px-7 text-base font-semibold backdrop-blur hover:bg-white/10">
                  Download for Mac
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
