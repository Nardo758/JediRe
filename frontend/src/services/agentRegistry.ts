/**
 * Agent Registry - Defines all JediRE agents and their capabilities
 * 
 * Each agent has specific responsibilities, topics it subscribes to,
 * and topics it publishes.
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

import { AgentCode } from './agentBus';

// ============================================================================
// Types
// ============================================================================

export type AgentCategory = 'core' | 'analyst' | 'specialist';

export type AIModel = 
  | 'claude-3-opus'
  | 'claude-3-sonnet' 
  | 'claude-3-haiku'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'gemini-pro'
  | 'llama-3-70b';

export interface AgentDefinition {
  code: AgentCode;
  name: string;
  shortName: string;
  icon: string;               // Lucide icon name
  color: string;              // For UI theming
  category: AgentCategory;    // Agent type grouping
  description: string;
  capabilities: string[];     // What this agent can do
  subscribesTo: string[];     // Topics it listens to
  publishes: string[];        // Topics it produces
  canChatWithUser: boolean;   // Can user directly query this agent?
  priority: number;           // Display order (lower = higher priority)
  defaultModel: AIModel;      // Default AI model for this agent
  recommendedModels: AIModel[]; // Models that work well for this agent
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
// Available AI Models
// ============================================================================

export const AI_MODELS: Record<AIModel, { name: string; provider: string; speed: string; cost: string }> = {
  'claude-3-opus': { name: 'Claude 3 Opus', provider: 'Anthropic', speed: 'Slow', cost: '$$$' },
  'claude-3-sonnet': { name: 'Claude 3 Sonnet', provider: 'Anthropic', speed: 'Medium', cost: '$$' },
  'claude-3-haiku': { name: 'Claude 3 Haiku', provider: 'Anthropic', speed: 'Fast', cost: '$' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', provider: 'OpenAI', speed: 'Medium', cost: '$$' },
  'gpt-4': { name: 'GPT-4', provider: 'OpenAI', speed: 'Slow', cost: '$$$' },
  'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', provider: 'OpenAI', speed: 'Fast', cost: '$' },
  'gemini-pro': { name: 'Gemini Pro', provider: 'Google', speed: 'Fast', cost: '$' },
  'llama-3-70b': { name: 'Llama 3 70B', provider: 'Meta', speed: 'Medium', cost: '$' },
};

// ============================================================================
// Agent Definitions
// ============================================================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  // ── Core Agents ──────────────────────────────────────────────
  {
    code: 'ORCHESTRATOR',
    name: 'JEDI Orchestrator',
    shortName: 'JEDI',
    icon: 'Brain',
    color: '#00D4FF',
    category: 'core',
    description: 'Main AI coordinator - manages all agents and communicates with you',
    capabilities: [
      'Coordinate multi-agent workflows',
      'Send mobile notifications',
      'Synthesize insights from all agents',
      'Answer general questions',
      'Route queries to specialized agents',
    ],
    subscribesTo: ['*'],
    publishes: ['user_response', 'agent_task', 'notification', 'workflow_status'],
    canChatWithUser: true,
    priority: 0,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4-turbo'],
  },
  {
    code: 'STRATEGY',
    name: 'Strategy Agent',
    shortName: 'Strategy',
    icon: 'Target',
    color: '#E74C3C',
    category: 'core',
    description: 'Synthesizes all signals into actionable strategy recommendations',
    capabilities: [
      'Generate deal recommendations',
      'Calculate optimal timing',
      'Identify risk/reward balance',
      'Compare strategy alternatives',
      'Update JEDI scores',
    ],
    subscribesTo: ['*'],
    publishes: ['strategy_recommendation', 'jedi_score_update', 'timing_analysis', 'risk_reward_matrix'],
    canChatWithUser: true,
    priority: 1,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4'],
  },

  // ── Analyst Agents ───────────────────────────────────────────
  {
    code: 'SUPPLY',
    name: 'Supply Analyst',
    shortName: 'Supply',
    icon: 'Building2',
    color: '#F5A623',
    category: 'analyst',
    description: 'Analyzes construction pipeline, deliveries, and competitive supply',
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
    priority: 2,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'DEMAND',
    name: 'Demand Analyst',
    shortName: 'Demand',
    icon: 'TrendingUp',
    color: '#7ED321',
    category: 'analyst',
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
    priority: 3,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'COMPS',
    name: 'Comps Analyst',
    shortName: 'Comps',
    icon: 'BarChart3',
    color: '#3498DB',
    category: 'analyst',
    description: 'Analyzes comparable sales, rents, and market benchmarks',
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
    priority: 4,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    code: 'NEWS',
    name: 'News Analyst',
    shortName: 'News',
    icon: 'Newspaper',
    color: '#4A90E2',
    category: 'analyst',
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
    priority: 5,
    defaultModel: 'claude-3-haiku',
    recommendedModels: ['claude-3-haiku', 'gpt-3.5-turbo'],
  },
  {
    code: 'RISK',
    name: 'Risk Analyst',
    shortName: 'Risk',
    icon: 'ShieldAlert',
    color: '#E67E22',
    category: 'analyst',
    description: 'Monitors risks across all dimensions and triggers alerts',
    capabilities: [
      'Aggregate risk signals',
      'Calculate risk scores',
      'Monitor trigger thresholds',
      'Generate risk reports',
      'Prioritize alerts',
    ],
    subscribesTo: ['*'],
    publishes: ['risk_alert', 'risk_score_update', 'threshold_breach', 'risk_report'],
    canChatWithUser: true,
    priority: 6,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-opus'],
  },

  // ── Specialist Agents ────────────────────────────────────────
  {
    code: 'DEBT',
    name: 'Debt Specialist',
    shortName: 'Debt',
    icon: 'Landmark',
    color: '#9B59B6',
    category: 'specialist',
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
    priority: 7,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'CASH',
    name: 'Cash Flow Specialist',
    shortName: 'Cash',
    icon: 'DollarSign',
    color: '#27AE60',
    category: 'specialist',
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
    priority: 8,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'ZONING',
    name: 'Zoning Specialist',
    shortName: 'Zoning',
    icon: 'Map',
    color: '#8E44AD',
    category: 'specialist',
    description: 'Analyzes zoning codes, entitlements, and regulatory requirements',
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
    priority: 9,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-opus'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getAgentByCode(code: AgentCode): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find(a => a.code === code);
}

export function getAgentsByCategory(category: AgentCategory): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => a.category === category);
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

export function getAgentIcon(code: AgentCode): string {
  return getAgentByCode(code)?.icon || 'Bot';
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
  SUPPLY: "I analyze supply and construction in your markets. I can tell you about pipeline, deliveries, and competitive developments.",
  DEMAND: "I analyze demand drivers - absorption, leasing velocity, employment, and rent trends. What would you like to know?",
  NEWS: "I monitor market news and headlines that could impact your deals. I can brief you on recent developments.",
  DEBT: "I track financing markets - rates, spreads, and lender activity. Ask me about debt options for your deals.",
  STRATEGY: "I synthesize signals from all agents to recommend optimal strategies. Let's talk about your deal or portfolio.",
  CASH: "I model cash flows, distributions, and returns. I can project scenarios and track variance from plan.",
  ZONING: "I analyze zoning codes and entitlements. Tell me about a property and I'll explain what's possible.",
  COMPS: "I track comparable sales and rents. I can help you benchmark pricing and find relevant transactions.",
  RISK: "I monitor risks across all dimensions. I'll alert you when something needs attention.",
};
