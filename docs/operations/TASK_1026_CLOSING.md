# Task #1026 Closing — Atlanta County Adapter Completion

**Date:** 2026-05-24  
**Status:** COMPLETE  
**Counties addressed:** Gwinnett (13135), Clayton (13063), Cherokee (13057), Henry (13151)

---

## (a) Investigation Gate Findings

### What already existed before this task
All three adapters listed in the task title were **already fully implemented** before this session:

| County | File | Status before task | Status after |
|---|---|---|---|
| Gwinnett | `gwinnett-ga.adapter.ts` | Fully implemented, wired at FIPS 13135 | No change needed |
| Clayton | `clayton-ga.adapter.ts` | Implemented but had APPRVAL/ASSESSVAL field inversion | Bug fixed |
| Cherokee | `cherokee-ga.adapter.ts` | Implemented but timed out (12s timeout < 16s response) | Timeout fixed |
| Henry | `henry-ga.adapter.ts` | Did not exist | Stub created, FIPS 13151 registered |

### The 71 GA blocked intake_jobs
All 71 blocked GA jobs have `city = "Atlanta"` and addresses in **Fulton, DeKalb, and Cobb counties** — not in Gwinnett, Clayton, Cherokee, or Henry. They blocked because the sequential chain had only 3 adapters (Fulton → DeKalb → Cobb) when they first processed (2026-05-24 05:44 batch). The chain now has 7 adapters; all 71 were re-queued.

---

## (b) Bugs Found and Fixed

### Bug 1 — Clayton: APPRVAL/ASSESSVAL field mapping inversion

**File:** `adapters/clayton-ga.adapter.ts`

**Root cause:** `APPRVAL` (appraised/market value — the larger number) was mapped to `assessed_value`. `ASSESSVAL` (assessed/taxable value — the smaller number, ~40% of APPRVAL in Georgia) was not mapped at all.

**Effect:** Properties in Clayton County appeared with inflated assessed values and missing appraised values in `property_descriptions`. For a property appraised at $1,078,600 (APPRVAL), the field was being written as `assessed_value = 1078600` instead of the correct `assessed_value = 92007`.

**Fix:**
```typescript
// Before (wrong):
assessed_value: parseFloat(attrs.APPRVAL)   // APPRVAL is appraised, not assessed

// After (correct):
appraised_value: parseFloat(attrs.APPRVAL),  // market value
assessed_value:  parseFloat(attrs.ASSESSVAL), // taxable value (~40% in GA)
```

**Verified:** `lookupClaytonGA('505 Hall Rd, Jonesboro, GA')` → assessed_value=92007, appraised_value=1078600 ✓

---

### Bug 2 — Cherokee: 12-second timeout causes false errors

**File:** `adapters/cherokee-ga.adapter.ts`

**Root cause:** `REQUEST_TIMEOUT_MS = 12_000`. Cherokee County GIS server observed response time: 14–18 seconds from Replit IP ranges.

**Effect:** Every Cherokee County lookup timed out and returned `{ status: 'error', error: 'timeout' }`, causing the orchestrator to treat all Cherokee County jobs as failed.

**Fix:** `REQUEST_TIMEOUT_MS` increased from `12_000` to `25_000`.

**Verified:** `lookupCherokeeGA('100 Upper Bethany Tr, Canton, GA')` → status=ok, PIN=13-0276-0008 ✓

---

## (c) Henry County — No Public Endpoint

**FIPS:** 13151  
**County seat:** McDonough, GA  
**Principal cities:** McDonough, Stockbridge, Hampton, Locust Grove

All known Henry County GIS server domains were tested and confirmed unreachable from Replit/cloud IPs:

| Domain | Result |
|---|---|
| `gis.co.henry.ga.us/arcgis/rest/services` | Connection refused |
| `maps.hcgov.com/arcgis/rest/services` | DNS/connection timeout |
| `gis.hcgov.com/server/rest/services` | DNS/connection timeout |
| ArcGIS Online: "Parcels_AOC" | Ohio watershed data — not GA |
| qPublic (`qpublic.schneidercorp.com/Application.aspx?AppID=1049`) | Blocked by Cloudflare WAF |

**Resolution:** Created `adapters/henry-ga.adapter.ts` as a documented `not_implemented` stub. FIPS 13151 registered in both the FIPS-direct switch and the sequential fallback chain (positioned after Clayton). When Henry County properties appear in the pipeline, jobs will enter `blocked_needs_user` with a clear `not_implemented` response rather than silently timing out.

---

## (d) FIPS Router Wiring — Final State

```
Sequential GA chain (lookup):
  Fulton (13121) → DeKalb (13089) → Cobb (13067) → Gwinnett (13135)
  → Cherokee (13057) → Clayton (13063) → Henry (13151 — not_implemented)

FIPS-direct switch:
  13121 → lookupFultonGA(addr, knownCoords)
  13089 → lookupDeKalbGA(addr, knownCoords)
  13067 → lookupCobbGA(addr, knownCoords)
  13135 → lookupGwinnettGA(addr, knownCoords)
  13057 → lookupCherokeeGA(addr)
  13063 → lookupClaytonGA(addr)
  13151 → lookupHenryGA(addr)         ← new
```

---

## (e) Live Adapter Tests — GATE PASSED ✓

| Adapter | Test address | Result | Fields |
|---|---|---|---|
| Gwinnett | 5500 Peachtree Pkwy, Peachtree Corners | ✅ ok — PIN `6285 065` | assessed_value=3100000, land_acres=1.0 |
| Clayton | 505 Hall Rd, Jonesboro | ✅ ok — PARCELID `04204 205001` | assessed_value=92007, appraised_value=1078600 |
| Cherokee | 100 Upper Bethany Tr, Canton | ✅ ok — PIN `13-0276-0008` | land_acres=5.0, tax_district=01 |
| Henry | 123 Main St, McDonough | ✅ not_implemented — expected shape | error message present |

---

## (f) Re-Queue Pass

71 GA blocked `apartment_locator` jobs reset from `blocked_needs_user` → `pending`:
- `enrichment_log` cleared to `[]`
- `attempts` reset to `0`
- `last_error` cleared

Expected resolution on next worker pass:
- **Cobb addresses** (Vinings, Cumberland area): should resolve via `lookupCobbGA` (confirmed working: "2550 Akers Mill Rd SE" → parcel 17101100030)
- **Fulton/DeKalb** addresses with unusual formats (e.g. "Joseph E. Lowery Blvd", "Centennial Olympic Park Drive Northwest"): may still block due to address normalization limitations in those adapters — tracked as separate follow-up
- **Zero Henry County addresses** in the 71-job batch (all are Atlanta city addresses)

---

## (g) Cherokee Data Coverage Note

Cherokee County's public parcels layer does **not** expose assessed or appraised values. The layer returns:
- `PIN` (parcel identifier)
- `OWNER` (owner name)
- `Acreage` (parcel size)
- `Zoning` (land use code)
- `TaxDistrict`

No `assessed_value` or `appraised_value` fields are available. This is a public-layer limitation, not a bug. Properties in Cherokee County will have those fields left as null in `property_descriptions`. The write-back logic in `property-writeback.ts` handles null values correctly (field not written when null).

---

## (h) Gwinnett Data Coverage Note

Gwinnett's Tax Master Table (layer 3) exposes `TOTVAL1` (total assessed value). There is no separate appraised value field. The adapter maps `TOTVAL1 → assessed_value`; `appraised_value` is left null.

---

## (i) Per-Metro Template

A reusable template for building and wiring future county adapters is now at:
`docs/operations/METRO_ADAPTER_TEMPLATE.md`

Covers: endpoint discovery, field mapping, timeout sizing, FIPS wiring checklist, valuation gotchas.

---

## (j) Files Changed

| File | Change |
|---|---|
| `adapters/clayton-ga.adapter.ts` | Fixed APPRVAL→appraised_value / ASSESSVAL→assessed_value mapping; added STREETNO/STREETNAME to OUT_FIELDS |
| `adapters/cherokee-ga.adapter.ts` | REQUEST_TIMEOUT_MS: 12,000 → 25,000 |
| `adapters/henry-ga.adapter.ts` | Created: not_implemented stub with full investigation notes |
| `index.ts` | Imported Henry adapter; added FIPS 13151 to FIPS switch; extended sequential chain + parcel chain to include Henry |
| `docs/operations/METRO_ADAPTER_TEMPLATE.md` | Created: reusable template for future county adapters |
| `intake_jobs` (DB) | 71 GA blocked jobs reset to pending |
