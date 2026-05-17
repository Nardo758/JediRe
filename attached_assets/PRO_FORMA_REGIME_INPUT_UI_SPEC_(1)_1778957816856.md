# PRO FORMA REGIME INPUT UI — ARCHITECTURE SPEC v1.2

**Supersedes:** v1.1
**Changes from v1.1:**
- **Removed Pattern B** (simple regime expand for non-GPR line items)
- Collapsed to two expand patterns: A (floor-plan grid for GPR) and C (single-value for everything else)
- Line-item pattern assignment table simplified — every non-GPR row is Pattern C across all deal types
- Pattern A renamed "Pattern A" → simply "Floor-Plan Grid" since there's no B anymore
- Pattern C renamed "Pattern C" → simply "Single-Value"
- Post-Stabilization view tab retained (still useful for the GPR pre/post comparison view)
- Data shape simplified — non-GPR fields are single `LayeredValue<number>`, not pre/post pairs
- Agent reasoning regarding regimes (turnover behaves differently pre/post-renovation, etc.) remains the agent's internal logic but does not produce separate UI inputs for non-GPR line items
- Build phases consolidated — Phase 3 (regime expand component) removed; renumbered

**Format:** This document is a self-contained replacement for v1.1.

---

## 1. PURPOSE

The current Pro Forma surface treats each line item as a single value with three layers of evidence. This works for stabilized deals and for line items that are genuinely single-valued.

It does not work for one specific case: **GPR on value-add and redevelopment deals**, where:
- The rent decision is fundamentally per-floor-plan, not aggregated
- The renovation premium derives from per-floor-plan comp ceiling × positioning percentile × capture rate
- The rent decision is incomplete without the matching renovation cost decision — yield-on-cost is the actual unit of evaluation
- Sponsors need to see the per-floor-plan breakdown to validate that the underwriting math reflects their physical and operational thesis

This spec defines the floor-plan grid UI surface that handles GPR in the cases where it needs detail, and confirms that all other Pro Forma line items continue to use the existing single-value pattern.

---

## 2. TWO EXPAND PATTERNS

Every Pro Forma row uses one of two patterns:

### 2.1 Floor-Plan Grid (GPR only)

**When used:** Gross Potential Rent, for deal types where floor-plan-specific underwriting matters (value-add, redevelopment, lease-up, development). For acquisition stabilized, the grid is read-only — no renovation, no positioning decision, no cost data.

**Collapsed view:** Single row showing aggregate current GPR, aggregate Pro Forma GPR, Δ, driver.

**Expanded view — the full floor-plan grid:**

```
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Renovation Scope: Full Interior — paint, flooring, cabinets, appliances, fixtures, lighting   (set via M22)
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
FLOOR PLAN    UNITS  CURRENT   COMP CEILING (P25/P50/P75)  POSITION  POST-RENO   PREMIUM  CAPTURE  RENO COST  YIELD
                     MARKET                                PERCENTILE TARGET     /MO     RATE    PER UNIT   ON COST
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1BR/1BA       52     $1,425    $1,520 / $1,680 / $1,820    P50       $1,680     $255    78%     $18,500    12.9%
1BR/1BA Den   24     $1,510    $1,610 / $1,775 / $1,920    P50       $1,775     $265    78%     $19,800    12.5%
2BR/1BA       86     $1,680    $1,795 / $1,975 / $2,140    P50       $1,975     $295    78%     $22,400    12.3%
2BR/2BA       72     $1,790    $1,920 / $2,115 / $2,295    P50       $2,115     $325    78%     $24,000    12.7%
3BR/2BA       29     $2,150    $2,310 / $2,535 / $2,755    P50       $2,535     $385    78%     $29,500    12.2%
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
AGGREGATE     263    $1,627    weighted avg                wtd P50   $1,917     $290    78%     $22,650    12.5%
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Total Renovation Budget: $5,956,950  |  Total Stabilized Premium Revenue (annualized): $914,640  |  Property YoC: 15.4%
```

Each cell has an evidence pill and source indicator per the existing 3-layer pattern.

**Columns:**

| Column | Type | Source | Editable |
|--------|------|--------|----------|
| Floor Plan | label | rent roll | no |
| Units | int | rent roll | no |
| Current Market | $/unit/mo | rent roll | rare override |
| Comp Ceiling | P25/P50/P75 | M05 comp set | no (snapshot at run time) |
| Positioning Percentile | dropdown | platform default + sponsor input | yes |
| Post-Reno Target | $/unit/mo | computed from positioning × comp ceiling | rare override |
| Premium | $/unit/mo | computed (target − current) | derived |
| Capture Rate | % | S3 owned-portfolio | yes |
| Reno Cost per Unit | $/unit | M22 capex_schedule + 3-layer evidence | yes |
| Yield on Cost | % | computed | derived |

**Computation rules:**

```
captured_premium_per_unit_per_mo = (post_reno_target − current_market) × capture_rate
yield_on_cost_per_floor_plan     = (captured_premium_per_unit_per_mo × 12) / renovation_cost_per_unit

(at the aggregate footer)
total_stabilized_premium_revenue = Σ (units × captured_premium × 12) across all floor plans
total_renovation_budget          = Σ (units × renovation_cost) across all floor plans
property_yield_on_cost           = total_stabilized_premium_revenue / total_renovation_budget
```

Property yield-on-cost is the deck headline number — what the sponsor cites in LP committee.

**Three input modes:**

- **Accept platform grid** — one button applies platform's full grid: P50 positioning, archive-cohort-derived renovation cost per floor plan, sponsor's portfolio capture rate. Cells remain individually editable after acceptance.
- **Global positioning override** — single dropdown above the grid; recalculates positioning rows but does NOT change cost rows (cost is independent of positioning).
- **Per-row override** — sponsor adjusts individual rows. Positioning, capture rate, and renovation cost are all per-row editable.

**Bidirectional editing:**

- Adjusting positioning changes post-reno target → premium → yield-on-cost (cost held constant)
- Adjusting cost changes yield-on-cost (premium held constant)
- The grid does NOT auto-adjust positioning when cost changes. Positioning (what's the market) and cost (what does it cost to get there) are separate inputs; yield-on-cost is the output that helps the sponsor decide if the combination is attractive.

### 2.2 Single-Value (all other line items)

**When used:** Every Pro Forma row except GPR.

**Behavior:** Unchanged from current behavior. The existing 3-layer pattern (Baseline / Platform-Adjusted / User Override) applies. One value per cell per column. No expand.

This includes line items that have regime-aware reasoning in the agent's underwriting (turnover, R&M, marketing, concessions, vacancy, etc.). The agent reasons about these line items with regime awareness — for example, it understands that turnover on a value-add deal is typically higher pre-renovation and lower post-stabilization, and it models the appropriate post-stabilization value for the Pro Forma column.

**But the UI surface for these line items is one cell per column with one value.** The regime reasoning lives in the agent's evidence narrative, not in the UI input shape. The sponsor sees the agent's resolved post-stabilization value, can read the evidence to understand the regime-aware reasoning, and can override the single value if they want to push back.

---

## 3. LINE-ITEM PATTERN ASSIGNMENT

| Line Item             | Acquisition (Value-Add) | Acquisition (Stabilized) | Development | Redevelopment |
|-----------------------|-------------------------|--------------------------|-------------|---------------|
| GPR                   | Floor-Plan Grid         | Floor-Plan Grid (read-only) | Floor-Plan Grid | Floor-Plan Grid |
| Vacancy               | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Concessions           | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Bad Debt              | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Other Income          | Single-Value (with hierarchical breakdown per math engine v1.1) | Single-Value | Single-Value | Single-Value |
| Property Tax          | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Insurance             | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Utilities             | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| R&M                   | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Payroll               | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Management Fee        | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Marketing             | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Contract Services     | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Turnover Cost         | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Cap Ex Reserve        | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Cap Rate              | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Debt Assumptions      | Single-Value            | Single-Value             | Single-Value | Single-Value  |
| Exit Cap              | Single-Value            | Single-Value             | Single-Value | Single-Value  |

GPR is the only line item with a custom expand pattern. Everything else is Single-Value across all deal types. The hierarchical breakdown handling for Other Income lives entirely in the math engine (per `proFormaMathEngine.ts` v1.1) and renders inside the existing Single-Value display — the user clicks to expand and see the breakdown, but the underlying field is still a single value with its own evidence pill.

For acquisition stabilized, the GPR grid is read-only — the platform shows the per-floor-plan rent positioning of the existing property in the comp set, but there is no renovation, no positioning decision, no premium math. The grid is purely informational for stabilized deals.

---

## 4. PLATFORM-SUGGESTION-WITH-OVERRIDE INTERACTION (unchanged)

Each cell carries the 3-layer pattern: Baseline (gray, subtle), Platform-Adjusted (default visible), User Override (blue, primary when present). 100bps / 5% deviation thresholds trigger yellow highlight.

This applies to every cell in the Floor-Plan Grid and to every Single-Value row.

---

## 5. DATA SHAPE

The UI consumes the agent's output per the field catalog.

### 5.1 Floor-Plan Grid (GPR) data shape

The UI consumes the agent's output per the field catalog. Pattern A requires the per-floor-plan grid output slots from the patched Pass 1 reference cell, extended with cost and yield-on-cost fields.

**Agent input source (NEW v1.3):** The agent populates `proforma.revenue.gpr.unit_mix[]` by calling `fetch_unit_mix` (canonical per-floor-plan source) for unit counts, current market rents, in-place rents, and floor plan groupings. The agent calls `fetch_peer_comp_noi_metrics` and `fetch_data_library_comps` for comp ceiling data per floor plan. The agent calls `fetch_owned_asset_actuals` for historical capture rates. The composite output is the `unit_mix[]` array consumed by the UI.

**Important:** `fetch_unit_mix` is the only canonical source for per-floor-plan unit data. The legacy `fetch_rent_roll` returns property-wide aggregates only and does not provide per-floor-plan detail. The agent must call `fetch_unit_mix` for any floor-plan-grid output.

```typescript
proforma.revenue.gpr.unit_mix: UnitMixEntry[]

interface UnitMixEntry {
  floor_plan_id: string;            // "1br_1ba", "2br_2ba", etc.
  floor_plan_label: string;
  unit_count: number;

  // Rent positioning fields
  current_market_rent: LayeredValue<number>;
  comp_ceiling: {
    p25: number;
    p50: number;
    p75: number;
    sample_size: number;
    confidence: 'high' | 'medium' | 'low';
  };
  positioning_percentile: LayeredValue<number>;
  post_reno_target_rent: LayeredValue<number>;
  gross_premium: number;
  capture_rate: LayeredValue<number>;
  captured_premium: number;

  // Cost and yield fields
  renovation_cost: LayeredValue<number>;
  renovation_scope: string;
  scope_id: string;
  yield_on_cost: number;

  evidence: CanonicalEvidence;
}

interface UnitMixAggregate {
  total_units: number;
  weighted_current_market: number;
  weighted_post_reno_target: number;
  weighted_premium: number;
  weighted_capture_rate: number;
  weighted_renovation_cost: number;
  total_renovation_budget: number;
  total_stabilized_premium_revenue: number;
  property_yield_on_cost: number;
}
```

### 5.2 Single-Value data shape

For all other line items, the field is a single `LayeredValue<number>` with the existing schema:

```typescript
proforma.opex.turnover: LayeredValue<number>;
proforma.opex.repairs_maintenance: LayeredValue<number>;
proforma.revenue.vacancy_loss: LayeredValue<number>;
// etc.

interface LayeredValue<T> {
  value_numeric: T;
  layer: 'baseline' | 'platform_adjusted' | 'user_override';
  baseline_value?: T;
  platform_adjusted_value?: T;
  user_override_value?: T;
  evidence: CanonicalEvidence;
  alert_level?: 'green' | 'amber' | 'red';
}
```

The agent's regime-aware reasoning for these line items lives in the `evidence` narrative — for example, on a value-add deal's turnover, the evidence narrative explains that the value reflects post-stabilization rate (typically 30-40%) because the renovation increases unit stickiness, with the pre-renovation period showing higher turnover (50-65%) modeled in the Projections tab year-by-year trajectory.

### 5.3 Renovation Scope — grid header indicator

The grid shows one scope per floor plan, set at the property level via M22 capex_schedule. Header displays:

```
Renovation Scope: Full Interior — paint, flooring, cabinets, appliances, fixtures, lighting
```

Mixed-scope programs deferred to v2 per the previous spec. v1 assumes one scope across the program; mixed-scope programs flag with `program_scope_uniformity: 'mixed'` and a warning surfaces in the grid header.

---

## 6. POST-STABILIZATION VIEW

Tab toggle at Pro Forma surface header switches between Current / Pro Forma / Post-Stabilization views.

**For the Floor-Plan Grid:** In Post-Stabilization view, the grid hides the renovation cost column and yield-on-cost column — by this stage of the deal story, the costs have been incurred. The grid shows the post-renovation rents as the "current" state of the property.

**For Single-Value rows:** In Post-Stabilization view, the Current column is hidden; only the Pro Forma column displays. The user sees a clean snapshot of stabilized operating economics, useful for LP presentations.

The Post-Stabilization view is rendered from the same underlying data as the Pro Forma view. No separate underwriting; it's a presentation filter.

---

## 7. INTEGRATION WITH EXISTING M09 SURFACE

This spec extends the existing M09 Pro Forma component, does not replace it. Changes to M09:

1. **Row-level expand affordance.** GPR row gains a chevron at the left edge. Clicking expands to the floor-plan grid. All other rows have no chevron (or hidden chevron).

2. **Per-line-item pattern config.** New config file `m09_line_item_patterns.ts` maps each line item × deal type to either `floor_plan_grid` or `single_value`. The agent's output schema must match the assigned pattern (e.g., GPR for value-add must include the `unit_mix` array).

3. **Floor-plan grid component.** New `<FloorPlanGrid>` component for the GPR row's expanded view. Owns the platform-suggestion-with-override interaction model with bidirectional editing.

4. **Post-stabilization view tab.** New tab toggle at Pro Forma surface header. Filters Current column visibility and hides cost/yield columns in the grid.

5. **Phasing toggle compatibility.** Existing phasing toggle (per M09 spec §4.4) for multi-phase deals composes with the new view tabs — phasing × view-mode produces a 2D selection.

6. **M22 write-back path.** When sponsor edits per-floor-plan renovation cost in the grid, the change writes to M22 capex_schedule at the floor-plan-cohort level. M22 remains canonical source of truth; the grid is a view + edit surface.

7. **Yield-on-cost computation.** Pure derivation; no agent involvement. Computed at render time from grid state.

8. **Source-of-truth coordination.** The Floor-Plan Grid reads from `deal_assumptions.unit_mix` (with overrides applied via `unit_mix_overrides`). The agent reads from the same canonical source via `fetch_unit_mix`. Sponsor overrides in the Unit Mix tab flow to the agent on the next run. This single-source-of-truth pattern was established in PR 1 of the data plumbing audit (Item 1: create fetch_unit_mix tool).

9. **Property yield-on-cost callout.** The aggregate footer's property yield-on-cost displays prominently as the deck headline number.

---

## 8. BUILD PHASES (consolidated)

### Phase 1 — Bloomberg JSX prototype (1 session)
- Mock data with full unit mix grid including cost and yield columns
- Phasing tabs and post-stabilization view tab integrated
- Pattern routing logic (floor_plan_grid vs single_value)
- Property-level yield-on-cost footer rendered prominently
- All other rows render as standard Single-Value (unchanged from existing M09)
- File to hand to Replit/Claude Code as contract

### Phase 2 — Floor-Plan Grid component (1 session)
- `<FloorPlanGrid>` component with all 10 columns
- Platform-suggestion-with-override interaction model
- Global positioning override + per-row override
- Yield-on-cost computed live per row + property aggregate
- Aggregate row computation
- Evidence pills per cell
- Scope indicator at grid header

### Phase 3 — Pattern routing and config (1 session)
- `m09_line_item_patterns.ts` config file
- Pattern selection logic in main M09 component
- Single-Value rows render unchanged from existing behavior
- Validation: agent output schema matches assigned pattern; error rendering if mismatch

### Phase 4 — Post-stabilization view (1 session)
- View tab toggle at Pro Forma surface header
- Filter logic for Single-Value rows (hide Current column when in Post-Stabilization)
- Hide cost and yield columns in Floor-Plan Grid when in Post-Stabilization
- Coordination with phasing toggle (2D selection)

### Phase 5 — Data flow integration (1 session)
- Sponsor positioning changes → re-run per-unit walk → Pro Forma aggregate updates
- Sponsor cost changes → write to M22 capex_schedule → yield-on-cost recomputes
- Caching: debounce walk re-runs; immediate yield-on-cost recompute (pure math)
- Cross-module reflection: capex_schedule changes propagate to S&U, Cap Stack, Risk

### Phase 6 — Integration testing and polish (1 session)
- All 4 deal types render correctly
- Both patterns render per deal type
- Edge cases handled (see Section 9)
- Performance: re-render budget under 100ms for grid edits

---

## 9. EDGE CASES

### Single-floor-plan property
Floor-Plan Grid degenerates gracefully to a single row. Aggregate row identical to the single floor plan row; UI should label or hide accordingly.

### Properties with missing unit mix data
Grid falls back to aggregate-only rendering with a small note: "Per-floor-plan grid unavailable — rent roll did not provide unit mix detail."

### Stabilized acquisitions with renovation in flight
M22 capex_schedule handles via per-unit renovation completion dates. No special UI required.

### Sponsor positioning at sub-comp-set percentile
Flag with note. Non-blocking.

### Capture rate above 1.0
Flag with warning. Non-blocking.

### Yield-on-cost below cost-of-capital
When the computed yield-on-cost per floor plan falls below the buyer's cost-of-capital (or below a 10% default threshold), flag the row with a small warning chip: "Yield-on-cost below threshold — renovation cost may exceed achievable premium." Non-blocking; may be intentional but should surface.

### Missing renovation cost data
If M22 capex_schedule does not have per-floor-plan cost for one or more floor plans, render those rows with a placeholder ("—") in the Reno Cost and Yield columns. Aggregate footer still computes using available floor plans with a coverage badge.

### Scope mismatch with grid assumptions
If M22 indicates `program_scope_uniformity: 'mixed'`, the grid header shows the v2 placeholder warning. Grid still functions — renders weighted average cost per floor plan rather than scope-specific cost.

### Renovation cost edited above archive cohort P90
If sponsor overrides per-floor-plan cost more than 25% above archive cohort P90 for similar scope/vintage/region, flag the cell with yellow-highlight pattern.

---

## 10. ACCEPTANCE CRITERIA

1. Every Pro Forma row renders according to its assigned pattern per the config (floor_plan_grid or single_value)
2. Floor-Plan Grid for GPR shows all 10 columns per floor plan
3. Positioning percentile is editable per row and globally; captured premium AND yield-on-cost recalculate live
4. Renovation cost per unit is editable per row; yield-on-cost recalculates live; M22 capex_schedule writes back on edit commit
5. Aggregate row reflects weighted average of floor-plan rows in real time
6. Property-level yield-on-cost displays prominently in the aggregate footer
7. Renovation scope indicator displays at the top of the grid; mixed-scope programs trigger v2 placeholder warning
8. All non-GPR Single-Value rows render with the existing 3-layer assumption pattern, unchanged from current behavior
9. Post-Stabilization view tab hides Current column on Single-Value rows AND hides cost/yield columns in the Floor-Plan Grid
10. Sponsor overrides flow back to the per-unit walk (positioning) and to M22 capex_schedule (cost); Projections tab and Cap Stack update accordingly
11. Sample deals across all 4 deal types render without errors
12. All edge cases handled: single floor plan, missing unit mix, missing cost data, sub-P50 positioning, above-1.0 capture rate, yield below cost-of-capital, scope mismatch, above-P90 cost override

---

## 11. OPEN QUESTIONS

### Q1: Comp set rendering depth in floor-plan grid (unchanged)
Show on click only. Default view shows P25/P50/P75 numbers; click reveals underlying comp set in a slide-out panel.

### Q2: User-defined floor plan grouping (unchanged)
Rigidly use rent roll codes for v1.

### Q3: Comp ceiling refresh cadence (unchanged)
Snapshot at agent run time, persist with deal record.

### Q4: Sub-percentile positioning (unchanged)
Custom dropdown option for free-form percentile input.

### Q5: Cross-floor-plan capture rate variation (unchanged)
Behind Advanced link.

### Q6: Renovation cost source-of-truth coordination with M22
Grid writes back to M22 capex_schedule. M22 also has its own UI surface. **Recommendation:** treat M22 capex_schedule as shared state object; both grid and M22 surface read/write to it. Last-write-wins with optimistic UI; M22 is canonical.

### Q7: Yield-on-cost as a decision filter
v2 enhancement. v1 ships with data visible per row.

### Q8: Pre-renovation capture for mid-stream renovations
v1 grid reflects only units to be renovated, with header note: "Showing X of Y units to be renovated; Z units previously captured." v2 surfaces a sub-grid for the captured-already cohort.

### Q9: Renovation cost evidence depth in evidence panel
Show all three layers (archive cohort, owned portfolio, M22 capex_schedule) in the evidence panel. Same pattern as rent cells — multi-source value with current selection.

---

## 12. CHANGELOG

**v1.3 (current)**
- Added agent input source clarification in Section 5.1: agent populates unit_mix[] via fetch_unit_mix (canonical), fetch_peer_comp_noi_metrics + fetch_data_library_comps (comp ceiling), and fetch_owned_asset_actuals (capture rates)
- Added Section 7 item 8: source-of-truth coordination between Floor-Plan Grid, Unit Mix tab, and agent; existing item 8 renumbered to item 9
- No structural changes to the grid; only source reference precision

**v1.2 (archival)**
- Removed Pattern B (simple regime expand for non-GPR line items)
- Collapsed to two patterns: floor_plan_grid (GPR) and single_value (everything else)
- Simplified line-item pattern assignment table — every non-GPR row is single_value across all deal types
- Removed regime-related fields from non-GPR data shapes (`pre_renovation` and `post_stabilization` LayeredValue entries no longer exist; single LayeredValue is the standard)
- Build phases consolidated — Phase 3 (regime expand component) removed; renumbered

**v1.1 (archival)**
- Added renovation cost column and yield-on-cost column to floor-plan grid
- Added property-level yield-on-cost to aggregate footer
- Extended `UnitMixEntry` with cost and yield fields
- Added scope indicator at grid header, v2 placeholder for mixed-scope programs
- Added 4 new edge cases and 4 new open questions

**v1.0 (archival)**
- Initial spec — three expand patterns including the now-removed Pattern B
