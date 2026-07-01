# DISPATCH — Market-Data vs Tenant Property Read Classification

**Date:** 2026-06-30  
**HEAD SHA:** `9688414da0daab16ac8f382f5ed0ca666f5eae2b`  
**Mode:** READ-ONLY — no schema changes, no query changes.  
**Precondition:** Phase 1 of properties.org_id audit complete (`docs/audits/PROPERTIES_ORG_ID_VERDICT.md`).  
**Evidence rule (S1-01):** every classification carries `file:line` and what it returns.

---

## The Two Populations

| Population | Count | Characteristics |
|---|---|---|
| **TENANT properties** | 35 | Have `deal_id` / `deal_properties` link. After Phase 2 backfill: 29 will have `org_id = dd201183`; 6 will have `org_id IS NULL` (fixture×5, f2a-test×1). |
| **MARKET-DATA properties** | 1,059,994 | ArcGIS / Georgia county ingest. `deal_id IS NULL`, `created_by IS NULL`, no `deal_properties` entry. `org_id = NULL` forever. |

**Step 4 cannot apply one rule to both.** A blanket `WHERE org_id = $workspace` strips ALL 1.06M market rows from every workspace.

---

## Read-Site Classification Table

### TENANT reads — only return deal-linked / portfolio properties

| `file:line` | Query pattern | What it returns | Step-4 treatment |
|---|---|---|---|
| `agents/cashflow.config.ts:444` | `LEFT JOIN properties p ON p.deal_id = d.id` | property for a deal | already deal-scoped, no change |
| `agents/cashflow.inngest.ts:823` | `LEFT JOIN properties p ON p.id = dp.property_id` (via `deal_properties`) | deal's linked property | already deal-scoped |
| `agents/cashflow.inngest.ts:845` | `WHERE id = $1` | single property by ID | already ID-scoped |
| `agents/supply.inngest.ts:96` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's linked property | already deal-scoped |
| `agents/tools/fetch_m35_event_forecast.ts:132` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's linked property | already deal-scoped |
| `agents/tools/fetch_owned_asset_actuals.ts:232,426` | `JOIN properties p ON p.id = dma.property_id` | owned portfolio properties | already portfolio-scoped |
| `agents/tools/fetch_property_vault_intel.ts:162,181` | `WHERE p.parcel_id = pd.parcel_id` / id | specific property vault | already parcel/id-scoped |
| `agents/zoning.inngest.ts:97` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's linked property | already deal-scoped |
| `api/graphql/resolvers/property.resolvers.ts:16` | `WHERE id = $1` | single property by ID | already ID-scoped |
| `api/rest/cashflow-underwriting.routes.ts:110` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's property | already deal-scoped |
| `api/rest/clawdbot-webhooks.routes.ts:218,907` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's property | already deal-scoped |
| `api/rest/comp-query.routes.ts:91` | `WHERE p.id = $1 LIMIT 1` | single property location metadata | already ID-scoped; market comps come from `market_rent_comps`/`market_sale_comps` — not `properties` |
| `api/rest/dashboard.routes.ts:483,667` | `JOIN properties p ON p.id = dp.property_id` | deal's property | already deal-scoped |
| `api/rest/data-library-files.routes.ts:73` | `LEFT JOIN properties p ON p.parcel_id = dlf.parcel_id` | parcel-specific | already parcel-scoped |
| `api/rest/deal-assumptions.routes.ts:279` | `FROM properties p JOIN deal_properties dp ON dp.property_id = p.id WHERE dp.deal_id = $1` | deal's property | already deal-scoped |
| `api/rest/demand.routes.ts:319` | `LEFT JOIN properties p ON p.deal_id = d.id` | deal's property | already deal-scoped |
| `api/rest/financial-documents.routes.ts:266` | `SELECT id FROM properties WHERE id = $1` | existence check | already ID-scoped |
| `api/rest/forward-supply.routes.ts:84` | `SELECT p.msa_id FROM properties WHERE p.deal_id = $1 LIMIT 1` | deal's MSA | already deal-scoped |
| `api/rest/grid.routes.ts:289,339` | `JOIN properties p ON p.id = dp.property_id` | deal's property | already deal-scoped |
| `api/rest/historical-observations.routes.ts:151` | `LEFT JOIN properties p ON p.id = dp.property_id` | deal's property | already deal-scoped |
| `api/rest/inline-deals.routes.ts:309` | `LEFT JOIN properties p_linked ON p_linked.id = dp_link.property_id` | deal's linked properties | already deal-scoped |
| `api/rest/inline-deals.routes.ts:578,592` | `NOT EXISTS (SELECT 1 FROM properties WHERE deal_id = $1)` | existence check | already deal-scoped |
| `api/rest/inline-deals.routes.ts:1164` | `JOIN properties p ON dp.property_id = p.id` | deal's property | already deal-scoped |
| `api/rest/leasing-traffic.routes.ts:63,164,334` | `FROM properties WHERE id = $1` | single property by ID | already ID-scoped |
| `api/rest/leasing-traffic.routes.ts:566,609,715` | `FROM properties WHERE deal_id = $1 LIMIT 1` | deal's property id | already deal-scoped |
| `api/rest/leasing-traffic.routes.ts:875` | `SELECT city, state_code FROM properties WHERE deal_id = $1 LIMIT 1` | deal's location | already deal-scoped |
| `api/rest/leasing-traffic.routes.ts:1059` | `SELECT id, latitude, longitude FROM properties WHERE id = $1` | single property by ID | already ID-scoped |
| `api/rest/lifecycle.routes.ts:766` | `LEFT JOIN properties p ON p.id = d.property_id` | deal's property | already deal-scoped |
| `api/rest/llm.routes.ts:263` | `JOIN properties p ON pa.property_id = p.id` | property analyses join | already ID-scoped |
| `api/rest/m27-comps.routes.ts:306,571` | `LEFT JOIN properties p ON p.deal_id = d.id` | deal's property | already deal-scoped |
| `api/rest/portfolio.routes.ts:28,37,121,248,301,373,465,495,510` | `JOIN properties p ON p.id = dma.property_id` and similar | portfolio/deal properties | already portfolio/deal-scoped |
| `api/rest/property-analytics.routes.ts:20,27` | `FROM properties p JOIN deal_properties` / `WHERE deal_id = $1` | deal's property | already deal-scoped |
| `api/rest/property.routes.ts:130,216,278,339` | `WHERE id = $1` | single property CRUD | already ID-scoped |
| `api/rest/property.routes.ts:515,574` | `WHERE p.parcel_id = $1` / `WHERE p.deal_id = $1` | parcel/deal lookup | already parcel/deal-scoped |
| `api/rest/property.routes.ts:594` | `LEFT JOIN properties p ON p.parcel_id = pd.parcel_id` | vault intel join | already parcel-scoped |
| `api/rest/rankings.routes.ts:160` | `FROM properties WHERE id = $1 LIMIT 1` | single property by ID | already ID-scoped |
| `api/rest/revenue.routes.ts:774` | `LEFT JOIN properties p ON p.id = d.property_id` | deal's property | already deal-scoped |
| `api/rest/risk.routes.ts:175,798` | `JOIN properties p ON p.id = ta.property_id` | specific property | already ID-scoped |
| `api/rest/_market-resolution.ts:243,246` | `WHERE id = $1::uuid` / `WHERE deal_id = $1::uuid` | specific property resolver | already ID/deal-scoped |
| `services/deal-consistency-validator.service.ts:525` (via `getPropertyData`) | `JOIN properties` via deal | deal validation | already deal-scoped |
| `services/comp-query.service.ts:196` | `FROM properties WHERE id = $1` | subject property metadata | already ID-scoped |
| `services/compQueryEngine.ts` | `FROM properties WHERE id = $1` (subject) then `JOIN properties p ON p.id = cs.property_id` (v_comp_search join) | subject + comp subjects | ID-scoped; mass read is via `v_comp_search` view, not bare `properties` |

---

### MARKET reads — read the 1,059,994 ArcGIS corpus (admin/pipeline only)

These are admin-only or internal pipeline routes. No authenticated end-user reaches them directly from the Bloomberg terminal surfaces. They must stay global — a blanket org filter would break them.

| `file:line` | Query pattern | What it returns | Step-4 treatment |
|---|---|---|---|
| `api/rest/admin.routes.ts:253` | `FROM properties p LEFT JOIN property_zoning_cache WHERE pzc.property_id IS NULL LIMIT 500` | unmapped ArcGIS properties for zoning enrichment batch | MARKET — keep global; admin pipeline |
| `api/rest/admin.routes.ts:525` | `SELECT count(*) FROM properties` | total property count (admin stats) | MARKET — keep global |
| `api/rest/admin.routes.ts:613` | `SELECT count(*) as cnt FROM properties` | zoning coverage denominator | MARKET — keep global |
| `api/rest/admin-api-key.routes.ts:70` | `COUNT(*), COUNT(current_zoning) FILTER(...), COUNT(lat) FILTER(...) FROM properties` | API stats dashboard counts | MARKET — keep global |
| `api/rest/data-tracker.routes.ts:38` | `COUNT(*), COUNT(DISTINCT city), COUNT(DISTINCT state_code) FROM properties` | internal stats (total, city, state coverage) | MARKET — keep global; internal tracker |
| `api/rest/atlanta-url-discovery.routes.ts:102,114` | `FROM properties WHERE UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON','DEKALB')` | Atlanta ArcGIS properties without assessor URLs | MARKET — keep global; admin pipeline, requireAdminAuth |
| `api/rest/llm.routes.ts:199` | `COUNT(*), AVG(lot_size_sqft), property_type FROM properties WHERE city ILIKE $1 AND state_code = $2 GROUP BY property_type` | city-level aggregates for LLM market briefing | **MARKET — user-facing.** LLM market context feature reads the ArcGIS corpus. Must stay global. See §3. |
| `services/dealAnalysis.ts:109` | `FROM properties p JOIN deals d ON d.id = $1 WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))` | ALL properties within a deal's geographic boundary — reads ArcGIS corpus | **MARKET — user-facing.** JEDI Score / deal analysis feature reads the ArcGIS corpus. Must stay global. See §3. |

---

### MIXED reads — return BOTH tenant and market rows, or could

These are the dangerous cases for Step 4. Each needs a split or an explicit predicate.

| `file:line` | Query pattern | Why MIXED | Step-4 treatment |
|---|---|---|---|
| `api/rest/property.routes.ts:33` | `SELECT * FROM properties WHERE 1=1` + optional city/state/type/zip/address filters | No deal/org filter; returns all matching properties in DB — includes ArcGIS rows when filters match (e.g. `address ILIKE '%2789 Satellite%'` would return both tenant Highlands AND ArcGIS rows at same address) | **SPLIT**: when serving the deal workspace, add `AND (org_id = $ws OR is_market_data = TRUE)`. Agent `fetch_parcel` lookup by address uses this endpoint and legitimately needs to search market data. |
| `api/graphql/resolvers/property.resolvers.ts:32` | `SELECT * FROM properties WHERE 1=1` + filters | Same as above — GraphQL variant | **SPLIT**: same treatment as above |
| `api/graphql/resolvers/property.resolvers.ts:69` (`propertiesNearby`) | `FROM properties WHERE ST_DWithin(location, ST_SetSRID(ST_Point($1,$2),...), $3)` | Geo proximity search; returns all properties (ArcGIS + tenant) within a radius | **SPLIT**: geo search legitimately needs market rows (comp candidates nearby); org-scope only the owned/deal rows if both are required simultaneously |
| `api/rest/inline-data.routes.ts:57` | `SELECT * FROM properties` + optional `city` filter, **NO requireAuth on this route** | Unauthenticated endpoint returning all properties. Currently returns everything — ArcGIS rows included. No auth, no limit on population. | **SPLIT + AUTH FIX**: needs `requireAuth` added, then split to return only `is_market_data = TRUE` rows (it's a supply/market data endpoint under `/supply/properties`) |
| `api/rest/inline-deals.routes.ts:1347` | `FROM properties p JOIN deals d ON d.id = $1 WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))` | Same as `dealAnalysis.ts:109` — ST_Contains over ALL properties for lease-expiration analysis | **MARKET** for the ArcGIS rows it pulls; but the intent is to find ALL properties (ArcGIS comps + owned) inside the deal boundary. Classify as MIXED — apply `is_market_data = TRUE OR org_id = $ws` predicate |
| `api/rest/_market-resolution.ts:252` | `FROM properties WHERE name IS NOT NULL` (full table scan for slug-matching) | Scans all 1.06M rows looking for slug-match. In practice, very few ArcGIS rows have names, so almost all matches are tenant rows — but the scan itself touches everything. | Low risk in practice; after `is_market_data` flag lands, add `AND is_market_data = FALSE` to limit the scan to the 35 + 1,556 apartment_locator_ai named rows |
| `api/rest/property.routes.ts:357` (`/nearby/:lat/:lng`) | `FROM properties WHERE ST_DWithin(location, ...)` | Geo proximity search; returns all properties near a lat/lng | Note: `location` is NOT in the current 101-column schema — this route is likely dead/stale. Confirm before treating as live MIXED. If live: same SPLIT treatment as `propertiesNearby`. |

---

## §3 — User-Facing Features That Read the 1.06M Market Rows

**YES** — two user-facing features confirmed read the ArcGIS corpus. They must NOT be org-scoped.

### A. JEDI Score / Deal Boundary Analysis
**File:** `backend/src/services/dealAnalysis.ts:109`  
**Also:** `backend/src/api/rest/inline-deals.routes.ts:1347`  
**Query:** `FROM properties p JOIN deals d ON d.id = $1 WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))`  
**Feature:** Deal analysis that computes JEDI Score and development capacity. Pulls ALL properties (including the 1.06M ArcGIS rows) inside a deal's geographic boundary to count comps, calculate market signals, and generate recommendations. Without the ArcGIS corpus, deals in Georgia/Atlanta would have near-zero boundary hits.  
**Treatment:** Must stay global. Do not add org filter. After `is_market_data` flag lands, the query naturally reads both populations — that's correct behavior.

### B. LLM Market Briefing
**File:** `backend/src/api/rest/llm.routes.ts:199`  
**Query:** `COUNT(*), AVG(lot_size_sqft), property_type FROM properties WHERE city ILIKE $1 AND state_code = $2 GROUP BY property_type`  
**Feature:** AI-generated market context / analysis. Aggregates over all properties in a city+state to produce market statistics (avg lot size, property type breakdown) for an LLM prompt. With only 35 tenant properties, any Atlanta query would return a count of ~1-2, which is meaningless. The value comes entirely from the 1.06M ArcGIS rows.  
**Treatment:** Must stay global. Do not add org filter.

---

## §4 — How to Distinguish Market-Data from Tenant at Query Time

### Current state: no clean existing flag

The `enrichment_source` column has only two values:
- `NULL`: 1,058,473 rows (ArcGIS rows AND some tenant rows — not a clean signal)
- `'apartment_locator_ai'`: 1,556 rows (subset of the ArcGIS corpus)

No `is_market_data`, `data_source`, `is_comp`, `ingest_type`, or similar column exists on `properties`.

**After Phase 2 org_id backfill:**
- `org_id IS NOT NULL`: 29 tenant rows (reliable tenant signal)
- `org_id IS NULL`: 1,060,000 rows — **this conflates ArcGIS market data (1,059,994) with the 6 deliberate nulls (5 fixture + 1 f2a test)**

`org_id IS NULL` alone is NOT a sufficient market-data predicate.

### The 6 Deliberate Nulls — how they differ from market data

| ID | Type | `deal_id`/`created_by` | `is_fixture` on linked deal | Notes |
|---|---|---|---|---|
| `27ccb328`, `40d8d4c3`, `445ae2d8`, `79a63134`, `b30fdc32` | Fixture eval properties | have `deal_id` set | `TRUE` | distinguishable via join to `deals.is_fixture` |
| `5948f2f2` | f2a test residue | has `created_by = f2a-operator` | `FALSE` (non-fixture deal) | deletion-pending; currently indistinguishable from market data by `properties` columns alone |

The 5 fixture properties can be distinguished today by: `EXISTS (SELECT 1 FROM deals d WHERE d.id = p.deal_id AND d.is_fixture = TRUE)`. But this requires a join, and the predicate must be maintained as fixtures change.

The f2a test property (`5948f2f2`) has no distinguishing column — it has `created_by IS NOT NULL` but so might future legitimate tenant properties pre-Phase-2-backfill.

### Recommendation: net-new `is_market_data` flag

**Verdict: a net-new `is_market_data BOOLEAN NOT NULL DEFAULT FALSE` column is required for Step 4.**

Rationale:
1. No existing column cleanly identifies the 1,059,994 ArcGIS rows without a join.
2. `org_id IS NULL` conflates ArcGIS rows with the 6 deliberate nulls — using it as the market-data predicate would incorrectly include fixture/test properties in market reads.
3. A flag set at ingest time is zero-join-cost at query time (indexable, predicate-pushdown friendly).
4. Mirrors `is_fixture` on `deals` — the same pattern already in use.

**Backfill predicate (safe — derived from the link audit):**
```sql
UPDATE properties
SET is_market_data = TRUE
WHERE deal_id IS NULL
  AND id NOT IN (SELECT property_id FROM deal_properties)
  AND created_by IS NULL;
-- Expected: 1,059,994 rows (confirmed via no_link_at_all count)
```

This correctly excludes:
- The 5 fixture properties (they have `deal_id IS NOT NULL`)
- The f2a test property `5948f2f2` (it has `created_by IS NOT NULL`)
- All 29 Tier-1 tenant properties (they have deal/join-table links or created_by)

### Step-4 split predicates (to be implemented in a separate approved dispatch)

| Read type | Predicate | Notes |
|---|---|---|
| Tenant reads | `WHERE org_id = $workspace_org_id` | Post Phase-2 backfill; applies to all deal-linked queries that currently use `WHERE id = $1` or `JOIN deal_properties` — they're already safe without change |
| Market reads | `WHERE is_market_data = TRUE` (or no filter — they already return the right rows) | No change needed to queries that already restrict by deal/id |
| MIXED reads requiring both | `WHERE (org_id = $workspace_org_id OR is_market_data = TRUE)` | Applies to the 6 MIXED sites above |
| Admin/pipeline reads | No change — they need the full corpus | Keep global |

---

## §5 — MIXED Sites Prioritized by Risk

These are where Step 4 is most likely to break something. Priority order:

### Priority 1 — CRITICAL (active user-facing, no auth protection)
**`api/rest/inline-data.routes.ts:57`** — `GET /supply/properties`  
Unauthenticated endpoint. Returns all properties (ArcGIS included) filtered by optional city. No `requireAuth`. This is the highest-risk site: leaks market data to unauthenticated callers AND would be the widest MIXED read post-Step-4. **Needs `requireAuth` added AND a population decision (supply/market endpoint → return `is_market_data = TRUE` rows only).**

### Priority 2 — HIGH (agent lookup that legitimately needs both populations)
**`api/rest/property.routes.ts:33`** — `GET /api/v1/properties`  
Used by agent `fetch_parcel` tool for address-based lookup. The agent should search market data too (comps are in the ArcGIS corpus). After Step 4: add `AND (org_id = $ws OR is_market_data = TRUE)` so address search hits both tenant properties and ArcGIS comps. Without this, the agent loses the ability to look up ArcGIS properties by address.

### Priority 3 — HIGH (GraphQL variant of same)
**`api/graphql/resolvers/property.resolvers.ts:32`** — `properties` query  
Same pattern as above, GraphQL variant. Same treatment.

### Priority 4 — MEDIUM (geo proximity, both populations needed)
**`api/graphql/resolvers/property.resolvers.ts:69`** — `propertiesNearby`  
Geo proximity returns all nearby properties. Step 4: add `AND (org_id = $ws OR is_market_data = TRUE)`.

### Priority 5 — LOW (name-slug full scan, rare code path)
**`api/rest/_market-resolution.ts:252`** — `WHERE name IS NOT NULL` scan  
Rare fallback path for slug-based lookup. After `is_market_data` flag: add `AND is_market_data = FALSE` to limit scan to named tenant + apartment_locator_ai properties only (eliminates scanning 1.06M mostly-unnamed ArcGIS rows).

### Priority 6 — VERIFY DEAD before acting
**`api/rest/property.routes.ts:357`** — `nearby/:lat/:lng` with `location` column  
The `location` column does NOT appear in the current 101-column `properties` schema. This query likely errors silently or returns 0 rows. Verify the endpoint is live before treating it as a real MIXED site.

---

## One-Line Verdict

**TWO-POPULATION SPLIT required.** At least two user-facing features (JEDI Score boundary analysis and LLM market briefing) read the 1,059,994 ArcGIS rows directly. Six MIXED read sites return both populations. A blanket org filter would break deal analysis, LLM market context, and agent address lookup.  

Step 4 must use a `is_market_data` flag (net-new column — no existing signal is sufficient) and apply the split predicate `WHERE (org_id = $ws OR is_market_data = TRUE)` at MIXED sites, while leaving pure MARKET and pure TENANT reads unchanged.

---

## Appendix — Out-of-Scope Confirmed

- **Phase 2 properties.org_id backfill** — separate approved dispatch (29 rows → `dd201183`). Must complete before Step 4.
- **`is_market_data` column DDL + backfill** — requires human approval, separate dispatch. Its `DEFAULT FALSE` ensures new properties (tenant-created) start as non-market.
- **Property INSERT org_id wiring** — 3 flagged sites (`property.routes.ts:173`, `property.resolvers.ts:87`, `deal-property-linker.service.ts:282`). Separate wiring dispatch.
- **f2a test property deletion** (`5948f2f2`) — dead-account cleanup, separate.
- **Step 4 read-scoping implementation** — this spec is its prerequisite. Do not scope any read here.
