/**
 * Stabilized Year Resolver — M09 Pro Forma Session 9.2
 *
 * Determines the stabilized year Y_S for a deal by running the Lease Velocity
 * Engine (M07) and resolving the binding constraint. Y_S is defined as:
 *
 *   Y_S = ceil(stabilization_month / 12)
 *
 * where stabilization_month is the first month where the occupancy target
 * (95% physical by default) is sustained and all binding constraints are
 * satisfied (lease roll burn-off, capex completion, lease-up absorption).
 *
 * @version 1.0.0
 * @date 2026-05-15
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import LeaseVelocityEngine from './lease-velocity-engine';
import type { LeaseVelocityInputs, LeaseVelocityResult, LeaseMode } from './lease-velocity-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelType = 'acquisition_value_add' | 'acquisition_stabilized' | 'development' | 'redevelopment';

export interface BindingConstraint {
  type: 'rent_roll_burn_off' | 'capex_completion' | 'lease_up_absorption' | 'permitting' | 'construction' | 'occupancy_recovery';
  description: string;
  resolvedMonth: number | null; // 0-indexed month when constraint is resolved
  severity: 'binding' | 'secondary' | 'informational';
}

export interface StabilizedYearResult {
  /** The Pro Forma stabilized year (1-indexed, Y1 = first year) */
  stabilizedYear: number;
  /** 0-indexed month within year where stabilization is reached */
  stabilizationMonth: number;
  /** Calendar month string "YYYY-MM" of stabilization */
  stabilizationCalendarMonth: string;
  /** The binding constraint that determines Y_S */
  bindingConstraint: BindingConstraint | null;
  /** All constraints considered (enriched diagnostics) */
  constraints: BindingConstraint[];
  /** The model type resolved from deal metadata */
  modelType: ModelType;
  /** The LV engine mode that produced the result */
  engineMode: LeaseMode;
  /** Full LV engine result (for downstream use) */
  engineResult: LeaseVelocityResult | null;
  /** Number of months from now (or deal start) to stabilization */
  monthsToStabilization: number;
  /** Error message if resolution failed */
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthsToCalendar(monthIndex: number, baseYear = 2026, baseMonth = 0): { year: number; month: number; cal: string } {
  const totalMonths = baseYear * 12 + baseMonth + monthIndex;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const cal = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { year, month, cal };
}

function fmt$(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Constraint detection ─────────────────────────────────────────────────────

/**
 * Detect rent roll burn-off constraint from existing lease data.
 * Scans rent roll for the latest lease end date.
 */
async function detectRentRollBurnOff(dealId: string, pool: ReturnType<typeof getPool>): Promise<BindingConstraint | null> {
  try {
    // Check for rent roll units with lease end dates
    const result = await pool.query(
      `SELECT
         MAX(
           COALESCE(
             (unit_data->>'lease_end_date')::date,
             (unit_data->>'lease_to')::date
           )
         ) AS last_lease_end
       FROM deal_rent_roll_units
       WHERE deal_id = $1
         AND archived_at IS NULL`,
      [dealId]
    );

    if (result.rows.length > 0 && result.rows[0].last_lease_end) {
      const lastEnd = new Date(result.rows[0].last_lease_end);
      const now = new Date();
      const monthsRemaining = (lastEnd.getFullYear() - now.getFullYear()) * 12
        + (lastEnd.getMonth() - now.getMonth());

      if (monthsRemaining > 0) {
        return {
          type: 'rent_roll_burn_off',
          description: `Rent roll burn-off — last in-place lease expires ${lastEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
          resolvedMonth: monthsRemaining,
          severity: monthsRemaining > 24 ? 'binding' : 'secondary',
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn('Error detecting rent roll burn-off', { err, dealId });
    return null;
  }
}

/**
 * Detect capex completion constraint from renovation assumptions.
 */
async function detectCapexCompletion(dealId: string, pool: ReturnType<typeof getPool>): Promise<BindingConstraint | null> {
  try {
    // Check deal_capex_items for latest completion date
    const result = await pool.query(
      `SELECT
         MAX(completion_date) AS latest_completion,
         COUNT(*) FILTER (WHERE completion_percent < 100 OR completion_percent IS NULL) AS incomplete_count
       FROM deal_capex_items
       WHERE deal_id = $1
         AND archived_at IS NULL`,
      [dealId]
    );

    if (result.rows.length > 0 && result.rows[0].incomplete_count > 0) {
      const latest = result.rows[0].latest_completion
        ? new Date(result.rows[0].latest_completion)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // assume 1 year if no dates

      const now = new Date();
      const monthsToComplete = Math.max(
        0,
        (latest.getFullYear() - now.getFullYear()) * 12
          + (latest.getMonth() - now.getMonth())
      );

      return {
        type: 'capex_completion',
        description: `CapEx complete — ${result.rows[0].incomplete_count} line items remaining, target ${latest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        resolvedMonth: monthsToComplete,
        severity: monthsToComplete > 6 ? 'binding' : 'secondary',
      };
    }
    return null;
  } catch (err) {
    logger.warn('Error detecting capex completion', { err, dealId });
    return null;
  }
}

/**
 * Detect lease-up absorption constraint for ground-up development.
 * Uses the deal's total units and any pre-lease data from deal_data.
 */
function detectLeaseUpAbsorption(
  totalUnits: number,
  preLeasedCount: number,
  engineResult: LeaseVelocityResult | null,
): BindingConstraint | null {
  if (engineResult?.stabilization_month != null) {
    return {
      type: 'lease_up_absorption',
      description: `95% sustained occupancy post-delivery — month ${engineResult.stabilization_month} (${monthsToCalendar(engineResult.stabilization_month).cal})`,
      resolvedMonth: engineResult.stabilization_month,
      severity: 'binding',
    };
  }

  // Fallback: rough estimate for development
  if (totalUnits > 0) {
    const estMonths = Math.ceil(totalUnits / 15); // ~15 units/month absorption
    return {
      type: 'lease_up_absorption',
      description: `${totalUnits} units at ~15/month absorption pace (estimated): ~${estMonths} months`,
      resolvedMonth: estMonths,
      severity: 'binding',
    };
  }

  return null;
}

/**
 * Detect occupancy recovery constraint for value-add / redevelopment.
 */
function detectOccupancyRecovery(
  currentOccupancy: number,
  engineResult: LeaseVelocityResult | null,
): BindingConstraint | null {
  if (currentOccupancy >= 0.95) return null;

  if (engineResult?.stabilization_month != null) {
    const months = engineResult.stabilization_month;
    return {
      type: 'occupancy_recovery',
      description: `Occupancy recovery ${(currentOccupancy * 100).toFixed(0)}% → 95% over ${months} months`,
      resolvedMonth: months,
      severity: 'binding',
    };
  }

  const estMonths = Math.ceil((0.95 - currentOccupancy) * 24);
  return {
    type: 'occupancy_recovery',
    description: `Occupancy recovery ${(currentOccupancy * 100).toFixed(0)}% → 95% (estimated ~${estMonths} months)`,
    resolvedMonth: estMonths,
    severity: 'binding',
  };
}

// ─── Model Type Resolution ────────────────────────────────────────────────────

function resolveModelType(projectType: string | null, dealData: Record<string, any>): ModelType {
  const subType = String(dealData?.subtype ?? dealData?.deal_subtype ?? '').toLowerCase();
  const businessPlan = String(dealData?.business_plan ?? dealData?.strategy ?? '').toLowerCase();

  if (projectType === 'development') {
    if (subType.includes('redev') || subType.includes('rehab') || subType.includes('reposition')) {
      return 'redevelopment';
    }
    return 'development';
  }

  if (subType.includes('value') || subType.includes('add') || subType.includes('reno')) {
    return 'acquisition_value_add';
  }

  if (businessPlan.includes('core') || businessPlan.includes('stabilize') || businessPlan.includes('hold')) {
    return 'acquisition_stabilized';
  }

  return 'acquisition_value_add';
}

// ─── Engine Mode Selection ────────────────────────────────────────────────────

function selectEngineMode(
  modelType: ModelType,
  currentOccupancy: number,
  hasActiveCapex: boolean,
  unitsBuilt: boolean,
): LeaseMode {
  if (modelType === 'development' && !unitsBuilt) {
    return 'LEASE_UP_NEW_CONSTRUCTION';
  }
  if (modelType === 'redevelopment') {
    return hasActiveCapex ? 'OCCUPANCY_RECOVERY' : 'LEASE_UP_NEW_CONSTRUCTION';
  }
  if (currentOccupancy < 0.90) {
    return 'OCCUPANCY_RECOVERY';
  }
  if (modelType === 'acquisition_stabilized') {
    return 'STABILIZED_MAINTENANCE';
  }
  // Default: value-add assumptions
  return 'OCCUPANCY_RECOVERY';
}

// ─── Build LV Inputs from Deal ────────────────────────────────────────────────

async function buildLvInputs(
  dealId: string,
  dealData: Record<string, any>,
  modelType: ModelType,
  engineMode: LeaseMode,
  pool: ReturnType<typeof getPool>,
): Promise<LeaseVelocityInputs> {
  const totalUnits = dealData?.total_units ?? dealData?.unit_count ?? 200;
  const currentOccupancy = dealData?.current_occupancy ?? 0.90;

  // Try to get average market rent from comps or market data
  let avgMarketRent = 1800;
  try {
    const rentResult = await pool.query(
      `SELECT avg_rent
       FROM deal_comp_sets
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );
    if (rentResult.rows.length > 0 && rentResult.rows[0].avg_rent) {
      avgMarketRent = parseFloat(rentResult.rows[0].avg_rent);
    }
  } catch {
    // fallback
  }

  const preLeasedCount = dealData?.pre_leased_count ?? 0;
  const propertyClass = dealData?.property_class ?? (dealData?.class ?? 'B');
  const yearBuilt = dealData?.year_built ?? 2000;
  const deliveryMonth = dealData?.delivery_month ?? 4; // April base assumption

  const inputs: LeaseVelocityInputs = {
    total_units: totalUnits,
    target_occupancy: 0.95,
    current_occupancy: currentOccupancy,
    mode: engineMode,
    avg_market_rent: avgMarketRent,
    property_class: propertyClass as 'A' | 'B' | 'C',
    stabilization_definition: 'PHYSICAL_95',
    marketing_intensity: 'MARKET',
    concession_strategy: engineMode === 'OCCUPANCY_RECOVERY' ? 'AGGRESSIVE' : 'MARKET',
    avg_lease_term_months: 12,
    time_horizon_months: 48,
    deal_id: dealId,
  };

  if (engineMode === 'LEASE_UP_NEW_CONSTRUCTION') {
    inputs.delivery_month = deliveryMonth;
    inputs.pre_leased_count = preLeasedCount;
    inputs.pre_lease_window_months = 6;
  }

  if (engineMode === 'OCCUPANCY_RECOVERY') {
    inputs.catch_up_period_months = 12;
  }

  return inputs;
}

// ─── Main Resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the stabilized year for a deal.
 *
 * This is the core M09 computation. It:
 * 1. Fetches deal metadata from DB
 * 2. Runs (or uses cached) Lease Velocity Engine output
 * 3. Detects all binding constraints (rent roll, capex, absorption)
 * 4. Computes Y_S = ceil(stabilization_month / 12)
 * 5. Returns enriched result for the stabilized-potential route
 */
export async function resolveStabilizedYear(dealId: string): Promise<StabilizedYearResult> {
  try {
    const pool = getPool();

    // ── Step 1: Fetch deal metadata ──────────────────────────────────────────
    const dealResult = await pool.query(
      `SELECT id, user_id, project_type, deal_data
       FROM deals
       WHERE id = $1
       LIMIT 1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return {
        stabilizedYear: 1,
        stabilizationMonth: 0,
        stabilizationCalendarMonth: '2026-01',
        bindingConstraint: null,
        constraints: [],
        modelType: 'acquisition_value_add',
        engineMode: 'STABILIZED_MAINTENANCE',
        engineResult: null,
        monthsToStabilization: 0,
        error: 'Deal not found',
      };
    }

    const dealRow = dealResult.rows[0];
    const dealData = dealRow.deal_data ?? {};

    // ── Step 2: Resolve model type ───────────────────────────────────────────
    const modelType = resolveModelType(dealRow.project_type, dealData);

    // ── Step 3: Detect constraints ───────────────────────────────────────────
    const constraints: BindingConstraint[] = [];

    // 3a. Rent roll burn-off
    const burnOff = await detectRentRollBurnOff(dealId, pool);
    if (burnOff) constraints.push(burnOff);

    // 3b. CapEx completion
    const capex = await detectCapexCompletion(dealId, pool);
    if (capex) constraints.push(capex);

    // 3c. Determine current occupancy and active capex status
    const currentOccupancy = dealData?.current_occupancy ?? 0.90;
    const hasActiveCapex = constraints.some(c => c.type === 'capex_completion');
    const unitsBuilt = modelType !== 'development' || (dealData?.units_delivered ?? 0) > 0;

    // ── Step 4: Run Lease Velocity Engine ────────────────────────────────────
    const engineMode = selectEngineMode(modelType, currentOccupancy, hasActiveCapex, unitsBuilt);
    const inputs = await buildLvInputs(dealId, dealData, modelType, engineMode, pool);

    const engineResult = LeaseVelocityEngine.run(inputs);

    // 4a. Lease-up absorption constraint (for development)
    const totalUnits = dealData?.total_units ?? dealData?.unit_count ?? 200;
    const preLeasedCount = dealData?.pre_leased_count ?? 0;
    const absorption = detectLeaseUpAbsorption(totalUnits, preLeasedCount, engineResult);
    if (absorption && (modelType === 'development' || modelType === 'redevelopment')) {
      constraints.push(absorption);
    }

    // 4b. Occupancy recovery constraint (for value-add / redevelopment)
    if (modelType === 'acquisition_value_add' || modelType === 'redevelopment') {
      const recovery = detectOccupancyRecovery(currentOccupancy, engineResult);
      if (recovery) constraints.push(recovery);
    }

    // ── Step 5: Resolve stabilization month and Y_S ─────────────────────────
    // Primary source: LV engine stabilization_month
    let stabilizationMonth = engineResult.stabilization_month ?? 12; // default 1 year

    // Secondary: check if binding constraints push further out
    const bindingConstraints = constraints.filter(c => c.severity === 'binding');
    if (bindingConstraints.length > 0) {
      const latestBindingMonth = Math.max(
        ...bindingConstraints.map(c => c.resolvedMonth ?? 0)
      );
      stabilizationMonth = Math.max(stabilizationMonth, latestBindingMonth);
    }

    // Ensure minimum: at least 12 months for development
    if (modelType === 'development' && stabilizationMonth < 12) {
      stabilizationMonth = 12;
    }

    // Find the binding constraint (the one that resolves last)
    const bindingConstraint = bindingConstraints.length > 0
      ? bindingConstraints.reduce((a, b) =>
          (a.resolvedMonth ?? 0) >= (b.resolvedMonth ?? 0) ? a : b
        )
      : null;

    // Compute Y_S: 1-indexed year, ceiling division
    const stabilizedYear = Math.max(1, Math.ceil(stabilizationMonth / 12));

    // Calendar month
    const cal = monthsToCalendar(stabilizationMonth);

    return {
      stabilizedYear,
      stabilizationMonth,
      stabilizationCalendarMonth: cal.cal,
      bindingConstraint,
      constraints,
      modelType,
      engineMode,
      engineResult,
      monthsToStabilization: stabilizationMonth,
    };
  } catch (err: any) {
    logger.error('Stabilized year resolver failed', { err, dealId });
    return {
      stabilizedYear: 1,
      stabilizationMonth: 0,
      stabilizationCalendarMonth: '2026-01',
      bindingConstraint: null,
      constraints: [],
      modelType: 'acquisition_value_add',
      engineMode: 'STABILIZED_MAINTENANCE',
      engineResult: null,
      monthsToStabilization: 0,
      error: err?.message ?? 'Resolution failed',
    };
  }
}
