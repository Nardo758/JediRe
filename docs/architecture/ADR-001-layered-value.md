# ADR-001: LayeredValue\<T\> as the Platform Provenance Model

**Status:** Accepted · In production  
**Date:** May 2026  
**Deciders:** Platform architecture review  
**Supersedes:** —  
**Related:** ADR-002 (dealStore event bus), ADR-003 (cache-stamp pattern),  
`docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md`

---

## Context

Every deal assumption on the platform has multiple possible sources: broker
offering memorandum, platform market intelligence, T-12 financials, rent roll,
tax bill, agent run output, operator manual override. Before this pattern was
established, each field had a single flat value and a single write path. When a
second source arrived (e.g. a Cashflow Agent run after the broker value was
already saved), the second write silently clobbered the first. There was no
record of which source won, no alert when sources disagreed materially, no way
to roll back to the prior source without re-running the agent.

The specific incident that crystalized the problem: the Purchase Price field had
two write paths — `deal_data.purchase_price` (agent/sync path) and
`deal_assumptions.purchase_price_override` (operator path). A GET read from one,
a POST wrote to the other. The field displayed inconsistently across tabs
depending on which path each component happened to query.

The same shape appeared independently in concessions, in strategy fields
(Investment Strategy, Exit Strategy), and in leasing cost treatment before each
was refactored to LayeredValue.

---

## Decision

Every deal assumption that can come from more than one source is stored as a
`LayeredValue<T>` — a typed wrapper that carries the value, its source, and
optional OperatorStance modulation metadata alongside it.

### Type definition

```typescript
// backend/src/types/layered-value.ts

export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource | string;  // which tier/agent wrote this
  agentRunId?: string;                  // links to the specific run
  agentId?: string;
  runAt?: string;
  metadata?: Record<string, unknown>;
  stanceModulated?: boolean;            // true when OperatorStance shifted value
  stanceTrace?: string;                 // "stance: net +25bps [rule(+25bps)]"
}
```

### Source tier hierarchy

Sources resolve in this priority order. Higher tiers win:

| Tier | Source | Examples |
|---|---|---|
| 1 | Deal documents | `tier1:t12`, `tier1:rent_roll`, `tier1:tax_bill` |
| 2 | Owned portfolio actuals | `tier2:owned_asset` |
| 3 | Platform intelligence | `tier3:platform`, `tier3:market_comp`, `tier3:jurisdiction` |
| 4 | Broker OM | `tier4:broker` — lowest authority, collision-detected |
| — | Agent runs | `agent:cashflow`, `agent:research`, etc. — treated as Tier 1–3 depending on source used |
| — | Operator override | `override` / `user` — always wins over all tiers |

### Resolution rule

**Operator override always wins.** When the operator has explicitly set a value,
it is returned regardless of what any agent or data source produced. When no
override exists, the highest available tier wins and its value is surfaced.

### UnderwritingValue extension

For fields produced by the Cashflow Agent, `UnderwritingValue<T>` extends
`LayeredValue<T>` with a full `Evidence` chain: data points, alternatives
considered, collision report (when broker and agent values diverge materially),
confidence, and reasoning. This is the audit trail for every number in the
proforma — reviewers can trace any figure back to the exact source data and the
agent's reasoning for choosing it.

### OperatorStance extension

`stanceModulated: boolean` and `stanceTrace: string` were added to the base
`LayeredValue<T>` type to support OperatorStance Phase 1. When a stance rule
adjusts a value (e.g. `posture_aggressive_rent_growth` adds +25bps to rent
growth), `stanceModulated = true` and `stanceTrace` records the rules that fired.
The UI renders these fields with a yellow attention marker. This is a VIEW of the
baseline value — the stance-modulated value is never written back as the new
baseline.

---

## Consequences

**Positive:**
- One write path per source. No last-write-wins race between concurrent sources.
- Every value is self-describing: you know what produced it without inspecting
  the field name or querying a separate audit table.
- Operator override is structurally guaranteed to win — no conditional logic in
  consumers required.
- Collision detection is built in: when Tier 4 (broker) and a higher tier diverge
  by more than a threshold, a `CollisionReport` is generated and surfaced to the
  operator.
- New sources (agents, modules) plug in by writing to the appropriate tier slot.
  No schema migration, no change to the resolution rule.
- `stanceModulated` extension was zero schema migration: optional fields on an
  existing interface.

**Negative / constraints:**
- Every LayeredValue field requires explicit null handling in all consumers.
  Silent defaults to any specific value are forbidden.
- JSONB storage of LV fields means DB-level queries cannot filter on `value`
  without extracting via `->>'value'`. Acceptable for deal-level data;
  would not be appropriate for high-cardinality indexed queries.
- The type has two parallel definitions in the codebase (`layered-value.ts` for
  the backend agent layer, `dealContext.ts` for the frontend-facing agent
  platform). These must be kept in sync manually — a known open gap.

---

## Known Applications

| Field | Location | Notes |
|---|---|---|
| Purchase Price | `deal_data.purchase_price` + `deal_assumptions.purchase_price_override` | Resolved at read time; single canonical write action |
| Investment Strategy | `deal_assumptions.investment_strategy_lv` | JSONB LV; intentionally nullable — see STRATEGY_FIELDS_LV_PATTERN.md |
| Exit Strategy | `deal_assumptions.exit_strategy_lv` | Same; nullable, no default |
| All proforma fields | `deal_underwriting_snapshots.proforma_fields` | `UnderwritingValue<T>` with full Evidence chain |
| Leasing cost treatment | `deals.operator_stance.leasingCostTreatment` | Simpler two-slot variant: `detected` (agent-inferred) + `override` (operator) |
| Traffic calibration coefficients | `backend/src/types/traffic-calibration.types.ts` | Parallel LV definition for M07 traffic engine |

---

## When to Use This Pattern

Apply `LayeredValue<T>` when:
- A field can be written by more than one source (agent, operator, platform sync)
- The field's provenance matters downstream (audit trail, collision alerts, rollback)
- An operator override must be distinguishable from a platform-computed value

Do **not** apply it when:
- The field has exactly one writer and one reader with no provenance requirement
- The field is ephemeral (computed at read time, never persisted)
- High-cardinality indexed queries are required on the value

---

## Related

- `backend/src/types/layered-value.ts` — canonical type definitions
- `backend/src/types/dealContext.ts` — frontend-facing parallel definition
- `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` — Investment/Exit Strategy application
- `docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md` — `leasingCostTreatment` application
- ADR-002 — dealStore event bus (cross-tab propagation of LV field changes)
- ADR-003 — cache-stamp pattern (stance-derived cached LV-adjacent values)
