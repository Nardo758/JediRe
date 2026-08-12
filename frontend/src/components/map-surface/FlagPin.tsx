import React from 'react';

export interface FlagPinProps {
  value?: string | number;
  color: string;      // hex color for flag body
  textColor?: string; // text color (defaults to white)
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean; // when false, renders a compact dot instead of text
  onClick?: () => void;
}

const SIZE_MAP = {
  sm: { w: 28, h: 32, font: 8, stroke: 1 },
  md: { w: 34, h: 40, font: 9, stroke: 1.5 },
  lg: { w: 42, h: 48, font: 10, stroke: 2 },
};

/**
 * SVG Flag Pin — shaped like a map push-pin flag.
 * The flag body is colored by the active metric tier.
 * The label shows the selected display metric value when showValue=true.
 * When showValue=false, renders a compact colored dot for cleaner maps.
 */
export const FlagPin: React.FC<FlagPinProps> = ({
  value,
  color,
  textColor = '#fff',
  size = 'md',
  showValue = true,
  onClick,
}) => {
  const s = SIZE_MAP[size];
  const halfW = s.w / 2;

  // Compact dot mode (no text)
  if (!showValue) {
    return (
      <div
        onClick={onClick}
        style={{
          width: 18,
          height: 18,
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          userSelect: 'none',
        }}
        title={value != null ? String(value) : undefined}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 18 18"
          style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
        >
          <circle cx={9} cy={9} r={7} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth={1.5} />
          <circle cx={9} cy={9} r={3} fill="rgba(255,255,255,0.4)" />
        </svg>
      </div>
    );
  }

  const displayText = value != null ? String(value).slice(0, 5) : '';

  return (
    <div
      onClick={onClick}
      style={{
        width: s.w,
        height: s.h,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        userSelect: 'none',
      }}
      title={value != null ? String(value) : undefined}
    >
      <svg
        width={s.w}
        height={s.h}
        viewBox={`0 0 ${s.w} ${s.h}`}
        style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
      >
        {/* Flag body */}
        <path
          d={`
            M 0,0
            L ${s.w},0
            L ${s.w},${s.h - 8}
            L ${halfW},${s.h}
            L 0,${s.h - 8}
            Z
          `}
          fill={color}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={s.stroke}
        />
        {/* Label */}
        <text
          x={halfW}
          y={(s.h - 6) / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={s.font}
          fontWeight={700}
          fontFamily="'JetBrains Mono', 'Fira Code', monospace"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {displayText}
        </text>
      </svg>
    </div>
  );
};

/**
 * Metric color scale helpers.
 * Returns the tier color for a given metric value.
 */
export type MetricTier = 'strong' | 'fair' | 'watch' | 'risk' | 'neutral';

export const TIER_COLORS: Record<MetricTier, string> = {
  strong: '#00D26A',   // 🟢
  fair: '#F5A623',     // 🟡
  watch: '#FF8C42',    // 🟠
  risk: '#FF4757',     // 🔴
  neutral: '#8B95A5',  // gray
};

export function getMetricTier(metric: string, value: number | null | undefined): MetricTier {
  if (value == null) return 'neutral';

  switch (metric) {
    case 'jediScore':
      if (value >= 70) return 'strong';
      if (value >= 50) return 'fair';
      if (value >= 35) return 'watch';
      return 'risk';
    case 'occupancyRate':
      if (value >= 0.93) return 'strong';
      if (value >= 0.85) return 'fair';
      if (value >= 0.75) return 'watch';
      return 'risk';
    case 'rentGrowth':
      if (value >= 3) return 'strong';
      if (value >= 1) return 'fair';
      if (value >= 0) return 'watch';
      return 'risk';
    case 'concessions':
      if (value < 5000) return 'strong';
      if (value < 15000) return 'fair';
      if (value < 30000) return 'watch';
      return 'risk';
    case 'vacancyLoss':
      if (value < 5000) return 'strong';
      if (value < 15000) return 'fair';
      if (value < 30000) return 'watch';
      return 'risk';
    case 'noi':
      if (value > 300000) return 'strong';
      if (value > 150000) return 'fair';
      if (value > 50000) return 'watch';
      return 'risk';
    default:
      return 'neutral';
  }
}

export function getTierColor(metric: string, value: number | null | undefined): string {
  return TIER_COLORS[getMetricTier(metric, value)];
}

/**
 * Format a metric value for display on the pin.
 */
export function formatMetricValue(metric: string, value: number | null | undefined): string {
  if (value == null) return '—';
  switch (metric) {
    case 'jediScore':
      return Math.round(value).toString();
    case 'occupancyRate':
      return `${(value * 100).toFixed(0)}%`;
    case 'rentGrowth':
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    case 'concessions':
    case 'vacancyLoss':
    case 'noi':
      return value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value.toFixed(0)}`;
    case 'avgEffectiveRent':
      return `$${Math.round(value)}`;
    default:
      return String(Math.round(value));
  }
}
