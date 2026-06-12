# TICKETS A & B — Verification Report

**Date:** 2026-04-29
**Scope:** Verify the two high-priority follow-up tickets from Task #824 are already implemented.

---

## TICKET A — AgentRuntime Codepath Consistency Audit

**Status:** ✅ FULLY IMPLEMENTED

**Evidence:**

1. **Hook symmetry audit table** — already exists in `AgentRuntime._continueRun()` at `backend/src/agents/runtime/AgentRuntime.ts:355-376`:
   - `postProcess` — ✓ in both (fixed Task #824)
   - `outputSchema.parse` — ✓ in both
   - `dataPreamble` prepend — ✓ in both (fixed Task #831)
   - `budget.check` — ✓ in `run()` / ✗ in `_continueRun()` — INTENTIONAL (runs in `startAsync()` before row creation)
   - `budget.checkRunCap`, `firstToolCall`, `tools`, `capabilities` — all SYMMETRIC via shared `loop()`

2. **Regression test** — `backend/src/agents/runtime/__tests__/runtime-symmetry.test.ts` (399 lines):
   - Primary set-equality invariant: compares hook counts between `run()` and `startAsync()`
   - Synthetic divergence test: simulates the #824 bug (postProcess absent) and proves the test would catch it
   - Per-hook individual assertions for both paths
   - P4-01 regression: `dataPreamble` prepend symmetry tests
   - Edge cases: both paths succeed when postProcess is absent

3. **No additional hooks** — `AgentConfig` type only has `postProcess`, `firstToolCall`, `outputSchema`, `tools`, `capabilities`. No `preProcess`, `validateOutput`, `onToolCall`, `onStop`, `onError`, `telemetry`, `retry` hooks exist in the codebase.

**Conclusion:** The audit, fixes, and regression test are all present. No code changes needed.

---

## TICKET B — Proforma-Seeder Write Pattern Refactor

**Status:** ✅ FULLY IMPLEMENTED

**Evidence:**

The proforma-seeder no longer does full-object replacement. Both write paths (active scenario + legacy) use atomic SQL merges with `jsonb_object_agg` and `jsonb_each`:

**Active scenario path** — `backend/src/services/proforma-seeder.service.ts:1415-1456`:
```sql
UPDATE deal_underwriting_scenarios
SET year1 = (
  -- Step 1: merge extraction delta into existing fields
  COALESCE(
    (SELECT jsonb_object_agg(
      key,
      CASE
        WHEN $2::jsonb ? key THEN value || ($2::jsonb->key)
        ELSE value
      END
    )
    FROM jsonb_each(COALESCE(year1, '{}')) j(key, value))
  , '{}'::jsonb)
) || (
  -- Step 2: add new fields
  SELECT COALESCE(jsonb_object_agg(dk, dv), '{}'::jsonb)
  FROM jsonb_each($3::jsonb) jd(dk, dv)
  WHERE NOT (COALESCE(year1, '{}') ? dk)
)
```

**Legacy path** (no active scenario) — `backend/src/services/proforma-seeder.service.ts:1490-1550`:
- Same `jsonb_object_agg` merge pattern applied directly to `deal_assumptions`

**Key design features:**
1. `EXTRACTION_SUBKEYS` = `['t12', 'om', 'rent_roll', 'tax_bill', 'box_score', 'aged_ar', 'platform', 'warning']`
2. Only extraction sub-keys are included in `extractionDelta` — agent sub-keys are never present
3. For existing fields: `value || ($3::jsonb->key)` merges only extraction sub-keys; agent/resolved/resolution/override are preserved
4. For new fields: full seed is added (agent has never written here yet)
5. F-010 write-path guard auto-heals contaminated overrides before the merge

**Resolution hierarchy enforcement:**
- `override` > `agent` > `platform` > `t12` > `om` — enforced by the `resolve()` function in `buildSeed`
- The merge preserves existing higher-priority layers because they're not in `extractionDelta`

**Conclusion:** The refactor from full-object replacement to key-level `jsonb_set`-style merge is complete. Both paths respect the resolution hierarchy. No code changes needed.

---

## Summary

| Ticket | Status | Evidence |
|--------|--------|----------|
| A — AgentRuntime audit | ✅ Done | Audit table, symmetric hooks, 399-line regression test |
| B — Proforma-Seeder refactor | ✅ Done | Atomic `jsonb_object_agg` merge, extraction sub-key filtering, F-010 guard |

Both tickets were already implemented in prior sessions. No additional work required.
