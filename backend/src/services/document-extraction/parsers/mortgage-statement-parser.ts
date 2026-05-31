/**
 * Mortgage Statement Parser
 *
 * Parses monthly mortgage / loan servicing statements (PDF).
 * Extracts: loan number, principal balance, pay rate, escrow balances,
 * current payment breakdown, and YTD figures.
 *
 * Supports Trimont REA and similar servicer PDF statement formats.
 */

import { MortgageStatementData, ExtractionResult } from '../types';

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function extractNum(lines: string[], labelPattern: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (labelPattern.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        const m = lines[j].match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (m) {
          const val = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
  }
  return null;
}

function extractRate(lines: string[], labelPattern: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (labelPattern.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        const m = lines[j].match(/([\d.]+)\s*%/);
        if (m) return parseFloat(m[1]) / 100;
      }
    }
  }
  return null;
}

function extractDate(lines: string[], labelPattern: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (labelPattern.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 3, lines.length - 1); j++) {
        // "10/Jan/2022"
        const m1 = lines[j].match(/(\d{1,2})[\/\-](\w{3,9})[\/\-](\d{4})/);
        if (m1) {
          const mo = MONTH_MAP[m1[2].slice(0, 3).toLowerCase()] ?? '01';
          return `${m1[3]}-${mo}-${m1[1].padStart(2, '0')}`;
        }
        // "01/10/2022"
        const m2 = lines[j].match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function extractLoanNumber(text: string): string | null {
  const m = text.match(/loan\s*(?:number|#|no\.?)[:\s]*([\d]+)/i);
  if (m) return m[1];
  const m2 = text.match(/loan\s*#[:\s]*([\d]+)/i);
  return m2 ? m2[1] : null;
}

function extractDealName(text: string): string | null {
  const m = text.match(/deal\s*name\s*[:\-]?\s*([A-Z][A-Z\s]{2,30})/m);
  return m ? m[1].trim() : null;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const lib = require('pdf-parse');
  let pdfParse: (buf: Buffer) => Promise<{ text: string }>;

  if (typeof lib === 'function') {
    pdfParse = lib;
  } else if (lib.default && typeof lib.default === 'function') {
    pdfParse = lib.default;
  } else if (lib.PDFParse) {
    // pdf-parse v2.x class API
    pdfParse = (buf: Buffer) => {
      const inst = new lib.PDFParse({ data: buf });
      return inst.getText
        ? inst.getText().then((t: string) => ({ text: t }))
        : Promise.resolve({ text: '' });
    };
  } else {
    throw new Error('pdf-parse module does not export a callable — cannot parse PDF');
  }

  const result = await pdfParse(buffer);
  const raw = result?.text ?? result ?? '';
  return typeof raw === 'string' ? raw : String(raw);
}

export async function parseMortgageStatementAsync(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    let text: string;
    try {
      text = await extractPdfText(buffer);
    } catch (e: any) {
      // Fall back to raw byte text for text-layer PDFs
      text = buffer.toString('utf-8', 0, Math.min(buffer.length, 32768));
      if (text.length < 100) {
        return {
          documentType: 'MORTGAGE_STATEMENT',
          success: false,
          error: `PDF text extraction failed: ${e.message}`,
          data: null,
          summary: {},
          warnings,
        };
      }
      warnings.push('Used raw text fallback — PDF may be image-based');
    }

    if (!text || text.trim().length < 50) {
      warnings.push('PDF text is minimal — scanned image; extracted fields may be incomplete');
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const data: MortgageStatementData = {
      loanNumber:              extractLoanNumber(text),
      dealName:                extractDealName(text),
      currentPrincipalBalance: extractNum(lines, /current\s+principal\s+balance/i),
      payRate:                 extractRate(lines, /current\s+pay\s+rate/i),
      contractRate:            extractRate(lines, /current\s+contract\s+rate/i),
      currentIndex:            extractRate(lines, /current\s+index/i),
      daysInBillingCycle:      extractNum(lines, /days\s+in\s+billing\s+cycle/i),
      currentInterestDue:      extractNum(lines, /current\s+interest\s+due/i),
      taxEscrowDue:            extractNum(lines, /current\s+tax\s+escrow\s+due/i),
      insuranceEscrowDue:      extractNum(lines, /current\s+insurance\s+escrow\s+due/i),
      miscAmountDue:           extractNum(lines, /current\s+misc\s+amount\s+due/i),
      currentTotalDue:         extractNum(lines, /current\s+total/i),
      pastDueAmount:           extractNum(lines, /past\s+due\s+(misc\s+)?amount/i),
      totalPaymentDue:         extractNum(lines, /total\s+payment\s+due/i),
      dateDue:                 extractDate(lines, /date\s+payment\s+due|date\s+due/i),
      dateIssued:              extractDate(lines, /date\s+issued/i),
      taxEscrowBalance:        extractNum(lines, /tax\s+escrow\s+balance/i),
      insuranceEscrowBalance:  extractNum(lines, /insurance\s+escrow\s+balance/i),
      reserveEscrowBalance:    extractNum(lines, /reserve\s+escrow\s+balance/i),
      interestPaidYTD:         extractNum(lines, /interest\s+paid\s+ytd/i),
      taxesDisbursedYTD:       extractNum(lines, /taxes\s+disbursed\s+ytd/i),
      servicer:                null,
    };

    const fieldsExtracted = Object.values(data).filter(v => v != null).length;
    if (fieldsExtracted < 4) warnings.push('Few fields extracted — verify PDF has a text layer');

    return {
      documentType: 'MORTGAGE_STATEMENT',
      success: true,
      data,
      summary: {
        loanNumber:              data.loanNumber,
        dealName:                data.dealName,
        currentPrincipalBalance: data.currentPrincipalBalance,
        totalPaymentDue:         data.totalPaymentDue,
        dateDue:                 data.dateDue,
        payRate:                 data.payRate,
        fieldsExtracted,
      },
      warnings,
    };
  } catch (err: any) {
    return {
      documentType: 'MORTGAGE_STATEMENT',
      success: false,
      error: `Failed to parse mortgage statement: ${err.message}`,
      data: null,
      summary: {},
      warnings,
    };
  }
}

export function parseMortgageStatement(_buffer: Buffer, _filename: string): ExtractionResult {
  return {
    documentType: 'MORTGAGE_STATEMENT',
    success: false,
    error: 'Mortgage statement parser requires async execution — use parseMortgageStatementAsync',
    data: null,
    summary: {},
    warnings: [],
  };
}
