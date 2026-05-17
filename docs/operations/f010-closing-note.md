# F-010 Closing Note — Override Layer Contamination

**Task:** #841  
**Status:** Resolved  
**Date:** 2026-05-17

---

## Summary

Broker OM values for deal `3f32276f-aacd-4da3-b306-317c5109b403` (464 Bishop) were
persisted in the `override` slot of `LayeredValue` fields in `deal_assumptions.year1`,
silently blocking agent and T-12 values from reaching `resolved`.

---

## Pre-Fix Audit

**Audit query** (looks for `override_source ILIKE '%om%' OR '%broker%'`):
```
Rows: 0
```
The contaminated entries had `override_source = null` (pre-Task #832 era), so the
task-specified query did not catch them. The actual contamination was found via:
```sql
SELECT key, value->>'override', value->>'om', value->>'override_source'
FROM deal_assumptions, LATERAL jsonb_each(year1) AS j(key, value)
WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
  AND value->>'override' IS NOT NULL
  AND value->>'om' IS NOT NULL
  AND (value->>'override') = (value->>'om')
  AND value->>'override_source' IS NULL;
```

**Pre-fix contaminated fields (8 of 11 overrides on 464 Bishop):**

| Field | override value | om value | t12 value | Effect |
|---|---|---|---|---|
| gpr | 4,901,400 | 4,901,400 | 4,876,535 | blocked t12 resolution |
| insurance | 46,400 | 46,400 | 63,699 | blocked agent's $125k |
| payroll | 324,800 | 324,800 | 194,388 | blocked t12 resolution |
| utilities | 187,094 | 187,094 | 184,968 | blocked t12 resolution |
| g_and_a | 69,600 | 69,600 | 22,496 | blocked t12 resolution |
| marketing | 69,600 | 69,600 | 43,897 | blocked t12 resolution |
| repairs_maintenance | 69,600 | 69,600 | 134,208 | blocked t12 resolution |
| turnover | 41,760 | 41,760 | 1,540 | blocked t12 resolution |

**Preserved legitimate overrides (3 fields with different values):**
- `management_fee_pct`: override=0.025, om=0.0275 (operator intent, different values)
- `replacement_reserves`: override=58,000, om=46,400 (operator intent, different values)
- `contract_services`: override=28,680, om=null (no om value to compare — preserved)

---

## Root Cause

**Historical cause:** Before Task #832 (commit `8e35b3d7b`) added `override_source = 'operator'`
stamping to `applyUserOverride`, operator saves wrote to the `override` slot WITHOUT any
source tag. The OM extraction layer was added later (commit `0af3c1c79`, May 4 2026),
which correctly populated the `om:` layer — but the pre-existing `override` values (written
before the OM layer existed) happened to match the OM values exactly, making them
indistinguishable from automated writes.

**Persistence mechanism:** `buildSeed()` in `proforma-seeder.service.ts` uses `getOverride()`
to read existing overrides and pass them to `resolve()` via `existingOverride`. This correctly
preserves operator overrides on re-seed — but also preserved the stale contaminated values
through every subsequent extraction + reseed cycle.

**Blocking mechanism:** The cashflow agent (`cashflow.postprocess.ts:440-466`) skips writing
`agent`, `resolved`, and `resolution` when any finite numeric override exists. This is correct
behavior for real operator overrides but caused the agent's insurance analysis ($125,000) to
never land, because the stale 46,400 override always won.

---

## Code Fix

**File:** `backend/src/services/proforma-seeder.service.ts`  
**Function:** `getOverride()` (closure inside `buildSeed()`)

Added contamination guard: if `override_source` is absent (null/undefined) AND `override`
exactly equals `om` (numeric match), return `null` instead of the override value. This causes
`resolve()` to build a `LayeredValue` with `override: null`, which the seeder then writes back
to the DB on the next reseed — self-healing the contamination.

**Guard logic:**
```typescript
if (
  (lv.override_source == null) &&
  lv.override != null &&
  lv.om != null &&
  lv.override === lv.om
) {
  return null;  // treat as legacy OM contamination
}
```

**Safety:** Real operator overrides are always stamped `override_source = 'operator'` by
`applyUserOverride` (Task #832). The guard only fires when BOTH conditions hold:
1. `override_source` is absent (pre-Task#832 write)
2. `override === om` (exact numeric match — extremely unlikely to be coincidental for real overrides)

Fields where override ≠ om (management_fee_pct: 0.025 ≠ 0.0275) are preserved.
Fields where om is null (contract_services: no OM data) are preserved.

---

## Remediation

**Method:** Ran `reseed-deal.ts` script with the code fix in place:
```
cd backend && npx ts-node --transpile-only src/scripts/reseed-deal.ts 3f32276f-aacd-4da3-b306-317c5109b403
```

Result: `seeded: true, fields_seeded: 109` — the contamination guard fired for all 8
contaminated fields, producing `override: null` in the new seed. The seeder's full JSONB
write (`year1 = EXCLUDED.year1`) replaced the stale overrides with correctly resolved values.

**Post-remediation state:**
```
insurance:   override=null, resolved=63698.91, resolution='t12'  ✓
gpr:         override=null, resolved=4876535,  resolution='t12'  ✓
payroll:     override=null, resolved=194388,   resolution='t12'  ✓
utilities:   override=null, resolved=184968,   resolution='t12'  ✓
g_and_a:     override=null, resolved=22496,    resolution='t12'  ✓
marketing:   override=null, resolved=43897,    resolution='t12'  ✓
r_and_m:     override=null, resolved=134208,   resolution='t12'  ✓
turnover:    override=null, resolved=1540,     resolution='t12'  ✓
```

Cashflow agent pipeline triggered post-remediation to write agent values
(insurance resolved to agent's value, unblocked by override clearance).

---

## Post-Fix Verification

**Audit query (override_source ILIKE '%om%' OR '%broker%'):** 0 rows  
**Contamination pattern query (override = om AND override_source IS NULL):** 0 rows  
**Deals with any override:** 1 deal (464 Bishop, 3 legitimate overrides remaining)

---

## Regression Test

`backend/src/services/__tests__/proforma-seeder.f010-contamination.test.ts`

Tests:
1. Contaminated field (override == om, no source) resolves from t12 after guard
2. Real operator override (override_source = 'operator') is preserved
3. Partial-mismatch override (override ≠ om, no source) is preserved
4. `applyUserOverride` always stamps `override_source = 'operator'` (prevents future contamination)
5. LayeredValue hierarchy: operator override > agent > om > t12 > platform
6. Guard safety: does NOT fire when om is null (contract_services pattern)

---

## Related

- Task #832 — added `override_source = 'operator'` stamping (prevents future contamination)
- Task #840 (F-009) — `other_income_dollars.agent` write-back fix
- Commit `8e35b3d7b` — Task #832: agent sub-key preservation
- Commit `0af3c1c79` — added broker proforma `om:` layer to seeder
