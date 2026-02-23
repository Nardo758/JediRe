# Error Boundaries Implementation Guide

## Overview

This document provides a comprehensive guide to the error boundary system implemented in JEDIRE. The system includes global and specialized error boundaries that prevent component crashes from taking down the entire application.

## ✅ Components Implemented

### 1. **Main Error Boundary** (`ErrorBoundary.tsx`)
- **Purpose:** Global error catching for entire application
- **Features:**
  - Catches all React component errors
  - Logs errors to backend automatically
  - Shows user-friendly fallback UI
  - Provides retry, reload, and go-back options
  - Auto-recovery attempts (up to 3 times)
  - Preserves user work

### 2. **3D Error Boundary** (`3DErrorBoundary.tsx`)
- **Purpose:** Specialized handling for Three.js/WebGL errors
- **Features:**
  - Detects WebGL context loss
  - Provides WebGL diagnostics
  - Auto-recovery for WebGL errors
  - Cache clearing options
  - Graphics driver troubleshooting tips
  - Deal data preservation

### 3. **API Error Boundary** (`APIErrorBoundary.tsx`)
- **Purpose:** Network and API error handling
- **Features:**
  - Online/offline detection
  - Automatic retry with exponential backoff
  - Queue failed requests for retry
  - Connection status indicator
  - Offline mode support
  - Auto-reconnect on network restore

### 4. **Form Error Boundary** (`FormErrorBoundary.tsx`)
- **Purpose:** Form-specific error handling with data preservation
- **Features:**
  - Automatic form data extraction
  - SessionStorage backup
  - Copy form data to clipboard
  - Field count tracking
  - Form restoration on retry
  - Password field exclusion

## 📦 Fallback UI Components

### 1. `ErrorFallback.tsx` - Generic error page
- Clean, professional design
- Clear error messaging
- Multiple recovery options
- Support contact information

### 2. `Design3DError.tsx` - 3D viewer specific
- Dark theme to match 3D editor
- WebGL troubleshooting guidance
- Browser compatibility tips
- Design preservation confirmation

### 3. `APIError.tsx` - API/Network errors
- Connection status indicator
- Auto-retry countdown
- Offline mode guidance
- Network troubleshooting tips

### 4. `FormError.tsx` - Form errors
- Form data preservation indicator
- Field count display
- Copy data functionality
- Recovery instructions

## 🔧 Backend Error Logging

### Endpoint: `POST /api/v1/errors/log`

**Request Body:**
```json
{
  "error": "Error message",
  "stack": "Stack trace",
  "componentStack": "React component stack",
  "timestamp": "ISO8601 timestamp",
  "url": "Current page URL",
  "userAgent": "Browser user agent",
  "context": "ERROR_CONTEXT",
  "dealId": "optional-deal-id",
  "userId": "optional-user-id",
  "formName": "optional-form-name",
  "isNetworkError": false,
  "isWebGLError": false,
  "metadata": {}
}
```

**Error Contexts:**
- `GENERAL` - Generic errors
- `3D_VIEWER` - Three.js/WebGL errors
- `API` - Network/API errors
- `FORM` - Form-related errors

### Additional Endpoints

**GET `/api/v1/errors/stats`** - Error statistics
- Query params: `timeRange` (24h, 7d, 30d)
- Returns error counts by context, affected users, trends

**GET `/api/v1/errors/recent`** - Recent errors
- Query params: `limit`, `offset`, `context`
- Returns paginated recent errors

### Database Schema

**Table: `error_logs`**
```sql
- id (SERIAL PRIMARY KEY)
- user_id (FK to users)
- error_message (TEXT)
- stack_trace (TEXT)
- component_stack (TEXT)
- error_context (VARCHAR)
- url (TEXT)
- user_agent (TEXT)
- deal_id (FK to deals)
- form_name (VARCHAR)
- is_network_error (BOOLEAN)
- is_webgl_error (BOOLEAN)
- metadata (JSONB)
- created_at (TIMESTAMP)
- resolved_at (TIMESTAMP)
- resolved_by (FK to users)
- notes (TEXT)
```

**Views:**
- `error_stats` - Aggregated error statistics
- `top_recurring_errors` - Most common errors

## 🚀 Usage

### Wrapping the Entire Application

```tsx
// App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorFallback } from './components/fallbacks/ErrorFallback';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <YourAppContent />
    </ErrorBoundary>
  );
}
```

### Wrapping Critical Pages

```tsx
// Design3DPage.tsx
import { ThreeDErrorBoundary } from './components/3DErrorBoundary';

export const Design3DPage = () => {
  return (
    <ThreeDErrorBoundary dealId={dealId}>
      <Building3DEditor />
    </ThreeDErrorBoundary>
  );
};
```

### Wrapping API Components

```tsx
// DataLoadingComponent.tsx
import { APIErrorBoundary } from './components/APIErrorBoundary';

export const DataComponent = () => {
  return (
    <APIErrorBoundary context="DEAL_LOADING" onRetry={fetchData}>
      <DataDisplay />
    </APIErrorBoundary>
  );
};
```

### Wrapping Forms

```tsx
// DealForm.tsx
import { FormErrorBoundary } from './components/FormErrorBoundary';

export const DealForm = () => {
  return (
    <FormErrorBoundary formName="deal-creation" preserveFormData>
      <FormContent />
    </FormErrorBoundary>
  );
};
```

## 🧪 Testing Guide

### Manual Testing Scenarios

#### 1. **Test General Error Boundary**

**Trigger:** Add a test component that throws an error

```tsx
// TestErrorComponent.tsx
export const TestErrorComponent = () => {
  if (Math.random() > 0.5) {
    throw new Error('Test error for error boundary');
  }
  return <div>Success!</div>;
};
```

**Expected Result:**
- Error caught gracefully
- User sees ErrorFallback UI
- Error logged to backend
- "Try Again" button works
- "Reload Page" button works

#### 2. **Test 3D Error Boundary**

**Trigger:** In browser console on Design3D page:

```javascript
// Simulate WebGL context loss
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl');
const loseContext = gl.getExtension('WEBGL_lose_context');
if (loseContext) loseContext.loseContext();
```

**Expected Result:**
- 3D viewer shows error boundary
- WebGL info displayed
- Auto-recovery attempted
- "Clear Cache & Retry" works
- Design data preserved

#### 3. **Test API Error Boundary**

**Trigger:** Disconnect internet or block API calls

```javascript
// In browser console - Override fetch to simulate failure
const originalFetch = window.fetch;
window.fetch = () => Promise.reject(new Error('Network error'));
```

**Expected Result:**
- API error boundary shows
- Online/offline status correct
- Auto-retry on reconnection
- Offline message displayed

#### 4. **Test Form Error Boundary**

**Trigger:** Add error in form component

```tsx
// In form component
if (formData.invalidField) {
  throw new Error('Form validation error');
}
```

**Expected Result:**
- Form error boundary activates
- Form data preserved in sessionStorage
- Field count displayed
- Copy data button works
- Form restoration works

### Automated Testing

#### Component Tests

```typescript
// ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('catches errors and shows fallback', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
  
  it('logs error to backend', async () => {
    // Mock error logging service
    // Assert POST call made
  });
});
```

#### Integration Tests

```typescript
// Design3DPage.test.tsx
describe('Design3D Page with Error Boundary', () => {
  it('recovers from 3D viewer crash', () => {
    // Render page
    // Trigger 3D error
    // Verify error boundary
    // Click retry
    // Verify recovery
  });
});
```

### Backend Testing

```bash
# Test error logging endpoint
curl -X POST http://localhost:3000/api/v1/errors/log \
  -H "Content-Type: application/json" \
  -d '{
    "error": "Test error",
    "stack": "Error stack",
    "timestamp": "2024-02-22T10:00:00Z",
    "context": "TEST"
  }'

# Verify database entry
psql -d jedire -c "SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 1;"
```

## 📊 Monitoring & Alerts

### Error Dashboard (Recommended)

Create an admin dashboard to monitor errors:

1. **Error Rate Graph** - Errors per hour/day
2. **Top Errors** - Most frequent error messages
3. **Affected Users** - User count by error type
4. **Error Context Distribution** - Pie chart of error types
5. **Recent Errors** - Real-time error log

### Alert Triggers

Set up alerts for:
- Error rate spike (>10 errors/minute)
- Critical error patterns detected
- Same error affecting >5 users
- WebGL errors (possible browser compatibility)
- Network errors spike (possible API outage)

## 🔍 Debugging Tips

### Development Mode

Errors show detailed information in development:
- Full error message
- Stack trace
- Component stack
- Error metadata

### Production Mode

Errors are logged but details hidden from users:
- User-friendly message only
- Error ID for support reference
- Logged to backend for analysis

### Console Commands

```javascript
// Check error queue size
import { getErrorQueueSize } from './services/errorLogging';
console.log('Queued errors:', getErrorQueueSize());

// Clear error queue
import { clearErrorQueue } from './services/errorLogging';
clearErrorQueue();
```

## 📝 Best Practices

1. **Wrap at appropriate levels**
   - Global boundary at App level
   - Specialized boundaries around critical features
   - Don't over-wrap (too many boundaries = poor DX)

2. **Provide context**
   - Always pass relevant context (dealId, formName, etc.)
   - Add meaningful error messages
   - Include recovery instructions

3. **Test error scenarios**
   - Test happy path AND error path
   - Verify data preservation
   - Test auto-recovery

4. **Monitor production errors**
   - Review error logs weekly
   - Address recurring errors
   - Update boundaries as needed

5. **User experience**
   - Clear error messages
   - Multiple recovery options
   - Don't lose user work
   - Provide support contact

## 🔄 Recovery Strategies

### Automatic Recovery
- API errors: Retry with exponential backoff
- WebGL errors: Clear context and retry
- Network errors: Wait for connection restore

### Manual Recovery
- Try Again: Reset error boundary
- Reload Page: Full page refresh
- Go Back: Navigate to previous page
- Clear Cache: Remove corrupted data

### Data Preservation
- Forms: Auto-save to sessionStorage
- 3D designs: Continuous save to backend
- Draft data: Local storage backup
- Network queue: Retry failed requests

## 📚 Additional Resources

- [React Error Boundaries Docs](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [WebGL Context Loss](https://www.khronos.org/webgl/wiki/HandlingContextLost)
- [Service Worker Caching](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 🎯 Success Metrics

✅ **Zero full app crashes** - Component errors don't kill the app
✅ **<1 second recovery time** - Fast error boundary display
✅ **100% data preservation** - No lost work on errors
✅ **>90% auto-recovery** - Most errors self-resolve
✅ **<5% user-reported errors** - Most caught proactively

---

## Quick Reference

**Import Error Boundaries:**
```typescript
import { 
  ErrorBoundary, 
  ThreeDErrorBoundary, 
  APIErrorBoundary, 
  FormErrorBoundary 
} from '@/components/error-boundaries';
```

**Import Fallbacks:**
```typescript
import { 
  ErrorFallback, 
  Design3DError, 
  APIError, 
  FormError 
} from '@/components/fallbacks';
```

**Log Error Manually:**
```typescript
import { logErrorToBackend } from '@/services/errorLogging';

logErrorToBackend({
  error: 'Custom error',
  stack: error.stack,
  timestamp: new Date().toISOString(),
  context: 'CUSTOM_CONTEXT'
});
```

---

**Implementation Date:** February 22, 2024
**Status:** ✅ Complete
**Next Steps:** Deploy to staging, monitor, iterate
