# Comp Profiles Spec — Sale & Rent Comp Standardization

**Status:** ACCEPTED  
**Date:** 2026-05-28  
**Task:** #1377  
**Context doc:** `docs/operations/SESSION_CLOSE_VALUATION_GRID.md` — Commit 3

---

## 1. Background & Problem Statement

The platform has accumulated comp data across 9 tables with inconsistent schemas, no shared identity contract, and four different column names for asset classification:

| Surface | Tables |
|---|---|
| Sale-related | `market_sale_comps`, `recorded_transactions`, `deal_comp_sets`, `comp_properties`, `sale_comp_sets` |
| Rent-related | `market_rent_comps`, `apartment_rent_comps`, `apartment_locator_properties`, `apartment_class_rent_snapshots` |
| Class column variants | `asset_class` (market_sale_comps, market_rent_comps, apartment_class_rent_snapshots), `comp_asset_class` (competitive_sets), `class` (comp_properties, deal_comp_sets), `class_code` (deal_comp_sets), *(absent)* (recorded_transactions, apartment_locator_properties) |

Downstream features — Valuation Grid (Task #1370), comp-anchored cap rate synthesis (SESSION_CLOSE Commit 1), rent benchmarking — cannot reason consistently across these surfaces without a canonical profile that defines exactly what fields mean, which sources are authoritative, and how quality is graded.

---

## 2. Canonical Class Column Decision

**Decision: `asset_class TEXT` is the canonical column name across all comp tables.**

Rationale:
- Already used in `market_sale_comps`, `market_rent_comps`, and `apartment_class_rent_snapshots` — the three tables with the largest row counts and clearest ETL ownership.
- `comp_asset_class` (competitive_sets), `class` (comp_properties, deal_comp_sets), and `class_code` (deal_comp_sets) are non-canonical; see migration plan in Section 5.

**Canonical values:** `'A'`, `'B'`, `'C'`, `'D'` (single character, uppercase). A `CHAR(1)` CHECK constraint is preferred on new tables; existing TEXT columns should enforce via application-layer validation.

**Vocabulary mapping for ingest:**

| Source label | Canonical `asset_class` |
|---|---|
| `Class A`, `A`, `a` | `A` |
| `Class B`, `B`, `b` | `B` |
| `Class C`, `C`, `c` | `C` |
| `Class D`, `D`, `d` | `D` |
| Anything else / blank | `NULL` (do not default) |

---

## 3. Sale Comp Profile

### 3.1 Profile Definition

A **Sale Comp** represents a single arm's-length transaction of a multifamily (or comparable) property. It anchors price discovery for the Valuation Grid's PPU, PSF, and implied cap rate methods.

### 3.2 Required Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Internal surrogate key |
| `address` | TEXT | Street address — normalized, not null |
| `city` | TEXT | Municipality |
| `state` | TEXT | Two-letter state code |
| `sale_date` | DATE | Date of recorded sale / closing |
| `sale_price` | NUMERIC | Total consideration in USD |
| `source` | TEXT | Provenance enum (see §3.4) |
| `asset_class` | TEXT | Canonical class (`A`/`B`/`C`/`D`); NULL allowed when unknown |

### 3.3 Optional Fields

| Field | Type | Description |
|---|---|---|
| `property_name` | TEXT | Building trade name |
| `zip` | TEXT | Postal code |
| `county` | TEXT | County name |
| `msa` | TEXT | MSA label (e.g. `"Atlanta-Sandy Springs-Alpharetta"`) |
| `submarket` | TEXT | CoStar or internal submarket label |
| `property_type` | TEXT | Default `'multifamily'`; also `'mixed_use'`, `'industrial'`, etc. |
| `units` | INTEGER | Total residential unit count |
| `sqft` | INTEGER | Gross building area in square feet |
| `year_built` | INTEGER | Original construction year |
| `stories` | INTEGER | Number of floors |
| `buyer` | TEXT | Acquirer name |
| `buyer_type` | TEXT | `'institutional'` \| `'private'` \| `'syndicator'` \| `'reit'` \| `'developer'` |
| `seller` | TEXT | Seller name |
| `broker` | TEXT | Listing/selling broker |
| `financing_type` | TEXT | `'conventional'` \| `'agency'` \| `'seller_carry'` \| `'cash'` \| `'unknown'` |
| `deed_type` | TEXT | `'warranty'` \| `'quitclaim'` \| `'special_warranty'` \| `'other'` |
| `cap_rate` | NUMERIC | Reported going-in cap rate (%) — not synthesized |
| `gross_rent_at_sale` | NUMERIC | Annual gross rent collected at time of sale (USD) |
| `gross_income_at_sale` | NUMERIC | Effective gross income at time of sale (USD) |
| `noi_at_sale` | NUMERIC | Net operating income at time of sale (USD) |
| `occupancy_at_sale` | NUMERIC | Occupancy percentage at time of sale |
| `latitude` | NUMERIC | WGS-84 latitude |
| `longitude` | NUMERIC | WGS-84 longitude |
| `source_id` | TEXT | Source system's own identifier (for dedup / upsert) |
| `source_page` | INTEGER | Page number in uploaded file (for file-backed sources) |
| `file_id` | UUID | FK to `deal_files` when record originates from an upload |
| `qualified` | BOOLEAN | `true` = arm's-length, `false` = distressed/related-party/foreclosure |

### 3.4 Derived Fields

Computed at query time; never stored unless denormalized for performance.

| Derived field | Formula |
|---|---|
| `price_per_unit` | `sale_price / units` |
| `price_per_sqft` | `sale_price / sqft` |
| `implied_cap_rate` | `noi_at_sale / sale_price * 100` — only when `noi_at_sale` is present |
| `vintage_band` | 5-year bucket: `year_built - (year_built % 5)` → e.g. `2000`, `2005`, `2010` |
| `age_at_sale` | `EXTRACT(YEAR FROM sale_date) - year_built` |
| `months_since_sale` | `(NOW() - sale_date) / 30` |

### 3.5 Source Provenance Enum

```
'county_recorded'    -- Scraped from county recorder / tax deed database
'costar_upload'      -- Operator-uploaded CoStar export (CSV/XLSX)
'broker_package'     -- Extracted from broker OM or deal package (PDF extraction)
'operator_entry'     -- Manually entered by analyst in the platform UI
'attom'              -- ATTOM Data Solutions API
'research_agent'     -- Platform research agent automated pull
```

### 3.6 Quality Score Definition

Quality score is a 0–100 integer calculated per-comp against a **subject deal**. Higher = more comparable. Used to weight comp influence in Valuation Grid aggregations.

| Dimension | Max pts | Scoring rule |
|---|---|---|
| **Recency** | 30 | ≤6 months: 30 \| ≤12 months: 25 \| ≤24 months: 15 \| ≤36 months: 5 \| >36 months: 0 |
| **Distance to subject** | 25 | ≤0.5 mi: 25 \| ≤1 mi: 20 \| ≤2 mi: 15 \| ≤5 mi: 10 \| ≤10 mi: 5 \| >10 mi: 0 |
| **Asset class match** | 20 | Exact match: 20 \| Adjacent class (e.g. A vs B): 10 \| Two classes apart: 0 |
| **Size proximity** | 15 | Units within ±20%: 15 \| ±40%: 10 \| ±60%: 5 \| >60%: 0 |
| **Arm's-length** | 10 | `qualified = true`: 10 \| `qualified = false` or unknown: 0 |

**Quality tiers:**

| Score | Tier | Usage |
|---|---|---|
| 70–100 | Tier 1 — Primary | Weighted into P25/P50/P75 distribution |
| 40–69 | Tier 2 — Secondary | Included in range but flagged in evidence trail |
| <40 | Tier 3 — Informational | Shown in raw comp table; excluded from aggregation |

---

## 4. Rent Comp Profile

### 4.1 Profile Definition

A **Rent Comp** represents a property-level rent snapshot at a point in time. It anchors the Valuation Grid's rent assumption layer, market rent benchmarks, and the Traffic Engine's calibration base.

### 4.2 Required Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Internal surrogate key |
| `address` | TEXT | Street address — normalized, not null |
| `city` | TEXT | Municipality |
| `state` | TEXT | Two-letter state code |
| `snapshot_date` | DATE | The date these rent figures were observed |
| `avg_asking_rent` | NUMERIC | Average asking rent per unit (USD/month) |
| `source` | TEXT | Provenance enum (see §4.4) |
| `asset_class` | TEXT | Canonical class (`A`/`B`/`C`/`D`); NULL allowed when unknown |

### 4.3 Optional Fields

| Field | Type | Description |
|---|---|---|
| `property_name` | TEXT | Building trade name |
| `zip` | TEXT | Postal code |
| `msa` | TEXT | MSA label |
| `submarket` | TEXT | CoStar or internal submarket label |
| `units` | INTEGER | Total residential unit count |
| `year_built` | INTEGER | Original construction year |
| `avg_effective_rent` | NUMERIC | Average effective rent after concessions (USD/month) |
| `rents_by_type` | JSONB | Per-unit-type rents: `{"studio": 1100, "1br": 1350, "2br": 1650}` |
| `min_rent` | NUMERIC | Lowest advertised rent across all unit types |
| `max_rent` | NUMERIC | Highest advertised rent across all unit types |
| `occupancy_pct` | NUMERIC | Occupancy rate (0–100 scale) |
| `available_units` | INTEGER | Number of units currently vacant/available |
| `concessions` | TEXT | Free-text description of current concessions (e.g. "1 month free") |
| `concession_pct` | NUMERIC | Concession value as % of annual rent |
| `time_on_market_days` | INTEGER | Avg days units sit vacant before leasing |
| `lease_velocity` | NUMERIC | Leases signed per month (trailing 30 days) |
| `management_company` | TEXT | Property management firm |
| `latitude` | NUMERIC | WGS-84 latitude |
| `longitude` | NUMERIC | WGS-84 longitude |
| `source_id` | TEXT | Source system's own identifier (for dedup / upsert) |
| `source_page` | INTEGER | Page number in uploaded file |
| `file_id` | UUID | FK to `deal_files` when record originates from an upload |
| `unit_amenities` | TEXT | Comma-separated unit amenity tags |
| `community_amenities` | TEXT | Community-level amenity tags |
| `property_type` | TEXT | Default `'multifamily'` |

### 4.4 Source Provenance Enum

```
'apartment_locator_ai'  -- Apartment Locator AI scrape (feeds apartment_locator_properties)
'costar_upload'         -- Operator-uploaded CoStar export (CSV/XLSX)
'broker_package'        -- Extracted from broker OM or deal package (PDF extraction)
'operator_entry'        -- Manually entered by analyst in the platform UI
'yardi_matrix'          -- Yardi Matrix API
'research_agent'        -- Platform research agent automated pull
```

### 4.5 Derived Fields

| Derived field | Formula |
|---|---|
| `effective_rent_discount_pct` | `(avg_asking_rent - avg_effective_rent) / avg_asking_rent * 100` |
| `rent_per_sqft` | Only meaningful when sqft is known: `avg_effective_rent / (sqft / units)` |
| `vintage_band` | Same as sale comp: `year_built - (year_built % 5)` |
| `age` | `EXTRACT(YEAR FROM snapshot_date) - year_built` |
| `months_since_snapshot` | `(NOW() - snapshot_date) / 30` |

### 4.6 Quality Score Definition

Quality score is a 0–100 integer calculated per-comp against a **subject deal**. Same purpose as sale comp quality: gates inclusion in Valuation Grid and rent benchmark derivation.

| Dimension | Max pts | Scoring rule |
|---|---|---|
| **Recency** | 35 | ≤3 months: 35 \| ≤6 months: 25 \| ≤12 months: 15 \| ≤18 months: 5 \| >18 months: 0 |
| **Distance to subject** | 25 | ≤0.5 mi: 25 \| ≤1 mi: 20 \| ≤2 mi: 15 \| ≤5 mi: 10 \| ≤10 mi: 5 \| >10 mi: 0 |
| **Asset class match** | 20 | Exact: 20 \| Adjacent: 10 \| Two apart: 0 |
| **Size proximity** | 20 | Units within ±20%: 20 \| ±40%: 13 \| ±60%: 7 \| >60%: 0 |

**Quality tiers:** Same thresholds as sale comp (70+ = Tier 1, 40–69 = Tier 2, <40 = Tier 3).

**Note:** Recency weight is higher for rent comps (35 vs 30) because rent markets move faster than sale markets. Rents older than 18 months score 0 on recency and should trigger a `INSUFFICIENT` warning in the Valuation Grid's data sourcing display.

---

## 5. Table Mapping — Canonical, Deprecated, Views

### 5.1 Sale Comp Tables

| Table | Role | Decision | Notes |
|---|---|---|---|
| `market_sale_comps` | ETL-ingested sale comps | **CANONICAL** | Primary write target for all ingest paths. CoStar uploads, county recorder, research agent all land here. |
| `sale_comp_sets` | Per-deal aggregation metadata | **KEEP** | Aggregation of market_sale_comps for a subject deal. Not an individual comp record. |
| `sale_comp_set_members` | Junction: comp_set ↔ individual comp | **KEEP** | Links sale_comp_sets to market_sale_comps via `market_comp_id`. |
| `recorded_transactions` | County recorder ingestion (legacy) | **DEPRECATED** | New county recorder ingestion should target `market_sale_comps` with `source = 'county_recorded'`. Existing rows readable via `vw_recorded_transactions_compat` view (see §5.3). |
| `deal_comp_sets` | Analyst-curated rent/lease comps per deal | **KEEP — RENAME SCOPE** | Primarily a rent comp curation table (confusingly named). Rename in a future migration to `deal_rent_comp_sets`. Class column migration: rename `class` → `asset_class`, drop `class_code` after backfill (see §6). |
| `comp_properties` | Unit-mix-oriented comp properties | **KEEP** | Backs the unit mix trade-area comp feature. Class column migration: rename `class` → `asset_class` (see §6). |

### 5.2 Rent Comp Tables

| Table | Role | Decision | Notes |
|---|---|---|---|
| `market_rent_comps` | ETL-ingested rent snapshots (property level) | **CANONICAL** | Primary write target for all rent comp ingest. CoStar uploads, research agent, and Apartment Locator AI sync all land here. Property-level record with `rents_by_type` JSONB for per-unit-type detail. |
| `apartment_rent_comps` | Unit-type-level rent comp rows | **KEEP — UNIT-TYPE GRANULARITY** | One row per property × floor plan (columns: `property_name`, `city`, `state`, `year_built`, `unit_type`, `rent`, `occupancy`, `asset_class`). Serves the Cashflow Agent's NOI comp tool (`fetch_peer_comp_noi_metrics.ts`) which requires P25/P50/P75 distributions by unit type — a query pattern that cannot be served from `market_rent_comps`'s JSONB `rents_by_type`. These two tables are complementary, not redundant: `market_rent_comps` = property-level snapshot; `apartment_rent_comps` = floor-plan-level rows. No class column migration needed — already uses `asset_class`. No migration file exists; table predates the current migration system. |
| `apartment_locator_properties` | Raw Apartment Locator AI property records | **STAGING / ETL SOURCE** | Remains as a staging table for the Apartment Locator sync job. Sync job promotes records to `market_rent_comps` (property-level) and `apartment_rent_comps` (unit-type rows from `unit_mix` JSONB). `apartment_locator_properties` is NOT a canonical profile table — it lacks `asset_class` and is source-specific. |
| `apartment_class_rent_snapshots` | City-level rent aggregates by class | **KEEP** | Aggregation layer derived from `market_rent_comps` or `apartment_locator_properties`. Not an individual comp record. |
| `competitive_sets` | Deal-level operational rent comps | **KEEP — CLASS COLUMN MIGRATION** | Active operational tracking of comp rents for a deal. Rename `comp_asset_class` → `asset_class` per §6. |

### 5.3 Compatibility Views

The following views maintain backward compatibility during the migration period. They are read-only bridges and should be removed once consumers are migrated.

```sql
-- Compatibility view: recorded_transactions → market_sale_comps shape
CREATE OR REPLACE VIEW vw_recorded_transactions_compat AS
SELECT
  gen_random_uuid()           AS id,
  NULL                        AS property_name,
  property_address            AS address,
  city                        AS city,
  state_code                  AS state,
  NULL                        AS zip,
  NULL                        AS county,
  NULL                        AS msa,
  NULL                        AS submarket,
  'multifamily'               AS property_type,
  units                       AS units,
  NULL                        AS sqft,
  NULL                        AS year_built,
  NULL                        AS asset_class,
  NULL                        AS stories,
  recording_date              AS sale_date,
  derived_sale_price          AS sale_price,
  price_per_unit              AS price_per_unit,
  NULL                        AS price_per_sqft,
  implied_cap_rate            AS cap_rate,
  buyer_name                  AS buyer,
  seller_name                 AS seller,
  'county_recorded'           AS source,
  NULL                        AS source_id,
  NULL                        AS latitude,
  NULL                        AS longitude,
  true                        AS qualified
FROM recorded_transactions;
```

---

## 6. Class Column Migration Plan

### Summary

| Table | Current column(s) | Target column | Migration action |
|---|---|---|---|
| `market_sale_comps` | `asset_class TEXT` | `asset_class` | None — already canonical |
| `market_rent_comps` | `asset_class TEXT` | `asset_class` | None — already canonical |
| `apartment_rent_comps` | `asset_class TEXT` | `asset_class` | None — already canonical (confirmed from query filter in `fetch_peer_comp_noi_metrics.ts`) |
| `apartment_class_rent_snapshots` | `asset_class CHAR(1)` | `asset_class` | None — already canonical |
| `competitive_sets` | `comp_asset_class TEXT` | `asset_class` | `ALTER TABLE competitive_sets RENAME COLUMN comp_asset_class TO asset_class` |
| `deal_comp_sets` | `class TEXT`, `class_code TEXT` | `asset_class` | Add `asset_class`, backfill from `class`, drop `class` and `class_code` |
| `comp_properties` | `class TEXT` | `asset_class` | `ALTER TABLE comp_properties RENAME COLUMN class TO asset_class` |
| `recorded_transactions` | *(absent)* | n/a — deprecated path | No migration; reads served by `vw_recorded_transactions_compat` |
| `apartment_locator_properties` | *(absent)* | n/a — staging table | Sync job derives `asset_class` during promotion to `market_rent_comps` |

### Migration steps (one SQL file per step, in order)

**Step 1** — `competitive_sets` rename (safe: column rename, no data change):
```sql
ALTER TABLE competitive_sets RENAME COLUMN comp_asset_class TO asset_class;
```

**Step 2** — `comp_properties` rename (safe):
```sql
ALTER TABLE comp_properties RENAME COLUMN class TO asset_class;
```

**Step 3** — `deal_comp_sets` consolidation:
```sql
ALTER TABLE deal_comp_sets ADD COLUMN IF NOT EXISTS asset_class TEXT;

-- Backfill: prefer class_code if it holds a single-char value, else use class
UPDATE deal_comp_sets
SET asset_class = UPPER(LEFT(COALESCE(NULLIF(class_code, ''), class), 1))
WHERE asset_class IS NULL
  AND COALESCE(NULLIF(class_code, ''), class) IS NOT NULL;

-- After verifying backfill, drop legacy columns in a follow-up migration:
-- ALTER TABLE deal_comp_sets DROP COLUMN class;
-- ALTER TABLE deal_comp_sets DROP COLUMN class_code;
```

> **Note:** The DROP of `class` and `class_code` from `deal_comp_sets` is gated on verifying that all application code has been migrated to reference `asset_class`. Run the drop as a separate migration after code audit.

---

## 7. Operator Upload Path

### 7.1 CoStar Sale Comp Export → Sale Comp Profile

CoStar's "Sales Comps" XLSX export (accessed via CoStar Analytics > Export) uses the following column headers. This mapping is the canonical translation used by the file ingestion pipeline.

| CoStar column | Sale Comp field | Transform |
|---|---|---|
| `Property Name` | `property_name` | Trim whitespace |
| `Address` | `address` | Trim whitespace |
| `City` | `city` | Trim whitespace |
| `State` | `state` | Uppercase, 2-char |
| `Zip` | `zip` | String |
| `County` | `county` | Trim whitespace |
| `Submarket` | `submarket` | Trim whitespace |
| `# Units` | `units` | Parse integer |
| `Bldg SF` / `Building SF` | `sqft` | Parse integer; remove commas |
| `Year Built` | `year_built` | Parse integer |
| `Building Class` / `Class` | `asset_class` | Apply vocabulary mapping (§2) |
| `# Stories` / `Stories` | `stories` | Parse integer |
| `Sale Date` | `sale_date` | Parse date: `M/D/YYYY` or `YYYY-MM-DD` |
| `Sale Price` | `sale_price` | Parse numeric; remove `$` and commas |
| `Price Per Unit` | *(derived — do not store)* | Recompute from sale_price / units |
| `Price Per SF` | *(derived — do not store)* | Recompute from sale_price / sqft |
| `Cap Rate` | `cap_rate` | Parse numeric; strip `%`; store as percent (e.g. `5.25`) |
| `Buyer` | `buyer` | Trim whitespace |
| `Seller` | `seller` | Trim whitespace |
| `Latitude` | `latitude` | Parse numeric |
| `Longitude` | `longitude` | Parse numeric |

**Source tag on upload:** `source = 'costar_upload'`, `source_id = NULL` (CoStar export lacks a stable row ID).

**Arm's-length default:** `qualified = true`. Operator can override per-row in the upload review UI.

**Dedup key:** `(address, city, state, sale_date)` — reject or flag duplicate when all four match an existing row with `source = 'costar_upload'`.

### 7.2 CoStar Rent Comp Export → Rent Comp Profile

CoStar's "Properties" or "Apartment" export with rent data uses the following column headers:

| CoStar column | Rent Comp field | Transform |
|---|---|---|
| `Property Name` | `property_name` | Trim whitespace |
| `Address` | `address` | Trim whitespace |
| `City` | `city` | Trim whitespace |
| `State` | `state` | Uppercase, 2-char |
| `Zip` | `zip` | String |
| `Submarket` | `submarket` | Trim whitespace |
| `# Units` / `Units` | `units` | Parse integer |
| `Year Built` | `year_built` | Parse integer |
| `Building Class` / `Class` | `asset_class` | Apply vocabulary mapping (§2) |
| `Asking Rent/Unit` / `Avg Asking Rent` | `avg_asking_rent` | Parse numeric; remove `$` |
| `Effective Rent/Unit` / `Avg Eff Rent` | `avg_effective_rent` | Parse numeric; remove `$` |
| `Occupancy` / `Occupancy Rate` | `occupancy_pct` | Parse numeric; strip `%`; store as 0–100 |
| `Concession %` / `Concessions %` | `concession_pct` | Parse numeric; strip `%` |
| `Latitude` | `latitude` | Parse numeric |
| `Longitude` | `longitude` | Parse numeric |

**Source tag on upload:** `source = 'costar_upload'`.

**Snapshot date:** Operator must supply the as-of date at upload time (CoStar exports do not reliably embed it). Default: date of upload if operator does not specify.

**Dedup key:** `(address, city, state, snapshot_date)` — flag duplicate when all four match an existing row with `source = 'costar_upload'`.

### 7.3 Upload UI Requirements (future implementation)

When an operator uploads a comp file (CoStar CSV/XLSX), the ingestion pipeline must:

1. **Parse & preview** — display first 10 rows with auto-detected column mapping.
2. **Validation report** — show rows with missing required fields; operator can correct or exclude.
3. **Class normalization review** — show any `asset_class` values that could not be mapped; operator selects the correct class from a dropdown.
4. **Arm's-length flag** (sale comps only) — show any rows where `qualified` detection is ambiguous; operator confirms.
5. **Duplicate detection** — show rows that match existing dedup keys; operator chooses overwrite or skip.
6. **Commit** — rows pass validation → inserted into canonical table with `file_id` FK back to the uploaded deal file.

---

## 8. Data Flow Summary

```
                          SALE COMP DATA FLOW
                          ═══════════════════

  County Recorder API ──────────────────────────────────────────────┐
  CoStar Upload (operator) ─────────────────────────────────────────┤──▶ market_sale_comps
  Research Agent pull ──────────────────────────────────────────────┘      (CANONICAL)
                                                                               │
                                                               ┌───────────────┘
                                                               ▼
                                                    sale_comp_set_members
                                                               │
                                                               ▼
                                                        sale_comp_sets
                                                    (aggregation per deal)
                                                               │
                                                               ▼
                                                    Valuation Grid service
                                           (PPU / PSF / implied cap distribution)


                           RENT COMP DATA FLOW
                          ════════════════════

  Apartment Locator AI ──▶ apartment_locator_properties ──────────────────────┐
  CoStar Upload (operator) ────────────────────────────────────────────────────┤──▶ market_rent_comps
  Research Agent pull ─────────────────────────────────────────────────────────┘      (CANONICAL)
                                                                                           │
                                                                         ┌─────────────────┘
                                                                         ▼
                                                            apartment_class_rent_snapshots
                                                            (city-level aggregation by class)
                                                                         │
                                                                         ▼
                                                            mv_market_rent_benchmarks
                                                            (view / mat-view — EC3 target)
                                                                         │
                                                                         ▼
                                                            Valuation Grid / Cashflow Agent
                                                            rent assumption derivation
```

---

## 9. Implementation Sequencing

These items are out-of-scope for this spec (spec only) but should be dispatched in order:

| Priority | Item | Blocking? |
|---|---|---|
| P1 | `competitive_sets` and `comp_properties` column renames (Step 1 & 2 above) | Unblocks Valuation Grid consistent reads |
| P1 | `deal_comp_sets` backfill + column consolidation (Step 3) | Unblocks rent comp queries |
| P2 | `recorded_transactions` → `market_sale_comps` ETL migration | Unblocks county recorder data reaching Valuation Grid |
| P2 | `apartment_locator_properties` sync job promotes to `market_rent_comps` | Unblocks EC3 (market rent source) |
| P3 | Upload UI: CoStar comp file ingestion with preview + validation | Enables Layer 2 operator data |
| P3 | Quality score computation in `CompSetService` | Enables Tier 1/2/3 comp weighting |
| P4 | `mv_market_rent_benchmarks` view creation (verifying EC3) | Unblocks Valuation Grid rent assumption layer |

---

## 10. Open Questions

These were intentionally deferred from this spec and should be resolved before Phase B implementation:

1. **`deal_comp_sets` rename** — The table is named "deal_comp_sets" but primarily holds rent comps (competitive set tracking), not sale comps. The `sale_comp_sets` table already holds sale comp aggregations. A rename to `deal_rent_comp_sets` avoids future confusion. **Requires:** audit of all API routes and frontend references before rename.

2. **Research agent comp integration** — Which endpoints does the research agent currently call to populate `market_sale_comps`? Are any rows from this source in production? Verify with `SELECT COUNT(*), source FROM market_sale_comps GROUP BY source`.

3. **Operating data at sale** — Fields `gross_rent_at_sale`, `gross_income_at_sale`, `noi_at_sale`, `occupancy_at_sale` do not exist yet on `market_sale_comps`. Adding these columns is required before the comp-anchored implied cap rate synthesis (SESSION_CLOSE Commit 1) can be implemented. These are the columns that allow computing an implied cap rate when the seller did not disclose one.

4. **Submarket taxonomy** — `submarket` is free text in all comp tables. Without a controlled vocabulary, submarket-level grouping is unreliable. A future `submarkets` lookup table would enable join-based filtering. Out of scope for this spec.
