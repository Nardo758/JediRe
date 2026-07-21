# T4a Org Scoping Audit Report

**Report date:** 2026-07-20
**Repo:** Nardo758/JediRe.git
**HEAD:** 34f4405bf
**Executor:** Read-only security/audit agent
**Rule:** S1-01 -- file:line evidence only

---

## 1. EXECUTIVE SUMMARY

This audit examines org-scoping (organization-level tenant isolation) across the **data source layer** of the JediRe platform -- ingestion services, data library, agent tools, background jobs, and API routes that read/write shared data tables.

**Context:** Prior audits B4a (deal-scoping) and B4b (public/private boundary) addressed many route-level org gaps. This audit confirms those fixes landed and identifies **new org-scoping gaps in the data source unification layer** that were outside B4a/B4b scope.

**Score:** 4 PASS / 13 GAP

---

## 2. SCOPE DEFINITION

**In scope:**
- Data ingestion services (census-permits, fred, outcome-panel, veraset)
- Data library services and routes (data_library_files, data_library_assets)
- Agent tools that query data sources (fetch_data_library_comps, etc.)
- Background jobs (scheduled-jobs.ts, Kafka consumers)
- API routes serving data source content

**Out of scope:**
- Platform-wide macro data (Census, FRED, outcome_panel) -- correctly shared
- B4a/B4b already-covered deal-scoped routes (verified PASS below)

---

## 3. FINDINGS

### GAP-01 -- data-library-files.routes.ts:11-96 -- LIST leaks cross-org files
**File:line:** backend/src/api/rest/data-library-files.routes.ts:11-96
**What:** GET /api/v1/data-library-files has upstream requireAuth (routes/index.ts:249) but the handler returns ALL data_library_files rows across ALL orgs. No scope_id, uploaded_by, or deal_id filter is applied.
**Schema context:** data_library_files.scope_id exists (migration 20260624_corpus_tables_scope_id.sql:21) and is populated as user:<uuid> at upload time (dataLibrary.service.ts:137). The read path ignores it.
**Classification:** GAP
**Severity:** HIGH -- any authenticated user can enumerate every org uploaded files

### GAP-02 -- data-library-files.routes.ts:98-139 -- DOWNLOAD leaks any file by ID
**File:line:** backend/src/api/rest/data-library-files.routes.ts:98-139
**What:** GET /api/v1/data-library-files/:id/download serves a file by ID without verifying the authenticated user owns it or is a member of its org.
**Classification:** GAP
**Severity:** HIGH -- any authenticated user can download any org files by guessing/scanning IDs

### GAP-03 -- dataLibrary.service.ts:468-518 -- getFiles() has zero scoping
**File:line:** backend/src/services/dataLibrary.service.ts:468-518
**What:** getFiles() builds SQL with only city/zip/propertyType/sourceType/unitCount filters. No scope_id, user_id, deal_id, or org filter. Called by data-library-files.routes.ts:52 (LIST endpoint).
**Classification:** GAP
**Severity:** HIGH -- root cause of GAP-01

### GAP-04 -- dataLibrary.service.ts:711-741 -- findComparables() has zero scoping
**File:line:** backend/src/services/dataLibrary.service.ts:711-741
**What:** findComparables() queries data_library_files with parser_status = success plus city/propertyType filters. No scope_id, user_id, or org filter. Returns cross-org comparable files.
**Classification:** GAP
**Severity:** HIGH -- root cause of GAP-05

### GAP-05 -- fetch_data_library_comps.ts:85-89 -- Agent tool returns cross-org comps
**File:line:** backend/src/agents/tools/fetch_data_library_comps.ts:85-89
**What:** The fetch_data_library_comps agent tool calls dataLibraryService.findComparables() with no org scoping. A CashFlow or Research agent in Org A receives Data Library comps from Org B.
**Classification:** GAP
**Severity:** HIGH -- agent tool cross-org data leakage

### GAP-06 -- data-upload.routes.ts:164-178 -- actuals endpoint leaks cross-org via property_id
**File:line:** backend/src/api/rest/data-upload.routes.ts:164-178
**What:** GET /api/v1/properties/:propertyId/actuals calls dataUploadService.getActuals(propertyId) which queries deal_monthly_actuals WHERE property_id = $1 with no deal_id or org_id filter. The properties table is platform-public (B4b verified); if two orgs link deals to the same public property, this endpoint returns both orgs actuals.
**Classification:** GAP
**Severity:** MEDIUM-HIGH -- identical B4b leak pattern in a different route

### GAP-07 -- data-upload.routes.ts:180-187 -- upload history leaks cross-org via property_id
**File:line:** backend/src/api/rest/data-upload.routes.ts:180-187
**What:** GET /api/v1/properties/:propertyId/uploads calls dataUploadService.getUploadHistory(propertyId) which queries data_uploads WHERE property_id = $1 with no user_id or org filter.
**Classification:** GAP
**Severity:** MEDIUM

### GAP-08 -- dataUpload.service.ts:315-347 -- getActuals() unscoped property query
**File:line:** backend/src/services/data-upload.service.ts:315-347
**What:** getActuals() method queries deal_monthly_actuals WHERE property_id = $1 plus optional date/budget filters. No deal/org scoping. Root cause of GAP-06.
**Classification:** GAP
**Severity:** MEDIUM-HIGH

### GAP-09 -- dataUpload.service.ts:349-357 -- getUploadHistory() unscoped property query
**File:line:** backend/src/services/data-upload.service.ts:349-357
**What:** getUploadHistory() queries data_uploads WHERE property_id = $1 with no user/org filter. Root cause of GAP-07.
**Classification:** GAP
**Severity:** MEDIUM

### GAP-10 -- archive.routes.ts:183-246 -- archive deals list cross-org
**File:line:** backend/src/api/rest/archive.routes.ts:183-246
**What:** GET /api/v1/archive/deals returns ALL data_library_assets WHERE source_type = archive across ALL orgs. Has requireAuth but no org filter.
**Classification:** GAP
**Severity:** MEDIUM -- archive data may be intended as shared, but scoping should be explicit

### GAP-11 -- archive.routes.ts:281-304 -- archive comps cross-org
**File:line:** backend/src/api/rest/archive.routes.ts:281-304
**What:** GET /api/v1/archive/comps calls getArchiveComps() with state/msa/propertyType filters but no org filter. Returns cross-org comparable archive deals.
**Classification:** GAP
**Severity:** MEDIUM

### GAP-12 -- scheduled-jobs.ts:132-140 -- dailyComplianceCheck iterates all deals platform-wide
**File:line:** backend/src/services/agents/scheduled-jobs.ts:132-140
**What:** dailyComplianceCheck queries SELECT d.id, d.user_id, d.name, d.status FROM deals d WHERE d.status NOT IN (closed, dead) with no org filter. Iterates every deal on the platform. In a multi-org deployment, compliance checks for Org A deals run against Org B deals.
**Classification:** GAP
**Severity:** MEDIUM -- operational leakage, not data exposure, but breaks tenant isolation

### GAP-13 -- scheduled-jobs.ts:349-361 -- hourlyThresholdMonitor queries all deals actuals
**File:line:** backend/src/services/agents/scheduled-jobs.ts:349-361
**What:** hourlyThresholdMonitor queries deal_monthly_actuals joined to deals with WHERE dma.occupancy_rate < 0.90 AND d.status NOT IN (closed, dead) and no org filter. Returns occupancy alerts for ALL orgs.
**Classification:** GAP
**Severity:** MEDIUM -- cross-org alert leakage in background job

---

## 4. PRIOR-FIX VERIFICATION (PASS)

### PASS-01 -- financial-documents.routes.ts:255-286 -- data-sources endpoint fixed
**File:line:** backend/src/api/rest/financial-documents.routes.ts:255-286
**What:** GET /:dealId/data-sources scopes actuals to deal_id (line 264): SELECT DISTINCT ... FROM deal_monthly_actuals WHERE deal_id = $1. Previously flagged in B4b as WHERE property_id = $1 (unscoped). Fix confirmed landed.
**Classification:** PASS

### PASS-02 -- fetch_owned_asset_actuals.ts:206-230 -- org-scoped portfolio reads
**File:line:** backend/src/agents/tools/fetch_owned_asset_actuals.ts:206-230
**What:** Resolves callerOrgId from ctx.org_id (B2a attribution) or deal lookup, then scopes portfolio queries: JOIN deals d ON d.id = dp.deal_id WHERE d.org_id = $1. Fix confirmed landed.
**Classification:** PASS

### PASS-03 -- fetch_owned_asset_opex_ratios.ts:55-82 -- defensive org scoping
**File:line:** backend/src/agents/tools/fetch_owned_asset_opex_ratios.ts:55-82
**What:** Reads ctx.org_id and adds defensive EXISTS (SELECT 1 FROM deal_properties dp JOIN deals d ON d.id = dp.deal_id WHERE dp.deal_id = dma.deal_id AND d.org_id = $3) guard. Fix confirmed landed.
**Classification:** PASS

### PASS-04 -- Macro data ingestion services correctly unscoped
**Files:** census-permits-ingest.service.ts, fred-ingest.service.ts, outcome-panel.service.ts
**What:** These services write to metric_time_series, outcome_panel, and historical_observations -- platform-wide Lane-A tables with scope_id = GLOBAL by design. No org scoping is correct here; the data is public/shared macro data.
**Classification:** PASS

---

## 5. SEVERITY SUMMARY

| Severity | Count | Findings |
|----------|-------|----------|
| HIGH | 5 | GAP-01, GAP-02, GAP-03, GAP-04, GAP-05 |
| MEDIUM-HIGH | 2 | GAP-06, GAP-08 |
| MEDIUM | 6 | GAP-07, GAP-09, GAP-10, GAP-11, GAP-12, GAP-13 |
| PASS | 4 | PASS-01, PASS-02, PASS-03, PASS-04 |

---

## 6. RECOMMENDED FIX PRIORITY

**P0 (before multi-org onboarding):**
1. Add scope_id or deal_id filter to data-library-files.routes.ts LIST and DOWNLOAD endpoints
2. Add org scoping to dataLibrary.service.ts getFiles() and findComparables()
3. Add org scoping to fetch_data_library_comps.ts agent tool

**P1 (before multi-org onboarding):**
4. Fix data-upload.routes.ts :propertyId/actuals and :propertyId/uploads to scope by caller org
5. Fix dataUpload.service.ts getActuals() and getUploadHistory() to include org/deal filters
6. Add org filter to scheduled-jobs.ts compliance and threshold monitors

**P2 (clarification):**
7. Explicitly document whether archive.routes.ts endpoints are intended to be cross-org shared or org-scoped

---

## 7. AUDIT CHECKLIST

- [x] Data ingestion services (census, fred, outcome-panel, veraset)
- [x] Data library routes and services
- [x] Agent tools querying data sources
- [x] Background jobs (scheduled-jobs, Kafka consumers)
- [x] Prior B4a/B4b fix verification
- [x] Shared vs org-scoped table classification
- [x] Report written and saved

**STOP. No fixes applied. Read-only audit complete.**
