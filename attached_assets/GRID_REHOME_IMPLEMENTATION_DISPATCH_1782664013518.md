# IMPLEMENTATION DISPATCH: Grid re-home — four moves, audit-proven

Redundancy audit cleared the moves: one proven deletion, two relocations, one line-extraction, one orphan **preserved**. Each grid mount lands on a confirmed-routable Bloomberg surface. **Hard guardrail: `ProFormaWithTrafficSection.tsx` loses exactly ONE line and nothing else — its 890 lines and the backend endpoint are parked for a separate human decision, NOT part of this cleanup.** Acceptance is render-against-real-Highlands per mount, not "it compiles." Paste evidence. STOP at the report.

---

## MOVE 1 — `overview` → DealDetailPage F1 (OverviewScreen), extract one line

- **Source:** `ProFormaWithTrafficSection.tsx:864` — `<PeriodicGrid dealId={deal.id} preset="overview" />`. Extract **only** this usage. Drop the surrounding `dataSource === 'api'` guard (not needed at the new mount).
- **Target:** `DealDetailPage` F1 `OverviewScreen` (`?tab=overview`). Mount `<PeriodicGrid dealId={dealId} preset="overview" />` in the overview screen body.
- **GUARDRAIL:** do not delete, refactor, or touch any other line of `ProFormaWithTrafficSection.tsx`. The HandoffTab / AssumptionsTab / ReturnsTab and the duplicate-`handleInitialize` defect stay exactly as they are — that file is parked, not cleaned. Removing the one `<PeriodicGrid>` line is the only edit to it.
- **overview no-actuals case:** OverviewScreen renders for prospect/underwriting deals with no actual zone. Confirm the overview preset renders projection-only without a broken "vs underwriting" headline and without crashing (lifecycle analysis-only case).
- **Acceptance:** open Highlands `?tab=overview` → overview grid renders real NOI + boundary `2026-04-01`. Open a prospect deal (no actuals) → projection-only, no crash, no broken headline. Paste both.

## MOVE 2 — `monitoring` → AssetHubPage (Live Tracking slot)

- **Source:** `FinancialsTab.tsx:487–493` (the PERIODIC MONITORING block) + the `PeriodicGrid` import at line 11. Remove both. Audit confirmed zero sibling dependencies — `usePeriodicField` at line 12 / `y1Noi` at 122 are unrelated and stay.
- **Target:** `AssetHubPage` (`/assets-owned/:dealId/property`), the Live Tracking section (one of the 6 open TODO data slots — the semantically aligned one). Mount `<PeriodicGrid dealId={dealId} preset="monitoring" />` there.
- **Acceptance:** `FinancialsTab` still renders (charts, projection table, hold-period filters, M35 events) with zero broken refs after removal — confirm. AssetHubPage Live Tracking slot now shows the monitoring grid with real Highlands NOI + boundary, replacing a `—`/TODO placeholder. Paste both (FinancialsTab intact + AssetHub grid rendering).

## MOVE 3 — `full` → unbury to F9 main body (relocate, no re-home)

- **Source:** `ProFormaSummaryTab.tsx:4481–4487` (the Periodic Timeline block) + import at line 21. Audit confirmed it's the final element, zero downstream siblings.
- **Target:** elevate so a user landing on `?tab=proforma` (F9) sees the grid **without** digging into the CONSOLE sub-tab. Either: promote it to the F9 main body (top-level section of the proforma tab before sub-tab nav), OR a promoted METRICS tab alongside CONSOLE — not buried under it. Pick whichever fits the F9 layout; state which.
- **Acceptance:** open Highlands `?tab=proforma` → the full grid is reachable without clicking into CONSOLE. Renders real NOI + boundary. ProFormaSummaryTab's other content (proforma table, overrides, reconciliation chips) still renders identically. Paste the grid at its new depth + confirmation the rest of the tab is intact.

## MOVE 4 — DELETE `PropertyTerminalPage.tsx` (proven redundant)

- Audit verdict: zero imports, not in router, 91-line pure placeholder, route already serves `PropertyCardPage` (3,099 lines, live).
- **Before deleting:** one final re-confirm — `grep -rn "PropertyTerminalPage" frontend/src` returns only the file itself (no import anywhere). Paste the grep.
- Delete the file.
- **Acceptance:** post-delete, `/terminal/property/:id` still loads `PropertyCardPage` (the route is unaffected). Build passes (no broken import). Paste.

---

## PARKED — not in this dispatch (human decision required, do NOT action)

These came out of the audit and are explicitly **not** part of the re-home. Do not touch:

1. **`ProFormaWithTrafficSection.tsx` — the 890 lines** (HandoffTab, AssumptionsTab, ReturnsTab, pipes 3 & 4 UI). Unique, exists nowhere else, AND never compiled (duplicate `handleInitialize` at 714/726). The decision is **complete-and-ship vs. discard**, not "move vs. delete" — it's half-built, not working-but-unmounted. Yours to make, later.
2. **`GET /proforma/:dealId/traffic-integration`** — live backend endpoint reachable ONLY through that orphan. If the 890 lines are ever discarded, this route goes dead too. Pair the decisions; don't delete one without the other.
3. **Legacy routes** (`-legacy` `PortfolioPropertyPage`, `-old` `AssetOwnedPage`) — intentional rollback keeps. Leave wired.

---

## Acceptance — what closes this dispatch

| Move | Closes when |
|---|---|
| 1 overview | F1 overview renders Highlands NOI + 2026-04-01; prospect deal renders projection-only, no crash; `ProFormaWithTrafficSection` lost exactly one line |
| 2 monitoring | AssetHub Live Tracking shows monitoring grid (real NOI); FinancialsTab intact after removal |
| 3 full | F9 proforma shows grid without CONSOLE dig; rest of ProFormaSummaryTab intact |
| 4 delete | grep clean, file deleted, `/terminal/property/:id` still serves PropertyCardPage, build passes |

**Then — finally — the V2 NOI-match proof runs against mounts a user can actually reach** (the thing that's been blocked the whole time): all three presets rendering Highlands' real NOI at the real boundary, on routable surfaces. That's the Phase 5 close.

Confirm after each move that `ProFormaWithTrafficSection.tsx` still has all 890 lines minus exactly one. STOP after the report — review gate before the parked decisions.
