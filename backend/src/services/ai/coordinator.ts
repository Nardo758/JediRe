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
import { buildPersonaPrompt, getPersona } from '../../coordinator/personas/index';
import { buildFragmentPrompt, type FragmentDealContext } from '../../coordinator/context-fragments';
import { SPECIALIST_PERSONA_MAP, type SpecialistKey } from '../../coordinator/dispatch';
import { SPECIALIST_TRIGGERS } from '../orchestrator/intent-classifier';
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
import type { OperatorStance } from '../../types/operator-stance';
import { computeAffectedFields, type AffectedField } from '../operatorStance.service';

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

// ── Operator Stance Thesis Lens ────────────────────────────────

/**
 * Build a one-paragraph "OPERATOR THESIS LENS" block for injection into
 * the Coordinator's system prompt. Returns empty string when stance is null
 * or at MARKET defaults (no active thesis to frame).
 *
 * The lookup table covers the three dials that most strongly shape the thesis:
 * rateEnvironment × cyclePosition × underwritingPosture.
 */
function buildStanceThesisLens(stance: OperatorStance | null | undefined): string {
  if (!stance || stance.defaulted) return '';

  const RATE_LABEL: Record<string, string> = {
    CUTTING:          'rates falling (Fed easing)',
    NORMALIZING:      'rates normalizing',
    HIGHER_FOR_LONGER:'rates staying elevated (higher-for-longer)',
  };
  const CYCLE_LABEL: Record<string, string> = {
    EARLY: 'early-cycle recovery',
    MID:   'mid-cycle expansion',
    LATE:  'late-cycle with supply risk',
  };
  const POSTURE_LABEL: Record<string, string> = {
    CONSERVATIVE: 'conservative underwriting (wider caps, lower rent growth, higher vacancy floors)',
    MARKET:       'market-rate underwriting',
    AGGRESSIVE:   'aggressive underwriting (tighter caps, optimistic rent growth)',
  };

  const rateTxt    = RATE_LABEL[stance.rateEnvironment]    ?? stance.rateEnvironment;
  const cycleTxt   = CYCLE_LABEL[stance.cyclePosition]     ?? stance.cyclePosition;
  const postureTxt = POSTURE_LABEL[stance.underwritingPosture] ?? stance.underwritingPosture;

  const recessionNote = stance.recessionProbability >= 0.4
    ? ` Operator flags a ${Math.round(stance.recessionProbability * 100)}% recession probability — stress overlays are active.`
    : '';

  return `\n\nOPERATOR THESIS LENS\n` +
    `This operator's worldview: ${rateTxt}, ${cycleTxt}, ${postureTxt}.${recessionNote}\n` +
    `Frame your recommendations and summaries through this lens. When the operator's ` +
    `thesis differs from market consensus, lead with their perspective but acknowledge ` +
    `the consensus position briefly.`;
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
{{cashflowResult}}{{stanceEffects}}
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

    // Step 2: Research Agent — assemble DealContext via AgentRuntime adapter.
    // Provide dealId from session so the adapter uses the Phase 3 runtime path.
    const dealContext = await this.researchAgent.execute({
      address: intent.address,
      userId: session.userId,
      dealId: session.dealId,
    });

    // Step 3: Run 3 analytical agents in parallel
    const dealId = session.dealId;
    const [zoningResult, supplyResult, cashflowResult] = await Promise.all([
      this.runZoningAgent(context, dealContext, dealId),
      this.runSupplyAgent(context, dealContext, dealId),
      this.runCashflowAgent(context, dealContext, intent.price, dealId),
    ]);

    // Step 4: Compute stance-affected fields for synthesis depth (P3-05)
    let affectedFields: AffectedField[] = [];
    if (dealId && dealContext.operatorStance && !dealContext.operatorStance.defaulted) {
      try {
        affectedFields = await computeAffectedFields(dealId, dealContext.operatorStance);
      } catch { /* non-fatal — synthesis proceeds without field-level stance detail */ }
    }

    // Step 5: Synthesize results
    context.operationType = 'coordinator_synthesis';
    const synthesis = await this.synthesize(
      context,
      intent.address,
      intent.price,
      zoningResult,
      supplyResult,
      cashflowResult,
      dealContext.operatorStance,
      affectedFields,
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
      intent.price,
      activeDeal.dealId
    );

    // Re-synthesize with cached zoning/supply + new cashflow
    context.operationType = 'coordinator_synthesis';
    const synthesis = await this.synthesize(
      context,
      activeDeal.address,
      intent.price,
      activeDeal.agentResults?.zoning || this.defaultZoningResult(),
      activeDeal.agentResults?.supply || this.defaultSupplyResult(),
      cashflowResult,
      activeDeal.dealContext?.operatorStance,
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

    // ── Persona + fragment selection ─────────────────────────────
    const specialistKey = this.detectSpecialistFromQuestion(intent.question || '');
    const personaEntry = specialistKey ? SPECIALIST_PERSONA_MAP[specialistKey] : null;

    let personaHeader: string | undefined;
    let systemContext: string;

    if (personaEntry) {
      const persona = getPersona(personaEntry.personaId);
      const personaBlock = buildPersonaPrompt(personaEntry.personaId);

      // Build deal context for fragment injection
      const dealCtx: FragmentDealContext | undefined = activeDeal
        ? {
            address: activeDeal.address,
            city: activeDeal.dealContext?.market?.msa,
            marketStats: activeDeal.dealContext
              ? {
                  vacancyRate: activeDeal.dealContext.market.vacancyRate,
                  avgRent: activeDeal.dealContext.market.avgRent,
                  rentGrowthYoY: activeDeal.dealContext.market.rentGrowthYoY,
                  absorptionRate: activeDeal.dealContext.market.absorptionUnitsPerMonth,
                }
              : undefined,
          }
        : undefined;

      const fragmentBlock = personaEntry.fragmentKey
        ? buildFragmentPrompt(personaEntry.fragmentKey, dealCtx)
        : '';

      systemContext = personaBlock + fragmentBlock;

      if (persona) {
        personaHeader = `${persona.displayName} — ${personaEntry.domainLabel}`;
      }
    } else {
      systemContext = 'You are the JEDI RE real estate investment assistant.';
    }

    // Append active deal context regardless of persona
    if (activeDeal) {
      systemContext += `\n\nCurrent active deal: ${activeDeal.address}`;
      systemContext += `\nJEDI Score: ${activeDeal.jediScore}/100`;
      // Inject operator thesis lens when operator has set a non-default stance
      systemContext += buildStanceThesisLens(activeDeal.dealContext?.operatorStance);
      // P3-05: inject field-level stance deltas so the advisor knows exactly which
      // numbers are modulated vs. market defaults
      const activeStance = activeDeal.dealContext?.operatorStance;
      if (activeDeal.dealId && activeStance && !activeStance.defaulted) {
        try {
          const fields = await computeAffectedFields(activeDeal.dealId, activeStance);
          if (fields.length > 0) {
            const fieldLines = fields
              .map(f => `${f.fieldPath} ${f.deltaBps > 0 ? '+' : ''}${f.deltaBps}bps`)
              .join(', ');
            systemContext += `\nStance-modulated fields: ${fieldLines}`;
          }
        } catch { /* non-fatal */ }
      }
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

    const result = this.textResult(session, text);
    return personaHeader ? { ...result, personaHeader } : result;
  }

  /**
   * Detect which specialist domain the user's question belongs to.
   * Delegates to the same `SPECIALIST_TRIGGERS` table used by IntentClassifier
   * so routing logic has a single source of truth.
   * Returns null when no trigger matches (falls back to generic assistant voice).
   */
  private detectSpecialistFromQuestion(question: string): SpecialistKey | null {
    const lower = question.toLowerCase();
    for (const [agent, triggers] of Object.entries(SPECIALIST_TRIGGERS) as Array<[SpecialistKey, string[]]>) {
      if (triggers.some(trigger => lower.includes(trigger))) {
        return agent;
      }
    }
    return null;
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
    dealContext: DealContext,
    dealId?: string
  ): Promise<ZoningResult> {
    try {
      const result = await this.zoningAgent.execute(
        {
          dealId,
          userId: context.userId,
          address: dealContext.address,
          lotSizeSqft: dealContext.parcel.lotSizeSqFt,
        },
        context.userId
      );

      // Support both Phase 4 snake_case schema and legacy fallback
      const r = result as Record<string, unknown>;
      const zoningCode = (r.zoning_code as string) ?? '';
      const runtimeSummary = (r.summary as string) ?? (r.analysis as Record<string,unknown>)?.summary as string | undefined;

      return {
        summary: runtimeSummary || `Zoned ${zoningCode || dealContext.zoning.district}. ${dealContext.zoning.maxBuildableUnits} units possible.`,
        buildableUnits: (r.est_max_units as number) ?? dealContext.zoning.maxBuildableUnits,
        maxStories: dealContext.zoning.maxStories,
        farUtilization: (r.max_far as number) ?? dealContext.zoning.far,
        parkingRequired: dealContext.zoning.parkingRatio * dealContext.zoning.maxBuildableUnits,
        overlayRestrictions: dealContext.zoning.overlays,
        developmentCapacity: `${(r.est_max_units as number) ?? dealContext.zoning.maxBuildableUnits} units, ${dealContext.zoning.maxStories} stories`,
        confidence: (r.confidence_score as number) ?? dealContext.zoning.confidence,
        details: result,
      };
    } catch (error) {
      logger.error('Coordinator: zoning agent failed', { error });
      return this.defaultZoningResult();
    }
  }

  private async runSupplyAgent(
    context: AICallContext,
    dealContext: DealContext,
    dealId?: string
  ): Promise<SupplyResult> {
    try {
      const result = await this.supplyAgent.execute(
        {
          dealId,
          userId: context.userId,
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
    askingPrice?: number,
    dealId?: string
  ): Promise<CashflowResult> {
    try {
      const price = askingPrice || dealContext.parcel.assessedValue || 1_000_000;
      const result = await this.cashflowAgent.execute(
        {
          dealId,
          userId: context.userId,
          purchasePrice: price,
          monthlyRent: dealContext.market.avgRent,
          units: dealContext.zoning.maxBuildableUnits || 1,
        },
        context.userId
      );

      // Support both Phase 4 snake_case schema and legacy fallback
      const r = result as Record<string, unknown>;
      const coc = (r.avg_cash_on_cash_pct as number) ?? (r.cashOnCashReturn as number) ?? 0;
      const noi = (r.noi_year1 as number) ?? (r.annualNOI as number) ?? 0;
      const irr = (r.irr_pct as number) ?? (r.irrEstimate as number) ?? 0;
      const dscr = (r.dscr_year1 as number) ?? (r.dscr as number) ?? 0;
      const rating = (r.investment_rating as string) ?? (r.recommendedStrategy as string) ?? 'hold';
      const runtimeSummary = (r.summary as string);

      return {
        summary: runtimeSummary || `${coc.toFixed(1)}% cash-on-cash at $${price.toLocaleString()}. Rating: ${rating}.`,
        noiProjection: noi,
        cashOnCashReturn: coc,
        irrEstimate: irr,
        dscr,
        recommendedStrategy: rating,
        riskFlags: (r.riskFlags as string[]) ?? [],
        confidence: (r.confidence_score as number) ?? 0.7,
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
    cashflow: CashflowResult,
    operatorStance?: OperatorStance | null,
    affectedFields?: AffectedField[],
  ): Promise<{ jediScore: number; recommendation: 'BUY' | 'PASS' | 'INVESTIGATE'; summary: string }> {
    let stanceEffectsBlock = '';
    if (affectedFields && affectedFields.length > 0) {
      const lines = affectedFields.map(f =>
        `  • ${f.fieldPath}: ${f.deltaBps > 0 ? '+' : ''}${f.deltaBps}bps — ${f.trace}`
      );
      stanceEffectsBlock = `\n\nSTANCE MODULATION ACTIVE — operator thesis is adjusting these underwriting fields:\n${lines.join('\n')}\n`;
    }

    const prompt = SYNTHESIS_PROMPT
      .replace('{{address}}', address)
      .replace('{{price}}', price ? `$${price.toLocaleString()}` : 'Not specified')
      .replace('{{zoningResult}}', JSON.stringify(zoning, null, 2))
      .replace('{{supplyResult}}', JSON.stringify(supply, null, 2))
      .replace('{{cashflowResult}}', JSON.stringify(cashflow, null, 2))
      .replace('{{stanceEffects}}', stanceEffectsBlock);

    const synthesisSystemPrompt =
      'You are a real estate investment analyst generating JEDI Scores.' +
      buildStanceThesisLens(operatorStance);

    try {
      const response = await this.aiService.generate(
        context,
        synthesisSystemPrompt,
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
