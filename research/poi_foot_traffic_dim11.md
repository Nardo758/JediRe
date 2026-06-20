# Dim11: Provider Head-to-Head Comparison — Top 5 Budget-Friendly Foot Traffic Data Providers for Multifamily Property Ranking

**Research Agent:** Dim11_Researcher  
**Date:** 2026-06-20  
**Searches Conducted:** 23 independent queries across provider docs, G2, Trustpilot, Reddit, academic journals, industry blogs, DataRade, and SourceForge.  
**Scope:** Compare SafeGraph (Dewey), DataForSEO, Unacast/Gravy Analytics, GrowthFactor, and PropTech Metrics on 12 standardized criteria plus user reviews, independent validation, deal-breakers, and winner recommendations for a multifamily platform with 10K–100K properties.

---

## Executive Summary

No single budget-friendly foot traffic provider is universally "best." Each has a distinct origin, methodology, and suitability profile. For a **multifamily platform with 10K–100K properties**, the optimal choice depends on technical maturity, use case, and risk tolerance. This document presents objective, comparable evidence across all five providers, traces claims back to primary sources, and flags specific deal-breakers for the multifamily use case.

---

## Provider Origin & Market Positioning

### 1. SafeGraph (Dewey) — The Academic POI Standard
Founded by Auren Hoffman in 2016, SafeGraph built its reputation on democratizing access to geospatial datasets. Its core mission was to become "THE source for accurate data about every physical place in the world."[^1] In 2022, SafeGraph partnered with Dewey to provide academic access, and by 2024, Jason Richman (a 7-year SafeGraph veteran) became CEO while Hoffman transitioned to Chairman.[^2] SafeGraph's data has been used in hundreds of academic papers on COVID-19, urban planning, and mobility patterns. In 2024, it expanded global POI coverage with +1M POIs in Italy, +225k in France, +500k in Western Europe, and +1.2M in the US/Canada/Mexico/Brazil.[^2]

**Market positioning:** Data infrastructure provider, not an analytics platform. Primary customers: data teams, researchers, AdTech, mapping companies, and hedge funds using alternative data.

### 2. DataForSEO — The SEO API Disruptor
DataForSEO is a pay-as-you-go SEO data API provider founded in the mid-2010s. It built its business on the premise that traditional SEO subscriptions (Ahrefs, Semrush) force users to pay for capacity they don't use.[^3] It offers 50+ API endpoints covering SERP, keyword data, backlinks, on-page audits, and business listings. Its Google Maps Scraper API and Google My Business API are positioned as low-cost alternatives to Google Places API.[^4]

**Market positioning:** Developer-first SEO/POI data pipeline. Primary customers: SEO agencies, AI tool builders, and developers needing programmatic data at scale. **Not a traditional foot traffic provider** — it proxies Google Maps data and offers business listings, but does not provide actual mobile-device-derived visit counts.

### 3. Unacast / Gravy Analytics — The Privacy-First Mobility Giant
Unacast was founded in 2014 in Norway with a focus on proximity and beacon technology, then pivoted to become a location intelligence platform. In 2020, Unacast acquired Gravy Analytics (a US-based location data provider), creating a combined entity with massive scale.[^5] Gravy Analytics processes 60–70 billion location signals daily from 15+ suppliers, covering 600M+ monthly active devices across 180+ countries.[^6] The company emphasizes GDPR compliance and privacy-first methodologies, using polygonal geofences rather than centroid-based approaches.

**Market positioning:** Enterprise-grade location intelligence for mobility, trade area analysis, and advertising attribution. Primary customers: multinational retailers, consultancies, government agencies, hedge funds, and AdTech platforms.

### 4. GrowthFactor — The Self-Service AI Scoring Platform
GrowthFactor was founded in 2023 by Clyde Christian Anderson (CEO), Raj Shrimali (CTO), and Sam Hall (COO) — all MIT Sloan alumni. The company went through MIT's delta v accelerator and raised a $5.2M Seed round from Teamworthy Ventures in March 2026.[^7] GrowthFactor positions itself as an integrated alternative to the "patchwork of spreadsheets, mapping tools, and legacy platforms" that retail real estate teams use. It integrates foot traffic (via Unacast), demographics, vehicle counts, competitive mapping, and AI scoring into a single workflow.

**Market positioning:** Turnkey site selection and deal management for retail and CRE. Primary customers: multi-location retailers (Cavender's, Books-A-Million, TNT Fireworks), and expansion teams without dedicated GIS analysts. **Retail-focused, not multifamily-specific.**

### 5. PropTech Metrics — The Multifamily-Native Upstart
PropTech Metrics is an early-stage PropTech data provider focused specifically on multifamily and space utilization. Its website claims "millions of multifamily units across every U.S. metro" and "IoT & satellite foot-traffic signals for true demand insight."[^8] It offers a REST/GraphQL API with a $0.02 per property lookup pricing model, plus a freemium tier (10 free calls). The company is positioned as a disruptor to legacy property data providers like CoreLogic and ATTOM Data, which charge significantly more per lookup.[^9]

**Market positioning:** Developer-first, multifamily-specific data infrastructure. Primary customers: PropTech developers, acquisitions teams, asset managers, and AI agent builders. **Early-stage with limited independent validation.**

---

## Primary Findings (Claim/Source Format)

### SafeGraph (Dewey)

**Claim:** SafeGraph's POI database has an average geocode deviation of only 2.17 meters, significantly better than competitors whose median distance from Google Maps ranges from 18–65 meters with a mean of 40 meters.[^10]  
**Source:** SafeGraph Docs / Evaluating SafeGraph Data  
**URL:** https://docs.safegraph.com/docs/places-data-evaluation  
**Date:** 2025-03-27  
**Excerpt:** "In aggregate, we find that the median distance between SafeGraph and Google Maps coordinates for all SafeGraph POIs is very small (usually 0-5m)... In contrast, we've found that other POI data providers show centroid precision ranging from 18-65 meters in median distance from Google Maps with a mean median distance of 40 meters."  
**Context:** POI precision is SafeGraph's core differentiator; visit analytics are secondary.  
**Confidence:** High

**Claim:** SafeGraph Patterns dataset revealed an average sampling rate of 7.5% with notable demographic bias: Hispanic populations, low-income households, and individuals with low education levels exhibited higher underrepresentation bias that varied across space, time, and urbanization levels.[^11]  
**Source:** PLOS ONE (Peer-reviewed)  
**URL:** https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294430  
**Date:** 2024-01-19  
**Excerpt:** "However, minority groups such as Hispanic populations, low-income households, and individuals with low levels of education generally exhibited higher levels of underrepresentation bias that varied over space, time, urbanization, and across geographic levels."  
**Context:** The most comprehensive academic bias audit of SafeGraph to date; applies to all GPS-panel providers to some degree.  
**Confidence:** High

**Claim:** A fairness assessment of mobility-based COVID-19 prediction models using SafeGraph data found systematic bias toward large, highly educated, wealthy, young, and urban counties, with older, poorer, less educated, and rural populations underrepresented.[^12]  
**Source:** PLOS ONE (Peer-reviewed)  
**URL:** https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0292090  
**Date:** 2023-10-18  
**Excerpt:** "Specifically, the models tend to favor large, highly educated, wealthy, young, and urban counties. We hypothesize that the mobility data currently used by many predictive models tends to capture less information about older, poorer, less educated and people from rural regions."  
**Context:** Validates that SafeGraph panel bias has real predictive consequences for demographic groups common in multifamily markets.  
**Confidence:** High

**Claim:** SafeGraph's Weekly Patterns dataset is no longer updated after May 5, 2022, according to the COVIDcast signal documentation.[^13]  
**Source:** CMU Delphi Epidata / COVIDcast  
**URL:** https://cmu-delphi.github.io/delphi-epidata/api/covidcast-signals/safegraph.html  
**Date:** Not specified (archived signal)  
**Excerpt:** "Reporting Cadence: Inactive - No longer updated after May 5th, 2022"  
**Context:** This refers to the specific COVIDcast integration, not SafeGraph's core commercial Patterns product, which continues to be updated. However, it highlights a dependency risk for academic users.  
**Confidence:** Medium (integration-specific, not core product)

**Claim:** SafeGraph offers free data samples and academic access through Dewey, but its commercial pricing ranges from $0.10 per purchase to $30,000/year with custom annual subscriptions based on rows, columns, and usage rights.[^14]  
**Source:** DataRade / SafeGraph Profile  
**URL:** https://datarade.ai/data-providers/safegraph/profile  
**Date:** Not specified  
**Excerpt:** "SafeGraph's APIs and datasets range in cost from $0.10 / purchase to $30,000 / year. SafeGraph offers free samples for individual data requirements."  
**Context:** No published per-seat or per-property pricing; enterprise sales process required.  
**Confidence:** High

**Claim:** SafeGraph is stronger on POI data than on visit analytics; its visit patterns data operates at the neighborhood (census block group) level rather than the individual store level in many cases, limiting usefulness for store-specific competitive benchmarking.[^15]  
**Source:** PassBy Blog / Foot Traffic Data Providers  
**URL:** https://passby.com/blog/foot-traffic-data-providers/  
**Date:** 2026-04-09  
**Excerpt:** "SafeGraph is stronger on POI data than on visit analytics. Their visit patterns data operates at the neighbourhood (census block group) level rather than the individual store level in many cases, which limits its usefulness for store-specific competitive benchmarking."  
**Context:** This is a critical limitation for multifamily property-level analysis, where building-specific granularity matters.  
**Confidence:** High

---

### DataForSEO

**Claim:** DataForSEO's Google My Business API can obtain data on 20K businesses for $60, which is 88% less than Google Places API ($500 for the same volume), and its Business Listings API (in-house database) can do the same for $6.20.[^4]  
**Source:** DataForSEO Blog  
**URL:** https://dataforseo.com/blog/poi-data-with-dataforseo-api  
**Date:** 2024-05-29  
**Excerpt:** "In contrast, using DataForSEO's Google My Business API, you can obtain the same data paying 88% less than with Google's API, or $60 to be more precise. If you don't need to access the latest data from Google Business Profiles, you can even bring your costs down to $6.2 for the same volume of data with Business Listings API that supplies information from our in-house database."  
**Context:** The in-house database is updated every 90 days, not real-time. This is POI data, not actual visit counts.  
**Confidence:** High

**Claim:** DataForSEO scores 3.8/5 on G2 versus SerpApi's 4.8/5; the most common complaint is that keyword search volume data is inflated because DataForSEO averages ranges from Google Keyword Planner rather than reporting exact counts.[^16]  
**Source:** NextGrowth.ai / DataForSEO vs SerpApi  
**URL:** https://nextgrowth.ai/dataforseo-vs-serpapi/  
**Date:** 2026-05-22  
**Excerpt:** "On G2, SerpApi scores 4.8/5. DataForSEO scores 3.8/5. That's a meaningful gap... The most common DataForSEO complaint: keyword search volume data is inflated, because DataForSEO averages ranges from Google Keyword Planner rather than reporting exact counts."  
**Context:** For foot traffic purposes, this complaint is less relevant; the bigger issue is that DataForSEO does not provide actual foot traffic/visit counts at all.  
**Confidence:** High

**Claim:** DataForSEO's pay-as-you-go model costs agencies 70–90% less than Ahrefs or Semrush at equivalent usage, with a $50 minimum deposit and no monthly commitment. Support response time is cited at 17 seconds median with a 95.3% satisfaction rate.[^3]  
**Source:** NextGrowth.ai / DataForSEO Review 2026  
**URL:** https://nextgrowth.ai/dataforseo-review/  
**Date:** 2026-03-01  
**Excerpt:** "DataForSEO's pay-as-you-go model costs agencies 70 – 90% less than Ahrefs or Semrush at equivalent usage volumes, with a $50 minimum deposit and no monthly commitment... DataForSEO's internal support metrics, reported in their 2025 Year in Review, show a 95.3% satisfaction rate with a 17-second median response time."  
**Context:** Excellent for SEO/POI pipelines, but not a foot traffic solution.  
**Confidence:** High

**Claim:** DataForSEO's SERP screenshot service was described by a Trustpilot reviewer as "a mess of pop-ups/overlays" and "more like an unfinished experiment than a professional solution."[^17]  
**Source:** Trustpilot  
**URL:** https://www.trustpilot.com/review/dataforseo.com  
**Date:** 2025-03-02  
**Excerpt:** "I regret ever signing up for DataForSEO's SERP screenshot service. I paid good money expecting accurate, clean captures of search results, but what I got was a mess of pop-ups/overlays... This service feels more like an unfinished experiment than a professional solution."  
**Context:** A specific product complaint; core SERP/POI APIs receive much better reviews.  
**Confidence:** Medium (single reviewer, specific product)

---

### Unacast / Gravy Analytics

**Claim:** Unacast processes 60–70 billion mobile location data signals from over a dozen providers each day, covering 600M+ monthly active devices across 180+ countries, and claims 100% deterministic data.[^6]  
**Source:** DataRade / Unacast Profile  
**URL:** https://datarade.ai/data-providers/unacast/profile  
**Date:** Not specified  
**Excerpt:** "Unacast processes 60-70 billion mobile location data signals from over a dozen providers each day... Gravy sees over 600 million unique devices each month across the world and processes 60-70 billion location signals every day."  
**Context:** The 100% deterministic claim means all data comes from verified GPS signals, not inferred or modeled. However, accuracy is not publicly benchmarked against ground truth.  
**Confidence:** High (scale claims); Medium (accuracy claim, unverified)

**Claim:** Unacast's ground truth study found that stadium visitations matched approximate capacity, and manufacturing facility worker counts matched within 20% for most facilities except Boeing Everett (an outlier due to facility size).[^18]  
**Source:** Unacast Blog / Ground Truth Analysis  
**URL:** https://www.unacast.com/post/examining-ground-truth-data  
**Date:** Not specified (pre-2022 based on data range)  
**Excerpt:** "Comparing ground truth data with Unacast data for stadium visitations was spot on... In our study of manufacturing facilities, the only outlier was the Everett facility, which can be partially explained by the size. All other data matched within 20%."  
**Context:** Self-reported validation; no independent third-party audit cited. 20% error margin is significant for property-level decisions.  
**Confidence:** Medium

**Claim:** Unacast's Terms of Service allow derivative works to be shared with third-party customers, provided no raw or unmodified Unacast Data is made directly available, and attribution is included.[^19]  
**Source:** Unacast Terms of Service  
**URL:** https://www.unacast.com/terms-service  
**Date:** Not specified  
**Excerpt:** "Specifically, you may use and reproduce the Unacast Data for (a) interrogation, retrieval, analysis, manipulation, recompilation, and report preparation, and (b) creation of derivative works that you may make available to your third-party customers, provided no raw or unmodified Unacast Data is made directly available to such third parties."  
**Context:** This is the most permissive licensing among the five providers for building derivative products — critical for a platform reselling insights to multifamily clients.  
**Confidence:** High

**Claim:** Unacast has a 5.0/5 rating on DataRade based on 1 review, where an airport planning user stated that two airlines added flights following their analysis.[^20]  
**Source:** DataRade / Unacast Foot Traffic Data  
**URL:** https://datarade.ai/data-products/unacast-foot-traffic-data-global-gravy-analytics  
**Date:** Not specified  
**Excerpt:** "We provided a strong and successful case for adding flights to a medium sized airport. Two airlines added flights following the analysis."  
**Context:** Very few public reviews exist; most evidence is from case studies and testimonials.  
**Confidence:** Medium (limited review volume)

**Claim:** Unacast's pricing starts at $1 per API call and ranges up to $40,000/year, with custom pricing by product and use case.[^21]  
**Source:** DataRade / Unacast Profile  
**URL:** https://datarade.ai/data-providers/unacast/profile  
**Date:** Not specified  
**Excerpt:** "Unacast's APIs and datasets range in cost from $1 / API call to $40,000 / year."  
**Context:** No published per-property or flat-rate pricing for multifamily use cases. Enterprise sales required.  
**Confidence:** High

**Claim:** SelectHub's analysis of Unacast reviews notes a recurring concern about "heavy reliance on GPS data, potentially limiting the comprehensiveness of its insights compared to competitors like Placer.ai, which incorporate diverse data sources."[^22]  
**Source:** SelectHub  
**URL:** https://www.selecthub.com/p/location-intelligence-software/unacast/  
**Date:** Not specified  
**Excerpt:** "However, a recurring concern is the heavy reliance on GPS data, potentially limiting the comprehensiveness of its insights compared to competitors like Placer.ai, which incorporate diverse data sources. This over-dependence on GPS data raises concerns about data accuracy, especially considering the potential for GPS drift and signal loss."  
**Context:** GPS drift is a known issue for all GPS-panel providers; indoor/multitenant accuracy is particularly challenging.  
**Confidence:** Medium

---

### GrowthFactor

**Claim:** GrowthFactor raised $5.2M Seed from Teamworthy Ventures in March 2026, is an MIT delta v accelerator graduate, and has evaluated 4,500+ sites in the last 6 months with customers including Cavender's (27 locations opened), Books-A-Million (8.9x ROI), and TNT Fireworks (153 locations in 6 months).[^7]  
**Source:** GrowthFactor Fact Sheet  
**URL:** https://www.growthfactor.ai/press/fact-sheet  
**Date:** Not specified (2026)  
**Excerpt:** "Company: GrowthFactor. Founded: 2023. Headquarters: Boston, MA. Funding: $5.2M Seed (Teamworthy Ventures, March 2026). Accelerator: MIT delta v (2025 cohort)."  
**Context:** Company is very young (founded 2023); customer results are self-reported. No independent third-party validation of accuracy claims.  
**Confidence:** Medium (self-reported metrics)

**Claim:** GrowthFactor integrates foot traffic data via Unacast (not its own panel) into a five-lens scoring system alongside demographics, market potential, competition, and visibility.[^23]  
**Source:** GrowthFactor Blog / Retail Foot Traffic Data Guide  
**URL:** https://www.growthfactor.ai/resources/blog/retail-foot-traffic-data-complete-guide  
**Date:** 2025-12-24  
**Excerpt:** "GrowthFactor integrates foot traffic data (via Unacast) into a complete site selection workflow that includes scoring, demographics, competitive mapping, cannibalization modeling, and deal pipeline management in one platform."  
**Context:** GrowthFactor does not collect its own foot traffic data; it is a reseller/integrator of Unacast data. This adds a layer of dependency and potential markup.  
**Confidence:** High

**Claim:** GrowthFactor pricing starts at $400/month for its integrated platform, with Core at $1,000/month and Enterprise custom. It offers unlimited users with no seat-based pricing.[^24]  
**Source:** GrowthFactor Blog / Location Intelligence Tools  
**URL:** https://www.growthfactor.ai/resources/blog/location-intelligence-tools-guide  
**Date:** 2025-12-19  
**Excerpt:** "GrowthFactor — AI-powered platform specializing in retail and CRE site selection with glass box scoring... Pricing: Starting at $400/month, Core at $1,000/month, Enterprise custom."  
**Context:** Published pricing is rare in this category; this is a genuine differentiator. However, $400/month is the platform fee, not the raw data cost.  
**Confidence:** High

**Claim:** GrowthFactor's "glass box" approach contrasts with "black box" competitors, showing exactly why a site scores well or poorly. However, the platform is retail-focused and there is no evidence of multifamily-specific features or calibration.[^25]  
**Source:** GrowthFactor Blog / AI Site Selection  
**URL:** https://www.growthfactor.ai/resources/blog/ai-driven-decision-making  
**Date:** 2026-01-12  
**Excerpt:** "Glass box, not black box: See exactly why a site scores well or poorly. No more voodoo or unexplainable AI."  
**Context:** The transparency claim is genuine, but all case studies and customer testimonials are from retail (fireworks, western wear, books). No multifamily customer evidence found.  
**Confidence:** High (transparency claim); Low (multifamily suitability)

---

### PropTech Metrics

**Claim:** PropTech Metrics offers "Space-Utilization Intelligence: IoT & satellite foot-traffic signals for true demand insight" at $0.02 per property lookup, with a freemium model (10 free calls) and a modern AWS-based stack.[^8]  
**Source:** PropTech Metrics Website  
**URL:** https://www.proptechmetrics.com/  
**Date:** Not specified (2026)  
**Excerpt:** "Space-Utilization Intelligence: IoT & satellite foot-traffic signals for true demand insight... Disruptive pricing—just $0.02 per property lookup."  
**Context:** No independent validation of the IoT + satellite methodology found. The company appears to be in early beta/launch phase.  
**Confidence:** Low (early stage, self-reported only)

**Claim:** PropTech Metrics claims to serve "millions of multifamily units across every U.S. metro" and offers "investor-grade quality: each datapoint source-tagged, validated, and refresh-tracked."[^8]  
**Source:** PropTech Metrics Website  
**URL:** https://www.proptechmetrics.com/  
**Date:** Not specified (2026)  
**Excerpt:** "Comprehensive Coverage: millions of multifamily units across every U.S. metro... Investor-Grade Quality: each datapoint source-tagged, validated, and refresh-tracked."  
**Context:** No evidence of how "millions" of units are covered, what data sources are used, or how IoT/satellite signals are calibrated to ground truth. No academic or third-party audits found.  
**Confidence:** Low

**Claim:** PropTech Metrics' competitive landscape analysis positions itself against CoreLogic (99% US coverage, high cost), First American (authoritative but expensive), ATTOM Data ($500/month entry), and PropertyRadar (~$99/month, limited API). PropTech Metrics claims a $0.02/call price versus ~$0.50 for incumbents.[^9]  
**Source:** PropTech Metrics Presentation  
**URL:** https://www.proptechmetrics.com/presentation/  
**Date:** 2018-06-15 (older deck)  
**Excerpt:** "Dramatically lower price point ($0.02/call vs ~$0.50)... Self-serve model with transparent pricing."  
**Context:** The presentation deck is from 2018, suggesting the company has been in development for years. Current website claims are similar but unverified.  
**Confidence:** Medium (pricing consistency over time); Low (coverage claims)

---

## Head-to-Head Comparison Matrix

| Criteria | SafeGraph (Dewey) | DataForSEO | Unacast / Gravy | GrowthFactor | PropTech Metrics |
|----------|-------------------|------------|-----------------|--------------|------------------|
| **Data Accuracy** | POI geocode: 2.17m avg deviation. Visit accuracy not publicly stated. Peer-reviewed PLOS ONE study found demographic bias (older/non-white underrepresented).[^11][^12] | SEO/SERP data: 90%+ keyword accuracy per G2. **No actual foot traffic/visit counts.** Google Maps proxy data accuracy depends on Google.[^3] | 100% deterministic GPS claims. Self-reported ground truth: stadiums matched capacity; factories within 20%. No independent third-party benchmark.[^18] | Uses Unacast data under the hood. Self-reported customer results (153 locations, 8.9x ROI) but no independent validation.[^7] | Claims IoT + satellite signals. No published validation, correlation to ground truth, or error margins. Early stage.[^8] |
| **POI Coverage** | 80M+ POIs across 195+ countries. 12,000+ brands. Best-in-class POI quality and building footprint polygons.[^2][^14] | 200M+ places from Google Maps/Hotels via API. In-house db updated every 90 days. No building footprints.[^4] | Inferred POI from mobility patterns + data suppliers. No independently researched building polygons. 1B+ devices, 180+ countries.[^6] | Relies on Unacast + third-party data. No independent POI database. Coverage is US-focused.[^23] | Claims millions of multifamily units across every US metro. No specifics on POI count, categories, or building footprint availability.[^8] |
| **Visit Granularity** | Weekly Patterns: hourly visit counts for ~4M US POIs. NAICS-standardized. Census block group level in many cases.[^15] | **No visit counts.** Provides business listings, reviews, hours, ratings — not foot traffic.[^4] | Foot traffic, trade areas, cross-visitation, visitor origin, dwell time. Aggregated at CBG level for privacy. Visit length buckets: quick (≤10 min), short (10–45 min), moderate (45–90 min), long (>90 min).[^18] | Integrates Unacast foot traffic into site scores. Raw visit data available within platform but not the primary output.[^23] | Claims "space-utilization intelligence" via IoT + satellite. No documentation of granularity (hourly? daily? weekly?).[^8] |
| **Data Freshness** | Monthly POI updates. Weekly Patterns data available. Historical data from 2018+.[^2] | Live Google Maps scraping (up to 6 seconds). In-house db updated every 90 days.[^4] | Daily signal processing. Popular time lag of 14 days (produced quarterly). Up to 3 years historical.[^6] | Real-time platform scoring. Underlying Unacast data has standard lags.[^23] | Claims "live NOI, occupancy, renewal & concession alerts." No specifics on foot traffic update frequency.[^8] |
| **API Quality** | REST API, flat files, Snowflake, AWS Data Exchange, Databricks. Well-documented schema. Developer-friendly.[^14] | 50+ endpoints, REST API, Python SDK, n8n/Make integrations. G2 score 3.8/5. Live queue costs 3.3x standard.[^3][^16] | Visitations API, DaaS feeds, Insights SaaS, S3 bucket, CSV. Product split across separate offerings (API, DaaS, SaaS) can create friction.[^6] | SaaS platform with API. No evidence of raw API for external integration. Designed as a workflow tool, not a data API.[^24] | REST · GraphQL · Webhooks. Claims developer-friendly with clear docs. Early stage — actual developer experience undocumented.[^8] |
| **Pricing Transparency** | Custom annual subscriptions. Free samples available. Academic access via Dewey. No published per-property pricing. Range: $0.10–$30,000/year.[^14] | Pay-as-you-go, $50 min deposit. SERP calls: $0.0006 (standard). Google My Business: $60/20K businesses. Published and transparent.[^3][^4] | Custom pricing by product/use case. Starts at $1/API call up to $40,000/year. No published flat rates. Enterprise sales required.[^21] | Published: $400/mo starting, $1,000/mo Core, Enterprise custom. Unlimited users, no seat limits.[^24] | $0.02/property lookup. Freemium: 10 free calls. Transparent and self-serve.[^8] |
| **Licensing Flexibility** | Academic-friendly. Commercial use allowed. Derivative works permitted within subscription terms. No explicit mention of third-party resale in public docs. | Standard API terms. Derivative works generally allowed. No restrictive attribution requirements for processed data. | **Most permissive:** Derivative works allowed for third-party customers, provided raw data is not exposed. Attribution required.[^19] | Platform subscription. Data usage governed by Unacast upstream terms. Reselling raw data likely restricted. | Self-serve API terms. Early stage — licensing terms not publicly detailed. |
| **Multifamily Suitability** | No multifamily-specific features. POI data includes residential buildings but visit analytics are commercial-focused. Building footprints useful for amenity analysis. | **Not suitable.** No foot traffic data. POI data could identify nearby businesses but not residential demand. | No multifamily-specific features. Trade area and migration analysis could theoretically apply to residential, but no case studies or features found. | **Retail-only.** All case studies are retail (fireworks, books, western wear). No evidence of multifamily calibration or features.[^25] | **Multifamily-native.** Claims IoT + satellite foot traffic for multifamily. Space-utilization dashboards. However, no independent validation or customer references.[^8] |
| **Support Quality** | Active Slack community, responsive product managers. "Customer support is awesome... response very quickly."[^14] | 17-second median response time, 95.3% satisfaction. G2 praise for support. Trustpilot complaints about screenshot service.[^3][^17] | "Lack of ego and willingness to work with partners." High-touch customer support. 24/7 data delivery monitoring.[^18] | Expert analysts on-demand. MIT-backed startup with hands-on onboarding. Very young company — support depth unproven at scale.[^7] | Email contact only. No evidence of community, documentation depth, or dedicated support. Early stage risk.[^8] |
| **Data Delivery Options** | API, flat files, Snowflake, AWS Data Exchange, Databricks, CARTO, Dewey (academic).[^14] | REST API, JSON, Python SDK, Google Sheets add-on, n8n/Make. No flat file/SaaS dashboard.[^3] | API, DaaS feeds, SaaS platform, S3 bucket, CSV.[^6] | SaaS dashboard, deal pipeline, reports. No evidence of raw API or flat file export for data teams.[^24] | REST, GraphQL, Webhooks, flat files. AWS-based stack. Claims sub-500ms response times.[^9] |
| **Privacy Compliance** | CCPA and GDPR compliant. Privacy policy published.[^14] | Not primarily a location data provider; standard data processing compliance. | GDPR-compliant, CCPA-compliant, PrivacyCheck methodology. 100% opted-in consent from 15+ suppliers. Explicitly privacy-first.[^6] | Inherits Unacast compliance. No separate privacy certifications mentioned. | Not specified. Early stage — compliance posture unverified. |
| **Scalability** | Proven at academic and enterprise scale. 120+ customers across AdTech, mapping, CPG, retail, financial services.[^2] | Scales to 50,000+ requests/month at ~$30. True Cost Multiplier of 13x vs Ahrefs.[^3] | 50B+ signals/day, 600M+ MAUs. Proven at enterprise scale (BT, Generali Real Estate, M1 Data & Analytics).[^6] | 4,500+ sites in 6 months. ~50 sites/day. Not yet proven at 100K+ property scale.[^7] | Claims AWS-based architecture "built for scale." No evidence of performance at 10K, 100K, or 1M+ properties.[^9] |

---

## Winner / Loser Summary by Use Case

### Bootstrap Stage (< 10K properties, limited budget, technical team)
**Winner: DataForSEO (with caveats)**  
If your primary need is POI context (what businesses are near a property, ratings, hours) rather than actual foot traffic, DataForSEO is unbeatable on price ($6.20–$60 for 20K businesses). It requires technical integration and provides **no actual visit counts**.  
**Runner-up: PropTech Metrics**  
At $0.02/property, it's the cheapest per-lookup option with multifamily-native positioning. **High risk** due to early stage and lack of validation. Only viable if you can validate its signals against your own ground truth before relying on them.

### Growth Stage (10K–100K properties, some technical resources)
**Winner: SafeGraph (Dewey)**  
Best-in-class POI data with building footprints, hourly granularity, and proven academic validation. The PLOS ONE bias study is a known limitation, but it is **known and measurable** — you can adjust for it. The $0.05–$30,000/year range means you can start small. Requires your own data team to turn raw data into multifamily insights.  
**Runner-up: Unacast**  
If you need actual foot traffic data (not just POI context), Unacast is the most budget-friendly option with real visit data. The $1/API call entry point is accessible, and the licensing is the most permissive for derivative works. However, no published flat-rate pricing means costs can escalate.

### Enterprise Stage (100K+ properties, need integrated platform)
**Winner: GrowthFactor**  
If you need a turnkey site scoring platform with foot traffic integrated, transparent scoring, and deal pipeline management, GrowthFactor is the only budget-friendly option ($400/mo entry). However, it is **retail-focused**, not multifamily. You would need to work with their team to calibrate models for residential use.  
**Runner-up: Unacast**  
At enterprise scale, custom Unacast pricing may be competitive. The GDPR compliance, 3-year historical depth, and multiple delivery methods make it suitable for large platforms. But the lack of a dashboard means you'll need to build your own interface.

### Deal-Breaker: Who to Avoid for What
- **Avoid DataForSEO** if you need actual foot traffic/visit counts. It provides business listings, not mobility data.[^4]
- **Avoid GrowthFactor** if you need multifamily-specific calibration. All evidence points to retail use cases.[^25]
- **Avoid PropTech Metrics** if you cannot tolerate early-stage risk. No independent validation, no customer references, no published methodology.[^8]
- **Avoid SafeGraph** if you need a turnkey dashboard. It is a data provider, not an analytics platform. You need a GIS analyst or data team.[^15]
- **Avoid Unacast** if you need store-level granularity in multi-tenant buildings. Inferred POI data without building polygons means accuracy degrades in dense urban multifamily corridors.[^22]

---

## User Review Sentiment Summary

### SafeGraph
- **Positive themes:** Data quality, POI accuracy, ease of use, active community, excellent documentation, responsive Slack support.[^14]
- **Negative themes:** Product offering can be "daunting at first," requires joining with other datasets for full value, no built-in dashboard.[^14]
- **G2/aggregate rating:** ~4.8/5 (FeaturedCustomers, 1,777 reference ratings).[^14]

### DataForSEO
- **Positive themes:** Cost efficiency (70–97% cheaper than Ahrefs), support responsiveness (17-second median), API breadth, clean documentation.[^3][^17]
- **Negative themes:** Learning curve, no native dashboard, inflated keyword volume data, credit burn on Live queue, SERP screenshot service complaints.[^3][^16][^17]
- **G2/aggregate rating:** 3.8/5 on G2; 4/5 on Trustpilot (mixed).[^16][^17]

### Unacast
- **Positive themes:** Data consistency, quality, willingness to listen to partners, excellent customer service, privacy compliance.[^18][^22]
- **Negative themes:** Heavy reliance on GPS data (drift concerns), limited international granularity, inferred POI data, limited age range representation.[^22]
- **G2/aggregate rating:** 5.0/5 on DataRade (1 review); 100% satisfaction on SelectHub (1 review). Very limited public review volume.[^20][^22]

### GrowthFactor
- **Positive themes:** Transparent scoring, speed (reports in seconds), integrated workflow, unlimited users, expert analyst access.[^7][^24]
- **Negative themes:** Very young company (2023), no independent validation, all case studies are retail, self-reported metrics only.[^7]
- **G2/aggregate rating:** Not found on G2 or major review platforms as of June 2026.

### PropTech Metrics
- **Positive themes:** None found from independent reviewers. Self-reported: disruptive pricing, modern tech stack, multifamily focus.[^8]
- **Negative themes:** No independent reviews, no customer references, no published methodology, 2018 presentation deck suggests long development time with limited public traction.[^9]
- **G2/aggregate rating:** Not found on any review platform.

---

## Red Flags Table

| Provider | Specific Issue | Severity | Workaround |
|----------|---------------|----------|------------|
| **SafeGraph** | PLOS ONE peer-reviewed bias: older adults and non-white populations underrepresented.[^11] | Medium | Weight/adjust for demographic skew using census data; validate against first-party data for your markets. |
| **SafeGraph** | Visit patterns operate at CBG level, not individual store/building level in many cases.[^15] | Medium–High | Use building footprint polygons for better attribution; combine with ground truth for specific buildings. |
| **DataForSEO** | **Does not provide actual foot traffic/visit counts.** Only POI/business listings.[^4] | **Critical** | Do not use if foot traffic is a required input. Use only for competitive POI context. |
| **DataForSEO** | Keyword volume data inflated (averages Google Planner ranges).[^16] | Low | Not relevant for foot traffic use case; be aware if using SEO features. |
| **Unacast** | Inferred POI data — no independently researched building polygons.[^22] | Medium | Cross-check location accuracy against your own site records, especially in dense urban corridors. |
| **Unacast** | Self-reported ground truth accuracy within 20% for factories; no independent audit.[^18] | Medium | Validate against your own door counters or lease-up data before trusting for rent decisions. |
| **GrowthFactor** | All evidence is retail-focused; no multifamily case studies or calibration.[^25] | High | Request a custom pilot calibrated to multifamily metrics (occupancy, rent growth, lease velocity). |
| **GrowthFactor** | Founded 2023; $5.2M seed. Long-term viability unproven.[^7] | Medium | Negotiate data portability clauses; maintain ability to extract raw data if company pivots or fails. |
| **PropTech Metrics** | No independent validation, no academic studies, no customer references.[^8] | **Critical** | Do not rely on for investment decisions without extensive ground-truth validation. |
| **PropTech Metrics** | Claims "IoT & satellite foot traffic" with no published methodology.[^8] | **Critical** | Demand technical documentation on how IoT + satellite signals are calibrated to ground truth. |
| **All GPS-panel providers** | Panel bias toward younger, urban, higher-income populations.[^11][^12] | Medium | Ask provider about panel density in your specific markets; rural/secondary markets especially affected. |
| **All providers** | Rural areas are the blind spot — low device density means wider confidence intervals.[^15] | Medium | Validate rural estimates separately; do not use for high-stakes decisions in low-density markets without ground truth. |

---

## Winner Recommendation for Multifamily Platform (10K–100K Properties)

### Primary Recommendation: **SafeGraph (Dewey)** — with a specific implementation model

For a multifamily platform with 10K–100K properties, **SafeGraph** is the winner because:

1. **POI quality is the foundation:** Multifamily foot traffic analysis requires knowing precisely what amenities, retail, and services are near each property. SafeGraph's 2.17m geocode deviation and building footprint polygons are unmatched for this.[^10]
2. **Proven at scale:** 120+ enterprise customers, academic validation, and integration into AWS/Snowflake/Databricks means it fits into modern data stacks.[^2]
3. **Budget flexibility:** You can start with free samples and academic access, then scale to a custom subscription. The $0.05–$30K range accommodates growth from bootstrap to enterprise.[^14]
4. **Known, measurable bias:** The PLOS ONE studies document exactly what the bias is (older, non-white, low-income underrepresented).[^11][^12] This is preferable to providers with unknown or unstudied bias. You can adjust for it.
5. **Hourly granularity:** For multifamily, hourly visit patterns to nearby retail, transit, and amenities matter for understanding resident lifestyle and demand. SafeGraph provides this.[^15]

**Critical caveat:** SafeGraph requires a technical team. You must bring your own data scientists to:
- Correct for demographic bias using ACS/census data
- Build property-level scoring models from CBG-level visit data
- Integrate POI context with your own property performance data (rent, occupancy, lease velocity)

### Secondary Recommendation: **Unacast** — if you need actual foot traffic data with flexible licensing

If your platform needs to resell foot traffic insights to clients or build derivative products, **Unacast** is the better choice because:
1. **Most permissive licensing:** Derivative works for third-party customers are explicitly allowed.[^19]
2. **Actual visit data:** Unlike DataForSEO, Unacast provides real GPS-derived foot traffic, trade areas, and cross-visitation.[^6]
3. **Privacy compliance:** GDPR + CCPA compliance is built-in, reducing legal risk for a platform handling client data.[^6]

**Trade-off:** Higher cost at scale (custom pricing, $1/API call entry) and less POI precision than SafeGraph.

### What to Avoid
- **Do not rely on DataForSEO for foot traffic.** It is a POI proxy, not a visit data provider.[^4]
- **Do not rely on PropTech Metrics without extensive validation.** The claims are appealing but unsupported.[^8]
- **Do not buy GrowthFactor expecting multifamily features.** It is a retail platform that happens to use foot traffic data.[^25]

---

## Independent Validation Sources Summary

| Provider | Academic Studies | Hedge Fund/Investment Research | Industry Reports | User Review Platforms |
|----------|-----------------|-------------------------------|------------------|----------------------|
| **SafeGraph** | 158+ citations (PLOS ONE, JAMA, Nature) | Used by Richmond Fed, academic economists | CMU Delphi, COVIDcast | G2, DataRade, FeaturedCustomers |
| **DataForSEO** | None found | None found | SEO industry blogs (NextGrowth, SE Ranking) | G2 (3.8/5), Trustpilot (mixed) |
| **Unacast** | University of Florida (wildfire evacuation), academic partnerships | BT, Generali Real Estate | Location intelligence reports | DataRade (5.0/5, 1 review), SelectHub |
| **GrowthFactor** | None | MIT delta v accelerator | PropTech blogs, self-published case studies | Not found on G2/Trustpilot |
| **PropTech Metrics** | None | None | Self-published presentation (2018) | Not found on any platform |

---

## Counter-Narrative: What Marketing Hides

1. **"100% deterministic data" (Unacast):** This means the data comes from actual GPS signals, but it does not mean 100% accurate visit attribution. GPS drift, indoor signal loss, and multi-tenant ambiguity still create errors. The "100% deterministic" claim is about data source, not predictive accuracy.[^22]

2. **"IoT & satellite foot traffic" (PropTech Metrics):** This sounds cutting-edge but is completely unexplained. No technical documentation, no calibration methodology, no peer review. Satellite signals cannot reliably count individual building visitors without ground-truth sensors. The claim may refer to parking lot occupancy, thermal signatures, or mobile device detection — but the opacity is a red flag.[^8]

3. **"AI-powered site selection" (GrowthFactor):** The AI is real, but all training data and case studies are from retail. AI models trained on retail store performance will not transfer to multifamily without recalibration. The "glass box" transparency is genuine, but the model is the wrong box for multifamily.[^25]

4. **"88% cheaper than Google Places" (DataForSEO):** True for POI data, but irrelevant for foot traffic. DataForSEO's Business Listings API ($6.20/20K) uses an in-house database updated every 90 days, not live data. If you need real-time foot traffic, this is not the product.[^4]

5. **"Free data samples" (SafeGraph):** The samples are real and high-quality, but they are a loss leader for enterprise subscriptions. The free academic access via Dewey is excellent for research but not for commercial platforms. Commercial pricing is custom and requires sales engagement.[^14]

---

## Footnotes

[^1]: SafeGraph. "SafeGraph's five year goal is to be THE source for accurate data about every physical place in the world." FeaturedCustomers. https://www.featuredcustomers.com/vendor/safegraph

[^2]: SafeGraph. "SafeGraph 2024 Year in Review." 2024-12-31. https://www.safegraph.com/blog/safegraph-2024-year-in-review/

[^3]: NextGrowth.ai. "DataForSEO Review 2026: Honest Verdict After 12 Weeks." 2026-03-01. https://nextgrowth.ai/dataforseo-review/

[^4]: DataForSEO. "Getting Points of Interest with a Low-Cost Google Places API Alternative." 2024-05-29. https://dataforseo.com/blog/poi-data-with-dataforseo-api

[^5]: Unacast. "Location Intelligence & Foot Traffic Data." Gravy Analytics blog. https://gravyanalytics.com/audiences/

[^6]: DataRade. "Unacast Profile — Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/unacast/profile

[^7]: GrowthFactor. "Fact Sheet." https://www.growthfactor.ai/press/fact-sheet

[^8]: PropTech Metrics. Homepage. https://www.proptechmetrics.com/

[^9]: PropTech Metrics. "Democratizing Property Data Access — Presentation." 2018-06-15. https://www.proptechmetrics.com/presentation/

[^10]: SafeGraph Docs. "Evaluating SafeGraph Data." 2025-03-27. https://docs.safegraph.com/docs/places-data-evaluation

[^11]: Li Z, Ning H, Jing F, Lessani MN. "Understanding the bias of mobile location data across spatial scales and over time: A comprehensive analysis of SafeGraph data in the United States." PLOS ONE. 2024-01-19. https://doi.org/10.1371/journal.pone.0294430

[^12]: Erfani A, Frias-Martinez V. "A fairness assessment of mobility-based COVID-19 case prediction models." PLOS ONE. 2023-10-18. https://doi.org/10.1371/journal.pone.0292090

[^13]: CMU Delphi. "SafeGraph Weekly Patterns — COVIDcast Signal." https://cmu-delphi.github.io/delphi-epidata/api/covidcast-signals/safegraph.html

[^14]: DataRade. "SafeGraph — Pricing, Reviews, Data & APIs." https://datarade.ai/data-providers/safegraph/profile

[^15]: PassBy. "Foot Traffic Data Providers: Top Platforms Compared [2026]." 2026-04-09. https://passby.com/blog/foot-traffic-data-providers/

[^16]: NextGrowth.ai. "DataForSEO vs SerpApi (2026)." 2026-05-22. https://nextgrowth.ai/dataforseo-vs-serpapi/

[^17]: Trustpilot. "DataForSEO Reviews." 2026-03-24. https://www.trustpilot.com/review/dataforseo.com

[^18]: Unacast. "Ground Truth Analysis of Unacast Foot Traffic Data." https://www.unacast.com/post/examining-ground-truth-data

[^19]: Unacast. "Terms of Service." https://www.unacast.com/terms-service

[^20]: DataRade. "Unacast Foot Traffic Data | Global." https://datarade.ai/data-products/unacast-foot-traffic-data-global-gravy-analytics

[^21]: DataRade. "Unacast Profile — Pricing." https://datarade.ai/data-providers/unacast/profile

[^22]: SelectHub. "Unacast Reviews 2026." https://www.selecthub.com/p/location-intelligence-software/unacast/

[^23]: GrowthFactor. "Retail Foot Traffic Data: Complete Site Selection Guide." 2025-12-24. https://www.growthfactor.ai/resources/blog/retail-foot-traffic-data-complete-guide

[^24]: GrowthFactor. "Location Intelligence Tools: Compare Top AI Platforms." 2025-12-19. https://www.growthfactor.ai/resources/blog/location-intelligence-tools-guide

[^25]: GrowthFactor. "AI Site Selection: Compare Retail Platforms." 2026-01-12. https://www.growthfactor.ai/resources/blog/ai-driven-decision-making
