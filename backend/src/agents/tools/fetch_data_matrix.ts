/**
 * Agent Tool: Fetch Data Matrix
 * 
 * The main entry point for agents to get comprehensive deal context.
 * Pulls from the Data Library and enriches with all external data sources.
 * 
 * This is the "brain" that connects all neural pathways:
 * - Property Info (Municipal APIs)
 * - Rent Data (Apartment Locator)
 * - Sales Comps (County Records)
 * - Proximity (Transit, Grocery, Schools)
 * - Market Events (Supply Pipeline, Employers)
 * - Backtest (Historical Validation)
 * - Benchmarks (Archive Deals)
 * - Macro Economics (BLS, Fed)
 * - Market Trends (Correlation Engine)
 */

import { z } from 'zod';
import type { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { getDataMatrixService, DataLibraryDeal, DataMatrixContext } from '../../services/neural-network';
import { logger } from '../../utils/logger';

export const fetchDataMatrixSchema = z.object({
  // Deal identification - one of these is required
  dealId: z.string().optional().describe('Deal ID from deals table'),
  assetId: z.string().optional().describe('Asset ID from data_library_assets'),
  deal: z.object({
    propertyName: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    county: z.string().optional(),
    units: z.number().optional(),
    yearBuilt: z.number().optional(),
    askingPrice: z.number().optional(),
    dealType: z.string().optional(),
    assetClass: z.string().optional()
  }).optional().describe('Deal details directly'),
  
  // Options
  layers: z.array(z.enum([
    'propertyInfo', 'rentData', 'salesComps', 'proximity', 
    'events', 'backtest', 'benchmarks', 'macro', 'marketTrends'
  ])).optional().describe('Which layers to include (default: all)'),
  searchRadiusMiles: z.number().optional().default(5).describe('Radius for proximity/events search')
});

export type FetchDataMatrixParams = z.infer<typeof fetchDataMatrixSchema>;

export interface DataMatrixResult {
  // Context from all layers
  context: DataMatrixContext;
  
  // Summary for agents
  summary: {
    dealName: string;
    location: string;
    dataQuality: string;
    completenessScore: number;
    missingLayers: string[];
    
    // Key metrics pulled from all sources
    keyMetrics: {
      units?: number;
      yearBuilt?: number;
      askingPrice?: number;
      capRate?: number;
      avgRent?: number;
      occupancy?: number;
      pricePerUnit?: number;
    };
    
    // Investment signals
    signals: {
      proximity: string; // 'Strong location premium' | 'Average location' | 'Location concerns'
      market: string;    // 'Bullish' | 'Neutral' | 'Bearish'
      validation: string; // 'High confidence' | 'Medium confidence' | 'Limited data'
    };
    
    // Key insights for agents
    insights: string[];
    riskFactors: string[];
    opportunities: string[];
  };
}

export async function fetchDataMatrix(
  params: FetchDataMatrixParams,
  pool: Pool
): Promise<DataMatrixResult> {
  const service = getDataMatrixService(pool);
  
  logger.info(`[fetch_data_matrix] Called with dealId=${params.dealId}, assetId=${params.assetId}, layers=${params.layers?.length ?? 'all'}`);
  
  let deal: DataLibraryDeal;
  
  // Resolve deal from ID or use provided deal
  if (params.dealId) {
    const result = await pool.query(`
      SELECT id, name AS property_name, address, city, state, state_code,
             unit_count AS units, deal_category AS deal_type,
             latitude, longitude, deal_data
      FROM deals WHERE id = $1
    `, [params.dealId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Deal not found: ${params.dealId}`);
    }
    
    const row = result.rows[0];
    const dd = row.deal_data || {};
    const broker = dd.broker_claims || {};
    const property = broker.property || {};
    const metadata = broker.metadata || {};
    deal = {
      id: row.id,
      propertyName: row.property_name || property.name,
      address: row.address || property.address,
      city: row.city || property.city,
      state: row.state_code || property.state || row.state,
      county: property.county || dd.geographic_context?.county_name,
      units: row.units || property.units,
      yearBuilt: property.yearBuilt || property.year_built,
      askingPrice: metadata.askingPrice != null ? Number(metadata.askingPrice) : undefined,
      dealType: row.deal_type,
      assetClass: property.asset_class || property.assetClass,
      latitude: row.latitude != null ? Number(row.latitude) : undefined,
      longitude: row.longitude != null ? Number(row.longitude) : undefined,
    };

    // ── Extract deal_data for preamble enrichment ──
    const extractionT12 = dd.extraction_t12;
    const extractionRentRoll = dd.extraction_rent_roll;
    const brokerClaims = dd.broker_claims;

    // Override deal-level fields from extracted data when they exist
    if (extractionRentRoll) {
      if (extractionRentRoll.total_units && !deal.units) {
        deal.units = extractionRentRoll.total_units;
      }
      if (extractionRentRoll.avg_market_rent) {
        deal.avgRent = extractionRentRoll.avg_market_rent;
      }
      if (extractionRentRoll.occupancy_by_unit_pct) {
        deal.occupancyPct = Math.round(extractionRentRoll.occupancy_by_unit_pct * 10000) / 100;
      }
    }
  } else if (params.assetId) {
    const result = await pool.query(`
      SELECT * FROM data_library_assets WHERE id = $1
    `, [params.assetId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Asset not found: ${params.assetId}`);
    }
    
    const row = result.rows[0];
    deal = {
      id: row.id,
      propertyName: row.property_name,
      address: row.address,
      city: row.city,
      state: row.state,
      county: row.county,
      units: row.units,
      yearBuilt: row.year_built,
      askingPrice: row.asking_price ? parseFloat(row.asking_price) : undefined,
      avgRent: row.avg_rent ? parseFloat(row.avg_rent) : undefined,
      occupancyPct: row.occupancy_pct ? parseFloat(row.occupancy_pct) : undefined,
      dealType: row.deal_type,
      assetClass: row.asset_class
    };
  } else if (params.deal) {
    deal = {
      id: 'inline',
      ...params.deal
    };
  } else {
    throw new Error('One of dealId, assetId, or deal is required');
  }
  
  // Build layer options
  const layerOptions: Record<string, boolean> = {};
  if (params.layers) {
    layerOptions.includePropertyInfo = params.layers.includes('propertyInfo');
    layerOptions.includeRentData = params.layers.includes('rentData');
    layerOptions.includeSalesComps = params.layers.includes('salesComps');
    layerOptions.includeProximity = params.layers.includes('proximity');
    layerOptions.includeEvents = params.layers.includes('events');
    layerOptions.includeBacktest = params.layers.includes('backtest');
    layerOptions.includeBenchmarks = params.layers.includes('benchmarks');
    layerOptions.includeMacro = params.layers.includes('macro');
    layerOptions.includeMarketTrends = params.layers.includes('marketTrends');
  }
  
  // Build context
  const context = await service.buildContext(deal, {
    ...layerOptions,
    searchRadiusMiles: params.searchRadiusMiles
  });
  
  // Log layer statuses for debugging
  const layerStatuses: Record<string, string> = {
    propertyInfo: context.propertyInfo ? 'ok' : 'empty',
    rentData: context.rentData ? 'ok' : 'empty',
    salesComps: context.salesComps ? 'ok' : 'empty',
    proximity: context.proximity ? 'ok' : 'empty',
    events: context.events ? 'ok' : 'empty',
    backtest: context.backtest ? 'ok' : 'empty',
    benchmarks: context.benchmarks ? 'ok' : 'empty',
    macro: context.macro ? 'ok' : 'empty',
    marketTrends: context.marketTrends ? 'ok' : 'empty',
    extractedData_t12: context.extractedData?.t12 ? 'ok' : 'empty',
    extractedData_rentRoll: context.extractedData?.rentRoll ? 'ok' : 'empty',
    extractedData_brokerClaims: context.extractedData?.brokerClaims ? 'ok' : 'empty',
  };
  logger.info(`[fetch_data_matrix] Layer statuses: ${JSON.stringify(layerStatuses)}`);
  logger.info(`[fetch_data_matrix] Completeness: score=${context.completeness.score}, quality=${context.completeness.dataQuality}, missing=[${context.completeness.missingLayers.join(',')}]`);
  
  // Generate summary for agents
  const summary = generateSummary(deal, context);
  
  return { context, summary };
}

function generateSummary(deal: DataLibraryDeal, context: DataMatrixContext): DataMatrixResult['summary'] {
  const insights: string[] = [];
  const riskFactors: string[] = [];
  const opportunities: string[] = [];
  
  // Key metrics (prefer enriched data, fall back to deal data, fall back to extracted data)
  const ext = context.extractedData;
  const keyMetrics = {
    units: context.propertyInfo?.units || deal.units || ext?.rentRoll?.totalUnits,
    yearBuilt: context.propertyInfo?.yearBuilt || deal.yearBuilt,
    askingPrice: deal.askingPrice,
    capRate: deal.capRate,
    avgRent: context.rentData?.avgAskingRent || deal.avgRent || ext?.rentRoll?.avgMarketRent,
    occupancy: context.rentData?.occupancyPct || deal.occupancyPct ||
      (ext?.rentRoll?.occupancyPct != null ? Math.round(ext.rentRoll.occupancyPct * 10000) / 100 : undefined),
    pricePerUnit: deal.askingPrice && deal.units ? deal.askingPrice / deal.units : undefined
  };
  
  // Proximity signal
  let proximitySignal = 'Unknown location quality';
  if (context.proximity) {
    const grades = [context.proximity.transitGrade, context.proximity.groceryGrade, context.proximity.schoolGrade];
    const excellentCount = grades.filter(g => g === 'excellent').length;
    const poorCount = grades.filter(g => g === 'poor').length;
    
    if (excellentCount >= 2) {
      proximitySignal = 'Strong location premium potential';
      opportunities.push(`Location premium: estimated +${context.proximity.estimatedPremiumPct.toFixed(0)}% rent`);
    } else if (poorCount >= 2) {
      proximitySignal = 'Location concerns';
      riskFactors.push(...context.proximity.concerns);
    } else {
      proximitySignal = 'Average location';
    }
    
    insights.push(...context.proximity.highlights);
  }
  
  // Market signal
  let marketSignal = 'Neutral market outlook';
  if (context.events) {
    marketSignal = context.events.netSentiment === 'bullish' ? 'Bullish market outlook' :
                   context.events.netSentiment === 'bearish' ? 'Bearish market outlook' : 'Neutral market outlook';
    
    if (context.events.supplyPipelineUnits > 500) {
      riskFactors.push(`${context.events.supplyPipelineUnits.toLocaleString()} units in delivery pipeline`);
    }
    
    opportunities.push(...context.events.opportunities);
    riskFactors.push(...context.events.riskFactors.filter(r => !riskFactors.includes(r)));
  }
  
  // Validation signal
  let validationSignal = 'Limited historical data';
  if (context.backtest) {
    validationSignal = context.backtest.confidenceLevel === 'high' ? 'High confidence from historical data' :
                       context.backtest.confidenceLevel === 'medium' ? 'Medium confidence from historical data' :
                       'Limited historical data';
    
    insights.push(...context.backtest.insights);
  }
  
  // Extracted Deal Data insights (T12, rent roll, broker claims)
  if (ext?.t12) {
    insights.push(`T12: ${ext.t12.monthsCaptured ?? '?'}mo captured, GPR $${(ext.t12.gpr ?? 0).toLocaleString()}`);
    if (ext.t12.noi != null) {
      insights.push(`T12 NOI: $${ext.t12.noi.toLocaleString()}`);
      if (ext.t12.noiMargin != null) {
        insights.push(`T12 NOI margin: ${(ext.t12.noiMargin * 100).toFixed(1)}%`);
      }
    }
    if (ext.t12.opexTotal != null) {
      insights.push(`T12 OpEx: $${ext.t12.opexTotal.toLocaleString()}`);
    }
  }
  if (ext?.rentRoll) {
    insights.push(`Rent Roll: ${ext.rentRoll.totalUnits ?? '?'} units, ${ext.rentRoll.occupiedUnits ?? '?'} occupied`);
    if (ext.rentRoll.occupancyPct != null) {
      insights.push(`Occupancy: ${(ext.rentRoll.occupancyPct * 100).toFixed(1)}%`);
    }
    if (ext.rentRoll.gprMonthly) {
      insights.push(`Monthly GPR: $${ext.rentRoll.gprMonthly.toLocaleString()}`);
    }
  }

  // Sales comps insights
  if (context.salesComps) {
    if (context.salesComps.avgPricePerUnit && keyMetrics.pricePerUnit) {
      const vsMarket = (keyMetrics.pricePerUnit / context.salesComps.avgPricePerUnit - 1) * 100;
      if (vsMarket < -10) {
        opportunities.push(`Priced ${Math.abs(vsMarket).toFixed(0)}% below market comps`);
      } else if (vsMarket > 10) {
        riskFactors.push(`Priced ${vsMarket.toFixed(0)}% above market comps`);
      }
    }
    
    if (context.salesComps.trend === 'increasing') {
      insights.push('Price/unit trending upward');
    } else if (context.salesComps.trend === 'decreasing') {
      riskFactors.push('Price/unit trending downward');
    }
  }
  
  return {
    dealName: deal.propertyName || deal.address || 'Unknown Property',
    location: [deal.city, deal.state].filter(Boolean).join(', '),
    dataQuality: context.completeness.dataQuality,
    completenessScore: context.completeness.score,
    missingLayers: context.completeness.missingLayers,
    keyMetrics,
    signals: {
      proximity: proximitySignal,
      market: marketSignal,
      validation: validationSignal
    },
    insights,
    riskFactors,
    opportunities
  };
}

// Tool definition for agent registry
export const fetchDataMatrixTool = {
  name: 'fetch_data_matrix',
  description: `Get comprehensive deal context from the Data Library + all external data sources.
This is the main tool for getting complete deal information including:
- Property Info (year built, units, zoning, owner from county records)
- Rent Data (unit mix, rents, occupancy from Apartment Locator)
- Sales Comps (recent transactions, price/unit trends)
- Proximity Context (transit, grocery, schools, crime grades)
- Market Events (supply pipeline, employer moves, sentiment)
- Historical Backtest (similar deals performance, IRR accuracy)
- Benchmarks (cap rates, expense ratios from archive deals)
- Macro Economics (jobs, population, inflation)
- Market Trends (rent growth, occupancy trends)

Returns both raw context and a summary with key metrics, signals, insights, risks, and opportunities.
Use this as the primary data gathering tool before any deal analysis.`,
  inputSchema: fetchDataMatrixSchema,
  outputSchema: z.unknown(),
  execute: async (input: FetchDataMatrixParams, _ctx: unknown) => fetchDataMatrix(input, getPool()),
};
