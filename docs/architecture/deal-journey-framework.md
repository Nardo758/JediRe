# Deal Journey Framework — Architecture Spec

**Status:** Draft architecture spec — implementation contract for future build sessions
**Owner:** Leon / JEDI RE
**Pairs with:** `dealContext.types.ts` (existing Deal Capsule), `OPERATOR_STANCE_PHASE1_SPEC.md`, `ROADMAP_M36_M38.md`, `TRAFFIC_ENGINE_CALIBRATION_SPEC.md`, `Event_Impact_Engine_Spec.md`, `DATA_QUALITY_AGENT_SPEC.md`

---

## 1. Purpose

The platform has substantial infrastructure for analyzing deals — Pro Forma columns (broker / T-12 / rent roll / platform), Assumptions (forward-looking levers), Year 1 (resolved first-year snapshot), Projections (multi-year forecast), Strategy Arbitrage (M08), JEDI Score (M25), Risk (M14), OperatorStance (meta-layer modulating Cashflow Agent discretion), and the partially-shipped M36 plausibility / M37 analog / M38 calibration stack (M36 Phase 1 — Pareto frontier with role-aware sorting and plausibility scoring — shipped 2026-05-19 via postprocessor fallback; full joint distribution math pending).

What's missing is a **unified semantic model** that names the underwriter's actual mental task: "this deal is at point A today; my thesis says it gets to point B; here's the path; here are the levers; here's how aggressive my path is." The data exists across modules; the framework that names and integrates it does not.

This spec defines that framework. It introduces:

- A **vocabulary** (State A, State B, Gap, Path, Levers, Aggressiveness, Strategy Frame, Calibration Confidence)
- A **`DealJourney` unified object** that composes from existing `DealContext` fields
- A **module contribution map** showing which existing modules fill which slots
- **LOCKED / PENDING / NEW markers** so build work can be sequenced cleanly
- **Calibration contracts** for M07 and M35 — what they must produce to fill PENDING slots

The framework is primarily a documentation and integration layer. ~70% of the data already exists in the platform; the framework names and binds it together.

---

## 2. The Vocabulary

Seven concepts, each defined against existing platform infrastructure.

### State A — Current Financial Reality

The AS-IS snapshot of the deal at acquisition (or the moment of analysis).

- **What it is:** observed, measurable, source-document-grounded
- **Defined by:** Pro Forma column values (Broker / T-12 / Rent Roll layers of `LayeredValue<T>`), DQA-protected for accuracy
- **Characterized by metrics:** in-place NOI, occupancy, in-place rent vs market rent gap, expense ratios, deferred CapEx, age, condition class
- **Existing source:** `FinancialContext.outputs` (when those outputs are computed from broker/T-12 layers without forward growth applied), `ExistingPropertyContext` (yearBuilt, totalUnits, occupancy, currentNOI, askingPrice, propertyClass), `MarketContext` (avgRent, avgOccupancy as the market reference for State A)

### State B — Stabilized Underwriting Target

The "to be" projection at stabilization — what the deal *becomes* if the thesis works.

- **What it is:** assumed, forward-looking, the underwriter's commitment
- **Defined by:** target stabilized assumption set + the resulting metric vector (target NOI, market rent achieved, normalized occupancy, normalized expenses, exit cap, hold period)
- **Existing source:** `FinancialContext.assumptions` (the levers that *get to* B) + `FinancialContext.outputs` when computed forward at stabilization year. The platform already has primitive State A / State B in `RedevelopmentContext.existingNOI` and `projectedNOI`; the framework generalizes that pair to all deal types.

### Gap (Δ)

Quantified delta between A and B per metric. The size of the *bet* the underwriter is making.

- **Examples:** "Rent +$300/unit (+17%)", "Occupancy +20pts (75% → 95%)", "$3M CapEx required to support B"
- **Existing source:** *no first-class object today* — derivable from State A and State B but not surfaced as its own structure
- **Status:** NEW. The `Gap` object is computed and surfaced for the first time in this framework.

### Path — Year 1 through Year N

The trajectory between A and B, year by year. The *shape* of how A becomes B over the hold period.

- **What it is:** the multi-year time series of every projected metric, with confidence bands where calibrated
- **Existing source:**
  - `FinancialContext.outputs` per-year projections (Year 1, Year 2, ... Year N)
  - `M07 trafficProjection.yearly[*]` (occupancy, walk-ins, tours, apps, leases per week, vacancyPct, effRent, rentGrowthPct per year)
  - `M07 leaseUp.weeksTo90/93/95` (timeline of A→B for occupancy specifically)
  - `M07 leasingSignals.confidence` (single confidence value today; asymmetric percentile bands PENDING per `PROJECTIONS_TRAFFIC_ENGINE_AUDIT.md`)
- **Status:** Mostly LOCKED at the data level (per-year values exist), confidence bands PENDING

### Levers — Assumptions

The variables the underwriter moves to shape the path. Each lever has source layers (LayeredValue), platform default, evidence, and (after M36) an aggressiveness contribution.

- **Existing source:** `FinancialContext.assumptions` exhaustively typed:
  - `rentGrowth`, `expenseGrowth`, `vacancy`, `exitCapRate`, `holdPeriod`, `capexPerUnit`, `managementFee` — all `LayeredValue<number>`
  - Plus deal-type-specific levers via `DevelopmentPath`, `RedevelopmentContext.delta`, `UnitMixRow.targetRent`
- **Per-lever evidence:** sourced from M05 (Market) for rent growth, M07 (Traffic) for occupancy ramp, M04 (Supply) for vacancy adjustments, M26 (Tax) for tax assessment growth, etc.
- **Status:** LOCKED at the data level (all levers exist as `LayeredValue<T>`), evidence-source provenance PENDING (per-lever `evidenceSourceModule` field is NEW)

### Aggressiveness — Mahalanobis Score

How "stretch" is the assumption set, given historical covariance? Quantifies the size of the bet.

- **What it is:** scalar `d²` from M36 plausibility scoring (Mahalanobis distance from historical mean), with per-variable contribution decomposition
- **Existing source:** M36 Σ engine — Phase A (heuristic Σ with hand-calibrated values) is in progress per `ROADMAP_M36_M38.md`. Phase B (empirical Σ from historical data) is sequenced next.
- **Status:** PENDING M36 Phase A completion; the framework defines the slot, M36 fills it.

### Strategy Frame — M08 Classification

Which strategy archetype best matches this A→B path? Core / Core-Plus / Value-Add / Deep Value-Add / Distressed / Lease-Up / Ground-Up Dev / Redevelopment.

- **Existing source:** `StrategyContext.selectedStrategy`, `scores` (per-strategy scoring), `arbitrageGap`, `verdict` — all live in `dealContext.types.ts`
- **Status:** LOCKED. The framework names what already exists.

### Calibration Confidence — M38 Reliability

How accurately have the platform's predictions about paths like this one matched realized outcomes historically? The confidence the platform's path predictions deserve.

- **Existing source:** M38 Calibration Ledger — not started per `ROADMAP_M36_M38.md` Phase E
- **Status:** PENDING M38 build. Framework defines the slot.

---

## 3. Architectural Position

```
                ┌────────────────────────────────────────────────────────┐
                │                  EXISTING DEAL CAPSULE                  │
                │            (frontend/src/stores/dealContext.types.ts)   │
                │                                                         │
                │  DealContextBase: identity, productType, site, zoning,  │
                │    operatorStance, market, supply, financial, capital,  │
                │    strategy, scores, risk + 33 typed LayeredValue<T>    │
                │    fields                                               │
                │                                                         │
                │  ExistingDealContext / DevelopmentDealContext /         │
                │  RedevelopmentDealContext extend the base              │
                └────────────────────────┬───────────────────────────────┘
                                         │ source for journey composition
                                         │
                ┌────────────────────────▼───────────────────────────────┐
                │              DEAL JOURNEY FRAMEWORK                     │
                │                                                         │
                │  DealJourney {                                          │
                │    stateA       — composed from existing fields        │
                │    stateB       — composed from assumptions + outputs  │
                │    gap          — NEW: derived A↔B delta object        │
                │    path         — yearly projections + M07 trajectory  │
                │    levers       — FinancialContext.assumptions + meta  │
                │    aggressiveness — PENDING M36                        │
                │    strategyFrame  — StrategyContext (existing)         │
                │    calibration  — PENDING M38                          │
                │  }                                                      │
                └────────────────────────┬───────────────────────────────┘
                                         │ consumed by
                                         │
                ┌────────────────────────┼───────────────────────────────┐
                │                        │                                │
   ┌────────────▼────────────┐  ┌────────▼─────────┐  ┌──────────────────▼──┐
   │  UI — Journey Overlay   │  │  CASHFLOW AGENT  │  │  RESEARCH AGENT     │
   │  (NEW: cross-tab        │  │  (reads journey  │  │  (composes journey  │
   │  surfacing of A→B)      │  │  vocabulary in   │  │  into DealContext   │
   │                         │  │  prompts; goal-  │  │  cache; emits to    │
   │                         │  │  seeks within    │  │  downstream agents) │
   │                         │  │  journey space)  │  │                     │
   └─────────────────────────┘  └──────────────────┘  └─────────────────────┘
```

The framework does not replace any existing module. It composes existing fields under named slots, adds the `Gap` derivation as new, and identifies PENDING slots that M36 / M37 / M38 / M07 / M35 calibration work fills.

---

## 4. The DealJourney Unified Object

See `frontend/src/stores/dealJourney.types.ts` for the canonical type definition.

The interface composes from existing `DealContext` fields. The runtime construction is a derived selector — `useDealJourney(dealContext)` — rather than a new persisted entity. State A and State B are computed views over the same underlying `LayeredValue<T>` data the rest of the platform reads.

---

## 5. Module Contribution Map

For each `DealJourney` slot, the module that populates it and where in code that already happens.

| Journey slot | Source module | File / type reference | Status |
|---|---|---|---|
| `stateA.noi` | M09 | `FinancialContext.outputs.noi` (computed from broker/T-12 layers without growth) | LOCKED |
| `stateA.occupancy` | M07 / rent roll | `ExistingPropertyContext.occupancy.value` + `extraction_rent_roll` | LOCKED |
| `stateA.inPlaceRentPerUnit` | rent roll | `extraction_rent_roll`, weighted by unit | LOCKED |
| `stateA.marketRentPerUnit` | M05 | `MarketContext.avgRent.value` | LOCKED |
| `stateA.sourceLayers` | composer | `financials-composer.ts` — checks which extraction objects exist | LOCKED |
| `stateA.dataQualityFindings` | DQA | `data_quality_alerts` table count for State A inputs | LOCKED (built in Task #711) |
| `stateB.targetNoi` | M09 | `FinancialContext.outputs.noi` at stabilization year | LOCKED |
| `stateB.targetOccupancy` | M07 / OperatorStance | `M07 leaseUp.weeksTo95` produces stabilization year; occupancy assumption | LOCKED |
| `stateB.exitCapRate` | M09 / M05 | `FinancialContext.assumptions.exitCapRate` | LOCKED |
| `stateB.yearOfStabilization` | M07 | `M07 leaseUp.weeksTo95` / 52, rounded | LOCKED |
| `gap.*` | derived | NEW computed object — `computeJourneyGap(stateA, stateB)` | BUILT (Task #711) |
| `path.yearByYear[*].noi` | M09 | per-year projection output | LOCKED |
| `path.yearByYear[*].occupancy` | M07 | `trafficProjection.yearly[*].occupancyPct` | LOCKED |
| `path.yearByYear[*].rentGrowthPct` | M07 / M05 | `trafficProjection.yearly[*].rentGrowthPct` (already on response) | LOCKED |
| `path.yearByYear[*].confidenceBand` | M07 | `leasingSignals.confidence` exists but only as scalar; asymmetric percentiles PENDING per `PROJECTIONS_TRAFFIC_ENGINE_AUDIT.md` | PENDING M07 backend wiring |
| `path.leaseUpTimeline` | M07 | `trafficProjection.leaseUp.weeksTo90/93/95` | LOCKED (data exists, surfacing varies) |
| `path.eventAdjustedTrajectory` | M35 | Event Impact Engine spec exists; integration with M07 path PENDING per `CLAUDE.md` Section 2.3 note | PENDING M35 integration |
| `path.pathConfidence` | M38 | Calibration Ledger not started per `ROADMAP_M36_M38.md` Phase E | PENDING M38 build |
| `levers.*` (assumption layers) | M09 | `FinancialContext.assumptions.*` (all `LayeredValue<T>`) | LOCKED |
| `levers.perLeverEvidence` | per-lever modules | M05 for rent growth, M07 for occupancy, M04 for vacancy, M26 for tax, M37 for analog priors | BUILT (Task #711, derived at read time) |
| `levers.stanceModulators` | OperatorStance | `frontend/src/types/operator-stance.ts:24` | LOCKED |
| `aggressiveness.*` | M36 | Phase A (heuristic Σ) in progress per `ROADMAP_M36_M38.md` | PENDING M36 Phase A |
| `strategyFrame.*` | M08 | `StrategyContext` in `dealContext.types.ts` | LOCKED |
| `calibration.*` | M38 | Not started | PENDING M38 build |
| `scoreTrajectory.scoreAtA` | M25 | `JEDIScoreContext.overall` | LOCKED |
| `scoreTrajectory.scoreAtB` | M25 | No current code projects forward score | TODO — M25 extension |

**Distribution:** 16 LOCKED slots, 5 PENDING slots, 4 NEW/BUILT slots. ~70% of the journey is composable from existing infrastructure today.

---

## 6. Calibration Contracts (the PENDING slots' assignments)

The framework converts vague calibration goals into concrete output contracts. Each PENDING slot is what the relevant module-calibration work must produce.

### 6.1 M07 Confidence Band Contract

`path.yearByYear[*].confidenceBand` requires M07 to produce, per year:

```typescript
{
  p10: number,      // pessimistic
  p25: number,
  median: number,
  p75: number,
  p90: number       // optimistic
}
```

Asymmetric bands per `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` Section 1.5 — right-tail uncertainty on lease-up absorption is wider than left-tail. The current `leasingSignals.confidence` scalar is insufficient.

**Calibration target:** residuals between predicted percentiles and historical realized values on comparable properties (matched on submarket, class, vintage, unit count) must satisfy reliability — actual realizations should fall below P25 ~25% of the time, above P75 ~25% of the time, with RMSE on the median of < X (X to be calibrated empirically).

**Backend deliverable:** `M07 trafficProjection` response object extends `yearly[*]` with `confidenceBand` field per the schema above.

### 6.2 M35 Event-Adjusted Trajectory Contract

`path.eventAdjustedTrajectory` requires M35 to produce, per year, a list of event impacts overlaid on the baseline path:

```typescript
Array<{
  year: number,
  deltas: {
    noi?: number,                  // dollar delta vs baseline
    occupancy?: number,            // pp delta
    rentGrowthPct?: number,        // pp delta
    exitCapRate?: number           // bps delta
  },
  eventIds: string[]               // which events drove the deltas
}>
```

**Backend deliverable:** `M35.computeEventImpacts(dealId, pathBaseline)` returns the array above.

### 6.3 M36 Aggressiveness Contract

`aggressiveness.*` requires M36 Phase A heuristic Σ to produce, per assumption set:

- `mahalanobisD: number` — d² from historical center (or hand-calibrated heuristic Σ at Phase A)
- `band: 'Realistic' | 'Stretch' | 'Aggressive' | 'Heroic'` — per `M36_Joint_Distribution_Engine_Spec.md` Section 4.4 thresholds (≤1, ≤2, ≤3, >3)
- `perVariableContribution: Array<{ variable, contribution, direction }>` — from the d² decomposition formula in the spec
- `paretoFrontier?: Array<...>` — optional, populated only when Cashflow Agent runs goal-seek. **SHIPPED (2026-05-19):** `run_joint_goal_seek` postprocessor fallback fires after every cashflow run; 5-bundle Pareto frontier with role-aware sorting and per-bundle plausibility scoring now writes to `proforma.capital_structure.optimization.pareto_frontier`. Role resolved deterministically from `investors.type` (see Capital Structure Engine doc for role resolution details). Full joint distribution math (Σ matrix, regime detection) is Phase 2.

**Backend deliverable:** `POST /api/sigma/plausibility` and `POST /api/sigma/goal-seek` per `ROADMAP_M36_M38.md` Phase A scope. Partial implementation ships via cashflow postprocessor; REST endpoints not yet built.

### 6.4 M38 Calibration Contract

`calibration.*` requires M38 Calibration Ledger to produce, per `(asset_class, regime, market_tier)` stratum:

- `pathPredictionReliability: number` — 0-1, fraction of historical predictions where the median fell within the realized range
- `ciWideningFactor: number` — multiplier to widen CIs to achieve target reliability (typically ≥1.0)
- `driftStatus: 'stable' | 'drift_detected' | 'no_data'` — from drift detection on rolling reliability scores

**Backend deliverable:** `predictions` and `realizations` tables, pairing engine, reliability stats per stratum, drift detection per `ROADMAP_M36_M38.md` Phase E.

---

## 7. UI Implications

The F-key tab structure (F1 Overview / F2 Zoning / F3 Market / F4 Supply / F5 Strategy / F6 Traffic / F8 Debt / F9 ProForma / F10 Risk / F11 Tools per `f9-proforma-spec.md` Section 1) is full and load-bearing. The Journey framework does NOT introduce a new top-level F-tab.

**Implemented surface (Task #711):** A Journey overlay accessible via a "JOURNEY" button in the Financial Engine page header, rendering the journey as a single-page modal. Three sections:

1. **State A → State B summary card** — shows the bet in one frame: NOI uplift, occupancy uplift, rent uplift, capex required, hold period, exit cap. Each metric shows source and DQA finding count if any.
2. **Path visualization** — year-by-year trajectory with confidence bands (when M07 calibration ships), strategy frame label, aggressiveness badge (when M36 ships), event impact overlays (when M35 integration ships).
3. **Levers panel** — the assumption set with per-lever evidence source, OperatorStance modulators applied, and `liftAggressiveness` decomposition (when M36 ships).

The overlay cross-references existing tabs rather than duplicating them — clicking any lever opens F9 Assumptions tab focused on that field; clicking Strategy Frame opens F5; clicking the path opens F9 Projections.

---

## 8. Agent Integration

| Agent | Role in journey | Reads | Writes |
|---|---|---|---|
| **research** | Composes journey into DealContext cache | All `DealContext` fields | `deal_context` (the cached Deal Capsule); `DealJourney` view computed at read time |
| **cashflow** | Goal-seeks within journey space; reasons about A → B levers | Journey `levers`, `aggressiveness` (M36), `path` | LayeredValue overrides on `levers.*` (agent layer); proposes assumption sets ranked by aggressiveness |
| **commentary** | Produces narrative around the journey | All journey slots | `market_commentary` outputs that reference journey vocabulary |
| **zoning** | Constrains feasible State B for development/redevelopment paths | `zoning` field + `developmentPaths` | `zoning_analysis` output |
| **supply** | Identifies headwinds against the path | `supply` field + `path.yearByYear[*].vacancyPct` | `supply_analysis` output |

---

## 9. Phasing

| Phase | What ships | Dependencies | Status |
|---|---|---|---|
| **0 — Spec** | This document committed; vocabulary anchored | None | DONE |
| **1 — Composed views** | `useDealJourney(dealContext)` selector + Journey overlay UI surface | LOCKED slots only | DONE (Task #711) |
| **2 — DQA-grounded State A** | `stateA.dataQualityFindings` from `data_quality_alerts` | DQA Phase 1 build | DONE (Task #711, DQA Phase 2 #707) |
| **3 — M36 Aggressiveness slot fills** | `aggressiveness.*` from M36 Phase A heuristic Σ; `paretoFrontier` from `run_joint_goal_seek` | M36 Phase A complete | PARTIAL — Pareto frontier + plausibility scoring shipped 2026-05-19 (F-jgs-1 postprocessor fallback); per-variable aggressiveness decomposition (`mahalanobisD`, `perVariableContribution`) still PENDING |
| **4 — M07 confidence bands** | `path.yearByYear[*].confidenceBand` from percentile output | M07 backend percentile wiring | PENDING |
| **5 — M35 event-adjusted path** | `path.eventAdjustedTrajectory` from M35 event impact computation | M35 Section 2.3 integration | PENDING |
| **6 — M38 calibration** | `calibration.*` from M38 Calibration Ledger | M38 Phase E build | PENDING |

---

## 10. Out of Scope

- **Replacing existing modules.** The framework consumes M07 / M08 / M09 / M11 / M14 / M25 / M35 / M36 / M37 / M38 outputs; it does not redesign any of them.
- **New persistent storage.** `DealJourney` is a derived view.
- **F-key tab changes.** F1-F11 remain. Journey is an overlay, not a new tab.
- **Agent runtime changes.** The framework is vocabulary, not infrastructure.
- **OperatorStance redesign.** OperatorStance is already the meta-layer; the framework positions it as the "how aggressive on the journey" knob.
- **Direct user-facing edit of `stateB`.** State B is computed from levers. Users edit levers; State B updates.
- **Backfilling journey data on existing deals.** Phase 1 computes journey at read time.

---

## 11. Open Questions

1. **State A `asOf` semantics.** Is State A always "at acquisition" (frozen at deal creation) or "current observed state" (recomputed as new data arrives)? Recommendation: current observed state.
2. **Per-lever evidence provenance — where stored?** `levers.perLeverEvidence` is derived at read time from existing `LayeredValueSource` data (Phase 1). Promote to persisted column only if performance requires.
3. **Score trajectory `scoreAtB`.** No current code projects JEDI Score forward. Phase 1 leaves this null; M25 extension is a separate ticket.
4. **Gap aggressiveness vs assumption aggressiveness.** `gap.liftAggressiveness` (per-metric) vs `aggressiveness.perVariableContribution` (per-lever). Complementary slices answering different questions.
5. **Multi-strategy journeys.** One `DealJourney` per `selectedDevelopmentPathId`. Switching paths recomputes the journey.
6. **Confidence threshold for surfacing.** When to render a `PENDING` slot's placeholder vs hide it entirely? UX decision; flagged for design review at Phase 2 build.

---

## 12. Implementation Contract

**Phase 1 output (Task #711):**

- `frontend/src/stores/dealJourney.types.ts` — the `DealJourney` interface
- `frontend/src/stores/dealJourney.selector.ts` — `useDealJourney(dealContext)` selector + `computeJourneyGap`
- `frontend/src/components/deal/DealJourneyOverlay.tsx` — Phase 1 UI surface
- `frontend/src/stores/__tests__/dealJourney.selector.test.ts` — unit tests
- `docs/architecture/deal-journey-framework.md` — this file

No backend changes in Phase 1. No new tables. No migration.
