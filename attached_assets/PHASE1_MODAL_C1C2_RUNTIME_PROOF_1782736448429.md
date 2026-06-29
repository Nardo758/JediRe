# PHASE 1 MODAL — C1/C2 RUNTIME PROOF (Replit — two screenshots, the blockers that stayed open)

C3/C4 are proven. C1 and C2 were marked "code-level proven" — but they were defined as *render-against-real-numbers* checks precisely because code-level reasoning can't catch what they hunt. This project's history: "code paths clean, runtime pending" has hidden a real bug nearly every time it was finally run (type-erased MONITORING_FIELDS, two mount crashes, inert rent_growth, 12× EGI — all read clean, all broke at render). Run these on Replit (the env that ran every prior real-render proof). Likely a 15-min confirmation since the code is reportedly clean — but it has to actually happen. STOP at the report.

---

## C1 — Grid renders the proven numbers INSIDE the modal

Code shows `dealId`/`preset` passed through — but `CapitalStackPanel` also "passed dealId" and threw `dealId is not defined` at mount. Identical-prop-passthrough is necessary, not sufficient. Prove the render.

- Open the portfolio test deal. Click the `PeriodicTimelineTrigger` → modal opens → GRID tab.
- Screenshot the open modal showing:
  - **EGI annual ~$6.3M** (NOT $57.4M) for an actual year
  - **boundary at 2026-04**
  - **custom-metric noi_margin 57.17%**
  - drill-down: click a year → 12 months expand
- These are the established-correct numbers. They must render *in the modal container*. If the modal's flex/overlay broke the grid (clipped, wrong size, missing rows, dealId not reaching it), this catches it. Paste the screenshot.

## C2 — Chart plots the SAME numbers as the grid (new-renderer risk)

`usePeriodicData` returning the same object proves same *fetch* — NOT that `PeriodicChart` plots it right. Scaling, axis, point placement are rendering math downstream of the fetch, untested by "same response."

- In the modal, CHART tab, same deal.
- Pick one year. Paste **the chart's plotted NOI for that year** next to **the grid's NOI for the same year** (switch tabs, read both). They must match.
- Confirm the chart's **boundary now-line** sits at the same `actuals_through_month` (2026-04) as the grid's boundary — same value, both renderers.
- Confirm the NOT-YET layers (submarket band, M35, interventions) render as labeled-empty, not fabricated lines.
- A chart that pulls the right data and draws it wrong (off-scale, shifted, wrong year) is the failure mode here. Screenshot both tabs.

---

## Report

| Item | Closes when |
|---|---|
| C1 | screenshot: modal GRID shows EGI ~$6.3M, boundary 2026-04, noi_margin 57.17%, drill works |
| C2 | chart NOI == grid NOI for one year (both pasted), same boundary line, stub layers empty-not-faked |

**Both are blockers.** If C1 shows wrong/clipped/missing grid → modal container broke it, report the symptom. If C2 shows the chart line not matching the grid → the chart renders the data wrong, report it. Either failure: report the bug, don't fix in this pass (a render fix is its own gated step). If both pass: Phase 1 is genuinely closed — the proven grid survived the move and the chart agrees with it.

STOP after the two screenshots + the matching values. This is the runtime proof the close report deferred — the 15 minutes that this project's history says you don't skip.
