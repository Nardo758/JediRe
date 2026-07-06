# DISPATCH — W5 CLOSE-OUT: Bishop Pin + Full Suite + Runbook Phases 2–3 + Parity List

**Arc:** F9 Underwriter Model — final pass. The Bishop capture PASSED the pre-registered verdict (2026-07-05, `/tmp/bishop_final.json`, commit `66c13f8f5` serving): loan $21,024,006 HELD · equity $39,365,994 (= $60,390,000 − $21,024,006 exactly) · IRR −20.95% (worse, as predicted) · EM 0.31438 (verified by closed-form ratio: 0.589 × 21.0M/39.366M = 0.3142) · ALL_INVARIANTS pass in-payload · DSCR 1.0424 held (located at `debtMetrics.dscr`).
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Roles:** capture/test agent executes all of this; no engine edits (cleanup items are LOGGED, not fixed here).
**Standing rules:** S1-01 evidence per item. Path-bound fixtures. Pin once, correctly.

## P1 · Pin Bishop
1. Populate `bishop.golden.ts` (BuildExpected shape) from `/tmp/bishop_final.json` — if the tmp file is gone, regenerate via the proven sequence (construct-build-body → build → verify the five verdict values match the table above before using it; any deviation = STOP, not re-pin).
2. Provenance block: store-sourced body (F-P1-A contract noted: route requires client assumptions; body constructed from stored DB row) · engine commit `66c13f8f5` · full sensitivity table incl. the EM closed-form magnitude check · capture timestamp · "pinned post-Findings A–O + pre-optimization throw demotion".
3. Golden test reproduces the pinned values through `runFullModel()` on the fixture's rawAssumptions — same math, same inputs (Finding M's closure criterion).

## P2 · Full suite
Run everything. Expected: **golden 3/3** (Bishop build_path · Highlands seed_path · SyntheticDegenerate) · identity 4/4 · loudness 2/2 · K-2 lease_up ERROR · determinism byte-identical · excel-parity SOLE remaining skip. Zero new tsc errors vs baseline. Paste the counts.

## P3 · Runbook Phases 2–3 (the last acceptance items of W5)
1. **Smoke shapes on real deals:** Bishop CHART/monthly series — climbs from in-place-era baseline, floor dormant→binding transition month noted; Highlands — steady state per seed data, no death spiral. Screenshots or pasted series.
2. **Consumer matrix:** NOI/EGI/IRR/EM/loan fetched via every consumer path (deal-panel route, F9 surfaces, terminal FinancialsTab, capital-structure route) — one value per quantity per deal. Paste the matrix. Capital-structure must serve the POST-resize deal ($21M loan), not deal_data.
3. **D1 behavioral (EIGHTH session on the sheet — closes now or gets a named blocking reason):** logs + ai_usage_log tailed, navigate every F9/Deal Details/AssetHub/terminal surface for both deals — zero LLM calls from pure navigation, before/after row counts pasted.
4. **T2 forced cache-hit (same age, same rule):** identical large prompt twice through the agent pipeline; second call shows nonzero cache_read_tokens, cost_usd matches three-term hand math pasted beside it.

## P4 · Parity list (the operator's gate)
Regenerate from the PINNED Bishop values: every parity-checked field with (field name · year/period · pinned value · expected workbook cell format). Write to `docs/EXCEL_PARITY_ORACLE_REQUEST.md` and surface it — this is a fill-in-the-blanks ask for Leon; his workbook values are the engine's only external validation and the last open skip.

## P5 · Cleanup log (LOGGED for next arcs, NOT fixed here)
1. `integrityChecks` array contains the pass-1 informational block AND the final verdict merged unlabeled (full duplicate + dscr_floor_binds singleton) — needs `phase: preOptimization | final` labels or dedupe so consumers don't double-count. → F-P1-adjacent cleanup.
2. DSCR absent from `summary` (lives only in `debtMetrics.dscr`) — decide whether summary should carry it per assemble-once contract. → same cleanup ticket.
3. Service-shell integration tests assert non-throw + status only — upgrade to output-state assertions (loan == resized, equity == acqCost − loan, ALL_INVARIANTS in payload). → test-hardening ticket.
4. `LOW_CONFIDENCE_MODEL: 63% of evidence KPI fields LOW confidence` — honest flag, feeds the S3 source-tier/doc-request arc; note as evidence the doc-upgrade loop has real demand.
5. Vendor-pipeline workflow failure — still parked, untriaged.

## P6 · Close-out report
Verdict table: P1–P4 pass/fail with evidence refs. On full green: **declare W5 CLOSED** in the report and in `docs/POST_D2_PROGRAM_ROADMAP.md` (move Phase-0 items to done; TS-1 becomes the active item — its dispatch is `TS1_THIN_SURFACING_PASS.md`, gate now satisfied). Commit + push everything; paste `git log --oneline -3`.

## OUT OF SCOPE
All P5 items · engine/route edits · F-P1 work · TS-1 execution (next dispatch, gate-satisfied on this report's green) · excel-parity execution (operator-gated).

**Order: P1 → P2 → P3 → P4 → P6. Report with the verdict table. This is the last dispatch of the engine arc.**
