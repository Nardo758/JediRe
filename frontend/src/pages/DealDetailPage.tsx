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
  ArrowLeft, ArrowRight, Activity, LayoutDashboard,
  Landmark, HardHat, Shield, Box, FileText, Briefcase,
} from 'lucide-react';
import { Tab } from '../components/deal/TabGroup';
import { DealScreenWrapper } from '../components/deal/DealScreenWrapper';
import { apiClient } from '../services/api.client';
import { useDealStore, useDealTypeConfig, useDealType } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { useTheme } from '../contexts/ThemeContext';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import type { ModuleId } from '../shared/config/deal-type-visibility';

import { BT, BT_CSS, PanelHeader, SectionPanel, Bd } from '../components/deal/bloomberg-ui';
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
import { DealToolsSection } from '../components/deal/sections/DealToolsSection';

import { FinancialEnginePage } from './development/FinancialEnginePage';
import { Design3DShellPage } from './development/Design3DShellPage';
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <BloombergOverviewSection
          deal={props.deal}
          onTabChange={(tab) => props.onUpdate?.()}
          geographicContext={props.geographicContext as Record<string, unknown> | undefined}
        />
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
const DealToolsScreen = (props: ScreenProps) => (
  <DealToolsSection dealId={props.dealId} deal={props.deal} />
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

const DealTopStatusBar: React.FC<{ dealName: string; isDark: boolean; onToggleTheme: () => void }> = ({ dealName, isDark, onToggleTheme }) => {
  const [clock, setClock] = React.useState('');
  React.useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      height: 28, background: '#050810', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 8px',
      borderBottom: '1px solid #1E2538', flexShrink: 0,
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace", fontSize: 9, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 800, color: '#F5A623', letterSpacing: 2, flexShrink: 0 }}>JediRE</span>
        <span style={{ fontSize: 9, color: '#4A5568', flexShrink: 0 }}>|</span>
        <span style={{ fontSize: 9, color: '#8B95A5', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>
          {dealName}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: '#00D26A', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00D26A', animation: 'glow 2s infinite' }} />
          5 AGT
        </span>
        <span style={{ fontSize: 9, color: '#00BCD4' }}>MAIL: 5</span>
        <span style={{ fontSize: 9, color: '#8B95A5' }}>
          KAFKA: <span style={{ color: '#E8ECF1', fontWeight: 600 }}>312/s</span>
        </span>
        <span style={{ fontSize: 9, color: '#8B95A5', flexShrink: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span style={{ fontSize: 9, color: '#F5A623', fontWeight: 700, letterSpacing: 1 }}>
          {clock}
        </span>
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace", fontSize: 12, background: 'transparent',
            border: '1px solid #1E2538', color: '#6B7A90',
            padding: '2px 8px', cursor: 'pointer', lineHeight: 1,
          }}
        >
          {isDark ? '☀' : '☾'}
        </button>
      </div>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}`}</style>
    </div>
  );
};

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchDealContext } = useDealStore();
  const config = useDealTypeConfig();
  const dealType = useDealType();
  const developmentEnvelope = useDealStore((s) => s.developmentEnvelope);
  const selectedDevelopmentPathId = useDealStore((s) => s.selectedDevelopmentPathId);
  const { activeScope, setScope, loadTradeAreaForDeal, setActiveTradeArea, setGeographicStats, geographicStats } = useTradeAreaStore();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [geographicContext, setGeographicContext] = useState<any>(null);
  const [showTradeAreaPanel, setShowTradeAreaPanel] = useState(false);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState('alerts');
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
        F9: 'capital',    F10: 'comps',    F11: 'execution',
        F12: 'risk',      F13: 'ai-agent',
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

  // ─── 13 FLAT SCREEN DEFINITIONS (F1–F13) ── Bloomberg station-logical order ──
  // F7 = 3D Design · F10 = Comps · F11 = Execution (Docs moved to Context Tracker)
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
    { id: 'risk',        moduleId: 'M13', fkey: 'F11', code: 'M13', short: 'RISK',       label: 'Risk',             icon: <Shield size={14} />,          component: RiskScreen },
    { id: 'deal-tools', moduleId: 'M21', fkey: 'F12', code: 'M21', short: 'TOOLS',      label: 'Deal Tools',       icon: <Briefcase size={14} />,       component: DealToolsScreen },
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

        {/* ── Bar 1: Top Status Bar (JEDI RE branding + context label + status metrics) ── */}
        <DealTopStatusBar dealName={deal?.name || deal?.address || 'DEAL'} isDark={isDark} onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')} />

        {/* ── Bar 2: Deal Context Bar (📍 name · address · JEDI score │ ▶ TRADE AREA │ SUBMARKET │ MSA) ── */}
        {deal && (
          <div style={{
            height: 28, background: BG_NAV, borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', padding: '0 10px', gap: 0,
            flexShrink: 0, fontFamily: MONO, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flex: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F5A623', flexShrink: 0, marginRight: 6 }} />
              {(deal.address || deal.location) && (
                <span style={{ color: TEXT_MID, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260, letterSpacing: 0.2 }}>
                  {deal.address || deal.location}
                </span>
              )}
              {dealType && (
                <>
                  <span style={{ color: BORDER, margin: '0 6px', fontSize: 9 }}>·</span>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, padding: '1px 6px', color: AMBER, border: `1px solid ${AMBER}44`, textTransform: 'uppercase', flexShrink: 0 }}>
                    {dealType}
                  </span>
                </>
              )}
              {deal.pipeline_stage && (
                <>
                  <span style={{ color: BORDER, margin: '0 6px', fontSize: 9 }}>·</span>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, padding: '1px 6px', color: GREEN, border: `1px solid ${GREEN}44`, textTransform: 'uppercase', flexShrink: 0 }}>
                    {deal.pipeline_stage}
                  </span>
                </>
              )}
              {deal.jedi_score != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 10 }}>
                  <span style={{ color: AMBER, fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>
                    JEDI {typeof deal.jedi_score === 'object' ? (deal.jedi_score as any)?.totalScore ?? '' : deal.jedi_score}
                  </span>
                  {deal.delta_30d != null && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: deal.delta_30d >= 0 ? GREEN : '#EF4444' }}>
                      {deal.delta_30d >= 0 ? '▲' : '▼'}{deal.delta_30d >= 0 ? '+' : ''}{deal.delta_30d}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => setShowTradeAreaPanel(true)}
                style={{
                  background: 'transparent', border: `1px solid ${AMBER}55`, cursor: 'pointer',
                  padding: '2px 8px', fontFamily: MONO,
                  fontSize: 9, fontWeight: 800, color: AMBER, letterSpacing: 0.8,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                ▶ TRADE AREA
              </button>

              {(() => {
                const fmtOcc = (v: unknown): string | null => {
                  if (v == null) return null;
                  const n = Number(v);
                  if (isNaN(n)) return null;
                  const pct = n > 1 ? n : n * 100;
                  return `${pct.toFixed(1)}%`;
                };
                const fmtRent = (v: unknown): string | null => {
                  if (v == null) return null;
                  const n = Number(v);
                  if (isNaN(n)) return null;
                  return `$${Math.round(n).toLocaleString()}`;
                };
                const smStats = (geographicStats as any)?.submarket;
                const msaStats = (geographicStats as any)?.msa;
                const smOcc = fmtOcc(smStats?.occupancy);
                const smRent = fmtRent(smStats?.avg_rent);
                const msaOcc = fmtOcc(msaStats?.occupancy);
                const msaRent = fmtRent(msaStats?.avg_rent);
                const pipe = <span style={{ color: BORDER, margin: '0 8px', fontSize: 10 }}>│</span>;
                return (
                  <>
                    {(smOcc || smRent) && (
                      <>
                        {pipe}
                        <span style={{ fontSize: 9, color: TEXT_MID, letterSpacing: 0.5, marginRight: 4 }}>SUBMARKET</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: TEXT, letterSpacing: 0.2 }}>
                          {[smOcc, smRent].filter(Boolean).join(' · ')}
                        </span>
                      </>
                    )}
                    {(msaOcc || msaRent) && (
                      <>
                        {pipe}
                        <span style={{ fontSize: 9, color: TEXT_MID, letterSpacing: 0.5, marginRight: 4 }}>MSA</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: TEXT, letterSpacing: 0.2 }}>
                          {[msaOcc, msaRent].filter(Boolean).join(' · ')}
                        </span>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

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

        {/* ── Bottom Panel (matches Terminal/Dashboard) ── */}
        {(() => {
          const alerts = [
            { id: 'a1', type: 'ARBITRAGE', sev: 'critical', msg: 'BTS outscores Rental by 22pts in current pipeline — rate environment favors construction exit', deal: 'Pipeline', time: '10m' },
            { id: 'a2', type: 'RISK', sev: 'high', msg: 'Insurance risk elevated on STR deals. FL wind zone + STR uncertainty compounding.', deal: null as string | null, time: '34m' },
            { id: 'a3', type: 'MARKET', sev: 'med', msg: 'Tampa MSA absorption exceeded 95% for 2nd consecutive month — supply constrained', deal: null as string | null, time: '1h' },
            { id: 'a4', type: 'DEADLINE', sev: 'high', msg: 'Review outstanding DD checklists — 3 items flagged past target date', deal: null as string | null, time: '2h' },
          ];
          const news = [
            { id: 'n1', time: '14:23', hl: 'Amazon announces 2,000-job Tampa HQ expansion', impact: '+DEMAND', pts: '+3.2', affects: ['Pipeline'] },
            { id: 'n2', time: '13:41', hl: 'Greystar breaks ground 380-unit tower Downtown Tampa', impact: '+SUPPLY', pts: '-1.8', affects: [] as string[] },
            { id: 'n3', time: '11:15', hl: 'FL Legislature passes insurance reform, 8% rate cap', impact: 'RISK DN', pts: '+1.2', affects: ['All FL'] },
            { id: 'n4', time: '09:32', hl: 'Nocatee named #2 top-selling MPC nationally', impact: '+DEMAND', pts: '+2.4', affects: [] as string[] },
          ];
          const emails = [
            { id: 1, from: 'Marcus Chen', subject: 'LOI countersigned — next steps', time: '2h', unread: true },
            { id: 2, from: 'Deal Engine', subject: 'Automated DD checklist reminder', time: '5h', unread: true },
            { id: 3, from: 'JP Morgan RE Debt', subject: 'Term sheet ready for review', time: '1d', unread: false },
          ];
          const agents = [
            { id: 'A01', name: 'Data Collector', st: 'ON', act: 'Scraping comps Apartments.com', t: '2s', m: 142 },
            { id: 'A03', name: 'Zoning Agent', st: 'ON', act: 'Parsing Municode setback rules', t: '8s', m: 38 },
            { id: 'A05', name: 'Market Analyst', st: 'ON', act: 'Updating absorption metrics', t: '34s', m: 87 },
            { id: 'A07', name: 'Risk Scorer', st: 'ON', act: 'Recalculating insurance risk scores', t: '1m', m: 64 },
            { id: 'A08', name: 'Strategy Engine', st: 'IDLE', act: 'Awaiting new intake', t: '4m', m: 23 },
            { id: 'A10', name: 'Orchestrator', st: 'ON', act: 'Coordinating DD checklist review', t: '12s', m: 312 },
          ];
          const tasks = [
            { id: 'T01', title: 'Schedule structural inspection', deal: 'Active Deal', pri: 'critical', due: 'Mar 20', status: 'TODO', owner: 'M.Dixon' },
            { id: 'T02', title: 'Wire earnest deposit', deal: 'Active Deal', pri: 'critical', due: 'Mar 19', status: 'TODO', owner: 'M.Dixon' },
            { id: 'T03', title: 'Review Phase I ESA report', deal: 'Pipeline', pri: 'high', due: 'Mar 22', status: 'IN PROGRESS', owner: 'S.Torres' },
            { id: 'T04', title: 'Update pro forma for rate change', deal: 'Pipeline', pri: 'high', due: 'Mar 23', status: 'TODO', owner: 'R.Patel' },
          ];
          const hAlerts = alerts.filter(a => a.sev === 'critical' || a.sev === 'high').length;
          const sevColor: Record<string, string> = { critical: '#EF4444', high: '#F97316', med: AMBER, low: TEXT_DIM };
          const statusColor: Record<string, string> = { 'TODO': TEXT_DIM, 'IN PROGRESS': '#00BCD4', 'DONE': GREEN };
          const BOTTOM_TABS = [
            { id: 'alerts', l: 'ALERTS', ct: hAlerts, cc: '#EF4444' },
            { id: 'news', l: 'NEWS', ct: news.length, cc: '#00BCD4' },
            { id: 'email', l: 'EMAIL', ct: emails.filter(e => e.unread).length, cc: '#F97316' },
            { id: 'agents', l: 'AGENTS', ct: agents.filter(a => a.st === 'ON').length, cc: GREEN },
            { id: 'tasks', l: 'TASKS', ct: tasks.filter(t => t.status !== 'DONE').length, cc: AMBER },
          ];
          return (
            <div style={{
              position: 'relative', height: bottomPanelOpen ? 190 : 28,
              borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column',
              flexShrink: 0, background: BG_NAV, transition: 'height 0.18s ease',
            }}>
              <div style={{
                display: 'flex', background: '#080C12',
                borderBottom: bottomPanelOpen ? `1px solid ${BORDER}` : 'none',
                flexShrink: 0, height: 28, alignItems: 'center',
              }}>
                <button
                  onClick={() => setBottomPanelOpen(o => !o)}
                  title={bottomPanelOpen ? 'Collapse panel' : 'Expand panel'}
                  style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, color: TEXT_DIM,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '0 8px', height: '100%', flexShrink: 0, lineHeight: 1,
                  }}
                >
                  {bottomPanelOpen ? '▼' : '▲'}
                </button>
                {BOTTOM_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setBottomTab(tab.id); if (!bottomPanelOpen) setBottomPanelOpen(true); }}
                    style={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 600,
                      color: bottomTab === tab.id ? BG_NAV : TEXT_MID,
                      background: bottomTab === tab.id ? AMBER : 'transparent',
                      border: 'none', cursor: 'pointer', padding: '0 14px', height: '100%',
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    }}
                  >
                    {tab.l}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 4px',
                      background: bottomTab === tab.id ? 'rgba(0,0,0,0.2)' : `${tab.cc}18`,
                      color: bottomTab === tab.id ? 'rgba(0,0,0,0.7)' : tab.cc,
                    }}>{tab.ct}</span>
                  </button>
                ))}
                <div style={{ flex: 1 }} />
              </div>
              {bottomPanelOpen && (
                <div style={{ flex: 1, overflow: 'auto', fontFamily: MONO }}>
                  {bottomTab === 'alerts' && alerts.map((a, i) => {
                    const bc = sevColor[a.sev] || TEXT_DIM;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 6, padding: '5px 10px', borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${bc}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                            <Bd c={bc}>{a.sev.toUpperCase()}</Bd>
                            <Bd c="#00BCD4">{a.type}</Bd>
                            {a.deal && <span style={{ fontSize: 9, color: AMBER, fontWeight: 600 }}>{a.deal}</span>}
                          </div>
                          <div style={{ fontSize: 9, color: TEXT, lineHeight: 1.3 }}>{a.msg}</div>
                        </div>
                        <span style={{ fontSize: 9, color: TEXT_DIM }}>{a.time}</span>
                      </div>
                    );
                  })}
                  {bottomTab === 'news' && news.map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, padding: '5px 10px', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 9, color: TEXT_DIM, minWidth: 34 }}>{n.time}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: TEXT, lineHeight: 1.3 }}>{n.hl}</div>
                        {n.affects.length > 0 && <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>{n.affects.map((a, j) => <Bd key={j} c={AMBER}>{a}</Bd>)}</div>}
                      </div>
                      <div style={{ textAlign: 'right' as const, minWidth: 50 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: n.impact.includes('+') ? GREEN : '#EF4444' }}>{n.impact}</div>
                        <div style={{ fontSize: 9, color: n.pts.startsWith('+') ? GREEN : '#EF4444' }}>{n.pts}</div>
                      </div>
                    </div>
                  ))}
                  {bottomTab === 'email' && emails.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, background: e.unread ? `${AMBER}06` : BG_NAV }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 1 }}>
                          <span style={{ fontSize: 9, fontWeight: e.unread ? 700 : 400, color: e.unread ? TEXT : TEXT_MID }}>{e.from}</span>
                          {e.unread && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />}
                        </div>
                        <div style={{ fontSize: 9, color: e.unread ? TEXT : TEXT_MID, fontWeight: e.unread ? 600 : 400, lineHeight: 1.3 }}>{e.subject}</div>
                      </div>
                      <span style={{ fontSize: 9, color: TEXT_DIM, whiteSpace: 'nowrap' }}>{e.time}</span>
                    </div>
                  ))}
                  {bottomTab === 'agents' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: BORDER }}>
                      {agents.map((a, i) => (
                        <div key={i} style={{ background: BG_NAV, padding: '5px 8px', borderLeft: a.st === 'ON' ? `2px solid ${GREEN}` : `2px solid ${TEXT_DIM}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6' }}>{a.id} <span style={{ color: TEXT }}>{a.name}</span></span>
                            <span style={{ fontSize: 9, color: a.st === 'ON' ? GREEN : TEXT_DIM }}>{a.st}</span>
                          </div>
                          <div style={{ fontSize: 9, color: TEXT_MID, lineHeight: 1.3 }}>{a.act}</div>
                          <div style={{ fontSize: 9, color: TEXT_DIM, marginTop: 1 }}>{a.t} ago · {a.m} msgs</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {bottomTab === 'tasks' && tasks.map((t, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px',
                      borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${sevColor[t.pri] || TEXT_DIM}`,
                      background: i % 2 === 0 ? BG_NAV : '#0A0E17', opacity: t.status === 'DONE' ? 0.5 : 1,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: t.status === 'DONE' ? TEXT_DIM : TEXT, textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>{t.title}</div>
                        <div style={{ marginTop: 2, display: 'flex', gap: 4 }}>
                          <Bd c={AMBER}>{t.deal}</Bd>
                          <Bd c={sevColor[t.pri] || TEXT_DIM}>{t.pri.toUpperCase()}</Bd>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: statusColor[t.status] || TEXT_DIM }}>{t.status}</div>
                        <div style={{ fontSize: 9, color: TEXT_DIM, marginTop: 1 }}>{t.due} · {t.owner}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </DealModuleProvider>
  );
};

export default DealDetailPage;
