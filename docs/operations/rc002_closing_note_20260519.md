# RC-002 Closing Note — `other_income_dollars` key audit
**Date:** 2026-05-19  
**Status:** NO ACTION NEEDED — system already correct

---

## Investigation

### 1. DB key survey — all non-deleted deals

| Deal | `year1.other_income` | `year1.other_income_dollars` | agent value |
|---|---|---|---|
| [CS-AUDIT] Value-Add Test | absent | absent | — (no agent run) |
| [CS-AUDIT] Flip Test | absent | absent | — (no agent run) |
| 464 Bishop | absent | **present** | 341,907 |
| Sentosa Epperson | absent | **present** | 0 |
| Westside Lofts | absent | **present** | 270,000 |
| Smoke Test Update | absent | absent | — (no agent run) |
| Jaguar Redevelopment | absent | absent | — (no agent run) |
| Updated Deal Name | absent | absent | — (no agent run) |
| Inman Park Multifamily | absent | absent | — (no agent run) |

No deal has `other_income` as a year1 key. Three deals have `other_income_dollars` with agent-written values. Six deals have neither — all are unseeded (no Cashflow Agent run has occurred), which is expected.

### 2. Write path

`backend/src/agents/cashflow.postprocess.ts:383`

```ts
'revenue.other_income': 'other_income_dollars',  // new: annual dollars, not per-unit-per-month
```

`other_income_dollars` is the **intentional canonical key** for agent-written annual dollar totals. It was introduced deliberately to avoid overwriting `other_income_per_unit`, the operator-facing monthly-per-unit rate field. The two fields coexist: `other_income_per_unit` holds the rate; `other_income_dollars` holds the agent's annual total.

### 3. Read path

`backend/src/services/proforma-adjustment.service.ts:2262`

```ts
toDollarRow('other_income_per_unit', 'other_income', 'Other Income', _otherIncMul, 'other_income_dollars'),
```

The fifth argument tells `toDollarRow` to source `resolved` from `other_income_dollars` when present, falling back to `other_income_per_unit × units × 12` when the agent has not run. The accompanying comment block (lines 2301–2312) explicitly documents this dual-source logic. The read path handles `other_income_dollars` correctly.

### 4. Seeder re-seed preservation

`backend/src/services/proforma-seeder.service.ts:1236–1238`

```
// For agent-created fields that buildSeed never produces
// (management_fee_dollars, vacancy_loss_dollars, bad_debt_dollars,
//  other_income_dollars): copy the entire LayeredValue so these fields
//  are not silently dropped from the JSONB on every re-seed.
```

`other_income_dollars` is explicitly listed. It survives re-seeds verbatim.

---

## Decision

All three layers — write path, read path, seeder — are consistent and correctly handle `other_income_dollars`. The original RC-002 finding was based on a snapshot before the read-path and seeder fixes landed. Those fixes are now in production code.

**Fix applied:** None required.  
**Migration SQL:** None required.  
**Write-path change:** None required.

---

## Verification query

Run after any future agent run to confirm no wrong-key data exists:

```sql
-- Expect: 0 rows (no deal should have a top-level 'other_income' key in year1
-- distinct from the intended 'other_income_per_unit' / 'other_income_dollars' keys)
SELECT
  d.name,
  da.year1 -> 'other_income'         AS wrong_key_value,
  da.year1 -> 'other_income_dollars' AS correct_key_value,
  da.year1 -> 'other_income_per_unit' AS rate_key_value
FROM deals d
JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.status != 'deleted'
  AND (da.year1 -> 'other_income') IS NOT NULL;
-- Should return 0 rows.

-- Secondary: confirm all agent-seeded deals have other_income_dollars as a well-formed LV
SELECT
  d.name,
  da.year1 -> 'other_income_dollars' -> 'agent'      AS agent,
  da.year1 -> 'other_income_dollars' -> 'resolved'   AS resolved,
  da.year1 -> 'other_income_dollars' -> 'resolution' AS resolution
FROM deals d
JOIN deal_assumptions da ON da.deal_id = d.id
WHERE d.status != 'deleted'
  AND (da.year1 -> 'other_income_dollars') IS NOT NULL;
-- Expect: each row has resolution = 'agent', agent = resolved.
```

Running the primary check now against current data:
- `(da.year1 -> 'other_income') IS NOT NULL` → **0 rows** confirmed by DB survey above.
- All three `other_income_dollars` rows have `resolution = 'agent'` and numeric `agent` values.

RC-002 is closed.
