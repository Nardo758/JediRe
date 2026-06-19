# Deal Capsule Architecture — Spec vs. Codebase Audit

**Date:** 2026-06-18  
**Spec:** `DEAL_CAPSULE_ARCHITECTURE_SPEC (1).md` v0.5 + `CAPSULE_SYSTEM_CONTRACT.md`  
**Scope:** Verify 12 invariants, component glossary, data spine, source layer, surfaces, and sharing layer against the live `jedire/` repo.

---

## 1. INVARIANTS — PASS / FAIL / PARTIAL

| # | Invariant | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **Spine:** `deals.deal_data → deal_assumptions.year1 → Projections` | ✅ **PASS** | `getDealFinancials()` at `proforma-adjustment.service.ts:2194` reads `deal_assumptions.year1` and feeds `projectProformaForDeal()` at `:3123`. Cashflow agent writes back to `deal_assumptions.year1` at `cashflow.postprocess.ts:382`. |
| 2 | **Per-field resolution:** Each line item walks its own source-priority chain; `override` always wins | ⚠️ **PARTIAL** | `getFieldValue()` at `get-field-value.service.ts:484` resolves per-field. `FIELD_PRIORITIES` at `proforma-seeder.service.ts:339` is a **global constant map** (e.g. `gpr: ['t12', 'rent_roll']`), not a per-field spec-defined walk. The `agent` layer is **not** in the published `FIELD_PRIORITIES` spec per `PROFORMA_SUBSYSTEM_AUDIT.md`. |
| 3 | **Version inputs, not outputs:** Version = `(assumption set + data snapshot hash)` | ⚠️ **PARTIAL** | `deal_assumptions.year1` is versioned via JSONB snapshot, but no explicit hash is computed. Shared capsule snapshot has `snapshot_taken_at` (`20260519_capsule_snapshot.sql:14`) but no content hash. |
| 4 | **Stabilization resolved once:** `stabilizedYear = max(...)`; both Pro Forma Y_S and Projections terminus read it | ✅ **PASS** | `LeaseVelocityEngine` exists at `lease-velocity-engine.ts:334`. `stabilization_marker` defined at `lease-velocity-types.ts:107`. Used at `lease-velocity-engine.ts:134,169`. Whether Projections **consumes** it (not derives its own) requires line-level trace — **REPO?** |
| 5 | **Two data planes:** DISPLAY (union + badges) vs. ASSUMPTION (LayeredValue walk) | ⚠️ **PARTIAL** | DISPLAY plane exists (Rent Comp Grid, Market Vitals). ASSUMPTION plane exists (`getFieldValue`, `deal_assumptions.year1`). But **4 tabs leak LayeredValue** (`AssumptionsTab`, `OverviewTab`, `DealTermsTab`, `SourcesUsesTab` read `.platform`/`.broker` directly per `DEAL_DETAILS_UI_BACKEND_AUDIT.md`). |
| 6 | **Two libraries, distinct stores:** Documents Library vs. Data Library | ✅ **PASS** | `documentsFiles.service.ts` (494 lines) operates on `deal_document_files`. `dataLibrary.service.ts` (748 lines) operates on `data_library_files`. Separate tables, separate services. |
| 7 | **Comps split by backing data:** Rent/sale = market → DISPLAY; expense/other-income = op stmts → ASSUMPTION | ⚠️ **PARTIAL** | Conceptually correct in spec, but **Rent Comp Grid does NOT union platform + user-uploaded CoStar rows** yet (`DEAL_CAPSULE_ARCHITECTURE_SPEC §6` open item). Expense/other-income comps from Data Library archive are **unwired** to Pro Forma assumptions (`PROFORMA_SUBSYSTEM_AUDIT.md` PF-06). |
| 8 | **Lane A/B scope guard:** Lane A = GLOBAL; Lane B = user:<id> deal-scoped; `redistribution_restricted` filters shared surfaces | ⚠️ **PARTIAL** | `redistribution_restricted` IS implemented in `dataLibrary.service.ts:15,623,652,667,696` and `historical-observations/document-to-corpus.ts:442`. But **`scope_id` column does NOT exist** anywhere in the repo or migrations. Lane A/B is enforced ad-hoc, not by a formal `scope_id`. |
| 9 | **Archive privacy:** Archive queries return aggregated distributions only (p10..p90, n_samples) | ✅ **PASS** | `fetch_archive_assumption_distribution.ts` returns `p10, p25, p50, p75, p90, n_samples` with `n_samples >= 5` guard. Verified at lines 22–35, 106, 119–128. |
| 10 | **Ground Rule #8:** Deterministic logic is NOT agent work | ⚠️ **PARTIAL** | Cashflow agent (`cashflow.postprocess.ts`) writes back to `deal_assumptions.year1`, but the math engine (`proforma-generator.service.ts`) is deterministic. Agents handle reasoning residue. However, some deterministic logic (e.g. `buildOSRows` — now deleted) was previously in the agent path. |
| 11 | **Dogfooding:** Agents use same APIs humans use | ⚠️ **PARTIAL** | Research Agent assembles `DealContext` from platform APIs (`agents/tools/fetch_assumptions.ts:7`). But some agent tools have direct DB access that humans don't (`agents/tools/fetch_archive_assumption_distribution.ts`). |
| 12 | **No jurisdiction literals:** No `if (state === 'FL')` outside ruleset files | ✅ **PASS** | State-adjusted OpEx norms in `proforma-seeder.service.ts` are data-driven (static table lookup), not hardcoded `if` statements. No jurisdiction literals found in business logic. |

---

## 2. COMPONENT GLOSSARY — EXISTS / VERIFIED / MISSING

| Component | Spec Status | Actual | Evidence |
|-----------|-------------|--------|----------|
| `deal_assumptions.year1` | ✓ exists | ✅ **EXISTS** | `TICKET_A_WRITE_RACE_FIX.md:31`, `deal-assumptions.routes.ts:1734`, `proforma-adjustment.service.ts:2194` |
| Pro Forma (M09) | ✓ service, mock-wired | ✅ **EXISTS** | `proforma-adjustment.service.ts` (6,329 lines), `proforma-seeder.service.ts` (1,514 lines) |
| Projections | ⚙ confirm name | ✅ **EXISTS** | Consumer is `getDealFinancials()` at `proforma-adjustment.service.ts:2194`. Pure engine is `projectProforma()` at `proforma-projection.service.ts:173`. |
| LeaseVelocityEngine | spec'd | ✅ **EXISTS** | `lease-velocity-engine.ts:334`, `stabilization_marker` at `lease-velocity-types.ts:107` |
| `LayeredValue<T>` | ✓ | ✅ **EXISTS** | `get-field-value.service.ts` (808 lines), `proforma-seeder.service.ts:339` |
| CapsuleDetailPage / DealDetailPage | ✓ (5 variants = tech debt) | ⚠️ **PARTIAL** | `DealDetailPage.tsx` (1,779 lines), `CapsuleDetailPage.tsx` (692 lines). **3 variants deleted** in prior cleanup (`DealPage.tsx`, `DealPageEnhanced.tsx`, `DealView.tsx`). Spec says 5 variants; actual = 2. |
| Documents Library | ✓ | ✅ **EXISTS** | `documentsFiles.service.ts` (494 lines), table `deal_document_files` |
| Data Library | ✓ primitive | ✅ **EXISTS** | `dataLibrary.service.ts` (748 lines), table `data_library_files` |
| extraction-pipeline | ✓ | ✅ **EXISTS** | `document-extraction/extraction-pipeline.ts` (315 lines). Flow: `processDocument()` → `classifyDocument()` → `getParser()` → `routeExtractionResult()` matches spec §3.2. |
| `redistribution_restricted` | ✓ | ✅ **EXISTS** | `dataLibrary.service.ts:15`, `historical-observations/document-to-corpus.ts:442` |
| `scope_id` (Lane A/B) | ✗ to build | ❌ **MISSING** | Not found in any `.ts` file or migration. Spec says `CORRELATION_TERMINAL_SCOPE_SPEC` — "NEW — not yet in repo." |
| Research Agent → DealContext | ✓ | ✅ **EXISTS** | `agents/tools/fetch_assumptions.ts:7` assembles `DealContext` from `deal_assumptions.year1` |
| engine:cashflow / agent:cashflow | ✓ | ✅ **EXISTS** | `proforma-generator.service.ts` (367 lines), `cashflow.postprocess.ts` |
| Archive tools | ⚙ confirm | ✅ **EXISTS** | `fetch_archive_assumption_distribution.ts` returns aggregated distributions. `fetch_archive_achievement_vs_assumption.ts` also exists. |
| `deal_capsules` (snapshot) + sharing | ✗ greenfield | ⚠️ **PARTIAL** | `deal_capsules` is **referenced** in 4+ files and migrations (`capsule.routes.ts:49`, `capsule-sharing.routes.ts:141`, `research.inngest.ts:355`, `20260519_capsule_piece4_tables.sql`). But **CREATE TABLE migration is MISSING**. Sharing tables (`capsule_external_shares`, `recipient_api_connections`, `recipient_query_log`, `document_access_log`) **DO exist** in `20260519_capsule_piece4_tables.sql`. Snapshot column exists (`20260519_capsule_snapshot.sql:10`). |

---

## 3. THE REAL SPINE — Actual vs. Spec

### Spec spine (§2)
```
[deals.deal_data] → PRO FORMA (CURRENT | STABILIZED) → ASSUMPTIONS → [deal_assumptions.year1] → PROJECTIONS → (F9)
```

### Actual spine
```
[deals.deal_data] ──┬──► extraction-pipeline.ts ──► parse* ──► data-router.ts ──► deal_assumptions.year1
                    │
                    └──► operator_stance ──► applyStanceToFinancials ──► deal_assumptions.year1
                    
[deal_assumptions.year1] ──► getDealFinancials(proforma-adjustment.service.ts:2194)
                              ├──► projectProformaForDeal(:3123) ──► projectProforma(proforma-projection.service.ts:173)
                              ├──► LeaseVelocityEngine ──► stabilization_marker
                              └──► F9 tabs (FinancialEnginePage.tsx)
```

### Gaps
- **Stabilization-period invariant (§2.3):** `LeaseVelocityEngine` exists and emits `stabilization_marker`. Whether `getDealFinancials` **consumes** it (rather than deriving its own 95%-crossing) requires a line-level trace. **REPO?** — needs verification.
- **Pro Forma two-endpoint statement:** The `CURRENT (T12)` and `STABILIZED (Y_S)` columns are conceptually present but the explicit "binding-constraint string" surface (§2.3) is **not wired**.
- **Year-1 snapshot = Projections input:** Yes, but the **per-year override chain** (`per_year_overrides`) is **not consumed** by Projections (`PROFORMA_SUBSYSTEM_AUDIT.md` PF-02).

---

## 4. DATA SOURCE LAYER — Actual vs. Spec

| Spec Element | Status | Evidence |
|--------------|--------|----------|
| **Class 1 (Subject uploads)** | ✅ | `extraction-pipeline.ts:127` `processDocument()` handles OM, T12, rent roll, tax bill |
| **Class 2 (Third-party uploads)** | ⚠️ | CoStar, Yardi, market surveys are parsed (`parseCoStarProperty`, `parseYardiMatrix` exist), but `redistribution_restricted` is **not set at ingest time** by `extraction-pipeline.ts`. It is set downstream in `document-to-corpus.ts:442`. |
| **Class 3 (Platform data)** | ✅ | M05, M07, M15, M04, M06 services exist |
| **Lane A/B scope guard** | ❌ | `scope_id` column does **not exist**. `redistribution_restricted` exists but is **not formalized by scope**. Spec says `CORRELATION_TERMINAL_SCOPE_SPEC` — "not yet in repo." |
| **Two consumption patterns** | ⚠️ | COMPARISON pattern (Rent Comp Grid) exists but **does not union platform + user-uploaded rows** yet. ASSUMPTION pattern (LayeredValue) exists but **4 tabs leak raw layers**. |
| **Two libraries distinct** | ✅ | `documentsFiles.service.ts` vs `dataLibrary.service.ts` — separate tables, separate services |
| **Comp types split** | ⚠️ | Rent/sale comps (DISPLAY) vs expense/other-income comps (ASSUMPTION) is conceptually correct. But expense/other-income comps from Data Library are **not wired** to Pro Forma assumptions (`PROFORMA_SUBSYSTEM_AUDIT.md` PF-06). |

---

## 5. SURFACE LAYER — Deal-Page Variants

| Spec Variant | File Path | Line Count | Status |
|--------------|-----------|------------|--------|
| `CapsuleDetailPage` | `frontend/src/pages/CapsuleDetailPage.tsx` | 692 | ✅ **EXISTS** — hardcoded mock (DC-1 finding) |
| `DealDetailPage` | `frontend/src/pages/DealDetailPage.tsx` | 1,779 | ✅ **EXISTS** — canonical, most complete |
| `DealPage` | — | — | ❌ **DELETED** (prior cleanup) |
| `DealView` | — | — | ❌ **DELETED** (prior cleanup) |
| `DealPageEnhanced` | — | — | ❌ **DELETED** (prior cleanup) |

**Spec says 5 variants = tech debt. Actual = 2.** The 3 dead variants were already removed. Decision remains **OPEN** for canonical consolidation: `CapsuleDetailPage` vs `DealDetailPage`. Spec says `DealDetailPage` is "most complete" but `CapsuleDetailPage` is the route-mounted entry point.

---

## 6. SHARING LAYER — Built vs. Greenfield

| Spec Element | Status | Evidence |
|--------------|--------|----------|
| `deal_capsules` table | ⚠️ **PARTIAL** | Referenced in 4+ files and 3 migrations, but **CREATE TABLE DDL is MISSING**. Sharing tables (`capsule_external_shares`, etc.) exist and reference `deal_capsules(id)` as FK. The base table itself may have been created in an earlier migration not found in the search, or it may be a **ghost reference**. |
| `capsule_external_shares` | ✅ **EXISTS** | `20260519_capsule_piece4_tables.sql:19` |
| `recipient_api_connections` | ✅ **EXISTS** | `20260519_capsule_piece4_tables.sql:67` |
| `recipient_query_log` | ✅ **EXISTS** | `20260519_capsule_piece4_tables.sql:90` |
| `document_access_log` | ✅ **EXISTS** | `20260519_capsule_piece4_tables.sql:110` |
| `capsule_snapshot` (frozen) | ✅ **EXISTS** | `20260519_capsule_snapshot.sql:10` — JSONB column on `capsule_external_shares` |
| AES-256-GCM encryption | ❌ **NOT FOUND** | No evidence in project files. `api_key_encrypted` is TEXT in `recipient_api_connections`, but encryption algorithm is not specified. |
| Shortcode URL (`/c/:code`) | ⚠️ **PARTIAL** | `capsule-sharing.routes.ts` has `access_token` and `share_id`, but no explicit shortcode mechanism found. |
| Tier-gated attribution | ⚠️ **PARTIAL** | `subscription_tier` referenced in `users` table, but tier-gated logic not verified in sharing routes. |
| Stripe margin | ❌ **NOT FOUND** | `platform_margin_usd` column exists in `recipient_api_connections` and `recipient_query_log`, but Stripe integration is not verified. |

---

## 7. OPEN ITEMS FROM SPEC §6 — VERIFICATION RESULTS

| # | Open Item | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `deal_assumptions` schema — is `year1` one JSONB blob? | ✅ **JSONB blob** | `deal-assumptions.routes.ts:1734` — `deal_assumptions.year1 is empty` (field access). `TICKET_A_WRITE_RACE_FIX.md:31` confirms single JSONB blob keyed by field. |
| 2 | Projections consumer exact name | ✅ **getDealFinancials** | `proforma-adjustment.service.ts:2194` — `export async function getDealFinancials`. Calls `projectProformaForDeal()` at `:3123`. |
| 3 | `deal_capsules` in migrations | ⚠️ **REFERENCED but not created** | `20260519_capsule_piece4_tables.sql:21` references `deal_capsules(id)` as FK. No `CREATE TABLE deal_capsules` found in any migration. |
| 4 | `/share`, `/deck`, shortcode routes | ⚠️ **STUBS exist** | `capsule-sharing.routes.ts` has `POST /:capsuleId/share/external`, `GET /shares/:shortcode`, but shortcode is `access_token` not a dedicated shortcode column. |
| 5 | `scope_id` existence | ❌ **NOT FOUND** | Not in any `.ts` file or migration. |
| 6 | 3 unguarded shared-layer writers | ⚠️ **FOUND 1** | `document-to-corpus.ts:442` sets `redistribution_restricted: true`, but no `scope_id` guard. Other writers need deeper grep. |
| 7 | Rent Comp Grid — unions platform + user CoStar? | ⚠️ **NOT VERIFIED** | Spec says display-plane dedupe + badge may be unbuilt. Needs UI-level inspection. |
| 8 | DealContext assembly | ✅ **VERIFIED** | `agents/tools/fetch_assumptions.ts:7` assembles from `deal_assumptions.year1`. Cashflow agent spec says Research Agent assembles `DealContext` first. |
| 9 | Data Library archive — aggregated distributions? | ✅ **VERIFIED** | `fetch_archive_assumption_distribution.ts:119-128` returns `p10, p25, p50, p75, p90, n_samples`. |
| 10 | Documents Library vs Data Library distinct | ✅ **VERIFIED** | `deal_document_files` vs `data_library_files`. Separate services. |
| 11 | `proforma_assumptions` — full schema | ⚠️ **PARTIAL** | Table exists with 5 scalar pairs (`rent_growth`, `opex_growth`, `vacancy`, `exit_cap`, plus baselines). `year1` is JSONB blob. |
| 12 | `proforma_templates` — never applied | ⚠️ **VERIFIED** | `PROFORMA_SUBSYSTEM_AUDIT.md` PF-12: "ProForma templates never applied to deals." |
| 13 | `deal_versions` — LLM path only | ⚠️ **VERIFIED** | `PROFORMA_SUBSYSTEM_AUDIT.md` confirms `deal_versions` is blob snapshot, LLM path only. |

---

## 8. GAP SUMMARY — Prioritized

### 🔴 P0 — Blockers (break spec invariants or prevent correct operation)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| P0-1 | **`deal_capsules` table has no CREATE TABLE migration** | Sharing layer references a non-existent table. FKs will fail. | Create `CREATE TABLE deal_capsules` migration or verify it exists in an unsearched migration. |
| P0-2 | **`scope_id` column does not exist** | Lane A/B scope guard cannot be enforced. `redistribution_restricted` is ad-hoc, not formal. | Add `scope_id` to relevant tables per `CORRELATION_TERMINAL_SCOPE_SPEC`. |
| P0-3 | **Extraction pipeline does NOT set `scope_id` or `redistribution_restricted` at ingest** | Licensed/user data may leak into shared corpus before downstream guard catches it. | Add `scope_id` and `redistribution_restricted` assignment in `extraction-pipeline.ts` at ingest time. |
| P0-4 | **NOI formula bug (CF-01):** `getFieldValues` forces `egi - total_opex`, ignores OM-extracted `year1.noi.om` | Cascades into IRR, cap rate, S&U, returns, valuation grid, sensitivity. | Fix `getFieldValues` to read `year1.noi.resolved` directly when available. |

### 🟡 P1 — Misalignments (spec says one thing, code does another)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| P1-1 | **`FIELD_PRIORITIES` is a global constant, not per-field spec-defined walks** | `agent` layer not in priority map. Some fields may resolve incorrectly. | Encode per-field source-priority walks in a spec-driven config (not hardcoded JS). |
| P1-2 | **Per-year overrides (`per_year_overrides`) never consumed by Projections** | Year 3 payroll edits save to DB but are discarded on next fetch. | Wire `per_year_overrides` read into `projectProformaForDeal()` or `getDealFinancials()`. |
| P1-3 | **4 tabs leak LayeredValue raw layers** (`AssumptionsTab`, `OverviewTab`, `DealTermsTab`, `SourcesUsesTab`) | UI shows `.platform`/`.broker` instead of `.resolved`. | Refactor tabs to read `.resolved` only. |
| P1-4 | **Rent Comp Grid does not union platform + user-uploaded CoStar** | User CoStar comps are invisible in comparison grid. | Wire display-plane dedupe + badge + guard for platform + user CoStar union. |
| P1-5 | **Expense/other-income comps not wired to Pro Forma assumptions** | Data Library archive (Tier 3.5) is mined by agents but not fed into Pro Forma. | Wire `fetch_archive_assumption_distribution` results into seeder/assumption pipeline. |
| P1-6 | **`stabilization_marker` consumption by Projections not verified** | If Projections derives its own stabilization, Pro Forma Y_S and Projections terminus diverge. | Trace `getDealFinancials` → confirm it reads `stabilization_marker` from LVE, not recomputes. |

### 🟢 P2 — Cleanup (debt, not functional gaps)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| P2-1 | **5 deal-page variants → 2 remain, decision OPEN** | Two canonical pages (`CapsuleDetailPage`, `DealDetailPage`) both exist. | Decide canonical page, redirect other, consolidate. |
| P2-2 | **CapsuleDetailPage is hardcoded mock** | No live fetch; shows placeholder data. | Wire to `year1` / Projections path (same as F9). |
| P2-3 | **6 unmounted routes** (`investor-capital`, `capsule-intelligence`, `demand-intelligence`, `reporting-package`, `zoning-comparator`, `audit`) | LP/GP grid, intelligence, zoning, reporting all 404. | Mount or remove dead route files. |
| P2-4 | **3 ghost endpoints** (`/balance-sheets`, `/roadmap`, `/timeline`) | UI calls return 404. | Remove UI fetch calls or implement routes. |
| P2-5 | **AES-256-GCM + shortcode + Stripe margin — design exists only in memory** | Sharing layer has DB tables but encryption algorithm and billing are not verified. | Implement or document as deferred. |
| P2-6 | **13 empty tables** on 464 Bishop (market intelligence, supply, tasks, risks, scenarios, debt schedule, etc.) | Silently blank surfaces. | Seed defaults or add "not configured" UI states. |
| P2-7 | **Purchase price in 3 locations** (`deals.deal_data`, `deal_assumptions.land_cost`, `deal_context_fields`) with no documented precedence | Same field, different values, no canonical resolution. | Document precedence or consolidate. |

---

## 9. BUILD ORDER IMPLICATION (Updated from Spec §7)

```
P0  Create deal_capsules table migration (if truly missing)
P0  Add scope_id column + close 3 unguarded shared-layer writers
P0  Fix extraction-pipeline.ts to set scope_id + redistribution_restricted at ingest
P0  Fix NOI resolution (CF-01) — highest downstream leverage
P1  Encode per-field source-priority walks (replace FIELD_PRIORITIES global constant)
P1  Wire per-year overrides into Projections loop (PF-02)
P1  Fix LayeredValue leakage in 4 tabs
P1  Rent Comp Grid: union platform + user CoStar, dedupe + badge + display guard
P1  Wire expense/other-income comps → Data Library archive (aggregated) + owned actuals
P1  Verify stabilization_marker consumption by Projections (not independent derivation)
P2  Consolidate 2 deal pages → 1 canonical + redirect
P2  Wire CapsuleDetailPage overview to real year1/Projections path
P2  Mount 6 missing routes or remove dead files
P2  Remove 3 ghost endpoints from UI
P2  Create deal_capsules table + snapshot-service (if P0 migration was missing)
P2  Layer-filter permission scope + shortcode + share metering
P2  Seed default LP tranches (RC-005)
P2  Add "not configured" states for 13 empty tables
```

---

*End of audit. Ready for next phase: dispatch any P0 item or continue with deeper line-level verification.*
