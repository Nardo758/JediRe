# Portfolio Stub Guard — Verdict

**Date:** 2026-06-30  
**Scope:** Exclusion predicate added to three backend routes that read `deal_category='portfolio'` as a live-portfolio-deal signal, preventing 9 orphaned synthetic stubs from surfacing on live surfaces.  
**Rows deleted:** 0. Guard is a read-filter only.

---

## Predicate selection

Two candidate signals were evaluated:

1. `properties.name IS NOT NULL` — all 9 stubs have NULL name; Highlands (real asset) has a name.
2. `deal_monthly_actuals` presence — all 9 stubs have 0 actuals; Highlands has 106.

Partition query run against live DB:

```sql
SELECT 
  p.name IS NULL AS name_null,
  COUNT(*)::int AS n,
  SUM(actuals_subq.cnt)::int AS total_actuals
FROM properties p
CROSS JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt FROM deal_monthly_actuals dma WHERE dma.property_id = p.id
) actuals_subq
WHERE p.id IN (
  SELECT property_id FROM deal_properties WHERE deal_id IN (
    SELECT id FROM deals WHERE deal_category = 'portfolio' 
      AND id != 'eaabeb9f-830e-44f9-a923-56679ad0329d'
  )
) OR p.id = '7ea31caf-f070-43eb-9fd1-fe08f7123701'
GROUP BY 1 ORDER BY 1;
```

**Result:**

| name_null | n | total_actuals |
|:---:|:---:|:---:|
| false | 1 | 106 |
| true  | 9 | 0   |

**Chosen predicate:** `properties.name IS NOT NULL` via EXISTS through `deal_properties`. Clean partition — all 9 stubs on one side, Highlands on the other. No overlap.

**Guard applied as:**
```sql
AND EXISTS (
  SELECT 1 FROM deal_properties dp
  JOIN properties p ON p.id = dp.property_id
  WHERE dp.deal_id = d.id AND p.name IS NOT NULL
)
```

---

## The three edits

### 1. `portfolio.routes.ts`

Four SQL read sites guarded.

**portfolio_projection CTE** (`FROM deals`, `deals.id` alias used):
```
file:portfolio.routes.ts:373-378  (was line 370)

BEFORE:
  AND (status IN ('owned', 'closed', 'portfolio') OR deal_category = 'portfolio')

AFTER:
  AND (status IN ('owned', 'closed', 'portfolio') OR deal_category = 'portfolio')
  AND EXISTS (
    SELECT 1 FROM deal_properties dp
    JOIN properties p ON p.id = dp.property_id
    WHERE dp.deal_id = deals.id AND p.name IS NOT NULL
  )
```

**contributors query** (JOINs `actual_performance`, `d` alias):
```
file:portfolio.routes.ts:465-470  (was line 457)

BEFORE:
  AND (d.status IN ('owned', 'closed', 'portfolio') OR d.deal_category = 'portfolio')

AFTER:
  AND (d.status IN ('owned', 'closed', 'portfolio') OR d.deal_category = 'portfolio')
  AND EXISTS (
    SELECT 1 FROM deal_properties dp
    JOIN properties p ON p.id = dp.property_id
    WHERE dp.deal_id = d.id AND p.name IS NOT NULL
  )
```

**allocation byClass query** (was bare OR without parens — also fixed precedence):
```
file:portfolio.routes.ts:495-500  (was lines 482-483)

BEFORE:
  WHERE d.status IN ('owned', 'closed', 'portfolio')
    OR d.deal_category = 'portfolio'

AFTER:
  WHERE (d.status IN ('owned', 'closed', 'portfolio') OR d.deal_category = 'portfolio')
    AND EXISTS (
      SELECT 1 FROM deal_properties dp
      JOIN properties p ON p.id = dp.property_id
      WHERE dp.deal_id = d.id AND p.name IS NOT NULL
    )
```

**allocation byMarket query** (same fix):
```
file:portfolio.routes.ts:510-515  (was lines 493-494)

BEFORE:
  WHERE d.status IN ('owned', 'closed', 'portfolio')
    OR d.deal_category = 'portfolio'

AFTER:
  WHERE (d.status IN ('owned', 'closed', 'portfolio') OR d.deal_category = 'portfolio')
    AND EXISTS (
      SELECT 1 FROM deal_properties dp
      JOIN properties p ON p.id = dp.property_id
      WHERE dp.deal_id = d.id AND p.name IS NOT NULL
    )
```

---

### 2. `grid.routes.ts`

Two SQL read sites guarded.

**Owned grid assets query** (`FROM deals d`, lateral join on `dma`):
```
file:grid.routes.ts:290-294  (was line 284-286)

BEFORE:
  WHERE d.user_id = $1 
    AND d.deal_category = 'portfolio' 
    AND d.status = 'closed_won' 
    AND d.archived_at IS NULL

AFTER:
  WHERE d.user_id = $1 
    AND d.deal_category = 'portfolio' 
    AND d.status = 'closed_won' 
    AND d.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM deal_properties dp
      JOIN properties p ON p.id = dp.property_id
      WHERE dp.deal_id = d.id AND p.name IS NOT NULL
    )
```

**Report point-lookup query** (`FROM deals d`, single id):
```
file:grid.routes.ts:340-344  (was line 329-331)

BEFORE:
  WHERE d.id = $1
    AND d.deal_category = 'portfolio'
    AND d.status = 'closed_won'
    AND d.archived_at IS NULL

AFTER:
  WHERE d.id = $1
    AND d.deal_category = 'portfolio'
    AND d.status = 'closed_won'
    AND d.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM deal_properties dp
      JOIN properties p ON p.id = dp.property_id
      WHERE dp.deal_id = d.id AND p.name IS NOT NULL
    )
```

---

### 3. `dashboard.routes.ts`

Two SQL read sites guarded.

**Insights query risk-alert arm** (nested inside OR, guard added inside the arm):
```
file:dashboard.routes.ts:483-488  (was line 480)

BEFORE:
  OR (ar.jedi_score < 50 AND d.deal_category = 'portfolio')

AFTER:
  OR (ar.jedi_score < 50 AND d.deal_category = 'portfolio'
      AND EXISTS (
        SELECT 1 FROM deal_properties dp
        JOIN properties p ON p.id = dp.property_id
        WHERE dp.deal_id = d.id AND p.name IS NOT NULL
      ))
```

**`/assets` endpoint query**:
```
file:dashboard.routes.ts:668-672  (was line 657-659)

BEFORE:
  AND d.deal_category = 'portfolio'
  AND d.state = 'POST_CLOSE'
  AND d.archived_at IS NULL

AFTER:
  AND d.deal_category = 'portfolio'
  AND d.state = 'POST_CLOSE'
  AND d.archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM deal_properties dp
    JOIN properties p ON p.id = dp.property_id
    WHERE dp.deal_id = d.id AND p.name IS NOT NULL
  )
```

---

## Acceptance proofs

All proofs run directly against the live DB after backend restart.

### A1 — `portfolio.routes.ts` guarded query: stubs absent, Highlands present

```
Guarded query (deal_category='portfolio' + EXISTS guard):
  Stub rows returned: 0  ✓  (expected 0)
  Highlands returned: 1  ✓  (expected 1)
  Highlands name: "Highlands at Satellite"
```

### A2 — `grid.routes.ts` guarded query: stubs absent, Highlands present

```
Guarded query (deal_category='portfolio' + EXISTS guard):
  Stub rows returned: 0  ✓  (expected 0)
  Highlands returned: 1  ✓  (expected 1)
```

### A3 — `dashboard.routes.ts` guarded query: stubs absent, Highlands present

```
Guarded query (deal_category='portfolio' + EXISTS guard):
  Stub rows returned: 0  ✓  (expected 0)
  Highlands returned: 1  ✓  (expected 1)
```

### A4 — Real assets unharmed

Highlands at Sweetwater Creek (`eaabeb9f`, property `7ea31caf`, name = "Highlands at Satellite") passes the guard on every surface. No regression.

### A5 — Stubs still in DB (guard did NOT delete)

```sql
SELECT COUNT(*) FROM deals WHERE deal_category = 'portfolio';
```

**Result: 9** (+ Highlands = 10 total portfolio rows). Guard is a read-filter; 0 rows deleted.

---

## Note on status enum values

During verification, `status IN ('owned', 'closed', 'portfolio')` was found to contain values not present in the `deal_status` enum (those literals are pre-existing dead code in the original queries — they never matched any rows). The guard predicate does not depend on these values; it works exclusively through the EXISTS/`properties.name` path.
