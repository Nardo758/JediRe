# ABSORPTION ENGINE — PHASE 1 DESIGN BRIEF

**Date:** 2026-07-18
**Governing spec:** SPEC_ABSORPTION_ENGINE (I–II.15, proven against Highlands)
**Governing rulings:** TRAFFIC_ENGINE_AUDIT R1–R5 (approved by Leon 2026-07-18)
**Build wave:** Wave 3 (gated behind unification foundations; DESIGN proceeds now)
**Gate deals:** Highlands (existing/owned) · Bishop (lease-up)
**Review status:** REVISED — addresses R1–R7 from review gate (commit `431cacecd`)

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

### P0 FIX — EXPLICITLY OUT OF SCOPE

The P0 visits-vs-tours fix (`ProFormaService:134` computes `projectedLeases = weekly_walk_ins × closing_ratio` — but `weekly_walk_ins` are **visits** and `closing_ratio` is **tours→leases**) is a **live production data-integrity defect that ships independently in Wave 0.** This design inherits corrected stage-labeling; it does not deliver the fix. No Phase 1 deliverable is a prerequisite for the P0 dispatch. The interim fix (insert `visit_to_tour_ratio` or honest-absence the projection) runs on its own timeline; the permanent shape is decided by this design but the build does not block the interim.

*(SPEC II. P0 section: "LIVE BUG, FIX BEFORE (OR INDEPENDENT OF) THE BUILD")*

---

## 2. ABSORPTIONENGINE INPUT CONTRACT (WIDE)

The engine exposes **one entry point** with a discriminated input contract. All consumers — pro forma bridge, comp analysis, future land estimator — call this same method.

```typescript
// Phase 1 ships these two modes; Phase 2 adds 'land' | 'ground_up' without breaking.
// Canonical spellings: registered in backend/src/types/canonical-keys.ts (Wave 1 unification).
// Reconciliation: 'existing' = STABILIZED · 'lease_up' = LEASE_UP per traffic-calibration.types.ts:103
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
// Stage labels match SPEC_ABSORPTION_ENGINE II.1 taxonomy exactly.
interface ConversionRegistry {
  resolveRatio(request: RatioRequest): RatioResolution;
  registerActuals(actuals: StageActuals): void;  // EMA recalibration trigger
}

type StageLabel =
  | 'inquiry→tour'         // SPEC II.1: awareness → interest → anchor
  | 'tour→application'     // SPEC II.1: anchor → outcome
  | 'application→lease'    // SPEC II.1: outcome closes loop
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
| 2 | Migrate `TrafficToProFormaService` (M07→M09 bridge); `ProFormaService:134` `closing_ratio` and `visit_to_tour_ratio` migrate INTO the registry | First live consumer; thin wrapper over registry |
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
| `estimate_tier` | enum | `'measured' \| 'observed' \| 'inferred'` — spec II.3 provenance |
| `fallback_rung` | text | which II.3 rung produced the value (e.g., `'submarket_peer'`, `'market_default'`, `'workback(capture 0.4–0.7)'`) |
| `confidence_band` | jsonb | `{ lower: number, upper: number, method: string }` — spec II.3 format |
| `weekly_forecast` | jsonb | 52-week array of `{weekEnding, inquiries, tours, apps, leases}` |
| `monthly_rollup` | jsonb | Array of `MonthlyAbsorption` |
| `conversion_provenance` | jsonb | Which stage labels resolved from which source |
| `created_at` / `updated_at` | timestamp | |

**Provenance rule (Check 3):** No estimate row can exist without `estimate_tier` + `fallback_rung` + `confidence_band`. The `estimate_tier` maps to spec II.3's three-tier confidence gradient: `measured` (uploaded docs) > `observed` (real traffic) > `inferred` (modeled from surroundings). The `fallback_rung` names the method that produced the value. The `confidence_band` carries the empirical error bar.

**Review-gate extension (II.14):** `absorption_estimates` AND `rent_roll_snapshots` share the stamp-the-time-axis-at-write requirement. `as_of_date` on every row; the "current" rent roll is DERIVED (`max(as_of_date)`), not separately stored.

### Index Strategy

- `(deal_id, analysis_date)` — unique for subject deal re-runs
- `(address, analysis_date)` — comp lookups
- `(property_id, analysis_date)` — property-level history

---

## 7. RENT ENGINE: PER-LEASE ROLL-TO-MARKET (II.13)

### The Ladder Is the Rent Engine

Rent growth is NOT a uniform `GPR×(1+g)^year`. Market rent grows continuously; a unit's REALIZED rent steps only at LEASE EXPIRATION, when it rolls to then-current market (new lease) or takes a renewal step. Revenue = a per-lease roll-to-market schedule driven by the EXPIRY LADDER — the same ladder that drives move-outs (Section 3). **One ladder, two consumers.**

```typescript
interface RentContext {
  // Per-lease roll schedule — unit 1103 rolls Jul-2027, unit 2201 Mar-2028
  leaseRolls: Array<{
    unitId: string;
    leaseEndDate: Date;
    inPlaceRent: number;
    marketRentAtRoll: number;   // projected market rent at lease_end_date
    renewalRate: number;        // probability this lease renews
    newLeaseConcessionMonths: number;
  }>;
  // Loss-to-lease is expressible: an individual lease can sit below market and roll at expiration
  // Highlands finding: LTL $192/unit = $588K/yr — invisible to uniform-growth models
  lossToLeaseAnnual: number;     // sized demand gap
  demandSupportedRent: number;   // triangulated (rent roll, weekly effective, submarket clearing)
}
```

### Asymmetric Trending (II.13)

| Field class | Horizon model | Override behavior |
|---|---|---|
| Gross rents | per-lease roll-to-market on the expiry ladder | growth-rate override propagates VIA the ladder (derived, safe to overlay) |
| Other income | stabilized value, entered DIRECT (not trended from Y1) | overrides the stabilized level |
| Expenses | stabilized value, entered DIRECT | overrides stabilized; **trend toggle MUST stay wired, default flat** |
| Exit cap | single value consumed in the exit year | must REACH the exit-year disposition calc (the silent-drop risk field) |

**Assembler discipline:** The overlay does NOT touch stored-direct stabilized expenses / other income (no re-trending). A rent-growth override re-propagates through the per-lease roll, not just a Y1 scalar. This is the horizon-audit target: confirm rents are per-lease-derived AND per-lease-grain; confirm expenses/other-income are stored-stabilized-direct so the rebuild overlay does NOT re-trend them; confirm exit-cap override reaches the exit year.

---

## 8. INTEGRATION WITH EXISTING ENGINE

The `AbsorptionEngine` does NOT replace `TrafficPredictionEngine` in Phase 1. It sits **beside** it, consuming its weekly output and adding the conversion + ladder + rent-roll layers that the current engine lacks.

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
│  5. Build per-lease rent roll-forward (RentContext)         │
│  6. Return DemandContext (occupancyPath + rentPath + ...)   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  EXISTING (consumer updated)                                │
│  TrafficToProFormaService — reads DemandContext             │
│  instead of inline conversion math                          │
└─────────────────────────────────────────────────────────────┘
```

**DemandContext fields (II.8):**
```typescript
interface DemandContext {
  occupancyPath: MonthlyAbsorption[];   // monthly, absorption-driven
  monthsToStabilize: number;            // DERIVED, not assumed
  rentPath: RentContext;                // per-lease roll-to-market
  turnover: number;                     // measured/estimated
  renewalRate: number;
  concessionPosture: string;
  confidenceTier: 'measured' | 'observed' | 'inferred';
}
```

**Replacement map:** linear lease-up ramp (Finding-AA placeholder) → `occupancyPath` · `?? 12` stabilization heuristic → derived `monthsToStabilize` · flat market rent growth → `rentPath` · flat 50% turnover → measured/estimated · static concession → dial position · `visits × closing_ratio` → staged funnel.

---

## 9. TEST STRATEGY

### Gate Deal: Highlands (existing/owned)

| # | Test | Evidence | Pass criteria |
|---|------|----------|---------------|
| 9.1 | **Funnel reproduction** | 261-week ingestion | 332K exposures/wk → anchor est. 25–40 visits/wk → **15 contacts → 10.9–12.2 tours → 1.94–3.15 leases/wk** |
| 9.2 | **Race deficit** | Weekly leasing report | Replacement race deficit **18%** (need **13.3** tours/wk, have **10.9**) |
| 9.3 | **Ladder accuracy** | Rent roll | Expiry wave: **121 leases Jun–Sep 2026, July = 46**; `expectedMoveOuts` = `expirations × (1 − 0.65)` |
| 9.4 | **LTL sizing** | Rent roll + weekly effective | **LTL $192/unit = $588K/yr** ≈ $10.7M of asking-value demand won't fund |
| 9.5 | **Demand-supported rent** | Triangulated 3× | **$1,674–1,680** (rent roll, weekly effective, submarket clearing) |
| 9.6 | **Conversion registry** | `deal_traffic_snapshots` | Ratios resolve to deal-level learned rates; `tour→lease` = **17.9%** (Highlands measured) |
| 9.7 | **Back-test v0 honesty** | Held-out Jan–Jul 2026 (n=27) | Tours +11.3% · net leases +15.4% · move-outs +30.6% · **occupancy WRONG DIRECTION** (pred 91.0%, actual 96.2%) labeled honestly: `modeled · backtested · direction unreliable under lumpy expiries · n=27` |
| 9.8 | **Back-test v1 fix** | Ladder-driven move-outs + rent-coupled conversion | Occupancy direction CORRECTED; v1 = ladder-driven move-outs + rent-coupled conversion (conversion observed non-constant: 15.9%–26.5% by year) |

### Gate Deal: Bishop (lease-up)

| # | Test | Evidence | Pass criteria |
|---|------|----------|---------------|
| 9.9 | **Estimation fallback** | Sparse actuals | Falls back to submarket peers, then market default; `estimate_tier` = `'inferred'` with wide band |
| 9.10 | **monthsToStabilize derivation** | S-curve from absorption path | DERIVED from `occupancyPath` crossing stabilization threshold; consumed by B5 IO-from-lease-up + refi timing |
| 9.11 | **Ladder accuracy** | Rent roll at close | `expectedMoveOuts` = `expirations × (1 − renewalRate)` |
| 9.12 | **Pro forma bridge** | M07→M09 integration | `DemandContext` feeds pro forma without manual translation; `rentPath` is per-lease-grain |

---

## 10. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `TrafficPredictionEngine` output shape changes | Medium | High | AbsorptionEngine accepts generic `weeklyTrafficForecast: number[]`, not engine-specific types |
| Conversion registry migration stalls at step 3 | Medium | Medium | Old services stay as thin delegates indefinitely; no forced deletion |
| Rent roll schema diverges from ladder needs | Low | High | Ladder reads `lease_end_date` only; any rent roll with that field works |
| Phase 2 address grain requires schema migration | Low | High | `address` is structural now; migration is data backfill, not schema change |
| **CoStar-lineage data contamination** | Low | **High** | **Supply inputs = permits/Census ONLY; no calibration/validation against CoStar-derived data; CE pairs against CoStar-lineage rows remain deal-scoped/restricted per I1-EXTENSION firewall. The Highlands submarket cross-read is observational only — confirms the engine's independent narrative but contributes ZERO coefficients.** |
| Cell-phone/foot-traffic privacy/licensing | Medium | High | Treat sourcing with same firewall rigor as CoStar: whose license, what redistribution rights, does it enter any training corpus |
| Back-test graded on training data (fabricated confidence) | Medium | High | Held-out validation only; error bars INCLUDE misses; per-signal-profile accuracy; confidence decays with staleness |

---

## 11. DECISION LOG

| # | Decision | Ruling / Source | Rationale |
|---|----------|-----------------|-----------|
| 1 | `property_id` is the Phase 1 lens | R1 | Address grain is schema-ready but not resolved; geocoding is Phase 2 |
| 2 | Weekly atom, monthly rollup | R2 | Revenue management cadence is weekly; monthly is consumer-derived |
| 3 | `TenYearProjectionService` retired, not adapted | R2 | Decay model is wrong abstraction for absorption; `DemandContext` replaces it |
| 4 | Land deferred | R3 | Existing + lease-up is enough to prove the engine; land is one more inference case |
| 5 | One conversion registry, not wiring-first | R4 | Wiring-first created the P0; B1 precedent demands consolidation |
| 6 | Comp bridge socketed, not built | R5 | Interface is ready; implementation is Phase 2 consumer work |
| 7 | P0 explicitly OUT of scope | SPEC II. P0 section | Live defect ships independently; design inherits corrected stage-labeling |
| 8 | Per-lease roll-to-market (not uniform growth) | SPEC II.13 | Ladder is the rent engine; loss-to-lease ($588K) is invisible to uniform models |
| 9 | Provenance stamps on every row | SPEC II.3 / II.14 | `estimate_tier` + `fallback_rung` + `confidence_band` — no row without all three |
| 10 | CoStar firewall in risk register | SPEC II.1 / II.2 / II.4 | Supply = permits/Census only; observational cross-read confirmed but quarantined |
| 11 | Canonical keys deferred to Wave 1 module | Review gate CHECK 4 | `DealMode` and `StageLabel` literals declared now; reconciliation with `backend/src/types/canonical-keys.ts` is a Wave 1 unification task |

---

**Status:** DESIGN REVISED — ready for re-review against REVIEW_GATE_ABSORPTION_PHASE1_DESIGN.md.
