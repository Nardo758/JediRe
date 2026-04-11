import * as XLSX from 'xlsx';
import { RentRollData, RentRollUnit, ExtractionResult } from '../types';

const UNIT_COL_PATTERNS = [/^unit/i, /^apt/i, /^space/i, /^#/];
const STATUS_COL_PATTERNS = [/status/i, /resident/i, /tenant/i, /occupant/i, /name/i];
const TYPE_COL_PATTERNS = [/unit[\s_-]*type/i, /type/i, /plan/i, /floor[\s_-]*plan/i, /model/i];
const SQFT_COL_PATTERNS = [/sq[\s_-]*ft/i, /sqft/i, /square/i, /size/i, /sf$/i];
const MARKET_RENT_PATTERNS = [/market[\s_-]*rent/i, /asking/i, /mkt[\s_-]*rent/i];
const LEASE_RENT_PATTERNS = [/lease[\s_-]*(rent|charge)/i, /monthly[\s_-]*rent/i, /current[\s_-]*rent/i, /rent$/i, /charge[\s_-]*total/i];
const MOVE_IN_PATTERNS = [/move[\s_-]*in/i, /movein/i];
const LEASE_START_PATTERNS = [/lease[\s_-]*(from|start|begin)/i, /start[\s_-]*date/i];
const LEASE_END_PATTERNS = [/lease[\s_-]*(to|end|expir)/i, /expir/i, /end[\s_-]*date/i];
const DEPOSIT_PATTERNS = [/deposit/i, /security/i];
const BALANCE_PATTERNS = [/balance/i, /owing/i, /owed/i];

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) {
      if (p.test(h)) return h;
    }
  }
  return null;
}

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
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
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

const KNOWN_CHARGE_CODES = ['rent', 'parking', 'trash', 'pestctrl', 'storage', 'utilreb', 'petrent', 'mtmfee', 'cable', 'water', 'sewer', 'electric', 'gas', 'internet', 'amenity', 'garage'];

function detectChargeColumns(headers: string[]): string[] {
  return headers.filter(h => {
    const lower = h.toLowerCase().trim();
    return KNOWN_CHARGE_CODES.some(c => lower.includes(c)) || lower.includes('charge');
  });
}

export function parseRentRoll(buffer: Buffer, filename: string): ExtractionResult {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    if (allRows.length === 0) {
      return { documentType: 'RENT_ROLL', success: false, error: 'No data rows', data: null, summary: {}, warnings };
    }

    const headers = Object.keys(allRows[0]);
    const unitCol = findCol(headers, UNIT_COL_PATTERNS);
    const statusCol = findCol(headers, STATUS_COL_PATTERNS);
    const typeCol = findCol(headers, TYPE_COL_PATTERNS);
    const sqftCol = findCol(headers, SQFT_COL_PATTERNS);
    const marketRentCol = findCol(headers, MARKET_RENT_PATTERNS);
    const leaseRentCol = findCol(headers, LEASE_RENT_PATTERNS);
    const moveInCol = findCol(headers, MOVE_IN_PATTERNS);
    const leaseStartCol = findCol(headers, LEASE_START_PATTERNS);
    const leaseEndCol = findCol(headers, LEASE_END_PATTERNS);
    const depositCol = findCol(headers, DEPOSIT_PATTERNS);
    const balanceCol = findCol(headers, BALANCE_PATTERNS);
    const chargeCols = detectChargeColumns(headers);

    if (!unitCol) {
      return { documentType: 'RENT_ROLL', success: false, error: 'Could not identify unit number column', data: null, summary: {}, warnings };
    }

    const futureResidentMarkers = ['future', 'pre-leased', 'applicant', 'approved'];
    const units: RentRollUnit[] = [];

    for (const row of allRows) {
      const unitNum = String(row[unitCol] || '').trim();
      if (!unitNum || /^(total|subtotal|summary|grand|page|report)/i.test(unitNum)) continue;

      const statusVal = statusCol ? String(row[statusCol] || '').trim() : '';
      const isFuture = futureResidentMarkers.some(m => statusVal.toLowerCase().includes(m));
      const isVacant = /vacant|vac\b|empty|available|unoccupied/i.test(statusVal) && !isFuture;

      const charges: Record<string, number> = {};
      let totalCharges = 0;
      for (const cc of chargeCols) {
        const v = parseNum(row[cc]);
        if (v != null && v > 0) {
          charges[cc] = v;
          totalCharges += v;
        }
      }

      const leaseRent = parseNum(row[leaseRentCol || '']);
      const effectiveRent = leaseRent || (totalCharges > 0 ? totalCharges : null);

      units.push({
        unitNumber: unitNum,
        unitType: typeCol ? String(row[typeCol] || '').trim() : '',
        sqft: sqftCol ? parseNum(row[sqftCol]) : null,
        status: isVacant ? 'vacant' : (isFuture ? 'future' : 'occupied'),
        tenantName: statusCol && !isVacant ? statusVal : null,
        marketRent: marketRentCol ? parseNum(row[marketRentCol]) : null,
        leaseRent,
        effectiveRent,
        charges,
        totalCharges,
        deposit: depositCol ? parseNum(row[depositCol]) : null,
        balance: balanceCol ? parseNum(row[balanceCol]) : null,
        moveInDate: moveInCol ? parseDate(row[moveInCol]) : null,
        leaseStart: leaseStartCol ? parseDate(row[leaseStartCol]) : null,
        leaseEnd: leaseEndCol ? parseDate(row[leaseEndCol]) : null,
        moveOutDate: null,
        isFutureResident: isFuture,
      });
    }

    const currentUnits = units.filter(u => !u.isFutureResident);
    const occupiedUnits = currentUnits.filter(u => u.status === 'occupied');
    const vacantUnits = currentUnits.filter(u => u.status === 'vacant');

    const totalMarketRent = currentUnits.reduce((s, u) => s + (u.marketRent || 0), 0);
    const totalLeaseCharges = occupiedUnits.reduce((s, u) => s + (u.effectiveRent || 0), 0);
    const lossToLease = totalMarketRent - totalLeaseCharges;

    const fpMix: Record<string, { count: number; totalRent: number; totalSqft: number }> = {};
    for (const u of currentUnits) {
      const fp = u.unitType || 'unknown';
      if (!fpMix[fp]) fpMix[fp] = { count: 0, totalRent: 0, totalSqft: 0 };
      fpMix[fp].count++;
      fpMix[fp].totalRent += u.effectiveRent || u.marketRent || 0;
      fpMix[fp].totalSqft += u.sqft || 0;
    }

    const floorPlanMix: Record<string, { count: number; avgRent: number; avgSqft: number }> = {};
    for (const [fp, data] of Object.entries(fpMix)) {
      floorPlanMix[fp] = {
        count: data.count,
        avgRent: data.count > 0 ? Math.round(data.totalRent / data.count) : 0,
        avgSqft: data.count > 0 ? Math.round(data.totalSqft / data.count) : 0,
      };
    }

    const data: RentRollData = {
      units,
      summary: {
        totalUnits: currentUnits.length,
        occupiedUnits: occupiedUnits.length,
        vacantUnits: vacantUnits.length,
        occupancyRate: currentUnits.length > 0 ? occupiedUnits.length / currentUnits.length : 0,
        totalMarketRent,
        totalLeaseCharges,
        lossToLease,
        lossToLeasePct: totalMarketRent > 0 ? lossToLease / totalMarketRent : 0,
        avgMarketRent: currentUnits.length > 0 ? totalMarketRent / currentUnits.length : 0,
        avgEffectiveRent: occupiedUnits.length > 0 ? totalLeaseCharges / occupiedUnits.length : 0,
        futureResidents: units.filter(u => u.isFutureResident).length,
        floorPlanMix,
      },
    };

    return {
      documentType: 'RENT_ROLL',
      success: true,
      data,
      summary: data.summary,
      warnings,
    };
  } catch (err) {
    return {
      documentType: 'RENT_ROLL',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parse error',
      data: null,
      summary: {},
      warnings,
    };
  }
}
