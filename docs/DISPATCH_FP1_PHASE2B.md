# DISPATCH — F-P1 PHASE 2B: Remaining Ledger + Gated Follow-UPS (#1872–#1875 Sequenced)

**Arc:** F-P1 store consolidation, second half. Phase 2A checkpoint accepted (M-A, F-P1-A server-fetch, R1/R2/R5/R6 executed, equivalence proof filed). **The arc is NOT closed** — this dispatch carries the open ledger: R3 decomposition, R7 blob census+semantics, R8 trending fields, multi-user attribution, read-site repairs, plus the four operator-ruled follow-ups.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Universal blocker unchanged:** value identity on both reference deals per step, checks PASTED. Standing rules: S1-01 · verify counts · both compile baselines · raw output in reports.

## B0 · Equivalence-comparand verification (gates B1)
From `docs/FP1_PHASE2A_CHECKPOINT.md`: state explicitly WHICH two bodies the 13,407-char identity compared.
- If server-fetch vs **the frontend's actual client body** (the React copy as shipped by the UI): gate passed, proceed to B1.
- If server-fetch vs the construct-script body (both store-sourced): the proof is weak — re-run against the real client body (capture one build from the running frontend, or reconstruct its body from `FinancialEnginePage` state serialization) and paste the comparison. The program has observed $1.36M vs $1.58M noiYear1 between body sources; the retirement in B1 executes only against the real comparand. Any difference found = evidence of the local-state divergence, captured and reconciled per operator note, THEN retire.

## B1 · #1872 — Retire the React client path (R4 step 3)
Server-fetch becomes the ONLY build path (`serverFetch` flag removed, not defaulted); client-supplied assumptions body rejected with a clear error naming the change; `FinancialEnginePage.tsx:579` working-copy WRITE path to /build deleted (display state may remain until F-P2). All frontend build triggers verified against the new contract (build button, Opus "Build the model", goal-seek, version load — the four init/write paths from the Phase-1 census). Identity checkpoint both deals after.

## B2 · R3 — Scenario decomposition with shadow-read
`deal_underwriting_scenarios.year1` blobs decompose into `deal_assumption_overlays` rows. Shadow-read verifier compares old blob vs recomposed overlay per deal-scenario, ALARMS on mismatch, runs through the confidence window (define it: N clean builds or M days, propose in report); then blob write path + sync trigger retire. Bishop's active scenario is the live test; paste one full decompose-recompose identity.

## B3 · R7 — Blob census + semantics migration (M-I)
1. Census the live 140-key `year1` blob against the W4c addendum map; REPORT uncovered keys before any rename.
2. Execute the semantics migration per addendum + census additions: in-place-class vs stabilized-class slots explicitly labeled; `resolved` retains its meaning with the R1 tag fix already applied.
3. Every blob reader from the Phase-1 census verified against the new labels (paste the reader list with per-site verdict).

## B4 · R8 — Trending schema, full set
Fields: `rent_growth`, `other_income_growth`, `expense_growth.{insurance, payroll, utilities, repairs_maintenance, contract_services, marketing, g_and_a, other}` — LayeredValue, four-door provenance slots, user-wins resolution. `real_estate_tax` EXCLUDED (tax engine owns it — enforce with a guard: generic trending path throws/flags if handed the tax key). Engine consumption: per-category growth applied in the monthly/annual expense computation (identity note: with all rates defaulted to current behavior, outputs must not move — paste the check). Exit-basis (`exit_valuation_basis`) engine consumption: disposition computes BOTH bases from the monthly series, pins the chosen one, evidence shows both — per the 2026-07-06 ruling.

## B5 · Multi-user attribution
`edited_by` (user_id) + `edited_at` on every user-layer assumption write (routes + overlay writes); append-only per-field history (write events queryable — propose the shape: table vs event log reuse); last-write-wins unchanged. No approval workflows.

## B6 · Read-site repairs (the four flagged, plus census additions)
roadmap-engine `baseNoi` → computed inPlaceNOI source · excel-export "Year 1 Stabilized" label → three-quantity naming · dashboard label fix · `cashflow.postprocess` fallback chain gains inPlaceNOI. Each with file:line before/after.

## B7 · #1873 — Column DROP, gated properly
R9's DROP executes ONLY after: (1) reader census of `irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1` PASTED — zero readers or every reader repointed with file:line; (2) one instance-level proof (rename-then-run smoke or equivalent) that nothing breaks. Irreversible ops get instance-level proof per standing discipline. Then DROP migration, then full regression.

## B8 · #1874 — TS-2 (separate mini-dispatch rules apply)
Now unblocked by the 7-field `monthlyProjection`. Execute T2 + T3 exactly as written in `TS1_THIN_SURFACING_PASS.md`: floor badge driven strictly off `floorBinding`; occupancy row in the grid; render-only; **frontend-only diff pasted as acceptance**; screenshots both deals; floor badge truthful to payload state.

## B9 · #1875 — NC millage-unit guard + the finding behind it
Install the unit guard at the R6b seam. AND answer: where did the 10x NC drift COME from — did the extraction expose a mills-vs-percent inconsistency that predates it in `computeNonFloridaTax`? If yes: that's a lettered finding (every historical non-FL tax estimate suspect) — name it, state the blast radius (which deals/states ever computed through that path), report. The guard is the fix; the finding is the record.

## ARC CLOSE CRITERIA
Phase-2B report shows: B0 comparand verdict · all six Phase-1 divergences with final dispositions · R1–R10 each marked executed-with-evidence · identity finale both deals · both baselines green · golden suite standing (Highlands+Synthetic green, Bishop skipped-pending-F5) · TS-2 accepted · the F-P1 findings ledger (A/B/C + anything new) closed or owned. Then F-P1 CLOSES with residuals named (F-P1t trigger model queued; anything else owned) and the roadmap updates: D3 next in chain.

## OUT OF SCOPE
F-P1t (next dispatch after close) · D3/CU/F-P2 · F5 (external clock; epoch note stands) · display-state refactor of FinancialEnginePage beyond the write path (F-P2's job).

**Order: B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → close report. STOP on identity failure or any divergence outside the known six.**
