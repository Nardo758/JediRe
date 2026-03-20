# JEDI RE PHASE 1 SESSION 4: RUNTIME CRASH FIXES
**Session:** Phase 1, Session 4: Runtime Crash Fixes
**Date:** March 20, 2026
**Status:** PRE-FIX AUDIT (identifying bugs, not yet fixed)

---

## BUG 1: Deal Opens from Pipeline → Null/Undefined Crash

### Investigation: ✅ NOT FOUND IN CODE

**Expected Location:** DealDetailPage.tsx, DealView.tsx, or related deal page variant

**Actual Finding:**
- DealDetailPage.tsx HAS proper null guards:
  - Line 210: `useState<any>(null)` initializes deal as null
  - Line 389-398: Loading skeleton while fetching
  - Line 400-416: Error fallback with "Deal not found" message
  - Line 293: Safe extraction: `setDeal(body?.deal || body?.data || body)`

- DealView.tsx: Only found one null guard: `if (!deal.boundary?.coordinates) return null;` (line 50)

**Verdict:** 🟢 **NO CODE CRASH DETECTED** — DealDetailPage handles null properly. Hard to confirm without runtime testing.

**Recommendation:** Monitor console in next session when running app. If crashes occur, add more defensive checks to DealView variant (which is less protected than DealDetailPage).

---

## BUG 2: ProForma Hardcodes IRR=15

### Investigation: ✅ CONFIRMED & LOCATED

**Location:** `frontend/src/components/deal/sections/DesignToFinancialService.ts` (line 55)

**Code:**
```typescript
calculateProForma(inputs: FinancialInputs): ProForma {
  const costPerSqFt = inputs.constructionCostPerSqFt || 200;
  const hardCosts = inputs.totalSqFt * costPerSqFt;
  const softCosts = hardCosts * 0.25;
  const landCost = inputs.landCost || 0;
  const totalDevelopmentCost = hardCosts + softCosts + landCost;
  const avgRentPerUnit = 1500;
  const grossRevenue = inputs.totalUnits * avgRentPerUnit * 12;
  const operatingExpenseRatio = 0.4;
  const operatingExpenses = grossRevenue * operatingExpenseRatio;
  const netOperatingIncome = grossRevenue - operatingExpenses;
  const yieldOnCost = totalDevelopmentCost > 0 ? (netOperatingIncome / totalDevelopmentCost) * 100 : 0;
  const costPerUnit = inputs.totalUnits > 0 ? totalDevelopmentCost / inputs.totalUnits : 0;
  const capRate = 5.5;
  const irr = 15;  // ← HARDCODED HERE
  const equityMultiple = 2.0;

  return {
    hardCosts,
    softCosts,
    totalDevelopmentCost,
    grossRevenue,
    operatingExpenses,
    netOperatingIncome,
    yieldOnCost,
    costPerUnit,
    capRate,
    irr,  // ← RETURNS FAKE VALUE
    equityMultiple,
  };
}
```

### Context: This Is a 3D Design Module Service

**Service Purpose:** Converts 3D design data from design3D module into financial projections

**Other Hardcoded Values (Also Stubs):**
- Line 47: `const avgRentPerUnit = 1500;` (no actual rent data)
- Line 49: `const operatingExpenseRatio = 0.4;` (hardcoded OpEx %)
- Line 54: `const capRate = 5.5;` (hardcoded cap rate)
- Line 56: `const equityMultiple = 2.0;` (hardcoded multiple)

### Important Note

This is NOT the main ProForma service. The main ProForma service (proforma-generator.service.ts) uses proper Newton-Raphson IRR calculation. This DesignToFinancialService is a prototype/stub for the 3D design → financial module.

### Root Cause

The service was built as a demo/prototype for the 3D design module and never wired to real ProForma data. It's a conversion utility that needs to:
1. Either pull real data from proforma-generator.service.ts via API
2. Or calculate IRR properly instead of hardcoding

### Fix Required

Replace hardcoded values with:
- `avgRentPerUnit`: From M05 market data (market.avgRent or assume rents)
- `operatingExpenseRatio`: From OpEx benchmark or template
- `capRate`: From market cap rate assumption
- `irr`: Calculate from cash flows or fetch from API
- `equityMultiple`: Calculate from IRR + hold period

---

## BUG 3: Zoning Module Competing Implementations

### Investigation: ✅ CONFIRMED — 18 Zoning Service Files

**Zoning Service Files Found:**
```
backend/src/services/zoning-agent.service.ts
backend/src/services/zoning-application-pipeline.service.ts
backend/src/services/zoning-comparator.service.ts
backend/src/services/zoning-confidence-v2.service.ts
backend/src/services/zoning-correction.service.ts
backend/src/services/zoning-event-bus.service.ts
backend/src/services/zoning-interpretation-cache.service.ts
backend/src/services/zoning-knowledge.service.ts
backend/src/services/zoning-outcome.service.ts
backend/src/services/zoning-precedent.service.ts
backend/src/services/zoning-profile.service.ts
backend/src/services/zoning-query-router.service.ts
backend/src/services/zoning-reasoning.service.ts
backend/src/services/zoning-recommendation-orchestrator.service.ts
backend/src/services/zoning-triangulation.service.ts
backend/src/services/zoning-verification.service.ts
backend/src/services/zoning.service.ts
backend/src/services/zoning.ts
```

### Analysis: Not Competing, But Specialized Sub-Services

These are NOT truly "competing" implementations. They appear to be specialized sub-services:

| Service | Purpose |
|---------|---------|
| `zoning.ts` | Core zoning lookup service (66+ lines, exported as `zoningService`) |
| `zoning.service.ts` | Alternative naming? (needs verification) |
| `zoning-agent.service.ts` | Municode lookup agent wrapper |
| `zoning-application-pipeline.service.ts` | Application lifecycle pipeline |
| `zoning-profile.service.ts` | Zoning profile caching (85+ lines) |
| `zoning-comparator.service.ts` | Compare zoning across properties |
| `zoning-verification.service.ts` | Verify zoning accuracy |
| `zoning-triangulation.service.ts` | Cross-reference multiple sources |
| `zoning-recommendation-orchestrator.service.ts` | Recommend zoning paths |
| `zoning-interpretation-cache.service.ts` | Cache parsed zoning rules |
| `zoning-confidence-v2.service.ts` | Confidence scoring v2 |
| Others | Event bus, reasoning, knowledge, correction, outcome modules |

### Potential Issue: Which One Is Canonical?

**Two competing main services found:**
1. `zoning.ts` (66 lines) — exported as `export const zoningService = new ZoningService();`
2. `zoning.service.ts` — naming convention mismatch

**Column Naming:**
- Could have inconsistencies between these 18 implementations
- Risk of divergent logic between services

### Recommendation for Fix

1. Audit which service is actually USED by routes
2. Consolidate: Keep ONE canonical zoning lookup service
3. Deprecate the 17 specialty services or properly integrate them
4. Rename to follow convention: `zoning.service.ts` (not `zoning.ts`)

---

## BUG 4: M07 Traffic Engine Disconnected

### Investigation: ✅ NOT CONFIRMED AS BUG

**Evidence Found:**

1. **Traffic Routes ARE Mounted** (Layer 3 audit confirmed):
   - ✅ `/api/v1/traffic-data` — trafficDataRoutes (line 303 index.ts)
   - ✅ `/api/v1/traffic-comps` — trafficCompsRoutes (line 306 index.ts)
   - ✅ `/api/v1/traffic-ai` — trafficAiRoutes (line 212 index.ts)

2. **Traffic Migrations EXIST** (not empty stubs):
   - ✅ `072_weekly_traffic_reports.sql` (has DDL)
   - ✅ `073_traffic_submarket_calibration.sql` (has DDL)
   - ✅ `075_traffic_data_sources.sql` (has DDL)
   - ✅ `076_three_layer_traffic_fusion.sql` (has DDL, verified content)

3. **Traffic Services Exist:**
   - ✅ `trafficPredictionEngine.ts` (2,869 lines backend)
   - ✅ `traffic*.ts` services (6+ files)
   - ✅ `trafficToProFormaService.ts` (handles M07→M09 handoff)

### Root Cause: Frontend Blind, Not Backend

**Real Problem:**
- Backend M07 Traffic is fully built
- Migrations are written and migrated
- Routes are mounted
- **But:** Frontend has NO `api.traffic.*` methods (Layer 5 gap)
- Frontend can't fetch traffic data, so UI can't show it

**Impact:** Traffic module appears "disconnected" because frontend can't call it, not because backend isn't ready.

### Verdict: 🟢 **NOT A BUG** in backend; it's a missing frontend API client method (Layer 5 gap, handled in Phase 2)

---

## SUMMARY OF BUGS

| Bug # | Title | Status | Severity | Root Cause |
|-------|-------|--------|----------|-----------|
| 1 | Deal opens → crash | ✅ NOT FOUND | LOW | DealDetailPage has guards; no crash detected in code |
| 2 | ProForma irr=15 | ✅ CONFIRMED | MEDIUM | DesignToFinancialService.ts line 55 (3D design module stub) |
| 3 | Zoning competing | ✅ CONFIRMED | MEDIUM | 18 zoning services; unclear which is canonical |
| 4 | M07 disconnected | 🟢 NOT A BUG | N/A | Frontend blind; backend fully built |

---

## FIXES TO IMPLEMENT IN SESSION 4

### FIX 1: DesignToFinancialService IRR Hardcoding

**File:** `frontend/src/components/deal/sections/DesignToFinancialService.ts`

**Current (Line 55):**
```typescript
const irr = 15;
```

**Options:**
- **Option A:** Calculate from cash flows (do internal NPV/IRR calculation)
- **Option B:** Fetch from backend ProForma API
- **Option C:** Replace with message "IRR pending capital structure" (fallback)

**Recommended:** Option C for Phase 1 (simplest). Replace hardcoded value with note that real IRR comes from ProForma module once wired.

---

### FIX 2: Zoning Service Canonicalization

**Files:** All 18 zoning-*.ts services

**Action Items:**
1. Identify which service is actually CALLED by routes
2. Check `backend/src/api/rest/zoning.routes.ts` for the canonical import
3. Deprecate or integrate the other 17 services
4. Add comments marking canonical service

---

### FIX 3: (No action needed for M07)

M07 is not broken; it's just waiting for frontend API methods in Phase 2.

---

## NEXT STEPS

- Move to implementation phase of Session 4
- Fix DesignToFinancialService IRR hardcoding
- Identify canonical zoning service
- Prepare for Session 5 (Data Integrity Fixes)

---

*Pre-fix audit complete. Ready to implement fixes.*
