import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Stops a rendering crash from becoming a silent blank page. The portal had
 * no boundary at all, so any exception while opening a widget/collection
 * just cleared the screen with no clue why — indistinguishable from "the
 * button does nothing".
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[portal] render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-surface p-5">
          <p className="mb-1 text-sm font-semibold text-red-400">Something broke while rendering this page</p>
          <p className="mb-3 text-xs text-muted">
            Copy the message below when reporting it — it is also in the browser console.
          </p>
          <pre className="mb-4 max-h-56 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-[11.5px] leading-relaxed text-text">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.split('\n').slice(0, 8).join('\n')}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-[#160a04] transition-colors hover:bg-accent-2"
            >
              Reload
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-border-strong px-3.5 py-1.5 text-[12.5px] text-muted transition-colors hover:text-text"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
