# Error Boundaries - Quick Start Guide 🚀

**TL;DR:** Error boundaries prevent component crashes from killing your app. Wrap critical sections with the appropriate boundary, and users get graceful error handling instead of white screens.

---

## Installation

✅ Already installed! Error boundaries are integrated into the app.

---

## Basic Usage

### 1. **Global Protection** (Already Applied)

The entire app is wrapped in `App.tsx`:

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      {/* Your app */}
    </ErrorBoundary>
  );
}
```

✅ **Done!** Your app now catches all unhandled errors.

### 2. **Protect 3D Components**

```tsx
import { ThreeDErrorBoundary } from '@/components/error-boundaries';

<ThreeDErrorBoundary dealId={dealId}>
  <Building3DEditor />
</ThreeDErrorBoundary>
```

### 3. **Protect API Calls**

```tsx
import { APIErrorBoundary } from '@/components/error-boundaries';

<APIErrorBoundary context="PROPERTY_LOADING" onRetry={fetchData}>
  <PropertyList />
</APIErrorBoundary>
```

### 4. **Protect Forms**

```tsx
import { FormErrorBoundary } from '@/components/error-boundaries';

<FormErrorBoundary formName="deal-form" preserveFormData>
  <DealFormFields />
</FormErrorBoundary>
```

---

## When to Use Each Boundary

| Component Type | Boundary | Why |
|---------------|----------|-----|
| Entire app | `ErrorBoundary` | Global catch-all ✅ **Already applied** |
| 3D viewer | `ThreeDErrorBoundary` | WebGL-specific handling |
| Data fetching | `APIErrorBoundary` | Network retry logic |
| Forms | `FormErrorBoundary` | Preserves user input |
| Everything else | `ErrorBoundary` | Generic error handling |

---

## Props Reference

### `ErrorBoundary`
```tsx
<ErrorBoundary
  fallback={<CustomFallback />}  // Optional custom UI
  onError={(error, info) => {}}  // Optional callback
  onReset={() => {}}             // Optional reset handler
  resetKeys={[dependency]}       // Reset when these change
>
```

### `ThreeDErrorBoundary`
```tsx
<ThreeDErrorBoundary
  dealId="123"                   // Deal ID for logging
  onReset={() => {}}             // Optional reset handler
>
```

### `APIErrorBoundary`
```tsx
<APIErrorBoundary
  context="DATA_LOADING"         // Error context tag
  onRetry={() => {}}             // Retry function
  fallbackMessage="Custom msg"   // Optional message
>
```

### `FormErrorBoundary`
```tsx
<FormErrorBoundary
  formName="deal-form"           // Form identifier
  preserveFormData={true}        // Auto-save form data
  onReset={() => {}}             // Optional reset handler
>
```

---

## Common Patterns

### Pattern 1: Page-Level Protection
```tsx
export const MyPage = () => (
  <ErrorBoundary>
    <PageHeader />
    <PageContent />
    <PageFooter />
  </ErrorBoundary>
);
```

### Pattern 2: Nested Boundaries
```tsx
export const DealPage = () => (
  <ErrorBoundary> {/* Outer: catches everything */}
    <DealHeader />
    
    <APIErrorBoundary> {/* Inner: API-specific */}
      <DealData />
    </APIErrorBoundary>
    
    <ThreeDErrorBoundary> {/* Inner: 3D-specific */}
      <Building3DViewer />
    </ThreeDErrorBoundary>
  </ErrorBoundary>
);
```

### Pattern 3: Conditional Boundary
```tsx
const ContentWithOptionalBoundary = ({ needsBoundary }) => {
  const content = <MyContent />;
  
  return needsBoundary ? (
    <ErrorBoundary>{content}</ErrorBoundary>
  ) : content;
};
```

---

## Testing Error Boundaries

### Test Component
```tsx
// TestError.tsx
export const TestError = () => {
  const [shouldError, setShouldError] = useState(false);
  
  if (shouldError) {
    throw new Error('Test error!');
  }
  
  return (
    <button onClick={() => setShouldError(true)}>
      Trigger Error
    </button>
  );
};

// Usage
<ErrorBoundary>
  <TestError />
</ErrorBoundary>
```

### Console Testing
```javascript
// Trigger error in any component
throw new Error('Test error boundary');

// Simulate network error
window.fetch = () => Promise.reject(new Error('Network error'));

// Simulate WebGL loss
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl');
gl.getExtension('WEBGL_lose_context').loseContext();
```

---

## Fallback Customization

### Use Built-in Fallbacks
```tsx
import { ErrorFallback, Design3DError } from '@/components/fallbacks';

<ErrorBoundary fallback={<ErrorFallback />}>
<ThreeDErrorBoundary fallback={<Design3DError />}>
```

### Create Custom Fallback
```tsx
const MyCustomFallback = ({ error, resetErrorBoundary }) => (
  <div>
    <h1>Oops!</h1>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </div>
);

<ErrorBoundary fallback={<MyCustomFallback />}>
```

---

## Error Logging

### Automatic Logging
All errors caught by boundaries are automatically logged to:
- Backend: `POST /api/v1/errors/log`
- Browser console (development)
- Local queue (if offline)

### Manual Logging
```tsx
import { logErrorToBackend } from '@/services/errorLogging';

try {
  riskyOperation();
} catch (error) {
  logErrorToBackend({
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context: 'MANUAL_LOG',
    dealId: currentDeal.id,
  });
}
```

---

## Best Practices

### ✅ DO
- Wrap pages with error boundaries
- Use specialized boundaries for 3D/API/Forms
- Provide meaningful context in props
- Test error scenarios during development
- Monitor error logs in production

### ❌ DON'T
- Wrap every single component (too granular)
- Catch errors in boundaries and re-throw
- Ignore error logs
- Skip testing error paths
- Use boundaries to hide bugs

---

## Troubleshooting

### "Error boundary not catching errors"
- ✅ Make sure component is wrapped correctly
- ✅ Error boundaries only catch render errors
- ✅ Event handler errors need try/catch

### "Errors not logging to backend"
- ✅ Check network tab for POST /api/v1/errors/log
- ✅ Verify backend server is running
- ✅ Check if errors are queued (offline mode)

### "Form data not preserved"
- ✅ Use `FormErrorBoundary` specifically
- ✅ Set `preserveFormData={true}`
- ✅ Ensure form inputs have `name` or `id` attributes

### "3D viewer still crashes"
- ✅ Wrap with `ThreeDErrorBoundary` not `ErrorBoundary`
- ✅ Check for errors outside render (in effects)
- ✅ Verify WebGL support in browser

---

## Migration Checklist

Adding error boundaries to existing code:

- [ ] Wrap main App component (✅ done)
- [ ] Wrap 3D pages (`Design3DPage.tsx` - ✅ done)
- [ ] Wrap deal forms
- [ ] Wrap property forms
- [ ] Wrap map components
- [ ] Wrap email components
- [ ] Wrap financial models
- [ ] Add error logging to API calls
- [ ] Test each boundary
- [ ] Deploy to staging
- [ ] Monitor production logs

---

## Quick Reference Card

```tsx
// IMPORTS
import { 
  ErrorBoundary,           // General
  ThreeDErrorBoundary,     // 3D/WebGL
  APIErrorBoundary,        // Network
  FormErrorBoundary,       // Forms
} from '@/components/error-boundaries';

// USAGE
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// WITH PROPS
<ErrorBoundary
  fallback={<CustomUI />}
  onError={(e, info) => console.log(e)}
  onReset={() => resetState()}
>

// SPECIALIZED
<ThreeDErrorBoundary dealId={id}>
<APIErrorBoundary context="API_NAME" onRetry={fn}>
<FormErrorBoundary formName="form-name" preserveFormData>

// MANUAL LOGGING
import { logErrorToBackend } from '@/services/errorLogging';
logErrorToBackend({ error, stack, timestamp, context });
```

---

## Support

- 📖 Full Guide: `ERROR_BOUNDARIES_GUIDE.md`
- 📋 Implementation: `ERROR_BOUNDARIES_IMPLEMENTATION.md`
- 🔧 Backend API: `backend/src/api/rest/errors.routes.ts`
- 💬 Questions? Ask in team chat

---

**That's it!** You now have production-grade error handling. 🎉

**Remember:** Error boundaries are your safety net. They catch errors gracefully, preserve user work, and help you fix bugs faster. Use them everywhere that matters.
