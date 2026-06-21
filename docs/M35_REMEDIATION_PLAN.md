# M35 Event Engine — Current State & Remediation Plan

**Derived from audit conversation 2026-06-20.**

---

## What Exists (Confirmed on Disk)

### 1. Data Connectors (Atlanta-only)

| Connector | Source | Live? | Output |
|-----------|--------|-------|--------|
| `atlanta-permits` | Socrata (`data.atlantaga.gov`) | ✅ Nightly | Building permits ≥ $5M / 50 units → `m35_draft_events` |
| `atlanta-rezoning` | DPCD ArcGIS | ✅ Nightly | Rezoning (≥1 acre) + SUPs (hotel/residential/mixed-use) → `m35_draft_events` |
| `gdelt-backtest` | GDELT GKG 2.0 | ❌ Historical-only (2013–2024) | News articles for playbook training data |

All three hardcode `msa_id: 'atlanta-sandy-springs-roswell-ga'`. No FL or Dallas connectors.

### 2. Event Lifecycle (Fully Built)

- `m35_draft_events` staging table with analyst review queue
- `promoteFromDraftQueue()` → `createEvent()` → `key_events` table
- Status machine: `draft → announced → in_progress → materialized` with `delayed`/`cancelled`/`reversed` branches
- Kafka publishes on `M35_EVENT_INGESTED`, `M35_EVENT_STATUS_CHANGED`, `M35_EVENT_VERIFIED`
- Forecast generation triggers on `announced`/`in_progress` status
- Backtest engine with DiD, CI widening, confidence decay, regime-shift detection

### 3. Forecast & Backtest (Built, Data-Starved)

- `event_forecasts` table populated with `metric_key × window_months` projections
- `playbook_backtest_results` table with `forecast_delta`, `actual_delta`, `error`, `within_ci`
- DiD computation against `metric_time_series` with control-group fallback
- **Blocker:** `metric_time_series` lacks sufficient post-announcement data for most events; rows correctly mark `insufficient_data` and skip learning. Only Highlands (Atlanta area, 53mo actuals) has fuel.

### 4. Playbook Service (Built)

- `event_playbooks` table with `subtype × stratum × metric_key × window` aggregation
- `median_delta`, `p25`, `p75`, `confidence`, `instance_count`
- CI widening triggered when hit rate < 55% (subtype-wide)
- Confidence decay on miss, boost on hit
- `scaleMagnitude()` for jobs/wage/MSA-size scaling

### 5. Traffic API Contract (Published & Consumed)

`m35-traffic-api.service.ts` exposes:
- `getActiveEvents()` — active events by location + time window
- `getPipelineEvents()` — announced-but-not-materialized events
- `getPlaybook()` — historical analogs + expected magnitude
- `proximityFactor()` — inverse-square geographic decay (haversine, 5mi cascade radius)
- `temporalFactor()` — time-based decay (ramp, S-curve, step, permanent, linear)
- `computeEventPipelineSignal()` — net demand signal (-1..+1) at 15% weight in M07

**M07 IS consuming this.** `trafficPredictionEngine.ts:865-879`:
```
trafficTrajectory = (digitalMomentum*0.5 + yoyAadtGrowth*0.3 + seasonalDeviation*0.2)*0.85
  + pipelineSignal*0.15
```

`event-impact-modifier.service.ts` implements full four-mechanism calibration: distance decay, backtest accuracy discount, causality discount, learning adjustment.

### 6. Event Impact Modifier (Built)

- `EventImpactModifierService` with `computeEventModifier()`
- Raw forward impact with distance decay (5mi halflife)
- Calibration score lookup from `backtest_runs`
- Causality direction lookup from `event_causality_results`
- Learning adjustment from `learning_adjustments` table
- Final multiplier clamped to [0.70, 1.40]

### 7. UI Components (All 10 Built)

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| `EventHeroBanner` | `DealDetailPage.tsx:1317` | ✅ Live | Renders on hero when active events exist |
| `EventChip` | `components/m35/` | ✅ Ready | Inline attribution pill, not yet placed in Capsule |
| `EventTimelineChart` | `EventTimelineSection.tsx` (F12 tab) | ✅ Live | Chart for 4 metrics |
| `EventCard` | `EventTimelineSection.tsx` | ✅ Live | Card list in timeline tab |
| `EventDependencyModal` | `EventTimelineSection.tsx` | ✅ Live | Modal for event relationships |
| `AttributionWaterfall` | `components/m35/` | ⚠️ Demo data | `seedDemoRows()` — not placed in Capsule |
| `ForecastTracker` | `components/m35/` | ⚠️ Demo data | `buildTrackData()` synthetic math — not placed |
| `MultiMetricPanel` | `components/m35/` | ✅ Exported | Not placed |
| `EventDensityStrip` | `components/m35/` | ✅ Exported | Not placed |
| `CascadeMap` | `components/m35/` | ✅ Exported | Not placed |

### 8. `events-context` Endpoint (Exists, Returns Demo Data)

`GET /api/v1/m35/deals/:dealId/events-context` is live and consumed by:
- `EventHeroBanner` (hero section)
- `EventTimelineSection` (F12 tab)

**Response shape:**
```json
{
  "events": [...],              // real from key_events
  "sensitivity": "LOW",         // naive (avg magnitude_score)
  "concentration": {            // naive (magnitude share, not IRR share)
    "topEventName": "...",
    "irrShare": 0.45,           // WRONG: this is magnitude share
    "isConcentrated": true
  },
  "inlineAttributions": {       // SYNTHETIC
    "rent_growth_yoy": [
      { "delta": 1.0, "baseline": 3.2, "total": 4.2, "confidence": 0.55 }
    ]
  }
}
```

---

## What the Audit Revealed (Gaps)

### Critical: The Attribution Layer is Fake

The `inlineAttributions` object uses synthetic math:
```javascript
baseline: 3.2,  // HARD-CODED
delta: magnitude_score * 0.5 * (scope === 'msa' ? 0.8 : 1.0),
total: 3.2 + magnitude_score * 0.5,
```

This is **not playbook-driven**. It carries no real financial signal. The `AttributionWaterfall` and `ForecastTracker` components use seeded demo data.

### Critical: No Scope-Cascade in `events-context`

The endpoint only queries `key_events` by `msa_id`. It does NOT:
- Query submarket-scoped events for the deal's submarket
- Query property-scoped events for the deal's property
- Compute `proximityScore` per event (distance from deal to event)
- Return `projectedIrrImpact` (requires propagation through pro forma)

MSA resolution is brittle: `COALESCE(d.deal_data->>'msaId', lower(trim(d.city)))`. Falls back to `lower(trim(city))` which breaks for multi-word cities.

### Critical: No LayeredValue Provenance

`inlineAttributions` has `eventId`, `delta`, `confidence` — but no `playbookId`, `playbookSubtype`, `stratum`, `instanceCount`. The two-plane model requires a badge: when a `+0.42pp` chip appears in F9, it must carry "Source: M35 Playbook 'HQ_relocation_large_metro' (n=12, confidence=0.74)".

### Critical: No FL/Dallas Connector Routing

All connectors are Atlanta-only. The `events-context` endpoint queries by `msa_id`, so even if FL events existed, the routing would fail. No `florida-permits`, `dallas-permits`, `florida-rezoning` connectors exist.

### Critical: No Forward-Sight News Feed

The `nightlyEventExtractionCron` (Task #1078) reads `news_article_cache` but is **not wired** to the M35 draft pipeline. There is no NLP classifier extracting `subtype`, `magnitude`, `geography` from prose and surfacing as `m35_draft_events`. The engine learns from history (GDELT) but is blind to live events 6–18 months ahead of permits.

### Formula Errors (From the Conversation)

1. **IRR ≠ pp:** `projectedIrrImpact = median_delta × proximity × temporal × confidence` yields a rent-growth delta in pp, not an IRR delta in pp of return. IRR impact requires propagating the assumption delta through the full pro forma → NOI → debt schedule → IRR chain. The model owns this, not the endpoint.

2. **Baseline ≠ median_delta:** `playbook.median_delta` is the event's contribution (waterfall bar), not the baseline. The baseline is the ex-all-events trend (DiD control-group / secular extrapolation from `metric_time_series`). The waterfall needs four quantities: baseline trend + per-event deltas + secular migration + unexplained residual.

3. **EventChip is endpoint-painted, not assumption-fed:** The chip's delta must be the Platform-layer entry that F9's assumption plane resolves. If `events-context` computes a rent-growth delta independently while F9's `computeUserLineAnnual` ramp machinery computes its own, you have two sources of truth. The endpoint should feed the assumption plane; the chip reads the resolved value and renders the badge.

---

## Revised Priority Stack (3 P0s, Not 5)

### P0.1: Build the Event→Platform-layer→IRR Propagation Path

**This is one workstream, not five.** It kills synthetic attribution, enables IRR-share concentration, delivers `projectedIrrImpact`, and makes Touch 4 (Event Dependency Modal counterfactual) possible.

**What to build:**
1. **Per-event assumption delta computation:**
   - For each event, call `getPlaybook(subtype, stratum)` → get `median_delta`, `p25`, `p75`
   - Call `proximityFactor(event, dealLocation)` → scale by distance
   - Call `temporalFactor(event, asOf)` → scale by time
   - Product = `assumptionDelta = median_delta × proximity × temporal` (in pp)
   - This is the **Platform-layer rent-growth contribution**

2. **Write to assumption plane (LayeredValue):**
   - Feed the `assumptionDelta` into `deal_assumptions` or `deal_projections` as a Platform-layer entry
   - Source: `tier3:platform` with `agent:m35` provenance
   - Include `playbookId`, `playbookSubtype`, `stratum`, `instanceCount`, `playbookConfidence`
   - F9's `computeUserLineAnnual` resolves this via the normal LayeredValue hierarchy

3. **IRR propagation (model-owned):**
   - The pro forma engine re-runs with the event-attributed assumption deltas applied
   - Returns `projectedIrrImpact` per event (or total with all events)
   - Touch 4 counterfactual: "Run without events" = baseline run with all event deltas stripped back to control trend
   - IRR concentration: `topEventIrrUplift / totalIrrUplift > 0.30` → `concentrationRisk: true`

4. **AttributionWaterfall shape:**
   - `baseline` = control trend (from `metric_time_series` secular extrapolation, not a playbook number)
   - `eventBars` = each event's `median_delta` (playbook)
   - `secular` = secular migration component
   - `residual` = unexplained (observed - baseline - events - secular)
   - Must reconcile: `baseline + Σ(events) + secular + residual = observed`

5. **EventChip wiring:**
   - Chip reads from the resolved Platform-layer value (F9's output), not from endpoint-painted delta
   - Badge renders playbook citation on hover

**Files to touch:**
- `backend/src/routes/m35-events.routes.ts` (rewrite `events-context`)
- `backend/src/services/m35-traffic-api.service.ts` (add `getDealLocation()` + `resolveDealAssumptionDeltas()`)
- `backend/src/services/financial-model-engine.service.ts` or `proforma-projection.service.ts` (accept Platform-layer event deltas)
- `frontend/src/components/m35/EventChip.tsx` (read from F9 resolved value, not endpoint)
- `frontend/src/components/m35/AttributionWaterfall.tsx` (replace `seedDemoRows()` with real data)
- `frontend/src/components/m35/EventDependencyModal.tsx` (Touch 4 counterfactual UI)

**Depends on:** P0.2 scope-cascade (to know which events are in range), P0.3 MSA resolution (to know which MSA the deal is in).

### P0.2: Scope-Cascade + Proximity Scoring in `events-context`

**Genuinely separate from P0.1.**

**What to build:**
1. Query `key_events` at three scopes: `msa_id` + `submarket_id` + `property_id`
2. For each event, compute `proximityFactor(event, dealLocation)` using `m35-traffic-api.service.ts`
3. Filter events by proximity threshold (e.g., ≥ 0.1, meaning within ~1.5× cascade radius)
4. Return `proximityScore` per event in `events-context` response
5. Resolve deal location from `properties` table (lat/lng), not just `deal_data->msaId`

**Files to touch:**
- `backend/src/routes/m35-events.routes.ts` (scope-cascade query + proximity computation)
- `backend/src/services/m35-traffic-api.service.ts` (ensure `proximityFactor` is callable per-event)

### P0.3: FL/Dallas Connector Stubs + MSA Resolution

**Genuinely separate from P0.1 and P0.2.**

**What to build:**
1. Add `florida-permits` connector stub (even if it returns empty, the routing must exist)
2. Add `dallas-permits` connector stub
3. Add `florida-rezoning` connector stub
4. Wire `events-context` to resolve deal MSA from `properties` table join, not `lower(trim(city))`
5. Ensure `m35ConnectorsNightlyCron` can run per-MSA, not just Atlanta

**Files to touch:**
- `backend/src/services/m35-event-connectors.service.ts` (add FL/Dallas stubs)
- `backend/src/routes/m35-events.routes.ts` (fix MSA resolution)
- `backend/src/inngest/functions/m35-connectors-nightly.ts` (per-MSA dispatch)

### P1: Forward-Sight News→NLP→Draft Queue

**What to build:**
- `nightlyEventExtractionCron` already reads `news_article_cache`
- Add two single-shot LLM calls (Task-class, not agent loop):
  1. Classify: extract `category`, `subtype`, `magnitude`, `confidence`
  2. Geocode: extract `city`, `submarket_hint`, `scope` from article text
- Write results to `m35_draft_events` with `source_connector: 'news_nlp'`
- Filter: only surface articles with `confidence >= 0.6` and `magnitude >= 2`

### P1: Event Sensitivity Surfacing

`events-context` already computes `sensitivity` from avg `magnitude_score`. This is naive — should be derived from total projected impact. But the field exists and is surfaceable. Upgrade when P0.1 delivers real impact numbers.

### P1: Dedup / Entity Resolution

When a project surfaces as permit + rezoning + article, merge them into one draft event with multiple source connectors. Simple rule: same address + same time window (±30 days) + same category = same project.

### P2: Multi-Event Composition

Additive when uncorrelated, interaction dampening on overlap, cumulative cap. Spec's additive-composition rule is load-bearing for both event composition and IRR attribution. The overlap path breaks linearization, so isolated runs are needed for overlapping events.

### P2: Admin Override as Training Signal

When admin overrides a forecast, log the override with `adminOverride: { originalDelta, overrideDelta, reason }` for future playbook learning.

### P2: Published M35 API Contract

Document `m35-traffic-api.service.ts` as a stable API contract (`docs/api-contracts/m35.md`) so M07 and other modules can consume without reimplementation. M07 already consumes it, but the contract isn't documented.

---

## Sequence Recommendation

1. **P0.3 first** (FL/Dallas stubs + MSA resolution) — it's the cheapest, enables the scope-cascade, and unblocks geographic expansion.
2. **P0.2 next** (scope-cascade + proximity) — gives P0.1 the event list it needs to compute real deltas.
3. **P0.1 last** (propagation path) — this is the hard one. It requires F9's assumption plane to accept Platform-layer event deltas, which means touching the pro forma engine.

Alternatively, if Atlanta is the only near-term market, do P0.2 → P0.1 in parallel, defer P0.3.

---

## Acceptance Criteria for P0.1

- `events-context` returns `inlineAttributions` where `delta` is derived from `playbook.median_delta × proximity × temporal`, not `magnitude * 0.5`
- `baseline` is derived from `metric_time_series` control trend, not hardcoded `3.2`
- `total` reconciles: `baseline + Σ(deltas) + secular + residual = observed`
- Each attribution carries `playbookId`, `playbookSubtype`, `stratum`, `instanceCount`, `playbookConfidence`
- `concentration.irrShare` is derived from IRR impact, not magnitude share
- `projectedIrrImpact` exists per event (computed by F9 re-run, not endpoint arithmetic)
- Touch 4 counterfactual works: "Run without events" strips all event deltas and re-runs pro forma
- EventChip renders `+0.42pp` from the resolved Platform-layer value, not from endpoint-painted delta
- AttributionWaterfall shows real bars (no `seedDemoRows()`)

---

*End of plan.*
