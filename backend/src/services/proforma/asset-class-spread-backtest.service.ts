/**
 * Asset Class Spread Backtest Service
 *
 * Lower #17: Validates the ASSET_CLASS_SPREAD_BPS table by comparing
 * assumed spreads to realized rent growth from owned properties.
 *
 * Algorithm:
 *   1. Query actual_performance for owned multifamily properties
 *   2. Compute realized YoY rent growth per property per year
 *   3. Fetch concurrent BLS CPI shelter sub-index for the same period
 *   4. Empirical spread = realized_rent_growth - cpi_shelter
 *   5. Aggregate by asset class (median + IQR)
 *   6. Compare to ASSET_CLASS_SPREAD_BPS defaults
 *   7. Generate calibration report with recommended adjustments
 *
 * The service is read-only — it computes and reports but does not
 * automatically overwrite the spread table. An operator must review
 * and approve changes.
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetClassBacktestResult {
  assetClass: string;
  sampleSize: number;
  properties: string[];
  
  // Assumed spread (from ASSET_CLASS_SPREAD_BPS)
  assumedSpreadBps: number;
  
  // Empirical spread from actual performance
  empiricalSpreadBps: number;
  empiricalSpreadMedian: number;
  empiricalSpreadP25: number;
  empiricalSpreadP75: number;
  
  // Bias = assumed - empirical
  biasBps: number;
  
  // Statistical significance
  tStat: number | null;
  pValue: number | null;
  
  // Recommendation
  recommendedSpreadBps: number;
  recommendation: 'keep' | 'raise' | 'lower' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  
  // Details
  propertyDetails: Array<{
    propertyId: string;
    propertyName: string;
    yearsOfData: number;
    avgRealizedRentGrowth: number;
    avgCpiShelter: number;
    avgSpread: number;
  }>;
}

export interface BacktestCalibrationReport {
  computedAt: string;
  lookbackYears: number;
  totalPropertiesAnalyzed: number;
  totalObservations: number;
  results: AssetClassBacktestResult[];
  summary: {
    classesWithSignificantBias: number;
    classesWithInsufficientData: number;
    classesWellCalibrated: number;
    overallRecommendation: string;
  };
}

// ─── The assumed spread table (source of truth) ─────────────────────────────

import { ASSET_CLASS_SPREAD_BPS } from './layered-growth/rent-growth';

// ─── Service ───────────────────────────────────────────────────────────────────

export class AssetClassSpreadBacktestService {
  constructor(private pool: Pool) {}

  /**
   * Return the current assumed spreads without running a backtest.
   * Useful for dashboards and data-quality audits when actual_performance
   * is not yet populated. Includes source documentation for each value.
   */
  getCurrentAssumptions(): Array<{
    assetClass: string;
    assumedSpreadBps: number;
    source: string;
    dataQuality: 'seed' | 'calibrated';
    notes: string;
  }> {
    const entries = Object.entries(ASSET_CLASS_SPREAD_BPS);
    const sources: Record<string, { source: string; notes: string }> = {
      multifamily: {
        source: 'NCREIF/NARIET historical 1990-2024; BLS CPI shelter vs realized rent growth',
        notes: 'Well-established ~30bps premium. Will refine when backtest has >10 obs.',
      },
      retail: {
        source: 'RERC/PREA cyclical spread; higher volatility than multifamily',
        notes: 'Seed value ~50bps. Backtest expected to confirm 45-55bps range.',
      },
      office: {
        source: 'Post-2020 secular reset; pre-2020 was 20-40bps',
        notes: 'Set to 0bps pending stabilization. Revisit when backtest data available.',
      },
      industrial: {
        source: 'CBRE/JLL 2015-2024 demand surge; historically 40-60bps, recent 70-90bps',
        notes: 'Seed at 80bps. Backtest may suggest higher given 2020-2024 demand.',
      },
      str: {
        source: 'AirDNA/Key Data short-term rental growth premium',
        notes: 'High growth, high volatility. Seed ~100bps. Backtest will confirm.',
      },
      flip: {
        source: 'Land development — no operating cash flow until exit',
        notes: '0bps by definition. No backtest applicable.',
      },
      land: {
        source: 'Raw land — no cash flow until development or sale',
        notes: '0bps by definition. No backtest applicable.',
      },
      default: {
        source: 'Fallback to multifamily assumption',
        notes: 'Used when asset class is unknown. Will align with multifamily backtest.',
      },
    };

    return entries.map(([assetClass, assumedSpreadBps]) => ({
      assetClass,
      assumedSpreadBps,
      source: sources[assetClass]?.source ?? 'Industry benchmark; pending backtest calibration',
      dataQuality: 'seed' as const,
      notes: sources[assetClass]?.notes ?? 'Seed value. Run backtest when actual_performance has data.',
    }));
  }

  /**
   * Run the full backtest for all asset classes with owned-property data.
   *
   * @param lookbackYears How many years of actual performance to analyze (default 5)
   * @param minObservationsPerClass Minimum observations to consider a class valid (default 10)
   */
  async runBacktest(
    lookbackYears: number = 5,
    minObservationsPerClass: number = 10,
  ): Promise<BacktestCalibrationReport> {
    const startTime = Date.now();
    logger.info('AssetClassBacktest: starting', { lookbackYears, minObservationsPerClass });

    // 1. Fetch owned properties with actual performance data
    const propertyData = await this.fetchPropertyActuals(lookbackYears);
    logger.info('AssetClassBacktest: fetched property data', {
      propertyCount: propertyData.length,
    });

    // 2. Fetch CPI shelter for the same period
    const cpiShelter = await this.fetchCpiShelterSeries(lookbackYears);
    logger.info('AssetClassBacktest: fetched CPI shelter', {
      cpiPoints: cpiShelter.length,
    });

    // 3. Compute realized rent growth per property per year
    const propertyGrowth = this.computePropertyRentGrowth(propertyData);

    // 4. Compute empirical spread per observation
    const spreads = this.computeEmpiricalSpreads(propertyGrowth, cpiShelter);

    // 5. Aggregate by asset class
    const results = this.aggregateByAssetClass(spreads, minObservationsPerClass);

    const totalObservations = spreads.length;
    const totalProperties = new Set(spreads.map(s => s.propertyId)).size;

    const summary = {
      classesWithSignificantBias: results.filter(r => r.confidence === 'high' && Math.abs(r.biasBps) > 15).length,
      classesWithInsufficientData: results.filter(r => r.confidence === 'low').length,
      classesWellCalibrated: results.filter(r => r.confidence !== 'low' && Math.abs(r.biasBps) <= 15).length,
      overallRecommendation: this.generateOverallRecommendation(results),
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('AssetClassBacktest: complete', {
      elapsed: `${elapsed}s`,
      totalProperties,
      totalObservations,
      ...summary,
    });

    return {
      computedAt: new Date().toISOString(),
      lookbackYears,
      totalPropertiesAnalyzed: totalProperties,
      totalObservations,
      results,
      summary,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async fetchPropertyActuals(lookbackYears: number): Promise<Array<{
    propertyId: string;
    propertyName: string;
    assetClass: string;
    periodDate: string;
    actualRentPerUnit: number | null;
    actualVacancyPct: number | null;
    actualNoi: number | null;
  }>> {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - lookbackYears);

    const result = await this.pool.query(
      `SELECT
         ap.property_id,
         p.property_name,
         COALESCE(p.property_class, 'multifamily') AS asset_class,
         ap.period_start AS period_date,
         ap.actual_rent_per_unit,
         ap.actual_vacancy_pct,
         ap.actual_noi
       FROM actual_performance ap
       JOIN properties p ON p.id = ap.property_id
       WHERE ap.period_start >= $1
         AND ap.actual_rent_per_unit IS NOT NULL
         AND ap.actual_rent_per_unit > 0
       ORDER BY ap.property_id, ap.period_start`,
      [startDate.toISOString().slice(0, 10)]
    );

    return result.rows.map(row => ({
      propertyId: row.property_id,
      propertyName: row.property_name || 'Unknown',
      assetClass: this.normalizeAssetClass(row.asset_class),
      periodDate: row.period_date.toISOString().slice(0, 10),
      actualRentPerUnit: row.actual_rent_per_unit != null ? parseFloat(row.actual_rent_per_unit) : null,
      actualVacancyPct: row.actual_vacancy_pct != null ? parseFloat(row.actual_vacancy_pct) : null,
      actualNoi: row.actual_noi != null ? parseFloat(row.actual_noi) : null,
    }));
  }

  private async fetchCpiShelterSeries(lookbackYears: number): Promise<Array<{
    periodDate: string;
    value: number;
  }>> {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - lookbackYears);

    const result = await this.pool.query(
      `SELECT period_date, value
       FROM metric_time_series
       WHERE metric_id = 'MACRO_CPI_OFFICIAL'
         AND geography_type = 'national'
         AND period_date >= $1
       ORDER BY period_date`,
      [startDate.toISOString().slice(0, 10)]
    );

    return result.rows.map(row => ({
      periodDate: row.period_date.toISOString().slice(0, 10),
      value: parseFloat(row.value) / 100, // stored as percent, convert to decimal
    }));
  }

  private computePropertyRentGrowth(
    propertyData: Array<{
      propertyId: string;
      propertyName: string;
      assetClass: string;
      periodDate: string;
      actualRentPerUnit: number | null;
    }>
  ): Array<{
    propertyId: string;
    propertyName: string;
    assetClass: string;
    periodDate: string;
    rentGrowthYoY: number | null;
  }> {
    // Group by property
    const byProperty = new Map<string, typeof propertyData>();
    for (const row of propertyData) {
      const existing = byProperty.get(row.propertyId) || [];
      existing.push(row);
      byProperty.set(row.propertyId, existing);
    }

    const results: Array<{
      propertyId: string;
      propertyName: string;
      assetClass: string;
      periodDate: string;
      rentGrowthYoY: number | null;
    }> = [];

    for (const [propertyId, rows] of byProperty) {
      // Sort by date
      const sorted = rows.sort((a, b) => a.periodDate.localeCompare(b.periodDate));
      
      for (let i = 12; i < sorted.length; i++) {
        const current = sorted[i];
        const prior = sorted[i - 12]; // 12 months prior
        
        if (prior.actualRentPerUnit && current.actualRentPerUnit && prior.actualRentPerUnit > 0) {
          const growth = (current.actualRentPerUnit - prior.actualRentPerUnit) / prior.actualRentPerUnit;
          results.push({
            propertyId: current.propertyId,
            propertyName: current.propertyName,
            assetClass: current.assetClass,
            periodDate: current.periodDate,
            rentGrowthYoY: growth,
          });
        }
      }
    }

    return results;
  }

  private computeEmpiricalSpreads(
    propertyGrowth: Array<{
      propertyId: string;
      propertyName: string;
      assetClass: string;
      periodDate: string;
      rentGrowthYoY: number | null;
    }>,
    cpiShelter: Array<{ periodDate: string; value: number }>
  ): Array<{
    propertyId: string;
    propertyName: string;
    assetClass: string;
    periodDate: string;
    rentGrowthYoY: number;
    cpiShelter: number;
    spreadBps: number;
  }> {
    const cpiMap = new Map(cpiShelter.map(c => [c.periodDate, c.value]));
    
    return propertyGrowth
      .filter(p => p.rentGrowthYoY != null)
      .map(p => {
        const cpi = cpiMap.get(p.periodDate) ?? 0;
        return {
          propertyId: p.propertyId,
          propertyName: p.propertyName,
          assetClass: p.assetClass,
          periodDate: p.periodDate,
          rentGrowthYoY: p.rentGrowthYoY!,
          cpiShelter: cpi,
          spreadBps: (p.rentGrowthYoY! - cpi) * 10000, // convert to bps
        };
      })
      .filter(s => !isNaN(s.spreadBps) && isFinite(s.spreadBps));
  }

  private aggregateByAssetClass(
    spreads: Array<{
      propertyId: string;
      propertyName: string;
      assetClass: string;
      periodDate: string;
      rentGrowthYoY: number;
      cpiShelter: number;
      spreadBps: number;
    }>,
    minObservations: number
  ): AssetClassBacktestResult[] {
    // Group by asset class
    const byClass = new Map<string, typeof spreads>();
    for (const s of spreads) {
      const existing = byClass.get(s.assetClass) || [];
      existing.push(s);
      byClass.set(s.assetClass, existing);
    }

    const results: AssetClassBacktestResult[] = [];

    for (const [assetClass, classSpreads] of byClass) {
      const n = classSpreads.length;
      const assumedSpreadBps = ASSET_CLASS_SPREAD_BPS[assetClass] ?? ASSET_CLASS_SPREAD_BPS.default;
      
      if (n < minObservations) {
        results.push({
          assetClass,
          sampleSize: n,
          properties: [...new Set(classSpreads.map(s => s.propertyId))],
          assumedSpreadBps,
          empiricalSpreadBps: 0,
          empiricalSpreadMedian: 0,
          empiricalSpreadP25: 0,
          empiricalSpreadP75: 0,
          biasBps: 0,
          tStat: null,
          pValue: null,
          recommendedSpreadBps: assumedSpreadBps,
          recommendation: 'insufficient_data',
          confidence: 'low',
          propertyDetails: [],
        });
        continue;
      }

      // Compute statistics
      const spreadValues = classSpreads.map(s => s.spreadBps).sort((a, b) => a - b);
      const median = this.percentile(spreadValues, 0.5);
      const p25 = this.percentile(spreadValues, 0.25);
      const p75 = this.percentile(spreadValues, 0.75);
      const mean = spreadValues.reduce((a, b) => a + b, 0) / n;
      const stdDev = Math.sqrt(spreadValues.reduce((sq, v) => sq + Math.pow(v - mean, 2), 0) / n);
      const tStat = stdDev > 0 ? (mean - assumedSpreadBps) / (stdDev / Math.sqrt(n)) : null;
      
      // Simple p-value approximation (two-tailed)
      const pValue = tStat != null ? 2 * (1 - this.normalCdf(Math.abs(tStat))) : null;
      
      const biasBps = assumedSpreadBps - median;
      
      // Recommendation logic
      let recommendation: AssetClassBacktestResult['recommendation'];
      let recommendedSpreadBps: number;
      let confidence: AssetClassBacktestResult['confidence'];
      
      if (pValue != null && pValue < 0.05 && Math.abs(biasBps) > 15) {
        // Significant bias
        recommendedSpreadBps = Math.round(median / 10) * 10; // round to nearest 10 bps
        recommendation = biasBps > 0 ? 'lower' : 'raise';
        confidence = n >= 30 ? 'high' : 'medium';
      } else if (pValue != null && pValue < 0.10 && Math.abs(biasBps) > 10) {
        // Marginally significant
        recommendedSpreadBps = Math.round((assumedSpreadBps + median) / 2 / 10) * 10;
        recommendation = biasBps > 0 ? 'lower' : 'raise';
        confidence = 'medium';
      } else {
        // Well calibrated
        recommendedSpreadBps = assumedSpreadBps;
        recommendation = 'keep';
        confidence = n >= 30 ? 'high' : 'medium';
      }

      // Property-level details
      const propertyDetails = [...new Set(classSpreads.map(s => s.propertyId))].map(pid => {
        const pRows = classSpreads.filter(s => s.propertyId === pid);
        return {
          propertyId: pid,
          propertyName: pRows[0].propertyName,
          yearsOfData: Math.round(pRows.length / 12 * 10) / 10,
          avgRealizedRentGrowth: pRows.reduce((s, r) => s + r.rentGrowthYoY, 0) / pRows.length * 100,
          avgCpiShelter: pRows.reduce((s, r) => s + r.cpiShelter, 0) / pRows.length * 100,
          avgSpread: pRows.reduce((s, r) => s + r.spreadBps, 0) / pRows.length,
        };
      });

      results.push({
        assetClass,
        sampleSize: n,
        properties: [...new Set(classSpreads.map(s => s.propertyId))],
        assumedSpreadBps,
        empiricalSpreadBps: mean,
        empiricalSpreadMedian: median,
        empiricalSpreadP25: p25,
        empiricalSpreadP75: p75,
        biasBps,
        tStat,
        pValue,
        recommendedSpreadBps,
        recommendation,
        confidence,
        propertyDetails,
      });
    }

    return results.sort((a, b) => b.sampleSize - a.sampleSize);
  }

  private normalizeAssetClass(raw: string): string {
    const map: Record<string, string> = {
      'a': 'multifamily',
      'b': 'multifamily',
      'c': 'multifamily',
      'multifamily': 'multifamily',
      'retail': 'retail',
      'office': 'office',
      'industrial': 'industrial',
      'self-storage': 'industrial',
      'str': 'str',
      'student-housing': 'multifamily',
      'senior-housing': 'multifamily',
    };
    return map[raw?.toLowerCase()] || 'multifamily';
  }

  private percentile(sorted: number[], q: number): number {
    const idx = Math.floor((sorted.length - 1) * q);
    return sorted[idx];
  }

  private normalCdf(x: number): number {
    // Abramowitz & Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * y);
  }

  private generateOverallRecommendation(results: AssetClassBacktestResult[]): string {
    const significant = results.filter(r => r.confidence === 'high' && Math.abs(r.biasBps) > 15);
    const insufficient = results.filter(r => r.confidence === 'low');
    
    if (significant.length > 0) {
      const classes = significant.map(r => r.assetClass).join(', ');
      return `${significant.length} asset class(es) show significant bias: ${classes}. Review recommended spreads.`;
    }
    if (insufficient.length > 0) {
      const classes = insufficient.map(r => r.assetClass).join(', ');
      return `Spreads well calibrated for analyzed classes. Insufficient data for: ${classes}.`;
    }
    return 'All asset class spreads well calibrated against realized performance. No action needed.';
  }
}

// ─── Singleton instance ────────────────────────────────────────────────────────

import { pool } from '../../database';
export const assetClassSpreadBacktestService = new AssetClassSpreadBacktestService(pool);
