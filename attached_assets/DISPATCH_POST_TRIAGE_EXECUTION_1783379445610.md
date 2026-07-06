# DISPATCH — POST-TRIAGE EXECUTION: Fixture Correction + Test Fixes + Guard Extension + Fix-5 Handoff

**Executor:** capture/verification agent (test files, fixtures, test tooling, guard configs). Engine items are packaged for the external agent in F5 — do not fix them here.
**Repo:** `Nardo758/JediRe.git` · backend port 4000. Context: G1 repair committed and pushed by operator; golden currently 4/5 (Bishop fails only on the egiYear1 placeholder).
**Standing rules:** S1-01 pasted output per claim. Lists in this dispatch are believed complete but VERIFY COUNTS — flag anything found beyond them (new standing practice per G4).

## T1 · egiYear1 correction (pin-discipline repair)
1. If `/tmp/bishop_final.json` survives: extract its EGI and confirm it matches the engine's $4,833,796.45 (test-path output on pinned effective assumptions). If the tmp file is gone: the test-path value stands — determinism + the passing noiYear1 prove the input contract reproduces the live build.
2. Pin `egiYear1: 4833796.45` (exact captured precision) in `bishop.golden.ts`. Provenance line: "corrected 2026-07-06 — original value was an unverified estimate (pin-discipline violation); captured from runFullModel on pinned effective assumptions post-Finding-P; sanity: NOI/EGI margin 54.4%, opex ratio in-band."
3. Add to the fixtures README (create if absent): **"No field enters a fixture as an estimate/TBD. Unverifiable fields stay null and the assertion skips. Every pinned value carries capture provenance."**
4. Run golden suite → expect **5/5**. Paste output.

## T2 · Test-bug fixes (authorized, from the triage verdicts)
1. **INV-5 regex (#1):** update to match the K-2-era message ("INV-5 exitCap (0) ≤ 0 [mode=…] — bridge always provides a default; this indicates a model defect" — match on stable substring, not full text). Commit message states the classification: TEST-BUG, K-2 ruling predates test.
2. **CAP_RATE_COMPRESSION calibration (#4):** recompute the test's `exitCap` against the engine's CURRENT goingInCap for that fixture (13.87%) so the test exercises what its comment claims (a sub-50bps gap for the negative case, a >50bps gap for the positive). Add comment: "calibration-bound to engine output — recompute on intentional NOI-path changes."
3. **dscrAtStabilization (#2):** pull the fixture's monthly occupancy series from the model output; identify the month occupancy crosses the stabilized target; paste the series segment. If crossing lands in Y1 → update the test to expect the Y1 DSCR with the series pasted in the commit. If crossing is NOT Y1 → STOP on this item, reclassify as engine finding, append to F5.
4. **Westshore recalibration (#5):** re-derive the rent-growth input that hits the spec's ~24.3% IRR against the current engine. If a plausible input reaches it: update + comment "calibration-bound." If no plausible input reaches the spec target: STOP, append to F5 with the search evidence (the engine moved something it shouldn't have).
5. Re-run the bridge suite. Expected: 6 prior failures reduced to the 1–2 engine-side items (#3, #6) + anything T2.3/T2.4 escalated. Paste counts + remaining failure list.

## T3 · Guard extension — option (a), operator-approved
1. Create `backend/tsconfig.test.json`: extends the main config; `include`: `src/**/__tests__/**/*.ts`, `src/**/__fixtures__/**/*.ts`, `tests/**/*.ts` (verify actual test roots and cover all of them).
2. Add a second compile step to BOTH `.githooks/pre-push` and `.github/workflows/typecheck.yml`: `npx tsc --noEmit --skipLibCheck -p backend/tsconfig.test.json`, baseline-diff mode with its OWN baseline file (`tsc-baseline-tests.txt`, born at whatever the current count is — same ratchet rules: new errors fail, shrinkage celebrated).
3. Prove it: introduce a deliberate syntax error in a scratch test file → guard fails → revert. Paste both runs. (This is the forced-failure proof — the exact escape class of incident #5 must now be impossible.)
4. Note in the report: CI-ran-on-8d52513d5 remains unverified (no gh auth) — parked, not forgotten; the tsconfig hole fully explains the escape regardless.

## T4 · Fix-5 package for the external agent (document only — `docs/dispatches/HANDOFF-FIX5.md`)
Contents, with your triage evidence attached verbatim:
1. **#6 isExitYear off-by-one (REGRESSION, confirmed):** two `nYears` in colliding scopes — line ~1724 `nYears = hold + 1` reused at ~1879 `row.isExitYear = y === nYears`, but the turn-cohort annual loop produces y = 1..holdYears only. Exit flag unsatisfiable on the acquisition path. Fix + a test asserting exactly one exit row per model. Note: disposition math computes independently (live Bishop disposition was correct) — but every consumer of `isExitYear` is silently wrong; enumerate consumers in the fix report.
2. **#3 INV-10 on dev deals (ENGINE GAP, likely):** dev-branch annual occupancy aggregation doesn't match month-weighted INV-10 redefinition; the construction-row exemption (`gpr<=0 && occupancy===0`) is too narrow for lease-up years. Trace the failing row, align dev-branch occupancy aggregation or widen the exemption per the invariant's intent — their call, with evidence.
3. **Escalations from T2.3/T2.4 if any.**
4. **Accountability header (standing):** all completion reports paste raw suite output; claims without pasted output are not reports — strike three is on record.

## T5 · Close-out resumption (only when T1 golden 5/5 AND T2 leaves only F5-owned failures)
Execute `DISPATCH_W5_CLOSEOUT.md` P2–P6 as written: full suite counts → runbook Phases 2–3 (smoke shapes, consumer matrix, **D1 behavioral + T2 forced cache-hit — close or name the blocker**) → regenerate `docs/EXCEL_PARITY_ORACLE_REQUEST.md` from the corrected pinned values (egiYear1 now included) → roadmap updated → **declare W5 CLOSED except the F5 engine items and excel-parity (operator-gated)**, listed as named residuals with owners. Partial-close with named residuals is honest; silent-close is not.

## OUT OF SCOPE
Engine edits (#3, #6, escalations — F5/external agent) · guard changes beyond option (a) · excel-parity execution · unpinning anything.

**Order: T1 → T2 → T3 → T4 → T5. Commits batched for operator push if sandbox blocks persist (note which). Report with pasted outputs throughout.**
