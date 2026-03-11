/**
 * DigitalTrafficCard Component
 * 
 * Displays digital traffic metrics and engagement score for a property.
 * Shows:
 * - Digital traffic score (0-100)
 * - Weekly views and saves
 * - Trending indicator
 * - Institutional interest flag
 */

import React, { useEffect, useState } from 'react';
import { getDigitalScore, DigitalTrafficScore } from '../../services/eventTrackingService';
import { TrendingUp, Eye, Bookmark, Building2, Sparkles } from 'lucide-react';

interface DigitalTrafficCardProps {
  propertyId: string;
  className?: string;
  compact?: boolean;
}

export const DigitalTrafficCard: React.FC<DigitalTrafficCardProps> = ({
  propertyId,
  className = '',
  compact = false,
}) => {
  const [score, setScore] = useState<DigitalTrafficScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchScore = async () => {
      setLoading(true);
      setError(false);
      
      const data = await getDigitalScore(propertyId);
      
      if (data) {
        setScore(data);
      } else {
        setError(true);
      }
      
      setLoading(false);
    };

    fetchScore();
  }, [propertyId]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error || !score) {
    return null; // Fail silently - tracking is non-essential
  }

  const getScoreColor = (value: number): string => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-blue-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getScoreLabel = (value: number): string => {
    if (value >= 80) return 'Hot';
    if (value >= 60) return 'Active';
    if (value >= 40) return 'Moderate';
    return 'Low';
  };

  const isTrending = score.trending_velocity > 2.0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`flex items-center gap-1 ${getScoreColor(score.score)}`}>
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold text-sm">{score.score}</span>
        </div>
        {isTrending && (
          <div className="flex items-center gap-1 text-orange-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Trending</span>
          </div>
        )}
        {score.institutional_interest_flag && (
          <div className="flex items-center gap-1 text-purple-600">
            <Building2 className="w-4 h-4" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Digital Traffic</h3>
        <Sparkles className="w-5 h-5 text-purple-500" />
      </div>

      {/* Score */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-3xl font-bold ${getScoreColor(score.score)}`}>
            {score.score}
          </span>
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
        <div className="text-sm text-gray-600">{getScoreLabel(score.score)} Activity</div>
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Eye className="w-4 h-4" />
            <span>Weekly Views</span>
          </div>
          <span className="font-semibold text-gray-900">{score.weekly_views}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Bookmark className="w-4 h-4" />
            <span>Weekly Saves</span>
          </div>
          <span className="font-semibold text-gray-900">{score.weekly_saves}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {isTrending && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>Trending</span>
          </div>
        )}

        {score.institutional_interest_flag && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
            <Building2 className="w-3 h-3" />
            <span>Institutional Interest</span>
          </div>
        )}

        {score.unique_users_7d > 10 && (
          <div className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            <span>{score.unique_users_7d} unique viewers</span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Updated {new Date(score.calculated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default DigitalTrafficCard;
