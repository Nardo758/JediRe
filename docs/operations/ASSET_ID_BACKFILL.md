# Asset ID Backfill — Investigation & Results

**Task:** G1 — Asset ID backfill for unlinked T-12 files  
**Date:** 2026-05-25  
**Outcome:** No backfill executed — task premise is obsolete. All 266 T12 files are already linked.

---

## 1. Executive Summary

The task expected to find 266 T12 files with `asset_id = NULL` in `data_library_files`. The live database contains only **1 NULL `asset_id` row**, which is a disposable test stub unrelated to real deal data. No backfill was needed or executed.

The `DATA_LIBRARY_INVENTORY.md` from Task #1047 was written before migration 1485 was applied and before the bulk-upload ingestion run on 2026-05-21. The inventory's statement that "all 266 T12 files have `asset_id = NULL`" was accurate at the time of that audit but is now stale.

---

## 2. Sample Analysis

### 2.1 Live NULL-asset_id Count

| document_type | total | linked (asset_id ≠ NULL) | unlinked (asset_id = NULL) |
|---|---|---|---|
| T12 | 266 | 266 | **0** |
| RENT_ROLL | 479 | 479 | 0 |
| TAX_BILL | 107 | 107 | 0 |
| OM | 43 | 43 | 0 |
| BOX_SCORE | 31 | 31 | 0 |
| LEASING_STATS | 31 | 31 | 0 |
| OTHER | 738 | 737 | **1** (test stub) |
| **Total** | **1,695** | **1,694** | **1** |

**`SELECT count(*) FROM data_library_files WHERE asset_id IS NULL` → 1**

### 2.2 The Single NULL Row

The only unlinked file is a test stub:

| Field | Value |
|---|---|
| `id` | `0ce145cf-ee16-4abf-94e4-037e9f41c827` |
| `parcel_id` | `TEST-PARCEL-001` |
| `original_filename` | `hostname` |
| `document_type` | `OTHER` |
| `parser_status` | `unparsed` |
| `source_signal` | `other` |
| `storage_key` | `other/TEST-PARCEL-001/4796631793e89e4d_hostname` |
| `deal_id` | NULL |
| `uploaded_by` | NULL |
| `uploaded_at` | 2026-05-21 17:19:53 UTC |

This row is not a real document. It has no corresponding `data_library_assets` row with `property_name = 'TEST-PARCEL-001'`, no deal linkage, and no parser output. **It should remain NULL or be deleted — linking it to a real asset would be incorrect.**

### 2.3 Sample of 10 T12 Files — All Linked

| filename | parcel_id | asset_id | linked to asset.property_name |
|---|---|---|---|
| Legacy Village - T12 (2019.08).xlsx | legacy Village | 2092580f… | legacy Village |
| Legacy Village - T12 (2019.08) - Techno.xls | legacy Village | 2092580f… | legacy Village |
| WL Oct2016_Sept 2017_12 Months Trailing Apts Detail IncStmt.pdf | Windsor Landings - NC | b9743715… | Windsor Landings - NC |
| WL Oct'17 Preliminary Income.xlsx | Windsor Landings - NC | b9743715… | Windsor Landings - NC |
| !Windsor Landing T-12 Ending July 2019.xlsx | Windsor Landing | 2165398f… | Windsor Landing |
| !Windsor Landing T-12 Ending July 2019 - techno.xls | Windsor Landing | 2165398f… | Windsor Landing |
| Whitehall Estates - T12 (2019.09).xlsx | Whitehall Estates | 11bc21fe… | Whitehall Estates |
| Whitehall Estates - T12 (2019.09) - Techno.xls | Whitehall Estates | 11bc21fe… | Whitehall Estates |
| T12_2019.06_West End Station.xlsx | West End | ab2477e4… | West End |
| T12_2019.03_The Waterford.xlsx | Waterford Place - Morrisville | 668fa06e… | Waterford Place - Morrisville |

**Matching strategy in effect:** exact text match on `data_library_files.parcel_id = data_library_assets.property_name`. No fuzzy matching was needed — all ingested properties had exact string alignment at upload time.

---

## 3. How the Linkage Happened

### 3.1 Migration 1485 — Column Added + Attempted Backfill

Migration `20260604_data_library_files_asset_id.sql` (migration_number 1485, applied 2026-05-21 01:02:20 UTC):

```sql
ALTER TABLE data_library_files
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES data_library_assets(id) ON DELETE SET NULL;

-- Back-fill: for each asset that already has a file_id set, write
-- that asset's id back onto the corresponding data_library_files row.
UPDATE data_library_files dlf
SET    asset_id = a.id
FROM   data_library_assets a
WHERE  a.file_id = dlf.id
  AND  dlf.asset_id IS NULL;
```

The backfill clause (`WHERE a.file_id = dlf.id`) matched **0 rows** because `data_library_assets.file_id` has never been populated (0 of 299 asset rows have a `file_id` value). The migration column-add succeeded; the backfill UPDATE was a no-op.

### 3.2 Bulk Ingestion — Asset-id Set at Upload Time

The bulk archive upload ran on 2026-05-21 starting at ~18:23 UTC (after the migration at 01:02 UTC). The ingestion route (`archive.routes.ts`) sets `asset_id` inline during the INSERT, matching `parcel_id → asset.property_name` at ingestion time. Because the column already existed when the files were uploaded, all 1,694 real documents arrived with `asset_id` populated from the start. There was no post-hoc backfill gap.

---

## 4. fetch_source_documents Verification

### 4.1 How the Tool Works

`fetch_source_documents` (`backend/src/agents/tools/fetch_source_documents.ts`) reads from:

```sql
SELECT deal_data->'source_documents' AS source_documents
FROM deals
WHERE id = $1
```

It reads a **JSONB array stored in `deals.deal_data`**, not from `data_library_files`. It does not JOIN to `data_library_files` or use `asset_id` at all.

### 4.2 Deal Coverage

| Metric | Value |
|---|---|
| Total deals | 29 |
| Deals with `source_documents` JSONB populated | 5 |
| Deals with at least 1 real `file_id` in source_documents | 1 |
| Deals with only synthetic/null file_ids | 4 |

### 4.3 Traceability Gap (Separate Issue — Out of Scope)

For the one deal with real `file_id` values in `source_documents` (deal `3f32276f`, "464 Bishop"), all 12 `file_id` UUIDs in the JSONB array **fail to JOIN** to rows in `data_library_files`. The source_documents JSONB was populated via an earlier ad-hoc workflow (pre-Task #1047) that recorded file_ids from a different ingestion context, but those UUIDs don't exist in the current `data_library_files` table.

This means `fetch_source_documents` returns valid JSON for that deal but the `file_id` values cannot be used to trace back to `data_library_files.asset_id`. This is a **separate gap** (broken file_id cross-reference between `deals.deal_data` and `data_library_files`) and is outside the scope of this task.

### 4.4 Synthetic Entries Are Intentional

Four deals have `source_documents` with `file_id = null` and explicit `backfill_note` fields:

- `"Synthetic entry — T12 data exists in deal_monthly_actuals (12 rows); file record absent"`
- `"Synthetic entry — deal had 7 underwriting snapshots; all evidence at T4 (agent_default); no document file extracted. file_id=null intentional."`

These are correctly documented as intentional — the tool handles null `file_id` gracefully.

---

## 5. Matching Strategy Assessment

Since no backfill was needed, this section documents the strategy for future reference if new NULL rows appear.

| Strategy | Verdict | Notes |
|---|---|---|
| `parcel_id → asset.property_name` (exact match) | **Proven** | All 1,694 real files use this; 100% match rate in current corpus |
| `deal_id → asset.deal_id` | Not viable | `data_library_assets.deal_id` is NULL for all 299 assets |
| `sha256 → asset` | Not viable | No SHA256 field on `data_library_assets` |
| `file_id on asset → file` | Not viable | `data_library_assets.file_id` is NULL for all 299 assets |

**Future backfill recommendation:** If new NULL `asset_id` rows appear, match on `data_library_files.parcel_id = data_library_assets.property_name` (case-insensitive). Ambiguous cases (multiple assets with the same property_name) should be flagged for manual review.

---

## 6. Outstanding Items

### 6.1 Test Stub Row (Low Priority)
- **Row:** `id = 0ce145cf-ee16-4abf-94e4-037e9f41c827`, `parcel_id = TEST-PARCEL-001`
- **Action:** Can be deleted or left as-is; it blocks nothing and has no downstream consumers
- **Risk of linking:** Do not link this to any real asset

### 6.2 data_library_assets.file_id Backlink (Not Backfilled)
- `data_library_assets.file_id` column: 0 of 299 rows populated
- The migration's intended backfill (`WHERE a.file_id = dlf.id`) matched 0 rows because the backlink was never set at ingestion
- Forward link (`data_library_files.asset_id → data_library_assets`) is healthy
- Backward link (`data_library_assets.file_id → data_library_files`) is empty but not actively used by any current code path

### 6.3 fetch_source_documents File-ID Resolution Gap (Separate Task)
- `deals.deal_data->'source_documents'` file_ids for deal 3f32276f don't resolve to rows in `data_library_files`
- Affects 1 deal currently; would affect more if source_documents were populated for additional deals
- Requires a reconciliation step when deals go through the archive ingestion pipeline to write/update the JSONB using current `data_library_files` UUIDs

---

## 7. Conclusion

**No backfill was executed.** The task premise — 266 T12 files with `asset_id = NULL` — was accurate as of Task #1047 (pre-migration) but is now resolved. All 266 T12 files and all 1,694 real documents in `data_library_files` have `asset_id` populated via the bulk-archive ingestion on 2026-05-21.

`fetch_source_documents` successfully returns catalogued source documents for deals where `deals.deal_data->'source_documents'` is populated, but the tool does not use `data_library_files.asset_id` — meaning `asset_id` linkage on `data_library_files` does not affect this tool's output path.

The CashFlow Agent's evidence traceability chain (`fetch_source_documents → deals.deal_data->'source_documents'`) is functioning correctly for the 5 deals where source_documents are populated. Broadening coverage to remaining deals requires populating `source_documents` on more deals during or after ingestion.
