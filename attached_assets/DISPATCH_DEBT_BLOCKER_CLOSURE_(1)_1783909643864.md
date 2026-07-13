# DISPATCH — DEBT-LAYER BLOCKER CLOSURE (Q3.3 is the Gate)

**Why:** B5/B6 were built BEFORE their four blockers closed — the sequence inverted. The bot's own "Next Steps" (Q3.3, U, W, Z) ARE the CONDITIONAL in the CONDITIONAL-GO verdict. One dependency is circular: **B5 derives IO from `monthsToStabilize` (Finding Z), and Z is still open** — so B5's headline feature computes off a possibly-`?? 12`-defaulted field. B5/B6 are "landed, pending closure," not "done." This dispatch closes the conditions, in the order that de-risks the most first.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. **Requires DB** (Q3.3/Z need live builds — if no DATABASE_URL, STOP at the gate and say so).
**Standing rules:** S1-01 — pasted LIVE output, not unit tests, not commit claims · `git log --oneline origin/master -1` from deploy env is the only proof · **tests passing ≠ correct when the input is defaulted** · verify counts.

## GATE · Q3.3 — the thesis proof (do FIRST; everything downstream depends on it)
The entire debt arc exists to make ONE claim true: **a user's actual loan terms change the model.** This has been unit-tested but NEVER proven on a live build. Prove it now or the arc is machinery that doesn't reach the model.
1. **Live build, same deal, two term configs:** run a real build with a **5-year** term, then a **7-year** term (or 10-year IO vs no IO), on Bishop or a test deal. Everything else identical.
2. **Paste both debt schedules.** The amortization and balloon MUST differ visibly. Paste loan · equity · IRR · EM · DSCR for each.
3. **VERDICT:**
   - **Schedules differ** → Finding X is PROVEN closed, the rail works end-to-end, proceed to Z.
   - **Schedules identical** → **STOP THE ARC.** The term never reached the schedule; B3's fix is incomplete; B5/B6 are built on sand. Report the exact line where the term is dropped. Do not proceed to any other item.

## Z · Finding Z — `monthsToStabilize` real source (validates B5 retroactively)
`deterministic-model-runner.ts` reads `a.monthsToStabilize` (lines ~843/848/1028/1029); it's not declared on `ModelAssumptions` and is `?? 12`-defaulted. **B5's IO-from-lease-up derivation and the float-to-fixed transition both key on this field** — until it's real, B5 is computing off a placeholder.
1. Declare `monthsToStabilize` on `ModelAssumptions` (clears the 6 tsc errors).
2. **Wire it to the turn-cohort engine's ACTUAL stabilization month** — the month occupancy crosses the stabilized band (the engine already computes this for the annual-row / stabilizedNOI logic). Source it from there, not a default.
3. **Rule the `?? 12` fallback:** keep it as a last resort BUT **log when it fires** (`[Z] monthsToStabilize defaulted to 12 — no stabilization month from engine`). A fabricated stabilization must be visible, never silent.
4. **Re-validate B5:** with `monthsToStabilize` real, re-run B5's IO-derivation test AND a live build — does the IO period now derive from the true stabilization month? Paste. This is what makes B5 "done" rather than "provisional."
5. Confirm the tsc baseline DROPS by 6 (the `monthsToStabilize` errors resolved) — or explain why not.

## U · Finding U — one DSCR truth
1. Paste the engine's `debtMetrics.dscr` formula AND the capital-structure route's DSCR formula.
2. The route historically computed `noi / (loan × rate/100)` — interest-only + a ÷100 bug. Engine DSCR is now amortizing (per B4). **Are they ONE truth now, both amortizing?** If the route still carries IO/÷100, fix it. One DSCR, everywhere.
3. Paste Bishop's DSCR from both paths — they must match.

## W · Finding W — bridge double-conversion coverage
The golden path now bypasses the bridge, so the `4320 = 360×12` double-conversion has no coverage.
1. Confirm the double-conversion is fixed (where?).
2. Add a **standalone bridge unit test**: given a store `financing` object with known units, assert `ModelAssumptions.term/amort/ioPeriod` are correct months, converted exactly once. **Forced-failure proof** — must fail against pre-fix code, pass after. Paste both runs.

## CHECK · The 32 pre-existing failures
"Not from our changes" is a claim, not a verification.
1. Paste the list of 32 failing test files.
2. Confirm NONE live in files this arc touched: `capital-structure-adapter.ts`, `deterministic-model-runner.ts`, the bridge, `debt-context*`, `loan-product.ruleset.ts`, the loan-quote scaffold. If any do, they're not pre-existing — investigate.

## ACCEPTANCE / RECORD
- **GATE Q3.3:** two schedules pasted, differ visibly, verdict stated. (If identical → arc STOPPED, B3 reopened, nothing else runs.)
- **Z:** field declared + wired to real stabilization month + `?? 12` logs on fire + B5 re-validated live + baseline −6.
- **U:** one DSCR formula, both paths match on Bishop.
- **W:** double-conversion fixed + standalone test with forced-failure proof.
- **CHECK:** 32 failures enumerated, none in arc-touched files (or investigated).
- **On all green: B5/B6 flip from "landed-pending" to DONE.** Then — and only then — the Loan Quote spec has a proven foundation. Record: debt arc B1–B6 complete, blockers closed, new Bishop epoch (from Q3.3/B4) documented with cause.

## OUT OF SCOPE
Loan Quote spec BUILD (waits on this) · F5-2 re-pin · D3-W6 · Finding Y blast-radius SQL (separate, operator-run) · touching Highlands/Synthetic pins.

**Order: GATE Q3.3 → Z → U → W → CHECK. The gate is absolute: if the 7-year term doesn't change the live schedule, STOP and report — do not close Z/U/W against a broken rail.**
