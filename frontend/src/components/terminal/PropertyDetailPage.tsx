/**
 * PropertyDetailPage - Full Bloomberg-style property detail view
 * 
 * Layout (similar to MSA Overview):
 * - Header ticker bar
 * - Charts section at top (performance over time)
 * - Tab buttons for metric categories
 * - Detail sections based on active tab
 * 
 * Tabs:
 * 1. OVERVIEW - Images, key metrics, property details
 * 2. PERFORMANCE - Rent/occupancy/NOI trends over time, vs comps
 * 3. OWNERSHIP - Owner info, acquisition date, sale history
 * 4. TAX & SALES - Tax history, sale history
 * 5. DEMOGRAPHICS - Trade area demographics (1mi, 3mi, 5mi)
 * 6. MARKET - Submarket & MSA context
 * 7. FINANCIALS - Revenue, expenses, NOI, debt, cash flow
 * 8. COMPS - Comparable properties detail
 */

import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, MapPin, Building2, Calendar, Users, 
  DollarSign, Percent, Clock, BarChart3, Home, ChevronRight,
  FileText, Map, PieChart, History, Landmark
} from 'lucide-react';
import { BT, fmt, terminalStyles } from './theme';

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface PropertyImage {
  url: string;
  caption?: string;
}

interface SaleRecord {
  date: string;
  price: number;
  pricePerUnit?: number;
  buyer?: string;
  seller?: string;
  capRate?: number;
}

interface TaxRecord {
  year: number;
  assessed: number;
  taxAmount: number;
  changeYoY?: number;
}

interface DemographicData {
  radius: string;
  population: number;
  popGrowth: number;
  medianIncome: number;
  incomeGrowth: number;
  avgAge: number;
  collegeEducated: number;
  employmentRate: number;
  households: number;
}

interface HistoricalMetric {
  period: string;
  rent: number;
  occupancy: number;
  noi?: number;
  concessions?: number;
}

interface CompProperty {
  name: string;
  address?: string;
  units: number;
  avgRent: number;
  rentGrowthYoY?: number;
  occupancy: number;
  capRate?: number;
  yearBuilt?: number;
  distance?: string;
  class?: string;
}

interface PropertyFinancials {
  revenue?: number;
  expenses?: number;
  noi?: number;
  debtService?: number;
  cashFlow?: number;
  capRate?: number;
  purchasePrice?: number;
  currentValue?: number;
  equity?: number;
  ltv?: number;
  dscr?: number;
}

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  submarket: string;
  submarketId?: string;
  msa: string;
  msaId?: string;
  class: 'A' | 'B' | 'C';
  propertyType?: string;
  
  // Physical
  units: number;
  sqft?: number;
  yearBuilt: number;
  yearRenovated?: number;
  stories?: number;
  
  // Performance
  avgRent: number;
  rentChange: number;
  rentChangePercent: number;
  occupancy: number;
  occupancyChange?: number;
  leaseUpMonths?: number;
  concessions?: number;
  
  // Ownership
  owner?: string;
  ownerType?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  
  // Scores
  jediScore?: number;
  strategyScore?: number;
  
  // Media
  images?: PropertyImage[];
  
  // Historical
  historicalPerformance?: HistoricalMetric[];
  saleHistory?: SaleRecord[];
  taxHistory?: TaxRecord[];
  demographics?: DemographicData[];
  
  // Financials
  financials?: PropertyFinancials;
}

interface PropertyDetailPageProps {
  property: PropertyData;
  comps?: CompProperty[];
  sparklineData?: number[];
  onBack?: () => void;
  onCompClick?: (compId: string) => void;
  onSubmarketClick?: (submarketId: string) => void;
  onMsaClick?: (msaId: string) => void;
}

type TabKey = 'overview' | 'performance' | 'ownership' | 'tax' | 'demographics' | 'market' | 'financials' | 'comps';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'OVERVIEW', icon: <Home size={12} /> },
  { key: 'performance', label: 'PERFORMANCE', icon: <BarChart3 size={12} /> },
  { key: 'ownership', label: 'OWNERSHIP', icon: <Users size={12} /> },
  { key: 'tax', label: 'TAX & SALES', icon: <Landmark size={12} /> },
  { key: 'demographics', label: 'DEMOGRAPHICS', icon: <PieChart size={12} /> },
  { key: 'market', label: 'MARKET', icon: <Map size={12} /> },
  { key: 'financials', label: 'FINANCIALS', icon: <DollarSign size={12} /> },
  { key: 'comps', label: 'COMPS', icon: <Building2 size={12} /> },
];

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data, color, width = 100, height = 28,
}) => {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Multi-line chart component
const LineChart: React.FC<{
  title: string;
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
}> = ({ title, labels, series, height = 160 }) => {
  const allValues = series.flatMap(s => s.data);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const chartWidth = 100;
  
  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 12, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Y-axis labels */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 8, color: BT.text.muted, width: 40, textAlign: 'right' }}>
          <span>{typeof max === 'number' && max < 100 ? max.toFixed(1) : max.toLocaleString()}</span>
          <span>{typeof min === 'number' && min < 100 ? min.toFixed(1) : min.toLocaleString()}</span>
        </div>
        {/* Chart area */}
        <div style={{ flex: 1 }}>
          <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <line key={i} x1="0" y1={pct * height} x2={chartWidth} y2={pct * height} stroke={BT.border.subtle} strokeWidth="0.5" />
            ))}
            {/* Data lines */}
            {series.map((s, si) => {
              const points = s.data.map((v, i) => {
                const x = (i / (s.data.length - 1)) * chartWidth;
                const y = height - ((v - min) / range) * (height - 8) - 4;
                return `${x},${y}`;
              }).join(' ');
              return <polyline key={si} points={points} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
            })}
          </svg>
          {/* X-axis labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: BT.text.muted, marginTop: 4 }}>
            {labels.filter((_, i) => i % Math.ceil(labels.length / 5) === 0 || i === labels.length - 1).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
            <span style={{ width: 12, height: 2, background: s.color }} />
            <span style={{ color: BT.text.secondary }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ 
  label: string; 
  value: string | number; 
  subtext?: string;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
}> = ({ label, value, subtext, color = BT.text.primary, trend, trendValue }) => (
  <div style={{
    background: BT.bg.panel,
    border: `1px solid ${BT.border.subtle}`,
    padding: '12px 16px',
    flex: 1,
    minWidth: 120,
  }}>
    <div style={{ fontSize: 9, fontWeight: 600, color: BT.text.muted, letterSpacing: '0.08em', marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
      {trend && trendValue && (
        <span style={{ 
          fontSize: 11, 
          fontWeight: 600, 
          color: trend === 'up' ? BT.text.green : trend === 'down' ? BT.text.red : BT.text.muted,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}>
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
          {trendValue}
        </span>
      )}
    </div>
    {subtext && (
      <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>{subtext}</div>
    )}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    padding: '12px 0',
    borderBottom: `1px solid ${BT.border.subtle}`,
    marginBottom: 12,
  }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em' }}>{title}</span>
    {subtitle && <span style={{ fontSize: 10, color: BT.text.muted }}>{subtitle}</span>}
  </div>
);

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_HISTORICAL: HistoricalMetric[] = [
  { period: 'Q1 24', rent: 2180, occupancy: 93.2, noi: 180000, concessions: 420 },
  { period: 'Q2 24', rent: 2220, occupancy: 93.8, noi: 185000, concessions: 380 },
  { period: 'Q3 24', rent: 2280, occupancy: 94.5, noi: 192000, concessions: 320 },
  { period: 'Q4 24', rent: 2320, occupancy: 95.1, noi: 198000, concessions: 280 },
  { period: 'Q1 25', rent: 2380, occupancy: 95.6, noi: 205000, concessions: 240 },
  { period: 'Q2 25', rent: 2420, occupancy: 96.0, noi: 212000, concessions: 200 },
  { period: 'Q3 25', rent: 2450, occupancy: 96.2, noi: 218000, concessions: 180 },
];

const MOCK_SALE_HISTORY: SaleRecord[] = [
  { date: 'Mar 2022', price: 85000000, pricePerUnit: 206310, buyer: 'Greystar', seller: 'CBRE GI', capRate: 4.2 },
  { date: 'Jun 2018', price: 62000000, pricePerUnit: 150485, buyer: 'CBRE GI', seller: 'Hines', capRate: 5.1 },
  { date: 'Sep 2014', price: 48000000, pricePerUnit: 116504, buyer: 'Hines', seller: 'Original Dev', capRate: 5.8 },
];

const MOCK_TAX_HISTORY: TaxRecord[] = [
  { year: 2025, assessed: 78500000, taxAmount: 1412000, changeYoY: 4.2 },
  { year: 2024, assessed: 75300000, taxAmount: 1355400, changeYoY: 3.8 },
  { year: 2023, assessed: 72500000, taxAmount: 1305000, changeYoY: 5.1 },
  { year: 2022, assessed: 69000000, taxAmount: 1242000, changeYoY: 12.4 },
  { year: 2021, assessed: 61400000, taxAmount: 1105200, changeYoY: 2.8 },
];

const MOCK_DEMOGRAPHICS: DemographicData[] = [
  { radius: '1 mile', population: 28500, popGrowth: 2.4, medianIncome: 86200, incomeGrowth: 4.1, avgAge: 32, collegeEducated: 68, employmentRate: 96.2, households: 14200 },
  { radius: '3 mile', population: 142000, popGrowth: 1.9, medianIncome: 74500, incomeGrowth: 3.6, avgAge: 34, collegeEducated: 58, employmentRate: 95.1, households: 62400 },
  { radius: '5 mile', population: 385000, popGrowth: 1.6, medianIncome: 68200, incomeGrowth: 3.2, avgAge: 35, collegeEducated: 52, employmentRate: 94.5, households: 158000 },
];

const MOCK_COMPS: CompProperty[] = [
  { name: 'Hanover Midtown', units: 370, avgRent: 2280, rentGrowthYoY: 4.8, occupancy: 94.2, capRate: 5.2, yearBuilt: 2018, distance: '0.3 mi', class: 'A' },
  { name: 'Alexan Buckhead', units: 290, avgRent: 1950, rentGrowthYoY: 3.9, occupancy: 95.0, capRate: 5.5, yearBuilt: 2015, distance: '0.5 mi', class: 'A' },
  { name: 'The Darcy', units: 265, avgRent: 2380, rentGrowthYoY: 6.1, occupancy: 92.8, capRate: 4.6, yearBuilt: 2021, distance: '0.8 mi', class: 'A' },
  { name: 'Camden Atlantic', units: 420, avgRent: 2150, rentGrowthYoY: 4.2, occupancy: 93.5, capRate: 5.0, yearBuilt: 2019, distance: '1.2 mi', class: 'A' },
  { name: 'Post Midtown', units: 340, avgRent: 2050, rentGrowthYoY: 3.5, occupancy: 94.8, capRate: 5.3, yearBuilt: 2016, distance: '0.6 mi', class: 'B' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property,
  comps = MOCK_COMPS,
  sparklineData = [],
  onBack,
  onCompClick,
  onSubmarketClick,
  onMsaClick,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const images = property.images || [
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Exterior', caption: 'Exterior' },
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Interior', caption: 'Interior' },
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Amenities', caption: 'Amenities' },
  ];

  const historical = property.historicalPerformance || MOCK_HISTORICAL;
  const saleHistory = property.saleHistory || MOCK_SALE_HISTORY;
  const taxHistory = property.taxHistory || MOCK_TAX_HISTORY;
  const demographics = property.demographics || MOCK_DEMOGRAPHICS;

  const defaultSparkline = sparklineData.length > 0 ? sparklineData : historical.map(h => h.rent);
  const rentTrend = property.rentChange >= 0 ? 'up' : 'down';
  const occTrend = (property.occupancyChange || 0) >= 0 ? 'up' : 'down';

  const getClassColor = (cls: string) => cls === 'A' ? BT.text.green : cls === 'B' ? BT.text.amber : BT.text.red;
  const getScoreColor = (score: number) => score >= 75 ? BT.text.green : score >= 55 ? BT.text.amber : BT.text.red;

  const hasFinancials = property.financials && (property.financials.noi || property.financials.revenue);

  // ─── RENDER TABS ────────────────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <>
      {/* Images + Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
            {[0, 1, 2].map((idx) => {
              const img = images[idx] || images[0];
              return (
                <div key={idx} onClick={() => setActiveImageIndex(idx)} style={{
                  position: 'relative', height: 140, overflow: 'hidden', cursor: 'pointer',
                  border: activeImageIndex === idx ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                }}>
                  <img src={img?.url} alt={img?.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {img?.caption && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 4px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', fontSize: 9, color: BT.text.secondary, textTransform: 'uppercase' }}>
                      {img.caption}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
            <MapPin size={14} color={BT.text.amber} />
            <span style={{ fontSize: 12, color: BT.text.primary }}>{property.address}</span>
            <span style={{ color: BT.text.muted }}>•</span>
            <span onClick={() => onSubmarketClick?.(property.submarketId || '')} style={{ fontSize: 11, color: BT.text.cyan, cursor: 'pointer' }}>{property.submarket}</span>
            <span style={{ color: BT.text.muted }}>•</span>
            <span onClick={() => onMsaClick?.(property.msaId || '')} style={{ fontSize: 11, color: BT.text.cyan, cursor: 'pointer' }}>{property.msa}</span>
          </div>
        </div>
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.08em', marginBottom: 12 }}>PROPERTY DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 11 }}>
            {[
              ['Type', property.propertyType || 'Multifamily'],
              ['Class', { value: `Class ${property.class}`, color: getClassColor(property.class) }],
              ['Units', property.units],
              ['Sqft', property.sqft?.toLocaleString() || '—'],
              ['Built', property.yearBuilt],
              ['Renovated', property.yearRenovated || '—'],
              ['Stories', property.stories || '—'],
              ['Owner', { value: property.owner || '—', color: BT.text.cyan }],
            ].map(([label, val], i) => (
              <div key={i}>
                <span style={{ color: BT.text.muted }}>{label}</span>
                <div style={{ color: typeof val === 'object' ? val.color : BT.text.primary, fontWeight: 600 }}>
                  {typeof val === 'object' ? val.value : val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <SectionHeader title="KEY METRICS" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="AVG RENT" value={`$${property.avgRent.toLocaleString()}`} trend={rentTrend} trendValue={`${property.rentChangePercent >= 0 ? '+' : ''}${property.rentChangePercent}%`} color={BT.text.green} />
        <MetricCard label="OCCUPANCY" value={`${property.occupancy}%`} trend={occTrend} trendValue={property.occupancyChange ? `${property.occupancyChange >= 0 ? '+' : ''}${property.occupancyChange}%` : undefined} color={property.occupancy >= 94 ? BT.text.green : BT.text.amber} />
        <MetricCard label="LEASE-UP TIME" value={property.leaseUpMonths ? `${property.leaseUpMonths} mo` : '—'} subtext="To stabilize" color={BT.text.cyan} />
        <MetricCard label="CAP RATE" value={property.financials?.capRate ? `${property.financials.capRate}%` : '—'} color={BT.text.cyan} />
        {property.jediScore && <MetricCard label="JEDI SCORE" value={property.jediScore} color={getScoreColor(property.jediScore)} />}
      </div>
    </>
  );

  const renderPerformanceTab = () => (
    <>
      {/* Charts */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <LineChart
          title="RENT TREND"
          labels={historical.map(h => h.period)}
          series={[
            { name: 'Avg Rent', data: historical.map(h => h.rent), color: BT.text.green },
            { name: 'Comp Avg', data: historical.map((_, i) => 2100 + i * 40), color: BT.text.muted },
          ]}
        />
        <LineChart
          title="OCCUPANCY"
          labels={historical.map(h => h.period)}
          series={[
            { name: 'Property', data: historical.map(h => h.occupancy), color: BT.text.cyan },
            { name: 'Submarket', data: historical.map((_, i) => 93 + i * 0.3), color: BT.text.muted },
          ]}
        />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <LineChart
          title="NOI TREND"
          labels={historical.map(h => h.period)}
          series={[{ name: 'NOI', data: historical.map(h => h.noi || 0), color: BT.text.amber }]}
        />
        <LineChart
          title="CONCESSIONS"
          labels={historical.map(h => h.period)}
          series={[{ name: 'Avg Concession', data: historical.map(h => h.concessions || 0), color: BT.text.red }]}
        />
      </div>

      {/* Performance vs Comps Table */}
      <SectionHeader title="PERFORMANCE VS COMPS" subtitle="Trailing 12 months" />
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['PROPERTY', 'AVG RENT', 'RENT Δ', 'OCC', 'OCC Δ', 'RANK'].map(h => (
                <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'PROPERTY' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: `${BT.text.amber}0A`, borderBottom: `1px solid ${BT.border.medium}` }}>
              <td style={{ ...terminalStyles.td }}><span style={{ color: BT.text.amber, fontWeight: 700 }}>★ {property.name}</span></td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>${property.avgRent.toLocaleString()}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>{property.rentChangePercent >= 0 ? '+' : ''}{property.rentChangePercent}%</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>{property.occupancy}%</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>{property.occupancyChange ? `${property.occupancyChange >= 0 ? '+' : ''}${property.occupancyChange}%` : '—'}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>#1</td>
            </tr>
            {comps.slice(0, 4).map((c, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, color: BT.text.primary }}>{c.name}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary }}>${c.avgRent.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: (c.rentGrowthYoY || 0) >= 0 ? BT.text.green : BT.text.red }}>{(c.rentGrowthYoY || 0) >= 0 ? '+' : ''}{c.rentGrowthYoY}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>{c.occupancy}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>—</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>#{i + 2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderOwnershipTab = () => (
    <>
      <SectionHeader title="CURRENT OWNERSHIP" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="OWNER" value={property.owner || '—'} color={BT.text.cyan} />
        <MetricCard label="OWNER TYPE" value={property.ownerType || 'Institutional'} color={BT.text.secondary} />
        <MetricCard label="ACQUIRED" value={property.acquisitionDate || 'Mar 2022'} color={BT.text.secondary} />
        <MetricCard label="PURCHASE PRICE" value={property.acquisitionPrice ? fmt.currency(property.acquisitionPrice) : '$85M'} color={BT.text.amber} />
      </div>

      <SectionHeader title="SALE HISTORY" subtitle={`${saleHistory.length} transactions`} />
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['DATE', 'PRICE', '$/UNIT', 'CAP RATE', 'BUYER', 'SELLER'].map(h => (
                <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'DATE' || h === 'BUYER' || h === 'SELLER' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saleHistory.map((s, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, color: BT.text.primary }}>{s.date}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>{fmt.currency(s.price)}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>${s.pricePerUnit?.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>{s.capRate}%</td>
                <td style={{ ...terminalStyles.td, color: BT.text.cyan }}>{s.buyer}</td>
                <td style={{ ...terminalStyles.td, color: BT.text.secondary }}>{s.seller}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderTaxTab = () => (
    <>
      <SectionHeader title="TAX HISTORY" subtitle={`${taxHistory.length} years`} />
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <LineChart
          title="ASSESSED VALUE"
          labels={taxHistory.map(t => t.year.toString()).reverse()}
          series={[{ name: 'Assessed', data: taxHistory.map(t => t.assessed).reverse(), color: BT.text.amber }]}
        />
        <LineChart
          title="ANNUAL TAX"
          labels={taxHistory.map(t => t.year.toString()).reverse()}
          series={[{ name: 'Tax Amount', data: taxHistory.map(t => t.taxAmount).reverse(), color: BT.text.red }]}
        />
      </div>
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['YEAR', 'ASSESSED VALUE', 'TAX AMOUNT', 'YoY CHANGE'].map(h => (
                <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'YEAR' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {taxHistory.map((t, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, color: BT.text.primary, fontWeight: 600 }}>{t.year}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.amber }}>{fmt.currency(t.assessed)}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.red }}>{fmt.currency(t.taxAmount)}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: (t.changeYoY || 0) > 5 ? BT.text.red : BT.text.green }}>
                  {t.changeYoY ? `+${t.changeYoY}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderDemographicsTab = () => (
    <>
      <SectionHeader title="TRADE AREA DEMOGRAPHICS" subtitle="1, 3, 5 mile radius" />
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['RADIUS', 'POPULATION', 'POP GROWTH', 'MED INCOME', 'INC GROWTH', 'AVG AGE', 'COLLEGE %', 'EMPLOYED %', 'HOUSEHOLDS'].map(h => (
                <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'RADIUS' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demographics.map((d, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, color: BT.text.amber, fontWeight: 600 }}>{d.radius}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary }}>{d.population.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>+{d.popGrowth}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>${d.medianIncome.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>+{d.incomeGrowth}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>{d.avgAge}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: d.collegeEducated > 50 ? BT.text.green : BT.text.secondary }}>{d.collegeEducated}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: d.employmentRate > 95 ? BT.text.green : BT.text.amber }}>{d.employmentRate}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>{d.households.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderMarketTab = () => (
    <>
      <SectionHeader title="MARKET CONTEXT" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.06em', marginBottom: 12 }}>SUBMARKET: {property.submarket.toUpperCase()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
            {[['Properties', '52'], ['Total Units', '14,856'], ['Avg Rent', '$2,056'], ['Vacancy', '5.1%'], ['Pipeline', '2,400 units'], ['Rent Growth', '+4.8%']].map(([l, v], i) => (
              <div key={i}><span style={{ color: BT.text.muted }}>{l}</span><div style={{ color: BT.text.primary, fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
          {onSubmarketClick && (
            <button onClick={() => onSubmarketClick(property.submarketId || '')} style={{ marginTop: 12, background: BT.bg.terminal, border: `1px solid ${BT.text.cyan}`, color: BT.text.cyan, padding: '6px 12px', fontSize: 10, cursor: 'pointer' }}>
              VIEW SUBMARKET DETAIL →
            </button>
          )}
        </div>
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em', marginBottom: 12 }}>MSA: {property.msa.toUpperCase()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
            {[['Population', '6.2M'], ['Pop Growth', '+1.8%'], ['Employment', '3.1M'], ['Emp Growth', '+2.4%'], ['Median Income', '$72,400'], ['JEDI Score', '72']].map(([l, v], i) => (
              <div key={i}><span style={{ color: BT.text.muted }}>{l}</span><div style={{ color: BT.text.primary, fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
          {onMsaClick && (
            <button onClick={() => onMsaClick(property.msaId || '')} style={{ marginTop: 12, background: BT.bg.terminal, border: `1px solid ${BT.text.amber}`, color: BT.text.amber, padding: '6px 12px', fontSize: 10, cursor: 'pointer' }}>
              VIEW MSA DETAIL →
            </button>
          )}
        </div>
      </div>
    </>
  );

  const renderFinancialsTab = () => (
    <>
      {hasFinancials ? (
        <>
          <SectionHeader title="OPERATING STATEMENT" subtitle="Annual" />
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {property.financials?.revenue && <MetricCard label="REVENUE" value={fmt.currency(property.financials.revenue)} color={BT.text.cyan} />}
            {property.financials?.expenses && <MetricCard label="EXPENSES" value={fmt.currency(property.financials.expenses)} color={BT.text.red} />}
            {property.financials?.noi && <MetricCard label="NOI" value={fmt.currency(property.financials.noi)} color={BT.text.green} />}
            {property.financials?.debtService && <MetricCard label="DEBT SERVICE" value={fmt.currency(property.financials.debtService)} color={BT.text.amber} />}
            {property.financials?.cashFlow && <MetricCard label="CASH FLOW" value={fmt.currency(property.financials.cashFlow)} color={property.financials.cashFlow >= 0 ? BT.text.green : BT.text.red} />}
          </div>
          <SectionHeader title="CAPITAL STRUCTURE" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {property.financials?.purchasePrice && <MetricCard label="PURCHASE PRICE" value={fmt.currency(property.financials.purchasePrice)} color={BT.text.secondary} />}
            {property.financials?.currentValue && <MetricCard label="CURRENT VALUE" value={fmt.currency(property.financials.currentValue)} color={BT.text.cyan} />}
            {property.financials?.equity && <MetricCard label="EQUITY" value={fmt.currency(property.financials.equity)} color={BT.text.green} />}
            {property.financials?.ltv && <MetricCard label="LTV" value={`${property.financials.ltv}%`} color={property.financials.ltv > 75 ? BT.text.amber : BT.text.secondary} />}
            {property.financials?.dscr && <MetricCard label="DSCR" value={`${property.financials.dscr}x`} color={property.financials.dscr >= 1.25 ? BT.text.green : BT.text.red} />}
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted }}>
          <DollarSign size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, marginBottom: 8 }}>No financials available</div>
          <div style={{ fontSize: 11 }}>Financial data has not been entered for this property</div>
        </div>
      )}
    </>
  );

  const renderCompsTab = () => (
    <>
      <SectionHeader title="COMPARABLE PROPERTIES" subtitle={`${comps.length} properties`} />
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['PROPERTY', 'CLASS', 'UNITS', 'AVG RENT', 'Δ YoY', 'OCC', 'CAP', 'BUILT', 'DIST'].map(h => (
                <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'PROPERTY' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: `${BT.text.amber}0A`, borderBottom: `1px solid ${BT.border.medium}` }}>
              <td style={{ ...terminalStyles.td }}><span style={{ color: BT.text.amber, fontWeight: 700 }}>★ {property.name}</span></td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: getClassColor(property.class) }}>{property.class}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{property.units}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>${property.avgRent.toLocaleString()}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>{property.rentChangePercent >= 0 ? '+' : ''}{property.rentChangePercent}%</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>{property.occupancy}%</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{property.financials?.capRate || '—'}%</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{property.yearBuilt}</td>
              <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>—</td>
            </tr>
            {comps.map((c, i) => (
              <tr key={i} onClick={() => onCompClick?.(c.name)} style={{ borderBottom: `1px solid ${BT.border.subtle}`, cursor: onCompClick ? 'pointer' : 'default' }}
                onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ ...terminalStyles.td, color: BT.text.primary }}>{c.name}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: getClassColor(c.class || 'A') }}>{c.class || 'A'}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.units}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary, fontWeight: 600 }}>${c.avgRent.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: (c.rentGrowthYoY || 0) >= 0 ? BT.text.green : BT.text.red }}>{(c.rentGrowthYoY || 0) >= 0 ? '+' : ''}{c.rentGrowthYoY}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.occupancy}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.capRate || '—'}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.yearBuilt || '—'}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>{c.distance || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab();
      case 'performance': return renderPerformanceTab();
      case 'ownership': return renderOwnershipTab();
      case 'tax': return renderTaxTab();
      case 'demographics': return renderDemographicsTab();
      case 'market': return renderMarketTab();
      case 'financials': return renderFinancialsTab();
      case 'comps': return renderCompsTab();
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: BT.bg.terminal, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, gap: 16 }}>
        {onBack && <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>← BACK</button>}
        <span style={{ padding: '3px 8px', background: `${getClassColor(property.class)}22`, color: getClassColor(property.class), fontSize: 11, fontWeight: 700 }}>CLASS {property.class}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{property.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>${property.avgRent.toLocaleString()}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: rentTrend === 'up' ? BT.text.green : BT.text.red, display: 'flex', alignItems: 'center', gap: 2 }}>
            {rentTrend === 'up' ? '+' : ''}{property.rentChange}
            {rentTrend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </span>
          <Sparkline data={defaultSparkline} color={rentTrend === 'up' ? BT.text.green : BT.text.red} />
        </div>
        {property.jediScore && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: `${getScoreColor(property.jediScore)}14`, border: `1px solid ${getScoreColor(property.jediScore)}44` }}>
            <span style={{ fontSize: 9, color: BT.text.muted }}>JEDI</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(property.jediScore) }}>{property.jediScore}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: BT.text.green, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.green, animation: 'pulse 2s infinite' }} />
          LIVE
        </div>
      </div>

      {/* ─── TAB BAR ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 20px', background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 10, fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? BT.bg.active : 'transparent',
              color: activeTab === tab.key ? BT.text.amber : BT.text.secondary,
              border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${BT.text.amber}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: 20 }}>
        {renderTabContent()}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

export default PropertyDetailPage;
