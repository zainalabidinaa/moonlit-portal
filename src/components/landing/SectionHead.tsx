import type { ReactNode } from 'react';

interface SectionHeadProps {
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  center?: boolean;
  className?: string;
}

/** Kicker + headline + lede, the one heading pattern used on every marketing section. */
export function SectionHead({ kicker, title, lede, center, className = '' }: SectionHeadProps) {
  return (
    <div className={`grid max-w-[680px] gap-4 ${center ? 'mx-auto justify-items-center text-center' : ''} ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">{kicker}</p>
      <h2 className="text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.05]">{title}</h2>
      {lede && <p className="max-w-[36em] text-[17px] leading-relaxed text-muted">{lede}</p>}
    </div>
  );
}
