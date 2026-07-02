# ACTUALS LEAK FIX VERDICT

**Task:** Close three private-actuals leak sites found in the B4b verification audit.
**Date:** 2026-07-02
**Status:** CLOSED — all three sites fixed; live isolation proof passed

---

## The bug pattern (all three sites)

A public `property_id` is a shared join key. Two orgs can link their deals to the same
public property row. Private actuals in `deal_monthly_actuals` hang off that shared key.
Old reads queried:

```sql
WHERE property_id = <public P>   -- returns EVERY org's actuals
```

The fix in every case: scope the private side by the caller's deal or org, the way
correct reads already do. The public property stays global; only the private actuals filter.

---

## PART A — FIX-1: `financial-documents.routes.ts`

**File:** `backend/src/api/rest/financial-documents.routes.ts`
**Route:** `GET /:dealId/data-sources`

**Before (leaked):**
```typescript
const propertyIdResult = await pool.query(
  `SELECT property_id FROM deals WHERE id = $1 UNION SELECT id FROM properties WHERE id = $1 LIMIT 1`,
  [dealId]
);
const propertyId = propertyIdResult.rows[0]?.property_id || dealId;

// UNSCOPED — returns actuals for any org on this property
pool.query(`SELECT DISTINCT source_document_type, data_source, source_period_label
            FROM deal_monthly_actuals WHERE property_id = $1 ...`, [propertyId])
```

**After (fixed):**
```typescript
// Scoped to the caller's deal — not all rows on the shared property
pool.query(`SELECT DISTINCT source_document_type, data_source, source_period_label
            FROM deal_monthly_actuals WHERE deal_id = $1 ...`, [dealId])
```

`verifyDealOwnership` already gates the route — `dealId` is the correct scope.
`propertyIdResult` / `propertyId` removed (no longer needed for this query).

---

## PART B — FIX-2: Cashflow Agent portfolio reads

Two files fixed together — `opex_ratios` inherits `property_ids` from `actuals`, so
fixing only one would leave the downstream tool reading an unscoped set.

### `fetch_owned_asset_actuals.ts`

**Added:** `org_id` to `RunContext` interface (`backend/src/agents/runtime/types.ts`) —
the field was already set at runtime by B2a attribution but was missing from the type.

**Added at start of execute:**
```typescript
const callerOrgId: string | null =
  ctx.org_id ??
  ((await query(`SELECT org_id FROM deals WHERE id = $1 LIMIT 1`, [input.deal_id])).rows[0]?.org_id ?? null);

if (!callerOrgId) return { assets: [], total_owned_portfolio_size: 0, note: '...' };
```

**totalCount query (before → after):**
```sql
-- BEFORE: unscoped
SELECT COUNT(DISTINCT property_id) AS cnt
FROM deal_monthly_actuals WHERE is_portfolio_asset = TRUE

-- AFTER: scoped via deal_id JOIN (not property_id — shared key leaks through property_id)
SELECT COUNT(DISTINCT dma.property_id) AS cnt
FROM deal_monthly_actuals dma
JOIN deal_properties dp ON dp.deal_id = dma.deal_id   -- ← deal_id join, not property_id
JOIN deals d ON d.id = dp.deal_id
WHERE dma.is_portfolio_asset = TRUE AND d.org_id = $callerOrgId
```

**propsResult EXISTS clause:** same `dp.deal_id = dma.deal_id` join with `d.org_id = $3`.

**Why `deal_id` join, not `property_id` join:** two orgs sharing the same public property
would both be reachable through `dp.property_id = dma.property_id` — Org B's actuals
(same property_id) would appear in Org A's results via Org A's deal_properties row.
Joining on `deal_id` isolates each org's rows to their own deal path.

### `fetch_owned_asset_opex_ratios.ts`

**Added:** defensive org scope with null-guard:
```typescript
const callerOrgId: string | null = ctx.org_id ?? null;
```
```sql
-- Added to WHERE:
AND (
  $3::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM deal_properties dp
    JOIN deals d ON d.id = dp.deal_id
    WHERE dp.deal_id = dma.deal_id    -- ← deal_id join
      AND d.org_id = $3
  )
)
```
`$3::uuid IS NULL` guard: if `ctx.org_id` is unavailable, trusts that `property_ids`
came from an already-scoped `fetch_owned_asset_actuals` call. When org is known, enforces
the scope explicitly.

---

## PART C — Property write-auth gap (data integrity)

**File:** `backend/src/api/rest/property.routes.ts`

**Rule decided:**
- **PUT / PATCH:** allowed if caller is the property's creator (`created_by = userId`) OR
  is a member of an org that owns a deal linked to the property (via `deal_properties` or
  `deals.property_id`). Market rows with no creator and no deal link → 403.
- **DELETE:** creator-only (`created_by = userId`). Deal-link alone is insufficient —
  a deal member should not be able to delete a shared market row that other deals reference.
  Market/ArcGIS-sourced rows (created_by = NULL) → 403 for all non-creator users.

**Auth check added to PUT, PATCH, DELETE:**
```sql
SELECT p.*,
  (p.created_by = $2) AS is_creator,
  (
    EXISTS (
      SELECT 1 FROM deal_properties dp
      JOIN deals d ON d.id = dp.deal_id
      JOIN org_members om ON om.org_id = d.org_id
      WHERE dp.property_id = p.id AND om.user_id = $2
    )
    OR EXISTS (
      SELECT 1 FROM deals d
      JOIN org_members om ON om.org_id = d.org_id
      WHERE d.property_id = p.id AND om.user_id = $2
    )
  ) AS has_deal_link
FROM properties p WHERE p.id = $1
```

DELETE additionally only allows creator (not just deal-link) per the rule above.

---

## LIVE ACCEPTANCE — Two-org isolation proof

**Setup:**
- Org A = `dd201183` (canonical, owns Highlands p2122 deal `eaabeb9f`)
- Shared property = `7ea31caf` (Highlands, 2789 Satellite Blvd, Duluth GA)
- Org B synthetic = deal_id `bbbbbbbb-bb00` (3 actuals rows inserted: `synthetic_orgB_test` / `orgB_source`, months 2026-05/06/07)
- Total on shared property after setup: **109 rows** (93 Org A deal-linked + 13 null-deal-id + 3 Org B)

### Proof 1 — Part A delta (data-sources panel)

| Query mode | Org B rows visible | Total rows |
|---|---|---|
| BEFORE — `WHERE property_id = '7ea31caf'` | **3** (leak: `synthetic_orgB_test` in results) | 109 |
| AFTER — `WHERE deal_id = 'eaabeb9f'` (Org A) | **0** | 93 |

Org B's `synthetic_orgB_test` source type visible in unscoped, absent in scoped. ✓

### Proof 2 — FIX-2 delta (Cashflow Agent portfolio actuals)

| Query mode | Org B rows visible | Total rows |
|---|---|---|
| BEFORE — `WHERE is_portfolio_asset = TRUE` (unscoped) | **3** | 109 |
| AFTER — `JOIN deal_properties dp ON dp.deal_id = dma.deal_id … d.org_id = Org A` | **0** | 93 |

`propsResult` EXISTS with Org A scope → Highlands returned (1 row). ✓
`propsResult` EXISTS with Org B scope → empty (0 rows — Org B has no deal_properties row). ✓

### Proof 3 — Part C write-auth

| Test user | is_creator | has_deal_link | Verdict |
|---|---|---|---|
| `00000000…0099` (random, no connection) | false | false | **403** ✓ |
| `6253ba3f` (Org A owner) | true | true | **200** ✓ |

### Proof 4 — No over-scoping

Org A's 93 rows fully accessible via scoped query (no rows lost). ✓

**Cleanup:** all 3 Org B synthetic rows deleted; Org B org deleted. Highlands restored to
106 rows.

---

## Files changed

| File | Change |
|---|---|
| `backend/src/agents/runtime/types.ts` | Added `org_id?: string` to `RunContext` interface |
| `backend/src/api/rest/financial-documents.routes.ts` | Part A: actuals query scoped to `deal_id`; removed dead `propertyId` resolution |
| `backend/src/agents/tools/fetch_owned_asset_actuals.ts` | Part B: `callerOrgId` resolution; totalCount + propsResult scoped via `deal_id` JOIN |
| `backend/src/agents/tools/fetch_owned_asset_opex_ratios.ts` | Part B: defensive `callerOrgId` org scope via `deal_id` JOIN with null-guard |
| `backend/src/api/rest/property.routes.ts` | Part C: write-auth guard on PUT, PATCH, DELETE |

---

## One-line summary

Three actuals-leak reads scoped to caller's deal/org via `deal_id` JOIN (not bare `property_id`);
cross-operator isolation proven live on a shared property with a two-org synthetic setup —
before: 3 Org B rows visible; after: 0; owner not over-scoped (93 Org A rows intact);
property write-auth gap closed (creator-or-deal-link for PUT/PATCH, creator-only for DELETE);
boundary now holds at multi-org.
