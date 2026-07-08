---
name: Scenario decomposition skip-key contract
description: The decomposer and verifier in scenario-decomposition.ts must share an identical DECOMP_SKIP_KEYS set; _-prefixed keys are metadata and must be excluded from overlays.
---

## Rule
`decomposeYear1ToOverlays` and `verifyOverlayEquivalence` must exclude the same set of keys. If they diverge, the verifier reports false-positive mismatches (missing_overlay / value_mismatch) on intentionally-skipped fields.

## DECOMP_SKIP_KEYS (as of 2026-07-08)
```ts
const DECOMP_SKIP_KEYS = new Set([
  'source_docs',           // metadata object
  '_boundary_context',     // metadata object
  'other_income_user_lines', // complex array, not numeric
  'last_seeded_at',        // string — decomposer skips all strings
  '_unit_count',           // underscore-prefixed metadata
  '_capital_structure_defaults', // underscore-prefixed metadata
]);
```

Plus: any key starting with `_` is metadata — decomposer guards both the plain-number path AND the unknown-object path with `if (key.startsWith('_')) continue`.

## Why
During V3 of the F-P1 Verification Session, `verifyOverlayEquivalence` produced 7 false-positive mismatches against Bishop's real year1 blob (140 keys). Root causes:
1. Metadata keys (`source_docs`, `_boundary_context`, `last_seeded_at`) skipped by decomposer but not verifier → `missing_overlay`
2. `_`-prefixed object fields (`_capital_structure_defaults`) produced an orphaned overlay in Check 2
3. `other_income_breakdown` sub-keys with `resolved=null` compared against `value ?? value_jsonb` (fell back to JSONB object vs null) → `value_mismatch`

## How to apply
- When adding a new skip to the decomposer, add the same key to `DECOMP_SKIP_KEYS` in the verifier (same file, ~10 lines above `verifyOverlayEquivalence`).
- Sub-key comparison: use `subOverlay.value` (numeric column) not `value ?? value_jsonb`. Both null means null-resolved LV → match.
- Check 2 orphan guard: `!(topKey in year1Blob) && !DECOMP_SKIP_KEYS.has(topKey) && !topKey.startsWith('_')`.
- `deal_financial_models` output column is named `results`, not `output_data`.
