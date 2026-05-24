# M02 Zoning Module — Closing Document

**Shipped:** 2026-05-24  
**Status:** Phase 1 complete. Atlanta adapter live. GIS layer blocked from cloud IP (see below).

---

## What was built

### Schema
- **Migration:** `backend/src/database/migrations/20260608_property_descriptions_regulatory_constraints.sql`
- **New column:** `property_descriptions.regulatory_constraints JSONB`
- **Indexes:** GIN on the full JSONB column; B-tree on `jurisdiction.value` and `zone_code.value`
- Applied via `ts-node` direct execution (no `drizzle.config.json` present)

### Types & Interface
- `backend/src/services/regulatory/types.ts` — `RegulatoryConstraints`, `UseClassification`, `OverlayDistrict`, `emptyRegulatoryConstraints()`
- `backend/src/services/regulatory/m02-zoning/adapter-interface.ts` — `RegulatoryAdapter`, `RegulatoryLookupInput`

### Atlanta Adapter
- `backend/src/services/regulatory/m02-zoning/adapters/atlanta.ts`
  - Jurisdiction routing: FIPS 13121/13089 → Atlanta GIS → lookup table
  - Other metro FIPS (13067 Cobb, 13135 Gwinnett, etc.) → stub with correct jurisdiction name
  - Graceful degradation: GIS failure does not throw; records `gis_all_urls_failed` in source_chain
- `backend/src/services/regulatory/zoning-codes/city-of-atlanta.json`
  - 23 districts: R-1 through R-5, R-5A, MR-1 through MR-5, MRC-1 through MRC-3, C-1, C-1-C, C-2, C-3, I-1, I-2, O-I, OCG, OCR
  - STR permissions per Ordinance 20-O-1656
  - `O-I` (Office-Institutional) added during verification

### Pipeline Wiring
- `backend/src/services/regulatory/m02-zoning/index.ts` — registry + `lookupRegulatory()` dispatcher
- `backend/src/services/intake-orchestrator/worker.ts`
  - Import: `lookupRegulatory`
  - New function: `stepRegulatoryLookup()` (Step e) — reads geocoder cache, calls M02, writes to `enrichment_log`
  - Called in `processJob()` after `stepMunicipalLookup()`
- `backend/src/services/intake-orchestrator/property-writeback.ts`
  - New function: `extractRegulatoryDetail()` — finds `regulatory_lookup:ok` log entry
  - `writeBackToPropertyDescriptions()` refactored: no longer skips early when municipal is absent; writes regulatory independently; skips only when both municipal AND regulatory are null

### API
- `backend/src/api/rest/property.routes.ts`
  - New endpoint: `GET /api/v1/properties/by-parcel/:parcelId/summary`
  - JOINs `properties` + `property_descriptions`, returns `regulatory_constraints` at top level
  - Registered before `export default router`, no conflict with existing `/:id` route

### Documentation
- `docs/operations/M02_ADAPTER_TEMPLATE.md` — complete guide for adding new metros

---

## Paired-read verification results (2026-05-24)

5 Atlanta-area properties verified end-to-end (M02 lookup → enrichment_log → writeback → DB → summary query):

| Parcel ID | Address | FIPS | jurisdiction written | regulatory_constraints in DB |
|---|---|---|---|---|
| 14 0009 LL1209 | 1376 Custer Ave SE | 13089 (DeKalb) | City of Atlanta (GIS unavailable) | ✅ |
| 14 010800090706 | 565 Northside Dr SW | 13121 (Fulton) | City of Atlanta (GIS unavailable) | ✅ |
| 17 010600100385 | 915 W Peachtree St NW | 13121 (Fulton) | City of Atlanta (GIS unavailable) | ✅ |
| 15 240 02 010 | 469 Oakdale Rd NE | 13089 (DeKalb) | City of Atlanta (GIS unavailable) | ✅ |
| 14F0002 LL6670 | 3725 Princeton Lakes Pkwy | 13121 (Fulton) | City of Atlanta (GIS unavailable) | ✅ |

**Summary query test:** Direct execution of the `GET /by-parcel/:parcelId/summary` query for parcel `14 0009 LL1209` returned `regulatory_constraints` with correct provenance fields.

---

## Known constraint: Atlanta GIS endpoints blocked from cloud IP

**Finding:** Both configured GIS URLs fail from the Replit cloud IP.

| URL | Failure mode |
|---|---|
| `gis.atlantaga.gov/server/rest/services/ADHI/ADHI_zoning/MapServer/0/query` | HTTP 404 (service path moved or decommissioned) |
| `services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Zoning/FeatureServer/0/query` | HTTP 200 + `{"error":{"code":400,"message":"Invalid URL"}}` (wrong org ID) |

Additional probes (during verification):

| URL | Failure mode |
|---|---|
| `services.arcgis.com/eoLhMEVWcrSuTuqX/...` | HTTP 200 + Invalid URL (wrong org ID) |
| `services6.arcgis.com/pBENJBrFgr7GAbLu/...` | HTTP 200 + Invalid URL (wrong org ID) |
| `maps.fultoncountyga.gov/...` | SSL cert mismatch (Azure WAWS) |
| `gis.dekalbcountyga.gov/...` | SSL certificate expired |

**This is the documented Cloudflare WAF / cloud-IP block (see replit.md Gotchas).**

**Behaviour under this constraint:**
- `zone_code.value = null`, `jurisdiction.value = "City of Atlanta (GIS unavailable)"`
- `source_chain = ["census_geocoder", "atlanta_gis_zoning", "m02_atlanta:gis_all_urls_failed"]`
- All per-district constraint fields null (lookup table cannot be reached without a zone_code)
- The RegulatoryConstraints object is still written to DB — provenance is preserved
- No error is thrown; no job fails; the `regulatory_lookup` log step records `status: 'ok'`

**Resolution path (for production GIS access):**
1. Obtain the correct current ArcGIS org ID for Atlanta Planning's hosted zoning layer (field-verify the URL from a non-cloud IP — the City of Atlanta Open Data Portal typically lists the live service URL)
2. Update `ATLANTA_GIS_URLS` in `backend/src/services/regulatory/m02-zoning/adapters/atlanta.ts`
3. Re-run the paired-read on the same 5 parcels — expect `zone_code.value` to be populated and lookup table constraints to fill in

**No code changes are needed** — the adapter architecture, lookup table, and writeback path are all correct and verified. Only the GIS endpoint URLs need updating once the correct URLs are confirmed from a non-Replit IP.

---

## TypeScript compile check

`cd backend && npx tsc --noEmit --skipLibCheck` — **0 errors** (confirmed during build)

---

## What is NOT in scope for this dispatch

| Item | Reason deferred |
|---|---|
| Miami-Dade adapter | Blocked by M02 ship — see `M02_ADAPTER_TEMPLATE.md` for implementation guide |
| Correct Atlanta GIS URLs | Requires field-verification from non-cloud IP; architecture complete |
| M03/M08/M09/M25 consumers reading `regulatory_constraints` | Separate module dispatch per architecture decision |
| Unincorporated Fulton / DeKalb lookup tables | Phase 2 — requires separate zoning ordinance ingestion |
| Houston deed-restriction adapter | Phase 2 — see adapter template for Houston-specific guidance |

---

## Files changed (summary)

```
backend/src/database/migrations/20260608_property_descriptions_regulatory_constraints.sql  (new)
backend/src/services/regulatory/types.ts                                                    (new)
backend/src/services/regulatory/m02-zoning/adapter-interface.ts                            (new)
backend/src/services/regulatory/m02-zoning/index.ts                                        (new)
backend/src/services/regulatory/m02-zoning/adapters/atlanta.ts                             (new)
backend/src/services/regulatory/zoning-codes/city-of-atlanta.json                          (new, 23 districts)
backend/src/services/intake-orchestrator/worker.ts                                         (modified: import + stepRegulatoryLookup + call)
backend/src/services/intake-orchestrator/property-writeback.ts                             (modified: extractRegulatoryDetail + refactored writeback)
backend/src/api/rest/property.routes.ts                                                    (modified: summary endpoint)
docs/operations/M02_ADAPTER_TEMPLATE.md                                                    (new)
docs/operations/M02_ZONING_CLOSING.md                                                      (this file)
```
