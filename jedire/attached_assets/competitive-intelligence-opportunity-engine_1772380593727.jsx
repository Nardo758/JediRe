import { useState } from "react";

// ────────────────────────────────────────────────────────────
// DATA: 14 CAPABILITIES ORGANIZED INTO 7 SYSTEMS
// ────────────────────────────────────────────────────────────

const SYSTEMS = [
  {
    id: "performance",
    number: "S1",
    title: "Performance Tracking & Ranking Engine",
    subtitle: "Track → Rank → Position → Target",
    color: "#10b981",
    items: [1, 2, 7, 8],
    tagline: "The foundation. Every property gets a living performance score. Rankings expose who's winning, who's losing, and where you'd slot in.",
  },
  {
    id: "acquisition",
    number: "S2",
    title: "Acquisition Intelligence Engine",
    subtitle: "Find underperformers → Identify owners → Time the approach",
    color: "#3b82f6",
    items: [3, 4],
    tagline: "Once you know who's underperforming, find out WHO owns it, WHO manages it, and WHEN their debt matures. That's your acquisition window.",
  },
  {
    id: "comps",
    number: "S3",
    title: "Dual Comp Analysis Framework",
    subtitle: "Competition (trade area) vs Like-Kind (cross-market)",
    color: "#8b5cf6",
    items: [5],
    tagline: "Two lenses on every deal. Your local competitors define market position. Like-kind comps across markets reveal pricing anomalies and operational benchmarks.",
  },
  {
    id: "patterns",
    number: "S4",
    title: "Pattern Recognition Engine",
    subtitle: "Platform-wide intelligence from every data stream",
    color: "#f59e0b",
    items: [6, 10, 11, 13],
    tagline: "The brain. Ingests Google reviews, rent-to-traffic correlations, business formation clusters, and wage growth — finds patterns humans miss.",
  },
  {
    id: "projection",
    number: "S5",
    title: "Predictive Positioning & Rank-Me Tool",
    subtitle: "Project future rank → Prescribe what to do",
    color: "#ef4444",
    items: [7, 8],
    tagline: "'I want to be ranked 2nd in this market — what do I need to do?' The platform reverse-engineers the gap and builds a plan.",
  },
  {
    id: "alerts",
    number: "S6",
    title: "Opportunity Alert System",
    subtitle: "Push intelligence → Recommend strategies",
    color: "#06b6d4",
    items: [9],
    tagline: "Don't wait for users to search — push the best opportunities as they emerge, with specific strategy recommendations attached.",
  },
  {
    id: "flywheel",
    number: "S7",
    title: "Data Flywheel & Records Intelligence",
    subtitle: "Every deal underwritten feeds the brain → Property records as supply signals",
    color: "#ec4899",
    items: [12, 14],
    tagline: "Save every underwritten deal (win or lose) because the data is gold. Extract supply signals, business opportunities, and ownership patterns from public records.",
  },
];

// ────────────────────────────────────────────────────────────
// S1: PERFORMANCE TRACKING & RANKING ENGINE
// ────────────────────────────────────────────────────────────
const PERFORMANCE_ENGINE = {
  overview: "Every multifamily property in a tracked submarket gets a Performance Composite Score (PCS) updated monthly. The PCS combines traffic position, financial metrics, operational quality, and market momentum into a single ranking number. This ranking is the backbone — everything else (acquisition targeting, positioning, alerts) depends on knowing who's #1 and who's #47.",

  score_components: [
    {
      name: "Traffic Position (25%)",
      source: "M07 Traffic Engine → TPI",
      metrics: ["Effective ADT percentile in submarket", "Digital traffic share", "Traffic velocity (gaining/losing)", "Walk-in conversion efficiency"],
      formula: "traffic_score = TPI_percentile × 0.5 + digital_share_pct × 0.25 + TVS_normalized × 0.25",
    },
    {
      name: "Revenue Performance (30%)",
      source: "M05 Market Intel + CoStar/Apartments.com",
      metrics: ["Effective rent vs submarket avg", "Rent growth rate vs submarket", "Revenue per available unit (RevPAU)", "Concession intensity (inverse)"],
      formula: "revenue_score = rent_premium_pct × 0.3 + rent_growth_delta × 0.3 + revpau_percentile × 0.25 + (1 - concession_rate) × 0.15",
    },
    {
      name: "Occupancy & Demand (20%)",
      source: "M05 + Apartments.com scraper + T-05",
      metrics: ["Physical occupancy rate", "Economic occupancy rate", "Lease velocity (new leases/month)", "Traffic-to-lease conversion rate"],
      formula: "occupancy_score = physical_occ × 0.3 + economic_occ × 0.3 + lease_velocity_pct × 0.2 + T05_conversion × 0.2",
    },
    {
      name: "Operational Quality (15%)",
      source: "Google Reviews + Apartments.com reviews + public signals",
      metrics: ["Google rating (1-5 stars)", "Review volume & recency", "Sentiment score from NLP", "Response rate to reviews", "Maintenance complaint frequency"],
      formula: "ops_score = google_rating_norm × 0.3 + sentiment_score × 0.3 + review_volume_norm × 0.15 + response_rate × 0.15 + (1-complaint_freq) × 0.10",
    },
    {
      name: "Asset Quality (10%)",
      source: "M01 Deal Capsule + property records + photos",
      metrics: ["Year built / last renovated", "Amenity completeness score", "Unit mix quality (vs market demand)", "Curb appeal / condition assessment"],
      formula: "asset_score = age_factor × 0.3 + amenity_completeness × 0.3 + unit_mix_alignment × 0.2 + condition_score × 0.2",
    },
  ],

  ranking_outputs: [
    {
      name: "Submarket Power Rankings",
      description: "Every property ranked 1 to N within its submarket. Updated monthly. Shows movement (↑3, ↓2, —). Users see where their assets rank and who just passed them.",
      display: "Sortable table with sparkline trends. Click any property → full PCS breakdown. Color-coded: Top 25% green, Middle 50% yellow, Bottom 25% red.",
    },
    {
      name: "Vantage Group Rankings",
      description: "Properties grouped by 'vantage' — similar vintage, similar unit count, similar class (A/B/C). This answers: 'Among 200-300 unit Class B properties built 2005-2015 in this MSA, where do I rank?'",
      display: "Dropdown filters: Class (A/B/C) × Vintage (decade) × Size (unit range) × Submarket. Rankings recalculate in real-time as filters change.",
    },
    {
      name: "Performance Trajectory",
      description: "12-month PCS trend line for each property. Identifies properties on upward trajectories (improving management, recent renovation) vs. declining (deferred maintenance, losing share).",
      display: "Line chart with trend arrow. ↑ Accelerating, → Stable, ↓ Decelerating. Trajectory is as important as current rank — a #15 that's climbing fast is more interesting than a #5 that's slipping.",
    },
  ],

  rank_me_tool: {
    name: "Rank-Me Positioning Engine",
    description: "The user says: 'I'm buying this deal. I want to be ranked 2nd or 3rd in the market. What do I need to do?' The platform reverse-engineers the gap between the subject property's current PCS and the target rank, then prescribes the specific improvements.",
    workflow: [
      {
        step: 1,
        action: "User selects subject property + target rank",
        detail: "Drop deal into ranking. System calculates current PCS and shows the gap to target position.",
      },
      {
        step: 2,
        action: "Gap Analysis by Component",
        detail: "Break the PCS gap into components. 'You're 14 points behind #2. The gap is: -3 in traffic (can't change location), -2 in revenue (raise rents $85/unit to match), -5 in operational quality (you need to get from 3.8 to 4.4 stars on Google), -4 in asset quality (renovate units + add 3 amenities).'",
      },
      {
        step: 3,
        action: "Prescriptive Action Plan",
        detail: "For each gap component, the platform generates specific actions with cost estimates and timeline. Revenue gap → rent increase schedule. Ops gap → management improvements (from Google review analysis). Asset gap → CapEx budget with ROI per improvement.",
      },
      {
        step: 4,
        action: "Pro Forma Integration",
        detail: "'Achieving Rank #2 requires $1.2M in CapEx over 18 months. Here's how that changes your IRR: from 14.2% → 19.7%. The ranking improvement also reduces refinance risk and increases exit cap rate compression.'",
      },
      {
        step: 5,
        action: "Track Progress Post-Acquisition",
        detail: "Once acquired, the property enters the Owned Assets module. Monthly PCS updates show whether you're on track to reach your target rank. Deviation alerts: 'You're 3 months in and 2 points behind schedule on operational quality — here's what the top performers do differently.'",
      },
    ],
  },
};

// ────────────────────────────────────────────────────────────
// S2: ACQUISITION INTELLIGENCE ENGINE
// ────────────────────────────────────────────────────────────
const ACQUISITION_ENGINE = {
  overview: "The Performance Rankings create a map of winners and losers. The Acquisition Engine turns that map into a deal pipeline by identifying underperformers that SHOULD be performing better (given their location/attributes), then building intelligence profiles on ownership, management, and debt to time the approach.",

  underperformer_detection: {
    name: "Underperformer Detection Algorithm",
    concept: "Compare each property's actual PCS to its EXPECTED PCS based on location advantages. A property ranked #30 in a submarket that SHOULD be ranked #8 (based on its traffic position, vintage, and unit count) has a performance gap of 22 ranks. That gap = your value-add opportunity.",
    formula: `EXPECTED_RANK = model(
  traffic_position_index,    // Location quality from M07
  year_built,                // Physical quality baseline
  unit_count,                // Scale advantages
  amenity_set,               // Feature completeness
  submarket_avg_rent,        // Market ceiling
  frontage_quality           // Visibility/access
)

PERFORMANCE_GAP = EXPECTED_RANK - ACTUAL_RANK
  → Gap > 10 ranks: SEVERE underperformance — strong acquisition target
  → Gap 5-10 ranks: MODERATE underperformance — investigate management/condition
  → Gap 0-5 ranks: SLIGHT underperformance — normal variance
  → Gap < 0: OUTPERFORMING expectations — premium pricing likely justified`,

    vantage_group_targeting: {
      concept: "Instead of looking at ALL underperformers, find which VANTAGE GROUP is performing best, then target underperformers within that group. If 1990s-vintage 200-unit Class B properties are crushing it (because they're the rent-value sweet spot in this cycle), find the ones in that group that AREN'T crushing it — those are your deals.",
      workflow: [
        "Rank all vantage groups by average PCS → identify the top-performing group",
        "Within that group, identify properties in bottom quartile (underperformers in a winning category)",
        "Cross-reference with T-04 quadrant → Hidden Gems in a top vantage group = PRIORITY TARGETS",
        "Score targets: (vantage_group_strength × performance_gap × traffic_arbitrage_ratio)",
        "Output: Ranked list of acquisition targets with estimated value-add potential in dollars",
      ],
    },
  },

  ownership_intelligence: {
    name: "Ownership & Debt Intelligence Layer",
    concept: "For every identified target, build a complete ownership profile. The most actionable deals combine an underperforming property with a motivated seller — and the biggest motivation is debt maturity pressure.",
    data_sources: [
      {
        source: "County Property Appraiser / Tax Records",
        data: ["Current owner name/entity", "Purchase date and price", "Assessed value", "Tax payment history (delinquent = distress signal)", "Ownership chain (how many times sold, holding period)"],
        access: "Free — county clerk websites, PropertyShark, ATTOM Data",
      },
      {
        source: "UCC Filings / Mortgage Records",
        data: ["Lender name", "Original loan amount", "Recording date", "Loan term (derive maturity date)", "Second liens / mezzanine debt", "Assignment records (loan been sold/transferred)"],
        access: "County recorder — free to search. Bulk via ATTOM or CoreLogic.",
      },
      {
        source: "Secretary of State / Entity Records",
        data: ["LLC/Corp registration", "Registered agent", "Officers/members (sometimes)", "Related entities (same registered agent = portfolio owner)", "Entity status (active, dissolved, admin revoked)"],
        access: "Free — state SOS website. FL: sunbiz.org",
      },
      {
        source: "CMBS/Securitization Data (for larger deals)",
        data: ["Servicer name", "DSCR and LTV at origination", "Watchlist status", "Special servicing transfer", "Loan maturity date (exact)"],
        access: "Trepp, CRED iQ, Bloomberg Terminal — premium data",
      },
    ],
    derived_intelligence: [
      {
        signal: "Debt Maturity Window",
        formula: "maturity_date = recording_date + loan_term (typically 5, 7, or 10 years)",
        insight: "Properties with debt maturing in 6-18 months face refinancing risk, especially in high-rate environments. If current DSCR has deteriorated (underperformance), refinancing may require equity injection — creating seller motivation.",
        action: "Alert: '[Property] at [address] — estimated debt maturity Q3 2026. Owner [entity]. Current performance: Bottom quartile. ACQUISITION WINDOW OPENING.'",
      },
      {
        signal: "Holding Period Stress",
        formula: "hold_years = today - purchase_date",
        insight: "Funds typically have 5-7 year hold periods. A property purchased in 2019-2020 is now at year 6-7 — fund managers may need to exit regardless of market conditions. Combined with underperformance, this creates strong seller motivation.",
        action: "Flag properties where hold_years > 5 AND PCS_rank is bottom quartile AND debt maturing within 24 months → TRIPLE TRIGGER target",
      },
      {
        signal: "Owner Portfolio Pattern",
        formula: "portfolio = GROUP BY registered_agent WHERE entity_count > 3",
        insight: "If the same registered agent appears on 15 LLCs, that's a portfolio operator. If 3 of their 15 properties are underperforming, they may be willing to trade non-core assets. Approach with: 'I see your portfolio focuses on Class A — would you consider divesting this Class B asset?'",
        action: "Build owner portfolio maps. Identify operators with mixed-quality portfolios. Target their non-core assets.",
      },
      {
        signal: "Management Company Performance Pattern",
        formula: "mgmt_avg_pcs = AVG(PCS) WHERE management_company = X",
        insight: "Some management companies consistently underperform. If you can identify that properties managed by Company X rank 15-20 positions below expected, EVERY property they manage is a potential target — you're not just buying the building, you're buying the management upside.",
        action: "Rank management companies by average performance gap. Properties managed by bottom-quartile managers → instant acquisition watchlist.",
      },
    ],
  },
};

// ────────────────────────────────────────────────────────────
// S3: DUAL COMP ANALYSIS
// ────────────────────────────────────────────────────────────
const DUAL_COMPS = {
  overview: "Traditional comp analysis uses one lens — nearby properties. JEDI RE uses two lenses simultaneously, and the PATTERNS that emerge from comparing the two views are where the real intelligence lives.",

  lens_1: {
    name: "COMPETITION LENS — Trade Area Comps",
    scope: "Properties within the defined trade area that compete for the SAME renter pool",
    purpose: "Determines your LOCAL market position — what rents you can charge, what amenities you need, and who you're losing tenants to",
    selection_criteria: [
      "Within trade area boundary (drive-time or traffic-pattern based)",
      "Similar unit types (studio/1br/2br/3br mix overlap > 50%)",
      "Similar price tier (±20% of subject effective rent)",
      "All classes — because even a Class A competes with a renovated Class B at the margin",
    ],
    pattern_analysis: [
      {
        pattern: "Rent Ceiling Gap",
        detection: "If the top-rent comp in your trade area charges $1,950 and the average is $1,650 — that $300 gap defines your renovation opportunity ceiling. Properties below average with above-average traffic position are acquisition targets.",
        action: "Map: X-axis = rent/unit, Y-axis = traffic position. Properties in lower-left (low rent, low traffic) are Dead Zones. Lower-right (low rent, high traffic) are VALUE-ADD TARGETS.",
      },
      {
        pattern: "Amenity Arms Race Detection",
        detection: "When 60%+ of trade area comps have added a specific amenity (dog park, package lockers, coworking) in the last 24 months, properties WITHOUT that amenity face accelerating competitive displacement. Traffic share data confirms: properties without the amenity are losing digital share faster than those with it.",
        action: "Alert: 'Amenity gap detected — 7 of 11 trade area comps now have [amenity]. Properties without it showing -8% digital traffic share decline QoQ.'",
      },
      {
        pattern: "Vintage Rotation",
        detection: "When new supply (vintage < 3 years) enters a trade area, the competitive pressure cascades downward: Class A new → pushes Class A existing → pushes renovated B → pushes unrenovated B. Track which vintage cohort is absorbing the most competitive damage via traffic share loss.",
        action: "Alert: 'Vintage cascade in progress — 2024-build luxury product absorbing 22% of digital traffic previously going to 2015-2018 vintage. Older Class A properties losing 0.5-1.0 rank position per quarter.'",
      },
    ],
  },

  lens_2: {
    name: "LIKE-KIND LENS — Cross-Market Comps",
    scope: "Properties with similar attributes (vintage, class, size, amenities) across different submarkets or MSAs",
    purpose: "Reveals pricing anomalies and operational benchmarks. A 250-unit Class B 2010-build in Market A charging $1,400 while the identical profile in Market B charges $1,800 — is Market A underpriced or Market B overpriced?",
    selection_criteria: [
      "Same vintage band (±5 years)",
      "Same class (A/B/C)",
      "Same size band (±50 units or ±25%)",
      "Similar amenity set (amenity overlap > 60%)",
      "Adjustable geography: same MSA, same state, national",
    ],
    pattern_analysis: [
      {
        pattern: "Cross-Market Pricing Anomaly",
        detection: "Group like-kind properties nationally. Calculate rent PSF by market. Markets where like-kind rent PSF is >15% below the national like-kind average AND traffic/demand signals are strong = UNDERPRICED MARKETS.",
        action: "Report: 'Class B 2008-2015 vintage in Port St. Lucie averages $1.42 PSF vs national like-kind average of $1.68 PSF — a 15.5% discount despite demand signals at 78th percentile. This market is UNDERPRICED for this property profile.'",
      },
      {
        pattern: "Operational Benchmark Gap",
        detection: "Compare operational metrics (occupancy, expense ratio, NOI margin, Google rating) across like-kind properties. Properties performing below the like-kind national benchmark have operational upside regardless of market conditions.",
        action: "Dashboard: 'Your property operates at 62% NOI margin. Like-kind national benchmark: 68%. The 6% gap = $180K/year in NOI at your scale. Top quartile like-kind properties achieve 72%.'",
      },
      {
        pattern: "Rent Growth Divergence",
        detection: "Track rent growth by like-kind cohort across markets. When one market's like-kind cohort grows significantly faster than others, it signals either a catch-up play (underpriced market repricing) or a bubble (overheating). Cross-reference with traffic trajectory to distinguish.",
        action: "Alert: 'Like-kind rent growth divergence: Class B 2010-2020 in Orlando growing at 5.2% vs cohort average of 3.1%. Traffic trajectory CONFIRMS demand acceleration → genuine repricing, not bubble.'",
      },
    ],
  },

  collision_output: "When both lenses find the same property, the signal is amplified. A property that ranks low in its trade area (Competition lens) AND ranks below like-kind benchmarks (Like-Kind lens) has BOTH local competitive problems AND operational problems — maximum value-add potential.",
};

// ────────────────────────────────────────────────────────────
// S4: PATTERN RECOGNITION ENGINE
// ────────────────────────────────────────────────────────────
const PATTERN_ENGINE = {
  overview: "A horizontal intelligence layer that runs across ALL modules. It doesn't own data — it consumes data from every module and looks for patterns, correlations, anomalies, and predictive relationships that no single module would detect alone.",

  pattern_categories: [
    {
      name: "Google Reviews Intelligence",
      id: "PR-01",
      color: "#f59e0b",
      data_source: "Google Places API (free tier: 100K calls/mo), Apartments.com reviews",
      extraction_pipeline: [
        "Pull all reviews for every property in tracked submarkets (batch monthly, incremental weekly)",
        "NLP classification: Maintenance, Management, Amenities, Location, Noise, Parking, Pests, Safety, Value",
        "Sentiment scoring per category: -1 to +1",
        "Trend detection: sentiment changing over time (improving management = new owner doing value-add)",
        "Competitive comparison: your property's sentiment profile vs trade area average",
      ],
      patterns_detected: [
        {
          pattern: "Management Transition Signal",
          how: "When a property's review sentiment shifts dramatically (±0.3 in 6 months), it often indicates an ownership or management change. Improving = new owner executing value-add. Declining = asset being neglected for sale.",
          value: "Early detection of ownership transitions creates acquisition or partnership opportunities 3-6 months before deals hit the market.",
        },
        {
          pattern: "Operational Gap Mining",
          how: "Extract the TOP 3 complaint categories per property. If 'maintenance response time' is the #1 complaint and that property has strong traffic position, you've found an operational fix that's cheaper than physical renovation.",
          value: "Quantify the operational gap: 'This property has a 3.2 star average. 68% of negative reviews cite maintenance. Like-kind properties with maintenance scores >4.0 charge $125/unit more rent. Fix maintenance → capture $125/unit.'",
        },
        {
          pattern: "Amenity Demand Signal",
          how: "When reviews across multiple properties in a submarket mention 'wish this had [X]' (dog park, EV charging, package room), it's a revealed preference signal. Track which amenity mentions are rising fastest.",
          value: "Priority CapEx decisions: 'In this submarket, EV charging mentions increased 340% in 12 months across all property reviews. First mover captures the ESG/lifestyle premium.'",
        },
      ],
    },
    {
      name: "Rent-Traffic-Wage Correlation Engine",
      id: "PR-02",
      color: "#3b82f6",
      data_source: "CoStar/Apartments.com (rent), M07 Traffic Engine, BLS Quarterly Census of Employment & Wages (QCEW)",
      methodology: `For each submarket, compute rolling 12-month correlations:

rent_traffic_r = correlation(rent_growth_12mo, traffic_growth_12mo)
rent_wage_r    = correlation(rent_growth_12mo, wage_growth_12mo)
traffic_wage_r = correlation(traffic_growth_12mo, wage_growth_12mo)

HEALTHY MARKET: All three positively correlated (r > 0.5)
  → Wages rising, traffic rising, rents rising = sustainable growth

WARNING — RENT > WAGE:
  rent_growth > wage_growth × 1.5 for 3+ quarters
  → Rents outpacing incomes = affordability ceiling approaching
  → Risk: demand destruction, concession increases, occupancy softening

WARNING — TRAFFIC > RENT:
  traffic_growth > rent_growth × 2.0
  → People are showing up but rents haven't responded
  → OPPORTUNITY: operator is leaving money on the table, or the market is about to reprice

SIGNAL — WAGE > RENT:
  wage_growth > rent_growth × 1.3
  → Incomes growing faster than rents = rent growth RUNWAY exists
  → BULLISH: room to push rents without losing demand`,
      patterns_detected: [
        {
          pattern: "Affordability Ceiling Predictor",
          how: "When rent/wage ratio exceeds 30% of median household income for 2+ consecutive quarters AND traffic trajectory is decelerating, the market is approaching an affordability wall. Rents will plateau or decline.",
          value: "12-18 month forward signal for rent growth assumptions in ProForma. Prevents overoptimistic underwriting.",
        },
        {
          pattern: "Rent Growth Runway Detector",
          how: "When wage growth > rent growth sustained AND traffic is growing — rents have room to run. The wage growth creates a 'permission structure' for rent increases without demand destruction.",
          value: "Identifies markets where aggressive rent growth assumptions are JUSTIFIED by wage fundamentals. Push to ProForma as upside scenario.",
        },
      ],
    },
    {
      name: "Business Formation & Cluster Intelligence",
      id: "PR-03",
      color: "#10b981",
      data_source: "Census Bureau Business Formation Statistics (BFS), FL Dept of State (sunbiz.org), SBA lending data, commercial lease records",
      methodology: `Track new business formations by geography and industry:

monthly_formations = COUNT(new_entity_filings) WHERE county = X GROUP BY NAICS_2digit
formation_velocity = (current_quarter / prior_quarter) - 1
cluster_detection  = spatial_clustering(new_business_locations, eps=1mi, min_samples=5)

INDUSTRY CLUSTERS → DEMAND SIGNALS:
  Healthcare cluster growing  → Medical professionals need housing (higher income tier)
  Tech/startup cluster        → Young professionals, studio/1BR demand, amenity-sensitive
  Logistics/warehouse cluster → Blue collar workforce, 2BR/3BR demand, price-sensitive
  Restaurant/retail cluster   → Service workers, affordable housing demand, transit-dependent
  Construction cluster        → Development activity signal (confirms supply pipeline data)`,
      patterns_detected: [
        {
          pattern: "Emerging Employment Center",
          how: "When business formations in a specific NAICS cluster exceed 2 standard deviations above the trailing 24-month average within a 3-mile radius, a new employment center is forming. This is a demand signal 12-24 months BEFORE the traffic data shows it.",
          value: "Earliest demand signal available. Business formations → hiring → apartment searches → traffic → occupancy. You're seeing step 1 when most investors see step 4.",
        },
        {
          pattern: "Industry Mix Shift",
          how: "When the composition of business formations shifts (e.g., healthcare NAICS growing from 8% to 15% of new formations), the INCOME PROFILE of the renter pool is changing. Healthcare workers earn more than retail workers. This justifies different product positioning.",
          value: "Informs unit mix and pricing strategy: 'Business formation data shows healthcare cluster emerging in this submarket. Healthcare worker median income: $68K. Your current rent at 28% of this income = room for Class B+ positioning.'",
        },
      ],
    },
  ],
};

// ────────────────────────────────────────────────────────────
// S6: OPPORTUNITY ALERT SYSTEM
// ────────────────────────────────────────────────────────────
const ALERT_SYSTEM = {
  overview: "Don't wait for users to hunt for deals. The platform continuously monitors all data streams and pushes actionable opportunity alerts with specific strategy recommendations. Alerts are ranked by confidence and time-sensitivity.",

  alert_types: [
    {
      name: "ACQUISITION WINDOW",
      emoji: "🎯",
      color: "#22c55e",
      trigger: "Underperformer + debt maturity window + motivated seller signal",
      example_alert: "ACQUISITION TARGET: Sunset Ridge (248 units, PSL)\n• Ranked #34 of 41 — expected rank #12 based on location\n• Owner: PSL Ventures LLC (purchased 2019, hold year 6)\n• Est. debt maturity: Q2 2026 (14 months)\n• Managed by: Greystar C-tier team (avg PCS: bottom 30%)\n• Strategy: Value-Add flip. Fix management + renovate 40% of units\n• Est. value creation: $2.8M on $18M basis",
      urgency: "HIGH — debt maturity creates a 6-month approach window",
    },
    {
      name: "MARKET SURGE",
      emoji: "🔥",
      color: "#3b82f6",
      trigger: "Market lifecycle entering Acceleration + confirmed by rent-traffic-wage alignment",
      example_alert: "MARKET SURGE: Stuart/Jensen Beach submarket\n• Digital demand: +32% QoQ (Emergence → Acceleration)\n• AADT on US-1/Jensen Beach Blvd: +6.8% YoY\n• Wage growth: +4.2% (healthcare + marine industry clusters)\n• Business formations: +18% (2x county average)\n• Strategy: BTS or Rental acquisition. Top-performing vantage: Class B 2005-2015\n• Watch: 3 properties in this vantage currently ranked bottom quartile",
      urgency: "MODERATE — 3-6 month window before market reprices",
    },
    {
      name: "COMPETITIVE SHIFT",
      emoji: "⚡",
      color: "#f59e0b",
      trigger: "Property losing 10%+ digital share while trade area stable + declining Google review sentiment",
      example_alert: "COMPETITIVE ALERT: Palm Bay Gardens (312 units)\n• Digital traffic share: down 14% this quarter\n• Google reviews: dropped from 4.1 to 3.6 (maintenance complaints surging)\n• Two new comps delivering within 18 months in same trade area\n• Current rank: #8 → projected #14 by Q4 2026\n• Strategy: Acquisition target IF priced at current underperformance\n• Risk: Competitive pressure intensifying — act within 90 days or walk",
      urgency: "HIGH — deterioration accelerating",
    },
    {
      name: "PATTERN ANOMALY",
      emoji: "🔍",
      color: "#8b5cf6",
      trigger: "Pattern Recognition Engine detects unusual correlation or divergence",
      example_alert: "PATTERN DETECTED: Rent-Traffic Divergence in Vero Beach\n• Traffic growth: +11% YoY across submarket\n• Rent growth: +1.8% YoY (lagging significantly)\n• Wage growth: +3.9% (supports higher rents)\n• Diagnosis: Operators haven't repriced to match traffic demand\n• Opportunity: Properties with strong traffic but below-market rents\n• Estimated rent runway: $75-125/unit before hitting wage ceiling\n• 4 properties identified with TAR > 1.2 and rent < submarket avg",
      urgency: "MODERATE — rent catch-up typically takes 6-12 months",
    },
    {
      name: "DISTRESS SIGNAL",
      emoji: "🚨",
      color: "#ef4444",
      trigger: "Tax delinquency + code violations + declining occupancy + review collapse",
      example_alert: "DISTRESS DETECTED: Ocean Breeze Apartments (164 units)\n• Property tax: 2 quarters delinquent\n• Code violations: 3 open, unresolved\n• Google reviews: 2.1 stars (was 3.4 two years ago)\n• Estimated occupancy: 78% (submarket avg: 94%)\n• Owner: single-asset LLC, registered agent non-responsive\n• Strategy: Deep value / restructuring play\n• Risk: Physical condition may require major CapEx\n• Approach: Direct mail to registered agent + tax sale monitoring",
      urgency: "VARIABLE — monitor for tax sale or receivership triggers",
    },
  ],

  delivery: [
    { channel: "In-App Dashboard", frequency: "Real-time feed, ranked by TOS × urgency" },
    { channel: "Email Digest", frequency: "Weekly summary of top 5 opportunities by market" },
    { channel: "Push Notification", frequency: "Immediate for HIGH urgency + confidence > 80%" },
    { channel: "Portfolio-Specific", frequency: "Alerts filtered to user's tracked markets + investment criteria" },
  ],
};

// ────────────────────────────────────────────────────────────
// S7: DATA FLYWHEEL & RECORDS INTELLIGENCE
// ────────────────────────────────────────────────────────────
const DATA_FLYWHEEL = {
  underwriting_archive: {
    name: "Underwriting Intelligence Archive",
    concept: "SAVE EVERY DEAL. Win or lose, the underwriting data is gold. Every deal underwritten on the platform has real assumptions, real market analysis, real financial modeling. Over time, this archive becomes a proprietary dataset that improves everything — comp accuracy, assumption benchmarks, outcome validation.",
    what_to_capture: [
      { field: "Deal snapshot at underwriting", data: "All Cap Capsule data frozen at time of analysis — price, rents, occupancy, market conditions, traffic scores" },
      { field: "Underwriting assumptions", data: "Rent growth, exit cap, hold period, CapEx budget, management fee, vacancy assumption, debt terms" },
      { field: "Strategy selected", data: "Which of the 4 strategies was chosen and why (Strategy Arbitrage output)" },
      { field: "Outcome (if tracked)", data: "Did the user win the deal? At what price? If lost — to whom and at what premium?" },
      { field: "Post-acquisition actuals", data: "If owned — monthly actuals vs underwritten projections (from deal_monthly_actuals table)" },
    ],
    intelligence_outputs: [
      "Assumption Benchmarks: 'The average user underwriting Class B value-add in this submarket assumes 3.2% rent growth. Actual achieved: 4.1%. Your assumptions may be conservative.'",
      "Bid-to-Win Analysis: 'Of 47 deals underwritten in this submarket last year, 12 were won. Average winning premium over initial underwrite: 7.3%. Typical losing bid was within 4% of winning price.'",
      "Outcome Validation: 'Properties with TOS > 70 at underwriting achieved an average 18.2% IRR vs 12.4% for TOS < 40. Traffic Opportunity Score is predictive of investment outcomes.'",
      "Strategy Accuracy: 'Strategy Arbitrage recommended BTS over Rental for 23 deals. The 8 that followed the BTS recommendation averaged 22% IRR vs 14% for those that chose Rental anyway.'",
    ],
  },

  property_records_intelligence: {
    name: "Property Records Intelligence Extraction",
    concept: "County property records contain massive amounts of intelligence beyond simple ownership data. By systematically mining these records, the platform can derive supply signals, future supply predictions, business opportunity indicators, and market timing intelligence.",
    extractions: [
      {
        category: "Supply Intelligence",
        signals: [
          { signal: "New plat recordings", insight: "Land being subdivided = development intent. Track by trade area to quantify future supply before permits are even filed." },
          { signal: "Zoning change petitions in property records", insight: "Rezoning requests attached to specific parcels = early development signal. Cross-reference with M02 Zoning Agent data." },
          { signal: "Demolition permits", insight: "Existing structures being torn down = replacement supply coming. Net supply calculation must account for demolitions." },
          { signal: "Certificate of Occupancy filings", insight: "New units actually entering market (not just permitted or under construction). The real supply impact date." },
        ],
      },
      {
        category: "Future Supply Prediction",
        signals: [
          { signal: "Land sale patterns", insight: "When land parcels in a submarket transact at prices implying multifamily development ($50K+/unit buildable), developers are planning. Track land $/unit trend as supply leading indicator." },
          { signal: "Impact fee payments", insight: "Developers pay impact fees before breaking ground. Spike in impact fee revenue = confirmed construction pipeline 12-24 months out." },
          { signal: "Utility connection applications", insight: "Water/sewer connection requests for large-scale residential = confirmed development. Often available through utility district records before county permits show activity." },
        ],
      },
      {
        category: "Business & Investment Opportunities",
        signals: [
          { signal: "Foreclosure filings / lis pendens", insight: "Track foreclosure activity by submarket. Rising foreclosures = distress inventory becoming available. Early notice — foreclosure takes 6-18 months in FL." },
          { signal: "Estate / probate transfers", insight: "Inherited properties often sell below market (heirs want liquidity, not management hassle). Track probate filings for multifamily parcels." },
          { signal: "Code enforcement liens", insight: "Accumulated code violation liens = distressed operator who may welcome a buyout. The liens become a negotiation tool." },
          { signal: "Property tax appeal filings", insight: "Owners appealing assessments downward may be preparing for sale (lowering tax basis reduces carrying costs). Unusual spike in appeals in a submarket = sentiment shift." },
        ],
      },
      {
        category: "Market Timing Intelligence",
        signals: [
          { signal: "Transaction velocity by submarket", insight: "Track monthly sales volume. Accelerating transactions = market heating up. Decelerating = cooling. Combined with traffic trajectory for confirmation." },
          { signal: "Price per unit trends from deed recordings", insight: "Actual sale prices per unit derived from documentary stamps (FL requires them). More accurate than asking prices or broker claims." },
          { signal: "Holding period patterns", insight: "Average hold period shortening = operators taking profits (potentially peaking market). Lengthening = operators holding through downturns or difficulty selling." },
          { signal: "1031 exchange filings", insight: "High 1031 activity = capital rotating. Where is it rotating TO (your market) or FROM (your market)? Net 1031 inflow = capital attraction signal." },
        ],
      },
    ],
  },
};

// ────────────────────────────────────────────────────────────
// MASTER CONNECTION MAP — HOW ALL 14 ITEMS INTERCONNECT
// ────────────────────────────────────────────────────────────
const CONNECTION_MAP = [
  { from: "S1: Performance Tracking", to: "S2: Acquisition Intelligence", signal: "Rankings identify underperformers → becomes target list" },
  { from: "S1: Performance Tracking", to: "S5: Rank-Me Tool", signal: "Current rankings → gap to target rank → action plan" },
  { from: "S2: Ownership Intelligence", to: "S6: Opportunity Alerts", signal: "Debt maturity + distress signals → timed acquisition alerts" },
  { from: "S3: Trade Area Comps", to: "S1: Performance Ranking", signal: "Local competitive position feeds PCS ranking" },
  { from: "S3: Like-Kind Comps", to: "S4: Pattern Engine", signal: "Cross-market anomalies feed pattern detection" },
  { from: "S4: Google Reviews", to: "S1: Performance (Ops Score)", signal: "Sentiment analysis feeds operational quality component of PCS" },
  { from: "S4: Rent-Traffic-Wage", to: "S6: Opportunity Alerts", signal: "Divergences trigger pattern anomaly alerts" },
  { from: "S4: Business Formation", to: "M06: Demand Signals", signal: "Cluster detection feeds demand driver intelligence" },
  { from: "S7: Underwriting Archive", to: "S4: Pattern Engine", signal: "Historical assumptions + outcomes train accuracy models" },
  { from: "S7: Property Records", to: "S2: Acquisition Intelligence", signal: "Ownership, debt, distress signals for targeting" },
  { from: "S7: Property Records", to: "M04: Supply Pipeline", signal: "Plats, permits, CO filings feed supply forecasting" },
  { from: "S6: Opportunity Alerts", to: "M08: Strategy Arbitrage", signal: "Each alert includes strategy recommendation from arbitrage engine" },
  { from: "All Systems", to: "M25: JEDI Score", signal: "Every signal ultimately flows into the 5 master signals and composite JEDI Score" },
];


// ────────────────────────────────────────────────────────────
// RENDERING
// ────────────────────────────────────────────────────────────
function Divider({ label, color = "#475569" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "44px 0 20px" }}>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, ${color}40, transparent)` }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, ${color}40, transparent)` }} />
    </div>
  );
}

function Code({ children, color = "#94a3b8" }) {
  return (
    <pre style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
      color, background: "rgba(0,0,0,0.45)", padding: "12px 16px",
      borderRadius: 8, overflowX: "auto", lineHeight: 1.6, margin: 0,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
      border: "1px solid rgba(255,255,255,0.04)",
    }}>{children}</pre>
  );
}

function Pill({ children, color = "#64748b" }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      color, background: `${color}12`, letterSpacing: "0.05em",
      border: `1px solid ${color}20`,
    }}>{children}</span>
  );
}

function Card({ children, color = "rgba(255,255,255,0.06)", border, style = {} }) {
  return (
    <div style={{
      background: color, border: border || "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: 16, ...style,
    }}>{children}</div>
  );
}

export default function CompetitiveIntelligenceEngine() {
  const [activeSystem, setActiveSystem] = useState("performance");
  const [expandedSection, setExpandedSection] = useState(null);

  const toggle = (id) => setExpandedSection(expandedSection === id ? null : id);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050810",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      padding: "36px 24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "linear-gradient(135deg, #10b981, #3b82f6, #f59e0b, #ef4444, #ec4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace",
              boxShadow: "0 0 40px rgba(59,130,246,0.15)",
            }}>CI</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.14em" }}>
                JEDI RE · EXTENDS TRAFFIC INTELLIGENCE FRAMEWORK · v1
              </div>
              <h1 style={{
                fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Competitive Intelligence & Opportunity Engine
              </h1>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", maxWidth: 950, lineHeight: 1.7 }}>
            14 capabilities organized into 7 interconnected systems. Track performance → Rank every property → Detect underperformers →
            Find who owns them and when their debt expires → Recognize patterns across reviews, wages, traffic, and business formations →
            Project where a new deal would rank → Push opportunity alerts with strategies. Every underwritten deal feeds the brain.
          </p>
        </div>

        {/* ═══ SYSTEM NAVIGATION ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 32 }}>
          {SYSTEMS.map((sys) => (
            <button
              key={sys.id}
              onClick={() => { setActiveSystem(sys.id); setExpandedSection(null); }}
              style={{
                background: activeSystem === sys.id ? `${sys.color}10` : "rgba(255,255,255,0.015)",
                border: `1px solid ${activeSystem === sys.id ? `${sys.color}35` : "rgba(255,255,255,0.05)"}`,
                borderRadius: 10, padding: "12px 8px", cursor: "pointer",
                textAlign: "left", transition: "all 0.15s",
                borderBottom: activeSystem === sys.id ? `2px solid ${sys.color}` : "2px solid transparent",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: sys.color, letterSpacing: "0.1em", marginBottom: 4 }}>{sys.number}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: activeSystem === sys.id ? "#f8fafc" : "#94a3b8", lineHeight: 1.3 }}>{sys.title}</div>
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>Items {sys.items.join(", ")}</div>
            </button>
          ))}
        </div>

        {/* ═══ SYSTEM CONTENT ═══ */}

        {/* S1: PERFORMANCE ENGINE */}
        {activeSystem === "performance" && (
          <div>
            <Card color="rgba(16,185,129,0.04)" border="1px solid rgba(16,185,129,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 1 — ITEMS 1, 2, 7, 8</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{PERFORMANCE_ENGINE.overview}</div>
            </Card>

            <Divider label="PERFORMANCE COMPOSITE SCORE — 5 COMPONENTS" color="#10b981" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PERFORMANCE_ENGINE.score_components.map((comp, i) => (
                <Card key={i} style={{ gridColumn: i === 4 ? "1 / -1" : "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#10b981" }}>{comp.name}</span>
                    <Pill color="#475569">{comp.source}</Pill>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {comp.metrics.map((m, j) => (
                      <span key={j} style={{ fontSize: 10, color: "#94a3b8", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: 4 }}>{m}</span>
                    ))}
                  </div>
                  <Code color="#10b981">{comp.formula}</Code>
                </Card>
              ))}
            </div>

            <Divider label="RANKING OUTPUTS" color="#10b981" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {PERFORMANCE_ENGINE.ranking_outputs.map((out, i) => (
                <Card key={i}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>{out.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, marginBottom: 8 }}>{out.description}</div>
                  <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", lineHeight: 1.5 }}>{out.display}</div>
                </Card>
              ))}
            </div>

            <Divider label="RANK-ME POSITIONING ENGINE — 'I WANT TO BE #2, WHAT DO I DO?'" color="#10b981" />
            <Card color="rgba(16,185,129,0.04)" border="1px solid rgba(16,185,129,0.15)">
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>{PERFORMANCE_ENGINE.rank_me_tool.name}</div>
              <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 14 }}>{PERFORMANCE_ENGINE.rank_me_tool.description}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {PERFORMANCE_ENGINE.rank_me_tool.workflow.map((step) => (
                  <div key={step.step} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 800, color: "#10b981", fontFamily: "'JetBrains Mono', monospace",
                    }}>{step.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 3 }}>{step.action}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* S2: ACQUISITION ENGINE */}
        {activeSystem === "acquisition" && (
          <div>
            <Card color="rgba(59,130,246,0.04)" border="1px solid rgba(59,130,246,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 2 — ITEMS 3, 4</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{ACQUISITION_ENGINE.overview}</div>
            </Card>

            <Divider label="UNDERPERFORMER DETECTION" color="#3b82f6" />
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>{ACQUISITION_ENGINE.underperformer_detection.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>{ACQUISITION_ENGINE.underperformer_detection.concept}</div>
              <Code color="#3b82f6">{ACQUISITION_ENGINE.underperformer_detection.formula}</Code>
            </Card>

            <div style={{ marginTop: 12 }}>
              <Card color="rgba(59,130,246,0.04)" border="1px solid rgba(59,130,246,0.12)">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 8 }}>Vantage Group Targeting — Find Winners, Then Find Their Laggards</div>
                <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 10 }}>{ACQUISITION_ENGINE.underperformer_detection.vantage_group_targeting.concept}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {ACQUISITION_ENGINE.underperformer_detection.vantage_group_targeting.workflow.map((step, i) => (
                    <div key={i} style={{
                      fontSize: 11, color: "#94a3b8", background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "8px 12px",
                      borderLeft: "2px solid rgba(59,130,246,0.3)", lineHeight: 1.5,
                    }}>
                      <span style={{ color: "#3b82f6", fontWeight: 700, marginRight: 6 }}>{i + 1}.</span> {step}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Divider label="OWNERSHIP & DEBT INTELLIGENCE" color="#3b82f6" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {ACQUISITION_ENGINE.ownership_intelligence.data_sources.map((src, i) => (
                <Card key={i}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>{src.source}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {src.data.map((d, j) => (
                      <span key={j} style={{ fontSize: 9, color: "#94a3b8", background: "rgba(0,0,0,0.3)", padding: "2px 7px", borderRadius: 4 }}>{d}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>{src.access}</div>
                </Card>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 10 }}>DERIVED INTELLIGENCE SIGNALS</div>
            <div style={{ display: "grid", gap: 10 }}>
              {ACQUISITION_ENGINE.ownership_intelligence.derived_intelligence.map((intel, i) => (
                <Card key={i} color="rgba(59,130,246,0.03)" border="1px solid rgba(59,130,246,0.1)">
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 4 }}>{intel.signal}</div>
                  <Code color="#3b82f6">{intel.formula}</Code>
                  <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6, marginTop: 8 }}>{intel.insight}</div>
                  <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 6, fontWeight: 600 }}>→ {intel.action}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* S3: DUAL COMPS */}
        {activeSystem === "comps" && (
          <div>
            <Card color="rgba(139,92,246,0.04)" border="1px solid rgba(139,92,246,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 3 — ITEM 5</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{DUAL_COMPS.overview}</div>
            </Card>

            {[DUAL_COMPS.lens_1, DUAL_COMPS.lens_2].map((lens, li) => (
              <div key={li}>
                <Divider label={lens.name} color="#8b5cf6" />
                <Card color={li === 0 ? "rgba(139,92,246,0.03)" : "rgba(139,92,246,0.06)"} border={`1px solid rgba(139,92,246,${li === 0 ? 0.1 : 0.15})`}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6", marginBottom: 4 }}>{lens.scope}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 10 }}>{lens.purpose}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
                    {lens.selection_criteria.map((c, j) => (
                      <span key={j} style={{ fontSize: 10, color: "#cbd5e1", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 5, lineHeight: 1.4 }}>{c}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 8 }}>PATTERN ANALYSIS</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {lens.pattern_analysis.map((p, j) => (
                      <div key={j} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, borderLeft: "3px solid rgba(139,92,246,0.3)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{p.pattern}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, marginBottom: 6 }}>{p.detection}</div>
                        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>→ {p.action}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ))}

            <Card color="rgba(255,255,255,0.04)" border="1px solid rgba(139,92,246,0.2)" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", marginBottom: 4 }}>COLLISION OUTPUT — When Both Lenses Converge</div>
              <div style={{ fontSize: 12, color: "#f8fafc", lineHeight: 1.7 }}>{DUAL_COMPS.collision_output}</div>
            </Card>
          </div>
        )}

        {/* S4: PATTERN RECOGNITION ENGINE */}
        {activeSystem === "patterns" && (
          <div>
            <Card color="rgba(245,158,11,0.04)" border="1px solid rgba(245,158,11,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 4 — ITEMS 6, 10, 11, 13</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{PATTERN_ENGINE.overview}</div>
            </Card>

            {PATTERN_ENGINE.pattern_categories.map((cat) => (
              <div key={cat.id}>
                <Divider label={cat.name.toUpperCase()} color={cat.color} />
                <Card color={`${cat.color}05`} border={`1px solid ${cat.color}15`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Pill color={cat.color}>{cat.id}</Pill>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{cat.data_source}</span>
                  </div>

                  {cat.extraction_pipeline && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 6 }}>EXTRACTION PIPELINE</div>
                      {cat.extraction_pipeline.map((step, j) => (
                        <div key={j} style={{ fontSize: 10, color: "#94a3b8", padding: "3px 0", borderLeft: `2px solid ${cat.color}20`, paddingLeft: 10, marginBottom: 2 }}>
                          <span style={{ color: cat.color, fontWeight: 700 }}>{j + 1}.</span> {step}
                        </div>
                      ))}
                    </div>
                  )}

                  {cat.methodology && <Code color={cat.color}>{cat.methodology}</Code>}

                  <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", margin: "14px 0 8px" }}>PATTERNS DETECTED</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {cat.patterns_detected.map((p, j) => (
                      <div key={j} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 12, borderLeft: `3px solid ${cat.color}30` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{p.pattern}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: "#64748b" }}>How:</strong> {p.how}</div>
                        <div style={{ fontSize: 10, color: cat.color, fontWeight: 600 }}>Value: {p.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* S5: PREDICTIVE POSITIONING (reuses S1 Rank-Me content) */}
        {activeSystem === "projection" && (
          <div>
            <Card color="rgba(239,68,68,0.04)" border="1px solid rgba(239,68,68,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 5 — ITEMS 7, 8</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
                Two capabilities: (7) Project where a new deal or redevelopment would rank in the market BEFORE you buy it, and (8) reverse-engineer what it takes to reach a target rank. Together they answer: "Is this deal worth buying, and what do I need to do after I buy it?"
              </div>
            </Card>

            <Divider label="PREDICTIVE RANK PROJECTION" color="#ef4444" />
            <Card>
              <Code color="#ef4444">{`PROJECTED RANK = model(
  subject_traffic_position,    // From M07 — where it sits in traffic hierarchy
  planned_renovations,         // User-input CapEx scope → asset quality delta
  target_rent_after_reposition,// User-input post-renovation rent target
  management_quality_assumed,  // User selects: current manager vs new manager
  market_trajectory            // From Market Lifecycle Detection — is the submarket rising or falling?
)

EXAMPLE:
  Subject property currently ranked #28 of 41
  After $1.8M renovation + new management + $125/unit rent increase:
  PROJECTED RANK: #9 (±3 positions, 80% confidence)

  To reach #9 from #28:
    Traffic position: Can't change (location fixed) — already at #11 for traffic
    Revenue gap: +$125/unit closes to #7 for revenue
    Ops gap: New manager (projected 4.2 stars) → #6 for ops quality
    Asset gap: $1.8M renovation → #12 for asset quality
    Bottleneck: Asset quality remains the drag — consider $2.2M scope to reach #8 on assets

  WHAT RANK #9 MEANS FOR YOUR RETURNS:
    Average NOI for Rank #5-10 properties: $1.42M
    Your projected NOI post-reposition: $1.38M
    Exit cap rate for Rank #5-10: 5.2% (vs 5.8% for #25-30)
    Value impact: +$1.6M in exit valuation from ranking improvement alone`}</Code>
            </Card>

            <Divider label="REDEVELOPMENT/REPOSITIONING SIMULATOR" color="#ef4444" />
            <Card color="rgba(239,68,68,0.04)" border="1px solid rgba(239,68,68,0.12)">
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>How Rank Projection Integrates with Strategy Arbitrage</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { strategy: "🏗️ BTS", projection: "New construction enters market at projected rank based on planned specs. 'A 200-unit Class A with these amenities would rank #2 in this submarket. There are currently 0 Class A properties — you'd CREATE the top tier.'" },
                  { strategy: "🔄 Flip", projection: "'Buy at rank #34, reposition to rank #12 in 18 months. The rank improvement from #34 → #12 historically corresponds to 35-50% value appreciation in this submarket.'" },
                  { strategy: "🏠 Rental", projection: "'This property currently ranks #8. Market trajectory is Acceleration. Projected rank in 24 months with no changes: #6 (rising tide lifts this boat). With $400K in targeted improvements: #3.'" },
                  { strategy: "🏨 STR", projection: "'As an STR, this property would rank #4 in the vacation rental competitive set based on location + traffic position. ADR projection based on rank: $185/night (top quartile commands $210).'" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{item.strategy}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{item.projection}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* S6: ALERTS */}
        {activeSystem === "alerts" && (
          <div>
            <Card color="rgba(6,182,212,0.04)" border="1px solid rgba(6,182,212,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 6 — ITEM 9</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{ALERT_SYSTEM.overview}</div>
            </Card>

            <Divider label="ALERT TYPES" color="#06b6d4" />
            <div style={{ display: "grid", gap: 10 }}>
              {ALERT_SYSTEM.alert_types.map((alert, i) => (
                <div
                  key={i}
                  onClick={() => toggle(`alert-${i}`)}
                  style={{
                    background: expandedSection === `alert-${i}` ? `${alert.color}06` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${expandedSection === `alert-${i}` ? `${alert.color}25` : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10, padding: 16, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{alert.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: alert.color }}>{alert.name}</span>
                    <Pill color={alert.color}>{alert.urgency}</Pill>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#475569" }}>{expandedSection === `alert-${i}` ? "▲" : "▼"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}><strong style={{ color: "#94a3b8" }}>Trigger:</strong> {alert.trigger}</div>

                  {expandedSection === `alert-${i}` && (
                    <div style={{ marginTop: 12, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: 8 }}>EXAMPLE ALERT</div>
                      <pre style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
                        color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap",
                      }}>{alert.example_alert}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Divider label="DELIVERY CHANNELS" color="#06b6d4" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {ALERT_SYSTEM.delivery.map((d, i) => (
                <Card key={i}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{d.channel}</div>
                  <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.5 }}>{d.frequency}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* S7: DATA FLYWHEEL */}
        {activeSystem === "flywheel" && (
          <div>
            <Card color="rgba(236,72,153,0.04)" border="1px solid rgba(236,72,153,0.15)">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", letterSpacing: "0.05em", marginBottom: 6 }}>SYSTEM 7 — ITEMS 12, 14</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{DATA_FLYWHEEL.underwriting_archive.concept}</div>
            </Card>

            <Divider label="UNDERWRITING INTELLIGENCE ARCHIVE" color="#ec4899" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>What Gets Captured</div>
                {DATA_FLYWHEEL.underwriting_archive.what_to_capture.map((item, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6, lineHeight: 1.5 }}>
                    <strong style={{ color: "#ec4899" }}>{item.field}:</strong> {item.data}
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>Intelligence Outputs</div>
                {DATA_FLYWHEEL.underwriting_archive.intelligence_outputs.map((out, i) => (
                  <div key={i} style={{
                    fontSize: 10, color: "#cbd5e1", lineHeight: 1.5,
                    background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "8px 10px", marginBottom: 6,
                    borderLeft: "2px solid rgba(236,72,153,0.3)",
                  }}>{out}</div>
                ))}
              </Card>
            </div>

            <Divider label="PROPERTY RECORDS INTELLIGENCE EXTRACTION" color="#ec4899" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DATA_FLYWHEEL.property_records_intelligence.extractions.map((cat, i) => (
                <Card key={i}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ec4899", marginBottom: 8 }}>{cat.category}</div>
                  {cat.signals.map((sig, j) => (
                    <div key={j} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#f8fafc", marginBottom: 2 }}>{sig.signal}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>{sig.insight}</div>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ═══ MASTER CONNECTION MAP — ALWAYS VISIBLE ═══ */}
        <Divider label="MASTER CONNECTION MAP — HOW ALL 7 SYSTEMS INTERCONNECT" color="#94a3b8" />
        <div style={{ display: "grid", gap: 6, marginBottom: 32 }}>
          {CONNECTION_MAP.map((conn, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "200px 20px 200px 1fr", gap: 10,
              background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 8, padding: "8px 14px", alignItems: "center",
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#3b82f6", fontFamily: "'JetBrains Mono', monospace" }}>{conn.from}</span>
              <span style={{ fontSize: 12, color: "#334155", textAlign: "center" }}>→</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{conn.to}</span>
              <span style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>{conn.signal}</span>
            </div>
          ))}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          textAlign: "center", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: 9, color: "#1e293b",
        }}>
          JEDI RE · Competitive Intelligence & Opportunity Engine v1 · Extends Traffic Intelligence Framework
          <br />
          14 Capabilities · 7 Systems · Feeds M25 JEDI Score, M08 Strategy Arbitrage, M09 ProForma, M14 Risk Engine
        </div>

      </div>
    </div>
  );
}
