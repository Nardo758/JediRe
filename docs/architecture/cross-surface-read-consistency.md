# Cross-Surface Read Consistency Convention

**Status:** Active — enforced from Task #1541 onward.

## Problem

Every surface in the F9 Financial Engine (Pro Forma, Valuation Grid, Returns, Decision,
Validation Grid) needs to display the same field values for the same deal. Before this
convention, surfaces read from different code paths and could show different numbers:

| Surface | Old read path |
|---|---|
| Pro Forma (Projections/Returns) | `getDealFinancials()` — Engine A computes NOI = EGI − total_opex in memory |
| Valuation Grid (backend) | `deal_assumptions.year1->'noi'->>'resolved'` raw SQL read (stale seed) |
| Validation Grid (frontend) | `f9Financials.assumptions.exitCap ?? ModelAssumptions.disposition.exitCapRate` |
| Overview Tab | `f9Financials.proforma.year1.find(r => r.field === 'noi').resolved` |

These inconsistencies broke user trust: clicking between tabs could show different NOI,
exit cap, or hold period values for the same deal.

## Canonical Read Paths

### Rule 1 — Backend: `getFieldValue` is the single access point

For any backend service that needs a deal field value, import and call `getFieldValue`:

```typescript
import { getFieldValue } from '../field-access/get-field-value.service';

const noiFv = await getFieldValue(pool, dealId, 'noi', 1);
const noi   = noiFv?.resolved;  // already Engine A canonical
```

**Never** read `deal_assumptions.year1[field].resolved` directly from SQL for display.
Use `getFieldValue` — it runs the Engine A resolution chain at read time.

### Rule 2 — Frontend: prefer `f9Financials`, fall back only on loading

`f9Financials` is the canonical Engine A output. `ModelAssumptions` is local build state
that may lag behind the server.

```typescript
// CORRECT — canonical source, falls back only when Engine A hasn't loaded yet
const exitCap = fin != null
  ? (fin.assumptions?.exitCap ?? null)
  : (assum?.disposition?.exitCapRate ?? null);

// WRONG — `??` can silently pick ModelAssumptions even when fin is loaded
// and fin.assumptions.exitCap happens to be null (not the same as "not loaded")
const exitCap = fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate ?? null;
```

The `fin != null` guard means: "Engine A has responded — use its output, even if the
specific field is null (not set). Only use ModelAssumptions while Engine A is loading."

### Rule 3 — Computed aggregates: derive, don't read stored `.resolved`

These fields are computed by Engine A from leaf values. Their stored `.resolved` in
`deal_assumptions.year1` JSONB is set by the seeder (T12 extraction, OM data) and
may not be updated after assumptions change. Engine A computes them dynamically:

| Field | Engine A formula |
|---|---|
| `noi` | `egi − total_opex` |
| `noi_after_reserves` | `noi − replacement_reserves` |
| `egi` | `net_rental_income + other_income` |
| `total_opex` | sum of 7 controllable opex leaf fields |

`getFieldValue` applies these formulas automatically — no caller needs to know the
formula. `getFieldValue('noi')` always returns `egi − total_opex` (or the operator
override if set) regardless of what `.resolved` says in the DB.

## Discrepancies Fixed (Task #1541)

| Code | Surface | Description | Fix |
|---|---|---|---|
| CF-01 | Valuation Grid | NOI read from stale `year1.noi.resolved` in SQL | `getSubjectProperty()` SQL updated to compute `egi − total_opex` (Rule 3) |
| CF-02 | Validation Grid | Exit cap dual-source `fin.exitCap ?? assum.exitCapRate` | `fin != null` guard (Rule 2) |
| CF-03 | Validation Grid | Hold years dual-source `fin.holdYears ?? assum.holdPeriod` | `fin != null` guard (Rule 2) |
| CF-04 | Validation Grid | Rent growth Y1 dual-source | `fin != null` guard (Rule 2) |
| CF-05 | Validation Grid | Purchase price dual-source | `fin != null` guard (Rule 2) |
| CF-06 | Validation Grid | Loan amount / interest rate dual-source | `fin != null` guard (Rule 2) |

## `getFieldValue` API Reference

```typescript
import { getFieldValue, getFieldValues } from
  '../services/field-access/get-field-value.service';

// Single field
const fv = await getFieldValue(pool, dealId, 'noi', 1);
// fv.resolved  — canonical value (Engine A formula for aggregates, override wins)
// fv.override  — operator override layer
// fv.t12       — T-12 actuals layer
// fv.computedAs — e.g. 'egi - total_opex' when formula was applied

// Batch (one SQL round-trip)
const fvs = await getFieldValues(pool, dealId, ['noi', 'egi', 'exit_cap'], 1);
const noi = fvs['noi']?.resolved;

// Raw (skip formula — for debugging only)
const rawNoi = await getFieldValue(pool, dealId, 'noi', 1, { raw: true });
```

## Resolution Chain (priority order)

```
Operator override (year1[field].override)
  └─ if none → Engine A formula (for aggregate fields)
       └─ if not applicable → Agent layer (year1[field].agent)
            └─ if none → Source layers (t12 / om / broker)
                 └─ if none → Stored resolved (year1[field].resolved — seeder/stale)
```

## What NOT to do

```typescript
// WRONG — raw SQL JSONB read (bypasses resolution chain)
da.year1->'noi'->>'resolved'

// WRONG — dual-source ?? that ignores fin-is-loaded state
fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate

// WRONG — iterating proforma row array to find a field
f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved
// (this is OK in the Projections tab where proforma row rendering is intentional,
//  but must not be used as a source-of-truth elsewhere)
```

## Future Work (Piece B3)

Engine A write-back: after `getDealFinancials` computes NOI, EGI, total_opex, and
`noi_after_reserves`, write the computed values back to `deal_assumptions.year1` so
`getFieldValue` can read them without re-computing. This eliminates the in-SQL
`egi − total_opex` formula and makes every consumer a simple `.resolved` reader.
