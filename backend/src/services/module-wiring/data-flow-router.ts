/**
 * Data Flow Router
 *
 * Implements the cross-module data flow matrix from the Module Wiring Blueprint (Sheet 3).
 * Routes data between modules based on defined connections, handling both required and
 * optional data flows. Provides caching, validation, and data transformation.
 */

import { ModuleId, MODULE_REGISTRY, ModuleDependency } from './module-registry';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

// ============================================================================
// Types
// ============================================================================

export type DataFlowStrength = 'required' | 'optional';

export interface DataFlowConnection {
  from: ModuleId;
  to: ModuleId;
  dataKeys: string[];
  strength: DataFlowStrength;
  description: string;
}

export interface ModuleDataPacket {
  moduleId: ModuleId;
  dealId: string;
  data: Record<string, any>;
  timestamp: Date;
  version: number;
}

export interface DataFlowResult {
  moduleId: ModuleId;
  requiredInputs: Record<string, any>;
  optionalInputs: Record<string, any>;
  missingRequired: string[];
  missingOptional: string[];
  ready: boolean;
}

// ============================================================================
// Data Flow Matrix (from Blueprint Sheet 3)
// ============================================================================

const DATA_FLOW_CONNECTIONS: DataFlowConnection[] = [
  // M02 Zoning outputs
  { from: 'M02', to: 'M03', dataKeys: ['zoning_code', 'far', 'setbacks', 'max_density'], strength: 'required', description: 'Zoning constraints for development capacity' },
  { from: 'M02', to: 'M08', dataKeys: ['entitlement_risk_score', 'development_path', 'selected_envelope', 'max_units_by_path', 'entitlement_timeline_months'], strength: 'optional', description: 'Zoning path + envelope constraints per strategy' },
  { from: 'M02', to: 'M09', dataKeys: ['zoning_code', 'far', 'development_path', 'selected_envelope'], strength: 'optional', description: 'Zoning-adjusted proforma assumptions + path envelope' },
  { from: 'M02', to: 'M11', dataKeys: ['development_path', 'selected_envelope', 'entitlement_timeline_months'], strength: 'optional', description: 'Path selection for capital structure timeline' },
  { from: 'M02', to: 'M14', dataKeys: ['entitlement_risk_score', 'development_path', 'entitlement_timeline_months'], strength: 'optional', description: 'Regulatory risk factors + path risk' },
  { from: 'M02', to: 'M18', dataKeys: ['auto_milestones', 'entitlement_type', 'required_hearings'], strength: 'optional', description: 'Auto-milestones from path selection → Context Tracker' },
  { from: 'M18', to: 'M02', dataKeys: ['entitlement_progress_pct', 'entitlement_status'], strength: 'optional', description: 'Entitlement progress → Zoning module' },

  // M03 Dev Capacity outputs
  { from: 'M03', to: 'M08', dataKeys: ['max_units_by_right', 'envelope_dimensions'], strength: 'required', description: 'Max buildable for strategy feasibility' },
  { from: 'M03', to: 'M09', dataKeys: ['max_units_by_right', 'envelope_dimensions'], strength: 'optional', description: 'Development cost estimates' },
  { from: 'M03', to: 'M14', dataKeys: ['ten_year_supply_gap'], strength: 'optional', description: 'Development risk' },

  // M04 Supply outputs
  { from: 'M04', to: 'M03', dataKeys: ['pipeline_units_by_status'], strength: 'optional', description: 'Pipeline context for gap analysis' },
  { from: 'M04', to: 'M05', dataKeys: ['supply_pressure_score', 'absorption_rate'], strength: 'required', description: 'Supply pressure and absorption' },
  { from: 'M04', to: 'M08', dataKeys: ['supply_pressure_score', 'pipeline_units_by_status'], strength: 'required', description: 'Supply signals per strategy' },
  { from: 'M04', to: 'M09', dataKeys: ['months_of_supply'], strength: 'optional', description: 'Vacancy projections' },
  { from: 'M04', to: 'M14', dataKeys: ['supply_pressure_score', 'months_of_supply'], strength: 'required', description: 'Supply risk score' },
  { from: 'M04', to: 'M15', dataKeys: ['competitive_projects'], strength: 'optional', description: 'Comp set data' },
  { from: 'M04', to: 'M25', dataKeys: ['supply_pressure_score'], strength: 'required', description: 'Supply sub-score input' },

  // M05 Market outputs
  { from: 'M05', to: 'M08', dataKeys: ['rent_growth_pct', 'vacancy_rate', 'submarket_rank'], strength: 'required', description: 'Market signals per strategy' },
  { from: 'M05', to: 'M09', dataKeys: ['avg_rent_psf', 'vacancy_rate', 'rent_growth_pct'], strength: 'required', description: 'Rent levels, vacancy, growth' },
  { from: 'M05', to: 'M10', dataKeys: ['vacancy_rate', 'rent_growth_pct'], strength: 'optional', description: 'Market condition inputs' },
  { from: 'M05', to: 'M14', dataKeys: ['vacancy_rate', 'rent_growth_pct'], strength: 'optional', description: 'Market risk factors' },
  { from: 'M05', to: 'M15', dataKeys: ['avg_rent_psf', 'vacancy_rate'], strength: 'optional', description: 'Rent comp data' },
  { from: 'M05', to: 'M25', dataKeys: ['rent_growth_pct', 'vacancy_rate', 'submarket_rank'], strength: 'required', description: 'Momentum + position inputs' },

  // M06 Demand outputs
  { from: 'M06', to: 'M05', dataKeys: ['demand_score', 'demand_units_total'], strength: 'optional', description: 'Demand-side market signals' },
  { from: 'M06', to: 'M08', dataKeys: ['demand_score', 'demand_units_total'], strength: 'required', description: 'Demand signals per strategy' },
  { from: 'M06', to: 'M09', dataKeys: ['demand_units_total', 'demand_units_phased'], strength: 'optional', description: 'Demand-adjusted assumptions' },
  { from: 'M06', to: 'M14', dataKeys: ['demand_score', 'employer_concentration_risk'], strength: 'required', description: 'Demand risk (concentration)' },
  { from: 'M06', to: 'M25', dataKeys: ['demand_score'], strength: 'required', description: 'Demand sub-score input' },

  // M07 Traffic outputs
  { from: 'M07', to: 'M05', dataKeys: ['traffic_trend', 'comp_averages'], strength: 'optional', description: 'Traffic demand signals + comp averages' },
  { from: 'M07', to: 'M08', dataKeys: ['traffic_trend', 'predicted_leases_week', 'visibility_score', 'capture_rate'], strength: 'optional', description: 'Traffic correlation per strategy + visibility' },
  { from: 'M07', to: 'M09', dataKeys: ['predicted_leases_week', 'capture_rate', 'vacancy_assumption', 'rent_growth_adjustment', 'absorption_rate'], strength: 'optional', description: 'Traffic-derived ProForma assumptions (vacancy, rent, absorption)' },
  { from: 'M07', to: 'M14', dataKeys: ['traffic_trend', 'visibility_score', 'seasonal_risk_windows', 'occupancy_below_threshold'], strength: 'optional', description: 'Traffic risk signals + seasonal windows' },
  { from: 'M07', to: 'M25', dataKeys: ['predicted_leases_week', 'traffic_trend', 'visibility_score', 'capture_rate'], strength: 'optional', description: 'Traffic sub-score input + visibility' },

  // M08 Strategy outputs
  { from: 'M08', to: 'M01', dataKeys: ['recommended_strategy', 'strategy_scores'], strength: 'required', description: 'Strategy recommendation for overview' },
  { from: 'M08', to: 'M09', dataKeys: ['recommended_strategy', 'strategy_scores'], strength: 'required', description: 'Strategy-specific proforma params' },
  { from: 'M08', to: 'M25', dataKeys: ['strategy_scores'], strength: 'optional', description: 'Strategy-adjusted weighting' },

  // M09 ProForma outputs
  { from: 'M09', to: 'M01', dataKeys: ['noi', 'irr', 'coc_return'], strength: 'required', description: 'Key financials for overview' },
  { from: 'M09', to: 'M10', dataKeys: ['noi', 'cash_flow_projections', 'irr'], strength: 'required', description: 'Base case financials' },
  { from: 'M09', to: 'M11', dataKeys: ['noi'], strength: 'required', description: 'NOI for DSCR/debt analysis' },
  { from: 'M09', to: 'M12', dataKeys: ['noi', 'cash_flow_projections'], strength: 'required', description: 'NOI/CF for exit timing' },
  { from: 'M09', to: 'M14', dataKeys: ['noi'], strength: 'optional', description: 'Financial risk indicators' },
  { from: 'M09', to: 'M22', dataKeys: ['noi', 'cash_flow_projections'], strength: 'required', description: 'Projected vs actual' },

  // M10 Scenario outputs
  { from: 'M10', to: 'M01', dataKeys: ['probability_weighted_returns'], strength: 'optional', description: 'Probability-weighted returns' },
  { from: 'M10', to: 'M09', dataKeys: ['scenario_assumptions'], strength: 'optional', description: 'Stress-test parameters' },

  // M11 Debt outputs
  { from: 'M11', to: 'M01', dataKeys: ['dscr', 'ltv'], strength: 'optional', description: 'Debt terms summary' },
  { from: 'M11', to: 'M09', dataKeys: ['dscr'], strength: 'optional', description: 'Debt service into CF' },

  // M13 DD outputs
  { from: 'M13', to: 'M01', dataKeys: ['dd_completion_pct'], strength: 'optional', description: 'DD completion %' },
  { from: 'M13', to: 'M14', dataKeys: ['critical_findings'], strength: 'optional', description: 'DD red flags' },

  // M14 Risk outputs
  { from: 'M14', to: 'M01', dataKeys: ['composite_risk_score', 'risk_heatmap'], strength: 'required', description: 'Composite risk display' },
  { from: 'M14', to: 'M08', dataKeys: ['composite_risk_score'], strength: 'optional', description: 'Risk-adjusted strategy scores' },
  { from: 'M14', to: 'M25', dataKeys: ['composite_risk_score'], strength: 'required', description: 'Risk sub-score input' },

  // M15 Competition outputs
  { from: 'M15', to: 'M05', dataKeys: ['rent_comp_matrix', 'competitive_position_score'], strength: 'optional', description: 'Competitive positioning data' },
  { from: 'M15', to: 'M08', dataKeys: ['competitive_position_score'], strength: 'optional', description: 'Competitive advantage per strategy' },

  // M16 Pipeline outputs
  { from: 'M16', to: 'M01', dataKeys: ['pipeline_stage', 'days_in_stage'], strength: 'optional', description: 'Pipeline stage' },

  // Demand Intelligence (apartment_user_analytics) enrichment flows
  { from: 'M06', to: 'M14', dataKeys: ['deal_breakers'], strength: 'optional', description: 'Preference-based deal breakers for risk flags' },
  { from: 'M06', to: 'M08', dataKeys: ['budget_distribution', 'bedroom_demand'], strength: 'optional', description: 'Budget and bedroom demand for strategy rent assumptions' },
  { from: 'M06', to: 'M07', dataKeys: ['commute_preferences'], strength: 'optional', description: 'Commute preferences for traffic intelligence enrichment' },
  { from: 'M06', to: 'M25', dataKeys: ['apartment_features_demand', 'move_in_timeline', 'deal_breakers', 'bedroom_demand', 'budget_distribution', 'commute_preferences'], strength: 'optional', description: 'Full demand intelligence signals for JEDI score enrichment' },

  // M19 News Intel outputs
  { from: 'M19', to: 'M04', dataKeys: ['classified_supply_events'], strength: 'optional', description: 'Classified supply events' },
  { from: 'M19', to: 'M06', dataKeys: ['classified_demand_events'], strength: 'required', description: 'Classified demand events' },
  { from: 'M19', to: 'M14', dataKeys: ['sentiment_score'], strength: 'optional', description: 'Sentiment, risk signals' },

  // M25 JEDI Score outputs
  { from: 'M25', to: 'M01', dataKeys: ['jedi_score', 'sub_scores', 'score_delta'], strength: 'required', description: 'JEDI Score for display' },
  { from: 'M25', to: 'M20', dataKeys: ['jedi_score'], strength: 'required', description: 'Scores for map bubbles' },
  { from: 'M25', to: 'M23', dataKeys: ['jedi_score', 'score_delta'], strength: 'optional', description: 'Score changes trigger alerts' },

  // M24 Settings outputs
  { from: 'M24', to: 'M25', dataKeys: ['user_config'], strength: 'optional', description: 'User weight overrides' },
];

// ============================================================================
// Data Flow Router
// ============================================================================

class DataFlowRouter {
  /** Cached module data per deal, keyed by `dealId:moduleId` */
  private cache = new Map<string, ModuleDataPacket>();

  /**
   * Store output data from a module for a given deal.
   * This data becomes available for downstream modules.
   */
  publishModuleData(moduleId: ModuleId, dealId: string, data: Record<string, any>): void {
    const cacheKey = `${dealId}:${moduleId}`;
    const existing = this.cache.get(cacheKey);
    const version = existing ? existing.version + 1 : 1;

    this.cache.set(cacheKey, {
      moduleId,
      dealId,
      data,
      timestamp: new Date(),
      version,
    });

    // Emit event for downstream modules
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: moduleId,
      dealId,
      data,
      timestamp: new Date(),
    });

    logger.debug('Module data published', { moduleId, dealId, keys: Object.keys(data), version });
  }

  /**
   * Gather all required and optional inputs for a module from upstream modules.
   * Returns a DataFlowResult indicating which inputs are available and which are missing.
   */
  gatherInputs(moduleId: ModuleId, dealId: string): DataFlowResult {
    const connections = this.getIncomingConnections(moduleId);
    const requiredInputs: Record<string, any> = {};
    const optionalInputs: Record<string, any> = {};
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];

    for (const conn of connections) {
      const cacheKey = `${dealId}:${conn.from}`;
      const packet = this.cache.get(cacheKey);

      for (const key of conn.dataKeys) {
        const value = packet?.data?.[key];

        if (value !== undefined && value !== null) {
          if (conn.strength === 'required') {
            requiredInputs[key] = value;
          } else {
            optionalInputs[key] = value;
          }
        } else {
          if (conn.strength === 'required') {
            missingRequired.push(`${conn.from}.${key}`);
          } else {
            missingOptional.push(`${conn.from}.${key}`);
          }
        }
      }
    }

    return {
      moduleId,
      requiredInputs,
      optionalInputs,
      missingRequired,
      missingOptional,
      ready: missingRequired.length === 0,
    };
  }

  /**
   * Get all connections flowing INTO a module.
   */
  getIncomingConnections(moduleId: ModuleId): DataFlowConnection[] {
    return DATA_FLOW_CONNECTIONS.filter(c => c.to === moduleId);
  }

  /**
   * Get all connections flowing OUT of a module.
   */
  getOutgoingConnections(moduleId: ModuleId): DataFlowConnection[] {
    return DATA_FLOW_CONNECTIONS.filter(c => c.from === moduleId);
  }

  /**
   * Get downstream modules that should recalculate when a module's data changes.
   */
  getAffectedModules(moduleId: ModuleId): ModuleId[] {
    return [...new Set(
      DATA_FLOW_CONNECTIONS
        .filter(c => c.from === moduleId)
        .map(c => c.to)
    )];
  }

  /**
   * Get the full cascade chain: all modules affected by a change, recursively.
   */
  getCascadeChain(moduleId: ModuleId): ModuleId[] {
    const visited = new Set<ModuleId>();
    const chain: ModuleId[] = [];

    const traverse = (id: ModuleId) => {
      if (visited.has(id)) return;
      visited.add(id);
      const affected = this.getAffectedModules(id);
      for (const downstream of affected) {
        chain.push(downstream);
        traverse(downstream);
      }
    };

    traverse(moduleId);
    return chain;
  }

  /**
   * Get cached data for a module.
   */
  getModuleData(moduleId: ModuleId, dealId: string): ModuleDataPacket | undefined {
    return this.cache.get(`${dealId}:${moduleId}`);
  }

  /**
   * Clear all cached data for a deal.
   */
  clearDealCache(dealId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${dealId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data.
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get the full data flow matrix as a serializable structure.
   */
  getDataFlowMatrix(): DataFlowConnection[] {
    return DATA_FLOW_CONNECTIONS;
  }

  /**
   * Validate the data flow graph for circular dependencies.
   * Returns any cycles found.
   */
  detectCycles(): ModuleId[][] {
    const cycles: ModuleId[][] = [];
    const visited = new Set<ModuleId>();
    const stack = new Set<ModuleId>();

    const dfs = (node: ModuleId, path: ModuleId[]) => {
      if (stack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const downstream = this.getAffectedModules(node);
      for (const next of downstream) {
        dfs(next, [...path, next]);
      }

      stack.delete(node);
    };

    const allModules = [...new Set(
      DATA_FLOW_CONNECTIONS.flatMap(c => [c.from, c.to])
    )];

    for (const module of allModules) {
      dfs(module, [module]);
    }

    return cycles;
  }

  /**
   * Get a readiness report for all modules for a given deal.
   */
  getReadinessReport(dealId: string): Record<ModuleId, DataFlowResult> {
    const report: Partial<Record<ModuleId, DataFlowResult>> = {};
    const allModules = [...new Set(
      DATA_FLOW_CONNECTIONS.flatMap(c => [c.from, c.to])
    )];

    for (const moduleId of allModules) {
      report[moduleId] = this.gatherInputs(moduleId, dealId);
    }

    return report as Record<ModuleId, DataFlowResult>;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const dataFlowRouter = new DataFlowRouter();
export { DATA_FLOW_CONNECTIONS };

// ============================================================================
// Financial Module (M09) Data Aggregation
// ============================================================================

export interface FinancialModuleInputs {
  market: {
    avgRentPsf: number | null;
    vacancyRate: number | null;
    rentGrowthPct: number | null;
    source: 'live' | 'none';
  };
  demand: {
    demandUnitsTotal: number | null;
    demandUnitsPhased: any[] | null;
    demandScore: number | null;
    source: 'live' | 'none';
  };
  traffic: {
    predictedLeasesWeek: number | null;
    captureRate: number | null;
    vacancyAssumption: number | null;
    rentGrowthAdjustment: number | null;
    absorptionRate: number | null;
    trafficTrend: string | null;
    source: 'live' | 'none';
  };
  strategy: {
    recommendedStrategy: string | null;
    strategyScores: Record<string, number> | null;
    holdPeriod: number | null;
    exitCap: number | null;
    capex: number | null;
    source: 'live' | 'none';
  };
  moduleStatus: Record<string, 'live' | 'none'>;
}

export async function getFinancialInputsFromModules(dealId: string): Promise<FinancialModuleInputs> {
  const pool = getPool();

  const [marketResult, demandResult, trafficResult, strategyResult, dealResult] = await Promise.all([
    pool.query(
      `SELECT data FROM apartment_market_snapshots
       WHERE deal_id = $1 OR city = (SELECT city FROM deals WHERE id = $1)
       ORDER BY snapshot_date DESC LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT data FROM apartment_user_analytics
       WHERE analytics_type = 'demand-signals'
       ORDER BY snapshot_date DESC LIMIT 1`
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT data FROM leasing_traffic_data
       WHERE deal_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT * FROM strategy_analyses
       WHERE deal_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] })),

    pool.query(
      `SELECT city, state FROM deals WHERE id = $1`,
      [dealId]
    ).catch(() => ({ rows: [] })),
  ]);

  const marketData = marketResult.rows[0]?.data;
  const demandData = demandResult.rows[0]?.data;
  const trafficData = trafficResult.rows[0]?.data;
  const strategyRow = strategyResult.rows[0];

  const market: FinancialModuleInputs['market'] = {
    avgRentPsf: marketData?.avg_rent_psf ?? marketData?.avgRentPsf ?? null,
    vacancyRate: marketData?.vacancy_rate ?? marketData?.vacancyRate ?? null,
    rentGrowthPct: marketData?.rent_growth_pct ?? marketData?.rentGrowthPct ?? null,
    source: marketData ? 'live' : 'none',
  };

  const demand: FinancialModuleInputs['demand'] = {
    demandUnitsTotal: demandData?.demand_units_total ?? demandData?.demandUnitsTotal ?? null,
    demandUnitsPhased: demandData?.demand_units_phased ?? demandData?.demandUnitsPhased ?? null,
    demandScore: demandData?.demand_score ?? demandData?.demandScore ?? null,
    source: demandData ? 'live' : 'none',
  };

  const traffic: FinancialModuleInputs['traffic'] = {
    predictedLeasesWeek: trafficData?.predicted_leases_week ?? trafficData?.predictedLeasesWeek ?? null,
    captureRate: trafficData?.capture_rate ?? trafficData?.captureRate ?? null,
    vacancyAssumption: trafficData?.vacancy_assumption ?? trafficData?.vacancyAssumption ?? null,
    rentGrowthAdjustment: trafficData?.rent_growth_adjustment ?? trafficData?.rentGrowthAdjustment ?? null,
    absorptionRate: trafficData?.absorption_rate ?? trafficData?.absorptionRate ?? null,
    trafficTrend: trafficData?.traffic_trend ?? trafficData?.trafficTrend ?? null,
    source: trafficData ? 'live' : 'none',
  };

  const strategy: FinancialModuleInputs['strategy'] = {
    recommendedStrategy: strategyRow?.recommended_strategy ?? strategyRow?.strategy_type ?? null,
    strategyScores: strategyRow?.strategy_scores ? (typeof strategyRow.strategy_scores === 'string' ? JSON.parse(strategyRow.strategy_scores) : strategyRow.strategy_scores) : null,
    holdPeriod: strategyRow?.hold_period ?? null,
    exitCap: strategyRow?.exit_cap ?? null,
    capex: strategyRow?.capex ?? null,
    source: strategyRow ? 'live' : 'none',
  };

  const cachedInputs = dataFlowRouter.gatherInputs('M09', dealId);
  for (const [key, value] of Object.entries(cachedInputs.requiredInputs)) {
    if (key === 'avg_rent_psf' && market.avgRentPsf === null) market.avgRentPsf = value;
    if (key === 'vacancy_rate' && market.vacancyRate === null) market.vacancyRate = value;
    if (key === 'rent_growth_pct' && market.rentGrowthPct === null) market.rentGrowthPct = value;
    if (key === 'recommended_strategy' && strategy.recommendedStrategy === null) strategy.recommendedStrategy = value;
    if (key === 'strategy_scores' && strategy.strategyScores === null) strategy.strategyScores = value;
  }
  for (const [key, value] of Object.entries(cachedInputs.optionalInputs)) {
    if (key === 'demand_units_total' && demand.demandUnitsTotal === null) demand.demandUnitsTotal = value;
    if (key === 'demand_units_phased' && demand.demandUnitsPhased === null) demand.demandUnitsPhased = value;
    if (key === 'predicted_leases_week' && traffic.predictedLeasesWeek === null) traffic.predictedLeasesWeek = value;
    if (key === 'capture_rate' && traffic.captureRate === null) traffic.captureRate = value;
    if (key === 'vacancy_assumption' && traffic.vacancyAssumption === null) traffic.vacancyAssumption = value;
    if (key === 'rent_growth_adjustment' && traffic.rentGrowthAdjustment === null) traffic.rentGrowthAdjustment = value;
    if (key === 'absorption_rate' && traffic.absorptionRate === null) traffic.absorptionRate = value;
  }

  const moduleStatus: Record<string, 'live' | 'none'> = {
    M05_Market: market.source,
    M06_Demand: demand.source,
    M07_Traffic: traffic.source,
    M08_Strategy: strategy.source,
  };

  logger.info('Financial module inputs gathered', {
    dealId,
    moduleStatus,
    hasMarket: market.source === 'live',
    hasDemand: demand.source === 'live',
    hasTraffic: traffic.source === 'live',
    hasStrategy: strategy.source === 'live',
  });

  return { market, demand, traffic, strategy, moduleStatus };
}

// ============================================================================
// Financial Module Event Bus Listeners
// ============================================================================

export function setupFinancialModuleListeners(): void {
  const upstreamModules: ModuleId[] = ['M05', 'M06', 'M07', 'M08'];

  moduleEventBus.onInputsChanged('M09', upstreamModules, (event) => {
    logger.info('Financial module notified of upstream change', {
      sourceModule: event.sourceModule,
      dealId: event.dealId,
      dataKeys: event.data ? Object.keys(event.data) : [],
    });

    moduleEventBus.emitDebounced({
      type: ModuleEventType.RECALCULATE,
      sourceModule: 'M09',
      dealId: event.dealId,
      data: { trigger: event.sourceModule, upstreamData: event.data },
      timestamp: new Date(),
    }, `m09-recalc:${event.dealId}`);
  });

  moduleEventBus.on(ModuleEventType.DATA_UPDATED, (event) => {
    if (event.sourceModule === 'M08' && event.data?.recommended_strategy) {
      logger.info('Strategy change detected — financial model should refresh', {
        dealId: event.dealId,
        newStrategy: event.data.recommended_strategy,
      });
    }
  }, 'M08');

  logger.info('Financial module (M09) event bus listeners registered');
}
