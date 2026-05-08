# OperatorStance Phase 1 — leasingCostTreatment Decision Record

**Status:** Accepted · Phase 1 implemented May 2026 · Phase 2 (Task #639) shipped May 2026  
**Task:** #638 (Phase 1 type extension) · #639 (Phase 2 wiring build — complete)  
**Storage:** `deals.operator_stance` JSONB — existing column from migration `20260506_operator_stance.sql`

---

## Decision

`leasing_cost_treatment` (OPERATING / CAPITALIZED / HYBRID) governs the accounting
treatment of lease-up cost categories listed below. The field is persisted as
`leasingCostTreatment` inside the `operator_stance` JSONB blob on the `deals` table.

The scope decision is **BROADEN**: the field governs all direct lease-up
deal-initiation costs as a group — not concessions only. The LV engine made this
architectural choice first (`lease-velocity-engine.ts:81–86` groups concessions,
marketing, and locator fees under CAPITALIZED treatment). Building per-category
toggles would mean the engine encodes one model and the UI encodes another.

### Governed Cost Categories

| Category | LV engine field(s) | Governed by toggle? | Engine of record |
|---|---|---|---|
| Free-rent concessions (one-time) | `nlcOT`, `rcOT` | Yes | concession-amortization engine |
| Ongoing rent abatement | `nlcOG`, `rcOG` | Yes (HYBRID branch differs) | LV engine |
| Marketing spend | `ms` (`marketing_per_lease`, `marketing_base_monthly`) | Yes | LV engine |
| Locator / broker fees | `lf` (`locator_fee_pct_of_rent`) | Yes | LV engine |

### Out of Scope by Design

| Category | Why not | Treatment |
|---|---|---|
| Make-ready / turn cost (`mk`) | Ongoing maintenance, not deal-initiation cost | Always P&L |
| TI allowances (Sec 7) | Structurally different — landlord capex, not leasing incentive | Separate toggle if needed (future) |

### Capital Flow When CAPITALIZED

The capitalized portion accrues to `capitalized_lease_up_total`
(`financials-composer.service.ts:873`). That total MUST flow into backend
`equity_required` via `capital-structure-adapter.ts:71` — this is End 2 of the
wiring gap fix (Task #639). The S&U frontend display injection alone
(`SourcesUsesTab.tsx:250–252`) is insufficient — it is today's PARTIALLY_WIRED state.

---

## HYBRID Canonical Rule

Both engines must implement HYBRID identically. The LV engine already does;
the amortization engine must add a matching branch in Phase 2 (Task #639).

**Rule:**
- One-time concessions (`nlcOT`, `rcOT`) + marketing (`ms`) + locator fees (`lf`)
  → **capitalized** (treated identically to CAPITALIZED for these fields)
- Ongoing rent abatement (`nlcOG`, `rcOG`) → **P&L** (treated identically to
  OPERATING for this field)

**LV engine — implemented today** (`lease-velocity-engine.ts:87–91`):
```javascript
// HYBRID: concessions amortize as effective-rent reduction (ongoing); marketing stays OpEx
pnl = nlcOG + rcOG + ms + mk + bd;   // ongoing abatements on P&L
cap = LURB;                            // only lease-up reserve to S&U
```

**Amortization engine — HYBRID branch added in Task #639** (`concession-amortization/index.ts`):
A branch was added inside `processRecord()` at lines 192–215 that routes
`is_lease_up_period=true` records through the CAPITALIZED path and leaves
ongoing-abatement records on the OPERATING path. The cross-treatment cash invariant
assert (`index.ts:342–360`) continues to hold across all three treatments.

---

## Cash Invariant

Total cash outflow over the hold period for the governed cost categories must be
**identical across all three treatment modes**. Only the timing and the line where
it lands changes — not the magnitude.

```
OPERATING:    full amount on P&L in year incurred
CAPITALIZED:  full amount on capital flow at lease-up; zero on P&L
HYBRID:       one-time portion on capital flow;
              ongoing portion on P&L
              (sum equals OPERATING / CAPITALIZED total)
```

**Phase 2 test criterion:** Sum of (P&L concessions + `capitalized_lease_up_total`)
at end of hold must be equal across all three modes. An implementation where
one-time costs neither hit P&L nor capital (they disappear) would pass a "looks
consistent" review but violates this invariant.

The existing cross-treatment assert in `concession-amortization/index.ts:342–360`
already enforces this at the amortization engine level. Phase 2 must extend it to
cover the full governed category set (marketing + locator fees), not just concessions.

---

## Storage

**Column:** `deals.operator_stance` JSONB  
**Migration:** `backend/src/database/migrations/20260506_operator_stance.sql`  
**Field name in blob:** `leasingCostTreatment`  
**Default:** `'OPERATING'`

No DDL change required — the column already exists. The migration comment was
updated in Phase 1 to include `leasingCostTreatment` in the field listing.

**Transition path:** `deal_data.leasing_cost_treatment` (current write surface via
`PATCH /api/v1/deals/:id/context`) → `operator_stance.leasingCostTreatment`
(new canonical location, written via StanceTab after Task #639 ships).

Until Task #639 ships, `deal_data.leasing_cost_treatment` remains the operative
field for the financials composer. After #639 ships, the composer must be updated
to read from `operator_stance.leasingCostTreatment` instead.

---

## Consumer Audit

Callers that currently read `deal_data.leasing_cost_treatment`:

| File:line | Role | Status |
|---|---|---|
| `financials-composer.service.ts:200–214` | Reads from `operator_stance.leasingCostTreatment` first, falls back to `deal_data.leasing_cost_treatment` | **Migrated in Task #639** |
| `financials-composer.service.ts` (cache fingerprint) | Uses `effectiveLct` (resolved from stance) for cache key | **Migrated in Task #639** |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | Write handler for PATCH /context | **Removed in Task #639** (write moved to StanceTab) |
| `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | View-state read only (no write) | **Removed in Task #639** (toggle moved to StanceTab) |

The Cashflow Agent prompt builder, JEDI Score weights, sub-strategy library, and
OperatorStance service have zero reads of `deal_data.leasing_cost_treatment`
— they are not affected by the migration.

---

## Wiring Gap Record

Audit performed on 464 Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`) before Phase 1.

| | End 1 (P&L concessions line) | End 2 (equity_required) | End 2 (S&U display) |
|---|---|---|---|
| OPERATING | NOT_WIRED | NOT_WIRED | N/A |
| CAPITALIZED | NOT_WIRED | NOT_WIRED | WIRED (display only) |
| HYBRID | NOT_WIRED | NOT_WIRED | N/A |

**Overall: PARTIALLY_WIRED**

**End 1 root cause:** `financials-composer.service.ts:1501` assembles the
concessions row from `concPick.resolved` — either `concessions_pct × GPR` or
unit-mix-derived value. `leasing_cost_treatment` is never read for this line.

**End 2 root cause:** `capital-structure-adapter.ts:71` — `equity_required:
stack.metrics.equityRequired` — is populated by the capital structure service
independently of `capitalized_lease_up_total`. The S&U injection
(`SourcesUsesTab.tsx:238–252`) is a frontend-only display addition; the backend
capital stack does not consume the amortization engine output.

**HYBRID root cause:** Two engines with mismatched implementations.
`lease-velocity-engine.ts:87–91` implements Convention 1 (one-time capitalized,
ongoing on P&L). `concession-amortization/index.ts` has no HYBRID branch —
HYBRID falls through identically to OPERATING.

---

## Phase 2 Build Brief (Task #639) — Status

Task #639 shipped May 2026. Summary of what was built vs. deferred:

### ✅ End 1 — P&L concessions line responds to treatment

**File:line:** `financials-composer.service.ts:480–497`

Post-processing added: CAPITALIZED → concessions row resolved = 0;
HYBRID → concessions row = max(0, original − capitalized_lease_up_total).

### ⚠️ End 2a — equity_required reflects capitalized amount (DEFERRED)

**File:line:** `capital-structure-adapter.ts:71`

TODO comment added at line 71. `wireCapitalStack` does not receive `deal_data`,
so threading `capitalized_lease_up_total` requires call-site changes across the
module wiring system. Tracked in Task #641.

### ✅ End 2b — amortization engine HYBRID branch

**File:** `backend/src/services/concession-amortization/index.ts:192–215`

HYBRID branch added inside `processRecord()`. `is_lease_up_period=true` records
→ `lease_up_reserve_required` (same as CAPITALIZED). Ongoing-abatement records
fall through to OPERATING path. Cash invariant assert continues to hold.

### ✅ Read source migration

**File:line:** `financials-composer.service.ts:200–214`

`operator_stance.leasingCostTreatment` is now the primary read source.
`deal_data.leasing_cost_treatment` is kept as a fallback for legacy deals.

### ✅ StanceTab UI + toggle removal

StanceTab: new COST RECOGNITION section with `LeasingCostTreatmentToggle`.
AssumptionsTab: Location A toggle removed. ProFormaSummaryTab: Location B
toggle removed.

---

## Implementation — Phase 1 Changes

| File | Change |
|---|---|
| `backend/src/types/operator-stance.ts` | Added `LeasingCostTreatmentSchema` enum + `LeasingCostTreatment` type; added `leasingCostTreatment` field to `OperatorStanceSchema` with default `'OPERATING'`; added to `PLATFORM_STANCE_DEFAULTS` |
| `backend/src/services/operatorStance.service.ts` | Added `leasingCostTreatment` to `saveStance` logger call |
| `backend/src/database/migrations/20260506_operator_stance.sql` | Updated `COMMENT ON COLUMN` to list `leasingCostTreatment` |

`OperatorStancePatchSchema` and `resolveStance()` pick up the new field
automatically — no structural changes required.

---

## Open Follow-Ups

- **Task #641** — End 2a: wire `capitalized_lease_up_total` into `equity_required`
  in `capital-structure-adapter.ts`. Requires threading the value through
  `wireCapitalStack` call-sites in the module wiring system.
- **Backfill** — existing `deal_data.leasing_cost_treatment` values should be
  migrated to `operator_stance.leasingCostTreatment` for deals that already have
  a treatment set. No backfill was performed in Phase 1 or Phase 2.
- **Cash invariant extension** — Phase 2 spec called for extending the
  cross-treatment assert to cover marketing + locator fees beyond concessions.
  Not yet implemented in `concession-amortization/index.ts:342–360`.

## Related Decisions

- `docs/architecture/INPUTS_SOURCE_OF_TRUTH.md` — same single-write-surface
  principle that governs why the toggle moves to StanceTab.
- `docs/architecture/CROSS_TAB_EVENT_PATTERN.md` — `leasing_cost_treatment.changed`
  event (`dealStore.ts:1826`) is already in the canonical event table.
