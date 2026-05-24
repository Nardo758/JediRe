# Metro County Adapter Template — Atlanta GA

**Last updated:** 2026-05-24  
**Applies to:** All Georgia county adapters in `backend/src/services/municipal-enrichment/adapters/`

---

## Purpose

This template documents the pattern for building and wiring new county-level property-records adapters for the Atlanta metro (and any other Georgia metro). Follow this template exactly when adding a new county adapter.

---

## 1. Endpoint Discovery

Before writing any code, verify the endpoint is publicly accessible from cloud IP ranges:

```bash
# 1. Check the county's GIS portal for an ArcGIS REST URL
curl -s --max-time 10 "https://<county-gis-host>/arcgis/rest/services?f=json"

# 2. Check ArcGIS Online for hosted county services
curl -s --max-time 10 "https://www.arcgis.com/sharing/rest/search?q=<County>+County+Georgia+tax+parcel&num=5&f=json"

# 3. Inspect layer 0 (or the first parcel layer) for available fields
curl -s --max-time 10 "<endpoint-url>/<layer-id>?f=json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Fields:', [f['name'] for f in d.get('fields',[])])"

# 4. Run a sample query to confirm field contents
curl -s --max-time 10 "<endpoint-url>/<layer-id>/query?where=1=1&outFields=*&resultRecordCount=1&f=json"
```

**If the endpoint is unreachable:** Create a `not_implemented` stub following Section 4b below. Do NOT create a partial adapter that may silently fail.

---

## 2. Field Mapping Reference

| `MunicipalLookupResult` field | Description | GA field name examples |
|---|---|---|
| `parcel_id` | Parcel identifier | PIN, PARCELID, OBJECTID |
| `address` | Situs address | SITEADDRES, LOCADDR, Property_Address |
| `owner` | Owner name | OWNER, OWNERNME, OWNER1 |
| `land_acres` | Parcel size in acres | ACERAGE, Acreage, LEGALAC |
| `land_use_code` | Zoning / land use code | ZONE, Zoning, PROPCLAS |
| `tax_district` | Tax district code | TaxDistrict, DISTNUM |
| `neighborhood` | Neighborhood / subdivision | NEIGHBORHOODDESC, SUBDNAME |
| `assessed_value` | Tax assessed value (typically 40% of market in GA) | ASSESSVAL, TOTVAL1 |
| `appraised_value` | Market / appraised value | APPRVAL |
| `county` | Hard-coded to the county name (string) | — |
| `state` | Hard-coded to `"GA"` | — |
| `source` | Hard-coded source tag (e.g. `"arcgis_clayton_ga"`) | — |

**Important GA valuation notes:**
- Georgia law (OCGA § 48-5-7): assessed value = 40% of appraised (fair market) value.
- `APPRVAL` = appraised / market value (the larger number).
- `ASSESSVAL` / `TOTVAL1` = assessed (taxable) value (the smaller number, ~40% of APPRVAL).
- **Never swap these.** The Clayton adapter had an `APPRVAL → assessed_value` inversion that was corrected on 2026-05-24.

---

## 3. Standard Adapter Pattern

File: `backend/src/services/municipal-enrichment/adapters/<county-name>-ga.adapter.ts`

### 3a. Required structure

```typescript
// ─── Endpoints ────────────────────────────────────────────────────────────────
const <COUNTY>_PARCELS_URL = '<arcgis-rest-url>';

const OUT_FIELDS = [
  '<PARCEL_ID_FIELD>',
  '<OWNER_FIELD>',
  '<ADDRESS_FIELD>', '<CITY_FIELD>', '<ZIP_FIELD>',
  '<APPRAISED_VALUE_FIELD>', '<ASSESSED_VALUE_FIELD>',
  '<ACRES_FIELD>',
  '<ZONING_FIELD>',
].join(',');

// Timeout: 12s for fast endpoints; 25s for slower county servers (observed > 14s).
const REQUEST_TIMEOUT_MS = 12_000;

// ─── Retry helpers ────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

// ... fetchArcGIS, buildAddressWhere, buildParcelWhere, cityMatchScore, mapAttrsToResult, queryArcGIS

// ─── Public API ───────────────────────────────────────────────────────────────
export async function lookup<County>GA(address: string): Promise<MunicipalLookupResult>
export async function lookup<County>GAByParcelId(parcelId: string): Promise<MunicipalLookupResult>
```

### 3b. Address WHERE clause strategy

Use the two-clause LIKE pattern for all GA adapters:

```sql
-- Preferred (when street number and keyword are extractable):
UPPER(SITEADDRES) LIKE '{num} %' AND UPPER(SITEADDRES) LIKE '%{KEYWORD}%'

-- Fallback (when extraction fails):
UPPER(SITEADDRES) LIKE '%{normalized-address}%'
```

Use `normalizeAddressFull()` + `extractStreetNumber()` + `extractStreetKeyword()` from `address-normalize.ts`.

### 3c. Timeout sizing

| Observed response time | `REQUEST_TIMEOUT_MS` setting |
|---|---|
| < 5s (e.g. Fulton, Gwinnett, Clayton) | `12_000` |
| 5–15s (e.g. Cobb, DeKalb) | `15_000` |
| 15–20s (e.g. Cherokee) | `25_000` |

Always test with:
```bash
time curl -s --max-time 30 "<endpoint>/query?where=1%3D1&outFields=*&resultRecordCount=1&f=json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('features',[])),'features')"
```

---

## 4. FIPS Router Wiring

File: `backend/src/services/municipal-enrichment/index.ts`

### 4a. Live adapter (fully implemented)

**Step 1 — Add import:**
```typescript
import { lookup<County>GA, lookup<County>GAByParcelId } from './adapters/<county>-ga.adapter';
```

**Step 2 — Add to comment header:**
```
 *       → <County> County ArcGIS adapter   (FIPS <FIPS> / <cities>)
```

**Step 3 — Add to FIPS-direct switch (lookup method):**
```typescript
case '<FIPS>': fipsResult = await lookup<County>GA(lookupAddr); break;
```

**Step 4 — Add to FIPS-direct switch (lookupByParcelId method):**
```typescript
// In lookupByParcelId, add an explicit sequential step:
logger.debug(`... falling back to <County> for "${parcelId}"`);
const <county>Result = await lookup<County>GAByParcelId(parcelId.trim());
if (<county>Result.status === 'ok') return <county>Result;
```

**Step 5 — Extend sequential fallback chain (lookup method):**
Add after the last existing county:
```typescript
const <county>Result = await lookup<County>GA(lookupAddr);
if (<county>Result.status === 'ok') return <county>Result;
logger.debug(`... <County> miss, falling back to <next> for "${lookupAddr}"`);
return lookup<Next>GA(lookupAddr);
```

### 4b. Not-implemented stub

When no public endpoint is accessible, create a stub in `adapters/<county>-ga.adapter.ts`:

```typescript
export async function lookup<County>GA(_address: string): Promise<MunicipalLookupResult> {
  logger.debug('[<county>-ga] address lookup attempted — no public ArcGIS endpoint available');
  return {
    status:  'not_implemented',
    county:  '<County>',
    state:   'GA',
    source:  '<county>_ga_stub',
    error:   '<County> County GA ArcGIS endpoint not publicly accessible from cloud IPs',
  };
}
```

Still register the FIPS in the switch — it ensures a clean `not_implemented` response rather than falling through to a wrong county.

---

## 5. Adapter Test Checklist

Run these tests before marking an adapter complete:

```bash
cd backend && npx ts-node --transpile-only << 'TS'
import { lookup<County>GA } from './src/services/municipal-enrichment/adapters/<county>-ga.adapter';
async function test() {
  // Use a known-good address from the county (verify via ArcGIS query first)
  const r = await lookup<County>GA('<known-address>, <city>, GA <zip>');
  console.log(JSON.stringify({
    status: r.status, parcel_id: r.parcel_id, owner: r.owner,
    assessed_value: r.assessed_value, appraised_value: r.appraised_value,
    land_acres: r.land_acres, county: r.county, source: r.source,
  }, null, 2));
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
TS
```

Expected for a passing test:
- `status: "ok"`
- `parcel_id` is a non-null string
- `county` matches the county name exactly
- `source` matches the hardcoded source tag
- `assessed_value` and `appraised_value` are numbers (if the layer exposes them)
- `appraised_value > assessed_value` (in GA, appraised ≈ 2.5× assessed)

---

## 6. Current Atlanta Metro Adapter Status

| County | FIPS | Cities | Status | Source tag | Valuation fields |
|---|---|---|---|---|---|
| Fulton | 13121 | Atlanta, Sandy Springs, Roswell | ✅ Live | `arcgis_fulton_ga_2025` | assessed + appraised |
| DeKalb | 13089 | Decatur, Tucker, Brookhaven | ✅ Live | `arcgis_dekalb_ga` | assessed only |
| Cobb | 13067 | Marietta, Smyrna, Kennesaw | ✅ Live | `arcgis_cobb_ga` | assessed + appraised |
| Gwinnett | 13135 | Lawrenceville, Duluth, Norcross | ✅ Live | `arcgis_gwinnett_ga` | assessed only (TOTVAL1) |
| Cherokee | 13057 | Canton, Woodstock, Ball Ground | ✅ Live (slow — 25s timeout) | `arcgis_cherokee_ga` | none (layer limitation) |
| Clayton | 13063 | Jonesboro, Forest Park, Morrow | ✅ Live | `arcgis_clayton_ga` | assessed + appraised |
| Henry | 13151 | McDonough, Stockbridge, Hampton | ⛔ Stub — server unreachable | `henry_ga_stub` | N/A |

---

## 7. Gotchas

1. **Cherokee has no valuation data** — the public parcels layer does not expose assessed or appraised values. Do not attempt to map them; document clearly.
2. **Clayton APPRVAL ≠ assessed_value** — `APPRVAL` is the *appraised* (market) value; `ASSESSVAL` is the *assessed* (taxable) value. Common mistake: mapping the larger APPRVAL to `assessed_value`.
3. **Gwinnett TOTVAL1 = total assessed value** — there is no separate appraised field in the Tax Master Table layer.
4. **Cherokee timeout** — the Cherokee County GIS server responds in 14–18 seconds. The adapter uses `REQUEST_TIMEOUT_MS = 25_000`. Do not reduce this.
5. **Henry County server is firewalled** — all Henry County GIS domains (hcgov.com, co.henry.ga.us) return connection refused or DNS timeout from cloud/VPS IPs. This is expected.
6. **ArcGIS Hub "Parcels_AOC"** is Ohio watershed data, not Georgia. Do not confuse it with a GA parcel layer during endpoint searches.
