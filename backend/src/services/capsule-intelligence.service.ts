/**
 * Capsule Intelligence Service
 *
 * When a deal capsule is created, this service:
 * 1. Pulls comparable data from the Data Library (T12s, rent rolls, OMs)
 * 2. Pulls market context from the Knowledge Graph
 * 3. Pulls macro data from the Data Matrix
 * 4. Seeds platform_intel with smart assumptions + confidence scores
 *
 * The result: CashFlow agent starts from real data, not blank assumptions.
 *
 * Assumption confidence levels:
 *   HIGH (>0.85): 5+ comps, fresh data, small variance
 *   MEDIUM (0.65-0.85): 2-4 comps or slightly stale
 *   LOW (<0.65): 1 comp, old data, or inferred
 */

import { query, getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { dataLibraryService } from './dataLibrary.service';

// ============================================================================
// TYPES
// ============================================================================

export interface SeedAssumption {
  value: number | string;
  source: string;
  confidence: number; // 0-1
  compsUsed?: number;
  range?: { min: number; max: number };
  notes?: string;
}

export interface CapsuleIntelligenceResult {
  // Rent
  marketRent?: SeedAssumption;
  rentGrowth?: SeedAssumption;

  // Vacancy
  vacancyRate?: SeedAssumption;
  economicVacancy?: SeedAssumption;

  // Expenses
  expenseRatio?: SeedAssumption;
  operatingExpenses?: SeedAssumption;
  managementFee?: SeedAssumption;
  taxes?: SeedAssumption;
  insurance?: SeedAssumption;
  repairs?: SeedAssumption;
  utilities?: SeedAssumption;

  // Cap rates
  goingInCapRate?: SeedAssumption;
  exitCapRate?: SeedAssumption;

  // Value
  replacementCost?: SeedAssumption;
  pricePerUnit?: SeedAssumption;

  // Market context
  supplyRisk?: SeedAssumption;
  marketSentiment?: SeedAssumption;
  pipelineUnits?: SeedAssumption;

  // Metadata
  dataLibraryCompsFound: number;
  knowledgeGraphLinked: boolean;
  dataQualityScore: number; // 0-100
  gaps: string[]; // What's missing
  recommendations: string[]; // "Upload T12 to improve confidence"
}

// ============================================================================
// SERVICE
// ============================================================================

export class CapsuleIntelligenceService {

  /**
   * Main entry point: seed a capsule with smart assumptions
   */
  async seedCapsule(params: {
    capsuleId: string;
    propertyAddress: string;
    city?: string;
    state?: string;
    zip?: string;
    propertyType?: string;
    units?: number;
    yearBuilt?: number;
    userId?: string;
  }): Promise<CapsuleIntelligenceResult> {
    logger.info('[CapsuleIntelligence] Seeding capsule', { capsuleId: params.capsuleId, city: params.city });

    const gaps: string[] = [];
    const recommendations: string[] = [];

    // Run all intelligence pulls in parallel
    const [dataLibraryData, graphData, macroData] = await Promise.allSettled([
      this.pullDataLibraryComps(params),
      this.pullKnowledgeGraphContext(params),
      this.pullMacroContext(params),
    ]);

    const dlData = dataLibraryData.status === 'fulfilled' ? dataLibraryData.value : null;
    const kgData = graphData.status === 'fulfilled' ? graphData.value : null;
    const macro = macroData.status === 'fulfilled' ? macroData.value : null;

    // Build the intelligence result
    const result: CapsuleIntelligenceResult = {
      dataLibraryCompsFound: dlData?.compsFound || 0,
      knowledgeGraphLinked: !!kgData,
      dataQualityScore: 0,
      gaps,
      recommendations,
    };

    // --- RENT ---
    if (dlData?.avgRent) {
      result.marketRent = {
        value: dlData.avgRent,
        source: `${dlData.rentCompsUsed} Data Library comp${dlData.rentCompsUsed !== 1 ? 's' : ''}`,
        confidence: this.calcConfidence(dlData.rentCompsUsed, dlData.rentVariance),
        compsUsed: dlData.rentCompsUsed,
        range: dlData.rentRange,
      };
    } else if (macro?.marketRent) {
      result.marketRent = {
        value: macro.marketRent,
        source: 'Market average (Zillow ZORI)',
        confidence: 0.60,
        notes: 'Upload rent rolls for better accuracy',
      };
      recommendations.push('Upload rent rolls from comparable properties for higher confidence market rent');
    } else {
      gaps.push('market_rent');
    }

    // --- VACANCY ---
    if (dlData?.avgVacancy) {
      result.vacancyRate = {
        value: dlData.avgVacancy,
        source: `${dlData.vacancyCompsUsed} T12 comps`,
        confidence: this.calcConfidence(dlData.vacancyCompsUsed, dlData.vacancyVariance),
        compsUsed: dlData.vacancyCompsUsed,
        range: dlData.vacancyRange,
      };
    } else if (kgData?.marketVacancy) {
      result.vacancyRate = {
        value: kgData.marketVacancy,
        source: 'Knowledge Graph market average',
        confidence: 0.65,
      };
    } else {
      gaps.push('vacancy_rate');
      recommendations.push('Upload T12 statements to get property-level vacancy data');
    }

    // --- EXPENSES ---
    if (dlData?.avgExpenseRatio) {
      result.expenseRatio = {
        value: dlData.avgExpenseRatio,
        source: `${dlData.expenseCompsUsed} T12 comps`,
        confidence: this.calcConfidence(dlData.expenseCompsUsed, dlData.expenseVariance),
        compsUsed: dlData.expenseCompsUsed,
        range: dlData.expenseRange,
        notes: 'Excludes capex and debt service',
      };

      // Break down individual line items if available
      if (dlData.avgManagement) result.managementFee = { value: dlData.avgManagement, source: 'T12 comps', confidence: 0.75 };
      if (dlData.avgTaxes) result.taxes = { value: dlData.avgTaxes, source: 'T12 comps + county records', confidence: 0.80 };
      if (dlData.avgInsurance) result.insurance = { value: dlData.avgInsurance, source: 'T12 comps', confidence: 0.70 };
      if (dlData.avgRepairs) result.repairs = { value: dlData.avgRepairs, source: 'T12 comps', confidence: 0.65 };
    } else {
      gaps.push('expense_ratio');
      recommendations.push('Upload T12 statements to get expense benchmarks for this submarket');
    }

    // --- CAP RATES ---
    if (dlData?.avgCapRate) {
      result.goingInCapRate = {
        value: dlData.avgCapRate,
        source: `${dlData.capRateCompsUsed} sales comps`,
        confidence: this.calcConfidence(dlData.capRateCompsUsed, dlData.capRateVariance),
        compsUsed: dlData.capRateCompsUsed,
        range: dlData.capRateRange,
      };
      result.exitCapRate = {
        value: Math.round((dlData.avgCapRate + 0.25) * 100) / 100,
        source: 'Derived from going-in + 25bps spread',
        confidence: 0.60,
        notes: 'Adjust based on hold period and market cycle',
      };
    } else if (kgData?.marketCapRate) {
      result.goingInCapRate = {
        value: kgData.marketCapRate,
        source: 'Knowledge Graph market average',
        confidence: 0.60,
      };
    } else {
      gaps.push('cap_rate');
    }

    // --- REPLACEMENT COST ---
    if (kgData?.replacementCost) {
      result.replacementCost = {
        value: kgData.replacementCost,
        source: 'Permit-derived + BLS RPP regional factor',
        confidence: 0.72,
      };
    }

    // --- SUPPLY RISK ---
    if (kgData?.pipelineUnits !== undefined) {
      const riskLevel = kgData.pipelineUnits > 3000 ? 'HIGH' :
                        kgData.pipelineUnits > 1500 ? 'MODERATE' : 'LOW';
      result.supplyRisk = {
        value: riskLevel,
        source: `Knowledge Graph: ${kgData.pipelineUnits.toLocaleString()} units in pipeline`,
        confidence: 0.80,
        notes: `${kgData.pipelineUnits.toLocaleString()} units under construction/planned in market`,
      };
      result.pipelineUnits = {
        value: kgData.pipelineUnits,
        source: 'Development projects table + Knowledge Graph',
        confidence: 0.75,
      };
    }

    // --- MARKET SENTIMENT ---
    if (kgData?.sentimentScore) {
      result.marketSentiment = {
        value: kgData.sentimentScore,
        source: 'Broker narrative analysis',
        confidence: 0.65,
      };
    }

    // --- DATA QUALITY SCORE ---
    const filledCount = [
      result.marketRent, result.vacancyRate, result.expenseRatio,
      result.goingInCapRate, result.replacementCost, result.supplyRisk
    ].filter(Boolean).length;
    result.dataQualityScore = Math.round((filledCount / 6) * 100);

    // --- STANDARD RECOMMENDATIONS ---
    if (!dlData || dlData.compsFound < 3) {
      recommendations.push(`Upload T12 statements and rent rolls from similar ${params.city || 'local'} properties to the Data Library`);
    }
    if (gaps.includes('market_rent')) {
      recommendations.push('Add rent comp data to Data Library for this submarket');
    }
    if (result.dataQualityScore < 50) {
      recommendations.push('Low data quality — consider running Research Agent for market intelligence');
    }

    // --- CREATE DEAL NODE IN KNOWLEDGE GRAPH ---
    try {
      const { getKnowledgeGraph } = await import('./neural-network/knowledge-graph.service');
      const pool = getPool();
      const kg = getKnowledgeGraph(pool);
      await kg.upsertNode({
        type: 'Deal',
        externalId: params.capsuleId,
        name: params.propertyAddress || `Deal ${params.capsuleId}`,
        properties: {
          city: params.city,
          state: params.state,
          propertyType: params.propertyType,
          units: params.units,
          dataQualityScore: result.dataQualityScore,
          supplyRisk: result.supplyRisk?.value,
          pipelineUnits: result.pipelineUnits?.value,
          intelligenceSeededAt: new Date(),
        }
      } as any);

      // Link Deal → Market
      if (params.city) {
        const marketId = this.cityToMarketId(params.city);
        if (marketId) {
          await kg.createEdge({
            sourceNodeId: params.capsuleId,
            targetNodeId: `market:${marketId}`,
            edgeType: 'IN_MARKET',
            properties: { linkedAt: new Date() }
          });
        }
      }
    } catch (kgErr) {
      logger.warn('[CapsuleIntelligence] Failed to create KG Deal node', { err: kgErr });
    }

    // --- SAVE TO CAPSULE platform_intel ---
    await this.saveToCapsule(params.capsuleId, result);

    logger.info('[CapsuleIntelligence] Seeding complete', {
      capsuleId: params.capsuleId,
      dataQualityScore: result.dataQualityScore,
      compsFound: result.dataLibraryCompsFound,
      gapsCount: gaps.length,
    });

    return result;
  }

  // ==========================================================================
  // DATA LIBRARY PULL
  // ==========================================================================

  private async pullDataLibraryComps(params: {
    city?: string;
    propertyType?: string;
    units?: number;
  }): Promise<{
    compsFound: number;
    avgRent?: number; rentCompsUsed: number; rentVariance?: number; rentRange?: { min: number; max: number };
    avgVacancy?: number; vacancyCompsUsed: number; vacancyVariance?: number; vacancyRange?: { min: number; max: number };
    avgExpenseRatio?: number; expenseCompsUsed: number; expenseVariance?: number; expenseRange?: { min: number; max: number };
    avgManagement?: number; avgTaxes?: number; avgInsurance?: number; avgRepairs?: number;
    avgCapRate?: number; capRateCompsUsed: number; capRateVariance?: number; capRateRange?: { min: number; max: number };
  }> {
    try {
      // Find comparable files in Data Library
      const comparables = await dataLibraryService.findComparables({
        city: params.city,
        propertyType: params.propertyType || 'multifamily',
        unitCount: params.units,
      });

      if (!comparables || comparables.length === 0) {
        return { compsFound: 0, rentCompsUsed: 0, vacancyCompsUsed: 0, expenseCompsUsed: 0, capRateCompsUsed: 0 };
      }

      // Pull extracted financial data from the data_library_assets table
      const pool = getPool();
      const fileIds = comparables.map(c => c.id).filter(Boolean);

      if (fileIds.length === 0) {
        return { compsFound: 0, rentCompsUsed: 0, vacancyCompsUsed: 0, expenseCompsUsed: 0, capRateCompsUsed: 0 };
      }

      const assetsResult = await pool.query(`
        SELECT 
          a.file_id,
          COALESCE(a.asking_price_per_unit, a.price_per_unit) as asking_price_per_unit,
          COALESCE(a.cap_rate, a.going_in_cap_rate, a.stabilized_cap_rate) as cap_rate,
          COALESCE(a.gross_potential_rent, a.trailing_revenue) as gross_potential_rent,
          a.vacancy_rate,
          COALESCE(a.operating_expense_ratio, a.opex_ratio) as operating_expense_ratio,
          a.management_fee_pct,
          a.property_tax_per_unit,
          a.insurance_per_unit,
          a.repairs_maintenance_per_unit,
          a.data_type
        FROM data_library_assets a
        WHERE a.file_id = ANY($1)
          AND (
            a.asking_price_per_unit IS NOT NULL OR a.price_per_unit IS NOT NULL OR
            a.cap_rate IS NOT NULL OR a.going_in_cap_rate IS NOT NULL OR
            a.gross_potential_rent IS NOT NULL OR a.trailing_revenue IS NOT NULL
          )
      `, [fileIds]);

      const assets = assetsResult.rows;

      if (assets.length === 0) {
        return { compsFound: comparables.length, rentCompsUsed: 0, vacancyCompsUsed: 0, expenseCompsUsed: 0, capRateCompsUsed: 0 };
      }

      // Calculate averages with variance
      const rents = assets.map(a => a.gross_potential_rent).filter(v => v && v > 0);
      const vacancies = assets.map(a => a.vacancy_rate).filter(v => v !== null && v !== undefined);
      const expenses = assets.map(a => a.operating_expense_ratio).filter(v => v && v > 0);
      const capRates = assets.map(a => a.cap_rate).filter(v => v && v > 0);

      return {
        compsFound: comparables.length,

        avgRent: rents.length > 0 ? Math.round(this.avg(rents)) : undefined,
        rentCompsUsed: rents.length,
        rentVariance: rents.length > 1 ? this.variance(rents) : undefined,
        rentRange: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : undefined,

        avgVacancy: vacancies.length > 0 ? Math.round(this.avg(vacancies) * 10) / 10 : undefined,
        vacancyCompsUsed: vacancies.length,
        vacancyVariance: vacancies.length > 1 ? this.variance(vacancies) : undefined,
        vacancyRange: vacancies.length > 0 ? { min: Math.min(...vacancies), max: Math.max(...vacancies) } : undefined,

        avgExpenseRatio: expenses.length > 0 ? Math.round(this.avg(expenses) * 10) / 10 : undefined,
        expenseCompsUsed: expenses.length,
        expenseVariance: expenses.length > 1 ? this.variance(expenses) : undefined,
        expenseRange: expenses.length > 0 ? { min: Math.min(...expenses), max: Math.max(...expenses) } : undefined,

        avgManagement: this.avgField(assets, 'management_fee_pct'),
        avgTaxes: this.avgField(assets, 'property_tax_per_unit'),
        avgInsurance: this.avgField(assets, 'insurance_per_unit'),
        avgRepairs: this.avgField(assets, 'repairs_maintenance_per_unit'),

        avgCapRate: capRates.length > 0 ? Math.round(this.avg(capRates) * 100) / 100 : undefined,
        capRateCompsUsed: capRates.length,
        capRateVariance: capRates.length > 1 ? this.variance(capRates) : undefined,
        capRateRange: capRates.length > 0 ? { min: Math.min(...capRates), max: Math.max(...capRates) } : undefined,
      };
    } catch (err) {
      logger.warn('[CapsuleIntelligence] Data Library pull failed', { err });
      return { compsFound: 0, rentCompsUsed: 0, vacancyCompsUsed: 0, expenseCompsUsed: 0, capRateCompsUsed: 0 };
    }
  }

  // ==========================================================================
  // KNOWLEDGE GRAPH PULL
  // ==========================================================================

  private async pullKnowledgeGraphContext(params: {
    city?: string;
    state?: string;
  }): Promise<{
    marketVacancy?: number;
    marketCapRate?: number;
    pipelineUnits?: number;
    replacementCost?: number;
    sentimentScore?: string;
  } | null> {
    try {
      const pool = getPool();

      // Derive marketId from city
      const marketId = this.cityToMarketId(params.city || '');
      if (!marketId) return null;

      // Get market node
      const marketResult = await pool.query(
        `SELECT properties FROM knowledge_graph_nodes WHERE id = $1 LIMIT 1`,
        [marketId]
      );
      const marketProps = marketResult.rows[0]?.properties || {};

      // Get pipeline units from development_projects
      const pipelineResult = await pool.query(
        `SELECT COALESCE(SUM(units), 0) as total_units
         FROM development_projects
         WHERE market_id = $1
           AND construction_status IN ('planned', 'permitted', 'under_construction', 'lease_up')`,
        [marketId]
      );
      const pipelineUnits = parseInt(pipelineResult.rows[0]?.total_units || '0');

      // Get replacement cost from inflation data
      const replacementResult = await pool.query(
        `SELECT cost_per_unit
         FROM om_replacement_cost_data
         WHERE city ILIKE $1
         ORDER BY created_at DESC LIMIT 1`,
        [`%${params.city}%`]
      ).catch(() => ({ rows: [] }));

      return {
        marketVacancy: marketProps.vacancyRate,
        marketCapRate: marketProps.capRate,
        pipelineUnits,
        replacementCost: replacementResult.rows[0]?.cost_per_unit,
        sentimentScore: marketProps.sentimentLabel,
      };
    } catch (err) {
      logger.warn('[CapsuleIntelligence] Knowledge Graph pull failed', { err });
      return null;
    }
  }

  // ==========================================================================
  // MACRO CONTEXT PULL
  // ==========================================================================

  private async pullMacroContext(params: { city?: string }): Promise<{ marketRent?: number } | null> {
    try {
      const pool = getPool();
      const marketId = this.cityToMarketId(params.city || '');

      // Try ZORI rent index for this market
      const zoriResult = await pool.query(`
        SELECT value
        FROM metric_time_series
        WHERE metric_id ILIKE 'ZORI%'
          AND geo_id ILIKE $1
        ORDER BY date DESC
        LIMIT 1
      `, [`%${marketId}%`]).catch(() => ({ rows: [] }));

      return {
        marketRent: zoriResult.rows[0]?.value ? parseFloat(zoriResult.rows[0].value) : undefined,
      };
    } catch (err) {
      return null;
    }
  }

  // ==========================================================================
  // SAVE TO CAPSULE
  // ==========================================================================

  private async saveToCapsule(capsuleId: string, intelligence: CapsuleIntelligenceResult): Promise<void> {
    try {
      await query(`
        UPDATE deal_capsules
        SET platform_intel = platform_intel || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `, [capsuleId, JSON.stringify({
        intelligence: {
          seededAt: new Date(),
          assumptions: {
            marketRent: intelligence.marketRent,
            vacancyRate: intelligence.vacancyRate,
            expenseRatio: intelligence.expenseRatio,
            goingInCapRate: intelligence.goingInCapRate,
            exitCapRate: intelligence.exitCapRate,
            replacementCost: intelligence.replacementCost,
            supplyRisk: intelligence.supplyRisk,
            pipelineUnits: intelligence.pipelineUnits,
          },
          dataQualityScore: intelligence.dataQualityScore,
          compsFound: intelligence.dataLibraryCompsFound,
          gaps: intelligence.gaps,
          recommendations: intelligence.recommendations,
        }
      })]);
    } catch (err) {
      logger.warn('[CapsuleIntelligence] Failed to save to capsule', { err, capsuleId });
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private avg(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private variance(arr: number[]): number {
    const mean = this.avg(arr);
    return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length);
  }

  private avgField(rows: any[], field: string): number | undefined {
    const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined && v > 0);
    return vals.length > 0 ? Math.round(this.avg(vals) * 100) / 100 : undefined;
  }

  private calcConfidence(compsUsed: number, variance?: number): number {
    // Base confidence from comp count
    let conf = compsUsed >= 5 ? 0.90 :
               compsUsed >= 3 ? 0.80 :
               compsUsed >= 2 ? 0.70 :
               compsUsed >= 1 ? 0.60 : 0.40;

    // Reduce confidence for high variance
    if (variance !== undefined && variance > 0) {
      const cvPenalty = Math.min(variance / 100, 0.20);
      conf -= cvPenalty;
    }

    return Math.round(Math.max(0.40, Math.min(0.95, conf)) * 100) / 100;
  }

  private cityToMarketId(city: string): string | null {
    const map: Record<string, string> = {
      'atlanta': 'atlanta', 'atl': 'atlanta',
      'miami': 'miami', 'tampa': 'tampa',
      'orlando': 'orlando', 'jacksonville': 'jacksonville',
      'charlotte': 'charlotte', 'raleigh': 'raleigh',
      'nashville': 'nashville', 'austin': 'austin',
      'dallas': 'dallas', 'phoenix': 'phoenix', 'denver': 'denver',
    };
    return map[city.toLowerCase().trim()] || null;
  }
}

// Singleton
let instance: CapsuleIntelligenceService | null = null;
export function getCapsuleIntelligence(): CapsuleIntelligenceService {
  if (!instance) instance = new CapsuleIntelligenceService();
  return instance;
}

export default CapsuleIntelligenceService;
