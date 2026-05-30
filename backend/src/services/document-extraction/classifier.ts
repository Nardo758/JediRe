import * as XLSX from 'xlsx';
import { DocumentType, ClassificationResult } from './types';
import { findHeaderRow, parseSheetFromRow } from './parsers/workbook-utils';
import { vendorRegistry } from './vendor-registry';

// ── Non-vendor filename patterns ─────────────────────────────────────────────
// CoStar and other market-data-vendor patterns have been moved to the vendor
// registry (vendor-registry/costar.vendor.ts). Add new market-data-vendor
// patterns there, not here. Only operator-uploaded property document patterns
// belong in this array.

const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: DocumentType }> = [
  { pattern: /aged[\s_-]*receiv/i, type: 'AGED_RECEIVABLES' },
  { pattern: /box[\s_-]*score/i, type: 'BOX_SCORE' },
  { pattern: /concession[\s_-]*burn/i, type: 'CONCESSION_BURNOFF' },
  { pattern: /trade[\s_-]*out|t30[\s_-]*lto|lto[\s_-]*report|lease[\s_-]*trade/i, type: 'T30_LTO' },
  { pattern: /tax[\s_-]*bill|tax[\s_-]*statement|property[\s_-]*tax/i, type: 'TAX_BILL' },
  { pattern: /market[\s_-]*rent[\s_-]*sched/i, type: 'OTHER_INCOME' },
  { pattern: /other[\s_-]*income[\s_-]*sched/i, type: 'OTHER_INCOME' },
  { pattern: /offering[\s_-]*memorandum|investment[\s_-]*summary|property[\s_-]*offering/i, type: 'OM' },
  { pattern: /rent[\s_+\-]*roll|rr[\s_-]*w[\s_-]*lc|rrwlc/i, type: 'RENT_ROLL' },
  { pattern: /t[\s_-]*12|trailing[\s_-]*12|income[\s_-]*statement|ysi[\s_-]*is/i, type: 'T12' },
  { pattern: /leasing/i, type: 'LEASING_STATS' },
];

function isPdf(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}

function isExcel(filename: string): boolean {
  return /\.(xlsx?|csv|tsv)$/i.test(filename);
}

// ── Filename classification ───────────────────────────────────────────────────
// Vendor registry is checked first (market data vendors) before non-vendor
// property-document patterns.

function classifyByFilename(filename: string): { type: DocumentType; confidence: number; hints?: string[]; vendorId?: string } | null {
  // 1. Vendor registry (CoStar, Yardi Matrix, etc.)
  const vendorMatch = vendorRegistry.classifyByFilename(filename);
  if (vendorMatch) {
    return {
      type: vendorMatch.match.fileType.documentType,
      confidence: vendorMatch.confidence,
      hints: vendorMatch.hints,
      vendorId: vendorMatch.match.vendorId,
    };
  }

  // 2. Non-vendor property document patterns
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return { type, confidence: 0.6 };
    }
  }
  return null;
}

// ── Header classification ────────────────────────────────────────────────────
// Vendor registry is checked first to avoid false positives on generic signals
// (e.g. a CoStar DataTable has "period" and "vacancy rate" which could clash
// with non-vendor T12 or box-score patterns).

function classifyByHeaders(headers: string[], sampleRows: any[]): { type: DocumentType; confidence: number; hints: string[]; vendorId?: string } {
  const headerStr = headers.join(' ').toLowerCase();
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
  const hints: string[] = [];

  // 1. Vendor registry (must run BEFORE generic non-vendor checks)
  const vendorMatch = vendorRegistry.classifyByHeaders(headerStr, headerSet);
  if (vendorMatch) {
    return {
      type: vendorMatch.match.fileType.documentType,
      confidence: vendorMatch.confidence,
      hints: vendorMatch.hints,
      vendorId: vendorMatch.match.vendorId,
    };
  }

  // 2. Non-vendor property document patterns
  // ── Yardi GL-code T12 (Yardi-formatted T12, not Yardi Matrix market data) ─
  const hasGLCodes = sampleRows.some(row => {
    const firstVal = String(Object.values(row)[0] || '');
    return /^[45]\d{5}/.test(firstVal);
  });

  if (hasGLCodes || headerStr.includes('account') && (headerStr.includes('jan') || headerStr.includes('feb'))) {
    hints.push('Yardi GL codes detected');
    return { type: 'T12', confidence: 0.9, hints };
  }

  const rrSignals = ['unit', 'resident', 'sqft', 'market rent', 'move-in', 'lease from', 'lease to', 'charge code'];
  const rrMatches = rrSignals.filter(s => headerStr.includes(s)).length;
  if (rrMatches >= 3) {
    hints.push(`Rent roll signals: ${rrMatches}/8`);
    return { type: 'RENT_ROLL', confidence: 0.85, hints };
  }

  const arSignals = ['0-30', '31-60', '61-90', '90+', 'prepaid', 'aging', 'balance due', 'delinquent'];
  const arMatches = arSignals.filter(s => headerStr.includes(s)).length;
  if (arMatches >= 2) {
    hints.push(`Aged receivables signals: ${arMatches}/8`);
    return { type: 'AGED_RECEIVABLES', confidence: 0.85, hints };
  }

  const bsSignals = ['occupied', 'vacant', 'notice', 'leased%', 'trend', 'move-in', 'move-out', 'renewal', 'contact'];
  const bsMatches = bsSignals.filter(s => headerStr.includes(s)).length;
  if (bsMatches >= 3 || headerStr.includes('boxscore') || headerStr.includes('box score')) {
    hints.push(`Box score signals: ${bsMatches}/9`);
    return { type: 'BOX_SCORE', confidence: 0.85, hints };
  }

  const concSignals = ['concession', 'burn-off', 'burnoff', 'recurring', 'remaining', 'end date', 'lease term'];
  const concMatches = concSignals.filter(s => headerStr.includes(s)).length;
  if (concMatches >= 2) {
    hints.push(`Concession burn-off signals: ${concMatches}/7`);
    return { type: 'CONCESSION_BURNOFF', confidence: 0.8, hints };
  }

  const ltoSignals = ['trade-out', 'trade out', 'prior rent', 'new rent', 'gain/loss', 'new/renewal', 'effective rent', 'variance'];
  const ltoMatches = ltoSignals.filter(s => headerStr.includes(s)).length;
  if (ltoMatches >= 2) {
    hints.push(`LTO signals: ${ltoMatches}/8`);
    return { type: 'T30_LTO', confidence: 0.8, hints };
  }

  const oiSignals = ['per unit', 'assumption', 'other income', 'ancillary', 'projection', 'annual', 'monthly'];
  const oiMatches = oiSignals.filter(s => headerStr.includes(s)).length;
  if (oiMatches >= 2 && headerStr.includes('income')) {
    hints.push(`Other income signals: ${oiMatches}/7`);
    return { type: 'OTHER_INCOME', confidence: 0.7, hints };
  }

  if (headerStr.includes('gross potential') || headerStr.includes('noi') || headerStr.includes('vacancy loss')) {
    hints.push('Income statement headers detected');
    return { type: 'T12', confidence: 0.7, hints };
  }

  return { type: 'UNKNOWN', confidence: 0, hints: ['No matching patterns found'] };
}

export async function classifyDocument(buffer: Buffer, filename: string): Promise<ClassificationResult> {
  const filenameResult = classifyByFilename(filename);

  if (isPdf(filename)) {
    if (filenameResult) {
      return {
        documentType: filenameResult.type,
        confidence: filenameResult.confidence,
        hints: filenameResult.hints ?? ['PDF filename match'],
        vendorId: filenameResult.vendorId,
      };
    }
    let textContent = '';
    try {
      const lib = require('pdf-parse');
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = typeof lib === 'function' ? lib : (lib.default || ((buf: Buffer) => { const inst = new lib.PDFParse({ data: buf }); return inst.getText ? inst.getText().then((t: string) => ({ text: t })) : Promise.resolve({ text: '' }); }));
      const pdfResult = await pdfParse(buffer);
      textContent = (pdfResult.text || '').toLowerCase();
    } catch {
      textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 4096)).toLowerCase();
    }
    const taxIndicators = ['parcel', 'assessed value', 'millage', 'property tax', 'tax year', 'tax bill', 'levy', 'appraised'];
    const taxMatches = taxIndicators.filter(ind => textContent.includes(ind)).length;
    if (taxMatches >= 2) {
      return {
        documentType: 'TAX_BILL',
        confidence: 0.6 + taxMatches * 0.05,
        hints: [`PDF parsed text contains ${taxMatches} tax indicators`],
      };
    }

    // OM detection — broker offering memoranda have distinctive signal mix.
    // Score by signal categories so a single false positive (e.g. a broker
    // logo on a non-OM doc) doesn't trip the classifier.
    const omSignals: string[] = [];
    if (textContent.includes('offering memorandum')) omSignals.push('offering memorandum');
    if (textContent.includes('confidentiality') && textContent.includes('memorandum')) omSignals.push('confidentiality memorandum');
    if (textContent.includes('broker') && textContent.includes('investment summary')) omSignals.push('broker investment summary');
    const brokerNames = ['cushman & wakefield', 'colliers', 'cbre', 'jll', 'marcus & millichap'];
    const brokerHit = brokerNames.find(b => textContent.includes(b));
    if (brokerHit) omSignals.push(`broker: ${brokerHit}`);
    if (textContent.includes('cap rate') && textContent.includes('noi') && textContent.includes('rent roll')) {
      omSignals.push('cap rate + noi + rent roll triple');
    }
    if (textContent.includes('pro forma') && textContent.includes('operating statement')) {
      omSignals.push('pro forma + operating statement');
    }
    if (textContent.includes('exclusively offered by') || textContent.includes('exclusive listing')) {
      omSignals.push('exclusive listing language');
    }
    if (omSignals.length >= 1) {
      // 1 signal = 0.6, 2 = 0.7, 3 = 0.8, 4+ = 0.85
      const confidence = Math.min(0.85, 0.55 + omSignals.length * 0.075);
      return {
        documentType: 'OM',
        confidence,
        hints: [`PDF parsed text contains ${omSignals.length} OM signal(s): ${omSignals.join('; ')}`],
      };
    }

    return {
      documentType: 'UNKNOWN',
      confidence: 0,
      hints: ['PDF file — no matching filename or content patterns'],
    };
  }

  if (!isExcel(filename)) {
    return {
      documentType: filenameResult?.type || 'UNKNOWN',
      confidence: filenameResult ? filenameResult.confidence : 0,
      hints: filenameResult?.hints ?? ['Unsupported file type'],
      vendorId: filenameResult?.vendorId,
    };
  }

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (workbook.SheetNames.length === 0) {
      return { documentType: 'UNKNOWN', confidence: 0, hints: ['Empty workbook'] };
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const ALL_DOC_HEADER_PATTERNS = [
      /unit|apt|resident|tenant/i,
      /rent|sqft|lease|move/i,
      /0-30|31-60|61-90|90\+|aging|delinqu/i,
      /occupied|vacant|notice|renewal/i,
      /concession|burn.*off|recurring/i,
      /trade.*out|prior.*rent|new.*rent|effective/i,
      /per.*unit|annual|monthly|income|category/i,
      /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i,
      /gross|noi|revenue|expense|vacancy/i,
      // Vendor-specific anchors (kept broad so header scanner reaches the right row)
      /period|inventory|absorption|cap rate|submarket/i,
      /sale date|sale price|asking rent|effective rent/i,
    ];
    const headerRow = findHeaderRow(sheet, ALL_DOC_HEADER_PATTERNS, 20, 1);
    const { headers, rows } = parseSheetFromRow(sheet, headerRow);

    if (rows.length === 0) {
      return { documentType: filenameResult?.type || 'UNKNOWN', confidence: filenameResult?.confidence || 0, hints: ['No data rows'], vendorId: filenameResult?.vendorId };
    }

    const sampleRows = rows.slice(0, 20);
    const headerResult = classifyByHeaders(headers, sampleRows);

    if (filenameResult && headerResult.type !== 'UNKNOWN') {
      if (filenameResult.type === headerResult.type) {
        const combinedHints = [
          ...(filenameResult.hints ?? ['Filename match']),
          ...headerResult.hints,
        ];
        return {
          documentType: filenameResult.type,
          confidence: Math.min(0.98, filenameResult.confidence + headerResult.confidence * 0.3),
          hints: combinedHints,
          vendorId: filenameResult.vendorId ?? headerResult.vendorId,
        };
      }
      if (headerResult.confidence >= filenameResult.confidence) {
        return { documentType: headerResult.type, confidence: headerResult.confidence, hints: headerResult.hints, vendorId: headerResult.vendorId };
      }
      return {
        documentType: filenameResult.type,
        confidence: filenameResult.confidence,
        hints: filenameResult.hints ?? ['Filename match overrides ambiguous headers'],
        vendorId: filenameResult.vendorId,
      };
    }

    if (headerResult.type !== 'UNKNOWN') {
      return { documentType: headerResult.type, confidence: headerResult.confidence, hints: headerResult.hints, vendorId: headerResult.vendorId };
    }

    if (filenameResult) {
      return { documentType: filenameResult.type, confidence: filenameResult.confidence, hints: filenameResult.hints ?? ['Filename match only'], vendorId: filenameResult.vendorId };
    }

    return { documentType: 'UNKNOWN', confidence: 0, hints: ['Could not classify document'] };
  } catch (err) {
    return {
      documentType: filenameResult?.type || 'UNKNOWN',
      confidence: filenameResult ? filenameResult.confidence : 0,
      hints: filenameResult?.hints ?? [`Parse error: ${err instanceof Error ? err.message : 'unknown'}`],
      vendorId: filenameResult?.vendorId,
    };
  }
}
