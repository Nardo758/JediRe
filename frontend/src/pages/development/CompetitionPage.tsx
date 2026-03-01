import { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  Maximize2,
  Users,
  Home,
  DollarSign,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import DealCompAnalysisTab from '@/components/deal/sections/DealCompAnalysisTab';
import { competitionService, CompetitorProperty, AdvantageMatrix, WaitlistProperty, DataSource, F40RankingsData } from '@/services/competition.service';

interface CompetitionFilters {
  sameVintage: boolean;
  similarSize: boolean;
  sameClass: boolean;
  distanceRadius: number;
}

function DataSourceBadge({ source }: { source: DataSource }) {
  if (source === 'api') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        LIVE DATA
      </span>
    );
  }
  if (source === 'apartment') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        MARKET DATA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
      <AlertCircle className="h-3 w-3" />
      SAMPLE DATA
    </span>
  );
}

function SampleDataBanner() {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
      <div>
        <span className="font-semibold text-amber-800">[SAMPLE DATA]</span>
        <span className="text-amber-700 ml-2 text-sm">
          Live data is unavailable. Showing sample data for demonstration purposes. Connect a data source for real market intelligence.
        </span>
      </div>
    </div>
  );
}

export default function CompetitionPage() {
  const { dealId } = useParams<{ dealId: string }>();

  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState<CompetitorProperty[]>([]);
  const [advantageMatrix, setAdvantageMatrix] = useState<AdvantageMatrix | null>(null);
  const [waitlistProperties, setWaitlistProperties] = useState<WaitlistProperty[]>([]);
  const [agingCompetitors, setAgingCompetitors] = useState<CompetitorProperty[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [f40Rankings, setF40Rankings] = useState<F40RankingsData>({ rankings: [], marketGrade: 'N/A', trendDirection: 'stable' });

  const [dataSources, setDataSources] = useState<{
    competitors: DataSource;
    advantageMatrix: DataSource;
    waitlist: DataSource;
    aging: DataSource;
    insights: DataSource;
    f40: DataSource;
  }>({
    competitors: 'mock',
    advantageMatrix: 'mock',
    waitlist: 'mock',
    aging: 'mock',
    insights: 'mock',
    f40: 'mock',
  });

  const [filters, setFilters] = useState<CompetitionFilters>({
    sameVintage: false,
    similarSize: true,
    sameClass: true,
    distanceRadius: 1.0,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [urlParams] = useSearchParams();
  const initialTab = urlParams.get('subtab') === 'comp-analysis' ? 'comp-analysis' : 'map';
  const [activeTab, setActiveTab] = useState<'comp-analysis' | 'map' | 'comparison' | 'advantage' | 'aging' | 'waitlist' | 'f40'>(initialTab as any);

  useEffect(() => {
    if (dealId) {
      fetchCompetitionData();
    }
  }, [dealId, filters]);

  const fetchCompetitionData = async () => {
    setLoading(true);
    try {
      const [competitorsResult, advantageResult, waitlistResult, agingResult, insightsResult, f40Result] = await Promise.all([
        competitionService.getCompetitors(dealId!, filters),
        competitionService.getAdvantageMatrix(dealId!),
        competitionService.getWaitlistProperties(dealId!, filters.distanceRadius),
        competitionService.getAgingCompetitors(dealId!, filters.distanceRadius),
        competitionService.getAIInsights(dealId!),
        competitionService.getF40Rankings(),
      ]);

      const mergedCompetitors = competitionService.mergeF40IntoCompetitors(competitorsResult.data, f40Result.data.rankings);
      setCompetitors(mergedCompetitors);
      setAdvantageMatrix(advantageResult.data);
      setWaitlistProperties(waitlistResult.data);
      setAgingCompetitors(agingResult.data);
      setAiInsights(insightsResult.data);
      setF40Rankings(f40Result.data);

      setDataSources({
        competitors: competitorsResult.source,
        advantageMatrix: advantageResult.source,
        waitlist: waitlistResult.source,
        aging: agingResult.source,
        insights: insightsResult.source,
        f40: f40Result.source,
      });
    } catch (error) {
      console.error('Error fetching competition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof CompetitionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const primarySource: DataSource = Object.values(dataSources).every(s => s === 'mock')
    ? 'mock'
    : Object.values(dataSources).some(s => s === 'api')
    ? 'api'
    : 'apartment';

  const hasMockData = Object.values(dataSources).some(s => s === 'mock');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading competition analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  Competition Analysis
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Design Differentiation & Competitive Positioning
                </p>
              </div>
              <DataSourceBadge source={primarySource} />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {(filters.sameVintage || filters.similarSize || filters.sameClass) && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {[filters.sameVintage, filters.similarSize, filters.sameClass].filter(Boolean).length}
                  </span>
                )}
              </button>

              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameVintage}
                    onChange={(e) => handleFilterChange('sameVintage', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Same Vintage (±5 years)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.similarSize}
                    onChange={(e) => handleFilterChange('similarSize', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Similar Size (±20%)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameClass}
                    onChange={(e) => handleFilterChange('sameClass', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Same Class (A/B/C)</span>
                </label>

                <div>
                  <label className="text-sm text-gray-700 mb-1 block">
                    Distance Radius: {filters.distanceRadius} mi
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={filters.distanceRadius}
                    onChange={(e) => handleFilterChange('distanceRadius', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 border-b border-gray-200">
            {[
              { id: 'comp-analysis', label: 'Comp Analysis', icon: BarChart3 },
              { id: 'map', label: 'Competitive Set Map', icon: MapPin },
              { id: 'comparison', label: 'Unit Comparison', icon: Home },
              { id: 'f40', label: 'F40 Performance', icon: TrendingUp },
              { id: 'advantage', label: 'Advantage Matrix', icon: CheckCircle2 },
              { id: 'aging', label: 'Aging Competition', icon: Calendar },
              { id: 'waitlist', label: 'Waitlist Intelligence', icon: TrendingUp },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {hasMockData && <SampleDataBanner />}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold text-gray-900">{competitors.length}</div>
              <DataSourceBadge source={dataSources.competitors} />
            </div>
            <div className="text-sm text-gray-600">Direct Competitors</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold text-green-600">
                {advantageMatrix?.overallScore || 0}
              </div>
              <DataSourceBadge source={dataSources.advantageMatrix} />
            </div>
            <div className="text-sm text-gray-600">Advantage Score</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold text-blue-600">{waitlistProperties.length}</div>
              <DataSourceBadge source={dataSources.waitlist} />
            </div>
            <div className="text-sm text-gray-600">Waitlist Properties</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xl font-bold text-orange-600">{agingCompetitors.length}</div>
              <DataSourceBadge source={dataSources.aging} />
            </div>
            <div className="text-sm text-gray-600">Aging Competitors</div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'comp-analysis' && (
          <DealCompAnalysisTab />
        )}

        {activeTab === 'map' && (
          <CompetitiveSetMap
            competitors={competitors}
            filters={filters}
            onSelectCompetitor={setSelectedCompetitor}
          />
        )}

        {activeTab === 'comparison' && (
          <UnitComparison
            competitors={competitors}
          />
        )}

        {activeTab === 'f40' && (
          <F40PerformanceView
            rankings={f40Rankings}
            competitors={competitors}
            dataSource={dataSources.f40}
          />
        )}

        {activeTab === 'advantage' && advantageMatrix && (
          <AdvantageMatrixView
            matrix={advantageMatrix}
          />
        )}

        {activeTab === 'aging' && (
          <AgingCompetitorTracker
            agingCompetitors={agingCompetitors}
          />
        )}

        {activeTab === 'waitlist' && (
          <WaitlistIntelligence
            waitlistProperties={waitlistProperties}
          />
        )}

        {/* AI Insights Panel */}
        {aiInsights && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="bg-purple-600 rounded-lg p-2">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">AI Development Insights</h3>
                  <DataSourceBadge source={dataSources.insights} />
                </div>
                <p className="text-gray-700 whitespace-pre-line">{aiInsights}</p>
                <div className="flex gap-3 mt-4">
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                    Apply to 3D Model
                  </button>
                  <button className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 text-sm">
                    View Detailed Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitiveSetMap({
  competitors,
  filters,
  onSelectCompetitor
}: {
  competitors: CompetitorProperty[];
  filters: CompetitionFilters;
  onSelectCompetitor: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Map Placeholder */}
        <div className="col-span-2">
          <div className="bg-gray-100 rounded-lg h-[500px] flex items-center justify-center relative">
            <MapPin className="h-16 w-16 text-gray-400" />
            <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg text-sm">
              <div className="font-medium mb-2">Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span>Your Site</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Direct Comps ({competitors.filter(c => c.category === 'direct').length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Under Construction ({competitors.filter(c => c.category === 'construction').length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Planned ({competitors.filter(c => c.category === 'planned').length})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Competitor List */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">
            Competitors ({competitors.length})
          </h3>
          {competitors.map(competitor => (
            <div
              key={competitor.id}
              onClick={() => onSelectCompetitor(competitor.id)}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-gray-900">{competitor.name}</div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  competitor.category === 'direct' ? 'bg-red-100 text-red-700' :
                  competitor.category === 'construction' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {competitor.category}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Home className="h-3 w-3" />
                  <span>{competitor.units} units</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span>{competitor.distance} mi</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  <span>${competitor.avgRent?.toLocaleString()}/mo</span>
                </div>
                {competitor.f40Score !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <F40QuartileBadge score={competitor.f40Score} quartile={competitor.f40Quartile} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UnitComparison({ competitors }: { competitors: CompetitorProperty[] }) {
  const [sortBy, setSortBy] = useState<'name' | 'oneBed' | 'twoBed' | 'efficiency'>('efficiency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedCompetitors = [...competitors].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'oneBed':
        return multiplier * ((a.unitSizes?.oneBed || 0) - (b.unitSizes?.oneBed || 0));
      case 'twoBed':
        return multiplier * ((a.unitSizes?.twoBed || 0) - (b.unitSizes?.twoBed || 0));
      case 'efficiency':
        return multiplier * ((a.efficiencyScore || 0) - (b.efficiencyScore || 0));
      default:
        return 0;
    }
  });

  const marketAvg = {
    oneBed: competitors.reduce((sum, c) => sum + (c.unitSizes?.oneBed || 0), 0) / competitors.length,
    twoBed: competitors.reduce((sum, c) => sum + (c.unitSizes?.twoBed || 0), 0) / competitors.length,
    efficiency: competitors.reduce((sum, c) => sum + (c.efficiencyScore || 0), 0) / competitors.length,
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Unit Layout Comparison</h2>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="efficiency">Efficiency Score</option>
            <option value="oneBed">1BR Size</option>
            <option value="twoBed">2BR Size</option>
            <option value="name">Name</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Market Average Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="font-medium text-blue-900 mb-3">Market Average</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-blue-700">1BR Average</div>
            <div className="text-2xl font-bold text-blue-900">{Math.round(marketAvg.oneBed)} SF</div>
          </div>
          <div>
            <div className="text-sm text-blue-700">2BR Average</div>
            <div className="text-2xl font-bold text-blue-900">{Math.round(marketAvg.twoBed)} SF</div>
          </div>
          <div>
            <div className="text-sm text-blue-700">Efficiency Score</div>
            <div className="text-2xl font-bold text-blue-900">{Math.round(marketAvg.efficiency)}%</div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Property</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Studio</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">1BR</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">2BR</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">3BR</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {sortedCompetitors.map((comp, idx) => (
              <tr key={comp.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-3 px-4">
                  <div className="font-medium text-gray-900">{comp.name}</div>
                  <div className="text-xs text-gray-500">{comp.yearBuilt}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-gray-900">{comp.unitSizes?.studio || '-'} SF</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-gray-900">{comp.unitSizes?.oneBed || '-'} SF</div>
                  {comp.unitSizes?.oneBed && comp.unitSizes.oneBed > marketAvg.oneBed && (
                    <span className="text-xs text-green-600">+{Math.round(comp.unitSizes.oneBed - marketAvg.oneBed)}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="text-gray-900">{comp.unitSizes?.twoBed || '-'} SF</div>
                  {comp.unitSizes?.twoBed && comp.unitSizes.twoBed > marketAvg.twoBed && (
                    <span className="text-xs text-green-600">+{Math.round(comp.unitSizes.twoBed - marketAvg.twoBed)}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="text-gray-900">{comp.unitSizes?.threeBed || '-'} SF</div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="text-gray-900">{comp.efficiencyScore}%</div>
                    {comp.efficiencyScore && comp.efficiencyScore > marketAvg.efficiency && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdvantageMatrixView({ matrix }: { matrix: AdvantageMatrix }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Competitive Advantage Matrix</h2>
          <p className="text-sm text-gray-600 mt-1">
            Feature comparison against direct competitors
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-green-600">{matrix.overallScore}</div>
          <div className="text-sm text-gray-600">Advantage Points</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Feature</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">You</th>
              {matrix.competitors.map(comp => (
                <th key={comp.id} className="text-center py-3 px-4 font-medium text-gray-700">
                  <div className="truncate max-w-[100px]">{comp.name}</div>
                </th>
              ))}
              <th className="text-center py-3 px-4 font-medium text-gray-700">Advantage</th>
            </tr>
          </thead>
          <tbody>
            {matrix.features.map((feature, idx) => (
              <tr key={feature.name} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-3 px-4 font-medium text-gray-900">{feature.name}</td>
                <td className="py-3 px-4 text-center">
                  {feature.you ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                  )}
                </td>
                {matrix.competitors.map(comp => (
                  <td key={comp.id} className="py-3 px-4 text-center">
                    {feature.competitors[comp.id] ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                ))}
                <td className="py-3 px-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    feature.advantagePoints > 0 ? 'bg-green-100 text-green-700' :
                    feature.advantagePoints < 0 ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {feature.advantagePoints > 0 ? '+' : ''}{feature.advantagePoints} pts
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <div className="font-medium text-green-900">Strong Differentiation</div>
            <div className="text-sm text-green-700 mt-1">
              Your development has {matrix.overallScore} advantage points over competitors.
              Key differentiators: {matrix.keyDifferentiators.join(', ')}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgingCompetitorTracker({ agingCompetitors }: { agingCompetitors: CompetitorProperty[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Aging Competition Tracker</h2>
        <p className="text-sm text-gray-600 mt-1">
          Older properties creating opportunities for premium positioning
        </p>
      </div>

      <div className="grid gap-4">
        {agingCompetitors.map(comp => (
          <div key={comp.id} className="border border-gray-200 rounded-lg p-4 hover:border-orange-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  Built {comp.yearBuilt} • {comp.units} units • {comp.distance} mi away
                </div>
              </div>
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                {new Date().getFullYear() - parseInt(comp.yearBuilt)} years old
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-600">Current Rent</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${comp.avgRent?.toLocaleString()}/mo
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Potential Premium</div>
                <div className="text-lg font-semibold text-green-600">
                  +${comp.potentialPremium?.toLocaleString()}/mo
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Occupancy</div>
                <div className="text-lg font-semibold text-gray-900">
                  {comp.occupancy}%
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {comp.needsRenovation && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                  Needs Renovation
                </span>
              )}
              {comp.datedAmenities && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                  Dated Amenities
                </span>
              )}
              {comp.lowOccupancy && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                  Low Occupancy
                </span>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-gray-700">
                  <span className="font-medium">Opportunity:</span> {comp.opportunityNote}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function F40QuartileBadge({ score, quartile }: { score: number; quartile?: number }) {
  const q = quartile || (score >= 80 ? 1 : score >= 60 ? 2 : score >= 40 ? 3 : 4);
  const colors = {
    1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    2: 'bg-blue-100 text-blue-800 border-blue-200',
    3: 'bg-amber-100 text-amber-800 border-amber-200',
    4: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[q as keyof typeof colors] || colors[4]}`}>
      F40: {score}
      <span className="opacity-70">Q{q}</span>
    </span>
  );
}

function F40PerformanceView({
  rankings,
  competitors,
  dataSource,
}: {
  rankings: F40RankingsData;
  competitors: CompetitorProperty[];
  dataSource: DataSource;
}) {
  if (rankings.rankings.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">F40 Performance Scores</h2>
          <DataSourceBadge source={dataSource} />
        </div>
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No F40 data available</p>
          <p className="text-sm mt-1">F40 scores will appear when market data is synced.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">F40 Performance Scores</h2>
          <p className="text-sm text-gray-600 mt-1">
            Submarket performance ranking across 4 dimensions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-600">Market Grade</div>
            <div className={`text-2xl font-bold ${
              rankings.marketGrade === 'A' ? 'text-emerald-600' :
              rankings.marketGrade === 'B+' ? 'text-blue-600' :
              rankings.marketGrade === 'B' ? 'text-blue-500' :
              'text-amber-600'
            }`}>{rankings.marketGrade}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Trend</div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${
              rankings.trendDirection === 'improving' ? 'text-green-600' :
              rankings.trendDirection === 'declining' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {rankings.trendDirection === 'improving' && <ArrowUp className="h-4 w-4" />}
              {rankings.trendDirection === 'declining' && <ArrowDown className="h-4 w-4" />}
              {rankings.trendDirection.charAt(0).toUpperCase() + rankings.trendDirection.slice(1)}
            </div>
          </div>
          <DataSourceBadge source={dataSource} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Q1 - Top Performers', q: 1, color: 'emerald' },
          { label: 'Q2 - Above Average', q: 2, color: 'blue' },
          { label: 'Q3 - Below Average', q: 3, color: 'amber' },
          { label: 'Q4 - Underperformers', q: 4, color: 'red' },
        ].map(bucket => {
          const count = rankings.rankings.filter(r => r.quartile === bucket.q).length;
          return (
            <div key={bucket.q} className={`p-3 rounded-lg border bg-${bucket.color}-50 border-${bucket.color}-200`}>
              <div className="text-xs text-gray-600">{bucket.label}</div>
              <div className="text-xl font-bold text-gray-900">{count}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Rank</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Submarket</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">F40 Score</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Quartile</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Rent Position</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Occupancy</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Pricing Power</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Vintage</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Properties</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Units</th>
            </tr>
          </thead>
          <tbody>
            {rankings.rankings.map((entry, idx) => {
              const isCompetitor = competitors.some(c =>
                c.name.toLowerCase().includes(entry.name.toLowerCase()) ||
                entry.name.toLowerCase().includes(c.name.toLowerCase())
              );
              return (
                <tr
                  key={entry.name}
                  className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${isCompetitor ? 'ring-1 ring-blue-300 ring-inset' : ''}`}
                >
                  <td className="py-3 px-4 font-medium text-gray-900">#{entry.rank}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{entry.name}</div>
                    {isCompetitor && (
                      <span className="text-xs text-blue-600 font-medium">In Comp Set</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${
                      entry.score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                      entry.score >= 60 ? 'bg-blue-100 text-blue-800' :
                      entry.score >= 40 ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {entry.score}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <F40QuartileBadge score={entry.score} quartile={entry.quartile} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DimensionBar score={entry.dimensions?.rentPosition?.score || 0} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DimensionBar score={entry.dimensions?.occupancyStrength?.score || 0} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DimensionBar score={entry.dimensions?.pricingPower?.score || 0} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DimensionBar score={entry.dimensions?.vintagePhysical?.score || 0} />
                  </td>
                  <td className="py-3 px-4 text-center text-gray-700">{entry.propertiesCount}</td>
                  <td className="py-3 px-4 text-center text-gray-700">{entry.totalUnits?.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DimensionBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-blue-500' : score >= 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-6">{score}</span>
    </div>
  );
}

function WaitlistIntelligence({ waitlistProperties }: { waitlistProperties: WaitlistProperty[] }) {
  const avgRent = waitlistProperties.reduce((sum, p) => sum + p.avgRent, 0) / waitlistProperties.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Waitlist Intelligence</h2>
        <p className="text-sm text-gray-600 mt-1">
          High-demand properties with unmet demand
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-blue-900">Market Insight</div>
            <div className="text-sm text-blue-700 mt-1">
              Properties with waitlists average <span className="font-semibold">${avgRent.toLocaleString()}/mo</span>.
              Design for this price point to capture overflow demand.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {waitlistProperties.map(prop => (
          <div key={prop.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  {prop.units} units • {prop.distance} mi away
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{prop.waitlistCount}</div>
                <div className="text-xs text-gray-600">on waitlist</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-600">Occupancy</div>
                <div className="text-lg font-semibold text-gray-900">{prop.occupancy}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Avg Rent</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${prop.avgRent.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Avg Wait Time</div>
                <div className="text-lg font-semibold text-gray-900">{prop.avgWaitTime}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Target Opportunity:</span> {prop.demandNote}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
