/**
 * Projections Dependency Graph — M07 → M09 Adapter
 *
 * Declares the static row-level dependency map for all Occupancy/Leasing and
 * Concessions projection rows.  Used by:
 *   • recomputeRowOnOverride() for cheap-path selective recalculation
 *   • INV-1 through INV-5 invariant layer for loud violation detection
 *
 * Row keys use the form "<block>.<field>" where block is either
 * "occ" (OccupancyLeasingBlock) or "conc" (ConcessionsBlock).
 * Year-specific keys are "<block>.<field>.<year>" (1-indexed).
 *
 * Dependency semantics:
 *   PROP_COMPOUND_GROWTH  — row carries forward from Y(n-1) with a growth multiplier
 *   PROP_DERIVED_RECOMPUTE — row is always derived from other row values in the same year
 *   PROP_ANCHOR            — row is anchored in Y1 from dealContext; later years carry forward
 *   PROP_EXTERNAL          — row is sourced directly from a named dealContext field
 */

// ── Row type tags ────────────────────────────────────────────────────────────

export type PropagationRule =
  | 'PROP_COMPOUND_GROWTH'
  | 'PROP_DERIVED_RECOMPUTE'
  | 'PROP_ANCHOR'
  | 'PROP_EXTERNAL';

export interface RowDependency {
  /** What must be (re)computed before this row */
  dependsOn: string[];
  /** How this row propagates from Y1 → YN */
  propagation: PropagationRule;
  /** Human-readable description for diagnostics */
  description: string;
}

// ── Static dependency map ────────────────────────────────────────────────────
//
// Key: "<block>.<field>", where block ∈ { occ, conc }
// A year-level override key "<block>.<field>.<year>" takes precedence for
// recomputeRowOnOverride() but falls back to the block-level entry.

export const PROJECTIONS_DEPENDENCY_GRAPH: Record<string, RowDependency> = {

  // ── Occupancy & Leasing block ──────────────────────────────────────────────

  'occ.physical_occupancy': {
    dependsOn: [],   // root — driven by mode/absorption curve/starting state
    propagation: 'PROP_ANCHOR',
    description: 'Physical occupancy %: STAB=churn model, LU=absorption curve, RDEV=renovation dilution',
  },

  'occ.loss_to_lease': {
    dependsOn: ['occ.physical_occupancy'],
    propagation: 'PROP_COMPOUND_GROWTH',
    description: 'LTL%: anchored from subject S1 current_state or platform peer; compresses toward stabilized default',
  },

  'occ.rent_growth': {
    dependsOn: [],   // independent — sourced from calibrated peer posterior
    propagation: 'PROP_EXTERNAL',
    description: 'Market rent growth % YoY: sourced from M05 submarket posterior or platform baseline',
  },

  'occ.effective_rent': {
    dependsOn: ['occ.loss_to_lease', 'occ.rent_growth'],
    propagation: 'PROP_DERIVED_RECOMPUTE',
    description: 'Effective rent per unit: market_rent × (1 − loss_to_lease); recomputed on every LTL or rent growth change',
  },

  // ── Concessions block ──────────────────────────────────────────────────────

  'conc.free_months': {
    dependsOn: [],   // sourced from ConcessionEnvironmentOutput.per_year[n].free_months
    propagation: 'PROP_EXTERNAL',
    description: 'Free rent months: output of the Concession Environment Engine for the year\'s mode',
  },

  'conc.concession_pct': {
    dependsOn: ['conc.free_months'],
    propagation: 'PROP_DERIVED_RECOMPUTE',
    description: 'Concession %: free_months / 12 (approx annual gross revenue fraction)',
  },

  'conc.source_blend': {
    dependsOn: ['conc.free_months'],
    propagation: 'PROP_EXTERNAL',
    description: 'Attribution weights for the concession value (class_default / submarket / subject)',
  },
};

// ── Override downstream map ─────────────────────────────────────────────────
//
// Maps an overridden row → the set of rows that must be re-derived.
// Used by recomputeRowOnOverride() to avoid a full block rebuild.

export const OVERRIDE_DOWNSTREAM: Record<string, string[]> = {
  'occ.physical_occupancy': ['occ.loss_to_lease', 'occ.effective_rent'],
  'occ.loss_to_lease':      ['occ.effective_rent'],
  'occ.rent_growth':        ['occ.effective_rent'],
  'conc.free_months':       ['conc.concession_pct'],
};

// ── INV Invariant definitions ───────────────────────────────────────────────

export interface InvariantDefinition {
  id: 'INV-1' | 'INV-2' | 'INV-3' | 'INV-4' | 'INV-5';
  description: string;
  /** Returns null when the invariant holds; an error string when violated. */
  check: (output: ProjectionsOutput) => string | null;
}

export interface OccupancyLeasingRow {
  year: number;
  physical_occupancy: number;
  loss_to_lease: number;
  rent_growth: number;
  effective_rent: number | null;
  market_rent: number | null;
  mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  transition_badge?: 'LU→S' | 'R→S';
  source: string;
  degraded?: boolean;
  degraded_reason?: string | null;
}

export interface ConcessionsRow {
  year: number;
  free_months: number;
  concession_pct: number;
  supply_pressure_modifier: number;
  confidence: 'HIGH' | 'MED' | 'LOW';
  source_blend: {
    class_default_weight: number;
    submarket_weight: number;
    subject_weight: number;
  };
  mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  transition_badge?: 'LU→S' | 'R→S';
}

export interface ProjectionsOutput {
  deal_id: string;
  computed_at: string;
  hold_years: number;
  deal_mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  occupancy_leasing: OccupancyLeasingRow[];
  concessions: ConcessionsRow[];
  /** Source tier that anchored Y1 occupancy/LTL (e.g. 'subject_history:s1', 'platform') */
  anchor_source: string;
  /** True when subject history was available and used for Y1 anchoring */
  subject_used: boolean;
  degraded_reason: string | null;
}

// ── Invariants ──────────────────────────────────────────────────────────────

export const PROJECTIONS_INVARIANTS: InvariantDefinition[] = [
  {
    id: 'INV-1',
    description: 'Physical occupancy must be in [0.0, 1.0] for every year',
    check: (out) => {
      for (const row of out.occupancy_leasing) {
        if (row.physical_occupancy < 0 || row.physical_occupancy > 1) {
          return `INV-1 VIOLATED: Y${row.year} physical_occupancy=${row.physical_occupancy.toFixed(4)} ∉ [0,1]`;
        }
      }
      return null;
    },
  },
  {
    id: 'INV-2',
    description: 'concession_pct must be ≥ 0 for every year',
    check: (out) => {
      for (const row of out.concessions) {
        if (row.concession_pct < 0) {
          return `INV-2 VIOLATED: Y${row.year} concession_pct=${row.concession_pct.toFixed(4)} < 0`;
        }
      }
      return null;
    },
  },
  {
    id: 'INV-3',
    description: 'free_months must be ≥ 0 for every year',
    check: (out) => {
      for (const row of out.concessions) {
        if (row.free_months < 0) {
          return `INV-3 VIOLATED: Y${row.year} free_months=${row.free_months.toFixed(4)} < 0`;
        }
      }
      return null;
    },
  },
  {
    id: 'INV-4',
    description: 'effective_rent ≈ market_rent × (1 − loss_to_lease) within 1% tolerance',
    check: (out) => {
      for (const row of out.occupancy_leasing) {
        if (row.effective_rent == null || row.market_rent == null) continue;
        const expected = row.market_rent * (1 - row.loss_to_lease);
        const delta = Math.abs(row.effective_rent - expected);
        if (delta > Math.max(1, expected * 0.01)) {
          return `INV-4 VIOLATED: Y${row.year} effective_rent=${row.effective_rent.toFixed(2)} expected≈${expected.toFixed(2)} (delta=${delta.toFixed(2)})`;
        }
      }
      return null;
    },
  },
  {
    id: 'INV-5',
    description: 'Row count in each block must equal holdYears exactly',
    check: (out) => {
      if (out.occupancy_leasing.length !== out.hold_years) {
        return `INV-5 VIOLATED: occupancy_leasing has ${out.occupancy_leasing.length} rows, expected ${out.hold_years}`;
      }
      if (out.concessions.length !== out.hold_years) {
        return `INV-5 VIOLATED: concessions has ${out.concessions.length} rows, expected ${out.hold_years}`;
      }
      return null;
    },
  },
];

/**
 * Run all invariant checks and throw loudly on the first violation.
 * The error message includes the INV id and a full description so failures
 * surface immediately in logs and monitoring dashboards.
 */
export function assertProjectionsInvariants(output: ProjectionsOutput): void {
  for (const inv of PROJECTIONS_INVARIANTS) {
    const violation = inv.check(output);
    if (violation !== null) {
      throw new Error(`[M07→M09 ProjectionsAdapter] ${violation}`);
    }
  }
}
