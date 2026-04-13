/**
 * Debt Context Modifier Service
 * Reads M08 strategy context (strategy_analyses ROI metrics, risk_score, correlation
 * implications from strategy_arbitrage) and adjusts / re-ranks the raw debt plan:
 *  - RSS (risk-adjusted spread sensitivity) adjustment bps on each alternative
 *  - Lender reranking based on correlation risk quartile
 *  - Narrative enrichment with strategy context
 */
import { Pool } from 'pg';
import { DebtAdvisorResponse, DebtAlternative, DebtPhase } from './debt-plan-formulator.service';

interface StrategyRoiContext {
  leveragedIrr?: number;
  unleveredIrr?: number;
  equityMultiple?: number;
  dscr?: number;
  exitCapRate?: number;
}

interface CorrelationRow {
  signal_a: string;
  signal_b: string;
  lead_lag_months: number;
  correlation: number;
  implication: string | null;
}

async function fetchRoiContext(pool: Pool, dealId: string): Promise<StrategyRoiContext> {
  try {
    const result = await pool.query(
      `SELECT roi_metrics FROM strategy_analyses WHERE deal_id = $1 AND recommended = true ORDER BY created_at DESC LIMIT 1`,
      [dealId]
    );
    if (!result.rows.length) return {};
    const rm = result.rows[0].roi_metrics || {};
    return {
      leveragedIrr: rm.leveraged_irr ?? rm.irr ?? undefined,
      unleveredIrr: rm.unlevered_irr ?? undefined,
      equityMultiple: rm.equity_multiple ?? rm.em ?? undefined,
      dscr: rm.dscr ?? undefined,
      exitCapRate: rm.exit_cap_rate ?? rm.exit_cap ?? undefined,
    };
  } catch {
    return {};
  }
}

async function fetchTopCorrelations(pool: Pool, dealId: string): Promise<CorrelationRow[]> {
  try {
    const result = await pool.query(
      `SELECT signal_a, signal_b, lead_lag_months, correlation, implication
       FROM strategy_arbitrage
       WHERE deal_id = $1
       ORDER BY ABS(correlation) DESC LIMIT 5`,
      [dealId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

function computeRssAdjustmentBps(
  riskScore: number,
  correlations: CorrelationRow[]
): number {
  let adj = 0;

  if (riskScore > 80) adj += 15;
  else if (riskScore > 65) adj += 8;
  else if (riskScore < 30) adj -= 10;

  const avgCorr = correlations.length
    ? correlations.reduce((s, r) => s + Math.abs(r.correlation), 0) / correlations.length
    : 0;

  if (avgCorr > 0.7) adj += 10;
  else if (avgCorr > 0.5) adj += 5;

  return Math.round(adj);
}

function reankLendersByRisk(
  phases: DebtPhase[],
  riskScore: number
): DebtPhase[] {
  if (riskScore < 50) return phases;

  return phases.map(phase => {
    if (!phase.lenders || phase.lenders.length <= 1) return phase;
    const sorted = [...phase.lenders].sort((a, b) => {
      const aScore = (a.fitScore || 0) - (riskScore > 70 ? (a.recourse === 'full' ? 0 : 5) : 0);
      const bScore = (b.fitScore || 0) - (riskScore > 70 ? (b.recourse === 'full' ? 0 : 5) : 0);
      return bScore - aScore;
    });
    return { ...phase, lenders: sorted };
  });
}

function enrichAlternativesWithContext(
  alternatives: DebtAlternative[],
  roi: StrategyRoiContext,
  rssAdjBps: number
): DebtAlternative[] {
  return alternatives.map(alt => {
    const adjustedDelta = alt.deltaAllInBps + rssAdjBps;
    let contextNote = '';

    if (roi.leveragedIrr != null) {
      const irrPctStr = (roi.leveragedIrr * 100).toFixed(1);
      if (adjustedDelta > 0) {
        contextNote = ` Strategy-adjusted spread implies ~${Math.round(adjustedDelta * 0.4)}bps IRR drag vs base case (IRR: ${irrPctStr}%).`;
      } else if (adjustedDelta < 0) {
        contextNote = ` Correlation context suggests tighter spreads available; potential +${Math.round(Math.abs(adjustedDelta) * 0.4)}bps IRR lift.`;
      }
    }

    if (roi.dscr != null && roi.dscr < 1.25) {
      contextNote += ` DSCR headroom is thin (${roi.dscr.toFixed(2)}) — prefer lower-leverage alternative to preserve covenant cushion.`;
    }

    return {
      ...alt,
      deltaAllInBps: adjustedDelta,
      tradeoff: alt.tradeoff + contextNote,
    };
  });
}

function buildRssNarrative(
  correlations: CorrelationRow[],
  rssAdjBps: number,
  strategySlug: string
): string {
  if (!correlations.length) return '';
  const top = correlations[0];
  const direction = rssAdjBps > 0 ? `+${rssAdjBps}bps spread premium` : `${rssAdjBps}bps spread discount`;
  return `Market correlation context (${top.signal_a} → ${top.signal_b}, corr ${top.correlation.toFixed(2)}, ${top.lead_lag_months}mo lead) implies ${direction} on alternatives relative to primary recommendation for ${strategySlug} strategy.`;
}

export interface ContextModifierOutput {
  modifiedPhases: DebtPhase[];
  modifiedAlternatives: DebtAlternative[];
  rssAdjustmentBps: number;
  rssNarrative: string;
  roiContext: StrategyRoiContext;
}

export async function applyDebtContextModifier(
  pool: Pool,
  plan: DebtAdvisorResponse
): Promise<ContextModifierOutput> {
  const { dealId, strategyInputs } = plan;
  const riskScore = strategyInputs.riskScore || 0;

  const [roi, correlations] = await Promise.all([
    fetchRoiContext(pool, dealId),
    fetchTopCorrelations(pool, dealId),
  ]);

  const rssAdjBps = computeRssAdjustmentBps(riskScore, correlations);
  const modifiedPhases = reankLendersByRisk(plan.recommendedStack, riskScore);
  const modifiedAlternatives = enrichAlternativesWithContext(plan.alternatives, roi, rssAdjBps);
  const rssNarrative = buildRssNarrative(correlations, rssAdjBps, strategyInputs.strategySlug);

  return {
    modifiedPhases,
    modifiedAlternatives,
    rssAdjustmentBps: rssAdjBps,
    rssNarrative,
    roiContext: roi,
  };
}
