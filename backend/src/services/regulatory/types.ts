/**
 * M02 Zoning Module — core types
 *
 * RegulatoryConstraints is the normalized output shape written to
 * property_descriptions.regulatory_constraints.  All constraint fields are
 * LayeredValue<T> so consumers can inspect source provenance (which adapter
 * produced the value) alongside the value itself.
 *
 * Consumers:
 *   M03 Dev Capacity  — far_max, height_max_feet, setbacks, density_max_units_per_acre,
 *                       parking_min_per_unit, lot_coverage_max_pct
 *   M08 Strategy Arb  — permitted_uses, allows_short_term_rental, overlay_districts,
 *                       entitlement_risk
 *   M09 ProForma      — parking_min_per_unit, far_max, impact_fees_est
 *   M14 Risk          — entitlement_risk, zone_code (audit)
 *   M25 JEDI Score    — regulatory_model (Position component)
 */

import type { LayeredValue } from '../../types/layered-value';

// ── Use classifications ────────────────────────────────────────────────────

export type UseClassification =
  | 'single_family_residential'
  | 'multifamily_residential'
  | 'mixed_use'
  | 'retail_commercial'
  | 'office'
  | 'industrial'
  | 'warehouse_distribution'
  | 'hospitality'
  | 'short_term_rental'      // explicit STR use; M08 allow_str logic reads this
  | 'agricultural'
  | 'institutional'
  | 'open_space_recreation'
  | 'conditional_use';       // requires CUP / special use permit approval

// ── Overlay district ───────────────────────────────────────────────────────

export interface OverlayDistrict {
  name: string;    // e.g. "Atlanta Beltline Overlay", "Opportunity Zone"
  type:
    | 'historic'
    | 'transit_oriented'
    | 'opportunity_zone'
    | 'floodplain'
    | 'urban_renewal'
    | 'airport_noise'
    | 'other';
  code: string | null;      // jurisdiction-specific overlay code
  affects_str?: boolean;    // overlay restricts/allows STR
  notes?: string;
}

// ── Regulatory model ───────────────────────────────────────────────────────

export type RegulatoryModel = 'zoning' | 'deed_restriction' | 'mixed';

// ── Core output shape ──────────────────────────────────────────────────────

export interface RegulatoryConstraints {
  // === Use & density ===
  permitted_uses:              LayeredValue<UseClassification[]>;
  density_max_units_per_acre:  LayeredValue<number | null>;
  far_max:                     LayeredValue<number | null>;

  // === Form ===
  height_max_feet:             LayeredValue<number | null>;
  stories_max:                 LayeredValue<number | null>;
  setback_front_feet:          LayeredValue<number | null>;
  setback_side_feet:           LayeredValue<number | null>;
  setback_rear_feet:           LayeredValue<number | null>;
  lot_coverage_max_pct:        LayeredValue<number | null>;

  // === Parking ===
  parking_min_per_unit:        LayeredValue<number | null>;
  parking_min_method:          LayeredValue<'per_unit' | 'per_sqft' | 'matrix' | null>;

  // === Entitlement (M08 + M14) ===
  entitlement_risk:            LayeredValue<'low' | 'medium' | 'high' | null>;
  allows_short_term_rental:    LayeredValue<boolean | null>;

  // === Development cost (M09) ===
  impact_fees_est:             LayeredValue<number | null>;

  // === Special overlays (M08) ===
  overlay_districts:           LayeredValue<OverlayDistrict[]>;

  // === Jurisdictional context ===
  zone_code:                   LayeredValue<string | null>;
  jurisdiction:                LayeredValue<string>;
  regulatory_model:            LayeredValue<RegulatoryModel>;

  // === Source provenance (bare metadata — these ARE the provenance record) ===
  resolved_at:  string;     // ISO timestamp
  source_chain: string[];   // adapters / endpoints consulted, in order
}

// ── Null-safe constructor ──────────────────────────────────────────────────

/**
 * Build a fully-populated RegulatoryConstraints where every constraint field
 * is null / empty-array.  Adapters start from this base and fill only the
 * fields they can resolve — callers always receive a complete shape.
 */
export function emptyRegulatoryConstraints(
  jurisdiction: string,
  regulatory_model: RegulatoryModel,
  source: string,
  source_chain: string[],
): RegulatoryConstraints {
  const lv = <T>(value: T): LayeredValue<T> => ({ value, source });

  return {
    permitted_uses:             lv<UseClassification[]>([]),
    density_max_units_per_acre: lv<number | null>(null),
    far_max:                    lv<number | null>(null),

    height_max_feet:            lv<number | null>(null),
    stories_max:                lv<number | null>(null),
    setback_front_feet:         lv<number | null>(null),
    setback_side_feet:          lv<number | null>(null),
    setback_rear_feet:          lv<number | null>(null),
    lot_coverage_max_pct:       lv<number | null>(null),

    parking_min_per_unit:       lv<number | null>(null),
    parking_min_method:         lv<'per_unit' | 'per_sqft' | 'matrix' | null>(null),

    entitlement_risk:           lv<'low' | 'medium' | 'high' | null>(null),
    allows_short_term_rental:   lv<boolean | null>(null),

    impact_fees_est:            lv<number | null>(null),

    overlay_districts:          lv<OverlayDistrict[]>([]),

    zone_code:                  lv<string | null>(null),
    jurisdiction:               { value: jurisdiction, source },
    regulatory_model:           { value: regulatory_model, source },

    resolved_at:  new Date().toISOString(),
    source_chain,
  };
}
