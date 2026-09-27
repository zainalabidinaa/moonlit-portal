import { HTMLAttributes } from 'react';

export function Card({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border border-border bg-surface ${className}`} {...rest}>
      {children}
    </div>
  );
}
