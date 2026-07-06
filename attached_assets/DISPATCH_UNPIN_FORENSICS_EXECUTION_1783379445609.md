# DISPATCH — FIXTURE FORENSICS + HONEST UNPIN + T2/T3 EXECUTION + EXPANDED FIX-5

**Executor:** capture/verification agent (tests, fixtures, guard configs; engine items package to F5). Operator pushes batched commits if the sandbox blocks git writes — note which commits need his shell.
**Repo:** `Nardo758/JediRe.git` · backend port 4000 · context HEAD `0b7b922dc`
**Standing rules:** S1-01 pasted output per claim · verify counts, lists may be incomplete · no field enters a fixture without payload-sourced provenance (null-and-skip otherwise).
**Ledger corrections carried in (operator):** the dispatch's 54.4% margin figure was computed against the stale pinned NOI — 44.72% is correct; and the original P1 verdict extraction only pulled 5 of 12 fields, which is upstream of the fabricated pin. The per-field extraction requirement below exists because of that failure.

## U1 · Forensic — who changed the expected block? (FIRST, read-only)
The Finding-P order was explicit: capture effective assumptions, do NOT unpin/rewrite expected values. Original pinned noiYear1 = 2,632,193; the fixture now holds 2,161,807 and "passes."
1. `git log -p --follow -- backend/src/services/deterministic/__fixtures__/bishop.golden.ts` — identify every commit that touched the `expected` block, who authored it, and what changed. Paste the relevant hunks.
2. Verdict, one of: (a) the external agent's Finding-P commit rewrote expected values to match its new path — that is the prohibited adjust-expected-to-green move → record as STRIKE FOUR in the accountability log and lead item of the F5 header; (b) the values changed in some other traceable, authorized commit — document it; (c) the original pin itself wrote 2,161,807 and the 2,632,193 figure was only ever in the failure output — reconcile the history precisely.
3. Either way: the expected block's full provenance history goes in the report.

## U2 · Unpin Bishop — honestly
1. `bishop.golden.ts` → `expected: null` (auto-skip). Keep `rawAssumptions` + provenance intact; append: "UNPINNED 2026-07-06 — original pin partially fabricated (goingInCapRate was the input assumption copy-pasted, netProceeds and egiYear1 were flagged approximations; only 5 of 12 fields were ever payload-extracted) AND capital-structure output has moved ($21.0M→$26.6M loan) pending intentional-vs-regression ruling. Re-pin gated on F5 verdict + fresh full-payload capture with per-field extraction."
2. Fixtures README gains the rule with teeth: **every pinned field cites its extraction (payload path + capture file + date); a field not extracted is null-and-skip; "estimated/approximate/TBD" comments are prohibited in expected blocks.**
3. Golden suite run → expect green with Bishop SKIPPED (Highlands, SyntheticDegenerate, K-2, determinism all standing). Paste.

## U3 · T2 test fixes (proceed — independent of Bishop)
As previously authorized: INV-5 regex to K-2 wording · CAP_RATE_COMPRESSION exitCap recalibrated against current goingInCap (13.87%) with calibration-bound comment · dscrAtStabilization monthly-series check (series pasted; escalate to F5 if crossing ≠ Y1) · Westshore rent-growth recalibration to spec ~24.3% (escalate to F5 with search evidence if unreachable). Bridge suite re-run; expected residual failures = #3 (INV-10 dev) + #6 (isExitYear) + any escalations. Paste counts.

## U4 · T3 guard extension (proceed — operator-approved option a)
`backend/tsconfig.test.json` covering all test/fixture roots · second compile step in hook AND CI with its own ratcheting baseline (`tsc-baseline-tests.txt`, born at current count) · forced-failure proof: deliberate syntax error in a scratch file fails the guard, revert, both runs pasted.

## U5 · Expanded F5 package (`docs/dispatches/HANDOFF-FIX5.md`) — document only
**Lead item — capital-structure delta trace (NEW, with the operator's hand-math attached verbatim):**
> Current loan $26,606,851 = noiY1/(1.25 × rate) with noiY1 = 2,161,807 and rate = 6.5% — exact.
> July-5 live loan $21,024,006 = same formula with noiY1 ≈ 1,576,800 and rate = 6.0% — exact.
> BOTH M11 inputs changed between epochs. Trace: (a) what moved the debt rate 6.0% → 6.5% (assumption? ruleset? enhancement phase? body difference between captures?); (b) which NOI is M11 SUPPOSED to consume — pass-1's emergent noiY1 or an earlier/enriched figure — and which produced each epoch's value. Verdict required: INTENTIONAL (then Bishop re-pins against current output with the rationale documented) vs REGRESSION (then fix, and re-pin against corrected output). The Bishop re-pin is gated on this verdict.
Then, as previously packaged: **#6 isExitYear off-by-one** (confirmed, consumer enumeration required) · **#3 INV-10 dev-branch gap** · escalations from U3 · **accountability header** (raw output or it isn't a report; strikes on record — count updated per U1's verdict).

## U6 · Amended close-out gate
T5/close-out proceeds when: golden green **with Bishop honestly skipped** + U3 leaves only F5-owned failures + U4 guard proven. W5 then closes with THREE NAMED RESIDUALS and owners: (1) F5 engine items incl. capital-structure verdict + Bishop re-pin [external agent], (2) excel-parity [operator — list regenerates AFTER the Bishop re-pin so it carries defensible values], (3) CI-history verification [parked, needs gh auth]. Roadmap updated accordingly. Partial-close with named residuals; no silent close.

**Order: U1 → U2 → U3 ∥ U4 → U5 → U6. Report with pasted outputs; batch commits for operator push as needed.**
