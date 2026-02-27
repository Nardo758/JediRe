/**
 * Audit Trail Service - JEDI RE Phase 2 Component 4
 * Full traceability from financial assumptions back to source news events
 */

import { Pool } from 'pg';

export interface AuditChainLink {
  id: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  targetEntityId: string;
  linkConfidence: number;
  chainConfidence: number;
  confidenceFactors?: any;
}

export interface AssumptionEvidence {
  id: string;
  dealId: string;
  assumptionId: string;
  assumptionName: string;
  assumptionCategory: string;
  baselineValue: number;
  adjustedValue: number;
  deltaValue: number;
  deltaPercentage: number;
  units: string;
  primaryEventId: string;
  supportingEventIds: string[];
  eventCount: number;
  financialImpact: number;
  impactDirection: 'positive' | 'negative' | 'neutral';
  impactMagnitude: 'minor' | 'moderate' | 'significant' | 'major';
  overallConfidence: number;
  confidenceLevel: 'confirmed' | 'high' | 'moderate' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

export interface CalculationLog {
  id: string;
  dealId: string;
  assumptionEvidenceId: string;
  calculationType: string;
  calculationStep: number;
  inputParameters: any;
  formula?: string;
  calculationMethod?: string;
  outputValue: number;
  outputUnit: string;
  calculationConfidence: number;
  confidenceNotes?: string;
  tradeAreaId?: string;
  tradeAreaName?: string;
  impactWeight?: number;
  effectiveDate?: Date;
  phaseStartQuarter?: string;
  phaseDurationQuarters?: number;
  calculatedAt: Date;
}

export interface EvidenceChainNode {
  type: 'event' | 'signal' | 'calculation' | 'adjustment' | 'assumption';
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
  details: any;
  timestamp?: Date;
}

export interface CompleteEvidenceChain {
  assumptionId: string;
  assumptionName: string;
  baselineValue: number;
  adjustedValue: number;
  delta: number;
  deltaPercentage: number;
  units: string;
  overallConfidence: number;
  chain: EvidenceChainNode[];
  financialImpact: number;
}

export interface DealAuditSummary {
  dealId: string;
  dealName: string;
  totalAssumptions: number;
  confirmedAssumptions: number;
  highConfidenceAssumptions: number;
  moderateConfidenceAssumptions: number;
  lowConfidenceAssumptions: number;
  sourceEvents: number;
  totalFinancialImpact: number;
  avgConfidence: number;
  minConfidence: number;
  totalCalculationSteps: number;
  assumptionsByCategory: { [category: string]: number };
}

export interface EventImpact {
  eventId: string;
  headline: string;
  eventDate: Date;
  source: string;
  credibility: number;
  dealsAffected: number;
  assumptionsAffected: number;
  totalFinancialImpact: number;
  avgFinancialImpact: number;
  maxFinancialImpact: number;
  avgAssumptionConfidence: number;
  affectedAssumptions: Array<{
    dealId: string;
    dealName: string;
    assumptionName: string;
    impact: number;
    confidence: number;
  }>;
}

export interface AuditExportOptions {
  dealId: string;
  exportType: 'pdf' | 'excel' | 'json';
  assumptionIds?: string[];
  includeBaseline?: boolean;
  includeCalculations?: boolean;
  confidenceThreshold?: number;
  title?: string;
  description?: string;
  generatedBy?: string;
}

export class AuditTrailService {
  constructor(private pool: Pool) {}

  /**
   * Get complete evidence chain for a specific assumption
   */
  async getAssumptionEvidenceChain(assumptionId: string): Promise<CompleteEvidenceChain | null> {
    const client = await this.pool.connect();
    
    try {
      // Get assumption evidence
      const evidenceResult = await client.query(
        `SELECT ae.*, 
                ne.headline, ne.event_date, ne.source, ne.credibility_score,
                ne.summary, ne.job_count, ne.impact_timeline
         FROM assumption_evidence ae
         LEFT JOIN news_events ne ON ae.primary_event_id = ne.id
         WHERE ae.assumption_id = $1`,
        [assumptionId]
      );

      if (evidenceResult.rows.length === 0) {
        return null;
      }

      const evidence = evidenceResult.rows[0];

      // Get calculation logs
      const calculationsResult = await client.query(
        `SELECT * FROM calculation_logs
         WHERE assumption_evidence_id = $1
         ORDER BY calculation_step ASC`,
        [evidence.id]
      );

      // Get audit chain links
      const chainResult = await client.query(
        `SELECT * FROM audit_chains
         WHERE assumption_id = $1
         ORDER BY created_at ASC`,
        [assumptionId]
      );

      // Build evidence chain
      const chain: EvidenceChainNode[] = [];

      // 1. News Event
      if (evidence.primary_event_id) {
        chain.push({
          type: 'event',
          id: evidence.primary_event_id,
          title: evidence.headline,
          subtitle: `${evidence.source} (credibility: ${Math.round(evidence.credibility_score * 100)}%)`,
          confidence: evidence.credibility_score,
          details: {
            date: evidence.event_date,
            source: evidence.source,
            summary: evidence.summary,
            jobCount: evidence.job_count,
            impactTimeline: evidence.impact_timeline,
          },
          timestamp: evidence.event_date,
        });
      }

      // 2. Calculation steps
      for (const calc of calculationsResult.rows) {
        chain.push({
          type: calc.calculation_type.includes('signal') ? 'signal' : 'calculation',
          id: calc.id,
          title: this.formatCalculationType(calc.calculation_type),
          subtitle: calc.calculation_method || `Step ${calc.calculation_step}`,
          confidence: calc.calculation_confidence,
          details: {
            inputParameters: calc.input_parameters,
            formula: calc.formula,
            outputValue: calc.output_value,
            outputUnit: calc.output_unit,
            tradeAreaName: calc.trade_area_name,
            impactWeight: calc.impact_weight,
            phaseStartQuarter: calc.phase_start_quarter,
            phaseDurationQuarters: calc.phase_duration_quarters,
            confidenceNotes: calc.confidence_notes,
          },
          timestamp: calc.calculated_at,
        });
      }

      // 3. Final adjustment
      chain.push({
        type: 'adjustment',
        id: evidence.id,
        title: `${evidence.assumption_name} Adjustment`,
        subtitle: `${evidence.delta_value > 0 ? '+' : ''}${evidence.delta_percentage?.toFixed(2)}%`,
        confidence: evidence.overall_confidence,
        details: {
          baseline: evidence.baseline_value,
          adjusted: evidence.adjusted_value,
          delta: evidence.delta_value,
          units: evidence.units,
          financialImpact: evidence.financial_impact,
          impactDirection: evidence.impact_direction,
        },
      });

      // 4. Final assumption
      chain.push({
        type: 'assumption',
        id: assumptionId,
        title: evidence.assumption_name,
        subtitle: `${evidence.adjusted_value} ${evidence.units}`,
        confidence: evidence.overall_confidence,
        details: {
          category: evidence.assumption_category,
          baselineValue: evidence.baseline_value,
          adjustedValue: evidence.adjusted_value,
          confidenceLevel: evidence.confidence_level,
        },
      });

      return {
        assumptionId,
        assumptionName: evidence.assumption_name,
        baselineValue: evidence.baseline_value,
        adjustedValue: evidence.adjusted_value,
        delta: evidence.delta_value,
        deltaPercentage: evidence.delta_percentage,
        units: evidence.units,
        overallConfidence: evidence.overall_confidence,
        chain,
        financialImpact: evidence.financial_impact,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get full audit trail for a deal
   */
  async getDealAuditTrail(dealId: string): Promise<DealAuditSummary> {
    const client = await this.pool.connect();
    
    try {
      // Get summary from view
      const summaryResult = await client.query(
        `SELECT * FROM v_deal_audit_summary WHERE deal_id = $1`,
        [dealId]
      );

      if (summaryResult.rows.length === 0) {
        throw new Error(`Deal ${dealId} not found`);
      }

      const summary = summaryResult.rows[0];

      // Get assumption breakdown by category
      const categoryResult = await client.query(
        `SELECT assumption_category, COUNT(*) as count
         FROM assumption_evidence
         WHERE deal_id = $1
         GROUP BY assumption_category`,
        [dealId]
      );

      const assumptionsByCategory: { [key: string]: number } = {};
      for (const row of categoryResult.rows) {
        assumptionsByCategory[row.assumption_category] = parseInt(row.count);
      }

      return {
        dealId: summary.deal_id,
        dealName: summary.deal_name,
        totalAssumptions: summary.total_assumptions || 0,
        confirmedAssumptions: summary.confirmed_assumptions || 0,
        highConfidenceAssumptions: summary.high_confidence_assumptions || 0,
        moderateConfidenceAssumptions: summary.moderate_confidence_assumptions || 0,
        lowConfidenceAssumptions: summary.low_confidence_assumptions || 0,
        sourceEvents: summary.source_events || 0,
        totalFinancialImpact: parseFloat(summary.total_financial_impact) || 0,
        avgConfidence: parseFloat(summary.avg_confidence) || 0,
        minConfidence: parseFloat(summary.min_confidence) || 0,
        totalCalculationSteps: summary.total_calculation_steps || 0,
        assumptionsByCategory,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all assumptions affected by a specific event
   */
  async getEventImpact(eventId: string): Promise<EventImpact | null> {
    const client = await this.pool.connect();
    
    try {
      // Get event impact summary
      const summaryResult = await client.query(
        `SELECT * FROM v_event_impact_summary WHERE event_id = $1`,
        [eventId]
      );

      if (summaryResult.rows.length === 0) {
        return null;
      }

      const summary = summaryResult.rows[0];

      // Get affected assumptions detail
      const assumptionsResult = await client.query(
        `SELECT 
           ae.deal_id,
           d.name as deal_name,
           ae.assumption_name,
           ae.financial_impact,
           ae.overall_confidence
         FROM assumption_evidence ae
         INNER JOIN deals d ON ae.deal_id = d.id
         WHERE ae.primary_event_id = $1
         ORDER BY ABS(ae.financial_impact) DESC`,
        [eventId]
      );

      return {
        eventId: summary.event_id,
        headline: summary.headline,
        eventDate: summary.event_date,
        source: summary.source,
        credibility: parseFloat(summary.credibility_score),
        dealsAffected: summary.deals_affected || 0,
        assumptionsAffected: summary.assumptions_affected || 0,
        totalFinancialImpact: parseFloat(summary.total_financial_impact) || 0,
        avgFinancialImpact: parseFloat(summary.avg_financial_impact) || 0,
        maxFinancialImpact: parseFloat(summary.max_financial_impact) || 0,
        avgAssumptionConfidence: parseFloat(summary.avg_assumption_confidence) || 0,
        affectedAssumptions: assumptionsResult.rows.map(row => ({
          dealId: row.deal_id,
          dealName: row.deal_name,
          assumptionName: row.assumption_name,
          impact: parseFloat(row.financial_impact),
          confidence: parseFloat(row.overall_confidence),
        })),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get confidence scores for all assumptions in a deal
   */
  async getDealConfidenceScores(dealId: string): Promise<Array<{
    assumptionId: string;
    assumptionName: string;
    confidence: number;
    confidenceLevel: string;
    chainLinkCount: number;
  }>> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT 
           ae.assumption_id,
           ae.assumption_name,
           ae.overall_confidence as confidence,
           ae.confidence_level,
           (SELECT COUNT(*) FROM audit_chains WHERE assumption_id = ae.assumption_id) as chain_link_count
         FROM assumption_evidence ae
         WHERE ae.deal_id = $1
         ORDER BY ae.overall_confidence DESC`,
        [dealId]
      );

      return result.rows.map(row => ({
        assumptionId: row.assumption_id,
        assumptionName: row.assumption_name,
        confidence: parseFloat(row.confidence),
        confidenceLevel: row.confidence_level,
        chainLinkCount: parseInt(row.chain_link_count) || 0,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Create audit chain link
   */
  async createAuditChainLink(
    dealId: string,
    assumptionId: string,
    chainType: string,
    sourceEntityType: string,
    sourceEntityId: string,
    targetEntityType: string,
    targetEntityId: string,
    linkConfidence: number,
    confidenceFactors?: any,
    createdBy?: string
  ): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      // Calculate chain confidence
      const chainConfidence = await this.calculateChainConfidence(assumptionId);

      const result = await client.query(
        `INSERT INTO audit_chains 
         (deal_id, assumption_id, chain_type, source_entity_type, source_entity_id,
          target_entity_type, target_entity_id, link_confidence, chain_confidence,
          confidence_factors, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          dealId, assumptionId, chainType, sourceEntityType, sourceEntityId,
          targetEntityType, targetEntityId, linkConfidence, chainConfidence,
          JSON.stringify(confidenceFactors), createdBy
        ]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Create assumption evidence record
   */
  async createAssumptionEvidence(evidence: Partial<AssumptionEvidence>): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO assumption_evidence 
         (deal_id, assumption_id, assumption_name, assumption_category,
          baseline_value, adjusted_value, delta_value, delta_percentage, units,
          primary_event_id, supporting_event_ids, event_count,
          financial_impact, impact_direction, impact_magnitude,
          overall_confidence, confidence_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
        [
          evidence.dealId,
          evidence.assumptionId,
          evidence.assumptionName,
          evidence.assumptionCategory,
          evidence.baselineValue,
          evidence.adjustedValue,
          evidence.deltaValue,
          evidence.deltaPercentage,
          evidence.units,
          evidence.primaryEventId,
          evidence.supportingEventIds || [],
          evidence.eventCount || 0,
          evidence.financialImpact,
          evidence.impactDirection,
          evidence.impactMagnitude,
          evidence.overallConfidence,
          evidence.confidenceLevel,
        ]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Log calculation step
   */
  async logCalculation(log: Partial<CalculationLog>): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO calculation_logs 
         (deal_id, assumption_evidence_id, calculation_type, calculation_step,
          input_parameters, formula, calculation_method, output_value, output_unit,
          calculation_confidence, confidence_notes, trade_area_id, trade_area_name,
          impact_weight, effective_date, phase_start_quarter, phase_duration_quarters,
          calculated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id`,
        [
          log.dealId,
          log.assumptionEvidenceId,
          log.calculationType,
          log.calculationStep || 1,
          JSON.stringify(log.inputParameters),
          log.formula,
          log.calculationMethod,
          log.outputValue,
          log.outputUnit,
          log.calculationConfidence || 1.0,
          log.confidenceNotes,
          log.tradeAreaId,
          log.tradeAreaName,
          log.impactWeight,
          log.effectiveDate,
          log.phaseStartQuarter,
          log.phaseDurationQuarters,
          null, // calculated_by
        ]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate overall chain confidence
   */
  private async calculateChainConfidence(assumptionId: string): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT calculate_chain_confidence($1) as confidence`,
        [assumptionId]
      );

      return parseFloat(result.rows[0].confidence) || 1.0;
    } finally {
      client.release();
    }
  }

  /**
   * Export audit report
   */
  async exportAuditReport(options: AuditExportOptions): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      // Get deal audit data
      const auditSummary = await this.getDealAuditTrail(options.dealId);
      
      // Get all assumptions or filtered subset
      const assumptionIds = options.assumptionIds || 
        (await this.getDealConfidenceScores(options.dealId))
          .filter(a => !options.confidenceThreshold || a.confidence >= options.confidenceThreshold)
          .map(a => a.assumptionId);

      // Get evidence chains for each assumption
      const evidenceChains = await Promise.all(
        assumptionIds.map(id => this.getAssumptionEvidenceChain(id))
      );

      // Generate export based on type
      let filePath: string;
      let fileSize: number = 0;

      switch (options.exportType) {
        case 'json':
          const jsonData = {
            dealSummary: auditSummary,
            evidenceChains: evidenceChains.filter(Boolean),
            includeBaseline: options.includeBaseline,
            includeCalculations: options.includeCalculations,
            generatedAt: new Date().toISOString(),
          };
          filePath = `/exports/audit_${options.dealId}_${Date.now()}.json`;
          // In production, write to file system
          fileSize = JSON.stringify(jsonData).length;
          break;

        case 'excel':
          // TODO: Implement Excel export using exceljs
          filePath = `/exports/audit_${options.dealId}_${Date.now()}.xlsx`;
          fileSize = 0;
          break;

        case 'pdf':
          // TODO: Implement PDF export using pdfkit or puppeteer
          filePath = `/exports/audit_${options.dealId}_${Date.now()}.pdf`;
          fileSize = 0;
          break;

        default:
          throw new Error(`Unsupported export type: ${options.exportType}`);
      }

      // Save export snapshot record
      const result = await client.query(
        `INSERT INTO export_snapshots 
         (deal_id, export_type, assumption_ids, include_baseline, include_calculations,
          confidence_threshold, file_path, file_size_bytes, title, description, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          options.dealId,
          options.exportType,
          assumptionIds,
          options.includeBaseline !== false,
          options.includeCalculations !== false,
          options.confidenceThreshold,
          filePath,
          fileSize,
          options.title || `Audit Report - ${auditSummary.dealName}`,
          options.description,
          options.generatedBy,
        ]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Record event corroboration
   */
  async recordCorroboration(
    primaryEventId: string,
    corroboratingEventId: string,
    corroborationType: 'confirms' | 'updates' | 'contradicts',
    corroborationStrength: number = 1.0,
    details?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `INSERT INTO event_corroboration 
         (primary_event_id, corroborating_event_id, corroboration_type, 
          corroboration_strength, details, confidence_boost)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          primaryEventId,
          corroboratingEventId,
          corroborationType,
          corroborationStrength,
          details,
          corroborationType === 'confirms' ? 0.1 : 0.0,
        ]
      );

      // Update confidence if confirming
      if (corroborationType === 'confirms') {
        await client.query(
          `UPDATE assumption_evidence 
           SET overall_confidence = LEAST(overall_confidence + 0.1, 1.0),
               updated_at = NOW()
           WHERE primary_event_id = $1`,
          [primaryEventId]
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Update source credibility
   */
  async updateSourceCredibility(
    sourceName: string,
    confirmed: boolean
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `UPDATE source_credibility
         SET total_events = total_events + 1,
             confirmed_events = confirmed_events + CASE WHEN $2 THEN 1 ELSE 0 END,
             false_positives = false_positives + CASE WHEN $2 THEN 0 ELSE 1 END
         WHERE source_name = $1`,
        [sourceName, confirmed]
      );

      await client.query(
        `SELECT update_source_credibility($1)`,
        [sourceName]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Format calculation type for display
   */
  private formatCalculationType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'demand_signal': 'Demand Signal Calculation',
      'supply_signal': 'Supply Signal Analysis',
      'demand_supply_ratio': 'Demand-Supply Ratio',
      'rent_elasticity': 'Rent Growth Adjustment',
      'vacancy_impact': 'Vacancy Impact',
      'expense_ratio': 'Expense Ratio Adjustment',
      'cap_rate_adjustment': 'Cap Rate Adjustment',
    };

    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
