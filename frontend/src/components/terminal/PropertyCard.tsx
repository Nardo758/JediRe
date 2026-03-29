/**
 * PropertyCard - Comprehensive property profile with historical tracking
 * 
 * Layout (MSA Overview style):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ HEADER: Property Name, Class Badge, JEDI Score, Live Indicator │
 * ├────────────────────────────────┬────────────────────────────────┤
 * │ PROPERTY DETAILS               │ PHOTOS (3 across)              │
 * │ - Address, Units, Year         │                                │
 * │ - Owner, Management            │                                │
 * │ - Key Metrics                  │                                │
 * ├────────────────────────────────┴────────────────────────────────┤
 * │ PERFORMANCE CHARTS (tabbed: Rent | Occupancy | NOI | Traffic)  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ COMPS (Top 5 by distance/age)          │ COMPS MAP              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ SALE & TAX HISTORY (combined timeline)                         │
 * └─────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useMemo } from 'react';
import { BT, terminalStyles, fmt } from './theme';
import { MapPin, Building2, Calendar, Users, DollarSign, TrendingUp, TrendingDown, Star, ChevronRight, ExternalLink } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyPhoto {
  url: string;
  label?: string;
}

interface CompProperty {
  id: string;
  name: string;
  address: string;
  distance: number; // miles
  units: number;
  yearBuilt: number;
  avgRent: number;
  occupancy: number;
  class: 'A' | 'B' | 'C';
  lat?: number;
  lng?: number;
}

interface SaleRecord {
  date: string;
  price: number;
  pricePerUnit: number;
  buyer: string;
  seller: string;
  capRate?: number;
}

interface TaxRecord {
  year: number;
  assessedValue: number;
  taxableValue: number;
  taxAmount: number;
  changePercent?: number;
}

interface PerformanceDataPoint {
  date: string;
  value: number;
}

interface PropertyCardProps {
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    class: 'A' | 'B' | 'C';
    units: number;
    yearBuilt: number;
    yearRenovated?: number;
    sqft?: number;
    stories?: number;
    owner: string;
    ownerType?: string;
    management?: string;
    lat?: number;
    lng?: number;
    // Current metrics
    avgRent: number;
    rentChange: number;
    occupancy: number;
    occupancyChange: number;
    capRate?: number;
    noi?: number;
    jediScore: number;
    // Photos
    photos?: PropertyPhoto[];
  };
  // Historical data
  rentHistory?: PerformanceDataPoint[];
  occupancyHistory?: PerformanceDataPoint[];
  noiHistory?: PerformanceDataPoint[];
  trafficHistory?: PerformanceDataPoint[];
  // Comps
  comps?: CompProperty[];
  // History
  saleHistory?: SaleRecord[];
  taxHistory?: TaxRecord[];
  // Callbacks
  onCompClick?: (compId: string) => void;
  onCreateDeal?: () => void;
  onTrack?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const MiniLineChart: React.FC<{
  data: PerformanceDataPoint[];
  color: string;
  height?: number;
  showLabels?: boolean;
  formatValue?: (v: number) => string;
}> = ({ data, color, height = 120, showLabels = true, formatValue = (v) => v.toFixed(1) }) => {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 40;
  const chartWidth = 100;
  const chartHeight = height - (showLabels ? 30 : 10);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - ((d.value - min) / range) * (chartHeight - 20) - 10;
    return { x: `${x}%`, y, value: d.value, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const trend = values[values.length - 1] - values[0];

  return (
    <div style={{ position: 'relative', height }}>
      <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => (
          <line
            key={pct}
            x1="0"
            y1={`${pct}%`}
            x2="100%"
            y2={`${pct}%`}
            stroke={BT.border.subtle}
            strokeWidth="1"
            strokeDasharray="2,4"
          />
        ))}
        
        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`}
          fill={`${color}15`}
        />
        
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Current value dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={color}
          stroke={BT.bg.terminal}
          strokeWidth="2"
        />
      </svg>
      
      {showLabels && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: 4,
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          color: BT.text.muted,
        }}>
          <span>{data[0].date}</span>
          <span style={{ color: trend >= 0 ? BT.text.green : BT.text.red, fontWeight: 600 }}>
            {trend >= 0 ? '▲' : '▼'} {formatValue(Math.abs(trend))}
          </span>
          <span>{data[data.length - 1].date}</span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPS MAP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CompsMap: React.FC<{
  subject: { lat?: number; lng?: number; name: string };
  comps: CompProperty[];
  onCompClick?: (compId: string) => void;
}> = ({ subject, comps, onCompClick }) => {
  // Simple placeholder map - would integrate with Mapbox/Google Maps
  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      borderRadius: 6,
      height: '100%',
      minHeight: 200,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Map Header */}
      <div style={{
        padding: '8px 12px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono'" }}>
          COMP MAP
        </span>
        <span style={{ fontSize: 9, color: BT.text.muted }}>
          {comps.length} properties
        </span>
      </div>
      
      {/* Map Area */}
      <div style={{
        flex: 1,
        background: `linear-gradient(135deg, ${BT.bg.terminal} 0%, ${BT.bg.panel} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 20,
      }}>
        {/* Subject marker (center) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: BT.text.amber,
            border: `3px solid ${BT.bg.terminal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 4px ${BT.text.amber}44`,
          }}>
            <Building2 size={12} color={BT.bg.terminal} />
          </div>
          <div style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontSize: 8,
            fontWeight: 700,
            color: BT.text.amber,
            background: BT.bg.terminal,
            padding: '2px 6px',
            borderRadius: 2,
          }}>
            SUBJECT
          </div>
        </div>
        
        {/* Comp markers (positioned around subject) */}
        {comps.slice(0, 5).map((comp, i) => {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const radius = 60 + (comp.distance * 15);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          return (
            <div
              key={comp.id}
              onClick={() => onCompClick?.(comp.id)}
              style={{
                position: 'absolute',
                top: `calc(50% + ${y}px)`,
                left: `calc(50% + ${x}px)`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: BT.bg.active,
                border: `2px solid ${BT.text.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: BT.text.cyan,
              }}>
                {i + 1}
              </div>
              <div style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 7,
                color: BT.text.muted,
                background: BT.bg.terminal,
                padding: '1px 4px',
                borderRadius: 2,
              }}>
                {comp.distance.toFixed(1)}mi
              </div>
            </div>
          );
        })}
        
        {/* Distance rings */}
        {[1, 2, 3].map(ring => (
          <div
            key={ring}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: ring * 80,
              height: ring * 80,
              borderRadius: '50%',
              border: `1px dashed ${BT.border.subtle}`,
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  rentHistory,
  occupancyHistory,
  noiHistory,
  trafficHistory,
  comps = [],
  saleHistory = [],
  taxHistory = [],
  onCompClick,
  onCreateDeal,
  onTrack,
}) => {
  const [activeChart, setActiveChart] = useState<'rent' | 'occupancy' | 'noi' | 'traffic'>('rent');
  const [compSort, setCompSort] = useState<'distance' | 'age'>('distance');

  // Sort comps
  const sortedComps = useMemo(() => {
    const sorted = [...comps];
    if (compSort === 'distance') {
      sorted.sort((a, b) => a.distance - b.distance);
    } else {
      sorted.sort((a, b) => b.yearBuilt - a.yearBuilt);
    }
    return sorted.slice(0, 5);
  }, [comps, compSort]);

  // Combine sale and tax history into timeline
  const combinedHistory = useMemo(() => {
    const items: Array<{ type: 'sale' | 'tax'; date: string; year: number; data: any }> = [];
    
    saleHistory.forEach(sale => {
      const year = parseInt(sale.date.split('-')[0]);
      items.push({ type: 'sale', date: sale.date, year, data: sale });
    });
    
    taxHistory.forEach(tax => {
      items.push({ type: 'tax', date: `${tax.year}-01-01`, year: tax.year, data: tax });
    });
    
    return items.sort((a, b) => b.year - a.year);
  }, [saleHistory, taxHistory]);

  // Default photos
  const photos = property.photos || [
    { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', label: 'Exterior' },
    { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', label: 'Interior' },
    { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', label: 'Amenities' },
  ];

  // Default performance data
  const defaultRentHistory: PerformanceDataPoint[] = rentHistory || [
    { date: 'Jan 24', value: property.avgRent * 0.88 },
    { date: 'Apr 24', value: property.avgRent * 0.90 },
    { date: 'Jul 24', value: property.avgRent * 0.93 },
    { date: 'Oct 24', value: property.avgRent * 0.95 },
    { date: 'Jan 25', value: property.avgRent * 0.97 },
    { date: 'Apr 25', value: property.avgRent * 0.99 },
    { date: 'Jul 25', value: property.avgRent },
  ];

  const defaultOccHistory: PerformanceDataPoint[] = occupancyHistory || [
    { date: 'Jan 24', value: property.occupancy - 4 },
    { date: 'Apr 24', value: property.occupancy - 3 },
    { date: 'Jul 24', value: property.occupancy - 2 },
    { date: 'Oct 24', value: property.occupancy - 1.5 },
    { date: 'Jan 25', value: property.occupancy - 0.5 },
    { date: 'Apr 25', value: property.occupancy },
    { date: 'Jul 25', value: property.occupancy },
  ];

  const getClassColor = (cls: string) => {
    if (cls === 'A') return BT.text.green;
    if (cls === 'B') return BT.text.amber;
    return BT.text.red;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return BT.text.green;
    if (score >= 60) return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div style={{
      background: BT.bg.terminal,
      borderRadius: 8,
      border: `1px solid ${BT.border.medium}`,
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        gap: 12,
      }}>
        {/* Class Badge */}
        <div style={{
          padding: '4px 10px',
          borderRadius: 4,
          background: `${getClassColor(property.class)}22`,
          border: `1px solid ${getClassColor(property.class)}44`,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color: getClassColor(property.class),
            fontFamily: "'JetBrains Mono'",
          }}>
            {property.class}
          </span>
        </div>

        {/* Property Name */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>
            {property.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <MapPin size={10} color={BT.text.muted} />
            <span style={{ fontSize: 11, color: BT.text.secondary }}>
              {property.address}, {property.city}, {property.state} {property.zip}
            </span>
          </div>
        </div>

        {/* JEDI Score */}
        <div style={{
          padding: '8px 14px',
          background: `${getScoreColor(property.jediScore)}15`,
          border: `1px solid ${getScoreColor(property.jediScore)}44`,
          borderRadius: 6,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            color: getScoreColor(property.jediScore),
            fontFamily: "'JetBrains Mono'",
            lineHeight: 1,
          }}>
            {property.jediScore}
          </div>
          <div style={{ fontSize: 8, color: BT.text.muted, letterSpacing: '0.1em', marginTop: 2 }}>
            JEDI SCORE
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onTrack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              background: 'transparent',
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 4,
              color: BT.text.muted,
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Star size={12} />
            TRACK
          </button>
          <button
            onClick={onCreateDeal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              background: `${BT.text.green}22`,
              border: `1px solid ${BT.text.green}66`,
              borderRadius: 4,
              color: BT.text.green,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            CREATE DEAL
            <ChevronRight size={12} />
          </button>
        </div>

        {/* Live Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          fontWeight: 600,
          color: BT.text.green,
          fontFamily: "'JetBrains Mono'",
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

      {/* ═══ DETAILS + PHOTOS ROW ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        {/* Property Details */}
        <div style={{ padding: 16, borderRight: `1px solid ${BT.border.subtle}` }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: BT.text.amber,
            letterSpacing: '0.05em',
            marginBottom: 12,
            fontFamily: "'JetBrains Mono'",
          }}>
            PROPERTY DETAILS
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'UNITS', value: property.units, color: BT.text.primary },
              { label: 'BUILT', value: property.yearBuilt, color: BT.text.secondary },
              { label: 'STORIES', value: property.stories || '—', color: BT.text.secondary },
              { label: 'SQ FT', value: property.sqft ? `${(property.sqft / 1000).toFixed(0)}K` : '—', color: BT.text.secondary },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono'" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: BT.border.subtle, margin: '12px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: BT.text.muted }}>OWNER</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>{property.owner}</div>
              {property.ownerType && (
                <div style={{ fontSize: 9, color: BT.text.muted }}>{property.ownerType}</div>
              )}
            </div>
            {property.management && (
              <div>
                <div style={{ fontSize: 9, color: BT.text.muted }}>MANAGEMENT</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.secondary }}>{property.management}</div>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: BT.border.subtle, margin: '12px 0' }} />

          {/* Current Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { 
                label: 'AVG RENT', 
                value: `$${property.avgRent.toLocaleString()}`, 
                change: property.rentChange >= 0 ? `+${property.rentChange}` : property.rentChange,
                color: BT.text.green,
                changeColor: property.rentChange >= 0 ? BT.text.green : BT.text.red,
              },
              { 
                label: 'OCCUPANCY', 
                value: `${property.occupancy}%`, 
                change: property.occupancyChange >= 0 ? `+${property.occupancyChange}%` : `${property.occupancyChange}%`,
                color: property.occupancy >= 94 ? BT.text.green : BT.text.amber,
                changeColor: property.occupancyChange >= 0 ? BT.text.green : BT.text.red,
              },
              { 
                label: 'CAP RATE', 
                value: property.capRate ? `${property.capRate}%` : '—', 
                color: BT.text.cyan,
              },
              { 
                label: 'NOI', 
                value: property.noi ? `$${(property.noi / 1000).toFixed(0)}K` : '—', 
                color: BT.text.green,
              },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono'" }}>
                  {item.value}
                </div>
                {item.change && (
                  <div style={{ fontSize: 9, color: item.changeColor, fontWeight: 600 }}>
                    {item.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div style={{ padding: 16 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: BT.text.amber,
            letterSpacing: '0.05em',
            marginBottom: 12,
            fontFamily: "'JetBrains Mono'",
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>PHOTOS</span>
            <span style={{ color: BT.text.muted, fontWeight: 400 }}>{photos.length} images</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.slice(0, 3).map((photo, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  paddingTop: '70%',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: BT.bg.panel,
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.label || `Photo ${i + 1}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {photo.label && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 6px 4px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                    fontSize: 8,
                    color: BT.text.secondary,
                    textTransform: 'uppercase',
                  }}>
                    {photo.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ PERFORMANCE CHARTS ═══ */}
      <div style={{ padding: 16, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: BT.text.amber,
            letterSpacing: '0.05em',
            fontFamily: "'JetBrains Mono'",
          }}>
            PERFORMANCE HISTORY
          </div>
          
          {/* Chart Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'rent', label: 'RENT', color: BT.text.green },
              { key: 'occupancy', label: 'OCC', color: BT.text.cyan },
              { key: 'noi', label: 'NOI', color: BT.text.amber },
              { key: 'traffic', label: 'TRAFFIC', color: BT.text.violet },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveChart(tab.key as any)}
                style={{
                  padding: '4px 10px',
                  background: activeChart === tab.key ? `${tab.color}22` : 'transparent',
                  border: `1px solid ${activeChart === tab.key ? tab.color : BT.border.subtle}`,
                  borderRadius: 4,
                  color: activeChart === tab.key ? tab.color : BT.text.muted,
                  fontSize: 9,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono'",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chart */}
        <div style={{ background: BT.bg.panel, borderRadius: 6, padding: 16 }}>
          {activeChart === 'rent' && (
            <MiniLineChart
              data={defaultRentHistory}
              color={BT.text.green}
              formatValue={(v) => `$${v.toFixed(0)}`}
            />
          )}
          {activeChart === 'occupancy' && (
            <MiniLineChart
              data={defaultOccHistory}
              color={BT.text.cyan}
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          )}
          {activeChart === 'noi' && (
            <MiniLineChart
              data={noiHistory || defaultRentHistory.map(d => ({ ...d, value: d.value * property.units * 0.4 / 12 }))}
              color={BT.text.amber}
              formatValue={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
          )}
          {activeChart === 'traffic' && (
            <MiniLineChart
              data={trafficHistory || defaultOccHistory.map(d => ({ ...d, value: d.value * 0.8 }))}
              color={BT.text.violet}
              formatValue={(v) => v.toFixed(0)}
            />
          )}
        </div>
      </div>

      {/* ═══ COMPS SECTION ═══ */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 300px', 
        gap: 0,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        {/* Comps Table */}
        <div style={{ padding: 16, borderRight: `1px solid ${BT.border.subtle}` }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: BT.text.amber,
              letterSpacing: '0.05em',
              fontFamily: "'JetBrains Mono'",
            }}>
              TOP 5 COMPS
            </div>
            
            {/* Sort Toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'distance', label: 'BY DISTANCE' },
                { key: 'age', label: 'BY AGE' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setCompSort(opt.key as any)}
                  style={{
                    padding: '3px 8px',
                    background: compSort === opt.key ? BT.bg.active : 'transparent',
                    border: `1px solid ${compSort === opt.key ? BT.text.cyan : BT.border.subtle}`,
                    borderRadius: 3,
                    color: compSort === opt.key ? BT.text.cyan : BT.text.muted,
                    fontSize: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono'",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Comps Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: BT.bg.header }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500 }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500 }}>PROPERTY</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>DIST</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>UNITS</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>YEAR</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>RENT</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>OCC</th>
              </tr>
            </thead>
            <tbody>
              {sortedComps.map((comp, i) => (
                <tr
                  key={comp.id}
                  onClick={() => onCompClick?.(comp.id)}
                  style={{
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.cardHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '8px', color: BT.text.cyan, fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ fontWeight: 600, color: BT.text.primary }}>{comp.name}</div>
                    <div style={{ fontSize: 9, color: BT.text.muted }}>{comp.address}</div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: BT.text.secondary, fontFamily: "'JetBrains Mono'" }}>
                    {comp.distance.toFixed(1)}mi
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: BT.text.secondary, fontFamily: "'JetBrains Mono'" }}>
                    {comp.units}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: BT.text.secondary, fontFamily: "'JetBrains Mono'" }}>
                    {comp.yearBuilt}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: BT.text.green, fontWeight: 600, fontFamily: "'JetBrains Mono'" }}>
                    ${comp.avgRent.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                    <span style={{ color: comp.occupancy >= 94 ? BT.text.green : BT.text.amber }}>
                      {comp.occupancy}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Comps Map */}
        <div style={{ padding: 16 }}>
          <CompsMap
            subject={{ lat: property.lat, lng: property.lng, name: property.name }}
            comps={sortedComps}
            onCompClick={onCompClick}
          />
        </div>
      </div>

      {/* ═══ SALE & TAX HISTORY ═══ */}
      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: BT.text.amber,
          letterSpacing: '0.05em',
          marginBottom: 12,
          fontFamily: "'JetBrains Mono'",
        }}>
          SALE & TAX HISTORY
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {combinedHistory.length === 0 ? (
            <div style={{ 
              padding: 20, 
              background: BT.bg.panel, 
              borderRadius: 6, 
              textAlign: 'center',
              color: BT.text.muted,
              fontSize: 11,
            }}>
              No sale or tax history available
            </div>
          ) : (
            combinedHistory.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: BT.bg.panel,
                  borderRadius: 6,
                  borderLeft: `3px solid ${item.type === 'sale' ? BT.text.green : BT.text.cyan}`,
                }}
              >
                {item.type === 'sale' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: BT.text.green, letterSpacing: '0.05em' }}>
                        SALE
                      </span>
                      <span style={{ fontSize: 10, color: BT.text.muted }}>{item.data.date}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono'" }}>
                      ${(item.data.price / 1000000).toFixed(1)}M
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.secondary, marginTop: 4 }}>
                      ${item.data.pricePerUnit.toLocaleString()}/unit
                      {item.data.capRate && <span style={{ marginLeft: 8 }}>• {item.data.capRate}% cap</span>}
                    </div>
                    <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 6 }}>
                      {item.data.seller} → {item.data.buyer}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: BT.text.cyan, letterSpacing: '0.05em' }}>
                        TAX ASSESSMENT
                      </span>
                      <span style={{ fontSize: 10, color: BT.text.muted }}>{item.data.year}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 8, color: BT.text.muted }}>ASSESSED</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, fontFamily: "'JetBrains Mono'" }}>
                          ${(item.data.assessedValue / 1000000).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: BT.text.muted }}>TAXABLE</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.secondary, fontFamily: "'JetBrains Mono'" }}>
                          ${(item.data.taxableValue / 1000000).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: BT.text.muted }}>TAX</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono'" }}>
                          ${(item.data.taxAmount / 1000).toFixed(0)}K
                        </div>
                      </div>
                    </div>
                    {item.data.changePercent !== undefined && (
                      <div style={{ 
                        fontSize: 9, 
                        color: item.data.changePercent >= 0 ? BT.text.red : BT.text.green,
                        marginTop: 6,
                      }}>
                        {item.data.changePercent >= 0 ? '▲' : '▼'} {Math.abs(item.data.changePercent)}% from prior year
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PropertyCard;
