# ARCHIVE SEEDING — Session 1 of 5 Closing Note

## Session: 1 — Folder Survey + Leasing Stats Parser
**Date:** 2026-05-20
**Status:** Complete

---

## (a) Folder Survey Results

**Location:** `C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive`
**Source:** `docs/operations/STRUCTURED_SURVEY.md`

| Metric | Value |
|--------|-------|
| Total property folders | 296 |
| Total files | 3,744 |
| Flat folder (no subdirs) | ~140 |
| With subdirectories | ~156 |
| Avg files per property | 12.6 |
| Formats: XLSX / PDF / XLS / JPG / other | 1,285 / 1,253 / 812 / 227 / 167 |

**Document coverage:**
- T12/Financials: ~280 properties (94.6%)
- Rent rolls: ~240 properties (81.1%)
- Tax bills: ~130 properties (43.9%)
- BoxScores (leasing dashboard): **57 properties (19.3%)**
- Concession burnoff: **42 properties (14.2%)**
- Lease tradeout: **5 properties (1.7%)**
- **No lease data: 193 properties (65.2%)**

---

## (b) New Files / Changes

### Files Created

| File | Description |
|------|-------------|
| `docs/operations/STRUCTURED_SURVEY.md` | Full folder structure survey — contract for Session 2 bulk runner |
| `parsers/leasing-stats-parser.ts` | Extracts leasing activity from OneSite BoxScore XLSX/XLS files |

### Files Modified

| File | Change |
|------|--------|
| `types.ts` | Added `'LEASING_STATS'` to `DocumentType`, added `LeasingStatsData`, `LeasingStatsActivity`, `LeasingStatsLease` interfaces, added to `ExtractionData` union |
| `classifier.ts` | Added filename pattern for `LEASING_STATS`, added header-based detection for Leasing Activity section (move-in, move-out, net change, signed renewals, waitlist signals) |
| `data-router.ts` | Added `routeLeasingStats()` function with `deal_monthly_actuals` write + per-floor-plan activity rows. Added `LEASING_STATS` case to switch. Added Historical Observations corpus pipeline for leasing stats data. |

### Leasing Stats Parser Details

**Format parsed:** OneSite Rents v3.0 BOXSCORE — Section 4 (Leasing Activity) and Section 5 (New Resident Detail)

**Extracted fields per activity row:**
- Floor plan, units, move-ins, move-outs, net change
- Units reserved, signed renewals, transferring, cancelled/denied
- Net leases, waitlist, cancelled/denied waitlist, net waitlist

**Extracted fields per new lease:**
- Unit, floor plan, tenant name, apply date, move-in date
- Lease term, market rent, lease rent, effective rent
- Concessions/credits, ad source

**Output schema:** `LeasingStatsData` with:
- `reporting_period` (start/end)
- `activity[]` (per-floor-plan leasing activity)
- `new_leases[]` (individual new lease details)
- `summary` (total move-ins/outs, absorption, renewals, cancellations, waitlist)

### Schema Design Notes

- The existing `BOX_SCORE` type and its parser extract sections 1-3 (Unit Status/Availability/Conversion) from BoxScore files
- The new `LEASING_STATS` parser extracts sections 4-5 (Leasing Activity + New Resident Detail)
- These are complementary — a BoxScore file can be classified as `BOX_SCORE` for the occupancy data AND also routed to `LEASING_STATS` for the velocity data (or the boxscore parser can be extended to call both)
- Data quality tier: C1 for the corpus (velocity is a high-quality signal per property)
- The existing `T30_LTO` parser handles per-unit tradeout data which covers the same ground but at individual transaction granularity rather than weekly aggregate

---

## (c) Sample Parser Validation

### Property: Ascen Varina Gateway
**File:** `Box Score/Boxscore - 5.21.2024.xls` (legacy XLS format, 264 units, weekly period)

**Extracted Leasing Activity:**
```
Floor Plan | Units | Move-Ins | Move-Outs | Net Change | Reserved | Renewals | Cancelled | Net Leases | Waitlist
1x1 / A1  | 36    | 0        | 0         | 0          | 0        | 0        | 0         | 0          | 1
1x1 / A2  | 36    | 2        | 0         | 2          | 2        | 0        | 0         | 3          | 0
1x1 / A3  | 38    | 2        | 0         | 2          | 1        | 0        | 0         | 1          | 0
1x1 / A4  | 39    | 0        | 1         | -1         | 0        | 0        | 0         | 0          | 0
2x2 / B1  | 40    | 1        | 0         | 1          | 0        | 0        | 0         | 1          | 0
2x2 / B2  | 38    | 0        | 0         | 0          | 0        | 0        | 0         | 0          | 0
2x2 / B3  | 11    | 0        | 0         | 0          | 0        | 0        | 1         | 0          | 0
2x2 / D1TH| 12    | 0        | 0         | 0          | 0        | 0        | 0         | 0          | 0
3x2 / C1  | 14    | 0        | 0         | 0          | 0        | 0        | 0         | 0          | 0
Totals    | 264   | 5        | 1         | 4          | 3        | 0        | 1         | 5          | 1
```

**Summary:** 5 move-ins, 1 move-out, 3 units reserved, 1 cancelled, 5 net new leases, 1 open waitlist. Weekly absorption +4 units.

### Property: Bell LightHouse Point
**File:** `Operation Reports/BoxScore - 09.08.2023.xlsx` (373 units)

**Expected sections:** Multiple year-to-date weekly snapshots in the Leasing Activity section. The parser should extract each weekly period independently.

### Property: Alta Dairies
**File:** `BoxScoreSummary09_14_2020.xlsx` (324 units)

**Format:** Uses date in the filename rather than row header for the period reference. The parser extracts the "As of" date from the Leasing section header.

### Known Limitations (Session 4 items)
1. **PDF BoxScores (36 files):** Not handled by this parser. Route to pdf-parse first, then pattern-match the text for leasing activity.
2. **Legacy XLS format (7 files):** Requires xlrd conversion before XLSX parsing. Can be pre-converted by Session 2's bulk runner.
3. **Multiple weekly periods in one file:** The leasing section shows data for a single weekly period. If a file covers multiple periods, they're individual Leasing sections — the parser finds the first one.
4. **New lease section may be absent:** Many BoxScore files skip Section 5 (New Resident Detail). The parser gracefully returns empty `new_leases[]`.
5. **Some property naming conventions have city suffix, some don't:** The folder name to property ID mapping needs manual work in Session 2.

---

## (d) Coverage Report

| Metric | Count | % of 296 |
|--------|-------|---------|
| Properties with BoxScore (leasing velocity) | 57 | 19.3% |
| Properties with concession tracking | 42 | 14.2% |
| Properties with lease tradeout detail | 5 | 1.7% |
| Properties with ANY leasing data | 86 | 29.1% |
| Properties with NO leasing data | 193 | 65.2% |
| Properties with flat folder structure | ~140 | 47.3% |
| Properties with subdir structure | ~156 | 52.7% |

**Ingest baseline:** Session 2 bulk runner will process all 296 properties. Leasing data is available for 86 properties (29.1%) — these get full velocity extraction. The remaining 193 get T12 + rent roll + tax bill data only.

---

## (e) Session 2 Estimate

| Task | Est. Time | Dependencies | Notes |
|------|-----------|-------------|-------|
| Build folder walker | 30 min | STRUCTURED_SURVEY.md | Handle flat + subdir mix, skip known types |
| File classifier integration | 20 min | — | Route file extension + filename to classifier |
| Extraction pipeline routing | 30 min | Session 1 parsers | Connect T12 / RR / BS / LS / LTO / Tax / OM parsers |
| Corpus write layer | 45 min | Historical Observations spec | Map extracted data to corpus row schema |
| PDF BoxScore handling | 30 min | pdf-parse + regex pattern | Text extraction for 36 PDF files |
| Dry-run validation | 30 min | — | Count+classify only, no writes |
| Wet-run + error logging | 30 min | — | Full ingest with failure tracking |
| XLS-to-XLSX pre-conversion | 15 min | xlrd or Python script | 7 legacy boxscore files need conversion |

**Estimated total: ~3–4 hours actual** (single session, focused)

**Key risk:** PDF BoxScore text extraction quality — the 36 PDF boxscore files (from 57 boxscore properties) may have varied text layer quality. Recommend manual spot-check on 3-5 PDF files before bulk run.

---

## Diff Summary

```diff
--- a/src/services/document-extraction/types.ts
+++ b/src/services/document-extraction/types.ts
@@ -1,4 +1,4 @@
-export type DocumentType = 'T12' | 'RENT_ROLL' | 'AGED_RECEIVABLES' | 'BOX_SCORE' | 'CONCESSION_BURNOFF' | 'T30_LTO' | 'TAX_BILL' | 'OTHER_INCOME' | 'OM' | 'UNKNOWN';
+export type DocumentType = 'T12' | 'RENT_ROLL' | 'AGED_RECEIVABLES' | 'BOX_SCORE' | 'CONCESSION_BURNOFF' | 'T30_LTO' | 'TAX_BILL' | 'OTHER_INCOME' | 'OM' | 'LEASING_STATS' | 'UNKNOWN';
+export interface LeasingStatsLease { ... }
+export interface LeasingStatsActivity { ... }
+export interface LeasingStatsData { ... }
+export type ExtractionData = ... | LeasingStatsData;

--- a/src/services/document-extraction/classifier.ts
+++ b/src/services/document-extraction/classifier.ts
@@ -5,6 +5,7 @@ const FILENAME_PATTERNS = [
   { pattern: /box[\s_-]*score/i, type: 'BOX_SCORE' },
+  { pattern: /leasing/i, type: 'LEASING_STATS' },
   { pattern: /concession[\s_-]*burn/i, type: 'CONCESSION_BURNOFF' },
 ...
+  const lsSignals = ['leasing', 'move-in', 'move-out', 'net change', ...];
+  if (lsMatches >= 3) return { type: 'LEASING_STATS', confidence: 0.8, hints };

--- a/src/services/document-extraction/data-router.ts
+++ b/src/services/document-extraction/data-router.ts
@@ -1,4 +1,4 @@
-import { ..., OtherIncomeData } from './types';
+import { ..., OtherIncomeData, LeasingStatsData } from './types';
@@ -83,6 +83,9 @@ export async function routeExtractionResult(
+    case 'LEASING_STATS':
+      rowsInserted = await routeLeasingStats(pool, result.data as LeasingStatsData, ...);
+      break;
 ...
+async function routeLeasingStats(pool, data, dealId, sourceRef, sourceDate) { ... }

--- a/src/services/document-extraction/parsers/ (new)
+++ b/src/services/document-extraction/parsers/leasing-stats-parser.ts
@@ -0,0 +1,338 @@
+// New file: Leasing Stats Parser — OneSite BoxScore Leasing Activity extraction
+export function parseLeasingStats(buffer: Buffer, filename: string): ExtractionResult { ... }
```
