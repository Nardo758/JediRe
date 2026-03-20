import { query } from '../database/connection';
import { logger } from '../utils/logger';

const VALID_ACTUALS_COLUMNS = [
  'report_month', 'total_units', 'occupied_units', 'occupancy_rate',
  'avg_market_rent', 'avg_effective_rent', 'gross_potential_rent',
  'loss_to_lease', 'vacancy_loss', 'concessions', 'bad_debt',
  'net_rental_income', 'other_income', 'utility_reimbursement',
  'late_fees', 'misc_income', 'effective_gross_income',
  'payroll', 'repairs_maintenance', 'turnover_costs', 'marketing',
  'admin_general', 'management_fee', 'management_fee_pct', 'utilities',
  'contract_services', 'property_tax', 'insurance', 'hoa_condo_fees',
  'total_opex', 'noi', 'debt_service', 'debt_service_interest',
  'capex', 'capex_reserves', 'cash_flow_before_tax',
  'new_leases', 'renewals', 'move_outs', 'lease_trade_out',
  'avg_days_to_lease', 'adr', 'revpar', 'str_occupancy', 'str_revenue'
];

const COLUMN_ALIASES: Record<string, string> = {
  'month': 'report_month',
  'date': 'report_month',
  'period': 'report_month',
  'unit count': 'total_units',
  'physical units': 'total_units',
  'units': 'total_units',
  'occupied': 'occupied_units',
  'occupancy': 'occupancy_rate',
  'market rent': 'avg_market_rent',
  'market rent/unit': 'avg_market_rent',
  'asking rent': 'avg_market_rent',
  'effective rent': 'avg_effective_rent',
  'avg actual rent': 'avg_effective_rent',
  'gross potential': 'gross_potential_rent',
  'gpr': 'gross_potential_rent',
  'vacancy': 'vacancy_loss',
  'loss to lease': 'loss_to_lease',
  'gain/loss to lease': 'loss_to_lease',
  'concession': 'concessions',
  'write-offs': 'bad_debt',
  'bad debt expense': 'bad_debt',
  'other revenue': 'other_income',
  'utility reimb': 'utility_reimbursement',
  'utility recovery': 'utility_reimbursement',
  'rubs': 'utility_reimbursement',
  'total revenue': 'effective_gross_income',
  'egi': 'effective_gross_income',
  'salary/wages': 'payroll',
  'personnel': 'payroll',
  'repairs': 'repairs_maintenance',
  'r&m': 'repairs_maintenance',
  'maintenance': 'repairs_maintenance',
  'make ready': 'turnover_costs',
  'turn cost': 'turnover_costs',
  'advertising': 'marketing',
  'marketing/leasing': 'marketing',
  'office/admin': 'admin_general',
  'g&a': 'admin_general',
  'mgmt fee': 'management_fee',
  'contract svcs': 'contract_services',
  'contract': 'contract_services',
  'taxes': 'property_tax',
  're tax': 'property_tax',
  'total expenses': 'total_opex',
  'total operating': 'total_opex',
  'mortgage': 'debt_service',
  'capital': 'capex',
  'cash flow': 'cash_flow_before_tax',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

function matchColumn(header: string): string | null {
  const normalized = normalizeHeader(header);
  if (VALID_ACTUALS_COLUMNS.includes(normalized.replace(/\s/g, '_'))) {
    return normalized.replace(/\s/g, '_');
  }
  if (COLUMN_ALIASES[normalized]) {
    return COLUMN_ALIASES[normalized];
  }
  for (const [alias, target] of Object.entries(COLUMN_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return target;
    }
  }
  for (const col of VALID_ACTUALS_COLUMNS) {
    const colWords = col.replace(/_/g, ' ');
    if (normalized === colWords) return col;
  }
  return null;
}

export interface ColumnDetectionResult {
  sourceColumns: string[];
  mapping: Record<string, string>;
  unmapped: string[];
  confidence: number;
}

export interface UploadResult {
  uploadId: string;
  rowsTotal: number;
  rowsSucceeded: number;
  rowsFailed: number;
  errors: Array<{ row: number; error: string }>;
  dataStartDate: string | null;
  dataEndDate: string | null;
}

function parseCSVSync(text: string, delimiter: string): { headers: string[]; rows: Record<string, any>[] } {
  const { parse } = require('csv-parse/sync');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
  });
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

function parseFileToRows(buffer: Buffer, fileType: string): { headers: string[]; rows: Record<string, any>[] } {
  if (fileType === 'csv' || fileType === 'tsv') {
    const text = buffer.toString('utf-8');
    const delimiter = fileType === 'tsv' ? '\t' : ',';
    return parseCSVSync(text, delimiter);
  }

  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    return { headers, rows: data };
  } catch (err: any) {
    throw new Error(`Failed to parse Excel file: ${err.message}`);
  }
}

function parseDate(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-01`;
  }
  const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, '0')}-01`;
  }
  const monthYearMatch = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  if (monthYearMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const m = months[monthYearMatch[1].toLowerCase().substring(0, 3)];
    return `${monthYearMatch[2]}-${m}-01`;
  }
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
  }
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

class DataUploadService {
  async detectColumns(buffer: Buffer, fileType: string): Promise<ColumnDetectionResult> {
    const { headers } = parseFileToRows(buffer, fileType);
    const mapping: Record<string, string> = {};
    const unmapped: string[] = [];

    for (const header of headers) {
      const match = matchColumn(header);
      if (match) {
        mapping[header] = match;
      } else {
        unmapped.push(header);
      }
    }

    const totalRelevant = headers.length;
    const mapped = Object.keys(mapping).length;
    const confidence = totalRelevant > 0 ? Math.round((mapped / totalRelevant) * 100) : 0;

    return { sourceColumns: headers, mapping, unmapped, confidence };
  }

  async getTemplates(): Promise<any[]> {
    const result = await query(
      'SELECT id, name, source_format, column_mapping, description FROM upload_templates ORDER BY name'
    );
    return result.rows;
  }

  async getTemplate(sourceFormat: string): Promise<{ headers: string[]; mapping: Record<string, string> } | null> {
    const result = await query(
      'SELECT column_mapping FROM upload_templates WHERE source_format = $1',
      [sourceFormat]
    );
    if (result.rows.length === 0) return null;
    const mapping = result.rows[0].column_mapping;
    return { headers: Object.keys(mapping), mapping };
  }

  async processUpload(
    propertyId: string,
    userId: string,
    buffer: Buffer,
    fileType: string,
    originalFilename: string,
    columnMapping: Record<string, string>,
    isBudget: boolean = false
  ): Promise<UploadResult> {
    const { rows } = parseFileToRows(buffer, fileType);

    const uploadResult = await query(
      `INSERT INTO data_uploads (user_id, property_id, original_filename, file_size_bytes, file_type, column_mapping, status, rows_total)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7) RETURNING id`,
      [userId, propertyId, originalFilename, buffer.length, fileType, JSON.stringify(columnMapping), rows.length]
    );
    const uploadId = uploadResult.rows[0].id;

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];
    let startDate: string | null = null;
    let endDate: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      try {
        const sourceRow = rows[i];
        const mapped: Record<string, any> = {};

        for (const [sourceCol, targetCol] of Object.entries(columnMapping)) {
          if (sourceRow[sourceCol] !== undefined && sourceRow[sourceCol] !== null && sourceRow[sourceCol] !== '') {
            if (targetCol === 'report_month') {
              mapped[targetCol] = parseDate(sourceRow[sourceCol]);
            } else if (['total_units', 'occupied_units', 'new_leases', 'renewals', 'move_outs'].includes(targetCol)) {
              mapped[targetCol] = Math.round(parseNumber(sourceRow[sourceCol]) || 0);
            } else {
              mapped[targetCol] = parseNumber(sourceRow[sourceCol]);
            }
          }
        }

        if (!mapped.report_month) {
          errors.push({ row: i + 2, error: 'Missing or invalid report_month' });
          failed++;
          continue;
        }

        if (!startDate || mapped.report_month < startDate) startDate = mapped.report_month;
        if (!endDate || mapped.report_month > endDate) endDate = mapped.report_month;

        const cols = Object.keys(mapped).filter(k => VALID_ACTUALS_COLUMNS.includes(k) || k === 'report_month');
        const allCols = ['property_id', ...cols, 'data_source', 'upload_id', 'is_budget'];
        const allVals = [propertyId, ...cols.map(c => mapped[c]), 'csv_upload', uploadId, isBudget];
        const placeholders = allVals.map((_, idx) => `$${idx + 1}`);

        const upsertCols = cols.filter(c => c !== 'report_month');
        const updateSet = upsertCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

        await query(
          `INSERT INTO deal_monthly_actuals (${allCols.join(', ')})
           VALUES (${placeholders.join(', ')})
           ON CONFLICT (property_id, report_month, is_budget, is_proforma)
           DO UPDATE SET ${updateSet || 'updated_at = now()'}, data_source = EXCLUDED.data_source, upload_id = EXCLUDED.upload_id`,
          allVals
        );
        succeeded++;
      } catch (err: any) {
        errors.push({ row: i + 2, error: err.message });
        failed++;
      }
    }

    const status = failed === 0 ? 'completed' : (succeeded === 0 ? 'failed' : 'partial');
    await query(
      `UPDATE data_uploads SET status = $1, rows_succeeded = $2, rows_failed = $3, 
       error_log = $4, data_start_date = $5, data_end_date = $6, completed_at = now()
       WHERE id = $7`,
      [status, succeeded, failed, JSON.stringify(errors), startDate, endDate, uploadId]
    );

    return {
      uploadId,
      rowsTotal: rows.length,
      rowsSucceeded: succeeded,
      rowsFailed: failed,
      errors,
      dataStartDate: startDate,
      dataEndDate: endDate,
    };
  }

  async getActuals(propertyId: string, options: {
    startDate?: string;
    endDate?: string;
    isBudget?: boolean;
    limit?: number;
  } = {}): Promise<any[]> {
    const conditions = ['property_id = $1'];
    const params: any[] = [propertyId];
    let paramIdx = 2;

    if (options.startDate) {
      conditions.push(`report_month >= $${paramIdx}`);
      params.push(options.startDate);
      paramIdx++;
    }
    if (options.endDate) {
      conditions.push(`report_month <= $${paramIdx}`);
      params.push(options.endDate);
      paramIdx++;
    }
    if (options.isBudget !== undefined) {
      conditions.push(`is_budget = $${paramIdx}`);
      params.push(options.isBudget);
      paramIdx++;
    }

    const limit = options.limit || 120;
    const result = await query(
      `SELECT * FROM deal_monthly_actuals WHERE ${conditions.join(' AND ')} ORDER BY report_month DESC LIMIT ${limit}`,
      params
    );
    return result.rows;
  }

  async getUploadHistory(propertyId: string): Promise<any[]> {
    const result = await query(
      `SELECT id, original_filename, file_type, status, rows_total, rows_succeeded, rows_failed,
              data_start_date, data_end_date, source_format, created_at, completed_at
       FROM data_uploads WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId]
    );
    return result.rows;
  }

  async generateTemplateCSV(sourceFormat: string): Promise<string | null> {
    const template = await this.getTemplate(sourceFormat);
    if (!template) return null;
    return template.headers.join(',') + '\n';
  }
}

export const dataUploadService = new DataUploadService();
