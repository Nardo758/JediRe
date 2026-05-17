# F-010 Closing Note — Override Layer Contamination

**Task:** #841  
**Status:** Resolved  
**Date:** 2026-05-17

---

## Summary

Broker OM values for deal `3f32276f-aacd-4da3-b306-317c5109b403` (464 Bishop) were
persisted in the `override` slot of `LayeredValue` fields in `deal_assumptions.year1`,
silently blocking agent and T-12 values from reaching `resolved`. The fix is applied
globally across all deals and scenarios.

---

## Root Cause

**Historical write path:** Before the `om:` layer was introduced in `proforma-seeder.service.ts`,
an older seeder version wrote broker OM values directly into the `override` slot of
`LayeredValue` without any `override_source` tag. After Task #832 (commit `8e35b3d7b`)
added the `om:` layer and started stamping `override_source = 'operator'` on legitimate
operator saves, these legacy values remained in the DB with:
- `override` = (some broker OM value)
- `override_source` = null  (no source tag — distinguishes them from real operator overrides)
- `om` = (same broker OM value, now correctly populated in the `om:` slot)

**Blocking mechanism:** `buildSeed()` calls `getOverride()` to preserve existing operator
overrides when re-seeding. It passes the returned value as `existingOverride` to `resolve()`,
which treats ANY non-null override as the winner — blocking `t12`, agent, and all other
sources from reaching `resolved`. The cashflow agent (`cashflow.postprocess.ts:440-466`)
also skips writing when any finite override exists.

**Specific evidence (464 Bishop, pre-fix):**

| Field | override | om | t12 | Effect |
|---|---|---|---|---|
| gpr | 4,901,400 | 4,901,400 | 4,876,535 | blocked t12 |
| insurance | 46,400 | 46,400 | 63,699 | blocked agent's 116k write |
| payroll | 324,800 | 324,800 | 194,388 | blocked t12 |
| utilities | 187,094 | 187,094 | 184,968 | blocked t12 |
| g_and_a | 69,600 | 69,600 | 22,496 | blocked t12 |
| marketing | 69,600 | 69,600 | 43,897 | blocked t12 |
| repairs_maintenance | 69,600 | 69,600 | 134,208 | blocked t12 |
| turnover | 41,760 | 41,760 | 1,540 | blocked t12 |

**Preserved legitimate overrides (3 fields, correctly untouched):**
- `management_fee_pct`: override=0.025 ≠ om=0.0275 (real operator intent)
- `replacement_reserves`: override=58,000 ≠ om=46,400 (real operator intent)
- `contract_services`: override=28,680, om=null (no om to compare — real operator entry)

---

## Code Fixes

### 1. Read-path guard in `getOverride()` (line ~486, `proforma-seeder.service.ts`)

Added contamination guard inside the `getOverride()` closure in `buildSeed()`:

```typescript
if (
  (lv.override_source == null) &&
  lv.override != null &&
  lv.om != null &&
  lv.override === lv.om
) {
  return null;  // legacy OM contamination — falls through to t12/platform
}
```

Fires only when BOTH: `override_source` absent (pre-Task#832 era) AND `override === om`
(exact numeric match — vanishingly unlikely to be coincidental for real operator values).

### 2. Write-path guard in `seedProFormaYear1()` (line ~1192, `proforma-seeder.service.ts`)

Defense-in-depth validation runs BEFORE the DB UPSERT. Auto-heals any contaminated LV
that slips through `getOverride()` (indicates a code regression):

```typescript
for (const [field, value] of Object.entries(seed)) {
  const lv = value as Record<string, unknown>;
  if (lv.override != null && lv.om != null && lv.override === lv.om
      && (lv.override_source == null || lv.override_source === undefined)) {
    console.error(`[F-010 write-guard] BUG: ...`);
    lv.override = null;
    lv.resolved = lv.t12 ?? lv.platform ?? null;
    lv.resolution = lv.t12 != null ? 't12' : 'platform_fallback';
    warnings.push(`F-010 auto-healed: ${field}`);
  }
}
```

---

## Remediation

### 464 Bishop (deal-specific, immediate)

Ran `reseed-deal.ts` after code fix:
```
cd backend && npx ts-node --transpile-only src/scripts/reseed-deal.ts 3f32276f-aacd-4da3-b306-317c5109b403
```
Result: `seeded: true, fields_seeded: 109`. All 8 contaminated fields cleared.
Active scenario (`5f506465`) also patched via targeted SQL update on 8 fields.
Cashflow agent re-triggered: `insurance.agent = 116,000; resolved = 116,000; resolution = 'agent'`.

### Global (all deals, all scenarios)

Migration `20260521_f010_clear_om_contaminated_overrides.sql` applied:
- Scans `deal_assumptions.year1` and `deal_underwriting_scenarios.year1` for all rows
- Clears `override = null` where `override = om AND override_source IS NULL`
- Re-resolves: agent → t12 → om → platform → platform_fallback
- Preserves any `agent` values already written by the cashflow agent
- Emits RAISE NOTICE with pre/post counts for audit trail

---

## Post-Fix Verification

| Audit query | Result |
|---|---|
| `deal_assumptions`: contaminated deals (override=om, no source) | **0** |
| `deal_underwriting_scenarios`: contaminated scenarios | **0** |
| 464 Bishop `insurance.resolved` | **116,000 (agent)** |
| 464 Bishop `insurance.resolution` | **agent** |

---

## Test Coverage

### Unit regression (6 tests)
`backend/src/services/__tests__/proforma-seeder.f010-contamination.test.ts`
- Contaminated field (override==om, no source) → guard returns null → resolves from t12
- Real operator override (override_source='operator') → preserved
- Partial-mismatch override (override≠om, no source) → preserved
- `applyUserOverride` always stamps override_source='operator'
- LayeredValue hierarchy: override > t12 > om > platform
- Guard safety: does NOT fire when om is null

### End-to-end pipeline (11 tests)
`backend/src/services/__tests__/proforma-seeder.f010-e2e.test.ts`
- Full OM ingest → seed → agent → operator override pipeline
- Write-path guard fires before DB UPSERT (defense-in-depth)
- All 8 contaminated fields cleared in the seeder; 3 legitimate overrides preserved
- Agent value lands after contamination cleared
- `applyUserOverride` stamps override_source='operator' (prevents future contamination)
- Resolution hierarchy validated: override > t12 > om > platform_fallback

---

## Related

- Task #832 — added `override_source = 'operator'` stamping (prevents future contamination)
- Task #840 (F-009) — `other_income_dollars.agent` write-back fix
- Follow-up #844: Fix pre-existing invariant test failures from M40
- Follow-up #845: Global contamination scan for all scenario year1 JSONBs (now covered by migration)
