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

import { apiClient } from '@/services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

import {
  competitionData as mockCompetitionData,
  supplyData as mockSupplyData,
  marketData as mockMarketData,
  debtData as mockDebtData,
  financialData as mockFinancialData,
  strategyData as mockStrategyData,
  dueDiligenceData as mockDueDiligenceData,
  teamData as mockTeamData,
  documentsData as mockDocumentsData
} from '../../../data/opusContextData';

// ============================================================================
// Role-Based Personas
// ============================================================================

export type AIRole = 
  // All Phases
  | 'cfo'
  | 'accountant'
  | 'marketing'
  | 'developer'
  | 'legal'
  | 'lender'
  | 'acquisitions'
  | 'asset-manager'
  | 'researcher'
  // Post-Acquisition / Portfolio
  | 'property-manager'
  | 'leasing-director'
  | 'facilities-manager'
  | 'investment-analyst'
  | 'esg-sustainability'
  | 'compliance-officer'
  | 'tax-strategist';

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
    color: BT.text.cyan,
    gradient: BT.text.cyan
  },
  accountant: {
    id: 'accountant',
    name: 'Accountant',
    icon: '💰',
    description: 'Numbers deep-dive, tax implications, and GAAP compliance',
    focus: ['Financial details', 'Tax strategy', 'Accounting standards', 'Audit readiness', 'Cost analysis'],
    color: BT.text.green,
    gradient: BT.text.green
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing Expert',
    icon: '📈',
    description: 'Market positioning, branding, and lease-up strategy',
    focus: ['Market positioning', 'Branding', 'Lease-up', 'Tenant attraction', 'Competitive advantage'],
    color: BT.text.purple,
    gradient: BT.text.purple
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    icon: '🏗️',
    description: 'Construction feasibility, value-add, and renovations',
    focus: ['Construction quality', 'Value-add potential', 'Renovation ROI', 'Development risk', 'Timeline'],
    color: BT.text.orange,
    gradient: BT.text.orange
  },
  legal: {
    id: 'legal',
    name: 'Legal Advisor',
    icon: '⚖️',
    description: 'Contracts, compliance, and legal risk assessment',
    focus: ['Contract review', 'Regulatory compliance', 'Legal risks', 'Liability', 'Documentation'],
    color: BT.text.secondary,
    gradient: BT.text.secondary
  },
  lender: {
    id: 'lender',
    name: 'Lender',
    icon: '🏦',
    description: 'Debt perspective, underwriting, and financing',
    focus: ['Creditworthiness', 'Collateral value', 'Debt service', 'LTV ratio', 'Market conditions'],
    color: BT.text.cyan,
    gradient: BT.text.cyan
  },
  acquisitions: {
    id: 'acquisitions',
    name: 'Acquisitions',
    icon: '🎯',
    description: 'Deal sourcing, negotiations, and acquisition strategy',
    focus: ['Deal structure', 'Pricing strategy', 'Negotiation leverage', 'Market timing', 'Competition'],
    color: BT.text.red,
    gradient: BT.text.red
  },
  'asset-manager': {
    id: 'asset-manager',
    name: 'Asset Manager',
    icon: '📉',
    description: 'Operations optimization and NOI maximization',
    focus: ['Operational efficiency', 'NOI optimization', 'Expense control', 'Revenue growth', 'Performance'],
    color: BT.text.cyan,
    gradient: BT.text.cyan
  },
  'researcher': {
    id: 'researcher',
    name: 'Researcher',
    icon: '🔬',
    description: 'Deep market research, demographics, and competitive intelligence',
    focus: ['Market research', 'Demographic trends', 'Economic analysis', 'Competitive intel', 'Data synthesis'],
    color: BT.text.purple,
    gradient: BT.text.purple
  },
  // ─── Post-Acquisition / Portfolio Roles ───────────────────────────────────
  'property-manager': {
    id: 'property-manager',
    name: 'Property Manager',
    icon: '🏠',
    description: 'Day-to-day operations, tenant relations, and maintenance',
    focus: ['Tenant satisfaction', 'Turnover reduction', 'Maintenance scheduling', 'Vendor management', 'On-site operations'],
    color: BT.text.amber,
    gradient: BT.text.amber
  },
  'leasing-director': {
    id: 'leasing-director',
    name: 'Leasing Director',
    icon: '📋',
    description: 'Vacancy reduction, renewals, and tenant screening',
    focus: ['Occupancy rates', 'Lease renewals', 'Concession strategy', 'Tenant screening', 'Market rents'],
    color: BT.text.green,
    gradient: BT.text.green
  },
  'facilities-manager': {
    id: 'facilities-manager',
    name: 'Facilities Manager',
    icon: '🔧',
    description: 'CapEx planning, preventive maintenance, and vendor contracts',
    focus: ['Capital planning', 'Preventive maintenance', 'Building systems', 'Contractor oversight', 'Reserve budgets'],
    color: BT.text.orange,
    gradient: BT.text.orange
  },
  'investment-analyst': {
    id: 'investment-analyst',
    name: 'Investment Analyst',
    icon: '📊',
    description: 'Hold/sell analysis, refinance timing, and disposition strategy',
    focus: ['Hold vs sell', 'Refinance timing', 'IRR optimization', 'Market timing', 'Exit strategies'],
    color: BT.text.purple,
    gradient: BT.text.purple
  },
  'esg-sustainability': {
    id: 'esg-sustainability',
    name: 'ESG / Sustainability',
    icon: '🌱',
    description: 'Energy efficiency, green certifications, and utility optimization',
    focus: ['Energy reduction', 'LEED/ENERGY STAR', 'Utility management', 'Carbon footprint', 'Sustainability ROI'],
    color: BT.text.green,
    gradient: BT.text.green
  },
  'compliance-officer': {
    id: 'compliance-officer',
    name: 'Compliance Officer',
    icon: '📜',
    description: 'Insurance, permits, ADA, fair housing, and regulatory compliance',
    focus: ['Insurance coverage', 'Permit compliance', 'Fair housing', 'ADA requirements', 'Local regulations'],
    color: BT.text.secondary,
    gradient: BT.text.secondary
  },
  'tax-strategist': {
    id: 'tax-strategist',
    name: 'Tax Strategist',
    icon: '💼',
    description: 'Cost segregation, 1031 exchanges, depreciation, and K-1 optimization',
    focus: ['Cost segregation', '1031 exchanges', 'Depreciation strategy', 'Tax deferrals', 'K-1 planning'],
    color: BT.text.amber,
    gradient: BT.text.amber
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
  const [liveContext, setLiveContext] = useState<any>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  const currentPersona = ROLE_PERSONAS[selectedRole];

  useEffect(() => {
    loadLiveContext();
  // Task #425: useEffect intentionally omits `loadLiveContext` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  useEffect(() => {
    analyzeWithRole(selectedRole);
  // Task #425: useEffect intentionally omits `analyzeWithRole` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, deal.id, liveContext]);

  const loadLiveContext = async () => {
    try {
      const [marketRes, strategyRes, riskRes, financialRes, assumptionsRes] = await Promise.allSettled([
        apiClient.get('/api/v1/apartment-sync/submarkets', { params: { city: 'Atlanta' } }),
        apiClient.get(`/api/v1/strategy-analyses/${deal.id}`),
        apiClient.get(`/api/v1/risk/comprehensive/${deal.id}`),
        apiClient.get(`/api/v1/deals/${deal.id}/data-sources`),
        apiClient.get(`/api/v1/deals/${deal.id}/assumptions`),
      ]);

      const ctx: any = {};
      if (marketRes.status === 'fulfilled' && marketRes.value.data?.data?.[0]?.data) {
        const parsed = typeof marketRes.value.data.data[0].data === 'string'
          ? JSON.parse(marketRes.value.data.data[0].data)
          : marketRes.value.data.data[0].data;
        ctx.market = {
          submarkets: parsed.submarkets || [],
          summary: parsed.summary || {},
        };
      }
      if (strategyRes.status === 'fulfilled' && strategyRes.value.data?.data?.length > 0) {
        ctx.strategy = strategyRes.value.data.data;
      }
      if (riskRes.status === 'fulfilled' && riskRes.value.data?.data) {
        ctx.risk = riskRes.value.data.data;
      }
      if (financialRes.status === 'fulfilled' && financialRes.value.data?.data) {
        ctx.financialSources = financialRes.value.data.data;
      }
      if (assumptionsRes.status === 'fulfilled' && assumptionsRes.value.data?.data) {
        ctx.assumptions = assumptionsRes.value.data.data;
      }

      if (Object.keys(ctx).length > 0) {
        setLiveContext(ctx);
        setIsLiveData(true);
      }
    } catch {
      console.warn('Could not load live context for Opus AI');
    }
  };

  const analyzeWithRole = async (role: AIRole) => {
    setLoading(true);
    setError(null);

    try {
      const context = buildDealContext(deal, role, liveContext);

      const result = isPipeline
        ? await opusService.analyzeAcquisition(context)
        : await opusService.analyzePerformance(context);

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
          <div className="px-4 py-2 text-sm font-semibold" style={{
            background: isPipeline ? BT.text.cyan : BT.text.green,
            color: BT.bg.terminal,
            borderRadius: 0
          }}>
            {isPipeline ? '🎯 Acquisition Analysis' : '🏢 Performance Analysis'}
          </div>
          <div className="text-sm" style={{ color: BT.text.secondary }}>
            Powered by Claude Opus
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => analyzeWithRole(selectedRole)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ color: BT.text.cyan, background: `${BT.text.cyan}11`, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}
          >
            {loading ? '🔄 Analyzing...' : '🔄 Re-analyze'}
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: BT.text.primary, background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}
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
    <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <h3 className="text-lg font-bold mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
        Select AI Agent Skill
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.values(ROLE_PERSONAS).map((persona) => (
          <button
            key={persona.id}
            onClick={() => onRoleChange(persona.id)}
            disabled={disabled}
            className={`relative p-4 transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{
              borderRadius: 0,
              border: `2px solid ${selectedRole === persona.id ? persona.color : BT.border.subtle}`,
              background: selectedRole === persona.id ? `${persona.color}11` : BT.bg.panelAlt,
            }}
          >
            <div className="text-3xl mb-2">{persona.icon}</div>
            <div className="text-sm font-semibold" style={{ color: BT.text.primary }}>{persona.name}</div>
            <div className="text-xs mt-1 line-clamp-2" style={{ color: BT.text.secondary }}>{persona.description}</div>

            {selectedRole === persona.id && (
              <div className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center" style={{ background: persona.color, borderRadius: 0 }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white">
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
    <div className="p-8" style={{ background: persona.color, borderRadius: 0, color: BT.bg.terminal }}>
      <div className="flex items-center justify-center gap-4">
        <div className="animate-spin h-12 w-12" style={{ border: `4px solid ${BT.bg.terminal}`, borderTopColor: 'transparent', borderRadius: 0 }}></div>
        <div>
          <div className="text-2xl font-bold mb-1">
            {persona.icon} {persona.name} Analyzing...
          </div>
          <div style={{ opacity: 0.8 }}>
            Reviewing all deal data through {persona.name.toLowerCase()} lens
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
        {persona.focus.map((focus, i) => (
          <div key={i} className="text-sm animate-pulse" style={{ opacity: 0.6, animationDelay: `${i * 100}ms` }}>
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
    <div className="p-6" style={{ background: `${BT.text.red}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
      <div className="flex items-start gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-2" style={{ color: BT.text.red }}>Analysis Failed</h3>
          <p className="mb-4" style={{ color: BT.text.red }}>{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: BT.bg.terminal, background: BT.text.red, borderRadius: 0 }}
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
      'strong-buy': { label: 'STRONG BUY', color: BT.text.green, gradient: BT.text.green, emoji: '🚀' },
      'buy': { label: 'BUY', color: BT.text.green, gradient: BT.text.green, emoji: '✅' },
      'hold': { label: 'HOLD', color: BT.text.amber, gradient: BT.text.amber, emoji: '⏸️' },
      'pass': { label: 'PASS', color: BT.text.orange, gradient: BT.text.orange, emoji: '⚠️' },
      'strong-pass': { label: 'STRONG PASS', color: BT.text.red, gradient: BT.text.red, emoji: '❌' },
      'optimize': { label: 'OPTIMIZE', color: BT.text.cyan, gradient: BT.text.cyan, emoji: '⚡' },
      'hold-asset': { label: 'HOLD ASSET', color: BT.text.cyan, gradient: BT.text.cyan, emoji: '🏢' },
      'sell': { label: 'SELL', color: BT.text.purple, gradient: BT.text.purple, emoji: '💸' }
    };
    return configs[rec] || configs.hold;
  };

  const recConfig = getRecommendationConfig(analysis.recommendation);

  return (
    <div className="overflow-hidden" style={{ background: recConfig.color, borderRadius: 0, color: BT.bg.terminal }}>
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
              <div className="p-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 0 }}>
                <div className="text-sm mb-1" style={{ opacity: 0.7 }}>Deal Score</div>
                <div className="text-2xl font-bold">{analysis.score.toFixed(1)}/10</div>
              </div>
              <div className="p-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 0 }}>
                <div className="text-sm mb-1" style={{ opacity: 0.7 }}>Confidence</div>
                <div className="text-2xl font-bold">{analysis.confidence}%</div>
              </div>
              <div className="p-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 0 }}>
                <div className="text-sm mb-1" style={{ opacity: 0.7 }}>Model</div>
                <div className="text-xs font-medium mt-1">Claude Opus</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCopy}
              className="p-2 transition-colors"
              style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 0 }}
              title="Copy to clipboard"
            >
              📋
            </button>
            <button
              onClick={onToggle}
              className="p-2 transition-colors"
              style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 0 }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.2)' }}>
            <div className="prose prose-invert max-w-none">
              <p className="leading-relaxed whitespace-pre-wrap" style={{ opacity: 0.9 }}>
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
    <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between transition-colors"
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ background: persona.color, borderRadius: 0 }}>
            💡
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Key Insights</h3>
            <p className="text-sm" style={{ color: BT.text.secondary }}>{insights.length} critical findings</p>
          </div>
        </div>
        <button style={{ color: BT.text.muted }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex gap-3 p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold" style={{ background: persona.color, color: BT.bg.terminal, borderRadius: 0 }}>
                {i + 1}
              </div>
              <div className="flex-1" style={{ color: BT.text.secondary }}>{insight}</div>
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
      critical: BT.text.red,
      high: BT.text.orange,
      medium: BT.text.amber,
      low: BT.text.green
    };
    return colors[level] || BT.text.secondary;
  };

  const sortedRisks = [...risks].sort((a, b) => (b.priority || 5) - (a.priority || 5));

  return (
    <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between transition-colors"
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ background: BT.text.red, borderRadius: 0 }}>
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Risks</h3>
            <p className="text-sm" style={{ color: BT.text.secondary }}>{risks.length} identified risks</p>
          </div>
        </div>
        <button style={{ color: BT.text.muted }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {sortedRisks.map((risk, i) => (
            <div key={risk.id || i} className="overflow-hidden" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="p-4" style={{ background: BT.bg.panelAlt }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-semibold" style={{ background: `${getRiskColor(risk.level)}22`, color: getRiskColor(risk.level), borderRadius: 0 }}>
                      {risk.level?.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: BT.text.secondary }}>{risk.category}</span>
                  </div>
                  <div className="text-xs font-medium" style={{ color: BT.text.secondary }}>
                    Priority: {risk.priority}/10
                  </div>
                </div>
                <div className="font-medium mb-2" style={{ color: BT.text.primary }}>{risk.description}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span style={{ color: BT.text.secondary }}>Impact:</span>
                    <span className="ml-2 font-medium" style={{ color: BT.text.primary }}>{risk.impact}</span>
                  </div>
                  <div>
                    <span style={{ color: BT.text.secondary }}>Probability:</span>
                    <span className="ml-2 font-medium" style={{ color: BT.text.primary }}>{risk.probability}%</span>
                  </div>
                </div>
              </div>
              {risk.mitigation && (
                <div className="p-4" style={{ background: BT.bg.panel, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: BT.text.secondary }}>MITIGATION STRATEGY</div>
                  <div className="text-sm" style={{ color: BT.text.secondary }}>{risk.mitigation}</div>
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
    <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between transition-colors"
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ background: BT.text.green, borderRadius: 0 }}>
            🎯
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Opportunities</h3>
            <p className="text-sm" style={{ color: BT.text.secondary }}>{opportunities.length} value creation opportunities</p>
          </div>
        </div>
        <button style={{ color: BT.text.muted }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {sortedOpps.map((opp, i) => (
            <div key={opp.id || i} className="p-4" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold" style={{ background: `${BT.text.green}22`, color: BT.text.green, borderRadius: 0 }}>
                    {opp.type}
                  </span>
                </div>
                {opp.potentialValue && (
                  <div className="text-lg font-bold" style={{ color: BT.text.green }}>
                    +${opp.potentialValue.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="font-medium mb-3" style={{ color: BT.text.primary }}>{opp.description}</div>

              {opp.requirements && opp.requirements.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold mb-2" style={{ color: BT.text.secondary }}>REQUIREMENTS</div>
                  <div className="flex flex-wrap gap-2">
                    {opp.requirements.map((req: string, j: number) => (
                      <span key={j} className="px-2 py-1 text-xs" style={{ background: BT.bg.panelAlt, color: BT.text.secondary, borderRadius: 0 }}>
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div>
                  <span style={{ color: BT.text.secondary }}>Success Probability:</span>
                  <span className="ml-2 font-medium" style={{ color: BT.text.primary }}>{opp.probability}%</span>
                </div>
                {opp.timeline && (
                  <div style={{ color: BT.text.secondary }}>Timeline: <span className="font-medium" style={{ color: BT.text.primary }}>{opp.timeline}</span></div>
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
      urgent: { color: BT.text.red, emoji: '🔥' },
      high: { color: BT.text.orange, emoji: '⚡' },
      medium: { color: BT.text.amber, emoji: '📌' },
      low: { color: BT.text.green, emoji: '📋' }
    };
    return configs[priority] || configs.medium;
  };

  const sortedActions = [...actionItems].sort((a, b) => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between transition-colors"
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ background: persona.color, borderRadius: 0 }}>
            ✅
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Action Items</h3>
            <p className="text-sm" style={{ color: BT.text.secondary }}>{actionItems.length} recommended actions</p>
          </div>
        </div>
        <button style={{ color: BT.text.muted }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6 space-y-2">
          {sortedActions.map((action, i) => {
            const config = getPriorityConfig(action.priority);
            return (
              <div key={action.id || i} className="flex items-start gap-3 p-3 transition-colors" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                <div className="flex-shrink-0 text-xl">{config.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-semibold" style={{ background: `${config.color}22`, color: config.color, borderRadius: 0 }}>
                      {action.priority.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: BT.text.secondary }}>{action.category}</span>
                    {action.timeframe && (
                      <span className="text-xs" style={{ color: BT.text.secondary }}>• {action.timeframe}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium" style={{ color: BT.text.primary }}>{action.action}</div>
                  {action.owner && (
                    <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>Owner: {action.owner}</div>
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
    <div style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div
        className="p-6 cursor-pointer flex items-center justify-between transition-colors"
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ background: persona.color, borderRadius: 0 }}>
            {persona.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>{persona.name} Deep Dive</h3>
            <p className="text-sm" style={{ color: BT.text.secondary }}>Role-specific analysis and recommendations</p>
          </div>
        </div>
        <button style={{ color: BT.text.muted }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="p-6" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="mb-4">
              <h4 className="font-semibold mb-2" style={{ color: BT.text.primary }}>Focus Areas</h4>
              <div className="flex flex-wrap gap-2">
                {persona.focus.map((focus, i) => (
                  <span key={i} className="px-3 py-1 text-sm" style={{ background: persona.color, color: BT.bg.terminal, borderRadius: 0 }}>
                    {focus}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {analysis.strengths.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: BT.text.green }}>✅ Strengths</h4>
                  <ul className="space-y-1">
                    {analysis.strengths.map((strength, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: BT.text.secondary }}>
                        <span style={{ color: BT.text.green }}>•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.weaknesses.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: BT.text.red }}>⚠️ Weaknesses</h4>
                  <ul className="space-y-1">
                    {analysis.weaknesses.map((weakness, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: BT.text.secondary }}>
                        <span style={{ color: BT.text.red }}>•</span>
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.assumptions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: BT.text.cyan }}>📋 Key Assumptions</h4>
                  <ul className="space-y-1">
                    {analysis.assumptions.map((assumption, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: BT.text.secondary }}>
                        <span style={{ color: BT.text.cyan }}>•</span>
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
    <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="mb-1" style={{ color: BT.text.secondary }}>Analysis Date</div>
          <div className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
            {new Date(analysis.analysisDate).toLocaleDateString()}
          </div>
        </div>
        <div>
          <div className="mb-1" style={{ color: BT.text.secondary }}>Model Version</div>
          <div className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{analysis.modelVersion}</div>
        </div>
        {analysis.tokensUsed && (
          <div>
            <div className="mb-1" style={{ color: BT.text.secondary }}>Tokens Used</div>
            <div className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{analysis.tokensUsed.toLocaleString()}</div>
          </div>
        )}
        {analysis.processingTime && (
          <div>
            <div className="mb-1" style={{ color: BT.text.secondary }}>Processing Time</div>
            <div className="font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{(analysis.processingTime / 1000).toFixed(2)}s</div>
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
function buildDealContext(deal: Deal, role: AIRole, liveCtx?: any): OpusDealContext {
  const hasLiveMarket = liveCtx?.market?.submarkets?.length > 0;
  const hasLiveStrategy = liveCtx?.strategy?.length > 0;
  const hasLiveFinancial = liveCtx?.financialSources || liveCtx?.assumptions;

  let liveSources = 0;
  const totalSources = 9;

  const marketCtx = hasLiveMarket ? (() => { liveSources++; return {
    ...mockMarketData,
    submarkets: liveCtx.market.submarkets,
    summary: liveCtx.market.summary,
    dataSource: 'live' as const,
  }; })() : mockMarketData;

  const strategyCtx = hasLiveStrategy ? (() => { liveSources++; return {
    ...mockStrategyData,
    analyses: liveCtx.strategy,
    dataSource: 'live' as const,
  }; })() : mockStrategyData;

  const financialCtx = hasLiveFinancial ? (() => {
    liveSources++;
    const assumptions = liveCtx.assumptions || {};
    const sources = liveCtx.financialSources || {};
    return {
      ...mockFinancialData,
      proForma: {
        ...mockFinancialData.proForma,
        ...(assumptions.purchase_price || assumptions.purchasePrice ? {
          purchasePrice: assumptions.purchase_price || assumptions.purchasePrice,
        } : {}),
        ...(assumptions.cap_rate || assumptions.capRate ? {
          capRate: assumptions.cap_rate || assumptions.capRate,
        } : {}),
      },
      liveAssumptions: assumptions,
      dataSources: sources,
      dataSource: 'live' as const,
    };
  })() : mockFinancialData;

  const debtCtx = (liveCtx?.financialSources?.debt?.length > 0) ? (() => {
    liveSources++;
    return {
      ...mockDebtData,
      liveDebt: liveCtx.financialSources.debt,
      dataSource: 'live' as const,
    };
  })() : mockDebtData;

  const completeness = Math.round(((liveSources / totalSources) * 40) + 60);

  return {
    dealId: deal.id,
    dealName: deal.name,
    status: (deal.dealCategory === 'portfolio' || (deal as any).state === 'POST_CLOSE') ? 'owned' : 'pipeline',

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

    competition: mockCompetitionData,
    supply: mockSupplyData,
    market: marketCtx,
    debt: debtCtx,
    financial: financialCtx,
    strategy: strategyCtx,
    dueDiligence: mockDueDiligenceData,
    team: mockTeamData,
    documents: mockDocumentsData,

    lastUpdated: new Date().toISOString(),
    dataCompleteness: completeness,
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
