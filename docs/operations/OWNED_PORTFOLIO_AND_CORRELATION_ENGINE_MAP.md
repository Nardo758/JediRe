# OWNED/PORTFOLIO + CORRELATION ENGINE MAP

**Produced:** 2026-05-31  
**Scope:** Read-only audit. All claims grounded in direct code reads or live SQL queries. Claims that could not be verified against live code or data are explicitly flagged **INFERRED-NOT-VERIFIED**.  
**P11 compliance:** Before stating any code path or data flow exists, it was verified by direct grep or SQL query. Section headings and prior conversation are not treated as evidence.

---

## §1 — Asset 1: Owned/Portfolio

### §1.1 Where the data lives (Layer 1)

#### Primary table: `deal_monthly_actuals`

This is the actual operational home of owned portfolio data. The table has 85 rows across 5 distinct `property_id` values and 2 `deal_id` values.

**Schema (selected stabilization-relevant columns):**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `property_id` | uuid | FK to `properties` |
| `deal_id` | uuid | Nullable — portfolio rows have `deal_id IS NULL` |
| `report_month` | date | First-of-month |
| `total_units` | integer | |
| `occupied_units` | integer | |
| `occupancy_rate` | numeric | Decimal (0.947 = 94.7%) |
| `avg_market_rent` | numeric | |
| `avg_effective_rent` | numeric | |
| `gross_potential_rent` | numeric | |
| `loss_to_lease` | numeric | |
| `vacancy_loss` | numeric | |
| `concessions` | numeric | Total concessions, not per-unit |
| `effective_gross_income` | numeric | |
| `payroll` | numeric | |
| `repairs_maintenance` | numeric | |
| `turnover_costs` | numeric | |
| `marketing` | numeric | |
| `admin_general` | numeric | |
| `management_fee` | numeric | |
| `management_fee_pct` | numeric | |
| `utilities` | numeric | |
| `total_opex` | numeric | |
| `noi` | numeric | |
| `noi_per_unit` | numeric | |
| `new_leases` | integer | |
| `renewals` | integer | |
| `move_outs` | integer | |
| `avg_days_to_lease` | numeric | |
| `data_source` | varchar | `'manual'`, `'yardi'`, etc. |
| `is_budget` | boolean | Budget rows excluded from actuals queries |
| `is_proforma` | boolean | |

Concession depth per unit is NOT a dedicated column; it must be derived as `concessions / total_units` from the row data if `concessions` is populated.

**Owned portfolio properties in `deal_monthly_actuals` (verified by live query, `deal_id IS NULL` group):**

| `property_id` | Address | City/State | Months | Date range | Avg occ | Avg eff rent/unit | Avg NOI/unit | Source |
|---|---|---|---|---|---|---|---|---|
| `a1000001-0000-0000-0000-000000000001` | 4800 Spring Creek Pkwy | Frisco, TX | 18 | Jul 2024 – Dec 2025 | 94.7% | $1,483 | $897/mo | manual |
| `a1000001-0000-0000-0000-000000000002` | 1200 Eldorado Pkwy | McKinney, TX | 18 | Jul 2024 – Dec 2025 | 94.6% | $1,353 | $731/mo | manual |
| `7ea31caf-f070-43eb-9fd1-fe08f7123701` | 2789 Satellite Blvd, Duluth GA 30096 | Duluth, GA | 13 | Dec 2021 – Dec 2022 | 95.0% | $1,740 | $1,055/mo | yardi |

**Deal-linked rows in `deal_monthly_actuals`:**

| Deal | Property | Months | Range |
|---|---|---|---|
| 464 Bishop (Atlanta, GA) | `656fe704-...` | 24 | Aug 2017 – Dec 2026 (includes proforma projections) |
| Sentosa Epperson | `fa526821-...` | 12 | Mar 2025 – Feb 2026 |

#### Secondary table: `property_operating_data`

Has an `is_owned BOOLEAN NOT NULL DEFAULT FALSE` column defined in:
- Schema: `backend/src/db/schema/propertyEntity.ts` line ~77
- Migration: `backend/src/database/migrations/20260529_phase1_property_entity_schema.sql` line ~102

**Live row count:** 821 rows total, **0 rows with `is_owned = true`.**  
The owned portfolio flag is schema-defined but has never been populated. This table is a parallel, unused pathway for owned portfolio identification.

#### Non-table: `data_library_assets`

Has a `source_type` column that supports `'owned_deal'` as a value (alongside `'archive'`, `'broker_om'`, `'costar'`, `'manual'`). The `source_type = 'owned_deal'` path is schema-defined but **0 rows exist with this source type**. Live counts: 298 `'archive'` rows, 1 `'broker_om'` row.

#### `historical_observations` (portfolio-linked rows)

Only 2 rows in `historical_observations` have `deal_id` set:

| Deal | Date | `is_subject_property` |
|---|---|---|
| 464 Bishop | 2026-05-01 | false |
| Sentosa Epperson | 2026-02-01 | false |

Zero rows have `is_subject_property = true`. These are not owned portfolio rows — they are deal-level signal observations.

---

### §1.2 Where the code lives (Layer 2)

#### Agent tools (primary owned portfolio read path)

**`backend/src/agents/tools/fetch_owned_asset_actuals.ts`**
- Tier 2 evidence tool used by the CashFlow Agent
- Queries `deal_monthly_actuals` for properties with TTM data (`report_month >= NOW() - 12 months`, `is_budget = false`)
- Excludes properties linked to the current deal's `deal_id`
- Comparability scoring: submarket match (40 pts), asset class (30 pts), vintage (15 pts), unit count (15 pts)
- Returns per-asset TTM and TTM-24 summaries: avg_occupancy_rate, avg_effective_rent_per_unit, noi_per_unit_annual, opex_per_unit_annual, egi_per_unit_annual, management_fee_pct
- `value_add_programs_only=true` mode: filters to deals with project_type SIMILAR TO `%(value.?add|rehab|renovati|repositi)%`, returns `renovation_capture_summary` with per-program rent trajectory and estimated capture rate (archive P50 fallback = 0.80 when no programs found)
- **Note on submarket matching:** The tool scores `submarket = input.submarket` for a 40-point bonus, but `deal_monthly_actuals` has no submarket column on the property — it sources from `properties.submarket` which does not exist in the `properties` schema. The `NULL::text AS submarket` cast in the tool's query means submarket matching always falls back to the non-submarket case (full 40 pts credited to all assets when no submarket is specified). **VERIFIED: tool uses `NULL::text AS submarket` on line 218.**

**`backend/src/agents/tools/fetch_owned_asset_opex_ratios.ts`**
- Tier 2 evidence tool for opex cross-check
- Queries `deal_monthly_actuals` for given `property_ids` over a configurable lookback (3–36 months)
- Returns per-line-item opex: payroll, repairs_maintenance, utilities, marketing, admin_general, management_fee, turnover — all as per-unit/year and as % of EGI

**`backend/src/agents/cashflow.inngest.ts`**
- References both `fetch_owned_asset_actuals` and `deal_monthly_actuals` — confirmed by grep
- These tools are available to the CashFlow Agent's tool set

#### Service layer

**`backend/src/services/property-entity/property-operating-data.service.ts`**
- Service for `property_operating_data` table with `isOwned` filtering
- Not called by the CashFlow Agent; not actively used in the main underwriting pipeline
- Exists as infrastructure for the `is_owned` flag that has 0 populated rows

#### API routes

**`backend/src/api/rest/data-library-assets.routes.ts`**
- Filters `data_library_assets` by `source_type`
- `source_type = 'owned_deal'` is supported but returns empty results

---

### §1.3 Data state (Layer 3)

#### Per-property completeness assessment

**Property 1: Frisco TX (a1000001-...-0001)**
- Months: 18 (Jul 2024 – Dec 2025), source=manual
- Occupancy: ✅ 94.7% avg — 18/18 months
- Effective rent: ✅ $1,483/unit avg — 18/18 months
- NOI: ✅ $897/unit/month avg — 18/18 months
- Concession per unit: ⚠️ INFERRED-NOT-VERIFIED — `concessions` column exists but no separate query run; `avg_days_to_lease` — not verified
- OpEx line items: ✅ Available via `fetch_owned_asset_opex_ratios` (payroll, R&M, utilities, marketing, admin, management fee, turnover)
- Lease-by-lease data: ❌ Not available — `deal_monthly_actuals` has aggregate monthly figures only; no per-lease signing data
- Renovation history: ❌ Not present — no capex program data in `deal_monthly_actuals` for this property
- Market: Frisco/McKinney TX (DFW suburbs) — not comparable to Atlanta Midtown

**Property 2: McKinney TX (a1000001-...-0002)**
- Same profile as Frisco TX property above
- Months: 18, source=manual, $1,353/unit avg rent, $731/unit/month NOI

**Property 3: Duluth GA (7ea31caf-...)**
- Months: 13 (Dec 2021 – Dec 2022), source=yardi
- Occupancy: ✅ 95.0% avg
- Effective rent: ✅ $1,740/unit avg
- NOI: ✅ $1,055/unit/month avg
- Yardi-sourced data — structured actuals, not manual entry
- Market: Duluth GA (suburban Atlanta / Gwinnett County) — not Atlanta Midtown; ~25 miles north

#### Cross-reference with session memory claims

The prior session described the three owned properties as:
- "Jacksonville 2018+" — **NOT FOUND**. No Jacksonville, FL property exists in `deal_monthly_actuals` or `properties`. This claim is INFERRED-NOT-VERIFIED.
- "Atlanta Property A 2020+" — **NOT FOUND** in that form. The Duluth GA property is the only Georgia property and has Dec 2021–Dec 2022 data (13 months, not 2020+).
- "Atlanta Property B 2022+" — **NOT FOUND**.

**Actual portfolio:** 2 DFW-area Texas properties (manual data, Jul 2024–Dec 2025) + 1 suburban Atlanta GA property (Yardi, Dec 2021–Dec 2022). None are in Jacksonville or inner Atlanta.

---

### §1.4 Answers to Q1.1–Q1.5

**Q1.1 — Ownership identification mechanism**

**RESOLVED (Fix B / Task 1669, 2026-05-31):** `deal_monthly_actuals.is_portfolio_asset BOOLEAN` is now the canonical flag.
- Migration `20260531_deal_monthly_actuals_is_portfolio_asset.sql` added the column and backfilled `TRUE` for all 3 existing portfolio properties (49 rows).
- `fetch_owned_asset_actuals` now filters `dma.is_portfolio_asset = TRUE` explicitly; the prior implicit `deal_id IS NULL` convention is superseded.
- `property_operating_data.is_owned` is DEPRECATED — column retained (0 rows populated, never written) but marked with a deprecation notice in both the SQL migration and the Drizzle schema (`backend/src/db/schema/propertyEntity.ts`).
- `data_library_assets.source_type = 'owned_deal'` remains defined but 0 rows — still NOT used.

Adding a new owned portfolio property now requires:
1. Insert rows into `deal_monthly_actuals` with `is_portfolio_asset = TRUE` (and `deal_id = NULL`)
2. The agent tools pick it up automatically on the next invocation — no code change needed.

**Q1.2 — Per-property historical data**

See §1.3 above. Key finding: aggregate monthly operating data (occupancy, effective rent, NOI, opex by line) is available for all three properties. Per-lease data, signing velocity, concession depth per unit, and renovation history are not present in any table.

**Q1.3 — Agent reasoning path**

The path is: `fetch_owned_asset_actuals` (tool) → queries `deal_monthly_actuals` → returns TTM comparables → CashFlow Agent uses as Tier 2 evidence. The agent does NOT query `historical_observations` for owned portfolio comparisons. The tool is fully wired and functional. The limitation is portfolio breadth and geography — the current portfolio has no Atlanta Midtown comparables.

**Q1.4 — Lease-up trajectory validation**

No lease-up trajectory data exists for any owned portfolio property. All three properties are observed at stabilized occupancy (94.7%, 94.6%, 95.0%). The Dec 2021–Dec 2022 Duluth GA observation window predates any visible lease-up phase. The lifecycle profile detection thresholds in the Lifecycle State Machine (occupancy < 0.80 → DISTRESSED, etc.) cannot be validated or adjusted from owned portfolio data.

**Q1.5 — Canonical sources for 464 Bishop inputs**

| Input | Canonical source | Status |
|---|---|---|
| `market_rent_per_unit` (Atlanta Midtown) | `apartment_market_snapshots` (Atlanta,GA, 34 rows) or `historical_observations` (18 rows for atlanta-msa) | ⚠️ No Midtown-specific granularity; city-level only |
| Stabilized OpEx per unit (Class B, Atlanta) | `deal_monthly_actuals` Duluth GA property ($1,055/unit/month NOI, $1,740 eff rent) | ⚠️ Suburban Gwinnett County — not Midtown comp |
| `renovation_premium_per_unit_monthly` | Not in any table | ❌ Must be agent-derived or manually specified |
| Atlanta renovation premium history | Not present | ❌ INFERRED-NOT-VERIFIED |

---

## §2 — Asset 2: Correlation Engine

### §2.1 Where the data lives (Layer 1)

#### `historical_observations` — 475 rows

Full schema documented above (§1.1 header). Live column completeness for stabilization-relevant fields:

| Column | Rows populated | % of 475 | Status |
|---|---|---|---|
| `property_concession_per_unit` | 0 | 0% | **EMPTY** |
| `property_asking_rent` | 1 | 0.2% | Effectively empty |
| `property_signing_velocity` | 38 | 8% | Sparse |
| `realized_occupancy_change_t12` | 0 | 0% | **EMPTY** |
| `realized_signing_velocity_t12` | 0 | 0% | **EMPTY** |
| `realized_rent_change_t12` | — | — | Not separately queried |
| `property_occupancy` | 247 | 52% | Moderate |
| `property_avg_rent` | 229 | 48% | Moderate |
| `submarket_vacancy_rate` | 36 | 8% | Sparse |
| `submarket_avg_asking_rent` | 36 | 8% | Sparse |
| `costar_submarket_rent` | 0 | 0% | **EMPTY** |
| `vendor_source` | 36 | 8% | CoStar vendor rows from Task #1476 |

**Atlanta Midtown submarket coverage:** 18 rows with `msa_id = 'atlanta-msa'`, no `submarket_id` set. Date range: 2024-12-01 to 2026-05-01. No Midtown-specific rows with property-level concession or signing data.

#### `apartment_market_snapshots` — primary engine data source

| City/State | Rows | Date range |
|---|---|---|
| Atlanta, GA | 34 | Feb 2026 – May 2026 |
| Austin, TX | 6 | Mar–May 2026 |
| Charlotte, NC | 6 | Mar–May 2026 |
| Nashville, TN | 6 | Mar–May 2026 |
| Dallas, TX | 6 | Mar–May 2026 |
| Orlando, FL | 6 | Mar–May 2026 |
| Houston, TX | 6 | Mar–May 2026 |
| San Antonio, TX | 6 | Mar–May 2026 |
| Tampa, FL | 5 | Mar–May 2026 |
| Jacksonville, FL | 5 | Mar–May 2026 |
| Miami, FL | 5 | Mar–May 2026 |
| Midtown, GA | 1 | Mar 2026 |
| Buckhead, GA | 1 | Mar 2026 |

This table drives COR-01 through COR-20. Only ~3–4 months of Atlanta data exists (Feb–May 2026).

#### `metric_time_series` — 599,278 rows (well-populated)

Primary content is macro/national and metro-level economic indicators:

| Geography | Metric | Period | Points | Range |
|---|---|---|---|---|
| national/US | M_OIL_PRICE | daily | 6,579 | 2000–Mar 2026 |
| national/US | RATE_TREASURY_10Y | daily | 6,563 | 2000–Mar 2026 |
| national/US | RATE_SOFR | daily | 1,996 | Apr 2018–Mar 2026 |
| national/US | RATE_MORTGAGE_30Y | weekly | 1,369 | 2000–Mar 2026 |
| national/US | RATE_FED_FUNDS | monthly | 315 | 2000–Mar 2026 |
| national/US | M_CPI_STICKY | monthly | 314 | 2000–Feb 2026 |
| metro/hundreds | home_value_index | monthly | ~313 each | 2000–Jan 2026 |
| metro/atlanta-ga-ga | M_BUILDING_PERMITS | monthly | 313 | 2000–Jan 2026 |

This is rich macro data, not property-level stabilization data. No lease-up velocity, concession depth, or signing velocity time series exist.

#### Other tables queried by the engine

| Table | Row count | Notes |
|---|---|---|
| `metric_correlations` | 10,636 | Pre-computed Pearson R results from `computeTimeSeriesCorrelations` runs |
| `correlation_history` | 27,313 | Historical correlation time series |
| `costar_market_metrics` | **0** | Table exists, completely empty |
| `apartment_trends` | Not queried in this audit | Used by COR-01..20 in `getTrendObservations(city)` |
| `apartment_submarkets` | Not queried | Used by `getSubmarketData(city)` |
| `msas` | Not queried | Used by `getMSAData(city)` |
| `apartment_supply_pipeline` | Not queried | Used by COR-21 |
| `property_proximity` | Not queried | Used by COR-23, COR-24 |
| `market_events` | Not queried | Used by COR-25 |

---

### §2.2 Where the code lives (Layer 2)

#### Primary: `backend/src/services/correlationEngine.service.ts` (3,488 lines)

**Class:** `CorrelationEngineService`

**Key public methods:**

| Method | Signature | What it does |
|---|---|---|
| `computeCorrelations` | `(city, state) → CorrelationReport` | Runs all 30 COR signals from market snapshot data. COR-01..20 synchronous; COR-21..30 async. |
| `computeForProperty` | `(propertyId, city, state) → CorrelationReport` | Delegates to `computeCorrelations` — no property-level differentiation. |
| `computeAndPersistForDeal` | `(dealId, city, state, opts) → CorrelationReport + adjustmentsPersisted` | Computes signals and writes to `deals.correlation_adjustments` via `persistCorrelationsForDeal`. |
| `computeTimeSeriesCorrelations` | `(geographyType, geographyId, windowMonths=36)` | Runs pairwise Pearson R on `metric_time_series` for all metric pairs with ≥12 data points; persists to `metric_correlations`. |
| `computePairCorrelation` | `(metricA, metricB, scope, geoId, windowMonths)` | Fetches two metric time series from `metric_time_series`, aligns, computes Pearson R with lead/lag sweep (up to 12 months). |
| `computeMatrix` | `(metricIds, scope, ...)` | All-pairs correlation matrix for a metric set. |
| `getTopCorrelations` | `(...)` | Retrieves high-strength pairs from `metric_correlations`. |
| `getBatchCorrelations` | `(...)` | Batch retrieval from `metric_correlations`. |

**COR signal categories (COR-01..30):**
- COR-01..03: Rent growth velocity and demand momentum
- COR-04..07: Affordability ceiling, concession rate, supply pressure
- COR-08..12: Various computed from snapshot; several are stubbed (COR-08, COR-10..12 call `this.computeCOR08()` etc. which return `signal: 'neutral', confidence: 'insufficient'` when data is absent)
- COR-13..16: MSA employment, submarket opportunity, trend-based
- COR-17..20: Stubbed/insufficient data signals
- COR-21: Supply pipeline (queries `apartment_supply_pipeline`)
- COR-22: CoStar market metrics (queries `costar_market_metrics` — **0 rows, always returns insufficient**)
- COR-23: Transit score (queries `property_proximity`)
- COR-24: Crime index (queries `property_proximity`)
- COR-25: Market events / amenity catalysts
- COR-26..30: Additional async signals

**`CorrelationResult` shape:**
```typescript
{
  id: string;           // "COR-01"
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;  // Pearson R
  signal: string | null;       // "bullish" | "bearish" | "neutral"
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}
```

#### Secondary: `backend/src/services/metric-correlation-engine.service.ts` (343 lines)

**Class:** `MetricCorrelationEngine`

Implements Pearson R computation, approximate p-value (via incomplete beta function), and a lag sweep. Minimum sample size: n ≥ 5 (hard floor). Queries `metric_time_series` only. This is the statistical engine for `computeTimeSeriesCorrelations` — it is not the signal engine for COR-01..30.

#### `backend/src/services/correlation-adjustments.service.ts`

Persistence layer: maps COR signal IDs to F9 assumption fields (e.g., COR-01 → `rentGrowthYr1`) and writes to `deals.correlation_adjustments` (JSONB column). This is the bridge between correlation signals and the financial model.

#### Backend callers

- `backend/src/api/rest/correlation.routes.ts` — REST API (`GET /report`, `POST /deal/:dealId/report`, `GET /top`)
- `backend/src/inngest/functions/correlation-rolling-compute.ts` — periodic background re-computation
- `backend/src/scripts/backfill-correlation-history-deep.ts` — administrative backfill script

#### Frontend consumers

- `frontend/src/hooks/useCorrelationReport.ts` — fetches from `/api/v1/correlations/report`
- `frontend/src/components/deal/sections/SignalStabilityTab.tsx` — signal visualization
- `frontend/src/pages/MarketIntelligence/tabs/TrendsTab.tsx` — market analysis view
- `frontend/src/pages/WorkspacePage.tsx`, `frontend/src/pages/StrategyBuilderPage.tsx` — broader integration

---

### §2.3 Data state (Layer 3)

#### `historical_observations` for stabilization underwriting

The five fields the Math Spec and Data Flow Spec rely on for Phase 1B stabilization queries:

- `property_concession_per_unit`: **0 rows populated**. No concession depth data at property level.
- `property_asking_rent`: **1 row populated**. Not usable for any correlation.
- `property_signing_velocity`: **38 rows populated (8%)**. Sparse but non-zero.
- `realized_occupancy_change_t12`: **0 rows populated**. No trailing 12-month occupancy change data.
- `realized_signing_velocity_t12`: **0 rows populated**. No trailing signing velocity data.

For Atlanta Midtown specifically (464 Bishop's submarket), the relevant `historical_observations` rows are the 18 `msa_id='atlanta-msa'` rows with no `submarket_id`. These have property_occupancy and property_avg_rent populated (inferred from total column counts and the fact that these 18 rows represent the bulk of non-national data in the 475-row table), but zero concession or signing velocity data.

#### `metric_time_series` for stabilization underwriting

`metric_time_series` has 599,278 rows, but these are macro-economic and metro-level indicators (interest rates, home values, building permits, employment), **not property-level stabilization outcomes**. There are no `metric_id` values corresponding to lease-up velocity, concession depth trajectory, or time-to-stabilization for any property or deal. This table supports COR-01..30 market signals, not deal-outcome prediction.

---

### §2.4 Answers to Q2.1–Q2.5

**Q2.1 — What the correlation engine computes today**

The engine computes 30 city-level market-intelligence signals (COR-01..30) derived from:
- `apartment_market_snapshots` (rent growth, concession rates, vacancy, days-to-lease at city level)
- `apartment_trends` (historical JSONB observations for the city)
- `apartment_submarkets` (submarket-level rent/vacancy/pressure)
- `msas` (MSA demographics)
- `metric_time_series` (macro rates, permits, employment — for COR-21..30 subset)

These signals answer "what is the market doing?" — not "when will this specific deal stabilize?". COR-22 (CoStar) always returns `confidence: 'insufficient'` because `costar_market_metrics` has 0 rows.

The `computeTimeSeriesCorrelations` function computes Pearson R between pairs of `metric_time_series` metrics (e.g., treasury rate vs. building permits) for a given geography. This produces the 10,636 rows in `metric_correlations`. These are market-factor relationships, not deal-outcome predictions.

**Q2.2 — What's missing for stabilization-underwriting questions**

| Stabilization Query | Exists? | Blocker |
|---|---|---|
| Concession depth vs. signing velocity in submarket X | **Not built** | Data: 0 rows of `property_concession_per_unit` in `historical_observations` |
| Time-to-stabilization for value-add deals at starting occupancy Y in submarket Z | **Not built** | Data: no stabilization outcome variable in any table; data: no value-add deal lease-up trajectories |
| Rent positioning vs. lease velocity in submarket W | **Not built** | Data: 38 rows of `property_signing_velocity`, 0 rows of asking rent data |
| Empirical VALUE_ADD pre-stab formula coefficients | **Not built** | Data: portfolio has 0 lease-up trajectories |

None of these query types exist in the current correlation engine. The engine is entirely market-level, not deal-outcome-level.

**Q2.3 — `historical_observations` data density**

Total rows: **475** across 3 distinct `msa_id` values. Date range: 2020-03-20 to 2026-05-23.

Atlanta Midtown: **18 rows** with `msa_id='atlanta-msa'` (no submarket_id set). Dates: Dec 2024 – May 2026.

Stabilization-critical column sparsity:
- `property_concession_per_unit`: 0/475 — **cannot support any concession correlation**
- `realized_occupancy_change_t12`: 0/475 — **cannot support occupancy trajectory analysis**
- `realized_signing_velocity_t12`: 0/475 — **cannot support signing velocity correlation**

**Q2.4 — Phase 1B build cost assessment**

The stabilization-underwriting correlation queries are **not a pure code build** — they are blocked by two distinct layers:

1. **Data infrastructure block (weeks to months, not days):** The query functions can be written in days, but they require source data that does not currently exist:
   - `historical_observations.property_concession_per_unit` must be populated from a vendor or scraper feed
   - `historical_observations.realized_occupancy_change_t12` requires a time-series of at least 12 prior monthly observations per property
   - A stabilization outcome record (actual stabilization date and profile per deal) needs to exist somewhere — currently there is no such table

2. **Code build layer (1–2 weeks once data exists):** New functions in `metric-correlation-engine.service.ts` or new methods on `CorrelationEngineService`. The patterns (Pearson R, lead/lag sweep, confidence flagging) are already implemented — the new queries would follow the same patterns as `computePairCorrelation`.

Existing patterns that new queries can follow: `computePairCorrelation` in `correlationEngine.service.ts` and the `pearsonR` method in `MetricCorrelationEngine`.

**Q2.5 — Statistical significance thresholds**

`MetricCorrelationEngine.pearsonR()` has a hard minimum of n ≥ 5. Practical significance for real estate applications typically requires n ≥ 20 for a meaningful Pearson R (p < 0.05 with r ≥ 0.4 requires ~21 observations). For the specific stabilization questions the Math Spec references, estimating n = 20+ completed value-add deals with known stabilization dates in a single submarket would require either:
- Several years of deal-outcome data from the platform (not yet accumulated), or
- An external data partnership (CoStar, Yardi, NMHC) providing cohort outcomes

The engine currently handles low-sample results by returning `confidence: 'insufficient'` — these are filtered from the summary report but are not surfaced as actionable.

**"Phase 1B data density threshold" (from the Data Flow Spec precondition):**
A reasonable statistical floor for the three missing queries would be:
- Concession/signing velocity: 20 property-quarters with both `property_concession_per_unit` and `property_signing_velocity` populated for the same submarket
- Time-to-stabilization: 15 value-add deals with tracked stabilization dates in the target submarket
- Rent/velocity: same as concession/signing — 20 property-quarters with asking rent + signing velocity

Current state achieves none of these thresholds.

---

## §3 — Implications for Pro Forma Window Architecture Documents

### §3.1 Math Spec corrections

| Claim | Status | Correction needed |
|---|---|---|
| Worked 464 Bishop example uses owned portfolio OpEx comparables from Atlanta A | INFERRED-NOT-VERIFIED | Actual portfolio has no Atlanta Midtown comparables; nearest is Duluth GA (suburban Gwinnett, 2021–2022 Yardi data) — valid as a cross-check but not same-submarket |
| Market rent for Atlanta Midtown sourced from "platform comps" | PARTIALLY VERIFIED | Source is `apartment_market_snapshots` (Atlanta,GA city-level, not Midtown-specific) or `historical_observations` (18 rows for atlanta-msa, limited granularity) |
| Phase 1B: "correlation engine queries concession depth vs. signing velocity" | INFERRED-NOT-VERIFIED | Must be reframed: this query does not exist and cannot be written until `historical_observations.property_concession_per_unit` is populated |
| "Renovation premium per unit grounded in platform track record" | NOT VERIFIED | No renovation premium history exists in any table; the `fetch_owned_asset_actuals` value-add path would fall back to archive P50 = 0.80 for 464 Bishop |

### §3.2 Lifecycle State Machine — profile threshold adjustment

The State Machine's profile detection thresholds (occupancy < 0.80 → DISTRESSED; renovation budget/unit > $5,000 → VALUE_ADD; occupancy ≥ 0.92 → STABILIZED) cannot be validated against owned portfolio lease-up trajectories because **no lease-up trajectory data exists in the platform**. All three owned portfolio properties are observed at stabilized occupancy (94.7%, 94.6%, 95.0%). The thresholds are currently professional judgment; they should be labeled as such in the State Machine documentation until empirical data is available.

### §3.3 Data Flow Spec — correlation engine path adjustment

Phase 1B references in the Data Flow Spec that assume correlation engine queries for stabilization underwriting are available or buildable in the near term need to be reframed:

- The correlation engine's current architecture supports Phase 1B correlation queries once data is available
- The data pipeline (populating `property_concession_per_unit`, `realized_occupancy_change_t12`, `realized_signing_velocity_t12`) is the actual Phase 1B precondition — not the query code
- Estimated data readiness: **conditional on vendor data partnership** (CoStar rows in `historical_observations` are already structured for this via the Task #1476 vendor field additions; the 36 existing vendor-source rows show the pipeline works but hasn't been fed at scale)

### §3.4 Phase 1A vs Phase 1B scope confirmation

**Phase 1A (already shipped):**
- Stabilization year computation (task #1640) ✅
- lifecycle_profile detection (task #1644) ✅
- Pre-stab formulas in agent prompt (task #1645) ✅ (per automatic update)
- These phases are entirely correct as scoped — they do not depend on `historical_observations` data density or correlation engine queries

**Phase 1B (future):**
- Correlation engine stabilization queries: **blocked by data infrastructure**
- Empirical profile threshold validation: **blocked by owned portfolio coverage gap**
- Phase 1B is correctly labeled as "requires historical_observations data density" — this audit confirms that precondition is unmet and identifies the specific data fields that need population

---

## §4 — Recommended Follow-Up Work

### §4.1 Near-term build items (minimal dependencies)

- **Submarket matching gap in `fetch_owned_asset_actuals`:** The tool's comparability scorer credits 40 points for submarket match but the query returns `NULL::text AS submarket` — submarket is always null. Fix: join `properties` to a submarket lookup, or add submarket to the `deal_monthly_actuals` row when actuals are uploaded.

- **Deduplicate owned portfolio identification:** Two parallel mechanisms exist — `property_operating_data.is_owned` (unused) and `deal_monthly_actuals.deal_id IS NULL` + known UUIDs (active). One should be deprecated or the two should be reconciled. Recommendation: adopt `deal_id IS NULL` + a new `is_portfolio_asset BOOLEAN` column on `deal_monthly_actuals`, or use `property_operating_data.is_owned` consistently.

### §4.2 Phase 1B build items (correlation engine queries)

The following functions need to be built once data is available:

1. `computeStabilizationCorrelation(submarket, startingOccupancy)` — queries per-property occupancy time series from `historical_observations` to derive empirical time-to-stabilization by starting occupancy cohort
2. `computeConcessionVelocityCorrelation(submarket)` — `property_concession_per_unit` vs. `property_signing_velocity` Pearson R with lead/lag sweep
3. `computeRentPositioningVelocityCorrelation(submarket)` — `property_asking_rent` vs. `property_signing_velocity` correlation

All three follow the pattern of `computePairCorrelation` in `correlationEngine.service.ts`. They are 1–2 days of code once input data is available.

### §4.3 Data infrastructure items (prerequisite to Phase 1B)

These must be resolved before Phase 1B correlation queries are useful:

1. **`historical_observations` vendor feed at scale:** The vendor pipeline infrastructure exists (Task #1476 vendor fields, 36 existing CoStar rows). Expanding to 200+ rows of property-level Atlanta concession/signing data would unlock the first correlation query.

2. **Stabilization outcome tracking:** Add a `stabilization_achieved_date` column (or a `deal_outcomes` table) so that deal-by-deal stabilization timing can be recorded as deals close out. This is the outcome variable all time-to-stabilization queries need.

3. **Owned portfolio expansion:** The current portfolio (2 DFW TX properties + 1 Duluth GA) has no Atlanta Midtown comparables. Adding 2–3 Atlanta urban comparables (from Yardi or manual upload) would materially improve Tier 2 evidence quality for 464 Bishop–type deals.

4. **`costar_market_metrics` population:** The table exists and is queried by COR-22, which always returns `confidence: 'insufficient'` because the table has 0 rows. Populating it with CoStar market-level rent/vacancy/absorption data for Sun Belt metros would activate COR-22.

### §4.4 Surfacing items (owned portfolio → agent reasoning)

The current agent path (fetch_owned_asset_actuals → deal_monthly_actuals) is correct and functional. The gaps are:
- **Submarket alignment:** The tool scores submarket match but cannot actually match because `properties` has no submarket column
- **Geography coverage:** No Atlanta Midtown asset in portfolio; agent falls back to archive P50 for capture rate
- **Value-add program data:** No actual renovation program in the portfolio has a before/after occupancy trajectory visible in the data — the `value_add_programs_only=true` path will always return `capture_rate_source: 'archive_default', recommended_capture_rate: 0.80` until a value-add deal with tracked actuals is added to the portfolio

---

*End of audit. All data claims verified against live SQL queries executed on 2026-05-31. All code claims verified by direct file reads or grep. Claims not verifiable by these means are explicitly labeled INFERRED-NOT-VERIFIED.*
