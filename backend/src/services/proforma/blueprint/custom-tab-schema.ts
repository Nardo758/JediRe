/**
 * Custom Tab Content Schema (Task #451)
 * =====================================
 *
 * Declarative schema for Opus-generated F9 custom tabs. The schema is the
 * SINGLE SOURCE OF TRUTH for what blocks Opus may emit and which fields
 * those blocks may reference. Server-side validation rejects anything
 * outside this surface — no free-form HTML, no synthetic field paths.
 *
 * Block types intentionally stay narrow so they can be rendered without
 * `dangerouslySetInnerHTML` and so the renderer can attach provenance
 * badges to every value reference automatically.
 *
 * Field references use a dot-path grammar (e.g. `assumptions.exitCapRate`,
 * `results.summary.irr`, `f9.proforma.year1[3].noi`). The validator
 * enumerates the allowed prefixes; references that fall outside the
 * catalog are rejected with a "did you mean" suggestion.
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Block types
// ────────────────────────────────────────────────────────────────────────────

export type CustomTabBlockType =
  | 'markdown'
  | 'kpi_tile'
  | 'table'
  | 'ratio_bar'
  | 'line_chart';

export interface MarkdownBlock {
  type: 'markdown';
  /** Plain markdown text. Inline `{{path.to.field}}` placeholders are
   *  resolved to provenanced values at render time. */
  text: string;
}

export interface KpiTileBlock {
  type: 'kpi_tile';
  label: string;
  /** Field reference resolving to a numeric ProvenancedValue. */
  ref: string;
  /** Display format hint. Renderer falls back to `number` if unset. */
  format?: 'currency' | 'percent' | 'multiple' | 'number' | 'ratio';
  /** Optional comparison value reference for delta display. */
  compareRef?: string;
  /** Optional sublabel rendered below the KPI value. */
  sublabel?: string;
}

export interface TableBlock {
  type: 'table';
  columns: Array<{
    /** Column header. */
    header: string;
    /** Field reference for the cell value (per-row contexts use `[i]`). */
    ref: string;
    format?: KpiTileBlock['format'];
  }>;
  /** Number of rows to render (resolved against the highest-arity ref). */
  rowSourceRef: string;
  /** Optional limit on rows displayed (default 10). */
  limit?: number;
  caption?: string;
}

export interface RatioBarBlock {
  type: 'ratio_bar';
  label: string;
  numeratorRef: string;
  denominatorRef: string;
  /** Optional benchmark value to display as a target marker (0–1). */
  benchmark?: number;
  format?: 'percent' | 'ratio';
}

export interface LineChartBlock {
  type: 'line_chart';
  /** Field reference resolving to an array of series points. */
  seriesRef: string;
  xLabel?: string;
  yLabel?: string;
  format?: KpiTileBlock['format'];
  /** Optional comparison series reference rendered alongside primary. */
  compareSeriesRef?: string;
}

export type CustomTabBlock =
  | MarkdownBlock
  | KpiTileBlock
  | TableBlock
  | RatioBarBlock
  | LineChartBlock;

export const ALLOWED_BLOCK_TYPES: readonly CustomTabBlockType[] = [
  'markdown',
  'kpi_tile',
  'table',
  'ratio_bar',
  'line_chart',
] as const;

// ────────────────────────────────────────────────────────────────────────────
// 2. Field reference catalog
// ────────────────────────────────────────────────────────────────────────────

/**
 * Allowed field-reference prefixes Opus may use when authoring a custom tab.
 * Each entry describes what the prefix resolves to and which value type
 * downstream renderers expect, so the validator can flag mismatches.
 */
export interface FieldCatalogEntry {
  /** Prefix grammar — `*` indicates any nested key, `[*]` indicates array index. */
  pattern: string;
  description: string;
  /** Expected resolved type of the value at runtime. */
  resolves: 'number' | 'string' | 'array' | 'object' | 'provenanced_number';
  /** Origin metadata so the renderer can fetch from the right surface. */
  surface: 'assumptions' | 'results' | 'f9' | 'deal' | 'projections';
}

export const CUSTOM_TAB_FIELD_CATALOG: readonly FieldCatalogEntry[] = [
  // Assumptions surface — every editable assumption (purchasePrice, exitCapRate, etc.)
  {
    pattern: 'assumptions.purchasePrice',
    description: 'Purchase price (acquisition basis).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.units',
    description: 'Total unit count.',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.exitCapRate',
    description: 'Exit cap rate (decimal, e.g. 0.055).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.holdPeriod',
    description: 'Hold period in years.',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.ltv',
    description: 'Loan-to-value ratio (decimal).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.interestRate',
    description: 'Loan interest rate (decimal).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.loanType',
    description: 'Loan product label.',
    resolves: 'string',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.revenue.rentGrowth',
    description: 'Annual rent growth rate (decimal).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.revenue.vacancy',
    description: 'Stabilised vacancy assumption (decimal).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },
  {
    pattern: 'assumptions.opex.expenseGrowth',
    description: 'Annual OPEX growth rate (decimal).',
    resolves: 'provenanced_number',
    surface: 'assumptions',
  },

  // Results / KPI summary surface
  {
    pattern: 'results.summary.irr',
    description: 'Levered IRR (decimal).',
    resolves: 'provenanced_number',
    surface: 'results',
  },
  {
    pattern: 'results.summary.equityMultiple',
    description: 'Equity multiple (×).',
    resolves: 'provenanced_number',
    surface: 'results',
  },
  {
    pattern: 'results.summary.cashOnCash',
    description: 'Year-1 cash-on-cash (decimal).',
    resolves: 'provenanced_number',
    surface: 'results',
  },
  {
    pattern: 'results.summary.noi',
    description: 'Stabilised NOI ($).',
    resolves: 'provenanced_number',
    surface: 'results',
  },
  {
    pattern: 'results.summary.dscr',
    description: 'Debt service coverage ratio.',
    resolves: 'provenanced_number',
    surface: 'results',
  },

  // F9 deal financials surface — `proforma.year1` is a per-LINE-ITEM array
  // (one row per P&L line: GPR, vacancy, real-estate-tax, NOI, ...). Each row
  // exposes broker / platform / t12 / rentRoll / resolved values for that
  // single line, NOT a per-year time series. Year-by-year time series lives
  // under `projections[*]` (see further down).
  {
    pattern: 'f9.proforma.year1[*].field',
    description: 'Machine-readable identifier for the P&L line item (e.g. "noi", "gross_potential_rent", "real_estate_tax").',
    resolves: 'string',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].label',
    description: 'Human-readable label for the P&L line item.',
    resolves: 'string',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].broker',
    description: 'Broker-projected value for this P&L line item (year-1 view).',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].platform',
    description: 'Platform-derived value for this P&L line item (year-1 view).',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].t12',
    description: 'T-12 actual value for this P&L line item.',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].rentRoll',
    description: 'Current rent-roll value for this P&L line item (where applicable).',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].resolved',
    description: 'Resolved (final) value for this P&L line item after reconciling broker/platform/t12.',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].perUnit',
    description: 'Resolved value normalised per unit.',
    resolves: 'provenanced_number',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1[*].benchmarkPosition',
    description: 'Where this line lands vs submarket benchmark: above | within | below.',
    resolves: 'string',
    surface: 'f9',
  },
  {
    pattern: 'f9.proforma.year1',
    description: 'Full P&L line-item array (used as a table rowSource for broker-vs-platform comparisons).',
    resolves: 'array',
    surface: 'f9',
  },

  // Projections surface — generic multi-year time-series array
  {
    pattern: 'projections',
    description: 'Full multi-year projection array (used as a series source for line_chart and as a rowSource for tables).',
    resolves: 'array',
    surface: 'projections',
  },
  {
    pattern: 'projections[*].year',
    description: 'Projection year index.',
    resolves: 'number',
    surface: 'projections',
  },
  {
    pattern: 'projections[*].noi',
    description: 'Projected NOI for year [*].',
    resolves: 'provenanced_number',
    surface: 'projections',
  },
  {
    pattern: 'projections[*].revenue',
    description: 'Projected revenue for year [*].',
    resolves: 'provenanced_number',
    surface: 'projections',
  },

  // Deal metadata surface
  {
    pattern: 'deal.name',
    description: 'Deal display name.',
    resolves: 'string',
    surface: 'deal',
  },
  {
    pattern: 'deal.address',
    description: 'Deal property address.',
    resolves: 'string',
    surface: 'deal',
  },
  {
    pattern: 'deal.city',
    description: 'Deal city.',
    resolves: 'string',
    surface: 'deal',
  },
  {
    pattern: 'deal.units',
    description: 'Deal unit count (header field).',
    resolves: 'number',
    surface: 'deal',
  },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// 3. Outer payload + limits
// ────────────────────────────────────────────────────────────────────────────

export interface CustomTabPayload {
  /** Stable identifier scoped to (dealId, userId). */
  tabId: string;
  /** Tab title shown in the F9 tab bar. */
  title: string;
  /** Optional one-line description rendered above the blocks. */
  description?: string;
  /** Ordered list of declarative blocks. */
  blocks: CustomTabBlock[];
  /** Echoed by `refresh_custom_tab` — the prompt that produced this tab. */
  generationPrompt?: string;
  /** Model identifier (e.g. `claude-sonnet-4-5`). */
  modelVersion?: string;
}

/** Maximum serialized payload size (bytes). Keeps prompt feedback loops sane. */
export const CUSTOM_TAB_MAX_PAYLOAD_BYTES = 32 * 1024;
/** Maximum number of blocks per tab. */
export const CUSTOM_TAB_MAX_BLOCKS = 20;
/** Maximum length of the title (characters). */
export const CUSTOM_TAB_MAX_TITLE_LEN = 80;

// ────────────────────────────────────────────────────────────────────────────
// 4. Inline reference extractor — used by validator + renderer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract `{{ ref }}` placeholders from a markdown block body. Returns the
 * raw reference strings (e.g. `assumptions.exitCapRate`).
 */
export function extractInlineRefs(text: string): string[] {
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_.\[\]\*]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/**
 * Normalise a runtime reference path (e.g. `f9.proforma.year1[3].noi`) into
 * its catalog pattern (e.g. `f9.proforma.year1[*].noi`) so we can compare
 * against `CUSTOM_TAB_FIELD_CATALOG`.
 */
export function normaliseRefToPattern(ref: string): string {
  return ref.replace(/\[\d+\]/g, '[*]');
}

/**
 * Build a JSON-serialisable description of the schema for the Opus system
 * prompt. Compact on purpose — Opus only needs the surface, not the prose.
 */
export function buildCustomTabSchemaForPrompt(): {
  blockTypes: readonly CustomTabBlockType[];
  fieldCatalog: Array<Pick<FieldCatalogEntry, 'pattern' | 'resolves' | 'surface'>>;
  limits: {
    maxBlocks: number;
    maxTitleLen: number;
    maxPayloadBytes: number;
  };
} {
  return {
    blockTypes: ALLOWED_BLOCK_TYPES,
    fieldCatalog: CUSTOM_TAB_FIELD_CATALOG.map(({ pattern, resolves, surface }) => ({
      pattern,
      resolves,
      surface,
    })),
    limits: {
      maxBlocks: CUSTOM_TAB_MAX_BLOCKS,
      maxTitleLen: CUSTOM_TAB_MAX_TITLE_LEN,
      maxPayloadBytes: CUSTOM_TAB_MAX_PAYLOAD_BYTES,
    },
  };
}
