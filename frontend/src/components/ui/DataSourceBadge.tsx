import React from 'react';

export type SourceType = 'upload' | 'manual' | 'ai_computed' | 'market_default' | 'archived_deal' | 'csv_upload' | 'template' | 'market_comps' | string;

interface DataSourceBadgeProps {
  sourceType?: SourceType | null;
  sourceRef?: string | null;
  sourceDate?: string | null;
  sourcePeriodLabel?: string | null;
  compact?: boolean;
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  upload:        { label: 'Upload',     color: '#33d17a', bgColor: 'rgba(51,209,122,0.12)' },
  csv_upload:    { label: 'Upload',     color: '#33d17a', bgColor: 'rgba(51,209,122,0.12)' },
  manual:        { label: 'Manual',     color: '#f5a623', bgColor: 'rgba(245,166,35,0.12)' },
  ai_computed:   { label: 'AI',         color: '#a78bfa', bgColor: 'rgba(167,139,250,0.12)' },
  market_default:{ label: 'Mkt Default',color: '#64748b', bgColor: 'rgba(100,116,139,0.12)' },
  market_comps:  { label: 'Mkt Comps',  color: '#22d3ee', bgColor: 'rgba(34,211,238,0.12)' },
  archived_deal: { label: 'Deal Data',  color: '#fb923c', bgColor: 'rgba(251,146,60,0.12)' },
  template:      { label: 'Template',   color: '#94a3b8', bgColor: 'rgba(148,163,184,0.12)' },
};

function getConfig(sourceType: string) {
  return SOURCE_CONFIG[sourceType] || { label: sourceType, color: '#94a3b8', bgColor: 'rgba(148,163,184,0.12)' };
}

function formatRef(ref: string): string {
  const name = ref.replace(/^.*[\\/]/, '');
  return name.length > 20 ? name.slice(0, 18) + '…' : name;
}

export function DataSourceBadge({ sourceType, sourceRef, sourceDate, sourcePeriodLabel, compact = false }: DataSourceBadgeProps) {
  if (!sourceType) return null;

  const config = getConfig(sourceType);
  const periodText = sourcePeriodLabel || (sourceDate ? new Date(sourceDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null);
  const refText = sourceRef ? formatRef(sourceRef) : null;

  const label = compact
    ? (periodText ? `${config.label} ${periodText}` : config.label)
    : [config.label, periodText, refText].filter(Boolean).join(' · ');

  return (
    <span
      title={[sourceType, sourceRef, sourceDate].filter(Boolean).join(' | ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
        letterSpacing: '0.03em',
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}33`,
        whiteSpace: 'nowrap',
        lineHeight: '14px',
        cursor: 'default',
      }}
    >
      <span style={{
        width: 4,
        height: 4,
        borderRadius: '50%',
        backgroundColor: config.color,
        flexShrink: 0,
      }} />
      {label}
    </span>
  );
}

export function DataSourceIndicator({ sourceType, tooltip }: { sourceType?: SourceType | null; tooltip?: string }) {
  if (!sourceType) return null;
  const config = getConfig(sourceType);
  return (
    <span
      title={tooltip || config.label}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: config.color,
        marginLeft: 4,
        cursor: 'default',
      }}
    />
  );
}
