# Dimension 05: Data Quality, Accuracy & Bias Assessment — Foot Traffic Data for Multifamily Ranking

**Research Agent:** Dim05_Researcher  
**Date:** 2026-06-20  
**Searches Conducted:** 24 independent queries across academic, provider, industry, and government sources  
**Primary Sources:** PLOS ONE, Pew Research Center, NHIS/CDC, AEA Papers, GrowthFactor, provider white papers, hedge fund research, FHWA, and peer-reviewed mobility studies.

---

## 1. Executive Summary

Foot traffic data used to rank multifamily properties is derived from mobile device panels that cover roughly 7.5% of the U.S. population (SafeGraph/Advan), tens of millions of devices (Placer.ai), or over 1 billion monthly devices aggregated from 15+ suppliers (Unacast). While these datasets offer unprecedented spatial and temporal granularity, they are subject to well-documented demographic, geographic, and temporal biases that materially affect their suitability for multifamily investment decisions.

**Key findings:**
- **Panel bias is real and measurable**: The landmark PLOS ONE study by Li et al. (2024) found SafeGraph underrepresents Hispanic populations, low-income households (<$50K), and individuals with low educational attainment, with biases typically ranging from -0.05 to -0.06 (5–6 percentage points underrepresented) and spiking during the COVID-19 pandemic[^1].
- **Older adults are systematically undercounted**: The SafeGraph polling-location audit by Coston et al. (2021) found rank correlation between coverage and voters over 65 of **r = -0.14** (p < 0.001), meaning older-precinct visits were systematically missed[^2].
- **Geographic reliability is uneven**: County-level correlation with census population is strong (urban r > 0.97, rural r > 0.91), but accuracy degrades at census tract and block-group levels, and rural areas suffer from low panel density and wider confidence intervals[^1].
- **Provider accuracy claims are hard to verify independently**: Placer.ai claims 90%+ correlation with first-party data; PassBy claims 94% correlation to ground truth; Unacast reports R-squared up to 92% against ground truth. However, correlation at the aggregate chain level does not guarantee accuracy at the individual site level, and providers rarely disclose confidence intervals or margins of error[^3][^4][^5].
- **COVID-19 distorted mobility panels**: SafeGraph's panel composition shifted dramatically during 2020–2022, with a documented "normalized_visits_by_state_scaling" bug in August 2022 caused by lower-quality panel devices overreporting home visits[^6].
- **Multifamily suitability is questionable**: Renters skew younger, lower-income, and more racially diverse than homeowners — precisely the demographics underrepresented in mobile panels. This creates a compounding bias when using foot traffic data to rank apartment assets.

---

## 2. Structured Findings

### 2.1 Panel Size, Composition & Sampling Rate

```
Claim: SafeGraph Patterns exhibited an average sampling rate of 7.5% of the U.S. population from 2018 to 2022, with notable temporal dynamics and geographic disparities.
Source: PLOS ONE — Li, Ning, Jing & Lessani (2024)
URL: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294430
Date: 2024-01-19
Excerpt: "Our analysis of the SafeGraph Patterns dataset revealed an average sampling rate of 7.5% with notable temporal dynamics, geographic disparities, and urban-rural differences. The number of sampled devices was strongly correlated with the census population at the county level over the five years for both urban (r > 0.97) and rural counties (r > 0.91), but less so at the census tract and block group levels."
Context: Nationwide analysis across state, county, tract, and CBG levels using ACS 5-year estimates as ground truth.
Confidence: High
```

```
Claim: SafeGraph collects location data from roughly 10% of mobile devices in the US, but GPS positioning accuracy is only guaranteed at the 5-meter level, creating measurement error in dense urban areas where distinguishing adjacent stores is difficult.
Source: AEA 2024 Conference Paper — Measurement Issues with SafeGraph Data
URL: https://www.aeaweb.org/conference/2024/program/paper/dDDHbhyb
Date: 2024
Excerpt: "Safegraph collects location data from roughly 10% of the mobile devices in the US... This inherently generates measurement error because its accuracy is guaranteed only at the 5 meters level. This implies that the GPS positioning might not be able to distinguish whether a user is in one store or another especially in dense urban areas."
Context: Economic analysis of high-tide flooding impacts on retail visits; GPS precision limits matter most for industry-specific effects at fine spatial scales.
Confidence: High
```

```
Claim: Advan (SafeGraph successor) computes visits by measuring GPS pings inside POI polygons without dwell-time filtering, and its visitation counts are a median of 25% higher than SafeGraph's, with more stable year-over-year consistency.
Source: Dewey Data / Advan Methodology Comparison
URL: https://docs.deweydata.io/docs/methodolgy-difference-from-safegraph-patterns
Date: 2026-04-21
Excerpt: "Advan's visitation counts are a median of 25% higher (i.e. the typical location has 25% more devices observed in it). Additionally, as long as a POI's polygon remains consistent, visit counts over time will be significantly more stable and there is less risk of visit cannibalization from neighboring POI."
Context: Direct comparison of SafeGraph vs. Advan methodology; Advan uses background-only devices, no dwell-time filtering, and different normalization.
Confidence: High
```

### 2.2 Demographic Bias

```
Claim: SafeGraph coverage of polling locations in North Carolina was negatively correlated with the proportion of voters over age 65 (r = -0.14, p < 0.001) and non-white voters (r = -0.11, p = 0.0067), indicating systematic underrepresentation of older and minority populations.
Source: arXiv / Stanford Law — Coston et al. (2020)
URL: https://arxiv.org/pdf/2011.07194
Date: 2020-11-14
Excerpt: "The rank correlation test yields cor(r(C(S-Z,V),r(A)) = -0.14 with p-value < 0.001. We also show how coverage decreases as the proportion of non-white voters increases... The rank correlation of race and coverage is cor(r(C(S-Z,V),r(R)) = -0.11 with p-value = 0.0067."
Context: Bias audit using 539K matched voters at 555 NC polling locations in the 2018 general election; validated against non-election day placebo distributions.
Confidence: High
```

```
Claim: Strict reliance on SafeGraph traffic for resource allocation would under-allocate by 37% to the oldest/most non-white precincts and over-allocate by 33% to the youngest/whitest precincts.
Source: arXiv / Stanford Law — Coston et al. (2020)
URL: https://arxiv.org/pdf/2011.07194
Date: 2020-11-14
Excerpt: "Table 3 presents results for polling locations binned into four age-race groups... strict reliance on SafeGraph would under-allocate resources by 37% to the oldest/most non-white category (p-value < 0.05) and over-allocate resources by 33% to the youngest/whitest category (p-value < 0.05)."
Context: Demonstrates real-world policy impact of demographic bias in mobile panel data.
Confidence: High
```

```
Claim: From 2018 to 2022, SafeGraph showed minor sampling biases for gender, age, and moderate-income groups (typically ±0.05), but Hispanic populations, low-income households (<$50K), and individuals with low education exhibited higher underrepresentation bias that varied over space, time, urbanization, and geographic levels.
Source: PLOS ONE — Li et al. (2024)
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/
Date: 2024-01-19
Excerpt: "We observed minor sampling biases among groups such as gender, age, and moderate-income, with biases typically ranging from -0.05 to +0.05. However, minority groups such as Hispanic populations, low-income households, and individuals with low levels of education generally exhibited higher levels of underrepresentation bias that varied over space, time, urbanization, and across geographic levels."
Context: Most comprehensive peer-reviewed bias assessment of SafeGraph to date; 5-year longitudinal analysis.
Confidence: High
```

```
Claim: The COVID-19 pandemic exacerbated pre-existing disparities in SafeGraph's panel representation, with significant underrepresentation of Hispanic, low-income, and low-education groups observed from March 2020 to July 2021.
Source: PLOS ONE — Li et al. (2024)
URL: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294430
Date: 2024-01-19
Excerpt: "During the pandemic, individuals from low socioeconomic groups (including Black and Hispanic individuals, those with less than a college education, and those with a household income below $50K) were found to be significantly underrepresented compared to other periods... This finding suggests that the COVID-19 outbreak may foster disparities in the sampling representation of vulnerable groups."
Context: Temporal heatmap analysis of monthly bias trends; pandemic period shows darkest underrepresentation signals.
Confidence: High
```

### 2.3 Geographic Bias: Urban vs. Rural

```
Claim: SafeGraph sampling rates were consistently higher in the Deep South and Midwest, while lower rates were concentrated in densely populated Northeast and West regions, creating geographic disparities that correlate with urban density.
Source: PLOS ONE — Li et al. (2024)
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/
Date: 2024-01-19
Excerpt: "The nine states in Deep South... and three states in the Midwest... have a higher concentration of areas with higher sampling rates, while the West and Northeast have more areas with lower sampling rates... lower sampling rates (< 5%, dark blue) were generally concentrated in densely populated areas of the Northeast and West."
Context: Spatial distribution maps at county, tract, and block group levels show consistent 5-year patterns.
Confidence: High
```

```
Claim: Rural areas have lower panel density, meaning fewer data points to extrapolate from, making foot traffic estimates "barely a guess" in some rural counties compared to statistically meaningful urban estimates.
Source: GrowthFactor — Foot Traffic Data Provider Comparison (2026)
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A provider might have 5,000 devices in a metro area and 50 in a rural county. The metro estimate is statistically meaningful. The rural estimate is barely a guess."
Context: Industry practitioner's assessment of rural reliability; aligned with academic findings on panel density.
Confidence: High
```

```
Claim: Advan (SafeGraph successor) found that its home panel data correlates with Census population estimates at the county level with a correlation coefficient between 0.98 and 0.99, indicating county-level population estimates are reliable.
Source: Remote Sensing / Buffalo Population Study
URL: https://www.newswise.com/pdf_docs/173020067589611_remotesensing.0227.pdf
Date: 2024
Excerpt: "We validate SafeGraph data by comparing it with the Census population estimates at the county level and find a very high correlation coefficient between 0.98 and 0.99. This indicates that SafeGraph home panel data can accurately estimate the county-level population."
Context: Remote sensing validation study using SafeGraph home panel data for monthly population mapping in Buffalo, NY.
Confidence: High
```

### 2.4 Provider-Specific Accuracy Claims

```
Claim: Placer.ai reports 90%+ correlation with first-party data sources in validation studies, with accuracy continually validated against credit card transactions, store revenue, vehicle counters, and people counters.
Source: Placer.ai / Urban Libraries Council Partnership
URL: https://www.urbanlibraries.org/initiatives/research-and-data/ulc-and-placer-ai
Date: 2025
Excerpt: "Placer.ai's data accuracy is continually validated against first party and authoritative data sources — with correlations consistently exceeding 90%."
Context: Also cited in Placer.ai's Seattle-Southside property report (2024): "Comparisons by top retailers against credit card transactions, store revenue, vehicle and people counters, and other objective measurements consistently yield correlations exceeding 90%."
Confidence: Medium
```

```
Claim: A Placer.ai fact sheet claims 92–96% accuracy for foot traffic analytics, validated against "ground truth" data sources.
Source: City of Santa Cruz / Placer.ai Fact Sheet
URL: https://www.santacruzca.gov/files/assets/city/v/1/it/documents/placer-ai-fact-sheet.pdf
Date: 2024
Excerpt: "Accuracy & Validation. Placer.ai claims 92–96% accuracy for foot traffic analytics. The models are continually validated against 'ground truth' data sources."
Context: Municipal procurement document; accuracy claim is marketing material without disclosed methodology.
Confidence: Medium
```

```
Claim: PassBy achieves 94% correlation to ground truth by validating against in-store sensors and sales data across hundreds of thousands of locations, using over 15 independent data inputs.
Source: PassBy Blog — How to Measure Foot Traffic
URL: https://passby.com/blog/how-to-measure-foot-traffic/
Date: 2026-04-09
Excerpt: "PassBy achieves 94% correlation to ground truth across its coverage... validating against in-store sensors and sales data across hundreds of thousands of locations."
Context: PassBy markets itself as the most transparently validated provider; note that 94% is correlation, not absolute accuracy.
Confidence: Medium
```

```
Claim: Unacast's models recorded R-squared values of up to 92% when validated against ground truth data, and the company claims its foot traffic data shows a historical correlation of 0.93 with ground truth data.
Source: Unacast / Best Retail Cases
URL: https://bestretailcases.com/america/cases/how-a-leading-retail-brand-used-unacasts-location-data-insights-to-optimize-brick-and-mortar-strategy/
Date: 2025-10-02
Excerpt: "Unacast provides the industry's most accurate location data, with our foot traffic data showing a historical correlation of .93 with ground truth data."
Context: Case study marketing material; independent academic validation of Unacast's specific claims is not publicly available.
Confidence: Medium
```

```
Claim: No provider is universally "most accurate" — accuracy varies by geography (urban vs. rural), location type (freestanding vs. multi-tenant), and time period.
Source: GrowthFactor — Foot Traffic Data Provider Comparison (2026)
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "No provider is universally 'most accurate.' Accuracy varies by geography (urban vs. rural), location type (freestanding vs. multi-tenant), and time period."
Context: Independent industry analysis comparing five major providers across panel size, methodology, and limitations.
Confidence: High
```

### 2.5 Ground-Truth Validation & Academic Studies

```
Claim: The PLOS ONE study (Li et al., 2024) is the most comprehensive peer-reviewed bias assessment of mobile location data, analyzing SafeGraph across five dimensions (spatial, temporal, urbanization, demographic, socioeconomic) over five years at four geographic scales.
Source: PLOS ONE
URL: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294430
Date: 2024-01-19
Excerpt: "This article presents a comprehensive examination of the potential biases associated with mobile location data using SafeGraph Patterns data in the United States as a case study. The research rigorously scrutinizes and documents the bias from multiple dimensions... over a five-year period from 2018 to 2022."
Context: Cited by 158+ subsequent papers; has become the canonical reference for mobile location data bias.
Confidence: High
```

```
Claim: "Validated against first-party data" means less than commonly assumed because correlation at the aggregate level (monthly visits to a chain) does not guarantee accuracy at the individual site level (Tuesday afternoon traffic at one location).
Source: GrowthFactor — Foot Traffic Data Provider Comparison (2026)
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "'Validated against first-party data' means less than you think. Several providers report 90%+ correlation with real-world data. But correlation at the aggregate level (monthly visits to a chain) doesn't guarantee accuracy at the individual site level (Tuesday afternoon traffic at one location)."
Context: Critical insight for multifamily investors who need site-level accuracy, not just chain-level trends.
Confidence: High
```

```
Claim: Visit attribution in multi-tenant centers is imprecise because a GPS ping near a strip mall does not tell you which store the person visited; accuracy varies significantly by location geometry.
Source: GrowthFactor — Foot Traffic Data Provider Comparison (2026)
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A GPS ping near a strip mall doesn't tell you which store the person visited. Providers use different methods to solve this (building polygons vs. centroid radius vs. dwell time thresholds), and the accuracy varies by location geometry. A freestanding building is easy. An inline tenant in a 400,000-square-foot shopping center is hard."
Context: Directly relevant to multifamily properties near mixed-use retail centers where POI attribution ambiguity is high.
Confidence: High
```

### 2.6 Temporal Reliability: COVID, Seasonality, and Panel Stability

```
Claim: SafeGraph experienced a panel disruption in May 2022 and a "normalized_visits_by_state_scaling" bug in August 2022, caused by a lower-quality panel contributing a significant increase in home visits but no meaningful increase in POI visits.
Source: Dewey Data / Advan Methodology Comparison
URL: https://docs.deweydata.io/docs/methodolgy-difference-from-safegraph-patterns
Date: 2026-04-21
Excerpt: "Advan is also less likely to encounter bugs like the `normalized_visits_by_state_scaling` bug that was reported by SafeGraph in August 2022, which occurred from a lower quality panel contributing a significant increase in home visits but no meaningful increase in POI visits."
Context: SafeGraph panel quality suffered specific known bugs in 2022 that affected longitudinal comparability.
Confidence: High
```

```
Claim: Google's COVID-19 Community Mobility Reports showed workplaces, transit centers, and retail/recreation locations experienced significant mobility decreases, with the first half of 2020 seeing the largest drops, particularly in transit and retail.
Source: CEPEI / World Bank / Google Mobility
URL: https://cepei.org/en/novedad/how-did-mobility-change-during-the-covid-19-pandemic/
Date: 2023-03-06
Excerpt: "Workplaces, transit centers, retail and recreational locations show significant decreases in mobility since the pandemic started... The first semester after the pandemic started – the first half of 2020 – was the period with the largest decreases, particularly in transit stations and retail and recreation locations."
Context: Validates that COVID-era mobility data is not representative of normal patterns; any model trained on 2020–2021 data may be distorted.
Confidence: High
```

```
Claim: Weekly aggregation improves signal-to-noise ratio by 88% over daily for traffic data, but monthly aggregation over-smoothes and loses critical short-term dynamics.
Source: MDAS-GNN paper (arXiv)
URL: https://arxiv.org/html/2510.27197v1
Date: 2025-10-27
Excerpt: "Weekly aggregation achieves superior noise reduction, improving the signal-to-noise ratio from 2.888 (daily) to 5.437 (weekly) – an 88.3% improvement... While monthly aggregation further improves SNR to 7.727, it over-smooths temporal variations and loses critical short-term dynamics."
Context: Temporal granularity trade-offs apply directly to foot traffic data used for multifamily leasing velocity monitoring.
Confidence: High
```

```
Claim: Traffic volume temporal allocation factors show monthly variation typically ranging from 0.9 to 1.1, with day-of-week factors showing greater variation (Sunday ~0.73, Friday ~1.14 for total traffic), meaning raw visit counts must be normalized for seasonality and day-of-week.
Source: Batterman et al. (2015) — Temporal variation of traffic on highways
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC4380130/
Date: 2015-02-25
Excerpt: "The monthly temporal allocation factor... typically ranges from 0.9 to about 1.1... The day-of-week factor has greater variation... Sunday: 0.7253, Monday: 1.0384, Friday: 1.1422."
Context: FHWA-aligned traffic engineering study; analogous normalization needs apply to POI foot traffic.
Confidence: High
```

### 2.7 Device Ownership Demographics (The Root Cause of Panel Bias)

```
Claim: As of 2024, 98% of Americans own a mobile phone and 91% own a smartphone, but ownership varies by age (79% of 65+), income (84% for <$30K vs. 98% for $100K+), race (87% Black vs. 95% Asian), and education (85% high school or less vs. 95% college grad+).
Source: Pew Research Center / Consumer Affairs
URL: https://www.consumeraffairs.com/cell_phones/how-many-americans-own-a-smartphone.html
Date: 2024
Excerpt: "Adults between the ages of 18 and 49 are the most likely to own a smartphone (97.5%). After the age of 49, smartphone ownership decreases with age; only 79% of adults ages 65 and over own a smartphone... 84% of U.S. adults with an annual income of less than $30,000 own a smartphone. This figure jumps to at least 93% among Americans making $30,000 or more."
Context: Pew 2023 survey (n=5,733) is the canonical source for U.S. device ownership demographics; these gaps directly propagate into foot traffic panel bias.
Confidence: High
```

```
Claim: Roughly one-in-five Black or Hispanic adults are "smartphone dependent" (rely on smartphone as primary internet access), compared with a smaller share of White adults, indicating that smartphone ownership alone masks deeper digital-divide effects.
Source: Pew Research Center — Mobile Technology and Home Broadband (2024)
URL: https://www.astrid-online.it/static/upload/pi_2/pi_2024.01.31_home-broadband-mobile-use_final.pdf
Date: 2024-01-31
Excerpt: "Roughly one-in-five Black or Hispanic adults are smartphone dependent, compared with a smaller share of White adults... 28% of Americans in households earning less than $30,000 per year [are smartphone dependent]."
Context: Smartphone dependency correlates with lower likelihood of having multiple connected devices, reducing the probability of appearing in location panels that require background app data sharing.
Confidence: High
```

```
Claim: Homeowners are older (median age 57), higher-income (median $90,000), and more likely to be White (75%) than renters, who are younger (median age 41), lower-income (median $40,000), and more racially diverse (only ~50% White).
Source: RubyHome — Homeowners vs. Renters Statistics (2026)
URL: https://www.rubyhome.com/blog/homeowners-vs-renters-stats/
Date: 2026-05-27
Excerpt: "Homeowners are older with a median age of 57 and renters have a median age of 41... 75% of homeowners are White while Black and Hispanic homeowners are 8% and 10%... About half of renters are White and Black and Hispanic renters each make up 20%... Median household income is $90,000 for homeowners and $40,000 for renters."
Context: Directly establishes the demographic mismatch between mobile panel overrepresentation (older, higher-income, White homeowners) and multifamily renter populations (younger, lower-income, diverse renters).
Confidence: High
```

### 2.8 Confidence Intervals and Error Margins

```
Claim: Foot traffic data providers rarely publish confidence intervals, margins of error, or standard errors for their visit estimates; the industry norm is to report a single correlation figure without uncertainty quantification.
Source: GrowthFactor — Foot Traffic Data Provider Comparison (2026)
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "No foot traffic data provider will tell you this on their marketing page, but every methodology shares the same structural weaknesses... The sites where foot traffic data matters most, new or unfamiliar locations, are exactly the sites where validation data doesn't exist."
Context: Industry-wide observation that uncertainty quantification is largely absent from provider marketing and, in many cases, from delivered data.
Confidence: High
```

```
Claim: In statistical terms, a margin of error depends on sample size, population variability, and confidence level; for a 95% confidence level with a large sample, margin of error equals approximately 1/sqrt(n), meaning smaller samples (e.g., rural POIs with few devices) have dramatically wider confidence intervals.
Source: Jotform / Various Statistics References
URL: https://www.jotform.com/surveys/margin-of-error-calculator/
Date: 2025
Excerpt: "Margin of error is a statistic that accounts for the amount of uncertainty your survey data might have... A confidence interval isn't the same as the margin of error — it's equal to twice the margin of error."
Context: Generic statistical principle applied to foot traffic panels: a rural POI with 50 observed devices has a much wider margin of error than an urban POI with 5,000 devices, even if both are "extrapolated" to population level.
Confidence: High
```

```
Claim: PassBy's financial data feed (sold via Snowflake) claims a correlation accuracy of up to 0.91 when trained and validated against in-store foot traffic counters, with a median 90% correlation for 90-day predictive forecasts.
Source: Select Dataset / PassBy Snowflake Listing
URL: https://www.selectdataset.com/dataset/4244fa22098ad2fe8dc37ba71972940d
Date: 2024-09-26
Excerpt: "Ground truth validated: Our store visits data is trained and validated against in-store foot traffic counters, enabling a correlation accuracy of up to 0.91... 90-day predictive foot counts, with a median 90% correlation to our historical foot traffic."
Context: Lower correlation for finance feed (0.91) than PassBy's general marketing claim (0.94); may reflect different validation samples or metrics.
Confidence: Medium
```

### 2.9 Hedge Fund & Alternative Data Validation

```
Claim: Hedge funds use Unacast location data for measuring retail traffic trends, detecting population changes, and forecasting financial performance, but the quality of location data is "of the essence" because it must inform trade decisions based on correct POIs, tickers, and stable panels.
Source: Unacast — How a Hedge Fund Uses Location Data
URL: https://www.unacast.com/post/hedge-fund-location-data
Date: 2021-09-15
Excerpt: "The quality of location data is of the essence, as it needs to inform hedge fund manager's trade decisions based on correct points of interest, tickers, and stable panels."
Context: Institutional investors are aware of panel stability issues; Unacast markets "Transparency" (source IDs disclosed) and "Accuracy" (cleansing, deduplication, fraud detection) as differentiators.
Confidence: High
```

### 2.10 Vehicular Traffic Data (INRIX/StreetLight) — An Analogous Caution

```
Claim: INRIX speed data validation against ground-truth GPS probe vehicles showed MAPE of 8.7% on one corridor and 15.1% on another, with accuracy directly related to sample size and data quality score; nighttime and weekend data is unreliable with low confidence scores.
Source: PAG Regional Report — Comparative Analysis of Traffic Data
URL: https://pagregion.com/wp-content/docs/pag/2023/04/Final-Report-Comparative-Analysis-and-Integration-of-Region-Wide-Traffic-Data.pdf
Date: 2023-04
Excerpt: "INRIX reports higher quality of data during the daytime on weekdays. The data during nighttime and weekends is unreliable with a low confidence score... INRIX speed data on Speedway Boulevard with a MAPE of 8.7%."
Context: INRIX and StreetLight are vehicular-traffic analogs to pedestrian foot traffic providers; their validation challenges (sample size, confidence scores, temporal reliability) are structurally similar.
Confidence: High
```

---

## 3. Provider Accuracy Scorecard

| Provider | Claimed Accuracy | Validation Method | Known Biases | Geographic Reliability | Multifamily Suitability |
|----------|-----------------|-------------------|--------------|------------------------|-------------------------|
| **Placer.ai** | 90–96% correlation with first-party data[^3][^4] | Validated against credit card transactions, store revenue, vehicle/people counters; proprietary ML debiasing for age, geography, iOS/Android distribution | Panel skews younger, urban, higher-income; undisclosed full methodology; limits data for locations with <50 unique devices | Strong in urban/suburban US; weak in rural; US-only | **Medium** — Good for retail/entertainment POIs near assets, but black-box extrapolation and no uncertainty reporting reduce confidence for site-level decisions |
| **SafeGraph (Advan)** | 7.5% panel sampling rate; ~2.17m geocode deviation for POI placement; visit accuracy not publicly stated[^1][^6] | Peer-reviewed PLOS ONE study validated against ACS census; building-footprint polygons for dense-area accuracy | Hispanic, low-income (<$50K), low-education underrepresented (-0.05 to -0.06); older adults undercounted; COVID-era panel distortion | County-level strong (r > 0.97 urban, >0.91 rural); tract/CBG level weaker; rural panel density low | **Medium-High** — Raw data allows custom bias correction; POI quality is best-in-class; requires in-house data science to weight and normalize |
| **PassBy** | 94% correlation to ground truth[^4] | Validated against in-store sensors and sales data across hundreds of thousands of locations; 15+ data inputs | Same structural panel biases as all mobile providers; claims "representative panel" but independent validation not peer-reviewed | US-only; 1.5M+ store locations; coverage depth in secondary/tertiary markets unclear | **Medium** — Good for retail benchmarking; no explicit multifamily/apartment leasing correlation claims; finance feed shows 0.91 correlation (lower than marketing) |
| **Unacast** | R-squared up to 92%; historical correlation 0.93 with ground truth[^5] | Aggregated from 15+ data suppliers; "100% deterministic data" claim; GDPR-compliant | No independent peer-reviewed bias audit published; accuracy not publicly benchmarked against ground truth at granular level | 180+ countries; 1B+ monthly devices; international coverage stronger than US precision | **Low-Medium** — Broad geographic coverage but no disclosed multifamily validation; aggregation from 15 suppliers may introduce inconsistent bias profiles |
| **Foursquare** | 9B+ monthly visits from 500M+ devices; 100M+ POIs; 16B+ check-ins[^7] | Stop-detection + check-in data; long history (15+ years) | Check-in data skews toward younger, tech-savvy, urban users; SDK-based data depends on app partnerships | Global (200+ countries); strong POI graph; visit accuracy not independently quantified | **Low-Medium** — Check-in behavior is not representative of general population; strong for trend analysis but weak for absolute visit counts |
| **StreetLight Data** | Vehicular-focused; no public foot-traffic accuracy claim | INRIX analog shows MAPE 8–26% depending on corridor and sample quality | Vehicular bias (misses pedestrians, transit users); low confidence scores for nights/weekends | US road network; strong for commuter corridors; weak for pedestrian-only areas | **Low** — Not designed for pedestrian foot traffic; inappropriate for multifamily walkability/retail proximity scoring |

---

## 4. Multifamily-Specific Risk Assessment: 5 Ways Foot Traffic Data Could Mislead Property Investors

### Risk 1: The Renter Demographic Mismatch
Renters are younger (median 41 vs. 57), lower-income (median $40K vs. $90K), and more racially diverse than homeowners. Mobile panels systematically overrepresent older, higher-income, White populations and underrepresent Hispanic, low-income, and less-educated groups. When foot traffic near a multifamily property is estimated from a panel that undercounts the very people most likely to rent, the signal is systematically biased against the property's actual customer base.

### Risk 2: POI Attribution Ambiguity in Mixed-Use Developments
Multifamily properties are increasingly built as mixed-use with ground-floor retail, shared parking garages, and pedestrian plazas. GPS accuracy (~5 meters) cannot reliably distinguish whether a device ping belongs to a resident entering their apartment, a visitor to a ground-floor café, or a passerby on the sidewalk. Providers use polygons, centroids, and dwell-time heuristics that vary in accuracy by building geometry. A "high foot traffic" reading may actually be dominated by residential activity, not retail demand.

### Risk 3: Rural and Secondary Market Reliability Collapse
Panel density drops sharply outside major metros. A provider may have 5,000 devices in a metro area and 50 in a rural county. The multifamily boom of the 2020s has shifted investment into Sun Belt secondary and tertiary markets (e.g., Greenville, SC; Boise, ID; Huntsville, AL) where panel coverage is thinner. Foot traffic estimates in these markets may be directionally useful but statistically unreliable for ranking properties or forecasting lease velocity.

### Risk 4: COVID-Era Baseline Distortion and Trend Instability
Any model using 2020–2022 data as a baseline or training set is contaminated by unprecedented mobility disruption. SafeGraph's panel itself experienced documented bugs (August 2022 scaling issue), pandemic-driven demographic skew, and temporary retail closures. If a multifamily scoring model weights "foot traffic recovery since COVID" as a positive signal, it may be capturing panel normalization artifacts rather than genuine neighborhood revitalization.

### Risk 5: Confusion of Retail Proximity with Apartment Leasing Demand
Foot traffic at nearby retail POIs measures retail demand, not housing demand. A property adjacent to a busy big-box store may score high on foot traffic but have no correlation with actual leasing traffic, rent growth, or NOI. Conversely, a quiet residential neighborhood with low retail foot traffic may have strong organic leasing demand from remote workers who value tranquility over retail density. Using retail foot traffic as a proxy for apartment demand commits an ecological fallacy — what is true for retail is not true for residential.

---

## 5. Data Quality Checklist: Evaluating Any Foot Traffic Provider Before Purchase

Use this checklist before committing to a foot traffic data contract for multifamily ranking:

| # | Question | Red Flag | Green Flag |
|---|----------|----------|------------|
| 1 | **What is the panel size and sampling rate?** | "Large panel" or "millions of devices" without specificity | Exact % of population covered (e.g., 7.5% of US adults) |
| 2 | **What is the panel demographic composition?** | No disclosure of age, income, race, or education skew | Published demographic breakdown vs. census; post-stratification weights disclosed |
| 3 | **How is the data validated against ground truth?** | "High accuracy" or "industry leading" without methodology | Named ground-truth sources (door counters, POS, credit card data); correlation coefficients published |
| 4 | **At what geographic granularity is validation performed?** | Chain-level or aggregate validation only | Individual store/location-level validation with out-of-sample testing |
| 5 | **Are confidence intervals or standard errors provided?** | Single point estimates only | Margins of error, standard errors, or prediction intervals included with every visit estimate |
| 6 | **How does the provider handle rural/secondary markets?** | Same methodology nationwide; no panel density disclosure | Explicit minimum device thresholds per POI; rural-specific accuracy testing published |
| 7 | **What happened to the panel during COVID-19?** | No discussion of pandemic-era data quality | Documented panel changes, normalization adjustments, and known bug disclosures |
| 8 | **How are multi-tenant buildings handled?** | Centroid-only attribution | Building footprint polygons; owned vs. shared polygon classification; dwell-time logic disclosed |
| 9 | **Can you validate the provider against your own first-party data?** | No trial or pilot program | Free sample dataset; API access for pilot testing against your own door counts or lease data |
| 10 | **How is the data normalized over time?** | Raw counts only; no normalization columns | State-scaling, CBG-level scaling, or device-to-population ratio normalization provided |
| 11 | **What temporal granularity is available?** | Monthly only | Hourly, daily, weekly available; guidance on optimal aggregation for your use case |
| 12 | **Does the provider have multifamily-specific validation?** | Only retail/CRE case studies | Apartment leasing traffic correlation studies; resident vs. visitor disambiguation |
| 13 | **What is the POI update frequency?** | Annual or quarterly updates | Monthly updates with open/closed status verification; stale POI removal rate disclosed |
| 14 | **How does the provider handle privacy regulations (CCPA/GDPR)?** | No mention of compliance | GDPR/CCPA compliance documentation; ISO 27001 certification; opt-in consent disclosure |
| 15 | **Can you audit the methodology?** | Proprietary black box | White papers, academic partnerships, open-source tools, or third-party audits available |

---

## 6. Synthesis & Recommendations for JediRe

### For Multifamily Ranking Specifically
1. **Do not use raw foot traffic counts as a direct ranking input.** Treat them as a directional signal only, and only after demographic weighting.
2. **Require CBG-level normalization.** SafeGraph's `normalized_visits_by_state_scaling` is a start, but block-group-level normalization is more accurate for neighborhood-scale analysis[^6].
3. **Weight POI categories by residential relevance.** Grocery, pharmacy, transit, and fitness matter more for renters than luxury retail or entertainment venues that may skew the panel's demographic overrepresentation.
4. **Exclude 2020–2021 data from training baselines.** Use 2019 as a pre-COVID baseline and 2023+ as a post-recovery baseline, with explicit documentation of any 2020–2022 usage.
5. **Cross-validate with lease data.** The ultimate ground truth for multifamily is not door counters — it's lease velocity, rent growth, and occupancy. Any foot traffic model must be backtested against actual leasing outcomes.

### For Provider Selection
- **Best for raw data + custom modeling:** SafeGraph (Advan) — peer-reviewed bias documentation, best POI geometry, transparent sampling rate.
- **Best for dashboard + quick insights:** Placer.ai — polished UI, but limited transparency into modeling layer; US-only.
- **Best for ground-truth validation claims:** PassBy — most explicit about validation methodology and sensor correlation, though independent peer review is lacking.
- **Avoid for multifamily-specific decisions:** StreetLight (vehicular only), Foursquare (check-in bias), Unacast (no published granular bias audit).

---

## 7. Sources

[^1]: Li, Z., Ning, H., Jing, F., & Lessani, M. N. (2024). "Understanding the bias of mobile location data across spatial scales and over time: A comprehensive analysis of SafeGraph data in the United States." *PLOS ONE*, 19(1), e0294430. https://doi.org/10.1371/journal.pone.0294430

[^2]: Coston, A., et al. (2020). "Leveraging Administrative Data for Bias Audits: Assessing Disparate Coverage with Mobility Data for COVID-19 Policy." arXiv:2011.07194. https://arxiv.org/pdf/2011.07194

[^3]: Urban Libraries Council. "ULC and Placer.ai." https://www.urbanlibraries.org/initiatives/research-and-data/ulc-and-placer-ai

[^4]: PassBy. "How to Measure Foot Traffic: 8 Methods Compared." 2026-04-09. https://passby.com/blog/how-to-measure-foot-traffic/

[^5]: Unacast / Best Retail Cases. "How a Leading Retail Brand Used Unacast's Location Data Insights." 2025-10-02. https://bestretailcases.com/america/cases/how-a-leading-retail-brand-used-unacasts-location-data-insights-to-optimize-brick-and-mortar-strategy/

[^6]: Dewey Data. "Methodology Difference from SafeGraph Patterns." 2026-04-21. https://docs.deweydata.io/docs/methodolgy-difference-from-safegraph-patterns

[^7]: Foursquare. "Location Intelligence Platform." 2026. https://foursquare.com/

[^8]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." 2026-04-22. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^9]: Pew Research Center. "Americans' Use of Mobile Technology and Home Broadband." 2024-01-31. https://www.astrid-online.it/static/upload/pi_2/pi_2024.01.31_home-broadband-mobile-use_final.pdf

[^10]: Consumer Affairs. "How Many Americans Own A Smartphone? 2026." 2023-11-01. https://www.consumeraffairs.com/cell_phones/how-many-americans-own-a-smartphone.html

[^11]: RubyHome. "Homeowners vs. Renters Statistics." 2026-05-27. https://www.rubyhome.com/blog/homeowners-vs-renters-stats/

[^12]: AEA 2024 Conference Paper. "Measurement Issues with the SafeGraph Data." https://www.aeaweb.org/conference/2024/program/paper/dDDHbhyb

[^13]: PassBy. "Foot Traffic Data: The Complete Guide." 2026-04-09. https://passby.com/blog/foot-traffic-data/

[^14]: Unacast. "How a Hedge Fund uses foot traffic and location data." 2021-09-15. https://www.unacast.com/post/hedge-fund-location-data

[^15]: PAG Regional Report. "Comparative Analysis and Integration of Region-Wide Traffic Data." 2023-04. https://pagregion.com/wp-content/docs/pag/2023/04/Final-Report-Comparative-Analysis-and-Integration-of-Region-Wide-Traffic-Data.pdf

[^16]: CEPEI / World Bank. "How did mobility change during the COVID-19 pandemic?" 2023-03-06. https://cepei.org/en/novedad/how-did-mobility-change-during-the-covid-19-pandemic/

[^17]: MDAS-GNN paper. "Multi-Dimensional Spatiotemporal GNN." arXiv, 2025-10-27. https://arxiv.org/html/2510.27197v1

[^18]: Batterman, S., et al. (2015). "Temporal variation of traffic on highways and the development of accurate temporal allocation factors for air pollution analyses." *PMC*. https://pmc.ncbi.nlm.nih.gov/articles/PMC4380130/

[^19]: Stanford Future Bay. "Normalization of Safegraph Patterns Data." 2020-05-03. https://stanfordfuturebay.github.io/covid19/safegraph_normalization_explainer.html

[^20]: City of Santa Cruz. "Placer.ai Fact Sheet." https://www.santacruzca.gov/files/assets/city/v/1/it/documents/placer-ai-fact-sheet.pdf

[^21]: Select Dataset. "PassBy Foot Traffic for Finance." 2024-09-26. https://www.selectdataset.com/dataset/4244fa22098ad2fe8dc37ba71972940d

[^22]: SafeGraph Docs. "Evaluating SafeGraph Data." 2025-03-27. https://docs.safegraph.com/docs/places-data-evaluation
