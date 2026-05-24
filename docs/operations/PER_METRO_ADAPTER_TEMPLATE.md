# Per-Metro Adapter Template
**Phase 10 expansion reference** — TX / FL / NC / TN

This document defines the canonical pattern for adding a county-level municipal enrichment adapter. All examples reference the 7 completed Atlanta GA adapters as the established baseline.

---

## 1. File Structure & Naming

```
backend/src/services/municipal-enrichment/adapters/
  <county>-<state>.adapter.ts       # e.g. gwinnett-ga.adapter.ts
```

**Naming rules:**
- Use lowercase county name (no spaces; hyphens for multi-word: `wake-nc.adapter.ts`)
- Two-letter lowercase state code
- Always suffix with `.adapter.ts`
- One file per county. Never bundle multiple counties.

---

## 2. Required Exports

Every adapter must export exactly two functions with these signatures:

```typescript
export async function lookup<County><State>(
  address: string,
  city?: string,
): Promise<MunicipalLookupResult>

export async function lookup<County><State>ByParcelId(
  parcelId: string,
  city?: string,
): Promise<MunicipalLookupResult>
```

Example: `lookupGwinnettGA`, `lookupGwinnettGAByParcelId`

PascalCase county + uppercase state abbreviation. No default exports.

---

## 3. MunicipalLookupResult Shape

```typescript
// Defined in: backend/src/services/municipal-enrichment/types.ts
interface MunicipalLookupResult {
  status: 'ok' | 'not_found' | 'not_implemented' | 'error';
  source?: string;            // source tag (see §6)
  parcel_id?: string;
  address?: string;
  owner?: string;
  assessed_value?: number;
  appraised_value?: number;
  assessed_improvement?: number;
  assessed_land?: number;
  land_acres?: number;
  land_use_code?: string;
  class_code?: string;
  tax_district?: string;
  neighborhood?: string;
  county?: string;
  state?: string;
  candidates?: number;
  units?: number;
  geometry_area_sqft?: number;
  legal_description?: string;
  error?: string;
  raw?: unknown;              // strip before logging; never surfaces to UI
}
```

**Field rules:**
- Return `undefined` (not `null`) for absent optional fields
- `assessed_value` and `appraised_value` must be positive numbers; guard with `> 0` before assigning
- `raw` contains the ArcGIS feature response; always included in adapter return but stripped by worker before writing to enrichment_log
- `county` should be the proper county name (title case: `"Gwinnett"`, not `"GWINNETT COUNTY"`)
- `state` is always two-letter uppercase (`"GA"`)

---

## 4. ArcGIS FeatureServer Pattern (standard path)

Most GA counties expose an ArcGIS FeatureServer. The query pattern:

```typescript
const BASE_URL = 'https://services3.arcgis.com/{orgId}/arcgis/rest/services/{ServiceName}/FeatureServer/{layerId}';
const REQUEST_TIMEOUT_MS = 25000;  // 25s — see §8.1 for why

async function queryByAddress(streetNum: string, streetKeyword: string): Promise<Feature | null> {
  const where = `STRNUM = ${streetNum} AND UPPER(STRNAME) LIKE '%${streetKeyword.toUpperCase()}%'`;
  const url = `${BASE_URL}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=5&f=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.features?.[0] ?? null;
}

async function queryByParcelId(parcelId: string): Promise<Feature | null> {
  // Different counties use different field names: PIN, PARCELID, PARCEL_ID, APN
  const where = `PIN = '${parcelId}'`;
  const url = `${BASE_URL}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=1&f=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.features?.[0] ?? null;
}
```

### Address normalization before query

Always call `stripUnitSuffix` on the incoming address before parsing:

```typescript
import { stripUnitSuffix } from '../address-normalize';

const cleaned = stripUnitSuffix(address);
const parts = cleaned.match(/^(\d+)\s+(.+)/);
if (!parts) return { status: 'not_found' };
const [, strNum, strName] = parts;
const keyword = strName.split(/\s+/)[0];  // first word of street name
```

### Error handling shape

```typescript
try {
  const feat = await queryByAddress(strNum, keyword);
  if (!feat) return { status: 'not_found' };
  const attrs = feat.attributes;
  return {
    status: 'ok',
    source: SOURCE_TAG,
    parcel_id: attrs.PIN ?? undefined,
    // ... map fields
    raw: feat,
  };
} catch (err: any) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    return { status: 'error', error: `timeout after ${REQUEST_TIMEOUT_MS}ms`, source: SOURCE_TAG };
  }
  return { status: 'error', error: err.message, source: SOURCE_TAG };
}
```

---

## 5. HTML/qPublic Scrape Pattern (fallback path)

> **Warning:** qPublic sites are protected by Cloudflare WAF and cannot be scraped from cloud IP ranges. This path is only viable for county-operated HTML portals that are NOT behind Cloudflare. Confirm reachability from Replit before implementing.

If an HTML path is required:

```typescript
const PORTAL_URL = 'https://assessor.<county>.gov/search';
const REQUEST_TIMEOUT_MS = 20000;

async function scrapeByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const resp = await fetch(`${PORTAL_URL}?parcel=${encodeURIComponent(parcelId)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JEDI-RE/1.0)' },
  });
  if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}` };
  const html = await resp.text();
  // Use regex or lightweight DOM parsing — avoid jsdom for bundle size
  const assessed = html.match(/Assessed Value[^$]*\$([\d,]+)/)?.[1]?.replace(/,/g, '');
  // ...
}
```

---

## 6. Source Tag Convention

Format: `arcgis_<county>_<state>` (all lowercase, underscores)

Examples:
```
arcgis_gwinnett_ga
arcgis_cherokee_ga
arcgis_clayton_ga
arcgis_wake_nc
arcgis_harris_tx
arcgis_miami_dade_fl
```

The source tag is embedded in the `MunicipalLookupResult.source` field and surfaces in `property_descriptions` as `"source": "municipal:arcgis_gwinnett_ga"`.

---

## 7. FIPS Registration

Two changes required in `backend/src/services/municipal-enrichment/index.ts`:

### 7.1 FIPS map (direct routing for Census-geocoded addresses)

```typescript
// In the GA FIPS switch:
case '13135': return lookupGwinnettGA(address, city);
case '13057': return lookupCherokeeGA(address, city);
// Add new county:
case '13117': return lookupForsythGA(address, city);
```

### 7.2 Sequential fallback chain (for addresses where Census geocoding returns no_match)

The sequential chain tries every GA county in order until one returns `ok`. Add new adapters near the end:

```typescript
const gaChain = [
  () => lookupFultonGA(address, city),
  () => lookupDeKalbGA(address, city),
  () => lookupCobbGA(address, city),
  () => lookupGwinnettGA(address, city),
  () => lookupCherokeeGA(address, city),
  () => lookupClaytonGA(address, city),
  () => lookupHenryGA(address, city),
  () => lookupForsythGA(address, city),  // ← new
];
```

Also add to the parcel-ID fallback chain:
```typescript
const gaParcelChain = [
  () => lookupFultonGAByParcelId(parcelId, city),
  // ...existing...
  () => lookupForsythGAByParcelId(parcelId, city),  // ← new
];
```

---

## 8. Common Edge Cases (7 GA Counties)

### 8.1 Timeout tuning
Cherokee GIS responds in 14–18 s. Any county with a slow/aging ArcGIS server needs `REQUEST_TIMEOUT_MS ≥ 25000`. Default for new adapters: 25000ms.

### 8.2 Negative field values (Clayton pattern)
Clayton's `ASSESSVAL` field stores negative numbers for some parcels (county-owned, exempt, etc.). Always guard: `parseFloat(attrs.ASSESSVAL) > 0 ? ... : undefined`. Never return a negative `assessed_value`.

### 8.3 Field inversion (Clayton bug, now fixed)
Clayton's ArcGIS schema: `APPRVAL` = appraised (FMV), `ASSESSVAL` = assessed (40% of FMV). These are backwards from what the field names suggest. Always verify the ratio: assessed should be ~40% of appraised for residential GA parcels.

### 8.4 ArcGIS field name survey before coding
Every county uses different field names. Always run a probe query first:
```bash
curl "https://{endpoint}/query?where=1%3D1&outFields=*&resultRecordCount=1&f=json" | python3 -c "import sys,json; d=json.load(sys.stdin); print([f['name'] for f in d['fields']])"
```
Common field name variants across GA counties:

| Logical field | Gwinnett | Clayton | Cherokee | Fulton | DeKalb | Cobb |
|---|---|---|---|---|---|---|
| Parcel ID | `PIN` | `PARCELID` | `PIN` | `PARCEL_ID` | `PARCELNO` | `PARCELID` |
| Assessed value | `TOTVAL1` | `ASSESSVAL` | *(none)* | `ASSESSMENT` | `FTASSESS` | `APPRASVAL` |
| Appraised value | *(none)* | `APPRVAL` | *(none)* | `APPRAISAL` | `FTAPPRAIS` | `APPRAISAL` |
| Street number | `STRNUM` | `SITESTRNO` | *(spatial)* | `SITENUM` | `SITEADDR` | `STRNUM` |
| Owner | `OWNER1` | `OWNERNME` | `OWNER` | `OWNER` | `OWNNAME1` | `OWNERNAME` |

### 8.5 IP-blocked counties
Some county GIS servers block cloud/datacenter IP ranges. Signs:
- Connection refused (not HTTP 403)
- All 5+ county-operated domains unreachable
- ArcGIS Online org exists but has 0 public items

Action: implement stub returning `not_implemented`; register in FIPS router; document in closing note; file follow-up task.

Confirmed IP-blocked as of 2026-05-24: **Henry County GA** (all endpoints enumerated in ATLANTA_COMPLETION_CLOSING.md §1.4).

### 8.6 Cherokee has no assessed/appraised in ArcGIS layer
Cherokee's `MainLayersOnline/MapServer/1` does not store assessed or appraised values. The layer provides parcel geometry, owner, acreage, and land use. Tax values must come from a separate source (not yet available). Return `assessed_value: undefined, appraised_value: undefined` — do not fabricate.

### 8.7 Address normalization — unit suffix stripping
Apartment Locator source data often appends unit numbers: `"3290 Cobb Galleria Pkwy Apt 4"`. Always call `stripUnitSuffix(address)` before parsing. File: `backend/src/services/municipal-enrichment/address-normalize.ts`.

---

## 9. Testing Checklist

Before marking an adapter complete, confirm all of the following with live tests:

- [ ] Address lookup returns `status: 'ok'` for 2+ real addresses in the county
- [ ] Parcel-ID lookup returns `status: 'ok'` for 2+ real parcel IDs
- [ ] Address lookup returns `status: 'not_found'` for a fabricated address (e.g. "99999 Fake St")
- [ ] Timeout behavior: confirmed with `REQUEST_TIMEOUT_MS` set low (5000ms) — returns `status: 'error'` not a hang
- [ ] `assessed_value > 0` guard: no negative values leak through
- [ ] `stripUnitSuffix` called before address parsing
- [ ] Source tag matches `arcgis_<county>_<state>` convention
- [ ] FIPS added to both the direct map AND the sequential fallback chain in `index.ts`
- [ ] 3 literal JSON responses captured for closing note

---

## 10. Worked Example — Add Forsyth County GA (FIPS 13117)

### Step 1: Identify the endpoint

```bash
# Search ArcGIS Online for Forsyth County GA feature services
curl "https://www.arcgis.com/sharing/rest/search?q=%22Forsyth+County%22+%22Georgia%22+%22parcel%22&num=5&f=json"

# Probe the server directly
curl "https://gis.forsythco.com/arcgis/rest/services?f=json"
```

Confirmed endpoint: `https://services3.arcgis.com/abc123/arcgis/rest/services/Parcels/FeatureServer/0`

### Step 2: Discover field names

```bash
curl "https://services3.arcgis.com/abc123/.../FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=1&f=json" | python3 -c "import sys,json; d=json.load(sys.stdin); print([f['name'] for f in d['fields']])"
# Output: ['OBJECTID', 'PIN', 'OWNER', 'SITEADDR', 'SITENUM', 'STRNAME', 'ASSESSED', 'APPRAISED', 'ACRES', ...]
```

### Step 3: Create the adapter file

```typescript
// backend/src/services/municipal-enrichment/adapters/forsyth-ga.adapter.ts
import { MunicipalLookupResult } from '../types';
import { stripUnitSuffix } from '../address-normalize';

const BASE_URL = 'https://services3.arcgis.com/abc123/arcgis/rest/services/Parcels/FeatureServer/0';
const REQUEST_TIMEOUT_MS = 25000;
const SOURCE_TAG = 'arcgis_forsyth_ga';

export async function lookupForsythGA(address: string, city?: string): Promise<MunicipalLookupResult> {
  const cleaned = stripUnitSuffix(address);
  const parts = cleaned.match(/^(\d+)\s+(.+)/);
  if (!parts) return { status: 'not_found' };
  const [, strNum, strName] = parts;
  const keyword = strName.split(/\s+/)[0];

  try {
    const where = `SITENUM = ${strNum} AND UPPER(STRNAME) LIKE '%${keyword.toUpperCase()}%'`;
    const url = `${BASE_URL}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=5&f=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}`, source: SOURCE_TAG };
    const data = await resp.json();
    const feat = data.features?.[0];
    if (!feat) return { status: 'not_found' };
    const a = feat.attributes;

    return {
      status: 'ok',
      source: SOURCE_TAG,
      parcel_id: a.PIN ?? undefined,
      address: a.SITEADDR ?? undefined,
      owner: a.OWNER?.trim() || undefined,
      assessed_value: parseFloat(a.ASSESSED) > 0 ? parseFloat(a.ASSESSED) : undefined,
      appraised_value: parseFloat(a.APPRAISED) > 0 ? parseFloat(a.APPRAISED) : undefined,
      land_acres: a.ACRES ?? undefined,
      county: 'Forsyth',
      state: 'GA',
      candidates: data.features.length,
      raw: feat,
    };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { status: 'error', error: `timeout after ${REQUEST_TIMEOUT_MS}ms`, source: SOURCE_TAG };
    }
    return { status: 'error', error: err.message, source: SOURCE_TAG };
  }
}

export async function lookupForsythGAByParcelId(parcelId: string, _city?: string): Promise<MunicipalLookupResult> {
  try {
    const where = `PIN = '${parcelId}'`;
    const url = `${BASE_URL}/query?where=${encodeURIComponent(where)}&outFields=*&resultRecordCount=1&f=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}`, source: SOURCE_TAG };
    const data = await resp.json();
    const feat = data.features?.[0];
    if (!feat) return { status: 'not_found' };
    const a = feat.attributes;

    return {
      status: 'ok',
      source: SOURCE_TAG,
      parcel_id: a.PIN ?? undefined,
      address: a.SITEADDR ?? undefined,
      owner: a.OWNER?.trim() || undefined,
      assessed_value: parseFloat(a.ASSESSED) > 0 ? parseFloat(a.ASSESSED) : undefined,
      appraised_value: parseFloat(a.APPRAISED) > 0 ? parseFloat(a.APPRAISED) : undefined,
      land_acres: a.ACRES ?? undefined,
      county: 'Forsyth',
      state: 'GA',
      candidates: 1,
      raw: feat,
    };
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { status: 'error', error: `timeout after ${REQUEST_TIMEOUT_MS}ms`, source: SOURCE_TAG };
    }
    return { status: 'error', error: err.message, source: SOURCE_TAG };
  }
}
```

### Step 4: Register in index.ts

```typescript
// Add to imports:
import { lookupForsythGA, lookupForsythGAByParcelId } from './adapters/forsyth-ga.adapter';

// Add to FIPS map:
case '13117': return lookupForsythGA(address, city);

// Add to sequential chains:
{ fn: lookupForsythGA,          args: [address, city] },
{ fn: lookupForsythGAByParcelId, args: [parcelId, city] },
```

### Step 5: Run tests

```bash
cd backend && npx ts-node --transpile-only -e "
const { lookupForsythGA } = require('./src/services/municipal-enrichment/adapters/forsyth-ga.adapter');
lookupForsythGA('100 Courthouse Sq, Cumming, GA 30040').then(r => console.log(JSON.stringify(r, null, 2)));
"
```

Capture 3 literal JSON responses for the closing note.

---

## 11. State-Level Notes for Phase 10 Expansion

| State | Portal type | Known blockers | Notes |
|---|---|---|---|
| TX | ArcGIS FeatureServer (most counties) | HCAD (Harris) has custom REST API | TAAD parcel IDs vary by county; APPRVAL/TAXVAL naming inconsistent |
| FL | ArcGIS + SRIA (some counties) | Broward/Miami-Dade use custom portals | Property Appraiser sites; `just_value` = appraised, `assessed_value` = SOH-capped |
| NC | ArcGIS (NCONEMAP for many counties) | Some rural counties HTML-only | NC uses 100% FMV assessment; `total_value` = appraised |
| TN | ArcGIS + TN Comptroller public portal | Some counties share a state portal | TN assessment ratio: 25% residential, 40% commercial |
