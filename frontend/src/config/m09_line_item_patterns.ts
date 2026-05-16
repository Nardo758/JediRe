/**
 * M09 Line-Item Pattern Routing
 *
 * Every Pro Forma row renders one of three expand patterns:
 *   A — Floor-Plan Grid with Cost + Yield (GPR only)
 *   B — Simple Regime Expand (pre-reno / post-stab sub-rows)
 *   C — Single-Value (existing 3-layer pattern, no expand)
 *
 * Pattern assignment is per-line-item per-deal-type. Deal types that
 * do not have a specific entry fall back to 'C'.
 */

export type LineItemPattern = 'A' | 'B' | 'C';

export type DealTypeKey =
  | 'value_add'
  | 'redevelopment'
  | 'development'
  | 'lease_up'
  | 'stabilized'
  | 'existing';

interface PatternEntry {
  pattern: LineItemPattern;
  dealTypes: DealTypeKey[];
}

const PATTERN_TABLE: Record<string, PatternEntry> = {
  gpr: {
    pattern: 'A',
    dealTypes: ['value_add', 'redevelopment', 'development', 'lease_up', 'stabilized', 'existing'],
  },
  vacancy_loss: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
  concessions: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
  repairs_maintenance: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
  marketing: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
  turnover: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
  contract_services: {
    pattern: 'B',
    dealTypes: ['value_add', 'redevelopment'],
  },
};

/**
 * Returns the expand pattern for a given line item field and deal type.
 * Falls back to 'C' (no expand) when the field is not in the table,
 * or when the deal type does not match the table entry's deal type list.
 */
export function getLineItemPattern(
  field: string,
  dealType: DealTypeKey | string | null | undefined,
): LineItemPattern {
  const entry = PATTERN_TABLE[field];
  if (!entry) return 'C';
  if (!dealType) return 'C';
  const dt = dealType as DealTypeKey;
  if (entry.dealTypes.includes(dt)) return entry.pattern;
  return 'C';
}

/**
 * Returns true for fields that use Pattern B (regime expand) for the given
 * deal type. Used in ProFormaSummaryTab to gate which rows get the expand
 * affordance.
 */
export function isPatternB(
  field: string,
  dealType: DealTypeKey | string | null | undefined,
): boolean {
  return getLineItemPattern(field, dealType) === 'B';
}

/**
 * Returns true for GPR (always Pattern A regardless of deal type).
 */
export function isPatternA(field: string): boolean {
  return field === 'gpr';
}
