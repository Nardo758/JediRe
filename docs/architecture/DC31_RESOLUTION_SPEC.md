# DC-31 Resolution Spec — FIELD_PRIORITIES Agent Layer + Reader Drift

**Status:** Ready to implement
**Severity:** P1 (reader drift) + non-fix close (agent slot)
**Supersedes:** DC-31 original ticket ("add agent to the priority map") — that fix is **inert and S1-01-shaped**; see Finding 1.
**Source traces:** DC-31 completeness audit; DC-31 agent write-path trace (Path A confirmed).

---

## Summary

DC-31 as originally filed says "add `agent` to `FIELD_PRIORITIES`." The trace proved that fix does nothing: `resolve()` has no `agent` slot, so a map entry resolves to `undefined` and falls through silently — green tests, behavior unchanged. DC-31 resolves into **two** dispositions, neither of which is the original ticket:

1. **Agent slot — NON-FIX.** Agent values already have a complete, separate write-back path. Document and close.
2. **Reader drift — FIX.** `resolve()` and `reResolveClearedLayeredValue()` disagree on map-miss behavior. Unify behind one shared miss-handler (same pattern as the SCH-04 `hashLockKey` extraction).

---

## Item 1 — Agent slot: NON-FIX (document and close)

### Finding (from agent write-path trace, Path A confirmed)

The agent layer (`agent:cashflow`) is a **live emitter** with a canonical path that does **not** go through `resolve()`:

```
cashflow agent run → output.proforma_fields
  → cashflow.postprocess.ts:539–659  (AGENT_FIELD_TO_YEAR1, 14 fields)
  → writeAgentFieldToActiveScenario()  underwriting-scenarios.service.ts:431–461
       (jsonb_set stamps agent + resolved + resolution into year1)
  → DB trigger trg_sync_underwriting_scenario  (→ deal_assumptions.year1)
  → re-seed: proforma-seeder.service.ts:1294–1334  (agent-preservation block)
  → read:    get-field-value.service.ts:437–452  (resolveLayeredValue elevates lv.agent)
```

`resolve()` (`proforma-seeder.service.ts:412–478`) is **never** in this chain. Its `lv` object (lines 435–447) and options signature (lines 415–432) have **no `agent` slot**. Adding `'agent'` to a `FIELD_PRIORITIES` entry makes the walker at line 464 read `lv['agent']` → `undefined` → falsy → silent fall-through.

### Disposition

**Do not add `agent` to `FIELD_PRIORITIES`.** Adding it would do nothing while creating the false appearance that agent values participate in the priority walk. Adding a real slot to `resolve()` would create a *second* entry point for a value that already has a canonical one (dual source of truth).

### Required action

Add a comment block at the `FIELD_PRIORITIES` declaration (`proforma-seeder.service.ts:344`) and at the `resolve()` definition (`:412`):

```ts
// AGENT LAYER IS NOT RESOLVER-BOUND.
// Agent values do NOT flow through resolve() or FIELD_PRIORITIES.
// They are written directly to year1 via writeAgentFieldToActiveScenario()
// (underwriting-scenarios.service.ts:431) and elevated at read time by
// resolveLayeredValue() (get-field-value.service.ts:437). Do not add
// 'agent' to FIELD_PRIORITIES — the walker has no agent slot and would
// silently no-op. See DC31_RESOLUTION_SPEC.md.
```

### Acceptance

- Comment present at both sites.
- No change to `FIELD_PRIORITIES` contents.
- DC-31 agent half closed as **non-fix**.

### Secondary note (low, no action required now)

Of the five agent sources in the LayeredValue type, only `agent:cashflow` emits into the proforma field system. `agent:research` writes to a different table (`deal_context_fields`, `write_dealcontext.ts:28,98`). `agent:zoning`, `agent:supply`, `agent:commentary` have **no writer** — type literals only (`layered-value.ts:29–31`). The type advertises five sources where one is wired. File a low-priority note so the type isn't read as a promise the pipeline doesn't keep. No fix in this spec.

---

## Item 2 — Reader drift: FIX (unify miss behavior)

### Finding (from completeness audit)

Two production readers of `FIELD_PRIORITIES` handle a map-miss **differently**:

| Reader | File:line | Miss behavior |
|---|---|---|
| `resolve()` | `proforma-seeder.service.ts:434` | `FIELD_PRIORITIES[f] ?? []` → empty walk → `platform` or `null`, no log |
| `reResolveClearedLayeredValue()` | `proforma-seeder.service.ts:390` | `FIELD_PRIORITIES[f] ?? fallbackPriority` where `fallbackPriority = ['rent_roll','t12','tax_bill','box_score','aged_ar','om']` |

**Live risk:** a field with no map entry resolves to `platform`/`null` at seed time, but on override-clear walks a 6-source fallback. If that walk finds a non-null source `resolve()` never consulted, the cleared override yields a **different value** than the original seed — silently. Not triggered by the current field set (all current miss-path fields carry inline priorities at the `resolve()` call site), but `reResolveClearedLayeredValue()` (`:2034`) receives **no** inline injection, so any future override-able field added without a map entry produces this drift on clear.

This is the SCH-04 shape: two paths for one concept, walking different orders, correctness resting on "no field ever hits the gap."

### Decision (DECISION REQUIRED — confirm or override)

**Recommended policy: fail loud, soft.** A field with no `FIELD_PRIORITIES` entry **and** no inline priority is a `no-priority` condition. On that condition, do **not** silently guess (neither `[]`→platform nor a hidden 6-source fallback). Instead:

- Set `resolution = 'unresolved_no_priority'` and leave `resolved = null`.
- Emit a diagnostic (structured log) naming the field.
- In test/CI, assert (throw) on `unresolved_no_priority` so it's caught before prod.
- In prod, **soft-flag** (status + diagnostic, no throw) so one unguarded field cannot abort an entire seed/read.

Rationale: consistent with the invariant *no silent stale fallback on missing dependencies*. The current 6-source fallback in `reResolveClearedLayeredValue()` is exactly a silent stale fallback. The `[]`→platform path in `resolve()` is a silent default. Both violate the invariant in different directions; fail-loud-soft removes both.

> Alternative if you reject fail-loud: pick **one** of the two existing behaviors and make **both** readers use it. The non-negotiable is that the two readers must be identical — the drift is the bug regardless of which policy wins.

### Required changes

1. **Extract a single shared miss-handler** to `utils/field-priority-miss.ts` (one definition, grep-verifiable — same discipline as `utils/correlation-lock-key.ts` from SCH-04):

   ```ts
   // utils/field-priority-miss.ts
   export function resolvePriorityChain(
     fieldName: string,
     inlinePriority?: Resolution[],
   ): { chain: Resolution[]; unresolvedReason?: 'no_priority' } {
     if (inlinePriority && inlinePriority.length) return { chain: inlinePriority };
     const mapped = FIELD_PRIORITIES[fieldName];
     if (mapped && mapped.length) return { chain: mapped };
     return { chain: [], unresolvedReason: 'no_priority' };
   }
   ```

2. **`resolve()` (`:434`)** — replace `options.priority ?? FIELD_PRIORITIES[fieldName] ?? []` with a call to `resolvePriorityChain(fieldName, options.priority)`. If `unresolvedReason === 'no_priority'`, set `resolution = 'unresolved_no_priority'`, emit diagnostic, skip the platform default.

3. **`reResolveClearedLayeredValue()` (`:390`)** — **delete** the `fallbackPriority` 6-source array. Replace with the same `resolvePriorityChain()` call. Same `no_priority` handling.

4. **`box_score` / `aged_ar`** — these appear only in the deleted `fallbackPriority` list, never in any `FIELD_PRIORITIES` entry. Confirm no field depends on them being in the clear-time fallback before deletion. If any does, that field needs an explicit `FIELD_PRIORITIES` entry (not a hidden fallback).

### Acceptance (trace, not green tests)

- **Same-behavior proof:** for a synthetic field with no map entry and no inline priority, both `resolve()` and `reResolveClearedLayeredValue()` produce identical output (`unresolved_no_priority`, `resolved = null`, diagnostic emitted). `file:line` trace of both, not a passing test.
- **One definition:** `grep` shows exactly one `resolvePriorityChain` (or chosen helper name) definition; both readers import it.
- **No regression:** all 11 current map fields + all inline-priority fields (opex via `opexFromT12`, breakdown via `CAT_PRIORITY`, reserves, other-income) resolve unchanged — verified against a real deal row, not a fixture.
- **box_score/aged_ar:** dependency check complete before deletion.

---

## Build order

1. Item 1 (agent comment) — trivial, do first, closes the agent half.
2. Item 2 step 1 (extract shared helper) — structural foundation.
3. Item 2 steps 2–4 — wire both readers, delete the 6-source fallback.
4. Acceptance traces.

**Human review gate** before Item 2 lands: confirm the fail-loud-soft policy (or name the override). The policy choice is the one decision; the unification is non-negotiable either way.

---

## Relationship to the timeline model

The original DC-31 precedence confusion ("should agent beat fresh T12?") is **not** resolved here — it is *retired* by the proforma timeline model (see `PROFORMA_TIMELINE_MODEL_SPEC.md`). Under the timeline model, T12 occupies historical periods and the agent occupies projection periods; they never contend for the same cell, so there is no precedence to rule on. This spec only fixes the resolver-layer drift that exists regardless of the timeline work. The agent's write-back path (Item 1) remains the mechanism by which agent projections land in projection-zone periods.
