import { Pool } from 'pg';
import type { CrossDocVariance } from '../document-extraction/types';

// ============================================================================
// Multi-Document Cross-Validation Service
//
// Runs after each new document extraction completes. Compares the same metric
// across multiple uploaded documents and emits typed variance alerts to
// `platform_intel` when divergence exceeds thresholds.
//
// Key cross-checks (in priority order):
//   1. Annual property tax: Tax Bill vs T12 (T12 often understates pending bills)
//   2. GPR: Rent Roll annualized vs T12 market rent (sanity check on rent universe)
//   3. Occupancy: Rent Roll snapshot vs T12 implied vacancy
//   4. AR exposure: Rent Roll outstanding vs Aged AR total
//   5. Property identity: Owner LP from tax bill vs property metadata
//   6. Concession ratio: T12 trailing vs Rent Roll snapshot (timing/seasonality)
//
// Alerts are typed by `metric` and severity. Downstream modules subscribe:
//   - M14 Risk reads `severity:warning|critical` alerts
//   - M09 ProForma reads scenarios when present
//   - M22 Post-close uses these as baseline-at-acquisition
// ============================================================================

const VARIANCE_THRESHOLDS = {
  property_tax_warning_pct: 0.10,
  property_tax_critical_pct: 0.20,
  gpr_warning_pct: 0.05,
  gpr_critical_pct: 0.15,
  occupancy_warning_pct_pts: 0.03,        // 3 percentage points
  occupancy_critical_pct_pts: 0.07,
  ar_warning_pct: 0.20,
  ar_critical_pct: 0.50,
  concession_warning_pct_pts: 0.03,
  concession_critical_pct_pts: 0.06,
};

interface DocSnapshot {
  document_id: string;
  document_type: string;
  filename: string;
  uploaded_at: string;
  capsule: any;
}

async function loadAllDocSnapshots(pool: Pool, dealId: string): Promise<DocSnapshot[]> {
  // Read all completed extractions for this deal
  const result = await pool.query(
    `SELECT id, document_type, original_filename, updated_at, extraction_result
     FROM deal_document_files
     WHERE deal_id = $1 AND extraction_status = 'completed'
     ORDER BY updated_at DESC`,
    [dealId]
  );
  return result.rows.map(r => ({
    document_id: r.id,
    document_type: r.document_type,
    filename: r.original_filename,
    uploaded_at: r.updated_at,
    capsule: typeof r.extraction_result === 'string' ? JSON.parse(r.extraction_result) : r.extraction_result,
  }));
}

async function loadCapsule(pool: Pool, dealId: string): Promise<any> {
  const result = await pool.query(`SELECT deal_data FROM deals WHERE id = $1`, [dealId]);
  return result.rows[0]?.deal_data ?? {};
}

// ─── Individual cross-checks ─────────────────────────────────────────────────

function checkPropertyTax(capsule: any): CrossDocVariance | null {
  const t12 = capsule.extraction_t12;
  const tax = capsule.extraction_tax_bill;
  if (!t12 || !tax) return null;
  const t12Tax = t12.opex?.real_estate_tax ?? 0;
  const billCurrent = tax.annual_tax_current ?? 0;
  if (t12Tax === 0 || billCurrent === 0) return null;

  const delta = Math.abs(billCurrent - t12Tax);
  const deltaPct = delta / Math.max(t12Tax, billCurrent);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (deltaPct >= VARIANCE_THRESHOLDS.property_tax_critical_pct) severity = 'critical';
  else if (deltaPct >= VARIANCE_THRESHOLDS.property_tax_warning_pct) severity = 'warning';
  if (severity === 'info') return null;

  const scenarios: Record<string, number> = {
    proforma_base_case: billCurrent,
  };
  if (tax.appeal_status === 'pending' && tax.annual_tax_unappealed) {
    scenarios.proforma_downside_appeal_lost = tax.annual_tax_unappealed;
  }

  return {
    metric: 'annual_property_tax',
    doc_a: { source: 'T12', value: t12Tax, doc_id: t12.document_id ?? 'unknown' },
    doc_b: { source: 'TAX_BILL', value: billCurrent, doc_id: tax.document_id ?? 'unknown' },
    delta_abs: billCurrent - t12Tax,
    delta_pct: deltaPct,
    severity,
    scenarios,
    message: tax.appeal_status === 'pending'
      ? `T12 ad valorem ($${Math.round(t12Tax).toLocaleString()}) understates current tax bill ($${Math.round(billCurrent).toLocaleString()}, appeal pending) by ${(deltaPct * 100).toFixed(1)}%. Downside if appeal lost: $${Math.round(tax.annual_tax_unappealed ?? 0).toLocaleString()} (NOI impact -$${Math.round((tax.annual_tax_unappealed ?? 0) - billCurrent).toLocaleString()}).`
      : `T12 ad valorem ($${Math.round(t12Tax).toLocaleString()}) and tax bill ($${Math.round(billCurrent).toLocaleString()}) diverge by ${(deltaPct * 100).toFixed(1)}%.`,
  };
}

function checkGPR(capsule: any): CrossDocVariance | null {
  const t12 = capsule.extraction_t12;
  const rr = capsule.extraction_rent_roll;
  if (!t12 || !rr) return null;
  const t12Gpr = t12.gpr ?? 0;
  const rrGprAnnual = (rr.gpr_monthly ?? 0) * 12;
  if (t12Gpr === 0 || rrGprAnnual === 0) return null;

  const delta = Math.abs(rrGprAnnual - t12Gpr);
  const deltaPct = delta / Math.max(t12Gpr, rrGprAnnual);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (deltaPct >= VARIANCE_THRESHOLDS.gpr_critical_pct) severity = 'critical';
  else if (deltaPct >= VARIANCE_THRESHOLDS.gpr_warning_pct) severity = 'warning';
  if (severity === 'info') return null;

  return {
    metric: 'gross_potential_rent_annual',
    doc_a: { source: 'T12', value: t12Gpr, doc_id: t12.document_id ?? 'unknown' },
    doc_b: { source: 'RENT_ROLL', value: rrGprAnnual, doc_id: rr.document_id ?? 'unknown' },
    delta_abs: rrGprAnnual - t12Gpr,
    delta_pct: deltaPct,
    severity,
    message: `T12 trailing GPR ($${Math.round(t12Gpr).toLocaleString()}) and rent roll annualized GPR ($${Math.round(rrGprAnnual).toLocaleString()}) differ by ${(deltaPct * 100).toFixed(1)}%. Likely cause: rent growth between T12 period and rent roll snapshot. Use rent roll for forward proforma.`,
  };
}

function checkOccupancy(capsule: any): CrossDocVariance | null {
  const t12 = capsule.extraction_t12;
  const rr = capsule.extraction_rent_roll;
  if (!t12 || !rr) return null;
  const t12VacancyPct = t12.gpr > 0 ? Math.abs(t12.vacancy_loss ?? 0) / t12.gpr : null;
  const rrVacancyPct = rr.occupancy_by_unit_pct != null ? 1 - rr.occupancy_by_unit_pct : null;
  if (t12VacancyPct == null || rrVacancyPct == null) return null;

  const delta = Math.abs(rrVacancyPct - t12VacancyPct);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (delta >= VARIANCE_THRESHOLDS.occupancy_critical_pct_pts) severity = 'critical';
  else if (delta >= VARIANCE_THRESHOLDS.occupancy_warning_pct_pts) severity = 'warning';
  if (severity === 'info') return null;

  return {
    metric: 'vacancy_rate',
    doc_a: { source: 'T12', value: t12VacancyPct, doc_id: t12.document_id ?? 'unknown' },
    doc_b: { source: 'RENT_ROLL', value: rrVacancyPct, doc_id: rr.document_id ?? 'unknown' },
    delta_abs: rrVacancyPct - t12VacancyPct,
    delta_pct: delta / Math.max(t12VacancyPct, rrVacancyPct),
    severity,
    message: `T12 trailing vacancy ${(t12VacancyPct * 100).toFixed(1)}% vs rent roll snapshot ${(rrVacancyPct * 100).toFixed(1)}%. Delta: ${(delta * 100).toFixed(1)}pp. Likely indicates ${rrVacancyPct > t12VacancyPct ? 'recent softening' : 'lease-up improvement'}.`,
  };
}

function checkAR(capsule: any): CrossDocVariance | null {
  const ar = capsule.extraction_aged_receivables;
  const rr = capsule.extraction_rent_roll;
  if (!ar || !rr) return null;
  const arTotal = ar.totalAR ?? ar.total_ar ?? 0;
  const rrOutstanding = rr.outstanding_balance_total ?? 0;
  if (arTotal === 0 || rrOutstanding === 0) return null;

  const delta = Math.abs(arTotal - rrOutstanding);
  const deltaPct = delta / Math.max(arTotal, rrOutstanding);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (deltaPct >= VARIANCE_THRESHOLDS.ar_critical_pct) severity = 'critical';
  else if (deltaPct >= VARIANCE_THRESHOLDS.ar_warning_pct) severity = 'warning';
  if (severity === 'info') return null;

  return {
    metric: 'outstanding_ar',
    doc_a: { source: 'RENT_ROLL', value: rrOutstanding, doc_id: rr.document_id ?? 'unknown' },
    doc_b: { source: 'AGED_RECEIVABLES', value: arTotal, doc_id: ar.document_id ?? 'unknown' },
    delta_abs: arTotal - rrOutstanding,
    delta_pct: deltaPct,
    severity,
    message: `Rent roll outstanding ($${Math.round(rrOutstanding).toLocaleString()}) and aged AR total ($${Math.round(arTotal).toLocaleString()}) differ by ${(deltaPct * 100).toFixed(1)}%. Different as-of dates explain part; investigate if persistent.`,
  };
}

function checkConcessions(capsule: any): CrossDocVariance | null {
  const t12 = capsule.extraction_t12;
  const rr = capsule.extraction_rent_roll;
  if (!t12 || !rr) return null;
  const t12ConcPct = t12.gpr > 0
    ? Math.abs((typeof t12.concessions === 'object' ? t12.concessions.total : t12.concessions) ?? 0) / t12.gpr
    : null;
  const rrConcPct = rr.gpr_monthly > 0
    ? Math.abs(rr.other_income_monthly?.concessions_other ?? 0) / rr.gpr_monthly
    : null;
  if (t12ConcPct == null || rrConcPct == null) return null;

  const delta = Math.abs(t12ConcPct - rrConcPct);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (delta >= VARIANCE_THRESHOLDS.concession_critical_pct_pts) severity = 'critical';
  else if (delta >= VARIANCE_THRESHOLDS.concession_warning_pct_pts) severity = 'warning';
  if (severity === 'info') return null;

  return {
    metric: 'concession_ratio',
    doc_a: { source: 'T12', value: t12ConcPct, doc_id: t12.document_id ?? 'unknown' },
    doc_b: { source: 'RENT_ROLL', value: rrConcPct, doc_id: rr.document_id ?? 'unknown' },
    delta_abs: t12ConcPct - rrConcPct,
    delta_pct: delta / Math.max(t12ConcPct, rrConcPct),
    severity,
    message: `T12 concession ratio ${(t12ConcPct * 100).toFixed(1)}% (full year) vs rent roll snapshot ${(rrConcPct * 100).toFixed(1)}%. Concessions burning off — confirm with concession schedule.`,
  };
}

function checkOwnerIdentity(capsule: any, dealRow: any): CrossDocVariance | null {
  const tax = capsule.extraction_tax_bill;
  if (!tax || !tax.owner_lp || !dealRow?.legal_owner) return null;
  const taxOwner = String(tax.owner_lp).trim().toUpperCase();
  const dealOwner = String(dealRow.legal_owner).trim().toUpperCase();
  if (taxOwner === dealOwner) return null;

  // Soft match: substring overlap of >70% suggests same entity, different formatting
  const overlap = taxOwner.length > 0 && dealOwner.length > 0
    ? (taxOwner.includes(dealOwner) || dealOwner.includes(taxOwner) ? 1 : 0)
    : 0;

  return {
    metric: 'legal_owner',
    doc_a: { source: 'TAX_BILL', value: 0, doc_id: tax.document_id ?? 'unknown' },
    doc_b: { source: 'DEAL_RECORD', value: 0, doc_id: 'deal' },
    delta_abs: 0,
    delta_pct: overlap,
    severity: overlap === 0 ? 'critical' : 'warning',
    message: `Tax bill owner "${taxOwner}" does not match deal record owner "${dealOwner}". ${overlap === 0 ? 'No string overlap — possible wrong parcel or seller dispute.' : 'Partial match — likely formatting variance.'}`,
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function persistAlert(pool: Pool, dealId: string, variance: CrossDocVariance): Promise<void> {
  // Idempotent on (deal_id, metric) — replace prior alert for same metric
  await pool.query(
    `INSERT INTO platform_intel (deal_id, alert_type, severity, title, detail, source_document_type, source_ref, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW(), NOW())
     ON CONFLICT (deal_id, alert_type) WHERE alert_type IS NOT NULL
     DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       detail = EXCLUDED.detail,
       source_document_type = EXCLUDED.source_document_type,
       source_ref = EXCLUDED.source_ref,
       updated_at = NOW()`,
    [
      dealId,
      `cross_doc_${variance.metric}`,
      variance.severity,
      variance.message,
      JSON.stringify(variance),
      `${variance.doc_a.source}+${variance.doc_b.source}`,
      `${variance.doc_a.doc_id}|${variance.doc_b.doc_id}`,
    ]
  );
}

// ─── Main entry point ───────────────────────────────────────────────────────

export async function runCrossValidation(pool: Pool, dealId: string): Promise<{
  variancesFound: number;
  alertsBySeverity: Record<string, number>;
  variances: CrossDocVariance[];
}> {
  const capsule = await loadCapsule(pool, dealId);
  const dealRow = (await pool.query(`SELECT legal_owner FROM deals WHERE id = $1`, [dealId])).rows[0];

  const checks = [
    checkPropertyTax(capsule),
    checkGPR(capsule),
    checkOccupancy(capsule),
    checkAR(capsule),
    checkConcessions(capsule),
    checkOwnerIdentity(capsule, dealRow),
  ];

  const variances = checks.filter((c): c is CrossDocVariance => c !== null);
  const alertsBySeverity: Record<string, number> = { info: 0, warning: 0, critical: 0 };
  for (const v of variances) {
    alertsBySeverity[v.severity] = (alertsBySeverity[v.severity] ?? 0) + 1;
    await persistAlert(pool, dealId, v);
  }

  return {
    variancesFound: variances.length,
    alertsBySeverity,
    variances,
  };
}
