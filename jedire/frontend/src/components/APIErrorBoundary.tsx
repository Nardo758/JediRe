import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logErrorToBackend } from '../services/errorLogging';

interface Props {
  children: ReactNode;
  context?: string;
  onRetry?: () => void;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isOnline: boolean;
  retryCount: number;
}

/**
 * Specialized error boundary for API and network errors
 * Handles offline mode, network failures, and API errors
 */
export class APIErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isOnline: navigator.onLine,
      retryCount: 0,
    };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleOnline = () => {
    this.setState({ isOnline: true });
    
    // Auto-retry when connection is restored
    if (this.state.hasError) {
      this.handleRetry();
    }
  };

  handleOffline = () => {
    this.setState({ isOnline: false });
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('API Error:', error, errorInfo);

    const isNetworkError =
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      !navigator.onLine;

    // Log to backend (will queue if offline)
    logErrorToBackend({
      error: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date().toISOString(),
      context: this.props.context || 'API',
      isNetworkError,
      isOnline: navigator.onLine,
    }).catch(console.error);

    // Auto-retry for network errors
    if (isNetworkError && this.state.retryCount < this.maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
      this.retryTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, delay);
    }
  }

  handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
    }));

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      const { isOnline, retryCount } = this.state;
      const canRetry = retryCount < this.maxRetries;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                {isOnline ? (
                  <svg
                    className="h-10 w-10 text-orange-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-10 w-10 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {isOnline ? 'Connection Issue' : 'You\'re Offline'}
                </h3>
                <p className="text-sm text-gray-600">
                  {this.props.fallbackMessage ||
                    (isOnline
                      ? 'Having trouble connecting to the server. Your changes will sync when connection is restored.'
                      : 'Working offline. Changes will sync automatically when you\'re back online.')}
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded p-3">
                <p className="text-xs text-orange-800 font-mono overflow-auto max-h-20">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={!isOnline}
                  className={`w-full font-medium py-2 px-4 rounded transition-colors ${
                    isOnline
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isOnline ? 'Retry Now' : 'Waiting for connection...'}
                </button>
              )}

              <button
                onClick={this.handleReset}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
              >
                Dismiss
              </button>
            </div>

            {!isOnline && (
              <p className="text-xs text-gray-500 mt-4 text-center">
                We'll automatically reconnect when your internet is back.
              </p>
            )}

            {retryCount > 0 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Retry attempt {retryCount} of {this.maxRetries}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default APIErrorBoundary;
