type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'purple';

const variants: Record<BadgeVariant, string> = {
  default: 'border-border-strong text-muted',
  success: 'border-cyan/40 bg-cyan/10 text-cyan',
  warning: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  danger: 'border-red-400/40 bg-red-400/10 text-red-300',
  purple: 'border-accent/50 bg-accent-light text-accent',
};

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
