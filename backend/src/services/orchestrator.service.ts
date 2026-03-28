/**
 * Orchestrator Service
 * 
 * Routes user queries to specialized agents and synthesizes responses.
 * This is the brain that delegates work to the right specialists.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { generateCompletion, isLLMAvailable } from './llm.service';
import { logger } from '../utils/logger';
import { query } from '../database/connection';

// Import agent executors
import { SupplyAgent } from '../agents/supply.agent';
import { CashFlowAgent } from '../agents/cashflow.agent';
import { ZoningAgent } from '../agents/zoning.agent';
import { ResearchAgent } from '../agents/research.agent';
import { CommentaryAgent } from '../agents/commentary.agent';

// ============================================================================
// Types
// ============================================================================

export type SpecialistAgent = 
  | 'SUPPLY' | 'DEMAND' | 'CASH' | 'ZONING' | 'COMPS' 
  | 'RISK' | 'DEBT' | 'RESEARCH' | 'NEWS';

export interface DelegationResult {
  agent: SpecialistAgent;
  data: Record<string, unknown>;
  executionTimeMs: number;
  success: boolean;
  error?: string;
}

export interface OrchestratorRequest {
  message: string;
  dealId?: string;
  msaId?: string;
  userId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface OrchestratorResponse {
  message: string;
  delegations: DelegationResult[];
  suggestedFollowups: string[];
  timestamp: number;
}

interface IntentClassification {
  agents: SpecialistAgent[];
  parsedParams: Record<string, unknown>;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Agent Executor Registry
// ============================================================================

const AGENT_EXECUTORS: Partial<Record<SpecialistAgent, any>> = {
  SUPPLY: new SupplyAgent(),
  CASH: new CashFlowAgent(),
  ZONING: new ZoningAgent(),
  RESEARCH: new ResearchAgent(),
  // DEMAND, COMPS, RISK, DEBT, NEWS — add as they're built
};

// Agent capability descriptions for LLM routing
const AGENT_CAPABILITIES: Record<SpecialistAgent, { description: string; triggers: string[] }> = {
  SUPPLY: {
    description: 'Analyzes market supply, construction pipeline, inventory, absorption rates',
    triggers: ['supply', 'inventory', 'pipeline', 'construction', 'absorption', 'deliveries', 'units coming', 'new development'],
  },
  DEMAND: {
    description: 'Analyzes demand drivers, employment, population, rent growth, occupancy',
    triggers: ['demand', 'employment', 'jobs', 'population', 'rent growth', 'occupancy', 'migration', 'economic'],
  },
  CASH: {
    description: 'Calculates cash flow projections, IRR, NOI, distributions, returns',
    triggers: ['cash flow', 'irr', 'returns', 'noi', 'distributions', 'proforma', 'roi', 'yield', 'cap rate', 'financial'],
  },
  ZONING: {
    description: 'Analyzes zoning codes, development capacity, setbacks, FAR, entitlements',
    triggers: ['zoning', 'entitlement', 'setback', 'far', 'density', 'development capacity', 'building code', 'permitted use'],
  },
  COMPS: {
    description: 'Finds and analyzes comparable sales, rent comps, cap rate benchmarks',
    triggers: ['comps', 'comparables', 'sales', 'rent comp', 'benchmark', 'pricing', 'similar properties'],
  },
  RISK: {
    description: 'Identifies and monitors risks, alerts, thresholds, exposure analysis',
    triggers: ['risk', 'alert', 'warning', 'exposure', 'concern', 'red flag', 'issue', 'problem'],
  },
  DEBT: {
    description: 'Analyzes debt options, interest rates, loan terms, lender matching',
    triggers: ['debt', 'loan', 'mortgage', 'financing', 'interest rate', 'lender', 'refinance', 'leverage'],
  },
  RESEARCH: {
    description: 'Market research, demographics, economic trends, competitive analysis',
    triggers: ['research', 'demographics', 'trends', 'economic', 'market analysis', 'competitive', 'data'],
  },
  NEWS: {
    description: 'Market news, sentiment, headlines, employer announcements, regulatory news',
    triggers: ['news', 'headlines', 'sentiment', 'announcement', 'recent', "what's happening"],
  },
};

// ============================================================================
// Intent Classification
// ============================================================================

async function classifyIntent(
  message: string,
  context: { dealId?: string; msaId?: string }
): Promise<IntentClassification> {
  
  // First, try simple keyword matching for common cases
  const quickMatch = quickClassify(message);
  if (quickMatch.confidence > 0.8) {
    return quickMatch;
  }

  // Fall back to LLM classification for complex queries
  if (!isLLMAvailable()) {
    return quickMatch; // Use quick match if LLM unavailable
  }

  const agentDescriptions = Object.entries(AGENT_CAPABILITIES)
    .map(([code, info]) => `- ${code}: ${info.description}`)
    .join('\n');

  const prompt = `Classify this user query and extract parameters for the real estate investment platform.

User query: "${message}"
${context.dealId ? `Current deal ID: ${context.dealId}` : ''}
${context.msaId ? `Current market (MSA): ${context.msaId}` : ''}

Available specialist agents:
${agentDescriptions}

Respond with JSON only:
{
  "agents": ["AGENT_CODE"],  // 1-3 agents needed, in order of importance
  "parsedParams": {
    "city": "string or null",
    "stateCode": "string or null",
    "propertyType": "string or null",
    "dealId": "string or null",
    "purchasePrice": "number or null",
    "monthlyRent": "number or null",
    // other relevant extracted params
  },
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await generateCompletion({
      prompt,
      maxTokens: 500,
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.text);
    return {
      agents: parsed.agents || [],
      parsedParams: parsed.parsedParams || {},
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    logger.warn('LLM classification failed, using quick match:', error);
    return quickMatch;
  }
}

function quickClassify(message: string): IntentClassification {
  const lowerMessage = message.toLowerCase();
  const matchedAgents: SpecialistAgent[] = [];
  
  for (const [agent, info] of Object.entries(AGENT_CAPABILITIES)) {
    const matchScore = info.triggers.filter(t => lowerMessage.includes(t)).length;
    if (matchScore > 0) {
      matchedAgents.push(agent as SpecialistAgent);
    }
  }

  // Sort by match strength and take top 2
  const agents = matchedAgents.slice(0, 2);

  // Extract simple params
  const parsedParams: Record<string, unknown> = {};
  
  // City/state extraction (simple pattern)
  const cityStateMatch = message.match(/in\s+([A-Za-z\s]+),?\s*([A-Z]{2})?/i);
  if (cityStateMatch) {
    parsedParams.city = cityStateMatch[1].trim();
    if (cityStateMatch[2]) parsedParams.stateCode = cityStateMatch[2];
  }

  // Price extraction
  const priceMatch = message.match(/\$?([\d,]+)\s*(k|m|million|thousand)?/i);
  if (priceMatch) {
    let price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (priceMatch[2]?.toLowerCase() === 'k' || priceMatch[2]?.toLowerCase() === 'thousand') {
      price *= 1000;
    } else if (priceMatch[2]?.toLowerCase() === 'm' || priceMatch[2]?.toLowerCase() === 'million') {
      price *= 1000000;
    }
    parsedParams.purchasePrice = price;
  }

  return {
    agents: agents.length > 0 ? agents : ['RESEARCH'], // Default to research
    parsedParams,
    reasoning: 'Quick keyword matching',
    confidence: agents.length > 0 ? 0.7 : 0.3,
  };
}

// ============================================================================
// Agent Delegation
// ============================================================================

async function delegateToAgent(
  agent: SpecialistAgent,
  params: Record<string, unknown>,
  userId: string
): Promise<DelegationResult> {
  const startTime = Date.now();

  const executor = AGENT_EXECUTORS[agent];
  if (!executor) {
    return {
      agent,
      data: { message: `${agent} agent not yet implemented` },
      executionTimeMs: Date.now() - startTime,
      success: false,
      error: 'Agent not implemented',
    };
  }

  try {
    const result = await executor.execute(params, userId);
    return {
      agent,
      data: result,
      executionTimeMs: Date.now() - startTime,
      success: true,
    };
  } catch (error: any) {
    logger.error(`${agent} agent failed:`, error);
    return {
      agent,
      data: {},
      executionTimeMs: Date.now() - startTime,
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Response Synthesis
// ============================================================================

async function synthesizeResponse(
  originalQuery: string,
  delegations: DelegationResult[],
  context: { dealId?: string; msaId?: string }
): Promise<string> {
  
  // If no LLM, return structured data summary
  if (!isLLMAvailable()) {
    return formatFallbackResponse(delegations);
  }

  const successfulDelegations = delegations.filter(d => d.success);
  if (successfulDelegations.length === 0) {
    return "I couldn't retrieve the data you requested. Please try again or rephrase your question.";
  }

  const dataContext = successfulDelegations
    .map(d => `## ${d.agent} Agent Data:\n${JSON.stringify(d.data, null, 2)}`)
    .join('\n\n');

  const prompt = `You are JEDI, the AI orchestrator for a real estate investment platform. 
Synthesize the following agent data into a clear, actionable response for the user.

User's question: "${originalQuery}"

${dataContext}

Guidelines:
- Be concise but thorough
- Highlight key metrics and insights
- Use bullet points for multiple data points
- If data shows opportunity or concern, call it out
- End with a relevant follow-up question or suggestion
- Format numbers nicely (e.g., $1.5M not $1500000)`;

  try {
    const response = await generateCompletion({
      prompt,
      maxTokens: 800,
      temperature: 0.7,
    });
    return response.text;
  } catch (error) {
    logger.error('Response synthesis failed:', error);
    return formatFallbackResponse(delegations);
  }
}

function formatFallbackResponse(delegations: DelegationResult[]): string {
  const parts: string[] = [];

  for (const d of delegations) {
    if (d.success) {
      parts.push(`**${d.agent}:**\n${JSON.stringify(d.data, null, 2)}`);
    } else {
      parts.push(`**${d.agent}:** ${d.error || 'Failed to retrieve data'}`);
    }
  }

  return parts.join('\n\n');
}

// ============================================================================
// Main Orchestrator Function
// ============================================================================

export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const startTime = Date.now();
  const { message, dealId, msaId, userId } = request;

  logger.info('Orchestrator processing:', { messageLength: message.length, dealId, userId });

  try {
    // 1. Classify intent and determine which agents to call
    const intent = await classifyIntent(message, { dealId, msaId });
    logger.info('Intent classified:', { agents: intent.agents, confidence: intent.confidence });

    // 2. Add context from deal/msa if available
    const params = { ...intent.parsedParams };
    if (dealId) params.dealId = dealId;
    if (msaId) params.msaId = msaId;

    // 3. Delegate to agents (parallel for independent agents)
    const delegationPromises = intent.agents.map(agent =>
      delegateToAgent(agent, params, userId)
    );
    const delegations = await Promise.all(delegationPromises);

    // 4. Synthesize response
    const synthesizedMessage = await synthesizeResponse(message, delegations, { dealId, msaId });

    // 5. Generate follow-ups based on what was asked
    const suggestedFollowups = generateFollowups(intent.agents, delegations);

    const totalTime = Date.now() - startTime;
    logger.info('Orchestrator complete:', { totalTime, delegations: delegations.length });

    return {
      message: synthesizedMessage,
      delegations,
      suggestedFollowups,
      timestamp: Date.now(),
    };

  } catch (error: any) {
    logger.error('Orchestrator failed:', error);
    return {
      message: `I encountered an error processing your request: ${error.message}. Please try again.`,
      delegations: [],
      suggestedFollowups: ['What would you like to know?', 'Try asking about a specific market or deal'],
      timestamp: Date.now(),
    };
  }
}

function generateFollowups(agents: SpecialistAgent[], delegations: DelegationResult[]): string[] {
  const followups: string[] = [];

  // Add relevant follow-ups based on which agents were used
  if (agents.includes('SUPPLY')) {
    followups.push('What about demand drivers?', 'Show me comps in this area');
  }
  if (agents.includes('CASH')) {
    followups.push('What financing options are available?', 'Run sensitivity analysis');
  }
  if (agents.includes('ZONING')) {
    followups.push('What can I build here?', 'Entitlement timeline?');
  }
  if (agents.includes('RESEARCH')) {
    followups.push('Deeper market analysis?', 'Who are the major employers?');
  }

  // Check if any delegations failed
  const failed = delegations.filter(d => !d.success);
  if (failed.length > 0) {
    followups.push('Try a different approach?');
  }

  return followups.slice(0, 4);
}

// ============================================================================
// Direct Agent Chat (bypass orchestrator for specific agent)
// ============================================================================

export async function chatWithAgent(
  agentCode: SpecialistAgent,
  message: string,
  params: Record<string, unknown>,
  userId: string
): Promise<DelegationResult> {
  return delegateToAgent(agentCode, params, userId);
}
