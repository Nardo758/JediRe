/**
 * PropertyDetailPage - Full-page Bloomberg-style property detail view
 * 
 * Sections:
 * 1. Header ticker (property name, rent, change, sparkline, JEDI score)
 * 2. Property images (3 in a row)
 * 3. Property details (address, class, units, sqft, year built, owner, submarket)
 * 4. Performance metrics (rent trend, occupancy, lease-up time, cap rate)
 * 5. Comps table (comparable properties)
 * 6. Financials (conditional - NOI, revenue, expenses, debt service, cash flow)
 */

import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, MapPin, Building2, Calendar, Users, 
  DollarSign, Percent, Clock, BarChart3, Home, ChevronRight
} from 'lucide-react';
import { BT, fmt, terminalStyles } from './theme';

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface PropertyImage {
  url: string;
  caption?: string;
}

interface CompProperty {
  rank?: number;
  name: string;
  address?: string;
  units: number;
  avgRent: number;
  rentChange?: number;
  rentGrowthYoY?: number;
  occupancy: number;
  capRate?: number;
  yearBuilt?: number;
  distance?: string;
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
}

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  submarket: string;
  msa: string;
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
  leaseUpMonths?: number; // Time to stabilize
  concessions?: number;
  
  // Ownership
  owner?: string;
  ownerType?: string;
  acquisitionDate?: string;
  
  // Scores
  jediScore?: number;
  strategyScore?: number;
  
  // Media
  images?: PropertyImage[];
  
  // Financials (optional)
  financials?: PropertyFinancials;
}

interface PropertyDetailPageProps {
  property: PropertyData;
  comps?: CompProperty[];
  sparklineData?: number[];
  onBack?: () => void;
  onCompClick?: (compId: string) => void;
}

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
      <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
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

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ 
  title, subtitle, action 
}) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: `1px solid ${BT.border.subtle}`,
    marginBottom: 12,
  }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.06em' }}>
        {title}
      </span>
      {subtitle && (
        <span style={{ fontSize: 10, color: BT.text.muted }}>{subtitle}</span>
      )}
    </div>
    {action}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property,
  comps = [],
  sparklineData = [],
  onBack,
  onCompClick,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const images = property.images || [
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Exterior', caption: 'Exterior' },
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Interior', caption: 'Interior' },
    { url: 'https://placehold.co/600x400/1a1f2e/4a5568?text=Amenities', caption: 'Amenities' },
  ];

  const defaultSparkline = sparklineData.length > 0 ? sparklineData : 
    Array.from({ length: 12 }, (_, i) => property.avgRent - 100 + Math.random() * 200 + i * 15);

  const rentTrend = property.rentChange >= 0 ? 'up' : 'down';
  const occTrend = (property.occupancyChange || 0) >= 0 ? 'up' : 'down';

  const getClassColor = (cls: string) => {
    if (cls === 'A') return BT.text.green;
    if (cls === 'B') return BT.text.amber;
    return BT.text.red;
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return BT.text.green;
    if (score >= 55) return BT.text.amber;
    return BT.text.red;
  };

  const hasFinancials = property.financials && (
    property.financials.noi || property.financials.revenue || property.financials.cashFlow
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: BT.bg.terminal,
      color: BT.text.primary,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* ─── TOP HEADER BAR ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        gap: 16,
      }}>
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: `1px solid ${BT.border.medium}`,
              color: BT.text.secondary,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← BACK
          </button>
        )}

        {/* Class badge */}
        <span style={{
          padding: '3px 8px',
          background: `${getClassColor(property.class)}22`,
          color: getClassColor(property.class),
          fontSize: 11,
          fontWeight: 700,
        }}>
          CLASS {property.class}
        </span>

        {/* Property name */}
        <span style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>
          {property.name}
        </span>

        {/* Rent + change */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
            ${property.avgRent.toLocaleString()}
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: rentTrend === 'up' ? BT.text.green : BT.text.red,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}>
            {rentTrend === 'up' ? '+' : ''}{property.rentChange}
            {rentTrend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </span>
          <Sparkline data={defaultSparkline} color={rentTrend === 'up' ? BT.text.green : BT.text.red} />
        </div>

        {/* JEDI Score */}
        {property.jediScore && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            background: `${getScoreColor(property.jediScore)}14`,
            border: `1px solid ${getScoreColor(property.jediScore)}44`,
          }}>
            <span style={{ fontSize: 9, color: BT.text.muted }}>JEDI</span>
            <span style={{
              fontSize: 18,
              fontWeight: 800,
              color: getScoreColor(property.jediScore),
            }}>
              {property.jediScore}
            </span>
          </div>
        )}

        {/* Live indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          color: BT.text.green,
          fontWeight: 600,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: BT.text.green,
            animation: 'pulse 2s infinite',
          }} />
          LIVE
        </div>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div style={{ padding: 20 }}>
        {/* ─── IMAGES + DETAILS ROW ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Images - 3 in a row */}
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              marginBottom: 8,
            }}>
              {[0, 1, 2].map((idx) => {
                const img = images[idx] || images[0];
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    style={{
                      position: 'relative',
                      height: 160,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: activeImageIndex === idx ? `2px solid ${BT.text.amber}` : `2px solid transparent`,
                    }}
                  >
                    <img
                      src={img?.url}
                      alt={img?.caption || `Property ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {img?.caption && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '16px 8px 4px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        fontSize: 9,
                        color: BT.text.secondary,
                        textTransform: 'uppercase',
                      }}>
                        {img.caption}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Address bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
            }}>
              <MapPin size={14} color={BT.text.amber} />
              <span style={{ fontSize: 12, color: BT.text.primary }}>{property.address}</span>
              <span style={{ color: BT.text.muted }}>•</span>
              <span style={{ fontSize: 11, color: BT.text.secondary }}>{property.submarket}</span>
              <span style={{ color: BT.text.muted }}>•</span>
              <span style={{ fontSize: 11, color: BT.text.secondary }}>{property.msa}</span>
            </div>
          </div>

          {/* Property Details Panel */}
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            padding: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: '0.08em', marginBottom: 12 }}>
              PROPERTY DETAILS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: 11 }}>
              <div>
                <span style={{ color: BT.text.muted }}>Type</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.propertyType || 'Multifamily'}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Class</span>
                <div style={{ color: getClassColor(property.class), fontWeight: 700 }}>Class {property.class}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Units</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.units}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Sqft</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.sqft?.toLocaleString() || '—'}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Year Built</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.yearBuilt}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Renovated</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.yearRenovated || '—'}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Stories</span>
                <div style={{ color: BT.text.primary, fontWeight: 600 }}>{property.stories || '—'}</div>
              </div>
              <div>
                <span style={{ color: BT.text.muted }}>Owner</span>
                <div style={{ color: BT.text.cyan, fontWeight: 600 }}>{property.owner || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── PERFORMANCE METRICS ──────────────────────────────────────────── */}
        <SectionHeader title="PERFORMANCE METRICS" subtitle="Current operating performance" />
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <MetricCard
            label="AVG RENT"
            value={`$${property.avgRent.toLocaleString()}`}
            trend={rentTrend}
            trendValue={`${property.rentChange >= 0 ? '+' : ''}${property.rentChangePercent}%`}
            color={BT.text.green}
          />
          <MetricCard
            label="OCCUPANCY"
            value={`${property.occupancy}%`}
            trend={occTrend}
            trendValue={property.occupancyChange ? `${property.occupancyChange >= 0 ? '+' : ''}${property.occupancyChange}%` : undefined}
            color={property.occupancy >= 94 ? BT.text.green : BT.text.amber}
          />
          <MetricCard
            label="LEASE-UP TIME"
            value={property.leaseUpMonths ? `${property.leaseUpMonths} mo` : '—'}
            subtext="Time to stabilize"
            color={BT.text.cyan}
          />
          <MetricCard
            label="CAP RATE"
            value={property.financials?.capRate ? `${property.financials.capRate}%` : '—'}
            color={BT.text.cyan}
          />
          {property.concessions !== undefined && (
            <MetricCard
              label="CONCESSIONS"
              value={`$${property.concessions.toLocaleString()}`}
              subtext="Avg per unit"
              color={BT.text.amber}
            />
          )}
        </div>

        {/* ─── COMPS TABLE ──────────────────────────────────────────────────── */}
        <SectionHeader 
          title="COMPARABLE PROPERTIES" 
          subtitle={`${comps.length || 4} properties in submarket`}
        />
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          marginBottom: 24,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                <th style={{ ...terminalStyles.th, textAlign: 'left' }}>PROPERTY</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>UNITS</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>AVG RENT</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>RENT Δ YoY</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>OCCUPANCY</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>CAP RATE</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>BUILT</th>
                <th style={{ ...terminalStyles.th, textAlign: 'center' }}>DISTANCE</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject property row */}
              <tr style={{ background: `${BT.text.amber}0A`, borderBottom: `1px solid ${BT.border.medium}` }}>
                <td style={{ ...terminalStyles.td, textAlign: 'left' }}>
                  <span style={{ color: BT.text.amber, fontWeight: 700 }}>★ {property.name}</span>
                  <span style={{ color: BT.text.muted, fontSize: 9, marginLeft: 6 }}>SUBJECT</span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary }}>{property.units}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                  ${property.avgRent.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: property.rentChangePercent >= 0 ? BT.text.green : BT.text.red }}>
                  {property.rentChangePercent >= 0 ? '+' : ''}{property.rentChangePercent}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: property.occupancy >= 94 ? BT.text.green : BT.text.amber }}>
                  {property.occupancy}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>
                  {property.financials?.capRate ? `${property.financials.capRate}%` : '—'}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>{property.yearBuilt}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'center', color: BT.text.muted }}>—</td>
              </tr>
              
              {/* Comp rows */}
              {(comps.length > 0 ? comps : [
                { name: 'Hanover Midtown', units: 370, avgRent: 2280, rentGrowthYoY: 4.8, occupancy: 94.2, capRate: 5.2, yearBuilt: 2018, distance: '0.3 mi' },
                { name: 'Alexan Buckhead', units: 290, avgRent: 1950, rentGrowthYoY: 3.9, occupancy: 95.0, capRate: 5.5, yearBuilt: 2015, distance: '0.5 mi' },
                { name: 'The Darcy', units: 265, avgRent: 2380, rentGrowthYoY: 6.1, occupancy: 92.8, capRate: 4.6, yearBuilt: 2021, distance: '0.8 mi' },
                { name: 'Camden Atlantic', units: 420, avgRent: 2150, rentGrowthYoY: 4.2, occupancy: 93.5, capRate: 5.0, yearBuilt: 2019, distance: '1.2 mi' },
              ]).map((comp, i) => (
                <tr 
                  key={i}
                  onClick={() => onCompClick?.(comp.name)}
                  style={{ 
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    cursor: onCompClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...terminalStyles.td, textAlign: 'left' }}>
                    <span style={{ color: BT.text.primary }}>{comp.name}</span>
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>{comp.units}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.primary, fontWeight: 600 }}>
                    ${comp.avgRent.toLocaleString()}
                  </td>
                  <td style={{ 
                    ...terminalStyles.td, 
                    textAlign: 'right', 
                    color: (comp.rentGrowthYoY || 0) >= 0 ? BT.text.green : BT.text.red 
                  }}>
                    {(comp.rentGrowthYoY || 0) >= 0 ? '+' : ''}{comp.rentGrowthYoY || 0}%
                  </td>
                  <td style={{ 
                    ...terminalStyles.td, 
                    textAlign: 'right', 
                    color: comp.occupancy >= 94 ? BT.text.green : BT.text.amber 
                  }}>
                    {comp.occupancy}%
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>
                    {comp.capRate ? `${comp.capRate}%` : '—'}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.secondary }}>
                    {comp.yearBuilt || '—'}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', color: BT.text.muted }}>
                    {comp.distance || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── FINANCIALS (CONDITIONAL) ─────────────────────────────────────── */}
        {hasFinancials && (
          <>
            <SectionHeader title="FINANCIALS" subtitle="Annual operating statement" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {property.financials?.revenue && (
                <MetricCard
                  label="REVENUE"
                  value={fmt.currency(property.financials.revenue)}
                  color={BT.text.cyan}
                />
              )}
              {property.financials?.expenses && (
                <MetricCard
                  label="EXPENSES"
                  value={fmt.currency(property.financials.expenses)}
                  color={BT.text.red}
                />
              )}
              {property.financials?.noi && (
                <MetricCard
                  label="NOI"
                  value={fmt.currency(property.financials.noi)}
                  color={BT.text.green}
                />
              )}
              {property.financials?.debtService && (
                <MetricCard
                  label="DEBT SERVICE"
                  value={fmt.currency(property.financials.debtService)}
                  color={BT.text.amber}
                />
              )}
              {property.financials?.cashFlow && (
                <MetricCard
                  label="CASH FLOW"
                  value={fmt.currency(property.financials.cashFlow)}
                  color={property.financials.cashFlow >= 0 ? BT.text.green : BT.text.red}
                />
              )}
            </div>

            {/* Additional financial metrics */}
            {(property.financials?.purchasePrice || property.financials?.currentValue || property.financials?.ltv) && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {property.financials?.purchasePrice && (
                  <MetricCard
                    label="PURCHASE PRICE"
                    value={fmt.currency(property.financials.purchasePrice)}
                    color={BT.text.secondary}
                  />
                )}
                {property.financials?.currentValue && (
                  <MetricCard
                    label="CURRENT VALUE"
                    value={fmt.currency(property.financials.currentValue)}
                    color={BT.text.cyan}
                  />
                )}
                {property.financials?.equity && (
                  <MetricCard
                    label="EQUITY"
                    value={fmt.currency(property.financials.equity)}
                    color={BT.text.green}
                  />
                )}
                {property.financials?.ltv && (
                  <MetricCard
                    label="LTV"
                    value={`${property.financials.ltv}%`}
                    color={property.financials.ltv > 75 ? BT.text.amber : BT.text.secondary}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── CSS ───────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PropertyDetailPage;
