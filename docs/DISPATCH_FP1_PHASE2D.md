# DISPATCH — F-P1 PHASE 2D: Close the Arc (Real Equivalence + TS-2 Acceptance + Decomposition Keystone)

**Arc:** F-P1 store consolidation — final dispatch. Three items stand between here and honest close: C0's equivalence was never actually proven (self-comparison), C2's TS-2 lacks real acceptance artifacts, and C6 (the namesake decomposition) is deferred. F-P1 closes when this closes.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Universal blocker:** value identity both reference deals, checks PASTED. Standing rules: S1-01 · verify counts · both baselines · raw output · irreversible ops proven before execution.

## D1 · C0-REAL — the equivalence forensic that was skipped
**Correction on record:** Phase-2C's C0 "PASS" compared the server-fetch body against itself (same blob, same row, read twice). That proves deterministic reads, NOT that server-fetch assumptions equal what the retired React client path shipped. B1 retired the client path on an unproven equivalence — recorded as: **F-P1-A equivalence was ASSUMED, not proven.** Recover the proof from history:
1. Pull the `assumptions` snapshot from a PRE-RETIREMENT `deal_financial_models` row (a real client-shipped body, frozen before B1 landed) for Bishop — and Highlands if one exists.
2. Diff it field-by-field against the current server-fetch body for the same deal.
3. **Identical** → equivalence proven retroactively; F-P1-A closes clean; note it.
4. **Divergent** → this IS the local-state leak B0 was built to catch. Paste every differing field with both values. Rule per field whether server-fetch (store truth) or the old client value was correct; if any client-only value was right, that's a store gap to backfill. Record as a finding regardless — the divergence is real history even if harmless now.
If no pre-retirement snapshot survives in any build row: state that plainly (evidence destroyed by retirement timing) — the assumption stands unprovable, logged as a permanent gap, not a pass.

## D2 · C2-REAL — TS-2 acceptance artifacts
Code-diff is not acceptance. Produce:
1. `git diff --stat` — frontend-only (paste).
2. Screenshots of BOTH deals' ProForma showing the floor badge in its ACTUAL per-period state.
3. **Resolve the suspicious "floorBinding true for both deals":** Bishop in early lease-up should show floor DORMANT (physical vacancy above the 5% floor); Highlands steady-state should BIND. If both genuinely bind, explain from the payload why Bishop's early-period physical vacancy is already below floor (paste the per-month `floorBinding` + `effectiveVacancy` series). If the badge is reading one aggregate instead of per-period state, that's a T2 bug — fix within render-only scope (read the right field) or report if it needs the payload changed.
4. Occupancy row (T3) visible in the grid, value spot-checked vs `monthlyProjection`.

## D3 · C6 — Scenario decomposition (the keystone; R-C6-1..7)
The consolidation the arc is named for.
1. **Overlay schema completion (R-C6-1):** `deal_assumption_overlays` gains `scenario_id`, `superseded_by` (+ the attribution cols from C4 already present). Migration + dark verification.
2. **Decompose + recompose functions (R-C6-3):** `deal_underwriting_scenarios.year1` blob → overlay rows; recompose reconstructs the blob from rows. Round-trip is the correctness contract.
3. **Shadow-read verifier (R-C6-4):** on every read that touched the blob, compute both blob-path and overlay-path, ALARM on mismatch. Runs the confidence window.
4. **Bishop identity test (R-C6-5):** Bishop's active scenario — full decompose → recompose → identity, PASTED. Values byte-match the pre-decomposition blob.
5. **Highlands (Phase-1 finding):** zero active scenarios — CONFIRM decomposition correctly no-ops (nothing to decompose), don't let a silent skip masquerade as success.
6. **Confidence window (R-C6-6):** 10 clean builds OR 7 days, shadow-read alarm-free.
7. **Retire blob write path + `trg_sync_underwriting_scenario` trigger (R-C6-2, R-C6-7)** ONLY after the window is clean. This is the moment `deal_underwriting_scenarios` stops being an assumption store. Identity finale both deals after.

## ARC CLOSE — F-P1 (for real)
Report shows: D1 verdict (proven / divergence-recorded / unprovable-gap-logged) · D2 artifacts (screenshots, badge state explained) · D3 decomposition complete with Bishop round-trip identity pasted + window clean + trigger retired · four stores now ONE canonical + overlays (state it: what each former store is now) · R1–R10 all closed · six Phase-1 divergences final disposition · both baselines green · golden standing · F-P1 findings ledger (A/B/C + C0-real finding if any) closed or owned.
**Then F-P1 CLOSES.** Residuals named and queued: F-P1t (tax trigger model), F5 (external clock — Bishop re-pin). Roadmap updates: **D3 (agent assumption seam) becomes ACTIVE** — the payoff arc.

## OUT OF SCOPE
F-P1t · D3 execution · CU/F-P2 · F5 · FinancialEnginePage display refactor.

**Order: D1 → D2 → D3 → close report. STOP on identity failure, a decompose round-trip mismatch, or a divergence outside the known six. No "closed" without every artifact pasted.**
