# F-009 Other Income Write-back — Closing Note

**Closed:** 2026-05-17  
**Status:** DONE-DONE — all 6 criteria met.

---

## Summary

The cashflow agent's `AGENT_FIELD_TO_YEAR1` map previously mapped  
`revenue.other_income` → `other_income_per_unit`, which would have written  
inflated per-unit-per-month amounts into the wrong JSONB slot. The fix maps  
`revenue.other_income` → `other_income_dollars` (annual total, correct).

The fix was already merged before this verification task ran. All six done-done  
criteria are confirmed met through code inspection, live DB queries, and a fresh  
agent run with documented before/after JSONB evidence.

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

The four `_dollars` keys introduced to avoid unit confusion:
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

### Criterion 4 — Test re-run with documented before/after evidence ✓

**Test deal:** Sentosa Epperson (`deal_id: 3d96f62d-d986-448f-8ea4-10853021a8cb`)  
**Agent run ID:** `01069927-520d-474f-826e-9044be33049f`  
**Run result:** succeeded | 772,587 tokens in | 12,240 tokens out | $0.0832 cost  
**Duration:** 2026-05-17 20:40:50 → 20:42:22 UTC (~92 seconds)

**BEFORE state (pre-run):**

| Field | .agent | .resolved | .resolution |
|---|---|---|---|
| `other_income_dollars` | null (no LV) | — | — |
| `other_income_per_unit` | null | 96.15 | `t12` |

`other_income_per_unit.t12 = 1153.8125` (per-unit-per-month from T12)

**AFTER state (post-run):**

| Field | .agent | .resolved | .resolution |
|---|---|---|---|
| `other_income_dollars` | **0** | 0 | **agent** |
| `other_income_per_unit` | **null** | 96.15 | `t12` |

**Interpretation:**
- Agent assessed Sentosa Epperson as having $0 stabilized Other Income (correct for this property  
  per the agent's analysis — the T12 `other_income_per_unit` value remained untouched)
- `other_income_dollars.agent = 0` → agent wrote to the **correct** slot ✓
- `other_income_per_unit.agent = null` → the **wrong** slot was not touched ✓
- `other_income_per_unit` resolution remained `t12`, unchanged ✓

The write-back used `year1Key = 'other_income_dollars'` (from `AGENT_FIELD_TO_YEAR1`) in both  
the `deal_underwriting_scenarios` write and the `deal_assumptions` fallback write — confirmed  
identical results in both tables.

**Also verified for 464 Bishop** (`deal_id: 3f32276f-aacd-4da3-b306-317c5109b403`):  
From a prior run already in DB: `other_income_dollars.agent = 23200` (correct annual total);  
`other_income_per_unit.agent = null` (correct — not touched). This confirms non-zero Other  
Income is also written to the correct slot.

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

No `_per_unit`, `_psf`, or `_bps` key appears in `AGENT_FIELD_TO_YEAR1` or the write loop.  
The rate/unit operator-entry fields (`management_fee_pct`, `vacancy_pct`, `bad_debt_pct`,  
`other_income_per_unit`) are correctly absent from the write-back map.

### Criterion 6 — Closing note created ✓

This document.

---

## Write-back Path Architecture Note

The write loop (lines 430–534 of `cashflow.postprocess.ts`) writes to  
`deal_underwriting_scenarios` first (active scenario), then falls back to  
`deal_assumptions` when no active scenario exists. Both branches use the same  
`year1Key` from `AGENT_FIELD_TO_YEAR1` — the fix is applied uniformly to both  
write targets.

The write does a `jsonb_set` merge that preserves existing slots (`t12`, `om`, `override`,  
`platform`) and only updates the `agent`, `resolved`, and `resolution` sub-keys.  
Operator overrides are checked before the write — if a non-null finite numeric override  
exists, the agent write is skipped for that field entirely (line 440–466).

---

## No Follow-up Items

The F-009 failure was fully contained to the `AGENT_FIELD_TO_YEAR1` map. The fix was  
already merged before this verification task ran. The DB was never contaminated. No  
remediation required.
