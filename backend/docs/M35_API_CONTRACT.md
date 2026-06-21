# M35 Event Engine — API Contract

**Version:** 1.0.0  
**Last updated:** 2026-06-17  
**Status:** P2 Complete (Published)  
**Owner:** M35 Event Engine team  

---

## 1. Purpose & Scope

The M35 Event Engine is a playbook-driven, geography-scoped event impact system. It:

- Discovers and classifies events (news NLP, connectors, manual entry)
- Resolves events to deals via scope-cascade (MSA → submarket → property)
- Computes assumption deltas (e.g., rent-growth impact) from playbooks
- Composes multi-event deltas with interaction dampening
- Propagates deltas into the F9 pro forma engine
- Captures analyst overrides as training signals for playbook improvement

### What M35 does NOT do

- It does NOT predict event timing (that is the news→NLP→draft queue)
- It does NOT backtest against historical outcomes (that is the Highland n=1 alignment pipeline)
- It does NOT set assumptions directly; it produces `ProvenancedValue` deltas that F9 consumes
- It does NOT handle non-real-estate events (no retail, office, or industrial specialization yet)

---

## 2. Data Model: ProvenancedValue

Every M35 output is a `ProvenancedValue<T>`:

```typescript
interface ProvenancedValue<T> {
  value: T;                          // the computed delta or resolved value
  source: 'platform' | 'manual' | 'system';
  confidence: number;                // 0–1 composite confidence
  origin: 'derived' | 'observed' | 'inferred' | 'override';
  rationale: string;                 // human-readable derivation chain
  sourceRefs?: SourceRef[];           // citations for LayeredValue badge
}

interface SourceRef {
  moduleId: string;                  // e.g. 'M35'
  formulaId: string;                 // e.g. playbook subtype
  note: string;                      // e.g. "playbookId=amazon_fulfillment, stratum={...}, n=12"
}
```

### Guarantees

- `value` is always present (never null when the PV is returned)
- `confidence` is always a finite number in [0, 1]
- `rationale` is non-empty and includes the full derivation chain
- `sourceRefs` is present for all derived values; empty for observed values

---

## 3. REST API: Events Context

### `GET /api/v1/m35-events/events-context/:dealId`

Returns the full event context for a deal, including events, sensitivity, concentration, baseline, and inline attributions.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeEvents` | `boolean` | `true` | When `false`, returns empty events array (counterfactual / Touch 4 mode) |
| `metricKey` | `string` | `rent_growth_yoy` | Target metric for delta computation |
| `windowMonths` | `number` | `12` | Forecast window for playbook lookup |

#### Response Shape

```typescript
interface EventsContextResponse {
  events: EventContext[];
  sensitivity: Sensitivity;
  concentration: Concentration;
  projectedIrrImpact: ProjectedIrrImpact;
  inlineAttributions: Record<string, ProvenancedValue<number>[]>;
  baseline: ProvenancedValue<number>;
  secular: ProvenancedValue<number>;
  residual: ProvenancedValue<number>;
}

interface EventContext {
  id: string;
  name: string;
  category: string;
  subtype: string | null;
  status: string;
  proximityScore: number;            // 0–1, distance+scope composite
  magnitudeScore: number;              // 1–5 event magnitude
  temporalFactor: number;              // 0–1, decay-adjusted relevance
  materializationDate: string | null;
  announcedDate: string | null;
}

interface Sensitivity {
  totalProjectedDelta: number;         // sum of all composed deltas (pp)
  eventCount: number;
  maxSingleEventDelta: number;
  dampenedCount: number;               // how many events had overlap dampening
  capped: boolean;                     // whether cumulative cap was applied
}

interface Concentration {
  topEventShare: number;               // % of total delta from largest event
  topTwoEventShare: number;            // % from top two events
  flagged: boolean;                    // true if topEventShare > 0.7 |
  flagReason: string | null;
}

interface ProjectedIrrImpact {
  status: 'not_computed' | 'computed' | 'failed';
  projectedIrrDeltaBps: number | null; // basis points, if computed
  note: string;                        // explanation if not computed
}
```

#### Example

```bash
curl "https://api.jedire.com/api/v1/m35-events/events-context/deal-123?metricKey=rent_growth_yoy&windowMonths=12"
```

```json
{
  "events": [
    {
      "id": "evt-456",
      "name": "Amazon Fulfillment Center",
      "category": "employment",
      "subtype": "amazon_fulfillment",
      "status": "confirmed",
      "proximityScore": 0.85,
      "magnitudeScore": 4.5,
      "temporalFactor": 0.92,
      "materializationDate": "2026-03-01",
      "announcedDate": "2025-09-15"
    }
  ],
  "sensitivity": {
    "totalProjectedDelta": 0.0185,
    "eventCount": 1,
    "maxSingleEventDelta": 0.0185,
    "dampenedCount": 0,
    "capped": false
  },
  "concentration": {
    "topEventShare": 1.0,
    "topTwoEventShare": 1.0,
    "flagged": false,
    "flagReason": null
  },
  "projectedIrrImpact": {
    "status": "not_computed",
    "projectedIrrDeltaBps": null,
    "note": "Counterfactual IRR requires baseline-only pro forma run. Use /proforma/compute with includeEvents=false."
  },
  "inlineAttributions": {
    "rent_growth_yoy": [
      {
        "value": 0.0185,
        "source": "platform",
        "confidence": 0.72,
        "origin": "derived",
        "rationale": "Amazon Fulfillment Center (amazon_fulfillment) | playbook: amazon_fulfillment (published, n=12) | stratum: {\"msaTier\":\"major\",\"magnitude\":\"large\",\"regime\":\"post_covid\"} | metric: rent_growth_yoy@12mo | median=0.025pp | proximity=0.85 | temporal=0.92 | delta=1.85pp | metricConfidence=0.92 | compositeConfidence=0.72",
        "sourceRefs": [
          {
            "moduleId": "M35",
            "formulaId": "amazon_fulfillment",
            "note": "playbookId=amazon_fulfillment, stratum={\"msaTier\":\"major\",\"magnitude\":\"large\",\"regime\":\"post_covid\"}, n=12, metricConfidence=0.92"
          }
        ]
      }
    ]
  },
  "baseline": {
    "value": 0.032,
    "source": "platform",
    "confidence": 0.65,
    "origin": "derived",
    "rationale": "Baseline from metric_time_series rent_growth_yoy (DiD control trend) | source: FRED/BLS | coverage: 24 months | fallback: false",
    "sourceRefs": []
  },
  "secular": {
    "value": 0.032,
    "source": "system",
    "confidence": 0.5,
    "origin": "inferred",
    "rationale": "Secular trend stub — not yet computed from long-term macro models",
    "sourceRefs": []
  },
  "residual": {
    "value": 0.0,
    "source": "system",
    "confidence": 0.0,
    "origin": "inferred",
    "rationale": "Residual stub — not yet computed from unexplained variance",
    "sourceRefs": []
  }
}
```

---

## 4. Service API: computeEventDeltas

### `computeEventDeltas(pool, dealId, options?)`

The canonical function for computing event-driven assumption deltas. Called by:
- `events-context` endpoint (for UI display)
- F9 pro forma engine (for IRR projection)
- `proforma-adjustment.service.ts` (for layered assumption composition)

#### Signature

```typescript
async function computeEventDeltas(
  pool: Pool,
  dealId: string,
  options?: ComputeEventDeltasOptions
): Promise<ProvenancedValue<number>[]>
```

#### Options

```typescript
interface ComputeEventDeltasOptions {
  /** When false, returns empty array (counterfactual / Touch 4 mode). */
  includeEvents?: boolean;    // default: true
  /** Override the target metric key (default: rent_growth_yoy). */
  metricKey?: string;         // default: 'rent_growth_yoy'
  /** Override the forecast window (default: 12 months). */
  windowMonths?: number;      // default: 12
}
```

#### Algorithm

1. **Resolve deal location** from `properties` table (MSA, submarket, lat/lng)
2. **Scope-cascade query** `key_events` at MSA + submarket + property levels
3. **Filter** by status (exclude `cancelled`, `reversed`, `draft`) and proximity threshold (≥ 0.1)
4. **Per-event:**
   a. Lookup playbook for `subtype × stratum` (MSA tier, magnitude, regime)
   b. Extract metric at `metricKey × windowMonths`
   c. Compute `proximityFactor` (geo distance) and `temporalFactor` (decay)
   d. `assumptionDelta = metric.median × proximity × temporal`
   e. Build `ProvenancedValue` with full rationale and sourceRefs
5. **Multi-event composition** (see §5)
6. **Return** composed deltas array

#### Guarantees

- Returns empty array when `includeEvents = false` or no events found
- Returns empty array when deal has no resolvable MSA
- Never throws for missing data; logs warnings and skips events
- All returned values are finite numbers
- Deltas are sorted by absolute magnitude (largest first) in the raw array; composition preserves this order

---

## 5. Multi-Event Composition

When multiple events affect the same deal, their deltas are not simply summed. The `composeEventDeltas` function applies:

### Overlap Detection

Two events are considered overlapping when:
- They share the same geography (`submarketId` or `msaId`)
- Their time windows overlap (`announcedDate` to `materializationDate`)

### Dampening Rule

For each pair of overlapping events, the smaller-magnitude event's delta is multiplied by `CORRELATION_DAMPENING = 0.70`. This reflects that overlapping demand shocks partially cannibalize each other (e.g., two Amazon fulfillment centers in the same submarket do not each add 1,500 jobs independently).

### Cumulative Cap

The total composed delta is capped at `CUMULATIVE_CAP = ±5.00pp` (percentage points) for `rent_growth_yoy`. This prevents the model from predicting extreme rent growth from a stack of medium events.

### Return Value

Each returned `ProvenancedValue` includes a composition suffix in its `rationale`:

```
| composed: raw=2.50pp adjusted=1.75pp capRatio=1.000 totalComposed=3.20pp
```

---

## 6. Playbook Lookup API

### `getPlaybook(subtype, stratum)`

Returns the playbook for a given event subtype and stratum bucket.

#### Stratum Buckets

```typescript
interface PlaybookStratum {
  msaTier: 'major' | 'secondary' | 'tertiary';
  magnitude: 'small' | 'medium' | 'large' | 'transformative';
  regime: 'pre_covid' | 'post_covid';
}
```

#### Classification Rules

| Magnitude Score | Stratum |
|-----------------|---------|
| ≤ 1.0 | `small` |
| 1.0–2.0 | `medium` |
| 2.0–4.0 | `large` |
| > 4.0 | `transformative` |

| Announcement Date | Regime |
|-------------------|--------|
| Before 2020-03-01 | `pre_covid` |
| 2020-03-01 or later | `post_covid` |

#### MSA Tier Classification

```typescript
function classifyMsaTier(msaId: string): 'major' | 'secondary' | 'tertiary';
```

Tiers are defined by population and rent-growth volatility. Major MSAs include Atlanta, Dallas, Charlotte, etc. See `m35-playbook.service.ts` for the full list.

---

## 7. Admin Override & Training Signal

### How Overrides Flow

1. Analyst overrides a field in the F9 UI (e.g., sets rent growth to 3.5%)
2. `applyUserOverride()` in `proforma-seeder.service.ts`:
   - Captures the pre-override state (`previousResolved`, `previousResolution`, `previousResolvedFrom`)
   - Writes the override to `deal_assumptions.year1.{field}.override`
   - Recomputes derived fields (NOI, EGI, etc.)
3. If the previous resolution was platform-derived (`platform`, `platform_fallback`, `derived`, `event_timeline`, `agent`, `strategy`), a training signal is logged

### Training Signal Record

Inserted into `assumption_override_training_signals`:

```typescript
interface TrainingSignal {
  dealId: string;
  userId: string;
  fieldPath: string;
  assumptionType: string;
  previousValue: number;           // what the platform predicted
  overrideValue: number;         // what the analyst chose
  baselineValue: number;         // the secular baseline (for delta computation)
  previousResolution: string;      // 'platform', 'derived', etc.
  previousSource: string;          // 'M35', 'M07', 'agent', etc.
  overrideReason: string | null;   // analyst's explanation
  activeEventIds: string[] | null; // key_events considered at time of override
  computedDelta: number | null;    // platform's delta from baseline
  overrideDelta: number | null;   // analyst's delta from baseline
  outcomeActualValue: number | null; // backfilled later from rent roll
  outcomeVerifiedAt: Date | null;   // when the actual outcome was recorded
  createdAt: Date;
}
```

### Using Training Signals

- **Playbook drift analysis:** Compare `computedDelta` vs. `overrideDelta` across all signals for a given playbook subtype. If the median error is > 0.5pp, the playbook is flagged for review.
- **Outcome verification:** After 12 months, backfill `outcomeActualValue` from actual rent rolls. Compare platform prediction, analyst override, and actual outcome to measure both playbook accuracy and analyst calibration.
- **Dashboard:** A future admin dashboard will surface override patterns by subtype, geography, and regime.

---

## 8. Counterfactual Mode (Touch 4)

To compute the baseline-only IRR (the "what if no events happened" scenario), call `computeEventDeltas` with `includeEvents: false`.

```typescript
const baselineDeltas = await computeEventDeltas(pool, dealId, {
  includeEvents: false,
});
// baselineDeltas === []
```

The pro forma engine then runs with only the secular baseline assumption, producing the counterfactual IRR. The difference between the all-events IRR and the counterfactual IRR is the **projected IRR impact**.

### Full Counterfactual Flow

```typescript
// 1. Get counterfactual assumptions
const counterfactualDeltas = await computeEventDeltas(pool, dealId, { includeEvents: false });
// Returns [] — pro forma uses baseline only

// 2. Run pro forma with counterfactual assumptions
const counterfactualResult = await runProforma(dealId, { eventDeltas: counterfactualDeltas });

// 3. Get all-events assumptions
const eventDeltas = await computeEventDeltas(pool, dealId, { includeEvents: true });

// 4. Run pro forma with all-events assumptions
const allEventsResult = await runProforma(dealId, { eventDeltas });

// 5. Compute projected IRR impact
const irrImpactBps = (allEventsResult.irr - counterfactualResult.irr) * 10_000;
```

---

## 9. Error Handling & Edge Cases

### Missing Deal Location

When a deal has no MSA (no property, no city, no `deal_data->>'msaId'`):
- `computeEventDeltas` returns `[]` with a warning log
- `events-context` returns empty events array with a note in the response

### Missing Playbook

When an event subtype has no playbook entry:
- The event is skipped (no delta)
- A debug log is emitted: `No playbook found for subtype {subtype}`
- The event still appears in `events-context` with `proximityScore` but no inline attribution

### Missing Metric in Playbook

When a playbook exists but lacks the requested `metricKey × windowMonths`:
- The event is skipped
- A debug log is emitted: `No metric in playbook for {metricKey}@{windowMonths}mo`

### Proximity Below Threshold

When an event's `proximityFactor < 0.1`:
- The event is skipped
- A debug log is emitted: `Event below proximity threshold`

### Empty Event List

When no events pass all filters:
- `computeEventDeltas` returns `[]`
- `events-context` returns empty arrays with baseline/ secular/ residual stubs

---

## 10. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-17 | P0+P1+P2 complete. Published API contract. Multi-event composition, admin override training signals, counterfactual mode, scope-cascade query. |
| 0.9.0 | 2026-06-15 | P1: Baseline from DiD control trend, sensitivity upgrade, projectedIrrImpact stub. |
| 0.8.0 | 2026-06-13 | P0: Scope-cascade + proximity scoring, event→platform→IRR propagation, playbook-driven deltas. |
| 0.7.0 | 2026-06-11 | Legacy hardcoded magnitude→bps mapping. |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Playbook** | A pre-curated table of event impact estimates by subtype, stratum, and metric. |
| **Stratum** | The bucket (MSA tier × magnitude × regime) that determines which playbook row to use. |
| **Scope-cascade** | The query strategy: MSA → submarket → property, broadening the search radius. |
| **Proximity factor** | 0–1 score based on geographic distance from event to deal. |
| **Temporal factor** | 0–1 score based on time decay from event announcement to now. |
| **Assumption delta** | The change in an assumption (e.g., rent growth) attributed to an event. |
| **Composed delta** | The final delta after multi-event overlap dampening and cumulative cap. |
| **Counterfactual** | The baseline-only scenario (no events included). |
| **Training signal** | An analyst override logged for future playbook improvement. |
| **LayeredValue** | The F9 data model where values have multiple source layers (platform, t12, rent_roll, override, etc.). |

---

## 12. Contact & Support

- **Code owner:** M35 Event Engine (`backend/src/services/m35-*`, `backend/src/services/proforma/event-deltas.service.ts`)
- **Slack:** #m35-event-engine
- **Issues:** Tag with `m35` and `event-engine`
- **On-call:** Platform team (escalation via PagerDuty)
