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

export interface DealFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  proforma: {
    year1: OperatingStatementRow[];
    integrityChecks: IntegrityCheck[];
    unitEconomics: Record<string, number | null>;
  };
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
  };
  meta: {
    seeded: boolean;
    updatedAt: string | null;
  };
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

  const [dealRes, assumptionsRes, proformaAssumRes, trafficProjection] = await Promise.all([
    pool.query(
      'SELECT id, name, city, state_code, target_units FROM deals WHERE id = $1',
      [dealId]
    ),
    pool.query(
      `SELECT year1, total_units, updated_at,
              exit_cap, rent_growth_yr1, rent_growth_stabilized, hold_period_years,
              interest_rate, ltc, avg_lease_term_months, per_year_overrides
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

  const assumptions = {
    holdYears,
    exitCap,
    rentGrowthYr1,
    rentGrowthStabilized: rentGrowthStab,
    perYear,
  };

  return {
    dealId,
    dealName: deal.name,
    totalUnits,
    proforma: { year1: year1Rows, integrityChecks: checks, unitEconomics },
    trafficProjection: trafficProjectionOut,
    assumptions,
    meta: {
      seeded: Object.keys(year1Seed).length > 0,
      updatedAt: assumptionsRow?.updated_at?.toISOString?.() ?? null,
    },
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
};

export async function applyFinancialsOverride(
  pool: Pool,
  dealId: string,
  field: string,
  year: number | null,
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
    affectedFields: string[];
  };
}> {
  const year1Key = FIELD_MAP[field] ?? field;
  const targetYear = year ?? 1;

  const { applyUserOverride } = await import('./proforma-seeder.service');

  if (targetYear === 1 || year == null) {
    // Year 1 override — write into the LayeredValue seed via proforma-seeder
    await applyUserOverride(pool, dealId, year1Key, value, userId);
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
  const res = await pool.query(
    'SELECT year1, per_year_overrides, total_units FROM deal_assumptions WHERE deal_id = $1',
    [dealId]
  );
  const seed = res.rows[0]?.year1 as Record<string, unknown> | null;
  const perYearOverrides = res.rows[0]?.per_year_overrides as Record<string, unknown> | null;
  const updatedLv = seed ? lv(seed, year1Key) : null;
  const resolution = targetYear === 1
    ? (updatedLv ? (updatedLv.resolution as string | null) : null)
    : `override_yr${targetYear}`;

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

  // For non-year1 overrides, include the stored per-year entry in updatedCell
  const pyKey = `${year1Key}:yr${targetYear}`;
  const perYearEntry = (targetYear !== 1 && perYearOverrides)
    ? (perYearOverrides[pyKey] as Record<string, unknown> | null) ?? null
    : null;

  return {
    year1Key,
    year: targetYear,
    appliedValue: value,
    resolution,
    updatedCell: targetYear === 1 ? updatedLv : perYearEntry,
    derivedRecomputation: {
      egi: derivedEgi,
      noi: derivedNoi,
      totalOpex: derivedOpex,
      affectedFields,
    },
  };
}
