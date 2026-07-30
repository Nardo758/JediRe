# DISPATCH — D3 PROOF (b) REBUILD-PATH DEFECT CHAIN (Phase 1: READ-ONLY)
**Run from:** desktop checkout. `git log --oneline origin/master -1` — record hash.
**Rules:** S1-01 · read-only · map the WHOLE chain, fix NOTHING · STOP at the gate.
**Scope:** narrow — only the "subsequent build" path that proof (b) exercises. Not a general audit.

## THE QUESTION
Proof (b) = "agent_confirmed write survives a subsequent build." It has now failed twice with the SAME SHAPE at different depths: first `model_type` NULL (fixed via carry-forward), now `closingCosts` undefined in the F9 verifier. Hypothesis: **the subsequent-build path assembles a PARTIAL object the first build assembles fully** — one root cause emitting many undefined-access symptoms. This audit confirms or refutes that in one pass, and maps every remaining undefined-access landmine on the path so the fix is complete, not incremental.

## TASKS

**T1 — Trace the two build paths side by side.** Proof (b) does: build once → write agent_confirmed overlay → build AGAIN → verify. Find both build entry points (file:line). The first build clearly produces a complete object (proof (a) passes, (e) golden passes). The second build is what fails. Paste: what function the rebuild calls, and how its input assembly DIFFERS from the first build's. Specifically — does the rebuild re-hydrate the full deal context, or does it operate on a reduced/overlay-only payload?

**T2 — The undefined-access inventory (the landmine map).** On the rebuild path ONLY, list every property access that assumes an object the rebuild may not populate. Start from the two known (`_concessionsOperatorOverride` at the Batch6 site, `closingCosts` at the F9 verifier site — paste both file:lines and what object each hangs off). Then trace forward: what else does the F9 verifier read, and what else does the rebuild's consumer chain touch, that the first build populates but the rebuild might not? Produce the ordered list — these are the sequential failures we'd otherwise hit one round-trip at a time.

**T3 — Root-cause test.** For the top 3 undefined objects from T2, trace where the FIRST build populates them (file:line) and confirm whether the rebuild path invokes that same population step. Verdict per object: `rebuild skips the populator (structural)` vs `populator runs but input differs (data)` vs `genuinely optional (guard is correct)`. If ≥2 trace to the same skipped populator, the hypothesis holds — ONE fix (invoke the populator / hydrate fully on rebuild) clears the chain, and per-field `?.` guards would be WRONG (they'd mask the structural gap).

**T4 — The verifier's own assumption.** F9 integrity verifier: is it correct for it to require `closingCosts`, or is it running against a payload shape it shouldn't see on a rebuild? (i.e., is the bug in what the rebuild PASSES, or in what the verifier DEMANDS?) file:line of the verifier's requirement.

## STOP
Output = both build paths traced (T1), the ordered undefined-access landmine list (T2), root-cause verdict (T3), verifier-assumption call (T4), and ONE recommendation: single structural fix vs. genuine multi-fix. Do NOT add `?.` guards, do NOT hydrate defensively, do NOT re-run proofs with patches. Leon rules on the fix shape, then a Phase 2 dispatch implements it with the (b)→(d) chain as the proof obligation.
