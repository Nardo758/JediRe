/**
 * Example: How to integrate OpusAISection into DealPage
 * 
 * This file shows the minimal changes needed to add the AI Agent tab
 * to your existing DealPage implementation.
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { OpusAISection } from './OpusAISection';
// ... your other section imports

// ============================================================================
// Example 1: Add AI Agent Tab to Tab Navigation
// ============================================================================

interface Tab {
  id: string;
  label: string;
  icon: string;
  description?: string;
}

const DEAL_TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: '🏠', description: 'Property details & metrics' },
  { id: 'ai-agent', label: 'AI Agent', icon: '🧠', description: 'AI-powered analysis' }, // <- ADD THIS
  { id: 'competition', label: 'Competition', icon: '🎯', description: 'Market comps' },
  { id: 'supply', label: 'Supply', icon: '🏗️', description: 'Pipeline tracking' },
  { id: 'market', label: 'Market', icon: '📊', description: 'Demographics & trends' },
  { id: 'debt', label: 'Debt', icon: '💰', description: 'Financing options' },
  { id: 'financial', label: 'Financial', icon: '📈', description: 'Pro forma & returns' },
  { id: 'strategy', label: 'Strategy', icon: '🎯', description: 'Deal strategy' },
  { id: 'due-diligence', label: 'DD', icon: '🔍', description: 'Due diligence' },
  { id: 'team', label: 'Team', icon: '👥', description: 'Team & comms' },
  { id: 'documents', label: 'Docs', icon: '📄', description: 'Documents' },
  { id: 'timeline', label: 'Timeline', icon: '📅', description: 'Key dates' },
  { id: 'notes', label: 'Notes', icon: '📝', description: 'Notes & memos' },
  { id: 'files', label: 'Files', icon: '📁', description: 'File manager' },
  { id: 'exit', label: 'Exit', icon: '🚪', description: 'Exit strategy' }
];

// ============================================================================
// Example 2: Tab Content Renderer
// ============================================================================

interface DealPageContentProps {
  deal: Deal;
  activeTab: string;
}

const DealPageContent: React.FC<DealPageContentProps> = ({ deal, activeTab }) => {
  // Render appropriate section based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewSection deal={deal} />;
      
      case 'ai-agent':
        return <OpusAISection deal={deal} />; // <- ADD THIS
      
      case 'competition':
        return <CompetitionSection deal={deal} />;
      
      case 'supply':
        return <SupplySection deal={deal} />;
      
      case 'market':
        return <MarketSection deal={deal} />;
      
      case 'debt':
        return <DebtSection deal={deal} />;
      
      case 'financial':
        return <FinancialSection deal={deal} />;
      
      case 'strategy':
        return <StrategySection deal={deal} />;
      
      case 'due-diligence':
        return <DueDiligenceSection deal={deal} />;
      
      case 'team':
        return <TeamSection deal={deal} />;
      
      case 'documents':
        return <DocumentsSection deal={deal} />;
      
      case 'timeline':
        return <TimelineSection deal={deal} />;
      
      case 'notes':
        return <NotesSection deal={deal} />;
      
      case 'files':
        return <FilesSection deal={deal} />;
      
      case 'exit':
        return <ExitSection deal={deal} />;
      
      default:
        return <OverviewSection deal={deal} />;
    }
  };

  return (
    <div className="p-6">
      {renderTabContent()}
    </div>
  );
};

// ============================================================================
// Example 3: Full DealPage with AI Agent Tab
// ============================================================================

interface SimpleDealPageProps {
  deal: Deal;
}

const SimpleDealPage: React.FC<SimpleDealPageProps> = ({ deal }) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
        <div className="text-sm text-gray-500 mt-1">
          {deal.address} • {deal.projectType}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-1">
          {DEAL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
              title={tab.description}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <DealPageContent deal={deal} activeTab={activeTab} />
      </div>

    </div>
  );
};

// ============================================================================
// Example 4: Alternative - Modal/Floating AI Agent
// ============================================================================

const AIAgentFloatingButton: React.FC<{ deal: Deal }> = ({ deal }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg flex items-center justify-center text-3xl hover:scale-110 transition-transform z-50"
        title="Open AI Agent"
      >
        🧠
      </button>

      {/* AI Agent Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🧠</div>
                <div>
                  <h2 className="text-xl font-bold">AI Agent Analysis</h2>
                  <p className="text-sm text-blue-100">{deal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <OpusAISection deal={deal} />
            </div>

          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// Example 5: Standalone AI Page (Separate Route)
// ============================================================================

const AIAgentPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);

  // Load deal data
  useEffect(() => {
    loadDeal(dealId);
  }, [dealId]);

  if (!deal) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/deals/${dealId}`)}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Deal
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🧠 AI Agent Analysis
            </h1>
            <p className="text-sm text-gray-500 mt-1">{deal.name}</p>
          </div>
        </div>
      </div>

      {/* AI Agent Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <OpusAISection deal={deal} />
      </div>

    </div>
  );
};

// ============================================================================
// Example 6: Quick Stats Widget (Inline Preview)
// ============================================================================

const AIAgentQuickPreview: React.FC<{ deal: Deal }> = ({ deal }) => {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    // Quick analysis on mount
    analyzeQuick();
  }, [deal.id]);

  const analyzeQuick = async () => {
    // Simplified quick analysis
    const result = await opusService.analyzeAcquisition({
      dealId: deal.id,
      dealName: deal.name,
      status: 'pipeline',
      overview: { /* minimal data */ }
    });
    setAnalysis(result);
  };

  if (!analysis) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
        <div className="animate-pulse">🧠 AI analyzing...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-semibold text-gray-900">AI Recommendation</span>
        </div>
        <button
          onClick={() => navigate(`/deals/${deal.id}?tab=ai-agent`)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View Full Analysis →
        </button>
      </div>

      <div className={`px-4 py-2 rounded-lg text-center font-bold text-lg ${
        analysis.recommendation === 'buy' || analysis.recommendation === 'strong-buy'
          ? 'bg-green-100 text-green-700'
          : analysis.recommendation === 'hold'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-red-100 text-red-700'
      }`}>
        {analysis.recommendation.toUpperCase().replace('-', ' ')}
      </div>

      <div className="mt-3 flex justify-between text-sm">
        <div>
          <span className="text-gray-500">Score:</span>
          <span className="ml-2 font-semibold text-gray-900">
            {analysis.score.toFixed(1)}/10
          </span>
        </div>
        <div>
          <span className="text-gray-500">Confidence:</span>
          <span className="ml-2 font-semibold text-gray-900">
            {analysis.confidence}%
          </span>
        </div>
      </div>

      {analysis.keyInsights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2">TOP INSIGHT</div>
          <div className="text-sm text-gray-700">{analysis.keyInsights[0]}</div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export {
  SimpleDealPage,
  AIAgentFloatingButton,
  AIAgentPage,
  AIAgentQuickPreview
};

export default SimpleDealPage;
