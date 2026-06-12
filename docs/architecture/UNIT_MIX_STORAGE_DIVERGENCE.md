# UNIT_MIX_STORAGE_DIVERGENCE.md

**Scope:** Inventory the 5 (or more) write paths to unit-mix-related storage, document their consumers, and propose a canonical resolution.

**Date:** 2026-04-29

---

## 1. Inventory Table

| # | Service | File | Write Target | Trigger | Downstream Consumers |
|---|---------|------|-------------|---------|---------------------|
| 1 | **Extraction Pipeline** | `document-extraction/data-router.ts` | `deals.deal_data->extraction_rent_roll->floor_plan_mix` | Document upload + parse | Proforma adjustment, financials composer, proforma seeder |
| 2 | **Manual Unit Mix Builder** | `api/rest/unit-mix-propagation.routes.ts` | `deal_assumptions.unit_mix` (SQL column) | User clicks ADD TYPE / IMPORT F3 | Proforma adjustment (GPR toggle), unit-mix propagation |
| 3 | **Manual Unit Mix Builder** | `api/rest/unit-mix-propagation.routes.ts` | `deals.module_outputs->unitMixOverride` | Same as #2 | Unit-mix propagation service, `getAuthoritativeUnitMix()` |
| 4 | **Unit Mix Propagation** | `services/unit-mix-propagation.service.ts` | `financial_models.assumptions->unitMix` | After #2/#3 write | Financial model engine, proforma generator |
| 5 | **Unit Mix Propagation** | `services/unit-mix-propagation.service.ts` | `building_designs_3d.metadata->unitMix` | After #2/#3 write | 3D design renderer, dev capacity module |
| 6 | **Unit Mix Propagation** | `services/unit-mix-propagation.service.ts` | `deals.module_outputs->developmentCapacity->unitMix` | After #2/#3 write | M03 capacity module, deal overview |
| 7 | **Unit Mix Intelligence** | `services/unitMixIntelligence.service.ts` | `deals.module_outputs->unitMix` | Intelligence agent run | `getAuthoritativeUnitMix()` (read-only fallback) |
| 8 | **Proforma Adjustment** | `services/proforma-adjustment.service.ts` | `deal_assumptions.year1->gpr` (unit_mix layer) | Financials recompute | F9 operating statement, projections, KPIs |
| 9 | **Proforma Seeder** | `services/proforma-seeder.service.ts` | `deal_assumptions.year1` (seed) | `forceReseed` after extraction | F9 operating statement, deal overview |

> **Note:** There are 9 distinct write targets, not 5. The original "5 services" framing likely grouped some of these. The divergence is deeper than initially scoped.

---

## 2. Per-Service Deep Dive

### 2.1 Extraction Pipeline (`document-extraction/data-router.ts`)

**What it writes:**
```ts
capsulePayload.extraction_rent_roll = {
  floor_plan_mix: { /* keyed by plan name */ },
  units: [ /* per-unit rows */ ],
  total_units, occupied_units, /* etc. */
};
// Then: UPDATE deals SET deal_data = COALESCE(deal_data, '{}') || capsulePayload
```

**What downstream consumer reads it:**
- `proforma-adjustment.service.ts` reads `extraction_rent_roll.floor_plan_mix` as a fallback when `deal_assumptions.unit_mix` is null
- `financials-composer.service.ts` reads it for the Rent Roll Summary (expiration curves, per-unit drill-down)
- `proforma-seeder.service.ts` reads it during `forceReseed` to seed `year1` rows

**Consumer pattern match:** The proforma adjustment and proforma seeder both read `floor_plan_mix` but for different purposes. The adjustment service uses it for GPR toggle fallback; the seeder uses it to seed the full year1 operating statement. These are **legitimately separate** — one is a runtime override, the other is a full re-seed.

---

### 2.2 Manual Unit Mix Builder (`api/rest/unit-mix-propagation.routes.ts`)

**What it writes:**
```ts
// Write 1: deal_assumptions.unit_mix (canonical SQL column)
INSERT INTO deal_assumptions (deal_id, unit_mix, updated_at)
VALUES ($1, $2::jsonb, NOW())
ON CONFLICT (deal_id) DO UPDATE SET unit_mix = $2::jsonb

// Write 2: deals.module_outputs.unitMixOverride (JSONB for getAuthoritativeUnitMix)
UPDATE deals
SET module_outputs = jsonb_set(..., '{unitMixOverride}', $1::jsonb),
    target_units = $2
WHERE id = $3
```

**What downstream consumer reads it:**
- `deal_assumptions.unit_mix` → `proforma-adjustment.service.ts` (primary source for GPR toggle)
- `deal_assumptions.unit_mix` → `unit-mix-propagation.service.ts` (propagateUnitMix reads it via SELECT)
- `module_outputs.unitMixOverride` → `getAuthoritativeUnitMix()` / `parseUnitMixData()` (used by 3D design, financial model, dev capacity)

**Consumer pattern match:** Both write targets are consumed by the same propagation service, but the `unitMixOverride` is shaped specifically for `parseUnitMixData()` while `deal_assumptions.unit_mix` is shaped for the proforma. The shapes differ slightly (`unitType` vs `type`, `avgSF` vs `avg_sqft`).

---

### 2.3 Unit Mix Propagation Service (`services/unit-mix-propagation.service.ts`)

**What it writes:**
```ts
// Write 1: financial_models.assumptions
UPDATE financial_models SET assumptions = $1, status = 'draft' WHERE id = $2
// Where assumptions.unitMix = [{ unitType, count, avgSF, ... }]

// Write 2: building_designs_3d.metadata
UPDATE building_designs_3d
SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{unitMix}', $1::jsonb)
WHERE id = $2

// Write 3: deals.module_outputs.developmentCapacity
UPDATE deals
SET module_outputs = jsonb_set(..., '{developmentCapacity,unitMix}', $1::jsonb)
WHERE id = $2

// Write 4: deals.module_outputs.unitMixOverride (already covered in 2.2)
```

**What downstream consumer reads it:**
- `financial_models.assumptions` → `financial-model-engine.service.ts` (DCF, projections)
- `building_designs_3d.metadata` → 3D design renderer (unit mix visualization)
- `module_outputs.developmentCapacity` → M03 module, deal overview page

**Consumer pattern match:** All three are **derivatives** of the canonical unit mix. They are legitimately separate because each module has its own data shape requirements. However, the propagation is **one-way** (manual → derivatives) with no reverse sync. If the extraction pipeline updates `floor_plan_mix`, the propagation service does NOT auto-update these derivatives.

---

### 2.4 Proforma Adjustment Service (`services/proforma-adjustment.service.ts`)

**What it writes:**
```ts
// When useUnitMixForGpr is ON and gprFromUnitMix is finite:
const year1Seed = /* existing year1 */;
year1Seed.gpr = {
  ...existingGpr,
  unit_mix: gprFromUnitMix,
  // resolution forced to 'unit_mix' downstream
};
// Then: deal_assumptions.year1 is upserted
```

**What downstream consumer reads it:**
- `deal_assumptions.year1->gpr` → `financials-composer.service.ts` (OS rows, resolvedNum)
- `deal_assumptions.year1->gpr` → `proforma-adjustment.service.ts` itself (re-computation)
- `deal_assumptions.year1` → F9 export, KPIs, projections

**Consumer pattern match:** This is the **most critical** consumer. The GPR value derived from unit mix flows into NOI, IRR, EM, CoC. Any divergence here directly affects investment metrics.

---

### 2.5 Unit Mix Intelligence Service (`services/unitMixIntelligence.service.ts`)

**What it writes:**
```ts
// When intelligence agent runs:
UPDATE deals
SET module_outputs = jsonb_set(..., '{unitMix}', $1::jsonb)
WHERE id = $2
// Shape: { program: [{ unitType, count, avgSF, ... }], updatedAt }
```

**What downstream consumer reads it:**
- `module_outputs.unitMix` → `getAuthoritativeUnitMix()` (fallback when `unitMixOverride` is absent)
- `module_outputs.unitMix` → `unit-mix-propagation.service.ts` (read-only, used to build propagation target)

**Consumer pattern match:** This is a **read-only derivative** produced by the intelligence agent. It is not user-editable. The consumer pattern is identical to `unitMixOverride` (both read by `getAuthoritativeUnitMix()`), but the write paths are completely separate.

---

## 3. Proposed Canonical Resolution

### 3.1 Canonical Source

**`deal_assumptions.unit_mix` is the single canonical source.**

Rationale:
- It is a dedicated SQL column (not nested JSONB), queryable and indexable
- It is already the primary source for the proforma adjustment service (GPR toggle)
- It is user-editable (manual builder) and agent-populatable (future extraction pipeline conversion)
- It has the most detailed shape (bedrooms, bathrooms, notes, in_place_rent, market_rent)

### 3.2 Architecture Change

```
┌─────────────────────────────────────────────────────────┐
│  CANONICAL SOURCE: deal_assumptions.unit_mix            │
│  (array of { type, count, bedrooms, bathrooms,          │
│             avg_sqft, in_place_rent, market_rent })    │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ Proforma   │   │ Propagation│   │ Extraction │
   │ Adjustment │   │ Service    │   │ Pipeline   │
   │ (reads)    │   │ (reads)    │   │ (writes)   │
   └────────────┘   └────────────┘   └────────────┘
          │                │
          │                ├─► financial_models.assumptions
          │                ├─► building_designs_3d.metadata
          │                ├─► deals.module_outputs.devCapacity
          │                └─► deals.target_units
          │
          └─► deal_assumptions.year1.gpr (unit_mix layer)
```

### 3.3 Required Changes Per Service

| Service | Current Behavior | Required Change | Effort |
|---------|-----------------|----------------|--------|
| **Extraction Pipeline** | Writes `floor_plan_mix` to `deals.deal_data` | Convert `floor_plan_mix` → `deal_assumptions.unit_mix` array during `forceReseed` | Medium — requires shape conversion in data-router or seeder |
| **Manual Builder** | Writes to both `deal_assumptions.unit_mix` and `module_outputs.unitMixOverride` | Stop writing to `module_outputs.unitMixOverride`; propagation service reads from `deal_assumptions.unit_mix` instead | Low — one route change + one propagation service change |
| **Propagation Service** | Reads `module_outputs.unitMixOverride` | Read `deal_assumptions.unit_mix` directly; shape conversion in-code | Low — change SELECT target |
| **Proforma Adjustment** | Reads `deal_assumptions.unit_mix` (primary) and `extraction_rent_roll.floor_plan_mix` (fallback) | Keep primary; remove fallback (extraction pipeline should have converted to canonical) | Low — delete fallback block |
| **Intelligence Service** | Writes to `module_outputs.unitMix` | Write to `deal_assumptions.unit_mix` (append-only, don't clobber user edits) | Medium — requires merge logic to preserve user rows |
| **Proforma Seeder** | Reads `extraction_rent_roll.floor_plan_mix` during `forceReseed` | Read `deal_assumptions.unit_mix` (canonical) | Low — change SELECT target |

### 3.4 What Stays Legitimately Separate

Not all 9 write targets should be consolidated:

| Target | Reason for staying separate |
|--------|---------------------------|
| `financial_models.assumptions` | Different shape (unitType vs type); derived from canonical, not canonical itself |
| `building_designs_3d.metadata` | Design-specific metadata (visualization, not underwriting) |
| `deals.module_outputs.developmentCapacity` | M03 module-specific shape; derived from canonical |
| `deal_assumptions.year1.gpr` | This is a **computed output** (Σ count × rent × 12), not a storage location |
| `deals.module_outputs.unitMix` (intelligence) | Could become canonical **read-only** fallback; but user edits always win |

---

## 4. Migration Path

### Phase 1: Read-path consolidation (1–2 days)
1. Update `unit-mix-propagation.service.ts` to read `deal_assumptions.unit_mix` instead of `module_outputs.unitMixOverride`
2. Update `proforma-seeder.service.ts` to read `deal_assumptions.unit_mix` instead of `extraction_rent_roll.floor_plan_mix`
3. Update `getAuthoritativeUnitMix()` to prefer `deal_assumptions.unit_mix` over `module_outputs.unitMix`

### Phase 2: Write-path consolidation (1 day)
4. Remove `module_outputs.unitMixOverride` write from `unit-mix-propagation.routes.ts`
5. Remove `floor_plan_mix` fallback from `proforma-adjustment.service.ts`

### Phase 3: Extraction pipeline bridge (2–3 days)
6. In `data-router.ts` or `proforma-seeder.service.ts`, convert `extraction_rent_roll.floor_plan_mix` → `deal_assumptions.unit_mix` during `forceReseed`
7. Add merge logic: if `deal_assumptions.unit_mix` already has user-edited rows, DON'T clobber; merge by `type` key

### Phase 4: Intelligence service alignment (1–2 days)
8. Update `unitMixIntelligence.service.ts` to write to `deal_assumptions.unit_mix` with merge logic (intelligence rows as `source: 'agent'`)

### Phase 5: Cleanup (1 day)
9. Backfill existing deals: copy `module_outputs.unitMixOverride` → `deal_assumptions.unit_mix` where the latter is null
10. Remove `module_outputs.unitMixOverride` reads entirely (after backfill)
11. Update invariant tests to assert canonical source is always populated

**Total effort estimate: 6–9 engineering days** (can be split across 2–3 PRs).

---

## 5. Open Questions

1. **What happens to deals created before `deal_assumptions.unit_mix` existed?** They only have `extraction_rent_roll.floor_plan_mix`. A backfill migration (Phase 5) is required.

2. **Should the intelligence service overwrite manual user edits?** No. The merge logic should treat `source: 'user'` rows as authoritative and `source: 'agent'` rows as suggestions.

3. **Should `unitMixOverride` be deprecated or kept as a staging area?** Deprecate. The canonical column should be the only source of truth. A temporary dual-write period (1–2 sprints) can provide rollback safety.

4. **What is the `rent_roll` table status?** Legacy code references it, but most environments have it absent. The extraction pipeline writes to `deals.deal_data` instead. Any remaining `rent_roll` reads should be migrated to `deal_assumptions.unit_mix`.
