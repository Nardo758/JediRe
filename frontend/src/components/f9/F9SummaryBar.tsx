/**
 * F9SummaryBar — ProForma Evidence Summary Bar
 *
 * Displays at the top of the F9 ProForma tab to give a quick view of:
 *   • Collision counter (minor / material / severe) — click to filter
 *   • Confidence distribution (high / medium / low)
 *   • Tier distribution (T1 / T2 / T3 / T4)
 *   • Archive Percentile chip — shows after archive has >= 10 deals in the bucket
 */

import React from 'react';
import { BT, BT_CSS } from '../deal/bloomberg-ui';

interface CollisionSummary {
  minor_count: number;
  material_count: number;
  severe_count: number;
}

interface ConfidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

interface TierDistribution {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
}

interface F9SummaryBarProps {
  collision_summary?: CollisionSummary;
  confidence_distribution?: ConfidenceDistribution;
  tier_distribution?: TierDistribution;
  archive_percentile?: number | null;
  onFilterChange?: (filter: { type: 'collision' | 'confidence' | 'tier'; value: string } | null) => void;
  activeFilter?: { type: 'collision' | 'confidence' | 'tier'; value: string } | null;
}

interface MetricPillProps {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}

function MetricPill({ label, value, color, onClick, active }: MetricPillProps) {
  const mono = BT.font.mono;
  return (
    <button
      onClick={onClick}
      title={`${label}: ${value}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 3,
        background: active ? `${color}22` : 'transparent',
        border: `1px solid ${active ? color : BT.border.subtle}`,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color }}>
        {value}
      </span>
    </button>
  );
}

export function F9SummaryBar({
  collision_summary,
  confidence_distribution,
  tier_distribution,
  archive_percentile,
  onFilterChange,
  activeFilter,
}: F9SummaryBarProps) {
  const mono = BT.font.mono;

  if (!collision_summary && !confidence_distribution && !tier_distribution && archive_percentile == null) {
    return null;
  }

  const totalCollisions = (collision_summary?.material_count ?? 0) + (collision_summary?.severe_count ?? 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '5px 12px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
      flexShrink: 0, flexWrap: 'wrap',
    }}>
      <style>{BT_CSS}</style>

      {/* Collision section */}
      {collision_summary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>COLLISIONS</span>
          {collision_summary.severe_count > 0 && (
            <MetricPill
              label="SEV"
              value={collision_summary.severe_count}
              color={BT.text.red}
              onClick={() => onFilterChange?.({ type: 'collision', value: 'severe' })}
              active={activeFilter?.type === 'collision' && activeFilter.value === 'severe'}
            />
          )}
          {collision_summary.material_count > 0 && (
            <MetricPill
              label="MAT"
              value={collision_summary.material_count}
              color={BT.text.amber}
              onClick={() => onFilterChange?.({ type: 'collision', value: 'material' })}
              active={activeFilter?.type === 'collision' && activeFilter.value === 'material'}
            />
          )}
          {totalCollisions === 0 && (
            <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.green }}>✓ NONE</span>
          )}
        </div>
      )}

      {collision_summary && <div style={{ width: 1, height: 16, background: BT.border.subtle }} />}

      {/* Confidence section */}
      {confidence_distribution && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>CONFIDENCE</span>
          <MetricPill
            label="HI"
            value={confidence_distribution.high}
            color={BT.text.green}
            onClick={() => onFilterChange?.({ type: 'confidence', value: 'high' })}
            active={activeFilter?.type === 'confidence' && activeFilter.value === 'high'}
          />
          <MetricPill
            label="MED"
            value={confidence_distribution.medium}
            color={BT.text.amber}
            onClick={() => onFilterChange?.({ type: 'confidence', value: 'medium' })}
            active={activeFilter?.type === 'confidence' && activeFilter.value === 'medium'}
          />
          <MetricPill
            label="LO"
            value={confidence_distribution.low}
            color={BT.text.red}
            onClick={() => onFilterChange?.({ type: 'confidence', value: 'low' })}
            active={activeFilter?.type === 'confidence' && activeFilter.value === 'low'}
          />
        </div>
      )}

      {confidence_distribution && tier_distribution && <div style={{ width: 1, height: 16, background: BT.border.subtle }} />}

      {/* Tier distribution section */}
      {tier_distribution && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>TIER</span>
          <MetricPill
            label="T1"
            value={tier_distribution.tier1}
            color={BT.accent.doc}
            onClick={() => onFilterChange?.({ type: 'tier', value: '1' })}
            active={activeFilter?.type === 'tier' && activeFilter.value === '1'}
          />
          <MetricPill
            label="T2"
            value={tier_distribution.tier2}
            color="#60A5FA"
            onClick={() => onFilterChange?.({ type: 'tier', value: '2' })}
            active={activeFilter?.type === 'tier' && activeFilter.value === '2'}
          />
          <MetricPill
            label="T3"
            value={tier_distribution.tier3}
            color={BT.text.purple}
            onClick={() => onFilterChange?.({ type: 'tier', value: '3' })}
            active={activeFilter?.type === 'tier' && activeFilter.value === '3'}
          />
          {tier_distribution.tier4 > 0 && (
            <MetricPill
              label="T4"
              value={tier_distribution.tier4}
              color={BT.text.orange}
              onClick={() => onFilterChange?.({ type: 'tier', value: '4' })}
              active={activeFilter?.type === 'tier' && activeFilter.value === '4'}
            />
          )}
        </div>
      )}

      {/* Archive percentile chip — only shown when archive has enough data */}
      {archive_percentile != null && (
        <>
          <div style={{ width: 1, height: 16, background: BT.border.subtle }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 3,
            background: `${BT.text.purple}18`,
            border: `1px solid ${BT.text.purple}44`,
          }}>
            <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.purple, letterSpacing: 0.5 }}>
              ARCHIVE
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: BT.text.amber }}>
              {archive_percentile}th pct
            </span>
            <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>
              {archive_percentile >= 75 ? '▲ AGGRESSIVE' : archive_percentile <= 25 ? '▼ CONSERVATIVE' : '● IN RANGE'}
            </span>
          </div>
        </>
      )}

      {/* Clear filter button */}
      {activeFilter && (
        <button
          onClick={() => onFilterChange?.(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: mono, fontSize: 7, color: BT.text.muted,
            padding: '2px 6px', marginLeft: 'auto',
          }}
        >
          CLEAR FILTER ×
        </button>
      )}
    </div>
  );
}
