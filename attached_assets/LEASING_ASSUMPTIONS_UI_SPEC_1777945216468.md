# LEASING ASSUMPTIONS UI SPEC

**Status:** Draft v1.0
**Owner:** F9 ProForma/Projections frontend
**Depends on:**
  - `INLINE_ASSUMPTION_BLOCK_COMPONENT_SPEC.md` — component this configures
  - `LEASE_VELOCITY_ENGINE_SPEC.md` — engine that consumes the inputs
  - `M07_SCHEMA_EXTENSION_FOR_LEASE_VELOCITY.md` — schema this UI binds to
  - `CONCESSION_ENVIRONMENT_SUB_ENGINE_SPEC.md` — concession field semantics
  - LayeredValue<T> system, T-token design system

**Scope:** This is the **content and configuration** spec for the leasing-related editable surface. It defines *which* fields are user-editable, *where* they appear, *how* they're organized, *when* they're visible, and *what* validation/defaults apply. It does NOT redefine the Inline Assumption Block component itself (that's the existing component spec) — it configures it.

---

## 1. PURPOSE & SCOPE

The Lease Velocity Engine, the Concession Environment Sub-Engine, and the M07 Subject History calibrations all produce LayeredValue<T> outputs that are *technically* user-overridable. But "technically overridable" doesn't equal "exposed in the UI." Without this spec, every team member who touches the assumptions UI will make their own decision about which fields surface, which are buried, which are hidden — and the platform fragments.

This document fixes the editable surface: ten leasing field categories, ~80 individual fields, organized across two display surfaces (Global tab and Inline Blocks), with tier-based progressive disclosure and mode-conditional visibility.

### What this spec governs

- The **"Leasing" section** of the Global Assumptions tab (full inventory)
- The **Inline Assumption Blocks** above each Projections operating section (curated subsets)
- The **Cost Treatment toggle** placement (deal settings + F9 top bar)
- Field-level metadata: type, default, validation, format, tooltip, source authority

### What this spec does NOT govern

- The Inline Assumption Block component itself (separate spec — already shipped)
- Non-leasing assumptions (rent build below the leasing layer is in F9 Pro Forma spec; debt/exit assumptions are in M11)
- Mode classification logic (lives in M07/Lease Velocity)
- The underlying LayeredValue<T> resolution (lives in M07 Subject History spec)

---

## 2. THE TWO SURFACES

### Surface 1 — Global Assumptions tab, "Leasing" section

**Location:** `F9 Pro Forma → Assumptions tab → Leasing section`

**Purpose:** Comprehensive inventory of every leasing-related editable field. Power-user audit surface. Default landing for users who select "Edit Assumptions" from any context menu.

**Layout:** Vertically scrollable section with collapsible category headers. Default state shows Beginner-tier fields only (~10 fields visible); Advanced and Expert tiers are gated behind toggles.

**Width:** Full F9 panel width (typically 720–960px depending on viewport).

### Surface 2 — Inline Assumption Block

**Location:** Above each Projections operating section (Occupancy & Leasing, Concessions, Lease-Up Ramp, Recovery Plan, etc.)

**Purpose:** Curated subset (3–6 fields) most relevant to the operating block immediately below. Contextual editing without leaving the Projections view.

**Component:** The reusable `<InlineAssumptionBlock>` component per the component spec. This document just specifies which fields populate each block.

**Width:** Same as parent Projections section.

### How they relate

Same underlying LayeredValue<T> cells. Editing in either surface writes to dealStore via the same action. dealStore propagation re-renders both. No data duplication.

```
       Global Assumptions tab          Inline Assumption Blocks
       (Surface 1)                     (Surface 2)
              │                                │
              └────────────┬───────────────────┘
                           ▼
                ┌─────────────────────┐
                │  dealStore actions  │
                │  setLayeredValue... │
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │  dealContext        │
                │  (LayeredValue<T>   │
                │   cells with        │
                │   provenance)       │
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │  Engine recomputes: │
                │  Lease Velocity,    │
                │  Concession Env,    │
                │  M07→M09 Adapter,   │
                │  JEDI Score         │
                └─────────────────────┘
```

---

## 3. MASTER FIELD INVENTORY

The full editable inventory, organized by category. Columns:

- **Path:** dealContext path (binds to LayeredValue<T>)
- **Type:** input control type
- **Mode:** which `lease_mode` values surface this field
- **Tier:** Beginner / Advanced / Expert (drives default visibility)
- **Default Source:** where the platform default comes from
- **Validation:** bounds and rules

### Category A — Occupancy Targets

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Target stabilized occupancy | `traffic.stabilization.ceiling_occupancy` | percent | all | Beginner | platform `0.95` | `[0.80, 1.00]` |
| Stabilization definition | `traffic.stabilization.definition` | enum | all | Beginner | platform `PHYSICAL_95` | one of `PHYSICAL_95` / `ECONOMIC_95` / `AGENCY_90_30_60_90` |
| Current occupancy (override) | `traffic.subject_history.current_state.occupancy_pct` | percent | RECOVERY/STAB | Beginner | from rent roll | `[0.00, 1.00]` |
| Target paid vs signed mode | `lease_velocity.target_basis` | enum | all | Advanced | platform `SIGNED` | one of `SIGNED` / `PAID` |

### Category B — Renewal & Turnover Behavior

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| **Renewal rate** | `traffic.renewal_rate` | percent | STAB/REC | **Beginner** | subject S2+ → peer → platform `0.55` | `[0.20, 0.85]` |
| Turnover rate | `traffic.turnover_rate` | percent | STAB/REC | Beginner | computed `1 − renewal_rate` | **READ-ONLY** |
| Days vacant (median) | `traffic.days_vacant_median` | integer | STAB/REC | Beginner | subject S2+ → peer → platform `21` | `[0, 90]` |
| Average lease term | `traffic.avg_lease_term_months` | integer | all | Advanced | subject S1+ → peer → platform `12` | `[3, 24]` |
| Rent step on renewal | `traffic.rent_step_renewal_pct` | percent | STAB/REC | Advanced | subject `trade_out_renewal` → peer → platform `0.03` | `[-0.05, 0.10]` |
| Trade-out new (rent change vs prior tenant) | `traffic.trade_out_new` | percent | STAB/REC | Advanced | subject S2+ → peer → platform `0.045` | `[-0.10, 0.20]` |

### Category C — Rent Growth & Loss-to-Lease

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| **Blended rent growth** | `traffic.coefficients.blended_rent_growth` | percent OR schedule | all | **Beginner** | subject S2+ → peer → platform `0.030` | flat `[-0.05, 0.10]`; schedule per-year same bounds |
| Loss-to-lease % (Y1) | `traffic.loss_to_lease_pct` | percent | STAB/REC | Beginner | subject S1+ → peer → platform `0` | `[0, 0.20]` |
| LTL decay rate | `proforma.ltl_decay_rate` | percent | STAB/REC | Advanced | platform = `1 / avg_lease_term_months × 12` | `[0, 1.00]` annualized |
| Per-unit-type rent growth | `traffic.coefficients.unit_type_rent_growth` | percent[] | all | Expert | platform = blended_rent_growth applied uniformly | per element `[-0.05, 0.10]` |
| Affordable rent growth (HUD/LIHTC) | `proforma.affordable_rent_growth` | percent | all | Expert | platform `0.02` | `[0, 0.05]` |

### Category D — Concessions

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Concession strategy | `lease_velocity.inputs.concession_strategy` | enum | all | Beginner | mode-aware (`MARKET` for STAB, `AGGRESSIVE` for REC, mode-default for LEASE_UP) | one of `CONSERVATIVE` / `MARKET` / `AGGRESSIVE` |
| **New lease onetime** | `traffic.concession_environment.by_year[n].new_lease_onetime_per_unit` | currency | all | **Beginner** | concession engine output | `[0, 5 × monthly_rent]` |
| **Renewal onetime** | `traffic.concession_environment.by_year[n].renewal_onetime_per_unit` | currency | STAB/REC | Beginner | concession engine output | `[0, 1.5 × monthly_rent]` |
| New lease ongoing (monthly abatement) | `traffic.concession_environment.by_year[n].new_lease_ongoing_monthly` | currency | LEASE_UP/REC | Advanced | concession engine output `0` for STAB | `[0, monthly_rent]` |
| Renewal ongoing | `traffic.concession_environment.by_year[n].renewal_ongoing_monthly` | currency | RECOVERY | Advanced | concession engine output `0` for STAB/LEASE_UP | `[0, 0.5 × monthly_rent]` |
| % new leases receiving | `traffic.concession_environment.by_year[n].expected_pct_of_new_leases_receiving` | percent | all | Advanced | mode-aware: LEASE_UP `1.0`, STAB `0.4`, REC `0.7` | `[0, 1.00]` |
| % renewals receiving | `traffic.concession_environment.by_year[n].expected_pct_of_renewals_receiving` | percent | STAB/REC | Advanced | platform `0.10` STAB, `0.30` REC | `[0, 1.00]` |
| Concession decay curve (24mo) | `traffic.concession_environment.decay_curve` | array[24] | LEASE_UP | Expert | platform decay curve | each `[0, 1.00]` monotonic non-increasing |

### Category E — Lease-Up Strategy

**Mode-conditional: visible ONLY when `traffic.mode.effective = 'LEASE_UP_NEW_CONSTRUCTION'`**

| Field | Path | Type | Tier | Default Source | Validation |
|---|---|---|---|---|---|
| **Pre-leased count** | `lease_velocity.inputs.pre_leased_count` | integer | **Beginner** | platform `0` | `[0, total_units]` |
| **Delivery month** | `lease_velocity.inputs.delivery_month` | date or month index | **Beginner** | from M22 capex schedule | future date |
| Pre-lease window (months) | `lease_velocity.inputs.pre_lease_window_months` | integer | Advanced | platform `6` | `[3, 12]` |
| Sign-to-move-in lag (median days) | `traffic.move_in_lag.median_lag_days` | integer | Advanced | subject → peer → platform `21` | `[0, 60]` |
| Marketing intensity | `lease_velocity.inputs.marketing_intensity` | enum | Beginner | platform `MARKET` | one of `LOW` / `MARKET` / `AGGRESSIVE` |
| Absorption curve override | `traffic.absorption_capacity.current_mode_curve` | array[24] | Expert | platform `LEASE_UP_S_CURVE_24MO` | each `[0, 0.30]`, sums approximately `1.00` |
| Stabilization target month override | `lease_velocity.inputs.stabilization_target_month_override` | integer | Expert | none (engine-detected) | `[6, 36]` |

### Category F — Recovery Strategy

**Mode-conditional: visible ONLY when `traffic.mode.effective = 'OCCUPANCY_RECOVERY'`**

| Field | Path | Type | Tier | Default Source | Validation |
|---|---|---|---|---|---|
| **Catch-up period (months)** | `lease_velocity.inputs.catch_up_period_months` | integer | **Beginner** | platform `12` | `[3, 36]` |
| Recovery curve override | `traffic.absorption_capacity.current_mode_curve` | array[24] | Expert | platform `RECOVERY_CURVE_24MO` | per element validation |
| Locator usage % | `lease_velocity.inputs.locator_usage_pct` | percent | Advanced | platform `0.30` | `[0, 1.00]` |

### Category G — Marketing & Leasing Cost

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Marketing per lease | `lease_velocity.cost_stack.marketing_per_lease` | currency | all | Advanced | mode-aware (`$1,800` LEASE_UP / `$400` STAB / `$1,000` REC) | `[$0, $5,000]` |
| Marketing base monthly | `lease_velocity.cost_stack.marketing_base_monthly` | currency | all | Advanced | mode-aware (`$8,000` LEASE_UP / `$2,000` STAB / `$4,000` REC) | `[$0, $50,000]` |
| Locator/broker fee | `lease_velocity.cost_stack.locator_fee_pct_of_rent` | percent of rent | all | Advanced | platform `0.50` (half month) | `[0, 1.50]` |
| Locator usage % | `lease_velocity.cost_stack.locator_usage_pct` | percent | all | Advanced | mode-aware (`0.30` LEASE_UP/REC, `0` STAB) | `[0, 1.00]` |
| Make-ready / turn cost per unit | `lease_velocity.cost_stack.turn_cost_per_unit` | currency | STAB/REC | Advanced | platform class-aware (`$1,500` A / `$1,000` B / `$700` C) | `[$0, $10,000]` |
| **Cost treatment toggle** | `deal.leasing_cost_treatment` | enum | all | **Beginner** | platform `HYBRID` | one of `OPERATING` / `CAPITALIZED` / `HYBRID` — **see §6** |
| Lease-up reserve override | `lease_velocity.outputs.lease_up_reserve_required` | currency | LEASE_UP | Expert | engine-computed | `[$0, $5M]` |

### Category H — Funnel Conversion

**Default Tier: Advanced (collapsed). Most users never see these.**

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Prospect → tour | `traffic.funnel_conversion.active.prospect_to_tour` | percent | all | Expert | mode-aware default | `[0.05, 0.50]` |
| Tour → application | `traffic.funnel_conversion.active.tour_to_application` | percent | all | Expert | mode-aware default | `[0.10, 0.70]` |
| Application → approval | `traffic.funnel_conversion.active.application_to_approval` | percent | all | Expert | mode-aware default | `[0.40, 0.95]` |
| Approval → lease | `traffic.funnel_conversion.active.approval_to_lease` | percent | all | Expert | mode-aware default | `[0.70, 0.98]` |
| Overall conversion | `traffic.funnel_conversion.active.overall` | percent | all | Advanced | computed product of above | **READ-ONLY** |

### Category I — Bad Debt & Other Income

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Bad debt % of GPR | `proforma.bad_debt_pct` | percent | all | Advanced | M22 actuals → peer → platform `0.01` | `[0, 0.05]` |
| Other income growth % | `proforma.other_income_growth_pct` | percent | all | Advanced | platform = `blended_rent_growth × 0.5` | `[-0.05, 0.10]` |

### Category J — Mode Override

| Field | Path | Type | Mode | Tier | Default Source | Validation |
|---|---|---|---|---|---|---|
| Lease mode override | `traffic.mode.user_override` | enum | all | Beginner | none | one of LeaseMode values; **lives in Deal Settings panel, not Assumptions tab** (see §6.5) |

---

## 4. TIER-BASED PROGRESSIVE DISCLOSURE

### Three tiers

- **Beginner** — always visible. ~10 highest-leverage fields. Designed so a sponsor underwriter can produce a credible underwrite without expanding anything.
- **Advanced** — collapsible group. ~25 fields. Designed for institutional analysts who want to see and override more.
- **Expert** — behind a separate toggle. ~15 fields, mostly array overrides, curve replacements, and decay-rate fine-tuning. Designed for quants and platform admins.

### UI mechanism in Global Assumptions tab

```
┌─ LEASING ASSUMPTIONS ────────────────────────────────────────────────┐
│                                                                       │
│  ┌─ Occupancy Targets ──────────────────────────────────────────┐    │
│  │  Target stabilized occupancy        95.0%      [SUBJ]  HIGH  │    │
│  │  Stabilization definition           PHYSICAL_95              │    │
│  │  Current occupancy (override)       94.0%      [RR]    HIGH  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Renewal & Turnover ─────────────────────────────────────────┐    │
│  │  Renewal rate                       62.0%      [SUBJ]  HIGH  │    │
│  │  Turnover rate                      38.0%      computed      │    │
│  │  Days vacant (median)               24         [SUBJ]  MED   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ... (more Beginner-tier categories) ...                             │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  ▸ Show advanced assumptions  (25 additional fields)         │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

When user clicks "Show advanced assumptions":

```
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  ▾ Advanced assumptions  (collapse)                          │    │
│  │                                                                │    │
│  │  ┌─ Occupancy Targets (advanced) ─┐                          │    │
│  │  │  Target paid vs signed mode  SIGNED                       │    │
│  │  └─────────────────────────────────┘                         │    │
│  │                                                                │    │
│  │  ... (Advanced fields under each category) ...                │    │
│  │                                                                │    │
│  │  ▸ Show expert overrides  (15 additional fields)             │    │
│  └──────────────────────────────────────────────────────────────┘    │
```

### Visual tier markers

Each Advanced or Expert field renders with a small tier badge in the field row:

```
Renewal rate                       62.0%      [SUBJ]  HIGH
Lease term (months)              [ADV] 13     [PEER]  MED
LTL decay rate                   [ADV] 8.3%   [PLAT]  LOW
Per-unit-type rent growth        [EXP] [...]   [PLAT]  LOW
```

Tier badges use T.text.muted color and 9px JetBrains Mono. They serve as orientation, not warning.

### Tier persistence

The user's tier preference persists per-user (not per-deal). If the user expanded Advanced on Deal A, Deal B opens with Advanced expanded too. Stored in:

```typescript
userPreferences.assumptions_ui = {
  show_advanced: boolean,
  show_expert: boolean,
  // independently togglable
};
```

Not synced to dealStore (this is purely view state).

---

## 5. MODE-CONDITIONAL VISIBILITY

The "Leasing" section content varies by `traffic.mode.effective`. Categories E (Lease-Up Strategy) and F (Recovery Strategy) are entire sections that appear/disappear with mode.

### Visibility matrix

| Category | LEASE_UP | STABILIZED | RECOVERY |
|---|---|---|---|
| A. Occupancy Targets | ✓ | ✓ | ✓ |
| B. Renewal & Turnover | ✗ (no renewals during ramp) | ✓ | ✓ |
| C. Rent Growth & LTL | ✓ (limited — peer-only) | ✓ | ✓ |
| D. Concessions | ✓ (LEASE_UP-specific defaults) | ✓ | ✓ |
| **E. Lease-Up Strategy** | ✓ | ✗ | ✗ |
| **F. Recovery Strategy** | ✗ | ✗ | ✓ |
| G. Marketing & Cost | ✓ | ✓ | ✓ |
| H. Funnel Conversion | ✓ | ✓ | ✓ |
| I. Bad Debt & Other | ✓ | ✓ | ✓ |
| J. Mode Override (Deal Settings) | ✓ | ✓ | ✓ |

### Mode transitions during hold period

When a deal transitions modes mid-horizon (LEASE_UP → STABILIZED at month 22), the Assumptions UI shows the **current mode's** category set — but a small notice at the top of the Leasing section reads:

> *Mode transitions to STABILIZED in month 22. Stabilized assumptions apply from that point forward.*

User can switch the Assumptions view to "Show STABILIZED assumptions" via a small dropdown to inspect the post-transition state. This is purely a view toggle; underlying data is the same.

### Implementation

```typescript
function getVisibleCategories(mode: LeaseMode): CategoryId[] {
  const base = ['A', 'C', 'D', 'G', 'H', 'I'];
  if (mode === 'LEASE_UP_NEW_CONSTRUCTION') return [...base, 'E'];
  if (mode === 'STABILIZED_MAINTENANCE') return [...base, 'B'];
  if (mode === 'OCCUPANCY_RECOVERY') return [...base, 'B', 'F'];
  return base;
}
```

---

## 6. THE COST TREATMENT TOGGLE

Per the F9 spec confirmation, the toggle exists in **two places**.

### 6.1 Location A — Deal Settings panel

**Path:** `Deal Settings → Financial Treatment → Leasing Cost Treatment`

**Stored:** `deal.leasing_cost_treatment`

**Default:** `HYBRID`

**Behavior:** Sets the deal's persistent treatment. Applied to all F9 views unless overridden in Location B.

**UI:**

```
┌─ FINANCIAL TREATMENT ─────────────────────────────────────────────────┐
│                                                                        │
│  Leasing Cost Treatment              ⓘ                                │
│                                                                        │
│  ⊙ HYBRID (institutional standard, GAAP-aligned)  [recommended]       │
│  ○ CAPITALIZED (lease-up costs in S&U; clean stabilized NOI)          │
│  ○ OPERATING (all costs flow through P&L monthly)                     │
│                                                                        │
│  ⓘ HYBRID amortizes concessions as effective-rent reduction over      │
│    each lease term, treats the lease-up reserve as S&U capital, and   │
│    flows marketing/make-ready as OpEx as incurred. Most institutional │
│    LPs expect this treatment.                                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Location B — F9 top bar

**Location:** Top bar of F9 Pro Forma tab (also visible on Projections, Returns, Sources & Uses)

**Display:** Compact pill-style toggle, three options visible

**Behavior:** View-state override. Does NOT modify `deal.leasing_cost_treatment` — only changes how the current F9 view renders.

**UI:**

```
┌─ F9 PRO FORMA ────────────────────────────────────────────────────────┐
│                                                                        │
│  Cost Treatment:  [ OPERATING ]  [ CAPITALIZED ]  [⊙ HYBRID ]   ⓘ    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

The currently-active treatment renders highlighted (T.bg.layer3 background). Clicking another option switches the view.

A small badge shows when view differs from deal default:

```
Cost Treatment:  [⊙ OPERATING ]  [ CAPITALIZED ]  [ HYBRID ]     [VIEW≠DEAL]
```

The `[VIEW≠DEAL]` badge clicked → tooltip "Deal default is HYBRID. This view is OPERATING. Click to revert."

### 6.3 Why two places

- **Deal Settings location** = persistent commitment. The treatment for this deal as recorded.
- **F9 top bar location** = scenario exploration. "Show me the same model under all three treatments" without modifying the deal.

Most institutional analysts will run all three views during a deal cycle — CAPITALIZED for the LP deck, HYBRID for internal underwriting, OPERATING for the lender package. Without view-toggle, they'd have to change the deal default repeatedly, which loses the audit trail.

### 6.4 What the toggle does NOT do

- Does NOT change the lease-up reserve calculation (always S&U regardless)
- Does NOT change total cash spent on leasing (invariant)
- Does NOT recompute traffic coefficients or renewal rates
- Does NOT change Sources & Uses lines that aren't leasing-related

### 6.5 Mode override is NOT in Assumptions

For symmetry: the `lease_mode_override` field lives in **Deal Settings**, not the Assumptions tab. Mode classification is a *property characteristic* (what is this asset doing), not an *underwriting assumption* (how aggressive is our forecast).

```
┌─ DEAL SETTINGS ──────────────────────────────────────────────────────┐
│                                                                       │
│  Property Mode                                                        │
│    Resolved automatically: STABILIZED_MAINTENANCE                     │
│    Confidence: HIGH                                                   │
│    Reasoning: 94% occupied, no active CapEx, stabilized history       │
│                                                                       │
│  Override: [ Use auto-resolved ▾ ]                                    │
│            Options:                                                   │
│              ⊙ Use auto-resolved (STABILIZED)                        │
│              ○ Force LEASE_UP_NEW_CONSTRUCTION                       │
│              ○ Force OCCUPANCY_RECOVERY                              │
│              ○ Force STABILIZED_MAINTENANCE                          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 7. INLINE ASSUMPTION BLOCK CONFIGURATION PER PROJECTIONS SECTION

The Inline Assumption Block above each Projections operating section gets a curated 3–6 field subset. Fields chosen by the rule: *"the smallest set that, edited together, lets the user shift this block's output meaningfully."*

### 7.1 Above "Occupancy & Leasing — Market Rate Units"

```typescript
fields: [
  { id: 'traffic.coefficients.blended_rent_growth', label: 'Blended Rent Growth', format: 'pct' },
  { id: 'traffic.renewal_rate', label: 'Renewal Rate', format: 'pct' },
  { id: 'traffic.days_vacant_median', label: 'Days Vacant (median)', format: 'days' },
  { id: 'traffic.stabilization.ceiling_occupancy', label: 'Target Occupancy', format: 'pct' }
]
```

### 7.2 Above "Concessions"

```typescript
fields: [
  { id: 'lease_velocity.inputs.concession_strategy', label: 'Concession Strategy', format: 'enum' },
  { id: 'traffic.concession_environment.by_year[0].new_lease_onetime_per_unit', label: 'New Lease — Onetime', format: 'currency', year: 1 },
  { id: 'traffic.concession_environment.by_year[0].renewal_onetime_per_unit', label: 'Renewal — Onetime', format: 'currency', year: 1 },
  { id: 'traffic.concession_environment.by_year[0].expected_pct_of_new_leases_receiving', label: '% New Leases w/ Concession', format: 'pct', year: 1 }
]
```

### 7.3 Above "Lease-Up Ramp" (LEASE_UP mode only)

```typescript
fields: [
  { id: 'lease_velocity.inputs.pre_leased_count', label: 'Pre-leased Count', format: 'num' },
  { id: 'lease_velocity.inputs.delivery_month', label: 'Delivery Month', format: 'month' },
  { id: 'lease_velocity.inputs.marketing_intensity', label: 'Marketing Intensity', format: 'enum' },
  { id: 'traffic.stabilization.definition', label: 'Stabilization Definition', format: 'enum' },
  { id: 'deal.leasing_cost_treatment', label: 'Cost Treatment', format: 'enum' }
]
```

### 7.4 Above "Recovery Plan" (RECOVERY mode only)

```typescript
fields: [
  { id: 'lease_velocity.inputs.catch_up_period_months', label: 'Catch-up Period (months)', format: 'num' },
  { id: 'lease_velocity.inputs.concession_strategy', label: 'Concession Strategy', format: 'enum' },
  { id: 'traffic.subject_history.current_state.occupancy_pct', label: 'Current Occupancy (override)', format: 'pct' }
]
```

### 7.5 Above "Operating Expenses"

```typescript
fields: [
  { id: 'proforma.opex_growth_rate', label: 'OpEx Growth Rate', format: 'pct' },
  { id: 'proforma.payroll_per_unit', label: 'Payroll per Unit', format: 'currency' },
  { id: 'proforma.r_and_m_per_unit', label: 'R&M per Unit', format: 'currency' }
]
```

### 7.6 Above "Disposition"

```typescript
fields: [
  { id: 'proforma.exit_cap_rate', label: 'Exit Cap Rate', format: 'pct' },
  { id: 'proforma.exit_year', label: 'Exit Year', format: 'num' },
  { id: 'proforma.selling_costs_pct', label: 'Selling Costs %', format: 'pct' }
]
```

### Rule for adding new operating sections

When a new Projections operating section is added (e.g., a new sub-block for affordable units), the developer must:

1. Identify 3–6 driving assumptions
2. Verify each is a LayeredValue<T> (if not, file upstream task — do NOT bypass)
3. Add the `<InlineAssumptionBlock>` above the section with the field array
4. Add an entry to this spec's §7 with the field array

Sections without inline blocks are discouraged — they hide the assumptions from the user's editing flow.

---

## 8. FIELD-LEVEL UI SPECS

### 8.1 Format-specific rendering

| Format | Display | Edit control |
|---|---|---|
| `pct` | `45.0%` (1 decimal default) | Numeric input with `%` suffix; accepts `45` or `45%` or `0.45` |
| `currency` | `$1,925` (no decimals for ≥$1K, 2 decimals for <$1K) | Numeric input with `$` prefix |
| `num` | `47` | Numeric input |
| `days` | `24` (with unit hint "days") | Numeric input |
| `months` | `12` (with unit hint "months") | Numeric input |
| `month` | `2026-04` | Date picker (month granularity) |
| `enum` | shown as text label | Dropdown with all enum values |
| `array` | summary like `[24 values, edit...]` | Modal opens with array editor |
| `schedule` | summary like `Y1: 4%, Y2: 3.5%, Y3+: 3%` | Modal opens with year-by-year editor |

### 8.2 Default validation behavior

On commit, validation runs in this order:

1. **Type check** — input parses to expected type
2. **Bounds check** — within `[min, max]` from §3 inventory
3. **Cross-field check** — e.g., `exit_year > 0` AND `exit_year ≤ holdYears`
4. **Mode-consistency check** — e.g., `pre_leased_count` only valid in LEASE_UP mode

On failure: cell flashes T.accent.negative, value reverts, tooltip appears with specific reason. Examples:

- `Renewal rate must be between 20% and 85%` (out of bounds)
- `Cannot edit pre-leased count in current mode` (mode-conditional)
- `Cost treatment override conflicts with deal settings — confirm change?` (cross-field; offers confirmation)

### 8.3 Tooltip content for every field

Every field has a hover tooltip explaining what it drives. Examples:

- **Renewal rate** — "Fraction of lease expirations that renew at the property. Drives Year 2+ vacancy and concession costs."
- **Days vacant (median)** — "Average days between move-out and new lease move-in. Drives the days-vacant correction in occupancy targeting."
- **Cost treatment** — "How leasing costs (concessions, marketing, lease-up reserve) are presented in the financial model. Does not affect total cash; only P&L vs Sources & Uses presentation."

Tooltip text source: `LEASING_FIELD_TOOLTIPS.json` — single configuration file, externally editable, supports localization.

### 8.4 Override badge behavior

When a user overrides a field, the cell renders with a small `[EDIT]` pill in T.accent.user color. Click the pill: opens a tooltip:

```
┌─ Field Override ────────────────────────┐
│  Current value: 65% (your override)     │
│  Auto-resolved: 62% (subject:s2)        │
│                                          │
│  [ Revert to auto-resolved ]   [ Close ]│
└──────────────────────────────────────────┘
```

Revert button removes override, value falls back to next-highest layer (subject → peer → platform).

### 8.5 Subject divergence indicators

When subject_history value diverges materially from peer set (per the M07 collision rule), the field renders an additional indicator:

- **Subject above peer**: `▲` symbol in T.accent.positive
- **Subject below peer**: `▼` symbol in T.accent.negative

These are drift indicators, not editing controls. Click to open the drilldown modal showing the three-layer breakdown with collision narrative.

---

## 9. READ-ONLY FIELDS (TRANSPARENCY WITHOUT EDITABILITY)

These appear in both surfaces but are NOT user-editable. They're computed outputs surfaced for audit.

| Field | Why read-only | Source |
|---|---|---|
| Turnover rate | Computed `1 − renewal_rate` (prevents drift) | computed |
| Total Units Leased per period | Engine output | M07→M09 adapter |
| Total Units Vacant per period | Engine output | M07→M09 adapter |
| Effective rent per period | Engine output | M07→M09 adapter |
| Total concessions per period | Sum of components | concession sub-engine |
| NOI / DSCR / Cash flow | Engine outputs | F9 engine |
| Implied prospect volume | Derived from `new_leases / overall_conversion` | Lease Velocity Engine |
| Subject History tier (S1/S2/S3/S4) | Derived from snapshot count | M07 Subject History |
| Subject sample sizes per coefficient | Diff-extractor output | M07 Subject History |
| Drift sigma vs peer | Computed by collision detector | M07 Subject History |
| Overall funnel conversion | Computed product | derived |

Read-only fields render with no edit affordance (no cursor change on hover, no click-to-edit). But they DO show source badges and confidence indicators, just like editable fields. Click on a read-only field opens the drilldown modal in read-only mode (no Override button).

---

## 10. VISUAL SPECIFICATIONS

All styling per existing T-token system (Bloomberg Terminal aesthetic). No new tokens needed.

### 10.1 Global Assumptions tab "Leasing" section

| Element | Token |
|---|---|
| Section background | `T.bg.layer1` |
| Section header bar | `T.bg.layer2` |
| Category header | `T.bg.layer2` with `T.border.subtle` 1px bottom |
| Field row hover | `T.bg.layer3` (subtle highlight) |
| Field label | `T.text.primary` 10px IBM Plex Sans |
| Field value | `T.text.primary` 11px JetBrains Mono tabular-nums |
| Tier badge `[ADV]` `[EXP]` | `T.text.muted` 9px JetBrains Mono |
| Source badge `[SUBJ]` `[PEER]` `[PLAT]` `[EDIT]` | per Inline Assumption Block component spec |
| Confidence badge `HIGH` `MED` `LOW` | per Inline Assumption Block component spec |

### 10.2 Spacing

| Spacing | Value |
|---|---|
| Section outer padding | 16px |
| Category header height | 32px |
| Field row height | 28px |
| Field label width (left column) | 280px (fixed) |
| Source badge column | 80px |
| Confidence column | 60px |
| Edit cell width | flex-1 |
| Inter-category spacing | 16px |
| Tier-toggle section padding | 12px top/bottom |

### 10.3 Cost Treatment toggle styling

**Deal Settings location** — radio button group, T.bg.layer1 background, selected option highlights with T.accent.user 2px left border.

**F9 top bar location** — pill toggle group, T.bg.layer2 background, active option T.bg.layer3, inactive options T.bg.layer1 (subtly recessed). Pills 32px height, 12px horizontal padding.

### 10.4 Mode-conditional sections

When `traffic.mode.effective` changes, mode-conditional categories animate in/out:

- Appearing: fade-in over 200ms with slight downward slide (4px)
- Disappearing: fade-out over 150ms

Avoids jarring layout shifts when the user changes mode.

---

## 11. INTERACTION PATTERNS

### 11.1 Editing flow (same as Inline Assumption Block component spec)

Cell click → editing → commit (Enter / Tab / Blur) → override applied → dealStore action dispatched → recalc cascade → both surfaces re-render with new EFFECTIVE value + `[EDIT]` badge.

### 11.2 Bulk operations (Advanced/Expert tier only)

Power users can apply assumptions templates:

```
┌─ APPLY ASSUMPTION TEMPLATE ─────────────────────────────────────────┐
│                                                                      │
│  Template:                                                           │
│    ⊙ Conservative Underwriting                                      │
│    ○ Aggressive Underwriting                                        │
│    ○ Lender Stress Case                                             │
│    ○ Custom (saved templates)                                       │
│                                                                      │
│  Will override:                                                     │
│    • Renewal Rate              62% → 55%                            │
│    • Blended Rent Growth      3.4% → 2.5%                           │
│    • Days Vacant (median)       24 → 35                             │
│    • Bad Debt %                1.0% → 1.5%                          │
│    • Concession Strategy   MARKET → CONSERVATIVE                    │
│                                                                      │
│  ⓘ Will preserve subject_history calibration where applicable.     │
│    Overrides applied to: blended_rent_growth, days_vacant_median,   │
│    bad_debt_pct, concession_strategy. Renewal rate uses subject     │
│    value of 62% (not template's 55%).                               │
│                                                                      │
│             [ Cancel ]   [ Apply Template ]                         │
└──────────────────────────────────────────────────────────────────────┘
```

Templates apply intelligently — they DON'T override subject-calibrated values when subject confidence is HIGH. Instead, the template's value is applied only where current source is platform default. This preserves the platform's calibration advantage.

### 11.3 Reset to defaults

Section-level "Reset" button at the top of the Leasing section reverts all overrides in that section back to engine-resolved values. Confirmation prompt:

```
This will revert 7 overrides to their engine-resolved values.
Subject-calibrated and peer-set values will be re-applied.
Continue? [ Yes ] [ No ]
```

### 11.4 Side-by-side scenario comparison (Expert tier feature)

Expert users can clone the current assumption set into a "Scenario B" and edit independently. Both scenarios run their own engines; F9 Returns tab can render both side-by-side.

This is OUT OF SCOPE for V1. Listed here for forward awareness — the field architecture should support it (each scenario gets its own LayeredValue override layer).

---

## 12. EDGE CASES

### 12.1 Mode resolved to V2_PENDING_*

If mode resolves to a V2 mode that's not yet implemented (PHASED_DELIVERY, VALUE_ADD, REDEVELOPMENT_ACTIVE):

- Show all V1 categories visible
- Display banner at top: *"This deal classifies as VALUE_ADD_REPOSITIONING. V2 mode handling coming soon. Currently underwritten as STABILIZED with manual override available."*
- Auto-fall-back to STABILIZED for engine purposes; user can override to LEASE_UP if they prefer that approximation.

### 12.2 No subject history (empty deal)

- All subject-source fields show platform default with LOW confidence
- Inline blocks render two columns (PEER | EFFECTIVE) instead of three
- Banner at top of Leasing section: *"Upload rent roll to enable subject-property calibration. Currently using peer-set defaults."*

### 12.3 User overrides mode AFTER setting field overrides

User overrides mode from STABILIZED → LEASE_UP. The previously-set assumptions overrides remain in dealStore but become invisible (LEASE_UP-irrelevant categories like "Renewal Rate" hide). If user reverts to STABILIZED, overrides reappear. Overrides are mode-tagged in dealStore so this transition is non-destructive.

### 12.4 Out-of-range platform default

If a platform default value happens to be out of validation range (shouldn't happen but defense in depth): cell renders with red border, tooltip shows "Platform default exceeds validation bounds — flagged for admin review." Override is required to proceed.

### 12.5 Schedule fields in flat-value views

A field like `blended_rent_growth` can be a single value OR a per-year schedule. UI defaults to single value. User clicks "Make schedule" to expand to per-year array editor. Reverting back to flat takes the Y1 value as the new flat value (with confirmation if Y2+ values were customized).

### 12.6 Locked fields (post-close)

Once a deal closes, certain fields lock:
- `pre_leased_count` (no longer relevant)
- `delivery_month` (locked to actual)
- Any field flagged in deal settings as "lock at close"

Locked fields render with a small lock icon and read-only treatment. Override ability removed.

---

## 13. TEST FIXTURES

Storybook stories required for every state combination.

### 13.1 By tier

- Beginner-only view (default)
- Beginner + Advanced expanded
- All three tiers expanded (Beginner + Advanced + Expert)

### 13.2 By mode

- `LEASE_UP_NEW_CONSTRUCTION` view
- `STABILIZED_MAINTENANCE` view
- `OCCUPANCY_RECOVERY` view
- Mode transition (LEASE_UP → STABILIZED at month 22) — with viewer toggle

### 13.3 By data state

- No subject history (platform-only defaults)
- S1 subject (state metrics only)
- S2 subject (full dynamics)
- S3 subject with collision against peer

### 13.4 Cost treatment toggle

- Deal default = HYBRID, view = HYBRID (matching, no badge)
- Deal default = HYBRID, view = OPERATING (mismatch badge visible)
- Toggle between all three values in F9 top bar — verify Sources & Uses, Pro Forma, Returns all re-render

### 13.5 Override flows

- Edit cell → commit → override badge appears
- Click override badge → revert → value falls back
- Apply assumption template → preserves subject calibration where HIGH confidence
- Reset section → confirmation prompt → all overrides clear

### 13.6 Validation

- Out-of-bounds value (renewal rate 90%) → reject with tooltip
- Mode-mismatch override (pre_leased_count edited in STABILIZED mode) → reject
- Cross-field conflict (exit_year > holdYears) → reject

### 13.7 Edge cases

- V2 mode banner displays
- Empty deal banner displays
- Schedule expansion/collapse
- Locked post-close field

---

## 14. BUILD ORDER

1. **Field metadata configuration file** — `frontend/src/config/leasing-fields.config.ts` containing the §3 inventory as TypeScript constants. Single source of truth for what's editable.

2. **Tooltip configuration** — `frontend/src/config/leasing-field-tooltips.json` per §8.3.

3. **Tier toggle persistence** — wire `userPreferences.assumptions_ui` to localStorage and React context.

4. **Global Assumptions "Leasing" section component** — `<LeasingAssumptionsSection>` consuming the field config, rendering category-by-category with tier-aware visibility.

5. **Mode-conditional rendering** — wire `traffic.mode.effective` subscription into the section component to show/hide categories.

6. **Cost Treatment toggle (Location B)** — `<CostTreatmentToggle>` in F9 top bar, view-state only, no dealStore mutation.

7. **Cost Treatment selector (Location A)** — `<CostTreatmentSelector>` in Deal Settings, dealStore-mutating.

8. **Inline Assumption Block configuration** — populate the field arrays per §7 in each Projections section's component.

9. **Validation layer** — wire bounds + cross-field checks per §8.2 into the EditableValueCell commit handler.

10. **Reset and Templates** — section-level reset and template application UI per §11.

11. **Edge case banners** — V2 mode banner, empty-deal banner, mode-transition banner.

12. **Storybook coverage** — all §13 fixtures.

---

## 15. ARCHITECTURAL RULES (codify in CLAUDE.md)

### EDITABILITY-IS-INTENTIONAL RULE

A field becomes editable when it appears in `leasing-fields.config.ts`. Adding a field there is a deliberate decision — it commits to validation rules, default sources, tooltip content, and tier classification. Bypassing the config to make a field editable directly in a component is forbidden. This prevents the editable-surface from drifting through ad-hoc additions.

### TIER-DEFAULTS-PROTECT-USERS RULE

Beginner tier visibility is the budget for cognitive load on the average user. Adding a field to Beginner tier requires justification: is this field's adjustment something MOST sponsor underwriters would actually want to make? If not, it goes in Advanced or Expert. Fields in Beginner tier should number under 12 across all categories.

### SUBJECT-CALIBRATION-PRESERVED-IN-TEMPLATES RULE

Assumption templates (Conservative / Aggressive / Lender Stress) NEVER blindly override subject-calibrated values when subject confidence is HIGH. The template overrides only where current source is `platform_default` or `peer_set:m07` with low confidence. This preserves the platform's data advantage — once you've calibrated against subject, you don't lose that to a generic template.

### COST-TREATMENT-VIEW-VS-DEAL-CLEAR RULE

Two distinct concepts must be visually distinct:
- **Deal default** (Location A in Deal Settings) — the persistent commitment for this deal
- **F9 view override** (Location B in top bar) — temporary scenario exploration

The `[VIEW≠DEAL]` badge appears whenever they differ. This prevents the "I changed it last week and forgot" failure mode where a sponsor analyst's CAPITALIZED LP-deck view becomes the deal's default by accident.

### MODE-OVERRIDE-IS-DEAL-SETTING-NOT-ASSUMPTION RULE

Lease mode classification lives in Deal Settings, not Assumptions. Mode is a fact about the property; assumptions are forecasts about its behavior. Mixing them confuses users about what they're changing and risks mode-overrides being lost in an "assumption reset" action.

---

## 16. OUT OF SCOPE FOR V1

These are explicitly deferred:

1. **Side-by-side scenario comparison** (mentioned §11.4) — V2 feature; field architecture supports it but UI deferred.
2. **Custom user templates** — V1 ships only Conservative / Aggressive / Lender Stress. User-saved templates V2.
3. **Multi-deal bulk edit** — applying overrides across a portfolio of deals. Out of scope.
4. **Field-level audit log** — "who changed what when" history. Tracked at dealStore level today; UI exposure is a separate feature.
5. **Inline help integration** (deeper than tooltips) — context-aware help panels with example values. V2.
6. **Mobile-optimized layout** — V1 targets desktop institutional workflow. Mobile is V2.

---

**End of spec.**

When implementing, the recommended dependency order is:
1. Ship `leasing-fields.config.ts` and tooltip JSON first (independent, unblocks everything)
2. Ship Cost Treatment toggle (highest UX leverage; small surface)
3. Ship Global Assumptions Leasing section (the comprehensive view)
4. Wire Inline Assumption Blocks per §7 (per-Projections-section)
5. Validation, templates, and edge cases follow

The single biggest mistake to avoid: letting individual Projections sections define their own ad-hoc assumption editing UI. Every editable field must route through the config in step 1, otherwise the editable surface fragments and drift starts immediately.
