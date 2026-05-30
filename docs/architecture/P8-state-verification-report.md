# P8 State-Verification Report — Cross-Surface Read Consistency (Piece B, Phase 2B-1)

**Date:** May 2026  
**Task:** Cross-surface read consistency foundation (Task #1563)  
**Method:** Live code audit + architecture doc reconciliation  
**Prior work:** CF-01 through CF-06 fixed by Task #1541 (Piece B2)

---

## 1. FIELD_PRIORITIES Agent-Layer Audit

### What FIELD_PRIORITIES declares

`backend/src/services/proforma-seeder.service.ts` (line ~337):

```typescript
const FIELD_PRIORITIES: Record<string, Resolution[]> = {
  gpr:               ['t12', 'rent_roll'],
  loss_to_lease_pct: ['t12', 'rent_roll'],
  vacancy_pct:       ['rent_roll', 't12'],
  concessions_pct:   ['t12', 'rent_roll'],
  bad_debt_pct:      ['t12'],
  non_revenue_units_pct: ['t12'],
  other_income_total:    ['rent_roll', 't12', 'om'],
  other_income_per_unit: ['rent_roll', 't12', 'om'],
  real_estate_tax:   ['tax_bill', 't12'],
  management_fee_pct:    ['t12'],
  insurance:         ['t12'],
};
```

### Diagnosis: agent layer is silently present, not declared in FIELD_PRIORITIES

`FIELD_PRIORITIES` lists seeder-source resolution priorities — it controls which
extraction source wins when populating the initial seed. It does NOT enumerate
which sources are available at runtime for the override-chain resolution.

The `agent` layer in `LayeredValue<T>` is a **slot** on the object, not a
FIELD_PRIORITIES entry. The agent layer is populated when a Cashflow Agent run
or explicit `applyUserOverride` writes to `year1[field].agent`. Any field whose
`LayeredValue` blob has a non-null `agent` property will have it respected by
`getFieldValue`'s resolution chain (priority 3: agent > seeder resolved).

**Conclusion:** The agent layer is structurally present for every `year1` field.
Zero fields declare `'agent'` in FIELD_PRIORITIES because FIELD_PRIORITIES only
governs the seed-time resolution pass, not the runtime override chain.

### SKIP_ZERO_FIELDS audit

The seeder also maintains a set of fields where 0 from any source is treated as
"missing" rather than a real measurement:

```typescript
const SKIP_ZERO_FIELDS = new Set(['gpr', 'egi', 'noi', 'net_rental_income',
  'other_income_total', 'other_income_per_unit', 'total_opex']);
```

This is correct: a rent roll reporting GPR=0 on a lease-up deal should not
suppress the T-12 value. `getFieldValue` does NOT need to replicate this
behavior — `SKIP_ZERO_FIELDS` applies only to the seed pass, not to runtime
override reads. A user intentionally overriding to $0 would be respected.

---

## 2. NOI / EGI / GPR Dual-Read-Path Verification

### Pro Forma surface (Engine A)

All F9 sub-tabs receive `f9Financials` (the Engine A / `getDealFinancials` response).
Engine A computes:
- `GPR`:  from seeder's stored `year1.gpr.resolved` via `ry1('gpr')` — production-correct
- `EGI`:  computed inline in `proforma-adjustment.service.ts:2797`: `_computedEgi = _nriResolved + _oiResolved`
- `NOI`:  computed inline: `_computedNoi = _egiResolved - _topexResolved`

These are computed dynamically on every `getDealFinancials` call — they do NOT
read from stale stored `.resolved` for aggregate computation (the code re-computes
from leaf values). The Pro Forma is therefore the source of truth, not the stale seed.

### Valuation Grid surface (backend)

**Before CF-01 (Task #1541):** NOI was read from `da.year1->'noi'->>'resolved'` raw
SQL — this was the stale seeder value, not the Engine A computation. For 464 Bishop,
this showed a >$1M discrepancy vs Pro Forma.

**After CF-01 (Task #1541):** NOI resolved via `getFieldValue('noi', 1)` which
re-runs `egi - total_opex` formula against the current seed. Valuation Grid and
Pro Forma agree on NOI.

**EGI, GPR, total_opex (before this task — Task #1563):**  
- `egi` was NOT in `SubjectProperty` — the Valuation Grid GIM method was a placeholder
- `gpr` was NOT in `SubjectProperty` — the Valuation Grid GRM method was a placeholder
- `total_opex` was NOT in `SubjectProperty`

**EGI, GPR, total_opex (after this task — Task #1563):**  
- Added to `SubjectProperty` via `getFieldValues` batch call (CF-07, CF-08, CF-09)
- EGI added to `COMPUTED_AGGREGATES`: `net_rental_income + other_income` (mirrors Engine A)
- GIM / GRM methods activated (from placeholder to insufficient with evidence trail)
- Shadow-comparison logging between canonical value and stored seed (canary period)

### Validation Grid surface (frontend)

CF-02 through CF-06 (Task #1541) applied `fin != null` guard pattern to prevent
dual-source fallbacks picking `ModelAssumptions` when Engine A has already loaded:

| Code | Field | Fix |
|---|---|---|
| CF-02 | exit_cap | `fin != null` guard |
| CF-03 | hold_period_years | `fin != null` guard |
| CF-04 | rent_growth_yr1 | `fin != null` guard |
| CF-05 | purchase_price | `fin != null` guard |
| CF-06 | loan_amount / interest_rate | `fin != null` guard |

---

## 3. OperatorStance Re-blend Behavior

Architecture doc (`OPERATOR_STANCE_PHASE1_SPEC.md`) describes re-blend as:
> "Stance changes trigger a zero-LLM-cost re-blend against the cached underwriting snapshot."

Live code verification (`operatorStance.service.ts`):
- Stance save → `reBlendFromSnapshot(dealId)` → reads `deal_assumptions.operator_stance` 
- Re-blend does NOT read from `year1.noi.resolved` — it reads from the full
  `getDealFinancials` computation, which is correct
- **No change needed** for OperatorStance behavior in this task

**Status:** Re-blend behavior matches architecture doc description. No reconciliation
action required.

---

## 4. Cross-Surface Agreement Status (Post Task #1563)

| Code | Field | Surface A | Surface B | Status |
|---|---|---|---|---|
| CF-01 | NOI | Pro Forma (Engine A) | Valuation Grid | ✅ Fixed (Task #1541) |
| CF-02 | exit_cap | Pro Forma | Validation Grid | ✅ Fixed (Task #1541) |
| CF-03 | hold_period_years | Pro Forma | Validation Grid | ✅ Fixed (Task #1541) |
| CF-04 | rent_growth_yr1 | Pro Forma | Validation Grid | ✅ Fixed (Task #1541) |
| CF-05 | purchase_price | Pro Forma | Validation Grid | ✅ Fixed (Task #1541) |
| CF-06 | loan_amount / interest_rate | Pro Forma | Validation Grid | ✅ Fixed (Task #1541) |
| CF-07 | EGI | Pro Forma | Valuation Grid (GIM method) | ✅ Fixed (this task) |
| CF-08 | GPR | Pro Forma | Valuation Grid (GRM method) | ✅ Fixed (this task) |
| CF-09 | total_opex | Pro Forma | Valuation Grid (SubjectProperty) | ✅ Fixed (this task) |

---

## 5. Layer 1 Wiring Checklist — Migrated Fields

The 6-point Layer 1 wiring checklist per the revised calc-vs-assumption doc:

| # | Requirement | NOI | EGI | GPR Y1 | total_opex |
|---|---|---|---|---|---|
| 1 | LayeredValue structure exists in year1 | ✅ | ✅ | ✅ | ✅ |
| 2 | PATCH endpoint for Layer 1 (operator override) | ✅ | ✅ | ✅ | ✅ |
| 3 | UI override affordance surfaced (Pro Forma row) | ✅ | ✅ | ✅ | ✅ |
| 4 | Resolution chain selects override over agent | ✅ | ✅ | ✅ | ✅ |
| 5 | Reset-to-Agent available (clear override re-resolves) | ✅ | ✅ | ✅ | ✅ |
| 6 | alertLevel fires on material conflict (divergenceSignature) | ✅ | ✅ | ✅ | ✅ |

**All 6 checklist points are satisfied by the existing `getFieldValue` infrastructure.**
The service was built in Task #1541 with the divergence signature covering all tracked
fields. Items 1–5 flow through the standard LayeredValue + PATCH override infrastructure.

---

## 6. Material Divergence Threshold Defaults

Per task requirement: "configurable, not hardcoded."

Configured in `backend/src/services/field-access/divergence-thresholds.ts`:

| Field type | Default | Specific overrides |
|---|---|---|
| Dollar fields | >$100K absolute | GPR/NOI/EGI/total_opex: >$50K |
| Percentage fields | >500bps relative | exit_cap: >50bps; vacancy: >500bps; rent_growth_yr1: >100bps |

Alert levels:
- `none`: delta < threshold (sources agree)
- `warn`: delta ≥ threshold (operator should review)
- `block`: delta ≥ threshold × 3 (extreme divergence, flags in completeness score)

---

## 7. Open Items (Deferred to Piece B3 and Beyond)

| Item | Status |
|---|---|
| Engine A write-back (computed NOI/EGI written to year1 agent layer) | Deferred to Piece B3 — `getFieldValue` re-runs formula at read time, avoiding the need for write-back |
| GRM/GIM indicated value (requires comp GRM/GIM data) | Pending V1.0 comp data coverage — methods show implied multiplier in evidence trail |
| Full migration of 65 EMPTY fields from audit | Phased over subsequent Piece B tasks |
| Divergence surfacing in Validation Grid UI (CONTESTED badge) | Piece B Phase 2B-3 |
