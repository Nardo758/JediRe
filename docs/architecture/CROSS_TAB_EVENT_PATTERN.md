# Cross-Tab Event Pattern — dealStore as Canonical Event Bus

**Status:** Accepted · Implemented May 2026

## Context

Two competing cross-tab notification mechanisms existed simultaneously in the
F9 console:

1. `dealStore.emit*` actions — TypeScript-typed, store-native, testable by
   mocking the store action.
2. `window.dispatchEvent(new CustomEvent(...))` dispatched directly from component
   event handlers — untyped payload, bypasses the store entirely.

Both were in active use. Without a canonical pattern, every future cross-tab
notification faced two equally valid implementation choices, and developers had
already made different choices for different events. The conflict was discovered
while scoping Task #617 (Purchase Price cross-tab notification): `basis.changed`
already existed as a CustomEvent dispatched from inside a dealStore action, but
`deal:strategy-changed` (added shortly after) was dispatched directly from the
component save handler — no store action, no type safety.

## Decision

`dealStore` is the canonical cross-tab event mechanism.

**Rule:** All cross-tab state notifications go through
`window.dispatchEvent(new CustomEvent(...))` dispatched **from inside dealStore
actions**, not from component event handlers directly.

**Naming convention:** `snake_case` with dot separators, past-tense description
(e.g., `basis.changed`, `hold_period.changed`, `exit_cap.changed`).

**Subscriber pattern:** Components subscribe via `window.addEventListener` inside
a `useEffect` and clean up in the return. No tab imports another tab's functions
directly. Backend agents and server-side code never subscribe to DOM events.

**Payload shape:** Simple detail objects, typed at the store action signature.
No-detail events use `{}` (empty CustomEvent).

## Canonical Events

All five events are live today:

| Event name | dealStore action | Detail shape | Dispatch location |
|---|---|---|---|
| `lease_velocity.output.updated` | `emitLeaseVelocityUpdated` | `{}` | `dealStore.ts:1822` |
| `leasing_cost_treatment.changed` | `emitLeasingCostTreatmentChanged` | `{ treatment: string }` | `dealStore.ts:1826` |
| `hold_period.changed` | `emitHoldPeriodChanged` | `{ holdYears: number }` | `dealStore.ts:1830` |
| `basis.changed` | `emitBasisChanged` / `setPurchasePrice` | `{}` | `dealStore.ts:1834` |
| `exit_cap.changed` | `emitExitCapChanged` | `{}` | `dealStore.ts:1844` |

## Implementation

| Location | Role |
|---|---|
| `frontend/src/stores/dealStore.ts:374–413` | Action type signatures (`emitLeaseVelocityUpdated`, `emitLeasingCostTreatmentChanged`, `emitHoldPeriodChanged`, `emitBasisChanged`, `setPurchasePrice`, `emitExitCapChanged`) |
| `frontend/src/stores/dealStore.ts:1821–1845` | All five dispatch implementations |
| `frontend/src/pages/development/financial-engine/DealTermsTab.tsx:538` | Subscriber example — `window.addEventListener('basis.changed', handleBasisChanged)` |
| `frontend/src/pages/development/FinancialEnginePage.tsx:659–665` | Subscriber example — `lease_velocity.output.updated` and `leasing_cost_treatment.changed` handled in one `useEffect`, both trigger `fetchF9Financials()` |
| `replit.md` (Cross-tab Events table) | Operator-facing reference for the five live events; maintained as the non-F9 listener quick-reference |

## Consequences

- TypeScript-safe payloads: action signatures in the store interface are the
  single source of truth for what each event carries.
- Backend agents don't need DOM access — all cross-tab signals are frontend-only.
- Test setup is simpler: mock the store action, not the DOM.
- Components that receive an event must not write back to the store in the same
  tick (infinite loop risk — read, recompute, render only; no dispatch in handlers).

## Patterns Deprecated

- Direct `window.dispatchEvent(new CustomEvent(...))` calls from component event
  handlers, outside a dealStore action.
- Known existing violation: `DealTermsTab.tsx:761` (`saveInvestmentStrategy`) and
  `DealTermsTab.tsx:774` (`saveExitStrategy`) — both dispatch `deal:strategy-changed`
  directly from the component save handlers. This is the open follow-up below.

## Open Follow-Ups

- **Migrate `deal:strategy-changed` to dealStore.** Add a `emitStrategyChanged`
  action to dealStore (matching the `deal:strategy-changed` CustomEvent shape:
  `{ dealId, field: 'investmentStrategy' | 'exitStrategy', value: string | null }`),
  then update both call sites in `DealTermsTab.tsx:761,774` to call the store
  action instead of dispatching directly. Update any subscribers. Not yet scheduled.

## Related Decisions

- `docs/architecture/STRATEGY_FIELDS_LV_PATTERN.md` — `deal:strategy-changed` is
  the known exception to this pattern; the open follow-up above closes it.
