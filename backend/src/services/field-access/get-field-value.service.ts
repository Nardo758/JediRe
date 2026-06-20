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
 * ─── Convention for new consumers ────────────────────────────────────────────
 * New backend code that needs a year1 field value MUST call getFieldValue (or
 * getFieldValues for batches) rather than reading year1[field].resolved inline
 * in SQL. If you cannot use getFieldValue for a specific reason, you MUST add
 * an inline comment explaining why (e.g. "seed-phase write-path, not display").
 * This convention was established in Task #1620.
 *
 * ─── Migrated surfaces ───────────────────────────────────────────────────────
 * The following surfaces have been migrated to the canonical getFieldValue path:
 *   • Valuation Grid (CF-01: NOI)                         — Task #1541
 *   • Validation Grid (CF-02–CF-06: exitCap, holdYears,   — Task #1541
 *     rentGrowthYr1, purchasePrice, loanAmount / rate)
 *   • Valuation Grid (CF-07: EGI, CF-08: GPR,             — Task #1563
 *     CF-09: total_opex, CF-10: exitCap, CF-11: holdPeriodYears)
 *   • Policy mutations (CF-12: real_estate_tax,            — Task #1620
 *     CF-13: bad_debt_pct in proforma-adjustment.service)
 *   • Overview Tab (CF-14: NOI display — .find() pattern  — Task #1620
 *     replaced by modelResults.summary.noi direct access)
 *   • Decision Tab (CF-15: concessions drill — .find()    — Task #1620
 *     replaced by f9Financials.year1Concessions property on ComposedFinancials)
 *   • ProFormaSummaryTab (CF-16: concessions drill —      — Task #1620
 *     .find() replaced by data.year1Concessions property)
 *
 * Surfaces still using non-canonical reads (require future migration):
 *   • Pro Forma (financials-composer.service.ts) — reads year1 blob via
 *     seedProFormaYear1; this IS Engine A's own seeder path, not a display bypass,
 *     but computed aggregates (noi, egi) should eventually be back-propagated.
 *   • ReturnsTab proforma.year1 row iteration — acceptable for tabular
 *     projection columns; no point-in-time .find() reads remain after Task #1620.
 *   • AssumptionsTab proforma.year1 iteration — in-tab display scaffolding,
 *     not a cross-surface read; documented exception (line 208, 1948, 1956, 2881).
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
import {
  getFieldThreshold,
  deriveDivergenceAlertLevel,
  type DivergenceAlertLevel,
} from './divergence-thresholds';
import { recordDivergenceObservation } from './divergence-ledger.stub';

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * One non-null source layer that contributed to divergence analysis.
 * Surfaced in the Validation Grid under the "CONTESTED" badge.
 */
export interface DivergencePoint {
  layer: 'override' | 'computedValue' | 'agent' | 't12' | 'om' | 'broker' | 'storedResolved';
  label: string;
  value: number;
  /**
   * Absolute delta between this source's value and the resolved (winning) value.
   * Zero for the winning source layer itself.
   */
  deltaAbsolute: number;
  /**
   * Relative delta as a signed fraction of the resolved value.
   * e.g. 0.138 means this source is 13.8% above the resolved value.
   * null when resolved value is 0 (division undefined).
   */
  deltaRelative: number | null;
  /**
   * Whether this source is above, below, or equal to the resolved value.
   */
  directionVsResolved: 'above' | 'below' | 'equal';
}

/**
 * Divergence signature computed at field resolution time.
 * Present when ≥2 source layers are non-null for the same field.
 *
 * alertLevel:
 *   'none'  — all sources agree within threshold
 *   'warn'  — material divergence (delta ≥ threshold, < threshold × 3)
 *   'block' — extreme divergence (delta ≥ threshold × 3)
 */
export interface DivergenceSignature {
  /** All non-null source layers used for comparison. */
  points: DivergencePoint[];
  /** Maximum absolute pairwise delta across all source pairs. */
  maxAbsDelta: number;
  /** Alert level derived from maxAbsDelta vs field threshold. */
  alertLevel: DivergenceAlertLevel;
  /** True when alertLevel is 'warn' or 'block'. */
  exceeds: boolean;
  /** Threshold applied (in same units as field). */
  threshold: number;
  /** Canonical field name. */
  fieldName: string;
  /** Display unit hint (e.g. 'bps', '$'). */
  unit: string;
  /** True when field is stored in 0–1 decimal scale (% fields). */
  isPct: boolean;
  /**
   * Human-readable explanation of why sources may diverge for this field.
   * Set for fields where methodology differences are well-understood
   * (e.g. LTL trailing-average vs. current snapshot).
   */
  interpretationHint?: string;
}

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
  /**
   * Divergence signature — present when ≥2 source layers are non-null.
   * Used by the Validation Grid to surface CONTESTED badges and by the
   * deal-completeness signal for T-C1 scoring.
   */
  divergenceSignature?: DivergenceSignature;
}

// ── Field name whitelist ──────────────────────────────────────────────────────
//
// All year1 LayeredValue keys that may be requested via getFieldValue.
// Any field NOT in this set returns null without hitting the DB.
// Add new fields here when new LayeredValue keys are introduced to year1.

const ALLOWED_FIELDS = new Set([
  // Revenue leaf fields
  'gpr', 'vacancy', 'concessions', 'bad_debt', 'bad_debt_pct', 'non_revenue_units',
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
  // ── Revenue aggregates ────────────────────────────────────────────────────
  //
  // egi: Effective Gross Income = Net Rental Income + Other Income.
  // Mirrors Engine A (getDealFinancials): `egi = nri + otherIncome` at
  // proforma-adjustment.service.ts. Re-running the formula here prevents the
  // Valuation Grid from reading a stale seeder-stored egi.resolved when the
  // operator has overridden net_rental_income or other_income since last seed.
  egi: {
    formula: 'net_rental_income + other_income',
    deps: ['net_rental_income', 'other_income'],
    compute: ({ net_rental_income, other_income }) =>
      Math.round(net_rental_income + other_income),
  },

  // ── NOI & derived ─────────────────────────────────────────────────────────
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

const LAYER_LABELS: Record<string, string> = {
  override:       'Operator Override',
  computedValue:  'Engine A Computed',
  agent:          'Agent Derived',
  t12:            'T-12 Document',
  om:             'OM Narrative',
  broker:         'Broker OM',
  storedResolved: 'Seeded (Best)',
};

// ── Per-field interpretation hints ───────────────────────────────────────────
//
// Human-readable explanations for why specific fields tend to diverge across
// source layers. Shown in the Validation Grid and Deal Capsule disagreements
// section to give operators context beyond the raw delta numbers.

const FIELD_INTERPRETATION_HINTS: Record<string, string> = {
  loss_to_lease:
    'T-12 average reflects trailing carrying rate; live lease-level reflects ' +
    'current mark-to-market snapshot. A large delta indicates potential rent ' +
    'upside not yet captured in trailing income — a mark-to-market opportunity.',
  vacancy:
    'T-12 vacancy reflects trailing 12-month average occupancy; live signals ' +
    'reflect current lease-up velocity. Delta may indicate improving or ' +
    'deteriorating market conditions not yet captured in the trailing average.',
  exit_cap:
    'Multiple sources price the exit cap differently. OM-stated cap rates are ' +
    'often optimistic vs. comp-implied. Review the comp set before accepting a ' +
    'broker-sourced cap rate — even small differences have material IRR impact.',
  rent_growth_yr1:
    'T-12 trailing rent growth reflects historical momentum; platform benchmarks ' +
    'reflect forward-looking submarket consensus. Divergence may indicate a ' +
    'turning market or a property-specific lease-up dynamic.',
  gpr:
    'T-12 GPR reflects trailing in-place collections; OM/broker GPR typically ' +
    'reflects stabilized or mark-to-market assumptions. Divergence signals ' +
    'a gap between current performance and projected stabilized income.',
  noi:
    'NOI divergence typically traces to GPR and/or expense layer disagreements. ' +
    'Drill into revenue and expense sub-fields to identify the root source.',
  real_estate_tax:
    'Tax bill-sourced values reflect actual assessed amounts; OM estimates may ' +
    'use simplified millage × assessed value calculations. Reassessment risk ' +
    'after sale is not captured in either figure.',
};

/**
 * Build a DivergenceSignature from the resolved layer snapshot.
 *
 * Collects all non-null source layers, computes the maximum pairwise absolute
 * delta, maps it to an alertLevel via the per-field threshold registry, and
 * annotates each point with its delta vs. the resolved (winning) value.
 *
 * @param resolvedValue  The canonical resolved value for this field (after
 *   applying the resolution chain). Used to compute per-point deltaAbsolute
 *   and deltaRelative so the UI can show "this source is X above/below what
 *   we're using." Pass null when the resolved value is not yet known.
 *
 * Returns undefined when < 2 layers are non-null (nothing to compare).
 */
function buildDivergenceSignature(
  fieldName: string,
  layers: {
    override: number | null;
    computedValue: number | null;
    agent: number | null;
    t12: number | null;
    om: number | null;
    broker: number | null;
    storedResolved: number | null;
  },
  resolvedValue: number | null,
): DivergenceSignature | undefined {
  const candidates: Omit<DivergencePoint, 'deltaAbsolute' | 'deltaRelative' | 'directionVsResolved'>[] = [];

  const push = (layer: DivergencePoint['layer'], val: number | null) => {
    if (val != null) candidates.push({ layer, label: LAYER_LABELS[layer] ?? layer, value: val });
  };

  push('override', layers.override);
  push('computedValue', layers.computedValue);
  push('agent', layers.agent);
  push('t12', layers.t12);
  push('om', layers.om);
  push('broker', layers.broker);
  push('storedResolved', layers.storedResolved);

  if (candidates.length < 2) return undefined;

  let maxAbsDelta = 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const delta = Math.abs(candidates[i].value - candidates[j].value);
      if (delta > maxAbsDelta) maxAbsDelta = delta;
    }
  }

  const thr = getFieldThreshold(fieldName);
  const alertLevel = deriveDivergenceAlertLevel(maxAbsDelta, thr.absolute);

  // Annotate each candidate with delta vs. the resolved (canonical) value.
  // This lets the UI show "T-12 is 1345 bps above what we're using" clearly.
  const points: DivergencePoint[] = candidates.map(c => {
    const deltaAbsolute = resolvedValue != null ? Math.abs(c.value - resolvedValue) : 0;
    const deltaRelative = resolvedValue != null && resolvedValue !== 0
      ? (c.value - resolvedValue) / Math.abs(resolvedValue)
      : null;
    const directionVsResolved: DivergencePoint['directionVsResolved'] =
      resolvedValue == null || c.value === resolvedValue ? 'equal'
      : c.value > resolvedValue ? 'above'
      : 'below';

    return { ...c, deltaAbsolute, deltaRelative, directionVsResolved };
  });

  return {
    points,
    maxAbsDelta,
    alertLevel,
    exceeds:      alertLevel !== 'none',
    threshold:    thr.absolute,
    fieldName,
    unit:         thr.unit,
    isPct:        thr.isPct,
    interpretationHint: FIELD_INTERPRETATION_HINTS[fieldName],
  };
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
    // Preserve the stored source-tag (e.g. 'agent:cashflow') if present;
    // fall back to the coarse 'agent:cashflow' label for legacy entries.
    resolution = storedRes && storedRes.startsWith('agent') ? storedRes : 'agent:cashflow';
    source     = storedSource && storedSource.startsWith('agent') ? storedSource : 'agent:cashflow';
  }

  // Engine A computed overrides agent (unless operator override present)
  if (computedValue != null && override == null) {
    resolved   = computedValue;
    resolution = 'engine:cashflow';
    source     = 'engine:cashflow';
  }

  // Operator override is always final winner
  if (override != null) {
    resolved   = override;
    resolution = 'override';
    source     = 'override';
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
  // CF-01 fix: only compute when (a) no stored resolved value exists, OR
  // (b) a dependency has been explicitly overridden. This prevents the computed
  // formula from clobbering a stored OM-extracted value (year1.noi.om) when the
  // user has not changed any dependency.
  let computedValue: number | null = null;
  let computedAs: string | undefined;
  if (aggDef && !usingAlias && override == null) {
    const depVals: Record<string, number> = {};
    let allDepsPresent = true;
    let hasDepOverride = false;
    for (const dep of aggDef.deps) {
      const depLv = parseLv(row[`lv_${dep.replace(/-/g, '_')}`]);
      if (!depLv) { allDepsPresent = false; break; }
      // If any dependency was explicitly overridden, the formula must re-run
      // so the computed aggregate reflects the operator's change.
      const depOverride = extractNum(depLv.override);
      if (depOverride != null) hasDepOverride = true;
      // Resolve dep through its own layered chain — NOT just raw .resolved.
      // depLv deps (egi, total_opex, etc.) are not computed aggregates themselves,
      // so we pass computedValue=null (no formula to apply).
      const { resolved: depCanonical } = resolveLayeredValue(depLv, null, undefined);
      if (depCanonical == null) { allDepsPresent = false; break; }
      depVals[dep] = depCanonical;
    }
    if (allDepsPresent && (hasDepOverride || storedResolved == null)) {
      computedValue = aggDef.compute(depVals);
      computedAs    = aggDef.formula;
    }
  }

  const { resolved, resolution, source } = resolveLayeredValue(lv, computedValue, computedAs);

  const divergenceSignature = buildDivergenceSignature(fieldName, {
    override, computedValue, agent, t12, om, broker, storedResolved,
  }, resolved);

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
    divergenceSignature,
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

  // ── deal_context_fields override layer ────────────────────────────────────
  // The POST /assumptions/:fieldPath/override endpoint writes user-pinned
  // values to deal_context_fields with source_label='override'.  This is a
  // separate table from deal_assumptions.year1[field].override.  Fetch all
  // active context overrides for this deal in a single query so they can be
  // injected into each field's LV blob before divergence analysis runs.
  // Fields where LV already has an override (from the proforma seeder path)
  // take precedence; context overrides only fill the null case.
  let contextOverrides: Record<string, number> = {};
  try {
    const ctxRes = await pool.query(
      `SELECT field_path, value
       FROM deal_context_fields
       WHERE deal_id = $1::uuid AND source_label = 'override'`,
      [dealId],
    );
    for (const ctxRow of ctxRes.rows as Array<{ field_path: string; value: unknown }>) {
      const n = extractNum(ctxRow.value);
      if (n != null && ALLOWED_FIELDS.has(ctxRow.field_path)) {
        contextOverrides[ctxRow.field_path] = n;
      }
    }
  } catch {
    // Non-blocking — divergence analysis still runs without context overrides
  }

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

    // Inject context override (from deal_context_fields) if the proforma LV
    // has no override already set.  This makes POST /assumptions/:fieldPath/override
    // visible to the divergence engine and ValidationGrid CONTESTED badge.
    let overrideFromCtx = false;
    if (lv.override == null && contextOverrides[fieldName] != null) {
      lv = { ...lv, override: contextOverrides[fieldName] };
      overrideFromCtx = true;
    }

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

    // resolveLayeredValue: when a context override was injected (overrideFromCtx),
    // pass computedValue=null so the override always wins the resolution chain
    // (consistent with how a proforma-seeded override would behave).
    const { resolved, resolution, source } = resolveLayeredValue(
      lv,
      overrideFromCtx ? null : computedValue,
      overrideFromCtx ? undefined : computedAs,
    );

    const divergenceSignature = buildDivergenceSignature(fieldName, {
      override, computedValue, agent, t12, om, broker, storedResolved,
    }, resolved);

    // Piece D: emit ledger observation at divergence-detection time so any
    // consumer (completeness signal, route, capsule) records it consistently.
    if (divergenceSignature?.exceeds &&
        (divergenceSignature.alertLevel === 'warn' || divergenceSignature.alertLevel === 'block')) {
      recordDivergenceObservation({
        dealId,
        fieldName,
        alertLevel:   divergenceSignature.alertLevel,
        resolvedValue: resolved,
        maxAbsDelta:  divergenceSignature.maxAbsDelta,
        pointCount:   divergenceSignature.points.length,
        observedAt:   new Date().toISOString(),
      });
    }

    result[fieldName] = {
      fieldName, year, resolved, override, computedValue, agent,
      t12, om, broker, storedResolved, resolution, source, computedAs,
      divergenceSignature,
    };
  }

  return result;
}

// ── Deal-level divergence summary (for T-C1 completeness signal) ─────────────

const DIVERGENCE_TRACKED_FIELDS = [
  'gpr', 'loss_to_lease', 'vacancy', 'concessions', 'bad_debt',
  'real_estate_tax', 'insurance', 'management_fee', 'repairs_maintenance',
  'utilities', 'noi', 'exit_cap', 'rent_growth_yr1',
] as const;

export interface DivergenceSummary {
  total:  number;
  warn:   number;
  block:  number;
  fields: Array<{ fieldName: string; alertLevel: DivergenceAlertLevel; maxAbsDelta: number }>;
}

/**
 * getDivergenceSummary — aggregate divergence signal for T-C1 deal completeness.
 *
 * Resolves all tracked fields in a single DB query and returns counts of
 * fields with material (warn) and extreme (block) divergence.
 *
 * Callers should treat this as a best-effort enrichment; DB errors are caught
 * and return an empty summary rather than propagating.
 */
export async function getDivergenceSummary(
  pool: Pool,
  dealId: string,
): Promise<DivergenceSummary> {
  try {
    const values = await getFieldValues(pool, dealId, [...DIVERGENCE_TRACKED_FIELDS]);
    const fields: DivergenceSummary['fields'] = [];
    let warn  = 0;
    let block = 0;

    for (const fieldName of DIVERGENCE_TRACKED_FIELDS) {
      const lv = values[fieldName];
      if (!lv?.divergenceSignature || lv.divergenceSignature.alertLevel === 'none') continue;
      const { alertLevel, maxAbsDelta } = lv.divergenceSignature;
      fields.push({ fieldName, alertLevel, maxAbsDelta });
      if (alertLevel === 'warn')  warn++;
      if (alertLevel === 'block') block++;
    }

    return { total: fields.length, warn, block, fields };
  } catch {
    return { total: 0, warn: 0, block: 0, fields: [] };
  }
}
