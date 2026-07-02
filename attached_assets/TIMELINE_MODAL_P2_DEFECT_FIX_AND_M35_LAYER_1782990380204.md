# DISPATCH — Timeline Modal Phase 2: Inline-Render Defect Fix + M35 Event Annotation Layer

**Arc:** Proforma Timeline — follows `TIMELINE_MODAL_V2_VERIFY_AND_M35_ANNOTATIONS.md` (P1 report: `docs/audits/TIMELINE_MODAL_P1_ACCEPTANCE_REPORT.md`)
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Status of P1:** P1-1 PASS. P1-3 PASS (44 rows in `market_events`; Highlands p2122 has null geography → correct empty state). **P1-2 item 1 is DOWNGRADED to FAILED** — "modal opens" was passed on code-path trace, not observed click. Operator observation: on the Deal Details surface, raw periodic data renders inline below the Deal Details nav instead of a button opening a modal. That defect is now P2-0 and blocks everything after it.
**Standing rule (S1-01):** pasted live output, `file:line`, or screenshot of the thing itself. A code path that *should* open a modal is not a modal observed opening.

---

## P2-0 — DEFECT: raw data inline below Deal Details nav (FIX FIRST)

**Symptom (operator-observed):** navigating to Deal Details, the periodic raw data renders inline below the nav. No button-click → modal behavior.

**Prime suspect:** the original `overview`-preset inline grid mount on `DealDetailPage` F1 OverviewScreen was never converted to a trigger. The `34c26dd8d` build converted AssetHubPage (inline → button) but only *added* buttons to the other surfaces — if the old inline mount on the Deal Details surface survived, it renders raw exactly as observed. Do not assume this is the cause; prove it.

1. **Reproduce:** open Deal Details for Highlands (deal `eaabeb9f`). Screenshot the inline raw data below the nav.
2. **Diagnose:** identify the component rendering it, `file:line`. Enumerate ALL remaining inline `PeriodicGrid` mounts repo-wide (not just the suspected one) — paste the list. Any inline mount other than inside `PeriodicTimelineModal` is a defect instance.
3. **Fix:** replace every remaining inline mount with `PeriodicTimelineTrigger` (correct preset per surface). Grid renders ONLY inside the modal.
4. **Prove by click, per surface:** for **each** of the trigger surfaces (DealDetailPage/OverviewScreen, AssetHubPage, ProFormaSummaryTab, ProFormaWithTrafficSection, FinancialsTab — whichever exist after the fix): screenshot the surface with the trigger visible and NO inline data, then screenshot the modal OPEN after clicking. Scroll to the trigger if below fold — below-fold is not an excuse to skip observation.
5. **No data regression:** inside the opened modal, grid still shows EGI ≈ $6.3M / boundary 2026-04 / 57.17%. Paste.

**P2-0 is a hard gate. Do not start P2-1 until every surface passes step 4 by observed click.**

---

## P2-1 — Test-deal probe: 464 Bishop (READ-ONLY, report before building)

464 Bishop is the pin-render proof deal; Highlands remains the empty-state proof deal.

1. Resolve the deal: `SELECT id, name, property_id FROM deals WHERE name ILIKE '%bishop%' OR ...;` — paste the row. If not found by name, check properties by address.
2. Paste its geography: `submarket_id`, `msa_id`, `lat`, `lng`, `city` from the joined property row.
3. Run each join strategy against `market_events` for this deal (submarket_id → geography_id; PostGIS proximity if lat/lng; MSA slug; city slug). Paste matching event rows per strategy.
4. **Gate:** if ≥1 event matches AND the event date falls within the deal's timeline window → proceed to P2-2. If zero matches, or 464 Bishop has no periodic seed (no timeline to annotate), **STOP and report** — options at that point: pick a different deal from the 28 submarket-scoped events' geographies, or a minimal geography backfill. Do not backfill silently.

---

## P2-2 — M35 annotation layer (build)

Mark-don't-model. Pins are annotations with ZERO effect on the NOI curve, projections, or assumptions.

1. **Endpoint:** `GET /deals/:dealId/market-events?from=&to=` (auth-gated like the periodic API, org-scoped). Multi-strategy geo join in precedence order: submarket → PostGIS proximity → MSA → city. Returns `{ events: [{date, label, subtype, magnitude?}], strategy: '<which join resolved>' }` or `{ events: [], reason: 'no_geography_resolved' }`. No writes to `market_events`. No fallback that widens geography beyond the strategy that resolved.
2. **Chart:** `PeriodicChart` takes optional `events` prop → vertical annotation pin + date + label per mockup 2. T-token styling (JetBrains Mono, no gradients, ≤2px radius, ≥9px font). Legend M35 entry flips greyed → active only when `events.length > 0`.
3. **Modal:** `PeriodicTimelineModal` fetches events for the deal's window; passes through. Empty response renders the existing honest not-yet/empty badge with the reason code — no error state, no spinner-forever.
4. **Untouched:** `PeriodicGrid.tsx` internals and the NOI series derivation. `git diff` proves it.

---

## P2-3 — Acceptance (S1-01)

1. **Endpoint, populated path:** pasted live HTTP response for 464 Bishop showing ≥1 event + which join strategy resolved.
2. **Endpoint, empty path:** pasted live HTTP response for Highlands showing `{ events: [], reason: 'no_geography_resolved' }`.
3. **Render, populated:** screenshot of 464 Bishop's chart with pin(s) at the correct date(s), with the matching `market_events` rows pasted alongside — every rendered pin maps 1:1 to a row.
4. **Render, empty:** screenshot of Highlands' chart with the labeled-empty M35 layer, DB query pasted alongside proving empty-because-empty.
5. **No curve effect:** grid + chart NOI values for a 464 Bishop month containing a pin — identical with the events layer on vs off (or vs pre-P2 values). Paste both.
6. **No fabrication:** confirm pin count on screen == row count returned by the endpoint == row count from direct DB query. Paste all three.

**Blockers: 5 and 6.** One moved NOI number or one unmatched pin fails the phase.

---

## OUT OF SCOPE
- Submarket reference band; owner interventions layer
- Event→curve impact modeling (M35 P0 stack, separate)
- `deal_lifecycle_events` / lifecycle overlay wiring (separate dispatch)
- Geography backfill for Highlands (separate data-hygiene ticket; do not perform here)
- Any `PeriodicGrid.tsx` internal change

**Run P2-0 → P2-1, report both. STOP at the P2-1 gate before building if the 464 Bishop probe fails.**
