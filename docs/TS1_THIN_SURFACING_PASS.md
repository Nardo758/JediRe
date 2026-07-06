# DISPATCH — TS-1 EXECUTION: Thin Surfacing Pass (Replit Session)

**Gate: SATISFIED** — W5 closed 2026-07-06 with named residuals (roadmap `4d4b0b193`, close commit `7b21f5cab`). This dispatch supersedes the gate line in any earlier TS-1 copy; if `docs/TS1_THIN_SURFACING_PASS.md` in the repo differs from this file, THIS file governs — commit it over the repo copy first.
**Arc:** bridge between W5 and F-P1. F-P2 supersedes these placements later, so every change is intentionally shallow and disposable.
**Repo:** `Nardo758/JediRe.git` · backend :4000 · both deals: Bishop `3f32276f-aacd-4da3-b306-317c5109b403`, Highlands `eaabeb9f-830e-44f9-a923-56679ad0329d`.
**HARD SCOPE RULE — the whole dispatch in one sentence:** RENDER-ONLY. No new tabs, no layout restructuring, no store changes, no new endpoints, no engine files touched. All data already exists in `ModelResults` served by the latest-model read path. Any change that isn't "read an existing field and display it" is OUT OF SCOPE — including fixing any data defect you find (report, don't fix). T-token styling (JetBrains Mono, ≤2px radius, no shadows/gradients).
**Standing rules:** S1-01 — acceptance is screenshots + pasted payloads; verify counts; report anything found beyond this list.

## Known-state caveats (post-W5, so you don't rediscover them)
- Bishop's golden FIXTURE is unpinned — irrelevant here; his LIVE build works and is the data source. Build fresh if `getLatestModel` has no row (route requires client assumptions body — use `scripts/construct-build-body.ts`, known F-P1-A contract).
- **Do NOT surface DSCR from the capital-structure route** — Finding U (route computes it ~100x wrong, interest-only + /100 bug, awaiting F5). DSCR, if shown anywhere, reads `debtMetrics.dscr` from the model payload only.
- `integrityChecks` array currently contains pre-optimization + final blocks merged unlabeled (known cleanup item) — if T4 renders check counts anywhere, don't sum the array raw.

## T1 · Three-quantity pills on the ProForma header
Render `IN-PLACE NOI $X · Y1 NOI $Y · STABILIZED $Z` as header pills alongside existing KPIs. Sources: evidence field `inPlaceNOI` · `summary.noiYear1` · `disposition.stabilizedNOI`. Tooltip per pill = that evidence entry's `reasoning` string verbatim (the evidence block is the copy source; write no new copy).

## T2 · Vacancy-floor badge
Where Y1/summary vacancy displays: when `floorBinding` is true for the displayed period, render `UNDERWRITTEN 95.0% · PHYSICAL 96.2%` + a small amber `FLOOR` badge (existing badge styling family). Floor dormant → no badge; absence means physical rules. Drive strictly off the `floorBinding` boolean — never re-derive the comparison client-side.

## T3 · Occupancy row in the ribbon grid
Verify turn-engine months flow to the PeriodicGrid (spot-check one month's value vs `monthlyCashFlow[i]`). Add ONE row toggle — physical occupancy % per month from `monthlyCashFlow[].occupancy` — ONLY if the existing grid row model makes it trivially cheap. If it requires touching PeriodicGrid internals: skip and report.

## T4 · Evidence strings render check
Wherever the evidence panel/SourceBadge flow renders `reasoning`, confirm the turn-cohort-era strings (Y1 emergent wording, in-place endpoint wording, `rentRollMissing`/`inPlaceRentDefaulted` flags where applicable) display untruncated and uncached. Render check only — no copy edits.

## ACCEPTANCE (screenshots + payload pastes, both deals)
1. Bishop ProForma header: three pills visible; values equal the live payload (paste the payload fields beside the screenshot).
2. Floor badge truthful to `floorBinding`: expected Highlands-shape steady state → badge shows; Bishop early lease-up months → dormant. Screenshot each state actually observed; if observed state differs from expected, report the payload, don't force the UI.
3. Grid renders engine months (value spot-check pasted) + occupancy row if built, or the skip report.
4. Evidence strings screenshot (one deal with flags if data exists; otherwise state honestly that no flagged deal exists).
5. **`git diff --stat` shows FRONTEND-ONLY changes — pasted.** Any backend line in the diff fails the dispatch.
6. Zero new LLM calls / usage rows during the whole session's navigation and rendering (D1 discipline holds; paste the row-count before/after).

## OUT OF SCOPE
Chassis/tab changes (F-P2) · bridge view · action layer (F-P2c) · PeriodicGrid internals · store or endpoint changes · fixing Finding U or any data defect found · Opus panel · engine files · fixture files.

**Order: caveats read → T1 → T2 → T3 → T4 → acceptance → report with screenshots and pastes. Single session scope.**

---

## EXECUTION REPORT (2026-07-06)

### Ground-truth payload check (before touching any code)
Pulled `/api/v1/financial-model/:dealId/latest` for both deals via dev-login token. Actual `results` shape:
`{ annualCashFlow, debtMetrics, evidence, integrityChecks, meta, reasoning, sensitivityAnalysis, sourcesAndUses, summary, waterfallDistributions }`.

**Deviation from dispatch's assumed field paths:**
- There is **no `disposition` key at all** in the served payload. `disposition.stabilizedNOI` (T1's cited source) does not exist. The equivalent live field is `summary.noiStabilized`.
- There is **no `monthlyCashFlow` array** in this endpoint's response — not truncated, not empty, the key is absent entirely. This affects T2 and T3 (see below).
- `evidence.fields` is a flat array of `{field, value, source, confidence, reasoning}` entries, already flowing to the frontend (not sourced from a new endpoint) — this backs T1.

### T1 · Three-quantity NOI pills — IMPLEMENTED
Added `IN-PLACE NOI / Y1 NOI / STABILIZED` pills to the ProForma header KPI strip in `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx`. Sourced strictly from already-present fields:
- IN-PLACE NOI ← `evidence.fields[]` entry where `field === 'inPlaceNOI'` (first match)
- Y1 NOI ← `summary.noiYear1`
- STABILIZED ← `summary.noiStabilized` (not `disposition.stabilizedNOI` — that path doesn't exist; deviation noted above)

Tooltip = that evidence entry's `reasoning` string verbatim, no new copy written. When a value is absent for the current deal, the pill renders `—` with no tooltip rather than fabricating.

**Data defect found and reported, not fixed:** Bishop's `evidence.fields` contains **two** entries both keyed `field: 'inPlaceNOI'` (deterministic-model-runner.ts ~line 2159–2172) — one is the true in-place run-rate ($1,765,386), the other is mislabeled and duplicates the Y1 NOI value ($1,576,800). The pill implementation takes the first match (the correct value), but the duplicate-key bug itself is a backend data defect, unchanged per scope.

**Unexplained discrepancy found and reported, not fixed:** Highlands' `evidence.fields` has **zero** `inPlaceNOI` entries, even though the runner code that produces them is unconditional (always pushes both). Confirmed via live payload, not a guess. The IN-PLACE NOI pill on Highlands therefore renders `—` honestly — this is the actual, verified live payload state, not a rendering bug.

Payload values observed (paste, both deals):
```
BISHOP   (3f32276f-aacd-4da3-b306-317c5109b403)
  evidence.fields: NOI=1,576,800 | inPlaceNOI=1,765,386 | inPlaceNOI(dup)=1,576,800 | IRR=-20.95% | EM=0.31x | DSCR=1.04 | exitCap=5.00% | goingInCap=2.63%
  summary.noiYear1=1,576,800.49   summary.noiStabilized=1,596,943.55

HIGHLANDS (eaabeb9f-830e-44f9-a923-56679ad0329d)
  evidence.fields: NOI=3,808,324 | IRR=17.89% | EM=2.10x | DSCR=1.61 | exitCap=6.25% | goingInCap=7.85%   (no inPlaceNOI entry)
  summary.noiYear1=3,808,324.50   summary.noiStabilized=3,704,079.62
```
Screenshots taken confirm rendered pills match these values exactly (Bishop: IN-PLACE NOI $1.77M / Y1 NOI $1.58M / STABILIZED $1.6M; Highlands: IN-PLACE NOI — / Y1 NOI $3.81M / STABILIZED $3.70M).

### T2 · Vacancy-floor badge — SKIPPED, REPORTED (not implemented)
`floorBinding` is computed internally per-month by the deterministic runner (`monthlyCashFlow[i].floorBinding`) but **is not serialized into any endpoint the frontend can reach** — absent from `/latest` (no `monthlyCashFlow` key at all, confirmed above) and absent from `/periodic`'s field registry (`backend/src/services/proforma/periodic-seeder.service.ts` — grepped, zero matches for `floorBinding` or `occupancy`). Implementing the badge "driven strictly off the `floorBinding` boolean" per the dispatch's own instruction would require exposing a new field on an existing endpoint — an endpoint change, which the dispatch explicitly places OUT OF SCOPE. Skipped per dispatch's own conflict-resolution rule (do not re-derive client-side; do not touch endpoints).

### T3 · Occupancy row in ribbon grid — SKIPPED, REPORTED (not implemented)
Same root cause as T2. `/periodic`'s live field registry (confirmed via payload pull) contains: `amenities, bad_debt_pct, concessions_pct, contract_services, egi, electric, g_and_a, gas_fuel, gpr, hoa_dues, insurance, landscaping, loss_to_lease_pct, management_fee_pct, marketing, net_rental_income, noi, noi_per_unit, non_revenue_units_pct, office, other_income_per_unit, payroll, personal_property_tax, real_estate_tax, rent_growth, repairs_maintenance, replacement_reserves, total_opex, turnover, utilities, vacancy_pct, water_sewer`. There is **no `occupancy` field** (only `vacancy_pct`, which is not the same series requested) and no `floorBinding`. Per the dispatch's own instruction ("If it requires touching PeriodicGrid internals: skip and report"), and since populating this row requires a periodic-seeder/endpoint change to emit a field that doesn't exist today, this is skipped rather than force-added. The spot-check sub-requirement ("verify turn-engine months flow to PeriodicGrid vs `monthlyCashFlow[i]`") is likewise blocked — `monthlyCashFlow` is not present in any frontend-reachable payload to check against.

### T4 · Evidence strings render check — CONFIRMED, no code change
Reviewed `frontend/src/components/underwriting/EvidencePanel.tsx` (reasoning render, ~line 296–305): `{evidence.reasoning}` is rendered directly inside a div with `lineHeight: 1.6`, no `-webkit-line-clamp`, no `max-height`/`overflow: hidden`, no truncation logic anywhere in the render path. Confirmed render-only — full string displays untruncated. No caching layer intercepts this value (it's read straight off the live evidence object held in component state). No copy edits made.

### ACCEPTANCE CHECKLIST
1. ✅ Bishop ProForma header: three pills visible, values match live payload pasted above (screenshot captured).
2. ⛔ Floor badge: not implemented — see T2 report above (floorBinding not exposed by any reachable endpoint; implementing requires an out-of-scope endpoint change).
3. ⛔ Grid occupancy row / spot-check: not implemented — see T3 report above (occupancy field doesn't exist in the periodic field registry; monthlyCashFlow isn't served by any frontend-reachable endpoint to spot-check against).
4. ✅ Evidence strings: confirmed untruncated/uncached by code review (T4); no flagged-data deal was found to screenshot with `rentRollMissing`/`inPlaceRentDefaulted` — stated honestly rather than fabricated.
5. ✅ `git diff --stat` (frontend + this doc only):
   ```
    docs/TS1_THIN_SURFACING_PASS.md                                              | ~120 ++++++++--
    frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx       |  44 ++++
    2 files changed
   ```
   No backend files in the diff. Two temporary debug edits (`FinancialEnginePage.tsx` default tab, `ConsoleHubTab.tsx` default sub-tab) were made solely to reach the PRO FORMA sub-tab for screenshotting — both were reverted to their original values before this diff was taken; `git diff --stat` on those two files is empty.
6. ✅ LLM usage row count: `ai_usage_log` count was **29,873 before and 29,873 after** the entire session's navigation, screenshotting, and rendering across both deals — zero new rows, zero new LLM calls triggered by this render-only work.

### Summary
T1 implemented and verified on both deals with honest absence-handling for the Highlands data gap. T2 and T3 are blocked by real, verified gaps in what the backend currently serves to the frontend (not implementation shortcuts) — closing them requires endpoint changes that this dispatch places out of scope; that gap is reported here rather than worked around by re-deriving values client-side or touching PeriodicGrid/endpoint internals. T4 passed as a render-only check. Two data defects (Bishop's duplicate-keyed `inPlaceNOI` evidence entry; Highlands' entirely missing `inPlaceNOI` evidence entries despite unconditional runner logic) are reported, not fixed, per scope.
