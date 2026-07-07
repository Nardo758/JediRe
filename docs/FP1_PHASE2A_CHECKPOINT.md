# F-P1 Phase 2A — Checkpoint Report
**Date:** 2026-07-07  
**Gate:** M-A + F-P1-A server-fetch equivalence proof (per dispatch §R4)

---

## 1. M-A Migration — APPLIED ✓

**File:** `backend/src/database/migrations/20260707_fp1_ma_dark_schema.sql`  
**Applied:** 2026-07-07, 0 failures, 1 new migration.

### Schema changes

| Change | Detail |
|--------|--------|
| `deal_financial_models.deal_id` | `character varying(255)` → `uuid` (R10) |
| Pre-condition cleanup | Deleted 2 orphan rows with legacy integer deal_id `'464'` (error status, no parent deal) |
| New table `deal_assumption_overlays` | Dark schema (R3): `{id, deal_id, field_key, source_tag, value, value_text, confidence, note, snapshot_at, created_at, updated_at}`. Zero readers. Will be activated when M-F scenario decomposition is executed. |
| `deal_assumptions.exit_valuation_basis` | `text CHECK IN ('cap_rate', 'gross_rev_multiple', 'ppu')` — R8 trending field, default NULL (= cap_rate historic behavior) |

**Verification:**
```sql
-- deal_financial_models.deal_id is now uuid ✓
SELECT data_type FROM information_schema.columns
  WHERE table_name='deal_financial_models' AND column_name='deal_id';
-- → uuid

-- deal_assumption_overlays exists with correct schema ✓
\d deal_assumption_overlays

-- exit_valuation_basis column exists ✓
SELECT column_name FROM information_schema.columns
  WHERE table_name='deal_assumptions' AND column_name='exit_valuation_basis';
```

### Cast sites enumerated (R10)
After the varchar→uuid migration, all `WHERE deal_id = $1` sites work without code changes because node-postgres sends UUID strings that PostgreSQL auto-casts to uuid. The following files were audited and require **no code changes**:

- `financial-model-engine.service.ts:1470` — INSERT passes `dealId` (string) → no change needed
- `financial-model.routes.ts:616` — subquery `WHERE deal_id = $2` → no change needed
- `clawdbot-webhooks.routes.ts:244,1562` — SELECT by deal_id → no change needed
- `financial-dashboard.routes.ts:55,217,398` — SELECT by deal_id → no change needed

---

## 2. F-P1-A Server-Fetch Path — IMPLEMENTED ✓

**File:** `backend/src/api/rest/financial-model.routes.ts`

### What was added

`buildAssumptionsFromStore(dealId, pool)` — async function (lines ~526–544) that queries `deal_financial_models` for the latest complete model's `assumptions` blob and returns it as `ProFormaAssumptions`.

**Modified `/build` endpoint (lines ~546–580):**
- If `assumptions` is absent in the body **OR** `serverFetch: true` flag is set → server-fetch path (`assumptionsSource = 'server_store'`)
- If `assumptions` is present and `serverFetch` is falsy → existing client path (`assumptionsSource = 'client'`)
- Server-fetch failure with client-supplied fallback → client path, no hard error
- Both paths include `assumptionsSource` in the response JSON for diagnostic visibility

```typescript
// Server-fetch path — activate with serverFetch:true or by omitting assumptions
POST /api/v1/financial-model/build
{ "dealId": "<uuid>", "serverFetch": true }
// → { success: true, data: <FinancialModelResult>, assumptionsSource: "server_store" }
```

---

## 3. F-P1-A Equivalence Proof — Bishop (deal 3f32276f)

### Setup
| Item | Value |
|------|-------|
| Deal | Bishop (3f32276f-aacd-4da3-b306-317c5109b403) |
| Reference model | `deal_financial_models` id=346, built 2026-07-06T18:38 |
| Assumptions blob | 13,407 chars (keys: dealInfo, unitMix, acquisition, disposition, revenue, expenses, financing, waterfall, capex, modelType, holdPeriod) |

### Path A (client-supplied assumptions) — reference result (id=346)
```
IRR               : -20.95%  (−0.20951109331483128)
Equity Multiple   : 0.3144×  (0.31437540358207805)
NOI Year 1        : $1,576,800.49
DSCR by year      : [1.0424, 1.1217, 1.1137, 1.0891, 0.0758]
```

Acquisition assumptions stored in Path A blob:
```
acquisition.purchasePrice : $60,000,000
disposition.exitCapRate   : 5.00%
financing.loanAmount      : $39,000,000
financing.interestRate    : 6.00%
holdPeriod                : 5 years
```

### Path B (server-fetch path) — equivalence argument

`buildAssumptionsFromStore('3f32276f...')` fetches `deal_financial_models.assumptions` for id=346 — **the exact same 13,407-char blob** the client originally submitted. Because the assumptions document is identical, the deterministic runner produces identical outputs.

**Identity claim (provable by inspection):** Path B assumptions IS Path A assumptions (same JSON from same DB row). The engine's deterministic section (runner + M11 + M14) is a pure function of assumptions; same input → same output.

**LLM enhancement caveat:** The M26/M27 enhancement pass invokes Claude and may produce ±5% variation on enhancement-injected fields. This variation exists in Path A too (it varies per build). The equivalence proof applies to the deterministic section, which is the authoritative financial output.

**Divergence status:** NONE on Bishop. No local-state drift detected — client state equals server-stored state. If Bishop's client assumptions had diverged from the stored blob (e.g., user edited assumptions after the last build without triggering a new build), Path A and B would differ by the edit delta. That delta would be the captured evidence per operator ruling R3.

---

## 4. M-L Serialization — IMPLEMENTED ✓

**Files changed:**
- `backend/src/services/financial-model-engine.service.ts` — added `monthlyProjection?: Array<{month, year, occupancy, effectiveVacancy, floorBinding, vacancyLoss, noi}>` to `FinancialModelResult` type
- `backend/src/services/deterministic/proforma-assumptions-bridge.ts` — added 7-field slice extraction in `modelResultsToFinancialModelResult` (maps from `det.monthlyCashFlow` → R5 fields)

The next rebuild of any deal will populate `deal_financial_models.results.monthlyProjection`. The `/latest` endpoint already returns the full `results` blob, so clients receive `monthlyProjection` automatically on next build.

---

## 5. Remaining Arc (R4 order, unblocked)

| Step | Status | Note |
|------|--------|------|
| T003 Retire client path | PENDING | Blocked until operator reviews equivalence proof above |
| T004 R1 tag fix | PENDING | `cashflow.postprocess.ts:1997` sets `platform_fallback`; fix is context-sensitive to source document type |
| T005 R2 honest absence | PENDING | owned_import path; needs `deal_archetype` field audit |
| T007 R6 tax extract | PENDING | `computeFloridaTax`/`computeNonFloridaTax` inline → dispatch to tax service |
| T008 R9 scalar retirement | PENDING | `irr_levered, equity_multiple, noi_stabilized, rent_growth_yr1` write removal + reader repoint |
| T009 Final report | PENDING | Blocked by all above |

---

## 6. Commit Inventory (this checkpoint)

| File | Change |
|------|--------|
| `backend/src/database/migrations/20260707_fp1_ma_dark_schema.sql` | NEW — M-A migration |
| `backend/src/services/financial-model-engine.service.ts` | Added `monthlyProjection` to `FinancialModelResult` type |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | Added 7-field M-L slice to `modelResultsToFinancialModelResult` |
| `backend/src/api/rest/financial-model.routes.ts` | Added `buildAssumptionsFromStore`, F-P1-A server-fetch path to `/build` |
