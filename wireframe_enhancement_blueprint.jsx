import { useState } from "react";

/*
  JEDI RE — Wireframe Enhancement Blueprint
  
  Design principle: Every UI element must answer three questions:
  1. WHAT is happening? (data)
  2. WHY does it matter? (insight) 
  3. WHAT should I do? (action)
  
  Pattern: Raw Data → Compressed Signal → Verdict → Recommended Action
*/

const MODULES = [
  {
    id: "overview",
    name: "Deal Overview",
    moduleId: "M01",
    icon: "◉",
    decision: "Should I spend 5 more minutes on this deal?",
    currentState: {
      description: "Shows deal name, type, stage badge, and a generic analysis status poller. No scores, no signals, no recommendations.",
      elements: ["Deal name + address", "Project type label", "Stage badge", "Analysis progress spinner", "Back to deals button"],
      problem: "A user opens a deal and sees... a loading spinner and basic labels. Nothing tells them whether this deal is worth their time. They have to click through 15 sections to figure that out."
    },
    enhanced: {
      description: "Single-glance intelligence: JEDI Score verdict, strategy recommendation, top risk, and the ONE thing that makes this deal interesting.",
      sections: [
        {
          name: "JEDI Score Hero",
          layout: "Top-left, large circular gauge",
          dataPoints: [
            { field: "JEDI Score", formula: "F01: (D×0.30)+(S×0.25)+(M×0.20)+(P×0.15)+(R×0.10)", source: "M25 → jedi-score.service.ts", example: "82/100" },
            { field: "Score Delta", formula: "current_score - score_30d_ago", source: "JEDI score history table", example: "+4 pts (30d)" },
            { field: "Verdict", formula: "≥85: Strong Opportunity, 70-84: Opportunity, 55-69: Neutral, <55: Caution", source: "Derived from score", example: "OPPORTUNITY ↑" },
            { field: "Confidence", formula: "data_completeness_pct × source_quality_avg", source: "Count of non-null data fields", example: "High (87%)" },
          ],
          actionableInsight: "Score trending UP +4pts because 2 demand events hit this trade area in 30 days. Confidence is high because 4/5 signal sources have fresh data.",
          userAction: "Click score → drill into 5 sub-score breakdown. Click delta → see what events caused the change."
        },
        {
          name: "5-Signal Breakdown Bar",
          layout: "Horizontal stacked bar below score gauge",
          dataPoints: [
            { field: "Demand (30%)", formula: "F02: Σ(event_impact × confidence × distance_decay) / normalizer", source: "M06 demand-signal.service", example: "88" },
            { field: "Supply (25%)", formula: "F03: 100 - (pipeline_units / (existing × absorption × 12) × 100)", source: "M04 supply-signal.service", example: "72" },
            { field: "Momentum (20%)", formula: "F04: rent_growth_pctl×0.4 + txn_velocity_pctl×0.3 + sentiment×0.3", source: "M05 market data", example: "85" },
            { field: "Position (15%)", formula: "F05: submarket_rank×0.5 + amenity×0.25 + comp_position×0.25", source: "M05 + M15", example: "79" },
            { field: "Risk (10%)", formula: "F06: 100 - composite_risk_score (inverted — lower risk = higher score)", source: "M14 risk-scoring.service", example: "81" },
          ],
          actionableInsight: "Supply is the weakest signal (72) because 1,200 units are in the pipeline within 3 miles. But Demand is strong (88) because Amazon announced 2,000 jobs. Net: demand is absorbing the supply risk.",
          userAction: "Click any signal bar → jump to that module's detail tab. Red-highlight the lowest signal — that's where the risk lives."
        },
        {
          name: "Strategy Verdict Card",
          layout: "Right side, prominent card",
          dataPoints: [
            { field: "Recommended Strategy", formula: "F23: argmax(strategy_scores[BTS, Flip, Rental, STR])", source: "M08 Strategy Arbitrage", example: "Build-to-Sell" },
            { field: "Strategy Score", formula: "F23: Σ(signal_score × strategy_weight) per strategy", source: "M08 × Strategy Matrix weights", example: "BTS: 84, Rental: 69" },
            { field: "Arbitrage Flag", formula: "F24: max_score - second_max > 15 AND max > 70", source: "M08", example: "⚡ +15pt BTS advantage" },
            { field: "ROI Estimate", formula: "F25: BTS yield_on_cost = stabilized_NOI / total_dev_cost", source: "M08 + M09", example: "7.2% yield on cost" },
          ],
          actionableInsight: "Platform says Build-to-Sell scores 15 points above Rental for this parcel. Zoning allows 3x current density. Most brokers would pitch this as a rental value-add — you'd miss the development upside.",
          userAction: "Click → Strategy Arbitrage tab with full 4-column comparison. 'Generate Strategy Memo' button for LP/investor presentation."
        },
        {
          name: "Top Risk Alert",
          layout: "Bottom banner, conditional (only shows if risk > threshold)",
          dataPoints: [
            { field: "Highest Risk Category", formula: "argmax(supply_risk, demand_risk, regulatory, market, execution, climate)", source: "M14", example: "Supply Risk: 68/100" },
            { field: "Risk Detail", formula: "Context-specific sentence from risk factors", source: "M14 risk scoring", example: "1,200 units delivering 2026-2027 within 3mi" },
            { field: "Mitigation Available", formula: "Boolean: does the deal have offsetting signals?", source: "Cross-reference demand vs supply", example: "Yes: demand absorption rate exceeds pipeline" },
          ],
          actionableInsight: "⚠️ Supply Risk is elevated (68) — but don't panic. Demand signals show absorption is running 1.3x the pipeline rate. Net supply pressure: MANAGEABLE.",
          userAction: "Click → Risk Dashboard drill-down. Shows risk trend over time and what events drove it up."
        },
        {
          name: "Quick Stats Grid",
          layout: "4-column metrics bar",
          dataPoints: [
            { field: "Price/Unit", formula: "asking_price / units", source: "Deal data", example: "$160,714" },
            { field: "vs Submarket Median", formula: "(price_per_unit - submarket_median) / submarket_median × 100", source: "M05 + M15", example: "12% above" },
            { field: "Cap Rate (Going-In)", formula: "F17: NOI / purchase_price", source: "M09", example: "6.0%" },
            { field: "Days in Pipeline", formula: "today - deal_created_at", source: "Deal data", example: "23 days (LOI stage)" },
          ],
          actionableInsight: "Price/unit is 12% above submarket median but cap rate is in line — suggesting the market is pricing in the Buckhead premium correctly. No hidden discount here.",
          userAction: "Click any metric → jumps to relevant module. Price/unit → Competition tab. Cap rate → Financial tab."
        }
      ]
    }
  },
  {
    id: "strategy",
    name: "Strategy Arbitrage",
    moduleId: "M08",
    icon: "◈",
    decision: "Which of the 4 strategies maximizes my return on THIS property?",
    currentState: {
      description: "Shows generic 'value-add' strategy cards with hardcoded mock data. No 4-strategy comparison. No arbitrage detection.",
      elements: ["Single strategy selection dropdown", "Generic ROI projections from mock data", "Implementation task checklist", "Risk factors (hardcoded)", "Exit scenarios (hardcoded)"],
      problem: "This is supposed to be THE differentiator — analyzing all 4 strategies simultaneously. Instead it shows a static value-add plan that could apply to any property. A user can't see that Build-to-Sell scores 15 points higher than Rental."
    },
    enhanced: {
      description: "4-column strategy comparison matrix with signal-level detail, ROI head-to-head, and arbitrage alerts when one strategy dramatically outperforms others.",
      sections: [
        {
          name: "4-Strategy Score Matrix",
          layout: "4-column comparison table — the centerpiece of the entire platform",
          dataPoints: [
            { field: "BTS Score", formula: "F23: demand×0.30 + supply×0.25 + momentum×0.20 + position×0.15 + risk×0.10 (using BTS-specific weights from Strategy Matrix)", source: "M08 × Sheet 6 weights", example: "84" },
            { field: "Flip Score", formula: "F23 with Flip weights: demand×0.15 + supply×0.20 + momentum×0.30 + position×0.20 + risk×0.15", source: "M08 × Sheet 6", example: "58" },
            { field: "Rental Score", formula: "F23 with Rental weights: same JEDI weights", source: "M08 × Sheet 6", example: "69" },
            { field: "STR Score", formula: "F23 with STR weights: demand×0.25 + supply×0.20 + momentum×0.25 + position×0.20 + risk×0.10", source: "M08 × Sheet 6", example: "45" },
          ],
          actionableInsight: "Build-to-Sell scores 84 vs Rental at 69 — a 15-point gap that flags an Arbitrage Opportunity. Why? Zoning allows 3x density (M02), supply pipeline is thin for new construction (M04), and demand signals are strong (M06). Most investors would default to Rental — the platform sees the development play.",
          userAction: "Click any column header → expand to see signal-level breakdown. Click 'Why BTS?' → AI-generated narrative explaining the arbitrage. 'Run ProForma' button per strategy → M09."
        },
        {
          name: "Signal Heatmap (5 signals × 4 strategies)",
          layout: "Color-coded grid — green (favorable) to red (unfavorable)",
          dataPoints: [
            { field: "Demand × BTS", formula: "demand_score × BTS_demand_weight (0.30)", source: "Strategy Matrix Integration tab", example: "26.4 (strong: absorption > pipeline)" },
            { field: "Supply × BTS", formula: "supply_score × BTS_supply_weight (0.25)", source: "Strategy Matrix", example: "18.0 (favorable: low permit activity)" },
            { field: "Demand × Flip", formula: "demand_score × Flip_demand_weight (0.15)", source: "Strategy Matrix", example: "13.2 (moderate)" },
            { field: "Momentum × Flip", formula: "momentum_score × Flip_momentum_weight (0.30)", source: "Strategy Matrix", example: "25.5 (strong: DOM declining)" },
          ],
          actionableInsight: "The heatmap instantly shows WHERE each strategy wins and loses. BTS dominates Demand+Supply cells. Flip wins on Momentum. Rental is mediocre across all signals. STR is killed by regulatory risk (Atlanta STR restrictions).",
          userAction: "Hover any cell → tooltip shows the underlying indicator (e.g., 'Demand × BTS = 26.4 because absorption rate 1.3x exceeds supply pipeline'). Click cell → jump to source module."
        },
        {
          name: "ROI Head-to-Head",
          layout: "Bar chart comparing key return metrics across strategies",
          dataPoints: [
            { field: "BTS Yield on Cost", formula: "F25: stabilized_NOI / total_development_cost", source: "M09 BTS proforma", example: "7.2%" },
            { field: "Flip Profit Margin", formula: "F25: (ARV - acquisition - rehab) / (acquisition + rehab)", source: "M09 Flip proforma", example: "18% (but timeline risk)" },
            { field: "Rental CoC Return", formula: "F25: BTCF / equity = F18", source: "M09 Rental proforma", example: "8.5% year 1" },
            { field: "STR RevPAR Premium", formula: "F25: STR_annual_revenue / (long_term_rent × 12) - 1", source: "M09 STR proforma", example: "1.4x (but 40% risk of regulation)" },
          ],
          actionableInsight: "BTS yields 7.2% on cost with a 24-month exit to institutional buyer. Rental gives 8.5% CoC but ties up capital for 7+ years. Risk-adjusted, BTS wins because you recycle capital 3x faster.",
          userAction: "'Compare in ProForma' button → opens side-by-side proforma for top 2 strategies. 'Generate Deal Memo' → exports strategy recommendation with evidence."
        },
        {
          name: "Arbitrage Alert Banner",
          layout: "Conditional banner — only appears when arbitrage detected (F24)",
          dataPoints: [
            { field: "Arbitrage Delta", formula: "F24: max(scores) - second_max(scores)", source: "M08", example: "15 points" },
            { field: "Recommended vs Default", formula: "Platform recommendation vs what a typical investor would assume", source: "Strategy Matrix Decision Framework", example: "BTS recommended vs typical Rental assumption" },
            { field: "Missed ROI", formula: "recommended_roi - default_roi", source: "M09 comparative", example: "~210bps yield difference" },
          ],
          actionableInsight: "⚡ ARBITRAGE DETECTED: Build-to-Sell outscores Rental by 15 points. If you default to the typical rental value-add play, you're leaving ~210bps of yield on the table. The zoning unlock is the key — most investors won't see it.",
          userAction: "Click 'Explore Arbitrage' → guided walkthrough: (1) Zoning shows 3x density potential, (2) Supply pipeline is thin, (3) Development cost estimates from M03. 'Share with Team' button."
        }
      ]
    }
  },
  {
    id: "proforma",
    name: "Pro Forma Engine",
    moduleId: "M09",
    icon: "◆",
    decision: "Do the numbers work? What assumptions am I betting on?",
    currentState: {
      description: "DesignToFinancialService that imports from 3D design module. Has financial targets but no connection to market intelligence. All assumptions are user-entered.",
      elements: ["Import from Design Dashboard button", "Financial targets (hardcoded)", "Basic proforma calculation", "Comparison view toggle"],
      problem: "The proforma lives in a vacuum. User manually enters rent growth, vacancy, exit cap — with no guidance from the platform's intelligence. The whole point of JEDI RE is that market signals AUTO-ADJUST these assumptions."
    },
    enhanced: {
      description: "Three-layer proforma: Baseline (historical) → Platform-Adjusted (news/signal driven) → User Override. Every assumption shows its source and confidence level.",
      sections: [
        {
          name: "Assumption Panel (3-Layer)",
          layout: "Left sidebar — every assumption has 3 values visible",
          dataPoints: [
            { field: "Rent Growth — Baseline", formula: "3-year historical average from market data", source: "M05 apartments.com scraper", example: "3.2%" },
            { field: "Rent Growth — Platform Adjusted", formula: "F32: baseline + Σ(event_rent_impact × confidence)", source: "M06 demand events → proforma-adjustment.service", example: "4.1% (+0.9% from Amazon HQ demand)" },
            { field: "Rent Growth — User Override", formula: "User's manual input (if they disagree)", source: "User input (blue text)", example: "3.5% (conservative)" },
            { field: "Vacancy — Baseline", formula: "Current submarket vacancy", source: "M05 market data", example: "5.8%" },
            { field: "Vacancy — Platform Adjusted", formula: "F33: baseline - (net_demand / existing × sensitivity)", source: "M06 + M04 net demand", example: "4.9% (demand absorbing)" },
            { field: "Exit Cap — Baseline", formula: "Trailing 12mo avg transaction cap rate in submarket", source: "M05 + M15 comp sales", example: "5.5%" },
          ],
          actionableInsight: "Platform sees 0.9% rent growth upside vs historical because of the Amazon demand event. But it also sees 1,200 pipeline units that could slow absorption. Net adjustment: +0.9% rent, -0.9% vacancy. Your override of 3.5% rent growth is 60bps below platform — are you being too conservative?",
          userAction: "Click any assumption → see the events/data that drove the adjustment. Toggle 'Use Platform' vs 'Use Override' per assumption. Yellow highlight when user override deviates >100bps from platform."
        },
        {
          name: "Income Statement Grid (10-Year)",
          layout: "Central spreadsheet grid with conditional formatting",
          dataPoints: [
            { field: "NOI (Year 1-10)", formula: "F16: EGI - OpEx, where EGI = units × rent × 12 × (1-vacancy) + other_income", source: "Auto-calculated from assumptions", example: "Y1: $2.7M → Y10: $3.9M" },
            { field: "Cash Flow After Debt", formula: "NOI - annual_debt_service (F21 DSCR inverse)", source: "M11 debt terms", example: "Y1: $1.1M" },
            { field: "Cumulative Return", formula: "Running sum of cash flows + exit value at each year", source: "M09 + M12", example: "Breakeven: Year 4" },
          ],
          actionableInsight: "Columns are color-coded: black = formula, blue = user input, green = cross-module link. A red cell means that assumption is >1 std dev from market data — forcing the user to acknowledge the risk.",
          userAction: "Click any cell → see formula + source. Right-click → 'What if this changes ±10%?' sensitivity test. Toggle 'Baseline | Platform | Override' columns."
        },
        {
          name: "Returns Summary Card",
          layout: "Bottom bar with 5 key return metrics",
          dataPoints: [
            { field: "IRR", formula: "F19: solve for r in NPV equation", source: "M09 cash flows + exit", example: "16.8%" },
            { field: "Equity Multiple", formula: "F20: (distributions + exit) / equity", source: "M09", example: "2.1x" },
            { field: "Cash-on-Cash (Y1)", formula: "F18: BTCF / equity", source: "M09", example: "8.5%" },
            { field: "DSCR (Min)", formula: "F21: min(NOI_y / debt_service_y) across hold period", source: "M11", example: "1.32x (Year 1)" },
            { field: "Probability-Weighted IRR", formula: "F31: Σ(scenario_prob × scenario_irr)", source: "M10 scenarios", example: "14.2% (risk-adjusted)" },
          ],
          actionableInsight: "Base case IRR is 16.8%, but probability-weighted drops to 14.2% because Bear scenario (supply glut) has 25% probability. The 2.6% gap IS your risk premium. Is 14.2% above your hurdle rate?",
          userAction: "'Does this beat my hurdle?' — compare to user's target IRR from settings. Green check or red X. 'Run Scenarios' → M10. 'Export to Excel' with formulas intact."
        }
      ]
    }
  },
  {
    id: "supply",
    name: "Supply Pipeline",
    moduleId: "M04",
    icon: "▲",
    decision: "Will new supply crush my rents or is the market absorbing it?",
    currentState: {
      description: "Shows pipeline projects from supplyMockData.ts with status filters and distance sorting. Has supply pressure stats but all hardcoded.",
      elements: ["Pipeline project list (mock)", "Status filter (permitted/UC/delivered)", "Supply stats cards (mock)", "Distance-based sorting"],
      problem: "Good structure but dead data. The Supply Agent exists in the backend. The real question isn't 'how many units are in the pipeline' — it's 'can the market absorb them before they hurt my deal?'"
    },
    enhanced: {
      description: "Supply pressure gauge with absorption context. Every pipeline project shows: when it delivers, how it competes with YOUR deal, and whether demand signals offset it.",
      sections: [
        {
          name: "Supply Pressure Gauge",
          layout: "Hero metric — large gauge with context",
          dataPoints: [
            { field: "Supply Pressure Ratio", formula: "F07: pipeline_units / (existing × annual_absorption)", source: "M04 supply-signal.service", example: "0.85x (manageable)" },
            { field: "Months of Supply", formula: "F08: pipeline_units / monthly_absorption", source: "M04", example: "14 months" },
            { field: "Net Absorption Context", formula: "demand_units_projected - pipeline_units (from M06)", source: "M04 + M06 cross-reference", example: "+320 units net positive" },
          ],
          actionableInsight: "1,200 units in pipeline sounds scary — but at current absorption (85 units/month), the market clears them in 14 months. Plus demand signals project 1,520 new households — net 320 units of EXCESS demand. Supply pressure is MANAGEABLE.",
          userAction: "Click gauge → timeline view showing quarterly deliveries vs projected absorption. Red zones where supply > demand in any quarter."
        },
        {
          name: "Competitive Project Cards",
          layout: "Sortable cards with threat assessment",
          dataPoints: [
            { field: "Direct Competitor Flag", formula: "same_price_tier AND distance < 2mi AND delivering < 18mo", source: "M04 + M15", example: "⚠️ 2 of 5 projects are direct competitors" },
            { field: "Delivery Timeline", formula: "expected_delivery - today", source: "M04 permit/construction data", example: "Q3 2027 (14 months)" },
            { field: "Price Tier Overlap", formula: "Compare avg_rent of pipeline project to subject property ±15%", source: "M04 + M05", example: "Same tier: $1,800-2,100/mo" },
            { field: "Threat Score", formula: "distance_weight × price_overlap × size_factor × timing", source: "M04 derived", example: "High / Medium / Low" },
          ],
          actionableInsight: "Of 5 pipeline projects, only 2 directly compete (same price tier, <2mi, delivering before your stabilization). The 350-unit luxury tower 4mi away? Different tenant pool — ignore it.",
          userAction: "Click project → map pins show location relative to your deal. 'Track This Project' → get alerts on status changes. Filter by threat level."
        }
      ]
    }
  },
  {
    id: "market",
    name: "Market Analysis",
    moduleId: "M05",
    icon: "●",
    decision: "Is this submarket getting stronger or weaker — and how fast?",
    currentState: {
      description: "Shows demographics, SWOT, sentiment, and submarket comparisons from marketMockData.ts. Dual-mode for acquisition vs performance. All mock data.",
      elements: ["Demographics grid (mock)", "Market trends (mock)", "SWOT analysis (mock)", "Submarket comparison table (mock)", "Market sentiment gauge (mock)"],
      problem: "Lots of data categories but no 'so what.' A SWOT analysis with 'Strong demand drivers' doesn't tell you HOW MUCH demand or how it compares to supply. The market data needs to be quantified and contextualized."
    },
    enhanced: {
      description: "Submarket vitals with trend context, competitor benchmarking, and direct implications for YOUR deal's proforma assumptions.",
      sections: [
        {
          name: "Market Vitals Dashboard",
          layout: "5-metric strip with sparkline trends",
          dataPoints: [
            { field: "Avg Effective Rent", formula: "Weighted avg from comp set", source: "M05 apartments.com + RentCast", example: "$1,825/mo (+3.2% YoY)" },
            { field: "Vacancy Rate", formula: "Vacant units / total units in trade area", source: "M05 apartments.com scraper", example: "5.8% (↓ from 6.4% 12mo ago)" },
            { field: "Absorption Rate", formula: "Net units absorbed / total units per quarter", source: "M05 quarterly calc", example: "255 units/quarter" },
            { field: "Rent Growth Trend", formula: "12-month rolling average rent change", source: "M05 time series", example: "+3.2% (accelerating from +2.8%)" },
            { field: "Submarket Rank", formula: "F26: percentile_rank(rent_growth×0.3 + absorption×0.25 + vacancy_inv×0.25 + pop_growth×0.2)", source: "M05 comparative", example: "78th percentile (top quartile)" },
          ],
          actionableInsight: "This submarket ranks in the 78th percentile — top quartile. Vacancy is trending DOWN (good), rent growth is ACCELERATING (great), and absorption is steady at 255 units/quarter. Momentum signal: STRONG.",
          userAction: "Click any metric → 24-month trend chart. 'Push to ProForma' button → auto-populates M09 rent growth and vacancy assumptions with market data. User can still override."
        },
        {
          name: "Rent Comp Grid (Subject vs Comps)",
          layout: "Table with subject property highlighted",
          dataPoints: [
            { field: "Subject Rent Premium/Discount", formula: "F27: (subject_rent - avg_comp_rent) / avg_comp_rent × 100", source: "M05 + M15", example: "+1.4% premium (justified by newer build)" },
            { field: "Amenity Gap Score", formula: "Count of amenities subject has vs comp set", source: "M15 competition analysis", example: "Subject: 8/10 amenities, Avg comp: 6/10" },
            { field: "Rent Upside Estimate", formula: "If comp has amenity + higher rent AND subject could add amenity → upside", source: "M15 + M05", example: "$75/unit if add package lockers + dog park" },
          ],
          actionableInsight: "Your deal commands a 1.4% rent premium — justified by the 2018 build year. But comps with package lockers and dog parks get $75/unit MORE. That's a $252K/year NOI boost for a $180K capital investment. 1.4x return on capex.",
          userAction: "Click 'Value-Add Opportunities' → list of amenity/renovation gaps with estimated rent lift and capex cost. Direct feed to M09 proforma as value-add assumptions."
        }
      ]
    }
  },
  {
    id: "risk",
    name: "Risk Dashboard",
    moduleId: "M14",
    icon: "◇",
    decision: "What could kill this deal and how do I protect against it?",
    currentState: {
      description: "Risk scoring service exists in backend with supply risk and demand risk implemented. UI shows in Overview tab as a section. Phase 3 categories (regulatory, market, execution, climate) are placeholders.",
      elements: ["Composite risk score (from service)", "6-category breakdown (2 real, 4 placeholder)", "Risk level badges"],
      problem: "Risk data exists but isn't ACTIONABLE. Knowing 'supply risk is 68' doesn't help unless you know: (1) what's driving it, (2) whether it's getting worse, (3) what offsets it, and (4) what to do about it."
    },
    enhanced: {
      description: "Risk heatmap with drill-down, trend tracking, offsetting factors, and specific mitigation actions per risk category.",
      sections: [
        {
          name: "Risk Heatmap (6 categories)",
          layout: "2×3 grid of risk cards, colored by severity",
          dataPoints: [
            { field: "Supply Risk (35%)", formula: "F09: base(months_to_absorb×10) + escalations - de-escalations", source: "M04 supply pipeline", example: "68 — Elevated ⚠️" },
            { field: "Demand Risk (35%)", formula: "Employer concentration + demand driver diversity", source: "M06 demand signals", example: "32 — Low ✓" },
            { field: "Regulatory Risk (10%)", formula: "Zoning change probability + entitlement timeline risk", source: "M02 zoning agent", example: "45 — Moderate" },
            { field: "Market Risk (10%)", formula: "Cap rate volatility + rent growth deceleration probability", source: "M05 market trends", example: "38 — Low ✓" },
            { field: "Execution Risk (5%)", formula: "Construction cost volatility + timeline overrun probability", source: "M03 development capacity", example: "55 — Moderate" },
            { field: "Climate Risk (5%)", formula: "Flood zone + hurricane + heat exposure", source: "FEMA + climate data", example: "28 — Low ✓" },
          ],
          actionableInsight: "Supply Risk is your #1 exposure. But look at the OFFSET: Demand Risk is only 32 because you have 3 diversified demand drivers (Amazon, Georgia Tech expansion, population migration). The demand-supply NET position is still positive.",
          userAction: "Click any risk card → drill-down showing: what's driving the score, trend (getting better/worse), offsetting factors, and 'What could change this?' scenarios."
        },
        {
          name: "Risk Trend & Alerts",
          layout: "Sparkline strip with alert thresholds",
          dataPoints: [
            { field: "30-Day Risk Trend", formula: "risk_score_today - risk_score_30d_ago per category", source: "Risk score history", example: "Supply risk: +8 (worsening), Demand risk: -5 (improving)" },
            { field: "Alert Threshold", formula: "User-defined: alert when any category > threshold", source: "M24 user settings", example: "Alert if Supply Risk > 70" },
            { field: "Mitigation Actions", formula: "Context-specific recommendations based on risk profile", source: "AI-generated from risk factors", example: "Consider accelerating closing to lock in before Q3 2027 deliveries" },
          ],
          actionableInsight: "Supply risk jumped +8 points this month because a new 280-unit permit was filed 1.5mi away. But demand risk IMPROVED by 5 because of the Georgia Tech expansion. Set an alert at 70 — if supply risk crosses that, revisit your underwriting.",
          userAction: "'Set Alert' button per category. 'Stress Test' → what happens to IRR if this risk materializes? Links to M10 Bear scenario."
        }
      ]
    }
  },
];

const FRAMEWORK_STEPS = [
  { step: 1, title: "Identify the Decision", description: "Every page exists to help the user make ONE specific decision. If you can't name the decision, the page shouldn't exist.", example: "Overview → 'Should I spend 5 more minutes on this deal?'" },
  { step: 2, title: "Map Data → Insight → Action", description: "Raw data is noise. Insights are data WITH context. Actions are insights WITH a next step. Every UI element needs all three layers.", example: "Data: '5.8% vacancy' → Insight: '120bps below submarket avg' → Action: 'Push to proforma as rent upside'" },
  { step: 3, title: "Wire the Formulas", description: "Each insight needs a specific formula (F01-F35) connecting it to real data sources. No formula = no insight = mock data forever.", example: "F07 Supply Pressure = pipeline / (existing × absorption) — this ONE formula drives the entire Supply tab's intelligence" },
  { step: 4, title: "Add Cross-Module Links", description: "Intelligence compounds when modules feed each other. Every metric should have a 'push to' and 'pull from' connection.", example: "Supply pressure (M04) → adjusts vacancy assumption (M09) → changes IRR (M09) → updates JEDI Score (M25)" },
  { step: 5, title: "Design the 'So What?' Layer", description: "After showing data + insight, always answer: 'compared to what?' and 'what should I do?' These are the sentences that make JEDI RE worth paying for.", example: "'Most investors would pitch Rental — platform sees BTS scores 15pts higher. You'd miss $2.1M in development upside.'" },
];

export default function WireframeBlueprint() {
  const [selectedModule, setSelectedModule] = useState(MODULES[0].id);
  const [showFramework, setShowFramework] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const mod = MODULES.find(m => m.id === selectedModule);

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#fafaf9", color: "#1c1917", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1c1917", color: "#fafaf9", padding: "20px 28px", borderBottom: "3px solid #b45309" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#b45309", letterSpacing: 4, marginBottom: 4 }}>WIREFRAME ENHANCEMENT BLUEPRINT</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Data → Insight → Action Framework</h1>
            <p style={{ fontSize: 12, color: "#a8a29e", marginTop: 4 }}>How to transform every JEDI RE module from passive data display to decision-driving intelligence</p>
          </div>
          <button
            onClick={() => setShowFramework(!showFramework)}
            style={{
              padding: "8px 18px", borderRadius: 6, border: "1px solid " + (showFramework ? "#b45309" : "#44403c"),
              background: showFramework ? "#b4530922" : "transparent", color: showFramework ? "#b45309" : "#a8a29e",
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono'"
            }}
          >
            {showFramework ? "Hide" : "Show"} 5-Step Framework
          </button>
        </div>

        {showFramework && (
          <div style={{ marginTop: 16, display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {FRAMEWORK_STEPS.map(s => (
              <div key={s.step} style={{ minWidth: 220, background: "#292524", border: "1px solid #44403c", borderRadius: 8, padding: "12px 14px", borderTop: "2px solid #b45309" }}>
                <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#b45309", marginBottom: 4 }}>STEP {s.step}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fafaf9", marginBottom: 6 }}>{s.title}</div>
                <p style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.5, marginBottom: 8 }}>{s.description}</p>
                <div style={{ fontSize: 10, color: "#78716c", fontStyle: "italic", borderTop: "1px solid #44403c", paddingTop: 6 }}>{s.example}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", height: showFramework ? "calc(100vh - 240px)" : "calc(100vh - 100px)" }}>
        {/* Module Sidebar */}
        <div style={{ width: 220, background: "#f5f5f4", borderRight: "1px solid #e7e5e4", overflowY: "auto" }}>
          <div style={{ padding: "12px 14px 6px", fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#78716c", letterSpacing: 2 }}>MODULES</div>
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedModule(m.id); setExpandedSection(null); }}
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px", border: "none", cursor: "pointer",
                background: selectedModule === m.id ? "#fff" : "transparent",
                borderRight: selectedModule === m.id ? "3px solid #b45309" : "3px solid transparent",
                transition: "all 0.12s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, color: selectedModule === m.id ? "#b45309" : "#a8a29e" }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: selectedModule === m.id ? 600 : 400, color: selectedModule === m.id ? "#1c1917" : "#78716c" }}>{m.name}</div>
                  <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: "#a8a29e" }}>{m.moduleId}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Main Content */}
        {mod && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
            {/* Decision Banner */}
            <div style={{ background: "#292524", color: "#fafaf9", borderRadius: 10, padding: "16px 20px", marginBottom: 20, borderLeft: "4px solid #b45309" }}>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#b45309", letterSpacing: 2, marginBottom: 4 }}>THE DECISION THIS PAGE DRIVES</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{mod.decision}</div>
            </div>

            {/* Current State */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#dc2626", letterSpacing: 2, marginBottom: 8 }}>❌ CURRENT STATE</div>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "14px 16px" }}>
                <p style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.6, marginBottom: 10 }}>{mod.currentState.description}</p>
                <div style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600, marginBottom: 6 }}>What the user currently sees:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {mod.currentState.elements.map((el, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, background: "#fee2e2", color: "#991b1b" }}>{el}</span>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#fee2e2", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>The Problem:</div>
                  <p style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.5 }}>{mod.currentState.problem}</p>
                </div>
              </div>
            </div>

            {/* Enhanced State */}
            <div>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#15803d", letterSpacing: 2, marginBottom: 8 }}>✓ ENHANCED WIREFRAME</div>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>{mod.enhanced.description}</p>
              </div>

              {mod.enhanced.sections.map((section, si) => (
                <div key={si} style={{ marginBottom: 12, border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                  <button
                    onClick={() => setExpandedSection(expandedSection === si ? null : si)}
                    style={{ width: "100%", textAlign: "left", padding: "14px 18px", border: "none", cursor: "pointer", background: expandedSection === si ? "#fffbeb" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.15s" }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1917" }}>{section.name}</div>
                      <div style={{ fontSize: 11, color: "#78716c", marginTop: 2 }}>Layout: {section.layout}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#a8a29e", background: "#f5f5f4", padding: "2px 8px", borderRadius: 4 }}>{section.dataPoints.length} data points</span>
                      <span style={{ fontSize: 16, color: "#a8a29e", transform: expandedSection === si ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                    </div>
                  </button>

                  {expandedSection === si && (
                    <div style={{ padding: "0 18px 18px", borderTop: "1px solid #e7e5e4" }}>
                      {/* Data Points Table */}
                      <div style={{ marginTop: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#78716c", letterSpacing: 1, marginBottom: 6 }}>DATA POINTS & FORMULAS</div>
                        <div style={{ border: "1px solid #e7e5e4", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 180px 100px", background: "#f5f5f4", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#78716c", fontFamily: "'JetBrains Mono'", borderBottom: "1px solid #e7e5e4" }}>
                            <span>Field</span><span>Formula</span><span>Source</span><span>Example</span>
                          </div>
                          {section.dataPoints.map((dp, di) => (
                            <div key={di} style={{ display: "grid", gridTemplateColumns: "180px 1fr 180px 100px", padding: "8px 10px", fontSize: 11, borderBottom: di < section.dataPoints.length - 1 ? "1px solid #f5f5f4" : "none", alignItems: "start" }}>
                              <span style={{ fontWeight: 500, color: "#1c1917" }}>{dp.field}</span>
                              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#78716c", lineHeight: 1.5 }}>{dp.formula}</span>
                              <span style={{ fontSize: 10, color: "#a8a29e" }}>{dp.source}</span>
                              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#b45309", fontWeight: 500 }}>{dp.example}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actionable Insight */}
                      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "12px 14px", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#92400e", letterSpacing: 1, marginBottom: 4 }}>💡 ACTIONABLE INSIGHT (what the user actually reads)</div>
                        <p style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6, fontStyle: "italic" }}>{section.actionableInsight}</p>
                      </div>

                      {/* User Action */}
                      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", color: "#1e40af", letterSpacing: 1, marginBottom: 4 }}>👆 USER ACTIONS (what they can do)</div>
                        <p style={{ fontSize: 12, color: "#1e3a8a", lineHeight: 1.6 }}>{section.userAction}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
