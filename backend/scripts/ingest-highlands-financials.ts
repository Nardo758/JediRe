/**
 * Ingest Highlands 13 month rolling tab → deal_monthly_actuals_lines + deal_monthly_actuals
 * Source: BPI_Financial_Package_p2122_Accrual^GAAP_p21220426_1780264563164.xlsx
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/ingest-highlands-financials.ts
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const PROPERTY_CODE = 'p2122';
const PROPERTY_ID = '7ea31caf-f070-43eb-9fd1-fe08f7123701';
const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
const TOTAL_UNITS = 290;
const BOOKS = 'Accrual^GAAP';

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEAL_DIR = path.join(BACKEND_ROOT, 'uploads/deals', DEAL_ID);

// Use the GAAP Apr 2026 package which has the 13 month rolling tab
const FIN_FILE = path.join(DEAL_DIR, 'BPI_Financial_Package_p2122_Accrual^GAAP_p21220426_1780264563164.xlsx');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function safeNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Map account labels → deal_monthly_actuals column names
// Matches both exact and contains-based patterns
const LABEL_TO_COLUMN: Record<string, string> = {
  'Gross Potential Rent': 'gross_potential_rent',
  'Concessions': 'concessions',
  'Vacancy Loss': 'vacancy_loss',
  'Other Rent Losses': 'vacancy_loss',             // additive with Vacancy Loss
  'Total Rental Income': 'net_rental_income',
  'Total Other Income': 'other_income',
  'Total Income': 'effective_gross_income',
  'Utilities': 'utilities',
  'Maintenance & Repairs': 'repairs_maintenance',
  'Make-ready/turnover': 'turnover_costs',
  'Payroll': 'payroll',
  'Marketing': 'marketing',
  'Total Controllable Expenses': 'total_opex',      // partial, overwritten by Total OpEx
  'Total Non-Controllable Expenses': 'total_opex',  // additive placeholder
  'Total Operating Expenses': 'total_opex',
  'Net Operating Income (NOI)': 'noi',
  'Net Income': 'cash_flow_before_tax',
  // Non-controllable
  'Admin General': 'admin_general',
  'Administrative/General': 'admin_general',
  'Management Fee': 'management_fee',
  'Property Tax': 'property_tax',
  'Real Estate Taxes': 'real_estate_taxes',
  'Insurance': 'insurance',
  'Contract Services': 'contract_services',
};

// Labels that are additive into an existing column (not a full override)
const ADDITIVE_LABELS = new Set(['Other Rent Losses', 'Total Controllable Expenses', 'Total Non-Controllable Expenses']);

function findColumnForLabel(label: string): string | null {
  // Exact match
  if (LABEL_TO_COLUMN[label]) return LABEL_TO_COLUMN[label];
  // Contains match
  for (const [key, col] of Object.entries(LABEL_TO_COLUMN)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return col;
  }
  return null;
}

async function main() {
  console.log('[Financials→DB] Starting — Highlands 13-month rolling ingestion');
  console.log(`[Financials→DB] File: ${FIN_FILE}`);

  const wb = XLSX.readFile(FIN_FILE, { sheetStubs: true });

  const SHEET = '13 month rolling';
  if (!wb.SheetNames.includes(SHEET)) {
    throw new Error(`No "${SHEET}" sheet found. Available: ${wb.SheetNames.join(', ')}`);
  }

  const ws = wb.Sheets[SHEET];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`[Financials→DB] Total rows: ${rows.length}`);

  // Month header is at row index 14:
  // [0]="sMMMYear ---->", [1]=null, [2]="Apr 2025", ..., [14]="Apr 2026", [16]="Total"(skip)
  const headerRow = rows[14];
  const monthMap: { colIdx: number; periodMonth: string }[] = [];

  const MONTH_ABBREVS: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };

  for (let c = 2; c <= 14; c++) {
    const cell = headerRow[c];
    if (!cell || typeof cell !== 'string') continue;
    if (cell === 'Total' || cell === 'Per Unit') continue;
    // Parse "Apr 2025" → "2025-04-01"
    const parts = cell.trim().split(' ');
    if (parts.length !== 2) continue;
    const [abbrev, year] = parts;
    const mm = MONTH_ABBREVS[abbrev];
    if (!mm) continue;
    monthMap.push({ colIdx: c, periodMonth: `${year}-${mm}-01` });
  }

  console.log(`[Financials→DB] Month columns found: ${monthMap.length}`);
  monthMap.forEach(m => console.log(`  col ${m.colIdx}: ${m.periodMonth}`));

  // Collect account rows (data starts ~row 19)
  // The only reliable gate is hasAmounts — section headers have no numeric values in month cols.
  // Do NOT filter on label keywords; totals like "Net Operating Income (NOI)" and
  // "Total Operating Expenses" are real data rows that happen to have gl === label.
  const lines: { gl: string | null; label: string; amounts: (number | null)[] }[] = [];

  for (let r = 19; r < Math.min(rows.length, 200); r++) {
    const row = rows[r];
    if (!row) continue;
    const gl = row[0] != null ? String(row[0]).trim() : null;
    const label = row[1] != null ? String(row[1]).trim() : null;
    if (!label) continue;

    // Skip rows with no numeric amounts in any month column (true section headers)
    const hasAmounts = monthMap.some(m => row[m.colIdx] != null && typeof row[m.colIdx] === 'number');
    if (!hasAmounts) continue;

    const amounts = monthMap.map(m => safeNum(row[m.colIdx]));
    lines.push({ gl, label, amounts });
  }

  console.log(`[Financials→DB] Account lines collected: ${lines.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert into deal_monthly_actuals_lines
    let linesInserted = 0;
    for (const line of lines) {
      for (let i = 0; i < monthMap.length; i++) {
        const { periodMonth } = monthMap[i];
        const amount = line.amounts[i];
        if (amount == null) continue;
        await client.query(
          `INSERT INTO deal_monthly_actuals_lines
             (property_code, period_month, account_label, gl_range, amount, books, source_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (property_code, period_month, account_label) DO UPDATE SET
             gl_range=EXCLUDED.gl_range, amount=EXCLUDED.amount,
             books=EXCLUDED.books, source_file=EXCLUDED.source_file`,
          [PROPERTY_CODE, periodMonth, line.label, line.gl, amount, BOOKS, path.basename(FIN_FILE)]
        );
        linesInserted++;
      }
    }
    console.log(`[Financials→DB] ✓ Upserted ${linesInserted} rows into deal_monthly_actuals_lines`);

    // 2. Roll up to deal_monthly_actuals
    // Build per-month aggregates
    for (let i = 0; i < monthMap.length; i++) {
      const { periodMonth } = monthMap[i];
      const vals: Record<string, number | null> = {};

      for (const line of lines) {
        const amount = line.amounts[i];
        if (amount == null) continue;
        const col = findColumnForLabel(line.label);
        if (!col) continue;

        if (ADDITIVE_LABELS.has(line.label)) {
          // Add to existing value (e.g. Other Rent Losses adds to vacancy_loss)
          vals[col] = (vals[col] ?? 0) + amount;
        } else {
          // For Total Operating Expenses, it overrides partials
          if (col === 'total_opex' && line.label === 'Total Operating Expenses') {
            vals[col] = amount;
          } else if (vals[col] == null) {
            vals[col] = amount;
          } else {
            vals[col] = amount; // last-write-wins for duplicate mappings
          }
        }
      }

      // Compute derived fields
      const noi = vals['noi'] ?? null;
      const totalOpex = vals['total_opex'] ?? null;
      const egi = vals['effective_gross_income'] ?? null;
      const noPerUnit = noi != null ? noi / TOTAL_UNITS : null;
      const opexPerUnit = totalOpex != null ? totalOpex / TOTAL_UNITS : null;
      const opexRatio = (totalOpex != null && egi != null && egi !== 0) ? totalOpex / egi : null;

      await client.query(
        `INSERT INTO deal_monthly_actuals (
           property_id, deal_id, report_month,
           is_budget, is_proforma, is_portfolio_asset,
           gross_potential_rent, concessions, vacancy_loss,
           net_rental_income, other_income, effective_gross_income,
           utilities, repairs_maintenance, turnover_costs,
           payroll, marketing, admin_general,
           management_fee, property_tax, real_estate_taxes,
           insurance, contract_services,
           total_opex, opex_per_unit, opex_ratio,
           noi, noi_per_unit,
           cash_flow_before_tax,
           data_source, source_document_type
         ) VALUES (
           $1,$2,$3,
           false,false,true,
           $4,$5,$6,
           $7,$8,$9,
           $10,$11,$12,
           $13,$14,$15,
           $16,$17,$18,
           $19,$20,
           $21,$22,$23,
           $24,$25,
           $26,
           'bpi_financial_package','13_month_rolling'
         )
         ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO UPDATE SET
           gross_potential_rent=EXCLUDED.gross_potential_rent,
           concessions=EXCLUDED.concessions,
           vacancy_loss=EXCLUDED.vacancy_loss,
           net_rental_income=EXCLUDED.net_rental_income,
           other_income=EXCLUDED.other_income,
           effective_gross_income=EXCLUDED.effective_gross_income,
           utilities=EXCLUDED.utilities,
           repairs_maintenance=EXCLUDED.repairs_maintenance,
           turnover_costs=EXCLUDED.turnover_costs,
           payroll=EXCLUDED.payroll,
           marketing=EXCLUDED.marketing,
           admin_general=EXCLUDED.admin_general,
           management_fee=EXCLUDED.management_fee,
           property_tax=EXCLUDED.property_tax,
           real_estate_taxes=EXCLUDED.real_estate_taxes,
           insurance=EXCLUDED.insurance,
           contract_services=EXCLUDED.contract_services,
           total_opex=EXCLUDED.total_opex,
           opex_per_unit=EXCLUDED.opex_per_unit,
           opex_ratio=EXCLUDED.opex_ratio,
           noi=EXCLUDED.noi,
           noi_per_unit=EXCLUDED.noi_per_unit,
           cash_flow_before_tax=EXCLUDED.cash_flow_before_tax,
           data_source=EXCLUDED.data_source,
           source_document_type=EXCLUDED.source_document_type`,
        [
          PROPERTY_ID, DEAL_ID, periodMonth,
          vals['gross_potential_rent'] ?? null,
          vals['concessions'] ?? null,
          vals['vacancy_loss'] ?? null,
          vals['net_rental_income'] ?? null,
          vals['other_income'] ?? null,
          egi,
          vals['utilities'] ?? null,
          vals['repairs_maintenance'] ?? null,
          vals['turnover_costs'] ?? null,
          vals['payroll'] ?? null,
          vals['marketing'] ?? null,
          vals['admin_general'] ?? null,
          vals['management_fee'] ?? null,
          vals['property_tax'] ?? null,
          vals['real_estate_taxes'] ?? null,
          vals['insurance'] ?? null,
          vals['contract_services'] ?? null,
          totalOpex,
          opexPerUnit,
          opexRatio,
          noi,
          noPerUnit,
          vals['cash_flow_before_tax'] ?? null,
        ]
      );

      // QA: NOI reconciliation
      if (noi != null) {
        console.log(`  ${periodMonth}: NOI=${noi.toFixed(2)}, GPR=${(vals['gross_potential_rent'] ?? 0).toFixed(2)}, OpEx=${(totalOpex ?? 0).toFixed(2)}`);
      }
    }

    await client.query('COMMIT');
    console.log(`[Financials→DB] ✓ Upserted ${monthMap.length} months into deal_monthly_actuals`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('[Financials→DB] Done');
  await pool.end();
}

main().catch(err => {
  console.error('[Financials→DB] FATAL:', err);
  process.exit(1);
});
