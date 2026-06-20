# Dim06: Privacy Regulations & Licensing for Commercial Use of Foot Traffic Data

**Research Agent:** Dim06_Researcher  
**Date:** 2026-06-20  
**Scope:** Legal and compliance landscape for using third-party location data in a commercial proptech product for multifamily property ranking.  
**Searches Conducted:** 24 independent queries across CCPA/CPRA enforcement, GDPR lawful basis, state privacy laws, provider licensing terms, data broker registration, mobile SDK compliance, FTC actions, class actions, and forward-looking regulatory risk.

---

## 1. Executive Summary

The commercial use of foot traffic data in proptech is legally feasible but sits in a rapidly tightening regulatory vise. As of mid-2026, precise geolocation is classified as "sensitive personal information" (SPI) in California (1,850-foot radius) and in 20+ U.S. state comprehensive privacy laws (mostly 1,750-foot radius). The California Attorney General's March 2025 investigative sweep into the location data industry, combined with the FTC's first-ever ban on selling sensitive location data (X-Mode/Outlogic, January 2024), signals that enforcement is operational, not theoretical.[^1]

For a proptech startup, the primary legal risk is not the *use* of aggregated foot traffic data per se, but rather: (1) the upstream data supply chain's consent validity; (2) whether your processing constitutes a "sale" or "sharing" under CCPA/CPRA; (3) re-identification risk from aggregated data; and (4) provider licensing restrictions that may prohibit commercial derivative products or resale. Major providers (SafeGraph, Placer.ai, Unacast, Foursquare) all impose strict no-re-identification, no-resale, and no-law-enforcement terms, but their definitions of "commercial use" and "derivative works" vary materially.

The compliance cost for a proptech startup using foot traffic data is estimated at $50,000–$250,000 annually (legal, DPA negotiation, consent management, audits, and cyber insurance), with non-compliance costs averaging $9.4 million according to industry benchmarks.[^2]

---

## 2. Key Findings (Claim Format)

### 2.1 CCPA/CPRA: Geolocation as Sensitive Personal Information

```
Claim: CCPA defines "precise geolocation" as any data derived from a device used to locate a consumer within a radius of 1,850 feet, classifying it as "sensitive personal information" (SPI) subject to the right to limit use.
Source: California Office of the Attorney General / CPRA §1798.140(w)
URL: https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-investigative-sweep-location-data-industry
Date: 2025-03-10
Excerpt: "The CCPA classifies 'precise geolocation' — data that places an individual within an 1,850-foot radius — as 'sensitive personal information' in which a consumer has the right to limit the use to purposes defined as 'necessary' to providing requested goods or services."
Context: Part of the California AG's March 2025 enforcement sweep announcement targeting mobile apps, ad networks, and data brokers.
Confidence: high
```

```
Claim: California AG Rob Bonta launched an ongoing investigative sweep on March 10, 2025, targeting the location data industry for CCPA violations, specifically focusing on consumers' right to opt out of sale/sharing and right to limit use of SPI including geolocation data.
Source: Herbert Smith Freehills Kramer
URL: https://www.hsfkramer.com/insights/2025-03/privacy-regulators-target-the-location-data-industry
Date: 2025-03-24
Excerpt: "On March 10, 2025, California Attorney General Rob Bonta (AG) announced an 'ongoing investigative sweep' into the use of consumer location data by mobile app providers, advertising networks and data brokers. The AG sent inquiry letters to covered businesses, informing them that they may be violating the California Consumer Privacy Act (CCPA)."
Context: The sweep coincides with proposed AB 1355 (California Location Privacy Act) and follows FTC enforcement actions against data brokers in 2024.
Confidence: high
```

```
Claim: Under CCPA/CPRA, businesses must wait at least 12 months before asking a consumer to opt back in after receiving an opt-out request for geolocation data, and mobile apps must contain links/settings allowing users to opt out of sharing location data.
Source: California Office of the Attorney General
URL: https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-investigative-sweep-location-data-industry
Date: 2025-03-10
Excerpt: "A business may not sell or share geolocation information after receiving an opt-out request from a consumer, unless it receives affirmative reauthorization from the consumer; that businesses must wait at least 12 months before asking the consumer to opt back in."
Context: These are specific requirements noted in the AG's sweep announcement as areas of suspected non-compliance.
Confidence: high
```

### 2.2 GDPR: Lawful Basis for Location Data

```
Claim: Under GDPR Article 6, processing of location data requires one of six lawful bases. For commercial analytics, "legitimate interest" (Art. 6(1)(f)) is theoretically available but requires a three-part test (purpose, necessity, balancing) and is increasingly difficult to justify for precise location tracking.
Source: ICO (UK Information Commissioner's Office)
URL: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/
Date: 2026-04-02
Excerpt: "Legitimate interests: the processing is necessary for your legitimate interests or the legitimate interests of a third party, unless there is a good reason to protect the person's information which overrides those legitimate interests."
Context: The ICO notes that legitimate interest cannot apply if the individual's rights override the interest. For location data, the Article 29 Working Party has historically stated that opt-in consent should be required for tracking and profiling for location-based advertising.
Confidence: high
```

```
Claim: The GDPR's "legitimate interest" basis is unlikely to justify real-time bidding or large-scale location profiling because the necessity and balancing tests are difficult to meet, and the Article 29 Working Party explicitly stated that opt-in consent should be required for location-based advertising and tracking-based digital market research.
Source: NYU Law / Klaudia Majcher Paper
URL: https://www.law.nyu.edu/sites/default/files/Klaudia Majcher Paper Final.pdf
Date: (academic paper)
Excerpt: "Article 29 Working Party explicitly noted in Opinion 06/2014, that opt-in consent 'should be required, for example, for tracking and profiling for purposes of direct marketing, behavioural advertisement, data-brokering, location-based advertising or tracking-based digital market research.'"
Context: This significantly limits the ability of a proptech company to rely on legitimate interest for processing location data that originated from EU data subjects.
Confidence: high
```

```
Claim: Cross-border transfers of EU location data to the U.S. require adequacy decisions (EU-US Data Privacy Framework), Standard Contractual Clauses (SCCs) with Transfer Impact Assessments, or Binding Corporate Rules. Post-Schrems II, TIAs are mandatory and must evaluate destination country surveillance laws.
Source: SecurityAlign / GDPR Cross-Border Data Transfers Guide
URL: https://securityalign.com/insights/gdpr-cross-border-data-transfers-2025
Date: 2025-09-13
Excerpt: "SCCs now require Transfer Impact Assessments to account for risks like destination country surveillance laws that may conflict with GDPR protections."
Context: The EU-US Data Privacy Framework was validated by the EU General Court on September 3, 2025, but onward transfers to uncertified sub-processors still require TIAs.
Confidence: high
```

### 2.3 U.S. State Privacy Laws (20+ States)

```
Claim: As of January 2026, 19+ U.S. states have enacted comprehensive consumer privacy laws, with precise geolocation data (typically ≤1,750 feet) classified as sensitive data in most states. Colorado uses the California standard of 1,850 feet.
Source: Foley & Lardner LLP / U.S. State Comprehensive Consumer Privacy Law Comparison Chart
URL: https://www.foley.com/wp-content/uploads/2026/01/U.S.-State-Comprehensive-Consumer-Privacy-Law-Comparison-Chart_V16.pdf
Date: 2026-01-01
Excerpt: "Precise/specific geolocation data (feet)... Precise geolocation: radius ≤ 1,850 feet (CA, CO); Precise geolocation: radius ≤ 1,750 feet (VA, UT, CT, IA, IN, MT, TN, TX, OR, DE, NJ, NH, KY, MD, RI)."
Context: New laws took effect in 2025 in Delaware, Iowa, Nebraska, New Hampshire, New Jersey, Tennessee, Minnesota, and Maryland.
Confidence: high
```

```
Claim: Maryland's Online Data Privacy Act (MODPA), effective October 1, 2025 (enforcement April 1, 2026), is one of the strictest state laws. It prohibits the sale of sensitive data outright (regardless of consent) and restricts collection/processing/sharing of sensitive data to what is "strictly necessary" for the requested product or service.
Source: Ketch / MODPA Compliance Guide
URL: https://www.ketch.com/regulatory-compliance/maryland-online-data-privacy-act-modpa
Date: 2026-03-10
Excerpt: "MODPA contains a blanket prohibition on selling sensitive data, which is the first of its kind under any state privacy law... Controllers may not collect, process, or share sensitive data unless it is strictly necessary."
Context: MODPA applies to businesses processing data of 35,000+ Maryland consumers and includes a "should have known" standard for minors under 18.
Confidence: high
```

```
Claim: Oregon amended its privacy law in 2025 to prohibit the sale of precise geolocation data entirely, and Colorado added precise geolocation to its sensitive data definition (at 1,850 feet) with a clarifying amendment that selling sensitive data requires opt-in consent.
Source: FPF / Anatomy of a State Comprehensive Privacy Law Report
URL: https://fpf.org/wp-content/uploads/2025/12/FPF-Anatomy-of-a-State-Comprehensive-Privacy-Law-Report.pdf
Date: 2025-12-08
Excerpt: "Oregon went a step further and will now prohibit the sale of precise geolocation data... Colorado... SB 25-276 included minor revisions to the Colorado Privacy Act. The law now includes precise geolocation data as a category of sensitive data (although it is defined at the marginally broader radius of 1,850')."
Context: These amendments reflect a legislative trend toward treating precise geolocation as increasingly sensitive and restricting its commercial sale.
Confidence: high
```

### 2.4 Provider Licensing Terms

```
Claim: SafeGraph's Data License Agreement prohibits resale, sublicensing, distribution, or creating derivative works that compete with SafeGraph's data offerings. It also explicitly bans using the data to identify behavior of known individuals, for advertising targeting based on healthcare POI visits, or to analyze protests/social demonstrations. The license is 1-year and data must be deleted after expiration.
Source: SafeGraph Terms of Service
URL: https://www.safegraph.com/terms-of-services/
Date: 2026-02-24
Excerpt: "Licensee shall not... (i) sell, sublicense, assign, distribute, publish, transfer, disclose or otherwise make available the Data in its current form or substantially similar form, (v) use the Data to attempt to identify behavior of a known individual for any reason, (vi) use the Data to do advertising targeting or attribution of individuals based on visits to any health care point of interest."
Context: SafeGraph allows internal business/research and external products if only non-material portions are exposed and products are not competitive with the data offering.
Confidence: high
```

```
Claim: Placer.ai's Terms of Service prohibit reselling, distributing, sublicensing, or displaying data to third parties except as minimal screenshots in presentations with attribution. It explicitly bans using data for employment/healthcare/credit/insurance eligibility decisions, unlawful tracking/surveillance, or selling to law enforcement/governmental agencies for law enforcement purposes.
Source: Placer.ai Terms of Service
URL: https://www.placer.ai/terms-of-service
Date: 2022-12-27
Excerpt: "You shall not... use the Services in connection with any products, services, or activities that compete with Placer... use, license, sub-license or distribute the Placer Data... for any of the following purposes: (a) in connection with establishing eligibility for employment, health care, credit or insurance; (b) for making decisions solely by automatic means where the decision has a significant effect on the individual; (c) for any unlawful tracking or unlawful surveillance purposes; or (d) to market or sell to law enforcement agencies."
Context: Placer.ai permits "internal business purposes" and incorporation into "Research Data" (public reports with attribution).
Confidence: high
```

```
Claim: Unacast's Terms permit internal business use and creation of derivative works for third-party customers, provided no raw or unmodified Unacast Data is made directly available to third parties. However, it prohibits re-identification, building user profiles, healthcare-related inferences, employment/insurance decisions, and selling to law enforcement. Liability is capped at $5,000 or prior 12-month fees.
Source: Unacast Terms of Service
URL: https://www.unacast.com/terms-service
Date: (current)
Excerpt: "You may not... re-identify or attempt to re-identify an individual from any Unacast Data... build or attempt to build a user profile for a given individual or device... use the Unacast Data... in connection with establishing eligibility for employment, health care, credit or insurance... to market or sell to law enforcement agencies."
Context: Unacast explicitly allows derivative works for third-party customers (unlike Placer.ai's stricter research-only exception), making it potentially more flexible for proptech analytics.
Confidence: high
```

```
Claim: Foursquare's Places API EULA prohibits derivative works, bulk data access, systematic querying to obtain substantially all data for a locality, and using data to contact businesses as prospective customers. It requires "Powered by Foursquare" attribution and restricts use of "Calculated Scores" to internal use only.
Source: Foursquare Places API EULA
URL: https://foursquare.com/legal/terms/apilicenseagreement/
Date: 2024-02-29
Excerpt: "You may not... create any derivative works... Make Places Data available to third parties in bulk... Allow third parties to systematically query Places Data to obtain all or substantially all Places Data for a given locality, region, or country... Use Places Data to contact businesses included in Places Data as prospective customers."
Context: Foursquare's acceptable use policy also prohibits geofencing around healthcare facilities and de-identification of content to locate individuals without express consent.
Confidence: high
```

### 2.5 Data Broker Registration

```
Claim: As of 2026, four U.S. states require data broker registration: California (via CPPA, $6,000 annual fee, $200/day penalty), Vermont ($100/year), Texas ($300), and Oregon ($600). California's Delete Act (SB 362) requires brokers to process deletion requests every 45 days starting August 1, 2026, through the DROP platform.
Source: SecurePrivacy.ai / Data Broker Registration Explained
URL: https://secureprivacy.ai/blog/data-broker-registration
Date: 2026-03-16
Excerpt: "California's 2025 expansion, Senate Bill 361... doubled the daily penalty for non-registration from $100 to $200 per day... Beginning August 1, 2026, registered data brokers must access DROP at least every 45 days, process consumer deletion requests within 90 days of retrieval."
Context: A proptech company that aggregates and resells foot traffic insights could potentially qualify as a data broker if it lacks a direct relationship with the data subjects.
Confidence: high
```

```
Claim: California's SB 361 (signed October 2025, effective January 2026) requires data brokers to disclose whether they collect precise geolocation data, mobile ad IDs, and whether they have sold/shared data with foreign actors, governments, law enforcement, or generative AI developers.
Source: Hunton Andrews Kurth
URL: https://www.hunton.com/privacy-and-cybersecurity-law-blog/california-expands-data-broker-registration-requirements
Date: 2025-10-17
Excerpt: "SB-361 requires data brokers that do not collect name, date of birth, ZIP code, email address, phone number, mobile ad ID... to disclose the most common types of personal information collected... [and] whether they have shared or sold California consumers' personal information with or to: a 'foreign actor'... the federal government... law enforcement... a developer of an AI or GenAI system or model."
Context: This dramatically increases transparency requirements for any entity that might qualify as a data broker handling location data.
Confidence: high
```

### 2.6 Mobile SDK Compliance & Consent

```
Claim: A 2025 study of 10 major mobile SDKs found that while most document consent requirements, many advise initializing "as early as possible" (ideally at app launch), which conflicts with consent requirements and results in data transmission before consent is obtained. Only 6 of 10 SDKs offered explicit consent-setting functionality.
Source: PETS Symposium 2025 / Koch et al.
URL: https://petsymposium.org/popets/2025/popets-2025-0042.pdf
Date: 2025
Excerpt: "A common conspicuous theme is advising the developer to initialize the SDK as early as possible, 'ideally at app launch', which may result in preloaded ads and transmitted data before consent. This advice commonly conflicts with any explanations on consent."
Context: This gap between SDK documentation and actual consent practice creates downstream liability for any company relying on the SDK provider's consent claims.
Confidence: high
```

```
Claim: Under GDPR and ePrivacy, mobile apps must block non-exempt tracking SDKs until the user has given explicit opt-in consent via an affirmative action. Bundled consent (forcing acceptance of all tracking to use the app) is a primary enforcement target.
Source: SecurePrivacy.ai / GDPR Compliance for Mobile Apps
URL: https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps
Date: 2026-04-23
Excerpt: "Bundled consent—forcing users to accept all tracking to use the app—is a primary enforcement target. Core app functionality must work with all tracking declined... Consent logging: Timestamped records of user choices including the specific privacy policy version they accepted."
Context: Regulators use network monitoring and SDK decompilation to verify whether consent is honored at runtime—the "technical truth."
Confidence: high
```

### 2.7 FTC Enforcement

```
Claim: In January 2024, the FTC secured its first-ever ban on a data broker selling sensitive location data, settling with X-Mode Social (now Outlogic). The order required deletion of previously collected data, implementation of a supplier consent verification program, and prohibition on associating data with sensitive locations (healthcare, religious, LGBTQ+, domestic abuse shelters, protests).
Source: FTC Press Release / Exterro Data Privacy Alert
URL: https://www.exterro.com/resources/data-privacy-alerts/data-privacy-alert-ftc-secures-first-ever-ban-on-sale-of-sensitive-location-data
Date: 2024-01-09 / 2026-03-05
Excerpt: "The FTC alleged that X-Mode Social, a data broker, and its successor company, Outlogic, LLC, failed to safeguard how third parties could use the geolocation data it collected and lacked 'reasonable or appropriate safeguards' on such sensitive information."
Context: This was followed by similar settlements with InMarket (May 2024), Gravy Analytics/Venntel (December 2024), and Mobilewalla (December 2024), establishing a pattern of categorical prohibition on selling sensitive location data without verifiable consent.
Confidence: high
```

```
Claim: The FTC followed its X-Mode action with December 2024 settlements against Gravy Analytics/Venntel and Mobilewalla, all alleging unlawful tracking and sale of sensitive location data (including visits to healthcare facilities and places of worship) without verifiable user consent. The orders ban the sale of sensitive location data and require deletion of historical data.
Source: JustSecurity / FTC Expertise Article
URL: https://www.justsecurity.org/113893/the-ftcs-concerning-inaction-on-a-new-data-protection-law/
Date: 2025-05-30
Excerpt: "In December 2024, the FTC announced a settlement with Gravy Analytics Inc. and its subsidiary Venntel Inc., alleging they unlawfully tracked and sold consumers' sensitive location data... The order prohibits Gravy Analytics and Venntel from selling sensitive location data and requires them to delete historical data."
Context: The FTC has now taken action against five location data brokers in two years, with Kochava still in litigation.
Confidence: high
```

### 2.8 Texas AG Enforcement (Allstate/Arity)

```
Claim: On January 13, 2025, Texas Attorney General Ken Paxton filed the first-ever lawsuit under a state comprehensive privacy law (TDPSA) against Allstate and its subsidiary Arity, alleging they collected precise geolocation and driving behavior data from ~45 million Americans without adequate consent through SDKs embedded in third-party apps (Life360, GasBuddy, Routely, Fuel Rewards).
Source: Texas Attorney General / ComplianceHub
URL: https://compliancehub.wiki/navigating-the-u-s-state-privacy-law-patchwork-post-october-2025-a-nationwide-compliance-analysis/
Date: 2025-11-04
Excerpt: "Allstate's subsidiary Arity developed a software development kit (SDK) that was integrated into mobile apps. The SDK allegedly collected sensitive driving data—including phone latitude, longitude, speed, GPS time, bearing, and altitude—from approximately 45 million Americans... without adequate notice or consent."
Context: The complaint includes claims under TDPSA, Texas Data Broker Law, Texas Insurance Code, and Texas Deceptive Trade Practices Act, seeking monetary relief exceeding $1 million with penalties up to $7,500 per violation.
Confidence: high
```

### 2.9 Class Action Litigation

```
Claim: In 2024, Google agreed to a $62 million settlement in the "In Re Google Location History Litigation" (Case No. 18-CV-5062, N.D. Cal.) to resolve claims that it illegally collected and stored smartphone users' private location information. This was one of the top 5 privacy class action settlements of 2024.
Source: Lexology / Duane Morris Class Action Review
URL: https://www.lexology.com/library/detail.aspx?g=dac12c6b-da72-4174-a8d8-63aa765a202c
Date: 2024-07-01
Excerpt: "$62 million – In Re Google Location History Litigation, Case No. 18-CV-5062 (N.D. Cal. May 3, 2024) (final settlement approval granted in a class action to resolve claims that Google illegally collected and stored smartphone users' private location information)."
Context: This demonstrates the significant financial exposure for companies handling location data, even for tech giants with substantial legal resources.
Confidence: high
```

### 2.10 Re-Identification Risk

```
Claim: Academic research has demonstrated that location data is highly susceptible to re-identification. A landmark 2013 MIT study found that "just four spatiotemporal points are sufficient to identify 95% of individuals within a dataset." Another study found that 49% of frequent mobile users could be uniquely identified from their top 3 locations alone.
Source: USC / Privacy Risks in Geospatial Location Data (citing de Montjoye et al.)
URL: https://dornsife.usc.edu/scribe/2026/01/30/privacy-risks-in-the-collection-brokerage-and-use-of-geospatial-location-data/
Date: 2026-01-30
Excerpt: "In a study conducted with the MIT Media Lab, researchers found that location data are highly susceptible to re-identification: 'just four spatiotemporal points are sufficient to identify 95% of individuals within a dataset' (de Montjoye et al., 2013)."
Context: This means "anonymized" or "aggregated" location data is not a legal safe harbor if re-identification is possible, which has implications for GDPR pseudonymization standards and CCPA de-identification requirements.
Confidence: high
```

### 2.11 Global Privacy Control (GPC)

```
Claim: GPC is legally binding in multiple U.S. states as of 2025. California, Colorado, Connecticut, and New Jersey explicitly require businesses to honor GPC opt-out signals. California's AB 566 (signed October 2025) will require all major browsers to include built-in GPC settings by January 1, 2027.
Source: Foster.com / Global Privacy Controls Alert
URL: https://www.foster.com/newsroom-alerts-global-privacy-controls-preparing-for-the-next-wave-of-enforcement
Date: 2025-12-16
Excerpt: "California: The California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA), requires businesses to honor opt-out requests signaled via GPC... AB 566 'Opt Me Out' Act... amends the CCPA/CPRA to require web browsers to provide built-in signals... effective January 1, 2027."
Context: Enforcement has been active, with Sephora ($1.2M) and DoorDash ($375K) settling for failure to honor GPC signals.
Confidence: high
```

### 2.12 Market Impact & Compliance Costs

```
Claim: The data privacy service market was valued at $14.8 billion in 2025 and is projected to reach $48.6 billion by 2034. Non-compliance costs average $9.4 million, which is 2.65x higher than average compliance costs of $3.5 million annually. Large organizations now average privacy budgets exceeding $2.5 million.
Source: DataIntelo / Data Privacy Service Market Report
URL: https://dataintelo.com/report/data-privacy-service-market
Date: 2024-10-04
Excerpt: "The data privacy service market was valued at $14.8 billion in 2025 and is projected to reach $48.6 billion by 2034, growing at a CAGR of 14.1%."
Context: The foot traffic data provider market itself is experiencing pricing pressure (enterprise CAC for location analytics rose ~28% in 2025 to ~$145K per deal) and increased legal spend.
Confidence: high
```

```
Claim: Placer.ai faces rising customer acquisition costs (~$145K per enterprise deal, +28% YoY in 2025) and pricing compression (price growth 3-5% in 2025), while SafeGraph's supply-chain datasets grew 45% in 2024 to $58M ARR, indicating vertical specialization as a competitive response to compliance costs.
Source: BusinessModelCanvasTemplate / Porter's Five Forces of Placer.ai
URL: https://businessmodelcanvastemplate.com/products/placer-ai-porters-five-forces
Date: 2024-10-08
Excerpt: "Enterprise CAC for location-analytics firms rose ~28% in 2025 to about $145k per deal... SafeGraph's supply-chain datasets grew 45% in 2024 to $58M ARR."
Context: This suggests the location data market is not shrinking in revenue but is becoming more expensive to operate in, with higher legal and compliance costs passed through to customers.
Confidence: medium
```

---

## 3. Compliance Risk Matrix

| Regulation | Applicability | Risk Level | Key Requirements | Mitigation Cost | Enforcement Likelihood |
|------------|---------------|------------|------------------|-----------------|------------------------|
| **CCPA/CPRA** | CA residents; for-profit entities with $26.6M+ revenue, 100K+ consumers, or 50%+ revenue from data sales | **High** | Opt-out for sale/sharing; right to limit SPI (geolocation); 12-month re-opt-in prohibition; GPC honor; data minimization | $50K–$200K/yr (CMP, legal, DPA) | **High** — AG sweep active; CPPA enforcement operational; private right of action for breaches ($100–$750 per consumer) |
| **GDPR** | EU data subjects; any controller/processor offering goods/services or monitoring behavior in EU | **High** | Lawful basis (consent or legitimate interest with LIA); data minimization; SCCs + TIA for US transfers; DPIA for profiling; 72-hour breach notification | $100K–$500K/yr (DPO, legal, tech) | **High** — €1.2B in fines in 2025; TikTok €530M; cross-border transfer focus |
| **U.S. State Privacy Laws (20+)** | Residents of VA, CO, CT, UT, IA, IN, MT, TN, TX, OR, DE, NJ, NH, KY, MD, MN, NE, RI, etc. | **Medium-High** | Opt-out for sale/targeted advertising; opt-in for sensitive data in most states; GPC/UOOM recognition; DPIAs for high-risk processing | $30K–$150K/yr (multi-state compliance) | **Medium-High** — TX AG already filed first suit (Allstate); CO cure period expired Jan 2025; MD enforcement starts Apr 2026 |
| **MODPA (Maryland)** | MD residents; 35K+ consumers or 10K+ with 20%+ revenue from data sales | **High** | "Strictly necessary" standard for sensitive data; **blanket prohibition on sale of sensitive data** (no consent override); algorithmic assessments | $20K–$80K/yr | **Medium** — enforcement begins Apr 2026; 60-day cure period until Apr 2027; stricter than any other state law |
| **FTC Section 5** | All U.S. consumers; deceptive/unfair practices | **High** | Prohibition on selling sensitive location data without verifiable consent; requirement for supplier consent verification; data retention schedules | $25K–$100K/yr (audit, legal) | **High** — 5 enforcement actions in 2 years; precedent of categorical bans on data practices |
| **Data Broker Registration** | CA, VT, TX, OR; entities selling personal data of consumers with no direct relationship | **Medium** | Annual registration ($6K in CA); DROP deletion processing (every 45 days from Aug 2026); expanded SB 361 disclosures | $10K–$50K/yr | **Medium-High** — CA CPPA actively enforcing; fines $200/day; two providers fined $42K and $34.4K in Jan 2026 |
| **EU AI Act** | AI systems affecting EU market; high-risk systems from Aug 2026 | **Medium** | Risk management; data governance; transparency; human oversight; conformity assessments; registration in EU database | $50K–$300K/yr | **Medium** — penalties up to €35M or 7% global turnover; first enforcement phase began Feb 2025 for prohibited practices; high-risk obligations Aug 2026 |
| **Provider Contract Breach** | All licensee customers | **High** | No re-identification; no resale; no law enforcement use; no derivative works (varies by provider); attribution requirements | $15K–$50K/yr (legal review) | **High** — contractual termination; audit rights; reputational damage; uncapped liability for IP infringement |

---

## 4. Provider Licensing Terms Comparison

| Dimension | **SafeGraph** | **Placer.ai** | **Unacast** | **Foursquare** |
|-----------|---------------|---------------|-------------|----------------|
| **License Type** | Non-exclusive, non-sublicensable, revocable, non-transferable | Non-exclusive, non-sublicensable, internal use only | Non-exclusive, non-sublicensable, internal use + derivative works for customers | Limited, non-exclusive, revocable, non-sublicensable, non-transferable |
| **Permitted Use** | Internal business/research; external products if non-material portions exposed and not competitive | Internal business; "Research Data" (public reports with attribution) | Internal business; derivative works for third-party customers if raw data not exposed | Your own apps/services; external reports/analyses if attribution given and not competitive |
| **Derivative Works** | Allowed for external products if not competitive and non-material portions exposed | Prohibited (except as "Research Data") | **Explicitly allowed** for third-party customers (key advantage) | **Prohibited** — "no rights to create any derivative works" |
| **Resale/Sub-license** | **Prohibited** | **Prohibited** | **Prohibited** (raw data) | **Prohibited** |
| **Re-identification** | Prohibited | Prohibited | Prohibited | Prohibited (AUP bans de-anonymization) |
| **Healthcare POI** | Banned for ad targeting/attribution | Banned for eligibility decisions | Banned for healthcare inferences | Banned for geofencing around healthcare facilities |
| **Law Enforcement** | Not licensed to any law enforcement | Banned for law enforcement marketing/sale | Banned for law enforcement purpose | Banned for unlawful tracking; AUP restricts |
| **Protests/Demonstrations** | Banned for analysis/reporting | Banned for unlawful surveillance | Banned (sensitive categories) | Banned for unlawful tracking |
| **Employment/Insurance** | Banned for FCRA-like purposes | Banned for eligibility decisions | Banned for eligibility decisions | Banned for discriminatory uses |
| **Financial Instruments** | Banned (Spend data) | Not explicitly banned | Not explicitly banned | Not explicitly banned |
| **Attribution** | Academic program requires attribution | Required for Research Data | Required for external display | "Powered by Foursquare" mandatory |
| **Data Retention** | 1-year license; must delete after expiration | Per agreement; deletion upon termination | Per agreement; derivative works may survive | Per API caching limits |
| **Liability Cap** | Not specified in ToS excerpt | Not specified in ToS excerpt | **$5,000 or prior 12-month fees** | Not specified in ToS excerpt |
| **Audit Rights** | SafeGraph demands right to audit licensees | Not specified in ToS excerpt | Not specified in ToS excerpt | 6-month audit period after termination |
| **Commercial Use Verdict** | **Conditional** — allowed if not competitive and non-material exposure | **Restricted** — mainly internal + public research | **Most Flexible** — allows derivative works for customers | **Restricted** — no derivative works, no bulk use |

### Proptech Suitability Assessment

- **SafeGraph**: Good for internal analytics and external products if foot traffic is a minor component. Risk: 1-year deletion requirement and competitive-use restriction.
- **Placer.ai**: Good for site selection reports and internal ranking models. Risk: "internal business purposes" may restrict embedding in customer-facing SaaS dashboards; derivative works are tightly controlled.
- **Unacast**: **Best for proptech** if you need to create derivative analytics products for customers (e.g., neighborhood foot traffic scores) because it explicitly permits derivative works for third-party customers, provided raw data is not exposed.
- **Foursquare**: Best for POI enrichment and venue matching. Risk: no derivative works and strict anti-bulk-querying rules make it unsuitable for building your own foot traffic dataset.

---

## 5. Practical Compliance Checklist for a Proptech Startup

### Phase 1: Data Sourcing & Vendor Due Diligence
- [ ] **Verify provider's consent chain**: Obtain documentation from your foot traffic provider showing that (a) data was collected with valid opt-in consent under GDPR/ePrivacy, or (b) data was collected under CCPA-compliant notice + opt-out rights, or (c) data is truly aggregated and anonymized before you receive it. Request a **Data Processing Agreement (DPA)** with Standard Contractual Clauses if EU data is involved.
- [ ] **Audit provider's SDK consent practices**: If your provider uses mobile SDKs, request their supplier assessment program documentation (modeled on FTC X-Mode order requirements) to verify that app publishers obtain informed consent before SDK initialization.
- [ ] **Review provider's data broker registration**: Confirm your provider is registered in California, Vermont, Texas, and Oregon if applicable. If *you* resell or license foot traffic insights to third parties, assess whether you qualify as a data broker and register accordingly.
- [ ] **Negotiate liability indemnification**: Ensure your provider indemnifies you for breaches of consent obligations upstream. Most standard ToS place liability on the licensee; push back during enterprise negotiations.

### Phase 2: Data Processing & Minimization
- [ ] **Use only aggregated data**: Never process raw device-level location traces. Ensure your provider delivers pre-aggregated visit counts, dwell times, or visitor origin patterns at the POI or census-block level.
- [ ] **Implement k-anonymity thresholds**: Before ingesting data, verify that aggregation meets k-anonymity standards (e.g., no cell with fewer than 5–10 devices) to reduce re-identification risk.
- [ ] **No re-identification attempts**: Contractually prohibit your team from attempting to re-identify individuals or combine foot traffic data with other datasets (e.g., property records, credit data) that could enable re-identification.
- [ ] **Purpose limitation**: Use foot traffic data only for the stated commercial real estate analytics purpose. Do not use it for tenant screening, employment decisions, insurance underwriting, or law enforcement support.
- [ ] **Data retention schedule**: Delete raw provider data after 12 months (or per license) and delete derivative datasets when no longer needed for active business purposes. Document your retention schedule.

### Phase 3: Privacy Rights & Consumer Transparency
- [ ] **Honor GPC signals**: Implement server-side detection of `Sec-GPC: 1` HTTP headers and disable any data sharing or sale that could constitute "sharing" under CCPA if the signal is present. This is legally binding in CA, CO, CT, NJ, and expanding.
- [ ] **Privacy policy disclosure**: Clearly disclose in your privacy policy that you use third-party foot traffic data for property analytics, the categories of data (aggregated visit counts), and that you do not use it to identify individuals. If you "sell" or "share" data under CCPA, provide a "Do Not Sell or Share My Personal Information" link.
- [ ] **Handle consumer rights requests**: If your processing could be linked back to identifiable individuals (it generally shouldn't with proper aggregation), establish a process for access, deletion, and opt-out requests. For pure aggregated analytics, document why individual rights requests are not applicable.
- [ ] **Minors protection**: If your product is accessible to users under 18, ensure you do not process their precise geolocation data for analytics without verifiable parental consent or strict necessity.

### Phase 4: Legal & Risk Infrastructure
- [ ] **Cyber insurance with privacy coverage**: Obtain a cyber liability policy that explicitly covers regulatory fines, consumer class actions, and defense costs for privacy violations. Ensure the sub-limit for regulatory fines is sufficient ($1M+ for a startup).
- [ ] **Data Protection Impact Assessment (DPIA)**: Conduct a DPIA for your foot traffic data processing, documenting: lawful basis, data flows, re-identification risk assessment, mitigation measures, and stakeholder review. Required under GDPR for high-risk processing and increasingly under state laws (CO, CT, MD, MN, TN).
- [ ] **Annual compliance audit**: Engage a privacy law firm or consultant to audit your data practices, vendor contracts, and consumer rights handling annually. Budget $25K–$50K for this.
- [ ] **Monitor regulatory changes**: Assign a team member to track developments in AB 1355/AB 322 (California), MODPA enforcement (April 2026), EU AI Act (August 2026), and new state privacy laws. Subscribe to IAPP, FPF, and state AG newsletters.

### Phase 5: Engineering & Technical Controls
- [ ] **Encryption at rest and in transit**: Use AES-256 for stored data and TLS 1.2+ for data transmission.
- [ ] **Access controls**: Role-based access control (RBAC) limiting foot traffic data to authorized analytics and engineering personnel.
- [ ] **No reverse engineering**: Technical and policy prohibitions on decompiling, reverse engineering, or attempting to extract raw device IDs from aggregated datasets.
- [ ] **Vendor data flow mapping**: Maintain a real-time inventory of all third-party data providers, their data types, processing locations, and lawful basis documentation.

---

## 6. Forward-Looking Risk Assessment: 2026–2027

### 6.1 Immediate-Term Risks (H2 2026)

1. **MODPA Enforcement (April 2026)**  
   Maryland's Online Data Privacy Act begins enforcement in April 2026. Its "strictly necessary" standard for sensitive data and blanket prohibition on selling sensitive data could affect proptech companies that incorporate foot traffic data into revenue-generating analytics products. If Maryland regulators interpret "sharing" broadly, embedding foot traffic data in customer-facing dashboards could trigger the sensitive data sale ban. **Mitigation**: Ensure data is strictly necessary for the core service and document your necessity assessment.

2. **California DROP Implementation (August 2026)**  
   California's Delete Request and Opt-out Platform (DROP) becomes enforceable for data brokers on August 1, 2026. If your proptech company qualifies as a data broker, you must process deletion requests every 45 days. The $200/day penalty per unprocessed request creates cumulative exposure. **Mitigation**: Automate deletion request intake and processing; evaluate whether you meet the "direct relationship" exemption.

3. **EU AI Act High-Risk Obligations (August 2026)**  
   If your proptech platform uses AI/ML for property scoring, ranking, or tenant matching, high-risk AI obligations apply from August 2026. This includes risk management systems, data governance, technical documentation, human oversight, and conformity assessments. Penalties reach €15M or 3% global turnover. **Mitigation**: Audit your AI features now; classify risk levels; prepare documentation; ensure training data (including any location-derived features) meets quality and bias standards.

### 6.2 Medium-Term Risks (2027)

4. **California AB 566 — Browser GPC Mandate (January 2027)**  
   All major browsers offered in California must include built-in GPC settings by January 1, 2027. This will dramatically increase the volume of legally binding opt-out signals your platform must honor. If you share foot traffic-derived data with ad partners or analytics vendors, GPC compliance must be automated at the infrastructure level. **Mitigation**: Implement server-side GPC detection now; ensure your consent management platform integrates GPC natively.

5. **Potential Revival of AB 1355 / AB 322 (California Location Privacy Act)**  
   AB 1355 (strict opt-in for all location data, 5-mile radius, ban on sale, no inference rule) failed in 2025 but was partially revived as AB 322. If passed in 2026 or 2027, it would fundamentally alter the California location data market by requiring affirmative opt-in for *all* location data collection and prohibiting inferences. **Mitigation**: Design your product to minimize dependence on location data that could be classified under a 5-mile "location data" standard; maintain alternative non-location signals.

6. **Federal Privacy Legislation (APRA or successor)**  
   The American Privacy Rights Act (APRA) failed to pass in 2024 but bipartisan interest remains. A federal law could preempt the patchwork of state laws but may also impose baseline consent requirements for geolocation data. **Mitigation**: Build compliance infrastructure that is jurisdiction-agnostic; avoid state-specific architectural dependencies.

7. **Expanded Data Broker Registration**  
   New Jersey, Delaware, Michigan, and Alaska are developing data broker registration frameworks. The trend is toward treating any entity that monetizes third-party data as a broker. **Mitigation**: Map your data monetization flows; if you license analytics that include third-party data, prepare for registration obligations.

### 6.3 Counter-Narrative: Is Compliance Overblown?

A reasonable counter-argument exists: most foot traffic data used in proptech is **aggregated, anonymized, and not individually identifiable**, which may place it outside the scope of "personal information" under many state laws. CCPA § 1798.140(o)(2) excludes "aggregated or de-identified information that is maintained in a form that is not capable of being associated with or reasonably linked to an individual." If your provider delivers data at the POI-week level with no device IDs, it may not be "personal information" at all.

However, three caveats undermine this argument:
- **Re-identification risk**: As documented above, location data is uniquely susceptible to re-identification. If your aggregation is not sufficiently coarse (e.g., rare POIs with low visit counts), regulators may argue the data is not truly de-identified.
- **CCPA/CPRA "sensitive personal information"**: Even if data is not "personal information," if it is derived from precise geolocation and you know it was collected from a specific device, the SPI rules may still apply to the *source* data, creating downstream obligations.
- **Provider contractual terms**: Regardless of statutory classification, your provider's ToS almost certainly requires you to treat the data as sensitive and prohibits re-identification. A contractual breach is enforceable even if no privacy law is violated.

**Bottom line**: You can likely use foot traffic data legally without massive compliance overhead *if* you use properly aggregated data, avoid resale, and maintain good vendor contracts. But the margin for error is shrinking, and the cost of a misstep is rising exponentially.

---

## 7. Footnotes

[^1]: California Office of the Attorney General. "Attorney General Bonta Announces Investigative Sweep of Location Data Industry, Compliance with California Consumer Privacy Act." March 10, 2025. https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-investigative-sweep-location-data-industry

[^2]: Cisco Privacy Benchmark / Ponemon Compliance Study, cited in DemandLocal. "23 Privacy Compliance in Marketing Statistics in 2025." October 25, 2025. https://www.demandlocal.com/blog/privacy-compliance-marketing-statistics/

[^3]: Future of Privacy Forum. "Policy Brief: Location Data Under Existing Privacy Laws." https://fpf.org/wp-content/uploads/2020/12/FPF_Guide_Location_Data_v2.2.pdf

[^4]: DLA Piper. "Data Protection Laws of the World: United States." https://www.dlapiperdataprotection.com/countries/united-states/law.html

[^5]: Fisher Phillips. "California's Latest Privacy Push: The Location Tracking Crackdown Businesses Can't Ignore." March 5, 2025. https://www.fisherphillips.com/en/insights/insights/californias-latest-privacy-push

[^6]: Clark Hill PLC. "Location, Location, Location: California attorney general investigative sweep and state law proposal target location data." March 12, 2025. https://www.clarkhill.com/news-events/news/california-attorney-general-announces-investigative-sweep-while-legislative-proposal-takes-direct-aim-at-business-use-of-location-data/

[^7]: Foley & Lardner LLP. "U.S. State Comprehensive Consumer Privacy Law Comparison Chart." January 2026. https://www.foley.com/wp-content/uploads/2026/01/U.S.-State-Comprehensive-Consumer-Privacy-Law-Comparison-Chart_V16.pdf

[^8]: Future of Privacy Forum. "FPF Anatomy of a State Comprehensive Privacy Law Report." December 2025. https://fpf.org/wp-content/uploads/2025/12/FPF-Anatomy-of-a-State-Comprehensive-Privacy-Law-Report.pdf

[^9]: ICO. "A guide to lawful basis." April 2, 2026. https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/

[^10]: European Data Protection Board. "Guidelines 05/2020 on consent under Regulation 2016/679." https://www.edpb.europa.eu/system/files/2023-12/edpb_letter

[^11]: SecurityAlign. "GDPR Cross-Border Data Transfers 2025: Complete Compliance Guide." September 13, 2025. https://securityalign.com/insights/gdpr-cross-border-data-transfers-2025

[^12]: SafeGraph. "Terms of Services." February 24, 2026. https://www.safegraph.com/terms-of-services/

[^13]: SafeGraph. "Privacy Policy." January 1, 2023. https://www.safegraph.com/privacy-policy/

[^14]: Placer.ai. "Terms of Service." December 27, 2022. https://www.placer.ai/terms-of-service

[^15]: Unacast. "Terms of Service." https://www.unacast.com/terms-service

[^16]: Foursquare. "Places API (Self-Service) End User License Agreement." February 29, 2024. https://foursquare.com/legal/terms/apilicenseagreement/

[^17]: Foursquare. "Platform & Acceptable Use Policy." March 12, 2024. https://foursquare.com/legal/terms/aup/

[^18]: SecurePrivacy.ai. "Data Broker Registration Explained (2026)." March 16, 2026. https://secureprivacy.ai/blog/data-broker-registration

[^19]: Hunton Andrews Kurth. "California Expands Data Broker Registration Requirements." October 17, 2025. https://www.hunton.com/privacy-and-cybersecurity-law-blog/california-expands-data-broker-registration-requirements

[^20]: Hintze Law. "California Further Amends its Data Broker Registration Law." October 13, 2025. https://hintzelaw.com/blog/2025/10/13/california-further-amends-its-data-broker-registration-law

[^21]: Koch et al. "The Impact of Default Mobile SDK Usage on..." PETS Symposium 2025. https://petsymposium.org/popets/2025/popets-2025-0042.pdf

[^22]: SecurePrivacy.ai. "GDPR Compliance for Mobile Apps (2026): Consent, SDKs, and Practical Implementation." April 23, 2026. https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps

[^23]: Federal Trade Commission. "FTC Order Prohibits Data Broker X-Mode Social and Outlogic from Selling Sensitive Location Data." January 9, 2024. https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data

[^24]: JustSecurity. "The FTC's Concerning Inaction on a New Data Protection Law." May 30, 2025. https://www.justsecurity.org/113893/the-ftcs-concerning-inaction-on-a-new-data-protection-law/

[^25]: Exterro. "Data Privacy Alert: FTC Secures First-Ever Ban on Sale of Sensitive Location Data." March 5, 2026. https://www.exterro.com/resources/data-privacy-alerts/data-privacy-alert-ftc-secures-first-ever-ban-on-sale-of-sensitive-location-data

[^26]: Texas Attorney General. Press release, January 13, 2025. https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-sues-allstate-and-arity

[^27]: ComplianceHub. "Navigating the U.S. State Privacy Law Patchwork Post-October 2025." November 4, 2025. https://compliancehub.wiki/navigating-the-u-s-state-privacy-law-patchwork-post-october-2025-a-nationwide-compliance-analysis/

[^28]: Lexology / Duane Morris. "Class Action Review - 2024/2025." July 1, 2024. https://www.lexology.com/library/detail.aspx?g=dac12c6b-da72-4174-a8d8-63aa765a202c

[^29]: USC Dornsife. "Privacy Risks in the Collection, Brokerage, and Use of Geospatial Location Data." January 30, 2026. https://dornsife.usc.edu/scribe/2026/01/30/privacy-risks-in-the-collection-brokerage-and-use-of-geospatial-location-data/

[^30]: Yin et al. "Re-Identification Risk versus Data Utility for Aggregated..." PMC. https://pmc.ncbi.nlm.nih.gov/articles/PMC4607417/

[^31]: de Montjoye et al. (MIT). "Unique in the Crowd: The privacy bounds of human mobility." Scientific Reports 2013. https://www.nature.com/articles/srep01376

[^32]: Foster.com. "Global Privacy Controls: Preparing for the Next Wave of Enforcement." December 16, 2025. https://www.foster.com/newsroom-alerts-global-privacy-controls-preparing-for-the-next-wave-of-enforcement

[^33]: Usercentrics. "Global Privacy Control & GPC Compliance Requirements." March 9, 2026. https://usercentrics.com/knowledge-hub/what-is-global-privacy-control/

[^34]: DataIntelo. "Data Privacy Service Market Research Report 2034." October 4, 2024. https://dataintelo.com/report/data-privacy-service-market

[^35]: BusinessModelCanvasTemplate. "What are the Porter's Five Forces of Placer.ai." October 8, 2024. https://businessmodelcanvastemplate.com/products/placer-ai-porters-five-forces

[^36]: Ketch. "Understanding the Maryland Online Data Privacy Act (MODPA)." March 10, 2026. https://www.ketch.com/regulatory-compliance/maryland-online-data-privacy-act-modpa

[^37]: Morgan Lewis. "Contextualizing Maryland's New Data Privacy Act." October 29, 2025. https://www.morganlewis.com/blogs/sourcingatmorganlewis/2025/10/contextualizing-marylands-new-data-privacy-act-a-conversation-with-ezra-church-and-rimsha-syeda

[^38]: California Lawyers Association. "AB 322: An Attempt to Place Guardrails on the Collection of Precise Geolocation Information." November 26, 2025. https://calawyers.org/privacy-law/ab-322-an-attempt-to-place-guardrails-on-the-collection-of-precise-geolocation-information/

[^39]: EU AI Act / Digital Strategy. https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai

[^40]: Presenc.ai. "EU AI Act Enforcement Tracker 2026." May 7, 2026. https://presenc.ai/research/eu-ai-act-enforcement-tracker-2026

[^41]: Baker McKenzie. "EU Regulation on AI." January 1, 2026. https://www.bakermckenzie.com/en/insight/publications/resources/product-risk-radar-articles/eu-regulation-on-ai

[^42]: Gravel2Gavel. "Data Analytics and Proptech." August 31, 2023. https://www.gravel2gavel.com/proptech-data-analytics/

[^43]: LawCrust. "Proptech Launch Strategy: Guide to Data Privacy Compliance." July 18, 2025. https://lawcrustbusiness.com/proptech-data-privacy-compliance/

[^44]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." April 22, 2026. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^45]: McMillan. "Risks of Anonymized and Aggregated Data." February 20, 2024. https://mcmillan.ca/insights/risks-of-anonymized-and-aggregated-data/

[^46]: McBrayer Firm. "Data Privacy Update: A look back at 2024 and what to expect in 2025." January 28, 2025. https://www.mcbrayerfirm.com/newsroom-news-data-privacy-update-a-look-back-at-2024-and-what-to-expect-in-2025.html

[^47]: FPF. "Privacy Enforcement Retrospective 2026." February 2026. https://fpf.org/wp-content/uploads/2026/02/Privacy-Enforcement-Retrospective_2026.02.06.pdf

[^48]: Reform.app. "2025 Privacy Laws: Impact on Lead Generation." February 10, 2026. https://www.reform.app/blog/2025-privacy-laws-impact-lead-generation

[^49]: KDNuggets. "5 Data Privacy Stories from 2025 Every Analyst Should Know." December 22, 2025. https://www.kdnuggets.com/5-data-privacy-stories-from-2025-every-analyst-should-know
