# V2 CLOSE DISPATCH (Replit — the environment that can run it)

V2 is the only Phase 5 check that puts a real number on screen next to the DB. Every fix so far was verified by code-reading + grep; none by seeing real data render. This thread's entire history is code-reading passing things real runs catch (Phase 4 dead branch, Kahn's-direction bug, annual-placeholder artifact, lying docstring — all compiled, all grepped clean, all wrong). Run this on Replit (which has DB + backend — it ran the Phase 4 forced runs and the custom-metrics 13/13). Paste every result. Until this passes, Phase 5 is NOT closed and custom-metrics integration stays blocked. STOP at the report.

---

**Setup.** Backend running, Highlands deal id in hand (`is_portfolio_asset = TRUE`, the deal with the populated `periodic_seed` and `actuals_through_month = 2026-04`).

**V2-A — Baseline from the DB (the truth to render against).** Paste:
- `SELECT actuals_through_month FROM deals WHERE id = '<highlands>'` → confirm `2026-04`.
- The actual-year NOI from the seed: `SELECT` the `periodic_seed` NOI values for the actual-zone periods (or the annual-rolled actual-year NOI). Record the real numbers — these are what the grid must match.
- The zone distribution (actual / gap / projection counts) for reference.

**V2-B — `full` mount (F9 ProForma).** Open Highlands in the F9 ProForma grid. Paste (screenshot or rendered values):
- Actual-year NOI rendered == the V2-A DB numbers. Match required.
- The boundary column falls at `2026-04`, NOT a hardcoded year. Confirm by checking it lands on the real boundary, not "always 2026" or "always year N."
- Projection years show derived values, not blanks or demo.

**V2-C — `monitoring` mount (Asset Owned PERFORMANCE).** Same Highlands deal, the PERFORMANCE tab. Paste rendered NOI + boundary. Must match V2-A (same deal, same DB, same numbers). Confirm the `[NO DATA]` cash-flow card (the Bucket-1 fix) renders honestly here, not a number.

**V2-D — `overview` mount (Deal Capsule overview).** Same deal, Capsule overview. Paste rendered headline NOI + boundary + the "vs underwriting" figure. Boundary must match `2026-04`. Confirm no `generateMockData` output (the deleted fallback) appears under any state.

**V2-E — Boundary-is-read-not-hardcoded (the decisive check).** A hardcoded "2026 split year" renders identically to a correct read on Highlands — they only diverge on a different deal. So: open a **second** deal with a *different* `actuals_through_month` (or a prospect deal with none). Confirm its boundary renders at *its* value, not 2026. If every deal shows the boundary at 2026, the boundary is hardcoded and B/C/D passing on Highlands was a false positive. This is the check that proves the grid reads live zone data.

**V2-F — `rent_growth` fallback firing (closes the open Bucket 2 question).** The fixes use `periodicRentGrowth ?? <old [0] flatten>`. Confirm whether `rent_growth` is actually populated or the `??` is silently serving the stale flatten:
- For Highlands: is `periodicRentGrowth` non-null (the server-derived rate renders), or null (the `??` falls back to `rentGrowth[0]`)? Paste which side of the `??` is live.
- For a prospect/un-seeded deal: same check — the report said projection zone "falls back to year1 seed," so confirm what renders and whether the fallback is visibly marked or silent.
- Finding: if the `??` serves the old flatten on common deals with no marker, that's a silent stale fallback — flag it (not a V2 blocker, but it's the Bucket 2 loose end).

---

**Report:** each = DB SELECT + rendered value/screenshot. PROVEN / FAIL per item.
- **Blockers (must pass to close V2):** B, C, D (rendered == DB, all three mounts), and **E** (boundary read, not hardcoded).
- **Flag:** F (rent_growth fallback behavior).

If B/C/D/E pass with real pastes: **V2 closes, Phase 5 is done, custom-metrics integration is unblocked.** If E fails (boundary hardcoded): the three mounts passing on Highlands was a false positive — fix the boundary to read the API value, re-run. Do not mark Phase 5 complete without E. STOP after reporting.

---

**Why E is the one that matters most:** B/C/D prove Highlands renders right, but Highlands has the boundary at 2026 — so a grid that hardcodes 2026 passes B/C/D while being broken for every other deal. E (a second deal with a different boundary) is the only check that distinguishes "reads `actuals_through_month` from the API" from "hardcoded the year that happened to be right for Highlands." It's the render-layer version of the same trap caught all thread: looks correct on the one case you tested, wrong on the next.
