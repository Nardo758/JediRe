/**
 * Agent Registry - Defines all JediRE agents and their capabilities
 * 
 * Each agent has specific responsibilities, topics it subscribes to,
 * and topics it publishes.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { AgentCode } from './agentBus';

// ============================================================================
// Types
// ============================================================================

export interface AgentDefinition {
  code: AgentCode;
  name: string;
  shortName: string;
  emoji: string;
  color: string;              // For UI theming
  description: string;
  capabilities: string[];     // What this agent can do
  subscribesTo: string[];     // Topics it listens to
  publishes: string[];        // Topics it produces
  canChatWithUser: boolean;   // Can user directly query this agent?
  priority: number;           // Display order (lower = higher priority)
}

export interface AgentQuery {
  agentCode: AgentCode;
  query: string;
  context?: {
    dealId?: string;
    msaId?: string;
    timeframe?: string;
  };
}

// ============================================================================
// Agent Definitions
// ============================================================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    code: 'ORCHESTRATOR',
    name: 'JEDI Orchestrator',
    shortName: 'JEDI',
    emoji: '🤖',
    color: '#00D4FF',  // Cyan
    description: 'Main AI coordinator - manages all agents and communicates with you',
    capabilities: [
      'Coordinate multi-agent workflows',
      'Send mobile notifications',
      'Synthesize insights from all agents',
      'Answer general questions',
      'Route queries to specialized agents',
    ],
    subscribesTo: ['*'],  // Listens to everything
    publishes: ['user_response', 'agent_task', 'notification', 'workflow_status'],
    canChatWithUser: true,
    priority: 0,
  },
  {
    code: 'SUPPLY',
    name: 'Supply Agent',
    shortName: 'Supply',
    emoji: '📦',
    color: '#F5A623',  // Orange
    description: 'Tracks construction pipeline, deliveries, and competitive supply',
    capabilities: [
      'Monitor construction starts and completions',
      'Track competitive developments',
      'Forecast supply pressure',
      'Alert on new permits filed',
      'Compare pipeline to historical absorption',
    ],
    subscribesTo: ['deal_added', 'market_selected', 'trade_area_updated', 'demand_data'],
    publishes: ['pipeline_data', 'supply_risk', 'competition_alert', 'permit_alert', 'delivery_forecast'],
    canChatWithUser: true,
    priority: 1,
  },
  {
    code: 'DEMAND',
    name: 'Demand Agent',
    shortName: 'Demand',
    emoji: '📈',
    color: '#7ED321',  // Green
    description: 'Analyzes absorption, leasing velocity, job growth, and demand drivers',
    capabilities: [
      'Track absorption rates',
      'Monitor leasing velocity',
      'Analyze employment trends',
      'Forecast rent growth',
      'Identify demand drivers',
    ],
    subscribesTo: ['deal_added', 'market_selected', 'supply_data', 'news_sentiment'],
    publishes: ['demand_forecast', 'absorption_rate', 'rent_pressure', 'employment_update', 'demand_alert'],
    canChatWithUser: true,
    priority: 2,
  },
  {
    code: 'NEWS',
    name: 'News Agent',
    shortName: 'News',
    emoji: '📰',
    color: '#4A90E2',  // Blue
    description: 'Monitors market news, sentiment, and headline impact on deals',
    capabilities: [
      'Scan real-time market news',
      'Analyze sentiment shifts',
      'Calculate JEDI score impact',
      'Track employer announcements',
      'Monitor regulatory changes',
    ],
    subscribesTo: ['deal_added', 'market_selected', 'trade_area_updated'],
    publishes: ['news_alert', 'sentiment_shift', 'headline_impact', 'employer_announcement', 'regulatory_update'],
    canChatWithUser: true,
    priority: 3,
  },
  {
    code: 'DEBT',
    name: 'Debt Agent',
    shortName: 'Debt',
    emoji: '🏦',
    color: '#9B59B6',  // Purple
    description: 'Tracks interest rates, spreads, lender activity, and financing options',
    capabilities: [
      'Monitor rate movements',
      'Track lender appetite',
      'Compare financing options',
      'Calculate debt metrics',
      'Alert on rate triggers',
    ],
    subscribesTo: ['deal_added', 'proforma_updated', 'market_selected'],
    publishes: ['rate_update', 'financing_options', 'debt_alert', 'lender_activity', 'spread_change'],
    canChatWithUser: true,
    priority: 4,
  },
  {
    code: 'STRATEGY',
    name: 'Strategy Agent',
    shortName: 'Strategy',
    emoji: '🎯',
    color: '#E74C3C',  // Red
    description: 'Synthesizes all signals into actionable strategy recommendations',
    capabilities: [
      'Generate deal recommendations',
      'Calculate optimal timing',
      'Identify risk/reward balance',
      'Compare strategy alternatives',
      'Update JEDI scores',
    ],
    subscribesTo: ['*'],  // Listens to all agents
    publishes: ['strategy_recommendation', 'jedi_score_update', 'timing_analysis', 'risk_reward_matrix'],
    canChatWithUser: true,
    priority: 5,
  },
  {
    code: 'CASH',
    name: 'Cash Agent',
    shortName: 'Cash',
    emoji: '💰',
    color: '#27AE60',  // Emerald
    description: 'Models cash flow, distributions, and waterfall analysis',
    capabilities: [
      'Project cash flows',
      'Model waterfall distributions',
      'Calculate IRR scenarios',
      'Track actual vs projected',
      'Alert on variance triggers',
    ],
    subscribesTo: ['deal_added', 'proforma_updated', 'debt_update', 'demand_forecast'],
    publishes: ['cashflow_projection', 'distribution_schedule', 'irr_update', 'variance_alert'],
    canChatWithUser: true,
    priority: 6,
  },
  {
    code: 'ZONING',
    name: 'Zoning Agent',
    shortName: 'Zoning',
    emoji: '📋',
    color: '#8E44AD',  // Violet
    description: 'Analyzes zoning, entitlements, and regulatory requirements',
    capabilities: [
      'Parse zoning codes',
      'Calculate development capacity',
      'Track entitlement timelines',
      'Monitor variance requests',
      'Alert on code changes',
    ],
    subscribesTo: ['deal_added', 'parcel_selected', 'regulatory_update'],
    publishes: ['zoning_analysis', 'entitlement_status', 'capacity_calculation', 'regulatory_risk'],
    canChatWithUser: true,
    priority: 7,
  },
  {
    code: 'COMPS',
    name: 'Comps Agent',
    shortName: 'Comps',
    emoji: '🏢',
    color: '#3498DB',  // Bright blue
    description: 'Tracks comparable sales, rents, and market benchmarks',
    capabilities: [
      'Find comparable properties',
      'Analyze sale transactions',
      'Track rent comps',
      'Calculate market benchmarks',
      'Identify pricing anomalies',
    ],
    subscribesTo: ['deal_added', 'market_selected', 'trade_area_updated'],
    publishes: ['comp_analysis', 'sale_alert', 'rent_benchmark', 'pricing_insight'],
    canChatWithUser: true,
    priority: 8,
  },
  {
    code: 'RISK',
    name: 'Risk Agent',
    shortName: 'Risk',
    emoji: '⚠️',
    color: '#E67E22',  // Dark orange
    description: 'Monitors risks across all dimensions and triggers alerts',
    capabilities: [
      'Aggregate risk signals',
      'Calculate risk scores',
      'Monitor trigger thresholds',
      'Generate risk reports',
      'Prioritize alerts',
    ],
    subscribesTo: ['*'],  // Listens to all for risk signals
    publishes: ['risk_alert', 'risk_score_update', 'threshold_breach', 'risk_report'],
    canChatWithUser: true,
    priority: 9,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getAgentByCode(code: AgentCode): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find(a => a.code === code);
}

export function getAgentsByCapability(capability: string): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => 
    a.capabilities.some(c => c.toLowerCase().includes(capability.toLowerCase()))
  );
}

export function getAgentsThatPublish(topic: string): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => 
    a.publishes.some(p => p === topic || topic.startsWith(p))
  );
}

export function getAgentsThatSubscribeTo(topic: string): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => 
    a.subscribesTo.includes('*') || 
    a.subscribesTo.some(s => s === topic || topic.startsWith(s))
  );
}

export function getChatableAgents(): AgentDefinition[] {
  return AGENT_DEFINITIONS
    .filter(a => a.canChatWithUser)
    .sort((a, b) => a.priority - b.priority);
}

export function getAgentColor(code: AgentCode): string {
  return getAgentByCode(code)?.color || '#888888';
}

export function getAgentEmoji(code: AgentCode): string {
  return getAgentByCode(code)?.emoji || '🤖';
}

// ============================================================================
// Suggested Prompts per Agent
// ============================================================================

export const AGENT_SUGGESTED_PROMPTS: Record<AgentCode, string[]> = {
  ORCHESTRATOR: [
    "What's the overall status of my portfolio?",
    "Which deals need my attention today?",
    "Give me a market briefing",
    "What changed since yesterday?",
  ],
  SUPPLY: [
    "What's in the pipeline for this submarket?",
    "Show me competitive developments nearby",
    "When are the next deliveries expected?",
    "How does supply compare to absorption?",
  ],
  DEMAND: [
    "What's the absorption trend?",
    "How is employment growth looking?",
    "What's driving demand here?",
    "Forecast rent growth for next 12 months",
  ],
  NEWS: [
    "Any major headlines affecting my deals?",
    "What's the market sentiment?",
    "Recent employer announcements?",
    "Any regulatory news I should know about?",
  ],
  DEBT: [
    "What are current rates for this deal type?",
    "Which lenders are active in this market?",
    "Compare financing options",
    "Any rate movement alerts?",
  ],
  STRATEGY: [
    "What's your recommendation for this deal?",
    "Is now a good time to acquire?",
    "What's the risk/reward balance?",
    "Compare hold vs sell scenarios",
  ],
  CASH: [
    "Project cash flows for next 5 years",
    "What are the expected distributions?",
    "Calculate IRR at different exit caps",
    "Any variance from projections?",
  ],
  ZONING: [
    "What's allowed on this parcel?",
    "Calculate maximum development capacity",
    "What entitlements are needed?",
    "Any recent zoning changes?",
  ],
  COMPS: [
    "Find comparable sales",
    "What are rent comps showing?",
    "How does pricing compare to market?",
    "Any recent transactions nearby?",
  ],
  RISK: [
    "What are the top risks for this deal?",
    "Any threshold breaches?",
    "Generate a risk report",
    "Which deals have elevated risk?",
  ],
};

// ============================================================================
// Agent Communication Templates
// ============================================================================

export const AGENT_INTRO_MESSAGES: Record<AgentCode, string> = {
  ORCHESTRATOR: "I'm JEDI, your main AI assistant. I coordinate all the specialized agents and keep you informed. How can I help?",
  SUPPLY: "I'm tracking supply and construction in your markets. I can tell you about pipeline, deliveries, and competitive developments.",
  DEMAND: "I analyze demand drivers - absorption, leasing velocity, employment, and rent trends. What would you like to know?",
  NEWS: "I monitor market news and headlines that could impact your deals. I can brief you on recent developments.",
  DEBT: "I track financing markets - rates, spreads, and lender activity. Ask me about debt options for your deals.",
  STRATEGY: "I synthesize signals from all agents to recommend optimal strategies. Let's talk about your deal or portfolio.",
  CASH: "I model cash flows, distributions, and returns. I can project scenarios and track variance from plan.",
  ZONING: "I analyze zoning codes and entitlements. Tell me about a property and I'll explain what's possible.",
  COMPS: "I track comparable sales and rents. I can help you benchmark pricing and find relevant transactions.",
  RISK: "I monitor risks across all dimensions. I'll alert you when something needs attention.",
};
