# PROPERTY PLUMBING REFACTOR — IMPLEMENTATION MAP

**Document type:** Living implementation tracker  
**Last updated:** 2026-05-29  
**Sources:** `JEDI_RE_PROPERTY_PLUMBING_REFACTOR.md` (decisions) + `JEDI_RE_PROPERTY_PLUMBING_PHASES.md` (phase plan) + `property-plumbing-reality-check.md` (verified state) + Phase 1 work executed 2026-05-29

This document is the canonical source of truth for where the refactor stands. When plan and reality diverge, live state is marked and the plan adjusted here — not absorbed silently.

---

## ARCHITECTURAL COMMITMENTS (locked)

| Decision | Status | Notes |
|---|---|---|
| D1 — Parcel ID as primary identity | LOCKED | `properties.parcel_id` (raw) + `parcel_id_canonical` (normalized, Phase 1b) |
| D2 — Immutable vs time-varying split | LOCKED | `properties` for immutable; `property_characteristics` for time-varying |
| D3 — Four target tables | LOCKED | All four built Phase 1. `property_records` deprecated Phase 4 (per 1.1.A). |
| D4 — `deals.property_id` as canonical FK | LOCKED | Column added Phase 1; dual-write via `DealPropertyLinkService` in Phase 2 |
| D5 — Comp inventory deprecated | LOCKED | `property_sales` canonical; `market_sale_comps` deprecated Phase 4 |
| D6 — Five-phase migration | LOCKED | 14-22 weeks total (Path B adjustment from 16-25) |

**Path B confirmed (2026-05-29):** Work against existing `properties` table in-place. No `properties_v2` parallel table. Phase 4 deprecation is column-level (drop time-varying columns from `properties` after readers migrated) rather than table rename. See Phase 4 notes for the two-window column-drop discipline.

---

## PHASE STATUS OVERVIEW

| Phase | Name | Status | Duration | Gate |
|---|---|---|---|---|
| **1** | Schema Build | **COMPLETE ✅** | 2-3 weeks (actual: 1 day) | All AC met — see §1 |
| **2** | Dual-Write | **COMPLETE ✅** | 4-5 weeks | Phase 1 AC gate (clear) |
| 3 | Reader Migration | IN PROGRESS | 6-10 weeks | Phase 2 AC gate |
| **4** | Old-Table Deprecation | **INFRASTRUCTURE READY ⚙️** | 2-4 weeks | Phase 3 AC gate |
| 5 | Comp / Valuation Grid Integration | NOT STARTED | 2-3 weeks | Phase 4 AC gate |

---

## PHASE 1 — SCHEMA BUILD ✅

### Phase 1.1 — Pre-phase disposition questions (all resolved)

See full analysis in `docs/architecture/property-plumbing-phase1-dispositions.md`.

| Question | Decision |
|---|---|
| A. `property_records` vs `property_info_cache` | `property_info_cache` canonical. `property_records` deprecated Phase 4. 5 columns to migrate: `class_code`, `neighborhood_code`, `tax_district`, `assessor_url`, `property_class`. |
| B. `property_sales` stub strategy | Rename + new table (executed). |
| C. `discovered_properties` | Research agent staging intermediate. All 1,627 rows `unmatched`. No Phase 2 backfill. Kept as-is. |
| D. `county_parcels` / `fulton_parcels` / `fulton_structures` | All three tables have 0 rows. ArcGIS pipeline staging. Not part of canonical schema. |
| E. Parcel ID canonicalization | `parcel_id_canonical TEXT` added to `properties`. Format: `ga-cobb-20001202330`. Populated Phase 2. |

### What was built

**Migrations applied:**
- `20260529_phase1_property_entity_schema.sql` — four new tables, deals.property_id, properties identity columns
- `20260529_phase1b_parcel_id_canonical.sql` — `properties.parcel_id_canonical` column + index

**New schema tables:**

| Table | Cols | Description |
|---|---|---|
| `property_characteristics` | 16 | Time-varying physical state; effective_from/to versioning; source+confidence provenance |
| `property_operating_data` | 20 | Period-specific operating metrics; TTM/monthly/point-in-time; is_owned flag |
| `property_sales` | 24 | Canonical transaction table; implied_cap_rate; multi-source provenance |
| `property_sales_legacy` | 7 | Renamed from old `property_sales` stub; 292 rows preserved |

**Schema changes to existing tables:**

| Table | Column | Change |
|---|---|---|
| `deals` | `property_id UUID FK → properties.id` | Added Phase 1 (nullable) |
| `properties` | `parcel_id_status TEXT` | Added Phase 1 |
| `properties` | `is_superseded BOOLEAN` | Added Phase 1 |
| `properties` | `predecessor_property_id UUID` | Added Phase 1 |
| `properties` | `superseded_at TIMESTAMPTZ` | Added Phase 1 |
| `properties` | `parcel_id_canonical TEXT` | Added Phase 1b; index on non-null values |

**Services built (`backend/src/services/property-entity/`):**

| Service | File | Key methods |
|---|---|---|
| `PropertyCharacteristicsService` | `property-characteristics.service.ts` | `getCurrent`, `getHistory`, `getAsOf`, `create`, `getCurrentBatch` |
| `PropertyOperatingDataService` | `property-operating-data.service.ts` | `getLatestTtm`, `getAll`, `create` |
| `PropertySalesService` | `property-sales.service.ts` | `getSalesForProperty`, `getSalesByCriteria`, `recordSale`, `bulkIngestSales` |
| `PropertyResolverService` | `property-resolver.service.ts` | `resolveByParcel`, `resolveByAddress`, `mergeProperties`, `buildCanonicalParcelId` |
| `DealPropertyLinkService` | `deal-property-link.service.ts` | `resolveDealProperty`, `linkDealToProperty`, `bulkResolveDealProperties`, `getUnlinkedDeals` |

**Drizzle schema:** `backend/src/db/schema/propertyEntity.ts` (exported via `db/schema/index.ts`)

### Phase 1 acceptance criteria — final status

- [x] `property_characteristics` exists with target schema
- [x] `property_operating_data` exists with target schema
- [x] `property_sales` (canonical, 24-col) exists with target schema
- [x] `property_sales_legacy` renamed; 292 rows preserved
- [x] `deals.property_id UUID FK → properties.id` exists (nullable)
- [x] `properties.parcel_id_canonical` exists with index
- [x] `properties.is_superseded`, `predecessor_property_id`, `superseded_at`, `parcel_id_status` exist
- [x] Phase 1.1.A resolved (property_info_cache canonical; documented)
- [x] Phase 1.1.B resolved (rename + new table; executed)
- [x] Phase 1.1.C resolved (discovered_properties stays as staging; no backfill)
- [x] Phase 1.1.D resolved (geometry tables empty; ArcGIS staging only)
- [x] Phase 1.1.E resolved (parcel_id_canonical format: `ga-county-parcelid`; column added)
- [x] `PropertyCharacteristicsService` built
- [x] `PropertyOperatingDataService` built
- [x] `PropertySalesService` built
- [x] `PropertyResolverService` built (resolveByParcel, resolveByAddress, mergeProperties)
- [x] `DealPropertyLinkService` built (dual-write + fallback resolution)
- [x] No production reads from new tables
- [x] No production writes to new tables
- [x] TypeScript compiles clean

**⟹ PHASE 1 GATE: CLEAR. Phase 2 may begin.**

---

## PHASE 2 — DUAL-WRITE

**Status:** SHIPPED (Task #1488) — dual-write active behind `PROPERTY_DUAL_WRITE_ENABLED` flag (default `true`)  
**Duration:** 4-5 weeks  
**Key constraint:** Every dual-write is atomic (both writes or neither). Dual-write failures are P1 — alert on every failure, rollback both writes.

### Phase 2 delivery checklist (Task #1488)

- [x] `property_dual_write_failures` monitoring table (migration `20260529_phase2_dual_write_failures.sql`)
- [x] `PropertyDualWriteService` — central orchestrator with feature flag rollback (`PROPERTY_DUAL_WRITE_ENABLED`)
- [x] Write-path inventory doc: `docs/architecture/property-plumbing-phase2-write-path-inventory.md`
- [x] Georgia ingestion dual-write wired: Cobb, Fulton, Gwinnett, DeKalb (`dualWriteFromInfoCache` + `dualWriteFromGeorgiaSale`)
- [x] Deal creation dual-write wired: `inline-deals.routes.ts` → `dualWriteDealLink` (via `PropertyResolverService.resolveByAddress` → `deals.property_id`)
- [x] Backfill script 1: `backend/scripts/backfill-property-identity.ts`
- [x] Backfill script 2: `backend/scripts/backfill-property-characteristics.ts`
- [x] Backfill script 3: `backend/scripts/backfill-property-sales.ts`
- [x] Backfill script 4: `backend/scripts/backfill-property-operating-data.ts`
- [x] Backfill script 5: `backend/scripts/backfill-deal-property-links.ts`
- [x] Nightly Inngest reconciliation job: `backend/src/inngest/functions/property-reconciliation-nightly.ts`
- [x] `property-entity/index.ts` exports `PropertyDualWriteService`
- [x] No TypeScript errors introduced in Phase 2 files
- [x] Migration applied: 3 new Phase 1+2 migrations (applied 3, skipped 252, failed 0)

### 2.1 Pre-phase verification (before any code ships)

1. Re-verify all Phase 1 AC against live DB (don't trust memory)
2. Grep every write path to old tables:
   - `properties` (insert/update)
   - `deals` (address/city/state/lat/lng fields)
   - `recorded_transactions`
   - `market_sale_comps`, `market_rent_comps`, `comp_properties`
   - `property_records`, `property_info_cache`
   - `georgia_property_sales` (Inngest cron)
3. Map each write path → new-table dual-write target
4. Build the transactional wrapper before enabling any write path

### 2.2 Write paths to dual-write

| Old write target | New write target | Volume | Notes |
|---|---|---|---|
| `properties` (time-varying fields) | `property_characteristics` | Low | Via `PropertyCharacteristicsService.create` |
| `deals.address/city/state/lat/lng` | `properties` (canonical) via `DealPropertyLinkService` | Per deal creation | `linkDealToProperty` handles both FKs |
| `recorded_transactions` | `property_sales` | ~0 (12 rows total) | Low priority |
| `property_info_cache` (ArcGIS cron) | `property_characteristics` | Weekly, 290K rows | After 1.1.A columns added |
| `property_records` (assessor scrapes) | `property_characteristics` | Per research agent run | Deprecated source; dual-write brief |
| `georgia_property_sales` (county cron) | `property_sales` | Weekly Inngest job | 681K rows to also backfill |
| `market_sale_comps` | **PAUSED** (comp ingestion suspended) | — | Resumes Phase 5 against `property_sales` |
| `market_rent_comps` | **PAUSED** | — | Resumes Phase 5 against `property_operating_data` |

### 2.3 Backfill scripts (5 scripts, run in order)

| Script | Source | Target | Row estimate | Notes |
|---|---|---|---|---|
| Backfill 1 — Identity | `properties` (1,596) + `property_info_cache` (290K) + `property_records` (249K) | `properties.parcel_id_canonical` + missing identity fields | ~290K unique | Dedup: parcel_id_canonical exact match = same property. 50-spot-check against county records. |
| Backfill 2 — Characteristics | `properties` time-varying cols + `property_info_cache` | `property_characteristics` | ~290K | One row per property, effective_from = fetched_at/data_as_of |
| Backfill 3 — Sales | `georgia_property_sales` (681K) + `recorded_transactions` (12) + `property_sales_legacy` (292) + `market_sale_comps` (343K, Cobb) | `property_sales` | ~681K deduped | Dedup: same parcel_id + sale_date = one row. 100-spot-check. |
| Backfill 4 — Operating data | T12/rent roll in `deal_data` JSONB + ApartmentIQ | `property_operating_data` | Low | `is_owned = TRUE` for M22 actuals |
| Backfill 5 — Deal linkage | `deal_properties` (27 rows) + `properties.deal_id` (32 rows) | `deals.property_id` | 32 deals | Use `DealPropertyLinkService.getUnlinkedDeals()`. Zero null property_id after. |

**Reconciliation pass after each backfill:** tier authority (operator > deal docs > owned portfolio > public records > third party > inferred) resolves conflicts; material conflicts surface for operator review.

### 2.4 Phase 2 monitoring

Nightly reconciliation script:
- Row count parity between old and new tables (within expected variance)
- 100-row sample nightly, field-level correspondence verified
- Any dual-write failure from prior day surfaced + investigated
- Divergence > tolerance → alert

### 2.5 Phase 2 acceptance criteria

- [ ] All production write paths dual-writing (grep + integration test)
- [ ] Zero dual-write failures over 7-day rolling window
- [ ] All 5 backfills complete with spot-check verification
- [ ] All 32 deals have non-null `deals.property_id` (`DealPropertyLinkService.getUnlinkedDeals()` returns empty)
- [ ] `properties` has ≥ 1,596 rows with parcel_id_canonical populated for known parcels
- [ ] `property_sales` has ≥ 681K rows (georgia_property_sales backfill)
- [ ] Nightly reconciliation script clean for 5 consecutive nights
- [ ] Layer 2 verification: 50 properties spot-checked; new-table data matches source

---

## PHASE 3 — READER MIGRATION

**Status:** IN PROGRESS — Wave 1 started (Task #1489, 2026-05-29)  
**Duration:** 6-10 weeks

### Phase 3 infrastructure delivered (Task #1489)

| Artifact | File | Purpose |
|---|---|---|
| Reader audit | `docs/operations/PROPERTY_REFACTOR_READER_AUDIT.md` | 37 readers catalogued across 5 waves; each with old tables, new path, flag name |
| Feature flags | `backend/src/services/property-entity/phase3-flags.ts` | 37 typed env-var flags; `FlagState = false\|shadow\|canary\|true`; exported from index.ts |
| Shadow logger | `backend/src/services/property-entity/phase3-shadow.service.ts` | Logs old/new divergences to `property_reader_shadow_log`; swallows errors |
| Shadow table | `backend/src/database/migrations/20260529_phase3_reader_shadow_log.sql` | `property_reader_shadow_log` with divergence index; applied 2026-05-29 |
| Wave 1 R-002 | `backend/src/agents/cashflow.inngest.ts` | Entity context step wired: shadow+flag behind `USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT` |
| Wave 1 R-003 | `backend/src/services/document-extraction/data-router.ts` | getOrCreatePropertyForDeal wired: shadow+flag behind `USE_NEW_PROPERTY_SCHEMA_DATA_ROUTER` |

### Migration discipline (non-negotiable per reader)

1. Feature flag created: `USE_NEW_PROPERTY_SCHEMA_<READER_NAME>` — default `false` (OFF)
2. New code path added alongside old
3. Set env to `shadow`: old path serves; new path runs in parallel; divergences written to `property_reader_shadow_log`
4. Shadow clean for ≥ 7 days → set to `canary` (10% of requests use new path)
5. Canary metrics OK → set to `true` (100%)
6. Old code path removed after ≥ 30 days at `true`
7. Verification protocol Layer 1 + Layer 2 documented per reader in `PROPERTY_REFACTOR_READER_AUDIT.md`

### Reader migration waves — current state

**Wave 1 — Foundation (weeks 2-3)**

| Reader | Flag | Status |
|---|---|---|
| R-001: DealService.getProperty / deal resolve | `USE_NEW_PROPERTY_SCHEMA_DEAL_RESOLVE` | IN PROGRESS — `DealPropertyLinkService` already implements new path; remaining callers to be wired |
| R-002: Cashflow Agent entity context | `USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT` | SHADOW READY — wired in cashflow.inngest.ts; set env to `shadow` to begin comparison |
| R-003: Document extraction data-router | `USE_NEW_PROPERTY_SCHEMA_DATA_ROUTER` | SHADOW READY — wired in data-router.ts; set env to `shadow` to begin comparison |
| R-004 through R-007 | (various) | NOT STARTED |

**Wave 2 — Valuation (weeks 3-5)** — NOT STARTED. Gate: Wave 1 shadow ≥ 7 days clean.

| Reader | Flag | New path |
|---|---|---|
| R-008: Valuation Grid subject | `USE_NEW_PROPERTY_SCHEMA_VALUATION_SUBJECT` | `PropertyCharacteristicsService.getCurrent()` |
| R-009: Valuation Grid comps | `USE_NEW_PROPERTY_SCHEMA_VALUATION_COMPS` | `PropertySalesService.getSalesByCriteria()` — **largest behavioral change** |
| R-010: CompSet service | `USE_NEW_PROPERTY_SCHEMA_COMP_SET` | `PropertySalesService` + `PropertyCharacteristicsService` |
| R-011: Comp-query + CompQueryEngine | `USE_NEW_PROPERTY_SCHEMA_COMP_QUERY` | `PropertyCharacteristicsService.getCurrent()` |
| R-012: Comp-set-discovery | `USE_NEW_PROPERTY_SCHEMA_COMP_SET_DISCOVERY` | `property_characteristics` |
| R-013: Georgia sale comps | `USE_NEW_PROPERTY_SCHEMA_GEORGIA_SALE_COMPS` | `PropertySalesService.getSalesByCriteria()` |
| R-014: Correlation engine | `USE_NEW_PROPERTY_SCHEMA_CORRELATION_COMPS` | `PropertySalesService.getSalesByCriteria()` |
| R-015: Comp-dedup/cascade | `USE_NEW_PROPERTY_SCHEMA_COMP_DEDUP` | `PropertySalesService` |
| R-016: Backtest snapshot | `USE_NEW_PROPERTY_SCHEMA_BACKTEST_SNAPSHOT` | `PropertySalesService.getSalesByCriteria()` |
| R-017: Georgia capital tab | `USE_NEW_PROPERTY_SCHEMA_GEORGIA_CAPITAL_TAB` | `PropertySalesService.getSalesByCriteria()` |

**Wave 3 — Analytical (weeks 5-7)** — NOT STARTED. 14 readers (R-018 through R-031). Gate: Wave 2 stable.

**Wave 4 — Strategy-aware (weeks 7-9)** — NOT STARTED. 2 readers (R-033, R-034). Gate: Wave 2 stable.

**Wave 5 — Post-close + capsule (weeks 8-10)** — NOT STARTED. 3 readers (R-035, R-036, R-037).

### Phase 3 acceptance criteria

- [ ] Every reader migrated (R-001 through R-037); flag at `true`; ≥ 30 days stable
- [ ] Old code paths removed; grep confirms zero reads on old tables
- [ ] `property_reader_shadow_log` clean (zero divergences in final 30-day window)
- [ ] Backtest harness re-run; results equivalent or better
- [ ] Bishop end-to-end run equivalent or improved
- [ ] All readers in `docs/operations/PROPERTY_REFACTOR_READER_AUDIT.md` (populated ✅)

### How to begin shadow comparison for R-002

```bash
# Activate shadow mode for Cashflow Agent entity context reader
# This logs divergences without changing what production requests see
export USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT=shadow

# Monitor divergences (run daily)
# Query: SELECT reader_id, COUNT(*) total, COUNT(*) FILTER (WHERE NOT match) diverged
#        FROM property_reader_shadow_log WHERE created_at > NOW() - INTERVAL '7 days'
#        GROUP BY reader_id;

# After 7 days with zero divergences, promote to canary:
export USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT=canary

# After canary metrics OK, promote to 100%:
export USE_NEW_PROPERTY_SCHEMA_CASHFLOW_AGENT=true

# After 30 days at 100% and confirmed stable, remove old code path (Phase 3 Step 7)
```

---

## PHASE 4 — OLD-TABLE DEPRECATION

**Status:** INFRASTRUCTURE READY ⚙️ (Task #1490, 2026-05-29) — Blocked on Phase 3 completion  
**Duration:** 2-4 weeks  
**Gate:** Phase 3 AC gate — all 37 readers at `flag=true` for ≥ 30 days, zero reads from deprecated tables

### Phase 4 infrastructure delivered (Task #1490)

| Artifact | File | Purpose |
|---|---|---|
| Window 1 SQL | `docs/operations/runbooks/phase4/20260529_phase4_window1_write_revoke.sql` | Revoke write permissions on all deprecated tables + time-varying columns. Apply after Phase 3 complete. **Run manually — NOT via drizzle-kit migrate.** |
| Window 2 SQL | `docs/operations/runbooks/phase4/20260529_phase4_window2_read_revoke.sql` | Revoke read permissions. Apply after Window 1 clean for ≥ 7 days. **Run manually.** |
| DROP tables SQL | `docs/operations/runbooks/phase4/20260529_phase4_drop_tables.sql` | Drop all 7 tables in dependency order with FK validation. Apply after Window 2 clean. **Run manually.** |
| DROP columns SQL | `docs/operations/runbooks/phase4/20260529_phase4_drop_columns.sql` | Drop time-varying columns from `properties` in batches. Apply after DROP tables. **Run manually.** |
| Runbook README | `docs/operations/runbooks/phase4/README.md` | Execution guide: order of scripts, how to run manually, archive checklist pointer. |
| Archive registry | `docs/operations/PROPERTY_REFACTOR_ARCHIVE.md` | 7-table archive checklist with verification queries; all 7 must be VERIFIED before DROP. |
| Monitoring guide | `docs/operations/PHASE4_MONITORING.md` | Daily monitoring queries for both windows; response playbook for errors; schedule tracking. |

**Why scripts live outside `backend/src/database/migrations/`:** The project runs `drizzle-kit migrate` which auto-applies all pending SQL files in the migrations directory in lexicographic order. Phase 4 scripts must NOT auto-apply — they require operator confirmation after two 7-day monitoring windows and pg_dump archive verification. Placing them in `docs/operations/runbooks/phase4/` removes them from the auto-migration path entirely.

### Path B column-drop discipline (two 7-day windows — stricter than parallel-table approach)

Under Path B, a missed reader doesn't hit a permission error on the old *table* — it hits a runtime error on a dropped *column*. Cost of miss is higher. Two sequential windows required:

**Window 1 — Write revocation (7 days):**
Revoke INSERT/UPDATE/DELETE on the target columns (or tables where all columns are being dropped).
Monitor for permission errors → surfaces missed writers before columns drop.

**Window 2 — Read revocation (7 days):**
After Window 1 clean: revoke SELECT on target columns.
Monitor for runtime errors → surfaces missed readers before the DROP.

Only after both windows are clean: DROP column (or table).

### Deprecation targets

**Tables to drop (Phase 4) — 7 tables:**

| Table | Row estimate | Replaced by | Dependency note |
|---|---|---|---|
| `deal_properties` | 27 | `deals.property_id` canonical FK | None; drop first |
| `property_sales_legacy` | 292 | `property_sales` (backfilled Phase 2) | None |
| `market_sale_comps` | 343K | `property_sales` | `sale_comp_set_members.market_comp_id` FK — drop col first (in DROP script Step 3) |
| `market_rent_comps` | — | `property_operating_data` | None |
| `comp_properties` | — | `properties` + `property_characteristics` | Drizzle schema in `backend/src/db/schema/unitMix.schema.ts` — remove after DROP |
| `recorded_transactions` | 12 | `property_sales` (source=county_recorded) | None |
| `property_records` | 249K | `property_info_cache` + `property_characteristics` | Largest table; archive required |

**Columns to drop from `properties` (time-varying, migrated to new schema):**

| properties column | Migrated to | Batch |
|---|---|---|
| `building_class` | `property_characteristics.current_building_class` | 1 |
| `units` | `property_characteristics.unit_count` | 1 |
| `building_sf` | `property_characteristics.building_sf` | 1 |
| `current_occupancy` | `property_operating_data.occupancy` | 2 |
| `acquisition_price` | `deals` table (deal-level; not a property field) | 3 |

**Columns retained on `properties` (identity + immutable — not deprecated):**
`id`, `address_line1`, `address_line2`, `city`, `state_code`, `zip`, `lat`, `lng`, `latitude`, `longitude`, `parcel_id`, `parcel_id_canonical`, `parcel_id_status`, `property_type`, `year_built`, `deal_id` (reverse FK, deprecated-in-spirit, retained Phase 5), `owner_name`, `ownership_status`, `msa_id`, `submarket_id`, `is_superseded`, `predecessor_property_id`, `superseded_at`, `created_by`, `created_at`, `updated_at`

**Tables to keep (NOT deprecated):**
- `property_info_cache` — canonical assessor layer; active writes continue
- `county_parcels`, `fulton_parcels`, `fulton_structures` — empty ArcGIS staging; review in Phase 5

### Step 8 — FK constraint cleanup and Drizzle schema update (after DROPs)

After all DROPs are applied, the following Drizzle schema files require update:

1. **`backend/src/db/schema/unitMix.schema.ts`** — remove `compProperties` export and `compUnitTypes` that reference `comp_properties`
2. **Verify** `backend/src/db/schema/index.ts` no longer exports deleted tables
3. **Remove** any remaining TypeScript type references to `DealProperty`, `MarketSaleComp`, `MarketRentComp`, etc. in service files that completed Phase 3 migration

### Archive before drop

Each deprecated table: final snapshot (pg_dump) → verified → documented in `docs/operations/PROPERTY_REFACTOR_ARCHIVE.md` → drop. Keep archives ≥ 1 year.

### Phase 4 acceptance criteria

- [ ] Phase 3 AC gate confirmed before Phase 4 begins
- [ ] Window 1 (write revocation) applied and clean for ≥ 7 days (log in `PHASE4_MONITORING.md`)
- [ ] Window 2 (read revocation) applied and clean for ≥ 7 days
- [ ] All 7 archive entries in `PROPERTY_REFACTOR_ARCHIVE.md` show `ARCHIVE STATUS: VERIFIED`
- [ ] `phase4_drop_tables.sql` applied; all 7 deprecated tables dropped
- [ ] `phase4_drop_columns.sql` applied; `properties` narrowed to identity + immutable columns
- [ ] `deals.property_id` is the sole canonical deal→property FK; `deal_properties` dropped
- [ ] No orphaned FK constraints (verified by DROP script post-flight check)
- [ ] Drizzle schema files updated: `unitMix.schema.ts` `compProperties` export removed
- [ ] Application behavior unchanged after drops (smoke test: valuation grid, cashflow agent, deal list)
- [ ] Archive backup confirmed accessible for each dropped table

---

## PHASE 5 — COMP / VALUATION GRID INTEGRATION

**Status:** NOT STARTED  
**Duration:** 2-3 weeks

### What resumes

- **Comp ingestion (paused):** #1477/#1479 Fulton/Gwinnett ingest resume — writing into `property_sales` + `property_characteristics`, not `market_sale_comps`
- **Strategy-aware comp selection:** M15 reads `PropertySalesService.getSalesByCriteria()` with strategy filters
- **Comp-anchored cap rate (Path B):** Per-comp NOI from `property_operating_data` → implied cap rate → P25/P50/P75 market cap rate → Cap × NOI valuation method
- **Backtest re-run:** S1 deals (Jacksonville, Atlanta ×2); expected ≥ 3 of 5 methods active vs 2 pre-refactor

### Phase 5 acceptance criteria

- [ ] All 10 original spec Part 9 acceptance criteria pass
- [ ] Backtest equivalent or better vs pre-refactor baseline
- [ ] No active deal returns INSUFFICIENT on subject-side data
- [ ] `property_sales` queryable at 681K+ rows
- [ ] Strategy-aware comp selection producing appropriate sets
- [ ] Comp-anchored cap rate synthesis active and within sanity bounds

---

## VERIFICATION PROTOCOL (cross-phase)

| Phase | Layer 1 (exists where it runs) | Layer 2 (correct on real data) | Layer 3 (defensible end-to-end) |
|---|---|---|---|
| 1 ✅ | Tables/cols/services exist — VERIFIED | n/a (no prod data) | n/a |
| 2 | Dual-write actually writes both; backfill populates | 50 properties spot-checked | n/a |
| 3 | Each reader reads new schema | Output equivalent for sample data | Backtest passes |
| 4 | Old tables/columns dropped; no orphan refs | No permission errors; clean app behavior | Bishop E2E produces expected output |
| 5 | Comp ingestion writes new schema; strategy wired | Sample comp queries return appropriate sets | Backtest equivalent or better |

---

## ROLLBACK CAPABILITY (cross-phase)

| Phase | Rollback | Cost |
|---|---|---|
| 1 | DROP new tables; no production impact | LOW |
| 2 | Disable dual-write; new tables orphaned; production unchanged | LOW |
| 3 | Feature flag flip per reader; instant per feature | LOW |
| 4 | Restore from archive; high cost | HIGH — Phase 4 rollback is expensive; verify before each column drop |
| 5 | Re-enable old code paths | MEDIUM |

---

## OPEN QUESTIONS LOG

| # | Question | Blocks | Status |
|---|---|---|---|
| OQ-1 | Path A vs Path B | Phase 2 | ✅ CLOSED — Path B confirmed 2026-05-29 |
| OQ-2 | `property_records` vs `property_info_cache` canonical | Phase 2 Backfill 1 | ✅ CLOSED — `property_info_cache` canonical; 5 columns to migrate |
| OQ-3 | Parcel ID canonicalization format | Phase 2 Backfill 1 | ✅ CLOSED — `ga-county-parcelid`; column added |
| OQ-4 | `discovered_properties` disposition | Phase 2 | ✅ CLOSED — research agent staging; no backfill |
| OQ-5 | `county_parcels` / geometry tables disposition | Phase 2 | ✅ CLOSED — empty ArcGIS staging; not in canonical schema |
| OQ-6 | LayeredValue extension for property fields | Phase 2 service wiring | OPEN — deferred to Phase 2 (needed when services start serving production reads) |

---

## DOCUMENT HISTORY

| Date | Entry |
|---|---|
| 2026-05-29 | Reality check completed against live schema |
| 2026-05-29 | Phase 1 scope doc produced |
| 2026-05-29 | Phase 1 schema DDL executed: property_characteristics, property_operating_data, property_sales, property_sales_legacy rename, deals.property_id, properties identity columns |
| 2026-05-29 | Phase 1 service layer: PropertyCharacteristicsService, PropertyOperatingDataService, PropertySalesService |
| 2026-05-29 | Field mapping doc produced |
| 2026-05-29 | Implementation map v1 created; properties_v2 deviation flagged |
| 2026-05-29 | **Path B confirmed by operator.** Phase plan adjusted: no properties_v2; column-level Phase 4; two 7-day windows; total duration 14-22 weeks |
| 2026-05-29 | Phase 1.1 all five disposition questions resolved; dispositions doc produced |
| 2026-05-29 | Phase 1b migration: properties.parcel_id_canonical column + index |
| 2026-05-29 | Phase 1 complete: PropertyResolverService + DealPropertyLinkService built; index.ts updated |
| 2026-05-29 | **PHASE 1 GATE: CLEAR** |
| 2026-05-29 | **Phase 3 started (Task #1489).** Reader inventory complete: 37 readers across 5 waves. Infrastructure built: phase3-flags.ts (37 flags), phase3-shadow.service.ts, `property_reader_shadow_log` table, index.ts updated. Wave 1 R-002 (cashflow.inngest.ts entity context) + R-003 (data-router.ts) wired with shadow+flag pattern. Implementation map updated. |
| 2026-05-29 | **Phase 4 infrastructure delivered (Task #1490).** All Phase 4 operational scripts placed in `docs/operations/runbooks/phase4/` (outside auto-migration path). Deliverables: (1) `window1_write_revoke.sql` — dynamic role detection, REVOKE write on 7 deprecated tables + 5 time-varying properties columns; (2) `window2_read_revoke.sql` — REVOKE read; (3) `drop_tables.sql` — drops all 7 tables in dependency order, preflight excludes `pg_backend_pid()` to prevent self-match, handles `sale_comp_set_members.market_comp_id` → `market_sale_comps` FK in Step 3; (4) `drop_columns.sql` — drops time-varying columns in 3 batches with property_characteristics row-count guard; (5) `PROPERTY_REFACTOR_ARCHIVE.md` — 7-table archive registry with verification queries; (6) `PHASE4_MONITORING.md` — daily monitoring queries, Window 1/2 daily logs, response playbook, schedule tracking; (7) `runbooks/phase4/README.md` — execution guide. Step 8 Drizzle schema cleanup: `unitMix.schema.ts` `compProperties` export removed after `comp_properties` drop. |
