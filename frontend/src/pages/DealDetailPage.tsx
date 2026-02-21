import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart3, DollarSign, FileText, Bot, TrendingUp, Settings,
  Building2, Users, Target, Package, MapPin, CreditCard, Calculator,
  ClipboardCheck, Calendar, StickyNote, FolderOpen,
  LogOut, Globe, Search, ArrowLeft, Shield, Activity
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';
import { apiClient } from '../services/api.client';

import OverviewSection from '../components/deal/sections/OverviewSection';
import MarketSection from '../components/deal/sections/MarketSection';
import { CompetitionSection } from '../components/deal/sections/CompetitionSection';
import SupplySection from '../components/deal/sections/SupplySection';
import ExitSection from '../components/deal/sections/ExitSection';
import FinancialModelingSection from '../components/deal/sections/FinancialModelingSection';
import DebtSection from '../components/deal/sections/DebtSection';
import InvestmentStrategySection from '../components/deal/sections/InvestmentStrategySection';
import DueDiligenceSection from '../components/deal/sections/DueDiligenceSection';
import TimelineSection from '../components/deal/sections/TimelineSection';
import TeamSection from '../components/deal/sections/TeamSection';
import DocumentsSection from '../components/deal/sections/DocumentsSection';
import { FilesSection } from '../components/deal/sections/FilesSection';
import NotesSection from '../components/deal/sections/NotesSection';
import OpusAISection from '../components/deal/sections/OpusAISection';
import ContextTrackerSection from '../components/deal/sections/ContextTrackerSection';

const DealDetailPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
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
        '4': 'documents',
        '5': 'ai-agent',
        '6': 'deal-status',
        '7': 'settings',
      };
      if (keyMap[e.key]) {
        setActiveTab(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const analysisTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} />, component: OverviewSection },
    { id: 'market', label: 'Market Intelligence', icon: <TrendingUp size={16} />, component: MarketSection },
    { id: 'competition', label: 'Competition Analysis', icon: <Target size={16} />, component: CompetitionSection },
    { id: 'supply', label: 'Supply Pipeline', icon: <Package size={16} />, component: SupplySection },
    { id: 'exit', label: 'Exit Analysis', icon: <LogOut size={16} />, component: ExitSection },
  ];

  const financialTabs: Tab[] = [
    { id: 'financial-model', label: 'Financial Model', icon: <Calculator size={16} />, component: FinancialModelingSection },
    { id: 'debt', label: 'Debt & Financing', icon: <CreditCard size={16} />, component: DebtSection },
    { id: 'strategy', label: 'Investment Strategy', icon: <Target size={16} />, component: InvestmentStrategySection },
  ];

  const operationsTabs: Tab[] = [
    { id: 'due-diligence', label: 'Due Diligence', icon: <ClipboardCheck size={16} />, component: DueDiligenceSection },
    { id: 'timeline', label: 'Timeline & Milestones', icon: <Calendar size={16} />, component: TimelineSection },
    { id: 'team', label: 'Team & Roles', icon: <Users size={16} />, component: TeamSection },
  ];

  const documentsTabs: Tab[] = [
    { id: 'documents', label: 'Documents', icon: <FileText size={16} />, component: DocumentsSection },
    { id: 'files', label: 'Files & Assets', icon: <FolderOpen size={16} />, component: FilesSection },
    { id: 'notes', label: 'Notes', icon: <StickyNote size={16} />, component: NotesSection },
  ];

  const aiToolsTabs: Tab[] = [
    { id: 'ai-agent', label: 'AI Agent / Opus', icon: <Bot size={16} />, component: OpusAISection },
    { id: 'context', label: 'Context Builder', icon: <Globe size={16} />, component: ContextTrackerSection },
  ];

  const dealStatusTabs: Tab[] = [
    { id: 'deal-status', label: 'Deal Capsule Summary', icon: <Building2 size={16} />, component: DealStatusComponent },
  ];

  const settingsTabs: Tab[] = [
    { id: 'settings', label: 'Deal Settings', icon: <Settings size={16} />, component: DealSettingsComponent },
  ];

  const allTabs = [
    ...analysisTabs,
    ...financialTabs,
    ...operationsTabs,
    ...documentsTabs,
    ...aiToolsTabs,
    ...dealStatusTabs,
    ...settingsTabs,
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
                <TabGroup
                  id="deal-status"
                  title="DEAL STATUS"
                  icon={<TrendingUp size={18} />}
                  tabs={dealStatusTabs}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  alwaysExpanded={true}
                />
                <TabGroup
                  id="settings"
                  title="SETTINGS"
                  icon={<Settings size={18} />}
                  tabs={settingsTabs}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </nav>
            )}
          </div>

          <div className="mt-auto p-3 border-t border-slate-200">
            <p className="text-xs text-slate-400 text-center">Press 1-7 to switch groups</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <ActiveComponent deal={deal} onUpdate={() => dealId && loadDeal(dealId)} />
        </main>
      </div>
    </div>
  );
};

const DealStatusComponent: React.FC<{ deal: any; onUpdate?: () => void }> = ({ deal }) => {
  const statusColor = deal?.status === 'active' ? 'green' : deal?.status === 'closed' ? 'blue' : 'yellow';
  const mode = deal?.deal_category === 'owned' ? 'Performance' : 'Acquisition';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Deal Capsule Summary</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-700`}>
          {deal?.status || 'Active'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">Mode</div>
          <div className="text-lg font-semibold text-slate-900">{mode}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">JEDI Score</div>
          <div className="text-lg font-semibold text-blue-600">{deal?.jedi_score || 'N/A'}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">Property Type</div>
          <div className="text-lg font-semibold text-slate-900 capitalize">{deal?.project_type || deal?.property_type || 'N/A'}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">Units</div>
          <div className="text-lg font-semibold text-slate-900">{deal?.target_units?.toLocaleString() || 'N/A'}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Deal Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Address:</span>
            <span className="ml-2 text-slate-900">{deal?.address || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">Budget:</span>
            <span className="ml-2 text-slate-900">{deal?.budget ? `$${Number(deal.budget).toLocaleString()}` : 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">Timeline Start:</span>
            <span className="ml-2 text-slate-900">{deal?.timeline_start ? new Date(deal.timeline_start).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">Timeline End:</span>
            <span className="ml-2 text-slate-900">{deal?.timeline_end ? new Date(deal.timeline_end).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">Category:</span>
            <span className="ml-2 text-slate-900 capitalize">{deal?.deal_category || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">Tier:</span>
            <span className="ml-2 text-slate-900 capitalize">{deal?.tier || 'N/A'}</span>
          </div>
        </div>
      </div>

      {deal?.notes && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
          <p className="text-sm text-slate-600">{deal.notes}</p>
        </div>
      )}
    </div>
  );
};

const DealSettingsComponent: React.FC<{ deal: any; onUpdate?: () => void }> = ({ deal }) => (
  <div className="space-y-6">
    <h2 className="text-lg font-bold text-slate-900">Deal Settings</h2>

    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">General</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Deal Name</label>
          <input
            type="text"
            defaultValue={deal?.name || ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            readOnly
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Property Type</label>
          <input
            type="text"
            defaultValue={deal?.project_type || deal?.property_type || ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm capitalize focus:outline-none focus:border-blue-500"
            readOnly
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <input
            type="text"
            defaultValue={deal?.deal_category || ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm capitalize focus:outline-none focus:border-blue-500"
            readOnly
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tier</label>
          <input
            type="text"
            defaultValue={deal?.tier || ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm capitalize focus:outline-none focus:border-blue-500"
            readOnly
          />
        </div>
      </div>
    </div>

    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 rounded border-slate-300" />
          <span className="text-sm text-slate-700">Email notifications for deal updates</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-500 rounded border-slate-300" />
          <span className="text-sm text-slate-700">Alert on market changes affecting this deal</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 text-blue-500 rounded border-slate-300" />
          <span className="text-sm text-slate-700">Weekly summary report</span>
        </label>
      </div>
    </div>

    <div className="bg-white rounded-lg border border-red-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
      <p className="text-sm text-slate-500">These actions cannot be undone.</p>
      <div className="flex gap-3">
        <button className="px-4 py-2 text-sm border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors">
          Archive Deal
        </button>
        <button className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
          Delete Deal
        </button>
      </div>
    </div>
  </div>
);

export default DealDetailPage;
