# Task #869 Verification — P0 Pro Forma Table Inversion Fix

## Root cause

`cashflow.postprocess.ts` writes agent analysis to `deal_underwriting_scenarios.year1`.
`composeDealFinancials` read from `deal_assumptions.year1` — a different row.
Every re-upload ran the seeder, which wrote the full seed blob to
`deal_assumptions.year1`, erasing agent values. F9 received stale t12/platform
values instead of the agent's analysis.

## Before state (464 Bishop — DB snapshot immediately before fix merged)

| Field      | deal_assumptions (what F9 showed)        | scenario (agent-written, invisible) |
|------------|------------------------------------------|-------------------------------------|
| GPR        | 4,876,535 [t12]                          | 4,932,300 [agent]                   |
| EGI        | 3,790,652 [platform_fallback]            | 4,685,685 [agent]                   |
| Insurance  | 63,698    [t12]                          | 125,280   [agent]                   |
| Payroll    | 194,387   [t12]                          | 324,800   [agent]                   |
| Other Inc  | 0         [platform_fallback]            | — (agent does not write this field) |

NOI note: the cashflow agent does NOT write a `noi` sub-key — it writes the
individual revenue/opex components (GPR, EGI, insurance, payroll, etc.) that
the F9 model engine uses to compute NOI client-side. The `noi.resolved` stored
in the DB is a derived platform_fallback; F9 renders NOI by summing the
now-correct agent-resolved components from the scenario.

## After state (post-fix — all 3 test deals)

### 464 Bishop [active scenario — F9 now reads from scenario]

| Field      | Resolved           | Resolution       | Source   |
|------------|--------------------|------------------|----------|
| GPR        | 4,932,300          | agent            | SCENARIO |
| EGI        | 4,685,685          | agent            | SCENARIO |
| NOI (DB)   | 367,640            | platform_fallback| SCENARIO |
| Insurance  | 125,280            | agent            | SCENARIO |
| Payroll    | 324,800            | agent            | SCENARIO |
| Other Inc  | —                  | not set          | SCENARIO |

Other Income note: the cashflow agent does not produce an `other_income`
sub-key. Other Income is a user-input line in F9 (`other_income_user_lines`).
Its absence in the scenario is correct; F9 renders user-input lines from the
`other_income_user_lines` array, not the `other_income` scalar sub-key.

deal_assumptions (trigger-synced): identical to scenario above.

### Westside Lofts [no scenario — falls back to deal_assumptions, no regression]

| Field      | Resolved           | Resolution   | Source           |
|------------|--------------------|--------------|--------------------|
| GPR        | 2,280,000          | agent        | deal_assumptions |
| EGI        | 2,436,000          | agent        | deal_assumptions |
| NOI        | —                  | not set      | deal_assumptions |
| Insurance  | 50,000             | agent        | deal_assumptions |
| Payroll    | 80,000             | agent        | deal_assumptions |
| Other Inc  | —                  | not set      | deal_assumptions |

No regression. Falls back cleanly to deal_assumptions; agent values preserved.

### Sentosa Epperson [active scenario]

| Field      | Resolved           | Resolution       | Source   |
|------------|--------------------|------------------|----------|
| GPR        | 6,592,310          | agent            | SCENARIO |
| EGI        | 5,358,329          | agent            | SCENARIO |
| NOI (DB)   | 1,051,906          | platform_fallback| SCENARIO |
| Insurance  | 202,373            | agent            | SCENARIO |
| Payroll    | 99,193             | agent            | SCENARIO |
| Other Inc  | —                  | not set          | SCENARIO |

deal_assumptions (trigger-synced): identical.

## Override persistence (Step 3 — via applyFinancialsOverride)

Test: `applyFinancialsOverride(pool, bishopId, 'gpr', 1, 9999999, userId)`

- Scenario after override: override=9,999,999, resolved=9,999,999, resolution=override  ✓
- deal_assumptions after trigger: override=9,999,999, resolved=9,999,999               ✓
- Seeder re-run: override=9,999,999 still present, resolution=override                  ✓
  (atomic SQL merges only extraction sub-keys; override sub-key untouched by construction)
- Clear override → null: agent sub-key=4,932,300 preserved in scenario                 ✓

## Idempotency

Two consecutive seeder runs on 464 Bishop:
- Run 1: GPR_agent=4,932,300 EGI_agent=4,685,685 Ins_agent=125,280  ✓
- Run 2: GPR_agent=4,932,300 EGI_agent=4,685,685 Ins_agent=125,280  ✓ (no change)

## Empty year1 regression guard (COALESCE fix)

Seeded Bishop with year1 reset to `{}` (simulates a freshly bootstrapped scenario):
- year1 type after seed: 'object' (not null)                          ✓
- GPR.resolved seeded to 4,876,535 [t12]                              ✓
- COALESCE on Step 1 aggregate prevents NULL || jsonb = NULL wipe     ✓

## Error handling

Scenario query failures (schema drift, DB error, transient network) are now
logged at ERROR level via `logger.error` with `dealId` and `error` context
in both `financials-composer.service.ts` and `proforma-seeder.service.ts`.
They do NOT silently degrade — every fallback to deal_assumptions is traced
in application logs so data-source regressions are immediately observable.

Type-system safety: all `as any[]` casts removed. Typed result interfaces
(`ScenRow`, `ActiveScenRow`, `ExistingRow`) carry full TypeScript type pressure.
