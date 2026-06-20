# Phase 2: Dimension Decomposition — Cheap POI Foot Traffic Data for Multifamily Property Ranking

**Date:** 2026-06-20
**Route:** B (Focused Search)
**Researcher:** Orchestrator

---

## Consolidated Theme List (from Phase 1 Landscape)

1. **Market Structure**: The POI/foot traffic data market is bifurcated between raw data providers (SafeGraph, Unacast) and integrated analytics platforms (Placer.ai, GrowthFactor). Pricing spans from pennies per API call to $50K+/year enterprise subscriptions.
2. **Multifamily Gap**: Most foot traffic data is built for retail/restaurant site selection. Explicit multifamily proptech providers (PropTech Metrics) are rare but emerging.
3. **Privacy Risk**: 2025 regulatory environment (CCPA, 20+ state laws) is tightening on geolocation data. California AG actively enforces. Panel sizes may shrink, costs may rise.
4. **Data Quality Concerns**: Panel bias (age, race, income), urban/rural density variation, and temporal inconsistency are well-documented but often under-disclosed by providers.
5. **Integration Complexity**: Marrying foot traffic to multifamily properties requires address geocoding, POI proximity matching, visit aggregation, and scoring — a non-trivial technical pipeline.
6. **Alternative Paradigms**: First-party data (IoT access control, property management systems), satellite imagery, and open government data represent potential cheap or free substitutes.

---

## Dimension Decomposition (12 Dimensions)

Each dimension approaches the problem from a distinct angle, with ≥30% conceptual overlap with related dimensions for cross-verification.

### Dimension 01 — Low-Cost Foot Traffic Data Provider Catalog
**Angle:** Commercial/economic — What providers exist at the budget end of the spectrum and what do you actually get for the money?
**Scope:** Exhaustive catalog of providers with explicit pricing tiers under $5,000/year or pay-as-you-go models. Include data marketplaces (AWS Data Exchange, Snowflake, Databricks) where data can be purchased on-demand. Cover sample pricing, minimum commitments, free tiers, and trial options.
**Expected Sources:** Provider websites, DataRade, AWS Data Exchange, G2/SourceForge reviews, pricing pages.
**Overlap with:** Dim 02 (free alternatives as the zero-cost baseline), Dim 10 (API economics).

### Dimension 02 — Free & Open-Source POI / Traffic Data Sources
**Angle:** Resource-constrained / bootstrap — What can you get for zero or near-zero cost?
**Scope:** OpenStreetMap (OSM) POI data, US Census Bureau data (LEHD, OnTheMap, TIGER), local government traffic counts, state DOT data, FHWA data, Google Open Buildings, OpenAddresses, and scraping alternatives. Assess coverage, freshness, accuracy, and whether any of these actually contain visit/foot traffic data or only static POI data.
**Expected Sources:** OSM Wiki, Census Bureau, state DOT websites, academic papers on OSM quality, FHWA.
**Overlap with:** Dim 01 (free tier as baseline for paid comparisons), Dim 07 (alternative data as another low-cost path).

### Dimension 03 — Multifamily Property Address & Geocoding Databases
**Angle:** Data foundation — Where do you get the property side of the join?
**Scope:** Sources for comprehensive multifamily property address databases: HUD, Census (ACS), Reonomy, CoStar, Yardi, Apartments.com, Rent.com, HelloData.ai, local assessor/tax records. Geocoding services (Google, OpenCage, Mapbox, HERE, Pelias). Address normalization and matching challenges. Property attribute data needed for contextual ranking.
**Expected Sources:** Provider websites, HUD datasets, Census ACS, assessor records, geocoding API documentation.
**Overlap with:** Dim 04 (the property data is the left side of the join), Dim 09 (property attributes feed into scoring).

### Dimension 04 — Technical Integration Pipeline: Address → POI → Traffic Score
**Angle:** Engineering / systems architecture — How do you actually build the data pipeline?
**Scope:** Step-by-step technical architecture: (1) Address normalization and geocoding, (2) Property buffer/polygon generation (e.g., 500m radius), (3) POI discovery within buffer, (4) Visit count aggregation from matched POIs, (5) Normalization by property type/market, (6) Composite traffic score construction. Tools: PostGIS, Python (geopandas, shapely), SQL, BigQuery. Data formats: GeoJSON, Shapefile, Parquet.
**Expected Sources:** GeoPandas docs, PostGIS tutorials, SafeGraph technical docs, academic GIS papers, BigQuery public datasets.
**Overlap with:** Dim 03 (property data is input), Dim 09 (scoring methodology), Dim 10 (API delivery models).

### Dimension 05 — Data Quality, Accuracy & Bias Assessment
**Angle:** Epistemic rigor — How much can you trust the data, especially for multifamily?
**Scope:** Panel size, demographic bias, urban vs suburban vs rural density, temporal consistency (hourly, daily, weekly), ground-truth validation studies, correlation with first-party data. Specific concerns for multifamily: panel coverage of renters vs homeowners, age bias, and whether POI visit data correlates with actual property leasing traffic. Peer-reviewed studies on SafeGraph, Placer.ai accuracy.
**Expected Sources:** PLOS One (SafeGraph bias study), provider white papers, academic papers, data science blogs.
**Overlap with:** Dim 01 (provider quality assessment), Dim 11 (head-to-head comparison), Dim 12 (geographic bias).

### Dimension 06 — Privacy Regulations & Licensing for Commercial Use
**Angle:** Legal / compliance — Can you legally use this data in your product?
**Scope:** CCPA/CPRA geolocation rules (sensitive personal information), GDPR location data requirements, state privacy laws (20+ states), provider licensing terms (resale restrictions, derivative works, attribution), data broker registration requirements, and emerging legislation. Impact on data availability and cost.
**Expected Sources:** CCPA/CPRA text, California AG enforcement actions, GDPR Art. 6/9, provider terms of service, legal analysis blogs.
**Overlap with:** Dim 01 (licensing affects total cost), Dim 07 (alternatives may have lower compliance burden).

### Dimension 07 — Alternative & Proxy Data Sources
**Angle:** Disruption / unconventional — What non-traditional data can substitute for mobile location data?
**Scope:** Satellite imagery (parking lot occupancy, building activity), connected vehicle data (INRIX, Wejo), credit card transaction data (Second Measure, Facteus), WiFi/Bluetooth beacon analytics (Euclid Analytics, Cisco Meraki), IoT building access data (Allegion, Latch), social media check-ins (Foursquare, Instagram), parking data (ParkWhiz, SpotHero), and delivery/app data (UberEats, DoorDash density). Cost and quality trade-offs.
**Expected Sources:** INRIX, Wejo, Facteus, academic papers on satellite-derived activity, proptech blogs.
**Overlap with:** Dim 02 (free/open-source as low-cost alternative), Dim 05 (quality assessment), Dim 11 (comparison with traditional providers).

### Dimension 08 — Proptech Case Studies & ROI Evidence
**Angle:** Business value / evidence — Does foot traffic data actually help in multifamily?
**Scope:** Real-world case studies of foot traffic data driving multifamily investment, site selection, or NOI improvement. Specific examples from PropTech Metrics, Placer.ai retail-to-multifamily adaptations, Orbital Insight, and academic studies on walkability/amenity proximity and rent premiums. Correlation between foot traffic and rent/occupancy.
**Expected Sources:** PropTech Metrics website, JLL research, academic real estate journals, proptech blogs, MMC Ventures portfolio.
**Overlap with:** Dim 09 (ROI evidence validates scoring methodology), Dim 04 (technical integration in production).

### Dimension 09 — Scoring Models: Property Traffic Ranking Methodology
**Angle:** Analytical / quantitative — How do you turn raw data into a usable rank?
**Scope:** Composite score construction: weighted visit counts, proximity decay functions, POI category weights (retail vs dining vs transit), temporal normalization (weekday vs weekend), market-relative scoring (percentile within metro), and tiered ranking (A/B/C/D traffic). Uncertainty quantification and confidence intervals. Machine learning approaches for predicting rent/occupancy from traffic features.
**Expected Sources:** Academic papers on walkability scores, urban economics, GIS scoring methodologies, data science blogs.
**Overlap with:** Dim 04 (pipeline feeds into scoring), Dim 08 (case studies validate models), Dim 11 (provider data quality affects scoring).

### Dimension 10 — API & Data Marketplace Economics
**Angle:** Commercial / procurement — What is the total cost of ownership?
**Scope:** Pricing models: REST API per-call, flat file subscription, data marketplace (AWS, Snowflake, Databricks), SaaS platform, and enterprise custom. Cost estimation for a multifamily platform covering 10K, 100K, 1M properties. Hidden costs: data storage, ETL, geocoding API calls, compliance overhead. ROI calculation framework.
**Expected Sources:** AWS Data Exchange, Snowflake Marketplace, provider pricing pages, cloud cost calculators.
**Overlap with:** Dim 01 (provider pricing), Dim 04 (technical delivery affects cost), Dim 11 (head-to-head TCO comparison).

### Dimension 11 — Provider Deep-Dive: Head-to-Head Comparison (Top 5 Budget Options)
**Angle:** Comparative evaluation — Which cheap provider is actually best for multifamily?
**Scope:** Deep comparison of 5 top budget-friendly options: SafeGraph (Dewey), DataForSEO, Unacast/Gravy Analytics, GrowthFactor, and PropTech Metrics. Compare on: data accuracy, POI coverage, visit granularity, API quality, documentation, support, licensing flexibility, and multifamily-specific features. Include user reviews and independent validation.
**Expected Sources:** G2, SourceForge, DataRade, provider docs, independent reviews, Reddit/r/datascience, Hacker News.
**Overlap with:** Dim 01 (catalog subset), Dim 05 (quality assessment), Dim 10 (economics).

### Dimension 12 — Geographic Coverage, Bias & Market Segmentation
**Angle:** Geographic / demographic — Where does the data work and where does it fail?
**Scope:** Urban vs suburban vs rural panel density. Coastal vs inland markets. Sun Belt vs Rust Belt. International coverage. Demographic bias (age, race, income, device ownership). How these biases affect multifamily property ranking in different market types. Provider-specific geographic strengths and weaknesses.
**Expected Sources:** Provider documentation, PLOS One bias study, Census demographics, FCC broadband reports (device ownership proxy).
**Overlap with:** Dim 05 (quality assessment), Dim 11 (provider comparison), Dim 08 (case studies in different markets).

---

## Dimension Assignment Summary

| Dim | Title | Angle | Overlap With |
|-----|-------|-------|-------------|
| 01 | Low-Cost Provider Catalog | Economic | 02, 10 |
| 02 | Free & Open-Source Sources | Bootstrap | 01, 07 |
| 03 | Multifamily Address Databases | Data Foundation | 04, 09 |
| 04 | Technical Integration Pipeline | Engineering | 03, 09, 10 |
| 05 | Data Quality & Bias Assessment | Epistemic | 01, 11, 12 |
| 06 | Privacy & Licensing | Legal | 01, 07 |
| 07 | Alternative & Proxy Data Sources | Disruption | 02, 05, 11 |
| 08 | Proptech Case Studies & ROI | Business Value | 09, 04 |
| 09 | Property Traffic Ranking Methodology | Analytical | 04, 08, 11 |
| 10 | API & Marketplace Economics | Procurement | 01, 04, 11 |
| 11 | Provider Deep-Dive (Top 5 Budget) | Comparative | 01, 05, 10, 12 |
| 12 | Geographic Coverage & Bias | Geographic | 05, 11, 08 |

---

## Context from Phase 1 for Phase 3 Sub-Agents

Key Phase 1 findings to reference:
- **SafeGraph**: $0.05–$30K/year, raw hourly visit data, ~40M device panel, building footprint polygons, PLOS One bias study found underrepresentation of older/non-white populations.
- **Placer.ai**: $12K–$50K/year, dashboard-first, US only, tens of millions of devices, 90%+ correlation with first-party data claims.
- **Unacast/Gravy Analytics**: $1/API call to $50K/year, GDPR-compliant, 1B+ monthly devices across 180+ countries, strongest trade area analytics.
- **GrowthFactor**: $400/month, integrated scoring platform, self-service AI.
- **PropTech Metrics**: $0.02/property lookup, multifamily-specific, IoT + satellite signals.
- **DataForSEO**: $6.20–$60 for 20K businesses, 88% cheaper than Google Places API, in-house database updated every 90 days.
- **Privacy**: CCPA treats precise geolocation as sensitive personal information; 20+ US state privacy laws active; California AG 2025 sweep targeting geolocation data.
- **Market**: POI data $3.03B (2024), foot traffic $5.23B (2024); CAGR ~10%.

---

## Sources

[^marketus-poi]: Points-Of-Interest (POI) Data Solutions Market Size. Market.us. 2025-07-08. https://market.us/report/points-of-interest-poi-data-solutions-market/

[^mrfr-foottraffic]: Foot Traffic Customer Location Intelligence Solution Market. Market Research Future. 2025-09-01. https://www.marketresearchfuture.com/reports/foot-traffic-customer-location-intelligence-solution-market-35880

[^growthfactor-compare]: Foot Traffic Data Provider Comparison (2026). GrowthFactor. 2026-04-22. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^datarade-poi]: Best Point of Interest (POI) Data Providers & Companies 2026. DataRade. https://datarade.ai/data-categories/point-of-interest-poi-data/providers

[^datarade-unacast]: Unacast Foot Traffic Data — Trade Areas Data. DataRade. https://datarade.ai/data-categories/footfall-traffic-data/apis

[^datarade-safegraph]: SafeGraph — Pricing, Reviews, Data & APIs. DataRade. https://datarade.ai/data-providers/safegraph/profile

[^passby-compare]: Placer.ai vs PassBy vs Unacast: Which Foot Traffic Tool is Right for You? PassBy. 2026-04-13. https://passby.com/blog/best-placer-ai-alternatives-and-competitors/

[^dataforseo]: Getting Points of Interest with a Low-Cost Google Places API Alternative. DataForSEO. 2024-05-29. https://dataforseo.com/blog/poi-data-with-dataforseo-api

[^proptechmetrics]: PropTech Metrics — Real-Time Multifamily Data & Insights. https://www.proptechmetrics.com/

[^feroot-ccpa]: CCPA for Mobile Apps: SDK Tracking Risks and Compliance Gaps. Feroot Security. 2026-04-01. https://www.feroot.com/blog/ccpa-mobile-apps-sdk-compliance/

[^dataslayer-compliance]: Marketing Data Privacy Compliance 2025: GDPR, CCPA Guide. DataSlayer. https://www.dataslayer.ai/blog/marketing-data-privacy-compliance-guide-gdpr-ccpa-us-state-laws
