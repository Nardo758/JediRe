import * as XLSX from 'xlsx';
import { RentRollData, RentRollUnit, ExtractionResult } from '../types';
import { findHeaderRow, parseSheetFromRow, parseNum, parseDate } from './workbook-utils';
import type { RentRollLayout } from '../types';

// ============================================================================
// Rent Roll Parser v2 — Yardi RRwLC + generic-flat dual-mode
//
// Yardi "Rent Roll with Lease Charges" layout signature:
//   - Two-row header (col headers in row N, sub-labels in row N+1)
//   - Per-unit primary row: unit_no | unit_type | sqft | resident | market_rent | <blank charge> | 0 | dep | dep | mi | exp | mo | bal
//   - Followed by N "charge code" sub-rows: blank | blank | blank | blank | blank | <code> | amount | blank...
//   - Followed by a "Total" sub-row with the unit's lease charge sum
//   - Section breaks: "Current/Notice/Vacant Residents", "Future Residents/Applicants"
//
// Generic flat layout: one row per unit, named columns for each field.
// ============================================================================

const KNOWN_CHARGE_CODES = new Set([
  'rent', 'parking', 'trash', 'pestctrl', 'storage', 'utilreb', 'petrent',
  'mtmfee', 'cable', 'water', 'sewer', 'electric', 'gas', 'internet',
  'amenity', 'garage', 'liabins', 'misc', 'renew', 'empdisc', 'patrol',
  'otconc', 'othconc', 'termfee', 'concierge', 'pet', 'admin', 'app',
  'crtsyoff', 'courtesy', 'employee', 'upfrtcon', 'upfront',
]);

// Income-category mapping for charge codes (lands in capsule.other_income_monthly)
const CHARGE_CODE_CATEGORY: Record<string, 'rent' | 'parking' | 'pet_rent' | 'storage' | 'rubs' | 'fees' | 'insurance_admin' | 'concessions' | 'other'> = {
  rent: 'rent',
  parking: 'parking', garage: 'parking',
  petrent: 'pet_rent', pet: 'pet_rent',
  storage: 'storage',
  pestctrl: 'rubs', trash: 'rubs', utilreb: 'rubs',
  water: 'rubs', sewer: 'rubs', electric: 'rubs', gas: 'rubs', cable: 'rubs', internet: 'rubs',
  mtmfee: 'fees', termfee: 'fees', misc: 'fees', admin: 'fees', app: 'fees',
  liabins: 'insurance_admin',
  // Concessions / employee discounts. Yardi exports vary the spelling
  // (`otconc` vs `othconc`, `empdisc` vs `employee`, `crtsyoff` for "courtesy off",
  // `upfrtcon` for "upfront concession"). All land in concessions_other so
  // they don't pollute the `other` ancillary bucket as large negatives.
  empdisc: 'concessions', otconc: 'concessions', othconc: 'concessions',
  employee: 'concessions', crtsyoff: 'concessions', courtesy: 'concessions',
  upfrtcon: 'concessions', upfront: 'concessions',
  renew: 'concessions', patrol: 'concessions',
  amenity: 'fees', concierge: 'fees',
};

const FUTURE_RESIDENT_MARKERS = ['future', 'pre-leased', 'pre leased', 'applicant', 'approved'];

interface YardiUnit {
  unitNumber: string;
  unitType: string;
  sqft: number | null;
  resident: string | null;
  marketRent: number | null;
  securityDeposit: number | null;
  otherDeposit: number | null;
  moveInDate: Date | null;
  leaseExpiration: Date | null;
  moveOutDate: Date | null;
  balance: number | null;
  charges: Record<string, number>;
  totalCharges: number;
  isVacant: boolean;
  isFuture: boolean;
  isNonRevenue: boolean;       // employee/courtesy/model
}

/**
 * Detect rent-roll layout based on header structure and row patterns.
 */
function detectLayout(sheet: XLSX.WorkSheet): { layout: RentRollLayout; headerRow: number; secondHeaderRow?: number } {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxScan = Math.min(range.e.r, 25);

  // Look for the Yardi RRwLC signature: a row with "Charge" + "Code" fragments
  // (header row N has "Charge" in one col; row N+1 has "Code" in same col)
  for (let r = 0; r <= maxScan; r++) {
    const rowVals: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      rowVals.push(cell?.v != null ? String(cell.v).trim() : '');
    }
    const hasCharge = rowVals.some(v => /^charge$/i.test(v));
    const hasUnit = rowVals.some(v => /^unit$/i.test(v));
    const hasMarket = rowVals.some(v => /^market$/i.test(v));

    if (hasCharge && hasUnit && hasMarket) {
      // Verify the row N+1 has matching sub-labels ("Code", "Rent", "Sq Ft", etc.)
      const subRowVals: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: r + 1, c })];
        subRowVals.push(cell?.v != null ? String(cell.v).trim() : '');
      }
      const hasCode = subRowVals.some(v => /^code$/i.test(v));
      const hasRent = subRowVals.some(v => /^rent$/i.test(v));

      if (hasCode && hasRent) {
        return { layout: 'yardi_rrwlc', headerRow: r, secondHeaderRow: r + 1 };
      }
    }
  }

  // Generic flat: standard headers on a single row
  const headerPatterns = [/unit/i, /resident|tenant|name/i, /rent/i, /sqft|sq.*ft|sf/i, /lease/i];
  const headerRow = findHeaderRow(sheet, headerPatterns, 25, 3);
  return { layout: 'generic_flat', headerRow };
}

/**
 * Detect actual column indices for a Yardi RRwLC sheet by reading the
 * two-row stacked header. Yardi exports vary between properties — some
 * collapse Resident ID + Name into a single column, others split them
 * into two; some omit Other Deposit; etc. Hardcoding indices made the
 * parser silently shred any file whose column layout drifted from the
 * "canonical" 13-column shape.
 *
 * Strategy: combine header-row + sub-header-row text per column into a
 * single label, then locate each logical field by regex. Returns -1 for
 * any field that cannot be matched; callers must guard.
 */
function detectYardiColumns(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  subHeaderRow: number,
): { UNIT: number; TYPE: number; SQFT: number; RESIDENT: number; MARKET: number;
     CHARGE: number; AMOUNT: number; SEC_DEP: number; OTHER_DEP: number;
     MOVE_IN: number; LEASE_EXP: number; MOVE_OUT: number; BALANCE: number } {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const labels: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const top = sheet[XLSX.utils.encode_cell({ r: headerRow, c })]?.v;
    const bot = sheet[XLSX.utils.encode_cell({ r: subHeaderRow, c })]?.v;
    const t = top != null ? String(top).trim().toLowerCase() : '';
    const b = bot != null ? String(bot).trim().toLowerCase() : '';
    labels.push(`${t} ${b}`.trim());
  }
  // labels[i] corresponds to absolute sheet column (range.s.c + i). Callers
  // pass absolute column indices to getVal/encode_cell, so we must offset
  // any findIndex result by range.s.c (otherwise sheets whose !ref starts
  // past column A would resolve to the wrong physical column).
  const base = range.s.c;
  const toAbs = (i: number): number => (i < 0 ? -1 : base + i);
  const find = (rx: RegExp): number => toAbs(labels.findIndex(s => rx.test(s)));

  // First "unit" column that isn't "unit type" — the unit number.
  const UNIT = toAbs(labels.findIndex(s => /\bunit\b/.test(s) && !/unit\s*type/.test(s) && !/sq\s*ft|sqft/.test(s)));
  const TYPE = find(/unit\s*type/);
  const SQFT = find(/sq\s*ft|sqft|square\s*(feet|ft)/);
  const MARKET = find(/market.*rent|mkt.*rent|asking/);
  const CHARGE = find(/charge.*code/);
  // "amount" must NOT match the leading "amount" inside charge-code descriptions
  const AMOUNT = toAbs(labels.findIndex(s => /^amount\b|\bcharge\s*amount\b|^amt\b/.test(s)));
  const SEC_DEP = find(/resident\s*deposit|security\s*deposit|sec\.?\s*dep/);
  const OTHER_DEP = find(/other\s*deposit/);
  const MOVE_IN = find(/move\s*[-/_ ]?\s*in/);
  const LEASE_EXP = find(/lease.*(expir|end)|expir/);
  const MOVE_OUT = find(/move\s*[-/_ ]?\s*out/);
  const BALANCE = find(/balance/);
  // Resident column: the column immediately to the LEFT of MARKET tends to
  // be the resident name (or, for files that split ID + Name, the name).
  // Falling back to col 3 preserves the canonical layout.
  const RESIDENT = MARKET > base ? MARKET - 1 : base + 3;

  return { UNIT, TYPE, SQFT, RESIDENT, MARKET, CHARGE, AMOUNT, SEC_DEP, OTHER_DEP, MOVE_IN, LEASE_EXP, MOVE_OUT, BALANCE };
}

/**
 * Parse Yardi RRwLC (stacked charge-code) layout.
 */
function parseYardiRRwLC(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  subHeaderRow: number,
): {
  units: YardiUnit[];
  warnings: string[];
  asOfDate: string | null;
  sourceSystemId: string | null;
  /** Task #514 — which logical fields were resolved by header text vs fell
   *  back to the hardcoded canonical Yardi column index. Used by column_coverage
   *  to distinguish 'ok' (detected) from 'fallback' / 'missing'. */
  headerDetected: Record<'unit_no' | 'unit_type' | 'sqft' | 'market_rent' | 'charge_code' | 'amount' | 'lease_expiration', boolean>;
} {
  const warnings: string[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // Extract metadata from rows 0 to headerRow
  let asOfDate: string | null = null;
  let sourceSystemId: string | null = null;
  for (let r = 0; r < headerRow; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const txt = cell?.v != null ? String(cell.v).trim() : '';
    const asOfMatch = txt.match(/As\s+Of\s*=?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
    if (asOfMatch) asOfDate = parseDate(asOfMatch[1]);
    const propIdMatch = txt.match(/\(([a-z0-9]{4,15})\)\s*$/i);
    if (propIdMatch) sourceSystemId = propIdMatch[1];
  }

  // Column indices — detect dynamically from header rows so files that split
  // Resident into ID+Name columns (or otherwise drift from the canonical
  // 13-column Yardi layout) still parse correctly. Falls back to the
  // historical hardcoded layout for any field not detected.
  const detected = detectYardiColumns(sheet, headerRow, subHeaderRow);
  const COL = {
    UNIT:      detected.UNIT      >= 0 ? detected.UNIT      : 0,
    TYPE:      detected.TYPE      >= 0 ? detected.TYPE      : 1,
    SQFT:      detected.SQFT      >= 0 ? detected.SQFT      : 2,
    RESIDENT:  detected.RESIDENT  >= 0 ? detected.RESIDENT  : 3,
    MARKET:    detected.MARKET    >= 0 ? detected.MARKET    : 4,
    CHARGE:    detected.CHARGE    >= 0 ? detected.CHARGE    : 5,
    AMOUNT:    detected.AMOUNT    >= 0 ? detected.AMOUNT    : 6,
    SEC_DEP:   detected.SEC_DEP   >= 0 ? detected.SEC_DEP   : 7,
    OTHER_DEP: detected.OTHER_DEP >= 0 ? detected.OTHER_DEP : 8,
    MOVE_IN:   detected.MOVE_IN   >= 0 ? detected.MOVE_IN   : 9,
    LEASE_EXP: detected.LEASE_EXP >= 0 ? detected.LEASE_EXP : 10,
    MOVE_OUT:  detected.MOVE_OUT  >= 0 ? detected.MOVE_OUT  : 11,
    BALANCE:   detected.BALANCE   >= 0 ? detected.BALANCE   : 12,
  };

  const dataStartRow = headerRow + 2;  // skip both header rows

  let inFutureSection = false;
  const units: YardiUnit[] = [];
  let currentUnit: YardiUnit | null = null;

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const getVal = (c: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell?.v;
    };

    const unitVal = getVal(COL.UNIT);
    const unitStr = unitVal != null ? String(unitVal).trim() : '';

    // Section break detection
    if (unitStr) {
      if (/future\s+residents?/i.test(unitStr) || /applicants?/i.test(unitStr)) {
        inFutureSection = true;
        continue;
      }
      if (/current.*notice.*vacant/i.test(unitStr)) {
        inFutureSection = false;
        continue;
      }
      if (/^summary\s+groups?/i.test(unitStr)) break;          // end of unit data
      if (/^summary\s+of\s+charges/i.test(unitStr)) break;     // end of unit data
      if (/^totals?:?$/i.test(unitStr)) break;
    }

    // New unit row: has a unit number in col A AND a unit type in col B
    if (unitStr && /^[\dA-Z]+[\dA-Z\-]*$/i.test(unitStr) && getVal(COL.TYPE) != null) {
      // Save previous unit
      if (currentUnit) units.push(currentUnit);

      const resident = getVal(COL.RESIDENT);
      const residentStr = resident != null ? String(resident).trim() : '';
      const isVacant = /^vacant$/i.test(residentStr);
      const moveIn = parseDate(getVal(COL.MOVE_IN));
      const leaseExp = parseDate(getVal(COL.LEASE_EXP));
      const moveOut = parseDate(getVal(COL.MOVE_OUT));

      currentUnit = {
        unitNumber: unitStr,
        unitType: String(getVal(COL.TYPE) ?? '').trim(),
        sqft: parseNum(getVal(COL.SQFT)),
        resident: isVacant ? null : residentStr || null,
        marketRent: parseNum(getVal(COL.MARKET)),
        securityDeposit: parseNum(getVal(COL.SEC_DEP)),
        otherDeposit: parseNum(getVal(COL.OTHER_DEP)),
        moveInDate: moveIn ? new Date(moveIn) : null,
        leaseExpiration: leaseExp ? new Date(leaseExp) : null,
        moveOutDate: moveOut ? new Date(moveOut) : null,
        balance: parseNum(getVal(COL.BALANCE)),
        charges: {},
        totalCharges: 0,
        isVacant,
        isFuture: inFutureSection,
        isNonRevenue: false,
      };

      // Yardi space-saving convention: the FIRST charge for a unit may be carried
      // on the same row as the primary unit summary (cols F & G).
      const primaryChargeCode = getVal(COL.CHARGE);
      const primaryChargeAmt = parseNum(getVal(COL.AMOUNT));
      if (primaryChargeCode != null && primaryChargeAmt != null) {
        const codeStr = String(primaryChargeCode).trim().toLowerCase();
        if (codeStr && !/^total$/i.test(codeStr)) {
          // SUM: a unit may have multiple of the same charge code (e.g., 2 parking spaces)
          currentUnit.charges[codeStr] = (currentUnit.charges[codeStr] ?? 0) + primaryChargeAmt;
        }
      }
      continue;
    }

    // Sub-row for current unit: charge code in col F, amount in col G
    if (currentUnit && !unitStr) {
      const chargeCode = getVal(COL.CHARGE);
      const chargeAmount = parseNum(getVal(COL.AMOUNT));
      if (chargeCode != null && chargeAmount != null) {
        const codeStr = String(chargeCode).trim().toLowerCase();
        if (/^total$/i.test(codeStr)) {
          // Yardi unit-total row — captures sum of charges
          currentUnit.totalCharges = chargeAmount;
        } else if (codeStr) {
          // SUM: a unit may have multiple of the same charge code
          currentUnit.charges[codeStr] = (currentUnit.charges[codeStr] ?? 0) + chargeAmount;
        }
      }
      continue;
    }

    // Otherwise: blank row or unrecognized — skip
  }

  // Save final unit
  if (currentUnit) units.push(currentUnit);

  // Identify non-revenue units (employees/courtesy/model)
  // Heuristic: resident name starts with 'employee', 'courtesy', 'model'
  for (const u of units) {
    if (u.resident && /^(employee|courtesy|model|staff)/i.test(u.resident)) {
      u.isNonRevenue = true;
    }
  }

  if (units.length === 0) {
    warnings.push('No unit records detected in Yardi RRwLC layout');
  }

  return {
    units,
    warnings,
    asOfDate,
    sourceSystemId,
    headerDetected: {
      unit_no:          detected.UNIT      >= 0,
      unit_type:        detected.TYPE      >= 0,
      sqft:             detected.SQFT      >= 0,
      market_rent:      detected.MARKET    >= 0,
      charge_code:      detected.CHARGE    >= 0,
      amount:           detected.AMOUNT    >= 0,
      lease_expiration: detected.LEASE_EXP >= 0,
    },
  };
}

/**
 * Bedroom inference from unit type code.
 * Common conventions:
 *   - "pt_SA", "STU1", "S1A", "EFF" → Studio
 *   - "pt_1A", "1BR1", "1B1" → 1BR
 *   - "pt_2J", "2BR2", "2B2" → 2BR
 *   - "3BR", "pt_3A" → 3BR
 */
function inferBedrooms(unitType: string): string {
  const t = unitType.toLowerCase();
  if (/\b(studio|stu|eff|^s\d|_s\d|_sa)\b/.test(t)) return 'Studio';
  if (/(^|_|\b)1[a-z]?(\d|$|_)/.test(t) || /1br/.test(t)) return '1BR';
  if (/(^|_|\b)2[a-z]?(\d|$|_)/.test(t) || /2br/.test(t)) return '2BR';
  if (/(^|_|\b)3[a-z]?(\d|$|_)/.test(t) || /3br/.test(t)) return '3BR';
  if (/(^|_|\b)4[a-z]?(\d|$|_)/.test(t) || /4br/.test(t)) return '4BR+';
  return 'Unknown';
}

/** Convert an inferred bedroom-category string to a numeric bedroom count. */
function bedroomCountFromCategory(category: string): number {
  if (category === 'Studio') return 0;
  if (category === '1BR') return 1;
  if (category === '2BR') return 2;
  if (category === '3BR') return 3;
  if (category === '4BR+') return 4;
  return 1; // safe default for Unknown
}

/**
 * Infer bathroom count from a unit-type label.
 * Handles formats like "2BR/2BA", "1/1", "2 bath", or falls back to
 * beds-based heuristic (studio→1, 1BR→1, 2BR→2, 3BR+→2).
 */
function inferBathrooms(unitType: string, beds: number): number {
  const t = unitType.toLowerCase();
  // Explicit BA pattern: "/2BA", "2ba", "2 bath"
  const baM = t.match(/[\/\s](\d)\s*ba/) ?? t.match(/(\d)\s*ba/);
  if (baM) return parseInt(baM[1], 10);
  // Slash-separated "beds/baths" pattern e.g. "1/1", "2/2"
  const slashM = t.match(/\d+\s*\/\s*(\d+)/);
  if (slashM) return parseInt(slashM[1], 10);
  // Heuristic fallback
  return beds === 0 ? 1 : beds >= 3 ? 2 : beds;
}

export function parseRentRoll(buffer: Buffer, filename: string): ExtractionResult & { layout?: RentRollLayout; capsuleExtras?: Record<string, unknown> } {
  const warnings: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { layout, headerRow, secondHeaderRow } = detectLayout(sheet);

    let units: YardiUnit[] = [];
    let asOfDate: string | null = null;
    let sourceSystemId: string | null = null;
    // Task #514 — provenance for column_coverage. For Yardi we capture which
    // logical fields were resolved by header text; for generic_flat we set it
    // from the per-column findIndex results below.
    let headerDetected: Record<string, boolean> = {
      unit_no: false, unit_type: false, sqft: false, market_rent: false,
      charge_code: false, amount: false, lease_expiration: false,
    };

    if (layout === 'yardi_rrwlc') {
      const result = parseYardiRRwLC(sheet, headerRow, secondHeaderRow ?? headerRow + 1);
      units = result.units;
      asOfDate = result.asOfDate;
      sourceSystemId = result.sourceSystemId;
      headerDetected = result.headerDetected;
      warnings.push(...result.warnings);
    } else {
      // Fallback to generic single-row layout (legacy parser logic)
      // For brevity: invoke the existing single-row code path
      const { headers, rows } = parseSheetFromRow(sheet, headerRow);
      const unitColIdx = headers.findIndex(h => /^unit/i.test(h) || /^apt/i.test(h));
      const typeColIdx = headers.findIndex(h => /unit[\s_-]*type|type|plan|floor[\s_-]*plan/i.test(h));
      const sqftColIdx = headers.findIndex(h => /sq[\s_-]*ft|sqft|square|size|sf$/i.test(h));
      const marketColIdx = headers.findIndex(h => /market[\s_-]*rent|asking|mkt[\s_-]*rent/i.test(h));
      const rentColIdx = headers.findIndex(h => /lease[\s_-]*(rent|charge)|monthly[\s_-]*rent|current[\s_-]*rent|rent$|charge[\s_-]*total/i.test(h));
      const statusColIdx = headers.findIndex(h => /status|resident|tenant|occupant/i.test(h));
      // Task #514 — record header-detection provenance for the generic_flat
      // path so column_coverage can distinguish 'ok' (header found) from
      // 'missing' (no header AND no data). lease_expiration / charge_code /
      // amount stay false because this layout doesn't model them.
      headerDetected = {
        unit_no:          unitColIdx   >= 0,
        unit_type:        typeColIdx   >= 0,
        sqft:             sqftColIdx   >= 0,
        market_rent:      marketColIdx >= 0,
        charge_code:      false,
        amount:           rentColIdx   >= 0, // generic_flat conflates rent into a single col
        lease_expiration: false,
      };

      if (unitColIdx === -1) {
        return {
          documentType: 'RENT_ROLL', success: false,
          error: 'Could not identify unit number column (generic-flat layout)',
          data: null, summary: {}, warnings,
          layout,
        };
      }

      for (const row of rows) {
        const unitNum = String(row[headers[unitColIdx]] ?? '').trim();
        if (!unitNum || /^(total|subtotal|summary|grand|page|report)/i.test(unitNum)) continue;

        const statusVal = statusColIdx >= 0 ? String(row[headers[statusColIdx]] ?? '').trim() : '';
        const isVacant = /vacant|vac\b|empty|available|unoccupied/i.test(statusVal);
        const isFuture = FUTURE_RESIDENT_MARKERS.some(m => statusVal.toLowerCase().includes(m));

        const inPlaceRent = rentColIdx >= 0 ? parseNum(row[headers[rentColIdx]]) : null;
        units.push({
          unitNumber: unitNum,
          unitType: typeColIdx >= 0 ? String(row[headers[typeColIdx]] ?? '').trim() : '',
          sqft: sqftColIdx >= 0 ? parseNum(row[headers[sqftColIdx]]) : null,
          resident: isVacant ? null : statusVal || null,
          marketRent: marketColIdx >= 0 ? parseNum(row[headers[marketColIdx]]) : null,
          securityDeposit: null, otherDeposit: null,
          moveInDate: null, leaseExpiration: null, moveOutDate: null,
          balance: null,
          charges: inPlaceRent != null ? { rent: inPlaceRent } : {},
          totalCharges: inPlaceRent ?? 0,
          isVacant, isFuture,
          isNonRevenue: false,
        });
      }
    }

    if (units.length === 0) {
      return {
        documentType: 'RENT_ROLL', success: false,
        error: `No units extracted (layout=${layout})`,
        data: null, summary: {}, warnings,
        layout,
      };
    }

    // ─── Aggregations ───
    const currentUnits = units.filter(u => !u.isFuture);
    const occupiedUnits = currentUnits.filter(u => !u.isVacant && !u.isNonRevenue);
    const vacantUnits = currentUnits.filter(u => u.isVacant);
    const nonRevenueUnits = currentUnits.filter(u => u.isNonRevenue);
    const futureUnits = units.filter(u => u.isFuture);

    const totalSqft = currentUnits.reduce((s, u) => s + (u.sqft ?? 0), 0);
    const occupiedSqft = occupiedUnits.reduce((s, u) => s + (u.sqft ?? 0), 0);
    const totalMarketRent = currentUnits.reduce((s, u) => s + (u.marketRent ?? 0), 0);
    const totalLeaseCharges = occupiedUnits.reduce((s, u) => s + u.totalCharges, 0);
    const totalInPlaceRent = occupiedUnits.reduce((s, u) => s + (u.charges['rent'] ?? 0), 0);

    // Standard LTL definition: (market_rent_all_units - sum of in-place rents) / market_rent_all_units
    // Vacant units contribute $0 to in-place rent. This matches Yardi/RealPage convention.
    // Includes both pure LTL (rent below market on occupied units) and vacancy effect.
    // To isolate "pure LTL on occupied only", use: (occupiedMarketRent - totalInPlaceRent) / occupiedMarketRent
    const occupiedMarketRent = occupiedUnits.reduce((s, u) => s + (u.marketRent ?? 0), 0);
    const lossToLease = occupiedMarketRent - totalInPlaceRent;
    const lossToLeasePct = occupiedMarketRent > 0 ? lossToLease / occupiedMarketRent : 0;

    // Charge code aggregation: across all current units (occupied + vacant + non-revenue).
    // Vacant units typically have no charges; non-revenue units (employee/courtesy/model)
    // often have parking/storage/utility charges even though they pay $0 rent.
    // Matches Yardi "Current/Notice Residents Only" summary convention.
    const chargeCodeAgg: Record<string, number> = {};
    for (const u of currentUnits) {
      for (const [code, amt] of Object.entries(u.charges)) {
        chargeCodeAgg[code] = (chargeCodeAgg[code] ?? 0) + amt;
      }
    }

    // Group charges by income category
    const otherIncomeMonthly: Record<string, number> = {
      parking: 0, pet_rent: 0, storage: 0, rubs: 0,
      fees: 0, insurance_admin: 0, concessions_other: 0, other: 0,
    };
    for (const [code, amt] of Object.entries(chargeCodeAgg)) {
      if (code === 'rent') continue;
      const cat = CHARGE_CODE_CATEGORY[code];
      if (cat === 'concessions') otherIncomeMonthly.concessions_other += amt;
      else if (cat && cat !== 'rent') otherIncomeMonthly[cat] = (otherIncomeMonthly[cat] ?? 0) + amt;
      else otherIncomeMonthly.other += amt;
    }

    // Lease expiration roll (deal-wide) — declared early so per-floor-plan
    // roll-ups can reuse the same bucketing logic.
    // Anchor expiration bucketing to the rent roll's as-of date when available
    // (Task #514, Step 8). Falling back to "now" produces misleading 100%-MTM
    // results on historical rent rolls (e.g. 464 Bishop is dated 2018-08-15;
    // bucketing against today=2026 marked all 186 leases as MTM/holdover when
    // they were in fact in-term as of the snapshot). Prefer the parsed
    // asOfDate; if absent, default to current date.
    const parsedAsOf = asOfDate ? new Date(asOfDate) : null;
    const today = parsedAsOf && !Number.isNaN(parsedAsOf.getTime())
      ? parsedAsOf
      : new Date();
    const monthsBetween = (a: Date, b: Date) =>
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    // Bucketing semantics (Task #514):
    //   - leaseExpiration == null → `unknown` (parser couldn't read the date,
    //     OR the field genuinely had no value — the curve no longer silently
    //     collapses null into MTM).
    //   - m < 0 (date in past) → `mtm` — true holdover.
    //   - else 0-3 / 3-6 / 6-12 / 12+ months as before.
    const bucketExpiration = (
      bucket: { months_0_3: number; months_3_6: number; months_6_12: number; months_12_plus: number; mtm: number; unknown: number },
      leaseExpiration: Date | null,
    ) => {
      if (!leaseExpiration) { bucket.unknown++; return; }
      const m = monthsBetween(today, leaseExpiration);
      if (m < 0) bucket.mtm++;
      else if (m <= 3) bucket.months_0_3++;
      else if (m <= 6) bucket.months_3_6++;
      else if (m <= 12) bucket.months_6_12++;
      else bucket.months_12_plus++;
    };

    // Compute per-floor-plan extraction status from the curve + occupied count.
    type ExpStatus = 'ok' | 'partial' | 'failed';
    const computeExpStatus = (
      curve: { unknown: number },
      occupiedCount: number,
    ): ExpStatus => {
      if (occupiedCount === 0) return 'ok';
      if (curve.unknown === 0) return 'ok';
      if (curve.unknown >= occupiedCount) return 'failed';
      return 'partial';
    };

    // Floor plan mix
    const floorPlanMix: Record<string, {
      count: number; avg_sqft: number; total_sqft: number;
      avg_market_rent: number; avg_effective_rent: number; occupancy_pct: number;
      bedrooms: number; bathrooms: number;
      expiration_curve: { months_0_3: number; months_3_6: number; months_6_12: number; months_12_plus: number; mtm: number; unknown: number };
      expiration_extraction_status: ExpStatus;
    }> = {};
    for (const u of currentUnits) {
      const fp = u.unitType || 'unknown';
      if (!floorPlanMix[fp]) {
        const beds = bedroomCountFromCategory(inferBedrooms(fp));
        const baths = inferBathrooms(fp, beds);
        floorPlanMix[fp] = {
          count: 0, avg_sqft: 0, total_sqft: 0,
          avg_market_rent: 0, avg_effective_rent: 0, occupancy_pct: 0,
          bedrooms: beds, bathrooms: baths,
          expiration_curve: { months_0_3: 0, months_3_6: 0, months_6_12: 0, months_12_plus: 0, mtm: 0, unknown: 0 },
          expiration_extraction_status: 'ok',
        };
      }
      floorPlanMix[fp].count++;
      floorPlanMix[fp].total_sqft += u.sqft ?? 0;
    }
    for (const fp of Object.keys(floorPlanMix)) {
      const fpUnits = currentUnits.filter(u => (u.unitType || 'unknown') === fp);
      const fpOccupied = fpUnits.filter(u => !u.isVacant && !u.isNonRevenue);
      const fpMarketSum = fpUnits.reduce((s, u) => s + (u.marketRent ?? 0), 0);
      const fpRentSum = fpOccupied.reduce((s, u) => s + (u.charges['rent'] ?? 0), 0);
      floorPlanMix[fp].avg_sqft = floorPlanMix[fp].count > 0
        ? Math.round(floorPlanMix[fp].total_sqft / floorPlanMix[fp].count) : 0;
      floorPlanMix[fp].avg_market_rent = floorPlanMix[fp].count > 0
        ? Math.round(fpMarketSum / floorPlanMix[fp].count) : 0;
      floorPlanMix[fp].avg_effective_rent = fpOccupied.length > 0
        ? Math.round(fpRentSum / fpOccupied.length) : 0;
      floorPlanMix[fp].occupancy_pct = floorPlanMix[fp].count > 0
        ? fpOccupied.length / floorPlanMix[fp].count : 0;
      // Per-floor-plan expiration roll — bucket only occupied (current) leases
      for (const u of fpOccupied) {
        bucketExpiration(floorPlanMix[fp].expiration_curve, u.leaseExpiration);
      }
      floorPlanMix[fp].expiration_extraction_status = computeExpStatus(
        floorPlanMix[fp].expiration_curve,
        fpOccupied.length,
      );
    }

    // Bedroom rollup
    const bedroomMix: Record<string, { count: number; pct: number; avg_rent: number }> = {};
    for (const u of currentUnits) {
      const br = inferBedrooms(u.unitType);
      if (!bedroomMix[br]) bedroomMix[br] = { count: 0, pct: 0, avg_rent: 0 };
      bedroomMix[br].count++;
    }
    for (const br of Object.keys(bedroomMix)) {
      const brUnits = currentUnits.filter(u => inferBedrooms(u.unitType) === br);
      const brOccupied = brUnits.filter(u => !u.isVacant && !u.isNonRevenue);
      const rentSum = brOccupied.reduce((s, u) => s + (u.charges['rent'] ?? 0), 0);
      bedroomMix[br].pct = brUnits.length / currentUnits.length;
      bedroomMix[br].avg_rent = brOccupied.length > 0 ? Math.round(rentSum / brOccupied.length) : 0;
    }

    // Lease expiration roll (deal-wide) — shares the same bucketing helper
    // declared above. Now includes `unknown` bucket for nulls.
    const expirationCurve = { months_0_3: 0, months_3_6: 0, months_6_12: 0, months_12_plus: 0, mtm: 0, unknown: 0 };
    for (const u of occupiedUnits) {
      bucketExpiration(expirationCurve, u.leaseExpiration);
    }
    const expirationExtractionStatus = computeExpStatus(expirationCurve, occupiedUnits.length);

    // ─── Per-column extraction scorecard (Task #514) ───
    // Each critical logical field is rated by what we know about how it was
    // resolved + whether the data ended up populated. Statuses:
    //   - 'ok'            : column resolved AND data is present in some rows
    //   - 'fallback'      : column not resolved by header detection — using
    //                       hardcoded position; data may still be populated
    //   - 'all_null'      : column resolved but 100% of occupied rows null/0
    //   - 'missing'       : column not resolved AND no data extracted
    //   - 'not_supported' : layout fundamentally cannot supply this column
    //                       (e.g., generic_flat has no per-row lease dates)
    type ColStatus = 'ok' | 'fallback' | 'all_null' | 'missing' | 'not_supported';
    const columnCoverage: Record<string, ColStatus> = {
      unit_no: 'ok',
      unit_type: 'ok',
      sqft: 'ok',
      market_rent: 'ok',
      charge_code: 'ok',
      amount: 'ok',
      lease_expiration: 'ok',
    };

    // Helper — compute one column's status from the (a) header-detection
    // provenance captured in `headerDetected` and (b) whether any data
    // ultimately populated. This is the source of truth for the scorecard
    // and for the hard-fail gate below.
    //
    //   headerDetected=true,  hasData=true   → 'ok'
    //   headerDetected=false, hasData=true   → 'fallback' (hardcoded index salvaged data)
    //   headerDetected=true,  hasData=false  → 'all_null' (header found but every row empty)
    //   headerDetected=false, hasData=false  → 'missing'  (no header, no data)
    const colStatus = (field: keyof typeof headerDetected, hasData: boolean): ColStatus => {
      const detected = headerDetected[field];
      if (detected && hasData) return 'ok';
      if (detected && !hasData) return 'all_null';
      if (!detected && hasData) return 'fallback';
      return 'missing';
    };

    // CRITICAL: "has data" means the parser SUCCESSFULLY READ a value (i.e.
    // non-null / non-undefined / non-NaN), NOT that the value is non-zero.
    // A legitimate $0 market rent or $0 effective rent (e.g. employee unit,
    // model unit, fully concession'd lease) is still extraction-success and
    // must NOT be treated as 'all_null' / unreadable. The hard-fail gate
    // depends on this distinction — see Step 5 in the task spec.
    const isPresent = (v: number | null | undefined) =>
      v !== null && v !== undefined && !Number.isNaN(v);

    if (layout === 'yardi_rrwlc') {
      const occOrAll = occupiedUnits.length > 0 ? occupiedUnits : currentUnits;
      const anyHas = (predicate: (u: YardiUnit) => boolean) => occOrAll.some(predicate);
      // unit_no / unit_type are required to even produce a unit row, so by
      // construction they always have data — status reduces to ok|fallback.
      columnCoverage.unit_no   = colStatus('unit_no',   true);
      columnCoverage.unit_type = colStatus('unit_type', true);
      columnCoverage.sqft        = colStatus('sqft',        anyHas(u => isPresent(u.sqft)));
      columnCoverage.market_rent = colStatus('market_rent', anyHas(u => isPresent(u.marketRent)));
      const anyCharges = occOrAll.some(u => Object.keys(u.charges).length > 0);
      columnCoverage.charge_code = colStatus('charge_code', anyCharges);
      columnCoverage.amount      = colStatus('amount',      anyCharges);
      columnCoverage.lease_expiration = colStatus(
        'lease_expiration',
        occupiedUnits.some(u => u.leaseExpiration != null),
      );
    } else {
      // generic_flat path: lease_expiration & charge_code are structurally
      // unsupported by this layout. Other fields use header-detection provenance.
      columnCoverage.unit_no     = colStatus('unit_no',     true);
      columnCoverage.unit_type   = colStatus('unit_type',   currentUnits.some(u => u.unitType));
      columnCoverage.sqft        = colStatus('sqft',        currentUnits.some(u => isPresent(u.sqft)));
      columnCoverage.market_rent = colStatus('market_rent', currentUnits.some(u => isPresent(u.marketRent)));
      // 'rent' presence is recorded by the generic_flat parser as a key in
      // u.charges only when the source row supplied a non-null value (see
      // line ~395). So key-presence on 'rent' is the right extraction-success
      // signal here, regardless of whether the parsed amount is $0.
      columnCoverage.amount      = colStatus('amount',      occupiedUnits.some(u => 'rent' in u.charges));
      columnCoverage.lease_expiration = 'not_supported';
      columnCoverage.charge_code      = 'not_supported';
    }

    // ─── Hard-fail policy (Task #514, Step 5) ───
    // Fail loudly only when the parser could not READ (i.e. could not map)
    // both rent columns — distinguished by `column_coverage` of 'missing'
    // (no header AND no data), NOT merely by zero values. This preserves
    // legitimate zero-rent edge cases (e.g. fully concession'd model unit
    // dataset) while still catching layouts where Market Rent and Effective
    // Rent both fell through every detection rule.
    // Policy (post-review): hard-fail is reserved for true MAPPING failure —
    // 'missing' (no header AND no data) and 'not_supported' (layout-structural,
    // e.g. generic_flat has no per-row charge_code/amount split). 'all_null'
    // (header detected but every occupied row null) is downgraded to
    // review-needed only — surfaced via the human_review_needed banner — so
    // that anomalous-but-mapped exports still produce a viewable Unit Mix
    // with explicit operator warnings, rather than a hard failure that
    // blocks the rest of the deal.
    const isUnreadable = (s: ColStatus) => s === 'missing' || s === 'not_supported';
    const marketUnreadable    = isUnreadable(columnCoverage.market_rent);
    const effectiveUnreadable = isUnreadable(columnCoverage.amount);
    if (occupiedUnits.length > 0 && marketUnreadable && effectiveUnreadable) {
      return {
        documentType: 'RENT_ROLL',
        success: false,
        error: `Rent roll extraction failed: parser could not read Market Rent or Effective Rent for any of ${occupiedUnits.length} occupied units. Column mapping likely failed for this layout. Please re-export the rent roll in a standard format or contact support.`,
        data: null,
        summary: {},
        warnings,
        layout,
        capsuleExtras: { column_coverage: columnCoverage, human_review_needed: true },
      };
    }

    // ─── Human review needed ───
    // True when ≥1 critical field is 'missing' OR ≥50% of occupied rows have
    // null lease_expiration OR null effective_rent.
    // Per task spec: trigger on critical-field 'missing' (no header detected
    // AND no data). 'all_null' is advisory — surfaced in the scorecard but
    // doesn't auto-trigger the banner unless it co-occurs with the
    // 50%-null-coverage thresholds below. sqft is included per spec.
    const criticalFields: Array<keyof typeof columnCoverage> = ['unit_no', 'unit_type', 'sqft', 'market_rent', 'charge_code', 'amount'];
    // 'missing' is the primary trigger. For the rent columns specifically,
    // also trigger on 'all_null' — those no longer hard-fail (per post-review
    // policy narrowing), so the review banner is the only surface that warns
    // operators their rent data is unusable. Other critical fields stick to
    // 'missing' only to avoid noisy banners on legitimately-empty columns.
    const anyMissing = criticalFields.some(f => {
      const s = columnCoverage[f];
      if (s === 'missing') return true;
      if ((f === 'market_rent' || f === 'amount') && s === 'all_null') return true;
      return false;
    });
    const occCount = occupiedUnits.length;
    const leaseExpNulls = occupiedUnits.filter(u => !u.leaseExpiration).length;
    // Presence-based, NOT zero-based. A unit is counted as "effective rent
    // unparsed" only when neither the totalCharges sum nor the 'rent' charge
    // key was successfully populated by the parser. A legitimate $0
    // effective rent (model unit, fully concession'd lease) — represented
    // as totalCharges === 0 BUT with a 'rent' key present in u.charges —
    // counts as a successful read and does NOT inflate the null count.
    const effectiveRentNulls = occupiedUnits.filter(
      u => u.totalCharges === 0 && !('rent' in u.charges)
    ).length;
    const lowLeaseExpCoverage = occCount > 0 && (leaseExpNulls / occCount) >= 0.5 && columnCoverage.lease_expiration !== 'not_supported';
    const lowEffRentCoverage = occCount > 0 && (effectiveRentNulls / occCount) >= 0.5;
    const humanReviewNeeded = anyMissing || lowLeaseExpCoverage || lowEffRentCoverage;

    // Upload-time KPI summary (Task #514) — pushed into warnings so the
    // existing alerts pipeline surfaces it on the upload completion path
    // (`pipelineResult.alerts`). Lets the user see "we mapped 232/232 rents
    // but 0/232 lease expirations — review recommended" without having to
    // open the Unit Mix tab.
    if (occCount > 0) {
      const leaseExpMapped = occCount - leaseExpNulls;
      const effRentMapped = occCount - effectiveRentNulls;
      warnings.push(
        `Rent roll extraction quality: ${occCount} occupied units detected. ` +
        `Lease expiration mapped: ${leaseExpMapped} of ${occCount}. ` +
        `Effective rent mapped: ${effRentMapped} of ${occCount}. ` +
        (humanReviewNeeded ? 'Review recommended.' : 'Coverage OK.')
      );
    }

    // Risk metrics
    const outstandingBalanceTotal = currentUnits.reduce((s, u) => s + Math.max(u.balance ?? 0, 0), 0);
    const securityDepositsHeld = currentUnits.reduce((s, u) => s + (u.securityDeposit ?? 0), 0);
    const preLeaseRatio = vacantUnits.length > 0 ? futureUnits.length / vacantUnits.length : 0;

    const occByUnit = currentUnits.length > 0 ? occupiedUnits.length / currentUnits.length : 0;
    const occBySqft = totalSqft > 0 ? occupiedSqft / totalSqft : 0;

    // Build unit records in legacy schema for backward compat
    const rrUnits: RentRollUnit[] = units.map(u => ({
      unitNumber: u.unitNumber,
      unitType: u.unitType,
      sqft: u.sqft,
      status: u.isVacant ? 'vacant' : (u.isFuture ? 'future' : 'occupied'),
      tenantName: u.resident,
      marketRent: u.marketRent,
      leaseRent: u.charges['rent'] ?? null,
      effectiveRent: u.totalCharges > 0 ? u.totalCharges : (u.charges['rent'] ?? null),
      charges: u.charges,
      totalCharges: u.totalCharges,
      deposit: u.securityDeposit,
      balance: u.balance,
      moveInDate: u.moveInDate ? u.moveInDate.toISOString().split('T')[0] : null,
      leaseStart: u.moveInDate ? u.moveInDate.toISOString().split('T')[0] : null,
      leaseEnd: u.leaseExpiration ? u.leaseExpiration.toISOString().split('T')[0] : null,
      moveOutDate: u.moveOutDate ? u.moveOutDate.toISOString().split('T')[0] : null,
      isFutureResident: u.isFuture,
    }));

    const data: RentRollData = {
      units: rrUnits,
      summary: {
        totalUnits: currentUnits.length,
        occupiedUnits: occupiedUnits.length,
        vacantUnits: vacantUnits.length,
        occupancyRate: occByUnit,
        totalMarketRent,
        totalLeaseCharges,
        lossToLease,
        lossToLeasePct,
        avgMarketRent: currentUnits.length > 0 ? totalMarketRent / currentUnits.length : 0,
        avgEffectiveRent: occupiedUnits.length > 0 ? totalLeaseCharges / occupiedUnits.length : 0,
        futureResidents: futureUnits.length,
        floorPlanMix: Object.fromEntries(
          Object.entries(floorPlanMix).map(([k, v]) => [k, {
            count: v.count, avgRent: v.avg_effective_rent, avgSqft: v.avg_sqft,
          }])
        ),
      },
    };

    // Capsule extras — these get merged into ExtractionRentRollCapsule
    const capsuleExtras = {
      layout,
      as_of_date: asOfDate,
      source_system_id: sourceSystemId,
      total_units: currentUnits.length,
      occupied_units: occupiedUnits.length,
      vacant_units: vacantUnits.length,
      non_revenue_units: nonRevenueUnits.length,
      future_residents: futureUnits.length,
      gpr_monthly: totalMarketRent,
      in_place_rent_monthly: totalInPlaceRent,
      loss_to_lease_monthly: lossToLease,
      loss_to_lease_pct: lossToLeasePct,
      total_billings_monthly: totalLeaseCharges,
      egi_in_place_annualized: totalLeaseCharges * 12,
      avg_market_rent: data.summary.avgMarketRent,
      avg_effective_rent: data.summary.avgEffectiveRent,
      avg_unit_sqft: currentUnits.length > 0 ? totalSqft / currentUnits.length : 0,
      total_rentable_sqft: totalSqft,
      occupancy_by_unit_pct: occByUnit,
      occupancy_by_sqft_pct: occBySqft,
      charge_codes: chargeCodeAgg,
      other_income_monthly: otherIncomeMonthly,
      floor_plan_mix: floorPlanMix,
      bedroom_mix: bedroomMix,
      outstanding_balance_total: outstandingBalanceTotal,
      outstanding_balance_ratio: totalLeaseCharges > 0 ? outstandingBalanceTotal / totalLeaseCharges : 0,
      security_deposits_held: securityDepositsHeld,
      pre_lease_ratio: preLeaseRatio,
      expiration_curve: expirationCurve,
      expiration_extraction_status: expirationExtractionStatus,
      column_coverage: columnCoverage,
      human_review_needed: humanReviewNeeded,
    };

    return {
      documentType: 'RENT_ROLL',
      success: true,
      data,
      summary: data.summary,
      warnings,
      layout,
      capsuleExtras,
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
