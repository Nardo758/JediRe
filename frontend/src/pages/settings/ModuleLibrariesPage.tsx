import { useState } from "react";

const LIBRARIES = [
  {
    id: "comp",
    name: "Comp Library",
    icon: "\u2B21",
    tagline: "Your deals become your edge",
    description: "Every owned asset's actuals become searchable, matchable comps. When you build a proforma for a new deal, the system finds the best expense, rent, and operations comps from YOUR portfolio — ranked by property type, proximity, vintage, and scale.",
    dbTables: ["comp_eligible_properties", "deal_monthly_actuals", "anonymized_comps"],
    moduleConnections: ["M09 ProForma", "M05 Market", "M08 Strategy", "M15 Competition"],
    sections: [
      {
        name: "Expense Comps",
        description: "Actual operating expenses from your owned assets, organized by line item. When M09 ProForma needs expense assumptions, it queries this library first.",
        fields: [
          { label: "Taxes/unit", example: "$1,420", source: "Deal: Parkway 290 (Monthly Actuals)" },
          { label: "Insurance/unit", example: "$680", source: "Deal: Parkway 290 (Monthly Actuals)" },
          { label: "Mgmt Fee %", example: "3.2%", source: "Deal: Parkway 290 (Monthly Actuals)" },
          { label: "R&M/unit", example: "$890", source: "Deal: Parkway 290 (Monthly Actuals)" },
          { label: "Total OpEx/unit", example: "$4,980", source: "Trailing 12 Average" },
        ],
        matchCriteria: "Property type + stories + vintage \u00B1 5yr + proximity + unit count \u00B1 30%",
        howItWorks: "User uploads monthly actuals \u2192 system indexes by property attributes \u2192 comp_eligible_properties materialized view refreshes nightly \u2192 ProForma queries on deal open \u2192 Layer 3 auto-populated"
      },
      {
        name: "Rent Comps",
        description: "Achieved rents from your portfolio vs asking rents. Reveals the gap between what brokers quote and what you actually collect.",
        fields: [
          { label: "Avg Rent Achieved", example: "$1,785/mo", source: "Rent roll upload" },
          { label: "Avg Rent PSF", example: "$1.92", source: "Calculated from rent roll" },
          { label: "Concession Rate", example: "4.2%", source: "Lease-up tracking" },
          { label: "Loss-to-Lease", example: "2.8%", source: "Market rent vs in-place" },
          { label: "Renewal Rate", example: "58%", source: "Lease expiration tracking" },
        ],
        matchCriteria: "Submarket + asset class + unit mix similarity + vintage",
        howItWorks: "Rent rolls uploaded monthly \u2192 system extracts unit-level rents \u2192 aggregates to property level \u2192 available as comp when proximity + type match"
      },
      {
        name: "Operations Comps",
        description: "Leasing velocity, turn costs, occupancy ramp \u2014 the operational metrics that make or break a proforma's accuracy.",
        fields: [
          { label: "Lease-up Velocity", example: "22 units/mo", source: "Leasing tracker" },
          { label: "Turn Cost", example: "$3,200/unit", source: "Maintenance records" },
          { label: "Days to Stabilize", example: "14 months", source: "Occupancy history" },
          { label: "Occupancy (Stabilized)", example: "94.2%", source: "Trailing 6mo avg" },
          { label: "Bad Debt %", example: "1.8%", source: "Collection records" },
        ],
        matchCriteria: "Property type + market cycle position + asset class",
        howItWorks: "Operations data uploaded \u2192 feeds proforma lease-up schedule and expense escalation \u2192 validated against predictions to improve model accuracy"
      }
    ],
    exampleQuery: {
      scenario: "You're underwriting a 3-story garden, 250 units, built 2022, in Frisco TX \u2014 2.1 miles from your Parkway 290 asset.",
      result: "Comp Library returns: Parkway 290 (score: 92/100) \u2014 same type, 280 units, built 2020, 2.1mi away, 18mo of actuals. OpEx: $4,980/unit. Also returns: Cedar Hills (score: 74) \u2014 garden 2-story, 180 units, built 2019, 4.8mi, 12mo actuals. OpEx: $5,340/unit.",
      proformaImpact: "Layer 3 auto-fills: $5,060/unit (weighted avg: 60% Parkway, 40% Cedar Hills). Broker's OM said $5,400 \u2014 you know from YOUR data that's 7% high. Confidence: HIGH."
    }
  },
  {
    id: "data",
    name: "Data Library",
    icon: "\u25C8",
    tagline: "One place for everything you've contributed",
    description: "Central repository for all user-contributed data: monthly actuals, rent rolls, traffic counts, construction budgets, lease abstracts. This is the raw material that feeds every other library. Upload once, use everywhere.",
    dbTables: ["deal_monthly_actuals", "deal_proforma_snapshots", "traffic_predictions", "training_datasets"],
    moduleConnections: ["M07 Traffic", "M09 ProForma", "M22 Portfolio", "M25 JEDI Score"],
    sections: [
      {
        name: "Monthly Financials",
        description: "Upload actual P&L by property by month. This is the core training data \u2014 every month you add makes predictions better for you AND for properties in that submarket.",
        fields: [
          { label: "Revenue (GPR, Vacancy, Concessions, Other)", example: "Auto-parsed from template", source: "Excel/CSV upload" },
          { label: "Expenses (8 categories)", example: "Mapped to standard chart of accounts", source: "Excel/CSV upload" },
          { label: "NOI", example: "Calculated: EGI - OpEx", source: "Derived" },
          { label: "Occupancy", example: "94.2%", source: "Unit-level or property-level" },
          { label: "Avg Rent", example: "$1,785", source: "From rent roll or summary" },
        ],
        matchCriteria: "N/A \u2014 this is input, not queried as comp directly",
        howItWorks: "Upload Excel \u2192 template mapper normalizes columns \u2192 writes to deal_monthly_actuals \u2192 triggers comp_eligible_properties refresh \u2192 triggers model retraining if threshold met"
      },
      {
        name: "Traffic & Leasing Data",
        description: "Walk-ins, tours, web leads, leases signed \u2014 the data that trains M07 Traffic Engine. More data = better predictions for every property in that submarket.",
        fields: [
          { label: "Walk-in Count", example: "47/week", source: "Property management system" },
          { label: "Tours Given", example: "31/week", source: "Leasing software" },
          { label: "Web Leads", example: "89/week", source: "ILS platforms" },
          { label: "Leases Signed", example: "8/week", source: "Lease management" },
          { label: "Traffic-to-Lease Ratio", example: "5.9:1", source: "Calculated" },
        ],
        matchCriteria: "N/A \u2014 feeds training pipeline",
        howItWorks: "Upload leasing reports \u2192 parsed into deal_monthly_actuals traffic columns \u2192 Traffic Engine compares predicted vs actual \u2192 adjusts model coefficients \u2192 confidence score increases for that submarket"
      },
      {
        name: "Construction & Development",
        description: "Hard costs, soft costs, timelines from your development projects. Feeds M03 Dev Capacity cost estimates and M09 BTS proformas.",
        fields: [
          { label: "Hard Cost/Unit", example: "$165,000", source: "GC draw schedule" },
          { label: "Soft Cost/Unit", example: "$28,000", source: "Development budget" },
          { label: "Land Cost/Unit", example: "$32,000", source: "Acquisition records" },
          { label: "Months to Deliver", example: "18", source: "Project timeline" },
          { label: "Cost Overrun %", example: "+8.2%", source: "Budget vs actual" },
        ],
        matchCriteria: "Property type + stories + geography + vintage",
        howItWorks: "Upload development budgets \u2192 system indexes construction costs by type/geography \u2192 feeds M03 development cost estimates \u2192 BTS strategy scoring in M08 gets real cost basis instead of market averages"
      }
    ],
    exampleQuery: {
      scenario: "You've uploaded 18 months of actuals for Parkway 290. Your leasing team logged 1,200 walk-ins and 190 leases over that period.",
      result: "Traffic Engine now has a validated traffic-to-lease ratio of 6.3:1 for garden-style in Frisco. Previous estimate was 7.8:1 (from market averages). Your data shows higher conversion \u2014 likely because of the property's corner visibility.",
      proformaImpact: "Every new garden-style deal within 5 miles of Parkway 290 now gets Traffic Engine predictions with 'HIGH confidence' instead of 'LOW'. The lease-up schedule in M09 ProForma tightens by 2 months, improving IRR by ~80bps."
    }
  },
  {
    id: "template",
    name: "Template Library",
    icon: "\u25C7",
    tagline: "Build once, apply everywhere",
    description: "Save entire proforma configurations, assumption sets, and underwriting templates. When you dial in the perfect assumption set for a garden-style value-add in Dallas, save it. Next time, one click to apply \u2014 then override only what's different.",
    dbTables: ["deal_proforma_snapshots", "proforma_templates", "assumption_presets"],
    moduleConnections: ["M09 ProForma", "M10 Scenario", "M11 Debt", "M12 Exit"],
    sections: [
      {
        name: "Proforma Templates",
        description: "Complete proforma configurations: income assumptions, expense structure, debt terms, exit modeling. Saved per strategy \u00D7 product type combination.",
        fields: [
          { label: "Template Name", example: "Garden Value-Add \u2014 DFW 2024", source: "User-defined" },
          { label: "Strategy", example: "Rental (Value-Add)", source: "M08 Strategy type" },
          { label: "Product Type", example: "Garden 1-3 Stories", source: "Strategy Matrix" },
          { label: "Income Assumptions", example: "Rent growth 3.5%, Vacancy 5.5%, Concessions 2%", source: "Saved from deal" },
          { label: "Expense Assumptions", example: "OpEx/unit $5,100, Mgmt 3.5%, Tax escalation 2.5%", source: "Saved from deal" },
        ],
        matchCriteria: "User selects template \u2192 auto-filters by strategy + product type",
        howItWorks: "User finalizes proforma \u2192 clicks 'Save as Template' \u2192 stored in proforma_templates with all assumption values + sources \u2192 retrievable when creating new deals of same type"
      },
      {
        name: "Scenario Presets",
        description: "Bull/Base/Bear parameter sets tailored to specific market conditions. 'Supply Glut Bear Case' uses different parameters than 'Demand Shock Bear Case.'",
        fields: [
          { label: "Preset Name", example: "Supply Glut \u2014 High Delivery Market", source: "User-defined" },
          { label: "Vacancy Adjustment", example: "+200bps from base", source: "Based on supply analysis" },
          { label: "Rent Growth Adjustment", example: "-150bps from base", source: "Based on comp absorption" },
          { label: "Exit Cap Adjustment", example: "+25bps from base", source: "Risk premium" },
          { label: "Probability Weight", example: "25%", source: "User assessment" },
        ],
        matchCriteria: "User selects based on market conditions",
        howItWorks: "User creates scenario in M10 \u2192 saves as preset \u2192 applies to future deals with one click \u2192 adjustments override base proforma \u2192 M10 recalculates probability-weighted returns"
      },
      {
        name: "Debt & Capital Templates",
        description: "Pre-configured debt structures for common deal types. Agency debt terms, bridge loan structures, preferred equity waterfalls.",
        fields: [
          { label: "Template Name", example: "Freddie Mac SBL \u2014 5yr Fixed", source: "User-defined" },
          { label: "LTV / LTC", example: "75% LTV", source: "Lender terms" },
          { label: "Rate Structure", example: "Fixed 5.85%, 5yr term, 30yr amort", source: "Rate lock" },
          { label: "IO Period", example: "24 months", source: "Lender terms" },
          { label: "Prepayment", example: "Yield maintenance \u2192 1% in final year", source: "Loan docs" },
        ],
        matchCriteria: "Strategy + deal size + asset class",
        howItWorks: "User closes deal with specific debt terms \u2192 saves structure as template \u2192 applies to M11 Debt module on future deals \u2192 auto-calculates DSCR, debt yield from new deal's NOI"
      }
    ],
    exampleQuery: {
      scenario: "You successfully closed a garden value-add in Frisco \u2014 dialed in assumptions over 6 months of DD. Now you're looking at another garden value-add 4 miles away.",
      result: "Template Library shows: 'Garden Value-Add \u2014 DFW 2024' with all 40+ assumption cells pre-filled. One click to apply. Platform flags 3 assumptions that should differ: (1) tax rate is different parcel, (2) insurance differs by flood zone, (3) submarket vacancy shifted +30bps since template was saved.",
      proformaImpact: "Instead of building a proforma from scratch (2-3 hours), you start from a validated template and only adjust what changed. Time to first proforma: 15 minutes. Confidence: HIGH because template is battle-tested against actuals."
    }
  },
  {
    id: "benchmark",
    name: "Market Benchmarks",
    icon: "\u25C9",
    tagline: "Know where you stand vs the market",
    description: "Platform-wide anonymized benchmarks derived from all user data + market sources. See how your assets perform relative to submarket, MSA, and national averages. This is Domain 1 (Market Data) made accessible.",
    dbTables: ["market_snapshots", "anonymized_comps", "demographic_snapshots"],
    moduleConnections: ["M05 Market", "M09 ProForma", "M14 Risk", "M25 JEDI Score"],
    sections: [
      {
        name: "Expense Benchmarks",
        description: "How do your operating expenses compare? Anonymized data from all platform users + market sources, segmented by property type, geography, and vintage.",
        fields: [
          { label: "Your OpEx/unit", example: "$4,980", source: "Your actuals" },
          { label: "Submarket Median", example: "$5,280", source: "47 properties reporting" },
          { label: "MSA Median", example: "$5,420", source: "312 properties reporting" },
          { label: "Your Percentile", example: "23rd (better than 77%)", source: "Calculated" },
          { label: "Category Breakdown", example: "Taxes: 15th pctile, R&M: 45th, Payroll: 62nd", source: "Line-item comparison" },
        ],
        matchCriteria: "Auto-matched by property type + submarket + vintage tier",
        howItWorks: "anonymized_comps table aggregates all users' actuals (bucketed, never raw) \u2192 user sees their position relative to market \u2192 identifies specific expense categories to improve"
      },
      {
        name: "Performance Benchmarks",
        description: "Occupancy, rent growth, NOI margin, traffic conversion \u2014 how does your portfolio perform vs peers?",
        fields: [
          { label: "Your Occupancy", example: "94.2%", source: "Your actuals" },
          { label: "Submarket Avg", example: "92.8%", source: "Market data" },
          { label: "Your Rent Growth", example: "3.8% YoY", source: "Your rent rolls" },
          { label: "Submarket Rent Growth", example: "4.1% YoY", source: "Apartments.com" },
          { label: "Your NOI Margin", example: "62.4%", source: "Your actuals" },
        ],
        matchCriteria: "Submarket + asset class + vintage",
        howItWorks: "Combines user actuals with market_snapshots \u2192 shows relative positioning \u2192 flags underperformance for operational improvement \u2192 feeds M14 Risk assessment"
      },
      {
        name: "Market Assumptions",
        description: "What's the market saying about forward-looking assumptions? Platform-derived consensus for rent growth, vacancy, cap rates \u2014 sourced from actual data, not broker guesses.",
        fields: [
          { label: "Consensus Rent Growth (1yr)", example: "3.2%", source: "Trailing trend + demand signals" },
          { label: "Consensus Vacancy", example: "5.8%", source: "Current + supply pipeline" },
          { label: "Consensus Exit Cap", example: "5.25%", source: "Recent transactions" },
          { label: "Construction Cost/unit", example: "$172K", source: "Platform user dev data" },
          { label: "Absorption Rate", example: "22 units/mo/project", source: "Pipeline tracking" },
        ],
        matchCriteria: "Submarket + property type",
        howItWorks: "Derived from market_snapshots + supply_pipeline + demand_events \u2192 these become M09 ProForma Layer 2 (Platform Intelligence) defaults \u2192 user can override but sees market consensus"
      }
    ],
    exampleQuery: {
      scenario: "You want to know if your Parkway 290 expenses are competitive, and what assumptions to use for your next deal in the same submarket.",
      result: "Market Benchmarks shows: your total OpEx is 23rd percentile (great). But your R&M is 45th \u2014 there may be deferred maintenance catching up. Forward assumptions for Frisco: 3.2% rent growth, 5.8% vacancy, $172K/unit construction.",
      proformaImpact: "ProForma Layer 2 auto-fills with these market-derived assumptions. Your Layer 3 comp data refines them. Collision analysis shows where broker's OM deviates from both market AND your experience."
    }
  },
  {
    id: "model",
    name: "Model Library",
    icon: "\u25C6",
    tagline: "See how your data trains the AI",
    description: "Transparency into the predictive models your data feeds. See what the Traffic Engine has learned from your properties, how expense benchmarks are calibrated, and which predictions have been validated against your actuals.",
    dbTables: ["training_datasets", "model_coefficients", "traffic_predictions"],
    moduleConnections: ["M07 Traffic", "M25 JEDI Score", "M08 Strategy"],
    sections: [
      {
        name: "Traffic Model Status",
        description: "Which properties are training the Traffic Engine? How accurate are predictions? Where does the model need more data?",
        fields: [
          { label: "Properties Contributing", example: "3 of 5 owned assets", source: "Validation check" },
          { label: "Total Data Points", example: "54 months of traffic data", source: "deal_monthly_actuals" },
          { label: "Prediction Accuracy (MAE)", example: "\u00B12.1 leases/week", source: "Validation pipeline" },
          { label: "Best Predicted Property", example: "Parkway 290 \u2014 91% accuracy", source: "Per-property validation" },
          { label: "Needs More Data", example: "Cedar Hills \u2014 only 3 months, need 6+", source: "Threshold check" },
        ],
        matchCriteria: "N/A \u2014 status dashboard",
        howItWorks: "Shows user which of their properties actively contribute to model training \u2192 accuracy metrics per property \u2192 identifies where uploading more data would improve predictions the most"
      },
      {
        name: "Prediction Validation",
        description: "Side-by-side: what JEDI RE predicted vs what actually happened. The feedback loop that builds trust.",
        fields: [
          { label: "Prediction", example: "8.2 leases/week for Parkway 290", source: "Traffic Engine v3" },
          { label: "Actual", example: "7.8 leases/week (trailing 4 weeks)", source: "User actuals" },
          { label: "Error", example: "+5.1% (slightly optimistic)", source: "Calculated" },
          { label: "Trend", example: "Error decreasing \u2014 was \u00B112% at 6mo, now \u00B15%", source: "Validation history" },
          { label: "Model Adjustment", example: "Garden-style capture rate adjusted -0.03", source: "Auto-calibration" },
        ],
        matchCriteria: "Per-property, per-model",
        howItWorks: "Monthly reconciliation: predicted values vs uploaded actuals \u2192 error tracking over time \u2192 model auto-adjusts when systematic bias detected \u2192 user sees predictions getting more accurate"
      },
      {
        name: "Confidence Map",
        description: "Where does JEDI RE have high confidence predictions, and where is it guessing? Directly tied to data density in each submarket.",
        fields: [
          { label: "High Confidence Zones", example: "Frisco, Prosper, McKinney (12+ contributing properties)", source: "Data density" },
          { label: "Medium Confidence", example: "Allen, Plano (5-11 properties)", source: "Data density" },
          { label: "Low Confidence", example: "Celina, Anna (< 5 properties)", source: "Data density" },
          { label: "Your Impact", example: "Your 3 Frisco assets improved confidence from MED\u2192HIGH", source: "Contribution tracking" },
          { label: "Data Gaps", example: "No mid-rise data in Frisco \u2014 upload would create new segment", source: "Gap analysis" },
        ],
        matchCriteria: "Geographic \u2014 MSA, submarket, property type",
        howItWorks: "Visualizes data density across user's markets \u2192 shows where their contributions have improved predictions \u2192 identifies strategic data gaps where uploading would create outsized prediction improvement"
      }
    ],
    exampleQuery: {
      scenario: "You want to know how much your data contributions have improved JEDI RE's predictions in your market.",
      result: "Model Library shows: Your 3 Frisco properties contributed 54 months of data. Traffic prediction accuracy improved from \u00B118% (market average only) to \u00B15.1% (your validated data). Expense predictions now have HIGH confidence for garden-style in Frisco. Your data also helped 43 other users get better predictions in that submarket (anonymized).",
      proformaImpact: "Every deal you evaluate in Frisco now carries 'HIGH confidence' badges on Traffic, Expense, and Rent predictions. Investors and lenders see this confidence level in deal memos \u2014 it's a trust signal."
    }
  }
];

const DATA_FLOW = {
  steps: [
    { id: 1, label: "UPLOAD", desc: "User uploads actuals, rent rolls, traffic data", icon: "\u2191", color: "amber" },
    { id: 2, label: "NORMALIZE", desc: "Template mapper standardizes to JEDI schema", icon: "\u2699", color: "purple" },
    { id: 3, label: "INDEX", desc: "Data tagged by geography, property type, vintage", icon: "\u25C8", color: "blue" },
    { id: 4, label: "ENRICH", desc: "Cross-referenced with market data + other user data (anonymized)", icon: "\u2B21", color: "emerald" },
    { id: 5, label: "SERVE", desc: "Available as comps, benchmarks, training data, and templates", icon: "\u25C7", color: "red" },
  ]
};

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  amber: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  purple: { border: "border-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
  blue: { border: "border-blue-400", bg: "bg-blue-50", text: "text-blue-700" },
  emerald: { border: "border-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700" },
  red: { border: "border-red-400", bg: "bg-red-50", text: "text-red-700" },
};

export function ModuleLibrariesPage() {
  const [selectedLib, setSelectedLib] = useState("comp");
  const [expandedSection, setExpandedSection] = useState(0);
  const [showDataFlow, setShowDataFlow] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  const lib = LIBRARIES.find(l => l.id === selectedLib);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b-2 border-amber-500 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[10px] font-mono text-amber-600 tracking-[4px] mb-0.5">SETTINGS \u2192 M24</div>
            <h1 className="text-xl font-bold text-gray-900">Module Libraries</h1>
            <p className="text-xs text-gray-500 mt-0.5">The central hub for all proprietary user intelligence \u2014 comps, data, templates, benchmarks, and model training</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDataFlow(!showDataFlow)} className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono border transition-colors ${showDataFlow ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
              {showDataFlow ? "Hide" : "Show"} Data Flow
            </button>
            <button onClick={() => setShowSchema(!showSchema)} className={`px-3 py-1.5 rounded-md text-xs font-semibold font-mono border transition-colors ${showSchema ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
              {showSchema ? "Hide" : "Show"} DB Tables
            </button>
          </div>
        </div>

        {showDataFlow && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {DATA_FLOW.steps.map((step, i) => {
              const c = COLOR_MAP[step.color];
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div className={`min-w-[180px] bg-white border ${c.border} rounded-lg p-3 border-t-2`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-base ${c.text}`}>{step.icon}</span>
                      <span className={`text-[10px] font-mono ${c.text} tracking-[2px]`}>STEP {step.id}: {step.label}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">{step.desc}</p>
                  </div>
                  {i < DATA_FLOW.steps.length - 1 && <span className="text-lg text-gray-300">\u2192</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex" style={{ height: showDataFlow ? 'calc(100vh - 170px)' : 'calc(100vh - 90px)' }}>
        <div className="w-60 bg-white border-r border-gray-200 overflow-y-auto py-2">
          <div className="px-3.5 py-1.5 text-[9px] font-mono text-gray-400 tracking-[3px]">LIBRARIES</div>
          {LIBRARIES.map(l => (
            <button key={l.id} onClick={() => { setSelectedLib(l.id); setExpandedSection(0); }}
              className={`w-full text-left px-3.5 py-3 border-l-[3px] transition-all ${selectedLib === l.id ? 'bg-gray-50 border-amber-500' : 'border-transparent hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2.5">
                <span className={`text-xl leading-none ${selectedLib === l.id ? 'text-amber-600' : 'text-gray-400'}`}>{l.icon}</span>
                <div>
                  <div className={`text-[13px] ${selectedLib === l.id ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{l.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{l.tagline}</div>
                </div>
              </div>
            </button>
          ))}

          <div className="mx-3.5 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[9px] font-mono text-gray-400 tracking-[2px] mb-1.5">DATA DOMAINS</div>
            <div className="text-[11px] text-gray-500 leading-relaxed space-y-1">
              <div><span className="text-blue-500">\u25CF</span> Market Data \u2192 Benchmarks</div>
              <div><span className="text-amber-500">\u25CF</span> User Data \u2192 Comps, Data, Templates</div>
              <div><span className="text-emerald-500">\u25CF</span> Derived Intel \u2192 Models</div>
            </div>
          </div>
        </div>

        {lib && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-3xl text-amber-600">{lib.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-900">{lib.name}</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[700px]">{lib.description}</p>
              </div>
            </div>

            {showSchema && (
              <div className="flex gap-3 mb-4">
                <div className="flex-1 bg-white border border-blue-200 rounded-lg p-3">
                  <div className="text-[9px] font-mono text-blue-600 tracking-[2px] mb-1.5">DATABASE TABLES</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lib.dbTables.map(t => (
                      <span key={t} className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex-1 bg-white border border-amber-200 rounded-lg p-3">
                  <div className="text-[9px] font-mono text-amber-600 tracking-[2px] mb-1.5">FEEDS MODULES</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lib.moduleConnections.map(m => (
                      <span key={m} className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {lib.sections.map((section, si) => (
              <div key={si} className="mb-2.5 border border-gray-200 rounded-xl overflow-hidden bg-white">
                <button onClick={() => setExpandedSection(expandedSection === si ? -1 : si)}
                  className={`w-full text-left px-4 py-3 flex justify-between items-center ${expandedSection === si ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{section.name}</span>
                    <span className="text-xs text-gray-400 ml-2.5">{section.description.slice(0, 80)}...</span>
                  </div>
                  <span className={`text-gray-400 transition-transform ${expandedSection === si ? 'rotate-180' : ''}`}>\u25BE</span>
                </button>

                {expandedSection === si && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{section.description}</p>

                    <div className="mb-3">
                      <div className="text-[9px] font-mono text-gray-400 tracking-[2px] mb-1.5">DATA FIELDS</div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        {section.fields.map((f, fi) => (
                          <div key={fi} className={`grid grid-cols-[160px_140px_1fr] gap-0 px-3 py-2 border-b border-gray-100 last:border-0 ${fi % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <span className="text-xs font-medium text-gray-900">{f.label}</span>
                            <span className="text-xs font-mono text-amber-700">{f.example}</span>
                            <span className="text-[11px] text-gray-400">{f.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-[9px] font-mono text-amber-600 tracking-[2px] mb-1">MATCH CRITERIA</div>
                        <p className="text-[11px] text-gray-600 leading-snug">{section.matchCriteria}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-[9px] font-mono text-emerald-600 tracking-[2px] mb-1">HOW IT WORKS</div>
                        <p className="text-[11px] text-gray-600 leading-snug">{section.howItWorks}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-4 border border-amber-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <div className="text-[10px] font-mono text-amber-700 tracking-[2px]">REAL-WORLD EXAMPLE</div>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <div className="text-[10px] font-mono text-gray-400 tracking-[1px] mb-1">SCENARIO</div>
                  <p className="text-sm text-gray-900 leading-relaxed">{lib.exampleQuery.scenario}</p>
                </div>
                <div className="mb-3">
                  <div className="text-[10px] font-mono text-emerald-600 tracking-[1px] mb-1">WHAT THE LIBRARY RETURNS</div>
                  <p className="text-sm text-gray-600 leading-relaxed">{lib.exampleQuery.result}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="text-[10px] font-mono text-amber-700 tracking-[1px] mb-1">PROFORMA IMPACT</div>
                  <p className="text-sm text-amber-800 leading-relaxed font-medium">{lib.exampleQuery.proformaImpact}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-xl border border-dashed border-gray-300">
              <div className="text-[10px] font-mono text-gray-400 tracking-[2px] mb-1.5">ARCHITECTURE NOTE</div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {lib.id === "comp" && "The Comp Library is the user-facing layer over the comp_eligible_properties materialized view and deal_monthly_actuals table. When users upload monthly actuals, the data flows: upload \u2192 deal_monthly_actuals \u2192 comp_eligible_properties (nightly refresh) \u2192 available for ProForma Layer 3 queries. The comp scoring algorithm (property type match 40pts + proximity 25pts + vintage 15pts + scale 10pts + recency 10pts) runs as a SQL query against the materialized view, returning ranked comps with confidence scores."}
                {lib.id === "data" && "The Data Library maps directly to deal_monthly_actuals (the core table) plus deal_proforma_snapshots (saved state), training_datasets (model input), and traffic_predictions (M07 output). Every upload triggers a cascade: normalize \u2192 write \u2192 refresh materialized views \u2192 check if model retraining threshold is met \u2192 update confidence scores for that submarket."}
                {lib.id === "template" && "Templates are stored in proforma_templates (full assumption snapshots) and assumption_presets (scenario parameter sets). When applied to a new deal, the system loads all saved values into M09 ProForma, then runs a freshness check against current market data to flag stale assumptions. This bridges Domain 2 (User Data) with Domain 1 (Market Data) validation."}
                {lib.id === "benchmark" && "Market Benchmarks draw from anonymized_comps (aggregated user data with k-anonymity), market_snapshots (external market data), and demographic_snapshots (Census/BLS). Statistics are computed with minimum reporting thresholds (5+ properties per segment). This powers M09 ProForma Layer 2 (Platform Intelligence) defaults."}
                {lib.id === "model" && "The Model Library provides transparency into training_datasets (what data feeds models), model_coefficients (learned parameters), and traffic_predictions (output). Users can see exactly how their data contributions improve prediction accuracy, building trust in the AI system's outputs."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
