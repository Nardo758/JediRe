/**
 * fetch_reforecast_summary Tool
 * 
 * Retrieves reforecast data for narrative generation.
 * Shows what changed since original underwriting and why.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const fetchReforecastSummarySchema = z.object({
  deal_id: z.string().describe('Deal ID to fetch reforecast for'),
  include_history: z.boolean().default(true).describe('Include all historical reforecasts'),
});

export type FetchReforecastSummaryInput = z.infer<typeof fetchReforecastSummarySchema>;

export interface ReforecastSummaryResult {
  dealId: string;
  dealName: string;
  hasReforecast: boolean;
  
  // Latest reforecast
  latest: {
    reforecastDate: string;
    reforecastType: string;
    triggerReason: string;
    status: string;
    
    // NOI changes
    originalNoiYear1: number;
    reforecastNoiYear1: number;
    noiDeltaPct: number;
    
    originalNoiStabilized: number;
    reforecastNoiStabilized: number;
    
    // Returns changes
    originalIrr: number;
    reforecastIrr: number;
    irrDeltaBps: number;
    
    originalEm: number;
    reforecastEm: number;
    emDelta: number;
    
    // What drove the changes
    changeDrivers: {
      driver: string;
      impactBps: number;
      direction: 'positive' | 'negative';
      narrative: string;
    }[];
    
    // Overall assessment
    performanceAssessment: 'outperforming' | 'tracking' | 'underperforming';
    assessmentNarrative: string;
  } | null;
  
  // Historical reforecasts
  history: {
    reforecastDate: string;
    reforecastType: string;
    originalIrr: number;
    reforecastIrr: number;
    irrDeltaBps: number;
    status: string;
  }[];
  
  // Key metrics trajectory
  trajectory: {
    metric: string;
    original: number;
    current: number;
    trend: 'improving' | 'stable' | 'declining';
  }[];
  
  // Narrative snippets for commentary
  narrativeSnippets: string[];
}

/**
 * Fetch reforecast summary for commentary
 */
export async function fetchReforecastSummary(
  input: FetchReforecastSummaryInput
): Promise<ReforecastSummaryResult> {
  logger.info('[fetch_reforecast_summary] Fetching reforecast', { dealId: input.deal_id });

  // Get deal name
  const dealResult = await query(
    `SELECT name FROM deals WHERE id = $1`,
    [input.deal_id]
  );
  const dealName = String((dealResult.rows[0] as Record<string, string>)?.name ?? 'Unknown');

  // Get latest reforecast
  const latestResult = await query(
    `SELECT * FROM reforecasts 
     WHERE deal_id = $1 
     ORDER BY reforecast_date DESC 
     LIMIT 1`,
    [input.deal_id]
  );

  // Get reforecast history
  const historyResult = input.include_history
    ? await query(
        `SELECT reforecast_date, reforecast_type, original_irr, reforecast_irr, irr_delta_bps, status
         FROM reforecasts
         WHERE deal_id = $1
         ORDER BY reforecast_date DESC`,
        [input.deal_id]
      )
    : { rows: [] };

  // Build result
  const result: ReforecastSummaryResult = {
    dealId: input.deal_id,
    dealName,
    hasReforecast: latestResult.rows.length > 0,
    latest: null,
    history: [],
    trajectory: [],
    narrativeSnippets: [],
  };

  if (latestResult.rows.length > 0) {
    const row = latestResult.rows[0] as Record<string, unknown>;
    
    const originalIrr = Number(row.original_irr ?? 0);
    const reforecastIrr = Number(row.reforecast_irr ?? 0);
    const irrDeltaBps = Number(row.irr_delta_bps ?? (reforecastIrr - originalIrr) * 100);
    
    const originalNoiYear1 = Number(row.original_noi_year1 ?? 0);
    const reforecastNoiYear1 = Number(row.reforecast_noi_year1 ?? 0);
    const noiDeltaPct = originalNoiYear1 > 0 
      ? ((reforecastNoiYear1 - originalNoiYear1) / originalNoiYear1) * 100 
      : 0;

    // Parse change drivers
    const rawDrivers = (row.change_drivers as { driver: string; impactBps: number; direction?: string }[]) ?? [];
    const changeDrivers = rawDrivers.map(d => ({
      driver: d.driver,
      impactBps: d.impactBps,
      direction: (d.direction ?? (d.impactBps >= 0 ? 'positive' : 'negative')) as 'positive' | 'negative',
      narrative: generateDriverNarrative(d.driver, d.impactBps),
    }));

    // Determine performance assessment
    let performanceAssessment: 'outperforming' | 'tracking' | 'underperforming';
    if (irrDeltaBps > 50) performanceAssessment = 'outperforming';
    else if (irrDeltaBps >= -100) performanceAssessment = 'tracking';
    else performanceAssessment = 'underperforming';

    const assessmentNarrative = generateAssessmentNarrative(
      performanceAssessment,
      irrDeltaBps,
      noiDeltaPct,
      changeDrivers
    );

    result.latest = {
      reforecastDate: new Date(row.reforecast_date as string).toISOString().split('T')[0],
      reforecastType: String(row.reforecast_type ?? ''),
      triggerReason: String(row.trigger_reason ?? ''),
      status: String(row.status ?? ''),
      originalNoiYear1,
      reforecastNoiYear1,
      noiDeltaPct,
      originalNoiStabilized: Number(row.original_noi_stabilized ?? 0),
      reforecastNoiStabilized: Number(row.reforecast_noi_stabilized ?? 0),
      originalIrr,
      reforecastIrr,
      irrDeltaBps,
      originalEm: Number(row.original_em ?? 0),
      reforecastEm: Number(row.reforecast_em ?? 0),
      emDelta: Number(row.reforecast_em ?? 0) - Number(row.original_em ?? 0),
      changeDrivers,
      performanceAssessment,
      assessmentNarrative,
    };

    // Build trajectory
    result.trajectory = [
      {
        metric: 'Year 1 NOI',
        original: originalNoiYear1,
        current: reforecastNoiYear1,
        trend: noiDeltaPct > 2 ? 'improving' : noiDeltaPct < -2 ? 'declining' : 'stable',
      },
      {
        metric: 'IRR',
        original: originalIrr,
        current: reforecastIrr,
        trend: irrDeltaBps > 25 ? 'improving' : irrDeltaBps < -50 ? 'declining' : 'stable',
      },
    ];

    // Generate narrative snippets
    result.narrativeSnippets = generateNarrativeSnippets(result.latest);
  }

  // Add history
  result.history = (historyResult.rows as Record<string, unknown>[]).map(row => ({
    reforecastDate: new Date(row.reforecast_date as string).toISOString().split('T')[0],
    reforecastType: String(row.reforecast_type ?? ''),
    originalIrr: Number(row.original_irr ?? 0),
    reforecastIrr: Number(row.reforecast_irr ?? 0),
    irrDeltaBps: Number(row.irr_delta_bps ?? 0),
    status: String(row.status ?? ''),
  }));

  logger.info('[fetch_reforecast_summary] Fetched', {
    dealId: input.deal_id,
    hasReforecast: result.hasReforecast,
  });

  return result;
}

/**
 * Generate narrative for a specific driver
 */
function generateDriverNarrative(driver: string, impactBps: number): string {
  const direction = impactBps >= 0 ? 'positive' : 'negative';
  const magnitude = Math.abs(impactBps);
  const impact = magnitude > 100 ? 'significant' : magnitude > 50 ? 'moderate' : 'minor';
  
  const driverLabels: Record<string, string> = {
    occupancy: 'occupancy levels',
    vacancy: 'vacancy rates',
    rent_growth: 'rent growth',
    operating_expenses: 'operating expenses',
    noi: 'net operating income',
    collections: 'collections performance',
  };
  
  const label = driverLabels[driver] ?? driver.replace(/_/g, ' ');
  
  if (direction === 'positive') {
    return `${label.charAt(0).toUpperCase() + label.slice(1)} have outperformed, contributing a ${impact} ${magnitude}bps improvement to returns.`;
  } else {
    return `${label.charAt(0).toUpperCase() + label.slice(1)} have underperformed projections, creating a ${impact} ${magnitude}bps drag on returns.`;
  }
}

/**
 * Generate overall assessment narrative
 */
function generateAssessmentNarrative(
  assessment: 'outperforming' | 'tracking' | 'underperforming',
  irrDeltaBps: number,
  noiDeltaPct: number,
  drivers: { driver: string; impactBps: number }[]
): string {
  const topDriver = drivers.sort((a, b) => Math.abs(b.impactBps) - Math.abs(a.impactBps))[0];
  
  switch (assessment) {
    case 'outperforming':
      return `The asset is outperforming original underwriting by ${Math.round(irrDeltaBps)}bps on IRR. Year 1 NOI is tracking ${noiDeltaPct > 0 ? '+' : ''}${noiDeltaPct.toFixed(1)}% vs. projection${topDriver ? `, primarily driven by ${topDriver.driver.replace(/_/g, ' ')}` : ''}.`;
    case 'tracking':
      return `The asset is tracking within expectations. Year 1 NOI is ${Math.abs(noiDeltaPct) < 2 ? 'on plan' : `${noiDeltaPct > 0 ? 'slightly ahead' : 'slightly behind'}`}, and projected returns remain achievable.`;
    case 'underperforming':
      return `The asset is underperforming original underwriting by ${Math.abs(Math.round(irrDeltaBps))}bps on IRR. Year 1 NOI is tracking ${noiDeltaPct.toFixed(1)}% vs. projection${topDriver ? `. The primary headwind is ${topDriver.driver.replace(/_/g, ' ')}` : ''}. Intervention may be required.`;
  }
}

/**
 * Generate narrative snippets for commentary
 */
function generateNarrativeSnippets(latest: ReforecastSummaryResult['latest']): string[] {
  if (!latest) return [];
  
  const snippets: string[] = [];
  
  // IRR change snippet
  if (Math.abs(latest.irrDeltaBps) > 25) {
    const direction = latest.irrDeltaBps > 0 ? 'increased' : 'decreased';
    snippets.push(`Projected IRR has ${direction} from ${latest.originalIrr.toFixed(1)}% to ${latest.reforecastIrr.toFixed(1)}% (${latest.irrDeltaBps > 0 ? '+' : ''}${Math.round(latest.irrDeltaBps)}bps).`);
  }
  
  // NOI snippet
  if (Math.abs(latest.noiDeltaPct) > 3) {
    const direction = latest.noiDeltaPct > 0 ? 'ahead of' : 'behind';
    snippets.push(`Year 1 NOI is tracking ${Math.abs(latest.noiDeltaPct).toFixed(1)}% ${direction} original projection.`);
  }
  
  // Driver snippets
  for (const driver of latest.changeDrivers.slice(0, 2)) {
    snippets.push(driver.narrative);
  }
  
  // Overall snippet
  snippets.push(latest.assessmentNarrative);
  
  return snippets;
}

/**
 * Tool definition for agent registration
 */
export const fetchReforecastSummaryTool = {
  name: 'fetch_reforecast_summary',
  description: `Retrieve reforecast summary for narrative generation.
Shows how projections have changed since original underwriting.

Returns:
- Latest reforecast with NOI/IRR/EM changes
- Change drivers with impact quantification
- Performance assessment (outperforming/tracking/underperforming)
- Pre-generated narrative snippets for commentary
- Historical reforecast trajectory

Use for operational commentary and investor updates.`,
  inputSchema: fetchReforecastSummarySchema,
  outputSchema: z.any(),
  execute: fetchReforecastSummary,
};
