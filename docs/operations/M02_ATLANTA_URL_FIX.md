# M02 Atlanta GIS URL Fix — Operations Note

**Date:** 2026-05-24  
**Task:** #1034  
**Status:** COMPLETE

---

## Root Cause

Two hard-coded Atlanta GIS URLs in `atlanta.ts` were broken:

| URL | Failure Mode |
|-----|-------------|
| `https://gis.atlantaga.gov/server/…/ADHI_zoning/…` | HTTP 404 — server no longer exists |
| `https://services1.arcgis.com/Hp6G80Pky0om7QvQ/…` | HTTP 200 but ArcGIS error `{"code":400,"message":"Invalid URL"}` — wrong ArcGIS Online org |

These failures caused all City of Atlanta GIS lookups to fall through with `jurisdiction = "City of Atlanta (GIS unavailable)"` and `zone_code = null`, producing 6 stalled rows in `property_descriptions`.

---

## Replacement Endpoints

Both endpoints are hosted on DPCD's own GIS server at `gis.atlantaga.gov/dpcd`.

### Primary — LotsWithZoning
```
https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer/0/query
```
- Zone field: `ZONING_CLASSIFICATION`
- Sourced from City of Atlanta DPCD cadastral parcel layer

### Fallback — OpenDataService1 Layer 22
```
https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/22/query
```
- Zone field: `ZONECLASS` (may include compound codes e.g. `I-2,RG-2`)

Both require `inSR=4326` (server uses GA West State Plane internally but accepts WGS84 with the inSR declaration).

---

## Code Changes

### `backend/src/services/regulatory/m02-zoning/adapters/atlanta.ts`
- Replaced both `ATLANTA_GIS_URLS` constants with the new DPCD URLs
- Added `inSR: '4326'` to all query param objects
- Changed `outFields` from a specific list (`ZONING_CLASSIFICATION,ZONECLASS,…`) to `outFields: '*'`  
  **Why:** ArcGIS MapServer returns `"Failed to execute query."` (not a silent ignore) when any field in the explicit list doesn't exist in the layer schema. LotsWithZoning only has `ZONING_CLASSIFICATION`; OpenDataService1/22 only has `ZONECLASS`. Using `*` returns all available fields and lets the extraction code pick the right one.
- Updated field extraction: reads `ZONING_CLASSIFICATION` first, then `ZONECLASS`, then falls back to `ZONING`, `ZONING_CODE`, `ZONING_DIST`, `ZONE_TYPE`, `TYPE`, `LABEL` (in priority order)
- Handled compound zone codes (e.g. `"I-2,RG-2"` → splits on comma, takes first token)
- Fixed cascade bug: LotsWithZoning returns empty feature array (not an error) for roads/parks — the adapter now tries the fallback layer before declaring `gis_all_urls_failed`

### `backend/src/services/intake-orchestrator/property-writeback.ts`
- `extractRegulatoryDetail`: changed `.find()` → reversed-array `.find()` (i.e. `.findLast()` semantics)  
  **Why:** `enrichment_log` accumulates all historical runs (append-only). `.find()` returned the first (oldest) entry, so re-runs couldn't override stale data from prior failed attempts.

---

## Verification — 6 Sample Properties

Verified via `npx ts-node --transpile-only` against live DPCD endpoints:

| Parcel | Address | Result | URL Used |
|--------|---------|--------|----------|
| `15 240 02 010` | 469 Oakdale Rd NE, Atlanta | **RG-2** | LotsWithZoning (primary) |
| `17 010600100385` | 915 W Peachtree St NW, Atlanta | **SPI-16 SA1** | OpenDataService1/22 (fallback) |
| `14 010800090706` | 565 Northside Dr SW, Atlanta | **SPI-4 SA8** | OpenDataService1/22 (fallback) |
| `14F0002 LL6670` | 3725 Princeton Lakes Pkwy | **PD-MU** | OpenDataService1/22 (fallback) |
| `17-0148-LL-005-7` | 915 W Peachtree (proxy) | **SPI-16 SA1** | OpenDataService1/22 (fallback) |
| `14 0009 LL1209` | 1376 Custer Ave SE | `null` — Unincorporated DeKalb County | OpenDataService1/22 (tried, returned empty) |

Parcel `14 0009 LL1209`: Census geocoder resolves FIPS 13089 (DeKalb). The DPCD GIS endpoint returned empty features (coordinate outside CoA limits). This is correct adapter behavior — `jurisdiction` set to `"Unincorporated DeKalb County"` with null `zone_code`.

---

## Backfill Results

6 `property_descriptions` rows had `jurisdiction = 'City of Atlanta (GIS unavailable)'`.  
5 corresponding `intake_jobs` were reset to `pending` and re-processed by the orchestrator.

**Final DB state after backfill (2026-05-24 ~21:18):**

| Parcel | zone_code | jurisdiction |
|--------|-----------|--------------|
| `15 240 02 010` | RG-2 | City of Atlanta |
| `17 010600100385` | SPI-16 SA1 | City of Atlanta |
| `14 010800090706` | SPI-4 SA8 | City of Atlanta |
| `14F0002 LL6670` | PD-MU | City of Atlanta |
| `14 0009 LL1209` | null | Unincorporated DeKalb County |
| `17-0148-LL-005-7` | n/a | No intake_job source_data; not re-run |

---

## Warnings — SPI Zones Not in Lookup Table

`SPI-4 SA8`, `SPI-16 SA1`, `RG-2`, and `PD-MU` are not yet catalogued in  
`backend/src/services/regulatory/m02-zoning/zoning-codes/city-of-atlanta.json`.  
These generate `[m02-atlanta] zone_code "X" not found in city-of-atlanta.json` warnings.  
`zone_code` is correctly non-null; downstream constraint fields (FAR, height, density) remain null until the lookup table is extended.

---

## Known Limitation — LotsWithZoning Coverage

LotsWithZoning primary layer returns empty features for roads, parks, rights-of-way, and unincorporated parcels. The cascade to OpenDataService1/22 handles most of these, but parcels with coordinates outside City of Atlanta limits will legitimately receive null zone_code.

---

## Follow-Up Work (not blocking)

1. **Extend `city-of-atlanta.json`** to include SPI sub-area codes (`SPI-4 SA8`, `SPI-16 SA1`, etc.) and `PD-MU` / `RG-2` so constraint fields populate.
2. **Re-trigger parcel `17-0148-LL-005-7`** — no `intake_jobs.source_data` was found; requires a fresh intake submission with coordinates.
