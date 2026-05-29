# PROPERTY PLUMBING REFACTOR — IMPLEMENTATION MAP

**Document type:** Living implementation tracker  
**Last updated:** 2026-05-29  
**Sources:** `JEDI_RE_PROPERTY_PLUMBING_REFACTOR.md` (decisions) + `JEDI_RE_PROPERTY_PLUMBING_PHASES.md` (phase plan) + `property-plumbing-reality-check.md` (verified state) + Phase 1 work executed 2026-05-29  

This document is the canonical source of truth for where the refactor stands. It maps the detailed phase plan against actual live state. When plan and reality diverge, live state is marked and the plan adjusted here — not absorbed silently.

---

## ARCHITECTURAL COMMITMENTS (locked)

| Decision | Status | Implementation location |
|---|---|---|
| D1 — Parcel ID as primary identity | LOCKED | `properties.parcel_id` (existing) + `parcel_id_status` column added Phase 1 |
| D2 — Immutable vs time-varying split | LOCKED | `properties` stays for immutable; `property_characteristics` for time-varying |
| D3 — Four target tables | LOCKED | Three new tables built Phase 1; `property_records/property_info_cache` disposition deferred |
| D4 — `deals.property_id` as canonical FK | LOCKED | Column added Phase 1 (see Phase 1 deviation note below) |
| D5 — Comp inventory deprecated | LOCKED | `property_sales` created Phase 1; comp deprecation in Phase 5 |
| D6 — Five-phase migration | LOCKED | Duration: 16-25 weeks; Phase 1 complete |

---

## PHASE STATUS OVERVIEW

| Phase | Name | Status | Duration | Gate |
|---|---|---|---|---|
| **1** | Schema Build | **PARTIAL — see deviation** | 3-4 weeks | AC not fully met (see §1) |
| 2 | Dual-Write | NOT STARTED | 4-5 weeks | Phase 1 AC gate |
| 3 | Reader Migration | NOT STARTED | 6-10 weeks | Phase 2 AC gate |
| 4 | Old-Table Deprecation | NOT STARTED | 2-4 weeks | Phase 3 AC gate |
| 5 | Comp / Valuation Grid Integration | NOT STARTED | 2-3 weeks | Phase 4 AC gate |

---

## PHASE 1 — SCHEMA BUILD

### What the plan called for

Per `JEDI_RE_PROPERTY_PLUMBING_PHASES.md §1.2`:
- Create **`properties_v2`** (NEW parallel table, ~30 cols, will replace `properties` in Phase 4)
- Create `property_characteristics` (NEW)
- Create `property_operating_data` (NEW)
- Create `property_sales` (NEW, after legacy renamed)
- Rename `property_sales` stub → `property_sales_legacy`
- Add `deals.property_id_v2` (NOT `deals.property_id` — `_v2` suffix to distinguish during migration)
- `properties_v2.legacy_property_id` column to support backfill from existing 1,596 properties rows
- `properties_v2.parcel_id_canonical` + `parcel_id_raw` columns for normalized parcel ID

Per §1.1 (five pre-phase disposition questions):
- A. `property_records` vs `property_info_cache` disposition
- B. `property_sales` stub migration strategy
- C. `discovered_properties` mapping
- D. `county_parcels` / `fulton_parcels` / `fulton_structures` disposition
- E. Parcel ID canonicalization format

Per §1.3 (service layer skeleton):
- `PropertyService` (with `getCanonicalProperty`, `getPropertyWithCharacteristics`, etc.)
- `PropertySalesService`
- `PropertyResolverService` (find-or-create + dedup + merge)
- `DealPropertyLinkService` (dual-write wrapper for deal→property link)

### What was actually built (2026-05-29)

**Migration:** `backend/src/database/migrations/20260529_phase1_property_entity_schema.sql` — applied, clean  
**Schema:** `backend/src/db/schema/propertyEntity.ts`  
**Services:** `backend/src/services/property-entity/` (4 files)  
**Docs:** `property-plumbing-field-mapping.md`, `property-plumbing-phase1-scope.md`

| Item | Plan called for | What was built | Status |
|---|---|---|---|
| `properties_v2` table | NEW parallel table (30 cols) | **NOT BUILT** | ❌ DEVIATION |
| `property_characteristics` | NEW | ✅ Created, indexed, commented | DONE |
| `property_operating_data` | NEW | ✅ Created, indexed, commented | DONE |
| `property_sales` (canonical) | NEW after legacy renamed | ✅ Created (24 cols, full spec schema) | DONE |
| `property_sales_legacy` | Renamed from stub | ✅ 292 rows preserved | DONE |
| `deals.property_id_v2` | Nullable column, no FK yet | ❌ Built as `deals.property_id` with FK enforced immediately | DEVIATION |
| `properties.parcel_id_status` | Not specified (was on properties_v2) | ✅ Added to `properties` | DONE (adjusted) |
| `properties.is_superseded` / `predecessor_property_id` | On properties_v2 | ✅ Added to `properties` | DONE (adjusted) |
| `PropertyService` | Full CRUD + canonical resolution | Stub only (index.ts note) | PARTIAL |
| `PropertySalesService` | Full CRUD + comp query | ✅ Built with core methods | DONE |
| `PropertyCharacteristicsService` | Not separately named | ✅ Built with getCurrent/history/asOf/batch | DONE |
| `PropertyOperatingDataService` | Not separately named | ✅ Built with getLatestTtm/getAll/create | DONE |
| `PropertyResolverService` | Dedup + find-or-create + merge | **NOT BUILT** | ❌ MISSING |
| `DealPropertyLinkService` | Dual-write wrapper | **NOT BUILT** | ❌ MISSING |
| `property_info_cache` ↔ `properties` FK | Add `property_info_cache.property_id` | Already existed (reality check found it) | ✅ DONE (pre-existing) |
| LayeredValue extension for property fields | Phase 1 §1.4 | NOT BUILT | ❌ MISSING |
| Phase 1.1 questions (5 disposition items) | All 5 documented + confirmed | 2 of 5 addressed | PARTIAL |

### Phase 1 deviation — `properties_v2` not built

**What the plan calls for:** Create `properties_v2` as a parallel table to `properties`. All new writes target `properties_v2`. In Phase 4, rename to `properties`. This pattern protects existing FKs during migration.

**What was built instead:** Three supporting tables (`property_characteristics`, `property_operating_data`, `property_sales`) added alongside the existing `properties` table. `deals.property_id` FK added pointing directly to the existing `properties` table.

**Impact assessment:**

The `properties` table currently has ~80 FK references from other tables (`building_3d_models`, `calendar_events`, `deal_monthly_actuals`, `deal_properties`, `news_alerts`, `trade_areas`, `traffic_*` tables, etc.). The `properties_v2` pattern was designed to avoid migrating all those FKs before the data is ready.

**Two paths forward:**

**Path A (adopt properties_v2):** Create `properties_v2` now as the plan specifies. Update `deals.property_id` to point to `properties_v2`. Keep `properties` as-is until Phase 4 deprecation. The `property_characteristics`, `property_operating_data`, `property_sales` tables already point to `properties.id` — this FK needs to change to `properties_v2.id`. More migration work but cleaner Phase 4.

**Path B (work with existing properties):** Keep the current approach. `properties` is the identity table; new supporting tables FK to it. During Phase 2, slim `properties` to only identity+immutable fields by deprecating time-varying columns (not dropping — marking as deprecated via comments). Phase 4's "rename properties_v2 → properties" step becomes unnecessary. Less migration work; slightly messier transition because `properties` carries both old and new columns during Phase 2-3.

**Recommendation: Path B.** The `properties` table already has the Phase 1 additions. Reworking the FK on three new tables to point to `properties_v2` creates more migration surface without a clear benefit — the goal (canonical property entity) is achieved either way. Path B requires a scoping adjustment to Phase 4 (no rename needed) and a clear statement that `properties` will be narrowed in-place rather than replaced.

**Operator confirmation needed on Path A vs Path B before Phase 2 starts.**

### Phase 1.1 disposition questions — current status

| Question | Status | Answer / Remaining work |
|---|---|---|
| A. `property_records` vs `property_info_cache` disposition | PARTIAL | Documented in `property-plumbing-field-mapping.md`. Tentative: `property_info_cache` wins. Overlap analysis not yet run. |
| B. `property_sales` stub migration strategy | DONE | Rename + new table approach implemented |
| C. `discovered_properties` mapping | DOCUMENTED | Flagged in field mapping as deferred to Phase 2 |
| D. `county_parcels` / geometry tables disposition | DOCUMENTED | Remain as data sources; not embedded in canonical record |
| E. Parcel ID canonicalization format | OPEN | `parcel_id_canonical` column not added; current `parcel_id` is plain TEXT. Decision deferred. |

### Phase 1 acceptance criteria status

Per `JEDI_RE_PROPERTY_PLUMBING_PHASES.md §1.5`:

- [x] `property_characteristics` exists with target schema
- [x] `property_operating_data` exists with target schema
- [x] `property_sales` (canonical) exists with target schema
- [x] `property_sales_legacy` renamed; 292 rows preserved
- [x] `deals.property_id` column exists (deviation: named `property_id` not `property_id_v2`; FK enforced immediately)
- [ ] **`properties_v2` exists** — NOT BUILT (requires Path A/B decision)
- [ ] `properties_v2.legacy_property_id` column — NOT BUILT
- [ ] `properties_v2.parcel_id_canonical` / `parcel_id_raw` — NOT BUILT
- [ ] Phase 1.1.A documented + operator-confirmed — tentative answer documented, overlap analysis pending
- [ ] Phase 1.1.E (parcel ID canonicalization) — open
- [ ] `PropertyResolverService` — NOT BUILT
- [ ] `DealPropertyLinkService` — NOT BUILT
- [ ] LayeredValue extended for property fields — NOT BUILT
- [ ] Unit tests for all services — NOT BUILT
- [ ] Test fixtures for integration tests — NOT BUILT
- [x] No production reads from new tables
- [x] No production writes to new tables
- [x] Verification protocol Layer 1 check passes (all columns/indexes verified)

**Phase 1 gate: NOT yet passable.** Remaining work before Phase 2: Path A/B decision, `PropertyResolverService`, `DealPropertyLinkService`, Phase 1.1.A overlap analysis, Phase 1.1.E parcel format decision.

---

## PHASE 2 — DUAL-WRITE

**Status:** NOT STARTED — blocked on Phase 1 gate  
**Duration estimate:** 4-5 weeks  
**Prerequisite:** Phase 1 AC all green + Path A/B confirmed

### Pre-Phase 2 verification (§2.1)

Before dual-write activates:
1. Re-verify all Phase 1 AC (query DB, don't trust memory)
2. Grep every write path to old tables — `properties`, `deals`, `recorded_transactions`, `market_sale_comps`, `market_rent_comps`, `comp_properties`, `property_sales_legacy`, `property_records`, `property_info_cache`
3. Map each write path to its new-table dual-write target
4. Build the transactional wrapper

### Write paths to dual-write (§2.2)

| Old write target | New write target | Current volume | Notes |
|---|---|---|---|
| `properties` (insert/update) | `property_characteristics` (time-varying fields) | Low | Research agent, OM parser, manual |
| `deals.address/city/state/lat/lng` | `properties.canonical_address` etc. | Per deal creation | After `deals.property_id` populated |
| `recorded_transactions` | `property_sales` | Effectively zero (12 rows total) | Low priority |
| `property_records` (assessor scrapes) | `property_characteristics` | Per research agent run | Per 1.1.A decision |
| `property_info_cache` (ArcGIS) | `property_characteristics` | Weekly Inngest cron | Already writes 290K rows |
| `georgia_property_sales` (raw county) | `property_sales` | Weekly Inngest cron | 681K rows to backfill |
| `market_sale_comps` | **PAUSED** — writes suspended per sequencing decision | — | Resumes in Phase 5 against `property_sales` |
| `market_rent_comps` | **PAUSED** | — | Resumes in Phase 5 against `property_operating_data` |

### Backfill scripts (§2.3) — planned

1. **Backfill 1 — Identity**: `properties` (1,596) + `property_records` (249K) + `property_info_cache` (290K) → `properties` (narrowed) or `properties_v2` (per Path A/B). One row per unique parcel_id_canonical.
2. **Backfill 2 — Characteristics**: existing time-varying columns from `properties` + `property_info_cache` → `property_characteristics`. One row per property with `effective_from` = data_as_of.
3. **Backfill 3 — Sales history**: `georgia_property_sales` (681K) + `recorded_transactions` (12) + `property_sales_legacy` (292) + `market_sale_comps` (343K currently Cobb) → `property_sales`. Dedup across sources.
4. **Backfill 4 — Operating data**: T12 parses (from `deal_data` JSONB) + rent roll data → `property_operating_data`. M22 actuals with `is_owned = TRUE`.
5. **Backfill 5 — Deal linkage**: Populate `deals.property_id` for all 32 deals from `deal_properties` (27 rows) + `properties.deal_id` (32 rows). Surface conflicts. Acceptance: zero null `deals.property_id`.

### Phase 2 acceptance criteria (§2.5)

- [ ] All production write paths dual-writing (verified by grep + integration test)
- [ ] Zero dual-write failures over 7-day rolling window
- [ ] All 5 backfills complete with spot-check verification
- [ ] All 32 deals have populated `deals.property_id`
- [ ] New `properties` (or `properties_v2`) has ≥ 1,596 rows
- [ ] `property_sales` has ≥ 681K rows (georgia_property_sales backfill)
- [ ] Nightly reconciliation script clean for 5 consecutive nights
- [ ] Verification protocol Layer 2 pass: 50 properties spot-checked

---

## PHASE 3 — READER MIGRATION

**Status:** NOT STARTED  
**Duration estimate:** 6-10 weeks  
**Prerequisite:** Phase 2 AC all green

### Reader migration waves (§3.2)

**Wave 1 — Foundation (weeks 2-3):**
1. `DealService.getProperty(deal_id)` — reads `deals.property_id` → `PropertyService`
2. Cashflow agent's property-info tools — reads from `property_characteristics` via service layer

**Wave 2 — Valuation (weeks 3-5):**
3. Valuation Grid — subject side (reads `PropertyService` instead of `properties` directly)
4. Valuation Grid — comp side (reads `property_sales` instead of `market_sale_comps`)
5. M15 comp services (comp-query, comp-set-discovery)
6. Comp relevance scoring (D-COMP-1, if built)

**Wave 3 — Analytical (weeks 5-7):**
7. F3 Markets module
8. F4 Supply module
9. F6 Traffic module
10. F8 Debt module (lower priority)

**Wave 4 — Strategy-aware (weeks 7-9):**
11. Strategy-aware comp selection (after Wave 2 complete)
12. Strategy projection service

**Wave 5 — Post-close + capsule (weeks 8-10):**
13. M22 post-close → writes `property_operating_data` with `is_owned = TRUE`
14. Deal Capsule rendering
15. Freeze-on-share snapshot

### Migration discipline (per reader, non-negotiable) (§3.3)

For every reader:
1. Feature flag: `use_new_property_schema_<reader_name>` — default off
2. New code path added
3. Shadow comparison runs (old path used; new path runs in parallel; divergences logged) — minimum 1 week
4. Flag on for 10% canary; metrics monitored
5. Flag on for 100%
6. Old code path removed after 30 days stable
7. Verification protocol Layer 1 + Layer 2 documented

### Phase 3 acceptance criteria (§3.4)

- [ ] Every reader migrated; flag at 100%; ≥ 30 days stable
- [ ] Old code paths removed; grep confirms zero reads from old tables
- [ ] Backtest harness re-run; results equivalent or better
- [ ] Bishop end-to-end run equivalent or improved
- [ ] All readers documented in `docs/operations/PROPERTY_REFACTOR_READER_AUDIT.md`

---

## PHASE 4 — OLD-TABLE DEPRECATION

**Status:** NOT STARTED  
**Duration estimate:** 2-4 weeks  
**Prerequisite:** Phase 3 AC all green

### Deprecation order (§4.2-4.4)

1. **Read-only phase (week 1):** Revoke INSERT/UPDATE/DELETE on `properties` (old columns), `recorded_transactions`, `market_sale_comps`, `market_rent_comps`, `comp_properties`, `property_sales_legacy`, `deal_properties`. Hold 7 days; monitor for permission errors.
2. **Archive + drop (weeks 2-3):** Snapshot each table; document in `docs/operations/PROPERTY_REFACTOR_ARCHIVE.md`; drop.
3. **Column cleanup (weeks 3-4) [Path B adjustment]:** If Path B adopted, remove deprecated time-varying columns from `properties` (building_class, units, assessed_value, etc.). These columns remain during Phase 2-3; only removed once readers are fully migrated. No `properties_v2 → properties` rename needed under Path B.

### Phase 4 acceptance criteria (§4.5)

- [ ] All deprecated tables dropped
- [ ] `properties` narrowed to identity + immutable columns only (Path B) OR `properties_v2` renamed to `properties` (Path A)
- [ ] `deals.property_id` is the canonical FK; no reference to `deal_properties` for primary link
- [ ] No permission errors; no orphaned FKs
- [ ] Archive backup confirmed accessible

---

## PHASE 5 — COMP / VALUATION GRID INTEGRATION

**Status:** NOT STARTED  
**Duration estimate:** 2-3 weeks  
**Prerequisite:** Phase 4 AC all green

### What resumes in Phase 5

- **Comp ingestion (paused):** #1477/#1479 Fulton/Gwinnett ingest resume — writing into `property_sales` + `property_characteristics`, not `market_sale_comps`
- **Strategy-aware comp selection:** M15 reads `PropertySalesService.getSalesByCriteria()` with strategy filters
- **Comp-anchored cap rate synthesis (Path B):** Per-comp NOI from `property_operating_data` → implied cap rate → P25/P50/P75 market cap rate → Cap × NOI valuation method
- **Backtest re-run:** S1 deals (Jacksonville, Atlanta ×2); expected ≥ 3 of 5 valuation methods active vs 2 of 5 pre-refactor

### Phase 5 acceptance criteria (§5.5)

- [ ] All 10 original spec acceptance criteria (Part 9) pass
- [ ] Backtest equivalent or better vs pre-refactor baseline
- [ ] No deal returns INSUFFICIENT on subject-side data
- [ ] `property_sales` queryable with 681K+ rows
- [ ] Strategy-aware comp selection producing appropriate sets
- [ ] Comp-anchored cap rate synthesis active and within sanity bounds

---

## IMMEDIATE NEXT STEPS (before Phase 2 can start)

In priority order:

### 1. Path A vs Path B confirmation [OPERATOR DECISION]

Does `properties_v2` need to be created as a parallel table, or do we work with the existing `properties` table (narrowed in-place over Phases 2-4)?

- **Path A:** Create `properties_v2` now; migrate FKs in Phase 4; cleaner Phase 4
- **Path B (recommended):** Work with `properties`; slim it in-place; no rename needed

This decision gates everything. If Path A: `property_characteristics`, `property_operating_data`, `property_sales` FKs need to change from `properties.id` → `properties_v2.id`.

### 2. Phase 1.1.A — `property_records` vs `property_info_cache` overlap analysis

Run the column-by-column comparison. Determine canonical assessor layer. This gates Backfill 1 in Phase 2.

Specifically:
- Distribution of `property_records.enriched_at` — if > 6 months stale, `property_info_cache` wins decisively
- Which fields exist only in `property_records` (class_code, neighborhood_code, parcel dimensions)
- Whether those fields need to be added to `property_info_cache` before it becomes canonical

### 3. Phase 1.1.E — Parcel ID canonicalization format

Decision: add `parcel_id_canonical TEXT` column to `properties` (composite: `<state_fips>-<county_fips>-<county_parcel_id>`) alongside existing `parcel_id`, or leave for Phase 2?

Recommended: decide the format now; add the column now (Phase 1 is still the right time); defer populating it to Phase 2 backfill.

### 4. `PropertyResolverService` + `DealPropertyLinkService`

Two services the spec requires that weren't built:
- `PropertyResolverService`: `resolvePropertyByAddress`, `resolvePropertyByParcel`, `mergeProperties`, `splitProperty`
- `DealPropertyLinkService`: `linkDealToProperty` (dual-write), `resolveDealProperty` (FK-first, fallback to `deal_properties`)

These are needed for Phase 2 dual-write to work correctly.

### 5. LayeredValue extension for property fields

Extend existing `LayeredValue<T>` type to support property field provenance. Add `source_tier` enum. Wire `is_owned` + confidentiality logic into `PropertyOperatingDataService`.

---

## VERIFICATION PROTOCOL APPLICATION (cross-phase)

| Phase | Layer 1 | Layer 2 | Layer 3 |
|---|---|---|---|
| 1 | Tables exist; columns present; services callable | Unit tests pass | n/a |
| 2 | Dual-write writes both; backfill populates expected rows | 50 properties spot-checked correct | n/a |
| 3 | Each reader reads new schema | Reader output equivalent for sample data | Backtest passes |
| 4 | Old tables dropped; renames complete; no orphan refs | No permission errors | Bishop E2E produces expected output |
| 5 | Comp ingestion writes to new schema | Sample comp queries return appropriate sets | Backtest equivalent or better |

---

## ROLLBACK CAPABILITY (cross-phase)

| Phase | Rollback | Cost |
|---|---|---|
| 1 | DROP new tables; no production impact | LOW |
| 2 | Disable dual-write; new tables orphaned; production unchanged | LOW |
| 3 | Feature flag flip per reader; instant per feature | LOW per reader |
| 4 | Restore from archive; high cost, low likelihood | HIGH |
| 5 | Re-enable old code paths (should not be needed) | MEDIUM |

---

## OPEN QUESTIONS LOG

| # | Question | Blocks | Status |
|---|---|---|---|
| OQ-1 | Path A (properties_v2) vs Path B (properties in-place) | Phase 2 start | **NEEDS OPERATOR CONFIRMATION** |
| OQ-2 | `property_records` vs `property_info_cache` canonical assessor layer | Phase 2 Backfill 1 | Partial (tentative: property_info_cache wins; overlap analysis pending) |
| OQ-3 | Parcel ID canonicalization format (composite string format) | Phase 2 Backfill 1 | Open |
| OQ-4 | `discovered_properties` disposition | Phase 2 Backfill 1 | Deferred to Phase 2 |
| OQ-5 | county_parcels / fulton_parcels / fulton_structures disposition | Phase 2 | Documented: remain as data sources |
| OQ-6 | LayeredValue extension design for property fields | Phase 1 completion | Not started |

---

## DOCUMENT HISTORY

| Date | Entry |
|---|---|
| 2026-05-29 | Reality check completed against live schema |
| 2026-05-29 | Phase 1 scope doc produced (property-plumbing-phase1-scope.md) |
| 2026-05-29 | Phase 1 schema DDL executed: property_characteristics, property_operating_data, property_sales, property_sales_legacy rename, deals.property_id, properties identity columns |
| 2026-05-29 | Phase 1 service layer stubs: PropertyCharacteristicsService, PropertyOperatingDataService, PropertySalesService |
| 2026-05-29 | Field mapping doc produced (property-plumbing-field-mapping.md) |
| 2026-05-29 | Implementation map created; deviation from properties_v2 plan flagged |
