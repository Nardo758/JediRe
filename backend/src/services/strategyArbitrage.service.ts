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

  // ── Platform-computed metrics (preferred over deal.scores fallbacks) ──
  // demand_strength_score / demand_score from deal_market_data (0-100)
  const platformDemand: number | null =
    deal.platform_demand_strength ?? deal.platform_demand_score ?? null;

  // supply_balance_score from market_research_metrics (0-100; high = well-balanced)
  // Invert to supply_pressure: high supply balance → low pressure → 0
  const platformSupplyBalance: number | null = deal.platform_supply_balance ?? null;
  const platformSupplyPressure: number | null =
    platformSupplyBalance != null ? 1 - Math.min(1, platformSupplyBalance / 100) : null;

  // rent_growth_trailing_12mo from deal_market_data (percent, e.g. 3.5 = 3.5%)
  // Normalize: 0% → 0, 10% → 1.0
  const platformRentGrowth: number | null =
    deal.platform_rent_growth != null
      ? Math.min(1, Math.max(0, Number(deal.platform_rent_growth) / 10))
      : null;

  // overall_opportunity_score from market_research_metrics (0-100)
  const platformOpportunity: number | null =
    deal.platform_opportunity_score != null
      ? Math.min(1, Number(deal.platform_opportunity_score) / 100)
      : null;

  return {
    supply_pressure:
      platformSupplyPressure ?? Math.min(1, (scores.supply ?? 0) / 100),
    demand_growth:
      platformDemand != null
        ? Math.min(1, platformDemand / 100)
        : Math.min(1, (scores.demand ?? 0) / 100),
    rent_momentum:
      platformRentGrowth ?? Math.min(1, (scores.momentum ?? 0) / 100),
    job_growth:
      platformDemand != null
        ? Math.min(1, platformDemand / 100)
        : Math.min(1, (scores.demand ?? 0) / 100),
    cap_rate_spread:
      platformOpportunity ?? Math.min(1, (scores.position ?? 0) / 100),
    irr_potential: Math.min(1, (deal.irr_pct ?? 0) / 30),
    risk_score: Math.min(1, (scores.risk ?? 0) / 100),
    regulatory_risk: Math.min(1, (scores.risk ?? 50) / 100),
    market_volatility:
      platformSupplyPressure ?? Math.min(1, (scores.supply ?? 50) / 100),
    project_type: deal.project_type || 'existing',
  };
}

function evalGateCondition(gate: StrategyGate, rawValue: any): boolean {
  const operator = gate.operator || 'threshold';

  if (operator === 'in') {
    if (!Array.isArray(gate.value)) return false;
    return !gate.value.includes(rawValue);
  }
  if (operator === 'nin') {
    if (!Array.isArray(gate.value)) return false;
    return gate.value.includes(rawValue);
  }

  // Numeric comparisons
  const num = typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0;
  const threshold = gate.threshold ?? (typeof gate.value === 'number' ? gate.value : 0);

  switch (operator) {
    case 'lt':       return !(num < threshold);
    case 'lte':      return !(num <= threshold);
    case 'gt':       return !(num > threshold);
    case 'gte':      return !(num >= threshold);
    case 'eq':       return num !== threshold;
    case 'neq':      return num === threshold;
    case 'threshold':
    default:         return num >= threshold; // value must be below threshold to PASS
  }
}

export function evaluateGates(gates: StrategyGate[], dealSignals: Record<string, any>): GateEvalResult {
  const failures: string[] = [];
  let softPenalties = 0;
  let isNA = false;

  for (const gate of gates) {
    const value = dealSignals[gate.metric];
    const failed = evalGateCondition(gate, value);

    if (failed) {
      if (gate.hard) {
        isNA = true;
        failures.push(`hard: ${gate.metric} failed (operator=${gate.operator || 'threshold'}, value=${value})`);
      } else {
        softPenalties += 5;
        failures.push(`soft: ${gate.metric}`);
      }
    }
  }

  if (isNA) return { result: 'N/A', failures, softPenalties };
  return { result: 'PASS', failures, softPenalties };
}

export function calculateStrategyScore(
  deal: any,
  strategy: any
): StrategyScore {
  const dealSignals = extractDealSignals(deal);

  // Product-type override: strategy.execution_profile.product_type_overrides
  // maps product_type → { signal: multiplier } and is applied to base weights
  const execProfile = strategy.execution_profile || {};
  const productTypeOverrides: Record<string, Record<string, number>> = execProfile.product_type_overrides || {};
  const dealProductType: string = deal.project_type || (deal.deal_data || {}).product_type || '';
  const overrideMultipliers: Record<string, number> = productTypeOverrides[dealProductType] || {};

  const baseWeights: Record<string, number> = strategy.signal_weights || {};
  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseWeights)) {
    weights[k] = v * (overrideMultipliers[k] ?? 1);
  }

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

  // F23: data coverage — ratio of positive-weight signals with real (non-fallback) data
  const positiveWeightSignals = Object.entries(weights).filter(([, w]) => Number(w) > 0);
  const coveredSignals = positiveWeightSignals.filter(([k]) =>
    dealSignals[k] !== undefined && dealSignals[k] !== null && dealSignals[k] !== 0.5
  ).length;
  const dataCoverage = positiveWeightSignals.length > 0 ? coveredSignals / positiveWeightSignals.length : 0;
  // F24: confidence = data_coverage × (1 − soft_penalty_fraction), expressed 0–100
  const softPenaltyFraction = Math.min(1, gateResult.softPenalties / 100);
  const confidence = Math.min(100, Math.max(0, dataCoverage * 100 * (1 - softPenaltyFraction)));

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

export interface ScoreContext {
  userId: string;
  orgId: string | null;
}

export async function scoreAndPersist(dealId: string, ctx?: ScoreContext): Promise<StrategyScore[]> {
  try {
    const pool = getPool();

    const dealRes = await pool.query(
      `SELECT d.*,
              ds.irr_pct, ds.coc_year_5, ds.npv,
              dmd.demand_score           AS platform_demand_score,
              dmd.rent_growth_trailing_12mo AS platform_rent_growth,
              dmd.rent_growth_forecast_12mo AS platform_rent_growth_forecast,
              dmd.submarket_occupancy    AS platform_occupancy,
              dmd.pipeline_units         AS platform_pipeline_units,
              mrm.demand_strength_score  AS platform_demand_strength,
              mrm.supply_balance_score   AS platform_supply_balance,
              mrm.overall_opportunity_score AS platform_opportunity_score
       FROM deals d
       LEFT JOIN deal_scenarios ds ON ds.deal_id = d.id
       LEFT JOIN deal_market_data dmd ON dmd.deal_id = d.id
       LEFT JOIN market_research_metrics mrm ON mrm.deal_id = d.id
       WHERE d.id = $1 LIMIT 1`,
      [dealId]
    );

    // Scope strategies: system templates always visible; custom strategies scoped to caller's org/user
    let strategiesRes;
    if (ctx?.userId) {
      strategiesRes = await pool.query(
        `SELECT * FROM strategies
         WHERE is_active = true
           AND (is_system_template = true OR created_by = $1 OR ($2::uuid IS NOT NULL AND org_id = $2))
         ORDER BY sort_order`,
        [ctx.userId, ctx.orgId]
      );
    } else {
      // Fallback: system templates only (safe default for internal/background calls)
      strategiesRes = await pool.query(
        `SELECT * FROM strategies WHERE is_active = true AND is_system_template = true ORDER BY sort_order`
      );
    }

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
