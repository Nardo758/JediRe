/**
 * SubmarketHeader - Ticker-style header for submarket view
 * Shows key submarket metrics with mini sparkline
 */

import React from 'react';
import { Building2, TrendingUp, TrendingDown, Users, Home } from 'lucide-react';
import { BT } from './theme';
import { SubmarketData } from './SubmarketTerminal';

interface SubmarketHeaderProps {
  submarket: SubmarketData;
  sparklineData: number[];
}

// Mini sparkline component
const MiniSparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 80,
  height = 24,
}) => {
  if (!data.length) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
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

export const SubmarketHeader: React.FC<SubmarketHeaderProps> = ({
  submarket,
  sparklineData,
}) => {
  const occupancyTrend = submarket.occupancyChange >= 0 ? 'up' : 'down';
  const rentTrend = submarket.rentGrowth >= 0 ? 'up' : 'down';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 20px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
      gap: 24,
    }}>
      {/* Submarket Name & Type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${BT.text.cyan}22 0%, ${BT.text.cyan}44 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Building2 size={20} color={BT.text.cyan} />
        </div>
        <div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: BT.text.primary,
            letterSpacing: '-0.02em',
          }}>
            {submarket.name}
          </div>
          <div style={{
            fontSize: 11,
            color: BT.text.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{submarket.propertyCount} properties</span>
            <span style={{ color: BT.text.dim }}>•</span>
            <span>{submarket.totalUnits.toLocaleString()} units</span>
          </div>
        </div>
      </div>

      {/* Avg Rent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>AVG RENT</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              color: BT.text.primary,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              ${submarket.avgRent.toLocaleString()}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: rentTrend === 'up' ? BT.text.green : BT.text.red,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}>
              {rentTrend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {submarket.rentGrowth > 0 ? '+' : ''}{submarket.rentGrowth}%
            </span>
          </div>
        </div>
      </div>

      {/* Occupancy with Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>OCCUPANCY</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              color: submarket.occupancy >= 93 ? BT.text.green : 
                     submarket.occupancy >= 90 ? BT.text.amber : BT.text.red,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {submarket.occupancy.toFixed(1)}%
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: occupancyTrend === 'up' ? BT.text.green : BT.text.red,
            }}>
              {occupancyTrend === 'up' ? '▲' : '▼'} {Math.abs(submarket.occupancyChange).toFixed(1)}%
            </span>
          </div>
        </div>
        <MiniSparkline 
          data={sparklineData} 
          color={submarket.occupancy >= 93 ? BT.text.green : BT.text.amber}
        />
      </div>

      {/* Cap Rate */}
      <div>
        <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>AVG CAP</div>
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: BT.text.cyan,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {submarket.avgCapRate.toFixed(1)}%
        </div>
      </div>

      {/* Class Mix */}
      <div>
        <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>CLASS MIX</div>
        <div style={{ display: 'flex', gap: 2, height: 8, width: 80 }}>
          <div style={{
            width: `${submarket.classAPercent}%`,
            background: BT.text.green,
            borderRadius: '2px 0 0 2px',
          }} title={`Class A: ${submarket.classAPercent}%`} />
          <div style={{
            width: `${submarket.classBPercent}%`,
            background: BT.text.amber,
          }} title={`Class B: ${submarket.classBPercent}%`} />
          <div style={{
            width: `${submarket.classCPercent}%`,
            background: BT.text.red,
            borderRadius: '0 2px 2px 0',
          }} title={`Class C: ${submarket.classCPercent}%`} />
        </div>
        <div style={{ fontSize: 9, color: BT.text.dim, marginTop: 2 }}>
          A:{submarket.classAPercent}% B:{submarket.classBPercent}% C:{submarket.classCPercent}%
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>PIPELINE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 20,
            fontWeight: 700,
            color: BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {(submarket.pipelineUnits / 1000).toFixed(1)}K
          </span>
          <span style={{ fontSize: 11, color: BT.text.muted }}>units</span>
        </div>
      </div>

      {/* Demographics */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} color={BT.text.muted} />
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>POPULATION</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>
              {(submarket.population / 1000).toFixed(0)}K
              <span style={{ 
                fontSize: 10, 
                color: BT.text.green, 
                marginLeft: 4 
              }}>
                +{submarket.populationGrowth}%
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Home size={14} color={BT.text.muted} />
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>MED INCOME</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>
              ${(submarket.medianIncome / 1000).toFixed(0)}K
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmarketHeader;
