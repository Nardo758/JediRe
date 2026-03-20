import React from 'react';
import { KeyMoment as KeyMomentType } from '../../../types/activity';
import { format } from 'date-fns';

interface KeyMomentProps {
  moment: KeyMomentType;
  onClick?: (moment: KeyMomentType) => void;
}

const momentIcons: Record<KeyMomentType['momentType'], string> = {
  milestone: '🎯',
  decision: '💡',
  risk: '⚠️',
  achievement: '🏆',
};

const momentColors: Record<KeyMomentType['momentType'], string> = {
  milestone: 'bg-[#0d1e3d] border-blue-700',
  decision: 'bg-[#1a0d3d] border-purple-300',
  risk: 'bg-[#1c0a0a] border-red-700',
  achievement: 'bg-[#022c22] border-green-700',
};

const importanceColors: Record<KeyMomentType['importance'], string> = {
  low: 'text-[#9EA8B4]',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  critical: 'text-red-400',
};

export const KeyMoment: React.FC<KeyMomentProps> = ({ moment, onClick }) => {
  return (
    <div
      onClick={() => onClick?.(moment)}
      className={`
        border-2 rounded-lg p-4 mb-3 transition-all
        ${momentColors[moment.momentType]}
        ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{momentIcons[moment.momentType]}</span>
          <div>
            <h3 className="font-semibold text-[#E8E6E1]">{moment.title}</h3>
            <p className="text-xs text-[#6B7585]">
              {format(new Date(moment.date), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <span
          className={`
            px-2 py-1 rounded text-xs font-bold uppercase
            ${importanceColors[moment.importance]}
          `}
        >
          {moment.importance}
        </span>
      </div>

      {/* Description */}
      <p className="text-[#9EA8B4] text-sm">{moment.description}</p>

      {/* Metadata */}
      {moment.metadata && Object.keys(moment.metadata).length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1e2a3d]">
          <div className="flex flex-wrap gap-2">
            {Object.entries(moment.metadata).map(([key, value]) => (
              <span
                key={key}
                className="bg-[#0F1319] px-2 py-1 rounded text-xs text-[#9EA8B4]"
              >
                <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
