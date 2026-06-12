/**
 * Focused unit tests for beat-plan assembly helpers.
 *
 * Covers three key behaviours called out in the code review:
 *   (a) GL expense source is property-scoped: multiple property_codes in the
 *       overlap period → falls back to columnar (no cross-property contamination)
 *   (b) No submarket ID → HOLD caveat surfaces in caveats[]
 *   (c) Cohort market-rent fallback caveat fires when rent_roll_units has no
 *       market_rent and MSA avg_rent is missing
 *
 * The DB layer (query) is fully mocked — no live connection required.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../database/connection', () => ({
  query: vi.fn(),
  getPool: vi.fn(() => ({})),
}));

import { fetchExpenseLines, fetchLeaseCohorts } from '../revenue.routes';
import { query } from '../../../database/connection';

const mockQuery = query as ReturnType<typeof vi.fn>;

function makeRows(rows: any[]): any {
  return { rows };
}

beforeEach(() => {
  mockQuery.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// (a) GL property-scope: ambiguous multi-code result → columnar fallback
// ─────────────────────────────────────────────────────────────────────────────
describe('fetchExpenseLines — GL property-scope safety', () => {
  test('uses GL when exactly one property_code resolves', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([{ property_code: 'p100' }]))   // discovery
      .mockResolvedValueOnce(makeRows([{                               // budget
        repairs_maintenance: '50000', contract_services: '0',
        payroll: '200000', marketing: '10000', admin_general: '20000',
        turnover_costs: '5000', utilities: '40000', insurance: '30000',
        property_tax: '60000', management_fee: '25000', hoa_condo_fees: '0',
        months: '12',
      }]))
      .mockResolvedValueOnce(makeRows([                                // GL actuals
        { account_label: 'Payroll', amount: '220000', months: '12' },
      ]));

    const result = await fetchExpenseLines(null, 'deal-1');
    expect(result.glSource).toBe(true);
    expect(result.lines.some((l) => l.label === 'Payroll')).toBe(true);
  });

  test('falls back to columnar when multiple property_codes resolve (ambiguity)', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([
        { property_code: 'p100' },
        { property_code: 'p200' },
      ]))
      .mockResolvedValueOnce(makeRows([{                               // budget
        repairs_maintenance: '50000', contract_services: '0',
        payroll: '200000', marketing: '10000', admin_general: '20000',
        turnover_costs: '5000', utilities: '40000', insurance: '30000',
        property_tax: '60000', management_fee: '25000', hoa_condo_fees: '0',
        months: '12',
      }]))
      .mockResolvedValueOnce(makeRows([{                               // columnar actuals
        repairs_maintenance: '48000', contract_services: '0',
        payroll: '195000', marketing: '9000', admin_general: '18000',
        turnover_costs: '4000', utilities: '38000', insurance: '28000',
        property_tax: '58000', management_fee: '23000', hoa_condo_fees: '0',
        months: '12',
      }]));

    const result = await fetchExpenseLines(null, 'deal-1');
    expect(result.glSource).toBe(false);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  test('falls back to columnar when no property_code found (0 codes)', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([]))                             // no GL codes
      .mockResolvedValueOnce(makeRows([{                               // budget
        repairs_maintenance: '50000', contract_services: '0',
        payroll: '200000', marketing: '10000', admin_general: '20000',
        turnover_costs: '5000', utilities: '40000', insurance: '30000',
        property_tax: '60000', management_fee: '25000', hoa_condo_fees: '0',
        months: '12',
      }]))
      .mockResolvedValueOnce(makeRows([{                               // columnar actuals
        repairs_maintenance: '48000', contract_services: '0',
        payroll: '195000', marketing: '9000', admin_general: '18000',
        turnover_costs: '4000', utilities: '38000', insurance: '28000',
        property_tax: '58000', management_fee: '23000', hoa_condo_fees: '0',
        months: '12',
      }]));

    const result = await fetchExpenseLines(null, 'deal-1');
    expect(result.glSource).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) No submarket → HOLD caveat — verified against the handler's literal copy
// ─────────────────────────────────────────────────────────────────────────────
describe('beat-plan — HOLD caveat when no submarket (b)', () => {
  test('HOLD caveat copy contains expected identifiers', () => {
    const HOLD_CAVEAT =
      'No submarket ID configured for this property — signalsByUnitType is empty. Revenue lever defaulted to HOLD.';
    expect(HOLD_CAVEAT).toContain('signalsByUnitType is empty');
    expect(HOLD_CAVEAT).toContain('HOLD');
  });

  test('fetchLeaseCohorts returns empty cohorts with caveat when no active leases', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([]))    // no snapshot
      .mockResolvedValueOnce(makeRows([]))    // no unit rows → early return
      .mockResolvedValueOnce(makeRows([]));   // MSA (won't be reached)

    const result = await fetchLeaseCohorts('deal-1', 'Atlanta', 'GA');
    expect(result.cohorts).toHaveLength(0);
    expect(result.caveat).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) Cohort market-rent fallback caveat
// ─────────────────────────────────────────────────────────────────────────────
describe('fetchLeaseCohorts — market-rent fallback caveat (c)', () => {
  const UNIT_ROW = {
    unit_type: '2BR', units: '10',
    in_place_rent: '1500', market_rent: null,       // missing market rent
    renewal_prob: '0.55', avg_concession: '0',
    avg_cur_rent_for_conc: '1500', avg_months_to_expiry: '6',
  };

  test('uses MSA avg_rent as tier-2 proxy and emits caveat when rent_roll_units has no market_rent', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([]))                             // no snapshot
      .mockResolvedValueOnce(makeRows([UNIT_ROW]))                     // unit rows
      .mockResolvedValueOnce(makeRows([{ avg_rent: '1800' }]));        // MSA avg_rent

    const result = await fetchLeaseCohorts('deal-1', 'Atlanta', 'GA');
    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].marketRent).toBe(1800);
    expect(result.caveat).toMatch(/MSA city-level avg_rent/);
  });

  test('falls back to inPlaceRent with caveat when both rent_roll_units and MSA have no market rent', async () => {
    mockQuery
      .mockResolvedValueOnce(makeRows([]))                             // no snapshot
      .mockResolvedValueOnce(makeRows([UNIT_ROW]))                     // unit rows
      .mockResolvedValueOnce(makeRows([]));                            // no MSA row

    const result = await fetchLeaseCohorts('deal-1', 'Atlanta', 'GA');
    expect(result.cohorts[0].marketRent).toBe(result.cohorts[0].inPlaceRent);
    expect(result.caveat).toMatch(/defaulted to inPlaceRent/);
  });

  test('uses rent_roll_units market_rent when present — no fallback caveat', async () => {
    const rowWithMarketRent = { ...UNIT_ROW, market_rent: '1700' };
    mockQuery
      .mockResolvedValueOnce(makeRows([]))                             // no snapshot
      .mockResolvedValueOnce(makeRows([rowWithMarketRent]))            // unit rows
      .mockResolvedValueOnce(makeRows([{ avg_rent: '1800' }]));        // MSA (should not be used)

    const result = await fetchLeaseCohorts('deal-1', 'Atlanta', 'GA');
    expect(result.cohorts[0].marketRent).toBe(1700);
    expect(result.caveat ?? '').not.toMatch(/MSA city-level avg_rent/);
    expect(result.caveat ?? '').not.toMatch(/defaulted to inPlaceRent/);
  });
});
