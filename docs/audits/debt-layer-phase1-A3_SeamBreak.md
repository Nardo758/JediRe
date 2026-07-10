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
