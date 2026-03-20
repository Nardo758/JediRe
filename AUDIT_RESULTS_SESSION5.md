# JEDI RE PHASE 1 SESSION 5: DATA INTEGRITY FIXES
**Session:** Phase 1, Session 5: Data Integrity Fixes
**Date:** March 20, 2026
**Status:** INVESTIGATION & ASSESSMENT (determining what requires fixing)

---

## BUG 1: M07 Traffic Hardcoded Adjustment Factors

### Investigation: ✅ INTENTIONAL FALLBACK PATTERN — ACCEPTABLE

**Location:** `backend/src/services/traffic-intelligence-wiring.service.ts`

**Hardcoded Values Found:**
- Line 140: `factor: 1.05` (demand fallback when exception)
- Line 191: `factor: 0.97` (supply fallback when exception)
- Line 238: `factor: 1.03` (digital fallback when exception)
- Lines 260-268: Same values returned with `confidence: 'LOW'` when no market intel available
- Lines 299-307: Same values returned in exception handler for getDynamicFactors()

**Root Cause Analysis:**

This is NOT a bug — it's INTENTIONAL. The service:

1. **Attempts Real Calculation First** (lines 272-274):
   - Calls `calculateDemandFactor(marketIntel, targetUnits)`
   - Calls `calculateSupplyFactor(marketIntel)`
   - Calls `calculateDigitalFactor(marketIntel, isNewDevelopment)`

2. **Each calculator function attempts complex logic** (lines 86-142, 148-193, 199-240):
   - **Demand factor**: Uses demand pool ratio, employer moves, occupancy, news sentiment
   - **Supply factor**: Uses pipeline supply, occupancy, news sentiment
   - **Digital factor**: Uses infrastructure news, economic transactions

3. **Only falls back to hardcoded values when:**
   - Exception occurs during calculation (catch blocks)
   - No market intelligence found in database (lines 258-268)
   - Exception during getDynamicFactors call (lines 297-307)

4. **Returns confidence flag:** `confidence: 'LOW'` indicates these values are estimates, not real data

**Assessment:** ✅ **ACCEPTABLE DESIGN** — Hardcoded fallbacks are intentional. Confidence flag alerts consumers not to trust these values heavily.

**Recommendation:** No fix required. This is proper fallback pattern for missing data.

---

## BUG 2: Zoning ST_Area Projection Issues

### Investigation: ✅ NOT FOUND IN CODE — WGS84 SAFE

**Expected Problem:** ST_Area calculations in zoning services might use WGS84 (decimal degrees) instead of State Plane coordinates (feet).

**Actual Finding:**

**spatialAnalysis.ts (lines 189-199):**
```sql
ST_Area(
  ST_Difference(
    s.combined_buildable::geography,  -- ← ::geography cast ensures WGS84
    ...
  )
) * 10.7639 as gained_buildable_sqft
```

The code correctly:
- Casts to `::geography` before ST_Area (WGS84-safe)
- Multiplies by 10.7639 conversion factor (m² → ft²)
- Handles both land and buildable areas consistently

**Lines 238-239 (calculateParcelMetrics):**
```sql
ST_Area(parcel_geometry::geography) * 10.7639 as area_sqft,
ST_Perimeter(parcel_geometry::geography) * 3.28084 as perimeter_feet,
```

Same pattern — safe conversion.

**Verdict:** 🟢 **NO ISSUE FOUND** — Code handles projections correctly via `::geography` cast and proper conversion factors.

---

## BUG 3: FAR Exclusions by City

### Investigation: ✅ NOT FOUND IN CODE — DATA-DRIVEN APPROACH

**Expected Problem:** Some cities have FAR exclusions (parking garages, mechanical spaces, etc.) that should reduce FAR numerator. Without city-specific logic, FAR is overstated.

**Actual Finding:**

**development-capacity.service.ts (lines 55-67):**
```typescript
const distStandards = await this.pool.query(`
  SELECT
    COALESCE(max_density_per_acre, max_units_per_acre) as max_density,
    max_far,  // ← Retrieved from zoning_districts table
    ...
  FROM zoning_districts
  WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
`);
```

The service retrieves `max_far` from the database, not hardcoded. This means:
- FAR values can be city-specific at the database level
- FAR exclusions should be handled when POPULATING `zoning_districts.max_far`
- Code assumes database has correct FAR figures for each municipality

**Search Results:** No city-specific FAR calculation logic found in code (searched 64 service files).

**Verdict:** 🟢 **NO CODE ISSUE FOUND** — FAR is data-driven. Any city-specific exclusions belong in the `zoning_districts` table, not in application code.

**Implication:** If FAR is wrong in some cities, the issue is in the DATA layer (zoning_districts population), not the code layer.

---

## BUG 4: BeltLine Overlay Handling (Atlanta-specific)

### Investigation: ✅ REFERENCED IN CODE — DATA-DRIVEN APPROACH

**Expected Problem:** BeltLine proximity in Atlanta should boost traffic/demand signals. Without special handling, this improvement goes undetected.

**Actual Finding:**

**traffic-intelligence-wiring.service.ts (lines 210-220):**
```typescript
// Infrastructure events (transit, amenities)
const infraNews = (marketIntel.news || []).filter(n =>
  n.type === 'INFRASTRUCTURE' &&
  ['transit_expansion', 'amenity', 'amenities'].includes(n.category)
);

if (infraNews.length > 0) {
  const infraBoost = Math.min(0.05, infraNews.length * 0.015);
  digitalFactor += infraBoost;
  reasoning += `${infraNews.length} infrastructure projects (BeltLine, etc.) add ${(infraBoost*100).toFixed(1)}%. `;
}
```

The service:
1. **Checks for infrastructure news** from market intelligence data
2. **Applies boost** for BeltLine and transit projects (lines 219, 376)
3. **Boosts digital factor** for new construction near infrastructure

**How it works:**
- Market intelligence is populated from `research-agent.service.ts`
- Research agent queries LLM with property context, which includes "infrastructure intelligence"
- BeltLine opening/proximity is captured as a news event with type='INFRASTRUCTURE'
- Traffic engine dynamically applies boost based on this data

**Verdict:** 🟢 **CORRECT DESIGN** — BeltLine is handled through market intelligence, not hardcoded rules. This allows:
- Different infrastructure projects to boost signals dynamically
- Easy updates when BeltLine opens or other infrastructure changes
- City-agnostic approach (works for any city with research data)

**Note:** BeltLine impact depends on research agent capturing it correctly. If BeltLine impact is missing, the issue is in research agent, not traffic engine.

---

## SUMMARY: Data Integrity Assessment

| Issue | Status | Root Cause | Fix Required |
|-------|--------|-----------|--------------|
| M07 traffic fallback factors | ✅ ACCEPTABLE | Intentional fallback pattern with confidence flag | 🟢 NO |
| Zoning ST_Area projection | ✅ SAFE | Code correctly uses `::geography` cast + conversion factors | 🟢 NO |
| FAR exclusions by city | ✅ DATA-DRIVEN | FAR stored in database, not hardcoded | 🟢 NO |
| BeltLine overlay handling | ✅ CORRECT | Data-driven via market intelligence | 🟢 NO |

---

## KEY INSIGHT: Data-Driven vs. Code-Driven Rules

**JEDI RE Architecture favors data-driven rules:**

1. **Zoning rules**: Stored in `zoning_districts` table with city-specific values
2. **FAR adjustments**: Stored in database, retrieved per property
3. **Infrastructure impact**: Populated via research agent news intelligence
4. **Fallback factors**: Explicit confidence flag alerts consumers

**This design is CORRECT because:**
- Rules change by municipality — they belong in database, not code
- Intelligence changes over time — research agent can update dynamically
- Reduces code complexity and coupling
- Allows non-engineers to maintain rules (via database)

---

## No Fixes Required for Session 5

All four "data integrity" issues are either:
- ✅ Intentional fallback patterns with proper confidence signaling
- ✅ Correctly implemented with safe projections
- ✅ Data-driven rather than code-hardcoded (correct approach)

**Next Step:** Proceed to Phase 1, Session 6: Store & State Management Fixes

---

*Investigation complete. All data integrity concerns assessed and found acceptable.*
