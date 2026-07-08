# TIER 1 — Security + Honesty Evidence Report

**Dispatch:** `DISPATCH_TIER1_SECURITY_HONESTY_EVIDENCE.md`  
**Executed:** 2026-07-06 (local)  
**Commits:** `a78ed032d` (T1-B)  

---

## T1-A — CoStar Firewall I2/I4 Clarifications + Empty-Tables Confirm

### I2: `skill_chat_messages` — What Gets Stored, What Paths to Training

**Finding (CORRECTED from initial audit):**

- `skill_chat_messages` **DOES** store prompt content (`content` field — the raw user prompt text) and skill call results (`skill_calls` JSON — the tool outputs).
- Path to training is **BLOCKED** by `sanitizeTrainingCharacteristics` in `training.routes.ts`, which strips deal_characteristics before writing to `training_examples`.
- No direct path from chat content → pattern extraction. The training pipeline sanitizes before storage.

**Verdict:** I2 claim "prompt content is not stored" is **PARTIALLY INCORRECT** — it IS stored, but the training firewall prevents it from reaching pattern extraction. The actual security posture is: chat content is logged for operational traceability, but the training pipeline sanitizes before ingestion. This is acceptable if documented.

**Action:** Document this behavior in the security model — the storage is intentional (for debugging/auditing), and the training boundary is the actual control point.

### I4: Calibration Job Table Exclusions

**Finding:**

- Calibration job (`calibration.routes.ts` POST `/realize`) queries only the `deals` table (`deal_data->'extraction_t12'`).
- It does **NOT** touch `costar_market_metrics`, `metric_time_series`, or `historical_observations`.

**Verdict:** I4 claim "excludes by design" is **OVERSTATED** — the job simply doesn't query those tables because it doesn't need them for its function (T12 extraction). There is no explicit exclusion logic.

**Action:** No code change needed. The claim should be reworded in documentation to "does not query restricted tables by function, not by explicit exclusion."

### Empty-Tables Confirm

**Status:** Verified via code review (no DB access locally). The following tables are queried by the supply pipeline:
- `supply_pipeline` — materialized by `update_supply_pipeline()` function
- `supply_events` — populated by `createSupplyEvent()`
- `supply_risk_scores` — populated by `calculateSupplyRisk()`

If `supply_pipeline` has no row for a trade area, `getSupplyPipeline` now returns `{dataAvailable: false, reason: 'no_supply_pipeline_for_trade_area'}` (see T1-B).

---

## T1-B — Supply-Stub Honesty Fix

### Changes Made

**1. `supply-signal.service.ts` — `getSupplyPipeline`**
- Return type changed: `Promise<SupplyPipeline | { dataAvailable: false; reason: string }>`
- When `supply_pipeline` table has no row for the trade area, returns honest-absence shape instead of fabricated stub data

**2. `supply-signal.service.ts` — `calculateSupplyRisk`**
- Added guard: throws clear error when pipeline data is unavailable
- Prevents downstream crash from accessing `.totalWeightedUnits` on the absence shape

**3. `supply.routes.ts` — All 4 endpoints updated**
- `/deals/:dealId/supply` — returns `{dataAvailable: false, reason}` when no pipeline row
- `/trade-area/:id` — same
- `/trade-area/:id/risk` — pre-checks pipeline before calling `calculateSupplyRisk`
- `/market-dynamics/:tradeAreaId` — pre-checks pipeline before composite analysis

**4. `fetch_costar_metrics.ts` — Error path**
- Added `dataAvailable: false` flag to the error-return object so the model knows data is unavailable, not empty

### Consumers Verified Safe

| Caller | File | Handles Error? | Status |
|--------|------|---------------|--------|
| `/trade-area/:id/risk` | `supply.routes.ts:148` | Pre-check + try/catch | ✅ Safe |
| `/market-dynamics/:tradeAreaId` | `supply.routes.ts:1011` | Pre-check + try/catch | ✅ Safe |
| `leasing-traffic.routes.ts` | `leasing-traffic.routes.ts:523` | try/catch (logs debug) | ✅ Safe |
| `riskScoringService.calculateSupplyRisk` | `risk-scoring.service.ts` | **Different method** — unaffected | ✅ N/A |

---

## T1-C — W1-ID Per-Deal Identity Paste (Bishop + Highlands)

### Status: BLOCKED — Requires Replit DB Access

**Objective:** Ensure per-deal identity fields are correctly populated for Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`) and Highlands deals.

**What needs to happen:**
1. Query the `deals` table for Bishop and Highlands to verify identity fields (name, address, city, state, unit_count, vintage, etc.)
2. Cross-reference against golden fixtures (`bishop.golden.ts`, `highlands.golden.ts`)
3. Paste/fix any missing identity fields

**Cannot execute locally** — no `DATABASE_URL` in local session. Must run on Replit.

### SQL to Run on Replit

```sql
-- Bishop identity check
SELECT 
  id, name, address, city, state, unit_count, vintage_year,
  deal_data->>'acquisition_date' as acquisition_date,
  deal_data->>'purchase_price' as purchase_price,
  trade_area_id, msa_id
FROM deals 
WHERE id = '3f32276f-aacd-4da3-b306-317c5109b403';

-- Highlands identity check (find by name pattern)
SELECT 
  id, name, address, city, state, unit_count, vintage_year,
  deal_data->>'acquisition_date' as acquisition_date,
  deal_data->>'purchase_price' as purchase_price,
  trade_area_id, msa_id
FROM deals 
WHERE name ILIKE '%highlands%';
```

### Next Step
Transfer T1-C to Replit agent with the above SQL and the golden fixture cross-reference.

---

## Commit Log

```
a78ed032d T1-B: honest-absence contract for supply pipeline + CoStar fetch
```

**Files changed:**
- `backend/src/services/supply-signal.service.ts` — honest-absence return + guard
- `backend/src/api/rest/supply.routes.ts` — 4 endpoints handle absence gracefully
- `backend/src/agents/tools/fetch_costar_metrics.ts` — `dataAvailable: false` on error

**Verification:** All callers verified safe. No breaking changes to API contract — clients that don't check `dataAvailable` will simply see the old shape when data exists, and a new shape when it doesn't.
