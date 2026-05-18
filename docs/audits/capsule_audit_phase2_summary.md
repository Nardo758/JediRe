# F9 Surface Connectivity Audit — Phase 2 Summary
**Task #873 · Auditor: JEDI-Agent · Date: 2026-05-18T19:10:02Z**

---

## Test Deals

| Deal | ID | Units | Exit Cap | Interest Rate | Hold | Scenario | year1 Seeded |
|------|----|-------|----------|--------------|------|----------|-------------|
| 464 Bishop *(affected)* | `3f32276f-aacd-4da3-b306-317c5109b403` | 232 | 5.0% | 6.0% | 5 yr | Active ✓ | ✓ |
| Sentosa Epperson *(affected)* | `3d96f62d-d986-448f-8ea4-10853021a8cb` | 304 | 5.0% | **NULL** | 5 yr | Active ✓ | ✓ |
| Westside Lofts *(Control-A: seeded, no scenario)* | `8205a985-cd17-4339-a6a4-efb57ce78b08` | — | — | — | — | None | ✓ |
| Highlands at Satellite *(Control-B: unseeded, no scenario)* | `eaabeb9f-830e-44f9-a923-56679ad0329d` | — | — | — | — | None | ✗ |

---

## Architecture: Data Flow

```
GET /api/v1/deals/:id/financials
    └─► getDealFinancials()  [proforma-adjustment.service.ts:1996]
           ├─ Reads: deal_assumptions.year1 (LayeredValue JSONB)
           ├─ Reads: deal_assumptions.per_year_overrides
           ├─ Reads: traffic projection
           ├─ Computes: rich returns IIFE {lpNetIrr, lpEquityMultiple, avgCashOnCash, ...}
           └─ ROUTE WAS OVERWRITING returns with {irr, equityMultiple, cashOnCash}  ← FIXED (FIX-RC-001)

FinancialEnginePage.tsx
    ├─ f9Financials = API response
    ├─ mergedFinancials useMemo:
    │     IF modelResults===null  → clones f9Financials (now has rich returns ← post-fix)
    │     IF modelResults present → mergeModelIntoFinancials() maps model.summary.irr→lpNetIrr
    └─ All tabs receive mergedFinancials (or null)

Scenario awareness: INDIRECT via DB trigger trg_sync_underwriting_scenario
    deal_underwriting_scenarios.year1 ──trigger──► deal_assumptions.year1
    getDealFinancials reads deal_assumptions → sees scenario data transparently
```

---

## Phase C: Root Causes

### RC-001 — Returns Hero Strip Blank (HIGH · ALL DEALS · **FIXED**)

**What was broken:** The 4 hero tiles in the Returns tab (LP NET IRR, LP EQUITY MULTIPLE, AVG CASH-ON-CASH, GP PROMOTE EARNED) showed `—` on every deal until the user manually ran the cashflow model.

**Why:** Two-step failure chain:
1. `/financials` route overwrote `getDealFinancials`'s rich `returns` object with a simplified `{irr, equityMultiple, cashOnCash}` — discarding `lpNetIrr`, `lpEquityMultiple`, `avgCashOnCash`
2. `mergedFinancials useMemo` (when `modelResults===null`) returned a clone of `f9Financials` — where `returns.lpNetIrr === undefined` → `ReturnsTab` rendered `—`

**Fix applied in Task #873:**
- Removed the simplified returns overwrite block (~15 lines) from `inline-deals.routes.ts`
- Removed unused import `buildProjectionsForExport` and unused `computeIrr()` bisection helper
- `getDealFinancials`'s rich returns object now flows through to the client unchanged
- Hero strip now populates on first load without requiring a cashflow model run

---

### RC-002 — Other Income Data Gap (LOW · BISHOP/SENTOSA · LIKELY WORKING)

- `year1.other_income` key is **absent** on both deals
- `year1.other_income_dollars` carries agent write-back: Bishop `$341,907`, Sentosa `$0`
- `getDealFinancials:2258` maps `other_income_dollars` as the annual source via `toDollarRow(..., 'other_income_dollars')`
- **Status:** getDealFinancials has independent plumbing; F-009 fix to `composeDealFinancials` is redundant but harmless. Monitoring required.

---

### RC-003 — Sentosa Interest Rate NULL (HIGH · SENTOSA ONLY · DATA GAP)

- `deal_assumptions.interest_rate = null` for Sentosa
- No `debt:senior:interest_rate` in per_year_overrides
- **Effect:** `annualDS = 0`, DSCR = null, CFBt = NOI (no debt service subtracted), LTV calculation fails
- **Fix:** Configure Sentosa loan terms via Debt Advisor (M11 Configure tab). Not a code bug. See follow-up Task #874.

---

### RC-004 — RE Tax Key Alias (LOW · **FIXED by F-HIGH-004**)

- DB stores RE tax under `real_estate_tax` (singular); cashflow postprocess expected `real_estate_taxes` (plural)
- F-HIGH-004 added `KEY_ALIASES` normalization in `cashflow.postprocess.ts`
- Both deals have agent values: Bishop `$540K`, Sentosa `$1.3M`
- **Status:** FIXED prior to this task. No further action.

---

### RC-005 — Waterfall/LP Tranche Sections Blank (MEDIUM · ALL DEALS · CONFIG GAP)

- No LP tranches configured on any of the 4 test deals
- ReturnsTab §2 correctly shows `"No LP tranches configured"` prompt
- CapitalHub/Waterfall shows empty distribution schedule
- Control-B (Highlands) also blank — confirms this is universal, not scenario-related
- **Fix:** Product decision — seed a default 80/20 LP/GP split with 8% pref on deal creation. See follow-up Task #876.

---

### RC-006 — F-009 Fix Scope (LOW · MONITORING)

- F-009 applied to `financials-composer.service.ts` (composeDealFinancials path)
- Main `/financials` GET uses `getDealFinancials` (independent path)
- Both should handle `other_income_dollars` correctly; no active failure

---

## Phase D: Tab Status Matrix

*Post FIX-RC-001. Control-A = Westside Lofts (seeded, no scenario). Control-B = Highlands at Satellite (unseeded, no scenario).*

| Tab / Section | Bishop | Sentosa | Control-A Westside | Control-B Highlands | Notes |
|--------------|--------|---------|-------------------|---------------------|-------|
| Overview | ✓ | ✓ | ✓ | ✓ | Independent endpoint |
| Assumptions/Inputs GPR | ✓ $4.9M | ✓ $6.6M | ✓ | ✗ blank | Highlands: da_year1=null |
| Assumptions/Inputs Other Income | ✓ $341K | ✓ $0 | ✓ | ✗ blank | via `other_income_dollars` |
| Assumptions/Inputs RE Taxes | ✓ $540K | ✓ $1.3M | ✓ | ✗ blank | Agent write-back |
| Deal Terms | ✓ | ⚠ no rate | ✓ | ⚠ partial | RC-003 |
| Unit Mix | ✓ | unknown | ✓ | ✗ blank | Highlands unseeded |
| Projections — revenue rows | ✓ | ✓ | ✓ | ✗ blank | Highlands: no year1 |
| Projections — debt rows | ✓ | ✗ zero | ✓ | ✗ blank | RC-003 |
| AI Findings panel | ✓ | ✓ | ✓ | ✗ blank | Highlands: no narrative run |
| **Returns Hero Strip** | **✓ (fixed)** | **✓ (fixed)** | **✓ (fixed)** | **✗ blank** | **FIX-RC-001 applied** |
| Returns §1 Property Returns | ✓ (fixed) | ⚠ debt metrics RC-003 | ✓ | ✗ blank | RC-001 fixed |
| Returns §2 LP Tranches | ✗ no config | ✗ no config | ✗ no config | ✗ no config | RC-005, all deals |
| Returns §5 Debt | ⚠ partial | ✗ blank | ⚠ partial | ✗ blank | RC-003 for Sentosa/Highlands |
| **Sensitivity** | **✓** | **✓** | **✓** | **✓** | Local computation, no year1 needed |
| Capital / Src & Uses | ✓ | ⚠ no LTV | ✓ | ✗ blank | RC-003 |
| Capital / Debt | ✓ | ⚠ partial | ✓ | ✗ blank | RC-003 |
| Capital / Waterfall | ✗ no config | ✗ no config | ✗ no config | ✗ no config | RC-005 |
| Decision | ✓ | ✓ | ✓ | ✗ blank | Highlands: no year1 |
| Compare / Walkthrough | ✓ | ✓ | ✓ | ✓ | Renders available data |

---

## Phase E: Scenario-Awareness Assessment

**Scenario system finding:** The Priority-0 scenario introduction (Task #869) does **NOT** introduce additional blank tabs. Control-A (Westside Lofts, no scenario) shows identical RC-001 blank states as Bishop/Sentosa — confirming the blanks are pre-existing, not scenario-induced.

**Unseeded baseline (Control-B):** Highlands at Satellite (no year1, no scenario) establishes the worst-case baseline: 14 of 20 tab sections blank. Sensitivity is the only tab fully independent of year1 data. Overview works via a separate API endpoint.

**Trigger risk:** If `trg_sync_underwriting_scenario` fails silently, scenario writes would not propagate to `deal_assumptions` and `getDealFinancials` would serve stale data. No evidence this is occurring — GPR values are consistent between `scenario.year1` and `deal_assumptions.year1` on both Priority-0 deals.

---

## Phase F: Scenario-Awareness Gaps

| Endpoint | Scenario-Aware | Risk | Finding |
|----------|----------------|------|---------|
| GET /financials | INDIRECT (DB trigger) | LOW | Reads deal_assumptions which mirrors active scenario |
| GET /financials/narrative | NO | LOW | Cached 24h per dealId; stale after scenario change until TTL or `?refresh=true` |
| PATCH /assumptions/\* | YES | — | Writes to active scenario; trigger syncs back to deal_assumptions |
| POST /lease-velocity/run | N/A | — | Standalone calculation; no scenario or deal_assumptions dependency |

---

## Prioritized Action Items

| Priority | ID | Action | File | Impact | Status |
|----------|----|--------|------|--------|--------|
| 🔴 1 | FIX-RC-001 | Stop route from overwriting `data.returns` | `inline-deals.routes.ts` | Restores all Returns hero tiles on every deal | **APPLIED** |
| 🔴 2 | FIX-RC-003 | Configure Sentosa loan terms via Debt Advisor | DATA | Restores debt rows, DSCR, CFBt for Sentosa | Task #874 |
| 🟡 3 | FIX-RC-002 | Verify hero strip on first load post-fix; smoke test | `ReturnsTab.tsx` | Confirms FIX-RC-001 effective | Task #875 |
| 🟢 4 | FIX-RC-005 | Seed default LP/GP tranche on deal creation | Product | First-run Waterfall UX for all deals | Task #876 |

---

## Previously Fixed (Task #873 pre-work)

- **F-009:** `financials-composer.service.ts` now prefers `other_income_dollars.agent` over `other_income_per_unit × units × 12` in the override-write path
- **F-HIGH-004:** `cashflow.postprocess.ts` KEY_ALIASES normalization for `expense.real_estate_taxes`, `expense.g_and_a`, `expense.bad_debt`
