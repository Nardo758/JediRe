import { TaxBillData, ExtractionResult } from '../types';

// ============================================================================
// Tax Bill Parser v2
//
// Two-stage extraction:
//   1. Header-block parsing — owner / parcel / situs / appraisal values
//      (positional: most county bills put these in fixed-position grid)
//   2. Authority-line tabular parsing — millage breakdown per taxing authority
//
// Detects appeal status from "TEMPORARY BILL" / "APPEAL" language and captures
// both the appealed (current) and unappealed (worst-case) tax amounts so the
// proforma seeder can produce scenario layered values.
//
// Validated against:
//   - DeKalb County GA (Brookhaven SSD) tax statement format
//   - Generic single-page county PDFs
// ============================================================================

function parseNum(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let s = String(val).trim().replace(/[$,%\s]/g, '');
  if (!s || s === '-' || s === '—') return null;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
  else if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const n = parseFloat(s);
  return isNaN(n) ? null : (neg ? -n : n);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2.x exports a class API; v1.x exports a function.
  // Try the v2 API first, then fall back.
  try {
    const lib = require('pdf-parse');
    if (lib && typeof lib.PDFParse === 'function') {
      const inst = new lib.PDFParse({ data: buffer });
      const result = await inst.getText();
      return result?.text || '';
    }
    if (typeof lib === 'function') {
      const result = await lib(buffer);
      return result?.text || '';
    }
    if (lib && typeof lib.default === 'function') {
      const result = await lib.default(buffer);
      return result?.text || '';
    }
  } catch (err) {
    // Fall through to text fallback
  }
  return buffer.toString('utf-8');
}

interface AuthorityLine {
  name: string;
  taxableAssessment: number | null;
  millage: number | null;
  grossTax: number | null;
  netTax: number | null;
  units?: number;          // for per-unit fees like Storm Water
}

interface ParsedTaxBill extends TaxBillData {
  // Extended fields not in legacy TaxBillData
  countyPin?: string | null;
  situsAddress?: string | null;
  taxDistrict?: string | null;
  totalAppraisal?: number | null;
  baseAssessment?: number | null;
  appealAssessment?: number | null;
  unappealedTaxAmount?: number | null;
  countySubtotal?: number | null;
  schoolSubtotal?: number | null;
  otherSubtotal?: number | null;
  priorYearBalance?: number | null;
  totalPayoff?: number | null;
}

function parseFromText(text: string): { data: ParsedTaxBill; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const data: ParsedTaxBill = {
    parcelId: null, assessedValue: null, assessedLand: null, assessedImprovement: null,
    assessedValueAppeal: null, fairMarketValue: null, totalAnnualTax: 0,
    millageRate: null, taxingAuthority: null, ownerName: null, ownerAddress: null,
    appealStatus: null, taxYear: null, authorities: [],
    countyPin: null, situsAddress: null, taxDistrict: null,
    totalAppraisal: null, baseAssessment: null, appealAssessment: null,
    unappealedTaxAmount: null, countySubtotal: null, schoolSubtotal: null,
    otherSubtotal: null, priorYearBalance: null, totalPayoff: null,
  };

  // ─── Tax year (look for "20XX ... TAX STATEMENT" or "20XX PROPERTY TAXES") ───
  for (const line of lines) {
    const m = line.match(/\b(20\d{2})\s+(?:[A-Z][A-Z\s]+)?(?:REAL\s+ESTATE\s+)?TAX\s+(?:STATEMENT|BILL|NOTICE)/i)
          || line.match(/^\s*(20\d{2})\s+PROPERTY\s+TAXES/i);
    if (m) { data.taxYear = parseInt(m[1]); break; }
  }

  // ─── Owner LLC (typically the very first non-empty line, all caps, looks like company) ───
  if (lines.length > 0 && /^[A-Z][A-Z0-9\s&,.'/-]+(?:LLC|LP|INC|CORP|TRUST|LLP|LTD|PARTNERSHIP|FUND)/i.test(lines[0])) {
    data.ownerName = lines[0];
  }

  // ─── Parcel ID — DeKalb format "18 239 06 006/1311667" or generic "Parcel: XXX" ───
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // DeKalb: "18 239 06 006/1311667" — three space-separated number groups + slash + PIN
    const dekalbMatch = line.match(/^(\d{1,3}\s+\d{1,3}\s+\d{1,3}\s+\d{1,3})(?:\/(\d+))?$/);
    if (dekalbMatch && !data.parcelId) {
      data.parcelId = dekalbMatch[1].replace(/\s+/g, ' ').trim();
      if (dekalbMatch[2]) data.countyPin = dekalbMatch[2];
      continue;
    }
    // Generic: "Parcel ID: 1311667", "PARCEL #...", "Parcel I.D. ABC-123"
    const genMatch = line.match(/parcel[\s.#:]*(?:i\.?d\.?[\s.:]*)?([A-Z0-9][A-Z0-9\-\s\/.]*?)(?:\s|$)/i);
    if (genMatch && !data.parcelId) {
      const cleaned = genMatch[1].trim().replace(/\s+/g, ' ');
      if (cleaned.length >= 3 && cleaned.length <= 64) data.parcelId = cleaned;
    }
    // Bare "PIN: 1311667"
    const pinMatch = line.match(/\bpin[\s:]+(\d+)/i);
    if (pinMatch && !data.countyPin) data.countyPin = pinMatch[1];
  }

  // ─── Situs address — line that looks like a street address ───
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (data.situsAddress) break;
    // Match "1234 STREET NAME RD" pattern
    if (/^\d+\s+[A-Z][A-Z0-9\s.&-]+(?:RD|ST|AVE|BLVD|DR|LN|WAY|CT|PL|PKWY|TER|HWY|CIR|TRL|PT|XING|LOOP)\b/i.test(line)) {
      data.situsAddress = line;
    }
  }

  // ─── Tax district ─── (DeKalb: "20S BROOKHAVEN SSD", others vary)
  for (const line of lines) {
    const m = line.match(/^(\d{1,3}[A-Z])\s+([A-Z][A-Z\s]+(?:SSD|CSD|TAD|TID|DISTRICT))/i);
    if (m && !data.taxDistrict) {
      data.taxDistrict = `${m[1]} ${m[2].trim()}`;
      break;
    }
  }

  // ─── Owner mailing address (multi-line block) ───
  const mailingStart = lines.findIndex(l => /^\*+AUTO/.test(l));
  if (mailingStart >= 0 && mailingStart + 3 < lines.length) {
    const block = lines.slice(mailingStart + 1, mailingStart + 5)
      .filter(l => !/^F[A-Z]+$/.test(l) && !/^\*/.test(l) && l.length < 80);
    if (block.length >= 2) {
      data.ownerAddress = block.join(', ');
    }
  }

  // ─── Appeal detection ───
  const fullText = text.toUpperCase();
  if (/TEMPORARY\s+BILL.*APPEAL/.test(fullText) || /APPEAL\s+ASSESSMENT/.test(fullText)) {
    data.appealStatus = 'pending';
    // Capture the unappealed amount: "TAXES WOULD HAVE BEEN $X" pattern
    const unappealedMatch = text.match(/TAXES\s+WOULD\s+HAVE\s+BEEN\s+\$?([\d,]+\.?\d*)/i);
    if (unappealedMatch) {
      data.unappealedTaxAmount = parseNum(unappealedMatch[1]);
    }
    // Capture appeal assessment value
    const appealAssessMatch = text.match(/APPEAL\s+ASSESSMENT[\s:]*\$?([\d,]+)/i);
    if (appealAssessMatch) data.appealAssessment = parseNum(appealAssessMatch[1]);
  } else if (/APPEAL\s+(SETTLED|RESOLVED|FINAL)/.test(fullText)) {
    data.appealStatus = 'settled';
  } else {
    data.appealStatus = 'none';
  }

  // ─── Appraisal & assessment values (DeKalb: 3 sequential numbers after address block) ───
  // "TOTAL APPRAISAL  114,962,700" / "40% ASSESSMENT  45,985,080" / "APPEAL ASSESSMENT  39,087,318"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(/total\s+appraisal[\s:]*\$?([\d,]+)/i);
    if (m) data.totalAppraisal = parseNum(m[1]);
    m = line.match(/40%\s+assessment[\s:]*\$?([\d,]+)/i);
    if (m) data.baseAssessment = parseNum(m[1]);
    m = line.match(/(?:appeal|appealed)\s+assessment[\s:]*\$?([\d,]+)/i);
    if (m) data.appealAssessment = parseNum(m[1]);
    m = line.match(/(?:fair\s+market|fmv)[\s:]*\$?([\d,]+)/i);
    if (m) data.fairMarketValue = parseNum(m[1]);
  }

  // Fallback for DeKalb's unlabeled-value layout: three large numbers on consecutive lines
  // immediately after the tax-district line. Apply only if we didn't catch them above.
  if (data.totalAppraisal == null && data.baseAssessment == null) {
    const districtIdx = data.taxDistrict
      ? lines.findIndex(l => l.includes(data.taxDistrict!))
      : -1;
    if (districtIdx >= 0) {
      const candidates: number[] = [];
      for (let i = districtIdx + 1; i < Math.min(districtIdx + 6, lines.length); i++) {
        const n = parseNum(lines[i]);
        if (n != null && n > 100000) candidates.push(n);
      }
      // Sorted desc — largest is total appraisal
      candidates.sort((a, b) => b - a);
      if (candidates.length >= 3) {
        data.totalAppraisal = candidates[0];
        data.baseAssessment = candidates[1];
        data.appealAssessment = candidates[2];
      } else if (candidates.length === 2) {
        data.totalAppraisal = candidates[0];
        data.baseAssessment = candidates[1];
      } else if (candidates.length === 1) {
        data.totalAppraisal = candidates[0];
      }
    }
  }

  // ─── Authority lines — tabular data with millage + tax amounts ───
  // Pattern: "<NAME> <ASSESS> <MILLAGE> <GROSS> ... <NET>" tab-separated
  const authorityLines = lines.filter(l => {
    // Look for lines that have the tab pattern with assessment value matching baseline
    return /\t[\d,]+\.\d{3,}/.test(l) || /\t\.\d{3,}\s/.test(l);
  });

  for (const line of authorityLines) {
    const parts = line.split(/\t+/).map(p => p.trim()).filter(p => p);
    if (parts.length < 3) continue;
    const name = parts[0];
    if (!name || name.length < 2 || /^\(/.test(name)) continue;

    // Skip subtotals (handled separately below)
    if (/subtotal/i.test(name)) continue;

    const assessment = parseNum(parts[1]);
    const millage = parseNum(parts[2]);
    const grossTax = parts.length > 3 ? parseNum(parts[3]) : null;
    const netTax = parts[parts.length - 1] !== parts[3] ? parseNum(parts[parts.length - 1]) : grossTax;

    // Per-unit fees (Storm Water, streetscape) come through with "X UNIT(S)" in pos 1
    if (parts[1] && /unit/i.test(parts[1])) {
      const units = parseNum(parts[1]);
      const perUnit = parseNum(parts[2]);
      const total = parseNum(parts[parts.length - 1]);
      if (total != null) {
        data.authorities!.push({
          name, taxableAssessment: null, millage: null, grossTax: total, netTax: total,
          units: units ?? undefined,
        });
      }
      continue;
    }

    if (millage != null && (assessment != null || grossTax != null)) {
      data.authorities!.push({
        name, taxableAssessment: assessment, millage, grossTax, netTax,
      });
    }
  }

  // ─── Subtotals ───
  for (const line of lines) {
    let m = line.match(/county\s+subtotal\s*\([\d.]+%\)?\s*\t?([\d,]+\.?\d*)/i);
    if (m) data.countySubtotal = parseNum(m[1]);
    m = line.match(/school\s+subtotal\s*\([\d.]+%\)?\s*\t?([\d,]+\.?\d*)/i);
    if (m) data.schoolSubtotal = parseNum(m[1]);
    m = line.match(/other\s+subtotal\s*\([\d.]+%\)?\s*\t?([\d,]+\.?\d*)/i);
    if (m) data.otherSubtotal = parseNum(m[1]);
  }

  // ─── Total millage rate ─── (DeKalb format: standalone line "0.044335 1,734,481.13")
  for (const line of lines) {
    const m = line.match(/^(0\.\d{4,6})\s+([\d,]+\.\d{2})/);
    if (m) {
      data.millageRate = parseNum(m[1]);
      const tax = parseNum(m[2]);
      if (tax && tax > 1000) data.totalAnnualTax = tax;
      break;
    }
  }

  // ─── Total annual tax — multiple potential phrases ───
  if (!data.totalAnnualTax || data.totalAnnualTax === 0) {
    for (const line of lines) {
      const m = line.match(/total\s+annual\s+tax[\s:]*\$?([\d,]+\.?\d*)/i)
            || line.match(/(?:20\d{2}\s+)?total\s+(?:annual\s+)?tax[\s:]*\$?([\d,]+\.?\d*)/i);
      if (m) {
        const v = parseNum(m[1]);
        if (v != null && v > data.totalAnnualTax) data.totalAnnualTax = v;
      }
    }
  }

  // ─── Prior year balance and total payoff ───
  for (const line of lines) {
    let m = line.match(/prior\s+year\s+balance[\s:*]*\$?([\d,]+\.?\d*)/i);
    if (m) data.priorYearBalance = parseNum(m[1]);
    m = line.match(/total\s+payoff[\s:*]*\$?([\d,]+\.?\d*)/i);
    if (m) data.totalPayoff = parseNum(m[1]);
  }

  // ─── Backward compat: legacy fields ───
  if (data.appealAssessment != null && data.assessedValueAppeal == null) {
    data.assessedValueAppeal = data.appealAssessment;
  }
  if (data.baseAssessment != null && data.assessedValue == null) {
    data.assessedValue = data.baseAssessment;
  }
  if (data.totalAppraisal != null && data.fairMarketValue == null) {
    data.fairMarketValue = data.totalAppraisal;
  }

  // ─── Quality warnings ───
  if (data.totalAnnualTax === 0) warnings.push('Could not extract total annual tax');
  if (!data.parcelId) warnings.push('Could not extract parcel ID');
  if (data.appealStatus === 'pending' && !data.unappealedTaxAmount) {
    warnings.push('Appeal pending but unappealed tax amount not captured');
  }
  if (data.authorities && data.authorities.length < 3) {
    warnings.push(`Only ${data.authorities.length} taxing authorities parsed (expected 5+ for typical county bill)`);
  }

  return { data, warnings };
}

export function parseTaxBill(buffer: Buffer, filename: string): ExtractionResult {
  // Sync entry point — only useful for non-PDF inputs (e.g., text dumps)
  const text = buffer.toString('utf-8');
  const { data, warnings } = parseFromText(text);
  if (data.totalAnnualTax === 0 && !data.parcelId) {
    return {
      documentType: 'TAX_BILL', success: false,
      error: 'Could not extract tax data from text — file may be a binary PDF requiring async extraction',
      data: null, summary: {}, warnings,
    };
  }
  return {
    documentType: 'TAX_BILL', success: true, data: data as TaxBillData,
    summary: {
      parcelId: data.parcelId,
      totalAnnualTax: data.totalAnnualTax,
      appealStatus: data.appealStatus,
      assessedValue: data.assessedValue,
      taxYear: data.taxYear,
    },
    warnings,
  };
}

export async function parseTaxBillAsync(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const text = await extractPdfText(buffer);

  if (!text || text.length < 50) {
    return {
      documentType: 'TAX_BILL', success: false,
      error: 'Could not extract text from PDF — may be scanned/image-based and require OCR',
      data: null, summary: {}, warnings: [],
    };
  }

  const { data, warnings } = parseFromText(text);

  if (data.totalAnnualTax === 0 && !data.parcelId) {
    return {
      documentType: 'TAX_BILL', success: false,
      error: 'PDF text extracted but no tax data fields recognized — format may not be supported',
      data: null, summary: {}, warnings,
    };
  }

  return {
    documentType: 'TAX_BILL',
    success: true,
    data: data as TaxBillData,
    summary: {
      parcelId: data.parcelId,
      countyPin: data.countyPin,
      situsAddress: data.situsAddress,
      taxDistrict: data.taxDistrict,
      ownerName: data.ownerName,
      ownerAddress: data.ownerAddress,
      taxYear: data.taxYear,
      totalAppraisal: data.totalAppraisal,
      baseAssessment: data.baseAssessment,
      appealAssessment: data.appealAssessment,
      assessedValue: data.assessedValue,
      millageRate: data.millageRate,
      totalAnnualTax: data.totalAnnualTax,
      unappealedTaxAmount: data.unappealedTaxAmount,
      appealStatus: data.appealStatus,
      countySubtotal: data.countySubtotal,
      schoolSubtotal: data.schoolSubtotal,
      otherSubtotal: data.otherSubtotal,
      priorYearBalance: data.priorYearBalance,
      totalPayoff: data.totalPayoff,
      authorityCount: data.authorities?.length ?? 0,
    },
    warnings,
  };
}
