# DISPATCH — Finding K Isolation + Bishop Partial Pin + W5 Close Sequence

**Arc:** F9 Underwriter Model — W5 pin ceremony, currently held at the Highlands build failure (Finding K).
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Roles:** test-tooling and read-only isolation = capture agent (in mandate); bridge/engine/route fixes = external agent (Claude Code) via handoff. No engine or route edits inside this dispatch.
**Standing rules:** S1-01 live evidence per claim. **NEW STANDING RULE (operator-ratified, from the canary mis-specification):** canary/regression gate values are PATH-BOUND — every gate must name the surface its expected values came from; comparing a seed-path canary to a build-path projection is a category error, not a finding.
**Filing note:** the build-boundary finding is **F-P1-A** ("build endpoint requires client-supplied assumptions; stored deal_assumptions not consultable — store bypassed"; handler `financial-model.routes.ts:512-515`, no server fallback, confirmed by authenticated probe). Filed under phase F-P1's ledger. The handler is NOT patched now — F-P1 kills both halves together (server-fetch as only path + React local copy deleted). Findings in phase F-P1 are lettered: F-P1-A (this), F-P1-B (noi.resolved provenance lie), onward.

## K1 · Finding K — paste, then tighten (read-only)
1. **Paste Finding K's full current text into the report** — its diagnosis has not reached the operator/architect; all sequencing below was ruled blind to its content.
2. Isolate to the failing hop with evidence: does the failure occur in (a) construct-build-body.ts building Highlands' payload from its stored row, (b) the bridge consuming it, (c) an engine phase, or (d) persist/response? Verbatim error + stack + file:line.
3. **Bisect the body:** if the full constructed Highlands payload fails, binary-search the fields — start from a minimal body that mirrors Bishop's shape, add Highlands' distinctive content (53-month actuals references, per_year_overrides, its expense vocabulary, any null-bearing blobs) until it breaks. The breaking field IS the diagnosis. Prior to kill or confirm: field-shape mismatch in construct-from-DB, not an engine defect — Highlands is the richest stored shape on the platform.
4. Classify: CONSTRUCT-SCRIPT defect → fix yourself (test tooling), re-run, K closes inline. BRIDGE/ENGINE defect → handoff package to external agent (minimal repro body attached) and note: the bridge choking on the platform's richest real deal implies thinner deals pass on luck — blocker-class priority.

## K2 · Seed-path canary — run NOW, independent of K
The REAL canary (alias/orphan-work guard). Hit the seed/deal-financials surface — the same endpoint every prior Highlands paste used — and confirm EXACTLY: NOI margin 57.17%, EGI 2025 $6,315,308, boundary 2026-04-01.
- HOLD → reference-asset ground truth intact; K is scoped to build/capture path only (note this in K's handoff — it's diagnostic).
- MOVEMENT → STOP everything; paste the delta + which expense keys resolved differently under the 3-tier lookup; operator rules before any pin.

## K3 · Bishop partial pin (proceed regardless of K)
1. Populate `bishop.golden.ts` from the already-captured extraction: rawAssumptions (store-sourced body), expected 12 fields, provenance (build route, construct-from-DB, commit hash, F-P1-A context).
2. `highlands.golden.ts` stays `expected: null` (auto-skip) with a comment: "pending Finding K — <one-line diagnosis>".
3. Commit: "Pin Bishop golden fixture — build path, store-sourced body; Highlands pending Finding K". Push. Run suite: expect **7/8-equivalent** (6 + golden-Bishop green, golden-Highlands skipped, parity skipped).
4. **Explicit non-closure:** W5 does NOT close on Bishop alone — Highlands is the degenerate-case blocker by standing ruling. Partial pin ≠ partial acceptance; the runbook stays open at the canary gate.

## K4 · Close sequence (executes as K resolves)
1. K fixed (by whichever agent K1.4 assigned) → Highlands builds clean via construct-from-DB body.
2. **Build-path plausibility check on Highlands' model output** (pin-candidate judgment, NOT the seed canary): model Y1 near stabilized run-rate (turn engine degenerate, floor binding from m1), opex ratio in-band, no unexpected _unmatchedOpexKeys/_orphanedOpexKeys. These values become the golden expected — they were never supposed to equal the seed canary (path-bound rule).
3. Populate `highlands.golden.ts`, remove the pending comment, commit ("Pin Highlands golden fixture — Finding K resolved: <cause>"), push.
4. Full suite: **8/8** (excel-parity remains the sole skip, oracle pending).
5. Runbook Phases 2–3: smoke shapes on the real deals (Bishop climbing with floor-transition month noted; Highlands steady, floor binding m1), consumer matrix one-value-everywhere, D1 behavioral + T2 forced cache-hit if still open.
6. Regenerate the parity list from pinned Bishop values (field, year, expected format) → surface as the fill-in-the-blanks ask for the operator.
7. **W5 CLOSES** on: 8/8 + Phases 2–3 green + seed canary held. Unlocks TS-1 immediately; F-P1 queues behind it with its lettered findings ledger (A, B, …) as opening scope.

## OUT OF SCOPE
`financial-model.routes.ts` (F-P1-A rides to F-P1) · any engine edit from within this dispatch · fixture pinning from direct-runModel on synthetic assumptions (disqualified path, standing) · excel-parity (oracle-gated).

**Order: K2 now · K3 now · K1 in parallel · K4 as K clears. Report: K's full text + canary verdict + suite count.**
