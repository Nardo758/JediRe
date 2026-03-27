/**
 * MSAHeader - Ticker-style header for MSA/Metro view
 * Shows key metro metrics with mini sparkline
 */

import React from 'react';
import { Building2, TrendingUp, TrendingDown, Users, MapPin, Award } from 'lucide-react';
import { BT } from './theme';
import { MSAData } from './MSATerminal';

interface MSAHeaderProps {
  msa: MSAData;
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

export const MSAHeader: React.FC<MSAHeaderProps> = ({
  msa,
  sparklineData,
}) => {
  const rentTrend = msa.rentGrowth >= 0 ? 'up' : 'down';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 20px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
      gap: 24,
    }}>
      {/* MSA Name & Rank */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${BT.text.amber}22 0%, ${BT.text.amber}44 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MapPin size={22} color={BT.text.amber} />
        </div>
        <div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: BT.text.primary,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {msa.name}
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: BT.text.muted,
            }}>
              {msa.state}
            </span>
          </div>
          <div style={{
            fontSize: 11,
            color: BT.text.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{msa.submarketCount} submarkets</span>
            <span style={{ color: BT.text.dim }}>•</span>
            <span>{msa.propertyCount.toLocaleString()} properties</span>
            <span style={{ color: BT.text.dim }}>•</span>
            <span>{(msa.totalUnits / 1000).toFixed(0)}K units</span>
          </div>
        </div>
      </div>

      {/* Health Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: msa.healthScore >= 75 ? `${BT.text.green}15` : `${BT.text.amber}15`,
        borderRadius: 6,
        border: `1px solid ${msa.healthScore >= 75 ? BT.text.green : BT.text.amber}44`,
      }}>
        <Award size={16} color={msa.healthScore >= 75 ? BT.text.green : BT.text.amber} />
        <div>
          <div style={{ fontSize: 9, color: BT.text.muted }}>HEALTH</div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: msa.healthScore >= 75 ? BT.text.green : BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {msa.healthScore}
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
              ${msa.avgRent.toLocaleString()}
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
              {msa.rentGrowth > 0 ? '+' : ''}{msa.rentGrowth}%
            </span>
          </div>
        </div>
      </div>

      {/* Rent Sparkline */}
      <MiniSparkline 
        data={sparklineData} 
        color={rentTrend === 'up' ? BT.text.green : BT.text.red}
      />

      {/* Occupancy */}
      <div>
        <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 2 }}>OCCUPANCY</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 20,
            fontWeight: 700,
            color: msa.occupancy >= 93 ? BT.text.green : BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {msa.occupancy.toFixed(1)}%
          </span>
          <span style={{
            fontSize: 11,
            color: msa.occupancyChange >= 0 ? BT.text.green : BT.text.red,
          }}>
            {msa.occupancyChange >= 0 ? '▲' : '▼'} {Math.abs(msa.occupancyChange).toFixed(1)}%
          </span>
        </div>
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
          {msa.avgCapRate.toFixed(1)}%
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
            {(msa.pipelineUnits / 1000).toFixed(1)}K
          </span>
          <span style={{ fontSize: 10, color: BT.text.muted }}>units</span>
        </div>
      </div>

      {/* Demographics */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} color={BT.text.muted} />
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>POPULATION</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>
              {(msa.population / 1000000).toFixed(1)}M
              <span style={{ fontSize: 10, color: BT.text.green, marginLeft: 4 }}>
                +{msa.populationGrowth}%
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={14} color={BT.text.muted} />
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>EMPLOYMENT</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>
              {(msa.employment / 1000000).toFixed(1)}M
              <span style={{ fontSize: 10, color: BT.text.green, marginLeft: 4 }}>
                +{msa.employmentGrowth}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MSAHeader;
