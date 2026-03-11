/**
 * Tax Comp Analysis Service
 * Compares subject property tax burden to comparable sales
 * Enables over-assessment detection and appeal candidates
 */

import { getPool } from '../../database/connection';
import { compSetService } from '../saleComps/compSet.service';

const pool = getPool();

export interface TaxCompRecord {
  transaction_id: string;
  property_address: string;
  units: number;
  year_built: number;
  distance_miles: number;
  sale_price: number;
  sale_date: Date;
  
  // Tax data
  latest_tax_year: number | null;
  annual_tax: number | null;
  assessed_value: number | null;
  tax_per_unit: number | null;
  effective_tax_rate: number | null; // tax / assessed_value
}

export interface TaxCompAnalysisResult {
  deal_id: string;
  
  // Subject property
  subject_annual_tax: number | null;
  subject_tax_per_unit: number | null;
  subject_assessed_value: number | null;
  subject_effective_rate: number | null;
  
  // Comp statistics
  comp_count: number;
  comps_with_tax_data: number;
  median_tax_per_unit: number | null;
  avg_tax_per_unit: number | null;
  median_effective_rate: number | null;
  avg_effective_rate: number | null;
  
  // Subject positioning
  subject_vs_median_tax_pct: number | null;
  subject_vs_median_rate_pct: number | null;
  subject_tax_percentile: number | null; // 0-100, higher = pays more
  
  // Over-assessment signals
  is_potential_over_assessment: boolean;
  over_assessment_confidence: 'low' | 'medium' | 'high' | null;
  appeal_recommendation: string | null;
  
  // Detailed comps
  comps: TaxCompRecord[];
  
  // Analysis metadata
  analyzed_at: Date;
}

export class TaxCompAnalysisService {
  /**
   * Perform tax comp analysis for a deal
   */
  async analyzeTaxComps(deal_id: string): Promise<TaxCompAnalysisResult> {
    // 1. Get subject property tax data (join deals→properties via address)
    const subjectResult = await pool.query(`
      SELECT 
        ptr.tax_amount AS total_tax_amount,
        ptr.assessed_value,
        p.units,
        ptr.tax_year
      FROM deals d
      JOIN properties p ON p.address_line1 = d.address OR p.address_line1 = d.property_address
      LEFT JOIN property_tax_records ptr ON ptr.property_id = p.id
      WHERE d.id = $1::uuid
      ORDER BY ptr.tax_year DESC NULLS LAST
      LIMIT 1
    `, [deal_id]);

    const subject = subjectResult.rows[0] || {};
    const subjectAnnualTax = subject.total_tax_amount ? parseFloat(subject.total_tax_amount) : null;
    const subjectAssessedValue = subject.assessed_value ? parseFloat(subject.assessed_value) : null;
    const subjectUnits = subject.units || null;
    
    const subjectTaxPerUnit = subjectAnnualTax && subjectUnits 
      ? subjectAnnualTax / subjectUnits 
      : null;
    
    const subjectEffectiveRate = subjectAnnualTax && subjectAssessedValue
      ? (subjectAnnualTax / subjectAssessedValue) * 100
      : null;

    // 2. Get comp set
    const compSet = await compSetService.getCompSetByDeal(deal_id);
    
    if (!compSet || compSet.comps.length === 0) {
      return {
        deal_id,
        subject_annual_tax: subjectAnnualTax,
        subject_tax_per_unit: subjectTaxPerUnit,
        subject_assessed_value: subjectAssessedValue,
        subject_effective_rate: subjectEffectiveRate,
        comp_count: 0,
        comps_with_tax_data: 0,
        median_tax_per_unit: null,
        avg_tax_per_unit: null,
        median_effective_rate: null,
        avg_effective_rate: null,
        subject_vs_median_tax_pct: null,
        subject_vs_median_rate_pct: null,
        subject_tax_percentile: null,
        is_potential_over_assessment: false,
        over_assessment_confidence: null,
        appeal_recommendation: null,
        comps: [],
        analyzed_at: new Date()
      };
    }

    // 3. Get tax data for each comp
    const taxComps: TaxCompRecord[] = [];
    
    for (const comp of compSet.comps) {
      const taxResult = await pool.query(`
        SELECT 
          ptr.tax_year,
          ptr.tax_amount AS total_tax_amount,
          ptr.assessed_value,
          p.units
        FROM recorded_transactions rt
        LEFT JOIN properties p ON p.address_line1 = rt.property_address
        LEFT JOIN property_tax_records ptr ON ptr.property_id = p.id
        WHERE rt.id = $1::uuid
        ORDER BY ptr.tax_year DESC NULLS LAST
        LIMIT 1
      `, [comp.id]);

      const taxData = taxResult.rows[0] || {};
      const annualTax = taxData.total_tax_amount ? parseFloat(taxData.total_tax_amount) : null;
      const assessedValue = taxData.assessed_value ? parseFloat(taxData.assessed_value) : null;
      const units = taxData.units || comp.units;
      
      const taxPerUnit = annualTax && units ? annualTax / units : null;
      const effectiveRate = annualTax && assessedValue 
        ? (annualTax / assessedValue) * 100 
        : null;

      taxComps.push({
        transaction_id: comp.id,
        property_address: comp.property_address,
        units: comp.units,
        year_built: comp.year_built,
        distance_miles: comp.distance_miles,
        sale_price: comp.derived_sale_price,
        sale_date: comp.recording_date,
        latest_tax_year: taxData.tax_year || null,
        annual_tax: annualTax,
        assessed_value: assessedValue,
        tax_per_unit: taxPerUnit,
        effective_tax_rate: effectiveRate
      });
    }

    // 4. Calculate comp statistics
    const compsWithTax = taxComps.filter(c => c.tax_per_unit !== null);
    const taxPerUnitValues = compsWithTax.map(c => c.tax_per_unit!).sort((a, b) => a - b);
    const effectiveRateValues = compsWithTax
      .filter(c => c.effective_tax_rate !== null)
      .map(c => c.effective_tax_rate!)
      .sort((a, b) => a - b);

    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };

    const avg = (arr: number[]) => arr.length > 0 
      ? arr.reduce((a, b) => a + b, 0) / arr.length 
      : null;

    const medianTaxPerUnit = median(taxPerUnitValues);
    const avgTaxPerUnit = avg(taxPerUnitValues);
    const medianEffectiveRate = median(effectiveRateValues);
    const avgEffectiveRate = avg(effectiveRateValues);

    // 5. Subject positioning
    const subjectVsMedianTaxPct = subjectTaxPerUnit && medianTaxPerUnit
      ? ((subjectTaxPerUnit - medianTaxPerUnit) / medianTaxPerUnit) * 100
      : null;

    const subjectVsMedianRatePct = subjectEffectiveRate && medianEffectiveRate
      ? ((subjectEffectiveRate - medianEffectiveRate) / medianEffectiveRate) * 100
      : null;

    const subjectTaxPercentile = subjectTaxPerUnit && taxPerUnitValues.length > 0
      ? Math.round((taxPerUnitValues.filter(v => v <= subjectTaxPerUnit).length / taxPerUnitValues.length) * 100)
      : null;

    // 6. Over-assessment detection
    let isPotentialOverAssessment = false;
    let overAssessmentConfidence: 'low' | 'medium' | 'high' | null = null;
    let appealRecommendation: string | null = null;

    if (subjectVsMedianTaxPct !== null && compsWithTax.length >= 3) {
      if (subjectVsMedianTaxPct > 15) {
        isPotentialOverAssessment = true;
        
        if (subjectVsMedianTaxPct > 30 && compsWithTax.length >= 5) {
          overAssessmentConfidence = 'high';
          appealRecommendation = `Subject pays ${subjectVsMedianTaxPct.toFixed(1)}% more tax/unit than median comp (${compsWithTax.length} comps). Strong appeal candidate. Recommend filing property tax appeal with comp evidence.`;
        } else if (subjectVsMedianTaxPct > 20) {
          overAssessmentConfidence = 'medium';
          appealRecommendation = `Subject pays ${subjectVsMedianTaxPct.toFixed(1)}% more tax/unit than median comp. Consider property tax appeal if assessment methodology is questionable.`;
        } else {
          overAssessmentConfidence = 'low';
          appealRecommendation = `Subject pays ${subjectVsMedianTaxPct.toFixed(1)}% more tax/unit than median comp. May be justified by superior property features or timing differences.`;
        }
      }
    }

    // 7. Store analysis result
    await pool.query(`
      INSERT INTO tax_comp_analyses (
        deal_id,
        subject_annual_tax, subject_tax_per_unit, subject_assessed_value, subject_effective_rate,
        comp_count, comps_with_tax_data,
        median_tax_per_unit, avg_tax_per_unit,
        median_effective_rate, avg_effective_rate,
        subject_vs_median_tax_pct, subject_vs_median_rate_pct, subject_tax_percentile,
        is_potential_over_assessment, over_assessment_confidence, appeal_recommendation,
        comps_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (deal_id) DO UPDATE SET
        subject_annual_tax = EXCLUDED.subject_annual_tax,
        subject_tax_per_unit = EXCLUDED.subject_tax_per_unit,
        subject_assessed_value = EXCLUDED.subject_assessed_value,
        subject_effective_rate = EXCLUDED.subject_effective_rate,
        comp_count = EXCLUDED.comp_count,
        comps_with_tax_data = EXCLUDED.comps_with_tax_data,
        median_tax_per_unit = EXCLUDED.median_tax_per_unit,
        avg_tax_per_unit = EXCLUDED.avg_tax_per_unit,
        median_effective_rate = EXCLUDED.median_effective_rate,
        avg_effective_rate = EXCLUDED.avg_effective_rate,
        subject_vs_median_tax_pct = EXCLUDED.subject_vs_median_tax_pct,
        subject_vs_median_rate_pct = EXCLUDED.subject_vs_median_rate_pct,
        subject_tax_percentile = EXCLUDED.subject_tax_percentile,
        is_potential_over_assessment = EXCLUDED.is_potential_over_assessment,
        over_assessment_confidence = EXCLUDED.over_assessment_confidence,
        appeal_recommendation = EXCLUDED.appeal_recommendation,
        comps_data = EXCLUDED.comps_data,
        analyzed_at = NOW()
    `, [
      deal_id,
      subjectAnnualTax,
      subjectTaxPerUnit,
      subjectAssessedValue,
      subjectEffectiveRate,
      compSet.comps.length,
      compsWithTax.length,
      medianTaxPerUnit,
      avgTaxPerUnit,
      medianEffectiveRate,
      avgEffectiveRate,
      subjectVsMedianTaxPct,
      subjectVsMedianRatePct,
      subjectTaxPercentile,
      isPotentialOverAssessment,
      overAssessmentConfidence,
      appealRecommendation,
      JSON.stringify(taxComps)
    ]);

    return {
      deal_id,
      subject_annual_tax: subjectAnnualTax,
      subject_tax_per_unit: subjectTaxPerUnit,
      subject_assessed_value: subjectAssessedValue,
      subject_effective_rate: subjectEffectiveRate,
      comp_count: compSet.comps.length,
      comps_with_tax_data: compsWithTax.length,
      median_tax_per_unit: medianTaxPerUnit,
      avg_tax_per_unit: avgTaxPerUnit,
      median_effective_rate: medianEffectiveRate,
      avg_effective_rate: avgEffectiveRate,
      subject_vs_median_tax_pct: subjectVsMedianTaxPct,
      subject_vs_median_rate_pct: subjectVsMedianRatePct,
      subject_tax_percentile: subjectTaxPercentile,
      is_potential_over_assessment: isPotentialOverAssessment,
      over_assessment_confidence: overAssessmentConfidence,
      appeal_recommendation: appealRecommendation,
      comps: taxComps,
      analyzed_at: new Date()
    };
  }

  /**
   * Get existing tax comp analysis for a deal
   */
  async getTaxCompAnalysis(deal_id: string): Promise<TaxCompAnalysisResult | null> {
    const result = await pool.query(`
      SELECT * FROM tax_comp_analyses
      WHERE deal_id = $1::uuid
      ORDER BY analyzed_at DESC
      LIMIT 1
    `, [deal_id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      deal_id: row.deal_id,
      subject_annual_tax: row.subject_annual_tax ? parseFloat(row.subject_annual_tax) : null,
      subject_tax_per_unit: row.subject_tax_per_unit ? parseFloat(row.subject_tax_per_unit) : null,
      subject_assessed_value: row.subject_assessed_value ? parseFloat(row.subject_assessed_value) : null,
      subject_effective_rate: row.subject_effective_rate ? parseFloat(row.subject_effective_rate) : null,
      comp_count: row.comp_count,
      comps_with_tax_data: row.comps_with_tax_data,
      median_tax_per_unit: row.median_tax_per_unit ? parseFloat(row.median_tax_per_unit) : null,
      avg_tax_per_unit: row.avg_tax_per_unit ? parseFloat(row.avg_tax_per_unit) : null,
      median_effective_rate: row.median_effective_rate ? parseFloat(row.median_effective_rate) : null,
      avg_effective_rate: row.avg_effective_rate ? parseFloat(row.avg_effective_rate) : null,
      subject_vs_median_tax_pct: row.subject_vs_median_tax_pct ? parseFloat(row.subject_vs_median_tax_pct) : null,
      subject_vs_median_rate_pct: row.subject_vs_median_rate_pct ? parseFloat(row.subject_vs_median_rate_pct) : null,
      subject_tax_percentile: row.subject_tax_percentile,
      is_potential_over_assessment: row.is_potential_over_assessment,
      over_assessment_confidence: row.over_assessment_confidence,
      appeal_recommendation: row.appeal_recommendation,
      comps: row.comps_data || [],
      analyzed_at: row.analyzed_at
    };
  }

  /**
   * Format tax comp analysis for display
   */
  formatAnalysisSummary(analysis: TaxCompAnalysisResult): string {
    const lines: string[] = [];

    lines.push('📊 TAX COMP ANALYSIS');
    lines.push('');

    if (analysis.comps_with_tax_data === 0) {
      lines.push('⚠️  No tax data available for comps');
      return lines.join('\n');
    }

    // Subject
    lines.push('Subject Property:');
    if (analysis.subject_tax_per_unit) {
      lines.push(`  Tax: $${analysis.subject_annual_tax?.toLocaleString() || 'N/A'}/year ($${Math.round(analysis.subject_tax_per_unit).toLocaleString()}/unit)`);
    }
    if (analysis.subject_effective_rate) {
      lines.push(`  Effective Rate: ${analysis.subject_effective_rate.toFixed(2)}%`);
    }
    lines.push('');

    // Comps
    lines.push(`Comp Set (${analysis.comps_with_tax_data} with tax data):`);
    if (analysis.median_tax_per_unit) {
      lines.push(`  Median: $${Math.round(analysis.median_tax_per_unit).toLocaleString()}/unit`);
    }
    if (analysis.median_effective_rate) {
      lines.push(`  Median Rate: ${analysis.median_effective_rate.toFixed(2)}%`);
    }
    lines.push('');

    // Positioning
    if (analysis.subject_vs_median_tax_pct !== null) {
      const emoji = analysis.subject_vs_median_tax_pct > 0 ? '⚠️' : '✅';
      const direction = analysis.subject_vs_median_tax_pct > 0 ? 'MORE' : 'LESS';
      lines.push(`${emoji} Subject pays ${Math.abs(analysis.subject_vs_median_tax_pct).toFixed(1)}% ${direction} than median comp`);
    }

    if (analysis.subject_tax_percentile !== null) {
      lines.push(`  Percentile: ${analysis.subject_tax_percentile}th (higher = pays more)`);
    }
    lines.push('');

    // Appeal recommendation
    if (analysis.is_potential_over_assessment && analysis.appeal_recommendation) {
      lines.push(`🚨 ${analysis.appeal_recommendation}`);
    }

    return lines.join('\n');
  }
}

export const taxCompAnalysisService = new TaxCompAnalysisService();
