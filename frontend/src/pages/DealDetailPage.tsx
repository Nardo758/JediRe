import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart3, DollarSign, FileText, Bot, TrendingUp,
  Building2, Users, Target, Package, MapPin, CreditCard, Calculator,
  ClipboardCheck, Calendar, FolderOpen, Box, Car,
  LogOut, Globe, Search, ArrowLeft, Activity
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';
import { apiClient } from '../services/api.client';
import { useDealStore } from '../stores/dealStore';

import OverviewSection from '../components/deal/sections/OverviewSection';
import ExitSection from '../components/deal/sections/ExitSection';
import FinancialModelingSection from '../components/deal/sections/FinancialModelingSection';
import DebtSection from '../components/deal/sections/DebtSection';
import InvestmentStrategySection from '../components/deal/sections/InvestmentStrategySection';
import TeamSection from '../components/deal/sections/TeamSection';
import { FilesSection } from '../components/deal/sections/FilesSection';
import OpusAISection from '../components/deal/sections/OpusAISection';
import ContextTrackerSection from '../components/deal/sections/ContextTrackerSection';
import { TrafficAnalysisSection } from '../components/deal/sections/TrafficAnalysisSection';

import CompetitionPage from './development/CompetitionPage';
import { DueDiligencePage } from './development/DueDiligencePage';
import { MarketAnalysisPage } from './development/MarketAnalysisPage';
import { ProjectTimelinePage } from './development/ProjectTimelinePage';
import SupplyPipelinePage from './development/SupplyPipelinePage';
import { Design3DPageEnhanced } from './Design3DPage.enhanced';

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
        '2': 'financial-model',
        '3': 'due-diligence',
        '4': 'files',
        '5': 'ai-agent',
      };
      if (keyMap[e.key]) {
        setActiveTab(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const analysisTabs: Tab[] = [
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
      id: 'market-analysis', 
      label: 'Market Analysis', 
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
      id: 'traffic', 
      label: 'Traffic Engine', 
      icon: <Car size={16} />, 
      component: TrafficAnalysisSection 
    },
  ];

  const financialTabs: Tab[] = [
    { 
      id: 'strategy', 
      label: 'Investment Strategy', 
      icon: <Target size={16} />, 
      component: InvestmentStrategySection 
    },
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
      label: 'Exit Analysis', 
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
      id: 'team', 
      label: 'Team & Roles', 
      icon: <Users size={16} />, 
      component: TeamSection 
    },
  ];

  const documentsTabs: Tab[] = [
    { 
      id: 'files', 
      label: 'Files & Assets', 
      icon: <FolderOpen size={16} />, 
      component: FilesSection 
    },
  ];

  const aiToolsTabs: Tab[] = [
    { 
      id: 'ai-agent', 
      label: 'AI Agent / Opus', 
      icon: <Bot size={16} />, 
      component: OpusAISection 
    },
    { 
      id: 'context', 
      label: 'Context Builder', 
      icon: <Globe size={16} />, 
      component: ContextTrackerSection 
    },
  ];

  const allTabs = [
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
                placeholder="Search tabs..."
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
                  <div className="text-sm text-slate-400 text-center py-4">No matching tabs</div>
                )}
              </div>
            ) : (
              <nav className="flex-1">
                <TabGroup
                  id="analysis"
                  title="ANALYSIS"
                  icon={<BarChart3 size={18} />}
                  tabs={analysisTabs}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  defaultExpanded={true}
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
            <p className="text-xs text-slate-400 text-center">Press 1-5 to switch groups</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <ActiveComponent deal={deal} onUpdate={() => dealId && loadDeal(dealId)} />
        </main>
      </div>
    </div>
  );
};

export default DealDetailPage;
