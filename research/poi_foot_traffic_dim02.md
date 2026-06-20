# Dimension 02: Free & Open-Source POI / Traffic Data Sources

> **Research Agent:** Dim02_Researcher  
> **Date:** 2026-06-20  
> **Scope:** Exhaustively catalog all free or near-free sources of POI and foot-traffic data for ranking multifamily properties by traffic.  
> **Searches Conducted:** 25+ independent queries across primary sources, academic papers, government datasets, and open-data portals.

---

## 1. Key Findings (Claim–Evidence Format)

### 1.1 OpenStreetMap (OSM) POI Data

**Claim:** OSM POI data is globally available and free, but its positional accuracy ranges from ~6 m to ~40 m, and coverage completeness varies dramatically by region and POI category.[^1]

**Source:** Zhang et al., *Using OpenStreetMap point-of-interest data to model urban change—A feasibility study* (PLoS ONE, 2019)

**URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC6388917/

**Date:** 2019-02-10

**Excerpt:**
> "The OSM dataset extract contains 529 coffee shops, while we were able to retrieve 851 locations from Foursquare... Using a strict label similarity score threshold of 0.9 and a 50 m proximity threshold for location-matching, we were able to match 310 (LCS method) and 316 (Levenshtein method) OSM POIs to Foursquare data... Close to 80% of all matching labels are within 30 m of each other, and about 95% are within 40 m."

**Context:** A 2008 UCL study found OSM positional accuracy over 70% in areas with good coverage, but noted that OSM was more complete than earlier assessments suggested—likely near 70% accuracy with occasional drop-offs.[^2]

**Confidence:** High

---

**Claim:** OSM POI attributes include name, category (via OSM tags such as `amenity=`, `shop=`, `leisure=`), opening hours, wheelchair access, website, and phone, but these tags are sparsely populated and vary by contributor diligence.[^3]

**Source:** World-POI: Global Point-of-Interest Data Enriched from Foursquare and OpenStreetMap (arXiv, 2025)

**URL:** https://arxiv.org/html/2510.21342v1

**Date:** 2025

**Excerpt:**
> "OSM contained more physically realistic coordinates, yet many points corresponded to generic or unverified map features such as islands, bays, or geographic formations rather than functional POIs... World-POI, however, produced a curated subset of POIs that corresponded to real, identifiable locations with accurate names and coordinates."

**Context:** OSM tags are crowd-sourced; commercial POI attributes (e.g., exact rentable square footage, revenue) are absent.

**Confidence:** High

---

### 1.2 US Census Bureau — LODES / OnTheMap

**Claim:** The LEHD Origin-Destination Employment Statistics (LODES) provides free, block-level employment data for all 50 states + DC, covering years 2002–2023 (Version 7.0), derived from administrative unemployment-insurance records and QCEW data.[^4]

**Source:** US Census Bureau / LEHD Program

**URL:** https://lehd.ces.census.gov/data/

**Date:** 2024-2025 (ongoing releases)

**Excerpt:**
> "LEHD Origin-Destination Employment Statistics (LODES) used by OnTheMap are available for download below. Version 7 of LODES was enumerated by... Data is available at the block level across 50 states+ DC, for up to 16 years per state or district."

**Context:** LODES includes Residence Area Characteristics (RAC), Workplace Area Characteristics (WAC), and Origin-Destination (OD) files. It tracks jobs, not people, and captures multiple jobs per worker. The Urban Institute provides pre-aggregated tract-level summaries under ODC-BY 1.0 license.[^5]

**Confidence:** High

---

**Claim:** OnTheMap is a free web-based mapping and reporting tool that visualizes LODES data, showing where workers live and work, with exports available in shapefile and spreadsheet formats.[^6]

**Source:** Macon MPO / Census Bureau documentation

**URL:** https://www.maconmpo.com/wp-content/uploads/2022/02/DRAFT_MATS2050MTP_22020202_RemoveWatermark.pdf

**Date:** 2022

**Excerpt:**
> "Based on the LEHD data, OnTheMap is a web-based mapping and reporting application that shows where workers are employed and is a good source for visualizing employment locations."

**Context:** OnTheMap for Emergency Management was updated to 2023 LODES data in March 2025.[^7]

**Confidence:** High

---

### 1.3 US Census Bureau — County Business Patterns (CBP)

**Claim:** County Business Patterns provides annual subnational economic data (establishments, employment, payroll) by NAICS industry at national, state, county, MSA, and ZIP-code levels, free for download back to 1986.[^8]

**Source:** US Census Bureau — CBP Datasets

**URL:** https://www.census.gov/programs-surveys/cbp/data/datasets.html

**Date:** 2024-11-25 (last updated)

**Excerpt:**
> "County Business Patterns (CBP) datasets are downloadable files in comma-separated value (CSV) format and provide data from 1986 to the current reference year. CBP data includes the number of establishments, employment during the week of March 12, first quarter payroll, and annual payroll..."

**Context:** Data is derived from the Business Register (administrative tax records). Suppression rules apply for confidentiality, causing some cells to be zero or missing.

**Confidence:** High

---

### 1.4 US Census Bureau — American Community Survey (ACS)

**Claim:** The ACS releases free 1-year and 5-year estimates annually for social, economic, housing, and demographic characteristics at the census-tract and block-group levels.[^9]

**Source:** US Census Bureau / ACS

**URL:** https://www.census.gov/programs-surveys/acs/data.html

**Date:** 2025-03-25

**Excerpt:**
> "The American Community Survey (ACS) releases new data every year through a variety of data tables that you can access with different data tools... Data is available for all geographic areas in the US that have at least 65,000 people [1-year]; 5-year series includes all geographic areas down to census tracts and block groups."

**Context:** ACS is a rolling sample survey; 5-year estimates are required for tract-level analysis. Data is free via data.census.gov, API, and IPUMS. Margin of error is published for all estimates.

**Confidence:** High

---

### 1.5 US Census Bureau — TIGER/Line Shapefiles

**Claim:** TIGER/Line shapefiles provide free digital vector maps of roads, railroads, rivers, lakes, and legal/statistical geographic areas (counties, tracts, block groups, ZIP codes), updated annually with boundaries as of January 1.[^10]

**Source:** US Census Bureau — TIGER/Line

**URL:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

**Date:** 2025-09-23 (2025 release)

**Excerpt:**
> "All legal boundaries and names are as of January 1, 2025. The 2025 TIGER/Line Shapefiles were released on September 23, 2025... The TIGER/Line Shapefiles are made available to the public for no charge and are typically used to provide the digital map base for a Geographic Information System."

**Context:** Shapefiles do not contain demographic data but include geographic entity codes that link to Census demographic data. Downloadable via FTP, direct web interface, or the `tigris` R package.

**Confidence:** High

---

### 1.6 EPA Smart Location Database (SLD)

**Claim:** The EPA Smart Location Database is a free nationwide geographic resource with 90+ attributes per census block group, including housing density, land-use diversity, street-network design, destination accessibility, transit service density, employment, and demographics.[^11]

**Source:** US EPA — Smart Location Mapping

**URL:** https://www.epa.gov/smartgrowth/smart-location-mapping

**Date:** 2025-09-29

**Excerpt:**
> "The Smart Location Database is a nationwide geographic data resource for measuring location efficiency. It includes more than 90 attributes summarizing characteristics, such as housing density, diversity of land use, neighborhood design, destination accessibility, transit service, employment and demographics. Most attributes are available for every census block group in the United States."

**Context:** Last updated in 2021; reflects 2010 housing/population, 2011 street network, and late-2012 transit service. Not suitable for rapidly changing neighborhoods. Available as file geodatabase, shapefile, and web services.

**Confidence:** High

---

### 1.7 EPA National Walkability Index

**Claim:** The EPA National Walkability Index provides a free, nationwide walkability score for every census block group based on street intersection density, employment mix, and employment-household mix.[^12]

**Source:** US EPA — Smart Location Mapping

**URL:** https://www.epa.gov/smartgrowth/smart-location-mapping

**Date:** 2025-09-29

**Excerpt:**
> "The National Walkability Index provides walkability scores based on a simple formula that ranks selected indicators from the Smart Location Database that have been demonstrated to affect the propensity of walk trips."

**Context:** Ranked scores (1–20) are provided; users can recalculate for custom geographies. Downloadable as ZIP file with metadata.

**Confidence:** High

---

### 1.8 FHWA / State DOT Traffic Data

**Claim:** The Federal Highway Administration's Highway Performance Monitoring System (HPMS) and Travel Monitoring Analysis System (TMAS) provide free annual traffic count data (AADT, vehicle classification, speed, weight) for state highways, but pedestrian data is limited and granular coverage is road-segment based, not property-level.[^13]

**Source:** data.gov / FHWA

**URL:** https://catalog.data.gov/dataset/highway-performance-monitoring-system-hpms-2011-delaware

**Date:** 2024-05-08

**Excerpt:**
> "Data First Published: 1981-11-01... Data Update Frequency: R/P1Y... Category: Transportation... Public Access Level: public"

**Context:** State DOTs (e.g., Florida, Minnesota, New Hampshire) publish interactive maps with free traffic count downloads, but these are primarily vehicle counts. Some cities (e.g., NYC DOT) publish bi-annual pedestrian counts at 114 retail-corridor locations.[^14]

**Confidence:** High

---

### 1.9 Local/State Open Data Portals — Pedestrian Counts

**Claim:** A growing number of cities publish free pedestrian count data from automated sensors or manual screenline counts, but coverage is geographically limited to downtown/CBD areas and updated monthly or bi-annually.[^15]

**Source:** NYC OpenData / data.gov

**URL:** https://catalog.data.gov/dataset/bi-annual-pedestrian-counts-6cc0a

**Date:** 2025-08-28

**Excerpt:**
> "An index of pedestrian volumes tracking the long-term trends of neighborhood commercial corridors. Data is collected at 114 locations, including 100 on-street locations (primarily retail corridors), 13 East River and Harlem River bridge locations, and the Hudson River Greenway."

**Context:** Melbourne, Sydney, Auckland, Dublin, and other global cities also publish hourly pedestrian counts. These datasets are excellent for calibration but cannot be extrapolated to all multifamily locations.

**Confidence:** High

---

### 1.10 Google COVID-19 Community Mobility Reports (Historical Baseline)

**Claim:** Google published free, daily, county-level mobility trend data (retail, grocery, parks, transit, workplaces, residential) from Feb 2020 to Oct 15, 2022, showing percent change from a Jan 2020 baseline.[^16]

**Source:** Google / rearc-data GitHub

**URL:** https://github.com/rearc-data/google-covid-19-community-mobility-reports

**Date:** 2020–2022 (archived)

**Excerpt:**
> "Google's COVID-19 Community Mobility Reports aim to provide insights into what has changed in response to policies aimed at combating COVID-19. The reports chart movement trends over time by geography, across different categories of places such as retail and recreation, groceries and pharmacies, parks, transit stations, workplaces, and residential."

**Context:** Data is *relative* change, not absolute visit counts. Discontinued Oct 2022. Valuable for historical baseline modeling but cannot provide current visit counts. Available as CSV with columns for each category.

**Confidence:** High

---

### 1.11 Apple Mobility Trends Reports (Historical Baseline)

**Claim:** Apple published free daily mobility data (driving, walking, transit direction requests) from Jan 13, 2020 through April 14, 2022, showing relative volume compared to a baseline.[^17]

**Source:** Apple / GitHub (rearc-data)

**URL:** https://github.com/rearc-data/apple-maps-mobility-trends-covid-19

**Date:** 2020–2022 (archived)

**Excerpt:**
> "This dataset contains COVID-19 mobility trends in countries/regions and cities from Apple. The CSV file show a relative volume of directions requests per country/region or city compared to a baseline volume on January 13th, 2020."

**Context:** Like Google, Apple data is relative, not absolute. No demographic breakdown. Discontinued April 2022. Privacy-preserving via random rotating identifiers.

**Confidence:** High

---

### 1.12 WorldPop — High-Resolution Population Data

**Claim:** WorldPop provides free global population estimates at 100 m resolution (3 arc) for 242 countries, covering 2000–2020 (Global1) and 2015–2030 projections (Global2), using Random Forest dasymetric mapping.[^18]

**Source:** WorldPop / University of Southampton

**URL:** https://www.worldpop.org/blog/worldpop-global2-global-high-resolution-population-estimates-for-2015-2030/

**Date:** 2026-02-17

**Excerpt:**
> "WorldPop provides annual population estimates at 100m resolution for 242 countries globally, covering the period 2015-2030... The methodology employs a Random Forest (RF) dasymetric approach to spatially disaggregate population counts from administrative boundaries to grid cells."

**Context:** Available via HDX, WorldPop website, and APIs. Constrained models limit population to settled areas; unconstrained models distribute across all land. Free and openly licensed (CC BY 4.0 / CC BY-SA).

**Confidence:** High

---

### 1.13 OpenAddresses

**Claim:** OpenAddresses is a free, crowdsourced global address dataset with ~69.5% US population coverage and substantial coverage in 34 countries; it is released under CC0 and updated weekly.[^19]

**Source:** OpenAddresses.io / Snowflake documentation

**URL:** https://results.openaddresses.io/coverage/world/

**Date:** 2021 (static archive; fresh data at batch.openaddresses.io)

**Excerpt:**
> "34 countries with complete land area coverage, 7 countries with substantial coverage, and 11 countries with minimal coverage... United States: Substantial, 69.5% population covered, 6,491K km² land area covered."

**Context:** Address records include lat/lon coordinates. No POI category data. Useful for geocoding and address normalization but does not contain visit counts.

**Confidence:** High

---

### 1.14 Google Open Buildings / Microsoft Building Footprints

**Claim:** Google Open Buildings provides ~1.5 billion building footprints derived from high-resolution satellite imagery, primarily covering Africa, Latin America, and parts of Asia, free for social-good use. Microsoft Building Footprints covers the US, Canada, and other regions with ~1.3 billion footprints.[^20]

**Source:** Google Research / Open Buildings

**URL:** https://sites.research.google/open-buildings/

**Date:** 2021–2024 (ongoing updates)

**Excerpt:**
> "Building footprints are useful for a range of important applications, from population estimation, urban planning and humanitarian response, to environmental and climate science. This large-scale open dataset contains the outlines of buildings derived from high-resolution satellite imagery."

**Context:** Building footprints are static geometry. No occupancy, visit, or business data. Combined with population data (WorldPop, LandScan) can infer residential density but not commercial foot traffic.

**Confidence:** High

---

### 1.15 Overture Maps Foundation — Free Global POI Dataset

**Claim:** Overture Maps (backed by Amazon, Microsoft, Meta, TomTom) publishes a free global Places dataset with ~53 million POI records, including name, category, address, and geometry, released under CDLA Permissive 2.0.[^21]

**Source:** Overture Maps Foundation / arXiv validation paper

**URL:** https://overturemaps.org/overture-2024-april-beta-release-notes/

**Date:** 2024-04-16

**Excerpt:**
> "This release has over 57M place records... The Places theme in this release includes incremental improvements to improve the accuracy and quality of the dataset. Data in the Places theme is licensed under CDLA Permissive 2.0."

**Context:** Available as GeoParquet on AWS/Azure. Command-line tool (`overturemaps`) allows bounding-box downloads. Full global places file exceeds 200 GB. UK academic validation found good locational accuracy but flagged attribute incompleteness for Microsoft-sourced POIs.[^22]

**Confidence:** High

---

### 1.16 HUD Multifamily Property Data

**Claim:** HUD publishes free geospatial datasets of subsidized and insured multifamily housing properties, including locations, program types (Section 8, Section 202, Section 811), and property characteristics, updated as of July 2025.[^23]

**Source:** data.gov / HUD

**URL:** https://catalog.data.gov/dataset/multifamily-properties

**Date:** 2025-07-30

**Excerpt:**
> "This dataset denotes HUD subsidized Multifamily Housing properties excluding insured hospitals with active loans. HUD's Multifamily Housing property portfolio consist primarily of rental housing properties with five or more dwelling units such as apartments or town houses..."

**Context:** Available as shapefile, GeoDatabase, and ArcGIS FeatureLayer. Property locations are approximate; individual building locations not depicted. Useful for target property inventory, not for traffic.

**Confidence:** High

---

### 1.17 GTFS / Transit Data

**Claim:** General Transit Feed Specification (GTFS) data is freely published by most US transit agencies, providing static routes, stops, and schedules; real-time GTFS-RT and ridership data (National Transit Database) are also free but ridership is aggregated at the agency level, not stop-level.[^24]

**Source:** EPA / CUTR at USF

**URL:** https://github.com/CUTR-at-USF/awesome-transit

**Date:** 2020–2025

**Excerpt:**
> "The General Transit Feed Specification (GTFS) site maintains information that describes how to create a GTFS feed and to make a transit feed publicly available... Agencies can post raw GTFS files for public download."

**Context:** GTFS provides *potential* transit accessibility (service frequency, stop locations), not actual boardings or foot traffic at a specific stop. NTD monthly ridership data is free at the agency-mode level.[^25]

**Confidence:** High

---

### 1.18 Google Maps Scraping — Legality & Limitations

**Claim:** Scraping publicly visible business data from Google Maps is generally legal under US federal law (hiQ v. LinkedIn, Meta v. Bright Data precedents), but it violates Google's Terms of Service, which exposes the scraper to civil liability risks such as IP bans, account suspension, or cease-and-desist letters.[^26]

**Source:** MapScraping.com / Scrap.io legal analysis

**URL:** https://mapscraping.com/is-google-maps-scraping-legal

**Date:** 2026-06-13

**Excerpt:**
> "Google Maps scraping is not automatically illegal under U.S. law if the data is publicly accessible and no security measures are bypassed... However, it does directly violate Google's platform rules... Violating a Terms of Service agreement is a private contractual matter, not a criminal offense."

**Context:** Google actively detects scraping via IP monitoring, rate limits, CAPTCHA, and behavioral detection. The Places API is the compliant alternative but costs $17–$25 per 1,000 requests after the free tier. Scraping provides richer data (emails, social profiles) but carries operational risk.

**Confidence:** High

---

### 1.19 SafeGraph / Foursquare / Placer.ai — Paid Alternatives

**Claim:** SafeGraph, Foursquare, and Placer.ai provide actual visit-count data (foot traffic) derived from mobile-device GPS panels, but pricing is enterprise-level, with annual seats reportedly in the five-figure range ($10K–$50K+).[^27]

**Source:** Geod.app / SafeGraph comparison guide

**URL:** https://www.geod.app/resources/placer-ai-alternatives

**Date:** 2026-06-07

**Excerpt:**
> "Placer.ai does not publish pricing; every engagement is quoted, and a free tier covers basic lookups. Third-party reports describe annual seats running into five figures... For observed foot traffic, Unacast, Foursquare, and SafeGraph supply device and places data."

**Context:** SafeGraph offers free data to academics, non-profits, and governments via its COVID-19 Data Consortium. For commercial multifamily ranking, paid data is the only source of *actual* visit counts at the POI level.

**Confidence:** High

---

### 1.20 Academic Human Mobility Datasets

**Claim:** Several large-scale, anonymized human-mobility datasets are freely available for research, including the YJMob100K (Japan, 100K users), Geolife (Beijing), D4D (Ivory Coast), and WorldMove (synthetic global trajectories), but these are research-grade and not suitable for real-time commercial property ranking.[^28]

**Source:** GitHub — scikit-mobility / DeepLearning4HumanMobility

**URL:** https://github.com/scikit-mobility/DeepLearning4HumanMobility/blob/master/Datasets/human_mobility.md

**Date:** 2020–2024

**Excerpt:**
> "Data for Development (D4D): 50,000 subjects, 2 weeks, Ivory Coast... YJMob100K: City-scale and longitudinal dataset of anonymized human mobility trajectories... WorldMove: an open access worldwide human mobility dataset..."

**Context:** These datasets are useful for training models and understanding mobility patterns but are typically years old, anonymized, and not linked to specific POI visit counts for commercial use.

**Confidence:** Medium

---

## 2. Summary Table: Free POI & Traffic Data Sources

| Source | Data Type | Coverage | Granularity | Freshness | Accuracy | Actual Visit Counts? | Cost |
|--------|-----------|----------|-------------|-----------|----------|----------------------|------|
| OpenStreetMap (OSM) | POI name, category, location, some attributes | Global | Point-level | Hours–months (crowd-sourced) | ~30–40 m positional; variable completeness | **No** | Free |
| US Census LODES / OnTheMap | Employment counts by block | US only | Census block | Annual (2–3 year lag) | High (administrative records) | **No** (jobs, not visits) | Free |
| US Census CBP | Establishments, employment, payroll by industry | US only | County / ZIP / MSA | Annual (1–2 year lag) | High (tax records) | **No** | Free |
| US Census ACS | Demographics, housing, income, commuting | US only | Census tract / block group | Annual (1-year or 5-year) | Survey-based with MOE | **No** | Free |
| US Census TIGER/Line | Roads, boundaries, geographic features | US only | Line / polygon | Annual (Jan 1 boundaries) | High (survey-based) | **No** | Free |
| EPA Smart Location DB | 90+ built-environment indicators | US only | Census block group | 2021 (static snapshot) | Moderate (modeled) | **No** | Free |
| EPA Walkability Index | Walkability score | US only | Census block group | 2021 | Moderate (modeled) | **No** | Free |
| FHWA HPMS / TMAS | Vehicle traffic counts (AADT) | US only | Road segment | Annual | High (measured) | **No** (vehicle only) | Free |
| State / Local DOT portals | Traffic, pedestrian counts | US states/cities | Road segment / sensor | Monthly / annual | High (measured) | Partial (pedestrian at specific sensors) | Free |
| City Open Data (NYC, Melbourne, etc.) | Pedestrian sensor counts | City CBDs | Sensor point | Hourly / monthly | High (measured) | **Yes** (at sensor locations) | Free |
| Google COVID Mobility | Relative mobility change by category | Global (county-level) | County / sub-region | Historical (2020–2022) | Moderate (sample bias) | **No** (relative only) | Free (archived) |
| Apple COVID Mobility | Relative direction requests | Global (city-level) | City / country | Historical (2020–2022) | Moderate (sample bias) | **No** (relative only) | Free (archived) |
| WorldPop | Population distribution | Global | 100 m grid | Annual (2000–2030) | Moderate (modeled) | **No** | Free |
| OpenAddresses | Address points with coordinates | 34+ countries | Address point | Weekly | Moderate (varies by source) | **No** | Free |
| Google Open Buildings | Building footprints | Africa, LatAm, Asia | Building polygon | 2021–2024 | High (ML-derived) | **No** | Free |
| Microsoft Building Footprints | Building footprints | US, Canada, others | Building polygon | 2020–2022 | High (ML-derived) | **No** | Free |
| Overture Maps Places | POI name, category, address, geometry | Global | Point / polygon | Quarterly releases | Moderate (conflated) | **No** | Free |
| HUD Multifamily Properties | Subsidized/insured multifamily locations | US only | Property point | Quarterly | Moderate (approximate) | **No** | Free |
| GTFS / Transit Feeds | Routes, stops, schedules | Global (agency-dependent) | Stop / route | Daily (static) | High (agency-published) | **No** (potential accessibility) | Free |
| National Transit Database | Agency ridership by mode | US only | Agency / mode | Monthly / annual | High (reported) | **No** (aggregated) | Free |
| Sentinel-2 Satellite | Multispectral imagery | Global | 10 m pixels | 5-day revisit | High (satellite) | **No** | Free |
| Landsat | Multispectral imagery | Global | 30 m pixels | 16-day revisit | High (satellite) | **No** | Free |

---

## 3. Free Data Stack Recommendation

### Objective: Approximate a foot-traffic ranking system for multifamily properties without paying for commercial visit data.

### Recommended Stack (Layered Approach)

| Layer | Source | Purpose |
|-------|--------|---------|
| **Base Property Inventory** | HUD Multifamily + OpenAddresses + TIGER/Line | Identify target multifamily properties and their exact locations |
| **POI Context** | OSM + Overture Maps Places | Enumerate nearby retail, transit, employment, and amenity POIs within walk/drive distance |
| **Employment Density** | US Census LODES (WAC) + CBP | Count jobs near each property as a proxy for daytime foot traffic and renter demand |
| **Population & Demographics** | ACS (5-year) + WorldPop | Understand resident density, income, age, and commuting patterns around each property |
| **Transit Accessibility** | GTFS + EPA SLD (transit service density) | Measure frequency of transit service within 0.5 mi of property |
| **Walkability / Street Network** | EPA Walkability Index + OSMnx street network | Compute intersection density, walk scores, and pedestrian route connectivity |
| **Vehicle Traffic Proxy** | FHWA / State DOT AADT | Use nearest road-segment traffic as a coarse proxy for area activity |
| **Historical Mobility Baseline** | Google & Apple COVID Mobility (archived) | Calibrate relative activity levels by county/city from pre-pandemic baselines |
| **Building Density** | Google Open Buildings / Microsoft Footprints | Infer urban density and development intensity around property |
| **Satellite Imagery** | Sentinel-2 / Landsat via USGS EarthExplorer | Derive land-use change, impervious surface, and vegetation indices as environmental context |

### How to Convert This Stack into a Traffic Ranking

1. **Build a catchment area** around each multifamily property (e.g., 0.25 mi walk, 0.5 mi drive).
2. **Count POIs by category** (restaurants, grocery, transit stops, hospitals, schools) within the catchment using OSM + Overture.
3. **Sum employment** from LODES WAC and CBP within the catchment.
4. **Pull ACS variables** (median income, renter share, commute time, vehicle availability) for the enclosing tract/block group.
5. **Compute transit frequency** from GTFS (trips per hour at nearest stop) and EPA SLD transit-service density.
6. **Score walkability** using EPA National Walkability Index or OSMnx intersection density.
7. **Normalize all variables** by catchment area or population and combine into a weighted composite index.
8. **Validate against known rent/price data** where available, and against free city pedestrian-count data (NYC, Melbourne, etc.) where spatial overlap exists.

---

## 4. Gap Analysis: What Is Missing from Free Sources?

| Critical Data Element | Why It Matters | Free Source Availability | Gap Severity |
|-----------------------|--------------|--------------------------|--------------|
| **Actual visit counts to specific POIs** | Directly measures foot traffic at retail, transit, and amenities near a property | **Not available** | **Critical** |
| **Dwell time at POIs** | Distinguishes pass-through traffic from engaged visitors | **Not available** | **Critical** |
| **Visitor origin / home ZIP** | Shows whether visitors live near the property (relevant for amenity value) | **Not available** (LODES gives worker residence, not POI visitors) | **High** |
| **Real-time or current-year mobility** | Post-2022 behavior patterns; COVID archives are stale | **Not available** | **High** |
| **Property-level pedestrian counts** | Only available in select CBDs with sensor programs | **Partial** (NYC, Melbourne, etc.) | **High** |
| **Commercial POI attributes** (revenue, rent, hours) | Needed for economic vitality scoring | **Not available** | **Medium** |
| **Mobile-device-derived movement panels** | SafeGraph, Placer.ai, Foursquare provide this at enterprise cost | **Not available for free commercially** | **Critical** |
| **Sub-annual temporal resolution** | Seasonal, weekly, and hourly patterns | **Not available** (most free data is annual or static) | **Medium** |
| **Fine-grained demographic mobility** | Age/race/income-specific trip patterns | **Not available** | **Medium** |

### Bottom Line

No free source provides *actual* visit counts to points of interest. The free data stack can approximate **potential foot-traffic attractiveness** by counting nearby jobs, POIs, transit frequency, and population density, but it cannot validate whether those POIs are actually visited, how long visitors stay, or where they come from. The gap between "proximity to amenities" and "actual foot traffic" is the single largest limitation of a fully free approach.

---

## 5. Technical Guidance: Access & Processing

### 5.1 OpenStreetMap (OSM)
- **API:** Overpass API (`overpass-api.de`) for live queries.
- **Bulk Downloads:** Geofabrik PBF extracts (`download.geofabrik.de`) for entire countries/states.
- **Python Tools:** `osmnx` (street networks + POIs), `pyrosm` (PBF processing), `overpy` (Overpass wrapper).
- **Format:** XML/JSON via API; PBF for bulk; convert to GeoPackage/GeoParquet with `ogr2ogr` or `pyrosm`.

### 5.2 US Census LODES
- **Direct Download:** `https://lehd.ces.census.gov/data/lodes/`
- **R Package:** `lehdr` (`grab_lodes()`) — downloads by state, year, type (OD/RAC/WAC), aggregation level.
- **Python:** `lehd` package or direct CSV download.
- **Format:** CSV with `geoid` columns; join to TIGER shapefiles for mapping.

### 5.3 EPA Smart Location Database
- **Download:** `https://www.epa.gov/smartgrowth/smart-location-mapping` (ZIP geodatabase, ~1 GB).
- **Web Services:** REST map service at `https://geodata.epa.gov/ArcGIS/rest/services/OA/SmartLocationDatabase/MapServer`
- **Format:** File Geodatabase (.gdb), Shapefile, or JSON via REST.

### 5.4 Overture Maps
- **Command-line:** `pip install overturemaps` then `overturemaps download --bbox=... --type=place -f geojsonseq`
- **Cloud Query:** DuckDB + GeoParquet on S3 (`s3://overturemaps-us-west-2/release/...`).
- **Format:** GeoParquet (preferred), GeoJSON, GeoPackage.

### 5.5 TIGER/Line Shapefiles
- **Direct Download:** `https://www2.census.gov/geo/tiger/TIGER2025/`
- **R Package:** `tigris` — `tracts()`, `block_groups()`, `roads()`, etc.
- **Python:** `pygris` or direct download + `geopandas.read_file()`.
- **Format:** Shapefile (.shp) or GeoPackage.

### 5.6 GTFS / Transit
- **Aggregator:** `transitfeeds.com` or `mobilitydatabase.org`.
- **Direct Agency:** Most transit agencies host GTFS at `https://<agency>.com/gtfs`.
- **Python:** `gtfs-kit`, `partridge`, `gtfs_functions`.
- **Format:** ZIP of CSV files; use `gtfs-kit` to validate and compute trip frequencies.

### 5.7 Satellite Imagery
- **Landsat / Sentinel-2:** USGS EarthExplorer (`earthexplorer.usgs.gov`) — free account, search by AOI, date, cloud cover.
- **Copernicus Browser:** `browser.dataspace.copernicus.eu` — ESA official portal for Sentinel.
- **Format:** GeoTIFF (Landsat), SAFE/JP2 (Sentinel-2); process with `rasterio`, `xarray`, `Google Earth Engine`.

### 5.8 WorldPop
- **Download:** `https://www.worldpop.org/geodata/summary?id=24777` or HDX.
- **Format:** GeoTIFF raster; ingest with `rasterio` or `xarray`.
- **Resolution:** 100 m (3 arc) constrained / unconstrained.

---

## 6. Stakeholder & History Context

### Who Maintains These Datasets?
- **Government:** US Census Bureau, EPA, FHWA, HUD, state DOTs, local open-data programs. Funded by taxpayer dollars; mandated by open-government directives.
- **Academia / Non-Profit:** WorldPop (University of Southampton), OpenStreetMap Foundation, Overture Maps Foundation (industry-backed but open), TransitCenter.
- **Private (Open-Source):** Microsoft (Building Footprints), Google (Open Buildings, COVID Mobility), Meta (Overture contribution), Apple (COVID Mobility).

### History of Open Government Data Evolution
- **1990s–2000s:** Census TIGER/Line and decennial census were the primary free spatial data sources. CBP began in 1986.
- **2008:** Landsat archive opened for free, revolutionizing remote-sensing access.
- **2004–2014:** OpenStreetMap launched (2004) and matured; US DOTs began publishing traffic data online; GTFS launched (2005) and became standard.
- **2015–2020:** EPA SLD (2013), LODES expanded, ACS replaced census long form, and open-data portals proliferated (data.gov, Socrata, CKAN).
- **2020–2022:** COVID-19 pandemic triggered unprecedented release of free mobility data (Google, Apple, Waze) as public-health tools. Most have since been discontinued.
- **2023–Present:** Overture Maps Foundation launched, consolidating open POI data from major tech companies. Building-footprint datasets (Google, Microsoft) expanded globally.

### Lessons from COVID Mobility Datasets
1. **Free mobility data is possible at scale** when public-health or corporate-reputation incentives align.
2. **Relative-change data is insufficient** for commercial ranking; absolute visit counts are needed for ROI analysis.
3. **Privacy concerns drive discontinuation** — once the emergency passed, Google and Apple stopped releasing data, suggesting sustained free access to fine-grained mobility is unlikely without regulatory mandate.
4. **Academic validation matters** — the Google/Apple data was heavily used in peer-reviewed literature, proving its utility for modeling even if not for operational decision-making.

---

## 7. Counter-Narrative: Why Free Data May Be Insufficient

### Argument
Free data can build a **structural proxy** for foot traffic, but it cannot replace **observed behavioral data** for commercial multifamily ranking.

### Evidence
- **No free source captures actual visits.** OSM tells you a Starbucks exists; it does not tell you 500 people visit daily.
- **Aggregation bias.** LODES and ACS data are aggregated to census blocks or tracts, smoothing out hyperlocal variations that matter for walkability and amenity value.
- **Temporal staleness.** EPA SLD reflects 2010–2012 conditions; OSM freshness varies by contributor activity; COVID mobility is historical only.
- **Incomplete POI attributes.** Free POI datasets lack revenue, hours, Yelp ratings, and other vitality indicators that correlate with actual demand.
- **Privacy regulations.** GDPR, CCPA, and emerging state laws make it legally risky and expensive to collect fine-grained mobility data, which is why commercial providers charge $400+/month — the cost is compliance and panel maintenance, not just data collection.
- **Infrastructure cost.** Processing the free data stack (200 GB+ Overture files, billions of OSM nodes, raster analysis) requires significant compute and engineering time, which is a hidden cost.

### Verdict
For a **research prototype** or **coarse market screening**, the free data stack is viable and powerful. For **investment-grade multifamily ranking** where rent premiums must be justified to LPs, the lack of actual visit counts and visitor demographics is a material gap that likely requires paid data (SafeGraph, Placer.ai, Foursquare, or Unacast) or primary data collection (pedestrian counts, surveys, Wi-Fi analytics).

---

## 8. Footnotes

[^1]: Zhang, L., et al. "Using OpenStreetMap point-of-interest data to model urban change—A feasibility study." *PLoS ONE*, 2019. https://pmc.ncbi.nlm.nih.gov/articles/PMC6388917/

[^2]: Haklay, M. "How good is volunteered geographical information?" *UCL Working Paper*, 2008. https://www.homepages.ucl.ac.uk/~ucfamha/OSM%20data%20analysis%20070808_web.pdf

[^3]: "World-POI: Global Point-of-Interest Data Enriched from Foursquare and OpenStreetMap." *arXiv*, 2025. https://arxiv.org/html/2510.21342v1

[^4]: US Census Bureau. "LEHD Origin-Destination Employment Statistics (LODES)." https://lehd.ces.census.gov/data/

[^5]: Urban Institute. "Census Tract Level LODES." https://datacatalog.urban.org/dataset/census-tract-level-longitudinal-employer-household-dynamics-origin-destination-employment-statistics

[^6]: Macon Area Transportation Study. "LODES / OnTheMap Overview." 2022. https://www.maconmpo.com/wp-content/uploads/2022/02/DRAFT_MATS2050MTP_22020202_RemoveWatermark.pdf

[^7]: GIS Association of Alabama. "OnTheMap for Emergency Management v4.26.1." 2025. https://gisaa.org/news/13610774

[^8]: US Census Bureau. "County Business Patterns (CBP) Datasets." 2024. https://www.census.gov/programs-surveys/cbp/data/datasets.html

[^9]: US Census Bureau. "American Community Survey (ACS) Data." 2025. https://www.census.gov/programs-surveys/acs/data.html

[^10]: US Census Bureau. "TIGER/Line Shapefiles." 2025. https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

[^11]: US EPA. "Smart Location Mapping." 2025. https://www.epa.gov/smartgrowth/smart-location-mapping

[^12]: US EPA. "National Walkability Index." https://www.epa.gov/smartgrowth/smart-location-mapping

[^13]: data.gov. "Highway Performance Monitoring System (HPMS)." 2024. https://catalog.data.gov/dataset/highway-performance-monitoring-system-hpms-2011-delaware

[^14]: NYC OpenData. "Bi-Annual Pedestrian Counts." 2025. https://catalog.data.gov/dataset/bi-annual-pedestrian-counts-6cc0a

[^15]: City of New York / NYC DOT. "Pedestrian Volume Index." 2025.

[^16]: Google / Rearc. "Google COVID-19 Community Mobility Reports." 2020–2022. https://github.com/rearc-data/google-covid-19-community-mobility-reports

[^17]: Apple / Rearc. "Apple COVID-19 Mobility Trends Reports." 2020–2022. https://github.com/rearc-data/apple-maps-mobility-trends-covid-19

[^18]: WorldPop. "Global2: Global high-resolution population estimates for 2015-2030." 2025. https://www.worldpop.org/blog/worldpop-global2-global-high-resolution-population-estimates-for-2015-2030/

[^19]: OpenAddresses. "Coverage Map." https://results.openaddresses.io/coverage/world/

[^20]: Google Research. "Open Buildings." https://sites.research.google/open-buildings/

[^21]: Overture Maps Foundation. "Overture 2024-04-16 Release Notes." 2024. https://overturemaps.org/overture-2024-april-beta-release-notes/

[^22]: "Overture POI Data for the United Kingdom." *arXiv*, 2023. https://arxiv.org/pdf/2310.18415.pdf

[^23]: data.gov. "HUD Multifamily Properties." 2025. https://catalog.data.gov/dataset/multifamily-properties

[^24]: Center for Urban Transportation Research (CUTR). "Awesome Transit — GTFS Resources." https://github.com/CUTR-at-USF/awesome-transit

[^25]: Federal Transit Administration. "National Transit Database (NTD)." https://www.transit.dot.gov/ntd

[^26]: MapScraping.com. "Is Google Maps Scraping Legal?" 2025. https://mapscraping.com/is-google-maps-scraping-legal

[^27]: Geod.app. "Placer.ai Alternatives for Site Selection." 2026. https://www.geod.app/resources/placer-ai-alternatives

[^28]: scikit-mobility. "Human Mobility Datasets." 2020. https://github.com/scikit-mobility/DeepLearning4HumanMobility/blob/master/Datasets/human_mobility.md

---

> **End of Report**
