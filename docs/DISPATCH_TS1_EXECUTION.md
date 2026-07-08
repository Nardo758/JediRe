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
