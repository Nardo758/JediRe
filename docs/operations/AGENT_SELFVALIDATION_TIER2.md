# Agent Self-Validation — Tier 2 Directional Checks

**Date:** 2026-05-27  
**File changed:** `backend/src/agents/cashflow.postprocess.ts`  
**Tier:** Tier 2 from `docs/operations/MANDATE_CONSUMER_WIRING.md §6.2`  
**Status:** SHIPPED — build verified (TS errors are pre-existing, none in cashflow.postprocess.ts)

---

## (a) State Verification

Before executing, per P8 corollary, the following were confirmed:

| Check | Result |
|---|---|
| Sub-field writeback code location | `cashflow.postprocess.ts` lines 555–654 (outer block starting at line 555) |
| Confidence gate still present | YES — line 596: `if (subField === 'post_stabilization' && conf === 'low') { continue; }` |
| Numeric value check still present | YES — line ~593: `if (typeof subVal !== 'number' \|\| !isFinite(subVal)) continue;` |
| None of 4 checks partially implemented | CONFIRMED — grep for `directional`, `DIRECTIONAL`, `inversion`, `DELTA_THRESHOLD` in postprocess returned no results |
| All 4 checks are warning-level (no rejection) | CONFIRMED — investigation recommendation; implementation follows |

---

## (b) Before / After

### Before (lines 556–654, abridged)

```typescript
// Sub-field writeback block:
{
  const SUB_FIELD_AGENT_TO_YEAR1 = { ... };  // 9 entries

  for (const [agentKey, year1Key] of Object.entries(SUB_FIELD_AGENT_TO_YEAR1)) {
    const field = pfFieldsForWriteback[agentKey];
    ...
    for (const subField of ['pre_renovation', 'post_stabilization']) {
      ...
      // confidence gate (line ~596)
      if (subField === 'post_stabilization' && conf === 'low') { continue; }
      
      const subKey = `${year1Key}__${subField}`;
      // DB write
    }
  }
}
// → No validation checks after the loop
```

### After (shipped 2026-05-27)

```typescript
{
  const SUB_FIELD_AGENT_TO_YEAR1 = { ... };

  // NEW: collection map for pre/post pairs per agentKey
  const _writtenPairs: Record<string, {
    preVal: number | null; preConf: string | null;
    postVal: number | null; postConf: string | null;
  }> = {};

  for (const [agentKey, year1Key] of Object.entries(SUB_FIELD_AGENT_TO_YEAR1)) {
    ...
    for (const subField of ['pre_renovation', 'post_stabilization']) {
      ...
      // confidence gate (unchanged)
      if (subField === 'post_stabilization' && conf === 'low') { continue; }

      // NEW: collect written value for post-loop checks
      if (!_writtenPairs[agentKey]) {
        _writtenPairs[agentKey] = { preVal: null, preConf: null, postVal: null, postConf: null };
      }
      if (subField === 'pre_renovation') {
        _writtenPairs[agentKey].preVal  = subVal;
        _writtenPairs[agentKey].preConf = conf ?? null;
      } else {
        _writtenPairs[agentKey].postVal  = subVal;
        _writtenPairs[agentKey].postConf = conf ?? null;
      }

      const subKey = `${year1Key}__${subField}`;
      // DB write (unchanged)
    }
  }

  // NEW: Tier 2 directional validation checks
  {
    const DIRECTIONAL_RULES = { ... };
    const DELTA_THRESHOLDS = { ... };
    const CONF_RANK = { high: 3, medium: 2, low: 1 };

    if (!output.validation_warnings) output.validation_warnings = [];
    const _vwarn = output.validation_warnings as Array<Record<string, unknown>>;

    for (const [agentKey, pair] of Object.entries(_writtenPairs)) {
      // Check #1 — Directional consistency
      // Check #2 — Primary value consistency (post ≈ primary ±5%)
      // Check #3 — Confidence inversion
      // Check #4 — Delta plausibility
    }
  }
}
```

---

## (c) Per-Check Implementation Summary

### Check #1 — Directional Consistency

**When it fires:** Both pre_renovation and post_stabilization written for the same agentKey; the direction of change violates the expected business plan.

**Rules:**
| Field | Expected | Example violation |
|---|---|---|
| `revenue.vacancy_loss` | post ≤ pre (vacancy should fall after renovation) | Agent claims vacancy INCREASED from 5% to 8% after value-add |
| `revenue.concessions` | post ≤ pre | Agent claims concessions grew post-renovation |
| `revenue.bad_debt` | post ≤ pre | Agent claims bad debt grew post-renovation |
| `revenue.other_income` | post ≥ pre | Agent claims other income fell after amenity upgrade |
| `expense.repairs_maintenance` | post ≤ pre | Agent claims R&M increased after renovation |
| `expense.marketing` | post ≤ pre | Agent claims marketing increased after stabilization |
| `expense.turnover` | post ≤ pre | Agent claims turnover increased after lease-up |

**Note on omissions:** `expense.replacement_reserves` has no directional rule (post_only — pre-renovation replacement reserves are not meaningful for value-add baseline). `expense.contract_services` has no rule (new amenities could legitimately increase contract costs — too contextual for deterministic enforcement).

**Warning structure:**
```json
{ "lineItem": "revenue.vacancy_loss", "check": "directional_consistency",
  "values": { "pre": 45000, "post": 62000, "expected": "post ≤ pre" },
  "ruleRef": "MANDATE_LIFT_DESIGN.md §4.4 — directional consistency",
  "action": "Verify renovation plan supports lower post-stabilization value" }
```

### Check #2 — Primary Value Consistency

**When it fires:** post_stabilization is written; its value diverges from the primary `proforma_fields[agentKey].value` (or `.resolved`) by more than 5%.

**Rationale:** Per MANDATE_LIFT_DESIGN.md §4.4, the primary field value IS the post-stabilization economics for value-add deals. If the agent writes a post_stabilization sub-field that materially differs from what it wrote as the primary value, there is an internal inconsistency.

**Tolerance:** 5% of the primary value.

**Edge case:** If the primary value is effectively zero (< 0.01), the check is skipped to avoid division-by-zero false positives.

**Warning structure:**
```json
{ "lineItem": "revenue.vacancy_loss", "check": "primary_value_consistency",
  "values": { "post": 62000, "primary": 45000, "divergencePct": 37.8 },
  "ruleRef": "MANDATE_LIFT_DESIGN.md §4.4 — post_stabilization ≈ primary ±5%",
  "action": "Verify post_stabilization value aligns with the main proforma field" }
```

### Check #3 — Confidence Inversion

**When it fires:** Both pre_renovation and post_stabilization confidence are written; post_stabilization confidence exceeds pre_renovation confidence.

**Rationale:** Pre-renovation values are anchored in T12 actuals (empirical data). Post-stabilization values are forward projections. A projection cannot be more epistemologically certain than the empirical baseline it projects from.

**Confidence rank:** `high: 3 > medium: 2 > low: 1`

**Warning structure:**
```json
{ "lineItem": "expense.repairs_maintenance", "check": "confidence_inversion",
  "values": { "preConfidence": "medium", "postConfidence": "high" },
  "ruleRef": "MANDATE_LIFT_DESIGN.md §4.3 — pre confidence ≥ post confidence",
  "action": "Pre-renovation is anchored in actuals; post is a projection and should not exceed pre confidence" }
```

### Check #4 — Delta Plausibility

**When it fires:** Both pre and post written; the absolute ratio `|post - pre| / |pre|` exceeds the field-specific plausibility threshold.

**Thresholds:**
| Field | Threshold | Rationale |
|---|---|---|
| `revenue.vacancy_loss` | 60% | >60% vacancy reduction would mean going from ~15% to ~6% in one cycle — unusual but not impossible; flag for review |
| `revenue.concessions` | 60% | Same scale |
| `revenue.bad_debt` | 60% | Same scale |
| `revenue.other_income` | 80% | Other income can grow significantly with new amenities |
| `expense.repairs_maintenance` | 80% | New-property R&M can be much lower than pre-reno |
| `expense.turnover` | 80% | Stabilized occupancy could materially reduce turnover |
| `expense.marketing` | 60% | Marketing typically halves after stabilization |
| `expense.contract_services` | 50% | Contract services shouldn't change drastically in most scenarios |

**Warning structure:**
```json
{ "lineItem": "revenue.vacancy_loss", "check": "delta_plausibility",
  "values": { "pre": 90000, "post": 18000, "deltaPct": 80.0, "thresholdPct": 60 },
  "ruleRef": "MANDATE_LIFT_DESIGN.md §4.4 — delta plausibility thresholds",
  "action": "Large delta requires strong Tier 1 or Tier 2 evidence; verify evidence source and rationale" }
```

---

## (d) Output.validation_warnings Accumulation

Warnings accumulate to `output.validation_warnings` — a new array field on the agent output object. The field is initialized lazily (`if (!output.validation_warnings) output.validation_warnings = []`).

**Format:** Each warning is a `Record<string, unknown>` with required keys: `lineItem`, `check`, `values`, `ruleRef`; optional: `action`.

**Behavior:**
- Multiple checks can fire for the same `lineItem` (e.g., both directional inversion AND delta plausibility for `revenue.vacancy_loss`)
- Each warning is appended independently; no deduplication
- The array is empty (or absent) if no warnings fire
- Existing rejection behavior is completely unchanged (confidence gate and numeric check still reject at the same lines)

**Current frontend handling:** `output.validation_warnings` is stored in the agent run result JSONB. It is NOT currently surfaced in any frontend UI. Rendering is explicitly Phase 2 work (Tier 3 per MANDATE_CONSUMER_WIRING.md §6.3). The data is present in the run result for:
- Server-side log auditing (all 4 checks also call `logger.warn` with structured data)
- Future frontend Evidence trail or Validation surface (Phase 2)
- Automated testing / regression detection

---

## (e) Testing

### Test case 1 — Directional inversion (Check #1)

Manufacture a test case: on a value-add deal, prompt the agent (or directly pass postprocess output) with:
```json
"revenue.vacancy_loss": {
  "pre_renovation":    { "value": 45000, "confidence": "high",   "source": "tier1:t12" },
  "post_stabilization":{ "value": 62000, "confidence": "medium", "source": "tier3:market_comp" }
}
```

**Expected:** `validation_warnings` contains a `directional_consistency` warning for `revenue.vacancy_loss` (post 62000 > pre 45000; expected post ≤ pre). Logger emits `[CashflowPostProcess][V1] Directional inversion`.

### Test case 2 — Clean pair (no warnings expected)

```json
"revenue.vacancy_loss": {
  "pre_renovation":    { "value": 62000, "confidence": "high",   "source": "tier1:t12" },
  "post_stabilization":{ "value": 45000, "confidence": "medium", "source": "tier3:market_comp" }
}
```

**Expected:** No `directional_consistency` warning for `revenue.vacancy_loss` (post 45000 < pre 62000 — correct direction). No `confidence_inversion` warning (high ≥ medium — correct). `delta_plausibility`: delta = |45000-62000|/62000 ≈ 27% < 60% threshold — no warning.

### Test case 3 — Confidence inversion (Check #3)

```json
"expense.repairs_maintenance": {
  "pre_renovation":    { "value": 850,  "confidence": "medium", "source": "tier1:t12" },
  "post_stabilization":{ "value": 600,  "confidence": "high",   "source": "tier2:owned_asset" }
}
```

**Expected:** `confidence_inversion` warning fires (pre=medium=2, post=high=3 → post rank > pre rank). Check #1 does not fire (post 600 ≤ pre 850 — correct direction). No delta warning (delta = 29% < 80% threshold).

### Test case 4 — Delta plausibility (Check #4)

```json
"revenue.vacancy_loss": {
  "pre_renovation":    { "value": 100000, "confidence": "high",   "source": "tier1:t12" },
  "post_stabilization":{ "value": 15000,  "confidence": "medium", "source": "tier3:market_comp" }
}
```

**Expected:** `delta_plausibility` warning fires (delta = |15000-100000|/100000 = 85% > 60% threshold). Check #1 does NOT fire (post ≤ pre — correct direction).

### Live agent test (when available)

**Prerequisite:** A value-add deal with T12 actuals loaded and cashflow agent configured to run. Run the agent; inspect the run result JSONB for `validation_warnings`. On a well-underwritten deal, expect zero or minimal warnings. On a deal with implausible assumptions, expect at least one warning.

**Note:** As of 2026-05-27, no live value-add agent run exists in the dev environment. The checks are structurally correct based on code review. Live confirmation deferred to the next agent run on a value-add deal.

---

## (e) Open Questions for Phase 2

**OQ1 — Operator UI for validation_warnings:** The data is now present in the run result. Phase 2 should surface it in the Evidence trail or a dedicated Validation surface. Design TBD.

**OQ2 — Rejection vs. warning for severe violations:** Currently all 4 checks are warning-only. For extreme violations (e.g., delta > 200%), consider adding a rejection gate. Not implemented in Phase 1 per the investigation's recommendation.

**OQ3 — Sub-field plausibility sigma enrichment:** The delta thresholds are hardcoded. Phase 3 would replace them with distribution-based thresholds from the archive cohort (sigma engine). Not in scope for Phase 2.

**OQ4 — Gap 2 comment (Dispatch B from §6.2):** The 1-line comment near the postprocess sub-field write referencing the Gap 2 Independent ruling was planned in §6.2 Dispatch B. It was not added in this dispatch to keep scope tight. Deferred to a cleanup pass.
