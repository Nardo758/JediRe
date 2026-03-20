/**
 * PlaceholderContent Component
 * Reusable placeholder for sections that are to be built
 */

import React from 'react';
import { PlaceholderContentProps } from '../../types/deal-enhanced.types';

export const PlaceholderContent: React.FC<PlaceholderContentProps> = ({
  title,
  description,
  status = 'to-be-built',
  icon = '🚧',
  wireframe,
  children
}) => {
  const statusStyles = {
    'to-be-built': {
      bg: 'bg-[#0F1319]',
      border: 'border-[#1e2a3d]',
      badge: 'bg-[#131920] text-[#9EA8B4]',
      badgeText: 'To Be Built'
    },
    'in-progress': {
      bg: 'bg-[#0d1e3d]',
      border: 'border-blue-900/50',
      badge: 'bg-[#0d1e3d] text-blue-400',
      badgeText: 'In Progress'
    },
    'complete': {
      bg: 'bg-[#022c22]',
      border: 'border-green-800/50',
      badge: 'bg-[#022c22] text-green-400',
      badgeText: 'Complete'
    },
    'coming-soon': {
      bg: 'bg-[#1a0d3d]',
      border: 'border-purple-800/50',
      badge: 'bg-[#1a0d3d] text-purple-400',
      badgeText: 'Coming Soon'
    }
  };

  const style = statusStyles[status];

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-6`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-[#E8E6E1]">{title}</h3>
            <p className="text-sm text-[#9EA8B4] mt-1">{description}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.badge}`}>
          {style.badgeText}
        </span>
      </div>

      {/* Wireframe / Preview */}
      {wireframe && (
        <div className="mb-4 p-4 bg-[#0F1319] border border-[#1e2a3d] rounded font-mono text-xs text-[#9EA8B4] whitespace-pre">
          {wireframe}
        </div>
      )}

      {/* Custom Content */}
      {children && (
        <div className="mt-4 pt-4 border-t border-[#1e2a3d]">
          {children}
        </div>
      )}

      {/* Default Message */}
      {!children && !wireframe && (
        <div className="text-center py-8">
          <div className="text-gray-400 text-sm">
            This section will be built in a future phase
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceholderContent;
