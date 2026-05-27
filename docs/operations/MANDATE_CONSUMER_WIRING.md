# Mandate Consumer Wiring — Investigation

**Date:** 2026-05-27  
**Prerequisite:** `docs/operations/MANDATE_LIFT_DESIGN.md` — APPROVED FOR DOWNSTREAM WORK  
**Mandate lift status:** v1.3 production — all 9 instances confirmed in `line-item-matrix.ts`  
**Scope:** Three consumer surfaces that inherit the mandate lift. No code changes in this document.

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [RegimeExpand Component Assessment](#2-regimeexpand-component-assessment)
3. [F9 ProForma Rendering Assessment](#3-f9-proforma-rendering-assessment)
4. [Agent Self-Validation Assessment](#4-agent-self-validation-assessment)
5. [Gap 2 — Confidence Propagation Design](#5-gap-2--confidence-propagation-design)
6. [Implementation Sequencing](#6-implementation-sequencing)
7. [Statistics and Open Questions](#7-statistics-and-open-questions)

---

## 1. Executive Summary

### 1.1 State Verification

1. **Mandate lift v1.3 in production:** Confirmed. `line-item-matrix.ts` shows 9 `[VALUE-ADD/REDEVELOPMENT] May also write` instances at lines 93, 145, 194, 303, 516, 667, 716, 772, 829. `cashflow.postprocess.ts` implements sub-field writeback at lines 555–634. `proforma-adjustment.service.ts` composes `regimeDataByField` at lines 4824–4901. ✓

2. **`MANDATE_LIFT_DESIGN.md` exists with APPROVED verdict:** Confirmed. Verification section present, verdict: APPROVED FOR DOWNSTREAM WORK. ✓

3. **No prior consumer wiring investigation found:** `docs/operations/` contains no files matching `MANDATE_CONSUMER*`, `REGIME_*`, or similar. This document is new. ✓

### 1.2 Three Consumer Surfaces — Readiness at a Glance

| Surface | Current readiness | Blocking issue | Work needed |
|---|---|---|---|
| RegimeExpand component | **Mostly ready** — handles populated data correctly | Source string normalization bug (colored badge renders gray for sub-field sources) | 1 targeted fix in `sourceColor()` helper |
| F9 ProForma rendering (beyond RegimeExpand) | **Ready** — all consumers use optional chaining; no consumer breaks on populated data | None blocking | Tier 3 enhancements (Decision tab, Sensitivity) are optional polish |
| Agent self-validation | **Partial** — confidence gate enforced; no directional or delta consistency validation | Missing postprocess directional checks | Phase 2 postprocess additions |

### 1.3 Recommended Sequencing Summary

**Tier 1 — Fix source badge rendering bug in RegimeExpand.** One small file edit; unblocks visible, correctly colored data display the moment the agent runs on a value-add deal.

**Tier 2 — Add directional consistency validation to postprocess + document Gap 2 confidence ruling.** Adds guardrails against agent-written inversions. Gap 2 (confidence propagation) recommended as Independent — no file changes required; needs only a documented ruling.

**Tier 3 — F9 Decision tab + Sensitivity tab integration.** Optional polish; both tabs read primary field values today and are not broken by populated sub-field data.

---

## 2. RegimeExpand Component Assessment

**File:** `frontend/src/components/f9/RegimeExpand.tsx` (328 lines)

### 2.1 Current Behavior — Empty regimeDataByField

When `regimeData` prop is null (agent has not run, or did not write sub-fields):

```
hasAgentData = false

Pre-Renovation row:
  - If t12Value prop is non-null:
      derivedPreReno = { value: t12Value, source: 't12', note: 'trailing 12-month actual (pre-reno baseline)' }
      → Renders T12 value with green T12 source badge
  - If t12Value is also null:
      preIsPlaceholder = true
      → Renders "pending agent run" in italic (gray)

Post-Stabilization row:
  - Always renders resolvedValue with source: 'platform'

Sub-header line:
  - If T12 available: '· pre-reno from T12 actuals · post-stab from platform proforma'
  - If T12 null: '· run Cashflow Agent for per-regime values'
```

**Behavior is correct and graceful.** Operators see meaningful data before any agent run (T12 baseline), not a blank or broken state.

### 2.2 Current Behavior — Populated regimeDataByField

When `regimeData` prop is non-null with at least one non-null value (agent has run and written sub-fields):

```
hasAgentData = true  (when pre_renovation.value OR post_stabilization.value is non-null)

derivedPreReno = null  (agent data overrides T12 proxy)
preRenoRv = regimeData.pre_renovation
postStabRv = regimeData.post_stabilization

Rows rendered:
  - Pre-Renovation: agent pre_renovation value, source badge, confidence badge (H/M/L)
  - Transition Year: rendered only when regimeData.transition_year is non-null
  - Post-Stabilization: agent post_stabilization value, source badge, confidence badge

Sub-header:
  - M22 transition timing label (from transition_timing_label) shown when present
  - Delta displayed when both pre and post values are non-null (Δ format$)
```

**The rendering path for populated data is fully implemented.** Confidence badges, source provenance, delta display, and transition year row all render correctly when `regimeData` is non-null.

### 2.3 Rendering Bug — Source String Normalization

**Issue:** The `sourceColor()` helper (lines 109–112) maps source strings to badge colors using an exact-match lookup:

```typescript
const SOURCE_COLOR: Record<string, string> = {
  agent: '#a78bfa',   // violet
  platform: '#06b6d4', // cyan
  broker: '#f59e0b',
  archive: '#60a5fa',
  t12: '#34d399',     // green
  default: '#475569', // gray (fallback)
};

function sourceColor(src: string | null): string {
  if (!src) return SOURCE_COLOR.default;
  return SOURCE_COLOR[src.toLowerCase()] ?? SOURCE_COLOR.default;
}
```

The sub-field writeback in `cashflow.postprocess.ts` (line 602) stores:
```typescript
source: (subObj['source'] as string | null) ?? 'agent:cashflow'
```

The agent is expected to write evidence source strings per the MANDATE_LIFT_DESIGN.md canonical table:
- `'tier1:t12'`, `'tier1:rent_roll'`, `'tier2:owned_asset'`, `'tier3:market_comp'`, `'tier3:platform_benchmark'`, `'tier3:archive'`
- Default fallback stored by postprocess: `'agent:cashflow'`

**None of these match the SOURCE_COLOR keys.** Consequences:

| Source string stored | `sourceColor()` result | Expected | Label displayed |
|---|---|---|---|
| `'agent:cashflow'` | gray (default) | violet (agent) | `AGENT:CASHFLOW` (long, ugly) |
| `'tier1:t12'` | gray (default) | green (t12) | `TIER1:T12` (long, ugly) |
| `'tier2:owned_asset'` | gray (default) | blue (archive) | `TIER2:OWNED_ASSET` |
| `'tier3:market_comp'` | gray (default) | amber (broker) | `TIER3:MARKET_COMP` |

Every sub-field source badge currently renders gray with an ugly compound label. The colors and short labels that make the source provenance scannable are lost.

**Fix:** Normalize source strings in `sourceColor()` by extracting the tier suffix, or add the compound keys to SOURCE_COLOR, or normalize at the postprocess write stage.

Recommended fix — normalization at display time in `sourceColor()`:

```typescript
function sourceColor(src: string | null): string {
  if (!src) return SOURCE_COLOR.default;
  const key = src.toLowerCase();
  if (SOURCE_COLOR[key]) return SOURCE_COLOR[key];
  // Handle tiered source strings: 'tier1:t12' → 't12', 'agent:cashflow' → 'agent'
  const suffix = key.split(':').pop() ?? key;
  return SOURCE_COLOR[suffix] ?? SOURCE_COLOR.default;
}
```

And the source label in the badge uses `src.toUpperCase()` — add a corresponding normalization:

```typescript
// Display label normalization for tiered source strings
function sourceLabel(src: string | null): string {
  if (!src) return '';
  const parts = src.split(':');
  return parts[parts.length - 1].toUpperCase(); // 'tier1:t12' → 'T12'
}
```

**Effort:** 2 targeted edits in `RegimeExpand.tsx`. No other files affected.

### 2.4 Edge Cases From Populated Data

**Edge case A — Only one sub-field written (partial pair):**  
The MANDATE_LIFT_DESIGN.md permits partial writes ("Do not fabricate a sub-field value to complete a pair"). If only `pre_renovation` is written and `post_stabilization` is not (or vice versa):

```typescript
hasAgentData = regimeData.pre_renovation.value != null || regimeData.post_stabilization.value != null
```

If only `pre_renovation.value` is non-null → `hasAgentData = true` → `postStabRv = regimeData.post_stabilization`. But `post_stabilization.value` will be null → `fmt$(null)` returns `'—'`. The post-stab row renders a dash. This is handled correctly.

If only `post_stabilization.value` is non-null → `hasAgentData = true` → `preRenoRv = regimeData.pre_renovation` with `value: null` → pre-reno row renders `'—'` (not "pending agent run", because `isPlaceholder = !hasAgentData && derivedPreReno == null` will be false). **Minor visual inconsistency:** the operator sees `—` but might expect "pending agent run." Not broken; but the T12 fallback is lost when hasAgentData is true even for a partial pair.

**Edge case B — Delta display with one null sub-field:**  
`fmtDelta(null, someValue)` and `fmtDelta(someValue, null)` both return `'—'` (null guard at line 93). The delta display correctly suppresses itself. ✓

**Edge case C — Confidence inversion (pre 'low', post 'high'):**  
MANDATE_LIFT_DESIGN.md §4.3 notes this is epistemologically wrong (post cannot be more certain than pre for a forward projection anchored in T12 actuals). RegimeExpand will display both badges as-is — it has no validation of the relationship between pre and post confidence. The inversion will be visible to the operator (amber pre, green post) but not flagged. A future self-validation pass should catch and reject this at postprocess. See §4.3 of this document.

### 2.5 Readiness Assessment — RegimeExpand

| Feature | Status |
|---|---|
| Renders agent sub-fields when populated | READY |
| Renders T12 fallback when agent not run | READY |
| Renders "pending agent run" when both agent and T12 absent | READY |
| Confidence badges (H/M/L per sub-row) | READY |
| Delta display between pre and post | READY |
| Transition year row | READY |
| Source provenance badge — color | **BUG** — tiered source strings render gray |
| Source provenance badge — label | **BUG** — label shows full compound string |
| Partial pair handling | ACCEPTABLE (minor visual inconsistency) |
| Confidence inversion display | VISUAL ONLY (no flagging) — acceptable for Phase 1 |

**One fix needed before populated data is visually correct.**

---

## 3. F9 ProForma Rendering Assessment

### 3.1 regimeDataByField Readers Across F9

**Grep scope:** `regimeDataByField|pre_renovation|post_stabilization` across `frontend/src/` TypeScript files.

| Consumer | File | Lines | What it reads | Ready? |
|---|---|---|---|---|
| ProFormaSummaryTab — Revenue section | `ProFormaSummaryTab.tsx` | ~1656 | `data?.regimeDataByField?.[r.field] ?? null` → passed as `regimeData` prop to RegimeExpand | READY (optional chaining; graceful when absent) |
| ProFormaSummaryTab — OpEx section | `ProFormaSummaryTab.tsx` | ~1722 | Same pattern | READY |
| ProFormaSummaryTab — NOI section | `ProFormaSummaryTab.tsx` | ~1996 | Same pattern | READY |
| RegimeExpand component | `RegimeExpand.tsx` | 217–327 | Receives `regimeData` per-field prop | READY (see §2; source badge bug exists) |
| DealFinancials type (frontend) | `ProFormaSummaryTab.tsx` | ~191 | Type definition — optional field | READY |
| DealFinancials type (backend mirror) | `proforma-adjustment.service.ts` | 1989 | Type definition — optional field | READY |

**All consumers use optional chaining (`?.`).** No consumer assumes `regimeDataByField` is populated. Populated data flows correctly into RegimeExpand via the three call sites.

### 3.2 F9 Tabs Not Directly Affected

The nine F9 tabs are: Pro Forma (ProFormaSummaryTab), Projections, Assumptions, Debt, Waterfall, Sensitivity, Decision, Compare, and Overview.

The sub-field data surfaces **only through `regimeDataByField` → RegimeExpand** in the expand rows of the Pro Forma tab. The other tabs consume primary field values from `proforma_fields`, not sub-fields. Assessment:

| F9 Tab | Reads sub-fields? | Impact from populated sub-fields |
|---|---|---|
| Pro Forma (ProFormaSummaryTab) | YES — via regimeDataByField | Populate RegimeExpand expand rows (see §2) |
| Projections | NO — reads year1/yearly projections | Unaffected. Sub-fields are not projection-year values. |
| Assumptions | NO — reads deal_assumptions JSONB | Unaffected. |
| Debt | NO — reads loan assumptions + sizing | Unaffected. |
| Waterfall | NO — reads distribution / IRR calculations | Unaffected. |
| Sensitivity | NO — reads scenario variants of primary fields | Partial — see §3.3 |
| Decision | NO — reads primary resolved values for KPIs | Partial — see §3.4 |
| Compare | NO — reads scenario-level differences | Unaffected. |
| Overview | NO — reads summary KPIs | Unaffected. |

### 3.3 Sensitivity Tab — Partial Relationship

The Sensitivity tab runs scenario variants on primary field values (e.g., vacancy loss ±100bps, rent growth ±50bps). It does not read `regimeDataByField` or `pre_renovation`/`post_stabilization`.

**Indirect impact:** When a value-add deal has agent-written `post_stabilization.value` for vacancy_loss, the primary `proforma_fields.revenue.vacancy_loss.value` should equal or closely match `post_stabilization.value` (per MANDATE_LIFT_DESIGN.md §4.4 — the primary value IS the post-stabilization economics). The Sensitivity tab varies the primary field — which effectively varies the post-stabilization assumption. This is correct behavior.

**Gap (not blocking):** The Sensitivity tab has no awareness that for value-add deals, the pre-renovation vacancy rate is different from the sensitivity baseline. A sensitivity run on vacancy from 5% → 10% moves the post-stabilization assumption, not the pre-renovation assumption. For Phase 1, this is acceptable. A Tier 3 enhancement would annotate sensitivity rows with "post-stabilization sensitivity only — pre-renovation rate held constant."

### 3.4 Decision Tab — Partial Relationship

The Decision tab surfaces high-level KPIs (going-in cap, stabilized cap, yield-on-cost, IRR, equity multiple). These all derive from primary `proforma_fields` values, not from sub-fields.

**Indirect impact:** When the agent writes `post_stabilization.value` for vacancy_loss and the primary `value` matches (the expected relationship), the stabilized cap rate and stabilized NOI KPIs on the Decision tab are consistent with the agent's post-stabilization projection. No data corruption risk.

**Enhancement opportunity (Tier 3):** The Decision tab could surface a "Pre-Renovation NOI" row alongside the stabilized NOI — derived from the pre-renovation sub-field values. This would give operators a single-screen comparison of the value-add opportunity. Not a bug; not blocking. Tier 3 enhancement.

### 3.5 KPI Displays — Sensitivity to Pre/Post

**Cap rate displays** (going-in cap, stabilized cap): use `proforma_fields.revenue.effective_gross_income.resolved` and `proforma_fields.expense.total_opex.resolved` — primary resolved values. Sub-fields don't affect these. ✓

**Yield-on-cost**: computed from stabilized NOI / total cost basis. Same — primary values only. ✓

**Stabilized NOI**: derived from primary revenue − primary expenses. Pre-renovation sub-fields do not affect this number (which is correct — the Pro Forma NOI is the post-stabilization state). ✓

**No KPI display is broken or distorted by populated sub-field data.**

### 3.6 Readiness Assessment — F9 ProForma Rendering

| Surface | Ready? | Notes |
|---|---|---|
| Pro Forma tab — expand row rendering | READY (source badge bug) | Fix in RegimeExpand (Tier 1) |
| Projections tab | READY | Not affected |
| Sensitivity tab | READY with known gap | Pre-reno rates not in sensitivity scope; acceptable |
| Decision tab | READY with enhancement opportunity | Pre-reno NOI comparison is Tier 3 |
| All other tabs | READY | Not affected |

**No F9 tab breaks when sub-field data is populated.** All consumers are defensive.

---

## 4. Agent Self-Validation Assessment

### 4.1 What Self-Validation Currently Exists

The agent pipeline has two self-validation mechanisms:

**A. Prompt-side self-check (line-item-matrix.ts, lines 847–856):**  
A "Per-Field Self-Check Before Writing Output" section instructs the agent to verify, before writing output, that:
- v1.3 sub-field protocol applied for eligible fields
- Confidence tag included on all `post_stabilization` writes
- No sub-fields written for stabilized/core deals

This is advisory — the agent can ignore it if its reasoning produces conflicting output. No enforcement.

**B. Postprocess confidence gate (cashflow.postprocess.ts, lines 589–596):**  
```typescript
if (subField === 'post_stabilization' && conf === 'low') {
  // Reject low-confidence post_stabilization write
  continue;
}
```
Also: a numeric value check (must be a finite number) for both sub-fields, and a skip if `pre_renovation.value` is not numeric.

**C. Plausibility chip enrichment (cashflow.postprocess.ts, lines 1110–1168):**  
For evidence assumptions (the `evidence.assumptions` array on each field), the postprocess computes a sigma-engine z-score (`|value − prior| / std`) and assigns a plausibility band. This applies to the **primary field evidence assumptions** — not to sub-field values. Sub-fields are not currently enrolled in plausibility enrichment.

### 4.2 What Self-Validation Does NOT Currently Check

The following checks are absent from the agent pipeline:

| Missing check | Description | Risk if absent |
|---|---|---|
| Directional consistency | For vacancy_loss, concessions, bad_debt: `post_stabilization.value ≤ pre_renovation.value`. For other_income: `post_stabilization.value ≥ pre_renovation.value`. | Agent could write post vacancy HIGHER than pre (claiming renovation increased vacancy) — an inversion that would appear in RegimeExpand without any flag |
| Primary value consistency | `post_stabilization.value` should match the primary `proforma_fields[field].value` within 5% (per MANDATE_LIFT_DESIGN.md §4.4). The primary value IS the post-stabilization economics. | Agent writes post_stabilization = $120K, primary value = $85K — inconsistent pair. RegimeExpand would show them side by side only if the operator noticed the delta in the sub-header. |
| Confidence inversion | `pre_renovation.confidence` should not be lower than `post_stabilization.confidence` (actuals anchor should have higher confidence than forward projections). | Agent writes pre=low, post=high — epistemologically inverted. Currently passes all gates. |
| Delta plausibility | `|post - pre| / pre > threshold` should be flagged for sigma-engine review. MANDATE_LIFT_DESIGN.md §4.4 proposes 60% for revenue, 80% for R&M/turnover. | Agent claims 90% vacancy reduction on a value-add deal — implausible but would be written and displayed. |
| Both sub-fields absent when evidence is available | Prompt instructs the agent to write both when Tier 1 evidence is present. No enforcement when the agent omits both despite having T12 actuals. | Silent non-population: RegimeExpand falls back to T12 baseline, operator cannot distinguish "agent checked and chose not to write" from "agent never considered sub-fields." |

### 4.3 What Self-Validation SHOULD Do Post-Lift

Recommended additions to `cashflow.postprocess.ts`, after the current confidence gate (line 596):

**Directional consistency check (per-field):**  
```typescript
const DIRECTIONAL_RULES: Record<string, 'post_lte_pre' | 'post_gte_pre' | 'post_only'> = {
  'revenue.vacancy_loss':        'post_lte_pre',
  'revenue.concessions':         'post_lte_pre',
  'revenue.bad_debt':            'post_lte_pre',
  'revenue.other_income':        'post_gte_pre',
  'expense.repairs_maintenance': 'post_lte_pre',
  'expense.marketing':           'post_lte_pre',
  'expense.turnover':            'post_lte_pre',
  'expense.replacement_reserves':'post_only',
  // contract_services: post ≈ pre — no directional enforcement
};
```

When pre and post are both written, check the rule and log a warning (not a rejection — over-rejection at this stage harms data quality more than a flagged inversion).

**Primary value consistency check:**  
After sub-field writeback, compare `post_stabilization.value` against the primary year1 field value:
```typescript
if (Math.abs(postStabVal - primaryResolvedVal) / Math.abs(primaryResolvedVal) > 0.05) {
  logger.warn('[CashflowPostProcess] post_stabilization diverges from primary value by >5%', {
    dealId, agentKey, postStabVal, primaryResolvedVal
  });
}
```

**Confidence inversion check:**  
```typescript
const CONF_RANK = { high: 3, medium: 2, low: 1 };
if (preConf && postConf && CONF_RANK[preConf] < CONF_RANK[postConf]) {
  logger.warn('[CashflowPostProcess] Confidence inversion: pre_renovation confidence lower than post_stabilization', {
    dealId, agentKey, preConf, postConf
  });
}
```

**Delta plausibility check:**  
```typescript
const DELTA_THRESHOLDS: Record<string, number> = {
  'revenue.vacancy_loss': 0.60, 'revenue.concessions': 0.60,
  'revenue.bad_debt': 0.60, 'revenue.other_income': 0.80,
  'expense.repairs_maintenance': 0.80, 'expense.turnover': 0.80,
  'expense.marketing': 0.60, 'expense.contract_services': 0.50,
};
const delta = Math.abs(postVal - preVal) / Math.abs(preVal);
if (DELTA_THRESHOLDS[agentKey] && delta > DELTA_THRESHOLDS[agentKey]) {
  logger.warn('[CashflowPostProcess] Sub-field delta exceeds plausibility threshold', {
    dealId, agentKey, delta, threshold: DELTA_THRESHOLDS[agentKey]
  });
}
```

All four checks should be warnings (not rejections), logged with structured data for future audit. Rejection logic remains only for: numeric value check, low-confidence `post_stabilization`.

### 4.4 Cross-Reference: MANDATE_LIFT_DESIGN.md §4 Validation Rules

| Validation rule from MANDATE_LIFT_DESIGN.md §4.4 | Enforcement location | Currently enforced? |
|---|---|---|
| Revenue post ≤ pre (vacancy, concessions, bad_debt) | postprocess | NO |
| Revenue post ≥ pre (other_income) | postprocess | NO |
| Expense post ≤ pre (R&M, turnover) | postprocess | NO |
| Expense post ≥ pre (contract_services with new amenities) | postprocess (too contextual) | NO — too case-specific for deterministic enforcement |
| Delta >60% flag for revenue fields | postprocess | NO |
| Delta >80% flag for R&M/turnover | postprocess | NO |
| Primary value consistency (post ≈ primary ±5%) | postprocess | NO |
| Evidence tier check for pre_renovation | prompt-side only | PARTIAL |
| Confidence tag required for post_stabilization | postprocess | YES ✓ |
| 'low' confidence post_stabilization rejected | postprocess | YES ✓ |

**9 of 11 validation rules are unimplemented in the postprocess.** Both implemented rules are confidence-gate related. All directional, delta, and primary-consistency checks are prompt-side advisory only.

### 4.5 Readiness Assessment — Agent Self-Validation

| Validation | Status |
|---|---|
| Numeric value presence check | READY ✓ |
| Low-confidence post rejection | READY ✓ |
| Directional consistency | NOT IMPLEMENTED (Phase 2) |
| Primary value consistency | NOT IMPLEMENTED (Phase 2) |
| Confidence inversion detection | NOT IMPLEMENTED (Phase 2) |
| Delta plausibility | NOT IMPLEMENTED (Phase 2) |
| Sub-field plausibility sigma enrichment | NOT IMPLEMENTED (Phase 3) |

**The current postprocess is safe but not defensive.** Inversions and implausible deltas can be written. For Phase 1, this is acceptable — the volume of value-add deals running the agent is low and operator review of RegimeExpand rows acts as a human check. For Phase 2, add the four warning checks.

---

## 5. Gap 2 — Confidence Propagation Design

### 5.1 The Question

When the agent writes sub-fields with asymmetric confidence — e.g., `pre_renovation.confidence = 'high'` and `post_stabilization.confidence = 'medium'` — how does the parent `proforma_fields[field]` confidence surface to consumers that don't know about sub-fields (JEDI Score, OperatorStance, deal summary badges)?

Three groups of consumers exist:
1. **Sub-field-aware:** RegimeExpand — reads per-sub-field confidence directly and renders H/M/L badges per row
2. **Primary field aware:** JEDI Score, OperatorStance, ProFormaSummaryTab primary row badge — read the main `confidence` on the proforma field LayeredValue
3. **Aggregated:** deal-level completeness scores, confidence trend indicators

The question affects groups 2 and 3: do sub-field confidence values change what group 2 and 3 consumers see?

### 5.2 Four Options Analyzed

**Option 1 — Inherit the lower of pre/post (conservative)**  
Parent confidence = `min(pre.confidence, post.confidence)`.  
- Pros: Surfaces uncertainty. If post is 'medium', the parent is 'medium' even if pre is 'high'.  
- Cons: The primary field confidence was established by the main evidence tier resolution (T12 actuals, comps, benchmarks) independent of sub-field analysis. Sub-fields are supplementary detail — downgrading the parent confidence based on sub-field granularity retroactively degrades JEDI Score, OperatorStance, and every other consumer that reads the primary confidence. This is an overreach: the primary value (post-stabilization Pro Forma) was not made less certain by the agent writing a sub-field — it was made more detailed.

**Option 2 — Inherit the higher of pre/post (optimistic)**  
Parent confidence = `max(pre.confidence, post.confidence)`.  
- Pros: none meaningful for financial modeling.  
- Cons: Allows a low-quality post-stabilization projection to be masked by a high-confidence T12 pre-renovation actuals read. Not appropriate.

**Option 3 — Independent (parent confidence unchanged by sub-fields)**  
The primary field's `confidence` is set by its own evidence tier resolution. Sub-fields provide additional granularity but do not retroactively change the primary field confidence. Sub-field confidence is surfaced only in RegimeExpand's per-row badges.  
- Pros: No unintended side effects on JEDI Score, OperatorStance, or any consumer reading primary confidence. The postprocess confidence gate (rejects low-confidence post) already acts as the enforcement layer. RegimeExpand already displays sub-field confidence independently. Clean separation of concerns.  
- Cons: An operator looking at the primary row badge (green H) would not know that the post-stabilization sub-field is 'medium'. But this is a UX concern, not a correctness concern.

**Option 4 — Weighted by strategy (value-add weights post; stabilized weights pre)**  
For value-add deals, the forward assumption matters more, so weight post confidence higher in parent derivation.  
- Pros: Strategy-sensitive.  
- Cons: Complex to implement, context-dependent, and requires deal_type to flow into the confidence derivation logic — which has no current pattern. The required weighting logic would be bespoke and opaque to downstream consumers.

### 5.3 Recommendation — Option 3: Independent

**Adopt Option 3 (Independent).** Sub-field confidence does not modify the parent LayeredValue confidence.

**Rationale:**

1. The postprocess confidence gate already enforces the key safety property: `post_stabilization` with confidence 'low' is rejected and not written. If the agent's post-stabilization projection is low-quality, no sub-field is written at all. The parent confidence is therefore never contaminated by low-quality sub-field data — it can only be enriched by medium or high confidence sub-fields.

2. RegimeExpand already surfaces sub-field confidence visually at the per-row level (H/M/L badges), which is more informative than a single parent badge that aggregates both sub-fields into one signal. The UX is already correct for sub-field-aware surfaces.

3. Option 1 (conservative) would silently degrade JEDI Score and OperatorStance for every value-add deal the agent runs on — a side effect that is invisible to operators and misleading to downstream consumers who have no mechanism to distinguish "confidence degraded by sub-field addition" from "confidence degraded by weak primary evidence."

4. Introducing any parent confidence modification would require the modification to flow through the `proforma_fields[field].confidence` write path in the postprocess — changing the behavior of the main write loop, which is a higher-risk change than a display-level fix.

### 5.4 Implementation Impact of Option 3

**No file changes required.** The ruling is purely a documented design decision.

| Consumer | Impact |
|---|---|
| RegimeExpand | Already handles sub-field confidence independently via `rv.confidence` prop. ✓ |
| JEDI Score | No change — reads primary field confidence only. ✓ |
| OperatorStance | No change — reads primary field confidence only. ✓ |
| Deal summary confidence badges | No change. ✓ |
| postprocess confidence gate | No change needed — 'low' post rejection already implemented. ✓ |

**The only required action:** Document this ruling (this section serves that purpose). Any future developer who considers Option 1 should be referred here before modifying the postprocess confidence write.

---

## 6. Implementation Sequencing

### 6.1 Tier 1 — Immediate (unlocks visible, correctly colored sub-field data)

**One dispatch — fix source string normalization in RegimeExpand:**

| Work item | File | Effort | Impact |
|---|---|---|---|
| Fix `sourceColor()` to handle tiered strings (`'tier1:t12'` → T12 color) | `RegimeExpand.tsx` | ~5 lines | Source badge shows correct color and short label for agent sub-fields |
| Fix source label display (`src.toUpperCase()` → normalized last segment) | `RegimeExpand.tsx` | ~3 lines | Badge shows `T12` not `TIER1:T12` |

**Result:** When the cashflow agent runs on a value-add deal and writes pre/post sub-fields, RegimeExpand immediately shows correct color-coded provenance badges alongside the H/M/L confidence indicators and delta value. The mandage lift becomes visually useful.

**Estimated effort:** 1 small dispatch, ~30 minutes.

### 6.2 Tier 2 — Next (consistency + validation + Gap 2 ruling)

**Two dispatches:**

**Dispatch A — Add postprocess directional consistency and delta validation:**

| Work item | File | Effort |
|---|---|---|
| Add `DIRECTIONAL_RULES` map and directional check (warning, not rejection) | `cashflow.postprocess.ts` | ~20 lines |
| Add primary value consistency check (post vs primary ±5% warning) | `cashflow.postprocess.ts` | ~10 lines |
| Add confidence inversion detection (pre lower than post — warning) | `cashflow.postprocess.ts` | ~8 lines |
| Add delta plausibility threshold map and check | `cashflow.postprocess.ts` | ~15 lines |

All additions are warning-level (`logger.warn`) only. No change to existing rejection logic.

**Estimated effort:** 1 medium dispatch, ~2 hours.

**Dispatch B — Document Gap 2 confidence propagation ruling:**  
This document serves as the ruling. No code change required. A code comment should be added near the postprocess sub-field write to reference this document:

```typescript
// Gap 2 ruling (MANDATE_CONSUMER_WIRING.md §5.3): sub-field confidence is Independent
// of the parent proforma field confidence. Do not modify proforma_fields[field].confidence
// based on sub-field confidence values.
```

**Estimated effort:** 1 line comment, ~5 minutes.

### 6.3 Tier 3 — Broader Polish (optional)

| Work item | File | Effort | Value |
|---|---|---|---|
| Decision tab — Pre-Renovation NOI row alongside Stabilized NOI | `DecisionTab.tsx` or equivalent | Medium | Operators see value-add delta on the decision screen |
| Sensitivity tab — annotation that sensitivity is on post-stab values only | `SensitivityTab.tsx` | Small | Reduces operator confusion about what's being varied |
| Sub-field plausibility sigma enrichment | `cashflow.postprocess.ts` | Large | Delta flags backed by cohort distribution data, not hardcoded thresholds |
| Partial pair visual indicator | `RegimeExpand.tsx` | Small | Show "no T12 baseline available" when hasAgentData=true but pre=null |

---

## 7. Statistics and Open Questions

### 7.1 Consumer Counts

| Category | Count |
|---|---|
| Total `regimeDataByField` consumers identified | 6 (3 ProFormaSummaryTab call sites + RegimeExpand + 2 type definitions) |
| Raw lines matching `regimeDataByField` in grep | 11 (includes composer declarations, comments) |
| Consumers ready with no work needed | 5 of 6 (all except RegimeExpand source badge) |
| Consumers with bugs | 1 (RegimeExpand source badge — Tier 1 fix) |
| Consumers with enhancement opportunities | 2 (Decision tab, Sensitivity tab — Tier 3) |

### 7.2 Rendering State

| RegimeExpand state | Current behavior | Target behavior |
|---|---|---|
| regimeData = null, T12 available | Green T12 pre-reno baseline | (same — already correct) |
| regimeData = null, T12 null | "pending agent run" italic | (same — already correct) |
| regimeData populated, source = 'tier1:t12' | Gray badge, 'TIER1:T12' label | Green badge, 'T12' label |
| regimeData populated, source = 'agent:cashflow' | Gray badge, 'AGENT:CASHFLOW' label | Violet badge, 'AGENT' label |
| regimeData partially populated (one null sub-field) | Dash for null sub-field, correct for non-null | Acceptable (no change needed for Phase 1) |

### 7.3 Self-Validation State

| Check | Enforced today | Phase |
|---|---|---|
| Numeric value presence | YES ✓ | — |
| Low-confidence post rejection | YES ✓ | — |
| Directional consistency | NO | Tier 2 |
| Primary value consistency | NO | Tier 2 |
| Confidence inversion detection | NO | Tier 2 |
| Delta plausibility | NO | Tier 2 |
| Sigma-engine sub-field plausibility | NO | Tier 3 |

### 7.4 Open Questions for Review

**OQ1 — Gap 2 confidence propagation: confirm Independent ruling.**  
This document recommends Option 3 (Independent). The ruling has no code impact today. Confirm before any future work that touches the postprocess write path for `proforma_fields[field].confidence`.

**OQ2 — Backfill: do prior agent runs need to be re-executed to get sub-field data?**  
Value-add deals that ran the cashflow agent before v1.3 will have `year1` JSONB entries without sub-field keys. `regimeDataByField` will be absent for those deals — RegimeExpand falls back to T12/platform baseline (graceful). Forward-only is recommended: operators who re-run the cashflow agent on existing deals will get populated sub-fields automatically. No forced re-execution needed.

**OQ3 — UI: should empty regimeDataByField render differently than populated-but-all-null?**  
Current logic: `hasAgentData = pre_renovation.value != null || post_stabilization.value != null`. If both values are null (regimeData is present but both values are null — possible if the composer includes the field but both agent and T12 are null), RegimeExpand behaves as if `hasAgentData = false` (derivedPreReno logic) but the sub-header skips the "run Cashflow Agent" hint since `!hasAgentData && derivedPreReno == null` is checked. This edge case should be confirmed or the composer's null filtering (line 4864 in `proforma-adjustment.service.ts` — "omit entries where both pre and post are null") should be verified as preventing it.

**OQ4 — Which Tier 1 work fires first?**  
Only one Tier 1 item exists (source badge fix in RegimeExpand). This should be dispatched as the next single-surface fix following this investigation. A value-add deal with a live cashflow agent run will confirm it works end-to-end.

---

## Source Citation Index

| Claim | File | Lines | Status |
|---|---|---|---|
| RegimeExpand renders populated regimeData (hasAgentData path) | `RegimeExpand.tsx` | 228–327 | VERIFIED — read in full |
| RegimeExpand source badge rendering via sourceColor() | `RegimeExpand.tsx` | 100–112, 187–199 | VERIFIED — bug confirmed (tiered strings not handled) |
| Sub-field writeback stores 'agent:cashflow' as default source | `cashflow.postprocess.ts` | 602 | VERIFIED |
| Sub-field keys in SUB_FIELD_AGENT_TO_YEAR1 | `cashflow.postprocess.ts` | 566–576 | VERIFIED — 9 fields |
| Confidence gate — only post_stabilization.confidence='low' rejected | `cashflow.postprocess.ts` | 589–596 | VERIFIED |
| Plausibility chip enrichment covers evidence assumptions, not sub-fields | `cashflow.postprocess.ts` | 1110–1168 | VERIFIED |
| regimeDataByField consumers — 3 call sites, 2 type defs | `ProFormaSummaryTab.tsx` | ~191, ~1656, ~1722, ~1996 | VERIFIED (per MANDATE_LIFT_DESIGN.md §3 and independent grep) |
| Null filtering in composer — entries with both null omitted | `proforma-adjustment.service.ts` | 4864 | VERIFIED per MANDATE_LIFT_DESIGN.md §3.3 |
| No prior MANDATE_CONSUMER* or REGIME_* investigation files | `docs/operations/` | directory listing | VERIFIED — none found |
