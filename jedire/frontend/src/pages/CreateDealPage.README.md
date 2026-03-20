# CreateDealPage Developer Guide

## Quick Reference

**File:** `/src/pages/CreateDealPage.tsx`  
**Purpose:** Unified deal creation flow with 3D development integration  
**Last Updated:** February 21, 2025

---

## Architecture Overview

```
CreateDealPage
├─ Steps 1-8: Universal (all deals)
│  ├─ Category, Type, Property Type
│  ├─ Documents & Data Entry
│  ├─ Deal Details, Address, Trade Area
│  └─ Boundary Definition
│
└─ Steps 9-12: Development Only (conditional)
   ├─ 3D Building Design (Building3DEditor)
   ├─ Neighboring Properties (API-driven)
   ├─ Design Optimization (AI/algorithm)
   └─ Financial Pro Forma (auto-generated)
```

**Conditional Branch Point:** Step 8 (Boundary)
- `developmentType === 'new'` → Continue to Step 9
- `developmentType === 'existing'` → Submit deal immediately

---

## Key State Variables

### Core Flow State
```typescript
currentStep: number           // Current step (1-12)
dealCategory: 'portfolio' | 'pipeline'
developmentType: 'new' | 'existing'
propertyType: PropertyType
dealName: string
address: string
coordinates: [lng, lat]
boundary: GeoJSON
```

### 3D Development State
```typescript
design3D: Design3D            // From Building3DEditor
selectedNeighbors: Neighbor[] // User selections
neighboringProperties: Neighbor[] // API results
optimizedDesign: Design3D     // Post-optimization
optimizationResults: object   // Full optimization data
proForma: ProForma           // Financial model output
financialAssumptions: FinancialAssumptions
```

---

## Handler Functions Reference

### Step 9: 3D Design
```typescript
handle3DDesignComplete(designData: Design3D)
```
**Called by:** Building3DEditor onSave callback  
**Flow:** Stores design → Advances to Step 10

### Step 10: Neighbors
```typescript
loadNeighboringProperties()    // Auto-called on step entry
handleNeighborsComplete()      // User clicks "Continue"
handleSkipNeighbors()          // User clicks "Skip"
```
**API:** `GET /api/v1/properties/neighbors?lat={lat}&lng={lng}&radius={radius}`  
**Flow:** Load → Display → Select → Continue

### Step 11: Optimization
```typescript
handleOptimizeDesign()         // User clicks "Optimize"
handleAcceptOptimization()     // Accept results
handleSkipOptimization()       // Keep original
```
**Service:** `designOptimizerService.optimizeDesign()`  
**Flow:** Analyze → Show comparison → Accept/Reject

### Step 12: Financial
```typescript
useEffect(() => {
  if (currentStep === STEPS.FINANCIAL) {
    // Auto-generate pro forma
    financialAutoSync.onDesignChange(design3D);
  }
}, [currentStep, design3D]);
```
**Service:** `financialAutoSync`  
**Flow:** Auto-generate on entry → Display → Finalize

---

## Adding a New Step

### 1. Update STEPS Constant
```typescript
const STEPS = {
  // ... existing steps
  NEW_STEP: 13,
} as const;
```

### 2. Add State Variables
```typescript
const [newStepData, setNewStepData] = useState<DataType | null>(null);
```

### 3. Create Handler
```typescript
const handleNewStepComplete = () => {
  setNewStepData(data);
  setCurrentStep(STEPS.NEXT_STEP);
};
```

### 4. Add UI Component
```tsx
{currentStep === STEPS.NEW_STEP && (
  <div className="space-y-6">
    <h2>New Step Title</h2>
    {/* Your UI here */}
    <Button onClick={handleNewStepComplete}>
      Continue →
    </Button>
  </div>
)}
```

### 5. Update handleBack()
```typescript
case STEPS.NEW_STEP:
  setCurrentStep(STEPS.PREVIOUS_STEP);
  setNewStepData(null);
  break;
```

### 6. Update Progress Indicator
Adjust `totalSteps` logic if needed.

---

## Modifying Existing Steps

### Changing Validation
Find the step's handler function and update validation:
```typescript
const handleProceedFromDocuments = () => {
  if (!purchasePrice.trim()) {
    setError('Purchase Price is required'); // <-- Add/modify validation
    return;
  }
  setError(null);
  setCurrentStep(STEPS.DETAILS);
};
```

### Adding Form Fields
1. Add state variable:
   ```typescript
   const [newField, setNewField] = useState('');
   ```

2. Add input to UI:
   ```tsx
   <input
     value={newField}
     onChange={(e) => setNewField(e.target.value)}
   />
   ```

3. Include in submission payload:
   ```typescript
   const dealPayload = {
     // ... existing fields
     newField: newField,
   };
   ```

---

## API Integration Points

### 1. Property Types (Step 3)
```typescript
GET /api/v1/property-types
Response: PropertyType[]
```

### 2. Document Upload (Step 4)
```typescript
POST /api/v1/deals/upload-document
Body: FormData { file: File }
Response: { id, url }
```

### 3. Submarket Lookup (Step 6)
```typescript
GET /api/v1/submarkets/lookup?lat={lat}&lng={lng}
Response: { id, name, msa_id }
```

### 4. Neighboring Properties (Step 10)
```typescript
GET /api/v1/properties/neighbors?lat={lat}&lng={lng}&radius={radius}&limit={limit}
Response: Neighbor[]
```

### 5. Deal Creation (Final Submit)
```typescript
POST /api/v1/deals
Body: {
  // Steps 1-8 data
  name, description, deal_category, development_type, ...
  
  // Steps 9-12 data (if development)
  design3D, selectedNeighbors, optimizationResults, proForma, ...
}
Response: { id, name, ... }
```

### 6. Geographic Context (Post-creation)
```typescript
POST /api/v1/deals/{id}/geographic-context
Body: { trade_area_id, submarket_id, msa_id, active_scope }
```

---

## Error Handling Patterns

### Validation Errors
```typescript
if (!requiredField) {
  setError('Field is required');
  return; // Block navigation
}
setError(null); // Clear on success
```

### API Errors
```typescript
try {
  const response = await apiClient.get('/endpoint');
  // Handle success
} catch (err: any) {
  console.error('Operation failed:', err);
  setError(err.message || 'User-friendly message');
  // Provide fallback or skip option
}
```

### Display Errors
```tsx
{error && (
  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-sm text-red-800">{error}</p>
  </div>
)}
```

---

## Styling Guidelines

### Section Headers
```tsx
<h2 className="text-xl font-semibold text-gray-900 mb-2">
  Step Title
</h2>
<p className="text-gray-600 mb-6">
  Step description
</p>
```

### Primary Buttons
```tsx
<Button
  onClick={handleAction}
  disabled={isLoading}
  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
>
  Continue →
</Button>
```

### Secondary Buttons
```tsx
<Button
  onClick={handleSkip}
  className="bg-gray-200 hover:bg-gray-300 text-gray-700"
>
  Skip Step
</Button>
```

### Info Cards
```tsx
<div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
  <div className="text-5xl mb-3">🎯</div>
  <h3 className="text-lg font-semibold text-blue-900 mb-2">Title</h3>
  <p className="text-sm text-blue-700">Description</p>
</div>
```

### Metrics Display
```tsx
<div className="grid grid-cols-4 gap-4 text-sm">
  <div>
    <span className="font-semibold text-gray-900">Label:</span>
    <span className="ml-2 text-gray-700">{value}</span>
  </div>
</div>
```

---

## Testing Tips

### Manual Testing Checklist
```bash
# Test acquisition flow (8 steps)
1. Select Portfolio → Existing Property
2. Complete steps 1-8
3. Verify deal created without 3D data

# Test development flow (12 steps)
1. Select Pipeline → New Development
2. Complete steps 1-8
3. Complete 3D design (Step 9)
4. Select neighbors (Step 10)
5. Run optimization (Step 11)
6. Review financials (Step 12)
7. Verify deal created with full 3D data

# Test error handling
1. Try to proceed without required fields
2. Test API failures (disconnect network)
3. Test back button navigation
4. Test skip options
```

### Unit Test Example
```typescript
describe('CreateDealPage', () => {
  it('routes to Step 9 for new development', () => {
    const { result } = renderHook(() => useCreateDealFlow());
    
    act(() => {
      result.current.setDevelopmentType('new');
      result.current.handleSkipBoundary();
    });
    
    expect(result.current.currentStep).toBe(9);
  });
  
  it('submits immediately for existing properties', () => {
    // ... similar test for existing flow
  });
});
```

---

## Performance Considerations

### Heavy Components
- **Building3DEditor**: GPU-intensive, ~500KB bundle
  - Lazy load: `const Building3DEditor = lazy(() => import('@/components/design'));`
  - Unmount when not visible: `{currentStep === STEPS.DESIGN_3D && <Building3DEditor />}`

### API Optimization
- **Neighbors**: Load once on step entry, cache results
- **Optimization**: Show loading state, disable button during processing
- **Financial**: Use memoization for derived metrics

### Bundle Size
```bash
# Check bundle size
npm run build:analyze

# Optimize imports
import { Button } from '@/components/shared/Button'; // ✅ Specific import
import * as Components from '@/components'; // ❌ Avoid barrel imports
```

---

## Common Issues & Solutions

### Issue: 3D Editor Not Rendering
**Cause:** WebGL not supported or Mapbox token missing  
**Solution:** Check browser console, verify `VITE_MAPBOX_TOKEN` in `.env`

### Issue: Neighbors API Returns Empty
**Cause:** API not implemented or coordinates invalid  
**Solution:** Check API logs, verify lat/lng values, provide skip option

### Issue: Optimization Hangs
**Cause:** Complex algorithm with large input  
**Solution:** Add timeout, show progress indicator, use Web Workers

### Issue: Financial Model Shows NaN
**Cause:** Missing or invalid design3D metrics  
**Solution:** Validate design3D before passing to FinancialModelDisplay

### Issue: Deal Creation Fails
**Cause:** Backend expects different payload structure  
**Solution:** Check API logs, verify types match backend schema

---

## File Structure

```
/jedire/frontend/src/
├── pages/
│   ├── CreateDealPage.tsx           ← THIS FILE (main integration)
│   └── CreateDealPage.README.md     ← This guide
│
├── components/
│   ├── design/
│   │   └── Building3DEditor.tsx     ← Step 9 component
│   ├── financial/
│   │   └── FinancialModelDisplay.tsx ← Step 12 component
│   └── trade-area/
│       └── TradeAreaDefinitionPanel.tsx ← Step 7 component
│
├── services/
│   ├── designOptimizer.service.ts   ← Step 11 logic
│   ├── financialAutoSync.service.ts ← Step 12 auto-generation
│   └── api.client.ts                ← HTTP client
│
└── types/
    ├── design/
    │   └── design3d.types.ts        ← Design3D, BuildingSection, etc.
    └── financial.types.ts           ← ProForma, FinancialAssumptions, etc.
```

---

## Useful Commands

```bash
# Run dev server
npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Run tests
npm test -- CreateDealPage

# Check bundle size
npm run build:analyze
```

---

## Documentation Links

- **Full Flow Guide:** `/jedire/frontend/DEAL_CREATION_FLOW_GUIDE.md`
- **Integration Summary:** `/jedire/frontend/INTEGRATION_SUMMARY.md`
- **3D Editor Docs:** `/jedire/frontend/src/components/design/README.md`
- **Financial Service Docs:** `/jedire/frontend/src/services/financialAutoSync.service.ts` (inline)

---

## Contact

For questions or issues with this integration:
1. Check the comprehensive docs first (DEAL_CREATION_FLOW_GUIDE.md)
2. Review inline comments in CreateDealPage.tsx
3. Consult the development team

**Last Updated:** February 21, 2025  
**Maintained by:** JEDI RE Development Team
