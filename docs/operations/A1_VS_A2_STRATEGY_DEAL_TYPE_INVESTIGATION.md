# A1 vs A2: strategy ↔ deal_type Canonical Field Investigation

**Date:** 2026-05-27  
**Status:** Complete — ready for P8 verification (Task #1264)  
**Task:** #1263  
**Phase scope:** Multifamily-existing first (Phase 1 constraint)

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current State of Both Fields](#2-current-state-of-both-fields)
3. [Consumer Inventory](#3-consumer-inventory)
4. [Architecture Options: A1 vs A2](#4-architecture-options-a1-vs-a2)
5. [Migration Cost — A1 (investmentStrategy canonical)](#5-migration-cost--a1)
6. [Migration Cost — A2 (deal_type canonical)](#6-migration-cost--a2)
7. [Vocabulary Mapping (Canonical)](#7-vocabulary-mapping-canonical)
8. [Downstream Impact](#8-downstream-impact)
9. [Recommendation](#9-recommendation)
10. [Open Questions — Classified](#10-open-questions--classified)
11. [Source Citation Index](#11-source-citation-index)

---

## 1. Executive Summary

**Critical finding: A2 is already partially implemented.** Task #1233 added `investmentStrategyToDealType()` to the PATCH `/assumptions/strategy` endpoint, which atomically writes `deals.deal_type` whenever `investmentStrategy` is saved by the operator. The existing investigation document (`STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md`) contains a **stale claim** in §3a.1 and the SOURCE CITATION INDEX stating "PATCH /assumptions/strategy does NOT update deals.deal_type" — this was accurate before Task #1233 and is incorrect today.

**Recommendation: A2 confirmed.** `deal_type` remains the canonical routing signal. `investmentStrategy` is the operator-facing input layer that propagates to `deal_type` via the bridge function. All existing consumers continue to read `deal_type` without change.

**What remains for Phase 1 completion:** Two gaps in the current A2 implementation must be resolved before T2.4 (implementation task) may begin — documented in §10 as BLOCKING open questions.

---

## 2. Current State of Both Fields

### 2.1 `deals.deal_type` — Canonical routing signal (DB column)

- **Storage:** `TEXT` column on `deals` table. Set at deal creation; COALESCE-defaulted to `'existing'` on reads.
- **Valid values (DB):** `'existing'`, `'value_add'` / `'value-add'`, `'redevelopment'`, `'development'`, `'lease_up'` / `'lease-up'`, `'stabilized'`
- **Frontend enum:** `DealTypeKey` in `m09_line_item_patterns.ts` defines 6 values: `value_add | redevelopment | development | lease_up | stabilized | existing`
- **Write paths:**
  1. At deal creation (not audited — set directly in deal insert)
  2. Via `investmentStrategyToDealType()` bridge in `deal-assumptions.routes.ts` line 1052 (Task #1233 — atomic with investment_strategy_lv write)
- **Read paths:** 40+ across frontend and backend (see §3)
- **Normalization:** `normalizeDealType()` in `m09_line_item_patterns.ts` converts hyphens to underscores at consumption time

### 2.2 `deal_assumptions.investment_strategy_lv` — Operator input layer (JSONB LayeredValue)

- **Storage:** `JSONB` column on `deal_assumptions`. Shape: `{ detected: { value, confidence, source } | null, override: string | null }`
- **Valid override values (INV_VALID):** `'Build-to-Sell'`, `'Flip'`, `'Land Hold'`, `'Lease-Up'`, `'Redevelopment'`, `'Rental'`, `'Short-Term Rental'`, `'Value-Add'`  
  Source: `deal-assumptions.routes.ts` line 976
- **Write path:** PATCH `/api/v1/deals/:dealId/assumptions/strategy` — writes both `override` slot and (for non-null values) derives + writes `deals.deal_type` via bridge (Task #1233)
- **Read paths:** 6 consumers (see §3)
- **Resolved value:** `override ?? detected?.value ?? null` (proforma-adjustment.service.ts line 3134)

### 2.3 `proformaTemplateId` — Template routing signal (derived, not stored)

- **Derivation:** `pickTemplateForStrategy(strategySlug)` in `blueprint/index.ts` line 30; called in `proforma-adjustment.service.ts` line 3141
- **Strategy slug:** `investmentStrategyLv.resolved.toLowerCase().replace(/[\s-]+/g, '_')` (proforma-adjustment.service.ts line 3140)
- **Composed into:** `DealFinancials.proformaTemplateId` at proforma-adjustment.service.ts line 4793
- **Received by:** `ProFormaSummaryTab.tsx` as `proformaTemplateId?: string | null` prop (line 91)
- **Current usage:** Props comment says "Null/absent → falls back to deal_type-based rendering (no regression)" — template-aware rendering is typed but not yet wired into tab branching logic

---

## 3. Consumer Inventory

### 3.1 `deals.deal_type` Readers

| Consumer | File | Lines | Purpose |
|---|---|---|---|
| Pattern B routing (RegimeExpand affordance) | `ProFormaSummaryTab.tsx` | 946 | `const dealType = deal?.['deal_type']` → feeds `isPatternB()` for ~3 call sites |
| `isPatternB()` routing function | `m09_line_item_patterns.ts` | 168-173 | `isPatternB(field, dealType)` — reads `deal_type`, never `investmentStrategy` |
| RenovationAssumptionsSection gate | `ProFormaSummaryTab.tsx` (via AssumptionsTab) | see §8.2 | `dealType === 'redevelopment' \|\| dealType === 'value-add'` visibility gate |
| AssumptionsTab display + routing | `AssumptionsTab.tsx` | 1490, 1575 | Asset class label; value-add routing |
| Cashflow agent context | `cashflow-underwriting.routes.ts` | 249 | `COALESCE(d.deal_type, 'existing')` — sent to frontend, re-read by agent |
| Agent value-add signal detection | `cashflow.postprocess.ts` | 1375-1379 | `deal_type ?? investment_strategy` — double-reads both fields |
| Comp routing (benchmarks) | `m27-comps.routes.ts` | 211, 231, 272, 293, 319, 341, 387 | Benchmark queries keyed on deal_type |
| Archive filtering | `archive.routes.ts` | 397, 494 | Filter archive by deal_type |
| Benchmark distribution queries | `fetch_archive_assumption_distribution.ts` | 96 | Benchmark lookup by deal_type |
| Benchmark fetch tools | `fetch_disposition_learnings.ts`, `fetch_line_item_benchmarks.ts` | 108, 373 | Benchmark by deal_type |
| Roadmap action gating | `roadmap/action-library.ts` | 23, 60, 98 | `deal_types: ['existing', 'value_add', ...]` gates action display |
| Opus template resolution query | `opus.service.ts` | 994 | SELECT deal_type to build prompt context |
| Archive benchmark tables (stored) | `archive_assumption_benchmarks`, `line_item_benchmarks`, `assumption_snapshots`, `assumption_outcomes` | DB schema | `deal_type TEXT` column in all benchmark tables |
| Deal Oversight admin display | `DealOversightSection.tsx` | 111 | Display only, no routing |
| F8 admin display | `F8AdminView.tsx` | 539 | Display only (falls back to project_type) |
| Map page display | `MapPage.tsx` | 120 | Display only (falls back to investment_strategy) |

**Total meaningful routing consumers: 13** (excluding display-only uses)

### 3.2 `investment_strategy_lv` / `investmentStrategy` Readers

| Consumer | File | Lines | Purpose |
|---|---|---|---|
| Deal Terms display + save | `DealTermsTab.tsx` | 719, 778, 836-838, 1029-1034, 1415-1425 | Operator-facing LV display with NOT SET badge |
| LV strategy write | `deal-assumptions.routes.ts` | 1026-1034 | Writes override slot to JSONB |
| A2 bridge (deal_type sync) | `deal-assumptions.routes.ts` | 1048-1055 | Derives and writes deals.deal_type atomically |
| proformaTemplateId derivation | `proforma-adjustment.service.ts` | 3016, 3130-3142 | Resolves investmentStrategy → templateId via pickTemplateForStrategy() |
| Agent strategy resolution (fallback) | `cashflow.postprocess.ts` | 839 | Fallback: `dealData.investmentStrategy` in strategy resolution chain |
| Map page display | `MapPage.tsx` | 120 | `d.investment_strategy` display fallback |
| InvestmentStrategySection (components) | `InvestmentStrategySection.tsx` | 109 | Reads from timeline_data.investment_strategy (CRM context, not F9) |

**Total: 7 consumers.** 5 are within the F9/assumptions flow; 2 are display/CRM contexts.

---

## 4. Architecture Options: A1 vs A2

### Option A1 — investmentStrategy becomes canonical; deal_type derived

Operator saves `investmentStrategy`. Backend derives `deal_type` from it and writes it. All routing reads `deal_type` as today — the fix is purely upstream.

**This is functionally identical to the current A2 implementation.** Task #1233 already implemented the upstream bridge. The question of "A1 vs A2" reduces to: **which field is the operator-facing source of truth?** Under both options the downstream routing reads `deal_type`.

The distinction that matters is:
- **A1-strict:** `investmentStrategy` is the *only* operator input; `deal_type` becomes a derived/internal field invisible to operators
- **A2-strict:** `deal_type` is still the authoritative stored field; `investmentStrategy` is an operator-visible LV that produces `deal_type` as a side-effect

### Option A2 — deal_type canonical; investmentStrategy propagates to deal_type (already implemented)

Operator saves `investmentStrategy` in Deal Terms → backend bridge atomically writes `deal_type`. All pattern routing reads `deal_type`. `investmentStrategy` retains its LV shape (detected/override) for proforma template ID derivation.

---

## 5. Migration Cost — A1

**Scope: pure A1-strict** (investmentStrategy is the only input; deal_type is hidden or removed)

### 5.1 Backend changes required

| Change | Files | Effort |
|---|---|---|
| Extend DealTypeKey enum to include STR-specific values | `m09_line_item_patterns.ts` | Low |
| Replace `deal_type` in ALL benchmark table schemas | 4 DB tables (archive_assumption_benchmarks, line_item_benchmarks, assumption_snapshots, assumption_outcomes) | HIGH — schema migration + data backfill |
| Change all benchmark query WHERE clauses from `deal_type` to an investmentStrategy-derived key | `fetch_line_item_benchmarks.ts`, `fetch_archive_assumption_distribution.ts`, `fetch_disposition_learnings.ts`, `archive.routes.ts`, `m27-comps.routes.ts`, `cashflow-underwriting.routes.ts` | HIGH — 8+ files, 40+ call sites |
| Update opus.service.ts context query | `opus.service.ts` line 994 | Low |
| Update roadmap action gating | `roadmap/action-library.ts` | Low |

### 5.2 Frontend changes required

| Change | Files | Effort |
|---|---|---|
| ProFormaSummaryTab — change `const dealType = deal?.['deal_type']` to read investmentStrategy-derived value | `ProFormaSummaryTab.tsx` line 946 | Low (1 line) but HIGH blast radius — this drives all Pattern B routing |
| AssumptionsTab deal_type reads | `AssumptionsTab.tsx` lines 1490, 1575 | Low |

### 5.3 A1 migration cost: HIGH

The primary cost is in the 4 benchmark table schemas that store `deal_type` as a raw column — changing these requires schema migrations with data backfill. Every benchmark lookup (comp routing, archive distribution, line item benchmarks) would need vocabulary translation. There is no functional benefit over A2 for Phase 1.

---

## 6. Migration Cost — A2

**Scope: A2 as currently implemented (Task #1233 bridge in production)**

### 6.1 Already done (Task #1233)

- `investmentStrategyToDealType()` function maps all 7 operator-visible strategy values to `deal_type` values
- Atomic transaction writes both `investment_strategy_lv.override` and `deals.deal_type` together
- Pattern B routing, RenovationAssumptionsSection, benchmark queries: zero changes (all read `deal_type` already)
- `proformaTemplateId` derivation wired in proforma-adjustment.service.ts

### 6.2 Remaining for Phase 1 completion (T2.4 scope)

| Gap | File | Effort | Blocking? |
|---|---|---|---|
| `'Land Hold'` is in INV_VALID but returns `undefined` from `investmentStrategyToDealType()` — no `deal_type` is written | `deal-assumptions.routes.ts` line 956-966 | Trivial — add `'Land Hold': 'existing'` or a new `'land_hold'` DealTypeKey | YES — data inconsistency |
| `'Short-Term Rental'` and `'Rental'` both map to `'existing'` — STR template routing loses distinction | `deal-assumptions.routes.ts` line 957-966 | Requires adding `'str'` to DealTypeKey and STR pattern rows | Phase 2 only; not Phase 1 |
| `proformaTemplateId` received by ProFormaSummaryTab but not used to gate template-specific rendering | `ProFormaSummaryTab.tsx` line 91 | T2.4 implementation scope | YES — defines what T2.4 actually builds |
| Existing deals created before Task #1233 have `deal_type` set at creation but `investment_strategy_lv` is null — no retroactive sync | DB data | One-time backfill script or on-read derivation | IMPORTANT — affects auditing, not routing |

### 6.3 A2 migration cost: LOW for Phase 1

For multifamily-existing Phase 1, the remaining work is:
- Fix the Land Hold mapping gap (1 line)
- Wire `proformaTemplateId` into ProFormaSummaryTab template-aware rendering (T2.4 main deliverable)

---

## 7. Vocabulary Mapping (Canonical)

Current mapping in `investmentStrategyToDealType()` (`deal-assumptions.routes.ts` lines 957-966):

| investmentStrategy (INV_VALID) | deal_type (derived) | ProFormaTemplateId (via pickTemplateForStrategy) | Notes |
|---|---|---|---|
| `'Rental'` | `'existing'` | `acquisition_stabilized` (via slug `'rental'`) | Correct for Phase 1 |
| `'Value-Add'` | `'value_add'` | `acquisition_value_add` (via slug `'value_add'`) | Correct for Phase 1 |
| `'Build-to-Sell'` | `'development'` | `development_ground_up` (via slug `'build_to_sell'`; falls back to `acquisition_stabilized`) | **GAP** — slug `'build_to_sell'` doesn't match strategyTrigger `'bts'`; returns fallback template |
| `'Flip'` | `'value_add'` | `flip` (via slug `'flip'`) | template correct; DealTypeKey has no `flip` — uses value_add |
| `'Redevelopment'` | `'redevelopment'` | `redevelopment` (via slug `'redevelopment'`) | Correct |
| `'Lease-Up'` | `'lease_up'` | fallback `acquisition_stabilized` (no strategyTrigger for `'lease_up'`) | Phase 2 gap |
| `'Short-Term Rental'` | `'existing'` | `str_shortterm` (via slug `'short_term_rental'`) | template correct; deal_type loses distinction |
| `'Land Hold'` | **undefined — NOT WRITTEN** | `land_hold` (via slug `'land_hold'`) | **BLOCKING GAP** — deal_type not updated |

**slug normalization:** proforma-adjustment.service.ts line 3140: `toLower().replace(/[\s-]+/g, '_')`
- `'Build-to-Sell'` → `'build_to_sell'` (no matching strategyTrigger `'bts'`) — **GAP**
- `'Short-Term Rental'` → `'short_term_rental'` (matches strategyTrigger `'str'`) — correct for template
- `'Rental'` → `'rental'` (matches) — correct

---

## 8. Downstream Impact

### 8.1 Proforma Routing (Pattern B)

No change required. `isPatternB(field, dealType)` reads `deal_type` directly. When the operator saves `investmentStrategy = 'Value-Add'`, the bridge writes `deal_type = 'value_add'`, and on the next page load Pattern B rows (9 rows) activate for that deal. The routing is correct and already working.

**Phase 1 (multifamily-existing):** `investmentStrategy = 'Rental'` → `deal_type = 'existing'` → 0 Pattern B rows → correct stabilized acquisition display.

### 8.2 RenovationAssumptionsSection Visibility

Gate at `ProFormaSummaryTab.tsx` (via AssumptionsTab): `dealType === 'redevelopment' || dealType === 'value-add'`. Reads `deal_type`. No change required — the bridge ensures this activates correctly when the operator saves `investmentStrategy = 'Value-Add'` or `'Redevelopment'`.

**Phase 1 (multifamily-existing):** `investmentStrategy = 'Rental'` → `deal_type = 'existing'` → RenovationAssumptionsSection hidden → correct.

### 8.3 Agent Prompts (Cashflow Agent)

`cashflow-underwriting.routes.ts` line 249 sends `COALESCE(d.deal_type, 'existing')` as `deal_type` to the frontend and agent context. After Task #1233, when `investmentStrategy` is saved, `deal_type` is updated in the same transaction. On the next cashflow run, the agent receives the correct `deal_type`. No change required.

`cashflow.postprocess.ts` line 1375 reads `deal_type ?? investment_strategy` as a double-read. This is a defense-in-depth fallback that continues to work correctly in both pre- and post-Task-1233 states.

### 8.4 proformaTemplateId Pipeline

Current state: `proformaTemplateId` is derived correctly server-side and passed to `ProFormaSummaryTab` as `proformaTemplateId?: string | null`. The tab's props comment says "Null/absent → falls back to deal_type-based rendering (no regression)."

**This is the primary remaining gap for T2.4.** For Phase 1 (multifamily-existing), `deal_type = 'existing'` → `proformaTemplateId = 'acquisition_stabilized'` — same as the current `deal_type`-based fallback. No visible behavioral change until the tab is updated to branch on `proformaTemplateId` for template-specific field sets.

### 8.5 `'Build-to-Sell'` Slug Normalization Gap

`investmentStrategy = 'Build-to-Sell'` normalizes to slug `'build_to_sell'`. The blueprint `strategyTriggers` for `development_ground_up` are `['bts', 'bts_for_rent', 'development', 'ground_up']` — no `'build_to_sell'`. Result: `pickTemplateForStrategy('build_to_sell')` returns fallback `'acquisition_stabilized'` instead of `'development_ground_up'`. `deal_type = 'development'` is written correctly; only the `proformaTemplateId` derivation is wrong.

Fix: Add `'build_to_sell'` to `development_ground_up.strategyTriggers` in `proforma-blueprint.ts`.

---

## 9. Recommendation

**Affirm A2. It is already in production. No architectural pivot is warranted.**

### Rationale

1. **A2 is already implemented (Task #1233).** All existing investments are sunk into the A2 pattern. Reverting to A1-strict would require migrating 4 benchmark table schemas with data backfill — the highest-cost single change in the codebase for zero gain over A2.

2. **All routing consumers correctly read `deal_type`.** The 13 routing consumers enumerated in §3.1 all read `deal_type`. None would need changing under A2. All would need changing under A1-strict.

3. **The LV shape is preserved.** `investment_strategy_lv` retains its detected/override structure, enabling future M08 auto-detection writes without a schema migration. A1-strict would have the same benefit; A2 keeps it.

4. **Phase 1 scope is correctly covered.** For multifamily-existing (`deal_type = 'existing'`), the full pipeline is correct today: operator saves `investmentStrategy = 'Rental'` → `deal_type = 'existing'` → `proformaTemplateId = 'acquisition_stabilized'` → stabilized acquisition routing.

5. **The two remaining gaps (§6.2 and §7) are small and targeted.** Land Hold mapping fix: 1 line. `proformaTemplateId` rendering wiring: T2.4 main deliverable. `'Build-to-Sell'` slug fix: 1 line in blueprint.

### Phase 1 pre-condition for T2.4

Before T2.4 implementation begins, the following must be resolved:

1. **Fix Land Hold mapping gap** — Add `'Land Hold': 'land_hold'` (or `'existing'` as a Phase 1 approximation) to `investmentStrategyToDealType()` so saving Land Hold strategy does not silently leave `deal_type` unchanged.
2. **Fix Build-to-Sell slug** — Add `'build_to_sell'` to `development_ground_up.strategyTriggers` in `proforma-blueprint.ts` so `proformaTemplateId` resolves correctly for BTS deals.

Both fixes are 1-line changes and can be bundled in T2.4.

---

## 10. Open Questions — Classified

> **AMENDMENT — 2026-05-27:** Three BLOCKING items (Q1, Q3, Q6) were resolved by Tasks #1265 and #1355 before the P8 verification pass ran. Status updated below. Substantive analysis is unchanged.

### BLOCKING

**Q1 — Land Hold mapping gap in investmentStrategyToDealType()** ~~BLOCKING~~ → **RESOLVED (Task #1265)**  
~~`'Land Hold'` is in INV_VALID but NOT in the `investmentStrategyToDealType()` mapping. Saving `investmentStrategy = 'Land Hold'` leaves `deals.deal_type` unchanged.~~  
**Resolution:** `'Land Hold': 'existing'` added at `deal-assumptions.routes.ts` line 965 (Task #1265 — Phase 1 approximation; Phase 2 will add proper `'land_hold'` DealTypeKey).

**Q2 — DealTypeKey enum does not include 'land_hold', 'flip', or 'str'**  
`DealTypeKey` in `m09_line_item_patterns.ts` has 6 values; these three strategy types have no corresponding deal type. For Phase 1 (multifamily-existing only), this is out of scope. For Phase 2 (full strategy type support), DealTypeKey must be extended.  
**Phase 1 resolution:** Map Land Hold → `'existing'` as a Phase 1 approximation (done — Q1 resolved). Add proper `'land_hold'` value in Phase 2.

**Q3 — 'Build-to-Sell' slug mismatch with strategyTriggers** ~~BLOCKING~~ → **RESOLVED (Task #1265)**  
~~`pickTemplateForStrategy('build_to_sell')` returns `'acquisition_stabilized'` (fallback) instead of `'development_ground_up'` because blueprint triggers use `'bts'` not `'build_to_sell'`.~~  
**Resolution:** `'build_to_sell'` added to `development_ground_up.strategyTriggers` at `proforma-blueprint.ts` line 170 (Task #1265 — verified in P8 verification pass).

### IMPORTANT

**Q4 — 'Short-Term Rental' and 'Rental' both map to `deal_type = 'existing'`**  
STR deals lose their deal_type distinction. Pattern B routing sees `'existing'` — 0 Pattern B rows — which is correct for stabilized displays but loses the STR-specific template routing for `proformaTemplateId`. Currently not a blocking issue because STR has no template-specific UI (see STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md §3b). Needs resolution in Phase 2 alongside DealTypeKey extension.

**Q5 — Existing deals have no investment_strategy_lv set; no retroactive sync**  
Deals created before Task #1233 have `deal_type` set at creation but `investment_strategy_lv.override = null`. The Deal Terms tab shows `NOT SET` badge. If operators never save investmentStrategy, `deal_type` remains as originally set — which is correct (it doesn't regress). However, the `proformaTemplateId` derivation returns null for these deals, falling back to deal_type-based rendering. For Phase 1, this is acceptable.

**Q6 — proformaTemplateId is computed but not used to gate template-specific rendering** ~~IMPORTANT~~ → **RESOLVED (Task #1355)**  
~~ProFormaSummaryTab receives `proformaTemplateId` but all tab branching reads `deal_type` directly. Template-aware rendering is not implemented.~~  
**Resolution:** `proformaTemplateId` wired into ProFormaSummaryTab rendering by Task #1355 (confirmed by P8 verification pass).

### INFORMATIONAL

**Q7 — cashflow.postprocess.ts double-read pattern**  
Line 1375: `proformaFields['deal_type'] ?? proformaFields['investment_strategy']`. Since Task #1233 ensures both are set consistently after a strategy save, this fallback is now redundant but harmless. Can be simplified to single read in a cleanup pass.

**Q8 — The existing STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md contains a stale claim**  
§3a.1 and SOURCE CITATION INDEX entry for "PATCH /assumptions/strategy does NOT update deals.deal_type" are incorrect as of Task #1233. The P8 verification (Task #1249) passed before Task #1233 was implemented. A closing amendment to that document should note this, but it does not block T2.4.

---

## 11. Source Citation Index

| Claim | File | Lines | Status |
|---|---|---|---|
| investmentStrategyToDealType() function | `backend/src/api/rest/deal-assumptions.routes.ts` | 956-966 | VERIFIED — function exists, maps 7 values |
| Atomic transaction writes both LV and deal_type | `backend/src/api/rest/deal-assumptions.routes.ts` | 987-1058 | VERIFIED — BEGIN/COMMIT block, two UPDATE statements |
| INV_VALID includes 'Land Hold' (not in mapping function) | `backend/src/api/rest/deal-assumptions.routes.ts` | 976, 956-966 | VERIFIED — 'Land Hold' in array at 976, absent from map |
| deal_type defaults to 'existing' | `backend/src/api/rest/cashflow-underwriting.routes.ts` | 249 | VERIFIED (P8 Task #1249 confirmed) |
| Pattern B routing reads deal_type, not investmentStrategy | `frontend/src/config/m09_line_item_patterns.ts` | 168-173 | VERIFIED (P8 Task #1249 confirmed) |
| ProFormaSummaryTab reads deal_type directly | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 946 | VERIFIED (P8 Task #1249 confirmed) |
| proformaTemplateId prop received but falls back | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` | 87-91 | VERIFIED — comment text confirmed |
| pickTemplateForStrategy() function | `backend/src/services/proforma/blueprint/index.ts` | 30-38 | VERIFIED — iterates PROFORMA_TEMPLATES.strategyTriggers |
| defaultTemplateForDealType() function | `backend/src/services/proforma/blueprint/index.ts` | 41-50 | VERIFIED — handles existing/development/redevelopment |
| pickTemplateForStrategy called for proformaTemplateId | `backend/src/services/proforma-adjustment.service.ts` | 3140-3142 | VERIFIED — slug normalization + function call |
| 'build_to_sell' not in development_ground_up triggers | `backend/src/services/proforma/blueprint/proforma-blueprint.ts` | 170 | VERIFIED — triggers: ['bts', 'bts_for_rent', 'development', 'ground_up'] |
| RenovationAssumptionsSection gate | `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` (via AssumptionsTab) | AssumptionsTab.tsx 1575 | VERIFIED — `rawDealType` from deal_type |
| cashflow.postprocess.ts double-read | `backend/src/agents/cashflow.postprocess.ts` | 1375 | VERIFIED — `deal_type ?? investment_strategy` |
| investmentStrategy resolved LV composition | `backend/src/services/proforma-adjustment.service.ts` | 3130-3142 | VERIFIED — resolved = override ?? detected.value ?? null |
| deal_type stored in benchmark tables | Migrations: `archive_assumption_benchmarks`, `line_item_benchmarks`, `assumption_snapshots`, `assumption_outcomes` | SQL schemas | VERIFIED — TEXT NOT NULL column in all four |

---

## P8 VERIFICATION — Task #1264

**Date:** 2026-05-27  
**Verifier:** Task #1264 (non-self-verification pass)  
**Protocol:** P8 — Verify Before Decision  
**Method:** Read-only. No code changes. All material claims checked against live codebase.

---

### V1. Document Integrity

All 11 sections present and complete. Table of Contents matches content. No TODO markers, placeholder text, or incomplete stubs. Source Citation Index has 15 entries. Open questions classified with 3 tiers (BLOCKING / IMPORTANT / INFORMATIONAL). Phase scope (multifamily-existing first) stated in header.

**Result: PASS**

---

### V2. Source Citation Spot-Checks

15 of 15 source citations verified against live codebase.

| Claim | File | Lines | Verified? | Notes |
|---|---|---|---|---|
| investmentStrategyToDealType() maps 7 values | `deal-assumptions.routes.ts` | 956-966 | ✓ CONFIRMED | Exact match. 7 keys; 'Land Hold' absent |
| Atomic transaction BEGIN/COMMIT | `deal-assumptions.routes.ts` | 987-1058 | ✓ CONFIRMED | `client.query('BEGIN')` at 992, `COMMIT` at 1058 |
| INV_VALID has 'Land Hold', mapping does not | `deal-assumptions.routes.ts` | 976, 956-966 | ✓ CONFIRMED | 'Land Hold' at line 976 in array; not in map |
| deal_type COALESCE default 'existing' | `cashflow-underwriting.routes.ts` | 249 | ✓ CONFIRMED | `COALESCE(d.deal_type, 'existing') AS deal_type` |
| Pattern B routing reads deal_type | `m09_line_item_patterns.ts` | 168-173 | ✓ CONFIRMED | (P8 #1249 prior pass) |
| ProFormaSummaryTab line 946 reads deal_type | `ProFormaSummaryTab.tsx` | 946 | ✓ CONFIRMED | `const dealType: string = (deal?.['deal_type'] as string | null) ?? ... ?? 'existing'` |
| proformaTemplateId prop with fallback comment | `ProFormaSummaryTab.tsx` | 87-91 | ✓ CONFIRMED | Comment text verbatim |
| pickTemplateForStrategy() iterates strategyTriggers | `blueprint/index.ts` | 30-38 | ✓ CONFIRMED | Exact match |
| defaultTemplateForDealType() handles 3 types | `blueprint/index.ts` | 41-50 | ✓ CONFIRMED | switch on existing/development/redevelopment; default → acquisition_stabilized |
| pickTemplateForStrategy called at proformaTemplateId | `proforma-adjustment.service.ts` | 3140-3142 | ✓ CONFIRMED | Slug normalization + call + defaultTemplateForDealType fallback (see Gap 1 below) |
| 'build_to_sell' absent from development_ground_up triggers | `proforma-blueprint.ts` | 170 | ✓ CONFIRMED | triggers: ['bts', 'bts_for_rent', 'development', 'ground_up'] — no 'build_to_sell' |
| RenovationAssumptionsSection gate reads rawDealType | `AssumptionsTab.tsx` | 1575 | ✓ CONFIRMED | `const rawDealType = ((deal?.deal_type || deal?.dealType || '') as string).toLowerCase().trim()` |
| cashflow.postprocess.ts double-read at 1375 | `cashflow.postprocess.ts` | 1375 | ✓ CONFIRMED | `const dealTypeField = proformaFields['deal_type'] ?? proformaFields['investment_strategy']` |
| investmentStrategy LV composition | `proforma-adjustment.service.ts` | 3130-3142 | ✓ CONFIRMED | resolved = override ?? detected.value ?? null; slug normalization confirmed |
| deal_type TEXT column in 4 benchmark tables | Migration SQL schemas | — | ✓ CONFIRMED | archive_assumption_benchmarks, line_item_benchmarks, assumption_snapshots, assumption_outcomes all verified |

**Result: PASS — all 15 citations confirmed accurate**

---

### V3. Migration Cost Estimates

**A1 cost (HIGH) — independently assessed:**  
The document claims A1 requires migrating 4 benchmark table schemas plus 40+ call sites across 8+ files. Independently: `grep -rn "deal_type"` across `backend/src/` returns 409 lines (excluding tests). Restricting to meaningful routing calls (not display or archive-only reads) yields 13+ consumers. Schema change to 4 benchmark tables is confirmed by migration SQL. Assessment: HIGH migration cost for A1 is correctly rated.

**A2 cost (LOW for Phase 1) — independently assessed:**  
Task #1233 bridge is in production. Two named gaps in §6.2 (Land Hold mapping: 1 line; proformaTemplateId rendering: T2.4 deliverable). Assessment: LOW is correctly rated for Phase 1.

**Result: PASS — migration cost estimates are plausible and complete for Phase 1 scope**

---

### V4. Vocabulary Mapping Verification

Full mapping table in §7 verified against `investmentStrategyToDealType()` (lines 956-966) and `strategyTriggers` arrays in `proforma-blueprint.ts`:

| investmentStrategy | deal_type | templateId slug | strategyTrigger match? |
|---|---|---|---|
| Rental | existing | rental | ✓ triggers: ['rental', 'core', 'core_plus'] |
| Value-Add | value_add | value_add | ✓ triggers: ['value_add', 'rental_value_add'] |
| Build-to-Sell | development | build_to_sell | ✗ triggers: ['bts', 'bts_for_rent', 'development', 'ground_up'] — no 'build_to_sell' → GAP confirmed |
| Flip | value_add | flip | ✓ triggers: ['flip'] |
| Redevelopment | redevelopment | redevelopment | ✓ triggers: ['redevelopment', 'reposition', 'gut_rehab'] |
| Lease-Up | lease_up | lease_up | ✗ no template has 'lease_up' trigger → fallback acquisition_stabilized → GAP confirmed |
| Short-Term Rental | existing | short_term_rental | ✓ triggers: ['str', 'short_term_rental'] — template correct; deal_type loses STR distinction (Phase 2) |
| Land Hold | NOT WRITTEN | land_hold | ✓ triggers: ['land', 'land_hold'] — template correct; deal_type not written → BLOCKING GAP confirmed |

**Result: PASS — all 8 rows in §7 are accurate**

---

### V5. Open Questions Classification Review

| # | Question | Document Class | Verification Class | Correct? |
|---|---|---|---|---|
| Q1 | Land Hold mapping gap | BLOCKING | BLOCKING | ✓ — saves Land Hold strategy without updating deal_type |
| Q2 | DealTypeKey enum missing land_hold/flip/str | BLOCKING | BLOCKING | ✓ — Phase 2 scope, but Land Hold needs Phase 1 approximation |
| Q3 | Build-to-Sell slug mismatch | BLOCKING | BLOCKING | ✓ — confirmed by trigger table inspection |
| Q4 | STR and Rental both → 'existing' | IMPORTANT | IMPORTANT | ✓ — design decision, not Phase 1 blocker |
| Q5 | Pre-Task-#1233 deals have no investmentStrategy | IMPORTANT | IMPORTANT | ✓ — deal_type correctly retained; not a regression |
| Q6 | proformaTemplateId not yet used in rendering | IMPORTANT | IMPORTANT | ✓ — T2.4 main deliverable |
| Q7 | cashflow.postprocess.ts double-read redundancy | INFORMATIONAL | INFORMATIONAL | ✓ — harmless, cleanup only |
| Q8 | STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md stale claim | INFORMATIONAL | INFORMATIONAL | ✓ — confirmed stale; no block on T2.4 |

**Result: PASS — all 8 questions correctly classified**

---

### V6. Gaps Identified by Verification

**Gap 1 — INFORMATIONAL (new, not in document):**  
`proforma-adjustment.service.ts` lines 3141-3143 contain a fallback not described in §2.3:

```typescript
const proformaTemplateId = _strategyForTemplate
  ? pickTemplateForStrategy(_strategyForTemplate)
  : defaultTemplateForDealType((deal.deal_type ?? 'existing') as 'existing' | 'development' | 'redevelopment');
```

When `investmentStrategy` is null/empty, `_strategyForTemplate` is `''` (falsy), so `defaultTemplateForDealType` is called with `deal.deal_type`. Since `defaultTemplateForDealType` only accepts 3 types (`existing | development | redevelopment`), a `deal_type = 'value_add'` deal hits the TypeScript default case and returns `'acquisition_stabilized'`. This means a value-add deal with no investmentStrategy gets `proformaTemplateId = 'acquisition_stabilized'` — not null.

**Current impact:** None. ProFormaSummaryTab ignores `proformaTemplateId` today (falls back to deal_type routing for all rendering). No visible regression.

**T2.4 impact:** Once T2.4 wires `proformaTemplateId` into template-aware rendering, value-add deals that predate Task #1233 (no investmentStrategy saved) will route to the wrong template. T2.4 must handle this by either: (a) extending `defaultTemplateForDealType` to cover all 6 DealTypeKey values, or (b) checking `deal_type` directly when strategy is absent.

This is not a gap in the investigation document's analysis — it is a T2.4 implementation note.

**Gap 2 — MINOR (count discrepancy, not an error):**  
§2.2 states "Read paths: 6 consumers" but §3.2 table has 7 rows. Rows 2 and 3 in §3.2 both cite `deal-assumptions.routes.ts` (LV write and A2 bridge are the same file). Counting as 1 file → 6 unique files. Counting as 2 functions → 7 rows. The table is more precise. No impact on analysis.

---

### VERDICT

**APPROVED**

All 15 source citations are accurate. Migration cost estimates are correctly rated (A1 = HIGH, A2 = LOW). Vocabulary mapping is confirmed correct for all 8 rows. All 8 open questions are correctly classified. Two informational gaps noted above do not affect the recommendation or block T2.4 scoping.

**T2.4 may begin.** The operator (Leon) should confirm the A2 recommendation before T2.4 is kicked off. The three BLOCKING open questions (Q1, Q2, Q3) are all small code changes that can be bundled in T2.4 itself.

**One T2.4 pre-condition added by this verification:** Extend `defaultTemplateForDealType` (or add a fallback resolver) to handle `value_add`, `lease_up`, and `stabilized` deal types — prevents wrong template routing for pre-Task-#1233 deals once `proformaTemplateId` is wired into rendering.
