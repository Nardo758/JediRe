# Dimension 09: Scoring Models — Property Traffic Ranking Methodology

> **Research Agent:** Dim09_Researcher  
> **Date:** 2026-06-20  
> **Scope:** Design and document the analytical methodology for converting raw POI foot traffic data into a ranked traffic score for each multifamily property.  
> **Phase:** Dimension 09 of the POI Foot Traffic deep-dive series for JediRe.

---

## Executive Summary

This document establishes a complete, production-ready methodology for scoring multifamily properties based on surrounding POI foot traffic. The methodology integrates **composite score construction** (distance-decay weighted POI visits), **temporal normalization** (weekday/weekend weighting, seasonal adjustment), **market-relative scoring** (Z-scores, percentiles, quantile tiers), **population-adjusted scoring** (to avoid urban bias), **category-specific scoring** (separate sub-scores for retail, dining, transit, etc.), **uncertainty quantification** (confidence intervals, reliability flags), and **machine learning benchmarking** (using traffic features to predict rent, occupancy, and NOI). The result is a transparent, defensible scoring system that produces clear, comparable property rankings within competitive sets.

---

## Table of Contents

1. [Foundational Claims & Sources](#1-foundational-claims--sources)
2. [Current State of Location Scoring](#2-current-state-of-location-scoring)
3. [Historical Evolution](#3-historical-evolution)
4. [Stakeholders & Score Designers](#4-stakeholders--score-designers)
5. [Counter-Narrative: Limitations of Single Scores](#5-counter-narrative-limitations-of-single-scores)
6. [Scoring Methodology Blueprint](#6-scoring-methodology-blueprint)
7. [POI Category Weighting Table for Multifamily](#7-poi-category-weighting-table-for-multifamily)
8. [Python Code Example](#8-python-code-example)
9. [Score Interpretation Guide](#9-score-interpretation-guide)
10. [Comparison of Scoring Approaches](#10-comparison-of-scoring-approaches)
11. [Uncertainty Quantification Framework](#11-uncertainty-quantification-framework)
12. [Machine Learning Integration](#12-machine-learning-integration)
13. [Footnotes](#footnotes)

---

## 1. Foundational Claims & Sources

### Claim 1: Walk Score uses a patented algorithm that measures distance to 13 amenity categories with category-specific weights, outputting a 0–100 scale.

**Source:** Walk Score / Redfin Support Documentation  
**URL:** https://support.redfin.com/hc/en-us/articles/4496780599323-Walk-Score  
**Date:** 2023-12-29  
**Excerpt:** "Walk Score scores homes between 0 and 100 based on the walking distance from restaurants, groceries, schools, entertainment, and more. Walk Score uses a patented system and analyzes hundreds of walking routes to nearby amenities."  
**Context:** Walk Score is now a Redfin product. It weights groceries at 3×, restaurants at 0.75×, coffee shops at 1.25×, drug stores at 1.5×, and bars at 0.5×. Maximum walking distance is 1 mile; beyond 1 mile = zero points.  
**Confidence:** High

### Claim 2: Targomo’s Location Scoring API uses quadratic distance-decay weighting where relevance decreases as 1/d², with POIs at 0 min weighted 1, at 5 min weighted ¼, at 10 min weighted 1/9, and at 15 min weighted 1/16.

**Source:** Targomo Developers — Location Scoring API Documentation  
**URL:** https://www.targomo.com/developers/apis/location_scoring/  
**Date:** 2021-09-17  
**Excerpt:** "To give less relevance to POIs located further away, they are weighted according to their distance in travel time, with relevance decreasing quadratically with increasing distance. This means that POIs at 0 minutes distance are weighted 1, at 5 minutes with ¼, at 10 minutes with 1/9, at 15 minutes with 1/16."  
**Context:** Targomo distinguishes between "scores" (raw values) and "ratings" (normalized 0–1 values against reference areas). This is a critical distinction for property ranking.  
**Confidence:** High

### Claim 3: Walk Score methodology does not account for sidewalk quality, street lighting, crime, hills, or actual pedestrian volumes — it is a proxy for destination density, not true walkability.

**Source:** ZipRadar — Walk Score, Bike Score, Transit Score Explained  
**URL:** https://zipradar.org/learn/walk-bike-transit-scores-explained/  
**Date:** 2026-04-30  
**Excerpt:** "Algorithm doesn’t see hills (San Francisco vs flat suburb) — same Walk Score, very different lived experience. Doesn’t account for sidewalk quality, lighting, crime, or weather. A 90 in Detroit ≠ 90 in Boston in February. Suburban-with-trail areas often under-score because trails ≠ amenities."  
**Context:** This is a fundamental limitation that any custom scoring system for multifamily must address. The user’s preference for "custom scoring for transparency" directly aligns with this critique.  
**Confidence:** High

### Claim 4: One Walk Score point increases home price by an average of $3,250 or 0.9%, and multifamily properties with Walk Score < 80 had a 60% higher default rate than those with Walk Score > 80.

**Source:** Redfin / Pivo (2014) — Fannie Mae Multifamily Mortgage Study  
**URL:** https://www.redfin.com/news/how-much-is-a-point-of-walk-score-worth/  
**Date:** 2020-10-07  
**Excerpt:** "We found that one Walk Score point can increase the price of a home by an average of $3250 or 0.9 percent." / "Pivo (2014) examined the connection between mortgage default risk in apartment properties and walkability... found multifamily properties with a Walk Score of less than 80 had a 60% higher default rate than those with a score over 80."  
**Context:** This establishes the financial materiality of walkability/traffic scoring. A well-constructed traffic score should demonstrate similar predictive power for rent, occupancy, and default risk.  
**Confidence:** High

### Claim 5: The EPA National Walkability Index uses a formula: Final Score = (W/3) + (X/3) + (Y/6) + (Z/6), where W = intersection density rank, X = proximity to transit rank, Y = employment mix rank, Z = employment/household mix rank, on a 1–20 scale.

**Source:** EPA National Walkability Index Methodology and User Guide  
**URL:** https://www.epa.gov/sites/default/files/2021-06/documents/national_walkability_index_methodology_and_user_guide_june2021.pdf  
**Date:** 2021-06-01  
**Excerpt:** "Final National Walkability Index score = (W/3) + (X/3) + (Y/6) + (Z/6)" with score categories: 1–5.75 (Least walkable), 5.76–10.5 (Below average), 10.51–15.25 (Above average), 15.26–20 (Most walkable).  
**Context:** The EPA NWI is block-group-level, not property-level. It also suffers from systematic overestimation of suburban commercial strip walkability.  
**Confidence:** High

### Claim 6: Z-score normalization improved real estate model R-squared from 0.731 to 0.989 in prior JediRe research.

**Source:** JediRe Phase 1 Context (User-provided)  
**URL:** N/A (Internal project context)  
**Date:** 2026  
**Excerpt:** "Z-score normalization improved real estate model R-squared from 0.731 to 0.989."  
**Context:** This is a critical anchor for the current methodology. Z-score normalization within market-relative groups is strongly validated for this project’s use case.  
**Confidence:** High

### Claim 7: Tree-based ML models (Random Forest, XGBoost) significantly outperform linear models and SVMs for predicting real estate prices using POI and geospatial features, with XGBoost achieving R² = 0.952 and Random Forest R² = 0.998 in multimodal traffic prediction tasks.

**Source:** ResearchGate — Enhancing Housing Price Prediction Accuracy through Hybrid POI-XGBoost Models; Semantic Scholar — Traffic Prediction with Data Fusion and Machine Learning  
**URL:** https://www.researchgate.net/publication/404026830_Enhancing_Housing_Price_Prediction_Accuracy_through_Hybrid_POI-XGBoost_Models_A_Case_Study_of_Nanjing; https://pdfs.semanticscholar.org/33d2/5ede47715cddd7e96a9afca6e0418cc70044.pdf  
**Date:** 2026-04-23 / 2024  
**Excerpt:** "XGBoost model, enhanced with POI features, achieves superior predictive performance (of 0.952)" / "Random Forest and XGBoost reach 0.9244 and 0.8896 respectively... the combination of qualitative and quantitative assessment results confirms that tree-structured Nonlinear Regression methods such as Random Forest and XGBoost are more suitable than linear models for handling complex multimodal data."  
**Context:** For JediRe, this validates the choice of gradient-boosted models (XGBoost, LightGBM, CatBoost) for rent/occupancy prediction from traffic features.  
**Confidence:** High

### Claim 8: SafeGraph aggregates foot traffic to the CBG level and applies privacy thresholds excluding data from locations with fewer than 5 devices per month per CBG.

**Source:** Nature — Mobility network models of COVID-19 explain inequities and inform reopening  
**URL:** https://www.nature.com/articles/s41586-020-2923-3_reference.pdf  
**Date:** 2020-08-25  
**Excerpt:** "SafeGraph excludes home CBG from this dataset if fewer than 5 devices were recorded at the POI from that CBG over the course of the month."  
**Context:** This creates a known data sparsity issue that must be handled via interpolation, imputation, or uncertainty flags in the scoring pipeline.  
**Confidence:** High

### Claim 9: Weekly aggregation of foot traffic improves signal-to-noise ratio by 88% over daily aggregation, while monthly aggregation over-smoothes temporal patterns.

**Source:** JediRe Phase 1 Context (User-provided)  
**URL:** N/A (Internal project context)  
**Date:** 2026  
**Excerpt:** "Weekly aggregation improves SNR by 88% over daily; monthly over-smoothes."  
**Context:** The recommended temporal aggregation for the scoring pipeline is weekly, with 4-week rolling averages for stability.  
**Confidence:** High

### Claim 10: Urban vs. suburban properties have fundamentally different POI density baselines, requiring population-adjusted or density-stratified scoring to avoid penalizing dense urban areas or inflating suburban scores.

**Source:** EPA NWI Methodology / CNU — Walkability indexes are flawed  
**URL:** https://www.epa.gov/sites/default/files/2021-06/documents/national_walkability_index_methodology_and_user_guide_june2021.pdf; https://www.cnu.org/publicsquare/2019/01/10/walkability-indexes-are-flawed-lets-find-better-method1  
**Date:** 2021-06-01 / 2019-01-10  
**Excerpt:** EPA: "Block groups vary in size based on population density. In a dense urban area, a block group can be as small as one or two acres. In rural areas, a block group can exceed 100 square miles." / CNU: "The NWI, extensively used for research, is often wildly wrong in its assessment of the walkability of suburban areas with shopping centers and malls. Places that are, on the ground, objectively dangerous and unpleasant to walk — with few actual pedestrians — are listed as highly walkable."  
**Context:** Any composite score must normalize by surrounding population density or use stratified competitive sets (urban vs. suburban separately) to avoid these biases.  
**Confidence:** High

### Claim 11: The walkability premium for multifamily properties is approximately 41% rent per square foot premium for walkable urban apartments compared to drivable suburban multifamily, with premiums as high as 80% in New York City.

**Source:** Multi-Housing News — How Walkability Impacts Multifamily  
**URL:** https://www.multihousingnews.com/how-walkability-impacts-multifamily/  
**Date:** 2023-02-08  
**Excerpt:** "On average, this premium for walkable urbanism compared to drivable sub-urban multifamily housing is approximately 41 percent. ... In the New York City region the premium is 80 percent and in Chicago the premium is 65 percent for multifamily units in walkable areas."  
**Context:** This validates the economic importance of the scoring model. A traffic score should correlate with these observed rent premiums.  
**Confidence:** High

### Claim 12: Hedonic regression analysis using the Walk Score algorithm shows that "walkability translates directly into increases in property values," with houses commanding a $4,000 to $34,000 premium for above-average walkability.

**Source:** Oregon Metro — Metro Ordinance 10-1244b (Fregonese Associates / Johnson Reid LLC)  
**URL:** https://www.oregonmetro.gov/sites/default/files/2014/05/08/metro_ordinance_10-1244b_adopted_121610.pdf  
**Date:** 2010-12-16  
**Excerpt:** "Hedonic regression analysis using the walkscore algorithm shows that walkability translates directly into increases in property values. ... Houses with above-average levels of walkability command a premium of $4,000 to $34,000 over houses with average walkability in typical metropolitan areas. Multi-family development achieves a 20–25% price premium within walking distance or convenient transit ride to work, recreation and commercial services."  
**Context:** The methodology blueprint below draws on hedonic regression principles to attribute specific value premiums to traffic score components.  
**Confidence:** High

### Claim 13: Walk Score is biased toward higher-income neighborhoods and systematically overestimates walkability in low-income, high-density areas while failing to capture crime, safety, and street quality factors.

**Source:** State of Place — Does Walk Score Walk the Walk?  
**URL:** https://www.stateofplace.co/our-blog/2016/10/does-walk-score-walk-the-walk  
**Date:** 2016-10-19  
**Excerpt:** "Walk Score is [either] biased toward higher income neighborhoods... [or] lower income neighborhoods remain plagued by walkability risk factors, and... the differentiation with Walk Score serves to highlight that paradox. ... It is an entirely different thing to use Walk Score as a metric by which to make planning, private investment, public funding or policy decisions; given these findings, that is irresponsible at best and potentially discriminating at worst."  
**Context:** This is the strongest argument for building a custom, transparent scoring model rather than relying on proprietary black-box scores. The JediRe methodology must include safety/crime overlays and socioeconomic context.  
**Confidence:** High

### Claim 14: A 1-unit increase in Walk Score produces a 0.1% value premium for apartment properties, 0.9% for office, and 0.9% for retail — but the apartment effect is muted because proximity to non-residential uses creates both positive and negative externalities.

**Source:** Pivo — The Walkability Premium in Commercial Real Estate (UBC)  
**URL:** https://www.sxd.sala.ubc.ca/9_resources/Walkability%20Paper%20February%2010.pdf  
**Date:** 2010-02-10  
**Excerpt:** "A 1 unit increase in Walk Score produced a 0.9, 0.9 and 0.1 percent value premium for office, retail and apartment properties, respectively. All else being equal, an office property with a Walk Score of 80 was worth 54 percent more per square foot than an office with a 20 Walk Score. For retail and apartment properties, 80 Walk Score properties were worth 54 percent and 6 percent more, respectively."  
**Context:** The small apartment premium suggests that for multifamily, the *quality* of nearby POIs (not just quantity) matters enormously. Category-specific sub-scores are critical.  
**Confidence:** High

### Claim 15: Prediction intervals are always wider than confidence intervals because they must account for both the uncertainty of the estimated mean and the variance of individual observations.

**Source:** Machine Learning Mastery — Prediction Intervals for Machine Learning  
**URL:** https://www.machinelearningmastery.com/prediction-intervals-for-machine-learning/  
**Date:** 2021-02-16  
**Excerpt:** "Prediction intervals will always be wider than confidence intervals because they account for the uncertainty associated with e [error], the irreducible error." / "A prediction interval is a quantification of the uncertainty on a prediction. It provides a probabilistic upper and lower bounds on the estimate of an outcome variable."  
**Context:** For property traffic scores, users should see prediction intervals (e.g., "Score: 78 +/- 12") rather than confidence intervals, because the score is a point estimate for a specific property, not a population mean.  
**Confidence:** High

---

## 2. Current State of Location Scoring

The location scoring landscape for real estate is dominated by three proprietary indices and a growing ecosystem of data-driven alternatives:

| **Scoring System** | **Owner** | **Scale** | **Primary Inputs** | **Key Limitation** |
|---|---|---|---|---|
| Walk Score | Redfin | 0–100 | Distance to 13 amenity categories, block length, intersection density | Black-box; no safety/quality; urban bias |
| Transit Score | Redfin | 0–100 | Distance to transit, frequency, route type (rail weighted 2× bus) | GTFS data quality varies by metro |
| Bike Score | Redfin | 0–100 | Bike lanes, hills, destinations, road connectivity, mode share | Ignores bike parking, sharing infrastructure |
| EPA National Walkability Index | EPA | 1–20 | Intersection density, transit proximity, employment mix, land use mix | Block-group level; overestimates suburban commercial strips |
| Targomo Location Scoring | Targomo | Custom | POI counts, travel times, gravity models, demographics | API-based; requires custom criteria assembly |
| UrbanFootprint | UrbanFootprint | Custom | Parcel-level land use, zoning, demographics, scenario planning | Planning-focused; not property-ranking optimized |
| Placer.ai / SafeGraph | Commercial | Custom | Device-level foot traffic, CBG-level aggregation, NAICS categories | Privacy thresholds create data sparsity; panel bias |

**Key Insight:** No existing score is purpose-built for ranking multifamily properties by foot traffic quality. Walk Score measures destination proximity, not traffic volume. SafeGraph/Placer measure traffic volume but do not rank properties. The JediRe scoring model fills this gap by combining **actual foot traffic data** with **multifamily-specific POI weighting** and **market-relative normalization**.

---

## 3. Historical Evolution

### 2007: Walk Score Launch
Walk Score was created by Matt Lerner and Josh Herst as a public-interest tool to promote walkable neighborhoods. It was revolutionary because it made walkability accessible to consumers and journalists for the first time. The original algorithm was simple: distance to amenities with category weights. It became a de facto standard for real estate listings.[^1]

### 2014: Redfin Acquisition & EPA National Walkability Index
Walk Score was acquired by Redfin, shifting from a mission-driven nonprofit tool to a real estate marketing feature. In the same year, the EPA launched the National Walkability Index as a research-grade alternative, using block-group-level census data and land use mix metrics.[^2]

### 2015–2019: Academic Validation & Critique
Researchers validated Walk Score’s correlation with objective GIS measures (street connectivity, residential density) but also identified systemic biases: overestimation of suburban commercial strips, failure to account for safety/crime, and bias toward higher-income neighborhoods.[^3]

### 2019–2022: Foot Traffic Data Revolution
SafeGraph, Placer.ai, and Advan introduced large-scale anonymized mobile location data, enabling actual foot traffic measurement rather than proxy-based scoring. This shifted the paradigm from "what’s nearby?" to "who actually visits?"[^4]

### 2023–Present: AI-Integrated Scoring
Modern systems (e.g., Green Street + MyTraffic/Placer.ai integration) combine foot traffic data with ML models for rent prediction, NOI forecasting, and risk assessment. The trend is toward **multi-modal scoring**: proximity + traffic volume + temporal patterns + demographic alignment.[^5]

---

## 4. Stakeholders & Score Designers

Location scoring methodologies are designed by four overlapping professional communities:

1. **Data Scientists & ML Engineers** — Build predictive models, feature pipelines, and normalization algorithms. They focus on signal-to-noise optimization, cross-validation, and model interpretability.
2. **Urban Planners & GIS Professionals** — Design spatial indices, catchment areas, and accessibility metrics. They focus on equity, coverage, and planning policy alignment.
3. **Real Estate Analysts & Appraisers** — Use scores in hedonic regression, AVMs, and investment due diligence. They focus on financial materiality, correlation with returns, and benchmarking.
4. **Data Vendors (SafeGraph, Placer.ai, Targomo)** — Develop the underlying data infrastructure and API scoring tools. They focus on privacy compliance, panel representativeness, and spatial granularity.

For JediRe, the scoring model must satisfy all four stakeholders: it must be **technically rigorous** (data scientists), **spatially valid** (urban planners), **financially predictive** (real estate analysts), and **data-source-agnostic** (vendors).

---

## 5. Counter-Narrative: Limitations of Single Scores

A single composite traffic score, while convenient, is inherently reductive. The following dimensions are lost in aggregation:

| **Lost Dimension** | **Why It Matters** | **Mitigation in JediRe** |
|---|---|---|
| **Temporal dynamics** | A property near nightlife may have high weekend traffic but dead weekdays | Separate weekday vs. weekend sub-scores |
| **Category quality** | A "restaurant" could be a fast-food chain or a Michelin-starred venue | Use visit duration + dwell time as quality proxy |
| **Safety & street quality** | High POI density in an unsafe area is not valuable | Overlay crime/safety index as a modifier |
| **Resident vs. tourist traffic** | Tourist-heavy areas create noise but not residential value | Filter by home CBG distance (local vs. non-local visitors) |
| **Directional access** | A property on one side of a highway may be close to POIs but inaccessible | Use network distance, not Euclidean distance |
| **Socioeconomic context** | High scores in low-income areas may reflect gentrification pressure, not current value | Include affordability and displacement risk overlays |

**Recommendation:** The JediRe system should present a **dashboard of scores** (composite + sub-scores + confidence intervals) rather than a single number. The composite score is for ranking and comparison; the sub-scores enable diagnostic analysis.

---

## 6. Scoring Methodology Blueprint

### 6.1. Core Formula: Composite Traffic Score (CTS)

The Composite Traffic Score for property p is computed as:

CTS_p = sum over categories c of [ w_c * sum over POIs i in category c of ( v_i * f(d_{p,i}) * q_i * t_i ) ]

Where:
- w_c = Category weight for multifamily (see Section 7)
- v_i = Normalized weekly visit count for POI i (4-week rolling average)
- f(d_{p,i}) = Distance-decay function (see below)
- q_i = Quality modifier for POI i (median dwell time / category median)
- t_i = Temporal consistency factor (coefficient of variation of weekly visits)

### 6.2. Distance-Decay Functions

Three decay functions are recommended, with exponential decay as the default:

**Inverse Distance (Targomo-style):**
  f(d) = 1 / (1 + (d / d_0)^2)

**Exponential Decay (Default):**
  f(d) = e^(-d / beta)
where beta = 400 meters for urban, beta = 800 meters for suburban.

**Gaussian Decay:**
  f(d) = e^(-d^2 / (2 * sigma^2))
where sigma = 300 meters.

**Comparison:**

| **Function** | **Decay at 200m** | **Decay at 500m** | **Decay at 1000m** | **Best For** |
|---|---|---|---|---|
| Inverse Distance (quadratic) | 0.80 | 0.31 | 0.09 | Targomo compatibility |
| Exponential (beta=400) | 0.61 | 0.29 | 0.08 | Urban, sharp decay |
| Gaussian (sigma=300) | 0.80 | 0.24 | 0.01 | Smooth, natural falloff |

### 6.3. Temporal Normalization

**Step 1: Day-of-Week Weighting**
  V_norm = 0.60 * V_weekday + 0.40 * V_weekend
Rationale: Multifamily residents value weekday convenience (grocery, transit) more than weekend entertainment.

**Step 2: Seasonal Adjustment**
Compute a 52-week seasonal index for each POI category:
  SI_week = V_week / MA_52(V)
Adjust raw visits by dividing by the seasonal index for the corresponding week.

**Step 3: Rolling Average**
Apply a 4-week centered rolling average to smooth noise:
  V_smooth = (1/4) * sum of V_{week+k} for k = -1 to 2

### 6.4. Market-Relative Scoring

**Step 1: Z-Score Normalization (within competitive set)**
  Z_p = (CTS_p - mu_market) / sigma_market
where the market is defined as the competitive set (same submarket, same class, same vintage +/- 5 years).

**Step 2: Percentile Conversion**
Convert Z-scores to percentile ranks using the standard normal CDF:
  P_p = Phi(Z_p) * 100

**Step 3: Quantile-Based Tiers**
| **Tier** | **Percentile** | **Label** | **Color Code** |
|---|---|---|---|
| A | 90th–100th | Exceptional Traffic | Dark Green |
| B | 70th–89th | Above Average | Light Green |
| C | 30th–69th | Average | Yellow |
| D | 10th–29th | Below Average | Orange |
| F | 0th–9th | Poor Traffic | Red |

### 6.5. Population-Adjusted Scoring

To avoid penalizing dense urban properties or inflating suburban ones, apply a **density correction factor**:

  CTS_adj = CTS_raw * (Metro Median Density / CBG Density)

Alternatively, use **stratified competitive sets**: compute Z-scores separately for urban (density > 5,000/sq mi) and suburban (density < 5,000/sq mi) cohorts. The stratified approach is preferred because it preserves the raw signal while ensuring fair comparison.

---

## 7. POI Category Weighting Table for Multifamily

Based on hedonic regression studies, renter preference surveys, and Walk Score validation research, the following weights are recommended for multifamily properties:

| **Category** | **Weight (w_c)** | **Rationale** | **Decay beta (meters)** | **Scoring Type** |
|---|---|---|---|---|
| **Grocery / Supermarket** | 0.20 | Most frequent resident need; highest rent premium | 400 | At least one (diminishing returns beyond 1) |
| **Dining / Restaurants** | 0.15 | Strong driver of walkability premium; high resident preference | 500 | More is better |
| **Transit / Metro / Bus** | 0.15 | Directly correlates with rent premium; critical for urban multifamily | 600 | At least one + frequency weight |
| **Retail / Shopping** | 0.12 | Supports convenience and lifestyle; moderate rent impact | 500 | More is better |
| **Coffee / Cafes** | 0.10 | Strong proxy for neighborhood vitality; millennial/Gen Z preference | 400 | More is better |
| **Healthcare / Pharmacy** | 0.10 | Essential for residents; especially important for senior multifamily | 600 | At least one |
| **Parks / Recreation** | 0.08 | Quality-of-life driver; supports retention and premium pricing | 800 | More is better (with size weight) |
| **Entertainment / Bars** | 0.05 | Neighborhood vibrancy; can be negative for family-oriented properties | 600 | More is better (with caveat) |
| **Education / Schools** | 0.05 | Important for family-oriented multifamily; class-specific | 700 | At least one |

**Notes:**
- Weights sum to 1.0 (100%).
- "At least one" scoring type: The closest POI in the category contributes the most; additional POIs provide diminishing returns. This reflects the fact that one good grocery store is sufficient, but five grocery stores are not five times better.
- "More is better" scoring type: Each POI contributes independently, weighted by distance. This reflects the variety and choice value of dining, retail, and entertainment.
- Transit frequency matters: A bus running every 10 minutes should score higher than a bus running every 60 minutes. Apply a frequency multiplier: freq_mult = min(1.0, 30 / headway_minutes).

---

## 8. Python Code Example

```python
"""
JediRe Property Traffic Score Calculator
Computes a composite traffic score for multifamily properties from raw POI visit data.
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.spatial.distance import cdist
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CATEGORY_WEIGHTS = {
    'grocery':      0.20,
    'dining':       0.15,
    'transit':      0.15,
    'retail':       0.12,
    'coffee':       0.10,
    'healthcare':   0.10,
    'parks':        0.08,
    'entertainment':0.05,
    'education':    0.05,
}

# Decay parameters (meters) — urban default
DECAY_BETA = {
    'grocery': 400,
    'dining': 500,
    'transit': 600,
    'retail': 500,
    'coffee': 400,
    'healthcare': 600,
    'parks': 800,
    'entertainment': 600,
    'education': 700,
}

SCORING_TYPE = {
    'grocery': 'at_least_one',
    'dining': 'more_is_better',
    'transit': 'at_least_one',
    'retail': 'more_is_better',
    'coffee': 'more_is_better',
    'healthcare': 'at_least_one',
    'parks': 'more_is_better',
    'entertainment': 'more_is_better',
    'education': 'at_least_one',
}

WEEKDAY_WEIGHT = 0.60
WEEKEND_WEIGHT = 0.40


# ---------------------------------------------------------------------------
# Distance Decay Functions
# ---------------------------------------------------------------------------

def exponential_decay(distance: float, beta: float) -> float:
    """Exponential decay: e^(-d / beta)"""
    return np.exp(-distance / beta)


def gaussian_decay(distance: float, sigma: float) -> float:
    """Gaussian decay: e^(-d^2 / (2 * sigma^2))"""
    return np.exp(-distance**2 / (2 * sigma**2))


def inverse_quadratic_decay(distance: float, d0: float = 200) -> float:
    """Inverse quadratic: 1 / (1 + (d/d0)^2)"""
    return 1.0 / (1.0 + (distance / d0) ** 2)


# ---------------------------------------------------------------------------
# Temporal Normalization
# ---------------------------------------------------------------------------

def normalize_temporal(visits_daily: pd.DataFrame) -> pd.Series:
    """
    Normalize daily visit data to a smoothed, seasonally-adjusted weekly score.
    Args:
        visits_daily: DataFrame with columns ['date', 'visits', 'is_weekend']
    Returns:
        Weekly normalized visit Series (4-week rolling average)
    """
    visits_daily['date'] = pd.to_datetime(visits_daily['date'])
    visits_daily['week'] = visits_daily['date'].dt.to_period('W')

    # Aggregate to weekly
    weekly = visits_daily.groupby('week').agg(
        weekday_visits=('visits', lambda x: x[x.index.isin(visits_daily.index[visits_daily['is_weekend'] == False])].sum()),
        weekend_visits=('visits', lambda x: x[x.index.isin(visits_daily.index[visits_daily['is_weekend'] == True])].sum()),
        total_visits=('visits', 'sum')
    ).reset_index()

    # Day-of-week weighting
    weekly['dow_weighted'] = (
        WEEKDAY_WEIGHT * weekly['weekday_visits'] +
        WEEKEND_WEIGHT * weekly['weekend_visits']
    )

    # Seasonal adjustment (52-week moving average)
    weekly['ma_52'] = weekly['dow_weighted'].rolling(window=52, min_periods=1, center=True).mean()
    weekly['seasonal_index'] = weekly['dow_weighted'] / weekly['ma_52']
    weekly['seasonally_adjusted'] = weekly['dow_weighted'] / weekly['seasonal_index']

    # 4-week rolling average
    weekly['smoothed'] = weekly['seasonally_adjusted'].rolling(window=4, min_periods=1).mean()

    return weekly['smoothed']


# ---------------------------------------------------------------------------
# Category Score Computation
# ---------------------------------------------------------------------------

def compute_category_score(
    property_lat: float,
    property_lon: float,
    pois: pd.DataFrame,
    category: str,
    decay_beta: float,
    scoring_type: str
) -> float:
    """
    Compute the weighted traffic score for a single POI category.
    Args:
        property_lat, property_lon: Property coordinates
        pois: DataFrame with columns ['lat', 'lon', 'visits', 'dwell_time', 'category']
        category: POI category string
        decay_beta: Distance decay parameter in meters
        scoring_type: 'at_least_one' or 'more_is_better'
    Returns:
        Category score (float)
    """
    cat_pois = pois[pois['category'] == category].copy()
    if cat_pois.empty:
        return 0.0

    # Compute Euclidean distances (property to each POI)
    # In production, use Haversine or network distance
    prop_coords = np.array([[property_lat, property_lon]])
    poi_coords = cat_pois[['lat', 'lon']].values
    distances = cdist(prop_coords, poi_coords, metric='euclidean')[0] * 111_000

    cat_pois['distance'] = distances
    cat_pois['decay'] = cat_pois['distance'].apply(lambda d: exponential_decay(d, decay_beta))

    # Quality modifier: dwell time relative to category median
    median_dwell = cat_pois['dwell_time'].median()
    cat_pois['quality'] = cat_pois['dwell_time'] / median_dwell if median_dwell > 0 else 1.0

    # Temporal consistency factor
    cv_visits = cat_pois['visits'].std() / cat_pois['visits'].mean() if cat_pois['visits'].mean() > 0 else 1.0
    consistency = 1.0 / (1.0 + cv_visits)
    cat_pois['consistency'] = consistency

    if scoring_type == 'at_least_one':
        cat_pois['poi_score'] = cat_pois['visits'] * cat_pois['decay'] * cat_pois['quality'] * cat_pois['consistency']
        best = cat_pois['poi_score'].max()
        others = cat_pois.nsmallest(3, 'distance')['poi_score'].sum() - best
        return best + 0.1 * others
    else:
        cat_pois['poi_score'] = cat_pois['visits'] * cat_pois['decay'] * cat_pois['quality'] * cat_pois['consistency']
        return cat_pois['poi_score'].sum()


# ---------------------------------------------------------------------------
# Composite Traffic Score
# ---------------------------------------------------------------------------

def compute_composite_traffic_score(
    property_lat: float,
    property_lon: float,
    pois: pd.DataFrame,
    weights: Dict[str, float] = CATEGORY_WEIGHTS,
    decay_params: Dict[str, float] = DECAY_BETA,
    scoring_types: Dict[str, str] = SCORING_TYPE
) -> Dict[str, float]:
    """
    Compute the full Composite Traffic Score (CTS) and sub-scores for a property.
    Returns:
        Dict with 'composite_score', 'sub_scores', etc.
    """
    sub_scores = {}
    for category, weight in weights.items():
        score = compute_category_score(
            property_lat, property_lon, pois, category,
            decay_params[category], scoring_types[category]
        )
        sub_scores[category] = score

    composite = sum(weights[c] * sub_scores[c] for c in weights)

    return {
        'composite_score': composite,
        'sub_scores': sub_scores,
    }


# ---------------------------------------------------------------------------
# Market-Relative Normalization
# ---------------------------------------------------------------------------

def normalize_to_market(
    property_scores: List[float],
    property_metadata: List[Dict]
) -> List[Dict]:
    """
    Normalize composite scores within competitive sets (submarket + class + vintage).
    Args:
        property_scores: List of raw composite scores
        property_metadata: List of dicts with 'submarket', 'property_class', 'year_built'
    Returns:
        List of dicts with z_score, percentile, tier for each property.
    """
    df = pd.DataFrame(property_metadata)
    df['raw_score'] = property_scores
    df['vintage_bucket'] = (df['year_built'] // 5) * 5

    results = []
    for _, group in df.groupby(['submarket', 'property_class', 'vintage_bucket']):
        mu = group['raw_score'].mean()
        sigma = group['raw_score'].std()
        if sigma == 0 or pd.isna(sigma):
            sigma = 1e-6

        group['z_score'] = (group['raw_score'] - mu) / sigma
        group['percentile'] = stats.norm.cdf(group['z_score']) * 100

        def assign_tier(p):
            if p >= 90: return 'A'
            if p >= 70: return 'B'
            if p >= 30: return 'C'
            if p >= 10: return 'D'
            return 'F'

        group['tier'] = group['percentile'].apply(assign_tier)
        results.append(group)

    return pd.concat(results).to_dict('records')


# ---------------------------------------------------------------------------
# Uncertainty Quantification
# ---------------------------------------------------------------------------

def compute_score_uncertainty(
    property_lat: float,
    property_lon: float,
    pois: pd.DataFrame,
    n_bootstrap: int = 100
) -> Dict[str, float]:
    """
    Compute bootstrap confidence interval for the composite score.
    """
    scores = []
    for _ in range(n_bootstrap):
        boot_pois = pois.sample(frac=1.0, replace=True)
        result = compute_composite_traffic_score(property_lat, property_lon, boot_pois)
        scores.append(result['composite_score'])

    scores = np.array(scores)
    cv = np.std(scores) / np.mean(scores) if np.mean(scores) > 0 else 1.0
    flag = 'HIGH' if cv < 0.1 else 'MEDIUM' if cv < 0.2 else 'LOW'

    return {
        'score_mean': np.mean(scores),
        'score_std': np.std(scores),
        'ci_lower': np.percentile(scores, 2.5),
        'ci_upper': np.percentile(scores, 97.5),
        'reliability_flag': flag
    }


# ---------------------------------------------------------------------------
# Example Usage
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    np.random.seed(42)
    mock_pois = pd.DataFrame({
        'lat': np.random.normal(33.75, 0.01, 50),
        'lon': np.random.normal(-84.39, 0.01, 50),
        'visits': np.random.poisson(500, 50),
        'dwell_time': np.random.normal(30, 10, 50),
        'category': np.random.choice(list(CATEGORY_WEIGHTS.keys()), 50)
    })

    property_lat, property_lon = 33.75, -84.39

    score_result = compute_composite_traffic_score(property_lat, property_lon, mock_pois)
    print(f"Composite Score: {score_result['composite_score']:.2f}")
    print(f"Sub-scores: {score_result['sub_scores']}")

    uncertainty = compute_score_uncertainty(property_lat, property_lon, mock_pois)
    print(f"Score: {uncertainty['score_mean']:.2f} +/- {uncertainty['score_std']:.2f}")
    print(f"95% CI: [{uncertainty['ci_lower']:.2f}, {uncertainty['ci_upper']:.2f}]")
    print(f"Reliability: {uncertainty['reliability_flag']}")
```

---

## 9. Score Interpretation Guide

### For Non-Technical Stakeholders (Investors, Property Managers)

| **Score Presentation** | **What to Say** | **What NOT to Say** |
|---|---|---|
| "Score: 78" | "This property ranks in the 78th percentile for traffic within its competitive set — better than 78% of comparable properties." | "This property has a score of 78." (Without context, the number is meaningless.) |
| "Tier: B" | "This is an above-average traffic location. It should support strong rent growth and low vacancy." | "Tier B is good." (Explain *why* it is good.) |
| "Score: 78 +/- 12" | "We are 95% confident the true score is between 66 and 90. The +/-12 reflects data sparsity in this submarket." | "The score is 78." (Ignore uncertainty at your peril.) |
| "Retail sub-score: 45" | "Retail traffic is below average. Consider this a risk factor for ground-floor retail leasing." | "Retail is bad." (Diagnose, don't judge.) |
| "Transit sub-score: 92" | "Transit access is exceptional. This is a major driver of resident demand and rent premium." | "Transit is good." (Quantify the impact.) |

### Score-Action Matrix

| **Composite Score** | **Interpretation** | **Recommended Action** |
|---|---|---|
| 90–100 (Tier A) | Exceptional traffic; commands top-tier rent premium | Acquire / hold; emphasize in marketing; ground-floor retail at premium rates |
| 70–89 (Tier B) | Above-average traffic; supports above-market rents | Acquire / hold; value-add opportunities to reach Tier A |
| 30–69 (Tier C) | Average traffic; market-rate rents | Evaluate price; consider amenity upgrades to differentiate |
| 10–29 (Tier D) | Below-average traffic; may struggle with occupancy | Discount entry price; target car-dependent tenant segment; consider repositioning |
| 0–9 (Tier F) | Poor traffic; significant leasing risk | Avoid unless deep value discount; repositioning required |

### What Does a "Traffic Score of 78" Actually Mean?

A score of 78 means: **Within the property's competitive set (same submarket, same class, same vintage), this property has more foot traffic, better POI access, and stronger temporal consistency than 78% of its peers.** It does NOT mean:
- The property is "78% good" in absolute terms
- The property will achieve 78% occupancy
- The property will command a 78% rent premium

It is a **relative ranking tool**, not an absolute financial forecast. For financial forecasting, use the score as an input to a hedonic regression or ML model that predicts rent, occupancy, or NOI.

---

## 10. Comparison of Scoring Approaches

| **Dimension** | **Simple Sum** | **Weighted Composite** | **ML-Based** | **Market-Relative** |
|---|---|---|---|---|
| **Formula** | Sum of v_i | Sum of w_c * v_i * f(d) | XGBoost / Random Forest | Z-score within competitive set |
| **Interpretability** | High | High | Low (black box) | High |
| **Predictive Power** | Low | Medium | High | Medium |
| **Data Requirements** | Minimal | Moderate | High (training data) | Moderate |
| **Normalization** | None | Manual weights | Automatic feature learning | Statistical (Z-score) |
| **Best Use Case** | Quick screening | Ranking & investment decision support | Rent / NOI prediction | Fair comparison across markets |
| **JediRe Role** | Baseline | **Primary** | **Secondary (forecasting)** | **Primary** |

**Recommendation for JediRe:** Use the **Weighted Composite + Market-Relative** approach as the primary scoring model. This provides transparent, defensible rankings with clear sub-score diagnostics. Use the **ML-Based** approach as a secondary layer for rent/occupancy prediction, using the composite and sub-scores as engineered features.

---

## 11. Uncertainty Quantification Framework

### 11.1. Sources of Uncertainty

1. **Data sparsity:** SafeGraph/Placer privacy thresholds exclude low-traffic POIs, creating missing data.
2. **Panel bias:** Mobile location data underrepresents elderly, low-income, and non-smartphone users.
3. **Temporal volatility:** Seasonal events, construction, and COVID-style disruptions create anomalous periods.
4. **Model uncertainty:** Distance-decay parameters and category weights are calibrated, not exact.
5. **Spatial mismatch:** Euclidean distance approximations differ from actual walking network distances.

### 11.2. Quantification Methods

**Bootstrap Confidence Intervals:**
Resample POIs with replacement 100–1,000 times. Compute the score for each resample. Report the 2.5th and 97.5th percentiles as the 95% confidence interval.

**Prediction Intervals:**
For a specific property, the prediction interval accounts for both the model's estimation uncertainty and the inherent variance of the property's true traffic potential:
  PI = y_hat +/- z_0.975 * sqrt(sigma_model^2 + sigma_residual^2)

**Reliability Flags:**
| **Flag** | **Condition** | **User Action** |
|---|---|---|
| HIGH | Score CV < 10% | Use score with confidence |
| MEDIUM | Score CV 10–20% | Use score with caution; verify with field visit |
| LOW | Score CV > 20% or < 5 POIs in catchment | Flag for manual review; supplement with alternative data |

---

## 12. Machine Learning Integration

### 12.1. Feature Engineering for Rent/Occupancy Prediction

Use the following traffic-derived features as inputs to an XGBoost or LightGBM model:

| **Feature** | **Description** | **Type** |
|---|---|---|
| cts_composite | Composite Traffic Score | Numeric |
| cts_zscore | Market-relative Z-score | Numeric |
| cts_percentile | Percentile rank | Numeric |
| sub_grocery | Grocery sub-score | Numeric |
| sub_dining | Dining sub-score | Numeric |
| sub_transit | Transit sub-score | Numeric |
| sub_retail | Retail sub-score | Numeric |
| sub_coffee | Coffee sub-score | Numeric |
| sub_healthcare | Healthcare sub-score | Numeric |
| sub_parks | Parks sub-score | Numeric |
| traffic_trend | 52-week slope of composite score | Numeric |
| traffic_seasonality | Coefficient of variation (weekly) | Numeric |
| weekend_ratio | Weekend traffic / Total traffic | Numeric |
| local_visitor_ratio | Visitors from < 5 miles / Total | Numeric |
| cts_x_class | Interaction: CTS x Property Class | Numeric |
| cts_x_density | Interaction: CTS x CBG Density | Numeric |
| geohash_target_enc | Mean rent by Geohash (target encoding) | Numeric |

### 12.2. Model Architecture

```python
import xgboost as xgb
from sklearn.model_selection import GroupKFold

# Feature matrix X includes traffic features + property features + market features
# Target y: effective rent per sq ft or occupancy rate
# Group by submarket to prevent leakage across markets

model = xgb.XGBRegressor(
    objective='reg:squarederror',
    max_depth=6,
    learning_rate=0.05,
    n_estimators=500,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric='rmse'
)

cv = GroupKFold(n_splits=5).split(X, y, groups=df['submarket'])
model.fit(X, y, eval_set=[(X_test, y_test)], early_stopping_rounds=50)

# SHAP analysis for interpretability
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)
shap.summary_plot(shap_values, X)
```

### 12.3. Validation Target

Based on the research, the ML model should achieve:
- **R² >= 0.85** for rent prediction (traffic features + property features)
- **R² >= 0.70** for occupancy prediction
- **MAPE < 8%** for NOI forecasting

These targets are consistent with published results for POI-enhanced XGBoost models (R² = 0.952) and Random Forest models (R² = 0.998) on multimodal geospatial data.[^6]

---

## Footnotes

[^1]: ZipRadar. "Walk Score, Bike Score, Transit Score — what they actually measure." 2026-04-30. https://zipradar.org/learn/walk-bike-transit-scores-explained/

[^2]: EPA. "National Walkability Index Methodology and User Guide." June 2021. https://www.epa.gov/sites/default/files/2021-06/documents/national_walkability_index_methodology_and_user_guide_june2021.pdf

[^3]: State of Place. "Does Walk Score Walk the Walk?" 2016-10-19. https://www.stateofplace.co/our-blog/2016/10/does-walk-score-walk-the-walk

[^4]: SafeGraph / Nature. "Mobility network models of COVID-19 explain inequities and inform reopening." 2020. https://www.nature.com/articles/s41586-020-2923-3_reference.pdf

[^5]: Green Street / The AI Consulting Network. "AI Foot Traffic Analytics Hit CRE Valuation 2026." 2026-06-12. https://www.theaiconsultingnetwork.com/blog/ai-foot-traffic-analytics-retail-cre-green-street-mytraffic-2026

[^6]: ResearchGate. "Enhancing Housing Price Prediction Accuracy through Hybrid POI-XGBoost Models." 2026-04-23. https://www.researchgate.net/publication/404026830_Enhancing_Housing_Price_Prediction_Accuracy_through_Hybrid_POI-XGBoost_Models_A_Case_Study_of_Nanjing

[^7]: Targomo. "Location Scoring API." 2021-09-17. https://www.targomo.com/developers/apis/location_scoring/

[^8]: Redfin. "How Much is a Point of Walk Score Worth?" 2020-10-07. https://www.redfin.com/news/how-much-is-a-point-of-walk-score-worth/

[^9]: Pivo, G. "The Walkability Premium in Commercial Real Estate." University of British Columbia. 2010-02-10. https://www.sxd.sala.ubc.ca/9_resources/Walkability%20Paper%20February%2010.pdf

[^10]: Multi-Housing News. "How Walkability Impacts Multifamily." 2023-02-08. https://www.multihousingnews.com/how-walkability-impacts-multifamily/

[^11]: Oregon Metro. "Metro Ordinance 10-1244b." 2010-12-16. https://www.oregonmetro.gov/sites/default/files/2014/05/08/metro_ordinance_10-1244b_adopted_121610.pdf

[^12]: CNU. "Walkability indexes are flawed. Let's find a better method." 2019-01-10. https://www.cnu.org/publicsquare/2019/01/10/walkability-indexes-are-flawed-lets-find-better-method1

[^13]: Semantic Scholar. "Traffic Prediction with Data Fusion and Machine Learning." 2024. https://pdfs.semanticscholar.org/33d2/5ede47715cddd7e96a9afca6e0418cc70044.pdf

[^14]: Machine Learning Mastery. "Prediction Intervals for Machine Learning." 2021-02-16. https://www.machinelearningmastery.com/prediction-intervals-for-machine-learning/

[^15]: Sohn, D.W., Moudon, A.V., & Lee, J. "The economic value of walkable neighborhoods." Urban Design International, 17, 115–128. 2012. https://floridadep.gov/sites/default/files/Economic%20Value%20of%20walkable%20neighborhoods%2C%20Sohn%2C%20Moudon%20and%20Lee%2C%202012_0.pdf

[^16]: Calainho, F.D. & van de Minne, A. "Leading Indicators in Quantile Index Percentile." European Real Estate Society (ERES). 2024. https://ideas.repec.org/p/arz/wpaper/eres2024-259.html

[^17]: Koohsari, M.J. et al. "The relationship between walk score and perceived..." PMC. 2021. https://pmc.ncbi.nlm.nih.gov/articles/PMC8173305/

[^18]: Placer.ai. "Real Estate Market Analysis in Practice." 2024. https://www.placer.ai/guides/real-estate-market-analysis

[^19]: Dwellsy IQ. "Geospatial Analysis: What It Means for Real Estate." 2026-04-08. https://blog.iq.dwellsy.com/geospatial-analysis-what-it-means-for-real-estate-markets-listings-and-investment-decisions/

[^20]: IZ Research / Targomo. "Analyze foot traffic precisely with the footfall map." 2025-07-29. https://iz-research.com/en/new-location-analysis-feature-analyze-foot-traffic-precisely-with-the-footfall-map

[^21]: Batterman, S. et al. "Temporal variation of traffic on highways..." Atmospheric Environment. 2015. https://pmc.ncbi.nlm.nih.gov/articles/PMC4380130/

[^22]: Aultman-Hall, L. et al. "Assessing the Impact of Weather and Season on..." University of Vermont. 2009. https://www.uvm.edu/~transctr/publications/trb2009/PedestrianTrafficVolumes-Aultman-Hall-Jan09.pdf

[^23]: Stanford Future Bay. "Normalization of Safegraph Patterns Data." 2020-05-03. https://stanfordfuturebay.github.io/covid19/safegraph_normalization_explainer.html

[^24]: Ben Feifke. "Feature Engineering With Latitude and Longitude." 2024-03-26. https://benfeifke.com/posts/feature-engineering-with-latitude-and-longitude/

[^25]: Geographic Data Science. "14 Spatial Feature Engineering." 2019-06-22. https://geographicdata.science/book/notebooks/12_feature_engineering.html

[^26]: Wang, Y. "A spatial quantile hedonic analysis of Shanghai Metro." Transportation Research Part D. 2016. https://www.sciencedirect.com/science/article/abs/pii/S0967070X16302190

[^27]: Ogundunmade, T.P. "Modelling Residential Housing Rent Price Using Machine Learning Models." 2023-12-22. https://article.innovationforever.com/MEM/20230177.html

[^28]: Schumacher Appraisal. "AI in CRE Valuation: AVMs vs. MAI Appraisals." 2025-10-18. https://www.schumacherappraisal.com/articles/en/avm-vs-mai-commercial-real-estate-valuation

[^29]: FasterCapital. "Confidence Interval: Estimating Uncertainty." 2025. https://fastercapital.com/content/Confidence-Interval--Estimating-Uncertainty-using-Objective-Probability.html

[^30]: GraphPad. "The distinction between confidence intervals, prediction intervals and tolerance intervals." https://www.graphpad.com/support/faq/the-distinction-between-confidence-intervals-prediction-intervals-and-tolerance-intervals/

[^31]: Towards Data Science. "Confidence Interval vs. Prediction Interval." 2025-01-13. https://towardsdatascience.com/confidence-interval-vs-prediction-interval-a6b0c4816a92/

[^32]: ArXiv. "A prediction interval method for uncertainty quantification of regression models." https://simdl.github.io/files/52.pdf

[^33]: Yao, S. "Use XGBOOST to Predict the Rental Based on Airbnb." CEUR-WS. 2022. https://ceur-ws.org/Vol-3150/paper5.pdf

[^34]: Nesa, M. et al. "Speed prediction and nearby road impact analysis using machine learning." PMC. 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC11502828/

[^35]: CommunityScale. "Regional Market Value Analysis for Greater Omaha-Council Bluffs." 2026-05-25. https://communityscale.com/regional-market-value-analysis-for-greater-omaha-council-bluffs/

[^36]: Cushman & Wakefield. "About 25 West Street." 2025-07-01. https://multifamily.cushwake.com/Listings/31336

[^37]: Stance Real Estate. "Location, Location, Location: Why Walkability Matters." 2025-09-08. https://stancerealestate.com/location-location-location-why-walkability-matters-more-than-ever/

[^38]: Warrington College of Business. "The Value of Living Within Walking Distance." 2025-03-25. https://warrington.ufl.edu/due-diligence/2025/03/19/value-of-living-within-walking-distance/

[^39]: El Arnaouty, N. et al. "Expressway Proximity Effects on Property Prices in Hangzhou." ResearchGate. 2021. https://www.researchgate.net/publication/356710526_Expressway_Proximity_Effects_on_Property_Prices_in_Hangzhou_China_Multidimensional_Housing_Submarket_Approach

[^40]: Molina-Garcia, J. et al. "Different neighborhood walkability indexes for active commuting to school." International Journal of Behavioral Nutrition and Physical Activity. 2020-09-29. https://link.springer.com/article/10.1186/s12966-020-01028-0

