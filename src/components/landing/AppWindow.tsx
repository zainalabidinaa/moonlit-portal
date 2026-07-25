import type { ReactNode } from 'react';

interface AppWindowProps {
  children: ReactNode;
  /** Text shown in the fake address bar (browser variant). */
  url?: string;
  className?: string;
  /** Adds a slow float animation. */
  float?: boolean;
}

/**
 * A macOS-style window chrome wrapper. Used to frame the in-code app mockups
 * so they read as "the real Moonlit app" without shipping screenshots.
 */
export function AppWindow({ children, url = 'trymoonlit.app', className = '', float }: AppWindowProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border-strong bg-bg2 shadow-2xl ${
        float ? 'animate-float-slow' : ''
      } ${className}`}
      style={{ boxShadow: '0 40px 120px -40px rgba(0,0,0,.9), 0 0 0 1px rgba(250,130,77,.06)' }}
    >
      {/* title bar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex max-w-[240px] flex-1 items-center justify-center gap-1.5 rounded-md bg-bg/70 px-3 py-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-faint">
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm3 8H9V7a3 3 0 0 1 6 0v3Z" fill="currentColor" />
          </svg>
          <span className="font-mono text-[10px] text-faint">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
