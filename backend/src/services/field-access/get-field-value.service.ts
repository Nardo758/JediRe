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
 *   3. Agent layer         (year1[field].agent — agent-written intermediate)
 *   4. Stored resolved     (year1[field].resolved — seeder's best value, already
 *                           incorporates the seeder's own t12 > om > broker pass)
 *
 * ─── Computed aggregate fields ───────────────────────────────────────────────
 * The following fields are computed by Engine A from leaf values, NOT stored back
 * to deal_assumptions.year1[field].resolved. Reading .resolved directly returns
 * the seeder-sourced (potentially stale) value and will NOT match Pro Forma.
 *
 * getFieldValue re-runs Engine A's formula against the current seed:
 *
 *   noi              = egi − total_opex
 *   noi_after_res    = (egi − total_opex) − replacement_reserves
 *
 * Engine A (getDealFinancials) rounds NOI to whole dollars (Math.round) to
 * avoid floating-point noise in JSONB storage. getFieldValue preserves that
 * rounding so Valuation Grid and Pro Forma stay byte-for-byte identical when
 * the formula path runs.
 *
 * ─── Field name safety ───────────────────────────────────────────────────────
 * Field names are interpolated into SQL as JSONB key paths. To prevent injection
 * via unexpected field names reaching this service, every name is validated
 * against ALLOWED_FIELDS before use. Callers passing unknown names get null back
 * (graceful degradation), never a DB error.
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
   * Follows the resolution chain documented at the top of this file.
   */
  resolved: number | null;
  /** Layer 1: operator override (highest priority). */
  override: number | null;
  /** Layer 2 (Engine A): computed aggregate value (noi, noi_after_reserves). */
  computedValue: number | null;
  /** Layer 3: agent-written value. */
  agent: number | null;
  /** Individual source layers (for transparency / audit). */
  t12: number | null;
  om: number | null;
  broker: number | null;
  /** Seeder's stored resolved (may be stale for computed aggregates). */
  storedResolved: number | null;
  /** How the resolved value was determined (e.g. 'override', 'computed', 'agent', 'seeded'). */
  resolution: string | null;
  /** Source label (e.g. 'operator_override', 'computed', 'agent', 'om'). */
  source: string | null;
  /**
   * For computed aggregates: describes the formula.
   * E.g. 'egi - total_opex' for noi.
   */
  computedAs?: string;
}

// ── Field name whitelist ──────────────────────────────────────────────────────
//
// All year1 LayeredValue keys that may be requested via getFieldValue.
// Any field NOT in this set returns null without hitting the DB.
// Add new fields here when new LayeredValue keys are introduced to year1.

const ALLOWED_FIELDS = new Set([
  // Revenue leaf fields
  'gpr', 'vacancy', 'concessions', 'bad_debt', 'non_revenue_units',
  'loss_to_lease', 'other_income',
  // Revenue aggregates
  'net_rental_income', 'egi',
  // Operating expense leaf fields
  'real_estate_tax', 'insurance', 'management_fee', 'repairs_maintenance',
  'utilities', 'payroll', 'administrative', 'marketing', 'contract_services',
  // Operating expense aggregates
  'total_opex',
  // NOI & derived
  'noi', 'noi_after_reserves', 'replacement_reserves',
  // Capital & deal fields
  'purchase_price', 'equity_at_close', 'loan_amount', 'interest_rate',
  'ltc_pct', 'exit_cap', 'rent_growth_yr1', 'hold_period_years',
  // Dependency alt keys
  'year1_noi',
]);

// ── Legacy field aliases ──────────────────────────────────────────────────────
//
// Some older deals stored a field under a different key in year1.
// When the primary key resolves to null, we try these fallbacks in order.
// Alias keys must also be in ALLOWED_FIELDS so they can be safely interpolated.

const FIELD_LEGACY_ALIASES: Record<string, string[]> = {
  noi: ['year1_noi'],
};

// ── Aggregate field definitions ───────────────────────────────────────────────
//
// Fields whose canonical value is Engine A's formula result.
// deps: all year1 keys needed by the formula.
// compute: receives a map of dep field → resolved numeric value (already de-NaN'd).
// Engine A rounds NOI to whole dollars (avoids JSONB float noise). We preserve
// that rounding here for byte-for-byte parity with Pro Forma output.

type AggDef = {
  formula: string;
  deps: string[];
  compute: (vals: Record<string, number>) => number;
};

const COMPUTED_AGGREGATES: Record<string, AggDef> = {
  noi: {
    formula: 'egi - total_opex',
    deps: ['egi', 'total_opex'],
    compute: ({ egi, total_opex }) => Math.round(egi - total_opex),
  },
  noi_after_reserves: {
    // Dependencies expanded to avoid reading stale noi.resolved:
    // canonical noi = egi - total_opex, then subtract reserves.
    formula: '(egi - total_opex) - replacement_reserves',
    deps: ['egi', 'total_opex', 'replacement_reserves'],
    compute: ({ egi, total_opex, replacement_reserves }) =>
      Math.round((egi - total_opex) - replacement_reserves),
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractNum(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

/**
 * Parse a raw JSONB blob returned by pg into a LayeredValue record, safely.
 * Handles three cases:
 *   - Object  : standard LayeredValue blob  { resolved, override, agent, t12, … }
 *   - Scalar  : legacy deals where field was stored as raw number (not a LayeredValue object).
 *               Treated as a degenerate LV with only storedResolved populated.
 *   - null/undefined : returns null (field is absent from year1)
 */
function parseLv(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  // Scalar numeric JSONB — legacy shape
  const n = extractNum(raw);
  if (n != null) return { resolved: n };
  return null;
}

/**
 * Apply the layered resolution chain to a single parsed LayeredValue blob
 * plus any pre-computed Engine A value.
 *
 * Resolution priority:
 *   override > computed (Engine A) > agent > storedResolved
 */
function resolveLayeredValue(
  lv: Record<string, unknown>,
  computedValue: number | null,
  computedFormula: string | undefined,
): Pick<LayeredFieldValue, 'resolved' | 'resolution' | 'source'> {
  const override      = extractNum(lv.override);
  const agent         = extractNum(lv.agent);
  const storedResolved = extractNum(lv.resolved);
  const storedSource  = typeof lv.source === 'string' ? lv.source : null;
  const storedRes     = typeof lv.resolution === 'string' ? lv.resolution : null;

  // Start with the seeder's stored best value
  let resolved: number | null = storedResolved;
  let resolution: string | null = storedRes;
  let source: string | null = storedSource;

  // Agent layer overrides seeder's stored value
  if (agent != null) {
    resolved   = agent;
    resolution = 'agent';
    source     = 'agent';
  }

  // Engine A computed overrides agent (unless operator override present)
  if (computedValue != null && override == null) {
    resolved   = computedValue;
    resolution = 'computed';
    source     = 'computed';
  }

  // Operator override is always final winner
  if (override != null) {
    resolved   = override;
    resolution = 'override';
    source     = 'operator_override';
  }

  return { resolved, resolution, source };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * getFieldValue — canonical single-access-point for any LayeredValue field
 * stored in deal_assumptions.year1.
 *
 * @param pool       Active pg Pool
 * @param dealId     Deal UUID
 * @param fieldName  Key in deal_assumptions.year1 JSONB.
 *                   Must be in ALLOWED_FIELDS — unknown names return null.
 * @param year       Year index — currently only year=1 is supported.
 * @param options
 *   raw: true — skip Engine A formula. Returns seeder's stored resolved value.
 *               Use only for debugging or seeder regression comparisons.
 */
export async function getFieldValue(
  pool: Pool,
  dealId: string,
  fieldName: string,
  year: number = 1,
  options?: { raw?: boolean },
): Promise<LayeredFieldValue | null> {
  if (!ALLOWED_FIELDS.has(fieldName)) return null;
  // Year-N fields are not yet supported — deal_assumptions stores only year1.
  // Return null rather than silently returning year1 data for a different year.
  if (year !== 1) return null;

  const aggDef: AggDef | undefined = !options?.raw ? COMPUTED_AGGREGATES[fieldName] : undefined;
  const aliases: string[] = FIELD_LEGACY_ALIASES[fieldName] ?? [];

  // Collect all field keys to fetch: primary + aggregate deps + legacy alias keys
  const allKeys = new Set<string>([fieldName]);
  if (aggDef) aggDef.deps.forEach(d => allKeys.add(d));
  aliases.forEach(a => allKeys.add(a));

  const colExpressions = [...allKeys]
    .map(k => `da.year1->'${k}' AS lv_${k.replace(/-/g, '_')}`)
    .join(',\n      ');

  const sql = `
    SELECT ${colExpressions}
    FROM deal_assumptions da
    WHERE da.deal_id = $1::uuid
    LIMIT 1
  `;

  const res = await pool.query(sql, [dealId]);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];

  // Primary field may be absent entirely — try legacy aliases as last resort
  const primaryKey = `lv_${fieldName.replace(/-/g, '_')}`;
  let lv = parseLv(row[primaryKey]);
  let usingAlias = false;
  if (!lv) {
    for (const alias of aliases) {
      const aliasLv = parseLv(row[`lv_${alias.replace(/-/g, '_')}`]);
      if (aliasLv) { lv = aliasLv; usingAlias = true; break; }
    }
  }
  if (!lv) return null;

  const override       = extractNum(lv.override);
  const agent          = extractNum(lv.agent);
  const t12            = extractNum(lv.t12);
  const om             = extractNum(lv.om);
  const broker         = extractNum(lv.broker);
  const storedResolved = extractNum(lv.resolved);

  // Compute Engine A formula if applicable.
  // Dependency resolution: each dep is resolved through its own layered chain
  // (override > agent > storedResolved) so operator overrides on egi/total_opex
  // propagate correctly into the NOI computation.
  // Skip formula if using a legacy alias — aliases store scalar resolved only.
  let computedValue: number | null = null;
  let computedAs: string | undefined;
  if (aggDef && !usingAlias && override == null) {
    const depVals: Record<string, number> = {};
    let allDepsPresent = true;
    for (const dep of aggDef.deps) {
      const depLv = parseLv(row[`lv_${dep.replace(/-/g, '_')}`]);
      if (!depLv) { allDepsPresent = false; break; }
      // Resolve dep through its own layered chain — NOT just raw .resolved.
      // depLv deps (egi, total_opex, etc.) are not computed aggregates themselves,
      // so we pass computedValue=null (no formula to apply).
      const { resolved: depCanonical } = resolveLayeredValue(depLv, null, undefined);
      if (depCanonical == null) { allDepsPresent = false; break; }
      depVals[dep] = depCanonical;
    }
    if (allDepsPresent) {
      computedValue = aggDef.compute(depVals);
      computedAs    = aggDef.formula;
    }
  }

  const { resolved, resolution, source } = resolveLayeredValue(lv, computedValue, computedAs);

  return {
    fieldName,
    year,
    resolved,
    override,
    computedValue,
    agent,
    t12,
    om,
    broker,
    storedResolved,
    resolution,
    source,
    computedAs,
  };
}

/**
 * getFieldValues — batch variant; resolves multiple fields in a single query.
 *
 * Returns a map of fieldName → LayeredFieldValue | null.
 * Fields not in ALLOWED_FIELDS are silently mapped to null.
 * Useful when a surface needs several fields from the same deal row.
 */
export async function getFieldValues(
  pool: Pool,
  dealId: string,
  fieldNames: string[],
  year: number = 1,
  options?: { raw?: boolean },
): Promise<Record<string, LayeredFieldValue | null>> {
  // Year-N not yet supported — caller must pass year=1.
  if (year !== 1) return Object.fromEntries(fieldNames.map(f => [f, null]));

  // Filter to allowed fields only
  const safeNames = fieldNames.filter(f => ALLOWED_FIELDS.has(f));
  const unsafeNames = fieldNames.filter(f => !ALLOWED_FIELDS.has(f));

  // Initialise nulls for unknown / unsafe fields
  const result: Record<string, LayeredFieldValue | null> = {};
  for (const f of unsafeNames) result[f] = null;

  if (safeNames.length === 0) return result;

  // Collect all dep fields + legacy alias keys we'll need alongside the requested fields
  const allKeys = new Set<string>(safeNames);
  if (!options?.raw) {
    for (const f of safeNames) {
      COMPUTED_AGGREGATES[f]?.deps.forEach(d => allKeys.add(d));
      (FIELD_LEGACY_ALIASES[f] ?? []).forEach(a => allKeys.add(a));
    }
  }

  const colExpressions = [...allKeys]
    .map(k => `da.year1->'${k}' AS lv_${k.replace(/-/g, '_')}`)
    .join(',\n      ');

  const sql = `
    SELECT ${colExpressions}
    FROM deal_assumptions da
    WHERE da.deal_id = $1::uuid
    LIMIT 1
  `;

  const res = await pool.query(sql, [dealId]);
  if (res.rows.length === 0) {
    for (const f of safeNames) result[f] = null;
    return result;
  }

  const row = res.rows[0];

  const getLv = (f: string): Record<string, unknown> | null =>
    parseLv(row[`lv_${f.replace(/-/g, '_')}`]);

  for (const fieldName of safeNames) {
    // Primary key — fall back to legacy aliases if absent
    let lv = getLv(fieldName);
    let usingAlias = false;
    if (!lv) {
      for (const alias of (FIELD_LEGACY_ALIASES[fieldName] ?? [])) {
        const aliasLv = getLv(alias);
        if (aliasLv) { lv = aliasLv; usingAlias = true; break; }
      }
    }
    if (!lv) { result[fieldName] = null; continue; }

    const override      = extractNum(lv.override);
    const agent         = extractNum(lv.agent);
    const t12           = extractNum(lv.t12);
    const om            = extractNum(lv.om);
    const broker        = extractNum(lv.broker);
    const storedResolved = extractNum(lv.resolved);

    let computedValue: number | null = null;
    let computedAs: string | undefined;
    const aggDef: AggDef | undefined = !options?.raw ? COMPUTED_AGGREGATES[fieldName] : undefined;

    if (aggDef && !usingAlias && override == null) {
      const depVals: Record<string, number> = {};
      let allDepsPresent = true;
      for (const dep of aggDef.deps) {
        const depLv = getLv(dep);
        if (!depLv) { allDepsPresent = false; break; }
        // Resolve dep through its own layered chain (not just raw .resolved)
        // so operator overrides on egi/total_opex propagate into the formula.
        const { resolved: depCanonical } = resolveLayeredValue(depLv, null, undefined);
        if (depCanonical == null) { allDepsPresent = false; break; }
        depVals[dep] = depCanonical;
      }
      if (allDepsPresent) {
        computedValue = aggDef.compute(depVals);
        computedAs    = aggDef.formula;
      }
    }

    const { resolved, resolution, source } = resolveLayeredValue(lv, computedValue, computedAs);

    result[fieldName] = {
      fieldName, year, resolved, override, computedValue, agent,
      t12, om, broker, storedResolved, resolution, source, computedAs,
    };
  }

  return result;
}
