# Apartment Locator daily rent history and scraper removal

## Scope

Implements the user's Apartment Locator dispatch. The earlier Stripe repair is
not part of this branch and remains blocked by an expired credential.
No authentication, TypeScript-cleanup, or Clawdbot files were changed.
This branch is for review only; do not merge without the user's approval.

Branch: `fix/apartment-locator-rent-history`.
The PR description records the PR URL and commit SHA after creation.

## Migration and schema

New migration: `backend/src/database/migrations/20261112_apartment_locator_rent_history.sql`.
No existing migration was edited.

`apartment_locator_rent_snapshots` columns:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `source TEXT NOT NULL DEFAULT 'apartment_locator_ai'`
- `source_endpoint TEXT NOT NULL`, constrained to `rent-comps`, `supply-pipeline`, or `backfill`
- `alai_property_id TEXT NOT NULL`, `property_id UUID NULL`
- `unit_type_key TEXT NOT NULL`
- `bedrooms NUMERIC(3,1)`, `bathrooms NUMERIC(3,1)`, `square_feet INT`
- `asking_rent NUMERIC(10,2)`, `rent_per_sqft NUMERIC(8,4)`, `effective_rent NUMERIC(10,2)`
- `concessions_text TEXT`, `units_available INT`, `total_units INT`
- `city TEXT NOT NULL`, `state TEXT NOT NULL`, `zip TEXT`, `address TEXT`, `property_name TEXT`
- `snapshot_date DATE NOT NULL`, `fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `raw JSONB`

Unique key: `(source, alai_property_id, unit_type_key, snapshot_date)`.
Indexes: `(property_id, snapshot_date DESC)`, `(city, state, snapshot_date DESC)`,
and `(alai_property_id, snapshot_date DESC)`. A partial index on
`properties.apartment_locator_id` supports matching without repeated inventory scans.

`apartment_class_rent_snapshots` adds
`asset_class_basis TEXT NOT NULL DEFAULT 'year_built_proxy'` (option A).
Existing historical class rows are labeled by this default; future writes
explicitly set it. Unknown year-built rows are excluded from new class aggregates
rather than being silently classified C. History APIs expose the basis, and the
current API and UI label these as vintage proxies.

## Unit identity and write behavior

- Normalize beds and baths to one decimal place and square feet to an integer.
  Example: `2`, `"2.00"`, `"1100"` becomes `b2-ba2-sf1100`.
- Missing components use `unknown`; all three missing gives `property`.
  A studio (`0` bedrooms) remains a studio.
- Exact normalized square feet is used, not a broad area band.
- This is a unit-type proxy, not a claimed floor-plan ID.
- Each city run captures one UTC observation date before fetching.
- Supply observations write first; rent-comps has precedence when both
  endpoints describe the same property/unit/date.
- Same-day reruns update that day's row; other dates have distinct keys.
- Known same-day values are not erased by absent fields from another endpoint.
- Matching uses the existing `properties.apartment_locator_id`. No match leaves
  `property_id` NULL; it does not prevent capture.
- Every observation retains its source row. Effective rent stays NULL because
  concession text alone does not establish a lease term.
- Per-row snapshot failures are counted and logged without aborting the city.
- Existing latest-value upserts and their consumers are retained.

## Development backfill

Applied the migration to the development database. Backfill uses the latest
table's `data_as_of`, falling back to the database migration date when absent;
`source_endpoint='backfill'`, `unit_type_key='property'`.

| City | State | Backfill rows |
|---|---|---:|
| Atlanta | GA | 227 |
| Austin | TX | 40 |
| Charlotte | NC | 161 |
| Dallas | TX | 135 |
| Houston | TX | 200 |
| Jacksonville | FL | 203 |
| Miami | FL | 132 |
| Nashville | TN | 211 |
| Orlando | FL | 200 |
| San Antonio | TX | 98 |
| Tampa | FL | 190 |
| **Total** | | **1,797** |

Running the backfill a second time left the count at 1,797.
Only identifiable `apartment_locator_ai` records are included.
No live city API sync was triggered: forward history starts on the next regular
sync. The sync's three HTTP endpoints were exercised with mocked HTTP in tests.
No historical rent before the locally retained observations was fabricated.
No production database was changed.

## Scraper replacement

Removed the Apartments.com provider file, registration, and exports. Registered
`ApartmentLocatorRentProvider`, which reads local snapshots by address/city/state
and falls back to the retained latest table when snapshots are absent or have
no usable asking rent. It makes no network calls.

Property-level rent data can complete enrichment without fabricating a studio or
unit inventory. Missing rent returns NULL through the registry; the existing
orchestrator marks this `failed`, not indefinitely `pending`.

Removed direct Apartments.com searches/page downloads from
`archive-enrich-partial.ts` and its Tavily extraction step from `archive-enrich.ts`.
The remaining archive extraction flow is retained. It skips Apartments.com URLs
while extracting other allowed listing sources.

## Reader inventory

Class-history consumers checked:

- `backend/src/services/apartment-locator-sync.service.ts`
- `backend/src/inngest/functions/nightly-apartment-sync.ts`
- `backend/src/api/rest/georgia-ingestion.routes.ts`
- `frontend/src/components/terminal/tabs/msa/MSATrendsTab.tsx`

Existing latest-table readers inventoried and left on the same table:

- `backend/src/agents/tools/fetch_market_rent_benchmark.ts`
- `backend/src/api/rest/apartment-locator.routes.ts`
- `backend/src/api/rest/deal-comp-sets.routes.ts`
- `backend/src/api/rest/property-discovery.routes.ts`
- `backend/src/api/rest/supply.routes.ts`
- `backend/src/api/rest/data-matrix.routes.ts`
- `backend/src/api/rest/georgia-ingestion.routes.ts`
- `backend/src/services/comp-set-discovery.service.ts`
- `backend/src/services/proximity/backtest.service.ts`
- `backend/src/services/backtest/snapshot-capture.service.ts`
- `backend/src/services/neural-network/data-matrix.service.ts`
- `backend/src/services/property-enrichment/matching/property-matcher.service.ts`
- `backend/src/services/property-enrichment/data-library/auto-enrichment.service.ts`
- `backend/src/services/property-enrichment/apartment-locator/sync-table.service.ts`
- The nightly job and sync service above

The new local rent provider is an additional reader, not a replacement for those consumers.

## Untouched Apartments.com references

These remain out of scope, as requested:

- `backend/src/agents/config/search.ts`
- `backend/src/agents/seeds/supply.seed.ts`
- `backend/src/services/research/web-search/web-search.adapter.ts`
- `backend/src/services/property-enrichment/building-characteristics/web-research-provider.ts`
- `backend/src/services/rent-scraper-discovery.service.ts`

## API unknowns

No additional endpoint or unverified capability was assumed:

- **U-1:** Historical API export/history retention remains unknown.
- **U-2:** Pagination, per-city caps, ZIP filters, and date filters remain unknown.
- **U-3:** The existing code consumes `property_id`/`id`, `bedrooms`, `bathrooms`,
  `square_feet`, `rent`, and `concessions`. It does not establish an upstream
  floor-plan ID, observed asset class, lease-term pricing, or reliable year built.
  No new live payload was fetched to resolve this.
- **U-4:** Existing optional delivery candidates remain `available_date`,
  `expected_delivery`, `delivery_date`, `available_starting`, and
  `estimated_delivery`; their upstream availability remains unverified.

## Verification

All 14 new tests passed across three files. They cover deterministic identity, real PostgreSQL uniqueness and reruns,
history preservation, nullable matching, idempotent backfill/date fallback,
per-row failure isolation, the three mocked HTTP endpoints, scraper-free provider
registration, local-only reads, property-level fallback, and clean no-data behavior.

Run:

```sh
cd backend
npm test -- --reporter=dot \
  src/services/__tests__/apartment-locator-rent-history.test.ts \
  src/services/__tests__/apartment-locator-sync-history.test.ts \
  src/services/property-enrichment/rent-data/__tests__/apartment-locator-provider.test.ts
```

PostgreSQL tests use an isolated schema inside a rolled-back transaction.
No live HTTP calls are made in new tests.

The final full backend suite is not green: 16 failing files, 26 failing tests,
1,209 passing tests, and 23 skipped tests. Every failing file also fails in an
untouched GitHub master checkout (that checkout has two additional fixture/path
failures). These unrelated failures were not fixed.

Full backend TypeScript checking also remains red; no diagnostics name the new
history/provider modules or modified sync/archive modules. The untouched checkout
also fails with different ambient-type resolution under its temporary path.
This is not a clean full-project type-check claim.

Both workflows restarted. Backend listened on port 4000 with two existing
startup migration failures in lenient mode; frontend returned HTTP 200 and the
Markets page rendered. Browser logging still reported API 404s. The changed
labels are inside a selected-market Trends view and were checked in source,
not interactively verified by the screenshot.

## Changed files

- `.agents/memory/MEMORY.md`
- `.agents/memory/apartment-locator-source-policy.md`
- `backend/src/database/migrations/20261112_apartment_locator_rent_history.sql`
- `backend/src/services/apartment-locator-rent-history.service.ts`
- `backend/src/services/apartment-locator-sync.service.ts`
- `backend/src/services/property-enrichment/rent-data/apartment-locator-provider.ts`
- `backend/src/services/property-enrichment/rent-data/apartments-com-provider.ts` (deleted)
- `backend/src/services/property-enrichment/rent-data/provider-registry.ts`
- `backend/src/services/property-enrichment/rent-data/index.ts`
- `backend/src/services/property-enrichment/index.ts`
- `backend/src/inngest/functions/nightly-apartment-sync.ts`
- `backend/src/api/rest/georgia-ingestion.routes.ts`
- `frontend/src/components/terminal/tabs/msa/MSATrendsTab.tsx`
- `backend/src/scripts/archive-enrich-partial.ts`
- `backend/src/scripts/archive-enrich.ts`
- `backend/src/services/__tests__/apartment-locator-rent-history.test.ts`
- `backend/src/services/__tests__/apartment-locator-sync-history.test.ts`
- `backend/src/services/property-enrichment/rent-data/__tests__/apartment-locator-provider.test.ts`
- `docs/operations/apartment-locator-rent-history.md`
