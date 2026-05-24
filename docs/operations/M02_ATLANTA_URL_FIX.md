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

### `backend/src/services/regulatory/zoning-codes/city-of-atlanta.json`
Added 4 missing district entries that appeared in the backfill:
- **RG-2** — Residential General-2 (medium-density multifamily): FAR 0.8, height 35 ft, 12 units/acre
- **PD-MU** — Planned Development Mixed Use (typical base standards): FAR 2.5, height 65 ft, 36 units/acre
- **SPI-4 SA8** — West End Special Public Interest, Sub-Area 8: FAR 2.0, height 45 ft, 24 units/acre
- **SPI-16 SA1** — West Peachtree Corridor Special Public Interest, Sub-Area 1: FAR 8.0, height 175 ft, 120 units/acre

### `backend/src/services/intake-orchestrator/property-writeback.ts`
- `extractRegulatoryDetail`: changed `.find()` → reversed-array `.find()` (findLast semantics) so re-runs override stale historical log entries  
  **Why:** `enrichment_log` accumulates all historical runs (append-only). `.find()` returned the first (oldest) entry, so re-runs couldn't override stale data from prior failed attempts.

---

## Verification — 6 Sample Properties

All 6 stalled parcels verified and backfilled:

| Parcel | Address | Zone Code | Jurisdiction | FAR | Height | Density | URL Used |
|--------|---------|-----------|-------------|-----|--------|---------|----------|
| `15 240 02 010` | 469 Oakdale Rd NE | **RG-2** | City of Atlanta | 0.8 | 35 ft | 12 u/ac | LotsWithZoning (primary) |
| `17 010600100385` | 915 W Peachtree St NW | **SPI-16 SA1** | City of Atlanta | 8.0 | 175 ft | 120 u/ac | OpenDataService1/22 (fallback) |
| `14 010800090706` | 565 Northside Dr SW | **SPI-4 SA8** | City of Atlanta | 2.0 | 45 ft | 24 u/ac | OpenDataService1/22 (fallback) |
| `14F0002 LL6670` | 3725 Princeton Lakes Pkwy | **PD-MU** | City of Atlanta | 2.5 | 65 ft | 36 u/ac | OpenDataService1/22 (fallback) |
| `17-0148-LL-005-7` | 464 Bishop St NW | **MR-4A** | City of Atlanta | 4.0 | 100 ft | 96 u/ac | OpenDataService1/22 (fallback) |
| `14 0009 LL1209` | 1376 Custer Ave SE | null | Unincorporated DeKalb County | — | — | — | OpenDataService1/22 (tried, returned empty) |

Parcel `14 0009 LL1209`: Census geocoder resolves FIPS 13089 (DeKalb). The DPCD GIS endpoint returned empty features (geocoded coordinate outside CoA limits). This is correct adapter behavior — `jurisdiction` set to `"Unincorporated DeKalb County"` with null constraints (no CoA zoning applies).

---

## Backfill Method

- 5 of 6 stalled parcels had existing `intake_jobs` → reset to `pending`; orchestrator re-processed automatically after backend restart
- 1 parcel (`17-0148-LL-005-7`) had no `intake_jobs` source_data (blocked_needs_user state) → backfilled via direct `ts-node` M02 adapter call with coordinates geocoded from address

All 6 `property_descriptions` rows now have correct data as of 2026-05-24 ~21:28.

---

## Known Limitation — LotsWithZoning Coverage

LotsWithZoning primary layer returns empty features for roads, parks, rights-of-way, and parcels with coordinates outside City of Atlanta limits. The cascade to OpenDataService1/22 handles most of these, but parcels with coordinates genuinely outside CoA limits will receive null zone_code (`Unincorporated <County>` jurisdiction).

---

## SPI / PD Notes

SPI (Special Public Interest) and PD-MU values in `city-of-atlanta.json` represent **typical base standards** sourced from the Atlanta Land Development Code. Each SPI sub-area and each Planned Development has its own approved ordinance that may override these values. The figures enable M03 Dev Capacity and M09 ProForma calculations to run; for entitlement due diligence, the specific ordinance should be consulted.

---

## Follow-Up Work (not blocking)

See proposed tasks #1038 and #1039:
1. **#1038** — Extend `city-of-atlanta.json` with additional SPI sub-areas and other CoA zone codes encountered during future ingestion
2. **#1039** — Systemic fix for property_writeback: apply findLast semantics to all enrichment steps (not just regulatory_lookup) so re-runs always win over stale historical entries
