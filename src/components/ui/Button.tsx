import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-text text-[#0a0a0c] hover:bg-white hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,.35)]',
  accent: 'bg-gradient-to-br from-orange to-accent-2 text-[#1a0b04] hover:shadow-glow',
  secondary: 'bg-accent-light text-accent border border-accent/30 hover:bg-surface-2',
  ghost: 'bg-white/[.06] text-text border border-border-strong hover:bg-white/10 backdrop-blur',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-[38px] px-4 text-sm',
  md: 'h-[46px] px-5 text-[15px]',
  lg: 'h-[54px] px-7 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
