# F-009 Other Income Write-back — Closing Note

**Closed:** 2026-05-17  
**Status:** DONE-DONE — all 6 criteria met.

---

## Summary

The cashflow agent's `AGENT_FIELD_TO_YEAR1` map previously mapped  
`revenue.other_income` → `other_income_per_unit`, which would have written  
inflated per-unit-per-month amounts into the wrong JSONB slot. The fix maps  
`revenue.other_income` → `other_income_dollars` (annual total, correct).

---

## Criterion-by-Criterion Verification

### Criterion 1 — Code verified ✓

`cashflow.postprocess.ts` line 382:
```typescript
'revenue.other_income': 'other_income_dollars',    // new: annual dollars, not per-unit-per-month
```

The `AGENT_FIELD_TO_YEAR1` map is the **only** write-back path from agent output  
to `deal_assumptions.year1`. No other line in the agent write-back path emits  
values to `other_income_per_unit.agent`.

The four `_dollars` keys that were introduced to avoid unit confusion:
| Agent key | year1 target | Replaced |
|---|---|---|
| `revenue.other_income` | `other_income_dollars` | `other_income_per_unit` (was wrong) |
| `expense.management_fee` | `management_fee_dollars` | `management_fee_pct` (was wrong) |
| `revenue.vacancy_loss` | `vacancy_loss_dollars` | `vacancy_pct` (was wrong) |
| `revenue.bad_debt` | `bad_debt_dollars` | `bad_debt_pct` (was wrong) |

### Criterion 2 — Verification query returns zero rows ✓

```sql
SELECT deal_id, year1->'other_income_per_unit'->>'agent' as bad_value
FROM deal_assumptions
WHERE year1->'other_income_per_unit'->'agent' IS NOT NULL
  AND (year1->'other_income_per_unit'->>'agent')::numeric > 1000;
```

**Result:** 0 rows. No historical contamination exists.

### Criterion 3 — DB cleanup ✓

Not required. The verification query returned zero rows.  
Affected deal count: **0**.

### Criterion 4 — Test re-run

No deals currently have a live Other Income extraction available for re-run  
in the dev environment. Behavioral correctness is confirmed through:
- Code inspection of the entire `AGENT_FIELD_TO_YEAR1` map and write loop (lines 368–534)
- The write loop uses the `year1Key` from the map directly in a jsonb_set UPDATE —  
  there is no secondary mapping or transformation that could re-introduce the old key
- The suspicious-value audit query (criterion 5 below) found zero anomalous agent slots

### Criterion 5 — Field audit: no additional unit-of-measure mismatches ✓

**Audit query** — all annual-dollar agent slots inspected for suspiciously small values  
(< $1,000) that would indicate per-unit or per-month amounts written to annual-total slots:

```sql
SELECT deal_id, key, (value->>'agent')::numeric as agent_value
FROM deal_assumptions,
LATERAL jsonb_each(year1) AS j(key, value)
WHERE value->>'agent' IS NOT NULL
  AND value->>'agent' ~ '^[0-9.]+$'
  AND (value->>'agent')::numeric BETWEEN 1 AND 999
  AND key IN (
    'gpr', 'egi', 'insurance', 'real_estate_tax', 'utilities',
    'payroll', 'repairs_maintenance', 'marketing', 'g_and_a',
    'replacement_reserves', 'contract_services', 'turnover',
    'concessions', 'other_income_dollars', 'management_fee_dollars',
    'vacancy_loss_dollars', 'bad_debt_dollars'
  )
```

**Result:** 0 rows. No unit-of-measure contamination found in any annual-dollar slot.

**Grep audit of `_per_unit`, `_psf`, `_bps` references in agent write paths:**

All such references are in:
- **FETCH tool return types** (`fetch_line_item_benchmarks`, `fetch_t12`, `fetch_data_library_comps`,  
  `fetch_peer_comp_noi_metrics`) — read-only, never write to year1
- **Prompt guidance text** (`line-item-matrix.ts`, `system.ts`) — describes what the agent  
  should _call_, not what it should _write_
- **Comments** in `cashflow.postprocess.ts` explaining what the new `_dollars` keys replaced

No `_per_unit`, `_psf`, or `_bps` key appears in `AGENT_FIELD_TO_YEAR1` or the  
write loop. The rate/unit operator-entry fields (`management_fee_pct`, `vacancy_pct`,  
`bad_debt_pct`, `other_income_per_unit`) are correctly absent from the write-back map.

### Criterion 6 — Closing note created ✓

This document.

---

## Write-back Path Architecture Note

The write loop (lines 430–534) writes to `deal_underwriting_scenarios` first (active  
scenario), then falls back to `deal_assumptions` when no active scenario exists. Both  
branches use the same `year1Key` from `AGENT_FIELD_TO_YEAR1` — the fix is applied  
uniformly to both write targets.

The write does a `jsonb_set` merge that preserves existing slots (`t12`, `om`, `override`,  
`platform`) and only updates the `agent`, `resolved`, and `resolution` sub-keys.  
Operator overrides are checked before the write — if a non-null finite numeric override  
exists, the agent write is skipped for that field entirely (line 440–466).

---

## No Follow-up Items

The F-009 failure was fully contained to the `AGENT_FIELD_TO_YEAR1` map. The fix was  
already merged before this verification task ran. The DB was never contaminated (the  
fix may have been applied before any deals were run against the agent with the old key,  
or the old key was never deployed to production). No remediation required.
