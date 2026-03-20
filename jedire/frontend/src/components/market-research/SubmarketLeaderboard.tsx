/**
 * Submarket Leaderboard - Rank submarkets by performance metrics
 * Shows top performers with key metrics and composite scores
 */

import React, { useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface SubmarketPerformance {
  id: string;
  name: string;
  propertyCount: number;
  metrics: {
    rentGrowth: number; // % YoY
    vacancyRate: number; // %
    demandScore: number; // 0-100
    supplyPipeline: number; // % of existing
  };
  compositeScore: number; // 0-100
  rank: number;
}

interface SubmarketLeaderboardProps {
  city: string;
  submarkets: SubmarketPerformance[];
  selectedSubmarket: string;
  onSubmarketChange: (submarketId: string) => void;
}

export function SubmarketLeaderboard({ 
  city, 
  submarkets, 
  selectedSubmarket, 
  onSubmarketChange 
}: SubmarketLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'rank' | 'rentGrowth' | 'vacancy' | 'demand'>('rank');

  // Sort submarkets based on selected metric
  const sortedSubmarkets = [...submarkets].sort((a, b) => {
    switch (sortBy) {
      case 'rentGrowth':
        return b.metrics.rentGrowth - a.metrics.rentGrowth;
      case 'vacancy':
        return a.metrics.vacancyRate - b.metrics.vacancyRate; // Lower is better
      case 'demand':
        return b.metrics.demandScore - a.metrics.demandScore;
      default:
        return a.rank - b.rank; // Composite score ranking
    }
  });

  const topPerformers = sortedSubmarkets.slice(0, 3);
  const allSubmarkets = expanded ? sortedSubmarkets : topPerformers;

  const getRankBadge = (rank: number) => {
    const badges = {
      1: { emoji: '🥇', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
      2: { emoji: '🥈', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
      3: { emoji: '🥉', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    };
    
    const badge = badges[rank as 1 | 2 | 3];
    if (!badge) return null;

    return (
      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${badge.border} ${badge.bg}`}>
        <span className="text-lg">{badge.emoji}</span>
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMetricIcon = (value: number, higherIsBetter: boolean = true) => {
    const isGood = higherIsBetter ? value > 0 : value < 0;
    if (Math.abs(value) < 0.1) return <Minus className="w-4 h-4 text-gray-400" />;
    return isGood ? 
      <TrendingUp className="w-4 h-4 text-green-600" /> : 
      <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Top Performing Submarkets</h3>
            <span className="text-sm text-gray-500">• {city}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="rank">Composite Score</option>
              <option value="rentGrowth">Rent Growth</option>
              <option value="vacancy">Vacancy Rate</option>
              <option value="demand">Demand Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* All Submarkets Option */}
      <button
        onClick={() => onSubmarketChange('all')}
        className={`w-full px-4 py-3 flex items-center justify-between border-b border-gray-200 transition-colors ${
          selectedSubmarket === 'all'
            ? 'bg-blue-50 border-l-4 border-l-blue-600'
            : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-full">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">All {city}</div>
            <div className="text-sm text-gray-500">
              {submarkets.length} submarkets • {submarkets.reduce((sum, s) => sum + s.propertyCount, 0)} properties
            </div>
          </div>
        </div>
        {selectedSubmarket === 'all' && (
          <div className="text-sm font-medium text-blue-600">Selected ✓</div>
        )}
      </button>

      {/* Submarket Cards */}
      <div className="divide-y divide-gray-200">
        {allSubmarkets.map((submarket) => (
          <button
            key={submarket.id}
            onClick={() => onSubmarketChange(submarket.id)}
            className={`w-full px-4 py-4 text-left transition-colors ${
              selectedSubmarket === submarket.id
                ? 'bg-blue-50 border-l-4 border-l-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Rank Badge */}
              {getRankBadge(submarket.rank)}

              {/* Submarket Info */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{submarket.name}</div>
                    <div className="text-sm text-gray-500">
                      {submarket.propertyCount} properties
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(submarket.compositeScore)}`}>
                      {submarket.compositeScore}
                    </div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {/* Rent Growth */}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 mb-1">
                      {getMetricIcon(submarket.metrics.rentGrowth, true)}
                      <span className="text-xs text-gray-600">Rent</span>
                    </div>
                    <div className={`text-sm font-semibold ${
                      submarket.metrics.rentGrowth >= 4 ? 'text-green-600' :
                      submarket.metrics.rentGrowth >= 2 ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {submarket.metrics.rentGrowth > 0 ? '+' : ''}{submarket.metrics.rentGrowth}%
                    </div>
                  </div>

                  {/* Vacancy Rate */}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 mb-1">
                      {getMetricIcon(-submarket.metrics.vacancyRate, false)}
                      <span className="text-xs text-gray-600">Vacancy</span>
                    </div>
                    <div className={`text-sm font-semibold ${
                      submarket.metrics.vacancyRate <= 5 ? 'text-green-600' :
                      submarket.metrics.vacancyRate <= 8 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {submarket.metrics.vacancyRate}%
                    </div>
                  </div>

                  {/* Demand Score */}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Demand</span>
                    </div>
                    <div className={`text-sm font-semibold ${getScoreColor(submarket.metrics.demandScore)}`}>
                      {submarket.metrics.demandScore}
                    </div>
                  </div>

                  {/* Supply Pipeline */}
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-600">Supply</span>
                    </div>
                    <div className={`text-sm font-semibold ${
                      submarket.metrics.supplyPipeline <= 30 ? 'text-green-600' :
                      submarket.metrics.supplyPipeline <= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {submarket.metrics.supplyPipeline}%
                    </div>
                  </div>
                </div>

                {/* Selected Indicator */}
                {selectedSubmarket === submarket.id && (
                  <div className="mt-3 text-sm font-medium text-blue-600">
                    ✓ Viewing this submarket
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expand/Collapse Toggle */}
      {submarkets.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-200"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Top 3 Only
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show All {submarkets.length} Submarkets
            </>
          )}
        </button>
      )}

      {/* Legend */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <strong>Composite Score:</strong> Weighted average of rent growth (30%), low vacancy (25%), demand signals (25%), supply balance (20%)
      </div>
    </div>
  );
}
