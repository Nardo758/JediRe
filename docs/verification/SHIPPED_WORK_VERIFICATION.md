# Shipped Work Verification Report

Generated: 2026-04-29
Scope: Verify 3 recently-shipped items are correctly wired in the codebase.
Classification: CODE-VERIFIED (DB-level confirmation requires live DB access).

---

## Item 1 — Purchase price dual-write on creation/PATCH (#623 / #624)

### Status: VERIFIED_LIVE (code level)

**POST /api/v1/deals (creation)** — `backend/src/api/rest/inline-deals.routes.ts:466-478`

```ts
// Task #623 — Dual-write purchase_price into deal_data so the proforma
// fallback chain (deal_data.purchase_price → deal_data.asking_price →
// deals.budget) finds a value immediately.
if (budget) {
  await client.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
     WHERE id = $2`,
    [budget, row.id]
  );
}
```

**PATCH /api/v1/deals/:id** — `backend/src/api/rest/inline-deals.routes.ts:778-789`

```ts
// Task #624 — Dual-write purchase_price to deal_data when budget is
// explicitly in the PATCH body.
if (updates.budget !== undefined && updates.budget != null) {
  await client.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}') || jsonb_build_object('purchase_price', $1::numeric)
     WHERE id = $2`,
    [updates.budget, dealId]
  );
}
```

**Verification:** Both paths write `purchase_price` into `deal_data` JSONB when `budget` is present. The fallback chain (proforma seeder → `deal_data.purchase_price` → `deals.budget`) is wired. No DB gaps detected at code level.

**DB-level gap:** Would need to create a synthetic deal and query both `deals.budget` and `deals.deal_data->>'purchase_price'` to confirm they match.

---

## Item 2 — Unit mix → GPR toggle (#P2-A)

### Status: VERIFIED_LIVE (code level) — WITH CAVEAT

**Toggle read path** — `backend/src/services/proforma-adjustment.service.ts:2247-2298`

```ts
const _useUnitMixFlagEntry = _rawPyOvsForFlag['da:use_unit_mix_for_gpr'];
const useUnitMixForGpr: boolean = _useUnitMixFlagEntry?.value === true;
```

**GPR computation with floor_plan_mix fallback** — `backend/src/services/proforma-adjustment.service.ts:2258-2296`

```ts
let _rawUnitMixForGpr: Array<Record<string, unknown>> | null = null;
const _umColumn = assumptionsRes.rows[0]?.unit_mix;
if (Array.isArray(_umColumn) && _umColumn.length > 0) {
  _rawUnitMixForGpr = _umColumn as Array<Record<string, unknown>>;
} else {
  const _fpm = rrCapsule?.floor_plan_mix as Record<string, unknown> | undefined;
  if (_fpm && typeof _fpm === 'object' && Object.keys(_fpm).length > 0) {
    _rawUnitMixForGpr = Object.entries(_fpm).map(([planName, v]) => {
      const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
      return {
        type:          planName,
        count:         d.count ?? 0,
        in_place_rent: d.avg_effective_rent ?? null,
        market_rent:   (d.avg_market_rent != null && +(d.avg_market_rent as number) > 0) ? d.avg_market_rent : null,
      } as Record<string, unknown>;
    });
  }
}

// ... computes gprFromUnitMix = Σ(count × in_place_rent × 12)

if (useUnitMixForGpr && gprFromUnitMix != null && gprFromUnitMix > 0) {
  // Mutates year1Seed.gpr to add 'unit_mix' layer and force resolution = 'unit_mix'
}
```

**Verification:**
- ✅ Toggle flag is read from `per_year_overrides['da:use_unit_mix_for_gpr']`
- ✅ `deal_assumptions.unit_mix` is the primary source
- ✅ `extraction_rent_roll.floor_plan_mix` fallback exists and is converted to the same array shape
- ✅ When toggle is ON and GPR is finite, `year1Seed.gpr` gets a `unit_mix` layer with resolution forced to `'unit_mix'`

**Caveat:** The floor_plan_mix fallback was already present in the code when this verification was run. The task file (TASK 1 from unit-mix investigation) described this as a missing fix, but the codebase already includes it at lines 2268–2281. This may have been fixed in a prior session that wasn't reflected in the task file.

**DB-level gap:** Would need to toggle ON on a real deal and query `deal_assumptions.year1->>'gpr'` to confirm `resolution = 'unit_mix'` and `resolved ≈ predicted value`.

---

## Item 3 — Extraction pipeline forceReseed hook (Part A)

### Status: VERIFIED_LIVE (code level)

**Hook location** — `backend/src/services/document-extraction/data-router.ts:1773-1806`

```ts
const INCOME_CAPSULE_KEYS = ['extraction_t12', 'extraction_rent_roll', 'extraction_om', 'extraction_tax_bill'];
const hasIncomeCapsule = INCOME_CAPSULE_KEYS.some(k => k in capsulePayload);
if (hasIncomeCapsule) {
  try {
    await ensureDealAssumptionsSeeded(pool, dealId, { forceReseed: true });
  } catch (err) {
    console.warn(
      `[data-router] forceReseed after capsule write failed for ${dealId}:`,
      err instanceof Error ? err.message : err
    );
  }
  // Phase 2 DQA: after reseed, auto-discover null year1 slots
  setImmediate(() => {
    runDataQualityAgentAfterReseed(pool, dealId).catch(() => {});
  });
}
```

**Verification:**
- ✅ Triggered after `extraction_t12`, `extraction_rent_roll`, `extraction_om`, or `extraction_tax_bill` writes
- ✅ Calls `ensureDealAssumptionsSeeded(pool, dealId, { forceReseed: true })`
- ✅ The seeder preserves operator overrides (resolution = 'override') before recomputing
- ✅ DQA agent runs after reseed to catch gaps

**Key design note:** The forceReseed path explicitly skips the "year1 already exists" guard, but `seedProFormaYear1` reads the existing year1 first, preserving all operator override layers. This prevents clobbering unrelated overrides.

**DB-level gap:** Would need to upload a rent roll to a test deal and query `deal_assumptions` before/after to confirm `other_income_per_unit` refreshed and unrelated overrides stayed intact.

---

## Summary Classification

| Item | Code Status | DB Status | Classification |
|------|-------------|-----------|----------------|
| #623 Dual-write | ✅ Present | Unverified | CODE-VERIFIED |
| #P2-A GPR toggle | ✅ Present (including floor_plan_mix fallback) | Unverified | CODE-VERIFIED |
| Part A forceReseed | ✅ Present | Unverified | CODE-VERIFIED |

**Recommendation:** All three items are correctly wired in the codebase. DB-level verification is deferred until a live test environment or staging database is available. No code changes required.
