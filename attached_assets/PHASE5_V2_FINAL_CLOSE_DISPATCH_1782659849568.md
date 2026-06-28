# V2 FINAL CLOSE DISPATCH (Replit — the narrow pass that actually shuts it)

Most of V2 is now genuinely done: crashes fixed (Action 1), Highlands re-seeded with real `rent_growth` (Action 2), boundary-not-hardcoded shown (V2-E, Sentosa), dead code confirmed (Action 3). **Two things remain, and they are the core of what V2 was for.** The last run's B/C screenshots proved "the page loads without crashing" — not "the grid renders the right NOI." Those are different claims; this pass closes the value-level one. D was never run. Paste numbers, not "it rendered." STOP at the report.

---

## CLOSE-1 — B / C / D with NOI matched to the DB (the actual proof)

The V2-A baseline (already confirmed from `periodic_seed`): annual actual-zone NOI —
**2022: $3,610,743 · 2023: $3,887,706 · 2024: $3,632,522 · 2025: $3,610,299 · 2026 (4mo): $1,112,960**, boundary `2026-04-01`.

For each mount, the screenshot must show the **PeriodicGrid with NOI values visible**, and those values must match the baseline. "Loads without crash / SummaryBar visible / Revenue tab loaded" does **not** count — that proves Action 1, not the grid.

- **V2-B — `full` (F9 ProForma).** Screenshot the PeriodicGrid itself showing the actual-year NOI row. Confirm 2022–2025 + 2026-partial match the baseline numbers and the boundary header reads `2026-04-01`. If the grid mounts but shows no NOI / wrong NOI / an error inside the component, that's the finding — report it, don't call it passed.
- **V2-C — `monitoring` (Asset PERFORMANCE).** Screenshot the monitoring PeriodicGrid (not the occupancy/eff-rent cards — those are a different part of the page). Confirm NOI + boundary match. Confirm the `[NO DATA]` cash-flow card (Bucket-1 fix) renders honestly, no fabricated number.
- **V2-D — `overview` (Capsule).** The one never run. Now that the B crash is fixed, navigate the capsule overview for Highlands. Screenshot the headline NOI + boundary. Confirm **no `generateMockData` output under any state** (the deleted fallback stays gone — data-present and, if reachable, empty/loading).

If any mount renders the grid but the NOI doesn't match the DB, that is a **FAIL with a real bug** (the render path or the data wiring), and it's exactly what V2 exists to catch — surface it, don't paper it.

## CLOSE-2 — Production-guard decision (the Action 2 loose end)

Highlands was re-seeded by a one-off script (`reseed-highlands.ts` calling `seedProFormaYear1` directly) because `ensureDealAssumptionsSeeded` **bails on the extraction-data guard before reaching the Phase 0-B portfolio path.** So the production path still does not handle portfolio assets — the next portfolio deal (or the next normal re-seed of Highlands) hits the same guard and the same inert `rent_growth`.

Decide and report:
- Is the portfolio-asset path (`is_portfolio_asset = TRUE`, actuals in `deal_monthly_actuals`) **supposed** to reach Phase 0-B through `ensureDealAssumptionsSeeded` in production?
- If **yes** (expected): the real fix is the guard — let portfolio assets through to the Phase 0-B path instead of bailing on the missing extraction data. The script was a workaround; this is the actual Action 2. Implement and confirm a portfolio deal re-seeds through the *production* path (not the script), `file:line` of the guard change + a live re-seed proof.
- If **no** (script is the intended mechanism forever): document why, and how portfolio assets are meant to be (re)seeded operationally, so this isn't rediscovered as a bug later.

State which. If yes, the guard fix is part of closing V2; if no, the documentation is.

---

## Report — what closes V2 now

| Item | Closes when |
|---|---|
| V2-B | F9 PeriodicGrid screenshot shows NOI == baseline, boundary 2026-04-01 |
| V2-C | monitoring PeriodicGrid shows NOI == baseline; [NO DATA] card honest |
| V2-D | capsule overview shows real NOI/boundary, zero mock under any state |
| Guard | portfolio path reaches Phase 0-B in production (fixed + proven), OR documented as script-only by design |

Already PROVEN, do not re-litigate: Action 1 (crashes), Action 2 re-seed result (`rent_growth` 173 periods, `has_projection:true`, `first_projection_month:2026-05`), V2-E (boundary not hardcoded), Action 3 (dead code).

**Phase 5 closes when the four rows above are PROVEN with NOI-matched screenshots + the guard decision.** Not on "it loads." Custom-metrics integration unblocks the moment this comes back PROVEN. STOP after reporting.

---

**The one distinction this pass enforces:** a screenshot of a page that loaded is not a screenshot of a grid showing correct numbers. The last run proved the crashes are gone (real, valuable) but substituted "page loads" for "NOI matches DB." This pass requires the NOI on screen next to the NOI in the DB — the single thing V2 was created to verify, and the thing no code-read or crash-check can stand in for.
