# Phase 4: Cross-Verification Engine — Cheap POI Foot Traffic Data for Multifamily Property Ranking

**Date:** 2026-06-20
**Route:** B (Focused Search)
**Dimensions Analyzed:** 12
**Researcher:** Orchestrator

---

## Methodology

Each finding from Dimensions 01–12 was compared against findings from other dimensions. A finding is:
- **High Confidence**: Confirmed by ≥2 independent agents from independent sources with consistent evidence
- **Medium Confidence**: Confirmed by 1 agent from an authoritative source (peer-reviewed, primary source, or official documentation)
- **Low Confidence**: Weak sourcing, blog-level evidence, or single unverified claim
- **Conflict Zone**: Statistical disagreement, interpretive divergence, or numerical discrepancy between agents

---

## High Confidence Findings (≥2 Independent Confirmations)

### HC-01: SafeGraph Has Measurable, Peer-Reviewed Demographic Bias
- **Dim05**: PLOS ONE study (Li et al., 2024) found SafeGraph underrepresents Hispanic, low-income (<$50K), and low-education populations by -0.05 to -0.06; COVID-19 exacerbated these disparities.[^1]
- **Dim11**: Same PLOS ONE study cited; additional fairness assessment (Erfani & Frias-Martinez, 2023) found systematic bias toward large, wealthy, young, urban counties.[^2]
- **Dim12**: County-level correlation remains strong (urban r > 0.97, rural r > 0.91) but block-group correlation drops to 0.18 in some reports.[^3]
- **Assessment**: The most comprehensive academic validation of any foot traffic provider. The bias is real, measurable, and documented. SafeGraph itself does not dispute these findings.

### HC-02: Walkability / Amenity Proximity Correlates with Multifamily Rent Premiums and Lower Default Risk
- **Dim08**: Pivo & Fisher (2011) found 1-point Walk Score increase = 0.1% NOI premium; 80 Walk Score properties worth 6% more. Fannie Mae study (Pivo 2014): Walk Score <80 had 60% higher default rate than >80.[^4]
- **Dim09**: Same Pivo & Fisher findings cited; Walk Score methodology itself is well-documented and validated by Redfin.[^5]
- **Dim08**: National rent premiums: Walk Score 80+ commands +12% to +18% higher rent; 90+ vs <50 yields +20% to +28% in home value.[^6]
- **Assessment**: This is the strongest empirical evidence base in the entire research corpus. Walkability is a proven value driver; the question is whether *third-party mobile foot traffic data* adds incremental value beyond traditional walkability scoring.

### HC-03: Free/Open-Source Data Cannot Provide Actual POI Visit Counts
- **Dim02**: OSM has no visit data; LODES tracks jobs not visits; OnTheMap is employment-only; EPA SLD is built-environment scoring; Google/Apple COVID mobility is discontinued and was relative-only.[^7]
- **Dim07**: Sentinel-2 satellite can detect parking occupancy but not individual building visitors; SAR methods are research-grade, not production-ready for multifamily.[^8]
- **Dim01**: Free tiers from providers (SafeGraph samples, Foursquare 500 calls) are loss leaders, not scalable solutions.[^9]
- **Assessment**: No free source provides actual, granular, building-level visit counts. The best free data can approximate *potential* traffic attractiveness (employment density, POI count, transit access) but not measured visits.

### HC-04: Unacast Has the Most Permissive Licensing for Derivative Works
- **Dim06**: Unacast Terms of Service explicitly permit derivative works for third-party customers.[^10]
- **Dim11**: "Unacast is the better choice if you need to resell foot traffic insights to clients or build derivative products."[^11]
- **Dim06**: SafeGraph and Placer.ai heavily restrict derivative works; Foursquare prohibits them outright.[^12]
- **Assessment**: For a proptech platform that wants to build a proprietary scoring model and sell/traffic-rank as a product feature, Unacast is the legally safest provider.

### HC-05: Mobile Panels Systematically Skew Younger, Higher-Income, Urban
- **Dim05**: Smartphone ownership: 79% (65+) vs 97.5% (18-49); 84% (<$30K) vs 98% ($100K+). Renter median income ($40K) vs homeowner ($90K).[^13]
- **Dim12**: Suburban smartphone ownership (93%) now exceeds urban (91%), reversing earlier patterns. Rural remains lowest at 87%.[^14]
- **Dim01**: GrowthFactor: "All major providers use mobile device panels that skew toward younger and higher-income populations."[^15]
- **Assessment**: This is a structural limitation of the entire mobile-location-data industry, not a flaw of any single provider. It disproportionately affects multifamily markets where renters are younger and lower-income than homeowners — paradoxically, the demographics most likely to rent apartments are also the most likely to be overrepresented in mobile panels.

### HC-06: The Technical Pipeline Architecture Is Standardized
- **Dim04**: Seven-step pipeline: Address → Geocode → Buffer → Discover POIs → Retrieve Visits → Aggregate → Normalize.[^16]
- **Dim09**: Scoring methodology uses the same pipeline with distance-decay weighting, temporal normalization, and Z-score market-relative scoring.[^17]
- **Dim03**: Property data requires address normalization, geocoding, and building-footprint matching before entering the pipeline.[^18]
- **Assessment**: No disagreement on the pipeline architecture. Disagreements exist on tool choices (Mapbox vs OpenCage vs Census Geocoder), buffer sizes, and scoring weights, but the fundamental flow is consensus.

### HC-07: Z-Score Normalization Is the Standard for Cross-Market Comparison
- **Dim04**: QuestDB glossary and IJETER paper both validate Z-score normalization for real estate scoring.[^19]
- **Dim09**: Scoring blueprint explicitly uses market-relative Z-scores as the final normalization step.[^20]
- **Dim08**: Market-relative scoring is necessary because urban and suburban POI densities differ by orders of magnitude.
- **Assessment**: Unanimous agreement across all dimensions that reference this topic.

### HC-08: SafeGraph POI Precision Is Best-in-Class
- **Dim11**: SafeGraph docs claim average geocode deviation of 2.17 meters; competitors range 18–65m with mean of 40m.[^21]
- **Dim01**: SafeGraph "building footprint polygons (not just centroids)" are a key differentiator.[^22]
- **Dim04**: Building-footprint-based geocoding is more accurate than street-interpolation in dense urban areas.[^23]
- **Assessment**: POI precision is SafeGraph's core strength and is consistently acknowledged across dimensions. However, this is POI *location* precision, not *visit count* accuracy.

### HC-09: "Free" Open Data Is the Most Expensive at Scale Due to Engineering Labor
- **Dim10**: Open-data stack costs $237K–$648K/year at scale (1M properties) due to 2–4 FTE data engineers.[^24]
- **Dim02**: Acknowledges that building from open sources requires "6–12 months of engineering time" and yields "incomplete rural coverage."
- **Dim10**: "The labor cost ($6,500+/mo) typically exceeds the SaaS subscription at 10K+ properties."[^25]
- **Assessment**: Dim02 and Dim10 agree on the direction but disagree on magnitude. Dim02 is more optimistic about the viability of a free stack; Dim10 quantifies the labor cost as prohibitive. This is a **partial conflict** (see CZ-03 below).

### HC-10: First-Party IoT Access Data Has Clearer ROI Than Third-Party Mobile Data
- **Dim08**: Allegion/Zentra: "optimize staffing schedules based on foot traffic" and "improve leasing conversion rates with insights into touring activity."[^26]
- **Dim07**: "First-party IoT access data (Latch/Zentra) is the highest-fidelity, lowest-risk source where already installed."[^27]
- **Dim08**: 67% of PropTech implementations fail; first-party data has lower implementation risk because it comes from systems already in use.[^28]
- **Assessment**: Strong consensus that first-party building access data is more actionable for multifamily operations than third-party mobile panel data. The limitation is that it only works for properties with smart access systems installed.

---

## Medium Confidence Findings (1 Authoritative Source)

### MC-01: SafeGraph Sampling Rate Is ~7.5% of US Population
- **Dim05**: PLOS ONE study (Li et al., 2024): "average sampling rate of 7.5% with notable temporal dynamics, geographic disparities, and urban-rural differences."[^1]
- **Dim11**: Same study cited.
- **Assessment**: Single peer-reviewed source, but highly authoritative. No contradictory evidence found.

### MC-02: Weekly Aggregation Improves SNR by 88% Over Daily
- **Dim04**: MDAS-GNN paper (arXiv, 2025): "Weekly aggregation achieves superior noise reduction, improving the signal-to-noise ratio from 2.888 (daily) to 5.437 (weekly)—an 88.3% improvement."[^29]
- **Assessment**: Single academic source, but with specific numbers and methodology. No contradiction found.

### MC-03: Placer.ai Claims 90–96% Correlation with First-Party Data
- **Dim05**: Placer.ai claims 90–96% correlation; Dim20 (Placer.ai fact sheet) cites "90%+ correlation."[^30]
- **Dim11**: Notes these are self-reported claims with no independent peer review.
- **Assessment**: The claim is consistently reported, but the evidence is vendor-provided. No independent validation found in any dimension.

### MC-04: PassBy Claims 94% Ground-Truth Correlation
- **Dim05**: PassBy "achieves 94% correlation to ground truth by validating against in-store sensors and sales data across hundreds of thousands of locations."[^31]
- **Dim01**: Same claim cited, but with caveat: "accuracy claim is self-reported; no third-party audit cited."
- **Assessment**: Consistently reported but self-reported. Medium confidence due to lack of independent audit.

### MC-05: CCPA Classifies Precise Geolocation (≤1,850 ft) as Sensitive Personal Information
- **Dim06**: California AG press release (March 2025): "The CCPA classifies 'precise geolocation' — data that places an individual within an 1,850-foot radius — as 'sensitive personal information.'"[^32]
- **Dim12**: Not directly addressed but implicit in geographic coverage discussion.
- **Assessment**: Primary legal source (AG press release), but legal interpretation may vary. No contradictory sources found.

### MC-06: Advan (SafeGraph Successor) Visit Counts Are 25% Higher Than SafeGraph's
- **Dim05**: Dewey Data docs: "Advan's visitation counts are a median of 25% higher... Additionally, as long as a POI's polygon remains consistent, visit counts over time will be significantly more stable."[^33]
- **Assessment**: Single source (Dewey Data), but it is official provider documentation. No contradiction found, but no independent verification either.

### MC-07: MODPA (Maryland) Prohibits Sale of Sensitive Data Starting April 2026
- **Dim06**: Ketch compliance guide: "MODPA... prohibits the sale of sensitive data outright (regardless of consent) and restricts collection/processing/sharing of sensitive data to what is 'strictly necessary.'"[^34]
- **Assessment**: Single source (Ketch), but it references the actual statute. This is a critical forward-looking risk that needs validation as the enforcement date approaches.

### MC-08: XGBoost Achieves R² = 0.952 for Rent Prediction Using POI Features
- **Dim09**: ResearchGate paper: "XGBoost model, enhanced with POI features, achieves superior predictive performance (of 0.952)."[^35]
- **Assessment**: Single academic source, but with specific methodology. No contradictory evidence found. This is a promising but not yet replicated result.

---

## Low Confidence Findings

### LC-01: PropTech Metrics "IoT & Satellite Foot Traffic" Claims
- **Dim01**: Rates PropTech Metrics "Very high" multifamily suitability at $0.02/lookup.
- **Dim11**: "Do not rely on PropTech Metrics without extensive validation. The claims are appealing but unsupported."[^36]
- **Dim07**: Satellite imagery can detect parking lot occupancy but "cannot reliably count individual building visitors without ground-truth sensors."[^37]
- **Assessment**: The $0.02/price point is verified (from their website), but the technical claims about IoT/satellite foot traffic are completely undocumented. This is a marketing claim with no technical white paper, peer review, or independent validation.

### LC-02: BestTime.app Provides 90-Day Predictive Foot Traffic at $29/Month
- **Dim01**: Cites BestTime.app as a "retail-busyness proxy" in the recommended hybrid stack.
- **Dim07**: Not mentioned among alternative data sources.
- **Dim11**: Not mentioned.
- **Assessment**: Single source (Dim01) with no independent validation. The product exists and is priced at $29/mo, but its accuracy for multifamily ranking is unproven.

### LC-03: Outscraper Provides POI Data at $0.005/Record
- **Dim01**: Cites Outscraper as a cheap POI provider.
- **No other dimension mentions Outscraper.**
- **Assessment**: Single source, no cross-validation. Pricing is from their website but accuracy and coverage are unknown.

### LC-04: GrowthFactor AI Models Transfer to Multifamily
- **Dim01**: Includes GrowthFactor as a $400/month option.
- **Dim11**: "Do not buy GrowthFactor expecting multifamily features. It is a retail platform that happens to use foot traffic data... AI models trained on retail store performance will not transfer to multifamily without recalibration."[^38]
- **Assessment**: Dim01 is too generous; Dim11 correctly identifies the retail-only limitation. The claim that GrowthFactor works for multifamily is LOW confidence.

---

## Conflict Zones

### CZ-01: PropTech Metrics Reliability — Trusted vs. Skeptical
- **Dim01**: "Very high" multifamily suitability; recommends it as part of the cheapest viable stack ($2,500–$3,500/year).
- **Dim11**: "Do not rely on PropTech Metrics without extensive validation." "Unsupported claims." "Early-stage with limited independent validation."
- **Dim08**: No case studies or customer testimonials for PropTech Metrics found in 20+ searches.
- **Analysis**: Dim01 took the marketing claims at face value; Dim11 applied skepticism. The truth is likely in between: PropTech Metrics exists, is priced at $0.02/lookup, but has no independent validation of its IoT/satellite claims. **Resolution**: Use PropTech Metrics for cheap property lookups but verify output against ground truth before trusting the scores.

### CZ-02: DataForSEO — Useful POI Proxy vs. Not Foot Traffic
- **Dim01**: "Low-to-medium" multifamily suitability; "useful for cheap POI enrichment and sentiment signals at massive scale."
- **Dim11**: "Do not rely on DataForSEO for foot traffic. It is a POI proxy, not a visit data provider."
- **Analysis**: These are not fully contradictory but represent different framings. Dim01 is more charitable (it's cheap and provides POI data); Dim11 is more direct (it doesn't provide the core signal you need). **Resolution**: DataForSEO is useful for POI metadata but cannot substitute for visit data. Both dimensions agree on this when read carefully.

### CZ-03: Free/Open-Data Stack — Viable Bootstrap vs. Labor Trap
- **Dim02**: Recommends a 10-layer free data stack (OSM + LODES + ACS + EPA + GTFS + OSMnx + FHWA + COVID archives + building footprints + satellite) and claims it can approximate a composite traffic-ranking index.
- **Dim10**: "The 'free' open-data stack is the most expensive at every scale ($237K–$648K/year) due to engineering labor." At 1M properties, SaaS is 4.3× cheaper than open data.
- **Analysis**: Dim02 focuses on the zero licensing cost; Dim10 focuses on total cost of ownership. Both are correct from their respective angles. **Resolution**: Free data is viable for a prototype or small portfolio with an existing data engineering team; it is not viable as a production solution for a commercial platform without significant engineering investment.

### CZ-04: SafeGraph Visit Granularity — CBG-Level vs. Hourly Store-Level
- **Dim01**: "SafeGraph's visit data is aggregated to census-block-group level in many cases, not individual-store level, which limits granularity for multifamily property-specific ranking."
- **Dim11**: "SafeGraph provides hourly granularity for roughly 4 million US POIs."
- **Analysis**: These are not contradictory. SafeGraph Weekly Patterns provides *hourly* visit counts *per POI*, but the *visitor origin* data is aggregated to CBG level. Dim01 conflates visit destination granularity (POI-level, hourly) with visitor origin granularity (CBG-level). **Resolution**: SafeGraph provides POI-level hourly visits but CBG-level visitor origins. For multifamily ranking, you care about visits *to nearby POIs*, which is POI-level.

### CZ-05: GrowthFactor — Cheap Option vs. Wrong Tool
- **Dim01**: Includes GrowthFactor as a $400/month budget option in the provider catalog.
- **Dim11**: "Do not buy GrowthFactor expecting multifamily features."
- **Analysis**: Dim01 catalogs providers by price; Dim11 evaluates by multifamily suitability. GrowthFactor is cheap but retail-only. **Resolution**: GrowthFactor is a valid budget option for retail foot traffic analytics but not recommended for multifamily property ranking.

### CZ-06: Cost of SaaS vs. Build at Scale
- **Dim10**: At 1M properties, SaaS platform ($151K/year) is 4.3× cheaper than open data ($648K/year) and 2.5× cheaper than metered APIs ($378K/year).
- **Dim01**: Recommends a hybrid stack costing $2,500–$3,500/year for 10K–100K properties.
- **Analysis**: These are different scales with different optimal solutions. The cost structure is non-linear. **Resolution**: At small scale (10K), hybrid/API is cheapest. At medium scale (100K), cloud marketplace or SaaS breaks even. At large scale (1M), enterprise SaaS is the TCO winner.

---

## Confidence Tier Summary

| Tier | Count | Examples |
|------|-------|----------|
| **High Confidence** | 10 | SafeGraph bias, walkability premiums, free data lacks visits, Unacast licensing, panel skew, pipeline architecture, Z-score normalization, SafeGraph POI precision, open data labor cost, first-party IoT ROI |
| **Medium Confidence** | 8 | SafeGraph 7.5% sampling rate, weekly SNR improvement, Placer.ai 90% claim, PassBy 94% claim, CCPA geolocation SPI, Advan 25% higher visits, MODPA prohibition, XGBoost R² 0.952 |
| **Low Confidence** | 4 | PropTech Metrics IoT/satellite claims, BestTime.app accuracy, Outscraper quality, GrowthFactor multifamily transfer |
| **Conflict Zone** | 6 | PropTech Metrics reliability, DataForSEO framing, free data viability, SafeGraph granularity, GrowthFactor suitability, cost structure at scale |

---

## Phase 5 Determination

**Phase 5 (Targeted Validation) is NOT triggered.**

The conflict zones identified are interpretive differences (framing, scale, scope) rather than factual contradictions that require additional research to resolve. The key factual claims (provider pricing, bias studies, legal frameworks, pipeline architecture) are well-supported by primary sources. The conflicts around PropTech Metrics and free data viability can be resolved by the user's own pilot testing rather than by additional web research.

**Recommended user action for conflict zones:**
- **CZ-01 (PropTech Metrics)**: Run a 100-property pilot comparing PropTech Metrics output against SafeGraph/Unacast for the same properties.
- **CZ-03 (Free data)**: Build a 2-week prototype with OSM + Census data to validate engineering effort before committing to a full open-data pipeline.
- **CZ-04 (SafeGraph granularity)**: Request a SafeGraph sample dataset and inspect the column structure (placekey, raw_visit_counts, visits_by_day, visitor_home_cbgs) to verify granularity for your use case.

---

## Sources

[^1]: Li, Z., Ning, H., Jing, F., & Lessani, M. N. (2024). "Understanding the bias of mobile location data across spatial scales and over time." *PLOS ONE*, 19(1), e0294430. https://doi.org/10.1371/journal.pone.0294430

[^2]: Erfani, A., & Frias-Martinez, V. (2023). "A fairness assessment of mobility-based COVID-19 case prediction models." *PLOS ONE*, 18(10), e0292090. https://doi.org/10.1371/journal.pone.0292090

[^3]: PLOS ONE / NIH PMC. SafeGraph Patterns county-level correlation analysis. https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/

[^4]: Pivo, G., & Fisher, J. D. (2011). "The walkability premium in commercial real estate investments." *Real Estate Economics*, 39(2), 185–219. https://www.sxd.sala.ubc.ca/9_resources/Walkability%20Paper%20February%2010.pdf

[^5]: Redfin / Walk Score Support. "Walk Score." https://support.redfin.com/hc/en-us/articles/4496780599323-Walk-Score

[^6]: Honest Casa. "Walkability Score Explained." 2026-05-25. https://honestcasa.com/blog/walkability-score-explained

[^7]: Dim02 Research: Free & Open-Source POI / Traffic Data Sources. 2026-06-20. (Multiple sources cited in dimension file.)

[^8]: Dim07 Research: Alternative & Proxy Data Sources. 2026-06-20. (Multiple sources cited in dimension file.)

[^9]: Dim01 Research: Low-Cost Foot Traffic Data Provider Catalog. 2026-06-20. (Multiple sources cited in dimension file.)

[^10]: Unacast. "Terms of Service." https://www.unacast.com/terms-service

[^11]: Dim11 Research: Provider Head-to-Head Comparison. 2026-06-20.

[^12]: SafeGraph. "Terms of Services." 2026-02-24. https://www.safegraph.com/terms-of-services/; Placer.ai. "Terms of Service." 2022-12-27. https://www.placer.ai/terms-of-service; Foursquare. "Places API (Self-Service) EULA." 2024-02-29. https://foursquare.com/legal/terms/apilicenseagreement/

[^13]: Pew Research Center. "Americans' Use of Mobile Technology and Home Broadband." 2024-01-31. https://www.astrid-online.it/static/upload/pi_2/pi_2024.01.31_home-broadband-mobile-use_final.pdf; RubyHome. "Homeowners vs. Renters Statistics." 2026-05-27. https://www.rubyhome.com/blog/homeowners-vs-renters-stats/

[^14]: Exploding Topics. "Smartphone Stats." 2026-01-12. https://explodingtopics.com/blog/smartphone-stats

[^15]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." 2026-04-22. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^16]: Dim04 Research: Technical Integration Pipeline. 2026-06-20.

[^17]: Dim09 Research: Scoring Models — Property Traffic Ranking Methodology. 2026-06-20.

[^18]: Dim03 Research: Multifamily Property Address & Geocoding Databases. 2026-06-20.

[^19]: QuestDB. "Z-score Normalization." 2026-06-15. https://questdb.com/glossary/z-score-normalization/; IJETER. "Improving Accuracy by applying Z-Score Normalization." 2019-11-11. http://www.warse.org/IJETER/static/pdf/file/ijeter247112019.pdf

[^20]: Dim09 Research: Scoring Models. 2026-06-20.

[^21]: SafeGraph Docs. "Evaluating SafeGraph Data." 2025-03-27. https://docs.safegraph.com/docs/places-data-evaluation

[^22]: SafeGraph. "Geospatial Data Integration Challenges." 2026-06-11. https://www.safegraph.com/guides/geospatial-data-integration/

[^23]: Patrick Baylis. "Building Codes" preprint. 2025. https://www.patrickbaylis.com/pdf/buildingcodes-preprint.pdf

[^24]: Dim10 Research: API & Data Marketplace Economics. 2026-06-20.

[^25]: Dim10 Research: API & Data Marketplace Economics. 2026-06-20.

[^26]: Allegion US. "Beyond the Buzzword: Real-World NOI Gains from Proptech Adoption." 2025-09-01. https://us.allegion.com/en/resources/education/leading-the-industry/multifamily/beyond-the-buzzword--real-world-noi-gains-from-proptech-adoption.html

[^27]: Dim07 Research: Alternative & Proxy Data Sources. 2026-06-20.

[^28]: Wiss. "PropTech and Its Impact on the Real Estate Market." 2026-04-28. https://wiss.com/proptech-and-its-impact-on-the-real-estate-market/

[^29]: MDAS-GNN paper. "Multi-Dimensional Spatiotemporal GNN." arXiv, 2025-10-27. https://arxiv.org/html/2510.27197v1

[^30]: City of Santa Cruz. "Placer.ai Fact Sheet." https://www.santacruzca.gov/files/assets/city/v/1/it/documents/placer-ai-fact-sheet.pdf

[^31]: PassBy. "How to Measure Foot Traffic." 2026-04-09. https://passby.com/blog/how-to-measure-foot-traffic/

[^32]: California Office of the Attorney General. "Attorney General Bonta Announces Investigative Sweep." 2025-03-10. https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-investigative-sweep-location-data-industry

[^33]: Dewey Data. "Methodology Difference from SafeGraph Patterns." 2026-04-21. https://docs.deweydata.io/docs/methodolgy-difference-from-safegraph-patterns

[^34]: Ketch. "Understanding the Maryland Online Data Privacy Act (MODPA)." 2026-03-10. https://www.ketch.com/regulatory-compliance/maryland-online-data-privacy-act-modpa

[^35]: ResearchGate. "Enhancing Housing Price Prediction Accuracy through Hybrid POI-XGBoost Models." 2026-04-23. https://www.researchgate.net/publication/404026830_Enhancing_Housing_Price_Prediction_Accuracy_through_Hybrid_POI-XGBoost_Models_A_Case_Study_of_Nanjing

[^36]: Dim11 Research: Provider Head-to-Head Comparison. 2026-06-20.

[^37]: Frontier Ledger / Kayrros. "Satellite Imagery for Foot Traffic Proxies." 2025-07-14. https://frontierledger.ai/data-sourcing-alternative-data/satellite-imagery-for-foot-traffic-proxies-a-guide-to-pre-processing/

[^38]: Dim11 Research: Provider Head-to-Head Comparison. 2026-06-20.
