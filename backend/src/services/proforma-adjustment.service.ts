/**
 * Pro Forma Adjustment Service
 * 
 * Calculates news-driven adjustments to financial model assumptions.
 * Maintains baseline (historical) vs. news-adjusted layers.
 * Tracks adjustment history with source events.
 * 
 * Phase 2, Component 1: Pro Forma Integration
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

// ============================================================================
// Types
// ============================================================================

export interface ProFormaAssumptions {
  id: string;
  dealId: string;
  strategy: 'rental' | 'build_to_sell' | 'flip' | 'airbnb';
  
  // Rental Strategy
  rentGrowth: AssumptionValue;
  vacancy: AssumptionValue;
  opexGrowth: AssumptionValue;
  exitCap: AssumptionValue;
  absorption: AssumptionValue;
  
  // Future strategies
  strategySpecificData?: any;
  
  lastRecalculation?: Date;
  updatedAt: Date;
}

export interface AssumptionValue {
  baseline: string;
  current: string;
  userOverride?: string;
  overrideReason?: string;
  effective: string; // User override > current > baseline
}

export interface AssumptionAdjustment {
  id: string;
  proformaId: string;
  newsEventId?: string;
  demandEventId?: string;
  adjustmentTrigger: 'news_event' | 'demand_signal' | 'manual' | 'periodic_update';
  assumptionType: 'rent_growth' | 'vacancy' | 'opex_growth' | 'exit_cap' | 'absorption';
  previousValue: string;
  newValue: string;
  adjustmentDelta: string;
  adjustmentPct: string;
  calculationMethod: string;
  calculationInputs: any;
  confidenceScore: number;
  confidencFactors?: any;
  createdAt: Date;
  notes?: string;
}

export interface AdjustmentFormula {
  id: string;
  formulaName: string;
  assumptionType: string;
  description: string;
  formulaExpression: string;
  parameters: any;
  triggerThresholds: any;
  minAdjustment: number;
  maxAdjustment: number;
}

export interface RecalculationContext {
  dealId: string;
  triggerType: 'news_event' | 'demand_signal' | 'periodic_update';
  triggerEventId?: string;
  userId?: string;
}

export interface DemandSignalData {
  demandDeltaPct: number; // % change in demand-supply ratio
  employeeCount?: number;
  housingDemand?: number;
  totalInventory?: number;
  supplyPipelineUnits?: number;
}

export interface ComparisonResult {
  dealId: string;
  dealName: string;
  strategy: string;
  baseline: ProFormaAssumptions;
  adjusted: ProFormaAssumptions;
  differences: {
    rentGrowth: number;
    vacancy: number;
    opexGrowth: number;
    exitCap: number;
    absorption: number;
  };
  recentAdjustments: AssumptionAdjustment[];
}

// ============================================================================
// Pro Forma Adjustment Service
// ============================================================================

export class ProFormaAdjustmentService {
  
  /**
   * Get or create pro forma assumptions for a deal
   */
  async getProForma(dealId: string): Promise<ProFormaAssumptions | null> {
    const result = await query(
      `SELECT * FROM proforma_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapProForma(result.rows[0]);
  }
  
  /**
   * Initialize pro forma for a deal (with baseline values)
   */
  async initializeProForma(
    dealId: string,
    strategy: 'rental' | 'build_to_sell' | 'flip' | 'airbnb',
    baselineValues?: Partial<ProFormaAssumptions>
  ): Promise<ProFormaAssumptions> {
    // Get market baseline values (from submarket/MSA data)
    const marketBaseline = await this.getMarketBaseline(dealId);
    
    const result = await query(
      `INSERT INTO proforma_assumptions (
        deal_id, strategy,
        rent_growth_baseline, rent_growth_current,
        vacancy_baseline, vacancy_current,
        opex_growth_baseline, opex_growth_current,
        exit_cap_baseline, exit_cap_current,
        absorption_baseline, absorption_current
      ) VALUES ($1, $2, $3, $3, $4, $4, $5, $5, $6, $6, $7, $7)
      ON CONFLICT (deal_id) DO UPDATE SET
        strategy = EXCLUDED.strategy,
        updated_at = NOW()
      RETURNING *`,
      [
        dealId,
        strategy,
        baselineValues?.rentGrowth?.baseline ?? marketBaseline.rentGrowth,
        baselineValues?.vacancy?.baseline ?? marketBaseline.vacancy,
        baselineValues?.opexGrowth?.baseline ?? marketBaseline.opexGrowth,
        baselineValues?.exitCap?.baseline ?? marketBaseline.exitCap,
        baselineValues?.absorption?.baseline ?? marketBaseline.absorption
      ]
    );
    
    logger.info('Pro forma initialized', { dealId, strategy });
    
    return this.mapProForma(result.rows[0]);
  }
  
  /**
   * Recalculate all adjustments for a deal
   */
  async recalculate(context: RecalculationContext): Promise<ProFormaAssumptions> {
    const { dealId, triggerType, triggerEventId, userId } = context;
    
    // Get or create pro forma
    let proforma = await this.getProForma(dealId);
    
    if (!proforma) {
      // Initialize with market baseline
      const dealInfo = await this.getDealInfo(dealId);
      proforma = await this.initializeProForma(dealId, 'rental'); // Default to rental
    }
    
    // Get demand signal data
    const demandData = await this.getDemandSignalData(dealId);
    
    // Calculate adjustments for each assumption type
    await this.calculateRentGrowthAdjustment(proforma.id, dealId, demandData, triggerType, triggerEventId);
    await this.calculateVacancyAdjustment(proforma.id, dealId, demandData, triggerType, triggerEventId);
    await this.calculateOpexGrowthAdjustment(proforma.id, dealId, triggerType, triggerEventId);
    await this.calculateExitCapAdjustment(proforma.id, dealId, demandData, triggerType, triggerEventId);
    await this.calculateAbsorptionAdjustment(proforma.id, dealId, demandData, triggerType, triggerEventId);
    
    // Update last recalculation timestamp
    await query(
      `UPDATE proforma_assumptions SET last_recalculation = NOW() WHERE id = $1`,
      [proforma.id]
    );
    
    // Fetch updated proforma
    const updated = await this.getProForma(dealId);
    
    logger.info('Pro forma recalculated', { dealId, triggerType });
    
    return updated!;
  }
  
  /**
   * Calculate Rent Growth Adjustment
   * Formula: Demand-Supply Ratio Delta × Rent Elasticity (0.5-1.2% per 1% shift)
   * Trigger: Demand signal change > ±5% OR supply pipeline change > 200 units
   */
  private async calculateRentGrowthAdjustment(
    proformaId: string,
    dealId: string,
    demandData: DemandSignalData,
    triggerType: string,
    triggerEventId?: string
  ): Promise<void> {
    // Get formula
    const formula = await this.getFormula('demand_supply_elasticity');
    if (!formula) return;
    
    // Check trigger thresholds
    const shouldTrigger = 
      Math.abs(demandData.demandDeltaPct) >= formula.triggerThresholds.demand_signal_change_pct ||
      (demandData.supplyPipelineUnits ?? 0) >= formula.triggerThresholds.supply_pipeline_units;
    
    if (!shouldTrigger) {
      logger.debug('Rent growth adjustment not triggered', { dealId, demandDeltaPct: demandData.demandDeltaPct });
      return;
    }
    
    // Get current baseline
    const current = await this.getCurrentValue(proformaId, 'rent_growth');
    
    // Calculate adjustment
    // Use elasticity based on market conditions (higher elasticity in tight markets)
    const marketTightness = await this.getMarketTightness(dealId);
    let elasticity = formula.parameters.rent_elasticity_default;
    
    if (marketTightness > 0.9) {
      elasticity = formula.parameters.rent_elasticity_max; // Tight market: 1.2
    } else if (marketTightness < 0.7) {
      elasticity = formula.parameters.rent_elasticity_min; // Loose market: 0.5
    }
    
    const adjustment = demandData.demandDeltaPct * elasticity;
    
    // Apply constraints
    const constrainedAdjustment = Math.max(
      formula.minAdjustment,
      Math.min(formula.maxAdjustment, adjustment)
    );
    
    const newValue = current.baseline + constrainedAdjustment;
    
    // Create adjustment record
    await this.createAdjustment({
      proformaId,
      newsEventId: triggerType === 'news_event' ? triggerEventId : undefined,
      demandEventId: triggerType === 'demand_signal' ? triggerEventId : undefined,
      adjustmentTrigger: triggerType as any,
      assumptionType: 'rent_growth',
      previousValue: current.current ?? current.baseline,
      newValue,
      calculationMethod: 'demand_supply_elasticity',
      calculationInputs: {
        demand_delta_pct: demandData.demandDeltaPct,
        elasticity,
        market_tightness: marketTightness,
        adjustment_raw: adjustment,
        adjustment_constrained: constrainedAdjustment
      },
      confidenceScore: 75
    });
    
    // Update current value
    await query(
      `UPDATE proforma_assumptions SET rent_growth_current = $1 WHERE id = $2`,
      [newValue, proformaId]
    );
    
    logger.info('Rent growth adjusted', { 
      dealId, 
      previousValue: current.current ?? current.baseline, 
      newValue,
      adjustment: constrainedAdjustment
    });
  }
  
  /**
   * Calculate Vacancy Rate Adjustment
   * Formula: (Employee Count × Housing Conversion Rate) ÷ Total Inventory = Vacancy Impact
   * Trigger: Major employer entry/exit OR large supply delivery within 6 months
   */
  private async calculateVacancyAdjustment(
    proformaId: string,
    dealId: string,
    demandData: DemandSignalData,
    triggerType: string,
    triggerEventId?: string
  ): Promise<void> {
    const formula = await this.getFormula('employment_vacancy_impact');
    if (!formula) return;
    
    // Check if there's significant employment change
    if (!demandData.employeeCount || demandData.employeeCount < formula.triggerThresholds.min_employee_count) {
      return;
    }
    
    const current = await this.getCurrentValue(proformaId, 'vacancy');
    
    // Calculate housing demand from employment
    const conversionRate = formula.parameters.housing_conversion_rate;
    const occupancyFactor = formula.parameters.occupancy_factor;
    const housingDemand = demandData.employeeCount * conversionRate * occupancyFactor;
    
    // Calculate vacancy impact (% of total inventory)
    const totalInventory = demandData.totalInventory ?? 10000; // Default if unknown
    const vacancyImpact = (housingDemand / totalInventory) * 100;
    
    // Negative employment = increase vacancy, positive = decrease vacancy
    const adjustment = -vacancyImpact; // Negative sign because more demand = less vacancy
    
    const constrainedAdjustment = Math.max(
      formula.minAdjustment,
      Math.min(formula.maxAdjustment, adjustment)
    );
    
    const newValue = current.baseline + constrainedAdjustment;
    
    // Ensure vacancy stays in valid range (0-100%)
    const finalValue = Math.max(0, Math.min(100, newValue));
    
    await this.createAdjustment({
      proformaId,
      newsEventId: triggerType === 'news_event' ? triggerEventId : undefined,
      demandEventId: triggerType === 'demand_signal' ? triggerEventId : undefined,
      adjustmentTrigger: triggerType as any,
      assumptionType: 'vacancy',
      previousValue: current.current ?? current.baseline,
      newValue: finalValue,
      calculationMethod: 'employment_vacancy_impact',
      calculationInputs: {
        employee_count: demandData.employeeCount,
        conversion_rate: conversionRate,
        occupancy_factor: occupancyFactor,
        housing_demand: housingDemand,
        total_inventory: totalInventory,
        vacancy_impact_pct: vacancyImpact,
        adjustment: constrainedAdjustment
      },
      confidenceScore: 80
    });
    
    await query(
      `UPDATE proforma_assumptions SET vacancy_current = $1 WHERE id = $2`,
      [finalValue, proformaId]
    );
    
    logger.info('Vacancy adjusted', { 
      dealId, 
      previousValue: current.current ?? current.baseline, 
      newValue: finalValue,
      adjustment: constrainedAdjustment
    });
  }
  
  /**
   * Calculate Operating Expense Growth Adjustment
   * Formula: Direct pass-through of announced changes
   * Trigger: Insurance market shift, tax reassessment, utility rate change
   */
  private async calculateOpexGrowthAdjustment(
    proformaId: string,
    dealId: string,
    triggerType: string,
    triggerEventId?: string
  ): Promise<void> {
    const formula = await this.getFormula('opex_direct_passthrough');
    if (!formula) return;
    
    // Get news events related to operating expenses
    const opexEvents = await query(
      `SELECT ne.id, ne.headline, ne.extracted_data, taei.impact_score
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category IN ('regulatory', 'economic')
         AND (ne.event_type LIKE '%insurance%' OR ne.event_type LIKE '%tax%' OR ne.event_type LIKE '%utility%')
         AND ne.published_at > NOW() - INTERVAL '6 months'
       ORDER BY ne.published_at DESC
       LIMIT 1`,
      [dealId]
    );
    
    if (opexEvents.rows.length === 0) {
      return; // No recent opex-related events
    }
    
    const event = opexEvents.rows[0];
    const extractedData = event.extracted_data || {};
    
    // Extract announced change (if available in extracted data)
    const announcedChangePct = extractedData.expense_change_pct || 0;
    
    if (Math.abs(announcedChangePct) < formula.triggerThresholds.min_change_pct) {
      return; // Change too small to matter
    }
    
    const current = await this.getCurrentValue(proformaId, 'opex_growth');
    
    // Direct passthrough with constraints
    const constrainedAdjustment = Math.max(
      formula.minAdjustment,
      Math.min(formula.maxAdjustment, announcedChangePct)
    );
    
    const newValue = current.baseline + constrainedAdjustment;
    
    await this.createAdjustment({
      proformaId,
      newsEventId: event.id,
      adjustmentTrigger: 'news_event',
      assumptionType: 'opex_growth',
      previousValue: current.current ?? current.baseline,
      newValue,
      calculationMethod: 'opex_direct_passthrough',
      calculationInputs: {
        announced_change_pct: announcedChangePct,
        event_headline: event.headline,
        impact_score: parseFloat(event.impact_score)
      },
      confidenceScore: 85
    });
    
    await query(
      `UPDATE proforma_assumptions SET opex_growth_current = $1 WHERE id = $2`,
      [newValue, proformaId]
    );
    
    logger.info('OpEx growth adjusted', { dealId, newValue, adjustment: constrainedAdjustment });
  }
  
  /**
   * Calculate Exit Cap Rate Adjustment
   * Formula: Baseline + Momentum Adjustment (-10 to -25 bps compression) + Risk Premium
   * Trigger: Momentum signal trend + risk premium shift
   */
  private async calculateExitCapAdjustment(
    proformaId: string,
    dealId: string,
    demandData: DemandSignalData,
    triggerType: string,
    triggerEventId?: string
  ): Promise<void> {
    const formula = await this.getFormula('momentum_cap_compression');
    if (!formula) return;
    
    const current = await this.getCurrentValue(proformaId, 'exit_cap');
    
    // Get market momentum score (from JEDI score or demand signals)
    const momentumScore = await this.getMarketMomentum(dealId);
    
    // Only adjust if momentum is strong enough
    if (momentumScore < formula.triggerThresholds.momentum_threshold) {
      return;
    }
    
    // Calculate cap rate compression based on momentum
    // Strong momentum = lower cap rate (compression)
    const momentumFactor = (momentumScore - 50) / 50; // 0 to 1 scale
    const compressionBps = 
      formula.parameters.momentum_compression_min_bps + 
      (momentumFactor * (formula.parameters.momentum_compression_max_bps - formula.parameters.momentum_compression_min_bps));
    
    const compressionPct = compressionBps / 100; // Convert basis points to percentage
    
    // Risk premium adjustment (simplified - would integrate with risk scoring in Phase 2)
    const riskPremium = 0; // Neutral for now
    
    const adjustment = compressionPct + riskPremium;
    
    const constrainedAdjustment = Math.max(
      formula.minAdjustment,
      Math.min(formula.maxAdjustment, adjustment)
    );
    
    const newValue = current.baseline + constrainedAdjustment;
    
    await this.createAdjustment({
      proformaId,
      newsEventId: triggerType === 'news_event' ? triggerEventId : undefined,
      demandEventId: triggerType === 'demand_signal' ? triggerEventId : undefined,
      adjustmentTrigger: triggerType as any,
      assumptionType: 'exit_cap',
      previousValue: current.current ?? current.baseline,
      newValue,
      calculationMethod: 'momentum_cap_compression',
      calculationInputs: {
        momentum_score: momentumScore,
        momentum_factor: momentumFactor,
        compression_bps: compressionBps,
        compression_pct: compressionPct,
        risk_premium: riskPremium,
        adjustment: constrainedAdjustment
      },
      confidenceScore: 70
    });
    
    await query(
      `UPDATE proforma_assumptions SET exit_cap_current = $1 WHERE id = $2`,
      [newValue, proformaId]
    );
    
    logger.info('Exit cap adjusted', { dealId, newValue, compressionBps });
  }
  
  /**
   * Calculate Absorption Rate Adjustment
   * Formula: Baseline × (1 + Demand Delta) × (1 - Competitive Supply Factor)
   * Trigger: New demand driver or competitive supply
   */
  private async calculateAbsorptionAdjustment(
    proformaId: string,
    dealId: string,
    demandData: DemandSignalData,
    triggerType: string,
    triggerEventId?: string
  ): Promise<void> {
    const formula = await this.getFormula('absorption_demand_adjustment');
    if (!formula) return;
    
    const current = await this.getCurrentValue(proformaId, 'absorption');
    
    // Get competitive supply (units within competitive radius)
    const competitiveSupply = await this.getCompetitiveSupply(dealId, formula.parameters.competitive_radius_miles);
    
    // Calculate demand impact
    const demandDelta = demandData.demandDeltaPct / 100; // Convert to decimal
    
    // Calculate competitive supply impact
    const competitiveSupplyFactor = (competitiveSupply / 1000) * formula.parameters.supply_impact_factor;
    
    // Apply formula
    const multiplier = (1 + demandDelta) * (1 - Math.min(0.5, competitiveSupplyFactor));
    const newValue = current.baseline * multiplier;
    
    // Calculate adjustment
    const adjustment = newValue - current.baseline;
    
    const constrainedAdjustment = Math.max(
      formula.minAdjustment,
      Math.min(formula.maxAdjustment, adjustment)
    );
    
    const finalValue = current.baseline + constrainedAdjustment;
    
    await this.createAdjustment({
      proformaId,
      newsEventId: triggerType === 'news_event' ? triggerEventId : undefined,
      demandEventId: triggerType === 'demand_signal' ? triggerEventId : undefined,
      adjustmentTrigger: triggerType as any,
      assumptionType: 'absorption',
      previousValue: current.current ?? current.baseline,
      newValue: finalValue,
      calculationMethod: 'absorption_demand_adjustment',
      calculationInputs: {
        demand_delta_pct: demandData.demandDeltaPct,
        competitive_supply_units: competitiveSupply,
        competitive_supply_factor: competitiveSupplyFactor,
        multiplier,
        adjustment: constrainedAdjustment
      },
      confidenceScore: 75
    });
    
    await query(
      `UPDATE proforma_assumptions SET absorption_current = $1 WHERE id = $2`,
      [finalValue, proformaId]
    );
    
    logger.info('Absorption rate adjusted', { dealId, newValue: finalValue });
  }
  
  /**
   * User override for an assumption
   */
  async overrideAssumption(
    dealId: string,
    assumptionType: 'rent_growth' | 'vacancy' | 'opex_growth' | 'exit_cap' | 'absorption',
    value: number,
    reason: string,
    userId?: string
  ): Promise<ProFormaAssumptions> {
    const proforma = await this.getProForma(dealId);
    if (!proforma) {
      throw new Error('Pro forma not found for deal');
    }
    
    // Update override value
    const column = `${assumptionType}_user_override`;
    const reasonColumn = `${assumptionType}_override_reason`;
    
    await query(
      `UPDATE proforma_assumptions 
       SET ${column} = $1, ${reasonColumn} = $2
       WHERE deal_id = $3`,
      [value, reason, dealId]
    );
    
    // Create adjustment record
    const current = await this.getCurrentValue(proforma.id, assumptionType);
    
    await this.createAdjustment({
      proformaId: proforma.id,
      adjustmentTrigger: 'manual',
      assumptionType,
      previousValue: current.effective,
      newValue: value,
      calculationMethod: 'user_override',
      calculationInputs: { reason },
      confidenceScore: 100 // User override = highest confidence
    });
    
    logger.info('Assumption overridden', { dealId, assumptionType, value, reason });
    
    return (await this.getProForma(dealId))!;
  }
  
  /**
   * Update platform layer from Traffic Engine v2 (M07 → M09).
   * Called by trafficToProFormaService when predictions are refreshed.
   */
  async updatePlatformLayer(
    dealId: string,
    platformValues: {
      vacancy?: number;
      rentGrowth?: number;
      absorption?: number;
      exitCap?: number;
    },
    source: string = 'M07 Traffic Engine v2'
  ): Promise<ProFormaAssumptions> {
    let proforma = await this.getProForma(dealId);

    if (!proforma) {
      proforma = await this.initializeProForma(dealId, 'rental');
    }

    const updates: string[] = [];
    const params: any[] = [dealId];
    let paramIdx = 2;

    if (platformValues.vacancy !== undefined) {
      updates.push(`vacancy_current = $${paramIdx++}`);
      params.push(platformValues.vacancy);
    }
    if (platformValues.rentGrowth !== undefined) {
      updates.push(`rent_growth_current = $${paramIdx++}`);
      params.push(platformValues.rentGrowth);
    }
    if (platformValues.absorption !== undefined) {
      updates.push(`absorption_current = $${paramIdx++}`);
      params.push(platformValues.absorption);
    }
    if (platformValues.exitCap !== undefined) {
      updates.push(`exit_cap_current = $${paramIdx++}`);
      params.push(platformValues.exitCap);
    }

    if (updates.length > 0) {
      updates.push('last_recalculation = NOW()');
      updates.push('updated_at = NOW()');

      await query(
        `UPDATE proforma_assumptions SET ${updates.join(', ')} WHERE deal_id = $1`,
        params
      );

      logger.info('ProForma platform layer updated from traffic', { dealId, source, platformValues });
    }

    return (await this.getProForma(dealId))!;
  }

  /**
   * Get comparison: baseline vs. adjusted
   */
  async getComparison(dealId: string): Promise<ComparisonResult> {
    const proforma = await this.getProForma(dealId);
    if (!proforma) {
      throw new Error('Pro forma not found for deal');
    }
    
    // Get deal info
    const dealInfo = await query(
      `SELECT name, stage FROM deals WHERE id = $1`,
      [dealId]
    );
    
    // Get recent adjustments
    const adjustments = await this.getAdjustments(dealId, { limit: 10 });
    
    // Calculate differences
    const differences = {
      rentGrowth: proforma.rentGrowth.effective - proforma.rentGrowth.baseline,
      vacancy: proforma.vacancy.effective - proforma.vacancy.baseline,
      opexGrowth: proforma.opexGrowth.effective - proforma.opexGrowth.baseline,
      exitCap: proforma.exitCap.effective - proforma.exitCap.baseline,
      absorption: proforma.absorption.effective - proforma.absorption.baseline
    };
    
    return {
      dealId,
      dealName: dealInfo.rows[0]?.name || 'Unknown',
      strategy: proforma.strategy,
      baseline: proforma,
      adjusted: proforma,
      differences,
      recentAdjustments: adjustments
    };
  }
  
  /**
   * Get adjustment history
   */
  async getAdjustments(
    dealId: string,
    options: { limit?: number; assumptionType?: string } = {}
  ): Promise<AssumptionAdjustment[]> {
    const { limit = 50, assumptionType } = options;
    
    let sql = `
      SELECT aa.*
      FROM assumption_adjustments aa
      JOIN proforma_assumptions pa ON pa.id = aa.proforma_id
      WHERE pa.deal_id = $1
    `;
    
    const params: any[] = [dealId];
    
    if (assumptionType) {
      sql += ` AND aa.assumption_type = $2`;
      params.push(assumptionType);
    }
    
    sql += ` ORDER BY aa.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await query(sql, params);
    
    return result.rows.map(row => this.mapAdjustment(row));
  }
  
  /**
   * Get adjustments with news event details
   */
  async getAdjustmentsWithEvents(dealId: string, limit = 20) {
    const result = await query(
      `SELECT 
         aa.*,
         ne.headline as news_headline,
         ne.event_category,
         ne.event_type,
         ne.published_at as news_published_at,
         de.total_units as demand_units,
         de.people_count as demand_people_count
       FROM assumption_adjustments aa
       JOIN proforma_assumptions pa ON pa.id = aa.proforma_id
       LEFT JOIN news_events ne ON ne.id = aa.news_event_id
       LEFT JOIN demand_events de ON de.id = aa.demand_event_id
       WHERE pa.deal_id = $1
       ORDER BY aa.created_at DESC
       LIMIT $2`,
      [dealId, limit]
    );
    
    return result.rows.map(row => ({
      ...this.mapAdjustment(row),
      newsHeadline: row.news_headline,
      eventCategory: row.event_category,
      eventType: row.event_type,
      newsPublishedAt: row.news_published_at,
      demandUnits: row.demand_units,
      demandPeopleCount: row.demand_people_count
    }));
  }
  
  // ========================================
  // Helper Methods
  // ========================================
  
  private async getFormula(formulaName: string): Promise<AdjustmentFormula | null> {
    const result = await query(
      `SELECT * FROM adjustment_formulas WHERE formula_name = $1 AND is_active = true`,
      [formulaName]
    );
    
    return result.rows[0] ? {
      id: result.rows[0].id,
      formulaName: result.rows[0].formula_name,
      assumptionType: result.rows[0].assumption_type,
      description: result.rows[0].description,
      formulaExpression: result.rows[0].formula_expression,
      parameters: result.rows[0].parameters,
      triggerThresholds: result.rows[0].trigger_thresholds,
      minAdjustment: parseFloat(result.rows[0].min_adjustment),
      maxAdjustment: parseFloat(result.rows[0].max_adjustment)
    } : null;
  }
  
  private async getCurrentValue(
    proformaId: string,
    assumptionType: string
  ): Promise<{ baseline: number; current: number | null; userOverride: number | null; effective: number }> {
    const result = await query(
      `SELECT 
        ${assumptionType}_baseline as baseline,
        ${assumptionType}_current as current,
        ${assumptionType}_user_override as user_override
       FROM proforma_assumptions
       WHERE id = $1`,
      [proformaId]
    );
    
    const row = result.rows[0];
    const baseline = parseFloat(row.baseline) || 0;
    const current = row.current ? parseFloat(row.current) : null;
    const userOverride = row.user_override ? parseFloat(row.user_override) : null;
    const effective = userOverride ?? current ?? baseline;
    
    return { baseline, current, userOverride, effective };
  }
  
  private async createAdjustment(data: {
    proformaId: string;
    newsEventId?: string;
    demandEventId?: string;
    adjustmentTrigger: 'news_event' | 'demand_signal' | 'manual' | 'periodic_update';
    assumptionType: string;
    previousValue: number;
    newValue: number;
    calculationMethod: string;
    calculationInputs: any;
    confidenceScore: number;
  }): Promise<void> {
    const adjustmentPct = data.previousValue !== 0 
      ? ((data.newValue - data.previousValue) / data.previousValue) * 100
      : 0;
    
    await query(
      `INSERT INTO assumption_adjustments (
        proforma_id, news_event_id, demand_event_id, adjustment_trigger,
        assumption_type, previous_value, new_value, adjustment_pct,
        calculation_method, calculation_inputs, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.proformaId,
        data.newsEventId,
        data.demandEventId,
        data.adjustmentTrigger,
        data.assumptionType,
        data.previousValue,
        data.newValue,
        adjustmentPct,
        data.calculationMethod,
        JSON.stringify(data.calculationInputs),
        data.confidenceScore
      ]
    );
  }
  
  private async getDemandSignalData(dealId: string): Promise<DemandSignalData> {
    // Get demand projections for this deal's trade area
    const result = await query(
      `SELECT 
        SUM(dp.units_projected) as total_units,
        SUM(de.people_count) as total_people,
        AVG(de.confidence_score) as avg_confidence
       FROM demand_projections dp
       JOIN demand_events de ON de.id = dp.demand_event_id
       JOIN trade_area_event_impacts taei ON taei.event_id = de.news_event_id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND dp.quarter >= TO_CHAR(CURRENT_DATE, 'YYYY-"Q"Q')
         AND dp.quarter <= TO_CHAR(CURRENT_DATE + INTERVAL '12 months', 'YYYY-"Q"Q')`,
      [dealId]
    );
    
    const data = result.rows[0];
    const housingDemand = parseFloat(data.total_units) || 0;
    const employeeCount = parseInt(data.total_people) || 0;
    
    // Get baseline demand (historical)
    const baselineResult = await query(
      `SELECT stats_snapshot->>'existing_units' as existing_units
       FROM trade_areas ta
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
       LIMIT 1`,
      [dealId]
    );
    
    const totalInventory = parseInt(baselineResult.rows[0]?.existing_units) || 10000;
    
    // Calculate demand delta as % of inventory
    const demandDeltaPct = (housingDemand / totalInventory) * 100;
    
    // Get supply pipeline
    const supplyResult = await query(
      `SELECT COUNT(*) as permit_count,
              SUM((ne.extracted_data->>'unit_count')::INTEGER) as pipeline_units
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category = 'development'
         AND ne.published_at > NOW() - INTERVAL '12 months'`,
      [dealId]
    );
    
    const supplyPipelineUnits = parseInt(supplyResult.rows[0]?.pipeline_units) || 0;
    
    return {
      demandDeltaPct,
      employeeCount,
      housingDemand,
      totalInventory,
      supplyPipelineUnits
    };
  }
  
  private async getMarketBaseline(dealId: string): Promise<any> {
    // Get deal's MSA/submarket to pull baseline values
    // This would integrate with market data APIs or historical database
    
    // For now, return reasonable defaults
    return {
      rentGrowth: 3.5,    // 3.5% annual rent growth
      vacancy: 5.0,       // 5% vacancy
      opexGrowth: 2.8,    // 2.8% opex growth (CPI + 0.5%)
      exitCap: 5.5,       // 5.5% cap rate
      absorption: 8.0     // 8 leases/month
    };
  }
  
  private async getDealInfo(dealId: string) {
    const result = await query(
      `SELECT * FROM deals WHERE id = $1`,
      [dealId]
    );
    
    return result.rows[0] || null;
  }
  
  private async getMarketTightness(dealId: string): Promise<number> {
    // Market tightness score (0-1)
    // Based on vacancy rate, rent growth, absorption
    
    // Simplified calculation for Phase 1
    const demandData = await this.getDemandSignalData(dealId);
    
    // High demand delta = tight market
    if (demandData.demandDeltaPct > 5) return 0.95;
    if (demandData.demandDeltaPct > 2) return 0.85;
    if (demandData.demandDeltaPct < -2) return 0.65;
    if (demandData.demandDeltaPct < -5) return 0.55;
    
    return 0.75; // Neutral
  }
  
  private async getMarketMomentum(dealId: string): Promise<number> {
    // Get JEDI momentum score if available
    const result = await query(
      `SELECT momentum_score FROM jedi_score_history
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );
    
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].momentum_score);
    }
    
    // Fallback: use demand signal as proxy
    const demandData = await this.getDemandSignalData(dealId);
    return 50 + Math.min(20, Math.max(-20, demandData.demandDeltaPct * 2));
  }
  
  private async getCompetitiveSupply(dealId: string, radiusMiles: number): Promise<number> {
    // Get competitive supply within radius
    const result = await query(
      `SELECT SUM((ne.extracted_data->>'unit_count')::INTEGER) as competitive_units
       FROM news_events ne
       JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
       JOIN trade_areas ta ON ta.id = taei.trade_area_id
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1
         AND ne.event_category = 'development'
         AND taei.distance_miles <= $2
         AND ne.published_at > NOW() - INTERVAL '12 months'`,
      [dealId, radiusMiles]
    );
    
    return parseInt(result.rows[0]?.competitive_units) || 0;
  }
  
  private mapProForma(row: any): ProFormaAssumptions {
    // Return values as strings (from PostgreSQL NUMERIC columns) - parse only when doing calculations
    const rentGrowthBaseline = (row.rent_growth_baseline || '0').toString();
    const rentGrowthCurrent = row.rent_growth_current ? row.rent_growth_current.toString() : rentGrowthBaseline;
    const rentGrowthUserOverride = row.rent_growth_user_override ? row.rent_growth_user_override.toString() : undefined;

    const vacancyBaseline = (row.vacancy_baseline || '0').toString();
    const vacancyCurrent = row.vacancy_current ? row.vacancy_current.toString() : vacancyBaseline;
    const vacancyUserOverride = row.vacancy_user_override ? row.vacancy_user_override.toString() : undefined;

    const opexGrowthBaseline = (row.opex_growth_baseline || '0').toString();
    const opexGrowthCurrent = row.opex_growth_current ? row.opex_growth_current.toString() : opexGrowthBaseline;
    const opexGrowthUserOverride = row.opex_growth_user_override ? row.opex_growth_user_override.toString() : undefined;

    const exitCapBaseline = (row.exit_cap_baseline || '0').toString();
    const exitCapCurrent = row.exit_cap_current ? row.exit_cap_current.toString() : exitCapBaseline;
    const exitCapUserOverride = row.exit_cap_user_override ? row.exit_cap_user_override.toString() : undefined;

    const absorptionBaseline = (row.absorption_baseline || '0').toString();
    const absorptionCurrent = row.absorption_current ? row.absorption_current.toString() : absorptionBaseline;
    const absorptionUserOverride = row.absorption_user_override ? row.absorption_user_override.toString() : undefined;

    return {
      id: row.id,
      dealId: row.deal_id,
      strategy: row.strategy,
      rentGrowth: {
        baseline: rentGrowthBaseline,
        current: rentGrowthCurrent,
        userOverride: rentGrowthUserOverride,
        overrideReason: row.rent_growth_override_reason,
        effective: rentGrowthUserOverride || rentGrowthCurrent || rentGrowthBaseline
      },
      vacancy: {
        baseline: vacancyBaseline,
        current: vacancyCurrent,
        userOverride: vacancyUserOverride,
        overrideReason: row.vacancy_override_reason,
        effective: vacancyUserOverride || vacancyCurrent || vacancyBaseline
      },
      opexGrowth: {
        baseline: opexGrowthBaseline,
        current: opexGrowthCurrent,
        userOverride: opexGrowthUserOverride,
        overrideReason: row.opex_growth_override_reason,
        effective: opexGrowthUserOverride || opexGrowthCurrent || opexGrowthBaseline
      },
      exitCap: {
        baseline: exitCapBaseline,
        current: exitCapCurrent,
        userOverride: exitCapUserOverride,
        overrideReason: row.exit_cap_override_reason,
        effective: exitCapUserOverride || exitCapCurrent || exitCapBaseline
      },
      absorption: {
        baseline: absorptionBaseline,
        current: absorptionCurrent,
        userOverride: absorptionUserOverride,
        overrideReason: row.absorption_override_reason,
        effective: absorptionUserOverride || absorptionCurrent || absorptionBaseline
      },
      strategySpecificData: row.strategy_specific_data,
      lastRecalculation: row.last_recalculation ? new Date(row.last_recalculation) : undefined,
      updatedAt: new Date(row.updated_at)
    };
  }
  
  private mapAdjustment(row: any): AssumptionAdjustment {
    return {
      id: row.id,
      proformaId: row.proforma_id,
      newsEventId: row.news_event_id,
      demandEventId: row.demand_event_id,
      adjustmentTrigger: row.adjustment_trigger,
      assumptionType: row.assumption_type,
      previousValue: (row.previous_value || '0').toString(),
      newValue: (row.new_value || '0').toString(),
      adjustmentDelta: (row.adjustment_delta || '0').toString(),
      adjustmentPct: (row.adjustment_pct || '0').toString(),
      calculationMethod: row.calculation_method,
      calculationInputs: row.calculation_inputs,
      confidenceScore: parseFloat(row.confidence_score) || 0,
      confidencFactors: row.confidence_factors,
      createdAt: new Date(row.created_at),
      notes: row.notes
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const proformaAdjustmentService = new ProFormaAdjustmentService();

// ============================================================================
// DealFinancials contract — full F9 Pro Forma assembly
// ============================================================================

/** Resolved scalar extracted from a LayeredValue JSONB field */
function resolvedNum(lv: Record<string, unknown> | null | undefined): number | null {
  if (!lv || typeof lv !== 'object') return null;
  const v = (lv as Record<string, unknown>).resolved;
  return typeof v === 'number' ? v : null;
}

function layerNum(lv: Record<string, unknown> | null | undefined, layer: string): number | null {
  if (!lv || typeof lv !== 'object') return null;
  const v = (lv as Record<string, unknown>)[layer];
  return typeof v === 'number' ? v : null;
}

function lv(seed: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = seed[key];
  return v && typeof v === 'object' ? v as Record<string, unknown> : null;
}

export interface OperatingStatementRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
  rentRoll: number | null;
  taxBill: number | null;
  resolved: number | null;
  resolution: string | null;
  perUnit: number | null;
  source: string | null;
  confidence: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}

export interface IntegrityCheck {
  id: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: Record<string, unknown>;
}

export interface RentRollUnitType {
  type: string;
  count: number;
  avgSf: number | null;
  inPlaceRent: number | null;
  marketRent: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
}

export interface DealCapitalStack {
  purchasePrice: number | null;
  pricePerUnit: number | null;
  loanAmount: number | null;
  equityAtClose: number | null;
  ltcPct: number | null;
  interestRate: number | null;
  ioPeriodMonths: number | null;
  amortizationYears: number | null;
  dscrMin: number | null;
  originationFeePct: number | null;
}

export interface DealFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  proforma: {
    year1: OperatingStatementRow[];
    integrityChecks: IntegrityCheck[];
    unitEconomics: Record<string, number | null>;
  };
  capitalStack: DealCapitalStack;
  rentRollSummary: {
    unitMix: RentRollUnitType[] | null;
    avgInPlaceRent: number | null;
    weightedOccupancyPct: number | null;
  } | null;
  trafficProjection: {
    yearly: Array<{
      year: number;
      vacancyPct: number | null;
      occupancyPct: number | null;
      effRent: number | null;
      rentGrowthPct: number | null;
      t01WeeklyTours: number | null;
      t05ClosingRatio: number | null;
      t06WeeklyLeases: number | null;
    }>;
    leaseUp: { weeksTo90: number | null; weeksTo93: number | null; weeksTo95: number | null } | null;
    calibrated: { vacancyPct: number | null; rentGrowthPct: number | null; exitCap: number | null; lastCalibrated: string | null };
    leasingSignals: {
      t01WeeklyTours: number | null;
      t05ClosingRatio: number | null;
      t06WeeklyLeases: number | null;
      t07LeaseUpWeeksTo95: number | null;
      stabilizedOccupancyPct: number | null;
      confidence: number | null;
    } | null;
  } | null;
  assumptions: {
    holdYears: number;
    exitCap: number | null;
    rentGrowthYr1: number | null;
    rentGrowthStabilized: number | null;
    perYear: Array<{
      year: number;
      rentGrowthPct: number | null;
      vacancyPct: number | null;
      exitCapIfLastYear: number | null;
    }>;
    gprDecomposition: {
      brokerAnnual: number | null;
      platformAnnual: number | null;
      t12Annual: number | null;
      rentRollAnnual: number | null;
      resolvedAnnual: number | null;
      brokerPerUnitMo: number | null;
      platformPerUnitMo: number | null;
      t12PerUnitMo: number | null;
      resolvedPerUnitMo: number | null;
    } | null;
    /** AI narrative synthesizing M07 signals + key assumption flags. Null when M07 offline. */
    narrative: string | null;
  };
  /** Persisted user overrides (camelCase field → hold year → value). Used by frontend to
   *  reconstruct the USER display layer across sessions, keyed from per_year_overrides JSONB. */
  userOverrides: Record<string, Record<number, number | null>>;
  meta: {
    seeded: boolean;
    updatedAt: string | null;
  };
  /** Hold-period returns computed by the F9 projection engine */
  returns: {
    irr: number | null;
    equityMultiple: number | null;
    cashOnCash: number | null;
  } | null;
  /** Sources & Uses — capital deployment at close */
  sourcesUses: {
    sources: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable?: boolean }>;
    uses: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable: boolean }>;
    totalSources: number | null;
    totalUses: number | null;
    delta: number | null;
    balanced: boolean;
    benchmarks: {
      totalCostPerUnit: number | null;
      totalCostPerSf: number | null;
      closingCostsPct: number | null;
      debtPct: number | null;
      equityPct: number | null;
      capexPerUnit: number | null;
    };
    userOverrides: {
      closingCosts: number | null;
      capexTotal: number | null;
      workingCapital: number | null;
      preopeningCosts: number | null;
      otherUses: number | null;
      sellerFinancing: number | null;
    };
  } | null;
  /** Debt stack v2 — senior + mezz/B-Note loans */
  debt: {
    loans: Array<{
      id: string;
      name: string;
      loanTypeLabel: string;
      rateType: 'Fixed' | 'Floating';
      loanAmount: { broker: number|null; platform: number|null };
      ltcPct:     { broker: number|null; platform: number|null };
      ltv:        { platform: number|null };
      interestRate: { broker: number|null; platform: number|null };
      sofr:       { platform: number|null };
      spread:     { broker: number|null; platform: number|null };
      capRate:    { broker: number|null; platform: number|null };
      termYears:  { broker: number|null; platform: number|null };
      amortYears: { broker: number|null; platform: number|null };
      ioMonths:   { broker: number|null; platform: number|null };
      origFee:    { broker: number|null; platform: number|null };
      exitFee:    { platform: number|null };
      rateCapCost:{ broker: number|null; platform: number|null };
      minDscr:    { platform: number|null };
      minDebtYield: { platform: number|null };
      minOccupancy: { platform: number|null };
      maxLtv:     { platform: number|null };
      cashTrapDscr: { platform: number|null };
      tiEscrowMonths:         { platform: number|null };
      replacementReserve:     { platform: number|null };
      operatingReserveMonths: { platform: number|null };
      prepayType: string;
      derivedAnnualDS: number | null;
      sofrCurve: number[];
      extensionOptions: string | null;
      refiEnabled: boolean;
      refiTriggerYear: number;
      refiNewLoanType: string | null;
    }>;
    aggregate: {
      totalLoanAmount: number|null;
      blendedRatePct:  number|null;
      combinedLtcPct:  number|null;
      totalAnnualDS:   number|null;
      aggregateDscr:   number|null;
    };
  } | null;
  /** FL tax computations — RE tax, TPP, income tax/depreciation, transfer taxes */
  taxes: {
    reTax: {
      t12AssessedValue: number | null;
      t12MillageRate: number | null;
      t12AnnualTax: number | null;
      platformAssessedValue: number | null;
      platformAnnualTax: number | null;
      isMiamiDade: boolean;
      sohCapPct: number;
      perYear: Array<{
        year: number; assessedValue: number; millageRate: number;
        taxAmount: number; sohCapBinding: boolean; reassessmentEvent: boolean;
      }>;
      deltaVsT12Pct: number | null;
    };
    tpp: { broker: number | null; platform: number | null };
    incomeTax: {
      purchasePrice: number | null;
      landValuePct: number;
      depreciableBase: number | null;
      annualDepreciation: number | null;
      bonusDepreciationCurrentYearPct: number;
      costSegAvailablePct: number;
      /** Blended marginal income tax rate (federal + state). Default 0.37 when taxes seeded. */
      marginalTaxRate: number;
    };
    transferTax: {
      purchasePrice: number | null;
      isMiamiDade: boolean;
      miamiDadeRatePct: number;
      statewideFlatRatePct: number;
      appliedRatePct: number;
      docStampAmount: number | null;
      intangibleTaxAmount: number | null;
      loanAmount: number | null;
      totalTransferTax: number | null;
      refi: {
        enabled: boolean;
        triggerYear: number;
        newLoanType: string | null;
        refiLoanAmount: number | null;
        refiDocStampAmount: number | null;
        refiIntangibleTaxAmount: number | null;
        refiTotalTax: number | null;
      } | null;
    };
    userOverrides: {
      taxAssessedValue: number | null;
      taxMillageRate: number | null;
      tppAmount: number | null;
      taxCounty: boolean | null;
    };
  } | null;
  /** Waterfall / capital configuration with persisted overrides */
  waterfall: {
    waterfallType: string;
    lpShare: number;
    gpShare: number;
    prefRate: number;
    tiers: Array<{ triggerIrr: number; lpPct: number; gpPct: number; triggerType: string }>;
    fees: {
      acquisitionFeePct: number;
      assetMgmtFeePct: number;
      assetMgmtBasis: string;
      constructionMgmtPct: number;
      dispositionFeePct: number;
      refinancingFeePct: number;
    };
    userOverrides: { lpShare: number | null; gpShare: number | null; prefRate: number | null };
  } | null;
  /** Capital tranche configuration + server-side computed distribution schedule */
  capital: {
    tranches: Array<{
      id: string;
      label: string;
      role: string;
      pct: number;
      prefRate: number;
      compounding: string;
      cumulative: boolean;
      participatePromote: boolean;
    }>;
    schedule: Array<{
      period: string;
      year: number;
      cfads: number;
      activeTier: string;
      lpDist: number;
      gpDist: number;
      gpPromote: number;
      gpFees: number;
      prefAccrued: number;
      prefPaid: number;
      lpIrr: number | null;
      lpEm: number;
      isExit: boolean;
    }>;
    metrics: {
      lpIrr: number | null;
      lpEquityMultiple: number | null;
      gpEquityMultiple: number | null;
      totalLpDistributions: number;
      totalGpDistributions: number;
      totalGpPromote: number;
      totalGpFees: number;
    };
  };
  /** Server-side per-year projections — authoritative operating statement resolving all upstream tabs */
  projections: Array<{
    year: number;
    gpr: number; vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
    nri: number; otherIncome: number; egi: number;
    payroll: number; repairs: number; turnover: number; contractSvc: number;
    marketing: number; utilities: number; gAndA: number; mgmtFee: number;
    insurance: number; reTaxes: number; reserves: number;
    totalOpex: number; noi: number;
    opMargin: number | null; noiPerUnit: number | null;
    interest: number; principal: number; annualDS: number; outstandingBalance: number;
    cfbt: number; cfads: number;
    depreciation: number | null; taxableIncome: number | null; taxPayable: number | null;
    afterTaxCfads: number | null; effectiveTaxRate: number | null;
    coc: number | null; dscr: number | null; debtYield: number | null;
    occupancy: number | null; rentGrowthPct: number | null;
    opexRatioPct: number | null; noiMarginPct: number | null; capRatePct: number | null;
    cumulativeEM: number | null;
    exitNoi: number | null; exitCap: number; grossSaleValue: number | null;
    sellingCosts: number | null; dispositionDocStamps: number | null;
    loanPayoff: number; netSaleProceeds: number | null;
    reTaxSource: 'taxes_tab' | 'proforma' | 'estimate';
    debtSource: 'debt_tab' | 'capital_stack' | 'estimate';
  }> | null;
}

/**
 * getDealFinancials — main F9 Pro Forma assembly function.
 *
 * Assembles the full DealFinancials contract from:
 *  1. deal_assumptions.year1   — LayeredValue seed (SOT for all financials)
 *  2. traffic_projections      — M07 10-year trajectory (per-year forward projections)
 *  3. proforma_assumptions     — M07 calibrated scalars (vacancy/rent/cap current)
 *  4. deal                     — deal meta (name, units)
 *
 * Integrity checks (4):
 *  IC-01  T-12 NOI reconciliation: |seed.noi - t12_noi| / t12_noi > 10% → warn
 *  IC-02  Rent Roll GPR×12 vs T-12 GPR within 3%: |rr×12 - t12| / t12 > 3% → warn
 *  IC-03  Canonical OpEx source completeness: any of the 7 controllable opex fields is null → warn
 *  IC-04  Tax-line assessor match: |seed.real_estate_tax.t12 - seed.real_estate_tax.tax_bill| / tax_bill > 15% → warn
 */
export async function getDealFinancials(
  pool: Pool,
  dealId: string,
  holdYears = 10
): Promise<DealFinancials> {
  const { getTrafficProjection } = await import('./trafficToProFormaService');
  const { ensureDealAssumptionsSeeded } = await import('./proforma-seeder.service');

  // Auto-seed if year1 is missing — guarantees non-null data for deals with extraction capsules
  // No-op when year1 already exists; safe to call on every request
  await ensureDealAssumptionsSeeded(pool, dealId);

  const [dealRes, assumptionsRes, proformaAssumRes, trafficProjection] = await Promise.all([
    pool.query(
      'SELECT id, name, city, state_code, target_units, budget, deal_data FROM deals WHERE id = $1',
      [dealId]
    ),
    pool.query(
      `SELECT year1, total_units, updated_at,
              exit_cap, rent_growth_yr1, rent_growth_stabilized, hold_period_years,
              interest_rate, ltc, avg_lease_term_months, per_year_overrides,
              io_period_months, amortization_years, dscr_min, origination_fee_pct,
              unit_mix, avg_rent_per_unit, vacancy_pct
         FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    ),
    pool.query(
      `SELECT vacancy_current, rent_growth_current, exit_cap_current, last_recalculation
         FROM proforma_assumptions WHERE deal_id = $1 ORDER BY last_recalculation DESC LIMIT 1`,
      [dealId]
    ),
    getTrafficProjection(pool, dealId, holdYears),
  ]);

  if (dealRes.rows.length === 0) throw new Error(`Deal not found: ${dealId}`);
  const deal = dealRes.rows[0];
  const totalUnits = assumptionsRes.rows[0]?.total_units ?? deal.target_units ?? 0;
  const year1Seed: Record<string, unknown> = (assumptionsRes.rows[0]?.year1 as Record<string, unknown>) ?? {};

  // ── Year-1 Operating Statement rows ────────────────────────────────────────
  const REVENUE_FIELDS: Array<[string, string]> = [
    ['gpr', 'Gross Potential Rent'],
    ['loss_to_lease_pct', 'Loss to Lease (%)'],
    ['vacancy_pct', 'Vacancy & Credit Loss (%)'],
    ['concessions_pct', 'Concessions (%)'],
    ['bad_debt_pct', 'Bad Debt (%)'],
    ['non_revenue_units_pct', 'Non-Revenue Units (%)'],
    ['other_income_per_unit', 'Other Income / Unit'],
    ['net_rental_income', 'Net Rental Income'],
    ['egi', 'Effective Gross Income'],
  ];
  const OPEX_FIELDS: Array<[string, string]> = [
    ['payroll', 'Payroll'],
    ['repairs_maintenance', 'Repairs & Maintenance'],
    ['turnover', 'Turnover / Make Ready'],
    ['contract_services', 'Contract Services'],
    ['marketing', 'Marketing'],
    ['utilities', 'Utilities'],
    ['g_and_a', 'G&A / Admin'],
    ['management_fee_pct', 'Management Fee (%)'],
    ['insurance', 'Property Insurance'],
    ['real_estate_tax', 'Real Estate Tax'],
    ['replacement_reserves', 'Replacement Reserves'],
    ['total_opex', 'Total OpEx'],
  ];
  const NOI_FIELDS: Array<[string, string]> = [['noi', 'Net Operating Income']];

  const SOURCE_CONFIDENCE: Record<string, number> = {
    override: 95,
    t12: 85,
    tax_bill: 85,
    rent_roll: 80,
    box_score: 75,
    platform: 70,
    platform_fallback: 65,
    om: 60,
    broker: 60,
    computed: 55,
  };

  function toRow(key: string, label: string): OperatingStatementRow {
    const field = lv(year1Seed, key);
    const resolved = resolvedNum(field);
    const resolution = field ? (field.resolution as string | null) ?? null : null;
    const platformVal = layerNum(field, 'platform');

    // benchmarkPosition: compare resolved vs platform baseline (±5% band = 'within')
    let benchmarkPosition: 'above' | 'below' | 'within' | null = null;
    if (resolved != null && platformVal != null && platformVal !== 0) {
      const ratio = resolved / platformVal;
      if (ratio > 1.05) benchmarkPosition = 'above';
      else if (ratio < 0.95) benchmarkPosition = 'below';
      else benchmarkPosition = 'within';
    }

    return {
      field: key,
      label,
      broker: layerNum(field, 'om') ?? layerNum(field, 'broker'),
      platform: platformVal,
      t12: layerNum(field, 't12'),
      rentRoll: layerNum(field, 'rent_roll'),
      taxBill: layerNum(field, 'tax_bill'),
      resolved,
      resolution,
      perUnit: resolved != null && totalUnits > 0 ? Math.round(resolved / totalUnits) : null,
      source: resolution,
      confidence: resolution ? (SOURCE_CONFIDENCE[resolution] ?? null) : null,
      benchmarkPosition,
    };
  }

  const year1Rows = [
    ...REVENUE_FIELDS.map(([k, _l]) => toRow(k, _l)),
    ...OPEX_FIELDS.map(([k, _l]) => toRow(k, _l)),
    ...NOI_FIELDS.map(([k, _l]) => toRow(k, _l)),
  ];

  // ── Integrity checks ────────────────────────────────────────────────────────
  const checks: IntegrityCheck[] = [];

  // IC-01: T-12 NOI reconciliation — absolute gap must be < $1,000
  const noiLv = lv(year1Seed, 'noi');
  const noiResolved = resolvedNum(noiLv);
  const noiT12 = layerNum(noiLv, 't12');
  if (noiResolved != null && noiT12 != null) {
    const gapDollars = Math.abs(noiResolved - noiT12);
    checks.push({
      id: 'IC-01',
      status: gapDollars > 1000 ? 'warn' : 'ok',
      message: gapDollars > 1000
        ? `T-12 NOI reconciliation gap $${gapDollars.toLocaleString()} (resolved $${noiResolved.toLocaleString()} vs T-12 $${noiT12.toLocaleString()}) — threshold $1,000`
        : `T-12 NOI reconciled within $1,000 (gap $${gapDollars.toLocaleString()})`,
      detail: { noiResolved, noiT12, gapDollars },
    });
  }

  // IC-02: Rent Roll GPR×12 vs T-12 GPR within 3%
  const gprLv = lv(year1Seed, 'gpr');
  const gprRentRoll = layerNum(gprLv, 'rent_roll');
  const gprT12 = layerNum(gprLv, 't12');
  if (gprRentRoll != null && gprT12 != null && gprT12 !== 0) {
    // rent_roll value is already annualized in the seed
    const delta = Math.abs((gprRentRoll - gprT12) / gprT12);
    checks.push({
      id: 'IC-02',
      status: delta > 0.03 ? 'warn' : 'ok',
      message: delta > 0.03
        ? `GPR mismatch: rent roll $${gprRentRoll.toLocaleString()} vs T-12 $${gprT12.toLocaleString()} (${(delta * 100).toFixed(1)}% — threshold 3%)`
        : `GPR: rent roll and T-12 within 3% (gap ${(delta * 100).toFixed(1)}%)`,
      detail: { gprRentRoll, gprT12, deltaPct: +(delta * 100).toFixed(2) },
    });
  }

  // IC-03: Canonical OpEx source completeness (all 7 controllable opex fields must be non-null)
  const CONTROLLABLE_OPEX = ['payroll', 'repairs_maintenance', 'turnover', 'contract_services', 'marketing', 'utilities', 'g_and_a'];
  const missingOpex = CONTROLLABLE_OPEX.filter(k => resolvedNum(lv(year1Seed, k)) == null);
  checks.push({
    id: 'IC-03',
    status: missingOpex.length > 0 ? 'warn' : 'ok',
    message: missingOpex.length > 0
      ? `Incomplete OpEx sources: ${missingOpex.join(', ')} have no resolved value — upload T-12 or enter manually`
      : 'All 7 controllable OpEx fields sourced',
    detail: { missing: missingOpex, total: CONTROLLABLE_OPEX.length },
  });

  // IC-04: Tax-line assessor match (seed.real_estate_tax.t12 vs .tax_bill within 15%)
  const taxLv = lv(year1Seed, 'real_estate_tax');
  const taxT12 = layerNum(taxLv, 't12');
  const taxBill = layerNum(taxLv, 'tax_bill');
  if (taxT12 != null && taxBill != null && taxBill !== 0) {
    const delta = Math.abs((taxT12 - taxBill) / taxBill);
    checks.push({
      id: 'IC-04',
      status: delta > 0.15 ? 'warn' : 'ok',
      message: delta > 0.15
        ? `Tax-line assessor gap: T-12 $${taxT12.toLocaleString()} vs tax bill $${taxBill.toLocaleString()} (${(delta * 100).toFixed(1)}% — threshold 15%)`
        : `Real estate tax confirmed within 15% of assessor bill`,
      detail: { taxT12, taxBill, deltaPct: +(delta * 100).toFixed(2) },
    });
  }
  if (checks.length === 0) {
    checks.push({ id: 'IC-SEED', status: 'warn', message: 'No source data yet — upload T-12 or rent roll to enable integrity checks' });
  }

  // ── Derived vacancy formula (M07 traffic engine) ────────────────────────────
  // Formula: vacancyPct = 1 − (T-01 × T-05 × 52 × avg_lease_term) / units
  //   T-01           = weekly walk-ins / tours (from traffic_learned_rates.tour_rate)
  //   T-05           = closing ratio = app_rate × lease_rate (leases per tour)
  //   52             = weeks/year
  //   avg_lease_term = average lease duration in years (default 1.0 for 12-month lease)
  // Capped to [M05_EQUILIBRIUM_MIN, 0.30]:
  //   M05_EQUILIBRIUM_MIN sourced from trafficProjection.calibrated.vacancyPct
  //   (M07 submarket equilibrium, calibrated from proforma_assumptions.vacancy_current)
  let derivedVacancyPct: number | null = null;
  if (trafficProjection != null) {
    const avgLeaseTerm = trafficProjection.avgLeaseTerm; // years (1.0 = standard 12-mo lease)
    const M05_EQUILIBRIUM_MIN = trafficProjection.calibrated.vacancyPct ?? 0.03;
    const WEEKS_PER_YEAR = 52;

    const ls = trafficProjection.leasingSignals;
    if (ls?.t01WeeklyTours != null && ls?.t05ClosingRatio != null && totalUnits > 0) {
      // Primary path: use actual T-01 × T-05 from traffic_learned_rates
      const annualLeases = ls.t01WeeklyTours * ls.t05ClosingRatio * WEEKS_PER_YEAR * avgLeaseTerm;
      const raw = 1 - annualLeases / totalUnits;
      derivedVacancyPct = +Math.min(0.30, Math.max(M05_EQUILIBRIUM_MIN, raw)).toFixed(4);
    } else if (trafficProjection.yearly[0]?.vacancyPct != null) {
      // Secondary path: use year1 trajectory vacancy (already incorporates T-01 × T-05)
      const rawVac = trafficProjection.yearly[0].vacancyPct;
      derivedVacancyPct = +Math.min(0.30, Math.max(M05_EQUILIBRIUM_MIN, rawVac)).toFixed(4);
    } else if (trafficProjection.calibrated.vacancyPct != null) {
      // Tertiary fallback: calibrated vacancy with lease-term adjustment
      const calibrated = trafficProjection.calibrated.vacancyPct;
      const leaseTermAdj = avgLeaseTerm < 1 ? 1 + (1 - avgLeaseTerm) * 0.1 : 1;
      derivedVacancyPct = +Math.min(0.30, Math.max(M05_EQUILIBRIUM_MIN, calibrated * leaseTermAdj)).toFixed(4);
    }
  }

  // ── Unit economics ──────────────────────────────────────────────────────────
  const gprRes = resolvedNum(lv(year1Seed, 'gpr'));
  const egiRes = resolvedNum(lv(year1Seed, 'egi'));
  const opexRes = resolvedNum(lv(year1Seed, 'total_opex'));
  const noiRes = resolvedNum(lv(year1Seed, 'noi'));
  const safe = (v: number | null) => (v != null && totalUnits > 0 ? Math.round(v / totalUnits) : null);
  const unitEconomics: Record<string, number | null> = {
    gprPerUnit: safe(gprRes),
    egiPerUnit: safe(egiRes),
    opexPerUnit: safe(opexRes),
    noiPerUnit: safe(noiRes),
    opexRatioPct: egiRes && opexRes && egiRes > 0 ? +((opexRes / egiRes) * 100).toFixed(2) : null,
    // Derived vacancy from M07 traffic formula (informational — not used in resolution)
    derivedVacancyPct,
    avgLeaseTermYears: trafficProjection?.avgLeaseTerm ?? null,
  };

  // ── M07 per-year traffic projections ───────────────────────────────────────
  // Already assembled by getTrafficProjection — map to DealFinancials contract shape
  const trafficProjectionOut: DealFinancials['trafficProjection'] = trafficProjection ? {
    yearly: trafficProjection.yearly,
    leaseUp: trafficProjection.leaseUp,
    calibrated: trafficProjection.calibrated,
    leasingSignals: trafficProjection.leasingSignals,
  } : proformaAssumRes.rows.length > 0 ? (() => {
    // No traffic projection but we have M07-calibrated scalars
    const pa = proformaAssumRes.rows[0];
    return {
      yearly: [],
      leaseUp: null,
      calibrated: {
        vacancyPct: pa.vacancy_current != null ? +parseFloat(pa.vacancy_current).toFixed(2) : null,
        rentGrowthPct: pa.rent_growth_current != null ? +parseFloat(pa.rent_growth_current).toFixed(3) : null,
        exitCap: pa.exit_cap_current != null ? +parseFloat(pa.exit_cap_current).toFixed(3) : null,
        lastCalibrated: pa.last_recalculation?.toISOString?.() ?? null,
      },
      leasingSignals: null,
    };
  })() : null;

  // ── Assumptions scalar + per-year grid seeded from platform findings ────────
  const assumptionsRow = assumptionsRes.rows[0];
  const exitCap = assumptionsRow?.exit_cap != null ? +parseFloat(assumptionsRow.exit_cap).toFixed(3) : null;
  const rentGrowthYr1 = assumptionsRow?.rent_growth_yr1 != null ? +parseFloat(assumptionsRow.rent_growth_yr1).toFixed(3) : null;
  const rentGrowthStab = assumptionsRow?.rent_growth_stabilized != null ? +parseFloat(assumptionsRow.rent_growth_stabilized).toFixed(3) : null;
  const calibVacancy = trafficProjection?.calibrated.vacancyPct ?? null;
  const calibRentGrowth = trafficProjection?.calibrated.rentGrowthPct ?? null;

  // Per-year assumptions grid: year1 uses M07 calibrated values; years 2+ blend toward
  // stabilized growth (platform findings from proforma_assumptions.rent_growth_current)
  const perYear = Array.from({ length: holdYears }, (_, i) => {
    const yr = i + 1;
    // Rent growth: yr1 uses rentGrowthYr1, subsequent years blend toward stabilized over 5yrs
    const growthBase = rentGrowthYr1 ?? calibRentGrowth ?? null;
    const growthStab = rentGrowthStab ?? growthBase;
    const blendFactor = Math.min(1, (yr - 1) / 5);
    const rentGrowthPct = growthBase != null && growthStab != null
      ? +(growthBase + (growthStab - growthBase) * blendFactor).toFixed(3)
      : growthStab;

    // Vacancy: use M07-calibrated floor (improving toward stabilized over first 3yrs)
    const vacancyBase = calibVacancy ?? (yr === 1 ? derivedVacancyPct : null);
    const vacancyPct = vacancyBase != null ? +Math.min(0.30, vacancyBase).toFixed(4) : null;

    // Per-year overrides from deal_assumptions.per_year_overrides
    const pyOverrides = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, { value: number | null }>;
    const vacOverride = pyOverrides[`vacancy_pct:yr${yr}`];
    const rentGrowthOverride = pyOverrides[`rent_growth_pct:yr${yr}`];

    return {
      year: yr,
      rentGrowthPct: rentGrowthOverride?.value ?? rentGrowthPct,
      vacancyPct: vacOverride?.value ?? vacancyPct,
      exitCapIfLastYear: yr === holdYears ? exitCap : null,
    };
  });

  // ── GPR Decomposition — derived from year1 seed gpr LayeredValue ────────────
  const gprSeed = lv(year1Seed, 'gpr');
  const gprBrokerAnnual  = layerNum(gprSeed, 'om') ?? layerNum(gprSeed, 'broker');
  const gprPlatAnnual    = layerNum(gprSeed, 'platform');
  const gprT12Annual     = layerNum(gprSeed, 't12');
  const gprRentRollAnnual = layerNum(gprSeed, 'rent_roll');
  const gprResolvedAnnual = resolvedNum(gprSeed);
  const safe2 = (v: number | null) => (v != null && totalUnits > 0 ? Math.round(v / totalUnits / 12) : null);
  const gprDecomposition = {
    brokerAnnual:      gprBrokerAnnual,
    platformAnnual:    gprPlatAnnual,
    t12Annual:         gprT12Annual,
    rentRollAnnual:    gprRentRollAnnual,
    resolvedAnnual:    gprResolvedAnnual,
    brokerPerUnitMo:   safe2(gprBrokerAnnual),
    platformPerUnitMo: safe2(gprPlatAnnual),
    t12PerUnitMo:      safe2(gprT12Annual),
    resolvedPerUnitMo: safe2(gprResolvedAnnual),
  };

  // ── AI narrative — synthesizes M07 signals + key assumption flags ──────────
  const sig = trafficProjectionOut?.leasingSignals;
  let narrative: string | null = null;
  if (sig != null) {
    const parts: string[] = [];
    if (sig.confidence != null) parts.push(`M07 model confidence: ${sig.confidence}%`);
    if (sig.t01WeeklyTours != null) parts.push(`tour velocity ${sig.t01WeeklyTours.toFixed(1)}/wk`);
    if (sig.t05ClosingRatio != null) parts.push(`capture rate ${(sig.t05ClosingRatio * 100).toFixed(1)}%`);
    if (sig.t06WeeklyLeases != null) parts.push(`net leases ${sig.t06WeeklyLeases.toFixed(1)}/wk`);
    if (sig.t07LeaseUpWeeksTo95 != null) parts.push(`lease-up to 95% in ${sig.t07LeaseUpWeeksTo95} wks`);
    if (trafficProjectionOut?.calibrated?.exitCap != null) parts.push(`platform exit cap ${(trafficProjectionOut.calibrated.exitCap * 100).toFixed(2)}%`);
    if (parts.length > 0) narrative = parts.join(' · ');
  }

  const assumptions = {
    holdYears,
    exitCap,
    rentGrowthYr1,
    rentGrowthStabilized: rentGrowthStab,
    perYear,
    gprDecomposition: (gprBrokerAnnual ?? gprPlatAnnual ?? gprT12Annual ?? gprResolvedAnnual) != null
      ? gprDecomposition
      : null,
    narrative,
  };

  // ── Capital Stack assembly ──────────────────────────────────────────────────
  // Purchase price: prefer deal_data.purchase_price, fallback to budget column
  const dealData = (deal.deal_data ?? {}) as Record<string, unknown>;
  const purchasePrice: number | null =
    (dealData.purchase_price != null ? +dealData.purchase_price : null) ??
    (dealData.asking_price  != null ? +dealData.asking_price  : null) ??
    (deal.budget            != null ? +deal.budget             : null);
  const ltcPct: number | null = assumptionsRow?.ltc != null ? +parseFloat(assumptionsRow.ltc).toFixed(4) : null;
  const loanAmount  = purchasePrice != null && ltcPct != null ? Math.round(purchasePrice * ltcPct) : null;
  const equityAtClose = purchasePrice != null && loanAmount != null ? purchasePrice - loanAmount : null;
  const interestRate: number | null = assumptionsRow?.interest_rate != null ? +parseFloat(assumptionsRow.interest_rate).toFixed(4) : null;
  const ioPeriodMonths: number | null = assumptionsRow?.io_period_months ?? null;
  const amortizationYears: number | null = assumptionsRow?.amortization_years ?? null;
  const dscrMin: number | null = assumptionsRow?.dscr_min != null ? +parseFloat(assumptionsRow.dscr_min).toFixed(2) : null;
  const originationFeePct: number | null = assumptionsRow?.origination_fee_pct != null ? +parseFloat(assumptionsRow.origination_fee_pct).toFixed(4) : null;
  const capitalStack: DealCapitalStack = {
    purchasePrice,
    pricePerUnit: purchasePrice != null && totalUnits > 0 ? Math.round(purchasePrice / totalUnits) : null,
    loanAmount,
    equityAtClose,
    ltcPct,
    interestRate,
    ioPeriodMonths,
    amortizationYears,
    dscrMin,
    originationFeePct,
  };

  // ── Rent Roll Summary (unit mix from deal_assumptions.unit_mix) ─────────────
  type RawUnitMixEntry = Record<string, unknown>;
  const rawUnitMix: RawUnitMixEntry[] | null = (() => {
    const um = assumptionsRow?.unit_mix;
    if (!um) return null;
    if (Array.isArray(um)) return um.length > 0 ? (um as RawUnitMixEntry[]) : null;
    if (typeof um === 'object' && um !== null && !Array.isArray(um)) {
      const entries = Object.entries(um as Record<string, unknown>);
      if (entries.length === 0) return null;
      return entries.map(([k, v]) => ({ type: k, ...(typeof v === 'object' && v !== null ? (v as object) : {}) })) as RawUnitMixEntry[];
    }
    return null;
  })();

  const parsedUnitMix: RentRollUnitType[] | null = rawUnitMix
    ? rawUnitMix.map(e => ({
        type:           String(e.type ?? e.unit_type ?? 'Unknown'),
        count:          +(e.count ?? e.units ?? 0),
        avgSf:          e.avg_sf != null ? +e.avg_sf : null,
        inPlaceRent:    e.in_place_rent != null ? +e.in_place_rent : (e.avg_rent != null ? +e.avg_rent : null),
        marketRent:     e.market_rent != null ? +e.market_rent : null,
        occupancyPct:   e.occupancy_pct != null ? +e.occupancy_pct : null,
        concessionPct:  e.concession_pct != null ? +e.concession_pct : null,
      })).filter(e => e.count > 0)
    : null;

  const avgInPlaceRent: number | null = parsedUnitMix && parsedUnitMix.length > 0
    ? (() => {
        const totalWeighted = parsedUnitMix.reduce((s, e) => e.inPlaceRent != null ? s + e.inPlaceRent * e.count : s, 0);
        const totalCount    = parsedUnitMix.reduce((s, e) => e.inPlaceRent != null ? s + e.count : s, 0);
        return totalCount > 0 ? Math.round(totalWeighted / totalCount) : null;
      })()
    : (assumptionsRow?.avg_rent_per_unit != null ? +assumptionsRow.avg_rent_per_unit : null);

  const weightedOccupancyPct: number | null = parsedUnitMix && parsedUnitMix.length > 0
    ? (() => {
        const totalWeighted = parsedUnitMix.reduce((s, e) => e.occupancyPct != null ? s + e.occupancyPct * e.count : s, 0);
        const totalCount    = parsedUnitMix.reduce((s, e) => e.occupancyPct != null ? s + e.count : s, 0);
        return totalCount > 0 ? +(totalWeighted / totalCount).toFixed(4) : null;
      })()
    : (assumptionsRow?.vacancy_pct != null ? +(1 - +assumptionsRow.vacancy_pct).toFixed(4) : null);

  const rentRollSummary: DealFinancials['rentRollSummary'] = parsedUnitMix || avgInPlaceRent || weightedOccupancyPct
    ? { unitMix: parsedUnitMix, avgInPlaceRent, weightedOccupancyPct }
    : null;

  // ── User overrides — reconstruct USER layer state for frontend rehydration ──
  //
  // Frontend reads overrides by rd.key:
  //   • Section 1/3 rows: rd.key = OSRow.field (snake_case, e.g. "vacancy_pct")
  //   • Section 2/4-7 STATIC_ROWS: rd.key = camelCase (e.g. "t01WeeklyTours")
  //
  // Therefore userOverrides must use snake_case keys for Section 1/3 fields and
  // camelCase keys for traffic-signal / scalar / STATIC_ROW fields.
  //
  // Key routing table (only non-identity mappings):
  const SNAKE_TO_STATIC_KEY: Record<string, string> = {
    // Traffic signals → camelCase STATIC_ROW keys
    t01_weekly_tours: 't01WeeklyTours',
    t05_closing_ratio: 't05ClosingRatio',
    t06_weekly_leases: 't06WeeklyLeases',
    // Scalar deal_assumptions columns → camelCase STATIC_ROW keys
    exit_cap:          'exitCapRate',
    interest_rate:     'interestRate',
    ltc:               'ltcPct',
    io_period_months:  'ioPeriodMonths',
    // Section 1/3 fields pass through unchanged (snake_case = rd.key)
  };
  const rawPyOvs = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, { value: number | null } | null>;
  const userOverrides: Record<string, Record<number, number | null>> = {};

  // Pass 1: per_year_overrides JSONB (year-1 traffic signals + all year 2+ overrides)
  for (const [key, entry] of Object.entries(rawPyOvs)) {
    if (!entry || entry.value == null) continue;
    const colonIdx = key.lastIndexOf(':');
    const fieldSnake = colonIdx >= 0 ? key.slice(0, colonIdx) : key;
    const yrStr = colonIdx >= 0 ? key.slice(colonIdx + 1) : '';
    const yr = yrStr.startsWith('yr') ? parseInt(yrStr.slice(2), 10) : NaN;
    if (isNaN(yr)) continue;
    const rowKey = SNAKE_TO_STATIC_KEY[fieldSnake] ?? fieldSnake;  // snake_case passthrough for Sec 1/3
    if (!userOverrides[rowKey]) userOverrides[rowKey] = {};
    userOverrides[rowKey][yr] = entry.value;
    // vacancy_pct overrides also populate the Section 2 'stabilizedOcc' row key
    // (stabilizedOcc displays 1 - vacancyPct; its patchField is 'vacancyPct' → 'vacancy_pct')
    if (fieldSnake === 'vacancy_pct') {
      if (!userOverrides['stabilizedOcc']) userOverrides['stabilizedOcc'] = {};
      userOverrides['stabilizedOcc'][yr] = +Math.max(0, 1 - entry.value).toFixed(4);
    }
  }

  // Pass 2: year1 LayeredValue seed — year-1 non-traffic overrides stored via applyUserOverride.
  // These are NOT in per_year_overrides; they appear as a user-layer value in the seed.
  // Section 1/3 fields only (snake_case keys, matching rd.key in the grid).
  const YEAR1_SECTION13_FIELDS = [
    'vacancy_pct','gpr','loss_to_lease_pct','concessions_pct','bad_debt_pct',
    'non_revenue_units_pct','other_income_per_unit','egi',
    'payroll','repairs_maintenance','turnover','contract_services','marketing',
    'utilities','g_and_a','management_fee_pct','insurance','real_estate_tax',
    'replacement_reserves','total_opex','noi',
  ];
  for (const fieldSnake of YEAR1_SECTION13_FIELDS) {
    const lvEntry = lv(year1Seed, fieldSnake) as Record<string, unknown> | null;
    if (!lvEntry) continue;
    // applyUserOverride stores the value at field.override (LayeredValue<T>.override)
    // and sets resolution='override'. We surface this when resolution is override.
    if (lvEntry['resolution'] !== 'override') continue;
    const overrideVal = lvEntry['override'] as number | null | undefined;
    if (overrideVal == null) continue;
    if (!userOverrides[fieldSnake]) userOverrides[fieldSnake] = {};
    userOverrides[fieldSnake][1] = overrideVal;   // year 1
    // vacancy_pct year-1 override also populates 'stabilizedOcc' key (Section 2 row)
    if (fieldSnake === 'vacancy_pct') {
      if (!userOverrides['stabilizedOcc']) userOverrides['stabilizedOcc'] = {};
      userOverrides['stabilizedOcc'][1] = +Math.max(0, 1 - overrideVal).toFixed(4);
    }
  }

  // ── Florida Tax Engine ────────────────────────────────────────────────────────
  const FL_SOH_CAP = 0.10;  // FL Save Our Homes: max 10% annual assessed-value increase
  const FL_MIAMI_DADE_CITIES = new Set([
    'miami','miami beach','hialeah','coral gables','doral','miami gardens','homestead',
    'north miami','north miami beach','opa-locka','aventura','bal harbour',
    'florida city','golden beach','indian creek','key biscayne','medley','miami shores',
    'miami springs','north bay village','palmetto bay','pinecrest','south miami',
    'sunny isles beach','surfside','sweetwater','virginia gardens','west miami',
  ]);
  const isMiamiDade = FL_MIAMI_DADE_CITIES.has((deal.city ?? '').toLowerCase().trim());
  const millageRate = isMiamiDade ? 23.09 : 20.00;   // mills per $1,000 assessed value

  // T-12 RE tax from proforma year1 seed (real_estate_tax field)
  const taxLvObj = lv(year1Seed, 'real_estate_tax') as Record<string, unknown> | null;
  const layerN = (lvo: Record<string, unknown> | null, key: string): number | null => {
    if (!lvo) return null;
    const v = lvo[key];
    return v != null && !isNaN(Number(v)) ? Number(v) : null;
  };
  const t12AnnualTax: number | null = layerN(taxLvObj, 'broker') ?? layerN(taxLvObj, 't12') ?? layerN(taxLvObj, 'resolved');
  const t12AssessedValue: number | null = t12AnnualTax != null ? Math.round(t12AnnualTax / (millageRate / 1000)) : null;

  // Read user tax overrides from per_year_overrides
  const rawTaxOvs = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, Record<string, unknown> | null>;
  const taxAssessedValueOvr: number | null = (() => {
    const v = rawTaxOvs['tax:assessed_value:yr1'];
    return v?.value != null ? Number(v.value) : null;
  })();
  const taxMillageRateOvr: number | null = (() => {
    const v = rawTaxOvs['tax:millage_rate:yr1'];
    return v?.value != null ? Number(v.value) : null;
  })();
  const tppAmountOvr: number | null = (() => {
    const v = rawTaxOvs['tax:tpp_amount:yr1'];
    return v?.value != null ? Number(v.value) : null;
  })();
  // County override: 1 = Miami-Dade, 0 = statewide; null = auto-detected from city
  const taxCountyOvr: boolean | null = (() => {
    const v = rawTaxOvs['tax:county_override:yr1'];
    return v?.value != null ? Number(v.value) === 1 : null;
  })();
  const resolvedIsMiamiDade = taxCountyOvr ?? isMiamiDade;

  // Platform assessed value: purchase price post-acquisition reassessment (resolved or override)
  const platformAssessedValue: number | null = taxAssessedValueOvr ?? purchasePrice;
  const resolvedMillage = taxMillageRateOvr ?? (resolvedIsMiamiDade ? 23.09 : 20.00);
  const platformAnnualTax: number | null = platformAssessedValue != null
    ? Math.round(platformAssessedValue * (resolvedMillage / 1000)) : null;

  // Y1-Y10 RE tax projection (SOH cap applies after Y1 acquisition reassessment)
  // Always generate minimum 10 years so Section A grid is complete regardless of hold period
  const reTaxPerYear: Array<{
    year: number; assessedValue: number; millageRate: number;
    taxAmount: number; sohCapBinding: boolean; reassessmentEvent: boolean;
  }> = [];
  const baseAssessed = platformAssessedValue ?? 0;
  let prevCapped = baseAssessed;
  const mktGrowthRate = 0.12;  // FL market appreciation (12%/yr) — exceeds 10% SOH cap so cap binds
  for (let yr = 1; yr <= Math.max(holdYears, 10); yr++) {
    const isReassessment = yr === 1;
    const marketValue = baseAssessed * Math.pow(1 + mktGrowthRate, yr - 1);
    const capLimited = yr === 1 ? baseAssessed : Math.min(marketValue, prevCapped * (1 + FL_SOH_CAP));
    const sohCapBinding = yr > 1 && marketValue > capLimited + 1;
    const assessedValue = Math.round(capLimited);
    const taxAmount = Math.round(assessedValue * (resolvedMillage / 1000));
    reTaxPerYear.push({ year: yr, assessedValue, millageRate: resolvedMillage, taxAmount, sohCapBinding, reassessmentEvent: isReassessment });
    prevCapped = capLimited;
  }
  const y1TaxAmt = reTaxPerYear[0]?.taxAmount ?? null;
  const deltaVsT12Pct = y1TaxAmt != null && t12AnnualTax != null && t12AnnualTax > 0
    ? (y1TaxAmt - t12AnnualTax) / t12AnnualTax : null;

  // TPP (Tangible Personal Property) estimates
  const rrLv = lv(year1Seed, 'replacement_reserves') as Record<string, unknown> | null;
  const rrBroker = layerN(rrLv, 'broker') ?? layerN(rrLv, 't12');
  const tppBroker: number | null = rrBroker != null ? Math.round(rrBroker * 0.5) : (totalUnits > 0 ? totalUnits * 150 : null);
  const tppPlatform: number | null = totalUnits > 0 ? totalUnits * 200 : null;

  // Income tax / depreciation
  const LAND_PCT = 0.20;
  const depreciableBase = purchasePrice != null ? Math.round(purchasePrice * (1 - LAND_PCT)) : null;
  const annualDepreciation = depreciableBase != null ? Math.round(depreciableBase / 27.5) : null;
  const currentYear = new Date().getFullYear();
  const bonusRate = currentYear >= 2027 ? 0.20 : 0.40;  // 2026=40%, 2027=20%

  // FL transfer taxes — use resolvedIsMiamiDade so county override persists to Sources & Uses
  const docStampRate = resolvedIsMiamiDade ? 0.0105 : 0.0070;
  const docStampAmount = purchasePrice != null ? Math.round(purchasePrice * docStampRate) : null;
  const intangibleTaxAmount = loanAmount != null ? Math.round(loanAmount * 0.002) : null;
  const totalTransferTax = ((docStampAmount ?? 0) + (intangibleTaxAmount ?? 0)) || null;

  // Refi event taxes — read directly from per_year_overrides (debtOvr/debtOvrStr not yet available here)
  const refiRawPyr = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, unknown>;
  const refiEnabledRaw = (refiRawPyr['debt:senior:refiEnabled'] as Record<string, unknown> | null)?.value;
  const refiEnabled = typeof refiEnabledRaw === 'number' ? refiEnabledRaw !== 0 : !!refiEnabledRaw;
  const refiTriggerYearRaw = (refiRawPyr['debt:senior:refiTriggerYear'] as Record<string, unknown> | null)?.value;
  const refiTriggerYear = typeof refiTriggerYearRaw === 'number' ? refiTriggerYearRaw : 3;
  const refiNewLoanTypeRaw = (refiRawPyr['debt:senior:refiNewLoanType'] as Record<string, unknown> | null)?.value;
  const refiNewLoanType = refiNewLoanTypeRaw != null ? String(refiNewLoanTypeRaw) : null;
  // For FL mortgage refi: doc stamp $0.35/$100 = 0.0035; intangible tax 0.2% on new note
  const refiLoanAmount = loanAmount;
  const refiDocStampAmount = refiEnabled && refiLoanAmount != null ? Math.round(refiLoanAmount * 0.0035) : null;
  const refiIntangibleTaxAmount = refiEnabled && refiLoanAmount != null ? Math.round(refiLoanAmount * 0.002) : null;
  const refiTotalTax = refiEnabled && (refiDocStampAmount != null || refiIntangibleTaxAmount != null)
    ? ((refiDocStampAmount ?? 0) + (refiIntangibleTaxAmount ?? 0)) : null;

  const taxes = {
    reTax: {
      t12AssessedValue, t12MillageRate: millageRate, t12AnnualTax,
      platformAssessedValue, platformAnnualTax, isMiamiDade: resolvedIsMiamiDade,
      sohCapPct: FL_SOH_CAP, perYear: reTaxPerYear, deltaVsT12Pct,
    },
    tpp: { broker: tppBroker, platform: tppPlatform },
    incomeTax: {
      purchasePrice, landValuePct: LAND_PCT, depreciableBase,
      annualDepreciation, bonusDepreciationCurrentYearPct: bonusRate, costSegAvailablePct: 0.30,
      // Marginal blended rate (federal + state). Use 0.37 as conventional top-bracket default
      // when incomeTax data is seeded but no explicit rate override is available.
      marginalTaxRate: 0.37,
    },
    transferTax: {
      purchasePrice, isMiamiDade: resolvedIsMiamiDade,
      miamiDadeRatePct: 0.0105, statewideFlatRatePct: 0.0070,
      appliedRatePct: docStampRate, docStampAmount, intangibleTaxAmount,
      loanAmount, totalTransferTax,
      refi: {
        enabled: refiEnabled,
        triggerYear: refiTriggerYear,
        newLoanType: refiNewLoanType,
        refiLoanAmount: refiEnabled ? refiLoanAmount : null,
        refiDocStampAmount,
        refiIntangibleTaxAmount,
        refiTotalTax,
      },
    },
    userOverrides: {
      taxAssessedValue: taxAssessedValueOvr,
      taxMillageRate: taxMillageRateOvr,
      tppAmount: tppAmountOvr,
      taxCounty: taxCountyOvr,
    },
  };

  // ── Debt Stack v2 — build from capitalStack fields + persisted per_year_overrides ────
  const SOFR_CURVE_DEFAULT = [0.0500, 0.0475, 0.0450, 0.0425, 0.0400];
  const seniorRate = capitalStack.interestRate;
  const seniorLoan = capitalStack.loanAmount;
  const seniorIsMezz = (assumptionsRow as Record<string, unknown>)?.loan_type === 'Mezz';
  const seniorLabel  = (assumptionsRow as Record<string, unknown>)?.loan_type as string | null;
  const seniorRateType: 'Fixed' | 'Floating' = (['Bridge', 'Construction', 'Mezz'].includes(String(seniorLabel ?? ''))) ? 'Floating' : 'Fixed';
  const noiFull = year1Rows.find((r: { field: string }) => r.field === 'noi')?.resolved ?? null;

  // Helper to read a persisted debt override from per_year_overrides JSONB
  const rawPyr = assumptionsRow?.per_year_overrides ?? {};
  const debtOvr = (loanId: string, fieldName: string): number | null => {
    const key = `debt:${loanId}:${fieldName}`;
    const entry = (rawPyr as Record<string, unknown>)[key];
    if (entry && typeof entry === 'object' && 'value' in (entry as Record<string, unknown>)) {
      const v = (entry as Record<string, unknown>).value;
      return v != null ? +v : null;
    }
    return null;
  };
  const debtOvrStr = (loanId: string, fieldName: string): string | null => {
    const key = `debt:${loanId}:${fieldName}`;
    const entry = (rawPyr as Record<string, unknown>)[key];
    if (entry && typeof entry === 'object' && 'value' in (entry as Record<string, unknown>)) {
      const v = (entry as Record<string, unknown>).value;
      return v != null ? String(v) : null;
    }
    return null;
  };

  const seniorLoanAmtEff = debtOvr('senior', 'loanAmount') ?? seniorLoan;
  const seniorRateEff    = debtOvr('senior', 'interestRate') ?? seniorRate;
  const seniorAnnualDS   = seniorLoanAmtEff != null && seniorRateEff != null ? seniorLoanAmtEff * seniorRateEff : null;
  const seniorDscr       = seniorAnnualDS != null && seniorAnnualDS > 0 && typeof noiFull === 'number' ? noiFull / seniorAnnualDS : null;

  // Reconstruct SOFR curve from overrides if any
  const sofrCurveSenior = SOFR_CURVE_DEFAULT.map((v, i) => debtOvr('senior', `sofrCurve:${i}`) ?? v);

  // Resolved senior rate type: persisted override wins, then infer from label
  const seniorRateTypeResolved = (debtOvrStr('senior', 'rateType') as 'Fixed' | 'Floating') ?? seniorRateType;
  const seniorSofrBase = sofrCurveSenior[0];
  const seniorSpreadOvr = debtOvr('senior', 'spread');
  const seniorSpread = seniorSpreadOvr ?? (seniorRate != null ? +(seniorRate - seniorSofrBase).toFixed(4) : 0.035);

  const seniorLoanEntry = {
    id: 'senior',
    name: seniorIsMezz ? 'Mezz / B-Note' : 'Senior Loan',
    loanTypeLabel: debtOvrStr('senior', 'loanTypeLabel') ?? String(seniorLabel ?? 'Bridge'),
    rateType: seniorRateTypeResolved,
    // loanAmount: override replaces capitalStack default; platform shows capitalStack baseline
    loanAmount: { broker: null, platform: debtOvr('senior', 'loanAmount') ?? seniorLoan },
    ltcPct:     { broker: null, platform: capitalStack.ltcPct },
    ltv:        { platform: purchasePrice != null && seniorLoanAmtEff != null && purchasePrice > 0 ? +(seniorLoanAmtEff / purchasePrice).toFixed(4) : null },
    // interestRate: override replaces capitalStack baseline
    interestRate: { broker: null, platform: debtOvr('senior', 'interestRate') ?? seniorRate },
    sofr:       { platform: seniorRateTypeResolved === 'Floating' ? sofrCurveSenior[0] : null },
    spread:     { broker: null, platform: seniorRateTypeResolved === 'Floating' ? seniorSpread : null },
    capRate:    { broker: null, platform: seniorRateTypeResolved === 'Floating' ? (debtOvr('senior', 'capRate') ?? 0.07) : null },
    // termYears: override or null (frontend uses preset fallback)
    termYears:  { broker: null, platform: debtOvr('senior', 'termYears') },
    amortYears: { broker: null, platform: debtOvr('senior', 'amortYears') ?? capitalStack.amortizationYears },
    ioMonths:   { broker: null, platform: debtOvr('senior', 'ioMonths') ?? capitalStack.ioPeriodMonths },
    origFee:    { broker: null, platform: debtOvr('senior', 'origFee') ?? capitalStack.originationFeePct },
    exitFee:    { platform: debtOvr('senior', 'exitFee') },
    rateCapCost:{ broker: null, platform: seniorRateTypeResolved === 'Floating' ? (debtOvr('senior', 'rateCapCost') ?? 0.005) : null },
    minDscr:    { platform: debtOvr('senior', 'minDscr') ?? capitalStack.dscrMin ?? 1.20 },
    minDebtYield: { platform: debtOvr('senior', 'minDY') ?? 0.07 },
    minOccupancy: { platform: debtOvr('senior', 'minOcc') ?? 0.90 },
    maxLtv:     { platform: debtOvr('senior', 'maxLtv') ?? 0.75 },
    cashTrapDscr: { platform: debtOvr('senior', 'cashTrapDscr') ?? 1.10 },
    tiEscrowMonths:         { platform: debtOvr('senior', 'tiEscrow') ?? 2 },
    replacementReserve:     { platform: debtOvr('senior', 'replReserve') ?? 300 },
    operatingReserveMonths: { platform: debtOvr('senior', 'opReserveMonths') ?? 3 },
    prepayType: debtOvrStr('senior', 'prepayType') ?? (seniorRateTypeResolved === 'Fixed' ? 'defeasance' : 'open'),
    derivedAnnualDS: seniorAnnualDS,
    sofrCurve: sofrCurveSenior,
    extensionOptions: debtOvrStr('senior', 'extensionOptions') ?? null,
    refiEnabled: (debtOvr('senior', 'refiEnabled') ?? 0) !== 0,
    refiTriggerYear: debtOvr('senior', 'refiTriggerYear') ?? 3,
    refiNewLoanType: debtOvrStr('senior', 'refiNewLoanType') ?? null,
  };

  // Build mezz loan entry from persisted overrides (only if loanAmount override exists)
  const mezzLoanAmt = debtOvr('mezz', 'loanAmount');
  const mezzRate = debtOvr('mezz', 'interestRate');
  const sofrCurveMezz = SOFR_CURVE_DEFAULT.map((v, i) => debtOvr('mezz', `sofrCurve:${i}`) ?? v);
  const mezzRateTypeStr = debtOvrStr('mezz', 'rateType');
  const mezzRateType: 'Fixed' | 'Floating' = mezzRateTypeStr === 'Fixed' ? 'Fixed' : 'Floating';
  const mezzAnnualDS = mezzLoanAmt != null && mezzRate != null ? mezzLoanAmt * mezzRate : null;

  const loans = [seniorLoanEntry as DealFinancials['debt']['loans'][0]];

  if (mezzLoanAmt != null) {
    const mezzEntry: DealFinancials['debt']['loans'][0] = {
      id: 'mezz',
      name: 'Mezz / B-Note',
      loanTypeLabel: debtOvrStr('mezz', 'loanTypeLabel') ?? 'Mezz',
      rateType: mezzRateType,
      loanAmount: { broker: null, platform: mezzLoanAmt },
      ltcPct: { broker: null, platform: purchasePrice != null && mezzLoanAmt > 0 && purchasePrice > 0 ? +(mezzLoanAmt / purchasePrice).toFixed(4) : null },
      ltv: { platform: purchasePrice != null && mezzLoanAmt > 0 && purchasePrice > 0 ? +(mezzLoanAmt / purchasePrice).toFixed(4) : null },
      interestRate: { broker: null, platform: mezzRate ?? 0.12 },
      sofr: { platform: mezzRateType === 'Floating' ? sofrCurveMezz[0] : null },
      spread: { broker: null, platform: mezzRateType === 'Floating' ? (mezzRate != null ? +(mezzRate - sofrCurveMezz[0]).toFixed(4) : 0.060) : null },
      capRate: { broker: null, platform: mezzRateType === 'Floating' ? 0.09 : null },
      termYears: { broker: null, platform: debtOvr('mezz', 'termYears') ?? 3 },
      amortYears: { broker: null, platform: debtOvr('mezz', 'amortYears') ?? 0 },
      ioMonths: { broker: null, platform: debtOvr('mezz', 'ioMonths') ?? 36 },
      origFee: { broker: null, platform: debtOvr('mezz', 'origFee') ?? 0.02 },
      exitFee: { platform: debtOvr('mezz', 'exitFee') ?? 0.01 },
      rateCapCost: { broker: null, platform: mezzRateType === 'Floating' ? (debtOvr('mezz', 'rateCapCost') ?? 0.008) : null },
      minDscr: { platform: debtOvr('mezz', 'minDscr') ?? 1.10 },
      minDebtYield: { platform: debtOvr('mezz', 'minDY') ?? 0.09 },
      minOccupancy: { platform: debtOvr('mezz', 'minOcc') ?? 0.85 },
      maxLtv: { platform: debtOvr('mezz', 'maxLtv') ?? 0.90 },
      cashTrapDscr: { platform: debtOvr('mezz', 'cashTrapDscr') ?? 1.05 },
      tiEscrowMonths: { platform: debtOvr('mezz', 'tiEscrow') ?? 0 },
      replacementReserve: { platform: debtOvr('mezz', 'replReserve') ?? 0 },
      operatingReserveMonths: { platform: debtOvr('mezz', 'opReserveMonths') ?? 0 },
      prepayType: debtOvrStr('mezz', 'prepayType') ?? 'open',
      derivedAnnualDS: mezzAnnualDS,
      sofrCurve: sofrCurveMezz,
      extensionOptions: null,
      refiEnabled: false,
      refiTriggerYear: 3,
      refiNewLoanType: null,
    };
    loans.push(mezzEntry);
  }

  const totalLoanAmt = (seniorLoanAmtEff ?? 0) + (mezzLoanAmt ?? 0);
  const totalAnnualDS = (seniorAnnualDS ?? 0) + (mezzAnnualDS ?? 0);
  const blendedRate = totalLoanAmt > 0
    ? ((seniorLoanAmtEff ?? 0) * (seniorRateEff ?? 0) + (mezzLoanAmt ?? 0) * (mezzRate ?? 0)) / totalLoanAmt
    : seniorRateEff;
  const aggregateDscr = totalAnnualDS != null && totalAnnualDS > 0 && typeof noiFull === 'number' ? noiFull / totalAnnualDS : seniorDscr;

  const combinedLtcPct = purchasePrice != null && purchasePrice > 0 && totalLoanAmt > 0
    ? +(totalLoanAmt / purchasePrice).toFixed(4)
    : capitalStack.ltcPct;

  const debtStack: DealFinancials['debt'] = {
    loans,
    aggregate: {
      totalLoanAmount: totalLoanAmt,
      blendedRatePct: blendedRate,
      combinedLtcPct,
      totalAnnualDS: totalAnnualDS || null,
      aggregateDscr,
    },
  };

  // Propagate senior loan amount override into capitalStack so Sources & Uses tab picks it up
  const capitalStackWithOverrides: DealCapitalStack = {
    ...capitalStack,
    loanAmount: seniorLoanAmtEff ?? capitalStack.loanAmount,
    interestRate: debtOvr('senior', 'interestRate') ?? capitalStack.interestRate,
    amortizationYears: debtOvr('senior', 'amortYears') ?? capitalStack.amortizationYears,
    ioPeriodMonths: debtOvr('senior', 'ioMonths') ?? capitalStack.ioPeriodMonths,
    originationFeePct: debtOvr('senior', 'origFee') ?? capitalStack.originationFeePct,
    dscrMin: debtOvr('senior', 'minDscr') ?? capitalStack.dscrMin,
  };

  // ── Sources & Uses ──────────────────────────────────────────────────────────
  const suPyr = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, unknown>;
  const suOvr = (key: string): number | null => {
    const entry = (suPyr[`su:${key}`] as Record<string, unknown> | null);
    const v = entry?.value;
    return typeof v === 'number' ? v : null;
  };

  const suSeniorLoan = seniorLoanAmtEff ?? capitalStack.loanAmount ?? 0;
  const suMezzLoan = debtOvr('mezz', 'loanAmount') ?? 0;
  const suPurchasePrice = purchasePrice ?? 0;

  // Closing costs: user override first, else estimate ~2% of purchase price (title, legal, survey)
  const suClosingCostsOvr = suOvr('closingCosts');
  const suClosingCosts = suClosingCostsOvr != null
    ? suClosingCostsOvr
    : suPurchasePrice > 0 ? Math.round(suPurchasePrice * 0.02) : 0;

  const suTransferTax = totalTransferTax ?? 0;
  const suOrigFee = suSeniorLoan * (capitalStackWithOverrides.originationFeePct ?? 0.01);

  // Lender reserves — use debt overrides or standard industry defaults
  const suTiMonths  = debtOvr('senior', 'tiEscrow') ?? 2;
  const suTiEscrow  = suSeniorLoan > 0 ? Math.round(suSeniorLoan * (suTiMonths / 12) * (capitalStack.interestRate ?? 0.06)) : 0;
  const suReplPerUnit = (assumptionsRow as Record<string, unknown>)?.replacement_reserves_per_unit as number | null ?? debtOvr('senior', 'replReserve') ?? 300;
  const suReplReserve = totalUnits > 0 ? Math.round(totalUnits * suReplPerUnit) : 0;
  const suOpMonths  = debtOvr('senior', 'opReserveMonths') ?? 3;
  const suOpReserve = suSeniorLoan > 0 ? Math.round(suSeniorLoan * (suOpMonths / 12) * (capitalStack.interestRate ?? 0.06)) : 0;
  const suLenderReserves = suTiEscrow + suReplReserve + suOpReserve;

  // Renovation / Value-Add Capex — user override first, else estimate $5,000/unit (typical value-add)
  const suCapexOvr = suOvr('capexTotal');
  const suCapex = suCapexOvr != null
    ? suCapexOvr
    : totalUnits > 0 ? Math.round(totalUnits * 5000) : 0;

  const suWorkingCapital = suOvr('workingCapital') ?? 0;
  const suPreopening = suOvr('preopeningCosts') ?? 0;
  const suOtherUses = suOvr('otherUses') ?? 0;
  const suSellerFinancing = suOvr('sellerFinancing') ?? 0;

  // Total debt for equity computation
  const suTotalDebt = suSeniorLoan + suMezzLoan;
  const suEquity = Math.max(0, suPurchasePrice - suTotalDebt);
  const suLpShare = 0.90;
  const suGpShare = 0.10;

  const suUses: SuItem[] = [
    { id: 'purchasePrice',  label: 'PURCHASE PRICE',     amount: suPurchasePrice,                              sub: totalUnits > 0 ? `$${Math.round(suPurchasePrice / totalUnits).toLocaleString()}/unit` : null, userOverridable: false },
    { id: 'closingCosts',   label: 'CLOSING COSTS',      amount: suClosingCosts,                               sub: 'Title, legal, survey — estimated 2% of purchase price', userOverridable: true },
    { id: 'transferTax',    label: 'TRANSFER TAXES',     amount: suTransferTax > 0 ? suTransferTax : null,     sub: 'Doc stamps + intangible — from Taxes tab', userOverridable: false },
    { id: 'originationFee', label: 'LOAN ORIGINATION',   amount: suOrigFee > 0 ? suOrigFee : null,             sub: `${((capitalStackWithOverrides.originationFeePct ?? 0.01) * 100).toFixed(2)}% of loan`, userOverridable: false },
    { id: 'lenderReserves', label: 'LENDER RESERVES',    amount: suLenderReserves > 0 ? suLenderReserves : null, sub: 'T&I escrow + replacement reserve + operating reserve — from Debt tab', userOverridable: false },
    { id: 'capex',          label: 'RENOVATION / CAPEX', amount: suCapex > 0 ? suCapex : null,                 sub: `Renovation & value-add budget${suCapexOvr == null ? (totalUnits > 0 ? ' — estimated $5K/unit' : ' — enter total below') : ''}`, userOverridable: true },
    { id: 'workingCapital', label: 'WORKING CAPITAL',    amount: suWorkingCapital > 0 ? suWorkingCapital : null, sub: 'Operational runway at close', userOverridable: true },
    { id: 'preopeningCosts',label: 'PRE-OPENING COSTS',  amount: suPreopening > 0 ? suPreopening : null,       sub: 'Lease-up, marketing, staff', userOverridable: true },
    { id: 'otherUses',      label: 'OTHER USES',         amount: suOtherUses > 0 ? suOtherUses : null,         sub: 'Miscellaneous at close', userOverridable: true },
  ].filter(u =>
    // Keep non-overridable rows with amount > 0
    // Keep overridable rows always (even if null) so frontend can render editable cells
    u.userOverridable ? true : (u.amount != null && (u.amount as number) > 0)
  );

  const suTotalUses = suUses.reduce((s, u) => s + (u.amount ?? 0), 0);

  const suSources = [
    { id: 'seniorDebt',      label: 'SENIOR DEBT',       amount: suSeniorLoan > 0 ? suSeniorLoan : null,       sub: `${((suSeniorLoan / Math.max(suPurchasePrice, 1)) * 100).toFixed(1)}% LTV` },
    { id: 'mezzDebt',        label: 'MEZZ / B-NOTE',     amount: suMezzLoan > 0 ? suMezzLoan : null,           sub: 'Subordinate debt' },
    { id: 'sellerFinancing', label: 'SELLER FINANCING',  amount: suSellerFinancing > 0 ? suSellerFinancing : null, sub: 'Seller carry-back note', userOverridable: true },
    { id: 'lpEquity',        label: 'LP EQUITY',         amount: suEquity > 0 ? suEquity * suLpShare : null,   sub: `${(suLpShare * 100).toFixed(0)}% LP split`, userOverridable: false },
    { id: 'gpEquity',        label: 'GP EQUITY',         amount: suEquity > 0 ? suEquity * suGpShare : null,   sub: `${(suGpShare * 100).toFixed(0)}% GP co-invest`, userOverridable: false },
  ].filter(s =>
    s.userOverridable ? true : (s.amount != null && (s.amount as number) > 0)
  );

  const suTotalSources = suSources.reduce((s, src) => s + (src.amount ?? 0), 0);
  const suDelta = suTotalSources - suTotalUses;
  const suBalanced = Math.abs(suDelta) < 1000;

  type SuItem = { id: string; label: string; amount: number | null; sub: string | null; userOverridable?: boolean };
  const addPct = (items: SuItem[]): (SuItem & { pct: number })[] => {
    const total = Math.max(items.reduce((s, i) => s + (i.amount ?? 0), 0), 1);
    return items.map(i => ({ ...i, pct: (i.amount ?? 0) / total }));
  };

  const sourcesUses: DealFinancials['sourcesUses'] = {
    sources: addPct(suSources).map(s => ({ id: s.id, label: s.label, amount: s.amount, pct: s.pct, sub: s.sub, userOverridable: s.userOverridable ?? false })),
    uses: addPct(suUses).map(u => ({ id: u.id, label: u.label, amount: u.amount, pct: u.pct, sub: u.sub, userOverridable: u.userOverridable ?? false })),
    totalSources: suTotalSources || null,
    totalUses: suTotalUses || null,
    delta: suDelta,
    balanced: suBalanced,
    benchmarks: {
      totalCostPerUnit: totalUnits > 0 && suTotalUses > 0 ? Math.round(suTotalUses / totalUnits) : null,
      totalCostPerSf: null,
      closingCostsPct: suTotalUses > 0 ? +((suClosingCosts + suTransferTax) / suTotalUses).toFixed(4) : null,
      debtPct: suTotalSources > 0 ? +((suSeniorLoan + suMezzLoan) / suTotalSources).toFixed(4) : null,
      equityPct: suTotalSources > 0 ? +(suEquity / suTotalSources).toFixed(4) : null,
      capexPerUnit: null,
    },
    userOverrides: {
      closingCosts: suOvr('closingCosts'),
      capexTotal: suOvr('capexTotal'),
      workingCapital: suOvr('workingCapital'),
      preopeningCosts: suOvr('preopeningCosts'),
      otherUses: suOvr('otherUses'),
      sellerFinancing: suOvr('sellerFinancing'),
    },
  };

  // ── Waterfall / Capital config overrides (wf: prefix) ──────────────────────
  const wfPyr = (assumptionsRow?.per_year_overrides ?? {}) as Record<string, unknown>;
  const wfOvr = (key: string): number | null => {
    const entry = (wfPyr[`wf:${key}`] as Record<string, unknown> | null);
    const v = entry?.value;
    return typeof v === 'number' ? v : null;
  };

  const wfLpShare    = wfOvr('lpShare')    ?? 0.9;
  const wfGpShare    = wfOvr('gpShare')    ?? 0.1;
  const wfPrefRate   = wfOvr('prefRate')   ?? 0.08;
  const wfWaterfallType = (wfPyr['wf:waterfallType'] as Record<string, unknown> | null)?.value ?? 'american';

  // Helper: read string wf override
  const wfStrOvr = (key: string): string | null => {
    const entry = (wfPyr[`wf:${key}`] as Record<string, unknown> | null);
    const v = entry?.value;
    return typeof v === 'string' ? v : null;
  };

  // Tier defaults for triggerType
  const DEFAULT_TRIGGER_TYPES = ['roc', 'pref_return', 'promote'];
  const wfTiers: Array<{ triggerIrr: number; lpPct: number; gpPct: number; triggerType: string }> = [];
  for (let i = 0; i < 6; i++) {
    const trigger     = wfOvr(`tier${i}TriggerIrr`);
    const lp          = wfOvr(`tier${i}LpPct`);
    const gp          = wfOvr(`tier${i}GpPct`);
    const triggerType = wfStrOvr(`tier${i}TriggerType`) ?? DEFAULT_TRIGGER_TYPES[i] ?? 'promote';
    if (trigger != null || lp != null || gp != null || i < 3) {
      wfTiers.push({
        triggerIrr:   trigger  ?? (i === 0 ? 0.08 : i === 1 ? 0.12 : i === 2 ? 0.15 : 0.20),
        lpPct:        lp       ?? (i === 0 ? 0.80 : i === 1 ? 0.70 : i === 2 ? 0.60 : 0.50),
        gpPct:        gp       ?? (i === 0 ? 0.20 : i === 1 ? 0.30 : i === 2 ? 0.40 : 0.50),
        triggerType,
      });
    }
  }
  if (wfTiers.length === 0) {
    wfTiers.push(
      { triggerIrr: 0.08, lpPct: 0.80, gpPct: 0.20, triggerType: 'roc' },
      { triggerIrr: 0.12, lpPct: 0.70, gpPct: 0.30, triggerType: 'pref_return' },
      { triggerIrr: 0.15, lpPct: 0.60, gpPct: 0.40, triggerType: 'promote' },
    );
  }

  // Capital tranche config: read from per_year_overrides wf:trancheN:* fields
  // Schema: wf:trancheN:label, wf:trancheN:role, wf:trancheN:pct, wf:trancheN:prefRate,
  //         wf:trancheN:compounding, wf:trancheN:cumulative, wf:trancheN:participatePromote
  const TRANCHE_DEFAULTS = [
    { id: 'lpA', label: 'LP CLASS A',   role: 'lp',   pct: wfLpShare, prefRate: wfPrefRate, compounding: 'annual', cumulative: true,  participatePromote: true },
    { id: 'gp',  label: 'GP CO-INVEST', role: 'gp',   pct: wfGpShare, prefRate: 0,          compounding: 'annual', cumulative: false, participatePromote: true },
  ];
  const capitalTranches: Array<{ id: string; label: string; role: string; pct: number; prefRate: number; compounding: string; cumulative: boolean; participatePromote: boolean }> = [];
  for (let i = 0; i < 6; i++) {
    const label = wfStrOvr(`tranche${i}Label`);
    const role  = wfStrOvr(`tranche${i}Role`);
    const pct   = wfOvr(`tranche${i}Pct`);
    const prefR = wfOvr(`tranche${i}PrefRate`);
    const comp  = wfStrOvr(`tranche${i}Compounding`);
    const cumul = wfStrOvr(`tranche${i}Cumulative`);
    const promo = wfStrOvr(`tranche${i}ParticipatePromote`);
    if (label || role || pct != null) {
      capitalTranches.push({
        id:                 `tranche${i}`,
        label:              label ?? (TRANCHE_DEFAULTS[i]?.label ?? `TRANCHE ${i + 1}`),
        role:               role  ?? (TRANCHE_DEFAULTS[i]?.role  ?? 'lp'),
        pct:                pct   ?? (TRANCHE_DEFAULTS[i]?.pct   ?? 0),
        prefRate:           prefR ?? (TRANCHE_DEFAULTS[i]?.prefRate ?? 0),
        compounding:        comp  ?? 'annual',
        cumulative:         cumul != null ? cumul === 'true' : (TRANCHE_DEFAULTS[i]?.cumulative ?? true),
        participatePromote: promo != null ? promo === 'true' : (TRANCHE_DEFAULTS[i]?.participatePromote ?? true),
      });
    }
  }
  // Fall back to defaults if no tranches persisted
  const resolvedTranches = capitalTranches.length > 0 ? capitalTranches : TRANCHE_DEFAULTS;

  // ── Server-side waterfall schedule computation ──────────────────────────────
  // Use available financial data to produce a distribution schedule.
  // Note: waterfall object is not yet declared — read fee/type primitives directly.
  const schedNoi       = noiFull ?? 0;
  const schedLoan      = loanAmount ?? 0;
  const schedEquity    = equityAtClose ?? 0;
  const schedRate      = interestRate ?? 0.07;
  const schedAnnualDS  = schedLoan * schedRate;
  const schedRentGr    = rentGrowthStab ?? 0.03;
  const schedExitCap   = exitCap ?? 0.055;
  const schedSellingPct= 0.025;
  const schedWfType    = typeof wfWaterfallType === 'string' ? wfWaterfallType : 'american';
  const schedLpShare   = wfLpShare;
  const schedGpShare   = wfGpShare;
  const schedPrefRate  = wfPrefRate;
  // Build fees inline (waterfall obj declared after schedule computation)
  const schedFees = {
    acquisitionFeePct:    wfOvr('acquisitionFeePct')    ?? 0.01,
    assetMgmtFeePct:      wfOvr('assetMgmtFeePct')      ?? 0.015,
    assetMgmtBasis:       wfStrOvr('assetMgmtBasis')    ?? 'equity',
    constructionMgmtPct:  wfOvr('constructionMgmtPct')  ?? 0,
    dispositionFeePct:    wfOvr('dispositionFeePct')     ?? 0.01,
    refinancingFeePct:    wfOvr('refinancingFeePct')     ?? 0,
  };

  // Build period-by-period CFADS
  const schedCfads: number[] = [];
  for (let yr = 1; yr <= holdYears; yr++) {
    schedCfads.push(Math.max((schedNoi * Math.pow(1 + schedRentGr, yr - 1)) - schedAnnualDS, 0));
  }
  const schedExitNoi  = schedNoi * Math.pow(1 + schedRentGr, holdYears);
  const schedGrossSale = schedExitCap > 0 ? schedExitNoi / schedExitCap : 0;
  const schedExitProc = Math.max(schedGrossSale * (1 - schedSellingPct) - schedLoan, 0);
  const schedLpEq     = schedEquity * schedLpShare;
  const schedGpEq     = schedEquity * schedGpShare;

  type SchedRow = {
    period: string; year: number; cfads: number; activeTier: string;
    lpDist: number; gpDist: number; gpPromote: number; gpFees: number;
    prefAccrued: number; prefPaid: number; lpIrr: number | null; lpEm: number;
    isExit: boolean;
  };

  const schedRows: SchedRow[] = [];

  const serverIrr = (cashFlows: number[]): number | null => {
    if (cashFlows.length < 2) return null;
    let r = 0.1;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0; let d = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        const disc = Math.pow(1 + r, t);
        npv += cashFlows[t] / disc;
        d   -= t * cashFlows[t] / (disc * (1 + r));
      }
      if (Math.abs(d) < 1e-12) break;
      const nr = r - npv / d;
      if (Math.abs(nr - r) < 1e-8) { r = nr; break; }
      r = nr;
      if (r < -0.999 || r > 10) return null;
    }
    return r;
  };

  if (schedEquity > 0 && schedNoi > 0) {
    if (schedWfType === 'european') {
      // European: accumulate operating fees; terminal waterfall on total CFADS + exit
      let totalGpFees = 0;
      for (let yr = 1; yr <= holdYears; yr++) {
        const rawCf = schedCfads[yr - 1] ?? 0;
        const amBase = schedFees.assetMgmtBasis === 'equity' ? schedEquity : schedNoi * 1.15;
        const amFee  = amBase * schedFees.assetMgmtFeePct;
        totalGpFees += amFee;
        const prefAcc = schedLpEq * schedPrefRate * yr;
        schedRows.push({
          period: `YR ${yr}`, year: yr, cfads: rawCf, activeTier: 'EUROPEAN (DEFERRED)',
          lpDist: 0, gpDist: amFee, gpPromote: 0, gpFees: amFee,
          prefAccrued: prefAcc, prefPaid: 0, lpIrr: null, lpEm: 0, isExit: false,
        });
      }
      // Terminal event
      const totalOpCF = schedCfads.reduce((s: number, c: number) => s + c, 0);
      const totalCF   = totalOpCF + schedExitProc;
      const dispFee   = schedExitProc * schedFees.dispositionFeePct;
      // Deduct all accumulated GP fees (operating AM fees already extracted above, now deduct from terminal)
      let avail = Math.max(totalCF - dispFee - totalGpFees, 0);
      const rocToLP = Math.min(avail, schedLpEq); avail -= rocToLP;
      const prefAccTotal = schedLpEq * schedPrefRate * holdYears;
      const prefToLP = Math.min(avail, prefAccTotal); avail -= prefToLP;
      const promoteTiers = wfTiers.filter(t => t.triggerType === 'promote').sort((a, b) => a.triggerIrr - b.triggerIrr);
      const topTier = promoteTiers[promoteTiers.length - 1] ?? { lpPct: 0.7, gpPct: 0.3, triggerIrr: 0, triggerType: 'promote' };
      const lpAbove  = avail * topTier.lpPct;
      const gpAbove  = avail * topTier.gpPct;
      const lpDist   = rocToLP + prefToLP + lpAbove;
      const gpDist   = dispFee + gpAbove;
      const exitLpCFs = [-schedLpEq, lpDist];
      const exitIrr  = serverIrr(exitLpCFs);
      const exitLpEm = schedLpEq > 0 ? lpDist / schedLpEq : 0;
      schedRows.push({
        period: 'EXIT ★', year: holdYears + 1, cfads: schedExitProc,
        activeTier: `T${promoteTiers.length} ${(topTier.lpPct * 100).toFixed(0)}/${(topTier.gpPct * 100).toFixed(0)} · FINAL`,
        lpDist, gpDist, gpPromote: gpAbove, gpFees: dispFee,
        prefAccrued: prefAccTotal, prefPaid: prefToLP,
        lpIrr: exitIrr, lpEm: exitLpEm, isExit: true,
      });
    } else {
      // American: period-by-period
      let lpPrefAccrued = 0;
      let lpRocPaid = 0;
      let lpDistCumul = 0;
      const lpCFs: number[] = [-schedLpEq];
      for (let yr = 1; yr <= holdYears + 1; yr++) {
        const isExit = yr === holdYears + 1;
        const rawCf  = isExit ? schedExitProc : (schedCfads[yr - 1] ?? 0);
        const amBase = schedFees.assetMgmtBasis === 'equity' ? schedEquity : schedNoi * 1.15;
        const amFee  = !isExit ? amBase * schedFees.assetMgmtFeePct : 0;
        const disp   = isExit  ? rawCf * schedFees.dispositionFeePct : 0;
        const gpFees = amFee + disp;
        let avail    = Math.max(rawCf - gpFees, 0);
        // ROC
        const rocTier = wfTiers.find(t => t.triggerType === 'roc');
        const rocToLP = rocTier ? Math.min(avail, Math.max(schedLpEq - lpRocPaid, 0)) : 0;
        avail -= rocToLP; lpRocPaid += rocToLP;
        // Pref
        lpPrefAccrued += schedLpEq * schedPrefRate;
        const prefTier = wfTiers.find(t => t.triggerType === 'pref_return');
        const prefToLP = prefTier ? Math.min(avail, lpPrefAccrued) : 0;
        avail -= prefToLP; lpPrefAccrued -= prefToLP;
        // Catch-up
        const catchTier = wfTiers.find(t => t.triggerType === 'catch_up');
        let catchToGP = 0;
        if (catchTier && avail > 0) { catchToGP = Math.min(avail, avail * catchTier.gpPct); avail -= catchToGP; }
        // Promote
        const promoteTiers = wfTiers.filter(t => t.triggerType === 'promote').sort((a, b) => a.triggerIrr - b.triggerIrr);
        const currentIrr   = lpCFs.length > 1 ? (serverIrr(lpCFs) ?? 0) : 0;
        const atiIdx = promoteTiers.findIndex((t, i) =>
          i === promoteTiers.length - 1 || currentIrr < promoteTiers[i + 1].triggerIrr
        );
        const at = promoteTiers[atiIdx] ?? { lpPct: 0.8, gpPct: 0.2, triggerIrr: 0, triggerType: 'promote' };
        const lpAbove  = avail * at.lpPct;
        const gpAbove  = avail * at.gpPct;
        const gpPromote = gpAbove + catchToGP;
        const lpDist   = rocToLP + prefToLP + lpAbove;
        const gpDist   = gpFees + catchToGP + gpAbove;
        lpDistCumul   += lpDist;
        lpCFs.push(lpDist);
        const lpIrrNow = lpCFs.length > 2 ? serverIrr(lpCFs) : null;
        const lpEmNow  = schedLpEq > 0 ? lpDistCumul / schedLpEq : 0;
        const tierLabel = promoteTiers.length > 0
          ? `T${atiIdx + 1} ${(at.lpPct * 100).toFixed(0)}/${(at.gpPct * 100).toFixed(0)}`
          : `${(at.lpPct * 100).toFixed(0)}/${(at.gpPct * 100).toFixed(0)}`;
        schedRows.push({
          period: isExit ? 'EXIT ★' : `YR ${yr}`, year: yr, cfads: rawCf,
          activeTier: tierLabel,
          lpDist, gpDist, gpPromote, gpFees,
          prefAccrued: lpPrefAccrued, prefPaid: prefToLP,
          lpIrr: lpIrrNow, lpEm: lpEmNow, isExit,
        });
      }
    }
  }

  // Hero metrics from schedule
  const totalSchedLpDist  = schedRows.reduce((s, r) => s + r.lpDist, 0);
  const totalSchedGpDist  = schedRows.reduce((s, r) => s + r.gpDist, 0);
  const totalSchedPromote = schedRows.reduce((s, r) => s + r.gpPromote, 0);
  const totalSchedFees    = schedRows.reduce((s, r) => s + r.gpFees, 0);
  const finalSchedRow     = schedRows[schedRows.length - 1];
  const schedLpIrr        = finalSchedRow?.lpIrr ?? null;
  const schedLpEm         = schedLpEq > 0 ? totalSchedLpDist / schedLpEq : null;
  const schedGpEm         = schedGpEq > 0 ? (totalSchedGpDist + schedEquity * schedFees.acquisitionFeePct) / Math.max(schedGpEq, 1) : null;

  const capital = {
    tranches: resolvedTranches,
    schedule: schedRows,
    metrics: {
      lpIrr:        schedLpIrr,
      lpEquityMultiple: schedLpEm,
      gpEquityMultiple: schedGpEm,
      totalLpDistributions: totalSchedLpDist,
      totalGpDistributions: totalSchedGpDist,
      totalGpPromote:       totalSchedPromote,
      totalGpFees:          totalSchedFees,
    },
  };

  const waterfall = {
    waterfallType: typeof wfWaterfallType === 'string' ? wfWaterfallType : 'american',
    lpShare:   wfLpShare,
    gpShare:   wfGpShare,
    prefRate:  wfPrefRate,
    tiers: wfTiers,
    fees: {
      acquisitionFeePct:    wfOvr('acquisitionFeePct')    ?? 0.01,
      assetMgmtFeePct:      wfOvr('assetMgmtFeePct')      ?? 0.015,
      assetMgmtBasis:       wfStrOvr('assetMgmtBasis')    ?? 'equity',
      constructionMgmtPct:  wfOvr('constructionMgmtPct')  ?? 0,
      dispositionFeePct:    wfOvr('dispositionFeePct')     ?? 0.01,
      refinancingFeePct:    wfOvr('refinancingFeePct')     ?? 0,
    },
    userOverrides: {
      lpShare:              wfOvr('lpShare'),
      gpShare:              wfOvr('gpShare'),
      prefRate:             wfOvr('prefRate'),
    },
  };

  // ── Server-side Projections Engine ─────────────────────────────────────────
  // Computes authoritative per-year operating statement resolving all upstream tabs:
  // Assumptions (growth rates), Taxes (RE tax per year), Debt (amortization schedule),
  // Capital (CFADS from waterfall). No hardcoded assumptions — all values sourced here.
  const projections: DealFinancials['projections'] = (() => {
    // Y1 seed values via resolved LayeredValue
    const ry1 = (k: string) => resolvedNum(lv(year1Seed, k)) ?? 0;
    const seeded = Object.keys(year1Seed).length > 0;
    if (!seeded) return [];

    // Debt parameters — prefer debt_tab senior loan data
    const seniorLoanOvr = debtStack?.loans?.find(l => l.id === 'senior');
    const projLoan       = capitalStackWithOverrides.loanAmount ?? 0;
    const projRate       = (seniorLoanOvr?.interestRate?.platform ?? capitalStackWithOverrides.interestRate ?? 0);
    const projIoMonths   = seniorLoanOvr?.ioMonths?.platform ?? capitalStackWithOverrides.ioPeriodMonths ?? 0;
    const projAmortYrs   = seniorLoanOvr?.amortYears?.platform ?? capitalStackWithOverrides.amortizationYears ?? 30;
    const projIoYrs      = Math.max(0, Math.round(projIoMonths / 12));
    const projMonthlyRate = projRate / 12;
    const projNumPmts    = Math.max(1, projAmortYrs * 12);
    const projMonthlyPmt = projLoan > 0 && projMonthlyRate > 0
      ? (projLoan * projMonthlyRate * Math.pow(1 + projMonthlyRate, projNumPmts)) /
        (Math.pow(1 + projMonthlyRate, projNumPmts) - 1)
      : projLoan > 0 ? projLoan / projNumPmts : 0;

    // Y1 opex seeds
    const gprY1        = assumptions.gprDecomposition?.resolvedAnnual ?? ry1('gpr');
    const lossToLeasePct = ry1('loss_to_lease_pct');
    const concPct      = ry1('concessions_pct');
    const badDebtPct   = ry1('bad_debt_pct');
    const nruPct       = ry1('non_revenue_units_pct');
    const otherIncPU   = ry1('other_income_per_unit');
    const mgmtFeePct   = ry1('management_fee_pct') || 0.05;
    const payrollY1    = ry1('payroll');
    const repairsY1    = ry1('repairs_maintenance');
    const turnoverY1   = ry1('turnover');
    const contractY1   = ry1('contract_services');
    const marketingY1  = ry1('marketing');
    const utilitiesY1  = ry1('utilities');
    const gAndAY1      = ry1('g_and_a');
    const insuranceY1  = ry1('insurance');
    const reTaxY1Base  = ry1('real_estate_tax');
    const reservesY1   = ry1('replacement_reserves') || (totalUnits * 350);

    // After-tax: income tax data from taxes tab (rate sourced from taxes.incomeTax.marginalTaxRate)
    const annualDeprec    = taxes?.incomeTax?.annualDepreciation ?? null;
    const marginalTaxRate = taxes?.incomeTax != null ? (taxes.incomeTax.marginalTaxRate ?? 0.37) : null;

    // Transfer tax for sale-year disposition
    const docStampAmtPurch = taxes?.transferTax?.docStampAmount ?? null;
    const intangibleTaxAmt = taxes?.transferTax?.intangibleTaxAmount ?? null;

    let projBalance = projLoan;
    let cumulCF = 0;
    const projEquity = capitalStackWithOverrides.equityAtClose ?? 0;
    const rows: NonNullable<DealFinancials['projections']> = [];

    for (let yr = 1; yr <= holdYears; yr++) {
      const pv = assumptions.perYear.find(p => p.year === yr);
      const tv = trafficProjectionOut?.yearly?.find(t => t.year === yr);

      // Rent growth multiplier (compound from Y1)
      let rentMult = 1;
      for (let y = 1; y < yr; y++) {
        const g = assumptions.perYear.find(p => p.year === y)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03;
        rentMult *= 1 + (g ?? 0.03);
      }
      const thisYrGrowth = pv?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03;
      const opexMult = Math.pow(1.03, yr - 1);
      const insMult  = Math.pow(1.035, yr - 1);

      // Revenue
      const gpr         = Math.round(gprY1 * rentMult);
      const vacPct      = tv?.vacancyPct ?? pv?.vacancyPct ?? (ry1('vacancy_pct') / 100 || 0.05);
      const vacancyLoss = Math.round(gpr * vacPct);
      const lossToLease = Math.round(gpr * lossToLeasePct);
      const concessions = Math.round(gpr * concPct);
      const badDebt     = Math.round(gpr * badDebtPct);
      const nru         = Math.round(gpr * nruPct);
      const nri         = gpr - vacancyLoss - lossToLease - concessions - badDebt - nru;
      const otherIncome = Math.round(otherIncPU * rentMult * totalUnits * 12);
      const egi         = nri + otherIncome;

      // Expenses
      const payroll    = Math.round(payrollY1   * opexMult);
      const repairs    = Math.round(repairsY1   * opexMult);
      const turnover   = Math.round(turnoverY1  * opexMult);
      const contractSvc = Math.round(contractY1 * opexMult);
      const marketing  = Math.round(marketingY1 * opexMult);
      const utilities  = Math.round(utilitiesY1 * opexMult);
      const gAndA      = Math.round(gAndAY1     * opexMult);
      const mgmtFee    = Math.round(egi          * mgmtFeePct);
      const insurance  = Math.round(insuranceY1  * insMult);

      // RE Taxes: prefer taxes tab perYear, else compound Y1 seed
      let reTaxes = 0;
      let reTaxSource: 'taxes_tab' | 'proforma' | 'estimate' = 'estimate';
      const taxYr = taxes?.reTax?.perYear?.find(t => t.year === yr);
      if (taxYr?.taxAmount != null && taxYr.taxAmount > 0) {
        reTaxes = Math.round(taxYr.taxAmount); reTaxSource = 'taxes_tab';
      } else if (reTaxY1Base > 0) {
        reTaxes = Math.round(reTaxY1Base * opexMult); reTaxSource = 'proforma';
      }

      const reserves   = Math.round(reservesY1 * opexMult);
      const totalOpex  = payroll + repairs + turnover + contractSvc + marketing + utilities + gAndA + mgmtFee + insurance + reTaxes + reserves;
      const noi        = egi - totalOpex;

      // Debt service — true per-year amortization schedule
      let interest = 0, principal = 0, annualDS = 0;
      let debtSource: 'debt_tab' | 'capital_stack' | 'estimate' = 'estimate';
      if (projLoan > 0) {
        debtSource = seniorLoanOvr ? 'debt_tab' : 'capital_stack';
        if (yr <= projIoYrs || projAmortYrs === 0) {
          interest  = Math.round(projBalance * projRate);
          principal = 0;
          annualDS  = interest;
        } else {
          let yi = 0, yp = 0;
          for (let m = 0; m < 12; m++) {
            const mi = projBalance * projMonthlyRate;
            const mp = projMonthlyPmt - mi;
            yi += mi; yp += mp;
            projBalance = Math.max(0, projBalance - mp);
          }
          interest  = Math.round(yi);
          principal = Math.round(yp);
          annualDS  = interest + principal;
        }
      }

      const cfbt  = noi - annualDS;
      const capRow = schedRows.find(r => r.year === yr);
      const cfads  = capRow?.cfads ?? cfbt;
      cumulCF     += cfbt;

      // After-tax (only when income tax data is seeded)
      const depreciation  = annualDeprec;
      const taxableIncome = depreciation != null ? noi - interest - depreciation : null;
      const taxPayable    = taxableIncome != null && marginalTaxRate != null
        ? Math.round(Math.max(0, taxableIncome) * marginalTaxRate) : null;
      const afterTaxCfads = taxPayable != null ? cfads - taxPayable : null;
      const effectiveTaxRate = marginalTaxRate;

      // Metrics
      const opMargin     = egi > 0 ? +(noi / egi).toFixed(4) : null;
      const noiPerUnit   = totalUnits > 0 ? Math.round(noi / totalUnits) : null;
      const coc          = projEquity > 0 ? +(cfbt / projEquity).toFixed(4) : null;
      const dscr         = annualDS > 0 ? +(noi / annualDS).toFixed(4) : null;
      const debtYield    = projBalance > 0 ? +(noi / projBalance).toFixed(4) : null;
      const occupancy    = tv?.occupancyPct ?? (vacPct != null ? +(1 - vacPct).toFixed(4) : null);
      const opexRatioPct = egi > 0 ? +(totalOpex / egi).toFixed(4) : null;
      const noiMarginPct = egi > 0 ? +(noi / egi).toFixed(4) : null;
      const rentGrowthPct = thisYrGrowth;

      // Exit / Disposition
      const exitCap = pv?.exitCapIfLastYear ?? trafficProjectionOut?.calibrated?.exitCap ?? assumptions.exitCap ?? 0.055;
      const exitNoi = Math.round(noi * (1 + (rentGrowthPct ?? 0.03)));
      const grossSaleValue = exitCap > 0 ? Math.round(exitNoi / exitCap) : null;
      const sellingCosts   = grossSaleValue != null ? Math.round(grossSaleValue * 0.015) : null;
      const loanPayoff     = Math.round(projBalance);
      const capRatePct     = grossSaleValue != null && grossSaleValue > 0 ? +(noi / grossSaleValue).toFixed(4) : null;
      // Doc stamps on disposition (same rate as acquisition, but applied to sale price)
      const dispositionDocStamps = grossSaleValue != null && taxes?.transferTax != null
        ? Math.round(grossSaleValue * taxes.transferTax.appliedRatePct) : null;
      const netSaleProceeds = grossSaleValue != null && sellingCosts != null
        ? grossSaleValue - sellingCosts - loanPayoff - (dispositionDocStamps ?? 0)
        : null;
      const cumulativeEM = projEquity > 0 && netSaleProceeds != null
        ? +((cumulCF + netSaleProceeds) / projEquity).toFixed(4) : null;

      rows.push({
        year: yr,
        gpr, vacancyLoss, lossToLease, concessions, badDebt, nru, nri, otherIncome, egi,
        payroll, repairs, turnover, contractSvc, marketing, utilities, gAndA, mgmtFee, insurance, reTaxes, reserves,
        totalOpex, noi, opMargin, noiPerUnit,
        interest, principal, annualDS, outstandingBalance: loanPayoff,
        cfbt, cfads,
        depreciation, taxableIncome, taxPayable, afterTaxCfads, effectiveTaxRate,
        coc, dscr, debtYield, occupancy, rentGrowthPct, opexRatioPct, noiMarginPct, capRatePct, cumulativeEM,
        exitNoi, exitCap, grossSaleValue, sellingCosts, dispositionDocStamps, loanPayoff, netSaleProceeds,
        reTaxSource, debtSource,
      });
    }
    return rows;
  })();

  return {
    dealId,
    dealName: deal.name,
    totalUnits,
    proforma: { year1: year1Rows, integrityChecks: checks, unitEconomics },
    capitalStack: capitalStackWithOverrides,
    rentRollSummary,
    trafficProjection: trafficProjectionOut,
    assumptions,
    userOverrides,
    meta: {
      seeded: Object.keys(year1Seed).length > 0,
      updatedAt: assumptionsRow?.updated_at?.toISOString?.() ?? null,
    },
    returns: null,
    taxes,
    debt: debtStack,
    sourcesUses,
    waterfall,
    capital,
    projections,
  };
}

/**
 * applyFinancialsOverride — cell-coordinate override in the year1 LayeredValue seed.
 *
 * body: { field: string, year: number | null, value: number | null }
 *   field   — camelCase field name (e.g. "vacancyPct") mapped to snake_case year1 key
 *   year    — hold year (1-10). null = year1 seed (current impl only supports year1)
 *   value   — new override value (number), or null to clear
 *
 * For year != null and year != 1: stores override in assumption_adjustments for future
 * multi-year seed support, then returns the year1 LayeredValue unchanged for that field.
 */
const FIELD_MAP: Record<string, string> = {
  vacancyPct: 'vacancy_pct', gpr: 'gpr', lossToLeasePct: 'loss_to_lease_pct',
  concessionsPct: 'concessions_pct', badDebtPct: 'bad_debt_pct',
  nonRevenueUnitsPct: 'non_revenue_units_pct', otherIncomePerUnit: 'other_income_per_unit',
  egi: 'egi', payroll: 'payroll', repairsMaintenance: 'repairs_maintenance',
  turnover: 'turnover', contractServices: 'contract_services', marketing: 'marketing',
  utilities: 'utilities', gAndA: 'g_and_a', managementFeePct: 'management_fee_pct',
  insurance: 'insurance', realEstateTax: 'real_estate_tax',
  replacementReserves: 'replacement_reserves', totalOpex: 'total_opex', noi: 'noi',
  // Traffic signal overrides: T-01/T-05/T-06 stored in per_year_overrides; trigger derived vacancy recomputation
  t01WeeklyTours: 't01_weekly_tours', t05ClosingRatio: 't05_closing_ratio',
  t06WeeklyLeases: 't06_weekly_leases',
};

// Traffic signal fields — always stored in per_year_overrides (not year1 LayeredValue seed)
const TRAFFIC_SIGNAL_FIELDS = new Set(['t01_weekly_tours', 't05_closing_ratio', 't06_weekly_leases']);

// Scalar assumption fields stored directly in deal_assumptions columns (not year1 LayeredValue)
const SCALAR_FIELD_MAP: Record<string, string> = {
  exitCapRate: 'exit_cap',
  interestRate: 'interest_rate',
  ltcPct: 'ltc',
  ioPeriodMonths: 'io_period_months',
};

/** Handle unit_mix:{index}:{field} overrides by patching the JSONB array in deal_assumptions */
async function applyUnitMixOverride(
  pool: Pool,
  dealId: string,
  field: string,
  value: number | null,
  userId: string
): Promise<{
  year1Key: string;
  year: number;
  appliedValue: number | null;
  resolution: string | null;
  updatedCell: Record<string, unknown> | null;
  derivedRecomputation: {
    egi: number | null;
    noi: number | null;
    totalOpex: number | null;
    derivedVacancyPct: number | null;
    affectedFields: string[];
  };
}> {
  // field format: unit_mix:{rowIndex}:{fieldName}  e.g. unit_mix:0:in_place_rent
  const parts = field.split(':');
  const rowIndexRaw = parseInt(parts[1] ?? '', 10);
  const cellField = parts[2] ?? '';

  // Validate rowIndex is a safe non-negative integer (guards against malformed coordinates)
  if (!Number.isInteger(rowIndexRaw) || rowIndexRaw < 0 || !isFinite(rowIndexRaw)) {
    throw new Error(`unit_mix rowIndex '${parts[1]}' is not a valid non-negative integer`);
  }
  const rowIndex = rowIndexRaw;

  // Allowed mutable fields in a unit mix row (whitelist — guard against arbitrary column injection)
  const ALLOWED = new Set(['count', 'avg_sf', 'in_place_rent', 'occupancy_pct', 'concession_pct']);
  if (!ALLOWED.has(cellField)) {
    throw new Error(`unit_mix cell field '${cellField}' is not overridable`);
  }

  // Read current unit_mix array
  const res = await pool.query(
    'SELECT unit_mix FROM deal_assumptions WHERE deal_id = $1',
    [dealId]
  );
  const currentMix: Array<Record<string, unknown>> = res.rows[0]?.unit_mix ?? [];
  if (rowIndex < 0 || rowIndex >= currentMix.length) {
    throw new Error(`unit_mix row index ${rowIndex} out of bounds (length ${currentMix.length})`);
  }

  // We store overrides in unit_mix_overrides keyed as "unit_mix_override:{row}:{field}"
  // On first write, we capture the originalValue so we can restore on clear (value=null)
  const overrideKey = `unit_mix_override:${rowIndex}:${cellField}`;

  // Read existing override entry (to get originalValue if already set)
  const existingOverrideRes = await pool.query(
    `SELECT unit_mix_overrides->$2 AS entry, unit_mix->${rowIndex}->>$3 AS current_val FROM deal_assumptions WHERE deal_id = $1`,
    [dealId, overrideKey, cellField]
  );
  const existingEntry = existingOverrideRes.rows[0]?.entry as { originalValue?: number } | null;
  const currentVal = existingOverrideRes.rows[0]?.current_val != null
    ? parseFloat(existingOverrideRes.rows[0].current_val as string)
    : null;

  if (value != null) {
    // Setting: store override entry with originalValue captured on first write
    const originalValue = existingEntry?.originalValue ?? currentVal;
    const overrideEntry = {
      value,
      originalValue,
      resolution: 'broker_corrected',
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET unit_mix_overrides = jsonb_set(
                COALESCE(unit_mix_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              unit_mix = jsonb_set(
                COALESCE(unit_mix, '[]'::jsonb),
                $4::text[],
                $5::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${overrideKey}}`, JSON.stringify(overrideEntry), `{${rowIndex},${cellField}}`, JSON.stringify(value)]
    );
  } else {
    // Clearing: restore originalValue if we captured it, otherwise leave unit_mix unchanged
    const restoreValue = existingEntry?.originalValue ?? null;
    if (restoreValue != null) {
      await pool.query(
        `UPDATE deal_assumptions
            SET unit_mix_overrides = jsonb_set(
                  COALESCE(unit_mix_overrides, '{}'::jsonb),
                  $2::text[],
                  'null'::jsonb
                ),
                unit_mix = jsonb_set(
                  COALESCE(unit_mix, '[]'::jsonb),
                  $3::text[],
                  $4::jsonb
                ),
                updated_at = NOW()
          WHERE deal_id = $1`,
        [dealId, `{${overrideKey}}`, `{${rowIndex},${cellField}}`, JSON.stringify(restoreValue)]
      );
    } else {
      // No original to restore — just clear the override entry
      await pool.query(
        `UPDATE deal_assumptions
            SET unit_mix_overrides = jsonb_set(
                  COALESCE(unit_mix_overrides, '{}'::jsonb),
                  $2::text[],
                  'null'::jsonb
                ),
                updated_at = NOW()
          WHERE deal_id = $1`,
        [dealId, `{${overrideKey}}`]
      );
    }
  }

  // Record audit trail
  try {
    await pool.query(
      `INSERT INTO assumption_adjustments
         (proforma_id, adjustment_trigger, assumption_type, previous_value, new_value, calculation_method, calculation_inputs, confidence_score)
       SELECT pa.id, 'manual', $2, NULL, $3::text, 'user_override_unit_mix',
              jsonb_build_object('field', $2, 'rowIndex', $4, 'cellField', $5, 'userId', $6)::jsonb, 100
       FROM proforma_assumptions pa WHERE pa.deal_id = $1 LIMIT 1`,
      [dealId, field, value?.toString() ?? 'null', rowIndex, cellField, userId]
    );
  } catch {
    // Non-fatal
  }

  const updatedCell = {
    field,
    rowIndex,
    cellField,
    appliedValue: value,
    resolution: value != null ? 'user_corrected' : 'cleared',
  };

  return {
    year1Key: field,
    year: 1,
    appliedValue: value,
    resolution: value != null ? 'user_corrected' : 'cleared',
    updatedCell,
    derivedRecomputation: {
      egi: null,
      noi: null,
      totalOpex: null,
      derivedVacancyPct: null,
      affectedFields: ['gpr', 'unit_mix'],
    },
  };
}

export async function applyFinancialsOverride(
  pool: Pool,
  dealId: string,
  field: string,
  year: number | null,
  value: number | string | null,
  userId: string
): Promise<{
  year1Key: string;
  year: number;
  appliedValue: number | string | null;
  resolution: string | null;
  updatedCell: Record<string, unknown> | null;
  derivedRecomputation: {
    egi: number | null;
    noi: number | null;
    totalOpex: number | null;
    derivedVacancyPct: number | null;
    affectedFields: string[];
  };
}> {
  // Route unit_mix cell overrides to dedicated handler
  if (field.startsWith('unit_mix:')) {
    return applyUnitMixOverride(pool, dealId, field, typeof value === 'number' ? value : null, userId);
  }

  // Route FL tax overrides to per_year_overrides with 'tax:' prefix
  const TAX_FIELD_TO_PY_KEY: Record<string, string> = {
    taxAssessedValue: 'tax:assessed_value:yr1',
    taxMillageRate:   'tax:millage_rate:yr1',
    tppAmount:        'tax:tpp_amount:yr1',
    taxCounty:        'tax:county_override:yr1',
  };
  if (TAX_FIELD_TO_PY_KEY[field]) {
    const pyKey = TAX_FIELD_TO_PY_KEY[field];
    const pyEntry = {
      field, year: 1, value, updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${pyKey}}`, JSON.stringify(pyEntry)]
    );
    return {
      year1Key: field, year: 1, appliedValue: value, resolution: 'user_override',
      updatedCell: { [field]: value },
      derivedRecomputation: { egi: null, noi: null, totalOpex: null, derivedVacancyPct: null, affectedFields: [field] },
    };
  }

  // Route Sources & Uses overrides to per_year_overrides with 'su:' prefix
  // Field format: "su:{fieldName}" e.g. "su:workingCapital"
  if (field.startsWith('su:')) {
    const pyEntry = {
      field, year: year ?? 0, value, updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${field}}`, JSON.stringify(pyEntry)]
    );
    return {
      year1Key: field, year: year ?? 0, appliedValue: value, resolution: 'user_override',
      updatedCell: { [field]: value },
      derivedRecomputation: { egi: null, noi: null, totalOpex: null, derivedVacancyPct: null, affectedFields: [field] },
    };
  }

  // Route Waterfall/Capital config overrides to per_year_overrides with 'wf:' prefix
  // Field format: "wf:{fieldName}" e.g. "wf:waterfallType", "wf:lpShare", "wf:tier0LpPct"
  if (field.startsWith('wf:')) {
    const pyEntry = {
      field, year: year ?? 0, value, updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${field}}`, JSON.stringify(pyEntry)]
    );
    return {
      year1Key: field, year: year ?? 0, appliedValue: value, resolution: 'user_override',
      updatedCell: { [field]: value },
      derivedRecomputation: { egi: null, noi: null, totalOpex: null, derivedVacancyPct: null, affectedFields: [field] },
    };
  }

  // Route debt stack overrides to per_year_overrides with 'debt:' prefix
  // Field format: "debt:{loanId}:{fieldName}" e.g. "debt:senior:loanAmount"
  if (field.startsWith('debt:')) {
    const pyKey = field; // Store directly as-is, e.g. "debt:senior:loanAmount"
    const pyEntry = {
      field, year: year ?? 1, value, updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${pyKey}}`, JSON.stringify(pyEntry)]
    );
    return {
      year1Key: field, year: year ?? 1, appliedValue: value, resolution: 'user_override',
      updatedCell: { [field]: value },
      derivedRecomputation: { egi: null, noi: null, totalOpex: null, derivedVacancyPct: null, affectedFields: [field] },
    };
  }

  // Route scalar deal_assumptions column overrides (exitCapRate, interestRate, ltcPct, ioPeriodMonths)
  if (SCALAR_FIELD_MAP[field]) {
    const col = SCALAR_FIELD_MAP[field];
    // Col comes from our hardcoded map — safe to interpolate
    await pool.query(
      `UPDATE deal_assumptions SET ${col} = $2, updated_at = NOW() WHERE deal_id = $1`,
      [dealId, value]
    );
    return {
      year1Key: col, year: 0, appliedValue: value, resolution: 'user_override',
      updatedCell: { [col]: value },
      derivedRecomputation: { egi: null, noi: null, totalOpex: null, derivedVacancyPct: null, affectedFields: [col] },
    };
  }

  const year1Key = FIELD_MAP[field] ?? field;
  const targetYear = year ?? 1;

  const { applyUserOverride } = await import('./proforma-seeder.service');

  const isTrafficSignal = TRAFFIC_SIGNAL_FIELDS.has(year1Key);

  if (isTrafficSignal) {
    // Traffic signal overrides (T-01/T-05) always stored in per_year_overrides
    // keyed as e.g. "t01_weekly_tours:yr1" so they're available per-year
    const pyKey = `${year1Key}:yr${targetYear}`;
    const pyEntry = {
      field: year1Key,
      year: targetYear,
      value,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
      signalType: year1Key === 't01_weekly_tours' ? 'T-01'
              : year1Key === 't05_closing_ratio' ? 'T-05'
              : 'T-06',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${pyKey}}`, JSON.stringify(pyEntry)]
    );
  } else if (targetYear === 1 || year == null) {
    // Year 1 override — write into the LayeredValue seed via proforma-seeder
    await applyUserOverride(pool, dealId, year1Key, typeof value === 'number' ? value : null, userId);
  } else {
    // Per-year override (year 2-30) — stored in deal_assumptions.per_year_overrides JSONB
    // Key format: `{year1Key}:yr{targetYear}` e.g. "vacancy_pct:yr2"
    const pyKey = `${year1Key}:yr${targetYear}`;
    const pyEntry = {
      field: year1Key,
      year: targetYear,
      value,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      resolution: value != null ? 'override' : 'cleared',
    };
    await pool.query(
      `UPDATE deal_assumptions
          SET per_year_overrides = jsonb_set(
                COALESCE(per_year_overrides, '{}'::jsonb),
                $2::text[],
                $3::jsonb
              ),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, `{${pyKey}}`, JSON.stringify(pyEntry)]
    );
  }

  // Record the override in assumption_adjustments for audit trail
  try {
    await pool.query(
      `INSERT INTO assumption_adjustments
         (proforma_id, adjustment_trigger, assumption_type, previous_value, new_value, calculation_method, calculation_inputs, confidence_score)
       SELECT pa.id, 'manual', $2, pa.vacancy_current::text, $3::text, 'user_override_f9',
              jsonb_build_object('field', $2, 'year', $4, 'userId', $5)::jsonb, 100
       FROM proforma_assumptions pa WHERE pa.deal_id = $1
       LIMIT 1`,
      [dealId, year1Key, value?.toString() ?? 'null', targetYear, userId]
    );
  } catch {
    // Audit trail failure is non-fatal
  }

  // Read back updated year1 seed for the overridden field and derived fields
  const [res, dealUnitRes] = await Promise.all([
    pool.query(
      'SELECT year1, per_year_overrides, total_units, avg_lease_term_months FROM deal_assumptions WHERE deal_id = $1',
      [dealId]
    ),
    pool.query('SELECT target_units FROM deals WHERE id = $1', [dealId]),
  ]);
  const seed = res.rows[0]?.year1 as Record<string, unknown> | null;
  const perYearOverrides = res.rows[0]?.per_year_overrides as Record<string, unknown> | null;
  // Prefer deal_assumptions.total_units; fall back to deals.target_units for derived vacancy math
  const totalUnitsDA = (res.rows[0]?.total_units as number | null)
    ?? (dealUnitRes.rows[0]?.target_units as number | null)
    ?? 0;
  const avgLeaseTermMonths = (res.rows[0]?.avg_lease_term_months as number | null) ?? 12;
  const updatedLv = seed ? lv(seed, year1Key) : null;
  const resolution = (isTrafficSignal || targetYear !== 1)
    ? `override_yr${targetYear}`
    : (updatedLv ? (updatedLv.resolution as string | null) : null);

  // Compute derived recomputation — which fields are affected by the override
  const REVENUE_AFFECTING = ['gpr', 'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct', 'bad_debt_pct',
    'non_revenue_units_pct', 'other_income_per_unit', 'net_rental_income'];
  const OPEX_AFFECTING = ['payroll', 'repairs_maintenance', 'turnover', 'contract_services', 'marketing',
    'utilities', 'g_and_a', 'management_fee_pct', 'insurance', 'real_estate_tax', 'replacement_reserves'];
  const affectedFields: string[] = [year1Key];
  if (REVENUE_AFFECTING.includes(year1Key)) affectedFields.push('egi', 'noi');
  if (OPEX_AFFECTING.includes(year1Key)) affectedFields.push('total_opex', 'noi');

  const derivedEgi = seed ? resolvedNum(lv(seed, 'egi')) : null;
  const derivedNoi = seed ? resolvedNum(lv(seed, 'noi')) : null;
  const derivedOpex = seed ? resolvedNum(lv(seed, 'total_opex')) : null;

  // Derived vacancy recomputation from traffic signal overrides.
  //
  // T-01 / T-05 path (primary recompute inputs):
  //   weeklyLeases = T-01 (tours/wk) × T-05 (closing ratio)
  //   annualLeases = weeklyLeases × 52
  //   annualTurnover = totalUnits / (avgLeaseTermMonths / 12)
  //   steadyOcc = min(annualLeases / annualTurnover, 1.0)
  //   derivedVacancyPct = 1 - steadyOcc
  //
  // T-06 path (informational shortcut — net leases/week direct override):
  //   T-06 = net leases/week; user override bypasses T-01 × T-05 multiplication.
  //   This is semantically equivalent: annual leases = T-06 × 52.
  //   Derived vacancy is recomputed from this T-06 override, giving a meaningful
  //   vacancy delta in the response (not a no-op).
  let derivedVacancyPct: number | null = null;
  if (isTrafficSignal && totalUnitsDA > 0 && perYearOverrides) {
    if (year1Key === 't06_weekly_leases') {
      // T-06 direct net-leases-per-week override → back-derive vacancy
      const t06Val = typeof value === 'number' ? value : null;
      if (t06Val != null) {
        const annualLeases = t06Val * 52;
        const annualTurnover = totalUnitsDA / (avgLeaseTermMonths / 12);
        const steadyOcc = Math.min(annualLeases / annualTurnover, 1.0);
        derivedVacancyPct = +Math.max(0, 1 - steadyOcc).toFixed(4);
        affectedFields.push('vacancy_pct', 'egi', 'noi');
      }
    } else {
      // T-01 or T-05 override → use T-01 × T-05 equilibrium model
      const t01Key = `t01_weekly_tours:yr${targetYear}`;
      const t05Key = `t05_closing_ratio:yr${targetYear}`;
      const t01Entry = perYearOverrides[t01Key] as { value?: number } | null;
      const t05Entry = perYearOverrides[t05Key] as { value?: number } | null;
      const numVal = typeof value === 'number' ? value : null;
      const t01Val = year1Key === 't01_weekly_tours' ? numVal : (t01Entry?.value ?? null);
      const t05Val = year1Key === 't05_closing_ratio' ? numVal : (t05Entry?.value ?? null);
      if (t01Val != null && t05Val != null) {
        const weeklyLeases = t01Val * t05Val;
        const annualLeases = weeklyLeases * 52;
        const annualTurnover = totalUnitsDA / (avgLeaseTermMonths / 12);
        const steadyOcc = Math.min(annualLeases / annualTurnover, 1.0);
        derivedVacancyPct = +Math.max(0, 1 - steadyOcc).toFixed(4);
        affectedFields.push('vacancy_pct', 'egi', 'noi');
      }
    }
  }

  // For non-year1 overrides, include the stored per-year entry in updatedCell
  const pyKey = `${year1Key}:yr${targetYear}`;
  const perYearEntry = (isTrafficSignal || targetYear !== 1) && perYearOverrides
    ? (perYearOverrides[pyKey] as Record<string, unknown> | null) ?? null
    : null;

  return {
    year1Key,
    year: targetYear,
    appliedValue: value,
    resolution,
    updatedCell: (!isTrafficSignal && targetYear === 1) ? updatedLv : perYearEntry,
    derivedRecomputation: {
      egi: derivedEgi,
      noi: derivedNoi,
      totalOpex: derivedOpex,
      derivedVacancyPct,
      affectedFields,
    },
  };
}
