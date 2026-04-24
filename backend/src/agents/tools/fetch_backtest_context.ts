/**
 * Agent Tool: Fetch Backtest Context
 * 
 * Gets historical performance of similar deals for validation:
 * - Projected vs actual IRR
 * - Cap rate movements
 * - Rent growth accuracy
 * - Key performance drivers
 */

import { z } from 'zod';
import type { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { getBacktestService } from '../../services/proximity';

export const fetchBacktestContextSchema = z.object({
  submarket: z.string().optional().describe('Submarket to filter by'),
  dealType: z.string().optional().describe('Deal type (acquisition, development, value-add)'),
  vintage: z.number().optional().describe('Acquisition year to match'),
  units: z.number().optional().describe('Unit count to match (will find similar size)'),
  assetClass: z.string().optional().describe('Asset class (A, B, C)'),
  projectedIrr: z.number().optional().describe('Projected IRR to compare against'),
  holdPeriod: z.number().optional().describe('Expected hold period in years')
});

export type FetchBacktestContextParams = z.infer<typeof fetchBacktestContextSchema>;

export interface BacktestContextResult {
  summary: {
    sampleSize: number;
    avgProjectedIrr: number;
    avgActualIrr: number;
    irrAccuracyPct: number;
    outperformanceRate: number;
    avgHoldPeriod: number;
  };
  performanceDistribution: {
    significantOutperform: number; // >15% better than projected
    moderateOutperform: number;   // 5-15% better
    onTarget: number;              // Within 5%
    moderateUnderperform: number; // 5-15% worse
    significantUnderperform: number; // >15% worse
  };
  keyDrivers: Array<{
    factor: string;
    impact: 'positive' | 'negative';
    frequency: number;
    description: string;
  }>;
  comparableDeals: Array<{
    name: string;
    acquisitionYear: number;
    units: number;
    projectedIrr: number;
    actualIrr: number;
    delta: number;
    keyFactors: string[];
  }>;
  insights: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
}

export async function fetchBacktestContext(
  params: FetchBacktestContextParams,
  pool: Pool
): Promise<BacktestContextResult> {
  const service = getBacktestService(pool);
  
  // Get similar deals
  const deals = await service.getSimilarDealsPerformance({
    dealType: params.dealType,
    submarket: params.submarket,
    vintage: params.vintage,
    units: params.units,
    assetClass: params.assetClass
  });
  
  if (deals.length === 0) {
    return {
      summary: {
        sampleSize: 0,
        avgProjectedIrr: 0,
        avgActualIrr: 0,
        irrAccuracyPct: 0,
        outperformanceRate: 0,
        avgHoldPeriod: 0
      },
      performanceDistribution: {
        significantOutperform: 0,
        moderateOutperform: 0,
        onTarget: 0,
        moderateUnderperform: 0,
        significantUnderperform: 0
      },
      keyDrivers: [],
      comparableDeals: [],
      insights: ['Insufficient historical data for this criteria. Consider broadening search parameters.'],
      confidenceLevel: 'low'
    };
  }
  
  // Calculate summary statistics
  const avgProjectedIrr = deals.reduce((sum, d) => sum + d.projectedIrr, 0) / deals.length;
  const avgActualIrr = deals.reduce((sum, d) => sum + d.actualIrr, 0) / deals.length;
  const avgHoldPeriod = deals.reduce((sum, d) => sum + d.holdPeriodYears, 0) / deals.length;
  
  // IRR accuracy (how close were projections to actuals)
  const irrErrors = deals.map(d => Math.abs(d.actualIrr - d.projectedIrr) / d.projectedIrr);
  const avgError = irrErrors.reduce((sum, e) => sum + e, 0) / irrErrors.length;
  const irrAccuracyPct = (1 - avgError) * 100;
  
  // Outperformance rate
  const outperformers = deals.filter(d => d.actualIrr > d.projectedIrr);
  const outperformanceRate = (outperformers.length / deals.length) * 100;
  
  // Performance distribution
  const distribution = {
    significantOutperform: 0,
    moderateOutperform: 0,
    onTarget: 0,
    moderateUnderperform: 0,
    significantUnderperform: 0
  };
  
  for (const deal of deals) {
    const delta = (deal.actualIrr - deal.projectedIrr) / deal.projectedIrr;
    
    if (delta > 0.15) {
      distribution.significantOutperform++;
    } else if (delta > 0.05) {
      distribution.moderateOutperform++;
    } else if (delta >= -0.05) {
      distribution.onTarget++;
    } else if (delta >= -0.15) {
      distribution.moderateUnderperform++;
    } else {
      distribution.significantUnderperform++;
    }
  }
  
  // Analyze key drivers
  const driverCounts: Record<string, { positive: number; negative: number }> = {};
  
  for (const deal of deals) {
    for (const factor of deal.keyFactors) {
      if (!driverCounts[factor]) {
        driverCounts[factor] = { positive: 0, negative: 0 };
      }
      
      const isOutperformer = deal.actualIrr > deal.projectedIrr;
      if (factor.toLowerCase().includes('outperform') || 
          factor.toLowerCase().includes('compression') ||
          factor.toLowerCase().includes('growth')) {
        driverCounts[factor][isOutperformer ? 'positive' : 'negative']++;
      } else {
        driverCounts[factor][!isOutperformer ? 'positive' : 'negative']++;
      }
    }
  }
  
  const keyDrivers = Object.entries(driverCounts)
    .map(([factor, counts]) => ({
      factor,
      impact: counts.positive >= counts.negative ? 'positive' as const : 'negative' as const,
      frequency: Math.round(((counts.positive + counts.negative) / deals.length) * 100),
      description: getDriverDescription(factor)
    }))
    .filter(d => d.frequency >= 20)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
  
  // Generate insights
  const insights: string[] = [];
  
  if (avgActualIrr > avgProjectedIrr) {
    insights.push(`Historical deals in this segment outperformed projections by ${((avgActualIrr - avgProjectedIrr) / avgProjectedIrr * 100).toFixed(0)}% on average`);
  } else {
    insights.push(`Historical deals in this segment underperformed projections by ${((avgProjectedIrr - avgActualIrr) / avgProjectedIrr * 100).toFixed(0)}% on average`);
  }
  
  if (distribution.onTarget > deals.length * 0.5) {
    insights.push('Projections in this segment are generally reliable (>50% within 5% of target)');
  } else {
    insights.push('Projections in this segment show significant variance from actuals');
  }
  
  // Add specific insights based on projected IRR if provided
  if (params.projectedIrr) {
    const similarDeals = deals.filter(d => 
      Math.abs(d.projectedIrr - params.projectedIrr!) / params.projectedIrr! < 0.2
    );
    
    if (similarDeals.length >= 3) {
      const similarAvgActual = similarDeals.reduce((sum, d) => sum + d.actualIrr, 0) / similarDeals.length;
      insights.push(`Deals with ~${params.projectedIrr.toFixed(0)}% projected IRR historically achieved ${similarAvgActual.toFixed(1)}% actual`);
    }
  }
  
  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  if (deals.length >= 10) {
    confidenceLevel = 'high';
  } else if (deals.length >= 5) {
    confidenceLevel = 'medium';
  }
  
  return {
    summary: {
      sampleSize: deals.length,
      avgProjectedIrr: Math.round(avgProjectedIrr * 10) / 10,
      avgActualIrr: Math.round(avgActualIrr * 10) / 10,
      irrAccuracyPct: Math.round(irrAccuracyPct * 10) / 10,
      outperformanceRate: Math.round(outperformanceRate),
      avgHoldPeriod: Math.round(avgHoldPeriod * 10) / 10
    },
    performanceDistribution: distribution,
    keyDrivers,
    comparableDeals: deals.slice(0, 5).map(d => ({
      name: d.dealName,
      acquisitionYear: d.acquisitionDate.getFullYear(),
      units: 0, // Would need to add to query
      projectedIrr: Math.round(d.projectedIrr * 10) / 10,
      actualIrr: Math.round(d.actualIrr * 10) / 10,
      delta: Math.round((d.actualIrr - d.projectedIrr) * 10) / 10,
      keyFactors: d.keyFactors
    })),
    insights,
    confidenceLevel
  };
}

function getDriverDescription(factor: string): string {
  const descriptions: Record<string, string> = {
    'Outperformed projections': 'Actual returns exceeded underwriting assumptions',
    'Underperformed projections': 'Actual returns fell short of underwriting',
    'Cap rate compression': 'Exit cap rate lower than projected, boosting returns',
    'Cap rate expansion': 'Exit cap rate higher than projected, reducing returns',
    'Rent growth exceeded': 'Actual rent growth outpaced projections',
    'Rent growth shortfall': 'Rent growth fell short of projections',
    'Extended hold period': 'Held longer than planned, affecting IRR',
    'Early exit': 'Exited earlier than planned',
    'Higher vacancy': 'Occupancy lower than projected',
    'Better occupancy': 'Achieved higher occupancy than projected'
  };
  
  return descriptions[factor] || factor;
}

// Tool definition for agent registry
export const fetchBacktestContextTool = {
  name: 'fetch_backtest_context',
  description: `Get historical performance of similar deals for validation and benchmarking:
- Compare projected vs actual IRR
- See performance distribution (outperform/underperform rates)
- Identify key drivers of over/under-performance
- Get comparable deal case studies
Use when validating projections or setting realistic expectations for a deal.`,
  inputSchema: fetchBacktestContextSchema,
  outputSchema: z.unknown(),
  execute: async (input, _ctx) => fetchBacktestContext(input, getPool())
};
