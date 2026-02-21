/**
 * OpusAISection - Central AI Analysis with Role-Based Personas
 * 
 * The AI brain of JEDI RE - analyzes all 13 tabs through expert personas
 * Provides comprehensive deal analysis with recommendations, insights, risks, and opportunities
 */

import React, { useState, useEffect } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { opusService } from '../../../services/opus.service';
import { OpusDealContext, OpusRecommendationResult, OpusRecommendation } from '../../../types/opus.types';

// Import all mock data for comprehensive analysis
import {
  competitionData,
  supplyData,
  marketData,
  debtData,
  financialData,
  strategyData,
  dueDiligenceData,
  teamData,
  documentsData
} from '../../../data/opusContextData';

// ============================================================================
// Role-Based Personas
// ============================================================================

export type AIRole = 
  | 'cfo'
  | 'accountant'
  | 'marketing'
  | 'developer'
  | 'legal'
  | 'lender'
  | 'acquisitions'
  | 'asset-manager';

interface RolePersona {
  id: AIRole;
  name: string;
  icon: string;
  description: string;
  focus: string[];
  color: string;
  gradient: string;
}

const ROLE_PERSONAS: Record<AIRole, RolePersona> = {
  cfo: {
    id: 'cfo',
    name: 'CFO',
    icon: '📊',
    description: 'Financial analysis, returns, and risk management',
    focus: ['Financial viability', 'Return metrics', 'Cash flow', 'Risk assessment', 'Value creation'],
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600'
  },
  accountant: {
    id: 'accountant',
    name: 'Accountant',
    icon: '💰',
    description: 'Numbers deep-dive, tax implications, and GAAP compliance',
    focus: ['Financial details', 'Tax strategy', 'Accounting standards', 'Audit readiness', 'Cost analysis'],
    color: 'green',
    gradient: 'from-green-500 to-green-600'
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing Expert',
    icon: '📈',
    description: 'Market positioning, branding, and lease-up strategy',
    focus: ['Market positioning', 'Branding', 'Lease-up', 'Tenant attraction', 'Competitive advantage'],
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600'
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    icon: '🏗️',
    description: 'Construction feasibility, value-add, and renovations',
    focus: ['Construction quality', 'Value-add potential', 'Renovation ROI', 'Development risk', 'Timeline'],
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600'
  },
  legal: {
    id: 'legal',
    name: 'Legal Advisor',
    icon: '⚖️',
    description: 'Contracts, compliance, and legal risk assessment',
    focus: ['Contract review', 'Regulatory compliance', 'Legal risks', 'Liability', 'Documentation'],
    color: 'gray',
    gradient: 'from-gray-600 to-gray-700'
  },
  lender: {
    id: 'lender',
    name: 'Lender',
    icon: '🏦',
    description: 'Debt perspective, underwriting, and financing',
    focus: ['Creditworthiness', 'Collateral value', 'Debt service', 'LTV ratio', 'Market conditions'],
    color: 'indigo',
    gradient: 'from-indigo-500 to-indigo-600'
  },
  acquisitions: {
    id: 'acquisitions',
    name: 'Acquisitions',
    icon: '🎯',
    description: 'Deal sourcing, negotiations, and acquisition strategy',
    focus: ['Deal structure', 'Pricing strategy', 'Negotiation leverage', 'Market timing', 'Competition'],
    color: 'red',
    gradient: 'from-red-500 to-red-600'
  },
  'asset-manager': {
    id: 'asset-manager',
    name: 'Asset Manager',
    icon: '📉',
    description: 'Operations optimization and NOI maximization',
    focus: ['Operational efficiency', 'NOI optimization', 'Expense control', 'Revenue growth', 'Performance'],
    color: 'teal',
    gradient: 'from-teal-500 to-teal-600'
  }
};

// ============================================================================
// Main Component
// ============================================================================

interface OpusAISectionProps {
  deal: Deal;
}

export const OpusAISection: React.FC<OpusAISectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  const [selectedRole, setSelectedRole] = useState<AIRole>('cfo');
  const [analysis, setAnalysis] = useState<OpusRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['insights', 'recommendation']));

  const currentPersona = ROLE_PERSONAS[selectedRole];

  // Auto-analyze on role change or deal change
  useEffect(() => {
    analyzeWithRole(selectedRole);
  }, [selectedRole, deal.id]);

  const analyzeWithRole = async (role: AIRole) => {
    setLoading(true);
    setError(null);

    try {
      // Build comprehensive deal context from all 13 tabs
      const context = buildDealContext(deal, role);

      // Get AI analysis (uses mock data by default)
      const result = isPipeline
        ? await opusService.analyzeAcquisition(context)
        : await opusService.analyzePerformance(context);

      // Customize analysis based on role
      const roleCustomizedResult = customizeForRole(result, role, context);

      setAnalysis(roleCustomizedResult);
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const exportToPDF = () => {
    // Placeholder for PDF export functionality
    alert('PDF export coming soon! This will generate a comprehensive report.');
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
            isPipeline 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white'
          }`}>
            {isPipeline ? '🎯 Acquisition Analysis' : '🏢 Performance Analysis'}
          </div>
          <div className="text-sm text-gray-500">
            Powered by Claude Opus
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => analyzeWithRole(selectedRole)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {loading ? '🔄 Analyzing...' : '🔄 Re-analyze'}
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Role Selector */}
      <RoleSelector
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        disabled={loading}
      />

      {/* Loading State */}
      {loading && (
        <LoadingState persona={currentPersona} />
      )}

      {/* Error State */}
      {error && !loading && (
        <ErrorState error={error} onRetry={() => analyzeWithRole(selectedRole)} />
      )}

      {/* Analysis Results */}
      {analysis && !loading && !error && (
        <div className="space-y-6">
          
          {/* Overall Recommendation Card */}
          <RecommendationCard
            analysis={analysis}
            persona={currentPersona}
            expanded={expandedSections.has('recommendation')}
            onToggle={() => toggleSection('recommendation')}
            onCopy={() => copyToClipboard(analysis.reasoning)}
          />

          {/* Key Insights */}
          <InsightsCard
            insights={analysis.keyInsights}
            persona={currentPersona}
            expanded={expandedSections.has('insights')}
            onToggle={() => toggleSection('insights')}
          />

          {/* Risks */}
          <RisksCard
            risks={analysis.risks}
            persona={currentPersona}
            expanded={expandedSections.has('risks')}
            onToggle={() => toggleSection('risks')}
          />

          {/* Opportunities */}
          <OpportunitiesCard
            opportunities={analysis.opportunities}
            persona={currentPersona}
            expanded={expandedSections.has('opportunities')}
            onToggle={() => toggleSection('opportunities')}
          />

          {/* Action Items */}
          <ActionItemsCard
            actionItems={analysis.actionItems}
            persona={currentPersona}
            expanded={expandedSections.has('actions')}
            onToggle={() => toggleSection('actions')}
          />

          {/* Role-Specific Deep Dive */}
          <RoleSpecificAnalysis
            analysis={analysis}
            persona={currentPersona}
            deal={deal}
            expanded={expandedSections.has('deep-dive')}
            onToggle={() => toggleSection('deep-dive')}
          />

          {/* Analysis Metadata */}
          <AnalysisMetadata analysis={analysis} />

        </div>
      )}

    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface RoleSelectorProps {
  selectedRole: AIRole;
  onRoleChange: (role: AIRole) => void;
  disabled?: boolean;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onRoleChange, disabled }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        Select AI Analyst Role
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.values(ROLE_PERSONAS).map((persona) => (
          <button
            key={persona.id}
            onClick={() => onRoleChange(persona.id)}
            disabled={disabled}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200
              ${selectedRole === persona.id
                ? `border-${persona.color}-500 bg-${persona.color}-50`
                : 'border-gray-200 bg-white hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="text-3xl mb-2">{persona.icon}</div>
            <div className="text-sm font-semibold text-gray-900">{persona.name}</div>
            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{persona.description}</div>
            
            {selectedRole === persona.id && (
              <div className={`absolute top-2 right-2 w-6 h-6 bg-gradient-to-br ${persona.gradient} rounded-full flex items-center justify-center`}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface LoadingStateProps {
  persona: RolePersona;
}

const LoadingState: React.FC<LoadingStateProps> = ({ persona }) => {
  return (
    <div className={`bg-gradient-to-br ${persona.gradient} rounded-xl p-8 text-white`}>
      <div className="flex items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        <div>
          <div className="text-2xl font-bold mb-1">
            {persona.icon} {persona.name} Analyzing...
          </div>
          <div className="text-white/80">
            Reviewing all deal data through {persona.name.toLowerCase()} lens
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
        {persona.focus.map((focus, i) => (
          <div key={i} className="text-sm text-white/60 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            ✓ {focus}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900 mb-2">Analysis Failed</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

interface RecommendationCardProps {
  analysis: OpusRecommendationResult;
  persona: RolePersona;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ 
  analysis, 
  persona, 
  expanded, 
  onToggle,
  onCopy 
}) => {
  const getRecommendationConfig = (rec: OpusRecommendation) => {
    const configs: Record<OpusRecommendation, { label: string; color: string; gradient: string; emoji: string }> = {
      'strong-buy': { label: 'STRONG BUY', color: 'green', gradient: 'from-green-500 to-green-600', emoji: '🚀' },
      'buy': { label: 'BUY', color: 'green', gradient: 'from-green-400 to-green-500', emoji: '✅' },
      'hold': { label: 'HOLD', color: 'yellow', gradient: 'from-yellow-400 to-yellow-500', emoji: '⏸️' },
      'pass': { label: 'PASS', color: 'orange', gradient: 'from-orange-400 to-orange-500', emoji: '⚠️' },
      'strong-pass': { label: 'STRONG PASS', color: 'red', gradient: 'from-red-500 to-red-600', emoji: '❌' },
      'optimize': { label: 'OPTIMIZE', color: 'blue', gradient: 'from-blue-500 to-blue-600', emoji: '⚡' },
      'hold-asset': { label: 'HOLD ASSET', color: 'teal', gradient: 'from-teal-400 to-teal-500', emoji: '🏢' },
      'sell': { label: 'SELL', color: 'purple', gradient: 'from-purple-500 to-purple-600', emoji: '💸' }
    };
    return configs[rec] || configs.hold;
  };

  const recConfig = getRecommendationConfig(analysis.recommendation);

  return (
    <div className={`bg-gradient-to-br ${recConfig.gradient} rounded-xl text-white overflow-hidden`}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-5xl">{persona.icon}</div>
              <div>
                <div className="text-sm font-medium text-white/80 mb-1">
                  {persona.name} Recommendation
                </div>
                <div className="text-3xl font-bold flex items-center gap-3">
                  {recConfig.emoji} {recConfig.label}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-sm text-white/70 mb-1">Deal Score</div>
                <div className="text-2xl font-bold">{analysis.score.toFixed(1)}/10</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-sm text-white/70 mb-1">Confidence</div>
                <div className="text-2xl font-bold">{analysis.confidence}%</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-sm text-white/70 mb-1">Model</div>
                <div className="text-xs font-medium mt-1">Claude Opus</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCopy}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              📋
            </button>
            <button
              onClick={onToggle}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {expanded ? '▼' : '▶'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="prose prose-invert max-w-none">
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                {analysis.reasoning || analysis.executiveSummary}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface InsightsCardProps {
  insights: string[];
  persona: RolePersona;
  expanded: boolean;
  onToggle: () => void;
}

const InsightsCard: React.FC<InsightsCardProps> = ({ insights, persona, expanded, onToggle }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div 
        className="p-6 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br ${persona.gradient} rounded-lg flex items-center justify-center text-2xl`}>
            💡
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Key Insights</h3>
            <p className="text-sm text-gray-500">{insights.length} critical findings</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className={`flex-shrink-0 w-6 h-6 bg-gradient-to-br ${persona.gradient} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                {i + 1}
              </div>
              <div className="flex-1 text-gray-700">{insight}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface RisksCardProps {
  risks: any[];
  persona: RolePersona;
  expanded: boolean;
  onToggle: () => void;
}

const RisksCard: React.FC<RisksCardProps> = ({ risks, persona, expanded, onToggle }) => {
  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: 'red',
      high: 'orange',
      medium: 'yellow',
      low: 'green'
    };
    return colors[level] || 'gray';
  };

  const sortedRisks = [...risks].sort((a, b) => (b.priority || 5) - (a.priority || 5));

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div 
        className="p-6 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Risks</h3>
            <p className="text-sm text-gray-500">{risks.length} identified risks</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {sortedRisks.map((risk, i) => (
            <div key={risk.id || i} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-${getRiskColor(risk.level)}-100 text-${getRiskColor(risk.level)}-700`}>
                      {risk.level?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{risk.category}</span>
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    Priority: {risk.priority}/10
                  </div>
                </div>
                <div className="font-medium text-gray-900 mb-2">{risk.description}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Impact:</span>
                    <span className="ml-2 font-medium text-gray-900">{risk.impact}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Probability:</span>
                    <span className="ml-2 font-medium text-gray-900">{risk.probability}%</span>
                  </div>
                </div>
              </div>
              {risk.mitigation && (
                <div className="p-4 bg-white border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 mb-1">MITIGATION STRATEGY</div>
                  <div className="text-sm text-gray-700">{risk.mitigation}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface OpportunitiesCardProps {
  opportunities: any[];
  persona: RolePersona;
  expanded: boolean;
  onToggle: () => void;
}

const OpportunitiesCard: React.FC<OpportunitiesCardProps> = ({ opportunities, persona, expanded, onToggle }) => {
  const sortedOpps = [...opportunities].sort((a, b) => (b.priority || 5) - (a.priority || 5));

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div 
        className="p-6 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center text-2xl">
            🎯
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Opportunities</h3>
            <p className="text-sm text-gray-500">{opportunities.length} value creation opportunities</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {sortedOpps.map((opp, i) => (
            <div key={opp.id || i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                    {opp.type}
                  </span>
                </div>
                {opp.potentialValue && (
                  <div className="text-lg font-bold text-green-600">
                    +${opp.potentialValue.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="font-medium text-gray-900 mb-3">{opp.description}</div>
              
              {opp.requirements && opp.requirements.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">REQUIREMENTS</div>
                  <div className="flex flex-wrap gap-2">
                    {opp.requirements.map((req: string, j: number) => (
                      <span key={j} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Success Probability:</span>
                  <span className="ml-2 font-medium text-gray-900">{opp.probability}%</span>
                </div>
                {opp.timeline && (
                  <div className="text-gray-500">Timeline: <span className="font-medium text-gray-900">{opp.timeline}</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ActionItemsCardProps {
  actionItems: any[];
  persona: RolePersona;
  expanded: boolean;
  onToggle: () => void;
}

const ActionItemsCard: React.FC<ActionItemsCardProps> = ({ actionItems, persona, expanded, onToggle }) => {
  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { color: string; emoji: string }> = {
      urgent: { color: 'red', emoji: '🔥' },
      high: { color: 'orange', emoji: '⚡' },
      medium: { color: 'yellow', emoji: '📌' },
      low: { color: 'green', emoji: '📋' }
    };
    return configs[priority] || configs.medium;
  };

  const sortedActions = [...actionItems].sort((a, b) => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div 
        className="p-6 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br ${persona.gradient} rounded-lg flex items-center justify-center text-2xl`}>
            ✅
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Action Items</h3>
            <p className="text-sm text-gray-500">{actionItems.length} recommended actions</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-2">
          {sortedActions.map((action, i) => {
            const config = getPriorityConfig(action.priority);
            return (
              <div key={action.id || i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex-shrink-0 text-xl">{config.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded bg-${config.color}-100 text-${config.color}-700`}>
                      {action.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{action.category}</span>
                    {action.timeframe && (
                      <span className="text-xs text-gray-500">• {action.timeframe}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{action.action}</div>
                  {action.owner && (
                    <div className="text-xs text-gray-500 mt-1">Owner: {action.owner}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface RoleSpecificAnalysisProps {
  analysis: OpusRecommendationResult;
  persona: RolePersona;
  deal: Deal;
  expanded: boolean;
  onToggle: () => void;
}

const RoleSpecificAnalysis: React.FC<RoleSpecificAnalysisProps> = ({ 
  analysis, 
  persona, 
  deal, 
  expanded, 
  onToggle 
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div 
        className="p-6 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br ${persona.gradient} rounded-lg flex items-center justify-center text-2xl`}>
            {persona.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{persona.name} Deep Dive</h3>
            <p className="text-sm text-gray-500">Role-specific analysis and recommendations</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Focus Areas</h4>
              <div className="flex flex-wrap gap-2">
                {persona.focus.map((focus, i) => (
                  <span key={i} className={`px-3 py-1 text-sm rounded-full bg-gradient-to-br ${persona.gradient} text-white`}>
                    {focus}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {analysis.strengths.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">✅ Strengths</h4>
                  <ul className="space-y-1">
                    {analysis.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-green-500">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.weaknesses.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">⚠️ Weaknesses</h4>
                  <ul className="space-y-1">
                    {analysis.weaknesses.map((weakness, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-red-500">•</span>
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.assumptions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">📋 Key Assumptions</h4>
                  <ul className="space-y-1">
                    {analysis.assumptions.map((assumption, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-blue-500">•</span>
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AnalysisMetadataProps {
  analysis: OpusRecommendationResult;
}

const AnalysisMetadata: React.FC<AnalysisMetadataProps> = ({ analysis }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500 mb-1">Analysis Date</div>
          <div className="font-medium text-gray-900">
            {new Date(analysis.analysisDate).toLocaleDateString()}
          </div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Model Version</div>
          <div className="font-medium text-gray-900">{analysis.modelVersion}</div>
        </div>
        {analysis.tokensUsed && (
          <div>
            <div className="text-gray-500 mb-1">Tokens Used</div>
            <div className="font-medium text-gray-900">{analysis.tokensUsed.toLocaleString()}</div>
          </div>
        )}
        {analysis.processingTime && (
          <div>
            <div className="text-gray-500 mb-1">Processing Time</div>
            <div className="font-medium text-gray-900">{(analysis.processingTime / 1000).toFixed(2)}s</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build comprehensive deal context from all 13 tabs
 */
function buildDealContext(deal: Deal, role: AIRole): OpusDealContext {
  return {
    dealId: deal.id,
    dealName: deal.name,
    status: (deal.dealCategory === 'portfolio' || (deal as any).state === 'POST_CLOSE') ? 'owned' : 'pipeline',
    
    // Overview data
    overview: {
      propertySpecs: {
        address: deal.address || 'Unknown',
        propertyType: deal.projectType || deal.dealType || 'Unknown',
        units: deal.units,
        squareFeet: deal.squareFeet,
        yearBuilt: deal.yearBuilt,
        occupancy: deal.occupancy
      },
      metrics: {
        purchasePrice: deal.purchasePrice,
        askingPrice: deal.askingPrice,
        capRate: deal.capRate,
        cashOnCash: deal.cashOnCash,
        irr: deal.irr
      }
    },

    // Competition data
    competition: competitionData,

    // Supply pipeline data
    supply: supplyData,

    // Market data
    market: marketData,

    // Debt market data
    debt: debtData,

    // Financial analysis
    financial: financialData,

    // Strategy data
    strategy: strategyData,

    // Due diligence (for acquisition mode)
    dueDiligence: dueDiligenceData,

    // Team data
    team: teamData,

    // Documents data
    documents: documentsData,

    // Metadata
    lastUpdated: new Date().toISOString(),
    dataCompleteness: 85, // Could calculate based on available data
    analysisVersion: '1.0'
  };
}

/**
 * Customize analysis based on selected role
 */
function customizeForRole(
  result: OpusRecommendationResult,
  role: AIRole,
  context: OpusDealContext
): OpusRecommendationResult {
  const persona = ROLE_PERSONAS[role];

  // Add role-specific insights
  const roleInsights = generateRoleSpecificInsights(role, context, result);
  
  return {
    ...result,
    keyInsights: [...roleInsights, ...result.keyInsights].slice(0, 5),
    // Could add more role-specific customizations here
  };
}

/**
 * Generate role-specific insights
 */
function generateRoleSpecificInsights(
  role: AIRole,
  context: OpusDealContext,
  result: OpusRecommendationResult
): string[] {
  // This would be more sophisticated in production
  // For now, return some role-specific placeholder insights
  const insights: Record<AIRole, string[]> = {
    cfo: [
      `IRR of ${context.overview?.metrics.irr || 'N/A'}% suggests ${(context.overview?.metrics.irr || 0) > 15 ? 'strong' : 'moderate'} returns`,
      `Cap rate positioning indicates ${(context.overview?.metrics.capRate || 0) > 6 ? 'value' : 'growth'} opportunity`
    ],
    accountant: [
      `Financial statements require detailed review for GAAP compliance`,
      `Tax structure optimization could enhance after-tax returns by 10-15%`
    ],
    marketing: [
      `Market positioning suggests ${context.competition?.marketPosition.demandLevel || 'moderate'} demand`,
      `Competitive analysis shows ${context.competition?.comps.length || 0} comparable properties within 3 miles`
    ],
    developer: [
      `Property condition indicates ${context.overview?.propertySpecs.condition || 'standard'} renovation requirements`,
      `Value-add potential through unit upgrades and amenity improvements`
    ],
    legal: [
      `${context.dueDiligence?.checklistItems.length || 0} due diligence items require legal review`,
      `${context.dueDiligence?.redFlags.length || 0} potential red flags identified in initial screening`
    ],
    lender: [
      `Debt service coverage ratio of ${context.debt?.debtServiceCoverage || 'N/A'} indicates ${(context.debt?.debtServiceCoverage || 0) > 1.25 ? 'strong' : 'moderate'} coverage`,
      `Current lending environment shows ${context.debt?.lendingConditions.lenderAppetite || 'moderate'} appetite`
    ],
    acquisitions: [
      `Pricing at ${context.overview?.metrics.askingPrice || 'N/A'} compared to market comps`,
      `${context.competition?.comps.length || 0} comparable sales provide strong negotiation data`
    ],
    'asset-manager': [
      `Current occupancy of ${context.overview?.propertySpecs.occupancy || 'N/A'}% indicates ${(context.overview?.propertySpecs.occupancy || 0) > 90 ? 'strong' : 'improvement'} performance`,
      `Operating expense ratio optimization could improve NOI by 5-10%`
    ]
  };

  return insights[role] || [];
}

export default OpusAISection;
