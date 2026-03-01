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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-stone-500 text-sm">Loading competition analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  Competition Analysis
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Design Differentiation & Competitive Positioning
                </p>
              </div>
              <DataSourceBadge source={primarySource} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-1.5 border border-stone-300 rounded-lg hover:bg-stone-50 flex items-center gap-2 text-sm text-stone-700"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {(filters.sameVintage || filters.similarSize || filters.sameClass) && (
                  <span className="bg-violet-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {[filters.sameVintage, filters.similarSize, filters.sameClass].filter(Boolean).length}
                  </span>
                )}
              </button>

              <button className="px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 text-sm">
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="grid grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameVintage}
                    onChange={(e) => handleFilterChange('sameVintage', e.target.checked)}
                    className="rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-xs text-stone-600">Same Vintage (±5 years)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.similarSize}
                    onChange={(e) => handleFilterChange('similarSize', e.target.checked)}
                    className="rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-xs text-stone-600">Similar Size (±20%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameClass}
                    onChange={(e) => handleFilterChange('sameClass', e.target.checked)}
                    className="rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-xs text-stone-600">Same Class (A/B/C)</span>
                </label>
                <div>
                  <label className="text-xs text-stone-600 mb-1 block">
                    Distance: {filters.distanceRadius} mi
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={filters.distanceRadius}
                    onChange={(e) => handleFilterChange('distanceRadius', parseFloat(e.target.value))}
                    className="w-full accent-violet-600"
                  />
                </div>
              </div>
            </div>
          )}

          {hasMockData && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-bold">[SAMPLE DATA]</span> Live data is unavailable. Showing sample data for demonstration purposes. Connect a data source for real market intelligence.
              </p>
            </div>
          )}

          <div className="flex gap-1 mt-3 border-b border-stone-200 -mx-5 px-5">
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
                className={`px-3 py-2 font-medium text-xs flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">DIRECT COMPETITORS</div>
              <div className="text-xl font-bold text-stone-900">{competitors.length}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">ADVANTAGE SCORE</div>
              <div className="text-xl font-bold text-emerald-600">{advantageMatrix?.overallScore || 0}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">WAITLIST PROPERTIES</div>
              <div className="text-xl font-bold text-violet-600">{waitlistProperties.length}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-stone-200">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">AGING COMPETITORS</div>
              <div className="text-xl font-bold text-amber-600">{agingCompetitors.length}</div>
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

        {aiInsights && (
          <div className="mt-5 bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="bg-violet-600 rounded-lg p-1.5">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-stone-900">AI Development Insights</h3>
                  <DataSourceBadge source={dataSources.insights} />
                </div>
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">{aiInsights}</p>
              </div>
            </div>
          </div>
        )}
        </div>
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
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <div className="bg-stone-100 rounded-lg h-[500px] flex items-center justify-center relative">
            <MapPin className="h-16 w-16 text-stone-300" />
            <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-stone-200 text-xs">
              <div className="font-semibold text-stone-900 mb-2">Legend</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-violet-600 rounded-full"></div><span className="text-stone-600">Your Site</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div><span className="text-stone-600">Direct ({competitors.filter(c => c.category === 'direct').length})</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div><span className="text-stone-600">Construction ({competitors.filter(c => c.category === 'construction').length})</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div><span className="text-stone-600">Planned ({competitors.filter(c => c.category === 'planned').length})</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-stone-900 mb-2">Competitors ({competitors.length})</h3>
          {competitors.map(competitor => (
            <div key={competitor.id} onClick={() => onSelectCompetitor(competitor.id)} className="p-3 border border-stone-200 rounded-lg hover:border-violet-400 cursor-pointer transition-colors">
              <div className="flex items-start justify-between mb-1.5">
                <div className="text-sm font-medium text-stone-900">{competitor.name}</div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  competitor.category === 'direct' ? 'bg-red-100 text-red-700' :
                  competitor.category === 'construction' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>{competitor.category}</span>
              </div>
              <div className="text-xs text-stone-500 space-y-0.5">
                <div>{competitor.units} units &middot; {competitor.distance} mi &middot; ${competitor.avgRent?.toLocaleString()}/mo</div>
                {competitor.f40Score !== undefined && <F40QuartileBadge score={competitor.f40Score} quartile={competitor.f40Quartile} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getSfBandLabel(sf: number): string {
  const center = Math.round(sf / 50) * 50;
  return `${center - 25}\u2013${center + 25} SF`;
}

function getSfBandCenter(sf: number): number {
  return Math.round(sf / 50) * 50;
}

function isInSfBand(sf: number, targetCenter: number): boolean {
  return sf >= targetCenter - 25 && sf <= targetCenter + 25;
}

const UNIT_TYPE_KEYS = [
  { key: 'studio' as const, label: 'Studio' },
  { key: 'oneBed' as const, label: '1BR' },
  { key: 'twoBed' as const, label: '2BR' },
  { key: 'threeBed' as const, label: '3BR' },
];

function UnitComparison({ competitors }: { competitors: CompetitorProperty[] }) {
  const [activeType, setActiveType] = useState<'studio' | 'oneBed' | 'twoBed' | 'threeBed'>('oneBed');

  const activeLabel = UNIT_TYPE_KEYS.find(u => u.key === activeType)?.label || '1BR';

  const compsWithSize = competitors.filter(c => c.unitSizes && c.unitSizes[activeType]);

  const allSizes = compsWithSize.map(c => c.unitSizes![activeType]!);
  const sfBands = [...new Set(allSizes.map(getSfBandCenter))].sort((a, b) => a - b);

  const marketAvgSf = allSizes.length > 0 ? Math.round(allSizes.reduce((s, v) => s + v, 0) / allSizes.length) : 0;
  const marketAvgRent = compsWithSize.length > 0 ? Math.round(compsWithSize.reduce((s, c) => s + (c.avgRent || 0), 0) / compsWithSize.length) : 0;
  const marketAvgEff = compsWithSize.length > 0 ? Math.round(compsWithSize.reduce((s, c) => s + (c.efficiencyScore || 0), 0) / compsWithSize.length) : 0;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">Unit Layout Comparison</h2>
          <p className="text-xs text-stone-500 mt-0.5">Grouped by bed type + 50 SF tolerance bands (\u00b125 SF from midpoint)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            {UNIT_TYPE_KEYS.map(ut => (
              <button
                key={ut.key}
                onClick={() => setActiveType(ut.key)}
                className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                  activeType === ut.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                {ut.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
        <div className="text-xs font-semibold text-violet-800 mb-2">Market Average \u2014 {activeLabel}</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] text-violet-600">Avg Size</div>
            <div className="text-lg font-bold text-violet-900">{marketAvgSf} SF</div>
          </div>
          <div>
            <div className="text-[10px] text-violet-600">Avg Rent</div>
            <div className="text-lg font-bold text-violet-900">${marketAvgRent.toLocaleString()}/mo</div>
          </div>
          <div>
            <div className="text-[10px] text-violet-600">Avg Efficiency</div>
            <div className="text-lg font-bold text-violet-900">{marketAvgEff}%</div>
          </div>
        </div>
      </div>

      {sfBands.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">No {activeLabel} unit data available for competitors.</div>
      ) : (
        <div className="space-y-4">
          {sfBands.map(bandCenter => {
            const bandComps = compsWithSize.filter(c => isInSfBand(c.unitSizes![activeType]!, bandCenter));
            if (bandComps.length === 0) return null;
            const bandAvgSf = Math.round(bandComps.reduce((s, c) => s + c.unitSizes![activeType]!, 0) / bandComps.length);
            const bandAvgRent = Math.round(bandComps.reduce((s, c) => s + (c.avgRent || 0), 0) / bandComps.length);
            return (
              <div key={bandCenter} className="border border-stone-200 rounded-lg overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 flex items-center justify-between border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-700">{getSfBandLabel(bandCenter)}</span>
                    <span className="text-[10px] text-stone-400">{bandComps.length} {bandComps.length === 1 ? 'property' : 'properties'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-500">
                    <span>Band Avg: <strong className="text-stone-700">{bandAvgSf} SF</strong></span>
                    <span>Avg Rent: <strong className="text-stone-700">${bandAvgRent.toLocaleString()}</strong></span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">YEAR</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">{activeLabel} SF</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">RENT</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">RENT PSF</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">OCC %</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">EFFICIENCY</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono text-stone-400 tracking-wider">\u0394 vs AVG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandComps.map((comp, idx) => {
                      const sf = comp.unitSizes![activeType]!;
                      const rent = comp.avgRent || 0;
                      const psf = sf > 0 ? rent / sf : 0;
                      const deltaRent = rent - bandAvgRent;
                      return (
                        <tr key={comp.id} className="border-t border-stone-50 hover:bg-stone-50/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="text-xs font-medium text-stone-900">{comp.name}</div>
                            <div className="text-[10px] text-stone-400">{comp.distance} mi &middot; {comp.units} units</div>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs text-stone-600">{comp.yearBuilt}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono text-stone-700">{sf}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-bold text-stone-900">${rent.toLocaleString()}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono text-stone-600">${psf.toFixed(2)}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold ${
                              (comp.occupancy || 0) >= 95 ? 'text-emerald-600' : (comp.occupancy || 0) >= 93 ? 'text-amber-600' : 'text-red-600'
                            }`}>{comp.occupancy || '\u2014'}%</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs text-stone-700">{comp.efficiencyScore || '\u2014'}%</span>
                              {comp.efficiencyScore && comp.efficiencyScore > marketAvgEff && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              deltaRent > 0 ? 'bg-emerald-100 text-emerald-700' : deltaRent < 0 ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {deltaRent >= 0 ? '+' : ''}${deltaRent.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-[10px] text-stone-400">
        SF Band tolerance: \u00b125 SF (50 SF total range). Properties are grouped by {activeLabel} unit size into bands centered on the nearest 50 SF increment.
      </div>
    </div>
  );
}

function AdvantageMatrixView({ matrix }: { matrix: AdvantageMatrix }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">Competitive Advantage Matrix</h2>
          <p className="text-xs text-stone-500 mt-0.5">Feature comparison against direct competitors</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600">{matrix.overallScore}</div>
          <div className="text-[10px] text-stone-500">Advantage Points</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50">
              <th className="text-left py-2.5 px-3 text-[10px] font-mono text-stone-400 tracking-wider">FEATURE</th>
              <th className="text-center py-2.5 px-3 text-[10px] font-mono text-stone-400 tracking-wider">YOU</th>
              {matrix.competitors.map(comp => (
                <th key={comp.id} className="text-center py-2.5 px-3 text-[10px] font-mono text-stone-400 tracking-wider">
                  <div className="truncate max-w-[100px]">{comp.name}</div>
                </th>
              ))}
              <th className="text-center py-2.5 px-3 text-[10px] font-mono text-stone-400 tracking-wider">ADVANTAGE</th>
            </tr>
          </thead>
          <tbody>
            {matrix.features.map((feature, idx) => (
              <tr key={feature.name} className="border-t border-stone-100 hover:bg-stone-50/50 transition-colors">
                <td className="py-2.5 px-3 text-xs font-medium text-stone-900">{feature.name}</td>
                <td className="py-2.5 px-3 text-center">
                  {feature.you ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-stone-300 mx-auto" />
                  )}
                </td>
                {matrix.competitors.map(comp => (
                  <td key={comp.id} className="py-2.5 px-3 text-center">
                    {feature.competitors[comp.id] ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    feature.advantagePoints > 0 ? 'bg-emerald-100 text-emerald-700' :
                    feature.advantagePoints < 0 ? 'bg-red-100 text-red-700' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {feature.advantagePoints > 0 ? '+' : ''}{feature.advantagePoints} pts
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-800">
            <strong>Strong Differentiation:</strong> {matrix.overallScore} advantage points. Key differentiators: {matrix.keyDifferentiators.join(', ')}.
          </p>
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
