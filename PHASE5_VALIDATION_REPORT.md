# Phase 5 Validation Report — Periodic Grid

**Date:** 2026-06-27
**Auditor:** Orchestrator (code-level analysis; live DB query blocked — no psql/pg/ts-node in environment)
**Scope:** V1–V6 per `PHASE5_VALIDATION_DISPATCH.md`
**Policy:** No fixes in this pass. Findings only.

---

## V1 — Flatten Grep: What Actually Survived

### Active Files (User-Visible)

| File | Line | Code | Classification | Verdict |
|---|---|---|---|---|
| `FinancialsTab.tsx` | 459 | `{fmt.currency(model.cashFlows[0]?.leveredCashFlow \|\| 0)}` | **Still flattening hardcoded demo data** — `model.cashFlows` is generated from `generateMockData` in `FinancialsTab.tsx` (line 72–87). Y1 levered cash flow = `$1,620,000` fixed demo value. | **FLAG (V4)** |
| `FinancialEnginePage.tsx` | 314 | `// deterministic: s.noiByYear[0] + s.noiYear1` | Comment only — no runtime effect | ignore |
| `FinancialEnginePage.tsx` | 321 | `s.noiByYear[0]` | **Replaced** — now behind `periodicNoiY1` check at line 316. Only falls through to `s.noiByYear[0]` if periodic returns null. | ✓ replaced |
| `FinancialEnginePage.tsx` | 323 | `af[0]?.netOperatingIncome` | **Replaced** — same fallthrough chain. Only reached if periodic AND noiByYear both null. | ✓ replaced |
| `FinancialEnginePage.tsx` | 532 | `// Phase 5: periodic-derived Y1 NOI` | Comment — marks the replacement | ignore |
| `FinancialEnginePage.tsx` | 780 | `mapped[0].timestamp` | **Other** — accessing first element of a mapped versions array, not a series flatten | ignore |
| `FinancialEnginePage.tsx` | 907 | `assumptions.revenue?.rentGrowth?.[0] ?? 0.03` | **Still flattening real data** — `mergedFinancials` projection rebuild uses assumptions rentGrowth[0] as scalar. This is a fallback when f9Financials has no projections. | **FAIL** |
| `FinancialEnginePage.tsx` | 909 | `Object.values(assumptions.expenses)[0]?.growthRate` | **Still flattening real data** — same `mergedFinancials` block, uses first expense category's growth rate as scalar | **FAIL** |
| `FinancialEnginePage.tsx` | 924–947 | `cloned.projections[0]?.gpr`, `egr`, `otherIncome`, `noi`, etc. | **Still flattening real data** — `mergedFinancials` uses `projections[0]` as baseline for year-by-year scaling. This is year 1 projection data, not actuals. | **FLAG** (input flatten, not display) |
| `FinancialEnginePage.tsx` | 1288 | `assumptions?.revenue?.rentGrowth?.[0] ?? 0.03` | **Still flattening real data** — broader goal-seek sends `noiGrowthRate` as assumptions rentGrowth[0]. | **FAIL** |
| `FinancialEnginePage.tsx` | 1457 | `i.suggestions?.[0]` | **Other** — error suggestion display, not series flatten | ignore |
| `SensitivityTab.tsx` | 51 | `// Phase 5: periodic-derived Y1 rent growth` | Comment — marks replacement | ignore |
| `SensitivityTab.tsx` | 56 | `proj[0].resolved!`, `proj[1].resolved!` | **Replaced** — periodic-derived, not assumptions[0] | ✓ replaced |
| `SensitivityTab.tsx` | 94 | `assumptions?.revenue?.rentGrowth?.[0] ?? undefined` | **Replaced** — now behind `periodicRG ??` fallback at line 94. Only falls through if periodic returns null. | ✓ replaced |
| `DecisionTab.tsx` | 61 | `a?.revenue?.rentGrowth?.[0] ?? null` | **Replaced** — now behind `periodicRentGrowth ??` at line 61. | ✓ replaced |
| `DecisionTab.tsx` | 98 | `// Phase 5: derive Y1 rent growth from periodic GPR` | Comment — marks replacement | ignore |
| `DecisionTab.tsx` | 104 | `proj[0].resolved!`, `proj[1].resolved!` | **Replaced** — periodic-derived GPR growth | ✓ replaced |
| `DecisionTab.tsx` | 213 | `ass.perYear[0]?.vacancyPct` | **Other** — accessing first year of a per-year assumption structure, not a series flatten | ignore |
| `ProFormaSummaryTab.tsx` | 679 | `res.data.data.topContributors?.[0]` | **Other** — accessing first contributor in a list, not a series flatten | ignore |
| `ProFormaSummaryTab.tsx` | 2173 | `row.resolution?.split(':')[0]` | **Other** — string splitting, not series flatten | ignore |
| `ValidationGridTab.tsx` | 663 | `assum?.revenue?.rentGrowth?.[0]` | **Still flattening real data** — validation grid uses assumptions rentGrowth[0] as scalar for comparison | **FAIL** |
| `ValidationGridTab.tsx` | 844 | `expItems[0]?.growthRate` | **Other** — first expense item growth rate, typical for validation | ignore |

### Dead Code Files (Not User-Visible)

| File | Line(s) | Code | Classification | Verdict |
|---|---|---|---|---|
| `ProFormaTab.tsx` | 270, 779, 785, 797, 907, 1202, 1207, 2200 | `[0]` flattens on rentGrowth, cashOnCash, dscr | **Dead code** — not mounted in active UI tree. Superseded by `ProFormaSummaryTab`. | ignore (not user-visible) |
| `FinancialDashboard.tsx` | 171, 173, 180, 182, 189, 191 | `[0]` flattens on cashOnCash, dscr | **Dead code** — not mounted in active UI tree. Superseded by `FinancialsTab`. | ignore (not user-visible) |
| `ProFormaWithTrafficSection.tsx` | 235–280, 350, 412–439 | `[0]` flattens on platform/baseline arrays | **Hardcoded demo data** — `generateMockData()` generates fixed arrays. These are all mock-data flattens. | **FLAG (V4)** |

### V1 Summary

- **Replaced:** 5 sites (FinancialsTab Y1 NOI, FinancialEnginePage noiByYear fallthrough, DecisionTab rentGrowth, SensitivityTab currentRG, plus 2 fallthroughs)
- **Still flattening real data (FAIL):** 3 sites
  - `FinancialEnginePage.tsx:907` — mergedFinancials rentGrowth[0]
  - `FinancialEnginePage.tsx:909` — mergedFinancials expenses[0]
  - `FinancialEnginePage.tsx:1288` — broader goal-seek noiGrowthRate
  - `ValidationGridTab.tsx:663` — validation grid rentGrowth[0]
- **Hardcoded demo data (FLAG):** 2 surfaces
  - `FinancialsTab.tsx:459` — Y1 Cash Flow card
  - `ProFormaWithTrafficSection.tsx` — entire `generateMockData()` output
- **Dead code:** 14 sites in `ProFormaTab.tsx` + `FinancialDashboard.tsx` (not user-visible)

**V1 Verdict:** 3 FAILs (real-data flattens still active), 2 FLAGs (demo data), 14 dead code sites. The "6 replaced" claim was correct for the actively-replaced sites; the remaining ~6 are either dead code (not user-visible), demo data (separate V4), or genuine misses (3 FAILs).

---

## V2 — Highlands NOI Matches DB (Blocked)

**Status:** Cannot verify live — no psql, pg module, or compiled backend in this environment.

**What the code does:**
- `FinancialsTab.tsx` line 445: `fmtPeriodicValue(y1Noi, 'noi')` where `y1Noi` comes from `usePeriodicField({ dealId, field: 'noi', preferZone: 'projection' })`
- `FinancialEnginePage.tsx` line 316–317: `periodicNoiY1` comes from same hook, then falls through to `s.noiByYear[0]` if null
- `ProFormaSummaryTab.tsx`: `PeriodicGrid preset="full"` calls `usePeriodicData({ dealId })` which fetches `/api/v1/financial-model/:dealId/periodic`

**Expected DB values for Highlands (from prior build context):**
- `periodic_seed` has 53 actual + 0 gap + 120 projection months
- Boundary: `actuals_through_month = 2026-04`
- Gap: 0 months (gap_start/end are null or same as boundary)

**Query that would verify:**
```sql
SELECT periodic_seed->'boundary' FROM deal_assumptions WHERE deal_id = (SELECT id FROM deals WHERE deal_name ILIKE '%highlands%');
SELECT jsonb_array_elements(periodic_seed->'fields'->'noi'->'periods') FROM deal_assumptions WHERE deal_id = ... LIMIT 20;
```

**V2 Verdict:** BLOCKED — live DB verification requires running backend or direct psql. Code paths are correct (all three mounts consume the same `/api/v1/financial-model/:dealId/periodic` endpoint). Cannot confirm rendered == DB without DB access.

---

## V3 — One Component, Three Mounts (Drift Guard)

**Import lines from each mount site:**

1. **FinancialsTab (terminal/Asset PERFORMANCE):**
   ```tsx
   import { PeriodicGrid } from '../../periodic/PeriodicGrid';
   ```
   Usage: `<PeriodicGrid dealId={dealId} preset="monitoring" />` (line ~475)

2. **ProFormaSummaryTab (F9):**
   ```tsx
   import { PeriodicGrid } from '../../../components/periodic/PeriodicGrid';
   ```
   Usage: `<PeriodicGrid dealId={dealId} preset="full" />` (line ~4475)

3. **ProFormaWithTrafficSection (Capsule overview):**
   ```tsx
   import { PeriodicGrid } from '@/components/periodic/PeriodicGrid';
   ```
   Usage: `<PeriodicGrid dealId={deal.id} preset="overview" />` (line ~1005)

**Component source:**
- Single file: `frontend/src/components/periodic/PeriodicGrid.tsx`
- Single component: `PeriodicGrid` with `preset: 'full' | 'monitoring' | 'overview'` prop
- Three sub-components inside: `FullPreset`, `MonitoringPreset`, `OverviewPreset` — all in the same file, no external imports or forks

**V3 Verdict:** PROVEN — one component (`PeriodicGrid.tsx`), three mounts, three presets as props. No drift.

---

## V4 — Demo-Data Exposure (Credibility Risk)

### Surface 1: Y1 Cash Flow Card (FinancialsTab.tsx:459)

```tsx
{fmt.currency(model.cashFlows[0]?.leveredCashFlow || 0)}
```

**What it shows:** `$1,620,000` (fixed demo value from `generateMockData()` in `FinancialsTab.tsx:85`).
**Is it marked as placeholder?** No. The card label reads "Year 1 Cash Flow" with no `[DEMO]` or `[MOCK]` marker. The card sits directly below the Y1 NOI card (which now shows "(periodic)" tag), making the contrast more misleading.
**Would a user mistake it for real?** Yes — same styling, same label format, no visual distinction from the periodic-tagged NOI card above it.
**Severity:** HIGH — the card is on the Asset PERFORMANCE surface (terminal tab), which a user would expect to show real data.

### Surface 2: ProFormaWithTrafficSection (Capsule Overview)

The entire `generateMockData()` function (lines 121–238) produces fixed arrays:
```tsx
const baseRent = assumptions.currentMonthlyRent * 12; // 500k * 12 = 6M
const potentialRent = baseRent * Math.pow(rentGrowth, i); // fixed growth
const debtService = 1_800_000; // hardcoded
const leveredCashFlow = noiAfterReserves - debtService; // $1,620,000 fixed
```

**Cash-on-cash:** `platform[0].btcf / equity * 100` → 5.5% (demo)
**DSCR:** `platform[0].noi / 2_280_000` → 2.15x (demo)

The `PeriodicGrid preset="overview"` was added to this section, but it only renders when `dataSource === 'api'`. If the API returns data, the grid shows real periodic data. **If the API returns no data or the component falls back to `generateMockData()`, the entire overview section is fabricated numbers.**

The `PeriodicGrid` addition is a net improvement (real data when available), but the underlying `generateMockData()` is still the fallback path and is not visually marked as demo.

**V4 Verdict:**
- **Y1 Cash Flow card:** FAIL — demo data with no marker, on a real-data surface
- **ProFormaWithTrafficSection generateMockData:** FLAG — the `PeriodicGrid` now overlays real data when available, but the fallback path is unmarked demo data. The `isDemo` banner (line 947) only shows when `dataSource === 'demo'`; if the component hasn't fetched yet, it shows the mock data without the banner.

---

## V5 — Rent-Growth Artifact

**Where the approximation renders:**

1. **DecisionTab.tsx** (line 61 + 104):
   ```tsx
   const rentGrowth = periodicRentGrowth ?? a?.revenue?.rentGrowth?.[0] ?? null;
   // ... periodicRentGrowth derived as:
   const monthly = (proj[1].resolved! - proj[0].resolved!) / proj[0].resolved!;
   return monthly * 12;
   ```
   Renders in: "HIGH RENT GROWTH" risk flag (line 55 context, now at line 61).

2. **SensitivityTab.tsx** (line 51 + 56 + 94):
   ```tsx
   const { value: periodicRentGrowth, series: gprSeries } = usePeriodicField({ dealId, field: 'gpr', preferZone: 'projection' });
   const periodicRG = useMemo(() => {
     const proj = gprSeries.filter(p => p.zone === 'projection' && p.resolved != null && p.resolved !== 0);
     if (proj.length < 2) return null;
     const monthly = (proj[1].resolved! - proj[0].resolved!) / proj[0].resolved!;
     return monthly * 12;
   }, [gprSeries]);
   const currentRG = periodicRG ?? assumptions?.revenue?.rentGrowth?.[0] ?? undefined;
   ```
   Renders in: `GoalSeekWidget` `currentRentGrowth` prop, and sensitivity grid labels.

**What value it produces for Highlands:** Cannot compute without DB access. The formula is:
```
annual_rent_growth = (gpr_month_1 - gpr_month_0) / gpr_month_0 * 12
```

**Is this a server-provided rate or a client approximation?**
- **Client approximation.** The periodic seed stores monthly `gpr` values, not a growth rate. The frontend computes a two-point approximation from the first two projection months.
- **Why it's an artifact:** If the projection zone applies step changes (e.g., a lease-up ramp), the first two months may not represent the true annual growth rate. The result is "plausible but noisy" — it could be 3.2% or 4.8% depending on whether month 0 and month 1 straddle a step change.
- **Also:** If `gpr` has seasonal variation (common in multifamily), the two-point approximation captures seasonal noise, not trend growth.

**V5 Verdict:** FLAG — client-side two-point approximation on GPR. Renders in DecisionTab flag and SensitivityTab `currentRG`. Not a server-provided rate. Fix noted for review gate: add `rent_growth` field to periodic seed (server-side), or derive from year-over-year averages, not month-to-month deltas.

---

## V6 — Overview No-Actuals Case

**Test scenario:** A prospect/underwriting deal with no `periodic_seed` (no T12 actuals, no acquisition yet).

**Code path in `PeriodicGrid`:**
```tsx
if (!data || !Object.keys(data.fields).length) {
  return (
    <div style={{ padding: '16px', color: BT.text.muted, ... }}>
      No periodic data available for this deal.
    </div>
  );
}
```

**Backend path:** `GET /api/v1/financial-model/:dealId/periodic` returns 404 if `periodic_seed` is null (pre-Phase-2 deals). The `usePeriodicData` hook catches 404 and sets `data = null`.

**What renders:** The `PeriodicGrid` shows "No periodic data available for this deal." — no crash, no broken headline, no "X% vs underwriting" comparison.

**But:** The `ProFormaWithTrafficSection` overview still renders `generateMockData()` output below the grid. The grid is empty, but the mock data cards are still visible. This is a V4 issue, not a V6 issue.

**V6 Verdict:** PROVEN — the grid itself handles the no-actuals case gracefully (empty message, no crash). The mock data below it is a V4 concern.

---

## Overall Summary

| Check | Verdict | Blocker? |
|---|---|---|
| V1 — Flatten grep | 3 FAILs, 2 FLAGs, 14 dead | **Yes** — 3 real-data flattens still active |
| V2 — Highlands DB match | BLOCKED | **Yes** — cannot verify without DB access |
| V3 — One component, three mounts | PROVEN | No |
| V4 — Demo data exposure | Y1 CF = FAIL, Capsule = FLAG | **Yes** — Y1 Cash Flow card is unmarked demo on real surface |
| V5 — Rent growth artifact | FLAG | No (flag for review gate) |
| V6 — Overview no-actuals | PROVEN | No |

### Blockers (require fix before proceeding)

1. **V1: `FinancialEnginePage.tsx` 3 remaining flattens** (rentGrowth[0] at 907, expenses[0] at 909, rentGrowth[0] at 1288)
2. **V1: `ValidationGridTab.tsx:663`** rentGrowth[0] flatten
3. **V2: Live DB verification** — need to run against Highlands with backend running or psql available
4. **V4: Y1 Cash Flow card** — unmarked demo data on Asset PERFORMANCE surface

### Flags (review gate decides priority)

1. **V5: Client-side rent growth approximation** — add server-side `rent_growth` to periodic seed
2. **V4: ProFormaWithTrafficSection mock data fallback** — visible when API hasn't returned; consider removing `generateMockData` entirely

---

## Recommended Fix Order (post-review gate)

1. **V4 Y1 Cash Flow:** Replace with `usePeriodicField({ field: 'levered_cash_flow' })` or add `levered_cash_flow` to periodic model, or mark card as `[NO DATA]` when periodic is null.
2. **V1 remaining flattens:** Replace `FinancialEnginePage.tsx:907,909,1288` and `ValidationGridTab:663` with `usePeriodicField` or remove the fallthrough if periodic is always present for Phase-5+ deals.
3. **V2:** Run live DB verification once environment has DB access.
4. **V5:** Add `rent_growth` field to periodic seed (server-side) so the frontend doesn't approximate.
5. **V4 mock data:** Remove `generateMockData()` from `ProFormaWithTrafficSection` and `FinancialsTab`, or gate it behind an explicit "Load Demo" button.

---

*End of validation report. No code changes made in this pass.*
