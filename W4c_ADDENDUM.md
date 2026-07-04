# W4c Addendum: `deal_assumptions.year1.noi` JSON-Path Enumeration + Blob Semantics

## Checkpoint: Commit `cfcc31f57` + W4b additions

---

## Part A: The `deal_assumptions.year1.noi` Blob — Where It Lives

The blob is **not** a literal string `deal_assumptions.year1.noi` in code. It is a **JSON path** into the `ProFormaYear1Seed` object, persisted as `deal_assumptions.year1` (PostgreSQL JSONB) and `scenario_year1.year1` (scenario layer). Code accesses it as `year1Seed['noi']`, `year1.noi`, or via the `rv(year1.noi)` helper.

### Construction Site: `proforma-seeder.service.ts:buildSeed()`

```typescript
// Lines ~2760-2789 (in recomputeDerived, called at seed time and after overrides)
const noi = egi - opex;
if (seed.noi) {
  seed.noi.resolved = noi;
  seed.noi.updated_at = ts;
}
if (seed.noi) seed.noi.resolution = 'computed' as any;
```

**What goes into this `noi`:**
- `gpr` = resolved from T-12, rent roll, or OM (priority: T-12 > rent_roll)
- `lossToLeasePct` = resolved from T-12 or rent roll
- `vacancyPct` = resolved from rent roll or T-12
- `concessionsPct`, `badDebtPct` = resolved from T-12
- `otherIncome` = sum of per-category breakdown + user lines
- `opex` = sum of all T-12/platform opex lines + management fee

**Critical: This `noi` is the in-place-derived figure.** It uses **actual occupancy** (from rent roll or T-12), **actual in-place rents** (from rent roll weighted average), and **actual opex** (from T-12). It does NOT apply any turn-cohort dynamics, absorption pacing, or rent growth. It is the **left edge** of the M09 bridge — the m0 run-rate annualized.

### The LayeredValue Shape

```typescript
year1.noi = {
  resolved: 840231.07,        // ← egi - opex (in-place-derived)
  resolution: 'computed',      // ← set by recomputeDerived
  t12: 850000,                 // ← T-12 annualized NOI (if parsed)
  rent_roll: 820000,           // ← rent-roll derived NOI (if available)
  om: 1200000,                 // ← broker proforma NOI (stabilized claim)
  platform: 2675264.85,        // ← platform baseline NOI (stabilized-class)
  override: null,              // ← user override (wins if set)
  updated_at: '2026-01-15T...',
}
```

**The semantic mess the ruling identified:** `resolved` is an **in-place-derived** figure (~$840K), while `platform` and `om` are **stabilized-class** claims (~$2.7M and ~$1.2M). All three live in the same field. Downstream consumers that read only `resolved` get the in-place number; consumers that read `platform` or `om` get stabilized numbers. The ramp target (see Part C) reads `resolved`, which is correct for a ramp **origin**, but the code then treats it as the **stabilized target** — that's the bug.

---

## Part B: All Readers of `deal_assumptions.year1.noi` (JSON-Path Access)

| File | Line | Access Pattern | What It Reads | Semantics |
|---|---|---|---|---|
| `proforma-seeder.service.ts` | 2780 | `seed.noi.resolved = noi` | **WRITES** the blob | In-place-derived egi-opex |
| `proforma-seeder.service.ts` | 2806+ | `rv(year1.noi)` in `buildAssumptionsFromYear1Seed` | `year1.noi.resolved` | Returns in-place-derived NOI to bridge |
| `proforma-assumptions-bridge.ts` | 137 | `addHint('noi', seed.noi, ...)` | `seed.noi.resolved` | Evidence hint for evidence block |
| `proforma-assumptions-bridge.ts` | ~489 | `llm.summary?.noiYear1` | NOT the seed — reads LLM output | Separate path |
| `proforma/periodic-seeder.service.ts` | 105 | `resolved_noi: resolvedNoi` | Last actual NOI from T-12 | **In-place figure** used as ramp base |
| `gap-bridge.service.ts` | 224 | `seed._meta.resolved_noi` | `resolved_noi` from periodic seed | **In-place figure** used as ramp **target** |
| `financial-model-engine.service.ts` | 736 | `(deal_data->>'noi_year1')::float` | `deal_data.noi_year1` | **T-12 annualized** (pre-model) |
| `agents/tools/fetch_assumptions.ts` | varies | `year1['noi'].resolved` | Snapshot read | In-place-derived |
| `agents/tools/fetch_cashflow_snapshot.ts` | 125 | `extractNum('noi_year1') ?? extractNum('noi')` | DB column or JSON | Pre-model or model-computed |
| `stabilization-recheck.service.ts` | varies | `year1.noi` or `snapshot.noi` | Seed or snapshot | In-place-derived |
| `roadmap/roadmap-engine.ts` | 270 | `snapshotField(pf, 'noi_year1', 'noi', 'revenue.noi')` | Pro forma snapshot | Stored assumption (pre-model or computed) |

---

## Part C: The Ramp-Target Read — `deriveProjectionForSeed` Verified

### Location
`backend/src/services/proforma/gap-bridge.service.ts:213-227`

### Code
```typescript
export function deriveProjectionForSeed(
  seed: ProFormaPeriodicSeed,
  trends: GapTrendAssumptions = DEFAULT_GAP_TRENDS,
  stabilization?: { monthsToStabilization: number; resolution: string },
): ProFormaPeriodicSeed {
  // ...
  const stabilizedMonthlyNoi = seed._meta?.resolved_noi != null
    ? seed._meta.resolved_noi / 12
    : null;

  for (const [fieldName, series] of Object.entries(seed.fields)) {
    const ramp = (fieldName === 'noi' && stabilization && stabilizedMonthlyNoi != null)
      ? { stabilizedMonthly: stabilizedMonthlyNoi, monthsToStabilization: stabilization.monthsToStabilization }
      : undefined;
    newFields[fieldName] = deriveProjectionSeries(series, trends, ramp);
  }
  // ...
}
```

### Where `resolved_noi` Comes From
`backend/src/services/proforma/periodic-seeder.service.ts:95-105`
```typescript
const resolvedNoi = fields.noi?.periods
  .filter(p => p.zone === 'actual')
  .map(p => p.resolved)
  .filter((v): v is number => v != null)
  .pop() ?? null;
```

**This is the LAST ACTUAL NOI** — the most recent T-12/actual period's NOI. It is the **in-place figure** (actual occupancy, actual rents, actual opex).

### The Bug
`deriveProjectionForSeed` uses this in-place figure as the **`stabilizedMonthly` target** for the ramp. The variable is even named `stabilizedMonthlyNoi`, but it contains the **in-place** number. The ramp therefore targets the wrong endpoint — it thinks it's ramping to stabilization, but it's actually ramping to the acquisition-state run-rate.

**For Highlands-type inputs (100% occupied):** in-place ≈ stabilized, so the bug is latent.
**For lease-up inputs (70% occupied):** in-place ($840K) ≪ stabilized ($2.7M), so the ramp undershoots by ~3.2×.

### W5 Ribbon Check Must Confirm
The W5 acceptance run must verify:
1. If `deriveProjectionForSeed` is still called for deals with engine-months available
2. Whether the seed's projection values equal the engine's monthly NOIs (source tag + value equality)
3. If the old ramp still runs, whether `stabilizedMonthlyNoi` is sourced from `resolved_noi` (in-place) or from a true stabilized endpoint

---

## Part D: Issue-5 Persist-Path Trace — **NOT a W5 Blocker**

### The Query
`backend/src/services/financial-model-engine.service.ts:730-745`
```typescript
const noiRow = await pool.query<{ noi: string | null }>(
  `SELECT COALESCE(
     (deal_data->'extraction_t12'->>'noi_year1')::float,
     (deal_data->>'noi_year1')::float,
     (deal_data->>'noi')::float
   ) AS noi FROM deals WHERE id = $1`,
  [dealId]
);
const year1NOI = raw != null ? parseFloat(String(raw)) : null;
```

### What This Is Used For
```typescript
const exitResult = await exitSvc.derive(
  { goingInCapRate: goingInCap, holdPeriod, state, dealMode, assetClass, submarket },
  year1NOI,  // ← T-12 annualized, passed to exit strategy service
);
```

**This `year1NOI` is ONLY used for terminal value computation** (`exitSvc.derive`). It is a **local variable**, not persisted into the model results.

### The Acceptance Read Path (`/latest`)
`backend/src/api/rest/financial-model.routes.ts:576`
```typescript
router.get('/:dealId/latest', async (req, res) => {
  const model = await financialModelEngine.getLatestModel(dealId);
  return res.json({ success: true, data: model });
});
```

`getLatestModel` (`financial-model-engine.service.ts:1869`):
```typescript
const result = await pool.query(
  `SELECT assumptions, results, created_at, assumptions_hash
   FROM deal_financial_models
   WHERE deal_id = $1 AND status = 'complete'
   ORDER BY created_at DESC LIMIT 1`
);
return {
  assumptions: JSON.parse(row.assumptions),
  results: JSON.parse(row.results),  // ← THIS IS THE RUNNER'S OUTPUT
  // ...
};
```

**Conclusion:** The `/latest` route serves `deal_financial_models.results`, which is the **runner's `ModelResults` JSON** — including `summary.noiYear1` (the emergent turn-cohort Y1 aggregate). The T-12 overwrite at line 736 is **never persisted** into `deal_financial_models`. It is used only for a local `exitSvc.derive()` call.

**Issue 5 rides to P1** as originally labeled. No W5 blocker.

---

## Part E: Three-Quantity Discipline Applied to the Blob

| Quantity | Where in Blob | Who Sets It | Who Reads It |
|---|---|---|---|
| **In-Place Endpoint** | `year1.noi.resolved` (egi - opex from actuals) | `recomputeDerived()` in seeder | `buildAssumptionsFromYear1Seed` → bridge → runner `inPlaceNOI` |
| **Y1 NOI (emergent)** | `ModelResults.summary.noiYear1` (NOT in blob) | `runModel()` turn-cohort engine | `/latest` route, agents, dashboards |
| **Stabilized Endpoint** | `year1.noi.platform` / `year1.noi.om` | Platform baseline / broker proforma | Currently **orphaned** — no reader uses these for disposition |

**The gap:** The blob's `platform` and `om` slots hold stabilized-class figures, but `deriveProjectionForSeed` reads `resolved_noi` (from actuals) instead of `platform` or `om` for the ramp target. The stabilized endpoint exists in the blob but is not consumed by the ramp machinery.

---

## Part F: W5 Precondition Checklist (Derived from W4c)

Before W5 Phase 1 (acceptance re-run):

- [ ] **Verify ribbon source tags**: Check that seed projection values carry `source: 'engine_monthly'` (or similar) when engine months are available, vs `source: 'derived_projection'` (old ramp)
- [ ] **Highlands canary**: Ensure 100% occupied deal shows `source: 'engine_monthly'` in periodic seed, NOT `'derived_projection'`
- [ ] **Lease-up shape check**: Ensure 70% occupied deal's monthly NOI trajectory matches turn-cohort engine (climbing), not old ramp (flat from in-place base)
- [ ] **Value equality**: Compare `seed.fields.noi.periods[i].resolved` against `ModelResults.monthlyCashFlow[i].noi` for months 1-36
- [ ] **Dead-code confirmation**: `deriveProjectionForSeed` should NOT run when engine months are available (or should use engine months instead of `resolved_noi`)

---

## Summary

| Finding | Status |
|---|---|
| `deal_assumptions.year1.noi` blob documented | ✅ W4c complete |
| Blob semantics: `resolved` = in-place, `platform`/`om` = stabilized | ✅ Documented |
| `deriveProjectionForSeed` ramp target = `resolved_noi` (in-place) | ✅ Verified — **this is the ramp bug** |
| Issue-5 persist path: T-12 NOT persisted into model results | ✅ Traced — **not a W5 blocker** |
| Old ramp should be dead code if engine months available | ⬜ **W5 verification required** |
| `inPlaceNOI` from runner should feed roadmap `baseNoi` | ⬜ F-P1 (Issue 1 from W4b) |

---

*W4c addendum complete. Ready for W5 signal.*
