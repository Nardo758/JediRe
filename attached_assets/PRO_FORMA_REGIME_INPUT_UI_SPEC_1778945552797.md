# PRO FORMA REGIME INPUT UI — ARCHITECTURE SPEC v1.0

**Module:** M09 Pro Forma surface — Regime Input UI
**Status:** Draft v1.0
**Owner:** Leon / JEDI RE
**Pairs with:**
- `M09_PROFORMA_SPEC.md` (Pro Forma as Stabilized Potential view — establishes the 4-column layout)
- `CASHFLOW_LINE_ITEM_MATRIX_PASS1_PATCHED.md` (output slots this UI renders)
- `jedi_re_wireframe_blueprint.jsx` (existing 3-layer assumption panel pattern this extends)
**Target executor:** Architecture handoff to Claude Code; Replit integration after Bloomberg JSX prototype

---

## 1. PURPOSE

The current Pro Forma surface treats each line item as a single value with three layers of evidence (Baseline / Platform-Adjusted / User Override). This works for stabilized deals and for line items that are genuinely single-valued (cap rate, hold years, debt rate).

It does not work for value-add and redevelopment deals where:
- Multiple line items have genuinely different pre-renovation and post-stabilization values
- GPR is fundamentally a per-floor-plan grid, not a single number

This spec defines the UI surface that captures these structural realities without abandoning the existing layered assumption pattern.

---

## 2. THREE EXPAND PATTERNS

Every Pro Forma row gets one of three expand behaviors, determined by the line item's nature. The Pro Forma surface code routes each row to its correct expand pattern based on a per-line-item config.

### 2.1 Pattern A — Floor-Plan Grid (GPR only)

**When used:** Gross Potential Rent, for deal types where floor-plan-specific underwriting matters (value-add, redevelopment, lease-up, development). For acquisition stabilized, the grid is still present but typically read-only — no positioning decision since no renovation is happening.

**Collapsed view:** Single row showing aggregate current GPR, aggregate Pro Forma GPR, Δ, driver.

**Expanded view:** A small table inside the row, with columns:

```
FLOOR PLAN    UNITS   CURRENT MARKET    COMP CEILING        POSITIONING   POST-RENO TARGET    PREMIUM     CAPTURE
                                        (P25 / P50 / P75)   PERCENTILE                                    RATE
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1BR/1BA       52      $1,425            $1,520 / $1,680 / $1,820   P50    $1,680              $255        78%
1BR/1BA Den   24      $1,510            $1,610 / $1,775 / $1,920   P50    $1,775              $265        78%
2BR/1BA       86      $1,680            $1,795 / $1,975 / $2,140   P50    $1,975              $295        78%
2BR/2BA       72      $1,790            $1,920 / $2,115 / $2,295   P50    $2,115              $325        78%
3BR/2BA       29      $2,150            $2,310 / $2,535 / $2,755   P50    $2,535              $385        78%
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
AGGREGATE     263     $1,627 wtd avg                              wtd P50 $1,917 wtd avg      $290 wtd    78%
```

Each cell has an evidence pill and source indicator per the existing 3-layer pattern. The positioning percentile column is a per-floor-plan dropdown (P25/P40/P50/P60/P75/P90 plus "Custom").

**Three input modes:**

- **Accept platform grid** — one button at the top, applies the platform's full grid with P50 positioning. Cells are still editable individually after acceptance.
- **Global positioning override** — single dropdown above the grid: "Position at P__ globally." Recalculates all rows to the chosen percentile. Sponsor uses this when they have a uniform repositioning thesis.
- **Per-row override** — sponsor adjusts individual rows. Each row carries its own positioning percentile, and the platform suggestion remains visible as a faint underlying number.

**Capture rate:** Single value at the bottom by default (the buyer's portfolio default). Per-row override available for sponsors with floor-plan-specific capture rate evidence; rare.

**Aggregation:** The aggregate row at the bottom is computed live as the user adjusts inputs. Weighted average current market rent, weighted average post-reno target, weighted average premium. The aggregate GPR (premium × unit count × 12) populates the parent Pro Forma row.

### 2.2 Pattern B — Simple Regime Expand (turnover, R&M, marketing, service contracts, vacancy, concessions)

**When used:** Line items that have genuinely different pre-renovation and post-stabilization values but do not vary by floor plan in any meaningful way. The agent identifies these per deal type (Value-Add: turnover, R&M, marketing, vacancy, concessions are regime-split; Property Tax, Insurance, Debt are single-value).

**Collapsed view:** Single row showing aggregate Pro Forma value (post-stabilization).

**Expanded view:** Two sub-rows:

```
TURNOVER             CURRENT      PRE-RENO      POST-STABILIZED       Δ           EVIDENCE
                     (T12)        Y1-Y2 avg     Y3 onward
                     ─────────────────────────────────────────────────────────────────────────────
                     58%          62%           38%                   -20pp       OWNED Tier 2
                     ↑ pill       ↑ pill        ↑ pill                            (sponsor's portfolio
                                                                                   shows 36-42% post-
                                                                                   stabilization on
                                                                                   similar repositionings)
```

Each sub-row has its own evidence pill and source indicator. Sponsor can override either or both values. Transition timing (when does pre-reno regime end and post-stabilized regime begin?) is read from M22 capex_schedule and Lease Velocity Engine output — not user-editable in this view; lives in the deal-level configuration.

### 2.3 Pattern C — Single-Value (property tax, insurance, debt assumptions, cap rate, hold years)

**When used:** Line items where regime split doesn't apply. These render exactly as today — the existing 3-layer pattern (Baseline / Platform-Adjusted / User Override).

No change from current behavior. Pattern listed here only to confirm what does *not* expand.

---

## 3. LINE-ITEM PATTERN ASSIGNMENT

Pattern routing per line item per deal type. Determined by the line item's underlying nature; not user-configurable.

| Line Item             | Acquisition (Value-Add) | Acquisition (Stabilized) | Development | Redevelopment |
|-----------------------|-------------------------|--------------------------|-------------|---------------|
| GPR                   | A (full grid)           | A (read-only grid)       | A (full grid) | A (full grid)  |
| Vacancy               | B                       | C                        | B           | B             |
| Concessions           | B                       | C                        | B           | B             |
| Bad Debt              | B                       | C                        | C           | B             |
| Other Income          | B                       | C                        | C           | B             |
| Property Tax          | C                       | C                        | C           | C             |
| Insurance             | C                       | C                        | C           | C             |
| Utilities             | C                       | C                        | C           | B             |
| R&M                   | B                       | C                        | C           | B             |
| Payroll               | C                       | C                        | C           | C             |
| Management Fee        | C                       | C                        | C           | C             |
| Marketing             | B                       | C                        | B           | B             |
| Service Contracts     | B (if structural change)| C                        | C           | B             |
| Turnover Cost         | B                       | C                        | B           | B             |
| Cap Ex Reserve        | C                       | C                        | C           | C             |
| Cap Rate              | C                       | C                        | C           | C             |
| Debt Assumptions      | C                       | C                        | C           | C             |
| Exit Cap              | C                       | C                        | C           | C             |

For acquisition stabilized, GPR uses Pattern A but the grid is read-only — the platform shows the per-floor-plan rent positioning of the existing property in the comp set, but there is no renovation, no positioning decision, no premium math. The grid is purely informational.

---

## 4. PLATFORM-SUGGESTION-WITH-OVERRIDE INTERACTION

Across all three patterns, the existing 3-layer assumption pattern (Baseline / Platform-Adjusted / User Override) applies at the field level. The Pro Forma surface should:

1. **Render the Platform-Adjusted value as the default visible number** in any field
2. **Show the Baseline value as a small underlying number** (subtle, gray) so the sponsor sees what the historical anchor was
3. **When the user overrides, show the override as the primary number in blue** with the Platform-Adjusted suggestion visible beneath as a small reference
4. **A small badge (`+` icon)** on each field indicates an override is available. Click reveals the override input field.
5. **Yellow highlight** when user override deviates more than 100bps from platform on a percentage field, or more than 5% on a dollar value field — flag for sponsor attention.

This pattern is consistent with the existing wireframe spec for the assumption panel. The floor-plan grid extends the pattern across N floor plan rows rather than 1 line item row, but each cell behaves the same way.

---

## 5. DATA SHAPE

The UI consumes the agent's output per the field catalog. Pattern A specifically requires the per-floor-plan grid output slots from the patched Pass 1 reference cell:

```typescript
proforma.revenue.gpr.unit_mix: UnitMixEntry[]

interface UnitMixEntry {
  floor_plan_id: string;            // "1br_1ba", "2br_2ba", etc.
  floor_plan_label: string;         // "1BR/1BA"
  unit_count: number;
  current_market_rent: LayeredValue<number>;
  comp_ceiling: {
    p25: number;
    p50: number;
    p75: number;
    sample_size: number;
    confidence: 'high' | 'medium' | 'low';
  };
  positioning_percentile: LayeredValue<number>;     // 0.25 / 0.5 / 0.75 etc
  post_reno_target_rent: LayeredValue<number>;     // computed from comp_ceiling at positioning
  gross_premium: number;                            // target - current_market (computed)
  capture_rate: LayeredValue<number>;               // typically 0.78
  captured_premium: number;                         // gross × capture (computed)
  evidence: CanonicalEvidence;
}
```

For Pattern B (simple regime expand), the field carries two LayeredValue entries:

```typescript
proforma.opex.repairs_maintenance.pre_renovation: LayeredValue<number>;
proforma.opex.repairs_maintenance.post_stabilization: LayeredValue<number>;
proforma.opex.repairs_maintenance.transition_month: number;     // from M22 capex_schedule
```

For Pattern C (single-value), the field is unchanged from today — single LayeredValue.

---

## 6. POST-STABILIZATION VIEW

Separate from the row-level expand patterns, the Pro Forma surface gains a **post-stabilization snapshot view** for value-add, redevelopment, and development deals.

**Activation:** A tab toggle at the top of the Pro Forma surface: "Current / Pro Forma / Post-Stabilization." Default view is Pro Forma. Post-Stabilization shows the same 4-column layout but each line item shows only the post-stabilization regime values, with the pre-renovation values entirely hidden.

**Why:** Investor presentation. When sponsor presents the deal to LP committee, they want a clean view of "what does this look like once we get there." The Pro Forma view shows the bridge from current; the Post-Stabilization view shows just the destination. Both are useful for different audiences and moments.

The Post-Stabilization view is rendered from the same underlying data — no separate underwriting. It's a presentation filter on the existing data.

---

## 7. INTEGRATION WITH EXISTING M09 SURFACE

This spec extends the existing M09 Pro Forma component, does not replace it.

Changes to M09:

1. **Row-level expand affordance.** Every row gains a small chevron at the left edge. Clicking expands the row to its assigned pattern (A, B, or C). Pattern C rows have the chevron as a no-op (or hidden) since they don't expand.

2. **Per-line-item pattern config.** New config file `m09_line_item_patterns.ts` maps each line item × deal type to its pattern. The agent's output schema must match the assigned pattern (e.g., GPR for value-add must include the `unit_mix` array; the UI assumes it is present).

3. **Floor-plan grid component.** New `<FloorPlanGrid>` component for Pattern A. Renders the table inside the expanded row. Owns the platform-suggestion-with-override interaction model.

4. **Regime expand component.** New `<RegimeExpand>` component for Pattern B. Renders the two sub-rows.

5. **Post-stabilization view tab.** New tab toggle at Pro Forma surface header. Hides pre-renovation regime values when active.

6. **Phasing toggle compatibility.** Existing phasing toggle (per M09 spec §4.4) for multi-phase deals composes with the new view tabs — phasing × view-mode produces a 2D selection (phase 1 current / phase 1 Pro Forma / phase 1 post-stab, phase 2 current / phase 2 Pro Forma / phase 2 post-stab, etc.). For simple non-phased deals, only the view tab applies.

---

## 8. BUILD PHASES

### Phase 1 — Bloomberg JSX prototype (1 session)
- Mock data with full unit mix grid for GPR
- Mock Pattern B regime expand for turnover row
- Phasing tabs and post-stabilization view tab integrated
- Pattern routing logic implemented from config
- File to hand to Replit/Claude Code as the contract

### Phase 2 — Pattern A floor-plan grid component (1 session)
- `<FloorPlanGrid>` component with all 4 columns
- Platform-suggestion-with-override interaction model
- Global positioning override + per-row override
- Aggregate row live computation
- Evidence pills per cell

### Phase 3 — Pattern B regime expand component (1 session)
- `<RegimeExpand>` component
- Two sub-rows with separate evidence pills
- Transition timing display (read-only, from M22)

### Phase 4 — Pattern routing and config (1 session)
- `m09_line_item_patterns.ts` config file
- Pattern selection logic in main M09 component
- Pattern C rows render unchanged
- Validation: agent output schema matches assigned pattern; error rendering if mismatch

### Phase 5 — Post-stabilization view (1 session)
- View tab toggle at Pro Forma surface header
- Filter logic to hide pre-renovation regime values
- Coordination with phasing toggle (2D selection)

### Phase 6 — Data flow back to per-unit walk (1 session)
- When sponsor adjusts positioning in floor-plan grid, the per-unit walk re-runs with new positioning per floor plan
- Pro Forma aggregate updates live
- Year-by-year Projections tab also updates
- Caching: only re-run walk on commit (debounced), not on every keystroke

### Phase 7 — Integration testing and polish (1 session)
- All 4 deal types render correctly
- All 3 patterns render correctly per deal type
- Edge cases: deals with single floor plan (Pattern A degenerates gracefully to a single row), deals with no unit mix data (Pattern A shows aggregate only)
- Performance: re-render budget under 100ms for grid edits

---

## 9. EDGE CASES

### Single-floor-plan property
Some properties (small assets, certain product types) have only one floor plan. Pattern A still applies but the grid degenerates to a single row. The aggregate row is identical to the single floor plan row. The UI should not look broken; it should just show the one row with the aggregate row hidden or labeled as identical.

### Properties with missing unit mix data
For acquisition deals where the rent roll is sparse or missing, the agent may not have full unit mix data. Pattern A should gracefully fall back to aggregate-only rendering (similar to single-floor-plan case) with a small note: "Per-floor-plan grid unavailable — rent roll did not provide unit mix detail."

### Stabilized acquisitions with renovation in flight
A property in mid-stream renovation at acquisition is structurally a redevelopment deal but may be classified as value-add. Pattern A grid handles this via the M22 capex_schedule — units already renovated show captured premium, units not yet renovated show pending. No special UI required; the data flow handles it.

### Sponsor positioning at sub-comp-set percentile
Sponsor selects P25 positioning ("we'll be the cheap option in the comp set"). This is a legitimate but unusual choice. The UI should not block; it should flag with a small note: "Positioning at P25 implies the renovation will not capture full comp-set value. Confirm this is intentional."

### Capture rate above 1.0
Sponsor overrides capture rate to 1.05 ("we'll exceed comp positioning because of unique positioning"). The UI should warn but not block: "Capture rates above 1.0 imply the property will out-perform the comp set ceiling — typically only justified for unique amenity, location, or product differentiation."

---

## 10. ACCEPTANCE CRITERIA

1. Every Pro Forma row renders according to its assigned pattern (A / B / C) per the config
2. Floor-plan grid for GPR shows comp ceiling P25/P50/P75 per floor plan with sample size
3. Positioning percentile is editable per row and globally; captured premium recalculates live
4. Aggregate row reflects weighted average of floor-plan rows in real time
5. Pattern B regime expand shows pre-renovation and post-stabilization values with separate evidence
6. Pattern C rows render identically to current behavior
7. Post-Stabilization view tab hides pre-renovation regime values
8. Sponsor overrides flow back to the per-unit walk and the Projections tab updates
9. Sample deals across all 4 deal types render without errors
10. Edge cases: single floor plan, missing unit mix, sub-P50 positioning, above-1.0 capture rate — all handled gracefully

---

## 11. OPEN QUESTIONS

### Q1: Comp set rendering depth in floor-plan grid
The grid shows P25/P50/P75 by default. Should hovering or clicking on the comp ceiling cell reveal the underlying comp set (e.g., "5 comparable assets: Comp A $1,650, Comp B $1,720, ..." with source labels)? Adds depth but increases visual weight.

**Recommendation:** show on click only. Default view shows just the P25/P50/P75 numbers. Click reveals the underlying comp set in a slide-out panel similar to the evidence drawer for the parent row.

### Q2: User-defined floor plan grouping
Some properties have non-standard floor plans (loft, two-story, corner units with different rents). Should the platform allow the user to create custom floor-plan groupings, or rigidly use the rent roll's floor plan codes?

**Recommendation:** rigidly use rent roll codes for v1. Custom grouping is a v2 feature once basic flow is validated. Most rent rolls have reasonable groupings; investing in custom grouping UI before that's a proven pain point is premature.

### Q3: Comp ceiling refresh cadence
The comp ceiling values pull from M05 at run time. When does the UI refresh them? On every page load? Daily? Only when the user explicitly refreshes?

**Recommendation:** snapshot at agent run time, persist with the deal record. The comp ceiling is part of the underwriting; freezing it at run time matches how the rest of the assumption set is treated. If the user wants a refresh, they re-run the agent.

### Q4: Sub-percentile positioning (e.g., P42, P67)
The default percentile options (P25/P40/P50/P60/P75/P90) cover the common cases but not every value. Should the UI allow free-form percentile input?

**Recommendation:** yes, but as a "Custom" option in the dropdown that reveals a numeric input. Most users will use the standard options; the free-form is for power users.

### Q5: Cross-floor-plan capture rate variation
Some sponsors have demonstrated different capture rates by floor plan (e.g., 2BRs capture closer to ceiling than 1BRs because of larger unit interior surface improved). Per-floor-plan capture rate override is mentioned in Section 2.1 as "rare" — should it be hidden by default and only revealed for power users?

**Recommendation:** yes. Default UI shows single property-wide capture rate at the bottom. A small "Advanced" link reveals per-floor-plan capture rate overrides. Keeps the default flow clean while enabling power-user precision.
