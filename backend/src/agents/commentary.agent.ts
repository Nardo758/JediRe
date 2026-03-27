import { v4 as uuidv4 } from 'uuid';
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

export interface CommentaryInput {
  entityType: 'msa' | 'submarket' | 'property';
  entityId: string;
  entityName?: string;
  signals?: StrategySignalInputs;
  forceRefresh?: boolean;
  userId?: string;
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
      const cached = await this.getCachedCommentary(input.entityType, input.entityId);
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

    await this.cacheCommentary(result);

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
  ): Promise<CommentarySection> {
    const context: AICallContext = {
      userId: userId || 'system',
      stripeCustomerId: '',
      agentId: 'commentary',
      operationType: 'commentary_generation',
      surface: 'web',
      dealId: undefined,
    };

    const systemPrompt = `You are a senior multifamily real estate analyst writing institutional-grade market commentary for a Bloomberg Terminal-style platform called JediRE. Write in a professional, data-driven tone. Be concise and specific. Output only the narrative text, no headers or formatting.`;

    const levelLabel = entityType === 'msa' ? 'metro' : entityType === 'submarket' ? 'submarket' : 'property';
    const recommended = STRATEGY_LABELS[arb.recommended];

    const userMessage = `Write a 2-3 sentence market narrative for ${name} (${levelLabel} level).

Signal scores (0-100): Demand=${signals.demandScore}, Supply=${signals.supplyScore}, Momentum=${signals.momentumScore}, Position=${signals.positionScore}, Risk=${signals.riskScore}
JEDI Composite Score: ${jediScore}
Recommended Strategy: ${recommended} (score: ${arb.recommendedScore.toFixed(0)})
Arbitrage Flag: ${arb.arbitrageFlag ? `Yes, ${arb.arbitrageDelta.toFixed(0)}pt spread` : 'No'}
Strategy Rankings: ${arb.strategies.map(s => `${s.label}: ${s.score.toFixed(0)}`).join(', ')}

Focus on demand dynamics, supply pipeline impact, and investment positioning. Reference specific signal strengths/weaknesses.`;

    const response = await jediAI.generate(
      context,
      systemPrompt,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 256, temperature: 0.3 },
    );

    const content = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('');

    const sentiment: 'bullish' | 'neutral' | 'bearish' =
      signals.demandScore >= 60 && signals.momentumScore >= 55 ? 'bullish' :
      signals.demandScore < 45 || signals.momentumScore < 40 ? 'bearish' : 'neutral';

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
  ): Promise<CommentaryResult | null> {
    try {
      const result = await query(
        `SELECT output_data, created_at FROM agent_tasks
         WHERE task_type = 'commentary_generation'
           AND input_data->>'entityType' = $1
           AND input_data->>'entityId' = $2
           AND status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 1`,
        [entityType, entityId],
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const ageHours = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);

      if (ageHours > CACHE_TTL_HOURS) return null;

      const data = typeof row.output_data === 'string'
        ? JSON.parse(row.output_data)
        : row.output_data;
      return data as CommentaryResult;
    } catch {
      return null;
    }
  }

  private async cacheCommentary(result: CommentaryResult): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_tasks (
          task_type, input_data, output_data, status, user_id, progress, completed_at
        ) VALUES (
          'commentary_generation',
          $1, $2, 'completed', 'system', 100, NOW()
        )`,
        [
          JSON.stringify({
            entityType: result.entityType,
            entityId: result.entityId,
            entityName: result.entityName,
          }),
          JSON.stringify(result),
        ],
      );
    } catch (err) {
      logger.warn('Commentary Agent: failed to cache result', { error: err });
    }
  }
}
