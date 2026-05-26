# F9 Financial Engine — Module Map

> Canonical reference for the F9 tab structure, sub-tab composition, deal-type visibility rules,
> strategy template dispatch, and data flow. Generated from source on 2026-05-26.
> **Source of truth files:** `FinancialEnginePage.tsx`, `ConsoleHubTab.tsx`,
> `ProjectionsHubTab.tsx`, `CapitalHubTab.tsx`, `ReturnsHubTab.tsx`, `CompareHubTab.tsx`,
> `proforma-blueprint.ts`.

---

## 1. Top-Level Tab Inventory

Defined in `BUILTIN_TAB_LABELS` (line 488, `FinancialEnginePage.tsx`).
10 built-in tabs; tab 9 (ROADMAP) is conditionally hidden (see §3).

| Index | Label | Icon | Component | File |
|------:|-------|------|-----------|------|
| 0 | OVERVIEW | ⊞ | `OverviewTab` | `financial-engine/OverviewTab.tsx` |
| 1 | CONSOLE | ⊕ | `ConsoleHubTab` | `financial-engine/ConsoleHubTab.tsx` |
| 2 | PRO FORMA | ≡ | `ProFormaSummaryTab` | `financial-engine/ProFormaSummaryTab.tsx` |
| 3 | PROJECTIONS | ⋮≡ | `ProjectionsHubTab` | `financial-engine/ProjectionsHubTab.tsx` |
| 4 | CAPITAL | ◈ | `CapitalHubTab` | `financial-engine/CapitalHubTab.tsx` |
| 5 | RETURNS | % | `ReturnsHubTab` | `financial-engine/ReturnsHubTab.tsx` |
| 6 | SCENARIOS | ◐ | `DecisionTab` | `financial-engine/DecisionTab.tsx` |
| 7 | COMPARE | ⇔ | `CompareHubTab` | `financial-engine/CompareHubTab.tsx` |
| 8 | GOAL SEEK | ⊙ | `SensitivityTab` (standalone) | `financial-engine/SensitivityTab.tsx` |
| 9 | ROADMAP | ⊛ | `RoadmapTab` | `financial-engine/RoadmapTab.tsx` |
| 10+ | ✦ *Custom* | — | `CustomTabRenderer` | `financial-engine/CustomTabRenderer.tsx` |

**LP / Lender role:** `platformRole === 'lp' | 'lender'` defaults to tab index 5 (RETURNS) on
first load.

---

## 2. Hub-Tab Sub-Tab Map

Five of the ten built-in tabs are "Hub" shells that host a sub-tab strip.
The remaining tabs (OVERVIEW, PRO FORMA, SCENARIOS, GOAL SEEK, ROADMAP) are single-pane leaf tabs.

### 2.1 CONSOLE (index 1) — `ConsoleHubTab`

Theme: amber active indicator. Module badge: `CONSOLE · M08`.

| Sub-Tab ID | Label | Component | Notes |
|------------|-------|-----------|-------|
| `stance` | STANCE | `StanceTab` | OperatorStance editor — 15 modulation rules |
| `deal-terms` | DEAL TERMS | `DealTermsTab` | Purchase price, hold period, strategies, exit cap |
| `inputs` | INPUTS | `AssumptionsTab` | Revenue, expenses, financing assumptions |
| `unitmix` | UNIT MIX | `UnitMixTab` | Floor-plan grid with occupancy / rent per type |
| `tax` | TAX | `TaxesTab` | Property tax, millage, M26 projections |

Deep-link event: `fe-console-subtab` (CustomEvent `{ subTab: SubTab }`) —
dispatched by `DealJourneyOverlay` when a lever row is clicked.

### 2.2 PROJECTIONS (index 3) — `ProjectionsHubTab`

Theme: cyan active indicator. Auto-seeds LVE state when `f9Financials` reference changes.

| Sub-Tab ID | Label | Component | Notes |
|------------|-------|-----------|-------|
| `projections` | PROJECTIONS | `ProjectionsTab` | Read-only operating-statement grid (hold period × years) |
| `lease-velocity` | LEASE VELOCITY | `LeaseVelocitySection` | LVE engine — mode / concession / absorption inputs |

LVE re-triggers on: `gpr_grid.positioning_changed` DOM event (FloorPlanGrid write-back),
`f9Financials` object-reference change, explicit user run.

### 2.3 CAPITAL (index 4) — `CapitalHubTab`

Theme: cyan active indicator. Module badge: `CAPITAL · M08`.

| Sub-Tab ID | Label | Component | Notes |
|------------|-------|-----------|-------|
| `su` | SRC & USES | `SourcesUsesTab` | Sources and uses of capital |
| `debt` | DEBT | `DebtTab` | M11 Debt Advisor — 4 sub-tabs: Advisor / Configure / Sensitivity / Exit |
| `waterfall` | WATERFALL | `WaterfallTab` | LP/GP waterfall distribution tiers |
| `costsheet` | COST SHEET | `CostSheetTab` | Hard costs / soft costs / capex schedule (M22) |

### 2.4 RETURNS (index 5) — `ReturnsHubTab`

Theme: amber active indicator. Module badge: `RETURNS · M08`.

| Sub-Tab ID | Label | Component | Notes |
|------------|-------|-----------|-------|
| `returns` | RETURNS | `ReturnsTab` | LP/GP IRR, EM, CoC, full waterfall summary |
| `sensitivity` | SENSITIVITY | `SensitivityTab` | Two-way heat maps (IRR × exit cap × rent growth / hold / opex) |

Note: `SensitivityTab` is also mounted standalone at index 8 (GOAL SEEK) where it exposes
the `GoalSeekWidget` with `onSolveBroader` wired to `/api/v2/sigma/broader-goal-seek`.

### 2.5 COMPARE (index 7) — `CompareHubTab`

Theme: financial-green active indicator. Module badge: `COMPARE · M08`.

| Sub-Tab ID | Label | Component | Notes |
|------------|-------|-----------|-------|
| `compare` | COMPARE | `CompareTab` | Side-by-side scenario / version comparison |
| `walkthrough` | WALKTHROUGH | `UnderwritingWalkthrough` | Step-by-step underwriting narrative |

---

## 3. DealType × Tab Visibility Matrix

`DealType = 'existing' | 'development' | 'redevelopment'` (from `types.ts`).
The backend field is `deals.project_type`; frontend resolves via `propDealType ?? propDeal.project_type ?? 'existing'`.

| Tab | existing | development | redevelopment | value-add / rehab / renovation |
|-----|:--------:|:-----------:|:-------------:|:------------------------------:|
| OVERVIEW | ✓ | ✓ | ✓ | ✓ |
| CONSOLE | ✓ | ✓ | ✓ | ✓ |
| PRO FORMA | ✓ | ✓ | ✓ | ✓ |
| PROJECTIONS | ✓ | ✓ | ✓ | ✓ |
| CAPITAL | ✓ | ✓ | ✓ | ✓ |
| RETURNS | ✓ | ✓ | ✓ | ✓ |
| SCENARIOS | ✓ | ✓ | ✓ | ✓ |
| COMPARE | ✓ | ✓ | ✓ | ✓ |
| GOAL SEEK | ✓ | ✓ | ✓ | ✓ |
| ROADMAP | — | — | ✓ | ✓ |

**ROADMAP gate** (function `isRoadmapEligibleDealType`):

```ts
if (dt === 'redevelopment') return true;
return /value.?add|rehab|renovation/i.test(dt);
```

When ROADMAP is hidden, `effectiveBuiltinCount = 9`; custom tabs start at index 9.
When ROADMAP is shown, `effectiveBuiltinCount = 10`; custom tabs start at index 10.

---

## 4. Strategy Dimension

### 4.1 Strategy Fields on Deals

Stored as nullable `LayeredValue` fields on `deal_assumptions`:

| DB column | UI label | Type | Nullable |
|-----------|----------|------|---------|
| `investment_strategy_lv` | Investment Strategy | `LayeredValue<string>` | **yes — intentionally** |
| `exit_strategy_lv` | Exit Strategy | `LayeredValue<string>` | **yes — intentionally** |

**Rule:** Both fields are intentionally nullable. No consumer should default to `"Sale"`, `"Rental"`,
or any other value when both `detected` and `override` slots are null. The DEAL TERMS sub-tab
renders a visible `NOT SET` badge (amber) for unset rows. No backfill is ever performed.

### 4.2 ProForma Template Dispatch

Triggered by `M08 → F9` via `ProFormaTemplateId`. Source: `proforma-blueprint.ts § PROFORMA_TEMPLATES`.

| Template ID | Label | Strategy Triggers | Default Hold | Periodicity | Special Tuning |
|-------------|-------|------------------|:------------:|:-----------:|---------------|
| `acquisition_stabilized` | Acquisition — Stabilized | rental, core, core_plus | 60 mo | annual | — |
| `acquisition_value_add` | Acquisition — Value Add | value_add, rental_value_add | 84 mo | annual | — |
| `development_ground_up` | Development — Ground-Up | bts, bts_for_rent, development, ground_up | 120 mo | monthly | Growth truncated at Y3 |
| `redevelopment` | Redevelopment | redevelopment, reposition, gut_rehab | 96 mo | monthly | — |
| `flip` | Flip — Acquisition + Resale | flip | 18 mo | monthly | Growth truncated at Y1 |
| `str_shortterm` | Short-Term Rental | str, short_term_rental | 60 mo | monthly | Seasonal occupancy (12-factor) |
| `land_hold` | Land Hold | land, land_hold | 60 mo | annual | — |

**Strategy tuning notes:**
- `development_ground_up` (`growthTruncationYear: 3`): BTS deals typically exit by Y3 — rent and
  OPEX growth is zeroed past that year to avoid stacking perpetual compounding onto exit value.
- `flip` (`growthTruncationYear: 1`): ~12–18 mo holds; growth is a single-period delta.
- `str_shortterm` (`seasonalOccupancyFactors`): 12 monthly multipliers (sun-belt default: peak
  Mar–Jul, dip Sep–Nov). Calibrate per-market when bookings data is available.

### 4.3 Template Sections by Template

Each template defines an ordered list of `ProFormaSection` objects that drive the F9 sub-tab
renderer. Key structural differences:

**acquisition_stabilized** — Basis → Revenue → OpEx → NOI/CF → Exit → Returns

**acquisition_value_add** — Basis → Renovation Budget → Revenue (rent ramp) → OpEx → NOI/CF → Exit → Returns

**development_ground_up** — Land → Hard Costs → Soft Costs → Construction Schedule → Revenue at Stab → OpEx → Stabilized NOI → Exit → Returns

**redevelopment** — Basis → Demo & Renovation → Phasing & Lease-Up → Revenue → OpEx → NOI/CF → Exit → Returns

**flip** — Basis → Renovation Budget → Holding Costs → Resale → Returns

**str_shortterm** — Basis → STR Revenue (ADR × occupancy × RevPAR) → OpEx → NOI/CF → Returns

**land_hold** — Land Acquisition → Holding Costs → Exit → Returns

---

## 5. Data Flow — What Feeds F9

F9 is module `M09` in the F-Key map. Source: `proforma-blueprint.ts § M09_INPUTS`.

### 5.1 Required Feeders

| Module | F-Key | Data Keys | Notes |
|--------|-------|-----------|-------|
| M01 | F1 | units, property_type, address | Identity / deal basics |
| M04 | F4 | absorption_rate, months_of_supply, supply_pressure_score | Supply intelligence |
| M05 | F3 | avg_rent_psf, vacancy_rate, rent_growth_pct, submarket_rank | Market intelligence |
| M07 | F6 | absorption_rate, capture_rate, predicted_leases_week | **Required for development deals only** |
| M08 | F5 | recommended_strategy, template, sections, horizon, periodicity | Strategy selector — reshape driver |
| M11 | F8 | loan_terms, debt_service, effective_interest_rate | **Two-pass cycle with M09** |

### 5.2 Optional Feeders

| Module | Data Keys | Notes |
|--------|-----------|-------|
| M02 | zoning_code, max_density | Zoning enrichment |
| M03 | envelope_dimensions, max_units_by_right | Headless GIS / envelope |
| M06 | demand_units_total, demand_score | Demand intelligence |
| M10 | probability_weighted_returns, monte_carlo_distribution | Risk-weighted return inputs |
| M14 | composite_risk_score, cap_rate_adjustment_bps, reserve_overrides | **Two-pass cycle with M09** |
| M15 | rent_comp_data, competitive_positioning | Rent comp research |
| M18 | ocr_extracted_data, document_index | Document extraction (T12, rent roll, tax bill) |
| M26 | projected_total_tax, effective_tax_rate | Tax projections |
| M27 | median_implied_cap_rate, median_price_per_unit | Comparable sales intelligence |
| M29 | unit_mix_program, total_units, avg_unit_size_sf, rent_by_type | Unit Mix Intelligence — preferred over raw M01.units |

### 5.3 Two-Pass Cycles

**M09 ↔ M11 (Debt sizing):**
1. M09 emits stub NOI with placeholder debt service
2. M11 sizes debt against stub NOI (LTV / DSCR / debt yield)
3. M11 returns final loan terms
4. M09 finalises debt service and recomputes cash-on-cash & DSCR

**M09 ↔ M14 (Risk validation):**
1. M09 emits stabilized NOI and exit cap
2. M14 stress-tests assumptions; emits cap-rate adjustment bps and reserve overrides
3. M09 absorbs adjustments; final returns reflect risk-adjusted view

---

## 6. Two-Layer Architecture

All F9 assumptions flow through the **Two-Layer Model** (CLAUDE.md P7):

```
Layer 1 — LLM Reasons        : LayeredValue<T> assumptions (GPR, vacancy, expenses,
                                exit cap, hold period, etc.) stored as JSONB.
                                Sources: broker | platform | user | agent | capsule.
                                Resolved via priority waterfall; provenance tracked.

Layer 2 — Deterministic Calcs : NOI, EGI, IRR, EM, CoC, DSCR, exit value, net sale
                                proceeds, waterfall distributions.
                                Computed by runModel() / buildProjections().
                                LLM never produces these numbers; only reasons about inputs.
```

**LayeredValue** (`stanceModulated?: boolean`, `stanceTrace?: string`): extended for
OperatorStance tagging. Stance changes trigger a zero-LLM-cost re-blend against the cached
underwriting snapshot (see `operatorStance.service.ts`).

**Evidence tiers** (ProFormaSummaryTab):

| Tier | Source | Color |
|------|--------|-------|
| T1 | Uploaded documents (T12, rent roll, tax bill) | cyan |
| T2 | Platform-computed / user overrides | blue |
| T3 | Public / research datasets (BLS, CoStar, market) | purple |
| T4 | Broker OM (unverified, lowest authority) | orange |

---

## 7. Key File Index

### Entry Point
| File | Role |
|------|------|
| `frontend/src/pages/development/FinancialEnginePage.tsx` | F9 root — tab strip, Opus panel, state orchestration, M08 v4.0 |

### Tab Shells (Hub + Leaf)
| File | Tab | Type |
|------|-----|------|
| `financial-engine/OverviewTab.tsx` | 0 OVERVIEW | Leaf |
| `financial-engine/ConsoleHubTab.tsx` | 1 CONSOLE | Hub (5 sub-tabs) |
| `financial-engine/ProFormaSummaryTab.tsx` | 2 PRO FORMA | Leaf (3519 lines) |
| `financial-engine/ProjectionsHubTab.tsx` | 3 PROJECTIONS | Hub (2 sub-tabs + LVE state) |
| `financial-engine/CapitalHubTab.tsx` | 4 CAPITAL | Hub (4 sub-tabs) |
| `financial-engine/ReturnsHubTab.tsx` | 5 RETURNS | Hub (2 sub-tabs) |
| `financial-engine/DecisionTab.tsx` | 6 SCENARIOS | Leaf |
| `financial-engine/CompareHubTab.tsx` | 7 COMPARE | Hub (2 sub-tabs) |
| `financial-engine/SensitivityTab.tsx` | 8 GOAL SEEK (+ RETURNS sub) | Leaf |
| `financial-engine/RoadmapTab.tsx` | 9 ROADMAP | Leaf (gated) |
| `financial-engine/CustomTabRenderer.tsx` | 10+ Custom | Dynamic |

### Console Sub-Tab Components
| File | Sub-Tab |
|------|---------|
| `financial-engine/StanceTab.tsx` | STANCE |
| `financial-engine/DealTermsTab.tsx` | DEAL TERMS |
| `financial-engine/AssumptionsTab.tsx` | INPUTS |
| `components/deal/sections/UnitMixTab.tsx` | UNIT MIX |
| `financial-engine/TaxesTab.tsx` | TAX |

### Types & Config
| File | Contents |
|------|----------|
| `financial-engine/types.ts` | `DealType`, `ModelAssumptions`, `F9DealFinancials`, `LeasingCostTreatment` |
| `backend/src/services/proforma/blueprint/proforma-blueprint.ts` | `FKEY_MAP`, `M09_INPUTS`, `PROFORMA_TEMPLATES`, `STRATEGY_TEMPLATE_TUNING`, `OPEX_LINE_ITEMS` |
| `frontend/src/stores/dealStore.ts` | `useDealStore`, `DealContext`, `OperatorStance`, `stanceAffectedFields` |
| `frontend/src/stores/dealContext.types.ts` | `DealContext`, `LayeredValue`, `AffectedStanceField` |

### Backend Services
| File | Contents |
|------|----------|
| `backend/src/services/operatorStance.service.ts` | OperatorStance CRUD, cache-aware re-blend |
| `backend/src/services/proforma/` | ProForma composition, seeder, composer |
| `backend/src/agents/tools/fetch_operator_stance.ts` | Cashflow Agent tool for stance |

---

## 8. Cross-Tab DOM Events

Events dispatched by F9 for cross-tab coordination.
Subscribers: `window.addEventListener(eventName, handler)`.

| Event | Detail | Fired by | Consumers |
|-------|--------|----------|-----------|
| `basis.changed` | `{}` | `dealStore.setPurchasePrice` after dual-write | S&U tab, debt sizing, going-in cap |
| `hold_period.changed` | `{ holdYears: number }` | `dealStore.emitHoldPeriodChanged` | Projections, Returns |
| `exit_cap.changed` | `{}` | `dealStore.emitExitCapChanged` | Returns strip, net-sale-proceeds row |
| `deal:strategy-changed` | `{ dealId, field, value }` | DealTermsTab | Strategy-aware consumers |
| `fe-console-subtab` | `{ subTab: SubTab }` | `DealJourneyOverlay` | ConsoleHubTab (deep-link) |
| `gpr_grid.positioning_changed` | `{}` | FloorPlanGrid (800ms debounce) | ProjectionsHubTab → re-runs LVE |
| `lease_velocity.output.updated` | `{}` | LVE runner | `FinancialEnginePage` → `fetchF9Financials` |
| `leasing_cost_treatment.changed` | `{}` | AssumptionsTab PATCH | `FinancialEnginePage` → `fetchF9Financials` |

---

## 9. Open Gaps & Pending Work

| ID | Location | Description |
|----|----------|-------------|
| M36 | SensitivityTab OPEX axis | OPEX growth sensitivity grid wired to Section B trajectory drivers — pending M36 covariance matrix build. Cells currently show base IRR with opex axis label only. |
| M07 | ProjectionsHubTab | Confidence bands not yet surfaced in the LVE results panel (Deal Journey M07 pending). |
| M35 | DealJourneyOverlay | Event path visualization (M35) pending — lever rows link to INPUTS sub-tab but do not render a causal chain diagram. |
| M38 | OperatorStance | Calibration loop (M38) pending — stance re-blend uses cached snapshot but does not yet run an automated calibration cycle. |
| T#613 | DealTermsTab | `deal:strategy-changed` dispatched directly from DealTermsTab — not reconciled with the `dealStore` event pattern used by `basis.changed` et al. |
| Task#451 | CustomTabRenderer | Custom tabs created via Opus inline fence (``` customtab ```) — refresh tab list after every Opus reply to detect fence-created tabs. |
| T#797 | ProFormaSummaryTab | `regimeDataByField` — Pattern B sub-rows (pre-renovation / post-stabilization) powered by cashflow agent; null when agent has not run. |
| — | ROADMAP | Value-creation plan tab — fully built; gated on `redevelopment | value-add | rehab | renovation` via `isRoadmapEligibleDealType`. `existing` and pure `development` deals never see this tab. |
