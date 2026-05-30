/**
 * Yardi Matrix classifier + parser unit tests — Piece A2
 *
 * Verifies the abstraction proof:
 *   1. The registry classifies Yardi Matrix filenames correctly (no classifier.ts change).
 *   2. The registry classifies Yardi Matrix headers correctly (no classifier.ts change).
 *   3. The parsers produce well-formed rows from synthetic CSV data.
 *   4. CoStar classification is NOT regressed.
 *
 * All tests run without a DB connection — classification and parsing are pure.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';

// ── Bootstrap vendor registry (imports register all vendors) ──────────────────
import { vendorRegistry } from '../../vendor-registry';

// ── Parsers under test ────────────────────────────────────────────────────────
import { parseYardiRentSurvey, parseYardiSupplyPipeline } from '../yardi-matrix-parser';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeXlsx(headers: string[], rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows.map(r => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = r[h] ?? '';
    return out;
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ── Synthetic Yardi Matrix Rent Survey fixture ────────────────────────────────

const YM_RENT_HEADERS = [
  'Geography', 'Market', 'State', 'As-Of Date',
  'Avg Asking Rent', 'Avg Eff Rent', 'Occ Rate',
  'Concession Value ($ Per Month)', 'Total Inventory',
  'New Supply', 'Net Absorption', 'Yardi Matrix ID',
];

const YM_RENT_ROWS = [
  {
    Geography: 'Buckhead',
    Market: 'Atlanta',
    State: 'GA',
    'As-Of Date': '2025-12-31',
    'Avg Asking Rent': '1985',
    'Avg Eff Rent': '1910',
    'Occ Rate': '92.4',
    'Concession Value ($ Per Month)': '75',
    'Total Inventory': '8420',
    'New Supply': '312',
    'Net Absorption': '288',
    'Yardi Matrix ID': 'YM-ATL-001',
  },
  {
    Geography: 'Midtown Atlanta',
    Market: 'Atlanta',
    State: 'GA',
    'As-Of Date': '2025-12-31',
    'Avg Asking Rent': '2150',
    'Avg Eff Rent': '2050',
    'Occ Rate': '91.1',
    'Concession Value ($ Per Month)': '100',
    'Total Inventory': '12400',
    'New Supply': '820',
    'Net Absorption': '650',
    'Yardi Matrix ID': 'YM-ATL-002',
  },
];

// ── Synthetic Yardi Matrix Supply Pipeline fixture ────────────────────────────

const YM_SUPPLY_HEADERS = [
  'Property Name', 'Address', 'City', 'State', 'Zip',
  'Geography', 'Market', 'Status', 'Delivery Date',
  'Total Units', 'Stories', 'Developer', 'Owner',
  'Latitude', 'Longitude', 'Yardi Matrix ID',
];

const YM_SUPPLY_ROWS = [
  {
    'Property Name': 'The Sovereign',
    Address: '750 Peachtree St NE',
    City: 'Atlanta',
    State: 'GA',
    Zip: '30308',
    Geography: 'Midtown Atlanta',
    Market: 'Atlanta',
    Status: 'Under Construction',
    'Delivery Date': '2026-06-01',
    'Total Units': '280',
    Stories: '24',
    Developer: 'Wood Partners',
    Owner: 'Wood Partners',
    Latitude: '33.7832',
    Longitude: '-84.3827',
    'Yardi Matrix ID': 'YM-P-8812',
  },
  {
    'Property Name': 'Ponce City Commons',
    Address: '680 Ponce De Leon Ave',
    City: 'Atlanta',
    State: 'GA',
    Zip: '30308',
    Geography: 'Intown Atlanta',
    Market: 'Atlanta',
    Status: 'Proposed',
    'Delivery Date': '2027-09-01',
    'Total Units': '410',
    Stories: '18',
    Developer: 'Jamestown Properties',
    Owner: 'Jamestown Properties',
    Latitude: '33.7726',
    Longitude: '-84.3659',
    'Yardi Matrix ID': 'YM-P-9031',
  },
];

// ── Synthetic CoStar fixture (for regression) ─────────────────────────────────

const COSTAR_SALE_HEADERS = ['Address', 'City', 'State', 'Sale Date', 'Sale Price', '# Units'];
const COSTAR_RENT_HEADERS = ['Address', 'City', 'State', 'Asking Rent/Unit', 'Occ %', 'Year Built'];
const COSTAR_SUBMARKET_HEADERS = ['Period', 'Vacancy Rate', 'Inventory Units', 'Absorption Units', 'Market Cap Rate'];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Yardi Matrix vendor registry — filename classification', () => {
  it('classifies YMRS_Atlanta_Q4_2025.xlsx as YARDI_MATRIX_RENT_SURVEY', () => {
    const result = vendorRegistry.classifyByFilename('YMRS_Atlanta_Q4_2025.xlsx');
    expect(result).not.toBeNull();
    expect(result?.match.vendorId).toBe('yardi_matrix');
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_RENT_SURVEY');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('classifies "Yardi Matrix - Rent Survey Atlanta 2025.xlsx" as YARDI_MATRIX_RENT_SURVEY', () => {
    const result = vendorRegistry.classifyByFilename('Yardi Matrix - Rent Survey Atlanta 2025.xlsx');
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_RENT_SURVEY');
  });

  it('classifies YMSP_Atlanta_2026.xlsx as YARDI_MATRIX_SUPPLY_PIPELINE', () => {
    const result = vendorRegistry.classifyByFilename('YMSP_Atlanta_2026.xlsx');
    expect(result).not.toBeNull();
    expect(result?.match.vendorId).toBe('yardi_matrix');
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_SUPPLY_PIPELINE');
  });

  it('classifies "Yardi Matrix - Supply Pipeline Atlanta.xlsx" as YARDI_MATRIX_SUPPLY_PIPELINE', () => {
    const result = vendorRegistry.classifyByFilename('Yardi Matrix - Supply Pipeline Atlanta.xlsx');
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_SUPPLY_PIPELINE');
  });

  it('returns null for a non-Yardi, non-CoStar filename', () => {
    const result = vendorRegistry.classifyByFilename('rent_roll_2025.xlsx');
    expect(result).toBeNull();
  });
});

describe('Yardi Matrix vendor registry — header classification', () => {
  it('classifies rent survey headers as YARDI_MATRIX_RENT_SURVEY', () => {
    const headerStr = YM_RENT_HEADERS.join(' ').toLowerCase();
    const headerSet = new Set(YM_RENT_HEADERS.map(h => h.toLowerCase()));
    const result = vendorRegistry.classifyByHeaders(headerStr, headerSet);
    expect(result).not.toBeNull();
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_RENT_SURVEY');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.90);
  });

  it('classifies supply pipeline headers as YARDI_MATRIX_SUPPLY_PIPELINE', () => {
    const headerStr = YM_SUPPLY_HEADERS.join(' ').toLowerCase();
    const headerSet = new Set(YM_SUPPLY_HEADERS.map(h => h.toLowerCase()));
    const result = vendorRegistry.classifyByHeaders(headerStr, headerSet);
    expect(result).not.toBeNull();
    expect(result?.match.fileType.documentType).toBe('YARDI_MATRIX_SUPPLY_PIPELINE');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it('does NOT misclassify Yardi rent survey as CoStar', () => {
    const headerStr = YM_RENT_HEADERS.join(' ').toLowerCase();
    const result = vendorRegistry.classifyByHeaders(headerStr, new Set(YM_RENT_HEADERS.map(h => h.toLowerCase())));
    expect(result?.match.vendorId).toBe('yardi_matrix');
    expect(result?.match.vendorId).not.toBe('costar');
  });
});

describe('CoStar classification regression — no change to classifier.ts verified by output', () => {
  it('CoStar sale comps headers still classify as COSTAR_SALE_COMPS', () => {
    const headerStr = COSTAR_SALE_HEADERS.join(' ').toLowerCase();
    const result = vendorRegistry.classifyByHeaders(headerStr, new Set(COSTAR_SALE_HEADERS.map(h => h.toLowerCase())));
    expect(result?.match.vendorId).toBe('costar');
    expect(result?.match.fileType.documentType).toBe('COSTAR_SALE_COMPS');
  });

  it('CoStar rent comps headers still classify as COSTAR_RENT_COMPS', () => {
    const headerStr = COSTAR_RENT_HEADERS.join(' ').toLowerCase();
    const result = vendorRegistry.classifyByHeaders(headerStr, new Set(COSTAR_RENT_HEADERS.map(h => h.toLowerCase())));
    expect(result?.match.vendorId).toBe('costar');
    expect(result?.match.fileType.documentType).toBe('COSTAR_RENT_COMPS');
  });

  it('CoStar DataTable headers still classify as COSTAR_SUBMARKET_EXPORT', () => {
    const headerStr = COSTAR_SUBMARKET_HEADERS.join(' ').toLowerCase();
    const result = vendorRegistry.classifyByHeaders(headerStr, new Set(COSTAR_SUBMARKET_HEADERS.map(h => h.toLowerCase())));
    expect(result?.match.vendorId).toBe('costar');
    expect(result?.match.fileType.documentType).toBe('COSTAR_SUBMARKET_EXPORT');
  });

  it('CoStar "Near By Sales" filename still classifies as COSTAR_SALE_COMPS', () => {
    const result = vendorRegistry.classifyByFilename('Near By Sales - Atlanta.xlsx');
    expect(result?.match.vendorId).toBe('costar');
    expect(result?.match.fileType.documentType).toBe('COSTAR_SALE_COMPS');
  });
});

describe('parseYardiRentSurvey — parser produces correct rows', () => {
  let buffer: Buffer;

  beforeAll(() => {
    buffer = makeXlsx(YM_RENT_HEADERS, YM_RENT_ROWS);
  });

  it('parses 2 valid rows from synthetic fixture', () => {
    const result = parseYardiRentSurvey(buffer);
    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
  });

  it('produces row with correct submarket, metro, and period_date', () => {
    const result = parseYardiRentSurvey(buffer);
    const buckhead = result.rows.find(r => r.submarket === 'Buckhead');
    expect(buckhead).toBeDefined();
    expect(buckhead?.metro).toBe('Atlanta');
    expect(buckhead?.state).toBe('GA');
    expect(buckhead?.period_date).toBe('2025-12-31');
  });

  it('produces correct numeric metrics', () => {
    const result = parseYardiRentSurvey(buffer);
    const buckhead = result.rows.find(r => r.submarket === 'Buckhead');
    expect(buckhead?.avg_asking_rent).toBeCloseTo(1985, 0);
    expect(buckhead?.avg_effective_rent).toBeCloseTo(1910, 0);
    expect(buckhead?.occupancy_rate).toBeCloseTo(92.4, 1);
    expect(buckhead?.concession_value_mo).toBeCloseTo(75, 0);
    expect(buckhead?.total_inventory_units).toBe(8420);
  });

  it('captures yardi_matrix_id from "Yardi Matrix ID" column', () => {
    const result = parseYardiRentSurvey(buffer);
    const midtown = result.rows.find(r => r.submarket === 'Midtown Atlanta');
    expect(midtown?.yardi_matrix_id).toBe('YM-ATL-002');
  });

  it('sets source = "yardi_matrix" on every row', () => {
    const result = parseYardiRentSurvey(buffer);
    expect(result.rows.every(r => r.source === 'yardi_matrix')).toBe(true);
  });

  it('accepts dealId and fileId options and attaches them to rows', () => {
    const result = parseYardiRentSurvey(buffer, {
      dealId: 'test-deal-uuid',
      fileId: 'test-file-123',
      dataAsOf: '2025-12-31',
    });
    expect(result.rows[0].deal_id).toBe('test-deal-uuid');
    expect(result.rows[0].file_id).toBe('test-file-123');
    expect(result.rows[0].data_as_of).toBe('2025-12-31');
  });
});

describe('parseYardiSupplyPipeline — parser produces correct rows', () => {
  let buffer: Buffer;

  beforeAll(() => {
    buffer = makeXlsx(YM_SUPPLY_HEADERS, YM_SUPPLY_ROWS);
  });

  it('parses 2 valid rows from synthetic fixture', () => {
    const result = parseYardiSupplyPipeline(buffer);
    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
  });

  it('produces row with correct property name, geography, and delivery date', () => {
    const result = parseYardiSupplyPipeline(buffer);
    const sovereign = result.rows.find(r => r.property_name === 'The Sovereign');
    expect(sovereign).toBeDefined();
    expect(sovereign?.submarket).toBe('Midtown Atlanta');
    expect(sovereign?.metro).toBe('Atlanta');
    expect(sovereign?.delivery_date).toBe('2026-06-01');
  });

  it('captures supply status and unit count', () => {
    const result = parseYardiSupplyPipeline(buffer);
    const sovereign = result.rows.find(r => r.property_name === 'The Sovereign');
    expect(sovereign?.status).toBe('Under Construction');
    expect(sovereign?.total_units).toBe(280);
    expect(sovereign?.stories).toBe(24);
  });

  it('captures developer and owner', () => {
    const result = parseYardiSupplyPipeline(buffer);
    const sovereign = result.rows.find(r => r.property_name === 'The Sovereign');
    expect(sovereign?.developer).toBe('Wood Partners');
    expect(sovereign?.owner).toBe('Wood Partners');
  });

  it('parses geo-coordinates', () => {
    const result = parseYardiSupplyPipeline(buffer);
    const sovereign = result.rows.find(r => r.property_name === 'The Sovereign');
    expect(sovereign?.latitude).toBeCloseTo(33.7832, 3);
    expect(sovereign?.longitude).toBeCloseTo(-84.3827, 3);
  });

  it('sets source = "yardi_matrix" on every row', () => {
    const result = parseYardiSupplyPipeline(buffer);
    expect(result.rows.every(r => r.source === 'yardi_matrix')).toBe(true);
  });
});

describe('Abstraction proof — classifier.ts untouched verification', () => {
  it('vendorRegistry knows about yardi_matrix without classifier.ts changes', () => {
    const vendor = vendorRegistry.getVendorById('yardi_matrix');
    expect(vendor).toBeDefined();
    expect(vendor?.displayName).toBe('Yardi Matrix');
    expect(vendor?.licensePosture).toBe('platform_only');
  });

  it('vendorRegistry knows about costar (regression check)', () => {
    const vendor = vendorRegistry.getVendorById('costar');
    expect(vendor).toBeDefined();
    expect(vendor?.displayName).toBe('CoStar');
  });

  it('vendorRegistry has exactly 2 registered vendors', () => {
    const vendors = vendorRegistry.getAllVendors();
    expect(vendors).toHaveLength(2);
    const ids = vendors.map(v => v.vendorId).sort();
    expect(ids).toEqual(['costar', 'yardi_matrix']);
  });

  it('YARDI_MATRIX_RENT_SURVEY writeTargets declare yardi_matrix_rent_survey table', () => {
    const match = vendorRegistry.getVendorByDocType('YARDI_MATRIX_RENT_SURVEY');
    expect(match?.fileType.writeTargets.vendorSpecific).toHaveProperty('yardi_matrix_rent_survey');
    expect(match?.fileType.writeTargets.crossVendor?.vendorSourceValue).toBe('yardi_matrix');
  });

  it('YARDI_MATRIX_SUPPLY_PIPELINE writeTargets declare yardi_matrix_supply_pipeline table', () => {
    const match = vendorRegistry.getVendorByDocType('YARDI_MATRIX_SUPPLY_PIPELINE');
    expect(match?.fileType.writeTargets.vendorSpecific).toHaveProperty('yardi_matrix_supply_pipeline');
    expect(match?.fileType.writeTargets.crossVendor).toBeUndefined();
  });
});
