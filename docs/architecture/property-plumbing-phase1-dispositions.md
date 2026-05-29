# PHASE 1.1 — DISPOSITION DECISIONS (VERIFIED)

**Date:** 2026-05-29  
**Method:** Live database queries against current schema  
**Status:** All five questions resolved. Phase 1 gate cleared on these items.

---

## A. `property_records` vs `property_info_cache` — canonical assessor layer

**Decision: `property_info_cache` is the canonical assessor layer. `property_records` is deprecated in Phase 4.**

**Evidence:**

| Dimension | `property_records` | `property_info_cache` |
|---|---|---|
| Rows | 249,417 | 290,417 |
| `enriched_at` populated | 1 of 249,417 | N/A |
| `fetched_at` populated | N/A | 290,417 of 290,417 |
| Oldest fetch | 2026-03-20 (1 row) | 2026-04-25 |
| Newest fetch | 2026-03-20 | 2026-05-23 |
| Active ingestion target | No | YES (all ArcGIS writes) |

`property_records` is a stale scrape from March 2026. Exactly 1 of its 249,417 rows has an `enriched_at` value. The table is not actively maintained. `property_info_cache` is fully populated, actively refreshed (newest fetch: 2026-05-23), and is already the target for all ArcGIS ingest.

**Columns in `property_records` NOT in `property_info_cache` (add to `property_info_cache` in Phase 2):**

| `property_records` column | Value | Add to `property_info_cache`? |
|---|---|---|
| `class_code` | Building classification code | YES — `property_info_cache` only has `land_use_code` |
| `neighborhood_code` | Assessor neighborhood code | YES — useful for comp relevance |
| `tax_district` | Tax authority string | YES — currently missing |
| `parcel_area_sqft` | Lot area in SF | SKIP — `property_info_cache` has `land_sqft` |
| `parcel_perimeter_ft` | Lot perimeter | SKIP — not needed |
| `tax_year` | Assessment year | SKIP — implied by `fetched_at` |
| `assessor_url` | Source URL | YES — provenance |
| `photos` | JSONB photo array | SKIP — no photo system yet |
| `property_class` | A/B/C/D string | YES — `class_code` equivalent |

**Phase 2 action:** Add `class_code`, `neighborhood_code`, `tax_district`, `assessor_url`, `property_class` columns to `property_info_cache` via migration. Backfill from `property_records` by parcel_id join.

**`property_records` → deprecated in Phase 4** after backfill confirms all useful columns migrated.

---

## B. `property_sales` stub migration strategy

**Decision: DONE (executed 2026-05-29)**

Rename approach implemented:
- `property_sales` (7-col stub, 292 rows) → renamed to `property_sales_legacy`
- New `property_sales` (24-col canonical table) created

---

## C. `discovered_properties` disposition

**Decision: Keep as research agent intermediate. No Phase 2 backfill. Not part of canonical schema.**

**Evidence:**
- 1,627 rows; ALL with `match_status = 'unmatched'`
- No confirmed matches; `matched_by`, `match_confidence` all null
- `apartment_locator_id` field suggests source is apartment listing discovery pipeline
- Table has `matched_at`, `matched_by`, `match_confidence` columns — built to receive matches but none have been written

Since every row is `match_status = 'unmatched'`, there is no confirmed data to backfill into `properties`. The table is the research agent's working queue for candidate properties before they are confirmed.

**Going forward:** When research agent confirms a match (`match_status → confirmed`), that row should flow into `properties` via `PropertyResolverService.resolvePropertyByAddress` or `resolvePropertyByParcel`. The `discovered_properties` table remains the staging area; it is not part of the canonical schema. No deprecation needed — it serves a different purpose.

---

## D. `county_parcels`, `fulton_parcels`, `fulton_structures` disposition

**Decision: All three tables are empty staging tables. They remain as ArcGIS pipeline staging; not part of canonical schema.**

**Evidence:**
- `county_parcels`: 0 rows (24 cols)
- `fulton_parcels`: 0 rows (6 cols)
- `fulton_structures`: 0 rows (8 cols)

These tables were created for the Fulton ArcGIS ingest pipeline (Task #1477). The ingest writes to `property_info_cache` directly; these staging tables were either bypassed or not yet populated. They are not part of the canonical property entity model — they are intermediate staging for raw ArcGIS geometry data before it becomes assessor records.

**Going forward:** These tables remain as ArcGIS pipeline staging infrastructure. They may be populated during Phase 5 when comp ingestion resumes. They are not referenced by any new service and do not need to be migrated or deprecated as part of this refactor.

---

## E. Parcel ID canonicalization format

**Decision: Add `parcel_id_canonical` TEXT column to `properties`. Format: `<state_lower>-<county_lower>-<raw_parcel_id>`. Column added empty in Phase 1; populated during Phase 2 backfill.**

**Evidence — current parcel_id formats across tables:**

| Table | Example parcel_ids | Format |
|---|---|---|
| `properties` | `17-0148-LL-005-7`, `74434328170000010` | County-specific, no prefix |
| `property_records` | `FULTON-22 481411970839`, `highlands-2789-satellite` | Inconsistent prefixes |
| `property_info_cache` | `20001202330`, `20000802550` | Numeric, Cobb format |
| `georgia_property_sales` | `20001602410` | Numeric, Cobb format |

Parcel ID format is fundamentally county-specific. No universal normalization exists. The canonical format adds a deterministic prefix:

**`<state_lower>-<county_lower>-<county_parcel_id_trimmed>`**

Examples:
- Cobb: `ga-cobb-20001202330`
- Fulton: `ga-fulton-22481411970839`
- Gwinnett: `ga-gwinnett-<gwinnett_parcel_id>`

**Why not FIPS?** FIPS codes (13-067, 13-121) are authoritative but opaque. Human-readable county names (`ga-cobb`) are equally unambiguous and easier to inspect and debug. The format is stable — county names don't change.

**Normalization rules for Phase 2 backfill script:**
1. Strip existing non-canonical prefixes from `property_records` (e.g., remove `FULTON-22 ` prefix)
2. Lowercase and trim the raw parcel_id
3. Prefix with `<state>-<county>`
4. Store in `parcel_id_canonical`; leave `parcel_id` column (raw) untouched

**`parcel_id_canonical` column:** Added to `properties` in Phase 1 migration (below). NOT added to `property_info_cache`, `property_records`, or `georgia_property_sales` — those tables link to `properties` via parcel_id join; the canonical version lives only on the entity table.

---

## PHASE 1.1 GATE STATUS

| Question | Status | Decision |
|---|---|---|
| A. property_records vs property_info_cache | ✅ RESOLVED | `property_info_cache` canonical; `property_records` deprecated Phase 4 |
| B. property_sales stub migration | ✅ RESOLVED | Rename + new table (executed) |
| C. discovered_properties | ✅ RESOLVED | Research agent staging; no backfill; keep as-is |
| D. county_parcels / fulton geometry tables | ✅ RESOLVED | Empty staging; not part of canonical schema |
| E. Parcel ID canonicalization | ✅ RESOLVED | `parcel_id_canonical` column added Phase 1; format `ga-county-parcelid`; filled Phase 2 |

**All five resolved. Phase 1.1 gate: CLEAR.**
