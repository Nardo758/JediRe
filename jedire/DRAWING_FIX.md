# Drawing Tools Fix + Routing Fix

## Issues Identified

### Issue #1: Drawing Tools Not Activating
**Problem:** Modal should minimize to right side and activate polygon drawing, but neither happens.

**Root Causes:**
1. `isDrawingMode` check: `currentStep === STEPS.BOUNDARY && developmentType === 'new'`
   - If developmentType is not exactly 'new' string, this fails
2. useEffect dependencies might not trigger properly
3. MapboxDraw might not be initialized yet

**Fix:** Add manual button + better state management

### Issue #2: Wrong Routing After Deal Creation  
**Problem:** All deals redirect to Dashboard after creation

**Expected:**
- Pipeline deals → `/deals` (DealsPage with grid view)
- Portfolio deals → `/assets-owned` (AssetsOwnedPage)

**Fix:** Update handleDealCreated to navigate based on deal_category

---

## Fixes Applied

### 1. CreateDealModal.tsx - Add Manual Drawing Button

At BOUNDARY step, add a prominent button to manually trigger drawing:

```tsx
{developmentType === 'new' && !boundary && (
  <div className="flex justify-center mt-4">
    <button
      onClick={() => {
        console.log('[MANUAL] Starting drawing mode');
        console.log('[MANUAL] developmentType:', developmentType);
        console.log('[MANUAL] currentStep:', currentStep);
        console.log('[MANUAL] coordinates:', coordinates);
        startDrawing('boundary', coordinates || undefined);
      }}
      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
    >
      🗺️ Start Drawing Property Boundary
    </button>
  </div>
)}
```

### 2. Dashboard.tsx - Update handleDealCreated

Change from:
```tsx
const handleDealCreated = (deal: any) => {
  fetchDeals();
};
```

To:
```tsx
const handleDealCreated = (deal: any) => {
  fetchDeals();
  
  // Navigate based on deal category
  if (deal.deal_category === 'pipeline') {
    navigate('/deals'); // Pipeline grid view
  } else if (deal.deal_category === 'portfolio') {
    navigate('/assets-owned'); // Assets Owned page
  }
};
```

---

## Testing Steps

1. Create New Deal
2. Select "Add to Pipeline" (category)
3. Select "New Development" (type)
4. Enter address
5. Define trade area (or skip)
6. **At Boundary step:**
   - Check console for: `[CreateDeal] Starting drawing mode`
   - If not there, click manual "Start Drawing" button
   - Modal should slide to right
   - Map should show polygon drawing tools
7. Draw boundary, click "Continue"
8. Fill in deal details, submit
9. **Should redirect to `/deals` page** (not Dashboard)

---

## If Drawing Still Doesn't Work

**Checklist:**
1. Is Mapbox token set? (`VITE_MAPBOX_TOKEN`)
2. Is map initialized? (check for map errors)
3. Is @mapbox/mapbox-gl-draw installed?
   ```bash
   cd frontend
   npm list @mapbox/mapbox-gl-draw
   ```
4. Console errors? (F12 → Console)
5. Network errors? (F12 → Network)
