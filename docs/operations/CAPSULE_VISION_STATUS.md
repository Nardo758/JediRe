# CAPSULE VISION STATUS
**Last updated:** 2026-05-28 (session 2)  
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
**Status:** ✅ FULLY RESOLVED (2026-05-28 session 2)  
**Resolution:** Migration `20260628_ec3_apply_mv_market_rent_benchmarks.sql` applied in session 1. Session 2 applied `20260703_fix_mv_market_rent_benchmarks_null_year_built.sql` to fix the null year_built → class C mis-classification. The CASE now maps `year_built IS NULL → 'B'` as a conservative default. Atlanta GA now has 127 class B samples (p50=$1,441). GRM/GIM can fire for Bishop (class B).  
**Next action:** Task #1423 (backfill real year_built values) remains open but is no longer a blocker for GRM/GIM.

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

### NOI + key assumptions (pre/post fix)
| Field | Before | After | Status |
|---|---|---|---|
| `noi.resolved` | $367,640 (platform_fallback) | **$2,999,564 (om)** | ✅ Fixed (session 2) |
| `management_fee_pct.resolved` | 0.1142 (11.4% from T12 — corrupted) | **0.0275 (2.75% from OM)** | ✅ Fixed (session 2) |
| `total_opex.resolved` | $3,283,812 | **$1,656,766 (om)** | ✅ Fixed (session 2) |

**Session 1 migration note:** The migration `20260702_fix_bishop_noi_resolved.sql` had the correct UUID but the session 1 scratchpad recorded it with a one-character typo (`517c` vs `317c`), so the fix was never confirmed. Session 2 applied the fix directly to `deal_assumptions` **and** the active `deal_underwriting_scenarios` row.

**Parser fix (session 2):** `t12-parser.ts` and `data-router.ts` now null out `management_fee_pct` when the computed rate exceeds 10%. The cashflow agent postprocessor now re-derives `management_fee_pct = management_fee_dollars / EGI` and writes it back to year1, then fires the version-save. Future agent runs will self-heal the rate without manual SQL.

### Valuation Grid — method status (session 2)
| Method | Status | Root Cause |
|---|---|---|
| Comp-Anchored Cap Rate | ❌ INSUFFICIENT | 0 comps within 3-mile radius (nearest: 4.64 mi) |
| Sales Comp PPU | ❌ INSUFFICIENT | Same + sqft NULL |
| GRM / GIM | ✅ UNBLOCKED | mv_market_rent_benchmarks now has class B rows. Atlanta: 127 samples, p50=$1,441. Bishop (class B) can now match. |
| Cap Rate × NOI | ✅ FIRES | NOI=$2,999,564; cap_rate p50=4.50% (2022 NCREIF); implied value ≈ $66.7M |
| Replacement Cost | ✅ RETURNS INSUFFICIENT | Fixed (session 2): guard prevents fabricated $185/SF default from poisoning reconciliation when no real permit data exists |
| Operator Override | Defensible live output | — |

### Migration state (as of 2026-05-28 session 2)
All migrations listed here were applied manually (migration runner skips at merge time):

| Migration | Applied | Effect |
|---|---|---|
| `20260702_market_sale_comps_noi.sql` | ✅ 2026-05-28 session 1 | `noi`, `noi_per_unit` columns added to `market_sale_comps` |
| `20260702_sale_comp_set_members_relevance_score.sql` | ✅ 2026-05-28 session 1 | `relevance_score`, `relevance_factors` added to `sale_comp_set_members` |
| `20260702_fix_bishop_noi_resolved.sql` | ✅ 2026-05-28 session 2 | Bishop `year1.noi.resolved`=$2,999,564, `mgmt_fee_pct`=0.0275, `total_opex`=$1,656,766 — applied to both `deal_assumptions` and active `deal_underwriting_scenarios` row. Session 1 recorded wrong UUID in scratchpad; fix was never confirmed until session 2. |
| `20260628_ec3_apply_mv_market_rent_benchmarks.sql` | ✅ 2026-05-28 session 1 | `mv_market_rent_benchmarks` materialized view created |
| `20260703_fix_mv_market_rent_benchmarks_null_year_built.sql` | ✅ 2026-05-28 session 2 | View recreated: `year_built IS NULL → class B`. Atlanta: 127 class B samples. GRM/GIM unblocked for Bishop. |

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

**2. GRM/GIM class C only (medium priority) → RESOLVED session 2**  
`mv_market_rent_benchmarks` now has class B rows (null year_built → B). GRM/GIM unblocked for Bishop.

**3. T12 management fee parser bug (medium priority) → RESOLVED session 2**  
`t12-parser.ts` and `data-router.ts` now null out rates >10%. Cashflow agent postprocessor re-derives `management_fee_pct = management_fee_dollars / EGI` on every run and version-saves the change. Self-heals without manual SQL.

**4. Replacement Cost poisoning reconciliation (resolved session 2)**  
`valuation-grid.service.ts` now returns INSUFFICIENT when no real permit data exists, instead of using fabricated $185/SF. Reconciliation midpoint is no longer contaminated by a single unconstrained method.

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
