import { describe, it, expect } from 'vitest';
import {
  resolveProjectType,
  toTabVisibilityType,
  isExisting,
  isDevelopment,
  isRedevelopment,
  requiresZoningCapacity,
  supportsUnitMixBuilder,
  hasExistingBaseline,
} from '../project-type';

describe('resolveProjectType', () => {
  it('returns existing for null/undefined/empty', () => {
    expect(resolveProjectType(null)).toBe('existing');
    expect(resolveProjectType(undefined)).toBe('existing');
    expect(resolveProjectType('')).toBe('existing');
    expect(resolveProjectType('  ')).toBe('existing');
  });

  it('resolves existing aliases', () => {
    const aliases = [
      'existing', 'acquisition', 'existing_acquisition',
      'multifamily', 'multi-family', 'multi_family',
      'office', 'retail', 'industrial', 'flex', 'mixed_use', 'mixed-use', 'mixeduse',
      'hotel', 'hospitality', 'self_storage', 'self-storage',
      'senior_housing', 'senior-housing', 'student_housing',
      'single_family', 'single-family', 'sfr',
      'build_to_rent', 'build-to-rent',
    ];
    for (const alias of aliases) {
      expect(resolveProjectType(alias)).toBe('existing');
    }
  });

  it('resolves stabilized to canonical stabilized (W1-2)', () => {
    expect(resolveProjectType('stabilized')).toBe('stabilized');
    expect(resolveProjectType('stabilised')).toBe('stabilized');
  });

  it('resolves value-add to canonical value_add (W1-2)', () => {
    expect(resolveProjectType('value-add')).toBe('value_add');
    expect(resolveProjectType('value_add')).toBe('value_add');
    expect(resolveProjectType('valueadd')).toBe('value_add');
  });

  it('resolves lease-up to canonical lease_up (W1-2)', () => {
    expect(resolveProjectType('lease-up')).toBe('lease_up');
    expect(resolveProjectType('lease_up')).toBe('lease_up');
    expect(resolveProjectType('leaseup')).toBe('lease_up');
    expect(resolveProjectType('leasing')).toBe('lease_up');
  });

  it('resolves development aliases', () => {
    const aliases = [
      'development', 'ground_up', 'ground-up',
      'new_construction', 'new construction',
      'new_development', 'new-development',
      'land', 'vacant',
    ];
    for (const alias of aliases) {
      expect(resolveProjectType(alias)).toBe('development');
    }
  });

  it('resolves redevelopment aliases', () => {
    const aliases = [
      'redevelopment', 'redev', 'rehab', 'repositioning',
      'adaptive_reuse', 'adaptive-reuse',
      'gut_rehab', 'gut-rehab',
      'tear-down', 'teardown', 'tear_down',
      'conversion', 'partial_demo', 'partial-demo',
    ];
    for (const alias of aliases) {
      expect(resolveProjectType(alias)).toBe('redevelopment');
    }
  });

  it('is case-insensitive', () => {
    expect(resolveProjectType('DEVELOPMENT')).toBe('development');
    expect(resolveProjectType('Redevelopment')).toBe('redevelopment');
    expect(resolveProjectType('EXISTING')).toBe('existing');
    expect(resolveProjectType('Adaptive_Reuse')).toBe('redevelopment');
    expect(resolveProjectType('GROUND-UP')).toBe('development');
    expect(resolveProjectType('STABILIZED')).toBe('stabilized');
    expect(resolveProjectType('LEASE_UP')).toBe('lease_up');
  });

  it('trims whitespace', () => {
    expect(resolveProjectType('  development  ')).toBe('development');
    expect(resolveProjectType('  rehab ')).toBe('redevelopment');
    expect(resolveProjectType('  lease-up  ')).toBe('lease_up');
  });

  it('defaults unknown values to existing', () => {
    expect(resolveProjectType('unknown')).toBe('existing');
    expect(resolveProjectType('something_else')).toBe('existing');
  });
});

describe('toTabVisibilityType', () => {
  it('maps 6-value canonical to 3-value projection', () => {
    expect(toTabVisibilityType('existing')).toBe('existing');
    expect(toTabVisibilityType('stabilized')).toBe('existing');
    expect(toTabVisibilityType('value_add')).toBe('existing');
    expect(toTabVisibilityType('lease_up')).toBe('existing');
    expect(toTabVisibilityType('development')).toBe('development');
    expect(toTabVisibilityType('redevelopment')).toBe('redevelopment');
  });
});

describe('predicate helpers', () => {
  it('isExisting', () => {
    expect(isExisting('existing')).toBe(true);
    expect(isExisting('stabilized')).toBe(true);
    expect(isExisting('value_add')).toBe(true);
    expect(isExisting('lease_up')).toBe(true);
    expect(isExisting('development')).toBe(false);
    expect(isExisting('redevelopment')).toBe(false);
  });

  it('isDevelopment', () => {
    expect(isDevelopment('development')).toBe(true);
    expect(isDevelopment('existing')).toBe(false);
    expect(isDevelopment('lease_up')).toBe(false);
  });

  it('isRedevelopment', () => {
    expect(isRedevelopment('redevelopment')).toBe(true);
    expect(isRedevelopment('existing')).toBe(false);
    expect(isRedevelopment('lease_up')).toBe(false);
  });

  it('requiresZoningCapacity', () => {
    expect(requiresZoningCapacity('development')).toBe(true);
    expect(requiresZoningCapacity('redevelopment')).toBe(true);
    expect(requiresZoningCapacity('existing')).toBe(false);
    expect(requiresZoningCapacity('lease_up')).toBe(false);
  });

  it('supportsUnitMixBuilder', () => {
    expect(supportsUnitMixBuilder('development')).toBe(true);
    expect(supportsUnitMixBuilder('redevelopment')).toBe(true);
    expect(supportsUnitMixBuilder('existing')).toBe(false);
    expect(supportsUnitMixBuilder('value_add')).toBe(false);
  });

  it('hasExistingBaseline', () => {
    expect(hasExistingBaseline('existing')).toBe(true);
    expect(hasExistingBaseline('stabilized')).toBe(true);
    expect(hasExistingBaseline('value_add')).toBe(true);
    expect(hasExistingBaseline('lease_up')).toBe(true);
    expect(hasExistingBaseline('redevelopment')).toBe(true);
    expect(hasExistingBaseline('development')).toBe(false);
  });
});
