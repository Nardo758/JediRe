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
import { T as BT, mono as bMono } from '../../components/deal/bloomberg-tokens';

interface CompetitionFilters {
  sameVintage: boolean;
  similarSize: boolean;
  sameClass: boolean;
  distanceRadius: number;
}

function DataSourceBadge({ source }: { source: DataSource }) {
  if (source === 'api') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: BT.greenBg, color: BT.greenL, border: `1px solid ${BT.green}40` }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BT.green }} />
        LIVE DATA
      </span>
    );
  }
  if (source === 'apartment') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: BT.blueBg, color: BT.blueL, border: `1px solid ${BT.blue}40` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: BT.blue }} />
        MARKET DATA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: BT.amberBg, color: BT.amberL, border: `1px solid ${BT.amber}40` }}>
      <AlertCircle className="h-3 w-3" />
      SAMPLE DATA
    </span>
  );
}

function SampleDataBanner() {
  return (
    <div className="px-4 py-3 mb-6 flex items-center gap-3 rounded" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}40`, borderLeft: `3px solid ${BT.amber}` }}>
      <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: BT.amber }} />
      <div>
        <span className="font-semibold" style={{ color: BT.amberL }}>[SAMPLE DATA]</span>
        <span className="ml-2 text-sm" style={{ color: BT.tm }}>
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
  const subtabParam = urlParams.get('subtab');
  const validSubtabs = ['comp-analysis', 'map', 'comparison', 'advantage', 'aging', 'waitlist', 'f40'];
  const initialTab = subtabParam && validSubtabs.includes(subtabParam) ? subtabParam : 'map';
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
      <div className="flex items-center justify-center py-20" style={{ background: BT.bg }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4" style={{ borderColor: BT.violet }}></div>
          <p className="text-sm" style={{ color: BT.td }}>Loading competition analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Bloomberg v0.34 PanelHeader */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: '#1A1F2E',
        borderBottom: '1px solid #1E2538', borderTop: '2px solid #00BCD4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#E8ECF1', letterSpacing: 0.8, fontFamily: "'JetBrains Mono',monospace" }}>COMPETITION ANALYSIS</span>
          <span style={{ fontSize: 8, color: '#8B95A5', fontFamily: "'JetBrains Mono',monospace" }}>M15 | Comp Set · Differentiation · Waitlist · Rankings</span>
          <span style={{ fontSize: 6, fontWeight: 700, color: '#00BCD4', background: '#00BCD415', border: '1px solid #00BCD430', padding: '0 3px', borderRadius: 2, fontFamily: "'JetBrains Mono',monospace" }}>COMPS</span>
          <span style={{ fontSize: 6, fontWeight: 700, color: '#A78BFA', background: '#A78BFA15', border: '1px solid #A78BFA30', padding: '0 3px', borderRadius: 2, fontFamily: "'JetBrains Mono',monospace" }}>F40</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {primarySource === 'api' && <span style={{ fontSize: 7, fontWeight: 700, color: '#00D26A', background: '#022c22', border: '1px solid #00D26A40', padding: '1px 5px', fontFamily: "'JetBrains Mono',monospace" }}>LIVE</span>}
          {primarySource === 'apartment' && <span style={{ fontSize: 7, fontWeight: 700, color: '#60A5FA', background: '#0d1e3d', border: '1px solid #60A5FA40', padding: '1px 5px', fontFamily: "'JetBrains Mono',monospace" }}>MKT DATA</span>}
        </div>
      </div>
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderTop: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: BT.text }}>
                  <Building2 className="h-5 w-5" style={{ color: BT.violet }} />
                  Competition Analysis
                </h1>
                <p className="text-xs mt-0.5" style={{ color: BT.td }}>
                  Design Differentiation &amp; Competitive Positioning
                </p>
              </div>
              <DataSourceBadge source={primarySource} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-1.5 flex items-center gap-2 text-sm"
                style={{ border: `1px solid ${BT.border}`, background: BT.bgPanel, color: BT.tm, borderRadius: 4 }}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {(filters.sameVintage || filters.similarSize || filters.sameClass) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: BT.violet, color: '#fff' }}>
                    {[filters.sameVintage, filters.similarSize, filters.sameClass].filter(Boolean).length}
                  </span>
                )}
              </button>

              <button className="px-3 py-1.5 flex items-center gap-2 text-sm" style={{ background: BT.violet, color: '#fff', border: 'none', borderRadius: 4 }}>
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 p-3 rounded" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <div className="grid grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameVintage}
                    onChange={(e) => handleFilterChange('sameVintage', e.target.checked)}
                    className="rounded"
                    style={{ accentColor: BT.violet }}
                  />
                  <span className="text-xs" style={{ color: BT.tm }}>Same Vintage (±5 years)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.similarSize}
                    onChange={(e) => handleFilterChange('similarSize', e.target.checked)}
                    className="rounded"
                    style={{ accentColor: BT.violet }}
                  />
                  <span className="text-xs" style={{ color: BT.tm }}>Similar Size (±20%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sameClass}
                    onChange={(e) => handleFilterChange('sameClass', e.target.checked)}
                    className="rounded"
                    style={{ accentColor: BT.violet }}
                  />
                  <span className="text-xs" style={{ color: BT.tm }}>Same Class (A/B/C)</span>
                </label>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: BT.tm }}>
                    Distance: {filters.distanceRadius} mi
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={filters.distanceRadius}
                    onChange={(e) => handleFilterChange('distanceRadius', parseFloat(e.target.value))}
                    className="w-full"
                    style={{ accentColor: BT.violet }}
                  />
                </div>
              </div>
            </div>
          )}

          {hasMockData && (
            <div className="mt-3 px-4 py-2 flex items-center gap-2 rounded" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}40`, borderLeft: `3px solid ${BT.amber}` }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: BT.amber }} />
              <p className="text-xs" style={{ color: BT.tm }}>
                <span className="font-bold" style={{ color: BT.amberL }}>[SAMPLE DATA]</span> Live data is unavailable. Showing sample data for demonstration purposes. Connect a data source for real market intelligence.
              </p>
            </div>
          )}

          <div className="flex gap-1 mt-3 -mx-4 px-4" style={{ borderBottom: `1px solid ${BT.border}` }}>
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
                className="px-3 py-2 font-medium text-xs flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderColor: activeTab === tab.id ? BT.cyan : 'transparent',
                  color: activeTab === tab.id ? BT.cyan : BT.td,
                  background: 'transparent',
                }}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="p-3 rounded" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <div className="text-[10px] font-mono tracking-wider mb-1" style={{ color: BT.td }}>DIRECT COMPETITORS</div>
              <div className="text-xl font-bold" style={{ color: BT.text }}>{competitors.length}</div>
            </div>
            <div className="p-3 rounded" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <div className="text-[10px] font-mono tracking-wider mb-1" style={{ color: BT.td }}>ADVANTAGE SCORE</div>
              <div className="text-xl font-bold" style={{ color: BT.greenL }}>{advantageMatrix?.overallScore || 0}</div>
            </div>
            <div className="p-3 rounded" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <div className="text-[10px] font-mono tracking-wider mb-1" style={{ color: BT.td }}>WAITLIST PROPERTIES</div>
              <div className="text-xl font-bold" style={{ color: BT.violL }}>{waitlistProperties.length}</div>
            </div>
            <div className="p-3 rounded" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <div className="text-[10px] font-mono tracking-wider mb-1" style={{ color: BT.td }}>AGING COMPETITORS</div>
              <div className="text-xl font-bold" style={{ color: BT.amberL }}>{agingCompetitors.length}</div>
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
          <div className="mt-5 p-4 rounded" style={{ background: BT.violBg, border: `1px solid ${BT.violet}40` }}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-1.5" style={{ background: BT.violet }}>
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold" style={{ color: BT.text }}>AI Development Insights</h3>
                  <DataSourceBadge source={dataSources.insights} />
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: BT.tm }}>{aiInsights}</p>
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
    <div className="rounded p-5" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <div className="rounded-lg h-[500px] flex items-center justify-center relative" style={{ background: BT.bgBase }}>
            <MapPin className="h-16 w-16" style={{ color: BT.border }} />
            <div className="absolute bottom-4 left-4 p-3 rounded-lg" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
              <div className="font-semibold text-xs mb-2" style={{ color: BT.text }}>Legend</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: BT.violet }}></div><span className="text-xs" style={{ color: BT.tm }}>Your Site</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: BT.red }}></div><span className="text-xs" style={{ color: BT.tm }}>Direct ({competitors.filter(c => c.category === 'direct').length})</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: BT.amber }}></div><span className="text-xs" style={{ color: BT.tm }}>Construction ({competitors.filter(c => c.category === 'construction').length})</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: BT.green }}></div><span className="text-xs" style={{ color: BT.tm }}>Planned ({competitors.filter(c => c.category === 'planned').length})</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2" style={{ color: BT.text }}>Competitors ({competitors.length})</h3>
          {competitors.map(competitor => (
            <div
              key={competitor.id}
              onClick={() => onSelectCompetitor(competitor.id)}
              className="p-3 rounded cursor-pointer transition-colors"
              style={{ border: `1px solid ${BT.border}`, background: BT.bgCard }}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="text-sm font-medium" style={{ color: BT.text }}>{competitor.name}</div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                  background: competitor.category === 'direct' ? BT.redBg : competitor.category === 'construction' ? BT.amberBg : BT.greenBg,
                  color: competitor.category === 'direct' ? BT.redL : competitor.category === 'construction' ? BT.amberL : BT.greenL,
                }}>{competitor.category}</span>
              </div>
              <div className="text-xs space-y-0.5" style={{ color: BT.td }}>
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
    <div className="rounded p-5" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: BT.text }}>Unit Layout Comparison</h2>
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>Grouped by bed type + 50 SF tolerance bands (\u00b125 SF from midpoint)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: BT.violBg, color: BT.violL }}>MOCK DATA</span>
          <div className="flex rounded-lg p-0.5" style={{ background: BT.bgBase }}>
            {UNIT_TYPE_KEYS.map(ut => (
              <button
                key={ut.key}
                onClick={() => setActiveType(ut.key)}
                className="px-3 py-1 text-[10px] font-semibold rounded-md transition-colors"
                style={{
                  background: activeType === ut.key ? BT.bgCard : 'transparent',
                  color: activeType === ut.key ? BT.text : BT.td,
                }}
              >
                {ut.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 mb-4 rounded" style={{ background: BT.violBg, border: `1px solid ${BT.violet}40` }}>
        <div className="text-xs font-semibold mb-2" style={{ color: BT.violL }}>Market Average &mdash; {activeLabel}</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px]" style={{ color: BT.td }}>Avg Size</div>
            <div className="text-lg font-bold" style={{ color: BT.text }}>{marketAvgSf} SF</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: BT.td }}>Avg Rent</div>
            <div className="text-lg font-bold" style={{ color: BT.text }}>${marketAvgRent.toLocaleString()}/mo</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: BT.td }}>Avg Efficiency</div>
            <div className="text-lg font-bold" style={{ color: BT.text }}>{marketAvgEff}%</div>
          </div>
        </div>
      </div>

      {sfBands.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: BT.td }}>No {activeLabel} unit data available for competitors.</div>
      ) : (
        <div className="space-y-4">
          {sfBands.map(bandCenter => {
            const bandComps = compsWithSize.filter(c => isInSfBand(c.unitSizes![activeType]!, bandCenter));
            if (bandComps.length === 0) return null;
            const bandAvgSf = Math.round(bandComps.reduce((s, c) => s + c.unitSizes![activeType]!, 0) / bandComps.length);
            const bandAvgRent = Math.round(bandComps.reduce((s, c) => s + (c.avgRent || 0), 0) / bandComps.length);
            return (
              <div key={bandCenter} className="rounded overflow-hidden" style={{ border: `1px solid ${BT.border}` }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: BT.bgCard, borderBottom: `1px solid ${BT.border}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: BT.text }}>{getSfBandLabel(bandCenter)}</span>
                    <span className="text-[10px]" style={{ color: BT.td }}>{bandComps.length} {bandComps.length === 1 ? 'property' : 'properties'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: BT.td }}>
                    <span>Band Avg: <strong style={{ color: BT.tm }}>{bandAvgSf} SF</strong></span>
                    <span>Avg Rent: <strong style={{ color: BT.tm }}>${bandAvgRent.toLocaleString()}</strong></span>
                  </div>
                </div>
                <table className="w-full text-sm" style={{ background: BT.bgPanel }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BT.border}` }}>
                      <th className="text-left py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>PROPERTY</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>YEAR</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>{activeLabel} SF</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>RENT</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>RENT PSF</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>OCC %</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>EFFICIENCY</th>
                      <th className="text-center py-2 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>&Delta; vs AVG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandComps.map((comp, idx) => {
                      const sf = comp.unitSizes![activeType]!;
                      const rent = comp.avgRent || 0;
                      const psf = sf > 0 ? rent / sf : 0;
                      const deltaRent = rent - bandAvgRent;
                      return (
                        <tr key={comp.id} style={{ borderTop: `1px solid ${BT.border}`, background: idx % 2 === 0 ? BT.bgPanel : BT.bgCard }}>
                          <td className="py-2.5 px-3">
                            <div className="text-xs font-medium" style={{ color: BT.text }}>{comp.name}</div>
                            <div className="text-[10px]" style={{ color: BT.td }}>{comp.distance} mi &middot; {comp.units} units</div>
                          </td>
                          <td className="text-center py-2.5 px-3 text-xs" style={{ color: BT.tm }}>{comp.yearBuilt}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono" style={{ color: BT.text }}>{sf}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-bold" style={{ color: BT.amber }}>${rent.toLocaleString()}</td>
                          <td className="text-center py-2.5 px-3 text-xs font-mono" style={{ color: BT.tm }}>${psf.toFixed(2)}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-xs font-semibold" style={{ color: (comp.occupancy || 0) >= 95 ? BT.green : (comp.occupancy || 0) >= 93 ? BT.amber : BT.red }}>
                              {comp.occupancy || '\u2014'}%
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs" style={{ color: BT.text }}>{comp.efficiencyScore || '\u2014'}%</span>
                              {comp.efficiencyScore && comp.efficiencyScore > marketAvgEff && (
                                <CheckCircle2 className="h-3 w-3" style={{ color: BT.green }} />
                              )}
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                              background: deltaRent > 0 ? BT.greenBg : deltaRent < 0 ? BT.redBg : BT.bgBase,
                              color: deltaRent > 0 ? BT.greenL : deltaRent < 0 ? BT.redL : BT.td,
                            }}>
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

      <div className="mt-3 text-[10px]" style={{ color: BT.td }}>
        SF Band tolerance: \u00b125 SF (50 SF total range). Properties are grouped by {activeLabel} unit size into bands centered on the nearest 50 SF increment.
      </div>
    </div>
  );
}

function AdvantageMatrixView({ matrix }: { matrix: AdvantageMatrix }) {
  return (
    <div className="rounded p-5" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: BT.text }}>Competitive Advantage Matrix</h2>
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>Feature comparison against direct competitors</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: BT.greenL }}>{matrix.overallScore}</div>
          <div className="text-[10px]" style={{ color: BT.td }}>Advantage Points</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded" style={{ border: `1px solid ${BT.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: BT.bgCard }}>
              <th className="text-left py-2.5 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>FEATURE</th>
              <th className="text-center py-2.5 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>YOU</th>
              {matrix.competitors.map(comp => (
                <th key={comp.id} className="text-center py-2.5 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>
                  <div className="truncate max-w-[100px]">{comp.name}</div>
                </th>
              ))}
              <th className="text-center py-2.5 px-3 text-[10px] font-mono tracking-wider" style={{ color: BT.td }}>ADVANTAGE</th>
            </tr>
          </thead>
          <tbody>
            {matrix.features.map((feature, idx) => (
              <tr key={feature.name} style={{ borderTop: `1px solid ${BT.border}`, background: idx % 2 === 0 ? BT.bgPanel : BT.bgCard }}>
                <td className="py-2.5 px-3 text-xs font-medium" style={{ color: BT.text }}>{feature.name}</td>
                <td className="py-2.5 px-3 text-center">
                  {feature.you ? (
                    <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: BT.green }} />
                  ) : (
                    <XCircle className="h-4 w-4 mx-auto" style={{ color: BT.border }} />
                  )}
                </td>
                {matrix.competitors.map(comp => (
                  <td key={comp.id} className="py-2.5 px-3 text-center">
                    {feature.competitors[comp.id] ? (
                      <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: BT.green }} />
                    ) : (
                      <XCircle className="h-4 w-4 mx-auto" style={{ color: BT.border }} />
                    )}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                    background: feature.advantagePoints > 0 ? BT.greenBg : feature.advantagePoints < 0 ? BT.redBg : BT.bgBase,
                    color: feature.advantagePoints > 0 ? BT.greenL : feature.advantagePoints < 0 ? BT.redL : BT.td,
                  }}>
                    {feature.advantagePoints > 0 ? '+' : ''}{feature.advantagePoints} pts
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 rounded" style={{ background: BT.greenBg, border: `1px solid ${BT.green}40` }}>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: BT.green }} />
          <p className="text-xs" style={{ color: BT.greenL }}>
            <strong>Strong Differentiation:</strong> {matrix.overallScore} advantage points. Key differentiators: {matrix.keyDifferentiators.join(', ')}.
          </p>
        </div>
      </div>
    </div>
  );
}

function AgingCompetitorTracker({ agingCompetitors }: { agingCompetitors: CompetitorProperty[] }) {
  return (
    <div className="rounded p-6" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: BT.text }}>Aging Competition Tracker</h2>
        <p className="text-sm mt-1" style={{ color: BT.td }}>
          Older properties creating opportunities for premium positioning
        </p>
      </div>

      <div className="grid gap-4">
        {agingCompetitors.map(comp => (
          <div key={comp.id} className="rounded-lg p-4 transition-colors" style={{ border: `1px solid ${BT.border}`, background: BT.bgCard }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold" style={{ color: BT.text }}>{comp.name}</h3>
                <div className="text-sm mt-1" style={{ color: BT.td }}>
                  Built {comp.yearBuilt} &bull; {comp.units} units &bull; {comp.distance} mi away
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: BT.orangeBg, color: BT.orangeL }}>
                {new Date().getFullYear() - parseInt(comp.yearBuilt)} years old
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Current Rent</div>
                <div className="text-lg font-semibold" style={{ color: BT.text }}>
                  ${comp.avgRent?.toLocaleString()}/mo
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Potential Premium</div>
                <div className="text-lg font-semibold" style={{ color: BT.greenL }}>
                  +${comp.potentialPremium?.toLocaleString()}/mo
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Occupancy</div>
                <div className="text-lg font-semibold" style={{ color: BT.text }}>
                  {comp.occupancy}%
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {comp.needsRenovation && (
                <span className="px-2 py-1 rounded text-xs" style={{ background: BT.redBg, color: BT.redL }}>
                  Needs Renovation
                </span>
              )}
              {comp.datedAmenities && (
                <span className="px-2 py-1 rounded text-xs" style={{ background: BT.amberBg, color: BT.amberL }}>
                  Dated Amenities
                </span>
              )}
              {comp.lowOccupancy && (
                <span className="px-2 py-1 rounded text-xs" style={{ background: BT.orangeBg, color: BT.orangeL }}>
                  Low Occupancy
                </span>
              )}
            </div>

            <div className="pt-3" style={{ borderTop: `1px solid ${BT.border}` }}>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" style={{ color: BT.orange }} />
                <span style={{ color: BT.tm }}>
                  <span className="font-medium" style={{ color: BT.text }}>Opportunity:</span> {comp.opportunityNote}
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
  const styles: Record<number, { bg: string; color: string }> = {
    1: { bg: BT.greenBg, color: BT.greenL },
    2: { bg: BT.blueBg, color: BT.blueL },
    3: { bg: BT.amberBg, color: BT.amberL },
    4: { bg: BT.redBg, color: BT.redL },
  };
  const s = styles[q as keyof typeof styles] || styles[4];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
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
      <div className="rounded p-6" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: BT.text }}>F40 Performance Scores</h2>
          <DataSourceBadge source={dataSource} />
        </div>
        <div className="text-center py-12" style={{ color: BT.td }}>
          <TrendingUp className="h-12 w-12 mx-auto mb-3" style={{ color: BT.border }} />
          <p className="font-medium">No F40 data available</p>
          <p className="text-sm mt-1">F40 scores will appear when market data is synced.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded p-6" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BT.text }}>F40 Performance Scores</h2>
          <p className="text-sm mt-1" style={{ color: BT.td }}>
            Submarket performance ranking across 4 dimensions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm" style={{ color: BT.td }}>Market Grade</div>
            <div className="text-2xl font-bold" style={{
              color: rankings.marketGrade === 'A' ? BT.greenL :
              rankings.marketGrade === 'B+' ? BT.blueL :
              rankings.marketGrade === 'B' ? BT.blue : BT.amberL
            }}>{rankings.marketGrade}</div>
          </div>
          <div className="text-right">
            <div className="text-sm" style={{ color: BT.td }}>Trend</div>
            <div className="text-sm font-semibold flex items-center gap-1" style={{
              color: rankings.trendDirection === 'improving' ? BT.greenL :
              rankings.trendDirection === 'declining' ? BT.redL : BT.td
            }}>
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
          { label: 'Q1 - Top Performers', q: 1, bg: BT.greenBg, color: BT.greenL },
          { label: 'Q2 - Above Average', q: 2, bg: BT.blueBg, color: BT.blueL },
          { label: 'Q3 - Below Average', q: 3, bg: BT.amberBg, color: BT.amberL },
          { label: 'Q4 - Underperformers', q: 4, bg: BT.redBg, color: BT.redL },
        ].map(bucket => {
          const count = rankings.rankings.filter(r => r.quartile === bucket.q).length;
          return (
            <div key={bucket.q} className="p-3 rounded" style={{ background: bucket.bg, border: `1px solid ${bucket.color}40` }}>
              <div className="text-xs" style={{ color: BT.td }}>{bucket.label}</div>
              <div className="text-xl font-bold" style={{ color: bucket.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `2px solid ${BT.border}` }}>
              <th className="text-left py-3 px-4 font-medium" style={{ color: BT.tm }}>Rank</th>
              <th className="text-left py-3 px-4 font-medium" style={{ color: BT.tm }}>Submarket</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>F40 Score</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Quartile</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Rent Position</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Occupancy</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Pricing Power</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Vintage</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Properties</th>
              <th className="text-center py-3 px-4 font-medium" style={{ color: BT.tm }}>Units</th>
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
                  style={{
                    background: idx % 2 === 0 ? BT.bgPanel : BT.bgCard,
                    outline: isCompetitor ? `1px solid ${BT.blue}60` : 'none',
                  }}
                >
                  <td className="py-3 px-4 font-medium" style={{ color: BT.text }}>#{entry.rank}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium" style={{ color: BT.text }}>{entry.name}</div>
                    {isCompetitor && (
                      <span className="text-xs font-medium" style={{ color: BT.blueL }}>In Comp Set</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold" style={{
                      background: entry.score >= 80 ? BT.greenBg : entry.score >= 60 ? BT.blueBg : entry.score >= 40 ? BT.amberBg : BT.redBg,
                      color: entry.score >= 80 ? BT.greenL : entry.score >= 60 ? BT.blueL : entry.score >= 40 ? BT.amberL : BT.redL,
                    }}>
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
                  <td className="py-3 px-4 text-center" style={{ color: BT.tm }}>{entry.propertiesCount}</td>
                  <td className="py-3 px-4 text-center" style={{ color: BT.tm }}>{entry.totalUnits?.toLocaleString()}</td>
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
  const color = score >= 70 ? BT.green : score >= 50 ? BT.blue : score >= 30 ? BT.amber : BT.red;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: BT.border }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
      <span className="text-xs w-6" style={{ color: BT.td }}>{score}</span>
    </div>
  );
}

function WaitlistIntelligence({ waitlistProperties }: { waitlistProperties: WaitlistProperty[] }) {
  const avgRent = waitlistProperties.reduce((sum, p) => sum + p.avgRent, 0) / waitlistProperties.length;

  return (
    <div className="rounded p-6" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: BT.text }}>Waitlist Intelligence</h2>
        <p className="text-sm mt-1" style={{ color: BT.td }}>
          High-demand properties with unmet demand
        </p>
      </div>

      <div className="p-4 mb-6 rounded" style={{ background: BT.blueBg, border: `1px solid ${BT.blue}40` }}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: BT.blue }}>
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-medium" style={{ color: BT.text }}>Market Insight</div>
            <div className="text-sm mt-1" style={{ color: BT.blueL }}>
              Properties with waitlists average <span className="font-semibold">${avgRent.toLocaleString()}/mo</span>.
              Design for this price point to capture overflow demand.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {waitlistProperties.map(prop => (
          <div key={prop.id} className="rounded-lg p-4 transition-colors" style={{ border: `1px solid ${BT.border}`, background: BT.bgCard }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold" style={{ color: BT.text }}>{prop.name}</h3>
                <div className="text-sm mt-1" style={{ color: BT.td }}>
                  {prop.units} units &bull; {prop.distance} mi away
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: BT.blueL }}>{prop.waitlistCount}</div>
                <div className="text-xs" style={{ color: BT.td }}>on waitlist</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Occupancy</div>
                <div className="text-lg font-semibold" style={{ color: BT.text }}>{prop.occupancy}%</div>
              </div>
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Avg Rent</div>
                <div className="text-lg font-semibold" style={{ color: BT.amber }}>
                  ${prop.avgRent.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: BT.td }}>Avg Wait Time</div>
                <div className="text-lg font-semibold" style={{ color: BT.text }}>{prop.avgWaitTime}</div>
              </div>
            </div>

            <div className="pt-3" style={{ borderTop: `1px solid ${BT.border}` }}>
              <div className="text-sm" style={{ color: BT.tm }}>
                <span className="font-medium" style={{ color: BT.text }}>Target Opportunity:</span> {prop.demandNote}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
