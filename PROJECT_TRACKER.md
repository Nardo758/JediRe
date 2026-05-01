# JediRE Project Tracker — Complete

**Last Updated:** 2026-05-01

This tracker consolidates all active work streams. The platform has evolved from the original MVP plan (map + 3 agents) into a full real estate inference system with M36 Joint Distribution Engine, M37 Analog Engine, M38 Calibration Ledger, and the F9 Financial Engine.

---

## Architecture Overview

```
Data Ingestion ──→ F9 Financial Engine ──→ ProForma / IRR
    │                      │
    │                      ▼
    │            M36 Σ Engine (covariance + plausibility)
    │                      │
    │                      ▼
    │            M37 Analog Engine (cross-market transfer)
    │                      │
    │                      ▼
    │            M38 Calibration Ledger (backtesting)
    │
    └── M35 Events ──→ Channel Routing ──→ M07/M08/M09
```

---

## Active Work Streams

### Stream 1: F9 Financial Engine (Deployed)
The core deal financial model pipeline. Building, displaying, and editing proformas.

**Status: ✅ Deployed** — Post-merge fixes in progress

**Components:**
- backend: `financial-model-engine.service.ts`, `financials-composer.service.ts`
- frontend: `ProFormaTab.tsx`, `F9SummaryBar.tsx`, 10+ result tabs
- routes: `/financials`, `/financial-model/build`, `/renovation`

### Stream 2: M36 Macro-Anchored Mean (Deployed)
Macro-coherent mean vector μ for plausibility scoring. Phase A complete.

**Status: ✅ Phases A–B Complete** (Phases A=macro-anchored mean, B=proforma anchors)

**Implemented:**
- `macro-fetcher.ts` — 5 FRED/BLS series with DB cache and fallbacks
- `mu-composer.ts` — μ = w_emp·μ_emp + (1-w_emp)·μ_macro, divergence reweighting
- `sigma-mu-plausibility.ts` — dynamic plausibility with runtime μ
- `sigma.routes.ts` — 3 μ endpoints + 4 anchor endpoints
- `proforma-anchors.service.ts` — line-item anchor registry
- `anchor-interceptor.service.ts` — replaces flat rates with anchored values
- `AnchorLabel.tsx` — ℹ tooltips on expense fields
- `AnchorSensitivityInput.tsx` — inline override ⚡ per expense line
- `fetch_anchor_growth_rates.ts` — agent tool
- `fetch_county_tax_rules.ts` — agent tool for assessment methodology (B5)

### Stream 3: M36 Full Σ Engine (IN PROGRESS — Phase A)
The full covariance matrix, factor model, HMM regime classifier, goal-seeking optimizer.

**Status: 🔵 Phase A started** (heuristic Σ with hand-calibrated variables)

**To build:**
- 55-variable Σ construction (initial with heuristics → empirical)
- Mahalanobis distance computation
- SLSQP goal-seeking solver
- 4 debt bundles (HUD, Agency Fixed, Bridge Floating, CMBS) with bundle-Σ
- Cross-bundle ranking logic
- Capital stack co-movement detection ("double-up" exposure)

### Stream 4: M37 Cross-Market Analog Engine (Not Started)
Geographic transfer learning — similarity-weighted analog pooling for event-driven forecasts.

**Status: ⚪ Not started**

### Stream 5: M38 Calibration Ledger (Not Started)
Prediction journal, realization pairing, reliability diagrams, CI widening, drift detection.

**Status: ⚪ Not started**

### Stream 6: Causal Discipline — Channel Routing (Not Started)
Architectural invariants: single injection point per event, multiplicative cause/symptom scoring.

**Status: ⚪ Not started**

### Stream 7: Pipeline/Infrastructure (Ongoing)
Migration scripts, missing tables, import paths, build fixes.

**Status: 🔵 Ongoing** — Most critical items resolved

---

## M36 Full Σ Engine — Detailed Project Plan

The spec bundle defines the complete M36 Joint Distribution Engine. What follows is the implementation sequence that we can actually build.

### M36-A: Heuristic Σ (NOW — 4 sessions)

**A1. 55-variable inventory** — Define canonical variable IDs, units, empirical range, factor loadings
- Read existing M05/M06/M04/M07 metric names
- Map to unified Σ variable set
- Assign initial loadings to 6 factors (Rate, Employment, Migration, Asset Beta, Supply, Sentiment)
- Write as a config file: `sigma-variable-registry.ts`

**A2. Initial covariance + μ** — Hand-calibrated covariance matrix
- Same structure as empirical Σ but with heuristic correlations
- Per regime (expansion, late-cycle, contraction) with 3 matrices
- Initial μ from empirical market data + macro anchoring (we already have this)

**A3. Mahalanobis plausibility scorer** — `d²(x) = (x-μ)ᵀ Σ⁻¹(x-μ)`
- Precompute Σ⁻¹ per regime (invert once, cache)
- Per-variable decomposition: `contribution_i = (x_i - μ_i) · [Σ⁻¹(x - μ)]_i`
- Aggressiveness bands: d≤1.0 Realistic, 1.0-2.0 Stretch, 2.0-3.0 Aggressive, >3.0 Heroic

**A4. Goal-seeking solver** — SLSQP optimizer
- Constraint: proforma(x) = target IRR
- Box constraints: per-variable floors/ceilings
- Pareto frontier: sweep across aggressiveness budgets and target IRR values
- Multiprocess over debt bundles

**A5. Debt bundle registry** — Per-bundle μ and Σ_bundle
- HUD 221(d)(4): 83% LTV, 5.0%, 35yr, rate loading 0.0 (fixed)
- Agency Fixed (5yr IO): 75% LTV, 5.75%, rate loading 0.0
- Bridge Floating (3yr): 70% LTV, SOFR+375, rate loading 0.95
- Agency Floating: variable, rate loading 0.95
- CMBS (5yr Fixed): 75% LTV, 6.0%, rate loading 0.0
- Per bundle: F1 loading, refinance risk, rate-cap covariance

**A6. API endpoints**
- `POST /api/sigma/plausibility` — score an assumption set
- `POST /api/sigma/goal-seek` — solve for target IRR
- `GET /api/sigma/bundles` — list debt bundles with metadata
- `GET /api/sigma/factors` — current factor loadings
- `GET /api/sigma/regime/current` — current regime classification

**Deliverable:** Plausibility scoring + goal-seeking solver working end-to-end

### M36-B: Plausibility UI (2 sessions)

**B1. Plausibility badge on AssumptionsTab**
- d-value displayed next to assumption set: d=0.6 🟢, d=1.8 🟡, d=3.2 🔴
- Per-variable contribution breakdown as expandable section
- Color-coded aggressiveness band

**B2. Goal-seeking UI** — "Solve for IRR" flow
- Target IRR input (default: user's desired return)
- Lock variables toggle per assumption
- Bundle selector dropdown
- Results: Pareto frontier table across bundles
- Best bundle recommendation with rationale

**B3. Debt bundle config UI**
- Browse available debt products in sidebar
- Add custom bundle parameters
- See per-bundle IRR + plausibility impact before committing

### M36-C: Empirical Σ (5 sessions)
Once Phase A is working with heuristics, replace with data.

**C1. Historical data aggregation**
- Collect metric histories from DB, market reports, external APIs
- Align to monthly frequency
- Stationarity transforms (log diff, differencing)

**C2. Rolling-window Σ estimation**
- 7-year window, monthly refresh
- Ledoit-Wolf shrinkage
- Store as `covariance_matrices` table

**C3. Factor model fitting**
- PCA for factor extraction
- Regression for loadings
- 6 factors (from A1 definition but data-driven)

**C4. HMM regime classifier**
- 3 states: Expansion, Late-Cycle, Contraction
- Observables: yield curve, employment, transaction volume, cap rate direction
- Baum-Welch training from NBER cycle dating
- Per-regime Σ_r estimation

**C5. Spatial kernel**
- Drive-time decay residual covariance
- λ calibrated per asset class

### M36-D: Integration (3 sessions)

**D1. Wire Σ into M14 Risk Module**
- Replace hand-tuned correlations with Σ
- Factor variance attribution
- Tail risk from Σ-consistent IRR distribution

**D2. Wire Σ into M10 Scenario Engine**
- Bull/Base/Bear from Σ percentiles
- Factor decomposition per scenario
- Probability-weighted returns

**D3. Cashflow Agent prompt augmentation**
- Plausibility scoring awareness
- Goal-seeking flow integration
- Bundle reasoning
- Capital stack double-up detection
- Bias toward anchored μ for macro-linked metrics

---

## M37 Analog Engine Project Plan

### M37-A: Similarity Service (3 sessions)
**A1. Schema + migrations** — similarity cache, query log, bandwidth config
**A2. Similarity computation** — factor distance × regime match × event subtype
**A3. Analog ranking + weighting** — Kish effective sample size, t-distribution CIs

### M37-B: Forward Mode (2 sessions)
**B1. `POST /api/analogs/forecast/forward`** — event-driven forecast API
**B2. Cache layer + invalidation** on M35/M36 Kafka events

### M37-C: Backward + Counterfactual (2 sessions)
**C1. `POST /api/analogs/forecast/backward`** — market response profiles
**C2. `POST /api/analogs/forecast/counterfactual`** — hypothetical event trajectories

### M37-D: Agent Integration (3 sessions)
**D1.** Agent prompt: per-assumption M37 query
**D2.** Output shape: (point, CI, n_eff, analogs) instead of point estimates
**D3.** Fallback logic when n_eff < 3

---

## M38 Calibration Ledger Project Plan

### M38-A: Schema + Ingestion (2 sessions)
**A1.** `predictions`, `realizations`, `pairings`, `reliability_stats` tables
**A2.** Prediction emission API + SDK — every module emits on output

### M38-B: Realization Streams (2 sessions)
**B1.** M22 actuals → `realizations` pipeline (blocked by deal_monthly_actuals)
**B2.** External data (RentCast, FRED, BLS) → `realizations`

### M38-C: Pairing + Reliability (2 sessions)
**C1.** Nightly pairing batch
**C2.** Reliability diagrams per 5D stratum

### M38-D: Drift Detection (2 sessions)
**D1.** CI widening factors from reliability scores
**D2.** Rolling drift detection per stratum
**D3.** Kafka: `calibration.drift_alert`

### M38-E: Consumer Integration (3 sessions)
**E1.** Cashflow Agent CalibrationProfile fetch
**E2.** M14 CI multiplier application
**E3.** UI confidence badges
**E4.** Admin drift dashboard

---

## Dependency Graph

```
M36-A (Heuristic Σ) ──→ M36-B (Plausibility UI)
     │                      │
     │                      ▼
     │               Cashflow Agent prompt update
     │
     └───→ M36-C (Empirical Σ) ──→ M36-D (Integration)
                                      │
                                      ▼
                               M37-A (Similarity Service)
                                      │
                                      ▼
                               M37-B/C/D (Forward/Agent)
                                      │
                                      ▼
                               M38-A/B/C/D/E (Calibration)
```

**Critical path:** M36-A → M36-B → cashflow agent → M37-D → M38-E
Everything else runs in parallel to this backbone.

---

## Current Session State

**M36-A Heuristic Σ: ✅ Complete** (2 sessions)

All 6 sub-phases built and tested:
- ✅ A1: Sigma variable registry (48 variables, 6 factors, 3 blocks)
- ✅ A2: Heuristic covariance builder (per-regime matrices, factor model + shrinkage)
- ✅ A3: Mahalanobis plausibility scorer (per-variable decomposition, banding, warnings)
- ✅ A4: Goal-seeking solver (grid search, simplified DCF, cross-bundle ranking)
- ✅ A5: Debt bundle registry (5 products, F1 loadings, double-up detection)
- ✅ A6: REST API (6 endpoints)
- ✅ **28/28 tests passing** (18 sigma-full + 10 sigma-builder)

**M36-B Plausibility UI: ✅ Complete**
- ✅ sigmaApi.ts — frontend API client (types, 6 endpoints, band colors)
- ✅ PlausibilityBadge.tsx — colored badge (d value + band) with refresh
- ✅ PlausibilityPanel.tsx — overlay detail panel (per-variable breakdown, warnings, bundle assessment)
- ✅ ProFormaTab integration — auto-scoring (2s debounce), badge in 4 section headers

**Next: M36-C Goal-Seeking UI** — "Solve for IRR" flow, bundle selector, cross-bundle ranking

---

## Appendix: Relevant Files

### Backend — Σ Engine
- `backend/src/services/sigma/sigma-variable-registry.ts` — 48 variables, 6 factors, 3 blocks, feasible ranges
- `backend/src/services/sigma/heuristic-sigma-builder.ts` — Σ = B·Σ_F·Bᵀ + Ψ, per-regime matrices, Mahalanobis, Cholesky
- `backend/src/services/sigma/sigma-plausibility.service.ts` — scored plausibility with cache, per-variable decomposition, warnings
- `backend/src/services/sigma/sigma-goal-seeking.service.ts` — grid search solver, simplified DCF, cross-bundle Pareto
- `backend/src/services/sigma/debt-bundle-registry.ts` — 5 bundles, F1 loadings, double-up assessment
- `backend/src/services/sigma/macro-fetcher.ts` — 5 FRED/BLS series with cache/fallback
- `backend/src/services/sigma/mu-composer.ts` — macro-anchored μ with divergence reweighting
- `backend/src/services/sigma/sigma-mu-plausibility.ts` — runtime plausibility with composed μ
- `backend/src/services/sigma/sigma-apply-deal.ts` — deal-level Σ application
- `backend/src/services/sigma/sigma-engine.ts` — engine orchestrator
- `backend/src/services/sigma/proforma-anchors.service.ts` — line-item anchor registry
- `backend/src/services/sigma/anchor-interceptor.service.ts` — replaces flat rates with anchored values
- `backend/src/api/rest/sigma-full.routes.ts` — 6 new Σ engine endpoints (plausibility, goal-seek, bundles, factors, regime)
- `backend/src/api/rest/sigma.routes.ts` — original μ/anchor endpoints
- `backend/src/agents/tools/fetch_anchor_growth_rates.ts` — agent anchor tool
- `backend/src/agents/tools/fetch_county_tax_rules.ts` — agent county tax methodology tool
- `backend/src/services/financial-model-engine.service.ts` — anchor interceptor wired here
- `backend/tests/sigma/sigma-full.test.ts` — 18 tests (plausibility, scoring, warnings, bundles, factors)
- `backend/tests/sigma/heuristic-sigma-builder.test.ts` — 10 tests (registry, builder, Mahalanobis, bands)

### Backend — Tax
- `backend/src/services/tax/taxService.ts` — tax computation engine
- `backend/src/services/tax/rulesets/` — per-state tax rulesets (GA, FL, TX, CA, NY, IL, NC, LA, AZ)
- `backend/src/services/tax/types.ts` — TaxRuleset interface

### Frontend — Plausibility UI
- `frontend/src/api/sigmaApi.ts` — Σ API client (types, 6 endpoints, band colors)
- `frontend/src/components/F9/PlausibilityBadge.tsx` — colored inline badge (d + band), click opens panel
- `frontend/src/components/F9/PlausibilityPanel.tsx` — modal overlay (per-variable breakdown, warnings, bundle)
- `frontend/src/components/deal/sections/ProFormaTab.tsx` — main proforma editing tab (PlausibilityBadge in 4 section headers, auto-scoring)
- `frontend/src/components/F9/AnchorLabel.tsx` — ℹ anchor tooltip
- `frontend/src/components/F9/AnchorSensitivityInput.tsx` — per-expense override input
- `frontend/src/components/F9/SensitivityBar.tsx` — override progress bar
- `frontend/src/components/F9/F9SummaryBar.tsx` — F9 summary
- `frontend/src/hooks/useProformaAnchors.ts` — anchor tooltip hook

### DB
- `backend/src/db/migrations/` — active migration directory (sequential numbering)
- `backend/src/scripts/run-migrations.ts` — migration runner
- Tables: `macro_anchor_observations`, `proforma_line_item_anchors`, `supply_analyses`, `cashflow_projections`

### Documentation
- `M36_Macro_Anchored_Mean_Addendum.md` — macro-anchored μ spec
- `M36_PROFORMA_LINE_ITEM_ANCHORS.md` — line-item anchor spec
- `ROADMAP_M36_M38.md` — original phased roadmap
- `MVP_BUILD_PLAN.md` — original MVP plan (superseded)
