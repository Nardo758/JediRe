# F9 Tier 1 Blockers Audit

**Date:** May 2026  
**Method:** Live DB queries + code trace (file:line evidence throughout)  
**Scope:** Four Tier 1 blockers identified in Phase 0 inventory  
**Deal reference:** 464 Bishop — `3f32276f-aacd-4da3-b306-317c5109b403` (232 units)

---

## ITEM 1 — Purchase price write on deal creation (Tasks #623 / #624)

**Status: FIXED** *(this session)*

---

### Trace — POST / (deal creation) — before fix

`backend/src/api/rest/inline-deals.routes.ts:334`

```sql
INSERT INTO deals (
  user_id, name, boundary, project_type, project_intent,
  target_units, budget, timeline_start, timeline_end, tier, status,
  deal_category, development_type, address, description, org_id
)
VALUES ($1, $2, ..., $7, ...)   -- $7 = budget
RETURNING *
```

`deal_data` was **not touched**. The INSERT had no `deal_data` column and no post-INSERT
JSONB merge. Rows were created with `deal_data = NULL`.

### Trace — PATCH /:id (deal update) — before fix

`backend/src/api/rest/inline-deals.routes.ts:533`

```typescript
const allowedFields: Record<string, string> = {
  name: 'name', ..., budget: 'budget',   // ← writes deals.budget only
};
// UPDATE deals SET ${setClauses} WHERE id = $N
```

`deal_data` was never updated. When `budget` was in the PATCH body,
`deals.budget` was updated and `deal_data.purchase_price` was not.

### Trace — read fallback chain

`backend/src/services/proforma-adjustment.service.ts:2291`

```typescript
const purchasePrice: number | null =
  (dealData.purchase_price != null ? +dealData.purchase_price : null) ??
  (dealData.asking_price   != null ? +dealData.asking_price   : null) ??
  (deal.budget             != null ? +deal.budget              : null);
```

Priority: `deal_data.purchase_price` → `deal_data.asking_price` → `deals.budget`.
The third fallback catches deals where budget is set — **but not if budget is also null**.

### 464 Bishop symptom — confirmed

DB query result:

```
budget | dd_purchase_price | dd_asking_price
-------+-------------------+----------------
  null |              null |           null
```

All three slots null → `purchasePrice = null` → `loanAmount = null` →
`equityAtClose = null` → IRR, EM, CoC all return null.

### Fix applied (Task #623 — POST)

`inline-deals.routes.ts` — after `const row = result.rows[0];`:

```typescript
if (budget) {
  await client.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
     WHERE id = $2`,
    [budget, row.id]
  );
}
```

### Fix applied (Task #624 — PATCH)

`inline-deals.routes.ts` — after main UPDATE RETURNING, before trigger block:

```typescript
if (updates.budget !== undefined && updates.budget != null) {
  await client.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
     WHERE id = $2`,
    [updates.budget, dealId]
  );
}
```

Guard: only fires when `budget` is explicitly in the PATCH body AND non-null. Does not
run on every PATCH — preserves values set by the #617 dedicated dual-write endpoint.

### Verification path

For 464 Bishop: set `budget` via PATCH (or create a new deal with a non-null budget).
On the next `/financials` fetch, `purchasePrice` should be non-null and IRR/EM/CoC
should compute.

---

## ITEM 2 — Unit mix → GPR flag UI (P2-A)

**Status: FIXED** *(this session)*

---

### Backend path — complete before this session

`backend/src/services/proforma-adjustment.service.ts:1776`

```typescript
const useUnitMixForGpr: boolean = _useUnitMixFlagEntry?.value === true;
```

`proforma-adjustment.service.ts:1795` — when flag is on AND `Σ(count × in_place_rent × 12) > 0`:

```typescript
year1Seed.gpr = {
  ...existingGpr,
  unit_mix: gprFromUnitMix,
  resolved: gprFromUnitMix,
  resolution: 'unit_mix',
};
```

Mutation happens before Year-1 rows are built. All downstream consumers
(GPR decomposition, EGI, NOI, projections) see the unit-mix-derived value
through the standard `resolvedNum()` path.

Write path: `PATCH /api/v1/deals/:dealId/financials/override` with
`{ field: 'da:use_unit_mix_for_gpr', value: true }` via the `isFlagField`
branch at `deal-assumptions.routes.ts:1040`.

### Migration risk — zero

DB query:

```
total_with_unit_mix | also_have_year1 | also_have_gpr
--------------------+-----------------+--------------
                  1 |               0 |             0
```

One deal has a non-empty `unit_mix`. That deal has no `year1` seed and no stored GPR.
Zero deals have diverging stored GPR vs unit-mix-derived GPR.

### UI toggle added

`frontend/src/components/deal/sections/UnitMixTab.tsx`

- State: `useUnitMixForGpr` (bool), synced from `data?.rentRollSummary?.useUnitMixForGpr`
  via `useEffect` on data load.
- Toggle handler (`handleToggleUnitMixForGpr`): calls PATCH override, fires `onF9Refresh()`,
  then reloads local data. Optimistically updates local state; reverts on error.
- Disabled when `unitMix.length === 0` (nothing to derive GPR from).
- GPR banner: source badge (`GPR: EXTRACTION` / `GPR: UNIT MIX`) + toggle button
  (`USE UNIT MIX` / `USE EXTRACTION`). Badge and button colors swap on toggle.

---

## ITEM 3 — Ancillary income rollup (P3-A)

**Status: REQUIRES_DEEPER_AUDIT — Phase 0b**

---

### Phase 0b objectives

Resolve the three open questions from Phase 0:

> (a) Are `other_income_monthly` values actually monthly, or pre-annualized?  
> (b) Is `months = 12` in seeder context for this deal?  
> (c) Are concession write-offs merged into the income bucket?

---

### Question (a) — Unit of measure in `other_income_monthly`

**Answer: MONTHLY.** The values in `deal_data.extraction_*.other_income_monthly`
are per-month dollar figures.

Evidence — `proforma-seeder.service.ts:247`:

```typescript
const months = 12;
```

`months` is a module-scoped constant, not deal-specific. All annualization
in the seeder multiplies by `months = 12`.

Evidence — `proforma-seeder.service.ts:316` (`other_rr`):

```typescript
const other_rr = rrOIMObj
  ? Object.values(rrOIMObj)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .reduce((s, v) => s + v, 0) * months
  : null;
```

If the values were already annual, multiplying by 12 would produce a 12×
error. No such systematic inflation is observed in the unit-economics panel,
confirming the values are monthly.

Evidence — `proforma-seeder.service.ts:357` (`oiAnnual`):

```typescript
const oiAnnual = (key: string) => {
  const v = num(oi, key);
  if (v == null || v <= 0) return null;
  return v * months;      // monthly → annual
};
```

Similarly `omAnnual` (`seeder:326`): `return v != null ? v * months : null;`

**Conclusion for (a):** Values are monthly. Seeder correctly annualizes by `* 12`.

---

### Question (b) — `months = 12` confirmed

**Answer: YES.** `months = 12` at `proforma-seeder.service.ts:247`.
Module-level constant; same value for every deal.

---

### Question (c) — Concession write-offs in income bucket

**Answer: HANDLED BY GUARD.** The rent-roll `other_income_monthly.other` field
for 464 Bishop contains `−56,812.69` (a large negative, likely a concession
write-off or credit leaking into the income bucket). The seeder excludes it via:

`proforma-seeder.service.ts:358`:

```typescript
if (v == null || v <= 0) return null;
```

The guard coerces any ≤ 0 per-category RR value to null, causing the resolver
to fall through to OM. For 464 Bishop's `other` category:
- RR `other` = −56,813 → excluded (guard fires)
- OM `other` = 100/month → 1,200/year → used instead

The `other_rr` aggregate sum also correctly excludes this value since the filter
is `typeof v === 'number' && v > 0` (`seeder:319`).

---

### Critical finding — seeder is a cache (no-op when `year1` exists)

`proforma-seeder.service.ts:856` (`ensureDealAssumptionsSeeded`):

```typescript
const hasExistingSeed = existing.rows[0]?.year1 != null;

if (hasExistingSeed && !opts.forceReseed) {
  return { seeded: false, skipped: true, reason: 'year1 already seeded' };
}
```

`proforma-adjustment.service.ts:1730`:

```typescript
// Auto-seed if year1 is missing — No-op when year1 already exists; safe to call on every request
await ensureDealAssumptionsSeeded(pool, dealId);
```

**The seeder only runs once per deal.** After the initial seed, every `/financials`
request reads the cached `year1` JSONB from `deal_assumptions` and applies user
overrides on top. The seeder **does not re-run** when extraction data changes or
when seeder code is updated (unless `forceReseed: true` is passed, which no
production caller currently does).

---

### Arithmetic discrepancy for 464 Bishop — root cause identified

**Phase 0 finding:** manual reconstruction of `breakdownSum` gave 25.35/unit/month,
but DB shows `other_income_per_unit.resolved = 75.34`.

**Phase 0b resolution:** The stale-cache effect explains the discrepancy.

464 Bishop's `year1` was seeded **before Task #519** added the breakdown-sum
override (seeder lines 619–635). The cached `resolved = 75.34` reflects the
pre-Task-#519 calculation (exact logic unknown — likely driven by T-12 data
and a different weighting than today's code). After Task #519 merged, the
seeder's new override code is correct but has **not run for 464 Bishop** because
`hasExistingSeed = true`.

Evidence: `year1.other_income_per_unit.updated_at = 2026-05-07T20:26:20.607Z`.
This timestamp does NOT reflect a full seeder re-run — it reflects a user
override application (`applyUserOverride` updates the LayeredValue in place
without running the full seeder pipeline).

**The Task #519 fix is correct in code but has not propagated to existing deals.**

---

### Arithmetic trace with confirmed units (what seeder WOULD produce if re-run today)

464 Bishop extraction data:

| Category | RR (monthly) | RR coerced | OM (monthly) | Winner | Annual |
|---|---|---|---|---|---|
| parking | 0 | null | 3,000 | OM | 36,000 |
| pet | 720 | 8,640/yr | 700 | RR | 8,640 |
| storage | 410 | 4,920/yr | 500 | RR | 4,920 |
| rubs | 0 | null | 800 | OM | 9,600 |
| fees | 0 | null | 600 | OM | 7,200 |
| laundry | (absent) | null | 250 | OM | 3,000 |
| insurance_admin | 0 | null | 0 | null | 0 |
| other | −56,813 | null (≤0) | 100 | OM | 1,200 |

**breakdownSum = 70,560/year**  
**`other_income_per_unit.resolved` = 70,560 / 232 / 12 = 25.35/unit/month**  
**Pro forma annual = 25.35 × 232 × 12 = 70,558/year** ✓

Stored (stale cache): 75.34/unit/month → 209,747/year (3× the correct value).

---

### Pro forma dollarization confirmed

`proforma-adjustment.service.ts:1933`:

```typescript
const _otherIncMul = totalUnits > 0 ? totalUnits * 12 : null;
```

`proforma-adjustment.service.ts:1943`:

```typescript
toDollarRow('other_income_per_unit', 'other_income', 'Other Income', _otherIncMul),
```

The `other_income_per_unit` field is treated as **monthly per unit** by the
pro forma engine. The unit stored in `year1.other_income_per_unit.resolved`
must be monthly per unit for the annual total to be correct.

The Task #519 override at `seeder:634` correctly produces monthly per unit:
`breakdownSum / totalUnits / months`. No unit conversion error in the code.

**The only error is that this code path has not run for existing deals
because of the seeder cache.**

---

### Initial layer unit mismatch (latent bug, non-blocking)

The `rent_roll` and `om` layers of `other_income_per_unit` are initialized as
**annual per unit** (not monthly):

`seeder:341`:
```typescript
rent_roll: other_rr != null && totalUnits > 0 ? other_rr / totalUnits : null,
```

Where `other_rr = Σ(monthly) × 12`. So `rent_roll` layer = annual total / units
= annual per unit. If this layer were ever used as `resolved` directly (without
the Task #519 override running), the pro forma would compute 12× the correct
income (`annual_per_unit × units × 12 = 12× annual_total`).

**The Task #519 override is therefore the critical safeguard** that converts from
annual-per-unit (seeder initial layer) to monthly-per-unit (pro forma expectation).
If `forceReseed` is not added, any existing deal seeded before Task #519 may
show 12× or otherwise incorrect other income figures.

---

### Fix scope for next session

#### Part A — forceReseed trigger (extraction pipeline only)

**Where to fire `forceReseed: true`:** In the extraction pipeline after any
capsule is written — `processDealDocuments` (or equivalent) after it persists
`deal_data.extraction_t12`, `extraction_rent_roll`, or `extraction_om`. The
model is "extraction changed → derived values recompute."

**Where NOT to fire it:**

| Caller | Why not |
|---|---|
| Every `/financials` fetch | Defeats the cache; re-running the seeder on every request causes unnecessary DB writes and latency |
| Operator override handler | `applyUserOverride` mutates the LayeredValue in-place on top of the existing seed. forceReseed would clobber all other layers, discarding the user's carefully set overrides on unrelated fields |
| Manual admin trigger only | Leaves the system in an inconsistent state on any extraction re-run — the seeder cache silently diverges from extraction data |

Implementation sketch:

```typescript
// At the END of processDealDocuments, after writing extraction capsule(s):
await ensureDealAssumptionsSeeded(pool, dealId, { forceReseed: true });
```

This is safe because extraction updates are infrequent (document upload /
re-processing events), and `forceReseed` only skips the `hasExistingSeed`
guard — it still applies all user overrides on top via the existing
`applyUserOverride` mechanism after re-seeding.

#### Part B — one-time backfill script (pre-Task-#519 deals)

**Scope:** Deals where `year1` was seeded before Task #519 merged and where
`other_income_per_unit` is therefore stale.

**Criteria for "needs reseed"** — a deal qualifies if ALL of the following are true:

1. `deal_assumptions.year1 IS NOT NULL` (has a seed to compare against)
2. `(deal_data->'extraction_rent_roll') IS NOT NULL OR (deal_data->'extraction_om') IS NOT NULL`
   (has ancillary source data — otherwise there is nothing to recompute)
3. `(deal_assumptions.year1->'other_income_per_unit'->>'updated_at') < '<Task-#519-merge-timestamp>'`
   OR the `resolution` is `'rent_roll'` or `'om'` with a `resolved` value that
   is a whole-number multiple of `12` of the expected monthly value (heuristic
   for the 12× error pattern)

**Safe execution:** The backfill script should call `seedProFormaYear1(pool,
dealId)` with `forceReseed: true` for each qualifying deal, log before/after
values for `other_income_per_unit.resolved`, and commit per-deal so a failure
mid-run does not block others.

**This is a data migration script, not a schema migration.** It lives in
`backend/scripts/` alongside `enrich-property-proximity.ts`, follows the same
`--dry-run` / `--dealId` flag pattern, and is re-runnable (idempotent after the
first run because the extraction pipeline forceReseed keeps things current
going forward).

---

## ITEM 4 — LP/GP split cross-reference displays (P2-B)

**Status: FIXED** *(this session)*

---

### Decision recorded

Tranche-derived path stays canonical. WaterfallTab (`WaterfallTab.tsx:477`) is the
sole write surface for LP/GP split. No duplicate dial added.

Write path confirmed:
`WaterfallTab.tsx:477` → `patchWf(dealId, 'lpShare', newLp)` →
`PATCH /financials/override` with `field: 'wf:lpShare'` →
`deal-assumptions.routes.ts:1036` (isStrField/numeric branch) →
`per_year_overrides['wf:lpShare']` → read at
`proforma-adjustment.service.ts:3049`: `wfOvr('lpShare') ?? 0.9`.

### Cross-reference displays added

**Deal Terms tab** (`frontend/src/pages/development/financial-engine/DealTermsTab.tsx`)

Replaced the `§ 4 TODO` comment block with a read-only LP/GP split card:
- Section header "§ 4  LP / GP SPLIT" with "Edit in WATERFALL →" link
  (`props.onTabChange?.(4)`)
- Two rows: "LP Equity Share" and "GP Equity Share" sourced from
  `fin?.waterfall?.lpShare` and `fin?.waterfall?.gpShare`
- Shows "—" when waterfall not yet configured

**Returns tab** (`frontend/src/pages/development/financial-engine/ReturnsTab.tsx`)

In §4 GP RETURNS:
- Added new "LP Equity Share" row (`wf?.lpShare`) above the existing GP row
- Added "Edit in WATERFALL →" link row below GP Equity Share, before Preferred Return
  (`onTabChange?.(4)`)

Both displays are read-only. WaterfallTab remains the only write path.
