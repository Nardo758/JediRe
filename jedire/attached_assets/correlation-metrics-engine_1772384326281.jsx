import { useState } from "react";

// ════════════════════════════════════════════════════════════════
// PART 1: THE COMPLETE METRICS CATALOG
// Every measurable output the platform generates, organized by source
// ════════════════════════════════════════════════════════════════

const METRICS_CATALOG = [
  {
    category: "TRAFFIC — Physical",
    color: "#60a5fa",
    icon: "🚗",
    source: "FDOT + Google Routes (M07 Layer 1 & 2)",
    update_freq: "Monthly (AADT), Daily (Google)",
    metrics: [
      {
        id: "T_AADT",
        name: "AADT (Annual Average Daily Traffic)",
        formula: "FDOT published count per station",
        unit: "vehicles/day",
        granularity: "Station (nearest to property)",
        example: "24,500 vpd",
        notes: "The baseline. Published annually, interpolated monthly from continuous count stations.",
      },
      {
        id: "T_AADT_YOY",
        name: "AADT Year-over-Year Growth",
        formula: "(AADT_current - AADT_prior) / AADT_prior",
        unit: "%",
        granularity: "Station",
        example: "+4.2%",
        notes: "Physical demand confirmation. Lagging indicator — takes 6-12 months to reflect real changes.",
      },
      {
        id: "T_EFFECTIVE_ADT",
        name: "Effective ADT (Property-Level)",
        formula: "AADT × distance_decay × road_class_weight × frontage_factor",
        unit: "vehicles/day",
        granularity: "Property",
        example: "22,918 vpd",
        notes: "What the PROPERTY actually captures from the road. Adjusted for distance, road type, visibility.",
      },
      {
        id: "T_CONGESTION_RATIO",
        name: "Traffic Surge Index",
        formula: "(google_realtime_traffic - DOT_baseline) / DOT_baseline",
        unit: "ratio (-1 to +∞)",
        granularity: "Road segment, hourly",
        example: "+0.35 (35% above baseline)",
        notes: "YOUR formula. Positive = more traffic than DOT baseline predicts. Negative = less. This is the REAL-TIME demand pulse. When this stays elevated for weeks, the market is growing beyond what historical data captured.",
      },
      {
        id: "T_WALKINS",
        name: "Predicted Weekly Walk-Ins (T-01)",
        formula: "Σ(hourly_adt × visibility × seeker_pct × stop_prob × seasonal × dow)",
        unit: "walk-ins/week",
        granularity: "Property",
        example: "16.7/week",
        notes: "The conversion of all traffic data into an actual expected foot traffic number for leasing.",
      },
      {
        id: "T_PHYSICAL_SCORE",
        name: "Physical Traffic Score (T-02)",
        formula: "normalize(effective_adt, submarket_pctl) × 0.6 + normalize(walkins, submarket_pctl) × 0.4",
        unit: "0-100 score",
        granularity: "Property",
        example: "76",
        notes: "Relative score within submarket. The Y-axis of the T-04 Correlation Matrix.",
      },
    ],
  },
  {
    category: "TRAFFIC — Digital",
    color: "#f59e0b",
    icon: "🔍",
    source: "SpyFu API + Google Trends (M07 Layer 3)",
    update_freq: "Monthly (SpyFu), Weekly (Trends)",
    metrics: [
      {
        id: "D_SEARCH_VOL",
        name: "Keyword Search Volume",
        formula: "SpyFu getKeywordInfo(keyword).searchVolume",
        unit: "searches/month",
        granularity: "Keyword (market-level)",
        example: "8,400/mo for 'apartments port st lucie'",
        notes: "Raw demand signal. People searching = people intending to move.",
      },
      {
        id: "D_SEARCH_MOMENTUM",
        name: "Search Momentum (QoQ)",
        formula: "(current_quarter_vol / prior_quarter_vol) - 1",
        unit: "%",
        granularity: "Keyword/Market",
        example: "+35.5% QoQ",
        notes: "The RATE of change in search demand. Leading indicator — digital leads physical by 2-6 months.",
      },
      {
        id: "D_ORGANIC_CLICKS",
        name: "Property Organic Traffic",
        formula: "SpyFu getLatestDomainStats(domain).monthlyOrganicClicks",
        unit: "clicks/month",
        granularity: "Property domain",
        example: "2,340 clicks/mo",
        notes: "How many people are actually clicking through to this property's website from search.",
      },
      {
        id: "D_DIGITAL_SHARE",
        name: "Digital Traffic Share",
        formula: "property_organic_clicks / Σ(submarket_property_clicks)",
        unit: "% of submarket",
        granularity: "Property within submarket",
        example: "8.2% of submarket digital traffic",
        notes: "Market share of digital attention. Rising = capturing demand. Falling = losing to competitors.",
      },
      {
        id: "D_DIGITAL_SCORE",
        name: "Digital Traffic Score (T-03)",
        formula: "normalize(organic_clicks, submarket_pctl) × 0.4 + search_momentum_norm × 0.3 + digital_share_norm × 0.3",
        unit: "0-100 score",
        granularity: "Property",
        example: "68",
        notes: "X-axis of T-04 Correlation Matrix. Combines volume, momentum, and competitive share.",
      },
      {
        id: "D_OUT_OF_STATE",
        name: "Out-of-State Search Ratio",
        formula: "google_trends_interest_by_region(keyword) → out_of_state / total",
        unit: "%",
        granularity: "Market",
        example: "38% from NY/NJ/CT",
        notes: "Migration demand signal. Higher = inbound migration pipeline active.",
      },
      {
        id: "D_TRENDS_INDEX",
        name: "Google Trends Interest Index",
        formula: "google_trends.interest_over_time(keyword, geo, timeframe)",
        unit: "0-100 relative index",
        granularity: "Market/DMA",
        example: "72 (relative to peak)",
        notes: "Free. Weekly resolution. Best for market-level demand comparison across geographies.",
      },
    ],
  },
  {
    category: "TRAFFIC — Composite",
    color: "#a855f7",
    icon: "⚡",
    source: "M07 Fusion Engine (Layers 1+2+3 combined)",
    update_freq: "Monthly composite",
    metrics: [
      {
        id: "C_TRAJECTORY",
        name: "Traffic Trajectory (T-07)",
        formula: "digital_momentum × 0.5 + aadt_yoy × 0.3 + seasonal_deviation × 0.2",
        unit: "% composite",
        granularity: "Property",
        example: "+19.1% → DEMAND SURGE",
        notes: "The forward-looking trend. Combines digital leading indicator with physical confirmation.",
      },
      {
        id: "C_SURGE_INDEX",
        name: "Traffic Surge Index",
        formula: "(google_realtime - DOT_baseline) / DOT_baseline",
        unit: "ratio",
        granularity: "Road segment",
        example: "+0.35",
        notes: "Real-time divergence between what's happening NOW vs what history says should happen. Sustained positive = growth. Leon's core formula.",
      },
      {
        id: "C_DIGITAL_PHYSICAL_GAP",
        name: "Digital-Physical Divergence",
        formula: "D_SEARCH_MOMENTUM - T_AADT_YOY",
        unit: "percentage points",
        granularity: "Market/Submarket",
        example: "+31.3pp (digital +35.5%, physical +4.2%)",
        notes: "THE key leading indicator. When digital surges ahead of physical, demand is building but hasn't manifested yet. Buy window.",
      },
      {
        id: "C_TPI",
        name: "Traffic Position Index",
        formula: "(property_adt / submarket_avg) × 0.5 + (digital_share / equal_share) × 0.5",
        unit: "index (1.0 = average)",
        granularity: "Property",
        example: "1.34 (34% above average position)",
        notes: "Combined physical+digital competitive position. >1.0 = above average. Feeds JEDI Score Position sub-score.",
      },
      {
        id: "C_TVS",
        name: "Traffic Velocity Score",
        formula: "(TPI_current - TPI_3mo_ago) / TPI_3mo_ago",
        unit: "%",
        granularity: "Property",
        example: "+8.2% (gaining position)",
        notes: "Rate of change in competitive position. Positive = gaining share. Negative = losing ground.",
      },
    ],
  },
  {
    category: "FINANCIAL — Rent & Revenue",
    color: "#22c55e",
    icon: "💰",
    source: "CoStar / Apartments.com / RentCast (M05)",
    update_freq: "Monthly",
    metrics: [
      {
        id: "F_EFF_RENT",
        name: "Effective Rent (avg per unit)",
        formula: "asking_rent - concessions_amortized",
        unit: "$/unit/month",
        granularity: "Property",
        example: "$1,825/mo",
        notes: "What tenants actually pay after concessions. The real pricing signal.",
      },
      {
        id: "F_RENT_GROWTH",
        name: "Rent Growth (YoY)",
        formula: "(rent_current - rent_12mo_ago) / rent_12mo_ago",
        unit: "%",
        granularity: "Property or Submarket",
        example: "+3.2% YoY",
        notes: "The core financial outcome metric. Everything else (traffic, wages, supply) is trying to predict THIS.",
      },
      {
        id: "F_RENT_PSF",
        name: "Rent per Square Foot",
        formula: "monthly_rent / unit_sqft",
        unit: "$/SF/month",
        granularity: "Property or Unit type",
        example: "$1.82/SF",
        notes: "Normalizes across different unit sizes. Better for cross-property comparison than gross rent.",
      },
      {
        id: "F_RENT_PREMIUM",
        name: "Rent Premium/Discount vs Submarket",
        formula: "(property_rent - submarket_avg_rent) / submarket_avg_rent",
        unit: "%",
        granularity: "Property",
        example: "+1.4% premium",
        notes: "Positions this property against the market. Premium should be justified by quality/location.",
      },
      {
        id: "F_REVPAU",
        name: "Revenue per Available Unit (RevPAU)",
        formula: "total_revenue / total_units (includes vacant units)",
        unit: "$/unit/month",
        granularity: "Property",
        example: "$1,719/unit",
        notes: "Like RevPAR in hotels. Captures both rent level AND occupancy in one number.",
      },
      {
        id: "F_CONCESSION_RATE",
        name: "Concession Intensity",
        formula: "total_concessions / potential_gross_revenue",
        unit: "%",
        granularity: "Property or Submarket",
        example: "2.8%",
        notes: "Rising concessions = demand softening. Falling = demand strengthening. Leading indicator for rent growth direction.",
      },
      {
        id: "F_NOI",
        name: "Net Operating Income",
        formula: "EGI - OpEx",
        unit: "$/year",
        granularity: "Property",
        example: "$2.7M/year",
        notes: "The bottom line for property performance before debt service.",
      },
      {
        id: "F_NOI_MARGIN",
        name: "NOI Margin",
        formula: "NOI / EGI",
        unit: "%",
        granularity: "Property",
        example: "62%",
        notes: "Operational efficiency. Higher = better expense management. Comparable across property sizes.",
      },
      {
        id: "F_CAP_RATE",
        name: "Market Cap Rate",
        formula: "NOI / sale_price (from recent transactions)",
        unit: "%",
        granularity: "Submarket / Property class",
        example: "5.4%",
        notes: "Compressing cap rates = rising values. Expanding = falling values. Market sentiment indicator.",
      },
      {
        id: "F_PRICE_PER_UNIT",
        name: "Price per Unit (from transactions)",
        formula: "sale_price / total_units (from deed recordings)",
        unit: "$/unit",
        granularity: "Submarket",
        example: "$185,000/unit",
        notes: "Actual transaction prices from documentary stamps. More reliable than asking prices.",
      },
    ],
  },
  {
    category: "OCCUPANCY & DEMAND",
    color: "#14b8a6",
    icon: "🏠",
    source: "Apartments.com scraper + Property actuals (M05 + M22)",
    update_freq: "Monthly",
    metrics: [
      {
        id: "O_PHYSICAL_OCC",
        name: "Physical Occupancy",
        formula: "occupied_units / total_units",
        unit: "%",
        granularity: "Property or Submarket",
        example: "94.2%",
        notes: "Bodies in beds. Standard occupancy metric.",
      },
      {
        id: "O_ECONOMIC_OCC",
        name: "Economic Occupancy",
        formula: "actual_revenue / potential_gross_revenue",
        unit: "%",
        granularity: "Property",
        example: "91.8%",
        notes: "Accounts for concessions, bad debt, vacancy loss. Always lower than physical. The real money metric.",
      },
      {
        id: "O_VACANCY_RATE",
        name: "Vacancy Rate",
        formula: "1 - physical_occupancy",
        unit: "%",
        granularity: "Submarket",
        example: "5.8%",
        notes: "Inverse of occupancy. Below 5% = supply-constrained. Above 8% = oversupplied.",
      },
      {
        id: "O_ABSORPTION",
        name: "Net Absorption",
        formula: "units_occupied_end - units_occupied_start (per quarter)",
        unit: "units/quarter",
        granularity: "Submarket",
        example: "255 units/quarter",
        notes: "How fast the market eats new supply. Positive = demand > supply. Negative = trouble.",
      },
      {
        id: "O_ABSORPTION_RATE",
        name: "Absorption Rate",
        formula: "net_absorption / total_inventory",
        unit: "%/quarter",
        granularity: "Submarket",
        example: "2.1%/quarter",
        notes: "Normalized for market size. Comparable across submarkets of different scales.",
      },
      {
        id: "O_LEASE_VELOCITY",
        name: "Lease Velocity",
        formula: "new_leases_signed / available_units per month",
        unit: "%/month",
        granularity: "Property",
        example: "12%/month (all available units lease within ~8 months)",
        notes: "How fast vacant units fill. Higher = stronger demand. Below 5%/mo = slow leasing.",
      },
      {
        id: "O_MONTHS_SUPPLY",
        name: "Months of Supply",
        formula: "pipeline_units / monthly_absorption",
        unit: "months",
        granularity: "Submarket",
        example: "14.1 months",
        notes: "How long for the market to absorb all planned supply. <12 = healthy. >24 = oversupply risk.",
      },
    ],
  },
  {
    category: "ECONOMIC — Wages & Employment",
    color: "#ec4899",
    icon: "💼",
    source: "BLS QCEW + Census + IRS (M06)",
    update_freq: "Quarterly (QCEW), Annual (Census/IRS)",
    metrics: [
      {
        id: "E_WAGE_GROWTH",
        name: "Average Wage Growth (YoY)",
        formula: "BLS QCEW: (avg_weekly_wage_current / avg_weekly_wage_prior) - 1",
        unit: "%",
        granularity: "County / MSA",
        example: "+4.2% YoY",
        notes: "Income growth sets the ceiling for rent growth. Wages > Rent = runway. Rent > Wages = ceiling.",
      },
      {
        id: "E_MEDIAN_HH_INCOME",
        name: "Median Household Income",
        formula: "Census ACS 5-year estimate",
        unit: "$/year",
        granularity: "Census tract / Zip",
        example: "$68,400",
        notes: "The denominator for affordability ratios. Updated annually.",
      },
      {
        id: "E_RENT_TO_INCOME",
        name: "Rent-to-Income Ratio",
        formula: "(avg_rent × 12) / median_household_income",
        unit: "%",
        granularity: "Submarket",
        example: "32%",
        notes: "THE affordability metric. >30% = burdened. >35% = severely burdened. Approaching ceiling.",
      },
      {
        id: "E_JOB_GROWTH",
        name: "Employment Growth (YoY)",
        formula: "BLS: (employment_current - employment_prior) / employment_prior",
        unit: "%",
        granularity: "County / MSA",
        example: "+2.8% YoY",
        notes: "More jobs = more renters. The fundamental demand driver.",
      },
      {
        id: "E_BIZ_FORMATIONS",
        name: "New Business Formations",
        formula: "Census BFS: monthly new entity applications",
        unit: "entities/month",
        granularity: "County",
        example: "342 new entities/month",
        notes: "Leading indicator for employment. New businesses → future hiring → future renter demand.",
      },
      {
        id: "E_BIZ_FORMATION_VELOCITY",
        name: "Business Formation Velocity",
        formula: "(formations_current_qtr / formations_prior_qtr) - 1",
        unit: "%",
        granularity: "County",
        example: "+18% QoQ",
        notes: "Rate of acceleration in new business activity. Spikes = emerging employment center.",
      },
      {
        id: "E_POP_GROWTH",
        name: "Population Growth (YoY)",
        formula: "Census: (pop_current / pop_prior) - 1",
        unit: "%",
        granularity: "County / Zip",
        example: "+2.1% YoY",
        notes: "Fundamental demand. Florida submarkets seeing 2-4% growth vs national avg ~0.5%.",
      },
      {
        id: "E_NET_MIGRATION",
        name: "Net Migration (IRS data)",
        formula: "IRS SOI: inflows - outflows (by AGI bracket)",
        unit: "households/year",
        granularity: "County",
        example: "+3,200 households/year",
        notes: "IRS data shows where people are moving FROM and what income bracket. Gold for demand segmentation.",
      },
    ],
  },
  {
    category: "SUPPLY PIPELINE",
    color: "#f97316",
    icon: "🏗️",
    source: "Permits + CoStar + County Records (M04)",
    update_freq: "Monthly",
    metrics: [
      {
        id: "S_PIPELINE_UNITS",
        name: "Pipeline Units (Under Construction + Permitted)",
        formula: "COUNT(units WHERE status IN ('under_construction', 'permitted'))",
        unit: "units",
        granularity: "Submarket / Trade Area",
        example: "1,200 units in pipeline",
        notes: "The total supply threat. Includes everything from recently permitted to nearly delivered.",
      },
      {
        id: "S_PIPELINE_PCT",
        name: "Pipeline as % of Existing",
        formula: "pipeline_units / existing_inventory",
        unit: "%",
        granularity: "Submarket",
        example: "8.4%",
        notes: "Normalized supply pressure. >10% = significant new supply. >15% = potential oversupply.",
      },
      {
        id: "S_PERMITS_MONTHLY",
        name: "Monthly Permit Filings",
        formula: "COUNT(new_permits) per month",
        unit: "permits/month",
        granularity: "County / Submarket",
        example: "12 permits/month",
        notes: "Leading supply indicator. Rising permits = more supply 18-24 months out.",
      },
      {
        id: "S_PERMIT_VELOCITY",
        name: "Permit Velocity (YoY)",
        formula: "(permits_12mo - permits_prior_12mo) / permits_prior_12mo",
        unit: "%",
        granularity: "County",
        example: "+22% YoY",
        notes: "Acceleration of supply pipeline. Sustained high velocity = supply wave incoming.",
      },
      {
        id: "S_DELIVERIES",
        name: "Quarterly Deliveries",
        formula: "COUNT(units WHERE status = 'delivered') per quarter",
        unit: "units/quarter",
        granularity: "Submarket",
        example: "380 units delivered Q1",
        notes: "When supply actually hits the market. The real absorption test.",
      },
      {
        id: "S_LAND_PRICE_PER_UNIT",
        name: "Land Price per Buildable Unit",
        formula: "land_sale_price / (zoned_density × acreage)",
        unit: "$/unit",
        granularity: "Submarket",
        example: "$52,000/buildable unit",
        notes: "When land trades above $40K/unit buildable, developers are pricing in multifamily. Leading supply signal.",
      },
    ],
  },
  {
    category: "QUALITY & SENTIMENT",
    color: "#8b5cf6",
    icon: "⭐",
    source: "Google Places API + Apartments.com + NLP (S4)",
    update_freq: "Weekly",
    metrics: [
      {
        id: "Q_GOOGLE_RATING",
        name: "Google Rating",
        formula: "Google Places API rating field",
        unit: "1.0 - 5.0 stars",
        granularity: "Property",
        example: "4.2 stars",
        notes: "The public quality signal. Below 3.5 = operational problems. Above 4.3 = well-managed.",
      },
      {
        id: "Q_REVIEW_VOLUME",
        name: "Review Volume (12mo)",
        formula: "COUNT(reviews WHERE date > 12_months_ago)",
        unit: "reviews",
        granularity: "Property",
        example: "47 reviews in 12mo",
        notes: "Engagement level. High volume + high rating = strong brand. High volume + low rating = known problem.",
      },
      {
        id: "Q_SENTIMENT_SCORE",
        name: "NLP Sentiment Score",
        formula: "avg(sentiment_classification(review_text)) per category",
        unit: "-1.0 to +1.0",
        granularity: "Property × category",
        example: "Maintenance: -0.4, Location: +0.8, Management: +0.2",
        notes: "Breaks the blunt star rating into specific actionable categories.",
      },
      {
        id: "Q_SENTIMENT_DELTA",
        name: "Sentiment Trend (6mo change)",
        formula: "avg_sentiment_recent_6mo - avg_sentiment_prior_6mo",
        unit: "delta (-2 to +2)",
        granularity: "Property",
        example: "+0.3 (improving)",
        notes: "Direction matters more than absolute. Improving = new management doing value-add. Declining = neglect.",
      },
    ],
  },
];


// ════════════════════════════════════════════════════════════════
// PART 2: THE CORRELATION PAIRINGS
// Every meaningful X vs Y with expected relationship & lead/lag
// ════════════════════════════════════════════════════════════════

const CORRELATION_PAIRINGS = [
  {
    tier: "TIER 1 — THE MONEY CORRELATIONS",
    description: "These directly predict or explain rent growth and property value. Build these first.",
    color: "#22c55e",
    pairings: [
      {
        id: "COR-01",
        x: { id: "C_SURGE_INDEX", label: "Traffic Surge Index" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "(google_realtime - DOT_baseline) / DOT_baseline",
        formula_y: "(rent_now - rent_12mo_ago) / rent_12mo_ago",
        relationship: "POSITIVE",
        expected_r: "0.55-0.75",
        lead_lag: "Traffic Surge LEADS rent growth by 3-6 months",
        hypothesis: "When real-time traffic consistently exceeds the DOT baseline, more people are in the area than historical patterns predict. This physical demand pressure translates to occupancy → pricing power → rent growth within 3-6 months.",
        chart_type: "Scatter with time-lagged regression line",
        action: "Sustained Surge Index > +0.20 for 8+ weeks → rent growth acceleration likely in next 2 quarters. Push to ProForma as upside scenario.",
        priority: "P0",
      },
      {
        id: "COR-02",
        x: { id: "D_SEARCH_MOMENTUM", label: "Search Momentum (QoQ)" },
        y: { id: "T_AADT_YOY", label: "AADT Growth (YoY)" },
        formula_x: "(search_vol_Q / search_vol_Q-1) - 1",
        formula_y: "(AADT_year / AADT_prior_year) - 1",
        relationship: "POSITIVE",
        expected_r: "0.60-0.80",
        lead_lag: "Search Momentum LEADS AADT growth by 2-6 months",
        hypothesis: "People search online before they drive. Search volume spikes precede physical traffic increases because the digital funnel (search → research → visit → sign lease) takes 2-6 months to complete.",
        chart_type: "Dual-axis time series with lag overlay",
        action: "Search momentum >+25% QoQ with AADT flat = DEMAND SURGE pattern. This is the buy window — you're purchasing at physical-traffic prices before physical catches up.",
        priority: "P0",
      },
      {
        id: "COR-03",
        x: { id: "D_SEARCH_MOMENTUM", label: "Search Momentum (QoQ)" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "(search_vol_Q / search_vol_Q-1) - 1",
        formula_y: "(rent_now - rent_12mo_ago) / rent_12mo_ago",
        relationship: "POSITIVE",
        expected_r: "0.50-0.70",
        lead_lag: "Search Momentum LEADS rent growth by 4-8 months",
        hypothesis: "Digital search is the earliest demand signal. Search → visit → apply → lease → rent reflected. The full chain from digital intent to financial outcome takes 4-8 months.",
        chart_type: "Scatter with 6-month lag, size = market volume",
        action: "The longest lead time of any correlation. If search momentum is surging NOW, rent growth acceleration is coming by Q3-Q4. Underwrite with conviction.",
        priority: "P0",
      },
      {
        id: "COR-04",
        x: { id: "E_WAGE_GROWTH", label: "Wage Growth (YoY)" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "BLS QCEW wage_growth_yoy",
        formula_y: "(rent_now - rent_12mo_ago) / rent_12mo_ago",
        relationship: "POSITIVE (with ceiling)",
        expected_r: "0.65-0.80",
        lead_lag: "Roughly concurrent, wages slightly leading",
        hypothesis: "Wages set the CEILING for sustainable rent growth. Rents can temporarily outrun wages (cycle peaks), but always mean-revert. When wages grow faster than rents, there's runway. When rents grow faster, there's risk.",
        chart_type: "Dual line time series + gap shading (green = wage>rent, red = rent>wage)",
        action: "Wage growth > rent growth × 1.3 for 2+ quarters → BULLISH, rent runway exists. Rent growth > wage growth × 1.5 for 3+ quarters → CAUTION, affordability ceiling approaching.",
        priority: "P0",
      },
      {
        id: "COR-05",
        x: { id: "C_SURGE_INDEX", label: "Traffic Surge Index" },
        y: { id: "O_VACANCY_RATE", label: "Vacancy Rate" },
        formula_x: "(google_realtime - DOT_baseline) / DOT_baseline",
        formula_y: "vacant_units / total_units",
        relationship: "NEGATIVE",
        expected_r: "-0.50 to -0.70",
        lead_lag: "Traffic Surge LEADS vacancy drop by 2-4 months",
        hypothesis: "More traffic = more potential renters = units fill faster = vacancy drops. The surge shows up in traffic data before it shows up in occupancy reports because there's a leasing lag (visit → apply → move-in = 30-60 days).",
        chart_type: "Dual-axis time series (left = surge, right inverted = vacancy)",
        action: "Sustained positive surge + still-elevated vacancy = OPPORTUNITY — demand is arriving but hasn't fully converted. Properties with traffic but vacancy have a conversion problem (management, pricing, condition), not a demand problem.",
        priority: "P0",
      },
    ],
  },
  {
    tier: "TIER 2 — SUPPLY-DEMAND EQUILIBRIUM",
    description: "How supply pipeline interacts with demand signals and financial outcomes.",
    color: "#3b82f6",
    pairings: [
      {
        id: "COR-06",
        x: { id: "S_PIPELINE_PCT", label: "Pipeline as % of Existing" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "pipeline_units / existing_inventory",
        formula_y: "(rent_now - rent_12mo_ago) / rent_12mo_ago",
        relationship: "NEGATIVE (above threshold)",
        expected_r: "-0.40 to -0.65",
        lead_lag: "Pipeline leads rent deceleration by 6-18 months (long lag)",
        hypothesis: "Large supply pipelines suppress rent growth — but only when supply exceeds absorption capacity. Below ~8% pipeline, minimal impact. Above 12%, rent growth noticeably decelerates. Above 18%, rents may decline.",
        chart_type: "Scatter with threshold bands + moving average trend",
        action: "Pipeline >12% AND absorption rate declining → stress test rent growth assumptions by -100bps. Pipeline <6% AND demand signals positive → increase rent growth assumptions by +50bps.",
        priority: "P0",
      },
      {
        id: "COR-07",
        x: { id: "O_ABSORPTION_RATE", label: "Absorption Rate (%/qtr)" },
        y: { id: "S_PIPELINE_PCT", label: "Pipeline % of Existing" },
        formula_x: "net_absorption / total_inventory per quarter",
        formula_y: "pipeline_units / existing_inventory",
        relationship: "REVEALS EQUILIBRIUM",
        expected_r: "n/a — ratio analysis, not correlation",
        lead_lag: "Concurrent — measures current balance",
        hypothesis: "This isn't a correlation — it's an EQUILIBRIUM CHECK. When absorption rate × projected quarters > pipeline units, the market can absorb the supply. When it can't, oversupply develops. The ratio of pipeline/absorption = months of supply.",
        chart_type: "Stacked area chart: cumulative absorption trajectory vs delivery schedule",
        action: "Months of supply <12: healthy. 12-18: watch. 18-24: caution. >24: oversupply. Overlay with Traffic Surge Index — if demand is accelerating (surge positive), months of supply effectively compresses.",
        priority: "P0",
      },
      {
        id: "COR-08",
        x: { id: "S_PERMIT_VELOCITY", label: "Permit Velocity (YoY)" },
        y: { id: "F_CAP_RATE", label: "Market Cap Rate" },
        formula_x: "(permits_12mo / permits_prior_12mo) - 1",
        formula_y: "NOI / sale_price from transactions",
        relationship: "POSITIVE (with long lag)",
        expected_r: "0.30-0.50",
        lead_lag: "Permit acceleration leads cap rate expansion by 18-30 months",
        hypothesis: "Rising permit activity signals future supply → future competition → future rent pressure → investors demand higher returns (cap rates expand). The lag is long because permits → construction → delivery takes 18-30 months.",
        chart_type: "Dual-axis time series with 24-month lag offset",
        action: "Permit velocity >+30% sustained for 12+ months → flag cap rate expansion risk in exit assumptions. Don't underwrite exits at current compressed cap rates if the supply wave is building.",
        priority: "P1",
      },
      {
        id: "COR-09",
        x: { id: "S_DELIVERIES", label: "Quarterly Deliveries" },
        y: { id: "F_CONCESSION_RATE", label: "Concession Intensity" },
        formula_x: "units delivered this quarter",
        formula_y: "total_concessions / potential_gross_revenue",
        relationship: "POSITIVE",
        expected_r: "0.55-0.70",
        lead_lag: "Deliveries lead concession increases by 1-3 months",
        hypothesis: "When new supply delivers, it competes for tenants with concessions (free month, reduced deposit). Existing properties respond with their own concessions. The concession wave follows delivery wave almost immediately.",
        chart_type: "Bar (deliveries) + line (concessions) dual-axis",
        action: "Major delivery quarter approaching → expect concession intensity to spike 5-15% in trade area. Factor into NOI projections. Properties with stronger traffic position (higher TPI) need fewer concessions to compete.",
        priority: "P1",
      },
    ],
  },
  {
    tier: "TIER 3 — PREDICTIVE & ECONOMIC",
    description: "Economic fundamentals that predict traffic and rent trajectories.",
    color: "#f59e0b",
    pairings: [
      {
        id: "COR-10",
        x: { id: "E_BIZ_FORMATION_VELOCITY", label: "Business Formation Velocity" },
        y: { id: "D_SEARCH_MOMENTUM", label: "Search Momentum (QoQ)" },
        formula_x: "(formations_Q / formations_Q-1) - 1",
        formula_y: "(search_vol_Q / search_vol_Q-1) - 1",
        relationship: "POSITIVE",
        expected_r: "0.40-0.60",
        lead_lag: "Business formations LEAD search momentum by 3-6 months",
        hypothesis: "New businesses form → they hire → new employees need housing → apartment searches increase. Business formation is the EARLIEST signal in the demand chain. By the time you see search momentum, the business formation spike happened months ago.",
        chart_type: "Scatter with 4-month lag + confidence band",
        action: "Business formation velocity >+15% QoQ → expect search momentum surge 3-6 months out. This is the longest-lead acquisition signal on the platform. Start underwriting before the search data confirms.",
        priority: "P1",
      },
      {
        id: "COR-11",
        x: { id: "E_NET_MIGRATION", label: "Net Migration (IRS)" },
        y: { id: "D_OUT_OF_STATE", label: "Out-of-State Search Ratio" },
        formula_x: "IRS SOI inflows - outflows",
        formula_y: "out_of_state_search_interest / total_interest",
        relationship: "POSITIVE",
        expected_r: "0.70-0.85",
        lead_lag: "Out-of-state search LEADS actual migration by 6-12 months",
        hypothesis: "People search for apartments in a new city before they actually move. IRS migration data is 12-18 months delayed. Out-of-state search ratio is real-time. Together they validate the migration pipeline: search intent → actual relocation.",
        chart_type: "Dual-axis with lag overlay + origin state breakdown",
        action: "Out-of-state ratio >35% AND rising → migration wave active. Cross-reference with IRS data to see which income brackets are moving. High-income migration (>$100K AGI) → Class A demand. Working-class → Class B/C demand.",
        priority: "P1",
      },
      {
        id: "COR-12",
        x: { id: "E_JOB_GROWTH", label: "Employment Growth (YoY)" },
        y: { id: "O_ABSORPTION", label: "Net Absorption (qtr)" },
        formula_x: "BLS employment_growth_yoy",
        formula_y: "net units absorbed per quarter",
        relationship: "POSITIVE",
        expected_r: "0.60-0.75",
        lead_lag: "Job growth leads absorption by 3-6 months",
        hypothesis: "Jobs create renters. For every ~2.5-3.0 new jobs, approximately 1 new renter household forms (accounting for ownership, doubling up, out-commuting). Job growth translates to absorption at roughly a 3:1 ratio with a quarter lag.",
        chart_type: "Scatter with regression line + job-to-renter multiplier annotation",
        action: "If job_growth × local_renter_multiplier > pipeline_deliveries for next 4 quarters → demand exceeds supply. Bullish. If inverse → oversupply risk. The multiplier varies by market (higher in Sun Belt, lower in expensive metros).",
        priority: "P1",
      },
      {
        id: "COR-13",
        x: { id: "E_RENT_TO_INCOME", label: "Rent-to-Income Ratio" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "(avg_rent × 12) / median_HH_income",
        formula_y: "(rent_now - rent_12mo_ago) / rent_12mo_ago",
        relationship: "NEGATIVE (above 30%)",
        expected_r: "-0.35 to -0.55 (non-linear)",
        lead_lag: "Concurrent — affordability constrains rent growth in real time",
        hypothesis: "When rent-to-income crosses 30%, rent growth decelerates. When it crosses 35%, rent growth stalls or reverses. This is the CEILING function — it bends the rent growth curve downward regardless of demand signals. Markets can be in demand surplus but still hit an affordability wall.",
        chart_type: "Scatter with non-linear fit + threshold lines at 30% and 35%",
        action: "Rent-to-income approaching 30% → reduce forward rent growth assumptions by 50-100bps per year. Approaching 35% → assume flat rents. Model is non-linear — use logistic curve not linear regression.",
        priority: "P0",
      },
    ],
  },
  {
    tier: "TIER 4 — COMPETITIVE & QUALITY",
    description: "How property-level quality signals correlate with financial outcomes.",
    color: "#8b5cf6",
    pairings: [
      {
        id: "COR-14",
        x: { id: "Q_GOOGLE_RATING", label: "Google Rating (stars)" },
        y: { id: "F_RENT_PREMIUM", label: "Rent Premium vs Submarket" },
        formula_x: "Google Places API rating (1.0-5.0)",
        formula_y: "(property_rent - submarket_avg) / submarket_avg",
        relationship: "POSITIVE",
        expected_r: "0.50-0.70",
        lead_lag: "Concurrent — quality justifies pricing",
        hypothesis: "Better-reviewed properties command higher rents. Each 0.5 star increase above 3.5 corresponds to approximately $50-100/unit in rent premium (varies by market). The relationship is strongest between 3.5-4.5 stars. Below 3.0, there's a penalty floor. Above 4.5, diminishing returns.",
        chart_type: "Scatter with regression + star-tier banding",
        action: "Your property at 3.8 stars charging market rent. Like-kind properties at 4.3 stars charging $125/unit premium. The 0.5 star gap × your unit count = your operational upside in dollars. Feed to Rank-Me tool.",
        priority: "P1",
      },
      {
        id: "COR-15",
        x: { id: "Q_SENTIMENT_DELTA", label: "Review Sentiment Trend" },
        y: { id: "O_LEASE_VELOCITY", label: "Lease Velocity" },
        formula_x: "avg_sentiment_6mo - avg_sentiment_prior_6mo",
        formula_y: "new_leases / available_units per month",
        relationship: "POSITIVE",
        expected_r: "0.40-0.55",
        lead_lag: "Sentiment improvement leads lease velocity by 2-4 months",
        hypothesis: "When a property's reviews improve (new management, completed renovations), prospect confidence increases. People read reviews before touring. Improving sentiment → more tours → faster leasing. The effect takes 2-4 months as new reviews accumulate and prospects notice.",
        chart_type: "Dual-axis time series with sentiment smoothed (30-day MA)",
        action: "Detect sentiment improving >+0.3 in 6 months while rent hasn't changed → the property hasn't repriced yet. Acquisition target or rent increase opportunity.",
        priority: "P1",
      },
      {
        id: "COR-16",
        x: { id: "D_DIGITAL_SHARE", label: "Digital Traffic Share" },
        y: { id: "O_PHYSICAL_OCC", label: "Physical Occupancy" },
        formula_x: "property_organic_clicks / submarket_total_clicks",
        formula_y: "occupied_units / total_units",
        relationship: "POSITIVE",
        expected_r: "0.55-0.70",
        lead_lag: "Digital share leads occupancy by 1-3 months",
        hypothesis: "Properties capturing more digital attention fill units faster. Digital share is the top-of-funnel metric; occupancy is the bottom. The conversion path (click → tour → apply → lease) takes 30-90 days. Falling digital share predicts occupancy softening before it shows up in reports.",
        chart_type: "Scatter with property bubbles sized by unit count",
        action: "Property losing digital share for 2+ months → occupancy decline coming. If you see this in a comp, their units are about to soften. If you see it in your own asset, increase marketing spend immediately.",
        priority: "P1",
      },
      {
        id: "COR-17",
        x: { id: "C_TVS", label: "Traffic Velocity Score" },
        y: { id: "F_REVPAU", label: "Revenue per Available Unit" },
        formula_x: "(TPI_now - TPI_3mo_ago) / TPI_3mo_ago",
        formula_y: "total_revenue / total_units",
        relationship: "POSITIVE",
        expected_r: "0.45-0.60",
        lead_lag: "Traffic velocity leads RevPAU by 3-6 months",
        hypothesis: "Properties gaining traffic position (positive TVS) see their RevPAU increase because more traffic → better occupancy → more pricing power → higher revenue per unit. RevPAU captures the combined effect that neither rent growth nor occupancy shows alone.",
        chart_type: "Scatter with regression + quadrant labels (Gaining+Growing, Losing+Shrinking, etc.)",
        action: "TVS positive AND RevPAU flat → property hasn't repriced yet despite gaining position. Value-add opportunity or incompetent management. TVS negative AND RevPAU declining → property in competitive trouble.",
        priority: "P1",
      },
    ],
  },
  {
    tier: "TIER 5 — ADVANCED / EMERGING",
    description: "Cross-domain correlations that become powerful with enough data history.",
    color: "#ef4444",
    pairings: [
      {
        id: "COR-18",
        x: { id: "E_BIZ_FORMATIONS", label: "Business Formations (by NAICS)" },
        y: { id: "F_RENT_GROWTH", label: "Rent Growth (YoY)" },
        formula_x: "Census BFS monthly formations by NAICS sector",
        formula_y: "rent_growth_yoy",
        relationship: "POSITIVE (sector-dependent)",
        expected_r: "0.35-0.55 (varies by sector)",
        lead_lag: "Formations lead rent growth by 6-12 months",
        hypothesis: "Different industries drive different rent impacts. Healthcare formations → high-income renters → premium rent growth. Warehouse/logistics → working-class renters → affordable segment growth. The NAICS composition of business formations predicts WHICH rent tiers will grow.",
        chart_type: "Multi-line by NAICS sector vs rent growth by property class",
        action: "Healthcare NAICS surging → Class A/B+ positioned for rent growth. Logistics/warehouse NAICS surging → Class B/C positioned. Retail/restaurant declining → service worker renter pool shrinking.",
        priority: "P2",
      },
      {
        id: "COR-19",
        x: { id: "Q_SENTIMENT_SCORE", label: "Sentiment: Maintenance Category" },
        y: { id: "F_NOI_MARGIN", label: "NOI Margin" },
        formula_x: "avg sentiment score for 'maintenance' category reviews",
        formula_y: "NOI / EGI",
        relationship: "POSITIVE",
        expected_r: "0.40-0.55",
        lead_lag: "Concurrent to slight lag (sentiment reflects current operations)",
        hypothesis: "Properties with poor maintenance reviews spend more on reactive maintenance (emergency repairs cost 3-5x preventive), have higher turnover (turn costs $3-5K/unit), and offer more concessions to compensate. All of this crushes NOI margin. Good maintenance sentiment = efficient operations = higher margins.",
        chart_type: "Scatter colored by property class",
        action: "Acquisition target with maintenance sentiment < -0.3 AND NOI margin 5%+ below like-kind benchmark → quantifiable operational upside. New management + preventive maintenance program = margin improvement.",
        priority: "P2",
      },
      {
        id: "COR-20",
        x: { id: "C_DIGITAL_PHYSICAL_GAP", label: "Digital-Physical Divergence" },
        y: { id: "F_PRICE_PER_UNIT", label: "Price per Unit (transactions)" },
        formula_x: "search_momentum - AADT_yoy",
        formula_y: "sale_price / total_units",
        relationship: "POSITIVE with 6-12 month lag",
        expected_r: "0.40-0.60",
        lead_lag: "Divergence leads price/unit appreciation by 6-12 months",
        hypothesis: "When digital demand surges ahead of physical traffic, it signals a market about to reprice. Investors who recognize this signal buy before prices catch up. Transaction prices follow demand signals with a 6-12 month lag as deals close (typical marketing → closing = 4-8 months).",
        chart_type: "Dual-axis: divergence magnitude vs rolling avg price/unit",
        action: "Positive divergence >15pp → market repricing in progress. Properties acquired during divergence window should see appreciation as prices catch up to demand. This is the CORE Strategy Arbitrage signal — buy when digital says yes but physical hasn't caught up.",
        priority: "P1",
      },
      {
        id: "COR-21",
        x: { id: "S_LAND_PRICE_PER_UNIT", label: "Land Price per Buildable Unit" },
        y: { id: "F_CAP_RATE", label: "Market Cap Rate" },
        formula_x: "land_sale_price / (zoned_density × acreage)",
        formula_y: "NOI / sale_price",
        relationship: "NEGATIVE",
        expected_r: "-0.50 to -0.70",
        lead_lag: "Rising land prices confirm cap rate compression (concurrent)",
        hypothesis: "When land trades at higher $/unit buildable, developers are pricing in lower cap rates (higher values) for the finished product. Rising land prices = market consensus that values are going up = cap rates compressing. It's a confirmation signal, not a predictor.",
        chart_type: "Scatter with trend line + 'replacement cost' threshold annotation",
        action: "When land_price_per_unit + construction_cost > existing_price_per_unit, it's cheaper to BUY existing than BUILD new. This ratio defines the BTS vs Acquisition decision in Strategy Arbitrage.",
        priority: "P2",
      },
    ],
  },
];


// ════════════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════════════

function Pill({ children, color = "#64748b" }) {
  return <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color, background: `${color}12`, border: `1px solid ${color}20`, letterSpacing: "0.04em" }}>{children}</span>;
}

function Code({ children, color = "#94a3b8" }) {
  return (
    <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color, background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: 8, overflowX: "auto", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid rgba(255,255,255,0.04)" }}>{children}</pre>
  );
}

function Divider({ label, color = "#475569" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "40px 0 18px" }}>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, ${color}40, transparent)` }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, ${color}40, transparent)` }} />
    </div>
  );
}

export default function CorrelationMetricsEngine() {
  const [activeView, setActiveView] = useState("correlations");
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedPairing, setExpandedPairing] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: "#050810", color: "#e2e8f0", fontFamily: "'DM Sans', -apple-system, sans-serif", padding: "36px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.14em", marginBottom: 6 }}>JEDI RE · PATTERN RECOGNITION ENGINE · ANALYTICAL FOUNDATION</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em", marginBottom: 8 }}>
            Correlation Metrics Engine
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, maxWidth: 900 }}>
            {METRICS_CATALOG.reduce((sum, c) => sum + c.metrics.length, 0)} trackable metrics across {METRICS_CATALOG.length} categories.
            {" "}{CORRELATION_PAIRINGS.reduce((sum, t) => sum + t.pairings.length, 0)} correlation pairings organized into {CORRELATION_PAIRINGS.length} tiers by predictive value.
            Every pairing includes: formula, expected relationship, lead/lag time, chart type, and the specific action it triggers.
          </p>
        </div>

        {/* SUMMARY STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 28 }}>
          {[
            { label: "Total Metrics", value: METRICS_CATALOG.reduce((s, c) => s + c.metrics.length, 0), color: "#3b82f6" },
            { label: "Correlation Pairings", value: CORRELATION_PAIRINGS.reduce((s, t) => s + t.pairings.length, 0), color: "#22c55e" },
            { label: "Tier 1 (P0)", value: CORRELATION_PAIRINGS[0].pairings.length, color: "#22c55e" },
            { label: "Lead Indicators", value: CORRELATION_PAIRINGS.reduce((s, t) => s + t.pairings.filter(p => p.lead_lag.includes("LEADS") || p.lead_lag.includes("leads")).length, 0), color: "#f59e0b" },
            { label: "Metric Categories", value: METRICS_CATALOG.length, color: "#8b5cf6" },
          ].map((s, i) => (
            <div key={i} style={{ background: `${s.color}06`, border: `1px solid ${s.color}18`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* VIEW TOGGLE */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[
            { id: "correlations", label: "Correlation Pairings (X vs Y)" },
            { id: "catalog", label: "Metrics Catalog (All Inputs)" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)} style={{
              background: activeView === tab.id ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${activeView === tab.id ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 12, fontWeight: 600, color: activeView === tab.id ? "#3b82f6" : "#64748b",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* CORRELATION PAIRINGS VIEW */}
        {activeView === "correlations" && (
          <div>
            {CORRELATION_PAIRINGS.map((tier) => (
              <div key={tier.tier}>
                <Divider label={tier.tier} color={tier.color} />
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>{tier.description}</div>

                <div style={{ display: "grid", gap: 10 }}>
                  {tier.pairings.map((pair) => {
                    const isExpanded = expandedPairing === pair.id;
                    return (
                      <div key={pair.id} onClick={() => setExpandedPairing(isExpanded ? null : pair.id)} style={{
                        background: isExpanded ? `${tier.color}06` : "rgba(255,255,255,0.015)",
                        border: `1px solid ${isExpanded ? `${tier.color}25` : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 10, padding: 16, cursor: "pointer", transition: "all 0.15s",
                      }}>
                        {/* HEADER ROW */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <Pill color={tier.color}>{pair.id}</Pill>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{pair.x.label}</span>
                          <span style={{ fontSize: 12, color: "#475569" }}>vs</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{pair.y.label}</span>
                          <Pill color={pair.relationship.includes("POSITIVE") ? "#22c55e" : pair.relationship.includes("NEGATIVE") ? "#ef4444" : "#f59e0b"}>
                            {pair.relationship}
                          </Pill>
                          <Pill color="#64748b">r: {pair.expected_r}</Pill>
                          <Pill color="#06b6d4">{pair.priority}</Pill>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>{isExpanded ? "▲" : "▼"}</span>
                        </div>

                        {/* LEAD/LAG */}
                        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>⏱ {pair.lead_lag}</div>

                        {/* EXPANDED DETAIL */}
                        {isExpanded && (
                          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                            {/* FORMULAS */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>X-AXIS FORMULA</div>
                                <Code color={tier.color}>{pair.formula_x}</Code>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>Y-AXIS FORMULA</div>
                                <Code color={tier.color}>{pair.formula_y}</Code>
                              </div>
                            </div>

                            {/* HYPOTHESIS */}
                            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, borderLeft: `3px solid ${tier.color}30` }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>HYPOTHESIS — WHY THIS CORRELATION EXISTS</div>
                              <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.7 }}>{pair.hypothesis}</div>
                            </div>

                            {/* CHART + ACTION */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>CHART TYPE</div>
                                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{pair.chart_type}</div>
                              </div>
                              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: tier.color, letterSpacing: "0.08em", marginBottom: 4 }}>ACTION TRIGGER</div>
                                <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>{pair.action}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* METRICS CATALOG VIEW */}
        {activeView === "catalog" && (
          <div>
            {METRICS_CATALOG.map((cat) => {
              const isExpanded = expandedCat === cat.category;
              return (
                <div key={cat.category} style={{ marginBottom: 8 }}>
                  <div onClick={() => setExpandedCat(isExpanded ? null : cat.category)} style={{
                    background: isExpanded ? `${cat.color}06` : "rgba(255,255,255,0.015)",
                    border: `1px solid ${isExpanded ? `${cat.color}25` : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cat.color }}>{cat.category}</span>
                    <Pill color={cat.color}>{cat.metrics.length} metrics</Pill>
                    <span style={{ fontSize: 9, color: "#475569" }}>{cat.source}</span>
                    <Pill color="#475569">{cat.update_freq}</Pill>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ display: "grid", gap: 6, padding: "8px 0 8px 12px" }}>
                      {cat.metrics.map((m) => (
                        <div key={m.id} style={{
                          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: 8, padding: 12, display: "grid", gridTemplateColumns: "80px 1fr", gap: 10,
                        }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{m.id}</div>
                            <div style={{ fontSize: 9, color: "#475569" }}>{m.unit}</div>
                            <div style={{ fontSize: 9, color: "#334155" }}>{m.granularity}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 3 }}>{m.name}</div>
                            <Code color={cat.color}>{m.formula}</Code>
                            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                              <strong style={{ color: "#94a3b8" }}>Example:</strong> {m.example} — {m.notes}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* THE SIGNAL CHAIN — HOW CORRELATIONS FEED EACH OTHER */}
        <Divider label="THE SIGNAL CHAIN — LEADING → LAGGING INDICATOR SEQUENCE" color="#94a3b8" />
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <Code color="#94a3b8">{`EARLIEST SIGNALS (6-12 months ahead)
  Business Formations → Employment Growth → Wage Growth
  Out-of-State Search Ratio → Net Migration (IRS)
  Land Price per Buildable Unit → Permit Filings

LEADING SIGNALS (2-6 months ahead)
  Search Momentum (SpyFu QoQ) → AADT Growth → Rent Growth
  Traffic Surge Index → Vacancy Drop → Rent Growth
  Digital-Physical Divergence → Price/Unit Appreciation
  Sentiment Trend → Lease Velocity → Occupancy

CONCURRENT SIGNALS (confirm current state)
  Wage Growth ↔ Rent Growth (ceiling function)
  Google Rating ↔ Rent Premium
  Pipeline % ↔ Months of Supply
  Digital Share ↔ Physical Occupancy

LAGGING SIGNALS (confirm what already happened)
  AADT Growth (confirms digital surge from 2-6 months ago)
  Cap Rate (confirms pricing changes from 6-12 months ago)
  NOI Margin (confirms operational changes over 6-12 months)
  Transaction Velocity (confirms market sentiment shift)

THE GOLDEN CHAIN (buy signal sequence):
  Biz formations spike → search momentum surges → traffic surge positive
  → digital-physical gap opens → vacancy drops → rents increase
  → cap rates compress → price/unit rises → too late to buy

BUY WINDOW: Between "search momentum surges" and "vacancy drops"
  That's 2-6 months of opportunity before prices reprice.`}</Code>
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: "center", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 9, color: "#1e293b" }}>
          JEDI RE · Correlation Metrics Engine v1 · {METRICS_CATALOG.reduce((s, c) => s + c.metrics.length, 0)} Metrics · {CORRELATION_PAIRINGS.reduce((s, t) => s + t.pairings.length, 0)} Pairings · 5 Tiers
          <br />
          Feeds: Pattern Intelligence Page (S4) · Market Intelligence Trends Tab · ProForma Assumptions · Opportunity Alerts
        </div>
      </div>
    </div>
  );
}
