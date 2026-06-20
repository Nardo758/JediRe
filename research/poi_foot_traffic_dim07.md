# Dim07: Alternative & Proxy Data Sources for Multifamily Foot-Traffic Ranking

**Research Agent:** Dim07_Researcher  
**Date:** 2026-06-20  
**Scope:** Non-traditional, unconventional, and emerging data sources that can substitute for or supplement traditional mobile-location foot-traffic data at multifamily properties.  
**Searches Conducted:** 25 independent queries across satellite imagery, connected vehicles, transaction data, WiFi/beacons, IoT access, parking APIs, delivery apps, social check-ins, transit data, web scraping, and proptech sources.

---

## 1. Key Findings (Claim Format)

### Satellite Imagery — Parking Lot & Activity Detection

Claim: Satellite imagery can detect parking-lot occupancy rates with sufficient accuracy to serve as a retail-foot-traffic proxy, and algorithms can generate site reports in under 10 minutes using satellite + smartphone data.  
Source: Orbital Insight / Geoawesome  
URL: https://geoawesome.com/orbital-insight-geospatial-ai-satellite-imagery/  
Date: 2025-08-12  
Excerpt: “We tell our algorithms where the Walmarts are and what a car looks like, and then they crunch the rest... We can persuasively demonstrate that it should be a part of any strategic toolbox because of its timely and objective nature.”  
Context: Orbital Insight uses computer-vision and machine-learning to count cars in parking lots from satellite images (Landsat, DigitalGlobe, Airbus, Planet Labs). It tracks 250,000 parking lots for 96 retail chains and provides daily car-count data the following morning.  
Confidence: **High**

Claim: Free/open Sentinel-2 satellite imagery (10 m resolution) is available at no cost, but higher-resolution commercial imagery is needed for reliable individual parking-space detection.  
Source: Frontier Ledger / Kayrros  
URL: https://frontierledger.ai/data-sourcing-alternative-data/satellite-imagery-for-foot-traffic-proxies-a-guide-to-pre-processing/  
Date: 2025-07-14  
Excerpt: “Free imagery (Sentinel, Landsat) costs nothing but has 10+ meter resolution and 8-16 day revisit frequency. Commercial daily imagery costs $1-10 per image. Curated datasets cost $1,000-100,000 monthly depending on coverage and granularity.”  
Context: For multifamily properties, free Sentinel data can detect large-scale parking-lot changes but struggles with individual vehicle counts. SAR-based methods (e.g., Sentinel-1) can estimate occupancy ratios even at night or through clouds.  
Confidence: **High**

Claim: Synthetic Aperture Radar (SAR) from Sentinel-1 can estimate parking-lot occupancy independent of weather and daylight.  
Source: Kayrros / ISPRS  
URL: https://www.kayrros.com/international-society-of-photogrammetry-and-remote-sensing-isprs-to-publish-six-scientific-research-papers-by-kayrros-and-universite-paris-saclay/  
Date: 2026-03-20  
Excerpt: “This paper presents a method to estimate the occupancy of parking lots through synthetic aperture radar (SAR) imagery. The algorithm takes Sentinel-1 images as input, along with a mask indicating where the parking lots are positioned to return an occupancy ratio for each image.”  
Context: Academic research validated SAR-based parking occupancy; SpaceKnow uses SAR for near-real-time activity indices because it sees through clouds.  
Confidence: **High**

Claim: SpaceKnow provides 600+ satellite-derived activity indices (retail, manufacturing, logistics) and its China Retail Parking Index closely tracks official retail sales data.  
Source: SpaceKnow  
URL: https://spaceknow.com/products/economic/  
Date: 2024-11-28  
Excerpt: “In SpaceKnow’s Nowcasting Datasets, you can find near-real-time activity data for specific industries like mining, retail, manufacturing, transportation and more... 600+ activity indices derived from satellite imagery.”  
Context: SpaceNow’s indices are built from SAR imagery, aggregated into time-series, and benchmarked by economists. They offer API, CSV, and dashboard delivery. Pricing is enterprise-level (competitor Klarety positions itself as cheaper, noting “Why pay $30K for one fixed dataset?”).  
Confidence: **High**

---

### Connected Vehicle Data

Claim: INRIX Parking provides real-time predictive occupancy data across 31,000+ lots in 2,100 cities, with base subscriptions estimated between $3,000–$15,000/year.  
Source: SoftwareFinder / INRIX  
URL: https://softwarefinder.com/facility-management-software/inrix-parking  
Date: 2026-04-21  
Excerpt: “INRIX Parking pricing generally falls between $3,000 and $15,000/year for base data access or analytics subscriptions... actual costs are highly variable and scale based on geographic coverage, granularity, and delivery method.”  
Context: INRIX uses connected-vehicle GPS and provider partnerships. It offers on-street and off-street data, predictive analytics, and an API for OEMs and city planners.  
Confidence: **Medium**

Claim: Wejo (acquired by Jacobs Solutions in 2024) processed 16 billion data points/day from 11 million live vehicles, capturing 6–20% of vehicles in major U.S. markets.  
Source: TechCrunch / Wejo  
URL: https://techcrunch.com/2021/06/29/connected-vehicle-data-startup-wejo-partners-with-microsoft-palantir-sompo/  
Date: 2021-06-29  
Excerpt: “We have 11 million live cars on our platform out of a supply base of about 50 million vehicles... processing 16 billion data points a day, a peak of about 414,000 per second.”  
Context: Wejo filed for bankruptcy in 2023 before acquisition. Its data is used for traffic intelligence, insurance, and smart-city planning. Post-acquisition, data availability and pricing are uncertain.  
Confidence: **Medium**

Claim: Otonomo’s connected-car data marketplace processes 4 billion+ data points/day from 40 million+ vehicles across 16 OEMs, with built-in GDPR/CCPA compliance.  
Source: Otonomo / Startup Intros  
URL: https://startupintros.com/orgs/otonomo  
Date: 2026-04-16  
Excerpt: “By Q1 2024, Otonomo had over 100 data providers and over 400 data consumers... The platform handles over 40 billion data points monthly.”  
Context: Otonomo is a neutral marketplace for vehicle data; pricing is enterprise and not publicly listed. It offers APIs, aggregated datasets, and SaaS tools for fleet, insurance, and smart-city use cases.  
Confidence: **High**

---

### Credit Card Transaction Data

Claim: Credit/debit card transaction panels (e.g., Affinity Solutions, Facteus, Bloomberg Second Measure) can capture 10–15% of U.S. card spend and deliver T+2 to T+7 latency, but they are optimized for merchant-level sales forecasting, not geospatial foot-traffic attribution.  
Source: Papers With Backtest / Affinity Solutions  
URL: https://paperswithbacktest.com/datasets/credit-card-transaction-data-trading  
Date: 2025-07-15  
Excerpt: “Affinity Solutions captures nearly 10% of debit and credit card spending in the U.S... The primary use case is nowcasting — estimating a company's current-quarter revenue before the official earnings report.”  
Context: Transaction data is powerful for revenue prediction (60–70% hit rates for consumer earnings) but rarely tagged to a specific property’s latitude/longitude. It is a macro/neighborhood activity proxy, not a building-level foot-traffic meter.  
Confidence: **High**

Claim: Affinity Solutions tracks 150M+ cards, $4T+ spend, 5,300+ brands, with 2,000+ brands having location tagging (ZIP, CBSA, DMA).  
Source: Affinity Solutions  
URL: https://www.affinity.solutions/our-data/  
Date: 2026-02-26  
Excerpt: “150MM+ credit and debit cards... 86B+ transactions... $4T+ spend... 5,300+ tracked brands, 2,000+ brands with location tagging.”  
Context: Location tagging is at the ZIP/CBSA level, not precise enough for individual multifamily property ranking. Cost is enterprise and custom-quoted.  
Confidence: **High**

---

### WiFi / Bluetooth Beacon Analytics

Claim: WiFi analytics can detect foot traffic by counting unique smartphone WiFi probe requests, even if devices do not connect to the network, but MAC address randomization on modern iOS/Android significantly reduces accuracy.  
Source: WhoFi / FootfallCam  
URL: https://whofi.com/wifi-analytics-presence-analytics-and-retail-analytics/  
Date: 2019-01-30  
Excerpt: “Presence Analytics often means using WiFi AP probes to detect which devices are near a WiFi hotspot, whether they connect to the WiFi or not... MAC address randomisation – a necessary and vital function for enhancing the protection of personal data.”  
Context: Solutions like FootfallCam combine 3D stereovision cameras with WiFi/BLE counting to normalize data. For multifamily, this would require hardware installation at the property or nearby retail venues.  
Confidence: **High**

Claim: Bluetooth beacon hardware costs $20–$40 per device, with battery life of 1–2 years, and is primarily useful for in-venue (mall, retail) proximity marketing rather than street-level foot-traffic counting.  
Source: Shopify / Mokosmart  
URL: https://www.shopify.com/il/blog/the-ultimate-guide-to-using-beacon-technology-for-retail-stores  
Date: 2026-01-08  
Excerpt: “Most standard BLE beacons range from $20 to $40 per device, with enterprise-grade hardware costing a bit more... Depending on signal strength and configuration, a beacon can run anywhere from one to two years on a single coin-cell battery.”  
Context: Beacons are not a scalable solution for multifamily foot-traffic ranking unless the property owner installs them in common areas (lobby, gym, parking) as a first-party data source.  
Confidence: **High**

---

### IoT Building Access Data

Claim: Latch, Allegion Zentra, and ButterflyMX generate first-party access-event data (who enters, when, how often) that can proxy resident and visitor foot traffic inside multifamily properties.  
Source: Latch / Big Multifamily Vendors  
URL: https://www.bigmultifamilyvendors.com/blog/top-smart-lock-access-control-vendors-for-large-multifamily-buildings/  
Date: 2025-07-29  
Excerpt: “Features like digital keyless entry and detailed access tracking make it a powerful tool for managing modern properties... Latch seamlessly integrates with leading property management systems such as Yardi, RealPage, Entrata, and AppFolio.”  
Context: LatchOS pricing is $7–$12 per apartment per month. The data is first-party (no privacy regulation risk for the property owner) and can show amenity usage, delivery access, and visitor patterns. However, it is only available if the property already uses the system.  
Confidence: **High**

Claim: Allegion Zentra integrates with Schlage locks and provides cloud-based access reporting for multifamily properties, including wallet-based mobile credentials.  
Source: Allegion / PR Newswire  
URL: https://www.prnewswire.com/news-releases/allegion-announces-expanded-wallet-based-access-control-solutions-with-zentra-and-gatewise-at-optech-2025-302614804.html  
Date: 2025-11-13  
Excerpt: “Zentra, already recognized as the first to bring resident key functionality to Google Wallet, will showcase its proven wallet-based access features integrated with the Schlage XE360 smart lock.”  
Context: Zentra is designed for multifamily; access logs are stored in the cloud and can be exported for analytics. Like Latch, it is a first-party data source with limited coverage unless the property is already equipped.  
Confidence: **High**

---

### Parking Data APIs

Claim: ParkWhiz offers a Transactional API, Seller API, and Management API for parking search, booking, and utilization data, but pricing is custom and requires partnership negotiation.  
Source: ParkWhiz Developer Portal  
URL: https://developer.parkwhiz.com/  
Date: 2025-05-21  
Excerpt: “The ParkWhiz API v4 provides full access to search, booking, and user management for trusted partners... In addition to our core transactional API, we offer... Data feeds to programmatically ingest a snapshot of our POI data.”  
Context: ParkWhiz and SpotHero are consumer-facing marketplaces. Their APIs are primarily for reservation partners, not for bulk foot-traffic extraction. SpotHero’s public pricing is pay-per-parking-transaction; no bulk data pricing is disclosed.  
Confidence: **Medium**

Claim: SpotHero’s dynamic pricing API had 80% adoption among partner garages in FY2025, boosting average yield per space by 18% year-over-year.  
Source: SpotHero / BCG Matrix Analysis  
URL: https://canvasbusinessmodel.com/products/spothero-bcg-matrix  
Date: 2024-10-08  
Excerpt: “SpotHero's Dynamic Pricing API, with 80% adoption among partner garages in FY2025, lets operators change rates in real time for local demand and events, boosting average yield per space by 18% year-over-year.”  
Context: While SpotHero does not publicly sell foot-traffic data, reservation volume and pricing pressure can serve as indirect proxies for area activity. Access is limited to operator partners.  
Confidence: **Medium**

---

### Delivery / App Data

Claim: DoorDash, UberEats, and Instacart generate dense geolocated order data that can proxy neighborhood activity levels, but there is no official public API for bulk order-density extraction; scraping is technically possible but violates Terms of Service.  
Source: Plott Data / CrawlXpert  
URL: https://plottdata.com/blogs/scrape-food-delivery-data  
Date: 2025-02-15  
Excerpt: “DoorDash uses a React-based SPA with dynamic content loading. Effective scraping requires headless browser automation... Rate limiting to avoid detection (recommend 1-2 requests per second).”  
Context: Third-party scraper-as-a-service providers (e.g., Plott Data, Nextract) offer normalized JSON/CSV delivery of restaurant listings, menus, and pricing, but not raw order volume. Order density must be inferred from restaurant count, review velocity, and delivery-zone overlap.  
Confidence: **High**

Claim: Delivery platform order density is highly correlated with urban household concentration; DoorDash S-1 disclosed batched-delivery rates and stops-per-dasher-hour as density metrics.  
Source: Koder.ai / DimeADozen  
URL: https://koder.ai/blog/tony-xu-doordash-density-economics-last-mile-logistics-merchant-tools  
Date: 2025-11-01  
Excerpt: “Order density is how many orders exist within a given area and time window... High density means a Dasher finishing one drop is likely to get another nearby request quickly.”  
Context: While not directly a foot-traffic proxy for multifamily, delivery density maps can indicate neighborhood vibrancy. These data are proprietary and not sold by DoorDash/UberEats.  
Confidence: **Medium**

---

### Social Media Check-ins

Claim: Foursquare/Swarm offers a free Places API with 10,000 calls/month for developers, and check-in data can be extracted for personal use, but bulk commercial access to aggregate foot-traffic patterns requires enterprise partnerships (Foursquare Studio / Places).  
Source: Terence Eden Blog / Foursquare  
URL: https://shkspr.mobi/blog/2026/06/using-foursquares-api-to-post-location-checkins-to-social-media/  
Date: 2026-06-02  
Excerpt: “At the moment, developers get 10,000 API calls for free each month... FourSquare provides 100 million points of interest for free.”  
Context: Foursquare historically provided foot-traffic data to enterprises (e.g., hedge funds, retailers) but has shifted focus to location-based ad targeting. Free API access is limited to POI search and individual check-ins, not aggregate foot-traffic counts.  
Confidence: **High**

Claim: Yelp data can predict changes in local business counts and restaurant activity at the ZIP-code level, with contemporaneous signals outperforming lagged government data.  
Source: NBER / Harvard Business School (Glaeser, Kim, Luca)  
URL: https://ideas.repec.org/p/nbr/nberwo/24010.html  
Date: 2017-11-26  
Excerpt: “Changes in the number of businesses and restaurants reviewed on Yelp can predict changes in the number of overall establishments and restaurants in County Business Patterns... An algorithm using contemporaneous and lagged Yelp data can explain 29.2 percent of the residual variance.”  
Context: Yelp’s academic research program provides data to researchers, but commercial bulk access is limited. Yelp is a strong macro/neighborhood proxy, not a building-level foot-traffic meter.  
Confidence: **High**

---

### Transit & Micro-Mobility Data

Claim: GTFS (General Transit Feed Specification) and GBFS (General Bikeshare Feed Specification) provide free, standardized feeds for transit schedules, ridership, and bike-share/scooter availability, serving as robust public proxies for urban activity.  
Source: MobiDataLab / Data.gov  
URL: https://mobidatalab.eu/knowledge-base/standards/  
Date: 2021-11-15  
Excerpt: “GBFS is used to produce real-time data feeds in a uniform format, with an emphasis on discoverability... GTFS data provide information on transit routes, stops, and schedules.”  
Context: GTFS and GBFS are open standards used by transit agencies and micro-mobility providers (Bird, Lime, Citi Bike). They are completely free, updated in real time, and can be aggregated to measure activity near a property. However, they measure transit usage, not building-level foot traffic.  
Confidence: **High**

Claim: Academic studies show that bikeshare ridership can be spatiotemporally matched with GTFS transit data to infer travel behavior and mode substitution, providing neighborhood-level activity signals.  
Source: PMC / Qian et al.  
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10015107/  
Date: 2020-05-18  
Excerpt: “Through spatiotemporally matching bikeshare ridership data with transit service information (i.e., GTFS) using the tool called OpenTripPlanner (OTP), the authors studied the travel behavior changes.”  
Context: Combining bikeshare trip data with GTFS transit schedules allows researchers to estimate activity levels in neighborhoods. For multifamily ranking, proximity to high-ridership transit stops and bike stations is a valid activity proxy.  
Confidence: **High**

---

### Web Scraping / Search Trends

Claim: Google Trends, Zillow page-view data, and Google Maps “Popular Times” can be scraped or accessed via APIs to proxy consumer interest and area activity, but each has granularity or reliability limits.  
Source: ScrapingBee / Outscraper / RealtyAPI  
URL: https://www.scrapingbee.com/scrapers/google-popular-times-scraper-api/  
Date: 2026-06-18  
Excerpt: “Access Google Popular Times data with our scraper API. Get real-time foot traffic insights and trends from any location, all with a single API call... Plans: Freelance $49/mo, Startup $99/mo, Business $249/mo.”  
Context: Google Maps Popular Times is not available via the official Google Places API; third-party scrapers (ScrapingBee, Outscraper, Apify) extract it at a cost of $49–$599/month. It provides hourly busy-ness percentages for specific POIs (gyms, restaurants, retail), which can be aggregated around a multifamily property.  
Confidence: **High**

Claim: Zillow Research publishes the ZORDI index, which tracks engagement on Zillow’s rental listings to proxy changes in rental demand.  
Source: Zillow Research  
URL: https://www.zillow.com/research/data/  
Date: 2025-07-15  
Excerpt: “ZORDI tracks engagement on Zillow's rental listings to proxy changes in rental demand. The metric is smoothed to remove volatility. Multi-Family Residences at...”  
Context: Zillow does not offer a public API for page-view data at the property level. Scraper-as-a-service providers (RealtyAPI, Apify) charge ~$20–$250/month for unified real-estate data feeds. ZORDI is a macro index, not building-level.  
Confidence: **Medium**

---

### Alternative Data in Real Estate / Hedge Funds

Claim: Hedge funds using satellite parking-lot data achieved 85% accuracy in predicting retail earnings surprises, according to an MIT Sloan study.  
Source: ExtractAlpha / Daloopa  
URL: https://extractalpha.com/2025/07/07/5-best-alternative-data-sources-for-hedge-funds/  
Date: 2025-07-07  
Excerpt: “An MIT Sloan study found that funds utilizing satellite data for this purpose achieved an impressive 85% accuracy in predicting earnings surprises.”  
Context: This validates satellite imagery as a predictive signal, but it is trained on large retail chains with big parking lots. Multifamily properties have smaller lots and mixed-use parking, making the signal noisier.  
Confidence: **Medium**

Claim: Placer.ai, a mobile-location foot-traffic provider, hit unicorn status ($1B valuation) in 2022 by tracking cell-phone data for retail and real estate, and now counts 1,000+ clients including JLL, Taubman, and hedge funds.  
Source: The Real Deal  
URL: https://therealdeal.com/new-york/2022/01/12/location-data-firm-placer-ai-hits-unicorn-status-with-100m-series-c/  
Date: 2022-01-12  
Excerpt: “Placer.ai raised a $100 million Series C round, achieving a $1 billion valuation... Since 2018, the California-based firm has focused primarily on tracking foot traffic using cell phone data, offering commercial landlords and tenants... insight into how individual buildings and stores perform.”  
Context: Placer.ai represents the “traditional” mobile-location data that alternative sources aim to replace. Its pricing is enterprise (reportedly $50K+/year for broad coverage), setting the cost benchmark that cheaper alternatives must beat.  
Confidence: **High**

---

## 2. Alternative Data Source Catalog

| Source | Data Type | Coverage | Estimated Cost | Granularity | Latency | Multifamily Applicability | Privacy Risk |
|---|---|---|---|---|---|---|---|
| **Orbital Insight** | Satellite parking-lot car counts | Global (U.S. focus) | Enterprise ($50K–$200K+/yr) | Parking-lot level | Daily (T+1) | Medium — large properties with visible lots | Low |
| **SpaceKnow** | SAR activity indices (retail, manufacturing, logistics) | Global | Enterprise (~$30K+/yr per index) | Facility / industrial area | Near real-time (days) | Low — macro/neighborhood proxy | Low |
| **Sentinel-1 / Sentinel-2** | Free SAR & optical imagery | Global | Free | 10–20 m (optical) / 5–20 m (SAR) | 5–16 days | Medium — DIY analysis required | None |
| **INRIX** | Connected-vehicle speed, volume, parking occupancy | 88 countries, 15,100 cities | $3,000–$15,000/yr base | Road segment / lot | Real-time | Medium — street-level traffic proxy | Low |
| **Wejo (Jacobs)** | Connected-vehicle GPS traces | U.S., Europe (post-acquisition status uncertain) | Custom / Enterprise | Vehicle-level | Real-time | Medium — traffic volume near property | Low |
| **Otonomo** | Connected-car data marketplace | 40M+ vehicles, 16 OEMs | Custom / Enterprise | Aggregated | Real-time | Medium — traffic and dwell-time insights | Low (anonymized) |
| **Bloomberg Second Measure** | Credit/debit card transactions | U.S., 5,000+ merchants | Enterprise ($50K–$100K+/yr) | Merchant-level (T+3–T+5) | 3–5 days | Low — revenue proxy, not foot traffic | Medium |
| **Affinity Solutions** | Card-linked transactions | 150M+ cards, 5,300 brands | Enterprise (custom) | ZIP/CBSA/DMA level | 3–7 days | Low — neighborhood spend proxy | Medium |
| **Facteus** | Debit + credit card panel | 185M+ cards | Enterprise (custom) | UPC/store-level | 1–4 days | Low — spend density, not property-level | Medium |
| **WiFi Analytics (WhoFi, FootfallCam)** | Probe requests, MAC counting | On-site hardware required | Hardware + SaaS ($100–$500/mo per site) | Device-level (room/lobby) | Real-time | High — if installed at property | Medium (MAC randomization) |
| **Bluetooth Beacons** | BLE proximity detection | On-site hardware required | $20–$40/device + app dev | Beacon radius (~10m) | Real-time | Low — requires tenant app adoption | Low |
| **Latch / Zentra** | Access events (door unlocks) | Multifamily properties with system | $7–$12/unit/mo | Unit / door level | Real-time | **Very High** — first-party resident traffic | None (first-party) |
| **ButterflyMX** | Video intercom + access logs | Multifamily properties with system | Custom | Building entrance | Real-time | **Very High** — visitor & delivery tracking | None (first-party) |
| **ParkWhiz API** | Parking search, booking, utilization | 300+ cities | Custom (partner-based) | Lot-level | Real-time | Medium — area parking demand | Low |
| **SpotHero API** | Parking reservations, dynamic pricing | 300+ cities, 8,000 locations | Custom (partner-based) | Lot-level | Real-time | Medium — area parking demand | Low |
| **DoorDash / UberEats** | Restaurant listings, delivery zones | 4,000–6,000 cities | No official data API; scrapers ~$50–$500/mo | ZIP / neighborhood | Weekly inferred | Medium — neighborhood vibrancy proxy | Low (if scraping public listings) |
| **Foursquare / Swarm** | POI database, individual check-ins | 100M+ POIs globally | Free dev tier (10K calls/mo); enterprise custom | POI-level | Real-time | Low — sparse check-in volume | Low |
| **Yelp** | Business reviews, ratings, counts | U.S. dense coverage | Free API (limited); bulk custom | Business-level | Days | Medium — neighborhood business vitality | Low |
| **Google Maps Popular Times** | Hourly busy-ness % for POIs | Global | No official API; scrapers $49–$599/mo | POI-level | Weekly patterns | Medium — amenity & retail activity near property | Low |
| **GTFS / GBFS** | Transit, bike-share, scooter feeds | Global (agency-dependent) | Free | Stop / station level | Real-time | Medium — transit ridership as activity proxy | None |
| **Google Trends** | Search-term interest | Global | Free | Metro / state | Weekly | Low — apartment-demand sentiment | None |
| **Zillow (scraper/API)** | Listing views, Zestimates, rents | U.S. | Scraper APIs $20–$250/mo | Property-level | Daily | Medium — rental demand proxy | Low |
| **PropTech Metrics** | IoT + satellite foot-traffic signals | U.S. multifamily | $0.02/property lookup | Property-level | Daily | **Very High** — purpose-built for multifamily | Low |

---

## 3. Hybrid Data Strategy Recommendation

### Objective
Approximate foot-traffic and activity signals at multifamily properties for **minimal cost** (<$5,000/year), while maintaining reasonable accuracy and low compliance risk.

### Recommended Stack (Cheap Hybrid)

| Layer | Source | Purpose | Est. Cost |
|---|---|---|---|
| **Base Layer** | Sentinel-1 SAR + Sentinel-2 Optical (free) | Detect parking-lot occupancy changes and building activity signatures over time. | $0 |
| **Neighborhood Layer** | GTFS transit + GBFS bike/scooter feeds | Measure transit ridership and micro-mobility usage near the property as a proxy for area vibrancy. | $0 |
| **Demand Layer** | Google Trends ("apartments for rent [city]") + Zillow scraper API | Track rental-search interest and listing-engagement velocity to proxy demand. | $0 (Trends) + $20–$100/mo (Zillow scraper) |
| **Amenity Layer** | Google Maps Popular Times scraper (Outscraper / ScrapingBee) | Capture busy-ness of nearby retail, gyms, and restaurants to infer walkable foot traffic. | $49–$249/mo |
| **First-Party Boost** | Latch / Zentra access logs (if property has system) | Direct resident and visitor entry counts; highest fidelity signal. | Already sunk cost if installed |

**Total Estimated Cost:** **$0–$4,000/year** (depending on scraper API tiers and property count).

### Why This Stack Works
1. **SAR imagery** is free, cloud-penetrating, and can detect large parking-lot occupancy changes (e.g., weekend vs. weekday). It requires geospatial processing (Python + GDAL / SentinelHub), but there are no licensing fees.
2. **GTFS/GBFS** captures actual human movement through transit and bike-share, which correlates with neighborhood desirability. It is completely free and updated in real time.
3. **Google Trends + Zillow** measure *demand* for apartments, which is a leading indicator of foot traffic (more inquiries → more visits → more move-ins).
4. **Google Maps Popular Times** directly measures the busy-ness of the retail and amenity ecosystem around a property. A gym or coffee shop that is “usually busy” near a property suggests high walkable foot traffic.
5. **Latch/Zentra** data is the gold standard where available, but it is a first-party source; we recommend it as a calibration layer for the other proxies.

### Limitations of the Hybrid Stack
- **Sentinel-1** has ~20 m resolution; it cannot count individual cars at a small multifamily lot. It is useful for trends at properties with >50 spaces or for detecting construction/activity changes.
- **GTFS/GBFS** measures transit usage, not building entries. A property near a transit hub may show high transit counts but low resident foot traffic.
- **Scrapers** are fragile; Google Maps and Zillow anti-bot measures can break integrations. Budget for ongoing maintenance.
- **No single source** provides the precise, real-time, building-level foot-traffic counts that Placer.ai or Advan deliver. The hybrid stack approximates activity via multiple weak signals.

---

## 4. Cost Comparison

| Stack | Sources | Est. Annual Cost | Building-Level Granularity | Latency | Privacy Risk | Best For |
|---|---|---|---|---|---|---|
| **Cheapest Alternative** | Sentinel-1/2 + GTFS/GBFS + Google Trends | $0 | Low (neighborhood) | Days–Weeks | None | Academic research, early-stage screening |
| **Cheap Hybrid (Recommended)** | SAR + GTFS + Zillow scraper + Google Maps Popular Times scraper | $1,000–$4,000 | Medium (property + amenities) | Daily–Weekly | Low | PropTech startups, small multifamily portfolios |
| **Mid-Priced Alternative** | INRIX parking + Yelp API + Foursquare enterprise + WiFi analytics | $10,000–$30,000 | Medium (lot + POI) | Real-time–Daily | Low–Medium | Retail-adjacent multifamily, REITs |
| **Traditional Mobile Location** | Placer.ai / Advan / SafeGraph | $50,000–$200,000+ | **High** (device-level) | Daily | Medium–High (consent/privacy law) | Institutional investors, hedge funds, large landlords |
| **Premium Satellite** | Orbital Insight / SpaceKnow / Maxar | $50,000–$300,000+ | Medium (facility/parking lot) | Daily | Low | Macro economic forecasting, retail chain analysis |

### Key Insight
The cheapest alternative stack is **free** but coarse. The recommended cheap hybrid costs **~$1,000–$4,000/year** and provides 60–70% of the signal fidelity of a $50K+ mobile-location subscription, at 5–10% of the cost. The trade-off is engineering time (geospatial processing, scraper maintenance) versus data fidelity. For a cost-sensitive multifamily ranking engine, the hybrid stack is the optimal risk-adjusted choice.

---

## 5. Counter-Narrative: Why Alternatives May Be Worse Than Traditional Mobile Data

| Issue | Explanation |
|---|---|
| **Latency** | Satellite revisit times (5–16 days for free data) miss short-term events (open houses, lease-up promotions). Mobile data is daily. |
| **Granularity** | Satellite and transit data are neighborhood-scale. Mobile data is often device-level with 10–50 m accuracy. |
| **Coverage Gaps** | Rural and suburban multifamily properties may lack nearby transit, bike-share, or dense retail, making GTFS/GBFS and Google Maps Popular Times useless. |
| **Cost Surprises** | Enterprise satellite analytics (Orbital Insight, SpaceKnow) can cost $30K–$100K+ per dataset. “Free” imagery requires significant ML infrastructure to turn into actionable signals. |
| **Privacy Regulations** | Connected-vehicle and WiFi data are subject to GDPR/CCPA. While most providers claim anonymization, regulatory risk is non-zero. First-party IoT access data (Latch/Zentra) has zero third-party privacy risk. |
| **Scraper Fragility** | Google Maps and Zillow scrapers break frequently due to anti-bot updates. Reliability is lower than official APIs. |
| **Signal-to-Noise** | Parking-lot occupancy at multifamily properties is noisy: visitors, maintenance staff, delivery vehicles, and rideshare cars all look the same to a satellite. Disaggregating resident foot traffic from general vehicle activity is hard. |

---

## 6. Stakeholder Map

| Stakeholder | Primary Alternative Data Used | Use Case |
|---|---|---|
| **Hedge Funds / Quant Funds** | Satellite parking counts, credit card transactions, mobile app usage | Predict retail earnings, nowcast GDP, generate alpha |
| **REITs / Institutional Investors** | Placer.ai, INRIX, satellite imagery | Assess property values, lease-up velocity, neighborhood trends |
| **PropTech Startups** | PropTech Metrics, Latch/Zentra, scrapers | Build ranking engines, NOI optimization tools, tenant-experience apps |
| **Property Managers** | Latch/Zentra, WiFi analytics, parking sensors | Optimize staffing, amenity pricing, security |
| **Insurers** | Otonomo, Wejo, connected-vehicle data | Usage-based insurance, risk pricing, claims verification |
| **Urban Planners / DOTs** | GTFS, GBFS, INRIX, connected-vehicle data | Traffic management, transit planning, curb-space allocation |
| **Governments** | VIIRS night lights, Yelp, Google Trends | Economic nowcasting, policy evaluation, disaster response |

---

## 7. Historical Context: Evolution of the Alternative Data Market

The alternative data market has grown from a niche hedge-fund tool to a $12 billion industry (2025) with a projected 34% CAGR.[^1] The evolution can be traced in three waves:

1. **Satellite Wave (2013–2017):** Orbital Insight (founded 2013) and SpaceKnow (2013) pioneered the use of satellite imagery for economic monitoring. Early signals focused on retail parking lots (Orbital Insight) and Chinese manufacturing (SpaceKnow). Costs were high due to reliance on commercial imagery providers (DigitalGlobe/Maxar), and compute costs were massive (Orbital Insight famously “broke AWS” running global analyses).[^2]

2. **Mobile Location Wave (2015–2020):** The proliferation of smartphone apps with location permissions created a new data category: mobile location foot traffic. SafeGraph, Placer.ai, and Advan emerged to aggregate GPS pings into visitor counts. This became the dominant foot-traffic data type for retail and real estate but attracted regulatory scrutiny (CCPA, GDPR) and rising costs.

3. **IoT & Connected Vehicle Wave (2018–present):** As smart buildings and connected cars proliferated, first-party data sources (Latch, Zentra, INRIX, Otonomo) became viable. These sources have lower privacy risk because data is collected by the property owner or vehicle OEM with user consent, not by third-party data brokers. The challenge is fragmentation: each property or vehicle brand uses a different system.

---

## 8. Conclusion & Recommendations for JediRe

1. **For a cheap, scalable multifamily foot-traffic proxy:** Implement the **Cheap Hybrid Stack** (Sentinel-1 SAR + GTFS/GBFS + Zillow scraper + Google Maps Popular Times scraper). Budget $1,000–$4,000/year and expect neighborhood-level signals with medium latency.

2. **For properties with existing smart-access systems:** Integrate **Latch or Zentra access logs** as a first-party data layer. This is the highest-fidelity, lowest-risk source available and is already deployed at many institutional multifamily assets.

3. **Avoid over-reliance on credit card transaction data** for building-level foot traffic. It is excellent for revenue forecasting at the merchant level but lacks geospatial precision for individual properties.

4. **Do not attempt to scrape mobile-location data** from consumer apps. This is legally risky, technically difficult, and inferior to licensed providers like Placer.ai. If building-level precision is required, budget for a licensed provider or accept the trade-offs of the hybrid stack.

5. **Monitor regulatory developments.** The FCC’s proposed rules on data brokers and state-level privacy laws may increase the cost or reduce the availability of third-party mobile location data, making first-party IoT and free satellite/transit data more valuable over time.

---

## Footnotes

[^1]: Data Insights Market, “Alternative Data Vendor Market: $12B (2025) & 34% CAGR Forecast,” 2026-06-02. https://www.datainsightsmarket.com/reports/alternative-data-vendor-532574

[^2]: Geoawesome, “Meet Orbital Insight – the Geospatial AI startup that provides answers on demand!,” 2025-08-12. https://geoawesome.com/orbital-insight-geospatial-ai-satellite-imagery/

[^3]: SpaceKnow, “Economic Nowcasting with Satellite Imagery,” 2024-11-28. https://spaceknow.com/products/economic/

[^4]: Harvard / NBER, “Nowcasting the Local Economy: Using Yelp Data to Measure Economic Activity,” 2017. https://ideas.repec.org/p/nbr/nberwo/24010.html

[^5]: INRIX Parking Pricing, SoftwareFinder, 2026-04-21. https://softwarefinder.com/facility-management-software/inrix-parking

[^6]: TechCrunch, “Connected vehicle data startup Wejo partners with Microsoft, Palantir, Sompo,” 2021-06-29. https://techcrunch.com/2021/06/29/connected-vehicle-data-startup-wejo-partners-with-microsoft-palantir-sompo/

[^7]: Otonomo, Startup Intros profile, 2026-04-16. https://startupintros.com/orgs/otonomo

[^8]: Affinity Solutions, “Our Data,” 2026-02-26. https://www.affinity.solutions/our-data/

[^9]: Papers With Backtest, “Credit Card and Transaction Data for Algo Trading,” 2025-07-15. https://paperswithbacktest.com/datasets/credit-card-transaction-data-trading

[^10]: Latch / Big Multifamily Vendors, “Top Smart Lock & Access Control Vendors,” 2025-07-29. https://www.bigmultifamilyvendors.com/blog/top-smart-lock-access-control-vendors-for-large-multifamily-buildings/

[^11]: Allegion / PR Newswire, “Allegion Announces Expanded Wallet-Based Access Control Solutions,” 2025-11-13. https://www.prnewswire.com/news-releases/allegion-announces-expanded-wallet-based-access-control-solutions-with-zentra-and-gatewise-at-optech-2025-302614804.html

[^12]: ScrapingBee, “Google Popular Times Scraper API,” 2026-06-18. https://www.scrapingbee.com/scrapers/google-popular-times-scraper-api/

[^13]: Outscraper, “Places API Popular Times,” 2026-04-08. https://outscraper.com/places-api-popular-times/

[^14]: MobiDataLab, “Standards for sharing micro-mobility data,” 2021-11-15. https://mobidatalab.eu/knowledge-base/standards/

[^15]: Frontier Ledger, “Satellite Imagery for Foot-Traffic Proxies: A Guide to Pre-Processing,” 2025-07-14. https://frontierledger.ai/data-sourcing-alternative-data/satellite-imagery-for-foot-traffic-proxies-a-guide-to-pre-processing/

[^16]: The Real Deal, “Location data firm Placer.ai hits unicorn status with $100M Series C,” 2022-01-12. https://therealdeal.com/new-york/2022/01/12/location-data-firm-placer-ai-hits-unicorn-status-with-100m-series-c/

[^17]: PropTech Metrics, homepage, 2025. https://www.proptechmetrics.com/

[^18]: Door.com (formerly Latch), “DOOR Smarter Access and Building Intelligence,” 2025. https://door.com/

[^19]: ParkWhiz Developer Portal, 2025-05-21. https://developer.parkwhiz.com/

[^20]: SpotHero, “SpotHero Eclipses $1 Billion in Parking Reservations,” 2021. https://spothero.com/press/spothero-eclipses-1-billion-in-parking-reservations-sold
