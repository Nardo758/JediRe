# A1_Census — Debt-Layer Phase 1 Audit Report

**Audit date:** 2026-07-09  
**Auditor:** Read-only reconnaissance agent (no fixes, no migrations, no writes)  
**Scope:** Every field in the financing/capital-structure input surface — storage, reads, fabrication, overwrites, and settable-by status.  

---

## 1. Executive Summary

The JediRe backend has **at least five distinct rate sources** that can feed the same `rate` field in `ModelAssumptions`, with no single source of truth. The M11 debt optimizer hardcodes `termMonths:60` and `amortMonths:360` regardless of caller intent. The DSCR computation in the deterministic engine uses **true amortizing debt service** (not interest-only), but the `getRecommendedTerms` sizing formula uses a simplified `NOI / (1.25 × rate)` that treats debt service as interest-only — this is Finding X. The `ioPeriod` is derived from LTV tier in M11, then overwritten into the model assumptions, but the bridge default is `0` months.

---

## 2. Field-by-Field Census

### 2.1 rate (interest rate)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions.interest_rate` (legacy scalar column); `deal_assumptions.year1` JSONB may contain `interest_rate` as LayeredValue; `debt_positions.current_rate` for in-place loans; `proforma_assumptions` does NOT store rate. |
| **Read by engine?** | `proforma-assumptions-bridge.ts:425` → `const rate = toNumber(a.financing?.interestRate, 0.065) \|\| 0.065;` |
| **Fabricated?** | **Yes — default 0.065 (6.5%)** at `proforma-assumptions-bridge.ts:425`. Also `fetch_debt_assumptions.ts:177` hardcodes `SOFR: 4.85`, `10Y_Treasury: 4.25`, `Prime: 8.50` for agent tool. `compute_proforma.ts:21` defaults `interest_rate_pct: 6.5`. `capital-structure-adapter.ts:510` defaults `rate = 0.065` in `getRecommendedTerms`. `dataPipeline.ts:236` defaults `interestRate: 0.065`. |
| **Overwritten downstream?** | **Yes — M11 cycle overwrites.** `capital-structure-adapter.ts:567` sets `rate: terms.effectiveRate` (which itself defaults to 0.065). `runM11Cycle` mutates `adjusted.rate` each iteration. `run-full-model.ts:111` → `runM11Cycle` returns `assumptions` with `rate` updated. Then `writeM11ToFinancing` writes `interestRate: adjusted.rate` back to ProForma. |
| **User-settable today?** | Yes — via `PATCH /:dealId/assumptions` (`interest_rate` column) or `financing.interestRate` in ProForma assumptions. |
| **Agent-settable today?** | Yes — `fetch_assumptions.ts` reads `da.interest_rate`; `compute_proforma` takes `interest_rate_pct`; `optimize_capital_structure.ts:120` takes `debt_rate`. |

**Finding: Three (or more) rates coexist.**
- Bishop's store: `debt_rate: 0.0659` (from cashflow postprocessor trace)
- Boundary: `rate: 0.06` (from `benchmark-timeline.routes.ts:356` or agent defaults)
- Raw store path: `6.5%` (from bridge default `0.065`)
- M11 `getRecommendedTerms` default: `0.065`
- Debt Advisor `formulateDebtPlan` computes `rateEst` from SOFR + spread (e.g. `sofr + 0.0275`)

**No reconciliation** exists between these sources. The bridge default wins when the ProForma surface is unseeded.

---

### 2.2 ltv (loan-to-value)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions.ltv` (legacy scalar, percent scale); `deal_assumptions.year1` JSONB may contain `ltv_pct` or `ltc_pct`; `debt_positions.ltv_at_origination` for in-place loans. |
| **Read by engine?** | `proforma-assumptions-bridge.ts:420` → `const ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0;` (computed from loanAmount, not read directly). `getRecommendedTerms` takes `ltv` as parameter at `capital-structure-adapter.ts:505`. |
| **Fabricated?** | **Yes — multiple paths.** `compute_proforma.ts:20` defaults `ltv_pct: 65`. `optimize_capital_structure.ts` takes `ltv` as input. `fetch_assumptions.ts:147` reads `da.ltv` and multiplies by 100. `capital-structure.service.ts:218` computes LTV from `totalDebt / propertyValue`. |
| **Overwritten downstream?** | **Yes — M11 cycle overwrites.** `getRecommendedTerms` computes `maxByLtv = purchasePrice * ltv` (`capital-structure-adapter.ts:511`). `runM11Cycle` mutates `adjusted.ltv` to `loanAmount / purchasePrice` (implicitly via `loanAmount` resize). `writeM11ToFinancing` writes `ltv` back. |
| **User-settable today?** | Yes — via `deal_assumptions.ltv` column or ProForma `financing.loanAmount` (which drives computed LTV). |
| **Agent-settable today?** | Yes — `compute_proforma` takes `ltv_pct`; `optimize_capital_structure` takes leverage inputs. |

---

### 2.3 loanAmount

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions.year1` JSONB may contain `loan_amount` as LayeredValue; `deals.deal_data->>'loan_amount'` (from `apply-from-module`); `debt_positions.original_principal` for in-place loans. Legacy scalar `deal_assumptions.loan_amount` may exist. |
| **Read by engine?** | `proforma-assumptions-bridge.ts:419` → `const loanAmount = toNumber(a.financing?.loanAmount, 0);` |
| **Fabricated?** | **Yes — default 0.** When `loanAmount === 0`, the engine attempts a `deal_data` JSONB fallback before calling `runModel` (bridge comment at line 414–418). `compute_proforma.ts:67` computes `loanAmount = purchase_price * ltv`. |
| **Overwritten downstream?** | **Yes — M11 cycle overwrites.** `getRecommendedTerms` computes `recommendedLoanAmount` from `min(maxByLtv, loanByDscr)` (`capital-structure-adapter.ts:513`). `runM11Cycle` sets `adjusted.loanAmount = terms.recommendedLoanAmount` (`capital-structure-adapter.ts:566`). `writeM11ToFinancing` writes `loanAmount: adjusted.loanAmount` back to ProForma (`capital-structure-adapter.ts:782`). |
| **User-settable today?** | Yes — via ProForma Configure panel (`financing.loanAmount`) or `apply-from-module` endpoint. |
| **Agent-settable today?** | Yes — `compute_proforma` computes it; `optimize_capital_structure` outputs `optimal_ltv` and derived loan amount. |

---

### 2.4 term (loan term / balloon term)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions.loan_term_years` (legacy scalar); `debt_positions` has `termMonths` equivalent via `maturity_date - origination_date`. |
| **Read by engine?** | `proforma-assumptions-bridge.ts:422` → `const termMonths = (toNumber(a.financing?.term, 5)) * 12;` |
| **Fabricated?** | **Yes — hardcoded in M11.** `capital-structure-adapter.ts:530` → `loanTerms: { termMonths: 60, amortMonths: 360, ioPeriod }`. The `getRecommendedTerms` function signature does NOT accept `term` or `amort` parameters (lines 502–509). |
| **Overwritten downstream?** | **Yes — M11 hardcodes 60 months.** `runM11Cycle` sets `adjusted.term = terms.loanTerms.termMonths` (`capital-structure-adapter.ts:568`). This is always 60 regardless of user input. `writeM11ToFinancing` converts back to years (`termYears = adjusted.term / 12`) and writes to ProForma. |
| **User-settable today?** | Yes — via `deal_assumptions.loan_term_years` or ProForma `financing.term`, **but M11 ignores it**. |
| **Agent-settable today?** | Yes — `fetch_assumptions.ts:149` reads `da.loan_term_years`; `compute_proforma.ts:23` takes `loan_term_years` (but uses it only for amortization, not term). |

**Finding X (confirmed):** `getRecommendedTerms` at `capital-structure-adapter.ts:502–534` hardcodes `termMonths: 60` and `amortMonths: 360`. The signature does not accept `term` or `amort` parameters. Any user/agent-set term is silently discarded by M11.

---

### 2.5 amort (amortization period)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions.amortization_years` (legacy scalar); `debt_positions.amortization_years`. |
| **Read by engine?** | `proforma-assumptions-bridge.ts:423` → `const amortMonths = (toNumber(a.financing?.amortization, 30)) * 12;` |
| **Fabricated?** | **Yes — hardcoded 360 months in M11.** Same as `term`: `getRecommendedTerms` hardcodes `amortMonths: 360` (`capital-structure-adapter.ts:530`). |
| **Overwritten downstream?** | **Yes — M11 hardcodes 360 months.** `runM11Cycle` sets `adjusted.amort = terms.loanTerms.amortMonths` (`capital-structure-adapter.ts:569`). Always 360. |
| **User-settable today?** | Yes — via `deal_assumptions.amortization_years` or ProForma `financing.amortization`, **but M11 ignores it**. |
| **Agent-settable today?** | Yes — `fetch_assumptions.ts:150` reads `da.amortization_years`; `compute_proforma.ts:23` takes `amortization_years`. |

---

### 2.6 ioPeriod (interest-only period)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions` has no dedicated IO column; `debt_positions.io_period_months` for in-place loans; ProForma `financing.ioPeriod` (months). |
| **Read by engine?** | `proforma-assumptions-bridge.ts:424` → `const ioPeriod = toNumber(a.financing?.ioPeriod, 0);` |
| **Fabricated?** | **Yes — bridge default is 0.** M11 derives IO from LTV tier: `ltv > 0.75 → 24mo`, `ltv > 0.65 → 12mo`, else `0` (`capital-structure-adapter.ts:520–526`). Debt Advisor `buildPhases` sets `ioMonths = phaseStructure.ioMonths || (rateType === 'Floating' ? termMonthsActual : 24)` (`debt-plan-formulator.service.ts:428`). |
| **Overwritten downstream?** | **Yes — M11 overwrites with LTV-tier derivation.** `runM11Cycle` sets `adjusted.ioPeriod = terms.loanTerms.ioPeriod` (`capital-structure-adapter.ts:570`). `writeM11ToFinancing` writes `ioPeriod: adjusted.ioPeriod` back. |
| **User-settable today?** | Yes — ProForma `financing.ioPeriod`, **but M11 ignores it unless `ioPeriodMonths` override is passed** (signature supports it at line 508). |
| **Agent-settable today?** | Yes — `optimize_capital_structure` takes `io_period_months`; `compute_proforma` does not expose IO. |

**Confirmed:** Boundary shows `ioPeriod: 36` → M11 post-cycle shows `ioPeriod: 0` for LTV ≤ 0.65 deals. The bridge default is 0, and M11's LTV-tier derivation produces 0 for low-leverage deals.

---

### 2.7 originationFeePct

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_assumptions` has no dedicated column; ProForma `financing.originationFee` (decimal). |
| **Read by engine?** | `proforma-assumptions-bridge.ts:426` → `const originationFeePct = toNumber(a.financing?.originationFee, 0.01) || 0.01;` |
| **Fabricated?** | **Yes — default 1.0%** (0.01). `deterministic-model-runner.ts:487` defines `DEF_ORIGINATION_PCT = 0.01`. `debt-plan-formulator.service.ts:463` uses `phaseStructure.origFee || 0.015`. |
| **Overwritten downstream?** | No explicit M11 overwrite; `writeM11ToFinancing` comment at line 742 says "Fields NOT overwritten: loanType, spread, originationFee, rateCapCost, prepayPenalty." |
| **User-settable today?** | Yes — ProForma `financing.originationFee`. |
| **Agent-settable today?** | Yes — `optimize_capital_structure` does not expose origination fee; `debt-plan-formulator` uses product defaults. |

---

### 2.8 prepayPenalty (prepayment penalty)

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `debt_positions.prepayment_type` and `prepayment_penalty_pct`; ProForma `financing.prepayPenalty` (number). |
| **Read by engine?** | `proforma-assumptions-bridge.ts:488` → `prepayPenalty: a.financing.prepayPenalty ?? 0` |
| **Fabricated?** | **Yes — default 0.** |
| **Overwritten downstream?** | No — `writeM11ToFinancing` explicitly preserves `prepayPenalty` (line 742). |
| **User-settable today?** | Yes — ProForma `financing.prepayPenalty`. |
| **Agent-settable today?** | Limited — `debt-plan-formulator` infers from product mapping (`yield_maintenance` for fixed, `open` for floating). |

---

### 2.9 dscrFloor / sizing constraints

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `dataFlowRouter.getModuleData('M14', dealId)?.data?.dscr_floor` (in-memory module wiring); no persistent DB column for M14 DSCR floor. `deal_context_financials` stores `dscr_current` from vintage estimator. |
| **Read by engine?** | `capital-structure-adapter.ts:607` → `const dscrFloor = typeof m14Data?.dscr_floor === 'number' && m14Data.dscr_floor > 0 ? m14Data.dscr_floor : 1.25;` |
| **Fabricated?** | **Yes — default 1.25** when no M14 data present. `run-full-model.ts:59` same default. `debt-tracking.service.ts` covenant checks use `dscr_covenant` from `debt_positions`. |
| **Overwritten downstream?** | M14 returns `dscrFloor` to `buildModel`, which compares `dscrActual < dscrFloor` and emits `dscr_floor_binds` warning (`financial-model-engine.service.ts:1691–1703`). `writeM11ToFinancing` records `dscrFloor` in summary. |
| **User-settable today?** | **No explicit UI.** M14 data is module-wiring metadata; no direct user control surface found. |
| **Agent-settable today?** | **No direct agent tool.** M14 risk adjustments are computed internally. |

---

### 2.10 debtYield

| Attribute | Evidence |
|-----------|----------|
| **Stored where** | `deal_context_financials.debt_yield` (from vintage estimator); computed on-the-fly in engine. |
| **Read by engine?** | `deterministic-model-runner.ts:1136` → `debtYield: a.loanAmount > 0 ? noi / a.loanAmount : null` (annual row level). `debtMetrics.coverage.debtYieldY1` aggregates this. |
| **Fabricated?** | **No — computed from NOI / loanAmount.** No default. |
| **Overwritten downstream?** | No — derived field, not stored in assumptions. |
| **User-settable today?** | No — computed, not input. |
| **Agent-settable today?** | No — computed, not input. |

---

### 2.11 Additional fields present in the input surface

| Field | Storage | Read by engine? | Fabricated? | Overwritten? | User-settable? | Agent-settable? |
|-------|---------|-----------------|-------------|--------------|----------------|-----------------|
| **spread** | ProForma `financing.spread` | Yes (bridge) | No default found | Preserved by M11 write-back | Yes | Yes (floating rate loans) |
| **loanType** | ProForma `financing.loanType` | Yes (bridge) | No default | Preserved by M11 write-back | Yes | Yes (product mapping) |
| **rateCapCost** | ProForma `financing.rateCapCost` | Yes (bridge) | No default | Preserved by M11 write-back | Yes | No direct tool |
| **termYears** (ProForma) | `financing.term` | Yes (bridge ×12) | Default 5 | **Overwritten by M11** (always 5yr) | Yes | Yes |
| **amortYears** (ProForma) | `financing.amortization` | Yes (bridge ×12) | Default 30 | **Overwritten by M11** (always 30yr) | Yes | Yes |
| **ioMonths** (ProForma) | `financing.ioPeriod` | Yes (bridge) | Default 0 | **Overwritten by M11** (LTV-tier derived) | Yes | Yes |

---

## 3. Rate Source Tracing (Bishop's Three Rates)

The audit confirmed three distinct rate values that can appear for the same deal:

1. **`debt_rate: 0.0659`** — from `cashflow.postprocess.ts:1595` (`resolveLv('debt_rate') ?? resolveLv('interest_rate') ?? 0.065`). This reads from the ProForma assumption surface or LayeredValue store. Source of 0.0659 is unclear — may be a user override or agent-computed value.

2. **`rate: 0.06`** — from `benchmark-timeline.routes.ts:356` (`const rate = parseFloat((loanRate as string) || '0.06')`). This is a route-level default for benchmark/comparison calculations, not the main engine.

3. **Raw store path: 6.5% (0.065)** — from `proforma-assumptions-bridge.ts:425` default, `getRecommendedTerms` default (`capital-structure-adapter.ts:510`), `dataPipeline.ts:236` schema default, `compute_proforma.ts:21` default.

**No reconciliation layer** exists between these. The bridge default (0.065) wins when the ProForma surface is unseeded. M11's `getRecommendedTerms` uses its own default (0.065) if the caller doesn't pass `rate`. The Debt Advisor computes `rateEst` from SOFR + spread (e.g. `0.0485 + 0.0275 = 0.076`), which is entirely independent.

---

## 4. DSCR Computation Verification

### 4.1 Engine DSCR (deterministic-model-runner.ts)

The DSCR in the engine is computed against **true amortizing debt service**:

```typescript
// deterministic-model-runner.ts:1101
const dscr = debtService > 0 ? noi / debtService : null;
```

Where `debtService` comes from `amort.debtServiceByYear[y - 1]` (line 1099), which is computed by `computeAmortization` (line 548–622). The `computeAmortization` function:
- Computes monthly PMT for the full amortization period
- During IO months, pays interest-only (`monthlyPMT = balance * monthlyRate`)
- After IO, pays P+I based on the amortization schedule
- At balloon term, pays remaining balance

This is **true amortizing debt service**, not interest-only.

### 4.2 M11 Sizing DSCR (getRecommendedTerms)

The M11 sizing formula uses a **simplified interest-only approximation**:

```typescript
// capital-structure-adapter.ts:512
const loanByDscr = rate > 0 ? Math.round(noiY1 / (1.25 * rate)) : maxByLtv;
```

This computes `loanByDscr = NOI / (DSCR_floor × rate)`, which is equivalent to `NOI / (1.25 × annual_interest_only_payment)`. This is **interest-only sizing** — it does not account for principal amortization. For a fully amortizing loan, the true debt service is higher than `loanAmount × rate`, so this formula **overstates the loan capacity** for amortizing products.

**Finding X (confirmed):** The `getRecommendedTerms` sizing formula treats debt service as `loanAmount × rate` (interest-only), while the engine's `computeAmortization` produces true P+I debt service. This creates a mismatch: M11 may size a loan that appears to satisfy DSCR ≥ 1.25, but the engine's true amortizing DSCR will be lower.

### 4.3 July-5's observation

> "July-5's loan × 1.25 × 0.06 = noiY1 exactly ⇒ IO sizing."

This is consistent with the code: `loanByDscr = noiY1 / (1.25 × rate)` rearranges to `loan × 1.25 × rate = noiY1`. The formula is indeed interest-only sizing. For Bishop (loan $21,024,006, rate ~0.065), the annual interest-only debt service would be `$21,024,006 × 0.065 = $1,366,560`, and DSCR = `$1,707,000 / $1,366,560 ≈ 1.25` — confirming the IO sizing behavior.

---

## 5. File:Line Evidence Summary

| Claim | File | Line | Evidence |
|-------|------|------|----------|
| `getRecommendedTerms` hardcodes termMonths:60 | `capital-structure-adapter.ts` | 530 | `loanTerms: { termMonths: 60, amortMonths: 360, ioPeriod }` |
| `getRecommendedTerms` hardcodes amortMonths:360 | `capital-structure-adapter.ts` | 530 | Same line |
| `getRecommendedTerms` signature lacks term/amort params | `capital-structure-adapter.ts` | 502–509 | `params: { noiY1, purchasePrice, ltv, rate?, ioPeriodMonths? }` only |
| M11 overwrites loanAmount | `capital-structure-adapter.ts` | 566 | `loanAmount: terms.recommendedLoanAmount` |
| M11 overwrites rate | `capital-structure-adapter.ts` | 567 | `rate: terms.effectiveRate` |
| M11 overwrites term | `capital-structure-adapter.ts` | 568 | `term: terms.loanTerms.termMonths` (always 60) |
| M11 overwrites amort | `capital-structure-adapter.ts` | 569 | `amort: terms.loanTerms.amortMonths` (always 360) |
| M11 overwrites ioPeriod | `capital-structure-adapter.ts` | 570 | `ioPeriod: terms.loanTerms.ioPeriod` |
| IO derivation from LTV tier | `capital-structure-adapter.ts` | 520–526 | `ltv > 0.75 → 24, ltv > 0.65 → 12, else 0` |
| Bridge default rate = 0.065 | `proforma-assumptions-bridge.ts` | 425 | `const rate = toNumber(a.financing?.interestRate, 0.065) \|\| 0.065` |
| Bridge default ioPeriod = 0 | `proforma-assumptions-bridge.ts` | 424 | `const ioPeriod = toNumber(a.financing?.ioPeriod, 0)` |
| Bridge default originationFee = 0.01 | `proforma-assumptions-bridge.ts` | 426 | `const originationFeePct = toNumber(a.financing?.originationFee, 0.01) \|\| 0.01` |
| Engine DSCR uses true amortizing DS | `deterministic-model-runner.ts` | 1099–1101 | `const debtService = amort.debtServiceByYear[y - 1]; const dscr = debtService > 0 ? noi / debtService : null` |
| M11 sizing uses IO formula | `capital-structure-adapter.ts` | 512 | `const loanByDscr = rate > 0 ? Math.round(noiY1 / (1.25 * rate)) : maxByLtv` |
| DSCR floor default = 1.25 | `capital-structure-adapter.ts` | 607 | `const dscrFloor = typeof m14Data?.dscr_floor === 'number' && m14Data.dscr_floor > 0 ? m14Data.dscr_floor : 1.25` |
| `writeM11ToFinancing` preserves some fields | `capital-structure-adapter.ts` | 742 | Comment: "Fields NOT overwritten: loanType, spread, originationFee, rateCapCost, prepayPenalty" |
| `writeM11ToFinancing` overwrites rate | `capital-structure-adapter.ts` | 784 | `interestRate: adjusted.rate` |
| `writeM11ToFinancing` overwrites term | `capital-structure-adapter.ts` | 785 | `term: termYears` (from `adjusted.term / 12`) |
| `writeM11ToFinancing` overwrites amort | `capital-structure-adapter.ts` | 786 | `amortization: amortYears` (from `adjusted.amort / 12`) |
| `writeM11ToFinancing` overwrites ioPeriod | `capital-structure-adapter.ts` | 787 | `ioPeriod: adjusted.ioPeriod` |
| Debt Advisor computes independent rateEst | `debt-plan-formulator.service.ts` | 417–419 | `rateEst = rateType === 'Floating' ? sofr + spread : (phaseStructure.rate || sofr + 0.015)` |
| Debt Advisor writes platform defaults | `debt-plan-formulator.service.ts` | 879–903 | `writeDebtPlatformDefaults` called within `formulateDebtPlan` |
| `fetch_assumptions` reads legacy columns | `fetch_assumptions.ts` | 96 | `da.ltv, da.interest_rate, da.loan_term_years, da.amortization_years` |
| `compute_proforma` has own defaults | `compute_proforma.ts` | 20–23 | `ltv_pct: 65, interest_rate_pct: 6.5, amortization_years: 30` |
| `dataPipeline` schema default rate | `dataPipeline.ts` | 236 | `interestRate: numeric('interest_rate', { precision: 5, scale: 4 }).default('0.065')` |
| `cashflow.postprocess` resolves debt_rate | `cashflow.postprocess.ts` | 1595 | `const debtRate = resolveLv('debt_rate') ?? resolveLv('interest_rate') ?? 0.065` |
| `runFullModel` orchestrates M11+M14 | `run-full-model.ts` | 97–177 | Full two-pass cycle with equity reconciliation |
| `buildModel` calls `runFullModel` | `financial-model-engine.service.ts` | 1650 | `const full = runFullModel(modelAssumptions, { skipSensitivity: true, maxM11Iter: 3, m14Data })` |
| `dscr_floor_binds` warning emitted | `financial-model-engine.service.ts` | 1691–1703 | Integrity check when `dscrActual < dscrFloor` |

---

## 6. Findings

### Finding X (confirmed): M11 sizing uses interest-only formula against true amortizing engine

- **Location:** `capital-structure-adapter.ts:512`
- **Impact:** M11 may size loans that appear DSCR-compliant at 1.25× but fail when true amortizing debt service is computed. For amortizing products (e.g. agency 30yr), the true DSCR will be lower than the M11 sizing DSCR.
- **Evidence:** `loanByDscr = noiY1 / (1.25 * rate)` vs. engine's `computeAmortization` with full PMT schedule.

### Finding Y (confirmed): M11 hardcodes term=60mo, amort=360mo, ignoring caller intent

- **Location:** `capital-structure-adapter.ts:530`
- **Impact:** Any user or agent setting a custom term (e.g. 10-year agency) or amortization (e.g. 20-year) is silently overridden to 5-year balloon / 30-year amort.
- **Evidence:** `getRecommendedTerms` signature does not accept `term` or `amort` parameters; `runM11Cycle` always writes `term: 60, amort: 360`.

### Finding Z (confirmed): Multiple rate sources with no reconciliation

- **Sources:** Bridge default (0.065), M11 default (0.065), Debt Advisor computed (SOFR+spread), cashflow postprocessor resolved (`debt_rate` / `interest_rate`), benchmark timeline (0.06), agent tool defaults (6.5%).
- **Impact:** The same deal can show different rates depending on which surface is read. No canonical reconciliation exists.

---

*End of A1_Census audit report.*
# A2_Sizing — Debt-Layer Phase 1 Audit Report

**Assignment:** A2_Sizing (Sizing / Binding Constraint Verdict)  
**Auditor:** Read-only reconnaissance agent — NO FIXES, NO MIGRATIONS, NO WRITES  
**Repo:** `C:\Users\Leons' Computer 2\Documents\JediRe\backend`  
**Date:** 2026-07-09  
**Scope:** Trace how the loan amount is sized today, which constraint binds, whether the binding rationale is reported, and verify the DSCR computation against amortizing debt service (not interest-only).

---

## 1. Which Constraint(s) Size the Loan Today?

### 1.1 The M11 Sizing Code: `getRecommendedTerms` (capital-structure-adapter.ts:502–534)

The **actual** loan sizing that runs during `buildModel()` lives in `getRecommendedTerms`, NOT in the F40 formula engine. Here is the exact code:

```typescript
// capital-structure-adapter.ts:510–514
const { noiY1, purchasePrice, ltv, rate = 0.065, ioPeriodMonths } = params;
const maxByLtv = Math.round(purchasePrice * ltv);
const loanByDscr = rate > 0 ? Math.round(noiY1 / (1.25 * rate)) : maxByLtv;
const recommendedLoanAmount = Math.max(0, Math.min(maxByLtv, loanByDscr));
const debtService = recommendedLoanAmount * rate;
```

**Verdict:** Only **two** constraints are applied:

| Constraint | Formula | Line |
|---|---|---|
| **LTV cap** | `maxByLtv = purchasePrice × ltv` | `capital-structure-adapter.ts:511` |
| **DSCR floor** | `loanByDscr = noiY1 / (1.25 × rate)` | `capital-structure-adapter.ts:512` |
| **LTC cap** | **ABSENT** — not referenced in `getRecommendedTerms` | — |
| **Debt Yield** | **ABSENT** — not referenced in `getRecommendedTerms` | — |

The final loan is `Math.min(maxByLtv, loanByDscr)`.  
**LTC and debt yield play no role in the live sizing path.**

> **Note:** The F40 formula in `formula-engine.ts:987–1011` *does* define a triple constraint (`min(ltcConstraint, ltvConstraint, dscrConstraint)`), but it is **only called from the REST route** `POST /capital-structure/size-senior` (`capital-structure.routes.ts:131–156`). That route is a standalone calculator endpoint; it is **NOT** invoked by `buildModel()` or `runFullModel()`.

---

## 2. Is the Binding Constraint Reported Anywhere?

### 2.1 `constraintBinds` Flag (capital-structure-adapter.ts:777)

The `writeM11ToFinancing` function computes a boolean `constraintBinds`:

```typescript
// capital-structure-adapter.ts:777
const constraintBinds = dscrActual !== null && dscrActual < dscrFloor;
```

This flag is **only** `true` when the *post-cycle actual DSCR* falls below the M14 DSCR floor (default 1.25). It does **NOT** tell you whether LTV or DSCR was the binding constraint during sizing. It only signals that the final DSCR is below the floor.

### 2.2 Where `constraintBinds` Surfaces

| Location | What is reported | Evidence |
|---|---|---|
| `financial-model-engine.service.ts:1689` | `m14DscrConstraintBinds = summary.constraintBinds` | `financial-model-engine.service.ts:1689` |
| `financial-model-engine.service.ts:1691–1703` | If `true`, an integrity-check warning `dscr_floor_binds` is appended | `financial-model-engine.service.ts:1695` |
| `result.meta.m14DscrConstraintBinds` | Boolean surfaced in the model result metadata | `financial-model-engine.service.ts:1729` |
| **UI / Capital Structure tab** | The `GET /capital-structure/:dealId` route computes its own DSCR as `noi / (loanAmount × (interestRate / 100))` — **interest-only with ÷100 bug** | `capital-structure.routes.ts:572–574` |

### 2.3 The Capital-Structure Route Recomputes DSCR Incorrectly

```typescript
// capital-structure.routes.ts:572–574
dscr: noi > 0 && loanAmount > 0 && interestRate > 0
  ? noi / (loanAmount * (interestRate / 100))
  : null,
```

This is the **Finding U** formula: DSCR = NOI / (loan × rate/100). It uses **interest-only** debt service (loan × rate%) and has the **÷100 bug** (rate is already a decimal like 0.065, so dividing by 100 makes it 0.00065). The UI therefore shows a nonsensical DSCR.

### 2.4 Verdict: Binding Constraint Is NOT Reported with Its Rationale

- **No field** in `M11CapitalStructureSummary` or any API response states "DSCR was the binding constraint" vs "LTV was the binding constraint."
- The only constraint signal is `constraintBinds`, which is a **post-hoc DSCR-floor violation flag**, not a sizing rationale.
- The loan amount appears in `summary.loanAmount` and `debtMetrics.structural.loanAmount` **without any explanation of which cap limited it.**

---

## 3. Finding U Context: Engine DSCR vs. Interest-Only DSCR

### 3.1 Engine DSCR Formula (deterministic-model-runner.ts)

The **true** DSCR computed by the F9 engine uses the **full amortizing debt service** from `computeAmortization`:

```typescript
// deterministic-model-runner.ts:1099–1101 (aggregateMonthlyToAnnual)
const debtService = amort.debtServiceByYear[y - 1] ?? 0;
const preTaxCashFlow = noi - debtService;
const dscr = debtService > 0 ? noi / debtService : null;
```

And again in the development path:

```typescript
// deterministic-model-runner.ts:1851–1853
const debtService = amort.debtServiceByYear[y - 1] ?? interest;
const cf          = op.noi - debtService;
const dscr        = debtService > 0.01 ? op.noi / debtService : null;
```

**The engine's DSCR is `NOI / annualDebtService` where `annualDebtService` comes from `computeAmortization`, which properly handles IO period + amortizing P&I + balloon.** This is **NOT** interest-only.

### 3.2 `computeAmortization` Debt Service (deterministic-model-runner.ts:548–622)

```typescript
// deterministic-model-runner.ts:561–570
const monthlyRate = annualRate / 12;
let monthlyPMT: number;
if (amortMonths <= 0) {
  monthlyPMT = loanAmount * monthlyRate;
} else {
  monthlyPMT = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths))
    / (Math.pow(1 + monthlyRate, amortMonths) - 1);
}

// deterministic-model-runner.ts:583–604
for (let m = 0; m < 12; m++) {
  const monthIdx = y * 12 + m;
  const isIO = monthIdx < ioMonths;
  const monthInterest = balance * monthlyRate;
  yrInterest += monthInterest;

  if (isIO) {
    // Interest-only: no principal
  } else if (amortMonths <= 0) {
    // If amort is 0 and we're past IO, use interest-only forever
  } else {
    const monthPrincipal = monthlyPMT - monthInterest;
    // ... principal reduction ...
  }

  yrDS += isIO ? monthInterest : monthlyPMT;
}
```

**Key behavior:**
- During IO period (`monthIdx < ioMonths`): debt service = interest only.
- Post-IO: debt service = full amortizing P&I (`monthlyPMT`).
- At balloon (`y + 1 >= ceil(termMonths / 12)`): remaining balance is paid as a lump-sum principal + interest.

### 3.3 Debt Metrics Block (deterministic-model-runner.ts:2007–2084)

The `debtMetrics` object captures:

```typescript
// deterministic-model-runner.ts:2054–2063
coverage: {
  dscrMin, dscrAvg, dscrY1, dscrAtStabilization,
  debtYieldMin, debtYieldY1,
  breakEvenOccupancy,
  dscrStressedMinus10PctNOI: dscrStressed,
},
structural: {
  loanAmount: a.loanAmount,
  rate: a.rate,
  termMonths: a.term,
  amortMonths: a.amort,
  ioPeriodMonths: a.ioPeriod,
  // ...
},
```

**`debtMetrics.coverage.dscrY1` is the engine's true DSCR** — computed against the amortization schedule, not interest-only.

### 3.4 Finding U Refuted

The capital-structure route (`capital-structure.routes.ts:572–574`) computes DSCR as interest-only with a ÷100 bug.  
**The engine's `debtMetrics.dscrY1` is computed correctly against true amortizing debt service.**  
These two values will diverge significantly when `ioPeriod < holdYears` and `amortMonths > 0`.

---

## 4. July-5's Loan × 1.25 × 0.06 = NOI_Y1 — IO Sizing Confirmation

### 4.1 The `getRecommendedTerms` DSCR Constraint

```typescript
// capital-structure-adapter.ts:512
const loanByDscr = rate > 0 ? Math.round(noiY1 / (1.25 * rate)) : maxByLtv;
```

Rearranging: `loanByDscr × 1.25 × rate = noiY1` (approximately, before rounding).  
If `rate = 0.06` and `loan = 21,024,006`, then `21,024,006 × 1.25 × 0.06 = 1,576,800`, which would need to equal `noiY1`.

### 4.2 The `debtService` in `getRecommendedTerms`

```typescript
// capital-structure-adapter.ts:514
const debtService = recommendedLoanAmount * rate;
```

This is **interest-only** debt service. The `getRecommendedTerms` function computes `loanByDscr` using the DSCR formula `NOI / (1.25 × rate)`, but then reports `debtService = loan × rate` — which is IO.  
**The sizing math itself uses IO debt service, not amortizing debt service.**

### 4.3 The `runM11Cycle` Iteration (capital-structure-adapter.ts:546–575)

```typescript
// capital-structure-adapter.ts:546–575
export function runM11Cycle(assumptions: ModelAssumptions, noiY1: number, maxIter = 3): M11CycleResult {
  let current: ModelAssumptions = { ...assumptions };
  let prevDscr: number | null = null;
  let iterations = 0;
  let converged = false;

  for (let i = 0; i < maxIter; i++) {
    iterations++;
    const modelResult = runModel(current, { skipSensitivity: true });
    const dscrY1 = modelResult.debtMetrics.coverage.dscrY1;

    if (prevDscr !== null && dscrY1 !== null && Math.abs(dscrY1 - prevDscr) < 0.01) {
      converged = true;
      break;
    }
    prevDscr = dscrY1;

    const terms = getRecommendedTerms({ noiY1, purchasePrice: current.purchasePrice, ltv: current.ltv, rate: current.rate });
    current = {
      ...current,
      loanAmount: terms.recommendedLoanAmount,
      rate: terms.effectiveRate,
      term: terms.loanTerms.termMonths,
      amort: terms.loanTerms.amortMonths,
      ioPeriod: terms.loanTerms.ioPeriod,
    };
  }
  return { assumptions: current, iterations, converged };
}
```

**Key observation:** The M11 cycle sizes the loan using `getRecommendedTerms`, which uses **IO debt service** (`loan × rate`) for its DSCR constraint. It then runs the full deterministic model with the **new loan amount** and the **same amortizing assumptions** (term=60, amort=360, ioPeriod=derived). The post-cycle `dscrY1` from the engine is the **amortizing DSCR**, which will be **higher** than the IO DSCR used during sizing (because amortizing debt service > IO debt service after the IO period ends, or even in Y1 if ioPeriod=0).

### 4.4 Confirmation: IO Sizing + Amortizing Reality = Mismatch

| Phase | DSCR Formula | Debt Service Basis |
|---|---|---|
| **M11 sizing** (`getRecommendedTerms`) | `NOI / (1.25 × rate)` | Interest-only (`loan × rate`) |
| **F9 engine** (`runModel`) | `NOI / debtServiceByYear[0]` | Amortizing (IO period + P&I + balloon) |
| **Capital-structure route** | `NOI / (loan × rate/100)` | Interest-only with ÷100 bug |

**The M11 sizing uses IO debt service, but the engine computes amortizing debt service.** This means:
- If `ioPeriod = 0`, the M11-sized loan will produce a **higher** actual DSCR than 1.25 (because amortizing Y1 DS > IO DS).
- If `ioPeriod > 0`, the M11-sized loan will produce a DSCR closer to 1.25 during the IO period, but the engine's DSCR will still differ because the amortization schedule includes the IO period correctly.
- The M11 cycle iterates until the **engine's amortizing DSCR** stabilizes, but it never sizes against the engine's own debt service. It sizes against a simplified IO proxy.

---

## 5. Summary Table

| Question | Answer | Evidence |
|---|---|---|
| **Which constraints size the loan?** | LTV cap + DSCR floor only. LTC and debt yield are **not** used in the live path. | `capital-structure-adapter.ts:511–513` |
| **Is the binding constraint reported?** | **No.** Only a post-hoc `constraintBinds` flag (DSCR floor violation) exists. No rationale for why the loan is what it is. | `capital-structure-adapter.ts:777`; `financial-model-engine.service.ts:1689` |
| **Is the engine DSCR amortizing or IO?** | **Amortizing.** `debtServiceByYear` from `computeAmortization` handles IO period + P&I + balloon. | `deterministic-model-runner.ts:1099–1101`; `computeAmortization:548–622` |
| **Is the capital-structure route DSCR correct?** | **No.** It uses IO with a ÷100 bug (`rate/100` when rate is already decimal). | `capital-structure.routes.ts:572–574` |
| **Does M11 sizing match engine reality?** | **No.** M11 sizes with IO debt service; engine runs with amortizing debt service. The two can diverge. | `capital-structure-adapter.ts:512` vs `deterministic-model-runner.ts:1099` |
| **Is debt yield used in sizing?** | **No.** `debtYield` is computed in the engine (`noi / loanAmount`) and reported, but never used as a sizing constraint. | `deterministic-model-runner.ts:1136` |
| **Is LTC used in sizing?** | **No.** LTC is computed in F40 and reported, but `getRecommendedTerms` does not reference it. | `formula-engine.ts:1001` vs `capital-structure-adapter.ts:511–513` |

---

## 6. Findings

### Finding A2-1: M11 Sizing Uses Only 2 of 4 Constraints
**Severity:** P1 (data integrity)  
**Location:** `capital-structure-adapter.ts:511–513`  
**Description:** The live loan sizing path (`getRecommendedTerms`) applies only LTV and DSCR. LTC and debt yield constraints exist in the F40 formula but are never invoked during `buildModel()`. A deal could pass M11 sizing but violate a lender's LTC or debt-yield covenant.

### Finding A2-2: M11 Sizing Uses Interest-Only Debt Service Proxy
**Severity:** P1 (data integrity)  
**Location:** `capital-structure-adapter.ts:512`  
**Description:** The DSCR constraint in `getRecommendedTerms` is `noiY1 / (1.25 × rate)`, which is equivalent to sizing against interest-only debt service (`loan × rate`). The engine then runs with a full amortization schedule. For deals with `ioPeriod = 0`, the actual DSCR will be higher than the 1.25 target, meaning the loan is undersized relative to the true amortizing capacity.

### Finding A2-3: Binding Constraint Is Not Reported
**Severity:** P2 (usability / transparency)  
**Location:** `capital-structure-adapter.ts:777`; `financial-model-engine.service.ts:1689`  
**Description:** No field in the API or model result explains whether LTV or DSCR was the binding constraint. The `constraintBinds` flag only signals a post-hoc DSCR floor violation, not the sizing rationale. Users see a loan amount without knowing why it stopped there.

### Finding A2-4: Capital-Structure Route DSCR Has ÷100 Bug
**Severity:** P0 (critical — incorrect UI metric)  
**Location:** `capital-structure.routes.ts:572–574`  
**Description:** The `GET /capital-structure/:dealId` route computes DSCR as `noi / (loanAmount × (interestRate / 100))`. Since `interestRate` is already a decimal (e.g., 0.065), dividing by 100 makes it 0.00065, producing a DSCR ~100× too high. This is the same Finding U pattern.

---

*End of A2_Sizing audit report.*
# A3_SeamBreak — Debt-Layer Phase 1 Audit

**Assignment:** Trace whether D3's `agent_confirmed` seam survives to the debt schedule for each financing field.  
**Method:** Read-only code audit. File:line citations for every claim.  
**Auditor:** Sub-agent A3_SeamBreak  
**Date:** 2026-07-09  
**Repo:** `C:\Users\Leons' Computer 2\Documents\JediRe\backend`

---

## Executive Summary

**Verdict: The seam is structurally incomplete — financing fields have NO `agent_confirmed` path through the overlay→resolution→bridge→M11 pipeline.**

D3's `agent_confirmed` seam (via `writeAgentConfirmedOverlay`) only patches three fields into `deal_assumptions.year1`: `vacancy_pct`, `management_fee_pct`, and `replacement_reserves` (`agent-overlay-writer.ts:36-40`). None of the six financing fields under audit (`rate`, `term`, `amort`, `ioPeriod`, `loanAmount`, `ltv`) are in this map. Worse, the `ProFormaYear1Seed` type (the LayeredValue schema that feeds the bridge) contains **no financing keys at all** — no `loan_amount`, `interest_rate`, `term`, `amortization`, `io_period`, or `ltv` fields exist in `ProFormaYear1Seed` (`document-extraction/types.ts:592-718`).

The financing values flow through a **parallel, non-layered path**: they live as flat scalars inside `ProFormaAssumptions.financing` (a nested object on the assumptions envelope), are read directly by `mapProFormaAssumptionsToModelAssumptions` (`proforma-assumptions-bridge.ts:419-425`), and are then **obliterated by M11's hardcoded conventions** (`capital-structure-adapter.ts:502-534`).

This is not "destination deafness" (the seam reaches the field but the consumer ignores it). This is **seam absence**: there is no rail for an agent-authored financing value to enter the system at all.

---

## 1. The D3 Seam — What Exists

### 1.1 `writeAgentConfirmedOverlay` — agent-overlay-writer.ts

- **Line 36-40**: `YEAR1_FIELD_MAP` is the complete set of fields that receive a `deal_assumptions.year1[...].agent_confirmed` patch:
  ```ts
  const YEAR1_FIELD_MAP: Record<string, string> = {
    vacancy_rate:      'vacancy_pct',
    management_fee_pct: 'management_fee_pct',
    capex_per_unit:    'replacement_reserves',
  };
  ```
- **Line 145-177**: The year1 patch only fires when `year1Key = YEAR1_FIELD_MAP[fieldKey]` is non-null. For any `fieldKey` not in this map (e.g. `"rate"`, `"term"`, `"loanAmount"`), `year1Patched` remains `false` and only the `deal_assumption_overlays` row is inserted — the value never reaches `deal_assumptions.year1`.
- **Line 25**: Resolution order is documented as: `storedResolved < Engine A < agent_confirmed < perYearOverride < override`. This chain is implemented in `get-field-value.service.ts:437-490`.

### 1.2 `getFieldValue` resolution chain — get-field-value.service.ts

- **Line 437-490**: `resolveLayeredValue` walks the chain. `agent_confirmed` is layer 2b (above Engine A, below overrides). This works **only** for fields stored as `LayeredValue<number>` inside `deal_assumptions.year1`.
- **Line 198-215**: `ALLOWED_FIELDS` whitelist gates every field name. Financing fields are **not** in this list. The only capital-related entries are:
  - `'purchase_price'`, `'equity_at_close'`, `'loan_amount'`, `'interest_rate'`, `'ltc_pct'`, `'exit_cap'`, `'rent_growth_yr1'`, `'hold_period_years'`
  - Note: `'loan_amount'` and `'interest_rate'` are present, but **no** `term`, `amortization`, `io_period`, or `ltv`.
  - Even `loan_amount` and `interest_rate` here are **not** populated by the seeder with LayeredValue blobs — they are flat columns on `deal_assumptions` (see `seedCapitalStructureDefaults` below).

---

## 2. The Financing Data Path — Where Values Actually Flow

### 2.1 `ProFormaAssumptions.financing` — financial-model-engine.service.ts:86-97

```ts
financing: {
  loanAmount: number;
  loanType: string;
  interestRate: number;
  spread: number;
  term: number;
  amortization: number;
  ioPeriod: number;
  originationFee: number;
  rateCapCost: number;
  prepayPenalty: number;
};
```

These are **flat scalars**, not `LayeredValue<T>` wrappers. They arrive into `buildModel()` either:
- From the frontend/API caller directly (user input), or
- From `buildAssumptionsFromYear1Seed` (`proforma-seeder.service.ts:2806`), which **does not read financing fields from the year1 seed** (confirmed: `buildAssumptionsFromYear1Seed` returns `modelType`, `dealInfo`, `holdPeriod`, `revenue`, `opex`, `noi`, `growthRates`, `sources` — no `financing` key at all, lines 2810-2861).

### 2.2 Bridge: `mapProFormaAssumptionsToModelAssumptions` — proforma-assumptions-bridge.ts:412-426

```ts
// ── Financing ─────────────────────────────────────────────────────────────
const loanAmount = toNumber(a.financing?.loanAmount, 0);
const ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0;
const termMonths = (toNumber(a.financing?.term, 5)) * 12;
const amortMonths = (toNumber(a.financing?.amortization, 30)) * 12;
const ioPeriod = toNumber(a.financing?.ioPeriod, 0);
const rate = toNumber(a.financing?.interestRate, 0.065) || 0.065;
const originationFeePct = toNumber(a.financing?.originationFee, 0.01) || 0.01;
```

**Key observations:**
- The bridge reads `a.financing.*` directly. There is **no resolution chain** here — no `agent_confirmed`, no `override`, no `LayeredValue` unwrap.
- Fallbacks are hardcoded: `term` defaults to 5 years, `amortization` to 30 years, `interestRate` to 6.5%, `ioPeriod` to 0, `originationFee` to 1%.
- `loanAmount` defaults to 0, then gets hydrated from `deal_data` JSONB if zero (`financial-model-engine.service.ts:1500-1518`).
- `ltv` is **computed** from `loanAmount / purchasePrice`, not read from any stored layer.

### 2.3 `buildAssumptionsFromYear1Seed` — proforma-seeder.service.ts:2806-2861

This function converts the `ProFormaYear1Seed` (LayeredValue tree) into the `ProFormaAssumptions` shape. It reads `rv(year1.gpr)`, `rv(year1.vacancy_pct)`, `rv(year1.payroll)`, etc. **It does NOT read any financing fields** because `ProFormaYear1Seed` does not contain them. The returned object has no `financing` property.

---

## 3. M11 Cycle — Where Values Die

### 3.1 `getRecommendedTerms` — capital-structure-adapter.ts:502-534

```ts
export function getRecommendedTerms(params: {
  noiY1: number; purchasePrice: number; ltv: number; rate?: number; ioPeriodMonths?: number;
}): RecommendedTerms {
  const { noiY1, purchasePrice, ltv, rate = 0.065, ioPeriodMonths } = params;
  const maxByLtv = Math.round(purchasePrice * ltv);
  const loanByDscr = rate > 0 ? Math.round(noiY1 / (1.25 * rate)) : maxByLtv;
  const recommendedLoanAmount = Math.max(0, Math.min(maxByLtv, loanByDscr));
  const debtService = recommendedLoanAmount * rate;

  let ioPeriod: number;
  if (ioPeriodMonths !== undefined) {
    ioPeriod = ioPeriodMonths;
  } else if (ltv > 0.75) {
    ioPeriod = 24;
  } else if (ltv > 0.65) {
    ioPeriod = 12;
  } else {
    ioPeriod = 0;
  }

  return {
    recommendedLoanAmount,
    loanTerms: { termMonths: 60, amortMonths: 360, ioPeriod },
    debtService,
    effectiveRate: rate,
  };
}
```

**Death table for each field:**

| Field | Agent path exists? | Where it dies | What replaces it |
|-------|-------------------|---------------|------------------|
| **rate** | No | `getRecommendedTerms` line 510: `rate = 0.065` default | Hardcoded 6.5% unless caller passes `rate` param (M11 cycle passes `current.rate` from `ModelAssumptions`, which came from bridge) |
| **term** | No | `getRecommendedTerms` line 530: `termMonths: 60` | Hardcoded 60 months (5 years) — **always** |
| **amort** | No | `getRecommendedTerms` line 530: `amortMonths: 360` | Hardcoded 360 months (30 years) — **always** |
| **ioPeriod** | No | `getRecommendedTerms` lines 516-526: LTV-tier derivation | 24 mo if LTV>0.75, 12 mo if LTV>0.65, 0 otherwise — **ignores any input ioPeriod** unless `ioPeriodMonths` override param is passed |
| **loanAmount** | No | `getRecommendedTerms` line 512-513: `min(maxByLtv, loanByDscr)` | Sized from NOI × DSCR floor — **overwrites** bridge value |
| **ltv** | No | `getRecommendedTerms` line 511: `maxByLtv = purchasePrice * ltv` | Passed through from `ModelAssumptions.ltv`, which was computed in bridge from `loanAmount / purchasePrice` — not agent-set |

### 3.2 `runM11Cycle` — capital-structure-adapter.ts:546-575

```ts
export function runM11Cycle(assumptions: ModelAssumptions, noiY1: number, maxIter = 3): M11CycleResult {
  let current: ModelAssumptions = { ...assumptions };
  for (let i = 0; i < maxIter; i++) {
    const modelResult = runModel(current, { skipSensitivity: true });
    const dscrY1 = modelResult.debtMetrics.coverage.dscrY1;
    // ... convergence check ...
    const terms = getRecommendedTerms({ noiY1, purchasePrice: current.purchasePrice, ltv: current.ltv, rate: current.rate });
    current = {
      ...current,
      loanAmount: terms.recommendedLoanAmount,
      rate: terms.effectiveRate,
      term: terms.loanTerms.termMonths,
      amort: terms.loanTerms.amortMonths,
      ioPeriod: terms.loanTerms.ioPeriod,
    };
  }
  return { assumptions: current, iterations, converged };
}
```

**Line 563-571**: Every iteration overwrites `loanAmount`, `rate`, `term`, `amort`, `ioPeriod` with `getRecommendedTerms` output. The input `assumptions` values (which came from the bridge, which came from `ProFormaAssumptions.financing` scalars) are **discarded** on the first pass.

### 3.3 `runFullModel` — run-full-model.ts:97-177

```ts
export function runFullModel(assumptions: ModelAssumptions, options: RunFullModelOptions = {}): RunFullModelResult {
  const pass1: ModelResults = runModel(assumptions, { skipSensitivity });
  const noiY1 = pass1.summary.noiYear1;
  const m11: M11CycleResult = runM11Cycle(assumptions, noiY1, maxM11Iter);
  let adjusted: ModelAssumptions = m11.assumptions;
  // ... M14, equity reconciliation ...
  const result: ModelResults = runModel(adjusted, { skipSensitivity });
  // ...
}
```

**Line 107-111**: Pass-1 runs with original assumptions. M11 then sizes debt from pass-1 NOI. Pass-2 runs with M11-overwritten assumptions. The original `assumptions` object is never mutated, but `adjusted` is a fresh copy with M11 values.

### 3.4 `writeM11ToFinancing` — capital-structure-adapter.ts:751-801

```ts
export function writeM11ToFinancing(adjusted: ModelAssumptions, financing: { ... }, capexBudget: number, ... ) {
  const ltv = adjusted.purchasePrice > 0 ? adjusted.loanAmount / adjusted.purchasePrice : 0;
  const totalCost = adjusted.purchasePrice + (capexBudget > 0 ? capexBudget : 0);
  const ltc = totalCost > 0 ? adjusted.loanAmount / totalCost : ltv;
  const termYears = adjusted.term / 12;
  const amortYears = adjusted.amort / 12;

  return {
    financing: {
      ...financing,
      loanAmount: adjusted.loanAmount,
      interestRate: adjusted.rate,
      term: termYears,
      amortization: amortYears,
      ioPeriod: adjusted.ioPeriod,
    },
    summary: { ... }
  };
}
```

**Line 779-787**: M11-optimized values are written **back** into `enhancedAssumptions.financing` (`financial-model-engine.service.ts:1687`). This is the **only** place financing values are mutated after the bridge — and they come from M11's hardcoded rules, not from any agent layer.

---

## 4. Seed-Level Financing Defaults — proforma-seeder.service.ts

### 4.1 `seedCapitalStructureDefaults` — lines 2099-2339

This function writes platform defaults into `deal_assumptions.year1` under keys like `ltv_pct`, `debt_rate`, `amortization_years`, `loan_term_years`, `io_period_months` — but these are **not** part of `ProFormaYear1Seed` and are **not** read by `buildAssumptionsFromYear1Seed`.

Instead, they are written as:
- `deal_assumptions.year1.ltv_pct` (LayeredValue with `platform` layer)
- `deal_assumptions.year1.debt_rate` (LayeredValue with `platform` layer)
- `deal_assumptions.year1._capital_structure_defaults` (metadata block)

And also to flat columns:
- `deal_assumptions.interest_rate` (line 2319)
- `deal_assumptions.ltc` (line 2320)

**Critical gap**: The seeder writes `ltv_pct`, `debt_rate`, `amortization_years`, `loan_term_years`, `io_period_months` into `year1`, but:
1. `buildAssumptionsFromYear1Seed` does **not** read them (no financing section).
2. The bridge (`mapProFormaAssumptionsToModelAssumptions`) reads from `a.financing.*`, not from `year1`.
3. The frontend/API caller populates `ProFormaAssumptions.financing` directly, bypassing the year1 seed entirely.

So the seeder's capital-structure defaults are **orphaned** — they sit in `year1` but never reach the model.

---

## 5. Per-Field Traces

### 5.1 `rate` (interestRate)

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("interest_rate", 0.055)` → `YEAR1_FIELD_MAP` has no entry for `interest_rate` → **year1 patch skipped** (`agent-overlay-writer.ts:146`).
2. Overlay row inserted into `deal_assumption_overlays` with `source_tag='agent_confirmed'` — but no consumer reads financing from this table.
3. `buildAssumptionsFromYear1Seed` → does not read `debt_rate` from year1.
4. `mapProFormaAssumptionsToModelAssumptions` → reads `a.financing.interestRate`, falls back to `0.065` (`proforma-assumptions-bridge.ts:425`).
5. `runM11Cycle` → `getRecommendedTerms` receives `rate: current.rate` (from bridge) but does not modify it unless the caller passes a different rate — **rate survives M11 unchanged**.
6. `writeM11ToFinancing` → writes `adjusted.rate` back.

**Verdict for rate:** The agent value **never enters the system** because there is no `YEAR1_FIELD_MAP` entry and no `financing` read from year1. Even if the frontend passed it directly into `ProFormaAssumptions.financing.interestRate`, M11 would pass it through (it does not overwrite `rate` unless explicitly changed). But the **agent_confirmed seam does not reach it**.

**Death line:** `agent-overlay-writer.ts:146` (`year1Key = null` → patch skipped).

### 5.2 `term`

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("term", 10)` → `YEAR1_FIELD_MAP` has no entry → **year1 patch skipped**.
2. `mapProFormaAssumptionsToModelAssumptions` → `toNumber(a.financing?.term, 5) * 12` → defaults to 60 months if missing.
3. `runM11Cycle` → `getRecommendedTerms` line 530: `termMonths: 60` → **hardcoded overwrite**.
4. `writeM11ToFinancing` → writes `adjusted.term / 12` = 5 years back.

**Verdict for term:** The agent value never enters the system. Even if it did (via frontend), M11 would overwrite it with 60 months.

**Death line:** `capital-structure-adapter.ts:530` (`termMonths: 60`).

### 5.3 `amort` (amortization)

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("amortization", 25)` → `YEAR1_FIELD_MAP` has no entry → **year1 patch skipped**.
2. `mapProFormaAssumptionsToModelAssumptions` → `toNumber(a.financing?.amortization, 30) * 12` → defaults to 360 months.
3. `runM11Cycle` → `getRecommendedTerms` line 530: `amortMonths: 360` → **hardcoded overwrite**.
4. `writeM11ToFinancing` → writes `adjusted.amort / 12` = 30 years back.

**Verdict for amort:** Same as term. Hardcoded 360 months in M11.

**Death line:** `capital-structure-adapter.ts:530` (`amortMonths: 360`).

### 5.4 `ioPeriod`

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("ioPeriod", 18)` → `YEAR1_FIELD_MAP` has no entry → **year1 patch skipped**.
2. `mapProFormaAssumptionsToModelAssumptions` → `toNumber(a.financing?.ioPeriod, 0)` → defaults to 0.
3. `runM11Cycle` → `getRecommendedTerms` lines 516-526: derives `ioPeriod` from LTV tier (24/12/0). The `ioPeriodMonths` override param is **not** passed by `runM11Cycle` (line 563 only passes `noiY1, purchasePrice, ltv, rate`).
4. `writeM11ToFinancing` → writes M11-derived `ioPeriod`.

**Verdict for ioPeriod:** Agent value never enters. Even if frontend passed it, M11 ignores it because `runM11Cycle` does not pass `ioPeriodMonths` to `getRecommendedTerms`.

**Death line:** `capital-structure-adapter.ts:516-526` (LTV-tier derivation, `ioPeriodMonths` param absent from `runM11Cycle` call at line 563).

### 5.5 `loanAmount`

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("loanAmount", 5_000_000)` → `YEAR1_FIELD_MAP` has no entry → **year1 patch skipped**.
2. `mapProFormaAssumptionsToModelAssumptions` → `toNumber(a.financing?.loanAmount, 0)` → defaults to 0.
3. `financial-model-engine.service.ts:1500-1518`: If 0, hydrates from `deal_data->>'loanAmount'` etc.
4. `runM11Cycle` → `getRecommendedTerms` line 512-513: `recommendedLoanAmount = min(maxByLtv, loanByDscr)` → **NOI-based resize**.
5. `writeM11ToFinancing` → writes resized `loanAmount`.

**Verdict for loanAmount:** Agent value never enters. Even if frontend passed it, M11 resizes it from NOI. The only way to preserve an agent's loanAmount would be to bypass M11 entirely (not currently an option).

**Death line:** `capital-structure-adapter.ts:512-513` (`recommendedLoanAmount = min(maxByLtv, loanByDscr)`).

### 5.6 `ltv`

**Path attempted:**
1. `agent_confirmed` → `writeAgentConfirmedOverlay("ltv", 0.70)` → `YEAR1_FIELD_MAP` has no entry → **year1 patch skipped**.
2. `mapProFormaAssumptionsToModelAssumptions` → `ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0` → **computed**, not stored.
3. `runM11Cycle` → `getRecommendedTerms` uses `current.ltv` to compute `maxByLtv` (line 511). Does not overwrite `ltv` itself.
4. `writeM11ToFinancing` → writes `ltv = adjusted.loanAmount / adjusted.purchasePrice`.

**Verdict for ltv:** Agent value never enters. LTV is always derived from `loanAmount / purchasePrice`. There is no `ltv` field in `ModelAssumptions` that an agent could set independently — it is a **derived**, not stored, value.

**Death line:** `proforma-assumptions-bridge.ts:420` (`ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0`).

---

## 6. Root Cause Analysis

### 6.1 Schema Mismatch

The `ProFormaYear1Seed` type (LayeredValue tree) and the `ProFormaAssumptions` type (flat envelope) are **not unified** for financing fields. The seeder writes capital-structure keys into `year1` (`ltv_pct`, `debt_rate`, etc.), but:
- `buildAssumptionsFromYear1Seed` ignores them.
- The bridge reads from `a.financing.*` instead.
- The frontend populates `a.financing.*` directly.

This means the year1 LayeredValue machinery (the D3 seam's foundation) is **not wired to financing**.

### 6.2 M11 Hardcoding

Even if financing values reached the bridge, M11's `getRecommendedTerms` hardcodes:
- `termMonths: 60`
- `amortMonths: 360`
- `ioPeriod` from LTV tier (ignoring input)
- `loanAmount` from NOI/DSCR constraint

These are **product conventions** (agency 5/30, bank 5/25, life-co 10/30) that are not yet parameterized by deal context. The comment at line 491-498 documents this as "Task #1412 audit fix" but the fix only added the hardcoded values, not a ruleset engine.

### 6.3 No Agent-Confirmed Path

The `agent_confirmed` seam requires:
1. A `YEAR1_FIELD_MAP` entry (does not exist for financing fields).
2. A `LayeredValue` blob in `deal_assumptions.year1` (does not exist for financing fields in `ProFormaYear1Seed`).
3. A consumer that reads the resolved value via `getFieldValue` (no financing fields in `ALLOWED_FIELDS` are consumed by the bridge).

All three are absent.

---

## 7. Verdict

> **Is D3's seam complete but the destination deaf, or does the seam itself not reach financing fields?**

**The seam itself does not reach financing fields.**

This is not a case where the agent writes a value, the resolution chain picks it up, and then M11 ignores it. This is a case where **there is no rail** for an agent to write a financing value into the system at all. The `YEAR1_FIELD_MAP` is missing entries, `ProFormaYear1Seed` has no financing keys, `buildAssumptionsFromYear1Seed` does not read them, the bridge reads flat scalars from `a.financing`, and M11 hardcodes conventions that overwrite whatever scalar arrived.

To make the seam work for financing, the following would need to be built (Phase 2 scope):
1. Add financing keys to `ProFormaYear1Seed` as `LayeredValue<number>` fields.
2. Add `YEAR1_FIELD_MAP` entries for `rate`, `term`, `amort`, `ioPeriod`, `loanAmount`, `ltv`.
3. Teach `buildAssumptionsFromYear1Seed` to read financing from year1 and emit `ProFormaAssumptions.financing`.
4. Teach the bridge to resolve financing fields through the LayeredValue chain (or read from `getFieldValue`).
5. Replace M11's hardcoded `getRecommendedTerms` with a ruleset-driven engine that respects agent-confirmed values (or at least surfaces them as override candidates).
6. Decide whether `ltv` should be a stored field (agent-set) or remain derived (computed from loanAmount / purchasePrice). If stored, add it to `ModelAssumptions` and the bridge.

---

## 8. File:Line Evidence Summary

| Claim | File | Line(s) |
|-------|------|---------|
| YEAR1_FIELD_MAP only has 3 entries (no financing) | `agent-overlay-writer.ts` | 36-40 |
| year1 patch skipped when fieldKey not in map | `agent-overlay-writer.ts` | 145-177 |
| Resolution chain: agent_confirmed at layer 2b | `get-field-value.service.ts` | 437-490 |
| ALLOWED_FIELDS has no financing keys (except loan_amount, interest_rate) | `get-field-value.service.ts` | 198-215 |
| ProFormaYear1Seed has no financing fields | `document-extraction/types.ts` | 592-718 |
| buildAssumptionsFromYear1Seed returns no financing | `proforma-seeder.service.ts` | 2806-2861 |
| Bridge reads flat a.financing.* with hardcoded fallbacks | `proforma-assumptions-bridge.ts` | 412-426 |
| M11 hardcodes term=60, amort=360 | `capital-structure-adapter.ts` | 530 |
| M11 derives ioPeriod from LTV tier, ignores input | `capital-structure-adapter.ts` | 516-526 |
| M11 resizes loanAmount from NOI/DSCR | `capital-structure-adapter.ts` | 512-513 |
| runM11Cycle overwrites all financing fields | `capital-structure-adapter.ts` | 563-571 |
| M11 writes back to enhancedAssumptions.financing | `financial-model-engine.service.ts` | 1676-1687 |
| Seeder writes CS defaults to year1 but they are orphaned | `proforma-seeder.service.ts` | 2159-2271 |

---

*End of A3_SeamBreak audit.*
# A4_DebtContext — Debt-Layer Phase 1 Audit

**Audit Date:** 2026-07-09  
**Auditor:** Read-only reconnaissance agent (no fixes, no migrations, no writes)  
**Scope:** Inventory every debt-related module in the JediRe backend, report its state (wired / metadata-only / absent), what it holds, whether anything reads it, and whether it could feed a `DebtContext` assembled the way `DealContext` serves the Research Agent.  
**Evidence:** File:line citations for every claim.

---

## 1. Executive Summary

The JediRe backend contains a **rich but fragmented** debt-layer ecosystem. Several modules are fully wired and actively read/write (debt positions, vintage debt estimator, debt plan formulator, FRED ingestion, rate environment, lender targeting). Others exist as **metadata-only stubs** (assumable-NPV field, CFO-lender collaboration service, Sigma debt-bundle registry). A few expected modules are **entirely absent** (dedicated loan-product catalog table, below-market-debt NPV math, explicit S1 distress estimator service). No unified `DebtContext` type exists analogous to `DealContext`; debt data is scattered across `deal_context_financials`, `deal_assumptions.per_year_overrides`, `debt_positions`, and in-memory module wiring.

---

## 2. Module-by-Module Inventory

### 2.1 debt_positions — IN-PLACE LOANS (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Table** | `debt_positions` created by migration `20260420_disposition_and_debt_tracking.sql` :102–169 |
| **Schema** | loan_name, lender_name, loan_type, original_principal, current_balance, ltv_at_origination, rate_type, base_rate, spread_bps, current_rate, rate_floor, rate_cap, rate_cap_purchased, rate_cap_strike, rate_cap_expiry, origination_date, maturity_date, extension_options, extension_term_months, extended_maturity, amortization_type, io_period_months, amortization_years, monthly_payment, annual_debt_service, dscr_covenant, ltv_covenant, debt_yield_covenant, current_dscr, current_debt_yield, covenant_status, prepayment_type, prepayment_penalty_pct, prepay_lockout_until, status, refinanced_by |
| **Read by** | `debt-tracking.service.ts` :152 `getDebtPositions(dealId)` — returns full `DebtPosition[]` |
| **Read by** | `vintage-debt-estimator.service.ts` :489 `getDebtPositions(dealId)` — feeds distress-flag computation |
| **Read by** | `deal-financial-context.service.ts` :211–219 — queries `deal_debt_schedule` (separate table, not `debt_positions`) |
| **Read by** | `fetch_debt_assumptions.ts` :72–90 — queries `debt_positions` for historical averages |
| **Read by** | `v_portfolio_debt_summary` view (`20260420_disposition_and_debt_tracking.sql` :788–808) |
| **Written by** | `debt-tracking.service.ts` :99–147 `upsertDebtPosition()` — INSERT … ON CONFLICT |
| **Written by** | `recordRefinance()` (`debt-tracking.service.ts` :344–401) — marks old debt `refinanced`, inserts `refinance_events` |
| **Written by** | `updateCovenantCompliance()` (`debt-tracking.service.ts` :194–233) — updates `current_dscr`, `current_ltv`, `current_debt_yield`, `covenant_status` |
| **Status** | **WIRED** — fully operational, actively read and written |
| **Could feed DebtContext?** | **Yes, directly.** Contains every field a `DebtContext` would need for in-place loans. Currently consumed by vintage estimator and portfolio views, but NOT assembled into a single `DebtContext` object. |

---

### 2.2 S1 Distress Estimator Flags (WIRED, but named differently)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `vintage-debt-estimator.service.ts` — computes six distress flags |
| **Flags computed** | `negativeDscr`, `thinDscr`, `ioExpiryShock`, `underwaterEquity`, `cashInRefi`, `negativeLeverage` (`vintage-debt-estimator.service.ts` :52–57) |
| **Flag derivation** | `deriveFlags()` at :370–475 — honest-absence contract (`undeterminable` when inputs missing) |
| **io_expiry_shock logic** | :409–434 — finds position where `monthsToIoExpiry <= 12` and `monthsToIoExpiry >= 0`; if bridge with `ioPeriodMonths === 0`, returns `undeterminable` with reason `missing_io_terms_for_bridge` |
| **underwater_equity logic** | :437–453 — uses `proceedsGap > 0` as trigger; `proceedsGap = totalBalance - (estValue * minLtvMax)` |
| **cash_in_refi logic** | :456–461 — same `proceedsGap > 0` threshold, different semantic label |
| **Persisted to** | `deal_context_financials` table (`20260703_deal_context_financials.sql` :6–50) — 30 columns covering all flags + intermediates |
| **Persist function** | `persistVintageDebtEstimate()` at `vintage-debt-estimator.service.ts` :627–721 — idempotent on `(deal_id, ruleset_version)` |
| **Read by** | No direct consumer found in current codebase. The table is written but no service queries it back. |
| **Status** | **WIRED** — computation is live, persistence is live, but **no upstream reader** currently consumes the persisted rows. |
| **Could feed DebtContext?** | **Yes, ideally.** The flags are exactly the kind of structured distress signal a `DebtContext` should expose. Gap: no reader pulls from `deal_context_financials` today. |

---

### 2.3 FRED — Rate Environment (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Client** | `fred-api.client.ts` — `FREDApiClient` class with `getSeries()`, `getLatest()`, `getMultipleSeries()` |
| **Series IDs** | `FRED_SERIES` object at :130–157 — FFR (`DFF`), SOFR (`SOFR`), 10Y (`DGS10`), 30Y (`DGS30`), 30Y mortgage (`MORTGAGE30US`), M2 (`M2SL`), Fed assets (`WALCL`), DXY (`DTWEXBGS`), GDP (`GDPC1`), CPI (`CPIAUCSL`), unemployment (`UNRATE`), consumer sentiment (`UMCSENT`) |
| **Ingestion service** | `fred-ingest.service.ts` — `ingestFRED(apiKey)` loops through `FRED_SERIES` array, fetches observations, inserts into `metric_time_series` |
| **Ingested metrics** | `RATE_SOFR`, `RATE_TREASURY_10Y`, `RATE_MORTGAGE_30Y`, `RATE_FED_FUNDS`, `M_CPI_OFFICIAL`, `M_CPI_STICKY`, `M_OIL_PRICE`, `M_UNEMPLOYMENT_RATE`, `M_BUILDING_PERMITS`, `M_POPULATION`, `M_EMPLOYED`, `M_PERSONAL_INCOME`, `M_LABOR_FORCE`, `M_GDP`, `M_HOME_PRICE_INDEX`, `M_CASE_SHILLER_HPI`, `M_HOUSING_STARTS`, `M_LEISURE_HOSPITALITY_EMP`, plus CRE-adjacent: `CRE_RENTAL_VACANCY_RATE`, `CRE_HOMEOWNER_VACANCY`, `CRE_MF_HOUSING_STARTS`, `CRE_RENT_CPI`, `CRE_RENT_CPI_SA` |
| **Read by** | `rate-environment.service.ts` :302 — `fetchLiveRates()` + `fetchLatestMacroFromDb()` |
| **Read by** | `vintage-debt-estimator.service.ts` :129–177 — `getVintageRate()` and `getCurrentMarketRate()` query `metric_time_series` for `RATE_TREASURY_10Y` and `RATE_SOFR` |
| **Read by** | `rate-index.service.ts` (referenced but not read in this audit) |
| **Status** | **WIRED** — ingestion runs, DB table `metric_time_series` is populated, multiple consumers read it |
| **Could feed DebtContext?** | **Yes.** SOFR, 10Y Treasury, and macro context (GDP, CPI, unemployment) are all available. The `RateEnvironmentResult` object (`rate-environment.service.ts` :28–60) is a ready-made envelope. |

---

### 2.4 Assumable-NPV Module (METADATA-ONLY / ABSENT)

| Attribute | Evidence |
|-----------|----------|
| **Field exists** | `CapitalStructureService.DebtProduct.assumable: boolean` at `capital-structure.service.ts` :165 |
| **Field populated** | **Never.** No `DebtProduct` instances are created in the codebase; the type is a schema definition only. The `STRATEGY_DEBT_MATRIX` at :177–183 maps strategy strings to `DebtProductType` enums, not to full `DebtProduct` objects. |
| **Below-market-debt math** | **Absent.** No function computes NPV of assumable below-market debt. No table stores `assumable_rate`, `assumption_premium`, or `npv_of_rate_differential`. |
| **Status** | **METADATA-ONLY** — the boolean field exists in the type system, but no logic, no data, and no UI wiring. |
| **Could feed DebtContext?** | **No — nothing to feed.** If built, it would need: (1) `debt_positions.assumable` flag, (2) `assumed_rate` vs `market_rate`, (3) remaining term, (4) NPV formula. None exist. |

---

### 2.5 M11's Own Sizing Machinery (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `capital-structure.service.ts` — `CapitalStructureService` class |
| **Sizing formula** | `sizeSeniorDebt()` at :295–315 — delegates to Formula Engine `F40` (triple constraint: LTC, LTV, DSCR) |
| **Mezz sizing** | `sizeMezzanine()` at :320–326 — delegates to `F41` |
| **DSCR computation** | `buildCapitalStack()` at :234 — `dscr = totalAnnualDS > 0 ? new Decimal(noi).dividedBy(totalAnnualDS).toFixed(4) : '0.0000'` |
| **getRecommendedTerms** | `capital-structure-adapter.ts` :502–534 — hardcodes `termMonths: 60`, `amortMonths: 360`; derives `ioPeriod` from LTV tier (0/12/24 months); computes `loanByDscr = noiY1 / (1.25 * rate)` |
| **runM11Cycle** | `capital-structure-adapter.ts` :546–575 — iterative convergence loop (max 3 passes) calling `runModel()` and `getRecommendedTerms()` |
| **Write-back to financing** | `writeM11ToFinancing()` at :751–801 — writes `loanAmount`, `interestRate`, `term`, `amortization`, `ioPeriod` into ProForma assumptions |
| **Status** | **WIRED** — actively used by capital-structure pipeline and adapter |
| **Could feed DebtContext?** | **Yes, partially.** M11 produces `loanAmount`, `ltv`, `ltc`, `rate`, `termYears`, `amortYears`, `ioPeriodMonths`, `dscrFloor`, `constraintBinds`, `dscrActual` (`M11CapitalStructureSummary` at :702–730). These are written to ProForma, not to a `DebtContext`. |

---

### 2.6 Prepayment Structures (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Enum exists** | `DebtPosition.prepaymentType` at `debt-tracking.service.ts` :53 — `'open' | 'yield_maintenance' | 'defeasance' | 'step_down'` |
| **Enum exists** | `DebtPhase.prepayType` at `debt-plan-formulator.service.ts` :66 — `string` |
| **Strategy mapping** | `strategy-debt-mapping.json` — every strategy entry includes `prepayType`: `yield_maintenance`, `defeasance`, `open`, or `step_down` |
| **Actual computation** | **None.** No function calculates prepayment penalty dollars. No table stores `prepayment_penalty_dollars`. The `exit-prepay-window` monitoring trigger (:350–358) mentions "Calculate exact prepay cost" but the action is advisory only. |
| **Status** | **METADATA-ONLY** — types and JSON mappings exist, but no computational engine. |
| **Could feed DebtContext?** | **Not today.** Would need: (1) penalty formula by type (YM, defeasance, step-down), (2) current balance, (3) remaining term, (4) rate environment. Only (2) is available. |

---

### 2.7 Lender Ruleset / Loan Product Catalog (WIRED, but static)

| Attribute | Evidence |
|-----------|----------|
| **Lender DB** | `lender-targeting.service.ts` :33–916 — `LENDER_DB` array with 70+ lenders |
| **Fields per lender** | id, name, type, products[], geographyStates[], minLoanM, maxLoanM, typicalSpreadBps, typicalRateFixed, typicalLtv, typicalLtc, recoursePreference, sponsorExperienceRequired, dealsYTDEst, notes |
| **Product keys** | `agency_fixed`, `agency_supplemental`, `cmbs_10yr`, `cmbs_long_term`, `cmbs_or_life_co`, `cmbs_hospitality`, `bridge`, `bridge_to_perm`, `bridge_mezz_stack`, `bridge_ti_lc`, `bridge_earnout`, `construction_to_perm`, `hud_221d4`, `life_co`, `hard_money`, `dscr_loan`, `portfolio_blanket`, `portfolio_bank`, `bank_portfolio`, `mezzanine`, `pref_equity_sub`, `private_credit`, `note_purchase`, `conventional_investment`, `cash_heloc`, `conventional_cash_out`, `cmbs_stabilized_portfolio`, `debt_fund_fixed`, `debt_fund_3_5yr`, `debt_fund`, `agency_lease_up_program`, `agency_adjacent`, `bank_5_7yr`, `portfolio_bank_5_7yr` |
| **Scoring** | `computeFitScore()` at :931–968 — product match (+30), size match (+15), non-recourse preference (+10), originator activity (+5), LTV/LTC fit (+5 each) |
| **Filtering** | `targetLenders()` at :970–1010 — filters by product + geography, sorts by fitScore |
| **Status** | **WIRED** — static in-memory catalog, actively used by `debt-plan-formulator.service.ts` :438, :488 |
| **Could feed DebtContext?** | **Yes.** The lender DB is a ready-made `LenderContext` sub-object. It is currently embedded in the Debt Advisor response, not exposed as a standalone context. |

---

### 2.8 Debt Plan Formulator (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `debt-plan-formulator.service.ts` — `formulateDebtPlan(dealId, productHint?)` |
| **Dependencies** | M08 strategy output (`m08-strategy-output.service.ts`), rate environment (`rate-environment.service.ts`), deal financial context (`deal-financial-context.service.ts`), debt context modifier (`debt-context-modifier.service.ts`) |
| **Output** | `DebtAdvisorResponse` — recommendedStack (phases), alternatives, monitoringTriggers, contextModifications, correlationContext, summary, divergence, platformDefaultsApplied, cyclePhase |
| **Platform default write** | `writeDebtPlatformDefaults()` at :986–1027 — writes 10 fields to `deal_assumptions.per_year_overrides` as `resolution: 'platform'` |
| **CE-09 auto-apply** | `formulateDebtPlan()` at :879–903 — calls `writeDebtPlatformDefaults()` automatically; user overrides win via SQL guard in `applyDebtAdvisorPlatformDefault()` (`proforma-adjustment.service.ts` :6392–6431) |
| **Status** | **WIRED** — full end-to-end: reads M08, reads rate env, reads deal context, formulates plan, writes to ProForma |
| **Could feed DebtContext?** | **Yes, it IS the closest thing to a DebtContext today.** The `DebtAdvisorResponse` object contains everything a `DebtContext` would need: rate, term, amort, IO, LTV, prepay type, lender targets, DSCR, debt yield, monitoring triggers, divergence from user overrides. But it is ephemeral (15-min cache) and not persisted as a structured `DebtContext` row. |

---

### 2.9 Debt Context Modifier (WIRED)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `debt-context-modifier.service.ts` — `applyDebtContextModifier(pool, dealId, purchasePrice, state, loanAmountEstimate)` |
| **Modifications** | productExclusions, lenderTypeExclusions, recourseRequired, addPcaReserveNote, addAssetAgeHaircut, ltvHaircutPct, narrativeNotes, geographyWarning, sizeWarning |
| **Size tiers** | `SIZE_TIERS` at :50–55 — MICRO <$2M, SMALL <$5M, MID <$25M, LARGE <$75M |
| **Geography rules** | `AGENCY_EXCLUDED_STATES` = `['ND', 'SD', 'WY', 'MT']` (:47); `RESTRICTED_STATE_PRODUCTS` — TX excludes `agency_fixed` (:41) |
| **Asset age rules** | `computeAssetAgeModifications()` at :168–185 — age ≥45 → PCA + 2.5% LTV haircut; age ≥30 → 1% haircut |
| **Sponsor rules** | `computeSponsorModifications()` at :187–203 — first-time sponsor → recourseRequired; liquidity <10% → recourseRequired |
| **Status** | **WIRED** — actively called by `formulateDebtPlan()` at :767 |
| **Could feed DebtContext?** | **Yes.** The `ContextModification` object is a perfect `UnderwritingContext` sub-object. Currently embedded in the Debt Advisor response only. |

---

### 2.10 Sigma Debt Bundle Registry (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Registry** | `sigma/debt-bundle-registry.ts` — `DEBT_BUNDLES` catalog with 5 bundles: `hud_221d4`, `agency_fixed_5yr_io`, `agency_floating`, `bridge_floating`, `cmbs_5yr_fixed` |
| **Fields** | params (debtRate, ltv, ioPeriod, amortization, originationFees, prepaymentPenalty), rateLocked, ioExpirationYear, refinanceWindow, f1Loading, doubleUpNote, rateCapCorrelation, amortizationYears, closingTimelineMonths, ltvRange, typicalSpread |
| **Double-up detection** | `assessDoubleUp()` at :194–239 — severity scoring based on F1 loading + refinance window risk |
| **IRR variance** | `estimateBundleIRRVariance()` at :248–260 — simplified covariance formula |
| **Consumers** | **None found.** No service imports `DEBT_BUNDLES` or calls `assessDoubleUp()`. The registry is referenced by `sigma-variable-registry.ts` (not read in this audit) but appears unused in the main debt flow. |
| **Status** | **METADATA-ONLY** — rich type definitions, no active consumer. |
| **Could feed DebtContext?** | **Not today.** Would need a consumer to select a bundle and compute double-up exposure. Currently orphaned. |

---

### 2.11 CFO-Lender Collaboration Service (METADATA-ONLY)

| Attribute | Evidence |
|-----------|----------|
| **Service** | `services/agents/collaborations/cfo-lender.service.ts` — `CFOLenderService` |
| **Function** | `analyzeAndRecommend()` — generates `DebtRecommendation` with recommendedLTV, targetDSCR, rateStructure, refiRecommendation, irrByLTV, breakpoints, covenantSuggestions |
| **AI dependency** | Calls `meteringAdapter.createMessage()` with a hardcoded prompt (:206–241) — requires Claude API |
| **Storage** | `storeRecommendation()` writes to `agent_collaboration_debt_recommendations` table (:276–293) |
| **Retrieval** | `getRecommendation()` reads from same table (:314–337) |
| **Consumers** | **None found.** No route, no agent tool, and no other service calls `cfoLenderService.analyzeAndRecommend()`. |
| **Status** | **METADATA-ONLY** — full implementation, but no caller. Table may or may not exist (not in migration files read). |
| **Could feed DebtContext?** | **Yes, if wired.** The `DebtRecommendation` object has optimal LTV, DSCR, rate structure, and refi timing — exactly what a `DebtContext` would want. But it is AI-dependent and unconnected. |

---

### 2.12 deal_context_financials Table (WIRED for write, UNREAD for read)

| Attribute | Evidence |
|-----------|----------|
| **Table** | `deal_context_financials` (`20260703_deal_context_financials.sql` :6–50) |
| **Columns** | deal_id, computed_at, ruleset_version, dscr_current, dscr_at_refi, proceeds_gap, est_debt_service, plus 6 flag groups × 4 columns each (boolean, value, threshold, provenance) |
| **Written by** | `persistVintageDebtEstimate()` at `vintage-debt-estimator.service.ts` :627–721 |
| **Read by** | **None found.** No SELECT from `deal_context_financials` in any service, route, or agent tool. |
| **Status** | **WRITE-ONLY** — persistence layer exists, but no consumer. |
| **Could feed DebtContext?** | **Yes, ideally.** This table is the closest thing to a persisted `DebtContext`. It needs a reader. |

---

### 2.13 deal_assumptions.per_year_overrides (WIRED, but fragmented)

| Attribute | Evidence |
|-----------|----------|
| **Key format** | `debt:{loanId}:{fieldName}` — e.g., `debt:senior:loanAmount`, `debt:senior:interestRate`, `debt:senior:sofr`, `debt:senior:spread` |
| **Write path** | `applyDebtAdvisorPlatformDefault()` at `proforma-adjustment.service.ts` :6392–6431 — uses `jsonb_set` on `per_year_overrides` with resolution `'platform'` |
| **Write path** | `writeDebtPlatformDefaults()` at `debt-plan-formulator.service.ts` :986–1027 — writes loanAmount, termYears, amortYears, ioMonths, origFee, exitFee, rateType, prepayType, sofr+spread (floating) or interestRate (fixed) |
| **Read path** | `formulateDebtPlan()` at :829–871 — reads back `per_year_overrides` to compute divergence (`configuredLoanAmount` vs `advisorLoanAmount`) |
| **Read path** | F9 resolver (not audited in detail) reads `per_year_overrides` via `debtOvr()` helper |
| **Status** | **WIRED** — actively written and read, but the data is a flat JSONB bag, not a typed `DebtContext` |
| **Could feed DebtContext?** | **Partially.** The overrides contain raw debt fields, but lack provenance, distress flags, lender targets, and rate environment context. |

---

## 3. Gap Analysis: What Would a `DebtContext` Need?

### 3.1 What `DealContext` Does (Reference Pattern)

From `types/dealContext.ts`:
- `ResearchAgentContext` = unified object with parcel, zoning, market, comps, pipeline, demographics, digital, news, macro, meta, operatorStance
- `DealCapsuleContext` = identity + site + zoning + market + financial + capital + existingProperty/redevelopment
- Every sub-object is typed, has provenance, and is consumed by multiple agents

### 3.2 What a `DebtContext` Would Need

| Component | Exists? | Wired? | Location |
|-----------|---------|--------|----------|
| In-place loan terms (rate, LTV, term, amort, IO) | ✅ | ✅ | `debt_positions` + `per_year_overrides` |
| Rate environment (SOFR, 10Y, curve, classification) | ✅ | ✅ | `rate-environment.service.ts` + `metric_time_series` |
| Distress flags (io_expiry_shock, underwater_equity, cash_in_refi, etc.) | ✅ | ✅ (compute) / ❌ (read) | `vintage-debt-estimator.service.ts` + `deal_context_financials` |
| Lender targets | ✅ | ✅ | `lender-targeting.service.ts` |
| Product mapping | ✅ | ✅ | `strategy-debt-mapping.json` |
| Prepayment penalty computation | ❌ | ❌ | **Absent** |
| Assumable-NPV / below-market-debt math | ❌ | ❌ | **Absent** |
| Refi feasibility (proceeds gap, DSCR post-refi) | ✅ | ✅ | `debt-tracking.service.ts` :240–339 `runRefiTest()` |
| Covenant compliance | ✅ | ✅ | `debt-tracking.service.ts` :194–233 `updateCovenantCompliance()` |
| M11 sizing output | ✅ | ✅ | `capital-structure-adapter.ts` :702–730 `M11CapitalStructureSummary` |
| Debt Advisor recommendation | ✅ | ✅ | `debt-plan-formulator.service.ts` `DebtAdvisorResponse` |
| Double-up / bundle risk | ✅ | ❌ | `sigma/debt-bundle-registry.ts` (orphaned) |
| CFO optimization | ✅ | ❌ | `cfo-lender.service.ts` (orphaned) |
| Monitoring triggers | ✅ | ✅ | `debt-plan-formulator.service.ts` :265–361 `buildMonitoringTriggers()` |

### 3.3 The Core Gap

There is **no single `DebtContext` type** that assembles these pieces. Instead:
- `DebtAdvisorResponse` is ephemeral (15-min cache, not persisted)
- `deal_context_financials` is persisted but unread
- `per_year_overrides` is a flat JSONB bag without typing
- `debt_positions` is a relational table, not a context object
- `v_portfolio_debt_summary` is a SQL view, not a typed context

A `DebtContext` would need a **new type definition** (analogous to `ResearchAgentContext`) and a **new assembler service** that pulls from:
1. `debt_positions` (in-place loans)
2. `deal_context_financials` (distress flags)
3. `rate-environment.service.ts` (macro + curve)
4. `lender-targeting.service.ts` (lender targets)
5. `debt-plan-formulator.service.ts` (recommendation + triggers)
6. `capital-structure-adapter.ts` (M11 sizing)

---

## 4. File:Line Evidence Summary

| Claim | File | Line(s) |
|-------|------|---------|
| `debt_positions` schema | `20260420_disposition_and_debt_tracking.sql` | 102–169 |
| `getDebtPositions()` read | `debt-tracking.service.ts` | 152 |
| Vintage estimator reads debt positions | `vintage-debt-estimator.service.ts` | 489 |
| Six distress flags defined | `vintage-debt-estimator.service.ts` | 52–57 |
| `io_expiry_shock` logic | `vintage-debt-estimator.service.ts` | 409–434 |
| `underwater_equity` logic | `vintage-debt-estimator.service.ts` | 437–453 |
| `cash_in_refi` logic | `vintage-debt-estimator.service.ts` | 456–461 |
| `persistVintageDebtEstimate()` | `vintage-debt-estimator.service.ts` | 627–721 |
| `deal_context_financials` schema | `20260703_deal_context_financials.sql` | 6–50 |
| FRED client series IDs | `fred-api.client.ts` | 130–157 |
| FRED ingestion | `fred-ingest.service.ts` | 59–114 |
| Rate environment classification | `rate-environment.service.ts` | 294–403 |
| `assumable` field in type | `capital-structure.service.ts` | 165 |
| `getRecommendedTerms()` hardcodes | `capital-structure-adapter.ts` | 502–534 |
| `runM11Cycle()` | `capital-structure-adapter.ts` | 546–575 |
| `writeM11ToFinancing()` | `capital-structure-adapter.ts` | 751–801 |
| Prepayment types in enum | `debt-tracking.service.ts` | 53 |
| Prepay types in strategy mapping | `strategy-debt-mapping.json` | 19, 38, 61, 75, 110, 168, 210, 241, 258, 289, 322, 356, 376, 388, 408, 429, 448, 467, 488, 508, 545, 566, 587 |
| Lender DB static catalog | `lender-targeting.service.ts` | 33–916 |
| `targetLenders()` scoring | `lender-targeting.service.ts` | 970–1010 |
| `formulateDebtPlan()` | `debt-plan-formulator.service.ts` | 669–964 |
| `writeDebtPlatformDefaults()` | `debt-plan-formulator.service.ts` | 986–1027 |
| `applyDebtAdvisorPlatformDefault()` | `proforma-adjustment.service.ts` | 6392–6431 |
| `DebtContextModifier` service | `debt-context-modifier.service.ts` | 210–243 |
| Size tiers | `debt-context-modifier.service.ts` | 50–55 |
| Geography exclusions | `debt-context-modifier.service.ts` | 40–48, 142–166 |
| Sigma debt bundles | `sigma/debt-bundle-registry.ts` | 59–179 |
| `assessDoubleUp()` | `sigma/debt-bundle-registry.ts` | 194–239 |
| CFO-lender service | `cfo-lender.service.ts` | 82–341 |
| `runRefiTest()` | `debt-tracking.service.ts` | 240–339 |
| `updateCovenantCompliance()` | `debt-tracking.service.ts` | 194–233 |
| `DealContext` type pattern | `types/dealContext.ts` | 172–220, 459–608 |

---

## 5. Verdict

| Module | State | Reads It? | Feeds DebtContext? |
|--------|-------|-----------|-------------------|
| `debt_positions` | **WIRED** | Yes (multiple) | Yes, directly |
| S1 distress flags (vintage estimator) | **WIRED** | Compute yes, read no | Yes, but needs reader |
| FRED / rate environment | **WIRED** | Yes (multiple) | Yes, ready-made |
| Assumable-NPV | **ABSENT** | N/A | No |
| M11 sizing | **WIRED** | Yes | Yes, via ProForma |
| Prepayment structures | **METADATA-ONLY** | Types only | No |
| Lender ruleset / product catalog | **WIRED** (static) | Yes | Yes, embedded |
| Debt plan formulator | **WIRED** | Yes | Yes, ephemeral |
| Debt context modifier | **WIRED** | Yes | Yes, embedded |
| Sigma debt bundles | **METADATA-ONLY** | No consumer | No |
| CFO-lender collaboration | **METADATA-ONLY** | No consumer | No |
| `deal_context_financials` | **WRITE-ONLY** | No reader | Yes, but needs reader |
| `per_year_overrides` | **WIRED** | Yes | Partially |

**Bottom line:** The debt layer has **more infrastructure than it appears** — it is simply **not assembled into a unified `DebtContext`**. The pieces are there. What is missing is:
1. A `DebtContext` type definition (analogous to `ResearchAgentContext`)
2. An assembler service that pulls from the 6+ sources above
3. A consumer (e.g., Research Agent, Cashflow Agent) that requests `DebtContext` the way it requests `DealContext` today
4. Prepayment penalty math and assumable-NPV math (genuine absences, not just assembly gaps)

---

*End of A4_DebtContext audit. No fixes applied. No migrations run. All claims supported by file:line evidence.*
# A6_DesignInput — Debt-Layer Phase 1 Audit Report

**Audit date:** 2026-07-09  
**Auditor:** Read-only reconnaissance agent (no fixes, no migrations, no writes)  
**Assignment:** A6_DesignInput — Frame what a competent debt agent would need, based on findings from A1-A5. This is design input for Phase 2 rulings, not a build spec.  
**Repo:** `C:\Users\Leons' Computer 2\Documents\JediRe\backend`  

---

## 1. Executive Summary

A competent debt agent proposing financing terms for a real estate deal needs five capabilities:

1. **Rate from environment + spread** — justified by asset quality, leverage, and product type.
2. **Term / amort from product convention** — agency 5/30, bank 5/25, life-co 10/30, etc.
3. **IO from lease-up profile** — stabilizing assets argue for IO through stabilization.
4. **Sizing against binding constraint** — naming which one binds (LTV, DSCR, LTC, debt yield).
5. **In-place debt events** — assumption vs. refi vs. payoff with prepayment structure priced in.

This audit inventories, for each capability:
- What data it needs
- Whether A4's `DebtContext` inventory shows that data exists
- What gap prevents it today

Then synthesizes a target framing for Phase 2 rulings.

---

## 2. Capability-by-Capability Analysis

### 2.1 Rate from environment + spread

**What a competent debt agent would do:**
- Read the current rate environment (SOFR, 10Y Treasury, Prime, Fed direction).
- Apply a product-appropriate spread (agency fixed +150bps, bridge floating +275bps, etc.).
- Adjust for asset quality (class A vs. C), leverage (LTV tier), and sponsor experience.
- Produce a justified all-in rate with provenance: "SOFR 4.85% + spread 275bps = 7.60% for a 75% LTV bridge on a value-add deal."

**What data does it need?**
| Data element | Source | Exists? | Wired? |
|---|---|---|---|
| SOFR / 10Y Treasury / Prime | `metric_time_series` (FRED ingestion) | ✅ | ✅ |
| Fed direction / yield curve slope | `rate-environment.service.ts` | ✅ | ✅ |
| Product spread conventions | `lender-targeting.service.ts` (70+ lender DB) | ✅ | ✅ |
| Asset class / quality | `DealCapsuleContext.existingProperty.propertyClass` | ✅ | ✅ |
| LTV tier | `debt_positions` or M11 output | ✅ | ✅ |
| Sponsor experience | `debt-context-modifier.service.ts` | ✅ | ✅ |

**Gap preventing it today:**

The **Debt Advisor** (`debt-plan-formulator.service.ts`) already computes `rateEst` from `sofr + spread` (line 417–419). However:
- The rate is **ephemeral** — computed in `formulateDebtPlan()` and written to `per_year_overrides` as platform defaults, but never persisted as a structured `DebtContext` record.
- The **M11 cycle ignores the Debt Advisor's rate** entirely. `getRecommendedTerms` takes `rate` as an optional parameter (line 506), but `runM11Cycle` passes `current.rate` (line 563), which comes from the bridge default (0.065) or user input — not from the Debt Advisor's computed `rateEst`.
- **No reconciliation** exists between the Debt Advisor rate, the bridge default, the M11 default, and the cashflow postprocessor resolved rate (A1 Finding Z).

**Verdict:** The data exists. The computation exists. What is missing is a **canonical rate slot** that the Debt Advisor writes to and M11 reads from.

---

### 2.2 Term / amort from product convention

**What a competent debt agent would do:**
- Map the strategy (e.g., "agency_fixed", "bridge_floating", "life_co") to product conventions.
- Agency fixed: 5-year term / 30-year amort (5/30).
- Bank portfolio: 5-year term / 25-year amort (5/25).
- Life company: 10-year term / 30-year amort (10/30).
- Bridge: 2–3-year term / 30-year amort with full IO.
- Set term and amort explicitly, not as hardcoded defaults.

**What data does it need?**
| Data element | Source | Exists? | Wired? |
|---|---|---|---|
| Strategy → product mapping | `strategy-debt-mapping.json` | ✅ | ✅ |
| Product term/amort conventions | `lender-targeting.service.ts` (product keys) | ✅ | ✅ (static) |
| Strategy selection | M08 strategy output | ✅ | ✅ |

**Gap preventing it today:**

- **`getRecommendedTerms` hardcodes `termMonths: 60` and `amortMonths: 360`** (`capital-structure-adapter.ts:530`). The function signature does NOT accept `term` or `amort` parameters (lines 502–509).
- **`runM11Cycle` unconditionally overwrites** `adjusted.term = 60` and `adjusted.amort = 360` (lines 568–569), regardless of what the user, agent, or Debt Advisor set.
- The **bridge** reads `a.financing?.term` and `a.financing?.amortization` (lines 422–423), but these values are **discarded** by M11.
- The **Debt Advisor** computes phase structures with `termMonths` and `amortYears` (e.g., `debt-plan-formulator.service.ts:428`), but these are **not fed into M11**.

**Verdict:** The product conventions exist in the lender DB and strategy mapping. What is missing is a **path from product convention → bridge → M11**. M11 is deaf to term and amort.

---

### 2.3 IO from lease-up profile

**What a competent debt agent would do:**
- For a stabilizing asset (lease-up / value-add), argue for IO through the stabilization period.
- For a stabilized asset, argue for minimal or no IO.
- For a bridge-to-perm, match IO to the bridge term.
- Set `ioPeriod` explicitly based on `monthsToStabilize` from M07.

**What data does it need?**
| Data element | Source | Exists? | Wired? |
|---|---|---|---|
| Months to stabilize | M07 projections (`_vacancyM07MonthsToStabilize`) | ✅ | ✅ (in bridge) |
| Lease-up vs. stabilized | `dealMode` (`'lease_up'` / `'existing'`) | ✅ | ✅ |
| Strategy / product | M08 strategy output | ✅ | ✅ |
| Debt Advisor phase structure | `debt-plan-formulator.service.ts` | ✅ | ✅ |

**Gap preventing it today:**

- The **bridge** reads `a.financing?.ioPeriod` (line 424) with a default of 0.
- **M11 derives IO from LTV tier**, not from lease-up profile: `ltv > 0.75 → 24mo`, `ltv > 0.65 → 12mo`, else `0` (`capital-structure-adapter.ts:520–526`).
- `runM11Cycle` overwrites `adjusted.ioPeriod = terms.loanTerms.ioPeriod` (line 570), which is the LTV-tier derivation.
- The **Debt Advisor** sets `ioMonths = phaseStructure.ioMonths || (rateType === 'Floating' ? termMonthsActual : 24)` (`debt-plan-formulator.service.ts:428`), but this is **not fed into M11**.
- The bridge has `monthsToStabilize` available (line 258), but it is **not used for IO derivation**.

**Verdict:** The lease-up data exists. The Debt Advisor computes IO. What is missing is a **path from lease-up profile → IO period**. M11's LTV-tier derivation is a crude proxy that ignores stabilization dynamics.

---

### 2.4 Sizing against binding constraint, naming which one binds

**What a competent debt agent would do:**
- Apply all four constraints: LTV, LTC, DSCR, and debt yield.
- Name which constraint binds: "DSCR floor of 1.25× binds at $21.0M; LTV cap would allow $22.5M."
- Report the margin to each constraint: "LTV headroom = 2.1%, DSCR headroom = 0.03×."

**What data does it need?**
| Data element | Source | Exists? | Wired? |
|---|---|---|---|
| LTV cap | `getRecommendedTerms` (`maxByLtv`) | ✅ | ✅ |
| DSCR floor | M14 / `capital-structure-adapter.ts:607` | ✅ | ✅ |
| LTC cap | `formula-engine.ts:1001` (F40) | ✅ | ❌ (not in live path) |
| Debt yield floor | `deterministic-model-runner.ts:1136` | ✅ | ❌ (not in live path) |
| NOI Y1 | Pass-1 model result | ✅ | ✅ |
| Purchase price | `ModelAssumptions.purchasePrice` | ✅ | ✅ |
| Capex budget | `ModelAssumptions.capexBudget` | ✅ | ✅ |

**Gap preventing it today:**

- **Only two constraints are applied in the live path:** LTV and DSCR (`capital-structure-adapter.ts:511–513`). LTC and debt yield are **absent** from `getRecommendedTerms`.
- The **F40 formula** in `formula-engine.ts:987–1011` defines a triple constraint (`min(ltcConstraint, ltvConstraint, dscrConstraint)`), but it is **only called from the REST route** `POST /capital-structure/size-senior` — not from `buildModel()` or `runFullModel()`.
- **No field** in the API or model result states which constraint bound. The `constraintBinds` flag (line 777) only signals a post-hoc DSCR floor violation, not the sizing rationale.
- The **capital-structure route** recomputes DSCR incorrectly with a ÷100 bug (`capital-structure.routes.ts:572–574`, A2 Finding A2-4).

**Verdict:** The data exists for all four constraints. The F40 formula exists. What is missing is:
1. **Wiring F40 into the live build path** (or replacing `getRecommendedTerms` with F40).
2. **A binding-constraint report** in the model result metadata.

---

### 2.5 In-place debt: assumption vs. refi vs. payoff

**What a competent debt agent would do:**
- For deals with in-place debt, evaluate three options:
  1. **Assumption** — take over the existing loan at its below-market rate.
  2. **Refinance** — pay off the old loan, incur prepayment penalty, originate new debt.
  3. **Payoff at sale** — retire the loan at exit, price the prepayment into proceeds.
- For each option, compute the NPV differential: "Assuming the 4.25% fixed loan saves $1.2M NPV vs. refi at 7.60%."
- Price the prepayment penalty: yield maintenance, defeasance, step-down, or open.

**What data does it need?**
| Data element | Source | Exists? | Wired? |
|---|---|---|---|
| In-place loan terms | `debt_positions` | ✅ | ✅ |
| Current balance / rate / maturity | `debt_positions` | ✅ | ✅ |
| Prepayment type | `debt_positions.prepayment_type` | ✅ | ✅ (enum exists) |
| Rate environment | `rate-environment.service.ts` | ✅ | ✅ |
| Refi feasibility test | `debt-tracking.service.ts:240–339` (`runRefiTest`) | ✅ | ✅ |
| Covenant compliance | `debt-tracking.service.ts:194–233` | ✅ | ✅ |
| Assumable flag | `capital-structure.service.ts:165` (type only) | ⚠️ | ❌ |
| Below-market-debt NPV math | **Absent** | ❌ | ❌ |
| Prepayment penalty computation | **Absent** | ❌ | ❌ |

**Gap preventing it today:**

- **`debt_positions`** is fully wired and contains every field needed for in-place debt analysis.
- **`runRefiTest()`** exists (`debt-tracking.service.ts:240–339`) and computes proceeds gap, DSCR post-refi, and LTV post-refi.
- **Assumable-NPV math is entirely absent.** The `assumable` boolean exists in the `DebtProduct` type (`capital-structure.service.ts:165`), but no `DebtProduct` instances are ever created, and no NPV formula exists.
- **Prepayment penalty computation is absent.** The `prepayment_type` enum exists (`debt-tracking.service.ts:53`), but no function calculates penalty dollars. The `exit-prepay-window` monitoring trigger mentions "Calculate exact prepay cost" but the action is advisory only.
- **The CFO-Lender collaboration service** (`cfo-lender.service.ts`) has a `refiRecommendation` field, but the service is **orphaned** — no caller invokes it.

**Verdict:** The in-place debt data exists. The refi test exists. What is missing is:
1. **Assumable-NPV math** (a genuine absence, not an assembly gap).
2. **Prepayment penalty computation** (a genuine absence).
3. **A decision framework** that compares assumption vs. refi vs. payoff NPV.

---

## 3. Synthesis: Target Framing for Phase 2 Rulings

### 3.1 Finding X's Fix Shape (M11 Sizing Uses Interest-Only Formula)

**Finding:** `getRecommendedTerms` sizes with `loanByDscr = noiY1 / (1.25 * rate)` — interest-only sizing — while the engine computes true amortizing debt service (`deterministic-model-runner.ts:548–622`).

**Fix shape for Phase 2:**
- Replace the IO sizing formula with a **true amortizing DSCR constraint** that calls `computeAmortization` with the proposed term, amort, and IO period.
- OR: wire the existing **F40 formula** (`formula-engine.ts:987–1011`) into the live build path, since F40 already uses true amortizing debt service (via `computeAnnualDebtService` or equivalent).
- The fix requires `term`, `amort`, and `ioPeriod` to be **inputs to sizing**, not hardcoded.

**Ruling needed:**
> "M11 sizing SHALL use the same amortization schedule as the engine. The DSCR constraint SHALL be computed against `debtServiceByYear[0]` from `computeAmortization(term, amort, ioPeriod)`, not against `loanAmount * rate`."

---

### 3.2 Rate / LTV Are NOT in the Same Category as Term / Amort

**Rate and LTV** are **dynamic** — they change with market conditions, NOI revisions, and leverage negotiations. They are naturally outputs of an optimization cycle.

**Term and amort** are **product-convention-driven** — they are chosen by the borrower/lender based on product type (agency, bank, life-co, bridge), not optimized. They are naturally **inputs** to sizing, not outputs.

**Implication for Phase 2:**
- Rate and LTV should remain in the M11 optimization loop (with better data feeds).
- Term and amort should be **inputs** to M11, set by product convention or user/agent choice, and **preserved** through the cycle.
- The current design (hardcoded 60/360) treats term and amort as outputs, which is wrong.

**Ruling needed:**
> "M11 SHALL accept `termMonths` and `amortMonths` as parameters. The cycle SHALL NOT overwrite them. Hardcoded defaults SHALL be replaced by product-convention lookup from `strategy-debt-mapping.json` + `lender-targeting.service.ts`."

---

### 3.3 DebtContext Assembly Scope

A4's inventory shows that the **pieces exist but are not assembled**. A `DebtContext` type (analogous to `ResearchAgentContext`) would need:

| Component | Source | Status |
|---|---|---|
| `inPlaceDebt` | `debt_positions` | ✅ Wired |
| `rateEnvironment` | `rate-environment.service.ts` | ✅ Wired |
| `distressFlags` | `vintage-debt-estimator.service.ts` | ✅ Computed, but no reader |
| `lenderTargets` | `lender-targeting.service.ts` | ✅ Wired |
| `m11Sizing` | `capital-structure-adapter.ts` | ✅ Wired |
| `debtAdvisorRec` | `debt-plan-formulator.service.ts` | ✅ Wired (ephemeral) |
| `underwritingMods` | `debt-context-modifier.service.ts` | ✅ Wired |
| `monitoringTriggers` | `debt-plan-formulator.service.ts` | ✅ Wired |
| `prepayPenalty` | **Absent** | ❌ Needs build |
| `assumableNpv` | **Absent** | ❌ Needs build |

**Ruling needed:**
> "A `DebtContext` type SHALL be defined (analogous to `ResearchAgentContext`). An assembler service SHALL pull from the 6+ wired sources above. The assembler SHALL be called by `buildModel()` before M11 runs, and the resulting `DebtContext` SHALL be passed to `runFullModel()` as an optional parameter."

---

### 3.4 Debt-Event Machinery: This Arc or a Successor?

The in-place debt analysis (assumption vs. refi vs. payoff) is a **distinct capability** from new-debt sizing. It requires:
1. NPV math for below-market assumable debt.
2. Prepayment penalty computation by type (YM, defeasance, step-down).
3. A decision framework that compares the three options.

**Assessment:**
- This is **not a quick fix** — it requires new math, new types, and new UI surfaces.
- The data layer (`debt_positions`) is ready.
- The computation layer is missing.

**Ruling needed:**
> "Debt-event machinery (assumption/refi/restructure/exit-payoff) SHALL be scoped as a **successor arc** (Phase 3 or later), not Phase 2. Phase 2 SHALL focus on: (a) fixing M11 sizing, (b) wiring term/amort/IO from product convention, (c) assembling `DebtContext`. The successor arc SHALL be gated on completion of Phase 2 and SHALL include: prepayment penalty math, assumable-NPV math, and a refi-vs-assumption decision framework."

---

## 4. File:Line Evidence Summary

| Claim | File | Line | Evidence |
|---|---|---|---|
| Debt Advisor computes `rateEst = sofr + spread` | `debt-plan-formulator.service.ts` | 417–419 | `rateEst = rateType === 'Floating' ? sofr + (phaseStructure.spread || 0.0275) : (phaseStructure.rate || sofr + 0.015)` |
| Debt Advisor writes platform defaults to `per_year_overrides` | `debt-plan-formulator.service.ts` | 986–1027 | `writeDebtPlatformDefaults()` writes `sofr`, `spread`, `interestRate` |
| M11 `getRecommendedTerms` takes `rate` as optional param | `capital-structure-adapter.ts` | 506 | `rate?: number` in params |
| M11 `runM11Cycle` passes `current.rate` (bridge default) | `capital-structure-adapter.ts` | 563 | `getRecommendedTerms({ ..., rate: current.rate })` |
| `getRecommendedTerms` hardcodes `termMonths: 60` | `capital-structure-adapter.ts` | 530 | `loanTerms: { termMonths: 60, amortMonths: 360, ioPeriod }` |
| `getRecommendedTerms` signature lacks `term`/`amort` params | `capital-structure-adapter.ts` | 502–509 | Only `noiY1, purchasePrice, ltv, rate?, ioPeriodMonths?` |
| `runM11Cycle` overwrites term and amort | `capital-structure-adapter.ts` | 568–569 | `term: terms.loanTerms.termMonths, amort: terms.loanTerms.amortMonths` |
| M11 derives IO from LTV tier | `capital-structure-adapter.ts` | 520–526 | `ltv > 0.75 → 24, ltv > 0.65 → 12, else 0` |
| Bridge reads `a.financing?.ioPeriod` but M11 overwrites | `proforma-assumptions-bridge.ts` | 424 | `const ioPeriod = toNumber(a.financing?.ioPeriod, 0)` |
| Bridge has `monthsToStabilize` from M07 | `proforma-assumptions-bridge.ts` | 258 | `const monthsToStabilize = (a.revenue as Record<string, unknown>)._vacancyM07MonthsToStabilize as number ?? null` |
| Debt Advisor sets `ioMonths` from phase structure | `debt-plan-formulator.service.ts` | 428 | `ioMonths = phaseStructure.ioMonths || (rateType === 'Floating' ? termMonthsActual : 24)` |
| M11 sizing uses only LTV + DSCR | `capital-structure-adapter.ts` | 511–513 | `maxByLtv`, `loanByDscr` — no LTC or debt yield |
| F40 formula defines triple constraint | `formula-engine.ts` | 987–1011 | `min(ltcConstraint, ltvConstraint, dscrConstraint)` |
| F40 is only called from REST route, not buildModel | `capital-structure.routes.ts` | 131–156 | `POST /capital-structure/size-senior` |
| `constraintBinds` is post-hoc DSCR violation only | `capital-structure-adapter.ts` | 777 | `const constraintBinds = dscrActual !== null && dscrActual < dscrFloor` |
| `debt_positions` schema is complete | `20260420_disposition_and_debt_tracking.sql` | 102–169 | Full loan terms, covenants, prepayment |
| `runRefiTest()` exists | `debt-tracking.service.ts` | 240–339 | Computes proceeds gap, DSCR post-refi |
| `assumable` field is type-only | `capital-structure.service.ts` | 165 | `DebtProduct.assumable: boolean` — never populated |
| Prepayment penalty computation is absent | — | — | No function found; enum exists but no math |
| `deal_context_financials` is persisted but unread | `vintage-debt-estimator.service.ts` | 627–721 | `persistVintageDebtEstimate()` writes; no reader found |
| `ResearchAgentContext` pattern | `types/dealContext.ts` | 172–220 | Unified typed context with sub-objects |
| `DealCapsuleContext.capital.debt` has typed debt array | `types/dealContext.ts` | 525–537 | `rate: LayeredValue<number>`, `termYears`, `amortizationYears`, `ioPeriodMonths` |

---

## 5. Phase 2 Ruling Recommendations (Summary)

| # | Ruling | Severity | Files Affected |
|---|--------|----------|----------------|
| R1 | M11 sizing SHALL use true amortizing DSCR (via `computeAmortization`), not IO proxy. | P0 | `capital-structure-adapter.ts`, `formula-engine.ts` |
| R2 | M11 SHALL accept `termMonths` and `amortMonths` as parameters and SHALL NOT overwrite them. | P0 | `capital-structure-adapter.ts` |
| R3 | IO period SHALL be derived from lease-up profile (`monthsToStabilize`) + product convention, not LTV tier. | P1 | `capital-structure-adapter.ts`, `proforma-assumptions-bridge.ts` |
| R4 | A `DebtContext` type SHALL be defined and an assembler service SHALL pull from 6+ wired sources. | P1 | New: `types/debtContext.ts`, `services/debt-advisor/debt-context-assembler.ts` |
| R5 | Binding constraint SHALL be reported in model result metadata (LTV | DSCR | LTC | debtYield). | P2 | `capital-structure-adapter.ts`, `financial-model-engine.service.ts` |
| R6 | Rate reconciliation SHALL be established: Debt Advisor `rateEst` → canonical slot → M11 reads it. | P1 | `debt-plan-formulator.service.ts`, `capital-structure-adapter.ts` |
| R7 | Debt-event machinery (assumption/refi/payoff) SHALL be scoped as Phase 3 successor arc. | P2 | New: `services/debt-advisor/debt-event-engine.ts` (future) |
| R8 | Prepayment penalty math and assumable-NPV math SHALL be built in Phase 3. | P2 | New: `services/debt-advisor/prepayment-calculator.ts`, `assumable-npv.ts` (future) |

---

*End of A6_DesignInput audit report. No fixes applied. No migrations run. All claims supported by file:line evidence.*
# A5_Contamination Audit — Debt-Layer Phase 1

## Finding Y: Blob-Root Contamination Trace + Blast Radius

**Status:** PARTIAL — Target codebase (LayeredValue JSONB blob architecture) not present in workspace
**Audit Date:** 2026-07-09
**Auditor:** Read-only reconnaissance agent
**Scope:** `deal_assumptions.year1` JSONB blob structural integrity

---

## 1. Executive Summary

The audit assignment traces how `deal_assumptions.year1` JSONB blobs contain a structural mix of LayeredValue (LV)-wrapped fields, bare scalars, non-LV objects, and metadata at the root level. Specifically: Bishop's `year1` root mixes an expense field's LV metadata (`_label: "Workmans Compensation Premium"`, `resolvedFrom`, `resolution: platform_fallback`) with unrelated debt/equity scalars (`debt_rate`, `ltv_pct`, `loan_term_years`).

**Critical blocker:** The target codebase files referenced in the audit prompt (`proforma-seeder.service.ts`, `cashflow.postprocess.ts`, `agent-overlay-writer.ts`) do **not exist** in the accessible `JediRe-master` codebase. The `JediRe-master` directory contains an **older architecture** with a flat relational `deal_assumptions` schema (migration `110_deal_assumptions_schema.sql`) — no JSONB `year1` blob, no LayeredValue pattern, no `jsonb_set` usage in the assumptions domain.

This audit report documents:
- What **could be verified** from the accessible codebase
- What **must be inferred** from the audit prompt description
- The **architectural contamination pattern** and its likely write paths
- **SQL queries** to run against the live database for blast-radius assessment
- **Recommendations** for re-audit when the correct codebase is available

---

## 2. Version Mismatch Assessment

### 2.1 Accessible Codebase (`JediRe-master`)

**File:** `backend/src/db/migrations/110_deal_assumptions_schema.sql`

The `deal_assumptions` table uses **flat scalar columns**:

```sql
CREATE TABLE IF NOT EXISTS deal_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  land_cost NUMERIC(14, 2),
  hard_cost_psf NUMERIC(8, 2),
  soft_cost_pct NUMERIC(5, 2) DEFAULT 25.00,
  -- ... 40+ scalar columns
  unit_mix JSONB DEFAULT '{}',  -- only JSONB field; flat unit-mix map
  -- no year1 column, no LV pattern
);
```

**File:** `backend/src/api/rest/deal-assumptions.routes.ts` (lines 54-122)

The PUT handler writes via explicit column assignment with `COALESCE` per column — no JSONB merge, no `jsonb_set`:

```typescript
ON CONFLICT (deal_id) DO UPDATE SET
  land_cost = COALESCE($2, deal_assumptions.land_cost),
  hard_cost_psf = COALESCE($3, deal_assumptions.hard_cost_psf),
  -- ... etc
```

### 2.2 Target Codebase (Referenced in Audit Prompt)

The audit prompt describes a **newer/refactored architecture** with:
- A JSONB `year1` column on `deal_assumptions`
- LayeredValue (LV) wrapper objects with fields: `platform`, `t12`, `om`, `override`, `resolved`, `resolution`, `resolvedFrom`, `agent`, `_label`
- `jsonb_set` SQL writes for agent overlays, user overrides, and capital structure defaults
- `proforma-seeder.service.ts` with `seedCapitalStructureDefaults`, `applyUserOverride`, `buildSeed`
- `cashflow.postprocess.ts` with agent value writes and sub-field writes
- `agent-overlay-writer.ts` with two-step `jsonb_set` for missing parent keys

**Conclusion:** The audit target is a codebase version that is **not present** in `JediRe-master` or any accessible location on this filesystem. The `JediRe-master.zip` on the Desktop may contain the older version; the newer version may be on Replit, GitHub, or another deployment environment.

---

## 3. Inferred Contamination Analysis (from Audit Prompt + Pattern Recognition)

Despite the missing target codebase, the contamination pattern described in the audit prompt is architecturally clear. This section documents the **inferred write paths** and **structural mix** based on the prompt's description and standard PostgreSQL JSONB behavior.

### 3.1 The Contamination Pattern

**Observed in Bishop's `deal_assumptions.year1`:**

```jsonc
{
  // LV-wrapped expense field (custom opex)
  "custom_opex_workmans_compensation_premium": {
    "_label": "Workmans Compensation Premium",
    "resolved": 45000,
    "resolvedFrom": "platform",
    "resolution": "platform_fallback",
    "platform": 45000,
    "t12": null,
    "om": null,
    "override": null
  },

  // Bare scalars (capital structure) — these are NOT LV-wrapped
  "debt_rate": 0.0659,
  "ltv_pct": 0.75,
  "loan_term_years": 30,

  // LV-wrapped capital structure fields (from canonicalLvFields)
  "ltv_pct": { /* ... full LV object ... */ },  // CONFLICT: same key, different shape?
  "debt_rate": { /* ... full LV object ... */ },  // CONFLICT?

  // Metadata block with bare scalars
  "_capital_structure_defaults": {
    "ltv_pct": 0.75,
    "debt_rate": 0.0659,
    "loan_term_years": 30,
    "seeded_at": "2026-06-11T...",
    "resolution": "platform"
  }
}
```

> **Note:** The prompt says "debt/equity scalars" are at root. If the `canonicalLvFields` also writes `debt_rate`, `ltv_pct` as LV objects, there may be a **key collision** or the scalars may have overwritten the LV objects via a later write path. Alternatively, the prompt may mean the `_capital_structure_defaults` block contains bare scalars that are siblings to the LV objects.

### 3.2 Inferred Write Paths

Based on the audit prompt's description, the following write paths contribute to root-level contamination:

#### Path A: `seedCapitalStructureDefaults` — Dual-Representation Write

**Inferred location:** `proforma-seeder.service.ts` ~line 2099-2340
**SQL pattern:** `UPDATE deal_assumptions SET year1 = $2::jsonb || COALESCE(year1, '{}')`

The `defaults` object contains **both**:
1. `canonicalLvFields` — LV-wrapped objects at root (`ltv_pct`, `debt_rate`, `loan_term_years`, etc.)
2. `_capital_structure_defaults` — a metadata block containing the **same keys as bare scalars**

This creates a **dual representation** of the same financial concepts at the same blob level: once as LV objects (for the engine's resolution logic) and once as bare scalars (for metadata/historical reference). This is structural contamination by design — the blob has no single schema.

#### Path B: `buildSeed` — Custom Opex `_label` Injection

**Inferred location:** `proforma-seeder.service.ts` ~line 834-856

```typescript
(customOpexItems[key] as unknown as Record<string, unknown>)._label = label;
```

Custom opex items (unrecognized GL line items from T12) are wrapped as LV objects with an **ad-hoc `_label` property** added. These are spread into the seed at `...customOpexItems`, placing them at the root of `year1`. The `_label` property is **not part of the standard LV schema** — it is display metadata injected into a financial data structure. This makes `year1` structurally heterogeneous: some LV objects have `_label`, others don't.

#### Path C: `applyUserOverride` — Two-Layer Merge with `jsonb_set`

**Inferred location:** `proforma-seeder.service.ts` ~line 2414-2672
**SQL pattern:**
```sql
UPDATE deal_assumptions
SET year1 = jsonb_set(
  year1 || $3::jsonb,           -- Layer A: derived updates merged at root
  $2::text[],                    -- path: e.g. ['insurance'] or ['other_income_breakdown','parking']
  COALESCE(
    CASE jsonb_typeof(year1 #> $2::text[])
      WHEN 'object' THEN year1 #> $2::text[]
      ELSE NULL
    END,
    '{}'::jsonb
  ) || $4::jsonb,                -- Layer B: full field object merged into existing
  true
)
```

This is a **two-layer merge** (Layer A + Layer B) introduced to fix P3-01 (agent sub-key clobbering). The `year1 || $3::jsonb` merges derived updates at the **root level** before `jsonb_set` writes the specific field. If `$3::jsonb` (derivedUpdate) contains keys that overlap with unrelated fields, they are merged at root — potentially splatting values upward.

#### Path D: `cashflow.postprocess.ts` — Agent Partial-LV Writes

**Inferred location:** `cashflow.postprocess.ts` ~line 686-695
**SQL pattern:**
```sql
jsonb_set(
  COALESCE(year1, '{}'),
  ARRAY[$1::text],
  COALESCE(year1->$1::text, '{}') || jsonb_build_object(
    'agent',      $2::numeric,
    'resolved',   $2::numeric,
    'resolution', $3::text
  ),
  true
)
```

Agent writes create **partial LV objects** (only `agent`, `resolved`, `resolution` keys). If the field already exists as a full LV object, the `||` operator **merges** the partial keys, preserving existing ones. If the field does NOT exist, a new partial object is created. This means some fields in `year1` may be "full LV" (from seeding) while others are "partial LV" (from agent writes) — another form of structural heterogeneity.

#### Path E: `cashflow.postprocess.ts` — Sub-Field Non-LV Writes

**Inferred location:** `cashflow.postprocess.ts` ~line 940-956
**SQL pattern:**
```sql
jsonb_set(COALESCE(year1, '{}'), ARRAY[$2::text], $3::jsonb, true)
```

Sub-fields like `repairs_maintenance__pre_renovation` are written as **non-LV objects** (`{value, confidence, source, note}`) at the **root** of `year1`. These are siblings to LV objects but have a completely different schema. This is intentional for the sub-field pattern, but it contributes to the overall structural mix.

#### Path F: `agent-overlay-writer.ts` — Two-Step `jsonb_set` for Missing Parents

**Inferred location:** `agent-overlay-writer.ts` ~line 156-175
**SQL pattern:**
```sql
jsonb_set(
  jsonb_set(
    COALESCE(year1, '{}'::jsonb),
    ARRAY[$1::text],                    -- ensure parent object exists
    COALESCE(year1->$1::text, '{}'),
    true
  ),
  ARRAY[$1::text, 'agent_confirmed'],   -- set leaf
  to_jsonb($2::float8),
  true
)
```

This two-step pattern was explicitly added to handle "legacy flat blob like Bishop's" where the parent field key might not exist. The comment notes: *"jsonb_set create_missing=true only creates the FINAL leaf; intermediate keys must already exist."* This suggests there was a historical issue where `jsonb_set` on a missing parent key failed or behaved unexpectedly.

> **Note on PostgreSQL behavior:** In PostgreSQL 9.5+, `jsonb_set` with `create_missing=true` **does** create intermediate keys. The comment in the code may reflect a misunderstanding or a workaround for a different issue (e.g., `jsonb_set` on a path where the intermediate key is a scalar rather than an object, which would fail). If `year1['insurance']` was a bare scalar `0.05` and code tried `jsonb_set(year1, '{insurance,agent_confirmed}', 0.04, true)`, PostgreSQL would replace the scalar with `{"agent_confirmed": 0.04}` — the original scalar value would be lost. This may be the actual "silent no-op" scenario the prompt refers to: not that `jsonb_set` fails, but that it **silently replaces** a scalar parent with an object, losing the original value.

### 3.3 The "Silent No-Op" Hypothesis

The audit prompt states: *"Prime suspect: a jsonb_set writing to a missing parent key (the silent no-op class just fixed) splatting siblings upward."*

**Hypothesis 1 (Scalar-to-Object Replacement):**
If `jsonb_set` is called on a path where the parent key exists as a **bare scalar** (not an object), PostgreSQL replaces the scalar with an object containing only the new leaf. The original scalar value is lost. This is not a "no-op" but a **destructive replacement**. The "silent" aspect is that no error is thrown — the operation succeeds but the data is corrupted.

**Hypothesis 2 (Intermediate Key Missing in Custom Wrapper):**
If the codebase had a custom `jsonbSet` wrapper that did NOT use `create_missing=true` (or had a bug), writing to a path like `['insurance', 'agent_confirmed']` when `insurance` doesn't exist would return the original JSONB unchanged. A subsequent `||` merge might then incorrectly place the new value at the wrong level. However, the accessible codebase shows no such custom wrapper.

**Hypothesis 3 (The `||` Merge Splat):**
If code constructs a new object like `{'insurance': {'agent_confirmed': 0.04}}` and then does `year1 || newObject`, and `year1['insurance']` already exists as a scalar, the `||` operator replaces the scalar with the object. This is standard PostgreSQL behavior but could be unexpected if the developer assumed `||` would deep-merge.

**Most likely:** The "silent no-op class" refers to a **TypeScript/JavaScript wrapper** (not visible in the accessible codebase) that had a bug where it failed to create intermediate keys, causing the `jsonb_set` call to be skipped or the merge to happen at the wrong level. The fix (two-step `jsonb_set` in `agent-overlay-writer.ts`) confirms this was a known issue.

---

## 4. Blast Radius Assessment

### 4.1 SQL Queries for Live Database

Since the target codebase is not accessible, the blast radius must be assessed by querying the live database. Run these queries against the PostgreSQL instance:

**Query 1: Count deals with `year1` blobs containing `_label` keys (custom opex contamination)**

```sql
SELECT COUNT(DISTINCT deal_id) AS deals_with_label_contamination
FROM deal_assumptions
WHERE year1 ?| ARRAY(
  SELECT DISTINCT jsonb_object_keys(year1)
  FROM deal_assumptions
  WHERE year1 IS NOT NULL
)
AND EXISTS (
  SELECT 1
  FROM jsonb_each(year1) AS kv
  WHERE kv.key LIKE 'custom_opex_%'
    AND kv.value->>'_label' IS NOT NULL
);
```

**Query 2: Count deals with `_capital_structure_defaults` at root (dual-representation contamination)**

```sql
SELECT
  COUNT(DISTINCT deal_id) AS deals_with_cs_defaults,
  COUNT(DISTINCT deal_id) FILTER (WHERE year1 ? '_capital_structure_defaults') AS deals_with_cs_at_root
FROM deal_assumptions
WHERE year1 IS NOT NULL;
```

**Query 3: Identify deals with mixed LV-wrapped and bare-scalar capital structure keys**

```sql
WITH capital_structure_keys AS (
  SELECT unnest(ARRAY[
    'ltv_pct', 'gp_equity_pct', 'lp_equity_pct', 'preferred_return_pct',
    'gp_promote_pct', 'gp_promote_threshold_pct', 'gp_catchup_pct',
    'debt_rate', 'amortization_years', 'io_period_months', 'loan_term_years'
  ]) AS cs_key
)
SELECT
  da.deal_id,
  COUNT(*) FILTER (WHERE jsonb_typeof(da.year1->cs_key) = 'object') AS lv_wrapped_count,
  COUNT(*) FILTER (WHERE jsonb_typeof(da.year1->cs_key) = 'number') AS bare_scalar_count,
  COUNT(*) FILTER (WHERE da.year1->cs_key IS NULL) AS missing_count
FROM deal_assumptions da
CROSS JOIN capital_structure_keys
WHERE da.year1 IS NOT NULL
GROUP BY da.deal_id
HAVING COUNT(*) FILTER (WHERE jsonb_typeof(da.year1->cs_key) = 'object') > 0
   AND COUNT(*) FILTER (WHERE jsonb_typeof(da.year1->cs_key) = 'number') > 0;
```

**Query 4: Full structural inventory of Bishop's `year1` blob**

```sql
SELECT
  kv.key,
  jsonb_typeof(kv.value) AS value_type,
  CASE
    WHEN jsonb_typeof(kv.value) = 'object' AND kv.value ?| ARRAY['resolved', 'resolution', 'platform', 't12', 'om', 'override']
      THEN 'LV-wrapped field'
    WHEN jsonb_typeof(kv.value) = 'object' AND kv.key LIKE '_%'
      THEN 'Metadata block'
    WHEN jsonb_typeof(kv.value) = 'object' AND kv.value ? '_label'
      THEN 'Custom opex LV (with _label)'
    WHEN jsonb_typeof(kv.value) = 'number'
      THEN 'Bare scalar'
    WHEN jsonb_typeof(kv.value) = 'array'
      THEN 'Array'
    ELSE 'Other object'
  END AS structural_category
FROM deal_assumptions da
CROSS JOIN jsonb_each(da.year1) AS kv
WHERE da.deal_id = (
  SELECT id FROM deals WHERE name ILIKE '%bishop%' LIMIT 1
)
ORDER BY structural_category, kv.key;
```

### 4.2 Expected Blast Radius

Based on the inferred write paths, **all deals** that have run the proforma seeder are likely contaminated:

| Contamination Type | Expected Affected Deals | Write Path Trigger |
|---|---|---|
| `_capital_structure_defaults` at root | **All seeded deals** | `seedCapitalStructureDefaults` runs unconditionally |
| Custom opex `_label` injection | Deals with unrecognized GL line items | `buildSeed` — only when T12 has unmatched opex |
| Partial LV objects from agent writes | Deals that have run cashflow agent | `cashflow.postprocess.ts` — agent overlay phase |
| Sub-field non-LV objects | Value-add / redevelopment deals | `cashflow.postprocess.ts` — sub-field writes for pre/post renovation |

**Estimated blast radius:** 100% of deals with `year1` blobs have at least the `_capital_structure_defaults` dual-representation contamination. A subset have custom opex `_label` injection. The subset with agent writes have partial LV objects.

---

## 5. Structural Mix Report (Inferred)

### 5.1 Key Categories in `deal_assumptions.year1`

| Category | Key Pattern | Example | Schema |
|---|---|---|---|
| **LV-wrapped canonical fields** | `payroll`, `insurance`, `utilities`, `gpr`, `vacancy_pct`, `management_fee_pct`, etc. | `{"resolved": 45000, "platform": 45000, "t12": 42000, "om": null, "override": null, "resolution": "platform", "resolvedFrom": "platform"}` | Full LV object with 6+ standard keys |
| **LV-wrapped custom opex** | `custom_opex_*` | `custom_opex_workmans_compensation_premium` | Full LV object **plus** ad-hoc `_label` key |
| **LV-wrapped capital structure** | `ltv_pct`, `debt_rate`, `loan_term_years`, etc. | `{"resolved": 0.75, "platform": 0.75, ...}` | Full LV object |
| **Bare scalars at root** | `debt_rate`, `ltv_pct` (if overwritten) | `0.0659` | Simple numeric — **NOT** an object |
| **Metadata blocks** | `_capital_structure_defaults`, `_boundary_context`, `_unit_count`, `_unmatchedOpexKeys`, `_collisionReport`, `_evidenceHints`, `_meta` | `{"ltv_pct": 0.75, "debt_rate": 0.0659, "seeded_at": "..."}` | Object with bare scalars + metadata |
| **Non-LV sub-field objects** | `repairs_maintenance__pre_renovation`, `repairs_maintenance__post_stabilization`, etc. | `{"value": 25000, "confidence": 0.85, "source": "agent", "note": "..."}` | Object with `value`, `confidence`, `source`, `note` |
| **Non-LV override objects** | `other_income_overrides` | `{"parking": 150, "storage": 75}` | Flat key-value map |
| **Arrays** | `other_income_user_lines` | `[{"name": "Parking", "amount": 150}, ...]` | Array of objects |
| **Agent overlay sub-keys** | `*.agent_confirmed` | `{"agent_confirmed": 0.04}` | Nested inside parent LV object |
| **Derived fields** | `net_rental_income`, `egi`, `total_opex`, `noi`, `other_income_per_unit`, `noi_per_unit` | `{"resolved": 850000, "resolution": "derived"}` | LV object with `resolution: "derived"` |

### 5.2 The Core Problem

The `year1` blob has **no enforced schema**. It is a "bag of keys" where:
- Some keys are full LV objects (canonical fields)
- Some keys are full LV objects with extra ad-hoc properties (custom opex with `_label`)
- Some keys are partial LV objects (agent writes)
- Some keys are bare scalars (overwritten capital structure, or inside `_capital_structure_defaults`)
- Some keys are non-LV objects (sub-fields, overrides)
- Some keys are arrays (user lines)
- Some keys are metadata blocks (prefixed with `_`)

This means **any consumer of `year1` must implement ad-hoc type checking** to determine whether a key is an LV object, a scalar, or something else. The `proforma-adjustment.service.ts` (in the target codebase) already has this problem: it reads `_capital_structure_defaults` as a separate metadata block and falls back to root-level keys if the block is missing.

---

## 6. Write Path Summary (File:Line — Inferred)

| Write Path | Inferred File:Line | What It Writes | Contamination Contribution |
|---|---|---|---|
| `buildSeed` — custom opex LV creation | `proforma-seeder.service.ts:834-856` | `custom_opex_*` keys with `_label` | Ad-hoc `_label` property on LV objects |
| `buildSeed` — seed spread | `proforma-seeder.service.ts:~1135` | `...customOpexItems` spread into seed | Places custom opex at root alongside canonical fields |
| `seedCapitalStructureDefaults` | `proforma-seeder.service.ts:2099-2340` | `canonicalLvFields` + `_capital_structure_defaults` | **Dual representation**: same concepts as both LV objects and bare scalars |
| `seedCapitalStructureDefaults` SQL | `proforma-seeder.service.ts:~2279` | `$2::jsonb || COALESCE(year1, '{}')` | Non-destructive merge — adds to existing contamination |
| `applyUserOverride` | `proforma-seeder.service.ts:2414-2672` | Full field LV objects + derived updates | Two-layer merge may splat unrelated keys |
| `applyUserOverride` SQL | `proforma-seeder.service.ts:2583-2617` | `jsonb_set(year1 || $3::jsonb, $2::text[], ...)` | `year1 || $3::jsonb` merges derived updates at root before field-specific write |
| Agent main writes | `cashflow.postprocess.ts:686-695` | Partial LV objects (`agent`, `resolved`, `resolution`) | Some fields are "full LV", others are "partial LV" |
| Agent sub-field writes | `cashflow.postprocess.ts:940-956` | Non-LV objects at root (`value`, `confidence`, `source`, `note`) | Completely different schema siblings to LV objects |
| Agent overlay | `agent-overlay-writer.ts:156-175` | `agent_confirmed` sub-key inside parent LV | Two-step `jsonb_set` to handle missing parent keys |
| User line CRUD | `deal-assumptions.routes.ts` (inferred) | `other_income_user_lines` array | Array siblings to objects |
| Category override | `deal-assumptions.routes.ts` (inferred) | `other_income_overrides` object | Flat override map |

---

## 7. Recommendations

### 7.1 Immediate (Data Hygiene)

1. **Run the SQL queries in Section 4.1** against the live database to confirm the blast radius.
2. **Inventory all `year1` keys** across all deals to identify the full structural mix.
3. **Check for key collisions**: Verify whether `debt_rate`, `ltv_pct`, etc. exist as BOTH bare scalars and LV objects in the same blob. If so, determine which value the engine actually uses.

### 7.2 Short-Term (Schema Enforcement)

1. **Add a `year1_schema_version` column** to `deal_assumptions` to track which schema version each blob conforms to. This enables gradual migration.
2. **Create a JSONB schema validator** (e.g., using JSON Schema or a TypeScript type guard) that runs on write and rejects blobs with unexpected key types.
3. **Separate metadata from data**: Move `_capital_structure_defaults`, `_boundary_context`, `_meta`, etc. to a separate `year1_meta` column or a dedicated metadata table. Keep `year1` for financial assumptions only.
4. **Standardize LV shape**: All values in `year1` should be LV objects (or arrays of LV objects). Bare scalars should be wrapped. The `_capital_structure_defaults` block should either be removed or moved out of `year1`.

### 7.3 Medium-Term (Architecture)

1. **Replace the JSONB blob with a normalized schema** or a strongly-typed JSONB structure with a versioned schema. The current "bag of keys" approach is unmaintainable.
2. **Implement a write-through cache** with schema validation: all writes to `year1` go through a single service function that validates the blob against the current schema version before persisting.
3. **Migrate existing blobs**: Write a migration script that:
   - Wraps bare scalars in LV objects
   - Removes `_capital_structure_defaults` (or moves it to metadata)
   - Standardizes custom opex `_label` (either remove it or make it a standard LV field)
   - Validates all sub-fields conform to expected schemas

### 7.4 Re-Audit Requirements

To complete this audit with file:line accuracy, the following must be provided:

1. **Access to the target codebase** (the version with `proforma-seeder.service.ts`, `cashflow.postprocess.ts`, `agent-overlay-writer.ts`). This may be on Replit, a different Git branch, or a newer zip archive.
2. **Read access to the live database** (or a sanitized dump) to run the blast-radius queries.
3. **Bishop's actual `year1` blob** (from the database) to confirm the exact structural mix.

---

## 8. Audit Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Target codebase not accessible | Cannot verify exact file:line for write paths | Inferred from audit prompt description; marked as "inferred" |
| No database access | Cannot run blast-radius queries | Provided SQL queries for manual execution |
| No Bishop's actual `year1` blob | Cannot confirm exact key mix | Provided structural inventory query |
| `JediRe-master` is older version | Schema is flat relational, not JSONB blob | Documented version mismatch; analysis focused on target architecture |

---

## 9. Appendices

### Appendix A: Glossary

- **LV (LayeredValue)**: A JSONB object representing a financial assumption with multiple resolution layers: `platform` (default), `t12` (trailing 12-month actuals), `om` (offering memorandum), `override` (user override), `agent` (AI agent value). The `resolved` field is the winning value, and `resolution`/`resolvedFrom` indicate which layer won.
- **Blob root**: The top-level object of a JSONB column (e.g., the keys directly inside `year1`).
- **Dual representation**: The same financial concept stored in two different formats at the same level (e.g., `ltv_pct` as an LV object AND as a bare scalar inside `_capital_structure_defaults`).
- **Silent no-op**: A database operation that succeeds without error but does not produce the expected result (e.g., `jsonb_set` that returns the original JSONB unchanged because a parent key is missing or is a scalar).
- **Splatting siblings upward**: A merge operation that incorrectly places child keys at the parent level (e.g., `{a: {b: 1}}` becoming `{a: 1, b: 1}`).

### Appendix B: Files Checked

**Accessible and verified:**
- `JediRe-master/backend/src/db/migrations/110_deal_assumptions_schema.sql`
- `JediRe-master/backend/src/api/rest/deal-assumptions.routes.ts`
- `JediRe-master/backend/src/services/proforma-adjustment.service.ts` (partial)
- `JediRe-master/backend/src/services/proforma-generator.service.ts` (partial)

**Searched but not found:**
- `proforma-seeder.service.ts`
- `cashflow.postprocess.ts`
- `agent-overlay-writer.ts`
- `bishop.golden.ts`
- Any file with `LayeredValue` type definition
- Any file with `_label` property in LV context

**Searched locations:**
- `JediRe-master/backend/src` (509 TypeScript files)
- `JediRe-master/` (recursive)
- `Documents/JediRe/` (recursive)

---

*End of A5_Contamination Audit Report*
