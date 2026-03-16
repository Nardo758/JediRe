/**
 * ═══════════════════════════════════════════════════════════════════
 * DEV CAPACITY → UNIT MIX CASCADE FLOW
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. User opens the Zoning module (activeTab === 'zoning')
 *    └─ ZoningModuleSection renders; DevelopmentCapacityTab is the
 *       second sub-tab ("Dev Capacity").
 *
 * 2. User selects a development path inside DevelopmentCapacityTab
 *    └─ DevelopmentCapacityTab calls:
 *         useDealStore.getState().setDevelopmentEnvelope({ max_units, max_gfa, … })
 *         useZoningModuleStore.selectDevelopmentPath(pathId, envelope)
 *
 * 3. This page observes developmentEnvelope + selectedDevelopmentPathId
 *    from dealStore. When both are non-null AND activeTab === 'zoning',
 *    a sticky CTA banner appears at the bottom of the main content area.
 *
 * 4. CTA label is deal-type aware:
 *      development   → "Design Unit Program →"
 *      existing      → "View Unit Positioning →"
 *      redevelopment → "Plan Renovation Mix →"
 *
 * 5. Clicking the CTA calls setActiveTab('unit-mix-intelligence').
 *    └─ UnitMixIntelligence receives developmentEnvelope from the store
 *       and renders the utilisation bar with max_units / max_gfa constraints.
 *       For redevelopment deals it also shows the existing vs. net-new
 *       units split sourced from the envelope's selected_path metadata.
 * ═══════════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  BarChart3, DollarSign, Bot, TrendingUp,
  Building2, Target, Package, MapPin, Calculator,
  Search, ArrowLeft, Activity, LayoutDashboard,
  Landmark, HardHat, Shield, ArrowRight
} from 'lucide-react';
import { Tab } from '../components/deal/TabGroup';
import { DealScreenWrapper } from '../components/deal/DealScreenWrapper';
import { apiClient } from '../services/api.client';
import { useDealStore, useDealTypeConfig, useDealType } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { GeographicScopeTabs, TradeAreaDefinitionPanel } from '../components/trade-area';
import type { ModuleId } from '../shared/config/deal-type-visibility';

import { OverviewRouter } from '../components/deal/sections/OverviewRouter';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';
import { PresenceIndicator } from '../components/deal/PresenceIndicator';
import { ActivityFeed } from '../components/deal/ActivityFeed';
import { CommentThread } from '../components/deal/CommentThread';
import { DealTeamPanel } from '../components/deal/DealTeamPanel';

import { MarketIntelligencePage } from './development/MarketIntelligencePage';
import CompetitionPage from './development/CompetitionPage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';

import RiskIntelligence from '../components/deal/sections/RiskIntelligence';
import OpportunityEngineSection from '../components/deal/sections/OpportunityEngineSection';
import { TrafficModule } from '../components/deal/sections/TrafficModule';
import { ProFormaTab } from '../components/deal/sections/ProFormaTab';
import { ExitCapitalModule } from '../components/deal/sections/ExitCapitalModule';
import FinancialDashboard from '../components/deal/sections/FinancialDashboard';

import { DueDiligencePage } from './development/DueDiligencePage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import { ProjectManagementSection } from '../components/deal/sections/ProjectManagementSection';

import { FilesSection } from '../components/deal/sections/FilesSection';

import OpusAISection from '../components/deal/sections/OpusAISection';
import { AIRecommendationsSection } from '../components/deal/sections/AIRecommendationsSection';
import { ContextTrackerSection } from '../components/deal/sections/ContextTrackerSection';
import { StrategySection } from '../components/deal/sections/StrategySection';
import { TeamManagementSection } from '../components/deal/sections/TeamManagementSection';
import { ConstructionManagementSection } from '../components/deal/sections/ConstructionManagementSection';

import TaxModule from '../components/deal/sections/TaxModule';
import CompsModule from '../components/deal/sections/CompsModule';
import CollisionAnalysisSection from '../components/deal/sections/CollisionAnalysisSection';
import UnitMixIntelligence from '../components/deal/sections/UnitMixIntelligence';
import { ZoningModuleSection } from '../components/deal/sections/ZoningModuleSection';
import { ZoningAgentChat } from '../components/zoning/ZoningAgentChat';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import type { DevelopmentPath } from '../types/zoning.types';

interface DealTab extends Tab {
  moduleId?: ModuleId;
}

const DEV_PATH_CONFIG: Record<DevelopmentPath, { label: string; color: string }> = {
  by_right: { label: 'By-Right', color: 'bg-green-100 text-green-700' },
  overlay_bonus: { label: 'Overlay Bonus', color: 'bg-blue-100 text-blue-700' },
  variance: { label: 'Variance', color: 'bg-amber-100 text-amber-700' },
  rezone: { label: 'Full Rezone', color: 'bg-red-100 text-red-700' },
};

function normalizePath(raw: string): DevelopmentPath | null {
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (lower.startsWith('by_right')) return 'by_right';
  if (lower.startsWith('overlay') || lower.includes('bonus')) return 'overlay_bonus';
  if (lower.startsWith('variance')) return 'variance';
  if (lower.startsWith('rezone')) return 'rezone';
  if ((DEV_PATH_CONFIG as Record<string, unknown>)[raw]) return raw as DevelopmentPath;
  return null;
}

function DevPathBadge() {
  const { development_path } = useZoningModuleStore();
  if (!development_path) return null;
  const key = normalizePath(development_path);
  if (!key) return null;
  const cfg = DEV_PATH_CONFIG[key];
  return (
    <span className={`text-xs font-medium px-3 py-1 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Module-level screen wrappers (stable references — prevents remount blink) ──
const CollaborationSection = (props: any) => {
  const dId = props?.dealId;
  if (!dId) return <div className="p-4 text-sm text-slate-500">No deal selected</div>;
  return (
    <div className="p-4 space-y-4">
      <DealTeamPanel dealId={dId} />
      <CommentThread dealId={dId} />
      <ActivityFeed dealId={dId} />
    </div>
  );
};

const OverviewScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'overview',    label: 'Deal Overview',   component: OverviewRouter },
    { id: 'context',     label: 'Context Tracker', component: ContextTrackerSection },
    { id: 'team',        label: 'Team',            component: TeamManagementSection },
    { id: 'collaborate', label: 'Collaborate',      component: CollaborationSection },
    { id: 'deal-status', label: 'Deal Status',     component: DealStatusSection },
  ]} />
);
const MarketScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'market-intelligence', label: 'Market Intel', component: MarketIntelligencePage },
    { id: 'unit-mix',            label: 'Unit Mix',     component: UnitMixIntelligence },
    { id: 'trends',              label: 'Trends',       component: TrendsAnalysisSection },
    { id: 'opportunity',         label: 'Opportunity',  component: OpportunityEngineSection },
  ]} />
);
const CompetitionScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'competition', label: 'Competition Analysis', component: CompetitionPage },
    { id: 'comps',       label: 'Sale Comps',           component: CompsModule },
  ]} />
);
const StrategyScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'strategy',  label: 'Strategy',    component: StrategySection },
    { id: '3d-design', label: '3D Building', component: Design3DPageEnhanced },
  ]} />
);
const ProformaScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'proforma',            label: 'Pro Forma',           component: ProFormaTab },
    { id: 'tax',                 label: 'Tax Intelligence',    component: TaxModule },
    { id: 'financial-dashboard', label: 'Financial Dashboard', component: FinancialDashboard },
  ]} />
);
const RiskScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'risk-intelligence', label: 'Risk Intelligence',  component: RiskIntelligence },
    { id: 'collision',         label: 'Collision Analysis', component: CollisionAnalysisSection },
    { id: 'due-diligence',     label: 'DD Checklist',       component: DueDiligencePage },
    { id: 'files',             label: 'Files & Assets',     component: FilesSection },
  ]} />
);
const ExecutionScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'timeline',           label: 'Project Timeline',   component: ProjectTimelinePage },
    { id: 'project-management', label: 'Project Management', component: ProjectManagementSection },
    { id: 'construction-mgmt',  label: 'Construction Mgmt',  component: ConstructionManagementSection },
  ]} />
);
const AIAgentScreen = (props: any) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'opus-ai',            label: 'Opus AI Agent',      component: OpusAISection },
    { id: 'ai-recommendations', label: 'AI Recommendations', component: AIRecommendationsSection },
  ]} />
);

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchDealContext } = useDealStore();
  const config = useDealTypeConfig();
  const dealType = useDealType();
  const developmentEnvelope = useDealStore((s) => s.developmentEnvelope);
  const selectedDevelopmentPathId = useDealStore((s) => s.selectedDevelopmentPathId);
  const { activeScope, setScope, loadTradeAreaForDeal, setActiveTradeArea } = useTradeAreaStore();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [geographicStats, setGeographicStats] = useState<any>(null);
  const [geographicContext, setGeographicContext] = useState<any>(null);
  const [showTradeAreaPanel, setShowTradeAreaPanel] = useState(false);

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
      fetchGeographicContext(dealId);
    }
  }, [dealId]);

  const fetchGeographicContext = async (id: string) => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${id}/geographic-context`) as any;
      const context = response?.data?.data;
      setGeographicContext(context || null);
      setActiveTradeArea(context?.trade_area || null);
      if (context?.active_scope) {
        setScope(context.active_scope);
      }
      const stats: any = {};
      if (context?.trade_area) {
        stats.trade_area = context.trade_area.stats
          ? { occupancy: context.trade_area.stats.occupancy, avg_rent: context.trade_area.stats.avg_rent }
          : {};
      }
      if (context?.submarket?.stats) {
        stats.submarket = {
          occupancy: context.submarket.stats.avg_occupancy,
          avg_rent: context.submarket.stats.avg_rent,
        };
      }
      if (context?.msa?.stats) {
        stats.msa = {
          occupancy: context.msa.stats.avg_occupancy,
          avg_rent: context.msa.stats.avg_rent,
        };
      }
      setGeographicStats(stats);
    } catch {
      setGeographicContext(null);
      setGeographicStats(null);
    }
  };

  const getDealCentroid = (): [number, number] | null => {
    if (!deal?.boundary?.coordinates) return null;
    try {
      const coords = deal.boundary.type === 'Polygon'
        ? deal.boundary.coordinates[0]
        : deal.boundary.type === 'Point'
        ? [deal.boundary.coordinates]
        : null;
      if (!coords || coords.length === 0) return null;
      const sumLng = coords.reduce((s: number, c: number[]) => s + c[0], 0);
      const sumLat = coords.reduce((s: number, c: number[]) => s + c[1], 0);
      return [sumLng / coords.length, sumLat / coords.length];
    } catch { return null; }
  };

  const handleTradeAreaSave = async (tradeAreaId: string) => {
    if (!dealId) return;
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/geographic-context`, {
        trade_area_id: tradeAreaId,
        active_scope: 'trade_area',
      });
      setShowTradeAreaPanel(false);
      loadTradeAreaForDeal(dealId);
      fetchGeographicContext(dealId);
      setScope('trade_area');
    } catch (err) {
      console.error('Failed to save trade area:', err);
    }
  };

  const loadDeal = async (id: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/v1/deals/${id}`) as any;
      const body = response?.data;
      setDeal(body?.deal || body?.data || body);
      fetchDealContext(id);
    } catch (error) {
      console.error('Error loading deal:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const fKeyMap: { [key: string]: string } = {
        F1: 'overview', F2: 'zoning', F3: 'market', F4: 'supply',
        F5: 'competition', F6: 'strategy', F7: 'traffic',
        F8: 'proforma', F9: 'capital', F10: 'risk',
        F11: 'execution', F12: 'ai-agent',
      };
      if (fKeyMap[e.key]) {
        e.preventDefault();
        setActiveTab(fKeyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // ─── 12 FLAT SCREEN DEFINITIONS (F1–F12) ───────────────────────────
  const dealScreens = [
    { id: 'overview',    fkey: 'F1',  code: 'M01', label: 'Overview',             icon: <LayoutDashboard size={14} />, component: OverviewScreen },
    { id: 'zoning',      fkey: 'F2',  code: 'M02', label: 'Property & Zoning',    icon: <Landmark size={14} />,        component: ZoningModuleSection },
    { id: 'market',      fkey: 'F3',  code: 'M05', label: 'Market Intelligence',  icon: <TrendingUp size={14} />,      component: MarketScreen },
    { id: 'supply',      fkey: 'F4',  code: 'M04', label: 'Supply Pipeline',      icon: <Package size={14} />,         component: SupplyPipelinePage },
    { id: 'competition', fkey: 'F5',  code: 'M15', label: 'Competition & Comps',  icon: <Target size={14} />,          component: CompetitionScreen },
    { id: 'strategy',    fkey: 'F6',  code: 'M08', label: 'Strategy & Design',    icon: <Target size={14} />,          component: StrategyScreen },
    { id: 'traffic',     fkey: 'F7',  code: 'M10', label: 'Traffic Module',       icon: <Activity size={14} />,        component: TrafficModule },
    { id: 'proforma',    fkey: 'F8',  code: 'M11', label: 'Pro Forma',            icon: <Calculator size={14} />,      component: ProformaScreen },
    { id: 'capital',     fkey: 'F9',  code: 'M12', label: 'Debt & Capital',       icon: <DollarSign size={14} />,      component: ExitCapitalModule },
    { id: 'risk',        fkey: 'F10', code: 'M13', label: 'Risk & Due Diligence', icon: <Shield size={14} />,          component: RiskScreen },
    { id: 'execution',   fkey: 'F11', code: 'M17', label: 'Execution',            icon: <HardHat size={14} />,         component: ExecutionScreen },
    { id: 'ai-agent',    fkey: 'F12', code: 'M20', label: 'AI Agent',             icon: <Bot size={14} />,             component: AIAgentScreen },
  ];

  // ─── Search: flat list of all sub-components for search ────────────────
  const allSearchableTabs: Tab[] = [
    { id: 'overview', label: 'Deal Overview', icon: <BarChart3 size={16} />, component: OverviewRouter },
    { id: 'zoning', label: 'Property & Zoning', icon: <Landmark size={16} />, component: ZoningModuleSection },
    { id: 'market', label: 'Market Intelligence', icon: <TrendingUp size={16} />, component: MarketIntelligencePage },
    { id: 'supply', label: 'Supply Pipeline', icon: <Package size={16} />, component: SupplyPipelinePage },
    { id: 'competition', label: 'Competition Analysis', icon: <Target size={16} />, component: CompetitionPage },
    { id: 'strategy', label: 'Strategy', icon: <Target size={16} />, component: StrategySection },
    { id: 'traffic', label: 'Traffic Module', icon: <Activity size={16} />, component: TrafficModule },
    { id: 'proforma', label: 'Pro Forma', icon: <Calculator size={16} />, component: ProFormaTab },
    { id: 'capital', label: 'Debt & Capital', icon: <DollarSign size={16} />, component: ExitCapitalModule },
    { id: 'risk', label: 'Risk & DD', icon: <Shield size={16} />, component: RiskIntelligence },
    { id: 'execution', label: 'Execution', icon: <HardHat size={16} />, component: ProjectTimelinePage },
    { id: 'ai-agent', label: 'AI Agent', icon: <Bot size={16} />, component: OpusAISection },
  ];

  // Keep allTabs alias for search compatibility
  const allTabs = allSearchableTabs;

  const activeScreenData = dealScreens.find(s => s.id === activeTab) || dealScreens[0];
  const ActiveComponent = activeScreenData.component;

  const filteredTabs = searchQuery
    ? allTabs.filter(tab => tab.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const showUnitMixCTA =
    activeTab === 'zoning' &&
    developmentEnvelope !== null &&
    selectedDevelopmentPathId !== null;

  const ctaLabel =
    dealType === 'development'
      ? 'Design Unit Program'
      : dealType === 'redevelopment'
      ? 'Plan Renovation Mix'
      : 'View Unit Positioning';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Loading deal...</span>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-6xl text-slate-300">
          <Building2 size={64} />
        </div>
        <h2 className="text-xl font-semibold text-slate-700">Deal not found</h2>
        <p className="text-sm text-slate-500">This deal may have been deleted or you don't have access.</p>
        <button
          onClick={() => navigate('/deals')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          Back to Deal Capsules
        </button>
      </div>
    );
  }

  return (
    <DealModuleProvider dealId={dealId || null} deal={deal} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="h-full flex flex-col bg-slate-50 -mb-6 -mx-6">
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex-shrink-0">Deal Capsule</span>
                  <h1 className="text-lg font-bold text-slate-900 truncate">{deal.name || 'Untitled Deal'}</h1>
                  <span className="text-xs font-medium px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full capitalize flex-shrink-0">
                    {deal.project_type || deal.property_type || 'multifamily'}
                  </span>
                  {deal.status && (
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                      deal.status === 'active' ? 'bg-green-100 text-green-700' :
                      deal.status === 'closed' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {deal.status}
                    </span>
                  )}
                  <DevPathBadge />
                </div>
                {(deal.address || deal.location) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{deal.address || deal.location}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <GeographicScopeTabs
                activeScope={activeScope}
                onChange={setScope}
                tradeAreaEnabled={!!geographicStats?.trade_area}
                onDefineTradeArea={() => setShowTradeAreaPanel(true)}
                stats={geographicStats || {}}
                compact
              />
              {dealId && <PresenceIndicator dealId={dealId} currentModule={activeTab} />}
              {deal.jedi_score && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Activity size={12} />
                  JEDI {deal.jedi_score}
                </span>
              )}
            </div>
          </div>
        </div>

        {showTradeAreaPanel && (() => {
          const centroid = getDealCentroid();
          const lat = centroid ? centroid[1] : 33.749;
          const lng = centroid ? centroid[0] : -84.388;
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Define Trade Area</h2>
                    <button
                      onClick={() => setShowTradeAreaPanel(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <TradeAreaDefinitionPanel
                    propertyLat={lat}
                    propertyLng={lng}
                    onSave={handleTradeAreaSave}
                    onSkip={() => setShowTradeAreaPanel(false)}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-1 overflow-hidden min-w-0">
          <aside className="w-[260px] bg-white border-r border-slate-200 overflow-y-auto flex flex-col flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search capsule modules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {searchQuery && filteredTabs ? (
                <div className="space-y-0.5">
                  <div className="text-xs text-slate-400 px-3 py-1 font-medium">Search Results ({filteredTabs.length})</div>
                  {filteredTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                      className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-500 text-white font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab.icon && <span className="flex items-center">{tab.icon}</span>}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  {filteredTabs.length === 0 && (
                    <div className="text-sm text-slate-400 text-center py-4">No matching modules</div>
                  )}
                </div>
              ) : (
                <nav className="flex-1 space-y-0.5">
                  {dealScreens.map(screen => (
                    <button
                      key={screen.id}
                      onClick={() => setActiveTab(screen.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                        activeTab === screen.id
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`text-[9px] font-bold font-mono w-5 text-center flex-shrink-0 ${
                        activeTab === screen.id ? 'text-blue-100' : 'text-slate-400 group-hover:text-slate-500'
                      }`}>{screen.fkey}</span>
                      <span className="flex items-center flex-shrink-0 opacity-70">{screen.icon}</span>
                      <span className="flex-1 text-xs font-medium truncate">{screen.label}</span>
                      <span className={`text-[8px] font-mono flex-shrink-0 ${
                        activeTab === screen.id ? 'text-blue-200' : 'text-slate-300'
                      }`}>{screen.code}</span>
                    </button>
                  ))}
                </nav>
              )}
            </div>

            {dealId && (
              <div className="p-3 border-t border-slate-200">
                <ActivityFeed dealId={dealId} limit={10} compact />
              </div>
            )}

            <div className="mt-auto p-3 border-t border-slate-200">
              <div className="text-[10px] text-slate-400 text-center space-y-0.5">
                <p>Press F1–F12 for quick access</p>
                <p className="text-slate-300">Deal Capsule · {dealScreens.length} screens</p>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ActiveComponent deal={deal} dealId={dealId} embedded={true} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} geographicContext={geographicContext} />
            </div>

            {showUnitMixCTA && (
              <div className="shrink-0 border-t border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Development path selected</p>
                    <p className="text-xs text-indigo-600">
                      {developmentEnvelope.max_units} max units · {developmentEnvelope.max_gfa.toLocaleString()} sf GFA · binding: {developmentEnvelope.binding_constraint}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('market')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </main>

          <ZoningAgentChat
            activeTab={activeTab}
            dealId={dealId}
          />
        </div>
      </div>
    </DealModuleProvider>
  );
};

export default DealDetailPage;
