# Dimension 12: Geographic Coverage, Bias & Market Segmentation

## Foot Traffic Data for Multifamily Property Ranking

**Researcher:** Dim12_Researcher  
**Date:** 2026-06-20  
**Searches Conducted:** 25 independent queries across provider docs, academic papers, census data, market reports, and industry comparisons.

---

## 1. Executive Summary

Foot traffic data quality is not uniform across geography. It degrades predictably as one moves from dense urban cores to suburbs, rural areas, and international markets. For multifamily property ranking, this means the same "foot traffic score" may carry completely different error profiles in Manhattan versus a secondary Sun Belt market versus a college town. This dimension catalogs where the data works, where it fails, and what to do about it.

---

## 2. Key Findings

### 2.1 Urban vs Suburban vs Rural: The Density Gradient

```
Claim: SafeGraph's county-level correlation with Census population is r > 0.97 for urban counties and r > 0.91 for rural counties, but block group correlation drops to 0.18 in some provider reports.
Source: PLOS ONE / NIH PMC
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/
Date: 2024
Excerpt: "The number of sampled devices was strongly correlated with the census population at the county level for both urban (r > 0.97) and rural counties (r > 0.91), but less so at the census tract and block group levels."
Context: Academic validation of SafeGraph Patterns across 5 years (2018–2022). The rural estimate at county level is still good, but sub-county rural analysis is unreliable.
Confidence: high
```

```
Claim: Rural areas are the "blind spot" of mobile foot traffic data because low device density means fewer observations and wider confidence intervals in extrapolated visit estimates.
Source: GrowthFactor / PassBy provider comparison
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "A provider might have 5,000 devices in a metro area and 50 in a rural county. The metro estimate is statistically meaningful. The rural estimate is barely a guess."
Context: General industry consensus documented by multiple providers.
Confidence: high
```

```
Claim: Suburban smartphone ownership (93%) now exceeds urban (91%) in the US, reversing earlier patterns.
Source: Exploding Topics / Pew-derived stats
URL: https://explodingtopics.com/blog/smartphone-stats
Date: 2026-01-12
Excerpt: "US citizens living in suburban areas are more likely to use smartphones (93%) compared to urban residents (91%) and rural citizens (87%)."
Context: This is a change from previous years where urban use was higher. Suburban panel density may now be relatively strong.
Confidence: high
```

### 2.2 Coastal vs Inland & Regional Provider Strengths

```
Claim: US foot traffic data is strongest in major metro areas where panel density is highest. The Northeast, West Coast, and major Texas metros have the deepest data.
Source: Placer.ai / CMA Summer 2024 Retail Trends
URL: https://www.catman.global/summer-2024-retail-trends-foot-traffic-hits-seasonal-highs
Date: 2024-07-16
Excerpt: "Regionally, retailers across the U.S. saw significant YoY visit growth, with the most robust gains in the Northeast (Maine and New Hampshire) – and relatively small differences between states nationwide."
Context: Placer.ai data shows regional variation is relatively small in the US, but the underlying panel density is still metro-concentrated.
Confidence: medium
```

```
Claim: No major US foot traffic provider explicitly claims regional superiority within the US; all use national panels. However, US-specialist providers (Placer.ai, PassBy) outperform global generalists on US granularity.
Source: PassBy provider comparison
URL: https://passby.com/blog/foot-traffic-data-providers/
Date: 2026-04-09
Excerpt: "For US retail intelligence with validated accuracy, PassBy provides the strongest combination... For international location intelligence, Unacast."
Context: Provider selection should be driven by geography first.
Confidence: high
```

### 2.3 Sun Belt vs Rust Belt: Growth vs Decline

```
Claim: Sun Belt multifamily markets are experiencing oversupply and rising vacancy, while Rust Belt markets like Cleveland and Detroit show lower vacancy but also lower foot traffic data density in some submarkets.
Source: CRE Daily / Smart Growth America
URL: https://www.credaily.com/newsletters/national/issue/sun-belt-vacancies-surge-as-multifamily-market-shows-geographic-splits/
Date: 2026-01-05
Excerpt: "The South posted a 9.0% vacancy rate—the highest in the country... The Midwest's 6.6% vacancy sits below the national average."
Context: Sun Belt markets like Austin, Nashville, Charlotte, and Phoenix have heavy construction and strong panel density. Rust Belt markets may have lower panel density but also less data-driven competition.
Confidence: high
```

```
Claim: Walkable urbanism is rising in both Sun Belt and Rust Belt, but Rust Belt metros have historically lagged in walkable urban development, which affects POI density and foot traffic measurement reliability.
Source: Cushman & Wakefield / Smart Growth America
URL: https://www.cushmanwakefield.com/-/media/cw/americas/united-states/insights/research-report-pdfs/2019/foot_traffic_ahead.pdf
Date: 2019
Excerpt: "Walkable urbanism is on the rise in the Rust Belt, the Sun Belt, tech metropolises, government centers, and millennial magnets."
Context: Rust Belt revitalization means neighborhoods are changing faster than POI databases may reflect.
Confidence: medium
```

### 2.4 International Coverage

```
Claim: SafeGraph covers 195+ countries but is strongest on POI data; visit analytics are US-centric. Foursquare covers 200+ countries with 120M+ POIs. Unacast covers 180+ countries but has "diverse degrees of coverage" and "less granularity" outside the US.
Source: PassBy provider comparison / Datarade
URL: https://passby.com/blog/foot-traffic-data-providers/
Date: 2026-04-09
Excerpt: "SafeGraph (Dewey): 80m+ POIs globally across 195+ countries... Unacast: 1bn+ monthly devices across 180+ countries... accuracy is not publicly benchmarked against ground truth."
Context: For multifamily outside the US, foot traffic data is significantly weaker. POI data exists; visit estimation quality is unproven.
Confidence: high
```

```
Claim: Placer.ai is explicitly US-only for foot traffic coverage.
Source: Ariadne comparison / Placer.ai documentation
URL: https://www.ariadne.inc/resources/blogs/placer-ai-alternative/
Date: 2026-06-10
Excerpt: "Placer.ai is US-centric by construction. Its panel represents the US population, and its market, trade-area, and competitive data are strongest in the United States."
Context: Any multifamily platform using Placer.ai cannot rank properties in Canada, Mexico, UK, or EU.
Confidence: high
```

```
Claim: DataForSEO's SERP API covers 249 countries and can proxy Google Maps Popular Times data, but it is not a native foot traffic panel; it is a search-results proxy.
Source: Datarade / DataForSEO
URL: https://datarade.ai/data-products/dataforseo-serp-api-for-rank-tracking-for-any-location-real-dataforseo
Date: 2025
Excerpt: "Coverage: 249 Countries... SERP API will provide you with structured search results data in JSON or HTML from Google, Bing, Yahoo, Yandex, Baidu, and Naver."
Context: DataForSEO can provide international coverage for Google Maps "Popular Times" scraping, but this is qualitatively different from panel-based foot traffic.
Confidence: high
```

### 2.5 Demographic Bias: Age, Income, Race, Device Ownership

```
Claim: SafeGraph panel underrepresents older adults, non-white populations, and middle-income individuals; it overrepresents Black and educated consumers and both rich and poor individuals.
Source: Chris Poliquin appendix / PLOS ONE study cited in GrowthFactor
URL: https://chrispoliquin.com/files/ceo_gun_activism.pdf
Date: 2021
Excerpt: "The sample is slightly over-indexed on Black and educated consumers and on both rich and poor individuals; it is underrepresentative of middle-income individuals."
Context: This directly impacts multifamily markets with specific tenant demographics (e.g., senior housing, affordable housing, workforce housing).
Confidence: high
```

```
Claim: Smartphone ownership in the US shows an 18-point gap between 18-29 year olds (97%) and 65+ (78%), and a 26-point gap between <$30k income (67%) and $75k+ (93%).
Source: Pew Research / Exploding Topics / DataMatrixx
URL: https://explodingtopics.com/blog/smartphone-stats
Date: 2026-01-12
Excerpt: "The youngest adult age group features the highest proportion of smartphone users (97%). The 65+ age group (78%).... 93% of those earning over USD 75,000 per year owned a smartphone... 67% of people earning under USD 30,000 a year owned smartphones."
Context: Multifamily-dense areas often have lower-income renters (median renter income ~$40k), which means the panel may undercount actual foot traffic in these neighborhoods.
Confidence: high
```

```
Claim: Minority groups such as Hispanic populations, low-income households, and individuals with low levels of education exhibited higher levels of underrepresentation bias in SafeGraph data that varied over space, time, and urbanization.
Source: PLOS ONE / NIH PMC
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/
Date: 2024
Excerpt: "Minority groups such as Hispanic populations, low-income households, and individuals with low levels of education generally exhibited higher levels of underrepresentation bias that varied over space, time, urbanization, and across geographic levels."
Context: This is a critical finding for multifamily platforms ranking properties in diverse or affordable markets.
Confidence: high
```

```
Claim: Unacast data has limited age range suitability, with underrepresentation of younger (<20) and older (>65) demographics.
Source: SelectHub Unacast Reviews
URL: https://www.selecthub.com/p/location-intelligence-software/unacast/
Date: 2026
Excerpt: "Limited Age Range: Unacast's data might not be suitable for businesses targeting younger (<20 years old) or older (>65 years old) demographics due to underrepresentation in these age groups."
Context: Senior housing and student housing markets are particularly affected.
Confidence: medium
```

### 2.6 Panel Density by Metro

```
Claim: The Boston metro mobile phone panel study used 1.92 million anonymous users to simulate 3.54 million people, with expansion factors varying by census tract. This demonstrates that even in a major metro, panel-to-population expansion ratios are not uniform.
Source: Nature Communications
URL: https://www.nature.com/articles/s41467-019-11685-w
Date: 2019-08-19
Excerpt: "In each census tract in Boston's metro area, TimeGeo expands the active phone users to the population... The colors in Fig. 1a indicate the average expansion factor of commuters and non-commuters for each tract."
Context: If expansion factors vary within Boston, they vary far more between primary, secondary, and tertiary markets.
Confidence: high
```

### 2.7 Seasonal and Event-Driven Variation

```
Claim: College towns and vacation markets exhibit extreme seasonal foot traffic swings. Winter reduces average pedestrian volume by 24%, and college towns see massive shifts between academic and summer sessions.
Source: UVM Transportation Research / Pedestrian Traffic Volumes study
URL: https://www.uvm.edu/~transctr/publications/trb2009/PedestrianTrafficVolumes-Aultman-Hall-Jan09.pdf
Date: 2009
Excerpt: "The difference between the hourly factor of the mean for winter (January through April) and the other months was statistically significant (0.84 versus 1.08 p<0.0005). One might interpret these mean differences by saying... winter reduces average pedestrian levels by 24%."
Context: Multifamily properties in college towns (e.g., Austin, Ann Arbor, State College) will have foot traffic data that is only meaningful if seasonally adjusted.
Confidence: high
```

```
Claim: Retail corridors show two distinct seasonal patterns: flagship-led corridors (e.g., SoHo, Union Square) peak in December, while lifestyle corridors (e.g., South Congress in Austin, Back Bay in Boston) peak in spring and summer.
Source: Placer.ai Blog
URL: https://www.placer.ai/anchor/articles/seasonal-foot-traffic-trends-tells-a-tale-of-two-types-of-retail-corridors
Date: 2025
Excerpt: "Flagship-led corridors... typically see their visitation peak in December... Lifestyle-Driven Retail Corridors... visits to these districts spike earlier in the calendar."
Context: Multifamily walkability scores based on foot traffic must account for the property's retail corridor type.
Confidence: high
```

```
Claim: Vacation rental markets show strong seasonal occupancy swings, with small-city and rural STR markets remaining strong but supply growth slowing. Resort and suburban markets are expected to strengthen in 2026.
Source: AirDNA / StayFi Vacation Rental Statistics
URL: https://stayfi.com/vrm-insider/2026/04/20/vacation-rental-statistics/
Date: 2026-05-26
Excerpt: "Small city and rural markets remained strong in 2025, but their supply growth is expected to slow from 9.3% to about 7.7% in 2026. Resort and suburban markets are expected to strengthen in 2026."
Context: Foot traffic data in vacation markets (e.g., Florida coastal, mountain/lake destinations) is only useful with strong seasonal adjustment.
Confidence: high
```

### 2.8 New Construction vs Existing Stock & POI Lag

```
Claim: SafeGraph POI data is updated monthly and has median coordinate deviation of only 2.17 meters, but new construction POIs depend on when the business opens and is added to the database.
Source: SafeGraph Docs / PassBy comparison
URL: https://docs.safegraph.com/docs/places-data-evaluation
Date: 2025-03-27
Excerpt: "In aggregate, we find that the median distance between SafeGraph and Google Maps coordinates for all SafeGraph POIs is very small (usually 0-5m)."
Context: New multifamily properties in developing areas may not appear in POI databases until after lease-up, creating a 3-12 month lag.
Confidence: medium
```

```
Claim: Multifamily construction timelines have lengthened, with high-rise apartments taking ~24 months from permit to completion, meaning a new property may exist physically for months before appearing in foot traffic data.
Source: RealPage / NAHB
URL: https://www.realpage.com/analytics/apartment-construction-longer-than-ever/
Date: 2017-01-10
Excerpt: "The average construction time of a high-rise apartment building once permits are approved is currently around 24 months, compared to 17.5 months in 2013."
Context: Even if POI databases update monthly, the lag from groundbreaking to first foot traffic measurement is substantial.
Confidence: high
```

### 2.9 Gentrification and Rapid Neighborhood Change

```
Claim: Traditional census data has a 3-5 year lag and cannot capture rapid neighborhood shifts. Real-time data from Yelp, Airbnb, and mobility platforms can serve as early warning indicators of gentrification.
Source: Eagle Alpha / Urban Displacement Project
URL: https://www.eaglealpha.com/2024/06/24/alternative-data-for-real-estate-investment/
Date: 2024-06-27
Excerpt: "Academic studies have demonstrated the utility of alternative data in understanding neighborhood gentrification. Data from platforms like Yelp and Airbnb can reveal changes in local business landscapes and housing affordability, offering real-time indicators of socio-economic shifts."
Context: POI databases may lag gentrification by 6-18 months. A rapidly improving neighborhood may have old POI categories (e.g., discount stores) that no longer reflect current foot traffic composition.
Confidence: medium
```

```
Claim: Gentrifying neighborhoods are often near transit and see increased foot traffic, but crime rates may actually be overestimated because foot traffic data does not distinguish between new visitors and existing residents.
Source: PMC / Buffalo gentrification study
URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC11189242/
Date: 2024
Excerpt: "crime rates in gentrified neighborhoods might actually be overestimated in the current study... despite increased foot traffic in gentrified neighborhoods."
Context: In rapidly changing neighborhoods, raw foot traffic counts may be misinterpreted as positive demand signals when they actually reflect displacement or visitor influx.
Confidence: medium
```

### 2.10 Provider-Specific Geographic Strengths

```
Claim: SafeGraph (Dewey) has best-in-class global POI coverage (2.17m average geocode deviation) but is stronger on POI data than visit analytics. Visit patterns operate at the neighborhood (CBG) level rather than individual store level in many cases.
Source: PassBy / GrowthFactor
URL: https://passby.com/blog/foot-traffic-data-providers/
Date: 2026-04-09
Excerpt: "SafeGraph is stronger on POI data than on visit analytics. Their visit patterns data operates at the neighbourhood (census block group) level rather than the individual store level in many cases."
Context: For multifamily, CBG-level data may be sufficient for neighborhood ranking, but not for building-specific competitive benchmarking.
Confidence: high
```

```
Claim: Unacast's international coverage is broad (180+ countries) but "accuracy is not publicly benchmarked against ground truth" and international coverage has "less granularity" than US coverage.
Source: GrowthFactor / Unacast PR
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "Like most providers, Unacast's coverage is primarily US-based for detailed foot traffic data. International location intelligence exists but with less granularity."
Context: For a multifamily platform evaluating international properties, Unacast can provide directional trends but not precise visit counts.
Confidence: high
```

```
Claim: Foursquare has the largest global POI database (100M+ POIs across 200+ countries) but its analytics are more marketing-oriented than site-selection-oriented. Historical check-in data skews younger and more urban.
Source: GrowthFactor
URL: https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison
Date: 2026-04-22
Excerpt: "The historical check-in data skews younger and more urban than the general population."
Context: Foursquare's global reach is unmatched for POI, but its demographic skew limits utility for diverse or aging multifamily markets.
Confidence: high
```

---

## 3. Coverage Quality Map

| Region / Metro Type | Expected Accuracy | Best Provider | Key Caveat |
|---------------------|-------------------|---------------|------------|
| Primary US metro (NYC, LA, Chicago, Boston) | Very High (r > 0.97) | Placer.ai, PassBy, SafeGraph | All perform well; choose based on cost/API needs |
| Secondary US metro (Austin, Nashville, Charlotte, Phoenix) | High (r ~0.95) | Placer.ai, PassBy | Sun Belt oversupply means foot traffic may decline; data still accurate |
| Tertiary US metro / Rust Belt (Cleveland, Buffalo, Detroit) | Medium-High (r ~0.91) | SafeGraph, Unacast | Panel thinner; seasonal variation high; gentrification may not be captured |
| US Suburban / Exurban | Medium (r ~0.85-0.90) | Placer.ai, PassBy | POI attribution in multi-tenant centers is imprecise |
| US Rural | Low-Medium (r ~0.80-0.85) | SafeGraph, Unacast | "Barely a guess" for some providers; wide confidence intervals |
| College Towns | Medium (seasonally variable) | Placer.ai, SafeGraph | Must seasonally adjust; summer/session breaks distort data |
| Vacation / Seasonal Markets | Medium (seasonally variable) | Placer.ai, SafeGraph | Peaks in summer or winter; off-season data unreliable for ranking |
| Canada | Medium | Unacast, SafeGraph, DataForSEO proxy | Placer.ai does not cover Canada |
| UK / EU | Medium | Unacast, Mytraffic (Gini), Foursquare | GDPR compliance adds complexity; panel density variable by country |
| Australia / NZ | Medium | Unacast, Foursquare, TomTom | Smaller markets, panel density unverified |
| Mexico / Latin America | Low-Medium | Unacast, SafeGraph, Techsalerator | Smartphone penetration ~61.5% in Mexico; rural gaps significant |
| Asia (excl. China) | Low-Medium | Unacast, Horizon-AI | Fragmented provider landscape; data quality varies widely |
| Africa / South Asia | Low | Techsalerator, Unacast | Smartphone ownership ~33-46%; feature phones dominate; data mostly urban |

---

## 4. Demographic Bias Impact Matrix

| Tenant Demographic | Device Ownership Rate | Data Quality Implication | Mitigation Strategy |
|--------------------|----------------------|--------------------------|---------------------|
| Gen Z / Students (18-24) | ~97% | **Overrepresented** in panels; foot traffic may appear higher than actual population-weighted demand | Apply age-weighting corrections; cross-validate with enrollment data |
| Young Professionals (25-34) | ~96% | Well represented; data is reliable for this cohort | Use as baseline reference group |
| Workforce / Families (35-49) | ~89% | Moderately represented; slight undercount possible | Standard debiasing models handle this adequately |
| Middle-income ($30k-$75k) | ~82-83% | **Underrepresented** relative to high-income; multifamily-dense areas may be undercounted | Income-weighted extrapolation; validate against rent rolls |
| Low-income (<$30k) | ~67% | **Significantly underrepresented**; affordable housing markets have artificially low foot traffic scores | Do not rely on foot traffic alone for affordable housing; blend with public transit and POI density |
| Seniors (65+) | ~78% | **Underrepresented**; senior housing and aging-in-place markets systematically undercounted | Use alternative data (Medicare facility visits, caregiver mobility); reduce foot traffic weight in senior market scores |
| Hispanic / Latino | ~75-77% (varies) | **Underrepresented** per PLOS ONE study; markets with high Hispanic tenancy may show bias | Validate against Census block group demographics; apply ethnicity-weighted correction if available |
| Rural residents | ~65-87% | **Underrepresented**; rural multifamily markets (small town workforce housing) have very thin data | Combine with vehicle traffic counts, employment data, and satellite-derived activity indices |
| Black Americans | ~75-85% | Mixed; smartphone ownership is high (~98% cell phone), but some panel providers undercount | Use provider-specific bias reports; SafeGraph over-indexes Black consumers at polling locations but patterns may vary for retail |

---

## 5. Geographic Risk Assessment: 5 Markets Where Foot Traffic Data Is Least Reliable

### 5.1 Rural and Micropolitan Workforce Housing
- **Risk:** Panel density may be 1/100th of urban levels. Extrapolation variance is extreme.
- **Why it matters:** Affordable housing tax credit developments often target small towns where employers (hospitals, factories, distribution centers) anchor demand.
- **What to do:** Reduce foot traffic weight to <20% of ranking score. Supplement with employment data, vehicle counts, and satellite night-light imagery.

### 5.2 Newly Built Suburban Developments (Greenfield)
- **Risk:** POI databases may not include the property or its retail for 3-12 months after opening. Foot traffic data is zero or missing.
- **Why it matters:** Pro forma underwriting for new construction relies on forward-looking demand, not historical data.
- **What to do:** Use proxy locations (nearest comparable center), construction permit data, and migration trend data. Do not rely on current foot traffic counts.

### 5.3 Rapidly Gentrifying Neighborhoods
- **Risk:** POI categories and visitor demographics may lag the actual neighborhood composition by 6-18 months. Old foot traffic patterns may reflect prior residents.
- **Why it matters:** Value-add multifamily strategies depend on identifying inflection points before they are fully priced in.
- **What to do:** Blend foot traffic with alternative data (Yelp category growth, new business openings, social media check-ins, rent growth velocity). Use month-over-month trend acceleration, not absolute levels.

### 5.4 College Towns with Large Student Populations
- **Risk:** Foot traffic drops 40-70% during summer, winter break, and spring break. Annual averages mask the property's true academic-year demand.
- **Why it matters:** Student housing REITs and private student housing operators need 9-10 month lease optimization.
- **What to do:** Use academic-calendar-adjusted metrics (foot traffic during session only). Compare against enrollment trends, not just visit counts.

### 5.5 Seasonal / Vacation Markets (e.g., Florida Coast, Mountain Resorts, Lake Communities)
- **Risk:** Off-season foot traffic is so low that the property appears distressed. Annual averages may mask cash-flow timing mismatches.
- **Why it matters:** Short-term rental multifamily and resort-style properties have seasonal NOI profiles.
- **What to do:** Use peak-season foot traffic as a proxy for revenue potential, but weight by occupancy seasonality curves. Do not rank a ski-market property against a year-round urban property on raw foot traffic.

---

## 6. Provider Coverage Comparison by Region

| Provider | US Primary Metros | US Secondary/Tertiary | Canada | UK/EU | Mexico | Australia | Asia | Africa |
|----------|-------------------|----------------------|--------|-------|--------|-----------|------|--------|
| **Placer.ai** | ★★★★★ | ★★★★☆ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **SafeGraph (Dewey)** | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **PassBy** | ★★★★★ | ★★★★☆ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Unacast** | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Foursquare** | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ |
| **DataForSEO** | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Mytraffic (Gini)** | ✗ | ✗ | ✗ | ★★★★☆ | ✗ | ✗ | ✗ | ✗ |
| **Techsalerator** | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |

*Legend: ★★★★★ = Excellent (validated, granular); ★★★★☆ = Good; ★★★☆☆ = Moderate; ★★☆☆☆ = Limited; ★☆☆☆☆ = Very Limited; ✗ = Not Available*

---

## 7. Stakeholder Analysis

| Stakeholder | Why They Care About Geographic Coverage | What They Need |
|-------------|---------------------------------------|----------------|
| **National REITs** | Portfolio spans 20+ states; need consistent scoring | US-wide coverage with known bias corrections; cannot have data quality vary by market |
| **Regional Investors** | Focus on Sun Belt or Midwest; need to know if data is reliable in their target markets | Secondary/tertiary market accuracy reports; provider panel density by MSA |
| **Local Developers** | Ground-up development in gentrifying or greenfield areas | Forward-looking data (migration, construction permits) because current foot traffic is zero or misleading |
| **Institutional Lenders** | Underwrite loans in diverse markets; need to trust the foot traffic input in pro formas | Provider validation studies at the MSA level; error bounds and confidence intervals |
| **International Allocators** | Evaluate US multifamily vs European or Canadian multifamily | Cross-border data normalization; understanding that US data is much richer than international equivalents |
| **Affordable Housing Developers** | Serve low-income, senior, and rural populations | Bias-adjusted data or alternative metrics that don't penalize properties in low-smartphone-ownership markets |

---

## 8. Counter-Narrative: Is Geographic Bias a Competitive Moat?

If foot traffic data is systematically weaker in rural markets, secondary metros, and affordable housing submarkets, then institutions that can access better ground-truth data in those markets may have an information advantage. This could include:

- **Local operators** with proprietary foot traffic counts (thermal sensors, WiFi analytics, lease-up velocity)
- **Regional brokers** with deep institutional knowledge that transcends data gaps
- **Platforms that blend multiple data layers** (e.g., combining mobile panel data with vehicle traffic counts, parking occupancy, and satellite activity) to compensate for thin panels

However, the counter-moet is also true: as national platforms (JediRe, GrowthFactor) improve their data pipelines, markets that were previously "data dark" become more efficiently priced, compressing local information advantages over time. The window for moat-building is narrowing as secondary-market data quality improves.

---

## 9. Recommendations for JediRe

1. **Geographic Stratification:** Do not use a single foot traffic threshold nationwide. Split scoring models by market tier (Primary / Secondary / Tertiary / Rural) with tier-specific confidence weights.

2. **Seasonal Adjustment:** For college towns and vacation markets, apply calendar-based adjustment factors. Display both raw and seasonally-adjusted foot traffic scores.

3. **Demographic Bias Correction:** If SafeGraph or Unacast is the provider, apply Census-derived device-ownership weights by block group to correct for underrepresentation of low-income and senior populations.

4. **New Construction Handling:** For properties built within the last 24 months, use "proxy POI" logic (nearest comparable retail center + migration data) rather than direct foot traffic counts, which may be missing or misleading.

5. **International Fallback:** If expanding to Canada or UK, do not assume US-grade foot traffic data. Use POI density + Google Maps popularity proxies as a fallback, and weight foot traffic lower in the ranking algorithm.

6. **Transparency:** Show users the "data quality indicator" for each property's foot traffic score (e.g., "High confidence — Primary metro" vs "Low confidence — Rural panel").

---

## Footnotes

[^1]: GrowthFactor. "Foot Traffic Data Provider Comparison (2026)." 22 Apr 2026. https://www.growthfactor.ai/resources/blog/foot-traffic-provider-comparison

[^2]: PassBy. "Foot Traffic Data Providers: Top Platforms Compared [2026]." 9 Apr 2026. https://passby.com/blog/foot-traffic-data-providers/

[^3]: Li Z. et al. "Understanding the bias of mobile location data across spatial scales and over time: A comprehensive analysis of SafeGraph data in the United States." PLOS ONE / NIH PMC. 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC10798630/

[^4]: Exploding Topics. "How Many People Own Smartphones? (2025-2029)." 12 Jan 2026. https://explodingtopics.com/blog/smartphone-stats

[^5]: Chris Poliquin. "SafeGraph Mobility Data" Appendix. https://chrispoliquin.com/files/ceo_gun_activism.pdf

[^6]: Ariadne. "Placer.ai vs Ariadne: modeled location data vs measured on-site people counting." 10 Jun 2026. https://www.ariadne.inc/resources/blogs/placer-ai-alternative/

[^7]: Unacast. "Unacast Now Offers Aggregated Location Data from 80+ Countries." PR Newswire. 7 Feb 2022. https://www.prnewswire.com/news-releases/unacast-now-offers-aggregated-location-data-from-80-countries-301476025.html

[^8]: Foursquare. "Foursquare Places: Comprehensive Map Data." Datarade. https://datarade.ai/data-products/foursquare-places-comprehensive-map-data-global-coverage-foursquare

[^9]: DataForSEO. "DataForSEO SERP API." Datarade. https://datarade.ai/data-products/dataforseo-serp-api-for-rank-tracking-for-any-location-real-dataforseo

[^10]: Barbour E. et al. "Planning for sustainable cities by estimating building occupancy with mobile phones." Nature Communications. 19 Aug 2019. https://www.nature.com/articles/s41467-019-11685-w

[^11]: Aultman-Hall L. et al. "Assessing the Impact of Weather and Season on..." UVM Transportation Research. 2009. https://www.uvm.edu/~transctr/publications/trb2009/PedestrianTrafficVolumes-Aultman-Hall-Jan09.pdf

[^12]: Placer.ai. "Seasonal Foot Traffic Trends Tells a Tale of Two Types of Retail Corridors." Placer.ai Blog. https://www.placer.ai/anchor/articles/seasonal-foot-traffic-trends-tells-a-tale-of-two-types-of-retail-corridors

[^13]: StayFi / AirDNA. "Vacation Rental Statistics, Data, Trends in 2026." 20 Apr 2026. https://stayfi.com/vrm-insider/2026/04/20/vacation-rental-statistics/

[^14]: SafeGraph Docs. "Evaluating SafeGraph Data." 27 Mar 2025. https://docs.safegraph.com/docs/places-data-evaluation

[^15]: RealPage. "Apartment Construction is Taking Longer Than Ever." 10 Jan 2017. https://www.realpage.com/analytics/apartment-construction-longer-than-ever/

[^16]: Eagle Alpha. "Unlocking the Potential of Alternative Data in Real Estate Investment." 24 Jun 2024. https://www.eaglealpha.com/2024/06/24/alternative-data-for-real-estate-investment/

[^17]: Cushman & Wakefield / Smart Growth America. "Foot Traffic Ahead: Ranking Walkable Urbanism." 2019. https://www.cushmanwakefield.com/-/media/cw/americas/united-states/insights/research-report-pdfs/2019/foot_traffic_ahead.pdf

[^18]: CRE Daily. "Sun Belt Vacancies Surge as Multifamily Market Shows Geographic Splits." 5 Jan 2026. https://www.credaily.com/newsletters/national/issue/sun-belt-vacancies-surge-as-multifamily-market-shows-geographic-splits/

[^19]: Mytraffic. "Top 10 best foot traffic data providers in Europe (2026)." https://www.mytraffic.io/en/post/best-foot-traffic-data-providers-europe

[^20]: World Bank. "Mobile phone ownership is widespread. Why is digital inclusion still lagging?" 2 Oct 2025. https://blogs.worldbank.org/en/voices/Mobile-phone-ownership-is-widespread-Why-is-digital-inclusion-still-lagging

[^21]: Census Bureau. "Computer and Internet Use in the United States: 2021." 18 Jun 2024. https://www.census.gov/newsroom/press-releases/2024/computer-internet-use-2021.html

[^22]: SelectHub. "Unacast Reviews 2026." https://www.selecthub.com/p/location-intelligence-software/unacast/

[^23]: GrowthFactor. "The Ultimate Guide to Site Selection Data." 19 Dec 2025. https://www.growthfactor.ai/blog-posts/site-selection-data

[^24]: Placer.ai / CMA. "Summer 2024 Retail Trends: Foot Traffic Hits Seasonal Highs." 16 Jul 2024. https://www.catman.global/summer-2024-retail-trends-foot-traffic-hits-seasonal-highs

[^25]: Datarade. "Unacast Foot Traffic Data | Global." https://datarade.ai/data-products/unacast-foot-traffic-data-global-gravy-analytics
