# Dim03: Multifamily Property Address & Geocoding Databases

## Deep-Dive Research Report
**Date:** 2026-06-20  
**Researcher:** Dim03_Researcher  
**Purpose:** Identify and evaluate all sources for comprehensive multifamily property address databases, geocoding services, and property attribute data to serve as the "property side" of a foot-traffic data marriage.

---

## Executive Summary

To marry foot-traffic data to multifamily properties, you need a **clean, geocoded property database** as the left side of the join. This report evaluates commercial providers, government sources, proptech platforms, geocoding services, address normalization tools, and open data sources. The cheapest viable path to a comprehensive multifamily property database with geocoding for a 10K–100K property platform is a **hybrid stack**: Datafiniti or BatchData for base property records + Geocodio or US Census Geocoder for batch geocoding + Smarty for address validation, totaling roughly **$500–$2,000/month** at scale. Commercial all-in-one platforms like CoStar or Reonomy offer superior coverage but cost **$4,800–$30,000+/year per user**. Building entirely from open sources is possible but requires 6–12 months of engineering time and yields incomplete rural coverage.

---

## 1. Commercial Real Estate Data Providers

### 1.1 CoStar Group / Apartments.com

Claim: CoStar tracks 38 million multifamily units nationwide with 16 million monthly rent observations, 679,000 multifamily sale comparables, and 627,000 units under construction. [^1]  
Source: CoStar multifamily product page  
URL: https://www.costar.com/campaign/owners/multifamily  
Date: 2025 (product page as of search date)  
Excerpt: "CoStar delivers the most comprehensive and verified multifamily property data available, sourced through primary research, direct market input, public records and data feeds, including our Apartments.com network—the industry's leading online multifamily marketplace. With over 16 million monthly rent updates across 38 million units, you'll get unmatched insight into rent trends, ownership and proposed construction."  
Context: CoStar is the dominant CRE data provider in North America, acquired Apartments.com and Reonomy.  
Confidence: **High**

Claim: CoStar pricing for institutional investors starts at approximately $1,500+/month and scales to custom enterprise contracts. [^2]  
Source: PropLab / real estate analysis tools roundup  
URL: https://proplab.app/blog/best-real-estate-analysis-tools-investors  
Date: 2025-11-12  
Excerpt: "CoStar: Comprehensive commercial real estate data for institutional investors. Pricing starts at $1,500+/month."  
Context: CoStar does not publish list pricing; all pricing is negotiated per seat and dataset scope.  
Confidence: **Medium**

| Dimension | CoStar |
|-----------|--------|
| Coverage | 38M+ multifamily units, US/Canada/UK |
| Cost | $1,500–$30,000+/month (custom enterprise) |
| API Available | Yes (Bridge API, REST) |
| Geocoding Included | Yes, lat/lng on most records |
| Update Frequency | Daily rent updates; quarterly sales |
| Multifamily-Specific | Yes, dedicated multifamily dataset |

---

### 1.2 Reonomy (CoStar-owned)

Claim: Reonomy covers over 50 million US properties across all 50 states, including multifamily, industrial, retail, office, hospitality, commercial, and land. Standard pricing is $4,800/year per user or $400/month per user. [^3]  
Source: CREDaily Reonomy review  
URL: https://www.credaily.com/reviews/reonomy-review/  
Date: 2025-11-24  
Excerpt: "Reonomy covers all asset classes across all 50 states, including Multifamily, Industrial, Retail, Office, Hospitality, Commercial, and Land... Standard pricing is $4,800/year per user or $400/month per user. Discounts are given if paid in full upfront."  
Context: Reonomy was acquired by Altus Group in 2021, then folded into CoStar's data ecosystem. It focuses on commercial and 5+ unit multifamily.  
Confidence: **High**

Claim: Reonomy's AI lead scoring and debt maturity data are particularly useful for identifying distressed multifamily assets, but sales comps for nearby properties aren't always accurate and lease comps are nonexistent. [^3]  
Source: CREDaily  
URL: https://www.credaily.com/reviews/reonomy-review/  
Date: 2025-11-24  
Excerpt: "Cons: The use of machine learning and AI produces data that isn't always accurate. Smaller markets are more likely to be inaccurate or not have as much coverage. Limited comp data: Sales comps for nearby properties aren't always accurate, and lease comps are nonexistent."  
Context: Important limitation for users needing rental comparables, not just ownership data.  
Confidence: **High**

---

### 1.3 Yardi Matrix / Yardi Voyager

Claim: Yardi serves 13 million rental units globally and is the #1 property management software. Yardi Matrix offers comprehensive market intelligence across multifamily, affordable housing, student housing, SFR/BTR, and self-storage. [^4]  
Source: Propexo Proptech Guide  
URL: https://www.propexo.com/blog/proptech-yardi-api-integration  
Date: 2025  
Excerpt: "Yardi currently serves 13 million rental units globally... The company's flagship product, Yardi Voyager, is built for multifamily property management."  
Context: Yardi's data is primarily operational (rent rolls, occupancies) from its property management systems, not a public records aggregator.  
Confidence: **High**

Claim: Yardi Standard Interface Partnership Program (SIPP) requires an annual fee of ~$25,000 per interface for API access, plus mutual client references. [^5]  
Source: Truto blog / Yardi integration guide  
URL: https://truto.one/blog/overcoming-legacy-api-constraints-when-integrating-with-yardi-and-realpage/  
Date: 2026-05-08  
Excerpt: "An annual fee of $25,000 is charged for each interface... You must sign a separate agreement for each Yardi interface you wish to integrate with your application."  
Context: Yardi API access is gated behind a partner program; it's not a simple pay-per-use API.  
Confidence: **High**

| Dimension | Yardi Matrix |
|-----------|-------------|
| Coverage | 13M+ rental units globally, deep multifamily operational data |
| Cost | SIPP: ~$25K/interface/year; Matrix: custom enterprise |
| API Available | Yes (SOAP/WSDL, SIPP partner program) |
| Geocoding Included | Partial (property addresses, not always lat/lng) |
| Update Frequency | Daily (operational data) |
| Multifamily-Specific | Yes, core market |

---

### 1.4 RealPage

Claim: RealPage Market Analytics provides proprietary aggregated lease data covering millions of units across 425+ markets, with 30+ years of historical apartment data. RealPage's YieldStar (acquired 2002) pioneered revenue management for multifamily. [^6]  
Source: RealPage Market Analytics  
URL: https://www.realpage.com/insights-analytics/market-analytics/  
Date: 2026-03-04  
Excerpt: "No other multifamily market research platform has our data resources: Proprietary apartment data covering millions of units across 425+ markets... Historical apartment data spanning 30+ years and multiple market cycles."  
Context: RealPage focuses on operational intelligence for property managers, not raw property address databases.  
Confidence: **High**

Claim: RealPage reached a DOJ settlement in November 2025 over algorithmic pricing, restricting use of competitors' nonpublic data. The settlement imposes no financial penalties but requires court-appointed monitoring. [^7]  
Source: PYMNTS / RE Business Online  
URL: https://www.pymnts.com/cpi-posts/realpage-reaches-settlement-with-doj-over-rental-pricing-software/  
Date: 2025-11-25  
Excerpt: "The settlement would bar RealPage from using competitors' nonpublic data to help determine rental prices... The settlement resulted in no findings or admissions of liability... no financial penalties."  
Context: Regulatory risk for any platform relying on RealPage's pricing data.  
Confidence: **High**

---

### 1.5 HelloData.ai

Claim: HelloData monitors over 35 million multifamily units nationwide, pulling data from thousands of property websites and seven listing sites daily. Pricing starts at $300/month for the Standard plan; Enterprise is $0.50/unit. [^8]  
Source: RentalRealEstate / HelloData pricing page  
URL: https://rentalrealestate.com/tools/hellodata/  
Date: 2025-08-31  
Excerpt: "Standard: $300/mo... Enterprise: $0.50/unit... Trusted by over 25,000+ real estate professionals."  
Context: HelloData focuses on rent comps and market surveys, not a comprehensive property address database with geocoding.  
Confidence: **High**

Claim: HelloData's last listed rent matches actual rent roll values 96% of the time according to customer demos. [^9]  
Source: HelloData blog / Gracehill webinar  
URL: https://gracehill.com/resources/webinars/hellodata-multifamily-performance-analytics/  
Date: 2026-01-30  
Excerpt: "The last price on the day the listing is removed, more than ninety six percent of the time is the exact number that ends up on the rent roll."  
Context: High-quality rent data, but limited to properties that actively list online.  
Confidence: **Medium** (self-reported by provider)

---

### 1.6 PropTech Metrics

Claim: PropTech Metrics offers "disruptive pricing—just $0.02 per property lookup" with comprehensive coverage of millions of multifamily units across every US metro. API delivery includes REST, GraphQL, and webhooks. [^10]  
Source: PropTech Metrics website  
URL: https://www.proptechmetrics.com/  
Date: 2026 (site as of search)  
Excerpt: "Comprehensive Coverage: millions of multifamily units across every U.S. metro... Key Advantages: Disruptive pricing—just $0.02 per property lookup."  
Context: Emerging/early-stage provider; pricing is highly attractive but long-term viability and data quality are unproven at scale.  
Confidence: **Medium**

---

### 1.7 ATTOM Data

Claim: ATTOM covers 158 million+ US properties with 9,000 data points per property, including property characteristics, ownership, deeds, mortgages, tax assessments, AVMs, foreclosure data, neighborhood data, and environmental hazards. API pricing reported to start around $850–$2,000+/month. [^11]  
Source: BatchData blog / ATTOM  
URL: https://batchdata.io/blog/apis-real-estate-data-enrichment  
Date: 2026-02-23  
Excerpt: "ATTOM Data API: Covers 158M+ properties, offering 9,000 data points per property and neighborhood analytics... Pricing: $850–$2,000+/mo."  
Context: Strong for comprehensive property intelligence, but not specifically multifamily-focused.  
Confidence: **High**

---

### 1.8 Datafiniti

Claim: Datafiniti covers 122 million single-family records, 27.8 million apartment units, and 6.2 million commercial/industrial/retail properties. Pricing starts at $119/month for 1,000 records and goes up to $3,999/month for 1,000,000 records. [^12]  
Source: BatchData blog / Datafiniti  
URL: https://batchdata.io/blog/apis-real-estate-data-enrichment  
Date: 2026-02-23  
Excerpt: "Datafiniti Property Data API: Standardized data for residential, commercial, and multi-family properties with flexible plans... Pricing: $119–$3,999/mo."  
Context: Datafiniti is one of the most transparently priced providers with a free trial (1,000 records for 2 weeks).  
Confidence: **High**

---

### 1.9 BatchData

Claim: BatchData covers 155 million+ US properties with daily updates, contact enrichment, and flexible pricing starting at $500/month for 20,000 records (Lite) up to $5,000/month for 750,000 records (Scale). Data enrichment priced as low as $0.01 per record. [^11]  
Source: BatchData blog  
URL: https://batchdata.io/blog/apis-real-estate-data-enrichment  
Date: 2026-02-23  
Excerpt: "BatchData API: Access 155M+ U.S. properties with daily updates, contact enrichment, and flexible pricing... Pricing: $500–$5,000/mo."  
Context: Good for contact enrichment and skip tracing, but not specifically multifamily-focused.  
Confidence: **High**

---

## 2. Government / Regulatory Sources

### 2.1 HUD Multifamily Housing Datasets

Claim: HUD provides a publicly downloadable dataset of FHA-insured multifamily housing properties, including rental housing with 5+ units, nursing homes, hospitals, elderly housing, mobile home parks, and retirement centers. Data available as GeoDatabase, Shapefile, and ArcGIS Hub. Last updated July 30, 2025. [^13]  
Source: Data.gov / HUD  
URL: https://catalog.data.gov/dataset/hud-insured-multifamily-properties  
Date: 2025-07-30  
Excerpt: "The FHA insured Multifamily Housing portfolio consists primarily of rental housing properties with five or more dwelling units such as apartments or town houses, but can also be nursing homes, hospitals, elderly housing, mobile home parks, retirement service centers, and occasionally vacant land."  
Context: This is a **free, authoritative dataset** but only covers HUD-insured/FHA properties, not all multifamily. It includes geocoded locations (approximate).  
Confidence: **High**

Claim: HUD's National Housing Preservation Database (NHPD) provides a data dictionary and cross-references FHA-insured properties, Section 8 contracts, LIHTC, Public Housing, and state subsidies. [^14]  
Source: Preservation Database Data Dictionary  
URL: http://preservationdatabase.org/wp-content/uploads/2017/09/Data-Dictionary.pdf  
Date: 2017 (vintage but still referenced)  
Excerpt: "HUD Insured Properties that may be applied. Insured Multifamily Mortgages Database The US Department of Housing and Urban Development. (2017). Insured..."  
Context: Useful for affordable multifamily properties specifically, not market-rate.  
Confidence: **High**

---

### 2.2 Census Bureau Building Permits & ACS

Claim: Census Bureau building permit data shows multifamily permits have fallen 27.1% from pandemic highs, with 12.4 permits per 10,000 people in the past year (down from 17 during COVID). Redfin analyzed this data for 78 metros. [^15]  
Source: Redfin / HousingWire  
URL: https://www.housingwire.com/articles/redfin-multifamily-housing-permits-fall-from-pandemic-highs/  
Date: 2025-08-15  
Excerpt: "Developers secured an average of 12.8 permits for buildings with at least five units per 10,000 people from July 2024 through June 2025. That is down 23.1% from the 16.7-unit average during the pandemic-era building boom."  
Context: Building permits data is free from Census but does not provide addresses of existing properties—only new construction trends.  
Confidence: **High**

Claim: The US Census Geocoder offers free batch geocoding for up to 10,000 addresses per submission, with no total request cap. It is US-only and returns Census geography (tract, block, etc.) but has known inconsistency issues when re-running the same batch. [^16]  
Source: Census Geocoder FAQ  
URL: https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_FAQ.pdf  
Date: Not dated (current as of search)  
Excerpt: "Users who want to geocode more than 10,000 addresses using the Census Geocoder will need to split their data into multiple submissions that are 10,000 addresses or less... These inconsistent results are a known issue with the geocoder's address matching related to processing load."  
Context: **Best free option for batch geocoding** in the US, but accuracy is street-level, not rooftop.  
Confidence: **High**

---

### 2.3 Local Assessor / Tax Parcel Data

Claim: Most counties make property records available online for free through county assessor databases, including parcel numbers, ownership, assessed values, zoning, and building characteristics. [^17]  
Source: Biscred multifamily asset class guide  
URL: https://www.biscred.com/asset-class/multifamily  
Date: Not dated  
Excerpt: "Most counties make property records available online for free through a county assessor's database, also known as county appraisers in some states. These sites can be wonky, so get as much information as possible, such as physical address and the parcel number if possible."  
Context: County assessor data is **the most authoritative source** for property addresses, APNs, and tax status, but must be scraped or downloaded county-by-county. No national single API exists for free.  
Confidence: **High**

Claim: ParcelQuest (California-specific) integrates with all 58 California county assessor and recorder offices for real-time parcel data, while CoreLogic provides nationwide parcel-level property information from tax assessor records. [^18]  
Source: JDJ Consulting / ParcelQuest vs CoreLogic  
URL: https://jdj-consulting.com/parcelquest-vs-corelogic-which-real-estate-data-platform-is-right-for-you/  
Date: 2026-02-05  
Excerpt: "ParcelQuest is built specifically for California real estate professionals. The platform integrates with county assessor and recorder offices, pulling real-time data across all 58 California counties."  
Context: For California, ParcelQuest is excellent; nationwide, CoreLogic/Cotality dominates parcel data.  
Confidence: **High**

---

## 3. Proptech-Specific Platforms

### 3.1 Cherre

Claim: Cherre is a real estate data unification platform with a "Data Universe" of 6 billion+ data points from 100,000+ sources. It provides a single GraphQL API and integrates with Snowflake, PowerBI, and Azure SQL. Custom enterprise subscriptions start at $50,000+ annually. [^19]  
Source: WiFiTalents / Cherre review  
URL: https://wifitalents.com/best/real-estate-site-selection-software/  
Date: 2026-02-12  
Excerpt: "Cherre Data Universe: A normalized repository of 6B+ data points from 100,000+ sources... Custom enterprise subscriptions starting at $50,000+ annually."  
Context: Cherre is **not a data source** but a data integration layer. It requires you to already have subscriptions to CoStar, REIS, etc.  
Confidence: **High**

Claim: Cherre implementation takes 6–12 months in practice, and its fees sit on top of underlying data subscriptions. [^20]  
Source: Monexo / Cherre tech reality  
URL: https://www.monexo.net/blog/construction-3/cherre-28  
Date: 2026-04-22  
Excerpt: "Cherre fees sit on top of the underlying data subscriptions it connects—CoStar, REIS, and others... Mapping an enterprise's custom data schema to the Cherre model takes six to twelve months in practice."  
Context: Cherre is overkill for a 10K–100K property platform unless you already have enterprise data contracts.  
Confidence: **High**

---

### 3.2 RentCast

Claim: RentCast offers a free API plan with 50 calls/month, and paid plans for property valuations and rental data. Nationwide coverage for 140 million+ residential and commercial properties. [^11]  
Source: BatchData / RentCast  
URL: https://batchdata.io/blog/apis-real-estate-data-enrichment  
Date: 2026-02-23  
Excerpt: "RentCast specializes in rental property data for both individual and commercial use... Free plan includes 50 API calls per month."  
Context: Good for small-scale validation, not bulk property database building.  
Confidence: **High**

---

## 4. Geocoding Services Comparison

### 4.1 Google Maps Geocoding API

Claim: Google Geocoding API costs $5.00 per 1,000 requests after a 10,000/month free tier ($200 credit). At 1M requests/month, cost is approximately $5,000. No native batch endpoint; caching limited to 30 days. [^21]  
Source: CSV2GEO / API Scout  
URL: https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026  
Date: 2026-03-23  
Excerpt: "Google Maps Geocoding API costs $5.00 per 1,000 requests... Free tier: 10,000/month... At 1M requests/month, roughly $5,000/month."  
Context: Best global accuracy, but expensive at scale and restrictive storage terms.  
Confidence: **High**

---

### 4.2 Mapbox Geocoding API

Claim: Mapbox Temporary Geocoding API is free for 100,000 requests/month. Permanent API (required for storage) starts at $5/1,000. Results from Temporary API cannot be stored. Rate limited to 600 requests/minute. [^22]  
Source: Geocod.io / Mapbox comparison  
URL: https://www.geocod.io/compare-geocoding-services/geocodio-vs-mapbox-geocoding-comparison  
Date: 2026-06-10  
Excerpt: "Mapbox's Temporary Geocoding API is free for up to 100,000 requests per month... Mapbox's Permanent Geocoding API does not have a free tier and pricing starts at $5/1,000."  
Context: Generous free tier but Permanent API is expensive and has usage restrictions.  
Confidence: **High**

---

### 4.3 HERE Geocoding API

Claim: HERE offers native batch geocoding, 30,000 free requests/month, and is 82% cheaper than Google at scale ($8.80 vs $50 per 10,000 transactions). Postal-level accuracy across 200+ countries. [^23]  
Source: Placematic / HERE comparison  
URL: https://placematic.com/compare/here-geocoding-vs-google-maps/  
Date: 2026-06-11  
Excerpt: "HERE offers 3x more free requests (30,000 vs 10,000/month). Above the free tier, HERE is 82% cheaper—$8.80 vs $50.00 per 10,000 transactions... Native batch geocoding included."  
Context: Best enterprise option for batch geocoding at scale.  
Confidence: **High**

---

### 4.4 Geocodio

Claim: Geocodio is free for 2,500 lookups/day (US/Canada only). Additional lookups are $1/1,000. Results can be stored permanently. No restrictions on use cases (lead generation, advertising, etc.). [^22]  
Source: Geocod.io  
URL: https://www.geocod.io/compare-geocoding-services/geocodio-vs-mapbox-geocoding-comparison  
Date: 2026-05-11  
Excerpt: "Geocodio is free for the first 2,500 lookups per day. Additional lookups are $1/1,000. You can store Geocodio results, which means you only have to pay to geocode an address once."  
Context: **Cheapest viable option for US-only multifamily geocoding** at 10K–100K properties.  
Confidence: **High**

---

### 4.5 US Census Geocoder

Claim: The US Census Geocoder is completely free, handles 10,000 addresses per batch, and has no total cap. A GitHub package (USGeocoder) can process 2,000–4,000 addresses per minute in parallel. [^16]  
Source: GitHub / ClayGendron USGeocoder  
URL: https://github.com/ClayGendron/usgeocoder  
Date: 2023-08-13  
Excerpt: "By sending requests in parallel, this package can geocode around 2,000 - 4,000 addresses per minute without ever hitting a rate limit or a total request cap."  
Context: Accuracy is to the street/intersection level, not rooftop. Best for Census geography linkage, not precise foot-traffic matching.  
Confidence: **High**

---

### 4.6 Nominatim (OpenStreetMap)

Claim: Nominatim is free and open-source but has strict usage limits (1 request/second on public instance). Self-hosting requires 64GB+ RAM and 1TB SSD. Data quality varies by region; OSM is excellent in Europe but can be incomplete in rural US areas. [^24]  
Source: GeoPostcodes / Nominatim guide  
URL: https://www.geopostcodes.com/blog/nominatim-geocode/  
Date: 2026-06-10  
Excerpt: "Nominatim produces synthetic addresses based on OpenStreetMap geographic data rather than official postal authority records... Regional variation in data quality: Western Europe often has detailed mapping, while developing markets may have incomplete or outdated data."  
Context: Not suitable for production multifamily matching without significant engineering investment.  
Confidence: **High**

---

### 4.7 CSV2GEO

Claim: CSV2GEO offers a free tier of 100 file rows + 1,000 API requests daily, supports 18 endpoints including batch geocoding (up to 10,000 addresses per request), and covers 200+ countries. No credit card required. [^25]  
Source: CSV2GEO batch geocoding guide  
URL: https://csv2geo.com/blog/best-batch-geocoding-tools  
Date: 2026-03-18  
Excerpt: "CSV2GEO free tier gives you 100 file rows and 1,000 API requests every day, no credit card needed. That is 3,000 file rows and 30,000 API calls per month."  
Context: Good for quick CSV uploads without coding, but long-term enterprise reliability is unclear.  
Confidence: **Medium**

---

## 5. Address Normalization & Matching

### 5.1 USPS Address Validation

Claim: USPS maintains a database of over 160 million mailable addresses, updated monthly. The USPS API is free but can only be used for shipping/mailing services, not bulk validation or data enrichment. It lacks geocoding, autocomplete, and user-friendly interfaces. [^26]  
Source: Radar blog  
URL: https://radar.com/blog/usps-api  
Date: 2025-02-20  
Excerpt: "The USPS address standardization API fixes typos and formatting issues... However, the USPS APIs can only be used for shipping and mailing services, not bulk address validation or data enrichment."  
Context: Free but legally restricted; not suitable for building a general property database.  
Confidence: **High**

---

### 5.2 Smarty (formerly SmartyStreets)

Claim: Smarty verifies 209M+ US addresses, matches 20M more than USPS, and adds up to 55 metadata points including ZIP+9 geocodes, vacancy status, and residential/commercial indicator (RDI). Rooftop-accurate geocodes plus 350 property attributes available. [^27]  
Source: Smarty US Address Verification  
URL: https://www.smarty.com/products/us-address-verification  
Date: 2025-10-01  
Excerpt: "209M+ Verified US addresses... 20M Non-USPS addresses... Attaches up to 55 metadata points, like ZIP-9 geocodes, vacancy status, and residential/commercial indicator (RDI)."  
Context: **Best-in-class for US address validation + geocoding**. The RDI flag is critical for filtering multifamily vs. single-family.  
Confidence: **High**

---

### 5.3 Loqate

Claim: Loqate covers 250 countries, supports >500K lookups/second, and includes geocoding, phone/email verification, and rich customer profiles. It is enterprise-grade but pricing is custom. [^28]  
Source: Loqate blog  
URL: https://www.loqate.com/en-us/blog/stamp-out-mailing-errors-the-ultimate-guide-to-usps-address-validation/  
Date: Not dated  
Excerpt: "Loqate address verify: 250 countries covered... Lookups per second: >500K... Geocoding: Yes."  
Context: Good for global operations, but overkill for US-only multifamily.  
Confidence: **High**

---

## 6. Open Data Sources

### 6.1 OpenAddresses

Claim: OpenAddresses is the largest open address dataset in the world, collecting government-released address data. Coverage is strongest in the US, Canada, Australia, and Europe. All data is freely available under open licenses. The US has substantial coverage (69.5% population covered). [^29]  
Source: Atlas.co / OpenAddresses  
URL: https://atlas.co/data-sources/open-addresses/  
Date: 2026-06-17  
Excerpt: "OpenAddresses bypasses this by systematically collecting address data that governments have already released as open data, standardizing it into a consistent schema, and publishing it freely."  
Context: Excellent foundation for a DIY geocoding pipeline, but coverage gaps exist in rural areas and some counties.  
Confidence: **High**

---

### 6.2 OpenStreetMap Buildings

Claim: OpenStreetMap contains building footprint data contributed by volunteers. Coverage is excellent in urban areas but sparse in rural US regions. Data is free under ODbL license but requires significant processing to extract usable address-to-building mappings. [^24]  
Source: GeoPostcodes / Nominatim guide  
URL: https://www.geopostcodes.com/blog/nominatim-geocode/  
Date: 2026-06-10  
Excerpt: "OpenStreetMap's open editing model allows anyone to modify map data... Regional variation in data quality: Western Europe often has detailed mapping, while developing markets may have incomplete or outdated data."  
Context: Building footprints are useful for 3D visualization but not sufficient for address matching without address point data.  
Confidence: **High**

---

## 7. Summary Table: Property Data Sources

| Name | Coverage | Cost | API | Geocoding | Update Freq | Multifamily-Specific |
|------|----------|------|-----|-----------|-------------|----------------------|
| **CoStar** | 38M+ MF units, US | $1,500–$30K+/mo | Yes | Yes | Daily rents | Yes |
| **Reonomy** | 50M+ properties, US | $4,800/yr/user | Yes | Partial | Weekly | Yes (5+ units) |
| **Yardi Matrix** | 13M+ rental units | Custom enterprise | Yes (SIPP) | Partial | Daily | Yes |
| **RealPage** | Millions of units, 425+ markets | Custom enterprise | Yes | No | Daily | Yes |
| **HelloData** | 35M+ MF units | $300/mo or $0.50/unit | Yes | No | Daily | Yes (rent comps) |
| **PropTech Metrics** | Millions of MF units | $0.02/lookup | Yes | No | Unknown | Yes |
| **ATTOM Data** | 158M+ properties | $850–$2,000+/mo | Yes | Yes | Weekly | No |
| **Datafiniti** | 27.8M apartment units | $119–$3,999/mo | Yes | Yes | Daily/weekly | Yes |
| **BatchData** | 155M+ properties | $500–$5,000/mo | Yes | Yes | Daily | No |
| **Cherre** | 6B+ data points (aggregated) | $50,000+/yr | GraphQL | No | Varies | No (integration layer) |
| **HUD** | FHA-insured MF only | Free | No | Yes (approx) | Annual | Yes (subsidized) |
| **Census Geocoder** | US only | Free | Yes | Yes (street) | Static | No |
| **Local Assessor** | County-specific | Free | Varies | Sometimes | Annual | No |
| **OpenAddresses** | US, CA, AU, EU | Free | No | Yes | Varies | No |
| **Smarty** | 209M+ US addresses | Custom (~$0.01–$0.05/lookup) | Yes | Rooftop | Monthly | No (address tool) |
| **Geocodio** | US/Canada | Free 2,500/day; $1/1K | Yes | Rooftop | Static | No |
| **HERE** | 200+ countries | $0.88/1K (volume) | Yes | Postal | Monthly | No |
| **Mapbox** | 200+ countries | Free 100K/mo; $0.75–$5/1K | Yes | Yes | Unknown | No |
| **Google Maps** | 200+ countries | $5/1K; free 10K/mo | Yes | Best-in-class | Unknown | No |
| **Nominatim** | Global | Free (self-host: $200–$500/mo) | Yes | Variable | Varies | No |

---

## 8. Recommended Property Data Stack (10K–100K Properties, Minimum Cost)

### Tier 1: Base Property Database
**Option A (Budget):** Datafiniti Property Data API  
- $899/month for 100K records  
- Includes 27.8M apartment units with addresses, property characteristics, tax data, and lat/lng  
- Clean, standardized schema with no preprocessing needed

**Option B (Premium):** ATTOM Data API  
- ~$850–$1,500/month for API access  
- 158M+ properties, 9,000 attributes, strong neighborhood and environmental data  
- Better for deep analytics but not specifically multifamily-focused

### Tier 2: Address Validation & Geocoding
**Primary:** Geocodio (US/Canada)  
- Free: 2,500/day (75K/month)  
- Paid: $1/1,000 lookups  
- At 100K properties: ~$100/month if above free tier  
- Permanent storage allowed; no usage restrictions

**Secondary (if precision needed):** Smarty US Address Verification  
- Custom pricing, roughly $0.01–$0.05/lookup at volume  
- Rooftop geocoding + Residential Delivery Indicator (RDI) for filtering multifamily  
- Best for final validation before foot-traffic join

**Free Alternative:** US Census Geocoder  
- 10K addresses per batch, unlimited total  
- Good enough for Census tract/block matching, not rooftop precision

### Tier 3: Multifamily-Specific Rent/Comp Data (Optional)
**HelloData.ai** at $300/month for automated rent surveys and comp data on 35M+ units.  
Use this only if you need rent comps in addition to addresses for your foot-traffic ranking model.

### Estimated Monthly Cost at 100K Properties
| Component | Cost |
|-----------|------|
| Datafiniti (100K records) | $899 |
| Geocodio (supplemental geocoding) | $0–$100 |
| Smarty (validation, optional) | $200–$500 |
| **Total** | **$1,100–$1,500/month** |

**Cheapest viable path:** Datafiniti trial (1K free) → Census Geocoder (free) → OpenAddresses (free) → manual county assessor scraping for gaps. Engineering cost: 3–6 months. Data cost: near zero. Quality: medium-high with gaps in rural areas.

---

## 9. Technical Guide: Address Normalization & Geocoding for Multifamily Properties

### Why Address Normalization Matters for Foot-Traffic Matching

Foot-traffic data (e.g., from mobile devices, IoT sensors, or satellite imagery) is typically geocoded to lat/lng coordinates. To join this to a property database, you need:
1. **Clean, standardized addresses** (so "123 Main St, Apt 4" and "123 Main Street Unit 4" match)
2. **Rooftop-accurate geocodes** (so the property pin falls on the building, not the street centerline)
3. **A persistent property ID** (so you don't re-geocode the same address repeatedly)

### Best Practices

**Step 1: Parse and Normalize**
- Use a CASS-certified service (Smarty, Loqate) or USPS API to standardize street names, expand abbreviations, and validate ZIP+4.
- Remove unit/apartment numbers before geocoding if the geocoder doesn't handle sub-addresses well. Store unit numbers separately.
- Flag residential vs. commercial using RDI (Smarty) or property type fields (Datafiniti).

**Step 2: Geocode with a Batch-First Service**
- For 10K–100K properties, use a service with native batch processing (HERE, CSV2GEO, Geocodio) or parallelize the US Census Geocoder.
- Always include a "match quality score" field. Reject matches below 0.8 (or equivalent) for manual review.
- Use "structured address" input (street, city, state, zip as separate fields) rather than single-line strings for better accuracy.

**Step 3: Deduplicate and Persistent-ID**
- Assign a UUID or use a deterministic hash of the normalized address + ZIP+4 as your property key.
- Check for duplicates using lat/lng clustering (e.g., DBSCAN within 50 meters) + address similarity (Levenshtein distance < 3).

**Step 4: Handle Multifamily Edge Cases**
- **Garden-style apartments:** Often have a single street address but multiple buildings. Geocode the main entrance and buffer by property parcel boundaries.
- **High-rise towers:** One address, many units. The geocode should be the tower centroid; foot-traffic matching should use a radius search (e.g., 100m).
- **Missing from geocoders:** New construction (0–2 years old) may not appear in commercial geocoders. Use county assessor data or building permit records as a fallback.

**Step 5: Validate and Monitor**
- Spot-check 1% of results against satellite imagery (Google Earth, Mapbox Satellite).
- Re-geocode annually or when property dataset updates. Addresses don't change often, but new construction and ZIP boundary changes do occur.

---

## 10. Coverage Gap Analysis

### Underrepresented Property Types
| Property Type | Gap Description | Mitigation |
|---------------|-----------------|------------|
| **Small multifamily (2–4 units)** | Often classified as residential in assessor records, not commercial. May be missing from CoStar/Reonomy. | Use Datafiniti/ATTOM (includes all residential) or county assessor data directly. |
| **Rural multifamily** | Limited listing activity; less likely to appear in HelloData or Yardi Matrix. | County assessor data + Census Geocoder + manual verification. |
| **Affordable/LIHTC housing** | May not advertise publicly; subsidized properties tracked in HUD NHPD. | Combine HUD dataset with local Housing Authority records. |
| **Student housing** | Often categorized separately; may not appear in conventional multifamily databases. | Yardi Matrix has dedicated student housing module; RealPage covers student housing. |
| **Build-to-Rent (BTR) / SFR communities** | Emerging asset class; some providers treat as single-family. | Datafiniti, Yardi Matrix, and RealPage have expanding BTR coverage. |
| **Unpermitted / informal units** | ADUs, basement apartments, unpermitted conversions. | Not systematically tracked anywhere. Use Census ACS estimates + utility data as proxy. |

### Underrepresented Geographies
- **Rural counties in the Mountain West and Great Plains:** County assessor data may not be online; OpenAddresses coverage is sparse.
- **Territories (Puerto Rico, Guam, USVI):** Limited coverage in most commercial providers; HUD and Census data are best sources.
- **Small MSAs (<100K population):** HelloData and some proptech providers focus on top 50–100 markets.

### Recommended Gap-Filling Strategy
1. **Core:** Datafiniti or ATTOM for nationwide base coverage.
2. **Affordable:** HUD NHPD + state housing finance agency datasets.
3. **Rural:** Direct county assessor scraping (use Python + BeautifulSoup or county GIS REST APIs).
4. **New construction:** Census Building Permits + local permit portals.
5. **Validation:** Spot-check against Google Maps / satellite imagery.

---

## 11. Historical Context: Evolution of Multifamily Property Data

The availability of multifamily property data has evolved through three eras:

1. **Pre-2000: MLS and Public Records Era**
   - Property data was siloed in county courthouses and local MLS systems.
   - Multifamily data was particularly scarce because many small properties were never listed commercially.
   - Investors relied on personal relationships, direct mail, and courthouse visits.

2. **2000–2015: Aggregation and Proptech 1.0**
   - Companies like CoStar (founded 1987, expanded nationally in 2000s), Yardi (founded 1984), and Reonomy (founded 2013) began aggregating county records.
   - RETS and later RESO Web API standards allowed MLS data to flow digitally.
   - Zillow (founded 2006) democratized residential valuations but struggled with commercial/multifamily accuracy.

3. **2015–Present: AI, APIs, and Real-Time Data**
   - HelloData (2023) and similar platforms use web scraping and AI to extract daily rent data from listing sites.
   - Bridge Interactive (acquired by Zillow 2016) standardized MLS API access.
   - Open data movements (OpenAddresses, OpenStreetMap) created free alternatives, but coverage remains uneven.
   - The DOJ's 2025 settlement with RealPage signals regulatory scrutiny on algorithmic pricing data, potentially shifting how operational data is shared.

---

## 12. Stakeholder Map: Who Owns the Data?

| Data Category | Owner | Access Model |
|---------------|-------|--------------|
| **Property addresses & tax records** | County assessors / recorders | Public record (free to view, often paid for bulk/API) |
| **HUD-subsidized property details** | US Department of Housing and Urban Development | Free public datasets |
| **Building permits & construction** | US Census Bureau + local building depts | Free (Census); county-specific (local) |
| **Ownership & mortgage records** | County recorders; aggregated by CoreLogic, ATTOM, DataTree | Commercial license |
| **Rent rolls & operational data** | Property managers (Yardi, RealPage, AppFolio) | Operational system; not generally sold as raw data |
| **Listing data & asking rents** | Apartments.com, Zillow, listing syndicators | Commercial API or scraping (terms-restricted) |
| **Foot traffic / mobility data** | Placer.ai, Near, SafeGraph, mobile carriers | Commercial license, typically expensive |
| **Geocoding coordinates** | Google, HERE, Mapbox, OpenStreetMap | Free tier + paid commercial |

---

## 13. Counter-Narrative: Build vs. Buy

### Why Building Your Own Property Database Might Be Better
- **Cost:** For 10K–100K properties, a commercial stack costs $15K–$50K/year. A single engineer scraping county data for 6 months costs ~$75K–$100K but yields a perpetual, owned asset.
- **Control:** You own the data, can store it indefinitely, and are not subject to API rate limits or provider pricing changes.
- **Customization:** You can tune your deduplication, geocoding, and property classification rules to your exact use case.
- **No licensing restrictions:** Some commercial providers (Zillow, Mapbox Temporary) restrict how data is stored, displayed, or used for lead generation.

### Why Building Your Own Property Database Might Be Worse
- **Time to market:** 6–12 months vs. 2–4 weeks with a commercial API.
- **Coverage gaps:** Rural counties, territories, and small MSAs will have incomplete data. Commercial providers have already solved these gaps.
- **Maintenance burden:** County websites change, assessor offices reorganize, and data formats shift. A DIY pipeline requires ongoing maintenance.
- **Geocoding accuracy:** Open-source geocoders (Nominatim, Census) lack rooftop accuracy in many areas. Achieving commercial-grade geocoding requires paying a provider or building a massive GIS infrastructure.
- **Address normalization:** CASS-certified address parsing is complex. Building your own USPS-compliant normalizer is a multi-year project.

### Verdict
For a platform at 10K–100K properties, **buy the base data and geocoding, then build the matching layer**. Use Datafiniti/ATTOM for properties, Geocodio/Smarty for geocoding, and build your own foot-traffic-to-property join logic. This balances speed, cost, and control.

---

## 14. Footnotes

[^1]: CoStar. "Multifamily Property, Real Estate Data & Analytics." CoStar.com. https://www.costar.com/campaign/owners/multifamily

[^2]: PropLab. "Best Real Estate Analysis Tools for Investors." PropLab.app. 2025-11-12. https://proplab.app/blog/best-real-estate-analysis-tools-investors

[^3]: CREDaily. "Reonomy 2026 Review: Details, Pricing, & Features." CREDaily.com. 2025-11-24. https://www.credaily.com/reviews/reonomy-review/

[^4]: Propexo. "Proptech Guide to Yardi API Integrations." Propexo.com. 2025. https://www.propexo.com/blog/proptech-yardi-api-integration

[^5]: Truto. "Overcoming Legacy API Constraints: Architecting Yardi & RealPage Integrations." Truto.one. 2026-05-08. https://truto.one/blog/overcoming-legacy-api-constraints-when-integrating-with-yardi-and-realpage/

[^6]: RealPage. "Market Analytics Platform for Multifamily." RealPage.com. 2026-03-04. https://www.realpage.com/insights-analytics/market-analytics/

[^7]: PYMNTS. "RealPage Reaches Settlement With DOJ Over Rental Pricing Software." PYMNTS.com. 2025-11-25. https://www.pymnts.com/cpi-posts/realpage-reaches-settlement-with-doj-over-rental-pricing-software/

[^8]: RentalRealEstate. "HelloData: Pricing, Free Demo & Features." RentalRealEstate.com. 2025-08-31. https://rentalrealestate.com/tools/hellodata/

[^9]: Gracehill. "Smarter Multifamily Decisions Start Here: Meet HelloData." Gracehill.com. 2026-01-30. https://gracehill.com/resources/webinars/hellodata-multifamily-performance-analytics/

[^10]: PropTech Metrics. "Investor-Grade Metrics for Multifamily & Space Utilization." PropTechMetrics.com. 2026. https://www.proptechmetrics.com/

[^11]: BatchData. "Top 7 APIs for Real Estate Data Enrichment." BatchData.io. 2026-02-23. https://batchdata.io/blog/apis-real-estate-data-enrichment

[^12]: Datafiniti. "Real Estate & Property Data API." Datafiniti.co. 2025. https://www.datafiniti.co/blog/real-estate-transaction-database-an-api-access-guide

[^13]: Data.gov / HUD. "HUD-Insured Multifamily Properties." Catalog.Data.gov. 2025-07-30. https://catalog.data.gov/dataset/hud-insured-multifamily-properties

[^14]: Preservation Database. "Data Dictionary." PreservationDatabase.org. 2017. http://preservationdatabase.org/wp-content/uploads/2017/09/Data-Dictionary.pdf

[^15]: HousingWire. "Redfin: Multifamily housing permits fall from pandemic highs." HousingWire.com. 2025-08-15. https://www.housingwire.com/articles/redfin-multifamily-housing-permits-fall-from-pandemic-highs/

[^16]: US Census Bureau. "Census Geocoder Frequently Asked Questions." Census.gov. https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_FAQ.pdf

[^17]: Biscred. "How to Use Biscred to Find Multifamily Property Info." Biscred.com. https://www.biscred.com/asset-class/multifamily

[^18]: JDJ Consulting. "ParcelQuest vs CoreLogic." JDJ-Consulting.com. 2026-02-05. https://jdj-consulting.com/parcelquest-vs-corelogic-which-real-estate-data-platform-is-right-for-you/

[^19]: WiFiTalents. "Top 10 Best Real Estate Site Selection Software of 2026." WiFiTalents.com. 2026-02-12. https://wifitalents.com/best/real-estate-site-selection-software/

[^20]: Monexo. "Cherre: The Tech Reality." Monexo.net. 2026-04-22. https://www.monexo.net/blog/construction-3/cherre-28

[^21]: CSV2GEO. "Geocoding API Pricing Compared: Real Cost 2026." CSV2GEO.com. 2026-03-23. https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026

[^22]: Geocod.io. "Compare Mapbox Geocoding vs Geocodio." Geocod.io. 2026-06-10. https://www.geocod.io/compare-geocoding-services/geocodio-vs-mapbox-geocoding-comparison

[^23]: Placematic. "HERE Geocoding API vs Google Maps — Address & Batch Comparison 2026." Placematic.com. 2026-06-11. https://placematic.com/compare/here-geocoding-vs-google-maps/

[^24]: GeoPostcodes. "Geocoding with Python using Nominatim: A beginner's guide." GeoPostcodes.com. 2026-06-10. https://www.geopostcodes.com/blog/nominatim-geocode/

[^25]: CSV2GEO. "Best Batch Geocoding Tools in 2026." CSV2GEO.com. 2026-03-18. https://csv2geo.com/blog/best-batch-geocoding-tools

[^26]: Radar. "Limitations of the USPS API for address validation." Radar.com. 2025-02-20. https://radar.com/blog/usps-api

[^27]: Smarty. "US Address Verification by Smarty." Smarty.com. 2025-10-01. https://www.smarty.com/products/us-address-verification

[^28]: Loqate. "The ultimate guide to USPS address validation." Loqate.com. https://www.loqate.com/en-us/blog/stamp-out-mailing-errors-the-ultimate-guide-to-usps-address-validation/

[^29]: Atlas.co. "OpenAddresses." Atlas.co. 2026-06-17. https://atlas.co/data-sources/open-addresses/

---

*End of Dim03 Research Report*
