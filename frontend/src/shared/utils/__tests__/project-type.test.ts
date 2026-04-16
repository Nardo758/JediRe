import { describe, it, expect } from 'vitest';
import {
  resolveProjectType,
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
      'existing', 'acquisition', 'existing_acquisition', 'stabilized',
      'value-add', 'value_add', 'multifamily', 'multi-family', 'multi_family',
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
  });

  it('trims whitespace', () => {
    expect(resolveProjectType('  development  ')).toBe('development');
    expect(resolveProjectType('  rehab ')).toBe('redevelopment');
  });

  it('defaults unknown values to existing', () => {
    expect(resolveProjectType('unknown')).toBe('existing');
    expect(resolveProjectType('something_else')).toBe('existing');
  });
});

describe('predicate helpers', () => {
  it('isExisting', () => {
    expect(isExisting('existing')).toBe(true);
    expect(isExisting('development')).toBe(false);
    expect(isExisting('redevelopment')).toBe(false);
  });

  it('isDevelopment', () => {
    expect(isDevelopment('development')).toBe(true);
    expect(isDevelopment('existing')).toBe(false);
  });

  it('isRedevelopment', () => {
    expect(isRedevelopment('redevelopment')).toBe(true);
    expect(isRedevelopment('existing')).toBe(false);
  });

  it('requiresZoningCapacity', () => {
    expect(requiresZoningCapacity('development')).toBe(true);
    expect(requiresZoningCapacity('redevelopment')).toBe(true);
    expect(requiresZoningCapacity('existing')).toBe(false);
  });

  it('supportsUnitMixBuilder', () => {
    expect(supportsUnitMixBuilder('development')).toBe(true);
    expect(supportsUnitMixBuilder('redevelopment')).toBe(true);
    expect(supportsUnitMixBuilder('existing')).toBe(false);
  });

  it('hasExistingBaseline', () => {
    expect(hasExistingBaseline('existing')).toBe(true);
    expect(hasExistingBaseline('redevelopment')).toBe(true);
    expect(hasExistingBaseline('development')).toBe(false);
  });
});
