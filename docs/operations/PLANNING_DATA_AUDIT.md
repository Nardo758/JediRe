# Municipal Planning Data Audit

**Generated:** 2026-05-25  
**Task:** #1071  
**Scope:** Pre-permit planning data (zoning applications, site plan submissions, planning commission agendas) across the 10 metros where JEDI RE has active or stub assessor adapters — GA metro counties + FL (Miami-Dade, Broward). NC / TN / TX are out of scope.

---

## Assessor Adapter Coverage Baseline

Source: `backend/src/services/municipal-enrichment/index.ts`

| Adapter | State | County FIPS | Status | Parcel ID Format |
|---|---|---|---|---|
| `fulton-ga.adapter.ts` | GA | 13121 | LIVE | `parcel_id` — 14-char alphanumeric (e.g., `14 007300020039`) |
| `dekalb-ga.adapter.ts` | GA | 13089 | LIVE | `PARCELID` — 14-char space-padded (e.g., `15 062 02 004`) |
| `cobb-ga.adapter.ts` | GA | 13067 | LIVE | `PIN` — numeric string (e.g., `20011200890`) |
| `gwinnett-ga.adapter.ts` | GA | 13135 | LIVE | `PIN` — numeric/space (e.g., `6195 151`); `RPIN` adds `R` prefix |
| `cherokee-ga.adapter.ts` | GA | 13057 | LIVE | `PIN` — dashed (e.g., `15-1237-0075`) |
| `clayton-ga.adapter.ts` | GA | 13063 | LIVE | `PARCELID` — space-padded (e.g., `04204 205001`) |
| `henry-ga.adapter.ts` | GA | 13151 | STUB | No accessible ArcGIS endpoint from cloud IPs |
| `duval-fl.adapter.ts` | FL | 12031 | LIVE | `RE` — space-separated (e.g., `167747 3010`) |
| Miami-Dade | FL | 12086 | NOT BUILT | Folionum — 13-digit (e.g., `3021010310230`) |
| Broward | FL | 12011 | NOT BUILT | Folio — varies by municipality |

**Key note:** The M02 zoning module (`backend/src/services/regulatory/m02-zoning/index.ts`) already has `atlantaAdapter` registered for all 7 GA FIPS codes and queries the Atlanta DPCD GIS `LotsWithZoning` layer for zoning codes. That existing integration provides the parcel geometry path that planning application adapters would reuse.

---

## Metro Investigations

---

### Metro 1 — City of Atlanta (DPCD)

**Jurisdiction:** City of Atlanta Department of City Planning (DPCD). Separate from Fulton County — the City has its own planning process, but most City parcels are in Fulton County (FIPS 13121) so the Fulton assessor PIN is the link key.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://dpcd-coaplangis.opendata.arcgis.com |
| **Platform** | ArcGIS Hub (Esri) — publicly queryable FeatureServer layers |
| **Existing JEDI platform use** | `atlantaAdapter` already queries the `LotsWithZoning` layer from `gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer` for zoning codes |
| **Planning applications layer** | FeatureServer item `655f985f43cc40b4bf2ab7bc73d2169b` (Rezoning Case Map) |
| **Additional ArcGIS services** | `https://gis.atlantaga.gov/dpcd/rest/services/` — root; sub-services include `LandUsePlanning`, `ZoningAmendments`, `VarianceCases` |
| **Auth required** | No — all Hub layers are public |
| **Rate limits** | ArcGIS Hub standard: 2,000 records per query page (`resultOffset`/`resultRecordCount` supported); no documented per-minute cap for read-only feature queries |
| **ToS** | City of Atlanta Open Data — standard government public-use terms; no scraping prohibition; no `ai-train` restriction detected |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending) | **Yes** | Structured FeatureServer layer; fields include case number, address, applicant, current/proposed zoning, submission date, hearing date, status |
| Zoning amendment applications (recently approved) | **Yes** | Same layer; `STATUS` field transitions to `APPROVED`/`DENIED` |
| Site plan / development plan submissions | Partial | DPCD site plan review is internal; no confirmed public FeatureServer layer for site plans separate from zoning cases |
| Pre-application meetings | No | Not published publicly |
| Variance applications | **Yes** | Separate variance layer available in Hub |
| Planning commission agendas (next 60 days) | **Yes** | Zoning Review Board (ZRB) agendas published via City of Atlanta agenda portal (Granicus) and duplicated in the Hub case layer hearing date fields |
| Planning commission minutes (last 12 months) | Partial | PDF minutes via Granicus; structured case status updates via ArcGIS |
| Public hearing notices | **Yes** | Within FeatureServer case records (hearing date + case details) |
| Council agenda items (development) | Partial | Atlanta City Council agenda via Granicus (Legistar); not linked to planning layer |

#### C. Data Freshness

- ArcGIS Hub layers: updated within 1 business day of status change in DPCD's internal system.
- New applications appear in the FeatureServer within 1–3 business days of filing acceptance.
- No RSS or webhook feed exists — polling is the only mechanism.
- Recommended poll interval: daily (nightly sweep of `WHERE submission_date >= CURRENT_DATE - 7` to catch both new filings and recent status changes).

#### D. Entity Linkage

- The Rezoning Case Map FeatureServer includes `PARCEL_ID` (Fulton County PIN format, e.g., `14 007300020039`) alongside the case geometry.
- This PIN directly matches the `parcel_id` returned by `fulton-ga.adapter.ts`.
- Cross-reference key: `planning_applications.parcel_id → properties.parcel_id` (existing `properties` table).
- Address fallback: if the parcel PIN is absent, the case address can be geocoded via the Census Geocoder (the same path MunicipalEnrichmentService uses) to resolve a PIN.

#### E. Relevant Fields (Rezoning Case Layer)

| Field | Notes |
|---|---|
| Case number | e.g., `Z-24-123` |
| Applicant name + contact | Developer/attorney entity |
| Property address | Situs address |
| Parcel ID (PIN) | Fulton County format |
| Current zoning | e.g., `R-4` |
| Proposed zoning | e.g., `MRC-3` |
| Proposed use description | Free-text |
| Submission date | ISO date |
| Status | PENDING / APPROVED / DENIED / CONTINUED / WITHDRAWN |
| Scheduled hearing date | ZRB hearing date |
| Staff recommendation | Sometimes embedded; often PDF link |
| Council district | Political geography |

#### F. Extraction Complexity

**Rating: GREEN**  
Rationale: The DPCD ArcGIS Hub exposes a queryable FeatureServer with structured case attributes including parcel PIN; no authentication required; the existing platform already queries the same ArcGIS server (`gis.atlantaga.gov/dpcd/rest/`) for zoning codes, so the HTTP path and infrastructure are already established.

---

### Metro 2 — Fulton County

**Jurisdiction:** Fulton County Community Development — county-level planning authority outside City of Atlanta limits (South Fulton, Alpharetta, Milton, Roswell, Sandy Springs, Johns Creek, Mountain Park, and unincorporated areas). City of Atlanta applications go through DPCD (Metro 1).

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://gisdata.fultoncountyga.gov |
| **ArcGIS Hub** | https://commdist-fulcogis.opendata.arcgis.com |
| **Platform** | ArcGIS Hub (Esri) — publicly queryable |
| **Zoning layer ArcGIS item** | `ea83de932021475ab2a5b08f33eb9b71` (Fulton County GA Zoning) |
| **Maps item (planning viewer)** | `4bef7661a5b04a7c854cd4e3ebfc0deb` |
| **Planning commission agendas** | Fulton County Board of Commissioners agenda via Granicus (legistar.com/Fulton) |
| **Auth required** | No for ArcGIS Hub; Granicus agenda pages are public HTML |
| **Rate limits** | ArcGIS Hub standard |
| **ToS** | Fulton County Open Data — standard government public-use terms |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending) | **Yes** | ArcGIS Hub zoning amendment layer (County Community Development) |
| Zoning amendment applications (recently approved) | **Yes** | Same layer; status field |
| Site plan submissions | Partial | Internal review; not confirmed as public FeatureServer |
| Variance applications | Partial | May be included in zoning amendment layer |
| Planning commission agendas | **Yes** | Granicus HTML + PDF; structured enough for LLM extraction |
| Planning commission minutes | **Yes** | Granicus PDF archive |
| Public hearing notices | **Yes** | Within zoning case records |
| Council agenda items | **Yes** | Fulton BoC Legistar agenda (structured HTML) |

#### C. Data Freshness

- ArcGIS Hub layers: updated within 1–3 business days of status change.
- Granicus agendas published 5–7 business days before hearing.
- No RSS; polling required.

#### D. Entity Linkage

- ArcGIS Hub zoning layer includes parcel PIN in Fulton County format (matches `fulton-ga.adapter.ts` `parcel_id`).
- Cross-reference: `planning_applications.parcel_id → properties.parcel_id`.
- Where PIN is absent, address geocoding resolves via Census Geocoder → Fulton ArcGIS adapter.

#### E. Relevant Fields

Same schema as Atlanta DPCD (case number, applicant, address, PIN, current/proposed zoning, submission date, status, hearing date) — Fulton County may include additional fields for subdivision name, district, and commissioner name.

#### F. Extraction Complexity

**Rating: GREEN**  
Rationale: ArcGIS Hub FeatureServer with parcel PIN; no auth; same query pattern as Atlanta DPCD. Granicus agendas are supplementary (YELLOW complexity) but the primary case layer is structured.

---

### Metro 3 — DeKalb County

**Jurisdiction:** DeKalb County Planning & Sustainability — county-level; covers Decatur area (with City of Decatur having own planning), Tucker, Chamblee, Doraville, Stone Mountain, Lithonia, and unincorporated areas.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary planning portal** | https://dekalbcountyga.gov/departments/planning-and-sustainability/zoning |
| **E-permitting portal** | https://epermits.dekalbcountyga.gov (Accela Civic Platform; agency code `DEKALB`) |
| **Platform** | Accela Civic Platform (ACA front end) |
| **GIS portal** | https://dekalbcountyga.gov/departments/gis |
| **Auth required** | No — Accela public record search does not require login |
| **Rate limits** | Accela does not publish explicit rate limits; standard courtesy limit of 1 req/sec |
| **ToS** | DeKalb County public records — no explicit automated-access prohibition in documented terms |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending) | **Yes** | Accela ACA search by record type `Zoning - Rezoning` |
| SLUP / Special Land Use Permit | **Yes** | Accela record type `Zoning - SLUP` |
| Major / Minor Modifications | **Yes** | Accela record type fields |
| Variance applications | **Yes** | Accela record type `Zoning - Variance` |
| Certificate of Appropriateness | **Yes** | Accela record type |
| Site plan submissions | **Yes** | Accela record type `Site Development` |
| Pre-application meetings | No | Internal; not in Accela |
| Planning commission agendas | Partial | HTML page at dekalbcountyga.gov; PDF agendas 7 days before hearing |
| Planning commission minutes | Partial | PDF archive on county website |
| Public hearing notices | **Yes** | Within Accela case record (hearing date field) |

#### C. Data Freshness

- Accela records created at filing; status updates within 1 business day.
- No RSS or webhook; Accela supports a `lastModifiedDate` filter in queries.
- Recommended poll: daily sweep filtering `lastModifiedDate >= yesterday`.

#### D. Entity Linkage

- Accela records include property address; parcel number field (`Parcel Number`) maps to DeKalb County PIN format.
- DeKalb PIN format from `dekalb-ga.adapter.ts`: space-padded 14-char (e.g., `15 062 02 004`).
- Cross-reference: `planning_applications.parcel_number → properties.parcel_id` via `dekalb-ga.adapter.ts`.
- Address-based fallback available via Census Geocoder → DeKalb adapter when PIN is missing.

#### E. Relevant Fields (Accela)

| Field | Notes |
|---|---|
| Record number | e.g., `DEKALB-2024-REZONE-001234` |
| Record type | REZONING / SLUP / VARIANCE / SITE PLAN |
| Applicant name | Developer or attorney |
| Property address | Situs address |
| Parcel number | DeKalb County PIN |
| Current zoning | From record details |
| Proposed zoning | From record details |
| Description | Project narrative (free text) |
| Filed date | ISO date |
| Status | Filed / Under Review / Approved / Denied |
| Hearing date | Planning commission or Board of Commissioners |

#### F. Extraction Complexity

**Rating: YELLOW**  
Rationale: Accela ACA provides structured public search with parseable HTML responses; parcel numbers are present in records; pattern is well-documented and used by multiple counties (Gwinnett, Cobb, DeKalb) enabling a single Accela adapter class. Requires session-aware scraping (Accela uses ASP.NET ViewState) but no authentication.

---

### Metro 4 — Cobb County

**Jurisdiction:** Cobb County Community Development — covers Marietta, Kennesaw, Acworth, Smyrna, Vinings, Austell, Powder Springs, and unincorporated Cobb.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.cobbcounty.gov/community-development/zoning-division |
| **Citizen Access Portal** | https://cobbca.cobbcounty.gov/CitizenAccess/default.aspx (Accela ACA) |
| **Platform** | Accela Civic Platform (same vendor as DeKalb, Gwinnett) |
| **Forms / applications list** | https://www.cobbcounty.gov/community-development/zoning-division/zoning-forms |
| **Auth required** | No for public record search |
| **Rate limits** | Same Accela courtesy conventions |
| **ToS** | Cobb County public records — no explicit automated-access prohibition |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment / rezoning applications | **Yes** | Accela ACA search; record type `Planning - Rezoning` |
| Special Use Permits | **Yes** | Accela record type |
| Variance applications | **Yes** | Accela record type |
| Site plan submissions | **Yes** | Accela record type `Site Development` or `Land Development` |
| Pre-application meetings | No |  |
| Planning commission agendas | Partial | HTML at cobbcounty.gov; PDF agendas |
| Planning commission minutes | Partial | PDF archive |
| Public hearing notices | **Yes** | Within Accela case record |

#### C. Data Freshness

- Same Accela freshness pattern as DeKalb: records available within 1 business day of filing.
- Poll daily with `lastModifiedDate` filter.

#### D. Entity Linkage

- Accela records include parcel PIN in Cobb County format (numeric string matching `cobb-ga.adapter.ts` `PIN`).
- Cross-reference: `planning_applications.parcel_number → properties.parcel_id`.

#### E. Relevant Fields

Same Accela schema as DeKalb (record number, type, applicant, address, parcel, current/proposed zoning, filed date, status, hearing date).

#### F. Extraction Complexity

**Rating: YELLOW**  
Rationale: Accela ACA — same platform as DeKalb; one adapter class covers both. ViewState scraping required but well-understood. Parcel PIN present in records enabling direct linkage to existing Cobb assessor adapter.

---

### Metro 5 — Gwinnett County

**Jurisdiction:** Gwinnett County Planning & Development — covers Lawrenceville (county seat), Duluth, Norcross, Peachtree Corners, Lilburn, Snellville, Loganville, and unincorporated Gwinnett.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.gwinnettcounty.com/departments/planningdevelopment |
| **ZIP Portal (Accela)** | https://aca-prod.accela.com/GWINNETT/Welcome.aspx — replaced eTrakit (now defunct) |
| **Platform** | Accela Civic Platform (same vendor as DeKalb, Cobb) |
| **ArcGIS Hub** | https://gcgis-gwinnettcountyga.hub.arcgis.com (zoning layers; item `aca675dc82a248a0adde4b70eaad0d8d`) |
| **Applications received (HTML)** | https://www.gwinnettcounty.com/government/departments/planning-development/land-use-planning/applications-received/2024 |
| **Auth required** | No for public record search |
| **Rate limits** | Accela standard; ArcGIS Hub standard |
| **ToS** | Gwinnett County public records |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending + recent) | **Yes** | Accela ZIP Portal; also HTML applications-received list at gwinnettcounty.com (year-by-year index) |
| Special Use Permits / CUPs | **Yes** | Accela record type |
| Variance applications | **Yes** | Accela record type |
| Site plan submissions | **Yes** | Accela ZIP Portal |
| Pre-application meetings | No | Internal |
| Planning commission agendas | **Yes** | gwinnettcounty.com agenda page (HTML + PDF); structured enough for parsing |
| Planning commission minutes | **Yes** | PDF archive |
| Public hearing notices | **Yes** | Within Accela case record + applications-received page |
| Council agenda items | **Yes** | BoC agenda via gwinnettcounty.com (HTML) |

#### C. Data Freshness

- Accela ZIP Portal: same-day to next-business-day from filing.
- The `applications-received/2024` index page is a curated HTML table that appears updated monthly — less real-time but structured and requires no Accela scraping.
- Recommended strategy: Accela for real-time tracking; HTML applications list as a weekly cross-check.

#### D. Entity Linkage

- Accela includes parcel PIN in Gwinnett format (e.g., `6195 151`), matching `gwinnett-ga.adapter.ts` `PIN`.
- The HTML applications-received page typically includes parcel ID and address.
- Cross-reference: `planning_applications.parcel_number → properties.parcel_id`.

#### E. Relevant Fields

Same Accela schema as DeKalb/Cobb. The HTML applications-received page adds: case number, applicant, address, parcel, type, action requested, scheduled hearing date.

#### F. Extraction Complexity

**Rating: YELLOW**  
Rationale: Accela ZIP Portal (same platform as DeKalb, Cobb) plus a structured HTML applications-received index that can be scraped without session management. ArcGIS Hub zoning layer is GREEN-rated. Multiple access paths reduce brittleness.

---

### Metro 6 — Cherokee County

**Jurisdiction:** Cherokee County Planning & Zoning — covers Canton (county seat), Woodstock, Ball Ground, Holly Springs, Waleska, Nelson, Tate, and surrounding areas.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.cherokeecountyga.gov/planning-and-zoning/ |
| **Legacy status portal** | https://cherokeega.com/cherokeestatus/ (ColdFusion `.cfm` — legacy; may be phased out) |
| **New CityView portal** | https://cityview.cherokeega.com/cvprodportal/ (ASP.NET / REST-ish) |
| **DSC App** | https://apps.cherokeecountyga.gov/DSC/ (modern SPA — unknown API backing) |
| **Platform** | Proprietary: CityView Software (municipal ERP, Tyler Technologies adjacent) + legacy ColdFusion |
| **ArcGIS Hub** | No confirmed planning applications layer; assessor parcel layer is at cherokeecountyga.gov ArcGIS server |
| **Auth required** | Public search available on both CherokeeStatus and CityView portals without login |
| **Rate limits** | No published limits; ColdFusion server has been slow (18–25s responses observed in assessor adapter testing) |
| **ToS** | Cherokee County public records — no explicit prohibition found |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment / rezoning applications | **Yes** | CityView portal search by application type; CherokeeStatus legacy also has applications |
| Variance / appeal applications | **Yes** | CityView / CherokeeStatus |
| Site plan submissions | Partial | May be in CityView; DSC app may cover land development |
| Pre-application meetings | No | Internal |
| Planning commission agendas | Partial | PDF at cherokeecountyga.gov; not in CityView API |
| Planning commission minutes | Partial | PDF archive |
| Public hearing notices | Partial | Within CityView case records |

#### C. Data Freshness

- CityView portal records created at filing; updates within 1 business day.
- No RSS or webhook.
- The legacy CherokeeStatus site may lag behind CityView.
- Recommended: poll CityView nightly.

#### D. Entity Linkage

- CityView includes property address and parcel PIN in Cherokee dashed format (e.g., `15-1237-0075`), matching `cherokee-ga.adapter.ts` `PIN`.
- Cross-reference: `planning_applications.parcel_pin → properties.parcel_id`.

#### E. Relevant Fields

| Field | Notes |
|---|---|
| Application number | Cherokee-specific format |
| Application type | REZONING / VARIANCE / SITE PLAN |
| Applicant | Name + contact |
| Property address | Situs |
| Parcel PIN | Cherokee dashed format |
| Proposed use | Free-text |
| Filed date | ISO date |
| Status | Filed / Scheduled / Approved / Denied |
| Hearing date | Board of Commissioners or Planning Commission |

#### F. Extraction Complexity

**Rating: ORANGE**  
Rationale: CityView portal is scrape-able but uses ASP.NET mechanisms (ViewState or similar); no confirmed public REST API; ColdFusion legacy is slow and fragile; no ArcGIS Hub for planning applications; smaller application volume reduces ROI. However, parcel linkage is achievable when PIN is present.

---

### Metro 7 — Clayton County

**Jurisdiction:** Clayton County Community & Economic Development — covers Jonesboro (county seat), Forest Park, Morrow, Riverdale, Lake City, Lovejoy, Rex, Ellenwood, Hampton.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.claytoncountyga.gov/government/community-economic-development/planning-zoning |
| **Online services** | https://www.claytoncountyga.gov/government/community-development/available-online-services/planning-and-zoning-portal |
| **Forms list** | https://www.claytoncountyga.gov/government/community-economic-development/planning-zoning/forms-and-applications/ |
| **Platform** | Proprietary / legacy CMS — no Accela or ArcGIS Hub planning application layer confirmed |
| **Auth required** | N/A — portal appears to be form submission with manual processing |
| **Rate limits** | N/A — primarily PDF forms |
| **ToS** | Clayton County public records |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending) | Partial | May be listed on the planning-zoning portal as text/HTML; no confirmed structured API |
| Zoning amendment applications (recently approved) | Partial | Meeting minutes PDF / agenda PDF |
| Site plan submissions | No confirmed public listing |  |
| Variance applications | Partial | Included in planning commission agendas (PDF) |
| Planning commission agendas | **Yes** | PDF published at claytoncountyga.gov before hearing |
| Planning commission minutes | **Yes** | PDF archive |
| Public hearing notices | Partial | Within PDF agendas |

#### C. Data Freshness

- No structured online application tracker identified.
- PDF agendas published 5–7 business days before hearing.
- Minutes published within 30 days of hearing.

#### D. Entity Linkage

- If application records are HTML-listed, they include property address (not always parcel PIN).
- Address must be geocoded to resolve Clayton County `PARCELID` (format `04204 205001`) via `clayton-ga.adapter.ts`.
- Parcel linkage is indirect (address → geocode → PARCELID) unless planning records explicitly include PARCELID.

#### E. Relevant Fields

Limited to what appears in PDF agendas: case number, applicant, property address, current/proposed zoning, hearing date, staff recommendation (brief text). Unit counts, square footage, and contact information often require reading full staff report PDF.

#### F. Extraction Complexity

**Rating: ORANGE**  
Rationale: No confirmed structured public application tracker; primary data source is PDF agendas requiring LLM extraction; parcel linkage requires address geocoding since PARCELID not guaranteed in agenda text; lower development activity volume relative to Fulton/DeKalb.

---

### Metro 8 — Henry County

**Jurisdiction:** Henry County Planning & Zoning — covers McDonough (county seat), Stockbridge, Hampton, Locust Grove.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.henrycountyga.gov/314/Planning-Zoning |
| **Applications, Reports & Maps** | https://www.henrycountyga.gov/321/Applications-Reports-Maps |
| **GIS portal** | https://www.henrycountyga.gov/320/GIS |
| **SagesGov** | https://www.sagesgov.com/henrycounty-ga — third-party government portal (Henry uses SagesGov for some public-facing services) |
| **Platform** | Appears to be static CMS (CivicPlus) + SagesGov; no Accela or ArcGIS Hub confirmed |
| **Auth required** | Unknown; Applications page appears to list PDFs |
| **GIS access** | Already confirmed blocked from cloud/VPS IPs (see `henry-ga.adapter.ts` — `not_implemented` status) |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications | Partial | PDF documents listed at henrycountyga.gov/321; no queryable API |
| Planning commission agendas | Partial | PDF |
| Planning commission minutes | Partial | PDF |
| All other stages | Unknown / No confirmed public listing |  |

#### C. Data Freshness

- Static PDF uploads; no automated feed.
- No RSS or webhook.

#### D. Entity Linkage

- Henry County GIS is inaccessible from cloud IPs (confirmed in `henry-ga.adapter.ts`).
- Even if PDF application records include parcel IDs, there is no programmatic way to validate or enrich them with the existing assessor adapter (which returns `not_implemented`).
- SagesGov may offer some structured search but its API is not publicly documented.

#### E. Relevant Fields

Unknown without access — Henry County application PDFs likely contain case number, applicant, address, proposed use, and hearing date.

#### F. Extraction Complexity

**Rating: RED**  
Rationale: GIS already confirmed inaccessible from cloud IPs; no structured planning application API or ArcGIS Hub found; primary data in PDFs with no indexing; parcel linkage broken (assessor adapter also STUB); SagesGov not publicly documented. FOIA is the only path to structured data — out of scope per task definition.

---

### Metro 9 — Miami-Dade County

**Jurisdiction:** Miami-Dade County — covers unincorporated Miami-Dade plus 34 municipalities. Note: City of Miami has its own separate planning department (City of Miami Office of Zoning). This investigation covers County-level planning data. **No existing assessor adapter.**

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **ArcGIS Open Data Hub** | https://gis-mdc.opendata.arcgis.com — primary open data portal |
| **Land Management portal** | https://gisweb.miamidade.gov/landmanagement/ |
| **ArcGIS REST root** | `https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/` |
| **MD_Zoning MapServer** | `https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer/1` — zoning boundary polygons |
| **Case tracking portal** | https://www8.miamidade.gov/Apps/RER/Track/case_track.aspx — BCC zoning hearing case search |
| **BCC zoning hearings** | https://www.miamidade.gov/zoning/hearing-commissioners.asp |
| **City of Miami (separate)** | https://www.miami.gov/zoning — separate jurisdiction; not covered here |
| **Platform** | ArcGIS (Esri) for GIS data; custom ASP.NET app for case tracking; no Accela confirmed |
| **Auth required** | No for all listed endpoints |
| **Rate limits** | ArcGIS standard |
| **ToS** | Miami-Dade County Open Data — standard government public-use terms; no scraping prohibition found |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| Zoning amendment applications (pending BCC hearings) | **Yes** | Case tracking portal (`case_track.aspx`) — structured ASP.NET search; returns case number, applicant, address, folio, type, status |
| Recently approved / denied applications | **Yes** | Same case tracking portal; status filtering |
| CDMP (Comprehensive Development Master Plan) amendments | **Yes** | BCC CDMP amendment tracker; hearing schedules at miamidade.gov/zoning |
| Site plan submissions | Partial | Miami-Dade uses DERM / RER review; not confirmed as structured public dataset |
| Pre-application meetings | No | Internal |
| BCC zoning hearing agendas | **Yes** | Published at miamidade.gov (HTML + PDF) 30 days before hearing |
| BCC hearing minutes | **Yes** | PDF archive |
| Public hearing notices | **Yes** | Posted in case tracking portal and agenda pages |

#### C. Data Freshness

- Case tracking portal: updated within 1–2 business days of filing.
- BCC agendas posted 30 days before hearing date.
- ArcGIS zoning boundary layer updated when rezoning is approved (may lag 30–90 days behind approval).
- No RSS; polling is the mechanism for both the case tracker and agendas.

#### D. Entity Linkage

- Miami-Dade planning records use **Folio Number** (13-digit, e.g., `3021010310230`) as the primary parcel identifier.
- No existing JEDI RE assessor adapter for Miami-Dade (FL coverage = Duval only).
- An assessor adapter would need to be built separately before full parcel linkage is possible.
- Interim path: address-based matching against `properties` table; folio number stored as `raw_parcel_id` pending adapter build.
- Miami-Dade Property Appraiser API (`https://www.miamidade.gov/pa/`) provides folio lookup by address — publicly accessible without auth; can serve as the link key until a full adapter is built.

#### E. Relevant Fields (Case Tracking Portal)

| Field | Notes |
|---|---|
| Case number | e.g., `2024-BCC-Z-001234` |
| Applicant name + contact | Developer or agent |
| Folio number | 13-digit Miami-Dade parcel ID |
| Property address | Situs |
| Application type | REZONING / VARIANCE / CDMP AMENDMENT |
| Current zoning | e.g., `RU-1` |
| Proposed zoning | e.g., `T6-8-O` |
| Proposed development (units / sqft) | Often in case description or linked staff report |
| Filed date | ISO date |
| Status | Pending / Scheduled / Approved / Denied / Continued |
| BCC hearing date | Commissioner hearing date |
| RER staff report | PDF link (when available) |

#### F. Extraction Complexity

**Rating: GREEN** (case tracker) / **YELLOW** (agenda PDF supplements)  
Rationale: Miami-Dade case tracking portal provides structured ASP.NET search returning case attributes including folio number; ArcGIS MapServer available for spatial queries. Primary barrier is that no Miami-Dade assessor adapter exists yet — parcel linkage requires Miami-Dade PA API as a bridge. Combined rating: **GREEN** — the case data is well-structured and publicly accessible.

---

### Metro 10 — Broward County

**Jurisdiction:** Broward County Planning & Zoning — administers Chapter 39 Zoning Code for the **Broward Municipal Services District (BMSD)**, which is the **unincorporated** portion of Broward County. Cities within Broward (Fort Lauderdale, Hollywood, Pompano Beach, Coral Springs, etc.) administer their own zoning — **those are separate jurisdictions not covered here**.

#### A. Access Mechanism

| Item | Detail |
|---|---|
| **Primary portal** | https://www.broward.org/Planning/Zoning/Pages/default.aspx |
| **Urban Planning Division** | https://www.broward.org/Planning/Pages/Default.aspx |
| **Zoning forms** | https://www.broward.org/Planning/FormsPublications/Pages/Zoning.aspx |
| **Accela portal** | Broward County uses Accela Civic Platform; public citizen access URL not confirmed as `aca-prod.accela.com/BROWARD` but Accela is the stated platform |
| **ArcGIS Hub** | No confirmed Broward ArcGIS Hub for planning applications; Broward County GIS at broward.org/GIS |
| **Auth required** | Public record search without login (if Accela is accessible) |
| **Rate limits** | Accela standard |
| **ToS** | Broward County public records |

#### B. Pipeline Stages Captured

| Stage | Available | Format |
|---|---|---|
| BMSD rezoning / zoning variance applications | Partial | If Accela portal is public-facing; zoning forms indicate electronic submission |
| County planning commission agendas | **Yes** | PDF agendas at broward.org |
| County planning commission minutes | **Yes** | PDF archive |
| Public hearing notices | Partial | Within agenda PDFs |
| City-level applications (Fort Lauderdale, Hollywood, etc.) | Out of scope | Each city has its own portal |

#### C. Data Freshness

- BMSD has very limited new development activity (most of Broward is incorporated and served by city planning departments).
- Agendas published 10 business days before hearing.
- No RSS.

#### D. Entity Linkage

- No existing JEDI RE assessor adapter for Broward County.
- Broward parcel identifiers (folio numbers) follow a different format from Miami-Dade.
- Broward Property Appraiser API available at https://www.bcpa.net/ — publicly accessible without auth.
- Address-based matching is the interim path.

#### E. Relevant Fields

Similar to Miami-Dade but much lower volume. Agenda PDFs contain case number, applicant, address, parcel folio, proposed use, current/requested zoning, hearing date.

#### F. Extraction Complexity

**Rating: ORANGE**  
Rationale: Accela portal not confirmed as publicly queryable from cloud IPs; primary data in agenda PDFs; BMSD jurisdiction is small (most of Broward is incorporated, with city planning departments out of scope); no assessor adapter exists; overall ROI is low relative to effort. Pursue cities individually (Fort Lauderdale, Hollywood) if Broward activity is needed.

---

## Summary Table

| Metro | Access Platform | Best Stages Captured | Parcel Linkage | Extraction | Priority |
|---|---|---|---|---|---|
| City of Atlanta (DPCD) | ArcGIS Hub (FeatureServer) | Rezoning, SLUP, Variance, Agendas | PIN → `fulton-ga.adapter.ts` (direct) | **GREEN** | 1 |
| Miami-Dade County | ASP.NET case tracker + ArcGIS MapServer | BCC Rezoning, CDMP amendments, Agendas | Folio → MDC PA API (bridge; no adapter yet) | **GREEN** | 2 |
| Fulton County | ArcGIS Hub (FeatureServer) + Granicus | Rezoning, Variance, Agendas, Minutes | PIN → `fulton-ga.adapter.ts` (direct) | **GREEN** | 3 |
| Gwinnett County | Accela ZIP Portal + HTML applications list | Rezoning, SLUP, Variance, Site Plan, Agendas | PIN → `gwinnett-ga.adapter.ts` (direct) | **YELLOW** | 4 |
| DeKalb County | Accela (epermits.dekalbcountyga.gov) | Rezoning, SLUP, Variance, Site Plan, Agendas | PIN → `dekalb-ga.adapter.ts` (direct) | **YELLOW** | 5 |
| Cobb County | Accela (cobbca.cobbcounty.gov) | Rezoning, SUP, Variance, Site Plan, Agendas | PIN → `cobb-ga.adapter.ts` (direct) | **YELLOW** | 6 |
| Cherokee County | CityView + CherokeeStatus (legacy) | Rezoning, Variance | PIN → `cherokee-ga.adapter.ts` (direct) | **ORANGE** | 7 |
| Clayton County | Static CMS (PDF agendas) | Agendas, Minutes | Address → geocode → `clayton-ga.adapter.ts` | **ORANGE** | 8 |
| Broward County | Accela (not confirmed) + PDF agendas | BMSD Agendas only | Folio → Broward PA API (bridge; no adapter) | **ORANGE** | 9 |
| Henry County | Static CMS + SagesGov (undocumented) | PDF documents only | BLOCKED (assessor adapter also STUB) | **RED** | 10 |

---

## Cross-Metro Patterns

### Accela Civic Platform (4 metros: DeKalb, Cobb, Gwinnett, Broward)

DeKalb, Cobb, and Gwinnett all use Accela Civic Platform with the ACA (Accela Citizen Access) front end. This means **one Accela adapter class can serve all three GA counties** by parameterizing the agency code and base URL:

| County | Agency Code | ACA Base URL |
|---|---|---|
| DeKalb | `DEKALB` | `https://epermits.dekalbcountyga.gov/` |
| Cobb | `COBB` | `https://cobbca.cobbcounty.gov/CitizenAccess/` |
| Gwinnett | `GWINNETT` | `https://aca-prod.accela.com/GWINNETT/` |

Accela ACA follows a standard URL pattern for record search:
```
GET /CitizenAccess/Cap/CapHome.aspx?module=Planning&TabName=Planning
POST /CitizenAccess/Cap/CapSearch.aspx
```
The response is HTML with `__VIEWSTATE` — parse with a DOM library (e.g., `cheerio`). All three counties return the same fields via the Accela standard schema. One `AccelaScraperAdapter` class with agency-specific config reduces implementation effort from 3 adapters to 1.

**Broward** also uses Accela but the public endpoint URL is unconfirmed — validate before building.

### ArcGIS Hub (3 metros: Atlanta DPCD, Fulton, Gwinnett)

Atlanta DPCD, Fulton County, and Gwinnett County all expose planning data via ArcGIS Hub FeatureServer layers. These can all be queried via the same `fetch()` + ArcGIS REST API pattern already used by the assessor adapters. The query template is:

```
GET https://{service_root}/FeatureServer/{layerId}/query
  ?where=submission_date >= DATE '2024-01-01'
  &outFields=*
  &resultOffset=0
  &resultRecordCount=1000
  &f=json
```

Pagination via `resultOffset` / `resultRecordCount`. No auth required.

### State-level FL aggregators

- **Florida Department of Economic Opportunity (DEO)** maintains a Comprehensive Planning database that includes adopted Future Land Use Map amendments for all 67 FL counties. URL: `https://floridajobs.org/community-planning-and-development/planners-and-local-governments/local-government-comprehensive-planning`. These are post-adoption (not pending), and are in PDF/GIS format — useful for confirmed amendments but not early-signal tracking.
- **Florida Division of Community Planning** does not publish a real-time application feed across counties.
- **Conclusion:** No FL state-level aggregator provides real-time pending application data. County-level access (Miami-Dade case tracker, Broward Accela) is the only path for early-signal data.

---

## Recommended Integration Sequence

Ordered by: (a) multifamily deal volume, (b) extraction complexity (GREEN before ORANGE), (c) parcel linkage confidence.

### Tier 1 — Build First (GREEN, existing parcel linkage)

**1. City of Atlanta DPCD** — Highest multifamily deal volume in the platform; ArcGIS FeatureServer already used by `atlantaAdapter`; PIN directly links to `fulton-ga.adapter.ts`.  
- Estimated effort: **3–4 days** (query FeatureServer, map fields to `planning_applications` table, handle pagination, write nightly Inngest job, wire parcel linkage).
- Output: rezoning + SLUP + variance cases with parcel PIN, applicant, proposed zoning, hearing date.

**2. Miami-Dade County** — Second-largest market; GREEN case tracker; no assessor adapter but Miami-Dade PA API provides folio bridge.  
- Estimated effort: **4–5 days** (ASP.NET form scraper for case tracker, folio → PA API bridge for parcel enrichment, nightly Inngest job; add Miami-Dade assessor adapter stub separately in a parallel task).
- Output: BCC rezoning + CDMP amendment cases with folio, applicant, proposed use, hearing date.

**3. Fulton County** — Logical companion to Atlanta DPCD (same parcel system); ArcGIS FeatureServer; covers suburban Fulton development activity in Alpharetta, Roswell, Johns Creek.  
- Estimated effort: **2 days** (reuse Atlanta DPCD ArcGIS adapter; parameterize service URL and layer ID).
- Output: county-level rezoning + variance cases.

### Tier 2 — Build Second (YELLOW, Accela shared adapter)

**4. Gwinnett County** — Large metro with significant multifamily pipeline; Accela ZIP Portal + HTML applications list (two access paths).  
- Combined Accela adapter (covers DeKalb + Cobb + Gwinnett): **4–5 days** for all three.

**5. DeKalb County** — Covered by same Accela adapter build.

**6. Cobb County** — Covered by same Accela adapter build.

Total Tier 2 effort: **4–5 days** for all three GA Accela counties as a single adapter build.

### Tier 3 — Defer (ORANGE / RED, lower ROI)

- **Cherokee County:** CityView scraping — implement if Cherokee activity appears in deal flow. Estimated: 3 days.
- **Clayton County:** PDF extraction only — defer until LLM agenda extraction pipeline is built (a dependency on #1073). Estimated: 2 days for ingestion + 1 day prompt tuning.
- **Broward County:** Low BMSD volume; confirm Accela URL first; defer pending Miami-Dade success. Estimated: 2 days if Accela confirmed.
- **Henry County:** RED — no path without FOIA or direct county engagement. Defer indefinitely.

---

## Open Questions

1. **Fetch mode: on-demand vs. scheduled sweep?**  
   The assessor adapters are on-demand (triggered per-property lookup). Planning data is most valuable as a proactive feed — new filings should surface without a user needing to look up a specific address first. Recommendation: scheduled nightly sweep → `planning_applications` table → alert triggers. This is a different pattern from the assessor adapters and needs product sign-off before implementation.

2. **Planning records → user alerts: which users and which conditions?**  
   Should a user monitoring the "Midtown Atlanta" submarket receive an alert when a new MRC-3 rezoning is filed within that polygon? Or only when a filing is adjacent to a property they own in the platform? Alert logic needs product definition before the pipeline is wired to the notification system.

3. **MVP field set — what is minimum viable?**  
   For an initial `planning_applications` table, the minimum viable fields are: case_number, jurisdiction, application_type, applicant_name, property_address, parcel_id, current_zoning, proposed_zoning, filed_date, status, hearing_date, source_url. Unit count, sqft, and stories are high-value but may require LLM extraction from staff reports and are not always in the structured record. Product decision needed.

4. **Parcel linkage for Miami-Dade and Broward — build assessor adapters first?**  
   The planning data for Miami-Dade and Broward cannot link to the `properties` table without folio resolution. Options: (a) build Miami-Dade assessor adapter in parallel (estimates 3–4 days); (b) use Miami-Dade PA API as a lightweight folio resolver without a full adapter. Option (b) is faster but produces shallower property enrichment. Decision needed.

5. **COR-24 / COR-23 enrichment — should planning records trigger proximity enrichment?**  
   New planning applications are pre-permit development signals. Should they trigger `enrich-property-proximity.ts` for the subject parcel? This would pre-populate transit and crime scores for emerging development sites before they appear in the assessor record. Low cost if piggybacked on existing enrichment script; needs confirmation of desired behavior.

6. **Atlanta DPCD variance vs. rezoning — separate M35 event types?**  
   M35 (DevelopmentAnnouncement) currently distinguishes deal types (ACQUISITION, DEVELOPMENT, GROUND_LEASE, etc.). Planning application types (REZONING, SLUP, VARIANCE, CDMP_AMENDMENT) may need a separate `planning_stage` field or a new M35 sub-type. Define schema before building #1073.

7. **Cherokee / Clayton / Clayton monitoring — worth building?**  
   These are ORANGE-rated metros with smaller development pipelines. Building scrapers for them increases maintenance burden (CityView ASP.NET, ColdFusion, PDF LLM extraction) with uncertain ROI. Should the platform track Cherokee and Clayton applications at all, or rely on trade press ingest (Task #1070–#1073) to surface activity in those markets?
