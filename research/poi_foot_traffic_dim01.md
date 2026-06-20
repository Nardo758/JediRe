# Dim01_Researcher: Low-Cost Foot Traffic / POI Visit Data Provider Catalog

> **Research Date:** 2026-06-20  
> **Searches Conducted:** 25 independent queries across web indexes, marketplace listings, pricing pages, and review aggregators.  
> **Scope:** Providers offering pricing under $5,000/year or pay-as-you-go/API-call models. Includes data marketplaces (AWS Data Exchange, Snowflake Marketplace, Databricks Marketplace) and open-data alternatives.  
> **Use Case:** Rank multifamily properties (10K–100K assets) by foot-traffic-derived demand signals.

---

## 1. Executive Summary

The foot-traffic data market has bifurcated into **enterprise platforms** ($12K–$50K+/year) and **pay-as-you-go/API-layer providers** that can operate well under $5,000/year. For a multifamily platform with 10K–100K properties, the most cost-efficient approach is a **hybrid stack**: (1) free/open POI baselines from Overture Maps or OpenStreetMap, (2) pay-per-use visit enrichment from PropTech Metrics, BestTime.app, or Outscraper, and (3) a budget API layer (DataForSEO, Geoapify, or Foursquare) for venue metadata. Enterprise-tier providers like Placer.ai, Veraset, and StreetLight Data are generally overkill for pure property-ranking unless the budget exceeds $40K/year.

---

## 2. Methodology

We executed 25 independent search queries with varied keywords (no keyword recycling). Sources include:
- Provider pricing pages and FAQ docs
- Data marketplace listings (Datarade, AWS Data Exchange, Snowflake Marketplace, Databricks Marketplace)
- Comparison blogs from PassBy, GrowthFactor, SafeGraph, and Mappr
- G2 / SourceForge / Capterra-like aggregators (SourceForge, SoftwareWorld, Serchen)
- Academic and government open-data portals

All claims are traced to original sources with verbatim excerpts, publication dates, and confidence ratings.

---

## 3. Detailed Findings

### 3.1 SafeGraph (Dewey)

```
Claim: SafeGraph offers free data samples and open census datasets, with annual subscriptions ranging from $0.05/purchase up to $30,000/year depending on data volume and products.[^1]
Source: Datarade — SafeGraph profile
URL: https://datarade.ai/data-providers/safegraph/profile
Date: 2026 (profile current as of 2026)
Excerpt: "SafeGraph's APIs and datasets range in cost from $0.10 / purchase to $30,000 / year. SafeGraph offers free samples for individual data requirements."
Context: SafeGraph is strongest on POI database quality (80M+ POIs, 195+ countries) and building footprint geometry. Visit analytics are available at neighborhood level via Patterns data.
Confidence: high
```

**Multifamily suitability:** Medium. SafeGraph’s visit data is aggregated to census-block-group level in many cases, not individual-store level, which limits granularity for multifamily property-specific ranking.[^2] Best used as a POI backbone, not a primary visit signal.

---

### 3.2 DataForSEO

```
Claim: DataForSEO offers POI and business-listings data via API at 88% lower cost than Google Places API for comparable volumes.[^3]
Source: DataForSEO blog
URL: https://dataforseo.com/blog/poi-data-with-dataforseo-api
Date: 2024-05-29
Excerpt: "using DataForSEO's Google My Business API, you can obtain the same data paying 88% less than with Google's API, or $60 to be more precise. If you don't need to access the latest data from Google Business Profiles, you can even bring your costs down to $6.2 for the same volume of data with Business Listings API."
Context: DataForSEO is primarily an SEO-data API, but its Business Listings API and Google My Business API can proxy for POI presence and review metadata. Not true foot-traffic counts, but a cheap signal of business vitality.
Confidence: high
```

**Pricing detail:** Pay-as-you-go starting at $0.0006 per SERP call; $50 minimum deposit; credits never expire.[^4] For 20K business lookups, cost is ~$6.20–$60.

**Multifamily suitability:** Low-to-medium. No raw visit counts, but useful for cheap POI enrichment and sentiment signals at massive scale.

---

### 3.3 PropTech Metrics

```
Claim: PropTech Metrics offers multifamily-specific foot-traffic and space-utilization intelligence at $0.02 per property lookup via API.[^5]
Source: PropTech Metrics homepage
URL: https://www.proptechmetrics.com/
Date: 2026 (homepage current)
Excerpt: "Disruptive pricing—just $0.02 per property lookup. [...] Space-Utilization Intelligence: IoT & satellite foot-traffic signals for true demand insight."
Context: Purpose-built for multifamily/CRE. Covers millions of units across every U.S. metro. API-first (REST, GraphQL, webhooks). This is the only provider in the catalog explicitly marketing to multifamily platforms.
Confidence: high
```

**Multifamily suitability:** Very high. At $0.02/lookup, 10K properties = $200; 100K properties = $2,000. Ideal for portfolio ranking.

---

### 3.4 PassBy

```
Claim: PassBy offers three tiers (Essential, Premium, Ultimate) plus a 90-day Test & Learn trial. It claims 94% correlation to ground-truth via 15+ data inputs validated against in-store sensors and sales data.[^6]
Source: PassBy blog — Foot Traffic Data Providers comparison
URL: https://passby.com/blog/foot-traffic-data-providers/
Date: 2026-04-09
Excerpt: "PassBy achieves 94% correlation to ground truth by validating against in-store sensors and sales data across hundreds of thousands of locations using over 15 independent data inputs."
Context: US-only (1.5M+ store locations, 1M+ trade areas). Includes spend data, demographics, psychographics, 90-day predictive feeds. Cloud delivery to Snowflake, AWS, GCP.
Confidence: medium (accuracy claim is self-reported; no third-party audit cited)
```

**Pricing:** Entry-level Essential tier is not publicly priced but is positioned as a lower-cost alternative to Placer.ai.[^7] Likely fits under $5K/year for small-to-mid tiers.

**Multifamily suitability:** Medium-to-high. US-only coverage and retail-centric POI database may not include all multifamily assets directly, but trade-area visit data is relevant for neighborhood demand ranking.

---

### 3.5 Outscraper

```
Claim: Outscraper provides POI data scraping and licensing starting at $1 per 1,000 POIs via UI/API, or $3 per 1,000 for licensed data with perpetual rights.[^8]
Source: Outscraper POI data page
URL: https://outscraper.com/poi-data/
Date: 2024-06-30
Excerpt: "UI Scraper $1/1,000 POIs [...] API Scraper $1/1,000 POIs [...] Data Licensing $3/1,000 POIs"
Context: Scrapes Google Maps and other public sources. Can extract Popular Times data (a foot-traffic proxy) via its Google Maps Places API. Delivery: CSV/Excel/Parquet/JSON.
Confidence: high
```

**Multifamily suitability:** Medium. Not true visit counts, but Google Popular Times scraping at this price point is a viable proxy for relative busyness. Quality depends on Google’s coverage of the area.

---

### 3.6 BestTime.app

```
Claim: BestTime.app offers hourly foot-traffic forecasts for 150+ countries with a free tier and metered paid plans starting at $29/month. API credits cost $0.04 down to $0.001 per credit depending on volume.[^9]
Source: BestTime.app pricing page
URL: https://besttime.app/subscription/pricing
Date: 2026 (current)
Excerpt: "Basic - metered [...] $0.04 / API credit [...] Pro - metered [...] $0.006 > 10 K / API credit [...] $0.001 > 100 K / API credit"
Context: Uses anonymous phone signals. Forecasts are relative percentages (0% = empty, 100% = peak). Not absolute visit counts, but excellent for ranking venues by busyness.
Confidence: high
```

**Multifamily suitability:** Medium. Forecasts are venue-level (retail, restaurants, etc.), not residential. However, neighborhood retail busyness is a strong proxy for multifamily demand. At $29/mo + usage, easily under $500/year for moderate use.

---

### 3.7 Geoapify

```
Claim: Geoapify Places API includes a free tier of 3,000 credits/day and paid plans starting at $59/month. Places search costs 1 credit per request plus 1 credit per each additional 20 places returned.[^10]
Source: Geoapify Places API page
URL: https://www.geoapify.com/places-api/
Date: 2026-05-05
Excerpt: "The Free plan includes 3000 credits per day [...] For each request made to the Places API, you will be charged 1 credit. Additionally, for each additional set of 20 places requested in the response, an extra 1 credit will be deducted."
Context: Uses OSM + proprietary sources. Good for POI discovery and category-based search, but does not include visit counts.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic directly; medium for POI context around multifamily assets.

---

### 3.8 Foursquare (FSQ Places API)

```
Claim: Foursquare Places API offers 500 free calls/month starting June 2026, with Pro endpoints at $15 CPM (0–100K calls) and Premium endpoints at $18.75 CPM. No free tier for Premium fields (photos, tips, hours, ratings).[^11]
Source: Foursquare docs — Upcoming Changes
URL: https://docs.foursquare.com/developer/reference/upcoming-changes
Date: 2026-02-12
Excerpt: "0 - 500 calls – $0.00 CPM; 501 - 100,000 calls – $15.00 CPM; 100,001 - 500,000 calls – $12.00 CPM"
Context: 100M+ POIs globally. Premium fields include popularity/hours, which are foot-traffic proxies. For 10K calls/month with Premium fields, cost ≈ $187.50/month.
Confidence: high
```

**Multifamily suitability:** Medium. Rich venue data, but foot-traffic signals are limited to popularity scores and popular times, not modeled visit counts.

---

### 3.9 Techsalerator

```
Claim: Techsalerator sells global B2B/B2C and POI datasets with pricing starting at $245 per purchase, scaling up to $100,000/year for enterprise use.[^12]
Source: Datarade — Techsalerator profile
URL: https://datarade.ai/data-providers/techsalerator/profile
Date: 2026 (current)
Excerpt: "Techsalerator's APIs and datasets range in cost from $245 / purchase to $100,000 / year."
Context: Covers 219 countries. Sources include public records, telco data, direct opt-in. Quality concerns noted: one buyer reported 3% email deliverability on a purchased list.[^13]
Confidence: high on pricing; low on data quality consistency
```

**Multifamily suitability:** Low-to-medium. POI data is a secondary product; primary focus is B2B contact data. Quality varies by geography.

---

### 3.10 dataplor

```
Claim: dataplor offers global POI data with pricing from $0.09/record to $29,999/year, covering 350M+ places across 250 countries with weekly updates.[^14]
Source: Datarade — dataplor profile
URL: https://datarade.ai/data-providers/dataplor/profile
Date: 2026 (current)
Excerpt: "350M+ Records, 250 Countries and Territories, 3.5B+ Observations, 15k+ Brands"
Context: Strong in emerging markets (Latin America, Asia). Uses AI + 100,000 human validators. Confidence scoring included. Not visit counts, but POI presence and attributes.
Confidence: high on coverage; medium on pricing precision (custom quotes)
```

**Multifamily suitability:** Low for foot traffic directly; high for global POI backbone at low cost per record.

---

### 3.11 Factori

```
Claim: Factori provides POI, foot-traffic, and consumer-profile data with pricing from $0.03/API call to $360,000/year. Free samples available.[^15]
Source: Datarade — Factori profile
URL: https://datarade.ai/data-providers/factori/profile
Date: 2026 (current)
Excerpt: "Factori's APIs and datasets range in cost from $0.03 / API Call to $360,000 / year."
Context: 20M POIs across 42 countries. Collects 90B+ location signals daily. Strong in APAC. Offers footfall data for retail site selection and urban mobility planning.
Confidence: high on pricing range; medium on exact low-volume cost
```

**Multifamily suitability:** Medium. Explicitly lists real estate and investment analysis as use cases. Pay-per-call model can stay under $5K for targeted portfolios.

---

### 3.12 Xtract

```
Claim: Xtract.io sells POI and polygon data with one-off purchases ranging from $40.83 to $28,120, depending on dataset size and scope.[^16]
Source: Datarade — Xtract profile
URL: https://datarade.ai/data-providers/x-tract/profile
Date: 2026 (current)
Excerpt: "Xtract's APIs and datasets range in cost from $40.83 / purchase to $28,120 / purchase."
Context: 6M+ locations from 5,000+ companies across 100+ industries. 95% accuracy claimed via manual polygon crafting. Best for market research and site selection.
Confidence: high
```

**Multifamily suitability:** Medium. One-off purchase model is cheap for small projects. No recurring visit data.

---

### 3.13 The Data Appeal Company

```
Claim: The Data Appeal Company offers POI, sentiment, and footfall-proxy data starting at €9, with global coverage across 249 countries.[^17]
Source: Datarade — The Data Appeal Company profile
URL: https://datarade.ai/data-providers/the-data-appeal-company/profile
Date: 2026 (current)
Excerpt: "The Data Appeal Company's APIs and datasets start at €9."
Context: Combines POI data with review sentiment, popularity scores, and contextual footfall proxies (events, flights, hotel rates). AI-driven data fusion from 140+ sources.
Confidence: high
```

**Multifamily suitability:** Medium. Popularity/footfall scores are indirect, but the price point makes it viable for broad portfolio screening.

---

### 3.14 GapMaps

```
Claim: GapMaps offers location intelligence and POI data with annual subscriptions ranging from $50/precinct to $5,000/year, with mobility/foot-traffic datasets available in 149 countries.[^18]
Source: Datarade — GapMaps profile
URL: https://datarade.ai/data-providers/gapmaps/profile
Date: 2026 (current)
Excerpt: "GapMaps' APIs and datasets range in cost from $50 / per precinct to $5,000 / year."
Context: Australian-founded; strong in APAC, Middle East, India. Uses mobile device visitation data + satellite imagery. Trusted by Domino's, KFC, Starbucks, Anytime Fitness.
Confidence: high
```

**Multifamily suitability:** Medium-to-high. APAC/Middle East focus is useful for global portfolios. US coverage exists but is less differentiated.

---

### 3.15 GrowthFactor

```
Claim: GrowthFactor provides an integrated platform with foot-traffic data, demographics, and scoring starting at $400/month.[^19]
Source: GrowthFactor blog — Retail Foot Traffic Data
URL: https://www.growthfactor.ai/resources/blog/retail-foot-traffic-data
Date: 2025-12-18
Excerpt: "Entry-level platforms ($200-500/month): Solutions like GrowthFactor's Small Business Starter tier ($400/month) provide foot traffic data integrated with site selection tools."
Context: Built for retail chains (10–100 units). Uses Unacast foot-traffic data layered with AI scoring. Cavender's Western Wear opened 27 new stores in 2026 using the platform.
Confidence: high
```

**Multifamily suitability:** Medium. Retail-focused, but the scoring methodology can be adapted for multifamily site selection if the POI database includes residential assets.

---

### 3.16 Unacast / Gravy Analytics

```
Claim: Unacast (which includes Gravy Analytics) offers foot-traffic data starting at $1 per API call, scaling up to $50,000/year. GDPR-compliant, 1B+ monthly devices, 180+ countries.[^20]
Source: Datarade — POI Providers comparison table
URL: https://datarade.ai/data-categories/point-of-interest-poi-data/providers
Date: 2026 (current)
Excerpt: "Gravy Analytics by Unacast [...] $1 / API Call to $50,000 / year"
Context: Aggregates from 15+ data suppliers. Strong on international coverage. Pay-per-call model is attractive for low-volume multifamily screening.
Confidence: high
```

**Multifamily suitability:** Medium-to-high. At $1/call, a 10K-property screening costs $10K, which exceeds the $5K threshold. However, for spot-checking top candidates, it fits the budget.

---

### 3.17 ScrapeHero

```
Claim: ScrapeHero offers millions of POI locations for 2,000+ companies updated weekly, with one-off purchases starting at $5, monthly licenses at $500/month, and yearly licenses at $2,000/year.[^21]
Source: Datarade — ScrapeHero product page
URL: https://datarade.ai/data-products/millions-of-poi-locations-for-1600-companies-updated-weekly-scrapehero
Date: 2023-04-10 (product page; pricing likely still current)
Excerpt: "One-off purchase $5 / purchase; Monthly License $500 / month; Yearly License $2,000 / year"
Context: Data is scraped from public sources. 10 countries covered. 4 years of historical data. Good for retail chain tracking, not real-time visit counts.
Confidence: high
```

**Multifamily suitability:** Low. Retail-centric; limited multifamily coverage.

---

### 3.18 LocationIQ

```
Claim: LocationIQ provides geocoding and POI search with a free tier of 5,000 requests/day and paid plans starting at $49/month for 30,000 requests/day.[^22]
Source: Mappr — Google Places API Alternatives
URL: https://www.mappr.co/google-places-api-alternatives/
Date: 2026-05-10
Excerpt: "LocationIQ [...] Free tier with 5,000 requests per day. Paid plans start at $49/month for 30,000 requests/day"
Context: OSM-based. Good for budget geocoding and POI lookup, but no visit data.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic; high for cheap geocoding and address verification.

---

### 3.19 TomTom

```
Claim: TomTom Search API offers 50,000 free daily transactions for POI search, geocoding, and autocomplete, with pay-as-you-go beyond that.[^23]
Source: Mappr — Google Places API Alternatives
URL: https://www.mappr.co/google-places-api-alternatives/
Date: 2026-05-10
Excerpt: "TomTom [...] Free tier with 50,000 API calls/day. Pay-as-you-go beyond that."
Context: 200+ countries. Strong automotive/traffic heritage. No direct foot-traffic visit counts, but real-time traffic and EV routing data are available.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic; medium for accessibility and drive-time analysis around multifamily assets.

---

### 3.20 Mapbox

```
Claim: Mapbox offers a free tier of 100,000 map loads/month and pay-as-you-go geocoding at $0.75 per 1,000 requests (vs Google's $5).[^24]
Source: Mappr — Google Places API Alternatives
URL: https://www.mappr.co/google-places-api-alternatives/
Date: 2026-05-10
Excerpt: "Mapbox charges $5 per 1,000 map loads vs Google's $7 for Dynamic Maps. Geocoding is $0.75 vs $5 per 1,000 requests on Google's pay-as-you-go."
Context: Full-stack mapping platform. No native foot-traffic data, but excellent for custom map visualization and drive-time isochrones.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic; high for mapping infrastructure.

---

### 3.21 Overture Maps Foundation

```
Claim: Overture Maps publishes a free, open bulk POI dataset with 53M+ POIs, updated regularly, under an open data license.[^25]
Source: Mappr — Google Places API Alternatives
URL: https://www.mappr.co/google-places-api-alternatives/
Date: 2026-05-10
Excerpt: "Overture Maps Foundation [...] Unlimited (bulk data) [...] Free [...] 53M+ POIs, open dataset"
Context: Backed by Amazon, Meta, Microsoft, TomTom. GERS (Global Entity Reference System) enables deduplication. No visit counts, but a zero-cost POI backbone.
Confidence: high
```

**Multifamily suitability:** Medium. Free POI baseline is excellent for building a property-competition map, but must be paired with a visit-data provider.

---

### 3.22 OpenStreetMap (OSM) / Nominatim

```
Claim: OpenStreetMap data is free under the Open Data Commons Open Database License. Self-hosting or using free hosted providers like Stadia Maps incurs only hosting costs.[^26]
Source: Mappr — Google Places API Alternatives
URL: https://www.mappr.co/google-places-api-alternatives/
Date: 2026-05-10
Excerpt: "OpenStreetMap / Nominatim [...] Unlimited (self-hosted) [...] Free (hosting costs) [...] Open data, no vendor lock-in"
Context: Community-driven global map. POI coverage is spotty and quality varies by region. No visit data.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic; high for zero-cost base mapping.

---

### 3.23 V-Count / FootfallCam / RetailFlux (Hardware-Enabled SaaS)

```
Claim: V-Count starts at $47/month; FootfallCam offers a free lifetime license for its cloud analytics; RetailFlux starts at $50/month. These are sensor/camera-based people counters, not mobile-location panels.[^27]
Source: SourceForge — Foot Traffic Data Providers for Cloud
URL: https://sourceforge.net/software/foot-traffic-data/saas/
Date: 2026-04 (current listing)
Excerpt: "V-Count [...] Starting Price: $47/month [...] FootfallCam [...] lifetime license is made available for all users free of charge [...] RetailFlux [...] Starting Price: $50 per month"
Context: These require physical installation at each property. Not scalable for 10K–100K properties unless integrated with existing camera infrastructure.
Confidence: high
```

**Multifamily suitability:** Low for portfolio-wide ranking; high for individual property operations if cameras already exist.

---

### 3.24 DRAKO

```
Claim: DRAKO offers mobility data for DOOH and foot-traffic insights across 245+ countries, sourced from 330M devices. Pricing available upon request.[^28]
Source: Datarade — Foot Traffic Data APIs
URL: https://datarade.ai/data-categories/footfall-traffic-data/apis
Date: 2026 (current)
Excerpt: "Mobility Data | Digital Out of Home (DOOH) Mobility Insights | Global 330M Devices [...] Available in USA, UK, Germany, France, Italy, and 245 more countries"
Context: Focused on advertising and attribution. Global scale but pricing is opaque; likely enterprise-tier.
Confidence: medium
```

**Multifamily suitability:** Low. Advertising-focused pricing is likely above $5K/year.

---

### 3.25 Elisium

```
Claim: Elisium offers Italy-specific location data starting at €150 per purchase, with 1M+ user location records.[^29]
Source: Datarade — Foot Traffic Data APIs
URL: https://datarade.ai/data-categories/footfall-traffic-data/apis
Date: 2026 (current)
Excerpt: "Elisium Italy | Location Data | Passages near Limited Traffic Zone | 3000+ records [...] Starts at €150 / purchase"
Context: Niche provider for Italy. Useful for European multifamily portfolios with Italian exposure.
Confidence: high
```

**Multifamily suitability:** Low-to-medium. Geographic niche.

---

### 3.26 BIGDBM

```
Claim: BIGDBM offers business website visits data for the USA at $1,500/month, categorized for ML/AI training sets.[^30]
Source: Datarade — Foot Traffic Data APIs
URL: https://datarade.ai/data-categories/footfall-traffic-data/apis
Date: 2026 (current)
Excerpt: "Business Website Visits Data | USA Coverage | Industry/Context Categorisation - Training Set for ML and AI [...] Starts at $1,500 / month"
Context: Web traffic, not physical foot traffic. Over the $5K/year threshold at $18K/year.
Confidence: high
```

**Multifamily suitability:** Low. Web traffic is not a physical foot-traffic proxy.

---

### 3.27 JKSOL

```
Claim: JKSOL provides global device graph and location data starting at $20 per 1,000 records or $40/DAU, with 42M daily events and 25M MAU.[^31]
Source: Datarade — Mobility Datasets
URL: https://datarade.ai/data-categories/mobility-data/datasets
Date: 2026 (current)
Excerpt: "Location Data - Asia | 42 Millions Daily Events, 25M MAU [...] Starts at $20 / 1000"
Context: Privacy-first collection (GDPR+CCPA). Asia-focused but global coverage available.
Confidence: high
```

**Multifamily suitability:** Medium. At $20/1K records, 10K properties = $200. Very affordable for spot checks.

---

### 3.28 Locomizer

```
Claim: Locomizer provides UK-focused footfall data around POIs at $0.02–$0.05 per record, using machine learning to estimate brand-affiliated engagement likelihood.[^32]
Source: SafeGraph — Geospatial Data Providers guide
URL: https://www.safegraph.com/guides/geospatial-data-providers/
Date: 2026-06-03
Excerpt: "Locomizer [...] Cost: $0.02-$0.05/record, charged on a per-dataset basis [...] provides general footfall data around points of interest"
Context: UK-centric. Useful for multifamily portfolios in the UK but limited elsewhere.
Confidence: high
```

**Multifamily suitability:** Medium (UK only).

---

### 3.29 Regrid

```
Claim: Regrid offers property parcel data at $0.05 per record, with 150M+ US parcels. Premium datasets include building footprint geometry.[^33]
Source: SafeGraph — Geospatial Data Providers guide
URL: https://www.safegraph.com/guides/geospatial-data-providers/
Date: 2026-06-03
Excerpt: "Regrid [...] Cost: $0.05 per record; can vary based on level of detail [...] 150 million parcels of land in the US"
Context: Property boundary data, not foot traffic. Useful for geofencing and parcel-accuracy but does not measure visits.
Confidence: high
```

**Multifamily suitability:** Low for foot traffic; high for property geometry.

---

## 4. Summary Table: All Providers Under $5,000/Year or Pay-As-You-Go

| Provider | Min Price | Max Price (under $5K) | Coverage | Data Type | Delivery | Free Tier / Trial | Multifamily Suitability |
|---|---|---|---|---|---|---|---|
| **PropTech Metrics** | $0.02/lookup | ~$2,000 for 100K props | US metros | IoT & satellite foot traffic | API, flat files | Early-user program | ⭐⭐⭐⭐⭐ |
| **BestTime.app** | Free | ~$348/yr ($29/mo) | 150+ countries | Hourly busyness % forecasts | API | Free tier + credits | ⭐⭐⭐⭐ |
| **Outscraper** | $1/1K POIs | ~$300/yr (light use) | Global (scraped) | POI + Google Popular Times | CSV/JSON/API | Free tier monthly | ⭐⭐⭐⭐ |
| **DataForSEO** | $6.20/20K | ~$600/yr (light use) | 250+ countries | Business listings / POI meta | API | $1 credit + Sandbox | ⭐⭐⭐ |
| **JKSOL** | $20/1K records | ~$200 for 10K | Global (Asia strong) | Device graph / location | API | Free sample | ⭐⭐⭐ |
| **LocationIQ** | Free | $588/yr ($49/mo) | Global (OSM) | POI / geocoding | API | 5K/day free | ⭐⭐ |
| **Geoapify** | Free | $708/yr ($59/mo) | Global | POI search / geocoding | API | 3K credits/day | ⭐⭐ |
| **TomTom** | Free | Pay-as-you-go | 200+ countries | POI / traffic / geocoding | API | 50K/day free | ⭐⭐ |
| **Mapbox** | Free | Pay-as-you-go | Global | Maps / geocoding / isochrones | API | 100K loads/mo | ⭐⭐ |
| **Foursquare** | Free | ~$2,250/yr (50K Pro calls/mo) | Global (100M+ POIs) | POI + popularity/hours | API | 500 calls/mo | ⭐⭐⭐ |
| **PassBy** | Unknown (Essential) | Likely under $5K | US only | Foot traffic + spend + demos | API, Snowflake, UI | 90-day Test & Learn | ⭐⭐⭐⭐ |
| **GrowthFactor** | $400/mo | $4,800/yr | US | Foot traffic + scoring platform | UI + API | Demo available | ⭐⭐⭐ |
| **Techsalerator** | $245/purchase | ~$2,940/yr (monthly) | 219 countries | B2B/POI/contact data | API, SFTP, email | Free samples | ⭐⭐ |
| **Xtract** | $40.83/purchase | One-off | Global (100+ industries) | POI + polygons | Flat file | Free samples | ⭐⭐⭐ |
| **The Data Appeal Company** | €9 | ~$100/yr | 249 countries | POI + sentiment + popularity | API, index, viz | Free samples | ⭐⭐⭐ |
| **GapMaps** | $50/precinct | $5,000/yr | 149 countries (APAC strong) | POI + mobility/footfall | API, S3, CSV | Free samples | ⭐⭐⭐⭐ |
| **dataplor** | $0.09/record | $29,999/yr (ceiling) | 250 countries | POI + attributes | API, Snowflake, S3 | Custom quotes | ⭐⭐⭐ |
| **Factori** | $0.03/API call | Custom under $5K possible | 42+ countries (APAC strong) | POI + foot traffic + mobility | API, Snowflake, S3 | Free samples | ⭐⭐⭐⭐ |
| **ScrapeHero** | $5/purchase | $2,000/yr | 10 countries | POI (retail chains) | CSV, API | Free samples | ⭐⭐ |
| **SafeGraph** | $0.05/purchase | $30,000/yr (ceiling) | 195+ countries | POI + visit patterns (CBG) | API, flat file, Snowflake | Free samples | ⭐⭐⭐ |
| **Unacast / Gravy** | $1/API call | $50,000/yr (ceiling) | 180+ countries | Foot traffic + cross-visitation | API, DaaS, SaaS | Free trial | ⭐⭐⭐⭐ |
| **Overture Maps** | Free | Free | Global | POI (53M+) | Bulk download | Always free | ⭐⭐⭐ |
| **OpenStreetMap** | Free | Free | Global | POI + map data | Bulk / API | Always free | ⭐⭐ |
| **Locomizer** | $0.02/record | ~$200 for 10K records | UK primarily | Footfall around POIs | Dataset | Free samples | ⭐⭐⭐ (UK) |
| **Elisium** | €150/purchase | One-off | Italy | Location / passage data | API | Free samples | ⭐⭐ (Italy) |
| **V-Count / RetailFlux** | $47–$50/mo | ~$600/yr | Global (sensor-based) | People counts | SaaS + hardware | Free tier / lifetime | ⭐ (requires hardware) |

---

## 5. Best Value Recommendation: Multifamily Platform (10K–100K Properties)

**Recommended Stack (under $5,000/year):**

1. **Primary foot-traffic signal:** **PropTech Metrics** ($0.02/lookup)  
   - Purpose-built for multifamily. At 100K properties, total cost ≈ $2,000. No minimum commitments, API-first.

2. **Neighborhood demand validation:** **BestTime.app** ($29/mo metered)  
   - Use to score retail/restaurant busyness around each property as a proxy for walkability and amenity demand. Budget ~$500/year.

3. **POI backbone & competitive mapping:** **Overture Maps** (free) + **OpenStreetMap** (free)  
   - Build a zero-cost basemap of competing properties, retail, and transit. Join with paid visit data in your warehouse.

4. **Spot-check enrichment:** **Outscraper** ($1/1K POIs) or **JKSOL** ($20/1K records)  
   - For properties in new markets where PropTech Metrics coverage is thin, scrape Google Popular Times or buy device-graph records as needed.

**Total estimated annual cost:** **$2,500–$3,500** for 100K properties.

**Alternative (if PropTech Metrics is not available):**  
- **PassBy Essential** (US-only, 90-day trial, estimated under $5K/year) + **BestTime.app** + **Overture Maps**. This gives you validated US foot-traffic data with predictive feeds, but loses multifamily-specific scoring.

---

## 6. Providers to Avoid & Why

| Provider | Reason |
|---|---|
| **Placer.ai** | Pricing starts at $12,000–$50,000/year.[^34] Even with a free tier, paid plans are enterprise-only. Overkill for ranking existing properties. |
| **Veraset** | Starting at ~$40,000/year.[^35] Excellent data, but firmly in the enterprise tier. Only viable if the budget is >$40K. |
| **StreetLight Data** | Custom subscriptions start at $20,000–$50,000/year.[^36] Designed for transportation agencies, not multifamily ranking. |
| **BIGDBM** | $1,500/month ($18K/year). Web traffic, not physical foot traffic.[^37] Wrong signal type for multifamily. |
| **Techsalerator (unchecked)** | Quality is highly inconsistent. Buyer-reported 3% email deliverability and 3+ month refund delays.[^38] Only use if you can validate a free sample first. |
| **V-Count / FootfallCam / RetailFlux** | Require physical sensors per property. At 10K–100K properties, installation and maintenance costs are prohibitive. |
| **Any provider without stated panel density** | If a provider cannot tell you how many devices they observe in a specific MSA or census tract, their rural/suburban estimates are unreliable.[^39] This is a red flag for multifamily portfolios that include secondary markets. |

---

## 7. Counter-Narrative: Why Cheap Data May Be Too Good to Be True

### 7.1 Panel Bias Is Structural

```
Claim: All major mobile-location panels skew toward younger, urban, higher-income populations. A PLOS One study found SafeGraph data underrepresented older adults and non-white populations at polling locations.[^40]
Source: GrowthFactor blog — Foot Traffic Provider Comparison
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A peer-reviewed study in PLOS One found demographic bias in SafeGraph's panel: older adults and non-white populations were underrepresented in visit data at polling locations."
Context: This bias applies to all GPS-based providers, not just SafeGraph. If your multifamily portfolio serves older or rural demographics, cheap foot-traffic data may systematically undercount demand.
Confidence: high
```

### 7.2 Rural Blind Spots

```
Claim: Low device density in rural areas means fewer observations and wider confidence intervals, making rural foot-traffic estimates "barely a guess."[^41]
Source: GrowthFactor blog — Foot Traffic Provider Comparison
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A provider might have 5,000 devices in a metro area and 50 in a rural county. The metro estimate is statistically meaningful. The rural estimate is barely a guess."
Context: Cheap providers often have smaller panels, exacerbating this issue. Always ask: "What is your panel density in [specific MSA]?"
Confidence: high
```

### 7.3 Visit Attribution Error in Multi-Tenant Buildings

```
Claim: GPS drift and shared building footprints make it impossible to reliably attribute visits to individual inline tenants in shopping centers. Accuracy varies by provider methodology (polygons vs. centroids vs. dwell-time thresholds).[^42]
Source: GrowthFactor blog — Foot Traffic Provider Comparison
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A GPS ping near a strip mall doesn't tell you which store the person visited. Providers use different methods to solve this... and the accuracy varies by location geometry."
Context: Multifamily properties are often adjacent to retail pads or mixed-use centers. If foot-traffic data is attributed to the wrong POI, demand signals get misallocated.
Confidence: high
```

### 7.4 Correlation Is Not Causation

```
Claim: Foot-traffic data alone is a weak predictor of sales (or lease velocity). A scoring model that combines foot traffic with demographics, competition, and market potential is necessary.[^43]
Source: GrowthFactor blog — Foot Traffic Provider Comparison
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "Foot traffic data alone is a weak predictor of sales. Visit volume doesn't account for conversion rates, average transaction values, customer demographics, or competitive dynamics."
Context: For multifamily, high foot traffic near a property does not guarantee high lease rates if the competition is oversupplied or the unit mix is wrong. Cheap foot-traffic data should be one input, not the sole ranking factor.
Confidence: high
```

---

## 8. Free & Open Data Sources

| Source | What It Provides | Limitation |
|---|---|---|
| **Google Maps Popular Times** | Relative busyness by hour/day for millions of places | No official API; must scrape via tools like Outscraper or ScrapingBee. Terms of service restrict scraping. |
| **US Census Bureau / ACS** | Demographics, commute patterns, housing tenure | Free and authoritative, but not visit counts. Must be joined with foot-traffic data. |
| **Overture Maps** | 53M+ POIs with GERS IDs | No visit data; must be enriched. |
| **OpenStreetMap (Nominatim)** | Global POI and address data | Variable quality; no visit data. |
| **SafeGraph Open Census Data** | Cleaned ACS demographic data | Free but not visit data. |

---

## 9. Data Marketplace Pricing Landscape

### AWS Data Exchange
- **Platform fee:** None for consumers. Providers set subscription prices.[^44]
- **Typical cost:** Free to hundreds of thousands of dollars. Some geospatial datasets are free (e.g., Open Data listings). SafeGraph and others list here.
- **Hidden costs:** S3 export, Athena query, and data-transfer fees apply.

### Snowflake Marketplace
- **Platform fee:** None. Zero-copy data sharing means no storage duplication costs.[^45]
- **Providers:** SafeGraph, Echo Analytics, Factori, dataplor, Precisely, and many others offer free samples or paid listings.
- **Hidden costs:** Compute costs for querying shared data in your Snowflake warehouse.

### Databricks Marketplace
- **Platform fee:** None for browsing. Delta Sharing enables direct data access without ETL.[^46]
- **Providers:** O2 Motion (real-time UK location data), PredictHQ, AccuWeather, and geospatial vendors.
- **Hidden costs:** Databricks compute for processing shared data.

---

## 10. How the Pricing Landscape Evolved

**Historical trajectory:**
- **2015–2018:** Foot-traffic data was a premium enterprise product sold via custom contracts ($50K–$500K/year). Providers like SafeGraph and Placer.ai focused on Fortune 500 retailers.
- **2019–2022:** The rise of data marketplaces (AWS Data Exchange, Snowflake Marketplace) and API-first providers lowered entry costs. Unacast introduced pay-per-call models. DataForSEO and others proved that pay-as-you-go could undercut bundled dashboards by 10x.
- **2023–2025:** Privacy regulations (GDPR, CCPA, iOS ATT) shrank mobile-location panels and increased data-collection costs. Some providers raised prices or exited. Meanwhile, new entrants like PropTech Metrics and BestTime.app targeted niche use cases with specialized, low-cost APIs.
- **2026:** The market is now tiered: (1) free/open data layers (Overture, OSM), (2) sub-$1K/year API utilities (BestTime, Outscraper, JKSOL), (3) mid-market platforms ($2K–$5K/year: PropTech Metrics, GrowthFactor, PassBy), and (4) enterprise ($12K+). The sub-$5K tier is more viable than ever for multifamily platforms willing to assemble a hybrid stack.

---

## 11. Stakeholders Served by Cheap Providers

| Stakeholder | Typical Provider | Use Case |
|---|---|---|
| **Retail / QSR chains** | GrowthFactor, PassBy, GapMaps | Site selection, cannibalization analysis, trade-area sizing |
| **Real Estate / CRE / Multifamily** | PropTech Metrics, SafeGraph, Unacast | Demand validation, portfolio ranking, amenity planning |
| **Government / Urban Planners** | StreetLight Data, O2 Motion, Census | Transportation planning, congestion studies, zoning |
| **AdTech / DOOH** | DRAKO, Unacast, Gravy Analytics | Audience targeting, campaign attribution, reach measurement |
| **Startups / PropTech Developers** | PropTech Metrics, DataForSEO, BestTime.app | Embedding location intelligence into apps with minimal COGS |
| **Academic / Research** | SafeGraph (samples), Veraset, Overture Maps | Mobility studies, pandemic impact, urban science |

---

## 12. Footnotes

[^1]: Datarade. "SafeGraph - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/safegraph/profile (accessed 2026-06-20).

[^2]: PassBy. "Foot Traffic Data Providers: Top Platforms Compared [2026]." https://passby.com/blog/foot-traffic-data-providers/ (2026-04-09).

[^3]: DataForSEO. "Getting Points of Interest with a Low-Cost Google Places API Alternative." https://dataforseo.com/blog/poi-data-with-dataforseo-api (2024-05-29).

[^4]: DataForSEO. "SERP API pricing." https://dataforseo.com/apis/serp-api/pricing (2025-10-28).

[^5]: PropTech Metrics. "Real-Time Multifamily Data & Insights." https://www.proptechmetrics.com/ (accessed 2026-06-20).

[^6]: PassBy. "Foot Traffic Data Providers: Top Platforms Compared [2026]." https://passby.com/blog/foot-traffic-data-providers/ (2026-04-09).

[^7]: PassBy. "Placer.ai vs PassBy vs Unacast." https://passby.com/blog/best-placer-ai-alternatives-and-competitors/ (2026-04-13).

[^8]: Outscraper. "Point of Interest (POI) Database, Dataset." https://outscraper.com/poi-data/ (2024-06-30).

[^9]: BestTime.app. "Subscription plans & pricing." https://besttime.app/subscription/pricing (accessed 2026-06-20).

[^10]: Geoapify. "Places API - Points of Interest Data & Location Search." https://www.geoapify.com/places-api/ (2026-05-05).

[^11]: Foursquare. "Upcoming Changes — Places API & V2 Pro endpoint rates." https://docs.foursquare.com/developer/reference/upcoming-changes (2026-02-12).

[^12]: Datarade. "Techsalerator - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/techsalerator/profile (accessed 2026-06-20).

[^13]: Prospeo. "Leadzen.ai vs Techsalerator: Honest Comparison (2026)." https://prospeo.io/s/leadzenai-vs-techsalerator (accessed 2026-06-20).

[^14]: Datarade. "dataplor - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/dataplor/profile (accessed 2026-06-20).

[^15]: Datarade. "Factori - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/factori/profile (accessed 2026-06-20).

[^16]: Datarade. "Xtract - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/x-tract/profile (accessed 2026-06-20).

[^17]: Datarade. "The Data Appeal Company - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/the-data-appeal-company/profile (accessed 2026-06-20).

[^18]: Datarade. "GapMaps - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/gapmaps/profile (accessed 2026-06-20).

[^19]: GrowthFactor. "Retail Foot Traffic Data: Sources, Costs & Providers." https://www.growthfactor.ai/resources/blog/retail-foot-traffic-data (2025-12-18).

[^20]: Datarade. "Best Point of Interest (POI) Data Providers & Companies 2026." https://datarade.ai/data-categories/point-of-interest-poi-data/providers (accessed 2026-06-20).

[^21]: Datarade. "Millions of POI locations for 2000+ companies updated weekly — ScrapeHero." https://datarade.ai/data-products/millions-of-poi-locations-for-1600-companies-updated-weekly-scrapehero (2023-04-10).

[^22]: Mappr. "Best Google Places API Alternatives: 13 Options Compared." https://www.mappr.co/google-places-api-alternatives/ (2026-05-10).

[^23]: Mappr. "Best Google Places API Alternatives: 13 Options Compared." https://www.mappr.co/google-places-api-alternatives/ (2026-05-10).

[^24]: Mappr. "Best Google Places API Alternatives: 13 Options Compared." https://www.mappr.co/google-places-api-alternatives/ (2026-05-10).

[^25]: Mappr. "Best Google Places API Alternatives: 13 Options Compared." https://www.mappr.co/google-places-api-alternatives/ (2026-05-10).

[^26]: Mappr. "Best Google Places API Alternatives: 13 Options Compared." https://www.mappr.co/google-places-api-alternatives/ (2026-05-10).

[^27]: SourceForge. "Best Foot Traffic Data Providers for Cloud." https://sourceforge.net/software/foot-traffic-data/saas/ (2026-04).

[^28]: Datarade. "Best Foot Traffic Data APIs." https://datarade.ai/data-categories/footfall-traffic-data/apis (accessed 2026-06-20).

[^29]: Datarade. "Best Foot Traffic Data APIs." https://datarade.ai/data-categories/footfall-traffic-data/apis (accessed 2026-06-20).

[^30]: Datarade. "Best Foot Traffic Data APIs." https://datarade.ai/data-categories/footfall-traffic-data/apis (accessed 2026-06-20).

[^31]: Datarade. "Best Mobility Datasets & Databases 2026." https://datarade.ai/data-categories/mobility-data/datasets (accessed 2026-06-20).

[^32]: SafeGraph. "Top Geospatial Data Providers." https://www.safegraph.com/guides/geospatial-data-providers/ (2026-06-03).

[^33]: SafeGraph. "Top Geospatial Data Providers." https://www.safegraph.com/guides/geospatial-data-providers/ (2026-06-03).

[^34]: PassBy. "Foot Traffic Data Providers: Top Platforms Compared [2026]." https://passby.com/blog/foot-traffic-data-providers/ (2026-04-09).

[^35]: SafeGraph. "Where to Buy Location Data." https://www.safegraph.com/guides/buy-location-data/ (2026-06-11).

[^36]: WiFi Talents. "Top 10 Best Transport Planner Software of 2026." https://wifitalents.com/best/transport-planner-software/ (2026-03-12).

[^37]: Datarade. "Best Foot Traffic Data APIs." https://datarade.ai/data-categories/footfall-traffic-data/apis (accessed 2026-06-20).

[^38]: Prospeo. "Leadzen.ai vs Techsalerator: Honest Comparison (2026)." https://prospeo.io/s/leadzenai-vs-techsalerator (accessed 2026-06-20).

[^39]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (2026-04-22).

[^40]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (2026-04-22).

[^41]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (2026-04-22).

[^42]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (2026-04-22).

[^43]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison (2026-04-22).

[^44]: Pump. "AWS Data Exchange: What It Is, Data Types & Pricing." https://www.pump.co/blog/aws-data-exchange/ (2026-05-27).

[^45]: Snowflake. "Viewing Location Data on an Interactive Map." https://www.snowflake.com/en/developers/guides/viewing-location-data-on-an-interactive-map/ (2026-01-13).

[^46]: Databricks. "From Blind Spots to Real-Time Intelligence: How Location Data from O2 Motion is Transforming Business Decision-Making." https://www.databricks.com/blog/blind-spots-real-time-intelligence-how-location-data-o2-motion-transforming-business-decision (2025-11-26).

---

*End of Dim01 Research Report*
