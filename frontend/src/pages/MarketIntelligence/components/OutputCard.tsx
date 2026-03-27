import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { SIGNAL_GROUPS, getOutput, type SignalGroupId } from '../signalGroups';

interface OutputCardProps {
  outputId: string;
  status?: 'real' | 'mock' | 'pending';
  value?: string | number;
  subtitle?: string;
  compact?: boolean;
}

const OutputCard: React.FC<OutputCardProps> = ({ outputId, status = 'pending', value, subtitle, compact = false }) => {
  const output = getOutput(outputId);
  if (!output) return null;
  const group = SIGNAL_GROUPS[output.group];

  const statusStyles: Record<string, React.CSSProperties> = {
    real: { background: BT.text.green + '22', color: BT.text.green },
    mock: { background: BT.bg.header, color: BT.text.secondary },
    pending: { background: BT.text.amber + '18', color: BT.text.amber },
  };

  const statusLabel = {
    real: 'LIVE',
    mock: 'MOCK',
    pending: 'PENDING',
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 transition-colors group" style={{ background: BT.bg.panel, borderWidth: 1, borderStyle: 'solid', borderColor: BT.border.subtle, borderRadius: 0 }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 w-8 h-5 flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: group.color, color: BT.text.white, borderRadius: 2 }}
          >
            {outputId.split('-')[0]}
          </span>
          <span className="text-xs font-mono flex-shrink-0" style={{ color: BT.text.muted }}>{outputId}</span>
          <span className="text-sm truncate" style={{ color: BT.text.secondary }}>{output.name}</span>
          {output.isNew && <span className="text-[10px] font-semibold px-1" style={{ color: BT.text.purple, background: BT.text.purple + '18', borderRadius: 2 }}>NEW</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {value !== undefined && <span className="text-sm font-semibold" style={{ color: BT.text.primary }}>{value}</span>}
          <span className="text-[10px] font-semibold px-1.5 py-0.5" style={{ ...statusStyles[status], borderRadius: 2 }}>{statusLabel[status]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border p-4 transition-shadow group relative" style={{ background: group.bgColor, borderColor: group.borderColor, borderRadius: 0 }}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[10px] border p-2 max-w-48" style={{ background: BT.bg.panel, borderColor: BT.border.subtle, borderRadius: 0 }}>
          <div className="font-semibold" style={{ color: BT.text.secondary }}>{outputId} | {output.source}</div>
          <div style={{ color: BT.text.muted }}>{output.frequency} | {output.level}</div>
        </div>
      </div>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-9 h-6 flex items-center justify-center text-[11px] font-bold"
            style={{ backgroundColor: group.color, color: BT.text.white, borderRadius: 2 }}
          >
            {outputId}
          </span>
          {output.isNew && <span className="text-[10px] font-semibold px-1.5 py-0.5" style={{ color: BT.text.purple, background: BT.text.purple + '18', borderRadius: 2 }}>NEW</span>}
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5" style={{ ...statusStyles[status], borderRadius: 2 }}>{statusLabel[status]}</span>
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: BT.text.primary }}>{output.name}</div>
      {value !== undefined && (
        <div className="text-2xl font-bold mt-1" style={{ color: group.color }}>{value}</div>
      )}
      {subtitle && <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>{subtitle}</div>}
      {!value && status !== 'real' && (
        <div className="mt-2 h-8 border border-dashed flex items-center justify-center" style={{ borderRadius: 0, background: BT.bg.panelAlt + '99', borderColor: BT.border.subtle }}>
          <span className="text-[11px]" style={{ color: BT.text.muted }}>{output.source}</span>
        </div>
      )}
    </div>
  );
};

interface SectionProps {
  title: string;
  description?: string;
  outputIds: string[];
  children?: React.ReactNode;
  groupHighlight?: SignalGroupId;
}

export const OutputSection: React.FC<SectionProps> = ({ title, description, outputIds, children, groupHighlight }) => {
  const highlightColor = groupHighlight ? SIGNAL_GROUPS[groupHighlight].color : undefined;

  return (
    <div className="border overflow-hidden" style={{ background: BT.bg.panel, borderColor: BT.border.subtle, borderRadius: 0 }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: BT.border.subtle, ...(highlightColor ? { borderLeftWidth: 4, borderLeftColor: highlightColor } : {}) }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>{title}</h3>
            {description && <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>{description}</p>}
          </div>
          <span className="text-xs font-medium px-2 py-1" style={{ color: BT.text.muted, background: BT.bg.header, borderRadius: 2 }}>
            {outputIds.length} outputs
          </span>
        </div>
      </div>
      <div className="p-4">
        {children || (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {outputIds.map(id => (
              <OutputCard key={id} outputId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputCard;
