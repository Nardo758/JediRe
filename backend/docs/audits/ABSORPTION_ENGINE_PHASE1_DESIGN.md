# ABSORPTION ENGINE — PHASE 1 DESIGN BRIEF

**Date:** 2026-07-18
**Governing spec:** SPEC_ABSORPTION_ENGINE (I–II.13, proven against Highlands)
**Governing rulings:** TRAFFIC_ENGINE_AUDIT R1–R5 (approved by Leon 2026-07-18)
**Build wave:** Wave 3 (gated behind unification foundations; DESIGN proceeds now)
**Gate deals:** Highlands (existing/owned) · Bishop (lease-up)

---

## 0. DESIGN PRINCIPLE

> **Build contracts WIDE, ship implementations NARROW.**

Every interface, type, and schema decision in this doc is evaluated against one test: *can Phase 2 widen it without a breaking change?* If the answer is no, the decision is rejected regardless of how convenient it is for Phase 1.

---

## 1. PHASE 1 SCOPE BOUNDARY

### IN — shipped narrow

| # | Capability | Evidence target |
|---|------------|-----------------|
| 1 | **Weekly traffic atom** — native prediction at `property_id` grain | Highlands weekly ingestion (52-week seasonality index) |
| 2 | **Monthly rollup** — aggregation seam from weekly → monthly | Bishop lease-up monthly pro forma bridge |
| 3 | **Ladder-driven move-outs** — `expirations(month) × (1 − renewal_rate)` from rent roll | Both gate deals |
| 4 | **Stage-labeled conversion registry** — one source of truth for `contact→tour→app→lease` | Replaces the 5+ fragmented services (R4) |
| 5 | **Estimation/fallback layer** — spec II.3 inference chain when actuals absent | Bishop (sparse data), any fresh deal |
| 6 | **DemandContext seam** — spec II.8 replacement for retired projection layer | Weekly forecast horizon |

### OUT — deferred to Phase 2 (but socketed, not blocked)

| # | Capability | Why deferred | How Phase 1 sockets it |
|---|------------|-------------|------------------------|
| 7 | **Address-level grain** | No geocoding layer in Wave 3 (R1) | `address` field is structural in schema; `property_id` is the Phase 1 lens. Comp traffic (R5) feeds same contract via `signal_source` discriminator. |
| 8 | **Land / ground-up** | Needs construction timeline, entitlement logic, pre-leasing model (R3) | `deal_mode` union is open: `'existing' \| 'lease_up'` today; `'land' \| 'ground_up'` added later without schema migration. |
| 9 | **Comp bridge implementation** | `CompTrafficService` stays separate in Phase 1 (R5) | `AbsorptionEngine.estimate()` accepts `signal_source: 'subject' \| 'comp'`; comp implementation is a new consumer calling the same method. |
| 10 | **Ten-year projection** | `TenYearProjectionService` is RETIRED, not adapted (R2) | `DemandContext` seam carries weekly horizon; long-term projection is a Phase 2 extension on the same seam. |

---

## 2. ABSORPTIONENGINE INPUT CONTRACT (WIDE)

The engine exposes **one entry point** with a discriminated input contract. All consumers — pro forma bridge, comp analysis, future land estimator — call this same method.

```typescript
// Phase 1 ships these two modes; Phase 2 adds 'land' | 'ground_up' without breaking.
type DealMode = 'existing' | 'lease_up';

type SignalSource = 'subject' | 'comp';  // 'comp' wired in Phase 2; socket exists now

interface AbsorptionEngineInput {
  // Identity — address-capable, property_id shipping (R1)
  propertyId?: string;       // present for subject deals
  address?: string;          // structural; populated when propertyId absent (land) or for comps
  submarketId: string;
  msaId: string;

  // Mode
  dealMode: DealMode;
  signalSource: SignalSource; // 'subject' for Phase 1; 'comp' for Phase 2

  // Property snapshot (spec II.1 — Layer 1)
  units: number;
  occupancyAtClose?: number;  // null for lease-up until delivery
  avgRent?: number;
  yearBuilt?: number;         // optional per R3 land constraint

  // Temporal anchor
  analysisDate: Date;         // "as of" — weekly atom alignment
  holdYears: number;          // from deal assumptions

  // Signal layers (spec II.3 — estimation fallback chain)
  demandContext?: DemandContext;      // weekly horizon; replaces retired projection
  actuals?: WeeklyTrafficActuals;    // highest precedence when present
  marketEvents?: MarketEvent[];      // M35 pipeline
}

interface DemandContext {
  // Weekly native — the atom (R2)
  weeklyTrafficForecast: number[];   // 52 weeks, aligned to analysisDate
  seasonalityIndex: number[];        // 52-week multiplier (Highlands baseline)
  demandModifier: number;            // submarket/MSA scalar from signal service
  pricingModifier: number;           // from rent roll / market data
}

interface WeeklyTrafficActuals {
  // Sparse — only weeks with data (Bishop may have partial year)
  weeks: Array<{
    weekEnding: Date;
    inquiries: number;
    tours: number;
    applications: number;
    leasesSigned: number;
  }>;
  // When actuals present, they override estimation for those weeks
  overrideEstimation: boolean;
}
```

**Key wideness guarantees:**
- `address` is structural now; no retrofit later.
- `DealMode` is an open union; adding `'land'` is a non-breaking expansion.
- `signalSource` discriminator means comp traffic is a new consumer, not a new interface.
- `yearBuilt` and `occupancyAtClose` are optional; land deals (Phase 2) simply omit them and the fallback layer fires.

---

## 3. WEEKLY → MONTHLY AGGREGATION SEAM (R2)

### The Marriage

Weekly funnel flows (Layer 2 input) + monthly ladder (Layer 3 output) are married at this seam. The monthly rollup is **aggregation**, not a separate native model.

```typescript
interface MonthlyAbsorption {
  month: Date;               // month-start
  // Funnel — derived from weekly aggregation
  inquiries: number;         // sum of weekly inquiries
  tours: number;             // sum of weekly tours
  applications: number;
  leasesSigned: number;
  // Ladder — native monthly from rent roll
  expiringLeases: number;    // from rent_roll_snapshots lease_end dates
  expectedMoveOuts: number;  // expiringLeases × (1 − renewalRate)
  renewalRate: number;       // from actuals or estimation fallback
  // Net
  netAbsorption: number;     // leasesSigned − expectedMoveOuts
}
```

### Aggregation Rules

1. **Week→month mapping:** A week belongs to the month containing its `weekEnding` date.
2. **Partial weeks at month boundaries:** Pro-rate by days. A week ending on the 3rd of the month contributes 3/7 of its volume to Month A, 4/7 to Month B.
3. **Actuals override:** If `WeeklyTrafficActuals` covers any day in a month, those weeks' actuals replace the forecast for that month. Mixed actual+forecast months use actuals where available, forecast for gaps.
4. **No decay model:** The retired `TenYearProjectionService`'s decay curve is NOT used. Monthly values are direct aggregation or ladder computation.

---

## 4. STAGE-LABELED CONVERSION REGISTRY (R4 — B1 FOR CONVERSION)

### The Disease

5+ services each own a piece of the conversion funnel. The P0 (visits-vs-tours) happened because `visit_to_tour_ratio` in one service applied to a stage labeled differently in another. No single owner knew which stage its number belonged to.

### The Cure: One Registry

```typescript
// Sole proprietor of all conversion ratios.
// Callers request by stage-label; the registry resolves the ratio + provenance.
interface ConversionRegistry {
  resolveRatio(request: RatioRequest): RatioResolution;
  registerActuals(actuals: StageActuals): void;  // EMA recalibration trigger
}

type StageLabel =
  | 'inquiry→tour'
  | 'tour→application'
  | 'application→lease'
  | 'inquiry→lease'        // composite; computed from chain, not stored
  | 'visit→tour'           // legacy alias; maps to 'inquiry→tour' with deprecation log
  ;

interface RatioRequest {
  stage: StageLabel;
  dealId?: string;          // for deal-specific learned rate lookup
  propertyId?: string;
  submarketId: string;
  fallbackChain: ('deal' | 'property' | 'submarket' | 'market' | 'default')[];
}

interface RatioResolution {
  ratio: number;            // 0.0–1.0
  source: 'deal_actuals' | 'property_actuals' | 'submarket_peer' | 'market_default' | 'override';
  confidence: 'high' | 'medium' | 'low';
  sampleSize?: number;      // null for market defaults
  lastUpdated: Date;
}
```

### Migration Path (NOT Big-Bang)

| Step | Action | Target |
|------|--------|--------|
| 1 | Build `ConversionRegistry` + table | New code, no consumers yet |
| 2 | Migrate `TrafficToProFormaService` (M07→M09 bridge) | First live consumer; thin wrapper over registry |
| 3 | `MultifamilyTrafficService` delegates to registry | Old service becomes thin, then deleted |
| 4 | `TrafficPredictionEngine v2` funnel metrics read from registry | Replaces inline ratios |
| 5 | `TrafficLearningService` EMA writes to registry | Recalibration target changes |
| 6 | `LeaseVelocityEngine` delegates composites | Last consumer migrated |
| 7 | Delete old services | 5→1 achieved |

---

## 5. COMP TRAFFIC SOCKET (R5)

Phase 1 does NOT build the comp bridge. But the contract is designed so comp traffic feeds in later without interface change.

```typescript
// Phase 1: only 'subject' is called
const subjectEstimate = await absorptionEngine.estimate({
  signalSource: 'subject',
  propertyId: highlandsId,
  dealMode: 'existing',
  // ...
});

// Phase 2: same method, 'comp' discriminator
const compEstimate = await absorptionEngine.estimate({
  signalSource: 'comp',
  address: '123 Main St, Compville',  // no propertyId; address is the key
  dealMode: 'existing',
  // same contract, same return type
});
```

**Forbidden:** Any Phase 1 code that branches on `signalSource === 'subject'` and would need a new branch for `'comp'`. The engine must treat both identically through the estimation layer.

---

## 6. DATA MODEL

### New Table: `absorption_estimates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `deal_id` | uuid FK → deals | nullable — comps have no deal |
| `property_id` | uuid FK → properties | nullable — land/comps have no property row |
| `address` | text | structural; not nullable |
| `analysis_date` | date | weekly atom anchor |
| `deal_mode` | enum | `'existing' \| 'lease_up'`; open for expansion |
| `signal_source` | enum | `'subject' \| 'comp'` |
| `weekly_forecast` | jsonb | 52-week array of `{weekEnding, inquiries, tours, apps, leases}` |
| `monthly_rollup` | jsonb | Array of `MonthlyAbsorption` |
| `conversion_provenance` | jsonb | Which stage labels resolved from which source |
| `created_at` / `updated_at` | timestamp | |

### Index Strategy

- `(deal_id, analysis_date)` — unique for subject deal re-runs
- `(address, analysis_date)` — comp lookups
- `(property_id, analysis_date)` — property-level history

---

## 7. INTEGRATION WITH EXISTING ENGINE

The `AbsorptionEngine` does NOT replace `TrafficPredictionEngine` in Phase 1. It sits **beside** it, consuming its weekly output and adding the conversion + ladder layers that the current engine lacks.

```
┌─────────────────────────────────────────────────────────────┐
│  EXISTING (unchanged in Phase 1)                            │
│  TrafficPredictionEngine.predictTrafficV2() → weekly output │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  NEW: AbsorptionEngine (Phase 1)                            │
│  1. Accept weekly output + rent roll + assumptions          │
│  2. Resolve conversion ratios via ConversionRegistry        │
│  3. Build monthly ladder from expirations                   │
│  4. Aggregate weekly → monthly                              │
│  5. Return MonthlyAbsorption[]                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  EXISTING (consumer updated)                                │
│  TrafficToProFormaService — reads MonthlyAbsorption[]       │
│  instead of inline conversion math                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. TEST STRATEGY

### Gate Deal: Highlands (existing/owned)

| Test | Evidence | Pass criteria |
|------|----------|---------------|
| Weekly seasonality | 52-week ingestion table | Forecast peaks align with historical peaks |
| Monthly aggregation | Rent roll + lease transactions | `netAbsorption` matches back-test v1 |
| Conversion registry | `deal_traffic_snapshots` | Ratios resolve to deal-level learned rates |

### Gate Deal: Bishop (lease-up)

| Test | Evidence | Pass criteria |
|------|----------|---------------|
| Estimation fallback | Sparse actuals | Falls back to submarket peers, then market default |
| Ladder accuracy | Rent roll at close | `expectedMoveOuts` = `expirations × (1 − 0.50)` |
| Pro forma bridge | M07→M09 integration | `MonthlyAbsorption` feeds pro forma without manual translation |

---

## 9. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `TrafficPredictionEngine` output shape changes | Medium | High | AbsorptionEngine accepts generic `weeklyTrafficForecast: number[]`, not engine-specific types |
| Conversion registry migration stalls at step 3 | Medium | Medium | Old services stay as thin delegates indefinitely; no forced deletion |
| Rent roll schema diverges from ladder needs | Low | High | Ladder reads `lease_end_date` only; any rent roll with that field works |
| Phase 2 address grain requires schema migration | Low | High | `address` is structural now; migration is data backfill, not schema change |

---

## 10. DECISION LOG

| # | Decision | Ruling | Rationale |
|---|----------|--------|-----------|
| 1 | `property_id` is the Phase 1 lens | R1 | Address grain is schema-ready but not resolved; geocoding is Phase 2 |
| 2 | Weekly atom, monthly rollup | R2 | Revenue management cadence is weekly; monthly is consumer-derived |
| 3 | `TenYearProjectionService` retired, not adapted | R2 | Decay model is wrong abstraction for absorption; `DemandContext` replaces it |
| 4 | Land deferred | R3 | Existing + lease-up is enough to prove the engine; land is one more inference case |
| 5 | One conversion registry, not wiring-first | R4 | Wiring-first created the P0; B1 precedent demands consolidation |
| 6 | Comp bridge socketed, not built | R5 | Interface is ready; implementation is Phase 2 consumer work |

---

**Status:** DESIGN COMPLETE — ready for Leon review before Wave 3 build dispatch.
