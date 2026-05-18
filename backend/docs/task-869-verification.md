# Task #869 Verification — P0 Pro Forma Table Inversion Fix

## Root cause

`cashflow.postprocess.ts` writes agent analysis to `deal_underwriting_scenarios.year1`.
`composeDealFinancials` read from `deal_assumptions.year1` — a different row.
Seeder wrote full seed blob to `deal_assumptions.year1`, erasing agent values on every re-upload.

## Before state (464 Bishop — DB state before fix)

| Field     | deal_assumptions (pre-fix, what F9 showed) | scenario (agent-written, hidden) |
|-----------|--------------------------------------------|----------------------------------|
| GPR       | 4,876,535 [t12]                            | 4,932,300 [agent]                |
| EGI       | 3,790,652 [platform_fallback]              | 4,685,685 [agent]                |
| NOI       | 820,199   [platform_fallback]              | 673,797   [platform_fallback]    |
| Insurance | 63,698    [t12]                            | 125,280   [agent]                |
| Payroll   | 194,387   [t12]                            | 324,800   [agent]                |

## After state (post-fix — all 3 test deals)

### 464 Bishop [active scenario — F9 now reads scenario]
| Field      | Resolved       | Resolution         |
|------------|----------------|--------------------|
| GPR        | 4,932,300      | agent              |
| EGI        | 4,685,685      | agent              |
| NOI        | 820,200        | platform_fallback  |
| Insurance  | 125,280        | agent              |
| Payroll    | 324,800        | agent              |

deal_assumptions: identical (trigger trg_sync_underwriting_scenario propagated)

### Westside Lofts [no scenario — falls back to deal_assumptions, no regression]
| Field      | Resolved       | Resolution |
|------------|----------------|------------|
| GPR        | 2,280,000      | agent      |
| EGI        | 2,436,000      | agent      |
| Insurance  | 50,000         | agent      |
| Payroll    | 80,000         | agent      |

### Sentosa Epperson [active scenario]
| Field      | Resolved       | Resolution         |
|------------|----------------|--------------------|
| GPR        | 6,592,310      | agent              |
| EGI        | 5,358,329      | agent              |
| NOI        | 1,051,906      | platform_fallback  |
| Insurance  | 202,373        | agent              |
| Payroll    | 99,193         | agent              |

deal_assumptions: identical (trigger propagated)

## Override persistence check (Step 3 — via applyFinancialsOverride)

Test: `applyFinancialsOverride(pool, bishopId, 'gpr', 1, 9999999, userId)`

- Scenario after override: override=9999999, resolved=9999999, resolution='override'  ✓
- deal_assumptions after trigger: override=9999999, resolved=9999999                   ✓
- Seeder re-run: override=9999999 still present, resolution='override'                 ✓  (atomic SQL preserves override sub-key)
- Clear override (null): agent sub-key=4,932,300 preserved in scenario                ✓

## Idempotency / reseed non-clobber

Two consecutive seeder runs on 464 Bishop:
- Run 1: GPR_agent=4,932,300, EGI_agent=4,685,685, Ins_agent=125,280  ✓
- Run 2: GPR_agent=4,932,300, EGI_agent=4,685,685, Ins_agent=125,280  ✓ (unchanged)

## Empty year1 regression guard

Seeded Bishop with year1 set to `{}` (simulates a freshly bootstrapped scenario):
- year1 type after seed: 'object' (not null)                                          ✓
- GPR resolved=4,876,535 seeded correctly                                              ✓
- COALESCE on Step 1 aggregate prevents NULL || jsonb = NULL wipe                     ✓

## Notes

- NOI shows platform_fallback: the cashflow agent writes individual fields (GPR, EGI,
  insurance, payroll, etc.) but not NOI directly. NOI in the scenario reflects the
  buildSeed re-computation from extraction capsules. F9 model engine computes NOI
  from the individual agent-resolved revenue/opex components.
- The $2.99M T12 OM NOI is in noi.om sub-key (preserved in scenario by the atomic merge)
  but resolution is platform_fallback pending a future agent NOI write or separate fix.
