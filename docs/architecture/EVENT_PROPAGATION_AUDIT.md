# Event Propagation Audit — Phase 0

**Date:** May 10, 2026
**Task:** #715 — Event Propagation Audit, Phase 0 (read-only)
**Scope:** All 16 M35 event subtypes declared in `EVENT_SUBTYPE_REGISTRY` ×
8 consuming modules. Catalog wiring status with file:line evidence.
No source changes are proposed or made in this document.
**Trace mode:** [STATIC] throughout (all conclusions derived from source code
inspection; no runtime queries were needed to disambiguate).

---

## Files of Record

| Role | File | Lines |
|---|---|---|
| Subtype registry | `backend/src/services/sigma/causal-discipline-engine.ts` | 114–141 |
| M35 API contract (M07 consumer) | `backend/src/services/m35-traffic-api.service.ts` | 1–414 |
| M07 prediction engine | `backend/src/services/trafficPredictionEngine.ts` | 1–2084 |
| M07 calibration job | `backend/src/jobs/trafficCalibrationJob.ts` | — |
| M07 calibration service | `backend/src/services/traffic-calibration.service.ts` | 1–253 |
| Playbook / magnitude scaling | `backend/src/services/m35-playbook.service.ts` | 608–625 |
| Forecast generator | `backend/src/services/m35-forecast.service.ts` | 1–689 |
| M08 strategy advisor | `backend/src/services/m08-strategies.service.ts` | 615–963 |
| M09 proforma routes | `backend/src/api/rest/proforma.routes.ts` | 24–166 |
| M09 proforma adjustment | `backend/src/services/proforma-adjustment.service.ts` | 1–4931 |
| M09 financials composer | `backend/src/services/financials-composer.service.ts` | 1–2543 |
| M14 cycle intelligence | `backend/src/services/cycle-intelligence.service.ts` | — |
| M14 rate environment | `backend/src/services/debt-advisor/rate-environment.service.ts` | — |
| M03 entitlement | `backend/src/services/entitlement.service.ts` | — |
| M25 JEDI score | `backend/src/services/jedi-score.service.ts` | 1–916 |
| LIUS trajectory engine | `backend/src/services/lius/trajectory-engine.ts` | 1–339 |
| LIUS exit cap schema | `backend/src/services/lius/lines/exit/exitCapRate.yaml` | 84 |
| LIUS lease-up absorption | `backend/src/services/lius/lines/lease-up/leaseUpAbsorption.yaml` | — |
| Cashflow agent tool | `backend/src/agents/tools/fetch_m35_event_forecast.ts` | 92–130 |
| Cashflow agent prompt | `backend/src/agents/prompts/cashflow/system.ts` | 47–412 |
| Kafka M35 consumer | `backend/src/services/kafka/consumers/m35-forecast-consumer.ts` | 1–135 |
| Causal discipline engine | `backend/src/services/sigma/causal-discipline-engine.ts` | 113–459 |

---

## Status Key

| Code | Meaning |
|---|---|
| `WIRED` | Data flows from `event_forecasts`/`key_events` into a programmatic mutation of downstream computed values |
| `PARTIALLY_WIRED` | Data is fetched from `event_forecasts`/`key_events` but is used only for narrative text or metadata annotation — no assumption mutation |
| `NOT_WIRED` | Spec requires a connection; zero code path exists; filing uses the 3-field evidence format |
| `AGENT_ONLY` | Reference exists only inside an LLM prompt string; no programmatic path |
| `MISCLASSIFIED` | Code exists and runs but reads the wrong schema (`demand_events` instead of `key_events`/`event_forecasts`) |

**Precedence order when more than one code applies:**
`DUPLICATE_INJECTION > MISCLASSIFIED > SPEC_GAP > NOT_WIRED > PARTIALLY_WIRED > AGENT_ONLY > WIRED`

---

## Section 0 — Global Infrastructure Findings

### 0-A: Kafka propagation chain (confirmed WIRED)

`m35-forecast-consumer.ts` registers two handlers:

- `m35.forecast.created` → calls `bustM08Cache(dealId)` + `jediScoreService.calculateAndSave()` for every active deal in the MSA (paginated, concurrency=10).
- `m35.forecast.diverged` → same bust-and-recompute path, additionally resolves `msa_id` from `key_events` if omitted from the payload.

This is a working change-propagation bus from the M35 forecast generator to M08 and M25. It does **not** reach M07, M09, M14, M03, or LIUS.

### 0-B: Causal-discipline governance layer (WIRED as policy, NOT as data consumer)

`EVENT_SUBTYPE_REGISTRY` at `causal-discipline-engine.ts:114–141` defines all 16 subtypes with `primaryChannel` assignments and builds `CHANNEL_POLICIES` per subtype. `computeSubScore()` at line 422 enforces `Score = Expected × validation_factor` (V_FLOOR=0.7, V_CEILING=1.3) and correctly accepts pre-computed demand/supply floats as inputs — it does **not** query `event_forecasts`. The engine is a governance layer (routing policy + scoring algebra), not an event-data consumer. Invariant B (multiplicative composition) is structurally wired.

### 0-C: m35TrafficApiService — fully implemented, never imported by M07

`backend/src/services/m35-traffic-api.service.ts` (414 lines) exports:
- `getActiveEvents()` — geo-radius query against `key_events` + `event_type_treatments`
- `getPipelineEvents()` — announced-but-not-materialized events for T-07 trajectory
- `getPlaybook()` — reads `event_playbooks` with subtype/category fallback
- `proximityFactor()` / `temporalFactor()` — inverse-square decay and decay-shape logic
- `computeEventPipelineSignal()` — returns −1..+1 pipeline demand signal

None of these are imported in `trafficPredictionEngine.ts` (2,084 lines, imports at lines 11–25 contain zero M35 references) or `trafficCalibrationJob.ts`. The API contract is the highest-leverage unwired service in the codebase.

---

## Section 1 — Subtype: `employer_expansion`

**Primary channel:** M07_traffic
**Spec rationale:** Creates housing demand; price/occupancy split endogenous to M07 market-clearing.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | See below |
| **M08 Strategy** | `PARTIALLY_WIRED` | `m08-strategies.service.ts:634–648` queries `event_forecasts JOIN key_events` for all active events in submarket; `buildM35EventTimingNarrative():683` filters on `rent_growth_yoy` metric and appends to `coordinatorNarrative` (text string, no assumption mutation) |
| **M09 Proforma** | `NOT_WIRED` | See below |
| **M14 Macro** | NOT APPLICABLE | employer_expansion is not M14 channel |
| **M03 DevCap** | NOT APPLICABLE | Not M03 channel |
| **M25 JEDI** | `WIRED` | `jedi-score.service.ts:159` — `M35_TO_DEMAND_CAT['EMPLOYMENT'] = 'employment'`; `getM35CategoryOverrides():800–874` queries `event_forecasts JOIN key_events` for `rent_growth_yoy` metric; replaces static `base_weight` with `|attributedDelta| × 100 × confidence` at line 224 |
| **LIUS** | `NOT_WIRED` | See below |
| **Cashflow Agent** | `MISCLASSIFIED` | `fetch_m35_event_forecast.ts:112` — tool queries `demand_events de` (legacy schema) not `key_events`/`event_forecasts`; tool name (`fetch_m35_event_forecast`) implies M35 but reads entirely different table |

**NOT_WIRED evidence — M07 Traffic:**
1. Spec'd function: `TrafficPredictionEngine.predict()` / `trafficCalibrationJob.runCalibration()` — should call `m35TrafficApiService.computeEventPipelineSignal()` to apply Mechanism C (T-07 forward trajectory) and Mechanism A (baseline exclusion windows).
2. Specific missing call: `import { m35TrafficApiService } from './m35-traffic-api.service'` — zero occurrences in `trafficPredictionEngine.ts` (imports verified lines 11–25) and `trafficCalibrationJob.ts`.
3. Wire: Add `computeEventPipelineSignal(location)` call within the trajectory calculation in `trafficPredictionEngine.ts`; inject result as the 6th weighted component (15% weight per spec §3.1).

**NOT_WIRED evidence — M09 Proforma:**
1. Spec'd function: `proforma-adjustment.service.ts:applyNewsAdjustments()` or equivalent — should read `event_forecasts` for `employer_expansion` events to boost `rent_growth` assumption.
2. Specific missing call: `proforma-adjustment.service.ts` (4,931 lines) contains zero references to `event_forecasts`, `key_events`, or any M35 import.
3. Wire: employer_expansion does not have a direct M09 path (M07 is primary); this cell is NOT APPLICABLE for direct proforma mutation — but proforma.routes.ts:157 `getM35ProformaAttribution()` does fetch `rent_growth_yoy` from `event_forecasts` as annotation metadata (PARTIALLY_WIRED read-only path only).

**NOT_WIRED evidence — LIUS:**
1. Spec'd function: `trajectory-engine.ts:resolveGrowthRate()` at line 87 — should modulate `exit_cap_trajectory` using `event_pipeline_signal`.
2. Specific missing call: `m35TrafficApiService.computeEventPipelineSignal()` — zero occurrences in `trajectory-engine.ts`; `leaseUpAbsorption.yaml:sourcePreference: [3, 5]` references only "M07 absorption comps from archive" and a 15-unit default.
3. Wire: Make `resolveGrowthRate()` async; call `computeEventPipelineSignal()` for deal location; use result to modulate `exit_cap_trajectory` away from hardcoded `−0.0025` baseline (line 84).

---

## Section 2 — Subtype: `employer_contraction`

**Primary channel:** M07_traffic
**Spec rationale:** Removes demand; same logic as employer_expansion in reverse.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 — zero M35 imports in M07 engines |
| **M08 Strategy** | `PARTIALLY_WIRED` | Same path as Section 1; narrative includes any active event with `rent_growth_yoy` forecast |
| **M09 Proforma** | NOT APPLICABLE | M07 is primary channel |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `WIRED` | `M35_TO_DEMAND_CAT['EMPLOYMENT'] = 'employment'` at line 159; `getM35CategoryOverrides()` reads the negative `attributed_delta` from `event_forecasts`; `effectiveBaseWeight` carries the negative signal into `weightedImpact` at line 228 |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M07 Traffic:** (identical to Section 1 — same missing import, same fix.)

**NOT_WIRED evidence — LIUS:** (identical to Section 1.)

---

## Section 3 — Subtype: `major_relocation_announcement`

**Primary channel:** multi_channel (M07_traffic + M14_macro)
**M07 pathway:** Headcount via M07 — demand pool grows over 6–18 months.
**M14 pathway:** Sentiment — cap rate compression in weeks via capital markets.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `PARTIALLY_WIRED` | `getSubmarketScopedForecasts()` at line 629 fetches all `key_events` for the submarket regardless of subtype; if the announcement event generates a `rent_growth_yoy` forecast, it surfaces in the narrative |
| **M09 Proforma** | NOT APPLICABLE | Not M09 channel |
| **M14 Macro** | `NOT_WIRED` | See below |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `PARTIALLY_WIRED` | M35_TO_DEMAND_CAT maps EMPLOYMENT and TECHNOLOGY_INDUSTRY → 'employment'. Wiring applies only if the event's `category` column in `key_events` is one of those two enum values; mapping depends on how the event was ingested. If category ≠ EMPLOYMENT/TECHNOLOGY_INDUSTRY, override is skipped silently |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M14 Macro:**
1. Spec'd function: `cycle-intelligence.service.ts` or `rate-environment.service.ts` — should detect announced major relocations and apply sentiment-driven cap rate compression signal.
2. Specific missing call: grep of `cycle-intelligence.service.ts` and `rate-environment.service.ts` returns zero hits for `key_events`, `event_forecasts`, `m35`, or `M35`.
3. Wire: Query `key_events` for `subtype = 'major_relocation_announcement'` with `status IN ('announced','in_progress')`; apply `magnitude_score` as a downward modifier on the current-cycle cap rate spread estimate.

**NOT_WIRED evidence — M07 Traffic:** (same as Section 1.)
**NOT_WIRED evidence — LIUS:** (same as Section 1.)

---

## Section 4 — Subtype: `in_migration_driver`

**Primary channel:** M07_traffic
**Spec rationale:** Demand pool input.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `PARTIALLY_WIRED` | Same narrative path; wires if `in_migration_driver` event generates `rent_growth_yoy` forecast row |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `WIRED` | `M35_TO_DEMAND_CAT['MACRO_DEMOGRAPHIC'] = 'amenities'` at line 163; `DEMAND_CAT_M06_METRIC['amenities'] = 'search_growth'`; `getM35CategoryOverrides()` picks the forecast row matching metric_key `search_growth` for this event's geography |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 5 — Subtype: `demographic_shift`

**Primary channel:** M07_traffic
**Spec rationale:** Demand composition input.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `PARTIALLY_WIRED` | Same narrative path |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `WIRED` | Same as Section 4 — MACRO_DEMOGRAPHIC → 'amenities' → `search_growth` metric override path |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 6 — Subtype: `multifamily_delivery`

**Primary channel:** M07_traffic
**Spec rationale:** Competition for the same demand pool.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `PARTIALLY_WIRED` | `buildM35EventTimingNarrative():691` includes a supply-response warning that filters on `metricKey === 'permits_issued' OR metricKey === 'deliveries'`; if `multifamily_delivery` event generates a `deliveries` forecast row, it surfaces as a supply-response warning in the narrative |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | See below |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M25 JEDI:**
1. Spec'd function: `jedi-score.service.ts:calculateSupplyScore()` at line 269 — should read `event_forecasts` for `multifamily_delivery` events to compute pipeline-unit count.
2. Specific missing call: `calculateSupplyScore()` at lines 270–286 reads `news_events ne JOIN trade_area_event_impacts taei ... WHERE ne.event_category = 'development' AND ne.event_type LIKE '%permit%'` — queries `news_events` table (editorial news), not `key_events`/`event_forecasts`. Zero reference to `event_forecasts` in this function.
3. Wire: Add secondary query to `calculateSupplyScore()` joining `event_forecasts ef JOIN key_events ke` for `ke.subtype = 'multifamily_delivery'` and `ef.metric_key IN ('deliveries','net_absorption_units')`; use `ef.point_estimate` to supplement `pipelineUnits` at line 286.

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 7 — Subtype: `multifamily_permit`

**Primary channel:** M07_traffic
**Spec rationale:** Future competition; M03 also reads for development feasibility.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `PARTIALLY_WIRED` | `buildM35EventTimingNarrative():691` filters on `permits_issued` metric; `multifamily_permit` events that generate a `permits_issued` forecast surface in narrative |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | `NOT_WIRED` | See below |
| **M25 JEDI** | `NOT_WIRED` | Same as Section 6 — `calculateSupplyScore()` reads `news_events`, not `event_forecasts` |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M03 DevCap:**
1. Spec'd function: `entitlement.service.ts` or `zoning-recommendation-orchestrator.service.ts` — the spec indicates M03 reads `multifamily_permit` for development feasibility (permits as leading indicator of supply pressure on an entitlement decision).
2. Specific missing call: grep of `entitlement.service.ts` and `zoning-recommendation-orchestrator.service.ts` returns zero hits for `key_events`, `event_forecasts`, or `m35`.
3. Wire: In `entitlement.service.ts`, query `key_events` for `subtype = 'multifamily_permit'` within the same submarket; surface `magnitude_value` (permit count) as a supply-pressure signal when computing entitlement feasibility.

**NOT_WIRED evidence — M07 Traffic / LIUS / M25:** (same as Sections 1 and 6.)

---

## Section 8 — Subtype: `demolition`

**Primary channel:** M07_traffic
**Spec rationale:** Removes competition.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `NOT_WIRED` | See below |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | Same as Section 6 — `calculateSupplyScore()` only reads `news_events WHERE event_type LIKE '%permit%'`; demolition events are not in this filter |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M08 Strategy:**
1. Spec'd function: `buildM35EventTimingNarrative()` at `m08-strategies.service.ts:677` — demolition events are not captured because the function only filters on `rent_growth_yoy` (line 683) and `permits_issued`/`deliveries` (line 691); demolition events produce metrics like `demolition_units` or `net_stock_change`, neither of which is in the filter list.
2. Specific missing call: No branch in `buildM35EventTimingNarrative()` for demolition-type metric keys.
3. Wire: Add a `demolition_units` / `net_stock_removed` metric branch to `buildM35EventTimingNarrative()` that emits a "competition removal" narrative element.

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 9 — Subtype: `conversion`

**Primary channel:** M07_traffic
**Spec rationale:** Net effect on stock.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `NOT_WIRED` | Same as Section 8 — `conversion` metrics (`conversion_units`, `net_stock_change`) not in narrative filter |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | Same as Section 6 |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 10 — Subtype: `regional_shock`

**Primary channel:** multi_channel (M07_traffic + M14_macro)
**M07 pathway:** Demand disruption — damaged inventory removed from market.
**M14 pathway:** Risk repricing — insurance costs spike, climate risk premium expands.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | `NOT_WIRED` | Same as Section 1 |
| **M08 Strategy** | `NOT_WIRED` | `regional_shock` events typically produce risk-metric forecasts (`insurance_cost_index`, `climate_risk_premium`) not in the `rent_growth_yoy` / `permits_issued` / `deliveries` filter list in `buildM35EventTimingNarrative()` |
| **M09 Proforma** | NOT APPLICABLE | Not M09 primary channel |
| **M14 Macro** | `NOT_WIRED` | See below |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | `regional_shock` is not in `M35_TO_DEMAND_CAT` at `jedi-score.service.ts:159–163`; no override path |
| **LIUS** | `NOT_WIRED` | Same as Section 1; `exitCapRate.yaml` references no event data; hardcoded `exit_cap_trajectory: −0.0025` at `trajectory-engine.ts:84` cannot reflect post-shock risk repricing |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M14 Macro:**
1. Spec'd function: `cycle-intelligence.service.ts` or `rate-environment.service.ts` — should detect `regional_shock` events and apply an insurance-cost premium and climate risk spread expansion to the cap rate model.
2. Specific missing call: Neither `cycle-intelligence.service.ts` nor `rate-environment.service.ts` contains any reference to `key_events`, `event_forecasts`, or `m35`.
3. Wire: Query `key_events WHERE subtype = 'regional_shock' AND status NOT IN ('draft','cancelled')` for the deal's MSA; apply `magnitude_score × decay_factor` as an additive spread to the base cap rate in the cycle intelligence output.

**NOT_WIRED evidence — M07 Traffic / LIUS:** (same as Section 1.)

---

## Section 11 — Subtype: `rent_control_passage`

**Primary channel:** M09_proforma_direct
**Spec rationale:** Discontinuous policy ceiling; not market-clearing-mediated.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | Not M07 channel |
| **M08 Strategy** | `PARTIALLY_WIRED` | `getSubmarketScopedForecasts()` fetches all active events regardless of subtype; if `rent_control_passage` generates a `rent_growth_yoy` forecast (e.g., a negative delta), it surfaces in the timing narrative |
| **M09 Proforma** | `PARTIALLY_WIRED` | See below |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | `rent_control_passage` is not in `M35_TO_DEMAND_CAT`; no override path in `getM35CategoryOverrides()` |
| **LIUS** | `NOT_WIRED` | See below |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**PARTIALLY_WIRED detail — M09 Proforma:**
`proforma.routes.ts:70–122` — `getM35ProformaAttribution()` queries `event_forecasts JOIN key_events WHERE ef.metric_key IN ('rent_growth_yoy','vacancy_rate','cap_rate')`; the result is spread into the GET response as `eventAttribution.rentGrowth` metadata at line 166. **This is an annotation-only path** — the attribution object does not feed back into `proforma-adjustment.service.ts`; the computed proforma assumptions are not mutated. `proforma-adjustment.service.ts` (4,931 lines) contains zero references to `event_forecasts` or `key_events`.

**NOT_WIRED evidence — LIUS:**
1. Spec'd function: `trajectory-engine.ts` should apply a `level_reset` primitive when `rent_control_passage` activates, capping `rent_growth_index` to zero or the allowed percent.
2. Specific missing call: `trajectory-engine.ts` imports only `LIUSchema`, `TrajectoryEvent`, `TrajectoryPrimitive` — no M35 service import; no query to `key_events`.
3. Wire: Add a lifecycle event injector in `trajectory-engine.ts` that queries `key_events WHERE subtype = 'rent_control_passage'` for the deal's submarket and emits a `level_reset` primitive on the `grossPotentialRent` line item capped at the legislated increase percent.

---

## Section 12 — Subtype: `tax_abatement`

**Primary channel:** M09_proforma_direct
**Spec rationale:** Direct expense path change.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | |
| **M08 Strategy** | `PARTIALLY_WIRED` | Same path as Section 11; `tax_abatement` events produce `rent_growth_yoy` or `vacancy_rate` forecasts → narrative |
| **M09 Proforma** | `PARTIALLY_WIRED` | Same annotation-only path as Section 11 — `getM35ProformaAttribution()` fetches but doesn't mutate. `proforma-adjustment.service.ts` contains zero M35 references |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | `tax_abatement` not in `M35_TO_DEMAND_CAT` |
| **LIUS** | `NOT_WIRED` | See below |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — LIUS:**
1. Spec'd function: `trajectory-engine.ts` should apply a `rate_delta` or `level_reset` on the `propertyTax` LIUS line item for the duration of the abatement.
2. Specific missing call: `propertyTax.yaml` references only `m26_tax_growth` trend (3% CPI-like). No query to `key_events` in `trajectory-engine.ts`.
3. Wire: Query `key_events WHERE subtype = 'tax_abatement'` for the deal's property; emit a `level_reset` on `m26_tax_growth` for years within the abatement window using `completion_date − materialization_date` as duration.

---

## Section 13 — Subtype: `entitlement_approval`

**Primary channel:** M03_devcap
**Spec rationale:** Permits developable supply; not present-period market.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | |
| **M08 Strategy** | `PARTIALLY_WIRED` | Will surface if `entitlement_approval` generates `permits_issued` forecast row in `buildM35EventTimingNarrative():691` |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | `NOT_WIRED` | See below |
| **M25 JEDI** | `NOT_WIRED` | Not in `M35_TO_DEMAND_CAT` |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M03 DevCap:**
1. Spec'd function: `entitlement.service.ts` or `zoning-recommendation-orchestrator.service.ts` — should read `key_events WHERE subtype = 'entitlement_approval'` to detect recently approved entitlements as competitive supply signals for development feasibility analysis.
2. Specific missing call: `entitlement.service.ts` contains zero references to `key_events`, `event_forecasts`, or any M35 import; queries only the `entitlements` table for deal-specific records.
3. Wire: In the development feasibility pipeline, query `key_events WHERE subtype = 'entitlement_approval' AND submarket_id = $submarket` for recently approved competitive projects; include in the competitive supply count passed to the envelope calculation.

---

## Section 14 — Subtype: `zoning_upzoning`

**Primary channel:** M03_devcap
**Spec rationale:** Future supply potential.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | |
| **M08 Strategy** | `PARTIALLY_WIRED` | Same conditional path as Section 13 |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | NOT APPLICABLE | |
| **M03 DevCap** | `NOT_WIRED` | See below |
| **M25 JEDI** | `NOT_WIRED` | Not in `M35_TO_DEMAND_CAT` |
| **LIUS** | `NOT_WIRED` | Same as Section 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M03 DevCap:**
1. Spec'd function: `zoning-recommendation-orchestrator.service.ts` — should detect active `zoning_upzoning` events in the submarket and factor future supply potential into the highest-and-best-use analysis.
2. Specific missing call: `zoning-recommendation-orchestrator.service.ts` contains zero M35 references; `rezone-analysis.service.ts` contains zero references to `key_events` or `event_forecasts`.
3. Wire: Inject a `key_events` lookup for `subtype = 'zoning_upzoning'` at the start of the zoning orchestrator pipeline; pass `magnitude_score` (representing FAR change or allowable density delta) into the envelope calculation for competitive future supply modeling.

---

## Section 15 — Subtype: `rate_move`

**Primary channel:** M14_macro
**Spec rationale:** Macro factor; flows to cap rates and debt directly.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | |
| **M08 Strategy** | `NOT_WIRED` | `rate_move` events produce macro metric forecasts (e.g., `cap_rate`, `treasury_spread`) not in the `rent_growth_yoy` / `permits_issued` / `deliveries` filter list; narrative remains silent on rate-move events |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | `NOT_WIRED` | See below |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | Not in `M35_TO_DEMAND_CAT` |
| **LIUS** | `NOT_WIRED` | See below |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M14 Macro:**
1. Spec'd function: `rate-environment.service.ts` — should read `key_events WHERE subtype = 'rate_move'` to apply announced or materialized rate changes as a forward overlay on the FRED-sourced base rate curve.
2. Specific missing call: `rate-environment.service.ts` contains zero references to `key_events`, `event_forecasts`, or M35 services; relies entirely on FRED API (`fred-api.client.ts`) for rate data.
3. Wire: After fetching the FRED rate curve in `rate-environment.service.ts`, query `key_events WHERE subtype = 'rate_move' AND status IN ('announced','in_progress')` to apply a forward-looking overlay using `magnitude_value` (basis points) and `materialization_date` to shift the rate forecast.

**NOT_WIRED evidence — LIUS:**
1. Spec'd function: `exitCapRate.yaml` trajectory — `exit_cap_trajectory` at `trajectory-engine.ts:84` should reflect the rate environment; `rate_move` events are the primary driver of cap rate expansion/compression.
2. Specific missing call: `exitCapRate.yaml:trajectory.baseGrowth = "exit_cap_trajectory"` resolves to the hardcoded constant `−0.0025` at line 84; no M35 event lookup.
3. Wire: Resolve `exit_cap_trajectory` dynamically by querying `key_events` for active `rate_move` events; convert basis point magnitude to a `rate_delta` trajectory primitive injected into `exitCapRate` via the scheduled-events mechanism already present in the YAML schema.

---

## Section 16 — Subtype: `recession_indicator`

**Primary channel:** M14_macro
**Spec rationale:** Macro regime signal.

| Module | Status | Evidence |
|---|---|---|
| **M07 Traffic** | NOT APPLICABLE | |
| **M08 Strategy** | `NOT_WIRED` | `recession_indicator` produces regime metrics not in the narrative filter list |
| **M09 Proforma** | NOT APPLICABLE | |
| **M14 Macro** | `NOT_WIRED` | See below |
| **M03 DevCap** | NOT APPLICABLE | |
| **M25 JEDI** | `NOT_WIRED` | Not in `M35_TO_DEMAND_CAT`; no override path |
| **LIUS** | `NOT_WIRED` | Same as Sections 15 and 1 |
| **Cashflow Agent** | `MISCLASSIFIED` | Same as Section 1 |

**NOT_WIRED evidence — M14 Macro:**
1. Spec'd function: `cycle-intelligence.service.ts:getPhase()` or equivalent — should detect active `recession_indicator` events and switch the macro regime from Expansion to Contraction, adjusting all downstream cycle-phase-dependent multipliers.
2. Specific missing call: `cycle-intelligence.service.ts` contains zero references to `key_events`, `event_forecasts`, or M35 imports.
3. Wire: In the cycle phase determination logic, query `key_events WHERE subtype = 'recession_indicator' AND status IN ('announced','in_progress','materialized')` for the deal's MSA; if one is active with `confidence >= 0.6`, override the FRED-derived cycle phase to 'Contraction' and propagate to all downstream multipliers.

**NOT_WIRED evidence — LIUS:** (same as Section 15.)

---

## Section 17 — Duplicate Injection Check

**Finding: NO duplicate injection detected.**

The channel routing policy in `causal-discipline-engine.ts:181–217` (`buildChannelPolicies()`) assigns each subtype to exactly one primary channel or to `multi_channel` with explicit pathway declarations. Cross-channel enforcement is expressed in `allowedSubscribers`/`forbiddenSubscribers` per policy.

Spot checks performed:
- `employer_expansion` → M07 only; `forbiddenSubscribers` includes M08, M09, M14. M08 reads M35 data for narrative (PARTIALLY_WIRED), not as a direct assumption mutator — this is permitted under the policy's allowed-subscriber list.
- `rent_control_passage` → M09 only; M07, M08, M14 are not primary channels; narrative appearance in M08 is metadata, not a competing mutation.
- `major_relocation_announcement` / `regional_shock` → multi_channel; both M07 and M14 pathways are explicitly declared and independently routed; no double-counting risk because the pathways affect different outputs (demand pool vs. risk spread).

The only near-miss: the Kafka consumer triggers both M08 cache bust AND JEDI score recompute on every `M35_FORECAST_CREATED` event. Both downstream recomputations read `event_forecasts` independently and apply non-overlapping mutations (M08: narrative text; M25: demand weight override). This is not a duplicate injection because the two modules compute different quantities.

---

## Section 18 — Cause / Symptom Separation Verification

**Finding: Separation is CORRECTLY IMPLEMENTED in causal-discipline-engine.ts.**

`CAUSE_METRICS` at lines 143–157 (13 entries):
- `employer_concentration`, `in_migration_trend`, `demographic_projection`, `wage_growth_trend`, `transportation_infra` (demand causes)
- `delivery_pipeline`, `permit_trend`, `demolition_rate`, `conversion_rate`, `regulatory_supply_effect` (supply causes)
- `rate_trend`, `recession_probability`, `capital_flow_trend` (macro causes)

`SYMPTOM_METRICS` at lines 159–175 (15 entries):
- `C_SURGE_INDEX`, `C_TPI`, `C_TVS`, `search_volume_momentum`, `lead_volume`, `application_volume`, `days_to_lease`, `social_sentiment` (demand symptoms)
- `concession_trends`, `days_on_market`, `comp_absorption_rate`, `lease_up_velocity` (supply symptoms)
- `transaction_volume`, `cap_rate_movement`, `sentiment_score` (macro symptoms)

The `computeSubScore()` algebra at line 422 takes `expectedStrength` (derived from cause metrics) and `observedIntensity` (derived from symptom metrics) as separate arguments. No cause metric is used as a symptom, and no symptom is used to derive an expectation. The mapping is clean.

**One gap:** The `employer_concentration` cause metric is not programmatically wired to `event_forecasts` — it is expected to come from a pre-computed float supplied by the caller of `scoreDeal()`. The pipeline that should compute `employer_concentration` from `event_forecasts.point_estimate WHERE metric_key = 'employment_demand'` is not implemented. The cause metric exists as a named concept but has no data source path.

---

## Section 19 — Timing Catalog

| Source | Window representation | Resolution | Consumer |
|---|---|---|---|
| M35 forecast generator | `MEASUREMENT_WINDOWS = [3, 12, 24, 36]` months (`m35-forecast.service.ts:31`) | Per-event, per-metric-key | M08 narrative (reads any window ≤ 24mo first for peak); M25 JEDI (reads 12mo window for stability) |
| M07 calibration hierarchy | `TTM`, `PYTM`, `TTM_24` windows (`StartingState`) | Deal → Platform → Baseline | `trafficPredictionEngine.ts` via `StartingStateService` |
| LIUS hold period | Year 1–10 YoY projections | Annual, from acquisition date | `trajectory-engine.ts:generateProjections()` |
| M35 event pipeline signal | 18-month forward horizon (default, configurable) | `computeEventPipelineSignal(horizon=18)` | NOT consumed anywhere |
| Kafka event | Real-time on `M35_FORECAST_CREATED` | Immediate | M08 cache bust + JEDI recompute |

**Key timing misalignment:**
M35 forecasts are generated in {3, 12, 24, 36}-month windows. LIUS projects in annual increments. Wiring M35 into LIUS requires a bridge that maps the nearest M35 forecast window to the LIUS hold-year index (e.g., M35 window_months=12 → LIUS Year 1, window_months=24 → Year 2). No such bridge exists today.

---

## Section 20 — Formula Audit

### F-1: Jobs → Rent Growth (m35-playbook.service.ts:608–625)

```
rentBaseline = jobs × 0.0002 × wageMult × msaAtten
```
- `wageMult`: 1.4 if `wageLevel / areaMedWage > 1.5`; else 1.0
- `msaAtten`: 0.70 (large MSA) / 1.40 (small MSA) / 1.00 (mid)
- Unit: percentage points of rent growth per hire

**Status:** Implemented correctly. Formula is additive to (not multiplicative on) the playbook median, preventing double-counting (comment at line 619 explicitly notes this).

### F-2: Jobs → Absorption (m35-playbook.service.ts:624–625)

```
absorptionBaseline = jobs × 0.0001 × wageMult × msaAtten
```
- Unit: percentage points of net absorption per hire

**Status:** Implemented correctly; coefficient ratio to rent (0.0001 vs 0.0002) is consistent with the 2:1 rent-to-absorption elasticity typical in multifamily literature.

### F-3: JEDI M35 Weight Override (jedi-score.service.ts:222–226)

```
effectiveBaseWeight =
  m35Override && m35Override.confidence >= 0.50
    ? |attributedDelta| × 100 × confidence
    : weight.base_weight
```
- `attributedDelta`: `event_forecasts.point_estimate` for the M06 metric key
- `confidence`: `event_forecasts.confidence`
- 0.50 minimum confidence threshold before override activates

**Status:** Formula is sound. One edge case: if `attributedDelta` is negative (e.g., for `employer_contraction`), `|attributedDelta|` removes the sign; the negative directional signal is not preserved in `effectiveBaseWeight`. The negative impact surfaces correctly in `impactMagnitude` via `weight.max_jedi_impact` sign, but the M35 override magnitude loses directionality. **Minor formula gap** — not blocking for Phase 0.

### F-4: M35 Proximity Decay (m35-traffic-api.service.ts:291–303)

```
factor = max(0, 1 − (distMi / cascadeRadius)²)
cascadeRadius = 5 miles
```

**Status:** Matches spec §2.3.3 (inverse-square). However, the service is never called — the formula is implemented but dead.

### F-5: Temporal Factor — S-curve (m35-traffic-api.service.ts:338–346)

```
s = 1 / (1 + exp(−10 × (progress − 0.5)))
factor = min(1.0, s)
```
where `progress = monthsSinceImpact / decayMonths`

**Status:** Correctly implements logistic S-curve recovery for `regional_shock` disaster subtype. Pre-disaster returns 1.0 (no effect yet); post-disaster ramps from 0 to 1 over `typicalDecayMonths`. Service is currently dead (not called), but formula is correct.

---

## Section 21 — Correlation Engine Overlap Check

**Finding: ZERO overlap. Correlation engine is fully isolated from M35.**

`backend/src/services/correlationEngine.service.ts` and `backend/src/services/correlation-adjustments.service.ts` contain zero references to `key_events`, `event_forecasts`, `m35`, or any M35 service import. The correlation engine computes metric cross-correlations from `metric_time_series` data (market fundamentals: vacancy, rent growth, absorption, cap rates) using its own statistical pipeline. It does not read M35 event data.

**Implication:** The correlation engine cannot currently detect whether a measured correlation spike between, e.g., `employment_growth` and `rent_growth` is caused by a known M35 employer event or is organic market movement. This limits the causal interpretation of correlation findings — a gap but not a duplicate-injection risk.

---

## Section 22 — Fix Sequence (ordered by leverage per file changed)

Priority ordered by **cell-flip count per file changed**. A "cell flip" means changing a module's status from NOT_WIRED/MISCLASSIFIED to WIRED for a given subtype.

### Fix 1: Wire m35TrafficApiService → trafficPredictionEngine.ts
**Effort:** 1 file | **Cell flips:** 10 (all M07-primary subtypes × M07 module)
- Add `import { m35TrafficApiService } from './m35-traffic-api.service'` to `trafficPredictionEngine.ts`
- Call `computeEventPipelineSignal({ submarket: property.submarket_id, msaId: property.msa_id })` within the trajectory calculation
- Apply result as 6th weighted component (15% weight) alongside the existing 5 trajectory components
- Separately: call `getActiveEvents()` in `trafficCalibrationJob.ts` to implement Mechanism A (baseline exclusion windows)

### Fix 2: Fix fetch_m35_event_forecast.ts — repoint from demand_events to key_events + event_forecasts
**Effort:** 1 file | **Cell flips:** 16 (all subtypes × Cashflow Agent — MISCLASSIFIED → WIRED)
- Replace the `FROM demand_events de LEFT JOIN demand_event_types det` query at lines 92–130 with a geo-radius query against `key_events ke LEFT JOIN event_forecasts ef` (same Haversine formula already in the tool)
- Map `ke.subtype` → `impact_type` using the event_taxonomy mapping
- Map `ef.point_estimate` → `impact_magnitude`; `ef.confidence` → confidence enum

### Fix 3: Wire event_pipeline_signal into trajectory-engine.ts exit_cap_trajectory
**Effort:** 2 files (`trajectory-engine.ts` + async caller) | **Cell flips:** 16 (all subtypes × LIUS — exit cap and lease-up absorption)
- Add M35 lookup in the trajectory resolution path: after `resolveGrowthRate()` determines the base exit cap trajectory, query `computeEventPipelineSignal()` for the deal's location
- Translate the −1..+1 signal to a basis-point adjustment on `exit_cap_trajectory`
- For `leaseUpAbsorption.yaml`: inject `employer_expansion` / `multifamily_delivery` event forecast values as a `discrete_spike` primitive on Year 1 absorption

### Fix 4: Wire M09 proforma-adjustment.service.ts for rent_control_passage + tax_abatement
**Effort:** 1 file | **Cell flips:** 4 (2 subtypes × M09 — PARTIALLY_WIRED → WIRED)
- In `proforma-adjustment.service.ts`, add a lookup for `key_events WHERE subtype IN ('rent_control_passage','tax_abatement')` for the deal's submarket
- For `rent_control_passage`: apply `level_reset` cap on `rent_growth` assumption using `magnitude_value` (max allowed annual increase)
- For `tax_abatement`: apply a time-bounded `rate_delta` on the `opex_property_tax` line for the abatement duration

### Fix 5: Wire M14 — cycle-intelligence.service.ts for rate_move + recession_indicator + multi_channel M14 pathways
**Effort:** 1 file | **Cell flips:** 8 (rate_move × M14, recession_indicator × M14, major_relocation_announcement M14-pathway, regional_shock M14-pathway)
- Add `key_events` lookup at the top of cycle phase determination
- For `rate_move`: overlay on FRED rate curve for announced future rate changes
- For `recession_indicator`: override cycle phase when active with confidence ≥ 0.6
- For `major_relocation_announcement`: apply cap rate compression signal to the spread estimate
- For `regional_shock`: apply insurance-cost premium to the risk spread

### Fix 6: Wire M03 — entitlement.service.ts + zoning-recommendation-orchestrator.service.ts for entitlement_approval + zoning_upzoning + multifamily_permit (M03 facet)
**Effort:** 2 files | **Cell flips:** 6 (3 subtypes × M03)
- In `entitlement.service.ts`, add a competitive supply query for `entitlement_approval` + `zoning_upzoning` events in the submarket
- In `zoning-recommendation-orchestrator.service.ts`, pass approved-entitlement magnitude into the envelope calculation

### Fix 7: Fix M25 JEDI supply score for multifamily_delivery + multifamily_permit + demolition + conversion
**Effort:** 1 file (`jedi-score.service.ts`) | **Cell flips:** 4 (4 supply subtypes × M25)
- Replace/supplement the `news_events WHERE event_type LIKE '%permit%'` query in `calculateSupplyScore()` with a query against `event_forecasts JOIN key_events WHERE ke.subtype IN ('multifamily_delivery','multifamily_permit','demolition','conversion')` and `ef.metric_key IN ('deliveries','permits_issued','demolition_units','net_absorption_units')`
- Net unit count: deliveries + permits - demolitions - conversions

---

## Summary Table

| Subtype | M07 | M08 | M09 | M14 | M03 | M25 | LIUS | Agent |
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

**Key:** W = WIRED · PW = PARTIALLY_WIRED · NW = NOT_WIRED · MC = MISCLASSIFIED · n/a = not applicable (not primary or secondary channel)

**WIRED:** 5 cells (M25 JEDI for employment + demographic subtypes)
**PARTIALLY_WIRED:** 20 cells (M08 narrative for 10 subtypes; M09 annotation for 2 subtypes; M25 partial for major_relocation_announcement)
**NOT_WIRED:** 66 cells
**MISCLASSIFIED:** 16 cells (all Cashflow Agent)
**Not applicable:** 21 cells

---

## Appendix A — The m35TrafficApiService Gap

The highest-leverage finding in this audit. The full M07 API contract is implemented
and exported from `m35-traffic-api.service.ts` (414 lines), including:

- `getActiveEvents()` — geo-radius query against `key_events` (Mechanism A: baseline exclusion)
- `getPipelineEvents()` — announced events for T-07 forward trajectory (Mechanism C)
- `getPlaybook()` — historical analogs for lease-up absorption curve (Mechanism D)
- `computeEventPipelineSignal()` — normalized −1..+1 pipeline signal (6th component, spec §3.1)
- `proximityFactor()` / `temporalFactor()` — decay functions (correctly implemented)

Zero imports of this service exist in `trafficPredictionEngine.ts` or `trafficCalibrationJob.ts`.
The service is also exported as `m35TrafficApiService` singleton (line 413).
Wiring requires a single import line and a single call site in `trafficPredictionEngine.ts`.
This is Fix 1 in Section 22 — highest cell-flip count per file changed of any fix in this audit.

---

## Appendix B — The Cashflow Agent Schema Mismatch

`fetch_m35_event_forecast.ts` is named as an M35 tool and is listed in the cashflow agent's
tool registry (`cashflow.config.ts`) and referenced in the system prompt
(`system.ts:412 — fetch_m35_event_forecast`). However, its SQL at line 92–130 queries:

```sql
FROM demand_events de
LEFT JOIN demand_event_types det ON det.id = de.event_type_id
LEFT JOIN trade_area_event_impacts tiea ON tiea.event_id = de.id
```

The `demand_events` table is a legacy schema predating the M35 canonical schema
(`key_events` + `event_forecasts` + `event_playbooks`). The tool has no access to any
M35-generated forecast data. When `demand_events` is empty or absent, the tool gracefully
stubs with `m35_available: false` — so it fails silently rather than erroring.

The fix (Section 22, Fix 2) is a single SQL replacement; the tool's input/output schema,
name, and registration do not need to change.
