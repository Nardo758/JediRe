# DISPATCH — Golden Repair + Guard Forensics + Bridge Triage (W5 Close-Out, Resumed)

**Executor:** capture/verification agent. Fix authority: test files + test tooling ONLY. Engine files remain external-agent territory — anything the triage pins on engine code becomes a finding, not a fix.
**Repo:** `Nardo758/JediRe.git` · backend port 4000 · HEAD context: `849ae954f` (contains `8d52513d5`)
**Standing rules:** S1-01 — every claim in your report carries pasted command output. New standing rule (effective now, all agents): **a completion report without the actual suite output pasted is not a completion report** — this is the external agent's third false claim, and this one shipped unparseable code under a green banner.

## G1 · Repair the golden-file corruption (AUTHORIZED)
1. `golden-deals.test.ts` lines ~81–85: delete the orphaned `assertGolden(...)` line and the extra `});`, restoring brace balance. Nothing else changes in the file.
2. Commit: "repair merge corruption in golden-deals.test.ts (merge-artifact incident #5)". Push.
3. Run the golden suite. **Paste the full output.** This is the priority result of the dispatch: Bishop's verdict tells us whether the external agent's Finding-P fix (effective-assumptions capture at the runFullModel boundary) actually works — expected pass if the delivered commits implemented the input-contract fix; expected the $2,632,193-vs-$2,161,807 gap again if they didn't. Either way, report — do not adjust pinned values.

## G2 · Guard-scope forensics (why did unparseable TS reach master?)
A syntax-broken .ts file landed on master under a passing claim. Determine which hole let it through — check all three:
1. Is `golden-deals.test.ts` (and test files generally) inside the tsconfig scope the guard compiles? (`tsc --noEmit` from the guard's invocation — does it even see __tests__/?)
2. Did CI run on `8d52513d5`? Paste the workflow run status.
3. Was the push made with the hook bypassed or from an environment without hooks configured (`core.hooksPath`)?
Report the hole with evidence + the one-line fix proposal (widen tsconfig scope / CI on all pushes / hook config). Do NOT implement guard changes without operator sign-off — guard behavior is policy.

## G3 · Three-way triage of the 6 bridge failures
Verdict per failure: PRE-EXISTING-ASPIRATIONAL (test written against unbuilt spec) / REGRESSION (worked before recent commits) / TEST-BUG. Pre-classifications from program history — verify, don't assume:
| Failure | Prior | What to verify |
|---|---|---|
| INV-5 message drift (`/cannot verify/i`) | TEST-BUG — K-2 deliberately rewrote INV-5 behavior + message | New wording matches the K-2 ruling (ERROR in every mode, structural-impossibility text) → update regex |
| dscrAtStabilization 2.61 vs 2.71 | AMBIGUOUS — W3/W4 intentionally changed the stabilization-year heuristic (actual month occupancy crosses band, not vacancy-schedule guess) | Which year each method selects + which is correct per the monthly series. If new heuristic right → test update with the series pasted |
| INV-10 fires on dev deal | AMBIGUOUS — INV-10 was redefined (month-weighted) in turn-cohort work; dev branch kept old machinery | Was dev path supposed to be exempted? If engine gap → FINDING for external agent, not a test edit |
| CAP_RATE_COMPRESSION at exactly 50bps | Boundary ruling (operator): INCLUSIVE — a warning fires at its own threshold (>=) | Fix whichever side disagrees; if engine side, it's a one-line finding |
| Westshore IRR 2.27% vs ≤1% | UNKNOWN | Trace what changed the IRR + whether the 1% bound is spec'd or a test author's guess. Evidence before verdict |
| (6th failure as listed in your run) | UNKNOWN | Same treatment |
No test edited to green without its classification stated in the commit message.

## G4 · Accountability note (deliver with the report)
The external agent's next assignment carries this header: all completion reports must paste the raw output of every suite claimed. Claims of "N pass / 0 fail" against non-executable files are process violations; three strikes are on record (Fix-4 push claim, capture-body claim, this).

## G5 · Resume the close-out (only on G1 green + G3 resolved)
If Bishop passes post-repair: proceed directly to DISPATCH_W5_CLOSEOUT.md P2–P6 (full suite, Phases 2–3 incl. D1/T2 debts, parity list, roadmap update, close declaration). If Bishop still fails on the input-contract gap: STOP after G1–G4 and report — Finding P goes back to the external agent with your output attached.

**Order: G1 → G2 ∥ G3 → G4 → G5. Report with pasted outputs throughout.**
