/**
 * PropertyDetailPage - Full Bloomberg-style property detail view
 * 
 * Merged from:
 * - NEW: Bloomberg BT theme, 8 tabs, clean layout
 * - OLD: API fetch, Google Places photos, CREATE DEAL, hotkeys
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

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, MapPin, Building2, Calendar, Users, 
  DollarSign, Percent, Clock, BarChart3, Home, ChevronRight,
  FileText, Map, PieChart, History, Landmark
} from 'lucide-react';
import { BT, fmt, terminalStyles } from './theme';
import { getPropertyPhotos, type PropertyPhoto } from '../../services/google-places.service';
import { ZoningTabContent } from '../MarketIntelligence/ZoningTabContent';
import { CompsTabContent } from '../MarketIntelligence/CompsTabContent';
import { MarketTabContent } from '../MarketIntelligence/MarketTabContent';

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface PropertyImage {
  url: string;
  caption?: string;
  label?: string;
  color?: string;
}

interface SaleRecord {
  date: string;
  price: number;
  pricePerUnit?: number;
  ppu?: number;
  buyer?: string;
  seller?: string;
  capRate?: number;
}

interface TaxRecord {
  year: number;
  assessed: number;
  taxAmount?: number;
  tax?: number;
  justValue?: number;
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
  avgRent?: number;
  rent?: number;
  rentGrowthYoY?: number;
  occupancy?: number;
  occ?: number;
  capRate?: number;
  yearBuilt?: number;
  distance?: string;
  dist?: string;
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
  county?: string;
  submarket?: string;
  submarketId?: string;
  msa?: string;
  msaId?: string;
  market?: string;
  class?: string;
  propertyType?: string;
  subtype?: string;
  
  // Physical
  units?: number;
  sqft?: number;
  buildingSF?: number;
  lotSizeAc?: number;
  lotSizeSF?: number;
  avgUnitSF?: number;
  yearBuilt?: number;
  yearRenovated?: number;
  stories?: number;
  parking?: { total: number; ratio: number; type: string };
  amenities?: string[];
  
  // Performance
  avgRent?: number;
  avgEffectiveRent?: number;
  avgMarketRent?: number;
  monthlyRent?: number;
  rentChange?: number;
  rentChangePercent?: number;
  rentPerSF?: number;
  occupancy?: number;
  occupancyRate?: number;
  occupancyChange?: number;
  leaseUpMonths?: number;
  concessions?: string;
  
  // Ownership
  owner?: string;
  ownerType?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  lastSalePrice?: number;
  
  // Tax
  justValue?: number;
  assessedValue?: number;
  taxableValue?: number;
  millageRate?: number;
  annualTax?: number;
  homesteadExempt?: boolean;
  assessmentCap?: string;
  
  // Market
  submarketVacancy?: number;
  submarketRentGrowth?: number;
  submarketAbsorption?: number;
  walkScore?: number;
  transitScore?: number;
  bikeScore?: number;
  
  // Zoning
  zoningCode?: string;
  zoningDescription?: string;
  maxDensity?: string;
  maxHeight?: string;
  far?: number;
  zoningSource?: string;
  
  // Scores
  jediScore?: number;
  strategyScore?: number;
  
  // Pipeline
  inPipeline?: boolean;
  dealId?: string | null;
  
  // Media
  images?: PropertyImage[];
  photos?: PropertyImage[];
  
  // Historical
  historicalPerformance?: HistoricalMetric[];
  saleHistory?: SaleRecord[];
  ownershipHistory?: SaleRecord[];
  taxHistory?: TaxRecord[];
  demographics?: DemographicData[];
  
  // Financials
  financials?: PropertyFinancials;
  noi?: number;
  capRate?: number;
  expenseRatio?: number;
  
  // Comps
  rentComps?: CompProperty[];
  saleComps?: CompProperty[];
  
  // Meta
  dataSource?: string;
}

interface PropertyDetailPageProps {
  property?: PropertyData;
  propertyId?: string;
  comps?: CompProperty[];
  sparklineData?: number[];
  onBack?: () => void;
  onCompClick?: (compId: string) => void;
  onSubmarketClick?: (submarketId: string) => void;
  onMsaClick?: (msaId: string) => void;
  embedded?: boolean;
}

type TabKey = 'overview' | 'performance' | 'ownership' | 'tax' | 'demographics' | 'market' | 'financials' | 'comps';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; hotkey: string }[] = [
  { key: 'overview', label: 'OVERVIEW', icon: <Home size={12} />, hotkey: 'F1' },
  { key: 'performance', label: 'PERFORMANCE', icon: <BarChart3 size={12} />, hotkey: 'F2' },
  { key: 'ownership', label: 'OWNERSHIP', icon: <Users size={12} />, hotkey: 'F3' },
  { key: 'tax', label: 'TAX & SALES', icon: <Landmark size={12} />, hotkey: 'F4' },
  { key: 'demographics', label: 'DEMOGRAPHICS', icon: <PieChart size={12} />, hotkey: 'F5' },
  { key: 'market', label: 'MARKET', icon: <Map size={12} />, hotkey: 'F6' },
  { key: 'financials', label: 'FINANCIALS', icon: <DollarSign size={12} />, hotkey: 'F7' },
  { key: 'comps', label: 'COMPS', icon: <Building2 size={12} />, hotkey: 'F8' },
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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 8, color: BT.text.muted, width: 40, textAlign: 'right' }}>
          <span>{typeof max === 'number' && max < 100 ? max.toFixed(1) : max.toLocaleString()}</span>
          <span>{typeof min === 'number' && min < 100 ? min.toFixed(1) : min.toLocaleString()}</span>
        </div>
        <div style={{ flex: 1 }}>
          <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <line key={i} x1="0" y1={pct * height} x2={chartWidth} y2={pct * height} stroke={BT.border.subtle} strokeWidth="0.5" />
            ))}
            {series.map((s, si) => {
              const points = s.data.map((v, i) => {
                const x = (i / (s.data.length - 1)) * chartWidth;
                const y = height - ((v - min) / range) * (height - 8) - 4;
                return `${x},${y}`;
              }).join(' ');
              return <polyline key={si} points={points} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: BT.text.muted, marginTop: 4 }}>
            {labels.filter((_, i) => i % Math.ceil(labels.length / 5) === 0 || i === labels.length - 1).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      </div>
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

const ScoreRing: React.FC<{ score: number; size?: number; strokeWidth?: number }> = ({ score, size = 48, strokeWidth = 4 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? BT.text.green : score >= 55 ? BT.text.amber : BT.text.red;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`${color}22`} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{score}</span>
      </div>
    </div>
  );
};

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

const MOCK_DEMOGRAPHICS: DemographicData[] = [
  { radius: '1 mile', population: 28500, popGrowth: 2.4, medianIncome: 86200, incomeGrowth: 4.1, avgAge: 32, collegeEducated: 68, employmentRate: 96.2, households: 14200 },
  { radius: '3 mile', population: 142000, popGrowth: 1.9, medianIncome: 74500, incomeGrowth: 3.6, avgAge: 34, collegeEducated: 58, employmentRate: 95.1, households: 62400 },
  { radius: '5 mile', population: 385000, popGrowth: 1.6, medianIncome: 68200, incomeGrowth: 3.2, avgAge: 35, collegeEducated: 52, employmentRate: 94.5, households: 158000 },
];

// ─── MOCK PROPERTIES (fallback for standalone property cards) ─────────────────
const MOCK_PROPERTIES: Record<string, PropertyData> = {
  'the-vue-at-midtown': {
    id: 'the-vue-at-midtown',
    name: 'The Vue at Midtown',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '750 Piedmont Ave NE, Atlanta, GA 30308',
    class: 'A',
    units: 196,
    yearBuilt: 2018,
    avgRent: 2420,
    avgEffectiveRent: 2420,
    rentChange: 120,
    rentChangePercent: 5.2,
    occupancy: 93.2,
    occupancyRate: 93.2,
    occupancyChange: 0.6,
    capRate: 4.8,
    owner: 'Hines',
    noi: 3560000,
    jediScore: 94,
    images: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600', caption: 'Tower' },
      { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=600', caption: 'Lobby' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', caption: 'Amenities' },
    ],
    rentComps: [
      { name: 'The Vue at Midtown', units: 196, avgRent: 2420, occupancy: 93.2, class: 'A' },
      { name: 'Pines at Midtown', units: 180, avgRent: 1480, occupancy: 94.2, class: 'B' },
      { name: 'Peachtree Walk', units: 310, avgRent: 1920, occupancy: 93.6, class: 'A' },
    ],
  },
  'pines-at-midtown': {
    id: 'pines-at-midtown',
    name: 'Pines at Midtown',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '1240 Peachtree St NE, Atlanta, GA 30309',
    class: 'B',
    units: 180,
    yearBuilt: 1992,
    avgRent: 1480,
    avgEffectiveRent: 1480,
    rentChange: 220,
    rentChangePercent: 14.8,
    occupancy: 94.2,
    occupancyRate: 94.2,
    occupancyChange: 1.2,
    capRate: 5.8,
    owner: 'Greystone Capital',
    noi: 2160000,
    jediScore: 92,
    images: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', caption: 'Amenities' },
    ],
    rentComps: [
      { name: 'Pines at Midtown', units: 180, avgRent: 1480, occupancy: 94.2, class: 'B' },
      { name: 'Peachtree Walk', units: 310, avgRent: 1920, occupancy: 93.6, class: 'A' },
      { name: 'The Vue at Midtown', units: 196, avgRent: 2420, occupancy: 93.2, class: 'A' },
    ],
  },
  'alexan-buckhead': {
    id: 'alexan-buckhead',
    name: 'Alexan Buckhead',
    submarket: 'Buckhead',
    msa: 'Atlanta, GA',
    address: '3300 Peachtree Rd NE, Atlanta, GA 30326',
    class: 'A',
    units: 420,
    yearBuilt: 2019,
    avgRent: 2680,
    avgEffectiveRent: 2680,
    rentChange: 70,
    rentChangePercent: 2.5,
    occupancy: 92.1,
    occupancyRate: 92.1,
    occupancyChange: -0.3,
    capRate: 4.6,
    owner: 'Trammell Crow',
    noi: 8400000,
    jediScore: 83,
    images: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600', caption: 'Tower' },
      { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=600', caption: 'Lobby' },
      { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600', caption: 'Rooftop' },
    ],
    rentComps: [
      { name: 'Alexan Buckhead', units: 420, avgRent: 2680, occupancy: 92.1, class: 'A' },
      { name: 'Hanover Buckhead', units: 370, avgRent: 2280, occupancy: 94.2, class: 'A' },
      { name: 'The Darcy', units: 265, avgRent: 2380, occupancy: 92.8, class: 'A' },
    ],
  },
  'the-metropolitan': {
    id: 'the-metropolitan',
    name: 'The Metropolitan',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '999 Peachtree St NE, Atlanta, GA 30309',
    class: 'A',
    units: 412,
    yearBuilt: 2019,
    avgRent: 2450,
    avgEffectiveRent: 2450,
    rentChange: 85,
    rentChangePercent: 3.6,
    occupancy: 96.2,
    occupancyRate: 96.2,
    occupancyChange: 1.4,
    capRate: 4.6,
    owner: 'Greystar',
    noi: 7600000,
    jediScore: 94,
    images: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600', caption: 'Amenities' },
    ],
    rentComps: [
      { name: 'The Metropolitan', units: 412, avgRent: 2450, occupancy: 96.2, class: 'A' },
      { name: 'Peachtree Walk', units: 310, avgRent: 1920, occupancy: 93.6, class: 'A' },
      { name: 'Alexan Midtown', units: 290, avgRent: 1950, occupancy: 95.0, class: 'A' },
    ],
  },
};

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^0-9.KMB]/gi, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  const upper = val.toUpperCase();
  if (upper.includes('B')) return num * 1_000_000_000;
  if (upper.includes('M')) return num * 1_000_000;
  if (upper.includes('K')) return num * 1_000;
  return num;
};

const buildPropertyFromRow = (row: any, siblingRows?: any[]): PropertyData => {
  const addrParts = (row.address || '').split(',').map((s: string) => s.trim());
  const stateZip = (addrParts[2] || '').split(' ');
  const rentNum = parseCurrency(row.rent) || parseCurrency(row.askingRent);
  const mktRentNum = parseCurrency(row.marketRent);
  const purchaseNum = parseCurrency(row.purchasePrice);

  return {
    id: row.rawPropertyId || row.id || 'unknown',
    name: row.property || row.name || 'Unknown Property',
    address: row.address || '',
    city: addrParts[1] || row.city || '',
    state: stateZip[0] || row.state || '',
    zip: stateZip[1] || row.zip || '',
    county: row.county || '',
    submarket: row.submarket || '',
    propertyType: row.propertyType || 'MULTIFAMILY',
    class: row.class || row.buildingClass || '',
    units: row.units || 0,
    yearBuilt: row.year || row.yearBuilt || 0,
    buildingSF: row.buildingSf || row.totalSqft || 0,
    lotSizeAc: row.lotAcres || row.acres || row.lotSize || 0,
    stories: row.stories || 0,
    avgEffectiveRent: rentNum || row.avgEffectiveRent || 0,
    avgMarketRent: mktRentNum || row.avgMarketRent || 0,
    occupancyRate: parseFloat(String(row.occ || '0').replace('%', '')) || row.occupancyRate || 0,
    concessions: row.concessions || '',
    zoningCode: row.zoning || row.zoningCode || '',
    zoningDescription: row.zoningDescription || '',
    capRate: row.capRate || 0,
    noi: row.noi || 0,
    owner: row.owner || row.ownerName || '',
    ownerType: row.ownerType || 'LLC / Entity',
    acquisitionDate: row.purchaseDate || row.acquisitionDate || '',
    acquisitionPrice: purchaseNum || row.acquisitionPrice || 0,
    lastSalePrice: purchaseNum || row.lastSalePrice || 0,
    justValue: row.justValue || 0,
    assessedValue: row.assessedValue || 0,
    taxableValue: row.taxableValue || 0,
    annualTax: row.annualTax || 0,
    amenities: row.amenities || [],
    photos: row.photos || [],
    rentComps: row.rentComps || [],
    saleComps: row.saleComps || [],
    ownershipHistory: row.ownershipHistory || [],
    taxHistory: row.taxHistory || [],
    inPipeline: row.inPipeline || false,
    dealId: row.dealId || null,
    dataSource: row.enrichmentSource || row.dataSource || 'Market Intelligence',
  };
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property: propFromProps,
  propertyId: propIdFromProps,
  comps: compsFromProps,
  sparklineData = [],
  onBack,
  onCompClick,
  onSubmarketClick,
  onMsaClick,
  embedded = false,
}) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const propertyId = propIdFromProps || routeId;
  
  const [property, setProperty] = useState<PropertyData | null>(propFromProps || null);
  const [loading, setLoading] = useState(!propFromProps);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<PropertyPhoto[]>([]);

  // ─── DATA FETCHING ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (propFromProps) {
      setProperty(propFromProps);
      setLoading(false);
      return;
    }

    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/v1/properties/${propertyId}`);
        if (!response.ok) throw new Error('Failed to fetch property');
        const data = await response.json();
        setProperty(data);
      } catch (err) {
        // Fallback 1: Check location.state
        const stateRow = (location.state as any)?.propertyRow;
        const siblingRows = (location.state as any)?.siblingRows;
        if (stateRow) {
          setProperty(buildPropertyFromRow(stateRow, siblingRows));
          setError(null);
        } 
        // Fallback 2: Check mock properties (for standalone property cards)
        else if (propertyId && MOCK_PROPERTIES[propertyId]) {
          setProperty(MOCK_PROPERTIES[propertyId]);
          setError(null);
        }
        else {
          setError(err instanceof Error ? err.message : 'Failed to load property');
        }
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchProperty();
    }
  }, [propertyId, propFromProps, location.state]);

  // ─── PHOTO LOADING ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!property) return;
    setPhotoUrls([]);
    
    const loadPhotos = async () => {
      try {
        const photos = await getPropertyPhotos({
          photos: (property.photos as any[])?.filter((ph: any) => ph.url),
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
        });
        setPhotoUrls(photos);
      } catch (e) {
        console.warn('Failed to load photos:', e);
      }
    };
    loadPhotos();
  }, [property?.id]);

  // ─── HOTKEY SUPPORT ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key.replace('F', '')) - 1;
      if (idx >= 0 && idx < TABS.length) { 
        e.preventDefault(); 
        setActiveTab(TABS[idx].key); 
      }
      if (e.key === 'Escape') { 
        setShowCreateDeal(false); 
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── DERIVED VALUES ─────────────────────────────────────────────────────────

  const p = property;
  const units = p?.units || 1;
  const occRate = p?.occupancyRate || p?.occupancy || 0;
  const avgRent = p?.avgEffectiveRent || p?.avgRent || p?.monthlyRent || 0;
  const rentChange = p?.rentChange || 0;
  const rentChangePercent = p?.rentChangePercent || 0;
  const jediScore = p?.jediScore || 82;
  const comps = compsFromProps || p?.rentComps || [];
  
  const images = useMemo(() => {
    if (photoUrls.length > 0) {
      return photoUrls.map((ph, i) => ({ url: ph.url || '', caption: ph.label, label: ph.label, color: ph.color }));
    }
    if (p?.photos && p.photos.length > 0) {
      return p.photos;
    }
    if (p?.images && p.images.length > 0) {
      return p.images;
    }
    return [
      { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Exterior', caption: 'Exterior' },
      { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Interior', caption: 'Interior' },
      { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Amenities', caption: 'Amenities' },
    ];
  }, [photoUrls, p?.photos, p?.images]);

  const historical = p?.historicalPerformance || MOCK_HISTORICAL;
  const saleHistory = p?.saleHistory || p?.ownershipHistory || [];
  const taxHistory = p?.taxHistory || [];
  const demographics = p?.demographics || MOCK_DEMOGRAPHICS;

  const defaultSparkline = sparklineData.length > 0 ? sparklineData : historical.map(h => h.rent);
  const rentTrend = rentChange >= 0 ? 'up' : 'down';
  const occTrend = (p?.occupancyChange || 0) >= 0 ? 'up' : 'down';

  const getClassColor = (cls?: string) => cls === 'A' ? BT.text.green : cls === 'B' ? BT.text.amber : BT.text.red;
  const getScoreColor = (score: number) => score >= 75 ? BT.text.green : score >= 55 ? BT.text.amber : BT.text.red;

  const hasFinancials = p?.financials && (p.financials.noi || p.financials.revenue);

  // ─── LOADING/ERROR STATES ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ width: '100%', height: embedded ? '100%' : '100vh', background: BT.bg.terminal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `2px solid ${BT.text.amber}40`, borderTop: `2px solid ${BT.text.amber}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <span style={{ fontSize: 10, color: BT.text.secondary }}>LOADING ASSET DATA...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div style={{ width: '100%', height: embedded ? '100%' : '100vh', background: BT.bg.terminal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 24, color: BT.text.red, marginBottom: 8 }}>⚠</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: BT.text.primary, marginBottom: 4 }}>ASSET NOT FOUND</div>
          <div style={{ fontSize: 9, color: BT.text.secondary, marginBottom: 16 }}>{error || 'Unable to load property details'}</div>
          <div onClick={() => navigate(-1)} style={{ padding: '6px 16px', background: `${BT.text.amber}20`, border: `1px solid ${BT.text.amber}60`, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: BT.text.amber, display: 'inline-block' }}>
            ‹ GO BACK
          </div>
        </div>
      </div>
    );
  }

  // ─── CREATE DEAL MODAL ──────────────────────────────────────────────────────

  const CreateDealModal = () => (
    <div onClick={() => setShowCreateDeal(false)} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, background: BT.bg.panel, border: `1px solid ${BT.text.amber}40`,
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', background: BT.bg.header, borderBottom: `1px solid ${BT.text.amber}40`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: BT.text.amber }}>◈</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.05em' }}>CREATE DEAL CAPSULE</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 12 }}>
            This will promote <span style={{ color: BT.text.primary, fontWeight: 600 }}>{p.name}</span> into your deal pipeline and create a Deal Capsule with:
          </div>
          {[
            'JEDI Score engine activation (5 master signals)',
            '4-strategy arbitrage analysis (BTS · Flip · Rental · STR)',
            '3-Layer ProForma (Broker → Platform → Your Adjustments)',
            'Capital structure engine & exit timing optimization',
            'Risk assessment & DD checklist generation',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 0', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 9, color: BT.text.green, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 9, color: BT.text.primary }}>{item}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <div onClick={() => { 
              setShowCreateDeal(false); 
              navigate('/deals/create', { 
                state: { 
                  sourcePropertyId: p.id, 
                  propertyName: p.name, 
                  address: p.address, 
                  city: p.city, 
                  state: p.state, 
                  propertyType: p.propertyType, 
                  units: p.units 
                } 
              }); 
            }} style={{ flex: 1, padding: '8px 0', textAlign: 'center', cursor: 'pointer', background: `${BT.text.amber}20`, border: `1px solid ${BT.text.amber}60`, fontSize: 11, fontWeight: 700, color: BT.text.amber }}>
              CREATE DEAL
            </div>
            <div onClick={() => setShowCreateDeal(false)} style={{ padding: '8px 16px', cursor: 'pointer', background: BT.bg.terminal, border: `1px solid ${BT.border.medium}`, fontSize: 11, fontWeight: 500, color: BT.text.secondary }}>
              CANCEL
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TAB CONTENT RENDERERS ──────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
            {[0, 1, 2].map((idx) => {
              const img = images[idx] || images[0];
              return (
                <div key={idx} onClick={() => setActiveImageIndex(idx)} style={{
                  position: 'relative', height: 140, overflow: 'hidden', cursor: 'pointer',
                  border: activeImageIndex === idx ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                  background: BT.bg.panelAlt,
                }}>
                  {img?.url ? (
                    <img src={img.url} alt={img?.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: img?.color || BT.bg.panelAlt }}>
                      <Building2 size={32} color={BT.text.muted} />
                    </div>
                  )}
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
            <span style={{ fontSize: 12, color: BT.text.primary }}>{p.address}</span>
            {p.submarket && (
              <>
                <span style={{ color: BT.text.muted }}>•</span>
                <span onClick={() => onSubmarketClick?.(p.submarketId || '')} style={{ fontSize: 11, color: BT.text.cyan, cursor: 'pointer' }}>{p.submarket}</span>
              </>
            )}
            {p.msa && (
              <>
                <span style={{ color: BT.text.muted }}>•</span>
                <span onClick={() => onMsaClick?.(p.msaId || '')} style={{ fontSize: 11, color: BT.text.cyan, cursor: 'pointer' }}>{p.msa}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.08em', marginBottom: 12 }}>PROPERTY DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 11 }}>
            {[
              ['Type', p.propertyType || 'Multifamily'],
              ['Class', { value: `Class ${p.class || '—'}`, color: getClassColor(p.class) }],
              ['Units', units],
              ['Sqft', p.buildingSF?.toLocaleString() || p.sqft?.toLocaleString() || '—'],
              ['Built', p.yearBuilt || '—'],
              ['Renovated', p.yearRenovated || '—'],
              ['Stories', p.stories || '—'],
              ['Owner', { value: p.owner || '—', color: BT.text.cyan }],
            ].map(([label, val], i) => (
              <div key={i}>
                <span style={{ color: BT.text.muted }}>{label as string}</span>
                <div style={{ color: typeof val === 'object' ? (val as any).color : BT.text.primary, fontWeight: 600 }}>
                  {typeof val === 'object' ? (val as any).value : val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionHeader title="KEY METRICS" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="AVG RENT" value={`$${avgRent.toLocaleString()}`} trend={rentTrend as any} trendValue={rentChangePercent ? `${rentChangePercent >= 0 ? '+' : ''}${rentChangePercent}%` : undefined} color={BT.text.green} />
        <MetricCard label="OCCUPANCY" value={`${occRate}%`} trend={occTrend as any} trendValue={p?.occupancyChange ? `${p.occupancyChange >= 0 ? '+' : ''}${p.occupancyChange}%` : undefined} color={occRate >= 94 ? BT.text.green : BT.text.amber} />
        <MetricCard label="CAP RATE" value={p?.capRate ? `${p.capRate}%` : (p?.financials?.capRate ? `${p.financials.capRate}%` : '—')} color={BT.text.cyan} />
        <MetricCard label="JEDI SCORE" value={jediScore} color={getScoreColor(jediScore)} />
      </div>

      {p.amenities && p.amenities.length > 0 && (
        <>
          <SectionHeader title="AMENITIES" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
            {p.amenities.map((a, i) => (
              <span key={i} style={{ padding: '4px 10px', background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, fontSize: 10, color: BT.text.secondary }}>{a}</span>
            ))}
          </div>
        </>
      )}
    </>
  );

  const renderPerformanceTab = () => (
    <>
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
    </>
  );

  const renderOwnershipTab = () => (
    <>
      <SectionHeader title="CURRENT OWNERSHIP" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="OWNER" value={p.owner || '—'} color={BT.text.cyan} />
        <MetricCard label="OWNER TYPE" value={p.ownerType || 'Institutional'} color={BT.text.secondary} />
        <MetricCard label="ACQUIRED" value={p.acquisitionDate || '—'} color={BT.text.secondary} />
        <MetricCard label="PURCHASE PRICE" value={p.acquisitionPrice ? fmt.currency(p.acquisitionPrice) : '—'} color={BT.text.amber} />
      </div>

      {saleHistory.length > 0 && (
        <>
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
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>${(s.pricePerUnit || s.ppu || 0).toLocaleString()}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>{s.capRate || '—'}%</td>
                    <td style={{ ...terminalStyles.td, color: BT.text.cyan }}>{s.buyer || '—'}</td>
                    <td style={{ ...terminalStyles.td, color: BT.text.secondary }}>{s.seller || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  const renderTaxTab = () => (
    <>
      <SectionHeader title="TAX ASSESSMENT" subtitle={p.county ? `${p.county} County` : ''} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="JUST VALUE" value={p.justValue ? fmt.currency(p.justValue) : '—'} color={BT.text.primary} />
        <MetricCard label="ASSESSED VALUE" value={p.assessedValue ? fmt.currency(p.assessedValue) : '—'} color={BT.text.secondary} />
        <MetricCard label="TAXABLE VALUE" value={p.taxableValue ? fmt.currency(p.taxableValue) : '—'} color={BT.text.amber} />
        <MetricCard label="ANNUAL TAX" value={p.annualTax ? fmt.currency(p.annualTax) : '—'} color={BT.text.red} />
      </div>

      {p.justValue && p.millageRate && p.annualTax && (
        <div style={{ padding: 12, background: `${BT.text.red}08`, border: `1px solid ${BT.text.red}30`, marginBottom: 20, fontSize: 10, color: BT.text.red }}>
          ⚠ REASSESSMENT WARNING: On sale, assessed value resets to just value. Buyer's tax estimate: ~{fmt.currency(Math.round(p.justValue * p.millageRate / 1000))}/yr ({((p.justValue * p.millageRate / 1000 / p.annualTax - 1) * 100).toFixed(0)}% increase)
        </div>
      )}

      {taxHistory.length > 0 && (
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
              series={[{ name: 'Tax Amount', data: taxHistory.map(t => t.taxAmount || t.tax || 0).reverse(), color: BT.text.red }]}
            />
          </div>
        </>
      )}
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

  const renderMarketTab = () => {
    // Use external component if dealId exists
    if (p.dealId) {
      return <MarketTabContent dealId={p.dealId} />;
    }
    
    return (
      <>
        <SectionHeader title="MARKET CONTEXT" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: '0.06em', marginBottom: 12 }}>SUBMARKET: {(p.submarket || '').toUpperCase()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
              {[
                ['Vacancy', p.submarketVacancy ? `${p.submarketVacancy}%` : '—'],
                ['Rent Growth', p.submarketRentGrowth ? `+${p.submarketRentGrowth}%` : '—'],
                ['Absorption', p.submarketAbsorption ? `${p.submarketAbsorption.toLocaleString()} units` : '—'],
              ].map(([l, v], i) => (
                <div key={i}><span style={{ color: BT.text.muted }}>{l}</span><div style={{ color: BT.text.primary, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em', marginBottom: 12 }}>LOCATION SCORES</div>
            {[
              { label: 'Walk Score', value: p.walkScore || 0 },
              { label: 'Transit Score', value: p.transitScore || 0 },
              { label: 'Bike Score', value: p.bikeScore || 0 },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: BT.text.muted, width: 80 }}>{s.label}</span>
                <div style={{ flex: 1, height: 6, background: `${BT.text.cyan}22`, borderRadius: 3 }}>
                  <div style={{ width: `${s.value}%`, height: '100%', background: s.value >= 70 ? BT.text.green : s.value >= 50 ? BT.text.amber : BT.text.red, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, width: 24, textAlign: 'right' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderFinancialsTab = () => (
    <>
      {hasFinancials ? (
        <>
          <SectionHeader title="OPERATING STATEMENT" subtitle="Annual" />
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {p.financials?.revenue && <MetricCard label="REVENUE" value={fmt.currency(p.financials.revenue)} color={BT.text.cyan} />}
            {p.financials?.expenses && <MetricCard label="EXPENSES" value={fmt.currency(p.financials.expenses)} color={BT.text.red} />}
            {(p.financials?.noi || p.noi) && <MetricCard label="NOI" value={fmt.currency(p.financials?.noi || p.noi || 0)} color={BT.text.green} />}
            {p.financials?.debtService && <MetricCard label="DEBT SERVICE" value={fmt.currency(p.financials.debtService)} color={BT.text.amber} />}
            {p.financials?.cashFlow && <MetricCard label="CASH FLOW" value={fmt.currency(p.financials.cashFlow)} color={p.financials.cashFlow >= 0 ? BT.text.green : BT.text.red} />}
          </div>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted }}>
          <DollarSign size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, marginBottom: 8 }}>No financials available</div>
          <div style={{ fontSize: 11, marginBottom: 16 }}>Create a Deal Capsule to unlock financial modeling</div>
          <div onClick={() => setShowCreateDeal(true)} style={{ display: 'inline-block', padding: '8px 16px', background: `${BT.text.amber}20`, border: `1px solid ${BT.text.amber}60`, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: BT.text.amber }}>
            CREATE DEAL →
          </div>
        </div>
      )}
    </>
  );

  const renderCompsTab = () => {
    // Use external component if dealId exists
    if (p.dealId) {
      return <CompsTabContent dealId={p.dealId} />;
    }
    
    const compsList = comps.map(c => ({
      ...c,
      avgRent: c.avgRent || c.rent || 0,
      occupancy: c.occupancy || c.occ || 0,
      distance: c.distance || c.dist || '—',
    }));
    
    return (
      <>
        <SectionHeader title="COMPARABLE PROPERTIES" subtitle={`${compsList.length} properties`} />
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                {['PROPERTY', 'CLASS', 'UNITS', 'AVG RENT', 'OCC', 'CAP', 'BUILT', 'DIST'].map(h => (
                  <th key={h} style={{ ...terminalStyles.th, textAlign: h === 'PROPERTY' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: `${BT.text.amber}0A`, borderBottom: `1px solid ${BT.border.medium}` }}>
                <td style={{ ...terminalStyles.td }}><span style={{ color: BT.text.amber, fontWeight: 700 }}>★ {p.name}</span></td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: getClassColor(p.class) }}>{p.class || '—'}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{units}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>${avgRent.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>{occRate}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{p.capRate || '—'}%</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{p.yearBuilt || '—'}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>—</td>
              </tr>
              {compsList.map((c, i) => (
                <tr key={i} onClick={() => onCompClick?.(c.name)} style={{ borderBottom: `1px solid ${BT.border.subtle}`, cursor: onCompClick ? 'pointer' : 'default' }}>
                  <td style={{ ...terminalStyles.td, color: BT.text.primary }}>{c.name}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: getClassColor(c.class || 'A') }}>{c.class || '—'}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.units}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary, fontWeight: 600 }}>${c.avgRent.toLocaleString()}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.occupancy}%</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.capRate || '—'}%</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{c.yearBuilt || '—'}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>{c.distance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

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

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: embedded ? '100%' : '100vh', background: BT.bg.terminal, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, gap: 16 }}>
          <button onClick={onBack || (() => navigate(-1))} style={{ background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>← BACK</button>
          {p.class && <span style={{ padding: '3px 8px', background: `${getClassColor(p.class)}22`, color: getClassColor(p.class), fontSize: 11, fontWeight: 700 }}>CLASS {p.class}</span>}
          <span style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{p.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>${avgRent.toLocaleString()}</span>
            {rentChange !== 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: rentTrend === 'up' ? BT.text.green : BT.text.red, display: 'flex', alignItems: 'center', gap: 2 }}>
                {rentTrend === 'up' ? '+' : ''}{rentChange}
                {rentTrend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </span>
            )}
            <Sparkline data={defaultSparkline} color={rentTrend === 'up' ? BT.text.green : BT.text.red} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreRing score={jediScore} />
            {!p.inPipeline && (
              <div onClick={() => setShowCreateDeal(true)} style={{
                padding: '5px 12px', cursor: 'pointer',
                background: `${BT.text.amber}20`, border: `1px solid ${BT.text.amber}60`,
                fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span>◈</span> CREATE DEAL
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: BT.text.green, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.green }} />
            LIVE
          </div>
        </div>
      )}

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
            <span style={{ fontSize: 8, color: BT.text.muted, marginLeft: 2 }}>{tab.hotkey}</span>
          </button>
        ))}
      </div>

      {/* ─── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: 20 }}>
        {renderTabContent()}
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────────── */}
      {showCreateDeal && <CreateDealModal />}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

export default PropertyDetailPage;
