/**
 * BPI Financial Package Parser
 * 
 * Parses Bell Partners Inc (BPI) Financial Package Excel files.
 * These are comprehensive monthly reports containing P&L, Balance Sheet, and Cash Flow data.
 * 
 * Expected sheets: Income Statement, Balance Sheet, Statement of Cash Flows
 */

import * as XLSX from 'xlsx';
import { ExtractionResult } from '../types';
import { findHeaderRow, parseSheetFromRow, parseNum, parseDate } from './workbook-utils';

export interface BPIFinancialData {
  propertyCode: string;
  reportMonth: string;
  
  // Income
  grossPotentialRent: number | null;
  lossToLease: number | null;
  vacancyLoss: number | null;
  concessions: number | null;
  badDebt: number | null;
  otherIncome: number | null;
  effectiveGrossIncome: number | null;
  
  // Expenses by category
  payroll: number | null;
  repairsMaintenance: number | null;
  turnoverCosts: number | null;
  contractServices: number | null;
  utilities: number | null;
  marketing: number | null;
  adminGeneral: number | null;
  managementFee: number | null;
  propertyTax: number | null;
  insurance: number | null;
  totalOpex: number | null;
  
  // Results
  noi: number | null;
  debtService: number | null;
  capex: number | null;
  cashFlowBeforeTax: number | null;
  
  // Balance Sheet
  cash: number | null;
  accountsReceivable: number | null;
  prepaidExpenses: number | null;
  totalAssets: number | null;
  accountsPayable: number | null;
  securityDeposits: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  
  // Occupancy
  totalUnits: number | null;
  occupiedUnits: number | null;
  occupancyRate: number | null;
  avgEffectiveRent: number | null;
  avgMarketRent: number | null;
}

// Line item patterns for categorization
const LINE_PATTERNS: { pattern: RegExp; field: keyof BPIFinancialData }[] = [
  // Revenue
  { pattern: /gross\s+potential\s+rent|market\s+rent/i, field: 'grossPotentialRent' },
  { pattern: /loss\s+to\s+lease/i, field: 'lossToLease' },
  { pattern: /vacancy\s+(loss)?/i, field: 'vacancyLoss' },
  { pattern: /concession/i, field: 'concessions' },
  { pattern: /bad\s+debt/i, field: 'badDebt' },
  { pattern: /other\s+(rental\s+)?income/i, field: 'otherIncome' },
  { pattern: /effective\s+gross\s+income|total\s+income/i, field: 'effectiveGrossIncome' },
  
  // Expenses
  { pattern: /payroll|salaries|wages|benefits/i, field: 'payroll' },
  { pattern: /repairs?\s*(and|&)?\s*maintenance/i, field: 'repairsMaintenance' },
  { pattern: /turnover|make[\s-]?ready/i, field: 'turnoverCosts' },
  { pattern: /contract\s+services?/i, field: 'contractServices' },
  { pattern: /utilities?/i, field: 'utilities' },
  { pattern: /marketing|advertising/i, field: 'marketing' },
  { pattern: /admin|g\s*&\s*a|general/i, field: 'adminGeneral' },
  { pattern: /management\s+fee/i, field: 'managementFee' },
  { pattern: /property\s+tax|real\s+estate\s+tax/i, field: 'propertyTax' },
  { pattern: /insurance/i, field: 'insurance' },
  { pattern: /total\s+(operating\s+)?expense/i, field: 'totalOpex' },
  
  // Results
  { pattern: /net\s+operating\s+income|noi/i, field: 'noi' },
  { pattern: /debt\s+service|mortgage/i, field: 'debtService' },
  { pattern: /capital\s+expenditure|capex/i, field: 'capex' },
  { pattern: /cash\s+flow|net\s+income/i, field: 'cashFlowBeforeTax' },
  
  // Balance Sheet
  { pattern: /^cash\s*(and\s+cash\s+equiv)?/i, field: 'cash' },
  { pattern: /accounts?\s+receivable/i, field: 'accountsReceivable' },
  { pattern: /prepaid/i, field: 'prepaidExpenses' },
  { pattern: /total\s+assets/i, field: 'totalAssets' },
  { pattern: /accounts?\s+payable/i, field: 'accountsPayable' },
  { pattern: /security\s+deposit/i, field: 'securityDeposits' },
  { pattern: /total\s+liabilities/i, field: 'totalLiabilities' },
  { pattern: /total\s+equity|net\s+assets/i, field: 'equity' },
  
  // Occupancy
  { pattern: /total\s+units/i, field: 'totalUnits' },
  { pattern: /occupied\s+units/i, field: 'occupiedUnits' },
  { pattern: /occupancy\s+(%|rate|pct)/i, field: 'occupancyRate' },
  { pattern: /average\s+(effective\s+)?rent/i, field: 'avgEffectiveRent' },
  { pattern: /market\s+rent/i, field: 'avgMarketRent' },
];

function extractPropertyCodeFromFilename(filename: string): string {
  // Pattern: BPI_Financial_Package_p2122_...
  const match = filename.match(/p(\d{4})/i);
  return match ? `p${match[1]}` : 'UNKNOWN';
}

function extractReportMonth(sheet: XLSX.WorkSheet): string | null {
  // Look for report period in first 10 rows
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  
  for (let r = 0; r < Math.min(10, range.e.r); r++) {
    for (let c = 0; c < Math.min(10, range.e.c); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        const val = String(cell.v);
        // Look for patterns like "February 2026" or "02/2026" or "2026-02"
        const monthMatch = val.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (monthMatch) {
          const monthNames: Record<string, string> = {
            january: '01', february: '02', march: '03', april: '04',
            may: '05', june: '06', july: '07', august: '08',
            september: '09', october: '10', november: '11', december: '12'
          };
          const monthStr = val.toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)/)?.[1];
          if (monthStr) {
            return `${monthMatch[1]}-${monthNames[monthStr]}-01`;
          }
        }
        // Try MM/YYYY pattern
        const numMatch = val.match(/(\d{1,2})\/(\d{4})/);
        if (numMatch) {
          return `${numMatch[2]}-${numMatch[1].padStart(2, '0')}-01`;
        }
      }
    }
  }
  return null;
}

export function parseBPIFinancial(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];
  
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    
    if (workbook.SheetNames.length === 0) {
      return { success: false, error: 'No sheets found in workbook', warnings };
    }

    const propertyCode = extractPropertyCodeFromFilename(filename);
    const data: Partial<BPIFinancialData> = { propertyCode };
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetNameLower = sheetName.toLowerCase();
      
      // Extract report month from first sheet
      if (!data.reportMonth) {
        const month = extractReportMonth(sheet);
        if (month) data.reportMonth = month;
      }
      
      // Find data rows
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      
      for (let r = 0; r <= range.e.r; r++) {
        // Get description from first column
        const descCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const desc = descCell?.v ? String(descCell.v).trim() : '';
        
        if (!desc) continue;
        
        // Find matching field
        for (const { pattern, field } of LINE_PATTERNS) {
          if (pattern.test(desc)) {
            // Look for numeric value in subsequent columns (current month is usually col 1 or 2)
            for (let c = 1; c <= Math.min(5, range.e.c); c++) {
              const valCell = sheet[XLSX.utils.encode_cell({ r, c })];
              if (valCell && valCell.v != null) {
                const num = parseNum(valCell.v);
                if (num !== null && data[field] == null) {
                  (data as any)[field] = num;
                  break;
                }
              }
            }
            break;
          }
        }
      }
    }
    
    // Calculate occupancy rate if we have units
    if (data.totalUnits && data.occupiedUnits && data.occupancyRate == null) {
      data.occupancyRate = data.occupiedUnits / data.totalUnits;
    }
    
    // Validate we got meaningful data
    if (!data.noi && !data.effectiveGrossIncome && !data.grossPotentialRent) {
      warnings.push('Could not extract core financial metrics');
    }
    
    if (!data.reportMonth) {
      warnings.push('Could not determine report month');
      data.reportMonth = new Date().toISOString().slice(0, 7) + '-01';
    }

    return {
      success: true,
      documentType: 'BPI_FINANCIAL',
      data: data as BPIFinancialData,
      warnings,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse BPI Financial Package: ${err.message}`,
      warnings,
    };
  }
}
