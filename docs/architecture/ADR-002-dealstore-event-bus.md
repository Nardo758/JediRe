# ADR-002: dealStore as the Canonical Cross-Tab Event Bus

**Status:** Accepted · In production  
**Date:** May 2026  
**Deciders:** Platform architecture review  
**Supersedes:** Direct component `window.dispatchEvent` calls  
**Related:** ADR-001 (LayeredValue), `docs/architecture/CROSS_TAB_EVENT_PATTERN.md`

---

## Context

The F9 console is a multi-tab UI where user actions in one tab must notify other
tabs to refresh their displayed values. Two mechanisms existed simultaneously:

1. **`dealStore.emit*` actions** — TypeScript-typed store actions that dispatch
   `CustomEvent` objects from inside the store implementation. Type-safe, testable
   by mocking the store, consistent with Zustand conventions.

2. **Direct `window.dispatchEvent(new CustomEvent(...))`** — dispatched from
   component event handlers, bypassing the store entirely. Untyped payload, no
   central registry of what events exist, impossible to mock without DOM setup.

Both were in active use. The conflict was discovered during Task #617 (Purchase
Price cross-tab notification): `basis.changed` was correctly dispatched from
inside a dealStore action, but `deal:strategy-changed` (added shortly after by a
different task) was dispatched directly from the component save handler. Without
a canonical pattern, every future cross-tab notification faced two equally valid
implementation paths, and developers had already diverged.

### Why not a global state subscription instead?

Zustand subscriptions (`useStore(state => state.someField)`) would propagate
updates to any component rendering that field, but:
- Cross-tab subscribers are in separate React trees (different route subtrees),
  making shared subscription impractical without a global store restructure.
- Some subscribers are outside the store entirely (backend agent queries triggered
  by tab changes, analytics events).
- CustomEvent preserves the imperative "something happened" semantics that
  subscriptions obscure — a tab re-fetching on `basis.changed` is clearer than
  a tab re-fetching because a specific store field changed value.

---

## Decision

**`dealStore` is the canonical cross-tab event bus.**

All cross-tab state notifications are dispatched via
`window.dispatchEvent(new CustomEvent(...))` called **from inside dealStore
actions**, never from component event handlers directly.

### Rules

1. **Dispatch location:** All `window.dispatchEvent` calls for cross-tab events
   live inside `dealStore.ts`, in named action implementations. No component
   dispatches a cross-tab event directly.

2. **Naming convention:** `snake_case` dot-separated past-tense verbs.
   Examples: `basis.changed`, `hold_period.changed`, `exit_cap.changed`.

3. **Payload shape:** Typed at the action signature. No-detail events use `{}`
   (empty CustomEvent detail). Events with data carry a minimal typed object.

4. **Subscriber pattern:** Components subscribe via `window.addEventListener`
   inside a `useEffect` with a cleanup return. Subscribers must not dispatch
   back to the store in the same event tick (infinite loop risk).

5. **Backend is never a subscriber.** All cross-tab signals are frontend-only.
   Server-side code never subscribes to DOM events.

### Canonical live events

| Event name | dealStore action | Detail shape | Dispatch location |
|---|---|---|---|
| `basis.changed` | `setPurchasePrice` / `emitBasisChanged` | `{}` | `dealStore.ts:1834` |
| `hold_period.changed` | `emitHoldPeriodChanged` | `{ holdYears: number }` | `dealStore.ts:1830` |
| `exit_cap.changed` | `emitExitCapChanged` | `{}` | `dealStore.ts:1844` |
| `lease_velocity.output.updated` | `emitLeaseVelocityUpdated` | `{}` | `dealStore.ts:1822` |
| `leasing_cost_treatment.changed` | `emitLeasingCostTreatmentChanged` | `{ treatment: string }` | `dealStore.ts:1826` |

### Adding a new cross-tab event

1. Add the action type to the store interface in `dealStore.ts`.
2. Implement the action — `window.dispatchEvent(new CustomEvent('name', { detail }))`.
3. Call the action from the component save handler (not `dispatchEvent` directly).
4. Register subscribers with `window.addEventListener` in the receiving tab's
   `useEffect`.
5. Update the Cross-tab Events table in `replit.md`.

---

## Consequences

**Positive:**
- TypeScript-safe payloads: action signatures are the source of truth for what
  each event carries. Mismatches are caught at compile time.
- Central registry: all cross-tab events are discoverable in one file
  (`dealStore.ts` action section + `replit.md` table).
- Testable without DOM: mock the store action in unit tests.
- Prevents duplicate dispatch: a component calling the store action can't
  accidentally also dispatch the event itself.

**Negative / constraints:**
- Adds store boilerplate for each new event (type + implementation). For a simple
  one-off notification this can feel heavy. Discipline required not to shortcut
  back to direct dispatch.
- DOM `CustomEvent` is inherently unobserved by React's render cycle — subscribers
  must manually trigger re-renders (typically by calling a fetch or setting state).
- Circular dispatch (subscriber dispatches back to the bus) is a runtime error,
  not a compile-time error. Rule 4 above must be respected by convention.

---

## Known Violation (open follow-up)

`DealTermsTab.tsx:761` (`saveInvestmentStrategy`) and `DealTermsTab.tsx:774`
(`saveExitStrategy`) both dispatch `deal:strategy-changed` directly from the
component save handler — bypassing the store. This is the only known active
violation of this pattern. Fix: add `emitStrategyChanged` action to dealStore,
update both call sites, update any subscribers. Not yet scheduled.

---

## Related

- `frontend/src/stores/dealStore.ts:1821–1845` — all five dispatch implementations
- `frontend/src/stores/dealStore.ts:374–413` — action type signatures
- `docs/architecture/CROSS_TAB_EVENT_PATTERN.md` — implementation detail + subscriber examples
- `replit.md` (Cross-tab Events table) — operator-facing quick reference
- ADR-001 — LayeredValue (what changes propagate via these events)
- ADR-003 — cache-stamp pattern (server-side complement to this frontend pattern)
