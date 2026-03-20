# Data Integrity Plan - JediRE Platform

## Problem Statement
Data inconsistencies across modules caused by:
1. Bad data entry (latitude stored as acres)
2. Failed address parsing (city contains state+zip)
3. Municipal API data not connected to properties table
4. No validation on save
5. Modules computing own values instead of reading canonical source

---

## Phase 1: Immediate Fixes (Today)
**Goal:** Fix Atlanta deal, establish baseline

### 1.1 Fix Atlanta Deal Data
```sql
-- Run in Replit database console
UPDATE deals SET acres = 4.81 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';

UPDATE properties SET 
  city = 'Atlanta',
  state = 'GA', 
  zip_code = '30324',
  lat = 33.7896,
  lng = -84.3658,
  lot_size_acres = 4.81,
  zoning_code = 'MRC-2-C',
  parcel_id = '17-0087-001'
WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

### 1.2 Audit All Deals
Create script to detect bad data across all 20 deals:
- Acres > 100 (likely coordinates)
- City contains "Georgia" or zip codes
- Missing lat/lng
- Missing zoning_code
- Mismatches between deal.targetUnits and zoning max

---

## Phase 2: Validation Layer (This Week)
**Goal:** Prevent bad data from entering the system

### 2.1 Backend Validation Service
```typescript
// backend/src/services/data-validation.service.ts

export function validateDealData(deal: DealInput): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Acres sanity check
  if (deal.acres && deal.acres > 100) {
    errors.push({
      field: 'acres',
      message: 'Acres value looks like a coordinate (> 100). Please enter lot size in acres.',
      severity: 'critical'
    });
  }
  
  // Address parsing validation
  if (deal.city && /\d{5}/.test(deal.city)) {
    errors.push({
      field: 'city',
      message: 'City field contains a zip code. Please check address parsing.',
      severity: 'warning'
    });
  }
  
  return { isValid: errors.length === 0, errors };
}
```

### 2.2 Frontend Validation
- Add validation to deal creation form
- Show warnings before save
- Highlight suspicious values in red

---

## Phase 3: Municipal API Integration (This Week)
**Goal:** Auto-populate from authoritative sources

### 3.1 Data Flow
```
User enters address
        ↓
Geocode → Get lat/lng
        ↓
Parcel Lookup → Get parcel ID, lot size
        ↓
Zoning Lookup → Get zoning code, FAR, max units
        ↓
Auto-populate properties table
        ↓
User can override if needed
```

### 3.2 Implementation
```typescript
// backend/src/services/municipal-data.service.ts

export async function enrichPropertyFromAddress(address: string): Promise<PropertyData> {
  // 1. Geocode
  const coords = await geocodeAddress(address);
  
  // 2. Get parcel data from county API
  const parcel = await lookupParcel(coords.lat, coords.lng);
  
  // 3. Get zoning data
  const zoning = await lookupZoning(parcel.parcelId);
  
  return {
    lat: coords.lat,
    lng: coords.lng,
    city: coords.city,
    state: coords.state,
    zipCode: coords.zip,
    parcelId: parcel.parcelId,
    lotSizeAcres: parcel.acres,
    zoningCode: zoning.code,
    maxFar: zoning.far,
    maxStories: zoning.maxStories,
    maxUnits: Math.floor(parcel.acres * zoning.maxDensity)
  };
}
```

---

## Phase 4: Canonical Data Layer (Done ✓)
**Goal:** Single source of truth for all modules

Already implemented:
- `canonicalDealData.ts` - Data structures
- `DealModuleContext` - Provides `siteData`, `dealInputs`, `canonicalData`
- Modules read from context, not compute own values

### 4.1 Remaining Work
Wire zoning module to update canonical data:
```typescript
// When zoning module loads municipal data:
const { updateSiteData } = useDealModule();

useEffect(() => {
  if (zoningApiResponse) {
    updateSiteData({
      zoningCode: zoningApiResponse.zoning_code,
      maxFar: zoningApiResponse.far,
      maxStories: zoningApiResponse.max_stories,
      lotSizeAcres: zoningApiResponse.lot_acres,
      source: 'municipal_api',
      confidence: 95
    });
  }
}, [zoningApiResponse]);
```

---

## Phase 5: Cross-Module Propagation (Next Week)
**Goal:** When one module updates data, all modules see it

### 5.1 Event System
```typescript
// When zoning changes:
emitEvent({
  type: 'site-data-updated',
  source: 'zoning-module',
  payload: { maxUnits: 313, zoningCode: 'MRC-2-C' }
});

// Financial module listens:
useEffect(() => {
  if (lastEvent?.type === 'site-data-updated') {
    // Recalculate TDC, density metrics, etc.
    recalculateFinancials(lastEvent.payload);
  }
}, [lastEvent]);
```

### 5.2 Audit Trail
Log all data changes for debugging:
```typescript
// backend/src/services/audit-log.service.ts
export async function logDataChange(params: {
  dealId: string;
  field: string;
  oldValue: any;
  newValue: any;
  source: 'user' | 'municipal_api' | 'validation_fix';
  changedBy: string;
}) {
  await query(`
    INSERT INTO data_audit_log (deal_id, field, old_value, new_value, source, changed_by)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [params.dealId, params.field, params.oldValue, params.newValue, params.source, params.changedBy]);
}
```

---

## Implementation Timeline

| Phase | Task | Priority | Time |
|-------|------|----------|------|
| 1.1 | Fix Atlanta deal SQL | 🔴 Critical | 5 min |
| 1.2 | Audit all deals script | 🔴 Critical | 30 min |
| 2.1 | Backend validation service | 🟡 High | 2 hrs |
| 2.2 | Frontend validation | 🟡 High | 2 hrs |
| 3.1 | Municipal API integration | 🟡 High | 4 hrs |
| 4.1 | Wire zoning to canonical | 🟢 Medium | 1 hr |
| 5.1 | Event propagation system | 🟢 Medium | 3 hrs |
| 5.2 | Audit trail logging | 🟢 Medium | 2 hrs |

**Total estimated time:** ~15 hours

---

## Success Criteria

✅ No acres values > 100 in database  
✅ All properties have lat/lng  
✅ All properties have zoning_code  
✅ City/state/zip parsed correctly  
✅ Modules show consistent data  
✅ Changes in one module propagate to others  
✅ Validation prevents bad data entry  
✅ Audit log tracks all changes  

---

## Next Steps

1. **Run the Atlanta fix SQL** (5 min)
2. **Create audit script** to check all 20 deals
3. **Prioritize:** Fix data first, then add validation to prevent recurrence
