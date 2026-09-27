import { Link } from 'react-router-dom';
import { PLANS } from '../../lib/plans';
import type { UserRole } from '../../types';
import { CheckIcon } from './PlatformIcons';
import { Reveal } from './Reveal';

interface PlansGridProps {
  /** The signed-in visitor's role, to mark their current plan. */
  currentRole?: UserRole | null;
}

/** The three plan cards. Facts come from lib/plans so every page agrees. */
export function PlansGrid({ currentRole }: PlansGridProps) {
  return (
    <div className="grid gap-3.5 md:grid-cols-3 md:items-stretch">
      {PLANS.map((p, i) => {
        const current = currentRole === p.id;
        return (
          <Reveal key={p.id} delay={i * 80}>
            <div
              className={`relative flex h-full flex-col gap-5 rounded-3xl border p-7 ${
                p.featured
                  ? 'border-accent/55 bg-[linear-gradient(180deg,rgba(255,122,61,.10),transparent_40%)] bg-surface shadow-glow-lg'
                  : 'border-border bg-surface'
              }`}
            >
              {(p.featured || current) && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-[#1a0b04]">
                  {current ? 'Your plan' : 'Most popular'}
                </span>
              )}
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="flex items-baseline gap-1.5 leading-none tracking-[-0.04em] tabular-nums">
                {p.price ? (
                  <>
                    <span className="text-[46px] font-bold">{p.price}</span>
                    <small className="text-sm font-medium tracking-normal text-muted">per month</small>
                  </>
                ) : (
                  <span className="text-[28px] font-bold">By invitation</span>
                )}
              </div>
              <p className="-mt-2 text-[14.5px] text-muted">{p.who}</p>
              <ul className="flex flex-1 flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14.5px]">
                    <CheckIcon className="mt-0.5 h-[18px] w-[18px] flex-none text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {current ? (
                <Link to="/billing" className="inline-flex h-[46px] w-full items-center justify-center rounded-full border border-border-strong bg-white/[.06] text-[15px] font-semibold hover:bg-white/10">
                  Manage billing
                </Link>
              ) : (
                <Link
                  to={p.to}
                  className={`inline-flex h-[46px] w-full items-center justify-center rounded-full text-[15px] font-semibold transition-[transform,background] hover:-translate-y-px ${
                    p.featured ? 'bg-text text-[#0a0a0c] hover:bg-white' : 'border border-border-strong bg-white/[.06] hover:bg-white/10'
                  }`}
                >
                  {p.cta}
                </Link>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
