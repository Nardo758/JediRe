/**
 * Tax Reconciliation Service — D3-W7
 *
 * Bridges tax projections (taxService.forecast / taxProjectionService) with
 * actual tax bill arrivals. When a tax bill is uploaded or fetched, computes
 * variance against the active projection, stores reconciliation state, and
 * recommends action (rebase / notify / ignore).
 *
 * State machine:
 *   projected → actual_received → reconciled
 *                        ↘ material_variance → rebased | ignored
 *
 * Materiality threshold: 5% (matches reconciliation.service.ts).
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import type { TaxForecast } from './tax/taxService';

export type TaxReconStatus =
  | 'projected'
  | 'actual_received'
  | 'reconciled'
  | 'material_variance'
  | 'rebased'
  | 'ignored';

export type TaxReconRecommendation = 'rebase' | 'notify' | 'ignore';

export interface TaxReconciliationRecord {
  id: string;
  dealId: string;
  projectionId: string | null;
  status: TaxReconStatus;
  projectedAnnualTax: number | null;
  actualAnnualTax: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  isMaterial: boolean;
  materialThresholdPct: number;
  taxBillSource: string | null;
  recommendation: TaxReconRecommendation | null;
  actionTaken: TaxReconRecommendation | null;
  actionTakenAt: string | null;
  createdAt: string;
  updatedAt: string;
  reconciledAt: string | null;
}

export interface ComputeReconInput {
  dealId: string;
  projectedAnnualTax: number;
  actualAnnualTax: number;
  projectionId?: string;
  taxBillSource?: string;
  taxBillId?: string;
  actualProvenance?: Record<string, unknown>;
  projectedProvenance?: Record<string, unknown>;
}

const MATERIAL_THRESHOLD = 0.05;

/**
 * Compute variance and create/update reconciliation state.
 */
export async function computeTaxReconciliation(
  input: ComputeReconInput,
): Promise<TaxReconciliationRecord> {
  const {
    dealId,
    projectedAnnualTax,
    actualAnnualTax,
    projectionId,
    taxBillSource,
    taxBillId,
    actualProvenance,
    projectedProvenance,
  } = input;

  const varianceAmount = actualAnnualTax - projectedAnnualTax;
  const variancePct = projectedAnnualTax !== 0 ? varianceAmount / projectedAnnualTax : null;
  const isMaterial = variancePct != null && Math.abs(variancePct) > MATERIAL_THRESHOLD;

  const recommendation: TaxReconRecommendation = isMaterial
    ? 'rebase'
    : Math.abs(variancePct ?? 0) > 0
      ? 'notify'
      : 'ignore';

  const status: TaxReconStatus = isMaterial ? 'material_variance' : 'reconciled';

  const pool = getPool();

  // Close any previous active reconciliation for this deal
  await pool.query(
    `UPDATE tax_reconciliation_states
        SET status = 'rebased',
            updated_at = NOW()
      WHERE deal_id = $1
        AND status IN ('projected', 'actual_received', 'reconciled', 'material_variance')`,
    [dealId],
  );

  // Insert new reconciliation record
  const insertRes = await pool.query<TaxReconciliationRecord>(
    `INSERT INTO tax_reconciliation_states (
       deal_id, projection_id, status,
       projected_annual_tax, actual_annual_tax,
       variance_amount, variance_pct,
       is_material, material_threshold_pct,
       tax_bill_source, tax_bill_id,
       recommendation,
       projected_provenance, actual_provenance,
       reconciled_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
     RETURNING
       id, deal_id AS "dealId", projection_id AS "projectionId", status,
       projected_annual_tax AS "projectedAnnualTax", actual_annual_tax AS "actualAnnualTax",
       variance_amount AS "varianceAmount", variance_pct AS "variancePct",
       is_material AS "isMaterial", material_threshold_pct AS "materialThresholdPct",
       tax_bill_source AS "taxBillSource",
       recommendation, action_taken AS "actionTaken", action_taken_at AS "actionTakenAt",
       created_at AS "createdAt", updated_at AS "updatedAt", reconciled_at AS "reconciledAt"`,
    [
      dealId,
      projectionId ?? null,
      status,
      projectedAnnualTax,
      actualAnnualTax,
      varianceAmount,
      variancePct,
      isMaterial,
      MATERIAL_THRESHOLD,
      taxBillSource ?? null,
      taxBillId ?? null,
      recommendation,
      projectedProvenance ? JSON.stringify(projectedProvenance) : null,
      actualProvenance ? JSON.stringify(actualProvenance) : null,
    ],
  );

  const record = insertRes.rows[0];

  logger.info('[tax-reconciliation] computed', {
    dealId,
    projectedAnnualTax,
    actualAnnualTax,
    variancePct,
    isMaterial,
    recommendation,
    status,
  });

  return record;
}

/**
 * Record an action taken on a reconciliation (rebase, notify, ignore).
 */
export async function recordReconciliationAction(
  reconId: string,
  action: TaxReconRecommendation,
  userId?: string,
): Promise<TaxReconciliationRecord | null> {
  const pool = getPool();

  const res = await pool.query<TaxReconciliationRecord>(
    `UPDATE tax_reconciliation_states
        SET action_taken = $1,
            action_taken_at = NOW(),
            action_taken_by = $2,
            status = CASE
              WHEN $1 = 'rebase' THEN 'rebased'
              WHEN $1 = 'ignore' THEN 'ignored'
              ELSE status
            END,
            updated_at = NOW()
      WHERE id = $3
      RETURNING
        id, deal_id AS "dealId", projection_id AS "projectionId", status,
        projected_annual_tax AS "projectedAnnualTax", actual_annual_tax AS "actualAnnualTax",
        variance_amount AS "varianceAmount", variance_pct AS "variancePct",
        is_material AS "isMaterial", material_threshold_pct AS "materialThresholdPct",
        tax_bill_source AS "taxBillSource",
        recommendation, action_taken AS "actionTaken", action_taken_at AS "actionTakenAt",
        created_at AS "createdAt", updated_at AS "updatedAt", reconciled_at AS "reconciledAt"`,
    [action, userId ?? null, reconId],
  );

  return res.rows[0] ?? null;
}

/**
 * Get the latest reconciliation state for a deal.
 */
export async function getLatestTaxReconciliation(
  dealId: string,
): Promise<TaxReconciliationRecord | null> {
  const pool = getPool();

  const res = await pool.query<TaxReconciliationRecord>(
    `SELECT
       id, deal_id AS "dealId", projection_id AS "projectionId", status,
       projected_annual_tax AS "projectedAnnualTax", actual_annual_tax AS "actualAnnualTax",
       variance_amount AS "varianceAmount", variance_pct AS "variancePct",
       is_material AS "isMaterial", material_threshold_pct AS "materialThresholdPct",
       tax_bill_source AS "taxBillSource",
       recommendation, action_taken AS "actionTaken", action_taken_at AS "actionTakenAt",
       created_at AS "createdAt", updated_at AS "updatedAt", reconciled_at AS "reconciledAt"
     FROM tax_reconciliation_states
    WHERE deal_id = $1
    ORDER BY created_at DESC
    LIMIT 1`,
    [dealId],
  );

  return res.rows[0] ?? null;
}

/**
 * Build a human-readable notification from a reconciliation record.
 */
export function buildTaxReconciliationNotification(
  record: TaxReconciliationRecord,
): { title: string; body: string; urgency: 'high' | 'medium' | 'low' } {
  const { status, projectedAnnualTax, actualAnnualTax, variancePct, isMaterial } = record;

  if (status === 'projected') {
    return {
      title: 'Tax projection active',
      body: `Projected annual tax: $${(projectedAnnualTax ?? 0).toLocaleString()}`,
      urgency: 'low',
    };
  }

  const direction = (variancePct ?? 0) > 0 ? 'higher' : 'lower';
  const pctAbs = Math.abs((variancePct ?? 0) * 100).toFixed(1);

  if (isMaterial) {
    return {
      title: `Material tax variance: ${pctAbs}% ${direction} than projected`,
      body:
        `Projected: $${(projectedAnnualTax ?? 0).toLocaleString()}\n` +
        `Actual:    $${(actualAnnualTax ?? 0).toLocaleString()}\n` +
        `Variance:  ${variancePct && variancePct > 0 ? '+' : ''}$${(record.varianceAmount ?? 0).toLocaleString()} (${pctAbs}%)\n` +
        `Recommendation: Rebase the proforma with actual tax values.`,
      urgency: 'high',
    };
  }

  return {
    title: `Tax aligned: ${pctAbs}% ${direction} than projected`,
    body:
      `Projected: $${(projectedAnnualTax ?? 0).toLocaleString()}\n` +
      `Actual:    $${(actualAnnualTax ?? 0).toLocaleString()}`,
    urgency: 'low',
  };
}

/**
 * Derive actual annual tax from a tax bill capsule or ATTOM data.
 * Used by the tax-bill consumer to feed computeTaxReconciliation.
 */
export function extractActualTaxFromBill(
  billData: Record<string, unknown>,
): { annualTax: number; source: string } | null {
  // Try multiple field names from different sources
  const annualTax =
    (typeof billData.annual_tax_current === 'number' ? billData.annual_tax_current : null) ??
    (typeof billData.totalAnnualTax === 'number' ? billData.totalAnnualTax : null) ??
    (typeof billData.total_tax_amount === 'number' ? billData.total_tax_amount : null) ??
    (typeof billData.tax_amount === 'number' ? billData.tax_amount : null) ??
    null;

  if (annualTax == null) return null;

  const source =
    (billData.source as string) ??
    (billData.data_source as string) ??
    'unknown';

  return { annualTax, source };
}
