# Task #869 Verification — P0 Pro Forma Table Inversion Fix

## Root cause confirmed (pre-fix DB state)

`cashflow.postprocess.ts` writes agent analysis to `deal_underwriting_scenarios.year1`.
`composeDealFinancials` read from `deal_assumptions.year1` — a different row in a different table.
When the seeder ran it wrote the full seed blob to `deal_assumptions.year1`, silently erasing
any agent values that existed only in the scenario.

## Before state (464 Bishop — extracted from DB before fix)

| Field     | deal_assumptions (pre-fix)        | scenario (agent-written)           |
|-----------|-----------------------------------|------------------------------------|
| GPR       | 4,876,535 [t12]                   | 4,932,300 [agent]                  |
| EGI       | 3,790,652 [platform_fallback]     | 4,685,685 [agent]                  |
| NOI       | 820,199   [platform_fallback]     | 673,797   [platform_fallback]      |
| Insurance | 63,698    [t12]                   | 125,280   [agent]                  |
| Payroll   | 194,387   [t12]                   | 324,800   [agent]                  |

F9 was showing the deal_assumptions column — t12/platform values, NOT the agent's analysis.

## After state (post-fix, atomic SQL merge verified)

### 464 Bishop [active scenario → F9 now reads]
| Field      | Resolved       | Resolution         |
|------------|----------------|--------------------|
| GPR        | 4,932,300      | agent              |
| EGI        | 4,685,685      | agent              |
| NOI        | 820,200        | platform_fallback  |
| Insurance  | 125,280        | agent              |
| Payroll    | 324,800        | agent              |

deal_assumptions: identical (trigger trg_sync_underwriting_scenario synced)

### Westside Lofts [no active scenario — falls back to deal_assumptions]
| Field      | Resolved       | Resolution         |
|------------|----------------|--------------------|
| GPR        | 2,280,000      | agent              |
| EGI        | 2,436,000      | agent              |
| Insurance  | 50,000         | agent              |
| Payroll    | 80,000         | agent              |

No regression — legacy deal_assumptions path unchanged.

### Sentosa Epperson [active scenario]
| Field      | Resolved       | Resolution         |
|------------|----------------|--------------------|
| GPR        | 6,592,310      | agent              |
| EGI        | 5,358,329      | agent              |
| NOI        | 1,051,906      | platform_fallback  |
| Insurance  | 202,373        | agent              |
| Payroll    | 99,193         | agent              |

deal_assumptions: identical (trigger synced)

## Override persistence check (Step 3)

Test: set GPR override=9,999,999 via `applyFinancialsOverride` (production path)
→ Scenario after override: override=9999999, resolved=9999999, resolution=override  ✓
→ deal_assumptions after trigger: override=9999999, resolved=9999999               ✓
→ Seeder re-run: override=9999999 still present, resolution=override               ✓
→ Clear override (null): agent sub-key=4932300 preserved, re-resolved to t12       ✓

## Idempotency / reseed non-clobber

Two consecutive seeder runs on 464 Bishop:
→ Run 1: GPR_agent=4932300, EGI_agent=4685685, Ins_agent=125280  ✓
→ Run 2: GPR_agent=4932300, EGI_agent=4685685, Ins_agent=125280  ✓ (unchanged)

## Note on NOI

NOI shows platform_fallback because the cashflow agent writes individual fields
(GPR, EGI, insurance, payroll, etc.) but not NOI directly. NOI in the scenario
reflects the buildSeed re-computation from extraction capsules. The F9 model engine
computes NOI from the individual agent-resolved revenue/opex components.
The $2.99M T12 OM NOI is in noi.om sub-key (preserved in scenario) but the
resolution is platform_fallback pending a future agent NOI write.
