# PROPERTY PLUMBING — SCHEMA REALITY CHECK

**Generated:** 2026-05-29  
**Method:** Live database queries against current schema  
**Purpose:** Verify spec's assumed-current state before confirming the six architectural decisions

---

## 1. TABLE EXISTENCE

| Table (spec assumption) | Exists? | Rows | Notes |
|---|---|---|---|
| `properties` | YES | 1,596 | 93 cols — far wider than spec assumes |
| `deals` | YES | 32 | 59 cols |
| `recorded_transactions` | YES | 12 | Only 12 rows — effectively empty |
| `parcel_data` | **MISSING** | — | Data is split across `property_records`, `property_info_cache`, `county_parcels` |
| `market_sale_comps` | YES | 343,526 | 39 cols; all Cobb county |
| `market_rent_comps` | YES | 88 | 26 cols |
| `comp_properties` | YES | 5 | 13 cols; nearly empty |
| `property_info_cache` | YES | 290,417 | 64 cols; ArcGIS assessor data |
| `georgia_property_sales` | YES | 681,065 | 17 cols; raw county sales |
| `sale_comp_sets` | YES | 4 | 24 cols |
| `sale_comp_set_members` | YES | **0** | Exists but empty — comp sets not populated |

**Target tables (new schema) — state before Phase 1:**

| Target table | Exists? | Rows | Notes |
|---|---|---|---|
| `property_sales` | **YES — stub** | 292 | Only 7 cols; not the target schema; links to `property_records` not `properties` |
| `property_characteristics` | NO | — | Does not exist |
| `property_operating_data` | NO | — | Does not exist |

**Unlisted tables that handle property data (not mentioned in spec):**

| Table | Rows | What it is |
|---|---|---|
| `property_records` | 249,417 | Assessor records scraped from county sites; 42 cols; `properties.property_record_id` FKs here |
| `discovered_properties` | unknown | 28-col property discovery table from research agent |
| `county_parcels` | unknown | 24-col parcel geometry table |
| `fulton_parcels` | unknown | Fulton-specific parcel table (6 cols) |
| `fulton_structures` | unknown | Fulton structure attributes (8 cols) |

---

## 2. PART 5 FIELD MAPPING REALITY (spec assumptions vs actual columns)

### Building class naming (Decision about canonical name)

| Spec assumes | Actual state |
|---|---|
| `properties.asset_class` | **MISSING** — column does not exist |
| `properties.property_class` | **MISSING** — column does not exist |
| `properties.class` | **MISSING** — column does not exist |
| `properties.building_class` | **EXISTS** ✓ |
| `market_sale_comps.asset_class` | **EXISTS** ✓ |
| `comp_properties.class` | **MISSING** — actual column is `asset_class` |
| `comp_properties.asset_class` | **EXISTS** ✓ |
| `recorded_transactions.property_class` | **EXISTS** ✓ |

**Reality:** The spec overestimates fragmentation on this field. Only two names are in use: `building_class` (on `properties`) and `asset_class` (on comps). `property_class` exists only on `recorded_transactions`.

### Unit count

| Spec assumes | Actual state |
|---|---|
| `properties.units` | **EXISTS** ✓ |
| `comp_properties.units` (via `total_units`) | **EXISTS** as `total_units` ✓ |
| `deals.units` | EXISTS as `unit_count` ✓ |
| `property_info_cache.number_of_units` | **EXISTS** ✓ |

### Sale data

| Spec assumes | Actual state |
|---|---|
| `recorded_transactions.*` → `property_sales.*` | EXISTS but `recorded_transactions` has 12 rows only |
| `market_sale_comps.sale_price` | **EXISTS** ✓ |
| `market_sale_comps.sale_date` | **EXISTS** ✓ |
| `deals.acquisition_price` | EXISTS as `deal_data` JSONB — not a direct column |

### Address fields

| Spec assumes | Actual state |
|---|---|
| `deals.address` | **EXISTS** ✓ (plus `property_address` as a second address column) |
| `deals.city`, `state`, `zip` | city and `state_code` exist; no `zip` column on deals |
| `deals.latitude`, `deals.longitude` | **EXISTS** ✓ |

---

## 3. DEALS ↔ PROPERTIES CARDINALITY (critical divergence)

**Spec assumes:** `deals.property_id UUID FK → properties (REQUIRED)`  
**Reality:** `deals` has **no `property_id` column**.

The actual linkage is three-way and partially contradictory:

| Mechanism | Direction | Rows populated | FK enforced? |
|---|---|---|---|
| `properties.deal_id` | properties → deals (reverse of spec) | 32 / 1,596 properties | No FK constraint |
| `deal_properties` join table | many-to-many, deal_id + property_id | 27 rows | YES — both FKs enforced |
| `properties.property_record_id` | properties → property_records | 1 / 1,596 | YES — FK enforced |

**Join reality:**
- 27 deals are linked to a property via `deal_properties`
- 32 properties have `deal_id` set (the reverse direction)
- 5 deals appear in `deal_properties` but not `properties.deal_id` — or vice versa (relationships are inconsistent across both mechanisms)
- `properties.property_record_id` is set on only 1 of 1,596 properties — the assessor-record join is virtually unused

---

## 4. `property_sales` NAMING COLLISION

**Spec:** defines `property_sales` as the canonical transaction table with ~20 fields (sale_price, sale_date, buyer, seller, deed_type, financing_type, implied_cap_rate, etc.)

**Reality:** `property_sales` already exists with 7 columns and 292 rows:
```
id, parcel_id, sale_year, sale_price, is_current, scraped_at, created_at
```
FK: `property_sales.parcel_id → property_records.parcel_id` (links to assessor records, not to `properties`)

This is a data-scraping stub, not the target schema. **Phase 1 must either rename the existing table or migrate-in-place** — the name is taken but the schema is not the target.

---

## 5. COMP TABLES — DEAL-SCOPED, NOT PROPERTY-SCOPED

A significant structural divergence: all three comp tables have `deal_id` FKs, making comps deal-scoped rather than property-scoped. The spec's Decision 5 (comps are properties + property_sales, no separate comp tables) requires breaking this coupling.

| Table | FK to deals | FK to properties |
|---|---|---|
| `market_sale_comps` | YES — `deal_id → deals.id` | NO |
| `market_rent_comps` | YES — `deal_id → deals.id` | NO |
| `comp_properties` | YES — `deal_id → deals.id` | NO |

`sale_comp_set_members` links to both `market_sale_comps.id` AND `recorded_transactions.id` — two separate comp source tables feeding the same comp set structure.

---

## 6. `property_info_cache` — THE REAL ASSESSOR LAYER

The spec describes `property_info_cache` as a supporting table but underestimates its role. With 290,417 rows and 64 cols, it is the actual comprehensive assessor/parcel data layer:
- Full ownership data (owner_name, mailing address)
- Tax/valuation data (just_value, assessed_value, land_value, building_value)
- Physical characteristics (number_of_units, stories, living_area_sqft, gross_area_sqft, land_sqft)
- Environmental flags (fema_flood_zone, evacuation_zone, wetlands)
- Last sale data (last_sale_date, last_sale_amount)
- Linked to `georgia_property_sales` via `parcel_id`
- **NOT linked to `properties` table by any FK** — no join between the 290K-row assessor cache and the 1,596-row portfolio properties table

---

## 7. SUMMARY — WHERE SPEC MATCHES vs DIVERGES

| Spec assumption | Reality |
|---|---|
| `parcel_data` table exists | DIVERGES — data is in `property_records` + `property_info_cache` + `county_parcels` |
| `properties` is a lean identity table | DIVERGES — it's a 93-col mega-table holding identity + zoning + tax + financial data |
| `deals.property_id` FK exists | DIVERGES — no such column; link goes via `deal_properties` join table + reverse `properties.deal_id` |
| 4 field names for building class | OVERSTATED — only 2 in use (`building_class`, `asset_class`) |
| `property_sales` doesn't exist yet | DIVERGES — exists as 7-col stub, naming collision with target schema |
| `recorded_transactions` is significant | OVERSTATED — only 12 rows, nearly empty |
| Comps are semi-orphaned from properties | CONFIRMED — all comp tables FK to deals, not properties |
| `sale_comp_set_members` is populated | DIVERGES — 0 rows; comp sets exist but have no members |
| `property_info_cache` is a supporting table | UNDERSTATED — it is the primary assessor data layer (290K rows, 64 cols) with no FK link to `properties` |

---

## 8. IMPLICATIONS FOR THE SIX DECISIONS

**Decision 1 (Parcel identity):** Confirmed correct. Three separate parcel ID fields already in use (`properties.parcel_id`, `property_records.parcel_id`, `property_info_cache.parcel_id`, `georgia_property_sales.parcel_id`) — unification around parcel ID is the right call. Composite format (county_code + county_parcel_id) needs confirmation since all four tables store parcel_id as plain TEXT with no county prefix.

**Decision 2 (Immutable vs time-varying):** Confirmed correct. `properties` currently mixes immutable fields (year_built, parcel_id) with time-varying fields (building_class, current_occupancy, assessed_value) in one 93-col table. Split is needed.

**Decision 3 (Four tables):** Confirmed correct, with one complication: a 5th table (`property_records`, 249K rows) needs to be mapped into the target schema — either merged into `properties` (identity layer) or deprecated in favor of `property_info_cache`.

**Decision 4 (Sales vs deals):** Confirmed correct, but starting position is different than assumed. The FK direction currently runs `properties.deal_id → deals` (reverse of target) plus a `deal_properties` join table. Phase 1 needs to add `property_id` to deals and decide which of the two existing link mechanisms to keep during dual-write.

**Decision 5 (Comp inventory):** Confirmed correct and urgent. The comp tables' `deal_id` FK is the root cause of comp data being deal-scoped. `sale_comp_set_members` = 0 rows confirms the comp set infrastructure is unused.

**Decision 6 (Five-phase migration):** Confirmed correct. `property_sales` naming collision and the `property_records` unlisted layer add scope to Phase 1 that wasn't in the spec. Duration estimate of 15-24 weeks is still reasonable but the schema build phase (Phase 1) has more ground to cover.

---

## 9. PHASE 1 ADDITIONAL SCOPE (vs spec)

Items the spec didn't account for that Phase 1 must resolve:

1. **`property_sales` rename** — existing stub table conflicts with target table name; needs migration strategy
2. **`property_records` disposition** — 249K rows of assessor data in an unlisted table; map to `properties` identity layer or deprecate in favor of `property_info_cache`
3. **`property_info_cache` → `properties` join** — 290K rows with no FK link to the 1,596-row portfolio table; establish the parcel_id join so ArcGIS data flows into the canonical property record
4. **`deal_properties` vs `deals.property_id`** — two competing link mechanisms; Phase 1 must choose canonical direction and deprecate the other
5. **`discovered_properties`** (unknown rows) — another unlisted property table from the research agent; needs mapping to `properties` or `property_records`
