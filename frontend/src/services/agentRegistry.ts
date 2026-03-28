/**
 * Agent Registry - Defines all JediRE agents and their capabilities
 * 
 * 16 Analyst Agents + 2 Core Agents = 18 Total
 * 
 * @version 3.0.0
 * @date 2026-03-28
 */

import { AgentCode } from './agentBus';

// ============================================================================
// Types
// ============================================================================

export type AgentCategory = 'core' | 'analyst';

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
  color: string;
  category: AgentCategory;
  focus: string;              // What this agent focuses on
  description: string;
  capabilities: string[];
  subscribesTo: string[];
  publishes: string[];
  canChatWithUser: boolean;
  priority: number;
  defaultModel: AIModel;
  recommendedModels: AIModel[];
}

// ============================================================================
// AI Models
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
// Agent Definitions - 18 Total (2 Core + 16 Analysts)
// ============================================================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // CORE AGENTS
  // ══════════════════════════════════════════════════════════════════════════
  {
    code: 'ORCHESTRATOR',
    name: 'JEDI Orchestrator',
    shortName: 'JEDI',
    icon: 'Brain',
    color: '#00D4FF',
    category: 'core',
    focus: 'Coordination, notifications',
    description: 'Main AI coordinator - manages all agents and communicates with you',
    capabilities: ['Coordinate workflows', 'Send notifications', 'Synthesize insights', 'Route queries'],
    subscribesTo: ['*'],
    publishes: ['user_response', 'agent_task', 'notification'],
    canChatWithUser: true,
    priority: 0,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4-turbo'],
  },
  {
    code: 'STRATEGY',
    name: 'Strategy Engine',
    shortName: 'Strategy',
    icon: 'Target',
    color: '#E74C3C',
    category: 'core',
    focus: 'Investment strategy',
    description: 'Synthesizes all signals into actionable investment recommendations',
    capabilities: ['Deal recommendations', 'Timing analysis', 'Risk/reward assessment', 'JEDI scores'],
    subscribesTo: ['*'],
    publishes: ['strategy_recommendation', 'jedi_score_update'],
    canChatWithUser: true,
    priority: 1,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4'],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYST AGENTS (AN01-AN16)
  // ══════════════════════════════════════════════════════════════════════════
  {
    code: 'AN01',
    name: 'CFO',
    shortName: 'CFO',
    icon: 'LineChart',
    color: '#2ECC71',
    category: 'analyst',
    focus: 'Returns, risk',
    description: 'Analyzes financial returns, risk metrics, and investment performance',
    capabilities: ['IRR analysis', 'Risk assessment', 'Return metrics', 'Portfolio performance'],
    subscribesTo: ['deal_added', 'proforma_updated'],
    publishes: ['return_analysis', 'risk_metrics'],
    canChatWithUser: true,
    priority: 2,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN02',
    name: 'Accountant',
    shortName: 'Accountant',
    icon: 'Calculator',
    color: '#3498DB',
    category: 'analyst',
    focus: 'Tax, GAAP',
    description: 'Handles tax implications, GAAP compliance, and accounting standards',
    capabilities: ['Tax analysis', 'GAAP compliance', 'Depreciation schedules', 'Financial statements'],
    subscribesTo: ['deal_added', 'transaction_completed'],
    publishes: ['tax_analysis', 'accounting_report'],
    canChatWithUser: true,
    priority: 3,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN03',
    name: 'Marketing',
    shortName: 'Marketing',
    icon: 'Megaphone',
    color: '#E91E63',
    category: 'analyst',
    focus: 'Positioning, lease-up',
    description: 'Develops marketing strategies, positioning, and lease-up plans',
    capabilities: ['Market positioning', 'Lease-up strategy', 'Pricing optimization', 'Competitor analysis'],
    subscribesTo: ['deal_added', 'market_selected'],
    publishes: ['marketing_strategy', 'pricing_recommendation'],
    canChatWithUser: true,
    priority: 4,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    code: 'AN04',
    name: 'Developer',
    shortName: 'Developer',
    icon: 'Hammer',
    color: '#FF9800',
    category: 'analyst',
    focus: 'Construction, value-add',
    description: 'Analyzes development feasibility, construction costs, and value-add opportunities',
    capabilities: ['Construction analysis', 'Value-add assessment', 'Cost estimation', 'Timeline planning'],
    subscribesTo: ['deal_added', 'zoning_analysis'],
    publishes: ['development_plan', 'construction_estimate'],
    canChatWithUser: true,
    priority: 5,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN05',
    name: 'Legal',
    shortName: 'Legal',
    icon: 'Scale',
    color: '#607D8B',
    category: 'analyst',
    focus: 'Contracts, compliance',
    description: 'Reviews contracts, ensures compliance, and identifies legal risks',
    capabilities: ['Contract review', 'Compliance check', 'Legal risk analysis', 'Due diligence'],
    subscribesTo: ['deal_added', 'document_uploaded'],
    publishes: ['legal_review', 'compliance_alert'],
    canChatWithUser: true,
    priority: 6,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4'],
  },
  {
    code: 'AN06',
    name: 'Lender',
    shortName: 'Lender',
    icon: 'Landmark',
    color: '#9B59B6',
    category: 'analyst',
    focus: 'Debt, underwriting',
    description: 'Analyzes debt options, underwriting criteria, and financing structures',
    capabilities: ['Debt analysis', 'Underwriting review', 'Lender matching', 'Rate comparison'],
    subscribesTo: ['deal_added', 'proforma_updated'],
    publishes: ['debt_options', 'underwriting_analysis'],
    canChatWithUser: true,
    priority: 7,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN07',
    name: 'Acquisitions',
    shortName: 'Acquisitions',
    icon: 'Handshake',
    color: '#00BCD4',
    category: 'analyst',
    focus: 'Deal sourcing, negotiations',
    description: 'Sources deals, analyzes opportunities, and supports negotiations',
    capabilities: ['Deal sourcing', 'Opportunity screening', 'Negotiation strategy', 'LOI drafting'],
    subscribesTo: ['market_selected', 'opportunity_found'],
    publishes: ['deal_opportunity', 'negotiation_insight'],
    canChatWithUser: true,
    priority: 8,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-opus'],
  },
  {
    code: 'AN08',
    name: 'Asset Manager',
    shortName: 'Asset Mgr',
    icon: 'Building',
    color: '#795548',
    category: 'analyst',
    focus: 'NOI optimization',
    description: 'Optimizes NOI, manages assets, and identifies improvement opportunities',
    capabilities: ['NOI optimization', 'Expense analysis', 'Revenue enhancement', 'Business plan execution'],
    subscribesTo: ['deal_added', 'performance_data'],
    publishes: ['optimization_recommendation', 'noi_analysis'],
    canChatWithUser: true,
    priority: 9,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN09',
    name: 'Property Manager',
    shortName: 'Prop Mgr',
    icon: 'Home',
    color: '#4CAF50',
    category: 'analyst',
    focus: 'Tenant relations, maintenance',
    description: 'Manages tenant relations, maintenance, and property operations',
    capabilities: ['Tenant management', 'Maintenance planning', 'Vendor coordination', 'Resident satisfaction'],
    subscribesTo: ['deal_added', 'tenant_event'],
    publishes: ['property_report', 'maintenance_alert'],
    canChatWithUser: true,
    priority: 10,
    defaultModel: 'claude-3-haiku',
    recommendedModels: ['claude-3-haiku', 'gpt-3.5-turbo'],
  },
  {
    code: 'AN10',
    name: 'Leasing Director',
    shortName: 'Leasing',
    icon: 'Key',
    color: '#CDDC39',
    category: 'analyst',
    focus: 'Vacancy, renewals',
    description: 'Manages leasing strategy, vacancy reduction, and tenant renewals',
    capabilities: ['Leasing strategy', 'Renewal optimization', 'Vacancy analysis', 'Rent pricing'],
    subscribesTo: ['deal_added', 'lease_event'],
    publishes: ['leasing_recommendation', 'vacancy_alert'],
    canChatWithUser: true,
    priority: 11,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    code: 'AN11',
    name: 'Facilities Manager',
    shortName: 'Facilities',
    icon: 'Wrench',
    color: '#FF5722',
    category: 'analyst',
    focus: 'CapEx, vendors',
    description: 'Manages capital expenditures, vendor relationships, and building systems',
    capabilities: ['CapEx planning', 'Vendor management', 'Building systems', 'Preventive maintenance'],
    subscribesTo: ['deal_added', 'maintenance_event'],
    publishes: ['capex_plan', 'vendor_recommendation'],
    canChatWithUser: true,
    priority: 12,
    defaultModel: 'claude-3-haiku',
    recommendedModels: ['claude-3-haiku', 'gpt-3.5-turbo'],
  },
  {
    code: 'AN12',
    name: 'Investment Analyst',
    shortName: 'Inv Analyst',
    icon: 'TrendingUp',
    color: '#673AB7',
    category: 'analyst',
    focus: 'Hold/sell, refinance',
    description: 'Analyzes hold vs sell decisions, refinancing opportunities, and investment timing',
    capabilities: ['Hold/sell analysis', 'Refinance modeling', 'Exit strategy', 'Market timing'],
    subscribesTo: ['deal_added', 'market_data'],
    publishes: ['investment_recommendation', 'exit_analysis'],
    canChatWithUser: true,
    priority: 13,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4-turbo'],
  },
  {
    code: 'AN13',
    name: 'ESG',
    shortName: 'ESG',
    icon: 'Leaf',
    color: '#8BC34A',
    category: 'analyst',
    focus: 'Energy, sustainability',
    description: 'Analyzes ESG factors, energy efficiency, and sustainability initiatives',
    capabilities: ['ESG assessment', 'Energy analysis', 'Sustainability planning', 'Green certifications'],
    subscribesTo: ['deal_added', 'building_data'],
    publishes: ['esg_report', 'sustainability_recommendation'],
    canChatWithUser: true,
    priority: 14,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    code: 'AN14',
    name: 'Compliance',
    shortName: 'Compliance',
    icon: 'ShieldCheck',
    color: '#009688',
    category: 'analyst',
    focus: 'Insurance, permits',
    description: 'Ensures regulatory compliance, insurance coverage, and permit requirements',
    capabilities: ['Compliance monitoring', 'Insurance review', 'Permit tracking', 'Regulatory updates'],
    subscribesTo: ['deal_added', 'regulatory_event'],
    publishes: ['compliance_report', 'permit_alert'],
    canChatWithUser: true,
    priority: 15,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'gpt-4-turbo'],
  },
  {
    code: 'AN15',
    name: 'Tax Strategist',
    shortName: 'Tax',
    icon: 'Receipt',
    color: '#F44336',
    category: 'analyst',
    focus: 'Cost seg, 1031s',
    description: 'Optimizes tax strategy including cost segregation and 1031 exchanges',
    capabilities: ['Cost segregation', '1031 exchange planning', 'Tax optimization', 'Depreciation strategy'],
    subscribesTo: ['deal_added', 'transaction_event'],
    publishes: ['tax_strategy', 'exchange_recommendation'],
    canChatWithUser: true,
    priority: 16,
    defaultModel: 'claude-3-opus',
    recommendedModels: ['claude-3-opus', 'gpt-4'],
  },
  {
    code: 'AN16',
    name: 'Researcher',
    shortName: 'Researcher',
    icon: 'Search',
    color: '#3F51B5',
    category: 'analyst',
    focus: 'Market research, demographics',
    description: 'Conducts market research, demographic analysis, and competitive intelligence',
    capabilities: ['Market research', 'Demographic analysis', 'Competitive intel', 'Trend analysis'],
    subscribesTo: ['market_selected', 'trade_area_updated'],
    publishes: ['research_report', 'market_insight'],
    canChatWithUser: true,
    priority: 17,
    defaultModel: 'claude-3-sonnet',
    recommendedModels: ['claude-3-sonnet', 'claude-3-haiku'],
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

export function getCoreAgents(): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => a.category === 'core');
}

export function getAnalystAgents(): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => a.category === 'analyst');
}

export function getChatableAgents(): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter(a => a.canChatWithUser).sort((a, b) => a.priority - b.priority);
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
  ORCHESTRATOR: ["Portfolio status?", "What needs attention?", "Market briefing", "Today's priorities"],
  STRATEGY: ["Deal recommendation?", "Hold vs sell?", "Risk/reward analysis", "Exit timing"],
  AN01: ["What's the IRR?", "Risk metrics?", "Return analysis", "Performance vs plan"],
  AN02: ["Tax implications?", "GAAP treatment?", "Depreciation schedule", "Year-end planning"],
  AN03: ["Marketing strategy?", "Lease-up timeline?", "Pricing recommendations", "Competitive positioning"],
  AN04: ["Development feasibility?", "Construction costs?", "Value-add opportunities", "Timeline estimate"],
  AN05: ["Contract review needed?", "Compliance issues?", "Legal risks?", "Due diligence status"],
  AN06: ["Best debt options?", "Current rates?", "Lender recommendations", "Underwriting criteria"],
  AN07: ["New opportunities?", "Negotiation strategy?", "LOI terms", "Market timing"],
  AN08: ["NOI optimization?", "Expense reduction?", "Revenue opportunities", "Business plan status"],
  AN09: ["Tenant issues?", "Maintenance needs?", "Vendor performance", "Resident satisfaction"],
  AN10: ["Vacancy status?", "Renewal strategy?", "Rent pricing", "Leasing pipeline"],
  AN11: ["CapEx needs?", "Vendor bids?", "Building systems status", "Preventive maintenance"],
  AN12: ["Hold or sell?", "Refinance opportunity?", "Exit scenarios", "Market timing"],
  AN13: ["ESG score?", "Energy efficiency?", "Sustainability options", "Green certifications"],
  AN14: ["Compliance status?", "Insurance coverage?", "Permit requirements", "Regulatory changes"],
  AN15: ["Tax strategy?", "Cost seg opportunity?", "1031 exchange?", "Depreciation optimization"],
  AN16: ["Market research?", "Demographics?", "Competitive analysis", "Trend insights"],
};

// ============================================================================
// Agent Intro Messages
// ============================================================================

export const AGENT_INTRO_MESSAGES: Record<AgentCode, string> = {
  ORCHESTRATOR: "I'm JEDI, your main AI coordinator. I manage all agents and keep you informed across your portfolio.",
  STRATEGY: "I'm the Strategy Engine. I synthesize signals from all analysts to recommend optimal investment decisions.",
  AN01: "I'm your CFO agent. I analyze returns, risk metrics, and overall investment performance.",
  AN02: "I'm the Accountant. I handle tax implications, GAAP compliance, and financial reporting.",
  AN03: "I'm Marketing. I develop positioning strategies, lease-up plans, and pricing optimization.",
  AN04: "I'm the Developer agent. I analyze construction feasibility, costs, and value-add opportunities.",
  AN05: "I'm Legal. I review contracts, ensure compliance, and identify legal risks.",
  AN06: "I'm the Lender agent. I analyze debt options, underwriting criteria, and financing structures.",
  AN07: "I'm Acquisitions. I source deals, screen opportunities, and support negotiations.",
  AN08: "I'm the Asset Manager. I optimize NOI, manage performance, and execute business plans.",
  AN09: "I'm the Property Manager. I handle tenant relations, maintenance, and daily operations.",
  AN10: "I'm the Leasing Director. I manage leasing strategy, vacancy reduction, and renewals.",
  AN11: "I'm Facilities. I manage CapEx planning, vendors, and building systems.",
  AN12: "I'm the Investment Analyst. I analyze hold/sell decisions, refinancing, and exit strategies.",
  AN13: "I'm ESG. I assess sustainability, energy efficiency, and environmental factors.",
  AN14: "I'm Compliance. I monitor regulations, insurance, and permit requirements.",
  AN15: "I'm the Tax Strategist. I optimize taxes through cost segregation, 1031s, and depreciation.",
  AN16: "I'm the Researcher. I conduct market research, demographic analysis, and competitive intelligence.",
};
