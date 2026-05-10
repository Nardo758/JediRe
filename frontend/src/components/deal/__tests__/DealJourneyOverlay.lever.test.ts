import { describe, it, expect } from 'vitest';
import { LEVER_TO_ASMTAB_KEY } from '../DealJourneyOverlay';

// These are the fieldPath values emitted by LEVER_CONFIG in DealJourneyOverlay.tsx.
// Each must resolve to a valid AssumptionsTab rd.key (data-field-path anchor).
const LEVER_FIELD_PATHS = [
  'financial.assumptions.rentGrowth',
  'financial.assumptions.expenseGrowth',
  'financial.assumptions.vacancy',
  'financial.assumptions.exitCapRate',
  'financial.assumptions.holdPeriod',
  'financial.assumptions.capexPerUnit',
  'financial.assumptions.managementFee',
] as const;

// Expected AssumptionsTab rd.key targets (data-field-path attribute values).
const EXPECTED_ASM_KEYS: Record<string, string> = {
  'financial.assumptions.rentGrowth':    'growthRentPct',
  'financial.assumptions.expenseGrowth': 'growthOpexPct',
  'financial.assumptions.vacancy':       'stabilizedOcc',
  'financial.assumptions.exitCapRate':   'exitCapRate',
  'financial.assumptions.holdPeriod':    'saleYear',
  'financial.assumptions.capexPerUnit':  'capexPerUnit',
  'financial.assumptions.managementFee': 'management_fee_pct',
};

describe('LEVER_TO_ASMTAB_KEY', () => {
  it('covers all 7 LEVER_CONFIG fieldPaths', () => {
    for (const fp of LEVER_FIELD_PATHS) {
      expect(LEVER_TO_ASMTAB_KEY).toHaveProperty(fp);
    }
  });

  it('maps every fieldPath to the correct AssumptionsTab rd.key', () => {
    for (const fp of LEVER_FIELD_PATHS) {
      expect(LEVER_TO_ASMTAB_KEY[fp]).toBe(EXPECTED_ASM_KEYS[fp]);
    }
  });

  it('has no unmapped fieldPaths (fallback never fires for known levers)', () => {
    for (const fp of LEVER_FIELD_PATHS) {
      const asmKey = LEVER_TO_ASMTAB_KEY[fp] ?? fp;
      expect(asmKey).not.toBe(fp);
    }
  });

  it('contains exactly 7 entries — one per lever', () => {
    expect(Object.keys(LEVER_TO_ASMTAB_KEY)).toHaveLength(7);
  });
});
