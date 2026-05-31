# Piece B — Field-Level Reconciliation

**Status:** Partially operational (read path verified; trajectory math in-flight; full override wiring queued)  
**Date:** 2026-05-31 (updated with audit findings)  
**Authority over:** Cross-surface read consistency, trajectory math, divergence surfacing, Layer 1 override universality  
**Key artifact:** `backend/src/services/field-access/get-field-value.service.ts`  
**Convention doc:** `docs/architecture/cross-surface-read-consistency.md`

---

## Problem Piece B Solves

### Problem 1 — Same field, different values on different tabs

Before the `getFieldValue` convention was established, each surface read fields from a different code path:

| Surface | Old path |
|---|---|
| Pro Forma | `getDealFinancials()` — Engine A computes NOI in memory |
| Valuation Grid | Raw SQL `da.year1->'noi'->>'resolved'` (stale seeder value) |
| Validation Grid | `fin?.exitCap ?? assum?.exitCapRate` (dual-source with wrong precedence) |
| Overview Tab | `f9Financials.proforma.year1.find(r => r.field === 'noi').resolved` |

Operators clicking between tabs saw different NOI, exit cap, and hold period values for the same deal. Trust eroded.

### Problem 1b — Formula bypass of the resolution chain

For computed aggregate fields (NOI, EGI, `noi_after_reserves`), the Engine A formula was running even when an operator had explicitly pinned a value. The operator's override in `year1[field].override` was being ignored because no code checked the override before running the formula.

**Resolution (implemented):** `get-field-value.service.ts` at line 512 gates the formula computation on `override == null`. If an operator override is set, the formula is skipped entirely and the override wins.

### Problem 2 — No trajectory math for multi-year fields

Fields like LTL, GPR, and vacancy are single point-in-time values rather than trajectories. The Year 2–10 projections use flat growth assumptions rather than the actual lease-roll-implied starting state and market-trajectory endpoints.

### Problem 3 — Cross-source divergence is hidden

When T-12 data says vacancy is 8% and the OM says 5%, the platform picks one without surfacing the disagreement. The operator has no visibility into the conflict.

### Problem 4 — Agent resolution layer undocumented

The `agent` resolution layer (Layer 3 in the read chain) existed in production but was not documented in the seeder's `FIELD_PRIORITIES` constant. **Clarification (2026-05-31):** `FIELD_PRIORITIES` governs seed-time source priority (which of t12, rent_roll, om, broker to prefer per field). It is a different concern from the read-time resolution chain. The read-time chain in `get-field-value.service.ts` already documents all four layers correctly. This is a naming conflation, not an implementation gap.

---

## The Resolution Chain

Implemented in `get-field-value.service.ts`. Every surface uses this chain:

```
1. Operator override   (year1[field].override — Layer 1, always wins)
       ↓ if null
2. Engine A formula    (for COMPUTED_AGGREGATES: noi, egi, noi_after_reserves)
       ↓ if not a computed aggregate or deps missing
3. Agent layer         (year1[field].agent — agent-written value)
       ↓ if null
4. Stored resolved     (year1[field].resolved — seeder's best source,
                        already incorporates seeder's t12 > om > broker ordering)
```

### Computed aggregates — the formula fields

| Field | Formula | Engine A match |
|---|---|---|
| `egi` | `net_rental_income + other_income` | Yes — same formula |
| `noi` | `egi - total_opex` | Yes — same rounding (Math.round) |
| `noi_after_reserves` | `(egi - total_opex) - replacement_reserves` | Yes |

These fields are NOT stored back to `deal_assumptions.year1` after Engine A computes them. `getFieldValue` re-runs the formula at read time using the current seed dependencies, ensuring byte-for-byte parity with Pro Forma output.

### Override governance (Item B decision — resolved 2026-05-31)

The formula gate at line 512 (`if (aggDef && !usingAlias && override == null)`) ensures the formula is only computed when no operator override is present. When an override IS set, `computedValue` stays null and `resolveLayeredValue` returns the override as canonical. This satisfies Commitment B.1 (one canonical read path) without formula-vs-stored-layers competition.

### Agent layer governance (Item A decision — resolved 2026-05-31)

The agent layer is Layer 3 in the read-time resolution chain. It is correctly documented and implemented in `get-field-value.service.ts`. The seeder's `FIELD_PRIORITIES` constant governs a different concern (seed-time source selection: t12 vs. rent_roll vs. om). The two are intentionally separate — the seeder does not know about agent-written values.

---

## `getFieldValue` API

```typescript
import { getFieldValue, getFieldValues } from '../field-access/get-field-value.service';

// Single field — one DB query
const noiFv = await getFieldValue(pool, dealId, 'noi', 1);
const noi = noiFv?.resolved;  // canonical Engine A value

// Batch — one SQL round-trip for multiple fields
const fvs = await getFieldValues(pool, dealId, ['noi', 'egi', 'exit_cap'], 1);
```

The returned `LayeredFieldValue` carries all source layers:
- `resolved` — canonical value (what every surface should display)
- `override` — Layer 1 operator pin
- `computedValue` — Engine A formula result (null for non-aggregate fields)
- `agent` — agent-written value
- `t12`, `om`, `broker` — individual source layers
- `storedResolved` — seeder's stored value (may be stale for aggregates)
- `divergenceSignature` — CONTESTED badge data when ≥2 sources disagree materially

**Field name safety:** All field names are validated against `ALLOWED_FIELDS` before SQL interpolation. Unknown fields return null, never a DB error.

---

## Cross-Surface Read Rules

### Rule 1 — Backend: always use `getFieldValue`

```typescript
// CORRECT
const noiFv = await getFieldValue(pool, dealId, 'noi', 1);

// WRONG — bypasses resolution chain
const rawNoi = await pool.query(`SELECT da.year1->'noi'->>'resolved' FROM deal_assumptions da WHERE da.deal_id = $1`, [dealId]);
```

### Rule 2 — Frontend: `fin != null` guard

```typescript
// CORRECT — null means "Engine A hasn't loaded yet," not "field is unset"
const exitCap = fin != null
  ? (fin.assumptions?.exitCap ?? null)
  : (assum?.disposition?.exitCapRate ?? null);

// WRONG — ?? picks ModelAssumptions even when Engine A is loaded with a null field
const exitCap = fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate ?? null;
```

### Rule 3 — Computed aggregates: derive, don't read stored `.resolved`

Fields in `COMPUTED_AGGREGATES` (noi, egi, noi_after_reserves) must never be read from the stored `.resolved` JSONB field for display. The stored value is set by the seeder and goes stale as assumptions change. `getFieldValue` re-derives dynamically.

---

## Trajectory Math (Commitment B.2)

Fields that evolve over the hold period must use trajectory math rather than flat Year 1 assumptions extended forward.

| Field | Status |
|---|---|
| GPR | Per-year overrides operational (Task #1521) |
| Vacancy | Per-year overrides operational (Task #1521) |
| Other Income | Per-year overrides operational (Task #1521) |
| OpEx | Per-year overrides operational (Task #1521) |
| LTL | In-flight — Task #1536 (Piece B1) + T-B1 integration |

LTL trajectory: starting state from the live lease-roll signal fed into Engine A Year 1; market convergence trajectory applied for Years 2–10.

---

## Divergence Surfacing (Commitment B.3)

When ≥2 source layers are non-null for the same field, `getFieldValue` computes a `DivergenceSignature`:

```typescript
interface DivergenceSignature {
  points: DivergencePoint[];       // all non-null source layers with delta vs resolved
  maxAbsDelta: number;             // largest pairwise delta
  alertLevel: 'none'|'warn'|'block';  // derived from per-field threshold
  exceeds: boolean;                // warn or block
  threshold: number;               // field-specific threshold (e.g. 150 bps for exit_cap)
  interpretationHint?: string;     // why this field tends to diverge
}
```

Alert levels:
- `warn` — delta ≥ threshold (operator should review)
- `block` — delta ≥ 3× threshold (material disagreement, action required)

Threshold defaults are defined per field in `divergence-thresholds.ts`. The CONTESTED badge in the Validation Grid is driven by this signature.

---

## Layer 1 Override Wiring (Commitment 5)

For an operator override to work end-to-end, a field needs:

1. ✅ Read path: `getFieldValue` returns `override` as canonical when set
2. ✅ API endpoint: `POST /:dealId/assumptions/fields` writes to `year1[field].override`
3. ✅ UI: override input wired in the relevant tab
4. ✅ Clear path: clearing the override re-resolves via `reResolveClearedLayeredValue`
5. ✅ Override persistence: override survives OperatorStance reblends (Layer 1 is immutable to reblend)
6. ✅ Evidence trail: override tagged with timestamp and user ID

Status per field (inferred from Deal Details UI/Backend Audit §7 — count not re-verified in corpus-sweep):
- **Fully wired (~7 fields):** exit_cap, hold_period_years, purchase_price, loan_amount, interest_rate, rent_growth_yr1, vacancy_pct
- **Partially wired (~3 fields):** noi (read path correct; UI write path for operator pin is task #1520), egi, other_income
- **Unwired (~5 fields):** real_estate_tax, management_fee, insurance, loss_to_lease, replacement_reserves

---

## T-B1 Scope

T-B1 (task-1541) covers:

1. LTL trajectory integration into Engine A Year 1 (unblocking #1536/#1537/#1538)
2. Full `getFieldValue` adoption across all surfaces not yet using it
3. Per-field quality gate: confirm each of the 6-point wiring checklist for every agent-authored field
4. EGI canonical read (already added to `COMPUTED_AGGREGATES` in Task #1563)

**T-B1 is blocked on:** #1536 (LTL trajectory) + #1537 (Other Income display/projection seed) + #1538 (live LTL signal into Engine A Year 1)

---

## Future Work — Engine A Write-Back (Piece B3)

After `getDealFinancials` computes NOI, EGI, and `noi_after_reserves`, those values are not written back to `deal_assumptions.year1`. Every `getFieldValue` call for these fields re-runs the formula. This is correct but slightly redundant.

A future write-back step would cache the computed values to `deal_assumptions.year1` so all consumers see the same number without re-running formulas. This is deferred post-T-B1.
