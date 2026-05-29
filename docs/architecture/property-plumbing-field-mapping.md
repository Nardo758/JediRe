# PROPERTY PLUMBING — FIELD MAPPING (Part 5 Implementation)

**Phase:** 1 — Schema Build  
**Status:** Draft — complete for core tables; `discovered_properties` disposition TBD  
**Source:** Reality check (property-plumbing-reality-check.md) + live schema inspection  

This is the implementation-specific version of spec Part 5. Every column from every source table maps to a target location in the new schema. Spec Part 5 was conceptual; this is verified against actual column names.

---

## BUILDING CLASS

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `building_class` | `properties` | `current_building_class` | `property_characteristics` | Time-varying; current rating post-renovation |
| `building_class` | `properties` | `original_building_class` | `properties` | Immutable; add column Phase 1 (currently missing) |
| `asset_class` | `market_sale_comps` | `current_building_class` | `property_characteristics` | Via property_id join at sale date |
| `asset_class` | `comp_properties` | `current_building_class` | `property_characteristics` | Via property_id join |
| `property_class` | `recorded_transactions` | `current_building_class` | `property_characteristics` | Rename on migration |
| `class_code` | `property_records` | `original_building_class` (derived) | `properties` | Requires code → A/B/C/D translation |

Canonical names: `original_building_class` on `properties`; `current_building_class` on `property_characteristics`.

---

## UNIT COUNT

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `units` | `properties` | `unit_count` | `property_characteristics` | Move to time-varying; keep on properties as denorm during Phase 2 |
| `unit_count` | `deals` | → via `deals.property_id` | — | Deal-side snapshot; authoritative source is property_characteristics |
| `total_units` | `comp_properties` | `unit_count` | `property_characteristics` | Via property_id at sale/comp date |
| `units` | `market_sale_comps` | `unit_count` | `property_characteristics` | Via property_id join |
| `number_of_units` | `property_info_cache` | `unit_count` | `property_characteristics` | Primary ArcGIS source; Fulton=LivUnits, Gwinnett=NUMDWLG |
| `units` | `property_records` | `unit_count` | `property_characteristics` | Older scrape layer; superseded by property_info_cache where overlap |

---

## SALE DATA

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `sale_price` | `market_sale_comps` | `sale_price` | `property_sales` | Phase 5 migration |
| `sale_date` | `market_sale_comps` | `sale_date` | `property_sales` | Phase 5 migration |
| `price_per_unit` | `market_sale_comps` | `price_per_unit` | `property_sales` | Stored for query speed |
| `price_per_sqft` | `market_sale_comps` | `price_per_sf` | `property_sales` | Rename |
| `cap_rate` | `market_sale_comps` | `implied_cap_rate` | `property_sales` | Rename; source=costar or county depending on `market_sale_comps.source` |
| `buyer` | `market_sale_comps` | `buyer` | `property_sales` | Direct map |
| `seller` | `market_sale_comps` | `seller` | `property_sales` | Direct map |
| `source` | `market_sale_comps` | `source` | `property_sales` | Map: georgia_county → county_recorded; costar_upload → costar |
| `source_id` | `market_sale_comps` | `source_id` | `property_sales` | Direct map |
| `qualified` | `market_sale_comps` | `qualified` | `property_sales` | Direct map |
| `noi` | `market_sale_comps` | → `noi` | `property_operating_data` | Write to pod with period_type=point_in_time at sale_date; link via `related_operating_data_id` |
| `derived_sale_price` | `recorded_transactions` | `sale_price` | `property_sales` | Rename; 12 rows only |
| `recording_date` | `recorded_transactions` | `sale_date` | `property_sales` | Rename |
| `implied_cap_rate` | `recorded_transactions` | `implied_cap_rate` | `property_sales` | Direct map |
| `buyer_name` | `recorded_transactions` | `buyer` | `property_sales` | Rename |
| `seller_name` | `recorded_transactions` | `seller` | `property_sales` | Rename |
| `sale_price` | `georgia_property_sales` | `sale_price` | `property_sales` | Already promoted into market_sale_comps via promoteGeorgiaSales; avoid double-write |
| `sale_price` | `property_sales_legacy` | `sale_price` | `property_sales` | Migrate 292 rows; link to property via parcel_id → property_records → properties join |
| `is_current` | `property_sales_legacy` | — | — | No equivalent in target; recency expressed by sale_date ordering |

---

## PHYSICAL CHARACTERISTICS (sqft, stories, year built, lot)

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `sqft` / `building_sf` | `properties` | `building_sf` | `property_characteristics` | Canonical name: building_sf |
| `sqft` | `market_sale_comps` | `building_sf` | `property_characteristics` | At sale date |
| `building_sf` | `recorded_transactions` | `building_sf` | `property_characteristics` | At recording date |
| `living_area_sqft` | `property_info_cache` | `building_sf` | `property_characteristics` | ArcGIS primary source |
| `living_area_sqft` | `property_records` | `building_sf` | `property_characteristics` | Older layer; use property_info_cache if overlap |
| `stories` | `properties` | `num_stories` | `properties` | Immutable (original construction) |
| `stories` | `market_sale_comps` | — | — | Read from property_characteristics at sale date |
| `stories` | `property_info_cache` | `num_stories` | `properties` | ArcGIS source |
| `year_built` | `properties` | `year_built` | `properties` | Immutable |
| `year_built` | `market_sale_comps` | `year_built` | `properties` | Reconcile with existing; county wins |
| `year_built` | `property_info_cache` | `year_built` | `properties` | ArcGIS source (authoritative) |
| `year_built` | `property_records` | `year_built` | `properties` | Older scrape |
| `lot_acres` / `lot_size_acres` | `properties` | `land_sf` (derived) | `properties` | Convert: acres × 43,560 |
| `lot_size_sqft` | `properties` | `land_sf` | `properties` | Direct |
| `land_sqft` | `property_info_cache` | `land_sf` | `properties` | ArcGIS source |
| `acres` | `property_info_cache` | — | — | land_sf is canonical; acres derivable |

---

## ADDRESS / LOCATION

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `address` / `address_line1` | `properties` | `canonical_address` | `properties` | Normalize via address normalization service |
| `address` / `property_address` | `deals` | → `properties.canonical_address` | — | Deal references property; address lives on property |
| `city` | `deals` | `city` | `properties` | Move to property |
| `state_code` | `deals` | `state` | `properties` | Rename |
| `latitude` / `longitude` | `deals` | `latitude` / `longitude` | `properties` | Move to property |
| `lat` / `lng` | `properties` | `latitude` / `longitude` | `properties` | Normalize column names (both exist; pick one pair) |
| `address` | `market_sale_comps` | → `canonical_address` | `properties` | Via property linkage |
| `address` | `property_records` | `canonical_address` | `properties` | Assessor address |
| `address` | `property_info_cache` | `canonical_address` | `properties` | ArcGIS address |

---

## TAX / VALUATION

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `assessed_value` / `appraised_value` | `properties` | — | — | Move to `property_characteristics` with effective_from = tax year |
| `assessed_value` / `just_value` | `property_info_cache` | same | `property_characteristics` | ArcGIS authoritative |
| `assessed_value` | `property_records` | same | `property_characteristics` | Older layer |
| `annual_taxes` / `millage_rate` | `properties` | → `property_operating_data.opex_by_line['taxes']` | `property_operating_data` | Property tax is an operating expense |

---

## OPERATING DATA

| Source column | Source table | Target table | Notes |
|---|---|---|---|
| T12 parser output | `deal_data` JSONB on `deals` | `property_operating_data` | `source='t12'`, `period_type='ttm'` |
| Rent roll parser output | `rent_roll` table | `property_operating_data` | `source='rent_roll'`, `period_type='monthly'` |
| `avg_asking_rent` | `market_rent_comps` | `property_operating_data` | `source='costar'`, `period_type='point_in_time'` |
| `occupancy_pct` | `market_rent_comps` | `property_operating_data` | same |
| M22 monthly actuals | `operations_actuals` | `property_operating_data` | `source='operator'`, `is_owned=TRUE` |

---

## OWNER / IDENTITY

| Source column | Source table | Target column | Target table | Notes |
|---|---|---|---|---|
| `legal_owner` | `properties` | — | — | Move to `property_characteristics` (ownership changes) |
| `owner_name` | `property_records` | — | `property_characteristics` | With effective_from = deed date |
| `owner_name` | `property_info_cache` | — | `property_characteristics` | ArcGIS authoritative |
| `parcel_id` | `properties` | `parcel_id` | `properties` | Already exists; add composite format in Phase 1 |
| `county_pin` | `properties` | `parcel_id` (alt) | `properties` | Reconcile with parcel_id; may be same field |
| `parcel_id` | `property_records` | `parcel_id` | `properties` | Via property_record → property join |
| `parcel_id` | `property_info_cache` | `parcel_id` | `properties` | Via property_info_cache → property join |

---

## COLUMNS BEING DROPPED / NOT MIGRATED

| Column | Table | Reason |
|---|---|---|
| `deal_id` | `market_sale_comps` | Comps become property-scoped, not deal-scoped (Phase 5) |
| `deal_id` | `market_rent_comps` | Same |
| `deal_id` | `comp_properties` | Same |
| `is_current` | `property_sales_legacy` | Recency expressed by sale_date ordering in property_sales |
| `file_id` | `market_sale_comps` | CoStar upload provenance; move to `source_id` + `source='costar'` |
| `source_page` | `market_sale_comps` | CoStar file pagination detail; not meaningful in target model |
| `deal_id` on `properties` | `properties` | Reverse FK (wrong direction per D4); removed in Phase 4 |

---

## OPEN — `discovered_properties` DISPOSITION

28-col research agent output table. Needs audit before Phase 2 backfill.  
Working hypothesis: rows with `match_status='confirmed'` → `properties` (new portfolio discoveries).  
Assessor fields (just_value, building_value, owner) → `property_info_cache` or `property_characteristics`.  
**Decision: document during Phase 1; no data movement until Phase 2.**

---

## OPEN — `property_records` vs `property_info_cache` OVERLAP

Column-by-column comparison to run during Phase 1:
- Both have: parcel_id, address, city, state, county, year_built, units, building_sqft, assessed_value, owner_name
- `property_info_cache` adds: environmental (FEMA, flood, evacuation), census tract, subdivision, extra_feature_value, unit_mix, number_of_buildings, effective_year_built
- `property_records` adds: class_code, neighborhood_code, land_use_code, parcel_area_sqft, parcel_perimeter_ft, legal_owner
- Active ingestion target: `property_info_cache` (all ArcGIS writes go here)
- `property_records` last enriched: check `enriched_at` column distribution

**Tentative decision: `property_info_cache` is canonical assessor layer. `property_records` fields not in `property_info_cache` (class_code, neighborhood_code, parcel dimensions) get added to `property_info_cache` in Phase 2, then `property_records` deprecated.**
