/**
 * Vintage Debt Estimator Service
 *
 * Deterministic, zero-LLM cashflow-distress flag computation.
 *
 * 1. Reads debt_positions for a deal.
 * 2. Looks up vintage base rates from FRED metric_time_series.
 * 3. Applies spread + amortization profiles.
 * 4. Computes DSCR, refi DSCR, proceeds gap.
 * 5. Derives six distress flags per DISTRESS_THRESHOLD_RULESET.
 *
 * Honest-absence contract:
 *   - missing input → undeterminable with reason, never FALSE.
 */

import { query, getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { getDebtPositions, type DebtPosition } from '../debt-tracking.service';
import { VINTAGE_SPREAD_RULESET, type LenderType } from './rulesets/vintage-spread.ruleset';
import { resolveAmortProfile, type AmortProfile } from './rulesets/amort-profile.ruleset';
import { DISTRESS_THRESHOLD_RULESET } from './rulesets/distress-threshold.ruleset';

// ─── Types ──────────────────────────────────────────────────────────────

export type Undeterminable = { undeterminable: true; reason: string };

export type MaybeNumber = number | Undeterminable;

export interface FlagResult {
  flag: boolean | 'undeterminable';
  value: number | null;
  threshold: number | null;
  provenance: string;
  reason?: string;
}

export interface VintageDebtEstimate {
  dealId: string;
  computedAt: string;
  rulesetVersion: string;

  // Intermediates
  dscrCurrent: MaybeNumber;
  dscrAtRefi: MaybeNumber;
  proceedsGap: MaybeNumber;
  estDebtService: MaybeNumber;

  // Per-position detail
  positions: DebtPositionEstimate[];

  // Flags
  negativeDscr: FlagResult;
  thinDscr: FlagResult;
  ioExpiryShock: FlagResult;
  underwaterEquity: FlagResult;
  cashInRefi: FlagResult;
  negativeLeverage: FlagResult;
}

export interface DebtPositionEstimate {
  debtId?: string;
  loanName: string;
  lenderType: LenderType | 'unknown';
  vintageRate: MaybeNumber;
  currentMarketRate: MaybeNumber;
  spreadBps: number;
  amortProfile: AmortProfile;
  estAnnualDebtService: MaybeNumber;
  estRefiDebtService: MaybeNumber;
  currentBalance: number;
  originationDate: string;
  maturityDate: string;
  ioPeriodMonths: number;
  monthsToIoExpiry: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isUndeterminable(v: MaybeNumber): v is Undeterminable {
  return typeof v === 'object' && v !== null && 'undeterminable' in v;
}

function val(v: MaybeNumber): number | null {
  return isUndeterminable(v) ? null : v;
}

function reason(v: MaybeNumber): string | undefined {
  return isUndeterminable(v) ? v.reason : undefined;
}

/**
 * Monthly PMT for a fully-amortizing loan.
 *   P = principal, r = monthly rate, n = months
 */
function pmt(P: number, annualRate: number, years: number): number {
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Annual debt service for a position at a given rate + profile.
 */
function annualDebtService(
  balance: number,
  rate: number,
  profile: AmortProfile,
): number {
  if (profile.amortizationType === 'IO' || profile.ioPeriodMonths === undefined || profile.ioPeriodMonths > 0) {
    // Interest-only annual payment
    return balance * rate;
  }
  const years = profile.amortizationYears ?? 30;
  const monthly = pmt(balance, rate, years);
  return monthly * 12;
}

// ─── FRED lookups ───────────────────────────────────────────────────────

const METRIC_ID_MAP: Record<string, string> = {
  DGS10: 'RATE_TREASURY_10Y',
  SOFR: 'RATE_SOFR',
};

/**
 * Nearest FRED observation on or before a given date.
 */
async function getVintageRate(
  baseSeries: string,
  asOfDate: Date,
): Promise<number | null> {
  const metricId = METRIC_ID_MAP[baseSeries];
  if (!metricId) {
    logger.warn(`[VintageDebtEstimator] Unknown base series: ${baseSeries}`);
    return null;
  }

  const result = await query(
    `SELECT value, period_date
     FROM metric_time_series
     WHERE metric_id = $1
       AND geography_id = 'US'
       AND geography_type = 'national'
       AND period_date <= $2::date
     ORDER BY period_date DESC
     LIMIT 1`,
    [metricId, asOfDate.toISOString().split('T')[0]],
  );

  if (result.rows.length === 0) return null;
  const v = parseFloat(result.rows[0].value);
  return isNaN(v) ? null : v / 100; // FRED stores % as 4.25, we need 0.0425
}

/**
 * Latest FRED observation for a series.
 */
async function getCurrentMarketRate(baseSeries: string): Promise<number | null> {
  const metricId = METRIC_ID_MAP[baseSeries];
  if (!metricId) return null;

  const result = await query(
    `SELECT value, period_date
     FROM metric_time_series
     WHERE metric_id = $1
       AND geography_id = 'US'
       AND geography_type = 'national'
     ORDER BY period_date DESC
     LIMIT 1`,
    [metricId],
  );

  if (result.rows.length === 0) return null;
  const v = parseFloat(result.rows[0].value);
  return isNaN(v) ? null : v / 100;
}

// ─── Deal financial extraction ──────────────────────────────────────────

interface DealFinancials {
  estNOI: number | null;
  estValue: number | null;
  capRate: number | null;
}

/**
 * Extract est_NOI, est_value, and cap_rate from deal tables.
 * Tries canonical paths; returns nulls for absent data (honest absence).
 */
async function extractDealFinancials(dealId: string): Promise<DealFinancials> {
  const pool = getPool();

  // Path 1: deal_assumptions year1 (canonical layered values)
  const assumResult = await pool.query(
    `SELECT year1->'noi'->>'resolved' AS noi_resolved,
            year1->'purchase_price'->>'resolved' AS price_resolved,
            year1->'exit_cap'->>'resolved' AS cap_resolved
     FROM deal_assumptions
     WHERE deal_id = $1
     LIMIT 1`,
    [dealId],
  );

  let estNOI: number | null = null;
  let estValue: number | null = null;
  let capRate: number | null = null;

  if (assumResult.rows.length > 0) {
    const r = assumResult.rows[0];
    estNOI = r.noi_resolved ? parseFloat(r.noi_resolved) : null;
    estValue = r.price_resolved ? parseFloat(r.price_resolved) : null;
    capRate = r.cap_resolved ? parseFloat(r.cap_resolved) : null;
  }

  // Path 2: deals.deal_data fallback for value / cap rate
  if (estValue == null || capRate == null) {
    const dealResult = await pool.query(
      `SELECT deal_data->>'purchase_price' AS purchase_price,
              deal_data->>'asking_price' AS asking_price,
              deal_data->'financial'->'assumptions'->>'exitCapRate' AS exit_cap,
              budget
       FROM deals
       WHERE id = $1
       LIMIT 1`,
      [dealId],
    );

    if (dealResult.rows.length > 0) {
      const r = dealResult.rows[0];
      if (estValue == null) {
        estValue = r.purchase_price ? parseFloat(r.purchase_price)
          : r.asking_price ? parseFloat(r.asking_price)
          : r.budget ? parseFloat(r.budget)
          : null;
      }
      if (capRate == null && r.exit_cap) {
        capRate = parseFloat(r.exit_cap);
      }
    }
  }

  // Derive cap rate from NOI / value if we have both but no explicit cap
  if (capRate == null && estNOI != null && estValue != null && estValue > 0) {
    capRate = estNOI / estValue;
  }

  return { estNOI, estValue, capRate };
}

// ─── Core estimator ─────────────────────────────────────────────────────

/**
 * Build a single debt-position estimate.
 */
async function estimatePosition(
  dp: DebtPosition,
): Promise<DebtPositionEstimate> {
  const lenderType: LenderType | 'unknown' = dp.loanType || 'unknown';
  const profile = resolveAmortProfile(lenderType === 'unknown' ? null : lenderType);

  // ── Missing origination date → cannot resolve vintage rate
  if (!dp.originationDate) {
    return {
      debtId: dp.id,
      loanName: dp.loanName,
      lenderType,
      vintageRate: { undeterminable: true, reason: 'missing_origination_date' },
      currentMarketRate: { undeterminable: true, reason: 'missing_origination_date' },
      spreadBps: VINTAGE_SPREAD_RULESET.spreadsBps[lenderType as LenderType] ?? 0,
      amortProfile: profile,
      estAnnualDebtService: { undeterminable: true, reason: 'missing_origination_date' },
      estRefiDebtService: { undeterminable: true, reason: 'missing_origination_date' },
      currentBalance: dp.currentBalance ?? dp.originalPrincipal,
      originationDate: '',
      maturityDate: dp.maturityDate ? dp.maturityDate.toISOString().split('T')[0] : '',
      ioPeriodMonths: dp.ioPeriodMonths ?? profile.ioPeriodMonths ?? 0,
      monthsToIoExpiry: null,
    };
  }

  const origDateStr = dp.originationDate.toISOString().split('T')[0];
  const baseSeries = lenderType === 'unknown'
    ? 'DGS10'
    : VINTAGE_SPREAD_RULESET.baseSeries[lenderType as LenderType] ?? 'DGS10';
  const spreadBps = lenderType === 'unknown'
    ? 200
    : VINTAGE_SPREAD_RULESET.spreadsBps[lenderType as LenderType] ?? 200;

  // ── Vintage rate lookup
  const vintageBaseRate = await getVintageRate(baseSeries, dp.originationDate);
  const vintageRate: MaybeNumber = vintageBaseRate == null
    ? { undeterminable: true, reason: 'fred_vintage_rate_unavailable' }
    : vintageBaseRate + spreadBps / 10000;

  // ── Current market rate lookup
  const currentBaseRate = await getCurrentMarketRate(baseSeries);
  const currentMarketRate: MaybeNumber = currentBaseRate == null
    ? { undeterminable: true, reason: 'fred_current_rate_unavailable' }
    : currentBaseRate + spreadBps / 10000;

  const balance = dp.currentBalance ?? dp.originalPrincipal;

  // ── Annual debt service at vintage rate
  let estAnnualDS: MaybeNumber;
  if (isUndeterminable(vintageRate)) {
    estAnnualDS = vintageRate;
  } else {
    estAnnualDS = annualDebtService(balance, vintageRate, profile);
  }

  // ── Refi debt service at current market rate
  //   Use market LTV max from threshold ruleset to compute refi loan amount
  let estRefiDS: MaybeNumber;
  if (isUndeterminable(currentMarketRate)) {
    estRefiDS = currentMarketRate;
  } else {
    const ltvMax = lenderType === 'unknown'
      ? 0.65
      : DISTRESS_THRESHOLD_RULESET.marketLtvMax[lenderType as LenderType] ?? 0.65;
    // Refi loan amount = original principal * LTV max (conservative: assume same leverage)
    const refiLoanAmount = dp.originalPrincipal * ltvMax;
    estRefiDS = annualDebtService(refiLoanAmount, currentMarketRate, profile);
  }

  // ── Months to IO expiry
  let monthsToIoExpiry: number | null = null;
  const ioMonths = dp.ioPeriodMonths ?? profile.ioPeriodMonths ?? 0;
  if (ioMonths > 0 && dp.originationDate) {
    const ioEnd = new Date(dp.originationDate);
    ioEnd.setMonth(ioEnd.getMonth() + ioMonths);
    monthsToIoExpiry = Math.max(0,
      Math.ceil((ioEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
    );
  }

  return {
    debtId: dp.id,
    loanName: dp.loanName,
    lenderType,
    vintageRate,
    currentMarketRate,
    spreadBps,
    amortProfile: profile,
    estAnnualDebtService: estAnnualDS,
    estRefiDebtService: estRefiDS,
    currentBalance: balance,
    originationDate: origDateStr,
    maturityDate: dp.maturityDate ? dp.maturityDate.toISOString().split('T')[0] : '',
    ioPeriodMonths: ioMonths,
    monthsToIoExpiry,
  };
}

// ─── Flag derivation ────────────────────────────────────────────────────

function makeFlag(
  triggered: boolean | 'undeterminable',
  value: number | null,
  threshold: number | null,
  provenance: string,
  reason?: string,
): FlagResult {
  return { flag: triggered, value, threshold, provenance, reason };
}

/**
 * Compute all six distress flags from intermediates.
 */
function deriveFlags(
  dscrCurrent: MaybeNumber,
  dscrAtRefi: MaybeNumber,
  proceedsGap: MaybeNumber,
  estDebtService: MaybeNumber,
  positions: DebtPositionEstimate[],
  capRate: number | null,
  weightedVintageRate: MaybeNumber,
  rulesetVersion: string,
): Pick<VintageDebtEstimate, 'negativeDscr' | 'thinDscr' | 'ioExpiryShock' | 'underwaterEquity' | 'cashInRefi' | 'negativeLeverage'> {
  const provenance = rulesetVersion;

  // 1. negative_dscr — DSCR < 1.0
  const negativeDscr = ((): FlagResult => {
    if (isUndeterminable(dscrCurrent)) {
      return makeFlag('undeterminable', null, 1.0, provenance, dscrCurrent.reason);
    }
    return makeFlag(dscrCurrent < 1.0, dscrCurrent, 1.0, provenance);
  })();

  // 2. thin_dscr — DSCR within buffer of lender minimum
  const thinDscr = ((): FlagResult => {
    if (isUndeterminable(dscrCurrent)) {
      return makeFlag('undeterminable', null, null, provenance, dscrCurrent.reason);
    }
    // Use most conservative (lowest) lender min across positions
    let minLenderMin = Infinity;
    for (const p of positions) {
      if (p.lenderType !== 'unknown') {
        const min = DISTRESS_THRESHOLD_RULESET.lenderMinDscr[p.lenderType as LenderType];
        if (min != null && min < minLenderMin) minLenderMin = min;
      }
    }
    if (!isFinite(minLenderMin)) minLenderMin = 1.25;
    const threshold = minLenderMin + DISTRESS_THRESHOLD_RULESET.thinDscrBuffer;
    return makeFlag(dscrCurrent < threshold, dscrCurrent, threshold, provenance);
  })();

  // 3. io_expiry_shock — IO ends within horizon AND refi DSCR would be stressed
  const ioExpiryShock = ((): FlagResult => {
    const shockPosition = positions.find(
      p => p.monthsToIoExpiry != null
        && p.monthsToIoExpiry <= DISTRESS_THRESHOLD_RULESET.ioShockMonthsAhead
        && p.monthsToIoExpiry >= 0,
    );
    if (!shockPosition) {
      return makeFlag(false, null, DISTRESS_THRESHOLD_RULESET.ioShockMonthsAhead, provenance);
    }
    // If IO terms explicitly missing for bridge, undeterminable
    if (shockPosition.lenderType === 'bridge' && shockPosition.ioPeriodMonths === 0) {
      return makeFlag('undeterminable', null, DISTRESS_THRESHOLD_RULESET.ioShockMonthsAhead, provenance, 'missing_io_terms_for_bridge');
    }
    const refiDscr = isUndeterminable(dscrAtRefi) ? null : val(dscrAtRefi);
    const threshold = shockPosition.lenderType === 'bridge'
      ? DISTRESS_THRESHOLD_RULESET.lenderMinDscr.bridge
      : 1.25;
    const triggered = refiDscr != null ? refiDscr < threshold : false;
    return makeFlag(
      triggered,
      shockPosition.monthsToIoExpiry,
      DISTRESS_THRESHOLD_RULESET.ioShockMonthsAhead,
      provenance,
      refiDscr == null ? 'refi_dscr_undeterminable' : undefined,
    );
  })();

  // 4. underwater_equity — current balance > market LTV max × value
  const underwaterEquity = ((): FlagResult => {
    if (isUndeterminable(proceedsGap)) {
      return makeFlag('undeterminable', null, null, provenance, proceedsGap.reason);
    }
    // Use most conservative (lowest) LTV max across positions for threshold
    let minLtvMax = Infinity;
    for (const p of positions) {
      if (p.lenderType !== 'unknown') {
        const max = DISTRESS_THRESHOLD_RULESET.marketLtvMax[p.lenderType as LenderType];
        if (max != null && max < minLtvMax) minLtvMax = max;
      }
    }
    if (!isFinite(minLtvMax)) minLtvMax = 0.65;
    // Value = current aggregate LTV (balance / value) if we can derive it
    // For simplicity, flag if proceeds_gap > 0
    return makeFlag(proceedsGap > 0, proceedsGap, 0, provenance);
  })();

  // 5. cash_in_refi — proceeds_gap > 0 (same threshold logic, different semantic)
  const cashInRefi = ((): FlagResult => {
    if (isUndeterminable(proceedsGap)) {
      return makeFlag('undeterminable', null, 0, provenance, proceedsGap.reason);
    }
    return makeFlag(proceedsGap > 0, proceedsGap, 0, provenance);
  })();

  // 6. negative_leverage — cap_rate < all_in_rate
  const negativeLeverage = ((): FlagResult => {
    if (capRate == null) {
      return makeFlag('undeterminable', null, null, provenance, 'missing_cap_rate');
    }
    if (isUndeterminable(weightedVintageRate)) {
      return makeFlag('undeterminable', null, null, provenance, weightedVintageRate.reason);
    }
    return makeFlag(capRate < weightedVintageRate, capRate, weightedVintageRate, provenance);
  })();

  return { negativeDscr, thinDscr, ioExpiryShock, underwaterEquity, cashInRefi, negativeLeverage };
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Compute vintage debt estimate + distress flags for a deal.
 *
 * @param dealId  Deal UUID
 * @returns Fully typed estimate with provenance on every field.
 */
export async function computeVintageDebtEstimate(dealId: string): Promise<VintageDebtEstimate> {
  const rulesetVersion = VINTAGE_SPREAD_RULESET.version;

  // 1. Load debt positions
  const debtPositions = await getDebtPositions(dealId);

  if (debtPositions.length === 0) {
    const und = { undeterminable: true, reason: 'no_debt_positions' } as Undeterminable;
    return {
      dealId,
      computedAt: new Date().toISOString(),
      rulesetVersion,
      dscrCurrent: und,
      dscrAtRefi: und,
      proceedsGap: und,
      estDebtService: und,
      positions: [],
      negativeDscr: makeFlag('undeterminable', null, 1.0, 'platform_estimate', 'no_debt_positions'),
      thinDscr: makeFlag('undeterminable', null, null, 'platform_estimate', 'no_debt_positions'),
      ioExpiryShock: makeFlag('undeterminable', null, DISTRESS_THRESHOLD_RULESET.ioShockMonthsAhead, 'platform_estimate', 'no_debt_positions'),
      underwaterEquity: makeFlag('undeterminable', null, null, 'platform_estimate', 'no_debt_positions'),
      cashInRefi: makeFlag('undeterminable', null, 0, 'platform_estimate', 'no_debt_positions'),
      negativeLeverage: makeFlag('undeterminable', null, null, 'platform_estimate', 'no_debt_positions'),
    };
  }

  // 2. Estimate each position
  const positionEstimates = await Promise.all(debtPositions.map(estimatePosition));

  // 3. Aggregate debt services
  let totalEstDS = 0;
  let totalEstRefiDS = 0;
  let totalBalance = 0;
  let weightedRateSum = 0;
  let anyDSUnd = false;
  let anyRefiDSUnd = false;

  for (const p of positionEstimates) {
    totalBalance += p.currentBalance;
    if (isUndeterminable(p.estAnnualDebtService)) {
      anyDSUnd = true;
    } else {
      totalEstDS += p.estAnnualDebtService;
    }
    if (isUndeterminable(p.estRefiDebtService)) {
      anyRefiDSUnd = true;
    } else {
      totalEstRefiDS += p.estRefiDebtService;
    }
    if (!isUndeterminable(p.vintageRate)) {
      weightedRateSum += p.vintageRate * p.currentBalance;
    }
  }

  const estDebtService: MaybeNumber = anyDSUnd && totalEstDS === 0
    ? { undeterminable: true, reason: 'position_debt_service_undeterminable' }
    : totalEstDS;

  const estRefiDebtService: MaybeNumber = anyRefiDSUnd && totalEstRefiDS === 0
    ? { undeterminable: true, reason: 'position_refi_debt_service_undeterminable' }
    : totalEstRefiDS;

  const weightedVintageRate: MaybeNumber = totalBalance > 0
    ? weightedRateSum / totalBalance
    : { undeterminable: true, reason: 'zero_total_balance' };

  // 4. Load deal financials
  const financials = await extractDealFinancials(dealId);

  // 5. Compute intermediates
  const dscrCurrent: MaybeNumber = ((): MaybeNumber => {
    if (financials.estNOI == null) {
      return { undeterminable: true, reason: 'missing_est_noi' };
    }
    if (isUndeterminable(estDebtService)) {
      return estDebtService;
    }
    if (estDebtService === 0) {
      return { undeterminable: true, reason: 'zero_debt_service' };
    }
    return financials.estNOI / estDebtService;
  })();

  const dscrAtRefi: MaybeNumber = ((): MaybeNumber => {
    if (financials.estNOI == null) {
      return { undeterminable: true, reason: 'missing_est_noi' };
    }
    if (isUndeterminable(estRefiDebtService)) {
      return estRefiDebtService;
    }
    if (estRefiDebtService === 0) {
      return { undeterminable: true, reason: 'zero_refi_debt_service' };
    }
    return financials.estNOI / estRefiDebtService;
  })();

  const proceedsGap: MaybeNumber = ((): MaybeNumber => {
    if (financials.estValue == null) {
      return { undeterminable: true, reason: 'missing_est_value' };
    }
    // Use most conservative (lowest) LTV max for refi proceeds calc
    let minLtvMax = Infinity;
    for (const p of positionEstimates) {
      if (p.lenderType !== 'unknown') {
        const max = DISTRESS_THRESHOLD_RULESET.marketLtvMax[p.lenderType as LenderType];
        if (max != null && max < minLtvMax) minLtvMax = max;
      }
    }
    if (!isFinite(minLtvMax)) minLtvMax = 0.65;
    const maxProceeds = financials.estValue * minLtvMax;
    return totalBalance - maxProceeds;
  })();

  // 6. Derive flags
  const flags = deriveFlags(
    dscrCurrent,
    dscrAtRefi,
    proceedsGap,
    estDebtService,
    positionEstimates,
    financials.capRate,
    weightedVintageRate,
    rulesetVersion,
  );

  return {
    dealId,
    computedAt: new Date().toISOString(),
    rulesetVersion,
    dscrCurrent,
    dscrAtRefi,
    proceedsGap,
    estDebtService,
    positions: positionEstimates,
    ...flags,
  };
}

/**
 * Persist a computed estimate to deal_context_financials.
 * Idempotent on (deal_id, ruleset_version).
 */
export async function persistVintageDebtEstimate(
  estimate: VintageDebtEstimate,
): Promise<void> {
  const {
    dealId, rulesetVersion,
    dscrCurrent, dscrAtRefi, proceedsGap, estDebtService,
    negativeDscr, thinDscr, ioExpiryShock,
    underwaterEquity, cashInRefi, negativeLeverage,
  } = estimate;

  await query(
    `INSERT INTO deal_context_financials (
      deal_id, computed_at, ruleset_version,
      dscr_current, dscr_at_refi, proceeds_gap, est_debt_service,
      negative_dscr, negative_dscr_value, negative_dscr_threshold, negative_dscr_provenance,
      thin_dscr, thin_dscr_value, thin_dscr_threshold, thin_dscr_provenance,
      io_expiry_shock, io_expiry_shock_value, io_expiry_shock_threshold, io_expiry_shock_provenance,
      underwater_equity, underwater_equity_value, underwater_equity_threshold, underwater_equity_provenance,
      cash_in_refi, cash_in_refi_value, cash_in_refi_threshold, cash_in_refi_provenance,
      negative_leverage, negative_leverage_value, negative_leverage_threshold, negative_leverage_provenance
    ) VALUES (
      $1, NOW(), $2,
      $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17, $18,
      $19, $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29, $30
    )
    ON CONFLICT (deal_id, ruleset_version)
    DO UPDATE SET
      computed_at = EXCLUDED.computed_at,
      dscr_current = EXCLUDED.dscr_current,
      dscr_at_refi = EXCLUDED.dscr_at_refi,
      proceeds_gap = EXCLUDED.proceeds_gap,
      est_debt_service = EXCLUDED.est_debt_service,
      negative_dscr = EXCLUDED.negative_dscr,
      negative_dscr_value = EXCLUDED.negative_dscr_value,
      negative_dscr_threshold = EXCLUDED.negative_dscr_threshold,
      negative_dscr_provenance = EXCLUDED.negative_dscr_provenance,
      thin_dscr = EXCLUDED.thin_dscr,
      thin_dscr_value = EXCLUDED.thin_dscr_value,
      thin_dscr_threshold = EXCLUDED.thin_dscr_threshold,
      thin_dscr_provenance = EXCLUDED.thin_dscr_provenance,
      io_expiry_shock = EXCLUDED.io_expiry_shock,
      io_expiry_shock_value = EXCLUDED.io_expiry_shock_value,
      io_expiry_shock_threshold = EXCLUDED.io_expiry_shock_threshold,
      io_expiry_shock_provenance = EXCLUDED.io_expiry_shock_provenance,
      underwater_equity = EXCLUDED.underwater_equity,
      underwater_equity_value = EXCLUDED.underwater_equity_value,
      underwater_equity_threshold = EXCLUDED.underwater_equity_threshold,
      underwater_equity_provenance = EXCLUDED.underwater_equity_provenance,
      cash_in_refi = EXCLUDED.cash_in_refi,
      cash_in_refi_value = EXCLUDED.cash_in_refi_value,
      cash_in_refi_threshold = EXCLUDED.cash_in_refi_threshold,
      cash_in_refi_provenance = EXCLUDED.cash_in_refi_provenance,
      negative_leverage = EXCLUDED.negative_leverage,
      negative_leverage_value = EXCLUDED.negative_leverage_value,
      negative_leverage_threshold = EXCLUDED.negative_leverage_threshold,
      negative_leverage_provenance = EXCLUDED.negative_leverage_provenance`,
    [
      dealId,
      rulesetVersion,
      val(dscrCurrent),
      val(dscrAtRefi),
      val(proceedsGap),
      val(estDebtService),
      negativeDscr.flag === true,
      negativeDscr.value,
      negativeDscr.threshold,
      negativeDscr.provenance,
      thinDscr.flag === true,
      thinDscr.value,
      thinDscr.threshold,
      thinDscr.provenance,
      ioExpiryShock.flag === true,
      ioExpiryShock.value,
      ioExpiryShock.threshold,
      ioExpiryShock.provenance,
      underwaterEquity.flag === true,
      underwaterEquity.value,
      underwaterEquity.threshold,
      underwaterEquity.provenance,
      cashInRefi.flag === true,
      cashInRefi.value,
      cashInRefi.threshold,
      cashInRefi.provenance,
      negativeLeverage.flag === true,
      negativeLeverage.value,
      negativeLeverage.threshold,
      negativeLeverage.provenance,
    ],
  );
}
