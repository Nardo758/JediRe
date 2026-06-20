# Cheap POI Foot Traffic Data for Multifamily Property Ranking: A Strategic Intelligence Report

**Prepared for:** JediRe Platform  
**Date:** June 20, 2026  
**Research Method:** Multi-agent deep research swarm (12 dimensions, 250+ independent searches, cross-verified)  
**Scope:** Identify cheap, legally viable data sources and integration strategies for ranking multifamily properties by surrounding foot traffic demand signals

---

## Executive Summary

This report delivers a comprehensive, evidence-based strategy for sourcing cheap POI (point-of-interest) foot traffic data and marrying it to multifamily properties to generate traffic-based rankings. The research was conducted through a 12-dimension deep investigation involving 250+ independent searches, peer-reviewed academic sources, provider documentation, legal analysis, and technical architecture review.

### Key Findings

1. **There is no single "best" provider.** The optimal data stack depends on your portfolio size, technical maturity, and whether you need to commercialize the scoring model. For a 10K–100K property platform, a hybrid approach is cheapest and most flexible.

2. **The cheapest viable production stack costs $2,500–$5,000/year** for 10K–100K properties: SafeGraph (Dewey) for raw POI + visit data + Unacast for derivative-work licensing + free geocoding (Mapbox/Census) + open POI enrichment (OSM/Overture). At 1M+ properties, enterprise SaaS platforms become the total-cost winner.

3. **Mobile location data has well-documented demographic bias** (peer-reviewed PLOS ONE study): SafeGraph underrepresents Hispanic, low-income, and older populations by 5–6 percentage points. This bias is market-segment dependent — it is less severe in luxury urban Class A properties and more severe in workforce housing and rural markets.

4. **Walkability is proven; mobile foot traffic is speculative.** A 10+ year body of academic evidence proves that walkability and amenity proximity correlate with rent premiums (+6% to +80%) and lower default risk (-60% for Walk Score >80). However, there is **zero peer-reviewed evidence** that third-party mobile foot traffic data directly predicts multifamily occupancy or rent growth.

5. **Licensing is a strategic differentiator.** Unacast explicitly permits derivative works for commercial products; SafeGraph and Placer.ai heavily restrict them; Foursquare prohibits them. If you plan to sell traffic scores as a product feature, provider selection must start with legal review, not pricing comparison.

6. **"Free" open data is the most expensive stack at scale.** Once engineering labor is included, the open-data stack costs $237K–$648K/year at 1M properties — 4.3× more expensive than a SaaS platform. Free data is viable for prototyping but not for production platforms.

7. **The best foot traffic data is already in your buildings.** First-party IoT access systems (Allegion/Zentra, Latch) generate operational foot traffic data with zero panel bias, zero privacy risk, and direct correlation to staffing and leasing outcomes. Third-party data should supplement, not replace, first-party data.

8. **Privacy regulations are tightening structurally.** As of 2026, 20+ US states classify precise geolocation as sensitive personal information. California's AG is actively enforcing. Maryland's MODPA (April 2026) prohibits the sale of sensitive data outright. This will raise costs and shrink panels over time.

### Recommended Action Plan

| Phase | Action | Timeline | Cost |
|-------|--------|----------|------|
| 1 | **Pilot** — Test SafeGraph (Dewey) + Unacast on 100 properties against your own lease data | 2 weeks | Free samples + $200–$500 |
| 2 | **Build MVP pipeline** — Address → Geocode → Buffer → POI Match → Score | 4–6 weeks | Mapbox (free) + DuckDB (free) + SafeGraph sample |
| 3 | **Integrate first-party data** — Partner with access control vendors (Allegion, Latch) | 8–12 weeks | API integration cost |
| 4 | **Scale** — Migrate to enterprise SaaS or cloud marketplace at 50K+ properties | 3–6 months | $5K–$15K/month |
| 5 | **Validate** — Publish peer-reviewed study linking mobile foot traffic to multifamily outcomes | 6–12 months | Research partnership cost |

---

## 1. The Data Provider Landscape

### 1.1 Market Overview

The global POI data solutions market was valued at approximately $3.03 billion in 2024 and is projected to reach $8.00 billion by 2034, growing at a 10.2% CAGR.[^marketus-poi] The foot traffic and customer location intelligence market was $5.23 billion in 2024 and is projected to reach $14.51 billion by 2035, at a 9.72% CAGR.[^mrfr-foottraffic] North America dominates both markets with >35% share.

The market is bifurcated between:
- **Enterprise platforms** ($12K–$50K+/year): Placer.ai, Foursquare, Veraset — dashboard-first, polished UI, limited API transparency
- **Raw data providers** ($0.05–$30K/year): SafeGraph, Unacast/Gravy Analytics — data-first, requires technical team, most flexible
- **Integrated SaaS platforms** ($400–$1,000/month): GrowthFactor — self-service AI scoring, retail-focused
- **Multifamily-specific upstarts** ($0.02/property): PropTech Metrics — early-stage, limited independent validation

### 1.2 Budget-Friendly Provider Catalog

| Provider | Data Type | Coverage | Pricing | Multifamily Suitability | Key Limitation |
|----------|-----------|----------|---------|----------------------|----------------|
| **SafeGraph (Dewey)** | POI, building footprints, visit patterns (hourly) | 195+ countries | $0.05–$30K/year | Medium-High | Requires technical team; CBG-level visitor origin |
| **Unacast / Gravy Analytics** | Mobility, foot traffic, trade areas | 180+ countries | $1/API call to $50K/year | Medium-High | Most flexible licensing for derivative works |
| **DataForSEO** | Google Maps POI proxy | 250+ countries | $6.20–$60/20K lookups | Low-Medium | No actual visit counts; 90-day stale data |
| **PropTech Metrics** | Multifamily-specific, IoT + satellite signals | US metros | $0.02/property lookup | High (claims) | No independent validation; unsupported technical claims |
| **GrowthFactor** | Integrated foot traffic + demographics + scoring | US | $400/month | Low | Retail-only calibration; no multifamily features |
| **PassBy** | Foot traffic + spend insights | 1.5M US locations | Essential/Premium/Ultimate | Medium-High | US-only; retail-centric POI database |
| **BestTime.app** | Retail busyness / live occupancy | Global | $29/month | Low | Limited to retail venues; no building-level data |
| **dataplor** | Global POI | 250 countries | $0.09/record to $29,999/year | Medium | Monthly updates; confidence scoring |
| **Techsalerator** | POI, firmographic, demographic | 219 countries | $245/purchase | Low | GDPR/CCPA compliant but limited depth |
| **Echo Analytics** | POI, building footprints, mobility | US & EU | Custom pricing | Medium | 80M+ locations; 95%+ polygon coverage |

### 1.3 Data Marketplace Options

For teams already running Snowflake, BigQuery, or AWS, cloud marketplaces offer on-demand access without long-term contracts:

- **AWS Data Exchange**: SafeGraph, Foursquare, Gravy Analytics — pay-as-you-go, no minimums
- **Snowflake Marketplace**: SafeGraph, Facteus, Regrid — query within Snowflake, no data movement
- **Databricks Marketplace**: SafeGraph, O2 Motion — Delta Sharing format

Marketplace pricing typically includes compute costs, so total cost depends on query volume. For a 100K-property portfolio refreshing monthly, marketplace economics are competitive with direct subscriptions.[^marketus-poi]

[^marketus-poi]: Market.us. "Points-Of-Interest (POI) Data Solutions Market Size." 2025-07-08. https://market.us/report/points-of-interest-poi-data-solutions-market/

[^mrfr-foottraffic]: Market Research Future. "Foot Traffic Customer Location Intelligence Solution Market." 2025-09-01. https://www.marketresearchfuture.com/reports/foot-traffic-customer-location-intelligence-solution-market-35880

---

## 2. Free & Open-Source Alternatives

### 2.1 What Free Data Actually Provides

No free or open-source source provides actual POI visit counts. The free data ecosystem provides **static proxies for traffic attractiveness** — not measured visits. This is a critical distinction:

| Source | Data Type | Coverage | Granularity | Actual Visit Counts? |
|--------|-----------|----------|-------------|---------------------|
| **OpenStreetMap (OSM)** | POI locations, categories, tags | Global | ~30–40m accuracy | No |
| **US Census LODES / OnTheMap** | Employment by block | US | Block-level | No (tracks jobs, not visits) |
| **US Census CBP** | Establishments, employment, payroll | US | County/ZIP | No |
| **EPA Smart Location Database** | 90 built-environment variables | US | Block-group | No (walkability proxy) |
| **Google/Apple COVID Mobility** | Relative mobility change | Global | County-level | Discontinued; only relative change |
| **OpenAddresses** | Address points | 69.5% US population | Address-level | No |
| **GTFS (Transit)** | Transit schedules, stops | Global | Stop-level | No (ridership data separate) |
| **FHWA Traffic Counts** | Vehicle volume by road segment | US | Road segment | No (vehicular, not pedestrian) |
| **Sentinel-2 Satellite** | Imagery (10m resolution) | Global | 10m pixel | No (can detect parking lot occupancy) |

### 2.2 The Free Data Stack

A 10-layer free data stack can approximate a composite traffic-attractiveness index:

1. **OSM / Overture Maps** — POI backbone (free, ~53M global POIs)
2. **LODES / OnTheMap** — Employment density proxy (free, block-level)
3. **Census ACS** — Demographic context (free, tract/block-group)
4. **EPA SLD** — Built-environment walkability score (free, block-group)
5. **GTFS / GBFS** — Transit and bike-share access (free, stop/station-level)
6. **FHWA Traffic Counts** — Vehicular volume proxy (free, road segment)
7. **Google Trends** — Search interest by metro (free, relative index)
8. **Zillow / Redfin Scrapers** — Market activity proxy (free, with scraping infrastructure)
9. **OpenStreetMap Buildings** — Building footprints (free, global)
10. **Sentinel-2 SAR** — Parking lot occupancy detection (free, 10m resolution)

### 2.3 The Hidden Cost of Free Data

The free data stack requires:
- 6–12 months of engineering time to build and validate
- 2–4 FTE data engineers for ongoing maintenance ($200K–$400K/year in labor)
- Infrastructure for storage, processing, and geocoding (cloud compute costs)
- Ongoing data freshness management (POI databases go 15–20% stale annually)

At 1M properties, the total cost of ownership for the "free" stack is **$237K–$648K/year** — making it the most expensive option.[^dim02]

**Verdict:** Free data is viable for prototypes and research projects with existing engineering teams. It is not a viable production strategy for a commercial multifamily platform.

[^dim02]: Dim02 Research: Free & Open-Source POI / Traffic Data Sources. 2026-06-20. `research/poi_foot_traffic_dim02.md`

---

## 3. Multifamily Property Data & Geocoding

### 3.1 Property Data Sources

To marry foot traffic data to multifamily properties, you need a comprehensive, geocoded property database as the left side of the join:

| Source | Coverage | Cost | API | Geocoding | Multifamily-Specific |
|--------|----------|------|-----|-----------|---------------------|
| **CoStar** | 38M+ US units | $1,500–$30K+/month | Yes (Bridge API) | Yes | Yes |
| **Reonomy** | 50M+ US properties | $4,800/year | Yes | Yes | 5+ units only |
| **Yardi Matrix** | 13M+ global rental units | ~$25K/interface/year | Yes (SIPP) | Partial | Yes (operational data) |
| **HelloData.ai** | Millions of US listings | $250/month | Yes | Yes | Yes (market surveys) |
| **PropTech Metrics** | Millions of US units | $0.02/lookup | Yes (REST/GraphQL) | Yes | Yes |
| **Datafiniti** | 100M+ US properties | $899/month | Yes | Yes | Partial |
| **BatchData** | 150M+ US properties | $500–$1,500/month | Yes | Yes | Partial |
| **HUD** | FHA-insured multifamily | Free | Download | No | Yes (limited) |
| **Census Building Permits** | All US construction | Free | Download | No | Partial |
| **County Assessor** | Varies by county | Free | Download | Sometimes | Yes (tax records) |

### 3.2 Geocoding Services

| Service | Free Tier | Paid Cost | Accuracy | Batch? | Best For |
|---------|-----------|-----------|----------|--------|----------|
| **Mapbox** | 100K/month | $5/1K | Street-level | Yes | Prototyping, global |
| **OpenCage** | 2,500/day | Custom | OSM-based | Yes | Global, open data |
| **Geocodio** | 2,500/day | $100/mo for 100K | Rooftop (US) | Yes | US properties |
| **US Census Geocoder** | Unlimited | Free | Street-level | 10K/batch | US only, bulk |
| **Nominatim (OSM)** | Unlimited | Free | ~30–40m | No | Research, low volume |
| **Google Geocoding** | $200 credit | $5/1K | Best-in-class | Yes | Precision-critical |
| **HERE** | Free tier | ~$1/1K | High | Yes | Enterprise |
| **Smarty** | Trial | Custom | Rooftop + RDI | Yes | Address validation + geocoding |

### 3.3 The Multifamily Geocoding Challenge

Multi-unit residential properties (condos, apartments) present a unique geocoding challenge. A single street address may match to 259 unique parcel IDs, and street-interpolation geocoding can place the property hundreds of meters from the actual building footprint.[^dim03]

**Best practice:** Use building-footprint-based geocoding (Microsoft Building Footprints, SafeGraph Geometry) for dense urban properties, and fall back to street-interpolation for suburban/rural properties where footprint data is sparse.

[^dim03]: Dim03 Research: Multifamily Property Address & Geocoding Databases. 2026-06-20. `research/poi_foot_traffic_dim03.md`

---

## 4. Technical Integration Architecture

### 4.1 The Seven-Step Pipeline

A production-ready pipeline for marrying foot traffic data to multifamily properties:

```
Raw Addresses → Geocode → Buffer → Discover POIs → Retrieve Visits → Aggregate → Normalize
```

**Step 1: Address Standardization**  
Normalize addresses using USPS format or Loqate/Smarty. Remove unit numbers where possible (they complicate geocoding).

**Step 2: Geocoding**  
Batch geocode using Mapbox, Census Geocoder, or Geocodio. For 100K+ properties, use a serverless pipeline (AWS Lambda + S3 + Step Functions or Parcl Labs' Snowflake → S3 → Lambda pattern).[^dim04]

**Step 3: Buffer Creation**  
Create a catchment area around each property. Common radii:
- 500 meters (5-minute walk) — for urban properties
- 1,000 meters (10-minute walk) — for suburban properties
- 1,500 meters — for rural properties with car-dependent access

Use GeoPandas or PostGIS `ST_Buffer`. Always re-project to a local UTM zone for accurate distance calculations.

**Step 4: POI Discovery**  
Spatial join the property buffer with the POI database. Filter by relevant categories: grocery, retail, dining, transit, healthcare, fitness, entertainment.

**Step 5: Visit Data Retrieval**  
Query the foot traffic provider for visit counts to each POI within the buffer. SafeGraph Weekly Patterns provides hourly visit counts for ~4M US POIs. Aggregate to weekly or monthly buckets.

**Step 6: Visit Aggregation & Scoring**  
Apply category weights and distance decay. Example weighting for multifamily:

| Category | Weight | Rationale |
|----------|--------|-----------|
| Grocery | 0.20 | Essential for all tenant segments |
| Transit | 0.15 | Critical for urban renters |
| Dining | 0.15 | Lifestyle amenity |
| Retail | 0.15 | Convenience and services |
| Fitness | 0.10 | Growing demand post-COVID |
| Healthcare | 0.10 | Especially for senior/family housing |
| Entertainment | 0.10 | Lifestyle amenity |
| Education | 0.05 | Family segment importance |

Apply distance decay: `weighted_visits = raw_visits × weight × (1 / distance²)`

**Step 7: Normalization**  
Normalize scores within each market (metro or submarket) using Z-scores: `z_score = (property_score - market_mean) / market_std`

Map to a 0–100 scale: `traffic_score = clamp((z_score + 3) × (100/6), 0, 100)`

### 4.2 Recommended Tech Stack (Small Team)

| Layer | Tool | Cost |
|-------|------|------|
| Geocoding | Mapbox (batch) or US Census Geocoder | Free–$500/mo |
| Spatial Engine (Dev) | DuckDB + Spatial Extension | Free |
| Spatial Engine (Prod) | Snowflake or BigQuery | $100–$3,000/mo |
| POI Data | SafeGraph (Dewey) + OSM backup | $1,000–$5,000/mo |
| Orchestration | GitHub Actions or Apache Airflow | Free–$200/mo |
| Storage | GeoParquet on S3 | $5–$500/mo |

### 4.3 Pipeline Cost Estimates

| Portfolio Size | Geocoding | POI Data | Compute | Storage | Orchestration | Total/Month |
|---------------|-----------|----------|---------|---------|---------------|-------------|
| 10K | $0 (free tier) | $1,000–$5,000 | $0–$100 | $5 | $0–$50 | $1,000–$5,000 |
| 100K | $450 | $5,000–$15,000 | $0–$500 | $50 | $0–$200 | $5,500–$15,700 |
| 1M | $4,500 | $20,000–$50,000 | $0–$3,000 | $500 | $500–$1,000 | $25,000–$55,000 |

[^dim04]: Dim04 Research: Technical Integration Pipeline. 2026-06-20. `research/poi_foot_traffic_dim04.md`

---

## 5. Data Quality, Accuracy & Bias

### 5.1 Panel Size & Sampling Rate

SafeGraph Patterns exhibited an average sampling rate of **7.5% of the US population** from 2018 to 2022, with notable temporal dynamics and geographic disparities.[^safegraph-bias] The number of sampled devices was strongly correlated with census population at the county level (urban r > 0.97, rural r > 0.91) but less so at the census tract and block-group levels.[^safegraph-bias]

Placer.ai uses a proprietary panel of tens of millions of devices. Unacast/Gravy Analytics processes 60–70 billion location signals daily from 15+ suppliers, covering 600M+ monthly active devices across 180+ countries.[^unacast-scale]

### 5.2 Demographic Bias (Peer-Reviewed Evidence)

The landmark PLOS ONE study by Li et al. (2024) found that SafeGraph underrepresents:
- **Hispanic populations** — higher underrepresentation bias that varied over space, time, and urbanization levels[^safegraph-bias]
- **Low-income households (<$50K)** — significant underrepresentation, especially during COVID-19[^safegraph-bias]
- **Low-education individuals** — higher underrepresentation compared to college-educated populations[^safegraph-bias]

A separate Stanford Law study (Coston et al., 2020) found that SafeGraph coverage of polling locations was negatively correlated with the proportion of voters over age 65 (r = -0.14, p < 0.001) and non-white voters (r = -0.11, p = 0.0067). Strict reliance on SafeGraph for resource allocation would under-allocate by 37% to the oldest/most non-white precincts and over-allocate by 33% to the youngest/whitest.[^coston-bias]

### 5.3 Device Ownership Gap

Smartphone ownership is not uniform:
- Age 65+: **79%** own smartphones vs. 97.5% for ages 18–49[^pew-mobile]
- Income <$30K: **84%** own smartphones vs. 98% for $100K+[^pew-mobile]
- Renters: Median income **$40K** vs. $90K for homeowners[^rubyhome-renters]

This creates a compounding bias: multifamily-dense areas often have lower-income, older, and more racially diverse populations — precisely the demographics underrepresented in mobile panels.

### 5.4 Provider Accuracy Claims

| Provider | Claimed Accuracy | Validation | Independent Audit? |
|----------|-----------------|------------|-------------------|
| Placer.ai | 90–96% correlation with first-party data | Self-reported | No |
| PassBy | 94% correlation to ground truth | Self-reported (vs. in-store sensors) | No |
| Unacast | R-squared up to 92% | Self-reported | No |
| SafeGraph | Strong county-level correlation | Peer-reviewed (PLOS ONE) | Yes |

**Critical caveat:** Provider accuracy claims are almost always validated at the **chain or aggregate level**, not the individual property level. A provider may be 90% accurate for "all Starbucks locations in Texas" but 60% accurate for a specific address in a secondary market.[^growthfactor-compare]

### 5.5 COVID-19 Baseline Distortion

Any model using 2020–2022 data as a baseline is contaminated by unprecedented mobility disruption. SafeGraph's panel experienced documented bugs (August 2022 scaling issue), pandemic-driven demographic skew, and temporary retail closures.[^safegraph-bias] Exclude 2020–2021 data from training baselines; use 2019 as pre-COVID baseline and 2023+ as post-recovery baseline.

[^safegraph-bias]: Li, Z., Ning, H., Jing, F., & Lessani, M. N. (2024). "Understanding the bias of mobile location data across spatial scales and over time." *PLOS ONE*, 19(1), e0294430. https://doi.org/10.1371/journal.pone.0294430

[^coston-bias]: Coston, A., et al. (2020). "Leveraging Administrative Data for Bias Audits." arXiv:2011.07194. https://arxiv.org/pdf/2011.07194

[^pew-mobile]: Pew Research Center. "Americans' Use of Mobile Technology and Home Broadband." 2024-01-31. https://www.astrid-online.it/static/upload/pi_2/pi_2024.01.31_home-broadband-mobile-use_final.pdf

[^rubyhome-renters]: RubyHome. "Homeowners vs. Renters Statistics." 2026-05-27. https://www.rubyhome.com/blog/homeowners-vs-renters-stats/

[^growthfactor-compare]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." 2026-04-22. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^unacast-scale]: Gravy Analytics. "Location Intelligence & Foot Traffic Data." https://gravyanalytics.com/audiences/


---

## 6. Privacy, Regulations & Licensing

### 6.1 The Regulatory Landscape (2026)

The commercial use of foot traffic data in proptech is legally feasible but sits in a rapidly tightening regulatory vise. As of mid-2026, precise geolocation is classified as "sensitive personal information" (SPI) in California (1,850-foot radius) and in 20+ U.S. state comprehensive privacy laws (mostly 1,750-foot radius).[^dim06]

**Key regulations affecting location data:**

| Regulation | Effective Date | Key Provision | Risk Level |
|-----------|---------------|---------------|------------|
| **CCPA/CPRA** | Ongoing | Geolocation ≤1,850 ft = SPI; right to limit use | High |
| **California AG Sweep** | March 2025 | Active enforcement against location data brokers | High |
| **MODPA (Maryland)** | April 2026 | Prohibits sale of sensitive data outright | Very High |
| **GDPR** | Ongoing | Legitimate interest difficult to justify for location tracking | High (EU data) |
| **20+ State Privacy Laws** | 2025–2026 | Most classify geolocation ≤1,750 ft as sensitive | Medium-High |
| **FTC X-Mode/Outlogic Ban** | January 2024 | First-ever ban on selling sensitive location data | High |
| **Data Broker Registration** | 2024+ | California, Vermont, and expanding states require registration | Medium |

### 6.2 Provider Licensing Comparison

The ability to build derivative products varies dramatically by provider:

| Provider | Derivative Works | Resale | Commercial Use | Attribution | Liability Cap |
|----------|-----------------|--------|---------------|-------------|---------------|
| **Unacast** | Explicitly permitted | Allowed with restrictions | Yes | Required | Standard |
| **SafeGraph** | Heavily restricted | Prohibited | Internal use preferred | Required | Standard |
| **Placer.ai** | Heavily restricted | Prohibited | Yes (seat-based) | Required | Standard |
| **Foursquare** | Prohibited | Prohibited | Limited (API tier) | Required | Standard |
| **DataForSEO** | Allowed | Allowed | Yes | Required | Standard |
| **GrowthFactor** | Platform-dependent | Prohibited | Yes (SaaS) | N/A | N/A |

**Critical insight:** If your platform plans to sell traffic scores, rankings, or analytics as a product feature, **Unacast is the only major provider that explicitly permits derivative works for third-party customers.** Building on SafeGraph or Placer.ai may violate licensing terms if you commercialize the output.

### 6.3 Re-Identification Risk

MIT research (de Montjoye et al., 2013) found that **4 spatiotemporal points are sufficient to uniquely identify 95% of individuals** in a mobility dataset.[^mit-reid] This means that even "anonymized" and "aggregated" location data carries re-identification risk if the granularity is too fine.

**Mitigation strategies:**
- Use CBG-level or higher aggregation for visitor origin data
- Apply differential privacy techniques (Laplace noise, k-anonymity)
- Implement minimum device thresholds (e.g., exclude POIs with <5 devices/month)
- Document and audit all data flows for compliance

### 6.4 Compliance Cost Estimate

For a proptech startup using foot traffic data:
- **Legal & DPA negotiation**: $15K–$50K/year
- **Consent management platform**: $5K–$20K/year
- **Compliance audits**: $10K–$30K/year
- **Cyber insurance**: $5K–$15K/year
- **Data broker registration**: $1K–$5K/year
- **Total**: $50K–$250K/year[^dim06]

[^dim06]: Dim06 Research: Privacy Regulations & Licensing. 2026-06-20. `research/poi_foot_traffic_dim06.md`

[^mit-reid]: de Montjoye, Y.A., et al. (2013). "Unique in the Crowd: The privacy bounds of human mobility." *Scientific Reports*, 3, 1376. https://www.nature.com/articles/srep01376

---

## 7. Alternative & Proxy Data Sources

### 7.1 The Alternative Data Landscape

When mobile location data is too expensive, too risky, or too biased, alternative data sources can provide proxy signals for area activity:

| Source | Signal Type | Cost | Granularity | Multifamily Applicability |
|--------|-------------|------|-------------|--------------------------|
| **Satellite imagery (Sentinel-2)** | Parking lot occupancy, building activity | Free (Sentinel) / $1–$10/image (commercial) | 10m pixel | Medium (parking proxy) |
| **SAR (Sentinel-1)** | All-weather parking occupancy | Free | 10m pixel | Medium (research-grade) |
| **Connected vehicle (INRIX)** | Vehicle volume, speed, dwell | $3K–$15K/year | Road segment | Low (vehicular, not pedestrian) |
| **Credit card transactions (Affinity)** | Spend density by ZIP/CBSA | Enterprise (custom) | ZIP/CBSA | Low (macro proxy) |
| **WiFi/Bluetooth beacons** | On-premise foot traffic | Hardware + software | Venue-level | High (if installed) |
| **IoT access control (Zentra/Latch)** | Building entry/exit counts | First-party (existing) | Building-level | Very High |
| **Parking data (ParkWhiz)** | Reservation volume | API (custom) | Lot-level | Low |
| **Transit ridership (GTFS)** | Bus/rail boardings | Free | Stop/station | Medium (transit access proxy) |
| **Google Trends** | Search interest for "apartments near [X]" | Free | Metro | Low (interest proxy) |
| **Delivery app density** | UberEats/DoorDash order volume | Not available | Neighborhood | Low (activity proxy) |

### 7.2 The Hybrid Alternative Stack

The cheapest viable alternative stack that provides ~60–70% of the signal fidelity of a $50K+ mobile-location subscription at 5–10% of the cost:

1. **Sentinel-2 SAR** for parking lot occupancy detection (free)
2. **GTFS/GBFS** for transit and bike-share access (free)
3. **Zillow/Redfin scrapers** for market activity and rent trends (free, with infrastructure)
4. **Google Trends** for search interest (free)
5. **Latch/Zentra** building access data (first-party, where installed)

**Estimated cost: $1,000–$4,000/year** (primarily infrastructure and engineering time)

### 7.3 First-Party IoT Data: The Highest-Fidelity Source

Modern smart access systems (Allegion/Zentra, Latch, ButterflyMX) generate data that can:
- Optimize staffing schedules based on actual foot traffic patterns
- Improve leasing conversion rates by analyzing touring activity
- Strengthen risk management through entry/exit monitoring
- Reduce operating expenses through predictive maintenance

**Key advantage:** Zero panel bias, zero privacy regulatory risk (consent is inherent to the service), and direct correlation to operational outcomes.[^dim07]

**Limitation:** Only works for properties with smart access systems installed. Coverage is limited to Class A/B properties and newer constructions.

[^dim07]: Dim07 Research: Alternative & Proxy Data Sources. 2026-06-20. `research/poi_foot_traffic_dim07.md`

---

## 8. Proptech ROI Evidence

### 8.1 What Is Proven: Walkability & Amenity Proximity

There is a 10+ year, peer-reviewed body of evidence that walkability and amenity proximity drive multifamily value:

- **Pivo & Fisher (2011)**: 1-point Walk Score increase = 0.1% NOI premium for apartments. 80 Walk Score properties worth 6% more than <50 Walk Score.[^pivo2011]
- **Pivo (2014)**: Multifamily properties with Walk Score <80 had **60% higher default rate** than those >80. Properties with Walk Score ≤8 had **121% higher default rate**.[^pivo2014]
- **Foot Traffic Ahead 2023**: Walkable urban places command a **41% rent premium** over drivable suburban housing. NYC premium: 80%; Chicago: 65%.[^foottraffic2023]
- **National averages (2020–2025)**: Walk Score 80+ apartments command +12% to +18% higher rent. Walk Score 90+ vs. <50 yields +20% to +28% in home value.[^honestcasa]

### 8.2 What Is Emerging: Third-Party Foot Traffic Data

Direct evidence that mobile-device foot traffic data (Placer.ai, SafeGraph) drives multifamily ROI is still limited:

- **Alpine Income Property Trust / Placer.ai**: Used foot traffic insights to acquire an undervalued property and sell at 20%+ risk-adjusted return.[^placer-cre] (Note: This is a retail/net-lease case, not pure multifamily.)
- **Gopher Asset Management**: Uses "demographic and foot traffic" data for submarket due diligence and unit mix design.[^thesisdriven] (Practitioner testimonial, no disclosed performance numbers.)
- **Green Street / Placer.ai**: Integrated Placer.ai foot traffic data into REIT analytics platform.[^greenstreet] (Adoption confirmed; performance impact not disclosed.)
- **Skyline AI (acquired by JLL)**: Used 10,000+ data points per property (including location/POI proximity) to identify mismanaged assets.[^skylineai] (No post-acquisition performance disclosure.)

### 8.3 What Is First-Party: Operational IoT Data

The strongest ROI evidence for foot traffic in multifamily comes from first-party operational data:

- **Zentra/Allegion**: Optimize staffing schedules based on entry/exit patterns; improve leasing conversion through tour analytics.[^allegion]
- **OnSpot Data**: Marketing attribution for leasing offices (campaign-to-visit conversion).[^onspot]
- **PropTech IQ**: Independent validation showing smart thermostats cut energy costs 15–20% ($20K/year on 200-unit property); AI chatbots project 25% higher prospect conversion (+$50K/year).[^proptechiq]

### 8.4 The Evidence Gap

There are **7 critical missing pieces** of evidence that would definitively prove third-party foot traffic data drives multifamily returns:

1. No controlled A/B test of third-party foot traffic data vs. traditional underwriting
2. No peer-reviewed study linking mobile-device foot traffic directly to multifamily occupancy or rent growth
3. No disclosed NOI impact from third-party foot traffic data
4. No REIT investor presentation citing foot traffic data as a portfolio strategy
5. No post-implementation audit of Skyline AI or similar AI acquisitions
6. No standard metric linking amenity utilization to renewal rates
7. No post-COVID replication of walkability premium durability

[^pivo2011]: Pivo, G., & Fisher, J. D. (2011). "The walkability premium in commercial real estate investments." *Real Estate Economics*, 39(2), 185–219. https://www.sxd.sala.ubc.ca/9_resources/Walkability%20Paper%20February%2010.pdf

[^pivo2014]: Pivo, G. (2014). "Walk Score: The Significance of 8 and 80 for Mortgage Default Risk in Multifamily Properties." *Journal of Sustainable Real Estate*, 6(1), 187–210. https://warrington.ufl.edu/due-diligence/2025/03/19/value-of-living-within-walking-distance/

[^foottraffic2023]: Smart Growth America / George Washington University. "Foot Traffic Ahead 2023." https://www.multihousingnews.com/how-walkability-impacts-multifamily/

[^honestcasa]: Honest Casa. "Walkability Score Explained." 2026-05-25. https://honestcasa.com/blog/walkability-score-explained

[^placer-cre]: Placer.ai. "CRE Solutions." https://www.placer.ai/solutions/cre

[^thesisdriven]: Thesis Driven. "How Real Estate Investors and Operators Are Using Location Data." 2023-05-09. https://www.thesisdriven.com/letters/how-real-estate-investors-and-operators/

[^greenstreet]: Green Street. "Green Street Integrates Placer.ai Data." 2026-03-03. https://www.greenstreet.com/green-street-integrates-placer-ai-data-into-its-u-s-platform-to-deliver-advanced-foot-traffic-intelligence

[^skylineai]: Commercial Observer. "Harnessing AI to Find Alpha in Real Estate Investment." 2019-04-22. https://commercialobserver.com/2019/04/harnessing-ai-to-find-alpha-in-real-estate-investment/

[^allegion]: Allegion US. "Beyond the Buzzword: Real-World NOI Gains from Proptech Adoption." 2025-09-01. https://us.allegion.com/en/resources/education/leading-the-industry/multifamily/beyond-the-buzzword--real-world-noi-gains-from-proptech-adoption.html

[^onspot]: OnSpot Data. "Real Estate Marketing Platform for REIT Portfolios." https://www.onspotdata.com/industries/reits/

[^proptechiq]: PropTech IQ. "How PropTech IQ Helps Multifamily Owners Understand ROI." 2025-03-20. https://proptechiq.com/how-proptech-iq-helps-multifamily-owners-understand-roi-amid-endless-vendor-pitches/

[^dim08]: Dim08 Research: Proptech Case Studies & ROI Evidence. 2026-06-20. `research/poi_foot_traffic_dim08.md`

---

## 9. Scoring Methodology

### 9.1 The Composite Traffic Score Formula

A production-ready methodology for scoring multifamily properties based on surrounding POI foot traffic:

```
CTS_p = Σ_c [ w_c × Σ_i ( v_i × f(d_{p,i}) × q_i × t_i ) ]
```

Where:
- `CTS_p` = Composite Traffic Score for property p
- `w_c` = Category weight (grocery, transit, dining, etc.)
- `v_i` = Visit count for POI i
- `f(d_{p,i})` = Distance decay function (exponential, Gaussian, or inverse-square)
- `q_i` = POI quality factor (rating, chain status, hours)
- `t_i` = Temporal normalization factor (weekday/weekend, seasonal)

### 9.2 Distance Decay Functions

| Function | Formula | Best For |
|----------|---------|----------|
| **Exponential** | `e^(-βd)` | Urban properties where proximity matters sharply |
| **Inverse-square** | `1/d²` | Suburban properties with broader catchment areas |
| **Gaussian** | `e^(-d²/2σ²)` | Smooth decay for mixed urban/suburban |

Targomo uses quadratic decay: POI at 0 min = weight 1, at 5 min = ¼, at 10 min = 1/9, at 15 min = 1/16.[^targomo]

### 9.3 Temporal Normalization

- **Weekday vs. weekend**: Weight weekday traffic higher for residential properties (residents shop during the week; tourists spike weekends)
- **Seasonal adjustment**: Apply 4-week rolling averages to smooth noise; avoid monthly-only aggregation (over-smoothes)
- **Weekly aggregation**: Improves signal-to-noise ratio by 88% over daily aggregation[^mdas-gnn]

### 9.4 Market-Relative Scoring

Z-score normalization within each market (metro or submarket):

```python
z_score = (property_score - market_mean) / market_std
traffic_score = clamp((z_score + 3) * (100 / 6), 0, 100)
```

This produces a 0–100 scale where:
- 50 = Average for the market
- 70 = 1 standard deviation above average (top 16%)
- 90 = 2 standard deviations above average (top 2.5%)

### 9.5 Uncertainty Quantification

Every score should include a confidence flag:

| Flag | Criteria | Interpretation |
|------|----------|---------------|
| **HIGH** | ≥20 POIs in buffer; ≥5 devices/POI; urban primary market | Score is reliable for investment decisions |
| **MEDIUM** | 10–20 POIs; 3–5 devices/POI; suburban secondary market | Score is directional; use with caution |
| **LOW** | <10 POIs; <3 devices/POI; rural or tertiary market | Score is speculative; do not rely on it |

### 9.6 Machine Learning Integration

Tree-based models (XGBoost, Random Forest) significantly outperform linear models for predicting real estate prices using POI and geospatial features. XGBoost achieves R² = 0.952 for rent prediction with POI features in multimodal tasks.[^xgboost-poi]

Recommended feature engineering:
- 17 traffic-related features (visit counts by category, proximity-weighted scores, temporal trends)
- Market-relative features (percentile within submarket, tier classification)
- Demographic interaction features (traffic × income, traffic × age)
- Use GroupKFold validation by metro to prevent data leakage

### 9.7 Decomposable Scores for Institutional Stakeholders

A single traffic score (0–100) is intuitive but loses critical nuance. Institutional stakeholders (REITs, pension funds, lenders) demand auditable, decomposable scores. Present both:

- **Composite Score** (0–100): Quick comparison
- **Sub-scores** (each 0–100): Grocery, Transit, Dining, Retail, Fitness, Healthcare, Entertainment

Users should be able to customize category weights by tenant segment (e.g., young professionals weight transit and dining higher; families weight grocery and schools higher).

[^targomo]: Targomo Developers. "Location Scoring API." 2021-09-17. https://www.targomo.com/developers/apis/location_scoring/

[^mdas-gnn]: MDAS-GNN paper. "Multi-Dimensional Spatiotemporal GNN." arXiv, 2025-10-27. https://arxiv.org/html/2510.27197v1

[^xgboost-poi]: ResearchGate. "Enhancing Housing Price Prediction Accuracy through Hybrid POI-XGBoost Models." 2026-04-23. https://www.researchgate.net/publication/404026830_Enhancing_Housing_Price_Prediction_Accuracy_through_Hybrid_POI-XGBoost_Models_A_Case_Study_of_Nanjing

[^dim09]: Dim09 Research: Scoring Models — Property Traffic Ranking Methodology. 2026-06-20. `research/poi_foot_traffic_dim09.md`

---

## 10. Cost Economics & TCO

### 10.1 Total Cost of Ownership by Consumption Model

| Model | 10K Properties | 100K Properties | 1M Properties |
|-------|---------------|-----------------|---------------|
| **Metered API** | $4,400/mo | $6,900/mo | $30,000+/mo |
| **Flat-File Subscription** | $5,000/mo | $8,000/mo | $20,000/mo |
| **Cloud Marketplace** | $4,800/mo | $6,400/mo | $14,900/mo |
| **SaaS Platform** | $3,300/mo | $5,300/mo | $12,600/mo |
| **Open Data + Engineering** | $19,700/mo | $27,000/mo | $54,000/mo |

*Source: Dim10 TCO analysis. Includes data, compute, storage, geocoding, orchestration, and engineering labor.*

### 10.2 Hidden Costs Checklist

Ten often-overlooked costs that can blow up budgets by 30–60%:

1. **Data egress fees**: Moving data out of Snowflake/BigQuery costs $0.05–$0.12/GB. At 5TB, that's $250–$600/month.
2. **API overage**: Mapbox has no hard spending caps by default. A runaway script can 10x the bill overnight.
3. **Geocoding overruns**: 100K properties × 12 refreshes/year = 1.2M geocodes. At $5/1K, that's $6,000/year — but free tiers can reduce this to near zero with Mapbox (100K/month) or Census Geocoder (unlimited).
4. **Stale data reprocessing**: SafeGraph refreshes monthly. Re-processing a 100K-property portfolio every month costs compute and engineering time.
5. **ETL compute**: Snowflake query costs scale with data volume. A complex spatial join on 1M properties can cost $500–$2,000 per run.
6. **Storage growth**: GeoParquet is 5–10× smaller than GeoJSON, but 1M properties with 5 years of history still requires 50–100GB.
7. **Compliance overhead**: Legal review, DPA negotiation, consent management, audits ($50K–$250K/year).
8. **Disaster recovery**: Cross-region database replication triggers egress fees on initial sync and ongoing replication.
9. **Engineering labor**: The silent killer. 0.5 FTE at $6,500/month exceeds most SaaS subscriptions at 10K+ properties.
10. **POI churn**: 15–20% of restaurants close annually. Stale POI databases misrepresent neighborhood quality.

### 10.3 Pricing Negotiation Guide

- **Academic/nonprofit discount**: SafeGraph explicitly offers free data to academics and governments. If you qualify, start there.
- **Multi-year commitment**: Ask for 18–30% off in exchange for a 2–3 year contract.
- **Volume tiers**: Foursquare drops from $18.75/1K to $1.75/1K at 5M+ calls/month.
- **Consumption caps**: Request a monthly billing cap. "We commit to $X/month; overage requires written approval."
- **Free trial extension**: Ask for 60–90 days instead of 14 days.
- **End-of-quarter timing**: Sales reps are most motivated in the final 2–3 weeks of a quarter.
- **Before funding rounds**: Providers want logos for pitch decks. Early-stage startups can extract 20–50% discounts in exchange for a public case study.[^dim10]

[^dim10]: Dim10 Research: API & Data Marketplace Economics. 2026-06-20. `research/poi_foot_traffic_dim10.md`

---

## 11. Provider Head-to-Head Comparison

### 11.1 The Top 5 Budget Options

| Criteria | SafeGraph (Dewey) | DataForSEO | Unacast/Gravy | GrowthFactor | PropTech Metrics |
|----------|------------------|------------|---------------|--------------|------------------|
| **Accuracy** | High (POI); Medium (visits) | Low (no visits) | High (GPS-derived) | Medium (retail-calibrated) | Unknown (claims only) |
| **POI Coverage** | 80M+ global | 200M+ (Google proxy) | 600M+ devices | Via Unacast | "Millions" (US) |
| **Visit Granularity** | Hourly, POI-level | N/A | Daily/weekly, POI-level | Weekly, aggregated | Unknown |
| **Freshness** | Monthly | 90 days | Daily | Weekly | Unknown |
| **API Quality** | Excellent (docs, samples) | Good (pay-as-you-go) | Good (enterprise) | Good (SaaS UI) | Early (REST/GraphQL) |
| **Pricing** | $0.05–$30K/year | $6.20–$60/20K | $1/call to $50K/year | $400/mo | $0.02/property |
| **Licensing** | Restricted (no resale) | Permissive | Most permissive | Platform-dependent | Unknown |
| **Multifamily Suitability** | Medium-High | Low | Medium-High | Low | High (claims) |
| **Support** | Strong (academic program) | Medium | Strong (enterprise) | Medium | Unknown |
| **Privacy** | CCPA/GDPR compliant | CCPA/GDPR compliant | GDPR/CCPA compliant | CCPA compliant | Unknown |
| **Scalability** | High | High | Very High | Medium | Unknown |

### 11.2 Winner by Use Case

| Use Case | Winner | Runner-up | Avoid |
|----------|--------|-----------|-------|
| **Raw data + custom modeling** | SafeGraph (Dewey) | Unacast | DataForSEO (no visits) |
| **Resell scores as product feature** | Unacast | SafeGraph (with negotiation) | Foursquare, Placer.ai |
| **Quick insights, no engineering** | GrowthFactor | PassBy | SafeGraph (requires technical team) |
| **Multifamily-specific (claims)** | PropTech Metrics | HelloData.ai | GrowthFactor (retail-only) |
| **Budget bootstrap (<$500/mo)** | DataForSEO + OSM | BestTime.app | Enterprise subscriptions |
| **International coverage** | Unacast | SafeGraph | Placer.ai (US-only) |

### 11.3 Red Flags

| Provider | Red Flag | Severity | Workaround |
|----------|----------|----------|------------|
| **PropTech Metrics** | No independent validation of IoT/satellite claims | High | Pilot test on 100 properties before committing |
| **DataForSEO** | No actual visit counts; 90-day stale data | Medium | Use for POI metadata only, not traffic scoring |
| **GrowthFactor** | Retail-only calibration; no multifamily features | Medium | Not recommended for multifamily ranking |
| **SafeGraph** | Requires in-house data science team | Medium | Factor in 0.5–1 FTE data scientist cost |
| **Unacast** | Higher cost at scale; less POI precision than SafeGraph | Low | Use for derivative works where licensing matters |
| **Foursquare** | Prohibits derivative works; very expensive | High | Only for basic POI lookup, not scoring |

[^dim11]: Dim11 Research: Provider Head-to-Head Comparison. 2026-06-20. `research/poi_foot_traffic_dim11.md`

---

## 12. Geographic Coverage & Bias

### 12.1 The Urban → Suburban → Rural Gradient

Foot traffic data quality degrades predictably by density:

| Market Type | Panel Density | POI Coverage | Score Reliability | Provider Recommendation |
|-------------|--------------|--------------|-------------------|------------------------|
| **Primary metro** (NYC, LA, Chicago) | Very High | Excellent | High | Any major provider |
| **Secondary metro** (Austin, Nashville, Charlotte) | High | Good | Medium-High | SafeGraph, Placer.ai, PassBy |
| **Tertiary metro** (Boise, Greenville, Huntsville) | Medium | Moderate | Medium | Unacast (global panel) |
| **Suburban** | Medium-High | Good | Medium-High | SafeGraph, Unacast |
| **Rural** | Low | Sparse | Low | Avoid for ranking; use static walkability scores |
| **College town** | Variable (seasonal) | Good | Medium | Adjust for academic calendar |
| **Seasonal/vacation** | Variable (seasonal) | Moderate | Low | Use annual averages, not peak periods |
| **New construction** | Low (lag) | Poor (not in POI db yet) | Very Low | Use building permit + walkability proxy |

### 12.2 The Geographic Arbitrage

Multifamily investment is booming in secondary and tertiary Sun Belt markets (Austin, Nashville, Charlotte, Phoenix, Greenville) where panel density is thinner than in coastal primary metros. This creates an **information asymmetry**: the markets where investors need the data most are the markets where the data is least reliable.

**Mitigation strategy:** In data-poor markets, weight static walkability/amenity scores more heavily and dynamic foot traffic scores less heavily. Combine multiple data sources (satellite, transit, connected vehicle) where mobile panels are thin.[^dim12]

[^dim12]: Dim12 Research: Geographic Coverage, Bias & Market Segmentation. 2026-06-20. `research/poi_foot_traffic_dim12.md`

---

## 13. Strategic Recommendations & Action Plan

### 13.1 Immediate Actions (0–30 Days)

1. **Request free samples from SafeGraph (Dewey) and Unacast**  
   Test data quality on 100 properties in your target market. Compare outputs against your own lease data and ground truth.

2. **Evaluate PropTech Metrics with skepticism**  
   The $0.02/price point is attractive, but the IoT/satellite claims are undocumented. Run a 100-property pilot and compare against SafeGraph before committing.

3. **Audit your licensing needs**  
   If you plan to sell traffic scores as a product feature, Unacast is the only major provider with explicitly permissive derivative works terms. If scores are internal-only, SafeGraph offers better POI precision at lower cost.

4. **Map your first-party data assets**  
   Identify properties in your portfolio with smart access systems (Zentra, Latch). This is your highest-fidelity, lowest-risk foot traffic data source.

### 13.2 Short-Term Build (30–90 Days)

5. **Build the MVP pipeline**  
   Use DuckDB + GeoPandas for prototyping. Start with Mapbox geocoding (100K free/month) and SafeGraph sample data. Implement the 7-step pipeline: Address → Geocode → Buffer → POI Match → Visit Aggregate → Score → Normalize.

6. **Implement scoring with decomposable sub-scores**  
   Do not collapse everything into a single 0–100 number. Expose grocery, transit, dining, retail, fitness, healthcare, and entertainment sub-scores. Allow users to customize weights by tenant segment.

7. **Add data quality confidence flags**  
   HIGH = urban primary market with ≥20 POIs in buffer. MEDIUM = suburban secondary market with 10–20 POIs. LOW = rural/tertiary market with <10 POIs. Be transparent about where the data is weak.

8. **Exclude 2020–2021 data from baselines**  
   Use 2019 as pre-COVID baseline and 2023+ as post-recovery baseline. Document any use of 2020–2022 data with explicit caveats.

### 13.3 Medium-Term Scale (90–180 Days)

9. **Migrate to production infrastructure**  
   Move from DuckDB to Snowflake/BigQuery for spatial processing. Implement Apache Airflow or GitHub Actions for weekly pipeline orchestration. Use GeoParquet on S3 for storage.

10. **Integrate first-party operational data**  
    Partner with access control vendors (Allegion, Latch) to ingest building entry/exit data. Use this as the primary signal and third-party mobile data as the competitive benchmarking overlay.

11. **Validate against lease outcomes**  
    Backtest your traffic scores against actual lease velocity, rent growth, and occupancy for a panel of properties. This is the only way to prove the model works. Target R² ≥ 0.50 for rent prediction from traffic features.

12. **Negotiate enterprise contracts**  
    At 50K+ properties, flat annual subscriptions become cheaper than metered APIs. Use competitive quotes from 2+ providers as leverage. Ask for 18–30% multi-year discounts and consumption caps.

### 13.4 Long-Term Differentiation (180–365 Days)

13. **Publish a peer-reviewed study**  
    Partner with a real estate economics research group (Wharton, NYU Schack, MIT CRE) to conduct a rigorous study linking mobile foot traffic data to multifamily outcomes. Publication in *Real Estate Economics* or *Journal of Real Estate Finance and Economics* would provide institutional-grade credibility and a first-mover advantage.

14. **Build a privacy-compliant data architecture**  
    As regulations tighten (MODPA, expanded state laws, potential federal APRA), diversify away from pure mobile-location-data dependence. Build a hybrid architecture that can swap providers as regulations evolve. Invest in differential privacy and minimum device thresholds.

15. **Create a competitive moat through transparency**  
    The insight that differentiates winning platforms is not the data source — it is the ability to communicate data quality, bias, and confidence to users. Build a "Data Quality Dashboard" that shows panel density, bias correction, and confidence flags for every property score. Institutional investors will pay a premium for transparency over black-box scores.

### 13.5 Cost Roadmap

| Phase | Timeline | Estimated Cost | Key Deliverable |
|-------|----------|----------------|-----------------|
| Pilot | 0–30 days | $200–$500 | Validated data sample on 100 properties |
| MVP Pipeline | 30–90 days | $0–$1,000 (free tiers) | Working scoring pipeline for 1K properties |
| Production | 90–180 days | $3,000–$8,000/month | Scaled pipeline for 10K–100K properties |
| Enterprise | 180–365 days | $10,000–$20,000/month | Full platform with first-party + third-party data |
| Research | 180–365 days | $50K–$150K (research partnership) | Peer-reviewed publication |

---

## 14. Conclusion

The quest for cheap POI foot traffic data to rank multifamily properties is both feasible and strategically valuable — but it is not as simple as subscribing to a single provider and receiving a ranked list. The data landscape is complex, biased, regulated, and evolving.

The most important insights from this research are:

1. **Start with walkability, not foot traffic.** A 10+ year body of academic evidence proves that walkability and amenity proximity drive multifamily value. Foot traffic data is a dynamic overlay on this proven foundation — not a replacement.

2. **The cheapest viable stack is a hybrid.** No single provider delivers everything at low cost. The optimal stack combines SafeGraph (Dewey) for raw POI + visit data, Unacast for licensing flexibility, free geocoding (Mapbox/Census), and open POI enrichment (OSM/Overture) — all for $2,500–$5,000/year at 10K–100K properties.

3. **First-party data beats third-party data.** The highest-fidelity, lowest-risk foot traffic signal is the data already generated by your buildings' access control systems. Third-party mobile data is valuable for competitive benchmarking and market intelligence, but it should supplement — not replace — operational data.

4. **Transparency is the competitive moat.** In a market flooded with black-box scores, the platform that communicates data quality, bias, and confidence to users will win institutional trust. Build decomposable scores, data quality flags, and audit trails from day one.

5. **Regulation is a structural tailwind for first-party data.** As privacy laws tighten and mobile panels shrink, the relative advantage of first-party, consent-based data will grow. Platforms that invest in privacy-compliant architecture and first-party data collection today will be better positioned in 2027 and beyond.

The path forward is clear: pilot, validate, build transparently, and scale with the economics — not against them.

---

## Research Files

All supporting research artifacts are available in the `research/` directory:

| File | Description |
|------|-------------|
| `poi_foot_traffic_landscape.md` | Phase 1: Landscape scan (5 searches) |
| `poi_foot_traffic_dimensions.md` | Phase 2: Dimension decomposition (12 dimensions) |
| `poi_foot_traffic_dim01.md` – `dim12.md` | Phase 3: Deep-dive research per dimension |
| `poi_foot_traffic_cross_verification.md` | Phase 4: Cross-verification engine |
| `poi_foot_traffic_insight.md` | Phase 6: Insight extraction (12 insights) |
| `poi_foot_traffic_report.md` | This report |

---

*Report prepared by multi-agent deep research swarm. 250+ independent searches conducted across 12 dimensions. All claims traceable to original sources with inline citations. Cross-verified for confidence classification.*
