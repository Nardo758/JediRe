// DealDetailPage - Refactored with TabGroups
// Created: 2026-02-20
// Phase 1: Navigation consolidation (16 tabs → 7 groups)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart3, DollarSign, FileText, Bot, TrendingUp, Settings,
  Building2, Users, Target, Package, MapPin, CreditCard, Calculator,
  Shield, ClipboardCheck, Calendar, StickyNote, FolderOpen,
  LogOut, Globe
} from 'lucide-react';
import { TabGroup, Tab } from '../components/deal/TabGroup';

// Import tab components (these would be your existing section components)
import OverviewSection from '../components/deal/sections/OverviewSection';
import MarketSection from '../components/deal/sections/MarketSection';
import CompetitionSection from '../components/deal/sections/CompetitionSection';
import SupplySection from '../components/deal/sections/SupplySection';
import ExitSection from '../components/deal/sections/ExitSection';
import FinancialModelingSection from '../components/deal/sections/FinancialModelingSection';
import DebtSection from '../components/deal/sections/DebtSection';
import InvestmentStrategySection from '../components/deal/sections/InvestmentStrategySection';
import DueDiligenceSection from '../components/deal/sections/DueDiligenceSection';
import TimelineSection from '../components/deal/sections/TimelineSection';
import TeamSection from '../components/deal/sections/TeamSection';
import DocumentsSection from '../components/deal/sections/DocumentsSection';
import FilesSection from '../components/deal/sections/FilesSection';
import NotesSection from '../components/deal/sections/NotesSection';
import OpusAISection from '../components/deal/sections/OpusAISection';
import ContextSection from '../components/deal/sections/ContextSection';

interface DealDetailPageProps {}

const DealDetailPage: React.FC<DealDetailPageProps> = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load deal data
  useEffect(() => {
    if (dealId) {
      loadDeal(dealId);
    }
  }, [dealId]);

  const loadDeal = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/deals/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setDeal(data);
    } catch (error) {
      console.error('Error loading deal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcuts (1-7 to switch groups)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const keyMap: { [key: string]: string } = {
        '1': 'overview', // First tab of ANALYSIS group
        '2': 'financial-model', // First tab of FINANCIAL group
        '3': 'due-diligence', // First tab of OPERATIONS group
        '4': 'documents', // First tab of DOCUMENTS group
        '5': 'ai-agent', // First tab of AI TOOLS group
        '6': 'deal-status', // DEAL STATUS
        '7': 'settings', // SETTINGS
      };

      if (keyMap[e.key]) {
        setActiveTab(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Tab definitions
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
    { id: 'context', label: 'Context Builder', icon: <Globe size={16} />, component: ContextSection },
  ];

  const dealStatusTabs: Tab[] = [
    { id: 'deal-status', label: 'Deal Capsule Summary', icon: <Building2 size={16} />, component: DealStatusComponent },
  ];

  const settingsTabs: Tab[] = [
    { id: 'settings', label: 'Deal Settings', icon: <Settings size={16} />, component: DealSettingsComponent },
  ];

  // Find active tab component
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

  if (loading) {
    return (
      <div className="deal-detail-loading">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="deal-detail-error">
        <h2>Deal not found</h2>
        <button onClick={() => navigate('/deals')}>Back to Deals</button>
      </div>
    );
  }

  return (
    <div className="deal-detail-page">
      {/* Header */}
      <div className="deal-header">
        <button className="back-button" onClick={() => navigate('/deals')}>
          ← Back to Deals
        </button>
        <h1>{deal.name || 'Untitled Deal'}</h1>
        <div className="deal-meta">
          <span className="deal-type">{deal.property_type || 'multifamily'}</span>
          {deal.location && <span className="deal-location"><MapPin size={14} /> {deal.location}</span>}
        </div>
      </div>

      {/* Main Layout */}
      <div className="deal-content">
        {/* Sidebar Navigation */}
        <aside className="deal-sidebar">
          <div className="sidebar-search">
            <input 
              type="text" 
              placeholder="Search tabs..." 
              className="tab-search"
              onKeyDown={(e) => {
                // Tab search functionality
                if (e.key === 'Enter') {
                  const query = (e.target as HTMLInputElement).value.toLowerCase();
                  const found = allTabs.find(tab => 
                    tab.label.toLowerCase().includes(query)
                  );
                  if (found) {
                    setActiveTab(found.id);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
          </div>

          <nav className="tab-groups">
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

          {/* Keyboard shortcuts hint */}
          <div className="shortcuts-hint">
            <small>Shortcuts: 1-7 to switch groups</small>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="deal-main">
          <ActiveComponent deal={deal} onUpdate={loadDeal} />
        </main>
      </div>

      <style jsx>{`
        .deal-detail-page {
          min-height: 100vh;
          background: #f8fafc;
        }

        .deal-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 20px 24px;
        }

        .back-button {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .back-button:hover {
          color: #334155;
        }

        .deal-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .deal-meta {
          display: flex;
          gap: 16px;
          align-items: center;
          font-size: 14px;
          color: #64748b;
        }

        .deal-type {
          text-transform: capitalize;
          background: #f1f5f9;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 500;
        }

        .deal-location {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .deal-content {
          display: flex;
          height: calc(100vh - 140px);
        }

        .deal-sidebar {
          width: 280px;
          background: white;
          border-right: 1px solid #e2e8f0;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }

        .sidebar-search {
          margin-bottom: 16px;
        }

        .tab-search {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
        }

        .tab-search:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .tab-groups {
          flex: 1;
        }

        .shortcuts-hint {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          color: #94a3b8;
          text-align: center;
        }

        .deal-main {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .deal-detail-loading,
        .deal-detail-error {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }

        .spinner {
          font-size: 18px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

// Placeholder components (replace with actual implementations)
const DealStatusComponent: React.FC<any> = ({ deal }) => (
  <div className="deal-status-summary">
    <h2>Deal Capsule Summary</h2>
    <div className="capsule-card">
      <h3>{deal.name}</h3>
      <div className="status-grid">
        <div className="status-item">
          <label>Status</label>
          <span>{deal.status || 'Active'}</span>
        </div>
        <div className="status-item">
          <label>JEDI Score</label>
          <span>{deal.jedi_score || 'N/A'}</span>
        </div>
      </div>
    </div>
  </div>
);

const DealSettingsComponent: React.FC<any> = ({ deal }) => (
  <div className="deal-settings">
    <h2>Deal Settings</h2>
    <p>Configure deal-specific settings and preferences.</p>
  </div>
);

export default DealDetailPage;
