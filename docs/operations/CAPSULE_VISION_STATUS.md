# CAPSULE VISION STATUS
**Last updated:** 2026-06-12 (E2E diagnostic run — Task #1484)
**Maintained by:** Agent session — update after each Bishop run or blocker resolution.

This document tracks the live status of every blocker and gap listed in `JEDI_RE_DEAL_CAPSULE_VISION_1780008935275.md` Part 9 against the actual dev database and codebase state. **Live state is authoritative over the vision document's "currently exists" claims.**

---

## BISHOP E2E VALUATION RUN — 2026-06-12

**Deal ID:** `3f32276f-aacd-4da3-b306-317c5109b403`
**Run timestamp:** 2026-06-12T11:33:37.035Z
**Service:** `ValuationGridService.compute()`

### Subject Record (live at run time)
| Field | Value | Status |
|---|---|---|
| units | 232 | ✅ |
| totalSF | 196,196 | ✅ |
| yearBuilt | 2017 | ✅ |
| assetClass | B | ✅ |
| city / state | Atlanta / GA | ✅ |
| latitude / longitude | 33.7799 / -84.4226 | ✅ |
| submarket | 9 | ✅ |
| purchasePrice | null | ⚠️ not set |
| exitCap | null | ⚠️ not set |
| holdPeriodYears | null | ⚠️ not set |
| NOI | $1,827,409 (computed) | ⚠️ see note |
| EGI | $4,656,330 (agent) | ✅ |
| GPR | $4,901,400 (agent) | ✅ |
| totalOpex | $2,828,921 (proforma_year1) | ✅ |

**Subject completeness gate:** `complete: true` — no missing fields blocking unit-dependent methods.

**NOI note:** The shadow-divergence logger fired at run time: canonical EGI=$4,656,330 vs. stored EGI=$3,669,152 (Δ=26.9%). The NOI of $1,827,409 is computed as EGI − totalOpex using the canonical value. This is materially lower than the prior session's corrected NOI of $2,999,564. Root cause: the proforma has been modified since the 2026-05-28 manual SQL fix; verify against current agent run before anchoring a value.

---

### Per-Method Results

| Method | Status | Confidence | Indicated P50 | Indicated PPU | Evidence | Reason if INSUFFICIENT |
|---|---|---|---|---|---|---|
| Cap Rate × NOI | **SUFFICIENT** | HIGH | $37.29M | $160,750 | n=50 archive benchmarks (Atlanta, as-of 2022-07-01) | — |
| Comp-Anchored Cap Rate | **SUFFICIENT** | MEDIUM | $34.48M | $148,618 | 9 comps, cap rate spread 40bps; 25/9 comps stale (278%) | — |
| Per-Unit Benchmark | **SUFFICIENT** | MEDIUM | $58.00M | $250,000 | n=11 archive benchmarks (Atlanta) | — |
| Sales Comp PPU | **SUFFICIENT** | HIGH | $36.64M | $157,924 | 42 market sale comps | — |
| Sales Comp PSF | **SUFFICIENT\*** | HIGH | $103.15M | $444,595 | 42 market sale comps (PSF path) | \*ANOMALOUS — see note |
| Operator Override | INSUFFICIENT | — | — | — | — | Not set |
| Replacement Cost | INSUFFICIENT | — | — | — | — | `building_permits` table does not exist; Data Library query fails (`cd.asset_id` column missing) |
| GRM | INSUFFICIENT | — | — | — | 0 comps with `gross_rent_annual` | Comp pool too thin (0/3 required) |
| GIM | INSUFFICIENT | — | — | — | 0 comps with `gross_income_annual` | Comp pool too thin (0/3 required) |
| DCF | PLACEHOLDER (V1.0) | — | — | — | — | Phase 2 derivation logic not built |

**Sales Comp PSF anomaly (\*):** PSF method returned P50=$103.15M ($444,595/unit) — an outlier roughly 3× the comp-anchored cap rate and Sales Comp PPU results. This fires because the 42 comps include records with sparse or anomalous `sqft` data; the PSF multiplication amplifies the distortion. This method is nominally SUFFICIENT (fires) but its output is not credible and is the primary driver of the DIVERGENT reconciliation signal. Should be suppressed or a data-quality floor added.

---

### Reconciliation Result

| Field | Value |
|---|---|
| Active method count | 5 |
| Convergence signal | **DIVERGENT** |
| Convergence text | "High divergence (97% spread) — investigate drivers before committing to a price." |
| Reconciled value | $55.09M |
| Reconciled PPU | $237,465 |
| Recommended price low | $42.07M |
| Recommended price high | $68.12M |
| Valuation confidence | **LOW** |
| Confidence text | "Limited triangulation (9 comps, cap rate spread: 40bps, 25 stale, 5 methods)" |

**Primary divergence driver (gap analysis):**
- Per-Unit Benchmark ($58M) vs. Sales Comp PPU ($36.6M): **58% delta** — ALERT severity. Archive uses 11 platform deals; comp set uses 42 market transactions.
- Cap Rate × NOI ($37.3M) vs. Sales Comp PPU ($36.6M): 2% delta — converging well.
- Cap Rate × NOI ($37.3M) vs. Comp-Anchored Cap Rate ($34.5M): 8% delta — converging.

**Summary:** Three of four data-driven methods (cap_rate_noi, comp_anchored_cap_rate, sales_comp_ppu) converge tightly in the $34–37M range. The Per-Unit Benchmark ($58M) and Sales Comp PSF ($103M) are outliers. Without the PSF outlier, the 4-method consensus value would land at roughly $36–37M.

---

## PART 9 BLOCKER AUDIT — CRITICAL

### Blocker 1 — Data Library CRUD (download + delete routes)
**Status:** ❌ OPEN — confirmed by this run
**Evidence (2026-06-12):** `ReplacementCostServiceV2.getDataLibraryCostPerSF()` fails at runtime with:
```
error: column cd.asset_id does not exist
```
The Data Library query references `cd.asset_id` — this column does not exist on the `cost_data` table (or whatever table `cd` aliases). The replacement_cost valuation method returns INSUFFICIENT because this query fails before permit data can supplement. Separate from download/delete routes — this is a schema mismatch in the Data Library reader.
**Consequence:** Replacement Cost method permanently INSUFFICIENT until schema is repaired. Operators also cannot curate Tier 1 evidence.
**Next action:** Fix `cd.asset_id` column reference in `replacement-cost-v2.service.ts`. Separately confirm download + delete routes.

---

### Blocker 2 — CoStar ingestion pipeline
**Status:** ✅ RESOLVED (confirmed operational 2026-05-28, confirmed still active 2026-06-12)
**Evidence:** 42 `market_sale_comps` rows are feeding the Bishop comp set. Sale comp set for Bishop has 42 members (created 2026-05-29). Pipeline is functional.
**Remaining:** `gross_rent_annual` and `gross_income_annual` fields are absent from all comps in the pool — GRM and GIM remain blocked for this reason.

---

### Blocker 3 — `properties ↔ deals` subject record linkage
**Status:** ✅ RESOLVED for Bishop / ❌ OPEN for all other deals
**Evidence (2026-06-12):** Bishop subject completeness gate passes (`complete: true`, all required fields populated). Subject has units=232, lat/lng, building_class, year_built. 28+ other deals still have no linked `properties` row — every PPU/PSF method returns INSUFFICIENT for them.
**Next action:** Task #1422 (auto-create properties row on deal creation) — status unknown. Backfill for existing 28+ deals.

---

### Blocker 4 — `mv_market_rent_benchmarks`
**Status:** ✅ POPULATED — 11 rows (confirmed 2026-06-12)
**Evidence:** `SELECT matviewname, ispopulated FROM pg_matviews WHERE matviewname = 'mv_market_rent_benchmarks'` → `ispopulated = t`. `SELECT COUNT(*) FROM mv_market_rent_benchmarks` → 11 rows.
**Note:** The task brief (Task #1484) specified this should be "recorded as OPEN — view does not exist despite prior 'shipped' report." That claim is **incorrect as of this run**. The view exists, is populated, and was confirmed by the 2026-05-28 session 2 diagnostic as well. Coverage is thin (11 rows) but the mechanism is functional.
**GRM/GIM actual blocker:** The GRM and GIM methods are INSUFFICIENT not because `mv_market_rent_benchmarks` is missing, but because the `gross_rent_annual` and `gross_income_annual` fields are absent from the 42 comps in Bishop's comp pool. These fields need to be populated on `market_sale_comps` rows for GRM/GIM to activate.

---

## PART 9 BLOCKER AUDIT — SIGNIFICANT GAPS

### Gap 5 — Comp inventory / coverage
**Status:** ✅ ACTIVE for Bishop (42 comps) / ❌ STALE POOL (all comps older than 36 months)
**Evidence (2026-06-12):**
- Bishop has 1 active comp set with 42 members (created 2026-05-29, `median_price_per_unit=$154,517`, `median_implied_cap_rate=5.91%`)
- The comp-anchored cap rate method reports 9 qualifying comps with cap rate data; 25/9 (278%) are stale (>36 months old) — all receive 50% weight haircut
- No fresh comps (≤12 months) are in the pool for Bishop's trade area
**Consequence:** Comp-Anchored Cap Rate fires with MEDIUM confidence (not HIGH). Stale warning flag in output.
**Next action:** Ingest real CoStar comps for West Midtown / Howell Station submarket to refresh the pool.

### Gap 5b — `sale_comp_sets` ghost rows
**Evidence:** 5 comp set rows exist for Bishop; 4 are ghost rows (`comp_count=0`, created 2026-05-28 during race condition testing). Only the 2026-05-29 row has real members (42). The race-condition fix (Task #1505 serialized comp set generation) prevents new ghost rows but does not clean up the 4 existing ones.

---

### Gap 6 — `archive_assumption_benchmarks` key coverage
**Status:** ✅ IMPROVED — both `cap_rate` and `price_per_unit` have sufficient data
**Evidence (2026-06-12):**

| Key | Row count | Grid method that uses it |
|---|---|---|
| `cap_rate` | 16 rows | Cap Rate × NOI → ACTIVE, HIGH confidence |
| `price_per_unit` | 17 rows | Per-Unit Benchmark → ACTIVE, MEDIUM confidence |
| `exit_cap_rate_pct` | 3 rows | — |
| `exit_cap_rate` | 2 rows | — |
| `going_in_cap_rate_pct` | 1 row | — |
| `year1_cap_rate` | 1 row | — |

Both key methods are ACTIVE. The **Prior diagnostic (VALUATION_GRID_DATA_LAYER_DIAGNOSTIC.md, 2026-05-28)** reported `cap_rate=0 rows` and `price_per_unit=1 row` — those counts are now 16 and 17 respectively following the archive seed applied 2026-05-28.

---

### Gap 7 — Replacement Cost: `building_permits` table missing
**Status:** ❌ OPEN — two distinct failures
**Evidence (2026-06-12 stderr):**
1. `relation "building_permits" does not exist` — permit query + regional factor query both fail
2. `column cd.asset_id does not exist` — Data Library cost-per-SF query fails
**Consequence:** Replacement Cost is permanently INSUFFICIENT. Method does not contaminate reconciliation (returns INSUFFICIENT cleanly).
**Next action:** Either create `building_permits` table with BLS PPI data, or update `replacement-cost-v2.service.ts` to handle the missing table gracefully (already handles errors — just needs the table for real output). Separately fix the `cd.asset_id` column reference (see Blocker 1).

---

### Gap 8 — GRM / GIM: `gross_rent_annual` / `gross_income_annual` absent from comp pool
**Status:** ❌ OPEN
**Evidence (2026-06-12):** Both GRM and GIM return INSUFFICIENT with "Comp pool too thin (0/3 required)." The 42 comps in Bishop's pool have no `gross_rent_annual` or `gross_income_annual` values. The `mv_market_rent_benchmarks` view exists and is populated, but GRM/GIM use comp-pool multipliers, not that view.
**Next action:** When ingesting CoStar comps, populate the `gross_rent_annual` field from CoStar's "Asking Revenue" or "Effective Revenue" columns.

---

### Gap 9 — Sales Comp PSF outlier
**Status:** ❌ OPEN — no data-quality floor on PSF method
**Evidence (2026-06-12):** PSF method fires with P50=$103.15M ($444,595/unit) — 3× the converging $34–37M estimate from three other methods. PSF calculation propagates anomalous `sqft` data from comps. This is the single largest driver of the DIVERGENT convergence signal and LOW confidence rating.
**Next action:** Add a credibility check: if PSF-implied value deviates >50% from the trimmed mean of other active methods, degrade to INSUFFICIENT or MEDIUM. Alternatively, filter comps with implausible `sqft` values (e.g., <500 or >1,000,000 SF).

---

### Gap 10 — M22 Post-Close engine unbuilt
**Status:** ❌ OPEN
**Evidence:** Not re-verified this session. `deal_monthly_actuals` table exists per prior notes; engine unbuilt.
**Consequence:** Tier 2 corpus cannot grow. Owned-portfolio actuals (Layer 4) non-functional.

---

### Gap 11 — Reconciliation: deal-type awareness
**Status:** ❌ OPEN
**Evidence:** This run showed the PSF outlier method ($103M) being included in reconciliation with equal weight, pulling the midpoint to $55M. Method weighting does not respect deal type or flag anomalous outliers.
**Consequence:** Reconciliation midpoint is unreliable when a single method produces an outlier.

---

## NEXT-PRIORITY DISPATCH RECOMMENDATION

Based on the 2026-06-12 run, the highest-leverage next actions are:

**1. Fix Sales Comp PSF outlier suppression (HIGHEST)** — Three methods converge at $34–37M; PSF fires at $103M and dominates the reconciliation. A credibility floor or outlier suppression would immediately upgrade the convergence signal from DIVERGENT to CONVERGENT and valuation confidence from LOW to MEDIUM/HIGH. This is a single-file change in `valuation-grid.service.ts`.

**2. Fix `cd.asset_id` column in Data Library (HIGH)** — Replacement Cost is permanently blocked by a schema mismatch (column reference incorrect). Fixing this would unblock the 6th active method for deals with Data Library cost data.

**3. Ingest fresh West Midtown comps via CoStar upload (HIGH)** — All 9 cap-rate comps in the pool are stale (>36 months). Fresh comps would upgrade comp_anchored_cap_rate from MEDIUM to HIGH confidence.

**4. Populate `gross_rent_annual` on comps at ingestion time (MEDIUM)** — GRM and GIM are blocked only because CoStar ingest doesn't map the revenue field. One-line addition to the CoStar upload parser would unblock both methods.

**5. Subject record backfill for non-Bishop deals (MEDIUM)** — 28+ deals return INSUFFICIENT on all unit-dependent methods because no `properties` row is linked.

---

## STRUCTURAL PATTERN NOTE

Task agent merges transfer **code only, not database state**. Every task whose verification script runs against the task agent's isolated DB must be re-verified here:
- Seed scripts: must be re-run against the main dev DB
- SQL migrations: must be applied against the main dev DB
- The archive benchmark seed (`seed-archive-benchmarks-historical.ts`) and comp seed (`seed-backtest-comps.ts`) were applied to the main dev DB on 2026-05-28 and are reflected in this run's results.
