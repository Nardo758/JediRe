# Phase 2 Entry Conditions

**Date created:** 2026-05-27 (recalibration dispatch)  
**Purpose:** Gate conditions that must be met before Phase 2 work begins. Phase 2 expands deal type coverage (development, STR, Flip, Lease-Up) and adds operator-facing validation UI.

---

## Entry Condition Summary

| EC | Condition | Status | Notes |
|---|---|---|---|
| EC1 | Strategy ↔ deal_type reconciled | **SATISFIED** | `backfillable_from_deal_type = 0` — no backfill needed; dev seed data only |
| EC2 | Mandate lifted to v1.3 | **SATISFIED** | All 9 line items, postprocess, composer live; RegimeExpand Tier 1 fix shipped |
| EC3 | Market rent source resolved | **YELLOW** | Infrastructure exists (ApartmentIQ); benchmark view + agent tool needed (~1 dispatch) |
| EC4 | F9 module map gaps addressed | **UNKNOWN** | Requires investigation |

---

## EC1 — Strategy ↔ deal_type Reconciled

**Required state:** When an operator saves an `investmentStrategy` value in Deal Terms, the resulting `deal_type` correctly routes Pattern B line items, RegimeExpand visibility, and agent prompt selection.

**Status: SATISFIED (2026-05-27)**

**Count query result (dev DB, 2026-05-27):**
```
total_deals:                   29
missing_strategy:              28
backfillable_from_deal_type:    0   ← decision tree: EC1 SATISFIED
orphan_no_strategy_no_deal_type: 28  (dev seed data; no deal_type to reverse-map from)
strategy_only_no_deal_type:     1   (pre-Task #1233 anomaly — strategy set before bridge)
both_populated:                 0   (bridge not yet exercised in dev environment)
```

**Decision tree outcome:** `backfillable_from_deal_type = 0` → EC1 SATISFIED. No backfill script needed.

**Notes:**
- 28 orphan deals have neither strategy nor deal_type — dev seed data that predates both fields. Not backfillable; not a production concern.
- 1 deal with strategy but no deal_type: set before Task #1233 implemented the bridge. Minor anomaly; deal_type will be written on next PATCH /assumptions/strategy call for this deal.
- `both_populated = 0` reflects dev environment only; production would show both fields populated for any deal touched after Task #1233.

**Remaining work:** None. EC1 is closed.

---

## EC2 — Mandate Lifted to v1.3

**Required state:** The cashflow agent can write pre_renovation / post_stabilization sub-field values for value-add line items. RegimeExpand renders them with correct provenance and confidence badges.

**Current state — FULLY SATISFIED:**
- `line-item-matrix.ts`: 9 `[VALUE-ADD/REDEVELOPMENT] May also write` protocol instances confirmed
- `cashflow.postprocess.ts`: Sub-field writeback (lines 555–654), confidence gate (line 596), Tier 2 directional validation (lines 656–753)
- `proforma-adjustment.service.ts`: `regimeDataByField` composition (lines 4824–4901)
- `RegimeExpand.tsx`: normalizeSource, sourceColor, sourceLabel (Tier 1 fix, 2026-05-27)
- `MANDATE_CONSUMER_WIRING.md §5.3`: Gap 2 (confidence propagation) resolved as Option 3 (Independent)

**Tier 2 directional validation (shipped 2026-05-27):** 4 warning-level checks now fire in postprocess after sub-field writeback. Output accumulates to `output.validation_warnings`.

---

## EC3 — Market Rent Source Resolved

**Required state:** The agent's market rent assumption (GPR / effective rent comps) has a well-defined evidence tier hierarchy for value-add deals. The pre-renovation market rent and post-stabilization market rent (renovation ceiling) are sourced from distinct comp sets with documented provenance.

**Status: YELLOW (2026-05-27) — See `EC3_MARKET_RENT_SOURCE.md` for full investigation**

**Summary of findings:**
- Subject market rent: AVAILABLE (`fetch_unit_mix` → `unit_mix.avg_market_rent` per floor plan)
- Comp-level market rent: AVAILABLE (`market_rent_comps` table, written by `write_market_comps.ts`)
- ApartmentIQ city-level benchmarks: AVAILABLE (`oppgrid_market_economics`: avg_rent_1br/2br/3br by city/state)
- ApartmentIQ class-level history: AVAILABLE (`apartment_class_rent_snapshots` by city × class × date)
- P25/P50/P75 distribution by (MSA × class × vintage × unit_type): MISSING
- RentCast: REMOVED (was in research agent; removed in refactor)

**Path to SATISFIED:** Build `market_rent_benchmarks_v` SQL view aggregating existing ApartmentIQ tables + 1 new `fetch_market_rent_benchmark` agent tool. ~1 dispatch. No new data source ingestion.

**Recommended source:** ApartmentIQ (platform's proprietary moat; already integrated; zero marginal cost). Do NOT reintegrate RentCast.

**Blocks:** Phase 2 Batch 6 (Revenue derivation). Does NOT block Batch 1–5.

**Satisfied when:** `market_rent_benchmarks_v` view created, `fetch_market_rent_benchmark` tool wired into cashflow agent, and P50 cross-check fires correctly for a representative value-add deal.

---

## EC4 — F9 Module Map Gaps Addressed

**Required state:** The F9 financial engine's module map (ProFormaSummaryTab tab routing, RegimeExpand visibility by deal type) correctly handles all Phase 1 deal types without blank or incorrect rendering.

**Current state — UNKNOWN.** See `F9_MODULE_MAP.md` for the prior gap analysis. Specifically:
- Flip template rendering (ctrlRows/nctrlRows filtered via FLIP_CARRY_CTRL — Task #1236)
- Land Hold template rendering (LAND_HOLD_CTRL — Task #1236)
- STR template (no Pattern B rows — correct behavior, but verify no rendering gaps)
- Development template (has Pattern B rows for vacancy, concessions, marketing, turnover)

**Investigation pointer:** Run the agent on a representative deal for each Phase 1 deal type and verify RegimeExpand expand rows, tab visibility, and template-aware row filtering all render without gaps.

**Satisfied when:** A verification pass across all Phase 1 deal types confirms no F9 rendering gaps for the supported templates.

---

## Phase 2 Gate Decision

Phase 2 may begin when:
1. EC1 SATISFIED (backfill complete) — expected: current session
2. EC2 SATISFIED — CONFIRMED
3. EC3 status KNOWN — requires investigation (not blocking if the risk is accepted)
4. EC4 status KNOWN — requires verification pass (not blocking if regressions are monitored)

**Conservative gate:** EC1 + EC2 satisfied before Phase 2 begins. EC3/EC4 can be investigated in Phase 2 Track 0 as pre-conditions for Phase 2 Track 1.
