/**
 * Custom Tab Validator — happy-path + every rejection branch (Task #451)
 */

import { describe, it, expect } from 'vitest';
import {
  CUSTOM_TAB_MAX_BLOCKS,
  CUSTOM_TAB_MAX_PAYLOAD_BYTES,
  CUSTOM_TAB_MAX_TITLE_LEN,
} from '../blueprint/custom-tab-schema';
import {
  formatValidationIssuesForChat,
  validateCustomTabPayload,
} from '../blueprint/custom-tab-validator';

const validPayload = () => ({
  tabId: 'noi-vs-broker',
  title: 'NOI vs Broker Projection',
  description: 'Compare year 5 NOI against the broker estimate.',
  blocks: [
    { type: 'markdown', text: 'Y5 NOI is {{f9.proforma.year1[4].noi}}.' },
    {
      type: 'kpi_tile',
      label: 'Year 5 NOI',
      ref: 'f9.proforma.year1[4].noi',
      format: 'currency',
    },
    {
      type: 'table',
      rowSourceRef: 'f9.proforma.year1',
      columns: [
        { header: 'Year', ref: 'f9.proforma.year1[*].year' },
        { header: 'NOI',  ref: 'f9.proforma.year1[*].noi', format: 'currency' },
      ],
      limit: 5,
    },
    {
      type: 'ratio_bar',
      label: 'LTV',
      numeratorRef: 'assumptions.ltv',
      denominatorRef: 'assumptions.purchasePrice',
      format: 'percent',
      benchmark: 0.7,
    },
    {
      type: 'line_chart',
      seriesRef: 'f9.proforma.year1',
      xLabel: 'Year',
      yLabel: 'NOI',
      format: 'currency',
    },
  ],
});

describe('validateCustomTabPayload · happy path', () => {
  it('accepts a fully-populated payload using only catalog refs', () => {
    const r = validateCustomTabPayload(validPayload());
    expect(r.ok).toBe(true);
    expect(r.unknownFields).toEqual([]);
    expect(r.referencedFields.length).toBeGreaterThan(0);
  });

  it('returns the catalog patterns referenced (deduped + normalised)', () => {
    const r = validateCustomTabPayload(validPayload());
    expect(r.referencedFields).toContain('f9.proforma.year1[*].noi');
    expect(r.referencedFields).toContain('assumptions.ltv');
    expect(r.referencedFields).toContain('assumptions.purchasePrice');
  });

  it('treats refresh/round-trip payloads as valid (idempotency)', () => {
    const p = validPayload();
    const first = validateCustomTabPayload(p);
    const second = validateCustomTabPayload(JSON.parse(JSON.stringify(p)));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });
});

describe('validateCustomTabPayload · outer shape rejections', () => {
  it('rejects null payload', () => {
    const r = validateCustomTabPayload(null);
    expect(r.ok).toBe(false);
  });

  it('rejects non-object payload', () => {
    const r = validateCustomTabPayload('not a tab');
    expect(r.ok).toBe(false);
  });

  it('rejects payload missing tabId', () => {
    const r = validateCustomTabPayload({ ...validPayload(), tabId: undefined });
    expect(r.ok).toBe(false);
    expect(r.issues.some(i => i.path === '$.tabId')).toBe(true);
  });

  it('rejects payload with malformed tabId', () => {
    const r = validateCustomTabPayload({ ...validPayload(), tabId: 'has spaces!' });
    expect(r.ok).toBe(false);
  });

  it('rejects payload missing title', () => {
    const r = validateCustomTabPayload({ ...validPayload(), title: undefined });
    expect(r.ok).toBe(false);
  });

  it('rejects payload with title above max length', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      title: 'x'.repeat(CUSTOM_TAB_MAX_TITLE_LEN + 1),
    });
    expect(r.ok).toBe(false);
  });

  it('rejects payload with empty blocks[]', () => {
    const r = validateCustomTabPayload({ ...validPayload(), blocks: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects payload missing blocks[]', () => {
    const { blocks: _drop, ...rest } = validPayload();
    const r = validateCustomTabPayload(rest);
    expect(r.ok).toBe(false);
  });

  it('rejects payload with too many blocks', () => {
    const tooMany = Array.from({ length: CUSTOM_TAB_MAX_BLOCKS + 1 }).map(() => ({
      type: 'kpi_tile', label: 'x', ref: 'results.summary.noi', format: 'currency',
    }));
    const r = validateCustomTabPayload({ ...validPayload(), blocks: tooMany });
    expect(r.ok).toBe(false);
  });

  it('rejects oversized payloads', () => {
    const fat = {
      ...validPayload(),
      blocks: [
        { type: 'markdown', text: 'x'.repeat(CUSTOM_TAB_MAX_PAYLOAD_BYTES + 100) },
      ],
    };
    const r = validateCustomTabPayload(fat);
    expect(r.ok).toBe(false);
    expect(r.issues.some(i => /exceeds/.test(i.message))).toBe(true);
  });
});

describe('validateCustomTabPayload · per-block rejections', () => {
  it('rejects unknown block type', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'pie_chart', label: 'no' } as any],
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some(i => /Unknown block type/.test(i.message))).toBe(true);
  });

  it('rejects markdown block with empty text', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'markdown', text: '' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects markdown placeholder pointing at unknown field', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'markdown', text: 'value: {{assumptions.totallyMadeUp}}' }],
    });
    expect(r.ok).toBe(false);
    expect(r.unknownFields).toContain('assumptions.totallyMadeUp');
  });

  it('rejects kpi_tile missing ref', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'kpi_tile', label: 'NOI', ref: '' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects kpi_tile with unknown ref + suggests catalog matches', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'kpi_tile', label: 'NOI', ref: 'results.summery.no' }],
    });
    expect(r.ok).toBe(false);
    const issue = r.issues.find(i => i.path.endsWith('.ref'));
    expect(issue?.suggestions?.length).toBeGreaterThan(0);
    expect(issue?.suggestions?.[0]).toContain('results.summary');
  });

  it('rejects kpi_tile with bad format', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'kpi_tile', label: 'x', ref: 'results.summary.noi', format: 'parsec' as any }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects table missing rowSourceRef', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{
        type: 'table', columns: [{ header: 'h', ref: 'f9.proforma.year1[*].noi' }],
        rowSourceRef: '',
      }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects table missing columns[]', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'table', columns: [], rowSourceRef: 'f9.proforma.year1' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects table with too many columns', () => {
    const cols = Array.from({ length: 13 }).map((_, i) => ({
      header: `c${i}`, ref: 'f9.proforma.year1[*].noi',
    }));
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'table', columns: cols, rowSourceRef: 'f9.proforma.year1' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects table column with unknown ref', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{
        type: 'table',
        rowSourceRef: 'f9.proforma.year1',
        columns: [{ header: 'X', ref: 'made.up.path' }],
      }],
    });
    expect(r.ok).toBe(false);
    expect(r.unknownFields).toContain('made.up.path');
  });

  it('rejects table with limit out of range', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{
        type: 'table',
        rowSourceRef: 'f9.proforma.year1',
        columns: [{ header: 'NOI', ref: 'f9.proforma.year1[*].noi' }],
        limit: 999,
      }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects ratio_bar missing numerator', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'ratio_bar', label: 'x', numeratorRef: '', denominatorRef: 'assumptions.purchasePrice' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects ratio_bar with benchmark out of range', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{
        type: 'ratio_bar', label: 'x',
        numeratorRef: 'assumptions.ltv',
        denominatorRef: 'assumptions.purchasePrice',
        benchmark: 1.5,
      }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects line_chart missing seriesRef', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'line_chart', seriesRef: '' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects line_chart compareSeriesRef when unknown', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{
        type: 'line_chart',
        seriesRef: 'f9.proforma.year1',
        compareSeriesRef: 'fake.broker.series',
      }],
    });
    expect(r.ok).toBe(false);
    expect(r.unknownFields).toContain('fake.broker.series');
  });
});

describe('validateCustomTabPayload · suggestion engine', () => {
  it('returns Levenshtein-closest catalog patterns for typos', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'kpi_tile', label: 'IRR', ref: 'results.summary.irrr' }],
    });
    const issue = r.issues.find(i => i.suggestions);
    expect(issue?.suggestions).toContain('results.summary.irr');
  });

  it('formatValidationIssuesForChat prints rejection summary', () => {
    const r = validateCustomTabPayload({
      ...validPayload(),
      blocks: [{ type: 'kpi_tile', label: 'x', ref: 'fakey.path' }],
    });
    const summary = formatValidationIssuesForChat(r);
    expect(summary).toContain('fakey.path');
    expect(summary).toContain('did you mean');
  });

  it('returns empty summary for valid payload', () => {
    expect(formatValidationIssuesForChat(validateCustomTabPayload(validPayload()))).toBe('');
  });
});
