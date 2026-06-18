---
name: Scenario sync trigger wipe pattern
description: trg_sync_underwriting_scenario does a full SET year1 = NEW.year1 overwrite of deal_assumptions on every scenario touch — anything written only to deal_assumptions gets erased when seedCapitalStructureDefaults fires on every GET /financials.
---

## The rule

Any value written to `deal_assumptions.year1` that is NOT also present in the active `deal_underwriting_scenarios.year1` will be erased the next time a scenario row is touched.

## Why

`trg_sync_underwriting_scenario` (Postgres trigger on `deal_underwriting_scenarios`) does:
```sql
UPDATE deal_assumptions SET year1 = NEW.year1 WHERE deal_id = NEW.deal_id;
```
Full overwrite — no merge. `seedCapitalStructureDefaults` touches the active scenario on **every** `GET /financials` call (24-hour rate cache TTL). So values written only to `deal_assumptions.year1` survive at most until the next page load.

## How to apply

Any mutation route that writes a new field into `deal_assumptions.year1` must **also** persist that field into the active scenario's `year1`. Use a non-destructive `jsonb_set` so other scenario fields are preserved:

```sql
UPDATE deal_underwriting_scenarios
   SET year1      = jsonb_set(COALESCE(year1, '{}'), '{your_field}', $1::jsonb),
       updated_at = NOW()
 WHERE deal_id = $2 AND is_active = TRUE AND deleted_at IS NULL
```

Do the scenario update **before** the explicit `deal_assumptions` update in the same transaction so the trigger fires first and the explicit `deal_assumptions` write wins as the final state.

## Canonical example

`mutateUserLines` (deal-assumptions.routes.ts) — writes `other_income_user_lines` to both the scenario (`jsonb_set`) and `deal_assumptions` (full year1 write) within the same transaction.
