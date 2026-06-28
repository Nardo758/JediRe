# RE-VERIFICATION DISPATCH: custom-metric rows in the grid (BUILD NOTHING — prove the render)

The feature was closed on code-reading + a backend logic trace, with the acceptance number **substituted mid-run** (59.31% target abandoned for a self-computed ~6.27% when real Highlands data didn't fit the fixture). That's verifying output against a number produced in the same pass — it checks the code agrees with itself, not that it's correct. The rollup trap (ratio summing to ~75% vs re-deriving to ~6.27%) is only catchable against a target established *independently, beforehand*. And the grid was never actually seen rendering — "I can't click the screenshot tool" is where it stopped. This pass fixes only the proof. Build nothing. STOP at the report.

---

## V1 — Establish the correct annual value INDEPENDENTLY (before looking at any render)

The target must exist before the render is examined, derived from data, not from the code under test.

- Pick the metric to verify: `noi_margin` (= noi / egi) on Highlands, OR reconstruct the original 59.31% Debt Yield fixture on a deal with clean inputs. State which.
- Compute its correct annual value **by hand from the DB**, not from `computeCorrectAnnualSeries`:
  - Pull the 12 monthly `noi` and `egi` values for one actual year (e.g. 2025) straight from the periodic seed — paste the raw rows.
  - Do the annual re-derivation yourself in SQL or by hand: annual NOI ÷ annual EGI (re-derived, NOT the average of monthly ratios, NOT the sum).
  - Write that number down. **This is the truth value.** Paste the arithmetic.
- Also compute the **wrong** value the trap would produce (sum of the 12 monthly ratios) — so you know what a FAIL looks like on screen.

## V2 — The EGI units question (answer it, don't absorb it)

The build noted "EGI looks wrong — stored as annual constant ~$4.78M, not monthly" and reframed around it. Resolve it:
- Paste the 12 monthly EGI values from Highlands' periodic seed for one year. Are they 12 copies of the annual figure (~$4.78M each), or real monthly values (~$398k each)?
- **If they're 12 copies of the annual number:** the re-derive path sums them → 12× EGI for the year → every EGI-based ratio's annual value is wrong by 12×. Confirm what `computeCorrectAnnualSeries` actually produces for the year against your V1 hand-computation. Is the annual `noi_margin` correct, or 12×-off?
- This is a data-integrity question in the seed, upstream of the grid. Report it as its own finding: is EGI stored wrong, and does it corrupt the annual ratio? Do not paper over it with a monthly ratio that happens to cancel.

## V3 — Actually see the rendered grid (the check that never happened)

Code pulling `annualSeries` is not the same as the right number on screen. Get the grid visible — the screenshot tool couldn't click tabs, so use a proven workaround from earlier in this program:
- Deep-link or force the F9 ProForma default tab (the V2-close used temp default-tab changes + HMR), OR dump the rendered DOM of the PeriodicGrid, OR any method that puts the actual `noi_margin` row on screen.
- Capture: the `noi_margin` row, its year-column value for the year you hand-computed in V1, with the ◆ glyph, on the reachable F9 `full` mount.
- **Compare the rendered year value to the V1 truth value.** They must match. If the rendered value equals the V2 *wrong* (summed) figure → FAIL, the rollup trap reached the display layer. Paste rendered-next-to-truth.

## V4 — Year ≠ sum-of-months, on screen

- Expand the same year on the `noi_margin` row → 12 month cells.
- Confirm the year-column value ≠ the sum of the 12 month cells, AND equals the V1 hand-derived annual re-derivation. Paste the year value and the 12 month values so the arithmetic is checkable.
- A ratio row whose year column sums its months is the artifact — naming it explicitly: year must equal re-derived annual, not Σ(months).

## V5 — Monitoring mount + glyph

- Confirm the metric row also renders on the `monitoring` mount (Asset Hub), same value, with the ◆ glyph distinguishing it from system P&L rows. Screenshot.

---

## Report

| Item | Closes when |
|---|---|
| V1 | correct annual value hand-derived from DB rows, paste arithmetic — the independent truth |
| V2 | EGI units resolved: real monthly or 12× annual; annual ratio correct or 12×-off (its own finding) |
| V3 | `noi_margin` row SEEN on F9 mount, rendered year value == V1 truth (not the summed wrong value) |
| V4 | year ≠ Σ(months) AND == re-derived annual, on screen, arithmetic pasted |
| V5 | renders on monitoring mount with glyph |

**Blockers: V3 (rendered == independently-established truth) and V2 (EGI not corrupting the ratio).** The feature is not done until the right number — established before the render, from data — is seen on screen. A self-computed target checked by reading code is the exact gap that's hidden a bug at every prior stage of this program. Build nothing; if V2 or V3 fails, report the bug, don't fix it in this pass — the fix is a separate gated step. STOP after reporting.

---

**Why independent-target-first:** 712%-vs-59.31% was catchable only because 59.31% was trusted in advance. The moment the target is computed by the same run that renders it, a wrong render and a wrong target agree and the trap is invisible. So V1 (hand-derive the truth) happens before V3 (look at the screen), and the truth comes from DB rows, never from `computeCorrectAnnualSeries` — the function under test cannot also be the answer key.
