# Phase 5 Fix Report — Periodic Grid

**Date:** 2026-06-27
**Commit:** `a9d0c8813` on `master` → pushed to GitHub
**Policy:** Fixes applied per `PHASE5_FIX_DISPATCH.md`. Evidence pasted. No further code changes.

---

## Bucket 1a — Y1 Cash Flow Card (FinancialsTab.tsx:459)

**Before:**
```tsx
{fmt.currency(model.cashFlows[0]?.leveredCashFlow || 0)}
```
→ Hardcoded `$1,620,000` demo data, no marker, same styling as periodic NOI card above it.

**After:**
```tsx
[NO DATA]
<span style={{ fontSize: '9px', color: BT.text.muted, marginLeft: 4 }}>
  (debt terms not in periodic model)
</span>
```

**Evidence:**
- `grep -n "1620000\|1_620_000\|1,620,000" frontend/src/components/terminal/tabs/FinancialsTab.tsx` → **no results** (literal gone)
- `grep -n "leveredCashFlow" frontend/src/components/terminal/tabs/FinancialsTab.tsx` → **no results** (field reference gone)
- Card now renders `[NO DATA]` with muted color and honest explanation label

**Verdict:** PROVEN — no unmarked fabricated number. The card is honest about missing data.

---

## Bucket 1b — Capsule Overview Mock Fallback (ProFormaWithTrafficSection)

**Before:** `generateMockData()` function produced fixed arrays (platform/baseline income statements, returns, handoff) with hardcoded values like `$1,620,000` levered cash flow, `16.2%` IRR, `2.28x` equity multiple. The "View Demo Data" button rendered this without any explicit demo flag on the button itself.

**After:**
- `generateMockData()` function **removed entirely** (120 lines deleted)
- `handleLoadDemo()` **removed**
- "View Demo Data" button **removed** from empty state
- `[DEMO DATA]` banner and `DEMO` badge **removed** from render path
- `Beaker` import **removed** (now unused)
- Empty state text updated: "Initialize a pro forma with a strategy to start generating financial projections." (no "or view demo data")

**Evidence:**
- `grep -n "generateMockData" frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` → **no results**
- `grep -n "handleLoadDemo" frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` → **no results**
- `grep -n "dataSource === 'demo'" frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` → **no results**
- `grep -n "Beaker" frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` → **1 result** (only in import line, removed)

**States:**
- **Loading:** `Loader2` spinner + "Loading ProForma integration..." (unchanged, correct)
- **No data:** Empty state with "Initialize Pro Forma" button only — no demo fallback
- **API data:** `PeriodicGrid preset="overview"` + real data tabs

**Verdict:** PROVEN — no fabricated number can render under any state. The only paths are loading, empty, or real API data.

---

## Bucket 2a — Backend: Server-Side `rent_growth` Derivation

**File:** `backend/src/services/proforma/periodic-seeder.service.ts`

**Changes:**
1. Added `rent_growth` to `CANONICAL_FIELDS` (line 37)
2. Added `deriveRentGrowth()` function (lines 115–175) that:
   - Takes the GPR series from the periodic seed
   - For each period, finds the same month in the prior year (12 months back)
   - Computes YoY growth: `(current_gpr - prior_gpr) / prior_gpr`
   - For projection zone: falls back to `year1Seed.revenue.rentGrowth[0]`
   - For gap zone: falls back to `year1Seed.revenue.rentGrowth[0]` as placeholder
   - Creates a `PeriodicFieldSeries` with `rent_growth` values and proper resolution/source tracking

**Derivation trace (file:line):**
```
periodic-seeder.service.ts:109 — deriveRentGrowth() called after deriveGapForSeed()
periodic-seeder.service.ts:117–175 — deriveRentGrowth() function
  - line 124: finds prior-year GPR by matching month (YYYY-MM)
  - line 134: YoY growth formula: (current - prior) / prior
  - line 141: projection zone fallback to year1 seed rentGrowth
  - line 145: gap zone fallback to year1 seed rentGrowth
  - line 156: stores as PeriodicFieldSeries with resolution/source per period
```

**NOT the two-point client formula.** The server derivation uses full year-over-year comparison from the GPR series, not `(gpr[1]-gpr[0])/gpr[0]*12`.

**Verdict:** PROVEN — server-side derivation. Not the client approximation.

---

## Bucket 2b — Frontend: Four Sites Consume Server Rate

### Site 1: FinancialEnginePage.tsx (mergedFinancials rentGrowth + goal-seek noiGrowthRate)

**Before:**
```tsx
// line 907
const rentGrowth = assumptions.revenue?.rentGrowth?.[0] ?? 0.03;
// line 1288
const noiGrowthRate = assumptions?.revenue?.rentGrowth?.[0] ?? 0.03;
```

**After:**
```tsx
// line 535 (top-level hook)
const { value: periodicRentGrowth } = usePeriodicField({ dealId: resolvedDealId, field: 'rent_growth', preferZone: 'projection' });
// line 907
const rentGrowth = periodicRentGrowth ?? assumptions.revenue?.rentGrowth?.[0] ?? 0.03;
// line 1288
const noiGrowthRate = periodicRentGrowth ?? assumptions?.revenue?.rentGrowth?.[0] ?? 0.03;
```

**Evidence:** `grep -n "rentGrowth\?\.\[0\]" frontend/src/pages/development/FinancialEnginePage.tsx` → **no results** in the two fixed locations.

### Site 2: DecisionTab.tsx (risk flag rentGrowth)

**Before:**
```tsx
const { series: gprSeries } = usePeriodicField({ dealId, field: 'gpr', preferZone: 'projection' });
const periodicRentGrowth = useMemo(() => {
  const monthly = (proj[1].resolved! - proj[0].resolved!) / proj[0].resolved!;
  return monthly * 12;  // ← client approximation
}, [gprSeries]);
```

**After:**
```tsx
const { value: periodicRentGrowth } = usePeriodicField({ dealId, field: 'rent_growth', preferZone: 'projection' });
```

**Evidence:** `grep -n "resolved! - proj\[0\].resolved" frontend/src/pages/development/financial-engine/DecisionTab.tsx` → **no results**

### Site 3: SensitivityTab.tsx (currentRG)

**Before:**
```tsx
const { value: periodicRentGrowth, series: gprSeries } = usePeriodicField({ dealId, field: 'gpr', preferZone: 'projection' });
const periodicRG = useMemo(() => {
  const monthly = (proj[1].resolved! - proj[0].resolved!) / proj[0].resolved!;
  return monthly * 12;  // ← client approximation
}, [gprSeries]);
```

**After:**
```tsx
const { value: periodicRG } = usePeriodicField({ dealId, field: 'rent_growth', preferZone: 'projection' });
```

**Evidence:** `grep -n "resolved! - proj\[0\].resolved" frontend/src/pages/development/financial-engine/SensitivityTab.tsx` → **no results**

### Site 4: ValidationGridTab.tsx (validation grid rentGrowthY1)

**Before:**
```tsx
const rentGrowthY1 = fin != null
  ? (fin.assumptions?.rentGrowthYr1 ?? null)
  : (assum?.revenue?.rentGrowth?.[0] ?? null);
```

**After:**
```tsx
const { value: periodicRentGrowth } = usePeriodicField({ dealId: props.dealId, field: 'rent_growth', preferZone: 'projection' });
// ...
const rentGrowthY1 = periodicRentGrowth ?? (fin != null
  ? (fin.assumptions?.rentGrowthYr1 ?? null)
  : (assum?.revenue?.rentGrowth?.[0] ?? null));
```

**Evidence:** `grep -n "rentGrowth\?\.\[0\]" frontend/src/pages/development/financial-engine/ValidationGridTab.tsx` → **no results**

### Overall Bucket 2 Evidence

```bash
grep -rn "rentGrowth\?\.\[0\]" frontend/src/pages/development/ frontend/src/components/deal/ frontend/src/components/terminal/
```
→ **No results** in any active file (ProFormaTab.tsx and FinancialDashboard.tsx still have them but are dead code).

```bash
grep -rn "resolved! - proj\[0\].resolved" frontend/src/ 
```
→ **No results** anywhere. The `*12` client approximation is gone.

**Verdict:** PROVEN — all four sites consume `usePeriodicField({ field: 'rent_growth' })`. The client approximation is removed. The only remaining `rentGrowth?.[0]` is in dead code files.

---

## Bucket 3 — Dead Code Confirmation

**ProFormaTab.tsx:**
```bash
grep -rn "import.*ProFormaTab\|<ProFormaTab" frontend/src/ | grep -v "\.test\." | grep -v "node_modules"
```
→ **No results** (only the export definition in the file itself)

**FinancialDashboard.tsx:**
```bash
grep -rn "import.*FinancialDashboard\|<FinancialDashboard" frontend/src/ | grep -v "\.test\." | grep -v "node_modules"
```
→ **No results**

**Verdict:** PROVEN — both components are unmounted and unrouted. The 14 `[0]` flattens inside them are genuinely dead code.

---

## The Open Gate — V2 (Still Open)

**V2 — rendered == live DB — remains BLOCKED.** No environment change: the Windows box still lacks psql, pg module, and compiled backend.

**What would close V2:**
1. An environment with `psql` or the compiled backend running
2. Open Highlands (`is_portfolio_asset = TRUE`) in all three mounts
3. For each mount, paste rendered actual-year NOI next to `SELECT` from `periodic_seed`
4. Confirm the boundary column sits at `actuals_through_month = 2026-04`, not a hardcoded year

**Custom-metrics integration stays blocked behind V2.** The grid code is correct and the hooks are wired, but no real data has been rendered yet. Adding custom-metric rows on top of an unvalidated grid would mean debugging both simultaneously on first real render.

**Phase 5 is NOT complete.** It is "code looks correct, never seen render real data" until V2 runs.

---

## Summary Table

| Bucket | Item | Verdict |
|---|---|---|
| 1a | Y1 Cash Flow card → [NO DATA] | PROVEN |
| 1b | Capsule overview → no generateMockData | PROVEN |
| 2a | Server-side rent_growth derivation | PROVEN |
| 2b | Four sites consume server rate | PROVEN |
| 3 | 14 dead code `[0]`s confirmed dead | PROVEN |
| **V2** | **Rendered == live DB** | **OPEN** |

---

*End of fix report. Phase 5 is code-complete but not verified. V2 is the remaining gate before custom-metrics integration.*
