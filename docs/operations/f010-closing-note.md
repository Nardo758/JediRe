# F-010 Closing Note — Override Layer Contamination

**Task:** #841  
**Status:** Resolved  
**Date:** 2026-05-17

---

## Summary

Broker OM values for deal `3f32276f-aacd-4da3-b306-317c5109b403` (464 Bishop) were
persisted in the `override` slot of `LayeredValue` fields in `deal_assumptions.year1`,
silently blocking agent and T-12 values from reaching `resolved`. Fixed globally.

---

## Root Cause — Historical Write Path

**Where the contamination was written:**

An older version of `proforma-seeder.service.ts` wrote broker OM values directly into
`LayeredValue.override` without any `override_source` tag. This occurred before the `om:`
layer was introduced in the seeder (circa commit `ea53fcef7` — Task #686: OM extraction
schema & seeder gaps) and before Task #832 added `override_source = 'operator'` stamping
to `applyUserOverride`.

**No active writer remains:**

A full codebase audit of all `.override =` assignments in `src/services/`:
```
grep -rn "\.override\s*=" src/services/ --include="*.ts"
Result: src/services/proforma-seeder.service.ts:1393: field.override = value;
```

The **only** active writer of `.override` in the services directory is `applyUserOverride`
at `proforma-seeder.service.ts:1393`, which immediately stamps `override_source = 'operator'`
on line 1402. This makes future contamination impossible under the current code.

**Current correct write path for OM values:**

1. `data-router.ts:routeOM()` (line ~804) writes broker claims to `deals.deal_data.broker_claims`
   — it does NOT write to `deal_assumptions.year1` directly
2. `updateDealCapsule()` (line ~1493) triggers `ensureDealAssumptionsSeeded(forceReseed: true)`
3. `seedProFormaYear1()` reads `broker_claims.proforma` and passes values as `om:` to `resolve()`
   — specifically at `buildSeed()` line ~782: `resolve('insurance', insurancePlatform, { t12: t12Ins, om: bpInsur, existingOverride: getOverride('insurance') })`
4. `resolve()` writes the value to `LayeredValue.om`, NOT `LayeredValue.override`

**Contamination pattern** (pre-fix, 464 Bishop):
The legacy override values written before the `om:` layer existed exactly matched the OM values
later added by the current seeder, producing `override === om AND override_source === null` in 8 fields.

---

## Pre/Post Contamination Counts

### Pre-fix (confirmed by audit query before remediation)

| Table | Contaminated deals | Contaminated fields |
|---|---|---|
| `deal_assumptions` | **1** (464 Bishop: `3f32276f`) | **8** fields |
| `deal_underwriting_scenarios` | **1** (scenario: `5f506465`) | **8** fields |

Contaminated fields: `gpr, insurance, payroll, utilities, g_and_a, marketing, repairs_maintenance, turnover`

Preserved legitimate overrides (unchanged):
- `management_fee_pct`: override=0.025 ≠ om=0.0275 (different values → real operator intent)
- `replacement_reserves`: override=58,000 ≠ om=46,400 (different values → real operator intent)
- `contract_services`: override=28,680, om=null (no om value to compare → real operator entry)

### Post-fix (confirmed by audit query after remediation)

| Table | Contaminated deals | Contaminated fields |
|---|---|---|
| `deal_assumptions` | **0** | **0** |
| `deal_underwriting_scenarios` | **0** | **0** |

Post-fix agent verification: `insurance.agent = 116,000; insurance.resolved = 116,000; insurance.resolution = 'agent'`

---

## Code Fixes

### 1. Read-path guard in `getOverride()` (`proforma-seeder.service.ts` line ~486)

Added inside the `getOverride()` closure in `buildSeed()`:

```typescript
// F-010 contamination guard: if override_source is absent AND override exactly
// equals the om slot, treat as legacy OM contamination → return null.
if (
  (lv.override_source == null) &&
  lv.override != null &&
  lv.om != null &&
  lv.override === lv.om
) {
  return null;  // falls through to t12/platform, unblocking agent writes
}
```

Safety: fires only when BOTH `override_source` is absent AND `override === om`. The current
`applyUserOverride` always stamps `override_source = 'operator'`, so real operator overrides
are never affected.

### 2. Write-path guard in `seedProFormaYear1()` (`proforma-seeder.service.ts` line ~1192)

Defense-in-depth validation runs BEFORE the DB UPSERT. Auto-heals contaminated LVs
that slip through `getOverride()` (code regression indicator). Re-resolves following
`t12 → om → platform → null` priority so OM-only fields aren't incorrectly downgraded:

```typescript
for (const [field, value] of Object.entries(seed)) {
  const lv = value as Record<string, unknown>;
  if (lv.override != null && lv.om != null && lv.override === lv.om
      && (lv.override_source == null || lv.override_source === undefined)) {
    console.error(`[F-010 write-guard] BUG: contaminated override in field "${field}"...`);
    lv.override = null;
    if (lv.t12 != null)       { lv.resolved = lv.t12;      lv.resolution = 't12'; }
    else if (lv.om != null)   { lv.resolved = lv.om;       lv.resolution = 'om'; }
    else if (lv.platform != null) { lv.resolved = lv.platform; lv.resolution = 'platform_fallback'; }
    else                      { lv.resolved = null;         lv.resolution = 'platform_fallback'; }
    warnings.push(`F-010 auto-healed: ${field}`);
  }
}
```

---

## Remediation

### Deal-specific (464 Bishop)

1. Ran `reseed-deal.ts` after code fix → 8 contaminated fields cleared in `deal_assumptions`
2. Active scenario `5f506465` patched via targeted SQL update on 8 fields
3. Cashflow agent re-triggered: `insurance.agent = 116,000; resolved = 116,000`

### Global remediation

Migration `20260521_f010_clear_om_contaminated_overrides.sql`:
- Scans ALL rows in `deal_assumptions.year1` AND `deal_underwriting_scenarios.year1`
- Clears `override = null` where `override = om AND override_source IS NULL`
- Re-resolves: `agent → t12 → om → platform → platform_fallback` (preserves agent values)
- Applied via `pool.query(sql)` with DO block logging RAISE NOTICE pre/post counts

---

## Resolution Hierarchy (Validated by Tests)

```
operator_override > agent > t12 > om > platform_fallback
```

- `operator_override`: `applyUserOverride` sets `override` + `override_source='operator'` + `resolved=override`
- `agent`: cashflow postprocess merges `{agent: X, resolved: X, resolution: 'agent'}` via jsonb_set
- `t12`: standard resolution via `resolve()` + `FIELD_PRIORITIES` or `opexFromT12` explicit priority
- `om`: fallback after t12 (included in explicit `priority: ['t12', 'om']` for opex fields)
- `platform_fallback`: final fallback when all other sources absent

**F-010 contamination broke the hierarchy** by inserting a stale OM value into the `override` slot,
causing `operator_override` position to be occupied by broker data, blocking agent + t12.

---

## Test Coverage (22 tests, all passing)

### Unit regression (`proforma-seeder.f010-contamination.test.ts` — 6 tests)
- Contaminated field (override==om, no source) → guard returns null → resolves from t12
- Real operator override (override_source='operator') → preserved
- Partial-mismatch override (override≠om, no source) → preserved
- `applyUserOverride` stamps `override_source='operator'` (prevents future contamination)
- LayeredValue hierarchy: override > t12 > om > platform
- Guard safety: does NOT fire when om is null

### End-to-end pipeline (`proforma-seeder.f010-e2e.test.ts` — 16 tests)

**Step 1-2 (OM ingest + seeder with contamination):**
- All 8 contaminated fields cleared; 3 legitimate overrides preserved
- Write-path guard: no field in DB-bound seed has override == om with no source

**Step 3 (agent write):**
- Agent value sets resolved when override is null (post-contamination-clearance)
- Contaminated override blocks agent write (regression: proves guard is necessary)

**Step 4 (operator override):**
- `applyUserOverride` stamps `override_source='operator'` preventing future contamination

**Step 5 (full hierarchy):**
- platform_fallback when all sources absent
- t12 wins over platform
- om wins over platform when t12 absent (utilities with explicit priority)
- t12 wins over om when both present
- Agent slot: merges `{agent, resolved, resolution}` directly; wins when override is null
- Operator override > agent (95k wins over 116k agent value + preserves agent slot)
- Contamination guard: null override → t12 resolution
- Write-guard auto-heal: om-only field → resolves to om (not platform_fallback)

---

## Active Writer Audit (Proves No Future Contamination)

```
$ grep -rn "\.override\s*=" src/services/ --include="*.ts" | grep -v test
src/services/proforma-seeder.service.ts:1393: field.override = value;
```

ONE active writer: `applyUserOverride` at line 1393, immediately followed by:
```typescript
// Line 1402:
(field as LayeredValue<number> & { override_source?: string | null }).override_source =
  value != null ? 'operator' : null;
```

The contamination guard (`override === om AND override_source == null`) can never be triggered
by the current `applyUserOverride`, as it always stamps `override_source = 'operator'`.
The ingestion pipeline (`routeOM → updateDealCapsule → seedProFormaYear1`) writes to the
`om:` slot via `resolve(..., { om: bpInsur })`, never to `override`.

---

## Related

- Task #832: Added `override_source = 'operator'` stamping (prevents future contamination)
- Task #840 (F-009): `other_income_dollars.agent` write-back fix
- Follow-up #844: Fix pre-existing invariant test failures from M40
- Follow-up #845: Scenario contamination global scan (covered by migration — may be marked obsolete)
