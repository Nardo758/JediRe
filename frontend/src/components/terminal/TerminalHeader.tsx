/**
 * TerminalHeader - Bloomberg-style property ticker header
 * Shows: Property name, key metrics, mini sparkline, live status
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BT, fmt } from './theme';

interface PropertyMetrics {
  name: string;
  address?: string;
  avgRent: number;
  rentChange: number;        // % change
  occupancy: number;         // 0-1
  occupancyChange: number;   // % change
  units: number;
  noi?: number;
  capRate?: number;
  lastUpdated?: string;
}

interface TerminalHeaderProps {
  property: PropertyMetrics;
  sparklineData?: number[];  // Last 12 data points for mini chart
  isLive?: boolean;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  property,
  sparklineData = [],
  isLive = true,
}) => {
  const rentTrend = property.rentChange >= 0;
  const occTrend = property.occupancyChange >= 0;

  // Mini sparkline SVG
  const sparkline = useMemo(() => {
    if (sparklineData.length < 2) return null;
    
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 80;
    const height = 24;
    const padding = 2;
    
    const points = sparklineData.map((v, i) => {
      const x = padding + (i / (sparklineData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    
    const trend = sparklineData[sparklineData.length - 1] >= sparklineData[0];
    const color = trend ? BT.text.green : BT.text.red;
    
    return (
      <svg width={width} height={height} style={{ marginLeft: 8 }}>
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
  }, [sparklineData]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 20px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      {/* Left: Property ticker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Property name & type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px',
            background: BT.bg.active,
            border: `1px solid ${BT.border.highlight}`,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            color: BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            PROP
          </span>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: BT.text.primary,
            fontFamily: "'Syne', sans-serif",
          }}>
            {property.name}
          </span>
        </div>

        {/* Rent with change */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: BT.text.primary,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            ${property.avgRent.toLocaleString()}
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 12,
            fontWeight: 600,
            color: rentTrend ? BT.text.green : BT.text.red,
          }}>
            {rentTrend ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {fmt.change(property.rentChange)}
          </span>
          {sparkline}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: BT.border.medium }} />

        {/* Secondary metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
          <div>
            <span style={{ color: BT.text.muted }}>Occ </span>
            <span style={{ 
              color: BT.text.primary, 
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {fmt.percentInt(property.occupancy)}
            </span>
            <span style={{ 
              color: occTrend ? BT.text.green : BT.text.red,
              marginLeft: 4,
              fontSize: 11,
            }}>
              {fmt.change(property.occupancyChange)}
            </span>
          </div>

          <div>
            <span style={{ color: BT.text.muted }}>Units </span>
            <span style={{ 
              color: BT.text.primary, 
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {property.units}
            </span>
          </div>

          {property.noi && (
            <div>
              <span style={{ color: BT.text.muted }}>NOI </span>
              <span style={{ 
                color: BT.text.green, 
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {fmt.currency(property.noi)}
              </span>
            </div>
          )}

          {property.capRate && (
            <div>
              <span style={{ color: BT.text.muted }}>Cap </span>
              <span style={{ 
                color: BT.text.cyan, 
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {fmt.percent(property.capRate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Status & actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live indicator */}
        {isLive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'rgba(0, 210, 106, 0.1)',
            border: '1px solid rgba(0, 210, 106, 0.3)',
            borderRadius: 4,
          }}>
            <Activity size={12} style={{ color: BT.text.green }} />
            <span style={{ 
              fontSize: 10, 
              fontWeight: 700, 
              color: BT.text.green,
              letterSpacing: '0.05em',
            }}>
              LIVE
            </span>
          </div>
        )}

        {/* Last updated */}
        {property.lastUpdated && (
          <span style={{ fontSize: 10, color: BT.text.dim }}>
            Updated {property.lastUpdated}
          </span>
        )}

        {/* Platform badge */}
        <span style={{
          fontSize: 11,
          color: BT.text.muted,
          fontStyle: 'italic',
        }}>
          Property Analytics Platform
        </span>
      </div>
    </div>
  );
};

export default TerminalHeader;
