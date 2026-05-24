# Task B Closing — Apartment Locator Adapter + Follow-Ons

**Date:** 2026-05-24  
**Status:** COMPLETE — all verification gates passed  
**Paired-read verification (Step 4):** PASSED 5/5  
**Idempotency stress test (Step 7C):** PASSED (5 inserts → 1 row)

---

## (a) Investigation Findings (Step 1)

### Raw scrape sample (literal JSON from source_data)
```json
{
  "apartment_locator_id": "7806",
  "name": "The Pullman Luxury Apartment Homes",
  "address": "4660 Derrick Road Southwest",
  "city": "Atlanta",
  "state": "GA",
  "zip_code": "30349",
  "total_units": 31,
  "rent": 1500
}
```

### Current ingest path (pre-Task B)
- External API: `https://apartment-locator-ai-real.replit.app/api/jedi/supply-pipeline`
- Entry point: `ApartmentLocatorSyncService.syncCity()` calls the module-private `upsertIntakeJob()` at line ~371
- The old `upsertIntakeJob` deduplication guard was on `parcel_id` (conflict key: `ON CONFLICT (parcel_id) WHERE parcel_id IS NOT NULL`), where `parcel_id` was set to `prop.name || prop.address` — a display string
- `source_record_id` was not populated

### Tables written by syncCity() — all preserved in Task B
- `properties` — main property record (address-matched upsert)
- `apartment_supply_pipeline` — delivery pipeline tracking  
- `apartment_market_snapshots` — market-level snapshots
- `intake_jobs` — orchestrator queue (replaced by new adapter)

### Scrape schedule
- **Daily at 3:30 AM ET** via `m28-scheduler.service.ts` → `apartmentLocatorSyncService.syncAtlanta()`
- The 2026-05-24 batch of 1153 rows was a single historical load, not regular daily cadence. The daily job fires forward from today.
- Idempotency matters for every future run, not just today.

### Daily volume
- 1153 rows: 978 `blocked_needs_user`, 175 `complete`
- All created in a single batch on 2026-05-24

### Fields reliably extractable from a scrape record
`name`, `address`, `city`, `state`, `zip_code`, `total_units`, `rent`, `bedrooms`, `bathrooms`, `square_feet`, `units_available`, `concessions`. No lat/lng in the scrape payload itself.

---

### Duplicate pattern analysis (Step 1B)

**Shape:** Same `apartment_locator_id`, same property, same address — but two separate intake_jobs rows with different `parcel_id` values:
- **Earlier batch (00:44):** `parcel_id` = real ArcGIS parcel ID (e.g. `14 005300042215`)
- **Later batch (07:30):** `parcel_id` = property display name (e.g. `The Victory at Summerhill`)

**Root cause:** Old dedup key was `parcel_id`, not `apartment_locator_id`. Different `parcel_id` values let both rows through.

**Three sample pairs:**

| `apartment_locator_id` | Property | Role | `parcel_id` | Created |
|---|---|---|---|---|
| 18123 | The Victory at Summerhill | **WINNER** (Task A) | `The Victory at Summerhill` | 07:30 |
| 18123 | The Victory at Summerhill | **LOSER** (Task A) | `14 005300042215` | 00:44 |
| 18127 | Parkside Sandy Springs | **WINNER** | `Parkside Sandy Springs` | 07:30 |
| 18127 | Parkside Sandy Springs | **LOSER** | `17 0070  LL0596` | 00:44 |
| 18158 | Broadstone Pullman | **WINNER** | `Broadstone Pullman` | 07:30 |
| 18158 | Broadstone Pullman | **LOSER** | `15 211 03 148` | 00:44 |

**The Task A winner selection was universally inverted:** All 53 "winners" had display-string parcel_ids; all 53 "losers" had real ArcGIS parcel_ids. This was corrected in Task B Step 6.

---

### property_descriptions column gap (Step 1C)

Confirmed: `assessed_value`, `appraised_value`, and `owner` columns did not exist prior to this task. Two LV shapes coexist in the table:
1. **Full resolve shape** (OM-sourced): `{ layers, resolved, resolution_rule }`
2. **Simple municipal shape** (Task C/B write-back): `{ value, source: "municipal:<arcgis_source>", runAt }`

New columns use shape #2, consistent with Task C. Full-resolve shape cleanup is deferred as substrate-cleanup debt (see closing note at bottom).

---

## (b) Schema Migration

**File:** `backend/src/database/migrations/20260524_property_descriptions_valuation_columns.sql`

```sql
ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS assessed_value  jsonb,
  ADD COLUMN IF NOT EXISTS appraised_value jsonb,
  ADD COLUMN IF NOT EXISTS owner           jsonb;

CREATE INDEX IF NOT EXISTS idx_pd_owner_value
  ON property_descriptions USING gin ((owner -> 'value'));
```

LayeredValue shape: `{ value, source: "municipal:<arcgis_source>", runAt }`

---

## (c) Write-Back Extension

**File:** `backend/src/services/intake-orchestrator/property-writeback.ts`

Extended field mapping (full set now):

| Log field | property_descriptions column | LayeredValue type |
|---|---|---|
| `address` | `address` | `<string>` |
| `county` | `county` | `<string>` |
| `units` | `unit_count` | `<number>` |
| `land_acres` | `lot_size_acres` | `<number>` |
| `assessed_value` | `assessed_value` | `<number>` ← NEW |
| `appraised_value` | `appraised_value` | `<number>` ← NEW |
| `owner` | `owner` | `<string>` ← NEW |

Not mapped (no column): `neighborhood`, `geometry_area_sqft`

### Backfill results
- 170 properties populated (all 170 that had municipal data)
- 5 skipped (no `municipal_lookup/ok` entry in their log)
- 0 orphans

Fields written by column:
- `address`: 170
- `county`: 170
- `lot_size_acres`: 170
- `assessed_value`: 170 ← new
- `appraised_value`: 170 ← new
- `owner`: 170 ← new
- `unit_count`: 123 (47 DeKalb parcels had null units in ArcGIS layer)

---

## (d) Paired-Read Verification — GATE PASSED ✓ (5/5)

`GET /api/v1/properties/:parcelId/summary` reads directly from `property_descriptions` via `SELECT *`. DB data shown is the literal API response for the `description` field.

### Property 1: `14 004800030317` (Fulton)
**enrichment_log:** assessed_value=292000, appraised_value=730000, owner="NEST PROPERTIES OF ATLANTA LLC"

**property_descriptions (new fields):**
```json
{
  "assessed_value":  { "value": 292000,   "source": "municipal:arcgis_fulton_ga_2025", "runAt": "2026-05-24T03:14:07.948Z" },
  "appraised_value": { "value": 730000,   "source": "municipal:arcgis_fulton_ga_2025", "runAt": "2026-05-24T03:14:07.948Z" },
  "owner":           { "value": "NEST PROPERTIES OF ATLANTA LLC", "source": "municipal:arcgis_fulton_ga_2025", "runAt": "2026-05-24T03:14:07.948Z" }
}
```
✓ Data visible · ✓ Source provenance correct

### Property 2: `14 004900091136` (Fulton)
assessed_value=18816000, appraised_value=58800000, owner="DEVELOPMENT AUTHORITY OF FULTON COUNTY ATTN: CHRISTOPHER LANKIN" — all correct ✓

### Property 3: `14 008400120428` (Fulton)
assessed_value=9500000, appraised_value=23750000, owner="CDS CO 1 SMITH PORTER LLC  ET AL" — all correct ✓

### Property 4: `14F0048  LL0646` (Fulton)
assessed_value=7356400, appraised_value=18391000, owner="CUMBERLAND RUN HOLDINGS LLC  ET AL" — all correct ✓

### Property 5: `18 347 04 006` (DeKalb)
assessed_value=17892960, appraised_value=44732400, owner="BCORE MF PERIMETER DREXEL LLC" (source: `municipal:arcgis_dekalb_ga`) — all correct ✓

---

## (e) Apartment Locator Adapter

**File:** `backend/src/services/intake-sources/apartment-locator/index.ts`

Exports:
- `upsertApartmentLocatorJob(record)` — single-record upsert
- `upsertApartmentLocatorBatch(records)` — batch with per-record error isolation

**Idempotency mechanism:**
```sql
INSERT INTO intake_jobs (source_type, source_record_id, raw_input, state, source_data)
VALUES ('apartment_locator', $1, $2::jsonb, 'pending', $2::jsonb)
ON CONFLICT (source_type, source_record_id)
  WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL
DO UPDATE SET
  raw_input   = EXCLUDED.raw_input,
  source_data = EXCLUDED.source_data,
  updated_at  = NOW()
```

ON CONFLICT semantics: refreshes `raw_input` (latest scrape data), bumps `updated_at`. Does **not** touch `state`, `attempts`, `enrichment_log`, `last_error` — in-flight processing is never disturbed.

**Integration point:** `apartment-locator-sync.service.ts` — the old `upsertIntakeJob` function was replaced with a thin wrapper calling `upsertApartmentLocatorJob`. All other syncCity() behavior (properties table, apartment_supply_pipeline, apartment_market_snapshots) unchanged.

---

## (f) Idempotency Proof — PASSED ✓

Stress test: same `source_record_id="TEST_IDEM_9999"` inserted 5× in rapid succession via DO block in PostgreSQL.

Result: **exactly 1 row, state=pending** — 5×1 reduces to 1 via the ON CONFLICT UPDATE path.

Replay test with existing complete record (`source_record_id="7806"`, The Pullman):
- `upsertApartmentLocatorBatch([{ id: "7806", ..., rent: 1550 }])`
- Result: `{ inserted: 0, updated: 1, errors: 0 }`
- Row after upsert: `state=complete` (preserved), `raw_rent=1550` (refreshed), `source_record_id="7806"` (unchanged), row count = 1

---

## (g) Duplicate Consolidation Disposition (Modified Step 6)

**Migration:** `backend/src/database/migrations/20260524_consolidate_duplicate_intake_jobs.sql`

**53 pairs — all followed the same inverted pattern:**
- LOSER (from Task A): `real_arcgis` parcel_id, `source_record_id=NULL`
- WINNER (from Task A): `display_name` parcel_id, `source_record_id=al_id`

**Actions taken:**

| Action | Count |
|---|---|
| Winners' `source_record_id` cleared (NULL) | 53 |
| Losers' `source_record_id` stamped with `al_id` | 53 |
| `property_descriptions` display-name rows deleted | 53 |
| `property_descriptions` real-arcgis rows enriched (COALESCE merge) | 53 |
| `historical_observations` rows redirected | 0 (none referenced display parcel_ids) |
| `data_library_files` rows redirected | 0 (none referenced display parcel_ids) |

**Follow-up fix:** Winners' `parcel_id` was set to NULL (the unique partial index on `parcel_id` prevented redirecting them to the real ArcGIS value, which the loser already held). The original record is fully preserved in `source_data`.

**Final intake_jobs state:**

| state | has source_record_id | parcel_id | count | Description |
|---|---|---|---|---|
| `blocked_needs_user` | ✓ | set | 978 | Awaiting user action |
| `complete` | ✓ | set | 122 | Canonical: 53 now-canonical losers + 69 non-duplicate winners |
| `complete` | ✗ | NULL | 53 | Audit records (old display-name runner-up rows) |

**Step 6C verification:** 1037 of 1100 winner rows have display-string `parcel_id` — expected behavior for the non-duplicate pool (the old `upsertIntakeJob` always set `parcel_id = prop.name || prop.address`). For single-occurrence rows, no real-parcel counterpart exists in intake_jobs, so no consolidation is needed or possible.

---

## (h) End-to-End Verification

**Adapter path:** New record → `upsertApartmentLocatorJob()` → `intake_jobs` row with `state='pending'`, `source_record_id=apartment_locator_id`, `raw_input` populated → orchestrator picks up on next poll → municipal enrichment → `setState('complete')` → `writeBackToPropertyDescriptions()` → 7 fields written to `property_descriptions` → visible via `GET /api/v1/properties/:parcelId/summary`

**Verified against 175 existing complete jobs** as the end-to-end proof (enrichment chain, write-back, API).

**Scrape schedule:** Daily at 3:30 AM ET (`m28-scheduler.service.ts`, cron `30 3 * * *`). The adapter is wired in and will fire on tomorrow's run.

---

## (i) Pattern Note

Apartment Locator is now the **first non-OM upstream source** wired through the orchestrator via a formal source adapter. The pattern established:

```
normalize(scrape record) → { source_type, source_record_id, raw_input }
  ↓
upsert via (source_type, source_record_id) unique partial index
  ↓
orchestrator polls pending → enriches → writes back to property_descriptions
  ↓
API serves result
```

Future sources follow the same structure (a module in `src/services/intake-sources/<source>/index.ts`):
- **Phase 1.3:** Data Library uploads (separate dispatch)
- Pipeline deal pageloads
- Email ingestion

Each new source gets its own `source_type` constant, its own adapter module, and its own unique `source_record_id` scheme.

---

## Substrate-Cleanup Debt

Two LV shapes coexist in `property_descriptions`:
1. **Full resolve shape** (OM-sourced): `{ layers, resolved, resolution_rule }` — used by address, property_name when sourced from OM documents
2. **Simple municipal shape** (orchestrator write-back): `{ value, source, runAt }` — used by 7 fields after Tasks C+B

A future dispatch should normalize to a single shape. Suggested: extend the simple shape with an optional `layers` key, making it a compatible superset. Not blocking any current consumer — both shapes are read permissively.
