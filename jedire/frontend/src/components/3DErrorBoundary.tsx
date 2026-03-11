import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logErrorToBackend } from '../services/errorLogging';

interface Props {
  children: ReactNode;
  dealId?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRecovering: boolean;
}

/**
 * Specialized error boundary for 3D viewer components
 * Handles Three.js and WebGL specific errors gracefully
 */
export class ThreeDErrorBoundary extends Component<Props, State> {
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 2;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D Viewer Error:', error, errorInfo);

    // Check if it's a WebGL context loss
    const isWebGLError =
      error.message.includes('WebGL') ||
      error.message.includes('THREE') ||
      error.message.includes('context lost');

    // Log to backend with 3D-specific context
    logErrorToBackend({
      error: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date().toISOString(),
      context: '3D_VIEWER',
      dealId: this.props.dealId,
      isWebGLError,
      webglInfo: this.getWebGLInfo(),
    }).catch(console.error);

    // Attempt automatic recovery for WebGL context loss
    if (isWebGLError && this.recoveryAttempts < this.maxRecoveryAttempts) {
      this.attemptRecovery();
    }
  }

  getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return { supported: false };
      }

      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        vendor: debugInfo ? (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
        renderer: debugInfo ? (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      };
    } catch (e) {
      return { supported: false, error: (e as Error).message };
    }
  }

  attemptRecovery = () => {
    this.recoveryAttempts++;
    this.setState({ isRecovering: true });

    // Clear any cached 3D resources
    try {
      // Give WebGL context time to recover
      setTimeout(() => {
        this.handleReset();
      }, 2000);
    } catch (e) {
      console.error('Recovery failed:', e);
      this.setState({ isRecovering: false });
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      isRecovering: false,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleClearCache = () => {
    // Clear localStorage items related to 3D viewer
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.includes('3d-viewer') || key.includes('three-js')) {
          localStorage.removeItem(key);
        }
      });
      this.handleReset();
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <div className="flex items-center justify-center h-full bg-gray-900 text-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Recovering 3D viewer...</p>
              <p className="text-sm text-gray-400 mt-2">
                Attempt {this.recoveryAttempts} of {this.maxRecoveryAttempts}
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center h-full bg-gray-900 text-white p-8">
          <div className="max-w-md text-center">
            <div className="mb-6">
              <svg
                className="h-16 w-16 text-yellow-500 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2">3D Viewer Unavailable</h2>
            <p className="text-gray-400 mb-6">
              The 3D viewer encountered an error, but your design has been saved.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 bg-red-900 bg-opacity-50 border border-red-700 rounded p-3 text-left">
                <p className="text-xs text-red-300 font-mono overflow-auto max-h-24">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Reload 3D Viewer
              </button>

              <button
                onClick={this.handleClearCache}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Clear Cache & Retry
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Refresh Page
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Tip: Try updating your graphics drivers or using a different browser if the problem persists.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ThreeDErrorBoundary;
