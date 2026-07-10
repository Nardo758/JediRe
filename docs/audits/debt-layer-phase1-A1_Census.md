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
