/**
 * Competition Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode (comps analysis, pricing position, market velocity)
 * - owned → Performance mode (competitive threats, market share, positioning changes)
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionComparables,
  performanceComparables,
  acquisitionStats,
  performanceStats,
  acquisitionPositioning,
  performancePositioning,
  competitiveThreats,
  marketShareData,
  ComparableProperty,
  QuickStat,
  MarketPositioning,
  CompetitiveThreat
} from '../../../data/competitionMockData';

interface CompetitionSectionProps {
  deal: Deal;
}

export const CompetitionSection: React.FC<CompetitionSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [sortBy, setSortBy] = useState<'distance' | 'similarity' | 'rent'>('distance');
  const [filterClass, setFilterClass] = useState<'all' | 'A' | 'B' | 'C'>('all');

  // Select data based on mode
  const comparables = isPipeline ? acquisitionComparables : performanceComparables;
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const positioning = isPipeline ? acquisitionPositioning : performancePositioning;

  // Filter and sort comparables
  const filteredComparables = comparables
    .filter(comp => filterClass === 'all' || comp.class === filterClass)
    .sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return a.distance - b.distance;
        case 'similarity':
          return b.similarityScore - a.similarityScore;
        case 'rent':
          return b.avgRent - a.avgRent;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '🎯 Acquisition Mode' : '🏆 Performance Mode'}
          </div>
          <span className="text-sm text-gray-600">
            {isPipeline ? 'Market & Comparable Analysis' : 'Competitive Position & Threats'}
          </span>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <QuickStatsGrid stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Comparable Properties */}
        <div className="lg:col-span-2 space-y-4">
          <ComparablesHeader
            sortBy={sortBy}
            setSortBy={setSortBy}
            filterClass={filterClass}
            setFilterClass={setFilterClass}
            count={filteredComparables.length}
          />
          <ComparablesList comparables={filteredComparables} mode={mode} />
        </div>

        {/* Right Column: Map & Positioning */}
        <div className="space-y-4">
          <CompetitionMapCard deal={deal} comparables={filteredComparables} />
          <MarketPositioningCard positioning={positioning} mode={mode} />
          {isOwned && <CompetitiveThreatsCard threats={competitiveThreats} />}
        </div>
      </div>

      {/* Bottom Row: Market Share (Performance Mode Only) */}
      {isOwned && (
        <MarketShareCard data={marketShareData} />
      )}

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: QuickStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: QuickStat): string => {
    switch (stat.format) {
      case 'currency':
        return `$${Number(stat.value).toLocaleString()}`;
      case 'percentage':
        return `${stat.value}%`;
      case 'number':
        return String(stat.value);
      default:
        return String(stat.value);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            {stat.trend && (
              <span className={`text-xs font-medium ${
                stat.trend.direction === 'up' ? 'text-green-600' :
                stat.trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stat.trend.value}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(stat)}
          </div>
          <div className="text-sm text-gray-600">{stat.label}</div>
          {stat.subtext && (
            <div className="text-xs text-gray-500 mt-1">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
};

interface ComparablesHeaderProps {
  sortBy: 'distance' | 'similarity' | 'rent';
  setSortBy: (sort: 'distance' | 'similarity' | 'rent') => void;
  filterClass: 'all' | 'A' | 'B' | 'C';
  setFilterClass: (filter: 'all' | 'A' | 'B' | 'C') => void;
  count: number;
}

const ComparablesHeader: React.FC<ComparablesHeaderProps> = ({
  sortBy,
  setSortBy,
  filterClass,
  setFilterClass,
  count
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Comparable Properties</h3>
          <p className="text-sm text-gray-600">{count} properties found</p>
        </div>
        <div className="flex gap-2">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="distance">Sort by Distance</option>
            <option value="similarity">Sort by Similarity</option>
            <option value="rent">Sort by Rent</option>
          </select>

          {/* Filter Dropdown */}
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Classes</option>
            <option value="A">Class A</option>
            <option value="B">Class B</option>
            <option value="C">Class C</option>
          </select>
        </div>
      </div>
    </div>
  );
};

interface ComparablesListProps {
  comparables: ComparableProperty[];
  mode: 'acquisition' | 'performance';
}

const ComparablesList: React.FC<ComparablesListProps> = ({ comparables, mode }) => {
  return (
    <div className="space-y-3">
      {comparables.map((comp) => (
        <CompCard key={comp.id} comp={comp} mode={mode} />
      ))}
    </div>
  );
};

interface CompCardProps {
  comp: ComparableProperty;
  mode: 'acquisition' | 'performance';
}

const CompCard: React.FC<CompCardProps> = ({ comp, mode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Photo Placeholder */}
        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {comp.name.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-gray-900">{comp.name}</h4>
              <p className="text-sm text-gray-600">{comp.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                comp.class === 'A' ? 'bg-green-100 text-green-700' :
                comp.class === 'B' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                Class {comp.class}
              </span>
              <SimilarityBadge score={comp.similarityScore} />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <MetricItem label="Distance" value={`${comp.distance} mi`} />
            <MetricItem label="Units" value={comp.units.toString()} />
            <MetricItem label="Year" value={comp.yearBuilt.toString()} />
            <MetricItem label="Avg Rent" value={`$${comp.avgRent.toLocaleString()}`} />
          </div>

          {/* Mode-Specific Metrics */}
          {mode === 'acquisition' ? (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricItem 
                label="Price/Unit" 
                value={`$${comp.pricePerUnit?.toLocaleString()}`} 
                highlight 
              />
              <MetricItem 
                label="Cap Rate" 
                value={`${comp.capRate}%`} 
                highlight 
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricItem 
                label="Occupancy" 
                value={`${comp.occupancy}%`} 
                highlight 
              />
              <MetricItem 
                label="Market Position" 
                value={comp.occupancy! > 95 ? 'Strong' : 'Average'} 
                highlight 
              />
            </div>
          )}

          {/* Amenities */}
          <div className="flex flex-wrap gap-1">
            {comp.amenities.slice(0, 4).map((amenity, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {amenity}
              </span>
            ))}
            {comp.amenities.length > 4 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                +{comp.amenities.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricItemProps {
  label: string;
  value: string;
  highlight?: boolean;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, highlight }) => {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
};

interface SimilarityBadgeProps {
  score: number;
}

const SimilarityBadge: React.FC<SimilarityBadgeProps> = ({ score }) => {
  const color = score >= 85 ? 'green' : score >= 75 ? 'blue' : 'gray';
  
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      color === 'green' ? 'bg-green-100 text-green-700' :
      color === 'blue' ? 'bg-blue-100 text-blue-700' :
      'bg-gray-100 text-gray-700'
    }`}>
      <span>🎯</span>
      <span>{score}%</span>
    </div>
  );
};

interface CompetitionMapCardProps {
  deal: Deal;
  comparables: ComparableProperty[];
}

const CompetitionMapCard: React.FC<CompetitionMapCardProps> = ({ deal, comparables }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Competition Map</h3>
      <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg aspect-square flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <div className="text-sm">Interactive Map View</div>
          <div className="text-xs mt-1">{comparables.length} comparables within radius</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-600">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Subject Property</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Comparable Properties</span>
        </div>
      </div>
    </div>
  );
};

interface MarketPositioningCardProps {
  positioning: MarketPositioning[];
  mode: 'acquisition' | 'performance';
}

const MarketPositioningCard: React.FC<MarketPositioningCardProps> = ({ positioning, mode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">
        {mode === 'acquisition' ? 'Market Position' : 'Competitive Ranking'}
      </h3>
      <div className="space-y-3">
        {positioning.map((item, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700">{item.label}</span>
              <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  item.color === 'green' ? 'bg-green-500' :
                  item.color === 'yellow' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${item.value}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {item.percentile}th percentile
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CompetitiveThreatsCardProps {
  threats: CompetitiveThreat[];
}

const CompetitiveThreatsCard: React.FC<CompetitiveThreatsCardProps> = ({ threats }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Competitive Threats</h3>
      <div className="space-y-3">
        {threats.map((threat) => (
          <div key={threat.id} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
            <div className="flex items-start justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">{threat.property}</span>
              <ThreatBadge level={threat.threatLevel} />
            </div>
            <p className="text-xs text-gray-600 mb-1">{threat.reason}</p>
            <p className="text-xs text-gray-500">Impact: {threat.impact}</p>
            <p className="text-xs text-gray-400 mt-1">{threat.distance} mi away</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ThreatBadgeProps {
  level: 'high' | 'medium' | 'low';
}

const ThreatBadge: React.FC<ThreatBadgeProps> = ({ level }) => {
  const colors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700'
  };

  const icons = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level]}`}>
      {icons[level]} {level.toUpperCase()}
    </span>
  );
};

interface MarketShareCardProps {
  data: Array<{
    property: string;
    units: number;
    share: number;
    occupancy: number;
  }>;
}

const MarketShareCard: React.FC<MarketShareCardProps> = ({ data }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Market Share Analysis</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Placeholder */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-2">📊</div>
            <div className="text-sm font-medium text-gray-700">Market Share Distribution</div>
            <div className="text-xs text-gray-500 mt-1">Total: 3,050 units in submarket</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="space-y-2">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{item.property}</div>
                <div className="text-xs text-gray-500">{item.units} units</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{item.share}%</div>
                <div className="text-xs text-gray-500">{item.occupancy}% occ</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
