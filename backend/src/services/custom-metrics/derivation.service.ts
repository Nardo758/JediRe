/**
 * Custom metric derivation service — Category 7
 *
 * CUSTOM_METRICS_BUILD_SPEC.md §5 — Provenance, zones, and reconciliation
 *
 * Evaluates derived metrics at each period, handles zone inheritance,
 * and wires into the reconciliation path.
 */

import { Pool } from 'pg';
import type { ProFormaPeriodicSeed, PeriodicFieldSeries, PeriodLayeredValue } from '../proforma/periodic-field.types';
import type { BoundaryContext } from '../proforma/boundary.types';
import { evaluateFormula } from './formula-evaluator.service';
import type { ASTNode } from './formula-evaluator.service';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomMetricDefinition {
  id: string;
  scope: 'user' | 'deal';
  owner_id: string;
  name: string;
  metric_key: string;
  metric_type: 'derived' | 'input';
  formula_ast: ASTNode | null;
  rollup: 'sum' | 'avg' | 'end_of_period' | 'rederive';
  format: 'pct' | 'currency' | 'ratio' | 'per_unit';
  unit_basis_field?: string | null;
}

export interface CustomMetricSeries {
  metricKey: string;
  name: string;
  metricType: 'derived' | 'input';
  periods: PeriodLayeredValue[];
  fallbackResolved: number | null;
  fallbackResolution: string;
  fallbackSource: string | null;
}

// ─── Load definitions ────────────────────────────────────────────────────────

/**
 * Load custom metric definitions for a deal.
 * Returns user-level (default) + deal-level (ad-hoc) metrics.
 * Deal-level overrides user-level with the same metric_key.
 */
export async function loadCustomMetricDefinitions(
  pool: Pool,
  dealId: string,
  userId: string,
): Promise<CustomMetricDefinition[]> {
  const result = await pool.query(
    `SELECT id, scope, owner_id, name, metric_key, metric_type, formula_ast,
            rollup, format, unit_basis_field
       FROM custom_metrics
      WHERE (scope = 'user' AND owner_id = $1)
         OR (scope = 'deal' AND owner_id = $2)
      ORDER BY created_at ASC`,
    [userId, dealId]
  );

  const defs: CustomMetricDefinition[] = result.rows.map(r => ({
    id: r.id,
    scope: r.scope,
    owner_id: r.owner_id,
    name: r.name,
    metric_key: r.metric_key,
    metric_type: r.metric_type,
    formula_ast: r.formula_ast,
    rollup: r.rollup,
    format: r.format,
    unit_basis_field: r.unit_basis_field,
  }));

  // Deal-level overrides user-level with same metric_key
  const byKey = new Map<string, CustomMetricDefinition>();
  for (const d of defs) {
    if (d.scope === 'user') {
      byKey.set(d.metric_key, d);
    } else {
      byKey.set(d.metric_key, d); // deal-level wins
    }
  }

  return [...byKey.values()];
}

// ─── Evaluate derived metrics ─────────────────────────────────────────────────

/**
 * Evaluate a derived custom metric at a single period.
 *
 * Zone inheritance: the metric's zone = the least-real of its inputs.
 * All inputs actual → metric actual. Any input projection → metric projection.
 */
export function evaluateDerivedMetric(
  definition: CustomMetricDefinition,
  periodicSeed: ProFormaPeriodicSeed,
  otherMetrics: Record<string, CustomMetricSeries>,
  month: string,
): { resolved: number | null; resolution: string; source: string | null; zone: 'actual' | 'gap' | 'projection' | 'override' } {
  if (!definition.formula_ast) {
    return { resolved: null, resolution: 'unresolved', source: null, zone: 'projection' };
  }

  // Build context: resolve all referenced fields at this period
  const context: Record<string, number | null> = {};
  let leastRealZone: 'actual' | 'gap' | 'projection' | 'override' = 'actual';

  // Collect fields referenced in the formula
  const fields = collectFields(definition.formula_ast);

  for (const field of fields) {
    // Try system field first
    const systemSeries = periodicSeed.fields[field];
    if (systemSeries) {
      const period = systemSeries.periods.find(p => p.month === month);
      context[field] = period?.resolved ?? null;
      if (period) {
        leastRealZone = zonePrecedence(leastRealZone, period.zone);
      }
      continue;
    }

    // Try other custom metric
    const otherSeries = otherMetrics[field];
    if (otherSeries) {
      const period = otherSeries.periods.find(p => p.month === month);
      context[field] = period?.resolved ?? null;
      if (period) {
        leastRealZone = zonePrecedence(leastRealZone, period.zone);
      }
      continue;
    }

    // Field not found → null
    context[field] = null;
    leastRealZone = 'projection'; // missing input = projection (least real)
  }

  const resolved = evaluateFormula(definition.formula_ast, context);

  return {
    resolved,
    resolution: resolved != null ? 'derived' : 'unresolved',
    source: `custom_metric:${definition.metric_key}`,
    zone: leastRealZone,
  };
}

// ─── Build full custom metric series ─────────────────────────────────────────

/**
 * Build the full periodic series for all custom metrics on a deal.
 *
 * @param definitions   Custom metric definitions
 * @param periodicSeed   The deal's periodic seed (system fields)
 * @param inputValues    Input-type metric values from custom_metric_values
 * @returns              Record of metric_key → CustomMetricSeries
 */
export function buildCustomMetricSeries(
  definitions: CustomMetricDefinition[],
  periodicSeed: ProFormaPeriodicSeed,
  inputValues: Record<string, Array<{ period_month: string; value: number | null; zone: string }>>,
): Record<string, CustomMetricSeries> {
  const result: Record<string, CustomMetricSeries> = {};

  // Sort definitions by dependency order (metrics that reference other metrics come after)
  const sorted = topologicalSort(definitions);

  for (const def of sorted) {
    if (def.metric_type === 'input') {
      // Input-type: read from custom_metric_values
      const values = inputValues[def.metric_key] ?? [];
      const periods: PeriodLayeredValue[] = values.map((v, i) => ({
        periodIndex: i,
        month: v.period_month.slice(0, 7), // YYYY-MM from YYYY-MM-01
        resolved: v.value,
        resolution: 'input',
        source: `custom_metric:${def.metric_key}`,
        zone: v.zone as 'actual' | 'gap' | 'projection' | 'override',
        updated_at: new Date().toISOString(),
      }));

      const nonNull = periods.map(p => p.resolved).filter((v): v is number => v != null);
      result[def.metric_key] = {
        metricKey: def.metric_key,
        name: def.name,
        metricType: 'input',
        periods,
        fallbackResolved: nonNull.length > 0 ? nonNull[nonNull.length - 1] : null,
        fallbackResolution: 'input',
        fallbackSource: `custom_metric:${def.metric_key}`,
      };
    } else {
      // Derived: evaluate formula at each period
      const allPeriods = periodicSeed.fields.gpr?.periods ?? [];
      const periods: PeriodLayeredValue[] = [];

      for (let i = 0; i < allPeriods.length; i++) {
        const month = allPeriods[i].month;
        const evalResult = evaluateDerivedMetric(def, periodicSeed, result, month);

        periods.push({
          periodIndex: i,
          month,
          resolved: evalResult.resolved,
          resolution: evalResult.resolution,
          source: evalResult.source,
          zone: evalResult.zone,
          updated_at: new Date().toISOString(),
        });
      }

      const nonNull = periods.map(p => p.resolved).filter((v): v is number => v != null);
      result[def.metric_key] = {
        metricKey: def.metric_key,
        name: def.name,
        metricType: 'derived',
        periods,
        fallbackResolved: nonNull.length > 0 ? nonNull[nonNull.length - 1] : null,
        fallbackResolution: 'derived',
        fallbackSource: `custom_metric:${def.metric_key}`,
      };
    }
  }

  return result;
}

// ─── Reconciliation hook ────────────────────────────────────────────────────

/**
 * When a boundary advances and inputs reconcile, log custom metric variance.
 *
 * Called from the reconciliation path after a month flips from projection → actual.
 * Computes the custom metric at the newly actualized month and logs to
 * deal_reconciliation_log with field_name = metric_key.
 */
export function reconcileCustomMetric(
  definition: CustomMetricDefinition,
  periodicSeed: ProFormaPeriodicSeed,
  customMetrics: Record<string, CustomMetricSeries>,
  month: string,
  projectedValue: number | null,  // the old projected value
  actualValue: number | null,     // the new actual value
): { varianceAbs: number | null; variancePct: number | null; shouldLog: boolean } {
  // Only derived metrics that reference reconciling fields can reconcile
  if (definition.metric_type !== 'derived' || !definition.formula_ast) {
    return { varianceAbs: null, variancePct: null, shouldLog: false };
  }

  // Check if any of the metric's inputs are system fields that reconcile
  const fields = collectFields(definition.formula_ast);
  const hasSystemField = fields.some(f => periodicSeed.fields[f] != null);
  if (!hasSystemField) {
    return { varianceAbs: null, variancePct: null, shouldLog: false };
  }

  if (projectedValue == null || actualValue == null) {
    return { varianceAbs: null, variancePct: null, shouldLog: false };
  }

  const varianceAbs = actualValue - projectedValue;
  const variancePct = projectedValue !== 0 ? varianceAbs / projectedValue : null;

  return { varianceAbs, variancePct, shouldLog: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectFields(node: ASTNode): string[] {
  const fields: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'field':
        fields.push(n.name);
        break;
      case 'function':
        n.args.forEach(walk);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'unary':
        walk(n.operand);
        break;
    }
  }
  walk(node);
  return [...new Set(fields)];
}

function zonePrecedence(current: 'actual' | 'gap' | 'projection' | 'override', incoming: 'actual' | 'gap' | 'projection' | 'override'): 'actual' | 'gap' | 'projection' | 'override' {
  // Least-real wins: projection < gap < actual < override
  const order = { projection: 0, gap: 1, actual: 2, override: 3 };
  return order[current] < order[incoming] ? current : incoming;
}

function topologicalSort(definitions: CustomMetricDefinition[]): CustomMetricDefinition[] {
  // Build dependency graph
  const graph: Record<string, string[]> = {};
  const nodeMap = new Map<string, CustomMetricDefinition>();

  for (const d of definitions) {
    nodeMap.set(d.metric_key, d);
    if (d.formula_ast) {
      const refs = collectFields(d.formula_ast).filter(f => nodeMap.has(f) || definitions.some(def => def.metric_key === f));
      graph[d.metric_key] = refs;
    } else {
      graph[d.metric_key] = [];
    }
  }

  // Kahn's algorithm
  // inDegree[key] = number of unprocessed dependencies that key is waiting on.
  // Increment the DEPENDENT (key), not the dependency (dep).
  const inDegree: Record<string, number> = {};
  for (const key of Object.keys(graph)) {
    inDegree[key] = 0;
  }
  for (const [key, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (dep in inDegree) {
        inDegree[key]++;
      }
    }
  }

  const queue: string[] = [];
  for (const [key, deg] of Object.entries(inDegree)) {
    if (deg === 0) queue.push(key);
  }

  const sorted: CustomMetricDefinition[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    const def = nodeMap.get(key);
    if (def) sorted.push(def);

    for (const [k, deps] of Object.entries(graph)) {
      if (deps.includes(key)) {
        inDegree[k]--;
        if (inDegree[k] === 0) queue.push(k);
      }
    }
  }

  // Append any remaining (cycle — should not happen after validation)
  for (const def of definitions) {
    if (!sorted.includes(def)) sorted.push(def);
  }

  return sorted;
}
