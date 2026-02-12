/**
 * JEDI Score Breakdown Component
 * 
 * Displays JEDI Score with pie chart showing signal weight breakdown
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, RefreshCw } from 'lucide-react';

interface JEDIScoreData {
  totalScore: number;
  demandScore: number;
  supplyScore: number;
  momentumScore: number;
  positionScore: number;
  riskScore: number;
  demandContribution: number;
  supplyContribution: number;
  momentumContribution: number;
  positionContribution: number;
  riskContribution: number;
  createdAt: string;
  scoreDelta?: number;
}

interface Trend {
  direction: 'up' | 'down' | 'flat';
  change: number;
  dataPoints: number;
}

interface JEDIScoreBreakdownProps {
  dealId: string;
  compact?: boolean;
}

export const JEDIScoreBreakdown: React.FC<JEDIScoreBreakdownProps> = ({ 
  dealId,
  compact = false 
}) => {
  const [score, setScore] = useState<JEDIScoreData | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  useEffect(() => {
    fetchScore();
  }, [dealId]);

  const fetchScore = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/v1/jedi/score/${dealId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setScore(data.data.score);
        setTrend(data.data.trend);
      }
    } catch (error) {
      console.error('Error fetching JEDI Score:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/v1/jedi/score/${dealId}/recalculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setScore(data.data);
        // Refresh to get new trend
        setTimeout(fetchScore, 500);
      }
    } catch (error) {
      console.error('Error recalculating JEDI Score:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 70) return 'from-green-500 to-green-600';
    if (score >= 50) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
  };

  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-4 h-4 text-gray-400" />;
    if (trend.direction === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend.direction === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const signals = score ? [
    {
      name: 'Demand',
      score: score.demandScore,
      contribution: score.demandContribution,
      weight: 0.30,
      color: 'bg-blue-500',
      description: 'Employment events, population growth, economic indicators',
    },
    {
      name: 'Supply',
      score: score.supplyScore,
      contribution: score.supplyContribution,
      weight: 0.25,
      color: 'bg-purple-500',
      description: 'Pipeline units, absorption rates, vacancy trends',
    },
    {
      name: 'Momentum',
      score: score.momentumScore,
      contribution: score.momentumContribution,
      weight: 0.20,
      color: 'bg-indigo-500',
      description: 'Rent growth, transaction velocity, market sentiment',
    },
    {
      name: 'Position',
      score: score.positionScore,
      contribution: score.positionContribution,
      weight: 0.15,
      color: 'bg-teal-500',
      description: 'Submarket strength, proximity to amenities, competitive position',
    },
    {
      name: 'Risk',
      score: score.riskScore,
      contribution: score.riskContribution,
      weight: 0.10,
      color: 'bg-orange-500',
      description: 'Market volatility, political/regulatory risk, concentration risk',
    },
  ] : [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-32 bg-gray-100 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
        <p>No JEDI Score available</p>
        <button
          onClick={handleRecalculate}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Calculate Score
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">JEDI Score</p>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${getScoreColor(score.totalScore)}`}>
                {score.totalScore.toFixed(1)}
              </span>
              {trend && (
                <div className="flex items-center gap-1">
                  {getTrendIcon()}
                  <span className={`text-sm ${
                    trend.direction === 'up' ? 'text-green-600' : 
                    trend.direction === 'down' ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {Math.abs(trend.change).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Recalculate"
          >
            <RefreshCw className={`w-5 h-5 ${recalculating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">JEDI Score</h3>
          <p className="text-sm text-gray-500">
            Last updated: {new Date(score.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      {/* Score Display */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <span className={`text-5xl font-bold ${getScoreColor(score.totalScore)}`}>
            {score.totalScore.toFixed(1)}
          </span>
          {trend && (
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                <span className={`text-lg font-semibold ${
                  trend.direction === 'up' ? 'text-green-600' : 
                  trend.direction === 'down' ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
                  {Math.abs(trend.change).toFixed(1)}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                30-day trend
              </span>
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getScoreGradient(score.totalScore)} transition-all duration-500`}
            style={{ width: `${score.totalScore}%` }}
          />
        </div>
      </div>

      {/* Signal Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">Signal Breakdown</h4>
          <button
            onMouseEnter={() => setShowTooltip('info')}
            onMouseLeave={() => setShowTooltip(null)}
            className="relative text-gray-400 hover:text-gray-600"
          >
            <Info className="w-4 h-4" />
            {showTooltip === 'info' && (
              <div className="absolute right-0 top-6 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                Weighted combination of 5 market signals. Higher scores indicate stronger investment potential.
              </div>
            )}
          </button>
        </div>

        {signals.map(signal => (
          <div
            key={signal.name}
            className="relative"
            onMouseEnter={() => setShowTooltip(signal.name)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${signal.color}`} />
                <span className="text-sm font-medium text-gray-700">{signal.name}</span>
                <span className="text-xs text-gray-500">({(signal.weight * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {signal.score.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                  {signal.contribution.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${signal.color} transition-all duration-500`}
                style={{ width: `${signal.score}%` }}
              />
            </div>

            {/* Tooltip */}
            {showTooltip === signal.name && (
              <div className="absolute left-0 top-full mt-1 w-full p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                {signal.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <span className="text-green-600 font-semibold">70-100:</span> Strong
          </div>
          <div>
            <span className="text-yellow-600 font-semibold">50-69:</span> Moderate
          </div>
          <div>
            <span className="text-red-600 font-semibold">0-49:</span> Weak
          </div>
        </div>
      </div>
    </div>
  );
};

export default JEDIScoreBreakdown;
