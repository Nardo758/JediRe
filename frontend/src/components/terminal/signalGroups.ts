/**
 * Signal Groups - JediRe Intelligence Framework
 * 70+ output signals across 9 categories
 */

export type SignalGroupId = 'DEMAND' | 'SUPPLY' | 'MOMENTUM' | 'POSITION' | 'RISK' | 'COMPOSITE' | 'TRAFFIC' | 'DEV_CAPACITY' | 'TRADE_AREA';

export interface SignalGroupConfig {
  id: SignalGroupId;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  question: string;
}

export const SIGNAL_GROUPS: Record<SignalGroupId, SignalGroupConfig> = {
  DEMAND: {
    id: 'DEMAND',
    name: 'Demand',
    color: '#22c55e',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: 'D',
    question: 'Do enough people want to live here?',
  },
  SUPPLY: {
    id: 'SUPPLY',
    name: 'Supply',
    color: '#ef4444',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: 'S',
    question: 'How much competition is being built?',
  },
  MOMENTUM: {
    id: 'MOMENTUM',
    name: 'Momentum',
    color: '#f97316',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    icon: 'M',
    question: 'Which direction are rents and values moving?',
  },
  POSITION: {
    id: 'POSITION',
    name: 'Position',
    color: '#a855f7',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: 'P',
    question: "What is the property's unique situation?",
  },
  RISK: {
    id: 'RISK',
    name: 'Risk',
    color: '#6b7280',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    icon: 'R',
    question: 'What could go wrong?',
  },
  COMPOSITE: {
    id: 'COMPOSITE',
    name: 'Composite / AI',
    color: '#14b8a6',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-700',
    icon: 'C',
    question: 'What does the AI recommend?',
  },
  TRAFFIC: {
    id: 'TRAFFIC',
    name: 'Traffic Engine',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: 'T',
    question: 'How many people walk in per week?',
  },
  DEV_CAPACITY: {
    id: 'DEV_CAPACITY',
    name: 'Dev Capacity',
    color: '#8b5cf6',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700',
    icon: 'DC',
    question: 'What COULD be built long-term?',
  },
  TRADE_AREA: {
    id: 'TRADE_AREA',
    name: 'Trade Area',
    color: '#ec4899',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-700',
    icon: 'TA',
    question: 'Who is the competitive set?',
  },
};

// Bloomberg Terminal color mappings
export const BT_SIGNAL_COLORS: Record<SignalGroupId, { primary: string; bg: string; border: string }> = {
  DEMAND: { primary: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
  SUPPLY: { primary: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  MOMENTUM: { primary: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  POSITION: { primary: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)' },
  RISK: { primary: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  COMPOSITE: { primary: '#14b8a6', bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.3)' },
  TRAFFIC: { primary: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  DEV_CAPACITY: { primary: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
  TRADE_AREA: { primary: '#ec4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' },
};

export type OutputLevel = 'MSA' | 'Submarket' | 'Property' | 'Project' | 'Parcel' | 'Road Segment' | 'Trade Area' | 'Parcel Cluster' | 'All levels';

export interface OutputDefinition {
  id: string;
  name: string;
  group: SignalGroupId;
  level: OutputLevel;
  source: string;
  cost: 'FREE' | 'COMPUTED' | 'PAID';
  frequency: string;
  isNew?: boolean;
}

export const ALL_OUTPUTS: OutputDefinition[] = [
  // DEMAND signals (D-01 to D-12)
  { id: 'D-01', name: 'Jobs-to-Apartments Ratio', group: 'DEMAND', level: 'MSA', source: 'BLS API + S-01', cost: 'FREE', frequency: 'Monthly' },
  { id: 'D-02', name: 'New Jobs to New Units Ratio', group: 'DEMAND', level: 'MSA', source: 'BLS + S-02', cost: 'FREE', frequency: 'Monthly' },
  { id: 'D-03', name: 'Net Migration to New Supply', group: 'DEMAND', level: 'MSA', source: 'Census + S-02', cost: 'FREE', frequency: 'Annual' },
  { id: 'D-04', name: 'Household Formation to Supply', group: 'DEMAND', level: 'MSA', source: 'Census + S-02', cost: 'FREE', frequency: 'Annual' },
  { id: 'D-05', name: 'Traffic Count Growth Rate', group: 'DEMAND', level: 'Road Segment', source: 'State DOT', cost: 'FREE', frequency: 'Annual' },
  { id: 'D-06', name: 'Traffic Acceleration', group: 'DEMAND', level: 'Road Segment', source: 'D-05 time series', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'D-07', name: 'Digital-Physical Traffic Gap', group: 'DEMAND', level: 'Submarket', source: 'Google Trends + DOT', cost: 'FREE', frequency: 'Monthly' },
  { id: 'D-08', name: 'Search Interest Volume', group: 'DEMAND', level: 'Submarket', source: 'Google Trends API', cost: 'FREE', frequency: 'Weekly' },
  { id: 'D-09', name: 'Demand Momentum Score', group: 'DEMAND', level: 'MSA', source: 'All D outputs', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'D-10', name: 'Employment Gravity Score', group: 'DEMAND', level: 'Submarket', source: 'BLS + Census LODES', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'D-11', name: 'Rent-to-Mortgage Discount', group: 'DEMAND', level: 'MSA', source: 'M-01 + Freddie Mac', cost: 'FREE', frequency: 'Monthly' },
  { id: 'D-12', name: 'Population & Demographics', group: 'DEMAND', level: 'MSA', source: 'Census ACS', cost: 'FREE', frequency: 'Annual' },

  // SUPPLY signals (S-01 to S-10)
  { id: 'S-01', name: 'Existing Inventory Map', group: 'SUPPLY', level: 'Property', source: 'Municipal Records', cost: 'FREE', frequency: 'Real-time' },
  { id: 'S-02', name: 'Pipeline: Under Construction', group: 'SUPPLY', level: 'Project', source: 'Municipal Permits', cost: 'FREE', frequency: 'Monthly' },
  { id: 'S-03', name: 'Pipeline: Permitted Not Started', group: 'SUPPLY', level: 'Project', source: 'Municipal Permits', cost: 'FREE', frequency: 'Monthly' },
  { id: 'S-04', name: 'Absorption Runway', group: 'SUPPLY', level: 'MSA', source: 'S-02+03 / Historical', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'S-05', name: 'Delivery Clustering', group: 'SUPPLY', level: 'Submarket', source: 'S-02 geospatial+time', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'S-06', name: 'Permit Momentum', group: 'SUPPLY', level: 'MSA', source: 'S-03 trend', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'S-07', name: 'Construction Cost vs Rent Yield', group: 'SUPPLY', level: 'MSA', source: 'RSMeans + M-01', cost: 'PAID', frequency: 'Quarterly' },
  { id: 'S-08', name: 'Saturation Index', group: 'SUPPLY', level: 'Submarket', source: 'S-01 / D-12 + S-02', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'S-09', name: 'Permit-to-Delivery Conversion', group: 'SUPPLY', level: 'MSA', source: 'Historical S-03→S-02', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'S-10', name: 'Vintage Breakdown', group: 'SUPPLY', level: 'MSA', source: 'P-01 year_built', cost: 'FREE', frequency: 'Real-time' },

  // MOMENTUM signals (M-01 to M-10)
  { id: 'M-01', name: 'Rent Trends by Vintage Class', group: 'MOMENTUM', level: 'MSA', source: 'Apartments.com', cost: 'PAID', frequency: 'Weekly' },
  { id: 'M-02', name: 'Rent Acceleration Rate', group: 'MOMENTUM', level: 'MSA', source: 'M-01 2nd derivative', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'M-03', name: 'Concession Tracking', group: 'MOMENTUM', level: 'Property', source: 'Apartments.com', cost: 'PAID', frequency: 'Weekly' },
  { id: 'M-04', name: 'Concession Velocity', group: 'MOMENTUM', level: 'MSA', source: 'M-03 trend', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'M-05', name: 'Rent vs Wage Growth Spread', group: 'MOMENTUM', level: 'MSA', source: 'M-01 + BLS wages', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'M-06', name: 'Occupancy Proxy', group: 'MOMENTUM', level: 'Property', source: 'Apartments.com', cost: 'PAID', frequency: 'Weekly' },
  { id: 'M-07', name: 'Traffic-to-Rent Elasticity', group: 'MOMENTUM', level: 'Submarket', source: 'D-05 + M-01', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'M-08', name: 'Cap Rate Trends', group: 'MOMENTUM', level: 'MSA', source: 'Municipal sale records', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'M-09', name: 'Investor Activity Index', group: 'MOMENTUM', level: 'MSA', source: 'Municipal deed freq.', cost: 'FREE', frequency: 'Monthly' },
  { id: 'M-10', name: 'Review Sentiment Score', group: 'MOMENTUM', level: 'Property', source: 'Google Places', cost: 'FREE', frequency: 'Monthly' },

  // POSITION signals (P-01 to P-12)
  { id: 'P-01', name: 'Property Card (Municipal)', group: 'POSITION', level: 'Property', source: 'Municipal Records', cost: 'FREE', frequency: 'Real-time' },
  { id: 'P-02', name: 'Vintage Classification', group: 'POSITION', level: 'Property', source: 'P-01 year_built', cost: 'COMPUTED', frequency: 'Static' },
  { id: 'P-03', name: 'Loss-to-Lease Estimate', group: 'POSITION', level: 'Property', source: 'M-01 comp - actual', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'P-04', name: 'Ownership Profile & Hold Period', group: 'POSITION', level: 'Property', source: 'Municipal Deeds', cost: 'FREE', frequency: 'Real-time' },
  { id: 'P-05', name: 'Seller Motivation Score', group: 'POSITION', level: 'Property', source: 'P-04 + R-09 + patterns', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'P-06', name: 'Tax Assessment & Step-Up Risk', group: 'POSITION', level: 'Property', source: 'Municipal Tax Records', cost: 'FREE', frequency: 'Annual' },
  { id: 'P-07', name: 'Price/Unit Benchmarks', group: 'POSITION', level: 'MSA', source: 'Municipal sale records', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'P-08', name: 'Zoning & Development Capacity', group: 'POSITION', level: 'Property', source: 'Municipal Zoning', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'P-09', name: 'Amenity Density Score', group: 'POSITION', level: 'Property', source: 'Google Places API', cost: 'FREE', frequency: 'Monthly' },
  { id: 'P-10', name: 'Revenue Conversion Efficiency', group: 'POSITION', level: 'Property', source: 'PMS Integration', cost: 'PAID', frequency: 'Monthly' },
  { id: 'P-11', name: 'Expense Efficiency Gap', group: 'POSITION', level: 'Property', source: 'PMS Integration', cost: 'PAID', frequency: 'Monthly' },
  { id: 'P-12', name: 'Turnover Cost Impact', group: 'POSITION', level: 'Property', source: 'PMS Integration', cost: 'PAID', frequency: 'Monthly' },

  // RISK signals (R-01 to R-10)
  { id: 'R-01', name: 'Affordability Absorption Threshold', group: 'RISK', level: 'MSA', source: 'Census + M-01', cost: 'FREE', frequency: 'Quarterly' },
  { id: 'R-02', name: 'Vintage Convergence Rate', group: 'RISK', level: 'MSA', source: 'M-01 spread trend', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'R-03', name: 'Concession Drag Rate', group: 'RISK', level: 'MSA', source: 'M-03 / M-01', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'R-04', name: 'Insurance Cost Trends', group: 'RISK', level: 'MSA', source: 'Industry reports', cost: 'PAID', frequency: 'Annual' },
  { id: 'R-05', name: 'Tax Reassessment Risk', group: 'RISK', level: 'Property', source: 'P-06 + sale price', cost: 'COMPUTED', frequency: 'On txn' },
  { id: 'R-06', name: 'Deferred Maintenance Estimate', group: 'RISK', level: 'Property', source: 'P-01 age + P-10/11', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'R-07', name: 'Ownership Concentration Risk', group: 'RISK', level: 'Submarket', source: 'P-04 aggregated', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'R-08', name: 'Seasonal Traffic Swing', group: 'RISK', level: 'Property', source: 'D-05 seasonal var.', cost: 'COMPUTED', frequency: 'Annual' },
  { id: 'R-09', name: 'Owner Hold Period vs Market Cycle', group: 'RISK', level: 'Property', source: 'P-04 + M-08 trend', cost: 'COMPUTED', frequency: 'Quarterly' },
  { id: 'R-10', name: 'News Sentiment & Alerts', group: 'RISK', level: 'MSA', source: 'NewsAPI + Email', cost: 'PAID', frequency: 'Real-time' },

  // COMPOSITE signals (C-01 to C-10)
  { id: 'C-01', name: 'JEDI Score (0-100)', group: 'COMPOSITE', level: 'All levels', source: 'All 5 master signals', cost: 'COMPUTED', frequency: 'Daily' },
  { id: 'C-02', name: 'Rent Growth Forecast (AI)', group: 'COMPOSITE', level: 'MSA', source: 'All demand+supply+momentum', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'C-03', name: 'Occupancy Trajectory Model', group: 'COMPOSITE', level: 'MSA', source: 'Supply + demand + momentum', cost: 'COMPUTED', frequency: 'Monthly' },
  { id: 'C-04', name: 'Broker OM Variance Report', group: 'COMPOSITE', level: 'Property', source: 'OM inputs vs AI outputs', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-05', name: 'Strategy Arbitrage Score', group: 'COMPOSITE', level: 'Property', source: 'All strategy analyses', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-06', name: 'Apt-to-Condo Conversion Spread', group: 'COMPOSITE', level: 'Property', source: 'M-01 + condo comps', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-07', name: 'Build-to-Rent vs Hold Breakeven', group: 'COMPOSITE', level: 'Property', source: 'S-07 + P-07 + M-01', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-08', name: 'STR Hybrid Revenue Uplift', group: 'COMPOSITE', level: 'Property', source: 'LTR NOI vs STR model', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-09', name: 'Sensitivity Scenario Generator', group: 'COMPOSITE', level: 'Property', source: 'Monte Carlo', cost: 'COMPUTED', frequency: 'Per deal' },
  { id: 'C-10', name: 'Submarket Ranking Report', group: 'COMPOSITE', level: 'Submarket', source: 'C-01 per submarket', cost: 'COMPUTED', frequency: 'Monthly' },

  // TRAFFIC signals (T-01 to T-10)
  { id: 'T-01', name: 'Weekly Walk-In Prediction', group: 'TRAFFIC', level: 'Property', source: 'ADT + Census + Generators', cost: 'COMPUTED', frequency: 'Daily', isNew: true },
  { id: 'T-02', name: 'Physical Traffic Score (0-100)', group: 'TRAFFIC', level: 'Property', source: 'State DOT + Road Class', cost: 'FREE', frequency: 'Monthly', isNew: true },
  { id: 'T-03', name: 'Digital Traffic Score (0-100)', group: 'TRAFFIC', level: 'Property', source: 'Google Trends + Platform', cost: 'FREE', frequency: 'Weekly', isNew: true },
  { id: 'T-04', name: 'Traffic Correlation Signal', group: 'TRAFFIC', level: 'Property', source: 'T-02 vs T-03 matrix', cost: 'COMPUTED', frequency: 'Weekly', isNew: true },
  { id: 'T-05', name: 'Traffic-to-Lease Prediction', group: 'TRAFFIC', level: 'Property', source: 'T-01 + T-03 ML model', cost: 'COMPUTED', frequency: 'Weekly', isNew: true },
  { id: 'T-06', name: 'Capture Rate', group: 'TRAFFIC', level: 'Property', source: 'Frontage + Corner + Setback', cost: 'FREE', frequency: 'Static', isNew: true },
  { id: 'T-07', name: 'Property Traffic Trajectory', group: 'TRAFFIC', level: 'Property', source: 'T-01 8-week time series', cost: 'COMPUTED', frequency: 'Weekly', isNew: true },
  { id: 'T-08', name: 'Generator Proximity Score', group: 'TRAFFIC', level: 'Property', source: 'Census + BLS + Transit', cost: 'FREE', frequency: 'Monthly', isNew: true },
  { id: 'T-09', name: 'Competitive Traffic Share', group: 'TRAFFIC', level: 'Property', source: 'T-01 subject / trade area', cost: 'COMPUTED', frequency: 'Weekly', isNew: true },
  { id: 'T-10', name: 'Traffic Validation Confidence', group: 'TRAFFIC', level: 'Property', source: 'User actuals vs predicted', cost: 'FREE', frequency: 'Ongoing', isNew: true },

  // DEV_CAPACITY signals (DC-01 to DC-11)
  { id: 'DC-01', name: 'Capacity Ratio', group: 'DEV_CAPACITY', level: 'Submarket', source: 'Zoning + Vacant Parcels / S-01', cost: 'FREE', frequency: 'Quarterly', isNew: true },
  { id: 'DC-02', name: 'Buildout Timeline', group: 'DEV_CAPACITY', level: 'Submarket', source: 'Weighted Capacity / Annual Abs.', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-03', name: 'Supply Constraint Score (0-100)', group: 'DEV_CAPACITY', level: 'Submarket', source: 'Composite: zoning + land', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-04', name: 'Supply Overhang Risk', group: 'DEV_CAPACITY', level: 'Submarket', source: '(Capacity - Pipeline) / Inventory', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-05', name: 'Last Mover Advantage Flag', group: 'DEV_CAPACITY', level: 'Submarket', source: 'Capacity < 15% + Active Dev', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-06', name: 'Development Probability', group: 'DEV_CAPACITY', level: 'Parcel', source: 'Owner + zoning + infra + market', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-07', name: 'Pricing Power Index (0-100)', group: 'DEV_CAPACITY', level: 'Submarket', source: 'DC-03 40% + D-01 25% + M-06 20%', cost: 'COMPUTED', frequency: 'Monthly', isNew: true },
  { id: 'DC-08', name: 'Supply Wave Forecast (10yr)', group: 'DEV_CAPACITY', level: 'MSA', source: 'S-02 + S-03 + DC-06 weighted', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-09', name: 'Developer Land Bank Index', group: 'DEV_CAPACITY', level: 'Submarket', source: 'Parcel ownership + DC-06', cost: 'FREE', frequency: 'Quarterly', isNew: true },
  { id: 'DC-10', name: 'Assemblage Opportunity Score', group: 'DEV_CAPACITY', level: 'Parcel Cluster', source: 'Spatial adjacency + capacity', cost: 'COMPUTED', frequency: 'Quarterly', isNew: true },
  { id: 'DC-11', name: 'Supply-Adjusted Rent Forecast', group: 'DEV_CAPACITY', level: 'Submarket', source: 'C-02 base +/- DC-03 factor', cost: 'COMPUTED', frequency: 'Monthly', isNew: true },

  // TRADE_AREA signals (TA-01 to TA-04)
  { id: 'TA-01', name: 'Trade Area Definition', group: 'TRADE_AREA', level: 'Property', source: 'Radius / Drive-time / Custom', cost: 'FREE', frequency: 'User-set', isNew: true },
  { id: 'TA-02', name: 'Competitive Set', group: 'TRADE_AREA', level: 'Property', source: 'S-01 in TA + P-02 vintage', cost: 'COMPUTED', frequency: 'Monthly', isNew: true },
  { id: 'TA-03', name: 'Trade Area Supply-Demand Balance', group: 'TRADE_AREA', level: 'Trade Area', source: 'D-01 + S-01 within polygon', cost: 'COMPUTED', frequency: 'Monthly', isNew: true },
  { id: 'TA-04', name: 'Digital Competitive Intel', group: 'TRADE_AREA', level: 'Property', source: 'SpyFu / SimilarWeb', cost: 'PAID', frequency: 'Monthly', isNew: true },
];

// Quadrant classification for deals/properties
export type Quadrant = 'Hidden Gem' | 'Validated Winner' | 'Hype Risk' | 'Dead Weight';

export const QUADRANT_STYLES: Record<Quadrant, { bg: string; text: string; btBg: string; btText: string }> = {
  'Hidden Gem': { bg: 'bg-emerald-100', text: 'text-emerald-800', btBg: 'rgba(16,185,129,0.15)', btText: '#10b981' },
  'Validated Winner': { bg: 'bg-blue-100', text: 'text-blue-800', btBg: 'rgba(59,130,246,0.15)', btText: '#3b82f6' },
  'Hype Risk': { bg: 'bg-orange-100', text: 'text-orange-800', btBg: 'rgba(249,115,22,0.15)', btText: '#f97316' },
  'Dead Weight': { bg: 'bg-red-100', text: 'text-red-800', btBg: 'rgba(239,68,68,0.15)', btText: '#ef4444' },
};

// Lifecycle phases
export type LifecyclePhase = 'Emergence' | 'Acceleration' | 'Maturation' | 'Contraction';

export const LIFECYCLE_STYLES: Record<LifecyclePhase, { bg: string; text: string; icon: string; btBg: string; btText: string }> = {
  'Emergence': { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: '🌱', btBg: 'rgba(6,182,212,0.15)', btText: '#06b6d4' },
  'Acceleration': { bg: 'bg-green-100', text: 'text-green-800', icon: '🚀', btBg: 'rgba(34,197,94,0.15)', btText: '#22c55e' },
  'Maturation': { bg: 'bg-amber-100', text: 'text-amber-800', icon: '🏛️', btBg: 'rgba(245,158,11,0.15)', btText: '#f59e0b' },
  'Contraction': { bg: 'bg-red-100', text: 'text-red-800', icon: '📉', btBg: 'rgba(239,68,68,0.15)', btText: '#ef4444' },
};

// Supply wave phases
export type SupplyWavePhase = 'PEAKING' | 'BUILDING' | 'PAST PEAK' | 'TROUGH';

export const SUPPLY_WAVE_STYLES: Record<SupplyWavePhase, { bg: string; text: string; btBg: string; btText: string }> = {
  'PEAKING': { bg: 'bg-red-100', text: 'text-red-800', btBg: 'rgba(239,68,68,0.15)', btText: '#ef4444' },
  'BUILDING': { bg: 'bg-blue-100', text: 'text-blue-800', btBg: 'rgba(59,130,246,0.15)', btText: '#3b82f6' },
  'PAST PEAK': { bg: 'bg-green-100', text: 'text-green-800', btBg: 'rgba(34,197,94,0.15)', btText: '#22c55e' },
  'TROUGH': { bg: 'bg-emerald-100', text: 'text-emerald-800', btBg: 'rgba(16,185,129,0.15)', btText: '#10b981' },
};

// Traffic qualification
export type TrafficQualification = 'Qualified' | 'Marginal' | 'Disqualified';

export const TRAFFIC_QUAL_STYLES: Record<TrafficQualification, { icon: string; color: string; bg: string; btBg: string; btText: string }> = {
  'Qualified': { icon: '✓', color: 'text-green-700', bg: 'bg-green-50', btBg: 'rgba(34,197,94,0.15)', btText: '#22c55e' },
  'Marginal': { icon: '⚠', color: 'text-amber-700', bg: 'bg-amber-50', btBg: 'rgba(245,158,11,0.15)', btText: '#f59e0b' },
  'Disqualified': { icon: '✗', color: 'text-red-700', bg: 'bg-red-50', btBg: 'rgba(239,68,68,0.15)', btText: '#ef4444' },
};

// PCS (Property Competitive Score) components
export interface PCSComponents {
  trafficPerformance: number;
  revenueStrength: number;
  operationalQuality: number;
  assetCondition: number;
  marketPosition: number;
}

export function calculatePCS(components: PCSComponents): number {
  const weights = { trafficPerformance: 0.25, revenueStrength: 0.25, operationalQuality: 0.20, assetCondition: 0.15, marketPosition: 0.15 };
  return Math.round(
    components.trafficPerformance * weights.trafficPerformance +
    components.revenueStrength * weights.revenueStrength +
    components.operationalQuality * weights.operationalQuality +
    components.assetCondition * weights.assetCondition +
    components.marketPosition * weights.marketPosition
  );
}

// Helpers
export function getOutput(id: string): OutputDefinition | undefined {
  return ALL_OUTPUTS.find(o => o.id === id);
}

export function getOutputsByGroup(group: SignalGroupId): OutputDefinition[] {
  return ALL_OUTPUTS.filter(o => o.group === group);
}

export function getOutputsByLevel(level: OutputLevel): OutputDefinition[] {
  return ALL_OUTPUTS.filter(o => o.level === level || o.level === 'All levels');
}

export function getGroupForOutput(id: string): SignalGroupConfig | undefined {
  const output = getOutput(id);
  if (!output) return undefined;
  return SIGNAL_GROUPS[output.group];
}

export function scoreColor(score: number): { bg: string; text: string; btBg: string; btText: string } {
  if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-800', btBg: 'rgba(34,197,94,0.2)', btText: '#22c55e' };
  if (score >= 60) return { bg: 'bg-emerald-50', text: 'text-emerald-700', btBg: 'rgba(16,185,129,0.15)', btText: '#10b981' };
  if (score >= 40) return { bg: 'bg-yellow-50', text: 'text-yellow-700', btBg: 'rgba(234,179,8,0.15)', btText: '#eab308' };
  if (score >= 20) return { bg: 'bg-orange-50', text: 'text-orange-700', btBg: 'rgba(249,115,22,0.15)', btText: '#f97316' };
  return { bg: 'bg-red-50', text: 'text-red-700', btBg: 'rgba(239,68,68,0.15)', btText: '#ef4444' };
}
