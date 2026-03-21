/**
 * M28 Cycle Intelligence Service
 * Core service for market cycle data, predictions, and pattern matching
 */

import { getPool } from '../database/connection';
import {
  CycleSnapshot,
  RateEnvironment,
  LeadingIndicator,
  HistoricalEvent,
  PatternMatch,
  MarketMetricsHistory,
  DealPerformanceByPhase,
  DivergenceResult,
  ValueForecast,
  PhaseOptimalStrategy,
  MacroRiskScore,
  ConstructionCostIndex,
  RentGrowthForecast,
  CapRateForecast,
  FullChainPrediction,
} from '../types/m28.types';

const pool = getPool();

export class CycleIntelligenceService {
  private safeFloat(val: any, fallback: number = 0): number {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }

  private parseSnapshot(row: any): CycleSnapshot {
    return {
      ...row,
      lag_position: this.safeFloat(row.lag_position),
      lead_position: this.safeFloat(row.lead_position),
      divergence: this.safeFloat(row.divergence),
      confidence: this.safeFloat(row.confidence),
    };
  }

  async getCyclePhase(marketId: string): Promise<CycleSnapshot | null> {
    const result = await pool.query(
      `SELECT * FROM m28_cycle_snapshots 
       WHERE market_id = $1 
       ORDER BY snapshot_date DESC 
       LIMIT 1`,
      [marketId]
    );
    
    return result.rows[0] ? this.parseSnapshot(result.rows[0]) : null;
  }

  /**
   * Get cycle phases for multiple markets
   */
  async getCyclePhases(marketIds: string[]): Promise<CycleSnapshot[]> {
    if (marketIds.length === 0) return [];
    
    const result = await pool.query(
      `SELECT DISTINCT ON (market_id) *
       FROM m28_cycle_snapshots 
       WHERE market_id = ANY($1)
       ORDER BY market_id, snapshot_date DESC`,
      [marketIds]
    );
    
    return result.rows.map(row => this.parseSnapshot(row));
  }

  /**
   * Get leading-lagging divergence for a market
   */
  async getDivergence(marketId: string): Promise<DivergenceResult | null> {
    const snapshot = await this.getCyclePhase(marketId);
    if (!snapshot) return null;

    const signal = 
      snapshot.divergence > 5 ? 'ACQUIRE' :
      snapshot.divergence < -5 ? 'EXIT' :
      'HOLD';

    const narrative = this.generateDivergenceNarrative(snapshot);

    return {
      market_id: marketId,
      current_date: snapshot.snapshot_date,
      divergence: snapshot.divergence,
      signal,
      lag_phase: snapshot.lag_phase,
      lead_phase: snapshot.lead_phase,
      confidence: snapshot.confidence,
      narrative,
    };
  }

  /**
   * Get current rate environment
   */
  async getRateEnvironment(): Promise<RateEnvironment | null> {
    const result = await pool.query(
      `SELECT * FROM m28_rate_environment 
       ORDER BY snapshot_date DESC 
       LIMIT 1`
    );
    
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...row,
      ffr: this.safeFloat(row.ffr),
      t10y: this.safeFloat(row.t10y),
      t30y_mtg: this.safeFloat(row.t30y_mtg),
      m2_yoy: this.safeFloat(row.m2_yoy),
    };
  }

  /**
   * Get rate environment history
   */
  async getRateHistory(days: number = 90): Promise<RateEnvironment[]> {
    const result = await pool.query(
      `SELECT * FROM m28_rate_environment 
       WHERE snapshot_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY snapshot_date DESC`
    );
    
    return result.rows;
  }

  /**
   * Get leading indicators (optionally filtered by category)
   */
  async getLeadingIndicators(category?: string): Promise<LeadingIndicator[]> {
    let query = `
      SELECT * FROM m28_leading_indicators 
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM m28_leading_indicators)
    `;
    const params: any[] = [];
    
    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }
    
    query += ` ORDER BY category, indicator_name`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get pattern matches (current conditions vs historical events)
   */
  async getPatternMatches(limit: number = 5): Promise<PatternMatch[]> {
    const result = await pool.query(
      `SELECT pm.*, he.*
       FROM m28_pattern_matches pm
       JOIN m28_historical_events he ON pm.event_id = he.id
       WHERE pm.computed_date = (
         SELECT MAX(computed_date) FROM m28_pattern_matches
       )
       ORDER BY pm.similarity_pct DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows.map(row => ({
      computed_date: row.computed_date,
      event_id: row.event_id,
      event: {
        id: row.id,
        name: row.name,
        category: row.category,
        origin: row.origin,
        date_start: row.date_start,
        date_end: row.date_end,
        severity: row.severity,
        tags: row.tags,
        trigger_desc: row.trigger_desc,
        economic_effects: row.economic_effects,
        fed_reaction: row.fed_reaction,
        re_impact: row.re_impact,
        fl_specific: row.fl_specific,
      },
      similarity_pct: row.similarity_pct,
      match_factors: row.match_factors,
      diverge_factors: row.diverge_factors,
      predicted_re_impact: row.predicted_re_impact,
      confidence: parseFloat(row.confidence),
    }));
  }

  /**
   * Get historical event by ID
   */
  async getHistoricalEvent(eventId: string): Promise<HistoricalEvent | null> {
    const result = await pool.query(
      `SELECT * FROM m28_historical_events WHERE id = $1`,
      [eventId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Get market metrics history for a market
   */
  async getMarketMetricsHistory(
    marketId: string, 
    quarters: number = 8
  ): Promise<MarketMetricsHistory[]> {
    const result = await pool.query(
      `SELECT * FROM m28_market_metrics_history 
       WHERE market_id = $1 
       ORDER BY quarter DESC 
       LIMIT $2`,
      [marketId, quarters]
    );
    
    return result.rows;
  }

  /**
   * Get deal performance by acquisition phase
   */
  async getDealPerformanceByPhase(
    marketId: string
  ): Promise<DealPerformanceByPhase[]> {
    const result = await pool.query(
      `SELECT * FROM m28_deal_performance_by_phase 
       WHERE market_id = $1 
       ORDER BY phase`,
      [marketId]
    );
    
    return result.rows;
  }

  /**
   * Get phase-optimal strategy for current market conditions
   */
  async getPhaseOptimalStrategy(
    marketId: string
  ): Promise<PhaseOptimalStrategy | null> {
    const snapshot = await this.getCyclePhase(marketId);
    if (!snapshot) return null;

    const performance = await pool.query(
      `SELECT * FROM m28_deal_performance_by_phase 
       WHERE market_id = $1 AND phase = $2`,
      [marketId, snapshot.lag_phase]
    );

    if (performance.rows.length === 0) return null;

    const data = performance.rows[0];
    const strategies = data.strategy_performance || {};
    const alternatives = Object.entries(strategies)
      .map(([strategy, perf]: [string, any]) => ({
        strategy,
        irr: perf.irr,
        em: perf.em,
        rank: 0,
      }))
      .sort((a, b) => b.irr - a.irr)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return {
      market_id: marketId,
      current_phase: snapshot.lag_phase,
      best_strategy: data.best_strategy,
      expected_irr: this.safeFloat(data.avg_irr),
      expected_em: this.safeFloat(data.avg_em),
      expected_hold: this.safeFloat(data.avg_hold),
      confidence: snapshot.confidence,
      historical_sample_size: parseInt(data.deal_count) || 0,
      alternatives,
    };
  }

  /**
   * Get construction cost index (with tariff overlay)
   */
  async getConstructionCostIndex(
    marketId: string
  ): Promise<ConstructionCostIndex> {
    // TODO: Implement actual construction cost tracking
    // For now, return mock data structure
    return {
      market_id: marketId,
      base_index: 285.7,
      tariff_premium_pct: 11.2,
      yoy_change: 5.8,
      forecast_12mo: 3.5,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get M2-derived value forecast
   */
  async getValueForecast(
    marketId: string,
    horizonMonths: number = 12
  ): Promise<ValueForecast> {
    const rateEnv = await this.getRateEnvironment();
    
    // M2 → Values transmission (Chain C6)
    // 10% M2 growth → +12-18% RE value increase (12-18mo lag)
    const m2Growth = rateEnv?.m2_yoy || 3.6;
    const baseValueChange = m2Growth * 1.5; // Conservative multiplier
    
    return {
      market_id: marketId,
      horizon_months: horizonMonths,
      bull_12mo: baseValueChange * 1.5,
      base_12mo: baseValueChange,
      bear_12mo: baseValueChange * 0.5,
      confidence: 0.78,
      method: 'M2-derived',
      as_of_date: new Date().toISOString(),
    };
  }

  /**
   * Get macro risk score
   */
  async getMacroRiskScore(): Promise<MacroRiskScore> {
    // TODO: Implement actual risk scoring
    // Components: geopolitical, trade policy, consumer confidence, banking stress
    
    const score = 45; // 0-100
    const level = 
      score < 25 ? 'low' :
      score < 50 ? 'medium' :
      score < 75 ? 'high' : 'extreme';

    return {
      score,
      components: {
        geopolitical_risk: 40,
        trade_policy_uncertainty: 55,
        consumer_confidence: 42,
        banking_stress: 35,
      },
      level,
      narrative: 'Moderate macro risk. Trade policy uncertainty elevated due to tariffs, but banking system stable and consumer confidence holding.',
      as_of_date: new Date().toISOString(),
    };
  }

  /**
   * Predict rent growth using multiple transmission chains
   */
  async predictRentGrowth(
    marketId: string,
    horizonMonths: number = 12
  ): Promise<RentGrowthForecast> {
    const snapshot = await this.getCyclePhase(marketId);
    const leadingIndicators = await this.getLeadingIndicators('supply');
    
    // Chain C7: Permit decline → Supply trough → Rent acceleration
    const permitsIndicator = leadingIndicators.find(i => 
      i.indicator_name.includes('Permit')
    );
    
    // Base rent growth by phase
    const baseByPhase: Record<string, number> = {
      recovery: 4.5,
      expansion: 6.0,
      hypersupply: 2.5,
      recession: 1.0,
    };
    
    const baseline = snapshot ? baseByPhase[snapshot.lag_phase] || 4.0 : 4.0;
    
    return {
      market_id: marketId,
      horizon_months: horizonMonths,
      baseline,
      bull: baseline * 1.25,
      bear: baseline * 0.75,
      confidence: 0.80,
      contributing_factors: [
        { factor: 'Cycle Phase', impact: baseline, weight: 0.40 },
        { factor: 'Supply Pipeline', impact: -0.5, weight: 0.30 },
        { factor: 'Migration', impact: 0.8, weight: 0.30 },
      ],
      as_of_date: new Date().toISOString(),
    };
  }

  /**
   * Predict cap rate movement
   */
  async predictCapRateMovement(
    marketId: string,
    horizonMonths: number = 12
  ): Promise<CapRateForecast> {
    const rateEnv = await this.getRateEnvironment();
    const metrics = await this.getMarketMetricsHistory(marketId, 1);
    
    const currentCap = metrics[0]?.cap_rate || 5.25;
    
    // Chain C4: Mortgage rate → Cap rate (30-50bps per 100bps mortgage)
    // If forward curve predicts -100bps mortgage decline → -30-50bps cap compression
    const forwardMortgageChange = -68; // bps (example)
    const capChangeBps = Math.round(forwardMortgageChange * 0.40);
    
    const direction = 
      capChangeBps < -10 ? 'compression' :
      capChangeBps > 10 ? 'expansion' : 'stable';
    
    return {
      market_id: marketId,
      horizon_months: horizonMonths,
      current_cap: currentCap,
      predicted_cap: currentCap + (capChangeBps / 100),
      change_bps: capChangeBps,
      direction,
      confidence: 0.75,
      drivers: [
        'Mortgage rates declining on Fed cuts',
        'Transaction volume picking up',
        'Capital allocation shifting to RE',
      ],
      as_of_date: new Date().toISOString(),
    };
  }

  /**
   * Full chain prediction: Fed cut → Value change
   */
  async predictFullChain(
    marketId: string,
    ffrChangeBps: number = -100
  ): Promise<FullChainPrediction> {
    // Chain C1: FFR → Mortgage (70% pass-through)
    const mortgageChangeBps = Math.round(ffrChangeBps * 0.70);
    
    // Chain C2: Mortgage → Purchasing power (12% per 100bps)
    const purchasingPowerChangePct = (mortgageChangeBps / 100) * 12;
    
    // Chain C3: Mortgage → Transaction volume (20-25% per 100bps)
    const txnVolumeChangePct = (mortgageChangeBps / 100) * -22;
    
    // Chain C4: Mortgage → Cap rate (40bps per 100bps mortgage)
    const capChangeBps = Math.round(mortgageChangeBps * 0.40);
    
    // Chain C5: Cap change → Value change
    const valueChangePct = (capChangeBps / 50) * -17; // -17% per 50bps compression
    
    return {
      market_id: marketId,
      scenario: {
        name: `${ffrChangeBps}bps Fed Funds Rate Change`,
        ffr_change_bps: ffrChangeBps,
        timeline: '6-12 months',
      },
      predictions: {
        mortgage_change_bps: mortgageChangeBps,
        purchasing_power_change_pct: purchasingPowerChangePct,
        txn_volume_change_pct: txnVolumeChangePct,
        cap_change_bps: capChangeBps,
        value_change_pct: valueChangePct,
      },
      confidence: 0.78,
      as_of_date: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════

  private generateDivergenceNarrative(snapshot: CycleSnapshot): string {
    if (snapshot.divergence > 5) {
      return `Leading indicators are +${snapshot.divergence.toFixed(1)} ahead of lagging data. Acquisition window OPEN. Historical pattern: this gap closes in 6-12 months.`;
    } else if (snapshot.divergence < -5) {
      return `Lagging data is ahead of leading indicators by ${Math.abs(snapshot.divergence).toFixed(1)} points. Exit window approaching. Market looks strong but leading says it's turning.`;
    } else {
      return `Leading and lagging indicators aligned (divergence: ${snapshot.divergence.toFixed(1)}). Market in equilibrium. HOLD position and monitor for divergence.`;
    }
  }
}

// Export singleton instance
export const cycleIntelligenceService = new CycleIntelligenceService();
