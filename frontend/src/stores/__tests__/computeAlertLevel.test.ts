import { describe, it, expect } from 'vitest';
import { computeAlertLevel, layered } from '../dealContext.types';
import type { LayeredValue } from '../dealContext.types';

function makeLV<T>(overrides: Partial<LayeredValue<T>> & { value: T }): LayeredValue<T> {
  return {
    source: 'platform',
    resolvedFrom: 'platform',
    updatedAt: new Date().toISOString(),
    confidence: 0.5,
    alertLevel: 'none',
    userReviewed: false,
    ...overrides,
  };
}

describe('computeAlertLevel', () => {
  it('returns none for user-sourced values', () => {
    const lv = makeLV({ value: 100, source: 'user', resolvedFrom: 'user', confidence: 0.1 });
    expect(computeAlertLevel(lv)).toBe('none');
  });

  it('returns block for missing identity fields', () => {
    const lv = makeLV({ value: '', confidence: 0.9 });
    expect(computeAlertLevel(lv, { isIdentity: true })).toBe('block');
  });

  it('returns block for null identity fields', () => {
    const lv = makeLV({ value: null as any, confidence: 0.9 });
    expect(computeAlertLevel(lv, { isIdentity: true })).toBe('block');
  });

  it('returns block for high-sensitivity fields with very low confidence', () => {
    const lv = makeLV({ value: 5.5, confidence: 0.3 });
    expect(computeAlertLevel(lv, { highSensitivity: true })).toBe('block');
  });

  it('returns none for high-confidence reviewed values', () => {
    const lv = makeLV({ value: 100, confidence: 0.95, userReviewed: true });
    expect(computeAlertLevel(lv)).toBe('none');
  });

  it('returns warn for broker/platform divergence > 15%', () => {
    const lv = makeLV({
      value: 100,
      confidence: 0.8,
      layers: {
        broker: { value: 120, updatedAt: '', confidence: 0.8 },
        platform: { value: 100, updatedAt: '', confidence: 0.8 },
      },
    });
    expect(computeAlertLevel(lv)).toBe('warn');
  });

  it('returns info for moderate confidence but not yet reviewed', () => {
    const lv = makeLV({ value: 100, confidence: 0.75, userReviewed: false });
    expect(computeAlertLevel(lv)).toBe('info');
  });

  it('returns warn for low confidence (< 0.7)', () => {
    const lv = makeLV({ value: 100, confidence: 0.55, userReviewed: false });
    expect(computeAlertLevel(lv)).toBe('warn');
  });

  it('returns none for reviewed values above 0.7 threshold', () => {
    const lv = makeLV({ value: 100, confidence: 0.75, userReviewed: true });
    expect(computeAlertLevel(lv)).toBe('none');
  });
});

describe('layered helper', () => {
  it('creates a valid LayeredValue with defaults', () => {
    const lv = layered(42);
    expect(lv.value).toBe(42);
    expect(lv.source).toBe('broker');
    expect(lv.resolvedFrom).toBe('broker');
    expect(lv.confidence).toBe(0.5);
    expect(lv.alertLevel).toBeDefined();
    expect(lv.userReviewed).toBe(false);
  });

  it('creates with custom source and confidence', () => {
    const lv = layered('test', 'platform', 0.9);
    expect(lv.value).toBe('test');
    expect(lv.source).toBe('platform');
    expect(lv.resolvedFrom).toBe('platform');
    expect(lv.confidence).toBe(0.9);
  });

  it('maps user source to user resolvedFrom', () => {
    const lv = layered(10, 'user', 1.0);
    expect(lv.resolvedFrom).toBe('user');
    expect(lv.alertLevel).toBe('none');
  });
});
