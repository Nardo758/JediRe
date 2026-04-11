import * as XLSX from 'xlsx';
import { LTOData, LTORecord, ExtractionResult } from '../types';

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

function parseDate(val: any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const usMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (usMatch) {
    const yr = usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${yr}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

export function parseLTO(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    if (rows.length === 0) {
      return { documentType: 'T30_LTO', success: false, error: 'No data rows', data: null, summary: {}, warnings };
    }

    const headers = Object.keys(rows[0]);
    const unitCol = findCol(headers, [/^unit/i, /^apt/i, /^space/i]);
    const typeCol = findCol(headers, [/unit[\s_-]*type/i, /type/i, /plan/i, /model/i]);
    const txTypeCol = findCol(headers, [/new[\s_-]*\/[\s_-]*renewal/i, /transaction/i, /lease[\s_-]*type/i, /n[\s_-]*\/[\s_-]*r/i]);
    const leaseRentCol = findCol(headers, [/lease[\s_-]*rent/i, /new[\s_-]*rent/i, /contract/i, /rent$/i]);
    const concessionCol = findCol(headers, [/concession/i, /conc$/i]);
    const effectiveCol = findCol(headers, [/effective/i, /eff[\s_-]*rent/i]);
    const marketCol = findCol(headers, [/market/i, /asking/i, /mkt/i]);
    const priorCol = findCol(headers, [/prior/i, /previous/i, /old[\s_-]*rent/i]);
    const changeCol = findCol(headers, [/change/i, /gain/i, /loss/i, /variance/i, /delta/i]);
    const changePctCol = findCol(headers, [/change[\s_-]*%/i, /%[\s_-]*change/i, /gain[\s_-]*%/i]);
    const startCol = findCol(headers, [/lease[\s_-]*(from|start|begin)/i, /start/i]);
    const endCol = findCol(headers, [/lease[\s_-]*(to|end|expir)/i, /end/i, /expir/i]);
    const tenantCol = findCol(headers, [/tenant/i, /resident/i, /name/i]);

    if (!unitCol) {
      return { documentType: 'T30_LTO', success: false, error: 'Could not identify unit column', data: null, summary: {}, warnings };
    }

    const records: LTORecord[] = [];

    for (const row of rows) {
      const unitNum = String(row[unitCol] || '').trim();
      if (!unitNum || /^(total|subtotal|grand|summary|avg|average)/i.test(unitNum)) continue;

      const txType = txTypeCol ? String(row[txTypeCol] || '').trim().toLowerCase() : '';
      const isNew = /new|n$/i.test(txType);
      const isRenewal = /renewal|renew|r$/i.test(txType);
      const transactionType = isNew ? 'new' : (isRenewal ? 'renewal' : 'other');

      const leaseRent = leaseRentCol ? parseNum(row[leaseRentCol]) ?? 0 : 0;
      const concession = concessionCol ? parseNum(row[concessionCol]) ?? 0 : 0;
      const effectiveRent = effectiveCol ? parseNum(row[effectiveCol]) ?? (leaseRent - concession) : (leaseRent - concession);
      const priorRent = priorCol ? parseNum(row[priorCol]) : null;
      const rentChange = changeCol ? parseNum(row[changeCol]) : (priorRent != null ? leaseRent - priorRent : null);
      const rentChangePct = changePctCol ? parseNum(row[changePctCol]) : (priorRent && priorRent > 0 && rentChange != null ? rentChange / priorRent : null);

      records.push({
        unitNumber: unitNum,
        unitType: typeCol ? String(row[typeCol] || '').trim() || null : null,
        transactionType,
        leaseRent,
        concession,
        effectiveRent,
        marketRent: marketCol ? parseNum(row[marketCol]) : null,
        priorRent,
        rentChange,
        rentChangePct,
        leaseStart: startCol ? parseDate(row[startCol]) : null,
        leaseEnd: endCol ? parseDate(row[endCol]) : null,
        tenantName: tenantCol ? String(row[tenantCol] || '').trim() || null : null,
      });
    }

    const newLeases = records.filter(r => r.transactionType === 'new');
    const renewals = records.filter(r => r.transactionType === 'renewal');

    const avgNewRent = newLeases.length > 0 ? newLeases.reduce((s, r) => s + r.leaseRent, 0) / newLeases.length : 0;
    const avgRenewalRent = renewals.length > 0 ? renewals.reduce((s, r) => s + r.leaseRent, 0) / renewals.length : 0;

    const tradeOuts = records.filter(r => r.rentChange != null);
    const avgTradeOutGain = tradeOuts.length > 0 ? tradeOuts.reduce((s, r) => s + (r.rentChange || 0), 0) / tradeOuts.length : 0;
    const avgTradeOutGainPct = tradeOuts.length > 0 ? tradeOuts.reduce((s, r) => s + (r.rentChangePct || 0), 0) / tradeOuts.length : 0;

    const newTradeOuts = newLeases.filter(r => r.rentChange != null);
    const renewalTradeOuts = renewals.filter(r => r.rentChange != null);
    const avgNewTradeOut = newTradeOuts.length > 0 ? newTradeOuts.reduce((s, r) => s + (r.rentChange || 0), 0) / newTradeOuts.length : 0;
    const avgRenewalTradeOut = renewalTradeOuts.length > 0 ? renewalTradeOuts.reduce((s, r) => s + (r.rentChange || 0), 0) / renewalTradeOuts.length : 0;

    const data: LTOData = {
      records,
      summary: {
        totalTransactions: records.length,
        newLeases: newLeases.length,
        renewals: renewals.length,
        avgNewLeaseRent: avgNewRent,
        avgRenewalRent,
        avgTradeOutGain,
        avgTradeOutGainPct,
        avgNewTradeOut,
        avgRenewalTradeOut,
      },
    };

    return { documentType: 'T30_LTO', success: true, data, summary: data.summary, warnings };
  } catch (err) {
    return {
      documentType: 'T30_LTO', success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null, summary: {}, warnings,
    };
  }
}
