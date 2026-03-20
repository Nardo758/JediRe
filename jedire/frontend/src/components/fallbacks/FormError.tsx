import React from 'react';

interface FormErrorProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  formName?: string;
  savedFieldCount?: number;
}

/**
 * Specialized fallback for form errors
 */
export const FormError: React.FC<FormErrorProps> = ({
  error,
  resetErrorBoundary,
  formName,
  savedFieldCount,
}) => {
  const hasData = savedFieldCount && savedFieldCount > 0;

  const handleCopyData = () => {
    try {
      // Try to get saved data from sessionStorage
      const keys = Object.keys(sessionStorage);
      const formBackups = keys.filter((key) => key.startsWith('form-backup-'));
      
      if (formBackups.length > 0) {
        // Get the most recent backup
        const latestBackup = formBackups.sort().reverse()[0];
        const data = sessionStorage.getItem(latestBackup);
        
        if (data) {
          navigator.clipboard.writeText(data).then(() => {
            alert('Form data copied to clipboard!');
          });
        }
      }
    } catch (e) {
      console.error('Failed to copy form data:', e);
      alert('Failed to copy form data. Please try again.');
    }
  };

  return (
    <div className="min-h-[500px] bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-200 rounded-full blur-xl opacity-50"></div>
              <div className="relative bg-yellow-100 rounded-full p-4">
                <svg
                  className="h-12 w-12 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Form Error
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {hasData
              ? 'An error occurred, but your form data is safe.'
              : 'An error occurred while processing the form.'}
          </p>

          {/* Form info */}
          {formName && (
            <div className="text-center mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {formName}
              </span>
            </div>
          )}

          {/* Data saved indicator */}
          {hasData && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg
                  className="h-6 w-6 text-green-600 mt-0.5 mr-3 flex-shrink-0"
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
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900 mb-1">
                    Your data is safe
                  </p>
                  <p className="text-xs text-green-700">
                    We've automatically saved {savedFieldCount} field{savedFieldCount !== 1 ? 's' : ''} from your form.
                    You can restore it or copy it for your records.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* What happened */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              What happened?
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              The form encountered an unexpected error while processing your input.
              This could be due to:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Invalid or unexpected data format</li>
              <li>• Connection issues during submission</li>
              <li>• Temporary server problem</li>
            </ul>
          </div>

          {/* Error details (dev mode) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Error Details (Development)
              </h3>
              <pre className="text-xs text-red-800 overflow-auto max-h-24 font-mono bg-white p-2 rounded">
                {error.toString()}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {resetErrorBoundary && (
              <button
                onClick={resetErrorBoundary}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
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
                  {hasData ? 'Restore Form' : 'Try Again'}
                </span>
              </button>
            )}

            {hasData && (
              <button
                onClick={handleCopyData}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
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
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Copy Form Data
                </span>
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Reload Page
            </button>
          </div>

          {/* Tips */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
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
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Pro tip
                </p>
                <p className="text-xs text-gray-600">
                  {hasData
                    ? 'Your form data is backed up in your browser session. It will remain available until you close this tab.'
                    : 'Consider saving your work frequently to avoid losing progress in case of errors.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormError;
