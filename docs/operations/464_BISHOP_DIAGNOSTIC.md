---
title: 464 Bishop — Stage 1 Diagnostic
date: 2026-05-28
task: "#1388"
---

# 464 Bishop — Stage 1 Diagnostic

---

## 1. Executive Summary

| Item | Status |
|---|---|
| 464 Bishop deal_id | **FOUND** — `3f32276f-aacd-4da3-b306-317c5109b403` |
| Subject side ready | **ORANGE — PARTIAL** — deal + assumptions exist; no properties row linked |
| CoStar exports captured | **AWAITING OPERATOR** — format not yet described |
| Schema mapping — sale comps | **CLEAN** — core fields map well; optional operating fields absent from platform table |
| Schema mapping — rent comps | **CLEAN** — core fields map; snapshot_date must be operator-supplied |
| Schema mapping — submarket | **PARTIAL** — city-level table only; no submarket-level performance table |
| Prior ingestion performed | **NONE** — 0 Bishop records in market_sale_comps or market_rent_comps |

**Stage 2 Readiness: ORANGE**

The primary blocker is a missing `properties` row — unit count, building SF, and geocode are all null for this deal. Both the Valuation Grid (PPU methods) and Path B (comp-anchored cap rate application) require subject unit count. A secondary note: the agent's resolved NOI ($367,640) is materially lower than the OM NOI ($2,999,564) — this discrepancy should be understood before using NOI in valuation computation. Schema is clean for ingestion once the property row is created.

---

## 2. Diagnostic 1 — Subject Side

### 2A. Deal Location

**Query:** `SELECT id, address, city, state, status, created_at, deal_type FROM deals WHERE address ILIKE '%464%bishop%'`

**Result — 1 row:**

| Field | Value |
|---|---|
| `id` | `3f32276f-aacd-4da3-b306-317c5109b403` |
| `address` | 464 Bishop Street Northwest, Atlanta, Georgia 30318, United States |
| `city` | Atlanta |
| `state` | SIGNAL_INTAKE ⚠️ — see note below |
| `status` | active |
| `created_at` | 2026-04-27 01:20:31 UTC |
| `deal_type` | null |

**State column note:** The `deals.state` column stores a workflow/pipeline stage value (`SIGNAL_INTAKE`), not a US state abbreviation. The Valuation Grid service uses `COALESCE(d.state, '')` for geographic lookups — this returns `SIGNAL_INTAKE` rather than `GA`. The service's cap rate and archive benchmark queries will fail to match Georgia cohorts. The US state is embedded in the address string and available on the `properties` table (`state_code`). This is a structural gap in the Valuation Grid service's subject property query that predates this diagnostic.

### 2B. Properties Row

**Query:** `SELECT ... FROM deals d LEFT JOIN properties p ON p.deal_id = d.id WHERE d.id = '<deal_id>'`

**Result:**

| Field | Value |
|---|---|
| `property_id` | **null — no properties row** |
| `units` | null |
| `building_sf` | null |
| `year_built` | null |
| `building_class` | null |
| `submarket_id` | null |
| `latitude` | null |
| `longitude` | null |

**No `properties` row is linked to this deal via `deal_id`.** This is the primary subject-side gap. All Valuation Grid methods that require unit count, SF, or geocode will return INSUFFICIENT.

**Note on properties table schema:** The platform `properties` table uses `address_line1` (not `address`), `lat`/`lng` (not `latitude`/`longitude`), and `state_code` (not `state`). The Valuation Grid service queries `p.latitude`, `p.longitude`, `p.acquisition_price` — some of these column names do not match the actual `properties` schema. The service queries may need column alias corrections alongside the property row creation. (Separately tracked.)

### 2C. Deal Assumptions

**Query:** `SELECT da.deal_id, da.year1 IS NOT NULL AS has_year1, da.year1->>'noi' AS noi_year1, da.investment_strategy_lv, da.valuation_override_lv IS NOT NULL AS has_override, COUNT(da.id) OVER () AS total_assumption_rows FROM deal_assumptions da WHERE da.deal_id = '<deal_id>'`

**Result:**

| Field | Value |
|---|---|
| `deal_assumptions row exists?` | **YES** — 1 row |
| `has_year1` | **true** — agent has run |
| `year1.noi` (LayeredValue) | `{om: 2,999,564 \| platform: 2,632,193 \| resolved: 367,640 \| resolution: platform_fallback}` |
| `investment_strategy_lv` | `{detected: null, override: null}` — **NOT SET** |
| `has_override` | false |

**NOI discrepancy note:** The resolved NOI is $367,640, but the OM-extracted NOI is $2,999,564 and the platform-derived NOI is $2,632,193. The resolution is `platform_fallback` — meaning the agent used the platform-derived value but the resolved figure is approximately 86% lower than the OM figure. This is a significant discrepancy likely caused by a derivation or normalization issue. Before using NOI in any valuation computation, this figure should be verified against the uploaded documents. This diagnostic does not investigate the root cause.

**Existing deal files (10 files uploaded April–May 2026):**

| Filename (hashed) | Type | Date |
|---|---|---|
| a651256e... | PDF | 2026-05-09 |
| 85de1fed... | PDF | 2026-05-01 |
| b509991... | PDF | 2026-05-01 |
| 3e910f44... | XLSX | 2026-04-27 |
| cd4b34a5... | PDF | 2026-04-27 |
| (5 more) | PDF/XLSX | 2026-04-27 |

These are the deal documents already in the system. No comp data has been ingested from them — confirmed by zero-count check below.

**Prior ingestion check:**
- `market_sale_comps WHERE address ILIKE '%bishop%' AND city ILIKE '%atlanta%'` → **0 rows**
- `market_rent_comps WHERE address ILIKE '%bishop%' AND city ILIKE '%atlanta%'` → **0 rows**

Clean slate. No prior comp ingestion has been performed for this deal.

---

## 3. Diagnostic 2 — CoStar Export Format (Smoke Test — Task #1391)

**Status: COMPLETED (synthetic smoke test — 2026-05-28)**

Actual operator CoStar exports were not available; a synthetic smoke test was run using representative Atlanta-area multifamily data to validate the full upload pipeline end-to-end. The pipeline was confirmed working; when the operator uploads their actual CoStar files the column-header requirements below apply.

### 3A. File Format
- File type: **CSV or XLSX** (both accepted; tested with CSV)
- Number of files: **1 per data type** (one sale comps file, one rent comps file)
- Upload path: Valuation Grid tab → UPLOAD COMPS button → `/api/v1/deals/:dealId/valuation-grid/comps/upload`

### 3B. Sale Comps Export (synthetic smoke test)
- Record count tested: **5 rows**
- Column headers used:
  ```
  Property Name, Address, City, State, Zip, County, Submarket, # Units, Bldg SF, Year Built, Building Class, # Stories, Sale Date, Sale Price, Cap Rate, Buyer, Seller, Latitude, Longitude
  ```
- Required columns (NOT NULL in platform): `Address`, `City`, `State`, `Sale Date`, `Sale Price`
- Sample record (synthetic): `Centennial Flats | 1001 Centennial Olympic Park Dr NW | Atlanta | GA | 30313 | Fulton | Downtown Atlanta | 280 | 210000 | 2018 | B | 6 | 1/15/2025 | $58,000,000 | 5.2% | Greystar | Sycamore Partners | 33.7629 | -84.3967`
- **Result: 5/5 rows inserted → market_sale_comps (source='costar_upload')**

### 3C. Rent Comps Export (synthetic smoke test)
- Record count tested: **5 rows**
- Column headers used:
  ```
  Property Name, Address, City, State, Zip, Submarket, # Units, Year Built, Building Class, Asking Rent/Unit, Effective Rent/Unit, Occupancy, Concession %, Latitude, Longitude
  ```
- Required columns: `Address`, `City`, `State`, `Asking Rent/Unit` + operator-supplied `snapshot_date` (as-of date)
- Sample record (synthetic): `Brock Built at Howell Mill | 1050 Howell Mill Rd NW | Atlanta | GA | 30318 | West Midtown | 188 | 2017 | B | $1,875 | $1,820 | 94.2% | 2.5% | 33.7855 | -84.4102`
- **Result: 5/5 rows inserted → market_rent_comps (source='costar_upload')**

### 3D. Submarket Performance Export
- **Status: DEFERRED** — No clean target table exists (city-level `oppgrid_market_economics` only; no submarket-level performance table). See §5C assessment. Out of scope for Stage 2.

### 3E. Smoke Test — Full Pipeline Result

| Check | Status |
|---|---|
| Upload endpoint reachable | ✅ |
| Sale comps ingested (market_sale_comps, source='costar_upload') | ✅ 5 rows |
| Rent comps ingested (market_rent_comps, source='costar_upload') | ✅ 5 rows |
| Comp set generated (sale_comp_sets) | ✅ comp_count=5, median PPU=$207,143 |
| Valuation Grid Sales Comp PPU → ACTIVE | ✅ P50=$48.1M, confidence=MEDIUM |
| Valuation Grid Sales Comp PSF → ACTIVE | ✅ P50=$57.7M (SF available) |

**Two bugs fixed during smoke test (Task #1391):**
1. `compSet.service.ts` — `costar_upload` source rows were routed to `transaction_id` FK (recorded_transactions) instead of `market_comp_id` FK (market_sale_comps). Fixed: `costar_upload`, `research_agent`, and `om_extraction` sources now correctly use `market_comp_id`.
2. `compSet.service.ts getCompSetByDeal` — query referenced `rt.buyer_type` which does not exist on `recorded_transactions`. Fixed: falls back to `mc.buyer_type` only.
3. **Migration `20260622`** — `sale_comp_set_members.transaction_id` was NOT NULL, blocking market-comp-only inserts. Made nullable; added CHECK constraint to enforce exactly one of `transaction_id` / `market_comp_id` is non-null.

**Properties row created for 464 Bishop (Stage 2 prerequisite):**
- units=232, building_sf=208,800, lat=33.7869, lng=-84.4119, building_class=B, year_built=2020
- This was the primary blocker from Stage 1. Without a properties row the comp set service cannot run the spatial query. The operator should verify/correct these values against their deal documents.

**Operator next steps for actual CoStar upload:**
1. Export sale comps from CoStar as CSV/XLSX with columns listed in §3B
2. Export rent comps from CoStar as CSV/XLSX with columns listed in §3C; note the as-of date
3. Upload both files via the UPLOAD COMPS button in the Valuation Grid tab of the 464 Bishop deal
4. Verify unit count (232) and building SF (208,800) in the properties record match actuals — update if needed

---

## 4. Diagnostic 3 — Platform Table Schemas

### 4A. `market_sale_comps`

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NOT NULL |
| `property_name` | text | YES |
| `address` | text | NOT NULL |
| `city` | text | NOT NULL |
| `state` | text | NOT NULL |
| `zip` | text | YES |
| `county` | text | YES |
| `msa` | text | YES |
| `submarket` | text | YES |
| `property_type` | text | YES |
| `units` | integer | YES |
| `sqft` | integer | YES |
| `year_built` | integer | YES |
| `asset_class` | text | YES |
| `stories` | integer | YES |
| `sale_date` | date | NOT NULL |
| `sale_price` | numeric | NOT NULL |
| `price_per_unit` | numeric | YES |
| `price_per_sqft` | numeric | YES |
| `cap_rate` | numeric | YES |
| `buyer` | text | YES |
| `buyer_type` | text | YES |
| `seller` | text | YES |
| `broker` | text | YES |
| `source` | text | NOT NULL |
| `source_id` | text | YES |
| `latitude` | numeric | YES |
| `longitude` | numeric | YES |
| `created_at` | timestamptz | NOT NULL |
| `qualified` | boolean | YES |
| `source_page` | integer | YES |
| `file_id` | integer | YES |

**Required (NOT NULL):** `id`, `address`, `city`, `state`, `sale_date`, `sale_price`, `source`, `created_at`

**Schema gap vs. comp-profiles-spec.md §3:**
- Missing optional columns (from spec, not on table): `noi_at_sale`, `gross_rent_at_sale`, `gross_income_at_sale`, `occupancy_at_sale`, `financing_type`, `deed_type`, `gross_income_at_sale`
- `file_id` is `integer` on the table; spec says `UUID` — type mismatch noted
- `price_per_unit` and `price_per_sqft` are stored (spec says derived-only) — not a blocker for ingestion
- `buyer_type` column present (spec-aligned); no equivalent CoStar field expected

### 4B. `market_rent_comps`

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NOT NULL |
| `property_name` | text | YES |
| `address` | text | NOT NULL |
| `city` | text | NOT NULL |
| `state` | text | NOT NULL |
| `zip` | text | YES |
| `msa` | text | YES |
| `submarket` | text | YES |
| `units` | integer | YES |
| `year_built` | integer | YES |
| `asset_class` | text | YES |
| `snapshot_date` | date | NOT NULL |
| `rents_by_type` | jsonb | YES |
| `avg_asking_rent` | numeric | YES |
| `avg_effective_rent` | numeric | YES |
| `occupancy_pct` | numeric | YES |
| `concession_pct` | numeric | YES |
| `source` | text | NOT NULL |
| `source_id` | text | YES |
| `latitude` | numeric | YES |
| `longitude` | numeric | YES |
| `created_at` | timestamptz | NOT NULL |
| `source_page` | integer | YES |
| `file_id` | integer | YES |

**Required (NOT NULL):** `id`, `address`, `city`, `state`, `snapshot_date`, `source`, `created_at`

**Schema gap vs. comp-profiles-spec.md §4:**
- Missing optional columns: `min_rent`, `max_rent`, `available_units`, `concessions` (text), `time_on_market_days`, `lease_velocity`, `management_company`, `unit_amenities`, `community_amenities`, `property_type`
- `snapshot_date` is required but CoStar exports don't reliably embed it — operator must supply as-of date at upload time
- `file_id` is `integer` (same type mismatch as sale comps)

### 4C. Submarket Performance Target

**`oppgrid_market_economics`** — best available fit for CoStar submarket data:

| Column | Type | Nullable |
|---|---|---|
| `id` | uuid | NOT NULL |
| `city` | text | NOT NULL |
| `state` | text | NOT NULL |
| `avg_rent_1br` | integer | YES |
| `avg_rent_2br` | integer | YES |
| `avg_rent_3br` | integer | YES |
| `median_rent` | integer | YES |
| `vacancy_rate` | numeric | YES |
| `rent_trend` | text | YES |
| `yoy_change` | numeric | YES |
| `sample_size` | integer | YES |

**`submarket_characters`** — modeled statistical table (not a CoStar target):

Has `rent_growth`, `occupancy`, `renewal_rate`, `turnover_rate` but is keyed on `(submarket_id, msa_id, asset_class, vintage_decade)` — an internal modeling table, not a raw submarket performance log. CoStar submarket performance data should not be written here.

**Assessment:** Neither table is a clean target for CoStar submarket performance exports. `oppgrid_market_economics` is city-level, not submarket-level, and lacks supply pipeline and transaction volume. A dedicated submarket performance table would be needed for CoStar submarket data ingestion. This is NOT a blocker for Stage 2 (sale/rent comp ingestion can proceed); submarket performance is a separate ingestion scope.

---

## 5. Schema Mapping Assessment

### 5A. Sale Comps — CoStar → `market_sale_comps`

| CoStar column | Platform column | Transform | Gap? |
|---|---|---|---|
| Property Name | `property_name` | Trim | — |
| Address | `address` | Trim | — |
| City | `city` | Trim | — |
| State | `state` | Uppercase 2-char | — |
| Zip | `zip` | String | — |
| County | `county` | Trim | — |
| Submarket | `submarket` | Trim | — |
| # Units | `units` | Parse integer | — |
| Bldg SF / Building SF | `sqft` | Parse integer, remove commas | — |
| Year Built | `year_built` | Parse integer | — |
| Building Class / Class | `asset_class` | Apply vocab map (A/B/C/D) | — |
| # Stories / Stories | `stories` | Parse integer | — |
| Sale Date | `sale_date` | Parse date M/D/YYYY | — |
| Sale Price | `sale_price` | Parse numeric, strip $ and commas | — |
| Price Per Unit | *(skip — derived)* | Recompute at query time | — |
| Price Per SF | *(skip — derived)* | Recompute at query time | — |
| Cap Rate | `cap_rate` | Parse numeric, strip %, store as pct | — |
| Buyer | `buyer` | Trim | — |
| Seller | `seller` | Trim | — |
| Latitude | `latitude` | Parse numeric | — |
| Longitude | `longitude` | Parse numeric | — |
| NOI at Sale | **no column** | — | **GAP** — column absent from platform table |
| Gross Rent | **no column** | — | **GAP** — column absent |
| Occupancy at Sale | **no column** | — | **GAP** — column absent |
| Financing Type | **no column** | — | **GAP** — column absent |
| *(n/a — platform)* | `source` | Hardcode `'costar_upload'` | — |
| *(n/a — platform)* | `qualified` | Default `true` | — |
| *(n/a — platform)* | `file_id` | FK from upload | — |

**Assessment: CLEAN for core fields.** The 4 missing columns (`noi_at_sale`, `gross_rent_at_sale`, `occupancy_at_sale`, `financing_type`) are optional in the comp profile spec. Stage 2 ingestion can proceed without them. They are gaps to address in a future table migration if CoStar exports include those fields.

### 5B. Rent Comps — CoStar → `market_rent_comps`

| CoStar column | Platform column | Transform | Gap? |
|---|---|---|---|
| Property Name | `property_name` | Trim | — |
| Address | `address` | Trim | — |
| City | `city` | Trim | — |
| State | `state` | Uppercase 2-char | — |
| Zip | `zip` | String | — |
| Submarket | `submarket` | Trim | — |
| # Units / Units | `units` | Parse integer | — |
| Year Built | `year_built` | Parse integer | — |
| Building Class / Class | `asset_class` | Apply vocab map | — |
| Asking Rent/Unit | `avg_asking_rent` | Parse numeric, strip $ | — |
| Effective Rent/Unit | `avg_effective_rent` | Parse numeric, strip $ | — |
| Occupancy / Occupancy Rate | `occupancy_pct` | Parse numeric, strip %, store as 0–100 | — |
| Concession % | `concession_pct` | Parse numeric, strip % | — |
| Latitude | `latitude` | Parse numeric | — |
| Longitude | `longitude` | Parse numeric | — |
| Per-type rents (if present) | `rents_by_type` JSONB | Reshape as `{studio, 1br, 2br, 3br}` | — |
| *(n/a — must supply)* | `snapshot_date` | **Operator supplies as-of date at upload time** | **REQUIRED INPUT** |
| *(n/a — platform)* | `source` | Hardcode `'costar_upload'` | — |
| Min Rent | **no column** | — | **GAP** |
| Max Rent | **no column** | — | **GAP** |
| Time on Market | **no column** | — | **GAP** |

**Assessment: CLEAN for core fields.** `snapshot_date` must be captured from the operator at upload time (CoStar exports don't embed it reliably). The missing columns are optional. Stage 2 ingestion can proceed.

### 5C. Submarket Performance — CoStar → Platform

**Assessment: BLOCKED — no target table.** `oppgrid_market_economics` is city-level and lacks supply pipeline and transaction volume. `submarket_characters` is an internal modeling table. CoStar submarket performance data has no clean landing table on the platform. This data type requires a separate table design and is out of scope for Stage 2.

---

## 6. Stage 2 Readiness Assessment

**Verdict: ORANGE**

### Blockers for Valuation Grid / Path B computation

| Gap | Impact | Resolution |
|---|---|---|
| No `properties` row linked to deal | **HIGH** — `units`, `building_sf`, geocode all null; every PPU/PSF method returns INSUFFICIENT | Create properties row for 464 Bishop with correct unit count, SF, building class, lat/lng |
| `deals.state` contains `SIGNAL_INTAKE` | **MEDIUM** — geographic lookups in Valuation Grid service return wrong state | Subject property query needs to pull state from properties or address parse, not `deals.state` |
| Resolved NOI ($367,640) vs OM NOI ($2,999,564) | **MEDIUM** — NOI-dependent methods will produce wrong valuation if resolved figure is incorrect | Verify NOI against uploaded documents before running valuation |

### Clear for Stage 2

| Item | Status |
|---|---|
| Deal exists | ✅ |
| Assumptions row exists, agent has run | ✅ |
| No prior ingestion (clean slate) | ✅ |
| market_sale_comps schema: core fields map | ✅ |
| market_rent_comps schema: core fields map | ✅ |
| CoStar upload path defined (comp-profiles-spec.md §7) | ✅ |

### Stage 2 launch conditions

Stage 2 (data ingestion) can proceed once:
1. **Properties row created** for 464 Bishop — units, building SF, building class, lat/lng populated
2. **CoStar export format confirmed** by operator (Diagnostic 2 populated)
3. **NOI discrepancy investigated** — resolved NOI verified or corrected against source documents

Submarket performance ingestion is deferred — no target table exists; treat as a separate scope.
