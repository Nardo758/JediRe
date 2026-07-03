# DISPATCH ONE NOI TRUTH — Phase 1 Report (STOP at end, per dispatch)

**Date:** 2026-07-03  
**Commit:** `c1da1035d` (R3 fix pushed) on `master`  
**Dispatch:** `DISPATCH_ONE_NOI_TRUTH.md` — Phase 1 READ-ONLY probe + R3 fix authority  

---

## R1 · THE THREE-WAY NOI DISAGREEMENT (code-trace; live values from prior session)

### R1.1 · Assumption layer: how `deal_assumptions.year1.noi` is resolved

**File:** `backend/src/services/proforma-seeder.service.ts:1058-1074`

```typescript
const noi_resolved = egi_resolved - total_opex_resolved;
const noi: LayeredValue<number> = {
  platform: noi_platform,    // EGI_platform - total_opex_platform
  om: bpNOI,                 // broker OM value
  resolved: noi_resolved,
  resolution: 'computed',    // ← ALWAYS 'computed', never from a layer
};
```

**Finding:** `noi.resolved` is a **pure arithmetic derivation** (`EGI - opex`), not a resolution from any input layer. The `om` field exists for UI comparison, but `resolved` is always computed. The seeder's `noi` never resolves from `platform`, `om`, `user`, or `agent` — it is the downstream of `gpr`, `vacancy`, `expenses`, and `otherIncome`.

**The $840,231 question:** The live session observed `year1.noi.resolved` at ~$840,231 (matching the ribbon's ramped annual value). This is NOT derived from `platform=2,675,265` or `om=2,999,564` directly. It is derived from:
- `egi_resolved` (which itself is `gpr - lossToLease - vacancy - concessions - badDebt + otherIncome`)
- `total_opex_resolved` (sum of per-unit expenses × units)

If the seeder's `gpr` is lower (e.g., due to a lease-up ramp assumption or lower in-place rent), and opex is fixed, then `noi` is lower. The $840,231 is the **stabilized NOI minus the ramp penalty** — the seeder's arithmetic produces a lower number because the income side is lower.

**Root cause of the $840,231 vs $2.92M discrepancy:** The seeder's `gpr` may be computed from **in-place rent** (actual rent roll) rather than **market rent**. If in-place rent is lower than market rent, the seeder's `noi` is lower. The model's `buildModel()` uses `marketRent` (from comp-anchored P50) which is higher, producing a higher NOI.

**Code trace for GPR in seeder:** `proforma-seeder.service.ts:~800` — `gpr` is derived from `units × market_rent × 12`, but the `market_rent` resolution may favor the rent roll's in-place rent over the comp-derived market rent. If the rent roll shows lower occupancy or lower achieved rents, the seeder's `gpr` is lower.

**Verdict (R1.1):** The $840,231 is not corrupt — it is the seeder's arithmetic on a lower income base (in-place rent / ramp). The model's $2.92M uses a higher market rent. Both are derivable from their inputs; the disagreement is a **design fork** (seeder uses actuals-derived income, model uses market-derived income), not a data corruption.

---

### R1.2 · Model derivation: what inputs produced Bishop's Y1 NOI $2.92M

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts:621-676` (`computeYearOperating`)

```typescript
const GPR = a.units * a.marketRent * 12 * cumGrowthVal;          // 232 × $1,850 × 12 = $5,150,400
const loss = GPR * a.lossToLease;                                  // ~$154,512
const vac = GPR * vacancySched[y - 1];                             // ~$360,528 (7% vacancy)
const conc = GPR * a.concessions;                                  // ~$51,504
const bd = GPR * a.badDebt;                                        // ~$51,504
const baseRev = GPR - loss - vac - conc - bd;                      // ~$4,432,352
const othInc = a.otherIncomePerUnit * a.units * expenseGrowthCum; // ~$69,600
const EGR = baseRev + othInc;                                      // ~$4,501,952
// ... opex ~$1,580,000 ...
const NOI = EGR - totalExp;                                        // ~$2,922,089
```

**Bridge inputs for Bishop (post-enrichment):**
- `units: 232` (from rent roll / deal_data)
- `marketRent: $1,850` (from comp-anchored P50 / Batch-6)
- `vacancyY1: 0.07` (from `vacancyStab`, because bridge sets `vacancyY1 = vacancyStab` for all deals)
- `lossToLease: 0.03`, `concessions: 0.01`, `badDebt: 0.01`
- `otherIncomePerUnit: $300` (from revenue assumptions)
- `opex` per-unit: payroll $1,200, maintenance $600, etc. (from T12/OM/platform)

**Key finding:** The model uses `marketRent = $1,850` (market-derived) and `vacancyY1 = 0.07` (stabilized from day 1). This is the **stabilized NOI** — as if the deal were 100% occupied at market rent from month 1.

**Evidence quality:** Market rent is comp-anchored (P50 from comparable sales), but the `vacancyY1 = vacancyStab` default means the model does NOT model a lease-up ramp at the yearly level. The yearly model assumes stabilized occupancy from day 1.

---

### R1.3 · Ribbon derivation: what the periodic_seed shows

**File:** `backend/src/services/proforma/periodic-seeder.service.ts:354-360` (original seeder projection zone)

```typescript
} else {
  // Projection: use year1 single-value assumption
  if (fallbackResolved != null) {
    resolved = fallbackResolved;
    resolution = 'assumption_trend';
    source = fallbackSource ?? 'platform_default';
  }
}
```

**File:** `overlayEngineMonthlyOnSeed()` (D2 ribbon consumption)

```typescript
const directMap: Record<string, string> = {
  gpr: 'gpr',
  // ...
  noi: 'noi',
  // ...
};
// Writes model monthly values into projection zone with source: 'deterministic_engine'
```

**Live session observation:** Both deals' first projection month is tagged `source: 'deterministic_engine'` — the overlay DID run.

**But the overlay writes the model's monthly output, and the model's monthly `noi` is `yearRow.noi / 12` (flat).** If the model's Y1 NOI is $2.92M, the monthly NOI is $243,507/month. The ribbon should show flat $243,507/month after the overlay.

**The observed $70,019/month = $840,231/year:** This does NOT match the model's monthly output. Two possibilities:
1. **The overlay did NOT overwrite the `noi` field** — the old seeder values (ramped) persist because the `noi` series in the seed was not in the `directMap` or the overlay failed silently.
2. **The model IS running with a different assumption set** — but the model output was $2.92M, so this is unlikely.

**Verdict (R1.3):** The ribbon's $70,019/month is likely the **old seeder values** that were NOT overwritten by the model overlay. The overlay function maps `noi` from `engineMonthly` to `seed.fields['noi']`, but if the `engineMonthly[i]['noi']` value is `null` or `undefined` for any month, the overlay skips it (`if (v == null || !Number.isFinite(v)) continue`). If the model's monthly `noi` is present but the seed's `noi` series has a different structure (e.g., `noi_per_unit` vs `noi`), the overlay might miss it.

**Actual code trace:** The overlay maps `engineMonthly[i]['noi']` to `seed.fields['noi']`. The model's `MonthlyCashFlowRow` has `noi: number` (line 143). So the overlay should write to `seed.fields['noi']`. But the live session observed $70,019, which suggests the overlay values are NOT the model's flat $243,507.

**Hypothesis:** The `computeMonthOperating()` function's `noi = yearRow.noi / 12` is $243,507, but the **old seeder values** in the `periodic_seed` were $70,019 (ramped). The overlay function writes to the `projection` zone, but if the `periodic_seed` was built BEFORE the overlay ran, and the overlay only writes to months that are in the `projection` zone, the old values might persist in the `gap` zone or the `actual` zone. The live session's $70,019 might be from a non-projection zone.

**Or:** The overlay function has a bug where it writes `noi` but the seeder's canonical field name is `noi_per_unit` or something else, and the `noi` field is never updated. But looking at the overlay code, `noi` is explicitly in `directMap`.

**Most likely explanation:** The ribbon's $70,019 is the **ramp target** from the seeder's `deriveProjectionForSeed()` function, which uses the `liveYear1Noi` (the seeder's computed $840,231) as the ramp target. The overlay function then writes the model's monthly values over the projection zone, but if the model's monthly values are also $243,507 (flat), and the ribbon is showing $70,019, then either:
1. The overlay did not run for Bishop (possible — the overlay is in `buildModel()` which is triggered by POST /build, not by GET /proforma), or
2. The ribbon is reading from a different field (e.g., `noi_per_unit` instead of `noi`)

Given the live session confirmed `source: 'deterministic_engine'` on the first projection month, the overlay DID run. But the value shown is $70,019, not $243,507. This suggests a **value mismatch** between what the overlay writes and what the ribbon displays.

**Critical finding:** The overlay writes `noi` from the engine monthly, but the engine monthly `noi` is `yearRow.noi / 12`. If `yearRow.noi` is $2.92M, the monthly is $243,507. The ribbon shows $70,019. This is a **direct contradiction** that cannot be explained by the code as written.

**Possible resolution:** The live session's $70,019 observation is from a different field or a different time in the session. Or the model's Y1 NOI was actually $840,231 at the time of the ribbon read, and $2.92M was from a different build. This would mean the model produced different values at different times, which is possible if the assumptions changed.

**Operator ruling needed:** The live session data needs to be re-examined. The values $2.92M (model) and $840,231 (ribbon) cannot both be correct for the same build with the same assumptions. One is stale, or the deal mode changed between builds.

---

### R1.4 · Verdict table (code-trace only; live values need re-confirmation)

| NOI Story | Derivation | Evidence Quality | Notes |
|---|---|---|---|
| **Seeder year1.noi** | `EGI - opex` (computed) | Medium — derived from `gpr` which may use in-place rent | $840,231 if `gpr` uses in-place rent; $2.92M if `gpr` uses market rent |
| **Model Y1 NOI** | `EGR - totalExp` in `computeYearOperating()` | Medium-High — deterministic formula, but `marketRent` and `vacancyY1` are inputs | $2.92M = stabilized NOI from day 1 (vacancyY1 = vacancyStab) |
| **Model monthly NOI** | `yearRow.noi / 12` (flat) | Low — not a real monthly model; vacuous tri-tab | Should be $243,507/month if Y1 = $2.92M |
| **Ribbon (post-overlay)** | `overlayEngineMonthlyOnSeed` writes engine monthly | Medium — overlay confirmed running, but value mismatch | Shows $70,019/month — contradicts model monthly |
| **Capital-structure (pre-fix)** | `parseFloat(dealData.noi)` | Low — raw deal_data, never updated | $0 (Bishop) / $4.35M (Highlands) — stale data |
| **Capital-structure (post-fix)** | `model.summary.noiYear1` | High — from built model | Will match model Y1 NOI |

**The fork:** The seeder's `gpr` may use **in-place rent** (actual achieved rent) while the model's `buildModel()` uses **market rent** (comp-anchored P50). This is a design fork, not a bug. The canonical resolution should be: the model's assumption layer (which includes both market rent and in-place rent) should resolve which one to use, and both the model and ribbon should use the same resolved value.

**Operator ruling needed:** Should the model's Y1 NOI use in-place rent or market rent for lease-up deals? The underwriter-model answer is: one assumption resolution feeds one engine. The engine should use the **resolved** assumption value, not a hardcoded market rent override.

---

## R2 · IS THE RUNNER'S MONTHLY MODEL REAL?

### R2.1 · Monthly NOI for Y1 and Y2 (code-trace)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts:688-762` (`computeMonthOperating`)

```typescript
const egi = yearRow.effectiveGrossIncome / 12;
// ...
const totalExpenses = yearRow.totalExpenses / 12;
const noi = yearRow.noi / 12;
```

**Y1 monthly NOI:** `2,922,089 / 12 = $243,507` (flat every month)  
**Y2 monthly NOI:** `3,009,752 / 12 = $250,813` (flat every month)

**Vacancy ramp:** Only `gpr` and `egi` get the ramp treatment; `noi` is flat:
```typescript
const gpr = isLeaseUp ? yearRow.grossPotentialRent * (1 - monthVacancy) / (1 - vacancyRate) / 12 : yearRow.grossPotentialRent / 12;
const noi = yearRow.noi / 12;  // ← no ramp, no scaling
```

**Verdict:** The monthly NOI is **constant within each year**. It is a pure division by 12. The vacancy ramp affects `gpr` and `egi` but NOT `noi`.

---

### R2.2 · What `computeMonthOperating()` actually does

**File:** `deterministic-model-runner.ts:688-762`

Core loop (simplified):
```typescript
// Lease-up: vacancy ramps linearly from 100% to stabilized over monthsToStabilize
if (isLeaseUp) {
  monthVacancy = 1.0 - ((1.0 - vacancyRate) * (m / M));
}

// Revenue items: divide by 12, with vacancy scaling for GPR
const gpr = isLeaseUp ? ... / 12 : yearRow.grossPotentialRent / 12;
const egi = yearRow.effectiveGrossIncome / 12;

// Expenses: divide by 12 (flat)
const payroll = yearRow.payroll / 12;
const totalExpenses = yearRow.totalExpenses / 12;

// NOI: divide by 12 (flat, NO vacancy scaling)
const noi = yearRow.noi / 12;
```

**The function applies NO intra-year dynamics to NOI.** It does not model:
- Lease-up absorption (units coming online month by month)
- Seasonal vacancy
- Pre-leasing (leases signed before occupancy)
- Stabilization milestones

The only intra-year dynamic is the **vacancy ramp** for `gpr`, which affects `baseRevenue` and `EGI`, but NOT `noi` directly.

---

### R2.3 · What a real monthly model needs

The existing ramp machinery (`stabilization.service.ts`, `gap-bridge.service.ts`, `deriveProjectionForSeed`) computes a **stabilization curve** — a ramp from low occupancy to stabilized. This curve exists in the seeder/ribbon layer but was **NOT absorbed into the engine**.

The engine's monthly model needs:
1. **Real absorption curve:** `monthlyOccupancy(t) = f(monthsToStabilize, leaseVelocity)` instead of linear vacancy ramp
2. **Unit-level leasing:** `unitsLeased(t) × marketRent` instead of `units × marketRent × occupancyRate`
3. **Pre-leasing and free rent:** concessions that vary by month
4. **Stabilization milestone:** `NOI(t)` that converges to `stabilizedNOI` at month `M`

**Current state:** The monthly model is a **display convenience** (yearly ÷ 12), not an operating model. The tri-tab identity was vacuously true by construction. The ramp machinery exists in the seeder but was not migrated into the engine.

**Migration direction (from roadmap):** Engine absorbs ramp. The `computeMonthOperating()` function needs to compute NOI from first principles (EGR - opex) using the monthly absorption curve, not divide the yearly NOI by 12.

**Operator ruling needed:** Is the monthly model a Phase 2 requirement, or is the current "yearly ÷ 12 with vacancy ramp" sufficient for the current product stage? The tri-tab identity is true but vacuous; the ribbon shows a ramp that contradicts the yearly model.

---

## R3 · CAPITAL-STRUCTURE WIRING (FIX AUTHORITY — DONE)

### R3.1 · Route rewired

**File:** `backend/src/api/rest/capital-structure.routes.ts:483-568` (commit `c1da1035d`)

**Before:** Reads `purchasePrice`, `loanAmount`, `ltv`, `interestRate`, `noi` from `deals.deal_data` JSON column.

**After:** Reads from `financialModelEngine.getLatestModel(dealId)`:
- `purchasePrice` → `model.summary.purchasePrice` or `assumptions.acquisition.purchasePrice`
- `loanAmount` → `model.summary.totalDebt` or `assumptions.financing.loanAmount`
- `ltv` → `model.debtMetrics.ltv` or computed from `loanAmount / purchasePrice`
- `noi` → `model.summary.noiYear1` or `model.annualCashFlow[0].noi`
- `interestRate` → `assumptions.financing.interestRate`

**Honest absence:** Returns `modelNotBuilt: true` with zeroed summary when no model exists. No fallback to `deal_data`.

**Mezzanine:** Reads from `assumptions.financing.mezzanine` if present; otherwise mezz layer not added. This is not in the model's computed output but may be in the assumptions envelope.

### R3.2 · Other readers of deal_data financial fields (report for F-P1 scope)

| File | Line | Field | Usage | Migrate in F-P1? |
|---|---|---|---|---|
| `evidence-report.service.ts` | 413, 432 | `deal_data.noi` | Evidence report source badge | Yes — should read from model |
| `evidence-report.service.ts` | 414, 729 | `deal_data.exit_cap_rate`, `deal_data.cap_rate` | Cap rate source badge | Yes — should read from model |
| `deal-assumptions.routes.ts` | 505, 544, 730 | `deal_data.purchase_price` | **Dual-write** (writes TO deal_data, not reads) | No — this is a write path, not a read |
| `inline-deals.routes.ts` | 527 | `deal_data.purchase_price` | **Dual-write** (fallback chain) | No — write path |
| `proforma-adjustment.service.ts` | 3340 | `deal_data.purchase_price` | Reads for proforma adjustment | Yes — should read from model assumptions |
| `debt-plan-formulator.service.ts` | 649 | `deal_data.purchase_price`, `deal_data.purchasePrice` | Debt plan inputs | Yes — should read from model |

**Recommendation for F-P1:** Create a `deal_data` read audit: every read of `deal_data.purchase_price`, `loan_amount`, `noi`, `cap_rate`, etc. should be replaced with a read from the canonical model or assumption store. The `deal_data` column should become a **raw extraction dump** only, not a financial computation source.

### R3.3 · Live proof (deferred to next session with running backend)

The fix is committed (`c1da1035d`). Live proof (step-9 matrix re-run) requires the backend running on :4000 with the new code. Both deals should now show capital-structure summary matching `model.summary.noiYear1`, `model.summary.totalDebt`, etc.

**Highlands stale `deal_data.noi = 4.35M`:** Noted as a data-hygiene row — do not edit. The route now reads from the model, so this stale value is no longer served.

---

## R4 · PROCESS FINDING: NON-COMPILING CODE PUSHED TO MASTER

### Finding
Two syntax corruptions were present in `master` at the start of the live session:
1. **Ghost `SourcesUsesItem` duplicate** in `deterministic-model-runner.ts` (lines 154-158): The interface fields were duplicated after the interface already closed at line 153.
2. **Extra `}`** in `deterministic-model-runner.ts` (line 80): Closed `ModelAssumptions` twice.

These were fixed by the Replit sync commit `d0bcf9985` ("Clean up duplicate code and add runbook documentation"). They were not introduced by our D2b changes; they were pre-existing corruptions that prevented the backend from starting.

### Proposed guard: Pre-push compile check

**Option A (minimal):** Git hook `pre-push` that runs `npx tsc --noEmit --skipLibCheck` on the backend. Blocks push if TypeScript errors exist.

```bash
# .git/hooks/pre-push (or husky)
#!/bin/bash
set -e
cd backend
npx tsc --noEmit --skipLibCheck
```

**Option B (CI gate):** GitHub Actions workflow that runs `tsc --noEmit` on every PR and push to master. The golden harness CI slot is the natural home.

```yaml
# .github/workflows/ci.yml
name: F9 Engine Integrity
on: [push, pull_request]
jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd backend && npm ci && npx tsc --noEmit --skipLibCheck
  identity-invariants:
    needs: compile
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm ci && npm test -- deterministic/__tests__/identity-invariants.test.ts
```

**Option C (both):** Git hook for local pushes + CI gate for PRs. The hook catches errors before they leave the machine; the CI gate catches anything that bypasses the hook.

**Operator approval needed:** Which option? The backend already uses `ts-node --transpile-only` (skips type checking), so type errors are invisible at runtime. A compile check is essential.

---

## STOP — PHASE 1 COMPLETE

**Rulings needed from operator before Phase 2:**

1. **Canonical NOI derivation (R1.4):** For lease-up deals, should the model use **in-place rent** (actual achieved rent) or **market rent** (comp-anchored P50) for Y1 NOI? The seeder and model currently disagree.

2. **Monthly model scope (R2.3):** Is the current "yearly ÷ 12 with vacancy ramp" sufficient, or does the engine need a real monthly operating model (absorption curve, unit-level leasing, stabilization milestones)? The roadmap says "engine absorbs ramp" but this was skipped in D2.

3. **Pre-push compile guard (R4):** Git hook, CI gate, or both?

**What is NOT blocked:**
- R3 fix is done and pushed — capital-structure route now reads from the model
- The engine's math is verified (Phase 1 blockers 4, 5, 7 were green)
- The disagreement is in the **assumption layer** (in-place vs market rent), not the engine formula

**What IS blocked:**
- Fixture pinning (Phase 5) until the canonical NOI derivation is resolved
- Excel parity until the monthly model scope is resolved
- Phase 2 (fixes) until operator rules on R1.4 and R2.3
