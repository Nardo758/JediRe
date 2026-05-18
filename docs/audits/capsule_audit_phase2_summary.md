# F9 Surface Connectivity Audit — Phase 2 Summary
**Task #873 · Auditor: JEDI-Agent · Date: 2026-05-18**

---

## Test Deals

| Deal | ID | Units | Exit Cap | Interest Rate | Hold | Scenario |
|------|----|-------|----------|--------------|------|----------|
| 464 Bishop | `3f32276f` | 232 | 5.0% | 6.0% | 5 yr | Active ✓ |
| Sentosa Epperson | `3d96f62d` | 304 | 5.0% | **NULL** | 5 yr | Active ✓ |
| Westside Lofts *(control)* | `8205a985` | — | — | — | — | None |

---

## Architecture: Data Flow

```
GET /api/v1/deals/:id/financials
    └─► getDealFinancials()  [proforma-adjustment.service.ts:1996]
           ├─ Reads: deal_assumptions.year1 (LayeredValue JSONB)
           ├─ Reads: deal_assumptions.per_year_overrides
           ├─ Reads: traffic projection
           ├─ Computes: rich returns {lpNetIrr, lpEquityMultiple, avgCashOnCash, ...}
           └─ ROUTE OVERWRITES returns with {irr, equityMultiple, cashOnCash}  ← BUG

FinancialEnginePage.tsx
    ├─ f9Financials = API response (returns has irr/equityMultiple/cashOnCash only)
    ├─ mergedFinancials useMemo:
    │     IF modelResults===null  → returns cloned f9Financials (lpNetIrr = undefined)
    │     IF modelResults present → mergeModelIntoFinancials() maps model.summary.irr→lpNetIrr
    └─ All tabs receive mergedFinancials (or null)

Scenario awareness: INDIRECT via DB trigger trg_sync_underwriting_scenario
    deal_underwriting_scenarios.year1 ──trigger──► deal_assumptions.year1
    getDealFinancials reads deal_assumptions → sees scenario data transparently
```

---

## Phase C: Root Causes

### RC-001 — Returns Hero Strip Blank (HIGH · ALL DEALS · OPEN)

**What's broken:** The 4 hero tiles in the Returns tab (LP NET IRR, LP EQUITY MULTIPLE, AVG CASH-ON-CASH, GP PROMOTE EARNED) show `—` on every deal until the user manually runs the cashflow model.

**Why:** Two-step failure chain:
1. `/financials` route overwrites `getDealFinancials`'s rich `returns` object with a simplified `{irr, equityMultiple, cashOnCash}` — discarding `lpNetIrr`, `lpEquityMultiple`, `avgCashOnCash`
2. `mergedFinancials useMemo` (when `modelResults===null`) returns a clone of `f9Financials` — where `returns.lpNetIrr === undefined` → `ReturnsTab` renders `—`

**Code locations:**
- `inline-deals.routes.ts:1855` — `let returns = { irr, equityMultiple, cashOnCash }` (overwrites)
- `FinancialEnginePage.tsx:704` — null-modelResults branch returns clone without mapping
- `FinancialEnginePage.tsx:92` — `lpNetIrr = s.lpIrr ?? s.irr` reads `model.summary`, not `src.returns`

**Fix:** Stop the route from overwriting `data.returns`. `getDealFinancials` already computes the full rich object (IIFE at `proforma-adjustment.service.ts:4482`). Estimated change: ~15 lines in `inline-deals.routes.ts`.

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
- **Fix:** Configure Sentosa loan terms via Debt Advisor (M11 Configure tab). Not a code bug.

---

### RC-004 — RE Tax Key Alias (LOW · FIXED by F-HIGH-004)

- DB stores RE tax under `real_estate_tax` (singular); cashflow postprocess expected `real_estate_taxes` (plural)
- F-HIGH-004 added `KEY_ALIASES` normalization in `cashflow.postprocess.ts`
- Both deals have agent values: Bishop `$540K`, Sentosa `$1.3M`
- **Status:** FIXED. No further action.

---

### RC-005 — Waterfall/LP Tranche Sections Blank (MEDIUM · ALL DEALS · CONFIG GAP)

- No LP tranches configured on Bishop or Sentosa (or Westside Lofts)
- ReturnsTab §2 correctly shows `"No LP tranches configured"` prompt
- CapitalHub/Waterfall shows empty distribution schedule
- **Fix:** Product decision — seed a default 80/20 LP/GP split with 8% pref on deal creation

---

### RC-006 — F-009 Fix Scope (LOW · MONITORING)

- F-009 applied to `financials-composer.service.ts` (composeDealFinancials path)
- Main `/financials` GET uses `getDealFinancials` (independent path)
- Both should handle `other_income_dollars` correctly; no active failure

---

## Phase D: Tab Status Matrix

| Tab / Section | Bishop | Sentosa | Control | Notes |
|--------------|--------|---------|---------|-------|
| Overview | ✓ | ✓ | ✓ | Independent endpoint |
| Assumptions/Inputs GPR | ✓ $4.9M | ✓ $6.6M | ✓ | Agent write-back |
| Assumptions/Inputs Other Income | ✓ $341K | ✓ $0 | ✓ | via `other_income_dollars` |
| Assumptions/Inputs RE Taxes | ✓ $540K | ✓ $1.3M | ✓ | Agent write-back |
| Deal Terms | ✓ | ⚠ no rate | ✓ | RC-003 |
| Unit Mix | ✓ | unknown | ✓ | Bishop has unit_mix data |
| Projections — revenue rows | ✓ | ✓ | ✓ | |
| Projections — debt rows | ✓ | ✗ zero | ✓ | RC-003 |
| AI Findings panel | ✓ | ✓ | ✓ | Narrative cached 24h |
| **Returns Hero Strip** | **✗ blank** | **✗ blank** | **✗ blank** | **RC-001** |
| Returns §1 Property Returns | ⚠ partial | ⚠ partial | ⚠ partial | RC-001: unlev IRR null |
| Returns §2 LP Tranches | ✗ no config | ✗ no config | ✗ no config | RC-005 |
| Returns §5 Debt | ⚠ partial | ✗ blank | ⚠ partial | RC-003 for Sentosa |
| **Sensitivity** | **✓** | **✓** | **✓** | Local computation only |
| Capital / Src & Uses | ✓ | ⚠ no LTV | ✓ | RC-003 |
| Capital / Debt | ✓ | ⚠ partial | ✓ | RC-003 |
| Capital / Waterfall | ✗ no config | ✗ no config | ✗ no config | RC-005 |
| Decision | ✓ | ✓ | ✓ | From f9Financials |
| Compare / Walkthrough | ✓ | ✓ | ✓ | From f9Financials |

---

## Phase E: Scenario-Awareness Assessment

**Finding:** The scenario system does **NOT** introduce additional blank tabs on Bishop/Sentosa vs Westside Lofts. The RC-001 blank Returns strip affects all three deals identically.

The DB trigger `trg_sync_underwriting_scenario` maintains `deal_assumptions.year1` as a live mirror of the active scenario. `getDealFinancials` reads `deal_assumptions` and therefore sees scenario data transparently. No direct scenario_id read is required.

**Risk:** If the sync trigger fires silently in a failed state, scenario writes would not propagate. No evidence of this occurring — both deals show consistent GPR values between scenario and deal_assumptions.

---

## Prioritized Action Items

| Priority | ID | Action | File | Impact |
|----------|----|--------|------|--------|
| 🔴 1 | FIX-RC-001 | Stop route from overwriting `data.returns` | `inline-deals.routes.ts` | Restores all Returns hero tiles on every deal |
| 🔴 2 | FIX-RC-003 | Configure Sentosa loan terms via Debt Advisor | DATA | Restores debt rows, DSCR, CFBt for Sentosa |
| 🟡 3 | FIX-RC-002 | Verify `getDealFinancials` `other_income_dollars` path | `proforma-adjustment.service.ts` | Confirm F-009 effective on main path |
| 🟢 4 | FIX-RC-005 | Seed default LP/GP tranche on deal creation | Product | First-run Waterfall UX |

---

## Previously Fixed (Task #873 pre-work)

- **F-009:** `financials-composer.service.ts` now prefers `other_income_dollars.agent` over `other_income_per_unit × units × 12` in the override-write path
- **F-HIGH-004:** `cashflow.postprocess.ts` KEY_ALIASES normalization for `expense.real_estate_taxes`, `expense.g_and_a`, `expense.bad_debt`

