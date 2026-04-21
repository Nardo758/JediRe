/**
 * Disposition Service
 * 
 * Tracks deal exits and feeds the ultimate learning signal back to the system.
 * When a deal is sold, we compare actual vs projected returns to calibrate
 * future underwriting.
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface DispositionData {
  dealId: string;
  listingDate?: Date;
  underContractDate?: Date;
  closingDate: Date;
  salePrice: number;
  buyerName?: string;
  buyerType?: string;
  broker?: string;
  trailingNoi: number;
  totalEquityInvested: number;
  totalDistributions: number;
  netSaleProceeds: number;
  actualIrr: number;
  actualEquityMultiple: number;
  dispositionNotes?: string;
  lessonsLearned?: string;
  marketConditions?: string;
}

export interface CashFlowEntry {
  flowDate: Date;
  flowType: 'equity_contribution' | 'distribution' | 'sale_proceeds' | 'refi_proceeds';
  amount: number;
  description?: string;
}

export interface DispositionLearning {
  dealId: string;
  dealName: string;
  closingDate: Date;
  holdPeriodMonths: number;
  actualIrr: number;
  projectedIrr: number;
  irrVarianceBps: number;
  actualExitCap: number;
  projectedExitCap: number;
  exitCapVarianceBps: number;
  performanceCategory: 'outperformed' | 'met_expectations' | 'underperformed';
  lessonsLearned?: string;
}

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Record a disposition (sale) event
 */
export async function recordDisposition(data: DispositionData): Promise<string> {
  // Get projected values from acquisition snapshot
  const snapshotResult = await query(
    `SELECT 
      assumptions->>'irr' as projected_irr,
      assumptions->>'equity_multiple' as projected_em,
      assumptions->>'exit_cap_rate' as projected_exit_cap,
      projected_exit_value as projected_sale_price,
      (assumptions->>'hold_period_years')::int * 12 as projected_hold_period
     FROM assumption_snapshots
     WHERE deal_id = $1 AND snapshot_type = 'acquisition'
     ORDER BY snapshot_date DESC LIMIT 1`,
    [data.dealId]
  );

  const projections = snapshotResult.rows[0] as Record<string, unknown> | undefined;

  // Get acquisition date to calculate hold period
  const dealResult = await query(
    `SELECT deal_data->>'acquisition_date' as acquisition_date FROM deals WHERE id = $1`,
    [data.dealId]
  );
  
  const acquisitionDate = dealResult.rows[0]?.acquisition_date 
    ? new Date(dealResult.rows[0].acquisition_date as string)
    : null;
  
  const holdPeriodMonths = acquisitionDate
    ? Math.round((data.closingDate.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  // Get unit count for price per unit
  const unitsResult = await query(
    `SELECT (deal_data->>'unit_count')::int as units FROM deals WHERE id = $1`,
    [data.dealId]
  );
  const units = Number(unitsResult.rows[0]?.units ?? 1);
  const pricePerUnit = data.salePrice / units;

  const totalProfit = data.netSaleProceeds + data.totalDistributions - data.totalEquityInvested;

  const result = await query(
    `INSERT INTO dispositions (
      deal_id, listing_date, under_contract_date, closing_date, hold_period_months,
      sale_price, price_per_unit, buyer_name, buyer_type, broker,
      trailing_noi,
      total_equity_invested, total_distributions, net_sale_proceeds, total_profit,
      actual_irr, actual_equity_multiple,
      projected_irr, projected_equity_multiple, projected_exit_cap, projected_sale_price, projected_hold_period,
      disposition_notes, lessons_learned, market_conditions
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11,
      $12, $13, $14, $15,
      $16, $17,
      $18, $19, $20, $21, $22,
      $23, $24, $25
    )
    ON CONFLICT (deal_id) DO UPDATE SET
      closing_date = EXCLUDED.closing_date,
      sale_price = EXCLUDED.sale_price,
      trailing_noi = EXCLUDED.trailing_noi,
      actual_irr = EXCLUDED.actual_irr,
      actual_equity_multiple = EXCLUDED.actual_equity_multiple,
      lessons_learned = EXCLUDED.lessons_learned
    RETURNING id`,
    [
      data.dealId, data.listingDate, data.underContractDate, data.closingDate, holdPeriodMonths,
      data.salePrice, pricePerUnit, data.buyerName, data.buyerType, data.broker,
      data.trailingNoi,
      data.totalEquityInvested, data.totalDistributions, data.netSaleProceeds, totalProfit,
      data.actualIrr, data.actualEquityMultiple,
      projections?.projected_irr ? Number(projections.projected_irr) : null,
      projections?.projected_em ? Number(projections.projected_em) : null,
      projections?.projected_exit_cap ? Number(projections.projected_exit_cap) : null,
      projections?.projected_sale_price ? Number(projections.projected_sale_price) : null,
      projections?.projected_hold_period ? Number(projections.projected_hold_period) : null,
      data.dispositionNotes, data.lessonsLearned, data.marketConditions,
    ]
  );

  // Update deal status
  await query(
    `UPDATE deals SET status = 'sold', updated_at = NOW() WHERE id = $1`,
    [data.dealId]
  );

  logger.info('[disposition] Recorded disposition', {
    dealId: data.dealId,
    salePrice: data.salePrice,
    actualIrr: data.actualIrr,
    projectedIrr: projections?.projected_irr,
  });

  // Feed to learning system
  await feedDispositionToLearning(data.dealId);

  return result.rows[0]?.id;
}

/**
 * Record cash flows for IRR calculation
 */
export async function recordCashFlows(
  dealId: string,
  cashFlows: CashFlowEntry[]
): Promise<void> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    for (const cf of cashFlows) {
      await client.query(
        `INSERT INTO disposition_cash_flows (deal_id, flow_date, flow_type, amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [dealId, cf.flowDate, cf.flowType, cf.amount, cf.description]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Calculate IRR from cash flows
 */
export function calculateIRR(cashFlows: { date: Date; amount: number }[]): number | null {
  if (cashFlows.length < 2) return null;
  
  // Sort by date
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Newton-Raphson method for XIRR
  let rate = 0.1; // Initial guess
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    const baseDate = sorted[0].date.getTime();
    
    for (const cf of sorted) {
      const years = (cf.date.getTime() - baseDate) / (365.25 * 24 * 60 * 60 * 1000);
      const factor = Math.pow(1 + rate, years);
      npv += cf.amount / factor;
      dnpv -= years * cf.amount / (factor * (1 + rate));
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate * 100; // Return as percentage
    }
    
    rate = rate - npv / dnpv;
    
    if (rate < -1 || rate > 10) {
      return null; // No reasonable solution
    }
  }
  
  return null;
}

/**
 * Feed disposition data to the learning system
 */
export async function feedDispositionToLearning(dealId: string): Promise<void> {
  try {
    const dispositionResult = await query(
      `SELECT * FROM dispositions WHERE deal_id = $1`,
      [dealId]
    );
    
    if (dispositionResult.rows.length === 0) return;
    
    const disp = dispositionResult.rows[0] as Record<string, unknown>;
    
    // Get snapshot context
    const snapshotResult = await query(
      `SELECT state, msa, asset_class, deal_type FROM assumption_snapshots
       WHERE deal_id = $1 AND snapshot_type = 'acquisition'
       ORDER BY snapshot_date DESC LIMIT 1`,
      [dealId]
    );
    
    const context = snapshotResult.rows[0] as Record<string, string> | undefined;
    
    // Record outcomes for key metrics
    const outcomes = [
      {
        assumptionName: 'irr',
        assumed: Number(disp.projected_irr),
        actual: Number(disp.actual_irr),
        period: 'exit',
      },
      {
        assumptionName: 'exit_cap_rate',
        assumed: Number(disp.projected_exit_cap),
        actual: Number(disp.actual_exit_cap),
        period: 'exit',
      },
      {
        assumptionName: 'equity_multiple',
        assumed: Number(disp.projected_equity_multiple),
        actual: Number(disp.actual_equity_multiple),
        period: 'exit',
      },
      {
        assumptionName: 'sale_price',
        assumed: Number(disp.projected_sale_price),
        actual: Number(disp.sale_price),
        period: 'exit',
      },
    ];
    
    // Get the snapshot ID
    const snapIdResult = await query(
      `SELECT id FROM assumption_snapshots WHERE deal_id = $1 AND snapshot_type = 'acquisition' ORDER BY snapshot_date DESC LIMIT 1`,
      [dealId]
    );
    const snapshotId = snapIdResult.rows[0]?.id;
    
    if (!snapshotId) return;
    
    for (const outcome of outcomes) {
      if (outcome.assumed == null || outcome.actual == null) continue;
      
      await query(
        `INSERT INTO assumption_outcomes (
          deal_id, snapshot_id, assumption_name,
          assumed_value, assumed_source, actual_value, actual_period, actual_source,
          state, msa, asset_class, deal_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (snapshot_id, assumption_name, actual_period) DO UPDATE SET
          actual_value = EXCLUDED.actual_value,
          computed_at = NOW()`,
        [
          dealId, snapshotId, outcome.assumptionName,
          outcome.assumed, 'underwriting', outcome.actual, outcome.period, 'disposition',
          context?.state, context?.msa, context?.asset_class, context?.deal_type,
        ]
      );
    }
    
    logger.info('[disposition] Fed disposition to learning system', { dealId });
    
  } catch (err) {
    logger.error('[disposition] Failed to feed learning', {
      dealId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get disposition learnings for analysis
 */
export async function getDispositionLearnings(
  filters?: {
    state?: string;
    msa?: string;
    assetClass?: string;
    minHoldPeriod?: number;
    maxHoldPeriod?: number;
  }
): Promise<DispositionLearning[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  
  if (filters?.state) {
    params.push(filters.state);
    conditions.push(`s.state = $${params.length}`);
  }
  if (filters?.msa) {
    params.push(filters.msa);
    conditions.push(`s.msa = $${params.length}`);
  }
  if (filters?.assetClass) {
    params.push(filters.assetClass);
    conditions.push(`s.asset_class = $${params.length}`);
  }
  if (filters?.minHoldPeriod) {
    params.push(filters.minHoldPeriod);
    conditions.push(`dis.hold_period_months >= $${params.length}`);
  }
  if (filters?.maxHoldPeriod) {
    params.push(filters.maxHoldPeriod);
    conditions.push(`dis.hold_period_months <= $${params.length}`);
  }
  
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  
  const result = await query(`
    SELECT 
      d.id as deal_id,
      d.name as deal_name,
      dis.closing_date,
      dis.hold_period_months,
      dis.actual_irr,
      dis.projected_irr,
      dis.irr_variance_bps,
      dis.actual_exit_cap,
      dis.projected_exit_cap,
      dis.exit_cap_variance_bps,
      dis.lessons_learned,
      CASE 
        WHEN dis.irr_variance_bps >= 0 THEN 'outperformed'
        WHEN dis.irr_variance_bps >= -200 THEN 'met_expectations'
        ELSE 'underperformed'
      END as performance_category
    FROM deals d
    JOIN dispositions dis ON dis.deal_id = d.id
    LEFT JOIN assumption_snapshots s ON s.deal_id = d.id AND s.snapshot_type = 'acquisition'
    WHERE dis.closing_date IS NOT NULL
      ${whereClause}
    ORDER BY dis.closing_date DESC
  `, params);
  
  return result.rows as DispositionLearning[];
}

/**
 * Get portfolio-wide exit performance statistics
 */
export async function getExitPerformanceStats(): Promise<{
  totalDispositions: number;
  avgIrrVarianceBps: number;
  avgExitCapVarianceBps: number;
  outperformedPct: number;
  metExpectationsPct: number;
  underperformedPct: number;
  avgHoldPeriodMonths: number;
}> {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      AVG(irr_variance_bps) as avg_irr_var,
      AVG(exit_cap_variance_bps) as avg_cap_var,
      AVG(hold_period_months) as avg_hold,
      SUM(CASE WHEN irr_variance_bps >= 0 THEN 1 ELSE 0 END)::float / COUNT(*) as outperformed,
      SUM(CASE WHEN irr_variance_bps < 0 AND irr_variance_bps >= -200 THEN 1 ELSE 0 END)::float / COUNT(*) as met,
      SUM(CASE WHEN irr_variance_bps < -200 THEN 1 ELSE 0 END)::float / COUNT(*) as under
    FROM dispositions
    WHERE closing_date IS NOT NULL
      AND projected_irr IS NOT NULL
      AND actual_irr IS NOT NULL
  `);
  
  const row = result.rows[0] as Record<string, number>;
  
  return {
    totalDispositions: Number(row.total ?? 0),
    avgIrrVarianceBps: Number(row.avg_irr_var ?? 0),
    avgExitCapVarianceBps: Number(row.avg_cap_var ?? 0),
    outperformedPct: Number(row.outperformed ?? 0) * 100,
    metExpectationsPct: Number(row.met ?? 0) * 100,
    underperformedPct: Number(row.under ?? 0) * 100,
    avgHoldPeriodMonths: Number(row.avg_hold ?? 0),
  };
}
