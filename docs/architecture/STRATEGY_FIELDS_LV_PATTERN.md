# Strategy Fields LayeredValue Pattern (with M08 Forward-Compatibility)

**Status:** Accepted · Implemented May 2026

## Context

Investment Strategy and Exit Strategy were originally flat enum fields on
`deal_assumptions` — a single column holding the operator's choice with no
provenance slot for a future automated source.

The risk was identified during the M08 Strategy Arbitrage scoping
(Tasks #613, #619, #620): M08 would eventually write to the same fields, creating
a dual-source conflict with the same shape as the Purchase Price dual-write bug —
two surfaces writing to one flat field, last write wins, no provenance, no
resolution order. The same pattern had already caused silent data loss in the
concessions surface before the LayeredValue refactor.

## Decision

Both fields are stored as a JSONB `LayeredValue` object with two slots:

```typescript
type StrategyLv = {
  detected: { value: string; confidence: number; source: string } | null;
  override: string | null;
  // resolved is computed at read time, never persisted:
  resolved: string | null;  // override ?? detected?.value ?? null
};
```

Resolution order: **operator override always wins.**

- `detected` — M08 writes here when it ships. Null until then.
- `override` — operator dropdown in Deal Terms writes here.
- `resolved` — computed at read time: `override ?? detected?.value ?? null`

M08 forward-compatibility is a consequence of this shape, not a separate
decision. When M08 ships, it writes to the `detected` slot with no schema
migration and no risk of clobbering the operator's explicit choice.

**Intentionally nullable.** When both slots are null, `resolved` is also null.
No silent default to `"Sale"`, `"Rental"`, or any other value. Both fields render
a visible `NOT SET` badge (amber) in Deal Terms when unset. No backfill should
ever be performed for either field.

## Consequences

- One write path per source. No last-write-wins race.
- M08 plugs in with zero schema migration — it gets the `detected` slot for free.
- All downstream consumers must handle null explicitly. Silent defaults are
  forbidden and will produce incorrect analysis.
- Pattern is consistent with every other LV field in the platform — same shape,
  same resolution order, same `stanceModulated` extension point.
- Downstream consumers with zero reads of either LV field today (null cannot
  reach them, confirmed in Task #620 audit): Cashflow Agent prompt builder,
  JEDI Score weights, sub-strategy library, OperatorStance service.

## Implementation

| Location | Role |
|---|---|
| `backend/src/services/proforma-adjustment.service.ts:2182–2214` | Read + resolve pattern — `exitStrategyRaw` / `investmentStrategyRaw` → LV object with computed `resolved` |
| `backend/src/api/rest/deal-assumptions.routes.ts:810–823` | DB write path — `COALESCE(exit_strategy_lv, '{"detected":null}'::jsonb) \|\| jsonb_build_object('override', ...)` JSONB merge pattern |
| `frontend/src/pages/development/financial-engine/DealTermsTab.tsx:761,774` | `deal:strategy-changed` CustomEvent dispatched after save (open follow-up — see below and CROSS_TAB_EVENT_PATTERN.md) |

## Open Follow-Ups

- **Migrate `deal:strategy-changed` to dealStore.** The `saveInvestmentStrategy`
  and `saveExitStrategy` handlers in `DealTermsTab.tsx:756–780` dispatch
  `deal:strategy-changed` directly from the component — a violation of the
  canonical event pattern (see CROSS_TAB_EVENT_PATTERN.md). Both should move to
  a `emitStrategyChanged` dealStore action. Small task: one store action, two
  dispatch call sites. Not yet scheduled.

## Related Decisions

- `docs/architecture/CROSS_TAB_EVENT_PATTERN.md` — canonical event bus pattern;
  `deal:strategy-changed` is the known exception to fix.
- `docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md` — same dual-slot LV approach
  applied to `leasingCostTreatment` in OperatorStance.
