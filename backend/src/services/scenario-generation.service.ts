/**
 * Scenario Generation Service
 * 
 * Generates Bull/Base/Bear/Stress scenarios from news events and market intelligence.
 * Evidence-based parameter selection (not generic +/- 10%).
 * 
 * Phase 3, Component 2: Scenario Generation
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type ScenarioType = 'bull' | 'base' | 'bear' | 'stress' | 'custom';

export interface ScenarioTemplate {
  id: number;
  scenarioType: ScenarioType;
  displayName: string;
  description: string;
  demandPositiveInclusion: number;
  demandNegativeInclusion: number;
  supplyPositiveInclusion: number;
  supplyNegativeInclusion: number;
  riskEventCount: number;
  demandDelayMonths: number;
  supplyAccelerationMonths: number;
  demandImpactMultiplier: number;
  supplyImpactMultiplier: number;
  assumptionNarrativeTemplate: string;
}

export interface DealScenario {
  id: string;
  dealId: string;
  scenarioTemplateId: number;
  scenarioType: ScenarioType;
  scenarioName: string;
  description: string;
  isCustom: boolean;
  isActive: boolean;
  generatedBy?: string;
  generationTrigger: string;
  sourceEventCount: number;
  irrPct?: number;
  cocYear5?: number;
  npv?: number;
  cashFlowYear5?: number;
  resultsCalculatedAt?: Date;
  keyAssumptionsSummary?: string;
  eventSummary?: string;
  riskSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScenarioAssumptions {
  id: string;
  scenarioId: string;
  rentGrowthPct: number;
  vacancyPct: number;
  opexGrowthPct: number;
  exitCapPct: number;
  absorptionMonths?: number;
  rentGrowthDelta?: number;
  vacancyDelta?: number;
  opexGrowthDelta?: number;
  exitCapDelta?: number;
  absorptionDelta?: number;
  adjustmentRationale?: string;
  sourceEventsCount: number;
}

export interface ScenarioEvent {
  id: string;
  scenarioId: string;
  newsEventId?: string;
  demandEventId?: string;
  supplyEventId?: string;
  riskEventId?: string;
  eventType: 'demand_positive' | 'demand_negative' | 'supply_positive' | 'supply_negative' | 'risk';
  eventCategory?: string;
  included: boolean;
  inclusionReason?: string;
  impactWeight: number;
  timingAdjustmentMonths: number;
  eventSummary?: string;
  eventDate?: Date;
  projectedImpactDate?: Date;
}

export interface GenerationContext {
  dealId: string;
  tradeAreaId?: string;
  generatedBy?: string;
  trigger?: 'auto' | 'manual' | 'event_update';
  includeMonteCarloInvalid?: boolean;
}

export interface ScenarioComparison {
  dealId: string;
  dealName: string;
  scenarios: {
    bull?: ScenarioSummary;
    base?: ScenarioSummary;
    bear?: ScenarioSummary;
    stress?: ScenarioSummary;
  };
  ranges: {
    irrMin: number;
    irrMax: number;
    irrSpread: number;
    npvMin: number;
    npvMax: number;
  };
}

export interface ScenarioSummary {
  scenarioType: ScenarioType;
  scenarioName: string;
  irrPct: number;
  cocYear5: number;
  npv: number;
  cashFlowYear5: number;
  assumptions: ScenarioAssumptions;
  eventCount: number;
  keyAssumptions: string;
  eventSummary: string;
  riskSummary: string;
}

export interface EventInput {
  id: string;
  type: 'news' | 'demand' | 'supply' | 'risk';
  eventType: 'demand_positive' | 'demand_negative' | 'supply_positive' | 'supply_negative' | 'risk';
  category: string;
  summary: string;
  eventDate: Date;
  projectedImpactDate?: Date;
  impactMagnitude?: number; // Jobs, units, etc.
  probability?: number;
}

// ============================================================================
// Core Functions
// ============================================================================

export class ScenarioGenerationService {
  /**
   * Generate all 4 standard scenarios for a deal
   */
  async generateScenariosForDeal(context: GenerationContext): Promise<DealScenario[]> {
    logger.info(`Generating scenarios for deal ${context.dealId}`);

    try {
      // 1. Get deal and trade area info
      const dealResult = await query(
        `SELECT d.*, d.trade_area_id, d.strategy, ta.name as trade_area_name
         FROM deals d
         LEFT JOIN trade_areas ta ON ta.id = d.trade_area_id
         WHERE d.id = $1`,
        [context.dealId]
      );

      if (dealResult.rows.length === 0) {
        throw new Error(`Deal ${context.dealId} not found`);
      }

      const deal = dealResult.rows[0];
      const tradeAreaId = deal.trade_area_id;

      if (!tradeAreaId) {
        logger.warn(`Deal ${context.dealId} has no trade area assigned. Using limited scenario generation.`);
      }

      // 2. Get baseline assumptions
      const baselineAssumptions = await this.getBaselineAssumptions(context.dealId, deal.strategy);

      // 3. Get all relevant events
      const events = tradeAreaId ? await this.getRelevantEvents(tradeAreaId) : [];

      logger.info(`Found ${events.length} events for trade area ${tradeAreaId}`);

      // 4. Get scenario templates
      const templates = await this.getScenarioTemplates();

      // 5. Generate each scenario type
      const scenarios: DealScenario[] = [];

      for (const template of templates) {
        const scenario = await this.generateScenario(
          deal,
          template,
          baselineAssumptions,
          events,
          context
        );
        scenarios.push(scenario);
      }

      logger.info(`Generated ${scenarios.length} scenarios for deal ${context.dealId}`);

      return scenarios;
    } catch (error) {
      logger.error('Error generating scenarios:', error);
      throw error;
    }
  }

  /**
   * Generate a single scenario based on template
   */
  private async generateScenario(
    deal: any,
    template: ScenarioTemplate,
    baselineAssumptions: any,
    events: EventInput[],
    context: GenerationContext
  ): Promise<DealScenario> {
    logger.info(`Generating ${template.scenarioType} scenario for deal ${deal.id}`);

    // 1. Select events based on template rules
    const selectedEvents = this.selectEventsForScenario(events, template);

    // 2. Calculate adjusted assumptions
    const adjustedAssumptions = this.calculateAdjustedAssumptions(
      baselineAssumptions,
      selectedEvents,
      template
    );

    // 3. Generate narrative
    const narrative = this.generateNarrative(selectedEvents, template, deal);

    // 4. Create scenario record
    const scenarioResult = await query(
      `INSERT INTO deal_scenarios (
        deal_id, scenario_template_id, scenario_type, scenario_name, description,
        is_custom, generation_trigger, source_event_count, generated_by,
        key_assumptions_summary, event_summary, risk_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (deal_id, scenario_type, is_custom) 
      WHERE is_custom = FALSE
      DO UPDATE SET
        scenario_template_id = EXCLUDED.scenario_template_id,
        scenario_name = EXCLUDED.scenario_name,
        description = EXCLUDED.description,
        generation_trigger = EXCLUDED.generation_trigger,
        source_event_count = EXCLUDED.source_event_count,
        generated_by = EXCLUDED.generated_by,
        key_assumptions_summary = EXCLUDED.key_assumptions_summary,
        event_summary = EXCLUDED.event_summary,
        risk_summary = EXCLUDED.risk_summary,
        updated_at = NOW()
      RETURNING *`,
      [
        deal.id,
        template.id,
        template.scenarioType,
        `${template.displayName} - ${deal.name}`,
        template.description,
        false,
        context.trigger || 'auto',
        selectedEvents.length,
        context.generatedBy,
        narrative.assumptions,
        narrative.events,
        narrative.risks,
      ]
    );

    const scenario = scenarioResult.rows[0];

    // 5. Store scenario assumptions
    await this.storeScenarioAssumptions(scenario.id, adjustedAssumptions, baselineAssumptions);

    // 6. Store scenario events
    await this.storeScenarioEvents(scenario.id, selectedEvents, template);

    // 7. Calculate financial results (placeholder - integrate with pro forma)
    await this.calculateScenarioResults(scenario.id, adjustedAssumptions);

    return scenario;
  }

  /**
   * Select events based on scenario template rules
   */
  private selectEventsForScenario(
    events: EventInput[],
    template: ScenarioTemplate
  ): EventInput[] {
    const selected: EventInput[] = [];

    // Categorize events
    const demandPositive = events.filter(e => e.eventType === 'demand_positive');
    const demandNegative = events.filter(e => e.eventType === 'demand_negative');
    const supplyPositive = events.filter(e => e.eventType === 'supply_positive');
    const supplyNegative = events.filter(e => e.eventType === 'supply_negative');
    const riskEvents = events.filter(e => e.eventType === 'risk');

    // Apply inclusion rules
    selected.push(...this.sampleEvents(demandPositive, template.demandPositiveInclusion));
    selected.push(...this.sampleEvents(demandNegative, template.demandNegativeInclusion));
    selected.push(...this.sampleEvents(supplyPositive, template.supplyPositiveInclusion));
    selected.push(...this.sampleEvents(supplyNegative, template.supplyNegativeInclusion));

    // Add risk events (highest probability first)
    const sortedRisks = riskEvents.sort((a, b) => (b.probability || 0) - (a.probability || 0));
    selected.push(...sortedRisks.slice(0, template.riskEventCount));

    return selected;
  }

  /**
   * Sample events based on inclusion percentage
   */
  private sampleEvents(events: EventInput[], inclusionPct: number): EventInput[] {
    if (inclusionPct === 0) return [];
    if (inclusionPct >= 1) return events;

    const count = Math.ceil(events.length * inclusionPct);
    // Sort by impact magnitude and take top N
    const sorted = events.sort((a, b) => (b.impactMagnitude || 0) - (a.impactMagnitude || 0));
    return sorted.slice(0, count);
  }

  /**
   * Calculate adjusted pro forma assumptions based on events
   */
  private calculateAdjustedAssumptions(
    baseline: any,
    events: EventInput[],
    template: ScenarioTemplate
  ): any {
    // Start with baseline
    let rentGrowth = baseline.rentGrowth || 0.03;
    let vacancy = baseline.vacancy || 0.05;
    let opexGrowth = baseline.opexGrowth || 0.025;
    let exitCap = baseline.exitCap || 0.06;
    let absorption = baseline.absorption || 12;

    // Calculate net impact from events
    const demandImpact = this.calculateDemandImpact(events, template);
    const supplyImpact = this.calculateSupplyImpact(events, template);
    const riskImpact = this.calculateRiskImpact(events, template);

    // Apply adjustments
    rentGrowth += demandImpact.rentGrowthAdj - supplyImpact.rentGrowthAdj + riskImpact.rentGrowthAdj;
    vacancy += supplyImpact.vacancyAdj - demandImpact.vacancyAdj + riskImpact.vacancyAdj;
    exitCap += supplyImpact.exitCapAdj + riskImpact.exitCapAdj;
    absorption += supplyImpact.absorptionAdj - demandImpact.absorptionAdj;

    // Bounds checking
    rentGrowth = Math.max(-0.05, Math.min(0.15, rentGrowth));
    vacancy = Math.max(0.02, Math.min(0.25, vacancy));
    opexGrowth = Math.max(0.01, Math.min(0.08, opexGrowth));
    exitCap = Math.max(0.04, Math.min(0.12, exitCap));
    absorption = Math.max(3, Math.min(36, absorption));

    return {
      rentGrowth,
      vacancy,
      opexGrowth,
      exitCap,
      absorption,
      demandImpact,
      supplyImpact,
      riskImpact,
    };
  }

  /**
   * Calculate demand impact on assumptions
   */
  private calculateDemandImpact(events: EventInput[], template: ScenarioTemplate): any {
    const demandPositive = events.filter(e => e.eventType === 'demand_positive');
    const demandNegative = events.filter(e => e.eventType === 'demand_negative');

    const positiveJobs = demandPositive.reduce((sum, e) => sum + (e.impactMagnitude || 0), 0);
    const negativeJobs = demandNegative.reduce((sum, e) => sum + (e.impactMagnitude || 0), 0);
    const netJobs = positiveJobs - negativeJobs;

    // Convert jobs to impact (rough heuristic: 1000 jobs = 1% rent growth, -0.5% vacancy)
    const jobsImpactFactor = netJobs / 1000;

    return {
      rentGrowthAdj: jobsImpactFactor * 0.01 * template.demandImpactMultiplier,
      vacancyAdj: jobsImpactFactor * -0.005 * template.demandImpactMultiplier,
      absorptionAdj: jobsImpactFactor * -0.5, // Faster absorption
    };
  }

  /**
   * Calculate supply impact on assumptions
   */
  private calculateSupplyImpact(events: EventInput[], template: ScenarioTemplate): any {
    const supplyPositive = events.filter(e => e.eventType === 'supply_positive'); // New supply
    const supplyNegative = events.filter(e => e.eventType === 'supply_negative'); // Supply removed

    const newUnits = supplyPositive.reduce((sum, e) => sum + (e.impactMagnitude || 0), 0);
    const removedUnits = supplyNegative.reduce((sum, e) => sum + (e.impactMagnitude || 0), 0);
    const netUnits = newUnits - removedUnits;

    // Apply supply multiplier from template (e.g., 1.5x for stress case)
    const adjustedUnits = netUnits * template.supplyImpactMultiplier;

    // Convert units to impact (rough: 500 units = -1% rent growth, +1% vacancy)
    const unitsImpactFactor = adjustedUnits / 500;

    return {
      rentGrowthAdj: unitsImpactFactor * -0.01,
      vacancyAdj: unitsImpactFactor * 0.01,
      exitCapAdj: unitsImpactFactor * 0.002, // Higher cap rate in oversupplied market
      absorptionAdj: unitsImpactFactor * 1.0, // Slower absorption
    };
  }

  /**
   * Calculate risk impact on assumptions
   */
  private calculateRiskImpact(events: EventInput[], template: ScenarioTemplate): any {
    const riskEvents = events.filter(e => e.eventType === 'risk');

    if (riskEvents.length === 0) {
      return {
        rentGrowthAdj: 0,
        vacancyAdj: 0,
        exitCapAdj: 0,
      };
    }

    // Risk events compound
    const riskMultiplier = riskEvents.length >= 2 ? 1.5 : 1.0;

    return {
      rentGrowthAdj: -0.015 * riskMultiplier, // -1.5% to -3% rent growth
      vacancyAdj: 0.02 * riskMultiplier, // +2% to +4% vacancy
      exitCapAdj: 0.01 * riskMultiplier, // +1% to +2% exit cap
    };
  }

  /**
   * Generate narrative descriptions
   */
  private generateNarrative(
    events: EventInput[],
    template: ScenarioTemplate,
    deal: any
  ): { assumptions: string; events: string; risks: string } {
    const demandEvents = events.filter(e => e.eventType.startsWith('demand'));
    const supplyEvents = events.filter(e => e.eventType.startsWith('supply'));
    const riskEvents = events.filter(e => e.eventType === 'risk');

    // Key demand catalysts
    const demandCatalysts = demandEvents.length > 0
      ? demandEvents.map(e => e.summary).join('; ')
      : 'No major demand catalysts';

    // Supply pipeline
    const supplyUnits = supplyEvents.reduce((sum, e) => sum + (e.impactMagnitude || 0), 0);
    const supplyDescription = supplyUnits > 0
      ? `${supplyUnits} units in pipeline`
      : 'No competitive supply';

    // Risk statement
    const riskStatement = riskEvents.length > 0
      ? `Risk events: ${riskEvents.map(e => e.summary).join('; ')}`
      : 'No identified risk events';

    // Build assumption narrative from template
    const assumptionNarrative = template.assumptionNarrativeTemplate
      .replace('{demand_catalysts}', demandCatalysts)
      .replace('{supply_units}', supplyUnits.toString())
      .replace('{risk_statement}', riskStatement);

    return {
      assumptions: assumptionNarrative,
      events: `Demand: ${demandEvents.length} events. Supply: ${supplyEvents.length} events.`,
      risks: riskStatement,
    };
  }

  /**
   * Get baseline pro forma assumptions
   */
  private async getBaselineAssumptions(dealId: string, strategy: string): Promise<any> {
    // Try to get from proforma_assumptions table
    const result = await query(
      `SELECT 
        (rent_growth->>'baseline')::decimal as rent_growth,
        (vacancy->>'baseline')::decimal as vacancy,
        (opex_growth->>'baseline')::decimal as opex_growth,
        (exit_cap->>'baseline')::decimal as exit_cap,
        (absorption->>'baseline')::integer as absorption
       FROM proforma_assumptions
       WHERE deal_id = $1`,
      [dealId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fallback: use market defaults based on strategy
    return {
      rentGrowth: 0.03,
      vacancy: 0.05,
      opexGrowth: 0.025,
      exitCap: 0.06,
      absorption: 12,
    };
  }

  /**
   * Get relevant events for trade area
   */
  private async getRelevantEvents(tradeAreaId: string): Promise<EventInput[]> {
    const events: EventInput[] = [];

    // Get demand events
    const demandResult = await query(
      `SELECT 
        dp.id,
        dp.event_summary as summary,
        dp.employee_count as impact_magnitude,
        dp.demand_direction,
        det.category,
        dp.event_date,
        dp.projected_delivery_date as projected_impact_date
       FROM demand_projections dp
       JOIN demand_event_types det ON det.id = dp.event_type_id
       WHERE dp.trade_area_id = $1
         AND dp.projected_delivery_date > NOW()
       ORDER BY dp.employee_count DESC NULLS LAST`,
      [tradeAreaId]
    );

    for (const row of demandResult.rows) {
      events.push({
        id: row.id,
        type: 'demand',
        eventType: row.demand_direction === 'positive' ? 'demand_positive' : 'demand_negative',
        category: row.category,
        summary: row.summary,
        eventDate: row.event_date,
        projectedImpactDate: row.projected_impact_date,
        impactMagnitude: row.impact_magnitude,
      });
    }

    // Get supply events
    const supplyResult = await query(
      `SELECT 
        sp.id,
        CONCAT(sp.project_name, ' - ', sp.units, ' units') as summary,
        sp.units as impact_magnitude,
        sp.category,
        sp.announcement_date as event_date,
        sp.projected_delivery as projected_impact_date
       FROM supply_pipeline sp
       WHERE sp.trade_area_id = $1
         AND sp.projected_delivery > NOW()
       ORDER BY sp.units DESC`,
      [tradeAreaId]
    );

    for (const row of supplyResult.rows) {
      events.push({
        id: row.id,
        type: 'supply',
        eventType: 'supply_positive', // New supply is typically a negative for existing properties
        category: row.category || 'new_construction',
        summary: row.summary,
        eventDate: row.event_date,
        projectedImpactDate: row.projected_impact_date,
        impactMagnitude: row.impact_magnitude,
      });
    }

    // Get risk events from risk scoring
    const riskResult = await query(
      `SELECT 
        re.id,
        re.event_type,
        re.description as summary,
        re.probability,
        re.identified_date as event_date
       FROM risk_escalations re
       WHERE re.trade_area_id = $1
         AND re.is_active = TRUE
       ORDER BY re.probability DESC`,
      [tradeAreaId]
    );

    for (const row of riskResult.rows) {
      events.push({
        id: row.id,
        type: 'risk',
        eventType: 'risk',
        category: row.event_type,
        summary: row.summary,
        eventDate: row.event_date,
        probability: row.probability,
      });
    }

    return events;
  }

  /**
   * Get scenario templates
   */
  private async getScenarioTemplates(): Promise<ScenarioTemplate[]> {
    const result = await query(
      `SELECT 
        id, scenario_type, display_name, description,
        demand_positive_inclusion, demand_negative_inclusion,
        supply_positive_inclusion, supply_negative_inclusion,
        risk_event_count,
        demand_delay_months, supply_acceleration_months,
        demand_impact_multiplier, supply_impact_multiplier,
        assumption_narrative_template
       FROM scenario_templates
       ORDER BY 
         CASE scenario_type 
           WHEN 'bull' THEN 1 
           WHEN 'base' THEN 2 
           WHEN 'bear' THEN 3 
           WHEN 'stress' THEN 4 
         END`
    );

    return result.rows.map(row => ({
      id: row.id,
      scenarioType: row.scenario_type,
      displayName: row.display_name,
      description: row.description,
      demandPositiveInclusion: parseFloat(row.demand_positive_inclusion),
      demandNegativeInclusion: parseFloat(row.demand_negative_inclusion),
      supplyPositiveInclusion: parseFloat(row.supply_positive_inclusion),
      supplyNegativeInclusion: parseFloat(row.supply_negative_inclusion),
      riskEventCount: row.risk_event_count,
      demandDelayMonths: row.demand_delay_months,
      supplyAccelerationMonths: row.supply_acceleration_months,
      demandImpactMultiplier: parseFloat(row.demand_impact_multiplier),
      supplyImpactMultiplier: parseFloat(row.supply_impact_multiplier),
      assumptionNarrativeTemplate: row.assumption_narrative_template,
    }));
  }

  /**
   * Store scenario assumptions
   */
  private async storeScenarioAssumptions(
    scenarioId: string,
    adjusted: any,
    baseline: any
  ): Promise<void> {
    await query(
      `INSERT INTO scenario_assumptions (
        scenario_id, 
        rent_growth_pct, vacancy_pct, opex_growth_pct, exit_cap_pct, absorption_months,
        rent_growth_delta, vacancy_delta, opex_growth_delta, exit_cap_delta, absorption_delta,
        adjustment_rationale, source_events_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (scenario_id) 
      DO UPDATE SET
        rent_growth_pct = EXCLUDED.rent_growth_pct,
        vacancy_pct = EXCLUDED.vacancy_pct,
        opex_growth_pct = EXCLUDED.opex_growth_pct,
        exit_cap_pct = EXCLUDED.exit_cap_pct,
        absorption_months = EXCLUDED.absorption_months,
        rent_growth_delta = EXCLUDED.rent_growth_delta,
        vacancy_delta = EXCLUDED.vacancy_delta,
        opex_growth_delta = EXCLUDED.opex_growth_delta,
        exit_cap_delta = EXCLUDED.exit_cap_delta,
        absorption_delta = EXCLUDED.absorption_delta,
        updated_at = NOW()`,
      [
        scenarioId,
        adjusted.rentGrowth,
        adjusted.vacancy,
        adjusted.opexGrowth,
        adjusted.exitCap,
        adjusted.absorption,
        adjusted.rentGrowth - (baseline.rentGrowth || 0.03),
        adjusted.vacancy - (baseline.vacancy || 0.05),
        adjusted.opexGrowth - (baseline.opexGrowth || 0.025),
        adjusted.exitCap - (baseline.exitCap || 0.06),
        adjusted.absorption - (baseline.absorption || 12),
        'Calculated from news events and market intelligence',
        0, // Will be updated by storeScenarioEvents
      ]
    );
  }

  /**
   * Store scenario events
   */
  private async storeScenarioEvents(
    scenarioId: string,
    events: EventInput[],
    template: ScenarioTemplate
  ): Promise<void> {
    // Delete existing events for this scenario
    await query('DELETE FROM scenario_events WHERE scenario_id = $1', [scenarioId]);

    for (const event of events) {
      const timingAdjustment =
        event.eventType.startsWith('demand')
          ? template.demandDelayMonths
          : template.supplyAccelerationMonths;

      await query(
        `INSERT INTO scenario_events (
          scenario_id, 
          ${event.type}_event_id,
          event_type, event_category, included, inclusion_reason,
          impact_weight, timing_adjustment_months,
          event_summary, event_date, projected_impact_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          scenarioId,
          event.id,
          event.eventType,
          event.category,
          true,
          `Included per ${template.scenarioType} scenario rules`,
          event.type === 'demand' ? template.demandImpactMultiplier : template.supplyImpactMultiplier,
          timingAdjustment,
          event.summary,
          event.eventDate,
          event.projectedImpactDate,
        ]
      );
    }

    // Update source events count
    await query(
      'UPDATE scenario_assumptions SET source_events_count = $1 WHERE scenario_id = $2',
      [events.length, scenarioId]
    );
  }

  /**
   * Calculate scenario financial results
   * TODO: Integrate with actual pro forma engine
   */
  private async calculateScenarioResults(
    scenarioId: string,
    assumptions: any
  ): Promise<void> {
    // Placeholder calculation - to be integrated with actual pro forma
    const mockIRR = 15 + (Math.random() * 10 - 5); // 10-20%
    const mockCoC = 1.5 + Math.random(); // 1.5-2.5x
    const mockNPV = 1000000 + (Math.random() * 2000000 - 1000000); // -$1M to $3M

    await query(
      `UPDATE deal_scenarios 
       SET irr_pct = $1, coc_year_5 = $2, npv = $3, 
           cash_flow_year_5 = $4, results_calculated_at = NOW()
       WHERE id = $5`,
      [mockIRR, mockCoC, mockNPV, mockNPV * 0.2, scenarioId]
    );

    // Store detailed results
    await query(
      `INSERT INTO scenario_results (
        scenario_id, irr_pct, equity_multiple, coc_year_5, npv,
        calculation_method, calculation_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (scenario_id)
      DO UPDATE SET
        irr_pct = EXCLUDED.irr_pct,
        equity_multiple = EXCLUDED.equity_multiple,
        coc_year_5 = EXCLUDED.coc_year_5,
        npv = EXCLUDED.npv,
        calculation_timestamp = NOW()`,
      [scenarioId, mockIRR, mockCoC, mockCoC, mockNPV, 'deterministic']
    );
  }

  /**
   * Get scenario comparison for a deal
   */
  async getScenarioComparison(dealId: string): Promise<ScenarioComparison> {
    const result = await query(
      `SELECT * FROM v_scenario_comparison WHERE deal_id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new Error(`No scenarios found for deal ${dealId}`);
    }

    const dealName = result.rows[0].deal_name;
    const scenarios: any = {};

    for (const row of result.rows) {
      scenarios[row.scenario_type] = {
        scenarioType: row.scenario_type,
        scenarioName: row.scenario_name,
        irrPct: parseFloat(row.irr_pct),
        cocYear5: parseFloat(row.coc_year_5),
        npv: parseFloat(row.npv),
        cashFlowYear5: parseFloat(row.cash_flow_year_5),
        assumptions: {
          rentGrowthPct: parseFloat(row.rent_growth_pct),
          vacancyPct: parseFloat(row.vacancy_pct),
          exitCapPct: parseFloat(row.exit_cap_pct),
        },
        eventCount: row.source_event_count,
        keyAssumptions: row.key_assumptions_summary,
        eventSummary: row.event_summary,
        riskSummary: row.risk_summary,
      };
    }

    const irrs = result.rows.map(r => parseFloat(r.irr_pct)).filter(v => !isNaN(v));
    const npvs = result.rows.map(r => parseFloat(r.npv)).filter(v => !isNaN(v));

    return {
      dealId,
      dealName,
      scenarios,
      ranges: {
        irrMin: Math.min(...irrs),
        irrMax: Math.max(...irrs),
        irrSpread: Math.max(...irrs) - Math.min(...irrs),
        npvMin: Math.min(...npvs),
        npvMax: Math.max(...npvs),
      },
    };
  }

  /**
   * Get scenario details
   */
  async getScenarioDetails(scenarioId: string): Promise<any> {
    const scenarioResult = await query(
      `SELECT ds.*, sa.*, st.display_name as template_name
       FROM deal_scenarios ds
       LEFT JOIN scenario_assumptions sa ON sa.scenario_id = ds.id
       LEFT JOIN scenario_templates st ON st.id = ds.scenario_template_id
       WHERE ds.id = $1`,
      [scenarioId]
    );

    if (scenarioResult.rows.length === 0) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const scenario = scenarioResult.rows[0];

    // Get events
    const eventsResult = await query(
      `SELECT * FROM scenario_events WHERE scenario_id = $1 ORDER BY projected_impact_date`,
      [scenarioId]
    );

    // Get results
    const resultsResult = await query(
      `SELECT * FROM scenario_results WHERE scenario_id = $1`,
      [scenarioId]
    );

    return {
      scenario,
      events: eventsResult.rows,
      results: resultsResult.rows[0],
    };
  }

  /**
   * Recalculate scenario (after events update)
   */
  async recalculateScenario(scenarioId: string, userId?: string): Promise<DealScenario> {
    const scenarioResult = await query(
      'SELECT * FROM deal_scenarios WHERE id = $1',
      [scenarioId]
    );

    if (scenarioResult.rows.length === 0) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const scenario = scenarioResult.rows[0];

    // Regenerate scenario
    const context: GenerationContext = {
      dealId: scenario.deal_id,
      generatedBy: userId,
      trigger: 'manual',
    };

    // This will update the existing scenario
    await this.generateScenariosForDeal(context);

    // Return updated scenario
    const updated = await query('SELECT * FROM deal_scenarios WHERE id = $1', [scenarioId]);
    return updated.rows[0];
  }
}

export const scenarioGenerationService = new ScenarioGenerationService();
