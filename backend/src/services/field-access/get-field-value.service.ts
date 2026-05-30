/**
 * get-field-value.service.ts
 *
 * Cross-surface Read Consistency — canonical field accessor.
 *
 * Every surface (Pro Forma, Valuation Grid, Returns, Validation Grid, Decision,
 * any future F-key) that needs to display a field value MUST resolve it through
 * this service rather than reading deal_assumptions.year1[field].resolved
 * directly from SQL JSONB.
 *
 * See: docs/architecture/cross-surface-read-consistency.md
 *
 * ─── Resolution chain (in priority order) ────────────────────────────────────
 *   1. Operator override   (year1[field].override  — user-pinned value)
 *   2. Engine A computed   (for aggregate fields: EGI−total_opex etc.)
 *   3. Agent layer         (year1[field].agent)
 *   4. Source layers       (year1[field].t12 / .om / .broker)
 *   5. Stored resolved     (year1[field].resolved  — seeded value, may be stale)
 *
 * ─── Computed aggregate fields ───────────────────────────────────────────────
 * The following fields are computed by Engine A (getDealFinancials) from leaf
 * values, NOT stored back to deal_assumptions.year1[field].resolved. Reading
 * the stored .resolved directly will return the seeder-sourced (potentially
 * stale) value and will NOT match what the Pro Forma displays.
 *
 * Instead, getFieldValue re-runs Engine A's formula against the current seed so
 * every surface sees the same number:
 *
 *   noi              = egi − total_opex
 *   noi_after_res    = noi − replacement_reserves
 *   egi              = net_rental_income + other_income          (sum)
 *   total_opex       = sum of 7 controllable opex leaf fields    (sum, no formula here yet — falls back to stored)
 *   net_rental_income = gpr − vacancy − concessions − bad_debt  (sum, no formula here yet — falls back to stored)
 *
 * "No formula here yet" means we defer to stored .resolved for those until
 * Engine A write-back is implemented (Piece B3).
 */

import { Pool } from 'pg';

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * All layers of a LayeredValue<number> as read from deal_assumptions.year1.
 * Mirrors the LayeredValue<T> contract defined in the LayeredValue ADR.
 */
export interface LayeredFieldValue {
  /** Field key as it appears in deal_assumptions.year1 JSONB. */
  fieldName: string;
  /** Year index (1 = year 1). Year-N fields not yet supported. */
  year: number;
  /**
   * The canonical value every surface MUST display.
   * Follows the resolution chain documented above.
   */
  resolved: number | null;
  /** Layer 1: operator override (highest priority). */
  override: number | null;
  /** Layer 2: agent-computed value. */
  agent: number | null;
  /** Layer 3: trailing-12-month actuals. */
  t12: number | null;
  /** Layer 3: offering memorandum. */
  om: number | null;
  /** Layer 3: broker projection. */
  broker: number | null;
  /** How the resolved value was determined (e.g. 'override', 'computed', 'om'). */
  resolution: string | null;
  /** Source label (e.g. 'operator_override', 'computed', 'om'). */
  source: string | null;
  /**
   * When the resolved value is an Engine A aggregate, this describes the formula.
   * E.g. 'egi - total_opex' for noi.
   */
  computedAs?: string;
}

// ── Aggregate field definitions ───────────────────────────────────────────────

/**
 * Fields whose canonical value is Engine A's formula result, NOT the stored
 * .resolved. For each field we declare which seed keys are summed/subtracted.
 */
const COMPUTED_AGGREGATES: Record<string, { formula: string; deps: string[] }> = {
  noi: {
    formula: 'egi - total_opex',
    deps: ['egi', 'total_opex'],
  },
  noi_after_reserves: {
    formula: 'noi - replacement_reserves',
    deps: ['noi', 'replacement_reserves'],
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractNum(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function lvResolved(lv: Record<string, unknown> | null): number | null {
  if (!lv) return null;
  return extractNum(lv.resolved);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * getFieldValue — canonical single-access-point for any LayeredValue field
 * stored in deal_assumptions.year1.
 *
 * @param pool       Active pg Pool
 * @param dealId     Deal UUID
 * @param fieldName  Key in deal_assumptions.year1 JSONB (e.g. 'noi', 'egi',
 *                   'replacement_reserves', 'exit_cap')
 * @param year       Year index — currently only year=1 is supported.
 * @param options
 *   raw: true — skip Engine A formula; return the stored resolved value directly.
 *               Use only for debugging or seeder comparisons.
 */
export async function getFieldValue(
  pool: Pool,
  dealId: string,
  fieldName: string,
  year: number = 1,
  options?: { raw?: boolean },
): Promise<LayeredFieldValue | null> {
  // Determine which dependency fields we need alongside the primary field
  const aggDef = !options?.raw ? COMPUTED_AGGREGATES[fieldName] : undefined;
  const depCols = aggDef
    ? aggDef.deps
        .map(dep => `, da.year1->'${dep}' AS dep_${dep.replace(/-/g, '_')}`)
        .join('')
    : '';

  const sql = `
    SELECT
      da.year1->'${fieldName}' AS field_lv
      ${depCols}
    FROM deal_assumptions da
    WHERE da.deal_id = $1::uuid
    LIMIT 1
  `;

  const res = await pool.query(sql, [dealId]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  if (row.field_lv == null) return null;

  // Parse the primary LayeredValue JSONB blob
  const lv: Record<string, unknown> =
    typeof row.field_lv === 'object' ? (row.field_lv as Record<string, unknown>) : {};

  const override = extractNum(lv.override);
  const agent    = extractNum(lv.agent);
  const t12      = extractNum(lv.t12);
  const om       = extractNum(lv.om);
  const broker   = extractNum(lv.broker);
  const storedResolved = extractNum(lv.resolved);

  let resolved: number | null = storedResolved;
  let computedAs: string | undefined;
  let resolution = typeof lv.resolution === 'string' ? lv.resolution : null;
  let source     = typeof lv.source     === 'string' ? lv.source     : null;

  // ── Engine A formula (overrides stored .resolved when no operator override) ─
  if (aggDef && override == null) {
    const depValues = aggDef.deps.map(dep => {
      const key = `dep_${dep.replace(/-/g, '_')}`;
      const depLv: Record<string, unknown> | null =
        typeof row[key] === 'object' ? (row[key] as Record<string, unknown>) : null;
      return lvResolved(depLv);
    });

    // Only apply formula when all dependencies are non-null
    if (depValues.every(v => v != null)) {
      const [a, b] = depValues as [number, number];
      resolved   = Math.round(a - b);
      computedAs = aggDef.formula;
      resolution = 'computed';
      source     = 'computed';
    }
  }

  // ── Operator override always wins (highest priority) ──────────────────────
  if (override != null) {
    resolved   = override;
    resolution = 'override';
    source     = 'operator_override';
  }

  return {
    fieldName,
    year,
    resolved,
    override,
    agent,
    t12,
    om,
    broker,
    resolution,
    source,
    computedAs,
  };
}

/**
 * getFieldValues — batch variant; resolves multiple fields in a single query.
 *
 * Returns a map of fieldName → LayeredFieldValue | null.
 * Useful when a surface needs several fields from the same deal row.
 */
export async function getFieldValues(
  pool: Pool,
  dealId: string,
  fieldNames: string[],
  year: number = 1,
  options?: { raw?: boolean },
): Promise<Record<string, LayeredFieldValue | null>> {
  // Collect all dep fields we'll need
  const allFields = new Set(fieldNames);
  if (!options?.raw) {
    for (const f of fieldNames) {
      const agg = COMPUTED_AGGREGATES[f];
      if (agg) agg.deps.forEach(d => allFields.add(d));
    }
  }

  const cols = [...allFields]
    .map(f => `da.year1->'${f}' AS lv_${f.replace(/-/g, '_')}`)
    .join(',\n      ');

  const sql = `
    SELECT
      ${cols}
    FROM deal_assumptions da
    WHERE da.deal_id = $1::uuid
    LIMIT 1
  `;

  const res = await pool.query(sql, [dealId]);
  if (res.rows.length === 0) {
    return Object.fromEntries(fieldNames.map(f => [f, null]));
  }

  const row = res.rows[0];

  const getLv = (f: string): Record<string, unknown> | null => {
    const key = `lv_${f.replace(/-/g, '_')}`;
    return typeof row[key] === 'object' ? (row[key] as Record<string, unknown>) : null;
  };

  const result: Record<string, LayeredFieldValue | null> = {};

  for (const fieldName of fieldNames) {
    const lv = getLv(fieldName);
    if (!lv) { result[fieldName] = null; continue; }

    const override = extractNum(lv.override);
    const agent    = extractNum(lv.agent);
    const t12      = extractNum(lv.t12);
    const om       = extractNum(lv.om);
    const broker   = extractNum(lv.broker);
    const storedResolved = extractNum(lv.resolved);

    let resolved: number | null = storedResolved;
    let computedAs: string | undefined;
    let resolution = typeof lv.resolution === 'string' ? lv.resolution : null;
    let source     = typeof lv.source     === 'string' ? lv.source     : null;

    const aggDef = !options?.raw ? COMPUTED_AGGREGATES[fieldName] : undefined;
    if (aggDef && override == null) {
      const depValues = aggDef.deps.map(dep => lvResolved(getLv(dep)));
      if (depValues.every(v => v != null)) {
        const [a, b] = depValues as [number, number];
        resolved   = Math.round(a - b);
        computedAs = aggDef.formula;
        resolution = 'computed';
        source     = 'computed';
      }
    }

    if (override != null) {
      resolved   = override;
      resolution = 'override';
      source     = 'operator_override';
    }

    result[fieldName] = { fieldName, year, resolved, override, agent, t12, om, broker, resolution, source, computedAs };
  }

  return result;
}
