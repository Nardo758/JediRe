# Development Program Builder — Real Data Integration (Session 7, Phase 3, Tasks 3.3–3.4)

## Overview

The **DevelopmentProgramBuilder** component now accepts real zoning and market demand data from the API, with intelligent fallback to hardcoded defaults if APIs are unavailable.

## Data Flow Architecture

```
┌─────────────────────────┐
│   UnitMixRouter         │
│  (M03 Component Router)  │
└────────────┬────────────┘
             │
             ├─ useDevelopmentProgramData()
             │  (Custom Hook)
             │
             ├─ Fetches M02/M03 Zoning Data
             │  GET /api/v1/deals/{dealId}/zoning-output
             │
             ├─ Fetches M05/M06 Demand Data
             │  GET /api/v1/trade-areas/{tradeAreaId}/demand-signals
             │  (Fallback: /api/v1/deals/{dealId}/demand-signals)
             │
             └─ Passes to DevelopmentProgramBuilder
                as zoning & demand props
                (with fallback defaults)
```

## Component Changes

### 1. **DevelopmentProgramBuilder.jsx** — Updated Signature

```javascript
/**
 * @param {Object} zoning - Zoning constraints from M02/M03 (optional)
 * @param {Object} demand - Market demand signals from M05/M06 (optional)
 * @param {Object} deal - Deal object with metadata
 * @param {string} dealId - Deal ID for API calls
 */
export default function DevelopmentProgramBuilder({
  zoning,
  demand,
  deal,
  dealId
}) {
  // Use provided props or fallback to defaults
  const ZONING = zoning ?? DEFAULT_ZONING;
  const DEMAND = demand ?? DEFAULT_DEMAND;

  // ... rest of component
}
```

**What Changed:**
- Signature now accepts `zoning` and `demand` props
- Renamed constants to `DEFAULT_ZONING` and `DEFAULT_DEMAND`
- Component uses props if provided, falls back to defaults otherwise
- Initializes `absorptionRate` from DEMAND data: `DEMAND.absorption || 18`

### 2. **useDevelopmentProgramData Hook** — New File

Located: `frontend/src/hooks/useDevelopmentProgramData.ts`

Exports:
- `ZoningData` interface — typed structure for zoning output
- `DemandData` interface — typed structure for market demand
- `useDevelopmentProgramData(dealId?, tradeAreaId?)` hook

**Hook Behavior:**
- Fetches from M02/M03 zoning API
- Fetches from M05/M06 demand signals API
- Maps API response to component interfaces
- Returns `{ zoning, demand, loading, error, refetch }`
- **Fallback behavior**: If both APIs fail, returns DEFAULT_ZONING and DEFAULT_DEMAND

```typescript
const { zoning, demand, loading, error, refetch } = useDevelopmentProgramData(
  dealId,
  tradeAreaId
);
```

### 3. **UnitMixRouter.tsx** — Updated to Fetch Data

The router now:
1. Calls `useDevelopmentProgramData()` hook
2. Fetches zoning + demand data on mount
3. Passes fetched data as props to DevelopmentProgramBuilder
4. Shows loading state while data is being fetched
5. Automatically refetches when dealId or tradeAreaId changes

```typescript
// Fetch zoning and demand data for development mode
const { zoning, demand, loading: dataLoading } = useDevelopmentProgramData(
  dealId || deal?.id,
  deal?.tradeAreaId
);

// ... then pass to DevelopmentProgramBuilder:
<DevelopmentProgramBuilder
  deal={deal}
  dealId={dealId || deal?.id}
  zoning={zoning}
  demand={demand}
/>
```

## API Endpoints

### M02/M03 Zoning Output

**Endpoint:** `/api/v1/deals/{dealId}/zoning-output`

**Response Structure:**
```json
{
  "data": {
    "code": "PD-MF",
    "maxDensity": 24,
    "lotAcres": 12.4,
    "maxHeight": 65,
    "stories": 4,
    "far": 2.0,
    "lotSF": 540144,
    "setbackSF": 48600,
    "buildableSF": 491544,
    "maxUnitsByDensity": 298,
    "maxUnitsByFAR": 312,
    "maxUnitsByHeight": 320,
    "bindingConstraint": "density",
    "maxUnits": 298,
    "parkingRatio": 1.5,
    "parkingSpaces": 447
  }
}
```

### M05/M06 Demand Signals

**Endpoint:** `/api/v1/trade-areas/{tradeAreaId}/demand-signals`

**Fallback Endpoint:** `/api/v1/deals/{dealId}/demand-signals`

**Response Structure:**
```json
{
  "data": {
    "optimalMix": {
      "studio": 5,
      "1br": 35,
      "2br": 45,
      "3br": 15
    },
    "avgRents": {
      "studio": 1350,
      "1br": 1575,
      "2br": 1925,
      "3br": 2280
    },
    "avgSF": {
      "studio": 520,
      "1br": 750,
      "2br": 1050,
      "3br": 1300
    },
    "rentGrowth": 3.2,
    "vacancy": 5.8,
    "absorption": 18,
    "submarketRank": "78th percentile",
    "pipelineRatio": 4.2
  }
}
```

## Usage in UnitMixRouter

```typescript
import useDevelopmentProgramData from '../../../hooks/useDevelopmentProgramData';

export const UnitMixRouter: React.FC<UnitMixRouterProps> = ({ deal, dealId }) => {
  // ... existing code ...

  // Fetch real data
  const { zoning, demand, loading: dataLoading } = useDevelopmentProgramData(
    dealId || deal?.id,
    deal?.tradeAreaId
  );

  // When rendering DevelopmentProgramBuilder:
  if (mode === 'designer') {
    return (
      <div className="space-y-4">
        {dataLoading && <LoadingFallback />}
        {!dataLoading && (
          <Suspense fallback={<LoadingFallback />}>
            <DevelopmentProgramBuilder
              deal={deal}
              dealId={dealId || deal?.id}
              zoning={zoning}
              demand={demand}
            />
          </Suspense>
        )}
      </div>
    );
  }
};
```

## Fallback Behavior

### If APIs are Unavailable

The hook automatically returns DEFAULT_ZONING and DEFAULT_DEMAND:

```typescript
// These values are used if API calls fail
const DEFAULT_ZONING = {
  code: "PD-MF",
  maxDensity: 24,
  // ... rest of defaults
};

const DEFAULT_DEMAND = {
  optimalMix: { studio: 5, "1br": 35, "2br": 45, "3br": 15 },
  // ... rest of defaults
};
```

### If dealId/tradeAreaId are Missing

If neither dealId nor tradeAreaId are provided:
- Hook immediately returns defaults without API calls
- `loading` state is `false`
- No errors logged

## Component Props Interface

```typescript
interface DevelopmentProgramBuilderProps {
  zoning?: ZoningData;      // M02/M03 zoning constraints
  demand?: DemandData;      // M05/M06 market demand
  deal?: any;               // Deal object metadata
  dealId?: string;          // Deal ID for API calls
}
```

## Testing Checklist

- [ ] **Development deal renders:** Shows DevelopmentProgramBuilder with real zoning data
- [ ] **Zoning data loads:** maxUnits and other constraints appear in UI
- [ ] **Demand data loads:** avgRents and optimalMix inform unit type suggestions
- [ ] **Fallback works:** If APIs fail, defaults used and component still renders
- [ ] **Loading state:** Shows "Loading..." while fetching data
- [ ] **Error handling:** Console logs errors but doesn't crash
- [ ] **Refetch works:** Call `refetch()` to reload data manually
- [ ] **Data persists:** Changes to unit mix don't revert when data loads
- [ ] **Redevelopment mode:** Both analyzer and designer receive correct data
- [ ] **No dealId scenario:** Component works with defaults when dealId not provided

## Troubleshooting

### Problem: "Cannot find module 'useDevelopmentProgramData'"
**Solution:** Ensure hook is at `frontend/src/hooks/useDevelopmentProgramData.ts`. Check path in UnitMixRouter import.

### Problem: Zoning data not appearing in UI
**Solution:**
1. Check API endpoint returns data in expected structure
2. Verify dealId is being passed to hook
3. Check browser console for API errors
4. Fallback defaults should still render

### Problem: Demand data shows percentile instead of rent values
**Solution:** API response may have different field names. Update hook's mapping logic in `demandPromise.then()` block.

### Problem: Absorption rate stays at default (18)
**Solution:** Check API includes `absorption` field in response. Component initializes from `DEMAND.absorption || 18`.

## Future Enhancements

1. **Caching:** Cache zoning/demand data in localStorage to reduce API calls
2. **Polling:** Auto-refresh data every 5 minutes if deal is in progress
3. **Conflict Resolution:** Warn user if M05/M06 data changed since last load
4. **AI Suggestions:** Use ML to suggest optimal unit mix based on zoning + demand
5. **Scenario Modeling:** Save/load multiple design scenarios per deal
6. **Real-time Collaboration:** WebSocket updates when other users modify zoning/demand

## Files Modified

1. **development-program-builder.jsx**
   - Updated component signature
   - Renamed ZONING → DEFAULT_ZONING
   - Renamed DEMAND → DEFAULT_DEMAND
   - Accept zoning/demand props

2. **UnitMixRouter.tsx** (Session 6, updated for Session 7)
   - Import useDevelopmentProgramData hook
   - Call hook to fetch data
   - Pass zoning/demand props to DevelopmentProgramBuilder
   - Show loading state while fetching

3. **NEW: useDevelopmentProgramData.ts** (new hook)
   - Fetch M02/M03 zoning data
   - Fetch M05/M06 demand data
   - Typed interfaces for both
   - Fallback to defaults
   - Error handling + refetch capability

## References

- **Zoning Output (M02/M03):** `deal-type-visibility.ts` — describes zoning structure
- **Market Analysis (M05/M06):** No specific schema file yet; API contract defined in hook
- **UnitMixRouter:** `frontend/src/components/deal/sections/UnitMixRouter.tsx`
- **DevelopmentProgramBuilder:** `development-program-builder.jsx`
- **Hook:** `frontend/src/hooks/useDevelopmentProgramData.ts`
