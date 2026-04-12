import * as XLSX from 'xlsx';
import { T12Data, T12Month, ExtractionResult } from '../types';
import { findHeaderRow, parseSheetFromRow, parseNum } from './workbook-utils';
import type { ChartFormat } from '../types';

// ============================================================================
// T12 Parser v2 — Yardi-aware, description-driven categorization
// Replaces legacy parser that read from GL-code column (wrong field).
//
// Key behavioral changes:
//   1. Detects chart_format up-front (yardi_accrual / generic_columnar)
//   2. Uses DESCRIPTION column for category matching (not GL code)
//   3. GL code is secondary signal only, with proper 3+5 digit map
//   4. Skips group-header rows ("INCOME", "EXPENSES") via indent + null-row detection
//   5. Skips subtotal rows (description starts with "Total" or has -099/-098/-099 GL suffix)
//   6. Parses BOTH 41xxx GPR/LTL/Vacancy/Concessions/Bad-Debt AND 5xxxx-6xxxx OpEx
//   7. Pulls HOA dues out of G&A as separate field (common for condo-association props)
//   8. Records `insurance: null` and emits warning when no insurance line found
// ============================================================================

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Description-keyed categorization. Order matters: more specific patterns first.
 * Each entry maps a regex to (category, exclude-from-rollup-flag).
 * `excludeFromRollup=true` means it's a subtotal/total row that should NOT be
 * summed — it's already the sum of its children.
 */
interface CategoryRule {
  pattern: RegExp;
  field: keyof T12Month | 'hoaDues' | 'amenities' | 'turnover' | 'concessionsOneTime' | 'concessionsRenewal' | 'badDebtRecovery' | 'nonRevenueUnits' | 'skip' | 'isSubtotal' | 'isHeader';
  isSubtotal?: boolean;
  isHeader?: boolean;
}

const RULES: CategoryRule[] = [
  // ─── Subtotals & headers (must come first to be detected and skipped) ───
  { pattern: /^total\s+(other\s+)?rental\s+inc/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+other\s+inc/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+residential\s*&?\s*commercial\s+income/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+income/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+payroll/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+repairs/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+make[\s-]*ready/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+recreational/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+contract/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+general\s+maintenance/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+(other\s+)?(advertising|marketing)/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+office/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+(other\s+)?general\s*&?\s*admin/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+utilities/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+management\s+fee/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+taxes/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+(non\s*recoverable\s+)?operating\s+expense/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^total\s+expense/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^net\s+operating\s+income\s*$/i, field: 'noi', isSubtotal: true },
  { pattern: /^potential\s+rent\s*$/i, field: 'isSubtotal', isSubtotal: true },
  { pattern: /^(income|expenses?|revenue)\s*$/i, field: 'isHeader', isHeader: true },
  { pattern: /^rental\s+income\s*-?\s*residential\s*$/i, field: 'isHeader', isHeader: true },
  { pattern: /^other\s+rental\s+income/i, field: 'isHeader', isHeader: true },
  { pattern: /^other\s+income\s*-?\s*residential\s*$/i, field: 'isHeader', isHeader: true },
  { pattern: /^payroll\s*&?\s*benefits\s*$/i, field: 'isHeader', isHeader: true },
  { pattern: /^general\s+maintenance\s+expense\s*$/i, field: 'isHeader', isHeader: true },
  // NOTE: We intentionally do NOT have text-based header rules for category-level
  // headers like "Management Fees" or "Taxes" because Yardi reuses the SAME
  // description text for the section header AND the underlying line item.
  // Header detection happens via the row-content check (all-month-cols-null) above.

  // ─── Revenue line items ───
  { pattern: /\bmarket\s+rent\b/i, field: 'grossPotentialRent' },
  { pattern: /^gross\s+potential\s+rent\b/i, field: 'grossPotentialRent' },
  { pattern: /^(gain[\s/]*)?loss\s+to\s+lease\b/i, field: 'lossToLease' },
  { pattern: /\bvacancy\s+loss\b/i, field: 'vacancyLoss' },
  { pattern: /^vacancy\s*$/i, field: 'vacancyLoss' },
  { pattern: /\bone[\s-]*time\s+concession/i, field: 'concessionsOneTime' },
  { pattern: /\brenewal\s+concession/i, field: 'concessionsRenewal' },
  { pattern: /\bconcessions?\b/i, field: 'concessions' },
  { pattern: /\b(employee|courtesy\s+officer|model\s*&?\s*storage)\s+units?\b/i, field: 'nonRevenueUnits' },
  { pattern: /\bbad\s+debt\s+recovery\b/i, field: 'badDebtRecovery' },
  { pattern: /\bbad\s+debt\b/i, field: 'badDebt' },
  { pattern: /\bnet\s+rental\s+income\b/i, field: 'netRentalIncome', isSubtotal: true },

  // ─── Other income items (all map to otherIncome bucket; charge-code captured separately) ───
  { pattern: /\b(parking|carport|garage)\b/i, field: 'otherIncome' },
  { pattern: /\bpet\s+(rent|fees?)\b/i, field: 'otherIncome' },
  { pattern: /\bstorage\s+rent\b/i, field: 'otherIncome' },
  { pattern: /\b(water|sewer|gas|electric)\s+rebill\b/i, field: 'utilityReimbursement' },
  { pattern: /\bresident\s+utility\s+passthrough\b/i, field: 'utilityReimbursement' },
  { pattern: /\b(late\s+charge|late\s+fees?|nsf\s+fees?)\b/i, field: 'lateFees' },
  { pattern: /\b(application\s+fees?|administrative\s+fees?|admin\s+fees?)\b/i, field: 'otherIncome' },
  { pattern: /\b(eviction\s+fees?|legal\s+fees?)\b/i, field: 'otherIncome' },
  { pattern: /\b(month[\s-]*to[\s-]*month|mtm)\s+premium/i, field: 'otherIncome' },
  { pattern: /\b(damages|deposit\s+forfeitures?|transfer\s+fees?|lease\s+cancellation)\b/i, field: 'otherIncome' },
  { pattern: /\b(liability\s+insurance\s+fees?|renter'?s?\s+insurance\s+fees?)\b/i, field: 'otherIncome' },
  { pattern: /\b(concierge|guest\s+services|locks?\s*\/?\s*key|vendor\s+rebates|miscellaneous\s+income)\b/i, field: 'miscIncome' },

  // ─── OpEx — Payroll & Benefits ───
  { pattern: /\b(salaries|salary|bonuses|payroll\s+taxes?|workers\s+comp|401k|employee\s+burden|group\s+insurance|maintenance\s+manager)\b/i, field: 'payroll' },

  // ─── OpEx — R&M (separate from turnover/make-ready) ───
  { pattern: /\b(access\s+gate|appliance\s+repair|building\s*-?\s*interior|cleaning\s*&?\s*supplies|common\s+area\s+repair|electrical\s+supplies|elevator\s+repairs?|hvac|lighting|locks?\s*&?\s*keys|maintenance\s+supplies|painting\s+supplies|plumbing|preventative\s+maintenance|safety\s*&?\s*fire|small\s+tools|water\s+penetration|miscellaneous\s+supplies)\b/i, field: 'repairsMaintenance' },

  // ─── OpEx — Make-Ready / Turnover ───
  { pattern: /\b(carpet\s+cleaning|paint\s+contractor|make[\s-]*ready)\b/i, field: 'turnover' },

  // ─── OpEx — Recreational Amenities ───
  { pattern: /\b(pool\s+supplies|recreational|amenity)\b/i, field: 'amenities' },

  // ─── OpEx — Contract Services ───
  { pattern: /\b(cable\s+tv\s+contract|elevator\s+contract|equipment\s+contract|fire\s+alarm|fire\s+protection|janitorial|landscape|pest\s+control|trash\s+removal)\b/i, field: 'contractServices' },

  // ─── OpEx — Marketing ───
  { pattern: /\b(visual\s+(and|&)\s+creative|search\s+engine\s+marketing|internet\s+listing|property\s+website|social\s+media|reputation\s+management|printing\s+costs?|outreach|promotional\s+signage|locator|referral|strategic\s+marketing|tour\s+experience|prospect\s+refreshments|resident\s+activities|resident\s+retention|shopping\s+reports|satisfaction\s+survey)\b/i, field: 'marketing' },

  // ─── OpEx — Office (rolls up into G&A but tracked separately when present) ───
  { pattern: /\b(business.*automation|revenue\s+management|leasing\s+automation|office\s+supplies|cellular\s+phones?|postage|printing\s+expense|resident\s+screening|telephone|software\s+licenses)\b/i, field: 'adminGeneral' },

  // ─── OpEx — HOA dues (carved out from G&A) ───
  { pattern: /\b(homeowner'?s?\s+assoc|hoa\s+dues|condo\s+assoc)/i, field: 'hoaDues' },

  // ─── OpEx — General & Admin ───
  { pattern: /\b(administrative.*fees?|accounting\s+fees?|assoc.*fees?|membership\s+dues|bank\s+charges|computer\s+expense|employee\s+meetings?|recruitment|recognition|entertainment|internet\s+access|music.*licensing|licenses.*permits|ops\s+technology|training|seminars|uniform|miscellaneous\s+general|miscellaneous\s+admin)\b/i, field: 'adminGeneral' },

  // ─── OpEx — Utilities ───
  { pattern: /\b(electric\b(?!\s+rebill)|gas\b(?!\s+rebill)|water[\s/]*sewer|water\s+\(only\)|sewer\s+\(only\)|water\s*-?\s*irrigation|other\s+utilities|utility\s+rebill\s+service)/i, field: 'utilities' },

  // ─── OpEx — Management Fee ───
  { pattern: /\bmanagement\s+fees?\b/i, field: 'managementFee' },

  // ─── OpEx — Taxes (real estate vs personal property) ───
  { pattern: /\b(ad\s+valorem|real\s+estate\s+tax|property\s+tax(?!\s+es))/i, field: 'propertyTax' },
  { pattern: /\bpersonal\s+property\s+tax/i, field: 'propertyTax' },  // bundled into propertyTax
  { pattern: /\btaxes?\s*$/i, field: 'propertyTax' },

  // ─── OpEx — Insurance (property, not employee-group) ───
  { pattern: /\bproperty\s+insurance\b/i, field: 'insurance' },
  { pattern: /\binsurance\s*-?\s*property\b/i, field: 'insurance' },
  // Note: "Group Insurance" intentionally NOT matched — it's payroll
];

interface ExtendedT12Month extends T12Month {
  hoaDues?: number | null;
  amenities?: number | null;
  turnover?: number | null;
  concessionsOneTime?: number | null;
  concessionsRenewal?: number | null;
  badDebtRecovery?: number | null;
  nonRevenueUnits?: number | null;
}

function createEmptyMonth(reportMonth: string): ExtendedT12Month {
  return {
    reportMonth,
    grossPotentialRent: null, lossToLease: null, vacancyLoss: null, concessions: null,
    badDebt: null, netRentalIncome: null, otherIncome: null, utilityReimbursement: null,
    lateFees: null, miscIncome: null, effectiveGrossIncome: null, payroll: null,
    repairsMaintenance: null, turnoverCosts: null, marketing: null, adminGeneral: null,
    managementFee: null, utilities: null, contractServices: null, propertyTax: null,
    insurance: null, totalOpex: null, noi: null, totalUnits: null, occupiedUnits: null,
    hoaDues: null, amenities: null, turnover: null,
    concessionsOneTime: null, concessionsRenewal: null,
    badDebtRecovery: null, nonRevenueUnits: null,
  };
}

function detectChartFormat(headers: string[], rows: Record<string, any>[]): ChartFormat {
  // Yardi signature: first two columns are __EMPTY/__EMPTY_1 (because GL+desc are unlabeled),
  // and the first GL code matches /^\d{5}-\d{3}$/
  const looksLikeYardi =
    headers.length >= 2 &&
    /^_+EMPTY/.test(headers[0]) &&
    rows.some(r => typeof r[headers[0]] === 'string' && /^\d{5}-\d{3}/.test(String(r[headers[0]]).trim()));

  if (looksLikeYardi) return 'yardi_accrual';

  // RealPage often has a "Description" column
  if (headers.some(h => /^description$/i.test(h))) return 'realpage';

  return 'generic_columnar';
}

/**
 * Identifies (codeCol, descCol) given headers + sample rows.
 * Description column is the one with strings that don't look like codes/numbers/dates.
 */
function identifyCodeAndDescColumns(
  headers: string[],
  rows: Record<string, any>[]
): { codeCol: string | null; descCol: string | null } {
  let codeCol: string | null = null;
  let descCol: string | null = null;

  for (const h of headers) {
    const sample = rows.slice(0, 50).map(r => r[h]).filter(v => v != null && String(v).trim());
    if (sample.length === 0) continue;

    const stringSample = sample.filter(v => typeof v === 'string').map(v => String(v).trim());
    if (stringSample.length < sample.length * 0.5) continue;  // mostly numbers, skip

    const codeRatio = stringSample.filter(s => /^\d{4,6}-\d{2,4}$/.test(s)).length / stringSample.length;
    if (codeRatio > 0.5 && !codeCol) {
      codeCol = h;
      continue;
    }

    const wordRatio = stringSample.filter(s => /[a-zA-Z]{3,}/.test(s)).length / stringSample.length;
    if (wordRatio > 0.5 && !descCol) {
      descCol = h;
    }
  }

  return { codeCol, descCol };
}

function detectMonthColumns(headers: string[]): Array<{ header: string; month: string }> {
  const results: Array<{ header: string; month: string }> = [];
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    // Skip "Total" / "YTD" / "Budget" columns
    if (/^(total|ytd|budget|prior|variance|annual|year)\b/i.test(lower)) continue;

    const dateMatch = lower.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dateMatch) {
      const yr = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      const monthNum = dateMatch[1].padStart(2, '0');
      results.push({ header, month: `${yr}-${monthNum}-01` });
      continue;
    }

    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const monthAbbr = MONTH_NAMES[i];
      const re = new RegExp(`\\b${monthAbbr}[a-z]*[\\s\\-/_]+(\\d{2,4})\\b`, 'i');
      const match = lower.match(re);
      if (match) {
        const year = match[1].length === 2 ? `20${match[1]}` : match[1];
        const monthNum = String(i + 1).padStart(2, '0');
        results.push({ header, month: `${year}-${monthNum}-01` });
        break;
      }
    }
  }
  return results;
}

/**
 * Categorize a single description string. Returns (field, isSubtotal, isHeader).
 */
function categorize(desc: string, glCode: string | null): {
  field: string | null;
  isSubtotal: boolean;
  isHeader: boolean;
} {
  if (!desc || !desc.trim()) return { field: null, isSubtotal: false, isHeader: false };

  const cleaned = desc.trim();

  // GL-suffix subtotal detection (Yardi convention: -098, -099, -199, -990, -999 are rollups)
  if (glCode && /-(0?9[89]|199|9[89]9)\b/.test(glCode)) {
    return { field: null, isSubtotal: true, isHeader: false };
  }

  for (const rule of RULES) {
    if (rule.pattern.test(cleaned)) {
      if (rule.isHeader) return { field: null, isSubtotal: false, isHeader: true };
      if (rule.isSubtotal) return { field: rule.field === 'noi' ? 'noi' : null, isSubtotal: true, isHeader: false };
      return { field: rule.field as string, isSubtotal: false, isHeader: false };
    }
  }

  return { field: null, isSubtotal: false, isHeader: false };
}

/**
 * Add a value into a monthly bucket, summing if a value already exists.
 * (Multiple GL lines can map to the same field — e.g., Concessions = OneTime + Renewal.)
 */
function addToMonth(month: ExtendedT12Month, field: string, value: number): void {
  if (!(field in month)) return;
  const rec = month as unknown as Record<string, number | null>;
  rec[field] = (rec[field] ?? 0) + value;
}

/**
 * CANONICAL_GL_MAP — exported reference mapping canonical field names to their
 * GL category metadata. Used by `getDealFinancials` to enrich year1 rows with
 * stable field identifiers and revenue/expense classification.
 *
 * Fields are aligned with T12Month keys; additional fields (egi, noi, total_opex)
 * are derived/rollup fields that do not appear directly in raw T-12 data.
 */
export const CANONICAL_GL_MAP: Record<string, {
  label: string;
  category: 'revenue' | 'expense' | 'rollup';
  controllable: boolean;
  glCodeRange: string | null;
  unit: 'dollars' | 'percent' | 'units';
}> = {
  gpr:                    { label: 'Gross Potential Rent',     category: 'revenue',  controllable: false, glCodeRange: '41000-41099', unit: 'dollars' },
  loss_to_lease_pct:      { label: 'Loss to Lease',            category: 'revenue',  controllable: false, glCodeRange: '41100-41199', unit: 'percent' },
  vacancy_pct:            { label: 'Vacancy',                  category: 'revenue',  controllable: false, glCodeRange: '41200-41299', unit: 'percent' },
  concessions_pct:        { label: 'Concessions',              category: 'revenue',  controllable: true,  glCodeRange: '41300-41399', unit: 'percent' },
  bad_debt_pct:           { label: 'Bad Debt',                 category: 'revenue',  controllable: true,  glCodeRange: '41400-41499', unit: 'percent' },
  non_revenue_units_pct:  { label: 'Non-Revenue Units',        category: 'revenue',  controllable: false, glCodeRange: '41500-41599', unit: 'percent' },
  other_income_per_unit:  { label: 'Other Income',             category: 'revenue',  controllable: false, glCodeRange: '41600-41999', unit: 'dollars' },
  net_rental_income:      { label: 'Net Rental Income',        category: 'rollup',   controllable: false, glCodeRange: null,          unit: 'dollars' },
  egi:                    { label: 'Effective Gross Income',   category: 'rollup',   controllable: false, glCodeRange: null,          unit: 'dollars' },
  payroll:                { label: 'Payroll & Benefits',       category: 'expense',  controllable: true,  glCodeRange: '50000-51999', unit: 'dollars' },
  repairs_maintenance:    { label: 'Repairs & Maintenance',    category: 'expense',  controllable: true,  glCodeRange: '52000-53999', unit: 'dollars' },
  turnover:               { label: 'Turnover / Make Ready',    category: 'expense',  controllable: true,  glCodeRange: '54000-54999', unit: 'dollars' },
  contract_services:      { label: 'Contract Services',        category: 'expense',  controllable: true,  glCodeRange: '55000-55999', unit: 'dollars' },
  marketing:              { label: 'Marketing',                category: 'expense',  controllable: true,  glCodeRange: '56000-56999', unit: 'dollars' },
  utilities:              { label: 'Utilities',                category: 'expense',  controllable: false, glCodeRange: '57000-57999', unit: 'dollars' },
  g_and_a:                { label: 'G&A / Administration',    category: 'expense',  controllable: true,  glCodeRange: '58000-58999', unit: 'dollars' },
  management_fee_pct:     { label: 'Management Fee',          category: 'expense',  controllable: false, glCodeRange: '59000-59099', unit: 'percent' },
  insurance:              { label: 'Property Insurance',       category: 'expense',  controllable: false, glCodeRange: '60000-60999', unit: 'dollars' },
  real_estate_tax:        { label: 'Real Estate Tax',          category: 'expense',  controllable: false, glCodeRange: '61000-61999', unit: 'dollars' },
  replacement_reserves:   { label: 'Replacement Reserves',    category: 'expense',  controllable: false, glCodeRange: '62000-62999', unit: 'dollars' },
  total_opex:             { label: 'Total Operating Expenses', category: 'rollup',   controllable: false, glCodeRange: null,          unit: 'dollars' },
  noi:                    { label: 'Net Operating Income',     category: 'rollup',   controllable: false, glCodeRange: null,          unit: 'dollars' },
};

export function parseT12(buffer: Buffer, filename: string): ExtractionResult & { chartFormat?: ChartFormat } {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Detect header row: prefer rows with multiple month abbreviations OR explicit period labels
    const T12_HEADER_PATTERNS = [
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,
      /\b(total|period)\b/i,
    ];
    const headerRow = findHeaderRow(sheet, T12_HEADER_PATTERNS, 25, 2);
    const { headers, rows } = parseSheetFromRow(sheet, headerRow);

    if (rows.length === 0) {
      return { documentType: 'T12', success: false, error: 'No data rows found below detected header', data: null, summary: {}, warnings };
    }

    const chartFormat = detectChartFormat(headers, rows);
    const { codeCol, descCol } = identifyCodeAndDescColumns(headers, rows);

    if (!descCol) {
      return {
        documentType: 'T12',
        success: false,
        error: 'Could not identify description column (no column had >50% text values)',
        data: null,
        summary: {},
        warnings,
        chartFormat,
      };
    }

    const monthCols = detectMonthColumns(headers);
    if (monthCols.length === 0) {
      return {
        documentType: 'T12',
        success: false,
        error: 'No monthly period columns detected',
        data: null,
        summary: {},
        warnings,
        chartFormat,
      };
    }

    // Build empty months
    const months: Map<string, ExtendedT12Month> = new Map();
    for (const mc of monthCols) {
      months.set(mc.month, createEmptyMonth(mc.month));
    }

    let foundInsurance = false;
    let foundHoaDues = false;
    let categorizedRows = 0;
    let skippedSubtotalRows = 0;
    let skippedHeaderRows = 0;

    for (const row of rows) {
      const desc = String(row[descCol] ?? '').trim();
      const glCode = codeCol ? String(row[codeCol] ?? '').trim() : null;

      // Empty-row guard
      if (!desc && !glCode) continue;

      // ROW-CONTENT-BASED HEADER DETECTION (more reliable than text-based)
      // Yardi convention: section header rows have a description but ALL monthly
      // columns are null. Line-item rows always have at least one numeric value
      // across the period. This correctly distinguishes "  Management Fees" (header)
      // from "    Management Fees" (line item with same text).
      const hasAnyMonthValue = monthCols.some(mc => parseNum(row[mc.header]) != null);
      const totalCellRaw = row['Total'];
      const hasTotalValue = totalCellRaw != null && parseNum(totalCellRaw) != null;

      if (!hasAnyMonthValue && !hasTotalValue) {
        skippedHeaderRows++;
        continue;
      }

      const { field, isSubtotal, isHeader } = categorize(desc, glCode);

      if (isHeader) {
        skippedHeaderRows++;
        continue;
      }

      if (isSubtotal) {
        skippedSubtotalRows++;
        // Only NOI subtotal is captured — others are sums of children we already have
        if (field === 'noi') {
          for (const mc of monthCols) {
            const v = parseNum(row[mc.header]);
            const m = months.get(mc.month)!;
            if (v != null) m.noi = v;
          }
        }
        continue;
      }

      if (!field) continue;

      if (field === 'insurance') foundInsurance = true;
      if (field === 'hoaDues') foundHoaDues = true;

      categorizedRows++;
      for (const mc of monthCols) {
        const v = parseNum(row[mc.header]);
        if (v == null) continue;
        addToMonth(months.get(mc.month)!, field, v);
      }
    }

    // Roll up extended fields into the canonical T12Month shape
    const monthArr = Array.from(months.values()).sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));

    for (const m of monthArr) {
      // Concessions = oneTime + renewal (if either exists, override the bucket)
      if (m.concessionsOneTime != null || m.concessionsRenewal != null) {
        m.concessions = (m.concessionsOneTime ?? 0) + (m.concessionsRenewal ?? 0);
      }

      // Bad debt net = badDebt + recovery (recovery is positive; bad debt is negative)
      if (m.badDebtRecovery != null) {
        m.badDebt = (m.badDebt ?? 0) + m.badDebtRecovery;
      }

      // Net Rental Income — derive if not directly set
      if (m.netRentalIncome == null) {
        const gpr = m.grossPotentialRent ?? 0;
        const ltl = m.lossToLease ?? 0;          // negative
        const vac = m.vacancyLoss ?? 0;          // negative
        const conc = m.concessions ?? 0;         // negative
        const bd = m.badDebt ?? 0;               // negative
        const nru = m.nonRevenueUnits ?? 0;      // negative
        if (gpr > 0) m.netRentalIncome = gpr + ltl + vac + conc + bd + nru;
      }

      // EGI = NRI + Other Income components
      if (m.effectiveGrossIncome == null) {
        const nri = m.netRentalIncome ?? 0;
        const oi = (m.otherIncome ?? 0) + (m.utilityReimbursement ?? 0) +
                   (m.lateFees ?? 0) + (m.miscIncome ?? 0);
        if (nri > 0 || oi > 0) m.effectiveGrossIncome = nri + oi;
      }

      // Total OpEx — sum all categorized expense buckets
      if (m.totalOpex == null) {
        const opex = (m.payroll ?? 0) + (m.repairsMaintenance ?? 0) + (m.turnover ?? 0) +
                     (m.amenities ?? 0) + (m.contractServices ?? 0) + (m.marketing ?? 0) +
                     (m.adminGeneral ?? 0) + (m.hoaDues ?? 0) + (m.utilities ?? 0) +
                     (m.managementFee ?? 0) + (m.propertyTax ?? 0) + (m.insurance ?? 0);
        if (opex > 0) m.totalOpex = opex;
      }

      // Map turnover → turnoverCosts (legacy schema field)
      if (m.turnover != null && m.turnoverCosts == null) m.turnoverCosts = m.turnover;

      // NOI fallback
      if (m.noi == null) {
        const egi = m.effectiveGrossIncome ?? 0;
        const opex = m.totalOpex ?? 0;
        if (egi > 0) m.noi = egi - opex;
      }
    }

    // Summary aggregates (annual totals)
    const t12GPR = monthArr.reduce((s, m) => s + (m.grossPotentialRent ?? 0), 0);
    const t12NRI = monthArr.reduce((s, m) => s + (m.netRentalIncome ?? 0), 0);
    const t12Revenue = monthArr.reduce((s, m) => s + (m.effectiveGrossIncome ?? 0), 0);
    const t12OpEx = monthArr.reduce((s, m) => s + (m.totalOpex ?? 0), 0);
    const t12NOI = monthArr.reduce((s, m) => s + (m.noi ?? 0), 0);
    const t12LTL = monthArr.reduce((s, m) => s + (m.lossToLease ?? 0), 0);
    const t12Vacancy = monthArr.reduce((s, m) => s + (m.vacancyLoss ?? 0), 0);
    const t12Concessions = monthArr.reduce((s, m) => s + (m.concessions ?? 0), 0);
    const t12BadDebt = monthArr.reduce((s, m) => s + (m.badDebt ?? 0), 0);
    const t12Tax = monthArr.reduce((s, m) => s + (m.propertyTax ?? 0), 0);
    const t12Mgmt = monthArr.reduce((s, m) => s + (m.managementFee ?? 0), 0);
    const t12HoaDues = monthArr.reduce((s, m) => s + (m.hoaDues ?? 0), 0);

    const expenseRatio = t12Revenue > 0 ? t12OpEx / t12Revenue : 0;
    const noiMargin = t12Revenue > 0 ? t12NOI / t12Revenue : 0;
    const mgmtFeePct = t12Revenue > 0 ? t12Mgmt / t12Revenue : 0;

    // Quality warnings
    if (!foundInsurance) {
      warnings.push('No property insurance line found in T12 — proforma should use platform baseline');
    }
    if (foundHoaDues && t12HoaDues > 0) {
      warnings.push(`HOA dues of $${Math.round(t12HoaDues).toLocaleString()} found — confirm property is part of master association`);
    }
    if (monthArr.length < 12) {
      warnings.push(`Only ${monthArr.length} months captured (expected 12)`);
    }
    if (categorizedRows < 10) {
      warnings.push(`Only ${categorizedRows} GL lines categorized — possible chart-of-accounts mismatch`);
    }

    // Hard-fail check
    if (t12Revenue === 0 && t12OpEx === 0 && t12NOI === 0) {
      return {
        documentType: 'T12',
        success: false,
        error: `Categorization yielded zero financials (${categorizedRows} rows categorized, ${skippedSubtotalRows} subtotals skipped, format=${chartFormat})`,
        data: null,
        summary: {},
        warnings,
        chartFormat,
      };
    }

    const data: T12Data = {
      months: monthArr as T12Month[],
      summary: {
        t12Revenue,
        t12OpEx,
        t12NOI,
        expenseRatio,
        impliedOccupancy: null,
        totalUnits: null,
        periodStart: monthArr[0]?.reportMonth || '',
        periodEnd: monthArr[monthArr.length - 1]?.reportMonth || '',
      },
    };

    return {
      documentType: 'T12',
      success: true,
      data,
      summary: {
        ...data.summary,
        // Extended summary fields exposed for capsule mapping
        chartFormat,
        gpr: t12GPR,
        netRentalIncome: t12NRI,
        lossToLease: t12LTL,
        vacancyLoss: t12Vacancy,
        concessions: t12Concessions,
        badDebt: t12BadDebt,
        propertyTax: t12Tax,
        managementFee: t12Mgmt,
        hoaDues: t12HoaDues,
        noiMargin,
        mgmtFeePctOfEgi: mgmtFeePct,
        insuranceMissing: !foundInsurance,
        categorizedRows,
        skippedSubtotalRows,
      },
      warnings,
      chartFormat,
    };
  } catch (err) {
    return {
      documentType: 'T12',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null,
      summary: {},
      warnings,
    };
  }
}
