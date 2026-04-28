import { describe, it, expect } from 'vitest';
import type { LayeredValue } from '../document-extraction/types';
import {
  FIELD_PRIORITIES,
  SKIP_ZERO_FIELDS,
  reResolveClearedLayeredValue,
  resolveForTest as resolve,
} from '../proforma-seeder.service';

/**
 * Parity tests for proforma resolution.
 *
 * The 464 Bishop GPR bug (Task #435) was caused by two parallel
 * resolution paths drifting apart: `resolve()` at seed time and
 * the inline re-resolve loop in `applyUserOverride()` when an override
 * was cleared. The fix was to centralize on `FIELD_PRIORITIES` and
 * `SKIP_ZERO_FIELDS`, and these tests lock that contract in place so
 * a future refactor can't silently re-introduce a divergent priority
 * or forget the skip-zero rule on a new revenue field.
 */

const SOURCES = ['t12', 'rent_roll', 'tax_bill', 'box_score', 'aged_ar', 'om'] as const;
type Source = typeof SOURCES[number];

function makeLayered(values: Partial<Record<Source | 'platform', number | null>>): LayeredValue<number> {
  return {
    platform: values.platform ?? null,
    t12: values.t12 ?? null,
    rent_roll: values.rent_roll ?? null,
    tax_bill: values.tax_bill ?? null,
    box_score: values.box_score ?? null,
    aged_ar: values.aged_ar ?? null,
    om: values.om ?? null,
    override: null,
    resolved: null,
    resolution: 'platform_fallback',
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Run the seed-time path (resolve) for a field, given a set of layered values.
 */
function seedResolve(
  fieldName: string,
  values: Partial<Record<Source | 'platform', number | null>>,
): LayeredValue<number> {
  return resolve(fieldName, values.platform ?? null, {
    t12: values.t12 ?? null,
    rent_roll: values.rent_roll ?? null,
    tax_bill: values.tax_bill ?? null,
    box_score: values.box_score ?? null,
    aged_ar: values.aged_ar ?? null,
    om: values.om ?? null,
  });
}

/**
 * Run the override-clear path: build a layered value with those same sources
 * and an active override, then clear the override and call the shared
 * re-resolve helper (the same code path applyUserOverride() uses).
 */
function clearOverridePath(
  fieldName: string,
  values: Partial<Record<Source | 'platform', number | null>>,
): LayeredValue<number> {
  const field = makeLayered(values);
  field.override = 12345;
  field.resolved = 12345;
  field.resolution = 'override';
  // Now simulate the user clearing the override:
  field.override = null;
  reResolveClearedLayeredValue(field, fieldName);
  return field;
}

describe('proforma-seeder: FIELD_PRIORITIES + SKIP_ZERO_FIELDS contract', () => {
  it('every field in FIELD_PRIORITIES uses sources that exist on LayeredValue', () => {
    const validSources = new Set<string>([...SOURCES]);
    for (const [field, priority] of Object.entries(FIELD_PRIORITIES)) {
      for (const src of priority) {
        expect(
          validSources.has(src),
          `FIELD_PRIORITIES[${field}] references unknown source "${src}"`,
        ).toBe(true);
      }
    }
  });

  it('SKIP_ZERO_FIELDS only contains revenue / NOI fields', () => {
    // Defensive: if someone adds a *_pct field here it would silently break
    // percent-based assumptions (a real 0% is meaningful for vacancy).
    for (const f of SKIP_ZERO_FIELDS) {
      expect(f, `${f} should not be a percent field`).not.toMatch(/_pct$/);
    }
  });
});

describe('proforma-seeder: seed vs clear-override parity per FIELD_PRIORITIES key', () => {
  // For each centralized field, drive both code paths with identical layered
  // values and assert they pick the same source. This is the regression test
  // that would have failed before the fix for Task #435 (gpr).
  for (const fieldName of Object.keys(FIELD_PRIORITIES)) {
    const priority = FIELD_PRIORITIES[fieldName];

    it(`${fieldName}: both paths pick the same source when all priority sources have values`, () => {
      const values: Partial<Record<Source | 'platform', number | null>> = { platform: 100 };
      // Give each priority source a distinct value so we can detect a swap
      priority.forEach((src, i) => {
        values[src] = 1000 + i * 100;
      });
      const seed = seedResolve(fieldName, values);
      const cleared = clearOverridePath(fieldName, values);
      expect(seed.resolution).toBe(cleared.resolution);
      expect(seed.resolved).toBe(cleared.resolved);
      expect(seed.resolution).toBe(priority[0]);
    });

    it(`${fieldName}: both paths fall through to next priority source when first is null`, () => {
      if (priority.length < 2) return;
      const values: Partial<Record<Source | 'platform', number | null>> = { platform: 100 };
      values[priority[0]] = null;
      values[priority[1]] = 2000;
      const seed = seedResolve(fieldName, values);
      const cleared = clearOverridePath(fieldName, values);
      expect(seed.resolution).toBe(cleared.resolution);
      expect(seed.resolved).toBe(cleared.resolved);
      expect(seed.resolution).toBe(priority[1]);
    });
  }
});

describe('proforma-seeder: SKIP_ZERO behavior parity', () => {
  // The exact bug from Task #435: GPR with rent_roll = 0 and t12 populated
  // must fall through to t12, not resolve to zero. Verify both paths.
  it('gpr with rent_roll=0 and t12=4,876,535 resolves to t12 in BOTH paths', () => {
    const values = { platform: null, t12: 4_876_535, rent_roll: 0 };
    const seed = seedResolve('gpr', values);
    const cleared = clearOverridePath('gpr', values);
    expect(seed.resolved).toBe(4_876_535);
    expect(seed.resolution).toBe('t12');
    expect(cleared.resolved).toBe(4_876_535);
    expect(cleared.resolution).toBe('t12');
  });

  it('every SKIP_ZERO_FIELDS entry: a 0 in the highest-priority source falls through', () => {
    for (const fieldName of SKIP_ZERO_FIELDS) {
      const priority = FIELD_PRIORITIES[fieldName];
      // Some skip-zero fields (egi, noi, net_rental_income, total_opex) are
      // derived and not in FIELD_PRIORITIES — they are skipped here, the
      // skip-zero contract for them is enforced in resolve()'s code path.
      if (!priority || priority.length < 2) continue;
      const values: Partial<Record<Source | 'platform', number | null>> = { platform: null };
      values[priority[0]] = 0;
      values[priority[1]] = 9999;
      const seed = seedResolve(fieldName, values);
      const cleared = clearOverridePath(fieldName, values);
      expect(
        seed.resolution,
        `${fieldName} seed path should skip 0 and pick ${priority[1]}`,
      ).toBe(priority[1]);
      expect(
        cleared.resolution,
        `${fieldName} clear-override path should skip 0 and pick ${priority[1]}`,
      ).toBe(priority[1]);
      expect(seed.resolved).toBe(cleared.resolved);
    }
  });

  it('non-skip-zero fields (e.g. vacancy_pct): 0 in the highest-priority source IS accepted', () => {
    // vacancy_pct = 0 (fully leased) is meaningful — must NOT fall through.
    const fieldName = 'vacancy_pct';
    expect(SKIP_ZERO_FIELDS.has(fieldName)).toBe(false);
    const priority = FIELD_PRIORITIES[fieldName];
    const values: Partial<Record<Source | 'platform', number | null>> = { platform: 0.07 };
    values[priority[0]] = 0;
    values[priority[1]] = 0.05;
    const seed = seedResolve(fieldName, values);
    const cleared = clearOverridePath(fieldName, values);
    expect(seed.resolved).toBe(0);
    expect(seed.resolution).toBe(priority[0]);
    expect(cleared.resolved).toBe(0);
    expect(cleared.resolution).toBe(priority[0]);
  });
});

describe('proforma-seeder: platform fallback parity', () => {
  it('all priority sources null → both paths fall back to platform', () => {
    for (const fieldName of Object.keys(FIELD_PRIORITIES)) {
      const values = { platform: 42 };
      const seed = seedResolve(fieldName, values);
      const cleared = clearOverridePath(fieldName, values);
      expect(seed.resolved, `${fieldName} seed should fall back to platform`).toBe(42);
      expect(seed.resolution, `${fieldName} seed resolution`).toBe('platform_fallback');
      expect(cleared.resolved, `${fieldName} clear should fall back to platform`).toBe(42);
      expect(cleared.resolution, `${fieldName} clear resolution`).toBe('platform_fallback');
    }
  });

  it('all sources null AND platform null → both paths produce resolved=null', () => {
    for (const fieldName of Object.keys(FIELD_PRIORITIES)) {
      const values = { platform: null };
      const seed = seedResolve(fieldName, values);
      const cleared = clearOverridePath(fieldName, values);
      expect(seed.resolved, `${fieldName} seed should be null`).toBeNull();
      expect(cleared.resolved, `${fieldName} clear should be null`).toBeNull();
    }
  });
});
