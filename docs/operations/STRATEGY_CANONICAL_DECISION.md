# A1 vs A2 — STRATEGY ↔ DEAL_TYPE CANONICAL DECISION INVESTIGATION

**Status:** INVESTIGATION COMPLETE — PENDING OPERATOR DECISION  
**Produced by:** Main agent, 2026-05-26  
**Context:** [`docs/operations/STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md`](STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md) §Finding 1 confirmed that `PATCH /assumptions/strategy` writes `investment_strategy_lv` only; `deals.deal_type` is never touched. This document provides the cost/benefit analysis for three fix options.

---

## Table of Contents

1. [deal_type consumer inventory](#1-deal_type-consumer-inventory)
2. [investmentStrategy consumer inventory](#2-investmentstrategy-consumer-inventory)
3. [Vocabulary mapping](#3-vocabulary-mapping)
4. [Per-option cost/benefit](#4-per-option-costbenefit)
5. [Recommendation with reasoning](#5-recommendation)
6. [Open questions](#6-open-questions)

---

## 1. deal_type consumer inventory

### 1.1 What the field is and where it lives

`deals.deal_type` is a TEXT column on the `deals` table. It is populated at deal creation and is not updated by any automated process after that. It does not have a CHECK constraint; any string can be stored.

There is also `deals.project_type` — a sibling field read by `cashflow.config.ts` in a fallback chain: `project_type ?? deal_type ?? property_type`. These two fields are not always consistent.

Three distinct enumerations use the concept of "deal type" in the codebase. They are not the same:

| Enum name | Values | Lives in |
|-----------|--------|----------|
| `DealType` (3-value) | `existing \| development \| redevelopment` | `frontend/src/shared/config/deal-type-visibility.ts` |
| `DealTypeKey` (6-value) | `value_add \| redevelopment \| development \| lease_up \| stabilized \| existing` | `frontend/src/config/m09_line_item_patterns.ts` |
| `CashflowDealType` (5-value) | `existing \| value-add \| lease-up \| development \| redevelopment` | `backend/src/agents/cashflow.config.ts` |

These three enumerations are used by different subsystems and are not wired together. Normalization between them is done ad-hoc in individual files.

### 1.2 Backend consumers

| # | File | Lines | What it does | Consumer class |
|---|------|--------|--------------|---------------|
| B1 | `backend/src/inngest/functions/archive-aggregation.function.ts` | 75, 96, 109, 113, 118, 173, 200, 230, 259, 263, 279, 285, 304 | SQL `GROUP BY asset_class, deal_type` for archive aggregation buckets; `COALESCE(d.deal_type, 'existing')` as fallback | Analytics pipeline — bucket cohort key |
| B2 | `backend/src/api/rest/archive.routes.ts` | 386–403, 474–494 | API query filter `AND deal_type = $N`; passed through from query string | Analytics — read filter |
| B3 | `backend/src/api/rest/cashflow-underwriting.routes.ts` | 102, 249, 263–268, 277–285, 804, 836 | `COALESCE(d.deal_type, 'existing')` as bucket key for platform benchmark lookup (`archive_assumption_benchmarks`); also `SELECT project_type AS deal_type` alias at line 102 | Business logic — benchmark resolution |
| B4 | `backend/src/agents/cashflow.config.ts` | 367–385 | `resolveProjectType()` reads `project_type ?? deal_type ?? property_type` from the deal row, maps to `CashflowDealType`; result selects which prompt variant fires | Agent logic — prompt selection (critical) |
| B5 | `backend/src/agents/cashflow.postprocess.ts` | 1375–1379 | `proformaFields['deal_type'] ?? proformaFields['investment_strategy']`; regex `/value.?add|rehab|reposit|renovati/i` on the result to detect value-add signal for GPR unit-mix slot writing | Agent output post-processing |
| B6 | `backend/src/api/rest/sigma.routes.ts` | 316–364 | `dealType` query param split into tags for macro-series filtering | Analytics — tag filter |

### 1.3 Frontend consumers

| # | File | Lines | What it does | Consumer class |
|---|------|--------|--------------|---------------|
| F1 | `frontend/src/shared/config/deal-type-visibility.ts` | 494–526 | `getDealType(deal)` maps `projectType \| dealType` strings to 3-value `DealType`; drives tab visibility via `getVisibleTabs()` | UI rendering — tab availability (critical) |
| F2 | `frontend/src/pages/DealDetailPage.tsx` | 534, 973–986, 1062–1075 | `useDealType()` → controls active-tab logic, badge color/text, tab availability render | UI rendering — deal header + navigation |
| F3 | `frontend/src/config/m09_line_item_patterns.ts` | 22–28, 153–170 | `DealTypeKey` (6-value); `getLineItemPattern(field, dealType)` returns A/B/C per row per deal type | UI rendering — Pattern B routing (critical) |
| F4 | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 934, 1374–1467, 1707–1733 | `deal?.['deal_type'] ?? deal?.['dealType'] ?? 'existing'`; passes raw value to `isPatternB(field, dealType)` to decide whether `<RegimeExpand>` rows render | UI rendering — regime expand visibility (critical) |
| F5 | `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | 2750–2753 | Receives `dealType: DealType` (3-value); shows `<RenovationAssumptionsSection>` only when `dealType !== 'existing'` | UI rendering — renovation section gate |
| F6 | `frontend/src/pages/development/financial-engine/RenovationAssumptionsSection.tsx` | 120 | `const isRedevelopment = dealType === 'redevelopment' \|\| dealType === 'value-add'`; controls heading text and section behavior | UI rendering — renovation type display |
| F7 | `frontend/src/utils/tabs.utils.ts` | 10–82 | `getSubTabsForDealType(dealType)` returns capacity subtabs filtered by 3-value `DealType` | UI routing — capacity subtabs |
| F8 | `frontend/src/components/deal/*` (8 components) | — | `useDealType()` in AlertCounter, OverviewRouter, DealScreenWrapper, UnitMixTab, ProFormaTab, ZoningModuleSection, UnitMixIntelligence, RiskDashboard, DocumentsFilesSection, DueDiligenceSection | UI rendering — conditional display across modules |

### 1.4 Especially load-bearing consumers

Three consumers are structural: if `deal_type` is wrong, they produce wrong output silently.

**F3+F4 (Pattern B routing):** `isPatternB(field, dealType)` in `ProFormaSummaryTab` decides whether a row gets a `<RegimeExpand>` expand button. If `deal_type` is `'existing'` when the deal is actually value-add, every row returns Pattern C and the regime expand rows never render — permanently blank UI.

**F1 (tab visibility):** `getDealType()` maps to a 3-value enum. Critically, it maps `'value-add'` and `'value_add'` to `'existing'` — so a value-add deal receives the same tab layout as a stabilized acquisition. The mapping is in `deal-type-visibility.ts` lines 498–508 and is intentional for the 3-value system, but it means the tab system cannot distinguish value-add from stabilized.

**B4 (agent prompt selection):** `resolveProjectType()` does a keyword scan across `project_type ?? deal_type ?? property_type ?? investment_thesis`. It is not deterministic on `deal_type` alone — it falls back through multiple fields with heuristics. A deal where `deal_type` is `'existing'` but `investment_thesis` mentions "value-add" will get the value-add prompt variant.

---

## 2. investmentStrategy consumer inventory

### 2.1 What the field is and where it lives

`deal_assumptions.investment_strategy_lv` is a JSONB column carrying `{detected, override, resolved}` per the `LayeredValue<T>` pattern. It is separate from `deals.deal_type`.

The valid values enforced at the API boundary (deal-assumptions.routes.ts line 681):

```
['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental']
```

**This is the first major finding of this investigation:** there are only 4 valid investmentStrategy values, and none of them correspond to 'Value-Add', 'Redevelopment', or 'Lease-Up'. Any mapping from investmentStrategy to deal_type must account for these gaps.

### 2.2 Backend consumers

| # | File | Lines | What it does | Consumer class |
|---|------|--------|--------------|---------------|
| IS-B1 | `backend/src/api/rest/deal-assumptions.routes.ts` | 664–728 | PATCH `/assumptions/strategy` — validates against `INV_VALID`, writes to `investment_strategy_lv` column only. No side-effect on `deals.deal_type`. | API contract — write path |
| IS-B2 | `backend/src/agents/cashflow.postprocess.ts` | 839 | `dealData.investmentStrategy as string` — fallback after `proformaFields['deal_type']` for value-add signal detection | Agent output post-processing |
| IS-B3 | `backend/src/services/proforma-adjustment.service.ts` | 2143, 2992–3131 | Reads `investment_strategy_lv`, composes `investmentStrategy` LV object (`{detected, override, resolved}`) into the proforma financials response payload | Service layer — read + expose |

### 2.3 Frontend consumers

| # | File | Lines | What it does | Consumer class |
|---|------|--------|--------------|---------------|
| IS-F1 | `frontend/src/pages/development/financial-engine/DealTermsTab.tsx` | 484, 513, 571–573, 764–769, 1057–1067 | Dropdown bound to `investmentStrategy` state; fires `PATCH /assumptions/strategy`; dispatches `deal:strategy-changed` DOM event; shows detected/override/NOT SET badge | UI — write surface (only operator-facing write path) |
| IS-F2 | `frontend/src/components/deal/sections/InvestmentStrategySection.tsx` | 109 | Reads `timeline_data.investment_strategy \|\| investment_strategy` — display-only in deal timeline | UI — display only |
| IS-F3 | `frontend/src/pages/MapPage.tsx` | 120 | `d.investment_strategy \|\| d.strategy \|\| 'CORE'` — display-only on map card | UI — display only |

### 2.4 Template selection — investmentStrategy is NOT a direct driver

`pickTemplateForStrategy(strategySlug)` in `backend/src/services/proforma/blueprint/index.ts` takes a strategy slug and picks a `ProFormaTemplateId`. The strategy slugs it matches against are a **third vocabulary** (not `investmentStrategy`, not `deal_type`):

| Template | strategyTriggers |
|----------|-----------------|
| `acquisition_stabilized` | `rental`, `core`, `core_plus` |
| `acquisition_value_add` | `value_add`, `rental_value_add` |
| `development_ground_up` | `bts`, `bts_for_rent`, `development`, `ground_up` |
| `redevelopment` | `redevelopment`, `reposition`, `gut_rehab` |
| `flip` | `flip` |
| `str_shortterm` | `str`, `short_term_rental` |
| `land_hold` | `land`, `land_hold` |

The investmentStrategy values `'Build-to-Sell'`, `'Flip'`, `'Rental'`, `'Short-Term Rental'` do NOT directly match any `strategyTriggers` string — none of the trigger slugs are capitalized or hyphenated the way investmentStrategy values are. There is no code that lowers-cases or normalizes investmentStrategy before passing it to `pickTemplateForStrategy`. This means the proforma template selection is effectively disconnected from the operator's investmentStrategy selection.

---

## 3. Vocabulary mapping

### 3.1 investmentStrategy valid values (4)

```
'Build-to-Sell' | 'Flip' | 'Rental' | 'Short-Term Rental'
```

### 3.2 deal_type values in use (6, from DealTypeKey enum)

```
value_add | redevelopment | development | lease_up | stabilized | existing
```

### 3.3 Mapping table

| investmentStrategy | Most plausible deal_type | Ambiguity | Notes |
|---|---|---|---|
| `'Rental'` | `existing` OR `lease_up` | HIGH | Stable-yield acquisition → `existing`; new delivery in absorption → `lease_up`. Operator intent is different but vocabulary doesn't encode it. |
| `'Short-Term Rental'` | `existing` | LOW | No STR-specific deal_type exists. Pattern B routing doesn't differentiate STR. |
| `'Flip'` | `value_add` OR `redevelopment` | HIGH | Cosmetic flip → `value_add`; gut rehab → `redevelopment`. Operator intent is materially different for renovation budget, hold period, and Pattern B routing. |
| `'Build-to-Sell'` | `development` | NONE | Unambiguous. Ground-up construction with a sale exit is always development. |

### 3.4 deal_type values with NO investmentStrategy equivalent

| deal_type | investmentStrategy | Impact |
|-----------|---|---|
| `value_add` | none | Value-add deals can only be classified if operator chooses 'Flip' (ambiguous) or if deal_type is set directly |
| `redevelopment` | none | No investmentStrategy implies redevelopment |
| `lease_up` | none | Lease-up deals have no strategy representation |
| `stabilized` | partially `'Rental'` | 'Rental' maps to `existing`, not `stabilized` specifically |

### 3.5 Vocabulary structure analysis

The two fields represent **different dimensions** of the same property:

- `investmentStrategy` encodes **exit intent** (what the operator plans to do: hold for rent, flip, build and sell, STR).
- `deal_type` encodes **current state + treatment in the model** (how the property is modeled: existing income, renovation period, ground-up, etc.).

These are related but not 1:1. A Rental strategy property can be in lease-up (new delivery being absorbed) or stabilized (existing income). A Flip is typically value-add but could be a gut redevelopment. The taxonomies are genuinely different, not just vocabulary mismatches.

---

## 4. Per-option cost/benefit

### Option A1 — investmentStrategy becomes canonical; deal_type derived or deprecated

#### A1a. Code changes required

**New enum values required (minimum viable):** The current 4-value `INV_VALID` cannot cover all 6 `deal_type` values. At minimum, `'Value-Add'` and `'Redevelopment'` must be added. Whether `'Lease-Up'` and `'Stabilized'` are added is a product decision.

| Change | Files | Estimated impact |
|--------|-------|-----------------|
| Expand `INV_VALID` to include new strategy values | `deal-assumptions.routes.ts` | 2 lines |
| Add `deals.deal_type` as a generated column derived from `investment_strategy_lv` | New migration | ~20 lines SQL |
| OR: Write `deal_type` synchronously in PATCH handler from strategy | `deal-assumptions.routes.ts` | ~30 lines |
| Update `resolveProjectType()` in cashflow.config.ts to also read `investment_strategy_lv` | `cashflow.config.ts` | ~15 lines |
| Update archive aggregation GROUP BY to handle both fields | `archive-aggregation.function.ts` | ~10 lines |
| Update benchmark lookup bucket key | `cashflow-underwriting.routes.ts` | ~10 lines |
| Update all frontend `useDealType()` callers if strategy → DealType mapping changes | 10+ components | ~5 lines each |
| Add mapping from new strategy values to `DealType` (3-value) in `getDealType()` | `deal-type-visibility.ts` | ~10 lines |
| Add mapping from new strategy values to `DealTypeKey` (6-value) for Pattern B | `m09_line_item_patterns.ts` or call site | ~10 lines |
| Update `pickTemplateForStrategy()` to accept investmentStrategy values | `blueprint/index.ts` | ~10 lines |

**Total estimated scope:** ~125 lines changed across 12+ files. Medium-sized change with broad surface coverage.

#### A1b. Migration story for existing deals

Existing deals have `deal_type` set but `investment_strategy_lv` is null for most. Going from deal_type → investmentStrategy (reverse mapping) is lossy:
- `existing` → could be 'Rental' or 'Short-Term Rental' — no way to know without looking at other fields
- `value_add` → could be 'Value-Add' or 'Flip' — no way to know
- `development` → 'Build-to-Sell' is a reasonable assumption
- `redevelopment` → no clean investmentStrategy equivalent if that enum value isn't added

Backfill is **required but partially infeasible** without operator confirmation per deal. A default backfill (e.g., `existing → 'Rental'`) would be technically wrong for some deals.

**Active deal risk:** HIGH. If investmentStrategy becomes the canonical field and existing deals have it null, Pattern B routing and tab visibility break for all deals where investmentStrategy was never set.

#### A1c. Operator-visible behavior

- Immediately: investmentStrategy dropdown gains new options; operators must re-confirm classification for each deal
- Over time: strategy dropdown becomes the single source of truth; deal_type badge disappears or becomes a derived display field
- Tab visibility and Pattern B routing update in real-time when operator changes strategy

#### A1d. State drift risk

If `deal_type` is derived from `investmentStrategy`, drift can only happen if:
- `deal_type` is written directly by another code path (currently possible — several routes write to `deals.deal_type` independently)
- `investment_strategy_lv` null fails to derive a deal_type (needs a fallback)

Guardrails required: remove all direct writes to `deals.deal_type` except the derivation path. Detection: run a reconciliation query.

#### A1e. Rollback/reversibility

**Hard to reverse.** If deal_type is deprecated as a first-class field and historical data is backfilled, re-separating the taxonomies requires a second migration. The conceptual gap between exit-intent and model-treatment (§3.5) means A1 is fighting the data model, and a later team would likely want to re-separate them.

---

### Option A2-derived — deal_type stays canonical; strategy selection auto-derives deal_type via mapping function

#### A2d-a. Code changes required

| Change | Files | Estimated impact |
|--------|-------|-----------------|
| Add mapping function `investmentStrategyToDealType()` | New utility or within route handler | ~25 lines |
| Call mapping function in PATCH handler; write `deals.deal_type` when strategy saved | `deal-assumptions.routes.ts` | ~20 lines |
| No changes to frontend consumers — deal_type still comes from the same place | none | 0 lines |
| No changes to archive aggregation, benchmark lookup, Pattern B routing | none | 0 lines |

**Total estimated scope:** ~45 lines across 1–2 files. Smallest blast radius of the three options.

#### A2d-b. Migration story for existing deals

None required. Existing deals keep their `deal_type`. When an operator next saves their investmentStrategy, `deal_type` gets updated. Deals where the operator never uses the strategy dropdown remain unchanged.

**Active deal risk:** LOW. No automated backfill; no existing deals break.

#### A2d-c. Operator-visible behavior

- Immediately: nothing changes (deals load the same)
- After operator saves investmentStrategy: deal_type updates; Pattern B routing, RegimeExpand, tab visibility, renovation gate all update immediately on next page load
- Operators who previously set their deal_type manually (outside the strategy dropdown) may be surprised if saving strategy overwrites it

#### A2d-d. State drift risk

After A2-derived, the only way the fields fall out of sync is:
1. Operator sets investmentStrategy (deal_type auto-updates)
2. Something else then writes deal_type directly (currently possible — several code paths do this)
3. investmentStrategy and deal_type are now inconsistent again

The mapping is also one-way and lossy for ambiguous cases:
- `'Flip'` → `value_add` or `redevelopment`? This must be a hard decision in the mapping function; the operator can't express the nuance
- `'Rental'` → `existing` or `lease_up`? Same problem

Drift also reappears if deal_type is updated by deal-creation flows that don't go through the PATCH /assumptions/strategy endpoint.

Guardrails: audit all paths that write `deals.deal_type` and decide whether each should honor the strategy-derived value or be allowed to override it.

#### A2d-e. Rollback/reversibility

**Trivially reversible.** The mapping function is additive. Removing it reverts to the current state. No migration needed.

---

### Option A2-event-handler — strategy change fires event that updates deal_type

#### A2e-a. Code changes required

Same as A2-derived (mapping function required) plus:
- Inngest function or event handler subscription
- Event schema definition
- Error handling for failed deal_type update (strategy saved but deal_type not updated)

**Total estimated scope:** ~80 lines across 3–4 files.

#### A2e-b. Migration story

Same as A2-derived — no backfill needed.

#### A2e-c. Operator-visible behavior

- Strategy saves immediately
- deal_type updates asynchronously (seconds later)
- During the gap, Pattern B routing, tab visibility, and RegimeExpand see the old deal_type
- If the operator navigates to another tab immediately after saving strategy, they may see stale rendering until the event handler fires

#### A2e-d. State drift risk

Identical to A2-derived PLUS transient inconsistency during event propagation. No advantage over A2-derived for this problem. The sync case is simpler and more correct.

#### A2e-e. Rollback/reversibility

**Same as A2-derived** (mapping function removable), plus the event handler must also be removed.

---

### Comparison summary

| Dimension | A1 (strategy canonical) | A2-derived | A2-event |
|-----------|------------------------|------------|----------|
| Code surface | ~125 lines, 12+ files | ~45 lines, 1–2 files | ~80 lines, 3–4 files |
| Migration required | Yes — partial backfill with quality risk | No | No |
| Active deal risk | HIGH | LOW | LOW |
| Transient inconsistency | None (synchronous) | None (synchronous) | Yes (async gap) |
| Ambiguous mapping cases | 'Rental' and 'Flip' | Same | Same |
| Conceptual fit | Fights the data model (§3.5) | Works with the data model | Works with the data model |
| Rollback effort | Hard | Trivial | Easy |
| Strategy dropdown fully functional after? | Yes | Yes (with caveats on ambiguous cases) | Yes (with caveats) |

---

## 5. Recommendation

**Recommended option: A2-derived.**

### Reasoning

**A1 is conceptually wrong for this domain.** investmentStrategy encodes exit intent; deal_type encodes model treatment. These are related but not equivalent. Forcing one to derive from the other requires either collapsing them (losing expressiveness) or expanding `INV_VALID` to include operational states like `'Lease-Up'` that are not exit strategies. That expansion conflates two different conceptual questions into one UI control.

**A2-event adds complexity with no benefit.** The async gap between strategy save and deal_type update creates a class of bugs that A2-derived avoids entirely. There is no reason to introduce eventual consistency here.

**A2-derived is the right size.** The fundamental problem is that the PATCH handler is missing a side-effect: write `deals.deal_type` when `investmentStrategy` is saved. This is a ~45-line change with a trivial rollback path and no migration risk.

### What A2-derived requires to be correct

The mapping function must make explicit decisions on the two ambiguous cases. These are **product decisions**, not engineering decisions:

1. **'Flip' → which deal_type?** Recommended: `value_add`. A flip is typically a light-to-moderate renovation with a resale exit, which aligns with the value_add model treatment. If the operator intends a gut rehab, they should be selecting a different strategy (which currently doesn't exist in the enum — see Open Question OQ-1).

2. **'Rental' → which deal_type?** Recommended: `existing`. Stable yield acquisitions are the most common 'Rental' case. Lease-up deals are typically known at the time of acquisition and should be handled by OQ-1's resolution.

The mapping function:

```
'Build-to-Sell'   → 'development'
'Flip'            → 'value_add'
'Rental'          → 'existing'
'Short-Term Rental' → 'existing'
```

### What A2-derived does NOT fix

A2-derived makes the strategy dropdown functional for the 4 existing values. It does not:
- Add a value-add, redevelopment, or lease-up strategy option (OQ-1)
- Fix the `RenovationAssumptionsSection` gate bug where `dealType === 'value-add'` is dead code (OQ-2)
- Connect `investmentStrategy` to `pickTemplateForStrategy()` (OQ-3)
- Fix `resolveProjectType()` in the cashflow agent, which does not read `investment_strategy_lv` (OQ-4)

These are follow-on tasks but are not blockers for A2-derived.

---

## 6. Open questions

### OQ-1 — Missing strategy values [BLOCKING for full resolution]

`INV_VALID` has no 'Value-Add', 'Redevelopment', or 'Lease-Up' values. The current strategy dropdown is unusable for operators who have value-add or redevelopment deals — the canonical deals in the platform.

**Decision required from Leon:** Should 'Value-Add', 'Redevelopment', and 'Lease-Up' be added to the investmentStrategy enum? If yes, these would map unambiguously: `'Value-Add' → 'value_add'`, `'Redevelopment' → 'redevelopment'`, `'Lease-Up' → 'lease_up'`.

This decision should be made before A2-derived is implemented, since it affects the mapping function.

### OQ-2 — RenovationAssumptionsSection gate is dead code [BLOCKING for value-add renovation visibility]

`RenovationAssumptionsSection.tsx` line 120: `const isRedevelopment = dealType === 'redevelopment' || dealType === 'value-add'`

The `dealType` prop received here is `DealType` (3-value: `existing | development | redevelopment`). The value `'value-add'` is never a valid `DealType`. This branch is dead code. The `isRedevelopment` variable is `false` for all deals classified as `existing` by `getDealType()`, which includes value-add deals.

The renovation section heading and behavior differ for redevelopment vs value-add — but the distinction is invisible at runtime because value-add deals never reach this component at all (they're classified as `existing` and the `AssumptionsTab` gate at line 2750 returns false for `existing`).

**This is an independent bug.** It exists regardless of which canonical option is chosen. Fix requires either:
- Expanding `DealType` from 3 to 4+ values (large blast radius), or
- Passing the raw `deal_type` string (not `DealType`) to `AssumptionsTab` / `RenovationAssumptionsSection`

### OQ-3 — investmentStrategy never reaches pickTemplateForStrategy [IMPORTANT]

`pickTemplateForStrategy()` takes lowercase slug strings (`'value_add'`, `'rental'`, `'bts'`, etc.). The investmentStrategy enum values (`'Build-to-Sell'`, `'Rental'`, etc.) are never normalized and passed to this function. Template selection uses `deal_type` heuristics or falls back to `acquisition_stabilized`.

After A2-derived, if `deal_type` is updated from strategy, template selection will implicitly improve because `defaultTemplateForDealType()` is called with the (now-correct) deal_type. But explicit `pickTemplateForStrategy()` integration would give more precision (e.g., distinguishing `acquisition_stabilized` from `acquisition_value_add` within the 'existing' deal_type bucket).

Decision: is `defaultTemplateForDealType()` sufficient, or is explicit `pickTemplateForStrategy()` wiring needed? The 3-value `defaultTemplateForDealType()` maps `existing → acquisition_stabilized`, which is wrong for value-add deals. This is a follow-on fix.

### OQ-4 — resolveProjectType() does not read investment_strategy_lv [IMPORTANT]

`cashflow.config.ts` `resolveProjectType()` reads `project_type ?? deal_type ?? property_type ?? investment_thesis`. It does not read `investment_strategy_lv`. After A2-derived updates `deal_type` from the strategy selection, `resolveProjectType()` will use the updated `deal_type` and improve. But if `investment_strategy_lv` override is null and `deal_type` was never set, the agent falls back to keyword heuristics.

No action required before A2-derived. Worth revisiting if agent prompt selection accuracy becomes a measured issue.

### OQ-5 — Multiple deal_type write paths risk post-fix drift [IMPORTANT]

After A2-derived, the PATCH /assumptions/strategy handler will write `deals.deal_type`. But other code paths can also write `deals.deal_type` directly (deal creation, project type change UI, admin flows). If those paths fire after the strategy-derived update, they overwrite it.

Before A2-derived ships, all paths that write `deals.deal_type` should be audited and a priority order decided: does the strategy-derived value always win, or can the deal-creation flow override it?

---

## Citation index

| Ref | File | Lines | Claim |
|-----|------|--------|-------|
| C01 | `backend/src/api/rest/deal-assumptions.routes.ts` | 681 | `INV_VALID = ['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental']` — 4 values only |
| C02 | `backend/src/api/rest/deal-assumptions.routes.ts` | 723–728 | PATCH writes `investment_strategy_lv` only; no `deals.deal_type` update |
| C03 | `frontend/src/config/m09_line_item_patterns.ts` | 22–28 | `DealTypeKey` 6-value enum definition |
| C04 | `frontend/src/shared/config/deal-type-visibility.ts` | 494–526 | `getDealType()` maps value-add → 'existing' |
| C05 | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 934 | `deal?.['deal_type'] ?? deal?.['dealType'] ?? 'existing'` — reads raw field |
| C06 | `frontend/src/pages/development/financial-engine/RenovationAssumptionsSection.tsx` | 120 | `dealType === 'value-add'` — dead code in 3-value system |
| C07 | `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | 2750 | `dealType !== 'existing'` gate for renovation section |
| C08 | `backend/src/agents/cashflow.config.ts` | 365–385 | `resolveProjectType()` — reads `project_type ?? deal_type` not `investment_strategy_lv` |
| C09 | `backend/src/agents/cashflow.config.ts` | 356–362 | `CASHFLOW_DEAL_TYPE_TO_PROMPT_TYPE` — 5-value `CashflowDealType` enum |
| C10 | `backend/src/services/proforma/blueprint/index.ts` | 30–50 | `pickTemplateForStrategy()` and `defaultTemplateForDealType()` |
| C11 | `backend/src/services/proforma/blueprint/proforma-blueprint.ts` | 135–233 | `strategyTriggers` — third vocabulary, does not match investmentStrategy values |
| C12 | `backend/src/inngest/functions/archive-aggregation.function.ts` | 75, 96 | `COALESCE(d.deal_type, 'existing')` — analytics GROUP BY bucket |
| C13 | `backend/src/api/rest/cashflow-underwriting.routes.ts` | 249, 263 | `COALESCE(d.deal_type, 'existing')` — benchmark lookup bucket key |
| C14 | `backend/src/agents/cashflow.postprocess.ts` | 1375–1379 | `deal_type ?? investment_strategy` — value-add signal detection |
| C15 | `frontend/src/pages/development/financial-engine/types.ts` | 203, 820 | `FinancialEngineTabProps.dealType: DealType` — 3-value type |
| C16 | `backend/src/services/proforma-adjustment.service.ts` | 3106–3131 | `investmentStrategyLv` composition into financials response |
| C17 | `frontend/src/pages/development/financial-engine/DealTermsTab.tsx` | 764–769 | PATCH call from UI strategy dropdown |
| C18 | `backend/src/database/migrations/20260427_archive_deals_table.sql` | 8 | `deal_type TEXT -- stabilized, value-add, lease-up, development` |
| C19 | `backend/src/database/migrations/20260420_line_item_benchmarks.sql` | 19 | `deal_type TEXT -- existing \| value-add \| lease-up \| development` |
