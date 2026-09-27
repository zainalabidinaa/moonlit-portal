import type { ReactNode } from 'react';

/** Shared class strings so every admin page reads the same. */
export const adminKicker = 'text-xs font-semibold uppercase tracking-[.12em] text-accent';
export const adminTitle = 'text-[34px] font-semibold leading-tight tracking-tight text-text';
export const adminLede = 'mt-2 max-w-[46em] text-[15px] text-muted';
export const adminSelect =
  'h-8 rounded-lg border border-border-strong bg-bg2 px-2.5 text-xs text-text outline-none transition-colors focus:border-accent disabled:opacity-50';
export const adminTh = 'px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted';

/** A labelled number, for the summary row at the top of a dashboard. */
export function StatTile({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'accent' | 'ok' | 'warn' }) {
  const noteColor = tone === 'ok' ? 'text-cyan' : tone === 'warn' ? 'text-accent' : 'text-faint';
  return (
    <div className="rounded-2xl border border-border bg-surface px-[18px] py-4">
      <small className="block text-xs font-medium text-muted">{label}</small>
      <b className="mt-1 block text-[28px] font-semibold tabular-nums tracking-tight">{value}</b>
      {note && <em className={`text-xs not-italic ${noteColor}`}>{note}</em>}
    </div>
  );
}

/** Pill-shaped toggle used for filter rows. */
export function FilterChip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
        on ? 'border-accent/50 bg-accent-light text-accent' : 'border-border-strong text-muted hover:text-text'
      }`}
    >
      {children}
      {count !== undefined && <span className="font-mono text-[10.5px] opacity-70">{count}</span>}
    </button>
  );
}
