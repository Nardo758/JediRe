# Weekly Status — JEDI RE Operations

> **Purpose:** Tracks every open task and recently-closed item to prevent drift between stated status and actual live state. Run weekly. Updated in-place — each week adds a new dated block at the top.

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
