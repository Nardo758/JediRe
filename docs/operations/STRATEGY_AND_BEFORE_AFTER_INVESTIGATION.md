# STRATEGY-CONDITIONAL INPUTS + BEFORE/AFTER UI — INVESTIGATION

**Date:** 2026-05-26  
**Status:** Complete — incorporates verification pass findings  
**Predecessor:** Verification pass (2026-05-26) confirmed file was never produced; this dispatch re-fires with verification findings folded in as Amendments 1-5.

---

## TABLE OF CONTENTS

1. [Per-Strategy Field Visibility — Current State (7×3 Matrix)](#1-per-strategy-field-visibility)
2. [Before/After UI — Existing Surfaces Inventory](#2-beforeafter-ui-surfaces-inventory)
3. [Three Architectural Findings](#3-architectural-findings)
   - [3a. investmentStrategy ↔ deal_type ↔ ProFormaTemplateId Disconnect](#3a-investmentstrategy--deal_type--proformatplateid-disconnect)
   - [3b. Templates Don't Drive UI; Missing UI for str/flip/land_hold](#3b-templates-dont-drive-ui)
   - [3c. M07 → regimeData Is Indirect — and regimeDataByField Is Never Populated](#3c-m07--regimedata-is-indirect)
4. [Integration Touchpoints](#4-integration-touchpoints)
5. [Design Recommendations](#5-design-recommendations)
6. [Implementation Phasing Recommendation](#6-implementation-phasing-recommendation)
7. [Open Questions — Classified](#7-open-questions-classified)

---

## 1. Per-Strategy Field Visibility

### 1.1 ProFormaTemplateId — Canonical Template Registry

Source: `backend/src/services/proforma/blueprint/proforma-blueprint.ts` lines 104-242

Seven templates are defined. Each has a `strategyTriggers` array (M08 strategy values that cause this template to be selected), a `defaultHorizonMonths`, a `periodicity`, and an ordered `sections` list that defines what the LLM should produce. These templates are consumed **by the LLM prompt builder only** — they do not gate React rendering (see §3b).

| ProFormaTemplateId | Label | strategyTriggers | Horizon | Periodicity | Sections |
|---|---|---|---|---|---|
| `acquisition_stabilized` | Acquisition — Stabilized | rental, core, core_plus | 60mo | annual | basis, revenue, opex, noi, exit, returns |
| `acquisition_value_add` | Acquisition — Value Add | value_add, rental_value_add | 84mo | annual | basis, **capex** (renovation budget), revenue (rent ramp), opex, noi, exit, returns |
| `development_ground_up` | Development — Ground-Up | bts, bts_for_rent, development, ground_up | 120mo | **monthly** | **land, hard_costs, soft_costs, construction_schedule**, revenue, opex, noi, exit, returns |
| `redevelopment` | Redevelopment | redevelopment, reposition, gut_rehab | 96mo | **monthly** | basis, **demo_capex, phasing**, revenue, opex, noi, exit, returns |
| `flip` | Flip — Acquisition + Resale | flip | 18mo | **monthly** | basis, capex, **carry** (holding costs), exit (resale), returns (profitMargin, monthsHeld) |
| `str_shortterm` | Short-Term Rental | str, short_term_rental | 60mo | **monthly** | basis (**furnishingBudget**), **STR revenue** (adr, occupancyRate, revPar, cleaningFees, platformFees), opex (**cleaningPayroll**), noi, returns (**revPar**) |
| `land_hold` | Land Hold | land, land_hold | 60mo | annual | basis (landCost), **carry** (propertyTax, insurance, debtService, maintenance), exit, returns (profitMargin only) |

### 1.2 DealTypeKey Taxonomy

Source: `frontend/src/config/m09_line_item_patterns.ts` lines 22-28

The pattern routing system uses a separate 6-value taxonomy:

```typescript
export type DealTypeKey =
  | 'value_add'
  | 'redevelopment'
  | 'development'
  | 'lease_up'
  | 'stabilized'
  | 'existing';
```

The `deals.deal_type` column (set at deal creation, never updated by strategy saves) is normalized to this type via `normalizeDealType()` (hyphen → underscore, line 141-143). Default when null: `'existing'` (confirmed: `COALESCE(d.deal_type, 'existing')`, `cashflow-underwriting.routes.ts` line 249).

**`flip`, `str_shortterm`, and `land_hold` have no corresponding `DealTypeKey`.** The two taxonomies are not 1:1.

### 1.3 Pattern B Routing Matrix (Full)

Source: `frontend/src/config/m09_line_item_patterns.ts` lines 72-133  
`isPatternB(field, dealType)` returns true for the cells marked **B**. All other cells default to **C** (single resolved value, no expand).

| Line Item | value_add | redevelopment | development | lease_up | stabilized | existing |
|---|---|---|---|---|---|---|
| GPR | **A** (floor plan grid) | **A** | **A** | **A** | **A** (read-only) | **A** |
| vacancy_loss | **B** | **B** | **B** | C | C | C |
| concessions | **B** | **B** | **B** | C | C | C |
| bad_debt | **B** | **B** | C | C | C | C |
| other_income | **B** | **B** | C | C | C | C |
| utilities | C | **B** | C | C | C | C |
| repairs_maintenance | **B** | **B** | C | C | C | C |
| marketing | **B** | **B** | **B** | C | C | C |
| contract_services | **B** | **B** | C | C | C | C |
| turnover | **B** | **B** | **B** | C | C | C |
| property_tax | C | C | C | C | C | C |
| insurance | C | C | C | C | C | C |
| payroll | C | C | C | C | C | C |
| management_fee | C | C | C | C | C | C |
| capex_reserve | C | C | C | C | C | C |
| cap_rate / debt / exit_cap | C | C | C | C | C | C |

Pattern B rows: value_add = 9 rows; redevelopment = 11 rows; development = 4 rows (vacancy, concessions, marketing, turnover). Lease_up, stabilized, existing = 0 B-pattern rows.

### 1.4 Full 7 × 6 Matrix: ProFormaTemplateId × DealTypeKey

This matrix documents what the combination represents semantically, what the UI renders today, what it should render, and the gap. The "what renders today" column describes the F9 ProFormaSummaryTab rendering since that is the primary operator-facing surface.

---

**`acquisition_stabilized` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| existing | YES — primary case | GPR (Pattern A), all OPEX (Pattern C), exit/returns | Same | No gap for base case |
| stabilized | YES — same as existing | Same as existing | Same | No gap |
| value_add | PARTIAL — misaligned | Pattern B rows activate, but template has no capex section | capex section + rent ramp should be present | Template vs deal_type mismatch produces misleading Pattern B without renovation context |
| redevelopment | NO — nonsensical | All 11 B-rows activate against stabilized revenue model | Should not be possible | Operator would see before/after rows with no renovation data backing them |
| development | PARTIAL — mismatch | 4 B-rows activate | Full construction schedule needed | Wrong template entirely |
| lease_up | PARTIAL — could make sense | No B-rows (all C) | Some lease-up specific fields | lease_up not in any template's strategyTriggers |

---

**`acquisition_value_add` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| value_add | YES — primary case | Pattern B on 9 rows; RenovationAssumptionsSection shows for `dealType === 'value-add'` | + rent ramp entry UI; capex entry (currently read-only from renovation endpoint) | Rent ramp has no direct input row in ProFormaSummaryTab |
| redevelopment | PARTIAL — heavy value-add | All 11 B-rows; renovation section | Phasing plan, demo costs | Phasing fields not surfaced in UI |
| existing | NO — mismatch | No B-rows; no renovation section | Should not be default | Operator picks value_add template but gets stabilized display |
| development | NO | 4 B-rows | Wrong template | Mismatch |
| stabilized | NO | 0 B-rows | Wrong template | Mismatch |
| lease_up | PARTIAL | 0 B-rows | Some lease-up adjustments | Template doesn't cover lease-up |

---

**`development_ground_up` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| development | YES — primary case | 4 B-rows (vacancy, concessions, marketing, turnover); no construction cost entry UI | Land, hard costs, soft costs, construction schedule entry | Major UI gap — construction costs have no input surface |
| redevelopment | PARTIAL — heavy development | 11 B-rows; no construction cost UI | Should use redevelopment template instead | Template/type mismatch |
| existing | NO | 0 B-rows; no construction UI | Wrong entirely | Mismatch |
| value_add | NO | 9 B-rows; no construction UI | Wrong entirely | Mismatch |
| stabilized | NO | 0 B-rows | Wrong | Mismatch |
| lease_up | PARTIAL | 0 B-rows | Some | Template covers post-stabilization only |

---

**`redevelopment` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| redevelopment | YES — primary case | 11 B-rows; renovation section | + phasing/demo cost entry UI | Phasing (phasingPlan, unitsOnlinePerPhase, lossOfRentDuringRenovation) has no dedicated input surface |
| value_add | PARTIAL — overlap | 9 B-rows; renovation section | Similar but lighter | Acceptable approximation |
| development | PARTIAL | 4 B-rows; no phasing | Should be development_ground_up | Template mismatch |
| existing | NO | 0 B-rows | Wrong | Mismatch |
| stabilized | NO | 0 B-rows | Wrong | Mismatch |
| lease_up | PARTIAL | 0 B-rows | Some | Template covers post-stabilization |

---

**`flip` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| (none) | N/A — flip has no DealTypeKey | The closest deal_type in practice would be `value_add` or `existing` | Holding costs (propertyTax, insurance, utilities, debtService), resale price entry, profitMargin, monthsHeld | **Complete UI gap.** None of flip's template-specific fields exist anywhere in F9. |

---

**`str_shortterm` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| (none) | N/A — str_shortterm has no DealTypeKey | If deal_type = 'existing', operator sees stabilized view | ADR input, occupancyRate input, revPar display, cleaningFees, platformFees, furnishingBudget, cleaningPayroll | **Complete UI gap.** None of STR's template-specific revenue or expense fields exist anywhere in F9. |

---

**`land_hold` × DealTypeKey**

| DealTypeKey | Semantically valid? | Renders today | Should render | Gap |
|---|---|---|---|---|
| (none) | N/A — land_hold has no DealTypeKey | If deal_type = 'existing', operator sees income-bearing stabilized view with GPR, OPEX, etc. | landCost input, annual holding costs (tax, insurance, maintenance), no income section, exit at land sale price only | **Complete UI gap.** The land hold template has NO income — showing GPR/OPEX is actively misleading. |

---

## 2. Before/After UI Surfaces Inventory

The codebase has four existing surfaces that address some aspect of before/after or current-vs-target comparison. None was purpose-built as a general before/after underwriting view; each has a distinct scope.

### 2.1 RegimeExpand (`frontend/src/components/f9/RegimeExpand.tsx`)

**What it shows:** Per-row inline expansion revealing two sub-rows beneath a Pattern B line item: `pre_renovation` and `post_stabilization`. Each sub-row shows a value, source label, confidence indicator, and (when available) a `transition_year` intermediate row. A `regimeLabel` string shows when the pre-renovation regime ends.

Source: `RegimeExpand.tsx` lines 44-50:
```typescript
interface RegimeData {
  pre_renovation: RegimeValue;
  post_stabilization: RegimeValue;
  transition_year?: { value: number | null; source: string | null; ... } | null;
  transition_timing_label?: string | null;
}
```

**When it's active:** Only for Pattern B rows (see §1.3 matrix). Activated by operator clicking the row's expand affordance. In `ProFormaSummaryTab.tsx` at lines 1374, 1435, 1707: `isPatternB(r.field, dealType)` gates the affordance.

**What data it consumes:** `regimeDataByField[field]` from the `DealFinancials` interface (`ProFormaSummaryTab.tsx` lines 179-182). This data flows from the API response for `getDealFinancials`.

**Critical gap — regimeDataByField is never populated (see §3c):** Backend searches for `regimeDataByField` in TypeScript source files return no results. The cashflow agent's `line-item-matrix.ts` v1.2 Single-Value Mandate explicitly prohibits writing `pre_renovation`/`post_stabilization` sub-fields. The `RegimeExpand` component renders placeholder dashes when `regimeData` is null (line 228: `const hasAgentData = regimeData != null`). In practice, every `RegimeExpand` invocation renders placeholders.

**Verdict:** The surface exists and is architecturally correct, but it is inert — it has no data source.

### 2.2 StabilizedPotentialView (`frontend/src/components/F9/StabilizedPotentialView.tsx`)

**What it shows:** A 4-column layout (LINE ITEM | CURRENT (T12) | PRO FORMA (Y_S) | Δ | DRIVER) for a fixed set of NOI-level line items. Shows going-in cap rate, exit cap rate, yield on cost, value creation, stabilized value in a summary strip. This is the clearest "current vs target" comparison surface in the product.

Source: `StabilizedPotentialView.tsx` lines 2-11:
> "LINE ITEM | CURRENT (T12) | PRO FORMA (Y_S) | Δ | DRIVER"

**ModelType:** `'acquisition_value_add' | 'acquisition_stabilized' | 'development' | 'redevelopment'` (line 20). Notably: **not str_shortterm, flip, or land_hold.** These three are unhandled.

**When it's active:** Rendered in `ProFormaSummaryTab.tsx` at line 1279 unconditionally for the deal. The component calls its own API endpoint to fetch current vs proforma values.

**What data it consumes:** Its own API endpoint (not `getDealFinancials`). Populates from T12 trailing data vs proforma snapshot.

**Verdict:** The most complete "before/after" surface. It works for 4 model types. It is not a per-row expandable — it is a standalone tab section. It operates independently from RegimeExpand.

### 2.3 CompareHubTab (`frontend/src/pages/development/financial-engine/CompareHubTab.tsx`)

**What it shows:** Two sub-tabs:
- **COMPARE** (CompareTab): Side-by-side version comparison — compares numbered deal versions (deal_versions table). This is a deal-version diff, not a pre/post renovation comparison.
- **WALKTHROUGH** (UnderwritingWalkthrough): On-demand natural-language narrative generated by the Commentary Agent after a cashflow agent run. Explains how each assumption was derived. Requires an explicit API call to generate (line 35-52 of `UnderwritingWalkthrough.tsx`). The narrative is sourced from `write_underwriting` → `request_walkthrough_narrative` tool chain.

Source: `CompareHubTab.tsx` lines 10-17:
```typescript
type Section = 'compare' | 'walkthrough';
const SECTIONS = [
  { id: 'compare', label: 'COMPARE', icon: '⇔' },
  { id: 'walkthrough', label: 'WALKTHROUGH', ... },
];
```

**Verdict:** COMPARE is version history, not before/after renovation. WALKTHROUGH is narrative, not a structured data surface. Neither directly addresses the pre-renovation vs post-stabilization operator input problem.

### 2.4 m09_line_item_patterns.ts Pattern Routing Matrix

**What it does:** Not a UI surface itself — the configuration that determines which rows get the RegimeExpand affordance. Documented fully in §1.3.

**Verdict:** Well-designed and verified against spec. The gap is not in the routing logic but in the absence of data to fill it.

---

## 3. Architectural Findings

### 3a. investmentStrategy ↔ deal_type ↔ ProFormaTemplateId Disconnect

#### 3a.1 Current State of Each Field

**`deals.deal_type`** (DB column on `deals` table):
- Set at deal creation; default `'existing'` when null  
  Source: `cashflow-underwriting.routes.ts` line 249: `COALESCE(d.deal_type, 'existing')`
- Values seen in codebase: `'existing'`, `'value_add'`/`'value-add'`, `'redevelopment'`, `'development'`, `'lease_up'`/`'lease-up'`, `'stabilized'`  
  Source: `roadmap/action-library.ts` lines 23, 60, 98, 136, etc.; migrations (line_item_benchmarks.sql line 19: "existing | value-add | lease-up | development")
- **Is never updated** by any strategy-related API call. Confirmed: PATCH `/api/v1/deals/:dealId/assumptions/strategy` (`deal-assumptions.routes.ts` lines 674-745) updates only `deal_assumptions.investment_strategy_lv`. No `UPDATE deals SET deal_type` statement exists in that route.
- Used by: `isPatternB(field, dealType)` in ProFormaSummaryTab (Pattern B routing); `StabilizedPotentialView` via its own endpoint; `roadmap/action-library.ts` for action gating; `cashflow.postprocess.ts` lines 1375-1379 (value-add signal detection in agent post-processing).

**`deal_assumptions.investment_strategy_lv`** (JSONB LayeredValue on `deal_assumptions`):
- Populated by PATCH `/api/v1/deals/:dealId/assumptions/strategy`  
  Source: `deal-assumptions.routes.ts` lines 723-731
- Valid override values: `'Build-to-Sell'`, `'Flip'`, `'Rental'`, `'Short-Term Rental'`  
  Source: `deal-assumptions.routes.ts` line 681
- Surfaced in frontend as `investmentStrategy` LayeredValue in `DealTermsTab.tsx` lines 480, 509, 566-569
- Read by `proforma-adjustment.service.ts` lines 3106-3131 when composing `DealFinancials`; surfaced as `data.investmentStrategy` to the UI
- **Is never read by Pattern B routing.** The `isPatternB` function signature takes `dealType: DealTypeKey | string | null | undefined` — it reads from `deal.deal_type`, not from `investmentStrategy`.
- `cashflow.postprocess.ts` line 839 uses `dealData.investmentStrategy` as a fallback when resolving deal strategy from proforma fields — this is an agent-side heuristic, not a UI routing signal.

**`ProFormaTemplateId`** (blueprint constant):
- Defined in `proforma-blueprint.ts` lines 104-111 (7 values)
- The blueprint is consumed by Opus "at prompt-build time, so it never invents fields, modules, or formulas that don't exist" (blueprint header, lines 8-9)
- Template selection happens in M08 (Strategy module) based on `strategyTriggers`; M08 outputs `{ recommended_strategy, template, sections, horizon, periodicity }` to M09
  Source: `proforma-blueprint.ts` lines 62-63: `{ moduleId: 'M08', strength: 'required', dataKeys: ['recommended_strategy', 'template', 'sections', 'horizon', 'periodicity'] }`
- **The React renderer does not read `ProFormaTemplateId`**. ProFormaSummaryTab reads `deal_type` for all branching decisions. The template ID stays inside the agent/LLM layer.

#### 3a.2 Which UI Elements Use Which Signal

| UI Surface | Signal Used | Source |
|---|---|---|
| Pattern B routing (RegimeExpand) | `deal.deal_type` | `ProFormaSummaryTab.tsx` line 934: `(deal?.['deal_type'])` |
| RenovationAssumptionsSection visibility | `dealType` prop (`deal_type`) | `RenovationAssumptionsSection.tsx` line 120: `dealType === 'redevelopment' \|\| dealType === 'value-add'` |
| StabilizedPotentialView model type | `modelType` from API | Separate endpoint, likely derived from `deal_type` server-side |
| Deal Terms display (investmentStrategy LV) | `investment_strategy_lv` | `DealTermsTab.tsx` lines 566-569 |
| Roadmap action gating | `deal_type` | `roadmap/action-library.ts` |
| Cashflow agent value-add GPR detection | `deal_type` OR `investment_strategy` from proforma_fields | `cashflow.postprocess.ts` lines 1375-1379 |
| LLM template selection | `ProFormaTemplateId` via M08 | Agent prompt system only |

#### 3a.3 Operator-Perceived Behavior Gap

An operator creates a deal with `deal_type = 'existing'` (stabilized acquisition), then later navigates to Deal Terms and changes `investmentStrategy` to `'Rental'` (value-add intent). Nothing changes in the F9 UI. Pattern B rows remain hidden. The RenovationAssumptionsSection does not appear. The LLM, however, may receive `investmentStrategy = 'Rental'` in its context and could select the `acquisition_value_add` template, producing underwriting that assumes renovation context — context that the operator never entered because the UI never showed the renovation fields.

The reverse gap also exists: `investmentStrategy` valid values (`'Build-to-Sell'`, `'Flip'`, `'Rental'`, `'Short-Term Rental'`) are completely different vocabulary from the `strategyTriggers` arrays in the blueprint (`'value_add'`, `'bts'`, `'development'`, `'flip'`, `'str'`). There is no mapping between these two vocabularies in the codebase.

#### 3a.4 Reconciliation Options

**Option A — investmentStrategy becomes canonical; deal_type derived**  
Operator sets `investmentStrategy` in Deal Terms. On save, backend derives `deal_type` from it (e.g., `'Flip'` → `deal_type = 'flip'`) and updates `deals.deal_type`. All pattern routing reads `deal_type` as today — the fix is upstream. Requires: (1) extending `DealTypeKey` to include `flip`, `str`, `land`; (2) a clear mapping function; (3) a UI warning when deal_type would change (since it affects historical data reads).

**Option B — deal_type remains canonical; investmentStrategy removed or made UI-only**  
The operator selects deal_type at creation (or can change it in Deal Terms). `investmentStrategy` LayeredValue is removed or becomes a decorative note with no routing consequence. Simpler to implement; loses the LV provenance tracking on strategy.

**Option C — Two parallel signals with explicit sync**  
`deal_type` drives UI routing as today. `investmentStrategy` drives LLM template selection only. A sync check warns the operator when the two are inconsistent ("Your investment strategy is set to Flip, but this deal is configured as a stabilized acquisition — some fields may not match"). No auto-update; operator manually reconciles. Lowest disruption; highest operator confusion risk.

**Recommendation:** Option B or C. Option A requires extending DealTypeKey and migrating all consumers. Option B is cleanest architecturally. Option C is lowest risk for existing deals. The decision should not be made inline — this is a BLOCKING open question (see §7).

#### 3a.5 Downstream Impact

- **Validation Grid:** Source priority logic (`VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md`) uses a single `resolved` column. If deal_type changes, what was the "current state" column shifts meaning (e.g., a stabilized deal's T12 actuals vs a value-add deal's pre-renovation actuals are fundamentally different baselines). Resolution of 3a is a prerequisite for Validation Grid Phase 2+ design.
- **Unit Mix work:** The pre/post unit mix split (whether to show separate unit mixes for before/after renovation) is gated entirely on `deal_type`. If an operator running a value-add deal has `deal_type = 'existing'`, the unit mix never shows a split — even if the renovation section is intended. Resolution of 3a directly determines whether UnitMixTab Phase 2 should implement a pre/post toggle.

---

### 3b. Templates Don't Drive UI — Missing UI for str/flip/land_hold

#### 3b.1 Independent Code Trace (Verification Confirmed)

The blueprint header states: "This blueprint is the SINGLE SOURCE OF TRUTH consumed by: Opus (LLM) at prompt-build time... The runtime payload validator that gates any pro forma JSON Opus emits... The drift test" (`proforma-blueprint.ts` lines 6-15). There is no mention of React rendering.

ProFormaSummaryTab reads no `templateId` or `ProFormaTemplateId` field anywhere. Search of that file returns zero matches for `templateId`, `ProFormaTemplateId`, `str_shortterm`, `flip`, `land_hold`, `adr`, `revpar`, `furnish`, `cleaningFee`, `platformFee`.

`StabilizedPotentialView` ModelType (`StabilizedPotentialView.tsx` line 20) supports only: `acquisition_value_add | acquisition_stabilized | development | redevelopment` — three of seven template IDs have no corresponding model type.

#### 3b.2 Missing UI per Template

**`str_shortterm`:** Template defines unique revenue fields: `adr`, `occupancyRate`, `revPar`, `cleaningFees`, `platformFees`, `effectiveGrossIncome`; unique expense: `cleaningPayroll`; unique basis field: `furnishingBudget`; unique return metric: `revPar`. None of these have input rows, display rows, or validation rows in any F9 tab. The StabilizedPotentialView doesn't handle this model type. An STR operator would see the standard multifamily GPR/OPEX layout — structurally wrong (STR revenue is occupancy × ADR, not per-unit contracted rent).

**`flip`:** Template defines: basis + renovation capex (shared with value-add), `carry` section (holding costs: propertyTax, insurance, utilities, debtService over the hold), `exit` at `exitPrice` (resale, not cap-rate based), return metrics: `profitMargin`, `monthsHeld`. The ProFormaSummaryTab has no `profitMargin` display row, no `exitPrice` input (only `exitCapRate`-based exit), no hold-period carry section. An 18-month flip modeled with an exit cap rate is structurally wrong.

**`land_hold`:** Template has NO revenue section (no GPR, no income). Sections: `basis (landCost)`, `carry (propertyTax, insurance, debtService, maintenance)`, `exit (exitPrice)`, `returns (leveredIRR, profitMargin)`. The F9 UI unconditionally renders GPR and OPEX rows — showing income for a land hold is actively misleading. Return metrics: leveredIRR and profitMargin only (no cashOnCash, no equityMultiple, no DSCR).

#### 3b.3 Recommendation on Template-Driven UI

Template-driven UI should be implemented. The multi-model architecture decision (`proforma-blueprint.ts` as single source of truth) was intended to be consumed by both the LLM and the UI renderer — the current state where only the LLM uses it is an implementation gap, not a design decision.

**Recommended pattern:** A `getActiveTemplate(dealType, investmentStrategy)` resolver function that maps from the DB signals to a `ProFormaTemplateId`. The F9 hub tab renderer then reads the template's `sections` array to determine which sub-tabs and row groups to show. This is a hub-and-spoke pattern already present in `DealModuleContext`.

The `DealTypeKey` enum must be extended to add `'flip'`, `'str'`, `'land'` — or the resolver maps from `investmentStrategy` directly to `ProFormaTemplateId` without going through `deal_type`. Which approach depends on the §3a reconciliation decision.

#### 3b.4 Template Combinations with Partial Implementation

`development_ground_up` has the most complete F9 infrastructure behind it (development deal type has 4 Pattern B rows, M07 is required for development). However, the construction cost entry UI (hard costs, soft costs, construction schedule) is absent from ProFormaSummaryTab. This is a partial implementation — the analytics exist but the operator cannot enter the input numbers.

`redevelopment` has the strongest Pattern B coverage (11 rows) and the `RenovationAssumptionsSection` surfaces for `dealType === 'redevelopment'`. However, the template's `phasing` section fields (`phasingPlan`, `unitsOnlinePerPhase`, `lossOfRentDuringRenovation`) have no input surface.

---

### 3c. M07 → regimeData Is Indirect — and regimeDataByField Is Never Populated

#### 3c.1 Actual Data Flow (Confirmed)

The cashflow agent system prompt (`cashflow/system.ts` lines 120, 142, 229, 604, 608) describes M07 data as a **reason/delta signal** that adjusts the agent's underwriting posture:

> "The platform signals (M07, M05, M35, M11, M36) are NOT standalone inputs. They are *reasons* to adjust assumptions above or below the cohort baseline." (system.ts line 142)

M07 `absorption_rate`, `capture_rate`, and `predicted_leases_week` reach the agent as context fields in DealContext. The agent uses them to support or challenge its rent growth / vacancy projections. The agent then calls `write_underwriting` with a `proforma_snapshot` — a flat key-value map of field-level values.

`write_underwriting.ts` schema (lines 55-61):
```typescript
const InputSchema = z.object({
  deal_id: z.string().uuid(),
  proforma_snapshot: z.record(z.string(), z.unknown()),  // flat map
  evidence_map: z.record(z.string(), z.unknown()).optional(),
});
```

No `regimeDataByField`, `pre_renovation`, or `post_stabilization` keys are in this schema.

#### 3c.2 The v1.2 Single-Value Mandate

The cashflow agent is explicitly instructed NOT to write regime sub-fields:

`backend/src/agents/prompts/cashflow/line-item-matrix.ts` line 33:
> "**v1.2 Single-Value Mandate:** Every non-GPR field produces exactly ONE value per Pro Forma column (the post-stabilization economics). If you are underwriting a value-add or redevelopment deal, your internal reasoning must account for the pre-renovation regime — but your output is the single post-stabilization value. Put the regime narrative (pre-reno rate, regime shift rationale, and post-stab target) in the evidence `reasoning` field. Do NOT populate separate pre_renovation or post_stabilization output keys for these fields."

This mandate is repeated throughout `line-item-matrix.ts` at lines 10, 92, 144, 193, 302, 768, 825, 840, 855.

#### 3c.3 regimeDataByField Is Never Populated

Search of backend TypeScript source files returns **zero results** for `regimeDataByField` or `regime_data_by_field`. It is defined in `ProFormaSummaryTab.tsx` as an optional field in the `DealFinancials` interface (lines 179-182) but is never built or written by any backend service. The `RegimeExpand` component renders placeholder dashes whenever `regimeData` is null — which is always (confirmed: `RegimeExpand.tsx` line 228: `const hasAgentData = regimeData != null`).

The `pre_renovation` and `post_stabilization` regime narrative that the agent does produce lives in `underwriting_evidence.reasoning` (free text) — it is not structured data that can drive the RegimeExpand UI display.

#### 3c.4 Implications for Before/After UI Design

The post-renovation column in `RegimeExpand` is currently unreliable — it shows dashes — regardless of whether the agent has run. The agent-mediated path is not wrong architecturally, but the mandate must change or a new data path must be built for RegimeExpand to be useful:

**Path A — Lift the v1.2 Single-Value Mandate for regime fields:** Allow the agent to write `pre_renovation` and `post_stabilization` sub-values for Pattern B fields. These would be stored in the proforma_snapshot under structured keys (e.g., `vacancy_loss.pre_renovation`, `vacancy_loss.post_stabilization`) and read back into `regimeDataByField` by the `getDealFinancials` composer. This makes the agent the source of truth for both regime sides.

**Path B — Build a deterministic pre-renovation resolver:** A backend service reads the T12 rent roll actuals (from `deal_data.extraction_rent_roll` or live `rent_roll` rows) and constructs the `pre_renovation` side without the agent. The `post_stabilization` side comes from the agent's single-value output. `regimeDataByField` is populated by combining these two deterministic sources.

**Path C — Remove regimeDataByField / RegimeExpand from the design:** Accept that inline per-row before/after is not viable without a data source. Concentrate the before/after design in `StabilizedPotentialView` (which does have a working data path) and extend it for more deal types.

**Recommendation:** Path B is the most tractable. T12 actuals are already extracted (rent roll, T12 income statement). The pre-renovation side can be built deterministically; the agent only needs to confirm the post-stabilization side, which it already produces as its single-value output. Path A risks agent hallucinating regime breakdowns at high cost.

---

## 4. Integration Touchpoints

### 4.1 Cross-Fix: UNIT_MIX_OTHER_INCOME_INVESTIGATION.md

**Pre/post unit mix split decision:**  
`UnitMixTab.tsx` renders a single unit mix view. For value-add and redevelopment deals, there is a meaningful distinction between the pre-renovation occupied unit mix (existing tenants, current rents) and the post-renovation target unit mix (renovated floor plans, new lease rents). Whether to implement a dual-view (toggle or side-by-side) in UnitMixTab Phase 2 is gated on: (a) the §3a reconciliation decision (does deal_type reliably identify value-add vs stabilized?); (b) the §3c resolution (does post-renovation data exist to populate the target-state side?).

**Implication for Unit Mix Phase work:** Do not implement a pre/post unit mix split until §3a (deal_type canonical signal) is resolved. The UI toggle would be gated on `deal_type === 'value_add' || 'redevelopment'` — if deal_type is unreliable (§3a), the toggle shows/hides based on wrong data.

**Other Income adoption ramp anchor:**  
The adoption ramp `ramp_start_period` is pre-filled from renovation completion month (Task #1161, already merged). This integration is working. The open question is whether the ramp start should be gated on the post-renovation occupancy level (i.e., ramp doesn't start until a minimum occupancy threshold is achieved), which requires the `post_stabilization` occupancy data — currently absent (§3c).

### 4.2 Cross-Fix: VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md

**Current state vs target state column treatment:**  
The Validation Grid (`VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md`) uses a single `resolved` column as the current-state reference. For stabilized deals, `resolved` = T12 trailing. For value-add and redevelopment deals, `resolved` is ambiguous — is it the pre-renovation actuals or the post-stabilization proforma?

**Implication for Validation Grid Phase 3+:** The grid needs a `baseline` concept — pre-renovation actuals as the "where we are" column, proforma as the "where we're going" column. This is architecturally the same as the `pre_renovation` / `post_stabilization` split in RegimeExpand. The two features should share a data source; building them separately would create divergent data paths.

**Source priority logic:**  
The Validation Grid source priority (T12 > broker > platform > agent) assumes a single truth state. For value-add deals, T12 is the pre-renovation truth and agent output is the post-renovation truth — they should not compete in the same priority stack. The Validation Grid Phase design must account for this deal-type-conditional interpretation.

---

## 5. Design Recommendations

**Rec 1 — Resolve the three-field disconnect before any UI work (§3a)**  
Pick Option B (deal_type canonical) or Option C (parallel signals, explicit sync warning). Document it as an ADR. All downstream work — Pattern B routing, validation grid, unit mix split, template-driven section visibility — depends on a reliable `deal_type` signal.

**Rec 2 — Extend DealTypeKey to cover remaining templates**  
Add `'flip'`, `'str'`, `'land'` to `DealTypeKey`. These three have no UI today and cannot be gated without a deal_type value. This is a prerequisite for template-driven UI visibility.

**Rec 3 — Build a getActiveTemplate() resolver**  
A single function mapping `(deal_type, investmentStrategy?) → ProFormaTemplateId`. The F9 hub renderer reads the template's `sections` array to show/hide sub-tabs and row groups. This connects the blueprint (already a SSOT for the LLM) to the React renderer.

**Rec 4 — Populate regimeDataByField via Path B (deterministic pre-renovation resolver)**  
Build a backend service that reads T12/rent-roll actuals for Pattern B fields and constructs the `pre_renovation` slot. Post-stabilization slot comes from the cashflow agent's existing single-value output. Lift the v1.2 mandate partially: allow the agent to annotate (not mandate) pre_renovation values for fields where it has strong evidence.

**Rec 5 — Extend StabilizedPotentialView to cover all 7 model types**  
Add `flip`, `str_shortterm`, `land_hold` as model types. For `flip`: suppress income-bearing rows; show holding costs and resale; return profitMargin. For `str_shortterm`: replace GPR with ADR × occupancy; show platform fees, cleaning costs. For `land_hold`: no income rows at all; show carry costs only.

**Rec 6 — Keep RegimeExpand as the before/after pattern for operational rows**  
RegimeExpand (inline per-row) and StabilizedPotentialView (summary NOI view) are complementary, not competing. RegimeExpand is appropriate for row-level pattern B fields (vacancy, concessions, R&M). StabilizedPotentialView is appropriate for the NOI-level summary. Both should be extended rather than replaced by a split-screen design.

**Rec 7 — Defer full split-screen before/after view**  
A full split-screen view (like a two-column deal book) is architecturally expensive and would require both pre-renovation and post-stabilization data to be simultaneously available. That data path does not exist today (§3c). Phase this as a future milestone after Rec 4 is complete.

---

## 6. Implementation Phasing Recommendation

**Phase 0 — Prerequisites (no UI, unblocks everything else)**  
- Resolve §3a: pick Option B or C; document as ADR
- Extend `DealTypeKey` to add `flip`, `str`, `land`  
- Build `getActiveTemplate(deal_type, investmentStrategy)` resolver
- Estimated scope: 1-2 small backend + type PRs

**Phase 1 — Template-driven section gating (enables flip/STR/land operators)**  
- Wire `getActiveTemplate()` into F9 hub tab renderer
- For `flip`: hide GPR/vacancy rows; show holding costs, resale price input, profitMargin
- For `str_shortterm`: replace GPR row with ADR + occupancy inputs; add platform fee and cleaning payroll rows
- For `land_hold`: suppress all income rows; show carry section only
- Extend `StabilizedPotentialView` model types
- Estimated scope: medium — affects ProFormaSummaryTab, StabilizedPotentialView, and hub tab renderer

**Phase 2 — Populate regimeDataByField (enables RegimeExpand to show live data)**  
- Build deterministic pre-renovation resolver (reads T12/rent-roll actuals into `pre_renovation` slot)
- Add structured `post_stabilization` mapping from cashflow agent snapshot to `regimeDataByField`
- Wire into `getDealFinancials` composer
- RegimeExpand renders real data instead of dashes
- Estimated scope: medium backend — new service layer

**Phase 3 — Unit Mix pre/post split + Validation Grid dual-column**  
- UnitMixTab: add pre/post toggle gated on `deal_type` (requires Phase 0)
- Validation Grid: add `baseline` column for pre-renovation actuals (requires Phase 2 data path)
- Estimated scope: medium frontend

**Phase 4 — Phasing/construction cost entry UI for redevelopment and development_ground_up**  
- Add input surfaces for `phasingPlan`, `unitsOnlinePerPhase`, `lossOfRentDuringRenovation` (redevelopment template)
- Add construction schedule inputs for `development_ground_up` template
- Estimated scope: medium frontend

---

## 7. Open Questions — Classified

### BLOCKING — Implementation cannot proceed without resolution

**Q1 — investmentStrategy ↔ deal_type reconciliation approach**  
Which option (A, B, or C from §3a.4) is the canonical design? All pattern routing, section visibility, unit mix split, and validation grid design are gated on this.

**Q2 — regimeDataByField population path (Path A, B, or C from §3c.4)**  
Does the agent lift the v1.2 Single-Value Mandate (Path A), or is a deterministic pre-renovation resolver built (Path B), or is RegimeExpand abandoned (Path C)? All before/after UI work below the NOI level is gated on this.

**Q3 — DealTypeKey vocabulary extension**  
Must `flip`, `str`, and `land` be added to `DealTypeKey`? If yes, all consumers of that type must be updated. This is a prerequisite for §3b template-driven UI and for Pattern B routing to be meaningful for those deal types.

### IMPORTANT — Affects scope or design but doesn't block start

**Q4 — StabilizedPotentialView model type for str/flip/land**  
What should the 4-column layout show for a flip (no recurring income, profit-margin returns), STR (ADR-based revenue), or land hold (no income at all)? These require new layout variants in the component.

**Q5 — Should operator changes to investmentStrategy emit a warning when mismatched with deal_type?**  
Even under Option C, a warning UI ("Your investment strategy doesn't match your deal configuration") needs a design decision: warning severity, dismiss behavior, what action it recommends.

**Q6 — Is the rent ramp entry UI for value-add complete?**  
The `acquisition_value_add` template defines `rentRampSchedule` as a required field. The F9 UI has no dedicated rent ramp input row (RenovationAssumptionsSection provides the premium ramp chart, but not a full month-by-month schedule entry). Is this gap in scope?

**Q7 — Phasing UI for redevelopment**  
Template requires `phasingPlan`, `unitsOnlinePerPhase`, `lossOfRentDuringRenovation`. What is the input UX — a structured table, a simple text field, or a dedicated phasing sub-tab?

**Q8 — Does lease_up need its own template?**  
`lease_up` is a valid `DealTypeKey` value and appears in migrations. No `ProFormaTemplateId` covers it. Lease-up deals may need a distinct template (month-by-month absorption model, concession-heavy revenue, low early NOI). Currently they fall through to `existing`.

### INFORMATIONAL — Can be handled inline

**Q9 — investmentStrategy valid values vocabulary mismatch**  
The `investmentStrategy` override values (`'Build-to-Sell'`, `'Flip'`, `'Rental'`, `'Short-Term Rental'`) don't match blueprint `strategyTriggers` (`'bts'`, `'flip'`, `'rental'`, `'str'`). When building the `getActiveTemplate()` resolver, a mapping table is needed. Low risk; can be done inline.

**Q10 — Should `lease_up` be in `DealTypeKey` extension?**  
Already a valid DB value. Adding it to the DealTypeKey enum and giving it a pattern entry (similar to development's 4 B-rows) is low effort.

**Q11 — Is the `transition_year` slot in regimeDataByField used anywhere?**  
`RegimeExpand.tsx` line 248 reads `regimeData.transition_year`. It is typed in the interface but never populated. Confirm whether this represents the mid-renovation year (partial occupancy) and whether it should be part of the Phase 2 regime resolver scope.

---

## SOURCE CITATION INDEX

| Claim | File | Lines | Excerpt |
|---|---|---|---|
| 7 ProFormaTemplateId values | `proforma-blueprint.ts` | 104-111 | `'acquisition_stabilized' \| 'acquisition_value_add' \| 'development_ground_up' \| 'redevelopment' \| 'flip' \| 'str_shortterm' \| 'land_hold'` |
| Full PROFORMA_TEMPLATES with strategyTriggers | `proforma-blueprint.ts` | 135-243 | All 7 template specs with sections arrays |
| DealTypeKey enum | `m09_line_item_patterns.ts` | 22-28 | 6 values: value_add, redevelopment, development, lease_up, stabilized, existing |
| isPatternB reads dealType, not investmentStrategy | `m09_line_item_patterns.ts` | 168-173 | `export function isPatternB(field, dealType)` |
| Pattern B routing table | `m09_line_item_patterns.ts` | 72-133 | PATTERN_TABLE with 10 B-pattern entries |
| deal_type defaults to 'existing' | `cashflow-underwriting.routes.ts` | 249 | `COALESCE(d.deal_type, 'existing')` |
| PATCH /assumptions/strategy does NOT update deals.deal_type | `deal-assumptions.routes.ts` | 674-745 | Updates `deal_assumptions.investment_strategy_lv` only; no UPDATE to `deals` table |
| investmentStrategy valid values vocabulary | `deal-assumptions.routes.ts` | 681 | `['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental']` |
| investmentStrategy composed into DealFinancials | `proforma-adjustment.service.ts` | 3106-3131 | `investmentStrategyLv` mapped from `investment_strategy_lv` |
| investmentStrategy used as deal_type fallback (agent only) | `cashflow.postprocess.ts` | 835-843 | Strategy resolution chain: `dealRow.strategy ?? project_type ?? development_type ?? dealData.investmentStrategy` |
| value-add signal detection gate (agent postprocess) | `cashflow.postprocess.ts` | 1372-1379 | `deal_type ?? investment_strategy` tested against value-add keywords |
| regimeDataByField typed in DealFinancials | `ProFormaSummaryTab.tsx` | 179-182 | `regimeDataByField?: Record<string, { pre_renovation: ..., post_stabilization: ... }>` |
| RegimeExpand rendered for Pattern B rows | `ProFormaSummaryTab.tsx` | 1374, 1395-1401, 1435, 1460-1467, 1707, 1727-1733 | `isPatternB(r.field, dealType)` gates expand |
| RegimeExpand shows dashes when no agent data | `RegimeExpand.tsx` | 228-246 | `const hasAgentData = regimeData != null && (pre_renovation.value != null \|\| post_stabilization.value != null)` |
| regimeDataByField never populated in backend | Search across all `backend/src/**/*.ts` | — | Zero results for `regimeDataByField` or `regime_data_by_field` |
| v1.2 Single-Value Mandate — agent forbidden from writing pre/post sub-fields | `cashflow/line-item-matrix.ts` | 10, 33, 92, 144, 193, 302, 768, 825, 840, 855 | "Do NOT populate separate pre_renovation or post_stabilization output keys" |
| write_underwriting schema — flat proforma_snapshot, no regime fields | `write_underwriting.ts` | 55-61 | `proforma_snapshot: z.record(z.string(), z.unknown())` |
| StabilizedPotentialView model types (4, missing str/flip/land) | `StabilizedPotentialView.tsx` | 20 | `'acquisition_value_add' \| 'acquisition_stabilized' \| 'development' \| 'redevelopment'` |
| StabilizedPotentialView: CURRENT (T12) vs PRO FORMA (Y_S) layout | `StabilizedPotentialView.tsx` | 2-11 | "LINE ITEM \| CURRENT (T12) \| PRO FORMA (Y_S) \| Δ \| DRIVER" |
| UnderwritingWalkthrough: narrative only, requires API call | `UnderwritingWalkthrough.tsx` | 27-52 | POST to `/api/v1/deals/:dealId/underwriting/walkthrough` |
| RenovationAssumptionsSection gated on value-add OR redevelopment | `RenovationAssumptionsSection.tsx` | 120 | `dealType === 'redevelopment' \|\| dealType === 'value-add'` |
| RenovationAssumptionsSection field types | `RenovationAssumptionsSection.tsx` | 10-60 | RenovationData interface: renovationUnits, currentTierId, availableTiers, premiumRamp, capexItems, rehabCostPerUnit |
| M07 is a reasoning signal, not a standalone input | `cashflow/system.ts` | 142 | "The platform signals (M07, M05, M35, M11, M36) are NOT standalone inputs. They are *reasons* to adjust assumptions" |
| ProFormaSummaryTab reads deal_type not templateId | `ProFormaSummaryTab.tsx` | 934 | `const dealType = (deal?.['deal_type'])` |
| roadmap action-library deal_type values | `roadmap/action-library.ts` | 23, 60, 98, 136 | `deal_types: ['existing', 'value_add', 'redevelopment']` |
| Blueprint consumed by LLM at prompt-build time, not React | `proforma-blueprint.ts` | 6-15 | "consumed by: Opus (LLM) at prompt-build time... runtime payload validator... drift test" |

---

## P8 VERIFICATION — Task #1249

**Date:** 2026-05-27  
**Verifier:** Task #1249 (agent, non-self-verification pass)  
**Protocol:** CLAUDE.md P8 — Verify Before Queueing

---

### 1. Document Integrity

- All 7 sections present and complete (Table of Contents matches content).
- SOURCE CITATION INDEX present at end (22 entries).
- No TODO markers, placeholder text, or incomplete stubs found.
- Document header correctly notes it incorporates a prior verification pass as Amendments 1–5 (folded inline, not kept as appendix — acceptable).
- Classification framework (BLOCKING / IMPORTANT / INFORMATIONAL) applied consistently across §7. 11 open questions classified; none appear mislabeled.

**Result: PASS**

---

### 2. Source Citation Spot-Checks

10 of 22 citations verified against live codebase. Results:

| Claim | File | Cited Lines | Verified? | Notes |
|---|---|---|---|---|
| ProFormaTemplateId — 7 values | `proforma-blueprint.ts` | 104–111 | ✓ CONFIRMED | Exact match |
| DealTypeKey enum — 6 values | `m09_line_item_patterns.ts` | 22–28 | ✓ CONFIRMED | Exact match. Full path: `frontend/src/config/m09_line_item_patterns.ts` (glob-verified) |
| deal_type defaults to 'existing' | `cashflow-underwriting.routes.ts` | 249 | ✓ CONFIRMED | `COALESCE(d.deal_type, 'existing')` |
| investmentStrategy valid values | `deal-assumptions.routes.ts` | 681 | ✓ CONFIRMED | `['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental']` |
| regimeDataByField never populated in backend | backend/src/**/*.ts search | — | ✓ CONFIRMED | Zero results for both `regimeDataByField` and `regime_data_by_field` |
| v1.2 Single-Value Mandate | `cashflow/line-item-matrix.ts` | 10, 33 | ✓ CONFIRMED | Mandate text verbatim; repeated at 92, 144, 193, 302 |
| write_underwriting schema — flat proforma_snapshot | `write_underwriting.ts` | 55–61 | ✓ CONFIRMED | `proforma_snapshot: z.record(z.string(), z.unknown())` at line 57 |
| StabilizedPotentialView model types (4 only) | `StabilizedPotentialView.tsx` | 20 | ✓ CONFIRMED | `acquisition_value_add \| acquisition_stabilized \| development \| redevelopment` |
| ProFormaSummaryTab reads deal_type not templateId | `ProFormaSummaryTab.tsx` | 934 | ✓ CONFIRMED | `const dealType = (deal?.['deal_type'] as string \| null) ?? ...` |
| M07 is a reasoning signal, not a standalone input | `cashflow/system.ts` | 142 | ✓ CONFIRMED | Verbatim match |

**One minor transcription note:** The SOURCE CITATION INDEX excerpt for `RegimeExpand.tsx` line 228 quotes `const hasAgentData = regimeData != null` — the actual condition is `regimeData != null && (pre_renovation.value != null || post_stabilization.value != null)`. The excerpt is abbreviated but the substance of the claim ("renders placeholder dashes when no agent data") is accurate.

**Result: PASS — all 10 spot-checked claims accurate**

---

### 3. Cross-Fix Integration Review

**§4.1 — Unit Mix cross-fix:** Substantive. Documents the pre/post unit mix split dependency on §3a (deal_type canonical signal) and confirms the adoption ramp Task #1161 integration is working. Not a placeholder.

**§4.2 — Validation Grid cross-fix:** Substantive. Explains the baseline ambiguity issue for value-add deals (pre-renovation actuals vs proforma as competing "current state" signals). Correctly notes that the Validation Grid and RegimeExpand should share a data source to avoid divergent paths.

**Result: PASS — both cross-fix sections substantive**

---

### 4. Open Question Classification Review

| # | Question | Classified As | Correct? |
|---|---|---|---|
| Q1 | investmentStrategy ↔ deal_type reconciliation | BLOCKING | ✓ — all pattern routing gated on this |
| Q2 | regimeDataByField population path (A/B/C) | BLOCKING | ✓ — all before/after UI below NOI level gated on this |
| Q3 | DealTypeKey vocabulary extension | BLOCKING | ✓ — prerequisite for flip/STR/land template-driven UI |
| Q4 | StabilizedPotentialView model types for str/flip/land | IMPORTANT | ✓ — affects scope but doesn't block start on other tracks |
| Q5 | investmentStrategy ↔ deal_type mismatch warning UX | IMPORTANT | ✓ — design decision, not prerequisite |
| Q6 | Rent ramp entry UI completeness | IMPORTANT | ✓ — in-scope question, not a blocker |
| Q7 | Phasing UI UX pattern for redevelopment | IMPORTANT | ✓ — can be resolved inline during Phase 4 |
| Q8 | Does lease_up need its own template? | IMPORTANT | ✓ — affects scope but downstream |
| Q9 | investmentStrategy ↔ blueprint strategyTriggers vocabulary | INFORMATIONAL | ✓ — handled inline in getActiveTemplate() resolver |
| Q10 | Should lease_up be in DealTypeKey extension? | INFORMATIONAL | ✓ — low-effort add |
| Q11 | transition_year slot usage | INFORMATIONAL | ✓ — confirm during Phase 2 scope |

**Result: PASS — all 11 questions correctly classified; no implicit blockers mislabeled**

---

### 5. Gaps Assessment

No blocking gaps found. Three informational gaps noted for downstream awareness:

**Gap 1 (INFORMATIONAL):** The document does not trace where `investmentStrategy` is read in the frontend beyond `DealTermsTab.tsx`. If any other component reads it for display or routing, that reader would be affected by Q1 reconciliation. Low risk given regexes show `investment_strategy` is primarily a Deal Terms concern.

**Gap 2 (INFORMATIONAL):** The `deal-assumptions.routes.ts` PATCH route is cited at lines 674–745 but not directly line-verified (only line 681 for valid values confirmed). The substance of the claim ("no UPDATE to deals.deal_type") is consistent with the broader codebase search showing no `UPDATE deals SET deal_type` pattern anywhere.

**Gap 3 (INFORMATIONAL):** `RenovationAssumptionsSection.tsx` line 120 gate condition cited but file not found at the expected path. The claim (gated on `dealType === 'redevelopment' || dealType === 'value-add'`) is corroborated by `UnitMixTab.tsx` line 1699: `const isValueAdd = dealType === 'redevelopment' || dealType === 'value-add'` — same logic in same codebase. Verify file path before Task #1234 (RenovationAssumptionsSection gate fix).

---

### VERDICT

**APPROVED**

Task #1263 (A1 vs A2 investigation: strategy ↔ deal_type canonical) may begin. The investigation document is complete, all spot-checked citations are accurate, cross-fix integration is substantive, and open questions are correctly classified. The three informational gaps noted above do not block Track 2 work.

---

## VERIFICATION PASS — 2026-05-27

**Verified by:** Task #1238 (P8 Verify Before Queueing)  
**Method:** Read-only. No code changes. All claims checked against live codebase state.

---

### V1. Document Integrity

**File exists at expected path:** `docs/operations/STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md` — CONFIRMED.

**Required sections — presence and substantiveness:**

| Required Section | Present? | Notes |
|---|---|---|
| Per-strategy field visibility matrix | YES | Delivered as 7×6 (7 ProFormaTemplateId × 6 DealTypeKey), not 7×3 as spec described. The 7×6 is more complete — covers all valid DealTypeKey combinations per template, not just 3 columns. No content gap; the larger matrix is strictly better. |
| Before/after UI surface inventory | YES | §2 covers 4 surfaces: RegimeExpand, StabilizedPotentialView, CompareHubTab, m09 routing config. Each has verdict, data source, and gap assessment. |
| Three architectural findings | YES | §3a (three-field disconnect), §3b (templates don't drive UI), §3c (regimeDataByField never populated). All three are substantive with code traces, source citations, and options analysis. |
| Cross-fix integration with Unit Mix investigation | YES | §4.1 — pre/post unit mix split gate on §3a, adoption ramp anchor on §3c. Two specific integration points with recommendations. |
| Cross-fix integration with Validation Grid investigation | YES | §4.2 — `resolved` column ambiguity for value-add deals, source priority conflict for pre vs post states. Two specific integration points with recommendations. |
| Design recommendations | YES | §5 — 7 recommendations (Rec 1–7), each linked to a specific finding. |
| Implementation phasing | YES | §6 — 5 phases (Phase 0–4) with scope descriptions and dependency ordering. |
| Open questions classified BLOCKING / IMPORTANT / INFORMATIONAL | YES | §7 — 11 questions: 3 BLOCKING (Q1–Q3), 5 IMPORTANT (Q4–Q8), 3 INFORMATIONAL (Q9–Q11). |

**Verdict — document integrity: PASS.** All required sections are present and substantive. The matrix is 7×6 rather than 7×3 (superior to spec).

---

### V2. Source Citation Spot-Checks

**Claim 1 — PATCH `/assumptions/strategy` updates only `investment_strategy_lv`, not `deal_type`**

Source: `backend/src/api/rest/deal-assumptions.routes.ts` lines 674–745.

Verification: grep for `deal_type` across the entire file returns **zero matches**. The route builds a dynamic UPDATE against `deal_assumptions` only. The UPDATE target is `deal_assumptions` (line 735: `UPDATE deal_assumptions SET ${sets.join(', ')} WHERE deal_id = $1`). The only LV fields touched are `exit_strategy_lv` (lines 716–720) and `investment_strategy_lv` (lines 726–729). No write to `deals.deal_type` exists anywhere in the route.

**Verdict: CONFIRMED.**

---

**Claim 2 — The Single-Value Mandate is repeated 9 times in `line-item-matrix.ts`**

Source: `backend/src/agents/prompts/cashflow/line-item-matrix.ts`, cited at lines 10, 92, 144, 193, 302, 768, 825, 840, 855.

Verification: grep for `no pre_renovation|Do NOT populate separate|Single-Value Mandate|single-value mandate` returns 8 lines with explicit mandate or prohibition language: lines 33, 92, 144, 193, 302, 768, 825, 855. The preamble block (lines 8–15) contains "Do NOT output pre_renovation or post_stabilization sub-fields" (line 10), which the grep pattern didn't capture due to phrasing difference ("output" vs "populate"). Including line 10 preamble = 9 discrete mandate locations.

**Minor discrepancy:** The §3c.2 body text cites line 840 but the grep finds no mandate text at line 840 — the closest confirmed citation is line 855. The citation index conflates lines 10 and 33 into a single entry. The count of "9 times" is materially correct (9 confirmed locations: 10, 33, 92, 144, 193, 302, 768, 825, 855); line 840 may be a line-shift artifact from an earlier file version.

**Verdict: CONFIRMED with minor citation note.** The substance is accurate — the mandate is pervasively repeated. The specific line 840 citation is unverified; likely a line number that drifted.

---

**Claim 3 — Pattern B routing reads `deal_type` (not `investmentStrategy`)**

Source: `frontend/src/config/m09_line_item_patterns.ts` lines 168–173.

Verification: `isPatternB(field: string, dealType: DealTypeKey | string | null | undefined)` — the function signature takes `dealType`, not `investmentStrategy`. The implementation calls `getLineItemPattern(field, dealType)` which reads from `PATTERN_TABLE` keyed by field, checking `entry.dealTypes.includes(normalizeDealType(dealType))`. No reference to `investmentStrategy` anywhere in this file.

`ProFormaSummaryTab.tsx` line 934 (cited): `const dealType = (deal?.['deal_type'])` — reads from `deal.deal_type` DB column directly.

**Verdict: CONFIRMED.**

---

**Claim 4 — `regimeDataByField` is never written by any backend code path**

Source: Claimed via search across `backend/src/**/*.ts`.

Verification: grep for `regimeDataByField|regime_data_by_field` across `backend/src` returns **zero matches**. The field is typed in the frontend (`ProFormaSummaryTab.tsx` lines 179, 1401, 1467, 1733) — but all frontend references are reads (`data?.regimeDataByField?.[r.field] ?? null`), never writes. The backend never produces this field. The `getDealFinancials` composer chain writes no such key. `write_underwriting.ts` schema is `proforma_snapshot: z.record(z.string(), z.unknown())` — a flat map with no regime sub-structure.

**Verdict: CONFIRMED.** `regimeDataByField` is defined in the frontend type and read by `RegimeExpand` (three call sites: lines 1401, 1467, 1733) but is never populated by any backend service. Every `RegimeExpand` invocation receives `null` and renders placeholder dashes.

---

**Claim 5 — Randomly selected matrix cell: `flip × DealTypeKey` — "Complete UI gap. None of flip's template-specific fields exist anywhere in F9."**

Source: §1.4, `flip` row; §3b.2; verification via `ProFormaSummaryTab.tsx` search.

Verification: grep for `flip|str_shortterm|land_hold|adr|revpar|furnish|cleaningFee|platformFee` across `ProFormaSummaryTab.tsx` returns **zero matches**. The file is 3,746 lines; none of the flip-specific template fields (`carry`, `exitPrice`, `profitMargin`, `monthsHeld`, `holdingCosts`) appear. `DealTypeKey` in `m09_line_item_patterns.ts` does not include `flip` — it would normalize to an unrecognized string, falling back to Pattern C for all rows. The matrix cell claim ("complete UI gap") is structurally accurate.

**Verdict: CONFIRMED.**

---

### V3. Cross-Fix Integration Coverage

**Unit Mix investigation integration points (§4.1):**

1. **Pre/post unit mix split gated on §3a** — Specific. Names `UnitMixTab.tsx` as the file, identifies the `deal_type === 'value_add' || 'redevelopment'` gating condition, explains the failure mode (toggle shows/hides on wrong data if deal_type is unreliable), and issues a concrete recommendation ("Do not implement pre/post unit mix split until §3a resolved"). Has both identification and recommendation. ✓

2. **Other Income adoption ramp anchor from renovation completion** — Specific. References Task #1161 (merged) and identifies the unsolved dependency: ramp-start gating on post_stabilization occupancy threshold, which requires §3c data that doesn't exist yet. Has both identification and open question. ✓

Both integration points are specific (naming files, tasks, and conditions) and each carries a recommendation or open question. **PASS.**

**Validation Grid investigation integration points (§4.2):**

1. **`resolved` column ambiguity for value-add deals** — Specific. Explains that for value-add, T12 is pre-renovation truth and agent output is post-renovation truth, so they must not compete in the same priority stack. Ties directly to VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md §1A source priority logic. Recommendation: shared data source between Validation Grid Phase 3 and RegimeExpand. ✓

2. **Source priority logic deal-type-conditional interpretation** — Specific. Identifies the structural conflict in the Validation Grid's existing T12 > broker > platform > agent priority when applied to value-add deals. Recommends the grid design must account for this. ✓

Both points are specific and carry actionable guidance. **PASS.**

**Overall cross-fix integration verdict: PASS.** Integration points are not generic; each one traces to a named file, a named spec section, and a design consequence.

---

### V4. Open Questions Classification

All 11 open questions from §7, with independent classification assessment:

| # | Question | Document Class | Verification Class | Notes |
|---|---|---|---|---|
| Q1 | investmentStrategy ↔ deal_type reconciliation approach | BLOCKING | BLOCKING | All pattern routing and section visibility gated on this. Depends on product decision, not missing data. |
| Q2 | regimeDataByField population path (A/B/C) | BLOCKING | BLOCKING | All before/after UI below NOI level gated on this. V4 confirmed data exists (T12/RR actuals); path is an architectural choice. |
| Q3 | DealTypeKey vocabulary extension (flip/str/land) | BLOCKING | BLOCKING | Template-driven UI and Pattern B routing for three template types require this. Code change, not data dependency. |
| Q4 | StabilizedPotentialView layout for str/flip/land | IMPORTANT | IMPORTANT | Design decision; doesn't block start of Phase 0. |
| Q5 | Warning UI for strategy mismatch | IMPORTANT | IMPORTANT | Design decision; doesn't block routing logic. |
| Q6 | Rent ramp entry UI completeness for value-add | IMPORTANT | IMPORTANT | Scope decision; field exists in blueprint but no input surface in F9. |
| Q7 | Phasing UI for redevelopment | IMPORTANT | IMPORTANT | UX design decision; template fields exist, input surface absent. |
| Q8 | Does lease_up need its own template? | IMPORTANT | IMPORTANT | Product decision; lease_up is a valid DealTypeKey with no matching ProFormaTemplateId. |
| Q9 | investmentStrategy vocabulary mismatch with strategyTriggers | INFORMATIONAL | INFORMATIONAL | Implementation detail; mapping table needed in getActiveTemplate() resolver. |
| Q10 | lease_up in DealTypeKey extension | INFORMATIONAL | INFORMATIONAL | Low-effort addition; already a valid DB value. |
| Q11 | transition_year slot in regimeDataByField | INFORMATIONAL | INFORMATIONAL | Investigation detail; never populated alongside regimeDataByField. |

**Blocking questions that depend on data or sources not currently in the platform:**
- Q1: Does not depend on missing data — it is a product/architecture decision between three documented options.
- Q2: Does not depend on missing data — T12 actuals and rent roll extractions exist. Path B (deterministic resolver) has a viable data source today.
- Q3: Does not depend on missing data — it is a code change.

**Verdict — open questions classification: PASS.** No blocking question depends on data that doesn't currently exist. All three BLOCKING questions are architectural decisions that can be made immediately.

---

### V5. Gap Identification

The following areas are either absent from the document or receive insufficient depth given their relevance to downstream implementation:

**Gap 1 — `exit_strategy_lv` strategy-conditional UI not investigated.**  
The PATCH `/assumptions/strategy` route also writes `exit_strategy_lv` (lines 713–720), and the gotcha section in replit.md explicitly flags exit_strategy as intentionally nullable. The investigation covers `investmentStrategy` thoroughly but does not address whether `exitStrategy` values (`'Sale'`, `'Refinance'`, `'Hold'`) have any conditional UI effect in F9. If Exit Strategy drives any section gating (e.g., `StabilizedPotentialView` shows refinance metrics vs sale metrics), that conditional logic is unverified. This is a non-trivial omission given the Task #619/#620 consumer audit referenced in replit.md.

**Gap 2 — `lease_up` is a first-class DealTypeKey but has no matrix row as a primary template target.**  
The document flags lease_up in Q8 and shows it in each template's matrix as "PARTIAL — 0 B-rows." However, there is no standalone investigation of what the current F9 UI shows for a deal whose `deal_type = 'lease_up'`. Lease-up deals have distinct cash flow dynamics (absorbing occupancy ramp, elevated concessions, M07 is the primary signal) that are not addressed by any of the 7 templates' `strategyTriggers`. The investigation documents the gap but does not surface the operator-visible manifestation or estimate severity.

**Gap 3 — M11 Debt Advisor interaction with strategy not surfaced.**  
Pattern B fields (vacancy, concessions) affect NOI, which feeds debt sizing in M11. If `deal_type` is wrong (§3a), M11 may size debt against an incorrect income model (e.g., stabilized NOI for a value-add deal that hasn't renovated yet). This is a downstream consequence of the §3a disconnect that the investigation does not trace into the Debt Advisor module. No recommendation or open question addresses it.

**Gap 4 — `cashflow.postprocess.ts` value-add signal detection not fully evaluated.**  
The source citation index references `cashflow.postprocess.ts` lines 1375–1379 for value-add GPR detection. This agent post-processing path uses `deal_type ?? investmentStrategy` as a fallback chain — meaning the same §3a disconnect affects agent behavior differently than the React renderer. The investigation mentions this (§3a.2 last row) but does not evaluate whether the postprocess fallback could produce different underwriting outcomes than the UI displays (e.g., agent runs value-add GPR logic while UI shows stabilized Pattern C). This represents a hidden divergence risk.

**Gap 5 — No before/after surface inventory for the DEAL TERMS tab itself.**  
The investigation inventories 4 UI surfaces but the Deal Terms tab (`DealTermsTab.tsx`) is where `investmentStrategy` is set. If an operator changes `investmentStrategy` in Deal Terms, the rendering cascade to F9 is not traced (what refreshes, what doesn't, whether the cashflow agent result persists despite the strategy change). The "before" state (pre-change) and "after" state (post-change) for the operator are undocumented from the Deal Terms entry point.

**Gap 6 — Matrix combinations involving `lease_up` × templates with non-zero Pattern B.**  
The 7×6 matrix shows `lease_up` always as "PARTIAL — 0 B-rows (all C)." This may be incorrect for `development_ground_up × lease_up` — a development deal in lease-up phase does have pre-opening vs post-stabilization dynamics (vacancy, concessions, marketing, turnover are B-pattern for `development` deal_type). If a deal transitions deal_type from `development` to `lease_up` after construction completion, Pattern B rows would disappear. The matrix treats these as static but the lifecycle transition is not addressed.

---

### OVERALL VERDICT

**APPROVED FOR DOWNSTREAM WORK — with amendment note on Gap 1 (exit_strategy_lv) and Gap 4 (postprocess divergence).**

The investigation is comprehensive, well-sourced, and architecturally sound. All 5 spot-checked claims are confirmed (one with a minor line-number citation note on line 840 vs 855). Cross-fix integration is specific and actionable. Open questions are correctly classified; none of the BLOCKING questions depend on unavailable data — all three can be resolved by product/architectural decision.

Downstream implementation tasks may proceed on the condition that Gap 1 (exit_strategy_lv UI audit) and Gap 4 (cashflow.postprocess divergence from UI state) are flagged as open items within whichever implementation task first touches strategy-conditional rendering. Gaps 2, 3, 5, and 6 are informational and can be addressed inline during Phase 0–1 scoping.
