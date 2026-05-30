/**
 * Divergence Threshold Registry — B3 (Piece B3: Divergence Surfacing)
 *
 * Configurable per-field thresholds used when comparing source layers
 * (override, agent, t12, om, broker, storedResolved) against each other.
 *
 * All thresholds are expressed in the same unit as the stored field value:
 *   - Percentage fields (stored in 0–1 decimal scale): absolute delta
 *     e.g. threshold 0.03 = 300 basis points
 *   - Dollar fields: absolute dollar delta
 *     e.g. threshold 50000 = divergence > $50K is material
 *
 * Alert-level mapping:
 *   delta < threshold           → 'none'    (sources agree within tolerance)
 *   delta >= threshold          → 'warn'    (material divergence, operator should review)
 *   delta >= threshold × 3      → 'block'   (extreme divergence, flags in completeness score)
 *
 * To add a new field: add an entry below keyed by the canonical field name
 * (same key used in ALLOWED_FIELDS in get-field-value.service.ts).
 */

export type DivergenceAlertLevel = 'none' | 'info' | 'warn' | 'block';

export interface FieldThreshold {
  /** Absolute delta threshold in field units (same scale as stored value). */
  absolute: number;
  /**
   * Human-readable unit for the threshold — used in UI tooltip copy.
   * e.g. 'bps', '%', '$', '$/unit', 'yrs'
   */
  unit: string;
  /**
   * Whether the field is a percentage stored in 0–1 decimal scale.
   * When true the UI displays delta × 10000 as basis points.
   */
  isPct: boolean;
}

// ── Per-field threshold overrides ────────────────────────────────────────────
//
// Absent entries fall back to category defaults below.

const FIELD_OVERRIDES: Record<string, FieldThreshold> = {
  // Revenue deduction rates — 300 bps is material for operational metrics
  loss_to_lease:  { absolute: 0.03,   unit: 'bps', isPct: true },
  vacancy:        { absolute: 0.05,   unit: 'bps', isPct: true },
  concessions:    { absolute: 0.03,   unit: 'bps', isPct: true },
  bad_debt:       { absolute: 0.02,   unit: 'bps', isPct: true },

  // Cap rates — 50 bps is material for exit valuation
  exit_cap:       { absolute: 0.005,  unit: 'bps', isPct: true },

  // Growth rates — 100 bps material for long-hold projections
  rent_growth_yr1:{ absolute: 0.01,   unit: 'bps', isPct: true },

  // Dollar fields — absolute divergence
  gpr:            { absolute: 50000,  unit: '$',   isPct: false },
  noi:            { absolute: 50000,  unit: '$',   isPct: false },
  total_opex:     { absolute: 50000,  unit: '$',   isPct: false },
  egi:            { absolute: 50000,  unit: '$',   isPct: false },
  real_estate_tax:{ absolute: 25000,  unit: '$',   isPct: false },
  purchase_price: { absolute: 500000, unit: '$',   isPct: false },
};

// ── Category fallbacks ────────────────────────────────────────────────────────

const PCT_DEFAULT: FieldThreshold  = { absolute: 0.05,   unit: 'bps', isPct: true };
const USD_DEFAULT: FieldThreshold  = { absolute: 100000, unit: '$',   isPct: false };

const DOLLAR_FIELDS = new Set([
  'gpr', 'noi', 'noi_after_reserves', 'total_opex', 'egi',
  'real_estate_tax', 'insurance', 'management_fee', 'repairs_maintenance',
  'utilities', 'payroll', 'administrative', 'marketing', 'contract_services',
  'net_rental_income', 'other_income', 'replacement_reserves',
  'purchase_price', 'equity_at_close', 'loan_amount',
]);

// ── Public API ─────────────────────────────────────────────────────────────────

export function getFieldThreshold(fieldName: string): FieldThreshold {
  if (FIELD_OVERRIDES[fieldName]) return FIELD_OVERRIDES[fieldName];
  return DOLLAR_FIELDS.has(fieldName) ? USD_DEFAULT : PCT_DEFAULT;
}

export function deriveDivergenceAlertLevel(
  delta: number,
  threshold: number,
): DivergenceAlertLevel {
  if (delta < threshold)          return 'none';
  if (delta < threshold * 3)      return 'warn';
  return 'block';
}
