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
  milestone: 'bg-blue-50 border-blue-300',
  decision: 'bg-purple-50 border-purple-300',
  risk: 'bg-red-50 border-red-300',
  achievement: 'bg-green-50 border-green-300',
};

const importanceColors: Record<KeyMomentType['importance'], string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
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
            <h3 className="font-semibold text-gray-900">{moment.title}</h3>
            <p className="text-xs text-gray-500">
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
      <p className="text-gray-700 text-sm">{moment.description}</p>

      {/* Metadata */}
      {moment.metadata && Object.keys(moment.metadata).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {Object.entries(moment.metadata).map(([key, value]) => (
              <span
                key={key}
                className="bg-white px-2 py-1 rounded text-xs text-gray-600"
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
