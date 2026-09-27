const cls = 'h-[1em] w-[1em]';

export function AppleIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function PhoneIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function GlobeIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </svg>
  );
}

export function TvIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="12" rx="2" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function WindowsIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 5.5 10.2 4.5v6.9H3V5.5Zm0 13 7.2 1v-6.8H3v5.8Zm8.4 1.2L21 21V12.6h-9.6v7.1Zm0-15.4v7.1H21V3l-9.6 1.3Z" />
    </svg>
  );
}

export function CheckIcon({ className = cls }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Status pill used on device lists and download cards. */
export function StatusPill({ children, now }: { children: React.ReactNode; now?: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 font-mono text-[11px] ${
        now ? 'border-accent/50 bg-accent-light text-accent' : 'border-border-strong text-muted'
      }`}
    >
      {children}
    </span>
  );
}
