# LEASE VELOCITY ENGINE — IMPLEMENTATION SPEC

**Status:** Draft v1.1
**Owner:** M07 Traffic Engine ↔ M09 ProForma/Projections
**Target executor:** Replit Agent (with reference back to Claude Code for engine-level work)
**Depends on (must ship first or in parallel):**
  - `M07_SCHEMA_EXTENSION_FOR_LEASE_VELOCITY_ENGINE_SPEC` ← **ship before backend LV implementation**
  - `M07_SUBJECT_HISTORY_AND_DIFF_EXTRACTOR_SPEC.txt`
  - `CONCESSION_ENVIRONMENT_SUB_ENGINE_SPEC.txt`
  - `M07_PROJECTIONS_INTEGRATION_SPEC.txt`
  - `INLINE_ASSUMPTION_BLOCK_COMPONENT_SPEC.txt`
**Data layer sources (per architecture diagram):**
  - **M07 Traffic Engine** — subject_history, peer_set, expiration_waterfall, renewal_rate,
    turnover_rate, days_vacant_median, seasonality_curve, absorption_curve, avg_market_rent,
    avg_lease_term, loss_to_lease_pct, funnel_conversions, mode block, move_in_lag,
    absorption_capacity, stabilization, pre_lease_signing_curve
  - **Concession Env Engine** (sub-engine within M07) — per_year concession environment payload
  - **M04 Supply Pipeline** — supply_pressure_score, peer_max_absorption_pace_for_class_msa
  - **M22** (V2 modes only) — capex_schedule, delivery phasing
**Unblocks:** Live, defensible Year-1 monthly Projections for any deal
                  Per-deal lease-up reserve calculation that flows to S&U
                  Marketing-budget sizing (downstream)

---

## 1. PURPOSE

This engine answers two related operating questions for any multifamily deal:

1. **For new construction** with zero or partial pre-leasing — what does the leasing ramp to 95% occupancy look like, month-by-month, including the sign vs move-in distinction and the full cost of getting there?

2. **For existing properties** — how many leases need to be signed each month to maintain 95% (or to recover from a sub-stabilized starting point), and what does that cost in concessions, loss-to-lease, marketing, and other leasing-related expenses?

Both questions share the same underlying engine. The mode classification determines which formulas apply per period.

The engine produces:
- A monthly forward table (24–36 months) showing leases signed, move-ins, occupancy, and full cost stack
- A ramp chart with stabilization marker and pre-lease pipeline visualization
- A narrative summary suitable for an investment memo
- LayeredValue outputs that flow to F9 Sources & Uses, Pro Forma, and Projections

---

## 2. MODE TAXONOMY

V1 covers three modes. V2 adds three more.

### V1 modes (this spec)

| Mode | Trigger condition | Primary use |
|---|---|---|
| `LEASE_UP_NEW_CONSTRUCTION` | Year built ≤ 24 months ago AND current occupancy < 80% AND no prior lease history | Ground-up development, recent delivery |
| `STABILIZED_MAINTENANCE` | Current occupancy ≥ 90% AND no active CapEx displacing units | Acquisition of stabilized asset |
| `OCCUPANCY_RECOVERY` | Current occupancy 70–90% AND no active CapEx | Distressed acquisition, mismanaged asset, post-tenant-flight recovery |

### V2 modes (deferred)

| Mode | Reason for V2 |
|---|---|
| `LEASE_UP_PHASED_DELIVERY` | Multi-building sequential delivery; needs per-building absorption tracking |
| `VALUE_ADD_REPOSITIONING` | Renovated vs legacy cohort bifurcation; depends on M22 capex_schedule integration |
| `REDEVELOPMENT_ACTIVE` | Active CapEx with units down; depends on M22 + M07 dilution model |

---

## 3. MODE SELECTION LOGIC

**Mode resolution belongs to M07, not to the Lease Velocity Engine.** M07 computes the `ModeBlock` and exposes it at `dealContext.traffic.mode`. The Lease Velocity Engine reads `dealContext.traffic.mode.effective` only.

```typescript
// What M07 assembles in dealContext.traffic.mode:
interface ModeBlock {
  resolved: LeaseMode;                          // automatic classification result
  resolution_reasoning: string;                 // audit trail, e.g. "Built 2024, 18 months old, 12% occupied"
  resolution_confidence: 'high' | 'medium' | 'low';
  user_override: LayeredValue<LeaseMode> | null; // null if not overridden; writes from deal.lease_mode_override
  effective: LeaseMode;                          // = user_override ?? resolved — this is what LV consumes
}

// Resolution logic lives in M07 (backend/src/services/m07/):
function resolveMode(dealContext: DealContext): {
  resolved: LeaseMode;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const yearBuilt = dealContext.deal.year_built;
  const currentYear = new Date().getFullYear();
  const ageMonths = (currentYear - yearBuilt) * 12;

  const currentOcc = dealContext.traffic?.subject_history
    ?.current_state?.units_occupied / dealContext.deal.total_units;

  const hasActiveCapex = dealContext.capex_schedule?.has_active_phase ?? false;

  if (ageMonths <= 24 && currentOcc < 0.80 && !dealContext.has_prior_history) {
    return { resolved: 'LEASE_UP_NEW_CONSTRUCTION', reasoning: '...', confidence: 'high' };
  }
  if (currentOcc >= 0.90 && !hasActiveCapex) {
    return { resolved: 'STABILIZED_MAINTENANCE', reasoning: '...', confidence: 'high' };
  }
  if (currentOcc >= 0.70 && currentOcc < 0.90 && !hasActiveCapex) {
    return { resolved: 'OCCUPANCY_RECOVERY', reasoning: '...', confidence: 'high' };
  }
  if (hasActiveCapex && currentOcc < 0.95) {
    return { resolved: 'V2_PENDING_VALUE_ADD', reasoning: '...', confidence: 'medium' };
  }
  return { resolved: 'STABILIZED_MAINTENANCE', reasoning: 'fallback', confidence: 'low' };
}
```

**How the LV Engine reads mode:**
```typescript
// In lease-velocity-engine.ts:
const mode = dealContext.traffic.mode.effective;  // always use this; never re-resolve
const isOverridden = dealContext.traffic.mode.user_override != null;
```

The user can override via the deal-settings panel. Override stored on `deal.lease_mode_override`; PATCH writes it to `dealContext.traffic.mode.user_override` (LayeredValue) which M07 resolves into `effective`.

When mode is overridden, the engine displays a small badge on the lease-up output: `MODE OVERRIDDEN: STABILIZED → OCCUPANCY_RECOVERY`. The ↺ AUTO button on the frontend clears `lease_mode_override` to null, returning M07 to the auto-resolved `effective` value.

---

## 4. FUNNEL LAYER TAXONOMY (CANONICAL)

Three layers, distinct terminology. This taxonomy aligns the Replit agent output, the M07 Traffic Engine, the Cashflow Agent, and the Investment Memo synthesis.

| Layer | Term | What it measures | Where it lives | Currently calibrated? |
|---|---|---|---|---|
| Top of funnel | **Prospect Volume** | Inquiries, web/foot visits, lead form submissions | Future M07 enhancement | No — derived from signing layer via conversion ratios |
| Middle of funnel | **Funnel Conversion** | Stage-to-stage conversion ratios (prospect→tour, tour→app, app→approval, approval→lease) | LayeredValue with platform/peer/subject blend | Platform defaults today; peer set when leasing-CRM data integrated; subject when uploaded |
| Bottom of funnel | **Signing Velocity** | Signed leases per period | M07 current output | Yes — calibrated against subject history (S2+) and peer set |

The Lease Velocity Engine's primary output is at the **Signing Velocity** layer (signed leases per period). This is what M07 actually feeds today.

**Implied Prospect Volume** is a derived metric:

```
implied_prospect_volume[month] = signed_leases_needed[month]
                                 / overall_conversion_rate

overall_conversion_rate = (prospect→tour)
                        × (tour→application)
                        × (application→approval)
                        × (approval→lease)
```

### Default conversion ratios by mode

These are platform defaults, all LayeredValue-wrapped, override-able by user. Tuned against industry benchmarks (NMHC marketing surveys, leasing-CRM aggregates).

| Stage | LEASE_UP | STABILIZED | RECOVERY |
|---|---|---|---|
| prospect→tour | 0.18 | 0.25 | 0.22 |
| tour→application | 0.30 | 0.40 | 0.35 |
| application→approval | 0.65 | 0.75 | 0.70 |
| approval→lease | 0.85 | 0.90 | 0.88 |
| **Overall** | **~0.030** (30 prospects per signed lease) | **~0.067** (15 prospects per signed lease) | **~0.048** (21 prospects per signed lease) |

Higher tire-kicker rate in lease-up (more browsing of "the new building"); higher conversion in stabilized (interested prospects know the property). Recovery falls between.

---

## 5. COST TREATMENT TOGGLE

Per Leon's confirmation of option (c): toggle exists in two places.

### Location A — Deal settings panel (default for the deal)

Path: `Deal Settings → Financial Treatment → Leasing Cost Treatment`

Stored: `deal.leasing_cost_treatment` — enum `OPERATING | CAPITALIZED | HYBRID`

Default: `HYBRID` (institutional standard, GAAP-aligned for concession amortization)

### Location B — F9 Pro Forma top-bar toggle (scenario view)

Allows the user to view the same model under all three treatments without changing the deal default. Useful for LP deck presentation (CAPITALIZED) vs internal underwriting (HYBRID).

Toggle does NOT modify `deal.leasing_cost_treatment` — it's a view-state override.

### Treatment behavior

| Cost layer | OPERATING | CAPITALIZED | HYBRID |
|---|---|---|---|
| Lease-up concessions (lease-up months only) | Operating expense, monthly | S&U line item (one-time capital) | Amortized as effective-rent reduction over each lease term |
| Stabilized concessions (post-stabilization) | Operating expense | Operating expense | Amortized as effective-rent reduction |
| Marketing spend | Operating expense | S&U line for lease-up portion; OpEx after stabilization | Operating expense throughout |
| Locator/broker fees | Operating expense | S&U line for lease-up portion; OpEx after stabilization | Amortized over lease term as effective-rent reduction |
| Make-ready / turn costs | Operating expense | Operating expense | Operating expense |
| Lease-up operating reserve | Not applicable | S&U line for cumulative negative cash flow during ramp | S&U line (same as CAPITALIZED) |
| LTL | Always reflected as effective-rent gap (not a P&L line) | Same | Same |
| Bad debt | Operating expense | Operating expense | Operating expense |

**Key invariant:** Total cash spent on leasing is identical across all three treatments. Only presentation differs.

### Propagation

```
deal.leasing_cost_treatment changes
  → dealStore emits 'leasing_cost_treatment.changed'
  → F9 Sources & Uses re-renders (lease-up reserve and marketing capital lines appear/disappear)
  → F9 Pro Forma re-renders (Year 1 NOI shifts based on what's in OpEx)
  → F9 Projections re-renders (monthly concession line behaves differently)
  → F9 Returns recalcs (IRR, equity multiple respond to S&U-vs-OpEx shift)
  → JEDI Score recalcs (Position sub-score sensitive to stabilized NOI clarity)
```

---

## 6. INPUTS SPECIFICATION

### Required user inputs

| Input | Type | Required | Default | Notes |
|---|---|---|---|---|
| `total_units` | integer | yes | from `dealContext.deal` | Cannot be inferred |
| `mode` | enum | resolved automatically | resolved by §3 logic | User can override |
| `target_occupancy` | percent | yes | 0.95 | Stabilization target |
| `stabilization_definition` | enum | no | `PHYSICAL_95` | Options: `PHYSICAL_95`, `ECONOMIC_95`, `AGENCY_90_30_60_90` |
| `leasing_cost_treatment` | enum | no | `HYBRID` | Per §5 |
| `time_horizon_months` | integer | no | mode-dependent | `LEASE_UP`: 36, `STABILIZED`: 24, `RECOVERY`: catch-up + 12 |

### Mode-specific inputs

#### `LEASE_UP_NEW_CONSTRUCTION`

| Input | Type | Required | Default | Notes |
|---|---|---|---|---|
| `delivery_month` | month index or date | yes | from M22 schedule | Month of CO / first occupancy |
| `pre_leased_count` | integer | no | 0 | Number of leases signed pre-CO |
| `pre_lease_window_months` | integer | no | 6 | How far back signing extended |
| `sign_to_move_in_lag_days` | integer | no | 21 | Subject-sourced if available |
| `marketing_intensity` | enum | no | `MARKET` | `LOW` / `MARKET` / `AGGRESSIVE` — drives conversion + cost |

#### `STABILIZED_MAINTENANCE`

| Input | Type | Required | Default | Notes |
|---|---|---|---|---|
| `current_occupancy` | percent | yes | from rent roll | Actual not assumed |
| `concession_strategy` | enum | no | `MARKET` | `CONSERVATIVE` / `MARKET` / `AGGRESSIVE` — multiplier on engine output |

#### `OCCUPANCY_RECOVERY`

| Input | Type | Required | Default | Notes |
|---|---|---|---|---|
| `current_occupancy` | percent | yes | from rent roll | Starting point |
| `catch_up_period_months` | integer | yes | 12 | User specifies stabilization timeline |
| `concession_strategy` | enum | no | `AGGRESSIVE` | Recovery typically requires above-market concessions |

### Engine-resolved inputs (NOT user-input — sourced from dealContext.traffic)

All sourced from the M07-assembled `dealContext.traffic` payload per the M07 Schema Extension spec. LV Engine reads; does not compute.

```
// Existing M07 fields
dealContext.traffic.renewal_rate                     LayeredValue<number>
dealContext.traffic.turnover_rate                    LayeredValue<number>  // = 1 - renewal_rate
dealContext.traffic.days_vacant_median               LayeredValue<number>
dealContext.traffic.seasonality_curve                LayeredValue<number[12]>
dealContext.traffic.expiration_waterfall             LayeredValue<number[]>
dealContext.traffic.trade_out_new                    LayeredValue<number>
dealContext.traffic.trade_out_renewal                LayeredValue<number>
dealContext.traffic.concession_environment           ConcessionEnvBlock    // Concession Sub-Engine output
dealContext.traffic.loss_to_lease_pct                LayeredValue<number>
dealContext.traffic.avg_market_rent                  LayeredValue<number>
dealContext.traffic.avg_in_place_rent                LayeredValue<number>

// New M07 Schema Extension fields (Groups A–F)
dealContext.traffic.mode.effective                   LeaseMode             // Group D — the operating mode
dealContext.traffic.mode.user_override               LayeredValue<LeaseMode> | null
dealContext.traffic.funnel_conversion.active         ConversionStageSet    // Group A — by-mode conversion ratios
dealContext.traffic.absorption_capacity              AbsorptionCapacityBlock  // Group B
  .peer_max_monthly_pace                             LayeredValue<number>  // ceiling from M04
  .current_mode_curve                                LayeredValue<number[]>  // 24-month mode-aware curve
  .saturation_threshold                              LayeredValue<number>  // default 0.85
  .velocity_decay_post_saturation                    LayeredValue<number>  // default 0.50
dealContext.traffic.move_in_lag                      MoveInLagBlock        // Group C
  .distribution                                      LayeredValue<MoveInLagBuckets>
  .median_lag_days                                   LayeredValue<number>
  .source_quality                                    'subject' | 'peer_set' | 'platform_default'
dealContext.traffic.stabilization                    StabilizationBlock    // Group E
  .ceiling_occupancy                                 LayeredValue<number>  // default 0.95
  .definition                                        LayeredValue<StabilizationDefinition>
  .achieved                                          boolean
  .achieved_month                                    number | null
dealContext.traffic.pre_lease_signing_curve          LayeredValue<number[]>  // §3.3 PRE_LEASE curve
dealContext.traffic.property_reference               PropertyReferenceBlock   // Group F — getter pointers
  .total_units, .avg_market_rent, .avg_lease_term_months, .unit_mix, etc.

// Supply pressure from M04 (surfaced via M07)
dealContext.traffic.coefficients.supply_pressure_score  LayeredValue<number[60]>
```

---

## 7. PRE-LEASING DISTRIBUTION ALGORITHM

Critical for `LEASE_UP_NEW_CONSTRUCTION` mode. Two timelines, separately tracked.

### 7.1 Signing timeline distribution

Pre-lease signings are distributed backward from delivery month using a sigmoid-style curve.

```typescript
const PRE_LEASE_SIGNING_CURVE_6MO = [
  0.05,   // delivery - 6  (early pre-lease, hard to sign without model unit)
  0.08,   // delivery - 5
  0.12,   // delivery - 4
  0.15,   // delivery - 3
  0.18,   // delivery - 2  (model unit ready, marketing ramping)
  0.22,   // delivery - 1  (visible delivery, urgency drives signs)
  0.20    // delivery + 0  (CO month, last cohort signs)
];
// Sums to 1.00
```

Distribution:
```typescript
function distributePreLeaseSignings(
  preLeasedCount: number,
  deliveryMonth: number,
  windowMonths: number = 6
): Map<number, number> {
  const signings = new Map<number, number>();
  const curve = getCurve(windowMonths);  // adjust curve length to window
  let allocated = 0;

  for (let k = windowMonths; k >= 0; k--) {
    const month = deliveryMonth - k;
    const count = Math.floor(preLeasedCount * curve[windowMonths - k]);
    signings.set(month, count);
    allocated += count;
  }

  // Carry remainder into delivery month due to flooring
  const remainder = preLeasedCount - allocated;
  if (remainder > 0) {
    signings.set(deliveryMonth, signings.get(deliveryMonth)! + remainder);
  }

  return signings;
}
```

### 7.2 Move-in distribution from sign date

For each signed lease, the move-in date follows a lag distribution. Default for 21-day average lag:

```typescript
const MOVE_IN_LAG_DISTRIBUTION_DEFAULT = {
  same_month_as_sign:   0.30,
  one_month_after:      0.55,
  two_months_after:     0.13,
  three_months_after:   0.02
};
```

**Hard constraint:** Move-in cannot occur before `delivery_month`. Any computed move-in earlier than CO is clamped forward to CO.

```typescript
function distributeMoveIns(
  signingsByMonth: Map<number, number>,
  deliveryMonth: number,
  lagDistribution: typeof MOVE_IN_LAG_DISTRIBUTION_DEFAULT
): Map<number, number> {
  const moveIns = new Map<number, number>();

  for (const [signMonth, signCount] of signingsByMonth) {
    for (const [lagKey, weight] of Object.entries(lagDistribution)) {
      const lagOffset = lagKeyToMonths(lagKey);  // 0, 1, 2, 3
      const targetMonth = Math.max(deliveryMonth, signMonth + lagOffset);
      const moveInThisCohort = signCount * weight;
      moveIns.set(
        targetMonth,
        (moveIns.get(targetMonth) ?? 0) + moveInThisCohort
      );
    }
  }

  // Round to integers, allocate remainders to delivery month
  return roundAndReconcile(moveIns, deliveryMonth);
}
```

### 7.3 Worked example

Inputs:
- `pre_leased_count = 47`
- `delivery_month = month 7` (calendar Jul 2026 in this example)
- `pre_lease_window_months = 6`
- `sign_to_move_in_lag_days = 21` → use default lag distribution

Step 1 — Distribute signings:

| Month index | Curve weight | Signed leases |
|---|---|---|
| 1 | 0.05 | 2 |
| 2 | 0.08 | 4 |
| 3 | 0.12 | 6 |
| 4 | 0.15 | 7 |
| 5 | 0.18 | 8 |
| 6 | 0.22 | 10 |
| 7 (delivery) | 0.20 | 9 + remainder = 10 |
| **Total** | **1.00** | **47** |

Step 2 — Distribute move-ins (clamping pre-CO move-ins to delivery month):

| Source sign month | Signs | Move-ins month 7 | Month 8 | Month 9 | Month 10 |
|---|---|---|---|---|---|
| 1 | 2 | 2 (clamped from months 1-4) | 0 | 0 | 0 |
| 2 | 4 | 4 (clamped) | 0 | 0 | 0 |
| 3 | 6 | 6 (clamped) | 0 | 0 | 0 |
| 4 | 7 | 7 (clamped) | 0 | 0 | 0 |
| 5 | 8 | 8 (clamped) | 0 | 0 | 0 |
| 6 | 10 | 9 (30%+55% clamped) | 1 (13% to month 8) | 0 | 0 |
| 7 | 10 | 3 (30%) | 5 (55%) | 1 (13%) | 0 (2%) |
| **Total move-ins** | | **39** | **6** | **1** | **0** |

Hmm, that totals 46. The remaining 1 move-in is the 2% three-month-after cohort from later signings — pushed to month 10.

Cumulative occupancy (47 pre-leased only, before ongoing absorption):

| Month | Pre-lease move-ins | Cumulative occupied | Occupancy % |
|---|---|---|---|
| 6 | 0 (pre-CO) | 0 | 0% |
| 7 (CO) | 39 | 39 | 13% (assuming 308-unit asset) |
| 8 | 6 | 45 | 15% |
| 9 | 1 | 46 | 15% |
| 10 | 1 | 47 | 15% |

Then ongoing absorption (§8) continues from month 7+1.

**Read of the example:** the CO month gets a concentrated move-in surge (39/47 = 83%) because all pre-CO signings clamp to CO. This is realistic — visit any new lease-up in its CO month and you'll see a moving-truck queue.

### 7.4 Subject-sourced lag distribution (when available)

The lag distribution is not computed in the LV Engine — it is read from `dealContext.traffic.move_in_lag` assembled by M07:

```typescript
// LV Engine reads:
const lagDist = dealContext.traffic.move_in_lag?.distribution
  ?? buildPlatformDefaultMoveInLag();  // defensive fallback during cache transition

const sourceQuality = dealContext.traffic.move_in_lag?.source_quality;
// 'subject'           → high confidence, both date fields present in rent roll
// 'peer_set'          → medium confidence
// 'platform_default'  → low confidence, flag in narrative
```

Subject-sourced when a property has 2+ rent roll snapshots with both `lease_start_date` AND `move_in_date` populated (Yardi typically yes). M07's parser flags `quality_flags.move_in_date_missing` when `move_in_date` is absent — in that case M07 uses platform default rather than treating `move_in = lease_start` (which would imply zero lag).

**Field-availability caveat:** Yardi rent rolls typically have both fields. Some other parsers (RealPage older versions, OneSite manual exports) only have one. The parser_normalizer must flag when the lag-distribution-from-subject is unavailable so the resolver falls back to peer/platform without silent error.

---

## 8. MODE 1 — LEASE_UP_NEW_CONSTRUCTION ALGORITHM

### 8.1 Pre-delivery period (months < delivery_month)

- `signs[m]` = from §7.1 distribution
- `move_ins[m] = 0` (cannot move in pre-CO)
- `cumulative_occupied[m] = 0`
- `occupancy[m] = 0`
- `gpr[m] = 0`
- `concession_amortization[m] = 0` (concessions amortize starting at move-in)
- `marketing_spend[m]` = pre-leasing campaign spend (from cost stack)
- `opex[m] = 0` (property doesn't exist as operating asset yet)

### 8.2 Delivery month

- `move_ins[delivery_month]` = pre-lease pipeline arriving (from §7.2)
- `cumulative_occupied[delivery_month]` = sum of move-ins to date
- `gpr[delivery_month]` = `cumulative_occupied × avg_market_rent / 12` (monthly)
- `concession_amortization[delivery_month]` begins for each lease that moves in
- `marketing_spend[delivery_month]` = ongoing marketing rate
- `opex[delivery_month]` = full operating expense run rate (taxes, insurance, payroll, R&M start full)
- `lease_up_reserve_burn[delivery_month]` = `gpr - opex - debt_service` (negative)

### 8.3 Post-delivery absorption

For each month n > delivery_month, ongoing signings follow the LEASE_UP S-curve:

```typescript
function absorptionCurve(
  monthsSinceDelivery: number,
  remainingUnitsToLease: number,
  supplyPressure: number,
  marketingIntensity: 'LOW' | 'MARKET' | 'AGGRESSIVE',
  absorptionCapacity: AbsorptionCapacityBlock  // from dealContext.traffic.absorption_capacity
): number {
  // S-curve sourced from M07 LayeredValue (platform default → peer-set calibrated → subject)
  const baseCurve = absorptionCapacity.current_mode_curve.value[monthsSinceDelivery];
  const supplyAdj = 1 - 0.5 * (supplyPressure - 0.5);  // tighter market faster
  const intensityAdj = { LOW: 0.85, MARKET: 1.00, AGGRESSIVE: 1.15 }[marketingIntensity];

  // Saturation slowdown: once occupancy passes saturation_threshold, pace decays
  const saturationThreshold = absorptionCapacity.saturation_threshold.value;  // default 0.85
  const currentOcc = (absorptionCapacity as any)._currentOcc ?? 0;  // injected by engine loop
  const saturationMult = currentOcc >= saturationThreshold
    ? absorptionCapacity.velocity_decay_post_saturation.value  // default 0.50
    : 1.0;

  return baseCurve * supplyAdj * intensityAdj * saturationMult;
}

// Platform-default curve (LEASE_UP_S_CURVE_24MO) lives in M07 defaults module.
// LV Engine reads it from dealContext.traffic.absorption_capacity.current_mode_curve.value.
// Do NOT hardcode the array here — read from dealContext to respect LayeredValue overrides.
//
// For reference, the platform default values:
// [0.06, 0.07, 0.08, 0.10, 0.12, 0.13, 0.13, 0.13, 0.12, 0.10, 0.08, 0.07,
//  0.05, 0.04, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.005]
// Approximately sums to 1.00 — tunable via M07 admin layer
```

### 8.4 Concession decay during ramp

Per `CONCESSION_ENVIRONMENT_SUB_ENGINE_SPEC §4.5` LEASE_UP overlay:

```
concession_per_lease[n] = concession_environment.baseline × DECAY_CURVE_24MO[n]
```

Where `DECAY_CURVE_24MO` runs from 1.00 at month 1 down to ~0.05 at month 24.

For each move-in event in month `n`, the concession is recorded:
- Total dollar value: `concession_per_lease[n]` (e.g., 8 weeks free × monthly_rent / 4.33)
- Amortization: spread across lease term starting at move-in month

### 8.5 Stabilization detection

```typescript
function isStabilized(
  occupancy: number,
  monthIndex: number,
  stabilizationDefinition: 'PHYSICAL_95' | 'ECONOMIC_95' | 'AGENCY_90_30_60_90'
): boolean {
  switch (stabilizationDefinition) {
    case 'PHYSICAL_95':
      return occupancy >= 0.95;
    case 'ECONOMIC_95':
      return economicOccupancy(monthIndex) >= 0.95;
    case 'AGENCY_90_30_60_90':
      return agencyStabilizationCheck(occupancy, monthIndex);
  }
}
```

When `isStabilized()` returns true, the engine flags the month as stabilization point and switches future months to STABILIZED mode formulas.

### 8.6 Renewal cohort transition

Pure lease-up has zero renewals during ramp. The first cohort of leases (from month 1–6 of pre-leasing) starts expiring 12 months after their respective move-in dates.

For each move-in event in month `n` with `lease_term_months = T`:
- That lease expires at month `n + T`
- At month `n + T`, the lease is added to `expiration_waterfall` going forward
- Renewal/turnover logic activates per STABILIZED mode for those expirations

This means the engine smoothly transitions:
- Months 1–18: pure absorption, no renewals
- Months 13–30: mixed absorption + first-cohort renewals
- Months 24+: primarily renewals + replacement (effectively stabilized maintenance)

---

## 9. MODE 2 — STABILIZED_MAINTENANCE ALGORITHM

### 9.1 Per-month flow

For each month `n` in horizon:

```typescript
function stabilizedMonth(n: number, dealContext: DealContext): MonthOutput {
  // 1. Expirations from waterfall
  const expirations = dealContext.traffic.expiration_waterfall[n];

  // 2. Renewals (subject-blended)
  const renewalRate = dealContext.traffic.renewal_rate.value;
  const renewals = Math.round(expirations * renewalRate);

  // 3. Replacement leases needed
  const replacementLeases = expirations - renewals;

  // 4. Days-vacant correction
  const daysVacantMedian = dealContext.traffic.days_vacant_median.value;
  const daysVacantDragPct = (replacementLeases * daysVacantMedian)
                             / (dealContext.deal.total_units * 30);
  // Drag is the additional units of "lost occupancy time" per month

  // 5. Occupancy this month
  const targetOcc = userInputs.target_occupancy ?? 0.95;
  const impliedSignedOcc = targetOcc + daysVacantDragPct;
  const occupiedUnits = Math.floor(dealContext.deal.total_units * impliedSignedOcc);

  // 6. New leases needed (= replacement, since no growth target)
  const newLeasesNeeded = replacementLeases;

  // 7. Cost stack
  const costs = computeCostStack(n, {
    new_leases: newLeasesNeeded,
    renewals: renewals,
    mode: 'STABILIZED'
  });

  // 8. Implied prospect volume (if user requested funnel view)
  const overallConversion = computeOverallConversion(
    dealContext.traffic.funnel_conversion_ratios,
    'STABILIZED'
  );
  const impliedProspects = newLeasesNeeded / overallConversion;

  return {
    month: n,
    expirations,
    renewals,
    new_leases_needed: newLeasesNeeded,
    occupancy: impliedSignedOcc,
    occupied_units: occupiedUnits,
    implied_prospects: impliedProspects,
    costs
  };
}
```

### 9.2 Days-vacant correction in detail

The 95% target assumes steady-state matching. In reality:

```
138 turnovers/year × 21 days vacant median / 365 days = 7.9 unit-years lost
7.9 / 308 units = 2.6% occupancy drag

Therefore: to net 95% paid occupancy, signed-lease occupancy must average 97.6%
```

This drag is subject-sourced (M07 `days_vacant_median`) with peer fallback. When drag is high (slow re-leasing market), more aggressive signing is needed to maintain target.

### 9.3 Concession application

`CONCESSION_ENVIRONMENT_SUB_ENGINE` produces per-month concession environment. Engine applies:

```
new_lease_concession_total[n] = newLeasesNeeded × concession_env.new_lease_per_unit[n]
                                × concession_strategy_multiplier
renewal_concession_total[n]    = renewals × concession_env.renewal_per_unit[n]
                                × concession_strategy_multiplier × renewal_pct_receiving

// Strategy multipliers
concession_strategy_multiplier = {
  CONSERVATIVE: 0.7,
  MARKET:       1.0,
  AGGRESSIVE:   1.3
}[userInputs.concession_strategy]
```

---

## 10. MODE 3 — OCCUPANCY_RECOVERY ALGORITHM

### 10.1 Gap calculation

```typescript
function recoveryMonth(n: number, dealContext: DealContext): MonthOutput {
  const totalUnits = dealContext.deal.total_units;
  const targetOcc = userInputs.target_occupancy ?? 0.95;
  const startOcc = userInputs.current_occupancy;
  const catchUpMonths = userInputs.catch_up_period_months ?? 12;

  // Replacement (same as stabilized)
  const expirations = dealContext.traffic.expiration_waterfall[n];
  const renewalRate = dealContext.traffic.renewal_rate.value;
  const renewals = Math.round(expirations * renewalRate);
  const replacementLeases = expirations - renewals;

  // Gap-close pace
  const gapUnits = (targetOcc - startOcc) * totalUnits;
  const seasonalAdjust = SEASONAL_LEASING_PACE[n % 12];  // 0.7-1.4 multiplier
  const gapCloseLeasesThisMonth =
    n <= catchUpMonths
      ? (gapUnits / catchUpMonths) * seasonalAdjust
      : 0;

  // Total new leases needed
  const newLeasesNeeded = Math.round(replacementLeases + gapCloseLeasesThisMonth);

  // Occupancy progression
  const cumulativeGapClosed = sumGapCloseLeasesUpToMonth(n);
  const currentOcc = startOcc + (cumulativeGapClosed / totalUnits);

  // Cost stack with AGGRESSIVE concession default
  const costs = computeCostStack(n, {
    new_leases: newLeasesNeeded,
    renewals,
    mode: 'RECOVERY',
    concession_strategy: userInputs.concession_strategy ?? 'AGGRESSIVE'
  });

  return {
    month: n,
    expirations,
    renewals,
    replacement_leases: replacementLeases,
    gap_close_leases: gapCloseLeasesThisMonth,
    new_leases_needed: newLeasesNeeded,
    occupancy: currentOcc,
    costs
  };
}
```

### 10.2 Catch-up pace constraint

The user-supplied `catch_up_period_months` is feasibility-checked against M04 absorption capacity, surfaced via M07's `dealContext.traffic.absorption_capacity.peer_max_monthly_pace`. If pace required exceeds peer-set absorption max:

```typescript
// M04 supply pipeline feeds peer_max_monthly_pace into M07 absorption_capacity block
const peerMaxAbsorptionPace = dealContext.traffic.absorption_capacity
  ?.peer_max_monthly_pace?.value
  ?? buildPlatformDefaultAbsorptionCapacity(mode).peer_max_monthly_pace.value;  // defensive fallback

if (gapCloseLeasesThisMonth > peerMaxAbsorptionPace) {
  warningFlags.push({
    type: 'INFEASIBLE_CATCHUP_PACE',
    message: `Required pace of ${gapCloseLeasesThisMonth} leases/month
              exceeds peer-set max of ${peerMaxAbsorptionPace}. Recommend
              extending catch-up period to ${minimumFeasibleMonths} months.`
  });
}
```

Warning surfaces in the output narrative; does not auto-correct (user should consciously choose).

### 10.3 Seasonal leasing pace

```typescript
const SEASONAL_LEASING_PACE = [
  0.70,  // Jan
  0.75,  // Feb
  0.95,  // Mar
  1.10,  // Apr
  1.25,  // May
  1.35,  // Jun
  1.40,  // Jul (peak in most MSAs)
  1.35,  // Aug
  1.10,  // Sep
  0.95,  // Oct
  0.75,  // Nov
  0.65   // Dec
];
// Multipliers, normalized to 1.0 average over 12 months
// Subject-blended when subject seasonality_observed available (S2+)
```

---

## 11. FULL COST STACK

Every mode produces output across the full cost stack. Treatment toggle determines presentation (§5).

### 11.1 The eight cost layers

```typescript
interface CostStackPerMonth {
  // Direct leasing costs
  new_lease_concessions_onetime: number;      // ($/period)
  new_lease_concessions_ongoing: number;      // amortized ongoing rent abatement
  renewal_concessions_onetime: number;
  renewal_concessions_ongoing: number;

  // Indirect leasing costs
  marketing_spend: number;                    // per period
  locator_broker_fees: number;                // per period (lease-up only typical)
  make_ready_turn_costs: number;              // per turn × turn count
  bad_debt: number;                           // % of GPR

  // Effective-rent gap (not P&L line, but tracked)
  loss_to_lease_dollars: number;

  // Lease-up only
  lease_up_reserve_burn: number;              // negative cash flow this month
  cumulative_lease_up_reserve_drawn: number;  // running total

  // Totals
  total_leasing_p_and_l_impact: number;       // depends on treatment
  total_capitalized: number;                   // depends on treatment
  total_cash_outflow: number;                  // always equal regardless of treatment
}
```

### 11.2 Marketing spend by mode

| Mode | Per-lease spend | Per-month base spend |
|---|---|---|
| `LEASE_UP_NEW_CONSTRUCTION` | $1,800 | $8,000 (signage, web, agency) |
| `STABILIZED_MAINTENANCE` | $400 | $2,000 |
| `OCCUPANCY_RECOVERY` | $1,000 | $4,000 |

```
marketing_spend[n] = marketing_per_lease × new_leases_needed[n] + marketing_base_monthly
```

Subject-sourced when user has uploaded a marketing spend record (future M22 field). Today: peer/platform default.

### 11.3 Locator/broker fees

Apply when:
- `LEASE_UP_NEW_CONSTRUCTION` and `marketing_intensity = AGGRESSIVE`
- `OCCUPANCY_RECOVERY` and `concession_strategy = AGGRESSIVE`

```
locator_fee_per_lease = avg_market_rent × 0.50 to 1.00  (typically half-month to full-month)
locator_fees[n] = locator_fee_per_lease × new_leases_needed[n] × locator_pct_used
```

`locator_pct_used` = fraction of new leases sourced via locators (default 0.30 in lease-up, 0 in stabilized).

### 11.4 Make-ready / turn costs

```
turn_cost_per_unit = $1,500 (Class A), $1,000 (Class B), $700 (Class C)
                     // Subject-sourced when M22 actual turn cost data available
make_ready[n] = turn_cost_per_unit × (replacement_leases + gap_close_leases)
```

Lease-up has minimal turn cost (units are new) but still incurs punch-list cost for early move-ins.

### 11.5 Lease-up operating reserve

LEASE_UP mode only.

```
monthly_burn[n] = max(0, opex[n] + debt_service[n] - gpr[n])
cumulative_reserve_drawn = sum of monthly_burn from delivery_month forward
                           until cumulative becomes zero (cash positive)

lease_up_reserve_required = max value of cumulative_reserve_drawn over the ramp period
                          = peak negative cash position
```

This is the dollar amount that must be capitalized in S&U to fund the ramp. Always treated as S&U regardless of `leasing_cost_treatment` toggle (the reserve question is independent of concession treatment).

---

## 12. OUTPUT FORMAT

Three outputs per engine run.

### 12.1 Primary output — Monthly forward table

CSV/JSON structure consumable by the F9 Projections tab and exportable to Excel. Columns:

| Column | Type | Description |
|---|---|---|
| `month_index` | integer | 1-indexed from analysis start |
| `calendar_month` | string | YYYY-MM |
| `mode_for_month` | enum | `LEASE_UP` / `STABILIZED` / `RECOVERY` (transitions visible) |
| `expirations` | integer | from waterfall |
| `renewals` | integer | |
| `replacement_leases` | integer | (only meaningful in stabilized/recovery) |
| `gap_close_leases` | integer | (only meaningful in recovery) |
| `pre_lease_signings` | integer | (only meaningful in lease-up pre-CO) |
| `lease_up_signings` | integer | (only meaningful in lease-up post-CO) |
| `total_signings` | integer | Sum |
| `move_ins` | integer | |
| `move_outs` | integer | |
| `cumulative_occupied` | integer | |
| `physical_occupancy_pct` | percent | |
| `economic_occupancy_pct` | percent | (after concessions) |
| `gpr` | currency | |
| `vacancy_loss` | currency | |
| `concessions_new_lease` | currency | |
| `concessions_renewal` | currency | |
| `loss_to_lease_dollars` | currency | |
| `effective_rent` | currency | |
| `marketing_spend` | currency | |
| `locator_fees` | currency | |
| `make_ready` | currency | |
| `bad_debt` | currency | |
| `opex` | currency | |
| `noi` | currency | |
| `debt_service` | currency | |
| `cash_flow` | currency | |
| `lease_up_reserve_burn` | currency | (lease-up only, negative) |
| `cumulative_lease_up_reserve` | currency | (lease-up only, running total) |
| `implied_prospect_volume` | integer | (collapsible — funnel detail) |
| `stabilization_marker` | boolean | true on the month stabilization is achieved |

### 12.2 Secondary output — Ramp chart

Specs for the chart artifact:
- X-axis: month index, with calendar month labels
- Y-axis primary (left): occupancy percent
- Y-axis secondary (right): leases signed per month
- Lines: cumulative occupancy (solid), monthly signs (bars)
- Markers: delivery month (vertical line), stabilization month (vertical line, distinct color)
- Bands: target occupancy (shaded horizontal at 95%)
- Pre-lease pipeline visible as different-color bar segments before delivery

Chart styling: Bloomberg dark, T-token compliant, JetBrains Mono labels, no shadows, max 2px radius on markers.

### 12.3 Tertiary output — Narrative summary

Templated narrative, ~3–5 sentences per mode. Examples:

**LEASE_UP narrative template:**
```
{property_name} is modeled at {pre_leased_count} pre-leased units against
{total_units} total. Lease-up reaches {target_occupancy} by month
{stabilization_month} ({stabilization_calendar}), requiring an average of
{avg_monthly_signs} signed leases per month post-delivery. Total leasing
cost through stabilization: {total_concessions} in concessions
({pct_of_gpr}% of stabilized GPR), {marketing_total} in marketing,
{total_capitalized_under_hybrid} captured as lease-up reserve.
{warning_or_confidence_caveat}.
```

**STABILIZED narrative template:**
```
{property_name} requires approximately {avg_monthly_signs} signed leases
per month to maintain {target_occupancy} occupancy, including
{avg_renewals} renewals and {avg_new_leases} replacement leases. Annual
leasing cost: {total_annual_concessions} in concessions plus
{total_annual_marketing} in marketing, equal to {pct_of_gpr}% of stabilized
GPR. {seasonal_callout}. {confidence_caveat}.
```

**RECOVERY narrative template:**
```
{property_name} starts at {current_occupancy} and reaches {target_occupancy}
by month {catch_up_period_months} ({stabilization_calendar}). Required
pace: {peak_monthly_signs} leases in peak months. Recovery cost:
{total_concessions_during_recovery} in concessions ({concession_strategy}
posture), {total_marketing} in marketing, {locator_fees_total} in locator
fees. {feasibility_warning}. {confidence_caveat}.
```

---

## 13. THREE WORKED SCENARIOS

### 13.1 Scenario A — Lease-up of 250-unit Class B in Tampa Westshore

Inputs:
- 250 units, 1BR/2BR mix, avg market rent $1,800/mo
- Year built 2025, delivery month 2026-04 (month index 4 in analysis)
- Pre-leased 35 units before delivery
- Mode: `LEASE_UP_NEW_CONSTRUCTION`
- Stabilization target: PHYSICAL_95 (238 occupied)
- Marketing intensity: MARKET
- Cost treatment: HYBRID
- Time horizon: 36 months

Engine run produces:

| Phase | Months | Behavior |
|---|---|---|
| Pre-CO | 1-3 | 35 leases signed across the window per pre-lease curve. Marketing spend $24K total. |
| CO | 4 | 31 of 35 pre-lease pipeline moves in. Property at 12.4% occupied. Operating costs start full ($85K/mo). |
| Ramp Y1 (months 5-12) | 5-12 | S-curve absorption. Monthly signings rise from 14 → 22 → 26 peak in month 9. Concessions average 8 weeks free. |
| Ramp Y2 (months 13-21) | 13-21 | First cohort of leases starts expiring (month 16). Mixed absorption + renewal. Concessions decay to 4-6 weeks. |
| Stabilization | month 22 | 238th unit leased. Engine flags stabilization. Mode transitions to STABILIZED for forward months. |
| Post-stab | 23-36 | Full STABILIZED maintenance. 14 signs/mo to maintain 95%. |

Cost stack summary (HYBRID treatment):
- Total concessions during lease-up (months 4-22): $1.1M
- Total marketing: $215K
- Total locator fees: $42K
- Lease-up reserve required (peak negative cash): $480K
- Reserve appears as S&U line; concessions amortize as effective rent reduction

JEDI Score impact: Position sub-score reflects clean stabilized NOI signal from month 22+.

### 13.2 Scenario B — Stabilized 308-unit Class B acquisition in Westshore

Inputs:
- 308 units, current occupancy 94% (290 leased)
- Mode: `STABILIZED_MAINTENANCE`
- Target: 95%
- Subject history: S2 (one prior rent roll; 2.1% loss-to-lease, 38% turnover, $1,925 avg market rent)
- Concession strategy: MARKET
- Cost treatment: HYBRID
- Horizon: 24 months

Engine run produces:

Monthly average requirements (months 1-12):
- Expirations per month: average 11 (varies 4-19 by season)
- Renewals (62% subject-sourced): ~7
- Replacement leases needed: ~4
- Days vacant correction: 21 days median × 4 leases / 308 / 30 = 0.91% drag
- Effective signed-lease occupancy needed: 95.91% to net 95% paid

Annual cost stack (HYBRID):
- New lease concessions: $9,800 ($200/lease × 49 new leases/yr)
- Renewal concessions: $7,300 ($85/renewal × 86 renewals/yr)
- Marketing spend: $43,600 ($400/lease × 49 + $24K base)
- Make-ready: $86,000 ($1,000 × 86 turns)
- Bad debt: $66,400 (1% of $6.64M GPR)
- Total leasing P&L impact: $213K (3.2% of GPR)

Subject divergence: subject's 62% renewal rate vs peer 55% generates a HIGH-confidence collision. Surfaced in narrative: "Subject outperforms submarket on renewal retention. Possible drivers: above-average leasing team, superior curb appeal, pricing below market."

### 13.3 Scenario C — Recovery of 180-unit Class B in distressed Atlanta submarket

Inputs:
- 180 units, current occupancy 78% (140 leased)
- Mode: `OCCUPANCY_RECOVERY`
- Target: 95% (171 leased = +31 units)
- Catch-up period: 12 months
- Concession strategy: AGGRESSIVE (default)
- Cost treatment: HYBRID

Engine run produces:

Required pace:
- Replacement (12-month average): ~5/mo
- Gap close (12-month average): ~31/12 = 2.6/mo, seasonally adjusted (peak 3.6 in Q3, low 1.8 in Q1)
- Total signings needed peak month: 8-10 in summer
- M04 peer absorption max for Class B Atlanta submarket: 12/month — feasible

Monthly cost (Year 1):
- Concessions (AGGRESSIVE): $52K total ($1.3K/new lease vs $200 stabilized)
- Marketing: $48K total ($1,000/lease for recovery push)
- Locator fees: $36K (40% of new leases via locators)
- Make-ready: $60K
- Total leasing cost Year 1: ~$200K

Stabilization achieved month 12. Year 2 transitions to STABILIZED with much lower cost stack.

Warning: Peer-set days_vacant_median in Atlanta Class B is 38 days vs platform default 21 — recovery pace adjusted downward by 1.4× drag factor. Surfaced in narrative.

---

## 14. IMPLEMENTATION NOTES

### 14.1 File locations

```
backend/src/services/lease-velocity/
  index.ts                          # public API
  lease-velocity-engine.ts          # main orchestrator, mode dispatch
  modes/
    lease-up-new-construction.ts    # mode 1 algorithm
    stabilized-maintenance.ts       # mode 2 algorithm
    occupancy-recovery.ts           # mode 3 algorithm
  pre-lease-distribution.ts         # §7 algorithm
  cost-stack.ts                     # §11 cost computations
  funnel-conversion.ts              # §4 prospect/conversion/signing layer math
  output-formatter.ts               # §12 monthly table + chart + narrative
  curves/
    s-curve-lease-up.ts             # LEASE_UP_S_CURVE
    pre-lease-signing-curve.ts      # PRE_LEASE_SIGNING_CURVE
    move-in-lag-distribution.ts     # MOVE_IN_LAG_DISTRIBUTION_DEFAULT
    seasonal-leasing-pace.ts        # SEASONAL_LEASING_PACE
  __tests__/
    [test fixtures per scenario]
```

### 14.2 dealStore wiring

```typescript
// Engine subscribes to:
dealStore.subscribe('deal.lease_mode_override', recompute);
dealStore.subscribe('deal.leasing_cost_treatment', repropagate);
dealStore.subscribe('traffic.subject_history.updated', recompute);
dealStore.subscribe('concession_environment.updated', recompute);
dealStore.subscribe('lease_velocity.user_input', recompute);

// Engine emits:
dealStore.dispatch('lease_velocity.output.updated', { monthlyTable, chart, narrative });

// Downstream consumers re-read from dealContext.lease_velocity:
M07ProjectionsAdapter      // uses move-ins, cumulative_occupied, NOI build
F9SourcesAndUsesPanel      // uses lease_up_reserve_required (LEASE_UP only)
F9ReturnsTab               // recomputes IRR/EM with cost-treatment-aware cash flows
JediScoreEngine            // Position sub-score sensitive to stabilized NOI clarity
InvestmentMemoSynthesis    // narrative inclusion
```

### 14.3 dealContext payload

```typescript
dealContext.lease_velocity = {
  mode: LeaseMode,                         // = dealContext.traffic.mode.effective
  mode_resolved: LeaseMode,               // = dealContext.traffic.mode.resolved (auto-classified)
  mode_override_active: boolean,          // = dealContext.traffic.mode.user_override != null
  resolved_at: ISODateString,
  inputs: { ... user inputs ... },
  monthly_table: MonthOutput[],
  ramp_chart_data: RampChartSpec,
  narrative: string,
  warnings: WarningFlag[],
  lease_up_reserve_required: number | null,  // peak cumulative negative cash; null if not LEASE_UP mode
  confidence: 'high' | 'medium' | 'low',
  source_summary: {
    subject_history_used_for: string[],   // which coefficients came from subject
    peer_set_used_for: string[],
    platform_default_used_for: string[]
  }
};
```

Cached for 24h per existing DealContext caching rules. Recomputed on any subscribed event firing.

### 14.4 Component dependencies

UI components needed:
- `LeaseVelocityInputPanel` — collects required + optional inputs per mode
- `RampChartArtifact` — renders the §12.2 chart (uses existing T-token system)
- `MonthlyForwardTable` — renders §12.1 table (consumed by F9 Projections directly)
- `LeasingCostTreatmentToggle` — the F9 top-bar toggle (Location B per §5)
- `WarningFlagsPanel` — renders any flagged warnings (infeasible pace, etc.)

All components per `INLINE_ASSUMPTION_BLOCK_COMPONENT_SPEC` styling conventions (Bloomberg dark, T-tokens, JetBrains Mono).

---

## 15. TEST FIXTURES REQUIRED

Each mode must ship with at least three test scenarios covering:

| Test scenario | Mode | Validates |
|---|---|---|
| Pure new construction, zero pre-leasing | LEASE_UP | Default S-curve, full ramp from zero, lease-up reserve calculation |
| Heavy pre-leased (40% pre-CO) | LEASE_UP | Pre-lease distribution, CO move-in surge, accelerated stabilization |
| Aggressive marketing intensity | LEASE_UP | Cost-stack response to intensity, concession decay |
| Subject S3 stabilized property | STABILIZED | Subject-sourced coefficients, days-vacant correction, collision detection |
| Subject S1 only | STABILIZED | Peer fallback for missing dynamics, 2-column inline assumption display |
| No subject history | STABILIZED | Pure peer-set output, low-confidence flags |
| 80% → 95% in 12 months | RECOVERY | Gap-close pace, seasonal adjustment, AGGRESSIVE concession default |
| 78% → 92% in 18 months | RECOVERY | Sub-target stabilization, longer horizon |
| Infeasible pace (90% → 95% in 3 months) | RECOVERY | Warning generation, peer-set absorption max check |

Plus regression tests across the cost treatment toggle:
- For Scenario A (lease-up), verify total cash spent identical across OPERATING / CAPITALIZED / HYBRID
- Verify Year-1 NOI differs across treatments per §5 table

---

## 16. ARCHITECTURAL RULES (codify in CLAUDE.md)

### LEASE-UP-RESERVE-IS-S&U RULE

The lease-up operating reserve (cumulative negative cash flow during ramp)
is always a Sources & Uses line item, regardless of `leasing_cost_treatment`.
The toggle controls concession and marketing presentation, not reserve
treatment. Lender underwriting, GP-LP agreements, and tax treatment all
expect the reserve as a capital line.

### MODE-TRANSITION-IS-VISIBLE RULE

When a deal transitions between modes mid-horizon (LEASE_UP → STABILIZED
at month 22, RECOVERY → STABILIZED at month 13), the transition month
must be visually marked in all outputs (table, chart, narrative). Silent
transitions hide a model assumption that the user should consciously
validate.

### TREATMENT-TOGGLE-CASH-INVARIANT

Total cash outflow on leasing must be identical across all three
`leasing_cost_treatment` values. Only P&L presentation differs. This
is a runtime invariant — the engine must assert equality across
treatments and fail loud if not. Treatment-toggle bugs that change
total cash are the worst class of error here because they pollute IRR.

### SIGN-VS-MOVE-IN-IS-EXPLICIT

Every report distinguishes signed leases from move-ins. They are
different events with different downstream effects:
- Signing → marketing/leasing-team productivity, broker fees due
- Move-in → revenue start, concession amortization start, occupancy
  count incremented

Conflating them is the #1 source of underwriting error in lease-up
modeling. The engine reports both, every period, always.

### FUNNEL-LAYER-DISCIPLINE

Outputs at the Signing Velocity layer (signed leases per period) are
calibrated and authoritative. Outputs at the Prospect Volume layer are
derived via conversion ratios and carry inherently lower confidence.
Reports must label which layer is being shown and not present derived
prospect counts as if they were measured.

### M07-IS-THE-DATA-LAYER (from M07 Schema Extension spec §10)

When new fields are needed by the Lease Velocity Engine or other downstream
services, they are added to `dealContext.traffic` as schema extensions to M07.
The COMPUTATION of those fields lives in M07 (via subject_history aggregation,
peer-set calibration, or platform defaults) but the ALGORITHMS that consume
them — lease-up curves, gap-close math, return calcs — live in their respective
service layers.

This rule prevents architectural drift where lease-up logic creeps into M07
because "M07 already has the traffic data." Resist that pattern. Schema
extensions are cheap; service-boundary violations are expensive to unwind.

### PLATFORM-DEFAULTS-MUST-BE-SHIPPABLE

Every field in `dealContext.traffic` consumed by the Lease Velocity Engine MUST
have a platform-default value sufficient to produce output. Subject calibration
and peer-set refinement are roadmap items, not blocking requirements. A field
that can only be populated when subject history exists is an incomplete schema
entry — find a defensible platform default first.

All platform-default curves and ratios are mastered in
`backend/src/services/m07/defaults/lease-velocity-defaults.ts`. The LV Engine
reads them from `dealContext.traffic.*` (M07-assembled), not directly from the
constants file. Direct constants access is only acceptable in the defensive
fallback pattern during the 24h cache-transition window.

---

## 17. OPEN ITEMS / OUT OF SCOPE FOR V1

These are explicitly deferred:

1. **Phased delivery** — Scenario A here assumes single CO. Multi-building
   sequential deliveries deferred to V2.
2. **Active CapEx during ramp** — VALUE_ADD and REDEVELOPMENT modes deferred.
3. **Leasing CRM integration** — Prospect Volume and Funnel Conversion
   subject-calibration require leasing-software data export not yet
   integrated. Today these layers use peer/platform defaults only.
4. **Calendar-year concession amortization** — Tracked separately as
   `CONCESSION_AMORTIZATION_SPEC` (still to be drafted). The engine
   produces concession dollars per month; amortization to calendar-year
   buckets is downstream.
5. **Marketing-budget optimizer** — V1 produces marketing spend as
   per-lease cost × leases. V2 could optimize spend allocation across
   stages of the funnel (more spend on top-of-funnel vs locators).
6. **Multi-property portfolio rollup** — V1 is single property. Portfolio
   aggregation is a separate spec.

---

**End of spec.**

When implementing, work mode-by-mode in this order:
1. STABILIZED_MAINTENANCE first (covers ~70% of deals; simplest math)
2. LEASE_UP_NEW_CONSTRUCTION second (most user value but most complex pre-lease distribution)
3. OCCUPANCY_RECOVERY third (mostly extends STABILIZED with gap-close arithmetic)

Land all three before V2 modes are queued.
