import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const SYSTEMS = [
  {
    id: 'performance',
    number: 'S1',
    title: 'Performance Tracking & Ranking Engine',
    subtitle: 'Track \u2192 Rank \u2192 Position \u2192 Target',
    color: '#10b981',
    items: [1, 2, 7, 8],
    tagline: "The foundation. Every property gets a living performance score. Rankings expose who\u2019s winning, who\u2019s losing, and where you\u2019d slot in.",
  },
  {
    id: 'acquisition',
    number: 'S2',
    title: 'Acquisition Intelligence Engine',
    subtitle: 'Find underperformers \u2192 Identify owners \u2192 Time the approach',
    color: '#3b82f6',
    items: [3, 4],
    tagline: "Once you know who\u2019s underperforming, find out WHO owns it, WHO manages it, and WHEN their debt matures. That\u2019s your acquisition window.",
  },
  {
    id: 'comps',
    number: 'S3',
    title: 'Dual Comp Analysis Framework',
    subtitle: 'Competition (trade area) vs Like-Kind (cross-market)',
    color: '#8b5cf6',
    items: [5],
    tagline: 'Two lenses on every deal. Your local competitors define market position. Like-kind comps across markets reveal pricing anomalies and operational benchmarks.',
  },
  {
    id: 'patterns',
    number: 'S4',
    title: 'Pattern Recognition Engine',
    subtitle: 'Platform-wide intelligence from every data stream',
    color: '#f59e0b',
    items: [6, 10, 11, 13],
    tagline: 'The brain. Ingests Google reviews, rent-to-traffic correlations, business formation clusters, and wage growth \u2014 finds patterns humans miss.',
  },
  {
    id: 'projection',
    number: 'S5',
    title: 'Predictive Positioning & Rank-Me Tool',
    subtitle: 'Project future rank \u2192 Prescribe what to do',
    color: '#ef4444',
    items: [7, 8],
    tagline: "\u2018I want to be ranked 2nd in this market \u2014 what do I need to do?\u2019 The platform reverse-engineers the gap and builds a plan.",
  },
  {
    id: 'alerts',
    number: 'S6',
    title: 'Opportunity Alert System',
    subtitle: 'Push intelligence \u2192 Recommend strategies',
    color: '#06b6d4',
    items: [9],
    tagline: "Don\u2019t wait for users to search \u2014 push the best opportunities as they emerge, with specific strategy recommendations attached.",
  },
];

const PERFORMANCE_ENGINE = {
  overview: "Every multifamily property in a tracked submarket gets a Performance Composite Score (PCS) updated monthly. The PCS combines traffic position, financial metrics, operational quality, and market momentum into a single ranking number. This ranking is the backbone \u2014 everything else (acquisition targeting, positioning, alerts) depends on knowing who\u2019s #1 and who\u2019s #47.",
  score_components: [
    {
      name: 'Traffic Position (25%)',
      source: 'M07 Traffic Engine \u2192 TPI',
      metrics: ['Effective ADT percentile in submarket', 'Digital traffic share', 'Traffic velocity (gaining/losing)', 'Walk-in conversion efficiency'],
      formula: 'traffic_score = TPI_percentile \u00d7 0.5 + digital_share_pct \u00d7 0.25 + TVS_normalized \u00d7 0.25',
    },
    {
      name: 'Revenue Performance (30%)',
      source: 'M05 Market Intel + CoStar/Apartments.com',
      metrics: ['Effective rent vs submarket avg', 'Rent growth rate vs submarket', 'Revenue per available unit (RevPAU)', 'Concession intensity (inverse)'],
      formula: 'revenue_score = rent_premium_pct \u00d7 0.3 + rent_growth_delta \u00d7 0.3 + revpau_percentile \u00d7 0.25 + (1 - concession_rate) \u00d7 0.15',
    },
    {
      name: 'Occupancy & Demand (20%)',
      source: 'M05 + Apartments.com scraper + T-05',
      metrics: ['Physical occupancy rate', 'Economic occupancy rate', 'Lease velocity (new leases/month)', 'Traffic-to-lease conversion rate'],
      formula: 'occupancy_score = physical_occ \u00d7 0.3 + economic_occ \u00d7 0.3 + lease_velocity_pct \u00d7 0.2 + T05_conversion \u00d7 0.2',
    },
    {
      name: 'Operational Quality (15%)',
      source: 'Google Reviews + Apartments.com reviews + public signals',
      metrics: ['Google rating (1-5 stars)', 'Review volume & recency', 'Sentiment score from NLP', 'Response rate to reviews', 'Maintenance complaint frequency'],
      formula: 'ops_score = google_rating_norm \u00d7 0.3 + sentiment_score \u00d7 0.3 + review_volume_norm \u00d7 0.15 + response_rate \u00d7 0.15 + (1-complaint_freq) \u00d7 0.10',
    },
    {
      name: 'Asset Quality (10%)',
      source: 'M01 Deal Capsule + property records + photos',
      metrics: ['Year built / last renovated', 'Amenity completeness score', 'Unit mix quality (vs market demand)', 'Curb appeal / condition assessment'],
      formula: 'asset_score = age_factor \u00d7 0.3 + amenity_completeness \u00d7 0.3 + unit_mix_alignment \u00d7 0.2 + condition_score \u00d7 0.2',
    },
  ],
  ranking_outputs: [
    {
      name: 'Submarket Power Rankings',
      description: "Every property ranked 1 to N within its submarket. Updated monthly. Shows movement (\u21913, \u21932, \u2014). Users see where their assets rank and who just passed them.",
      display: 'Sortable table with sparkline trends. Click any property \u2192 full PCS breakdown. Color-coded: Top 25% green, Middle 50% yellow, Bottom 25% red.',
    },
    {
      name: 'Vantage Group Rankings',
      description: "Properties grouped by \u2018vantage\u2019 \u2014 similar vintage, similar unit count, similar class (A/B/C). This answers: \u2018Among 200-300 unit Class B properties built 2005-2015 in this MSA, where do I rank?\u2019",
      display: 'Dropdown filters: Class (A/B/C) \u00d7 Vintage (decade) \u00d7 Size (unit range) \u00d7 Submarket. Rankings recalculate in real-time as filters change.',
    },
    {
      name: 'Performance Trajectory',
      description: '12-month PCS trend line for each property. Identifies properties on upward trajectories (improving management, recent renovation) vs. declining (deferred maintenance, losing share).',
      display: '\u2191 Accelerating, \u2192 Stable, \u2193 Decelerating. Trajectory is as important as current rank \u2014 a #15 climbing fast is more interesting than a #5 slipping.',
    },
  ],
  rank_me_tool: {
    name: 'Rank-Me Positioning Engine',
    description: "The user says: \u2018I\u2019m buying this deal. I want to be ranked 2nd or 3rd in the market. What do I need to do?\u2019 The platform reverse-engineers the gap between the subject property\u2019s current PCS and the target rank, then prescribes the specific improvements.",
    workflow: [
      { step: 1, action: 'User selects subject property + target rank', detail: 'Drop deal into ranking. System calculates current PCS and shows the gap to target position.' },
      { step: 2, action: 'Gap Analysis by Component', detail: "Break the PCS gap into components. \u2018You\u2019re 14 points behind #2. The gap is: -3 in traffic (can\u2019t change location), -2 in revenue (raise rents $85/unit to match), -5 in operational quality (you need to get from 3.8 to 4.4 stars on Google), -4 in asset quality (renovate units + add 3 amenities).\u2019" },
      { step: 3, action: 'Prescriptive Action Plan', detail: 'For each gap component, the platform generates specific actions with cost estimates and timeline. Revenue gap \u2192 rent increase schedule. Ops gap \u2192 management improvements (from Google review analysis). Asset gap \u2192 CapEx budget with ROI per improvement.' },
      { step: 4, action: 'Pro Forma Integration', detail: "\u2018Achieving Rank #2 requires $1.2M in CapEx over 18 months. Here\u2019s how that changes your IRR: from 14.2% \u2192 19.7%. The ranking improvement also reduces refinance risk and increases exit cap rate compression.\u2019" },
      { step: 5, action: 'Track Progress Post-Acquisition', detail: "Once acquired, the property enters the Owned Assets module. Monthly PCS updates show whether you\u2019re on track to reach your target rank. Deviation alerts: \u2018You\u2019re 3 months in and 2 points behind schedule on operational quality \u2014 here\u2019s what the top performers do differently.\u2019" },
    ],
  },
};

const ACQUISITION_ENGINE = {
  overview: "The Performance Rankings create a map of winners and losers. The Acquisition Engine turns that map into a deal pipeline by identifying underperformers that SHOULD be performing better (given their location/attributes), then building intelligence profiles on ownership, management, and debt to time the approach.",
  underperformer_detection: {
    name: 'Underperformer Detection Algorithm',
    concept: "Compare each property\u2019s actual PCS to its EXPECTED PCS based on location advantages. A property ranked #30 in a submarket that SHOULD be ranked #8 (based on its traffic position, vintage, and unit count) has a performance gap of 22 ranks. That gap = your value-add opportunity.",
    formula: `EXPECTED_RANK = model(
  traffic_position_index,    // Location quality from M07
  year_built,                // Physical quality baseline
  unit_count,                // Scale advantages
  amenity_set,               // Feature completeness
  submarket_avg_rent,        // Market ceiling
  frontage_quality           // Visibility/access
)

PERFORMANCE_GAP = EXPECTED_RANK - ACTUAL_RANK
  \u2192 Gap > 10 ranks: SEVERE underperformance \u2014 strong acquisition target
  \u2192 Gap 5-10 ranks: MODERATE underperformance \u2014 investigate management/condition
  \u2192 Gap 0-5 ranks: SLIGHT underperformance \u2014 normal variance
  \u2192 Gap < 0: OUTPERFORMING expectations \u2014 premium pricing likely justified`,
    vantage_group_targeting: {
      concept: "Instead of looking at ALL underperformers, find which VANTAGE GROUP is performing best, then target underperformers within that group. If 1990s-vintage 200-unit Class B properties are crushing it (because they\u2019re the rent-value sweet spot in this cycle), find the ones in that group that AREN\u2019T crushing it \u2014 those are your deals.",
      workflow: [
        'Rank all vantage groups by average PCS \u2192 identify the top-performing group',
        'Within that group, identify properties in bottom quartile (underperformers in a winning category)',
        'Cross-reference with T-04 quadrant \u2192 Hidden Gems in a top vantage group = PRIORITY TARGETS',
        'Score targets: (vantage_group_strength \u00d7 performance_gap \u00d7 traffic_arbitrage_ratio)',
        'Output: Ranked list of acquisition targets with estimated value-add potential in dollars',
      ],
    },
  },
  ownership_intelligence: {
    name: 'Ownership & Debt Intelligence Layer',
    concept: "For every identified target, build a complete ownership profile. The most actionable deals combine an underperforming property with a motivated seller \u2014 and the biggest motivation is debt maturity pressure.",
    data_sources: [
      { source: 'County Property Appraiser / Tax Records', data: ['Current owner name/entity', 'Purchase date and price', 'Assessed value', 'Tax payment history (delinquent = distress signal)', 'Ownership chain (how many times sold, holding period)'] },
      { source: 'UCC Filings / Mortgage Records', data: ['Lender name', 'Original loan amount', 'Recording date', 'Loan term (derive maturity date)', 'Second liens / mezzanine debt', 'Assignment records (loan been sold/transferred)'] },
      { source: 'Secretary of State / Entity Records', data: ['LLC/Corp registration', 'Registered agent', 'Officers/members (sometimes)', 'Related entities (same registered agent = portfolio owner)', 'Entity status (active, dissolved, admin revoked)'] },
      { source: 'CMBS/Securitization Data', data: ['Servicer name', 'DSCR and LTV at origination', 'Watchlist status', 'Special servicing transfer', 'Loan maturity date (exact)'] },
    ],
    derived_intelligence: [
      { signal: 'Debt Maturity Window', insight: 'Properties with debt maturing in 6-18 months face refinancing risk, especially in high-rate environments. If current DSCR has deteriorated (underperformance), refinancing may require equity injection \u2014 creating seller motivation.' },
      { signal: 'Holding Period Stress', insight: 'Funds typically have 5-7 year hold periods. A property purchased in 2019-2020 is now at year 6-7 \u2014 fund managers may need to exit regardless of market conditions.' },
      { signal: 'Owner Portfolio Pattern', insight: 'If the same registered agent appears on 15 LLCs, that\u2019s a portfolio operator. If 3 of their 15 properties are underperforming, they may be willing to trade non-core assets.' },
      { signal: 'Management Company Performance', insight: 'Some management companies consistently underperform. Properties managed by bottom-quartile managers \u2192 instant acquisition watchlist.' },
    ],
  },
};

const DUAL_COMPS = {
  overview: 'Traditional comp analysis uses one lens \u2014 nearby properties. JEDI RE uses two lenses simultaneously, and the PATTERNS that emerge from comparing the two views are where the real intelligence lives.',
  lens_1: {
    name: 'COMPETITION LENS \u2014 Trade Area Comps',
    scope: 'Properties within the defined trade area that compete for the SAME renter pool',
    patterns: [
      { pattern: 'Rent Ceiling Gap', detection: "If the top-rent comp charges $1,950 and the average is $1,650 \u2014 that $300 gap defines your renovation opportunity ceiling. Properties below average with above-average traffic position are acquisition targets." },
      { pattern: 'Amenity Arms Race Detection', detection: "When 60%+ of trade area comps have added a specific amenity in the last 24 months, properties WITHOUT that amenity face accelerating competitive displacement." },
      { pattern: 'Vintage Rotation', detection: 'When new supply enters a trade area, competitive pressure cascades downward: Class A new \u2192 pushes Class A existing \u2192 pushes renovated B \u2192 pushes unrenovated B.' },
    ],
  },
  lens_2: {
    name: 'LIKE-KIND LENS \u2014 Cross-Market Comps',
    scope: 'Properties with similar attributes across different submarkets or MSAs',
    patterns: [
      { pattern: 'Cross-Market Pricing Anomaly', detection: 'Markets where like-kind rent PSF is >15% below the national like-kind average AND traffic/demand signals are strong = UNDERPRICED MARKETS.' },
      { pattern: 'Operational Benchmark Gap', detection: "Compare operational metrics across like-kind properties. Properties performing below the like-kind national benchmark have operational upside regardless of market conditions." },
      { pattern: 'Rent Growth Divergence', detection: "When one market\u2019s like-kind cohort grows significantly faster than others, it signals either a catch-up play or a bubble. Cross-reference with traffic trajectory to distinguish." },
    ],
  },
  collision_output: 'When both lenses find the same property, the signal is amplified. A property that ranks low in its trade area AND ranks below like-kind benchmarks has BOTH local competitive problems AND operational problems \u2014 maximum value-add potential.',
};

const PATTERN_ENGINE = {
  overview: 'A horizontal intelligence layer that runs across ALL modules. It doesn\u2019t own data \u2014 it consumes data from every module and looks for patterns, correlations, anomalies, and predictive relationships that no single module would detect alone.',
  categories: [
    {
      name: 'Google Reviews Intelligence',
      id: 'PR-01',
      color: '#f59e0b',
      patterns: [
        { pattern: 'Management Transition Signal', detail: "When review sentiment shifts dramatically (\u00b10.3 in 6 months), it often indicates an ownership or management change. Early detection creates acquisition opportunities 3-6 months before deals hit the market." },
        { pattern: 'Operational Gap Mining', detail: "Extract the TOP 3 complaint categories per property. If \u2018maintenance response time\u2019 is the #1 complaint and that property has strong traffic position, you\u2019ve found an operational fix cheaper than physical renovation." },
        { pattern: 'Amenity Demand Signal', detail: "When reviews across multiple properties mention \u2018wish this had [X]\u2019, it\u2019s a revealed preference signal. Track which amenity mentions are rising fastest." },
      ],
    },
    {
      name: 'Rent-Traffic-Wage Correlation Engine',
      id: 'PR-02',
      color: '#3b82f6',
      patterns: [
        { pattern: 'Affordability Ceiling Predictor', detail: 'When rent/wage ratio exceeds 30% of median household income for 2+ consecutive quarters AND traffic trajectory is decelerating, the market is approaching an affordability wall.' },
        { pattern: 'Rent Growth Runway Detector', detail: 'When wage growth > rent growth sustained AND traffic is growing \u2014 rents have room to run. The wage growth creates a \u2018permission structure\u2019 for rent increases without demand destruction.' },
      ],
    },
    {
      name: 'Business Formation & Cluster Intelligence',
      id: 'PR-03',
      color: '#10b981',
      patterns: [
        { pattern: 'Emerging Employment Center', detail: 'When business formations in a specific NAICS cluster exceed 2 standard deviations above the trailing 24-month average within a 3-mile radius, a new employment center is forming. This is a demand signal 12-24 months BEFORE the traffic data shows it.' },
        { pattern: 'Industry Mix Shift', detail: 'When the composition of business formations shifts (e.g., healthcare NAICS growing from 8% to 15%), the INCOME PROFILE of the renter pool is changing. This informs unit mix and pricing strategy.' },
      ],
    },
  ],
};

const ALERT_SYSTEM = {
  overview: "Don\u2019t wait for users to hunt for deals. The platform continuously monitors all data streams and pushes actionable opportunity alerts with specific strategy recommendations. Alerts are ranked by confidence and time-sensitivity.",
  alert_types: [
    { name: 'ACQUISITION WINDOW', icon: '\ud83c\udfaf', color: '#22c55e', trigger: 'Underperformer + debt maturity window + motivated seller signal', urgency: 'HIGH \u2014 6-month approach window', example: "ACQUISITION TARGET: Sunset Ridge (248 units, PSL)\n\u2022 Ranked #34 of 41 \u2014 expected rank #12 based on location\n\u2022 Owner: PSL Ventures LLC (purchased 2019, hold year 6)\n\u2022 Est. debt maturity: Q2 2026 (14 months)\n\u2022 Strategy: Value-Add flip. Fix management + renovate 40% of units\n\u2022 Est. value creation: $2.8M on $18M basis" },
    { name: 'MARKET SURGE', icon: '\ud83d\udd25', color: '#3b82f6', trigger: 'Market lifecycle entering Acceleration + confirmed by rent-traffic-wage alignment', urgency: 'MODERATE \u2014 3-6 month window', example: "MARKET SURGE: Stuart/Jensen Beach submarket\n\u2022 Digital demand: +32% QoQ (Emergence \u2192 Acceleration)\n\u2022 AADT on US-1/Jensen Beach Blvd: +6.8% YoY\n\u2022 Wage growth: +4.2% (healthcare + marine industry clusters)\n\u2022 Business formations: +18% (2x county average)\n\u2022 Strategy: BTS or Rental acquisition" },
    { name: 'COMPETITIVE SHIFT', icon: '\u26a1', color: '#f59e0b', trigger: 'Property losing 10%+ digital share while trade area stable + declining Google review sentiment', urgency: 'HIGH \u2014 deterioration accelerating', example: "COMPETITIVE ALERT: Palm Bay Gardens (312 units)\n\u2022 Digital traffic share: down 14% this quarter\n\u2022 Google reviews: dropped from 4.1 to 3.6\n\u2022 Two new comps delivering within 18 months\n\u2022 Current rank: #8 \u2192 projected #14 by Q4 2026\n\u2022 Strategy: Acquisition target IF priced at current underperformance" },
    { name: 'PATTERN ANOMALY', icon: '\ud83d\udd0d', color: '#8b5cf6', trigger: 'Pattern Recognition Engine detects unusual correlation or divergence', urgency: 'MODERATE \u2014 6-12 month window', example: "PATTERN DETECTED: Rent-Traffic Divergence in Vero Beach\n\u2022 Traffic growth: +11% YoY across submarket\n\u2022 Rent growth: +1.8% YoY (lagging significantly)\n\u2022 Wage growth: +3.9% (supports higher rents)\n\u2022 Estimated rent runway: $75-125/unit\n\u2022 4 properties identified with TAR > 1.2" },
    { name: 'DISTRESS SIGNAL', icon: '\ud83d\udea8', color: '#ef4444', trigger: 'Tax delinquency + code violations + declining occupancy + review collapse', urgency: 'VARIABLE \u2014 monitor for triggers', example: "DISTRESS DETECTED: Ocean Breeze Apartments (164 units)\n\u2022 Property tax: 2 quarters delinquent\n\u2022 Code violations: 3 open, unresolved\n\u2022 Google reviews: 2.1 stars (was 3.4 two years ago)\n\u2022 Estimated occupancy: 78% (submarket avg: 94%)\n\u2022 Strategy: Deep value / restructuring play" },
  ],
  delivery: [
    { channel: 'In-App Dashboard', frequency: 'Real-time feed, ranked by TOS \u00d7 urgency' },
    { channel: 'Email Digest', frequency: 'Weekly summary of top 5 opportunities by market' },
    { channel: 'Push Notification', frequency: 'Immediate for HIGH urgency + confidence > 80%' },
    { channel: 'Portfolio-Specific', frequency: "Alerts filtered to user\u2019s tracked markets + investment criteria" },
  ],
};


const CONNECTION_MAP = [
  { from: 'S1: Performance Tracking', to: 'S2: Acquisition Intelligence', signal: 'Rankings identify underperformers \u2192 becomes target list' },
  { from: 'S1: Performance Tracking', to: 'S5: Rank-Me Tool', signal: 'Current rankings \u2192 gap to target rank \u2192 action plan' },
  { from: 'S2: Ownership Intelligence', to: 'S6: Opportunity Alerts', signal: 'Debt maturity + distress signals \u2192 timed acquisition alerts' },
  { from: 'S3: Trade Area Comps', to: 'S1: Performance Ranking', signal: 'Local competitive position feeds PCS ranking' },
  { from: 'S3: Like-Kind Comps', to: 'S4: Pattern Engine', signal: 'Cross-market anomalies feed pattern detection' },
  { from: 'S4: Google Reviews', to: 'S1: Performance (Ops Score)', signal: 'Sentiment analysis feeds operational quality component of PCS' },
  { from: 'S4: Rent-Traffic-Wage', to: 'S6: Opportunity Alerts', signal: 'Divergences trigger pattern anomaly alerts' },
  { from: 'S4: Business Formation', to: 'M06: Demand Signals', signal: 'Cluster detection feeds demand driver intelligence' },
  { from: 'S6: Opportunity Alerts', to: 'M08: Strategy Arbitrage', signal: 'Each alert includes strategy recommendation from arbitrage engine' },
  { from: 'All Systems', to: 'M25: JEDI Score', signal: 'Every signal ultimately flows into the 5 master signals and composite JEDI Score' },
];

const PROJECTION_ENGINE = {
  overview: "The Rank-Me Tool lets users project where a property WOULD rank if they acquired it and executed specific improvements. It reverse-engineers the gap between current position and target rank, then prescribes exactly what needs to change \u2014 with cost estimates and timeline.",
  scenarios: [
    { strategy: 'BTS', projection: "New construction enters market at projected rank based on planned specs. \u2018A 200-unit Class A with these amenities would rank #2 in this submarket. There are currently 0 Class A properties \u2014 you\u2019d CREATE the top tier.\u2019" },
    { strategy: 'Flip', projection: "\u2018Buy at rank #34, reposition to rank #12 in 18 months. The rank improvement from #34 \u2192 #12 historically corresponds to 35-50% value appreciation in this submarket.\u2019" },
    { strategy: 'Rental', projection: "\u2018This property currently ranks #8. Market trajectory is Acceleration. Projected rank in 24 months with no changes: #6 (rising tide lifts this boat). With $400K in targeted improvements: #3.\u2019" },
    { strategy: 'STR', projection: "\u2018As an STR, this property would rank #4 in the vacation rental competitive set based on location + traffic position. ADR projection based on rank: $185/night (top quartile commands $210).\u2019" },
  ],
};

function Pill({ children, color = '#64748b' }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-[5px] tracking-wide"
      style={{ color, background: `${color}12`, border: `1px solid ${color}20` }}
    >
      {children}
    </span>
  );
}

function CodeBlock({ children, color = '#94a3b8' }: { children: React.ReactNode; color?: string }) {
  return (
    <pre
      className="font-mono text-[10.5px] leading-relaxed rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words m-0"
      style={{ color, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {children}
    </pre>
  );
}

function Card({ children, color = 'rgba(255,255,255,0.06)', border, className = '' }: {
  children: React.ReactNode; color?: string; border?: string; className?: string;
}) {
  return (
    <div className={`rounded-[10px] p-4 ${className}`} style={{ background: color, border: border || '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  );
}

function Divider({ label, color = '#475569' }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${color}40, transparent)` }} />
      <span className="text-[10px] font-bold tracking-[0.12em] whitespace-nowrap" style={{ color }}>{label}</span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${color}40, transparent)` }} />
    </div>
  );
}

export default function CompetitiveIntelligencePage() {
  const { systemId } = useParams<{ systemId?: string }>();
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const validSystemIds = SYSTEMS.map(s => s.id);
  const resolvedSystem = systemId && validSystemIds.includes(systemId) ? systemId : 'performance';
  const [activeSystem, setActiveSystem] = useState(resolvedSystem);

  useEffect(() => {
    if (systemId && validSystemIds.includes(systemId)) {
      setActiveSystem(systemId);
    } else if (systemId && !validSystemIds.includes(systemId)) {
      navigate('/competitive-intelligence/performance', { replace: true });
    } else if (!systemId) {
      setActiveSystem('performance');
    }
  }, [systemId, navigate]);

  const handleSystemChange = (id: string) => {
    setActiveSystem(id);
    setExpandedSection(null);
    navigate(`/competitive-intelligence/${id}`, { replace: true });
  };

  const toggle = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  const activeSys = SYSTEMS.find(s => s.id === activeSystem)!;

  return (
    <div className="min-h-screen text-slate-200" style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-9">

        <div className="mb-9">
          <div className="flex items-center gap-3.5 mb-2.5">
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white font-mono"
              style={{
                background: 'linear-gradient(135deg, #10b981, #3b82f6, #f59e0b, #ef4444, #ec4899)',
                boxShadow: '0 0 40px rgba(59,130,246,0.15)',
              }}
            >
              CI
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-600 tracking-[0.14em]">
                JEDI RE · EXTENDS TRAFFIC INTELLIGENCE FRAMEWORK · v1
              </div>
              <h1
                className="text-[26px] font-extrabold tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Competitive Intelligence & Opportunity Engine
              </h1>
            </div>
          </div>
          <p className="text-[13px] text-slate-500 max-w-[950px] leading-[1.7]">
            14 capabilities organized into 7 interconnected systems. Track performance, rank every property, detect underperformers,
            find who owns them and when their debt expires, recognize patterns across reviews, wages, traffic, and business formations,
            project where a new deal would rank, and push opportunity alerts with strategies. Every underwritten deal feeds the brain.
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-8">
          {SYSTEMS.map((sys) => (
            <button
              key={sys.id}
              onClick={() => handleSystemChange(sys.id)}
              className="text-left transition-all duration-150 rounded-[10px] px-2 py-3 cursor-pointer"
              style={{
                background: activeSystem === sys.id ? `${sys.color}10` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${activeSystem === sys.id ? `${sys.color}35` : 'rgba(255,255,255,0.05)'}`,
                borderBottom: activeSystem === sys.id ? `2px solid ${sys.color}` : '2px solid transparent',
              }}
            >
              <div className="text-[9px] font-bold tracking-[0.1em] mb-1" style={{ color: sys.color }}>{sys.number}</div>
              <div className="text-[11px] font-bold leading-tight" style={{ color: activeSystem === sys.id ? '#f8fafc' : '#94a3b8' }}>{sys.title}</div>
              <div className="text-[9px] text-slate-600 mt-1">Items {sys.items.join(', ')}</div>
            </button>
          ))}
        </div>

        {activeSystem === 'performance' && (
          <div>
            <Card color="rgba(16,185,129,0.04)" border="1px solid rgba(16,185,129,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#10b981' }}>SYSTEM 1 — ITEMS 1, 2, 7, 8</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{PERFORMANCE_ENGINE.overview}</div>
            </Card>

            <Divider label="PERFORMANCE COMPOSITE SCORE — 5 COMPONENTS" color="#10b981" />
            <div className="grid grid-cols-2 gap-2.5">
              {PERFORMANCE_ENGINE.score_components.map((comp, i) => (
                <Card key={i} className={i === 4 ? 'col-span-2' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-extrabold" style={{ color: '#10b981' }}>{comp.name}</span>
                    <Pill color="#475569">{comp.source}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {comp.metrics.map((m, j) => (
                      <span key={j} className="text-[10px] text-slate-400 bg-black/30 px-2 py-0.5 rounded">{m}</span>
                    ))}
                  </div>
                  <CodeBlock color="#10b981">{comp.formula}</CodeBlock>
                </Card>
              ))}
            </div>

            <Divider label="RANKING OUTPUTS" color="#10b981" />
            <div className="grid grid-cols-3 gap-2.5">
              {PERFORMANCE_ENGINE.ranking_outputs.map((out, i) => (
                <Card key={i}>
                  <div className="text-xs font-bold text-slate-50 mb-1.5">{out.name}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mb-2">{out.description}</div>
                  <div className="text-[10px] text-slate-500 italic leading-snug">{out.display}</div>
                </Card>
              ))}
            </div>

            <Divider label="RANK-ME POSITIONING ENGINE — 'I WANT TO BE #2, WHAT DO I DO?'" color="#10b981" />
            <Card color="rgba(16,185,129,0.04)" border="1px solid rgba(16,185,129,0.15)">
              <div className="text-xs font-bold mb-2" style={{ color: '#10b981' }}>{PERFORMANCE_ENGINE.rank_me_tool.name}</div>
              <div className="text-[11px] text-slate-400 leading-relaxed mb-4">{PERFORMANCE_ENGINE.rank_me_tool.description}</div>
              <div className="space-y-2">
                {PERFORMANCE_ENGINE.rank_me_tool.workflow.map((step) => (
                  <div key={step.step} className="flex gap-3 bg-black/30 rounded-lg p-3">
                    <div className="text-sm font-extrabold font-mono w-8 shrink-0" style={{ color: '#10b981' }}>{step.step}</div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-50 mb-0.5">{step.action}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeSystem === 'acquisition' && (
          <div>
            <Card color="rgba(59,130,246,0.04)" border="1px solid rgba(59,130,246,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#3b82f6' }}>SYSTEM 2 — ITEMS 3, 4</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{ACQUISITION_ENGINE.overview}</div>
            </Card>

            <Divider label="UNDERPERFORMER DETECTION ALGORITHM" color="#3b82f6" />
            <Card color="rgba(59,130,246,0.04)" border="1px solid rgba(59,130,246,0.12)">
              <div className="text-xs font-bold mb-2" style={{ color: '#3b82f6' }}>{ACQUISITION_ENGINE.underperformer_detection.name}</div>
              <div className="text-[11px] text-slate-400 leading-relaxed mb-3">{ACQUISITION_ENGINE.underperformer_detection.concept}</div>
              <CodeBlock color="#3b82f6">{ACQUISITION_ENGINE.underperformer_detection.formula}</CodeBlock>
            </Card>

            <Divider label="VANTAGE GROUP TARGETING" color="#3b82f6" />
            <Card>
              <div className="text-[11px] text-slate-400 leading-relaxed mb-3">{ACQUISITION_ENGINE.underperformer_detection.vantage_group_targeting.concept}</div>
              <div className="space-y-1.5">
                {ACQUISITION_ENGINE.underperformer_detection.vantage_group_targeting.workflow.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start bg-black/30 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold font-mono shrink-0" style={{ color: '#3b82f6' }}>{i + 1}</span>
                    <span className="text-[10px] text-slate-400 leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Divider label="OWNERSHIP & DEBT INTELLIGENCE LAYER" color="#3b82f6" />
            <div className="text-[11px] text-slate-400 leading-relaxed mb-3">{ACQUISITION_ENGINE.ownership_intelligence.concept}</div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {ACQUISITION_ENGINE.ownership_intelligence.data_sources.map((src, i) => (
                <Card key={i}>
                  <div className="text-[11px] font-bold text-slate-50 mb-2">{src.source}</div>
                  <div className="space-y-1">
                    {src.data.map((d, j) => (
                      <div key={j} className="text-[10px] text-slate-400 flex gap-1.5 items-start">
                        <span className="text-blue-400 shrink-0">\u2022</span> {d}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <Divider label="DERIVED INTELLIGENCE SIGNALS" color="#3b82f6" />
            <div className="grid grid-cols-2 gap-2.5">
              {ACQUISITION_ENGINE.ownership_intelligence.derived_intelligence.map((sig, i) => (
                <Card key={i} color="rgba(59,130,246,0.04)" border="1px solid rgba(59,130,246,0.12)">
                  <div className="text-[11px] font-bold mb-1" style={{ color: '#3b82f6' }}>{sig.signal}</div>
                  <div className="text-[10px] text-slate-400 leading-snug">{sig.insight}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeSystem === 'comps' && (
          <div>
            <Card color="rgba(139,92,246,0.04)" border="1px solid rgba(139,92,246,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#8b5cf6' }}>SYSTEM 3 — ITEM 5</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{DUAL_COMPS.overview}</div>
            </Card>

            {[DUAL_COMPS.lens_1, DUAL_COMPS.lens_2].map((lens, i) => (
              <div key={i}>
                <Divider label={lens.name} color="#8b5cf6" />
                <div className="text-[11px] text-slate-500 mb-3">{lens.scope}</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {lens.patterns.map((p, j) => (
                    <Card key={j}>
                      <div className="text-[11px] font-bold text-slate-50 mb-1.5">{p.pattern}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{p.detection}</div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            <Divider label="COLLISION OUTPUT" color="#8b5cf6" />
            <Card color="rgba(139,92,246,0.04)" border="1px solid rgba(139,92,246,0.12)">
              <div className="text-[11px] text-slate-300 leading-relaxed">{DUAL_COMPS.collision_output}</div>
            </Card>
          </div>
        )}

        {activeSystem === 'patterns' && (
          <div>
            <Card color="rgba(245,158,11,0.04)" border="1px solid rgba(245,158,11,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#f59e0b' }}>SYSTEM 4 — ITEMS 6, 10, 11, 13</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{PATTERN_ENGINE.overview}</div>
            </Card>

            {PATTERN_ENGINE.categories.map((cat) => (
              <div key={cat.id}>
                <Divider label={cat.name.toUpperCase()} color={cat.color} />
                <div className="grid grid-cols-1 gap-2.5">
                  {cat.patterns.map((p, j) => (
                    <Card key={j}>
                      <div className="text-[11px] font-bold text-slate-50 mb-1">{p.pattern}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{p.detail}</div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSystem === 'projection' && (
          <div>
            <Card color="rgba(239,68,68,0.04)" border="1px solid rgba(239,68,68,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#ef4444' }}>SYSTEM 5 — ITEMS 7, 8</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{PROJECTION_ENGINE.overview}</div>
            </Card>

            <Divider label="RANK-ME POSITIONING ENGINE" color="#ef4444" />
            <Card color="rgba(239,68,68,0.04)" border="1px solid rgba(239,68,68,0.12)">
              <div className="text-xs font-bold mb-2" style={{ color: '#ef4444' }}>{PERFORMANCE_ENGINE.rank_me_tool.name}</div>
              <div className="text-[11px] text-slate-400 leading-relaxed mb-4">{PERFORMANCE_ENGINE.rank_me_tool.description}</div>
              <div className="space-y-2">
                {PERFORMANCE_ENGINE.rank_me_tool.workflow.map((step) => (
                  <div key={step.step} className="flex gap-3 bg-black/30 rounded-lg p-3">
                    <div className="text-sm font-extrabold font-mono w-8 shrink-0" style={{ color: '#ef4444' }}>{step.step}</div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-50 mb-0.5">{step.action}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Divider label="REDEVELOPMENT/REPOSITIONING SIMULATOR" color="#ef4444" />
            <div className="grid gap-2.5">
              {PROJECTION_ENGINE.scenarios.map((item, i) => (
                <Card key={i}>
                  <div className="text-xs font-bold text-slate-50 mb-1">{item.strategy}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">{item.projection}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeSystem === 'alerts' && (
          <div>
            <Card color="rgba(6,182,212,0.04)" border="1px solid rgba(6,182,212,0.15)">
              <div className="text-[11px] font-bold tracking-[0.05em] mb-1.5" style={{ color: '#06b6d4' }}>SYSTEM 6 — ITEM 9</div>
              <div className="text-[13px] text-slate-300 leading-[1.7]">{ALERT_SYSTEM.overview}</div>
            </Card>

            <Divider label="ALERT TYPES" color="#06b6d4" />
            <div className="grid gap-2.5">
              {ALERT_SYSTEM.alert_types.map((alert, i) => (
                <div
                  key={i}
                  onClick={() => toggle(`alert-${i}`)}
                  className="rounded-[10px] p-4 cursor-pointer transition-all duration-150"
                  style={{
                    background: expandedSection === `alert-${i}` ? `${alert.color}06` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${expandedSection === `alert-${i}` ? `${alert.color}25` : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{alert.icon}</span>
                    <span className="text-[13px] font-bold" style={{ color: alert.color }}>{alert.name}</span>
                    <Pill color={alert.color}>{alert.urgency}</Pill>
                    <span className="ml-auto text-[10px] text-slate-600">{expandedSection === `alert-${i}` ? '\u25b2' : '\u25bc'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <strong className="text-slate-400">Trigger:</strong> {alert.trigger}
                  </div>

                  {expandedSection === `alert-${i}` && (
                    <div className="mt-3 bg-black/30 rounded-lg p-3.5">
                      <div className="text-[10px] font-bold text-slate-600 tracking-[0.08em] mb-2">EXAMPLE ALERT</div>
                      <pre className="font-mono text-[10.5px] text-slate-300 leading-[1.7] whitespace-pre-wrap">{alert.example}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Divider label="DELIVERY CHANNELS" color="#06b6d4" />
            <div className="grid grid-cols-4 gap-2">
              {ALERT_SYSTEM.delivery.map((d, i) => (
                <Card key={i}>
                  <div className="text-[11px] font-bold text-slate-50 mb-1">{d.channel}</div>
                  <div className="text-[10px] text-slate-500 leading-snug">{d.frequency}</div>
                </Card>
              ))}
            </div>
          </div>
        )}


        <Divider label="MASTER CONNECTION MAP — HOW ALL 6 SYSTEMS INTERCONNECT" color="#94a3b8" />
        <div className="grid gap-1.5 mb-8">
          {CONNECTION_MAP.map((conn, i) => (
            <div
              key={i}
              className="grid items-center gap-2.5 rounded-lg px-3.5 py-2"
              style={{
                gridTemplateColumns: '200px 20px 200px 1fr',
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-[10px] font-semibold font-mono text-blue-400">{conn.from}</span>
              <span className="text-xs text-slate-700 text-center">\u2192</span>
              <span className="text-[10px] font-semibold font-mono text-amber-400">{conn.to}</span>
              <span className="text-[10px] text-slate-500 leading-snug">{conn.signal}</span>
            </div>
          ))}
        </div>

        <div className="text-center py-5 text-[9px] text-slate-800" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          JEDI RE · Competitive Intelligence & Opportunity Engine v1 · Extends Traffic Intelligence Framework
          <br />
          14 Capabilities · 6 Systems · Feeds M25 JEDI Score, M08 Strategy Arbitrage, M09 ProForma, M14 Risk Engine
        </div>
      </div>
    </div>
  );
}
