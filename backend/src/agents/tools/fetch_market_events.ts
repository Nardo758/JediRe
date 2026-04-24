/**
 * Agent Tool: Fetch Market Events
 * 
 * Gets upcoming and historical market events that may impact a property:
 * - Employer moves/expansions
 * - Transit openings
 * - New supply deliveries
 * - Infrastructure changes
 */

import { z } from 'zod';
import { Pool } from 'pg';
import { getMarketEventsService, MarketEvent } from '../../services/proximity';

export const fetchMarketEventsSchema = z.object({
  latitude: z.number().describe('Property latitude'),
  longitude: z.number().describe('Property longitude'),
  radiusMiles: z.number().optional().default(5).describe('Search radius in miles'),
  eventTypes: z.array(z.string()).optional().describe('Filter by event types'),
  includeHistorical: z.boolean().optional().default(true).describe('Include completed events'),
  lookAheadMonths: z.number().optional().default(24).describe('How far ahead to look for upcoming events')
});

export type FetchMarketEventsParams = z.infer<typeof fetchMarketEventsSchema>;

export interface MarketEventsResult {
  summary: {
    upcomingPositive: number;
    upcomingNegative: number;
    supplyPipeline: number;
    netSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  upcomingEvents: Array<{
    name: string;
    type: string;
    date: string;
    distance: number;
    impact: string;
    description: string;
  }>;
  historicalEvents: Array<{
    name: string;
    type: string;
    date: string;
    observedImpact?: string;
  }>;
  supplyPipeline: {
    totalUnits: number;
    byQuarter: Array<{ quarter: string; units: number }>;
  };
  riskFactors: string[];
  opportunities: string[];
}

export async function fetchMarketEvents(
  params: FetchMarketEventsParams,
  pool: Pool
): Promise<MarketEventsResult> {
  const service = getMarketEventsService(pool);
  
  // Get events near location
  const allEvents = await service.getEventsNearLocation(
    params.latitude,
    params.longitude,
    params.radiusMiles,
    {
      eventTypes: params.eventTypes as any[],
      status: params.includeHistorical 
        ? ['announced', 'confirmed', 'active', 'completed']
        : ['announced', 'confirmed', 'active'],
      limit: 50
    }
  );
  
  const now = new Date();
  const upcoming = allEvents.filter(e => e.effectiveDate > now);
  const historical = allEvents.filter(e => e.effectiveDate <= now);
  
  // Categorize upcoming events
  const upcomingPositive = upcoming.filter(e => e.expectedImpactDirection === 'positive').length;
  const upcomingNegative = upcoming.filter(e => e.expectedImpactDirection === 'negative').length;
  
  // Calculate supply pipeline
  const supplyEvents = upcoming.filter(e => 
    ['supply_delivery', 'supply_announced', 'supply_groundbreaking'].includes(e.eventType)
  );
  const supplyUnits = supplyEvents.reduce((sum, e) => sum + (e.unitsAffected || 0), 0);
  
  // Group supply by quarter
  const supplyByQuarter = new Map<string, number>();
  for (const event of supplyEvents) {
    const q = getQuarter(event.effectiveDate);
    supplyByQuarter.set(q, (supplyByQuarter.get(q) || 0) + (event.unitsAffected || 0));
  }
  
  // Determine net sentiment
  let netSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  const positiveWeight = upcoming
    .filter(e => e.expectedImpactDirection === 'positive')
    .reduce((sum, e) => sum + getMagnitudeWeight(e.expectedImpactMagnitude), 0);
  const negativeWeight = upcoming
    .filter(e => e.expectedImpactDirection === 'negative')
    .reduce((sum, e) => sum + getMagnitudeWeight(e.expectedImpactMagnitude), 0);
  
  if (positiveWeight > negativeWeight * 1.5) {
    netSentiment = 'bullish';
  } else if (negativeWeight > positiveWeight * 1.5) {
    netSentiment = 'bearish';
  }
  
  // Identify risks and opportunities
  const riskFactors: string[] = [];
  const opportunities: string[] = [];
  
  // Supply risk
  if (supplyUnits > 500) {
    riskFactors.push(`${supplyUnits.toLocaleString()} units in delivery pipeline within ${params.radiusMiles} miles`);
  }
  
  // Employer risks/opportunities
  const employerMoves = upcoming.filter(e => e.eventType.startsWith('employer_'));
  for (const event of employerMoves) {
    if (event.expectedImpactDirection === 'positive' && event.jobsAffected && event.jobsAffected > 500) {
      opportunities.push(`${event.entityName}: +${event.jobsAffected.toLocaleString()} jobs (${formatDate(event.effectiveDate)})`);
    } else if (event.expectedImpactDirection === 'negative' && event.jobsAffected && Math.abs(event.jobsAffected) > 500) {
      riskFactors.push(`${event.entityName}: ${event.jobsAffected.toLocaleString()} jobs (${event.eventType.replace('employer_', '')})`);
    }
  }
  
  // Transit opportunities
  const transitEvents = upcoming.filter(e => e.eventType.startsWith('transit_'));
  for (const event of transitEvents) {
    if (event.expectedImpactDirection === 'positive') {
      opportunities.push(`${event.eventName} (${formatDate(event.effectiveDate)})`);
    }
  }
  
  return {
    summary: {
      upcomingPositive,
      upcomingNegative,
      supplyPipeline: supplyUnits,
      netSentiment
    },
    upcomingEvents: upcoming.slice(0, 10).map(e => ({
      name: e.eventName,
      type: e.eventType,
      date: formatDate(e.effectiveDate),
      distance: (e as any).distanceMiles || 0,
      impact: `${e.expectedImpactDirection} (${e.expectedImpactMagnitude})`,
      description: formatEventDescription(e)
    })),
    historicalEvents: historical.slice(0, 5).map(e => ({
      name: e.eventName,
      type: e.eventType,
      date: formatDate(e.effectiveDate),
      observedImpact: undefined // Would need to join with outcomes
    })),
    supplyPipeline: {
      totalUnits: supplyUnits,
      byQuarter: Array.from(supplyByQuarter.entries())
        .map(([quarter, units]) => ({ quarter, units }))
        .sort((a, b) => a.quarter.localeCompare(b.quarter))
    },
    riskFactors,
    opportunities
  };
}

function getQuarter(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `${date.getFullYear()}Q${q}`;
}

function getMagnitudeWeight(magnitude: string | undefined): number {
  switch (magnitude) {
    case 'transformative': return 4;
    case 'major': return 3;
    case 'moderate': return 2;
    case 'minor': return 1;
    default: return 1;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatEventDescription(event: MarketEvent): string {
  const parts: string[] = [];
  
  if (event.entityName) {
    parts.push(event.entityName);
  }
  
  if (event.jobsAffected) {
    const sign = event.jobsAffected > 0 ? '+' : '';
    parts.push(`${sign}${event.jobsAffected.toLocaleString()} jobs`);
  }
  
  if (event.unitsAffected) {
    parts.push(`${event.unitsAffected.toLocaleString()} units`);
  }
  
  return parts.join(' - ') || event.eventDescription || 'No details';
}

// Tool definition for agent registry
export const fetchMarketEventsTool = {
  name: 'fetch_market_events',
  description: `Get upcoming and historical market events near a property that may impact value:
- Employer moves, expansions, or layoffs
- Transit openings and expansions
- New apartment supply deliveries
- Infrastructure changes
Returns sentiment analysis, supply pipeline, risk factors, and opportunities.
Use when evaluating market timing or competitive dynamics.`,
  parameters: fetchMarketEventsSchema,
  execute: fetchMarketEvents
};
