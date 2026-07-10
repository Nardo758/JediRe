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
