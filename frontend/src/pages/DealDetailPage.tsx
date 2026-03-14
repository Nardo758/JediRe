import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3, DollarSign, FileText, Bot, TrendingUp,
  Building2, Target, Package, MapPin, Calculator,
  ClipboardCheck, Calendar, FolderOpen, Box,
  Search, ArrowLeft, Activity, LineChart,
  Lightbulb, StickyNote, Briefcase, LayoutDashboard,
  Compass, Landmark, Users, AlertTriangle, Leaf, HardHat,
  Shield, Layers, BarChart2, Radar, Zap
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';
import { apiClient } from '../services/api.client';
import { useDealStore, useDealTypeConfig } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { GeographicScopeTabs, TradeAreaDefinitionPanel } from '../components/trade-area';
import { isModuleVisible, type ModuleId } from '@/shared/config/deal-type-visibility';

import OverviewSection from '../components/deal/sections/OverviewSection';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';

import { MarketIntelligencePage } from './development/MarketIntelligencePage';
import CompetitionPage from './development/CompetitionPage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';
import { TrafficAnalysisSection } from '../components/deal/sections/TrafficAnalysisSection';

import RiskIntelligence from '../components/deal/sections/RiskIntelligence';
import OpportunityEngineSection from '../components/deal/sections/OpportunityEngineSection';
import { TrafficModule } from '../components/deal/sections/TrafficModule';
import { ProFormaTab } from '../components/deal/sections/ProFormaTab';
import { DebtTab } from '../components/deal/sections/DebtTab';
import FinancialDashboard from '../components/deal/sections/FinancialDashboard';

import { DueDiligencePage } from './development/DueDiligencePage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import { ProjectManagementSection } from '../components/deal/sections/ProjectManagementSection';

import { FilesSection } from '../components/deal/sections/FilesSection';

import OpusAISection from '../components/deal/sections/OpusAISection';
import { AIRecommendationsSection } from '../components/deal/sections/AIRecommendationsSection';
import { ContextTrackerSection } from '../components/deal/sections/ContextTrackerSection';
import { StrategySection } from '../components/deal/sections/StrategySection';
import { TeamSection } from '../components/deal/sections/TeamSection';
import { TeamManagementSection } from '../components/deal/sections/TeamManagementSection';
import { ConstructionManagementSection } from '../components/deal/sections/ConstructionManagementSection';

import TaxModule from '../components/deal/sections/TaxModule';
import CompsModule from '../components/deal/sections/CompsModule';
import CollisionAnalysisSection from '../components/deal/sections/CollisionAnalysisSection';
import UnitMixIntelligence from '../components/deal/sections/UnitMixIntelligence';
import { ZoningCapacitySection } from '../components/deal/sections/ZoningCapacitySection';
import { ZoningModuleSection } from '../components/deal/sections/ZoningModuleSection';
import { ZoningAgentChat } from '../components/zoning/ZoningAgentChat';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import type { DevelopmentPath } from '../types/zoning.types';


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

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchDealById } = useDealStore();
  const { activeScope, setScope, loadTradeAreaForDeal } = useTradeAreaStore();
  const config = useDealTypeConfig();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [geographicStats, setGeographicStats] = useState<any>(null);
  const [showTradeAreaPanel, setShowTradeAreaPanel] = useState(false);

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
      loadTradeAreaForDeal(dealId);
      fetchGeographicContext(dealId);
    }
  }, [dealId]);

  const fetchGeographicContext = async (id: string) => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${id}/geographic-context`) as any;
      const context = response?.data?.data;
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
      fetchDealById(id);
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
      const keyMap: { [key: string]: string } = {
        '1': 'overview',
        '2': 'market-intelligence',
        '3': '3d-design',
        '4': 'due-diligence',
        '5': 'timeline',
        '6': 'ai-agent',
      };
      if (keyMap[e.key]) {
        setActiveTab(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Stage 1: OVERVIEW & SETUP - Get oriented
  const overviewSetupTabs: Tab[] = [
    {
      id: 'overview',
      label: 'Deal Overview',
      icon: <BarChart3 size={16} />,
      component: OverviewSection,
      moduleId: 'M01'
    },
    {
      id: 'zoning',
      label: 'Property & Zoning',
      icon: <Landmark size={16} />,
      component: ZoningModuleSection,
      moduleId: 'M02'
    },
    {
      id: 'context-tracker',
      label: 'Context Tracker',
      icon: <Compass size={16} />,
      component: ContextTrackerSection
    },
    {
      id: 'team',
      label: 'Team & Collaborators',
      icon: <Users size={16} />,
      component: TeamManagementSection,
      moduleId: 'M17'
    },
  ];

  // Stage 2: MARKET RESEARCH - Validate opportunity
  const marketResearchTabs: Tab[] = [
    {
      id: 'market-intelligence',
      label: 'Market Intelligence',
      icon: <TrendingUp size={16} />,
      component: MarketIntelligencePage,
      moduleId: 'M05'
    },
    {
      id: 'unit-mix-intelligence',
      label: 'Unit Mix Intelligence',
      icon: <Layers size={16} />,
      component: UnitMixIntelligence
    },
    {
      id: 'competition',
      label: 'Competition Analysis',
      icon: <Target size={16} />,
      component: CompetitionPage,
      moduleId: 'M15'
    },
    {
      id: 'supply',
      label: 'Supply Pipeline',
      icon: <Package size={16} />,
      component: SupplyPipelinePage,
      moduleId: 'M04'
    },
    {
      id: 'opportunity-engine',
      label: 'Opportunity Engine',
      icon: <Zap size={16} />,
      component: OpportunityEngineSection,
      moduleId: 'M05'
    },
    {
      id: 'trends',
      label: 'Trends Analysis',
      icon: <LineChart size={16} />,
      component: TrendsAnalysisSection,
      moduleId: 'M05'
    },
    {
      id: 'comps',
      label: 'Sale Comps',
      icon: <Briefcase size={16} />,
      component: CompsModule
    },
  ];

  // Stage 3: DEAL DESIGN - Create the deal
  // Pipeline: Strategy → Traffic Module → Pro Forma → Debt, Equity & Exit → Financial Dashboard
  // Note: 3D Design (M03) tab has moduleId and will be filtered based on deal type
  const dealDesignTabs: Tab[] = [
    {
      id: '3d-design',
      label: '3D Building Design',
      icon: <Box size={16} />,
      component: Design3DPageEnhanced,
      moduleId: 'M03'
    },
    {
      id: 'strategy',
      label: 'Strategy',
      icon: <Target size={16} />,
      component: StrategySection,
      moduleId: 'M08'
    },
    {
      id: 'traffic-module',
      label: 'Traffic Module',
      icon: <Activity size={16} />,
      component: TrafficModule,
      moduleId: 'M07'
    },
    {
      id: 'proforma',
      label: 'Pro Forma',
      icon: <Layers size={16} />,
      component: ProFormaTab,
      moduleId: 'M09'
    },
    {
      id: 'tax',
      label: 'Tax Intelligence',
      icon: <Calculator size={16} />,
      component: TaxModule
    },
    {
      id: 'debt',
      label: 'Debt, Equity & Exit',
      icon: <DollarSign size={16} />,
      component: DebtTab,
      moduleId: 'M11'
    },
    {
      id: 'financial-dashboard',
      label: 'Financial Dashboard',
      icon: <BarChart3 size={16} />,
      component: FinancialDashboard
    },
  ];

  // Stage 4: DUE DILIGENCE - Verify & validate
  const dueDiligenceTabs: Tab[] = [
    {
      id: 'collision-analysis',
      label: 'Collision Analysis',
      icon: <Zap size={16} />,
      component: CollisionAnalysisSection
    },
    {
      id: 'due-diligence',
      label: 'DD Checklist',
      icon: <ClipboardCheck size={16} />,
      component: DueDiligencePage,
      moduleId: 'M13'
    },
    {
      id: 'deal-status',
      label: 'Deal Lifecycle',
      icon: <LayoutDashboard size={16} />,
      component: DealStatusSection
    },
    {
      id: 'risk-intelligence',
      label: 'Risk Intelligence',
      icon: <Shield size={16} />,
      component: RiskIntelligence,
      moduleId: 'M14'
    },
    {
      id: 'files',
      label: 'Files & Assets',
      icon: <FolderOpen size={16} />,
      component: FilesSection,
      moduleId: 'M18'
    },
  ];

  // Stage 5: EXECUTION - Build & deliver
  const executionTabs: Tab[] = [
    {
      id: 'timeline',
      label: 'Project Timeline',
      icon: <Calendar size={16} />,
      component: ProjectTimelinePage
    },
    {
      id: 'project-management',
      label: 'Project Management',
      icon: <Briefcase size={16} />,
      component: ProjectManagementSection,
      moduleId: 'M17'
    },
    {
      id: 'construction-management',
      label: 'Construction Management',
      icon: <HardHat size={16} />,
      component: ConstructionManagementSection
    },
  ];

  // Always Available: AI ASSISTANT
  const aiAssistantTabs: Tab[] = [
    {
      id: 'ai-agent',
      label: 'Opus AI Agent',
      icon: <Bot size={16} />,
      component: OpusAISection
    },
    {
      id: 'ai-recommendations',
      label: 'AI Recommendations',
      icon: <Lightbulb size={16} />,
      component: AIRecommendationsSection
    },
  ];

  // Filter tabs based on module visibility configuration
  const filtered = (tabs: Tab[]) => tabs.filter(t => !t.moduleId || isModuleVisible(t.moduleId as ModuleId, config.dealType));

  const allTabs = [
    ...filtered(overviewSetupTabs),
    ...filtered(marketResearchTabs),
    ...filtered(dealDesignTabs),
    ...filtered(dueDiligenceTabs),
    ...filtered(executionTabs),
    ...aiAssistantTabs,
  ];

  const activeTabData = allTabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component || OverviewSection;

  const filteredTabs = searchQuery
    ? allTabs.filter(tab => tab.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

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
                <nav className="flex-1">
                  <TabGroup
                    id="overview-setup"
                    title="OVERVIEW & SETUP"
                    icon={<LayoutDashboard size={18} />}
                    tabs={overviewSetupTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    defaultExpanded={true}
                  />
                  <TabGroup
                    id="market-research"
                    title="MARKET RESEARCH"
                    icon={<Search size={18} />}
                    tabs={marketResearchTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="deal-design"
                    title="DEAL DESIGN"
                    icon={<Box size={18} />}
                    tabs={dealDesignTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="due-diligence"
                    title="DUE DILIGENCE"
                    icon={<ClipboardCheck size={18} />}
                    tabs={dueDiligenceTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="execution"
                    title="EXECUTION"
                    icon={<Activity size={18} />}
                    tabs={executionTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="ai-assistant"
                    title="AI ASSISTANT"
                    icon={<Bot size={18} />}
                    tabs={aiAssistantTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                </nav>
              )}
            </div>

            <div className="mt-auto p-3 border-t border-slate-200">
              <div className="text-[10px] text-slate-400 text-center space-y-0.5">
                <p>Press 1-6 for quick stage access</p>
                <p className="text-slate-300">Deal Capsule | {allTabs.length} modules</p>
              </div>
            </div>
          </aside>

          <main className={`flex-1 min-w-0 min-h-0 ${activeTab === '3d-design' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-6 pr-6'}`}>
            <ActiveComponent deal={deal} dealId={dealId} embedded={true} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} />
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
