# Gap 1 Closing Note — source_documents write path
**Date:** 2026-05-19  
**Status:** CLOSED — schema, write path, read API, and agent tool all landed

---

## Investigation findings

### Pipeline architecture

| Layer | File | Role |
|---|---|---|
| Upload trigger | `auto-extract-on-upload.ts` | Marks `deal_files.extraction_status='running'`, calls `processDocument()` |
| Pipeline | `extraction-pipeline.ts:processDocument()` | Classifies → parses → calls `routeExtractionResult()` |
| Data router | `data-router.ts:routeExtractionResult()` | Routes extracted data into `deal_monthly_actuals`, `deal_data` JSONB, etc. |

### Existing document tables (confirmed row counts)

| Table | Rows | Purpose |
|---|---|---|
| `deal_files` | (main upload table) | Per-file upload tracking with `extraction_status`, `extraction_result` |
| `deal_document_files` | 6 | Older per-deal document pipeline (used by `processDealDocuments`) |
| `deal_documents` | 1 | Manual/UI uploaded document records |
| `capsule_documents` | 0 | Capsule-linked documents (not used by extraction pipeline) |
| `unified_documents` | 0 | Cross-deal unified document store |

### Gap confirmed

`routeExtractionResult()` already writes extracted VALUES into `deal_data` JSONB using keys like `extraction_t12`, `extraction_rent_roll`, `extraction_om`, `broker_claims`, etc. But it never wrote a **catalogue entry** recording "I extracted from file X". Zero deals had `deal_data.source_documents` populated.

### Storage decision

**JSONB on `deals.deal_data`** — key: `source_documents` (array). Chosen over a separate table because:
- Fully consistent with the existing extraction write pattern (`deal_data = COALESCE(deal_data,'{}') || $2::jsonb`)
- No migration required (JSONB extension, backward compat = empty array)
- Queryable by the agent tool and REST endpoint in a single SELECT
- Per-document granularity (per-page/per-span is v1.1 if needed)

---

## Changes applied

### 1. Write path — `data-router.ts`

Added `writeSourceDocument()` function (lines 322–364) and a call to it just before the `return` at line 307, inside a try/catch marked best-effort (failure appends to alerts, never breaks extraction).

**Upsert semantics:** strips any prior entry with the same `file_id` before appending, so re-extraction of the same file replaces rather than duplicates.

**SQL pattern:**
```sql
UPDATE deals
   SET deal_data = jsonb_set(
         COALESCE(deal_data, '{}'),
         '{source_documents}',
         (
           SELECT COALESCE(
             jsonb_agg(elem) FILTER (
               WHERE ($2::text IS NULL)
                  OR (elem->>'file_id' IS DISTINCT FROM $2::text)
             ),
             '[]'::jsonb
           )
           FROM jsonb_array_elements(
             COALESCE(deal_data->'source_documents', '[]'::jsonb)
           ) AS elem
         ) || jsonb_build_array($3::jsonb)
       ),
       updated_at = NOW()
 WHERE id = $1
```

**Record shape per extraction:**
```json
{
  "file_id":         "uuid or null",
  "filename":        "464_Bishop_T12_2025.xlsx",
  "document_type":   "T12",
  "mime_type":       "application/vnd.openxmlformats-...",
  "file_size_bytes": 54321,
  "extracted_at":    "2026-05-19T04:15:43.157Z",
  "key_fields":      ["gpr", "noi", "vacancy_loss", "opex", "monthly_actuals_12mo"],
  "rows_inserted":   12,
  "source_ref":      "464_Bishop_T12_2025.xlsx"
}
```

**`key_fields` per document type:**

| Type | Key fields |
|---|---|
| T12 | gpr, noi, vacancy_loss, opex, monthly_actuals_12mo |
| RENT_ROLL | unit_mix, in_place_rents, occupancy, other_income_monthly |
| OM | asking_price, units, year_built, noi, broker_proforma |
| TAX_BILL | assessed_value, annual_tax, tax_year |
| AGED_RECEIVABLES | total_outstanding, bucket_30d, bucket_60d, bucket_90d_plus |
| BOX_SCORE | occupancy_pct, move_ins, move_outs, renewals |
| CONCESSION_BURNOFF | concession_months, effective_rent, burnoff_schedule |
| T30_LTO | lease_transactions_30d, traffic_count, conversion_rate |
| OTHER_INCOME | other_income_sources, total_other_income_monthly |

### 2. REST endpoint — `source-documents.routes.ts`

**File:** `backend/src/api/rest/source-documents.routes.ts`  
**Mounted:** `app.use('/api/v1/deals', requireAuth, sourceDocumentsRoutes)` in `index.replit.ts`  
**Route:** `GET /api/v1/deals/:dealId/source-documents`

Response shape:
```json
{
  "deal_id": "uuid",
  "source_documents": [...],
  "count": 1
}
```

Enrichment: joins with `deal_files` (by `file_id`) to add `live_extraction_status` and `category`.  
Backward compat: deals with no `source_documents` return `{ count: 0, source_documents: [] }`.

### 3. Agent tool — `fetch_source_documents`

**File:** `backend/src/agents/tools/fetch_source_documents.ts`  
**Registered:** `cashflow.config.ts` (after `fetchCycleIntelligenceTool`)  
**System prompt:** Added to Step 1 tools list (line 98) and Phase 3 step 17 with explicit gating instructions

Tool output includes `has_t12`, `has_rent_roll`, `has_om`, `has_tax_bill` boolean flags so the agent can gate source citations without parsing the array.

---

## Verification

### Write path SQL

Tested directly against production deal `1daab29b-e586-41bc-9338-eba72f202abd`:
```
source_documents written: [{ file_id: null, filename: "test_T12_2025.xlsx",
  document_type: "T12", key_fields: ["gpr","noi","vacancy_loss","opex","monthly_actuals_12mo"],
  rows_inserted: 12, extracted_at: "2026-05-19T04:15:43.157Z", ... }]
```

### Upsert deduplication

Two writes with `file_id='dedup-test-sentinel'`:
- Entry count: **1** (not 2) ✓
- `rows_inserted` = **14** (second write wins) ✓
- Total `source_documents` count: **2** (original null-file_id entry + sentinel) ✓

Test data cleaned up — all deals restored to `source_documents=[]`.

### REST endpoint

`GET /api/v1/deals/:dealId/source-documents` → 401 when unauthenticated ✓ (requireAuth working)

### TypeScript

```
$ npx tsc --noEmit --skipLibCheck 2>&1 | grep "fetch_source_documents\|source-documents"
(no output — zero errors in new files)
```

Pre-existing error count unchanged at **122**.

### Backend startup

All 5 agents seeded cleanly including CashFlow Agent v8.0. No import errors or startup failures from new files.

---

## Follow-up items

1. **UI evidence drawer:** 12 typed fields have no UI binding for source references (per substrate inventory). The REST endpoint is live; the evidence drawer needs a fetch to `/source-documents` and a rendered list of source pills. Separate task.

2. **CIE arbitrage findings write path:** `cie_findings` is a separate substrate gap (different from `source_documents`). The evidence drawer uses `source_documents` for document provenance; `cie_findings` is for cross-document value collisions detected by the correlation engine. Blocked on CIE arbitrage design.

3. **Per-page / per-span granularity (v1.1):** Current granularity is per-document. If Deal Journey evidence citations need page numbers (e.g. "T12 page 3, row 7"), the `key_fields` array can be extended to `key_fields_with_location: [{field, page, row}]` without a migration (JSONB extension).

4. **Backfill for existing deals:** 5 production deals have no `source_documents` because their files were extracted before this write path existed. A one-time backfill can read `deal_files WHERE extraction_status='done'` and reconstruct minimal records from `extraction_result`. Low priority — the write path is now live for all new extractions.

5. **`document_types_present` in agent gate:** The agent system prompt step 17 instructs the agent to use `has_*` flags. If a new document type is added (e.g. COSTAR), the agent tool will surface it via `document_types_present` array but won't have a dedicated flag. A follow-up can add flags as types are onboarded.
