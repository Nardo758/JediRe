# Weekly Status — JEDI RE Operations

> **Purpose:** Tracks every open task and recently-closed item to prevent drift between stated status and actual live state. Run weekly. Updated in-place — each week adds a new dated block at the top.

---

## Week of 2026-05-19

**Operator:** Agent  
**Date:** 2026-05-19  
**Type:** Post-deploy — Capital Structure Phase 1 close-out + audit

---

### Recently Closed (2026-05-19)

| Task | Closed | Closing Note | Status |
|------|--------|-------------|--------|
| #889 — Capital Structure Phase 1: Defaults + LTV Optimization (re-audit) | 2026-05-19 | `docs/audits/capital_structure_phase1_reaudit_20260519_013000.md` | DONE-DONE — 9/10 AC pass; 1 partial (M36 Phase 2 item, non-blocking); SHIP |

---

### Capital Structure Phase 1 Audit Results

> Verification phases A / B / C from the re-audit (`#889`). Each item shows the per-criterion state confirmed in the production DB.

#### Category A — Defaults Seeding

| Item | Value | Layer | Status |
|------|-------|-------|--------|
| `ltv_pct` default | 0.75 | platform | PASS |
| `gp_equity_pct` default | 0.10 (→ LP 0.90 implied) | platform | PASS |
| `preferred_return_pct` default | 0.08 | platform | PASS |
| `debt_rate` (FRED DGS10 + 200bps) | 0.0659 (live, not fallback) | platform | PASS |
| `seeded_at` timestamp present | 2026-05-19T00:06:21Z | — | PASS |

All 5 default fields confirmed in active `deal_underwriting_scenarios.year1` for 464 Bishop (production deal). Lazy-seeding gap for un-visited deals → F-backfill-1 (#890, low severity).

#### Category B — Agent Integration

| Item | Status | Evidence |
|------|--------|----------|
| `optimize_capital_structure` fires on every cashflow run | PASS | 4 v3.5.0 `agent_runs` rows in DB, all with `proforma.capital_structure.optimization` |
| Strategy-to-metric mapping — existing → cash_on_cash | PASS | Run `37887cbe` (464 Bishop) |
| Strategy-to-metric mapping — development → stabilized_value | PASS | Run `0c07cfe4` (Jaguar) |
| Strategy-to-metric mapping — value-add → irr | PASS | Run `c417f979` ([CS-AUDIT] Value-Add) |
| Strategy-to-metric mapping — flip → profit_at_exit (infeasible) | PASS | Run `d44e4016` ([CS-AUDIT] Flip) |
| Prompt updated (v3.5.0, negative-NOI guidance) | PASS | `cashflow.config.ts` |
| Optimization completes within 30s | PASS | All 4 runs <100ms |

#### Category C — F9 Rendering

| Item | Status | Notes |
|------|--------|-------|
| Platform defaults present in data layer (Returns tab source) | PASS | `ltv_pct`, `gp_equity_pct`, `preferred_return_pct`, `debt_rate` all in active scenario `year1` |
| Optimization recommendation block in `agent_runs.output` | PASS | 4 v3.5.0 rows with `cs_opt`; total `runs_with_cs_opt`: 4 of 619 |
| End-to-end UI render (Returns tab visual) | PARTIAL | Data layer confirmed correct; screenshot-level UI verification not run in automated audit |

---

### Supposedly Done — Verified (2026-05-19)

> Items previously in "Supposedly Done — Verify" that have now been confirmed by the Phase 1 re-audit.

| Item | Prior State | Current State | Evidence |
|------|------------|---------------|----------|
| PR 1 — `seedCapitalStructureDefaults` writes to active scenario `year1` (not clobbered by sync trigger) | FAIL (first audit 2026-05-18) | **VERIFIED** | `seeded_at` in DB; active scenario confirmed; 464 Bishop run `37887cbe` |
| PR 2 — Postprocessor fallback calls `optimizeCapitalStructure()` deterministically after every cashflow run | FAIL (first audit 2026-05-18) | **VERIFIED** | 4 v3.5.0 runs in `agent_runs`: `37887cbe`, `0c07cfe4`, `c417f979`, `d44e4016` |

---

### In-Flight / Pending Tasks (2026-05-19 additions)

| # | Task | Status | Notes |
|---|------|--------|-------|
| #890 | F-backfill-1: One-time CS defaults migration — seed `ltv_pct` for all deals where active scenario `year1->'ltv_pct'` is null | PENDING | Low severity; lazy-seeding gap for 5 un-visited production deals |
| #891 | F-strategy-1: Populate `deals.strategy` at creation time or derive from `investment_strategy_lv.resolved` | PENDING | Medium severity; all 5 original production deals have `strategy=null`; design question (early-stage default?) is first scope item |
| #892 | F-jgs-1: M36 Pareto Frontier (`run_joint_goal_seek`) postprocessor fallback — Phase 2 | PENDING | Medium severity; 0 calls in 619 runs; Returns tab Alternative Structures section blank |

---

### Key Metrics — 2026-05-19 Snapshot

| Metric | Value | Source |
|--------|-------|--------|
| `agent_runs` total (cashflow agent) | 619 | `agent_runs` table |
| v3.5.0 runs with `cs_opt` | 4 of 619 | `agent_runs WHERE agent_version = '3.5.0'` |
| v3.3.0 runs (pre-fix, unaffected) | 29 | `agent_runs WHERE agent_version = '3.3.0'` |
| `deals.strategy` populated | 2 (audit test deals only; all production deals null) | `deals` table |
| CS defaults seeded in active scenario | 1 production deal (464 Bishop) | `deal_underwriting_scenarios` |
| Audit score | 9 PASS / 1 PARTIAL / 0 FAIL | `docs/audits/capital_structure_phase1_reaudit_20260519_013000.json` |

---

### Issues Surfaced This Week

**F-strategy-1 (medium):** `deals.strategy` is universally null for all 5 original production deals. The deal creation route (`POST /api/deals`) does not write `strategy` — it writes `project_type` (derived from `projectType` body param or `property_type_key` lookup) but not `strategy`. The `createDealSchema` in `validation.ts` does not include a `strategy` field. Strategy is currently determined post-creation via M08 analysis or explicit user selection. The postprocessor fallback resolves strategy via `project_type` gracefully, but the IRR and profit_at_exit paths require `deals.strategy` to be explicitly set. The design question — what should the early-stage default for `strategy` be? — is the first item in #891's scope.

**F-backfill-1 (low):** 5 production deals have no CS defaults in their active scenario because `getDealFinancials()` hasn't been called for them since the seeder fix landed. First UI open on any of these deals will trigger the seeder automatically. The one-time migration in #890 closes this gap proactively.

---

### Next Week Priorities (Suggested)

1. **Run "Supposedly Done" verification queries** (carry-over from 2026-05-17) — scenario templates, production prompt versions, DQA Phase 2. These gaps are still open.
2. **#890 CS defaults backfill** — one-time migration, low effort, closes the lazy-seeding gap for all existing production deals.
3. **#891 strategy field at creation time** — design question first; then wire the creation route to write `strategy` from the deal intake form or derive from `investment_strategy_lv`.
4. **Seed archive benchmarks (#846)** — still 0 rows; blocks archive trend chart and assumption benchmarking.
5. **#892 M36 Pareto Frontier postprocessor fallback** — Phase 2 deliverable; no urgency but worth queuing.

---

## Week of 2026-05-17 (Baseline Run)

**Operator:** Agent  
**Date:** 2026-05-17  
**Type:** First baseline — establishing ground truth before weekly cadence begins

---

### In-Flight / Pending Tasks

> Task IDs (`—`) indicate tasks that exist in the project queue but have not yet been assigned a numbered task ID. IDs will be populated as tasks are picked up. Closed tasks in the "Recently Closed" section carry their assigned IDs.

| # | Task | Status | Notes |
|---|------|--------|-------|
| — | Seed market events for cities beyond Atlanta | PENDING | Atlanta only; non-Atlanta deals get zero-delta scenarios |
| — | Populate the msaId field on deals | PENDING | City-name fallback in use; affects scenario event matching and market intel |
| — | Enrich news articles with MSA tags | PENDING | Auto-matching is city-name only; MSA tags would improve precision |
| — | Let analysts manually link/unlink news articles from key events | PENDING | No UI for manual article-event association |
| — | Show tooltip explaining AUTO-MATCHED articles | PENDING | UX gap — analysts don't know why articles appear |
| — | Migrate existing supply and cashflow data | PENDING | Computed results at risk if schema changes without migration script |
| — | Show supply pipeline + cashflow projections inside deal detail view | PENDING | Currently only on dedicated pages, not embedded in deal card |
| — | Re-run analysis automatically when documents uploaded | PENDING | Manual trigger only |
| — | Show automated analysis status + progress in deal view | PENDING | No in-deal progress indicator for agent runs |
| — | Use real county millage data instead of hardcoded defaults | PENDING | Tax engine falls back to hardcoded values for most counties |
| — | Auto-flag underinsured deals based on state insurance benchmarks | PENDING | Insurance benchmark check not wired to alert pipeline |
| — | Show web search citations in deal analysis reports | PENDING | Citations present in agent output but not surfaced in UI |
| — | Persist web search cache to Redis | PENDING | Cache is in-memory; lost on restart |
| — | Wire assumption cell clicks to open Evidence Panel | PENDING | No click handler on assumption cells in Financial Engine |
| — | Add assumption benchmarking vs portfolio percentiles | PENDING | No cross-deal assumption comparison UI |
| — | Seed CashFlow Agent multi-variant prompts into database | PENDING | Dev DB seeded as side effect of Task #842; production DB status unconfirmed — see "Supposedly Done" |
| — | Seed archive benchmarks from existing deals | PENDING | archive_assumption_benchmarks table has 0 rows; all archive data_points show "insufficient_cohort (n=0)" |
| — | Add analyst-facing archive trend chart | PENDING | Depends on archive benchmarks being populated |
| #843 | Operations infrastructure — status ritual + scenario spec retrofit | IN PROGRESS | This document; Scenario Management spec being created simultaneously |

---

### Recently Closed (2026-05-17)

| Task | Closed | Closing Note | Status |
|------|--------|-------------|--------|
| #842 — Priority 3: Agent prompt operational depth | 2026-05-17 | `docs/operations/priority3-closing-note.md` | MERGED — F-001/F-003/F-005 verified; F-002 demonstrated (non-deterministic, ~25% rate) |
| #841 — F-010: Override layer contamination | 2026-05-17 | `docs/operations/f010-closing-note.md` | RESOLVED — broker OM contamination of override slot fixed; no active writer remains |
| F-009 — Other income write-back | 2026-05-17 | `docs/operations/f009-closing-note.md` | DONE-DONE — all 6 criteria verified; `revenue.other_income` maps to `other_income_dollars` |

---

### Supposedly Done — Verify

> Items reported as done or shipped that lack end-to-end live verification. Each row needs a verification run to confirm before being moved to the "Verified" column.

| Item | Claimed Status | Verification Gap | How to Verify | Evidence File |
|------|---------------|-----------------|---------------|---------------|
| Unit-mix → GPR toggle (`da:use_unit_mix_for_gpr`) | SHIPPED (#Task B, 2026-05-08) | Code path DORMANT — zero deals in production have `deal_assumptions.unit_mix` populated. No extraction pipeline writes to this column. Toggle has never fired on a real acquisition deal. | Run `SELECT COUNT(*) FROM deal_assumptions WHERE jsonb_typeof(unit_mix) = 'array' AND jsonb_array_length(unit_mix) > 0`. If 0, document as dormant until a unit_mix write pipeline is built. | `docs/architecture/SHIPPED_WORK_VERIFICATION.md` Item 2 |
| S1-01 Custom opex inflation filter | SHIPPED (`e0258abb`, 2026-04-20) | `SMALL_BACKFILL_NEEDED` — existing deals (including 464 Bishop) still carry pre-fix `custom_opex_*` values with revenue lines, P&L rollups, and below-the-line items contaminating total_opex. The fix only applies to newly seeded deals. | Run qualifying SQL from `docs/architecture/DORMANT_IMPROVEMENTS_AUDIT.md` Section S1-01. Count deals where known-bad keys (e.g. `custom_opex_multifamily_rental_revenue_net`) are non-zero. | `docs/architecture/DORMANT_IMPROVEMENTS_AUDIT.md` S1-01 |
| F-002 per-floor-plan GPR (Task #842) | MERGED (#842, 2026-05-17) | Behavioral improvement demonstrated in run `48314186` (11 per-floor-plan data_points). However, ~75% of runs still produce aggregate entries despite LOOP RULE + FORBIDDEN label instructions. Deterministic enforcement pending code-level fix. | Run 464 Bishop underwriting 3× and count how many produce GPR `dp_count >= 11`. If < 2/3 runs hit the target, escalate to #848 (code-level F-002 enforcement). | `docs/operations/priority3-closing-note.md` F-002 Verified section |
| CashFlow Agent multi-variant prompts seeded | PARTIAL — dev DB seeded as side effect of Task #842 | Project task "Seed the CashFlow Agent's multi-variant prompts into the database" is still open in the task queue. Confirms dev DB is seeded (cashflow-v7.1-variant-existing v4.4.0, cashflow-v8.0-core v5.3.0). Production DB state unconfirmed. | Run `SELECT id, version, updated_at FROM prompt_versions WHERE agent_id = 'cashflow'` against production DB. Confirm `active=true` rows exist for core + variant prompts. | DB query only |
| Scenario templates seeded | ASSUMED — tables exist, generate API partially ships | No closing note or verification query has been run confirming `scenario_templates` has 4 rows (bull/base/bear/stress) in any environment. | Run AC-02 query from `docs/architecture/SCENARIO_MANAGEMENT_SPEC.md` Section 10: `SELECT scenario_type, COUNT(*) FROM scenario_templates GROUP BY scenario_type`. Expected: 4 rows. | None yet — needs first run |
| DQA Phase 2 field-level write times (#698 / #700) | REFERENCED as shipped in monitoring runbook | `docs/ops/dqa-monitoring-runbook.md` Section 2 references "Expected post-Phase 2 deploy (Task #698 + #700)" but no closing note exists for either task. Not confirmed in the project task queue or shipped work verification. | Check if `extraction_events` table exists and has rows: `SELECT COUNT(*), MIN(written_at), MAX(written_at) FROM extraction_events`. If table absent, Phase 2 is not deployed. | `docs/ops/dqa-monitoring-runbook.md` Section 2 |
| `forceReseed` hook after extraction pipeline (#519) | VERIFIED_LIVE (2026-05-08) | Verified in Task B probe but used a synthetic payload. Real-world re-trigger after a genuine OM/rent-roll upload has not been observed end-to-end. | Upload a new document to an existing deal and check whether `year1.last_seeded_at` advances within 60s. | `docs/architecture/SHIPPED_WORK_VERIFICATION.md` Item 3 |

---

### Blocked / Waiting

| Item | Blocked On |
|------|-----------|
| Archive trend chart | Requires archive benchmarks seeded first (0 rows currently) |
| Assumption benchmarking | Requires archive benchmarks seeded first |
| Scenario CIE integration (Phase 4) | Requires Scenario Phase 2 (UI Integration) to be deployed first |
| Automated analysis on document upload | Depends on agent pipeline trigger wiring (separate from forceReseed hook) |

---

### Key Metrics — 2026-05-17 Snapshot

| Metric | Value | Source |
|--------|-------|--------|
| Agent runs (last 7 days) | Query: `SELECT COUNT(*), status FROM agent_runs WHERE created_at > NOW()-INTERVAL '7 days' GROUP BY status` | agent_runs table |
| Tier4/UNANCHORED rate (latest 464 Bishop run) | 0% (0/19) — run `9a22bd63` | underwriting_evidence |
| Archive benchmarks seeded | 0 rows | archive_assumption_benchmarks |
| Prompt versions active | 2 (core + variant:existing) | prompt_versions |
| Deals with unit_mix populated | 1 (Jaguar Redevelopment — manual) | deal_assumptions |
| market_events rows | Query: `SELECT city, COUNT(*) FROM market_events GROUP BY city ORDER BY 2 DESC LIMIT 10` | market_events table |
| scenario_templates rows | Query: `SELECT COUNT(*) FROM scenario_templates` — expected 4 | scenario_templates |

---

### Next Week Priorities (Suggested)

1. **Run "Supposedly Done" verification queries** — particularly scenario templates, production prompt versions, and DQA Phase 2 status. Close the verification gaps before they compound.
2. **Seed archive benchmarks (#846)** — unblocks archive trend chart, assumption benchmarking, and improves F-005 cohort anchoring from n=0 to real data.
3. **Hydrate DealContext otherIncomeMonthly (#847)** — fixes the T-12 routing gap that causes other income to fall back to agent estimation instead of direct extraction.
4. **Code-level F-002 enforcement (#848)** — post-processing validator for per-floor-plan GPR data_points to eliminate LLM sampling variance.
5. **Seed market events for non-Atlanta deals** — current scenario system produces zero-differentiation scenarios for non-Atlanta deals.

---

## Template for Future Weeks

```markdown
## Week of YYYY-MM-DD

**Operator:** [name]
**Date:** YYYY-MM-DD
**Type:** [Routine | Post-deploy | Incident review]

### In-Flight / Pending Tasks
[table — same format as above]

### Recently Closed
[table — task, date, closing note, status]

### Supposedly Done — Verify
[table — item, claimed status, gap, how to verify, evidence file]

### Blocked / Waiting
[table — item, blocked on]

### Key Metrics Snapshot
[table — metric, value, source]

### Issues Surfaced This Week
[freeform — any new gaps, regressions, or newly-discovered dormant features]

### Next Week Priorities
[numbered list]
```
