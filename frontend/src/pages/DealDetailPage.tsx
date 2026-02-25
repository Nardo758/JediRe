import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart3, DollarSign, FileText, Bot, TrendingUp,
  Building2, Target, Package, MapPin, CreditCard, Calculator,
  ClipboardCheck, Calendar, FolderOpen, Box, Car,
  LogOut, Search, ArrowLeft, Activity, LineChart,
  Lightbulb, StickyNote, Briefcase, LayoutDashboard,
  Compass, Landmark, Users, AlertTriangle, Leaf, HardHat, Coins,
  Shield, Layers, BarChart2, Radar
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';
import { apiClient } from '../services/api.client';
import { useDealStore } from '../stores/dealStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';
import { HorizontalBar } from '../components/map/HorizontalBar';

import OverviewSection from '../components/deal/sections/OverviewSection';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';

import { MarketAnalysisPage } from './development/MarketAnalysisPage';
import CompetitionPage from './development/CompetitionPage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';
import { TrafficAnalysisSection } from '../components/deal/sections/TrafficAnalysisSection';

import FinancialModelingSection from '../components/deal/sections/FinancialModelingSection';
import ProFormaIntelligence from '../components/deal/sections/ProFormaIntelligence';
import SupplyIntelligence from '../components/deal/sections/SupplyIntelligence';
import MarketIntelligence from '../components/deal/sections/MarketIntelligence';
import RiskIntelligence from '../components/deal/sections/RiskIntelligence';
import DebtSection from '../components/deal/sections/DebtSection';
import ExitSection from '../components/deal/sections/ExitSection';

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
import { RiskManagementSection } from '../components/deal/sections/RiskManagementSection';
import { EnvironmentalESGSection } from '../components/deal/sections/EnvironmentalESGSection';
import { CapitalEventsSection } from '../components/deal/sections/CapitalEventsSection';
import { ConstructionManagementSection } from '../components/deal/sections/ConstructionManagementSection';

import { SiteIntelligenceSection } from '../components/deal/sections/SiteIntelligenceSection';
import { ZoningCapacitySection } from '../components/deal/sections/ZoningCapacitySection';
import { ZoningModuleSection } from '../components/deal/sections/ZoningModuleSection';

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { fetchDealById } = useDealStore();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
    }
  }, [dealId]);

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
      component: OverviewSection 
    },
    { 
      id: 'zoning', 
      label: 'Property & Zoning', 
      icon: <Landmark size={16} />, 
      component: ZoningModuleSection 
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
      component: TeamManagementSection 
    },
  ];

  // Stage 2: MARKET RESEARCH - Validate opportunity
  const marketResearchTabs: Tab[] = [
    { 
      id: 'market-intelligence', 
      label: 'Market Intelligence', 
      icon: <TrendingUp size={16} />, 
      component: MarketAnalysisPage 
    },
    { 
      id: 'competition', 
      label: 'Competition Analysis', 
      icon: <Target size={16} />, 
      component: CompetitionPage 
    },
    {
      id: 'supply',
      label: 'Supply Pipeline',
      icon: <Package size={16} />,
      component: SupplyPipelinePage
    },
    {
      id: 'supply-intelligence',
      label: 'Supply Intelligence',
      icon: <Radar size={16} />,
      component: SupplyIntelligence
    },
    {
      id: 'market-vitals',
      label: 'Market Vitals',
      icon: <BarChart2 size={16} />,
      component: MarketIntelligence
    },
    { 
      id: 'trends', 
      label: 'Trends Analysis', 
      icon: <LineChart size={16} />, 
      component: TrendsAnalysisSection 
    },
    { 
      id: 'traffic', 
      label: 'Traffic Engine', 
      icon: <Car size={16} />, 
      component: TrafficAnalysisSection 
    },
  ];

  // Stage 3: DEAL DESIGN - Create the deal
  const dealDesignTabs: Tab[] = [
    { 
      id: '3d-design', 
      label: '3D Building Design', 
      icon: <Box size={16} />, 
      component: Design3DPageEnhanced 
    },
    { 
      id: 'strategy', 
      label: 'Strategy', 
      icon: <Target size={16} />, 
      component: StrategySection 
    },
    {
      id: 'financial-model',
      label: 'Financial Model',
      icon: <Calculator size={16} />,
      component: FinancialModelingSection
    },
    {
      id: 'proforma-intelligence',
      label: 'Pro Forma Intelligence',
      icon: <Layers size={16} />,
      component: ProFormaIntelligence
    },
    { 
      id: 'capital-events', 
      label: 'Capital Events', 
      icon: <Coins size={16} />, 
      component: CapitalEventsSection 
    },
    { 
      id: 'debt', 
      label: 'Debt & Financing', 
      icon: <CreditCard size={16} />, 
      component: DebtSection 
    },
    { 
      id: 'exit', 
      label: 'Exit Strategy', 
      icon: <LogOut size={16} />, 
      component: ExitSection 
    },
  ];

  // Stage 4: DUE DILIGENCE - Verify & validate
  const dueDiligenceTabs: Tab[] = [
    { 
      id: 'due-diligence', 
      label: 'DD Checklist', 
      icon: <ClipboardCheck size={16} />, 
      component: DueDiligencePage 
    },
    { 
      id: 'deal-status', 
      label: 'Deal Lifecycle', 
      icon: <LayoutDashboard size={16} />, 
      component: DealStatusSection 
    },
    {
      id: 'risk-management',
      label: 'Risk Management',
      icon: <AlertTriangle size={16} />,
      component: RiskManagementSection
    },
    {
      id: 'risk-intelligence',
      label: 'Risk Intelligence',
      icon: <Shield size={16} />,
      component: RiskIntelligence
    },
    { 
      id: 'environmental-esg', 
      label: 'Environmental & ESG', 
      icon: <Leaf size={16} />, 
      component: EnvironmentalESGSection 
    },
    { 
      id: 'site-intelligence', 
      label: 'Site Intelligence', 
      icon: <Activity size={16} />, 
      component: SiteIntelligenceSection 
    },
    { 
      id: 'files', 
      label: 'Files & Assets', 
      icon: <FolderOpen size={16} />, 
      component: FilesSection 
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
      component: ProjectManagementSection 
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

  const allTabs = [
    ...overviewSetupTabs,
    ...marketResearchTabs,
    ...dealDesignTabs,
    ...dueDiligenceTabs,
    ...executionTabs,
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
          Back to Deals
        </button>
      </div>
    );
  }

  return (
    <DealModuleProvider dealId={dealId || null} deal={deal} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="h-full flex flex-col bg-slate-50 -mb-6 -mx-6 -mr-10">
        <HorizontalBar />
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <button
            className="text-sm text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-1 transition-colors"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-900">{deal.name || 'Untitled Deal'}</h1>
            <span className="text-xs font-medium px-3 py-1 bg-slate-100 text-slate-600 rounded-full capitalize">
              {deal.project_type || deal.property_type || 'multifamily'}
            </span>
            {deal.status && (
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                deal.status === 'active' ? 'bg-green-100 text-green-700' :
                deal.status === 'closed' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {deal.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {(deal.address || deal.location) && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {deal.address || deal.location}
              </span>
            )}
            {deal.jedi_score && (
              <span className="flex items-center gap-1">
                <Activity size={14} />
                JEDI Score: {deal.jedi_score}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-w-0">
          <aside className="w-[260px] bg-white border-r border-slate-200 overflow-y-auto flex flex-col flex-shrink-0">
            <div className="p-3">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search modules..."
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
                <p>Press 1-6 for quick access</p>
                <p className="text-slate-300">6 stages | {allTabs.length} modules</p>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto p-6 pr-10">
            <ActiveComponent deal={deal} dealId={dealId} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} />
          </main>
        </div>
      </div>
    </DealModuleProvider>
  );
};

export default DealDetailPage;
