# Cross-Surface Read Consistency Convention

**Status:** Active — enforced from Task #1541 onward.

## Problem

Every surface in the F9 Financial Engine (Pro Forma, Valuation Grid, Returns, Decision,
Validation Grid) needs to display the same field values for the same deal. Before this
convention, surfaces read from different code paths and showed different numbers:

| Surface | Old read path |
|---|---|
| Pro Forma (Projections/Returns) | `getDealFinancials()` — Engine A computes NOI = EGI − total_opex in memory |
| Valuation Grid (backend) | `deal_assumptions.year1->'noi'->>'resolved'` raw SQL JSONB (stale seed) |
| Validation Grid (frontend) | `f9Financials.assumptions.exitCap ?? ModelAssumptions.disposition.exitCapRate` |
| Overview Tab | `f9Financials.proforma.year1.find(r => r.field === 'noi').resolved` |

These inconsistencies broke user trust: clicking between tabs could show different NOI,
exit cap, or hold period values for the same deal.

## Canonical Read Paths

### Rule 1 — Backend: `getFieldValue` is the single access point

For any backend service that needs a deal field value, import and call `getFieldValue`:

```typescript
import { getFieldValue, getFieldValues } from '../field-access/get-field-value.service';

// Single field — one DB query
const noiFv = await getFieldValue(pool, dealId, 'noi', 1);
const noi   = noiFv?.resolved;  // canonical Engine A value

// Batch — one DB query for multiple fields
const fvs = await getFieldValues(pool, dealId, ['noi', 'egi', 'exit_cap'], 1);
const noi    = fvs['noi']?.resolved;
const exitCap = fvs['exit_cap']?.resolved;
```

**Never** read `deal_assumptions.year1[field].resolved` directly from SQL for display.
`getFieldValue` runs the full resolution chain (see below) at read time.

### Rule 2 — Frontend: prefer `f9Financials`, fall back only on loading

`f9Financials` is the canonical Engine A output. `ModelAssumptions` is local build state
that may lag behind the server.

```typescript
// CORRECT — canonical source, falls back only when Engine A hasn't loaded yet
const exitCap = fin != null
  ? (fin.assumptions?.exitCap ?? null)
  : (assum?.disposition?.exitCapRate ?? null);

// WRONG — `??` picks ModelAssumptions even when fin is loaded
// but fin.assumptions.exitCap happens to be null (field not set ≠ engine not loaded)
const exitCap = fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate ?? null;
```

The `fin != null` guard means: "Engine A has responded — use its output, even if the
specific field is null (= not set). Only fall back to ModelAssumptions while loading."

### Rule 3 — Computed aggregates: derive, don't read stored `.resolved`

These fields are computed by Engine A from leaf values. Their stored `.resolved` in
`deal_assumptions.year1` JSONB is set by the seeder and may be stale after assumptions
change. Engine A computes them dynamically:

| Field | Engine A formula |
|---|---|
| `egi` | `net_rental_income + other_income` |
| `noi` | `egi − total_opex` |
| `noi_after_reserves` | `(egi − total_opex) − replacement_reserves` |

`getFieldValue` applies these formulas automatically and matches Engine A's integer
rounding (both round to whole dollars via `Math.round`). Callers never need to know
the formula or worry about rounding parity.

> **EGI added (Task #1563):** EGI was previously not in `COMPUTED_AGGREGATES`, so callers
> received only the stale seeder `.resolved` value. Adding `egi` to the computed aggregate
> table makes `getFieldValue('egi')` dynamically re-derive EGI from its leaf inputs,
> matching Engine A's behavior for the Valuation Grid GIM method (CF-07).

## Field Inventory

Year-1 field reads across all financial surfaces, as of Task #1620 audit.

| Field | Pro Forma | Valuation Grid | Policy Mutations | Overview Tab | Returns / Decision |
|---|---|---|---|---|---|
| `noi` | financials-composer → year1 blob (Engine A seeder path) | ✅ `getFieldValues` (CF-01) | — | ✅ `modelResults.summary.noi` (CF-14) | `proforma.year1` row array (tabular display) |
| `egi` | financials-composer → year1 blob | ✅ `getFieldValues` (CF-07) | — | — | `proforma.year1` row array |
| `gpr` | financials-composer → year1 blob | ✅ `getFieldValues` (CF-08) | — | — | — |
| `total_opex` | financials-composer → year1 blob | ✅ `getFieldValues` (CF-09) | — | — | — |
| `exit_cap` | financials-composer → year1 blob | ✅ `getFieldValues` (CF-10) | — | — | — |
| `hold_period_years` | financials-composer → year1 blob | ✅ `getFieldValues` (CF-11) | — | — | — |
| `real_estate_tax` | financials-composer → year1 blob | — | ✅ `getFieldValue` (CF-12) | — | — |
| `bad_debt_pct` | financials-composer → year1 blob | — | ✅ `getFieldValue` (CF-13) | — | — |
| `concessions` | financials-composer → year1 blob | — | — | — | ✅ `data.year1Concessions` direct property (CF-15/CF-16) |
| `vacancy` | financials-composer → year1 blob | — | — | `f9Financials.trafficProjection.calibrated.vacancyPct` | `proforma.year1` row array |
| `purchase_price` | financials-composer → year1 blob | — | — | `f9Financials.capitalStack.purchasePrice` | — |
| `loan_amount` | financials-composer → year1 blob | — | — | `f9Financials.capitalStack.loanAmount` | — |

**Legend:**
- ✅ `getFieldValue` — canonical path (override → Engine A formula → agent → stored resolved)
- `financials-composer → year1 blob` — Engine A seeder path; correct for Pro Forma tabular rows but not for point-in-time reads
- `proforma.year1` row array — `.find(r => r.field === '...')?.resolved` pattern; acceptable for tabular projection columns, but see Rule 3

## Discrepancies Fixed

### Task #1541

| Code | Surface | Description | Fix |
|---|---|---|---|
| CF-01 | Valuation Grid | NOI read from stale `year1.noi.resolved` in SQL | `getSubjectProperty()` now calls `getFieldValue('noi')` — canonical Engine A chain |
| CF-02 | Validation Grid | Exit cap `fin?.exitCap ?? assum?.exitCapRate` | `fin != null` guard (Rule 2) |
| CF-03 | Validation Grid | Hold years `fin?.holdYears ?? assum?.holdPeriod` | `fin != null` guard (Rule 2) |
| CF-04 | Validation Grid | Rent growth Y1 dual-source | `fin != null` guard (Rule 2) |
| CF-05 | Validation Grid | Purchase price dual-source | `fin != null` guard (Rule 2) |
| CF-06 | Validation Grid | Loan amount / interest rate dual-source | `fin != null` guard (Rule 2) |

### Task #1563

| Code | Surface | Description | Fix |
|---|---|---|---|
| CF-07 | Valuation Grid | EGI read from stale `year1.egi.resolved`; GIM method was a placeholder | `getSubjectProperty()` calls `getFieldValues('egi')` — EGI added to `COMPUTED_AGGREGATES` as `net_rental_income + other_income`; GIM method activated with implied multiplier in evidence trail |
| CF-08 | Valuation Grid | GPR read from stale `year1.gpr.resolved`; GRM method was a placeholder | `getSubjectProperty()` calls `getFieldValues('gpr')` — GRM method activated with implied multiplier in evidence trail; canary shadow-comparison active |
| CF-09 | Valuation Grid | total_opex not in `SubjectProperty`; available for expense-based methods | `getSubjectProperty()` calls `getFieldValues('total_opex')` — batch-fetched with NOI/EGI/GPR in one SQL round-trip; canary shadow-comparison active |

### Task #1620

| Code | Surface | Description | Fix |
|---|---|---|---|
| CF-12 | Policy Mutations | `applyTaxAbatementLevelReset` read `da.year1->'real_estate_tax'->>'resolved'` directly in SQL; operator overrides were invisible to the abatement calculation | Refactored to call `getFieldValue(pool, dealId, 'real_estate_tax', 1)` in parallel with the hold-period query; `taxFv.resolved` replaces the raw SQL column |
| CF-13 | Policy Mutations | `applyEvictionMoratoriumConstraint` read `da.year1->'bad_debt_pct'->>'resolved'` directly; operator overrides were invisible to the moratorium constraint floor | Refactored to call `getFieldValue(pool, dealId, 'bad_debt_pct', 1)` in parallel; `bad_debt_pct` added to `ALLOWED_FIELDS`; `badDebtFv.resolved` replaces raw SQL column; falls back to `0.005` when field is absent |
| CF-14 | Overview Tab (frontend) | `f9Yr1Noi` was computed via `f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved` — the `.find()` pattern documented as wrong in Rule 3 | Replaced with `modelResults?.summary?.noi ?? null`; both values originate from Engine A so the output is identical, but the read no longer iterates the tabular row array for a point-in-time value |
| CF-15 | Decision Tab (frontend) | `openConDrill` callback called `proforma.year1.find(r => r.field === 'concessions')?.resolved` for the earned amount in the concession drill modal — Rule 3 anti-pattern | Added `year1Concessions: number \| null` to `ComposedFinancials`; populated in `financials-composer.service.ts` from the treatment-adjusted row (after CAPITALIZED/HYBRID adjustment); DecisionTab reads `f9Financials?.year1Concessions` |
| CF-16 | ProFormaSummaryTab (frontend) | Same `.find()` pattern as CF-15 in the ProFormaSummaryTab concession drill modal callback | Same fix: uses `data.year1Concessions` direct property |

## `getFieldValue` API Reference

```typescript
import { getFieldValue, getFieldValues } from
  '../services/field-access/get-field-value.service';

// Single field
const fv = await getFieldValue(pool, dealId, 'noi', 1);
// fv.resolved       — canonical value (Rule 3 formula for aggregates, override wins)
// fv.computedValue  — Engine A formula result (null if field is not a computed aggregate)
// fv.override       — operator override layer (Layer 1)
// fv.agent          — agent-written layer (Layer 3)
// fv.storedResolved — seeder's stored value (may be stale for computed aggregates)
// fv.t12, fv.om, fv.broker — individual source layers (for audit/display)
// fv.computedAs     — e.g. 'egi - total_opex' when formula was applied
// fv.resolution     — 'override' | 'computed' | 'agent' | <seeder source>
// fv.source         — 'operator_override' | 'computed' | 'agent' | 'om' | 't12' | ...

// Batch (one SQL round-trip)
const fvs = await getFieldValues(pool, dealId, ['noi', 'egi', 'exit_cap'], 1);

// Raw (skip formula — for debugging / seeder regression only)
const rawNoi = await getFieldValue(pool, dealId, 'noi', 1, { raw: true });
```

## Resolution Chain (priority order)

```
1. Operator override   (year1[field].override)
     ↓ if null
2. Engine A formula    (for noi, noi_after_reserves — computed from seed deps)
     ↓ if not applicable or deps missing
3. Agent layer         (year1[field].agent)
     ↓ if null
4. Seeder stored resolved (year1[field].resolved — already incorporates
                           seeder's own t12 > om > broker ordering)
```

## Field name safety

`getFieldValue` interpolates field names into JSONB key paths in SQL. To prevent
injection, all callers must pass names from `ALLOWED_FIELDS` (defined in the service).
Unknown field names return `null` — no DB error, no exception.

To add a new LayeredValue field to `ALLOWED_FIELDS`, edit:
`backend/src/services/field-access/get-field-value.service.ts`

## What NOT to do

```typescript
// WRONG — raw SQL JSONB read (bypasses resolution chain)
da.year1->'noi'->>'resolved'

// WRONG — dual-source ?? that ignores fin-is-loaded state
fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate

// WRONG — iterating proforma row array to find a field value for non-projections use
f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved
```

## Future Work (Piece B3)

Engine A write-back: after `getDealFinancials` computes NOI, EGI, total_opex, and
`noi_after_reserves`, write the computed values back to `deal_assumptions.year1` so all
consumers see the same number without re-running formulas. Until then, `getFieldValue`
re-runs the formula at read time, which is correct but slightly redundant.
