/**
 * Custom Tab Payload Validator (Task #451)
 * ========================================
 *
 * Server-side gate for any payload Opus emits via the `create_custom_tab`
 * action — and for any direct CRUD call from the frontend. Rejects payloads
 * that reference unknown fields, use unknown block types, exceed size
 * limits, or violate per-block invariants. Returns a structured result with
 * "did you mean" suggestions for unknown references so the assistant
 * transcript can show the model what to fix.
 */

import {
  ALLOWED_BLOCK_TYPES,
  CUSTOM_TAB_FIELD_CATALOG,
  CUSTOM_TAB_MAX_BLOCKS,
  CUSTOM_TAB_MAX_PAYLOAD_BYTES,
  CUSTOM_TAB_MAX_TITLE_LEN,
  CustomTabBlock,
  CustomTabPayload,
  KpiTileBlock,
  LineChartBlock,
  MarkdownBlock,
  RatioBarBlock,
  TableBlock,
  extractInlineRefs,
  normaliseRefToPattern,
} from './custom-tab-schema';

export interface CustomTabValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
  /** Optional list of catalog patterns the validator suggests instead. */
  suggestions?: string[];
}

export interface CustomTabValidationResult {
  ok: boolean;
  issues: CustomTabValidationIssue[];
  /** All field references the payload made (catalog patterns, deduped). */
  referencedFields: string[];
  /** References that did NOT resolve to the catalog. */
  unknownFields: string[];
}

const ALLOWED_FORMATS = new Set([
  'currency',
  'percent',
  'multiple',
  'number',
  'ratio',
]);

const CATALOG_PATTERNS = CUSTOM_TAB_FIELD_CATALOG.map(e => e.pattern);

// ────────────────────────────────────────────────────────────────────────────
// Suggestion helper — Levenshtein distance over catalog patterns
// ────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function suggestPatterns(unknown: string, max = 3): string[] {
  const norm = normaliseRefToPattern(unknown);
  return [...CATALOG_PATTERNS]
    .map(p => ({ p, d: levenshtein(norm, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(x => x.p);
}

// ────────────────────────────────────────────────────────────────────────────
// Reference validation
// ────────────────────────────────────────────────────────────────────────────

function isKnownRef(ref: string): boolean {
  const pattern = normaliseRefToPattern(ref);
  return CATALOG_PATTERNS.includes(pattern);
}

function recordRef(
  ref: string | undefined,
  path: string,
  state: {
    issues: CustomTabValidationIssue[];
    referenced: Set<string>;
    unknown: Set<string>;
  },
): void {
  if (!ref || typeof ref !== 'string') return;
  const pattern = normaliseRefToPattern(ref);
  state.referenced.add(pattern);
  if (!isKnownRef(ref)) {
    state.unknown.add(ref);
    state.issues.push({
      severity: 'error',
      path,
      message: `Unknown field reference "${ref}". Pick a path from the field catalog.`,
      suggestions: suggestPatterns(ref),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-block validators
// ────────────────────────────────────────────────────────────────────────────

function validateMarkdown(
  block: MarkdownBlock,
  path: string,
  state: ReturnType<typeof newState>,
): void {
  if (typeof block.text !== 'string' || block.text.trim() === '') {
    state.issues.push({
      severity: 'error',
      path: `${path}.text`,
      message: 'markdown block requires a non-empty `text` string',
    });
    return;
  }
  for (const ref of extractInlineRefs(block.text)) {
    recordRef(ref, `${path}.text<<${ref}>>`, state);
  }
}

function validateKpiTile(
  block: KpiTileBlock,
  path: string,
  state: ReturnType<typeof newState>,
): void {
  if (!block.label || typeof block.label !== 'string') {
    state.issues.push({
      severity: 'error',
      path: `${path}.label`,
      message: 'kpi_tile requires a non-empty `label`',
    });
  }
  if (!block.ref) {
    state.issues.push({
      severity: 'error',
      path: `${path}.ref`,
      message: 'kpi_tile requires a `ref` field reference',
    });
  } else {
    recordRef(block.ref, `${path}.ref`, state);
  }
  if (block.compareRef) recordRef(block.compareRef, `${path}.compareRef`, state);
  if (block.format && !ALLOWED_FORMATS.has(block.format)) {
    state.issues.push({
      severity: 'error',
      path: `${path}.format`,
      message: `Unknown format "${block.format}". Allowed: ${[...ALLOWED_FORMATS].join(', ')}`,
    });
  }
}

function validateTable(
  block: TableBlock,
  path: string,
  state: ReturnType<typeof newState>,
): void {
  if (!Array.isArray(block.columns) || block.columns.length === 0) {
    state.issues.push({
      severity: 'error',
      path: `${path}.columns`,
      message: 'table requires a non-empty `columns[]` array',
    });
    return;
  }
  if (block.columns.length > 12) {
    state.issues.push({
      severity: 'error',
      path: `${path}.columns`,
      message: `table supports at most 12 columns (got ${block.columns.length})`,
    });
  }
  if (!block.rowSourceRef) {
    state.issues.push({
      severity: 'error',
      path: `${path}.rowSourceRef`,
      message: 'table requires a `rowSourceRef` (which array drives the rows)',
    });
  } else {
    recordRef(block.rowSourceRef, `${path}.rowSourceRef`, state);
  }
  block.columns.forEach((col, idx) => {
    if (!col.header || typeof col.header !== 'string') {
      state.issues.push({
        severity: 'error',
        path: `${path}.columns[${idx}].header`,
        message: 'column requires a non-empty `header`',
      });
    }
    recordRef(col.ref, `${path}.columns[${idx}].ref`, state);
    if (col.format && !ALLOWED_FORMATS.has(col.format)) {
      state.issues.push({
        severity: 'error',
        path: `${path}.columns[${idx}].format`,
        message: `Unknown format "${col.format}"`,
      });
    }
  });
  if (block.limit !== undefined && (typeof block.limit !== 'number' || block.limit < 1 || block.limit > 60)) {
    state.issues.push({
      severity: 'error',
      path: `${path}.limit`,
      message: '`limit` must be an integer between 1 and 60',
    });
  }
}

function validateRatioBar(
  block: RatioBarBlock,
  path: string,
  state: ReturnType<typeof newState>,
): void {
  if (!block.label) {
    state.issues.push({ severity: 'error', path: `${path}.label`, message: 'ratio_bar requires a `label`' });
  }
  recordRef(block.numeratorRef, `${path}.numeratorRef`, state);
  recordRef(block.denominatorRef, `${path}.denominatorRef`, state);
  if (!block.numeratorRef || !block.denominatorRef) {
    state.issues.push({
      severity: 'error',
      path,
      message: 'ratio_bar requires both `numeratorRef` and `denominatorRef`',
    });
  }
  if (block.benchmark !== undefined) {
    if (typeof block.benchmark !== 'number' || block.benchmark < 0 || block.benchmark > 1) {
      state.issues.push({
        severity: 'error',
        path: `${path}.benchmark`,
        message: '`benchmark` must be a number in [0, 1]',
      });
    }
  }
}

function validateLineChart(
  block: LineChartBlock,
  path: string,
  state: ReturnType<typeof newState>,
): void {
  if (!block.seriesRef) {
    state.issues.push({
      severity: 'error',
      path: `${path}.seriesRef`,
      message: 'line_chart requires a `seriesRef` pointing at an array',
    });
  } else {
    recordRef(block.seriesRef, `${path}.seriesRef`, state);
  }
  if (block.compareSeriesRef) recordRef(block.compareSeriesRef, `${path}.compareSeriesRef`, state);
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────────

function newState() {
  return {
    issues: [] as CustomTabValidationIssue[],
    referenced: new Set<string>(),
    unknown: new Set<string>(),
  };
}

export function validateCustomTabPayload(
  payload: unknown,
): CustomTabValidationResult {
  const state = newState();

  // ── Outer shape ────────────────────────────────────────────────────────
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      issues: [{ severity: 'error', path: '$', message: 'Payload must be a JSON object' }],
      referencedFields: [],
      unknownFields: [],
    };
  }
  const p = payload as Partial<CustomTabPayload>;

  // Size guard
  let serialized = '';
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return {
      ok: false,
      issues: [{ severity: 'error', path: '$', message: 'Payload is not JSON-serialisable' }],
      referencedFields: [],
      unknownFields: [],
    };
  }
  if (Buffer.byteLength(serialized, 'utf8') > CUSTOM_TAB_MAX_PAYLOAD_BYTES) {
    state.issues.push({
      severity: 'error',
      path: '$',
      message: `Payload exceeds ${CUSTOM_TAB_MAX_PAYLOAD_BYTES} bytes; trim blocks or shorten markdown`,
    });
  }

  // tabId / title
  if (!p.tabId || typeof p.tabId !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(p.tabId)) {
    state.issues.push({
      severity: 'error',
      path: '$.tabId',
      message: '`tabId` must match /^[a-z0-9_-]{1,64}$/ (lowercase slug)',
    });
  }
  if (!p.title || typeof p.title !== 'string') {
    state.issues.push({
      severity: 'error',
      path: '$.title',
      message: '`title` is required and must be a string',
    });
  } else if (p.title.length > CUSTOM_TAB_MAX_TITLE_LEN) {
    state.issues.push({
      severity: 'error',
      path: '$.title',
      message: `\`title\` must be ≤ ${CUSTOM_TAB_MAX_TITLE_LEN} characters`,
    });
  }

  // blocks
  if (!Array.isArray(p.blocks) || p.blocks.length === 0) {
    state.issues.push({
      severity: 'error',
      path: '$.blocks',
      message: '`blocks[]` must be a non-empty array',
    });
    return finalize(state);
  }
  if (p.blocks.length > CUSTOM_TAB_MAX_BLOCKS) {
    state.issues.push({
      severity: 'error',
      path: '$.blocks',
      message: `Too many blocks (${p.blocks.length}); maximum is ${CUSTOM_TAB_MAX_BLOCKS}`,
    });
  }

  p.blocks.forEach((block, idx) => {
    const path = `$.blocks[${idx}]`;
    if (!block || typeof block !== 'object' || !('type' in block)) {
      state.issues.push({
        severity: 'error',
        path,
        message: 'block must be an object with a `type` field',
      });
      return;
    }
    const b = block as CustomTabBlock;
    if (!ALLOWED_BLOCK_TYPES.includes(b.type as never)) {
      state.issues.push({
        severity: 'error',
        path: `${path}.type`,
        message: `Unknown block type "${b.type}". Allowed: ${ALLOWED_BLOCK_TYPES.join(', ')}`,
      });
      return;
    }
    switch (b.type) {
      case 'markdown':   validateMarkdown(b, path, state);   break;
      case 'kpi_tile':   validateKpiTile(b, path, state);    break;
      case 'table':      validateTable(b, path, state);      break;
      case 'ratio_bar':  validateRatioBar(b, path, state);   break;
      case 'line_chart': validateLineChart(b, path, state);  break;
    }
  });

  return finalize(state);
}

function finalize(state: ReturnType<typeof newState>): CustomTabValidationResult {
  const errors = state.issues.filter(i => i.severity === 'error');
  return {
    ok: errors.length === 0,
    issues: state.issues,
    referencedFields: [...state.referenced].sort(),
    unknownFields: [...state.unknown].sort(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helper for assistant transcripts — render issues as a compact string
// ────────────────────────────────────────────────────────────────────────────

export function formatValidationIssuesForChat(
  result: CustomTabValidationResult,
  limit = 5,
): string {
  if (result.ok) return '';
  const errors = result.issues.filter(i => i.severity === 'error');
  const lines = errors.slice(0, limit).map(i => {
    const sug = i.suggestions?.length ? ` (did you mean ${i.suggestions.slice(0, 2).map(s => `\`${s}\``).join(' or ')}?)` : '';
    return `- ${i.path}: ${i.message}${sug}`;
  });
  if (errors.length > limit) {
    lines.push(`- … and ${errors.length - limit} more error(s)`);
  }
  return lines.join('\n');
}
