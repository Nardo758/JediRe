# JediRE Project Tracker â€” Complete

**Last Updated:** 2026-05-21

This tracker consolidates all active work streams. The platform has evolved from the original MVP plan (map + 3 agents) into a full real estate inference system with M36 Joint Distribution Engine, M37 Analog Engine, M38 Calibration Ledger, and the F9 Financial Engine.

---

## Architecture Overview

```
Data Ingestion â”€â”€â†’ F9 Financial Engine â”€â”€â†’ ProForma / IRR
    â”‚                      â”‚
    â”‚                      â–¼
    â”‚            M36 Î£ Engine (covariance + plausibility)
    â”‚                      â”‚
    â”‚                      â–¼
    â”‚            M37 Analog Engine (cross-market transfer)
    â”‚                      â”‚
    â”‚                      â–¼
    â”‚            M38 Calibration Ledger (backtesting)
    â”‚
    â””â”€â”€ M35 Events â”€â”€â†’ Channel Routing â”€â”€â†’ M07/M08/M09
```

---

## Active Work Streams

### Stream 9: Affiliate Partnership Research (Brainstorm)
Just starting — no commitments yet. Exploring fashion affiliate programs for potential future products:

**Major fashion retailers with affiliate programs:**
| Retailer | Commission | Entry |
|---|---|---|
| **Lyst** | 5–10% | Shopify app / partner network |
| **SSENSE** | 6–7% | affiliates@ssense.com or Sovrn/Skimlinks/AdmitAd |
| **Farfetch** | From 6% | Affiliate networks |
| **Net-a-Porter** | Up to 6% | Skimlinks |
| **Nordstrom** | 2–11% | Affiliate networks |
| **ASOS** | 5–7% | Affiliate networks |
| **Everlane** | 5–10% | Affiliate networks |
| **Reformation** | 5–8% | Affiliate networks |

**Aggregator networks** (most retailers join these):
- Skimlinks, Sovrn, ShareASale, RewardStyle/LTK

**Next steps:**
- [ ] Identify which product/audience this would serve
- [ ] Research application process for specific retailers
- [ ] Evaluate commission structures vs. effort

### Stream 10: M09 Pro Forma — Stabilized Potential Engine (Spec Complete)
Spec committed: `docs/architecture/M09_PROFORMA_SPEC.md`

The Pro Forma shifts from a "shorter Projections" to the **Stabilized Potential** — one stabilized year as the destination, with a Current → Stabilized bridge decomposing into Δ_market + Δ_platform + Δ_operator + Δ_capex.

**Key changes from old framing:**
- 4-column layout (Current | Pro Forma | Δ | Driver) replaces prior view
- Stabilized year = computed per-model-type (not fixed offset), reads from Lease Velocity Engine
- Bridge decomposition = 4 component breakdown per line, must sum to Δ within $1
- Every cell carries LayeredValue source badge + alert level
- Conflict surfacing when operator override exceeds platform expectation × 1.5×
- M25 JEDI Score refactored to 5 bridge-plausibility sub-scores

**Build order:**
| Session | Scope | Dependencies |
|---|---|---|
| 9.1 | Layout reframe — 4 columns with mock bridge data | None |
| 9.2 | Stabilized year resolution rule | Lease Velocity Engine V1 shipped |
| 9.3 | Bridge decomposition rendering (hover-to-expand) | Lease Velocity Engine outputs → M09 |
| 9.4 | LayeredValue source badge + alert level | LayeredValue live ✓ |
| 9.5 | Per-model-type variant routing | M02 + M03 reachable from M09 |
| 9.6 | Conflict surfacing | None |
| 9.7 | 4-strategy side-by-side | M08 v2 backend |
| 9.8 | Live Actuals column | deal_monthly_actuals table |

**Downstream rewrites:** jedi-framework-v31.jsx proFormaVsProjections (delete), Deal Capsule alerts, investor deck v2, CLAUDE.md, FEATURE_EXPANSION.md

### Stream 1: F9 Financial Engine (Deployed)
The core deal financial model pipeline. Building, displaying, and editing proformas.

**Status: âœ… Deployed** â€” Post-merge fixes in progress

**Components:**
- backend: `financial-model-engine.service.ts`, `financials-composer.service.ts`
- frontend: `ProFormaTab.tsx`, `F9SummaryBar.tsx`, 10+ result tabs
- routes: `/financials`, `/financial-model/build`, `/renovation`

### Stream 2: M36 Macro-Anchored Mean (Deployed)
Macro-coherent mean vector Î¼ for plausibility scoring. Phase A complete.

**Status: âœ… Phases Aâ€“B Complete** (Phases A=macro-anchored mean, B=proforma anchors)

**Implemented:**
- `macro-fetcher.ts` â€” 5 FRED/BLS series with DB cache and fallbacks
- `mu-composer.ts` â€” Î¼ = w_empÂ·Î¼_emp + (1-w_emp)Â·Î¼_macro, divergence reweighting
- `sigma-mu-plausibility.ts` â€” dynamic plausibility with runtime Î¼
- `sigma.routes.ts` â€” 3 Î¼ endpoints + 4 anchor endpoints
- `proforma-anchors.service.ts` â€” line-item anchor registry
- `anchor-interceptor.service.ts` â€” replaces flat rates with anchored values
- `AnchorLabel.tsx` â€” â„¹ tooltips on expense fields
- `AnchorSensitivityInput.tsx` â€” inline override âš¡ per expense line
- `fetch_anchor_growth_rates.ts` â€” agent tool
- `fetch_county_tax_rules.ts` â€” agent tool for assessment methodology (B5)

### Stream 3: M36 Full Î£ Engine (IN PROGRESS â€” Phase A)
The full covariance matrix, factor model, HMM regime classifier, goal-seeking optimizer.

**Status: ðŸ”µ Phase A started** (heuristic Î£ with hand-calibrated variables)

**To build:**
- 55-variable Î£ construction (initial with heuristics â†’ empirical)
- Mahalanobis distance computation
- SLSQP goal-seeking solver
- 4 debt bundles (HUD, Agency Fixed, Bridge Floating, CMBS) with bundle-Î£
- Cross-bundle ranking logic
- Capital stack co-movement detection ("double-up" exposure)

### Stream 4: M37 Cross-Market Analog Engine (Not Started)
Geographic transfer learning â€” similarity-weighted analog pooling for event-driven forecasts.

**Status: âšª Not started**

### Stream 5: M38 Calibration Ledger (Not Started)
Prediction journal, realization pairing, reliability diagrams, CI widening, drift detection.

**Status: âšª Not started**

### Stream 6: Causal Discipline â€” Channel Routing (Not Started)
Architectural invariants: single injection point per event, multiplicative cause/symptom scoring.

**Status: âšª Not started**

### Stream 7: Pipeline/Infrastructure (Ongoing)
Migration scripts, missing tables, import paths, build fixes.

**Status: ✅ Complete** — Most critical items resolved

#### Archive Seeding (Completed 2026-05-21)

**Bulk document parsing:**
- 296 property folders processed via `archive-bulk-ingest.ts`
- 1,034 corpus rows uploaded to DB (648 rent rolls, 329 T12s, 30 concession burnoffs, 24 BoxScores, 3 other income)
- 296 MSA enrichment records uploaded
- HTTP mode (`--http`) used throughout — bypasses unreachable `helium` hostname from Windows

**OM PDF year-built extraction:**
- 42 OM PDFs found across all property folders
- 41 extracted with yearBuilt via DeepSeek and written to DB
- 1 null (Parkview Greer — new development)
- Bug fixed: `archive.routes.ts:789` was calling `parseOM(buffer, filename)` with no `ctx` arg, routing all requests to Anthropic (depleted credits) instead of DeepSeek
- Documents: `docs/operations/OM_INGEST_FINAL.md`, `docs/operations/SEEDING_SESSION3_CLOSING.md`

**Pilot validation:**
- 15 pilot properties confirmed recognized by ingest endpoint

---
### Stream 8: Self-Hosted DocuSeal eSignature (Planned)

Replace DocuSign with self-hosted DocuSeal (AGPL-3.0).
- Clone: `https://github.com/docusealco/docuseal.git` (12k+ stars, 5yr track record)
- Audit: clean - zero telemetry, zero outbound HTTP in app code, no analytics/tracking
- Stack: Ruby on Rails 8 / Vue.js / PostgreSQL / Docker Compose
- Deployment: on JediRE infrastructure (same server or dedicated VPS)
- Integration: use `docuseal-react` (MIT) + `docuseal-js` (MIT) for embedding in deal workflow
- No per-envelope fees, no data leaves the deployment
- Risk: AGPL requires publishing modifications if deployed publicly

**Next steps:**
- [ ] Pin a release tag (v1.9.2 or latest stable)
- [ ] Deploy via Docker Compose with PostgreSQL
- [ ] Explore REST API surface for template creation + envelope sending
- [ ] Wire eSignature into F9 deal workflow (LOI, lease, NDA signing)



## M36 Full Î£ Engine â€” Detailed Project Plan

The spec bundle defines the complete M36 Joint Distribution Engine. What follows is the implementation sequence that we can actually build.

### M36-A: Heuristic Î£ (NOW â€” 4 sessions)

**A1. 55-variable inventory** â€” Define canonical variable IDs, units, empirical range, factor loadings
- Read existing M05/M06/M04/M07 metric names
- Map to unified Î£ variable set
- Assign initial loadings to 6 factors (Rate, Employment, Migration, Asset Beta, Supply, Sentiment)
- Write as a config file: `sigma-variable-registry.ts`

**A2. Initial covariance + Î¼** â€” Hand-calibrated covariance matrix
- Same structure as empirical Î£ but with heuristic correlations
- Per regime (expansion, late-cycle, contraction) with 3 matrices
- Initial Î¼ from empirical market data + macro anchoring (we already have this)

**A3. Mahalanobis plausibility scorer** â€” `dÂ²(x) = (x-Î¼)áµ€ Î£â»Â¹(x-Î¼)`
- Precompute Î£â»Â¹ per regime (invert once, cache)
- Per-variable decomposition: `contribution_i = (x_i - Î¼_i) Â· [Î£â»Â¹(x - Î¼)]_i`
- Aggressiveness bands: dâ‰¤1.0 Realistic, 1.0-2.0 Stretch, 2.0-3.0 Aggressive, >3.0 Heroic

**A4. Goal-seeking solver** â€” SLSQP optimizer
- Constraint: proforma(x) = target IRR
- Box constraints: per-variable floors/ceilings
- Pareto frontier: sweep across aggressiveness budgets and target IRR values
- Multiprocess over debt bundles

**A5. Debt bundle registry** â€” Per-bundle Î¼ and Î£_bundle
- HUD 221(d)(4): 83% LTV, 5.0%, 35yr, rate loading 0.0 (fixed)
- Agency Fixed (5yr IO): 75% LTV, 5.75%, rate loading 0.0
- Bridge Floating (3yr): 70% LTV, SOFR+375, rate loading 0.95
- Agency Floating: variable, rate loading 0.95
- CMBS (5yr Fixed): 75% LTV, 6.0%, rate loading 0.0
- Per bundle: F1 loading, refinance risk, rate-cap covariance

**A6. API endpoints**
- `POST /api/sigma/plausibility` â€” score an assumption set
- `POST /api/sigma/goal-seek` â€” solve for target IRR
- `GET /api/sigma/bundles` â€” list debt bundles with metadata
- `GET /api/sigma/factors` â€” current factor loadings
- `GET /api/sigma/regime/current` â€” current regime classification

**Deliverable:** Plausibility scoring + goal-seeking solver working end-to-end

### M36-B: Plausibility UI (2 sessions)

**B1. Plausibility badge on AssumptionsTab**
- d-value displayed next to assumption set: d=0.6 ðŸŸ¢, d=1.8 ðŸŸ¡, d=3.2 ðŸ”´
- Per-variable contribution breakdown as expandable section
- Color-coded aggressiveness band

**B2. Goal-seeking UI** â€” "Solve for IRR" flow
- Target IRR input (default: user's desired return)
- Lock variables toggle per assumption
- Bundle selector dropdown
- Results: Pareto frontier table across bundles
- Best bundle recommendation with rationale

**B3. Debt bundle config UI**
- Browse available debt products in sidebar
- Add custom bundle parameters
- See per-bundle IRR + plausibility impact before committing

### M36-C: Empirical Î£ (5 sessions)
Once Phase A is working with heuristics, replace with data.

**C1. Historical data aggregation**
- Collect metric histories from DB, market reports, external APIs
- Align to monthly frequency
- Stationarity transforms (log diff, differencing)

**C2. Rolling-window Î£ estimation**
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
- Per-regime Î£_r estimation

**C5. Spatial kernel**
- Drive-time decay residual covariance
- Î» calibrated per asset class

### M36-D: Integration (3 sessions)

**D1. Wire Î£ into M14 Risk Module**
- Replace hand-tuned correlations with Î£
- Factor variance attribution
- Tail risk from Î£-consistent IRR distribution

**D2. Wire Î£ into M10 Scenario Engine**
- Bull/Base/Bear from Î£ percentiles
- Factor decomposition per scenario
- Probability-weighted returns

**D3. Cashflow Agent prompt augmentation**
- Plausibility scoring awareness
- Goal-seeking flow integration
- Bundle reasoning
- Capital stack double-up detection
- Bias toward anchored Î¼ for macro-linked metrics

---

## M37 Analog Engine Project Plan

### M37-A: Similarity Service (3 sessions)
**A1. Schema + migrations** â€” similarity cache, query log, bandwidth config
**A2. Similarity computation** â€” factor distance Ã— regime match Ã— event subtype
**A3. Analog ranking + weighting** â€” Kish effective sample size, t-distribution CIs

### M37-B: Forward Mode (2 sessions)
**B1. `POST /api/analogs/forecast/forward`** â€” event-driven forecast API
**B2. Cache layer + invalidation** on M35/M36 Kafka events

### M37-C: Backward + Counterfactual (2 sessions)
**C1. `POST /api/analogs/forecast/backward`** â€” market response profiles
**C2. `POST /api/analogs/forecast/counterfactual`** â€” hypothetical event trajectories

### M37-D: Agent Integration (3 sessions)
**D1.** Agent prompt: per-assumption M37 query
**D2.** Output shape: (point, CI, n_eff, analogs) instead of point estimates
**D3.** Fallback logic when n_eff < 3

---

## M38 Calibration Ledger Project Plan

### M38-A: Schema + Ingestion (2 sessions)
**A1.** `predictions`, `realizations`, `pairings`, `reliability_stats` tables
**A2.** Prediction emission API + SDK â€” every module emits on output

### M38-B: Realization Streams (2 sessions)
**B1.** M22 actuals â†’ `realizations` pipeline (blocked by deal_monthly_actuals)
**B2.** External data (RentCast, FRED, BLS) â†’ `realizations`

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
M36-A (Heuristic Î£) â”€â”€â†’ M36-B (Plausibility UI)
     â”‚                      â”‚
     â”‚                      â–¼
     â”‚               Cashflow Agent prompt update
     â”‚
     â””â”€â”€â”€â†’ M36-C (Empirical Î£) â”€â”€â†’ M36-D (Integration)
                                      â”‚
                                      â–¼
                               M37-A (Similarity Service)
                                      â”‚
                                      â–¼
                               M37-B/C/D (Forward/Agent)
                                      â”‚
                                      â–¼
                               M38-A/B/C/D/E (Calibration)
```

**Critical path:** M36-A â†’ M36-B â†’ cashflow agent â†’ M37-D â†’ M38-E
Everything else runs in parallel to this backbone.

---

## Current Session State

**M36-A Heuristic Î£: âœ… Complete** (2 sessions)

All 6 sub-phases built and tested:
- âœ… A1: Sigma variable registry (48 variables, 6 factors, 3 blocks)
- âœ… A2: Heuristic covariance builder (per-regime matrices, factor model + shrinkage)
- âœ… A3: Mahalanobis plausibility scorer (per-variable decomposition, banding, warnings)
- âœ… A4: Goal-seeking solver (grid search, simplified DCF, cross-bundle ranking)
- âœ… A5: Debt bundle registry (5 products, F1 loadings, double-up detection)
- âœ… A6: REST API (6 endpoints)
- âœ… **28/28 tests passing** (18 sigma-full + 10 sigma-builder)

**M36-B Plausibility UI: âœ… Complete**
- âœ… sigmaApi.ts â€” frontend API client (types, 6 endpoints, band colors)
- âœ… PlausibilityBadge.tsx â€” colored badge (d value + band) with refresh
- âœ… PlausibilityPanel.tsx â€” overlay detail panel (per-variable breakdown, warnings, bundle assessment)
- âœ… ProFormaTab integration â€” auto-scoring (2s debounce), badge in 4 section headers

**M36-C Goal-Seeking Roadmap: âœ… Complete**
- âœ… Refactored solver with roadmap output (per-variable IRR lift + d cost)
- âœ… Per-line-item expense adjustments (controllable lines distributed proportionally)
- âœ… Expanded adjustable variables (now 9: +loss_to_lease, +collection_loss)
- âœ… Apply payload format (assumptions + expenseOverrides + changed[])
- âœ… Target reachability detection with natural-language recommendation
- âœ… Route updated (expenseLineItems + controllableExpenseKeys passed through)
- âœ… 6 new tests (34 total Î£ tests passing)

**Next: M36-C Goal-Seeking UI** â€” frontend widget, bundle selector, "Apply" button

---

## Appendix: Relevant Files

### Backend â€” Î£ Engine
- `backend/src/services/sigma/sigma-variable-registry.ts` â€” 48 variables, 6 factors, 3 blocks, feasible ranges
- `backend/src/services/sigma/heuristic-sigma-builder.ts` â€” Î£ = BÂ·Î£_FÂ·Báµ€ + Î¨, per-regime matrices, Mahalanobis, Cholesky
- `backend/src/services/sigma/sigma-plausibility.service.ts` â€” scored plausibility with cache, per-variable decomposition, warnings
- `backend/src/services/sigma/sigma-goal-seeking.service.ts` â€” grid search solver, simplified DCF, cross-bundle Pareto
- `backend/src/services/sigma/debt-bundle-registry.ts` â€” 5 bundles, F1 loadings, double-up assessment
- `backend/src/services/sigma/macro-fetcher.ts` â€” 5 FRED/BLS series with cache/fallback
- `backend/src/services/sigma/mu-composer.ts` â€” macro-anchored Î¼ with divergence reweighting
- `backend/src/services/sigma/sigma-mu-plausibility.ts` â€” runtime plausibility with composed Î¼
- `backend/src/services/sigma/sigma-apply-deal.ts` â€” deal-level Î£ application
- `backend/src/services/sigma/sigma-engine.ts` â€” engine orchestrator
- `backend/src/services/sigma/proforma-anchors.service.ts` â€” line-item anchor registry
- `backend/src/services/sigma/anchor-interceptor.service.ts` â€” replaces flat rates with anchored values
- `backend/src/api/rest/sigma-full.routes.ts` â€” 6 new Î£ engine endpoints (plausibility, goal-seek, bundles, factors, regime)
- `backend/src/api/rest/sigma.routes.ts` â€” original Î¼/anchor endpoints
- `backend/src/agents/tools/fetch_anchor_growth_rates.ts` â€” agent anchor tool
- `backend/src/agents/tools/fetch_county_tax_rules.ts` â€” agent county tax methodology tool
- `backend/src/services/financial-model-engine.service.ts` â€” anchor interceptor wired here
- `backend/tests/sigma/sigma-full.test.ts` â€” 18 tests (plausibility, scoring, warnings, bundles, factors)
- `backend/tests/sigma/heuristic-sigma-builder.test.ts` â€” 10 tests (registry, builder, Mahalanobis, bands)
- `backend/tests/sigma/sigma-goal-seeking.test.ts` â€” 6 tests (roadmap, expense per-line-item, target reachability, apply payload)

### Backend â€” Tax
- `backend/src/services/tax/taxService.ts` â€” tax computation engine
- `backend/src/services/tax/rulesets/` â€” per-state tax rulesets (GA, FL, TX, CA, NY, IL, NC, LA, AZ)
- `backend/src/services/tax/types.ts` â€” TaxRuleset interface

### Frontend â€” Plausibility UI
- `frontend/src/api/sigmaApi.ts` â€” Î£ API client (types, 6 endpoints, band colors)
- `frontend/src/components/F9/PlausibilityBadge.tsx` â€” colored inline badge (d + band), click opens panel
- `frontend/src/components/F9/PlausibilityPanel.tsx` â€” modal overlay (per-variable breakdown, warnings, bundle)
- `frontend/src/components/deal/sections/ProFormaTab.tsx` â€” main proforma editing tab (PlausibilityBadge in 4 section headers, auto-scoring)
- `frontend/src/components/F9/AnchorLabel.tsx` â€” â„¹ anchor tooltip
- `frontend/src/components/F9/AnchorSensitivityInput.tsx` â€” per-expense override input
- `frontend/src/components/F9/SensitivityBar.tsx` â€” override progress bar
- `frontend/src/components/F9/F9SummaryBar.tsx` â€” F9 summary
- `frontend/src/hooks/useProformaAnchors.ts` â€” anchor tooltip hook

### DB
- `backend/src/db/migrations/` â€” active migration directory (sequential numbering)
- `backend/src/scripts/run-migrations.ts` â€” migration runner
- Tables: `macro_anchor_observations`, `proforma_line_item_anchors`, `supply_analyses`, `cashflow_projections`

### Documentation
- `M36_Macro_Anchored_Mean_Addendum.md` â€” macro-anchored Î¼ spec
- `M36_PROFORMA_LINE_ITEM_ANCHORS.md` â€” line-item anchor spec
- `ROADMAP_M36_M38.md` â€” original phased roadmap
- `MVP_BUILD_PLAN.md` â€” original MVP plan (superseded)

