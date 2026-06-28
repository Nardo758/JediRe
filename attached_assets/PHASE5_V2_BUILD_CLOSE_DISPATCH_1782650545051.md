# V2 BUILD-MODE CLOSE DISPATCH (Replit — one pass that actually shuts V2)

V2-A proven (real DB baseline). V2-E passes at code level. Two render crashes block B/C; the rent_growth fix is runtime-inert; two "dead" files need runtime confirmation now that the env can do it. Four actions, then the screenshot close. **V2 does not close on the two crash fixes alone** — it closes when B/C/D render real NOI at the real boundary, the re-seed makes rent_growth non-inert, and the dead-code claim is runtime-verified. Paste evidence for each. STOP at the report.

---

## ACTION 1 — Fix the two render crashes (unblocks B/C)

Both pre-existing, both in the render path of a mount.

- **`FinancialEnginePage.tsx`** — `ReferenceError: F9SummaryBar is not defined` at ~:1891. The component exists/exports at `frontend/src/components/f9/F9SummaryBar.tsx`; the import is missing. Add it.
- **`AssetHubPage.tsx`** — `ReferenceError: refreshKey is not defined` at ~:1223 in `RevenueScreen`. `refreshKey` is `useState` in the parent (~:2304) but `RevenueScreen` (~:769) references it without receiving it. Add `refreshKey: number` to `RevenueScreen`'s props and pass it from the callsite (~:2481).

Acceptance: both mounts load without a `ReferenceError`. Paste the app loading each (no red crash overlay).

## ACTION 2 — Re-seed Highlands so `rent_growth` is non-inert (the Bucket 2 fix is currently doing nothing)

`rent_growth` is not in Highlands' `periodic_seed.fields` — the seeder was updated (`a9d0c8813`) but Highlands was never re-seeded. So on Highlands (and every un-seeded deal) `periodicRentGrowth` is `undefined` → `?? rentGrowth[0]` silently serves the stale flatten. The entire Bucket 2 fix is runtime-inert until a re-seed populates the field.

- Re-seed Highlands through the production seed path (`ensureDealAssumptionsSeeded(forceReseed:true)` — the proven path).
- Acceptance (live-DB): `SELECT` `periodic_seed.fields` for Highlands → confirm `rent_growth` is now present with a real server-derived value. Paste it. Then confirm in the app that `periodicRentGrowth` resolves non-null on Highlands (the `??` now serves the real rate, not `[0]`) — DecisionTab flag and SensitivityTab `currentRG`.
- While re-seeding: fix the `has_projection` flag bug (seeder writes `false` despite 120 projection periods). Confirm `has_projection = true` and `first_projection_month` populated post-reseed so the grid header renders the projection label. Paste the corrected boundary object.

## ACTION 3 — Runtime-confirm the two "dead" files are actually unreachable (don't trust the Windows-box claim)

`ProFormaTab.tsx` (`:270,907,1207` raw `rentGrowth[0]`) and `FinancialDashboard.tsx` (`:171,180,189` raw `cashOnCash[0]`) were dismissed as dead via a code-only "zero imports/mounts" check. The env can now verify reachability for real.

- Confirm at runtime: is either component reachable by **any** route or mounted by any rendered parent (especially the capsule path that V2-D exercises)? Trace from the router + actual mounts, not just grep.
- **If reachable:** those raw `[0]` are **live flattens** on a real surface (FAIL) → replace with the periodic path like the others. Report which surface they render on.
- **If genuinely unreachable:** confirm and paste the evidence (no route, no mounting parent). Then they're legitimately dead and can stay.
- Also: `FinancialEnginePage.tsx:321` `noiByYear[0]` — guarded by a `periodicNoiY1 != null` check, but the raw `[0]` path is still reachable when that's null. Confirm whether it fires on any real deal; if so, replace.

## ACTION 4 — Screenshot close (B / C / D / E against real Highlands)

Only after Actions 1–3. Open Highlands (`is_portfolio_asset=TRUE`, boundary `2026-04-01`).

- **V2-B (`full`, F9 ProForma):** grid renders; actual-year NOI matches V2-A DB numbers (2022: $3,610,743 / 2023: $3,887,706 / 2024: $3,632,522 / 2025: $3,610,299 / 2026 4mo: $1,112,960); boundary header reads `2026-04-01`. Screenshot + values.
- **V2-C (`monitoring`, Asset PERFORMANCE):** grid renders same NOI/boundary; the `[NO DATA]` cash-flow card (Bucket 1 fix) renders honestly, no regression to a fabricated number. Screenshot.
- **V2-D (`overview`, Capsule):** headline NOI + boundary render; **no `generateMockData` output under any state** (deleted fallback stays gone). Screenshot data-present and, if reachable, the empty/loading state.
- **V2-E (boundary not hardcoded):** same render confirms Highlands shows `2026-04-01`; open a second deal with a different/null boundary (Sentosa, null seed → empty state) and confirm it does NOT render "2026." Screenshot both.

---

## Report — what closes V2

| Item | Closes when |
|---|---|
| V2-B | F9 grid renders real NOI at 2026-04-01 (screenshot + values) |
| V2-C | PERFORMANCE grid same; [NO DATA] card honest |
| V2-D | Capsule overview real, zero mock under any state |
| V2-E | Highlands 2026-04-01 AND second deal ≠ 2026 (both shown) |
| Action 2 | `rent_growth` in seed, `periodicRentGrowth` non-null, `??` serves real rate |
| Action 3 | two files runtime-confirmed dead, OR their flattens fixed |

**Phase 5 closes only when all six rows are PROVEN with pastes/screenshots.** The two crash fixes alone do not close V2 — they unblock it. Do not mark Phase 5 complete on a partial. Custom-metrics integration unblocks the moment this report comes back fully PROVEN. STOP after reporting.

---

**Why all four, not just the crashes:** fixing the crashes makes B/C *renderable* but not *correct* — Action 2 proves the rent_growth fix isn't inert, Action 3 proves the flatten is actually gone (not assumed-dead), and Action 4 proves the numbers match the DB. Skipping any one leaves a known gap labeled "done," which is the failure mode this entire program has been built to prevent.
