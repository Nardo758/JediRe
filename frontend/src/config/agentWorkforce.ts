/**
 * Agent Workforce Configuration
 * Unified system for all JEDI RE AI agents - both task workers and analyst personas
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentCategory = 'task' | 'analyst';
export type AgentStatus = 'active' | 'idle' | 'disabled' | 'error';

export interface AgentDefinition {
  id: string;
  code: string;           // e.g., "A01", "AN01"
  name: string;
  category: AgentCategory;
  icon: string;
  description: string;
  capabilities: string[];
  modules: string[];      // Which modules this agent can operate in
  autonomyLevel: 'full' | 'supervised' | 'manual';  // How independently it can act
  costPerTask?: number;   // API/compute cost estimate
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK AGENTS - Backend workers that collect, process, and analyze data
// ═══════════════════════════════════════════════════════════════════════════════

export const TASK_AGENTS: AgentDefinition[] = [
  {
    id: 'data-collector',
    code: 'A01',
    name: 'Data Collector',
    category: 'task',
    icon: '🔍',
    description: 'Scrapes and aggregates property data from multiple sources',
    capabilities: ['Web scraping', 'API integration', 'Data normalization', 'Rate limiting'],
    modules: ['market', 'comps', 'supply'],
    autonomyLevel: 'full',
  },
  {
    id: 'zoning-agent',
    code: 'A02',
    name: 'Zoning Agent',
    category: 'task',
    icon: '📐',
    description: 'Parses municipal codes and calculates development capacity',
    capabilities: ['Code parsing', 'Setback calculation', 'Use determination', 'Entitlement tracking'],
    modules: ['zoning', 'design-3d'],
    autonomyLevel: 'full',
  },
  {
    id: 'market-analyst',
    code: 'A03',
    name: 'Market Analyst',
    category: 'task',
    icon: '📊',
    description: 'Monitors and analyzes real-time market metrics',
    capabilities: ['Trend analysis', 'Absorption tracking', 'Rent forecasting', 'Supply monitoring'],
    modules: ['market', 'supply', 'strategy'],
    autonomyLevel: 'full',
  },
  {
    id: 'risk-scorer',
    code: 'A04',
    name: 'Risk Scorer',
    category: 'task',
    icon: '⚠️',
    description: 'Calculates and monitors risk scores across all categories',
    capabilities: ['Risk calculation', 'Alert generation', 'Threshold monitoring', 'Trend detection'],
    modules: ['risk', 'overview'],
    autonomyLevel: 'full',
  },
  {
    id: 'strategy-engine',
    code: 'A05',
    name: 'Strategy Engine',
    category: 'task',
    icon: '🎯',
    description: 'Evaluates and recommends optimal deal strategies',
    capabilities: ['Strategy scoring', 'Exit analysis', 'Scenario modeling', 'Arbitrage detection'],
    modules: ['strategy', 'proforma'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'orchestrator',
    code: 'A06',
    name: 'Orchestrator',
    category: 'task',
    icon: '🎛️',
    description: 'Coordinates multi-agent workflows and task prioritization',
    capabilities: ['Task routing', 'Priority management', 'Conflict resolution', 'Status tracking'],
    modules: ['all'],
    autonomyLevel: 'full',
  },
  {
    id: 'comp-scraper',
    code: 'A07',
    name: 'Comp Scraper',
    category: 'task',
    icon: '🏘️',
    description: 'Discovers and analyzes comparable properties',
    capabilities: ['Comp discovery', 'Rent extraction', 'Amenity matching', 'Distance calculation'],
    modules: ['comps', 'market'],
    autonomyLevel: 'full',
  },
  {
    id: 'document-processor',
    code: 'A08',
    name: 'Document Processor',
    category: 'task',
    icon: '📄',
    description: 'Extracts and indexes data from deal documents',
    capabilities: ['OCR processing', 'Data extraction', 'Document classification', 'Search indexing'],
    modules: ['deal-tools', 'risk'],
    autonomyLevel: 'full',
  },
  {
    id: 'financial-modeler',
    code: 'A09',
    name: 'Financial Modeler',
    category: 'task',
    icon: '💹',
    description: 'Builds and updates pro forma models automatically',
    capabilities: ['Model generation', 'Sensitivity analysis', 'Scenario comparison', 'Return calculation'],
    modules: ['proforma', 'capital'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'due-diligence',
    code: 'A10',
    name: 'Due Diligence',
    category: 'task',
    icon: '✅',
    description: 'Tracks DD checklist items and flags issues',
    capabilities: ['Checklist management', 'Document verification', 'Issue flagging', 'Timeline tracking'],
    modules: ['risk', 'deal-tools'],
    autonomyLevel: 'supervised',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYST AGENTS - AI personas that provide role-specific insights
// ═══════════════════════════════════════════════════════════════════════════════

export const ANALYST_AGENTS: AgentDefinition[] = [
  // ─── All Phases ─────────────────────────────────────────────────────────────
  {
    id: 'cfo',
    code: 'AN01',
    name: 'CFO',
    category: 'analyst',
    icon: '📊',
    description: 'Financial analysis, returns, and risk management',
    capabilities: ['Return analysis', 'Risk assessment', 'Cash flow modeling', 'Value creation'],
    modules: ['proforma', 'capital', 'overview', 'strategy'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'accountant',
    code: 'AN02',
    name: 'Accountant',
    category: 'analyst',
    icon: '💰',
    description: 'Numbers deep-dive, tax implications, and GAAP compliance',
    capabilities: ['Tax analysis', 'GAAP compliance', 'Cost allocation', 'Audit prep'],
    modules: ['proforma', 'deal-tools'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'marketing-expert',
    code: 'AN03',
    name: 'Marketing Expert',
    category: 'analyst',
    icon: '📈',
    description: 'Market positioning, branding, and lease-up strategy',
    capabilities: ['Positioning strategy', 'Lease-up planning', 'Competitive analysis', 'Branding'],
    modules: ['market', 'comps', 'strategy'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'developer',
    code: 'AN04',
    name: 'Developer',
    category: 'analyst',
    icon: '🏗️',
    description: 'Construction feasibility, value-add, and renovations',
    capabilities: ['Feasibility analysis', 'Value-add assessment', 'Construction review', 'Timeline planning'],
    modules: ['zoning', 'design-3d', 'proforma'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'legal-advisor',
    code: 'AN05',
    name: 'Legal Advisor',
    category: 'analyst',
    icon: '⚖️',
    description: 'Contracts, compliance, and legal risk assessment',
    capabilities: ['Contract review', 'Compliance check', 'Risk identification', 'Documentation'],
    modules: ['risk', 'deal-tools'],
    autonomyLevel: 'manual',
  },
  {
    id: 'lender',
    code: 'AN06',
    name: 'Lender',
    category: 'analyst',
    icon: '🏦',
    description: 'Debt perspective, underwriting, and financing',
    capabilities: ['Underwriting', 'Debt sizing', 'Rate analysis', 'Covenant review'],
    modules: ['capital', 'proforma'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'acquisitions',
    code: 'AN07',
    name: 'Acquisitions',
    category: 'analyst',
    icon: '🎯',
    description: 'Deal sourcing, negotiations, and acquisition strategy',
    capabilities: ['Deal evaluation', 'Negotiation strategy', 'Market timing', 'Pricing analysis'],
    modules: ['overview', 'strategy', 'comps'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'asset-manager',
    code: 'AN08',
    name: 'Asset Manager',
    category: 'analyst',
    icon: '📉',
    description: 'Operations optimization and NOI maximization',
    capabilities: ['NOI analysis', 'Expense review', 'Performance benchmarking', 'Value creation'],
    modules: ['overview', 'proforma', 'market'],
    autonomyLevel: 'supervised',
  },
  // ─── Post-Acquisition / Portfolio ───────────────────────────────────────────
  {
    id: 'property-manager',
    code: 'AN09',
    name: 'Property Manager',
    category: 'analyst',
    icon: '🏠',
    description: 'Day-to-day operations, tenant relations, and maintenance',
    capabilities: ['Operations review', 'Tenant analysis', 'Maintenance planning', 'Vendor management'],
    modules: ['overview', 'deal-tools'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'leasing-director',
    code: 'AN10',
    name: 'Leasing Director',
    category: 'analyst',
    icon: '📋',
    description: 'Vacancy reduction, renewals, and tenant screening',
    capabilities: ['Leasing strategy', 'Renewal analysis', 'Concession planning', 'Market rent analysis'],
    modules: ['market', 'comps', 'proforma'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'facilities-manager',
    code: 'AN11',
    name: 'Facilities Manager',
    category: 'analyst',
    icon: '🔧',
    description: 'CapEx planning, preventive maintenance, and vendor contracts',
    capabilities: ['CapEx planning', 'Maintenance scheduling', 'Vendor negotiation', 'Reserve analysis'],
    modules: ['proforma', 'deal-tools'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'investment-analyst',
    code: 'AN12',
    name: 'Investment Analyst',
    category: 'analyst',
    icon: '📊',
    description: 'Hold/sell analysis, refinance timing, and disposition strategy',
    capabilities: ['Hold/sell analysis', 'Refinance modeling', 'Exit strategy', 'IRR optimization'],
    modules: ['strategy', 'proforma', 'capital'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'esg-sustainability',
    code: 'AN13',
    name: 'ESG / Sustainability',
    category: 'analyst',
    icon: '🌱',
    description: 'Energy efficiency, green certifications, and utility optimization',
    capabilities: ['Energy analysis', 'Certification guidance', 'Utility optimization', 'ESG reporting'],
    modules: ['overview', 'proforma'],
    autonomyLevel: 'supervised',
  },
  {
    id: 'compliance-officer',
    code: 'AN14',
    name: 'Compliance Officer',
    category: 'analyst',
    icon: '📜',
    description: 'Insurance, permits, ADA, fair housing, and regulatory compliance',
    capabilities: ['Compliance audit', 'Insurance review', 'Permit tracking', 'Fair housing'],
    modules: ['risk', 'deal-tools'],
    autonomyLevel: 'manual',
  },
  {
    id: 'tax-strategist',
    code: 'AN15',
    name: 'Tax Strategist',
    category: 'analyst',
    icon: '💼',
    description: 'Cost segregation, 1031 exchanges, depreciation, and K-1 optimization',
    capabilities: ['Cost seg analysis', '1031 planning', 'Depreciation strategy', 'Tax optimization'],
    modules: ['proforma', 'strategy'],
    autonomyLevel: 'manual',
  },
  {
    id: 'researcher',
    code: 'AN16',
    name: 'Researcher',
    category: 'analyst',
    icon: '🔬',
    description: 'Deep market research, demographics, economic trends, and competitive intel',
    capabilities: ['Market research', 'Demographic analysis', 'Economic trends', 'Competitive intelligence', 'Data synthesis'],
    modules: ['market', 'supply', 'comps', 'strategy', 'overview'],
    autonomyLevel: 'supervised',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED WORKFORCE
// ═══════════════════════════════════════════════════════════════════════════════

export const ALL_AGENTS: AgentDefinition[] = [...TASK_AGENTS, ...ANALYST_AGENTS];

export const getAgentsByModule = (moduleId: string): AgentDefinition[] => {
  return ALL_AGENTS.filter(agent => 
    agent.modules.includes(moduleId) || agent.modules.includes('all')
  );
};

export const getAgentsByCategory = (category: AgentCategory): AgentDefinition[] => {
  return ALL_AGENTS.filter(agent => agent.category === category);
};

export const getAgentById = (id: string): AgentDefinition | undefined => {
  return ALL_AGENTS.find(agent => agent.id === id);
};

export const getAgentByCode = (code: string): AgentDefinition | undefined => {
  return ALL_AGENTS.find(agent => agent.code === code);
};

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFORCE CONFIGURATION (User Settings)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// AI MODEL OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type AIModelTier = 'fast' | 'balanced' | 'powerful' | 'auto';

export interface AIModelOption {
  id: AIModelTier;
  name: string;
  model: string;
  icon: string;
  description: string;
  speed: number;      // 1-5
  quality: number;    // 1-5
  costMultiplier: number;
  color: string;
}

export const AI_MODELS: AIModelOption[] = [
  {
    id: 'auto',
    name: 'Auto',
    model: 'auto',
    icon: '🤖',
    description: 'Let JEDI select the best model per task',
    speed: 3,
    quality: 3,
    costMultiplier: 1,
    color: '#00BCD4',
  },
  {
    id: 'fast',
    name: 'Fast',
    model: 'claude-3-haiku',
    icon: '⚡',
    description: 'Claude Haiku — quick lookups, high volume',
    speed: 5,
    quality: 2,
    costMultiplier: 0.5,
    color: '#00D26A',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    model: 'claude-3-sonnet',
    icon: '⚖️',
    description: 'Claude Sonnet — analysis & research',
    speed: 3,
    quality: 4,
    costMultiplier: 1,
    color: '#F5A623',
  },
  {
    id: 'powerful',
    name: 'Powerful',
    model: 'claude-3-opus',
    icon: '✨',
    description: 'Claude Opus — complex reasoning',
    speed: 2,
    quality: 5,
    costMultiplier: 2,
    color: '#A78BFA',
  },
];

export const getModelById = (id: AIModelTier): AIModelOption => {
  return AI_MODELS.find(m => m.id === id) || AI_MODELS[0];
};

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFORCE CONFIGURATION (User Settings)
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkforceConfig {
  // How many agents of each type to activate
  taskAgentCount: number;       // 0-10, how many task agents running
  analystAgentCount: number;    // 0-15, how many analyst personas available
  
  // Which specific agents are enabled
  enabledAgents: string[];      // Array of agent IDs
  
  // Model selection per agent
  globalModel: AIModelTier;
  agentModelOverrides: Record<string, AIModelTier>;  // agent ID -> model
  
  // Autonomy settings
  globalAutonomy: 'full' | 'supervised' | 'manual';
  agentAutonomyOverrides: Record<string, 'full' | 'supervised' | 'manual'>;
  
  // Notification preferences
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  notifyOnInsight: boolean;
  
  // Cost controls
  dailyBudgetLimit?: number;
  requireApprovalAbove?: number;
}

export const DEFAULT_WORKFORCE_CONFIG: WorkforceConfig = {
  taskAgentCount: 6,
  analystAgentCount: 8,
  enabledAgents: [
    // Default enabled task agents
    'data-collector', 'zoning-agent', 'market-analyst', 'risk-scorer', 'strategy-engine', 'orchestrator',
    // Default enabled analyst agents
    'cfo', 'accountant', 'legal-advisor', 'developer', 'lender', 'acquisitions', 'asset-manager', 'investment-analyst',
  ],
  globalModel: 'balanced',
  agentModelOverrides: {
    // Default model overrides for specific agents
    'orchestrator': 'powerful',      // Orchestrator needs best reasoning
    'strategy-engine': 'powerful',   // Strategy needs deep analysis
    'data-collector': 'fast',        // Data collection can be quick
    'comp-scraper': 'fast',          // Scraping doesn't need reasoning
  },
  globalAutonomy: 'supervised',
  agentAutonomyOverrides: {},
  notifyOnComplete: true,
  notifyOnError: true,
  notifyOnInsight: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TierLimits {
  maxTaskAgents: number;
  maxAnalystAgents: number;
  autonomyLevels: ('full' | 'supervised' | 'manual')[];
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxTaskAgents: 2,
    maxAnalystAgents: 3,
    autonomyLevels: ['manual'],
  },
  pro: {
    maxTaskAgents: 6,
    maxAnalystAgents: 8,
    autonomyLevels: ['supervised', 'manual'],
  },
  enterprise: {
    maxTaskAgents: 10,
    maxAnalystAgents: 15,
    autonomyLevels: ['full', 'supervised', 'manual'],
  },
};
