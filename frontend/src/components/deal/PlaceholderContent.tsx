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
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      badge: 'bg-gray-100 text-gray-700',
      badgeText: 'To Be Built'
    },
    'in-progress': {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      badgeText: 'In Progress'
    },
    'complete': {
      bg: 'bg-green-50',
      border: 'border-green-200',
      badge: 'bg-green-100 text-green-700',
      badgeText: 'Complete'
    },
    'coming-soon': {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-700',
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
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.badge}`}>
          {style.badgeText}
        </span>
      </div>

      {/* Wireframe / Preview */}
      {wireframe && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded font-mono text-xs text-gray-600 whitespace-pre">
          {wireframe}
        </div>
      )}

      {/* Custom Content */}
      {children && (
        <div className="mt-4 pt-4 border-t border-gray-200">
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
