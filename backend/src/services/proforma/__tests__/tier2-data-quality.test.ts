/**
 * F9 Pro Forma Tier-2 — Data Quality + Audit unit tests.
 *
 * Covers:
 *   - ProvenancedValue.dataQuality derivation (Spec §12 mapping)
 *   - Model version stamping
 *   - Agent fill-in pass: present, library hit, library miss, dedup
 *   - Override divergence walker (flat + layered snapshot shapes)
 */

import { describe, test, expect } from 'vitest';
import { provenanced, missing, deriveDataQuality } from '../../../types/provenanced-value';
import type { ProvenancedValue } from '../../../types/provenanced-value';
import { MODEL_VERSIONS, snapshotModelVersions, stampModelVersion } from '../model-versions';
import { agentFillIn } from '../agent-fill-in';
import type { LibraryResolver } from '../agent-fill-in';
import { DealVersionsService } from '../deal-versions.service';
import { mapSignalsToAdjustments } from '../../correlation-adjustments.service';

describe('Tier-2 ProvenancedValue.dataQuality (Spec §12)', () => {
  test('user source always ACTUAL', () => {
    expect(deriveDataQuality('platform_default', 'user')).toBe('ACTUAL');
    expect(deriveDataQuality('comp_set', 'user')).toBe('ACTUAL');
  });

  test('document origins → ACTUAL', () => {
    expect(deriveDataQuality('t12_extracted', 'platform')).toBe('ACTUAL');
    expect(deriveDataQuality('rent_roll', 'platform')).toBe('ACTUAL');
    expect(deriveDataQuality('om_extracted', 'broker')).toBe('ACTUAL');
  });

  test('comp / market origins → INFERRED', () => {
    expect(deriveDataQuality('comp_set', 'platform')).toBe('INFERRED');
    expect(deriveDataQuality('market_agent', 'platform')).toBe('INFERRED');
    expect(deriveDataQuality('tax_intel', 'platform')).toBe('INFERRED');
  });

  test('inferred / derived → ESTIMATED', () => {
    expect(deriveDataQuality('opus_inferred', 'platform')).toBe('ESTIMATED');
    expect(deriveDataQuality('derived', 'platform')).toBe('ESTIMATED');
  });

  test('default / placeholder → DEFAULT', () => {
    expect(deriveDataQuality('platform_default', 'platform')).toBe('DEFAULT');
    expect(deriveDataQuality('placeholder', 'platform')).toBe('DEFAULT');
  });

  test('provenanced() populates dataQuality', () => {
    const pv = provenanced(100, 'platform', 0.8, 'comp_set');
    expect(pv.dataQuality).toBe('INFERRED');
  });

  test('missing() yields DEFAULT', () => {
    const pv = missing<number>('not yet uploaded');
    expect(pv.dataQuality).toBe('DEFAULT');
    expect(pv.value).toBeNull();
  });
});

describe('Tier-2 model-versions registry', () => {
  test('every key has a non-empty semver-shaped string', () => {
    for (const v of Object.values(MODEL_VERSIONS)) {
      expect(typeof v).toBe('string');
      expect(v).toMatch(/^v\d+\.\d+/);
    }
  });

  test('snapshotModelVersions returns a fresh copy', () => {
    const a = snapshotModelVersions();
    const b = snapshotModelVersions();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test('stampModelVersion mutates and returns', () => {
    const pv = provenanced(0.03, 'platform', 0.7, 'derived');
    const out = stampModelVersion(pv, 'rent_growth');
    expect(out).toBe(pv);
    expect(out.modelVersion).toBe(MODEL_VERSIONS.rent_growth);
  });
});

describe('Tier-2 agent fill-in pass (Spec §12)', () => {
  const ctx = { dealId: 'd1', state: 'GA', assetClass: 'multifamily' };
  const template = {
    sections: [
      { id: 's1', fields: ['rentGrowthYr1', 'managementFeePct'] },
      { id: 's2', fields: ['propertyTax', 'rentGrowthYr1' /* dup */] },
    ],
  };

  const stubResolver: LibraryResolver = async (field) => {
    if (field === 'managementFeePct') {
      return { value: 0.04, fillMethod: 'class_b_2024_avg', confidence: 0.6 };
    }
    if (field === 'propertyTax') {
      return { value: 1850, fillMethod: 'county_records_lookup' };
    }
    return null;
  };

  test('present field skipped; missing filled INFERRED; missing+miss → DEFAULT', async () => {
    const existing = {
      rentGrowthYr1: provenanced(0.03, 'platform', 0.7, 'market_agent'),
      // managementFeePct, propertyTax are missing
    };
    const r = await agentFillIn({ context: ctx, template, existing, resolver: stubResolver });

    expect(r.skippedCount).toBe(1);
    expect(r.filledCount).toBe(2);
    expect(r.defaultedCount).toBe(0);
    expect(r.fields.rentGrowthYr1).toBeUndefined(); // skipped — not in result map

    const mgmt = r.fields.managementFeePct as ProvenancedValue<number>;
    expect(mgmt.value).toBe(0.04);
    expect(mgmt.dataQuality).toBe('INFERRED');
    expect(mgmt.fillMethod).toBe('class_b_2024_avg');
    expect(mgmt.confidence).toBeCloseTo(0.6);
    expect(mgmt.modelVersion).toBe(MODEL_VERSIONS.agent_fill_in);
  });

  test('library miss → DEFAULT placeholder, not faked number', async () => {
    const r = await agentFillIn({
      context: ctx,
      template: { sections: [{ id: 's', fields: ['unknownField'] }] },
      existing: {},
      resolver: async () => null,
    });
    expect(r.defaultedCount).toBe(1);
    const pv = r.fields.unknownField;
    expect(pv.value).toBeNull();
    expect(pv.dataQuality).toBe('DEFAULT');
    expect(pv.modelVersion).toBe(MODEL_VERSIONS.agent_fill_in);
  });

  test('confidence is clamped to [0,1]', async () => {
    const r = await agentFillIn({
      context: ctx,
      template: { sections: [{ id: 's', fields: ['x'] }] },
      existing: {},
      resolver: async () => ({ value: 1, fillMethod: 'm', confidence: 5 }),
    });
    expect(r.fields.x.confidence).toBe(1);
  });

  test('field present with null value gets filled (not skipped)', async () => {
    const r = await agentFillIn({
      context: ctx,
      template: { sections: [{ id: 's', fields: ['propertyTax'] }] },
      existing: { propertyTax: missing<number>('await county data') },
      resolver: stubResolver,
    });
    expect(r.filledCount).toBe(1);
    expect(r.fields.propertyTax.value).toBe(1850);
  });
});

describe('Tier-2 override divergence walker (Spec §13)', () => {
  const svc = new DealVersionsService();

  test('layered snapshot: user differs from platform → divergence captured', () => {
    const snapshot = {
      exitCapRate: {
        platform: provenanced(0.055, 'platform', 0.7, 'market_agent'),
        user: provenanced(0.05, 'user', 0.9, 'user_input', 'broker pitch over-promise'),
      },
      goingInCapRate: {
        platform: provenanced(0.05, 'platform', 0.7, 'market_agent'),
        // no user override — should NOT appear
      },
    };
    const divs = svc.computeOverrideDivergences(snapshot);
    expect(divs).toHaveLength(1);
    expect(divs[0].field).toBe('exitCapRate');
    expect(divs[0].user_value).toBe(0.05);
    expect(divs[0].platform_value).toBe(0.055);
    expect(divs[0].divergence_pct).toBeCloseTo(((0.05 - 0.055) / 0.055) * 100);
    expect(divs[0].justification_note).toBe('broker pitch over-promise');
  });

  test('flat snapshot with platform_value sourceRef note', () => {
    const userPv: ProvenancedValue<number> = {
      value: 0.04,
      source: 'user',
      origin: 'user_input',
      confidence: 0.95,
      qualityFlag: 'green',
      asOf: new Date().toISOString(),
      sourceRefs: [{ note: 'platform_value=0.05' }],
      rationale: 'in-place leases support tighter growth',
    };
    const divs = svc.computeOverrideDivergences({ rentGrowthYr1: userPv });
    expect(divs).toHaveLength(1);
    expect(divs[0].user_value).toBe(0.04);
    expect(divs[0].platform_value).toBe(0.05);
    expect(divs[0].justification_note).toBe('in-place leases support tighter growth');
  });

  test('platform-only snapshot produces no divergences', () => {
    const snapshot = {
      a: provenanced(1, 'platform'),
      b: provenanced(2, 'broker'),
    };
    expect(svc.computeOverrideDivergences(snapshot)).toEqual([]);
  });

  test('recursive walk: nested {assumptions, results} shape from frontend POST', () => {
    // Mirrors the actual payload the frontend sends:
    // POST { snapshot: { assumptions: {...nested ProvenancedValues...}, results: ... } }
    const userOverride: ProvenancedValue<number> = {
      value: 0.04,
      source: 'user',
      origin: 'user_input',
      confidence: 0.95,
      qualityFlag: 'green',
      asOf: new Date().toISOString(),
      sourceRefs: [{ note: 'platform_value=0.05' }],
      rationale: 'in-place leases',
    };
    const snapshot = {
      assumptions: {
        rentGrowthYr1: userOverride,
        opex: {
          taxes: {
            user: provenanced(1900, 'user', 0.9, 'user_input', 'appeal pending'),
            platform: provenanced(2100, 'platform', 0.7, 'tax_intel'),
          },
          insurance: provenanced(1200, 'platform', 0.7, 'comp_set'),
        },
      },
      results: { irr: 0.18 },
    };
    const divs = svc.computeOverrideDivergences(snapshot);
    const fields = divs.map(d => d.field).sort();
    expect(fields).toEqual(['assumptions.opex.taxes', 'assumptions.rentGrowthYr1']);
    const tax = divs.find(d => d.field === 'assumptions.opex.taxes')!;
    expect(tax.user_value).toBe(1900);
    expect(tax.platform_value).toBe(2100);
    expect(tax.justification_note).toBe('appeal pending');
    const rent = divs.find(d => d.field === 'assumptions.rentGrowthYr1')!;
    expect(rent.user_value).toBe(0.04);
    expect(rent.platform_value).toBe(0.05);
  });

  test('arrays and primitives are skipped during recursion', () => {
    const snapshot = {
      assumptions: {
        holdYears: 5, // primitive
        scenarios: [{ name: 'base' }, { name: 'upside' }], // array
        cap: provenanced(0.06, 'user', 0.9, 'user_input'),
      },
    };
    const divs = svc.computeOverrideDivergences(snapshot);
    expect(divs).toHaveLength(1);
    expect(divs[0].field).toBe('assumptions.cap');
  });
});

describe('Tier-2 correlation-adjustments mapping (Spec §3)', () => {
  const fixedNow = '2026-04-29T12:00:00.000Z';

  test('bullish/bearish signals map to known target fields with correct delta', () => {
    const out = mapSignalsToAdjustments(
      [
        { id: 'COR-01', name: 'Rent runway', signal: 'bullish', confidence: 'high', leadTime: '6m' },
        { id: 'COR-06', name: 'Supply pressure', signal: 'bearish', confidence: 'medium' },
      ],
      fixedNow
    );
    expect(out).toHaveLength(2);
    expect(out[0].cor_id).toBe('COR-01');
    expect(out[0].target_field).toBe('rentGrowthYr1');
    expect(out[0].delta_pct).toBeGreaterThan(0);
    expect(out[0].confidence).toBe('high');
    expect(out[0].computed_at).toBe(fixedNow);
    expect(out[0].model_version).toBeTruthy();
    expect(out[0].lead_time).toBe('6m');
    expect(out[1].delta_pct).toBeLessThan(0);
    expect(out[1].target_field).toBe('occupancy');
  });

  test('insufficient confidence and unknown ids are dropped', () => {
    const out = mapSignalsToAdjustments(
      [
        { id: 'COR-01', signal: 'bullish', confidence: 'insufficient' },
        { id: 'COR-99-UNKNOWN', signal: 'bullish', confidence: 'high' },
        { id: 'COR-13', signal: null, confidence: 'high' },
      ],
      fixedNow
    );
    expect(out).toHaveLength(0);
  });

  test('explicit targetField overrides default mapping', () => {
    const out = mapSignalsToAdjustments(
      [{ id: 'COR-01', signal: 'bullish', confidence: 'high', targetField: 'customField' }],
      fixedNow
    );
    expect(out).toHaveLength(1);
    expect(out[0].target_field).toBe('customField');
  });
});
