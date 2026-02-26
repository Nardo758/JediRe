/**
 * JEDI RE: Data Upload Service
 * =============================
 * Place in: backend/src/services/uploadService.ts
 *
 * Handles CSV/Excel file uploads into deal_monthly_actuals.
 * 
 * Flow:
 *   1. parseFile() → read CSV/XLSX into row arrays
 *   2. detectFormat() → identify AppFolio/Yardi/RealPage/custom
 *   3. autoMapColumns() → fuzzy match source cols → target cols
 *   4. processRows() → clean, validate, insert into deal_monthly_actuals
 *
 * Dependencies: xlsx (SheetJS), drizzle-orm
 */

import * as XLSX from 'xlsx';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  dealMonthlyActuals,
  dataUploads,
  uploadTemplates,
  type NewDealMonthlyActual,
  type NewDataUpload,
} from '../db/schema/dataPipeline';

// =============================================================================
// Types
// =============================================================================

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  sampleValues: string[];
}

export interface UploadPreview {
  uploadId: string;
  filename: string;
  fileType: string;
  detectedFormat: string | null;
  totalRows: number;
  columnsFound: string[];
  suggestedMappings: ColumnMapping[];
  unmappedColumns: string[];
  dateRange: { start: string; end: string } | null;
  warnings: string[];
}

export interface ProcessResult {
  uploadId: string;
  status: 'completed' | 'partial' | 'failed';
  rowsTotal: number;
  rowsSucceeded: number;
  rowsFailed: number;
  errors: Array<{ row: number; error: string; rawMonth?: string }>;
  dateRange: { start: string; end: string } | null;
}

interface ParsedRow {
  [key: string]: string | number | null;
}

// =============================================================================
// Target Column Definitions
// =============================================================================

interface TargetColumnDef {
  type: 'date' | 'int' | 'decimal';
  required: boolean;
  label: string;
}

const TARGET_COLUMNS: Record<string, TargetColumnDef> = {
  report_month:           { type: 'date',    required: true,  label: 'Month/Period' },
  total_units:            { type: 'int',     required: false, label: 'Total Units' },
  occupied_units:         { type: 'int',     required: false, label: 'Occupied Units' },
  avg_market_rent:        { type: 'decimal', required: false, label: 'Avg Market Rent' },
  avg_effective_rent:     { type: 'decimal', required: false, label: 'Avg Effective Rent' },
  gross_potential_rent:   { type: 'decimal', required: false, label: 'Gross Potential Rent' },
  loss_to_lease:          { type: 'decimal', required: false, label: 'Loss to Lease' },
  vacancy_loss:           { type: 'decimal', required: false, label: 'Vacancy Loss' },
  concessions:            { type: 'decimal', required: false, label: 'Concessions' },
  bad_debt:               { type: 'decimal', required: false, label: 'Bad Debt' },
  net_rental_income:      { type: 'decimal', required: false, label: 'Net Rental Income' },
  other_income:           { type: 'decimal', required: false, label: 'Other Income' },
  utility_reimbursement:  { type: 'decimal', required: false, label: 'Utility Reimbursement' },
  late_fees:              { type: 'decimal', required: false, label: 'Late Fees' },
  misc_income:            { type: 'decimal', required: false, label: 'Misc Income' },
  effective_gross_income: { type: 'decimal', required: false, label: 'EGI' },
  payroll:                { type: 'decimal', required: false, label: 'Payroll' },
  repairs_maintenance:    { type: 'decimal', required: false, label: 'R&M' },
  turnover_costs:         { type: 'decimal', required: false, label: 'Turnover Costs' },
  marketing:              { type: 'decimal', required: false, label: 'Marketing' },
  admin_general:          { type: 'decimal', required: false, label: 'Admin/G&A' },
  management_fee:         { type: 'decimal', required: false, label: 'Management Fee' },
  utilities:              { type: 'decimal', required: false, label: 'Utilities' },
  contract_services:      { type: 'decimal', required: false, label: 'Contract Services' },
  property_tax:           { type: 'decimal', required: false, label: 'Property Tax' },
  insurance:              { type: 'decimal', required: false, label: 'Insurance' },
  hoa_condo_fees:         { type: 'decimal', required: false, label: 'HOA/Condo Fees' },
  total_opex:             { type: 'decimal', required: false, label: 'Total OpEx' },
  noi:                    { type: 'decimal', required: false, label: 'NOI' },
  debt_service:           { type: 'decimal', required: false, label: 'Debt Service' },
  capex:                  { type: 'decimal', required: false, label: 'CapEx' },
  capex_reserves:         { type: 'decimal', required: false, label: 'CapEx Reserves' },
  cash_flow_before_tax:   { type: 'decimal', required: false, label: 'Cash Flow' },
  new_leases:             { type: 'int',     required: false, label: 'New Leases' },
  renewals:               { type: 'int',     required: false, label: 'Renewals' },
  move_outs:              { type: 'int',     required: false, label: 'Move Outs' },
  lease_trade_out:        { type: 'decimal', required: false, label: 'Lease Trade-Out' },
  avg_days_to_lease:      { type: 'decimal', required: false, label: 'Avg Days to Lease' },
  adr:                    { type: 'decimal', required: false, label: 'ADR' },
  revpar:                 { type: 'decimal', required: false, label: 'RevPAR' },
  str_occupancy:          { type: 'decimal', required: false, label: 'STR Occupancy' },
  str_revenue:            { type: 'decimal', required: false, label: 'STR Revenue' },
};

// =============================================================================
// Column Alias Map (fuzzy matching)
// =============================================================================

const COLUMN_ALIASES: Record<string, string[]> = {
  report_month: ['month', 'date', 'period', 'reporting period', 'mo', 'month/year'],
  total_units: ['total units', 'unit count', 'units', 'physical units', '# units'],
  occupied_units: ['occupied', 'occupied units', 'occ units', 'leased units'],
  avg_market_rent: ['market rent', 'asking rent', 'market rent/unit', 'avg asking'],
  avg_effective_rent: ['effective rent', 'actual rent', 'avg actual rent', 'avg rent', 'in-place rent'],
  gross_potential_rent: ['gpr', 'gross potential', 'gross potential rent', 'gross rent'],
  loss_to_lease: ['loss to lease', 'ltl', 'gain/loss to lease', 'gain loss lease'],
  vacancy_loss: ['vacancy', 'vacancy loss', 'physical vacancy', 'vacancy $'],
  concessions: ['concessions', 'concession', 'free rent'],
  bad_debt: ['bad debt', 'write-offs', 'write offs', 'bad debt expense', 'uncollectable'],
  net_rental_income: ['net rental', 'net rental income', 'nri'],
  other_income: ['other income', 'other revenue', 'ancillary income', 'misc revenue'],
  utility_reimbursement: ['utility reimb', 'utility reimbursement', 'rubs', 'utility recovery'],
  late_fees: ['late fees', 'late charges'],
  effective_gross_income: ['egi', 'effective gross income', 'total revenue', 'total income', 'gross income'],
  payroll: ['payroll', 'salary', 'salary/wages', 'personnel', 'wages'],
  repairs_maintenance: ['r&m', 'repairs', 'repairs & maintenance', 'maintenance', 'repairs and maintenance'],
  turnover_costs: ['turnover', 'make ready', 'make-ready', 'turn cost', 'unit turn'],
  marketing: ['marketing', 'advertising', 'leasing', 'marketing/leasing'],
  admin_general: ['admin', 'g&a', 'admin/g&a', 'general & admin', 'office/admin', 'office'],
  management_fee: ['mgmt fee', 'management fee', 'management', 'pm fee'],
  utilities: ['utilities', 'utility expense', 'owner utilities'],
  contract_services: ['contract services', 'contract svcs', 'contract', 'contracted services'],
  property_tax: ['property tax', 'taxes', 're tax', 'real estate tax', 'property taxes'],
  insurance: ['insurance', 'ins', 'property insurance'],
  total_opex: ['total opex', 'total expenses', 'total operating', 'operating expenses', 'total exp'],
  noi: ['noi', 'net operating income', 'net income'],
  debt_service: ['debt service', 'mortgage', 'loan payment', 'ds', 'p&i'],
  capex: ['capex', 'capital', 'capital expenditures', 'capital improvements'],
  capex_reserves: ['reserves', 'capex reserves', 'replacement reserves'],
  cash_flow_before_tax: ['cash flow', 'btcf', 'net cash flow', 'cf before tax'],
  new_leases: ['new leases', 'new move-ins', 'move ins', 'new'],
  renewals: ['renewals', 'renewed', 'renewal'],
  move_outs: ['move outs', 'moveouts', 'move-outs', 'vacates'],
};

// =============================================================================
// Core Service Functions
// =============================================================================

/**
 * Parse a file buffer into an array of row objects.
 * Supports CSV, TSV, XLSX, XLS via SheetJS.
 */
export function parseFile(
  buffer: Buffer,
  filename: string,
): { rows: ParsedRow[]; columns: string[] } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  let workbook: XLSX.WorkBook;
  if (ext === 'csv') {
    workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  } else if (ext === 'tsv') {
    workbook = XLSX.read(buffer, { type: 'buffer', FS: '\t', raw: false });
  } else {
    // xlsx / xls
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File contains no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null });

  if (rows.length === 0) throw new Error('File contains no data rows');

  const columns = Object.keys(rows[0]);
  return { rows, columns };
}

/**
 * Detect PM software format based on column name signatures.
 */
export function detectFormat(columns: string[]): string | null {
  const colLower = new Set(columns.map((c) => c.toLowerCase().trim()));

  const appfolioSignals = ['gross potential', 'write-offs', 'make ready', 'salary/wages'];
  const yardiSignals = ['physical units', 'gain/loss to lease', 'egi', 'personnel'];
  const realpageSignals = ['market rent/unit', 'physical occupancy', 'net effective rent'];

  const matchCount = (signals: string[]) =>
    signals.filter((s) => colLower.has(s)).length;

  if (matchCount(appfolioSignals) >= 2) return 'appfolio';
  if (matchCount(yardiSignals) >= 2) return 'yardi';
  if (matchCount(realpageSignals) >= 2) return 'realpage';
  return null;
}

/**
 * Auto-map source columns to target columns using fuzzy alias matching.
 */
export function autoMapColumns(
  sourceColumns: string[],
  rows: ParsedRow[],
): { mapped: ColumnMapping[]; unmapped: string[] } {
  const mapped: ColumnMapping[] = [];
  const unmapped: string[] = [];
  const usedTargets = new Set<string>();

  for (const srcCol of sourceColumns) {
    const srcLower = srcCol.toLowerCase().trim();
    let bestMatch: string | null = null;

    for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (usedTargets.has(target)) continue;
      if (aliases.includes(srcLower) || srcLower === target) {
        bestMatch = target;
        break;
      }
    }

    if (bestMatch) {
      const samples = rows
        .slice(0, 3)
        .map((r) => String(r[srcCol] ?? ''))
        .filter(Boolean);

      mapped.push({
        sourceColumn: srcCol,
        targetColumn: bestMatch,
        sampleValues: samples,
      });
      usedTargets.add(bestMatch);
    } else {
      unmapped.push(srcCol);
    }
  }

  return { mapped, unmapped };
}

// =============================================================================
// Value Cleaning
// =============================================================================

/**
 * Parse various date formats into YYYY-MM-01 string.
 */
export function parseDate(val: unknown): string | null {
  if (val == null || val === '') return null;

  // If it's already a Date (SheetJS cellDates)
  if (val instanceof Date) {
    const d = val;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-01`;
  }

  const s = String(val).trim();
  if (!s) return null;

  // Try ISO: 2024-01-15 → 2024-01-01
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-01`;

  // Try US: 01/15/2024 or 1/15/2024
  const usMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-01`;

  // Try Mon YYYY: Jan 2024, January 2024
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const monMatch = s.match(/^([a-zA-Z]+)\s*[-/]?\s*(\d{4})/);
  if (monMatch) {
    const mon = monthNames[monMatch[1].substring(0, 3).toLowerCase()];
    if (mon) return `${monMatch[2]}-${mon}-01`;
  }

  // Try MM/YYYY
  const myMatch = s.match(/^(\d{1,2})[/-](\d{4})/);
  if (myMatch) return `${myMatch[2]}-${myMatch[1].padStart(2, '0')}-01`;

  return null;
}

/**
 * Clean currency/accounting strings into numbers.
 * '$1,234.56' → 1234.56, '(500)' → -500, '-' → null
 */
export function cleanNumeric(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : String(val);

  let s = String(val).trim();
  if (!s || s === '-' || s === '—' || s === 'N/A') return null;

  // Detect accounting negatives: (1,234)
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  } else if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }

  // Strip $, commas, spaces, %
  s = s.replace(/[$,%\s]/g, '');

  const num = parseFloat(s);
  if (isNaN(num)) return null;

  return String(negative ? -num : num);
}

// =============================================================================
// Row Processing
// =============================================================================

/**
 * Process parsed rows into deal_monthly_actuals insert objects.
 */
export function processRows(
  rows: ParsedRow[],
  columnMapping: Record<string, string>, // { sourceCol: targetCol }
  propertyId: string,
  uploadId: string,
  isBudget: boolean = false,
  dataSource: string = 'csv_upload',
): ProcessResult {
  // Invert: { targetCol: sourceCol }
  const targetToSource: Record<string, string> = {};
  for (const [src, tgt] of Object.entries(columnMapping)) {
    targetToSource[tgt] = src;
  }

  let rowsSucceeded = 0;
  let rowsFailed = 0;
  const errors: ProcessResult['errors'] = [];
  const processedDates: string[] = [];
  const insertRecords: NewDealMonthlyActual[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const record: Record<string, unknown> = {
        propertyId,
        uploadId,
        isBudget,
        isProforma: false,
        dataSource,
      };

      for (const [targetCol, meta] of Object.entries(TARGET_COLUMNS)) {
        const sourceCol = targetToSource[targetCol];
        if (!sourceCol || !(sourceCol in row)) continue;

        const rawVal = row[sourceCol];

        if (meta.type === 'date') {
          const parsed = parseDate(rawVal);
          if (!parsed && meta.required) {
            throw new Error(`Invalid date in column '${sourceCol}': ${rawVal}`);
          }
          record[camelCase(targetCol)] = parsed;
        } else if (meta.type === 'int') {
          const cleaned = cleanNumeric(rawVal);
          record[camelCase(targetCol)] = cleaned ? String(Math.round(parseFloat(cleaned))) : null;
        } else {
          record[camelCase(targetCol)] = cleanNumeric(rawVal);
        }
      }

      if (!record.reportMonth) {
        throw new Error('Missing or unparseable date');
      }

      insertRecords.push(record as unknown as NewDealMonthlyActual);
      processedDates.push(record.reportMonth as string);
      rowsSucceeded++;
    } catch (e) {
      rowsFailed++;
      const dateSource = targetToSource['report_month'];
      errors.push({
        row: i + 2, // +2 for header + 0-index
        error: e instanceof Error ? e.message : String(e),
        rawMonth: dateSource ? String(row[dateSource] ?? '') : undefined,
      });
    }
  }

  const dateRange = processedDates.length > 0
    ? {
        start: processedDates.sort()[0],
        end: processedDates.sort()[processedDates.length - 1],
      }
    : null;

  return {
    uploadId,
    status: rowsFailed === 0 ? 'completed' : rowsFailed === rows.length ? 'failed' : 'partial',
    rowsTotal: rows.length,
    rowsSucceeded,
    rowsFailed,
    errors: errors.slice(0, 50),
    dateRange,
    // Attach processed records for the caller to insert
    _records: insertRecords,
  } as ProcessResult & { _records: NewDealMonthlyActual[] };
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Insert processed records into deal_monthly_actuals.
 * Uses ON CONFLICT to upsert (update if same property+month+budget type exists).
 */
export async function insertActuals(
  db: NodePgDatabase<any>,
  records: NewDealMonthlyActual[],
): Promise<number> {
  if (records.length === 0) return 0;

  // Batch insert — Drizzle supports bulk insert
  const result = await db
    .insert(dealMonthlyActuals)
    .values(records)
    .onConflictDoUpdate({
      target: [
        dealMonthlyActuals.propertyId,
        dealMonthlyActuals.reportMonth,
        dealMonthlyActuals.isBudget,
        dealMonthlyActuals.isProforma,
      ],
      set: {
        // On conflict, update all financial fields
        totalUnits: sql`EXCLUDED.total_units`,
        occupiedUnits: sql`EXCLUDED.occupied_units`,
        avgMarketRent: sql`EXCLUDED.avg_market_rent`,
        avgEffectiveRent: sql`EXCLUDED.avg_effective_rent`,
        grossPotentialRent: sql`EXCLUDED.gross_potential_rent`,
        vacancyLoss: sql`EXCLUDED.vacancy_loss`,
        concessions: sql`EXCLUDED.concessions`,
        badDebt: sql`EXCLUDED.bad_debt`,
        netRentalIncome: sql`EXCLUDED.net_rental_income`,
        otherIncome: sql`EXCLUDED.other_income`,
        effectiveGrossIncome: sql`EXCLUDED.effective_gross_income`,
        totalOpex: sql`EXCLUDED.total_opex`,
        noi: sql`EXCLUDED.noi`,
        debtService: sql`EXCLUDED.debt_service`,
        capex: sql`EXCLUDED.capex`,
        cashFlowBeforeTax: sql`EXCLUDED.cash_flow_before_tax`,
        newLeases: sql`EXCLUDED.new_leases`,
        renewals: sql`EXCLUDED.renewals`,
        moveOuts: sql`EXCLUDED.move_outs`,
        dataSource: sql`EXCLUDED.data_source`,
        uploadId: sql`EXCLUDED.upload_id`,
        updatedAt: sql`now()`,
      },
    });

  return records.length;
}

/**
 * Create a data_uploads tracking record.
 */
export async function createUploadRecord(
  db: NodePgDatabase<any>,
  data: NewDataUpload,
): Promise<string> {
  const [record] = await db
    .insert(dataUploads)
    .values(data)
    .returning({ id: dataUploads.id });
  return record.id;
}

/**
 * Update upload record with processing results.
 */
export async function updateUploadRecord(
  db: NodePgDatabase<any>,
  uploadId: string,
  result: ProcessResult,
): Promise<void> {
  await db
    .update(dataUploads)
    .set({
      status: result.status,
      rowsTotal: result.rowsTotal,
      rowsSucceeded: result.rowsSucceeded,
      rowsFailed: result.rowsFailed,
      errorLog: result.errors,
      dataStartDate: result.dateRange?.start ?? null,
      dataEndDate: result.dateRange?.end ?? null,
      completedAt: new Date(),
    })
    .where(eq(dataUploads.id, uploadId));
}

// =============================================================================
// Helpers
// =============================================================================

/** Convert snake_case to camelCase for Drizzle column names */
function camelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
