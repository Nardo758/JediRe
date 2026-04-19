/**
 * Intent Classifier
 * 
 * Parses user queries to determine intent and extract parameters.
 * Uses fast keyword matching for common cases, LLM for complex queries.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { generateCompletion, isLLMAvailable } from '../llm.service';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type IntentType =
  | 'full_analysis'      // Analyze a property
  | 'price_change'       // Update price assumption
  | 'comparison'         // Compare properties
  | 'report'             // Generate PDF/Deal Bible
  | 'follow_up'          // Follow-up question
  | 'agent_query'        // Direct query for specific agent
  | 'portfolio'          // Portfolio-level question
  | 'market_research'    // Market/submarket research
  | 'general_question'   // General RE question
  | 'greeting'           // Hello/hi
  | 'unknown';

export type SpecialistAgent =
  | 'SUPPLY' | 'DEMAND' | 'CASH' | 'ZONING' | 'COMPS'
  | 'RISK' | 'DEBT' | 'RESEARCH' | 'NEWS' | 'STRATEGY';

export type AnalystAgent =
  | 'CFO' | 'ACCOUNTANT' | 'MARKETING' | 'DEVELOPER' | 'LEGAL'
  | 'LENDER' | 'ACQUISITIONS' | 'ASSET_MANAGER' | 'PROPERTY_MANAGER'
  | 'LEASING' | 'FACILITIES' | 'INVESTMENT_ANALYST' | 'ESG'
  | 'COMPLIANCE' | 'TAX' | 'RESEARCHER';

export interface ExtractedIntent {
  type: IntentType;
  confidence: number;
  
  // Extracted entities
  address?: string;
  city?: string;
  stateCode?: string;
  price?: number;
  dealId?: string;
  msaId?: string;
  
  // Multi-property
  compareAddresses?: string[];
  
  // Report requests
  reportType?: 'pdf' | 'deal_bible' | 'summary';
  
  // Agent routing
  specialists: SpecialistAgent[];
  analysts: AnalystAgent[];
  
  // Raw question for context
  question?: string;
  reasoning?: string;
}

// ============================================================================
// Agent Capabilities (for routing)
// ============================================================================

export const SPECIALIST_TRIGGERS: Record<SpecialistAgent, string[]> = {
  SUPPLY: ['supply', 'inventory', 'pipeline', 'construction', 'absorption', 'deliveries', 'units coming', 'new development', 'permits'],
  DEMAND: ['demand', 'employment', 'jobs', 'population', 'rent growth', 'occupancy', 'migration', 'economic', 'demographics'],
  CASH: ['cash flow', 'irr', 'returns', 'noi', 'distributions', 'proforma', 'roi', 'yield', 'cap rate', 'financial', 'underwrite'],
  ZONING: ['zoning', 'entitlement', 'setback', 'far', 'density', 'development capacity', 'building code', 'permitted use', 'height limit'],
  COMPS: ['comps', 'comparables', 'sales', 'rent comp', 'benchmark', 'pricing', 'similar properties', 'nearby deals'],
  RISK: ['risk', 'alert', 'warning', 'exposure', 'concern', 'red flag', 'issue', 'problem', 'downside'],
  DEBT: ['debt', 'loan', 'mortgage', 'financing', 'interest rate', 'lender', 'refinance', 'leverage', 'dscr'],
  RESEARCH: ['research', 'data', 'analyze', 'look up', 'find out', 'what is', 'tell me about'],
  NEWS: ['news', 'headlines', 'sentiment', 'announcement', 'recent', "what's happening", 'market news'],
  STRATEGY: ['strategy', 'recommendation', 'should i', 'hold or sell', 'exit', 'timing', 'best approach'],
};

const ANALYST_TRIGGERS: Record<AnalystAgent, string[]> = {
  CFO: ['cfo', 'returns', 'irr', 'financial performance', 'portfolio returns'],
  ACCOUNTANT: ['accountant', 'tax', 'gaap', 'depreciation', 'accounting'],
  MARKETING: ['marketing', 'positioning', 'lease-up', 'branding', 'tenant attraction'],
  DEVELOPER: ['developer', 'construction', 'value-add', 'renovation', 'build'],
  LEGAL: ['legal', 'contract', 'compliance', 'attorney', 'lawsuit', 'liability'],
  LENDER: ['lender perspective', 'underwriting', 'loan criteria', 'debt sizing'],
  ACQUISITIONS: ['acquisitions', 'sourcing', 'negotiate', 'loi', 'deal terms'],
  ASSET_MANAGER: ['asset manager', 'noi optimization', 'operations', 'performance'],
  PROPERTY_MANAGER: ['property manager', 'tenant', 'maintenance', 'resident'],
  LEASING: ['leasing', 'vacancy', 'renewals', 'concessions', 'lease terms'],
  FACILITIES: ['facilities', 'capex', 'building systems', 'vendor', 'preventive maintenance'],
  INVESTMENT_ANALYST: ['investment analyst', 'hold sell', 'refinance', 'exit strategy', 'market timing'],
  ESG: ['esg', 'sustainability', 'energy', 'green', 'environmental'],
  COMPLIANCE: ['compliance', 'insurance', 'permits', 'ada', 'fair housing', 'regulatory'],
  TAX: ['tax strategist', 'cost seg', '1031', 'depreciation', 'k-1'],
  RESEARCHER: ['researcher', 'deep dive', 'market study', 'competitive intel'],
};

const INTENT_TRIGGERS: Record<IntentType, string[]> = {
  full_analysis: ['analyze', 'analysis', 'evaluate', 'look at', 'check out', 'review', 'assess'],
  price_change: ['change price', 'update price', 'new price', 'at $', 'if the price'],
  comparison: ['compare', 'versus', 'vs', 'which is better', 'difference between'],
  report: ['report', 'pdf', 'deal bible', 'export', 'generate', 'document'],
  portfolio: ['portfolio', 'all my deals', 'my properties', 'across deals'],
  market_research: ['market', 'submarket', 'msa', 'area', 'neighborhood', 'city trends'],
  follow_up: ['what about', 'and the', 'also', 'more about', 'elaborate'],
  greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
  agent_query: [], // Detected by analyst/specialist triggers
  general_question: ['how do', 'what is', 'explain', 'why'],
  unknown: [],
};

// ============================================================================
// Intent Classifier
// ============================================================================

export class IntentClassifier {
  
  /**
   * Classify user message and extract intent + parameters
   */
  async classify(
    message: string,
    context?: {
      dealId?: string;
      msaId?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<ExtractedIntent> {
    const lowerMessage = message.toLowerCase();
    
    // Try quick classification first
    const quickResult = this.quickClassify(lowerMessage, message);
    
    // If high confidence or LLM not available, return quick result
    if (quickResult.confidence >= 0.8 || !isLLMAvailable()) {
      // Add context
      if (context?.dealId) quickResult.dealId = context.dealId;
      if (context?.msaId) quickResult.msaId = context.msaId;
      return quickResult;
    }
    
    // Use LLM for complex queries
    try {
      const llmResult = await this.llmClassify(message, context);
      return llmResult;
    } catch (error) {
      logger.warn('LLM classification failed, using quick result:', error);
      return quickResult;
    }
  }
  
  /**
   * Fast keyword-based classification
   */
  private quickClassify(lowerMessage: string, originalMessage: string): ExtractedIntent {
    const result: ExtractedIntent = {
      type: 'unknown',
      confidence: 0.5,
      specialists: [],
      analysts: [],
    };
    
    // Detect intent type
    for (const [intentType, triggers] of Object.entries(INTENT_TRIGGERS)) {
      const matchCount = triggers.filter(t => lowerMessage.includes(t)).length;
      if (matchCount > 0) {
        result.type = intentType as IntentType;
        result.confidence = Math.min(0.5 + matchCount * 0.15, 0.9);
        break;
      }
    }
    
    // Detect specialist agents needed
    for (const [agent, triggers] of Object.entries(SPECIALIST_TRIGGERS)) {
      const matchCount = triggers.filter(t => lowerMessage.includes(t)).length;
      if (matchCount > 0) {
        result.specialists.push(agent as SpecialistAgent);
        if (result.type === 'unknown') {
          result.type = 'agent_query';
        }
      }
    }
    
    // Detect analyst agents needed
    for (const [agent, triggers] of Object.entries(ANALYST_TRIGGERS)) {
      const matchCount = triggers.filter(t => lowerMessage.includes(t)).length;
      if (matchCount > 0) {
        result.analysts.push(agent as AnalystAgent);
        if (result.type === 'unknown') {
          result.type = 'agent_query';
        }
      }
    }
    
    // Extract address (simple pattern)
    const addressMatch = originalMessage.match(
      /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard|circle|cir|court|ct)[\w\s,]*(?:,\s*)?(?:[A-Z]{2})?(?:\s+\d{5})?)/i
    );
    if (addressMatch) {
      result.address = addressMatch[1].trim();
      if (result.type === 'unknown') {
        result.type = 'full_analysis';
      }
      result.confidence = Math.min(result.confidence + 0.2, 0.95);
    }
    
    // Extract city/state
    const cityStateMatch = originalMessage.match(/in\s+([A-Za-z\s]+),?\s*([A-Z]{2})/i);
    if (cityStateMatch) {
      result.city = cityStateMatch[1].trim();
      result.stateCode = cityStateMatch[2].toUpperCase();
    }
    
    // Extract price
    const priceMatch = originalMessage.match(/\$?([\d,]+)\s*(k|m|million|thousand)?/i);
    if (priceMatch) {
      let price = parseInt(priceMatch[1].replace(/,/g, ''));
      const multiplier = priceMatch[2]?.toLowerCase();
      if (multiplier === 'k' || multiplier === 'thousand') price *= 1000;
      if (multiplier === 'm' || multiplier === 'million') price *= 1000000;
      result.price = price;
    }
    
    // Default specialists for full analysis
    if (result.type === 'full_analysis' && result.specialists.length === 0) {
      result.specialists = ['RESEARCH', 'ZONING', 'SUPPLY', 'CASH'];
    }
    
    // Default for greeting
    if (result.type === 'greeting') {
      result.confidence = 0.95;
    }
    
    // Store original question
    result.question = originalMessage;
    
    return result;
  }
  
  /**
   * LLM-powered classification for complex queries
   */
  private async llmClassify(
    message: string,
    context?: {
      dealId?: string;
      msaId?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<ExtractedIntent> {
    const prompt = `You are the JEDI RE intent classifier. Parse this real estate query.

User message: "${message}"
${context?.dealId ? `Current deal: ${context.dealId}` : ''}
${context?.msaId ? `Current market: ${context.msaId}` : ''}
${context?.conversationHistory?.length ? `Conversation has ${context.conversationHistory.length} prior messages` : ''}

Available specialist agents: SUPPLY, DEMAND, CASH, ZONING, COMPS, RISK, DEBT, RESEARCH, NEWS, STRATEGY
Available analyst agents: CFO, ACCOUNTANT, MARKETING, DEVELOPER, LEGAL, LENDER, ACQUISITIONS, ASSET_MANAGER, PROPERTY_MANAGER, LEASING, FACILITIES, INVESTMENT_ANALYST, ESG, COMPLIANCE, TAX, RESEARCHER

Return JSON only:
{
  "type": "full_analysis|price_change|comparison|report|follow_up|agent_query|portfolio|market_research|general_question|greeting",
  "confidence": 0.0-1.0,
  "address": "extracted address or null",
  "city": "city name or null",
  "stateCode": "2-letter state or null",
  "price": number or null,
  "specialists": ["AGENT_CODE"],
  "analysts": ["AGENT_CODE"],
  "reasoning": "brief explanation"
}`;

    const response = await generateCompletion({
      prompt,
      maxTokens: 500,
      temperature: 0.2,
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return {
        type: parsed.type || 'unknown',
        confidence: parsed.confidence || 0.7,
        address: parsed.address,
        city: parsed.city,
        stateCode: parsed.stateCode,
        price: parsed.price,
        dealId: context?.dealId,
        msaId: context?.msaId,
        specialists: parsed.specialists || [],
        analysts: parsed.analysts || [],
        question: message,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      logger.error('Failed to parse LLM intent response:', error);
      return this.quickClassify(message.toLowerCase(), message);
    }
  }
}

export const intentClassifier = new IntentClassifier();
