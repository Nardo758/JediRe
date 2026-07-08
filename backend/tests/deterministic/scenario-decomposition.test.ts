import { describe, it, expect } from 'vitest';
import {
  decomposeYear1ToOverlays,
  recomposeYear1FromOverlays,
  verifyOverlayEquivalence,
} from '../../src/services/deterministic/scenario-decomposition';

describe('scenario-decomposition — C6 round-trip identity', () => {
  const sampleYear1: Record<string, any> = {
    gpr: { resolved: 4901400, resolution: 'computed', t12: 4800000, platform: 5200000 },
    loss_to_lease_pct: { resolved: 0.03, resolution: 'computed', t12: 0.025 },
    vacancy_pct: { resolved: 0.1983, resolution: 'computed', t12: 0.20, platform: 0.05 },
    concessions_pct: { resolved: 0.02, resolution: 'computed' },
    bad_debt_pct: { resolved: 0.005, resolution: 'computed' },
    egi: { resolved: 3900000, resolution: 'computed' },
    payroll: { resolved: 250000, resolution: 't12' },
    repairs_maintenance: { resolved: 120000, resolution: 't12' },
    utilities: { resolved: 80000, resolution: 't12' },
    insurance: { resolved: 45000, resolution: 't12' },
    real_estate_tax: { resolved: 696000, resolution: 't12' },
    management_fee_pct: { resolved: 0.04, resolution: 'platform' },
    replacement_reserves: { resolved: 25000, resolution: 'platform' },
    total_opex: { resolved: 1236000, resolution: 'computed' },
    noi: { resolved: 2664000, resolution: 'computed', platform: 2675264.85, om: 1200000 },
    other_income_breakdown: {
      parking: { resolved: 12000, resolution: 't12' },
      pet: { resolved: 8000, resolution: 't12' },
      storage: { resolved: 5000, resolution: 't12' },
    },
    source_docs: { t12_doc_id: 'abc-123', rent_roll_doc_id: 'def-456' },
    _unit_count: 100,
    last_seeded_at: '2026-07-01T00:00:00Z',
  };

  it('decomposeYear1ToOverlays produces one row per LayeredValue field', () => {
    const rows = decomposeYear1ToOverlays('deal-123', 'scenario-456', sampleYear1);

    // Top-level LayeredValue fields (excluding source_docs, _unit_count, last_seeded_at)
    const topLevelKeys = [
      'gpr', 'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct', 'bad_debt_pct',
      'egi', 'payroll', 'repairs_maintenance', 'utilities', 'insurance',
      'real_estate_tax', 'management_fee_pct', 'replacement_reserves',
      'total_opex', 'noi',
    ];

    // other_income_breakdown sub-fields
    const subKeys = [
      'other_income_breakdown.parking',
      'other_income_breakdown.pet',
      'other_income_breakdown.storage',
    ];

    const expectedPaths = [...topLevelKeys, ...subKeys];
    const actualPaths = rows.map(r => r.field_path).sort();

    expect(actualPaths).toEqual(expectedPaths.sort());
    expect(rows.every(r => r.deal_id === 'deal-123')).toBe(true);
    expect(rows.every(r => r.scenario_id === 'scenario-456')).toBe(true);
  });

  it('recomposeYear1FromOverlays restores the original blob shape', () => {
    const rows = decomposeYear1ToOverlays('deal-123', 'scenario-456', sampleYear1);
    const recomposed = recomposeYear1FromOverlays(rows);

    // Top-level keys should be restored
    for (const key of Object.keys(sampleYear1)) {
      if (['source_docs', '_unit_count', 'last_seeded_at', 'other_income_user_lines'].includes(key)) {
        continue; // skipped by decomposer
      }
      expect(recomposed).toHaveProperty(key);
    }

    // LayeredValue fields should have resolved and resolution
    expect(recomposed.noi).toHaveProperty('resolved', 2664000);
    expect(recomposed.noi).toHaveProperty('resolution', 'computed');
    expect(recomposed.noi).toHaveProperty('platform', 2675264.85);

    // Nested fields
    expect(recomposed.other_income_breakdown).toHaveProperty('parking');
    expect(recomposed.other_income_breakdown.parking).toHaveProperty('resolved', 12000);
  });

  it('verifyOverlayEquivalence reports match on perfect round-trip', () => {
    const rows = decomposeYear1ToOverlays('deal-123', 'scenario-456', sampleYear1);
    const recomposed = recomposeYear1FromOverlays(rows);
    const result = verifyOverlayEquivalence(sampleYear1, rows);

    // Note: verifyOverlayEquivalence checks against the ORIGINAL blob, not the recomposed one.
    // It compares blob.resolved against overlay.value. Since the decomposer preserves resolved,
    // this should match.
    expect(result.matches).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('verifyOverlayEquivalence detects missing overlay', () => {
    const rows = decomposeYear1ToOverlays('deal-123', 'scenario-456', sampleYear1);
    // Remove one row
    const incompleteRows = rows.filter(r => r.field_path !== 'noi');
    const result = verifyOverlayEquivalence(sampleYear1, incompleteRows);

    expect(result.matches).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].field).toBe('noi');
    expect(result.mismatches[0].reason).toBe('missing_overlay');
  });

  it('verifyOverlayEquivalence detects value mismatch', () => {
    const rows = decomposeYear1ToOverlays('deal-123', 'scenario-456', sampleYear1);
    // Tamper one row
    const tamperedRows = rows.map(r =>
      r.field_path === 'noi' ? { ...r, value: 999999 } : r
    );
    const result = verifyOverlayEquivalence(sampleYear1, tamperedRows);

    expect(result.matches).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].field).toBe('noi');
    expect(result.mismatches[0].reason).toBe('value_mismatch');
  });
});
