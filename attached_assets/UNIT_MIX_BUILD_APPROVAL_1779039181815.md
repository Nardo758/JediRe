# Re: Unit Mix Source Audit — Build Approval

The audit is high-quality work and the Scenario C diagnosis is correct. Approving the six recommended changes with one structural addition and clear PR sequencing.

---

## What the audit got right

**Scenario C is the right call.** Three data sources, no sync, sponsor overrides invisible to the agent. The evidence is precise: rent_roll_units table vs extraction_rent_roll JSONB vs deal_assumptions.unit_mix — three different consumers, no path connecting them.

**The new fetch_unit_mix tool is exactly the right shape.** Single source-of-truth (deal_assumptions.unit_mix canonical, extraction_rent_roll.floor_plan_mix fallback, overrides applied on top). Closes the drift gap in one move.

**Two silent failure modes correctly surfaced:**
- `floorPlanMix` declared in TypeScript at line 252 but never hydrated at runtime (lines 410-420)
- `otherIncomeMonthly` available in extraction capsule but never mapped

Both have been silently degrading agent reasoning for an unknown duration. They're connected to a broader platform-wide pattern of type-runtime divergence worth opening as a separate ticket — see "Adjacent ticket" below.

---

## What to add — regression test for read symmetry

The audit recommends six fixes but doesn't include a test that prevents Scenario C from re-emerging. Same lesson as Tickets A and B from the Task #824 follow-up.

Add as item #7:

**Item 7 — Regression test for unit data source symmetry.**

Test setup:
1. Create a deal with rent roll data in all three sources (rent_roll_units, extraction_rent_roll, deal_assumptions.unit_mix)
2. Apply a sponsor override via the Unit Mix tab API
3. Call `fetch_unit_mix` and verify it returns the overridden values
4. Trigger an agent run and verify the DealContext passed to the agent reflects the overridden values
5. Verify the agent's output reflects the overridden unit count and floor plan structure

Test should fail if any future refactor reintroduces the drift between sponsor overrides and agent reads. Without this, the next architectural change has nothing protecting it.

---

## PR sequencing

The six changes plus item 7 split naturally into two PRs:

### PR 1 — Data plumbing (critical path)
- Item 1: Create `fetch_unit_mix` tool
- Item 2: Register `fetch_unit_mix` in `cashflow.config.ts`
- Item 3: Populate `floorPlanMix` in data-matrix.service.ts hydration
- Item 4: Populate `otherIncomeMonthly` in data-matrix.service.ts hydration
- Item 7 (NEW): Regression test for read symmetry

PR 1 is the critical path. Existing specs (Floor-Plan Grid in UI v1.2, Other Income Method 3) are currently unimplementable because the fields they assume are not hydrated at runtime.

### PR 2 — Prompt and downstream consumers (depends on PR 1)
- Item 5: Update `cashflow/system.ts` floor-plan grid sourcing instructions to reference `fetch_unit_mix`
- Item 6: Update Other Income Method 3 spec with the fallback path for sparse `otherIncomeMonthly`
- Plus: spec text updates to UI v1.2, Other Income Method, Line-Item Matrix (see separate document `SPEC_TEXT_UPDATES_POST_AUDIT.md`)

PR 2 ships after PR 1 is in production. Agent prompts must not reference tools or fields that don't exist.

Estimated total: 4-5 hours of focused work across both PRs.

---

## Adjacent ticket — Type-Runtime Consistency audit

The audit surfaced two instances of a broader pattern:
- `floorPlanMix` declared in TypeScript but never populated at runtime
- `otherIncomeMonthly` available in source but never mapped through hydration

These are silent failure modes in the same class as Task #824's bugs:
- `_continueRun` silently bypassed `postProcess`
- proforma-seeder silently clobbered agent contributions via full-replace
- `jsonb_set` silently failed for missing intermediate keys

**The shared smell: the platform's type system claims symmetry and consistency that the runtime doesn't enforce.**

Opening a separate ticket — "Ticket C — Type-Runtime Consistency Audit" — to grep-audit the codebase for:
- Fields declared in TypeScript interfaces but never assigned in hydration
- Tools registered in agent configs but never invoked
- JSONB schemas the code reads but doesn't actually write
- Conditional invocations gated on truthy config values that may be silently undefined

See `TICKET_C_TYPE_RUNTIME_CONSISTENCY_AUDIT.md` (separate document) for full spec. This is not a gate on PR 1 or PR 2 — it's parallel work.

---

## Downstream context — Competitive Intelligence Engine

The architectural reasoning for "find missing income value-add opportunities" we discussed expanded substantially. It became a platform-wide pattern (not just Other Income) covering revenue, opex, capex, debt, operating model, and exit findings.

See `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` for the full spec. The CIE depends on PR 1 landing (specifically the `otherIncomeMonthly` hydration fix) before its revenue domain findings can be meaningful. Other domains can begin building independently.

For now: PR 1 unblocks the floor-plan grid AND the Other Income spec AND the CIE's revenue domain.

---

## Summary

| Item | This PR? |
|---|---|
| Items 1-4 (data plumbing) | PR 1 |
| Item 7 (NEW: regression test) | PR 1 |
| Items 5-6 (prompt + downstream) | PR 2 |
| Type-Runtime Consistency audit | Separate ticket (parallel) |
| CI Engine spec | Separate doc, depends on PR 1 |

Approve PR 1 to build now. PR 2 after PR 1 ships. Ticket C in parallel. CI Engine spec is ready when the team is ready to take it on.
