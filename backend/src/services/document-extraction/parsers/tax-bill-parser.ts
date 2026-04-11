import { TaxBillData, ExtractionResult } from '../types';

function parseNum(val: any): number | null {
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
  try {
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
    const result = await pdfParse(buffer);
    return result.text || '';
  } catch {
    return buffer.toString('utf-8');
  }
}

function parseFromText(text: string): TaxBillData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const data: TaxBillData = {
    parcelId: null,
    assessedValue: null,
    assessedLand: null,
    assessedImprovement: null,
    assessedValueAppeal: null,
    fairMarketValue: null,
    totalAnnualTax: 0,
    millageRate: null,
    taxingAuthority: null,
    ownerName: null,
    ownerAddress: null,
    appealStatus: null,
    taxYear: null,
    authorities: [],
  };

  for (const line of lines) {
    const lower = line.toLowerCase();

    const parcelMatch = line.match(/parcel[\s#:]*([A-Z0-9\-\.]+)/i);
    if (parcelMatch && !data.parcelId) data.parcelId = parcelMatch[1];

    const assessedMatch = line.match(/assessed[\s]*value[\s:]*\$?([\d,]+\.?\d*)/i);
    if (assessedMatch && !data.assessedValue) data.assessedValue = parseNum(assessedMatch[1]);

    const landMatch = line.match(/(?:assessed[\s]*)?land[\s]*(?:value)?[\s:]*\$?([\d,]+\.?\d*)/i);
    if (landMatch && lower.includes('land') && !data.assessedLand) data.assessedLand = parseNum(landMatch[1]);

    const improvMatch = line.match(/improvement[\s]*(?:value)?[\s:]*\$?([\d,]+\.?\d*)/i);
    if (improvMatch && !data.assessedImprovement) data.assessedImprovement = parseNum(improvMatch[1]);

    const authMatch = line.match(/taxing[\s]*(?:authority|district|jurisdiction)[\s:]+(.+)/i);
    if (authMatch && !data.taxingAuthority) data.taxingAuthority = authMatch[1].trim();

    const fmvMatch = line.match(/fair[\s]*market[\s]*value[\s:]*\$?([\d,]+\.?\d*)/i);
    if (fmvMatch) data.fairMarketValue = parseNum(fmvMatch[1]);

    const totalTaxMatch = line.match(/total[\s]*(annual[\s]*)?tax[\s:]*\$?([\d,]+\.?\d*)/i);
    if (totalTaxMatch) {
      const val = parseNum(totalTaxMatch[2]);
      if (val != null) data.totalAnnualTax = val;
    }

    const millageMatch = line.match(/mill(age)?[\s]*rate[\s:]*(\d+\.?\d*)/i);
    if (millageMatch) data.millageRate = parseNum(millageMatch[2]);

    const ownerMatch = line.match(/owner[\s]*(?:name)?[\s:]+(.+)/i);
    if (ownerMatch && !data.ownerName) {
      const name = ownerMatch[1].trim();
      if (name.length > 2 && !/^[\d$]/i.test(name)) data.ownerName = name;
    }

    const yearMatch = line.match(/tax[\s]*year[\s:]*(\d{4})/i) || line.match(/(\d{4})[\s]*tax[\s]*bill/i);
    if (yearMatch) data.taxYear = parseInt(yearMatch[1]);

    if (lower.includes('appeal')) {
      if (lower.includes('pending')) data.appealStatus = 'pending';
      else if (lower.includes('approved') || lower.includes('granted')) data.appealStatus = 'approved';
      else if (lower.includes('denied') || lower.includes('rejected')) data.appealStatus = 'denied';
      else data.appealStatus = 'filed';

      const appealVal = line.match(/appeal[\s]*(?:value)?[\s:]*\$?([\d,]+\.?\d*)/i);
      if (appealVal) data.assessedValueAppeal = parseNum(appealVal[1]);
    }

    const authorityMatch = line.match(/^(.+?)[\s]+(\d+\.?\d*)[\s]+\$?([\d,]+\.?\d*)/);
    if (authorityMatch && (lower.includes('county') || lower.includes('city') || lower.includes('school') || lower.includes('district') || lower.includes('authority') || lower.includes('fire') || lower.includes('bond'))) {
      data.authorities.push({
        name: authorityMatch[1].trim(),
        rate: parseFloat(authorityMatch[2]) || 0,
        amount: parseNum(authorityMatch[3]) || 0,
      });
    }
  }

  if (data.totalAnnualTax === 0 && data.authorities.length > 0) {
    data.totalAnnualTax = data.authorities.reduce((s, a) => s + a.amount, 0);
  }

  return data;
}

export async function parseTaxBillAsync(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    const isPdf = /\.pdf$/i.test(filename);
    let text: string;

    if (isPdf) {
      text = await extractPdfText(buffer);
      if (!text || text.trim().length < 50) {
        warnings.push('PDF text extraction yielded minimal content — scanned document may require OCR');
      }
    } else {
      text = buffer.toString('utf-8');
    }

    const data = parseFromText(text);

    if (!data.assessedValue && !data.totalAnnualTax && !data.parcelId) {
      return {
        documentType: 'TAX_BILL',
        success: false,
        error: isPdf
          ? 'Could not extract tax data — PDF may be scanned/image-based and require OCR'
          : 'Could not extract tax data from text content',
        data: null,
        summary: {},
        warnings,
      };
    }

    return {
      documentType: 'TAX_BILL',
      success: true,
      data,
      summary: {
        parcelId: data.parcelId,
        assessedValue: data.assessedValue,
        totalAnnualTax: data.totalAnnualTax,
        taxYear: data.taxYear,
        millageRate: data.millageRate,
        appealStatus: data.appealStatus,
      },
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'TAX_BILL', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}

export function parseTaxBill(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];
  const isPdf = /\.pdf$/i.test(filename);

  if (isPdf) {
    return {
      documentType: 'TAX_BILL',
      success: false,
      error: 'PDF tax bills require async processing — use parseTaxBillAsync',
      data: null,
      summary: {},
      warnings: ['PDF requires async parsing via parseTaxBillAsync'],
    };
  }

  try {
    const text = buffer.toString('utf-8');
    const data = parseFromText(text);

    if (!data.assessedValue && !data.totalAnnualTax && !data.parcelId) {
      return {
        documentType: 'TAX_BILL',
        success: false,
        error: 'Could not extract tax data from text content',
        data: null,
        summary: {},
        warnings,
      };
    }

    return {
      documentType: 'TAX_BILL',
      success: true,
      data,
      summary: {
        parcelId: data.parcelId,
        assessedValue: data.assessedValue,
        totalAnnualTax: data.totalAnnualTax,
        taxYear: data.taxYear,
        millageRate: data.millageRate,
        appealStatus: data.appealStatus,
      },
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'TAX_BILL', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
