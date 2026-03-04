/**
 * M26: Tax Projection Service
 * Core calculation engine for property tax projections
 * 
 * Formulas:
 * - F40: Post-Acquisition Tax Estimate
 * - F41: Tax Cap Trajectory (Years 2-10)
 * - F43: Non-Ad-Valorem Assessment Calculator
 */

import { getPool } from '../../database/connection';

const pool = getPool();

export interface TaxProjectionInput {
  deal_id: string;
  purchase_price: number;
  parcel_id?: string;
  county_id?: string;
  units: number;
  override_millage?: number;
  override_non_ad_valorem?: number;
  exemption_reduction_pct?: number;
  projection_years?: number;
  market_value_growth_rate?: number;
  millage_trend_assumption?: 'stable' | 'increasing' | 'decreasing';
}

export interface TaxProjectionOutput {
  id: string;
  deal_id: string;
  
  // Year 1 Outputs (F40)
  projected_just_value: number;
  projected_assessed_value: number;
  projected_taxable_value: number;
  projected_ad_valorem: number;
  projected_non_ad_valorem: number;
  projected_total_tax: number;
  projected_tax_per_unit: number;
  effective_tax_rate: number;
  
  // Delta
  current_annual_tax: number | null;
  delta_amount: number | null;
  delta_pct: number | null;
  
  // Multi-year (F41)
  yearly_projections: YearlyTaxProjection[];
}

export interface YearlyTaxProjection {
  year: number;
  market_value: number;
  assessed_value: number;
  assessment_gap: number;
  annual_tax: number;
  tax_per_unit: number;
  cumulative_savings_from_cap: number;
}

export class TaxProjectionService {
  /**
   * F40: Calculate post-acquisition tax projection
   */
  async calculateProjection(input: TaxProjectionInput): Promise<TaxProjectionOutput> {
    const {
      deal_id,
      purchase_price,
      parcel_id,
      county_id,
      units,
      override_millage,
      override_non_ad_valorem,
      exemption_reduction_pct = 0,
      projection_years = 10,
      market_value_growth_rate = 0.03,
      millage_trend_assumption = 'stable'
    } = input;

    // 1. Get total millage rate
    const totalMillage = override_millage || await this.getTotalMillage(parcel_id, county_id);
    
    // 2. Get non-ad-valorem per unit
    const nonAdValoremPerUnit = override_non_ad_valorem || await this.getNonAdValoremPerUnit(parcel_id, county_id);
    
    // 3. Get current tax for delta calculation
    const currentTax = await this.getCurrentTax(parcel_id, county_id);
    
    // 4. Calculate Year 1 (F40)
    const justValue = purchase_price;
    const taxableValue = justValue * (1 - exemption_reduction_pct);
    const adValoremTax = taxableValue * (totalMillage / 1000);
    const nonAdValoremTotal = nonAdValoremPerUnit * units;
    const totalTax = adValoremTax + nonAdValoremTotal;
    const taxPerUnit = totalTax / units;
    const effectiveTaxRate = totalTax / purchase_price;
    
    // 5. Calculate delta
    const deltaAmount = currentTax ? totalTax - currentTax : null;
    const deltaPct = currentTax ? ((totalTax - currentTax) / currentTax) * 100 : null;
    
    // 6. Calculate multi-year projection (F41)
    const yearlyProjections = this.calculateCapTrajectory({
      base_assessed_value: purchase_price,
      market_value_growth_rate,
      non_homestead_cap: 0.10,
      projection_years,
      total_millage: totalMillage,
      non_ad_valorem_per_unit: nonAdValoremPerUnit,
      units,
      millage_trend_assumption
    });
    
    // 7. Store projection
    const result = await pool.query(`
      INSERT INTO tax_projections (
        deal_id, purchase_price, total_millage, non_ad_valorem_per_unit,
        units, exemption_reduction_pct,
        projected_just_value, projected_assessed_value, projected_taxable_value,
        projected_ad_valorem, projected_non_ad_valorem, projected_total_tax,
        projected_tax_per_unit, effective_tax_rate,
        current_annual_tax, delta_amount, delta_pct,
        yearly_projections, projection_assumptions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *
    `, [
      deal_id,
      purchase_price,
      totalMillage,
      nonAdValoremPerUnit,
      units,
      exemption_reduction_pct,
      justValue,
      purchase_price, // Year 1 assessed = purchase price
      taxableValue,
      adValoremTax,
      nonAdValoremTotal,
      totalTax,
      taxPerUnit,
      effectiveTaxRate,
      currentTax,
      deltaAmount,
      deltaPct,
      JSON.stringify(yearlyProjections),
      JSON.stringify({
        market_value_growth_rate,
        millage_trend_assumption,
        non_homestead_cap: 0.10,
        projection_years
      })
    ]);
    
    return {
      id: result.rows[0].id,
      deal_id,
      projected_just_value: justValue,
      projected_assessed_value: purchase_price,
      projected_taxable_value: taxableValue,
      projected_ad_valorem: adValoremTax,
      projected_non_ad_valorem: nonAdValoremTotal,
      projected_total_tax: totalTax,
      projected_tax_per_unit: taxPerUnit,
      effective_tax_rate: effectiveTaxRate,
      current_annual_tax: currentTax,
      delta_amount: deltaAmount,
      delta_pct: deltaPct,
      yearly_projections: yearlyProjections
    };
  }

  /**
   * F41: Calculate assessment cap trajectory over hold period
   */
  private calculateCapTrajectory(input: {
    base_assessed_value: number;
    market_value_growth_rate: number;
    non_homestead_cap: number;
    projection_years: number;
    total_millage: number;
    non_ad_valorem_per_unit: number;
    units: number;
    millage_trend_assumption: 'stable' | 'increasing' | 'decreasing';
  }): YearlyTaxProjection[] {
    const {
      base_assessed_value,
      market_value_growth_rate,
      non_homestead_cap,
      projection_years,
      total_millage,
      non_ad_valorem_per_unit,
      units,
      millage_trend_assumption
    } = input;

    const projections: YearlyTaxProjection[] = [];
    let marketValue = base_assessed_value;
    let assessedValue = base_assessed_value;
    let cumulativeSavings = 0;
    let currentMillage = total_millage;

    for (let year = 1; year <= projection_years; year++) {
      // Market value grows at expected rate
      if (year > 1) {
        marketValue *= (1 + market_value_growth_rate);
      }

      // Assessed value is capped at 10% annual growth
      if (year > 1) {
        const uncappedAssessed = assessedValue * (1 + non_homestead_cap);
        assessedValue = Math.min(marketValue, uncappedAssessed);
      }

      // Assessment gap (market value ahead of assessed value)
      const assessmentGap = marketValue - assessedValue;

      // Millage trend adjustment
      if (year > 1) {
        if (millage_trend_assumption === 'increasing') {
          currentMillage *= 1.02; // 2% annual increase
        } else if (millage_trend_assumption === 'decreasing') {
          currentMillage *= 0.98; // 2% annual decrease
        }
      }

      // Tax calculation
      const adValorem = assessedValue * (currentMillage / 1000);
      const nonAdValorem = non_ad_valorem_per_unit * units;
      const annualTax = adValorem + nonAdValorem;
      const taxPerUnit = annualTax / units;

      // Savings from cap (if market grew faster than 10%)
      const uncappedTax = year === 1 ? annualTax : (marketValue * (currentMillage / 1000) + nonAdValorem);
      const savings = uncappedTax - annualTax;
      cumulativeSavings += savings;

      projections.push({
        year,
        market_value: Math.round(marketValue),
        assessed_value: Math.round(assessedValue),
        assessment_gap: Math.round(assessmentGap),
        annual_tax: Math.round(annualTax),
        tax_per_unit: Math.round(taxPerUnit),
        cumulative_savings_from_cap: Math.round(cumulativeSavings)
      });
    }

    return projections;
  }

  /**
   * F43: Calculate non-ad-valorem total
   */
  private async getNonAdValoremPerUnit(parcel_id?: string, county_id?: string): Promise<number> {
    if (!parcel_id || !county_id) {
      // Default FL multifamily estimate
      return 885; // $885/unit typical (fire, waste, stormwater, lighting)
    }

    // Try to get actual non-ad-valorem from latest tax record
    const result = await pool.query(`
      SELECT non_ad_valorem_total, units
      FROM property_tax_records ptr
      JOIN properties p ON p.id = ptr.property_id
      WHERE ptr.parcel_id = $1 AND ptr.county_id = $2::uuid
      ORDER BY ptr.tax_year DESC
      LIMIT 1
    `, [parcel_id, county_id]);

    if (result.rows.length > 0 && result.rows[0].non_ad_valorem_total && result.rows[0].units) {
      return result.rows[0].non_ad_valorem_total / result.rows[0].units;
    }

    // Fallback to methodology-based estimate
    const methodologyResult = await pool.query(`
      SELECT non_ad_valorem_schedule
      FROM tax_methodology
      WHERE jurisdiction_id = $1::uuid
      ORDER BY effective_date DESC
      LIMIT 1
    `, [county_id]);

    if (methodologyResult.rows.length > 0) {
      const schedule = methodologyResult.rows[0].non_ad_valorem_schedule;
      if (schedule && Array.isArray(schedule)) {
        const total = schedule.reduce((sum: number, item: any) => sum + (item.current_rate || 0), 0);
        return total;
      }
    }

    return 885; // Default estimate
  }

  /**
   * Get total millage rate for a parcel location
   */
  private async getTotalMillage(parcel_id?: string, county_id?: string): Promise<number> {
    if (!county_id) {
      return 18.5; // Default FL estimate
    }

    const currentYear = new Date().getFullYear();
    
    const result = await pool.query(`
      SELECT SUM(millage_rate) as total_millage
      FROM millage_rates
      WHERE jurisdiction_id = $1::uuid
        AND tax_year = $2
    `, [county_id, currentYear]);

    if (result.rows.length > 0 && result.rows[0].total_millage) {
      return parseFloat(result.rows[0].total_millage);
    }

    // Fallback: try prior year
    const priorResult = await pool.query(`
      SELECT SUM(millage_rate) as total_millage
      FROM millage_rates
      WHERE jurisdiction_id = $1::uuid
        AND tax_year = $2
    `, [county_id, currentYear - 1]);

    if (priorResult.rows.length > 0 && priorResult.rows[0].total_millage) {
      return parseFloat(priorResult.rows[0].total_millage);
    }

    return 18.5; // Default FL estimate
  }

  /**
   * Get current annual tax from PA records
   */
  private async getCurrentTax(parcel_id?: string, county_id?: string): Promise<number | null> {
    if (!parcel_id || !county_id) {
      return null;
    }

    const result = await pool.query(`
      SELECT total_tax_amount
      FROM property_tax_records
      WHERE parcel_id = $1 AND county_id = $2::uuid
      ORDER BY tax_year DESC
      LIMIT 1
    `, [parcel_id, county_id]);

    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].total_tax_amount);
    }

    return null;
  }

  /**
   * Get existing projection for a deal
   */
  async getProjectionByDeal(deal_id: string): Promise<TaxProjectionOutput | null> {
    const result = await pool.query(`
      SELECT * FROM tax_projections
      WHERE deal_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `, [deal_id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      deal_id: row.deal_id,
      projected_just_value: parseFloat(row.projected_just_value),
      projected_assessed_value: parseFloat(row.projected_assessed_value),
      projected_taxable_value: parseFloat(row.projected_taxable_value),
      projected_ad_valorem: parseFloat(row.projected_ad_valorem),
      projected_non_ad_valorem: parseFloat(row.projected_non_ad_valorem),
      projected_total_tax: parseFloat(row.projected_total_tax),
      projected_tax_per_unit: parseFloat(row.projected_tax_per_unit),
      effective_tax_rate: parseFloat(row.effective_tax_rate),
      current_annual_tax: row.current_annual_tax ? parseFloat(row.current_annual_tax) : null,
      delta_amount: row.delta_amount ? parseFloat(row.delta_amount) : null,
      delta_pct: row.delta_pct ? parseFloat(row.delta_pct) : null,
      yearly_projections: row.yearly_projections || []
    };
  }
}

export const taxProjectionService = new TaxProjectionService();
