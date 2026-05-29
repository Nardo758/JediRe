# Phase 2 — Write-Path Inventory

**Date:** 2026-05-29  
**Method:** grep + live code inspection  
**Purpose:** Every write path to old property tables is documented here before any dual-write code ships. Maps old table → new table dual-write target.

---

## Summary

| Old Table | New Table | Volume | Dual-Write Status |
|---|---|---|---|
| `property_info_cache` | `property_characteristics` | 290K rows (weekly refresh) | WIRED — Georgia ingestion services |
| `georgia_property_sales` | `property_sales` | 681K+ rows (weekly refresh) | WIRED — Georgia ingestion services |
| `properties` (deal creation stub) | `properties` (canonical via `PropertyResolverService`) → `deals.property_id` | Per deal | WIRED — inline-deals.routes.ts D-DEAL-1 |
| `property_records` | `property_characteristics` | ~249K (legacy, infrequent) | STUB — deprecated source; dual-write logs "paused" |
| `recorded_transactions` | `property_sales` | 12 rows total | DEPRECATED — no active write path; legacy data |
| `market_sale_comps` | PAUSED | 343K (Cobb) | PAUSED per spec — resumes Phase 5 |
| `market_rent_comps` | PAUSED | — | PAUSED per spec — resumes Phase 5 |

---

## Write Paths — Detail

### 1. `property_info_cache` → `property_characteristics`

**Source services (all 4 wired):**

| Service | Method | How dual-write fires |
|---|---|---|
| `cobb-ingestion.service.ts` | `saveProperty()` | After INSERT INTO property_info_cache, calls `propertyDualWriteService.dualWriteFromInfoCache()` |
| `fulton-ingestion.service.ts` | `saveProperty()` | Same pattern |
| `gwinnett-ingestion.service.ts` | `saveProperty()` | Same pattern |
| `dekalb-ingestion.service.ts` | `saveProperty()` | Same pattern |

**Field mapping:**

| `property_info_cache` field | `property_characteristics` field |
|---|---|
| `parcel_id` + `county` + `state` | → resolved to `property_id` via `PropertyResolverService.resolveByParcel` |
| `fetched_at` | → `effective_from` |
| `number_of_units` | → `unit_count` |
| `living_area_sqft` | → `building_sf` |
| `year_built` | → provenance JSONB |
| `land_use_code` | → provenance JSONB |
| `property_type` | → provenance JSONB |
| provider | → `source` = `'county'` |
| — | `confidence` = 0.85 |

---

### 2. `georgia_property_sales` → `property_sales`

**Source services (all 4 wired):**

| Service | Method | How dual-write fires |
|---|---|---|
| `cobb-ingestion.service.ts` | `saveSales()` | After INSERT INTO georgia_property_sales, calls `propertyDualWriteService.dualWriteFromGeorgiaSale()` |
| `fulton-ingestion.service.ts` | `saveSales()` | Same pattern |
| `gwinnett-ingestion.service.ts` | `saveSales()` | Same pattern |
| `dekalb-ingestion.service.ts` | `saveSales()` | Same pattern |

**Field mapping:**

| `georgia_property_sales` field | `property_sales` field |
|---|---|
| `parcel_id` + `county` + `state` | → resolved to `property_id` |
| `sale_date` | → `sale_date` |
| `sale_price` | → `sale_price` |
| `sale_type` | → `deed_type` |
| `qualified` | → `qualified` |
| `instrument_type` | → provenance JSONB |
| `grantor_name` | → `seller` |
| `provider` | → `source_id` prefix |
| — | `source` = `'county_recorded'` |
| — | `confidence` = 0.80 |

---

### 3. `properties` + `deals.property_id` — Deal creation

**Write path:** `inline-deals.routes.ts` D-DEAL-1 (POST /api/v1/deals)

1. Step A: `UPDATE properties SET deal_id = $1 WHERE address_line1 = $6` — link by address
2. Step B: `INSERT INTO properties (deal_id, ...)` — stub row if no address match

**Dual-write addition (wired):**
After Step A or B completes, call `dealPropertyLinkService.linkDealToProperty(dealId, propertyId)`.
This writes `deals.property_id` atomically.

---

### 4. `property_records` (deprecated) — STUB

**Active write paths found:**
- `backend/scripts/import-county-properties.ts` — bulk county import script (not a cron, manually run)
- `backend/src/api/rest/property.routes.ts` — POST /api/v1/properties creates a property_records row
- `backend/src/services/atlanta-url-discovery.service.ts` — UPDATE property_records.assessor_url

**Dual-write:** Stubs are in `PropertyDualWriteService.dualWriteFromPropertyRecord()` — logs "paused: property_records is a deprecated source; Backfill 2 will populate property_characteristics from existing rows." Does NOT write.

**Rationale:** `property_records` is deprecated per 1.1.A. All 249K rows predate Phase 2 and are backfilled by Backfill 2 from `property_info_cache`. New writes to `property_records` are rare (manual scripts) and the table will be dropped in Phase 4.

---

### 5. `recorded_transactions` — DEPRECATED

No active INSERT path was found in the codebase. The ingestion script (`ingest-recorder-transactions.ts`) was rerouted to `market_sale_comps` and a `vw_recorded_transactions_compat` view replaced the table (per migration 20260528_recorder_to_market_sale_comps.sql). The 12 existing rows are handled by Backfill 3.

---

### 6. `market_sale_comps`, `market_rent_comps` — PAUSED

Per sequencing decision: comp ingestion paths are paused. Dual-write stubs exist in `PropertyDualWriteService` but do not write. Log message: "paused: comp ingestion dual-write resumes Phase 5."

---

## Write Paths NOT Dual-Written (rationale)

| Path | Reason |
|---|---|
| `deals` (most UPDATE paths) | Only address/city/state/lat/lng fields are property-relevant; those come through D-DEAL-1 or enrichment, both of which are already covered |
| `properties` (many UPDATE paths: benchmark enrichment, supply, forward supply, subject population) | These update non-identity fields (website, lat/lng updates post-geocode, supply metrics). Phase 3 reader migration will consume `properties` directly for these. |
| `apartment-locator-sync.service.ts` | Updates supply data in `properties`; not property entity identity data; Phase 3 concern |
| `deal-assumptions.routes.ts` | Updates `properties` for acres, lot_size; not characteristics schema fields |
| `property-analytics.routes.ts` | Updates `properties.website`; not a characteristics field |
| `data-router.ts` | Updates/inserts `properties` during document extraction; complex path; Phase 3 migration |
| `atlanta-url-discovery.service.ts` | Updates `property_records.assessor_url`; deprecated table; Backfill 2 handles |

---

## Dual-Write Failure Monitoring

All dual-write failures are logged to `property_dual_write_failures` table (created in Phase 2 migration).

- **Alert threshold:** Any unresolved failure > 24h → nightly reconciliation surfaces it
- **Rollback:** Set `PROPERTY_DUAL_WRITE_ENABLED=false` in env to disable all new-table writes instantly; old table writes continue unaffected
- **P1 policy:** Any new failure is investigated within 24h

---

## Acceptance Gate

Phase 2 acceptance criteria (from implementation map §2.5) are validated by:
1. This inventory document (write paths covered)
2. `scripts/backfill-*.ts` run results (row counts)
3. Nightly reconciliation clean for 5 consecutive nights
4. `DealPropertyLinkService.getUnlinkedDeals()` returning empty
