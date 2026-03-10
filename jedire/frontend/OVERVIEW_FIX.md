# Overview Page Fixes

## Issue #1: Both Overview Pages Showing

### Problem
Both "Existing Deal" and "Development Deal" overview pages are rendering simultaneously, regardless of deal type selection during creation.

### Root Cause
The conditional render in `OverviewSection.tsx` line 238-242:
```tsx
{viewMode === 'existing'
  ? <ExistingOverview ... />
  : <DevOverview ... />
}
```

Should work, but `viewMode` might not be updating correctly based on deal type.

### Diagnosis Steps
1. Check if `deal.developmentType`, `deal.isDevelopment`, or `deal.projectType` are being set correctly during deal creation
2. Verify `isDev` logic on line 81-85:
```tsx
const isDev = deal?.developmentType === 'Ground-Up' ||
  deal?.developmentType === 'new' ||
  deal?.isDevelopment === true ||
  deal?.projectType === 'land';
```

### Fix Options

**Option A: Add defensive check**
```tsx
{viewMode === 'existing' && !isDev && (
  <ExistingOverview ... />
)}

{viewMode === 'development' && isDev && (
  <DevOverview ... />
)}
```

**Option B: Use deal type directly instead of viewMode state**
```tsx
{isDev 
  ? <DevOverview ... />
  : <ExistingOverview ... />
}
```

**Option C: Debug viewMode state**
Add console logging to see what's happening:
```tsx
useEffect(() => {
  console.log('Deal type check:', {
    developmentType: deal?.developmentType,
    isDevelopment: deal?.isDevelopment,
    projectType: deal?.projectType,
    isDev,
    viewMode
  });
  setViewMode(isDev ? 'development' : 'existing');
}, [isDev, deal]);
```

---

## Issue #2: Unit Program Not Flowing to Market Intelligence

### Problem
The buildable units and SF from the selected development path (P1/P2/P3) on the Overview page don't flow to the Market Intelligence page.

### Root Cause
The `DevOverview` component calculates unit mix and development paths locally, but this data isn't being persisted to the deal context or passed to `MarketIntelligenceSection`.

### Current Data Flow
1. **Overview calculates:**
   - `activePath.units` (based on selected P1/P2/P3)
   - `unitMix` (Studio, 1BR, 2BR, 3BR breakdown)
   - `avgSqft`, `avgRent`, `totalRevMo`

2. **Market Intelligence receives:**
   - `deal` object only
   - No access to `activePath` or calculated `unitMix`

### Solution: Pass Development Program via Context

**Step 1: Update DealModuleContext**
Add development program state:
```typescript
// In DealModuleContext.tsx
interface DevelopmentProgram {
  selectedPathId: string;
  units: number;
  sqft: number;
  unitMix: {
    type: string;
    units: number;
    sqft: number;
    rent: number;
  }[];
  revenue: {
    monthly: number;
    annual: number;
  };
}

// Add to context
developmentProgram: DevelopmentProgram | null;
setDevelopmentProgram: (program: DevelopmentProgram) => void;
```

**Step 2: Update DevOverview to set program**
```tsx
// In DevOverview component
const { setDevelopmentProgram } = useDealModule();

useEffect(() => {
  if (activePath && unitMix) {
    setDevelopmentProgram({
      selectedPathId: activePath.id,
      units: activePath.units,
      sqft: avgSqft * activePath.units,
      unitMix: unitMix.map(u => ({
        type: u.type,
        units: u.units,
        sqft: u.sqft,
        rent: u.targetRent,
      })),
      revenue: {
        monthly: totalRevMo,
        annual: totalRevMo * 12,
      },
    });
  }
}, [activePath, unitMix, selectedPathId]);
```

**Step 3: Update MarketIntelligenceSection to use program**
```tsx
// In MarketIntelligenceSection.tsx
const { developmentProgram } = useDealModule();

// Pass to child components
<SupplySection 
  deal={deal} 
  developmentProgram={developmentProgram}
/>

<MarketSection 
  deal={deal}
  developmentProgram={developmentProgram}
/>
```

**Step 4: Update SupplySection and MarketSection**
Use `developmentProgram.units` and `developmentProgram.sqft` for calculations instead of falling back to `deal.targetUnits`.

---

## Testing Checklist

### Issue #1 (Overview Pages)
- [ ] Create new "Existing" deal → Only ExistingOverview shows
- [ ] Create new "Development" deal → Only DevOverview shows
- [ ] Toggle between view modes → Only one shows at a time
- [ ] Refresh page → Correct overview persists

### Issue #2 (Unit Program Flow)
- [ ] Select P1 path on Overview → Units show in Market Intelligence
- [ ] Select P2 path → Market Intelligence updates to new unit count
- [ ] Select P3 path → Market Intelligence updates again
- [ ] Check Supply section uses correct buildable units
- [ ] Check Market section uses correct SF for comps
- [ ] Verify revenue calculations match overview

---

## Quick Fix Script

Run this in DevTools console to debug:
```javascript
// Check deal type
console.log('Deal:', window.__DEAL__);

// Check viewMode
const viewModeEl = document.querySelector('[class*="viewMode"]');
console.log('ViewMode element:', viewModeEl);

// Force development mode
localStorage.setItem('force-dev-view', 'true');
location.reload();
```
