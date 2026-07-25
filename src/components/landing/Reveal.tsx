import type { ReactNode } from 'react';
import { useInView } from './useInView';

interface RevealProps {
  children: ReactNode;
  /** Direction the element travels from as it fades in. */
  from?: 'up' | 'left' | 'right' | 'none';
  /** Stagger delay in ms. */
  delay?: number;
  className?: string;
}

const offset: Record<NonNullable<RevealProps['from']>, string> = {
  up: 'translateY(28px)',
  left: 'translateX(-32px)',
  right: 'translateX(32px)',
  none: 'none',
};

/**
 * Fades + slides its children in the first time they scroll into view.
 * Reduced-motion users get the content immediately (no transform) via useInView.
 */
export function Reveal({ children, from = 'up', delay = 0, className = '' }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : offset[from],
        transition: 'opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)',
        transitionDelay: `${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
