# Unit Mix Storage Divergence — Architectural Inventory

> **Status:** Investigation / proposal. No schema changes or service
> refactors are included here. All findings are for Leon's review.
>
> **Origin:** TASK B unit_mix investigation (2026-05-09). Five services
> write to five different locations, all bearing the name "unit_mix" or
> "unitMix". This causes the `da:use_unit_mix_for_gpr` GPR toggle to be
> dormant on all acquisition deals even when full rent roll extraction
> data exists.

---

## 1. Inventory

### Location 1 — `deal_assumptions.unit_mix` (column)

**Written by:** `PUT /api/v1/deals/:dealId/assumptions`
(`deal-assumptions.routes.ts:194`, position `$13`).

**Shape:** `JSONB` array of objects.
```json
[
  { "unit_type": "1BR", "count": 100, "in_place_rent": 1500, "market_rent": 1700 },
  { "unit_type": "2BR", "count":  50, "in_place_rent": 2000, "market_rent": 2300 }
]
```

**When written:** Only when a caller explicitly sends a `unit_mix`
body field to the bulk-update PUT endpoint. In practice this happens
for development/greenfield deals where the user manually enters a
unit program.

**Downstream consumers:**
| Consumer | How it reads | Notes |
|---|---|---|
| `da:use_unit_mix_for_gpr` GPR toggle | `assumptionsRes.rows[0]?.unit_mix` (direct column read) | After TASK 1 fix, also falls back to `floor_plan_mix` |
| Rent Roll Summary | Same column, with fallback to `floor_plan_mix` | Fallback already existed before TASK 1 |
| `applyUnitMixOverride()` | `unit_mix` column + `unit_mix_overrides` column for per-row overrides | Works with this column only |
| `inline-deals` unit_mix handler | Reads via `per_year_overrides` shadow keys (`da:unit_mix:N:field`) | Not the column itself |

**Current production count:** 1 deal populated (Jaguar Redevelopment,
manual PUT, no extraction capsules).

---

### Location 2 — `deals.deal_data.extraction_rent_roll.floor_plan_mix`

**Written by:** `data-router.ts` `routeExtractionResult()` (case
`RENT_ROLL`), populated from `rr.summary.floorPlanMix` produced by
the rent roll parser.

**Shape:** `JSONB` object keyed by plan name.
```json
{
  "A2":  { "count": 70, "avg_sqft": 813, "avg_effective_rent": 1597, "avg_market_rent": 1612, "occupancy_pct": 0.857 },
  "B1S": { "count": 66, "avg_sqft": 1180, "avg_effective_rent": 1450, "avg_market_rent": 1478, "occupancy_pct": 0.88  }
}
```
Unlike Location 1, keys are plan names (not typed bedroom labels),
and there is no `in_place_rent` field — the equivalent is
`avg_effective_rent`.

**When written:** Automatically, every time a rent roll document is
extracted via the AI extraction pipeline. Triggers `forceReseed`
via the INCOME_CAPSULE_KEYS hook in `data-router.ts:1278`.

**Downstream consumers:**
| Consumer | How it reads | Notes |
|---|---|---|
| Rent Roll Summary | Fallback when Location 1 is null (lines 2336-2352) | Converts object → array on-read |
| GPR toggle (after TASK 1 fix) | Same fallback, same conversion | Applied by TASK 1 |
| `rentRollSummary.gprFromUnitMix` | Read via the Rent Roll Summary path | Displayed in the UI |

**Current production count:** 2 deals (464 Bishop, Sentosa Epperson).
Both have rich plan-level data (7 and 8 floor plans respectively).

---

### Location 3 — `deals.deal_data.unit_mix` (top-level JSONB key)

**Written by:** `capsule-bridge.routes.ts:299` (case `program`).

**Shape:** Whatever the caller sends as `data.unitMix || data.units
|| data.unit_mix` — no enforced schema, could be an array or an
object depending on the caller (e.g., the 3D massing/design agent).

**When written:** When the design agent or any other module POSTs a
`program` capsule to the capsule-bridge endpoint. Not tied to the
extraction pipeline.

**Downstream consumers:** None identified in server code. This key
sits in `deals.deal_data` where it is accessible to the frontend
via the deal's `deal_data` blob, but no service is currently reading
`deals.deal_data.unit_mix` to drive financial computations.

**Current production count:** 0 deals (confirmed via
`SELECT count(*) FROM deals WHERE deal_data ? 'unit_mix'` → 0).

**Risk:** This location is effectively a write-only dead end. Data
written here does not flow into the F9 proforma.

---

### Location 4 — `unit_mix` table (separate relation)

**Written by:** `operations.routes.ts:1329-1333`
(`DELETE + INSERT` inside a transaction).

**Schema:**
```
unit_mix(id, deal_id, unit_type, bed_count, bath_count, sqft,
         count, occupied, avg_rent, market_rent, total_rent,
         as_of_date, source, created_at, updated_at)
```

**When written:** Via a PATCH/PUT to the operations routes, which is
triggered by the Operations module (M15 or similar). Intended as the
canonical store for day-to-day operational unit-level data (e.g.,
current occupancy by unit type for existing assets).

**Downstream consumers:**
| Consumer | How it reads | Notes |
|---|---|---|
| `operations.routes.ts:1262` (GET) | `SELECT * FROM unit_mix WHERE deal_id = $1` | Returns raw rows to the Operations module |
| `getDealFinancials` (proforma) | **None** — not read | The proforma reads Location 1 or 2 only |

**Current production count:** 0 rows (the table exists, all empty).

**Note:** `avg_rent` column exists (vs. `in_place_rent` / `market_rent`
naming used by Location 1 and the GPR toggle). Schema naming is
inconsistent with the other locations.

---

### Location 5 — `deals.module_outputs.unitMix`

**Written by:** `unit-mix-propagation.service.ts`
(`propagateUnitMix()`, called from `unit-mix-propagation.routes.ts`).

**Shape:** `JSONB` blob representing a `UnitMixBreakdown`:
```json
{
  "studio":  { "count": 10, "avgSF": 550, "percent": 7 },
  "oneBR":   { "count": 80, "avgSF": 750, "percent": 57 },
  "twoBR":   { "count": 50, "avgSF": 1000, "percent": 36 },
  "threeBR": { "count":  0, "avgSF": 1600, "percent": 0 },
  "total": 140, "totalSF": 112500, "avgSF": 804
}
```
Note: uses bedroom-category keys (`oneBR`, `twoBR`) rather than plan
names or `in_place_rent` fields. No rent data at all.

**When written:** When the development path is selected or the Unit
Mix Intelligence AI module runs. Designed for greenfield development
scenarios where the AI proposes a unit program.

**Downstream consumers:**
| Consumer | How it reads | Notes |
|---|---|---|
| `unit-mix-propagation.service.ts` itself | `module_outputs->'unitMix'` — used as the authoritative source for `getAuthoritativeUnitMix()` | Reads its own output back on subsequent calls |
| `deal-consistency-validator.service.ts:548` | `module_outputs->'unitMix'` | Validation only |
| `unit-mix-propagation.service.ts:430` | `module_outputs->'unitMix'` | Same service |

**Current production count:** 0 deals have `module_outputs.unitMix`
populated (confirmed by `SELECT count(*) FROM deals WHERE module_outputs ? 'unitMix'` — not separately queried but no deals in the live DB have gone through the AI development path).

---

### Location 6 — `deal_assumptions.per_year_overrides['da:unit_mix:N:field']`

**Written by:** `inline-deals.routes.ts` unit_mix override handler
(lines 1930-2080), case where no `rent_roll` SQL row exists at the
requested index.

**Shape:** Entry in the `per_year_overrides` JSONB:
```json
{
  "da:unit_mix:0:in_place_rent": { "value": 1550, "resolution": "override", "updatedBy": "..." },
  "da:unit_mix:1:market_rent":   { "value": 2100, "resolution": "override", "updatedBy": "..." }
}
```

**When written:** When the operator edits an in-place-rent or market
rent cell in the Unit Mix tab of the F9 proforma for a deal whose
rent roll rows are not backed by the legacy `rent_roll` SQL table.

**Downstream consumers:**
| Consumer | How it reads | Notes |
|---|---|---|
| `applyUnitMixOverride()` at proforma-adjustment.service.ts:4042 | Reads `per_year_overrides` and `unit_mix` column together | Patches the `unit_mix` array in-place |
| `financials-composer.service.ts:301` | `pyOvs['da:use_unit_mix_for_gpr']` (different key prefix, not unit_mix:N) | Different concept; same `per_year_overrides` bag |

---

## 2. Consumer pattern match matrix

| Consumer | Loc 1 | Loc 2 | Loc 3 | Loc 4 | Loc 5 | Loc 6 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| GPR toggle | ✓ (col) | ✓ (after fix) | ✗ | ✗ | ✗ | ✗ |
| Rent Roll Summary display | ✓ (col) | ✓ (fallback) | ✗ | ✗ | ✗ | ✗ |
| Unit Mix tab cell edits | ✓ (via Loc 6) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Operations module | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| F9 proforma (general) | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Design / AI dev path | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |

**Observation:** Locations 3, 4, and 5 are islands relative to the F9
proforma — they are written but not read by any F9 financial
computation. Locations 1 and 2 are the two sources the proforma
actually uses, and they serve different deal types (development vs.
acquisition).

> **Decision gate — verify before migrating:**
> The "islands" label is only correct if these locations have no active
> consumers on *other* surfaces. Before proposing any cleanup or
> migration for Locations 3, 4, and 5, confirm one of the following
> for each:
>
> | Location | Candidate outcome |
> |---|---|
> | **Loc 3** `deal_data.unit_mix` (capsule-bridge) | (a) Consumed by a non-F9 surface (e.g. deal capsule export, Deal Card render) → leave as-is, document the consumer. (b) Dead write path → remove. |
> | **Loc 4** `unit_mix` table (operations.routes) | (a) Consumed by day-to-day operations module, leasing panel, or M07 → leave as a separate operational store, explicitly document it does not feed F9. (b) Dead → remove table and route. |
> | **Loc 5** `module_outputs.unitMix` (unit-mix-propagation) | (a) Consumed by a planned module (M03 Site Solver, multifamily massing) that hasn't been built yet → correctly orphaned for now; annotate with the planned consumer. (b) Dead → deprecate. |
>
> If any of Loc 3/4/5 serves a different surface, the canonical
> resolution below (route everything through `deal_assumptions.unit_mix`)
> needs to become surface-specific: F9 reads Location 1, M03 reads
> Location 5, and the open question is whether they should ever diverge
> for the same deal.

---

## 3. Proposed canonical resolution

**Goal:** One write path → one read path. `deal_assumptions.unit_mix`
(Location 1) is the natural canonical column because it is already
what the GPR toggle, the Rent Roll Summary, and `applyUnitMixOverride`
read first.

**Proposed architecture:**

```
ACQUISITION DEALS (extraction path):
  data-router  →  extraction_rent_roll.floor_plan_mix (Location 2)
                    │
                    ▼ (during forceReseed, new conversion step)
               deal_assumptions.unit_mix (Location 1)  ← canonical
                    │
                    ▼
             GPR toggle / Rent Roll Summary / Unit Mix tab

GREENFIELD DEALS (development path):
  PUT /assumptions or Unit Mix Intelligence
                    │
                    ▼
               deal_assumptions.unit_mix (Location 1)  ← canonical
                    │
                    ▼
             GPR toggle / Rent Roll Summary / Unit Mix tab
```

**What changes per service:**

| Service | Change required | Effort |
|---|---|---|
| `proforma-seeder.service.ts` | During `forceReseed`: read `extraction_rent_roll.floor_plan_mix`, convert to array, `UPDATE deal_assumptions SET unit_mix = ...`. Skip if `unit_mix` already set and source = 'manual'. | S (~20 lines) |
| `data-router.ts` | None — already writes floor_plan_mix; forceReseed hook already fires | — |
| `capsule-bridge.routes.ts` (Loc 3) | Redirect `deal_data.unit_mix` write to `deal_assumptions.unit_mix` via a DB upsert, OR remove as dead code if no consumer exists | XS |
| `operations.routes.ts` / `unit_mix` table (Loc 4) | Remains as a separate operational store (distinct concept: day-to-day unit-level tracking). Document explicitly that it does not feed F9. | — (doc only) |
| `unit-mix-propagation.service.ts` (Loc 5) | After `updateFinancialModelUnitMix`, additionally write the result to `deal_assumptions.unit_mix` (converted from `UnitMixBreakdown` to the canonical array format). Currently it only writes to `financial_models` and `module_outputs`. | S (~15 lines) |
| `inline-deals` override handler (Loc 6) | No change — `per_year_overrides` shadow keys are an overlay pattern, not a base store. They correctly merge on top of the canonical column. | — |

**Schema changes needed:** None. `deal_assumptions.unit_mix` (JSONB)
already exists and is the right type.

---

## 4. Migration path for existing data

For deals already in production that have `extraction_rent_roll.
floor_plan_mix` but `deal_assumptions.unit_mix = NULL`:

```sql
-- Preview (read-only):
SELECT d.name, d.id,
  jsonb_array_length(
    COALESCE(
      (SELECT year1->'unit_mix' FROM deal_assumptions WHERE deal_id = d.id),
      '[]'::jsonb
    )
  ) AS unit_mix_len,
  jsonb_object_keys(d.deal_data->'extraction_rent_roll'->'floor_plan_mix') AS plan
FROM deals d
WHERE d.deal_data ? 'extraction_rent_roll';
```

The correct migration is **not** a SQL script but a `forceReseed`
call per affected deal (which runs through the seeder's full priority
resolution logic and preserves override layers). Once the seeder
writes Location 1 during `forceReseed`, all consumers automatically
pick it up on the next proforma read.

**Affected deals today:** 2 (464 Bishop, Sentosa Epperson).

---

## 5. What is NOT proposed

- No schema migrations (no new columns, no new tables).
- No deprecation of the `unit_mix` table (Location 4) — it serves the
  Operations module and is architecturally separate from the F9
  proforma. The gap to document is that it does not feed the proforma
  and should not be expected to.
- No changes to Location 5 (`module_outputs.unitMix`) beyond routing
  its output through Location 1 after propagation. The AI dev-path
  intelligence model stays in `module_outputs` as the source of truth
  for that path.
- No refactors of any of the six services — this document is for
  architectural review only.
