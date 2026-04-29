/**
 * Custom Tab Schema — shape + helper smoke tests (Task #451)
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_BLOCK_TYPES,
  CUSTOM_TAB_FIELD_CATALOG,
  CUSTOM_TAB_MAX_BLOCKS,
  CUSTOM_TAB_MAX_PAYLOAD_BYTES,
  CUSTOM_TAB_MAX_TITLE_LEN,
  buildCustomTabSchemaForPrompt,
  extractInlineRefs,
  normaliseRefToPattern,
} from '../blueprint/custom-tab-schema';

describe('custom-tab-schema · constants', () => {
  it('exposes exactly the 5 documented block types', () => {
    expect([...ALLOWED_BLOCK_TYPES].sort()).toEqual(
      ['kpi_tile', 'line_chart', 'markdown', 'ratio_bar', 'table'],
    );
  });

  it('field catalog contains the surfaces the F9 page exposes', () => {
    const surfaces = new Set(CUSTOM_TAB_FIELD_CATALOG.map(e => e.surface));
    expect(surfaces.has('assumptions')).toBe(true);
    expect(surfaces.has('results')).toBe(true);
    expect(surfaces.has('f9')).toBe(true);
    expect(surfaces.has('deal')).toBe(true);
    expect(surfaces.has('projections')).toBe(true);
  });

  it('every catalog entry has a non-empty pattern + resolves type', () => {
    for (const e of CUSTOM_TAB_FIELD_CATALOG) {
      expect(typeof e.pattern).toBe('string');
      expect(e.pattern.length).toBeGreaterThan(0);
      expect(['number', 'string', 'array', 'object', 'provenanced_number']).toContain(e.resolves);
    }
  });

  it('catalog patterns are unique', () => {
    const seen = new Set<string>();
    for (const e of CUSTOM_TAB_FIELD_CATALOG) {
      expect(seen.has(e.pattern)).toBe(false);
      seen.add(e.pattern);
    }
  });

  it('exposes sane size limits', () => {
    expect(CUSTOM_TAB_MAX_BLOCKS).toBeGreaterThan(5);
    expect(CUSTOM_TAB_MAX_PAYLOAD_BYTES).toBeGreaterThanOrEqual(8 * 1024);
    expect(CUSTOM_TAB_MAX_TITLE_LEN).toBeGreaterThanOrEqual(40);
  });
});

describe('custom-tab-schema · extractInlineRefs', () => {
  it('returns empty for plain text', () => {
    expect(extractInlineRefs('Hello world, no placeholders here.')).toEqual([]);
  });

  it('extracts a single placeholder', () => {
    expect(extractInlineRefs('IRR is {{ results.summary.irr }} today.')).toEqual([
      'results.summary.irr',
    ]);
  });

  it('extracts multiple placeholders preserving order', () => {
    expect(extractInlineRefs('NOI {{results.summary.noi}} vs {{f9.proforma.year1[3].broker}}')).toEqual([
      'results.summary.noi',
      'f9.proforma.year1[3].broker',
    ]);
  });

  it('ignores malformed placeholders', () => {
    expect(extractInlineRefs('{ no double braces } and { single }')).toEqual([]);
  });

  it('handles whitespace around the inner ref', () => {
    expect(extractInlineRefs('{{   assumptions.exitCapRate   }}')).toEqual(['assumptions.exitCapRate']);
  });
});

describe('custom-tab-schema · normaliseRefToPattern', () => {
  it('keeps non-array paths unchanged', () => {
    expect(normaliseRefToPattern('assumptions.exitCapRate')).toBe('assumptions.exitCapRate');
  });

  it('normalises numeric indices to [*]', () => {
    expect(normaliseRefToPattern('f9.proforma.year1[3].broker')).toBe('f9.proforma.year1[*].broker');
  });

  it('normalises multiple indices', () => {
    expect(normaliseRefToPattern('projections[0].breakdown[12].amount')).toBe(
      'projections[*].breakdown[*].amount',
    );
  });
});

describe('custom-tab-schema · buildCustomTabSchemaForPrompt', () => {
  it('returns a JSON-serialisable shape', () => {
    const slice = buildCustomTabSchemaForPrompt();
    expect(() => JSON.stringify(slice)).not.toThrow();
  });

  it('includes block types + field catalog + limits', () => {
    const slice = buildCustomTabSchemaForPrompt();
    expect(slice.blockTypes.length).toBe(ALLOWED_BLOCK_TYPES.length);
    expect(slice.fieldCatalog.length).toBe(CUSTOM_TAB_FIELD_CATALOG.length);
    expect(slice.limits.maxBlocks).toBe(CUSTOM_TAB_MAX_BLOCKS);
    expect(slice.limits.maxTitleLen).toBe(CUSTOM_TAB_MAX_TITLE_LEN);
  });

  it('strips prose `description` from field-catalog entries', () => {
    const slice = buildCustomTabSchemaForPrompt();
    for (const entry of slice.fieldCatalog) {
      expect(entry).not.toHaveProperty('description');
    }
  });
});
