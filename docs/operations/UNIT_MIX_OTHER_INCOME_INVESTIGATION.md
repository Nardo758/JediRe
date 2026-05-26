# Unit Mix + Other Income Separation — Investigation & Design

**Date:** 2026-05-26  
**Status:** Spec only — no code changes  
**Related task:** #1144  

---

## Table of Contents

1. [Current Combined Surface](#1-current-combined-surface)
2. [Unit Mix Page Design](#2-unit-mix-page-design)
3. [Other Income Page Design](#3-other-income-page-design)
4. [Development Model Considerations](#4-development-model-considerations)
5. [Adoption Timeline Pattern](#5-adoption-timeline-pattern)
6. [Implementation Phasing Recommendation](#6-implementation-phasing-recommendation)
7. [Open Questions](#7-open-questions)

---

## 1. Current Combined Surface

### 1A. Location and mounting

| Detail | Value |
|---|---|
| Primary file | `frontend/src/components/deal/sections/UnitMixTab.tsx` (1,822 lines) |
| Mounted in | `frontend/src/pages/development/financial-engine/ConsoleHubTab.tsx` |
| Sub-tab ID | `unitmix` |
| Sub-tab label | `UNIT MIX` |
| Position in CONSOLE bar | 4th of 5 (STANCE · DEAL TERMS · INPUTS · **UNIT MIX** · TAX) |

There is no separate "Other Income" sub-tab today. Other Income is embedded inside UnitMixTab as a collapsible `AncillaryPanel` component, rendered below the floor-plan table.

### 1B. Sub-sections within UnitMixTab

| Section | Description |
|---|---|
| Header metrics strip | Total units, avg sqft, avg in-place rent, avg market rent, occupancy %, LTL % |
| Human review banner | Shown when `humanReviewNeeded = true`; per-column coverage scorecard (Task #514) |
| Floor plan table | Per-type: unit count, avg sqft, in-place rent (editable), market rent (editable), occupancy, concession %, expiration curve bars (0-3mo / 3-6mo / 6-12mo / 12+mo / MTM / unknown) |
| AncillaryPanel | Collapsible; shows RR / T-12 / OM reconciled breakdown + user-added lines; **read-only** (edits redirect to Pro Forma tab) |
| Renovation Upside table | Value-add deals only; per-floor-plan premium/unit + annual upside, priority ranking |
| M07 Absorption Engine | T01 weekly tours, T05 capture rate, T06 net leases, T07 weeks to 95% — populated from F6 traffic data |
| EGI Waterfall | Market GPR → LTL → vacancy → bad debt → concessions → ancillary → EGI |
| Lease-Up Timeline | Current occ, vacant units, stabilized target, velocity (from M07), expected months to stabilization |
| Deal Type Mode badge | Shows active mode: EXISTING / VALUE-ADD / GROUND-UP |

### 1C. Unit mix data — how it populates

**Source priority (from `unit-mix-propagation.service.ts` and `fetch_unit_mix.ts`):**

1. `deals.module_outputs->'unitMixOverride'` — manual operator override (highest)
2. `deals.module_outputs->'unitMix'` — UnitMixIntelligence AI output
3. `deals.module_outputs->'developmentStrategy'->'selectedPath'.unitMix` — development path fallback
4. `deal_assumptions.unit_mix` (array) + `deal_assumptions.unit_mix_overrides` — per-floor-plan inline overrides applied on top
5. `deals.deal_data->'extraction_rent_roll'->'floor_plan_mix'` — rent roll extraction fallback

**Fields captured per unit type from rent roll (`rent-roll-parser.ts`):**

| Field | Source |
|---|---|
| `type` | Unit type code (e.g. `pt_1A`, `1BR1`) — bedroom count inferred via `inferBedrooms()` |
| `count` | Count of units of that type in current section |
| `avg_sqft` | Average square footage across all units of that type |
| `avg_market_rent` | Average of `marketRent` per unit |
| `avg_effective_rent` | Average of in-place `charges['rent']` among occupied units |
| `occupancy_pct` | `occupied / total` for that floor plan |
| `expiration_curve` | Per-floor-plan bucketed distribution: 0-3mo / 3-6mo / 6-12mo / 12+mo / MTM / unknown |
| `expiration_extraction_status` | `ok` / `partial` / `failed` based on null lease dates |

**Propagation targets when unit mix changes (`unit-mix-propagation.service.ts`):**
- `financial_models.assumptions` — unit mix array + totalUnits / totalSF / avgSF
- `building_designs_3d.metadata->'unitMix'`
- `deals.module_outputs->'developmentCapacity'->'unitMix'`
- `deals.target_units`

**Agent tool:** `fetch_unit_mix.ts` reads `deal_assumptions.unit_mix + unit_mix_overrides`; falls back to `extraction_rent_roll.floor_plan_mix`.

### 1D. Other income data — how it populates

**Sources:**

| Source | Parser | Output field |
|---|---|---|
| Yardi RRwLC rent roll | `rent-roll-parser.ts` | `capsule.otherIncomeMonthly` per category |
| Generic flat rent roll | same parser | same |
| T-12 | `t12-parser` | `otherIncome` bucket |
| OM | OM parser | `parking` / `pet` / `storage` / other ancillary |

**Categories extracted by the rent roll parser:**

| Category key | Charge codes mapped |
|---|---|
| `parking` | `parking`, `garage` |
| `pet_rent` | `petrent`, `pet` |
| `storage` | `storage` |
| `rubs` | `pestctrl`, `trash`, `utilreb`, `water`, `sewer`, `electric`, `gas`, `cable`, `internet` |
| `fees` | `mtmfee`, `termfee`, `misc`, `admin`, `app`, `amenity`, `concierge` |
| `insurance_admin` | `liabins` |
| `concessions_other` | `empdisc`, `otconc`, `othconc`, `employee`, `crtsyoff`, `courtesy`, `upfrtcon`, `upfront`, `renew`, `patrol` |
| `other` | any code not in the above mapping |

**Reconciliation:** `financials-composer.service.ts` merges RR / T-12 / OM per category into `otherIncomeBreakdown` (rows with `rent_roll`, `t12`, `om`, `resolved`, `resolution`, `conflict` flag). This is the canonical source for EGI.

**User-added lines:** Stored in `deal_assumptions.year1.other_income_user_lines` (JSONB array). CRUD via `deal-assumptions.routes.ts`. Each line: `{ id, label, monthly, qty?, rate?, frequency?, note?, created_at }`.

**Where data lands:**
- `deals.deal_data->'extraction_rent_roll'->'other_income_monthly'` — raw capsule from rent roll extraction
- `deal_assumptions.year1.other_income_user_lines` — user-added custom lines
- EGI computation in `proforma-seeder.service.ts` via `financials-composer.service.ts`

### 1E. Existing user editing UX

**Unit mix:**
- Inline edit of in-place rent and market rent per floor plan (OVR badge + tooltip showing original + one-click reset)
- Save/cancel with PATCH in flight spinner + brief SAVED indicator
- No "add unit type" UX exists today
- No "delete unit type" UX exists today

**Other income:**
- `AncillaryPanel` is **read-only** in UnitMixTab — the header reads "edits available in Pro Forma tab · resolved values flow into F9 EGI"
- User-added custom lines are created/deleted in the Pro Forma tab only
- No inline edit of category values in the Unit Mix panel today

---

## 2. Unit Mix Page Design

### 2A. Auto-populate from document upload (existing — verified)

The auto-populate path is functional and well-structured. On document upload:

1. Rent roll parser → `extraction_rent_roll.floor_plan_mix` (per-type counts, sqft, rents, occupancy, expiration curve)
2. `financials-composer.service.ts` → `rentRollSummary.unitMix` (merged with any `deal_assumptions.unit_mix` overrides)
3. `UnitMixTab` fetches via `/api/v1/deals/:id/financials` and renders the floor plan table

**No code change needed for auto-populate — it works today.**

### 2B. Manual build-from-scratch UX

This path is the **critical gap** for development deals (no rent roll).

**Add Unit Type modal/drawer — required fields:**

| Field | Type | Validation |
|---|---|---|
| Label | Text | Required; unique within deal (e.g. "1BR/1BA", "Studio+Den") |
| Bedrooms | Integer select (0 / 1 / 2 / 3 / 4+) | Required |
| Bathrooms | Number (0.5 step) | Required |
| Unit count | Integer | Required; > 0; sum of all types must equal deal's `target_units` |
| Avg sqft | Integer | Required; warn if < 200 or > 4,000 |
| Projected rent ($/mo) | Decimal | Required; warn if outside ±40% of market comp range |
| Market rent ($/mo) | Decimal | Optional; defaults to projected rent |
| Notes | Text | Optional |

**Validation rules:**
- Unit count sum across all types must equal deal's `target_units` (show live running total + delta)
- If `target_units` comes from M03 dev capacity, validate against that number; show advisory if mismatch
- Warn (not block) if avg sqft × count implies a total GFA that exceeds the zoning envelope
- Rent must be a positive number; warn if below local market floor (future: use market comps)

**Suggested defaults (platform-provided):**

When a user adds a new floor plan type, prefill with defaults from:
1. Market comps for the MSA / submarket (future: M04-style comp lookup)
2. `designProgram.store.ts` unit mix percentages (from F3 Programming tab), if set
3. Platform defaults by bedroom type (Studio: 550 sf / $1,200 projected; 1BR: 750 sf / $1,500; 2BR: 1,050 sf / $2,000; 3BR: 1,400 sf / $2,600) — labeled clearly as "platform defaults"

**Edit and delete:**
- Edit: same modal/drawer re-opened from an "edit" affordance on the row
- Delete: confirm dialog; re-validates remaining count sum after removal

**Persistence:** Write to `deal_assumptions.unit_mix` array; trigger `propagateUnitMix(dealId, 'manual')` after save.

### 2C. Leasing metrics + trends from rent roll

**What the rent roll parser already produces and provides to UnitMixTab:**

| Metric | Already in UnitMixTab? | Notes |
|---|---|---|
| Expiration curve (0-3mo / 3-6mo / 6-12mo / 12+mo / MTM) | Yes — `ExpirationBars` per floor plan + deal-wide | Fully wired |
| Extraction quality flags (ok / partial / failed) | Yes — tri-state badges | Fully wired |
| Market rent vs in-place rent (LTL) | Yes — in header metrics + waterfall | Fully wired |
| Occupancy % per floor plan | Yes | Fully wired |
| M07 absorption signals (T01 / T05 / T06 / T07) | Yes — right-side panel | Wired when F6 is linked |
| Lease-up timeline projection | Yes | Wired |
| EGI waterfall | Yes | Wired |

**What is NOT currently surfaced (available in parsed data):**

| Metric | Source | Recommendation |
|---|---|---|
| Term mix (lease duration distribution) | Available in `leaseExpiration` dates — needs bucketing by duration | Surface on Unit Mix page in a small TERM MIX bar or table |
| Per-floor-plan charge code breakdown | `floorPlanMix` — parser produces per-FP charge aggregates but they aren't currently wired to the frontend | Surface on unit mix row expand (collapsible detail row) |
| Move-out / vacancy trend | `moveOutDate` distribution — currently aggregated to occupancy % only | Deferred to LEASING tab |
| Concession burn schedule | `concessionPct` exists per type but no trend shown | Deferred to LEASING tab |
| Velocity / seasonality | Not in rent roll — requires time-series data across multiple uploads | Deferred to LEASING tab |

**Division of labor — Unit Mix page vs LEASING tab:**

The Unit Mix page should answer: "What do I have, how much does it cost, and when do leases roll?" This means expiration curve, LTL by floor plan, and term mix belong here.

The LEASING tab should answer: "How is the property leasing?" This means velocity, seasonality, concession strategy, and renewal rates belong there.

**Recommendation for new Unit Mix page:**
- Keep all existing panels (floor plan table, expiration curve, M07 signals, EGI waterfall, lease-up timeline)
- Add: per-floor-plan expand row showing charge code breakdown (parking/pet/storage/etc. per unit type if available from RR)
- Add: TERM MIX mini-panel showing distribution of lease durations (< 6mo / 6-12mo / 12mo / 13-18mo / 18+mo) — computed from expiration curves + move-in dates if available

### 2D. Cross-tab data flow

**Unit mix changes → GPR:**
`deal_assumptions.unit_mix` → `financials-composer.service.ts` → `rentRollSummary.gprFromUnitMix` → Pro Forma tab Year 1 GPR line.

**Unit mix changes → M07 Traffic Engine:**
`deals.target_units` (updated by propagation) is read by the traffic engine for demand projection. Change to unit count triggers a stale signal on the M07 panel; user should re-run traffic analysis.

**Unit mix changes → F7 3D Design:**
`building_designs_3d.metadata->'unitMix'` updated by propagation service.

**Unit mix changes → Development Capacity (M03):**
`deals.module_outputs->'developmentCapacity'->'unitMix'` updated by propagation service.

No new cross-tab wiring is required for the separation. The propagation service already handles all downstream updates.

---

## 3. Other Income Page Design

### 3A. Existing income categories — display

The new Other Income page should display each category in an editable grid (not read-only as today). Columns:

| Column | Notes |
|---|---|
| Category | Label (Parking, Pet Rent, Storage, RUBS, Fees, Insurance/Admin, Other) |
| Rent Roll ($/yr) | Extracted value; read-only with source badge |
| T-12 ($/yr) | Extracted value; read-only with source badge |
| OM ($/yr) | Extracted value; read-only with source badge |
| Resolved ($/yr) | Editable override field; starts from reconciled value; OVR badge + reset if overridden |
| $/unit/mo | Derived (resolved ÷ total_units ÷ 12); shown for intuition check |
| Source | Reconciliation method: `rent_roll_preferred` / `t12_aggregate` / `om_fallback` / `user_override` / `unseeded` |
| Conflict | ⚠ icon when sources disagree by > 15% |

Below the per-category grid: user-added custom lines section (currently in Pro Forma tab only). On the new Other Income page, users should be able to add/edit/delete custom lines directly here, not only in Pro Forma.

**Persistence for overrides:** write to `deal_assumptions.year1` alongside other assumption overrides. The reconciled `otherIncomeBreakdown` should respect a user-set `resolved_override` per category.

### 3B. Program tab integration

**Location:** `frontend/src/components/design/ProgrammingTab.tsx` (F3 Market → Programming sub-tab).

**Approved amenities that imply other income candidates:**

| Amenity (ProgrammingTab category) | Implied Other Income Source | Suggested Category | Typical $/unit/mo |
|---|---|---|---|
| Pool & Sundeck | Pool/amenity fee | `fees` | $15–$30 |
| Fitness Center | Fitness membership (if charged) | `fees` | $0–$20 |
| Co-Working Lounge | Co-working membership | new: `coworking` | $50–$150/membership |
| Rooftop Lounge | Private event booking | new: `event_revenue` | variable |
| Pet Spa | Additional pet fee | `pet_rent` | $10–$25 |
| Concierge Desk | Concierge tier upgrade | `fees` | $20–$50 |
| Package Lockers | Package locker fee | new: `package_fee` | $5–$15 |
| Covered Parking | Parking revenue | `parking` | $75–$200/space |
| EV Charging Stations | EV charging revenue | new: `ev_charging` | $20–$60/space |

**No mapping exists today in the codebase.** This is a greenfield integration.

**Proposed integration design:**

When the user opens the Other Income page and the deal has an approved amenity program in `designProgram.store`, the page shows a "PROGRAM SUGGESTIONS" banner listing amenities that have implied income but no corresponding existing income line. Each suggestion shows:
- Amenity name + icon
- Suggested income category
- Suggested monthly value range (platform default)
- [Add to Other Income] button

Clicking "Add" creates a new user-added line with the suggested category, label, and a prefilled monthly value that the user can edit. The line gets `source: 'program_suggestion'` tag for provenance.

**Data path:** No new API needed for the suggestion itself. The frontend reads `designProgram.store.program.approvedAmenities` (Zustand, client-side) and cross-references with existing `otherIncomeBreakdown.rows` and `otherIncomeUserLines` to determine which amenities are "unaddressed."

**Schema addition needed:** The `deal_assumptions.year1.other_income_user_lines` items should gain an optional `source_tag: string` field (e.g. `'program_suggestion:ev_charging'`) so the program suggestion origin is traceable.

### 3C. Adoption timeline for new income sources

**When to show an adoption timeline:** Only for income sources that are:
1. New (did not exist in the T-12 or rent roll), OR
2. Explicitly tagged as `adoption_required: true` by the user

Development deals: all user-added income sources default to `adoption_required: true`.  
Existing/value-add deals: user toggles adoption timeline per line.

**Adoption timeline fields (per user-added income line):**

| Field | Type | Description |
|---|---|---|
| `adoption_required` | Boolean | Whether this source ramps up (default: false for existing, true for dev) |
| `ramp_start_period` | Integer (months from acquisition or completion) | When the income source first generates revenue (e.g. 6 = month 6 post-acquisition) |
| `ramp_duration_months` | Integer | Months from first revenue to steady state (0 = immediate; 12 = gradual ramp) |
| `steady_state_monthly` | Decimal ($/mo) | Full-run-rate monthly value — replaces the existing `monthly` field conceptually |
| `probability_adopted` | Decimal 0–1 | Probability the program is actually implemented; applies as a multiplier to steady_state_monthly in projections |

**How it feeds the projection model:**

For a given projection year Y (assume closing = month 0):

```
period_month = (Y - 1) * 12 + 6  // midpoint of year Y

if period_month < ramp_start_period:
    income_this_year = 0
elif period_month < ramp_start_period + ramp_duration_months:
    ramp_fraction = (period_month - ramp_start_period) / ramp_duration_months
    income_this_year = steady_state_monthly * ramp_fraction * 12 * probability_adopted
else:
    income_this_year = steady_state_monthly * 12 * probability_adopted
```

`income_this_year` replaces the current `monthly * 12` flat projection for that line.

**LayeredValue treatment:** The adoption timeline is an **assumption** (L1 layer). Steady-state value is user-set (override slot); the ramp shape is user-configured. The resolved projection is calculated deterministically from these inputs — no AI needed. This fits the existing `LayeredValue<number>` pattern where `resolvedFrom: 'user_override'`.

**Wire-up path:** `proforma-seeder.service.ts` currently reads `other_income_user_lines` and projects each line flat (monthly × 12 per year). The seeder needs to check for `adoption_required` and apply the ramp formula above if set.

### 3D. Per-strategy applicability

**Development deals:**
- No T-12 or rent roll; all Other Income is forward-projected
- All user-added lines default to `adoption_required: true`
- Suggested defaults come from Program tab amenities + platform benchmarks
- The AncillaryPanel "RENT ROLL / T-12 / OM" columns are hidden (no data); only USER column and PROGRAM SUGGESTIONS shown

**Existing / stabilized deals:**
- T-12 and/or rent roll provide existing income lines (read-only with source badge)
- New income sources (from Program tab suggestions) get adoption timeline treatment
- Existing categories can be overridden by user

**Value-add / redevelopment deals:**
- Mix: existing T-12/RR lines shown as-is for pre-renovation period
- New program income sources get adoption timelines starting post-renovation
- Renovation completion date from capex schedule should anchor `ramp_start_period`

**STR deals:**
- STR revenue is typically captured entirely in ADR/occupancy (the main GPR metric)
- Other income (parking, pet, storage) may exist but is usually minimal
- Ancillary panel should remain visible; platform should not hide it for STR
- STR-specific items (channel fees, cleaning fees) do NOT belong in Other Income — they are expense deductions

---

## 4. Development Model Considerations

### 4A. Manual-build path for development deals

Development deals have no rent roll and no T-12. The entire unit mix and other income must be built from scratch. What's required for a complete unit mix:

**Minimum viable unit mix (to unlock GPR projection):**
- At least one floor plan type with count + projected rent
- Sum of unit counts = `deals.target_units` (or explicit acknowledgment that target is being set here)

**Defaults the platform can suggest:**

| Source | Data available today | Confidence |
|---|---|---|
| M03 Dev Capacity output | `deals.module_outputs->'developmentCapacity'` has total unit count and GFA if massing has run | High for count; no rent guidance |
| F3 Programming tab | `designProgram.store.program.unitMix` has studio/1BR/2BR/3BR % splits | Medium — user-set, not market-validated |
| Market comps (future) | M04-style comp lookup by MSA/submarket | High when available |
| Platform defaults by bedroom type | Hardcoded typical ranges | Low — only a starting point |

**Workflow for development deal:**
1. User opens Unit Mix page — sees empty floor plan table with "No units defined" state
2. Platform checks M03 output and F3 Programming tab for available defaults
3. If M03 has run: shows advisory "M03 suggests X units — use as starting point?" with one-click prefill using F3 % splits
4. User edits per-type or adds types manually
5. On save: runs `propagateUnitMix(dealId, 'manual')`

### 4B. Validation against M03 dev capacity

When unit count is saved:
- If `deals.module_outputs->'developmentCapacity'->'targetUnits'` exists and user's sum deviates by > 5%: show amber advisory banner "Unit count (X) differs from M03 capacity output (Y). Confirm this is intentional."
- If per-type avg sqft × count implies total GFA > zoning max GFA: show red warning
- Per-type rent should be compared to market rent from M04 comps if available (future)

These are advisory checks — they do not block save.

---

## 5. Adoption Timeline Pattern

### 5A. Schema (per user-added income line)

```typescript
interface OtherIncomeUserLine {
  id: string;
  label: string;
  monthly: number;              // steady-state $/mo (replaces flat monthly)
  qty?: number;                 // optional: quantity (e.g. 50 EV spaces)
  rate?: number;                // optional: rate per qty unit
  frequency?: 'monthly' | 'annual';
  note?: string;
  source_tag?: string;          // e.g. 'program_suggestion:ev_charging'
  created_at: string;
  
  // Adoption timeline (optional — null = immediate / flat)
  adoption?: {
    ramp_start_period: number;       // months from acquisition/completion
    ramp_duration_months: number;    // 0 = instant; 6 = 6-month ramp
    steady_state_monthly: number;    // full run-rate $/mo
    probability_adopted: number;     // 0.0–1.0; default 1.0
  } | null;
}
```

**Storage:** `deal_assumptions.year1.other_income_user_lines` JSONB array — backwards compatible; existing rows without `adoption` field are treated as immediate/flat.

### 5B. How it feeds projections

The `proforma-seeder.service.ts` iterates `other_income_user_lines` per year. For lines with `adoption` set:

- Year N midpoint month is computed relative to acquisition/completion date
- Linear ramp from 0 to `steady_state_monthly` over `ramp_duration_months`
- Applied `probability_adopted` multiplier at full run-rate
- Result: each year gets a different Other Income line-item value instead of flat `monthly × 12`

The Pro Forma tab year columns for Other Income will show the ramping values visually (same pattern as the growth rate rows already work today).

### 5C. Applicability of this pattern elsewhere

| Use case | Existing mechanism | Adoption timeline applicable? |
|---|---|---|
| Lease-up timing | LVE vacancy schedule in assumptions | Already handled — LVE models absorption |
| CapEx burn | CapEx schedule in assumptions | Already handled — year-by-year schedule |
| Concession burn-off | Growth rates in assumptions | Already handled — concession pct per year |
| New income from renovation completion | **Not handled today** | YES — this is the primary target |
| Utility billing conversion (RUBS rollout) | Not handled | YES — good secondary use case |
| Amenity fee phased rollout | Not handled | YES — EV charging, co-working membership |

**The adoption timeline pattern is a narrow, well-scoped addition.** It applies specifically to income sources that do not exist at acquisition and ramp up after a future event (renovation completion, program launch, etc.). It does not replace or duplicate LVE, CapEx schedule, or growth rates.

---

## 6. Implementation Phasing Recommendation

### Phase 1 — Page separation + unlock edits on Other Income (highest value, lowest risk)

**Scope:**
1. Add a new `otherincome` sub-tab to `ConsoleHubTab` (6th tab: STANCE · DEAL TERMS · INPUTS · UNIT MIX · OTHER INCOME · TAX)
2. Create `OtherIncomeTab.tsx` — move the `AncillaryPanel` content out of `UnitMixTab` and into this new tab
3. Make Other Income editable directly in the new tab (today it's read-only with a redirect to Pro Forma tab) — wire the inline override save to `deal-assumptions.routes.ts`
4. Move the user-added custom lines CRUD from Pro Forma tab into the new Other Income tab (or make it available in both)
5. Remove `AncillaryPanel` from `UnitMixTab` — replace with a small "OTHER INCOME: $X/yr →" summary link that deep-links to the new tab

**Deliverable:** Two clean, focused pages. Unit Mix owns unit composition + leasing signals. Other Income owns ancillary revenue.

**Risk:** Low. AncillaryPanel is already a self-contained component. The data fetching is already in place. This is primarily a re-mounting exercise + enabling writes.

### Phase 2 — Manual add-unit-type UX for development deals

**Scope:**
1. Add "+" affordance to Unit Mix tab floor plan table
2. Add Unit Type modal: label, bed/bath, count, sqft, projected rent
3. Validate count sum against `target_units`
4. Write to `deal_assumptions.unit_mix`; fire propagation

**Risk:** Medium. Requires new modal UI + validation logic + propagation trigger. Unit count sum enforcement may surface edge cases.

### Phase 3 — Program tab suggestions → Other Income candidates

**Scope:**
1. In OtherIncomeTab, read `designProgram.store.program.approvedAmenities`
2. Cross-reference with existing `otherIncomeBreakdown` + `otherIncomeUserLines`
3. Show "PROGRAM SUGGESTIONS" banner for unaddressed amenities
4. One-click "Add" creates user line with `source_tag` and prefilled defaults

**Risk:** Low-Medium. Purely frontend (Zustand store + UI). No new API surface.

### Phase 4 — Adoption timeline for new income sources

**Scope:**
1. Extend `OtherIncomeUserLine` schema with `adoption` block (DB migration — additive JSONB change)
2. Add adoption timeline UI to Other Income line add/edit form: toggle `adoption_required` → reveals ramp fields
3. Update `proforma-seeder.service.ts` to apply ramp formula per year
4. Show ramping values in Pro Forma tab year columns for affected lines

**Risk:** Medium. Touches proforma seeder logic; requires year-by-year ramp computation per line. Schema change is additive (no migration risk to existing data).

---

## 7. Open Questions

### Unit Mix

1. **Add unit type — which field is authoritative for "total units" when manual entries exist?** Today `deals.target_units` and `financial_models.assumptions.totalUnits` can drift. The propagation service writes to both, but if the user sets target_units in Deal Terms and also manually builds a unit mix that sums to a different number, which wins?

2. **Market comps integration for default rents.** Phase 2 prefills rents with platform defaults. Is there a timeline for M04-style comp lookup to power these defaults with real market data?

3. **Development deal unit mix vs F3 Programming tab unit mix.** F3 Programming tab (`ProgrammingTab.tsx`) has its own unit mix % inputs (`studio / oneBed / twoBed / threeBed`). These are not connected to the F9 Unit Mix tab's unit mix data. Should the F3 percentages pre-populate the F9 unit mix when the user transitions from programming to underwriting?

4. **Term mix panel.** The rent roll parser captures lease expiration dates and move-in dates. Computing a term mix distribution (lease duration buckets) is straightforward. Confirm this is desired before Phase 1 scope is finalized.

### Other Income

5. **Override persistence model.** Today the `otherIncomeBreakdown` is computed on the fly by `financials-composer.service.ts` from raw extraction data. When the user overrides a category's resolved value, where does the override persist? Proposed: a new `other_income_overrides` map in `deal_assumptions.year1` (keyed by category). This needs design confirmation before Phase 1 implementation.

6. **Laundry income.** Not currently in the charge code mapping (`CHARGE_CODE_CATEGORY` in `rent-roll-parser.ts`). Laundry revenue is common in apartment properties. Should `laundry` be added as a first-class category?

7. **Co-working membership pricing model.** Co-working income is per-membership, not per-unit. The current `OtherIncomeUserLine` model supports `qty × rate` billing. Is a per-membership model (e.g. "20 memberships × $150/mo") sufficient, or does this need a dedicated co-working income type?

8. **Adoption timeline anchor for development deals.** The `ramp_start_period` is "months from acquisition." For development deals, the relevant anchor is usually "months from construction completion" (certificate of occupancy). Should the adoption timeline support two anchor types (`from_acquisition` / `from_completion`)?

### Cross-cutting

9. **Pro Forma tab duplication.** Currently the Pro Forma tab has Other Income editing (user lines) and the `AncillaryPanel`-equivalent view. After Phase 1, both the Other Income page and the Pro Forma tab will show Other Income. Should the Pro Forma tab's Other Income section become read-only and link to the new Other Income page, or stay editable in both places?

10. **LEASING tab promotion (deferred in ConsoleHubTab comments).** The code comments in `ConsoleHubTab.tsx` explicitly defer LEASING promotion to Phase 3 due to bespoke prop interface. This task surfaces several "belongs in LEASING" metrics (velocity, seasonality, concession schedule). Should LEASING tab promotion be sequenced before or after Other Income separation?
