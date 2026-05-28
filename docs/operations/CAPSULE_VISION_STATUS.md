# CAPSULE VISION STATUS
**Last updated:** 2026-05-28  
**Maintained by:** Agent session — update after each Bishop run or blocker resolution.

This document tracks the live status of every blocker and gap listed in `JEDI_RE_DEAL_CAPSULE_VISION_1780008935275.md` Part 9 against the actual dev database and codebase state. **Live state is authoritative over the vision document's "currently exists" claims.**

---

## PART 9 BLOCKER AUDIT — CRITICAL

### Blocker 1 — Data library download + delete (Layer 2 CRUD incomplete)
**Status:** ❌ OPEN  
**Evidence:** Not verified this session; prior session noted 500 errors on download routes.  
**Consequence:** Operators cannot curate Tier 1 evidence (stale OM cannot be removed, files cannot be retrieved).  
**Next action:** Task to fix download + delete routes.

---

### Blocker 2 — Layer 3 ingestion path (CoStar upload → market tables)
**Status:** ⚠️ PARTIAL  
**Evidence:** D-COSTAR-2 pipeline exists. `market_sale_comps.noi` and `market_sale_comps.noi_per_unit` columns were MISSING until 2026-05-28 — Task #1445 migration never ran in this dev DB. Applied manually this session.  
**Remaining gap:** The upload pipeline may now be wiring correctly; requires a live upload test to confirm end-to-end.

---

### Blocker 3 — `properties ↔ deals` join empty across all deals
**Status:** ⚠️ PARTIAL  
**Evidence (2026-05-28 query):** Only Bishop (deal_id `3f32276f-...`) has a linked `properties` row. 28+ other deals have no linked property record. Bishop's subject record: `units=232`, `year_built=2017`, `lat/lng` populated. **`sqft=NULL`** — blocks Sales Comp PSF calculation.  
**Consequence:** Every deal except Bishop returns INSUFFICIENT on all comp-dependent valuation methods.  
**Next action:** Task #1422 (auto-create properties row on deal creation) — status unknown. Backfill for existing deals.

---

### Blocker 4 — `mv_market_rent_benchmarks` does not exist
**Status:** ✅ RESOLVED (2026-05-28)  
**Resolution:** Migration `20260628_ec3_apply_mv_market_rent_benchmarks.sql` existed but had never run against this dev DB. Applied manually. View now exists with 11 rows across FL/GA/NC/TN/TX markets.  
**Caveat (GAP-4):** All 1,585 ApartmentIQ rows in `apartment_locator_properties` have `year_built = NULL`, so the asset-class bucketing (`>= 2010 → A`, `>= 1995 → B`, else `C`) maps every row to class C. GRM/GIM method will only match deals of class C. Bishop is class B (year_built 2017) → no matching row → GRM/GIM still INSUFFICIENT for Bishop specifically.  
**Next action:** Task to backfill `year_built` in `apartment_locator_properties` from ApartmentIQ data (Task #1423, status unknown).

---

## PART 9 BLOCKER AUDIT — SIGNIFICANT GAPS

### Gap 5 — Comp inventory empty
**Status:** ⚠️ PARTIAL — seed data exists, but outside Bishop's search radius  
**Evidence (2026-05-28):**
- 343,486 `market_sale_comps` rows for GA, all `source = 'georgia_county'`, `property_type = 'multifamily'`
- 0 rows with `cap_rate`, 5 rows with `units` (all junk: web scrapes of PDFs/news articles)
- 32 seed comps added this session via `seed-backtest-comps.ts` (Task #1435 seed never ran in this DB)
  - Atlanta comps: 4.64–7.99 miles from Bishop — **outside** the 3.0-mile default radius and even the 4.5-mile 1.5x fallback
  - Jacksonville comps: 287–290 miles away (different market)
- Net result: `generateCompSet` for Bishop still returns **0 members** even with seed data present

**Root cause of empty comp sets:** The valuation-grid.routes.ts calls `generateCompSet({ deal_id })` with no radius param after uploads — 3-mile default produces 0 results. The comp sets show `comp_count=0` and `selection_criteria={"deal_id":"..."}`. The valuation-grid service computation path uses `criteria.radiusMiles` (default 3.0, 1.5x = 4.5 miles) — also insufficient for Bishop.

**What's needed for Bishop specifically:**
- Either: expand radius to 5+ miles for Bishop's comp search (nearest usable comp is 4.64 miles)
- Or: seed comps in West Midtown / Buckhead (within 3 miles of 464 Bishop St NW)
- Or: ingest real CoStar comps for this submarket via the upload pipeline

**Consequence:** Comp-Anchored Cap Rate → INSUFFICIENT. Sales Comp PPU → INSUFFICIENT.

---

### Gap 6 — AI compute vs. deterministic derivation boundary
**Status:** NOT VERIFIED this session.  
**Reference:** AI Compute Derivation Audit document. Bishop's NOI was broken for a separate reason (T12 management fee corruption) — see NOI section below.

---

### Gap 7 — M22 Post-Close engine unbuilt
**Status:** ❌ OPEN  
**Evidence:** Not verified this session. `deal_monthly_actuals` table exists per prior notes; engine unbuilt.  
**Consequence:** Tier 2 corpus cannot grow. Owned-portfolio actuals (Layer 4) non-functional.

---

### Gap 8 — Reconciliation engine not deal-type-aware
**Status:** ❌ OPEN  
**Evidence:** Backtest showed Replacement Cost poisoning reconciliation midpoints when other methods return INSUFFICIENT. Method weighting does not yet respect deal type.  
**Consequence:** Reconciliation midpoint is unreliable when any single method fires in isolation.

---

## BISHOP (464 BISHOP ST NW) — END-TO-END RUN STATUS (2026-05-28)

### Subject record
| Field | Value | Status |
|---|---|---|
| units | 232 | ✅ |
| year_built | 2017 | ✅ |
| lat/lng | 33.7924 / -84.4032 | ✅ |
| sqft | NULL | ❌ blocks PSF |
| building_class | B | ✅ |

### NOI + key assumptions (pre/post 2026-05-28 fix)
| Field | Before | After | Status |
|---|---|---|---|
| `noi.resolved` | $367,640 (platform_fallback) | **$2,999,564 (om)** | ✅ Fixed |
| `management_fee_pct.resolved` | 0.1142 (11.4% from T12 — corrupted) | **0.0275 (2.75% from OM)** | ✅ Fixed |
| `total_opex.resolved` | $3,283,812 | **$1,656,766 (om)** | ✅ Fixed |

The T12 management fee corruption (11.4%) was caused by the fee dollar amount being divided by the wrong income base during T12 ingestion. The fix manually sets resolved values to OM-sourced figures. The underlying parser bug is still present and will recur if the agent re-runs T12 ingestion.

### Valuation Grid — method status
| Method | Status | Root Cause |
|---|---|---|
| Comp-Anchored Cap Rate | ❌ INSUFFICIENT | 0 comps within 3-mile radius (nearest: 4.64 mi) |
| Sales Comp PPU | ❌ INSUFFICIENT | Same + sqft NULL |
| GRM / GIM | ❌ INSUFFICIENT | mv_market_rent_benchmarks exists but all rows are class C; Bishop is class B (year_built 2017 → should be class A per view logic) |
| Cap Rate × NOI | ⚠️ FIRES — verify value | NOI now $2,999,564; cap_rate benchmark: p50=4.50% (2022); implied value ≈ $66.7M |
| Replacement Cost | ❌ LIKELY INSUFFICIENT | Separate data gap (not audited this session) |
| Operator Override | Only defensible live output | — |

### Migration state (as of 2026-05-28)
All migrations listed here were **not present in the dev DB** before this session. Applied manually:

| Migration | Applied | Effect |
|---|---|---|
| `20260702_market_sale_comps_noi.sql` | ✅ 2026-05-28 | `noi`, `noi_per_unit` columns added to `market_sale_comps` |
| `20260702_sale_comp_set_members_relevance_score.sql` | ✅ 2026-05-28 | `relevance_score`, `relevance_factors` added to `sale_comp_set_members` |
| `20260702_fix_bishop_noi_resolved.sql` | ✅ 2026-05-28 | Bishop `year1.noi.resolved` = $2,999,564 |
| `20260628_ec3_apply_mv_market_rent_benchmarks.sql` | ✅ 2026-05-28 | `mv_market_rent_benchmarks` materialized view created |

**Root cause of migration lag:** The post-merge setup script runs `npx drizzle-kit migrate` but consistently outputs *"Migration skipped (build not available, will run at startup)"*. Task agent DB state never transfers to the main dev DB — only code merges. Any task whose acceptance criteria depends on DB state must be re-verified here.

### Seed data state (as of 2026-05-28)
| Script | Ran in task agent DB | Ran in main dev DB |
|---|---|---|
| `seed-backtest-comps.ts` (32 comps, Task #1435) | ✅ | ✅ Applied 2026-05-28 |
| `seed-archive-benchmarks-historical.ts` (32 rows, Task #1437) | ✅ | ✅ Applied 2026-05-28 |

**Benchmark coverage post-seed:**
- `cap_rate` benchmarks: 16 rows, 2015-01-01 → 2022-07-01 (NCREIF/CBRE source, asset class B, 6-month intervals)
- `price_per_unit` benchmarks: 17 rows, 2015-01-01 → 2026-05-25

---

## NEXT DISPATCH SHAPE (shaped by Bishop run results)

Bishop did **not** produce a defensible Purchase Price end-to-end. The three live blockers:

**1. Comp radius / data coverage gap (highest priority)**  
The immediate path to getting Comp-Anchored Cap Rate and Sales Comp PPU to fire for Bishop is one of:
- (a) Widen default radius to 5 miles in `valuation-grid.service.ts` criteria defaults (line 1777)
- (b) Seed 3–5 comps within 3 miles of Bishop (West Midtown submarket) — preferred because the south Atlanta seed comps are not particularly comparable to a 2017 Class B property in Howell Station anyway
- (c) Ingest real CoStar comps for the West Midtown submarket via the upload pipeline

**2. GRM/GIM class C only (medium priority)**  
`mv_market_rent_benchmarks` exists but all rows are class C due to null `year_built` in `apartment_locator_properties`. Task #1423 (year_built backfill) unblocks class A and B rows. Until then, GRM/GIM only fires for class C deals.

**3. T12 management fee parser bug (medium priority)**  
The 11.4% fee resolution was a T12 ingestion bug. The NOI fix is applied manually but the parser will reproduce the bug on any re-run. The management_fee_pct T12 reader is computing dollars-over-wrong-base. Needs a targeted fix in the T12 ingestion parser.

**Vision Part 9 generalization (follows Bishop success):**  
Once Bishop produces a defensible Purchase Price, the next foundational items are:
- Blocker 1 (data library download + delete)
- Blocker 3 (properties ↔ deals subject record for all deals, not just Bishop)

---

## STRUCTURAL PATTERN NOTE

Task agent merges transfer **code only, not database state**. Every task whose verification script runs against the task agent's isolated DB must be re-verified here:
- Seed scripts: must be re-run against the main dev DB
- SQL migrations: must be applied against the main dev DB (the migration runner skips at merge time)
- This pattern will recur. Consider converting all seed scripts to Drizzle migrations (Task #1466 was proposed for this) to make the post-merge setup script actually apply the data.
