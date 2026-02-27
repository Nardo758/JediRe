/**
 * Risk Scoring Service
 * Phase 2, Component 3: Supply Risk + Demand Risk Implementation
 * 
 * Calculates risk scores (0-100) for 6 risk categories (2 implemented, 4 placeholders):
 * - Supply Risk (35% of Risk Score): Pipeline units, absorption rates
 * - Demand Risk (35% of Risk Score): Employer concentration, demand drivers
 * - Regulatory Risk (10%): Placeholder for Phase 3
 * - Market Risk (10%): Placeholder for Phase 3
 * - Execution Risk (5%): Placeholder for Phase 3
 * - Climate Risk (5%): Placeholder for Phase 3
 * 
 * Risk Score is 10% of total JEDI Score
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface RiskScore {
  tradeAreaId: string;
  categoryName: string;
  riskScore: number;
  baseScore: number;
  escalationAdjustment: number;
  deEscalationAdjustment: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  calculatedAt: Date;
}

export interface CompositeRiskProfile {
  tradeAreaId: string;
  supplyRisk: number;
  demandRisk: number;
  regulatoryRisk: number;
  marketRisk: number;
  executionRisk: number;
  climateRisk: number;
  compositeScore: number;
  highestCategory: string;
  highestCategoryScore: number;
  secondHighestCategory: string;
  secondHighestCategoryScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  calculatedAt: Date;
}

export interface SupplyRiskCalculation {
  pipelineUnits: number;
  existingUnits: number;
  absorptionRate: number;
  monthsToAbsorb: number;
  absorptionFactor: number;
  baseScore: number;
  escalations: EscalationImpact[];
  deEscalations: DeEscalationImpact[];
  finalScore: number;
}

export interface DemandRiskCalculation {
  topEmployerPct: number;
  employerConcentrationIndex: number;
  dependencyFactor: number;
  baseScore: number;
  escalations: EscalationImpact[];
  deEscalations: DeEscalationImpact[];
  finalScore: number;
}

export interface EscalationImpact {
  eventId: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  scoreImpact: number;
  triggerDescription: string;
  appliedAt: Date;
}

export interface DeEscalationImpact {
  eventId: string;
  scoreImpact: number;
  reason: string;
  appliedAt: Date;
}

export interface RiskEvent {
  id: string;
  tradeAreaId: string;
  riskCategoryId: number;
  eventType: string;
  headline: string;
  description: string;
  eventDate: Date;
  riskImpactType: 'escalation' | 'de_escalation' | 'neutral';
  riskScoreChange: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  probability: number;
  isActive: boolean;
}

// ============================================================================
// Risk Scoring Service
// ============================================================================

export class RiskScoringService {
  // Risk category weights (for composite risk calculation)
  private readonly CATEGORY_WEIGHTS = {
    supply: 0.35,
    demand: 0.35,
    regulatory: 0.10,
    market: 0.10,
    execution: 0.05,
    climate: 0.05,
  };

  // Escalation thresholds for supply risk
  private readonly SUPPLY_ESCALATION_RULES = {
    CRITICAL: { minUnits: 500, timeframe: 6, scoreImpact: [25, 40] },
    HIGH: { minUnits: 200, probability: 0.5, scoreImpact: [15, 25] },
    MODERATE: { minUnits: 50, probability: 0.2, scoreImpact: [5, 15] },
    LOW: { minUnits: 0, probability: 0.0, scoreImpact: [1, 5] },
  };

  // Escalation thresholds for demand risk
  private readonly DEMAND_ESCALATION_RULES = {
    CRITICAL: { trigger: 'employer_exit', scoreImpact: [25, 40] },
    HIGH: { trigger: 'layoff_major', layoffPct: 0.2, scoreImpact: [15, 25] },
    MODERATE: { trigger: 'remote_policy_shift', scoreImpact: [5, 15] },
    LOW: { trigger: 'workforce_reduction_minor', layoffPct: 0.1, scoreImpact: [1, 5] },
  };

  /**
   * Calculate Supply Risk Score (0-100)
   * 
   * Formula: (Pipeline Units ÷ Existing Units) × 100 × Absorption Factor
   * 
   * Absorption Factor:
   * - <12 months: 0.5x (healthy)
   * - 12-24 months: 1.0x (normal)
   * - 24-36 months: 1.5x (concerning)
   * - >36 months: 2.0x (critical)
   */
  async calculateSupplyRisk(tradeAreaId: string): Promise<SupplyRiskCalculation> {
    // Get existing units in trade area
    const existingResult = await query(
      `SELECT 
         COALESCE(SUM(p.unit_count), 0) as existing_units
       FROM properties p
       JOIN trade_areas ta ON ta.property_id = p.id
       WHERE ta.id = $1`,
      [tradeAreaId]
    );
    const existingUnits = parseInt(existingResult.rows[0]?.existing_units) || 1000; // Default baseline

    // Get pipeline projects
    const pipelineResult = await query(
      `SELECT 
         COALESCE(SUM(total_units), 0) as pipeline_units,
         COUNT(*) as project_count
       FROM supply_pipeline_projects
       WHERE trade_area_id = $1
         AND project_status IN ('permitted', 'announced', 'under_construction')
         AND (expected_delivery_date IS NULL OR expected_delivery_date <= NOW() + INTERVAL '36 months')`,
      [tradeAreaId]
    );
    const pipelineUnits = parseInt(pipelineResult.rows[0]?.pipeline_units) || 0;

    // Get absorption tracking data
    const absorptionResult = await query(
      `SELECT 
         absorption_rate,
         months_to_absorb,
         absorption_factor
       FROM supply_absorption_tracking
       WHERE trade_area_id = $1
       ORDER BY period_start DESC
       LIMIT 1`,
      [tradeAreaId]
    );

    let absorptionRate = parseFloat(absorptionResult.rows[0]?.absorption_rate) || 0;
    let monthsToAbsorb = parseFloat(absorptionResult.rows[0]?.months_to_absorb) || 0;
    let absorptionFactor = parseFloat(absorptionResult.rows[0]?.absorption_factor) || 1.0;

    // Calculate absorption if not tracked
    if (absorptionRate === 0 && pipelineUnits > 0) {
      // Estimate absorption rate as 5% of existing units per month
      absorptionRate = existingUnits * 0.05;
      monthsToAbsorb = absorptionRate > 0 ? pipelineUnits / absorptionRate : 999;
      
      // Calculate absorption factor
      if (monthsToAbsorb < 12) {
        absorptionFactor = 0.5; // Healthy
      } else if (monthsToAbsorb < 24) {
        absorptionFactor = 1.0; // Normal
      } else if (monthsToAbsorb < 36) {
        absorptionFactor = 1.5; // Concerning
      } else {
        absorptionFactor = 2.0; // Critical
      }
    }

    // Calculate base supply risk score
    const supplyRatio = existingUnits > 0 ? (pipelineUnits / existingUnits) : 0;
    const baseScore = Math.min(100, supplyRatio * 100 * absorptionFactor);

    // Get active escalations
    const escalations = await this.getActiveEscalations(tradeAreaId, 'supply');
    const escalationTotal = escalations.reduce((sum, e) => sum + e.scoreImpact, 0);

    // Get active de-escalations
    const deEscalations = await this.getActiveDeEscalations(tradeAreaId, 'supply');
    const deEscalationTotal = deEscalations.reduce((sum, e) => sum + e.scoreImpact, 0);

    // Final score (capped at 0-100)
    const finalScore = Math.max(0, Math.min(100, baseScore + escalationTotal + deEscalationTotal));

    return {
      pipelineUnits,
      existingUnits,
      absorptionRate,
      monthsToAbsorb,
      absorptionFactor,
      baseScore: parseFloat(baseScore.toFixed(2)),
      escalations,
      deEscalations,
      finalScore: parseFloat(finalScore.toFixed(2)),
    };
  }

  /**
   * Apply Supply Risk Escalation Rules
   * 
   * Escalation Triggers:
   * - CRITICAL: Confirmed delivery of 500+ units within 6 months → +25 to +40
   * - HIGH: Announced project >200 units, >50% probability → +15 to +25
   * - MODERATE: Permitted project, 20-50% probability → +5 to +15
   * - LOW: Rumored project, <20% probability → +1 to +5
   */
  async applySupplyEscalation(
    tradeAreaId: string,
    projectId: string,
    units: number,
    probability: number,
    deliveryMonths: number
  ): Promise<string> {
    let severity: 'low' | 'moderate' | 'high' | 'critical';
    let scoreImpact: number;

    // Determine severity and score impact
    if (units >= 500 && deliveryMonths <= 6) {
      severity = 'critical';
      scoreImpact = 25 + (units / 500) * 15; // 25-40 range
      scoreImpact = Math.min(40, scoreImpact);
    } else if (units >= 200 && probability >= 0.5) {
      severity = 'high';
      scoreImpact = 15 + (units / 200) * 10;
      scoreImpact = Math.min(25, scoreImpact);
    } else if (units >= 50 && probability >= 0.2) {
      severity = 'moderate';
      scoreImpact = 5 + (units / 50) * 10;
      scoreImpact = Math.min(15, scoreImpact);
    } else {
      severity = 'low';
      scoreImpact = 1 + (probability * 4);
      scoreImpact = Math.min(5, scoreImpact);
    }

    // Create risk event
    const eventResult = await query(
      `INSERT INTO risk_events (
         trade_area_id, risk_category_id, event_type, event_source,
         headline, description, event_date, risk_impact_type, risk_score_change,
         severity, probability, event_data
       ) VALUES (
         $1, 
         (SELECT id FROM risk_categories WHERE category_name = 'supply'),
         $2, $3, $4, $5, NOW(), 'escalation', $6, $7, $8, $9
       ) RETURNING id`,
      [
        tradeAreaId,
        'pipeline_unit_confirmed',
        'supply_tracking',
        `New supply: ${units} units in pipeline`,
        `Project with ${units} units, ${probability * 100}% probability, ${deliveryMonths}mo delivery`,
        scoreImpact,
        severity,
        probability,
        JSON.stringify({ projectId, units, deliveryMonths }),
      ]
    );
    const eventId = eventResult.rows[0].id;

    // Create escalation record
    const action = this.getEscalationAction(severity);
    await query(
      `INSERT INTO risk_escalations (
         risk_event_id, trade_area_id, risk_category_id,
         escalation_type, severity, score_impact, trigger_description, trigger_rule, action_required
       ) VALUES ($1, $2, (SELECT id FROM risk_categories WHERE category_name = 'supply'), 
                 'escalation', $3, $4, $5, $6, $7)`,
      [
        eventId,
        tradeAreaId,
        severity,
        scoreImpact,
        `${units} units confirmed for delivery in ${deliveryMonths} months`,
        `SUPPLY_${severity.toUpperCase()}`,
        action,
      ]
    );

    return eventId;
  }

  /**
   * Apply Supply Risk De-escalation Rules
   * 
   * De-escalation Rules:
   * - Project cancelled → -50% of escalation (risk decays slowly)
   * - Project delayed >12 months → -30% of escalation
   * - Project converted to different use → -80% of escalation
   */
  async applySupplyDeEscalation(
    tradeAreaId: string,
    projectId: string,
    reason: 'cancelled' | 'delayed' | 'converted'
  ): Promise<string> {
    // Get original escalation for this project
    const escalationResult = await query(
      `SELECT re.id, re.risk_score_change, resc.score_impact
       FROM risk_events re
       JOIN risk_escalations resc ON resc.risk_event_id = re.id
       WHERE re.trade_area_id = $1
         AND re.event_data->>'projectId' = $2
         AND re.risk_impact_type = 'escalation'
         AND re.is_active = TRUE
       ORDER BY re.event_date DESC
       LIMIT 1`,
      [tradeAreaId, projectId]
    );

    if (escalationResult.rows.length === 0) {
      throw new Error(`No active escalation found for project ${projectId}`);
    }

    const originalEscalation = escalationResult.rows[0];
    const originalImpact = parseFloat(originalEscalation.score_impact);

    // Calculate de-escalation amount based on reason
    let deEscalationPct: number;
    let description: string;
    
    switch (reason) {
      case 'cancelled':
        deEscalationPct = 0.5; // -50%
        description = 'Project cancelled';
        break;
      case 'delayed':
        deEscalationPct = 0.3; // -30%
        description = 'Project delayed >12 months';
        break;
      case 'converted':
        deEscalationPct = 0.8; // -80%
        description = 'Project converted to different use';
        break;
    }

    const scoreReduction = -(originalImpact * deEscalationPct);

    // Create de-escalation event
    const eventResult = await query(
      `INSERT INTO risk_events (
         trade_area_id, risk_category_id, event_type, event_source,
         headline, description, event_date, risk_impact_type, risk_score_change,
         event_data
       ) VALUES (
         $1,
         (SELECT id FROM risk_categories WHERE category_name = 'supply'),
         $2, 'supply_tracking', $3, $4, NOW(), 'de_escalation', $5, $6
       ) RETURNING id`,
      [
        tradeAreaId,
        `pipeline_${reason}`,
        description,
        `De-escalation: ${Math.abs(deEscalationPct * 100)}% reduction from original risk`,
        scoreReduction,
        JSON.stringify({ projectId, reason, originalEventId: originalEscalation.id }),
      ]
    );
    const eventId = eventResult.rows[0].id;

    // Create de-escalation record
    await query(
      `INSERT INTO risk_escalations (
         risk_event_id, trade_area_id, risk_category_id,
         escalation_type, severity, score_impact, trigger_description, trigger_rule
       ) VALUES ($1, $2, (SELECT id FROM risk_categories WHERE category_name = 'supply'),
                 'de_escalation', 'moderate', $3, $4, $5)`,
      [eventId, tradeAreaId, scoreReduction, description, `SUPPLY_DE_${reason.toUpperCase()}`]
    );

    // Mark original event as resolved
    await query(
      `UPDATE risk_events 
       SET is_active = FALSE, resolved_at = NOW(), resolution_reason = $1
       WHERE id = $2`,
      [description, originalEscalation.id]
    );

    return eventId;
  }

  /**
   * Calculate Demand Risk Score (0-100)
   * 
   * Formula: Employer Concentration Index × Demand Dependency Factor
   * 
   * Employer Concentration Index:
   * - <20%: Low risk (0-25)
   * - 20-35%: Medium risk (25-50)
   * - 35-50%: High risk (50-75)
   * - >50%: Critical risk (75-100)
   * 
   * Demand Dependency Factor:
   * - Single employer announced: 1.5x
   * - Employer not yet operational: 2.0x
   * - Employer with history of relocations: 1.8x
   */
  async calculateDemandRisk(tradeAreaId: string): Promise<DemandRiskCalculation> {
    // Get employer concentration data
    const concentrationResult = await query(
      `SELECT 
         MAX(concentration_pct) as top_employer_pct,
         MAX(dependency_factor) as max_dependency_factor,
         SUM(risk_contribution) as total_risk_contribution
       FROM employer_concentration
       WHERE trade_area_id = $1
         AND as_of_date = (
           SELECT MAX(as_of_date) 
           FROM employer_concentration 
           WHERE trade_area_id = $1
         )`,
      [tradeAreaId]
    );

    const topEmployerPct = parseFloat(concentrationResult.rows[0]?.top_employer_pct) || 0;
    const dependencyFactor = parseFloat(concentrationResult.rows[0]?.max_dependency_factor) || 1.0;

    // Calculate employer concentration index (0-100)
    let employerConcentrationIndex: number;
    if (topEmployerPct < 20) {
      employerConcentrationIndex = (topEmployerPct / 20) * 25; // 0-25
    } else if (topEmployerPct < 35) {
      employerConcentrationIndex = 25 + ((topEmployerPct - 20) / 15) * 25; // 25-50
    } else if (topEmployerPct < 50) {
      employerConcentrationIndex = 50 + ((topEmployerPct - 35) / 15) * 25; // 50-75
    } else {
      employerConcentrationIndex = 75 + ((topEmployerPct - 50) / 50) * 25; // 75-100
      employerConcentrationIndex = Math.min(100, employerConcentrationIndex);
    }

    // Apply dependency factor
    const baseScore = employerConcentrationIndex * dependencyFactor;

    // Get active escalations
    const escalations = await this.getActiveEscalations(tradeAreaId, 'demand');
    const escalationTotal = escalations.reduce((sum, e) => sum + e.scoreImpact, 0);

    // Get active de-escalations
    const deEscalations = await this.getActiveDeEscalations(tradeAreaId, 'demand');
    const deEscalationTotal = deEscalations.reduce((sum, e) => sum + e.scoreImpact, 0);

    // Final score (capped at 0-100)
    const finalScore = Math.max(0, Math.min(100, baseScore + escalationTotal + deEscalationTotal));

    return {
      topEmployerPct: parseFloat(topEmployerPct.toFixed(2)),
      employerConcentrationIndex: parseFloat(employerConcentrationIndex.toFixed(2)),
      dependencyFactor: parseFloat(dependencyFactor.toFixed(2)),
      baseScore: parseFloat(baseScore.toFixed(2)),
      escalations,
      deEscalations,
      finalScore: parseFloat(finalScore.toFixed(2)),
    };
  }

  /**
   * Apply Demand Risk Escalation Rules
   * 
   * Escalation Triggers:
   * - CRITICAL: Major employer exit confirmed → +25 to +40
   * - HIGH: Layoff announcement >20% of workforce → +15 to +25
   * - MODERATE: Remote work policy shift → +5 to +15
   * - LOW: Minor workforce reduction <10% → +1 to +5
   */
  async applyDemandEscalation(
    tradeAreaId: string,
    employerId: string,
    eventType: 'employer_exit' | 'layoff' | 'remote_policy_shift' | 'workforce_reduction',
    affectedEmployees: number,
    totalEmployees: number
  ): Promise<string> {
    const impactPct = (affectedEmployees / totalEmployees) * 100;
    let severity: 'low' | 'moderate' | 'high' | 'critical';
    let scoreImpact: number;

    // Determine severity and score impact
    if (eventType === 'employer_exit') {
      severity = 'critical';
      scoreImpact = 25 + (impactPct / 100) * 15; // 25-40 range
      scoreImpact = Math.min(40, scoreImpact);
    } else if (eventType === 'layoff' && impactPct >= 20) {
      severity = 'high';
      scoreImpact = 15 + (impactPct / 100) * 10;
      scoreImpact = Math.min(25, scoreImpact);
    } else if (eventType === 'remote_policy_shift') {
      severity = 'moderate';
      scoreImpact = 5 + (impactPct / 100) * 10;
      scoreImpact = Math.min(15, scoreImpact);
    } else {
      severity = 'low';
      scoreImpact = 1 + (impactPct / 100) * 4;
      scoreImpact = Math.min(5, scoreImpact);
    }

    // Create risk event
    const eventResult = await query(
      `INSERT INTO risk_events (
         trade_area_id, risk_category_id, event_type, event_source,
         headline, description, event_date, risk_impact_type, risk_score_change,
         severity, probability, event_data
       ) VALUES (
         $1,
         (SELECT id FROM risk_categories WHERE category_name = 'demand'),
         $2, 'demand_tracking', $3, $4, NOW(), 'escalation', $5, $6, 100, $7
       ) RETURNING id`,
      [
        tradeAreaId,
        eventType,
        `Demand driver change: ${eventType}`,
        `${affectedEmployees} employees affected (${impactPct.toFixed(1)}% of workforce)`,
        scoreImpact,
        severity,
        JSON.stringify({ employerId, affectedEmployees, totalEmployees, impactPct }),
      ]
    );
    const eventId = eventResult.rows[0].id;

    // Create escalation record
    const action = this.getEscalationAction(severity);
    await query(
      `INSERT INTO risk_escalations (
         risk_event_id, trade_area_id, risk_category_id,
         escalation_type, severity, score_impact, trigger_description, trigger_rule, action_required
       ) VALUES ($1, $2, (SELECT id FROM risk_categories WHERE category_name = 'demand'),
                 'escalation', $3, $4, $5, $6, $7)`,
      [
        eventId,
        tradeAreaId,
        severity,
        scoreImpact,
        `${eventType}: ${affectedEmployees} employees (${impactPct.toFixed(1)}%)`,
        `DEMAND_${severity.toUpperCase()}`,
        action,
      ]
    );

    return eventId;
  }

  /**
   * Apply Demand Risk De-escalation Rules
   * 
   * De-escalation Rules:
   * - Employer confirms long-term commitment → -40% of escalation
   * - New employer enters market → -20% of escalation per employer
   * - Diversification improves → recalculate from base
   */
  async applyDemandDeEscalation(
    tradeAreaId: string,
    employerId: string,
    reason: 'commitment' | 'new_employer' | 'diversification',
    employeeCount?: number
  ): Promise<string> {
    // Get active escalations for this trade area
    const escalationResult = await query(
      `SELECT re.id, resc.score_impact
       FROM risk_events re
       JOIN risk_escalations resc ON resc.risk_event_id = re.id
       WHERE re.trade_area_id = $1
         AND re.risk_category_id = (SELECT id FROM risk_categories WHERE category_name = 'demand')
         AND re.risk_impact_type = 'escalation'
         AND re.is_active = TRUE
       ORDER BY re.event_date DESC
       LIMIT 1`,
      [tradeAreaId]
    );

    if (escalationResult.rows.length === 0) {
      // No active escalations - create positive de-escalation anyway
      const scoreReduction = reason === 'new_employer' ? -10 : -5;
      
      const eventResult = await query(
        `INSERT INTO risk_events (
           trade_area_id, risk_category_id, event_type, event_source,
           headline, description, event_date, risk_impact_type, risk_score_change
         ) VALUES (
           $1,
           (SELECT id FROM risk_categories WHERE category_name = 'demand'),
           $2, 'demand_tracking', $3, $4, NOW(), 'de_escalation', $5
         ) RETURNING id`,
        [
          tradeAreaId,
          `demand_${reason}`,
          `Demand improvement: ${reason}`,
          `De-escalation due to ${reason}${employeeCount ? ` (${employeeCount} employees)` : ''}`,
          scoreReduction,
        ]
      );

      return eventResult.rows[0].id;
    }

    const originalEscalation = escalationResult.rows[0];
    const originalImpact = parseFloat(originalEscalation.score_impact);

    // Calculate de-escalation amount based on reason
    let deEscalationPct: number;
    let description: string;

    switch (reason) {
      case 'commitment':
        deEscalationPct = 0.4; // -40%
        description = 'Employer confirms long-term commitment';
        break;
      case 'new_employer':
        deEscalationPct = 0.2; // -20% per employer
        description = `New employer enters market (${employeeCount} employees)`;
        break;
      case 'diversification':
        deEscalationPct = 0.3; // -30% baseline
        description = 'Employment diversification improves';
        break;
    }

    const scoreReduction = -(originalImpact * deEscalationPct);

    // Create de-escalation event
    const eventResult = await query(
      `INSERT INTO risk_events (
         trade_area_id, risk_category_id, event_type, event_source,
         headline, description, event_date, risk_impact_type, risk_score_change,
         event_data
       ) VALUES (
         $1,
         (SELECT id FROM risk_categories WHERE category_name = 'demand'),
         $2, 'demand_tracking', $3, $4, NOW(), 'de_escalation', $5, $6
       ) RETURNING id`,
      [
        tradeAreaId,
        `demand_${reason}`,
        description,
        `De-escalation: ${Math.abs(deEscalationPct * 100)}% reduction from original risk`,
        scoreReduction,
        JSON.stringify({ employerId, reason, employeeCount, originalEventId: originalEscalation.id }),
      ]
    );
    const eventId = eventResult.rows[0].id;

    // Create de-escalation record
    await query(
      `INSERT INTO risk_escalations (
         risk_event_id, trade_area_id, risk_category_id,
         escalation_type, severity, score_impact, trigger_description, trigger_rule
       ) VALUES ($1, $2, (SELECT id FROM risk_categories WHERE category_name = 'demand'),
                 'de_escalation', 'moderate', $3, $4, $5)`,
      [eventId, tradeAreaId, scoreReduction, description, `DEMAND_DE_${reason.toUpperCase()}`]
    );

    return eventId;
  }

  /**
   * Calculate Composite Risk Profile
   * 
   * Formula: (Highest × 0.40) + (Second Highest × 0.25) + (Avg of Remaining × 0.35)
   * 
   * Ensures single severe risk isn't diluted by low scores in other categories
   */
  async calculateCompositeRisk(tradeAreaId: string): Promise<CompositeRiskProfile> {
    // Calculate or retrieve all category scores
    const supplyCalc = await this.calculateSupplyRisk(tradeAreaId);
    const demandCalc = await this.calculateDemandRisk(tradeAreaId);

    // Placeholder scores for Phase 3 categories (neutral 50.0)
    const regulatoryRisk = 50.0;
    const marketRisk = 50.0;
    const executionRisk = 50.0;
    const climateRisk = 50.0;

    // Array of all scores with category names
    const scores = [
      { category: 'supply', score: supplyCalc.finalScore },
      { category: 'demand', score: demandCalc.finalScore },
      { category: 'regulatory', score: regulatoryRisk },
      { category: 'market', score: marketRisk },
      { category: 'execution', score: executionRisk },
      { category: 'climate', score: climateRisk },
    ];

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const highest = scores[0];
    const secondHighest = scores[1];
    const remaining = scores.slice(2);
    const avgRemaining = remaining.reduce((sum, s) => sum + s.score, 0) / remaining.length;

    // Calculate composite score
    const compositeScore = 
      (highest.score * 0.40) +
      (secondHighest.score * 0.25) +
      (avgRemaining * 0.35);

    // Classify risk level
    const riskLevel = this.classifyRiskLevel(compositeScore);

    const profile: CompositeRiskProfile = {
      tradeAreaId,
      supplyRisk: supplyCalc.finalScore,
      demandRisk: demandCalc.finalScore,
      regulatoryRisk,
      marketRisk,
      executionRisk,
      climateRisk,
      compositeScore: parseFloat(compositeScore.toFixed(2)),
      highestCategory: highest.category,
      highestCategoryScore: highest.score,
      secondHighestCategory: secondHighest.category,
      secondHighestCategoryScore: secondHighest.score,
      riskLevel,
      calculatedAt: new Date(),
    };

    // Save composite profile to database
    await this.saveCompositeRiskProfile(profile);

    return profile;
  }

  /**
   * Save composite risk profile to database
   */
  private async saveCompositeRiskProfile(profile: CompositeRiskProfile): Promise<void> {
    // Expire previous current profile
    await query(
      `UPDATE composite_risk_profiles 
       SET valid_until = NOW() 
       WHERE trade_area_id = $1 AND valid_until IS NULL`,
      [profile.tradeAreaId]
    );

    // Insert new profile
    await query(
      `INSERT INTO composite_risk_profiles (
         trade_area_id, supply_risk, demand_risk, regulatory_risk, market_risk, execution_risk, climate_risk,
         composite_score, highest_category, highest_category_score, second_highest_category, second_highest_category_score,
         risk_level, composite_calculation
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        profile.tradeAreaId,
        profile.supplyRisk,
        profile.demandRisk,
        profile.regulatoryRisk,
        profile.marketRisk,
        profile.executionRisk,
        profile.climateRisk,
        profile.compositeScore,
        profile.highestCategory,
        profile.highestCategoryScore,
        profile.secondHighestCategory,
        profile.secondHighestCategoryScore,
        profile.riskLevel,
        JSON.stringify({
          formula: '(Highest × 0.40) + (Second × 0.25) + (Avg Remaining × 0.35)',
          highest: { category: profile.highestCategory, score: profile.highestCategoryScore, weight: 0.40 },
          second: { category: profile.secondHighestCategory, score: profile.secondHighestCategoryScore, weight: 0.25 },
          remaining: { weight: 0.35 },
        }),
      ]
    );
  }

  /**
   * Save individual risk score to database
   */
  async saveRiskScore(
    tradeAreaId: string,
    categoryName: string,
    baseScore: number,
    escalationAdjustment: number,
    deEscalationAdjustment: number,
    dataSnapshot: any
  ): Promise<string> {
    const finalScore = Math.max(0, Math.min(100, baseScore + escalationAdjustment + deEscalationAdjustment));
    const riskLevel = this.classifyRiskLevel(finalScore);

    // Expire previous current score
    await query(
      `UPDATE risk_scores
       SET valid_until = NOW()
       WHERE trade_area_id = $1
         AND risk_category_id = (SELECT id FROM risk_categories WHERE category_name = $2)
         AND valid_until IS NULL`,
      [tradeAreaId, categoryName]
    );

    // Insert new score
    const result = await query(
      `INSERT INTO risk_scores (
         trade_area_id, risk_category_id, risk_score, base_score,
         escalation_adjustment, de_escalation_adjustment, risk_level, data_snapshot
       ) VALUES (
         $1,
         (SELECT id FROM risk_categories WHERE category_name = $2),
         $3, $4, $5, $6, $7, $8
       ) RETURNING id`,
      [tradeAreaId, categoryName, finalScore, baseScore, escalationAdjustment, deEscalationAdjustment, riskLevel, JSON.stringify(dataSnapshot)]
    );

    return result.rows[0].id;
  }

  /**
   * Get active escalations for a trade area and category
   */
  private async getActiveEscalations(tradeAreaId: string, categoryName: string): Promise<EscalationImpact[]> {
    const result = await query(
      `SELECT 
         resc.id,
         re.id as event_id,
         resc.severity,
         resc.score_impact,
         resc.trigger_description,
         resc.applied_at
       FROM risk_escalations resc
       JOIN risk_events re ON re.id = resc.risk_event_id
       WHERE resc.trade_area_id = $1
         AND resc.risk_category_id = (SELECT id FROM risk_categories WHERE category_name = $2)
         AND resc.escalation_type = 'escalation'
         AND re.is_active = TRUE
         AND (resc.expires_at IS NULL OR resc.expires_at > NOW())`,
      [tradeAreaId, categoryName]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      severity: row.severity,
      scoreImpact: parseFloat(row.score_impact),
      triggerDescription: row.trigger_description,
      appliedAt: new Date(row.applied_at),
    }));
  }

  /**
   * Get active de-escalations for a trade area and category
   */
  private async getActiveDeEscalations(tradeAreaId: string, categoryName: string): Promise<DeEscalationImpact[]> {
    const result = await query(
      `SELECT 
         resc.id,
         re.id as event_id,
         resc.score_impact,
         resc.trigger_description,
         resc.applied_at
       FROM risk_escalations resc
       JOIN risk_events re ON re.id = resc.risk_event_id
       WHERE resc.trade_area_id = $1
         AND resc.risk_category_id = (SELECT id FROM risk_categories WHERE category_name = $2)
         AND resc.escalation_type = 'de_escalation'
         AND re.is_active = TRUE
         AND (resc.expires_at IS NULL OR resc.expires_at > NOW())`,
      [tradeAreaId, categoryName]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      scoreImpact: parseFloat(row.score_impact),
      reason: row.trigger_description,
      appliedAt: new Date(row.applied_at),
    }));
  }

  /**
   * Get risk score history for a trade area
   */
  async getRiskScoreHistory(
    tradeAreaId: string,
    categoryName?: string,
    limit = 50
  ): Promise<RiskScore[]> {
    const categoryFilter = categoryName
      ? `AND rc.category_name = $2`
      : '';

    const params = categoryName ? [tradeAreaId, categoryName, limit] : [tradeAreaId, limit];

    const result = await query(
      `SELECT 
         rs.id,
         rs.trade_area_id,
         rc.category_name,
         rs.risk_score,
         rs.base_score,
         rs.escalation_adjustment,
         rs.de_escalation_adjustment,
         rs.risk_level,
         rs.calculated_at
       FROM risk_scores rs
       JOIN risk_categories rc ON rc.id = rs.risk_category_id
       WHERE rs.trade_area_id = $1
         ${categoryFilter}
       ORDER BY rs.calculated_at DESC
       LIMIT ${categoryName ? '$3' : '$2'}`,
      params
    );

    return result.rows.map(row => ({
      tradeAreaId: row.trade_area_id,
      categoryName: row.category_name,
      riskScore: parseFloat(row.risk_score),
      baseScore: parseFloat(row.base_score),
      escalationAdjustment: parseFloat(row.escalation_adjustment),
      deEscalationAdjustment: parseFloat(row.de_escalation_adjustment),
      riskLevel: row.risk_level,
      calculatedAt: new Date(row.calculated_at),
    }));
  }

  /**
   * Get recent risk events for a trade area
   */
  async getRecentRiskEvents(tradeAreaId: string, limit = 20): Promise<RiskEvent[]> {
    const result = await query(
      `SELECT 
         re.id,
         re.trade_area_id,
         re.risk_category_id,
         re.event_type,
         re.headline,
         re.description,
         re.event_date,
         re.risk_impact_type,
         re.risk_score_change,
         re.severity,
         re.probability,
         re.is_active
       FROM risk_events re
       WHERE re.trade_area_id = $1
       ORDER BY re.event_date DESC
       LIMIT $2`,
      [tradeAreaId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      tradeAreaId: row.trade_area_id,
      riskCategoryId: row.risk_category_id,
      eventType: row.event_type,
      headline: row.headline,
      description: row.description,
      eventDate: new Date(row.event_date),
      riskImpactType: row.risk_impact_type,
      riskScoreChange: parseFloat(row.risk_score_change),
      severity: row.severity,
      probability: parseFloat(row.probability),
      isActive: row.is_active,
    }));
  }

  /**
   * Helper: Classify risk level from score
   */
  private classifyRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score < 40) return 'low';
    if (score < 60) return 'moderate';
    if (score < 80) return 'high';
    return 'critical';
  }

  /**
   * Helper: Get escalation action based on severity
   */
  private getEscalationAction(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'Immediate alert, forced reunderwriting';
      case 'high':
        return 'Alert to users, sensitivity analysis';
      case 'moderate':
        return 'Added to watchlist';
      case 'low':
        return 'Logged in risk register';
      default:
        return 'Monitor';
    }
  }

  // ============================================================================
  // PHASE 3 RISK CATEGORIES (Regulatory, Market, Execution, Climate)
  // ============================================================================

  /**
   * Calculate Regulatory Risk Score (0-100)
   * 
   * Formula: Base 50 + Sum(Active Events × Stage Probability)
   * 
   * Stage Probability Weighting:
   * - Proposed: 25%
   * - Committee: 50%
   * - Vote Pending: 75%
   * - Enacted: 100%
   * 
   * Event Types:
   * - Rent control: High impact
   * - STR restrictions: Moderate-High impact
   * - Zoning changes: Variable (upzone = opportunity, downzone = risk)
   * - Tax policy: Moderate impact
   * - Inclusionary zoning: Low-Moderate impact
   */
  async calculateRegulatoryRisk(tradeAreaId: string): Promise<any> {
    // Get active regulatory events
    const eventsResult = await query(
      `SELECT 
         id,
         legislation_name,
         legislation_type,
         legislation_stage,
         stage_probability,
         risk_score_impact,
         severity,
         effective_date
       FROM regulatory_risk_events
       WHERE trade_area_id = $1
         AND is_active = TRUE
       ORDER BY risk_score_impact DESC`,
      [tradeAreaId]
    );

    const events = eventsResult.rows;

    // Calculate weighted risk impact
    let totalRiskImpact = 0;
    events.forEach(event => {
      const weightedImpact = parseFloat(event.risk_score_impact) * (parseFloat(event.stage_probability) / 100);
      totalRiskImpact += weightedImpact;
    });

    // Base score starts at 50 (neutral)
    const baseScore = 50.0 + totalRiskImpact;
    
    // Cap at 0-100
    const finalScore = Math.max(0, Math.min(100, baseScore));

    return {
      baseScore: parseFloat(baseScore.toFixed(2)),
      finalScore: parseFloat(finalScore.toFixed(2)),
      activeEvents: events.length,
      totalRiskImpact: parseFloat(totalRiskImpact.toFixed(2)),
      events: events.map(e => ({
        id: e.id,
        name: e.legislation_name,
        type: e.legislation_type,
        stage: e.legislation_stage,
        stageProbability: parseFloat(e.stage_probability),
        impact: parseFloat(e.risk_score_impact),
        severity: e.severity,
        effectiveDate: e.effective_date,
      })),
    };
  }

  /**
   * Calculate Market Risk Score (0-100)
   * 
   * Formula: Interest Rate Sensitivity + Liquidity Risk + Recession Probability
   * 
   * Components:
   * - Cap Rate Expansion: +100 bps IR = +50-75 bps cap rate
   * - DSCR Stress Test: Impact of +200 bps on debt service coverage
   * - Liquidity Risk: Transaction volume, days on market
   * - Credit Availability: Lending standards, LTV requirements
   * - Recession Indicators: Yield curve, unemployment, leading indicators
   */
  async calculateMarketRisk(tradeAreaId: string): Promise<any> {
    // Get latest market indicators
    const indicatorsResult = await query(
      `SELECT *
       FROM market_risk_indicators
       WHERE trade_area_id = $1
       ORDER BY as_of_date DESC
       LIMIT 1`,
      [tradeAreaId]
    );

    if (indicatorsResult.rows.length === 0) {
      // No data - return neutral score
      return {
        baseScore: 50.0,
        finalScore: 50.0,
        hasData: false,
        message: 'No market risk data available',
      };
    }

    const indicators = indicatorsResult.rows[0];

    // Use base market risk score from indicators table
    const baseScore = parseFloat(indicators.base_market_risk_score) || 50.0;
    
    // Get interest rate scenarios
    const scenariosResult = await query(
      `SELECT 
         scenario_name,
         rate_change_bps,
         cap_rate_impact_bps,
         value_impact_pct,
         dscr_impact,
         probability,
         risk_score_contribution
       FROM interest_rate_scenarios
       WHERE trade_area_id = $1
       ORDER BY probability DESC`,
      [tradeAreaId]
    );

    const scenarios = scenariosResult.rows.map(s => ({
      name: s.scenario_name,
      rateChangeBps: parseFloat(s.rate_change_bps),
      capRateImpactBps: parseFloat(s.cap_rate_impact_bps),
      valueImpactPct: parseFloat(s.value_impact_pct),
      dscrImpact: parseFloat(s.dscr_impact),
      probability: parseFloat(s.probability),
      riskContribution: parseFloat(s.risk_score_contribution),
    }));

    const finalScore = baseScore;

    return {
      baseScore: parseFloat(baseScore.toFixed(2)),
      finalScore: parseFloat(finalScore.toFixed(2)),
      hasData: true,
      asOfDate: indicators.as_of_date,
      indicators: {
        current10YrTreasury: parseFloat(indicators.current_10yr_treasury),
        currentCapRate: parseFloat(indicators.current_cap_rate),
        capRateExpansionBps: parseFloat(indicators.estimated_cap_rate_expansion),
        currentDSCR: parseFloat(indicators.current_dscr),
        stressedDSCR: parseFloat(indicators.stressed_dscr),
        dscrBuffer: parseFloat(indicators.dscr_buffer),
        transactionVolumeIndex: parseFloat(indicators.transaction_volume_index),
        daysOnMarketAvg: parseInt(indicators.days_on_market_avg),
        recessionProbability: parseFloat(indicators.recession_probability),
        yieldCurveSpread: parseFloat(indicators.yield_curve_spread),
        unemploymentRate: parseFloat(indicators.unemployment_rate),
      },
      scenarios,
    };
  }

  /**
   * Calculate Execution Risk Score (0-100)
   * 
   * Formula: Cost Contingency Adequacy + Historical Overrun Rate + Market Conditions
   * 
   * Components:
   * - Contingency Budget: 10% = low risk, 5% = high risk
   * - Historical Overruns: By jurisdiction and project type
   * - Labor Market: Contractor availability, wage inflation
   * - Material Supply: Lead times, price volatility, tariff exposure
   * - Contractor Risk: Failure rates, bonding availability
   */
  async calculateExecutionRisk(tradeAreaId: string): Promise<any> {
    // Get latest execution risk factors
    const factorsResult = await query(
      `SELECT *
       FROM execution_risk_factors
       WHERE trade_area_id = $1
       ORDER BY as_of_date DESC
       LIMIT 1`,
      [tradeAreaId]
    );

    if (factorsResult.rows.length === 0) {
      // No data - return neutral score
      return {
        baseScore: 50.0,
        finalScore: 50.0,
        hasData: false,
        message: 'No execution risk data available',
      };
    }

    const factors = factorsResult.rows[0];

    // Use base execution risk score from factors table
    const baseScore = parseFloat(factors.base_execution_risk_score) || 50.0;

    // Get construction cost trends
    const costTrendsResult = await query(
      `SELECT 
         period_month,
         overall_cost_index,
         labor_cost_index,
         material_cost_index,
         avg_permit_approval_days,
         avg_material_lead_days
       FROM construction_cost_tracking
       WHERE trade_area_id = $1
       ORDER BY period_month DESC
       LIMIT 12`,
      [tradeAreaId]
    );

    const costTrends = costTrendsResult.rows.map(ct => ({
      month: ct.period_month,
      overallCostIndex: parseFloat(ct.overall_cost_index),
      laborCostIndex: parseFloat(ct.labor_cost_index),
      materialCostIndex: parseFloat(ct.material_cost_index),
      permitApprovalDays: parseInt(ct.avg_permit_approval_days),
      materialLeadDays: parseInt(ct.avg_material_lead_days),
    }));

    const finalScore = baseScore;

    return {
      baseScore: parseFloat(baseScore.toFixed(2)),
      finalScore: parseFloat(finalScore.toFixed(2)),
      hasData: true,
      asOfDate: factors.as_of_date,
      factors: {
        projectType: factors.project_type,
        estimatedCost: parseFloat(factors.estimated_project_cost),
        contingencyPct: parseFloat(factors.contingency_pct),
        costInflationYoY: parseFloat(factors.cost_inflation_yoy),
        laborAvailability: factors.labor_availability,
        contractorAvailability: factors.contractor_availability,
        wageInflationYoY: parseFloat(factors.wage_inflation_yoy),
        skilledLaborShortage: factors.skilled_labor_shortage,
        materialLeadTimesAvg: parseInt(factors.material_lead_times_avg),
        materialPriceVolatility: factors.material_price_volatility,
        tariffExposure: factors.tariff_exposure,
        contractorFailureRate: parseFloat(factors.contractor_failure_rate),
        historicalCostOverrunPct: parseFloat(factors.historical_cost_overrun_pct),
        historicalScheduleOverrunDays: parseInt(factors.historical_schedule_overrun_days),
      },
      costTrends,
    };
  }

  /**
   * Calculate Climate/Physical Risk Score (0-100)
   * 
   * Formula: Flood Risk + Wildfire Risk + Hurricane Risk + Insurance Impact
   * 
   * Components:
   * - FEMA Flood Zone: A/AE/V = high risk, X = low risk
   * - Wildfire Proximity: WUI classification, distance to perimeters
   * - Hurricane Exposure: Wind zone, storm surge risk
   * - Insurance Availability: Carrier withdrawals, premium trends
   * - 30-Year Climate Projection: Sea level rise, temperature extremes
   */
  async calculateClimateRisk(tradeAreaId: string): Promise<any> {
    // Get latest climate risk assessment
    const assessmentResult = await query(
      `SELECT *
       FROM climate_risk_assessments
       WHERE trade_area_id = $1
       ORDER BY assessment_date DESC
       LIMIT 1`,
      [tradeAreaId]
    );

    if (assessmentResult.rows.length === 0) {
      // No data - return neutral score
      return {
        baseScore: 50.0,
        finalScore: 50.0,
        hasData: false,
        message: 'No climate risk data available',
      };
    }

    const assessment = assessmentResult.rows[0];

    // Use base climate risk score from assessment
    const baseScore = parseFloat(assessment.base_climate_risk_score) || 50.0;

    // Get historical natural disaster events
    const disasterEventsResult = await query(
      `SELECT 
         event_type,
         event_name,
         event_date,
         severity,
         estimated_damage_usd,
         properties_affected
       FROM natural_disaster_events
       WHERE trade_area_id = $1
       ORDER BY event_date DESC
       LIMIT 10`,
      [tradeAreaId]
    );

    const disasterHistory = disasterEventsResult.rows.map(de => ({
      type: de.event_type,
      name: de.event_name,
      date: de.event_date,
      severity: de.severity,
      estimatedDamage: parseFloat(de.estimated_damage_usd),
      propertiesAffected: parseInt(de.properties_affected),
    }));

    const finalScore = baseScore;

    return {
      baseScore: parseFloat(baseScore.toFixed(2)),
      finalScore: parseFloat(finalScore.toFixed(2)),
      hasData: true,
      assessmentDate: assessment.assessment_date,
      floodRisk: {
        femaZone: assessment.fema_flood_zone,
        zoneDescription: assessment.fema_zone_description,
        baseFloodElevation: parseFloat(assessment.base_flood_elevation),
        propertyElevation: parseFloat(assessment.property_elevation),
        elevationBuffer: parseFloat(assessment.elevation_buffer),
        riskLevel: assessment.flood_risk_level,
        eventCount10Yr: parseInt(assessment.flood_event_count_10yr),
      },
      wildfireRisk: {
        hazardZone: assessment.wildfire_hazard_zone,
        wuiClassification: assessment.wui_classification,
        distanceToFireMiles: parseFloat(assessment.distance_to_fire_perimeter_miles),
        riskLevel: assessment.wildfire_risk_level,
      },
      hurricaneRisk: {
        zone: parseInt(assessment.hurricane_zone),
        windDesignSpeed: parseInt(assessment.wind_design_speed),
        stormSurgeRisk: assessment.storm_surge_risk_level,
      },
      earthquakeRisk: {
        seismicZone: assessment.seismic_zone,
        riskLevel: assessment.earthquake_risk_level,
      },
      seaLevelRise: {
        distanceToCoastMiles: parseFloat(assessment.current_distance_to_coast_miles),
        projectedRise30YrFeet: parseFloat(assessment.sea_level_rise_30yr_feet),
        impactLevel: assessment.slr_impact_level,
      },
      insurance: {
        availability: assessment.insurance_availability,
        carrierWithdrawals: assessment.insurance_carrier_withdrawals,
        premiumTrend: assessment.insurance_premium_trend,
        estimatedAnnualPremium: parseFloat(assessment.estimated_annual_premium),
      },
      disasterHistory,
    };
  }

  /**
   * Update composite risk calculation to use all 6 categories
   * (Overrides the placeholder version from Phase 2)
   */
  async calculateCompositeRisk(tradeAreaId: string): Promise<CompositeRiskProfile> {
    // Calculate all 6 category scores
    const supplyCalc = await this.calculateSupplyRisk(tradeAreaId);
    const demandCalc = await this.calculateDemandRisk(tradeAreaId);
    const regulatoryCalc = await this.calculateRegulatoryRisk(tradeAreaId);
    const marketCalc = await this.calculateMarketRisk(tradeAreaId);
    const executionCalc = await this.calculateExecutionRisk(tradeAreaId);
    const climateCalc = await this.calculateClimateRisk(tradeAreaId);

    const supplyRisk = supplyCalc.finalScore;
    const demandRisk = demandCalc.finalScore;
    const regulatoryRisk = regulatoryCalc.finalScore;
    const marketRisk = marketCalc.finalScore;
    const executionRisk = executionCalc.finalScore;
    const climateRisk = climateCalc.finalScore;

    // Array of all scores with category names
    const scores = [
      { category: 'supply', score: supplyRisk },
      { category: 'demand', score: demandRisk },
      { category: 'regulatory', score: regulatoryRisk },
      { category: 'market', score: marketRisk },
      { category: 'execution', score: executionRisk },
      { category: 'climate', score: climateRisk },
    ];

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const highest = scores[0];
    const secondHighest = scores[1];
    const remaining = scores.slice(2);
    const avgRemaining = remaining.reduce((sum, s) => sum + s.score, 0) / remaining.length;

    // Calculate composite score
    // Formula: (Highest × 0.40) + (Second × 0.25) + (Avg Remaining × 0.35)
    const compositeScore = 
      (highest.score * 0.40) +
      (secondHighest.score * 0.25) +
      (avgRemaining * 0.35);

    // Classify risk level
    const riskLevel = this.classifyRiskLevel(compositeScore);

    const profile: CompositeRiskProfile = {
      tradeAreaId,
      supplyRisk,
      demandRisk,
      regulatoryRisk,
      marketRisk,
      executionRisk,
      climateRisk,
      compositeScore: parseFloat(compositeScore.toFixed(2)),
      highestCategory: highest.category,
      highestCategoryScore: highest.score,
      secondHighestCategory: secondHighest.category,
      secondHighestCategoryScore: secondHighest.score,
      riskLevel,
      calculatedAt: new Date(),
    };

    // Save composite profile to database
    await this.saveCompositeRiskProfile(profile);

    return profile;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const riskScoringService = new RiskScoringService();
