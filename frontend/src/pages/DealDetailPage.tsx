import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart3, DollarSign, FileText, Bot, TrendingUp,
  Building2, Target, Package, MapPin, CreditCard, Calculator,
  ClipboardCheck, Calendar, FolderOpen, Box, Car,
  LogOut, Search, ArrowLeft, Activity, LineChart,
  Lightbulb, StickyNote, Briefcase, LayoutDashboard,
  Compass, Landmark
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';
import { apiClient } from '../services/api.client';
import { useDealStore } from '../stores/dealStore';
import { DealModuleProvider } from '../contexts/DealModuleContext';

import OverviewSection from '../components/deal/sections/OverviewSection';
import { DealStatusSection } from '../components/deal/sections/DealStatusSection';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';

import { MarketAnalysisPage } from './development/MarketAnalysisPage';
import CompetitionPage from './development/CompetitionPage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { TrendsAnalysisSection } from '../components/deal/sections/TrendsAnalysisSection';
import { TrafficAnalysisSection } from '../components/deal/sections/TrafficAnalysisSection';

import FinancialModelingSection from '../components/deal/sections/FinancialModelingSection';
import DebtSection from '../components/deal/sections/DebtSection';
import ExitSection from '../components/deal/sections/ExitSection';

import { DueDiligencePage } from './development/DueDiligencePage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import { ProjectManagementSection } from '../components/deal/sections/ProjectManagementSection';

import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { FilesSection } from '../components/deal/sections/FilesSection';
import { NotesSection } from '../components/deal/sections/NotesSection';

import OpusAISection from '../components/deal/sections/OpusAISection';
import { AIRecommendationsSection } from '../components/deal/sections/AIRecommendationsSection';
import { ContextTrackerSection } from '../components/deal/sections/ContextTrackerSection';
import { ZoningEntitlementsSection } from '../components/deal/sections/ZoningEntitlementsSection';

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
      const response = await apiClient.get(`/api/v1/deals/${id}`);
      setDeal(response.data);
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
        '3': 'financial-model',
        '4': 'due-diligence',
        '5': 'files',
        '6': 'ai-agent',
      };
      if (keyMap[e.key]) {
        setActiveTab(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const dealStatusTabs: Tab[] = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: <BarChart3 size={16} />, 
      component: OverviewSection 
    },
    { 
      id: '3d-design', 
      label: '3D Building Design', 
      icon: <Box size={16} />, 
      component: Design3DPageEnhanced 
    },
    { 
      id: 'deal-status', 
      label: 'Deal Lifecycle', 
      icon: <LayoutDashboard size={16} />, 
      component: DealStatusSection 
    },
    { 
      id: 'context-tracker', 
      label: 'Context Tracker', 
      icon: <Compass size={16} />, 
      component: ContextTrackerSection 
    },
  ];

  const analysisTabs: Tab[] = [
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

  const financialTabs: Tab[] = [
    { 
      id: 'financial-model', 
      label: 'Financial Model', 
      icon: <Calculator size={16} />, 
      component: FinancialModelingSection 
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

  const operationsTabs: Tab[] = [
    { 
      id: 'due-diligence', 
      label: 'Due Diligence', 
      icon: <ClipboardCheck size={16} />, 
      component: DueDiligencePage 
    },
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
      id: 'zoning', 
      label: 'Zoning & Entitlements', 
      icon: <Landmark size={16} />, 
      component: ZoningEntitlementsSection 
    },
  ];

  const documentsTabs: Tab[] = [
    { 
      id: 'documents', 
      label: 'Documents', 
      icon: <FileText size={16} />, 
      component: DocumentsSection 
    },
    { 
      id: 'files', 
      label: 'Files & Assets', 
      icon: <FolderOpen size={16} />, 
      component: FilesSection 
    },
    { 
      id: 'notes', 
      label: 'Notes', 
      icon: <StickyNote size={16} />, 
      component: NotesSection 
    },
  ];

  const aiToolsTabs: Tab[] = [
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
    ...dealStatusTabs,
    ...analysisTabs,
    ...financialTabs,
    ...operationsTabs,
    ...documentsTabs,
    ...aiToolsTabs,
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
      <div className="h-full flex flex-col bg-slate-50">
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

        <div className="flex flex-1 overflow-hidden">
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
                    id="deal-status"
                    title="DEAL STATUS"
                    icon={<LayoutDashboard size={18} />}
                    tabs={dealStatusTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    defaultExpanded={true}
                  />
                  <TabGroup
                    id="analysis"
                    title="ANALYSIS"
                    icon={<BarChart3 size={18} />}
                    tabs={analysisTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="financial"
                    title="FINANCIAL"
                    icon={<DollarSign size={18} />}
                    tabs={financialTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="operations"
                    title="OPERATIONS"
                    icon={<ClipboardCheck size={18} />}
                    tabs={operationsTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="documents"
                    title="DOCUMENTS"
                    icon={<FileText size={18} />}
                    tabs={documentsTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <TabGroup
                    id="ai-tools"
                    title="AI TOOLS"
                    icon={<Bot size={18} />}
                    tabs={aiToolsTabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                </nav>
              )}
            </div>

            <div className="mt-auto p-3 border-t border-slate-200">
              <div className="text-[10px] text-slate-400 text-center space-y-0.5">
                <p>Press 1-6 to jump to groups</p>
                <p className="text-slate-300">6 groups | {allTabs.length} modules</p>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-6">
            <ActiveComponent deal={deal} onUpdate={() => dealId && loadDeal(dealId)} onBack={() => setActiveTab('overview')} />
          </main>
        </div>
      </div>
    </DealModuleProvider>
  );
};

export default DealDetailPage;
