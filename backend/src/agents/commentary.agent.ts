import { v4 as uuidv4 } from 'uuid';
import type { TextBlock } from '@anthropic-ai/sdk/resources';
import { logger } from '../utils/logger';
import { query } from '../database/connection';
import {
  strategyArbitrageEngine,
  StrategySignalInputs,
  ArbitrageResult,
  StrategyType,
  STRATEGY_LABELS,
} from '../services/module-wiring/strategy-arbitrage-engine';
import { jediAI } from '../services/ai/aiService';
import type { AICallContext } from '../types/dealContext';
import { buildEconomicContextBlock } from '../services/economic-context.service';
import { commentaryRuntime } from './commentary.config';
import type { CommentaryAgentOutput } from './commentary.config';
import { recordSentimentSnapshot, labelToScore } from '../services/sentiment-history.service';
import { fetchBrokerNarratives } from '../api/rest/broker-narratives.routes';
import { getPool } from '../database/connection';

export interface CommentaryInput {
  entityType: 'msa' | 'submarket' | 'property';
  entityId: string;
  entityName?: string;
  signals?: StrategySignalInputs;
  forceRefresh?: boolean;
  userId?: string;
  /**
   * 'owned'    — Asset Hub: frame analysis as owned-asset operational review
   *              (NOI trend, occupancy health vs UW, capex posture).
   * 'pipeline' — Deal pipeline: frame as acquisition/investment thesis analysis.
   * undefined  — Legacy callers; treated as 'pipeline'.
   */
  assetMode?: 'owned' | 'pipeline';
}

export interface CommentarySection {
  title: string;
  content: string;
  sentiment: 'bullish' | 'neutral' | 'bearish';
}

export interface StrategyScoreResult {
  strategy: StrategyType;
  label: string;
  score: number;
  rank: number;
  signalContributions: Record<string, number>;
}

export interface CommentaryResult {
  requestId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  marketNarrative: CommentarySection;
  investmentThesis: {
    recommendation: string;
    points: { icon: string; color: 'green' | 'amber' | 'red'; text: string }[];
  };
  signalCommentary: Record<string, CommentarySection>;
  riskOpportunity: {
    risks: { label: string; severity: 'high' | 'medium' | 'low'; detail: string }[];
    opportunities: { label: string; impact: 'high' | 'medium' | 'low'; detail: string }[];
  };
  peerContext: {
    summary: string;
    peerRank: number;
    peerTotal: number;
    topPeers: { name: string; score: number }[];
  };
  supplyNarrative: CommentarySection;
  strategyScores: StrategyScoreResult[];
  arbitrageFlag: boolean;
  arbitrageDelta: number;
  recommendedStrategy: StrategyType;
  jediScore: number;
  cacheTTLHours: number;
}

const CACHE_TTL_HOURS = 24;

export class CommentaryAgent {
  async execute(input: CommentaryInput): Promise<CommentaryResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Commentary Agent: starting generation', {
      requestId,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    if (!input.forceRefresh) {
      const cached = await this.getCachedCommentary(input.entityType, input.entityId, input.userId);
      if (cached) {
        logger.info('Commentary Agent: returning cached commentary', {
          requestId,
          entityType: input.entityType,
          entityId: input.entityId,
        });
        return cached;
      }
    }

    const signals = input.signals || this.deriveSignals(input.entityType, input.entityId);
    const arbitrageResult = await strategyArbitrageEngine.analyze(
      `${input.entityType}-${input.entityId}`,
      signals,
    );

    const entityName = input.entityName || this.formatEntityName(input.entityId);

    const jediScore = this.computeJediScore(signals);

    let marketNarrative: CommentarySection;
    try {
      marketNarrative = await this.generateAINarrative(
        entityName, input.entityType, signals, arbitrageResult, jediScore, input.userId,
        undefined, input.entityId, input.assetMode,
      );
    } catch (err) {
      logger.warn('Commentary Agent: AI generation failed, using template fallback', { error: err });
      marketNarrative = this.generateMarketNarrative(entityName, input.entityType, signals, arbitrageResult);
    }

    const result: CommentaryResult = {
      requestId,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName,
      timestamp: new Date().toISOString(),
      marketNarrative,
      investmentThesis: this.generateInvestmentThesis(entityName, input.entityType, signals, arbitrageResult),
      signalCommentary: this.generateSignalCommentary(entityName, signals),
      riskOpportunity: this.generateRiskOpportunity(entityName, input.entityType, signals),
      peerContext: this.generatePeerContext(entityName, input.entityType, jediScore),
      supplyNarrative: this.generateSupplyNarrative(entityName, signals),
      strategyScores: arbitrageResult.strategies.map(s => ({
        strategy: s.strategy,
        label: s.label,
        score: s.score,
        rank: s.rank,
        signalContributions: s.signalContributions,
      })),
      arbitrageFlag: arbitrageResult.arbitrageFlag,
      arbitrageDelta: arbitrageResult.arbitrageDelta,
      recommendedStrategy: arbitrageResult.recommended,
      jediScore,
      cacheTTLHours: CACHE_TTL_HOURS,
    };

    await this.cacheCommentary(result, input.userId);

    const elapsed = Date.now() - startTime;
    logger.info('Commentary Agent: generation complete', {
      requestId,
      entityType: input.entityType,
      entityId: input.entityId,
      elapsed: `${elapsed}ms`,
      jediScore,
      recommendedStrategy: arbitrageResult.recommended,
      aiGenerated: marketNarrative !== this.generateMarketNarrative(entityName, input.entityType, signals, arbitrageResult),
    });

    return result;
  }

  private async generateAINarrative(
    name: string,
    entityType: string,
    signals: StrategySignalInputs,
    arb: ArbitrageResult,
    jediScore: number,
    userId?: string,
    businessType?: string,
    entityId?: string,
    assetMode?: 'owned' | 'pipeline',
  ): Promise<CommentarySection> {
    const levelLabel = entityType === 'msa' ? 'metro' : entityType === 'submarket' ? 'submarket' : 'property';
    const recommended = STRATEGY_LABELS[arb.recommended];

    // Fetch economic context block (FRED + BLS + SEC), catching errors gracefully
    let econContextText = '';
    try {
      const econCtx = await buildEconomicContextBlock(businessType, true);
      econContextText = econCtx.text;
    } catch (err: any) {
      logger.warn('[Commentary] Economic context fetch failed, omitting from prompt', { error: err.message });
    }

    // Pull the latest broker narratives tagged to this market (Task #383).
    // Brokers' on-the-ground language about supply, rent trajectory, and tenant
    // demand is a strong qualitative signal the model otherwise lacks.
    let brokerNarrativeBlock = '';
    if ((entityType === 'msa' || entityType === 'submarket') && entityId) {
      try {
        const narrPool = getPool();
        if (narrPool) {
          const out = await fetchBrokerNarratives(narrPool, entityType, entityId, 5);
          if (out.rows.length > 0) {
            const lines = out.rows.map(r => {
              const tag = r.sentimentLabel ? `[${r.sentimentLabel}]` : '[unscored]';
              const src = r.broker ? ` — ${r.broker}` : '';
              const prop = r.propertyName ? ` (${r.propertyName})` : '';
              return `- ${tag}${src}${prop}: ${r.text}`;
            }).join('\n');
            brokerNarrativeBlock = `\nBroker Narratives (recent OMs):\n${lines}\n` +
              `Citation tag: [Broker OM]. Use to confirm or contrast quantitative signals; do NOT reproduce broker hype as fact.`;
            logger.info('[Commentary] injected broker narratives into context', {
              entityType, entityId, count: out.rows.length,
            });
          }
        }
      } catch (err) {
        logger.warn('[Commentary] broker narratives fetch failed', {
          entityType, entityId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Owned-asset framing block: injected first so it anchors the AI's output voice
    const assetModeBlock = assetMode === 'owned'
      ? `Asset Context: OWNED PORTFOLIO ASSET — Frame all checkpoint bullets as an operational health review of an asset already in the portfolio. ` +
        `Focus on: NOI trend vs underwriting, occupancy health (delta vs UW target), capex posture (on/behind budget), ` +
        `rent burn-off rate, stabilization trajectory, and expense escalation risk. ` +
        `Do NOT use acquisition or market-entry language (e.g. avoid "buy", "enter", "pipeline deal", "acquisition thesis"). ` +
        `Signal scores below are derived from actual monthly performance data.`
      : '';

    const contextBlock = [
      assetModeBlock,
      `Entity: ${name} (${levelLabel})`,
      `Signal scores (0-100): Demand=${signals.demandScore}, Supply=${signals.supplyScore}, Momentum=${signals.momentumScore}, Position=${signals.positionScore}, Risk=${signals.riskScore}`,
      `JEDI Composite Score: ${jediScore}`,
      `Recommended Strategy: ${recommended} (score: ${arb.recommendedScore.toFixed(0)})`,
      `Arbitrage Flag: ${arb.arbitrageFlag ? `Yes, ${arb.arbitrageDelta.toFixed(0)}pt spread` : 'No'}`,
      `Strategy Rankings: ${arb.strategies.map(s => `${s.label}: ${s.score.toFixed(0)}`).join(', ')}`,
      econContextText ? `\n${econContextText}` : '',
      brokerNarrativeBlock,
    ].filter(Boolean).join('\n');

    const sentiment: 'bullish' | 'neutral' | 'bearish' =
      signals.demandScore >= 60 && signals.momentumScore >= 55 ? 'bullish' :
      signals.demandScore < 45 || signals.momentumScore < 40 ? 'bearish' : 'neutral';

    // ── Primary path: AgentRuntime (commentary-v2 system prompt) ────
    try {
      // Pass empty string when no end-user is attached (system/cron-driven
      // commentary). aiService.checkAndDeductCredits treats empty userId as
      // an internal call and skips metering. Sending "system" here was a
      // latent bug — Postgres rejects non-UUID strings on user_id columns
      // and the whole call would fail silently.
      const rtCtx = {
        dealId: undefined as string | undefined,
        userId: userId ?? '',
        triggeredBy: 'user' as const,
        triggerContext: { source: 'commentary_agent', entity_type: entityType, entity_name: name },
      };

      const output = await commentaryRuntime.run(
        {
          entity_type: entityType,
          entity_id: entityId ?? name,
          entity_name: name,
          context_block: contextBlock,
        },
        rtCtx
      ) as CommentaryAgentOutput;

      const narrativeContent = output.market_narrative?.content
        ?? `${name} analysis generated with JEDI Score ${jediScore}.`;

      return {
        title: 'Market Narrative',
        content: narrativeContent,
        sentiment: output.market_narrative?.sentiment ?? sentiment,
      };
    } catch (runtimeErr: unknown) {
      logger.warn('[Commentary] commentaryRuntime.run() failed, falling back to jediAI.generate()', {
        error: runtimeErr instanceof Error ? runtimeErr.message : String(runtimeErr),
      });
    }

    // ── Fallback path: direct jediAI.generate() ─────────────────────
    // Empty userId → aiService treats as internal call, skips metering.
    // Sending "system" here historically crashed the AI ledger writes
    // because user_id is a UUID column; that crash would surface as a
    // generic narrative-failure with no clue why.
    const context: AICallContext = {
      userId: userId || '',
      stripeCustomerId: '',
      agentId: 'commentary',
      operationType: 'commentary_generation',
      surface: 'web',
      dealId: undefined,
    };

    const systemPrompt = `You are a senior multifamily real estate analyst writing institutional-grade market commentary for a Bloomberg Terminal-style platform called JediRE. Write in a professional, data-driven tone. Be concise and specific. Output only the narrative text, no headers or formatting.

IMPORTANT CITATION RULES:
- When you reference a statistic from the Economic & Industry Context block below, you MUST cite the source tag in brackets exactly as shown (e.g., "[FRED, 2025-04-19]" or "[BLS QCEW 2024]" or "[SEC 10-K FY2024]").
- Do NOT fabricate or guess at any economic numbers. Only use figures provided in the context block.
- If the context block shows "N/A" for a data point, omit that statistic entirely.`;

    const userMessage = `Write a 2-3 sentence market narrative for ${name} (${levelLabel} level).\n\n${contextBlock}\n\nFocus on demand dynamics, supply pipeline impact, and investment positioning.`;

    const response = await jediAI.generate(
      context,
      systemPrompt,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 320, temperature: 0.3 },
    );

    const content = response.content
      .filter((block): block is TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    return { title: 'Market Narrative', content, sentiment };
  }

  private computeJediScore(signals: StrategySignalInputs): number {
    const score =
      signals.demandScore * 0.30 +
      signals.supplyScore * 0.25 +
      signals.momentumScore * 0.20 +
      signals.positionScore * 0.15 +
      signals.riskScore * 0.10;
    return parseFloat(Math.max(0, Math.min(100, score)).toFixed(1));
  }

  private generateMarketNarrative(
    name: string,
    entityType: string,
    signals: StrategySignalInputs,
    arb: ArbitrageResult,
  ): CommentarySection {
    const demandStrength = signals.demandScore >= 70 ? 'strong' : signals.demandScore >= 50 ? 'moderate' : 'weak';
    const supplyPressure = signals.supplyScore < 40 ? 'elevated supply pipeline' : signals.supplyScore < 60 ? 'moderate supply pipeline' : 'contained supply environment';
    const momentum = signals.momentumScore >= 65 ? 'positive' : signals.momentumScore >= 45 ? 'neutral' : 'softening';
    const sentiment: 'bullish' | 'neutral' | 'bearish' =
      signals.demandScore >= 60 && signals.momentumScore >= 55 ? 'bullish' :
      signals.demandScore < 45 || signals.momentumScore < 40 ? 'bearish' : 'neutral';

    const levelLabel = entityType === 'msa' ? 'metro' : entityType === 'submarket' ? 'submarket' : 'property';
    const recommended = STRATEGY_LABELS[arb.recommended];

    const content = `${name}'s multifamily ${levelLabel} demonstrates ${demandStrength} demand fundamentals ` +
      `with a ${supplyPressure}. Momentum indicators are ${momentum}, ` +
      `supporting a ${recommended} positioning with a strategy score of ${arb.recommendedScore.toFixed(0)}. ` +
      (arb.arbitrageFlag
        ? `Arbitrage opportunity detected: ${arb.arbitrageDelta.toFixed(0)}pt spread between top strategies.`
        : `Strategy alignment is consistent across investment approaches.`);

    return { title: 'Market Narrative', content, sentiment };
  }

  private generateInvestmentThesis(
    name: string,
    entityType: string,
    signals: StrategySignalInputs,
    arb: ArbitrageResult,
  ) {
    const points: { icon: string; color: 'green' | 'amber' | 'red'; text: string }[] = [];

    if (signals.demandScore >= 65) {
      points.push({ icon: '✓', color: 'green', text: 'Demand fundamentals exceed market average' });
    } else if (signals.demandScore >= 45) {
      points.push({ icon: '⚠', color: 'amber', text: 'Demand fundamentals at market average' });
    } else {
      points.push({ icon: '✗', color: 'red', text: 'Demand fundamentals below market average' });
    }

    if (signals.supplyScore >= 60) {
      points.push({ icon: '✓', color: 'green', text: 'Supply environment favorable for investment' });
    } else if (signals.supplyScore >= 40) {
      points.push({ icon: '⚠', color: 'amber', text: 'Near-term supply deliveries may pressure occupancy' });
    } else {
      points.push({ icon: '✗', color: 'red', text: 'Elevated supply pipeline creating headwinds' });
    }

    if (signals.momentumScore >= 60) {
      points.push({ icon: '✓', color: 'green', text: 'Rent and NOI growth trajectory accelerating' });
    } else if (signals.momentumScore >= 45) {
      points.push({ icon: '⚠', color: 'amber', text: 'Growth momentum stabilizing' });
    } else {
      points.push({ icon: '✗', color: 'red', text: 'Rent growth decelerating below trend' });
    }

    if (signals.riskScore >= 60) {
      points.push({ icon: '✓', color: 'green', text: 'Risk profile within acceptable parameters' });
    } else if (signals.riskScore >= 40) {
      points.push({ icon: '⚠', color: 'amber', text: 'Emerging risk factors warrant monitoring' });
    } else {
      points.push({ icon: '✗', color: 'red', text: 'Elevated risk factors require mitigation' });
    }

    const avgScore = (signals.demandScore + signals.supplyScore + signals.momentumScore) / 3;
    const recommendation = avgScore >= 65 ? 'STRONG BUY' : avgScore >= 55 ? 'SELECTIVE BUY' : avgScore >= 45 ? 'HOLD' : 'UNDERWEIGHT';

    return { recommendation, points };
  }

  private generateSignalCommentary(
    name: string,
    signals: StrategySignalInputs,
  ): Record<string, CommentarySection> {
    const commentary: Record<string, CommentarySection> = {};

    commentary.demand = {
      title: 'Demand Signal',
      content: signals.demandScore >= 65
        ? `${name} exhibits robust demand with population and employment growth outpacing regional averages. Job-housing ratio supports sustained absorption.`
        : signals.demandScore >= 45
        ? `${name} shows moderate demand with growth metrics near regional norms. Employment base diversification continues gradually.`
        : `${name} facing demand headwinds with below-average growth. Migration patterns shifting toward competing markets.`,
      sentiment: signals.demandScore >= 65 ? 'bullish' : signals.demandScore >= 45 ? 'neutral' : 'bearish',
    };

    commentary.supply = {
      title: 'Supply Signal',
      content: signals.supplyScore >= 60
        ? `Supply conditions are favorable with limited pipeline deliveries. Absorption runway of 20+ months provides cushion for new entrants.`
        : signals.supplyScore >= 40
        ? `Moderate supply pipeline with deliveries concentrated in select submarkets. Selective positioning recommended to avoid oversupplied nodes.`
        : `Elevated supply pipeline creating near-term pressure. Delivery clusters may temporarily impact occupancy and concession levels.`,
      sentiment: signals.supplyScore >= 60 ? 'bullish' : signals.supplyScore >= 40 ? 'neutral' : 'bearish',
    };

    commentary.momentum = {
      title: 'Momentum Signal',
      content: signals.momentumScore >= 60
        ? `Momentum indicators trending positively. Rent growth accelerating with NOI expansion outpacing expense escalation.`
        : signals.momentumScore >= 45
        ? `Growth metrics stabilizing at sustainable levels. Rent gains moderating but remain positive in real terms.`
        : `Momentum indicators softening. Cap rate decompression risk increasing as rent growth decelerates.`,
      sentiment: signals.momentumScore >= 60 ? 'bullish' : signals.momentumScore >= 45 ? 'neutral' : 'bearish',
    };

    commentary.position = {
      title: 'Position Signal',
      content: signals.positionScore >= 60
        ? `Strong positional fundamentals with favorable walkability, employment access, and development capacity metrics.`
        : signals.positionScore >= 40
        ? `Adequate positional characteristics. Location benefits partially offset by competitive positioning constraints.`
        : `Positional challenges limit upside potential. Location-dependent factors require careful underwriting.`,
      sentiment: signals.positionScore >= 60 ? 'bullish' : signals.positionScore >= 40 ? 'neutral' : 'bearish',
    };

    commentary.risk = {
      title: 'Risk Signal',
      content: signals.riskScore >= 60
        ? `Risk profile within acceptable parameters. Insurance, tax, and regulatory environments remain stable.`
        : signals.riskScore >= 40
        ? `Emerging risk factors include rising insurance costs and potential regulatory changes. Active monitoring recommended.`
        : `Elevated risk profile with multiple adverse factors. Insurance escalation and regulatory uncertainty require mitigation planning.`,
      sentiment: signals.riskScore >= 60 ? 'bullish' : signals.riskScore >= 40 ? 'neutral' : 'bearish',
    };

    const avgScore = (signals.demandScore + signals.supplyScore + signals.momentumScore) / 3;

    commentary.capital_sentiment = {
      title: 'Capital Sentiment',
      content: signals.positionScore >= 60 && signals.momentumScore >= 55
        ? `${name} capital markets remain active with buyer depth exceeding seller expectations. Cap rate compression continuing as institutional allocations increase. Transaction velocity above trailing 12-month average.`
        : signals.positionScore >= 40
        ? `${name} capital markets balanced between buyers and sellers. Bid-ask spreads narrowing but selective. Debt availability adequate for quality sponsors.`
        : `${name} capital markets cautious with widening bid-ask spreads. Financing conditions tightening for value-add plays. Distressed opportunity pipeline building.`,
      sentiment: signals.positionScore >= 60 && signals.momentumScore >= 55 ? 'bullish' : signals.positionScore >= 40 ? 'neutral' : 'bearish',
    };

    commentary.ranking_insights = {
      title: 'Ranking Insights',
      content: avgScore >= 65
        ? `${name} ranks in the top quartile across composite scoring dimensions. Demand-supply equilibrium and growth trajectory drive outperformance versus peer set. Strongest differentiation in employment momentum.`
        : avgScore >= 50
        ? `${name} holds a mid-tier ranking with competitive fundamentals. Pockets of outperformance in select signal categories offset by average positioning in others.`
        : `${name} ranks below median with fundamental challenges across multiple scoring dimensions. Improvement trajectory dependent on demand recovery and supply moderation.`,
      sentiment: avgScore >= 65 ? 'bullish' : avgScore >= 50 ? 'neutral' : 'bearish',
    };

    commentary.pricing_power = {
      title: 'Pricing Power',
      content: signals.demandScore >= 60 && signals.supplyScore >= 50
        ? `${name} exhibits strong pricing power with demand exceeding available inventory. Operators pushing effective rents higher with declining concession usage. Loss-to-lease capturing accelerating.`
        : signals.demandScore >= 45
        ? `${name} pricing power moderate with balanced demand-supply dynamics. Rent growth positive but concessions stabilizing at 3-5% levels. Renewal conversions holding at 55%+.`
        : `${name} pricing power constrained by elevated supply and softening demand. Concession activity rising with new lease spreads compressing. Renewal premiums under pressure.`,
      sentiment: signals.demandScore >= 60 && signals.supplyScore >= 50 ? 'bullish' : signals.demandScore >= 45 ? 'neutral' : 'bearish',
    };

    commentary.news_impact = {
      title: 'News Impact Assessment',
      content: signals.momentumScore >= 60
        ? `Recent market developments predominantly positive for ${name}. Employment announcements and infrastructure investments reinforcing growth thesis. Regulatory environment stable with no near-term headwinds.`
        : signals.momentumScore >= 45
        ? `Mixed signals in recent ${name} market news. Positive employment trends offset by supply delivery concerns. Watch for zoning and permitting decisions that could shift pipeline trajectory.`
        : `${name} facing headwind-oriented news flow. Supply concerns dominating sentiment alongside broader macro uncertainty. Near-term catalysts limited pending demand recovery signals.`,
      sentiment: signals.momentumScore >= 60 ? 'bullish' : signals.momentumScore >= 45 ? 'neutral' : 'bearish',
    };

    commentary.trend_interpretation = {
      title: 'Trend Interpretation',
      content: signals.momentumScore >= 60 && signals.demandScore >= 55
        ? `${name} trend lines confirm accelerating fundamentals. Rent growth, occupancy, and absorption all trending above 12-month moving averages. Inflection points in supply cycle approaching favorable territory.`
        : signals.momentumScore >= 45
        ? `${name} trends showing stabilization after recent volatility. Key metrics plateauing near equilibrium levels with seasonal patterns dominating short-term variation.`
        : `${name} trend lines indicate softening trajectory. Multiple metrics trending below 12-month averages. Monitor for potential inflection as supply pipeline begins to moderate.`,
      sentiment: signals.momentumScore >= 60 && signals.demandScore >= 55 ? 'bullish' : signals.momentumScore >= 45 ? 'neutral' : 'bearish',
    };

    commentary.competitive_summary = {
      title: 'Competitive Summary',
      content: avgScore >= 65
        ? `${name} outperforms peer cohort across demand, supply, and momentum dimensions. Competitive advantage driven by employment diversification and relative affordability versus coastal markets.`
        : avgScore >= 50
        ? `${name} competitive positioning is in-line with peer averages. Differentiation opportunities exist in specific submarkets and asset classes where local dynamics deviate from metro-level trends.`
        : `${name} trails peer group on key competitive metrics. Strategic repositioning or niche targeting required to generate alpha against peer set alternatives.`,
      sentiment: avgScore >= 65 ? 'bullish' : avgScore >= 50 ? 'neutral' : 'bearish',
    };

    commentary.segment_analysis = {
      title: 'Segment Analysis',
      content: signals.supplyScore >= 55
        ? `${name} property landscape shows strongest performance in Class B vintage 2010-2018 segment. Value-add spread to Class A provides 200-350bps upside. Class C properties benefiting from affordability premium.`
        : signals.supplyScore >= 40
        ? `${name} segment dynamics evolving as new Class A deliveries compress rent premiums. Vintage spread between 2015+ and pre-2010 assets widening, creating repositioning opportunities.`
        : `${name} segment performance diverging sharply. New Class A experiencing lease-up pressure while stabilized Class B/C maintaining occupancy. Flight-to-quality premium narrowing.`,
      sentiment: signals.supplyScore >= 55 ? 'bullish' : signals.supplyScore >= 40 ? 'neutral' : 'bearish',
    };

    commentary.owner_strategy = {
      title: 'Owner Strategy Profile',
      content: signals.positionScore >= 55
        ? `Institutional ownership concentration supports market stability. Active repositioning and renovation programs across Class B portfolios indicate medium-term conviction. Development-focused owners expanding pipeline in high-demand nodes.`
        : signals.positionScore >= 40
        ? `Balanced ownership mix between institutional and private operators. Hold periods extending as disposition pricing expectations recalibrate. Select distressed-adjacent opportunities emerging.`
        : `Ownership dynamics shifting as hold period pressures mount. Loan maturity wall creating disposition urgency for leveraged operators. Opportunistic buyers positioning for basis entry points.`,
      sentiment: signals.positionScore >= 55 ? 'bullish' : signals.positionScore >= 40 ? 'neutral' : 'bearish',
    };

    commentary.traffic_demand = {
      title: 'Traffic & Demand Qualification',
      content: signals.demandScore >= 60
        ? `${name} traffic metrics confirm strong demand qualification. Physical tour volumes above seasonal norms with digital lead quality improving. Conversion rates trending 200bps above trailing average.`
        : signals.demandScore >= 45
        ? `${name} traffic patterns showing seasonal normalization. Digital engagement stable with tour-to-lease conversion holding at market average. Walk-in traffic concentrated on weekends.`
        : `${name} traffic indicators softening with declining tour volumes and elongating lease-up timelines. Digital funnel metrics suggest increasing renter price sensitivity.`,
      sentiment: signals.demandScore >= 60 ? 'bullish' : signals.demandScore >= 45 ? 'neutral' : 'bearish',
    };

    return commentary;
  }

  private generateRiskOpportunity(
    name: string,
    entityType: string,
    signals: StrategySignalInputs,
  ) {
    const risks: { label: string; severity: 'high' | 'medium' | 'low'; detail: string }[] = [];
    const opportunities: { label: string; impact: 'high' | 'medium' | 'low'; detail: string }[] = [];

    if (signals.supplyScore < 50) {
      risks.push({
        label: 'Supply Pressure',
        severity: signals.supplyScore < 35 ? 'high' : 'medium',
        detail: 'Elevated pipeline deliveries may compress occupancy and rental rates.',
      });
    }

    if (signals.riskScore < 50) {
      risks.push({
        label: 'Regulatory & Insurance',
        severity: signals.riskScore < 35 ? 'high' : 'medium',
        detail: 'Rising insurance costs and potential regulatory changes increase operating risk.',
      });
    }

    if (signals.momentumScore < 45) {
      risks.push({
        label: 'Growth Deceleration',
        severity: 'medium',
        detail: 'Rent growth trajectory decelerating below sustainable levels.',
      });
    }

    if (risks.length === 0) {
      risks.push({
        label: 'Market Correction',
        severity: 'low',
        detail: 'Standard cyclical risk; fundamentals do not indicate near-term downside.',
      });
    }

    if (signals.demandScore >= 60) {
      opportunities.push({
        label: 'Demand Tailwinds',
        impact: 'high',
        detail: 'Strong population and employment growth supporting long-term rent acceleration.',
      });
    }

    if (signals.supplyScore >= 55) {
      opportunities.push({
        label: 'Supply Constraint Premium',
        impact: 'high',
        detail: 'Limited new supply enables pricing power for existing inventory.',
      });
    }

    if (signals.momentumScore >= 55) {
      opportunities.push({
        label: 'Value-Add Repositioning',
        impact: 'medium',
        detail: 'Vintage spread widening creates Class B-to-A repositioning opportunity.',
      });
    }

    if (opportunities.length === 0) {
      opportunities.push({
        label: 'Selective Entry',
        impact: 'low',
        detail: 'Targeted positioning in highest-performing micro-locations may outperform.',
      });
    }

    return { risks, opportunities };
  }

  private generatePeerContext(
    name: string,
    entityType: string,
    jediScore: number,
  ) {
    const peerSets: Record<string, { name: string; score: number }[]> = {
      msa: [
        { name: 'Raleigh-Durham', score: 84 },
        { name: 'Nashville', score: 81 },
        { name: 'Charlotte', score: 79 },
        { name: 'Tampa', score: 76 },
        { name: 'Austin', score: 73 },
      ],
      submarket: [
        { name: 'Midtown', score: 88 },
        { name: 'Buckhead', score: 84 },
        { name: 'Sandy Springs', score: 81 },
        { name: 'Decatur', score: 78 },
        { name: 'Old Fourth Ward', score: 76 },
      ],
      property: [
        { name: 'The Retreat', score: 86 },
        { name: 'Hanover Midtown', score: 83 },
        { name: 'Alexan Buckhead', score: 80 },
        { name: 'AMLI Ponce Park', score: 77 },
      ],
    };

    const peers = peerSets[entityType] || peerSets.msa;
    const allScores = [...peers.map(p => p.score), jediScore].sort((a, b) => b - a);
    const rank = allScores.indexOf(jediScore) + 1;

    return {
      summary: `${name} ranks #${rank} of ${allScores.length} among tracked ${entityType === 'msa' ? 'metros' : entityType === 'submarket' ? 'submarkets' : 'properties'} in the peer group.`,
      peerRank: rank,
      peerTotal: allScores.length,
      topPeers: peers.slice(0, 5),
    };
  }

  private generateSupplyNarrative(
    name: string,
    signals: StrategySignalInputs,
  ): CommentarySection {
    const supplyHealth = signals.supplyScore;
    const sentiment: 'bullish' | 'neutral' | 'bearish' =
      supplyHealth >= 60 ? 'bullish' : supplyHealth >= 40 ? 'neutral' : 'bearish';

    const content = supplyHealth >= 60
      ? `${name} benefits from a constrained supply environment. Limited pipeline deliveries over the next 18 months provide runway for rent growth without occupancy compression.`
      : supplyHealth >= 40
      ? `${name} faces a moderate supply pipeline with deliveries concentrated in select nodes. Absorption momentum should offset most delivery pressure, though concession risk exists in oversupplied micro-locations.`
      : `${name} is experiencing elevated supply pressure. Pipeline deliveries of new construction may temporarily suppress occupancy and limit rent growth in affected corridors. Selective positioning in supply-protected submarkets is advisable.`;

    return { title: 'Supply Narrative', content, sentiment };
  }

  private deriveSignals(entityType: string, entityId: string): StrategySignalInputs {
    const hash = this.simpleHash(entityId);
    return {
      demandScore: 50 + (hash % 30),
      supplyScore: 40 + ((hash * 7) % 35),
      momentumScore: 45 + ((hash * 13) % 30),
      positionScore: 40 + ((hash * 17) % 35),
      riskScore: 45 + ((hash * 23) % 30),
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private formatEntityName(entityId: string): string {
    return entityId
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private async getCachedCommentary(
    entityType: string,
    entityId: string,
    _userId?: string,
  ): Promise<CommentaryResult | null> {
    try {
      const result = await query(
        `SELECT commentary FROM market_commentary
         WHERE entity_type = $1
           AND entity_id   = $2
           AND cache_expires_at > NOW()
         ORDER BY generated_at DESC
         LIMIT 1`,
        [entityType, entityId],
      );

      if (result.rows.length === 0) return null;

      const data = typeof result.rows[0].commentary === 'string'
        ? JSON.parse(result.rows[0].commentary)
        : result.rows[0].commentary;
      return data as CommentaryResult;
    } catch {
      return null;
    }
  }

  private async cacheCommentary(result: CommentaryResult, _userId?: string): Promise<void> {
    try {
      await query(
        `INSERT INTO market_commentary
           (entity_type, entity_id, tab_context, commentary, cache_expires_at)
         VALUES ($1, $2, 'commentary', $3, NOW() + INTERVAL '${CACHE_TTL_HOURS} hours')
         ON CONFLICT (entity_type, entity_id, tab_context)
         DO UPDATE SET commentary     = EXCLUDED.commentary,
                       cache_expires_at = EXCLUDED.cache_expires_at`,
        [
          result.entityType,
          result.entityId,
          JSON.stringify(result),
        ],
      );
    } catch (err) {
      logger.warn('Commentary Agent: failed to cache result in market_commentary', { error: err });
    }

    if (
      result.entityType === 'msa' ||
      result.entityType === 'submarket' ||
      result.entityType === 'property'
    ) {
      await recordSentimentSnapshot({
        entityType: result.entityType,
        entityId: result.entityId,
        agentScore: labelToScore(result.marketNarrative.sentiment),
        source: 'agent_run',
      });
    }
  }
}
