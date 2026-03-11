import React, { useState, useEffect } from 'react';

interface APIErrorProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  context?: string;
}

/**
 * Specialized fallback for API/Network errors
 */
export const APIError: React.FC<APIErrorProps> = ({
  error,
  resetErrorBoundary,
  context,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Auto-retry when connection is restored
    if (isOnline && countdown === null && resetErrorBoundary) {
      setCountdown(3);
    }
  }, [isOnline]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && resetErrorBoundary) {
      resetErrorBoundary();
    }
  }, [countdown, resetErrorBoundary]);

  const handleRetry = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Status Bar */}
        <div className={`h-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'} transition-colors duration-300`} />

        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {isOnline ? (
              <div className="bg-orange-100 rounded-full p-4">
                <svg
                  className="h-12 w-12 text-orange-600"
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
              </div>
            ) : (
              <div className="bg-gray-100 rounded-full p-4">
                <svg
                  className="h-12 w-12 text-gray-600"
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
              </div>
            )}
          </div>

          {/* Title & Message */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isOnline ? 'Connection Issue' : "You're Offline"}
            </h2>
            <p className="text-gray-600">
              {isOnline
                ? 'Having trouble connecting to the server.'
                : 'No internet connection detected.'}
            </p>
            {context && (
              <p className="text-sm text-gray-500 mt-2">
                Context: {context}
              </p>
            )}
          </div>

          {/* Status Message */}
          <div className={`rounded-lg p-4 mb-6 ${
            isOnline ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-start">
              {isOnline ? (
                <svg
                  className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-gray-600 mt-0.5 mr-2 flex-shrink-0 animate-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isOnline ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {isOnline ? 'Connection restored' : 'Waiting for connection...'}
                </p>
                <p className={`text-xs mt-1 ${
                  isOnline ? 'text-green-700' : 'text-gray-600'
                }`}>
                  {isOnline
                    ? "Your internet connection is back. You can retry now."
                    : "Your changes are saved locally and will sync when you're back online."}
                </p>
              </div>
            </div>
          </div>

          {/* Auto-retry countdown */}
          {countdown !== null && countdown > 0 && (
            <div className="text-center mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-900 font-medium">
                Automatically retrying in {countdown}...
              </p>
            </div>
          )}

          {/* Error Details (Development) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Error Details (Development)
              </h3>
              <pre className="text-xs text-red-800 overflow-auto max-h-24 font-mono">
                {error.toString()}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              disabled={!isOnline}
              className={`w-full font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
                isOnline
                  ? 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isOnline ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry Now
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg
                    className="h-5 w-5 mr-2 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Waiting for Connection
                </span>
              )}
            </button>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Reload Page
            </button>

            <button
              onClick={() => window.history.back()}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Go Back
            </button>
          </div>

          {/* Tips */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-2">
              💡 Troubleshooting tips:
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Check your internet connection</li>
              <li>• Try disabling VPN or proxy</li>
              <li>• Clear browser cache and cookies</li>
              <li>• Contact support if the problem persists</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIError;
