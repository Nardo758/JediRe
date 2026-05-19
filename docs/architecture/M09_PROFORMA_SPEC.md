# M09 PRO FORMA — STABILIZED POTENTIAL ENGINE

**Status:** Draft v1.0 — supersedes `proFormaVsProjections` framing in `jedi-framework-v31.jsx`
**Owner:** Leon / JEDI RE
**Pairs with:** `LEASE_VELOCITY_ENGINE_SPEC.md`, `CASHFLOW_AGENT_UNDERWRITING_SPEC.md`, `jedi_re_wireframe_blueprint.jsx` (M09 section), Capital Structure Engine spec, `HISTORICAL_OBSERVATIONS_SPEC.md`
**Target executor:** Replit Agent (with Claude Code reference for engine-level work)
**Knock-on rewrites required in:** M08 (Strategy Arbitrage), M25 (JEDI Score), M22 (Post-Close), Projections tab, Deal Capsule alerts, investor deck v2

---

## 1. PURPOSE

The Pro Forma's job is to show the **Stabilized Potential** of a deal — the destination state economics — and the **Current → Stabilized bridge** that gets there.

The Pro Forma is *not* a "shorter Projections." Projections show the *path* (month-by-month grind with timing, capital, and risk). Pro Forma shows the *destination* (one-year snapshot of what the deal becomes once executed). The two are complementary, not redundant.

The deal screen reduces to one question: **how much of the Current → Stabilized Δ do you believe, and why?**

Every line item in the Pro Forma column traces back to:

- A Current state value (T12, rent roll, or $0 for development)
- A bridge decomposition (market drift + platform signal + operator thesis + capex)
- A driver narrative (one line of "because…")

That decomposition is the deal thesis. The Pro Forma column is what the deal becomes if every assumption holds. The Δ column is the value-creation pitch.

---

## 2. WHAT M09 IS NOT

Explicit boundaries to keep the module from drifting back into Projections:

| Concern | Lives in |
|---|---|
| Month-by-month operating cash flow during hold | Projections tab |
| Lease-up ramp curve and timing | M07 + Lease Velocity Engine, surfaced in Projections |
| Sources & Uses sizing | F9 S&U module |
| Debt sizing, amortization, IO → amort transition | Capital Structure Engine |
| LP/GP waterfall and promote tiers | Waterfall tab |
| Sensitivity heatmaps (IRR × exit cap × rent growth) | Sensitivity tab |
| Exit pricing and reversion math | Disposition / Exit Timing module |
| Time-series cash flow rendering | Projections tab |

The Pro Forma column is **one stabilized year**. Not a trajectory. Not a schedule. One year.

---

## 3. THE STABILIZED YEAR — DEFINITION

The stabilized year is *not* a fixed offset (Y3, Y5, etc.). It's the **first operating year that satisfies all model-type-specific stabilization conditions**, computed per deal.

### 3.1 Resolution Rule

```
stabilizedYear = max(
  yearOf(95% sustained occupancy),       // from M07 + LeaseVelocityEngine
  yearOf(capex schedule complete),        // from M22 capex_schedule
  yearOf(rent roll burn-off complete),    // from in-place lease expiry curve
  yearOf(expense baseline normalized)     // from M22 normalization
)
```

Surface the **binding constraint** to the user inline:

> "Stabilizes Y3 — binding constraint: rent roll burn-off (last in-place lease expires Mar 2028)."

### 3.2 Per-Model-Type Stabilization Conditions

| Model Type | Stabilization Conditions | Typical Year |
|---|---|---|
| Acquisition (value-add) | Renovation complete + rent roll burned off + 95% occupancy sustained | Y2–Y3 |
| Acquisition (stabilized) | n/a — Current ≈ Pro Forma; Δ is operational lift only | Y1 |
| Development | First year of 95% sustained occupancy post-delivery | Y2–Y3 post-delivery |
| Redevelopment | CapEx complete + displaced units re-leased + 95% occupancy | Y3–Y5 |

The Lease Velocity Engine's stabilization marker (per `LEASE_VELOCITY_ENGINE_SPEC.md` §1) is the canonical occupancy-side trigger. M09 reads it; M09 does not recompute it.

---

## 4. LAYOUT

### 4.1 Primary View

Single-year operating statement with four columns:

```
LINE ITEM          | CURRENT (T12)   | PRO FORMA (Y_S)  | Δ            | DRIVER
GPR                | $4,820,000      | $6,150,000        | +$1,330,000  | Rent roll burn-off + reno premium (M05 + M08)
Vacancy            | $(385,600)      | $(307,500)        | +$78,100     | Occupancy recovery 92% → 95% (M07)
Concessions        | $(96,400)       | $(30,750)         | +$65,650     | Concession environment normalization (M07 sub-engine)
Bad Debt           | $(48,200)       | $(30,750)         | +$17,450     | Tenant quality lift post-renovation
Other Income       | $145,000        | $215,000          | +$70,000     | RUBS + parking pricing (M08 ancillary)
EGR                | $4,434,800      | $5,996,000        | +$1,561,200  |
OpEx               | $(2,170,000)    | $(2,398,000)      | -$228,000    | Inflation + insurance reset (M22 normalization)
NOI                | $2,264,800      | $3,598,000        | +$1,333,200  | 58.9% NOI growth
Cap Rate           | 5.85%           | 5.65%             | -20bps       | Submarket compression (M05 + M11 rate env)
Stabilized Value   | $38,715,000     | $63,681,000       | +$24,966,000 | Value creation: ~$25M
```

Subtotal rows (EGR, NOI) in bold. NOI in blue per existing color spec. Cap rate / value rows in a separate "Valuation" block beneath the operating block.

### 4.2 Bridge Decomposition (Δ column expanded on hover/click)

Each Δ value decomposes into four sub-components (five for redevelopment):

```
GPR Δ: +$1,330,000
  ├─ Δ_market    +$241,000   (5.0% market rent growth × ~2 years of drift)
  ├─ Δ_platform  +$418,000   (M07 absorption forecast lift + M05 comp premium)
  ├─ Δ_operator  +$526,000   (Sponsor: $200/unit renovation premium × 263 units)
  └─ Δ_capex     +$145,000   (Bedroom add re-tier — M03 massing path)
```

The four components **must sum to Δ**. The decomposition is the audit trail. Hover state expands; click pins the breakdown open.

### 4.3 LayeredValue Source Badge Per Cell

Every Pro Forma cell carries the LayeredValue source pill from its dominant input. Sources (per existing taxonomy):

`platform` · `t12` · `rent_roll` · `tax_bill` · `box_score` · `aged_ar` · `om` · `override`

Dominant source = component contributing the largest absolute Δ to that cell.

`alertLevel` field (already present on LayeredValue) drives the cell color rail:

- **green** — high confidence, layers consistent
- **amber** — one layer disagrees materially
- **red** — operator override conflicts with platform signal beyond threshold (see §5.3)

### 4.4 Phasing Toggle

For deals with phased delivery (multi-building dev, staged value-add), surface a "Phased Pro Forma" view: one Pro Forma column per phase plus a "Fully Stabilized" rollup. Default view = Fully Stabilized.

---

## 5. BRIDGE MECHANICS

### 5.1 The Four Δ Components

Each line item's Δ decomposes into:

| Component | Source | What it represents |
|---|---|---|
| `Δ_market` | Baseline LayeredValue layer | Market drift if you did nothing — extrapolation of current state at submarket growth rates |
| `Δ_platform` | Platform-Adjusted LayeredValue layer | Signal-driven adjustments: M07 absorption, M05 comp premium, M35 events, M11 rate environment |
| `Δ_operator` | User Override LayeredValue layer | Sponsor's strategy-specific lift: renovation premium, operating efficiency, repositioning thesis |
| `Δ_capex` | M22 capex_schedule + M03 massing | Physical asset changes: renovation, unit add, expense baseline reset |

### 5.2 Resolution Order

```
ProForma(line_item) =
    Current(line_item)
  + Δ_market(line_item)
  + Δ_platform(line_item)
  + Δ_operator(line_item)
  + Δ_capex(line_item)
```

Each component is itself a `LayeredValue<number>` with provenance. The Pro Forma cell's dominant source = component with largest `|contribution|`.

### 5.3 Conflict Surfacing

When `|Δ_operator|` exceeds `|Δ_platform|` × threshold (default 1.5×) on any major revenue or expense line, the cell flags amber with copy:

> "Operator assumption exceeds platform expectation by 47%. Platform expects rent lift of $180/unit (M05 + M07). Operator asserting $264/unit. Justification required."

The platform does **not** block. It surfaces. Sponsor can attach a written justification that ships with the deal memo. Threshold configurable per tier (Scout / Operator / Principal / Institutional).

---

## 6. THREE MODEL-TYPE VARIANTS

### 6.1 Acquisition (Value-Add)

**Current column source:** T12 from broker OM + rent roll
**Stabilized trigger:** rent roll burned off + renovation complete + 95% occupancy sustained
**Lease Velocity Mode:** `OCCUPANCY_RECOVERY` (if <90% at close) → `STABILIZED_MAINTENANCE`

Typical Δ-component weights:

| Component | Typical share of total Δ |
|---|---|
| Δ_market | 10–20% |
| Δ_platform | 20–30% |
| Δ_operator | 35–50% |
| Δ_capex | 15–25% |

Bridge flows primarily through rent roll burn-off math: in-place rent → market rent over the expiry curve. Renovation premium layers on top per M08 strategy + M22 capex_schedule.

### 6.2 Acquisition (Stabilized — Core / Core-Plus)

**Current column source:** T12 from broker OM
**Stabilized trigger:** n/a — Current ≈ Pro Forma (Y1 is the Pro Forma year)
**Lease Velocity Mode:** `STABILIZED_MAINTENANCE`

When Current ≈ Pro Forma, the Δ column collapses to operational lift only (RUBS implementation, expense optimization, tenant quality improvement). Surface this explicitly at the top of the view:

> "Stabilized acquisition — Pro Forma reflects Y1 with operational adjustments only. No repositioning thesis. Δ entirely from Δ_operator (operating lift) + Δ_market (rent growth)."

The Pro Forma view degenerates to a single column with a small Δ. That's correct behavior for a core deal — no value-creation pitch, just operating lift + market beta.

### 6.3 Development (Ground-Up)

**Current column source:** $0 (or land basis only — no operating period exists)
**Stabilized trigger:** First year of 95% sustained occupancy post-delivery (per Lease Velocity Engine `LEASE_UP_NEW_CONSTRUCTION` mode)
**Lease Velocity Mode:** `LEASE_UP_NEW_CONSTRUCTION`

Δ-component structure is fundamentally different — Current is null, so the entire Pro Forma is "Δ":

```
LINE ITEM | CURRENT | PRO FORMA      | DRIVER
GPR       | $0      | $7,420,000     | Full build-out: 240 units × $2,575 avg × 12 (M03 massing + M05 comps)
EGR       | $0      | $7,049,000     | 95% economic occupancy post-stabilization (M07 + LeaseVelocityEngine)
NOI       | $0      | $4,229,400     | First stabilized year
```

The Current column is informational only. Bridge decomposition collapses — there's no "from" state to bridge from. Instead, surface:

- **Trust Stack per line item** — how was the Pro Forma number derived? (M03 unit count × M05 comp rent × M07 absorption × M22 normalized OpEx)
- **Stabilization timeline** — months from delivery to stabilized year (from Lease Velocity Engine)

The Pro Forma column is the *future Year 1 stabilized* economics. The Projections tab carries the lease-up grind and the capital schedule to get there.

### 6.4 Redevelopment

**Current column source:** T12 at *reduced capacity* (some units offline during CapEx)
**Stabilized trigger:** CapEx complete + displaced units re-leased + 95% occupancy sustained
**Lease Velocity Mode:** `REDEVELOPMENT_ACTIVE` (V2 of Lease Velocity Engine) → `STABILIZED_MAINTENANCE`

Distinctive Δ-component: **capacity restoration**. Bridge must reconcile reduced-capacity Current to full-capacity Pro Forma. Add a fifth Δ component:

```
GPR Δ decomposition:
  ├─ Δ_capacity   +$852,000   (Restoring 23 displaced units to operating capacity)
  ├─ Δ_market    +$110,000
  ├─ Δ_platform  +$285,000   (Post-renovation comp premium)
  ├─ Δ_operator  +$420,000   (Sponsor: full-rehab rent reset)
  └─ Δ_capex     +$95,000    (Amenity reposition)
```

`Δ_capacity` is the fifth component, exclusive to redevelopment. Sourced from M22 displacement schedule.

---

## 7. CROSS-MODULE INTEGRATION

### 7.1 M08 Strategy Arbitrage → Pro Forma Selection

Each of the 4 strategies (or 39 strategies per Strategy Matrix v8) projects a different stabilized state. M08's job becomes: **render N Pro Forma columns side-by-side, surface the arbitrage as the gap between them.**

```
LINE ITEM     | CURRENT | PF (Rental) | PF (BTS)   | PF (Condo) | PF (Hold)
NOI           | $2.26M  | $3.60M      | $3.85M     | n/a (sale) | $2.94M
Stab Value    | $38.7M  | $63.7M      | $72.4M     | $89.1M     | $48.5M
Required Cap  | —       | $11.2M      | $14.8M     | $22.1M     | $3.2M
Yield-on-Cost | —       | 7.42%       | 8.10%      | 12.30%     | 8.85%
```

F24 (arbitrage formula) operates on `max(PF_score) − second_max(PF_score)`. The arbitrage **IS** the gap between competing Pro Formas.

### 7.2 M25 JEDI Score → Stabilized Achievability

JEDI Score reframes from "deal quality" to **probability-weighted achievability of the Pro Forma**. New sub-scores:

| Sub-score | What it measures |
|---|---|
| Bridge Plausibility | How achievable is the Current → Pro Forma Δ given platform signals? |
| Signal Confidence | Strength and consistency of platform signals feeding `Δ_platform` |
| Operator Stretch | Magnitude of `Δ_operator` vs. platform expectation (large stretch = lower score) |
| Capex Execution | Confidence in M22 capex_schedule completion on budget and timeline |
| Stabilization Timing | Variance on stabilized year (tight band = high, wide band = low) |

JEDI Score becomes a function of "how much of this Pro Forma do we believe?" — directly tied to the bridge.

### 7.3 M22 Post-Close → Live Pro Forma Tracking

Once `deal_monthly_actuals` is live, the Pro Forma view gains a third operating column:

```
LINE ITEM | CURRENT (at close) | ACTUALS (TTM) | PRO FORMA (stabilized) | Δ TO PRO FORMA
```

This surfaces drift: which line items are tracking to thesis, which are behind, which are ahead. Alert:

> "Pro Forma at risk on GPR — TTM tracking 8% below pace required to hit stabilized year target. Binding: rent roll burn-off slower than modeled (3 of 8 expirations in Q2 renewed in-place vs market)."

### 7.4 M07 + Lease Velocity Engine → Stabilization Trigger

The Lease Velocity Engine's stabilization marker is the *single source of truth* for `yearOf(95% sustained occupancy)`. M09 reads this from the engine — does not compute independently.

When Lease Velocity Engine output changes (e.g., absorption forecast deteriorates), the M09 stabilized year shifts. The Pro Forma column re-renders with a new "Y_S" header and re-computes all Δs.

### 7.5 M35 Event Impact → Bridge Component Updates

Live events flowing through M35 update `Δ_platform` components on relevant line items. Surface as bridge-level alerts:

> "M35 event 'AWS HQ2 announcement, 12mi NW' updated GPR `Δ_platform`: +$285k → +$372k (+$87k uplift over 24-month forecast horizon)."

---

## 8. WHAT GETS REWRITTEN, WHAT GETS DEFERRED

### 8.1 Closable Now (Structural — Inside M09)

- 4-column layout (Current | Pro Forma | Δ | Driver)
- Bridge decomposition rendering (4 sub-components, 5 for redevelopment)
- Stabilized year resolution rule (reads from Lease Velocity Engine output)
- Per-model-type variant routing
- LayeredValue source badge + alert level surfacing per cell
- Conflict surfacing (operator vs. platform threshold)
- Phasing toggle for multi-phase deals

### 8.2 Deferred — Blocked Upstream

| Capability | Blocked on |
|---|---|
| Live `Δ_platform` from M35 events | Event Propagation Audit (#715) Phase 1 |
| Live Actuals column | `deal_monthly_actuals` table (M22 critical path) |
| Empirically-tuned bridge component weights | Historical Observations corpus build-out |
| `LEASE_UP_PHASED_DELIVERY` and `REDEVELOPMENT_ACTIVE` variants | Lease Velocity Engine V2 |
| 4-strategy side-by-side Pro Forma view | M08 v2 backend (Task #176) |

### 8.3 Downstream Rewrites Required Outside M09

| Surface | Change |
|---|---|
| `jedi-framework-v31.jsx` `proFormaVsProjections` object | Delete; replace with reference to this spec |
| Tab description for Pro Forma | "Stabilized Potential — Current → Stabilized bridge" |
| M25 JEDI Score sub-scores | Refactor to Bridge Plausibility / Signal Confidence / Operator Stretch / Capex Execution / Stabilization Timing |
| Deal Capsule alerts | Reframe "Pro Forma needs update" → "Pro Forma at risk on [line item]" |
| Investor deck (v2) | Update Pro Forma slide to reflect Stabilized Potential framing |
| `CLAUDE.md` | Add M09 purpose statement to module index |
| `FEATURE_EXPANSION.md` | Move "4-strategy Pro Forma view" out of unbuilt features, into M08-gated deferred set |

---

## 9. BUILD ORDER (PHASED SESSIONS)

| Session | Scope | Dependencies |
|---|---|---|
| 9.1 | Layout reframe in M09 component — 4-column structure, mock bridge data | None |
| 9.2 | Stabilized year resolution rule — reads from Lease Velocity Engine | Lease Velocity Engine V1 shipped |
| 9.3 | Bridge decomposition rendering — 4 components per line, hover-to-expand | Lease Velocity Engine outputs flowing into M09 |
| 9.4 | LayeredValue source badge + alert level surfacing | LayeredValue system live ✓ |
| 9.5 | Per-model-type variant routing (Acquisition / Development / Redevelopment) | M02 zoning + M03 massing reachable from M09 |
| 9.6 | Conflict surfacing (operator vs. platform threshold) | None |
| 9.7 | 4-strategy side-by-side view | M08 v2 backend |
| 9.8 | Live Actuals column | `deal_monthly_actuals` table |

---

## 10. ACCEPTANCE CRITERIA (V1)

The M09 rewrite is V1-complete when:

1. Pro Forma view renders 4-column layout for any deal across all three model types
2. Stabilized year reads from Lease Velocity Engine — no independent computation in M09
3. Bridge decomposition shows 4 components per line (5 for redevelopment) and components sum to Δ within $1 tolerance
4. Every cell carries LayeredValue source badge and alert level
5. Conflict surfacing fires when operator override exceeds platform expectation × 1.5× threshold
6. `jedi-framework-v31.jsx` `proFormaVsProjections` object is deleted; tab description updated
7. Three model-type variants route correctly based on deal classification
8. Sample deals across all three variants render correctly end-to-end (acceptance test deck: 1 value-add, 1 stabilized, 1 development, 1 redevelopment)
