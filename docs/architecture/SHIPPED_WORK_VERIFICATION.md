# Shipped Work — Live-State Verification

> **Lesson context:** S1-01 proved that unit-tests can pass while live behavior
> diverges. This file captures end-to-end probes against the running backend
> + live DB to confirm whether recently-shipped items are actually wired up.
>
> Methodology: real HTTP calls to localhost:4000 (JWT-signed for the test
> user), direct DB introspection, and direct service-function calls when the
> response shape needs traversal. Synthetic deals are created and torn down
> within the same probe; touched live deals (464 Bishop) are restored to
> steady state.

---

## TASK B — 2026-05-08

Probe script: `backend/scripts/verify-shipped-work.ts` (preserved for re-runs).
Test user: `b24c746c-a926-429b-bfaf-db065c36b550` (web_test-user@chat.jedire.com).

### Item 1 — Purchase price dual-write on POST + PATCH (#623 / #624)

**Verdict: VERIFIED_LIVE** ✅

**What the code claims to do.** `inline-deals.routes.ts` POST handler
(lines 366-373) and PATCH handler (lines 570-581) both dual-write `budget`
into `deals.deal_data.purchase_price`. PATCH must only fire when `budget`
is actually present in the update payload, so unrelated PATCHes (e.g.
`name` only) must NOT clobber `purchase_price`.

**Probe.** Created a synthetic deal via real HTTP `POST /api/v1/deals`
with `budget = $5,000,000`, then `PATCH` with `budget = $6,000,000`, then
`PATCH` with `name` only.

**DB state after each step:**

| Step | `deals.budget` | `deals.deal_data->'purchase_price'` |
|---|---|---|
| After POST(budget=5M) | `5000000.00` | `5000000` |
| After PATCH(budget=6M) | `6000000.00` | `6000000` |
| After PATCH(name only) | `6000000.00` | `6000000` (preserved) |

Both columns moved together on POST and PATCH, and the unrelated PATCH
did not clobber. Dual-write is wired correctly.

---

### Item 2 — Unit-mix → GPR toggle (`da:use_unit_mix_for_gpr`)

**Verdict: VERIFIED_LIVE** ✅

**What the code claims to do.** `proforma-adjustment.service.ts` lines
1768-1806 read `deal_assumptions.per_year_overrides['da:use_unit_mix_for_gpr']`.
When `value === true` AND `deal_assumptions.unit_mix` yields a finite
`Σ(count × in_place_rent × 12) > 0`, GPR is recomputed on-read with a
new `unit_mix` layer and `resolution = 'unit_mix'`. No reseed.

**Field-survey caveat.** As of probe time, **zero** deals in the live
database have `deal_assumptions.unit_mix` populated (`SELECT count(*)
FROM deal_assumptions WHERE jsonb_typeof(unit_mix) = 'array' AND
jsonb_array_length(unit_mix) > 0` → 0). The code path is therefore
**dormant on every existing deal**. To verify the path itself, a
synthetic deal was created with `unit_mix = [{count: 100,
in_place_rent: 1500}]` (expected unit-mix GPR = 100 × 1500 × 12 =
$1,800,000) and a seeded `year1.gpr` of $4,000,000 from `t12`.

**Probe sequence.** Real `PATCH /api/v1/deals/:id/financials/override`
to flip the toggle, then `getDealFinancials()` called directly to read
the resolved row through the same code path the GET endpoint uses.

| Step | `proforma.year1.gpr.resolved` | `.resolution` | `unitEconomics.gprPerUnit` | `gprDecomposition.resolvedAnnual` | `projections[0].gpr` |
|---|---|---|---|---|---|
| Before toggle | `4,000,000` | `t12` | `40,000` | `4,000,000` | `4,000,000` |
| Toggle ON | `1,800,000` | `unit_mix` | `18,000` | `1,800,000` | `1,800,000` |
| Toggle OFF | `4,000,000` | `t12` | `40,000` | `4,000,000` | `4,000,000` |

Toggle write went to `per_year_overrides['da:use_unit_mix_for_gpr']` as
`{value: true, resolution: 'override', updatedBy: <userId>}`. The unit-mix
layer flows through Year 1, unit economics, GPR decomposition, and the
projection strip. Toggling off cleanly reverts to `t12`.

**Caveat carried forward.** This feature is correctly wired but
**dormant in production** — no real deal has `unit_mix` populated, so the
toggle never has fuel. If the field is supposed to be filled by an
extraction pipeline, that pipeline is not running for any current deal.
Verification did not extend to "how does `unit_mix` get populated."

---

### Item 3 — Part A `forceReseed` hook in extraction pipeline (#519)

**Verdict: VERIFIED_LIVE** ✅

**What the code claims to do.** `data-router.ts` line 1278-1290:
after writing any of the income capsules (`extraction_t12`,
`extraction_rent_roll`, `extraction_om`), the router calls
`ensureDealAssumptionsSeeded(pool, dealId, { forceReseed: true })`.
This must (a) advance `deal_assumptions.year1.last_seeded_at`,
(b) actually merge the new capsule into `deals.deal_data`, and
(c) **preserve operator override layers** through the reseed.

**Probe.** Used live deal 464 Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`),
which already has `year1` from the TASK A reseed yesterday.

1. Snapshotted `year1.last_seeded_at` = `2026-05-08T23:53:19.521Z`.
2. Set marker override `vacancy_pct = 0.137` via
   `applyUserOverride(... 'TASK-B-VERIFY')`.
3. Invoked `routeExtractionResult()` with a synthetic `RENT_ROLL` payload
   containing the marker `gpr_monthly = 999999` and `layout = 'task-b-synthetic'`.
4. Re-snapshotted.

**Results:**

| Probe | Before | After |
|---|---|---|
| `year1.last_seeded_at` | `2026-05-08T23:53:19.521Z` | `2026-05-08T23:54:01.807Z` (advanced ✓) |
| `extraction_rent_roll.gpr_monthly` | `<prior value>` | `999999` (synthetic marker landed ✓) |
| `extraction_rent_roll.layout` | `<prior value>` | `task-b-synthetic` ✓ |
| `year1.vacancy_pct.override` | `0.137` (marker set in step 2) | `0.137` (preserved through reseed ✓) |
| `year1.vacancy_pct.resolution` | `override` | `override` ✓ |

`routeExtractionResult` returned `{capsuleUpdated: true, proformaSeeded: true,
crossValidationVariances: 4}`. The reseed timestamp advanced by ~42s,
proving the hook actually fired (not a no-op short-circuit). The marker
override survived end-to-end with `resolution = 'override'` intact.

**Cleanup.** Marker override cleared, original `extraction_rent_roll`
capsule restored from the BEFORE snapshot, then `ensureDealAssumptionsSeeded`
re-run to reconcile `year1` with the restored capsule. 464 Bishop is
back to steady state.

---

## Probe artifacts

- `backend/scripts/verify-shipped-work.ts` — primary probe (Items 1 + 3, plus
  initial Item 2 attempt that exposed the response-shape gap in `findGpr`).
- `/tmp/verify-run.log`, `/tmp/item2.log` — raw probe output (this session
  only; not committed).

## Synthetic-write discipline

Every synthetic deal created during this verification was deleted in the
`finally` block of its probe. 464 Bishop's pre-existing
`extraction_rent_roll` capsule was snapshotted before being temporarily
overwritten and restored verbatim afterward; a final `forceReseed` then
reconciled `year1` against the restored capsule.

---

## Unit Mix Population Pipeline — Investigation (2026-05-09)

**Trigger:** TASK B caveat — 0 deals in production have `deal_assumptions.unit_mix`
populated, so the `da:use_unit_mix_for_gpr` toggle is perpetually dormant for all
real acquisition deals.

### (a) What is supposed to write to `deal_assumptions.unit_mix`?

**Nothing automatic.** There is exactly **one write path** to
`deal_assumptions.unit_mix` in the entire codebase:

```
PUT /api/v1/deals/:dealId/assumptions   (deal-assumptions.routes.ts:194)
```

This is a manual bulk-update endpoint used by the development/greenfield flow.
`unit_mix` is position `$13` in the INSERT; it is only written when the caller
explicitly includes it in the request body. No extraction pipeline, no seeder,
no Inngest job, and no data-router hook ever calls this endpoint or writes
to the `unit_mix` column directly.

The one deal that does have `unit_mix` populated — **Jaguar Redevelopment** —
was set via a manual call to this endpoint on 2026-04-30
(`source_type = 'manual'`, no extraction capsules of any kind).

Other services that touch something called "unit_mix" are writing to
**different locations**:

| Service | What it writes | Where |
|---|---|---|
| `capsule-bridge.routes.ts:299` | `deal_data.unit_mix` | `deals` JSONB, NOT `deal_assumptions` |
| `unit-mix-propagation.service.ts` | `financial_models`, `deals.module_outputs`, `deals.target_units` | Greenfield dev path; sources from `module_outputs.unitMix` (AI) |
| `data-router.ts` (extraction) | `deals.deal_data.extraction_rent_roll.floor_plan_mix` | Object keyed by plan name, NOT `deal_assumptions.unit_mix` |
| `inline-deals.routes.ts` unit_mix handler | `deal_assumptions.per_year_overrides['da:unit_mix:N:field']` | Rent overrides only, not the base array |
| `operations.routes.ts:1329-1333` | `unit_mix` table (separate table) | Not `deal_assumptions.unit_mix` column |

### (b) Does the pipeline exist?

**No.** There is no code path that converts extracted rent roll data
into `deal_assumptions.unit_mix`. The extraction pipeline ends at
`deals.deal_data.extraction_rent_roll.floor_plan_mix` — an object keyed
by plan name — and nothing converts it to the array format the toggle
expects.

### (c) Why hasn't it fired on deals with full extraction data?

Two compounding reasons:

**Reason 1 — No write path.** The extraction pipeline (data-router +
proforma-seeder) never writes to `deal_assumptions.unit_mix`. After a rent
roll is extracted, the floor plan data lands in
`deals.deal_data.extraction_rent_roll.floor_plan_mix` and stops there.

**Reason 2 — The GPR toggle has no fallback.** The toggle computation
(proforma-adjustment.service.ts lines 1779-1793) reads
`deal_assumptions.unit_mix` exclusively:

```ts
const _rawUnitMixForGpr: Array<...> | null =
  Array.isArray(assumptionsRes.rows[0]?.unit_mix) ? ... : null;
```

If that column is `null` (which it is for every acquisition deal),
`gprFromUnitMix = null` and the toggle is silently inert — no error,
no warning, the UI toggle just does nothing.

By contrast, the **Rent Roll Summary** section (lines 2320-2354 in the
same file) has a correct two-step fallback:

```
1. deal_assumptions.unit_mix (column)
2. extraction_rent_roll.floor_plan_mix (object → converted to array on-read)
```

The toggle was shipped with the column read but without the fallback that
already exists eight hundred lines below it in the same function.

### Live data proof

Both deals with full extraction capsules have rich `floor_plan_mix` but
`deal_assumptions.unit_mix = NULL`:

| Deal | `unit_mix` column | `floor_plan_mix` plans | Units | GPR from fpm (effective rent) | Capsule GPR (annualized) |
|---|---|---|---|---|---|
| 464 Bishop | NULL | 7 plans | 232 | $4,849,260 | $4,932,300 |
| Sentosa Epperson | NULL | 8 plans | 304 | $6,578,604 | $6,636,888 |

The fpm-derived figures are within 1.7% of the capsule totals, confirming
the data is coherent and usable. The toggle simply cannot reach it.

### Fix options (not implemented here — logging for follow-up)

**Option A (preferred) — Extend the GPR toggle fallback.**
In `proforma-adjustment.service.ts` lines 1779-1793, mirror the fallback
already written at lines 2336-2352. When `deal_assumptions.unit_mix` is
null, read `rrCapsule?.floor_plan_mix`, convert from the object format to
an array using `avg_effective_rent` as `in_place_rent`, and continue.
`rrCapsule` is already in scope at this point in the function.
Estimated change: ~15 lines. Risk: low — the fallback logic is a copy of
existing code.

**Option B — Populate `unit_mix` from `floor_plan_mix` during forceReseed.**
In `proforma-seeder.service.ts` (the `forceReseed` path), read
`extraction_rent_roll.floor_plan_mix` and write the converted array to
`deal_assumptions.unit_mix`. This normalises the data into a canonical
location and makes it available to all consumers.
Estimated change: ~25 lines + one DB upsert per forceReseed.
Risk: low. Would immediately fix all deals re-seeded after the change.

Option A fixes the symptom with minimal blast radius. Option B is
architecturally cleaner (single canonical location for the data).
Both are needed if the `unit_mix` column is also used by other consumers
beyond the toggle (currently: Rent Roll Summary display already has its
own fallback, so it doesn't block on the column).

### Correction to TASK B verdict

The original TASK B probe query for detecting unit_mix presence was:

```sql
-- WRONG (checks year1 JSONB key, not the column)
SELECT count(*) FROM deal_assumptions WHERE year1 ? 'unit_mix'  → 0
```

The correct query is:

```sql
-- CORRECT
SELECT count(*) FROM deal_assumptions
WHERE unit_mix IS NOT NULL AND unit_mix::text NOT IN ('null','[]','{}')  → 1
```

The TASK B conclusion "0 deals in production have unit_mix populated"
was directionally correct for acquisition deals but technically wrong —
one development deal (Jaguar Redevelopment) does have it populated via
a manual write. The core finding stands: no acquisition deal fed by
extraction has `unit_mix` populated, and the toggle is dormant for them.
