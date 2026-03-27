/**
 * BloombergPropertyCard - Perplexity/Bloomberg terminal style property card
 * Based on the NVDA equity view - adapted for real estate
 * 
 * Features:
 * - Header ticker bar (property name, rent, change, sparkline)
 * - Property images carousel
 * - Key metrics row
 * - Mini peer comparison table
 * - Bottom status bar
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, MapPin, Building2, Calendar, Eye } from 'lucide-react';
import { BT } from './theme';

interface PropertyImage {
  url: string;
  caption?: string;
}

interface CompProperty {
  rank: number;
  name: string;
  units: number;
  avgRent: number;
  rentChange1D: number;
  rentChange1M: number;
  rentGrowthYoY: number;
  occupancy: number;
  capRate?: number;
}

interface SignalContribution {
  signal: string;
  value: number;
  weight: number;
}

interface GateResult {
  strategy: string;
  passed: boolean;
  score: number;
}

interface StrategyScoreProps {
  score: number;
  strategy?: string;
  arbitrageFlag?: boolean;
  signalContributions?: SignalContribution[];
  gateResults?: GateResult[];
}

interface BloombergPropertyCardProps {
  property: {
    id: string;
    name: string;
    address: string;
    class: 'A' | 'B' | 'C';
    avgRent: number;
    rentChange: number;
    rentChangePercent: number;
    units: number;
    yearBuilt: number;
    occupancy: number;
    occupancyChange: number;
    capRate?: number;
    sqft?: number;
    owner?: string;
    lastUpdated?: string;
    images?: PropertyImage[];
  };
  comps?: CompProperty[];
  sparklineData?: number[];
  onClick?: () => void;
  showComps?: boolean;
  strategyScore?: StrategyScoreProps;
}

// Mini sparkline component
const MiniSparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 60,
  height = 20,
}) => {
  if (!data.length) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const BloombergPropertyCard: React.FC<BloombergPropertyCardProps> = ({
  property,
  comps = [],
  sparklineData = [],
  onClick,
  showComps = true,
  strategyScore,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const images = property.images || [
    { url: 'https://placehold.co/400x240/1a1f2e/4a5568?text=Exterior', caption: 'Exterior' },
    { url: 'https://placehold.co/400x240/1a1f2e/4a5568?text=Lobby', caption: 'Lobby' },
    { url: 'https://placehold.co/400x240/1a1f2e/4a5568?text=Amenities', caption: 'Amenities' },
  ];
  
  const defaultComps: CompProperty[] = comps.length > 0 ? comps : [
    { rank: 1, name: property.name, units: property.units, avgRent: property.avgRent, rentChange1D: 0.5, rentChange1M: 2.1, rentGrowthYoY: 4.2, occupancy: property.occupancy, capRate: property.capRate },
    { rank: 2, name: 'Hanover Buckhead', units: 370, avgRent: 2280, rentChange1D: 0.3, rentChange1M: 1.8, rentGrowthYoY: 4.8, occupancy: 94.2, capRate: 5.2 },
    { rank: 3, name: 'Alexan Midtown', units: 290, avgRent: 1950, rentChange1D: -0.2, rentChange1M: 1.5, rentGrowthYoY: 3.9, occupancy: 95.0, capRate: 5.5 },
    { rank: 4, name: 'The Darcy', units: 265, avgRent: 2380, rentChange1D: 0.8, rentChange1M: 2.5, rentGrowthYoY: 6.1, occupancy: 92.8, capRate: 4.6 },
  ];

  const defaultSparkline = sparklineData.length > 0 ? sparklineData : 
    [1800, 1820, 1835, 1850, 1840, 1860, 1875, 1890, 1885, 1895, 1910, property.avgRent];

  const rentTrend = property.rentChange >= 0 ? 'up' : 'down';
  const occTrend = property.occupancyChange >= 0 ? 'up' : 'down';

  const nextImage = () => setCurrentImageIndex((i) => (i + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length);

  const getClassColor = (cls: string) => {
    if (cls === 'A') return BT.text.green;
    if (cls === 'B') return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div 
      onClick={onClick}
      style={{
        background: BT.bg.terminal,
        borderRadius: 8,
        border: `1px solid ${BT.border.medium}`,
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = BT.text.amber;
          e.currentTarget.style.boxShadow = `0 4px 20px ${BT.text.amber}22`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BT.border.medium;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header Ticker Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        gap: 12,
      }}>
        {/* Property Name & Class */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: 3,
            background: `${getClassColor(property.class)}22`,
            color: getClassColor(property.class),
            fontSize: 10,
            fontWeight: 700,
          }}>
            {property.class}
          </span>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: BT.text.primary,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {property.name}
          </span>
        </div>

        {/* Rent & Change */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            color: BT.text.green,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
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
            {rentTrend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </span>
        </div>

        {/* Mini Sparkline */}
        <MiniSparkline 
          data={defaultSparkline} 
          color={rentTrend === 'up' ? BT.text.green : BT.text.red}
        />

        {/* Quick Stats */}
        <div style={{ 
          marginLeft: 'auto', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          fontSize: 10,
          color: BT.text.muted,
        }}>
          <span>
            <strong style={{ color: BT.text.secondary }}>{property.units}</strong> units
          </span>
          <span>
            Occ <strong style={{ color: occTrend === 'up' ? BT.text.green : BT.text.red }}>
              {property.occupancy}%
            </strong>
          </span>
          {property.capRate && (
            <span>
              Cap <strong style={{ color: BT.text.cyan }}>{property.capRate}%</strong>
            </span>
          )}
        </div>

        {strategyScore && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            background: `${strategyScore.score >= 75 ? BT.text.green : strategyScore.score >= 55 ? BT.text.amber : BT.text.red}14`,
            border: `1px solid ${strategyScore.score >= 75 ? BT.text.green : strategyScore.score >= 55 ? BT.text.amber : BT.text.red}33`,
            borderRadius: 0,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: strategyScore.score >= 75 ? BT.text.green : strategyScore.score >= 55 ? BT.text.amber : BT.text.red,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {Math.round(strategyScore.score)}
            </span>
            {strategyScore.signalContributions && strategyScore.signalContributions.length > 0 && (
              <svg width={40} height={14} style={{ marginLeft: 2 }}>
                {strategyScore.signalContributions.map((sc, i) => {
                  const barH = Math.max(2, (sc.value / 100) * 12);
                  const barW = Math.floor(40 / strategyScore.signalContributions!.length) - 1;
                  return (
                    <rect
                      key={i}
                      x={i * (barW + 1)}
                      y={14 - barH}
                      width={barW}
                      height={barH}
                      fill={sc.value >= 70 ? BT.text.green : sc.value >= 45 ? BT.text.amber : BT.text.red}
                      opacity={0.8}
                    />
                  );
                })}
              </svg>
            )}
            {strategyScore.gateResults && strategyScore.gateResults.length > 0 && (
              <div style={{ display: 'flex', gap: 1, marginLeft: 2 }}>
                {strategyScore.gateResults.slice(0, 4).map((g, i) => (
                  <span key={i} style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: g.passed ? BT.text.green : BT.text.red,
                  }} />
                ))}
              </div>
            )}
            {strategyScore.arbitrageFlag && (
              <span style={{ fontSize: 8, color: BT.text.cyan, fontWeight: 700 }}>ARB</span>
            )}
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

      {/* Property Images Section - 3 images in a row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 2,
        background: BT.bg.panel,
      }}>
        {[0, 1, 2].map((idx) => {
          const img = images[idx] || images[0];
          const isMain = idx === 0;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                height: isMain ? 140 : 140,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex(idx);
              }}
            >
              <img 
                src={img?.url || `https://placehold.co/400x240/1a1f2e/4a5568?text=Image+${idx + 1}`}
                alt={img?.caption || `Property ${idx + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
              
              {/* Caption overlay */}
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
                  letterSpacing: '0.03em',
                }}>
                  {img.caption}
                </div>
              )}
              
              {/* More images indicator on last slot */}
              {idx === 2 && images.length > 3 && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: BT.text.primary,
                  fontSize: 14,
                  fontWeight: 700,
                }}>
                  +{images.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Address bar below images */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <MapPin size={12} color={BT.text.amber} />
        <span style={{ fontSize: 11, color: BT.text.primary }}>
          {property.address}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: BT.text.muted }}>
          {images.length} photos
        </span>
      </div>

      {/* Key Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '10px 12px',
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
        gap: 8,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>UNITS</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
            {property.units}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>BUILT</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}>
            {property.yearBuilt}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>OCC %</div>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 700, 
            color: property.occupancy >= 94 ? BT.text.green : BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {property.occupancy}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>CAP RATE</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
            {property.capRate ? `${property.capRate}%` : '—'}
          </div>
        </div>
      </div>

      {/* Peer Comparison Table */}
      {showComps && (
        <div style={{ padding: '8px 0' }}>
          <div style={{
            padding: '0 12px 6px',
            fontSize: 10,
            fontWeight: 600,
            color: BT.text.amber,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Peer Comparison
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: BT.bg.header }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500 }}>Name</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>Rent</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>Chg 1D</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>Chg 1M</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>YoY</th>
                <th style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>Occ</th>
              </tr>
            </thead>
            <tbody>
              {defaultComps.slice(0, 4).map((comp, i) => (
                <tr 
                  key={comp.rank}
                  style={{ 
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    background: i === 0 ? `${BT.text.amber}08` : 'transparent',
                  }}
                >
                  <td style={{ 
                    padding: '5px 8px', 
                    color: i === 0 ? BT.text.amber : BT.text.secondary,
                    fontWeight: i === 0 ? 600 : 400,
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {comp.rank}) {comp.name}
                  </td>
                  <td style={{ 
                    padding: '5px 6px', 
                    textAlign: 'right', 
                    color: BT.text.primary,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ${comp.avgRent.toLocaleString()}
                  </td>
                  <td style={{ 
                    padding: '5px 6px', 
                    textAlign: 'right',
                    color: comp.rentChange1D >= 0 ? BT.text.green : BT.text.red,
                  }}>
                    {comp.rentChange1D >= 0 ? '+' : ''}{comp.rentChange1D.toFixed(1)}%
                  </td>
                  <td style={{ 
                    padding: '5px 6px', 
                    textAlign: 'right',
                    color: comp.rentChange1M >= 0 ? BT.text.green : BT.text.red,
                  }}>
                    {comp.rentChange1M >= 0 ? '+' : ''}{comp.rentChange1M.toFixed(1)}%
                  </td>
                  <td style={{ 
                    padding: '5px 6px', 
                    textAlign: 'right',
                    color: comp.rentGrowthYoY >= 0 ? BT.text.green : BT.text.red,
                    fontWeight: 600,
                  }}>
                    {comp.rentGrowthYoY >= 0 ? '+' : ''}{comp.rentGrowthYoY.toFixed(1)}%
                  </td>
                  <td style={{ 
                    padding: '5px 6px', 
                    textAlign: 'right',
                    color: comp.occupancy >= 94 ? BT.text.green : BT.text.amber,
                  }}>
                    {comp.occupancy.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        background: BT.bg.header,
        borderTop: `1px solid ${BT.border.subtle}`,
        fontSize: 9,
        color: BT.text.dim,
        gap: 12,
      }}>
        {property.owner && (
          <>
            <span>Owner: <strong style={{ color: BT.text.secondary }}>{property.owner}</strong></span>
            <span>|</span>
          </>
        )}
        <span style={{ color: BT.text.green }}>● Rent Growth +{property.rentChangePercent}%</span>
        <span>|</span>
        <span>Updated: {property.lastUpdated || 'Today'}</span>
        <span style={{ marginLeft: 'auto' }}>
          <Eye size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Click to view details
        </span>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default BloombergPropertyCard;
