# DISPATCH: Custom-metric rows into the periodic grid (render proven values, don't recompute)

Custom-metrics backend is proven (13/13 acceptance: ratios re-derive correctly, Debt Yield = 59.31% annual NOT 712% summed, evaluator rejects injection/cycles). The periodic grid is now proven + re-homed on reachable surfaces (Phase 5 closed). This wires the metric rows into the grid. The risk is the **rollup trap at the display layer**: a ratio row summed across months shows the 712% artifact instead of 59.31%. The grid must **render the backend's re-derived values, never recompute or sum them**. Prove against Highlands with a known-correct number. STOP at the report.

---

## STEP 0 — Read the current wiring, pick merge-vs-extend (don't assume)

The grid renders from `/financial-model/:dealId/periodic`; custom metrics come from `/api/v1/custom-metrics/:dealId`. Before building, read how `PeriodicGrid` + `usePeriodicData`/`usePeriodicField` currently fetch, and report which integration path fits:
- **(A) client-side merge** — grid fetches both endpoints, merges metric rows into the rendered series. Decoupled; the two engines stay independent.
- **(B) extend periodic endpoint** — periodic response includes custom metrics. Single fetch for the consumer; couples custom metrics into the periodic seed.
Report which the existing hooks are already set up for (Phase 5 may have stubbed one), and recommend. Lean (A) unless the code already leans (B). **Human-confirmable at the report, but pick the one the code supports and state why.** `file:line`.

## STEP 1 — Render metric rows (full + monitoring presets)

- Custom-metric rows appear in `full` (F9 proforma) and `monitoring` (Asset Hub), marked with the user glyph (distinguishes user-defined from system rows). Not in `overview` (per the preset spec).
- Each metric row spans the same 15 year-columns + boundary as the P&L rows, same zone styling (actual/gap/projection).
- The values rendered are the **backend's** values from the custom-metrics endpoint. The frontend does not evaluate formulas, does not recompute, does not sum — render what the backend re-derived. (The backend's whole job was correct re-derivation; duplicating it client-side reintroduces the bug it fixed.)

## STEP 2 — The rollup trap (the blocker — ratio rows must NOT sum)

The grid's year columns roll up monthly data. For NOI that's a sum — correct. **For a ratio metric (Debt Yield, NOI margin, DSCR), the year value is re-derived at annual, NEVER the sum of monthly values.** Summing produces the 712% artifact.

- The grid must distinguish **additive** rows (sum monthly → annual) from **ratio/derived** rows (use the backend's annual re-derived value; never sum). The metric's type/rollup-rule comes from the backend — read it, honor it.
- Year column for a ratio row = the backend's annual value for that year. Month cells = the backend's monthly re-derived values. The year is NOT computed from the months client-side.
- **A ratio row whose year column equals the sum of its month cells = FAIL** — that's the artifact. The year must equal the backend's annual re-derivation.

## STEP 3 — Drill-down + metrics without monthly values

- Year→month expand on a metric row shows the backend's monthly values for that metric, same zone language.
- **Some metrics have no monthly decomposition** (annual-only definition, or projection-zone-only). Expanding such a row must show the annual value and blank/—  the months — **not fabricate, interpolate, or crash.** Render "annual-only" gracefully.
- The split transition year (part-actual/part-projection) on a ratio row uses the backend's per-period re-derived values, not a blended sum.

## ACCEPTANCE — against Highlands, with a known-correct number

The backend acceptance already established the truth values — check the render against them.

1. **Debt Yield renders correct (the headline check).** Open Highlands `full` mount → the Debt Yield custom-metric row shows **59.31%** at the annual level (the backend-proven value), with the user glyph. Paste the rendered row next to the backend `/custom-metrics` value. **If it shows 712% or any sum-of-monthly figure → FAIL (rollup trap).**
2. **Ratio ≠ sum.** Pick a ratio metric, expand its year → confirm the year column value ≠ the sum of the 12 month cells (it equals the backend annual re-derivation instead). Paste the year value and the month values showing they don't sum to it.
3. **Renders on a reachable surface.** Confirm the rows show in both `full` (F9, unburied) and `monitoring` (Asset Hub) — the re-homed reachable mounts, not a buried/orphan surface. Screenshot each.
4. **User glyph present.** Metric rows visually distinguish from system P&L rows. Paste.
5. **Annual-only metric drill.** If any metric lacks monthly values, expand it → annual shows, months blank, no crash. Paste. (If none exists, note it and construct a quick test metric to prove the path.)
6. **Zone + boundary consistent.** Metric rows respect the same `actuals_through_month = 2026-04` boundary and actual/projection zones as the P&L rows. Paste.
7. **No client-side recompute.** Confirm (code + render) the frontend renders backend values and does not evaluate/sum/re-derive metric values itself. `file:line` of where the rendered value comes from (must trace to the API response, not a client computation).

**Report:** each item PROVEN / FAIL with the paste it specifies. Item 1 and 2 are the blockers — a Debt Yield showing 712%, or a ratio year that sums its months, means the rollup trap reached the display layer and it's not done regardless of how it looks. STOP after reporting.

---

**Why the known-correct number matters:** 59.31% is already proven correct by the backend acceptance. So this isn't "does a number render" — it's "does the *right* number render," checked against a value we already know. The failure mode (712% from summing a ratio) looks like a real percentage and renders cleanly — the only way to catch it is to know the answer in advance and compare. That's why acceptance 1 names the exact figure.
