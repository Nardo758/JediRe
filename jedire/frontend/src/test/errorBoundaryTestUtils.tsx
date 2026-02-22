/**
 * Error Boundary Testing Utilities
 * 
 * Helper functions and components for testing error boundaries
 */

import React, { useState } from 'react';

/**
 * Component that throws an error when triggered
 * Useful for testing error boundaries
 */
export const ThrowError: React.FC<{ message?: string; shouldThrow?: boolean }> = ({ 
  message = 'Test error', 
  shouldThrow = true 
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error thrown</div>;
};

/**
 * Component with a button that triggers an error
 */
export const ErrorTrigger: React.FC<{ errorMessage?: string }> = ({ 
  errorMessage = 'Triggered test error' 
}) => {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error(errorMessage);
  }

  return (
    <div>
      <button onClick={() => setShouldError(true)} data-testid="error-trigger">
        Trigger Error
      </button>
      <p>Click the button to trigger an error</p>
    </div>
  );
};

/**
 * Simulate a network error by overriding fetch
 */
export const mockNetworkError = () => {
  const originalFetch = window.fetch;
  
  window.fetch = (() => {
    return Promise.reject(new Error('Network request failed'));
  }) as typeof fetch;

  // Return restore function
  return () => {
    window.fetch = originalFetch;
  };
};

/**
 * Simulate going offline
 */
export const mockOffline = () => {
  const originalOnLine = navigator.onLine;
  
  // Override navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false,
  });

  // Trigger offline event
  window.dispatchEvent(new Event('offline'));

  // Return restore function
  return () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    });
    window.dispatchEvent(new Event('online'));
  };
};

/**
 * Simulate WebGL context loss
 */
export const mockWebGLContextLoss = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.warn('No canvas element found');
    return () => {};
  }

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not supported');
    return () => {};
  }

  const loseContextExt = (gl as any).getExtension('WEBGL_lose_context');
  if (!loseContextExt) {
    console.warn('WEBGL_lose_context extension not available');
    return () => {};
  }

  loseContextExt.loseContext();

  // Return restore function
  return () => {
    loseContextExt.restoreContext();
  };
};

/**
 * Component that simulates async error (e.g., API call)
 */
export const AsyncErrorTrigger: React.FC = () => {
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    if (hasError) {
      // Simulate async error
      Promise.reject(new Error('Async error')).catch((error) => {
        throw error;
      });
    }
  }, [hasError]);

  return (
    <button onClick={() => setHasError(true)} data-testid="async-error-trigger">
      Trigger Async Error
    </button>
  );
};

/**
 * Form component with error trigger for testing FormErrorBoundary
 */
export const ErrorForm: React.FC<{ shouldError?: boolean }> = ({ 
  shouldError = false 
}) => {
  const [formData, setFormData] = useState({
    name: 'Test User',
    email: 'test@example.com',
    message: 'Test message',
  });

  if (shouldError) {
    throw new Error('Form validation error');
  }

  return (
    <form>
      <input
        name="name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        name="email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <textarea
        name="message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
      />
      <button type="submit">Submit</button>
    </form>
  );
};

/**
 * Mock error logging service for testing
 */
export const mockErrorLogging = () => {
  const logs: any[] = [];
  
  // Store original function
  const originalLog = jest.fn();
  
  // Mock implementation
  jest.mock('../services/errorLogging', () => ({
    logErrorToBackend: jest.fn((data) => {
      logs.push(data);
      return Promise.resolve();
    }),
  }));

  return {
    logs,
    clear: () => logs.splice(0, logs.length),
    getLastLog: () => logs[logs.length - 1],
    getLogCount: () => logs.length,
  };
};

/**
 * Helper to suppress console.error during tests
 * (Error boundaries log to console, which clutters test output)
 */
export const suppressConsoleError = () => {
  const originalError = console.error;
  
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });
};

/**
 * Wait for error boundary to render
 */
export const waitForErrorBoundary = (timeout = 1000): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

/**
 * Example test suite setup
 */
export const errorBoundaryTestSetup = () => {
  return {
    suppressLogs: suppressConsoleError,
    mockError: mockNetworkError,
    mockOffline,
    mockWebGL: mockWebGLContextLoss,
  };
};

// Export test components
export const TestComponents = {
  ThrowError,
  ErrorTrigger,
  AsyncErrorTrigger,
  ErrorForm,
};

// Export mock functions
export const MockFunctions = {
  mockNetworkError,
  mockOffline,
  mockWebGLContextLoss,
  mockErrorLogging,
};

// Export utilities
export const TestUtils = {
  suppressConsoleError,
  waitForErrorBoundary,
  errorBoundaryTestSetup,
};

export default {
  TestComponents,
  MockFunctions,
  TestUtils,
};
