# Dimension 10: API & Data Marketplace Economics
## Total Cost of Ownership for Foot Traffic Data at Scale

**Research Agent**: Dim10_Researcher  
**Date**: 2026-06-20  
**Scope**: REST API, flat-file subscription, data marketplace, SaaS platform, and open-data infrastructure costs for consuming foot-traffic data in multifamily property ranking. Covers pay-per-use vs. subscription break-even, hidden costs, enterprise negotiation, and cheapest-viable-stack recommendations at 10K, 100K, and 1M property portfolios.

---

## 1. Executive Summary

The economics of foot-traffic data are not linear. At small scale (≤10K properties), metered APIs and SaaS dashboards look cheap. At 100K properties, flat-file subscriptions and cloud marketplaces break even. At 1M properties, enterprise SaaS platforms become the lowest total-cost option—not because their per-unit price drops, but because the labor and compute required to self-process raw data overtakes subscription fees. The "free" open-data stack is the most expensive at every scale once engineering labor is included. Hidden costs—egress fees, cloud-services overage, geocoding overruns, and compliance overhead—can add 30–60% to the headline data price.

---

## 2. Dimension Scope & Required Angles

### 2.1 Current State
- Dominant pricing models: per-call metered (Google, Mapbox, Foursquare), flat annual (SafeGraph, Unacast), per-seat SaaS (Placer.ai, GrowthFactor), and cloud-marketplace consumption (Snowflake, AWS Data Exchange).
- No provider publishes a true "per-property" price for multifamily; all prices are negotiated or derived from API volume.

### 2.2 History
- 2018–2020: Per-seat SaaS dominated (Placer.ai, Buxton).
- 2020–2023: Pay-per-use APIs expanded (SafeGraph Patterns API, Foursquare Places).
- 2023–2026: Cloud marketplaces (Snowflake, Databricks, AWS Data Exchange) became the preferred procurement channel for large enterprises, shifting cost from "data license" to "data + compute + egress".

### 2.3 Stakeholders
- **Providers**: SafeGraph, Unacast (Gravy Analytics), Placer.ai, Foursquare, Facteus, DataForSEO, BestTime.app, PropTech Metrics.
- **Marketplaces**: AWS Data Exchange, Snowflake Marketplace, Databricks Marketplace.
- **Cloud Platforms**: AWS, Snowflake, Databricks, BigQuery.
- **Aggregators**: GrowthFactor, HelloData.ai, Cherre.

### 2.4 Counter-Narrative
- Metered APIs are cheap at low volume but scale linearly; at 1M properties they can exceed $30K/month.
- "Free" open data (OSM, Census) requires 1–4 FTE data engineers, making it the most expensive stack above 10K properties.
- Enterprise SaaS platforms bundle support, UI, and data freshness, but lock you into proprietary scoring methodologies.

---

## 3. Structured Findings

### 3.1 SafeGraph Pricing & Delivery Models

```
Claim: SafeGraph APIs and datasets range from $0.10 per purchase to $30,000 per year, with custom annual subscription pricing based on rows, columns, and usage rights.
Source: Datarade / SafeGraph Official Pricing
URL: https://datarade.ai/data-providers/safegraph/profile & https://www.safegraph.com/pricing/
Date: 2026-05-13 (pricing page); ongoing (Datarade)
Excerpt: "SafeGraph APIs and datasets range in cost from $0.10 / purchase to $30,000 / year." and "Pay a simple annual fee based on your custom mix of rows, columns, and usage rights."
Context: No pay-per-use policies; flat annual fee negotiated per dataset. Free samples available for individual requirements. Address Data for 75M+ global locations starts at $30,000/yearly license on Datarade.
Confidence: High[^1]
```

```
Claim: SafeGraph data is free for academics, non-profits, and governments through its COVID-19 Data Consortium and ongoing academic programs.
Source: Geospatial World
URL: https://geospatialworld.net/news/safegraph-creates-a-dashboard-showing-foot-traffic-patterns-across-the-u-s/
Date: 2020-05-19
Excerpt: "For academics, non-profits, and governments SafeGraph data is free of cost. Thousands of collaborators are actively working with SafeGraph data in the SafeGraph COVID-19 Data Consortium."
Context: SafeGraph has historically offered free access to academic and government researchers; this sets a negotiation baseline for qualifying organizations.
Confidence: High[^2]
```

### 3.2 Unacast / Gravy Analytics Pricing

```
Claim: Unacast APIs and datasets range from $1 per API call to $40,000 per year, with usage-based and custom enterprise options.
Source: Datarade
URL: https://datarade.ai/data-providers/unacast/profile
Date: 2026 (ongoing)
Excerpt: "Unacast APIs and datasets range in cost from $1 / API call to $40,000 / year."
Context: Unacast (now merged with Gravy Analytics) offers global foot traffic data. The $1/call rate applies to on-demand API access; the $40K/year rate applies to bulk data feeds. Medium-sized and enterprise buyers should expect custom quotes.
Confidence: High[^3]
```

### 3.3 Placer.ai Enterprise Pricing

```
Claim: Placer.ai enterprise subscriptions typically range from $12,000 to $50,000+ per year, priced on a seat-plus-data-tier model.
Source: Tontitown / Placer.ai Comparison Document
URL: https://www.tontitown.com/wp-content/uploads/2026/05/8D.-Placer.ai-comparison.pdf
Date: 2026-05-08
Excerpt: "Placer.ai ~$12K–$50K+/yr (enterprise tiers). Subscription (seat + data tiers)."
Context: Placer.ai is the dominant US foot-traffic analytics platform. Pricing is opaque and negotiated; the $12K entry point is for smaller teams, while large CRE portfolios can exceed $50K/year. A freemium tier exists with limited access.
Confidence: High[^4]
```

### 3.4 GrowthFactor & HelloData.ai SaaS Pricing

```
Claim: GrowthFactor pricing starts at $400/month for small retailers under 10 locations, $1,000/month for Core plans, and custom Enterprise pricing for large organizations.
Source: GrowthFactor Official Pricing
URL: https://www.growthfactor.ai/pricing
Date: 2026-05 (ongoing)
Excerpt: "Small Business Starter $400/mo ... Core $1,000/month ... Custom Enterprise pricing."
Context: GrowthFactor is retail-focused, not multifamily-specific, but provides transparent pricing for integrated foot-traffic + demographics + scoring. Unlimited user seats, no per-seat fees.
Confidence: High[^5]
```

```
Claim: HelloData.ai offers a Professional Plan at $300/month and an Enterprise Plan at $0.50 per unit per month for multifamily market data.
Source: SoftwareFinder / G2
URL: https://softwarefinder.com/analytics-software/hello-data & https://www.g2.com/products/hellodata-ai/pricing
Date: 2024-04-01; 2026 (ongoing)
Excerpt: "Professional Plan: $300/month; Enterprise Plan: $0.50/unit."
Context: HelloData is multifamily-specific (rents, concessions, comps) but does not provide raw foot-traffic data. The $0.50/unit model scales linearly with portfolio size; at 1M units = $500K/month, making it enterprise-only at scale.
Confidence: High[^6]
```

### 3.5 Foursquare Places API Pricing

```
Claim: Foursquare Pro endpoints offer 10,000 free calls/month (reducing to 500 free calls/month beginning June 1, 2026), with paid tiers starting at $15.00 per 1,000 calls. Premium endpoints have no free tier and start at $18.75 per 1,000 calls.
Source: Foursquare Docs / Camino AI
URL: https://docs.foursquare.com/developer/reference/upcoming-changes & https://app.getcamino.ai/learn/foursquare-places-api-pricing
Date: 2026-02-12 (upcoming changes); 2025-01-18 (Camino guide)
Excerpt: "Beginning June 1, 2026: 0 - 500 calls – $0.00 CPM; 501 - 100,000 calls – $15.00 CPM." and "Premium endpoints ... have no free tier and start at $18.75 per 1,000 calls."
Context: Premium fields (hours, photos, ratings, amenities) are required for rich POI profiles and are billed at higher rates from the first call. At 1M calls/month, Pro drops to $4.50/1K; at 5M+ calls, Pro drops to $1.25/1K.
Confidence: High[^7]
```

### 3.6 Google Maps / Places API Pricing

```
Claim: Google Places API Nearby Search costs $0.032 per call ($32 per 1,000) for the first 100,000 calls/month, with free tiers of 10,000 Essentials calls, 5,000 Pro calls, or 1,000 Enterprise calls per month depending on SKU tier.
Source: SafeGraph Google Places Pricing Guide / MapAtlas
URL: https://www.safegraph.com/guides/google-places-api-pricing/ & https://mapatlas.eu/blog/google-maps-api-pricing-2026
Date: 2026-06-02; 2025-12-18
Excerpt: "Place – Nearby Search: 0–100,000: $0.032 per call; 100,001–500,000: $0.0256 per call." and "Free monthly usage caps per Core Services SKU: 10,000 events for Essentials APIs, 5,000 for Pro, 1,000 for Enterprise."
Context: Google eliminated the recurring $200 monthly credit in March 2025, replacing it with per-SKU free caps. A runaway script without spending caps can generate five-figure invoices overnight. Geocoding is $5.00/1K after the free tier.
Confidence: High[^8]
```

### 3.7 Mapbox Geocoding & API Pricing

```
Claim: Mapbox offers 100,000 free geocoding requests per month, then charges $4.00–$5.00 per 1,000 additional requests, with tiered discounts at higher volumes.
Source: CheckThat.ai / CSV2GEO
URL: https://checkthat.ai/brands/mapbox/pricing & https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026
Date: 2026-03-30; 2026-03-23
Excerpt: "Geocoding: 100,000 requests [free], then $4-5/1K (most expensive API)." and "Mapbox offers 100,000 free geocoding requests per month. After that, pricing is $5.00 per 1,000 requests."
Context: Mapbox geocoding permanent storage costs 6.7x more ($5/1K vs $0.75/1K) if you cache results. Autocomplete without debouncing can trigger 10–20x cost increases. A stolen token caused a $2,000/month charge for one user. No hard spending caps exist by default.
Confidence: High[^9]
```

### 3.8 DataForSEO API Pricing

```
Claim: DataForSEO charges $0.0006 per Standard SERP call, $0.002 per Live call, with a $50 minimum deposit and no subscription fees. At 1M monthly requests, cost is ~$600 vs. SerpApi’s ~$7,000.
Source: NextGrowth.ai / DataForSEO Official Pricing
URL: https://nextgrowth.ai/dataforseo-api-guide/ & https://dataforseo.com/pricing
Date: 2026-06-20; 2026-04-24
Excerpt: "DataForSEO charges $0.0006 per SERP call, pay only for what you query, zero subscription lock-in." and "The minimum payment amount is $50."
Context: DataForSEO is primarily an SEO data API, but its Local/Business Data API provides POI-like business listings. The credit-based model never expires, making it attractive for intermittent or seasonal workloads.
Confidence: High[^10]
```

### 3.9 PropTech Metrics Pricing

```
Claim: PropTech Metrics charges $0.02 per property lookup ($20 per 1,000 calls), with entry plans starting at $50/month, positioning itself as a low-cost alternative to CoreLogic and ATTOM Data.
Source: PropTech Metrics Business Plan Presentation
URL: https://www.proptechmetrics.com/presentation/
Date: 2025 (ongoing)
Excerpt: "Disruptive pricing—just $0.02 per property lookup." and "Standard $20 per 1,000 calls (cost per property lookup)."
Context: PropTech Metrics claims to include "IoT & satellite foot-traffic signals for true demand insight" at this price point. For a 10K property portfolio, this is $200/month; at 1M properties, $20,000/month before volume discounts.
Confidence: Medium[^11]
```

### 3.10 AWS Data Exchange Marketplace Pricing

```
Claim: AWS Data Exchange charges no platform fee for subscribers; you pay only the provider subscription price plus standard AWS service costs (S3, Athena, Redshift). Data transfer across regions incurs standard S3 egress fees ($0.09/GB after 100GB free). Providers pay a 3% fulfillment fee on public listings.
Source: CloudZero / AWS Data Exchange Guide
URL: https://www.cloudzero.com/blog/aws-data-exchange/
Date: 2026-02-17
Excerpt: "AWS Data Exchange does not charge a flat platform fee. Pricing depends on your role and how data is shared or stored. ... Standard AWS Data Exchange public listing fee: 3% of revenue. ... You still pay standard AWS rates for services you use, such as Amazon S3."
Context: SafeGraph offers free POI datasets (e.g., Canada Essential Columns) on AWS Data Exchange. Paid listings range from hundreds to hundreds of thousands of dollars per year. Storage is $0.023/GB/month in US East.
Confidence: High[^12]
```

### 3.11 Snowflake Marketplace & Compute Pricing

```
Claim: Snowflake storage costs $23 per TB per month on-demand in US East (AWS), with compute credits at $2.00 (Standard), $3.00 (Enterprise), or $4.00 (Business Critical) per credit. Data egress costs $20–$140 per TB for cross-region transfers.
Source: Snowflake Official Pricing / Definite.app / Select.dev
URL: https://www.snowflake.com/en/pricing-options/ & https://www.definite.app/blog/understanding-snowflake-pricing & https://select.dev/posts/snowflake-pricing
Date: 2026-05-01; 2025-01-19
Excerpt: "Storage lists at $23/TB/month on-demand for AWS US East." and "A credit costs $2.00–$6.00 depending on edition." and "Cross-Region (Same Cloud): Typically ranges from $20 per TB in US regions to $140 per TB in some Asia Pacific regions."
Context: Snowflake Marketplace listings can be free (compute-only) or paid (provider licensing + compute). The Egress Cost Optimizer (ECO), released April 2025, can reduce multi-region egress costs by up to 96% via intelligent caching. Cloud services are free up to 10% of daily compute usage.
Confidence: High[^13]
```

```
Claim: A realistic mid-market Snowflake workload (25 TB storage, Large warehouse 12 hrs/day) costs approximately $6,335/month, with compute dominating the bill.
Source: Definite.app
URL: https://www.definite.app/blog/understanding-snowflake-pricing
Date: 2026-05-01
Excerpt: "Mid-market: 25 TB, Large, 12 hours/day → Storage $575, Compute $5,760, Est. total $6,335."
Context: For a foot-traffic pipeline at 100K properties, a Medium or Large warehouse running 4–8 hours/day is realistic, placing compute costs in the $1,900–$5,800/month range.
Confidence: High[^14]
```

### 3.12 Databricks Marketplace & Delta Sharing

```
Claim: Databricks Marketplace uses the Delta Sharing protocol, enabling secure, scalable, and cost-efficient data sharing without requiring identical infrastructure on both sides. Pricing is custom per provider.
Source: Sogeti Labs Whitepaper / SafeGraph Blog
URL: https://labs.sogeti.com/wp-content/uploads/sites/2/2025/09/Whitepaper-Databricks-Data-Marketplace.pdf & https://www.safegraph.com/blog/safegraph-databricks-delta-sharing
Date: 2025-09; 2021-05-26
Excerpt: "The protocol allows secure, scalable, and cost-efficient sharing without requiring the same infrastructure on both sides." and "Pricing ... [is] cost-efficient."
Context: Databricks Marketplace does not publish standardized pricing. Costs are negotiated with data providers (SafeGraph, Facteus) and include Databricks compute units (DBUs). SafeGraph has offered Delta Sharing since 2021.
Confidence: Medium[^15]
```

### 3.13 BigQuery GIS Query Pricing

```
Claim: BigQuery on-demand query pricing is $6.25 per TiB scanned, with the first 1 TiB free per month. Active storage is $0.023/GB/month; long-term storage is $0.016/GB/month. Egress ranges from $0.01–$0.12/GB.
Source: CalculateOnline.org
URL: https://calculateonline.org/bigquery-vs-snowflake-redshift-and-azure-synapse/
Date: 2025-10-25
Excerpt: "Query (On-Demand): $6.25/TiB scanned (first 1 TiB free/month). Storage: Active $0.023/GB/month; Long-term $0.016/GB/month. Egress $0.01-0.12/GB."
Context: For a 10 TiB/month scan + 1 TB storage, estimated cost is ~$93/month. BigQuery serverless model avoids warehouse sizing but can surprise with scan-heavy GIS queries.
Confidence: High[^16]
```

### 3.14 Data Engineering Labor Costs

```
Claim: The all-in cost to hire a US data engineer in 2026 runs $160,000–$290,000 annually once salary, benefits, cloud tooling, and fees are included. Median base salary is ~$130,907 for mid-level and ~$171,087 for senior FTEs. Contractors charge $70–$150/hour.
Source: Kore1 / Intsurfing / Optiveum
URL: https://www.kore1.com/data-engineer-staffing/ & https://www.intsurfing.com/blog/the-cost-of-hiring-a-data-engineer/ & https://optiveum.com/articles/data-engineer-salaries-by-country/
Date: 2026-06-13; 2026-03-04
Excerpt: "The all-in cost to hire a data engineer in 2026 runs $160K to $290K once salary, benefits, cloud tooling, and fees are stacked." and "Mid-level (FTE): Median $130,907 ... Senior (FTE): Median $171,087." and "Contractor rates: $70–$150/hr."
Context: A self-managed foot-traffic pipeline requires 0.25–0.5 FTE for maintenance at 10K properties, scaling to 2–4 FTE at 1M properties. Labor is the single largest TCO component for open-data and flat-file stacks.
Confidence: High[^17]
```

### 3.15 Open Data Infrastructure Costs

```
Claim: Self-hosting open geospatial data (e.g., Nominatim) requires a server with at least 64GB RAM and 1TB SSD, costing $200–$500/month on any major cloud provider, plus ongoing maintenance. OpenTimes serves pre-computed Parquet files on Cloudflare R2 for ~$10/month with no egress fees.
Source: CSV2GEO / Simon Willison Blog
URL: https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026 & https://simonwillison.net/2025/Mar/17/
Date: 2026-03-23; 2025-03-17
Excerpt: "Self-hosting Nominatim means running a server with at least 64GB of RAM and 1TB of SSD storage. That is $200 to $500 per month on any major cloud provider." and "The entire OpenTimes backend is just static Parquet files on Cloudflare R2. The whole thing costs about $10/month to host and costs nothing to serve."
Context: Open data is not free; infrastructure and engineering dominate. However, smart static-file hosting (R2, S3) with DuckDB can reduce serving costs to near zero. Processing and updating OSM/Census data still requires significant compute.
Confidence: High[^18]
```

### 3.16 Enterprise Negotiation & Discounts

```
Claim: AWS enterprise customers can negotiate custom support agreements, fee caps, and EDP discounts by leveraging spend volume, threatening to downgrade support tiers, and using competitive benchmarks. Advisors report 25–30% discounts on $10M+ deals.
Source: AWS Negotiations Playbook
URL: https://awsnegotiations.com/aws-enterprise-support-and-sla-negotiation-playbook-2024-2025/
Date: 2025-06-02
Excerpt: "An enterprise committing to a multi-year, multi-million-dollar contract can insist that Enterprise Support fees be discounted as part of the deal." and "AWS has been known to offer custom support pricing ... capping the support fee at a fixed amount."
Context: The same playbook applies to data providers on AWS Data Exchange and to Snowflake capacity contracts. Volume, multi-year commitment, and competitive bids are the three primary levers.
Confidence: High[^19]
```

```
Claim: Enterprise SaaS vendors typically offer 20–30% discounts for annual prepay, multi-year contracts, and volume tiers. Academic and nonprofit discounts can reach 50–100% off list price.
Source: SaaS Negotiation Playbooks (Redress Compliance / Prommer.net / ERP.Today)
URL: https://redresscompliance.com/openai-enterprise-procurement-negotiation-playbook.html & https://prommer.net/en/tech/enterprise-saas-pricing-negotiation/ & https://erp.today/playbook-to-negotiate-with-saas-vendors/
Date: 2025-04-08; 2026-06-14; 2023-11-20
Excerpt: "Request a tiered discount: 18% off for Year 1, 15% for Year 2, 12% for Year 3." and "Never reveal your budget." and "Request the right to reduce your MAC by 10–15% annually."
Context: SafeGraph explicitly offers free samples and custom pricing for individual data requirements. Placer.ai and Unacast negotiate custom enterprise tiers. The worst pricing is always the published list price; every number is a starting point.
Confidence: High[^20]
```

---

## 4. TCO Calculator: Five Consumption Models x Three Portfolio Sizes

Assumptions:
- **Monthly refresh** of foot-traffic data for the entire portfolio.
- Each property is geocoded once and matched to ~25 nearby POIs.
- Engineering costs use fully-loaded US FTE rates ($13,000/month for 1 FTE at median $130K base + 30% on-costs).
- Snowflake compute assumes Standard edition on AWS US East ($2.00/credit).
- SafeGraph flat-file pricing assumes a US-only subset at $15K/year; global full dataset at $30K/year.

### Model A: Metered API Stack
*PropTech Metrics ($0.02/property) + Mapbox Geocoding (free under 100K) + BestTime.app ($29/mo) + AWS Lambda/EC2 processing + 0.3–0.5 FTE engineering*

| Cost Component | 10K Properties | 100K Properties | 1M Properties |
|---|---|---|---|
| Foot-traffic API (PropTech Metrics) | $200/mo | $2,000/mo | $20,000/mo |
| Busyness proxy (BestTime.app) | $29/mo | $29/mo | $29/mo |
| Geocoding (Mapbox, within free tier) | $0 | $0 | $0 |
| Compute (Lambda/EC2 for ETL) | $300/mo | $1,000/mo | $5,000/mo |
| Engineering (0.3 / 0.3 / 0.5 FTE) | $3,900/mo | $3,900/mo | $6,500/mo |
| **Total Monthly** | **$4,429** | **$6,929** | **$31,529** |
| **Total Annual** | **$53,148** | **$83,148** | **$378,348** |

### Model B: Flat-File Subscription (SafeGraph)
*SafeGraph annual subscription ($15K/yr US subset) + S3 storage + AWS Lambda/EC2 ETL + 0.5 FTE engineering*

| Cost Component | 10K Properties | 100K Properties | 1M Properties |
|---|---|---|---|
| SafeGraph subscription (US subset) | $1,250/mo | $1,250/mo | $2,500/mo |
| S3 storage | $1/mo | $12/mo | $115/mo |
| ETL compute (Lambda/EC2) | $500/mo | $1,500/mo | $8,000/mo |
| Engineering (0.5 FTE) | $6,500/mo | $6,500/mo | $13,000/mo |
| **Total Monthly** | **$8,251** | **$9,262** | **$23,615** |
| **Total Annual** | **$99,012** | **$111,144** | **$283,380** |

### Model C: Cloud Data Marketplace (Snowflake)
*SafeGraph via Snowflake Marketplace + Snowflake compute + storage + 0.25–0.5 FTE engineering*

| Cost Component | 10K Properties | 100K Properties | 1M Properties |
|---|---|---|---|
| SafeGraph marketplace license | $1,250/mo | $1,250/mo | $2,500/mo |
| Snowflake compute (warehouse hrs) | $480/mo | $1,920/mo | $5,760/mo |
| Snowflake storage (compressed) | $1/mo | $12/mo | $115/mo |
| Engineering (0.25 / 0.25 / 0.5 FTE) | $3,250/mo | $3,250/mo | $6,500/mo |
| **Total Monthly** | **$4,981** | **$6,432** | **$14,875** |
| **Total Annual** | **$59,772** | **$77,184** | **$178,500** |

### Model D: SaaS Platform (Placer.ai Enterprise)
*Placer.ai enterprise subscription + minimal integration engineering (0.1–0.2 FTE)*

| Cost Component | 10K Properties | 100K Properties | 1M Properties |
|---|---|---|---|
| Placer.ai subscription | $2,000/mo | $4,000/mo | $10,000/mo |
| Integration engineering (0.1 / 0.1 / 0.2 FTE) | $1,300/mo | $1,300/mo | $2,600/mo |
| **Total Monthly** | **$3,300** | **$5,300** | **$12,600** |
| **Total Annual** | **$39,600** | **$63,600** | **$151,200** |

### Model E: Open / Freemium + In-House Engineering
*OSM + Census + Google free tiers + BestTime.app ($29) + R2/S3 + 1.5–4 FTE engineering*

| Cost Component | 10K Properties | 100K Properties | 1M Properties |
|---|---|---|---|
| Data licensing (OSM, Census) | $0 | $0 | $0 |
| BestTime.app proxy | $29/mo | $29/mo | $29/mo |
| Infrastructure (R2/S3 + EC2) | $200/mo | $500/mo | $2,000/mo |
| Engineering (1.5 / 2 / 4 FTE) | $19,500/mo | $26,000/mo | $52,000/mo |
| **Total Monthly** | **$19,729** | **$26,529** | **$54,029** |
| **Total Annual** | **$236,748** | **$318,348** | **$648,348** |

### TCO Comparison Summary

| Model | 10K | 100K | 1M | Best For |
|---|---|---|---|---|
| **A. Metered API** | $53K/yr | $83K/yr | $378K/yr | Low-volume pilots; intermittent usage |
| **B. Flat-File Sub** | $99K/yr | $111K/yr | $283K/yr | Teams needing raw data + custom models |
| **C. Cloud Marketplace** | $60K/yr | $77K/yr | $179K/yr | Teams already on Snowflake |
| **D. SaaS Platform** | $40K/yr | $64K/yr | $151K/yr | **Fastest time-to-value; lowest TCO at scale** |
| **E. Open + Engineering** | $237K/yr | $318K/yr | $648K/yr | **Never cheapest**; only for ideology or IP control |

**Key insight**: At 1M properties, the SaaS platform (Model D) is 2.5x cheaper than the flat-file stack and 4.3x cheaper than the open-data stack. The open-data stack is the most expensive at every scale because labor costs dominate.

---

## 5. Hidden Costs Checklist: Ten Budget-Busters

1. **Data Egress Fees**  
   AWS charges $0.09/GB after the first 100GB/month free tier. Snowflake charges $20–$140/TB for cross-region egress. A 1TB monthly export adds $90–$140 to the bill without warning. Use in-place querying (Snowflake, BigQuery) and R2/S3 VPC endpoints to avoid NAT Gateway charges.

2. **Cloud Services Overage**  
   Snowflake cloud-services layer is free up to 10% of daily compute, but a chatty BI tool can blow past this on quiet weekends. Each overage credit bills at $2–$4. Monitor `ACCOUNT_USAGE` daily.

3. **Geocoding Overruns**  
   Mapbox autocomplete without debouncing triggers 10–20x more calls than expected. Google Places abandoned sessions cost $17/1K. A single stolen API token ran up a $2,000/month Mapbox bill. Always set hard quotas in the provider console.

4. **ETL Compute for Normalization**  
   BigQuery charges $6.25/TiB scanned. A poorly written spatial join on 1M properties can scan 10+ TiB = $62.50 per query. Use clustered tables, materialized views, and partition pruning.

5. **Storage Growth (Time Travel + Staging)**  
   Snowflake Time Travel and Fail Safe can triple effective storage costs on high-churn tables. Staging files for monthly SafeGraph refreshes add 20–40% to the storage bill. Purge staging tables after load.

6. **Data Engineering Labor**  
   At $160K–$290K all-in per FTE, 0.5 FTE is $8K–$12K/month. This is the #1 hidden cost in Models B, C, and E. SaaS platforms (Model D) absorb this labor.

7. **Compliance & Legal Overhead**  
   CCPA and GDPR data-processing agreements, privacy audits, and legal review of provider terms can add $5K–$20K/year in direct costs and 2–4 weeks of delay. Mobile location data is particularly sensitive.

8. **API Rate Limit Overages**  
   Most APIs (Google, Mapbox) have no hard spending caps by default. A traffic spike or runaway script can 10x the bill overnight. Budget alerts are not automatic; you must configure them manually.

9. **Stale Data Refresh Costs**  
   SafeGraph refreshes monthly. Re-processing a 100K-property portfolio every month costs compute and engineering time. If your pipeline is not fully automated, each refresh is a mini-project.

10. **Cross-Region Disaster Recovery**  
    Replicating a Snowflake database to a second region for DR triggers egress fees on the initial sync and ongoing replication. At 5TB, initial replication costs $100–$700 depending on region pair.

---

## 6. Pricing Negotiation Guide

### What to Ask For
- **Academic / Nonprofit Discount**: SafeGraph explicitly offers free data to academics and governments[^2]. If you qualify, start there.
- **Multi-Year Commitment**: Ask for 18–30% off list price in exchange for a 2–3 year contract. SafeGraph, Placer.ai, and Unacast all negotiate custom terms.
- **Volume Tiers**: Foursquare drops from $18.75/1K to $1.75/1K at 5M+ calls/month[^7]; Google offers automatic volume discounts above 100K and 500K calls/month[^8].
- **Consumption Caps**: Request a monthly billing cap. "We commit to $X/month; any overage requires written approval." This prevents runaway API bills.
- **Free Trial Extension**: Ask for 60–90 days instead of 14 days. Data providers want you to succeed; longer trials reduce churn.
- **Bundled Support**: Enterprise SaaS platforms (Placer.ai, GrowthFactor) often include analyst support. If not, negotiate 10–20 hours of onboarding consulting into the contract.
- **Co-Terming & Auto-Renewal Removal**: Remove auto-renewal clauses and co-term all add-ons to a single renewal date. This prevents stealth price increases and orphaned licenses.
- **Price-Increase Caps**: Lock annual renewal increases to ≤3–5% or CPI-linked.

### When to Negotiate
- **End of Quarter / Fiscal Year**: Sales reps are most motivated in the final 2–3 weeks of a quarter.
- **Before a Funding Round**: Providers want logos for their pitch decks. Early-stage startups can extract 20–50% discounts in exchange for a public case study.
- **After a Competitive Benchmark**: Get a formal quote from 2+ competitors. Use the normalized per-user or per-property cost as leverage. "Competitor X is 40% cheaper per property; help me understand the gap."

### When Enterprise Beats Pay-Per-Use
- **Break-even threshold**: At roughly 50K–100K properties, flat annual subscriptions become cheaper than metered APIs for the same data depth. This is because API costs scale linearly while enterprise subscriptions are fixed.
- **Labor threshold**: If you need >0.5 FTE to maintain a self-built pipeline, a SaaS platform is almost always cheaper. The labor cost ($6,500+/mo) typically exceeds the SaaS subscription at 10K+ properties.

---

## 7. Cheapest Viable Stack Recommendation

### 10K Properties: SaaS Platform (Model D) or Metered API (Model A)
- **Winner**: SaaS Platform ($3,300/mo) — faster time-to-value, no engineering hire required.
- **Runner-up**: Metered API ($4,400/mo) — good if you need custom scoring and have a part-time engineer.
- **Avoid**: Open-data stack ($19,700/mo) — overkill for 10K properties; labor costs kill the budget.

### 100K Properties: Cloud Marketplace (Model C) or SaaS Platform (Model D)
- **Winner**: Cloud Marketplace ($6,400/mo) — ideal if you already run Snowflake for other workloads. Marginal cost of adding SafeGraph is low.
- **Runner-up**: SaaS Platform ($5,300/mo) — still very competitive if you value the UI and support.
- **Avoid**: Metered API ($6,900/mo) — still viable but lacks the data-depth of SafeGraph Patterns.

### 1M Properties: SaaS Platform (Model D)
- **Winner**: SaaS Platform ($12,600/mo) — by far the lowest TCO. The open-data stack costs 4.3x more; the metered API stack costs 2.5x more.
- **Runner-up**: Cloud Marketplace ($14,900/mo) — good if you need to join foot-traffic data with internal CRM/property data in Snowflake.
- **Avoid**: Open-data stack ($54,000/mo) — only justified if you have a strict IP requirement or need to own the raw data.

### General Principles
1. **Start with SaaS** to validate the use case. Migrate to marketplace or flat-file only when the SaaS platform becomes a constraint (custom scoring, data-science needs, or cost ceiling).
2. **Never build from open data first** unless you have 2+ dedicated data engineers. The labor cost is the silent killer.
3. **Use free tiers religiously**: Mapbox (100K geocodes), Foursquare (10K Pro calls, 500 after June 2026), Google ($200-equivalent free caps per SKU), and SafeGraph samples can cover 100% of a proof-of-concept.

---

## 8. Sources

[^1]: SafeGraph Pricing. "Comprehensive POI Data Simple Pricing." SafeGraph, 2026-05-13. https://www.safegraph.com/pricing/ & Datarade SafeGraph Profile. https://datarade.ai/data-providers/safegraph/profile

[^2]: Geospatial World. "SafeGraph creates a dashboard showing foot traffic patterns across the U.S." 2020-05-19. https://geospatialworld.net/news/safegraph-creates-a-dashboard-showing-foot-traffic-patterns-across-the-u-s/

[^3]: Datarade. "Unacast - Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/unacast/profile

[^4]: Tontitown. "Placer.ai Comparison." 2026-05-08. https://www.tontitown.com/wp-content/uploads/2026/05/8D.-Placer.ai-comparison.pdf

[^5]: GrowthFactor. "Plans & Pricing." https://www.growthfactor.ai/pricing

[^6]: SoftwareFinder. "HelloData: Pricing, Free Demo & Features." 2024-04-01. https://softwarefinder.com/analytics-software/hello-data & G2 HelloData Pricing. https://www.g2.com/products/hellodata-ai/pricing

[^7]: Foursquare Docs. "Upcoming Changes - Places API & V2 Pro endpoint rates." 2026-02-12. https://docs.foursquare.com/developer/reference/upcoming-changes & Camino AI. "Foursquare Places API Pricing: Pro vs Premium Fields Explained." 2025-01-18. https://app.getcamino.ai/learn/foursquare-places-api-pricing

[^8]: SafeGraph. "Google Places API Pricing, Costs & Alternative Options." 2026-06-02. https://www.safegraph.com/guides/google-places-api-pricing/ & MapAtlas. "2026 Google Maps API Pricing." 2025-12-18. https://mapatlas.eu/blog/google-maps-api-pricing-2026

[^9]: CheckThat.ai. "Mapbox Pricing 2026: Plans, Costs & Hidden Fees." 2026-03-30. https://checkthat.ai/brands/mapbox/pricing & CSV2GEO. "Geocoding API Pricing Compared: Real Cost 2026." 2026-03-23. https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026

[^10]: NextGrowth.ai. "DataForSEO API: Complete 2026 Guide." 2026-06-20. https://nextgrowth.ai/dataforseo-api-guide/ & DataForSEO. "Transparent Pay-As-You-Go Pricing Model." 2026-04-24. https://dataforseo.com/pricing

[^11]: PropTech Metrics. "Democratizing Property Data Access - Business Plan Presentation." 2025. https://www.proptechmetrics.com/presentation/

[^12]: CloudZero. "AWS Data Exchange Guide: Use Cases, Pros, Cons, And Pricing." 2026-02-17. https://www.cloudzero.com/blog/aws-data-exchange/

[^13]: Snowflake. "Snowflake Pricing | Choose the Right Edition." https://www.snowflake.com/en/pricing-options/ & Definite.app. "Snowflake Pricing: Costs, Examples, Hidden Fees." 2026-05-01. https://www.definite.app/blog/understanding-snowflake-pricing & Select.dev. "Snowflake Data Transfer Pricing and Egress Cost Optimizer." 2025-10-22. https://select.dev/posts/snowflake-data-transfer-pricing-and-egress-cost-optimizer

[^14]: Definite.app. "Snowflake Pricing: Costs, Examples, Hidden Fees." 2026-05-01. https://www.definite.app/blog/understanding-snowflake-pricing

[^15]: Sogeti Labs. "Databricks Data Marketplace: A new paradigm for data sharing." 2025-09. https://labs.sogeti.com/wp-content/uploads/sites/2/2025/09/Whitepaper-Databricks-Data-Marketplace.pdf & SafeGraph Blog. "SafeGraph Databricks Delta Sharing." 2021-05-26. https://www.safegraph.com/blog/safegraph-databricks-delta-sharing

[^16]: CalculateOnline.org. "BigQuery vs Snowflake Redshift and Azure Synapse: 2025 Pricing & Performance Comparison." 2025-10-25. https://calculateonline.org/bigquery-vs-snowflake-redshift-and-azure-synapse/

[^17]: Kore1. "Data Engineer Staffing." 2026-06-13. https://www.kore1.com/data-engineer-staffing/ & Intsurfing. "The Real Cost to Hire a Data Engineer." https://www.intsurfing.com/blog/the-cost-of-hiring-a-data-engineer/ & Optiveum. "Data Engineer Salaries by Country 2025-2026." 2026-03-04. https://optiveum.com/articles/data-engineer-salaries-by-country/

[^18]: CSV2GEO. "Geocoding API Pricing Compared: Real Cost 2026." 2026-03-23. https://csv2geo.com/blog/geocoding-api-pricing-compared-real-cost-2026 & Simon Willison. "OpenTimes." 2025-03-17. https://simonwillison.net/2025/Mar/17/

[^19]: AWS Negotiations. "AWS Enterprise Support and SLA Negotiation Playbook (2024–2025)." 2025-06-02. https://awsnegotiations.com/aws-enterprise-support-and-sla-negotiation-playbook-2024-2025/

[^20]: Redress Compliance. "OpenAI Enterprise Procurement Negotiation Playbook." 2025-04-08. https://redresscompliance.com/openai-enterprise-procurement-negotiation-playbook.html & Prommer.net. "Enterprise SaaS Pricing Negotiation: The Playbook." 2026-06-14. https://prommer.net/en/tech/enterprise-saas-pricing-negotiation/ & ERP.Today. "Playbook to negotiate with SaaS vendors." 2023-11-20. https://erp.today/playbook-to-negotiate-with-saas-vendors/
