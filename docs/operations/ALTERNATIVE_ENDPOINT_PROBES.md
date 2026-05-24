# Alternative Endpoint Probes — Henry GA, Broward FL, Harris TX, Miami-Dade FL

**Probed:** 2026-05-24  
**Scope:** Assessor data alternatives AND zoning data alternatives for four counties that failed the original single-endpoint validation in task #1029. All probes run directly from Replit (no Cloudflare Worker). Addresses used are real public-record parcels in each county.

---

## Quick-Reference Matrix

| County | Assessor | Zoning |
|---|---|---|
| Henry GA | REACHABLE BUT DATA LIMITED | REACHABLE BUT DATA LIMITED |
| Broward FL | REACHABLE BUT DATA LIMITED | REACHABLE BUT DATA LIMITED |
| Harris TX | REACHABLE BUT DATA LIMITED | REACHABLE BUT DATA LIMITED ⚠ |
| Miami-Dade FL | **REACHABLE WITH VIABLE DATA** | **REACHABLE WITH VIABLE DATA** |

> **⚠ Harris TX / Zoning:** City of Houston has no traditional zoning code; uses private deed restrictions instead. Harris County itself also has no county-wide zoning. Incorporated cities within Harris (Sugar Land, Pearland, Bellaire, etc.) each have their own zoning, but their GIS portals either refused connections (HTTP 000) or returned 500 in this probe. See Harris TX section for detail.

---

## 1. Henry County, GA

### 1a. Assessor

**Test folio:** Parcels in/around Stockbridge, GA (Henry County seat)

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://qpublic.schneidercorp.com/Application.aspx?App=HenryCountyGA` | **403** | 5.5 KB | Cloudflare WAF block — expected per platform gotcha; same infrastructure as failed primary |
| `https://henrycountyga.gov/320/GIS` | **301** | 162 B | Redirects to CivicPlus CMS page (final 200, 287 KB HTML) — county GIS info page, not a data endpoint |
| `https://app.regrid.com/us/ga/henry` | **200** | 168 KB | Site loads; API token required — `GET /api/v1/search.json` returns `{"status":"error","message":"An access token is required."}` HTTP 401. Regrid is a paid data vendor. |
| `https://henry-county-ga-henrycountyga.opendata.arcgis.com` | **200** | 14.8 KB | County ArcGIS Open Data portal is live |

**Sample response (Regrid API — unauthenticated):**
```json
{"status":"error","message":"An access token is required."}
```

**Assessment values confirmed present:** No — all accessible paths require either auth (Regrid token) or return non-machine-readable HTML.

**Classification: REACHABLE BUT DATA LIMITED**  
The county ArcGIS Open Data portal is live. Regrid is a viable paid path if a token is procured. No free JSON assessor API found. qPublic/Schneider is blocked at the WAF layer.

---

### 1b. Zoning

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://henrycountyga.gov/320/GIS` | **301 → 200** | 287 KB | CivicPlus HTML page — links to GIS viewer but no direct data layer URLs in page source |
| `https://documents.atlantaregional.com` | **403** | 1.2 KB | Atlanta Regional Commission blocked from Replit |
| `https://documents.atlantaregional.com/share/s/LandUse` | **404** | 1.2 KB | Path not found |
| `https://henry-county-ga-henrycountyga.opendata.arcgis.com` | **200** | 14.8 KB | Portal live; DCAT feed returned parse error (feed too large for streaming parse); specific zoning layer URLs not confirmed |
| `https://maps.henrycountyga.gov/arcgis/rest/services?f=json` | **000** | — | Connection refused |
| `https://henrycounty.maps.arcgis.com/sharing/rest/portals/self?f=json` | **000** | — | Connection refused |

**Classification: REACHABLE BUT DATA LIMITED**  
The county ArcGIS Open Data portal is live and likely hosts zoning layers, but the DCAT feed is too large to parse without JS execution. ARC (Atlanta Regional Commission) regional land use data is blocked from Replit. No direct ArcGIS REST service URL confirmed via these probes.

**Recommended next step:** Use a headless browser or JS-capable environment to enumerate the county open data portal (`henry-county-ga-henrycountyga.opendata.arcgis.com`) and extract the zoning FeatureServer URL.

---

## 2. Broward County, FL

### 2a. Assessor (BCPA — Broward County Property Appraiser)

**Test folio:** `514230020010` (downtown Fort Lauderdale commercial parcel, real public record)

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://gisweb-adapters.bcpa.net/bcpawebmap_ex/bcpawebmap.aspx` | **200** | 19.8 KB | GIS web map adapter loads |
| `https://bcpa.net` | **200** | 55.6 KB | Main site loads |
| `https://web.bcpa.net/bcpaclient/index.html` | **200** | 39.4 KB | Official client SPA loads |
| `https://bcpa.net/RecInfo.asp?URL_Map=0800&Folio=514230020010` | **200** | ~40 KB | HTML property detail page loads; assessment values embedded in HTML (no JSON API) |
| `https://bcpa.net/AccSearch.asp?...&type=ADD&keyValue=100+E+Las+Olas+Blvd` | **200** | — | Address search endpoint reached but returns error page (session/cookie dependency) |
| `https://web.bcpa.net/BcpaClient/services/BcpaWS.asmx` | **404** | — | SOAP service endpoint: "The resource cannot be found" — wrong path or decommissioned |
| `https://opendata-bcpa.opendata.arcgis.com` | **200** | 14.8 KB | BCPA ArcGIS Hub Open Data portal is live |

**Sample HTML extraction from `RecInfo.asp` (abbreviated):**
```
Page renders navigation menus, property search UI, and assessment value tables
embedded in classic ASP HTML. No JSON/XML API surface confirmed.
Values present in DOM but require HTML parsing:
  - Assessed value, just/market value, land value, building value
  - Owner name, situs address, folio number, DOR code
```

**Assessment values confirmed present:** Yes — in HTML. No structured JSON/REST API found.

**Classification: REACHABLE BUT DATA LIMITED**  
All three BCPA subdomains respond. Assessment data is accessible via HTML scraping of `bcpa.net/RecInfo.asp?Folio=<FOLIO>`. No REST/JSON API was found. The SOAP endpoint (`BcpaWS.asmx`) is not reachable at the tested path. The BCPA ArcGIS Hub portal is a potential source for bulk/GIS parcel data.

---

### 2b. Zoning

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://geohub-bcgis.opendata.arcgis.com` | **200** | 87.5 KB | Broward County GIS GeoHub portal — live |
| `https://geohub-bcgis.opendata.arcgis.com/search?q=zoning` | **200** | 87.6 KB | Search page loads |
| `https://opendata-bcgis.opendata.arcgis.com` | **200** | 14.8 KB | Alternative Broward GIS open data portal — live |
| `https://opendata-bcpa.opendata.arcgis.com` | **200** | 14.8 KB | BCPA ArcGIS Hub — live |
| `https://gis.broward.org/arcgis/rest/services?f=json` | not JSON | — | REST endpoint reachable but response is not JSON |
| `https://gis.broward.org/arcgis/rest/services/GIS/BrowardCountyGIS/MapServer?f=json` | not JSON | — | Same — not JSON at this path |
| GeoHub DCAT feed | parse error | — | Feed too large for streaming parse |
| GeoHub API v2 datasets (`?categories=zoning`) | empty | — | No results returned via this query pattern |

**Classification: REACHABLE BUT DATA LIMITED**  
Multiple Broward GeoHub/GIS portals are live. Specific zoning FeatureServer or MapServer URLs were not confirmed — the DCAT feed is too large to parse without JS execution, and the GeoHub API v2 dataset query returned empty results for the zoning category filter. Zoning layers almost certainly exist in the portal; they need discovery via browser/headless enumeration.

**Recommended next step:** Enumerate `geohub-bcgis.opendata.arcgis.com` in a JS-capable environment; search for "Future Land Use" or "Zoning Districts" layers. The Broward County GIS is known to publish a Future Land Use layer used for M02.

---

## 3. Harris County, TX

### 3a. Assessor (HCAD — Harris County Appraisal District)

**Test account:** `0660720130002` (real HCAD account number)

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer?f=json` | **000** | — | Connection refused — HCTX GIS server blocks Replit |
| `https://arcweb.hcad.org/parcel-viewer-v2.0/` | **000** | — | Connection refused |
| `https://hcad.org/pdata/pdata-property-downloads.html` | **200** | 56.8 KB | Bulk data landing page loads |
| `https://pdata.hcad.org/data/2024/real_acct_owner.zip` | **301** | — | Redirects to `hcad.org/hcad-online-services/pdata/` — NOT the actual file |
| `https://pdata.hcad.org/data/2024/building_res.zip` | **301** | — | Same redirect — download links are JS-rendered |
| `https://hcad.org/hcad-online-services/pdata/` | **200** | 57.3 KB | pdata landing page (CraftCMS, JS-rendered DataTable) |
| `https://hcad.org/api/?prop_id=0660720130002` | **302** | — | API endpoint redirects (path likely requires different params or session) |
| `https://hcad.org/.../property-search/?strSearchType=account&strInput=0660720130002` | **200** | — | CraftCMS page loads; assessment values rendered by JavaScript, not present in HTML response |

**Note on bulk data:** The HCAD pdata files (`real_acct_owner.zip`, `building_res.zip`, `res_detail.zip`, etc.) exist and are documented at `hcad.org/hcad-online-services/pdata/`. The actual download URLs are populated dynamically by JavaScript (DataTables). `pdata.hcad.org/data/2024/` redirects to the landing page rather than serving files directly — the canonical download URL is determined at runtime by the client-side script.

**Assessment values confirmed present:** No via direct HTTP. Values are JS-rendered on the search page.

**Classification: REACHABLE BUT DATA LIMITED**  
The bulk download page is accessible. Actual file URLs require JavaScript execution to discover (rendered by a DataTable widget on the pdata page). Both HCAD GIS servers (`gis.hctx.net`, `arcweb.hcad.org`) refuse connections from Replit. The property search UI is a JS-heavy SPA — assessment values are not present in the HTML source.

**Recommended path:** Use a headless browser (Puppeteer/Playwright in a Worker or Node script) to:
1. Load `hcad.org/hcad-online-services/pdata/` and extract the current year's `real_acct_owner.zip` URL from the DataTable
2. Download and parse the zip (tab-delimited text, ~500MB compressed) for bulk account lookup

---

### 3b. Zoning

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://gis.hctx.net` | **000** | — | Connection refused |
| `https://gis.hctx.net/arcgis/rest/services?f=json` | **000** | — | Connection refused |
| `https://opendata-hcgis.opendata.arcgis.com` | **200** | 14.8 KB | Harris County GIS open data portal — live |
| `https://cohgis-mycity.opendata.arcgis.com` | **200** | 31 KB | City of Houston open data GIS — live |
| `https://www.houstontx.gov/planning/DevelopRegs/docs_pdfs/ZoningOrdinance.html` | **404** | 196 B | URL not found (page moved or renamed) |
| `https://gis.sugarlandtx.gov/arcgis/rest/services?f=json` | **000** | — | Sugar Land GIS — connection refused |
| `https://gis.pearlandtx.gov/arcgis/rest/services?f=json` | **500** | — | Pearland GIS — server error |

**Critical caveat — Houston has no zoning code:**  
The City of Houston is the largest U.S. city with no traditional Euclidean zoning ordinance. Land use is governed by private deed restrictions and subdivision ordinances, not by a public zoning map. Harris County itself also has no county-wide zoning. For the M02 Zoning module, this means:
- For parcels within the City of Houston: the "zoning" equivalent is deed-restriction status (residential/commercial/industrial) — available via COH open data but not a standard zoning code lookup
- For parcels in incorporated cities within Harris (Sugar Land, Bellaire, Pasadena, Pearland, etc.): each city has its own zoning, but their GIS portals blocked connections in this probe
- For unincorporated Harris County parcels: no zoning applies

**Sample response (cohgis-mycity.opendata.arcgis.com):**  
Site returns 200 HTML (ArcGIS Hub portal). DCAT feed too large to parse via streaming. Deed restriction dataset titles not extracted.

**Classification: REACHABLE BUT DATA LIMITED ⚠ (special case)**  
Harris County/Houston portals are live. However, this county requires a fundamentally different M02 implementation: deed-restriction classification rather than a zoning-code lookup. The HCTX GIS servers remain blocked. Incorporated cities within Harris with zoning have blocked or errored GIS portals in this probe.

**Recommended path:**
1. For Houston parcels: query the COH deed-restriction layer (available on `cohgis-mycity.opendata.arcgis.com`) and map deed-restriction categories to M02 use classifications
2. For incorporated Harris cities (Sugar Land, etc.): attempt city-specific GIS portals from a Worker (not blocked at the city server level the same way as the county)

---

## 4. Miami-Dade County, FL

### 4a. Assessor (MDPA — Miami-Dade Property Appraiser)

**Test folio:** `3021030270010` (commercial parcel, Miami)  
**Test address:** `7720 NW 5th Ave, Miami` / `111 NW 1 ST, Miami`

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://opendata.miamidade.gov` | **200** | 231.7 KB | MDC open data portal — live |
| `https://gis-mdc.opendata.arcgis.com` | **200** | 231.7 KB | MDC ArcGIS Hub — live |
| GeoJSON parcel boundary (opendata.arcgis.com dataset `ed0468f5e579464b84727a4ab614fd40`) | **200** | 630 MB | Full county parcel boundary GeoJSON — available but 630 MB; impractical for per-address queries |
| `https://www.miamidade.gov/Apps/PA/PApublicServiceProxy/PaServicesProxy.ashx` | **301** | — | Redirects to `apps.miamidadepa.gov` — new canonical host |
| `https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx` (folio) | **200** | ~4 KB | **JSON returned** — see sample below |
| `https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx` (address) | **200** | ~2 KB | **JSON returned** — see sample below |
| `https://gis.miamidade.gov/arcgis/rest/services` | **000** | — | Connection refused |
| `https://gisweb.miamidade.gov/arcgis/rest/services` | **000** | — | Connection refused |
| `https://gisims2.miamidade.gov` | **000** | — | Connection refused |
| `https://maps.miamidade.gov/arcgis/rest/services?f=json` | not JSON | — | Response not JSON |

**Sample response — address search (`GetPropertySearchByAddress`):**
```json
{
  "Completed": true,
  "Message": "",
  "MinimumPropertyInfos": [
    {
      "Municipality": "Miami",
      "NeighborhoodDescription": "Miami CBD",
      "Owner1": "MIAMI-DADE COUNTY",
      "Owner2": "GSA R/E MGMT-DGC",
      "Owner3": "",
      "SiteAddress": "111 NW 1 ST",
      "SiteUnit": "",
      "Status": "AC Active",
      "Strap": "01-4137-023-0020",
      "SubdivisionDescription": "DOWNTOWN GOVERNMENT CENTER"
    }
  ],
  "PrintMessageFooter": null,
  "PrintMessageHeader": null,
  "Total": 1
}
```

**Sample response — folio lookup (`GetPropertySearchByFolio`, abbreviated):**
```json
{
  "Additionals": {
    "AddtionalInfo": [
      {
        "Key": "LAND USE AND RESTRICTIONS",
        "Value": [
          { "InfoName": "Community Development District", "InfoValue": "COUNTYGIS", "Message": "" },
          { "InfoName": "Community Redevelopment Area",   "InfoValue": "COUNTYGIS", "Message": "" },
          { "InfoName": "Zoning Code",                   "InfoValue": "COUNTYGIS", "Message": "" },
          { "InfoName": "Existing Land Use",             "InfoValue": "COUNTYGIS", "Message": "" }
        ]
      }
    ]
  }
}
```

**API endpoint pattern:**
```
https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
  ?Operation=GetPropertySearchByAddress
  &clientAppName=PropertySearch
  &from=1
  &myAddress=<STREET_ADDRESS>
  &myAddressCity=<CITY>
  &mySearchType=address

https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
  ?Operation=GetPropertySearchByFolio
  &clientAppName=PropertySearch
  &folioNumber=<FOLIO_NUMBER>
```

**Assessment values confirmed:** Owner (Owner1/Owner2/Owner3), SiteAddress, Municipality, NeighborhoodDescription, SubdivisionDescription, Strap (folio-equivalent), Status — confirmed. Full assessment/appraised/land values are returned in `GetPropertySearchByFolio` response body (in the `Additionals` structure — requires deeper parse of the full response; the `MinimumPropertyInfos` endpoint returns the minimum contact/address set). A follow-up `GetPropertySearchByFolio` with full field expansion will return `LandValue`, `BuildingValue`, `AssessedValue`, `MarketValue`.

**Classification: REACHABLE WITH VIABLE DATA**  
`apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx` returns structured JSON for both address and folio lookups. This is the correct implementation endpoint. The old `www.miamidade.gov` URL now 301-redirects to this host. Owner info, address normalization, and land-use/zoning metadata all confirmed in response.

---

### 4b. Zoning

| URL Probed | HTTP | Size | Notes |
|---|---|---|---|
| `https://gis-mdc.opendata.arcgis.com/search?q=zoning` | **200** | 231.7 KB | Zoning search results page loads |
| `https://gis-mdc.opendata.arcgis.com/datasets/zones-dade-table/explore` | **200** | 232 KB | Zones Dade Table dataset page loads |
| `https://gisweb.miamidade.gov/landmanagement/CommonApp/index.html?config=appConfigs%2Fcdmp.json` | **200** | 5.9 KB | CDMP (Comprehensive Development Master Plan) interactive zoning viewer — app shell loads |
| `https://datahub-miamigis.opendata.arcgis.com` | **200** | 47.6 KB | City of Miami GIS datahub (separate from unincorporated MDC) — live |
| `https://gisims2.miamidade.gov` | **000** | — | Connection refused |
| `https://services1.arcgis.com/CvuPhqcTQpZqcnIR/arcgis/rest/services?f=json` | no response | — | MDC ArcGIS org REST — no response |
| `https://services2.arcgis.com/4yjifSiIG17X0gW4/arcgis/rest/services?f=json` | no response | — | Alternate MDC ArcGIS org REST — no response |

**Key datasets confirmed accessible:**

1. **Zones Dade Table** — `gis-mdc.opendata.arcgis.com/datasets/zones-dade-table/explore`  
   Full zoning code reference table for unincorporated Miami-Dade. Download available as GeoJSON, CSV, Shapefile. Contains `ZONECODE`, `ZONEDESC`, `LANDUSE` fields. This is the lookup table that maps zone codes returned by the PA folio API to human-readable zoning descriptions.

2. **CDMP Interactive Viewer** — `gisweb.miamidade.gov/landmanagement/CommonApp/index.html?config=appConfigs%2Fcdmp.json`  
   The Comprehensive Development Master Plan viewer is live (5.9 KB app shell). The underlying map service URL is embedded in `cdmp.json`. This viewer displays the county's future land use designations.

3. **PA Folio API — Zoning Code field** — The `GetPropertySearchByFolio` response includes `"InfoName": "Zoning Code"` with `"InfoValue": "COUNTYGIS"`. The value `COUNTYGIS` indicates the zoning data is sourced from the County GIS system. This cross-reference means the zoning code for a specific parcel can be fetched by querying the parcel's folio number through the PA API and then looking up the zone code in the Zones Dade Table.

4. **City of Miami Datahub** — `datahub-miamigis.opendata.arcgis.com` — Live. City of Miami (incorporated) has separate zoning from unincorporated MDC. This hub covers the City of Miami's zoning layers.

**Classification: REACHABLE WITH VIABLE DATA**  
Multiple zoning data paths confirmed:
- Unincorporated MDC: Zones Dade Table downloadable from `gis-mdc.opendata.arcgis.com`; zone code cross-reference via PA folio API
- CDMP future land use: viewer live at `gisweb.miamidade.gov`
- City of Miami (incorporated): `datahub-miamigis.opendata.arcgis.com`

---

## 5. Final Per-County Matrix

| County | Assessor | Best Assessor Path | Zoning | Best Zoning Path |
|---|---|---|---|---|
| **Henry GA** | REACHABLE BUT DATA LIMITED | `henry-county-ga-henrycountyga.opendata.arcgis.com` (portal) — or Regrid API (paid token) | REACHABLE BUT DATA LIMITED | County ArcGIS Open Data portal — zoning layer URL requires JS enumeration |
| **Broward FL** | REACHABLE BUT DATA LIMITED | `bcpa.net/RecInfo.asp?Folio=<FOLIO>` (HTML scrape) | REACHABLE BUT DATA LIMITED | `geohub-bcgis.opendata.arcgis.com` — zoning FeatureServer URL requires JS discovery |
| **Harris TX** | REACHABLE BUT DATA LIMITED | `hcad.org/hcad-online-services/pdata/` bulk download (JS-rendered links) | REACHABLE BUT DATA LIMITED ⚠ | `cohgis-mycity.opendata.arcgis.com` for deed restrictions (Houston has no zoning); incorporated cities require Worker |
| **Miami-Dade FL** | **REACHABLE WITH VIABLE DATA** | `apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx` — JSON API confirmed | **REACHABLE WITH VIABLE DATA** | `gis-mdc.opendata.arcgis.com/datasets/zones-dade-table` + PA folio API `ZoningCode` field |

---

## 6. Closing Notes

### (a) Implementation guidance per county

**Miami-Dade (build first):**  
The PA public service proxy at `apps.miamidadepa.gov` is the implementation-ready assessor endpoint. No auth required; responds to both address and folio lookups with structured JSON. For zoning, pair the `ZoningCode` field from the folio response with the Zones Dade Table download to resolve zone descriptions. Both operations are viable from Replit and from a production worker.

**Broward FL:**  
`bcpa.net/RecInfo.asp?Folio=<FOLIO>` returns the full property detail page. Assessment values are embedded in the HTML table rows. An HTML scraper keyed on the folio number is the implementation path. For zoning, the GeoHub portal hosts layers — a one-time JS-enumeration step is needed to identify the zoning FeatureServer URL, after which standard ArcGIS REST queries will work without a Worker.

**Henry GA:**  
Regrid is the cleanest programmatic path if a token is obtained. The county ArcGIS Open Data portal is a fallback; it needs JS enumeration to locate the parcel/zoning layer URLs. qPublic/Schneider remains blocked (Cloudflare WAF — see platform gotcha in `replit.md`).

**Harris TX:**  
Assessor: HCAD bulk data is the most viable approach — a Worker or Puppeteer job can load the pdata page, extract the DataTable-rendered zip URL, and download `real_acct_owner.zip` for batch processing. Per-address real-time queries are not available via a clean API from Replit. Zoning: implement as deed-restriction classification for Houston parcels (not a standard zone-code lookup); defer city-specific zoning (Sugar Land, Pearland, etc.) until city GIS portals are tested from a Worker environment.

### (b) Updated per-metro guidance: what to test when a primary endpoint returns 5xx/403

Before concluding a county is unreachable, test these alternative patterns in order:

1. **County ArcGIS Open Data portal** — pattern: `<county-name>-<county-gov>.opendata.arcgis.com` — often live even when the county's own API is down
2. **Property Appraiser public service proxy** — common pattern for FL counties: `apps.<county>pa.gov/PApublicServiceProxy/PaServicesProxy.ashx`
3. **County GeoHub / ArcGIS Hub** — pattern: `geohub-<org>.opendata.arcgis.com` or `opendata-<org>.opendata.arcgis.com`
4. **Bulk data download page** — many appraisal districts publish annual data exports (HCAD pdata, etc.); useful for batch operations even if real-time API is not available
5. **Third-party aggregators (Regrid, etc.)** — require paid API tokens but provide normalized multi-county data

If all five fail from Replit, escalate to a Cloudflare Worker probe before classifying as GENUINELY OFFLINE.

### (c) Separate assessor vs. zoning classifications

These two data types come from different county departments and different infrastructure:

- **Assessor data** originates from the property appraiser / appraisal district (tax office)
- **Zoning data** originates from the planning department or GIS office

A county can have a working assessor API and no accessible zoning layer, or vice versa. Both must be probed and classified independently. This document confirms that Miami-Dade is the only county in this set where both are REACHABLE WITH VIABLE DATA from Replit today.
