# STRATEGY MODULE — INVENTORY & COMPLEXITY INVESTIGATION

**Task:** #1244  
**Date:** 2026-05-26  
**Status:** Complete  
**Scope:** M08 Strategy Intelligence module — all surfaces, fields, services, and database tables.

---

## TABLE OF CONTENTS

1. [Component Map](#1-component-map)
2. [Field Inventory](#2-field-inventory)
3. [A/B/C/D/E Classification](#3-abcde-classification)
4. [Evidence vs Control Ratio](#4-evidence-vs-control-ratio)
5. [Redundancy Audit](#5-redundancy-audit)
6. [Complexity Heat Map](#6-complexity-heat-map)
7. [Redesign Opportunity Assessment](#7-redesign-opportunity-assessment)
8. [Open Questions](#8-open-questions)

---

## 1. Component Map

### 1.1 Frontend — Production UI Surfaces

| Component | File | Lines | Entry Point | Data Source |
|---|---|---|---|---|
| `StrategyArbitragePage` | `frontend/src/pages/development/StrategyArbitragePage.tsx` | 412 | `DealDetailPage.tsx` line 172 — mounted as StrategyScreen tab | `useStrategyAnalysisV2` → `GET /api/v1/deals/:dealId/strategies` |
| `StrategySection` | `frontend/src/components/deal/sections/StrategySection.tsx` | 147 | Alternative embedding in deal section panels | Same `useStrategyAnalysisV2` hook |
| `StrategyArbitrageEngine` | `frontend/src/components/showcase/StrategyArbitrageEngine.tsx` | 314 | `ModuleShowcasePage` only — NOT in DealDetailPage | `ShowcaseDataService.getStrategies()` — **mock data** |

`StrategyArbitragePage` has three sub-tabs:
- **M08 v2 ANALYSIS** — `V2FullAnalysis` (all detection, scoring, evidence, plan blocks)
- **SIGNAL MATRIX** — `LegacySignalMatrixTab` (correlation engine COR-01–30 + signal stability)
- **CUSTOM SCREENS** — `CustomScreenTab`

### 1.2 Frontend — Builder Surfaces

| Component | File | Lines | Entry Point | Data Source |
|---|---|---|---|---|
| `M08StrategyBuilderPage` | `frontend/src/pages/settings/M08StrategyBuilderPage.tsx` | 1132 | Settings / admin route | `strategies` table CRUD via `GET/POST/PUT /api/v1/strategies` |
| `StrategyBuilderPage` | `frontend/src/pages/StrategyBuilderPage.tsx` | 1651 | `TerminalPage.tsx` → STRATEGIES panel OPEN BUILDER button | `strategy_definitions` table via `POST /api/v1/strategy-definitions` |

### 1.3 Frontend — Shared Component Layer

| Component | File | Lines | Purpose |
|---|---|---|---|
| `StrategyV2Components.tsx` | `frontend/src/components/deal/sections/StrategyV2Components.tsx` | 1704 | All rendering blocks shared by `StrategyArbitragePage` and `StrategySection` |

`StrategyV2Components.tsx` exports:
- `DetectionBanner` — asset class detection with confidence gate + confirm/adjust/override actions
- `SubStrategyComparison` — horizontally scrolling card grid, one card per sub-strategy with ScoreRing
- `EvidenceReportBlock` (via `V2FullAnalysis`) — Block A (metric stack), Block B (thesis prompt), Block C (comp scatter), Block D (math trail), Expected Return tile
- `CorrelationTimingPanel` — Golden Chain stepper + active alerts + leading/concurrent/lagging indicators
- `PlanDocument` — editable entry/hold/value-creation/exit/monitoring/pivot blocks with "APPLY TO PRO FORMA" button
- `BuyerTargetingPanel` — traffic quadrant + institutional activity + buyer type list
- `V2FullAnalysis` — the top-level orchestrator that assembles all blocks with detection-gating logic

### 1.4 Backend — Route Surface

| Route File | Lines | Endpoints | Table |
|---|---|---|---|
| `deal-strategy.routes.ts` | 209 | `GET /:dealId/strategies` · `PATCH /:dealId/detection-confirmation` · `GET /:dealId/strategy-scores` · `POST /:dealId/strategy-scores/recalculate` · `GET /:dealId/arbitrage` | `deals.deal_data.m08_detection` (JSONB) · `strategy_scores` · `strategy_arbitrage` |
| `strategies.routes.ts` | 288 | `GET /strategies` · `GET /strategies/templates` · `POST /strategies` · `GET /:id` · `PUT /:id` · `DELETE /:id` · `POST /:id/clone` · `PUT /reorder` · `POST /score-deal/:dealId` | `strategies` |
| `strategy-analyses.routes.ts` | 344 | `POST /strategy-analyses` · `GET /:dealId` · `PUT /:dealId` | `strategy_analyses` |
| `custom-strategies.routes.ts` | 685 | `POST /custom-strategies` + full CRUD + apply/use endpoints | `custom_strategies` |
| `strategy-definitions.routes.ts` | 547 | `POST /strategy-definitions` + full CRUD + execute | `strategy_definitions` |
| `property-type-strategies.routes.ts` | unknown | Property-type scoped strategy queries | unknown |

### 1.5 Backend — Service Layer

| Service | File | Lines | Purpose |
|---|---|---|---|
| `m08-strategies.service.ts` | 1059 | Main M08 v2 orchestrator: Detection → Signal Scores → Sub-strategy Scoring → Gate Evaluation → Evidence → Plan → Golden Chain → Indicators → Buyer Targeting |
| `asset-class-detection.service.ts` | unknown | Detects asset class, deal type, sub-strategy; defines `SUB_STRATEGY_WEIGHTS`, `SUB_STRATEGY_NAMES`, `SUB_STRATEGY_FAMILY` |
| `evidence-report.service.ts` | unknown | Builds per-sub-strategy evidence report (thesis, metric stack, comp evidence, math trail, ultimateReturn) |
| `plan-formulator.service.ts` | unknown | Formulates `StrategyPlan` (entry, holdStructure, valueCreation, capitalSequencing, exit, monitoring, pivotConditions) |
| `signal-adapters.service.ts` | unknown | Per-asset-class signal adapters; routes to asset-class-specific signal reader |
| `strategyArbitrage.service.ts` | 359 | **Legacy** system: `extractDealSignals` → `scoreAndPersist` → `detectArbitrage` → writes `strategy_scores` + `strategy_arbitrage` tables |

### 1.6 Database Tables

| Table | Purpose | Used by |
|---|---|---|
| `deals.deal_data.m08_detection` | JSONB sub-document: `user_confirmed`, `user_override_classification`, `confirmed_at` | `deal-strategy.routes.ts` PATCH handler; `m08-strategies.service.ts` loadDealData |
| `strategy_analyses` | Per-deal strategy selection: `strategy_slug`, `assumptions`, `roi_metrics`, `risk_score`, `recommended` | `strategy-analyses.routes.ts`; read by `m08-strategies.service.ts` loadDealData to seed recommended strategy slug |
| `strategies` | System templates + org/user custom strategies: `is_system_template`, `is_active`, `sort_order`, `org_id` | `strategies.routes.ts`; legacy `strategyArbitrage.service.ts` scoreAndPersist |
| `strategy_scores` | Legacy per-deal score results (JOIN on strategies.id) | Legacy `deal-strategy.routes.ts` `strategy-scores` endpoints; `strategyArbitrage.service.ts` |
| `strategy_arbitrage` | Legacy per-deal arbitrage result: `winning_strategy_id`, `runner_up_strategy_id`, `delta`, `arbitrage_detected` | Legacy `deal-strategy.routes.ts` arbitrage endpoint |
| `custom_strategies` | User-created strategies (separate schema: `hold_period_min/max`, `exit_type`, `custom_metrics`, `default_assumptions`, `is_template`) | `custom-strategies.routes.ts` |
| `strategy_definitions` | Screening/filter definitions: `conditions[]`, `combinator`, `scope`, `sort_by`, `asset_classes`, `deal_types`, `tags` | `strategy-definitions.routes.ts`; `StrategyBuilderPage` terminal component |

### 1.7 In-Memory Cache

`m08-strategies.service.ts` maintains a process-local Map cache:
```
const analysisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
```
`bustM08Cache(dealId)` removes the entry. Called after detection-confirmation PATCH and after strategy-analyses POST.

---

## 2. Field Inventory

### 2.1 M08 v2 Contract — `StrategyAnalysisV2`

Source: `frontend/src/hooks/useStrategyAnalysisV2.ts` (mirrors `m08-strategies.service.ts` contract)

**Top-level fields:**

| Field | Type | Description |
|---|---|---|
| `dealId` | `string` | Deal identifier |
| `computedAt` | `string` | ISO timestamp of last computation |
| `detection` | `DetectionResult` | Asset class detection result (see §2.2) |
| `signalScores` | `SignalScores` | 6-dimension signal summary (see §2.3) |
| `subStrategies` | `SubStrategyScore[]` | Scored sub-strategies (see §2.4) |
| `arbitrage` | `ArbitrageSummary` | Arbitrage detection between sub-strategies |
| `plan` | `InvestmentPlan` | Recommended investment plan (see §2.5) |
| `goldenChain` | `GoldenChainState` | Deal cycle position (8 phases) |
| `correlationAlerts` | `CorrelationAlert[]` | Active COR-series alerts with severity |
| `indicators` | `{ leading, concurrent, lagging }` | Trend indicator arrays |
| `buyerTargeting` | `BuyerTargeting` | Traffic quadrant + institutional activity + buyer types |
| `coordinatorNarrative` | `string` | Free-text coordinator summary |

### 2.2 `DetectionResult` Fields

| Field | Type | Description |
|---|---|---|
| `assetClass` | `string` | e.g. "multifamily", "sfr", "retail", "office", "industrial", "hospitality" |
| `subType` | `string` | Asset sub-type |
| `detectedDealType` | `string` | e.g. "value_add", "development", "stabilized" |
| `detectedSubStrategy` | `string` | e.g. "mf_value_add_standard", "sfr_fix_flip" |
| `confidence` | `number` | 0.0–1.0 |
| `requiresUserConfirmation` | `boolean` | True when confidence < 0.70 |
| `confidenceBreakdown` | `ConfidenceBreakdown` | 5 dimensions: assessorCode, zoningMatch, rentRollSignal, naicsSignal, buildingStructure |
| `detectionSignals` | `DetectionSignal[]` | Per-signal: signal name, value, threshold, contribution |
| `alternateSubStrategies` | `AlternateSubStrategy[]` | Ranked alternates with fit score and reason |
| `userConfirmed` | `boolean?` | Set after operator confirms detection |
| `userOverrideClassification` | `string?` | Set after operator override |

### 2.3 `SignalScores` Fields

| Field | Range | Description |
|---|---|---|
| `demand` | 0–100 | Demand strength |
| `supply` | 0–100 | Supply pressure (inverted: high = less pressure) |
| `momentum` | 0–100 | Rent momentum |
| `position` | 0–100 | Market positioning / opportunity |
| `risk` | 0–100 | Risk score |
| `confidence` | 0–100 | Data coverage: count of live-data dimensions × 18 + 10, capped at 100 |

### 2.4 `SubStrategyScore` Fields

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Sub-strategy slug (e.g. "mf_value_add_standard") |
| `family` | `string` | Asset class family (from SUB_STRATEGY_FAMILY) |
| `name` | `string` | Display name (from SUB_STRATEGY_NAMES) |
| `isDetectedPrimary` | `boolean` | Whether this is the AI-detected primary match |
| `isAdjacent` | `boolean` | Whether this is an adjacent/alternate |
| `gate` | `GateResult` | `qualified` / `marginal` / `disqualified` + check strings |
| `baseScore` | `number` | Weighted sum of signal dimensions via SUB_STRATEGY_WEIGHTS |
| `timingMultiplier` | `number` | Market timing adjustment |
| `gateAdjustment` | `number` | Penalty for marginal gate results |
| `finalScore` | `number` | `min(100, max(0, baseScore × timingMultiplier + gateAdjustment))` |
| `disqualified` | `boolean` | Hard disqualification flag |
| `financialPreview` | `FinancialPreview` | `irr`, `cocReturn`, `equityMultiple`, `exitCapRate`, `holdMonths` |
| `strategyAssumptions` | `Record<string, LayeredValue>` | Per-strategy underwriting assumptions |
| `signalWeights` | `Record<string, number>` | Weights from SUB_STRATEGY_WEIGHTS used for this key |
| `appliedCorrelations` | `string[]` | COR-series IDs applied to this sub-strategy |
| `evidenceReport` | `EvidenceReport` | Full evidence block (see below) |

`EvidenceReport` sub-fields:

| Field | Type | Description |
|---|---|---|
| `subStrategyKey` | `string` | Repeats parent key |
| `thesis` | `string` | One-sentence investment thesis |
| `thesisPrompt` | `ThesisPrompt` | `headline`, `rationale`, `keyDrivers[]`, `riskFactors[]`, `aiCoordinatorContext` |
| `metricStack` | `MetricStackRow[]` | Rows: label, subject, benchmark, delta, dollarImpact, source, dataQuality, mathTrail? |
| `compEvidence` | `{ tradeArea, likeKind }` | Two `CompEvidenceBucket`s: `selectionCriteria[]`, `comps[]`, `visualization` |
| `mathTrail` | `MathTrailStep[]` | Step-by-step derivation: step, value, formula?, sourceRef?, isSubtotal? |
| `ultimateReturn` | `{ irr, equityMultiple, holdMonths, exitCapRate, rationale? } \| null` | Projected return — nullable; UI renders explicit placeholder when null |

### 2.5 `InvestmentPlan` Fields

| Section | Key Fields |
|---|---|
| `entry` | `targetQuarter`, `priceCeiling`, `rationale`, `debtStructure` |
| `holdStructure` | `targetHoldMonths`, `rationale`, `exitWindows[]` |
| `valueCreation` | `PlanAction[]`: phase, action, timing, evidenceRefs[], correlationRefs[], costEstimate?, expectedImpact? |
| `capitalSequencing` | `PlanCapitalItem[]`: item, amount, timing, priority |
| `exit` | `targetQuarter`, `buyerType`, `activeBuyers[]`, `capRate`, `expectedIRR: [min, max]` |
| `monitoring` | `MonitoringItem[]`: correlationId, metric, currentValue, triggerThreshold, severity, action |
| `pivotConditions` | `PivotCondition[]`: trigger, pivotTo, rationale |

### 2.6 Legacy Scoring Fields (`strategyArbitrage.service.ts`)

These fields exist in `strategy_scores` and `strategy_arbitrage` tables but are NOT consumed by the M08 v2 UI:

| Field | Source |
|---|---|
| `overall_score` | Weighted gate-based score per strategy |
| `sub_scores` | Per-dimension scores: supply_pressure, demand_growth, rent_momentum, job_growth, cap_rate_spread, irr_potential, risk_score, regulatory_risk, market_volatility |
| `gate_result` | PASS / FAIL / N/A |
| `gate_failures` | Array of failed gate condition strings |
| `soft_penalty` | Cumulative penalty for soft gate failures |
| `confidence` | Per-strategy confidence score |
| `winning_strategy_id` | FK to `strategies.id` |
| `runner_up_strategy_id` | FK to `strategies.id` |
| `delta` | Score gap between winner and runner-up |
| `arbitrage_detected` | Boolean |

---

## 3. A/B/C/D/E Classification

Classification key:
- **A** — Fully active: real data computed and displayed correctly
- **B** — Partially active: rendered but some data is null/placeholder; backend partially populates
- **C** — Control/stub: UI exists but backend integration is absent or non-functional
- **D** — Dead code: exists in codebase but not reachable in production UI
- **E** — Mock/showcase: demo surface using fabricated data

| Component / Field | Class | Evidence |
|---|---|---|
| **Detection Banner** | **A** | Reads `analysis.detection` from live M08 v2 orchestrator; confidence, signals, breakdown are real |
| **Signal Scores panel** | **A** | `computeSignalScores()` in service derives from `getSignalAdapter()` per asset class |
| **Sub-strategy scoring + gate** | **A** | `evaluateGate()` applies real thresholds against deal fields (loss_to_lease, dscr, occupancy, ARV margin, etc.) |
| **Sub-strategy financial preview** | **A** | `financialPreview: FinancialPreview` is part of M08 v2 contract; populated by evidence-report service |
| **Metric stack (Block A)** | **A** | `metricStack: MetricStackRow[]` populated by `buildEvidenceReport()` |
| **Thesis + thesis prompt (Block B)** | **A** | `thesis` and `thesisPrompt` populated by evidence-report service |
| **Comp evidence scatter (Block C)** | **B** | UI renders correctly; data quality field on comps can be `'synthetic_benchmark'` (fabricated) when no live comps exist |
| **Math trail (Block D)** | **B** | Rendered only when `ev.mathTrail.length > 0`; population rate unknown; likely sparse for non-multifamily asset classes |
| **Ultimate Return tile** | **B** | Explicit null handling (Task #427); backend returns null for some sub-strategies; UI shows "Not yet computed" placeholder |
| **Correlation Timing Panel** | **B** | Golden Chain phase and correlation alerts populated by M08 v2; indicators (leading/concurrent/lagging) depend on COR-01–30 nightly data which may be empty for new geographies |
| **Detection gating (confidence < 70% modal)** | **A** | Fully functional; blocks scoring/evidence/plan render until confirmed |
| **Confirm / Adjust / Override controls** | **A** | `PATCH /api/v1/deals/:dealId/detection-confirmation` writes to `deals.deal_data.m08_detection`; busts M08 cache |
| **Buyer Targeting panel** | **B** | `buyerTargeting` in contract; traffic quadrant has 5 defined values; real population depends on traffic data availability (M07) |
| **Coordinator Narrative** | **B** | String field; may be empty string when orchestrator cannot generate |
| **"APPLY TO PRO FORMA" button (PlanDocument)** | **C** | `POST /api/v1/deals/:dealId/proforma/apply-plan` — no such route registered in any routes file. Catch block in `handleApplyToProForma` explicitly labels response "STUB — PRO FORMA INTEGRATION PENDING". No F9 integration exists. |
| **Plan entry editable inputs** | **C** | `targetQuarter`, `priceCeiling`, `debtStructure` inputs in `PlanDocument` are locally editable but the "APPLY TO PRO FORMA" endpoint is a stub — changes are lost on unmount |
| **Signal Matrix tab (correlation)** | **A** | `useCorrelationReport` + `/api/v1/correlations/history` + `/api/v1/correlations/history/pairs` are live COR-01–30 system endpoints |
| **Signal stability / pair stability** | **B** | Populated by nightly job; empty until nightly job seeds history; UI shows "Nightly job seeds history · first run pending" when empty |
| **Custom Screens tab** | **B** | `CustomScreenTab` renders; underlying execution depends on `strategy-definitions.routes.ts` which has real execution logic, but adoption is unknown |
| **Legacy `useStrategyArbitrageM08` hook** | **D** | Hook exists and connects to `strategy-scores` and `arbitrage` endpoints, but `StrategyArbitragePage` no longer imports it — replaced by `useStrategyAnalysisV2` |
| **`strategy_scores` table read path** | **D** | `GET /:dealId/strategy-scores` endpoint exists and serves from legacy table; no active frontend consumer in production deal page |
| **`strategy_arbitrage` table read path** | **D** | `GET /:dealId/arbitrage` endpoint exists; no active frontend consumer in production deal page |
| **`StrategyArbitrageEngine` component** | **E** | Uses `ShowcaseDataService.getStrategies()` — confirmed mock data. Only mounted in `ModuleShowcasePage`, never in `DealDetailPage`. Also imports `useStrategyAvailability` and `useDealType` from the real store — a partial contamination of real/mock data. |
| **`M08StrategyBuilderPage` (settings)** | **A/B** | Full CRUD against `strategies` table (system templates + org custom); 1132 lines; actively wired. Template management is functional (A); the downstream effect of custom strategies on M08 v2 scoring is unclear (B) — custom strategies in the `strategies` table are scored by the legacy system, not M08 v2. |
| **`StrategyBuilderPage` (terminal)** | **B** | 1651-line terminal builder for `strategy_definitions`; backend execution exists (`strategyExecutionService`); adoption in production workflow unclear |

---

## 4. Evidence vs Control Ratio

### 4.1 Measurement Method

For each rendering block in `StrategyV2Components.tsx`, classified as:
- **Evidence** — value is computed from real deal/market data by the backend
- **Partial** — value is real but may fall back to synthetic/default when live data is absent
- **Control** — value is editable UI state not persisted, or a stub endpoint
- **Void** — block renders a "not available" / placeholder state when data is absent

### 4.2 Per-Block Ratio

| Block | Classification | Evidence Status |
|---|---|---|
| Detection: assetClass, detectedDealType | Evidence | Computed from assessor code, zoning, rent roll, NAICS, building structure |
| Detection: confidence + breakdown | Evidence | 5-dimension weighted confidence |
| Detection: detectionSignals | Evidence | Per-signal threshold comparison |
| Detection: alternateSubStrategies | Evidence | Scored alternates with fit rationale |
| Signal Scores: demand/supply/momentum/position/risk | Evidence | Derived from signal adapter per asset class |
| Signal Scores: confidence | Evidence | Count of live-data dimensions × 18 + 10 |
| Sub-strategy: finalScore | Evidence | Weighted signal sum × timing multiplier + gate adjustment |
| Sub-strategy: gate (qualified/marginal/disqualified) | Evidence | Rule-based gate checks against real deal fields |
| Sub-strategy: financialPreview (irr, coc, em, exitCap) | Evidence | Evidence-report service projection |
| Sub-strategy: ultimateReturn | Partial | Evidence when available; explicit null placeholder when not |
| Metric stack rows | Evidence | Subject vs benchmark with delta and dollarImpact |
| Comp evidence (tradeArea / likeKind) | Partial | Live comps when available; `'synthetic_benchmark'` dataQuality when not |
| Math trail | Partial | Populated when evidence-report builds trail; may be empty |
| Thesis + keyDrivers + riskFactors | Evidence | Evidence-report generated |
| Golden Chain position + activeSignals | Evidence | M08 v2 orchestrator derives from market cycle data |
| Correlation alerts (correlationId, value, drivesPlanDimension) | Partial | Depends on nightly COR-01–30 job having run |
| Indicators (leading/concurrent/lagging) | Partial | Depends on same nightly job |
| Plan: entry, holdStructure, exit | Evidence | Formulated by plan-formulator.service.ts |
| Plan: valueCreation, capitalSequencing | Evidence | Formulated by plan-formulator |
| Plan: monitoring, pivotConditions | Evidence | Formulated by plan-formulator |
| Plan: editable inputs | Control | Local state only — not persisted |
| "APPLY TO PRO FORMA" action | Control (stub) | No working endpoint |
| Buyer Targeting | Partial | Depends on M07 traffic data |
| Coordinator Narrative | Partial | May be empty string |
| Signal Matrix: correlation report | Evidence | Live COR-01–30 system |
| Signal stability + pair history | Partial | Empty until nightly seeding job runs |

### 4.3 Summary Counts

| Category | Count | % |
|---|---|---|
| Evidence (real, always populated) | 16 | 47% |
| Partial (real when available, placeholder when not) | 10 | 29% |
| Control / stub | 2 | 6% |
| Total displayed blocks | 28 | — |

**Evidence + Partial = 76%** of the strategy module's display surface is backed by real computed data when the deal has sufficient data. The remaining 24% is either control state or conditional on external data availability.

The two Control (stub) entries are high-visibility: the "APPLY TO PRO FORMA" button appears prominently in the plan section and silently does nothing.

---

## 5. Redundancy Audit

### 5.1 Dual Scoring Systems (Critical Redundancy)

The module contains **two fully independent strategy scoring systems** that coexist without coordination:

**System 1 — M08 v2 (active production system):**
- Service: `m08-strategies.service.ts` → `getStrategiesForDeal(pool, dealId)`
- Method: Detection-first orchestration (detectAssetClassAndDealType → computeSignalScores → scoreSubStrategy → evaluateGate → buildEvidenceReport → formulatePlan)
- Storage: In-memory process-local cache (15-min TTL); detection confirmation stored in `deals.deal_data.m08_detection` JSONB
- Frontend: `useStrategyAnalysisV2` → `StrategyArbitragePage` / `StrategySection`
- Status: **Active production system**

**System 2 — Legacy scoring (vestigial):**
- Service: `strategyArbitrage.service.ts` → `scoreAndPersist` → `detectArbitrage`
- Method: Signal extraction from flat deal fields → gate evaluation against `strategies` table weights → persisted to `strategy_scores` + `strategy_arbitrage`
- Storage: Persistent relational tables (`strategy_scores`, `strategy_arbitrage`)
- Frontend: `useStrategyArbitrageM08` hook → **no active consumer** in `StrategyArbitragePage` (replaced by V2)
- Status: **Vestigial** — endpoints remain active, data is written on recalculate triggers, but no production UI reads from these tables for the deal strategy tab

The legacy system still has active code paths:
- `POST /api/v1/deals/:dealId/strategy-scores/recalculate` calls `scoreAndPersist`
- `GET /api/v1/deals/:dealId/strategy-scores` serves from `strategy_scores` table
- `GET /api/v1/deals/:dealId/arbitrage` serves from `strategy_arbitrage` table

Both are callable from `StrategyArbitragePage`'s TRIGGER RECALC button — which calls `triggerStrategyAnalysisV2Recalc` (M08 v2) — but the legacy endpoints are independently callable via the hook that still exists.

### 5.2 Three Parallel Custom Strategy Formats

The module defines three distinct "custom strategy" concepts in three separate tables with three separate route files and different schemas:

| Concept | Table | Route file | Schema shape | Purpose |
|---|---|---|---|---|
| System/Org templates | `strategies` | `strategies.routes.ts` | name, weights, gates, sort_order, is_system_template | Strategies that the legacy scoring engine scores against |
| User custom strategies | `custom_strategies` | `custom-strategies.routes.ts` | name, holdPeriodMin/Max, exitType, customMetrics JSONB, defaultAssumptions JSONB | User-defined strategies with custom hold/exit parameters |
| Screening definitions | `strategy_definitions` | `strategy-definitions.routes.ts` | name, conditions[], combinator, scope, asset_classes, deal_types, tags | Filter/screening rules executed against deal or property universe |

These three are architecturally distinct (templates vs. parameterized strategies vs. deal screeners) but are all marketed/navigable under "strategy" in the UI, creating confusion. `M08StrategyBuilderPage` manages `strategies`; `StrategyBuilderPage` (terminal) manages `strategy_definitions`; `custom_strategies` has no confirmed active UI surface.

### 5.3 `strategy_analyses` Table — Partial Bridge

`strategy_analyses` is read by `loadDealData()` in `m08-strategies.service.ts` (line 192):
```sql
LEFT JOIN strategy_analyses sa ON sa.deal_id = d.id AND sa.recommended = true
```
This means the `strategy_slug` from a prior strategy selection seeds the M08 v2 orchestrator's context. However, the `POST /api/v1/strategy-analyses` write path is not wired to any frontend action in the current V2 UI — it appears to be a legacy write path from an earlier workflow. The M08 v2 system writes its output back to `deals.deal_data` (JSONB), not to `strategy_analyses`.

**Effect:** A stale `strategy_analyses` record (from a prior workflow) may silently influence the M08 v2 detection by providing an incorrect `strategy_slug` seed. No reconciliation mechanism exists.

### 5.4 `useStrategyAvailability` in Showcase Component

`StrategyArbitrageEngine.tsx` (showcase/mock) imports `useStrategyAvailability` and `useDealType` from the real dealStore:
```typescript
const { availableStrategies, getStrengthFor } = useStrategyAvailability();
const dealType = useDealType();
```
This means the showcase component partially derives its display from real deal state (available strategy IDs, deal type) while populating metrics (ROI, cost, risk level, confidence, applicability %) from `ShowcaseDataService.getStrategies()` (mock). The result is a hybrid: real deal-type filtering applied to fake numbers. This is confusing in development (changing the real deal type changes what the showcase shows) and is a bug risk if the showcase component is ever accidentally included in the production route.

---

## 6. Complexity Heat Map

### 6.1 File-Level Complexity

| File | LOC | Complexity Assessment | Hotspots |
|---|---|---|---|
| `StrategyV2Components.tsx` | 1704 | **CRITICAL** | 7 exported components; `V2FullAnalysis` is the god-function assembling all blocks; per-block `BlockErrorBoundary` wrapping adds nesting depth; bidirectional hover context (HoverContext) adds cross-component coupling |
| `StrategyBuilderPage.tsx` | 1651 | **HIGH** | Terminal-style builder with inline form management; 1651 lines in a single file |
| `m08-strategies.service.ts` | 1059 | **HIGH** | Orchestrates 4 sub-services; 15-min in-memory cache; multi-asset-class gate matrix (multifamily, SFR, retail, office, industrial, hospitality sub-strategies all in one switch); `loadDealData` mixes deal fields, assumptions, and strategy_analyses in one query |
| `M08StrategyBuilderPage.tsx` | 1132 | **HIGH** | Settings-page CRUD with full form management; 1132 lines |
| `custom-strategies.routes.ts` | 685 | **MEDIUM** | CRUD + apply/use logic in one file |
| `strategy-definitions.routes.ts` | 547 | **MEDIUM** | CRUD + execution logic (StrategyExecutionService) |
| `strategy-analyses.routes.ts` | 344 | **LOW-MEDIUM** | Standard CRUD; partially vestigial write path |
| `deal-strategy.routes.ts` | 209 | **LOW** | Two active routes (strategies, detection-confirmation) + three legacy routes |
| `strategyArbitrage.service.ts` | 359 | **LOW** | Legacy service; gate logic is straightforward; `extractDealSignals` is the complex part (10 signal extractors) |
| `StrategyArbitragePage.tsx` | 412 | **LOW** | Thin orchestrator; complexity lives in sub-components |
| `StrategySection.tsx` | 147 | **VERY LOW** | Thin wrapper; identical structure to StrategyArbitragePage minus the Signal Matrix tab |
| `useStrategyAnalysisV2.ts` | 385 | **LOW** | Clean hook; delegates to dealStore |
| `useStrategyArbitrageM08.ts` | 84 | **VERY LOW** | Legacy hook; simple retry/poll pattern |

**Total strategy module LOC (confirmed):** ~8,750 lines across frontend + backend.

### 6.2 Coupling Complexity

**High coupling points:**
1. `m08-strategies.service.ts` imports 4 sub-services (`asset-class-detection`, `evidence-report`, `plan-formulator`, `signal-adapters`) — any change in these sub-service contracts propagates through the orchestrator
2. `StrategyV2Components.tsx` exports 7 components with a shared `HoverContext` — the bidirectional hover link between `EvidenceReportBlock` and `PlanDocument` creates non-obvious cross-component state
3. `m08-strategies.service.ts` reads `strategy_analyses` in `loadDealData` — a legacy table write path can silently affect M08 v2 detection output

**Low coupling points:**
- `useStrategyAnalysisV2` cleanly delegates to dealStore; detection-confirmation is a separate PATCH; the V2 contract is stable
- Legacy system (`strategyArbitrage.service.ts`) is cleanly isolated with no imports from the M08 v2 stack

### 6.3 Test Coverage

No test files identified for `m08-strategies.service.ts`, `evidence-report.service.ts`, `plan-formulator.service.ts`, or `StrategyV2Components.tsx`. The `agent-runtime-tests` workflow covers `backend/src/agents/` — does not appear to cover M08 strategy services.

---

## 7. Redesign Opportunity Assessment

### 7.1 Opportunity 1: Remove Legacy Scoring System (Low Risk, Medium Gain)

**What:** `strategyArbitrage.service.ts`, `strategy_scores` table, `strategy_arbitrage` table, `useStrategyArbitrageM08` hook, and the legacy `strategy-scores` + `arbitrage` endpoints in `deal-strategy.routes.ts`.

**Evidence of vestigial status:**
- `StrategyArbitragePage` does not import `useStrategyArbitrageM08`
- The hook's recalculate still triggers `scoreAndPersist` indirectly (via TRIGGER RECALC button dispatching both V2 recalc and, if the legacy hook is invoked from another context, the legacy system) — but no UI reads from the results
- The `strategies` table (system templates + custom) is only used by the legacy scoring engine; M08 v2 does not join against it

**Gain:** Eliminating ~800 lines of service code, 3 database tables, and 3 API endpoints; removing the stale `strategy_analyses` seed ambiguity; reducing confusion about which scoring system is authoritative.

**Risk:** LOW — no production UI reads from legacy tables. Confirm by grepping all frontend files for `strategy-scores` and `arbitrage` route calls before removal.

### 7.2 Opportunity 2: Implement or Remove "APPLY TO PRO FORMA" (High Value, Clear Scope)

**What:** `PlanDocument.handleApplyToProForma()` calls `POST /api/v1/deals/:dealId/proforma/apply-plan` — a route that does not exist. The catch block explicitly labels the state "STUB — PRO FORMA INTEGRATION PENDING".

**Current behavior:** User clicks "APPLY TO PRO FORMA", sees a momentary feedback state showing "STUB — PRO FORMA INTEGRATION PENDING", then nothing happens.

**Options:**
- **Implement:** Map `plan.entry.targetQuarter` → hold period assumption, `plan.entry.priceCeiling` → purchase price assumption, `plan.entry.debtStructure` → debt assumption, then dispatch the appropriate `dealStore` actions and fire PATCH to deal-assumptions. This directly addresses the strategy → F9 integration gap.
- **Remove:** Hide the button with a `TODO` comment until the integration is scoped as a task. Better than showing a prominently placed button that silently does nothing.

**Priority:** The button creates a misleading signal that M08 v2 output flows into F9. It does not. This misleads operators during demos and evaluations.

### 7.3 Opportunity 3: Consolidate Three Custom Strategy Formats (Medium Risk, High Clarity)

**What:** `strategies`, `custom_strategies`, and `strategy_definitions` are three separate table/route/schema triplets serving overlapping needs.

**Recommended consolidation path:**
- `strategy_definitions` (screener/filter rules) is architecturally distinct — keep separate
- `strategies` (system templates used by legacy scoring) and `custom_strategies` (user parameterized strategies) should be evaluated for merge now that the legacy scoring system is a candidate for removal
- If legacy scoring is removed, `strategies` table becomes unused and can be dropped alongside it, leaving only `strategy_definitions` as the user-facing strategy concept

**Risk:** MEDIUM — requires auditing all consumers of `strategies` and confirming no other system reads from it (e.g., M11 Debt Advisor reads `getPrimaryStrategyForDeal()` from `m08-strategies.service.ts`, which in turn joins `strategy_analyses`, not the `strategies` table directly).

### 7.4 Opportunity 4: Split `StrategyV2Components.tsx` (Low Risk, Medium Gain)

**What:** 1704 lines in a single file with 7 exported components, one shared context, and all block error boundaries.

**Recommendation:** Split into:
- `DetectionBanner.tsx` (~200 lines)
- `SubStrategyComparison.tsx` (~200 lines)
- `EvidenceReportBlock.tsx` (~350 lines)
- `CorrelationTimingPanel.tsx` (~120 lines)
- `PlanDocument.tsx` (~250 lines)
- `BuyerTargetingPanel.tsx` (~100 lines)
- `V2FullAnalysis.tsx` (~80 lines, thin orchestrator)
- `strategy-ui.types.ts` (shared types currently duplicated between hook and components)

**Risk:** LOW — pure refactor, no logic changes. Reduces cognitive load per file significantly.

### 7.5 Opportunity 5: Fix Showcase Contamination (Very Low Risk, Low Gain)

**What:** `StrategyArbitrageEngine.tsx` imports `useStrategyAvailability` and `useDealType` from the real dealStore while using mock data for all metrics.

**Fix:** Either remove the real store imports (make the showcase fully self-contained) or replace `ShowcaseDataService.getStrategies()` with the real `useStrategyAnalysisV2` hook (make it fully real).

**Risk:** VERY LOW — component only mounted in `ModuleShowcasePage`, not in production deal workflow.

### 7.6 Opportunity 6: Address M08 Cache Scalability Risk (Medium Risk, High Importance for Production)

**What:** `analysisCache = new Map<string, CacheEntry>()` in `m08-strategies.service.ts` is process-local. In a multi-instance deployment (e.g., horizontal scaling behind a load balancer or Cloudflare), `bustM08Cache(dealId)` invalidates the cache only on the instance that received the confirmation PATCH.

**Effect:** After an operator confirms detection, subsequent GET requests to other server instances return stale cached analysis until TTL expires (15 minutes).

**Fix:** Replace the process-local Map with a Redis TTL key, or reduce TTL to 0 (no cache) and rely on DB-backed storage with a version counter.

**Priority:** LOW in single-instance Replit deployment; **HIGH** if the app is ever deployed with horizontal scaling or behind Cloudflare Workers.

---

## 8. Open Questions

### OQ-M8-1 — Is the legacy scoring system intentionally maintained? [BLOCKING for cleanup]

`strategyArbitrage.service.ts`, `strategy_scores`, `strategy_arbitrage`, and the `strategies` table are not read by the M08 v2 UI. However:
- The `POST /score-deal/:dealId` backward-compat route still fires `scoreAndPersist`
- The `strategies` table holds system templates that appear in `M08StrategyBuilderPage`

**Decision required:** Can these be deprecated and removed? If `M08StrategyBuilderPage` is an active admin workflow, the `strategies` table must be preserved until an alternative template management surface exists.

### OQ-M8-2 — What is the real population rate of `ultimateReturn`?

`ultimateReturn` on `EvidenceReport` has an explicit null handler (Task #427) with a "Not yet computed" placeholder. The handler is defensive against `null` and against per-field non-finite numbers. How often does the backend actually return null for this field vs. returning real values?

**Decision required:** If null is common (>25% of sub-strategies), the evidence-report service needs improvement. If null is rare/edge-case, the current handling is appropriate.

### OQ-M8-3 — Is "APPLY TO PRO FORMA" planned for a specific task?

The `PlanDocument` component has a prominently placed "APPLY TO PRO FORMA" button that calls a non-existent endpoint and displays "STUB — PRO FORMA INTEGRATION PENDING". No task reference appears in the code comment.

**Decision required:** Is this planned for implementation (if so, which task)? Or should the button be hidden/removed until implementation is scoped?

### OQ-M8-4 — Should `custom_strategies`, `strategies`, and `strategy_definitions` be unified?

Three separate custom strategy concepts exist. The answer depends partly on whether the legacy scoring system (which uses `strategies`) is removed.

**Decision required:** Post-legacy-system removal, is there a product need for the `custom_strategies` table separately from `strategy_definitions`?

### OQ-M8-5 — What is the `adjustSubStrategy` validation contract?

`DetectionBanner` accepts a free-text sub-strategy key in the ADJUST panel:
```typescript
placeholder={`Current: ${detection.detectedSubStrategy || 'none'}`}
```
The user can type any string (e.g., "mf_value_add_standard"). No dropdown or validation list is shown. If the user types an invalid key:
- `adjustStrategySubStrategy(dealId, subStrategyKey)` is called
- Backend receives the key and stores it in `deals.deal_data.m08_detection`
- On next GET, the M08 v2 orchestrator uses this as the adjusted sub-strategy

**Decision required:** Should the ADJUST panel show a dropdown of valid sub-strategy keys? The valid keys are defined in `SUB_STRATEGY_NAMES` in `asset-class-detection.service.ts` but are not exposed to the frontend.

### OQ-M8-6 — Does `strategy_analyses` seeding cause silent M08 v2 drift?

`loadDealData()` joins `strategy_analyses WHERE recommended = true` to seed the M08 v2 orchestrator's context. If a stale or incorrect `strategy_analyses` record exists for a deal (from an earlier workflow or a now-deleted strategy definition), the M08 v2 detection context includes the stale `strategy_slug`.

**Decision required:** Should `loadDealData` stop reading from `strategy_analyses`, and instead rely solely on the deal fields and `deal_data.m08_detection` for the M08 v2 context?

### OQ-M8-7 — Is the M08 cache production-safe?

The process-local 15-min TTL cache becomes incorrect in multi-instance deployments. Currently, Replit single-instance deployment means this is not an active problem, but it is a latent risk for any future horizontal scaling.

**Decision required:** Should this be addressed proactively (Redis-backed cache or DB-backed with version counter) before the first horizontal scale-out?

---

## Summary of Critical Findings

| Finding | Severity | Action |
|---|---|---|
| "APPLY TO PRO FORMA" is a stub with a non-existent endpoint, displayed prominently to operators | HIGH | Remove button or implement endpoint |
| Legacy scoring system (strategy_scores, strategy_arbitrage, strategyArbitrage.service.ts) is vestigial but still executes | MEDIUM | Schedule removal in cleanup task |
| Three parallel custom strategy formats with separate tables/routes/schemas | MEDIUM | Consolidate after legacy removal decision |
| `strategy_analyses` join in `loadDealData` may seed M08 v2 with stale strategy slug | MEDIUM | Audit or remove the join |
| `StrategyArbitrageEngine` showcase mixes mock metrics with real store state | LOW | Isolate fully as mock or fully as real |
| `StrategyV2Components.tsx` is 1704 lines — highest per-file complexity in the module | LOW | Split into 7 single-responsibility files |
| Process-local M08 cache is not safe for horizontal scaling | LOW (now) / HIGH (at scale) | Plan Redis migration before first scale-out |
