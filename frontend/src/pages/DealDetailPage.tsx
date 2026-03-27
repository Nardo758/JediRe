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
  Landmark, HardHat, Shield, Box, FileText,
} from 'lucide-react';
import { Tab } from '../components/deal/TabGroup';
import { DealScreenWrapper } from '../components/deal/DealScreenWrapper';
import { apiClient } from '../services/api.client';
import { useDealStore, useDealTypeConfig, useDealType } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { useTheme } from '../contexts/ThemeContext';
import { GeographicScopeTabs, TradeAreaDefinitionPanel } from '../components/trade-area';
import type { ModuleId } from '../shared/config/deal-type-visibility';

import { BT, BT_CSS, PanelHeader, SectionPanel } from '../components/deal/bloomberg-ui';
import { BloombergOverviewSection } from '../components/deal/sections/BloombergOverviewSection';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { PresenceIndicator } from '../components/deal/PresenceIndicator';
import { ActivityFeed } from '../components/deal/ActivityFeed';
import { CommentThread } from '../components/deal/CommentThread';
import { DealTeamPanel } from '../components/deal/DealTeamPanel';

import { MarketIntelligencePage } from './development/MarketIntelligencePage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';

import OpportunityEngineSection from '../components/deal/sections/OpportunityEngineSection';
import { TrafficModule } from '../components/deal/sections/TrafficModule';
import { ExitCapitalModule } from '../components/deal/sections/ExitCapitalModule';

import { StrategyArbitragePage } from './development/StrategyArbitragePage';
import { RiskDDPage } from './development/RiskDDPage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import { ProjectManagementSection } from '../components/deal/sections/ProjectManagementSection';

import { FilesSection } from '../components/deal/sections/FilesSection';

import OpusAISection from '../components/deal/sections/OpusAISection';
import { AIRecommendationsSection } from '../components/deal/sections/AIRecommendationsSection';
import { ContextTrackerSection } from '../components/deal/sections/ContextTrackerSection';
import { TeamManagementSection } from '../components/deal/sections/TeamManagementSection';
import { ConstructionManagementSection } from '../components/deal/sections/ConstructionManagementSection';
import { NotarizeClosingSection } from '../components/deal/sections/NotarizeClosingSection';

import { FinancialEnginePage } from './development/FinancialEnginePage';
import { Design3DShellPage } from './development/Design3DShellPage';
import { DocumentsShellPage } from './development/DocumentsShellPage';
import { CompsShellPage } from './development/CompsShellPage';
import UnitMixIntelligence from '../components/deal/sections/UnitMixIntelligence';
import { ZoningModuleSection } from '../components/deal/sections/ZoningModuleSection';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import type { DevelopmentPath } from '../types/zoning.types';

interface DealTab extends Tab {
  moduleId?: ModuleId;
}

const DEV_PATH_CONFIG: Record<DevelopmentPath, { label: string; bg: string; color: string }> = {
  by_right: { label: 'By-Right', bg: BT.bg.active, color: BT.text.green },
  overlay_bonus: { label: 'Overlay Bonus', bg: BT.bg.active, color: BT.text.cyan },
  variance: { label: 'Variance', bg: BT.bg.active, color: BT.text.amber },
  rezone: { label: 'Full Rezone', bg: BT.bg.active, color: BT.text.red },
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
    <span className="text-xs font-medium px-3 py-1" style={{ borderRadius: 2, background: cfg.bg, color: cfg.color }}>
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
  if (!dId) return <div className="p-4 text-sm" style={{ color: BT.text.secondary }}>No deal selected</div>;
  return (
    <div className="p-4 space-y-4">
      <DealTeamPanel dealId={dId} />
      <CommentThread dealId={dId} />
      <ActivityFeed dealId={dId} />
    </div>
  );
};

const OverviewScreen = (props: ScreenProps) => {
  const [secondaryTab, setSecondaryTab] = React.useState<string | null>(null);
  const secondaryTabs = [
    { id: 'context',     label: 'Context Tracker', component: ContextTrackerSection },
    { id: 'team',        label: 'Team',            component: TeamManagementSection },
    { id: 'collaborate', label: 'Collaborate',      component: CollaborationSection },
    { id: 'deal-status', label: 'Deal Status',     component: DealStatusSection },
  ];
  const activeSecondary = secondaryTabs.find(t => t.id === secondaryTab);
  const SecondaryComp = activeSecondary?.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <BloombergOverviewSection
          deal={props.deal}
          onTabChange={(tab) => props.onUpdate?.()}
          geographicContext={props.geographicContext as Record<string, unknown> | undefined}
        />
      </div>
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #1e2a3d',
        background: '#0F1319',
      }}>
        <div style={{ display: 'flex', background: '#0a0e17', borderBottom: secondaryTab ? '1px solid #1e2a3d' : 'none' }}>
          {secondaryTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setSecondaryTab(secondaryTab === t.id ? null : t.id)}
              style={{
                fontFamily: "'JetBrains Mono','Fira Code',monospace",
                fontSize: 9, fontWeight: secondaryTab === t.id ? 700 : 500,
                padding: '5px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: secondaryTab === t.id ? '2px solid #F59E0B' : '2px solid transparent',
                color: secondaryTab === t.id ? '#FCD34D' : '#6B7585',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
                letterSpacing: 0.5,
                transition: 'color 0.1s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {SecondaryComp && secondaryTab && (
          <div style={{ maxHeight: 420, overflow: 'auto', background: '#0F1319' }}>
            <SecondaryComp {...props} />
          </div>
        )}
      </div>
    </div>
  );
};
const MarketScreen = (props: ScreenProps) => (
  <MarketIntelligencePage dealId={props.dealId} deal={props.deal} dealType={props.dealType} />
);
const CompsScreen = (props: ScreenProps) => (
  <CompsShellPage
    dealId={props.dealId}
    deal={props.deal}
    dealType={props.dealType}
    onUpdate={props.onUpdate}
  />
);
const StrategyScreen = (props: ScreenProps) => (
  <StrategyArbitragePage dealId={props.dealId} deal={props.deal as Record<string, unknown> | undefined} dealType={props.dealType} />
);
const ProFormaScreen = (props: ScreenProps) => (
  <FinancialEnginePage
    dealId={props.dealId}
    deal={props.deal as Record<string, unknown> | undefined}
    dealType={props.dealType}
  />
);
const DebtCapitalScreen = (props: ScreenProps) => (
  <DealScreenWrapper
    passProps={props}
    moduleTitle="DEBT & CAPITAL"
    moduleSubtitle="M12 · CAPITAL STACK + EXIT ANALYSIS"
    moduleBorderColor={BT.text.cyan}
    moduleMetrics={[
      { l: 'LTV', c: BT.text.cyan },
      { l: 'DSCR', c: BT.met.financial },
      { l: 'EXIT', c: BT.text.amber },
    ]}
    accentColor={BT.text.cyan}
    tabs={[
      { id: 'capital', label: 'Capital Structure', component: (p: ScreenProps) => <ExitCapitalModule dealId={p.dealId} deal={p.deal} dealType={p.dealType} initialTab="stack" /> },
      { id: 'exit',    label: 'Exit Analysis',     component: (p: ScreenProps) => <ExitCapitalModule dealId={p.dealId} deal={p.deal} dealType={p.dealType} initialTab="exit" /> },
    ]}
  />
);
const RiskScreen = (props: ScreenProps) => (
  <RiskDDPage dealId={props.dealId} deal={props.deal as Record<string, unknown> | undefined} dealType={props.dealType} />
);
const EXEC_TABS = [
  { id: 'timeline',           label: 'PROJECT TIMELINE',   title: 'PROJECT TIMELINE',   subtitle: 'M17 · MILESTONES + GANTT',        border: BT.text.cyan    },
  { id: 'project-management', label: 'PROJECT MANAGEMENT', title: 'PROJECT MANAGEMENT', subtitle: 'M17 · PM TASKS + ASSIGNMENTS',     border: BT.met.occupancy },
  { id: 'construction-mgmt',  label: 'CONSTRUCTION MGMT',  title: 'CONSTRUCTION MGMT',  subtitle: 'M17 · CONSTRUCTION MONITORING',   border: BT.text.amber   },
  { id: 'notarize-closing',   label: 'CLOSING (RON)',       title: 'NOTARIZE & CLOSE',   subtitle: 'M17 · REMOTE ONLINE NOTARIZATION', border: BT.met.financial },
  { id: 'opus-ai',            label: 'OPUS AI',             title: 'OPUS AI ASSISTANT',  subtitle: 'M17 · INTELLIGENT EXECUTION AID', border: BT.text.purple  },
] as const;
const EXEC_COMPONENTS: Record<string, React.ComponentType<ScreenProps>> = {
  timeline:           ProjectTimelinePage,
  'project-management': ProjectManagementSection,
  'construction-mgmt':  ConstructionManagementSection,
  'notarize-closing':   NotarizeClosingSection,
  'opus-ai':            OpusAISection,
};
const ExecutionScreen = (props: ScreenProps) => {
  const [active, setActive] = React.useState<string>(EXEC_TABS[0].id);
  const tab = EXEC_TABS.find(t => t.id === active) ?? EXEC_TABS[0];
  const C = EXEC_COMPONENTS[tab.id] as React.ComponentType<ScreenProps>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, animation: 'bt-fade 0.15s' }}>
      <PanelHeader
        title="EXECUTION"
        subtitle="M17 · CLOSE + MANAGE"
        borderColor={BT.text.cyan}
        metrics={[
          { l: 'TIMELINE', c: BT.text.cyan    },
          { l: 'PM',       c: BT.met.occupancy },
          { l: 'RON',      c: BT.met.financial },
          { l: 'OPUS',     c: BT.text.purple  },
        ]}
      />
      <div style={{ display: 'flex', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0, overflowX: 'auto', height: 28, alignItems: 'stretch' }}>
        {EXEC_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              fontFamily: BT.font.mono, fontSize: 9, fontWeight: active === t.id ? 700 : 500,
              padding: '0 14px', background: 'transparent', border: 'none',
              borderBottom: active === t.id ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
              color: active === t.id ? BT.text.cyan : BT.text.secondary,
              cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: 0.6,
            }}
          >{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: BT.bg.terminal }}>
        <SectionPanel title={tab.title} subtitle={tab.subtitle} borderColor={tab.border} style={{ minHeight: '100%' }}>
          <C {...props} />
        </SectionPanel>
      </div>
    </div>
  );
};
const Design3DScreen = (props: ScreenProps) => (
  <Design3DShellPage
    dealId={props.dealId}
    deal={props.deal}
    dealType={props.dealType}
  />
);
const DocumentsScreen = (props: ScreenProps) => (
  <DocumentsShellPage
    dealId={props.dealId}
    deal={props.deal}
    dealType={props.dealType}
  />
);
const AIAgentScreen = (props: ScreenProps) => (
  <DealScreenWrapper
    passProps={props}
    moduleTitle="AI AGENT"
    moduleSubtitle="M20 · OPUS + RECOMMENDATIONS"
    moduleBorderColor={BT.text.purple}
    moduleMetrics={[
      { l: 'OPUS', c: BT.text.purple },
      { l: 'AI', c: BT.text.cyan },
    ]}
    accentColor={BT.text.purple}
    tabs={[
      { id: 'opus-ai',  label: 'Opus AI Agent',     component: OpusAISection },
      { id: 'ai-recs',  label: 'AI Recommendations', component: AIRecommendationsSection },
    ]}
  />
);

const SupplyPipelineScreen = (props: ScreenProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, animation: 'bt-fade 0.15s' }}>
    <style>{BT_CSS}</style>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <SupplyPipelinePage {...props} />
    </div>
  </div>
);

const TrafficScreen = (props: ScreenProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, animation: 'bt-fade 0.15s' }}>
    <style>{BT_CSS}</style>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <TrafficModule {...props} />
    </div>
  </div>
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
  const { activeScope, setScope, loadTradeAreaForDeal, setActiveTradeArea, setGeographicStats } = useTradeAreaStore();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
        F1: 'overview',   F2: 'zoning',    F3: 'market',     F4: 'supply',
        F5: 'strategy',   F6: 'traffic',   F7: 'design-3d',  F8: 'proforma',
        F9: 'capital',    F10: 'comps',    F11: 'documents', F12: 'execution',
        F13: 'risk',      F14: 'ai-agent',
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
    const handleOpenTradeAreaPanel = () => setShowTradeAreaPanel(true);
    window.addEventListener('open-trade-area-panel', handleOpenTradeAreaPanel);
    return () => window.removeEventListener('open-trade-area-panel', handleOpenTradeAreaPanel);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('deal-active-tab', { detail: activeTab }));
  }, [activeTab]);

  // ─── 14 FLAT SCREEN DEFINITIONS (F1–F14) ── Bloomberg station-logical order ──
  // F7 = 3D Design · F10 = Comps · F11 = Documents · F12 = Execution
  const allDealScreens: { id: string; moduleId: ModuleId; fkey: string; code: string; short: string; label: string; icon: React.ReactNode; component: React.ComponentType<ScreenProps> }[] = [
    { id: 'overview',    moduleId: 'M01', fkey: 'F1',  code: 'M01', short: 'OVERVIEW',   label: 'Overview',         icon: <LayoutDashboard size={14} />, component: OverviewScreen },
    { id: 'zoning',      moduleId: 'M02', fkey: 'F2',  code: 'M02', short: 'ZONING',     label: 'Zoning',           icon: <Landmark size={14} />,        component: ZoningModuleSection },
    { id: 'market',      moduleId: 'M05', fkey: 'F3',  code: 'M05', short: 'MARKET',     label: 'Market Intel',     icon: <TrendingUp size={14} />,      component: MarketScreen },
    { id: 'supply',      moduleId: 'M04', fkey: 'F4',  code: 'M04', short: 'SUPPLY',     label: 'Supply Pipeline',  icon: <Package size={14} />,         component: SupplyPipelineScreen },
    { id: 'strategy',    moduleId: 'M08', fkey: 'F5',  code: 'M08', short: 'STRATEGY',   label: 'Strategy',         icon: <Target size={14} />,          component: StrategyScreen },
    { id: 'traffic',     moduleId: 'M07', fkey: 'F6',  code: 'M07', short: 'TRAFFIC',    label: 'Traffic Intel',    icon: <Activity size={14} />,        component: TrafficScreen },
    { id: 'design-3d',   moduleId: 'M03', fkey: 'F7',  code: 'M03', short: '3D DESIGN',  label: '3D Design',        icon: <Box size={14} />,             component: Design3DScreen },
    { id: 'proforma',    moduleId: 'M08', fkey: 'F8',  code: 'M08', short: 'PRO FORMA',  label: 'Financial Engine', icon: <Calculator size={14} />,      component: ProFormaScreen },
    { id: 'capital',     moduleId: 'M11', fkey: 'F9',  code: 'M11', short: 'DEBT/CAP',   label: 'Debt & Capital',   icon: <DollarSign size={14} />,      component: DebtCapitalScreen },
    { id: 'comps',       moduleId: 'M15', fkey: 'F10', code: 'M15', short: 'COMPS',      label: 'Comps',            icon: <Target size={14} />,          component: CompsScreen },
    { id: 'documents',   moduleId: 'M18', fkey: 'F11', code: 'M18', short: 'DOCS',       label: 'Documents',        icon: <FileText size={14} />,        component: DocumentsScreen },
    { id: 'execution',   moduleId: 'M17', fkey: 'F12', code: 'M17', short: 'EXECUTION',  label: 'Execution',        icon: <HardHat size={14} />,         component: ExecutionScreen },
    { id: 'risk',        moduleId: 'M13', fkey: 'F13', code: 'M13', short: 'RISK/DD',    label: 'Risk & DD',        icon: <Shield size={14} />,          component: RiskScreen },
    { id: 'ai-agent',    moduleId: 'M20', fkey: 'F14', code: 'M20', short: 'AI AGENT',   label: 'AI Agent',         icon: <Bot size={14} />,             component: AIAgentScreen },
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
          <div className="w-8 h-8 animate-spin" style={{ borderRadius: '50%', border: `2px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.cyan}` }} />
          <span className="text-sm" style={{ color: BT.text.secondary }}>Loading deal...</span>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-6xl" style={{ color: BT.text.muted }}>
          <Building2 size={64} />
        </div>
        <h2 className="text-xl font-semibold" style={{ color: BT.text.primary }}>Deal not found</h2>
        <p className="text-sm" style={{ color: BT.text.secondary }}>This deal may have been deleted or you don't have access.</p>
        <button
          onClick={() => navigate('/deals')}
          className="px-4 py-2 transition-colors text-sm font-medium"
          style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
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
  const AMBER = '#F5A623';
  const AMBER_L = '#FFD166';
  const GREEN = '#10B981';
  const TEXT = '#E8E6E1';
  const TEXT_MID = '#9EA8B4';
  const TEXT_DIM = '#6B7585';
  const MONO = "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace";
  const SANS = "'IBM Plex Sans',-apple-system,sans-serif";

  return (
    <DealModuleProvider dealId={dealId || null} deal={deal} activeTab={activeTab} onTabChange={setActiveTab}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>

        {/* ── Bloomberg-style F-Key Navigation Bar ── */}
        <div style={{
          background: BG_NAV,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          height: 32,
        }}>
          {/* Back arrow */}
          <button
            onClick={() => navigate(-1)}
            title="Go back"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, flexShrink: 0,
              background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`,
              cursor: 'pointer', color: TEXT_DIM,
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}
          >
            <ArrowLeft size={12} />
          </button>

          {/* F-key module buttons — Terminal single-line style */}
          {dealScreens.map((s) => {
            const isActive = s.id === activeTab;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600,
                  padding: '0 12px', height: 32,
                  cursor: 'pointer',
                  background: isActive ? AMBER : 'transparent',
                  color: isActive ? BG_NAV : TEXT_MID,
                  border: 'none',
                  display: 'flex', alignItems: 'center', gap: 5,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, color: isActive ? BG_NAV : TEXT_DIM }}>{s.fkey}</span>
                {s.short}
              </button>
            );
          })}

          {/* Right side: search */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            {/* Search bar */}
            <div style={{ display: 'flex', alignItems: 'center', borderLeft: `1px solid ${BORDER}`, height: '100%', padding: '0 10px' }}>
              <input
                type="text"
                placeholder="⌕  SEARCH DEAL..."
                style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 500,
                  background: '#0D1117', color: TEXT,
                  border: `1px solid ${BORDER}`,
                  padding: '3px 10px', width: 160, letterSpacing: 0.4,
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                onBlur={e => { e.currentTarget.style.borderColor = BORDER; }}
              />
            </div>
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', padding: '0 10px',
                background: 'transparent', border: 'none',
                borderLeft: `1px solid ${BORDER}`,
                cursor: 'pointer', fontSize: 12,
                color: TEXT_DIM,
              }}
            >
              {isDark ? '☀' : '☾'}
            </button>
            {/* Presence indicator */}
            <div style={{ display: 'flex', alignItems: 'center', borderLeft: `1px solid ${BORDER}`, height: '100%', paddingLeft: 10, paddingRight: 10 }}>
              {dealId && <PresenceIndicator dealId={dealId} currentModule={activeTab} />}
            </div>
          </div>
        </div>

        {showTradeAreaPanel && (() => {
          const centroid = getDealCentroid();
          const lat = centroid ? centroid[1] : 33.749;
          const lng = centroid ? centroid[0] : -84.388;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <div className="max-w-2xl w-full max-h-[85vh] overflow-y-auto" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
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
        </div>
      </div>
    </DealModuleProvider>
  );
};

export default DealDetailPage;
