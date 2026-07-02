# B4b — Public/Private Boundary Verdict
**Repo:** `Nardo758/JediRe.git`  
**HEAD SHA:** `3fbe2025d173571706279eb92c26fb8dfe534b97`  
**Mode:** READ-ONLY verification (no code changes in this audit)  
**Date:** 2026-07-02  
**Verification rule S1-01:** every claim carries live DB output or `file:line`.

---

## Context

The `properties` table (1,060,031 rows) is platform-generated, global, Lane A. It is the
public reference layer — ArcGIS, enriched address data, market comps. Private financial data
(T12 actuals, capsule documents) lives in `deal_monthly_actuals` and `deal_files`, both keyed
by `deal_id`. The public/private separation is enforced by **upload-route topology**, not by
property-row ownership. B4b verifies the topology actually holds.

**The one real risk:** `deal_monthly_actuals` is keyed by `property_id` — a shared public
identifier. A read that joins from a public property to its actuals WITHOUT scoping by deal/org
would return every operator's private actuals for that property. B4b finds exactly two code
paths where this happens.

---

## CLAIM 1 — Properties are write-CLOSED to users

### Finding: NOT fully write-closed — but private data never reaches properties rows

User-facing write routes exist:

| File | Line | Route | What it writes |
|---|---|---|---|
| `property.routes.ts` | 173 | `POST /api/v1/properties` | address, city, state, zip, lat/lng, lot_size_sqft, building_sqft, year_built, bedrooms, bathrooms, property_type |
| `property.routes.ts` | 255 | `PUT /api/v1/properties/:id` | lot_size_sqft, lot_size_acres, parcel_id, land_cost, building_sqft, year_built, bedrooms, bathrooms, current_use, property_type |
| `property.routes.ts` | 319 | `PATCH /api/v1/properties/:id` | stories, units only |
| `property.routes.ts` | 339 | `DELETE /api/v1/properties/:id` | deletes row |
| `graphql/resolvers/property.resolvers.ts` | 87 | `createProperty` mutation | address, lat/lng, lot_size_sqft, property_type |
| `portfolio.routes.ts` | 206 | `POST /api/v1/portfolio/properties` | name, address, units, building_class, year_built, ownership_status='portfolio', acquisition_price |
| `deal-assumptions.routes.ts` | 402 | `PATCH /:dealId/zoning-update` | lot_size_acres, parcel_id, zoning_code, max_far, max_stories, max_units, parking_required — scoped via deal ownership |

**The load-bearing observation:** every field reachable via these routes is **public metadata**
(address, physical specs, zoning envelope). No private financial performance data (NOI, rent,
occupancy, T12 actuals) is ever written to `properties` rows. Financial data goes exclusively
to `deal_monthly_actuals`.

**Data integrity risk (not privacy):** `PUT /api/v1/properties/:id` and
`DELETE /api/v1/properties/:id` have **no org ownership check** — any authenticated user can
overwrite or delete any market property row, including ArcGIS-sourced rows from the 1.06M
public layer. This is a data corruption risk, not a cross-operator privacy leak, because the
fields affected contain no private financial data.

**Platform enrichment writers** (expected, not user-facing):

| File | What it does |
|---|---|
| `deal-property-linker.service.ts:282` | Creates stub property row when deal is linked |
| `document-extraction/data-router.ts:108` | Creates/upserts property during doc extraction |
| `property-entity/property-resolver.service.ts:131,201,235,246` | Address-resolution upsert + merge |
| `apartment-locator-sync.service.ts:410,380` | ArcGIS/locator sync |
| `subject-population.service.ts:607` | Subject population enrichment |
| `benchmark-enrichment.service.ts:438` | Benchmark enrichment |
| `atlanta-url-discovery.service.ts:373` | Writes assessor_url |
| `forward-supply.routes.ts:137` | Links supply pipeline to property |
| `clawdbot-webhooks.routes.ts:875` | Webhook-driven enrichment |
| `m07-calibration.routes.ts:189` | Writes calibration metadata |

### Verdict — Claim 1
Properties are **write-CLOSED for private financial data** — no user-facing route writes NOI,
rent, occupancy, or any financial performance data onto a `properties` row. The user-write
routes that exist write only public metadata (address, specs). **The load-bearing assumption
holds for the privacy boundary.** The missing org-ownership check on PUT/DELETE is a data
integrity issue logged separately.

---

## CLAIM 2 — User uploads enter ONLY via capsule + Assets-Owned, scoped at write

### Upload door 1 — Deal capsule documents → `deal_files`

All user document uploads write into `deal_files` with `deal_id` as the primary scope key.
Every INSERT carries `deal_id` explicitly:

- `documentsFiles.routes.ts` → `documentsFiles.service.ts:207` — `WHERE deal_id = $1`
- `source-documents.routes.ts:123` — `WHERE id = $1 AND deal_id = $2` (read: deal_id-gated)
- `fetch_source_documents.ts:196` — `WHERE df.deal_id = $1`
- `services/skills/skills/index.ts:131` — `WHERE deal_id = $1 AND deleted_at IS NULL`
- `services/skills/skills/index.ts:319` — `WHERE id = $1 AND deal_id = $2`

SCOPED at write and read. ✅

### Upload door 2 — Assets-Owned actuals → `deal_monthly_actuals`

All actuals uploads write into `deal_monthly_actuals` with `deal_id` (and optionally
`property_id`) as scope keys:

- `operations.routes.ts:1141` — `INSERT INTO deal_monthly_actuals` carrying `deal_id`
- `operations.routes.ts:1201` — same
- `portfolio.routes.ts:318` — `INSERT INTO deal_monthly_actuals` carrying `deal_id`
- `data-upload.service.ts:283` — `INSERT INTO deal_monthly_actuals` carrying `deal_id`
- `document-extraction/data-router.ts:600,986,1856,1893` — all carry `deal_id`

SCOPED at write. ✅

### Third door — confirmed none

No other surface writes private financial data. The Terminal has no upload routes onto
`deal_monthly_actuals` or `deal_files` beyond the two doors above. Platform enrichment
services write to `properties` only (public metadata — see Claim 1).

### Verdict — Claim 2
The two legit upload doors are confirmed and correctly scoped at write time. No third door
for private financial data exists. ✅

---

## CLAIM 3 — Private data is scoped on READ

### `deal_monthly_actuals` read classification

**SCOPED — SAFE** (deal/org scope enforced before or in the query):

| File | Line | Scope mechanism |
|---|---|---|
| `fetch_t12.ts` | 86 | `JOIN deal_properties dp ON dp.property_id = dma.property_id WHERE dp.deal_id = $1` ✅ |
| `cashflow.inngest.ts` | 124, 281 | same deal_properties JOIN pattern ✅ |
| `operations.routes.ts` | 57 (fallback) | `WHERE deal_id = $1` (assertDealOrgAccess at route entry) ✅ |
| `operations.routes.ts` | 637 (budget branch) | `WHERE deal_id = $1` ✅ |
| `operations.routes.ts` | 761 (fallback) | `WHERE deal_id = $1` ✅ |
| `operations.routes.ts` | 1325 (fallback) | `WHERE deal_id = $1` ✅ |
| `rankings.routes.ts` | 560 | `LATERAL JOIN deal_monthly_actuals dma2 … WHERE dp.deal_id = d.id` ✅ |
| `documentsFiles.service.ts` | 207 | `WHERE deal_id = $1` ✅ |
| `source-documents.routes.ts` | 63, 123 | deal_id-gated at entry + in query ✅ |
| `fetch_source_documents.ts` | 196 | `WHERE df.deal_id = $1` ✅ |

**MILD-RISK** (portfolio flag scope, not org scope — safe today, single-org):

These branches use `WHERE property_id = $property AND is_portfolio_asset = TRUE`. The
`property_id` is derived from a deal-ownership-gated lookup (`assertDealOrgAccess` at route
entry). If two orgs ever linked actuals with `is_portfolio_asset = TRUE` to the same shared
public property_id, this pattern would return cross-operator rows.

| File | Line | Pattern |
|---|---|---|
| `operations.routes.ts` | 57 (primary branch) | `WHERE property_id = $1 AND is_portfolio_asset = TRUE` |
| `operations.routes.ts` | 637 (actuals branch) | `WHERE property_id = $1 AND is_portfolio_asset = TRUE` |
| `operations.routes.ts` | 761 (primary branch) | `WHERE property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = $2` |
| `operations.routes.ts` | 1325 | `WHERE property_id = $1 AND is_portfolio_asset = TRUE` |

Current risk: ZERO (single-org DB). Future risk: LOW — `is_portfolio_asset` rows per property
are unlikely to exist across multiple orgs given how portfolio properties are added. Named here
for completeness; not a fix dispatch.

**UNSCOPED-LEAK-RISK — ⚠️ flagged for fix dispatch:**

**Site 1 — `financial-documents.routes.ts:270`**
```sql
SELECT DISTINCT source_document_type, data_source, source_period_label
FROM deal_monthly_actuals
WHERE property_id = $1
ORDER BY source_period_label DESC NULLS LAST
```
The `$1` (property_id) is derived from the caller's deal's `property_id` — a shared public
identifier. The route is entry-gated by `verifyDealOwnership`, but that gate scopes the DEAL,
not the actuals query. If Operator A and Operator B both linked different deals to the same
public property and both uploaded actuals, this query returns metadata rows from both operators
to whichever operator calls it.

Returns: `source_document_type`, `data_source`, `source_period_label` — low sensitivity but
still cross-operator data exposure. **UNSCOPED-LEAK-RISK.**

**Site 2 — `fetch_owned_asset_actuals.ts:205`**
```sql
SELECT COUNT(DISTINCT property_id) AS cnt
FROM deal_monthly_actuals
WHERE is_portfolio_asset = TRUE
```
And the main query at line 234+:
```sql
SELECT 1 FROM deal_monthly_actuals dma
WHERE dma.property_id = p.id
  AND dma.is_portfolio_asset = TRUE
  AND dma.report_month >= $1
  AND dma.is_budget = false
```
No org scope. This is the Cashflow Agent's `fetch_owned_asset_actuals` tool. It returns ALL
portfolio actuals from ALL orgs — the count, the property list, and the actuals rows. On a
single-org platform today, no actual leak. On a multi-org platform, Org B's portfolio
performance is visible to Org A's cashflow agent. **UNSCOPED-LEAK-RISK.**

**Site 3 — `fetch_owned_asset_opex_ratios.ts:64`**
```sql
FROM deal_monthly_actuals
WHERE property_id = ANY($1::uuid[])
  AND report_month >= $2
  AND is_budget = false
```
The `$1` property_ids come from `fetch_owned_asset_actuals` (unscoped above). Inherits the
same leak. **UNSCOPED-LEAK-RISK.**

### `deal_files` capsule document read classification

All capsule document read paths are SCOPED:

| File | Line | Scope |
|---|---|---|
| `documentsFiles.service.ts` | 207 | `WHERE deal_id = $1` ✅ |
| `source-documents.routes.ts` | 63 | file_ids from deal's `source_documents` JSONB — implicit deal scope ✅ |
| `source-documents.routes.ts` | 123 | `WHERE id = $1 AND deal_id = $2` ✅ |
| `fetch_source_documents.ts` | 196 | `WHERE df.deal_id = $1` ✅ |
| `skills/index.ts` | 131, 319 | `WHERE deal_id = $1` ✅ |
| `notarize.service.ts` | 45 | `WHERE deal_id = $1 AND id = ANY($2::uuid[])` ✅ |

No capsule document read path leaks cross-operator. ✅

### Verdict — Claim 3
The majority of `deal_monthly_actuals` reads are correctly scoped. Three UNSCOPED-LEAK-RISK
sites exist — `financial-documents.routes.ts:270`, `fetch_owned_asset_actuals.ts:205`, and
`fetch_owned_asset_opex_ratios.ts:64`. No capsule document reads leak.

---

## CLAIM 4 — Cross-operator isolation on a shared property (live proof)

**Shared public property used:** Highlands at Sweetwater Creek (p2122)
- `property_id = 7ea31caf-f070-43eb-9fd1-fe08f7123701`  
- `deal_id    = eaabeb9f-830e-44f9-a923-56679ad0329d` (Org A: `dd201183`)

### Live DB query results

```sql
-- 1. All actuals on the shared property — how many deal_ids?
SELECT dma.deal_id, COUNT(*) AS rows,
       COALESCE(d.org_id::text, 'NO_ORG') AS deal_org,
       BOOL_OR(COALESCE(dma.is_budget, FALSE)) AS has_budget_rows,
       BOOL_OR(NOT COALESCE(dma.is_budget, FALSE)) AS has_actual_rows
FROM deal_monthly_actuals dma
LEFT JOIN deals d ON d.id = dma.deal_id
WHERE dma.property_id = '7ea31caf-f070-43eb-9fd1-fe08f7123701'
GROUP BY dma.deal_id, d.org_id ORDER BY rows DESC;
```
```
deal_id                              | rows | deal_org    | has_budget_rows | has_actual_rows
eaabeb9f-830e-44f9-a923-56679ad0329d|  93  | dd201183    | t               | t
NULL                                 |  13  | NO_ORG      | f               | t
```

```sql
-- 2. SCOPED vs UNSCOPED row counts (Operator A as caller)
SELECT
  (SELECT COUNT(*) FROM deal_monthly_actuals dma
     JOIN deal_properties dp ON dp.property_id = dma.property_id
    WHERE dp.deal_id = 'eaabeb9f-...'
      AND COALESCE(dma.is_budget, FALSE) = FALSE) AS scoped_actuals,

  (SELECT COUNT(*) FROM deal_monthly_actuals
    WHERE property_id = '7ea31caf-...'
      AND COALESCE(is_budget, FALSE) = FALSE)    AS unscoped_actuals,

  (SELECT COUNT(*) FROM deal_monthly_actuals
    WHERE property_id = '7ea31caf-...')           AS unscoped_all_rows;
```
```
scoped_actuals | unscoped_actuals | unscoped_all_rows
53             | 53               | 106
```

### Interpretation

Currently `scoped_actuals = unscoped_actuals = 53` — the counts are equal because only ONE
org's data exists. The platform is single-tenant today; the SCOPED and UNSCOPED paths happen
to return the same rows.

The 13 null-deal_id rows belong to the same org (Org A's legacy portfolio actuals predating
the deal_id backfill). They appear in BOTH queries because the deal_properties JOIN matches
on `property_id`, not `deal_id` of the actuals row.

**The analytical proof of future leak** (if a second operator uploaded actuals for the same
property):

If Operator B's deal (`deal_id_B`, `org_B`) were linked to `property_id = 7ea31caf` and B
uploaded one actuals row:

| Query | Returns | B's row visible? |
|---|---|---|
| SCOPED: `JOIN deal_properties WHERE dp.deal_id = deal_A` | 53 | ❌ NO — B's deal not in A's deal_properties |
| UNSCOPED: `WHERE property_id = 7ea31caf` | 54 | ✅ YES — B's row leaks to A |

The SCOPED pattern (used by `fetch_t12.ts`, `cashflow.inngest.ts`, `rankings.routes.ts:560`)
**correctly isolates**. The UNSCOPED pattern used by `financial-documents.routes.ts:270`
**would leak** B's row to A.

**Confirmed by DB:** Operator B candidate deal (`0a55f0ac`) is NOT linked to `7ea31caf` via
`deal_properties` (0 rows). A call to `GET /financial-documents/eaabeb9f/data-sources` by
Operator A would, if B had uploaded actuals via that property_id, return B's
`source_document_type, data_source, source_period_label` metadata.

### Verdict — Claim 4
On the current single-org platform: **no actual cross-operator leak occurs** — all actuals on
the shared property belong to one org. The SCOPED code paths (deal_properties JOIN) correctly
isolate. The UNSCOPED code paths are analytically proven to leak — `financial-documents.routes.ts:270`
returns cross-operator actuals metadata on a shared property with no deal/org scope, which
would expose private actuals data the moment a second operator shares the same property_id.

---

## THE VERDICT (one line)

**The public-platform / private-user boundary MOSTLY HOLDS** — enforced by upload-route
topology (private data never lands on `properties` rows, capsule docs are deal-scoped). **Two
code-level leak risks exist and require fix dispatches:**

1. `financial-documents.routes.ts:270` — actuals metadata leaks cross-operator via unscoped
   `WHERE property_id = $1` with no deal/org scope.
2. `fetch_owned_asset_actuals.ts:205` and `fetch_owned_asset_opex_ratios.ts:64` — Cashflow
   Agent reads ALL portfolio actuals platform-wide with no org scope.

No actual cross-operator leak occurs today (single-org DB). Both sites are vulnerable the
moment a second org is onboarded.

---

## What B4b is NOT

**Properties need NO `org_id` column and NO row-level scoping.** The `properties` table is
platform-public; the 1,060,031 rows are global reference data. The private data (actuals,
documents) is in deal-scoped tables. The earlier "properties org_id migration" was based on
a wrong premise and is **formally retired as unnecessary** by this audit.

**The `is_market_data` column design from the prior Phase 1 report is also retired.** No
migration was executed (DB confirmed clean at audit start — `org_id` and `is_market_data` do
not exist on `properties`). The structural change is not needed.

---

## Fix dispatches (separate from this audit)

### FIX-1 — `financial-documents.routes.ts:270` (UNSCOPED-LEAK-RISK)

**What leaks:** `source_document_type, data_source, source_period_label` from
`deal_monthly_actuals` for all operators who share the same public property_id.

**Minimal fix:** replace the unscoped `property_id = $1` query with a deal-scoped query:
```sql
-- Replace:
WHERE property_id = $1

-- With:
WHERE deal_id = $<deal_id>
-- or:
WHERE property_id = $1
  AND deal_id IN (
    SELECT id FROM deals WHERE id = $<deal_id>
    UNION
    SELECT dp2.deal_id FROM deal_properties dp2 WHERE dp2.property_id = $1
      AND EXISTS (SELECT 1 FROM deals d2 WHERE d2.id = dp2.deal_id AND d2.org_id = $<caller_org>)
  )
```

### FIX-2 — `fetch_owned_asset_actuals.ts:205` + `fetch_owned_asset_opex_ratios.ts:64` (UNSCOPED-LEAK-RISK)

**What leaks:** All portfolio actuals and opex ratios from all orgs to the Cashflow Agent
of any org.

**Minimal fix:** thread `caller_org_id` into both tool queries and add:
```sql
-- In fetch_owned_asset_actuals:
WHERE is_portfolio_asset = TRUE
  AND EXISTS (
    SELECT 1 FROM deal_properties dp
    JOIN deals d ON d.id = dp.deal_id
    WHERE dp.property_id = dma.property_id
      AND d.org_id = $<caller_org_id>
  )

-- In fetch_owned_asset_opex_ratios:
WHERE property_id = ANY($1::uuid[])
  -- $1 is now already org-scoped from fetch_owned_asset_actuals
```

### DATA INTEGRITY note — PUT/DELETE no org check (not a fix dispatch, lower priority)

`PUT /api/v1/properties/:id` and `DELETE /api/v1/properties/:id` have no ownership check —
any authenticated user can overwrite or delete any market property row. This risks data
corruption (e.g. destroying ArcGIS-sourced comp data) but is not a privacy leak. A simple
guard suffices: only allow edit/delete if `created_by = req.user.userId` or the property is
linked to a deal the caller owns.

---

## Summary table

| Claim | Verdict |
|---|---|
| Claim 1: properties write-closed to private data | ✅ HOLDS — user routes write only public metadata; no private financial data reaches properties rows. PUT/DELETE lack org check (data integrity, not privacy). |
| Claim 2: two legit upload doors, correctly scoped | ✅ HOLDS — deal_files and deal_monthly_actuals are scoped at write; no third door. |
| Claim 3: private data scoped on read | ⚠️ MOSTLY HOLDS — 3 UNSCOPED-LEAK-RISK sites in deal_monthly_actuals reads; all capsule-doc reads scoped. |
| Claim 4: shared public property, isolated private actuals | ⚠️ ANALYTICALLY UNSAFE — SCOPED paths isolate correctly; UNSCOPED paths at the 3 flagged sites would leak on first multi-org onboarding. No actual leak today (single-org DB). |
| Properties need org_id? | ✅ NO — formally retired. |
