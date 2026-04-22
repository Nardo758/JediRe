/**
 * BPI Variance Report Parser
 * 
 * Parses Bell Partners Inc (BPI) Variance Report Excel files.
 * These compare actual results to budget with variance calculations.
 */

import * as XLSX from 'xlsx';
import { ExtractionResult } from '../types';
import { parseNum } from './workbook-utils';

export interface VarianceLineItem {
  lineItem: string;
  category: string;
  actual: number | null;
  budget: number | null;
  variance: number | null;
  variancePct: number | null;
  varianceType: 'favorable' | 'unfavorable' | 'neutral';
  ytdActual: number | null;
  ytdBudget: number | null;
  ytdVariance: number | null;
  ytdVariancePct: number | null;
}

export interface BPIVarianceData {
  propertyCode: string;
  reportMonth: string;
  lineItems: VarianceLineItem[];
  summary: {
    totalRevenue: { actual: number | null; budget: number | null; variance: number | null };
    totalExpenses: { actual: number | null; budget: number | null; variance: number | null };
    noi: { actual: number | null; budget: number | null; variance: number | null };
  };
}

// Categorize line items
function categorizeLineItem(description: string): string {
  const desc = description.toLowerCase();
  
  if (/rent|lease|vacancy|concession|loss.*lease|bad\s*debt/i.test(desc)) return 'revenue';
  if (/other\s*income|fee|utility\s*reimb|parking|storage/i.test(desc)) return 'other_income';
  if (/payroll|salary|wage|benefit|bonus/i.test(desc)) return 'payroll';
  if (/repair|maintenance|make.*ready|turnover/i.test(desc)) return 'repairs_maintenance';
  if (/contract|service|landscap|pest|elevator|security/i.test(desc)) return 'contract_services';
  if (/utilit|electric|gas|water|sewer|trash/i.test(desc)) return 'utilities';
  if (/marketing|advertis|promo/i.test(desc)) return 'marketing';
  if (/admin|office|legal|professional|license/i.test(desc)) return 'admin_general';
  if (/management\s*fee/i.test(desc)) return 'management_fee';
  if (/tax|property.*tax|real\s*estate/i.test(desc)) return 'property_tax';
  if (/insurance/i.test(desc)) return 'insurance';
  if (/capital|capex|improvement/i.test(desc)) return 'capex';
  if (/debt|mortgage|interest|principal/i.test(desc)) return 'debt_service';
  
  return 'other';
}

function determineVarianceType(variance: number | null, category: string): 'favorable' | 'unfavorable' | 'neutral' {
  if (variance === null || variance === 0) return 'neutral';
  
  // For revenue, positive variance is favorable
  if (category === 'revenue' || category === 'other_income') {
    return variance > 0 ? 'favorable' : 'unfavorable';
  }
  
  // For expenses, negative variance (under budget) is favorable
  return variance < 0 ? 'favorable' : 'unfavorable';
}

function extractPropertyCodeFromFilename(filename: string): string {
  const match = filename.match(/p(\d{4})/i);
  return match ? `p${match[1]}` : 'UNKNOWN';
}

function extractReportMonthFromFilename(filename: string): string {
  // Pattern: ..._p21220226.xlsx means Feb 2026
  const match = filename.match(/p\d{4}(\d{4})\.xlsx?$/i);
  if (match) {
    const mmyy = match[1];
    const mm = mmyy.slice(0, 2);
    const yy = mmyy.slice(2);
    const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
    return `${year}-${mm}-01`;
  }
  return new Date().toISOString().slice(0, 7) + '-01';
}

export function parseBPIVariance(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];
  
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    
    if (workbook.SheetNames.length === 0) {
      return { success: false, error: 'No sheets found in workbook', warnings };
    }

    const propertyCode = extractPropertyCodeFromFilename(filename);
    const reportMonth = extractReportMonthFromFilename(filename);
    
    const lineItems: VarianceLineItem[] = [];
    const summary = {
      totalRevenue: { actual: null as number | null, budget: null as number | null, variance: null as number | null },
      totalExpenses: { actual: null as number | null, budget: null as number | null, variance: null as number | null },
      noi: { actual: null as number | null, budget: null as number | null, variance: null as number | null },
    };
    
    // Process first sheet (usually has the variance data)
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    // Find header row (look for "Actual", "Budget", "Variance")
    let headerRow = -1;
    let colActual = -1;
    let colBudget = -1;
    let colVariance = -1;
    let colVariancePct = -1;
    let colYtdActual = -1;
    let colYtdBudget = -1;
    
    for (let r = 0; r <= Math.min(20, range.e.r); r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const val = String(cell.v).toLowerCase().trim();
          if (val.includes('actual') && !val.includes('ytd')) {
            headerRow = r;
            colActual = c;
          } else if (val.includes('budget') && !val.includes('ytd')) {
            colBudget = c;
          } else if (val === 'variance' || (val.includes('variance') && !val.includes('%') && !val.includes('ytd'))) {
            colVariance = c;
          } else if (val.includes('variance') && val.includes('%')) {
            colVariancePct = c;
          } else if (val.includes('ytd') && val.includes('actual')) {
            colYtdActual = c;
          } else if (val.includes('ytd') && val.includes('budget')) {
            colYtdBudget = c;
          }
        }
      }
      if (headerRow >= 0 && colActual >= 0 && colBudget >= 0) break;
    }
    
    if (headerRow < 0 || colActual < 0) {
      warnings.push('Could not locate header row with Actual/Budget columns');
      // Try to parse anyway with assumed structure
      headerRow = 5;
      colActual = 1;
      colBudget = 2;
      colVariance = 3;
    }
    
    // Parse data rows
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const descCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
      const desc = descCell?.v ? String(descCell.v).trim() : '';
      
      if (!desc || desc.length < 2) continue;
      
      // Skip section headers (usually short uppercase text)
      if (desc.length < 20 && desc === desc.toUpperCase() && !/\d/.test(desc)) continue;
      
      const actual = colActual >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colActual })]?.v) : null;
      const budget = colBudget >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colBudget })]?.v) : null;
      const variance = colVariance >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colVariance })]?.v) : 
        (actual !== null && budget !== null ? actual - budget : null);
      const variancePct = colVariancePct >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colVariancePct })]?.v) :
        (variance !== null && budget !== null && budget !== 0 ? (variance / Math.abs(budget)) * 100 : null);
      const ytdActual = colYtdActual >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colYtdActual })]?.v) : null;
      const ytdBudget = colYtdBudget >= 0 ? parseNum(sheet[XLSX.utils.encode_cell({ r, c: colYtdBudget })]?.v) : null;
      const ytdVariance = ytdActual !== null && ytdBudget !== null ? ytdActual - ytdBudget : null;
      const ytdVariancePct = ytdVariance !== null && ytdBudget !== null && ytdBudget !== 0 
        ? (ytdVariance / Math.abs(ytdBudget)) * 100 : null;
      
      if (actual === null && budget === null) continue;
      
      const category = categorizeLineItem(desc);
      const varianceType = determineVarianceType(variance, category);
      
      lineItems.push({
        lineItem: desc,
        category,
        actual,
        budget,
        variance,
        variancePct,
        varianceType,
        ytdActual,
        ytdBudget,
        ytdVariance,
        ytdVariancePct,
      });
      
      // Capture summary rows
      const descLower = desc.toLowerCase();
      if (/total\s+(?:rental\s+)?income|total\s+revenue|effective\s+gross/i.test(descLower)) {
        summary.totalRevenue = { actual, budget, variance };
      } else if (/total\s+(?:operating\s+)?expense/i.test(descLower)) {
        summary.totalExpenses = { actual, budget, variance };
      } else if (/net\s+operating\s+income|noi/i.test(descLower)) {
        summary.noi = { actual, budget, variance };
      }
    }
    
    if (lineItems.length === 0) {
      warnings.push('No variance line items extracted');
    }

    return {
      success: true,
      documentType: 'BPI_VARIANCE',
      data: {
        propertyCode,
        reportMonth,
        lineItems,
        summary,
      } as BPIVarianceData,
      warnings,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse BPI Variance Report: ${err.message}`,
      warnings,
    };
  }
}
