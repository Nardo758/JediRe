import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logErrorToBackend } from '../services/errorLogging';

interface Props {
  children: ReactNode;
  formName?: string;
  onReset?: () => void;
  preserveFormData?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  savedFormData: Record<string, any> | null;
}

/**
 * Specialized error boundary for form components
 * Preserves form data and provides recovery options
 */
export class FormErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      savedFormData: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Form Error:', error, errorInfo);

    // Attempt to preserve form data
    let formData: Record<string, any> | null = null;
    
    if (this.props.preserveFormData !== false) {
      try {
        formData = this.extractFormData();
        if (formData && Object.keys(formData).length > 0) {
          // Save to sessionStorage as backup
          const storageKey = `form-backup-${this.props.formName || 'default'}-${Date.now()}`;
          sessionStorage.setItem(storageKey, JSON.stringify(formData));
          this.setState({ savedFormData: formData });
        }
      } catch (e) {
        console.error('Failed to preserve form data:', e);
      }
    }

    // Log to backend
    logErrorToBackend({
      error: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date().toISOString(),
      context: 'FORM',
      formName: this.props.formName,
      hadFormData: !!formData,
    }).catch(console.error);
  }

  extractFormData(): Record<string, any> | null {
    try {
      // Try to find form elements in the DOM
      const forms = document.querySelectorAll('form');
      if (forms.length === 0) return null;

      const formData: Record<string, any> = {};
      
      forms.forEach((form) => {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const name = element.name || element.id;
          
          if (name) {
            if (element.type === 'checkbox') {
              formData[name] = (element as HTMLInputElement).checked;
            } else if (element.type === 'radio') {
              if ((element as HTMLInputElement).checked) {
                formData[name] = element.value;
              }
            } else if (element.type !== 'password') {
              // Don't save passwords
              formData[name] = element.value;
            }
          }
        });
      });

      return Object.keys(formData).length > 0 ? formData : null;
    } catch (e) {
      console.error('Error extracting form data:', e);
      return null;
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleRestoreFormData = () => {
    // This will trigger a reset and the parent can access savedFormData
    // Parent component should implement logic to restore from sessionStorage
    this.handleReset();
  };

  handleCopyFormData = () => {
    if (this.state.savedFormData) {
      const dataStr = JSON.stringify(this.state.savedFormData, null, 2);
      navigator.clipboard
        .writeText(dataStr)
        .then(() => {
          alert('Form data copied to clipboard!');
        })
        .catch((err) => {
          console.error('Failed to copy form data:', err);
        });
    }
  };

  render() {
    if (this.state.hasError) {
      const hasSavedData = this.state.savedFormData && Object.keys(this.state.savedFormData).length > 0;

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-10 w-10 text-yellow-500"
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
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Form Error
                </h3>
                <p className="text-sm text-gray-600">
                  {hasSavedData
                    ? 'An error occurred, but we saved your form data.'
                    : 'An error occurred with the form.'}
                </p>
              </div>
            </div>

            {hasSavedData && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded p-3">
                <div className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-600 mt-0.5 mr-2"
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
                    <p className="text-sm font-medium text-green-800">
                      Your data is safe
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      We've saved {Object.keys(this.state.savedFormData!).length} field
                      {Object.keys(this.state.savedFormData!).length !== 1 ? 's' : ''} from your form.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs text-yellow-800 font-mono overflow-auto max-h-20">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {hasSavedData ? 'Restore Form' : 'Try Again'}
              </button>

              {hasSavedData && (
                <button
                  onClick={this.handleCopyFormData}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
                >
                  Copy Form Data
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium py-2 px-4 rounded transition-colors"
              >
                Reload Page
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              {hasSavedData
                ? 'Form data is backed up in your session.'
                : 'We recommend saving your work frequently.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FormErrorBoundary;
