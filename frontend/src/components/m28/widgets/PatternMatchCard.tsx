/**
 * PatternMatchCard - Shows historical analog match
 * Usage: <PatternMatchCard limit={3} />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { PatternMatch } from '../../../types/m28.types';

interface PatternMatchCardProps {
  limit?: number;
}

const categoryEmoji: Record<string, string> = {
  recession: '📉',
  rate_shock: '💥',
  policy: '🏛️',
  external: '🌍',
};

export const PatternMatchCard: React.FC<PatternMatchCardProps> = ({ limit = 3 }) => {
  const [patterns, setPatterns] = useState<PatternMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const data = await m28Client.getPatternMatches(limit);
        setPatterns(data);
      } catch (err) {
        console.error('Error fetching pattern matches:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatterns();
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-gray-300 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔍</span>
        <h3 className="font-semibold text-sm text-gray-900">
          Historical Patterns
        </h3>
      </div>

      <div className="space-y-3">
        {patterns.map((pattern) => (
          <div
            key={pattern.id}
            className="bg-gray-50 border border-gray-200 rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {categoryEmoji[pattern.event_category] || '📅'}
                </span>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900">
                    {pattern.event_name}
                  </h4>
                  <p className="text-xs text-gray-500 capitalize">
                    {pattern.event_category.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">Similarity</div>
                <div className="text-lg font-bold text-blue-600">
                  {Math.round(pattern.similarity_score * 100)}%
                </div>
              </div>
            </div>

            {pattern.matching_indicators.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pattern.matching_indicators.slice(0, 3).map((indicator, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {indicator}
                  </span>
                ))}
                {pattern.matching_indicators.length > 3 && (
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{pattern.matching_indicators.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 text-center">
        Current conditions match historical patterns from these periods
      </div>
    </div>
  );
};
