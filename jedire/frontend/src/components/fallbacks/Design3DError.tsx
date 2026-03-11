import React from 'react';

interface Design3DErrorProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  dealId?: string;
}

/**
 * Specialized fallback for 3D design page errors
 */
export const Design3DError: React.FC<Design3DErrorProps> = ({
  error,
  resetErrorBoundary,
  dealId,
}) => {
  const handleClearCache = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.includes('3d-viewer') || key.includes('three-js')) {
          localStorage.removeItem(key);
        }
      });
      if (resetErrorBoundary) {
        resetErrorBoundary();
      }
    } catch (e) {
      console.error('Failed to clear cache:', e);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with 3D icon */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-8">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-800 bg-opacity-50 rounded-full p-4">
              <svg
                className="h-16 w-16 text-purple-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white text-center mb-2">
            3D Viewer Unavailable
          </h1>
          <p className="text-purple-200 text-center">
            The 3D design viewer encountered an error
          </p>
        </div>

        <div className="p-8">
          {/* Reassurance */}
          <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-green-400 mt-0.5 mr-3 flex-shrink-0"
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
              <div>
                <p className="text-green-300 font-semibold mb-1">
                  Your design is safe
                </p>
                <p className="text-green-200 text-sm">
                  All changes have been automatically saved. You can continue working once the 3D viewer is restored.
                </p>
              </div>
            </div>
          </div>

          {/* Possible Causes */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Possible causes:</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                WebGL context loss (common with integrated graphics)
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Outdated graphics drivers
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Browser compatibility issues
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Corrupted 3D cache
              </li>
            </ul>
          </div>

          {/* Error details (dev mode) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
              <h3 className="text-red-300 font-semibold mb-2 text-sm">
                Error Details (Development)
              </h3>
              <pre className="text-xs text-red-200 overflow-auto max-h-32 font-mono">
                {error.toString()}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {resetErrorBoundary && (
              <button
                onClick={resetErrorBoundary}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
              >
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
                  Reload 3D Viewer
                </span>
              </button>
            )}

            <button
              onClick={handleClearCache}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear 3D Cache & Retry
              </span>
            </button>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Refresh Page
            </button>

            {dealId && (
              <button
                onClick={() => window.location.href = `/deals/${dealId}`}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Return to Deal Overview
              </button>
            )}
          </div>

          {/* Help */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 text-center mb-3">
              Recommended solutions:
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Try using Chrome or Firefox for best 3D performance</li>
              <li>• Update your graphics drivers</li>
              <li>• Enable hardware acceleration in your browser</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Design3DError;
