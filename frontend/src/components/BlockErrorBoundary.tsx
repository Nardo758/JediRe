import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logErrorToBackend } from '../services/errorLogging';

interface FallbackArgs {
  error: Error;
  retry: () => void;
}

interface Props {
  children: ReactNode;
  /**
   * Optional custom fallback. Receives the caught error and a `retry` callback
   * that re-mounts the wrapped subtree by clearing the error state.
   */
  fallback?: (args: FallbackArgs) => ReactNode;
  /** Human-readable label included in console + backend logs for triage. */
  label?: string;
  /** Optional handler invoked alongside the default logging. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * BlockErrorBoundary — a lightweight, inline-friendly error boundary intended
 * for wrapping individual UI blocks (e.g. one entry in a list of cards) so
 * that a failure in one block does not take down sibling blocks or the entire
 * surrounding section.
 *
 * Unlike the top-level `ErrorBoundary`, the fallback is local/inline and
 * the Retry button re-mounts only the wrapped subtree by clearing internal
 * error state. Each instance is fully isolated, so consumers should mount one
 * boundary per block (typically inside a `.map(...)` over blocks).
 */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const label = this.props.label ?? 'unlabeled';
    console.error(`BlockErrorBoundary [${label}] caught an error:`, error, errorInfo);

    logErrorToBackend({
      error: `[BlockErrorBoundary:${label}] ${error.message}`,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }).catch(console.error);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, retry: this.handleRetry });
      }
      return (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            margin: '4px 0',
            border: '1px solid rgba(220, 53, 69, 0.4)',
            background: 'rgba(220, 53, 69, 0.06)',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 11,
            color: '#c1121f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>Couldn&apos;t render this block.</span>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              color: '#c1121f',
              background: 'transparent',
              border: '1px solid rgba(193, 18, 31, 0.6)',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default BlockErrorBoundary;
