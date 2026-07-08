# DISPATCH — Timeline Modal: Reconciliation + M35 Event Annotation Layer

**Arc:** Proforma Timeline (15-year ribbon) — `PROFORMA_TIMELINE_MODEL_SPEC.md` + Deal Lifecycle ↔ Timeline Alignment overlay
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Structure:** Two phases. Phase 1 is READ-ONLY with a hard STOP. Phase 2 executes only on explicit approval.
**Standing rule (S1-01):** Every claim requires positive observation — `file:line` trace, pasted live-DB output, pasted HTTP response, or screenshot of a rendered surface. Green tests, grep counts, git log messages, and prior completion reports are NOT evidence. This dispatch exists because a prior "complete and pushed" report (`270645e65`) named three files that did not exist in the repo.

---

## CONTEXT (do not re-derive; verify against it)

A Phase 1 timeline modal build was reported complete at **master → `34c26dd8d`** with:

**Reported NEW files:**
- `frontend/src/components/periodic/PeriodicTimelineModal.tsx` — shared modal, GRID/CHART toggle tabs, T-token aesthetic
- `frontend/src/components/periodic/PeriodicTimelineTrigger.tsx` — compact button trigger
- `frontend/src/components/periodic/PeriodicChart.tsx` — SVG chart: zone bands (actual=cyan, gap=amber, projection=muted), zone-colored NOI line, boundary now-line at `actuals_through_month`, honest empty-layer badges

**Reported EDITED surfaces (inline grid → button trigger, or button added):**
- `frontend/src/pages/AssetHubPage.tsx` (monitoring preset)
- `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` (full preset)
- `frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` (overview preset)
- `frontend/src/components/terminal/tabs/FinancialsTab.tsx` (monitoring preset)

**Reported source-probe verdicts:**
| Layer | Verdict |
|---|---|
| Deal NOI line | REAL (periodic API) |
| Submarket reference band | NOT-YET (no time-aligned submarket NOI) |
| M35 event markers | SOURCEABLE-AS-ANNOTATION (`market_events` table) |
| Owner interventions | NOT-YET (no scheduled-interventions table) |

**Known-correct reference numbers (proven prior, live DB):** Highlands 2025 — EGI ≈ $6.3M (NOT $57.4M), `noi_margin` = 57.17%, actuals boundary = 2026-04.

None of the above may be assumed true. Phase 1 verifies all of it.

---

## PHASE 1 — RECONCILIATION + ACCEPTANCE VERIFICATION (READ-ONLY)

No file writes, no migrations, no commits in this phase.

### P1-1 · Repo ground truth
1. `git log --oneline -5 master` and confirm whether `34c26dd8d` exists on master. Paste output.
2. For each of the three NEW files: confirm existence **in the working tree at HEAD** (`ls -la` the paths; paste). A commit containing them is insufficient if HEAD has since diverged.
3. For each of the four EDITED surfaces: paste the `file:line` showing the `PeriodicTimelineTrigger` invocation (or the absence thereof).
4. Confirm `PeriodicGrid.tsx` internals are unchanged from its last proven state: `git log --oneline -3 -- frontend/src/components/periodic/PeriodicGrid.tsx` + note whether any commit postdates the proven verification. If yes, `git diff` that range and paste.

**If any NEW file is missing from HEAD or any trigger invocation is absent → report which, STOP immediately. Do not proceed to P1-2. Phase 2 will be re-planned as a rebuild.**

### P1-2 · Runtime acceptance (only if P1-1 fully passes)
Run the app against the real DB. For a real deal with periodic data (Highlands):
1. **Modal opens from a routable surface.** Screenshot: trigger button visible on AssetHubPage (or F9 ProForma), modal open.
2. **GRID tab shows proven numbers.** Screenshot or paste of rendered values: EGI ≈ $6.3M, boundary 2026-04, custom-metric 57.17%. Numbers must match the previously proven live-DB values, not fixtures.
3. **CHART tab real layers.** Screenshot: NOI line, zone bands, boundary now-line at the API-supplied `actuals_through_month` (verify it is NOT hardcoded — paste the code path from API field → chart prop).
4. **Grid ↔ chart agreement.** Pick one year; paste the NOI value the grid shows and the value the chart plots for the same periods. They must be equal (same series, two renderers).
5. **Stubbed layers honest.** Screenshot: submarket / M35 / interventions render as labeled-empty. Confirm zero fabricated data points.

### P1-3 · M35 sourceability re-probe (feeds Phase 2 scoping)
The SOURCEABLE verdict is also just a report. Prove it:
1. `\d market_events` (or Drizzle schema) — paste column list. Identify: event date column, geography column(s) (submarket/MSA/lat-lng), label/subtype, magnitude if present.
2. `SELECT count(*) FROM market_events;` and `SELECT * FROM market_events ORDER BY <date_col> DESC LIMIT 5;` — paste. If zero rows, the layer is buildable but will render empty; report that explicitly.
3. Determine the join path from a deal to its relevant events: how does a deal's geography resolve to `market_events` geography? Paste the candidate join (`deals` → submarket/MSA key → `market_events`) with `file:line` of any existing resolver. If no clean geographic join exists, report it as a Phase 2 blocker with options — do not invent one.

### P1 REPORT FORMAT
Per item: **VERIFIED / FAILED / BLOCKED** + the pasted evidence. One-line summary table at top. Then **STOP. Do not begin Phase 2 without explicit approval.**

---

## PHASE 2 — M35 EVENT ANNOTATION LAYER (ON APPROVAL ONLY)

Scope: light up the one layer the probe (if re-confirmed in P1-3) says is sourceable. **Mark-don't-model** — pins are annotations only; they have ZERO effect on the NOI curve, projections, or any assumption. Curve impact is a separate future workstream (event→assumption→IRR propagation, per the M35 P0 stack).

### P2-1 · Data path
- New read-only endpoint or extension of the existing periodic API: given `dealId` + the timeline's date window, return events from `market_events` whose geography matches the deal (join path per P1-3) and whose date falls inside the window. No writes to `market_events`.
- Payload per event: `{ date, label, subtype, magnitude? }`. Nothing else.
- Source-gated: if the geographic join can't resolve for a deal, the layer returns empty with a reason code — never a fallback to MSA-wide or fabricated proximity.

### P2-2 · Chart render
- Pin marker at the event date on the X-axis: pin + date + label per mockup 2. T-token styling — no gradients, max 2px radius, min 9px font, JetBrains Mono.
- Legend entry flips from greyed/"coming" to active.
- No change to the NOI line, zones, boundary, or grid. `git diff` must show `PeriodicGrid.tsx` and the NOI-series code path untouched.

### P2-3 · Acceptance (S1-01)
1. **Endpoint proof:** paste live HTTP response for a real deal showing events (or honest-empty with reason code if `market_events` has no rows in that geography/window).
2. **Render proof:** screenshot of the chart with pins at the correct dates, OR the labeled-empty state if no events exist — with the DB query pasted alongside proving the empty state matches the data (empty-because-empty, not empty-because-broken).
3. **No curve effect:** paste the grid/chart NOI values for a month containing an event pin, identical to their P1-2 values.
4. **No fabrication:** every rendered pin maps 1:1 to a `market_events` row; paste the rows next to the screenshot.

**Blockers: P2-3(3) and P2-3(4).** One invented pin or one moved NOI number fails the phase.

### OUT OF SCOPE (do not touch)
- Submarket reference band (NOT-YET — needs time-aligned submarket NOI)
- Owner interventions layer (NOT-YET — no schema)
- Event→curve impact modeling (separate M35 workstream)
- `deal_lifecycle_events` wiring / lifecycle overlay triggers (separate dispatch)
- Any `PeriodicGrid.tsx` internal change

---

**Run P1 now. Report. STOP.**
