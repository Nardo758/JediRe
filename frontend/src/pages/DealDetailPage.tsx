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
  DollarSign, Bot, TrendingUp,
  Building2, Target, Package, Calculator,
  ArrowLeft, Activity, LayoutDashboard,
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
import { NotarizeClosingSection } from '../components/deal/sections/NotarizeClosingSection';

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
  by_right: { label: 'By-Right', color: 'bg-green-900/20 text-green-300' },
  overlay_bonus: { label: 'Overlay Bonus', color: 'bg-blue-900/20 text-blue-300' },
  variance: { label: 'Variance', color: 'bg-amber-900/20 text-amber-300' },
  rezone: { label: 'Full Rezone', color: 'bg-red-900/20 text-red-300' },
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

// ─── Shared screen props type ──────────────────────────────────────────────────
interface ScreenProps {
  deal?: Record<string, unknown>;
  dealId: string;
  dealType?: string;
  onUpdate?: () => void;
  [k: string]: unknown;
}

// ─── Module-level screen wrappers (stable references — prevents remount blink) ──
const CollaborationSection = (props: ScreenProps) => {
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

const OverviewScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'overview',    label: 'Deal Overview',   component: OverviewRouter },
    { id: 'context',     label: 'Context Tracker', component: ContextTrackerSection },
    { id: 'team',        label: 'Team',            component: TeamManagementSection },
    { id: 'collaborate', label: 'Collaborate',      component: CollaborationSection },
    { id: 'deal-status', label: 'Deal Status',     component: DealStatusSection },
  ]} />
);
const MarketScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'market-intelligence', label: 'Market Intel', component: MarketIntelligencePage },
    { id: 'unit-mix',            label: 'Unit Mix',     component: UnitMixIntelligence },
    { id: 'trends',              label: 'Trends',       component: TrendsAnalysisSection },
    { id: 'opportunity',         label: 'Opportunity',  component: OpportunityEngineSection },
  ]} />
);
const CompetitionScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'competition', label: 'Competition Analysis', component: CompetitionPage },
    { id: 'comps',       label: 'Sale Comps',           component: CompsModule },
  ]} />
);
const StrategyScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'strategy',  label: 'Strategy',    component: StrategySection },
    { id: '3d-design', label: '3D Building', component: Design3DPageEnhanced },
  ]} />
);
const ProformaScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'proforma',            label: 'Pro Forma',           component: ProFormaTab },
    { id: 'tax',                 label: 'Tax Intelligence',    component: TaxModule },
    { id: 'financial-dashboard', label: 'Financial Dashboard', component: FinancialDashboard },
  ]} />
);
const RiskScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'risk-intelligence', label: 'Risk Intelligence',  component: RiskIntelligence },
    { id: 'collision',         label: 'Collision Analysis', component: CollisionAnalysisSection },
    { id: 'due-diligence',     label: 'DD Checklist',       component: DueDiligencePage },
    { id: 'files',             label: 'Files & Assets',     component: FilesSection },
  ]} />
);
const ExecutionScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'timeline',           label: 'Project Timeline',   component: ProjectTimelinePage },
    { id: 'project-management', label: 'Project Management', component: ProjectManagementSection },
    { id: 'construction-mgmt',  label: 'Construction Mgmt',  component: ConstructionManagementSection },
    { id: 'notarize-closing',   label: 'Closing (RON)',      component: NotarizeClosingSection },
  ]} />
);
const DocumentsScreen = (props: ScreenProps) => (
  <DealScreenWrapper passProps={props} tabs={[
    { id: 'files',         label: 'Files & Assets',  component: FilesSection },
    { id: 'due-diligence', label: 'DD Checklist',    component: DueDiligencePage },
  ]} />
);
const CapitalStructureScreen = (props: ScreenProps) => (
  <ExitCapitalModule dealId={props.dealId} deal={props.deal} dealType={props.dealType} initialTab="stack" />
);
const ExitStrategyScreen = (props: ScreenProps) => (
  <ExitCapitalModule dealId={props.dealId} deal={props.deal} dealType={props.dealType} initialTab="exit" />
);
const AIAgentScreen = (props: ScreenProps) => (
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
      const response = await apiClient.get(`/api/v1/deals/${id}/geographic-context`);
      const context = (response as { data?: { data?: Record<string, unknown> } })?.data?.data;
      setGeographicContext(context || null);
      setActiveTradeArea(context?.trade_area || null);
      if (context?.active_scope) {
        setScope(context.active_scope);
      }
      const stats: Record<string, { occupancy?: unknown; avg_rent?: unknown }> = {};
      if (context?.trade_area) {
        const ts = context.trade_area as { stats?: { occupancy?: unknown; avg_rent?: unknown } };
        stats.trade_area = ts.stats
          ? { occupancy: ts.stats.occupancy, avg_rent: ts.stats.avg_rent }
          : {};
      }
      if (context?.submarket) {
        const sm = context.submarket as { stats?: { avg_occupancy?: unknown; avg_rent?: unknown } };
        if (sm.stats) {
          stats.submarket = {
            occupancy: sm.stats.avg_occupancy,
            avg_rent: sm.stats.avg_rent,
          };
        }
      }
      if (context?.msa) {
        const msa = context.msa as { stats?: { avg_occupancy?: unknown; avg_rent?: unknown } };
        if (msa.stats) {
          stats.msa = {
            occupancy: msa.stats.avg_occupancy,
            avg_rent: msa.stats.avg_rent,
          };
        }
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
      const response = await apiClient.get(`/api/v1/deals/${id}`);
      const body = (response as { data?: Record<string, unknown> })?.data;
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
        F1: 'overview', F2: 'zoning',   F3: 'market',     F4: 'supply',
        F5: 'strategy', F6: 'proforma', F7: 'capital',    F8: 'risk',
        F9: 'competition', F10: 'traffic', F11: 'documents', F12: 'exit',
      };
      if (fKeyMap[e.key]) {
        e.preventDefault();
        setActiveTab(fKeyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const handleNavTabChange = (e: Event) => {
      const tabId = (e as CustomEvent<string>).detail;
      if (tabId) setActiveTab(tabId);
    };
    window.addEventListener('deal-tab-change', handleNavTabChange);
    return () => window.removeEventListener('deal-tab-change', handleNavTabChange);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('deal-active-tab', { detail: activeTab }));
  }, [activeTab]);

  // ─── 12 FLAT SCREEN DEFINITIONS (F1–F12) ─── aligned to deal-type-visibility.ts ───
  const allDealScreens: { id: string; moduleId: ModuleId; fkey: string; code: string; label: string; icon: React.ReactNode; component: React.ComponentType<ScreenProps> }[] = [
    { id: 'overview',    moduleId: 'M01', fkey: 'F1',  code: 'M01', label: 'Overview',             icon: <LayoutDashboard size={14} />, component: OverviewScreen },
    { id: 'zoning',      moduleId: 'M02', fkey: 'F2',  code: 'M02', label: 'Property & Zoning',    icon: <Landmark size={14} />,        component: ZoningModuleSection },
    { id: 'market',      moduleId: 'M05', fkey: 'F3',  code: 'M05', label: 'Market Intelligence',  icon: <TrendingUp size={14} />,      component: MarketScreen },
    { id: 'supply',      moduleId: 'M04', fkey: 'F4',  code: 'M04', label: 'Supply Pipeline',      icon: <Package size={14} />,         component: SupplyPipelinePage },
    { id: 'strategy',    moduleId: 'M08', fkey: 'F5',  code: 'M08', label: 'Strategy Arbitrage',   icon: <Target size={14} />,          component: StrategyScreen },
    { id: 'proforma',    moduleId: 'M09', fkey: 'F6',  code: 'M09', label: 'Pro Forma Engine',     icon: <Calculator size={14} />,      component: ProformaScreen },
    { id: 'capital',     moduleId: 'M11', fkey: 'F7',  code: 'M11', label: 'Capital Structure',    icon: <DollarSign size={14} />,      component: CapitalStructureScreen },
    { id: 'risk',        moduleId: 'M14', fkey: 'F8',  code: 'M14', label: 'Risk Assessment',      icon: <Shield size={14} />,          component: RiskScreen },
    { id: 'competition', moduleId: 'M15', fkey: 'F9',  code: 'M15', label: 'Comps',                icon: <Target size={14} />,          component: CompetitionScreen },
    { id: 'traffic',     moduleId: 'M07', fkey: 'F10', code: 'M07', label: 'Traffic Intelligence', icon: <Activity size={14} />,        component: TrafficModule },
    { id: 'documents',   moduleId: 'M18', fkey: 'F11', code: 'M18', label: 'Documents',            icon: <HardHat size={14} />,         component: DocumentsScreen },
    { id: 'exit',        moduleId: 'M12', fkey: 'F12', code: 'M12', label: 'Exit Strategy',        icon: <Bot size={14} />,             component: ExitStrategyScreen },
  ];

  // Filter by deal-type visibility rules
  const dealScreens = allDealScreens.filter((s) => config.isModuleVisible(s.moduleId));


  const activeScreenData = dealScreens.find(s => s.id === activeTab) || dealScreens[0];
  const ActiveComponent = activeScreenData.component;

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

  const BG = '#0A0E17';
  const BG_CARD = '#0F1319';
  const BG_NAV = '#080C12';
  const BORDER = '#1e2a3d';
  const AMBER = '#F59E0B';
  const AMBER_L = '#FCD34D';
  const GREEN = '#10B981';
  const TEXT = '#E8E6E1';
  const TEXT_MID = '#9EA8B4';
  const TEXT_DIM = '#6B7585';
  const MONO = "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace";
  const SANS = "'IBM Plex Sans',-apple-system,sans-serif";

  return (
    <DealModuleProvider dealId={dealId || null} deal={deal} activeTab={activeTab} onTabChange={setActiveTab}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, marginBottom: -24, marginLeft: -24, marginRight: -24 }}>

        {/* ── F-Key Navigation Bar ── */}
        <div style={{
          background: BG_CARD, borderBottom: `1px solid ${BORDER}`,
          padding: '0 0 0 8px', flexShrink: 0, display: 'flex', alignItems: 'stretch', overflowX: 'auto',
        }}>
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            style={{ color: TEXT_DIM, background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer', padding: '0 10px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={13} />
          </button>
          {dealScreens.map(s => {
            const isActive = s.id === activeTab;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '8px 14px', border: 'none', cursor: 'pointer',
                  background: isActive ? `${AMBER}12` : 'transparent',
                  borderBottom: isActive ? `2px solid ${AMBER}` : '2px solid transparent',
                  borderTop: '2px solid transparent',
                  minWidth: 72, flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? AMBER_L : TEXT_DIM, letterSpacing: 1, fontFamily: MONO }}>
                  {s.fkey}
                </span>
                <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, color: isActive ? TEXT : TEXT_DIM, fontFamily: MONO, letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2 }}>
                  {s.label.split(' ').slice(0, 2).join(' ')}
                </span>
              </button>
            );
          })}
          {/* Right side: geographic scope + presence + module code */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 10, flexShrink: 0 }}>
            <GeographicScopeTabs
              activeScope={activeScope}
              onChange={setScope}
              tradeAreaEnabled={!!geographicStats?.trade_area}
              onDefineTradeArea={() => setShowTradeAreaPanel(true)}
              stats={geographicStats || {}}
              compact
            />
            {dealId && <PresenceIndicator dealId={dealId} currentModule={activeTab} />}
            <span style={{ fontSize: 9, color: TEXT_DIM, fontFamily: MONO, letterSpacing: 1 }}>
              {activeScreenData.code}
            </span>
          </div>
        </div>

        {showTradeAreaPanel && (() => {
          const centroid = getDealCentroid();
          const lat = centroid ? centroid[1] : 33.749;
          const lng = centroid ? centroid[0] : -84.388;
          return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-6">
              <div className="rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#E8E6E1]">Define Trade Area</h2>
                    <button
                      onClick={() => setShowTradeAreaPanel(false)}
                      className="text-[#6B7585] hover:text-[#9EA8B4] text-2xl leading-none"
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

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: BG }}>
              <ActiveComponent deal={deal} dealId={dealId} embedded={true} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} geographicContext={geographicContext} />
            </div>

            {showUnitMixCTA && (
              <div style={{
                flexShrink: 0, borderTop: `1px solid ${AMBER}40`,
                background: `linear-gradient(to right, ${AMBER}08, #8B5CF608)`,
                padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: AMBER, animation: 'pulse 2s infinite' }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: AMBER_L, fontFamily: MONO, margin: 0 }}>Development path selected</p>
                    <p style={{ fontSize: 10, color: TEXT_DIM, fontFamily: MONO, margin: 0 }}>
                      {developmentEnvelope.max_units} max units · {developmentEnvelope.max_gfa.toLocaleString()} sf GFA · binding: {developmentEnvelope.binding_constraint}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('market')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 18px', background: AMBER, color: '#0A0E17',
                    fontSize: 11, fontWeight: 700, fontFamily: MONO, letterSpacing: 1,
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}
                >
                  {ctaLabel}
                  <ArrowRight size={14} />
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
