# Trade Area System - Integration Guide

**Status:** Phase 1 Complete (Backend + Components Built)  
**Next Step:** Integrate into Create Deal Flow

---

## What's Ready

### ✅ Backend (Complete)
- Database schema (`007_trade_areas.sql`)
- 8 REST API endpoints (`/api/v1/trade-areas/*`)
- Geographic context endpoints (`/api/v1/deals/:id/geographic-context`)
- Submarket/MSA lookup endpoints

### ✅ Frontend Components (Complete)
- `TradeAreaDefinitionPanel` - Main UI for creating trade areas
- `GeographicScopeTabs` - Reusable tab switcher (Trade Area/Submarket/MSA)
- `useTradeAreaStore` - Zustand store for state management
- Type definitions (`types/trade-area.ts`)

---

## How to Integrate

### Step 1: Add Trade Area Step to CreateDealModal

**File:** `frontend/src/components/deal/CreateDealModal.tsx`

**Current Steps:**
```
1. CATEGORY → Portfolio or Pipeline
2. TYPE → New Development or Existing Property
3. ADDRESS → Address input + geocoding
4. BOUNDARY → Draw polygon (if new development)
5. DETAILS → Name, description, tier
```

**Enhanced Flow (Add Step 4):**
```
1. CATEGORY → Portfolio or Pipeline
2. TYPE → New Development or Existing Property
3. ADDRESS → Address input + geocoding
4. TRADE_AREA → Define competitive area ⭐ NEW
5. BOUNDARY → Draw polygon (if new development)
6. DETAILS → Name, description, tier
```

**Implementation:**

```tsx
import { TradeAreaDefinitionPanel } from '../trade-area';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';

// Add to STEPS constant
const STEPS = {
  CATEGORY: 1,
  TYPE: 2,
  ADDRESS: 3,
  TRADE_AREA: 4,  // ← NEW
  BOUNDARY: 5,     // ← Shifted from 4
  DETAILS: 6,      // ← Shifted from 5
} as const;

// Add state for trade area
const [tradeAreaId, setTradeAreaId] = useState<number | null>(null);
const [submarketId, setSubmarketId] = useState<number | null>(null);
const [msaId, setMsaId] = useState<number | null>(null);

// After geocoding address (in handleGeocodeAddress), lookup submarket/MSA
const [lng, lat] = data.features[0].center;
setCoordinates([lng, lat]);

// Lookup submarket and MSA
const submarketResponse = await fetch(
  `/api/v1/submarkets/lookup?lat=${lat}&lng=${lng}`
);
const submarket = await submarketResponse.json();
setSubmarketId(submarket.data.id);
setMsaId(submarket.data.msa_id);

// Advance to trade area step
setCurrentStep(STEPS.TRADE_AREA);

// Add Step 4 rendering (Trade Area Definition)
{currentStep === STEPS.TRADE_AREA && coordinates && (
  <div className="p-6">
    <TradeAreaDefinitionPanel
      propertyLat={coordinates[1]}
      propertyLng={coordinates[0]}
      onSave={(id) => {
        setTradeAreaId(id);
        if (developmentType === 'new') {
          setCurrentStep(STEPS.BOUNDARY);
        } else {
          setCurrentStep(STEPS.DETAILS);
        }
      }}
      onSkip={() => {
        // User skipped - will use submarket default
        if (developmentType === 'new') {
          setCurrentStep(STEPS.BOUNDARY);
        } else {
          setCurrentStep(STEPS.DETAILS);
        }
      }}
    />
  </div>
)}

// In handleSubmit, link trade area to deal
await createDeal({
  name: dealName,
  description,
  tier,
  deal_category: dealCategory!,
  development_type: developmentType!,
  address,
  boundary,
});

// After deal is created, set geographic context
if (tradeAreaId || submarketId) {
  await api.post(`/deals/${dealId}/geographic-context`, {
    trade_area_id: tradeAreaId,
    submarket_id: submarketId,
    msa_id: msaId,
    active_scope: tradeAreaId ? 'trade_area' : 'submarket',
  });
}
```

---

### Step 2: Add Geographic Scope Toggle to Map Controls

**File:** `frontend/src/components/layout/MainLayout.tsx` (or wherever horizontal bar is)

```tsx
import { GeographicScopeTabs } from '../trade-area';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';

function HorizontalBar() {
  const { activeScope, setScope } = useTradeAreaStore();
  
  return (
    <div className="horizontal-bar">
      {/* Existing buttons: Search, War Maps, Custom Maps */}
      
      {/* Add geographic scope toggle */}
      <div className="ml-auto">
        <GeographicScopeTabs
          activeScope={activeScope}
          onChange={setScope}
          tradeAreaEnabled={true}  // Check if current deal has trade area
          stats={{
            trade_area: { occupancy: 94, avg_rent: 2150 },
            submarket: { occupancy: 91, avg_rent: 2080 },
            msa: { occupancy: 89, avg_rent: 1950 },
          }}
        />
      </div>
    </div>
  );
}
```

---

### Step 3: Use Active Scope in Analytics

**File:** Any analytics component (Supply Agent, Demand Agent, etc.)

```tsx
import { useTradeAreaStore } from '../../stores/tradeAreaStore';

function SupplyDashboard({ dealId }: { dealId: number }) {
  const { activeScope } = useTradeAreaStore();
  
  useEffect(() => {
    // Fetch data scoped to active geographic boundary
    const fetchData = async () => {
      const response = await api.get(`/deals/${dealId}/supply`, {
        params: { scope: activeScope }
      });
      setSupplyData(response.data);
    };
    
    fetchData();
  }, [dealId, activeScope]);
  
  return (
    <div>
      <GeographicScopeTabs
        activeScope={activeScope}
        onChange={(scope) => setScope(scope)}
        // ... stats
      />
      
      {/* Supply metrics filtered by active scope */}
    </div>
  );
}
```

---

### Step 4: Backend - Respect Active Scope

**File:** `backend/src/deals/deals.service.ts` (or any agent service)

```ts
async getSupplyData(dealId: string, scope: GeographicScope) {
  // Get the geographic boundary
  const context = await this.db.query(
    `SELECT * FROM deal_geographic_context WHERE deal_id = $1`,
    [dealId]
  );
  
  let boundary;
  if (scope === 'trade_area' && context.trade_area_id) {
    boundary = await this.db.query(
      `SELECT geometry FROM trade_areas WHERE id = $1`,
      [context.trade_area_id]
    );
  } else if (scope === 'submarket') {
    boundary = await this.db.query(
      `SELECT geometry FROM submarkets WHERE id = $1`,
      [context.submarket_id]
    );
  } else {
    boundary = await this.db.query(
      `SELECT geometry FROM msas WHERE id = $1`,
      [context.msa_id]
    );
  }
  
  // Query properties within boundary
  const properties = await this.db.query(
    `SELECT * FROM properties 
     WHERE ST_Within(location, $1)`,
    [boundary.geometry]
  );
  
  return properties;
}
```

---

## Testing Checklist

### Phase 1 Testing (Now)
- [ ] Run database migration: `psql $DATABASE_URL -f backend/migrations/007_trade_areas.sql`
- [ ] Start backend: `npm run dev`
- [ ] Test API endpoints with Postman/curl:
  - `POST /api/v1/trade-areas/radius` (create radius circle)
  - `POST /api/v1/trade-areas/preview-stats` (get stats)
  - `GET /api/v1/submarkets/lookup?lat=33.7756&lng=-84.3963`
- [ ] Verify PostGIS functions work

### Phase 2 Testing (After Integration)
- [ ] Create new deal → Trade Area step appears
- [ ] Select "Quick Radius" → Slider works, map shows circle
- [ ] Adjust radius → Circle updates in real-time
- [ ] Preview stats load → Shows population, units, rent
- [ ] Save trade area → Deal linked to trade area
- [ ] Skip trade area → Deal defaults to submarket
- [ ] GeographicScopeTabs switches between scopes
- [ ] Analytics respect active scope

---

## Future Enhancements

### Phase 2 (Month 1)
- [ ] Drive-Time Isochrone method (Mapbox API integration)
- [ ] POI proximity analysis (Google Places API)
- [ ] LocationIntelPanel component (Property detail tab)
- [ ] Trade Area Health score (Pipeline detail)

### Phase 3 (Month 2-3)
- [ ] Traffic-Informed AI method (real traffic data)
- [ ] Traffic normalization (adjust for barriers)
- [ ] Confidence scoring
- [ ] Trade Area Library (save/reuse trade areas)
- [ ] Team sharing

### Phase 4 (Month 4+)
- [ ] Trade area comparison tool
- [ ] Portfolio concentration risk analysis
- [ ] Automated comp analysis
- [ ] Real-time health monitoring

---

## Quick Start Commands

```bash
# Backend
cd /home/leon/clawd/jedire/backend
psql $DATABASE_URL -f migrations/007_trade_areas.sql
npm run dev

# Frontend
cd /home/leon/clawd/jedire/frontend
npm install @turf/circle @turf/helpers
npm run dev

# Test API
curl http://localhost:3000/api/v1/trade-areas/radius \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"lat": 33.7756, "lng": -84.3963, "miles": 3}'
```

---

## Files Changed

### Backend (5 files)
- `TRADE_AREA_SYSTEM.md` (27KB spec)
- `backend/migrations/007_trade_areas.sql` (10KB migration)
- `backend/src/api/rest/trade-areas.routes.ts` (8KB API)
- `backend/src/api/rest/geographic-context.routes.ts` (5KB API)
- `backend/src/api/rest/index.ts` (registration)

### Frontend (5 files)
- `frontend/src/types/trade-area.ts` (type definitions)
- `frontend/src/stores/tradeAreaStore.ts` (Zustand store)
- `frontend/src/components/trade-area/TradeAreaDefinitionPanel.tsx` (main UI)
- `frontend/src/components/trade-area/GeographicScopeTabs.tsx` (tab switcher)
- `frontend/src/components/trade-area/index.ts` (exports)

**Total:** 10 files, ~60KB code

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check backend logs
3. Verify PostGIS extension enabled: `SELECT PostGIS_version();`
4. Verify Mapbox token set: `process.env.VITE_MAPBOX_TOKEN`

---

**Ready to integrate!** Backend is live, components are built, just need to wire into Create Deal flow.
