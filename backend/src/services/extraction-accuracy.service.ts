import { Pool } from 'pg';

export interface DocumentAccuracy {
  documentId: string;
  documentType: string;
  fileName: string;
  overallScore: number;
  checks: AccuracyCheck[];
  customLineItems?: Array<{ label: string; amount: number }>;
  warnings: string[];
}

export interface AccuracyCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  extracted?: number | null;
  stated?: number | null;
  variancePct?: number | null;
}

function pct(a: number, b: number): number {
  return Math.abs(b) > 0 ? Math.abs(a - b) / Math.abs(b) : 0;
}

function fmt$(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function scoreChecks(checks: AccuracyCheck[]): number {
  if (checks.length === 0) return 0;
  let total = 0;
  let weight = 0;
  for (const c of checks) {
    const w = c.variancePct != null ? 3 : 1;
    const s = c.status === 'pass' ? 1 : c.status === 'warn' ? 0.6 : c.status === 'info' ? 0.85 : 0.1;
    total += s * w;
    weight += w;
  }
  return weight > 0 ? Math.round((total / weight) * 100) : 80;
}

export async function computeExtractionAccuracy(
  pool: Pool,
  dealId: string
): Promise<DocumentAccuracy[]> {
  // Load deal and its extraction capsule (stored directly in deal_data)
  const dealResult = await pool.query(
    `SELECT id, target_units, deal_data FROM deals WHERE id = $1`,
    [dealId]
  );
  if (dealResult.rows.length === 0) throw new Error('Deal not found');

  const deal = dealResult.rows[0];
  // Capsule data is stored directly in deal_data, not in deal_data.capsule
  const dealData: Record<string, unknown> = deal.deal_data ?? {};
  const targetUnits: number = deal.target_units ?? 0;

  // Load deal documents with extraction results
  const docsResult = await pool.query(
    `SELECT id, document_type, COALESCE(original_filename, filename) AS file_name,
            extraction_status, extraction_result
     FROM deal_document_files
     WHERE deal_id = $1 AND extraction_status = 'completed'
     ORDER BY created_at`,
    [dealId]
  );

  if (docsResult.rows.length === 0) return [];

  const results: DocumentAccuracy[] = [];

  // Process T12 documents
  const t12Docs = docsResult.rows.filter(r => r.document_type === 'T12');
  const rrDocs = docsResult.rows.filter(r => r.document_type === 'RENT_ROLL');

  const t12Cap = (dealData.extraction_t12 ?? {}) as Record<string, unknown>;
  const rrCap = (dealData.extraction_rent_roll ?? {}) as Record<string, unknown>;

  for (const doc of t12Docs) {
    const extractionAlerts: string[] = (doc.extraction_result?.alerts ?? []) as string[];
    results.push(analyzeT12(doc, t12Cap, extractionAlerts, targetUnits));
  }

  for (const doc of rrDocs) {
    const extractionAlerts: string[] = (doc.extraction_result?.alerts ?? []) as string[];
    results.push(analyzeRentRoll(doc, rrCap, extractionAlerts, targetUnits));
  }

  // Include any other doc types as info
  for (const doc of docsResult.rows.filter(r => r.document_type !== 'T12' && r.document_type !== 'RENT_ROLL')) {
    results.push({
      documentId: doc.id,
      documentType: doc.document_type,
      fileName: doc.file_name,
      overallScore: 80,
      checks: [{ label: 'Processed', status: 'info', detail: 'Document extracted successfully' }],
      warnings: [],
    });
  }

  return results;
}

function analyzeT12(
  doc: { id: string; file_name: string },
  t12Cap: Record<string, unknown>,
  alerts: string[],
  _targetUnits: number
): DocumentAccuracy {
  const opex = (t12Cap.opex ?? {}) as Record<string, unknown>;
  const checks: AccuracyCheck[] = [];
  const warnings: string[] = [];

  // ── 1. NOI Internal Consistency ──
  // Extracted NOI should equal EGI - OpEx
  const extractedNOI = num(t12Cap, 'noi');
  const extractedEGI = num(t12Cap, 'egi');
  const extractedOpex = num(opex, 'total');

  if (extractedNOI != null && extractedEGI != null && extractedOpex != null) {
    const impliedNOI = extractedEGI - extractedOpex;
    if (Math.abs(impliedNOI) > 1000) {
      const noiVar = pct(extractedNOI, impliedNOI);
      checks.push({
        label: 'NOI Consistency',
        status: noiVar < 0.02 ? 'pass' : noiVar < 0.08 ? 'warn' : 'fail',
        detail: noiVar < 0.02
          ? `NOI checks out: ${fmt$(extractedNOI)} = EGI (${fmt$(extractedEGI)}) − OpEx (${fmt$(extractedOpex)})`
          : `NOI gap: extracted ${fmt$(extractedNOI)}, implied ${fmt$(impliedNOI)} (${fmtPct(noiVar)} delta)`,
        extracted: extractedNOI,
        stated: impliedNOI,
        variancePct: noiVar,
      });
    }
  }

  // ── 2. Period Completeness ──
  const monthCount = num(t12Cap, 'months_captured');
  if (monthCount != null) {
    checks.push({
      label: 'Period Completeness',
      status: monthCount === 12 ? 'pass' : monthCount >= 10 ? 'warn' : 'fail',
      detail: monthCount === 12
        ? `All 12 months extracted`
        : `Only ${monthCount} of 12 months captured`,
      extracted: monthCount,
      stated: 12,
      variancePct: (12 - monthCount) / 12,
    });
  }

  // ── 3. Insurance Line ──
  const insAmt = num(opex, 'insurance');
  checks.push({
    label: 'Insurance Line',
    status: insAmt != null && insAmt > 0 ? 'pass' : 'warn',
    detail: insAmt != null && insAmt > 0
      ? `Found: ${fmt$(insAmt)}/yr`
      : 'No insurance line found — platform baseline will be used',
  });

  // ── 4. EGI / GPR Ratio ──
  const gpr = num(t12Cap, 'gpr');
  if (extractedEGI != null && gpr != null && gpr > 0) {
    const egiRatio = extractedEGI / gpr;
    checks.push({
      label: 'EGI / GPR Ratio',
      status: egiRatio >= 0.65 && egiRatio <= 1.05 ? 'pass' : 'warn',
      detail: `EGI is ${fmtPct(egiRatio)} of GPR — ${egiRatio >= 0.65 && egiRatio <= 1.05 ? 'within normal range' : 'outside typical 65–105% band'}`,
      extracted: extractedEGI,
      stated: gpr,
    });
  }

  // ── 5. Expense Ratio ──
  const expRatio = num(t12Cap, 'expense_ratio');
  if (expRatio != null) {
    checks.push({
      label: 'Expense Ratio',
      status: expRatio >= 0.25 && expRatio <= 0.70 ? 'pass' : 'warn',
      detail: `OpEx is ${fmtPct(expRatio)} of revenue (${fmt$(extractedOpex ?? 0)}) — ${expRatio >= 0.25 && expRatio <= 0.70 ? 'within normal multifamily range' : 'outside typical 25–70% range'}`,
    });
  }

  // ── 6. Core Opex Lines Populated ──
  const coreOpex: Record<string, string> = {
    payroll: 'Payroll',
    r_and_m: 'Repairs & Maint.',
    utilities: 'Utilities',
    mgmt_fee: 'Management Fee',
    real_estate_tax: 'Real Estate Tax',
  };
  const missingCore = Object.entries(coreOpex)
    .filter(([key]) => !(num(opex, key) != null && (num(opex, key) ?? 0) > 0))
    .map(([, label]) => label);

  checks.push({
    label: 'Core Expense Lines',
    status: missingCore.length === 0 ? 'pass' : missingCore.length <= 2 ? 'warn' : 'fail',
    detail: missingCore.length === 0
      ? `All core expense lines captured (payroll, R&M, utilities, mgmt fee, RE taxes)`
      : `Missing or zero: ${missingCore.join(', ')}`,
  });

  // ── 7. Custom GL Lines Info ──
  const rawCustom = (opex.custom_line_items ?? {}) as Record<string, number>;
  const customEntries = Object.entries(rawCustom).filter(([, v]) => typeof v === 'number' && Math.abs(v) > 1);
  const customLineItems = customEntries.map(([label, amount]) => ({ label, amount: amount as number }));
  if (customEntries.length > 0) {
    const customTotal = customEntries.reduce((s, [, v]) => s + (v as number), 0);
    checks.push({
      label: 'Custom GL Lines',
      status: 'info',
      detail: `${customEntries.length} unrecognized GL line(s) (${fmt$(customTotal)}/yr total) added to proforma — review labels`,
    });
    warnings.push(`${customEntries.length} custom GL line(s) need label review in the proforma`);
  }

  // ── 8. Cross-doc alerts ──
  const xvalAlerts = alerts.filter(a => a.includes('[xval]') || a.includes('diverges'));
  xvalAlerts.forEach(a => warnings.push(a.replace(/^\[xval\]\s*/, '')));

  return {
    documentId: doc.id,
    documentType: 'T12',
    fileName: doc.file_name,
    overallScore: scoreChecks(checks),
    checks,
    customLineItems,
    warnings,
  };
}

function analyzeRentRoll(
  doc: { id: string; file_name: string },
  rrCap: Record<string, unknown>,
  _alerts: string[],
  targetUnits: number
): DocumentAccuracy {
  const checks: AccuracyCheck[] = [];
  const warnings: string[] = [];

  // ── 1. Unit Count Match ──
  const extractedUnits = num(rrCap, 'total_units');
  if (extractedUnits != null && targetUnits > 0) {
    const unitVar = pct(extractedUnits, targetUnits);
    checks.push({
      label: 'Unit Count',
      status: unitVar < 0.02 ? 'pass' : unitVar < 0.10 ? 'warn' : 'fail',
      detail: unitVar < 0.02
        ? `${extractedUnits} units matches deal (${targetUnits})`
        : `Extracted ${extractedUnits} units vs. deal's ${targetUnits} (${fmtPct(unitVar)} variance)`,
      extracted: extractedUnits,
      stated: targetUnits,
      variancePct: unitVar,
    });
  } else if (extractedUnits != null) {
    checks.push({
      label: 'Unit Count',
      status: 'info',
      detail: `${extractedUnits} units extracted`,
      extracted: extractedUnits,
    });
  }

  // ── 2. Occupancy Rate ──
  const occupiedUnits = num(rrCap, 'occupied_units');
  const totalU = extractedUnits ?? targetUnits;
  if (occupiedUnits != null && totalU > 0) {
    const occPct = occupiedUnits / totalU;
    checks.push({
      label: 'Occupancy Rate',
      status: occPct >= 0.75 ? 'pass' : occPct >= 0.55 ? 'warn' : 'fail',
      detail: `${fmtPct(occPct)} occupied (${occupiedUnits} of ${totalU} units)`,
    });
  }

  // ── 3. GPR Reasonableness ──
  const gprMonthly = num(rrCap, 'gpr_monthly');
  if (gprMonthly != null && totalU > 0) {
    const gprPerUnit = gprMonthly / totalU;
    checks.push({
      label: 'GPR Per Unit/Month',
      status: gprPerUnit >= 600 && gprPerUnit <= 5000 ? 'pass' : 'warn',
      detail: `${fmt$(gprPerUnit)}/unit/mo (${fmt$(gprMonthly * 12)}/yr total) — ${gprPerUnit >= 600 && gprPerUnit <= 5000 ? 'within typical range' : 'outside typical $600–$5,000/unit/mo range'}`,
    });
  }

  // ── 4. Floor Plan Detection ──
  const floorPlanCount = num(rrCap, 'floorPlanCount');
  if (floorPlanCount != null) {
    checks.push({
      label: 'Floor Plan Coverage',
      status: floorPlanCount >= 1 ? 'pass' : 'fail',
      detail: `${floorPlanCount} unique floor plan type(s) detected`,
    });
  }

  // ── 5. Average Unit SF ──
  const avgSF = num(rrCap, 'avg_unit_sqft');
  if (avgSF != null) {
    checks.push({
      label: 'Unit Size Captured',
      status: avgSF >= 300 && avgSF <= 3000 ? 'pass' : 'warn',
      detail: `Average unit size: ${Math.round(avgSF)} SF — ${avgSF >= 300 && avgSF <= 3000 ? 'reasonable' : 'outside typical 300–3,000 SF range'}`,
    });
  }

  return {
    documentId: doc.id,
    documentType: 'RENT_ROLL',
    fileName: doc.file_name,
    overallScore: scoreChecks(checks),
    checks,
    warnings,
  };
}

function num(obj: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}
