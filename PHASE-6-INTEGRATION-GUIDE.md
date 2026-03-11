# Phase 6: Module Integration Guide

**Goal:** Wire M01, M-PIE, M03, M08, M09 to use DealStore for unified state management and keystone cascade.

## Integration Pattern

### Before (Per-Module State):
```typescript
// Module maintains its own state
const [unitMix, setUnitMix] = useState([]);
const [selectedPath, setSelectedPath] = useState(null);

// Changes don't propagate to other modules
const handleUpdate = (newMix) => {
  setUnitMix(newMix);
  // Other modules don't know about this change!
};
```

### After (DealStore Integration):
```typescript
import { useUnitMix } from '@/hooks/useDealContext';

// Module reads from DealStore
const { unitMix, overrideUnit, clearOverrides } = useUnitMix();

// Changes propagate automatically via cascade
const handleUpdate = (rowId, overrides) => {
  overrideUnit(rowId, overrides);
  // → resolvedUnitMix updates
  // → financial module sees change and recomputes
  // → strategy module sees financial change
  // → JEDI score updates
  // All automatic!
};
```

## Available Hooks

Created in `frontend/src/hooks/useDealContext.ts`:

1. **useUnitMix()** - For M-PIE (unit mix editor)
   - Returns: `{ unitMix, totalUnits, overrideUnit, clearOverrides }`
   
2. **useDevelopmentPaths()** - For M03 (development capacity)
   - Returns: `{ paths, selectedPath, selectPath, addPath, updatePath }`
   - **KEY:** `selectPath()` triggers the keystone cascade
   
3. **useFinancial()** - For M09 (proforma)
   - Returns: `{ assumptions, projections, returns, updateAssumption }`
   
4. **useStrategy()** - For M08 (strategy arbitrage)
   - Returns: `{ strategies, recommendedStrategy, scores }`
   
5. **usePropertyDetails()** - For M01 (overview)
   - Returns: `{ property, location, existing, totalUnits, avgRent }`
   
6. **useJEDIScore()** - For M01/M25 (JEDI score)
   - Returns: `{ score, breakdown, signals, verdict }`

## Integration Checklist (Per Module)

### Step 1: Import Hook
```typescript
import { useUnitMix } from '@/hooks/useDealContext';
```

### Step 2: Replace Local State
```typescript
// OLD:
// const [data, setData] = useState([]);

// NEW:
const { unitMix, overrideUnit } = useUnitMix();
```

### Step 3: Replace State Updates
```typescript
// OLD:
// setData(newData);

// NEW:
overrideUnit(rowId, { count: 50, targetRent: 2500 });
```

### Step 4: Remove Mock Data
```typescript
// DELETE:
// import { mockUnitMix } from '@/data/mockData';

// USE:
// Data comes from DealStore (hydrated from backend)
```

### Step 5: Handle Loading State
```typescript
const { unitMix, isLoading } = useUnitMix();

if (isLoading) {
  return <LoadingSpinner />;
}
```

## Module Priority Order

Based on complexity and dependencies:

1. **M-PIE (UnitMixIntelligence)** - Start here
   - Smallest data surface (just unit mix)
   - Uses `useUnitMix()` hook
   - Test: Edit unit → verify cascade to financial
   
2. **M09 (ProFormaIntelligence)** - Second
   - Depends on unit mix (from M-PIE)
   - Uses `useFinancial()` hook
   - Test: Change assumption → verify it persists
   
3. **M08 (StrategySection)** - Third
   - Depends on financial (from M09)
   - Uses `useStrategy()` hook
   - Test: Select strategy → verify JEDI score updates
   
4. **M03 (DevelopmentPaths)** - Fourth
   - **Critical:** Path selection triggers keystone cascade
   - Uses `useDevelopmentPaths()` hook
   - Test: Select path → verify M-PIE, M09, M08 all update
   
5. **M01 (OverviewSection)** - Last
   - Reads from everything (dashboard view)
   - Uses `usePropertyDetails()` + `useJEDIScore()`
   - Test: Verify it displays data from other modules

## Key Integration Points

### Path Selection (Keystone Cascade)

This is the most important integration:

```typescript
const { paths, selectedPath, selectPath } = useDevelopmentPaths();

// When user clicks a path card:
<PathCard 
  onClick={() => selectPath(path.id)}
  isSelected={selectedPath?.id === path.id}
/>

// This triggers:
// 1. resolvedUnitMix updates (base program from path + user overrides)
// 2. M-PIE sees new unit mix
// 3. M09 recomputes NOI/IRR from new unit mix
// 4. M08 recalculates strategy scores
// 5. M01 updates JEDI score
```

### Unit Mix Override

```typescript
const { unitMix, overrideUnit } = useUnitMix();

// In M-PIE edit handler:
const handleCellEdit = (rowId: string, field: keyof UnitMixRow, value: any) => {
  overrideUnit(rowId, { [field]: value });
  // Cascade triggers automatically
};
```

### Financial Assumption Update

```typescript
const { assumptions, updateAssumption } = useFinancial();

// In M09 assumption editor:
const handleAssumptionChange = (key: string, value: number) => {
  updateAssumption(key, value);
  // Marks financial as stale → backend recomputes on next access
};
```

## Testing the Cascade

After each module integration, test the cascade:

```typescript
// 1. Load deal
const { fetchContext } = useDealContextFull();
await fetchContext(dealId);

// 2. Select a development path
const { selectPath } = useDevelopmentPaths();
selectPath('path-abc-123');

// 3. Verify all modules updated
const { unitMix } = useUnitMix();
const { projections } = useFinancial();
const { recommendedStrategy } = useStrategy();
const { score } = useJEDIScore();

// All should reflect the new path!
```

## Migration Strategy

### Conservative Approach (Recommended):
1. Keep existing code working
2. Add DealStore integration alongside
3. Use feature flag to toggle between old/new
4. Test new integration thoroughly
5. Remove old code once stable

### Example:
```typescript
const USE_DEAL_STORE = true; // Feature flag

if (USE_DEAL_STORE) {
  const { unitMix } = useUnitMix();
  // New DealStore integration
} else {
  const [unitMix, setUnitMix] = useState(mockData);
  // Old local state (fallback)
}
```

## File Structure

```
frontend/src/
├── stores/
│   ├── dealStore.ts              # Main Zustand store
│   └── dealContext.types.ts      # TypeScript types
├── hooks/
│   └── useDealContext.ts         # Convenience hooks (NEW)
├── components/deal/sections/
│   ├── UnitMixIntelligence.tsx   # M-PIE (integrate first)
│   ├── ProFormaIntelligence.tsx  # M09 (integrate second)
│   ├── StrategySection.tsx       # M08 (integrate third)
│   ├── [M03Component].tsx        # M03 (integrate fourth)
│   └── OverviewSection.tsx       # M01 (integrate last)
```

## Next Steps

1. ✅ Create convenience hooks (`useDealContext.ts`)
2. ⏳ Integrate M-PIE (UnitMixIntelligence)
3. ⏳ Integrate M09 (ProFormaIntelligence)
4. ⏳ Integrate M08 (StrategySection)
5. ⏳ Integrate M03 (Development paths)
6. ⏳ Integrate M01 (OverviewSection)
7. ⏳ Test keystone cascade end-to-end
8. ⏳ Remove mock data imports

**Estimated effort:** ~300-500 lines of changes across 5-6 modules

---

Ready to begin? Start with M-PIE (UnitMixIntelligence.tsx) - smallest surface area, clearest data dependency.
