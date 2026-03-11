/**
 * Error Boundaries - Centralized Export
 * 
 * Import all error boundaries from this single file:
 * import { ErrorBoundary, ThreeDErrorBoundary, APIErrorBoundary, FormErrorBoundary } from '@/components/error-boundaries';
 */

export { ErrorBoundary } from './ErrorBoundary';
export { ThreeDErrorBoundary } from './3DErrorBoundary';
export { APIErrorBoundary } from './APIErrorBoundary';
export { FormErrorBoundary } from './FormErrorBoundary';

// Fallback UI components
export * from './fallbacks';
