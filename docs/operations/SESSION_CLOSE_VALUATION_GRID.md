# Session Close — Valuation Grid + Phase 2 Architectural Commits

**Date:** 2026-05-28  
**File:** `docs/operations/SESSION_CLOSE_VALUATION_GRID.md`

---

## Context

This session closed Phase 1 substantively, opened Phase 2 entry conditions, shipped Phase 2 Batch 1 OpEx derivation logic, fired the full Valuation Grid spec, and surfaced three architectural commits during the resulting diagnostic.

This document captures those commits so the next session opens with them visible, not buried in the conversation arc.

---

## Commit 1 — Comp-Anchored Implied Cap Rate Synthesis

**DIRECTION (committed; not yet implemented)**

The Valuation Grid's Cap Rate × NOI method should derive cap rate from the sale comp set, not from `archive_assumption_benchmarks` as a stored value.

**Synthesis path:**
1. Identify sale comps for subject (submarket, asset class, vintage)
2. For each comp: synthesize NOI from platform operating stats
   - Revenue per unit from market rent benchmarks (Layer 1 or operator upload)
   - OpEx per unit from `line_item_benchmarks` (Layer 1 partial)
   - Effective gross income, vacancy, other income per cohort stats
3. Implied cap rate per comp = sale price ÷ synthesized NOI
4. Aggregate to market cap rate distribution (P25/P50/P75)
5. Apply median implied cap rate to subject's agent-derived NOI

**Architectural advantage:**
- Internal consistency: same comp set drives Cap × NOI, PPU, PSF, GRM, GIM
- Confidence calibration: sparse comp set → wide band → lower confidence
- Reconciliation gap analysis: divergences explainable in terms of which assumption differs (subject NOI vs. comp NOI, subject vs. comp implied cap rate)

**Prerequisites (need addressing before implementation dispatch):**
- `sale_comp_sets` generation working (currently empty — 0 rows)
- Market rent data accessible as queryable layer (`mv_market_rent_benchmarks` missing)
- Subject NOI present on test deals (`deal_assumptions.year1` currently null)

**DEFER TO:** Path B implementation dispatch next session, after foundation diagnostic returns.

---

## Commit 2 — P10 Data Sourcing Hierarchy (in CLAUDE.md this session)

**CODIFIED THIS SESSION as P10.** Summary:

Three source layers for every data-dependent feature:
- **Layer 1:** Platform-derived (research agent, APIs, pipelines) — LayeredValue tag: `'platform'`
- **Layer 2:** Operator upload (CoStar, broker, manual) — FIRST-CLASS — LayeredValue tag: `'operator'` or `'broker'`
- **Layer 3:** Graceful degradation (INSUFFICIENT + upload CTA) — LayeredValue tag: `'insufficient'`

**Design requirement:** all three layers wired in the same dispatch.

**Verification step (extends P8):** verify data sources against database state, not just code references.

**CITATION:** `CLAUDE.md ### P10 — Data Sourcing Hierarchy` (added this session, Task #1374).

---

## Commit 3 — Sale / Rent Comp Profiles

**DIRECTION (committed; not yet specified)**

Define standardized profiles for sale and rent comp records — required fields, validation rules, source provenance, quality grading. Resolves the schema fragmentation surfaced this session.

**Current fragmentation:**

| Surface | Tables |
|---|---|
| Sale-related | `market_sale_comps`, `recorded_transactions`, `deal_comp_sets`, `comp_properties`, `sale_comp_sets` |
| Rent-related | `market_rent_comps`, `apartment_rent_comps`, `apartment_locator_properties`, `apartment_class_rent_snapshots` |
| Class column variants | `asset_class`, `property_class`, `building_class`, `class` |

No unified schema across these surfaces. No canonical class column name.

**Sale Comp Profile (initial sketch):**
- Identity: `parcel_id`, address, geocode (lat/lng)
- Sale data: price, date, deed type, financing type
- Property characteristics: units, sqft, year_built, asset_class (canonical name TBD), vintage band
- Operating data (if available): gross rent at sale, gross income at sale, NOI at sale, occupancy at sale
- Source provenance: `county_recorded` | `costar_upload` | `broker_package` | `operator_entry`
- Quality score: recency, distance to subject, asset class match, comp count in cohort

**Rent Comp Profile (initial sketch):**
- Identity: same as sale comp
- Rent data: asking, effective, by unit type
- Property characteristics: same fields as sale comp
- Operating data: occupancy, concessions, time on market, lease velocity
- Source provenance: `apartment_iq` | `costar_upload` | `broker_package` | `operator_entry`
- Quality score: recency, geographic relevance, asset class match

**Next session:**
- Formalize profile specs (which fields required, optional, derived)
- Map current fragmented tables to profile (which become canonical, which deprecated, which get views/aliases)
- Define operator upload path per profile (CoStar export format → profile field mapping)
- Define research agent integration for municipal API sale comp pulls

**DEFER TO:** dedicated dispatch sequence next session — comp profile spec, then operator upload UX, then research agent integration.

---

## Queued for Next Session

In priority order:

**1. FOUNDATION DIAGNOSTIC** (small, 30–60 min)
- `SELECT COUNT(*), state FROM market_sale_comps GROUP BY state`
- `SELECT COUNT(*), COUNT(deal_id) FROM properties`
- Check whether research agent currently pulls sale comp data (and into which table)
- Check `mv_market_rent_benchmarks` migration status (exists in code? was run? rolled back?)

**2. SALE/RENT COMP PROFILE SPEC** (Commit 3)  
Substantive design work; deserves dedicated session attention.

**3. PATH B — COMP-ANCHORED CAP RATE SYNTHESIS** (Commit 1)  
After foundation diagnostic + profile spec land.

**4. PHASE 2 BATCH 3** (Capital Structure)  
Originally next-in-line Phase 2 batch; now pushed behind Valuation Grid completion + comp profiles work.

**5. ADJACENT BACKLOG** (not blocking)
- Task #672 (T12 sub-line utility parsing)
- `mv_market_rent_benchmarks` migration (if EC3 truly intends to ship this)
- GAP-TAX-01 consolidation (Phase 3)
- `f9-financial-export.service.ts:172` hardcode (retained with `console.warn`; observability sufficient)
- Valuation Grid GRM/GIM gross rent/income field coverage

---

## Session Accounting

### Phase 1 Status

**Substantively complete.**
- 9 items COMPLETE, 3 IN_FLIGHT moved through verification
- P8 + state verification corollary, P9 Phase 2 Batch Integrity, P10 Data Sourcing Hierarchy all in `CLAUDE.md`
- Mandate v1.3, Tier 1 RegimeExpand, Tier 2 directional validation, EC3 (partial), tax remediation, BUG-UTIL-01 fix all shipped

See `docs/operations/PHASE_1_STATUS_SUMMARY.md` for full item list.

### Phase 2 Entry Conditions

| EC | Condition | Status |
|---|---|---|
| EC1 | Strategy ↔ deal_type reconciled | **SATISFIED** |
| EC2 | Mandate lifted to v1.3 | **SATISFIED** |
| EC3 | Market rent source resolved | **YELLOW** — `mv_market_rent_benchmarks` view doesn't exist in DB (next session reconfirms) |
| EC4 | F9 module map gaps addressed | **SATISFIED** |

See `docs/operations/PHASE_2_ENTRY_CONDITIONS.md` for condition detail.

### Phase 2 Progress

| Batch | Status |
|---|---|
| Batch 1 (OpEx Simple, 10 assumptions) | **IMPLEMENTED** — in `system.ts` §OpEx Derivation Protocol |
| Batch 2 (Tax Module Audit) | **AUDITED + REMEDIATED** — 5 gaps closed |
| Batches 3–7 | Not started |
| Valuation Grid v0.1 | Shipped at Replit; column fix applied; blocked on data layer maturity; comp-anchored direction committed for Path B |

### Session Journal Addition (Lesson 3)

**Lesson 3:** Schema and database-state references in specs must verify against actual table definitions and database content before the spec drives implementation. Code references to data sources are not evidence the sources exist or are populated.

*Example:* EC3 verification claimed `mv_market_rent_benchmarks` shipped; database query shows the view doesn't exist.

This lesson is appended to `docs/operations/SESSION_JOURNAL.md`.

---

## How to Open Next Session

Load into context:
- `CLAUDE.md` (P1–P10)
- `docs/operations/PHASE_2_ENTRY_CONDITIONS.md` (current state)
- `docs/operations/PHASE_1_STATUS_SUMMARY.md` (snapshot)
- `docs/operations/SESSION_JOURNAL.md` (3 standing lessons)
- `docs/operations/SESSION_CLOSE_VALUATION_GRID.md` (this document)
- `docs/operations/VALUATION_GRID_DATA_FLOW_SURFACE.md` (Replit's diagnostic — the read-only surface report produced this session)
- `docs/operations/VALUATION_GRID_COLUMN_FIX.md` (column fix applied this session)
- `docs/operations/PHASE_2_BATCH_1_OPEX_SIMPLE.md` (Batch pattern reference)

Open with: **foundation diagnostic dispatch.** `sale_comp_sets` + `market_sale_comps` + `properties` + research agent state. Outcome shapes the next 3–5 dispatches.
