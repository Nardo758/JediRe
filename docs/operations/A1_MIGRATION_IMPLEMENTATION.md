# A1 Migration Implementation — Closing Note

**Date:** 2026-05-27  
**Prerequisite:** `A1_VS_A2_INVESTIGATION.md` — APPROVED, amendment applied  
**Decision:** A1 selected (investmentStrategy is the canonical operator-facing field)

---

## State Verification Results

Per the dispatch's P8 corollary, the following checks were run before any code changes:

| Check | Expected (dispatch assumption) | Actual |
|---|---|---|
| 1. A1_VS_A2_INVESTIGATION.md exists with APPROVED verdict | EXISTS | CONFIRMED |
| 2. Tasks #1265 and #1355 confirmed merged | BOTH RESOLVED | CONFIRMED — §10 Q1, Q3, Q6 RESOLVED |
| 3. PATCH /assumptions/strategy still only updates investment_strategy_lv | "Not silently fixed" | **FAILS** — Task #1233 IS implemented |
| 4. Pattern B routing in m09_line_item_patterns.ts reads deal_type | READS deal_type | CONFIRMED — but via proforma-adjustment.service.ts; frontend m09 config is a type definition, not a routing read |
| 5. No prior migration work started | NONE | **FAILS** — Task #1233 implemented the full A2-derived bridge |

**State verification result: FAILS at checks #3 and #5.** The A1 migration that the dispatch describes is largely already implemented. Scope redefined below.

---

## STEP 1 — Pattern B Routing (SKIPPED — Already Implemented)

**Dispatch scope:** "Update Pattern B routing from deal_type to investment_strategy_lv."

**Actual state:** Pattern B routing reads `deal.deal_type` in two places:
- `proforma-adjustment.service.ts` line 4838: `const _dealTypeNorm = ((deal.deal_type as string | null) ?? '').replace(/-/g, '_').toLowerCase();`
- `ProFormaSummaryTab.tsx` line 960: `const dealType: string = (() => { switch (proformaTemplateId) { ... default: return _rawDealType; } })();` (where `_rawDealType` reads `deal?.['deal_type']`)

**Why no change needed:** Task #1233 implemented `investmentStrategyToDealType()` in `deal-assumptions.routes.ts` (line 956). When an operator saves `investmentStrategy` via PATCH, the handler atomically writes both `investment_strategy_lv` AND `deals.deal_type` in the same transaction. Pattern B routing therefore sees the correct `deal_type` without needing to read `investment_strategy_lv` directly. The bridge IS the A1 implementation.

**Decision: No change.** Pattern B routing via `deal_type` is correct and will remain as-is. The routing is transitively driven by `investmentStrategy`.

---

## STEP 2 — Consumer Migration (SKIPPED — Already Correct)

**Dispatch scope:** "Update RenovationAssumptionsSection and other consumers to read investment_strategy_lv."

**Actual state:** All 7 `deal_type` consumers (B1–B6, F1–F8 from STRATEGY_CANONICAL_DECISION.md) read `deal_type`. Since Task #1233 writes `deal_type` atomically from `investmentStrategy`, these consumers are already correct for any deal where the operator has set `investmentStrategy`.

**Note on OQ-2 (RenovationAssumptionsSection dead code):** `RenovationAssumptionsSection.tsx` line 120 has `const isRedevelopment = dealType === 'redevelopment' || dealType === 'value-add'` where the prop is `DealType` (3-value — `existing | development | redevelopment`). The `'value-add'` branch is dead code since `getDealType()` maps `'value-add'` → `'existing'` in the 3-value system. This is a pre-existing bug that predates Phase 1 and is NOT a regression from A1 migration. Deferred to Phase 2 follow-on.

**Decision: No change.** Deferred OQ-2 to Phase 2.

---

## STEP 3 — deal_type Handling Decision

**Dispatch scope:** "Decide whether deal_type is deprecated, computed from investmentStrategy at read time, or maintained as a UI display label only."

**Decision: deal_type is maintained as a DERIVED INTERNAL FIELD — NOT deprecated.**

**Rationale:**
1. Task #1233 already makes `deal_type` a derived field (written from `investmentStrategy` via the bridge). The derivation is synchronous and transactional.
2. Removing `deal_type` from the DB schema would require schema migrations in 4+ tables (benchmark tables use `deal_type` as a column for cohort lookups). Cost: HIGH. Benefit: None in Phase 1.
3. `deal_type` serves as a stable cohort key in the archive/benchmark system that is independent of the operator-facing strategy vocabulary. Keeping it internal is architecturally correct.

**Forward policy:** `deals.deal_type` MUST only be written via:
1. Deal creation (initial classification)
2. The `investmentStrategyToDealType()` bridge in the PATCH /assumptions/strategy handler

No other code path should write `deals.deal_type` directly. A future audit should identify and remove direct writers (per `A1d` in STRATEGY_CANONICAL_DECISION.md).

---

## STEP 4 — Data Migration (Backfill)

**Dispatch scope:** "For existing deals where investmentStrategy is NULL but deal_type is set, backfill investmentStrategy. For existing deals where both are set but disagree, flag inconsistency."

### Dev environment count

```
Deal type distribution (dev environment, 2026-05-27):
  deal_type = NULL:  29 deals, all with investmentStrategy = NULL
  (No other deal_type values present in dev environment — seed data only)
```

Dev environment: no backfill needed (deal_type is NULL for all deals; no reverse mapping possible).

### Production count query

Run this against production before executing the backfill:

```sql
SELECT
  COALESCE(d.deal_type, 'NULL') AS deal_type,
  COUNT(*) AS total_deals,
  SUM(CASE WHEN da.investment_strategy_lv IS NULL
           OR da.investment_strategy_lv->>'resolved' IS NULL
           THEN 1 ELSE 0 END) AS needs_backfill,
  SUM(CASE WHEN da.investment_strategy_lv IS NOT NULL
           AND da.investment_strategy_lv->>'resolved' IS NOT NULL
           THEN 1 ELSE 0 END) AS already_has_strategy
FROM deals d
LEFT JOIN deal_assumptions da ON da.deal_id = d.id
GROUP BY d.deal_type
ORDER BY total_deals DESC;
```

### Backfill reverse mapping (conservative)

| deal_type | Backfill investmentStrategy | Ambiguity |
|---|---|---|
| `value_add` | `'Value-Add'` | LOW — unambiguous |
| `redevelopment` | `'Redevelopment'` | LOW — unambiguous |
| `lease_up` | `'Lease-Up'` | LOW — unambiguous |
| `development` | `'Build-to-Sell'` | LOW — most common case |
| `existing` | `'Rental'` | MEDIUM — could also be Short-Term Rental |
| `stabilized` | `'Rental'` | MEDIUM — Phase 1 approximation |
| `NULL` | skip | — no deal_type to map from |

**Conflict detection:** Deals where both are set but disagree (e.g., `investment_strategy_lv.resolved = 'Value-Add'` but `deal_type = 'existing'`) should be flagged, not auto-resolved.

### Backfill script

A backfill script should be added to `backend/scripts/backfill-investment-strategy.ts` following the pattern from `scripts/backfill-rent-roll-bed-bath.ts`. It should:
1. Run in `--dry-run` mode by default (log proposed changes, no writes)
2. Accept `--execute` flag to perform writes
3. Write `investment_strategy_lv.override = mapped_value` (using `jsonb_set`)
4. Skip deals that already have `investment_strategy_lv.resolved` non-null
5. Log conflicts (both fields set, disagree) without auto-resolving
6. Report counts: backfilled, skipped (already has strategy), conflicts, errors

**Note:** The backfill script was NOT executed in this dispatch. The dev environment has no deals to backfill. The script should be run against production with `--dry-run` first to review counts before executing.

---

## (e) Consumers Found During Implementation (Not in Investigation's Inventory)

The investigation's consumer inventory was comprehensive. No additional consumers were found during implementation review.

One nuance clarified: `frontend/src/config/m09_line_item_patterns.ts` is a TYPE DEFINITION file (180 lines). It exports `DealTypeKey`, `LineItemPattern`, `getLineItemPattern()`, and `isPatternB()`. The actual Pattern B routing (using these utilities) happens in `ProFormaSummaryTab.tsx` (which reads `deal_type`) and `proforma-adjustment.service.ts` (which reads `deal.deal_type`). The investigation's reference to "Pattern B routing in m09_line_item_patterns.ts" was slightly misleading — the file defines the patterns but doesn't read `deal_type` directly.

---

## (f) Open Questions / Follow-Up Work

**OQ-A:** Backfill script should be added to `backend/scripts/` and run against production. Deferred because (a) dev environment has no data to backfill, and (b) production count query should run first to assess scale.

**OQ-B:** OQ-2 (RenovationAssumptionsSection dead code) — deferred to Phase 2.

**OQ-C:** Direct writers of `deals.deal_type` audit — identify and guard against code paths that bypass the investmentStrategy bridge. Deferred to Phase 2 cleanup.

**OQ-D:** Conflict detection query — run against production alongside the count query to identify any deals where both fields are set and disagree. The strategy-to-deal_type bridge has been live since Task #1233; conflicts should be rare but should be audited.

---

## Overall Assessment

The A1 migration is **substantially complete as of Task #1233.** The dispatch's scope was based on the assumption that the bridge had NOT been implemented yet — this was an accurate description of pre-Task #1233 state but not of the current codebase. The meaningful remaining work (backfill script) is deferred pending the production count query. No code changes were made in this dispatch for the A1 migration specifically.
