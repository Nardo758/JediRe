import React from 'react';
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

  const statusStyles = {
    real: 'bg-green-100 text-green-800',
    mock: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-50 text-amber-600',
  };

  const statusLabel = {
    real: 'LIVE',
    mock: 'MOCK',
    pending: 'PENDING',
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors group">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 w-8 h-5 flex items-center justify-center rounded text-[10px] font-bold text-white"
            style={{ backgroundColor: group.color }}
          >
            {outputId.split('-')[0]}
          </span>
          <span className="text-xs font-mono text-gray-400 flex-shrink-0">{outputId}</span>
          <span className="text-sm text-gray-700 truncate">{output.name}</span>
          {output.isNew && <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1 rounded">NEW</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {value !== undefined && <span className="text-sm font-semibold text-gray-900">{value}</span>}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusStyles[status]}`}>{statusLabel[status]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${group.bgColor} ${group.borderColor} hover:shadow-sm transition-shadow group relative`}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[10px] bg-white rounded-lg shadow-lg border p-2 max-w-48">
          <div className="font-semibold text-gray-700">{outputId} | {output.source}</div>
          <div className="text-gray-500">{output.frequency} | {output.level}</div>
        </div>
      </div>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-9 h-6 flex items-center justify-center rounded text-[11px] font-bold text-white"
            style={{ backgroundColor: group.color }}
          >
            {outputId}
          </span>
          {output.isNew && <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">NEW</span>}
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusStyles[status]}`}>{statusLabel[status]}</span>
      </div>
      <div className="text-sm font-semibold text-gray-800 mb-1">{output.name}</div>
      {value !== undefined && (
        <div className="text-2xl font-bold mt-1" style={{ color: group.color }}>{value}</div>
      )}
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      {!value && status !== 'real' && (
        <div className="mt-2 h-8 rounded-md bg-white/60 border border-dashed border-gray-200 flex items-center justify-center">
          <span className="text-[11px] text-gray-400">{output.source}</span>
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100" style={highlightColor ? { borderLeftWidth: 4, borderLeftColor: highlightColor } : {}}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
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
