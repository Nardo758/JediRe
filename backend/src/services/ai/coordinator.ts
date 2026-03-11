/**
 * AI Coordinator — The 5th brain
 *
 * Claude-powered intent extraction, agent orchestration, result synthesis,
 * JEDI Score generation, and multi-turn conversation management.
 *
 * Not a separate agent service — it's the Claude layer that wraps everything.
 */

import { JediAIService } from './aiService';
import { ResearchAgent } from '../../agents/research.agent';
import { ZoningAgent } from '../../agents/zoning.agent';
import { SupplyAgent } from '../../agents/supply.agent';
import { CashFlowAgent } from '../../agents/cashflow.agent';
import { logger } from '../../utils/logger';
import type {
  AICallContext,
  ChatSession,
  ChatMessage,
  CoordinatorResult,
  DealContext,
  ZoningResult,
  SupplyResult,
  CashflowResult,
  SubscriptionTier,
} from '../../types/dealContext';

// ── Intent Types ───────────────────────────────────────────────

interface ExtractedIntent {
  type:
    | 'full_analysis'
    | 'price_change'
    | 'comparison'
    | 'report'
    | 'follow_up'
    | 'general_question'
    | 'greeting';
  address?: string;
  price?: number;
  dealId?: string;
  compareAddresses?: string[];
  reportType?: 'pdf' | 'deal_bible';
  question?: string;
}

// ── JEDI Score Weights ─────────────────────────────────────────

const JEDI_SCORE_WEIGHTS = {
  zoning: 0.20,
  market: 0.30,
  financial: 0.50,
};

// ── System Prompts ─────────────────────────────────────────────

const INTENT_EXTRACTION_PROMPT = `You are the JEDI RE AI Coordinator. Your job is to understand what the user wants and extract structured intent from their message.

You are a real estate investment intelligence assistant. Users send you addresses and questions about real estate deals.

Extract the following from the user message:
- type: one of "full_analysis", "price_change", "comparison", "report", "follow_up", "general_question", "greeting"
- address: the property address if mentioned (full address with city/state)
- price: the asking/purchase price if mentioned (numeric, no $ sign)
- compareAddresses: array of addresses if comparing multiple properties
- reportType: "pdf" or "deal_bible" if requesting a report
- question: the specific question if it's a follow-up or general question

Respond with ONLY valid JSON. No markdown, no explanation.

Context about the user:
- Subscription tier: {{tier}}
- Active deals: {{activeDeals}}
- Conversation history length: {{historyLength}} messages`;

const SYNTHESIS_PROMPT = `You are the JEDI RE AI Coordinator synthesizing analysis results for a real estate investor.

Property: {{address}}
Asking Price: {{price}}

ZONING ANALYSIS:
{{zoningResult}}

SUPPLY/MARKET ANALYSIS:
{{supplyResult}}

CASHFLOW ANALYSIS:
{{cashflowResult}}

Generate a comprehensive but concise investment recommendation. Include:
1. A clear BUY / PASS / INVESTIGATE recommendation
2. A JEDI Score from 0-100 (weighted: zoning 20%, market 30%, financial 50%)
3. Key risk flags
4. 2-3 sentence executive summary
5. Suggested follow-up actions

Respond with valid JSON matching this structure:
{
  "jediScore": <number 0-100>,
  "recommendation": "BUY" | "PASS" | "INVESTIGATE",
  "summary": "<2-3 sentence executive summary>",
  "riskFlags": ["<flag1>", "<flag2>"],
  "followUpSuggestions": ["<suggestion1>", "<suggestion2>"]
}`;

// ── Coordinator Class ──────────────────────────────────────────

export class AICoordinator {
  private aiService: JediAIService;
  private researchAgent: ResearchAgent;
  private zoningAgent: ZoningAgent;
  private supplyAgent: SupplyAgent;
  private cashflowAgent: CashFlowAgent;

  constructor() {
    this.aiService = new JediAIService();
    this.researchAgent = new ResearchAgent();
    this.zoningAgent = new ZoningAgent();
    this.supplyAgent = new SupplyAgent();
    this.cashflowAgent = new CashFlowAgent();
  }

  /**
   * Process an incoming message through the full coordinator pipeline.
   */
  async process(
    session: ChatSession,
    message: ChatMessage
  ): Promise<CoordinatorResult> {
    const context: AICallContext = {
      userId: session.userId,
      stripeCustomerId: session.stripeCustomerId,
      agentId: 'coordinator',
      operationType: 'coordinator_chat_response',
      surface: session.platform === 'web' ? 'web' : 'chat',
      platform: ['whatsapp', 'imessage', 'sms', 'telegram'].includes(session.platform)
        ? session.platform as any
        : undefined,
    };

    // Step 1: Extract intent from the user message
    const intent = await this.extractIntent(context, session, message.text);

    logger.info('Coordinator: intent extracted', {
      type: intent.type,
      address: intent.address,
      price: intent.price,
    });

    // Step 2: Route based on intent
    switch (intent.type) {
      case 'full_analysis':
        return this.handleFullAnalysis(context, session, intent);

      case 'price_change':
        return this.handlePriceChange(context, session, intent);

      case 'comparison':
        return this.handleComparison(context, session, intent);

      case 'follow_up':
      case 'general_question':
        return this.handleQuestion(context, session, intent);

      case 'greeting':
        return this.handleGreeting(session);

      case 'report':
        return this.handleReportRequest(context, session, intent);

      default:
        return this.handleQuestion(context, session, intent);
    }
  }

  // ── Intent Extraction ──────────────────────────────────────────

  private async extractIntent(
    context: AICallContext,
    session: ChatSession,
    messageText: string
  ): Promise<ExtractedIntent> {
    const activeDeals = session.activeDeals
      .map((d) => `${d.address} ($${d.askingPrice?.toLocaleString() || '?'})`)
      .join(', ');

    const prompt = INTENT_EXTRACTION_PROMPT
      .replace('{{tier}}', session.subscriptionTier)
      .replace('{{activeDeals}}', activeDeals || 'none')
      .replace('{{historyLength}}', String(session.conversationHistory.length));

    try {
      const response = await this.aiService.generate(
        { ...context, operationType: 'coordinator_chat_response' },
        prompt,
        [{ role: 'user', content: messageText }],
        { maxTokens: 512, temperature: 0 }
      );

      const text = response.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return JSON.parse(text) as ExtractedIntent;
    } catch (error) {
      logger.warn('Coordinator: intent extraction failed, using fallback', { error });
      return this.fallbackIntentExtraction(messageText);
    }
  }

  /**
   * Regex-based fallback when Claude intent extraction fails.
   */
  private fallbackIntentExtraction(text: string): ExtractedIntent {
    const lowerText = text.toLowerCase();

    // Check for greeting
    if (/^(hi|hello|hey|sup|yo|good morning|good afternoon|good evening)\b/.test(lowerText)) {
      return { type: 'greeting' };
    }

    // Check for price change pattern
    const priceMatch = text.match(/(?:what if|change.*price|at|for)\s*\$?([\d,]+(?:\.\d+)?)\s*[mk]?/i);
    if (priceMatch && !text.match(/\d{3,}\s+\w+\s+(st|street|ave|avenue|dr|drive|rd|road|blvd|circle|ct|ln)/i)) {
      let price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (text.toLowerCase().includes('m')) price *= 1_000_000;
      if (text.toLowerCase().includes('k')) price *= 1_000;
      return { type: 'price_change', price };
    }

    // Check for address + price pattern (full analysis)
    const addressMatch = text.match(
      /(\d+\s+[\w\s]+(?:st|street|ave|avenue|dr|drive|rd|road|blvd|boulevard|circle|ct|court|ln|lane|way|pl|place)[\w\s,]*)/i
    );
    if (addressMatch) {
      const fullPriceMatch = text.match(/\$?([\d,]+(?:\.\d+)?)\s*[mk]?/i);
      let price: number | undefined;
      if (fullPriceMatch) {
        price = parseFloat(fullPriceMatch[1].replace(/,/g, ''));
        if (text.toLowerCase().includes('m')) price *= 1_000_000;
        if (text.toLowerCase().includes('k')) price *= 1_000;
      }
      return {
        type: 'full_analysis',
        address: addressMatch[1].trim(),
        price,
      };
    }

    // Check for comparison
    if (/compar|vs|versus|against|both|other deal/i.test(lowerText)) {
      return { type: 'comparison' };
    }

    // Check for report request
    if (/report|pdf|bible|document|export/i.test(lowerText)) {
      const reportType = /bible/i.test(lowerText) ? 'deal_bible' : 'pdf';
      return { type: 'report', reportType };
    }

    return { type: 'general_question', question: text };
  }

  // ── Handler: Full Analysis ───────────────────────────────────

  private async handleFullAnalysis(
    context: AICallContext,
    session: ChatSession,
    intent: ExtractedIntent
  ): Promise<CoordinatorResult> {
    if (!intent.address) {
      return this.textResult(session, 'Please provide a property address to analyze.');
    }

    // Step 2: Research Agent — assemble DealContext
    const dealContext = await this.researchAgent.execute({
      address: intent.address,
      userId: session.userId,
    });

    // Step 3: Run 3 analytical agents in parallel
    const [zoningResult, supplyResult, cashflowResult] = await Promise.all([
      this.runZoningAgent(context, dealContext),
      this.runSupplyAgent(context, dealContext),
      this.runCashflowAgent(context, dealContext, intent.price),
    ]);

    // Step 4: Synthesize results
    context.operationType = 'coordinator_synthesis';
    const synthesis = await this.synthesize(
      context,
      intent.address,
      intent.price,
      zoningResult,
      supplyResult,
      cashflowResult
    );

    // Track the deal in the session
    const dealEntry = {
      dealId: dealContext.requestId,
      address: intent.address,
      askingPrice: intent.price || 0,
      dealContext,
      agentResults: { zoning: zoningResult, supply: supplyResult, cashflow: cashflowResult },
      jediScore: synthesis.jediScore,
      lastAnalyzed: new Date().toISOString(),
    };

    // Add or update active deal
    const existingIdx = session.activeDeals.findIndex(
      (d) => d.address.toLowerCase() === intent.address!.toLowerCase()
    );
    if (existingIdx >= 0) {
      session.activeDeals[existingIdx] = dealEntry;
    } else {
      session.activeDeals.push(dealEntry);
    }

    return {
      address: intent.address,
      dealId: dealContext.requestId,
      jediScore: synthesis.jediScore,
      recommendation: synthesis.recommendation,
      fullSummary: synthesis.summary,
      zoning: zoningResult,
      supply: supplyResult,
      cashflow: cashflowResult,
      followUpOptions: [
        { label: 'Full Report', action: 'report_pdf' },
        { label: 'Change Price', action: 'reprice' },
        { label: 'Compare Deals', action: 'compare' },
      ],
      creditsUsed: session.creditsUsedThisSession,
      creditsRemaining: 0, // Will be populated by message router
    };
  }

  // ── Handler: Price Change ────────────────────────────────────

  private async handlePriceChange(
    context: AICallContext,
    session: ChatSession,
    intent: ExtractedIntent
  ): Promise<CoordinatorResult> {
    // Find the most recent active deal
    const activeDeal = session.activeDeals[session.activeDeals.length - 1];
    if (!activeDeal || !activeDeal.dealContext) {
      return this.textResult(
        session,
        'No active deal to reprice. Send me an address first.'
      );
    }

    // Only re-run Cashflow Agent (DealContext is cached)
    context.operationType = 'cashflow_price_rerun';
    const cashflowResult = await this.runCashflowAgent(
      context,
      activeDeal.dealContext,
      intent.price
    );

    // Re-synthesize with cached zoning/supply + new cashflow
    context.operationType = 'coordinator_synthesis';
    const synthesis = await this.synthesize(
      context,
      activeDeal.address,
      intent.price,
      activeDeal.agentResults?.zoning || this.defaultZoningResult(),
      activeDeal.agentResults?.supply || this.defaultSupplyResult(),
      cashflowResult
    );

    // Update the deal
    activeDeal.askingPrice = intent.price || activeDeal.askingPrice;
    activeDeal.agentResults = {
      ...activeDeal.agentResults,
      cashflow: cashflowResult,
    };
    activeDeal.jediScore = synthesis.jediScore;
    activeDeal.lastAnalyzed = new Date().toISOString();

    return {
      address: activeDeal.address,
      dealId: activeDeal.dealId,
      jediScore: synthesis.jediScore,
      recommendation: synthesis.recommendation,
      fullSummary: `Price updated to $${(intent.price || 0).toLocaleString()}. ${synthesis.summary}`,
      zoning: activeDeal.agentResults?.zoning || this.defaultZoningResult(),
      supply: activeDeal.agentResults?.supply || this.defaultSupplyResult(),
      cashflow: cashflowResult,
      followUpOptions: [
        { label: 'Try Another Price', action: 'reprice' },
        { label: 'Full Report', action: 'report_pdf' },
        { label: 'Sensitivity Matrix', action: 'sensitivity' },
      ],
      creditsUsed: session.creditsUsedThisSession,
      creditsRemaining: 0,
    };
  }

  // ── Handler: Comparison ──────────────────────────────────────

  private async handleComparison(
    context: AICallContext,
    session: ChatSession,
    intent: ExtractedIntent
  ): Promise<CoordinatorResult> {
    if (session.activeDeals.length < 2) {
      return this.textResult(
        session,
        'I need at least 2 deals to compare. Send me another address.'
      );
    }

    const deals = session.activeDeals.slice(-2);
    context.operationType = 'coordinator_comparison';

    const comparisonPrompt = `Compare these two real estate deals and provide a recommendation:

Deal 1: ${deals[0].address} — JEDI Score ${deals[0].jediScore}/100
Deal 2: ${deals[1].address} — JEDI Score ${deals[1].jediScore}/100

Respond with a concise comparison highlighting which deal is stronger and why.`;

    const response = await this.aiService.generate(
      context,
      'You are a real estate investment advisor comparing deals.',
      [{ role: 'user', content: comparisonPrompt }],
      { maxTokens: 1024 }
    );

    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      address: `${deals[0].address} vs ${deals[1].address}`,
      dealId: 'comparison',
      jediScore: Math.max(deals[0].jediScore || 0, deals[1].jediScore || 0),
      recommendation: 'INVESTIGATE',
      fullSummary: text,
      zoning: deals[0].agentResults?.zoning || this.defaultZoningResult(),
      supply: deals[0].agentResults?.supply || this.defaultSupplyResult(),
      cashflow: deals[0].agentResults?.cashflow || this.defaultCashflowResult(),
      followUpOptions: [
        { label: 'Report for Both', action: 'report_both' },
        { label: 'Analyze Another', action: 'new_analysis' },
      ],
      creditsUsed: session.creditsUsedThisSession,
      creditsRemaining: 0,
    };
  }

  // ── Handler: Question / Follow-up ────────────────────────────

  private async handleQuestion(
    context: AICallContext,
    session: ChatSession,
    intent: ExtractedIntent
  ): Promise<CoordinatorResult> {
    const activeDeal = session.activeDeals[session.activeDeals.length - 1];

    let systemContext = 'You are the JEDI RE real estate investment assistant.';
    if (activeDeal) {
      systemContext += `\n\nCurrent active deal: ${activeDeal.address}`;
      systemContext += `\nJEDI Score: ${activeDeal.jediScore}/100`;
    }

    const messages = session.conversationHistory.slice(-10).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));
    messages.push({ role: 'user', content: intent.question || '' });

    const response = await this.aiService.generate(
      context,
      systemContext,
      messages,
      { maxTokens: 1024 }
    );

    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return this.textResult(session, text);
  }

  // ── Handler: Greeting ────────────────────────────────────────

  private handleGreeting(session: ChatSession): CoordinatorResult {
    const name = session.userId ? '' : '';
    const dealCount = session.activeDeals.length;
    let text = `Welcome to JEDI RE! Send me a property address and I'll analyze it for you.`;
    if (dealCount > 0) {
      text = `Welcome back! You have ${dealCount} active deal${dealCount > 1 ? 's' : ''}. Send me an address or ask about your existing deals.`;
    }
    return this.textResult(session, text);
  }

  // ── Handler: Report Request ──────────────────────────────────

  private async handleReportRequest(
    context: AICallContext,
    session: ChatSession,
    intent: ExtractedIntent
  ): Promise<CoordinatorResult> {
    const activeDeal = session.activeDeals[session.activeDeals.length - 1];
    if (!activeDeal) {
      return this.textResult(session, 'No active deal to generate a report for. Send me an address first.');
    }

    context.operationType = intent.reportType === 'deal_bible'
      ? 'coordinator_deal_bible'
      : 'coordinator_report_lite';

    return {
      ...this.textResult(
        session,
        `Generating ${intent.reportType === 'deal_bible' ? 'Deal Bible' : 'PDF report'} for ${activeDeal.address}. This will be ready shortly.`
      ),
      dealId: activeDeal.dealId,
      address: activeDeal.address,
      jediScore: activeDeal.jediScore || 0,
    };
  }

  // ── Agent Runners ────────────────────────────────────────────

  private async runZoningAgent(
    context: AICallContext,
    dealContext: DealContext
  ): Promise<ZoningResult> {
    try {
      const result = await this.zoningAgent.execute(
        {
          address: dealContext.address,
          lotSizeSqft: dealContext.parcel.lotSizeSqFt,
        },
        context.userId
      );

      return {
        summary: result.analysis?.summary || `Zoned ${dealContext.zoning.district}. ${dealContext.zoning.maxBuildableUnits} units possible.`,
        buildableUnits: dealContext.zoning.maxBuildableUnits,
        maxStories: dealContext.zoning.maxStories,
        farUtilization: dealContext.zoning.far,
        parkingRequired: dealContext.zoning.parkingRatio * dealContext.zoning.maxBuildableUnits,
        overlayRestrictions: dealContext.zoning.overlays,
        developmentCapacity: `${dealContext.zoning.maxBuildableUnits} units, ${dealContext.zoning.maxStories} stories`,
        confidence: dealContext.zoning.confidence,
        details: result,
      };
    } catch (error) {
      logger.error('Coordinator: zoning agent failed', { error });
      return this.defaultZoningResult();
    }
  }

  private async runSupplyAgent(
    context: AICallContext,
    dealContext: DealContext
  ): Promise<SupplyResult> {
    try {
      const result = await this.supplyAgent.execute(
        {
          address: dealContext.address,
          market: dealContext.market,
          pipeline: dealContext.pipeline,
          comps: dealContext.comps,
        },
        context.userId
      );

      return {
        summary: `${dealContext.market.vacancyRate}% vacancy, ${dealContext.market.absorptionUnitsPerMonth} units/mo absorption. ${dealContext.pipeline.activePermits} active permits nearby.`,
        absorptionRate: dealContext.market.absorptionUnitsPerMonth,
        vacancyTrend: dealContext.market.vacancyRate < 5 ? 'falling' : dealContext.market.vacancyRate > 8 ? 'rising' : 'stable',
        monthsOfSupply: dealContext.pipeline.monthsOfPipelineSupply,
        pipelineDeliveries: dealContext.pipeline.totalPipelineUnits,
        competitivePositioning: `${dealContext.comps.length} comps within radius`,
        marketCyclePhase: 'expansion',
        confidence: 0.7,
        details: result,
      };
    } catch (error) {
      logger.error('Coordinator: supply agent failed', { error });
      return this.defaultSupplyResult();
    }
  }

  private async runCashflowAgent(
    context: AICallContext,
    dealContext: DealContext,
    askingPrice?: number
  ): Promise<CashflowResult> {
    try {
      const price = askingPrice || dealContext.parcel.assessedValue || 1_000_000;
      const result = await this.cashflowAgent.execute(
        {
          purchasePrice: price,
          monthlyRent: dealContext.market.avgRent,
          units: dealContext.zoning.maxBuildableUnits || 1,
        },
        context.userId
      );

      return {
        summary: `${result.cashOnCashReturn?.toFixed(1) || '?'}% cash-on-cash at $${price.toLocaleString()}. Strategy: ${result.recommendedStrategy || 'hold'}.`,
        noiProjection: result.annualNOI || 0,
        cashOnCashReturn: result.cashOnCashReturn || 0,
        irrEstimate: result.irrEstimate || 0,
        dscr: result.dscr || 0,
        recommendedStrategy: result.recommendedStrategy || 'hold',
        riskFlags: result.riskFlags || [],
        confidence: 0.7,
        details: result,
      };
    } catch (error) {
      logger.error('Coordinator: cashflow agent failed', { error });
      return this.defaultCashflowResult();
    }
  }

  // ── Synthesis ────────────────────────────────────────────────

  private async synthesize(
    context: AICallContext,
    address: string,
    price: number | undefined,
    zoning: ZoningResult,
    supply: SupplyResult,
    cashflow: CashflowResult
  ): Promise<{ jediScore: number; recommendation: 'BUY' | 'PASS' | 'INVESTIGATE'; summary: string }> {
    const prompt = SYNTHESIS_PROMPT
      .replace('{{address}}', address)
      .replace('{{price}}', price ? `$${price.toLocaleString()}` : 'Not specified')
      .replace('{{zoningResult}}', JSON.stringify(zoning, null, 2))
      .replace('{{supplyResult}}', JSON.stringify(supply, null, 2))
      .replace('{{cashflowResult}}', JSON.stringify(cashflow, null, 2));

    try {
      const response = await this.aiService.generate(
        context,
        'You are a real estate investment analyst generating JEDI Scores.',
        [{ role: 'user', content: prompt }],
        { maxTokens: 1024, temperature: 0 }
      );

      const text = response.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const parsed = JSON.parse(text);
      return {
        jediScore: Math.max(0, Math.min(100, parsed.jediScore || 50)),
        recommendation: parsed.recommendation || 'INVESTIGATE',
        summary: parsed.summary || 'Analysis complete.',
      };
    } catch (error) {
      logger.warn('Coordinator: synthesis parse failed, using heuristic scoring', { error });
      return this.heuristicScore(zoning, supply, cashflow);
    }
  }

  /**
   * Fallback heuristic scoring when Claude synthesis fails.
   */
  private heuristicScore(
    zoning: ZoningResult,
    supply: SupplyResult,
    cashflow: CashflowResult
  ): { jediScore: number; recommendation: 'BUY' | 'PASS' | 'INVESTIGATE'; summary: string } {
    const zoningScore = Math.min(100, zoning.buildableUnits > 0 ? 70 : 30);
    const marketScore = supply.vacancyTrend === 'falling' ? 80 : supply.vacancyTrend === 'stable' ? 60 : 40;
    const financialScore = cashflow.cashOnCashReturn > 8 ? 90 : cashflow.cashOnCashReturn > 5 ? 70 : cashflow.cashOnCashReturn > 0 ? 50 : 20;

    const jediScore = Math.round(
      zoningScore * JEDI_SCORE_WEIGHTS.zoning +
      marketScore * JEDI_SCORE_WEIGHTS.market +
      financialScore * JEDI_SCORE_WEIGHTS.financial
    );

    const recommendation: 'BUY' | 'PASS' | 'INVESTIGATE' =
      jediScore >= 75 ? 'BUY' : jediScore >= 50 ? 'INVESTIGATE' : 'PASS';

    return {
      jediScore,
      recommendation,
      summary: `JEDI Score ${jediScore}/100. ${cashflow.summary}`,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private textResult(session: ChatSession, text: string): CoordinatorResult {
    return {
      address: '',
      dealId: '',
      jediScore: 0,
      recommendation: 'INVESTIGATE',
      fullSummary: text,
      zoning: this.defaultZoningResult(),
      supply: this.defaultSupplyResult(),
      cashflow: this.defaultCashflowResult(),
      followUpOptions: [],
      creditsUsed: session.creditsUsedThisSession,
      creditsRemaining: 0,
    };
  }

  private defaultZoningResult(): ZoningResult {
    return {
      summary: 'Zoning data unavailable', buildableUnits: 0, maxStories: 0,
      farUtilization: 0, parkingRequired: 0, overlayRestrictions: [],
      developmentCapacity: 'Unknown', confidence: 0, details: {},
    };
  }

  private defaultSupplyResult(): SupplyResult {
    return {
      summary: 'Market data unavailable', absorptionRate: 0,
      vacancyTrend: 'stable', monthsOfSupply: 0, pipelineDeliveries: 0,
      competitivePositioning: 'Unknown', marketCyclePhase: 'expansion',
      confidence: 0, details: {},
    };
  }

  private defaultCashflowResult(): CashflowResult {
    return {
      summary: 'Financial data unavailable', noiProjection: 0,
      cashOnCashReturn: 0, irrEstimate: 0, dscr: 0,
      recommendedStrategy: 'hold', riskFlags: [],
      confidence: 0, details: {},
    };
  }
}

export const coordinator = new AICoordinator();
