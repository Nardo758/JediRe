# Single-Value Mandate Lift — Design Document

**Date:** 2026-05-27
**Task:** #1352
**Status:** Complete — all six sections produced
**Q1 dependency:** RESOLVED — A2 confirmed (Task #1350 / A1_VS_A2 investigation). `deal_type` is canonical.

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Mandate Inventory](#2-mandate-inventory)
3. [Downstream Consumer Inventory](#3-downstream-consumer-inventory)
4. [Lift Rules Per Line Item](#4-lift-rules-per-line-item)
5. [Prompt Redesign](#5-prompt-redesign)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Open Questions](#7-open-questions)

---

## 1. Executive Summary

### 1.1 State Verification

**MANDATE_LIFT_DESIGN.md:** Did not exist prior to this document — confirmed by directory listing of `docs/operations/`.

**Single-Value Mandate in `line-item-matrix.ts`:** The mandate is **no longer present** in the current file. `line-item-matrix.ts` is at v1.3, which replaced the original v1.2 Single-Value Mandate with a conditional sub-field write protocol. The prior verification pass (STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md §3c) correctly documented the mandate's existence at the time of that investigation, but a subsequent implementation task updated the file to v1.3 before Task #1352 ran.

**`regimeDataByField` writer:** The prior investigation (§3c.3) found zero backend writers. This has changed — `proforma-adjustment.service.ts` lines 4824–4901 now contain a full composer that reads agent-written sub-fields from `year1Seed` and falls back to T12 actuals for `pre_renovation`. `regimeDataByField` is now populated for value_add, redevelopment, and development deal types.

### 1.2 What Has Changed Since the Prior Investigation

| Component | Prior State (v1.2) | Current State (v1.3) |
|---|---|---|
| `line-item-matrix.ts` prompt | Single-Value Mandate — 9 prohibitory instances | Conditional Sub-Field Write Protocol — 9 permission instances |
| `proforma-adjustment.service.ts` | No `regimeDataByField` writer | Full composer (lines 4824–4901) with agent-sub-field read + T12 fallback |
| `cashflow.postprocess.ts` | No sub-field writeback | Sub-field writeback with confidence gate (lines 555–614) |
| `RegimeExpand.tsx` | Always rendered dashes (all data null) | Renders T12 baseline pre-reno + platform post-stab without agent; agent values override when present |

### 1.3 Scope of This Document

This document retrospectively designs and documents the lift decisions made in v1.3, and identifies implementation gaps that remain. It covers: original mandate inventory, downstream consumer behavior, per-field lift rules, prompt design rationale, and remaining implementation work.

The Q1 dependency (A1 vs A2 canonical field) is resolved: A2 confirmed. `deal_type` is canonical. The v1.3 prompt correctly uses "value-add and redevelopment deals" language which maps to `deal_type IN ('value_add', 'redevelopment')`.

---

## 2. Mandate Inventory

### 2.1 Original v1.2 Single-Value Mandate

The original v1.2 mandate appeared in the "Output Slots Populated" section of each of the 9 eligible fields. Based on the investigation in STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md §3c, the mandate language was prohibitory — the agent was instructed to produce a single post-stabilization value and not write `pre_renovation` or `post_stabilization` sub-fields.

**How the mandate was structured:** Each "Output Slots Populated" section for a regime-sensitive field contained a prohibition against sub-field writes. The v1.3 header comment (lines 8–16 of `line-item-matrix.ts`) describes the change: v1.2 produced "ONE primary value" with no sub-fields; v1.3 conditionally permits sub-fields "subject to minimum evidence thresholds."

### 2.2 The Nine Mandate Instances — Field Inventory

All 9 mandate instances corresponded to the same 9 fields now listed in the Sub-Field Write Protocol eligible table:

| Instance # | Field key | Field label | Pattern B deal types | Current v1.3 treatment |
|---|---|---|---|---|
| 1 | `revenue.vacancy_loss` | Vacancy Loss | value_add, redevelopment, development | "May also write pre_renovation and post_stabilization sub-fields" (Output Slots line 93) |
| 2 | `revenue.concessions` | Concessions | value_add, redevelopment, development | "May also write pre_renovation and post_stabilization sub-fields" (Output Slots line 145) |
| 3 | `revenue.bad_debt` | Bad Debt | value_add, redevelopment | "May also write pre_renovation and post_stabilization sub-fields" (Output Slots line 194) |
| 4 | `revenue.other_income` | Other Income | value_add, redevelopment | "May also write pre_renovation and post_stabilization sub-fields" (Output Slots line 303) |
| 5 | `expense.repairs_maintenance` | Repairs & Maintenance | value_add, redevelopment | Covered by central Sub-Field Write Protocol only (no explicit Output Slots note) |
| 6 | `expense.marketing` | Marketing | value_add, redevelopment, development | Covered by central Sub-Field Write Protocol only (no explicit Output Slots note) |
| 7 | `expense.contract_services` | Contract Services | value_add, redevelopment | Covered by central Sub-Field Write Protocol only (no explicit Output Slots note) |
| 8 | `expense.turnover` | Turnover Cost | value_add, redevelopment, development | "May also write pre_renovation and post_stabilization sub-fields" (Output Slots line 769) |
| 9 | `expense.replacement_reserves` | CapEx Reserve | value_add, redevelopment | "May write post_stabilization sub-field only" (Output Slots line 826) |

**Output Slots coverage gap (items 5, 6, 7):** Three fields — repairs_maintenance, marketing, contract_services — have their per-field "Output Slots" section without an explicit sub-field mention. They are governed only by the central Sub-Field Write Protocol section. This is an inconsistency risk: the agent may not recognize these three as eligible if it reads only the per-field cells. See Open Question Q1.

### 2.3 Similar Mandate Language in Other Files

Search of all backend and frontend TypeScript source files for the original mandate language ("single value", "do not write sub-field", "pre_renovation forbidden") returned no additional instances. The mandate was localized entirely to `line-item-matrix.ts`.

The v1.3 conditional protocol language appears in `line-item-matrix.ts`, `cashflow.postprocess.ts` (as mirror enforcement), and `proforma-adjustment.service.ts` (as composer comment). No other files contain mandate language.

---

## 3. Downstream Consumer Inventory

### 3.1 `regimeDataByField` Readers

| Consumer | File | Lines | What it does with populated data |
|---|---|---|---|
| ProFormaSummaryTab call site 1 (Revenue section) | `ProFormaSummaryTab.tsx` | 1639 | `regimeData={data?.regimeDataByField?.[r.field] ?? null}` → passes to RegimeExpand |
| ProFormaSummaryTab call site 2 (OpEx section) | `ProFormaSummaryTab.tsx` | 1705 | `regimeData={data?.regimeDataByField?.[r.field] ?? null}` → passes to RegimeExpand |
| ProFormaSummaryTab call site 3 (NOI section) | `ProFormaSummaryTab.tsx` | 1979 | `regimeData={data?.regimeDataByField?.[r.field] ?? null}` → passes to RegimeExpand |
| RegimeExpand component | `frontend/src/components/f9/RegimeExpand.tsx` | 228–254 | Renders pre-renovation and post-stabilization rows; see §3.2 |
| DealFinancials type definition | `ProFormaSummaryTab.tsx` | 191–196 | `regimeDataByField?: Record<string, { pre_renovation: ..., post_stabilization: ... }>` — optional (graceful when absent) |
| DealFinancials type definition (backend mirror) | `proforma-adjustment.service.ts` | 1989 | Same shape — `regimeDataByField?:` optional |

**Total call sites: 3.** All are reads via optional chaining `?.` — none assume the field is populated.

### 3.2 RegimeExpand Component Behavior

`RegimeExpand.tsx` implements a two-tier display strategy:

**When `regimeData` is null (no agent sub-fields written):**
- `hasAgentData = false`
- Pre-renovation row: derives from `t12Value` prop. If T12 value is available, shows "trailing 12-month actual (pre-reno baseline)" labeled `T12` (green source badge). If T12 is also null, pre-renovation row renders "pending agent run" in italic.
- Post-stabilization row: shows `resolvedValue` (the primary Pro Forma value) labeled `platform`.
- Sub-header shows "· pre-reno from T12 actuals · post-stab from platform proforma"

**When `regimeData` is non-null (agent sub-fields written):**
- `hasAgentData = true` when either `pre_renovation.value` or `post_stabilization.value` is non-null
- Pre-renovation row: uses `regimeData.pre_renovation` (agent-sourced, labeled `AGENT` with violet badge)
- Post-stabilization row: uses `regimeData.post_stabilization` (agent-sourced)
- Optional transition year row: renders when `regimeData.transition_year` is non-null (agent-written, labeled with M22 `transition_timing_label` when present)
- Confidence indicator: renders a one-letter confidence badge (H/M/L) with color coding (green/amber/red) per sub-field

**Delta display:** Calculates delta between pre-renovation and post-stabilization values; shown in sub-header when both values are non-null.

**Graceful handling:** RegimeExpand never assumes the field is populated. It degrades gracefully to T12/platform baseline before agent runs.

### 3.3 `regimeDataByField` Composer in `proforma-adjustment.service.ts`

Lines 4824–4901 implement the full population logic:

1. **Pattern B field set by deal type** (lines 4832–4836): `_PATTERN_B_BY_DEAL_TYPE` maps deal types to eligible field keys — mirrors `m09_line_item_patterns.ts` PATTERN_TABLE. Development deals get only 4 fields (vacancy_loss, concessions, marketing, turnover); value_add gets 8; redevelopment gets 9.

2. **Agent sub-field lookup** (lines 4872–4879): For each Pattern B field, reads `year1Seed['{year1Key}__pre_renovation']` and `year1Seed['{year1Key}__post_stabilization']` from the active scenario's `year1` JSONB. These are written by `cashflow.postprocess.ts` sub-field writeback.

3. **Priority layering** (lines 4881–4896): Agent values take priority over T12/platform baseline. Shape:
   - `pre_renovation.value`: agent sub-field if present; otherwise `_row.t12`
   - `pre_renovation.source`: agent source string; otherwise `'t12'`
   - `post_stabilization.value`: agent sub-field if present; otherwise `_row.resolved`
   - `post_stabilization.source`: agent source; otherwise `_row.resolution ?? _row.source ?? 'platform'`

4. **Null filtering** (line 4864): Entries where both pre and post are null are omitted from the map. `regimeDataByField` is only set when at least one field has data.

### 3.4 `cashflow.postprocess.ts` Sub-Field Writeback

Lines 555–614 implement sub-field writeback from agent output to `deal_underwriting_scenarios.year1`:

**Field key mapping** (`SUB_FIELD_AGENT_TO_YEAR1`, lines 566–576): Maps agent field keys (e.g., `revenue.vacancy_loss`) to year1 JSONB storage keys (e.g., `vacancy_loss_dollars`). All 9 eligible fields are covered.

**Storage key convention**: `{year1Key}__pre_renovation` and `{year1Key}__post_stabilization` (double underscore separator).

**Confidence gate** (lines 589–596): `post_stabilization` sub-fields with confidence `'low'` are rejected and not written. `pre_renovation` sub-fields without a numeric value are skipped. `pre_renovation` sub-fields have no confidence gate — high confidence is expected from T12-anchored actuals.

**Written payload**: `{ value, confidence, source, note }` — JSONB.

### 3.5 Agent Self-Validation for Sub-Fields

**No dedicated self-validation logic found** for sub-fields in the agent pipeline. The `Per-Field Self-Check Before Writing Output` section in `line-item-matrix.ts` (lines 847–856) includes a checklist item for the v1.3 sub-field protocol, but this is prompt-side guidance, not postprocess enforcement. The postprocess enforces only the confidence gate for `post_stabilization`. There is no validation that:
- `post_stabilization.value` is directionally consistent with `pre_renovation.value` (e.g., revenue post > pre for value-add)
- The delta between sub-fields is plausible against the sigma engine
- Both sub-fields are written when evidence is available (vs. only one being written)

This is a gap. See Open Question Q2.

---

## 4. Lift Rules Per Line Item

### 4.1 Strategy-Conditional Conditions for Pre/Post Writes

**Canonical signal (Q1 resolved — A2):** `deal_type`. Write sub-fields only when `deal_type` is `'value_add'` or `'redevelopment'`. Development deal type (`'development'`) is excluded from sub-field writes in the v1.3 protocol — development deals have no "pre-renovation" regime in the traditional sense; they have a lease-up ramp which is modeled differently via Projections tab per-year overrides.

**Materiality gate:** The regime split must be material — pre and post values must differ by more than 5%. This prevents meaningless sub-field pairs for line items with negligible regime sensitivity (e.g., management fee).

| Field | Write condition | Regime direction | Pre-reno expected direction | Post-stab expected direction |
|---|---|---|---|---|
| vacancy_loss | value_add OR redevelopment | Post < Pre (lower vacancy post-renovation) | Elevated (renovation disruption + leasing friction) | Normalized market vacancy |
| concessions | value_add OR redevelopment | Post ≤ Pre (concessions compress at higher tier) | Current market concessions + renovation disruption | Renovated-tier concession level (typically lower) |
| bad_debt | value_add OR redevelopment | Post ≤ Pre (higher-credit tenant base post-renovation) | Pre-renovation tenant credit profile | Post-renovation normalized credit loss |
| other_income | value_add OR redevelopment | Post ≥ Pre (new ancillary programs enabled by renovation) | Existing T12 programs only | T12 programs + new programs (RUBS, pet, parking) |
| repairs_maintenance | value_add OR redevelopment | Post < Pre (renovated systems reduce R&M) | Distressed pre-reno R&M ($600–900/unit/yr) | Post-renovation normalized R&M ($350–550/unit/yr) |
| marketing | value_add OR redevelopment | Post ≤ Pre (launch costs excluded from stabilized) | Elevated during repositioning | Steady-state ILS + digital |
| contract_services | value_add OR redevelopment | Post ≈ Pre (low sensitivity) unless major new amenities | T12 existing contracts | T12 contracts + new amenity contracts |
| turnover | value_add OR redevelopment | Post < Pre (renovation stickiness) | 50–70% annual turnover during renovation | 30–40% post-renovation stabilized |
| replacement_reserves | value_add OR redevelopment | Post only; pre not written | N/A | Post-renovation reserve rate ($150–250/unit/yr near-term) |

### 4.2 Evidence Requirements Per Sub-Field

**`pre_renovation` sub-field:**
- Minimum evidence tier: Tier 1 (T12 actuals for this specific line item) or Tier 2 (owned-portfolio actuals for a comparable pre-renovation asset)
- Tier 3-only evidence (benchmarks, comps without actuals): do NOT write the sub-field; capture the pre-renovation value estimate in `evidence.reasoning` only
- Exception: `replacement_reserves` — no `pre_renovation` write ever; the pre-renovation reserve is not meaningful as a forward assumption
- Exception: `contract_services` — Tier 1 T12 by service type required; aggregated T12 qualifies only if the split is derivable

**`post_stabilization` sub-field:**
- Always requires a confidence tag (`'high'`, `'medium'`, or `'low'`)
- Confidence `'low'`: rejected at postprocess; do NOT write; keep value in evidence.reasoning
- Confidence `'medium'` or `'high'`: write the sub-field
- Must include a `note` string explaining the stabilization target and comp evidence
- Should match or closely approximate the primary `value` field (which is the post-stabilization Pro Forma value)

**Evidence source strings (canonical):**

| Evidence tier | Source string |
|---|---|
| T12 actuals | `'tier1:t12'` |
| Rent roll actual | `'tier1:rent_roll'` |
| Owned-portfolio actuals | `'tier2:owned_asset'` |
| Market comp / renovation ceiling comp | `'tier3:market_comp'` |
| Platform benchmark | `'tier3:platform_benchmark'` |
| Archive cohort | `'tier3:archive'` |

### 4.3 Confidence Calibration Per Sub-Field Type

**`pre_renovation` confidence:**
- High: T12 separately tracks this line item, trailing 12-month average stable, value within expected range for asset class/vintage
- Medium: T12 available but aggregated (requires estimation from totals), or T12 shows volatility in the trailing period
- Low: No T12; extrapolated from Tier 3 only — sub-field should not be written in this case

**`post_stabilization` confidence:**
- High: renovation ceiling comp set available and directly comparable (same tier, submarket, vintage band); owned-portfolio post-renovation actuals available; posture assessment supports the projection
- Medium: comp set available but sparse; owned-portfolio from different geography; forward assumption requires normalization with identifiable uncertainty
- Low: no direct evidence for post-renovation state; forward projection is speculative — postprocess gate rejects this; use evidence.reasoning only

**Relationship rule:** `pre_renovation` confidence should typically be higher than `post_stabilization` confidence, because pre is anchored in actuals while post is a forward projection. An agent that writes `pre_renovation` confidence `'low'` and `post_stabilization` confidence `'high'` has inverted the expected epistemology and should be flagged.

### 4.4 Validation Rules Per Sub-Field

**Directional consistency:**
- Revenue line items (vacancy_loss, concessions, bad_debt): `post_stabilization.value ≤ pre_renovation.value` (lower losses post-renovation)
- Revenue line items (other_income): `post_stabilization.value ≥ pre_renovation.value` (higher ancillary income post-renovation)
- Expense line items with renovation-driven reduction (repairs_maintenance, turnover): `post_stabilization.value ≤ pre_renovation.value`
- Expense line items with renovation-driven increase (contract_services with new amenities): `post_stabilization.value ≥ pre_renovation.value`
- Marketing: typically `post_stabilization.value ≤ pre_renovation.value` (launch costs removed)
- Replacement reserves: post-only field; no directional consistency check with pre

**Sigma-engine delta flags (proposed — not yet implemented):**
- Flag when `|post - pre| / pre > 0.60` for any revenue line item as potentially aggressive
- Flag when `|post - pre| / pre > 0.80` for R&M or turnover (these can legitimately move a lot post-renovation, but beyond 80% is worth flagging)
- Flag when `post_stabilization.value` differs from the primary `value` field by more than 5% (the two should be nearly identical — if not, the agent may have written inconsistent numbers)

**Primary value consistency rule:** `post_stabilization.value` should equal or closely match the primary `proforma_fields[field].value`. The primary value IS the post-stabilization Economics — a material divergence (>5%) indicates a logic error in the agent output.

---

## 5. Prompt Redesign

### 5.1 What the v1.3 Prompt Implements

The v1.3 prompt replaced the 9 prohibitory mandate instances with the following conditional permission language:

**Per-field replacement (6 of 9 fields with explicit Output Slots note):**
```
[VALUE-ADD/REDEVELOPMENT] May also write `pre_renovation` and `post_stabilization`
sub-fields — see Sub-Field Write Protocol (Tier 1 evidence required for pre; min
'medium' confidence required for post)
```

**Replacement for replacement_reserves (post-only):**
```
[VALUE-ADD/REDEVELOPMENT] May write `post_stabilization` sub-field only (post-renovation
reserve rate distinct from T12; pre variation is minimal) — see Sub-Field Write Protocol
```

**Central Sub-Field Write Protocol section** (lines 860–928) consolidates all rules in one place:
- Eligibility gate (deal type + field eligibility + 5% materiality threshold)
- Eligible fields table with minimum evidence requirements per field
- Evidence threshold rules per sub-field type
- Sub-field JSON format specification
- Partial-write allowance ("Do not fabricate a sub-field value to complete a pair")

**Per-Field Self-Check** (lines 847–856) adds a v1.3 checklist item requiring the agent to verify it applied the sub-field protocol for eligible fields.

### 5.2 Output Slots Coverage Gap — Fields 5, 6, 7

Three fields — `repairs_maintenance`, `marketing`, and `contract_services` — do not have explicit sub-field notes in their per-field "Output Slots" sections:

- `repairs_maintenance` Output Slots (lines 513–516): lists only the primary `value` and `evidence` slots; no sub-field note
- `marketing` Output Slots (lines 663–665): lists only the primary `value` and `evidence` slots; no sub-field note
- `contract_services` Output Slots (lines 711–713): lists only the primary `value` and `evidence` slots; no sub-field note

All three ARE in the central Sub-Field Write Protocol eligible table. However, an agent reading only the per-field cells may not apply sub-fields for these three. The fix is to add sub-field notes to their Output Slots sections matching the pattern used for the other 6 fields. See Open Question Q1.

### 5.3 Development Deal Type Exclusion

The v1.3 prompt's Sub-Field Write Protocol explicitly excludes development deals from sub-field writes (line 873: "For stabilized, core, core-plus, and development deals: skip this protocol entirely"). The rationale:
- Development deals have no T12 actuals (no pre-renovation baseline to anchor `pre_renovation`)
- Development deals use the Projections tab regime trajectory instead of RegimeExpand for before/after modeling
- The Pattern B routing in `m09_line_item_patterns.ts` includes development deals in 4 fields (vacancy_loss, concessions, marketing, turnover), but these Pattern B rows will use the T12=null + platform fallback path in RegimeExpand rather than agent sub-fields

This creates a visual inconsistency: development deals show Pattern B expand rows but both values come from the platform (no T12 baseline available). This is handled gracefully by RegimeExpand's "pending agent run" placeholder. See Open Question Q3.

### 5.4 Guard Against Fabrication — Maintained

The v1.3 prompt explicitly states "Do not fabricate a sub-field value to complete a pair" in the Sub-Field Write Protocol. The postprocess confidence gate reinforces this by rejecting low-confidence `post_stabilization` writes. The evidence threshold rules for `pre_renovation` (Tier 1 or 2 required) prevent fabricated pre-renovation values from being written when no actuals exist.

---

## 6. Implementation Roadmap

### 6.1 Q1 Dependency — Resolved

The original task brief flagged the A1 vs A2 canonical field decision (Task #1350) as a dependency. This dependency is now resolved:

**A2 confirmed** (A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md §9): `deal_type` is canonical. The v1.3 prompt correctly uses `deal_type` implicitly via the "value-add and redevelopment deals" language. Postprocess enforcement uses `deal_type` directly (the condition for sub-field writeback is gated on the deal type received from the agent context).

### 6.2 What Has Been Implemented (v1.3 baseline)

| Component | Status | Notes |
|---|---|---|
| `line-item-matrix.ts` prompt updated to v1.3 | DONE | Mandate replaced with conditional protocol; Sub-Field Write Protocol section added |
| `cashflow.postprocess.ts` sub-field writeback | DONE | Lines 555–614; covers all 9 fields; confidence gate enforced |
| `proforma-adjustment.service.ts` composer | DONE | Lines 4824–4901; reads agent sub-fields; T12 fallback for pre; resolved fallback for post |
| `RegimeExpand.tsx` rendering | DONE | Handles both agent-data and no-agent-data states; renders T12/platform baseline without agent |
| ProFormaSummaryTab call sites | DONE | 3 call sites pass `regimeData` prop via optional chaining |

### 6.3 Remaining Implementation Gaps

**Gap 1 — Output Slots missing sub-field notes for R&M, Marketing, Contract Services (MEDIUM priority)**
- File: `backend/src/agents/prompts/cashflow/line-item-matrix.ts`
- Problem: Fields 5, 6, 7 (repairs_maintenance, marketing, contract_services) lack explicit sub-field notes in their "Output Slots" sections. The agent may under-apply the sub-field protocol for these three.
- Fix: Add `[VALUE-ADD/REDEVELOPMENT] May also write pre_renovation and post_stabilization sub-fields — see Sub-Field Write Protocol` to the Output Slots section of each missing field.
- Risk if not fixed: Under-populated RegimeExpand rows for R&M, marketing, and contract_services on value-add deals, even after the agent has run.

**Gap 2 — No directional consistency validation in postprocess (LOW priority, Phase 2)**
- File: `backend/src/agents/cashflow.postprocess.ts`
- Problem: The postprocess confidence gate only rejects low-confidence `post_stabilization` writes. It does not validate directional consistency (post ≤ pre for vacancy/concessions, post ≥ pre for other_income) or check that `post_stabilization.value` matches the primary field value within 5%.
- Fix: Add sigma-engine delta flag checks in the sub-field writeback block; emit `logger.warn` when directional rules are violated; do not reject (operator review, not auto-rejection).
- Risk if not fixed: Agent may write internally inconsistent sub-field pairs that pass the confidence gate but violate real-world regime logic.

**Gap 3 — Development deals: Pattern B rows shown but no meaningful sub-field data (INFORMATIONAL)**
- Affects: development deal type with Pattern B routing (vacancy_loss, concessions, marketing, turnover)
- Problem: RegimeExpand shows "pending agent run" in Pre-Renovation column for development deals (T12=null, no agent sub-fields). The label "Pre-Renovation" is architecturally incorrect for development deals — the correct framing is "Pre-Lease-Up" or "Construction Phase."
- Fix: Either (a) add a `preLabel` prop to RegimeExpand so development deals can show "Pre-Lease-Up" instead of "Pre-Renovation", or (b) exclude development deals from Pattern B routing for these fields. Decision is an open question.
- Risk if not fixed: Minor UX confusion — the label implies a renovation that does not exist for development deals.

**Gap 4 — `transition_year` sub-field not in Sub-Field Write Protocol (LOW priority, Phase 2)**
- RegimeExpand renders an optional `transition_year` row when `regimeData.transition_year` is non-null, sourced from M22 `capex_schedule.transition_month`. The Sub-Field Write Protocol in `line-item-matrix.ts` does not currently instruct the agent to write `transition_year` sub-fields. RegimeExpand displays it if the composer provides it, but the composer does not build it from agent output (the `transition_year` slot in `_regimeMap` is hardcoded `null`).
- Fix: Extend the Sub-Field Write Protocol to include optional `transition_year` writes; extend the composer to read `{year1Key}__transition_year` from year1Seed.

### 6.4 Backfill Consideration

**Forward-only is acceptable.** Prior agent runs produced no sub-field data because the v1.2 mandate forbade it. After a v1.3 agent run on a deal, the sub-fields are written and RegimeExpand populates. No re-run of prior agent outputs is required — the T12/platform fallback path in RegimeExpand already provides meaningful before/after display for deals that have not yet had a v1.3 agent run.

**Re-run cost:** A new cashflow agent run on any deal will produce sub-fields on eligible fields if the evidence thresholds are met. Operators can trigger a re-run from the Financial Engine. No automated bulk re-run is needed.

### 6.5 Implementation Sequence for Remaining Gaps

```
Priority 1 (output correctness):
  Gap 1 — Add Output Slots sub-field notes for R&M, marketing, contract_services
  → line-item-matrix.ts; no postprocess or frontend changes; prompt-only change

Priority 2 (agent output quality):
  Gap 2 — Add directional consistency validation in cashflow.postprocess.ts
  → cashflow.postprocess.ts sub-field writeback block; add 3-4 validation checks

Priority 3 (UX clarity, development deals):
  Gap 3 — Development deal Pre-Renovation label
  → RegimeExpand.tsx preLabel prop; m09_line_item_patterns.ts deal-type-aware label

Priority 4 (completeness, Phase 2):
  Gap 4 — transition_year sub-field protocol
  → line-item-matrix.ts (protocol extension) + proforma-adjustment.service.ts (composer)
```

None of these gaps block the core sub-field write functionality. The system is end-to-end functional for value-add and redevelopment deals with v1.3 agent runs.

---

## 7. Open Questions

### BLOCKING (must resolve before Gap 1 fix)

**Q1 — Output Slots wording for fields 5, 6, 7**
Should the sub-field note for repairs_maintenance, marketing, and contract_services exactly match the pattern used for the other 6 fields, or should each have a field-specific caveat (e.g., contract_services noting that regime sensitivity is low unless major new amenities are added)?

Recommended approach: Use the standard template for marketing and repairs_maintenance; add a caveat for contract_services noting that the sub-field should only be written when the renovation materially changes the amenity set (new pool, elevator, structured parking).

**Q2 — Should directional consistency violations be postprocess-rejected or just logged?**
If the agent writes `post_stabilization.value > pre_renovation.value` for vacancy_loss (violating the expected regime direction — lower vacancy post-renovation), should the postprocess:
(a) reject the inconsistent sub-field pair silently, or
(b) write both sub-fields and emit a `logger.warn`, or
(c) write both sub-fields and flag an alert in the `underwriting_evidence` row for operator review?

Recommended approach: Option (c) — write both, flag as an alert. The agent may be right (some value-add deals have higher vacancy post-renovation due to rent premium at affordability ceiling); reject-and-silently-drop loses potentially valid signals. The operator should see the flag and decide.

### IMPORTANT

**Q3 — Development deals and Pattern B rows: label and protocol**
Development deals have 4 Pattern B fields (vacancy_loss, concessions, marketing, turnover) in `m09_line_item_patterns.ts`. The Sub-Field Write Protocol excludes development deals from sub-field writes. RegimeExpand shows "pending agent run" for the Pre-Renovation row on development deals.

Should development deals:
(a) Keep Pattern B routing but rename pre-row to "Pre-Lease-Up" and accept that agent will not write sub-fields (platform placeholder only for pre), or
(b) Switch development deals to Pattern C for these fields (no expand rows at all), or
(c) Define a separate "Lease-Up Protocol" that allows the agent to write `pre_leaseup` and `post_stabilization` sub-fields for development deals using construction-phase benchmarks as the pre side?

This decision shapes the development deal UX significantly. Option (c) has the highest upside but requires a prompt extension and a separate composing path.

**Q4 — Agent self-validation for sub-field primary-value consistency**
Should the Per-Field Self-Check in `line-item-matrix.ts` be extended with an explicit checklist item verifying that `post_stabilization.value` matches the primary `proforma_fields[field].value` within 5%? If the agent produces divergent values, it may indicate an error in the primary field write rather than the sub-field.

### INFORMATIONAL

**Q5 — Eligible field set expansion to `utilities` for value_add**
`utilities` is a Pattern B field for redevelopment but not value_add. The Sub-Field Write Protocol eligible table does not include `utilities` for value_add. The regime sensitivity rationale: utilities have RUBS-driven sensitivity on value_add deals (RUBS implementation changes net utility expense). If `utilities` is added to the eligible set for value_add, it should require Tier 1 T12 utility actuals and Tier 1 RUBS recovery evidence. This is a Phase 2 extension.

**Q6 — `transition_timing_label` source**
RegimeExpand renders `regimeData.transition_timing_label` from M22 `capex_schedule.transition_month`. The composer (`proforma-adjustment.service.ts` lines 4881–4896) hardcodes `transition_timing_label: null`. The agent would need to write this value explicitly (e.g., as `{year1Key}__transition_timing_label`) for it to populate. This is informational — the feature exists in the component but is not yet wired to a data source.

---

## Source Citation Index

| Claim | File | Lines | Status |
|---|---|---|---|
| MANDATE_LIFT_DESIGN.md does not exist | `docs/operations/` directory listing | — | VERIFIED — not present before this document |
| line-item-matrix.ts is at v1.3 | `backend/src/agents/prompts/cashflow/line-item-matrix.ts` | 1–16 | VERIFIED — header comment says "v1.3" |
| Sub-Field Write Protocol section | `backend/src/agents/prompts/cashflow/line-item-matrix.ts` | 860–928 | VERIFIED — section exists |
| 6 fields with explicit Output Slots sub-field notes | `backend/src/agents/prompts/cashflow/line-item-matrix.ts` | 93, 145, 194, 303, 769, 826 | VERIFIED — 6 explicit notes confirmed |
| 3 fields (R&M, marketing, contract_services) missing Output Slots notes | `backend/src/agents/prompts/cashflow/line-item-matrix.ts` | 513–516, 663–665, 711–713 | VERIFIED — Output Slots sections lack sub-field notes |
| `regimeDataByField` composer in proforma-adjustment.service.ts | `backend/src/services/proforma-adjustment.service.ts` | 4824–4901 | VERIFIED — full composer present |
| Agent sub-field lookup from year1Seed | `backend/src/services/proforma-adjustment.service.ts` | 4872–4879 | VERIFIED — reads `{year1Key}__pre_renovation` / `{year1Key}__post_stabilization` |
| T12 fallback for pre_renovation in composer | `backend/src/services/proforma-adjustment.service.ts` | 4882–4887 | VERIFIED — `_preVal = _row.t12 ?? null` |
| Sub-field writeback in cashflow.postprocess.ts | `backend/src/agents/cashflow.postprocess.ts` | 555–614 | VERIFIED — covers all 9 fields |
| Confidence gate rejects low-confidence post_stabilization | `backend/src/agents/cashflow.postprocess.ts` | 589–596 | VERIFIED |
| JSONB key convention double-underscore | `backend/src/agents/cashflow.postprocess.ts` | 598 | VERIFIED — `${year1Key}__${subField}` |
| RegimeExpand hasAgentData check | `frontend/src/components/f9/RegimeExpand.tsx` | 228–231 | VERIFIED |
| RegimeExpand T12 fallback derivation | `frontend/src/components/f9/RegimeExpand.tsx` | 236–238 | VERIFIED |
| RegimeExpand renders "pending agent run" placeholder | `frontend/src/components/f9/RegimeExpand.tsx` | 177–179 | VERIFIED |
| ProFormaSummaryTab 3 call sites | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 1639, 1705, 1979 | VERIFIED |
| `DealFinancials.regimeDataByField` type definition | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 191 | VERIFIED |
| A2 confirmed canonical decision | `docs/operations/A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` | §9 | VERIFIED — "Affirm A2. It is already in production." |
| deal_type is canonical routing signal | `docs/operations/A1_VS_A2_STRATEGY_DEAL_TYPE_INVESTIGATION.md` | §2.1 | VERIFIED |
| transition_timing_label hardcoded null in composer | `backend/src/services/proforma-adjustment.service.ts` | 4894 | VERIFIED — `transition_timing_label: null` |
