/**
 * Projections Dependency Graph — M07 → M09 Adapter
 *
 * Declares the static row-level dependency map for all Occupancy/Leasing and
 * Concessions projection rows.  Used by:
 *   • recomputeRowOnOverride() for dependency-graph-driven selective recomputation
 *   • INV-1 through INV-5 invariant layer for loud violation detection
 *
 * Row keys use the form "<block>.<field>" where block is either
 * "occ" (OccupancyLeasingBlock) or "conc" (ConcessionsBlock).
 *
 * Dependency semantics:
 *   PROP_COMPOUND_GROWTH   — row carries forward from Y(n-1) with a growth multiplier
 *   PROP_DERIVED_RECOMPUTE — row is always derived from other row values in the same year
 *   PROP_ANCHOR            — row is anchored in Y1 from dealContext; later years carry forward
 *   PROP_EXTERNAL          — row is sourced directly from a named dealContext field
 */

// ── Row type tags ─────────────────────────────────────────────────────────────

export type PropagationRule =
  | 'PROP_COMPOUND_GROWTH'
  | 'PROP_DERIVED_RECOMPUTE'
  | 'PROP_ANCHOR'
  | 'PROP_EXTERNAL';

export interface RowDependency {
  dependsOn: string[];
  propagation: PropagationRule;
  description: string;
}

// ── Static dependency map ─────────────────────────────────────────────────────

export const PROJECTIONS_DEPENDENCY_GRAPH: Record<string, RowDependency> = {

  'occ.physical_occupancy': {
    dependsOn: [],
    propagation: 'PROP_ANCHOR',
    description:
      'STAB: Y1 = subject S1 current_state.occupancy_rate → mean-revert toward observed_dynamics-derived target. ' +
      'LU: Y1 = absorption_curve[year*12] per spec §3. ' +
      'RDEV: phase-weighted blended occ per phase CO + lease-up schedule.',
  },

  'occ.loss_to_lease': {
    dependsOn: ['occ.physical_occupancy'],
    propagation: 'PROP_COMPOUND_GROWTH',
    description:
      'Y1 = subject S1 current_state.loss_to_lease (or observed_dynamics.loss_to_lease S2+). ' +
      'STAB: compresses toward observed_dynamics-derived floor per year. ' +
      'LU: interpolates from peak to floor along occupancy-progress axis (physOcc-aware). ' +
      'RDEV: blended (renovated cohort gets uplift discount).',
  },

  'occ.rent_growth': {
    dependsOn: [],
    propagation: 'PROP_EXTERNAL',
    description:
      'Source priority: traffic.market_rent_growth (M05) → ' +
      'observed_dynamics.new_lease_trade_out_pct (M07 S2+) → BASELINE_RENT_GROWTH (3%).',
  },

  'occ.effective_rent': {
    dependsOn: ['occ.loss_to_lease', 'occ.rent_growth'],
    propagation: 'PROP_DERIVED_RECOMPUTE',
    description:
      'STAB/LU: market_rent × (1 − loss_to_lease). ' +
      'RDEV: phase-blended market_rent × (1 − loss_to_lease) where renovated cohort ' +
      'carries post_reno_rent_uplift from M22 capex_schedule.',
  },

  'conc.free_months': {
    dependsOn: [],
    propagation: 'PROP_EXTERNAL',
    description:
      'ConcessionEnvironmentOutput.per_year[n].free_months. ' +
      'RDEV pre-reno: per_year[n].untouched_free_months (retention concession). ' +
      'RDEV post-reno: per_year[n].renovated_free_months. ' +
      'Absent concession_environment: mode-based default.',
  },

  'conc.concession_pct': {
    dependsOn: ['conc.free_months'],
    propagation: 'PROP_DERIVED_RECOMPUTE',
    description: 'ConcessionEnvironmentOutput per_year concession_pct; fallback = free_months / 12.',
  },

  'conc.source_blend': {
    dependsOn: ['conc.free_months'],
    propagation: 'PROP_EXTERNAL',
    description: 'Attribution weights: class_default / submarket / subject from ConcessionEnvironmentOutput.',
  },
};

// ── Override downstream map ───────────────────────────────────────────────────

export const OVERRIDE_DOWNSTREAM: Record<string, string[]> = {
  'occ.physical_occupancy': ['occ.loss_to_lease', 'occ.effective_rent'],
  'occ.loss_to_lease':      ['occ.effective_rent'],
  'occ.rent_growth':        ['occ.effective_rent'],
  'conc.free_months':       ['conc.concession_pct'],
};

// ── Row interfaces ────────────────────────────────────────────────────────────

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
  anchor_source: string;
  subject_used: boolean;
  degraded_reason: string | null;
  /**
   * Set when deal_mode was null/undefined/unrecognized and was auto-resolved
   * from the StartingState mode.  Surfaces as a UI badge.
   */
  mode_auto_resolved?: string | null;
}

// ── INV Invariants ────────────────────────────────────────────────────────────

export interface InvariantDefinition {
  id: 'INV-1' | 'INV-2' | 'INV-3' | 'INV-4' | 'INV-5';
  description: string;
  check: (output: ProjectionsOutput) => string | null;
}

export const PROJECTIONS_INVARIANTS: InvariantDefinition[] = [
  {
    id: 'INV-1',
    description: 'Physical occupancy ∈ [0.0, 1.0] for every year',
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
    description: 'concession_pct ≥ 0 for every year',
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
    description: 'free_months ≥ 0 for every year',
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
        const tol = Math.max(1, expected * 0.01);
        if (Math.abs(row.effective_rent - expected) > tol) {
          return (
            `INV-4 VIOLATED: Y${row.year} effective_rent=${row.effective_rent.toFixed(2)} ` +
            `expected≈${expected.toFixed(2)} delta=${Math.abs(row.effective_rent - expected).toFixed(2)}`
          );
        }
      }
      return null;
    },
  },
  {
    id: 'INV-5',
    description: 'Row count in each block = holdYears exactly',
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
 * Run all invariant checks.  Throws with the first violation message so that
 * failures surface immediately in logs and monitoring dashboards.
 */
export function assertProjectionsInvariants(output: ProjectionsOutput): void {
  for (const inv of PROJECTIONS_INVARIANTS) {
    const violation = inv.check(output);
    if (violation !== null) {
      throw new Error(`[M07→M09 ProjectionsAdapter] ${violation}`);
    }
  }
}
