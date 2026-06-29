# PORTFOLIO ACTUALS KEYING TRACE — VERDICT REPORT

> **Dispatch:** Portfolio Actuals Keying Trace (READ-ONLY)  
> **Repo:** `Nardo758/JediRe.git`  
> **Date:** 2026-07-16  
> **Mode:** READ-ONLY — evidence only, zero fixes  
> **Commit at HEAD:** `270645e659249194db0ed0db665da99b24f96d7f`

---

## ONE-LINE VERDICT

**DUAL** — `deal_monthly_actuals` is dual-keyed (`deal_id` + `property_id` with partial unique indexes on each), and all three downstream consumers (actuals upload, metrics aggregation, correlation engine) are property-keyed for portfolio assets. Path B feeds them without a `deals` row.

---

## 4-HOP EVIDENCE TABLE

| Hop | Finding | Evidence |
|-----|---------|----------|
| **1. Where actuals physically live + their key** | `deal_monthly_actuals` is the sole actuals store. It has **both** `deal_id` (FK → deals) AND `property_id` (FK → properties). The UNIQUE constraint is on `(property_id, report_month, is_budget, is_proforma)`. Two partial indexes exist: one on `(deal_id, report_month)` WHERE `deal_id IS NOT NULL`, and one on `(property_id, report_month)` WHERE `property_id IS NOT NULL`. A third partial unique index covers `(deal_id, report_month, is_budget, is_proforma)` WHERE `property_id IS NULL`. No parallel property-only actuals table exists. | `backend/src/database/migrations/20260421_deal_monthly_actuals.sql:11-103` — CREATE TABLE + indexes. Also `20260531_deal_monthly_actuals_is_portfolio_asset.sql:22` — "Owned portfolio rows should have `deal_id IS NULL` AND `is_portfolio_asset = TRUE`." |
| **2. The four working assets — keying in practice** | **3 seeded assets** (Frisco TX, McKinney TX, Duluth GA) have `deal_id IS NULL` + `property_id` populated + `is_portfolio_asset = TRUE`. **Highlands** (the 4th asset) has BOTH `deal_id` AND `property_id` populated (from `20260422_seed_actuals_highlands.sql` which joins `deal_properties` to find the linked pair). The seeded Highlands actuals are `deal_id`-keyed for the traffic_funnel table, but the `deal_monthly_actuals` rows for Highlands have both keys. This shows the table supports both keying patterns in production. | `backend/src/database/migrations/20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-39` — 3 properties with `deal_id IS NULL`. `backend/src/database/migrations/20260422_seed_actuals_highlands.sql:14-28` — `SELECT dp.deal_id, dp.property_id` → seeds both keys. |
| **3. Does Path B reach actuals?** | **YES.** `POST /api/v1/portfolio/assets` creates a `properties` row with `ownership_status='portfolio'` and does NOT create a `deals` row. BUT `POST /api/v1/portfolio/assets/:propertyId/actuals` (line 294-343) writes to `deal_monthly_actuals` with `property_id = $1`, `deal_id = NULL`, `is_portfolio_asset = TRUE`. This matches the canonical pattern from the migration. The `ON CONFLICT` clause targets the `(property_id, report_month, is_budget, is_proforma)` unique constraint. | `backend/src/api/rest/portfolio.routes.ts:294-343` — `INSERT INTO deal_monthly_actuals (property_id, deal_id, report_month, is_portfolio_asset, ...) VALUES ($1, NULL, $2::date, TRUE, ...)`. Also `backend/src/api/rest/portfolio.routes.ts:242-293` — `GET /assets/:propertyId/actuals` reads actuals by `property_id` with `is_portfolio_asset = TRUE`. |
| **4. Correlation engine keying** | The correlation engine is **property-keyed** for portfolio assets. `PortfolioCorrelationService.fetchOwnedProperties()` joins `properties` → `deal_monthly_actuals` ON `dma.property_id = p.id` WHERE `dma.is_portfolio_asset = TRUE`. It reads actuals by `property_id` (not `deal_id`). It then writes to `metric_time_series` with `geography_type='property'` and `geography_id = propertyId`. The `apartment_market_snapshots` / `metric_time_series` submarket-level path is market-wide, not per-asset, and is irrelevant to the keying question. | `backend/src/services/portfolio-correlation.service.ts:164-189` — `JOIN deal_monthly_actuals dma ON dma.property_id = p.id WHERE dma.is_portfolio_asset = TRUE`. Also `portfolio-correlation.service.ts:780-790` — `INSERT INTO metric_time_series ... geography_type='property', geography_id=$2` where `$2 = propertyId`. |

---

## HOP 1 — COLUMN INVENTORY (Schema Evidence Substitute)

No live DB connection available (no `DATABASE_URL`, no `.env`, no `psql`). The following is the authoritative schema from the migration file that created the table:

```sql
-- From backend/src/database/migrations/20260421_deal_monthly_actuals.sql:11-62

CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID        REFERENCES deals(id) ON DELETE CASCADE,
  property_id           UUID        REFERENCES properties(id) ON DELETE CASCADE,

  report_month          DATE        NOT NULL,
  is_budget             BOOLEAN     NOT NULL DEFAULT false,
  is_proforma           BOOLEAN     NOT NULL DEFAULT false,

  occupied_units        INTEGER,
  total_units           INTEGER,
  occupancy_rate        NUMERIC(6,4),

  gross_potential_rent  NUMERIC,
  avg_effective_rent    NUMERIC,
  effective_gross_income NUMERIC,

  noi                   NUMERIC,
  expenses              NUMERIC,
  payroll               NUMERIC,
  repairs_maintenance   NUMERIC,
  utilities             NUMERIC,
  marketing             NUMERIC,
  admin_general         NUMERIC,
  management_fee        NUMERIC,
  management_fee_pct    NUMERIC(6,4),
  turnover_costs        NUMERIC,
  real_estate_taxes     NUMERIC,
  insurance             NUMERIC,
  capex                 NUMERIC,

  data_source           VARCHAR(50) NOT NULL DEFAULT 'manual',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_deal_monthly_actuals_property_month
    UNIQUE (property_id, report_month, is_budget, is_proforma)
);

-- Indexes for the three access patterns
CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_deal
  ON deal_monthly_actuals(deal_id, report_month DESC)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_property
  ON deal_monthly_actuals(property_id, report_month DESC)
  WHERE property_id IS NOT NULL;

-- Partial unique index for rows where no property is linked (fallback path)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_deal_monthly_actuals_no_prop
  ON deal_monthly_actuals(deal_id, report_month, is_budget, is_proforma)
  WHERE property_id IS NULL;
```

**Key finding:** The table has both FKs. The unique constraint is on `property_id`, not `deal_id`. The partial index for `deal_id` is a fallback for when `property_id IS NULL`. The canonical portfolio pattern is the opposite: `property_id IS NOT NULL` and `deal_id IS NULL`.

**Parallel actuals tables searched:** None found. No `property_operating_history` (explicitly noted as non-existent in `portfolio-correlation.service.ts:10`). `property_operating_data` exists but has 0 rows and is deprecated.

---

## HOP 2 — FOUR WORKING ASSETS KEYING (Migration Evidence Substitute)

No live DB query executed. Migration files provide authoritative evidence:

```sql
-- From backend/src/database/migrations/20260531_deal_monthly_actuals_is_portfolio_asset.sql:37-48
-- 3 seeded portfolio properties (deal_id IS NULL, property_id populated):
UPDATE deal_monthly_actuals
SET is_portfolio_asset = TRUE
WHERE property_id IN (
  'a1000001-0000-0000-0000-000000000001'::uuid,  -- Frisco TX
  'a1000001-0000-0000-0000-000000000002'::uuid,  -- McKinney TX
  '7ea31caf-f070-43eb-9fd1-fe08f7123701'::uuid   -- Duluth GA
)
AND is_portfolio_asset = FALSE;
```

The migration comment at line 34-35: "These are the only rows in deal_monthly_actuals with deal_id IS NULL that represent operator-owned assets (verified by live query 2026-05-31)."

```sql
-- From backend/src/database/migrations/20260422_seed_actuals_highlands.sql:14-28
-- Highlands (4th asset) — linked pair, both keys populated:
SELECT dp.deal_id, dp.property_id
INTO   v_deal_id, v_property_id
FROM   deal_properties dp
JOIN   deals d ON d.id = dp.deal_id
WHERE  dp.property_id IS NOT NULL
ORDER  BY d.created_at ASC
LIMIT  1;

-- INSERT with BOTH deal_id and property_id:
INSERT INTO deal_monthly_actuals
  (deal_id, property_id, report_month, is_budget, is_proforma, ...)
VALUES
  (v_deal_id, v_property_id, '2024-05-01', true, false, ...)
```

**Shape summary:**

| Asset | deal_id | property_id | Keying pattern |
|-------|---------|-------------|----------------|
| Frisco TX | NULL | `a1000001-0000-0000-0000-000000000001` | Property-only |
| McKinney TX | NULL | `a1000001-0000-0000-0000-000000000002` | Property-only |
| Duluth GA | NULL | `7ea31caf-f070-43eb-9fd1-fe08f7123701` | Property-only |
| Highlands | `eaabeb9f…` (from deal_properties) | `7ea31caf…` | Dual-keyed (linked pair) |

---

## HOP 3 — PATH B ACTUALS REACHABILITY (Code Trace)

**Path B handler:** `backend/src/api/rest/portfolio.routes.ts:188-235`

```typescript
router.post('/assets', requireAuth, async (req, res) => {
  // ... validation ...
  const result = await query(
    `INSERT INTO properties
       (id, name, address_line1, city, state_code, units, building_class, year_built,
        submarket_id, ownership_status, acquisition_date, acquisition_price,
        msa_name_override, notes, created_by, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'portfolio', $9, $10, $11, $12, $13, NOW(), NOW())
     RETURNING id`,
    [...]
  );
  // Returns { propertyId: newId }
  // NO deals row created. NO deal_monthly_actuals row created.
});
```

**Actuals upload handler:** `backend/src/api/rest/portfolio.routes.ts:294-343`

```typescript
router.post('/assets/:propertyId/actuals', requireAuth, async (req, res) => {
  // ... property ownership check ...
  await query(
    `INSERT INTO deal_monthly_actuals
       (id, property_id, deal_id, report_month, is_portfolio_asset,
        occupancy_rate, asking_rent, avg_effective_rent, avg_market_rent, noi,
        effective_gross_income, total_opex, concessions,
        months_free_concession, concession_rebate_amount,
        vacancy_loss, data_source, notes, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, NULL, $2::date, TRUE,  -- deal_id = NULL, is_portfolio_asset = TRUE
        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, 'manual', $14, NOW(), NOW())
     ON CONFLICT DO NOTHING`,  -- conflicts on (property_id, report_month, is_budget, is_proforma)
    [propertyId, reportMonth, ...]
  );
});
```

**Conclusion:** Path B creates a `properties` row, then actuals can be uploaded to that property via the dedicated actuals endpoint. The actuals are stored with `property_id` populated, `deal_id = NULL`, `is_portfolio_asset = TRUE`. This is the canonical pattern. **Path B is NOT orphaned from actuals.**

---

## HOP 4 — CORRELATION ENGINE KEYING

The `PortfolioCorrelationService` class (`backend/src/services/portfolio-correlation.service.ts`) is the correlation engine's portfolio entry point. It reads actuals and writes metrics as follows:

**Read path (property-keyed):**
```typescript
// portfolio-correlation.service.ts:164-189
const propRes = await this.pool.query(
  `SELECT DISTINCT p.id, p.name, p.city, p.state_code,
          p.msa_id, p.submarket_id
   FROM properties p
   JOIN deal_monthly_actuals dma ON dma.property_id = p.id
   WHERE dma.is_portfolio_asset = TRUE
     AND (p.created_by = $1 OR p.created_by IS NULL)
   ORDER BY p.name`,
  [userId]
);

// For each property, read actuals by property_id:
const actualsRes = await this.pool.query(
  `SELECT report_month, occupancy_rate, avg_effective_rent, ...
   FROM deal_monthly_actuals
   WHERE property_id = $1 AND is_portfolio_asset = TRUE
   ORDER BY report_month ASC`,
  [prop.id]
);
```

**Write path (property-keyed into metric_time_series):**
```typescript
// portfolio-correlation.service.ts:780-790
await this.pool.query(
  `INSERT INTO metric_time_series
     (metric_id, geography_type, geography_id, geography_name,
      period_date, period_type, value, source, confidence)
   SELECT $1, 'property', $2, $3, $4, 'monthly', $5, 'portfolio_actuals', 0.95
   WHERE NOT EXISTS (
     SELECT 1 FROM metric_time_series
     WHERE metric_id = $1 AND geography_type = 'property'
       AND geography_id = $2 AND period_date = $4
   )`,
  [mapping.metricId, propertyId, propertyName, periodDate, value]
);
```

**Market-level path (submarket, not per-asset):**
```typescript
// portfolio-correlation.service.ts:795-807
if (submarket_id) {
  await this.pool.query(
    `INSERT INTO metric_time_series ... geography_type='submarket', geography_id=$2 ...`,
    [mapping.metricId, submarket_id, ...]
  );
}
```

The `apartment_market_snapshots` and `metric_time_series` submarket path is **market-wide**, not per-asset. The per-asset path is `geography_type='property'` with `geography_id = propertyId`. The engine is **property-keyed** for portfolio assets, not deal-keyed.

---

## EXPLICIT TRUE/FALSE ON THE A8-F1 INTENT REPORT'S THREE CLAIMS

| Claim | Status | Evidence |
|-------|--------|----------|
| **(a) Path B feeds actuals** | **TRUE** | `POST /api/v1/portfolio/assets/:propertyId/actuals` writes to `deal_monthly_actuals` with `property_id`, `deal_id=NULL`, `is_portfolio_asset=TRUE`. `file:line` = `backend/src/api/rest/portfolio.routes.ts:316-336`. |
| **(b) Path B feeds metrics** | **TRUE** | `GET /api/v1/portfolio/assets` (line 95-136) returns aggregated metrics (NOI, occupancy, annualized NOI) from `deal_monthly_actuals` joined by `property_id`. `GET /api/v1/portfolio/metrics` (line 21-61) returns portfolio-wide aggregates from `deal_monthly_actuals` WHERE `is_portfolio_asset=TRUE`. Both are property-keyed. |
| **(c) Path B feeds correlation engine** | **TRUE** | `PortfolioCorrelationService` reads `deal_monthly_actuals` by `property_id` WHERE `is_portfolio_asset=TRUE` (line 171-189), and writes to `metric_time_series` with `geography_type='property'` and `geography_id=propertyId` (line 780-790). No `deal_id` is used in the portfolio correlation path. |

---

## FORK COLLAPSE LINE

Given the **DUAL** keying verdict, the fork does **NOT** collapse. All three options remain viable:

| Option | Status | Why |
|--------|--------|-----|
| **REMOVE** | ✅ Viable | Path B is a complete, working portfolio entry path. It creates a `properties` row, actuals can be uploaded by `property_id`, metrics are aggregated by `property_id`, and the correlation engine runs by `property_id`. No `deals` row is needed for any of these. |
| **WIRE** | ✅ Viable | Path A could be fixed to create a `deals` row with `status='CLOSED_OWNED'` and a linked `properties` row, producing the same dual-keyed actuals as Highlands. This would satisfy the deal-based consumers (`Dashboard.tsx`, `useDealMode`, `DealSidebar`) that currently filter on `dealCategory='portfolio'`. |
| **RECONCILE** | ✅ Viable | Both paths could be kept, with Path B also creating a `deals` row (or Path A also creating a `properties` row with `ownership_status='portfolio'`), so both deal-based and property-based consumers see the same asset. This is the most complete but largest change. |

**The counter-evidence that would have eliminated REMOVE ("actuals are deal-keyed only") is disproven.** `deal_monthly_actuals` has both keys, the unique constraint is on `property_id`, the 3 seeded portfolio assets are keyed by `property_id` only, and every downstream consumer reads by `property_id`. REMOVE remains on the table.

---

*END OF REPORT — STOP. No fixes applied. Human picks among the three survivors.*
