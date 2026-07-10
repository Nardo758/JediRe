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
