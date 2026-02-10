# CreateDealModal - Developer Migration Guide

## Overview
This guide helps developers understand the internal changes to `CreateDealModal.tsx` and how to work with the new implementation.

---

## Breaking Changes
**None.** The component interface is unchanged:
```typescript
interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated?: (deal: any) => void;
}
```

---

## Step Constants Changes

### Before
```typescript
const STEPS = {
  CATEGORY: 1,
  TYPE: 2,
  ADDRESS: 3,
  TRADE_AREA: 4,
  BOUNDARY: 5,
  DETAILS: 6,
} as const;
```

### After
```typescript
const STEPS = {
  SETUP: 1,           // Category + Type + Address
  LOCATION: 2,        // Trade Area (optional) + Boundary (optional)
  DETAILS: 3,         // Name, description, tier
} as const;
```

**Impact:** If you reference step numbers externally (you shouldn't), they've changed.

---

## New State Variables

### Added
```typescript
// Location step sub-state management
const [showTradeArea, setShowTradeArea] = useState(true);
const [showBoundary, setShowBoundary] = useState(false);
```

**Purpose:** Manage sub-steps within the Location step without full step transitions.

**Usage:**
- `showTradeArea=true, showBoundary=false` → Show trade area panel
- `showTradeArea=false, showBoundary=true` → Show boundary drawing UI

---

## New Handler Functions

### 1. `handleSkipTradeArea()`
```typescript
const handleSkipTradeArea = () => {
  setTradeAreaId(null);
  if (developmentType === 'new') {
    setShowTradeArea(false);
    setShowBoundary(true);
  } else {
    setCurrentStep(STEPS.DETAILS);
  }
};
```

**What it does:**
- Clears trade area ID
- For new developments: moves to boundary sub-step
- For existing properties: skips entire location step

### 2. `handleSkipBoundary()`
```typescript
const handleSkipBoundary = () => {
  setBoundary({
    type: 'Point',
    coordinates: coordinates!,
  });
  setCurrentStep(STEPS.DETAILS);
};
```

**What it does:**
- Creates Point geometry from address coordinates
- Advances to Details step

### 3. Updated `handleBack()`
```typescript
const handleBack = () => {
  setError(null);
  if (currentStep === STEPS.LOCATION && showBoundary) {
    // Go back to trade area within location step
    setShowBoundary(false);
    setShowTradeArea(true);
    clearDrawing();
  } else {
    setCurrentStep((prev) => prev - 1);
    if (currentStep === STEPS.LOCATION) {
      setShowTradeArea(true);
      setShowBoundary(false);
    }
  }
};
```

**What changed:**
- Now handles sub-step navigation within Location step
- Clears drawing state when backing out of boundary

---

## Conditional Rendering Changes

### Step 1: Setup (Combined)
**Old:** Three separate render blocks for category, type, address  
**New:** One block with progressive reveal

```typescript
{currentStep === STEPS.SETUP && (
  <div className="space-y-6">
    {/* Category - always shown */}
    <div>...</div>
    
    {/* Type - shown after category selected */}
    {dealCategory && (
      <div className="animate-fadeIn">...</div>
    )}
    
    {/* Address - shown after type selected */}
    {dealCategory && developmentType && (
      <div className="animate-fadeIn">...</div>
    )}
  </div>
)}
```

**Key:** Progressive reveal keeps UI clean and focused.

### Step 2: Location (Conditional Sub-steps)
```typescript
{currentStep === STEPS.LOCATION && coordinates && (
  <div>
    {/* Trade area sub-step */}
    {showTradeArea && (
      <div>
        <TradeAreaDefinitionPanel ... />
        <Button onClick={handleSkipTradeArea}>
          ⏭️ Skip - System will define later
        </Button>
      </div>
    )}
    
    {/* Boundary sub-step (new dev only) */}
    {showBoundary && developmentType === 'new' && (
      <div>
        {/* Drawing UI */}
        <Button onClick={handleSkipBoundary}>
          ⏭️ Skip - Use point location
        </Button>
      </div>
    )}
  </div>
)}
```

**Key:** Sub-step state controls which panel is visible.

---

## Auto-advance Logic

### Address Selection Auto-advance
```typescript
onChange={(value, coords) => {
  setAddress(value);
  if (coords) {
    setCoordinates(coords);
    // ... submarket lookup ...
    
    // Auto-advance to location step
    setCurrentStep(STEPS.LOCATION);
    setShowTradeArea(true);
    setShowBoundary(false);
  }
}}
```

**Why:** Reduces clicks when user selects from Google Places dropdown.

### Trade Area Save Auto-advance
```typescript
onSave={(id) => {
  setTradeAreaId(id);
  if (developmentType === 'new') {
    setShowTradeArea(false);
    setShowBoundary(true);
  } else {
    setCurrentStep(STEPS.DETAILS);
  }
}}
```

**Why:** Intelligently routes based on development type.

---

## Drawing Mode Changes

### Trigger Condition
**Before:**
```typescript
if (currentStep === STEPS.BOUNDARY && developmentType === 'new')
```

**After:**
```typescript
if (currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new')
```

**Why:** Boundary is now a sub-step within Location.

### Minimize Condition
**Before:**
```typescript
const isDrawingMode = currentStep === STEPS.BOUNDARY && developmentType === 'new';
```

**After:**
```typescript
const isDrawingMode = currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new';
```

**Why:** Same as above - condition updated for new step structure.

---

## Footer Button Logic

### Button Visibility Changes

**Setup Step:**
```typescript
{currentStep === STEPS.SETUP && address.trim() && !coordinates && (
  <Button onClick={handleGeocodeAddress} disabled={isLoading}>
    Locate on Map →
  </Button>
)}
```

**Location Step (Boundary Sub-step):**
```typescript
{currentStep === STEPS.LOCATION && 
 showBoundary && 
 developmentType === 'new' && 
 boundary && 
 boundary.type !== 'Point' && (
  <Button onClick={() => setCurrentStep(STEPS.DETAILS)} disabled={isLoading}>
    Continue →
  </Button>
)}
```

**Details Step:**
```typescript
{currentStep === STEPS.DETAILS && (
  <Button onClick={handleSubmit} disabled={isLoading}>
    {isLoading ? 'Creating...' : 'Create Deal'}
  </Button>
)}
```

---

## CSS Changes

### New Animation Class
```typescript
className="animate-fadeIn"
```

**Note:** Ensure this class exists in your Tailwind config or global CSS:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

## Data Flow Changes

### Boundary Setting Logic

**For Existing Properties:**
```typescript
// Set immediately on address selection
if (developmentType === 'existing') {
  setBoundary({ type: 'Point', coordinates: coords });
}
```

**For New Developments:**
```typescript
// User can draw OR skip
if (userSkips) {
  setBoundary({ type: 'Point', coordinates: coordinates });
} else {
  // Use drawnGeometry from map
  setBoundary(drawnGeometry);
}
```

---

## TradeAreaDefinitionPanel Integration

### Props Passed
```typescript
<TradeAreaDefinitionPanel
  propertyLat={coordinates[1]}
  propertyLng={coordinates[0]}
  onSave={(id) => { /* ... */ }}
  onSkip={handleSkipTradeArea}  // NEW!
  onCustomDraw={() => {         // UPDATED!
    setShowTradeArea(false);
    setShowBoundary(true);
  }}
/>
```

**Note:** Ensure `TradeAreaDefinitionPanel` accepts `onSkip` prop. If not, add it:
```typescript
interface TradeAreaDefinitionPanelProps {
  // ... existing props ...
  onSkip?: () => void;  // Add this
}

// In component:
{onSkip && (
  <Button onClick={onSkip}>Skip</Button>
)}
```

---

## Testing Considerations

### Unit Test Updates Needed

**Old test structure:**
```typescript
it('advances through 6 steps', () => {
  // ... test for 6 steps
});
```

**New test structure:**
```typescript
it('advances through 3 steps', () => {
  // ... test for 3 steps with sub-steps
});

it('skips optional steps correctly', () => {
  // ... test skip logic
});
```

### E2E Test Updates

**Old selectors:**
```typescript
cy.get('[data-step="category"]').click();
cy.get('[data-step="type"]').click();
// ... etc
```

**New selectors:**
```typescript
cy.get('[data-category="portfolio"]').click();
cy.get('[data-type="existing"]').within(() => {
  // Both on same screen now
});
cy.get('[data-action="skip-trade-area"]').click();
```

---

## Integration Points

### Other Components That May Be Affected

1. **DashboardMap.tsx**
   - Drawing mode activation unchanged
   - Still uses `useMapDrawingStore`

2. **DealsList.tsx**
   - Deal creation callback unchanged
   - No changes needed

3. **TradeAreaDefinitionPanel.tsx**
   - May need `onSkip` prop added
   - Otherwise unchanged

4. **Deal stores**
   - `useDealStore` - unchanged
   - `useMapDrawingStore` - unchanged

---

## Debugging Tips

### Console Logs Added
```typescript
console.log('[CreateDeal] Starting drawing mode');
console.log('[CreateDeal] Boundary drawn:', drawnGeometry);
```

**Remove these in production or wrap in:**
```typescript
if (import.meta.env.DEV) {
  console.log('[CreateDeal] ...');
}
```

### State Debugging
Add this temporarily to debug state issues:
```typescript
useEffect(() => {
  console.log('Modal state:', {
    currentStep,
    showTradeArea,
    showBoundary,
    dealCategory,
    developmentType,
    coordinates,
    boundary,
  });
}, [currentStep, showTradeArea, showBoundary, dealCategory, 
    developmentType, coordinates, boundary]);
```

---

## Performance Optimizations

### Potential Improvements
```typescript
// Memoize handlers
const handleSkipTradeArea = useCallback(() => {
  // ... logic
}, [developmentType]);

// Memoize expensive computations
const isDrawingMode = useMemo(() => 
  currentStep === STEPS.LOCATION && 
  showBoundary && 
  developmentType === 'new',
  [currentStep, showBoundary, developmentType]
);
```

**Note:** Only add if performance testing shows benefit.

---

## Rollback Plan

### If Issues Arise
1. Git revert to previous commit
2. Original file is preserved in git history
3. No database migrations involved
4. No API changes to rollback

### Quick Rollback Command
```bash
git log --oneline  # Find commit hash
git revert <commit-hash>
git push origin main
```

---

## Future Enhancement Ideas

### 1. Keyboard Shortcuts
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      // Advance to next step
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentStep]);
```

### 2. Save Draft
```typescript
// Persist to localStorage
useEffect(() => {
  if (isOpen) {
    localStorage.setItem('deal-draft', JSON.stringify({
      dealCategory, developmentType, address, // ...
    }));
  }
}, [dealCategory, developmentType, address]);
```

### 3. Step Validation
```typescript
const canAdvanceToLocation = useMemo(() => 
  dealCategory && developmentType && address && coordinates,
  [dealCategory, developmentType, address, coordinates]
);
```

---

## Common Issues & Solutions

### Issue 1: Address doesn't auto-advance
**Cause:** GooglePlacesInput not passing coordinates  
**Fix:** Check `onChange` callback receives `coords` parameter

### Issue 2: Drawing mode doesn't activate
**Cause:** Condition not met for `startDrawing`  
**Fix:** Verify `currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new'`

### Issue 3: Back button doesn't work from boundary
**Cause:** Sub-step logic not handling properly  
**Fix:** Ensure `handleBack` checks `showBoundary` state

### Issue 4: Skip buttons don't advance
**Cause:** Handler not setting next step  
**Fix:** Verify handlers update both state flags and step number

---

## Code Review Checklist

- [ ] All step constants updated
- [ ] Progress bar shows 3 steps
- [ ] Skip handlers implemented
- [ ] Auto-advance works on address select
- [ ] Back button handles sub-steps
- [ ] Drawing mode condition updated
- [ ] Footer buttons conditionally render
- [ ] State cleanup on close
- [ ] No console errors
- [ ] TypeScript compiles without warnings
- [ ] ESLint passes
- [ ] Tests updated (if applicable)

---

## Questions?

**Internal docs:** `DEAL_MODAL_SIMPLIFICATION.md`  
**Testing:** `TESTING_CHECKLIST.md`  
**User-facing:** `DEAL_MODAL_QUICK_REF.md`  
**Code:** `/frontend/src/components/deal/CreateDealModal.tsx`

**Reach out:** Dev team lead or file GitHub issue

---

**Version:** 1.0  
**Last Updated:** 2024  
**Reviewed By:** [Your name]
