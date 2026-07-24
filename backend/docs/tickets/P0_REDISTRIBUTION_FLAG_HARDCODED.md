# P0 TICKET — CONFIRMED LIVE LEAK: CoStar Files Entered Global Pool Unflagged

**Severity:** P0 — live data leak, scoping-and-purge required
**Discovered:** 2026-07-20, T4bc agent audit + live impact query
**Files:** `backend/src/services/intake-sources/data-library-upload/index.ts:73` (root cause), `data_library_files` table (live evidence)

---

## IMPACT ASSESSMENT — CONFIRMED

**Live query result (2026-07-20, Replit production DB):**

| Metric | Value |
|--------|-------|
| CoStar-lineage files in data library | **18** |
| All with `license_restricted = false` | **18/18 (100%)** |
| All with `scope_id = 'GLOBAL'` | **18/18 (100%)** |
| `license_source` populated | **0/18 (0%)** |
| Upload date | **2026-05-21** (~2 months ago) |
| Upload method | Browser upload (user-uploaded, not system) |

**The files:**

| id | original_filename | license_restricted | scope_id |
|---|---|---|---|
| e4f3f5ea… | The vinyard - Costar.pdf 2.pdf | false | GLOBAL |
| 7968ae54… | The vinyard - Costar.pdf | false | GLOBAL |
| 4dfbeeae… | 20 Pine Hall Dr - The Reserve at Glen Laurel _ CoStar.pdf | false | GLOBAL |
| 24897284… | 20 Pine Hall Dr - The Pines at Glen Laurel _ CoStar.pdf | false | GLOBAL |
| 7b8c2a61… | Costar Report 3.pdf | false | GLOBAL |
| cd614d87… | Costar Report 2.pdf | false | GLOBAL |
| 15392260… | Costar Report 1.pdf | false | GLOBAL |
| 8079e646… | Costar comps.pdf | false | GLOBAL |
| 7c76d5fd… | Submarket Intel .pdf | false | GLOBAL |
| 4f006a12… | Costar Richmond - VA-MultiFamily-Market-2021-05-18.pdf | false | GLOBAL |
| 23dad68c… | Kia Ora Costar.pdf | false | GLOBAL |
| ef6a35b2… | Axio Submarket Boundaries - Raleigh.pdf | false | GLOBAL |
| c3a12943… | Sumner County-Multi-Family…Submarket…2022-01-27.pdf | false | GLOBAL |
| 5d6e1427… | Creekside Ranch Costar.pdf | false | GLOBAL |
| dc4ca8b4… | Cottages at Emerald Creek Costar Overview.pdf | false | GLOBAL |
| 96205fdf… | Sterling Nashville West- Costar summary.pdf | false | GLOBAL |
| 20144fb3… | Bainbridge Aviation Crossing Costar Rent Comps 3.26.21.pdf | false | GLOBAL |
| a18c5d4a… | Axio Submarket Boundaries - Charlotte.pdf | false | GLOBAL |

**This is the same episode-shape as the metric-rows leak** — restricted-vendor data entered the platform through an ingestion path that failed to flag it, then sat in global-scoped storage for months.

---

## ROOT CAUSE

`registerUploadedFile()` at `data-library-upload/index.ts:73` hardcodes `license_restricted = FALSE`:

```typescript
VALUES ($1, $2, $3, $4, 'r2', $5, $6, $7, 'unparsed', $8, $9, $10, FALSE)
//                                                            ^^^^
//                                                            hardcoded FALSE
```

The `costar.vendor.ts` parser declares `licensePosture: 'restricted'`, but that signal never reaches the registration step. Files uploaded before parsing are stored as unrestricted, globally visible, and untagged by vendor.

---

## DAMAGE ASSESSMENT

**What leaked:** 18 CoStar-branded PDFs containing submarket reports, rent comps, market data, and property summaries. CoStar's license terms restrict redistribution; these files entered the platform's global data pool without restriction flags.

**Where they are reachable from:**
- `data_library_files` with `scope_id = 'GLOBAL'` — any query without a deal filter returns them
- Archive download/list endpoints (`archive.routes.ts`) — unscoped reads
- Data library LIST (`data-library-files.routes.ts`) — confirmed cross-org leak in T4a
- Any intake job or pipeline that scans `data_library_files` by `scope_id = 'GLOBAL'`
- Comp analysis, supply signals, market research — if they query the library without restriction filters

**What has NOT leaked (verified):**
- No live CoStar API calls exist (T4bc confirmed — firewall at API level holds)
- No CoStar data in chat replay (I2 firewall is structurally sound)
- No CoStar data in LLM training corpus (I2 gates replay)

**The breach is at the storage/retrieval layer, not the API/training layer.**

---

## PURGE PLAN

### Step 1: Immediate containment (now)

```sql
-- Flag the 18 known CoStar files as restricted and scoped
UPDATE data_library_files
SET license_restricted = TRUE,
    license_source = 'costar',
    scope_id = 'DEAL_SCOPED'  -- or the actual deal_id if known
WHERE id IN (
  'e4f3f5ea-cdbf-48b4-a977-9f10ba66742a',
  '7968ae54-dc1c-40ce-a7e2-b36004acafff',
  '4dfbeeae-543c-414d-ae26-e98849759664',
  '24897284-6e9c-4a60-9be5-70dcfb0dbac5',
  '7b8c2a61-3e26-4dbc-811d-771dd960df1a',
  'cd614d87-9d99-48f2-9dc8-64021a676a52',
  '15392260-a3cb-4ccb-9a39-e4661ee21b28',
  '8079e646-5b6d-4152-a929-bcf2845feb6b',
  '7c76d5fd-d763-4292-8a5f-505a98e86319',
  '4f006a12-2716-463d-861e-ef47f5e25074',
  '23dad68c-4d5e-4e32-baf3-afd223cf4639',
  'ef6a35b2-59ad-4d00-9fb4-d4e7b38be82f',
  'c3a12943-8210-4b5d-8597-2a63de6899ed',
  '5d6e1427-0361-4814-b953-2de9eba7d96f',
  'dc4ca8b4-b340-4dc6-874d-fdddf23f00ac',
  '96205fdf-c297-4044-b388-99e17e14d578',
  '20144fb3-718b-46f0-9677-b67893dfda1a',
  'a18c5d4a-9056-4d50-9d48-0d8840da5efb'
);
```

### Step 2: Hunt for more (same query, broader)

```sql
-- Any file with CoStar-like filename but missed by the first query
SELECT id, original_filename, license_restricted, scope_id, uploaded_at
FROM data_library_files
WHERE (
  original_filename ILIKE '%costar%'
  OR original_filename ILIKE '%submarket%'
  OR original_filename ILIKE '%co-star%'
  OR original_filename ILIKE '%axio%'
)
AND (license_restricted = FALSE OR license_restricted IS NULL);
```

### Step 3: Verify no downstream consumption

```sql
-- Check if any of these files were ingested into other tables
SELECT file_id, COUNT(*) as job_count
FROM intake_jobs
WHERE file_id IN ( <the 18 UUIDs> )
GROUP BY file_id;

-- Check if any parsed data from these files reached analysis surfaces
SELECT * FROM costar_parsed_exports WHERE source_file_id IN ( <the 18 UUIDs> );
```

### Step 4: Fix the ingestion path (see FIX section)

### Step 5: Audit log entry

```sql
-- Record the purge action
INSERT INTO audit_log (action, table_name, affected_rows, reason, performed_by, performed_at)
VALUES ('UPDATE', 'data_library_files', 18, 
        'P0 purge: CoStar files incorrectly flagged as unrestricted due to hardcoded license_restricted=FALSE at ingestion. Corrected to restricted + scoped.',
        'system', NOW());
```

---

## FIX

**Two layers: immediate (stop the bleed) + structural (prevent recurrence).**

### Immediate: Stop the bleed

Change the hardcoded FALSE to a parameter:

```typescript
// data-library-upload/index.ts:73 — BEFORE:
VALUES ($1, $2, $3, $4, 'r2', $5, $6, $7, 'unparsed', $8, $9, $10, FALSE)

// AFTER:
VALUES ($1, $2, $3, $4, 'r2', $5, $6, $7, 'unparsed', $8, $9, $10, $11)
//                                                            ^^^^
//                                                            parameter
```

Thread `licenseRestricted: boolean` from the upload route into `registerUploadedFile()`.

### Structural: Derive from vendor

The upload route does not know the vendor at registration time (parsing happens later). The correct architecture:

1. **Registration:** Store file with `license_restricted = NULL` (unknown, not unrestricted)
2. **Post-parse:** Vendor parser (`costar.vendor.ts`) returns `licensePosture`
3. **Update:** Set `license_restricted = true` and `license_source = 'costar'` after parse confirms vendor

This requires:
- Adding a `license_restricted = NULL` state (not just true/false)
- Wiring the vendor parser's output back to the file record
- Running a background job to re-process existing unflagged files

**Shortcut for now:** Accept `license_restricted` as a route parameter (user or frontend indicates vendor at upload), default to `NULL` (not FALSE) when unknown.

---

## VERIFICATION

1. **After fix:** Upload a test file → `license_restricted = NULL` (not FALSE)
2. **After purge:** Re-run the impact query → CoStar files show `license_restricted = TRUE`
3. **After structural fix:** Upload CoStar export → parse completes → `license_restricted = TRUE`, `license_source = 'costar'`
4. **Regression:** Upload non-CoStar file → `license_restricted = FALSE` (or NULL if unknown)

---

## CROSS-REFERENCES

- T4bc report: `backend/docs/audits/T4BC_UNIVERSE_S3_FIREWALL_AUDIT_2026-07-20.md`
- T6 synthesis: `backend/docs/audits/T6_DATA_SOURCE_GAP_SYNTHESIS_2026-07-20.md` (P0 item 4)
- T6 boundary verdicts: `backend/docs/audits/T6_BOUNDARY_VERDICTS_2026-07-20.md` (verdict c)
- CoStar firewall dispatch: `DISPATCH_COSTAR_FIREWALL_ENFORCEMENT`
- I1-EXTENSION metric-rows leak (same episode-shape, prior incident)

---

**Status:** CONFIRMED LIVE LEAK. Purge required before fix ships. Fix prevents recurrence.
