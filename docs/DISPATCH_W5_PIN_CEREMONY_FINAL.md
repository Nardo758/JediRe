# DISPATCH — W5 Pin Ceremony, Final: Gated Capture → Pin → Close

**Arc:** F9 Underwriter Model — W5 close. Findings K (exit-year off-by-one) and K-2 (INV-5 severity) reported fixed; Finding L (stale summary/debtMetrics after M11/M14 resize) reported fixed. None of those claims is accepted until Gate 0 evidence lands.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Roles:** capture agent runs everything here except engine edits; if any gate fails, STOP and report — no fixing engine code from inside this dispatch.
**Standing rules:** S1-01 live evidence. Path-bound gates (every expected value names its source surface). Fixtures pin once, correctly — no partial pins, no pin-now-repin-later.

---

## GATE 0 — Prove the L fix (before anything else)
1. Confirm WHICH fix shipped: the ruling was **assemble-once** — the response envelope (`summary`, `debtMetrics`, `evidence`, `reasoning`, all of it) built ONCE after every mutation pass (M11/M14 included), from final state. Paste the commit hash + the file:line of the single assembly point. **If the shipped fix is the piecemeal patch (refreshing two fields at the evidence-refresh point), STOP — it goes back to the external agent; the piecemeal option was rejected.**
2. Live Bishop rebuild (store-sourced body, `POST /api/v1/financial-model/build`, Bearer auth). Paste from ONE payload:
   - `data.summary` loan amount, DSCR, IRR, EM
   - the narrative/reasoning's description of the same figures
   - the post-resize debt schedule's loan amount
   **Pass = all three agree on the post-resize deal (~$21M loan, DSCR ~1.04-class, real IRR/EM). Any internal disagreement = L not fixed, STOP.**

## GATE 1 — Fix the capture script's extraction paths (test tooling, in mandate)
The script's jq paths assume `modelResults.*`; the live response shape is `data.*` (`data.summary`, `data.annualCashFlow[]`, `data.evidence.fields[]`). This produced the false "opex ZERO / CANARY FAILED" result last run. Patch every extraction path, commit, and prove with one extraction against the Gate-0 payload: 12 fields, all populated, no nulls-from-wrong-path.

## GATE 2 — 12-field plausibility, ALL twelve
From the Gate-0 Bishop payload:
| Class | Checks |
|---|---|
| Operating | noiYear1 strictly between in-place (~$857K-class) and stabilized endpoints; egiYear1 consistent; opex ratio in ~35–50% band |
| Debt | totalDebt == post-resize loan; dscrY1 from THAT schedule (~1.0x-class, not 0.674); cashOnCash consistent with resized equity |
| Disposition | stabilizedNOI nonzero; exitValue ≈ stabilizedNOI ÷ exitCap; netProceeds = exitValue − selling costs − payoff; IRR and EM real numbers plausible for the deal shape |
Paste the table with verdicts. **Any implausible field = STOP with the field named.** The "8 clean fields" partial read is retired — L proved it wrong.

## GATE 3 — Path-bound capture (Bishop ≠ Highlands)
- **Bishop = build path.** The Gate-0 payload IS the capture (don't rebuild a third time; same payload that passed Gates 0/2 supplies the pin values).
- **Highlands = seed path, NO build.** Standing ruling (Finding K doctrine): `owned_import`, no `deal_assumptions` row, never enters the build pipeline. Its golden values come from the seed/deal-financials surface: NOI margin 57.17%, EGI 2025 $6,315,308, boundary 2026-04-01 (+ whatever seed-derived fields complete its fixture shape). Fetch fresh, confirm they still hold exactly, capture from that payload. **Running Highlands through the build script is a dispatch violation.**
- **Synthetic degenerate fixture:** already pinned and green — untouched.

## GATE 4 — Provenance riders (in the pin commit, not after)
1. **F-P1-A body diff:** if the earlier frontend-shipped body still exists in /tmp, diff it against the store-sourced body and log which assumption fields differ (explains noiYear1 $1,357,881 vs $1,576,800-class). If gone: log "frontend body unavailable — reconstruct at F-P1." Either way it enters the findings report.
2. Bishop fixture provenance: store-sourced body · build route · L-fix commit hash · "assemble-once" noted · capture timestamp.
3. Highlands fixture provenance: seed path · origin `owned_import` · "no build path by design (Finding K doctrine)" · capture timestamp.

## PIN + CLOSE SEQUENCE
1. Populate `bishop.golden.ts` (build-path expected + rawAssumptions + provenance) and `highlands.golden.ts` (seed-path expected + provenance). One commit: "Pin golden fixtures — Bishop build-path post-L, Highlands seed-path; gates 0–4 passed."
2. Unskip → run full suite. Expected: identity 4/4 · loudness 2/2 · golden 3/3 (Bishop, Highlands, SyntheticDegenerate) · excel-parity the sole skip. Paste the count.
3. **Runbook Phases 2–3:** smoke shapes against the real deals (Bishop climbing, floor-transition month noted; Highlands steady per seed data); consumer matrix — one value per quantity everywhere (capital-structure route included); D1 behavioral pass + T2 forced cache-hit if still open (sixth session on the debt sheet — close or report why not).
4. **Regenerate the parity list** from pinned Bishop values: field, year, expected format — the fill-in-the-blanks ask for the operator.
5. Report the verdict table. **W5 closes on: suite green + Phases 2–3 green + seed canary held.** TS-1 unlocks on close; F-P1 queues with its lettered ledger (A: build-boundary client-assumptions leak · B: noi.resolved provenance lie · C: honest-absence for owned_import builds).

## OUT OF SCOPE
Engine/route edits (any gate failure → report, external agent fixes) · `financial-model.routes.ts` (F-P1-A rides to F-P1) · partial pins · pinning any value that hasn't passed its gate · excel-parity (oracle-gated, operator's desk).

**Order: Gate 0 → 1 → 2 → 3 → 4 → pin → suite → Phases 2–3 → report. First STOP wins.**
