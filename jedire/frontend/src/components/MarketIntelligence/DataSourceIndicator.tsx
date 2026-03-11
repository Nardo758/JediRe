/**
 * Data Source Indicator Component
 * Shows data source attribution on hover
 * 
 * Design Principle #6.2: "Every number shows source on hover"
 * Format: "D-01 | Source: BLS + Municipal | Updated: Feb 15, 2026 | Confidence: HIGH"
 */

import React, { useState } from 'react';
import { OutputMetadata } from '../../types/marketIntelligence.types';

interface DataSourceIndicatorProps {
  metadata: OutputMetadata;
  light?: boolean; // Use light theme (for dark backgrounds)
}

const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({ metadata, light = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Format date to readable format
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get confidence color
  const getConfidenceColor = () => {
    switch (metadata.source.confidence) {
      case 'HIGH':
        return light ? 'text-green-200' : 'text-green-600';
      case 'MEDIUM':
        return light ? 'text-yellow-200' : 'text-yellow-600';
      case 'LOW':
        return light ? 'text-red-200' : 'text-red-600';
      default:
        return light ? 'text-gray-200' : 'text-gray-600';
    }
  };

  // Get cost indicator
  const getCostBadge = () => {
    if (metadata.source.cost === 'FREE') {
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          light ? 'bg-green-200 bg-opacity-30 text-green-100' : 'bg-green-100 text-green-800'
        }`}>
          FREE
        </span>
      );
    } else {
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          light ? 'bg-blue-200 bg-opacity-30 text-blue-100' : 'bg-blue-100 text-blue-800'
        }`}>
          PAID
        </span>
      );
    }
  };

  return (
    <div className="relative inline-block">
      {/* Indicator Icon */}
      <button
        className={`inline-flex items-center text-xs ${
          light ? 'text-white text-opacity-70 hover:text-opacity-100' : 'text-gray-500 hover:text-gray-700'
        } transition-colors`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-mono">{metadata.outputId}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-gray-900 text-white rounded-lg shadow-xl p-4 pointer-events-none">
          {/* Arrow */}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-gray-900"></div>

          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
            <div className="font-mono font-bold text-sm">{metadata.outputId}</div>
            {getCostBadge()}
          </div>

          {/* Source */}
          <div className="mb-2">
            <div className="text-xs text-gray-400 mb-1">Data Source:</div>
            <div className="font-medium">{metadata.source.name}</div>
          </div>

          {/* Updated */}
          <div className="mb-2">
            <div className="text-xs text-gray-400 mb-1">Last Updated:</div>
            <div className="font-medium">{formatDate(metadata.source.lastUpdated)}</div>
          </div>

          {/* Confidence */}
          <div className="mb-2">
            <div className="text-xs text-gray-400 mb-1">Confidence:</div>
            <div className={`font-bold ${getConfidenceColor()}`}>
              {metadata.source.confidence}
              {metadata.source.confidence === 'HIGH' && ' ✓'}
              {metadata.source.confidence === 'MEDIUM' && ' ~'}
              {metadata.source.confidence === 'LOW' && ' !'}
            </div>
          </div>

          {/* Computed From (if applicable) */}
          {metadata.computedFrom && metadata.computedFrom.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Computed From:</div>
              <div className="flex flex-wrap gap-1">
                {metadata.computedFrom.map((outputId, idx) => (
                  <span key={idx} className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">
                    {outputId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataSourceIndicator;
