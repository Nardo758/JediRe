/**
 * Competition Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode (comps analysis, pricing position, market velocity)
 * - owned → Performance mode (competitive threats, market share, positioning changes)
 */

import React, { useState, useEffect } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';

// Type definitions (moved from mock data)
interface ComparableProperty {
  id: string;
  name: string;
  address: string;
  distance: number;
  units: number;
  yearBuilt: number;
  category: 'direct' | 'construction' | 'planned';
  avgRent: number;
  occupancy?: number;
  class: 'A' | 'B' | 'C';
  similarityScore: number;
  amenities: string[];
  pricePerUnit?: number;
  capRate?: number;
}

interface QuickStat {
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'number';
  icon: string;
  trend?: { direction: 'up' | 'down' | 'stable'; value: string };
  subtext?: string;
}

interface MarketPositioning {
  label: string;
  value: number;
  percentile: number;
  color: 'green' | 'yellow' | 'red';
}

interface CompetitiveThreat {
  id: string;
  property: string;
  threatLevel: 'high' | 'medium' | 'low';
  reason: string;
  impact: string;
  distance: number;
}

interface RankedProperty {
  id: string;
  name: string;
  address: string;
  distance: number;
  units: number;
  yearBuilt: number;
  class: string;
  avgRent: number;
  avgSf: number;
  rentPerSf: number;
  occupancy: number | null;
  isSubject: boolean;
  rank: number;
  programUpdatedAt?: string;
}

interface RankingSummary {
  totalProperties: number;
  marketAvgRent: number;
  hasProgram: boolean;
  subjectRank?: number;
  rentDelta?: number;
  rentPremiumPct?: number;
  percentile?: number;
  subjectAvgRent?: number;
  subjectAvgSf?: number;
  subjectRentPerSf?: number;
}

interface RankingResponse {
  rankings: RankedProperty[];
  summary: RankingSummary;
}

interface CompetitionSectionProps {
  deal: Deal;
}

export const CompetitionSection: React.FC<CompetitionSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [sortBy, setSortBy] = useState<'distance' | 'similarity' | 'rent'>('distance');
  const [filterClass, setFilterClass] = useState<'all' | 'A' | 'B' | 'C'>('all');
  
  // API state
  const [comparables, setComparables] = useState<ComparableProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Competitive Ranking state
  const [rankingData, setRankingData] = useState<RankingResponse | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState(false);

  // Fetch competition data from API
  useEffect(() => {
    const fetchCompetitionData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/v1/deals/${deal.id}/competitors?distanceRadius=3`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch competition data');
        }
        
        const data = await response.json();
        
        // Transform API response to match component interface
        const transformedComparables: ComparableProperty[] = (data.competitors || []).map((comp: any) => ({
          id: comp.id,
          name: comp.name,
          address: comp.address,
          distance: parseFloat(comp.distance),
          units: comp.units,
          yearBuilt: comp.yearBuilt,
          category: comp.category || 'direct',
          avgRent: comp.avgRent || 0,
          occupancy: comp.occupancy,
          class: comp.class || 'B',
          similarityScore: Math.floor(Math.random() * 20) + 80, // TODO: Add similarity calculation to backend
          amenities: ['Pool', 'Gym', 'Parking'], // TODO: Add amenities data to backend
          pricePerUnit: comp.pricePerUnit,
          capRate: comp.capRate
        }));
        
        setComparables(transformedComparables);
      } catch (err) {
        console.error('Error fetching competition data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load competition data');
        setComparables([]);
      } finally {
        setLoading(false);
      }
    };

    if (deal.id) {
      fetchCompetitionData();
    }
  }, [deal.id]);

  useEffect(() => {
    const fetchRankingData = async () => {
      setRankingLoading(true);
      setRankingError(false);
      try {
        const response = await fetch(`/api/v1/deals/${deal.id}/competitive-ranking`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setRankingData(data);
          }
        } else {
          setRankingError(true);
        }
      } catch (err) {
        console.error('Error fetching competitive ranking:', err);
        setRankingError(true);
      } finally {
        setRankingLoading(false);
      }
    };

    if (deal.id) {
      fetchRankingData();
    }
  }, [deal.id]);

  // Calculate stats from actual data
  const stats: QuickStat[] = React.useMemo(() => {
    const directComps = comparables.filter(c => c.category === 'direct');
    const avgRent = directComps.length > 0 
      ? Math.round(directComps.reduce((sum, c) => sum + c.avgRent, 0) / directComps.length)
      : 0;
    const avgOccupancy = directComps.length > 0
      ? Math.round(directComps.reduce((sum, c) => sum + (c.occupancy || 0), 0) / directComps.length)
      : 0;

    return [
      { label: 'Comparables', value: comparables.length, format: 'number', icon: '🏢' },
      { label: 'Avg Rent', value: avgRent, format: 'currency', icon: '💰' },
      { label: 'Avg Occupancy', value: avgOccupancy, format: 'percentage', icon: '📊' },
      { label: 'Direct Comps', value: directComps.length, format: 'number', icon: '🎯' },
      { label: 'Market Position', value: 'Strong', format: 'number', icon: '⭐' }
    ];
  }, [comparables]);

  // Mock positioning data (TODO: calculate from real data)
  const positioning: MarketPositioning[] = [
    { label: 'Rent Premium', value: 75, percentile: 75, color: 'green' },
    { label: 'Occupancy', value: 85, percentile: 85, color: 'green' },
    { label: 'Market Share', value: 60, percentile: 60, color: 'yellow' }
  ];

  // Mock threats data (TODO: fetch from API)
  const competitiveThreats: CompetitiveThreat[] = [];
  const marketShareData: any[] = [];

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

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading competition data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-2">⚠️ Error loading competition data</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

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

      {/* Competitive Ranking — Program vs. Competition */}
      <CompetitiveRankingCard
        data={rankingData}
        loading={rankingLoading}
        error={rankingError}
      />

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

interface CompetitiveRankingCardProps {
  data: RankingResponse | null;
  loading: boolean;
  error?: boolean;
}

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CompetitiveRankingCard: React.FC<CompetitiveRankingCardProps> = ({ data, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-stone-200 rounded w-48"></div>
          <div className="h-32 bg-stone-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="text-center py-4">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="text-sm font-semibold text-stone-900 mb-1">Unable to load ranking</h3>
          <p className="text-xs text-stone-500">Could not retrieve competitive ranking data. Try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (!data || !data.summary.hasProgram) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-6 hover:border-stone-300 transition-colors">
        <div className="text-center py-6">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-sm font-semibold text-stone-900 mb-1">Program vs. Competition</h3>
          <p className="text-xs text-stone-500 mb-4 max-w-md mx-auto">
            Set up your Unit Mix Program to see how your property would rank against nearby competition on rent, size, and value.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-600 rounded text-xs font-medium">
            Go to Unit Mix Intelligence to create your Program
          </div>
        </div>
      </div>
    );
  }

  const { rankings, summary } = data;
  const premiumColor = (summary.rentPremiumPct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600';
  const premiumSign = (summary.rentPremiumPct || 0) >= 0 ? '+' : '';

  return (
    <div className="bg-white rounded-lg border border-stone-200 p-6 hover:border-stone-300 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Your Program vs. Competition</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Ranked by weighted average rent across {summary.totalProperties} propert{summary.totalProperties === 1 ? 'y' : 'ies'}
            {(() => {
              const subject = rankings.find(r => r.isSubject);
              return subject?.programUpdatedAt
                ? <span className="ml-1.5 text-stone-400">· Program saved {formatRelativeTime(subject.programUpdatedAt)}</span>
                : null;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary.subjectRank && summary.totalProperties > 1 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider uppercase">Rank</div>
              <div className="text-xl font-bold text-stone-900">
                #{summary.subjectRank}
                <span className="text-xs font-normal text-stone-400 ml-0.5">/ {summary.totalProperties}</span>
              </div>
            </div>
          )}
          {summary.percentile !== undefined && summary.totalProperties > 1 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider uppercase">Percentile</div>
              <div className="text-xl font-bold text-stone-900">{summary.percentile}th</div>
            </div>
          )}
          {summary.rentPremiumPct !== undefined && summary.marketAvgRent > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider uppercase">vs Market</div>
              <div className={`text-xl font-bold ${premiumColor}`}>
                {premiumSign}{summary.rentPremiumPct}%
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 pr-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase w-10">#</th>
              <th className="text-left py-2 pr-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Property</th>
              <th className="text-right py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Units</th>
              <th className="text-right py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Avg Rent</th>
              <th className="text-right py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Avg SF</th>
              <th className="text-right py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Rent/SF</th>
              <th className="text-right py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Class</th>
              <th className="text-right py-2 pl-3 text-[10px] font-mono text-stone-400 tracking-wider uppercase">Dist</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-stone-100 last:border-0 transition-colors ${
                  entry.isSubject
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                    : 'hover:bg-stone-50'
                }`}
              >
                <td className="py-2.5 pr-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    entry.isSubject
                      ? 'bg-blue-600 text-white'
                      : entry.rank <= 3
                        ? 'bg-stone-200 text-stone-700'
                        : 'text-stone-400'
                  }`}>
                    {entry.rank}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className={`font-medium ${entry.isSubject ? 'text-blue-900' : 'text-stone-900'}`}>
                        {entry.isSubject ? (
                          <span className="flex items-center gap-1.5">
                            {entry.name}
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded tracking-wide uppercase">
                              Your Program
                            </span>
                          </span>
                        ) : (
                          <span className="truncate block max-w-[200px]">{entry.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={`py-2.5 px-3 text-right font-medium ${entry.isSubject ? 'text-blue-900' : 'text-stone-700'}`}>
                  {entry.units?.toLocaleString() || '—'}
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold ${entry.isSubject ? 'text-blue-900' : 'text-stone-900'}`}>
                  ${entry.avgRent?.toLocaleString() || '—'}
                </td>
                <td className={`py-2.5 px-3 text-right ${entry.isSubject ? 'text-blue-800' : 'text-stone-600'}`}>
                  {entry.avgSf?.toLocaleString() || '—'}
                </td>
                <td className={`py-2.5 px-3 text-right ${entry.isSubject ? 'text-blue-800' : 'text-stone-600'}`}>
                  ${entry.rentPerSf?.toFixed(2) || '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    entry.class === 'A' ? 'bg-emerald-100 text-emerald-700' :
                    entry.class === 'B' ? 'bg-blue-100 text-blue-700' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {entry.class}
                  </span>
                </td>
                <td className={`py-2.5 pl-3 text-right ${entry.isSubject ? 'text-blue-800' : 'text-stone-500'}`}>
                  {entry.isSubject ? '—' : (entry.distance != null ? `${entry.distance} mi` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-stone-200 flex items-center gap-6 text-xs">
        {summary.subjectAvgRent && (
          <div>
            <span className="text-stone-400 font-mono tracking-wider uppercase">Your Rent</span>
            <span className="ml-2 font-semibold text-stone-700">${summary.subjectAvgRent.toLocaleString()}/mo</span>
          </div>
        )}
        {summary.subjectRentPerSf && (
          <div>
            <span className="text-stone-400 font-mono tracking-wider uppercase">Your $/SF</span>
            <span className="ml-2 font-semibold text-stone-700">${summary.subjectRentPerSf.toFixed(2)}</span>
          </div>
        )}
        {summary.marketAvgRent > 0 && (
          <div>
            <span className="text-stone-400 font-mono tracking-wider uppercase">Market Avg</span>
            <span className="ml-2 font-semibold text-stone-700">${summary.marketAvgRent.toLocaleString()}/mo</span>
          </div>
        )}
        {summary.rentDelta !== undefined && summary.marketAvgRent > 0 && (
          <div>
            <span className="text-stone-400 font-mono tracking-wider uppercase">Delta</span>
            <span className={`ml-2 font-semibold ${premiumColor}`}>
              {premiumSign}${Math.abs(summary.rentDelta).toLocaleString()}
            </span>
          </div>
        )}
        {summary.totalProperties <= 1 && (
          <div className="ml-auto text-stone-400 italic">
            Add comps in Unit Mix Intelligence to see rankings
          </div>
        )}
      </div>
    </div>
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
