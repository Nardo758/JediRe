# Phase 1: Landscape Scan — Cheap POI Foot Traffic Data for Multifamily Property Ranking

**Date:** 2026-06-20
**Route:** B (Focused Search)
**Researcher:** Orchestrator

---

## Search 1 – Macro Overview: POI Data Solutions Market

- **Global POI data market valued at ~$3.03B in 2024**, projected to reach ~$8.00B by 2034 (CAGR 10.2%). [^marketus-poi]
- North America dominates with >35% share (~$1.06B revenue in 2024). [^marketus-poi]
- Key players: Foursquare, Google, HERE Technologies, TomTom, SafeGraph, Mapbox, Precisely, OpenStreetMap, PlaceIQ, CARTO. [^marketus-poi]
- Software dominates at 68% share; location-based services lead application segment at 27%. [^marketus-poi]

## Search 2 – Macro Overview: Foot Traffic Intelligence Market

- **Foot traffic and customer location intelligence market: $5.23B (2024) → $14.51B (2035)**, CAGR 9.72%. [^mrfr-foottraffic]
- Major players: Placer.ai, Foursquare, GroundTruth, Cuebiq, Zenreach, Near, Blis, Advan, InMarket. [^mrfr-foottraffic]
- Technologies: Wi-Fi analytics, Bluetooth beacon, GPS tracking, mobile app SDK solutions. [^mrfr-foottraffic]
- North America largest market; Asia-Pacific fastest-growing. [^mrfr-foottraffic]

## Search 3 – Structural Mapping: Provider Pricing & Comparison

| Provider | Data Types | Coverage | Pricing | Notes |
|----------|-----------|----------|---------|-------|
| **Placer.ai** | Visit trends, demographics, trade areas, cross-shopping | US only | ~$12K–$50K/year | Dashboard-first; retail-focused; paralysis-by-analysis risk [^growthfactor-compare] [^passby-compare] |
| **SafeGraph** | Raw visit counts (hourly), POI db, building footprints | 195+ countries | $0.05–$30,000/year | Cleanest POI data; API + flat files; no built-in dashboard [^growthfactor-compare] [^datarade-safegraph] |
| **Unacast / Gravy Analytics** | Mobility, foot traffic, trade areas, visitor origin | 180+ countries | $1/API call to $50K/year | GDPR-compliant; strongest migration/trade area analytics [^growthfactor-compare] [^datarade-unacast] |
| **Foursquare** | Global POI, social sentiment, check-in data | 200+ countries | Very expensive | 100M+ POIs; social sentiment included; premium tier [^safegraph-chainxy] |
| **GrowthFactor** | Integrated foot traffic + demographics + scoring | US | $400/month | Self-service AI scoring; site reports in seconds [^growthfactor-compare] |
| **PropTech Metrics** | Multifamily unit data, IoT & satellite foot traffic | US metros | $0.02/property lookup | API-first; investor-grade; built for proptech [^proptechmetrics] |
| **DataForSEO** | Google Maps POI data | 250+ countries | $6.20–$60 for 20K businesses | 88% cheaper than Google Places API [^dataforseo] |
| **PassBy** | Foot traffic + spend insights | 1.5M store locations | Essential/Premium/Ultimate tiers | 94% ground-truth correlation; 90-day predictive feeds [^passby-compare] |
| **Echo Analytics** | POI, building footprints, mobility | US & EU | Custom pricing | 80M+ locations; 95%+ polygon coverage [^datarade-poi] |
| **dataplor** | Global POI | 250 countries | $0.09/record to $29,999/year | Weekly/monthly updates; confidence scoring [^datarade-poi] |
| **Techsalerator** | POI, firmographic, demographic | 219 countries | $245/purchase | GDPR/CCPA compliant [^datarade-poi] |
| **GapMaps** | POI, demographics, retail locations | Global | $2,500–$40,000/year | Trusted by major retail brands [^datarade-poi] |

## Search 4 – Structural Mapping: Multifamily/Proptech Use Cases

- **Placer.ai and Orbital Insight** are already used in proptech for instant trade-area reports and foot traffic heatmaps. [^brevitas-ai]
- **PropTech Metrics** ($0.02/property lookup) offers IoT & satellite foot-traffic signals specifically for multifamily. [^proptechmetrics]
- **Allegion/Zentra** access systems generate foot traffic data (who's coming, going, when) for staffing optimization and leasing conversion. [^allegion-proptech]
- **MMC Technology Ventures** backs Placer.ai as a location intelligence portfolio company for commercial/multifamily real estate. [^mmc-ventures]
- **HelloData.ai** ($250/month) provides multifamily market surveys and competitor intelligence. [^sourceforge-proptech]
- AI in real estate now mines "property financials, rent rolls, satellite images, and social media signals" for deal sourcing. [^brevitas-ai]

## Search 5 – Emerging Issues & Tensions: Privacy, Regulation, Market Evolution

- **Privacy law expansion**: 20 US states now have comprehensive privacy laws covering ~43% of US population. [^dataslayer-compliance]
- **California AG 2025 sweep** specifically targeted geolocation data collection by ad networks and mobile publishers. [^feroot-ccpa] [^dataslayer-compliance]
- **CCPA classifies data placing an individual within 1,850-foot radius as sensitive personal information** — location data is now in the highest risk category. [^feroot-ccpa]
- **Global Privacy Control (GPC)** is legally binding in multiple US states; must block advertising pixels when enabled. [^dataslayer-compliance]
- **Panel bias**: SafeGraph panel underrepresents older adults and non-white populations (PLOS One study). [^growthfactor-compare]
- **Rural reliability**: Mobile panels have lower density in rural areas, wider confidence intervals. [^growthfactor-compare]
- **No provider is universally "most accurate"** — accuracy varies by geography, location type, time period. [^growthfactor-compare]

---

## Key Findings Summary

1. **There is a wide pricing spectrum**: from $0.02/property lookup (PropTech Metrics) to $50K+/year enterprise subscriptions (Placer.ai). "Cheap" depends on scale and integration approach.
2. **Two data paradigms exist**: (a) raw foot traffic data (SafeGraph, Unacast) for custom models, and (b) integrated platforms (GrowthFactor, Placer.ai) that bundle foot traffic with scoring.
3. **Multifamily is an underserved vertical** — most foot traffic data is built for retail/restaurant site selection. PropTech Metrics is one of the few explicitly targeting multifamily.
4. **Privacy is a structural risk** — the 2025 regulatory environment is tightening, with California actively enforcing geolocation data restrictions. Any provider's panel size may shrink.
5. **Free/cheap alternatives exist**: Google Places API (expensive), DataForSEO (88% cheaper), OpenStreetMap (free but limited visit data), local government traffic counts, and first-party IoT data from access control systems.

---

## Dominant Narratives Identified

- **Narrative A**: Enterprise foot traffic data (Placer.ai, SafeGraph) is expensive but necessary for accurate retail site selection.
- **Narrative B**: Integrated proptech platforms (GrowthFactor, PropTech Metrics) are emerging to bundle foot traffic with property-specific scoring at lower cost.
- **Narrative C**: Privacy regulations are reshaping the data supply chain — smaller panels, higher compliance costs, potential for synthetic data.
- **Narrative D**: First-party data (IoT, access control, property management systems) is becoming a viable alternative or supplement to third-party mobile location data.

## Controversies & Conflicting Claims

- **Accuracy vs. cost trade-off**: Some claim cheap APIs (DataForSEO) are sufficient for basic POI data; others argue only premium providers (SafeGraph, Placer.ai) can deliver visit-quality foot traffic.
- **Panel bias**: PLOS One study found SafeGraph underrepresents older/non-white populations. Provider self-reported accuracy (90%+) may not match ground truth for diverse or rural multifamily markets.
- **Privacy vs. utility**: The more granular and accurate the location data, the higher the regulatory risk. CCPA now treats precise geolocation as sensitive personal information.

## Gaps Requiring Deeper Investigation

1. How exactly do you geocode multifamily property addresses and match them to nearby POI foot traffic polygons?
2. What are the specific free/open-source alternatives (OpenStreetMap, census data, local government) and their limitations?
3. What does a full technical integration pipeline look like (address → geocode → buffer → POI match → traffic aggregation → property score)?
4. How do you validate foot traffic rankings against actual multifamily performance metrics (occupancy, rent, NOI)?
5. What are the emerging alternative data sources (satellite imagery, connected vehicle data, credit card transactions) and their cost/quality trade-offs?
6. What are the specific legal/licensing terms for using third-party foot traffic data in a commercial multifamily product?
7. How does the data quality vary between urban, suburban, and rural multifamily markets?

---

## Sources

[^marketus-poi]: Points-Of-Interest (POI) Data Solutions Market Size. Market.us. 2025-07-08. https://market.us/report/points-of-interest-poi-data-solutions-market/

[^mrfr-foottraffic]: Foot Traffic Customer Location Intelligence Solution Market. Market Research Future. 2025-09-01. https://www.marketresearchfuture.com/reports/foot-traffic-customer-location-intelligence-solution-market-35880

[^growthfactor-compare]: Foot Traffic Data Provider Comparison (2026). GrowthFactor. 2026-04-22. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^datarade-poi]: Best Point of Interest (POI) Data Providers & Companies 2026. DataRade. https://datarade.ai/data-categories/point-of-interest-poi-data/providers

[^datarade-unacast]: Unacast Foot Traffic Data — Trade Areas Data. DataRade. https://datarade.ai/data-categories/footfall-traffic-data/apis

[^datarade-safegraph]: SafeGraph — Pricing, Reviews, Data & APIs. DataRade. https://datarade.ai/data-providers/safegraph/profile

[^safegraph-chainxy]: ChainXY Alternatives: Best POI Data Providers Compared. SafeGraph. 2026-05-18. https://www.safegraph.com/guides/chainxy-alternatives/

[^passby-compare]: Placer.ai vs PassBy vs Unacast: Which Foot Traffic Tool is Right for You? PassBy. 2026-04-13. https://passby.com/blog/best-placer-ai-alternatives-and-competitors/

[^dataforseo]: Getting Points of Interest with a Low-Cost Google Places API Alternative. DataForSEO. 2024-05-29. https://dataforseo.com/blog/poi-data-with-dataforseo-api

[^brevitas-ai]: What AI Tools Can Help Real-Estate Professionals Today—and What's Coming by 2030. Brevitas. 2026-01-27. https://brevitas.com/blog/what-ai-ai-tools-can-help-real-estate-professionals-today-and-whats-coming-by-2030/

[^proptechmetrics]: PropTech Metrics — Real-Time Multifamily Data & Insights. https://www.proptechmetrics.com/

[^allegion-proptech]: Beyond the Buzzword: Real-World NOI Gains from Proptech Adoption. Allegion. 2025-09-01. https://us.allegion.com/en/resources/education/leading-the-industry/multifamily/beyond-the-buzzword--real-world-noi-gains-from-proptech-adoption.html

[^mmc-ventures]: MMC Technology Ventures — Investment Thesis & Preferences. F4. 2026-05-10. https://f4.fund/firms/mmc-technology-ventures

[^sourceforge-proptech]: Best PropTech Software of 2026. SourceForge. https://sourceforge.net/software/proptech/

[^feroot-ccpa]: CCPA for Mobile Apps: SDK Tracking Risks and Compliance Gaps. Feroot Security. 2026-04-01. https://www.feroot.com/blog/ccpa-mobile-apps-sdk-compliance/

[^dataslayer-compliance]: Marketing Data Privacy Compliance 2025: GDPR, CCPA Guide. DataSlayer. https://www.dataslayer.ai/blog/marketing-data-privacy-compliance-guide-gdpr-ccpa-us-state-laws
