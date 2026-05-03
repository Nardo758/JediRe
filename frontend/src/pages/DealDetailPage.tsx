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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  DollarSign, Bot, TrendingUp,
  Building2, Target, Package, Calculator,
  ArrowLeft, ArrowRight, Activity, LayoutDashboard,
  Landmark, HardHat, Shield, Box, FileText, Briefcase,
  CheckCircle, X, Loader2, AlertTriangle, ChevronDown, HelpCircle,
} from 'lucide-react';
import { Tab } from '../components/deal/TabGroup';
import { DealScreenWrapper } from '../components/deal/DealScreenWrapper';
import { apiClient } from '../services/api.client';
import { useDealStore, useDealTypeConfig, useDealType } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { useTheme } from '../contexts/ThemeContext';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import type { DealType, ModuleId } from '../shared/config/deal-type-visibility';

import { BT, BT_CSS, PanelHeader, SectionPanel } from '../components/deal/bloomberg-ui';
import { BottomPanel } from '../components/layout/BottomPanel';
import { SkillsBar } from '../components/layout/SkillsBar';
import { BloombergOverviewSection } from '../components/deal/sections/BloombergOverviewSection';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { PresenceIndicator } from '../components/deal/PresenceIndicator';

import { MarketIntelligencePage } from './development/MarketIntelligencePage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';

import OpportunityEngineSection from '../components/deal/sections/OpportunityEngineSection';
import { TrafficModule } from '../components/deal/sections/TrafficModule';
import { ExitCapitalModule } from '../components/deal/sections/ExitCapitalModule';
import { InvestorCapitalModule } from '../components/deal/sections/InvestorCapitalModule';

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
import UnitMixIntelligence from '../components/deal/sections/UnitMixIntelligence';
import { ZoningModuleSection } from '../components/deal/sections/ZoningModuleSection';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import type { DevelopmentPath } from '../types/zoning.types';
import { EventHeroBanner } from '../components/m35/EventHeroBanner';
import type { HeroBannerEvent, EventSensitivity } from '../components/m35/EventHeroBanner';
import { useAutoContextAnalysis } from '../hooks/useContextAwareness';
import api from '../services/api';

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
const OverviewScreen = (props: ScreenProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <BloombergOverviewSection
          deal={props.deal}
          onTabChange={(tab) => props.onUpdate?.()}
          geographicContext={props.geographicContext as Record<string, unknown> | undefined}
          onUpdate={props.onUpdate}
        />
      </div>
    </div>
  );
};
const MarketScreen = (props: ScreenProps) => (
  <MarketIntelligencePage dealId={props.dealId} deal={props.deal} dealType={props.dealType} />
);
const StrategyScreen = (props: ScreenProps) => (
  <StrategyArbitragePage dealId={props.dealId} deal={props.deal as Record<string, unknown> | undefined} dealType={props.dealType} />
);
const ProFormaScreen = (props: ScreenProps) => (
  <DealScreenWrapper
    passProps={props}
    tabs={[
      {
        id: 'proforma',
        label: 'Pro Forma',
        component: (p: ScreenProps) => (
          <FinancialEnginePage
            dealId={p.dealId}
            deal={p.deal as Record<string, unknown> | undefined}
            dealType={p.dealType}
          />
        ),
      },
    ]}
  />
);
const PortfolioAssetBridge: React.FC<{ dealId: string; featureName: string }> = ({ dealId, featureName }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  dealId ? { context: 'deal_overview', dealId } : null
  );

  const nav = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-lg">
        <div className="text-4xl mb-3">🏢</div>
        <h3 className="text-lg font-semibold text-stone-800 mb-2">{featureName} — Managed in Portfolio Asset</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">
          For owned assets, <span className="font-medium text-stone-700">{featureName}</span> is consolidated
          in the Portfolio Asset page — your post-close operational hub.
        </p>
        <button
          onClick={() => nav(`/assets-owned/${dealId}/property`)}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded transition-colors"
        >
          Open Portfolio Asset Page →
        </button>
      </div>
    </div>
  );
};
const isOwnedDeal = (status?: string, pipelineStage?: string) =>
  ['owned', 'closed'].includes((status ?? '').toLowerCase()) ||
  ['closed', 'owned'].includes((pipelineStage ?? '').toLowerCase());

const DebtCapitalScreen = (props: ScreenProps) => (
  <DealScreenWrapper
    passProps={props}
    moduleTitle="DEBT & CAPITAL"
    moduleSubtitle="M11+M12 · EXIT STRATEGY + DEBT MARKET"
    moduleBorderColor={BT.text.cyan}
    moduleMetrics={[
      { l: 'RSS', c: BT.text.cyan },
      { l: 'IRR', c: BT.met.financial },
      { l: 'EXIT', c: BT.text.amber },
    ]}
    accentColor={BT.text.cyan}
    tabs={[
      { id: 'exit',     label: 'Exit & Debt Analysis',   component: (p: ScreenProps) => <ExitCapitalModule dealId={p.dealId} deal={p.deal} dealType={p.dealType} /> },
      { id: 'investors', label: 'Investor Capital',       component: (p: ScreenProps) => isOwnedDeal(p.deal?.status, p.deal?.pipeline_stage)
          ? <PortfolioAssetBridge dealId={p.dealId} featureName="Investor Capital" />
          : <InvestorCapitalModule dealId={p.dealId} deal={p.deal} /> },
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

const DEAL_TYPE_OPTIONS: { value: DealType; label: string; color: string }[] = [
  { value: 'existing',       label: 'EXISTING',       color: '#F5A623' },
  { value: 'development',    label: 'DEVELOPMENT',    color: '#10B981' },
  { value: 'redevelopment',  label: 'REDEVELOPMENT',  color: '#8B5CF6' },
];

const DealTypeBadge: React.FC<{
  current: DealType;
  onChange: (dt: DealType) => void;
  saving?: boolean;
}> = ({ current, onChange, saving }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opt = DEAL_TYPE_OPTIONS.find(o => o.value === current) || DEAL_TYPE_OPTIONS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => { if (!saving) setOpen(p => !p); }}
        disabled={saving}
        style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
          padding: '1px 6px', textTransform: 'uppercase',
          color: opt.color, border: `1px solid ${opt.color}44`,
          background: open ? `${opt.color}15` : 'transparent',
          cursor: saving ? 'wait' : 'pointer',
          fontFamily: "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace",
          display: 'flex', alignItems: 'center', gap: 4,
          opacity: saving ? 0.5 : 1,
          pointerEvents: saving ? 'none' : 'auto',
        }}
      >
        {opt.label}
        <span style={{ fontSize: 6, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 999,
          background: '#0F1319', border: '1px solid #1e2a3d',
          minWidth: 130, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {DEAL_TYPE_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 10px', border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace",
                fontSize: 9, fontWeight: o.value === current ? 700 : 500,
                letterSpacing: 0.6,
                color: o.value === current ? o.color : '#9EA8B4',
                background: o.value === current ? `${o.color}12` : 'transparent',
              }}
              onMouseEnter={e => { if (o.value !== current) e.currentTarget.style.background = '#1a2133'; }}
              onMouseLeave={e => { if (o.value !== current) e.currentTarget.style.background = 'transparent'; }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchDealContext } = useDealStore();
  // Neural network context awareness — drives the GAPS / CLOSE DEAL
  // header button rendered further down.
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    dealId ? { context: 'deal_overview', dealId } : null
  );
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
  const [savingDealType, setSavingDealType] = useState(false);
  const [bannerEvents, setBannerEvents] = useState<HeroBannerEvent[]>([]);
  const [eventSensitivity, setEventSensitivity] = useState<EventSensitivity>('LOW');
  const [eventConcentration, setEventConcentration] = useState<{topEventName:string;irrShare:number;isConcentrated:boolean}|null>(null);

  const [showCloseDealModal, setShowCloseDealModal] = useState(false);
  const [closingDeal, setClosingDeal] = useState(false);
  const [closeDealSuccess, setCloseDealSuccess] = useState(false);
  const [gapsDropdownOpen, setGapsDropdownOpen] = useState(false);
  const [gapsDropdownPos, setGapsDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const gapsButtonRef = useRef<HTMLButtonElement>(null);
  const gapsDropdownRef = useRef<HTMLDivElement>(null);
  const recomputeGapsDropdownPos = useCallback(() => {
    if (!gapsButtonRef.current) return;
    const rect = gapsButtonRef.current.getBoundingClientRect();
    setGapsDropdownPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);
  useEffect(() => {
    if (!gapsDropdownOpen) return;
    recomputeGapsDropdownPos();
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = gapsButtonRef.current?.contains(target);
      const insideDropdown = gapsDropdownRef.current?.contains(target);
      if (!insideButton && !insideDropdown) {
        setGapsDropdownOpen(false);
      }
    };
    const onResize = () => recomputeGapsDropdownPos();
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [gapsDropdownOpen, recomputeGapsDropdownPos]);
  // Reset dropdown state when navigating between deals so a stale-open
  // dropdown can't bleed into a freshly loaded deal.
  useEffect(() => {
    setGapsDropdownOpen(false);
  }, [dealId]);
  const [closeForm, setCloseForm] = useState({
    closingDate: new Date().toISOString().slice(0, 10),
    salePrice: '',
    totalEquityInvested: '',
    trailingNoi: '',
    totalDistributions: '0',
    buyerName: '',
    dispositionNotes: '',
  });

  const handleDealTypeChange = useCallback(async (newType: DealType) => {
    if (!dealId || newType === dealType) return;
    setSavingDealType(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}`, { project_type: newType });
      setDeal((prev: any) => prev ? { ...prev, project_type: newType, projectType: newType } : prev);
      await fetchDealContext(dealId);
    } catch (err) {
      console.error('[DealType] Failed to update:', err);
    } finally {
      setSavingDealType(false);
    }
  }, [dealId, dealType, fetchDealContext]);

  const handleCloseDealSubmit = useCallback(async () => {
    if (!dealId) return;
    const salePrice = parseFloat(closeForm.salePrice);
    const totalEquityInvested = parseFloat(closeForm.totalEquityInvested);
    const trailingNoi = parseFloat(closeForm.trailingNoi || '0');
    const totalDistributions = parseFloat(closeForm.totalDistributions || '0');
    if (!closeForm.closingDate || isNaN(salePrice) || isNaN(totalEquityInvested)) return;
    const netSaleProceeds = salePrice * 0.97;
    const actualEquityMultiple = totalEquityInvested > 0
      ? (netSaleProceeds + totalDistributions) / totalEquityInvested
      : 0;
    setClosingDeal(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}`, {
        status: 'owned',
      });
      await apiClient.post(`/api/v1/lifecycle/${dealId}/disposition`, {
        closingDate: closeForm.closingDate,
        salePrice,
        totalEquityInvested,
        trailingNoi,
        totalDistributions,
        netSaleProceeds,
        actualIrr: 0,
        actualEquityMultiple,
        buyerName: closeForm.buyerName || undefined,
        dispositionNotes: closeForm.dispositionNotes || undefined,
      });
      setDeal((prev: any) => prev ? { ...prev, status: 'owned' } : prev);
      setCloseDealSuccess(true);
      setTimeout(() => {
        setShowCloseDealModal(false);
        setCloseDealSuccess(false);
      }, 2200);
    } catch (err) {
      console.error('[CloseDeal] Failed:', err);
    } finally {
      setClosingDeal(false);
    }
  }, [dealId, closeForm]);
  
  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
      fetchGeographicContext(dealId);
      // Fetch events context for banner
      const token = localStorage.getItem('auth_token') || '';
      fetch(`/api/v1/m35/deals/${dealId}/events-context`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(ctx => {
          if (!ctx) return;
          const mapped: HeroBannerEvent[] = (ctx.events || []).map((e: any) => ({
            id: e.id, name: e.name, category: e.category || 'EMPLOYMENT',
            scope: e.scope || 'msa', magnitudeScore: Number(e.magnitude_score ?? 2), status: e.status || 'announced',
          }));
          setBannerEvents(mapped);
          setEventSensitivity(ctx.sensitivity || 'LOW');
          setEventConcentration(ctx.concentration ?? null);
        })
        .catch(() => {});
    }
  // hook intentionally omits fetchGeographicContext, loadDeal — they're inline functions recreated each render; including them would cause an infinite re-fetch loop. The functions close over the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const FALLBACK_DEALS: Record<string, Record<string, unknown>> = {
    "8aa4c42a-9f1f-47ba-b9d4-9def37b0b323":{id:"8aa4c42a-9f1f-47ba-b9d4-9def37b0b323",property_name:"Jaguar Redevelopment",name:"Jaguar Redevelopment",address:"915 S Dixie Hwy, West Palm Beach FL 33401",market:"West Palm Beach, FL",project_type:"development",asset_type:"Mixed Use",unit_count:280,pipeline_stage:"DD",ask_price:72000000,jedi_adjusted_irr:19.6,ai_opportunity_score:84,best_strategy:"build_to_sell"},
    "ab17f229-8b9e-4628-8126-76729ef1e2ee":{id:"ab17f229-8b9e-4628-8126-76729ef1e2ee",property_name:"Inman Park Multifamily",name:"Inman Park Multifamily",address:"760 Edgewood Ave NE, Atlanta GA 30307",market:"Atlanta, GA",project_type:"development",asset_type:"Multifamily",unit_count:196,pipeline_stage:"LOI",ask_price:48000000,jedi_adjusted_irr:17.2,ai_opportunity_score:78,best_strategy:"build_to_sell"},
    "6d6861b9-0e5f-4076-bfcb-3a859e8cdee8":{id:"6d6861b9-0e5f-4076-bfcb-3a859e8cdee8",property_name:"Westside Retail Center",name:"Westside Retail Center",address:"1460 Ellsworth Industrial Blvd, Atlanta GA 30318",market:"Atlanta, GA",project_type:"redevelopment",asset_type:"Retail",unit_count:144,pipeline_stage:"LOI",ask_price:36000000,jedi_adjusted_irr:15.8,ai_opportunity_score:72,best_strategy:"value_add"},
    "5ef5c201-afbb-4c43-9d7b-9c160fb34d18":{id:"5ef5c201-afbb-4c43-9d7b-9c160fb34d18",property_name:"Grant Park Adaptive Reuse",name:"Grant Park Adaptive Reuse",address:"680 Cherokee Ave SE, Atlanta GA 30312",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:110,pipeline_stage:"DD",ask_price:28600000,jedi_adjusted_irr:14.5,ai_opportunity_score:69,best_strategy:"value_add"},
    "4f6115a8-499f-426b-a3f0-b1c988cf8d02":{id:"4f6115a8-499f-426b-a3f0-b1c988cf8d02",property_name:"East Atlanta Village Townhomes",name:"East Atlanta Village Townhomes",address:"1245 Flat Shoals Ave, Atlanta GA 30316",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:64,pipeline_stage:"Prospect",ask_price:17900000,jedi_adjusted_irr:13.4,ai_opportunity_score:65,best_strategy:"build_to_sell"},
    "fcaa546f-f082-432d-85b5-eb496ebd435b":{id:"fcaa546f-f082-432d-85b5-eb496ebd435b",property_name:"Decatur Station Mixed-Use",name:"Decatur Station Mixed-Use",address:"315 W Ponce de Leon Ave, Decatur GA 30030",market:"Atlanta, GA",project_type:"existing",asset_type:"Mixed Use",unit_count:128,pipeline_stage:"Prospect",ask_price:33300000,jedi_adjusted_irr:12.1,ai_opportunity_score:61,best_strategy:"core_plus"},
    "93287781-255f-454b-950f-1eefa4c8ec55":{id:"93287781-255f-454b-950f-1eefa4c8ec55",property_name:"Reynoldstown Industrial Flip",name:"Reynoldstown Industrial Flip",address:"960 Memorial Dr SE, Atlanta GA 30316",market:"Atlanta, GA",project_type:"existing",asset_type:"Industrial",unit_count:48,pipeline_stage:"Lead",ask_price:8600000,jedi_adjusted_irr:11.0,ai_opportunity_score:56,best_strategy:"str"},
    "eaabeb9f-830e-44f9-a923-56679ad0329d":{id:"eaabeb9f-830e-44f9-a923-56679ad0329d",property_name:"Highlands at Sweetwater Creek",name:"Highlands at Sweetwater Creek",address:"2789 Satellite Blvd, Duluth GA 30096",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:290,pipeline_stage:"Owned",noi:4350000,actual_occupancy:93.8,jedi_adjusted_irr:14.8,ai_opportunity_score:88},
    "ssc-suwanee":{id:"ssc-suwanee",property_name:"Symphony at Suwanee Creek",name:"Symphony at Suwanee Creek",address:"3100 Lawrenceville-Suwanee Rd, Suwanee GA 30024",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:200,pipeline_stage:"Owned",noi:2980000,actual_occupancy:94.5,jedi_adjusted_irr:15.1},
    "5d738adc-c4fe-42e9-986b-112e5fb550a8":{id:"5d738adc-c4fe-42e9-986b-112e5fb550a8",property_name:"Buckhead Luxury Apartments",name:"Buckhead Luxury Apartments",address:"3344 Peachtree Rd NE, Atlanta GA 30326",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:210,pipeline_stage:"Owned",noi:4020000,actual_occupancy:91.2,jedi_adjusted_irr:12.4},
    "7235a6f9-c7dc-400e-a982-b89e335dccdf":{id:"7235a6f9-c7dc-400e-a982-b89e335dccdf",property_name:"Midtown Tower",name:"Midtown Tower",address:"1000 Peachtree St NE, Atlanta GA 30309",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:180,pipeline_stage:"Owned",noi:3100000,actual_occupancy:89.5,jedi_adjusted_irr:11.6},
    "9ee2bc0c-a5a2-4fed-930b-12c81040a2b2":{id:"9ee2bc0c-a5a2-4fed-930b-12c81040a2b2",property_name:"Alpharetta Retail Center",name:"Alpharetta Retail Center",address:"2200 Old Milton Pkwy, Alpharetta GA 30009",market:"Atlanta, GA",project_type:"existing",asset_type:"Retail",unit_count:42,pipeline_stage:"Owned",noi:1850000,actual_occupancy:96.2,jedi_adjusted_irr:13.2},
    "8205a985-cd17-4339-a6a4-efb57ce78b08":{id:"8205a985-cd17-4339-a6a4-efb57ce78b08",property_name:"Westside Lofts",name:"Westside Lofts",address:"750 Huff Rd NW, Atlanta GA 30318",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:156,pipeline_stage:"Owned",noi:2680000,actual_occupancy:95.0,jedi_adjusted_irr:14.3},
    "fb46a388-f3b8-44bd-ad12-7ed3250079a2":{id:"fb46a388-f3b8-44bd-ad12-7ed3250079a2",property_name:"College Park Workforce Housing",name:"College Park Workforce Housing",address:"3400 Camp Creek Pkwy, College Park GA 30349",market:"Atlanta, GA",project_type:"existing",asset_type:"Multifamily",unit_count:240,pipeline_stage:"Owned",noi:3200000,actual_occupancy:90.8,jedi_adjusted_irr:10.9},
    "451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7":{id:"451d65eb-8c19-4a04-bbbd-eca4c2d2e9f7",property_name:"Sandy Springs Office Park",name:"Sandy Springs Office Park",address:"5555 Roswell Rd, Sandy Springs GA 30342",market:"Atlanta, GA",project_type:"existing",asset_type:"Office",unit_count:68,pipeline_stage:"Owned",noi:2100000,actual_occupancy:87.3,jedi_adjusted_irr:11.0},
    "1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d":{id:"1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d",property_name:"Buckhead Mixed-Use Development",name:"Buckhead Mixed-Use Development",address:"Buckhead, Atlanta GA",market:"Atlanta, GA",project_type:"existing",asset_type:"Mixed Use",unit_count:175,pipeline_stage:"Owned",noi:3450000,actual_occupancy:90.1,jedi_adjusted_irr:12.0},
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
      const fallback = FALLBACK_DEALS[id];
      if (fallback) {
        setDeal(fallback);
      }
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
        F5: 'strategy',   F6: 'traffic',   F7: 'design-3d',
        F8: 'capital',    F9: 'proforma',  F10: 'risk',
        F11: 'deal-tools', F12: 'events',
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
    { id: 'capital',     moduleId: 'M11', fkey: 'F8',  code: 'M11', short: 'DEBT/CAP',   label: 'Debt & Capital',   icon: <DollarSign size={14} />,      component: DebtCapitalScreen },
    { id: 'proforma',    moduleId: 'M08', fkey: 'F9',  code: 'M08', short: 'PRO FORMA',  label: 'Financial Engine', icon: <Calculator size={14} />,      component: ProFormaScreen },
    { id: 'risk',        moduleId: 'M13', fkey: 'F10', code: 'M13', short: 'RISK',       label: 'Risk',             icon: <Shield size={14} />,          component: RiskScreen },
    { id: 'deal-tools',  moduleId: 'M21', fkey: 'F11', code: 'M21', short: 'TOOLS',      label: 'Deal Tools',       icon: <Briefcase size={14} />,       component: DealToolsScreen },
  ];

  const dealScreens = allDealScreens.filter((s) => config.isModuleVisible(s.moduleId));

  useEffect(() => {
    if (dealScreens.length > 0 && !dealScreens.find(s => s.id === activeTab)) {
      setActiveTab(dealScreens[0].id);
    }
  // hook intentionally captures dealScreens via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealType, activeTab]);

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
          onClick={() => navigate('/terminal/pipeline')}
          className="px-4 py-2 transition-colors text-sm font-medium"
          style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
        >
          Back to Pipeline
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>

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
                  <DealTypeBadge current={dealType} onChange={handleDealTypeChange} saving={savingDealType} />
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
              {deal && isOwnedDeal(deal.status, deal.pipeline_stage) && (
                <>
                  <span style={{ color: BORDER, margin: '0 8px', fontSize: 10 }}>│</span>
                  <button
                    onClick={() => navigate(`/assets-owned/${dealId}/property`)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #F5A62355',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      fontFamily: MONO,
                      fontSize: 9,
                      fontWeight: 800,
                      color: AMBER,
                      letterSpacing: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = AMBER;
                      e.currentTarget.style.background = `${AMBER}10`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = `${AMBER}55`;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    ▶ PORTFOLIO ASSET PAGE
                  </button>
                </>
              )}
              {(() => {
                const gaps = contextAnalysis?.gaps ?? [];
                const unanswered = (contextAnalysis?.immediateQuestions ?? []).filter(q => !q.available);
                const criticalGaps = gaps.filter(g => g.relevance === 'critical');
                const totalGapCount = gaps.length + unanswered.length;
                const hasGaps = totalGapCount > 0;
                const isClosable = deal && !isOwnedDeal(deal.status, deal.pipeline_stage);

                if (contextLoading && !contextAnalysis) {
                  return null;
                }

                if (hasGaps) {
                  const accent = criticalGaps.length > 0 ? '#EF4444' : '#F59E0B';
                  return (
                    <>
                      <span style={{ color: BORDER, margin: '0 8px', fontSize: 10 }}>│</span>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          ref={gapsButtonRef}
                          onClick={() => setGapsDropdownOpen(o => !o)}
                          title="Click to see what's missing for underwriting"
                          style={{
                            background: 'transparent',
                            border: `1px solid ${accent}55`,
                            cursor: 'pointer',
                            padding: '2px 8px',
                            fontFamily: MONO,
                            fontSize: 9,
                            fontWeight: 800,
                            color: accent,
                            letterSpacing: 0.8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = accent;
                            e.currentTarget.style.background = `${accent}10`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = `${accent}55`;
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <AlertTriangle size={10} />
                          {totalGapCount} {totalGapCount === 1 ? 'GAP' : 'GAPS'}
                          <ChevronDown size={10} style={{ transform: gapsDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>
                        {gapsDropdownOpen && gapsDropdownPos && (
                          <div ref={gapsDropdownRef} style={{
                            position: 'fixed',
                            top: gapsDropdownPos.top,
                            right: gapsDropdownPos.right,
                            zIndex: 9999,
                            width: 360,
                            maxHeight: 420,
                            overflowY: 'auto',
                            background: '#0F1319',
                            border: `1px solid ${accent}55`,
                            borderTop: `2px solid ${accent}`,
                            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                            fontFamily: MONO,
                          }}>
                            <div style={{
                              padding: '8px 12px',
                              borderBottom: `1px solid ${BORDER}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 1 }}>
                                {criticalGaps.length > 0
                                  ? `${criticalGaps.length} CRITICAL · ${gaps.length - criticalGaps.length} OTHER · ${unanswered.length} UNANSWERED`
                                  : `${gaps.length} GAPS · ${unanswered.length} UNANSWERED`}
                              </span>
                              <button
                                onClick={() => setGapsDropdownOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7A8D', padding: 2 }}
                                title="Close"
                              >
                                <X size={11} />
                              </button>
                            </div>
                            {gaps.length > 0 && (
                              <div style={{ padding: '6px 0' }}>
                                <div style={{ padding: '4px 12px', fontSize: 8, color: '#6B7A8D', letterSpacing: 1, fontWeight: 700 }}>
                                  DATA GAPS
                                </div>
                                {gaps.slice(0, 12).map(g => {
                                  const tone = g.relevance === 'critical' ? '#EF4444' : g.relevance === 'important' ? '#F59E0B' : '#6B7A8D';
                                  return (
                                    <div key={g.id} style={{
                                      padding: '6px 12px',
                                      borderTop: `1px solid ${BORDER}40`,
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 8,
                                    }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone, flexShrink: 0, marginTop: 5 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 10, color: '#E5E7EB', fontWeight: 600, lineHeight: 1.3 }}>
                                          {g.userQuestion}
                                        </div>
                                        <div style={{ fontSize: 8, color: '#6B7A8D', marginTop: 2, letterSpacing: 0.5 }}>
                                          {g.entity.toUpperCase()} · {g.relevance.toUpperCase().replace('_', ' ')}
                                          {g.missingFields.length > 0 && ` · ${g.missingFields.slice(0, 3).join(', ')}`}
                                        </div>
                                        {g.suggestedAction && (
                                          <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3, fontStyle: 'italic', lineHeight: 1.3 }}>
                                            → {g.suggestedAction}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {unanswered.length > 0 && (
                              <div style={{ padding: '6px 0', borderTop: `1px solid ${BORDER}` }}>
                                <div style={{ padding: '4px 12px', fontSize: 8, color: '#6B7A8D', letterSpacing: 1, fontWeight: 700 }}>
                                  QUESTIONS WE CAN'T ANSWER
                                </div>
                                {unanswered.slice(0, 8).map((q, i) => (
                                  <div key={i} style={{
                                    padding: '6px 12px',
                                    borderTop: `1px solid ${BORDER}40`,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 8,
                                  }}>
                                    <HelpCircle size={10} color="#6B7A8D" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: 10, color: '#E5E7EB', lineHeight: 1.3 }}>{q.question}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ padding: '8px 12px', borderTop: `1px solid ${BORDER}`, background: '#060A12' }}>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post('/context/trigger-research', {
                                      gaps: criticalGaps.length > 0 ? criticalGaps : gaps,
                                      priority: 'background',
                                    });
                                    setGapsDropdownOpen(false);
                                  } catch (e) {}
                                }}
                                style={{
                                  width: '100%',
                                  background: `${accent}15`,
                                  border: `1px solid ${accent}55`,
                                  color: accent,
                                  fontFamily: MONO,
                                  fontSize: 9,
                                  fontWeight: 800,
                                  letterSpacing: 1,
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                }}
                              >
                                <Bot size={11} />
                                RESEARCH MISSING DATA
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                }

                if (isClosable) {
                  return (
                    <>
                      <span style={{ color: BORDER, margin: '0 8px', fontSize: 10 }}>│</span>
                      <button
                        onClick={() => setShowCloseDealModal(true)}
                        title="No data gaps · ready to underwrite and close"
                        style={{
                          background: 'transparent',
                          border: '1px solid #10B98155',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          fontFamily: MONO,
                          fontSize: 9,
                          fontWeight: 800,
                          color: '#10B981',
                          letterSpacing: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#10B981';
                          e.currentTarget.style.background = '#10B98110';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#10B98155';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        ✓ CLOSE DEAL
                      </button>
                    </>
                  );
                }

                return null;
              })()}
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

        {/* ── M35 Event Hero Banner (Touch 1 — renders when active events exist) ── */}
        <EventHeroBanner
          events={bannerEvents}
          sensitivity={eventSensitivity}
          concentration={eventConcentration}
          onViewTimeline={() => setActiveTab('events')}
        />

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
            onClick={() => {
              // navigate(-1) is a no-op when there's no prior history entry
              // (direct link, fresh tab, embedded iframe on the canvas).
              // Fall back to the pipeline list so the arrow always does
              // something visible.
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/pipeline');
              }
            }}
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

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: BG, padding: '0 8px' }}>
              {/* Data gap awareness now lives on the GAPS / CLOSE DEAL header button */}
              <ActiveComponent deal={deal} dealId={dealId} dealType={dealType} embedded={true} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} geographicContext={geographicContext} />
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

        {/* ── Bottom Panel + Skills Bar (shared with Terminal Dashboard) ── */}
        <BottomPanel />
        <SkillsBar />
      </div>

      {/* ── Close Deal Modal ── */}
      {showCloseDealModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget && !closingDeal) setShowCloseDealModal(false); }}
        >
          <div style={{
            background: '#0F1319',
            border: '1px solid #1e2a3d',
            borderTop: '2px solid #10B981',
            width: 480,
            maxWidth: '95vw',
            fontFamily: MONO,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid #1e2a3d',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', letterSpacing: 1.2 }}>
                  CLOSE DEAL — RECORD DISPOSITION
                </span>
              </div>
              {!closingDeal && (
                <button
                  onClick={() => setShowCloseDealModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7A8D', padding: 4 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {closeDealSuccess ? (
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <CheckCircle size={36} color="#10B981" />
                <p style={{ color: '#10B981', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, margin: 0 }}>
                  DEAL CLOSED SUCCESSFULLY
                </p>
                <p style={{ color: '#6B7A8D', fontSize: 10, margin: 0 }}>
                  Disposition recorded · Portfolio updated · Learning loop triggered
                </p>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                <p style={{ color: '#6B7A8D', fontSize: 9, letterSpacing: 0.5, marginBottom: 18, marginTop: 0 }}>
                  DEAL: {deal?.name || deal?.address || dealId?.slice(0, 8).toUpperCase()}
                </p>

                {/* Form grid */}
                {([
                  { key: 'closingDate', label: 'CLOSING DATE', type: 'date', required: true, placeholder: '' },
                  { key: 'salePrice', label: 'SALE PRICE ($)', type: 'text', required: true, placeholder: 'e.g. 48500000' },
                  { key: 'totalEquityInvested', label: 'TOTAL EQUITY INVESTED ($)', type: 'text', required: true, placeholder: 'e.g. 12000000' },
                  { key: 'trailingNoi', label: 'TRAILING 12-MO NOI ($)', type: 'text', required: false, placeholder: 'e.g. 2800000' },
                  { key: 'totalDistributions', label: 'TOTAL DISTRIBUTIONS PAID ($)', type: 'text', required: false, placeholder: '0' },
                  { key: 'buyerName', label: 'BUYER NAME', type: 'text', required: false, placeholder: 'Optional' },
                ] as const).map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{
                      display: 'block', fontSize: 8, fontWeight: 700,
                      color: f.required ? '#9EA8B4' : '#6B7A8D',
                      letterSpacing: 0.8, marginBottom: 4,
                    }}>
                      {f.label}{f.required && <span style={{ color: '#10B981', marginLeft: 2 }}>*</span>}
                    </label>
                    <input
                      type={f.type}
                      value={closeForm[f.key as keyof typeof closeForm]}
                      onChange={e => setCloseForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#060A12', border: '1px solid #1e2a3d',
                        color: '#E2E8F0', fontFamily: MONO, fontSize: 11,
                        padding: '6px 10px', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: '#6B7A8D', letterSpacing: 0.8, marginBottom: 4 }}>
                    NOTES / LESSONS LEARNED
                  </label>
                  <textarea
                    value={closeForm.dispositionNotes}
                    onChange={e => setCloseForm(prev => ({ ...prev, dispositionNotes: e.target.value }))}
                    rows={3}
                    placeholder="Optional — what did this deal teach us?"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#060A12', border: '1px solid #1e2a3d',
                      color: '#E2E8F0', fontFamily: MONO, fontSize: 11,
                      padding: '6px 10px', outline: 'none', resize: 'vertical',
                      colorScheme: 'dark',
                    }}
                  />
                </div>

                {/* Computed preview */}
                {closeForm.salePrice && closeForm.totalEquityInvested && (
                  <div style={{
                    background: '#060A12', border: '1px solid #10B98122',
                    padding: '8px 12px', marginBottom: 16,
                    display: 'flex', gap: 24,
                  }}>
                    {(() => {
                      const sp = parseFloat(closeForm.salePrice) || 0;
                      const eq = parseFloat(closeForm.totalEquityInvested) || 0;
                      const dist = parseFloat(closeForm.totalDistributions) || 0;
                      const nsp = sp * 0.97;
                      const em = eq > 0 ? ((nsp + dist) / eq).toFixed(2) : '—';
                      return (
                        <>
                          <div>
                            <div style={{ fontSize: 8, color: '#6B7A8D', letterSpacing: 0.5 }}>NET PROCEEDS</div>
                            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
                              ${Math.round(nsp).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 8, color: '#6B7A8D', letterSpacing: 0.5 }}>EQUITY MULTIPLE</div>
                            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>{em}x</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowCloseDealModal(false)}
                    disabled={closingDeal}
                    style={{
                      padding: '7px 18px', background: 'transparent',
                      border: '1px solid #1e2a3d', color: '#6B7A8D',
                      fontFamily: MONO, fontSize: 10, fontWeight: 700,
                      letterSpacing: 0.6, cursor: 'pointer',
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleCloseDealSubmit}
                    disabled={closingDeal || !closeForm.closingDate || !closeForm.salePrice || !closeForm.totalEquityInvested}
                    style={{
                      padding: '7px 22px',
                      background: closingDeal ? '#0d3d2a' : '#10B981',
                      border: 'none', color: closingDeal ? '#10B981' : '#0A0E17',
                      fontFamily: MONO, fontSize: 10, fontWeight: 800,
                      letterSpacing: 0.6, cursor: closingDeal ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: (!closeForm.closingDate || !closeForm.salePrice || !closeForm.totalEquityInvested) ? 0.5 : 1,
                    }}
                  >
                    {closingDeal ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> CLOSING…</> : '✓ CONFIRM CLOSE'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DealModuleProvider>
  );
};

export default DealDetailPage;
