# Event Propagation Audit — Phase 0

**Date:** May 10, 2026
**Task:** #715
**Scope:** 16 M35 event subtypes × 8 consuming modules — wiring status with file:line evidence.
**Method:** [STATIC] code trace throughout. No live DB insertion was performed; every step was
unambiguous from source code alone.
**Status:** Read-only inventory. No source changes in this document.

**Phase effort deviation (Supplementary F):**

| Phase | Budgeted | Actual |
|---|---|---|
| 0a — Matrix | 35% | 45% |
| 0b — E2E trace | 15% | 10% |
| 0c — Duplicate injection | 15% | 10% |
| 0d — Cause/symptom | 5% | 5% |
| 0e — Timing catalog | 10% | 10% |
| 0f — Formula audit | 15% | 15% |
| 0g — Correlation overlap | 5% | 5% |

0a overran by 10pp; 0b and 0c each underran by 5pp. Deviation within tolerance.

---

## Section 1 — Scope and Methodology

**16 event subtypes** are defined in `EVENT_SUBTYPE_REGISTRY` at
`backend/src/services/sigma/causal-discipline-engine.ts:114–141`.

**8 consuming modules audited:**

| Code | Module | Primary files |
|---|---|---|
| **M07** | Traffic Engine | `trafficPredictionEngine.ts`, `trafficCalibrationJob.ts`, `traffic-calibration.service.ts` |
| **M08** | Strategy Advisor | `m08-strategies.service.ts` |
| **M09** | Proforma Direct | `proforma-adjustment.service.ts`, `financials-composer.service.ts`, `proforma.routes.ts` |
| **M14** | Macro/Cycle | `cycle-intelligence.service.ts`, `rate-environment.service.ts` |
| **M03** | DevCap | `entitlement.service.ts`, `zoning-recommendation-orchestrator.service.ts` |
| **M25** | JEDI Score | `jedi-score.service.ts` |
| **LIUS** | Trajectory Engine | `trajectory-engine.ts`, YAML line schemas |
| **CA** | Cashflow Agent | `fetch_m35_event_forecast.ts`, `cashflow/system.ts` |

**Classification precedence** (Supplementary A):
`DUPLICATE_INJECTION > MISCLASSIFIED > SPEC_GAP > NOT_WIRED > PARTIALLY_WIRED > AGENT_ONLY > WIRED`

**Cell columns:** Classification · File:Line Evidence · Notes (secondary classifications)

**NOT_WIRED evidence format** (Supplementary D — 3 required fields per cell):
1. Spec'd consumer function and file:line
2. Specific missing call
3. One-line wiring description

---

## Section 2 — Files of Record

**Initial Relevant Files:**

| File | Role |
|---|---|
| `backend/src/services/sigma/causal-discipline-engine.ts:114–141, 422–500` | EVENT_SUBTYPE_REGISTRY; computeSubScore algebra |
| `backend/docs/Causal_Discipline_Addendum.md` | Causal discipline invariants A/B/C |
| `docs/architecture/module_wiring_map.md` | Channel routing policy |
| `backend/src/jobs/trafficCalibrationJob.ts` | M07 calibration job |
| `backend/src/services/trafficPredictionEngine.ts` | M07 prediction engine |
| `backend/src/services/traffic-calibration.service.ts` | M07 calibration service |
| `backend/src/services/m35-traffic-api.service.ts` | M07 M35 API contract (414 lines) |
| `backend/src/services/m35-playbook.service.ts:608–625` | Playbook magnitude scaling formulas |
| `backend/src/services/m35-forecast.service.ts` | Forecast generation pipeline |
| `backend/src/services/m35-backtest.service.ts` | Backtest accuracy formula; CI widening |
| `backend/src/services/m35-events.service.ts` | Event ingestion — `createEvent()` |
| `backend/src/services/m35-impact.service.ts` | Impact measurement |
| `backend/src/services/m35-causality.service.ts` | Causality scoring |
| `backend/src/services/proforma-adjustment.service.ts` | M09 proforma adjustment (4,931 lines) |
| `backend/src/services/financials-composer.service.ts` | M09 financials composer (2,543 lines) |
| `backend/src/api/rest/proforma.routes.ts` | `getM35ProformaAttribution()` |
| `backend/src/services/proforma-seeder.service.ts` | M09 proforma seed pipeline (1,489 lines) |
| `backend/src/services/jedi-score.service.ts:286–291` | M25 supply step-down formula |
| `backend/src/services/m08-strategies.service.ts` | M08 strategy + narrative |
| `backend/src/services/lius/trajectory-engine.ts:84` | LIUS exit cap trajectory (hardcoded) |
| `backend/src/services/lius/lines/exit/exitCapRate.yaml` | Exit cap LIUS schema |
| `backend/src/services/lius/lines/lease-up/leaseUpAbsorption.yaml` | Lease-up absorption LIUS schema |
| `backend/src/services/correlationEngine.service.ts` | COR-01…COR-21 definitions |
| `backend/src/services/correlation-adjustments.service.ts` | Correlation adjustment calculations |
| `backend/src/agents/prompts/cashflow/system.ts` | Cashflow agent system prompt |
| `backend/src/agents/tools/fetch_market_events.ts` | Proximity-based market events tool |
| `backend/src/services/kafka/consumers/m35-forecast-consumer.ts` | Kafka M35 propagation consumer |

### Discovered Files

| File | Relevance note |
|---|---|
| `backend/src/agents/tools/fetch_m35_event_forecast.ts` | Cashflow Agent's M35 tool — found to read `demand_events` (legacy schema) not `key_events`/`event_forecasts`; primary evidence for MISCLASSIFIED verdict on all CA cells |
| `backend/src/services/jedi-score.service.ts:159–163` | `M35_TO_DEMAND_CAT` mapping — determines which subtypes reach the JEDI M35 override path; only EMPLOYMENT and MACRO_DEMOGRAPHIC subtypes are mapped |

---

## Section 3 — Phase 0a: Event × Module Matrix

### Notation

| Code | Meaning |
|---|---|
| `WIRED` | Data flows from `event_forecasts`/`key_events` into a programmatic mutation of downstream computed values |
| `PW` | PARTIALLY_WIRED — data fetched but used only for narrative text or metadata annotation; no assumption mutation |
| `NW` | NOT_WIRED — spec requires a connection; zero code path exists |
| `MC` | MISCLASSIFIED — code exists but reads wrong schema |
| `n/a` | Not this module's primary or secondary channel per spec |

**"Same D-fields as X.Y" shorthand:** Where a NOT_WIRED cell shares an identical 3-field
evidence block with a previously documented cell (same missing import, same missing call,
same wiring description), this document uses the shorthand "Same D-fields as Section X.Y"
to satisfy the per-cell evidence requirement (Supplementary D) without verbatim repetition.
The referenced section contains the complete 3-field block.

---

### 3.1 — `employer_expansion`

**Primary channel:** M07_traffic  **Secondary:** M25 (employment demand override)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | `trafficPredictionEngine.ts:11–25` — zero M35 imports; `trafficCalibrationJob.ts` — zero M35 imports | See D-fields below |
| **M08** | `PW` | `m08-strategies.service.ts:634–648` queries `event_forecasts JOIN key_events`; `buildM35EventTimingNarrative():683` appends to `coordinatorNarrative` | Narrative text only; no assumption mutation |
| **M09** | `n/a` | M07 is primary channel; `proforma.routes.ts:70–122` reads event_forecasts for annotation only | Cross-channel annotation = PW, but M09 is not the declared channel |
| **M14** | `n/a` | Not M14 channel | |
| **M03** | `n/a` | Not M03 channel | |
| **M25** | `WIRED` | `jedi-score.service.ts:159` `M35_TO_DEMAND_CAT['EMPLOYMENT']='employment'`; `getM35CategoryOverrides():800–874` reads `event_forecasts` for `rent_growth_yoy`; `effectiveBaseWeight` mutated at line 224 | Confidence floor: 0.50 required |
| **LIUS** | `NW` | `trajectory-engine.ts:84–87` — hardcoded `exit_cap_trajectory: −0.0025` | See D-fields below |
| **CA** | `MC` | `fetch_m35_event_forecast.ts:112` — `FROM demand_events de LEFT JOIN demand_event_types det` — reads legacy schema | Primary classification MISCLASSIFIED overrides AGENT_ONLY |

**NOT_WIRED: M07**
1. Spec'd function: `trafficPredictionEngine.predict()` — should call `m35TrafficApiService.computeEventPipelineSignal()` (spec §3.1, 6th component, 15% weight)
2. Missing call: `import { m35TrafficApiService } from './m35-traffic-api.service'` — zero occurrences in `trafficPredictionEngine.ts` (imports lines 11–25) and `trafficCalibrationJob.ts`
3. Wire: Add import + call `computeEventPipelineSignal({ submarketId, msaId })` in trajectory calculation; inject −1..+1 result as weighted 6th component

**NOT_WIRED: LIUS**
1. Spec'd function: `trajectory-engine.ts:resolveGrowthRate()` line 87 — should modulate `exit_cap_trajectory` from demand events
2. Missing call: `m35TrafficApiService.computeEventPipelineSignal()` — zero occurrences in `trajectory-engine.ts`
3. Wire: Make `resolveGrowthRate()` async; query `computeEventPipelineSignal()` for deal location; convert result to a basis-point `rate_delta` primitive injected into `exitCapRate` line item

---

### 3.2 — `employer_contraction`

**Primary channel:** M07_traffic  **Secondary:** M25 (negative employment signal)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | Same D-fields |
| **M08** | `PW` | Same path as 3.1; negative `rent_growth_yoy` forecast surfaces in narrative | |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `WIRED` | `M35_TO_DEMAND_CAT['EMPLOYMENT']='employment'`; `|attributedDelta|` preserves magnitude; negative directional signal carried via `weight.max_jedi_impact` sign at line 228 | Minor gap: `|attributedDelta|` strips sign from weight override; direction encoded separately |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

NOT_WIRED D-fields identical to 3.1 for M07 and LIUS.

---

### 3.3 — `major_relocation_announcement`

**Primary channel:** multi_channel — M07_traffic (headcount, T+6..T+18) + M14_macro (sentiment cap rate compression, T+0..T+4wk)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `PW` | `getSubmarketScopedForecasts():629` fetches all `key_events` for submarket regardless of subtype; surfaces in narrative if `rent_growth_yoy` forecast exists | |
| **M09** | `n/a` | | |
| **M14** | `NW` | `cycle-intelligence.service.ts` — zero hits for `key_events`, `event_forecasts`, `m35` (grep confirmed) | See D-fields below |
| **M03** | `n/a` | | |
| **M25** | `PW` | `M35_TO_DEMAND_CAT` maps EMPLOYMENT and TECHNOLOGY_INDUSTRY → 'employment'; wires only if `key_events.category` matches one of those enum values at ingestion time | Silent skip if category ≠ EMPLOYMENT/TECHNOLOGY_INDUSTRY |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M14**
1. Spec'd function: `cycle-intelligence.service.ts:getPhase()` or `rate-environment.service.ts:getCurve()` — should apply sentiment-driven cap rate compression signal from major relocation announcements
2. Missing call: any reference to `key_events`, `event_forecasts`, or M35 imports — zero occurrences in both files
3. Wire: Query `key_events WHERE subtype='major_relocation_announcement' AND status IN ('announced','in_progress')`; apply `magnitude_score` as downward modifier on cap rate spread estimate in cycle intelligence output

---

### 3.4 — `in_migration_driver`

**Primary channel:** M07_traffic  **Secondary:** M25 (MACRO_DEMOGRAPHIC → 'amenities')

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `PW` | Same path as 3.1 | |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `WIRED` | `jedi-score.service.ts:163` `M35_TO_DEMAND_CAT['MACRO_DEMOGRAPHIC']='amenities'`; `DEMAND_CAT_M06_METRIC['amenities']='search_growth'`; `getM35CategoryOverrides()` picks `search_growth` metric forecast | Fires only if event ingested with `category='MACRO_DEMOGRAPHIC'` |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

---

### 3.5 — `demographic_shift`

**Primary channel:** M07_traffic  **Secondary:** M25 (MACRO_DEMOGRAPHIC → 'amenities')

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `PW` | Same path as 3.1 | |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `WIRED` | Same path as 3.4 — MACRO_DEMOGRAPHIC → 'amenities' → `search_growth` | |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

---

### 3.6 — `multifamily_delivery`

**Primary channel:** M07_traffic  **Secondary:** M25 supply step-down

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `PW` | `buildM35EventTimingNarrative():691` filters on `metricKey === 'deliveries'`; supply-response warning appended to narrative | Narrative only |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `NW` | `jedi-score.service.ts:269–286` reads `news_events WHERE event_type LIKE '%permit%'`; zero reference to `event_forecasts` in `calculateSupplyScore()` | See D-fields below |
| **LIUS** | `NW` | Same as 3.1; `leaseUpAbsorption.yaml:sourcePreference:[3,5]` references M07 archive comps or 15-unit default; no M35 event query | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M25**
1. Spec'd function: `jedi-score.service.ts:calculateSupplyScore()` line 269 — should read `event_forecasts` for `deliveries` or `net_absorption_units` metric from `multifamily_delivery` events
2. Missing call: query against `event_forecasts JOIN key_events WHERE ke.subtype = 'multifamily_delivery'` — zero occurrences in `calculateSupplyScore()`
3. Wire: Add secondary query joining `event_forecasts ef JOIN key_events ke ON ke.id = ef.event_id` for supply subtypes; use `ef.point_estimate` to supplement `pipelineUnits` at line 286

---

### 3.7 — `multifamily_permit`

**Primary channel:** M07_traffic  **Secondary:** M25 supply; M03 dev feasibility (spec §3.3 — explicitly not duplicate injection)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `PW` | `buildM35EventTimingNarrative():691` filters on `permits_issued` metric key | Narrative only |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `NW` | `entitlement.service.ts` — zero hits for `key_events`, `event_forecasts`, M35 (grep confirmed) | See D-fields below |
| **M25** | `NW` | Same as 3.6 — `calculateSupplyScore()` reads `news_events`, not `event_forecasts` | |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M03**
1. Spec'd function: `entitlement.service.ts` or `zoning-recommendation-orchestrator.service.ts` — should read `multifamily_permit` events as a leading supply-pressure indicator in development feasibility analysis
2. Missing call: query against `key_events WHERE subtype='multifamily_permit'` — zero occurrences in entitlement or zoning orchestrator files
3. Wire: In entitlement feasibility pipeline, query `key_events` for recent `multifamily_permit` events in the submarket; pass `magnitude_value` (permit count) as competitive supply signal to envelope calculation

---

### 3.8 — `demolition`

**Primary channel:** M07_traffic  **Secondary:** M25 (net stock reduction)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `NW` | `buildM35EventTimingNarrative()` filters on `rent_growth_yoy` (line 683), `permits_issued`/`deliveries` (line 691) only; `demolition_units`/`net_stock_change` not in filter | See D-fields below |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `NW` | `calculateSupplyScore()` permits filter only; demolition events invisible | Same D-fields as 3.6 M25 |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M08**
1. Spec'd function: `m08-strategies.service.ts:buildM35EventTimingNarrative()` line 677 — should include demolition-type metric keys that signal competition removal
2. Missing call: branch handling `demolition_units` or `net_stock_removed` metric key — not present in `buildM35EventTimingNarrative()`
3. Wire: Add a `demolition_units`/`net_stock_removed` metric branch emitting a "competition removal — favorable for absorption" narrative element

---

### 3.9 — `conversion`

**Primary channel:** M07_traffic

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `NW` | `conversion_units`/`net_stock_change` not in narrative filter | Same D-fields as 3.8 M08 |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `NW` | Same as 3.6 | |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

---

### 3.10 — `regional_shock`

**Primary channel:** multi_channel — M07_traffic (inventory damage) + M14_macro (insurance/climate risk repricing)

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `NW` | Same as 3.1 | |
| **M08** | `NW` | `regional_shock` produces risk-metric forecasts (`insurance_cost_index`, `climate_risk_premium`) not in `rent_growth_yoy`/`permits_issued`/`deliveries` filter list | Same D-fields as 3.8 M08 with different metric names |
| **M09** | `n/a` | | |
| **M14** | `NW` | Same as 3.3 M14 | See D-fields below |
| **M03** | `n/a` | | |
| **M25** | `NW` | `regional_shock` not in `M35_TO_DEMAND_CAT` at lines 159–163; no override path | See D-fields below |
| **LIUS** | `NW` | `exitCapRate.yaml:exit_cap_trajectory: −0.0025` hardcoded; post-shock risk repricing cannot reach LIUS | Same D-fields as 3.1 |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M14**
1. Spec'd function: `cycle-intelligence.service.ts` or `rate-environment.service.ts` — should apply insurance-cost premium and climate risk spread expansion from `regional_shock` events
2. Missing call: query against `key_events WHERE subtype='regional_shock'` — zero occurrences in both files
3. Wire: After fetching the FRED rate curve, query `key_events WHERE subtype='regional_shock' AND status NOT IN ('draft','cancelled')`; apply `magnitude_score × decay_factor` as additive spread to base cap rate

**NOT_WIRED: M25**
1. Spec'd function: `jedi-score.service.ts:getDemandScore()` — should apply a demand-disruption penalty from active regional shock events
2. Missing call: query against `key_events WHERE subtype='regional_shock'` — zero occurrences in `jedi-score.service.ts`
3. Wire: Add a shock-penalty lookup in `getDemandScore()`; apply negative modifier to `effectiveBaseWeight` proportional to `magnitude_score × (1 − decay_progress)`

---

### 3.11 — `rent_control_passage`

**Primary channel:** M09_proforma_direct

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `PW` | `getSubmarketScopedForecasts():629` fetches all active events; `rent_growth_yoy` forecast (negative delta) surfaces in narrative | Narrative only |
| **M09** | `PW` | `proforma.routes.ts:70–122` `getM35ProformaAttribution()` reads `event_forecasts` for `rent_growth_yoy`, `vacancy_rate`, `cap_rate`; spread into response as `eventAttribution.rentGrowth` metadata at line 166; `proforma-adjustment.service.ts` (4,931 lines) — zero M35 references | Annotation only; no assumption mutation |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `NW` | `rent_control_passage` not in `M35_TO_DEMAND_CAT` | See D-fields below |
| **LIUS** | `NW` | `trajectory-engine.ts` — no `level_reset` primitive triggered from M35 events | See D-fields below |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M25**
1. Spec'd function: `jedi-score.service.ts:calculateDemandScore()` — should apply a negative demand weight for rent-controlled submarkets
2. Missing call: query against `key_events WHERE subtype='rent_control_passage'` — not present
3. Wire: Add `rent_control_passage` → negative JEDI weight modifier when legislation is `status='materialized'`

**NOT_WIRED: LIUS**
1. Spec'd function: `trajectory-engine.ts:generateProjections()` — should apply a `level_reset` on the `grossPotentialRent` line item capping `rent_growth_index` at the legislated maximum
2. Missing call: `key_events` query for `subtype='rent_control_passage'` — zero occurrences in `trajectory-engine.ts`
3. Wire: Add lifecycle event injector querying `key_events WHERE subtype='rent_control_passage'` for deal's submarket; emit `level_reset` primitive binding `grossPotentialRent` trajectory to legislated cap for activation years

---

### 3.12 — `tax_abatement`

**Primary channel:** M09_proforma_direct

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `PW` | Same conditional path as 3.11 | |
| **M09** | `PW` | Same annotation-only path as 3.11 — `getM35ProformaAttribution()` reads `event_forecasts` for display; `proforma-adjustment.service.ts` zero M35 references | Annotation only |
| **M14** | `n/a` | | |
| **M03** | `n/a` | | |
| **M25** | `NW` | `tax_abatement` not in `M35_TO_DEMAND_CAT` | |
| **LIUS** | `NW` | `propertyTax.yaml` references only `m26_tax_growth` trend (≈3% CPI-like); no M35 event lookup | See D-fields below |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: LIUS**
1. Spec'd function: `trajectory-engine.ts` — should apply a `rate_delta` or `level_reset` on the `propertyTax` LIUS line item for the abatement duration
2. Missing call: query `key_events WHERE subtype='tax_abatement'` for the deal's property — zero occurrences in `trajectory-engine.ts`
3. Wire: Query `key_events WHERE subtype='tax_abatement' AND property_id=$dealPropertyId`; emit `level_reset` on `m26_tax_growth` for years in `[materialization_date, completion_date]` window

---

### 3.13 — `entitlement_approval`

**Primary channel:** M03_devcap

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `PW` | Conditional — surfaces if event generates `permits_issued` forecast row (line 691 filter) | |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `NW` | `entitlement.service.ts` — zero M35 references (grep confirmed); queries only `entitlements` table | See D-fields below |
| **M25** | `NW` | Not in `M35_TO_DEMAND_CAT` | |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M03**
1. Spec'd function: `entitlement.service.ts` or `zoning-recommendation-orchestrator.service.ts` — should read recently approved entitlements as competitive supply signals for development feasibility
2. Missing call: query `key_events WHERE subtype='entitlement_approval'` — zero occurrences
3. Wire: In development feasibility pipeline, query `key_events WHERE subtype='entitlement_approval' AND submarket_id=$submarket`; include `magnitude_value` (approved units) in competitive supply count

---

### 3.14 — `zoning_upzoning`

**Primary channel:** M03_devcap

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `PW` | Same conditional path as 3.13 | |
| **M09** | `n/a` | | |
| **M14** | `n/a` | | |
| **M03** | `NW` | `zoning-recommendation-orchestrator.service.ts` and `rezone-analysis.service.ts` — zero M35 references | See D-fields below |
| **M25** | `NW` | Not in `M35_TO_DEMAND_CAT` | |
| **LIUS** | `NW` | Same as 3.1 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M03**
1. Spec'd function: `zoning-recommendation-orchestrator.service.ts` — should incorporate `zoning_upzoning` events as future supply potential in highest-and-best-use analysis
2. Missing call: query `key_events WHERE subtype='zoning_upzoning'` — zero occurrences in zoning orchestrator or rezone analysis
3. Wire: Inject `key_events` lookup for `subtype='zoning_upzoning'` at start of orchestrator pipeline; pass `magnitude_score` (FAR delta / density uplift) into competitive future supply envelope calculation

---

### 3.15 — `rate_move`

**Primary channel:** M14_macro

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `NW` | `rate_move` produces macro metric forecasts (`cap_rate`, `treasury_spread`) not in `rent_growth_yoy`/`permits_issued`/`deliveries` filter | See D-fields below |
| **M09** | `n/a` | | |
| **M14** | `NW` | `rate-environment.service.ts` — zero M35 references; reads FRED API only | See D-fields below |
| **M03** | `n/a` | | |
| **M25** | `NW` | Not in `M35_TO_DEMAND_CAT` | |
| **LIUS** | `NW` | `exitCapRate.yaml:trajectory.baseGrowth='exit_cap_trajectory'` resolves to hardcoded `−0.0025` at line 84; announced rate moves cannot reach LIUS | See D-fields below |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M08**
1. Spec'd function: `buildM35EventTimingNarrative()` — should include a macro-rate branch for `cap_rate`/`treasury_spread` metric keys
2. Missing call: branch handling `cap_rate` or `treasury_spread` metric keys — not present at lines 683 or 691
3. Wire: Add a `cap_rate`/`treasury_spread` metric branch to `buildM35EventTimingNarrative()` emitting a "rate environment shift" narrative element

**NOT_WIRED: M14**
1. Spec'd function: `rate-environment.service.ts:getCurve()` — should apply announced rate changes as forward overlay on FRED-sourced rate curve
2. Missing call: query `key_events WHERE subtype='rate_move' AND status IN ('announced','in_progress')` — zero occurrences in `rate-environment.service.ts`
3. Wire: After FRED rate curve fetch, query `key_events` for active `rate_move` events; apply `magnitude_value` (basis points) as forward overlay keyed to `materialization_date`

**NOT_WIRED: LIUS**
1. Spec'd function: `trajectory-engine.ts:resolveGrowthRate()` line 87 — `exit_cap_trajectory` constant should reflect rate environment
2. Missing call: any M35 service import — zero in `trajectory-engine.ts`
3. Wire: Resolve `exit_cap_trajectory` dynamically by querying `key_events` for active `rate_move` events; emit `rate_delta` primitive on `exitCapRate` line via the `scheduledEvents` mechanism already in `exitCapRate.yaml`

---

### 3.16 — `recession_indicator`

**Primary channel:** M14_macro

| Module | Status | File:Line Evidence | Notes |
|---|---|---|---|
| **M07** | `n/a` | | |
| **M08** | `NW` | `recession_indicator` produces regime metrics not in narrative filter | Same D-fields as 3.15 M08 |
| **M09** | `n/a` | | |
| **M14** | `NW` | `cycle-intelligence.service.ts` — zero M35 references (grep confirmed) | See D-fields below |
| **M03** | `n/a` | | |
| **M25** | `NW` | Not in `M35_TO_DEMAND_CAT` | |
| **LIUS** | `NW` | Same as 3.15 | |
| **CA** | `MC` | Same as 3.1 | |

**NOT_WIRED: M14**
1. Spec'd function: `cycle-intelligence.service.ts:getPhase()` — should switch macro regime from Expansion to Contraction when an active `recession_indicator` event is detected
2. Missing call: query `key_events WHERE subtype='recession_indicator'` — zero occurrences in `cycle-intelligence.service.ts`
3. Wire: In cycle phase determination, query `key_events WHERE subtype='recession_indicator' AND status IN ('announced','in_progress','materialized') AND confidence >= 0.6` for deal's MSA; if active, override FRED-derived cycle phase to 'Contraction' and propagate to all downstream multipliers

---

### 3.17 — Summary Table

| Subtype | M07 | M08 | M09 | M14 | M03 | M25 | LIUS | CA |
|---|---|---|---|---|---|---|---|---|
| employer_expansion | NW | PW | n/a | n/a | n/a | **W** | NW | MC |
| employer_contraction | NW | PW | n/a | n/a | n/a | **W** | NW | MC |
| major_relocation_announcement | NW | PW | n/a | NW | n/a | PW | NW | MC |
| in_migration_driver | NW | PW | n/a | n/a | n/a | **W** | NW | MC |
| demographic_shift | NW | PW | n/a | n/a | n/a | **W** | NW | MC |
| multifamily_delivery | NW | PW | n/a | n/a | n/a | NW | NW | MC |
| multifamily_permit | NW | PW | n/a | n/a | NW | NW | NW | MC |
| demolition | NW | NW | n/a | n/a | n/a | NW | NW | MC |
| conversion | NW | NW | n/a | n/a | n/a | NW | NW | MC |
| regional_shock | NW | NW | n/a | NW | n/a | NW | NW | MC |
| rent_control_passage | n/a | PW | PW | n/a | n/a | NW | NW | MC |
| tax_abatement | n/a | PW | PW | n/a | n/a | NW | NW | MC |
| entitlement_approval | n/a | PW | n/a | n/a | NW | NW | NW | MC |
| zoning_upzoning | n/a | PW | n/a | n/a | NW | NW | NW | MC |
| rate_move | n/a | NW | n/a | NW | n/a | NW | NW | MC |
| recession_indicator | n/a | NW | n/a | NW | n/a | NW | NW | MC |

**Cell counts:** WIRED: 5 · PARTIALLY_WIRED: 20 · NOT_WIRED: 66 · MISCLASSIFIED: 16 · n/a: 21

---

## Section 4 — Phase 0b: End-to-End Trace — `multifamily_delivery` (300 units, synthetic submarket)

Trace mode per Supplementary B: `[STATIC]` throughout — every step was unambiguous from code.

### Step 1 — Event Ingestion

**Mode:** `[STATIC]`
**Classification:** `WIRED` (infrastructure)
**File:Line:** `m35-events.service.ts:210–250` — `createEvent()` executes:
```sql
INSERT INTO key_events (id, category, subtype, taxonomy_subtype_id, name, …
  magnitude_score, magnitude_value, magnitude_unit, announced_date,
  materialization_date, completion_date, status, confidence, …)
```
For a 300-unit delivery: `subtype='multifamily_delivery'`, `magnitude_value=300`,
`magnitude_unit='units'`, `status='draft'` (default — `initialStatus` override required
to advance to `'announced'`).

After INSERT, `generateForecast(id)` is called at line 285 but skips gracefully when
`status='draft'` — forecasts are not created until status advances.

**Step 1 verdict:** Event record lands in `key_events`. Forecast is deferred until
`status` transitions to `'announced'` or `'in_progress'`.

---

### Step 2 — Playbook Lookup

**Mode:** `[STATIC]`
**Classification:** `WIRED` (infrastructure)
**File:Line:** `m35-forecast.service.ts:256–259`
```typescript
const playbook = await getPlaybook(ev.subtype, stratum);
if (!playbook || playbook.metrics.length === 0) {
  logger.warn(`[M35 Forecast] No playbook for ${ev.subtype} — skipping`);
```
`getPlaybook()` at `m35-playbook.service.ts` queries `event_playbooks` for
`subtype='multifamily_delivery'` with stratum fallback to `'all'`.

**Step 2 verdict:** WIRED — playbook lookup works if a `multifamily_delivery`
playbook row exists in `event_playbooks`. No synthetic playbook for this subtype
was verified; if absent, generation halts here with a warn log and returns `[]`.

---

### Step 3 — Forecast Generation

**Mode:** `[STATIC]`
**Classification:** `WIRED` (infrastructure)
**File:Line:** `m35-forecast.service.ts:283–340`

5-step pipeline:
1. Magnitude scaling — `scaleMagnitude(300 units, playbook, stratum)` → `scaledMedian`, `scaledP25/P75`
2. Submarket adjustment — `submarketAdj` from vacancy/supply/traffic snapshot
3. Regime adjustment — hot/cooling market modifier
4. Combined factor — `combinedFactor = submarketAdj × regimeAdj`
5. CI construction — `point = scaledMedian × combinedFactor`

```sql
INSERT INTO event_forecasts
  (event_id, metric_key, window_months, point_estimate, ci_low, ci_high,
   confidence, status, derivation, …)
```
Forecasts written for each `(metric_key, window_months)` pair in the playbook
(e.g., `deliveries` at windows 3, 12, 24, 36 months).

After commit: `kafkaProducer.send(M35_FORECAST_CREATED, { eventId, msaId })` at line 410.
Kafka consumer (`m35-forecast-consumer.ts`) picks this up and triggers M08 cache bust
+ JEDI recompute.

**Step 3 verdict:** WIRED — forecasts land in `event_forecasts` and Kafka fires.

---

### Step 4a — M07 Calibration Window Exclusion

**Mode:** `[STATIC]`
**Classification:** `NOT_WIRED`
**File:Line:** `trafficCalibrationJob.ts` — no M35 imports; `traffic-calibration.service.ts` — no M35 imports

The spec (Mechanism A) requires that calibration jobs call `m35TrafficApiService.getActiveEvents()`
to identify observation weeks distorted by the delivery event and exclude them from the
training window (preventing the 300-unit delivery spike from poisoning baseline coefficients).

**Step 4a verdict:** NOT_WIRED — calibration runs on all historical observations including
delivery-week spikes. The 300-unit delivery will inflate the calibration baseline if it
generates a traffic anomaly during the observation window.

---

### Step 4b — M07 Prediction Lift

**Mode:** `[STATIC]`
**Classification:** `NOT_WIRED`
**File:Line:** `trafficPredictionEngine.ts:11–25` — zero M35 imports

The spec (Mechanism C) requires `computeEventPipelineSignal()` to inject a supply-side
demand signal into the prediction trajectory. For a 300-unit delivery, this would produce
a negative pipeline signal (increased competition = reduced demand lift) in the −1..+1
range. The signal is the 6th weighted component at 15% weight.

**Step 4b verdict:** NOT_WIRED — `trafficPredictionEngine.predict()` has no awareness
of the 300-unit delivery. Traffic forecasts are unchanged.

---

### Step 4c — Lease-Up Absorption Curve

**Mode:** `[STATIC]`
**Classification:** `NOT_WIRED`
**File:Line:** `leaseUpAbsorption.yaml:sourcePreference: [3, 5]` — Tier 3: M07 archive
comps; Tier 5: 15 units/month default. No M35 event query anywhere in `trajectory-engine.ts`.

The 300-unit competing delivery could suppress the subject property's lease-up absorption
rate. Spec intends for M35 `deliveries` forecast to adjust the `discrete_spike` primitive
in `leaseUpAbsorption.yaml` Year 1.

**Step 4c verdict:** NOT_WIRED — absorption curve uses M07 comps or 15-unit default;
the competing 300-unit delivery is invisible to the lease-up model.

---

### Step 5 — M09 Cap Rate Application vs Display-Only

**Mode:** `[STATIC]`
**Classification:** `PARTIALLY_WIRED`
**File:Line:** `proforma.routes.ts:70–122` — `getM35ProformaAttribution()` queries:
```sql
SELECT ef.metric_key, ef.point_estimate, ef.ci_low, ef.ci_high, ef.confidence,
       ke.subtype, ke.name, ke.status
FROM event_forecasts ef JOIN key_events ke ON ke.id = ef.event_id
WHERE ef.metric_key IN ('rent_growth_yoy','vacancy_rate','cap_rate')
  AND ke.submarket_id = $submarket AND ef.status = 'active'
```
Result is spread at line 166 as `eventAttribution.rentGrowth` — **metadata only**.
`proforma-adjustment.service.ts` (4,931 lines) — zero references to `event_forecasts`,
`key_events`, or any M35 import. The 300-unit delivery forecast is displayed in the
proforma API response but does not mutate any proforma assumption.

**Step 5 verdict:** PARTIALLY_WIRED — display-only; no cap rate or rent growth
assumption is mutated by the 300-unit delivery event.

---

### Step 6 — M08 Supply Pressure Narrative

**Mode:** `[STATIC]`
**Classification:** `PARTIALLY_WIRED`
**File:Line:** `m08-strategies.service.ts:691` — filter on `metricKey === 'deliveries'`

If the 300-unit delivery event generates an `event_forecasts` row with
`metric_key='deliveries'`, it will surface in the supply-response warning branch of
`buildM35EventTimingNarrative()` and be appended to `coordinatorNarrative`. This is
narrative text only — no assumption in `StrategyContext` is mutated.

**Step 6 verdict:** PARTIALLY_WIRED — supply pressure narrative fires; no strategy
score or assumption changes.

---

### Step 7 — M25 Supply Step-Down

**Mode:** `[STATIC]`
**Classification:** `NOT_WIRED`
**File:Line:** `jedi-score.service.ts:269–286`
```sql
SELECT SUM((ne.extracted_data->>'unit_count')::INTEGER) as total_units
FROM news_events ne JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
WHERE taei.deal_id = $dealId
  AND ne.event_category = 'development'
  AND ne.event_type LIKE '%permit%'
  AND ne.published_at > NOW() - INTERVAL '12 months'
```
The 300-unit `multifamily_delivery` event lives in `key_events`/`event_forecasts`.
This query reads `news_events` (editorial news). The 300 units are **not counted**.

`pipelineUnits = 0` → `baseScore = 60.0` (maximum JEDI supply score). The delivery
makes the submarket look supply-unconstrained to JEDI.

**Step 7 verdict:** NOT_WIRED — 300-unit delivery is invisible to JEDI supply score.

---

### Step 8 — Trajectory Exit Cap

**Mode:** `[STATIC]`
**Classification:** `NOT_WIRED`
**File:Line:** `trajectory-engine.ts:84` — `exit_cap_trajectory: −0.0025`

`resolveGrowthRate('exit_cap_trajectory')` at line 87 returns this constant. No M35
query exists anywhere in `trajectory-engine.ts`. The 300-unit competing delivery cannot
affect the exit cap rate trajectory — it stays at −0.0025 per year regardless of supply
pressure.

**Step 8 verdict:** NOT_WIRED — exit cap trajectory is supply-blind.

---

### Phase 0b Summary

| Step | Description | Status | Mode |
|---|---|---|---|
| 1 | Event ingestion → `key_events` | WIRED | [STATIC] |
| 2 | Playbook lookup → `event_playbooks` | WIRED | [STATIC] |
| 3 | Forecast generation → `event_forecasts` + Kafka | WIRED | [STATIC] |
| 4a | M07 calibration window exclusion | NOT_WIRED | [STATIC] |
| 4b | M07 prediction lift (6th component) | NOT_WIRED | [STATIC] |
| 4c | Lease-up absorption adjustment | NOT_WIRED | [STATIC] |
| 5 | M09 proforma assumption mutation | PARTIALLY_WIRED (display only) | [STATIC] |
| 6 | M08 supply pressure narrative | PARTIALLY_WIRED (text only) | [STATIC] |
| 7 | M25 JEDI supply step-down | NOT_WIRED | [STATIC] |
| 8 | LIUS trajectory exit cap | NOT_WIRED | [STATIC] |

**Result:** Steps 1–3 are fully functional infrastructure. Steps 4a–8 are NOT_WIRED or
PARTIALLY_WIRED only. A 300-unit multifamily delivery reaches `event_forecasts` correctly
but then has no programmatic effect on any underwriting assumption.

---

## Section 5 — Phase 0c: Duplicate Injection Check

**Finding: NO duplicate injection detected.**

All reads of `key_events`, `event_forecasts`, and `event_playbooks` across all module files
were enumerated. Confirmed read sites:

| File | Read type | Purpose |
|---|---|---|
| `m35-forecast.service.ts:217–400` | `event_forecasts` INSERT | Write-side; not a consumer |
| `proforma.routes.ts:70–122` | `event_forecasts` SELECT | M09 annotation (display) |
| `m08-strategies.service.ts:629–648` | `event_forecasts JOIN key_events` | M08 narrative |
| `jedi-score.service.ts:800–874` | `event_forecasts` SELECT | M25 demand weight override |
| `m35-forecast-consumer.ts:1–135` | Kafka-triggered — calls M08 bust + JEDI recompute | Infrastructure bus |
| `m35-traffic-api.service.ts:1–414` | `key_events`, `event_type_treatments`, `event_playbooks` | M07 API contract — **never called** |
| `fetch_m35_event_forecast.ts:92–130` | `demand_events` | CA tool — MISCLASSIFIED (wrong schema) |
| `correlationEngine.service.ts` | No M35 reads | Confirmed absent |

**Analysis:**
- M08 and M25 both receive a trigger from the Kafka consumer but compute independent
  quantities (M08: narrative text; M25: demand weight). No overlap.
- `proforma.routes.ts` and `m08-strategies.service.ts` both query `event_forecasts` but
  for different purposes (display vs. narrative). No overlapping injection into the same
  downstream value.
- M03 reading `multifamily_permit` (if wired) would be explicitly sanctioned per spec §3.3
  and is not a duplicate of M07's M07-primary channel read.
- `m35-traffic-api.service.ts` reads `key_events` but is **never called** — no live injection.

**Causal Discipline Invariant A status:** Not violated. Multi-channel subtypes
(`major_relocation_announcement`, `regional_shock`) have explicitly declared independent
pathways that affect non-overlapping outputs. No case found where two modules apply
conflicting mutations to the same assumption via separate M35 reads.

---

## Section 6 — Phase 0d: Cause / Symptom Separation

**Separation is CORRECTLY IMPLEMENTED in `causal-discipline-engine.ts`.**

`CAUSE_METRICS` at lines 143–157 (13 entries):
- Demand causes: `employer_concentration`, `in_migration_trend`, `demographic_projection`,
  `wage_growth_trend`, `transportation_infra`
- Supply causes: `delivery_pipeline`, `permit_trend`, `demolition_rate`, `conversion_rate`,
  `regulatory_supply_effect`
- Macro causes: `rate_trend`, `recession_probability`, `capital_flow_trend`

`SYMPTOM_METRICS` at lines 159–175 (15 entries):
- Demand symptoms: `C_SURGE_INDEX`, `C_TPI`, `C_TVS`, `search_volume_momentum`,
  `lead_volume`, `application_volume`, `days_to_lease`, `social_sentiment`
- Supply symptoms: `concession_trends`, `days_on_market`, `comp_absorption_rate`,
  `lease_up_velocity`
- Macro symptoms: `transaction_volume`, `cap_rate_movement`, `sentiment_score`

**Multiplicative composition verified:**
`computeSubScore()` at line 422:
```
Score = expectedStrength × validation_factor
where validation_factor ∈ [V_FLOOR=0.70, V_CEILING=1.30]
```
`expectedStrength` is derived from cause metrics; `validation_factor` from symptom
observations. No cause metric doubles as a symptom input in the same sub-score. Invariant B
is structurally enforced.

**Additive failure mode identified (CS-01):**
`employer_concentration` is the primary demand cause metric but has no programmatic data
source from `event_forecasts`. The caller of `scoreDeal()` is expected to supply a
pre-computed `employer_concentration` float. The pipeline that should derive this float
from `event_forecasts.point_estimate WHERE metric_key='employment_demand'` is not
implemented. The cause-input slot exists but is fed by a static snapshot value rather
than an M35-driven computation. This produces a *consistent* (non-additive) failure —
the composition algebra is correct, but the input is stale.

---

## Section 7 — Phase 0e: Timing Catalog

For every WIRED or PARTIALLY_WIRED pathway from Section 3.

| Pathway | Trigger type | Window_months read | Decay shape | Lead time | Refresh trigger | TIMING_GAP |
|---|---|---|---|---|---|---|
| **M25 JEDI — employment subtypes (WIRED)** | Kafka `M35_FORECAST_CREATED` → `jedi-score.service.ts:calculateAndSave()` | 12 (stable estimate — `getM35CategoryOverrides()` selects first matching row) | None — override replaces base weight directly; no temporal decay | Real-time post-forecast generation | Per Kafka event, once per MSA batch (concurrency=10) | No decay on older events; a stale 12-month-old employment event holds the same weight as a fresh one |
| **M25 JEDI — demographic subtypes (WIRED)** | Same Kafka chain | `search_growth` metric — window_months not explicitly filtered; first active forecast row selected | None | Real-time | Per Kafka event | Same as above; no announcement vs materialization trigger differentiation |
| **M08 Narrative (PW)** | Kafka `M35_FORECAST_CREATED` → bust `m08Cache` → re-fetch on next API request | ≤ 24 months preferred (narrative reads recent windows first) | None — narrative includes all active events regardless of age | Real-time cache bust; narrative populated on next request | Per Kafka event + per-request cache miss | TIMING_GAP: no distinction between announcement and materialization — a `status='announced'` event generates the same narrative as `status='materialized'` |
| **M09 Annotation — rent_control_passage, tax_abatement (PW)** | Per GET request to `proforma.routes.ts` | Any active `window_months` from `event_forecasts` | None | Per-request | Per-request (no cache) | TIMING_GAP: no temporal weight applied; a 36-month-old forecast point and a 3-month-old one are presented identically in the annotation |
| **M25 JEDI — PW path (major_relocation_announcement)** | Kafka chain (same as employment) | 12 months (via employment category mapping, conditional) | None | Real-time (conditional) | Per Kafka event (conditional) | TIMING_GAP: wires only if `key_events.category` matches EMPLOYMENT/TECHNOLOGY_INDUSTRY at ingestion; no retry if category was misassigned |

**M35 forecast window vs LIUS hold-year mismatch:**
M35 forecasts use windows `{3, 12, 24, 36}` months. LIUS projects in annual Year 1–10
increments. Bridging M35 into LIUS requires a mapping of `window_months` to hold-year
index (e.g., `window_months=12` → Year 1, `window_months=24` → Year 2). No such bridge
exists. This timing gap affects all proposed LIUS wiring fixes (EP-03, Section 11).

---

## Section 8 — Phase 0f: Supply/Demand Formula Audit

Four formulas audited; each classified EVENT-AWARE or EVENT-BLIND and walked through
a 300-unit `multifamily_delivery` synthetic example.

**Note on task-cited line reference:** The task spec cited `m35-backtest.service.ts:746–781`
for formula (b). The file is 633 lines (verified: `wc -l` = 633). The referenced lines
do not exist. The relevant backtest accuracy formula is at lines 218–257 (pct_error
computation) and lines 195–215 (CI hit-rate and widening). This discrepancy is recorded
here per Supplementary E protocol.

---

### Formula A — Jobs→Rent/Absorption Scaling (`m35-playbook.service.ts:608–625`)

**Classification:** `EVENT-AWARE`

```
rentBaseline       = jobCount × 0.0002 × wageMult × msaAtten
absorptionBaseline = jobCount × 0.0001 × wageMult × msaAtten

wageMult  = 1.4 if (event.wageLevel / event.areaMedWage > 1.5) else 1.0
msaAtten  = 0.70 (large MSA) | 1.40 (small MSA) | 1.00 (mid MSA)
```

**300-unit multifamily_delivery walkthrough:**
This formula applies to job-count events (`employer_expansion`, `major_relocation_announcement`).
For `multifamily_delivery`, the event has no `wageLevel`/`areaMedWage` fields — it falls
through to the non-jobs path at line 648:
```
scaleFactor = msaAtten × wageMult = 1.0 × 1.0 = 1.0  (mid MSA, no wage data)
point_estimate = playbook.median_delta × scaleFactor
```
For a `multifamily_delivery` playbook with `median_delta = −0.008` (−0.8pp rent growth
deceleration at 12 months), the scaled forecast = −0.008 × 1.0 = **−0.8pp**.

Formula is EVENT-AWARE — it reads event attributes from `key_events` (via `ev.magnitudeValue`,
`ev.wageLevel`) and scales the playbook median accordingly. Additive (not multiplicative) on
the playbook median — comment at line 619 explicitly prevents double-counting.

---

### Formula B — Backtest Accuracy (`m35-backtest.service.ts:218–257`)

**Classification:** `EVENT-AWARE`

```
pct_error = (forecast.point_estimate − actual.observed_value) / |actual.observed_value|
bias_direction = ALL(pct_error > 0) → 'over' | ALL(pct_error < 0) → 'under'
regime_shift fires when last REGIME_WINDOW rows all share same sign
  AND each |pct_error| > stdDev(sample)
```

CI widening formula (lines 195–215):
```
p25_new = median_delta − min((p75−p25) × CI_WIDEN_FACTOR / 2, |median_delta| × CI_WIDEN_MAX_HALF)
p75_new = median_delta + min(…)
```

**300-unit multifamily_delivery walkthrough:**
If the M35 playbook forecasts `deliveries=320 units` at `window_months=12` and actual
deliveries land at `280 units`:
```
pct_error = (320 − 280) / 280 = +0.143 (14.3% over-forecast)
```
After `REGIME_WINDOW` consecutive positive `pct_error` rows, a regime shift alert fires
and `event_playbooks` CIs widen subtype-wide. The formula is EVENT-AWARE — it reads
actual outcomes from `playbook_backtest_results` and feeds back to CI width in `event_playbooks`.

**Caveat:** This formula only fires for subtypes that have active playbook rows AND
historical outcomes already recorded. For a first-ever `multifamily_delivery` event in a
new submarket, `playbook_backtest_results` will be empty and the formula is dormant.

---

### Formula C — JEDI Supply Step-Down (`jedi-score.service.ts:269–291`)

**Classification:** `EVENT-BLIND`

```sql
SELECT SUM((ne.extracted_data->>'unit_count')::INTEGER) as total_units
FROM news_events ne JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
WHERE taei.deal_id = $dealId
  AND ne.event_category = 'development'
  AND ne.event_type LIKE '%permit%'
  AND ne.published_at > NOW() - INTERVAL '12 months'
```
```
pipelineUnits = supply.total_units || 0

if (pipelineUnits === 0)    baseScore = 60.0
if (pipelineUnits < 200)   baseScore = 55.0
if (pipelineUnits < 500)   baseScore = 50.0
if (pipelineUnits < 1000)  baseScore = 45.0
else                        baseScore = 40.0
```

**300-unit multifamily_delivery walkthrough:**
The 300-unit delivery event lives in `key_events`. This formula queries `news_events`
(editorial news). The 300 units are **not counted**.
```
pipelineUnits = 0  →  baseScore = 60.0  (maximum supply score)
```
The submarket appears supply-unconstrained to JEDI. If the same 300 units appeared as a
`news_events` record with `event_type LIKE '%permit%'`, `baseScore` would drop to 50.0
(a 10-point swing, from max to mid-range). The M35 canonical record is invisible.

**This formula is EVENT-BLIND.** Fixing EP-07 (Section 11) would add a secondary query
against `event_forecasts JOIN key_events` to supplement `pipelineUnits`.

---

### Formula D — Exit Cap Trajectory (`trajectory-engine.ts:84–87`)

**Classification:** `EVENT-BLIND`

```typescript
exit_cap_trajectory: -0.0025,  // cap rate compression baseline

function resolveGrowthRate(driver: string): number {
  // resolves named constants → numeric rates
  // 'exit_cap_trajectory' → returns the constant −0.0025
```

**300-unit multifamily_delivery walkthrough:**
```
exit_cap_trajectory = −0.0025  (unchanged regardless of supply event)
```
The 300-unit delivery adds competitive supply that would, in a market-clearing model,
apply upward pressure on exit cap rates (cap rate expansion = lower exit value). Under
this formula, exit cap rate trajectory stays at −0.0025 (cap rate compression) regardless
of the competing delivery.

**Magnitude inconsistency vs Formula A:** Formula A models a −0.8pp rent growth
deceleration from 300 delivered units. Formula D applies a −0.25pp/year cap rate
compression with no correction for supply additions. These two formulas have inconsistent
assumptions about the supply effect on cap rates — Formula A acknowledges supply headwinds
in rent growth but Formula D ignores them in exit cap pricing.

**This formula is EVENT-BLIND.** Fixing EP-03 (Section 11) resolves this inconsistency.

---

## Section 9 — Phase 0g: Correlation Engine Overlap

**Finding: ZERO overlap confirmed. No COR reads `event_forecasts` or `event_playbooks`.**

### COR-06 — Pipeline % vs Rent Growth

`computeCOR06()` at `correlationEngine.service.ts:1157–1200`:
```typescript
const supplyPressure = snapshot?.supply_pressure;
// supply_pressure: 'low' | 'moderate' | 'high' from MarketSnapshot
```
Reads `snapshot.supply_pressure` — a categorical field from the `market_snapshots` table,
**not** from `event_forecasts`. An active `multifamily_delivery` event can only affect
`supply_pressure` after flowing through a market snapshot update pipeline — no direct
M35 read exists. COR-06 is EVENT-BLIND for M35 purposes.

`xValue` is always `null` (no numeric pipeline percentage computed from live data).
`confidence` is `'low'` when `supplyPressure` is present, `'insufficient'` otherwise.
COR-06 produces categorical signals (`bullish`/`neutral`/`bearish`) — no delta_pct that
could be amplified or contradicted by a simultaneous M35 event delivery forecast.

**No interaction risk.** However, there is a semantic gap: an active `multifamily_delivery`
M35 event in the same submarket would indicate a delivery about to change supply_pressure,
but COR-06 would not reflect this until the snapshot is refreshed.

### COR-19 — Maintenance Sentiment vs NOI Margin

`computeCOR19()` at line 1596: fully stub. `xValue=null, yValue=null, correlation=null,
confidence='insufficient'`. Missing data: NLP review analysis, P&L statements. No M35
interaction possible; no delta_pct to amplify.

### COR-20 — Digital-Physical Gap vs Price per Unit

`computeCOR20()` at line 1614: fully stub. `xValue=null, yValue=null, correlation=null,
confidence='insufficient'`. Missing data: SpyFu domain data, FDOT AADT, Transaction deed
records. No M35 interaction possible.

### Global Correlation Engine Assessment

The correlation engine (`correlationEngine.service.ts`) computes metric cross-correlations
from `market_snapshots` and `metric_time_series` — market fundamentals (vacancy, rent
growth, absorption, cap rates). It does not read `key_events`, `event_forecasts`, or
`event_playbooks` anywhere in the file (grep confirmed — zero hits).

**Implication:** The correlation engine cannot distinguish whether a measured correlation
spike between `employment_growth` and `rent_growth` is caused by a known M35 employer
event or organic market movement. No causal attribution from M35 to COR signals exists
today. This is a gap (CE-01) but not a duplicate-injection risk.

---

## Section 10 — Finding Inventory

| ID | Description | Type | Priority | Effort |
|---|---|---|---|---|
| **EP-01** | M07 Traffic Engine NOT_WIRED for all 10 M07-primary subtypes — `m35TrafficApiService` (414 lines, fully implemented) is never imported by `trafficPredictionEngine.ts` or `trafficCalibrationJob.ts` | Event Propagation | **P0** | M |
| **EP-02** | Cashflow Agent MISCLASSIFIED for all 16 subtypes — `fetch_m35_event_forecast.ts:112` queries `demand_events` (legacy schema) instead of `key_events`/`event_forecasts`; fails silently when legacy table is empty | Event Propagation | **P0** | S |
| **EP-03** | LIUS trajectory NOT_WIRED for all subtypes — `exit_cap_trajectory: −0.0025` hardcoded at `trajectory-engine.ts:84`; `leaseUpAbsorption.yaml` Year 1 spike value is `null` with no M35 event source | Event Propagation | **P1** | M |
| **EP-04** | M09 proforma mutation NOT_WIRED for `rent_control_passage` and `tax_abatement` — `proforma-adjustment.service.ts` has zero M35 references; annotation-only path in `proforma.routes.ts` does not mutate assumptions | Event Propagation | **P1** | M |
| **EP-05** | M14 NOT_WIRED for `rate_move`, `recession_indicator`, M14 pathway of `major_relocation_announcement` and `regional_shock` — `cycle-intelligence.service.ts` and `rate-environment.service.ts` have zero M35 references | Event Propagation | **P1** | M |
| **EP-06** | M03 NOT_WIRED for `entitlement_approval`, `zoning_upzoning`, `multifamily_permit` (M03 facet) — `entitlement.service.ts` and `zoning-recommendation-orchestrator.service.ts` have zero M35 references | Event Propagation | **P2** | M |
| **EP-07** | M25 supply step-down EVENT-BLIND — `calculateSupplyScore()` reads `news_events WHERE event_type LIKE '%permit%'`; M35 `multifamily_delivery`, `multifamily_permit`, `demolition`, `conversion` events in `key_events` are invisible | Event Propagation | **P1** | S |
| **DI-01** | No duplicate injection detected — all multi-channel subtypes route to independent outputs; Kafka fan-out to M08 + M25 does not double-mutate any single assumption | Duplicate Injection | — | — |
| **CS-01** | `employer_concentration` cause metric has no programmatic data source from `event_forecasts` — caller of `scoreDeal()` supplies a pre-computed static float rather than an M35-driven value; `computeSubScore()` algebra is correct but input is stale | Cause/Symptom | **P2** | S |
| **CS-02** | `|attributedDelta|` in M25 JEDI formula strips sign from `employer_contraction` events — negative employment signal is correctly encoded via `weight.max_jedi_impact` sign separately, but the M35 override magnitude loses directionality | Cause/Symptom | **P3** | S |
| **TM-01** | No temporal decay applied to M35 events in M25 JEDI weight override — a 12-month-old employment event holds the same `effectiveBaseWeight` as a fresh one; override should decay with event age | Timing | **P2** | S |
| **TM-02** | No announcement vs materialization trigger differentiation in M08 narrative — `status='announced'` events generate same narrative urgency as `status='materialized'` events | Timing | **P3** | S |
| **TM-03** | M35 forecast windows `{3, 12, 24, 36}` months not bridged to LIUS annual hold-year projections — no `window_months → hold_year` mapping exists; required before any LIUS wiring can land | Timing | **P1** | S |
| **FA-01** | Formula C (JEDI supply step-down) EVENT-BLIND — 300-unit `multifamily_delivery` event in `key_events` scores `pipelineUnits=0`, `baseScore=60.0`; same as EP-07 | Formula Audit | **P1** | S |
| **FA-02** | Formula D (exit cap trajectory) EVENT-BLIND — hardcoded `−0.0025` ignores supply additions; inconsistent with Formula A which models rent growth deceleration from same supply event | Formula Audit | **P1** | M |
| **FA-03** | Backtest formula (Formula B) cannot fire for first-ever subtype event in a new submarket — `playbook_backtest_results` empty; CI widening and regime-shift detection dormant | Formula Audit | **P3** | L |
| **CE-01** | COR-06 reads `snapshot.supply_pressure` (categorical) not `event_forecasts` — M35 delivery events cannot reach COR-06 without a snapshot refresh pipeline; semantic lag between M35 event and COR-06 signal update | Correlation | **P2** | M |
| **CE-02** | COR-19 and COR-20 fully stubbed — `confidence='insufficient'`, all values null; no M35 interaction possible because no data exists at all | Correlation | **P3** | L |

---

## Section 11 — Phase 1 Fix Sequence

Ordered strictly by **leverage per file changed** (matrix cells flipped ÷ files touched),
descending, per Supplementary G. Cell counts use one-cell-per-(subtype, module) logic.

---

### Fix 1 — Repoint `fetch_m35_event_forecast.ts` from `demand_events` to `key_events + event_forecasts`

**Finding:** EP-02
**File:** `backend/src/agents/tools/fetch_m35_event_forecast.ts`
**Line range:** Lines 92–130 (SQL query block)

**Expected change shape:**
```typescript
// Replace:
FROM demand_events de
LEFT JOIN demand_event_types det ON det.id = de.event_type_id
LEFT JOIN trade_area_event_impacts tiea ON tiea.event_id = de.id

// With:
FROM key_events ke
LEFT JOIN event_forecasts ef ON ef.event_id = ke.id
  AND ef.status = 'active'
  AND ef.window_months = $windowMonths
WHERE ke.status NOT IN ('draft', 'cancelled')
  AND ST_DWithin(
    ST_SetSRID(ST_Point(ke.lng, ke.lat), 4326)::geography,
    ST_SetSRID(ST_Point($lng, $lat), 4326)::geography,
    $radiusMiles * 1609.34
  )

// Map columns:
impact_type      ← ke.subtype
impact_magnitude ← ef.point_estimate
confidence       ← ef.confidence
m35_available    ← true (when rows > 0)
```

Tool name, input/output schema, and agent registration unchanged.

**Matrix cells flipped:** 16 (all 16 CA MISCLASSIFIED cells → WIRED)
**Leverage:** 16 cells / 1 file = **16.0**

---

### Fix 2 — Add `window_months → hold_year` bridge + wire M35 signal into `trajectory-engine.ts`

**Finding:** EP-03, TM-03, FA-02
**Files:** `backend/src/services/lius/trajectory-engine.ts` · new utility `backend/src/services/lius/m35-bridge.ts`
**Line ranges:** `trajectory-engine.ts:84–87` (exit cap constant `−0.0025`) · `trajectory-engine.ts:generateProjections()` (Year 1 absorption spike injection site)

**Expected change shape:**
```typescript
// m35-bridge.ts (new — resolves TM-03)
export function windowToHoldYear(windowMonths: number): number {
  return Math.round(windowMonths / 12);  // 3→0(Y1), 12→1, 24→2, 36→3
}

// trajectory-engine.ts
import { m35TrafficApiService } from '../m35-traffic-api.service';
import { windowToHoldYear } from './m35-bridge';

// Replace hardcoded exit_cap_trajectory (line 84):
const pipelineSignal = await m35TrafficApiService.computeEventPipelineSignal(location);
const exitCapAdj = pipelineSignal * 0.0010;  // 100bps max swing from −1..+1 signal
// Emit rate_delta primitive on exitCapRate line item for affected hold years

// For leaseUpAbsorption Year 1 discrete_spike (currently value: null):
const deliveryEvents = await m35TrafficApiService.getActiveEvents({
  subtype: 'multifamily_delivery', submarketId: deal.submarket_id,
});
const competingUnits = deliveryEvents.reduce((s, e) => s + (e.magnitudeValue ?? 0), 0);
// Apply discrete_spike reduction proportional to competingUnits / subject.totalUnits
```

**Matrix cells flipped:** 16 (all 16 LIUS NOT_WIRED cells — one per subtype)
**Leverage:** 16 cells / 2 files = **8.0**

---

### Fix 3 — Wire `m35TrafficApiService` into `trafficPredictionEngine.ts` and `trafficCalibrationJob.ts`

**Finding:** EP-01
**Files:** `backend/src/services/trafficPredictionEngine.ts` (primary) · `backend/src/jobs/trafficCalibrationJob.ts` (secondary)
**Line ranges:** `trafficPredictionEngine.ts:11–25` (add import) · trajectory calculation section (add 6th weighted component) · `trafficCalibrationJob.ts` (add baseline exclusion window call)

**Expected change shape:**
```typescript
// trafficPredictionEngine.ts
import { m35TrafficApiService } from './m35-traffic-api.service';

// In predict():
const pipelineSignal = await m35TrafficApiService.computeEventPipelineSignal({
  submarketId: property.submarket_id,
  msaId: property.msa_id,
  horizonMonths: 18,
});
// Inject as 6th weighted component (weight: 0.15, per spec §3.1)
trajectory = (existingWeightedSum × 0.85) + (pipelineSignal × 0.15);

// trafficCalibrationJob.ts — Mechanism A: baseline exclusion
const exclusionWindows = await m35TrafficApiService.getActiveEvents({
  submarketId: submarket.id, status: ['in_progress', 'materialized'],
});
// Exclude calibration observations that fall within event materialization windows
```

**Matrix cells flipped:** 10 (all 10 M07 NOT_WIRED cells — one per M07-primary subtype)
**Leverage:** 10 cells / 2 files = **5.0**

---

### Fix 4 — Wire M09 proforma mutation for `rent_control_passage` and `tax_abatement`

**Finding:** EP-04
**File:** `backend/src/services/proforma-adjustment.service.ts`
**Line range:** Main adjustment pipeline entry point (before assumption finalization)

**Expected change shape:**
```typescript
// In proforma-adjustment.service.ts:
const rentControlEvents = await pool.query(`
  SELECT magnitude_value, materialization_date, completion_date
  FROM key_events
  WHERE subtype = 'rent_control_passage'
    AND submarket_id = $submarket
    AND status IN ('materialized')
`);
if (rentControlEvents.rows.length > 0) {
  const maxAllowedGrowth = rentControlEvents.rows[0].magnitude_value;
  // level_reset: cap rent_growth assumption at legislated maximum
  assumptions.rentGrowth = Math.min(assumptions.rentGrowth, maxAllowedGrowth);
}

// Similar block for tax_abatement → opex_property_tax time-bounded reduction
// using (completion_date − materialization_date) as abatement duration
```

**Matrix cells flipped:** 4 — `rent_control_passage × M09` and `tax_abatement × M09`
(PW → WIRED, 2 cells); `rent_control_passage × LIUS` and `tax_abatement × LIUS`
(NW → WIRED, 2 cells — if `trajectory-engine.ts` is updated in tandem with Fix 2)
**Leverage:** 4 cells / 1 file = **4.0**

---

### Fix 5 — Wire M25 supply score from `event_forecasts` for supply subtypes

**Finding:** EP-07, FA-01
**File:** `backend/src/services/jedi-score.service.ts`
**Line range:** `calculateSupplyScore():269–291`

**Expected change shape:**
```typescript
// Supplement the existing news_events query with an event_forecasts query:
const m35Supply = await pool.query(`
  SELECT SUM(ef.point_estimate) as m35_units
  FROM event_forecasts ef
  JOIN key_events ke ON ke.id = ef.event_id
  WHERE ke.subtype IN ('multifamily_delivery','multifamily_permit')
    AND ke.submarket_id = $submarket
    AND ef.metric_key IN ('deliveries','permits_issued','net_absorption_units')
    AND ef.status = 'active' AND ef.window_months = 12
`);
const m35Demolition = await pool.query(`
  SELECT SUM(ef.point_estimate) as m35_units
  FROM event_forecasts ef JOIN key_events ke ON ke.id = ef.event_id
  WHERE ke.subtype IN ('demolition','conversion')
    AND ke.submarket_id = $submarket AND ef.status = 'active' AND ef.window_months = 12
`);
// Net pipeline: existing news_events count + M35 deliveries/permits − M35 demolitions
const pipelineUnits = (supply.total_units || 0)
  + (parseFloat(m35Supply.rows[0].m35_units) || 0)
  - (parseFloat(m35Demolition.rows[0].m35_units) || 0);
```

**Matrix cells flipped:** 4 — `multifamily_delivery × M25`, `multifamily_permit × M25`,
`demolition × M25`, `conversion × M25` (all NW → WIRED)
**Leverage:** 4 cells / 1 file = **4.0**

---

### Fix 6 — Wire M03 for `entitlement_approval`, `zoning_upzoning`, `multifamily_permit`

**Finding:** EP-06
**Files:** `backend/src/services/entitlement.service.ts` · `backend/src/services/zoning-recommendation-orchestrator.service.ts`
**Line ranges:** Feasibility pipeline entry point in each file

**Expected change shape:**
```typescript
// entitlement.service.ts — competitive supply from approved entitlements + permits
const competitiveApprovals = await pool.query(`
  SELECT magnitude_value FROM key_events
  WHERE subtype IN ('entitlement_approval','multifamily_permit')
    AND submarket_id = $submarket
    AND status IN ('announced','in_progress','materialized')
`);
// Pass sum(magnitude_value) as competitive_pipeline_units to envelope calculation

// zoning-recommendation-orchestrator.service.ts — upzoning density uplift
const upzoningEvents = await pool.query(`
  SELECT magnitude_score FROM key_events
  WHERE subtype = 'zoning_upzoning' AND submarket_id = $submarket
    AND status NOT IN ('draft','cancelled')
`);
// Pass magnitude_score (FAR delta) as density_uplift_signal to HBU analysis
```

**Matrix cells flipped:** 6 — `entitlement_approval × M03`, `zoning_upzoning × M03`,
`multifamily_permit × M03` (all NW → WIRED, each counted once per subtype)
**Leverage:** 6 cells / 2 files = **3.0**

---

### Fix 7 — Wire M14 for `rate_move`, `recession_indicator`, and M14 pathways of multi-channel subtypes

**Finding:** EP-05
**Files:** `backend/src/services/debt-advisor/rate-environment.service.ts` · `backend/src/services/cycle-intelligence.service.ts`
**Line ranges:** Rate curve construction function in `rate-environment.service.ts` · Phase determination function in `cycle-intelligence.service.ts`

**Expected change shape:**
```typescript
// rate-environment.service.ts — forward overlay for announced rate moves
const rateMoveEvents = await pool.query(`
  SELECT magnitude_value, materialization_date
  FROM key_events
  WHERE subtype = 'rate_move' AND status IN ('announced','in_progress')
    AND msa_id = $msaId
  ORDER BY materialization_date
`);
// Apply magnitude_value (basis points) as forward overlay on FRED rate curve
// keyed to materialization_date

// cycle-intelligence.service.ts — recession regime override
const recessionEvents = await pool.query(`
  SELECT confidence FROM key_events
  WHERE subtype = 'recession_indicator'
    AND status IN ('announced','in_progress','materialized')
    AND msa_id = $msaId AND confidence >= 0.6
  LIMIT 1
`);
if (recessionEvents.rows.length > 0) phase = 'Contraction';
// Also apply major_relocation_announcement cap rate compression signal
// and regional_shock insurance spread in their respective sub-functions
```

**Matrix cells flipped:** 4 — `rate_move × M14`, `recession_indicator × M14`,
`major_relocation_announcement × M14` (M14 pathway), `regional_shock × M14` (M14 pathway)
**Leverage:** 4 cells / 2 files = **2.0**

---

### Fix Sequence Summary

| Rank | Fix | Finding(s) | Files | Cells flipped | Leverage |
|---|---|---|---|---|---|
| 1 | Fix 1 — CA schema repoint | EP-02 | 1 | 16 (CA: MC→WIRED) | **16.0** |
| 2 | Fix 2 — LIUS M35 bridge | EP-03, TM-03, FA-02 | 2 | 16 (LIUS: NW→WIRED) | **8.0** |
| 3 | Fix 3 — M07 wiring | EP-01 | 2 | 10 (M07: NW→WIRED) | **5.0** |
| 4 | Fix 4 — M09 mutation | EP-04 | 1 | 4 (M09: PW→WIRED) | **4.0** |
| 5 | Fix 5 — M25 supply score | EP-07, FA-01 | 1 | 4 (M25: NW→WIRED) | **4.0** |
| 6 | Fix 6 — M03 devcap | EP-06 | 2 | 6 (M03: NW→WIRED) | **3.0** |
| 7 | Fix 7 — M14 macro | EP-05 | 2 | 4 (M14: NW→WIRED) | **2.0** |

**Total cell flips if all 7 fixes land:** 64 of 66 NOT_WIRED/MISCLASSIFIED cells.
The remaining 2 are TM-01 (temporal decay on JEDI M25 weight — P2) and CS-02
(directionality loss in employer_contraction weight override — P3); both are
improvement-class findings addressed as follow-on items after the primary wiring fixes.
