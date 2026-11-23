import { Component, type ReactNode } from 'react';
import { personalContent } from '../../config/personalContent';

const E = personalContent.ui.error;

interface State {
  error: Error | null;
}

/** Last-resort error screen: keeps progress safe and offers a reload. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: (e: Error, reset: () => void) => ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[A World Made Just For Her]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#f6d3dc] to-[#e6dcf5] p-6 text-center">
          <div className="royal-panel max-w-md p-8">
            <h1 className="font-serif text-3xl font-semibold text-plum">{E.title}</h1>
            <p className="mt-3 text-sm text-plum/80">
              {E.body}
            </p>
            <p className="mt-2 text-xs text-plum/50">{this.state.error.message}</p>
            <button className="royal-btn mt-6" onClick={() => window.location.reload()}>
              {E.reload}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
