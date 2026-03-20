import { query, getPool } from '../database/connection';
import { logger } from '../utils/logger';

export interface StrategyGate {
  metric: string;
  operator?: string;
  value?: any;
  threshold?: number;
  hard: boolean;
}

export interface GateEvalResult {
  result: 'PASS' | 'FAIL' | 'N/A';
  failures: string[];
  softPenalties: number;
}

export interface StrategyScore {
  strategy_id: string;
  strategy_name: string;
  overall_score: number;
  sub_scores: Record<string, number>;
  gate_result: 'PASS' | 'FAIL' | 'N/A';
  gate_failures: string[];
  soft_penalty: number;
  confidence: number;
}

export interface ArbitrageResult {
  winning_strategy_id: string | null;
  winning_strategy_name: string | null;
  runner_up_strategy_id: string | null;
  runner_up_strategy_name: string | null;
  winning_score: number;
  runner_up_score: number;
  delta: number;
  arbitrage_detected: boolean;
}

function extractDealSignals(deal: any): Record<string, number> {
  const data = deal.deal_data || {};
  const scores = deal.scores || data.scores || {};

  return {
    supply_pressure: Math.min(1, (scores.supply ?? 0) / 100),
    demand_growth: Math.min(1, (scores.demand ?? 0) / 100),
    rent_momentum: Math.min(1, (scores.momentum ?? 0) / 100),
    job_growth: Math.min(1, (scores.demand ?? 0) / 100),
    cap_rate_spread: Math.min(1, (scores.position ?? 0) / 100),
    irr_potential: Math.min(1, (deal.irr_pct ?? 0) / 30),
    risk_score: Math.min(1, (scores.risk ?? 0) / 100),
    regulatory_risk: Math.min(1, (scores.risk ?? 50) / 100),
    market_volatility: Math.min(1, (scores.supply ?? 50) / 100),
    project_type: deal.project_type || 'existing',
  };
}

export function evaluateGates(gates: StrategyGate[], dealSignals: Record<string, any>): GateEvalResult {
  const failures: string[] = [];
  let softPenalties = 0;
  let isNA = false;

  for (const gate of gates) {
    const value = dealSignals[gate.metric];
    let failed = false;

    if (gate.operator === 'in') {
      if (!Array.isArray(gate.value)) continue;
      if (!gate.value.includes(value)) {
        failed = true;
      }
    } else if (gate.threshold !== undefined) {
      const numVal = typeof value === 'number' ? value : 0;
      if (numVal >= gate.threshold) {
        failed = true;
      }
    }

    if (failed) {
      if (gate.hard) {
        if (gate.operator === 'in') {
          isNA = true;
        } else {
          failures.push(`${gate.metric} exceeds threshold ${gate.threshold}`);
        }
      } else {
        softPenalties += 5;
        failures.push(`soft: ${gate.metric}`);
      }
    }
  }

  if (isNA) return { result: 'N/A', failures, softPenalties };
  if (failures.some(f => !f.startsWith('soft:'))) return { result: 'FAIL', failures, softPenalties };
  return { result: 'PASS', failures, softPenalties };
}

export function calculateStrategyScore(
  deal: any,
  strategy: any
): StrategyScore {
  const dealSignals = extractDealSignals(deal);
  const weights: Record<string, number> = strategy.signal_weights || {};
  const propertyGates: StrategyGate[] = strategy.property_gates || [];
  const riskGates: StrategyGate[] = strategy.risk_gates || [];

  const gateResult = evaluateGates([...propertyGates, ...riskGates], dealSignals);

  if (gateResult.result === 'N/A') {
    return {
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      overall_score: 0,
      sub_scores: {},
      gate_result: 'N/A',
      gate_failures: gateResult.failures,
      soft_penalty: 0,
      confidence: 0,
    };
  }

  const subScores: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [signal, weight] of Object.entries(weights)) {
    const w = Number(weight);
    if (signal === 'risk_score') {
      const riskVal = dealSignals[signal] ?? 0.5;
      subScores[signal] = (1 - riskVal) * 100;
      weightedSum += subScores[signal] * Math.abs(w);
    } else {
      const val = typeof dealSignals[signal] === 'number' ? dealSignals[signal] : 0.5;
      subScores[signal] = val * 100;
      weightedSum += subScores[signal] * w;
    }
    totalWeight += Math.abs(w);
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
  const penalizedScore = Math.max(0, rawScore - gateResult.softPenalties);
  const confidence = Math.min(100, rawScore * 0.8 + 20);

  return {
    strategy_id: strategy.id,
    strategy_name: strategy.name,
    overall_score: Math.round(penalizedScore * 100) / 100,
    sub_scores: subScores,
    gate_result: gateResult.result,
    gate_failures: gateResult.failures,
    soft_penalty: gateResult.softPenalties,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export function detectArbitrage(scores: StrategyScore[]): ArbitrageResult {
  const eligible = scores
    .filter(s => s.gate_result !== 'N/A')
    .sort((a, b) => b.overall_score - a.overall_score);

  if (eligible.length === 0) {
    return {
      winning_strategy_id: null,
      winning_strategy_name: null,
      runner_up_strategy_id: null,
      runner_up_strategy_name: null,
      winning_score: 0,
      runner_up_score: 0,
      delta: 0,
      arbitrage_detected: false,
    };
  }

  const winner = eligible[0];
  const runnerUp = eligible[1] || null;
  const delta = runnerUp ? winner.overall_score - runnerUp.overall_score : 0;
  const arbitrageDetected = delta > 15 && winner.overall_score > 70;

  return {
    winning_strategy_id: winner.strategy_id,
    winning_strategy_name: winner.strategy_name,
    runner_up_strategy_id: runnerUp?.strategy_id || null,
    runner_up_strategy_name: runnerUp?.strategy_name || null,
    winning_score: winner.overall_score,
    runner_up_score: runnerUp?.overall_score || 0,
    delta: Math.round(delta * 100) / 100,
    arbitrage_detected: arbitrageDetected,
  };
}

export async function scoreAndPersist(dealId: string): Promise<StrategyScore[]> {
  try {
    const pool = getPool();

    const [dealRes, strategiesRes] = await Promise.all([
      pool.query(
        `SELECT d.*, ds.irr_pct, ds.coc_year_5, ds.npv
         FROM deals d
         LEFT JOIN deal_scenarios ds ON ds.deal_id = d.id
         WHERE d.id = $1 LIMIT 1`,
        [dealId]
      ),
      pool.query(
        `SELECT * FROM strategies WHERE is_active = true ORDER BY sort_order`,
      ),
    ]);

    if (dealRes.rows.length === 0) throw new Error('Deal not found');
    const deal = dealRes.rows[0];
    const strategies = strategiesRes.rows;

    const scores = strategies.map(s => calculateStrategyScore(deal, s));

    for (const score of scores) {
      await query(
        `INSERT INTO strategy_scores (deal_id, strategy_id, overall_score, sub_scores, gate_result, gate_failures, soft_penalty, confidence, calculated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (deal_id, strategy_id) DO UPDATE SET
           overall_score = EXCLUDED.overall_score,
           sub_scores = EXCLUDED.sub_scores,
           gate_result = EXCLUDED.gate_result,
           gate_failures = EXCLUDED.gate_failures,
           soft_penalty = EXCLUDED.soft_penalty,
           confidence = EXCLUDED.confidence,
           calculated_at = NOW()`,
        [
          dealId, score.strategy_id, score.overall_score,
          JSON.stringify(score.sub_scores), score.gate_result,
          JSON.stringify(score.gate_failures), score.soft_penalty, score.confidence,
        ]
      );
    }

    const arbitrage = detectArbitrage(scores);
    await query(
      `INSERT INTO strategy_arbitrage (deal_id, winning_strategy_id, runner_up_strategy_id, winning_score, runner_up_score, delta, arbitrage_detected, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         winning_strategy_id = EXCLUDED.winning_strategy_id,
         runner_up_strategy_id = EXCLUDED.runner_up_strategy_id,
         winning_score = EXCLUDED.winning_score,
         runner_up_score = EXCLUDED.runner_up_score,
         delta = EXCLUDED.delta,
         arbitrage_detected = EXCLUDED.arbitrage_detected,
         calculated_at = NOW()`,
      [
        dealId,
        arbitrage.winning_strategy_id,
        arbitrage.runner_up_strategy_id,
        arbitrage.winning_score,
        arbitrage.runner_up_score,
        arbitrage.delta,
        arbitrage.arbitrage_detected,
      ]
    );

    logger.info(`[M08] Scored deal ${dealId}: winner=${arbitrage.winning_strategy_name} (${arbitrage.winning_score}), arbitrage=${arbitrage.arbitrage_detected}`);
    return scores;
  } catch (error) {
    logger.error('[M08] Error scoring deal:', error);
    throw error;
  }
}
