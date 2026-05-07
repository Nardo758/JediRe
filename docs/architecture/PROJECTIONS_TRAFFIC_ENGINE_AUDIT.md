# Projections Traffic Engine Audit

**Scope:** F9 Console → PROJECTIONS sub-tab, Traffic Engine UI only.
**Generated:** Plan-mode inline audit, Task #631. Saved to disk by Task #632.
**Related audit:** `docs/architecture/INPUTS_TAB_SECTION_AUDIT.md`

---

## Phase 0 — Surface location

The Projections cluster has a thin shell (`ProjectionsHubTab.tsx`, 28 lines) that just renders `ProjectionsTab.tsx`. There is **one and only one** Traffic Engine surface in Projections: the `TrafficFunnelPanel` component embedded inside `ProjectionsTab.tsx`.

| Surface | Path | Lines |
|---|---|---|
| Hub shell | `frontend/src/pages/development/financial-engine/ProjectionsHubTab.tsx` | 1–28 |
| **TrafficFunnelPanel (component)** | `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx` | 877–1024 |
| Mount site (annual view only) | `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx` | 1612–1625 |
| Traffic-signal footnote row (separate small surface) | `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx` | 1956–1975 |

No other Traffic Engine widget exists in the Projections cluster. The footnote at line 1956 is a one-row strip showing per-year occupancy %; treated as part of the same surface for cross-reference purposes.

---

## §1 — Component structure

| Field | Value |
|---|---|
| File path | `frontend/src/pages/development/financial-engine/ProjectionsTab.tsx` |
| Component | `TrafficFunnelPanel` |
| Total file lines | 2,082 |
| Panel line range | 877–1024 (≈148 lines) |
| Last-touched commit (file) | `5509766fb` — 2026-05-07 — "Add leasing cost toggle to projections tab header" |
| Top-level layout | Header bar (collapse caret, panel title, W/M/Y cadence toggle, subtitle "walk-ins → tours → apps → leases") + body table (1 metric column + N year columns) + conversion footnote row |
| Sub-panels | None |
| Collapsibles | One — the panel itself collapses via `expanded` prop controlled by parent's `expandedSections` set (key `'traffic-funnel'`) |
| Mounted as | A full-width `<tr><td colSpan>` row inside the main projections table, placed above the OCCUPANCY & LEASING `InlineAssumptionBlock` and the REVENUE rows. Annual view only — hidden when projection table is in monthly cadence |

---

## §2 — The graph

**There is no graph.** The Traffic Engine surface is a pure HTML table — no Recharts, D3, Plotly, or SVG. Only chrome elements are the cadence toggle buttons.

| Question | Answer |
|---|---|
| Library | None — table only |
| X-axis | N/A (table columns = years 1..N from `holdYears`) |
| Y-axis | N/A (table rows = 4 funnel stages + 1 conversion footnote) |
| Series rendered | None |
| Confidence bands | **Not rendered.** `trafficProjection.leasingSignals.confidence` exists on the source object but is unused in this surface (it is consumed in `AssumptionsTab.tsx` Sec 5A rows). Asymmetric percentile bands per the calibration spec are not on the response object today. |
| Mode-aware? | **No.** Same shape regardless of Stabilized vs Lease-Up vs Recovery vs Redevelopment. `trafficProjection.mode.effective` is on the source object but is not read by `TrafficFunnelPanel`. |

---

## §3 — Horizontal outputs (table cells)

The "horizontal outputs" here are the year columns (one per hold year). All four data rows are time-series.

| Row label | Field binding | Cadence transform | Classification | Time periods |
|---|---|---|---|---|
| Walk-Ins | `trafficProjection.yearly[yr].walkInsPerWeek` | × {1, 4.33, 52} for W/M/Y | TIME_SERIES | All hold years |
| Tours | `trafficProjection.yearly[yr].toursPerWeek` | × {1, 4.33, 52} | TIME_SERIES | All hold years |
| Applications | `trafficProjection.yearly[yr].appsPerWeek` | × {1, 4.33, 52} | TIME_SERIES | All hold years |
| Leases | `trafficProjection.yearly[yr].leasesPerWeek` | × {1, 4.33, 52} | TIME_SERIES | All hold years |
| Conversion footnote (single value) | `yr1.leasesPerWeek / yr1.walkInsPerWeek × 100` | — | POINT_IN_TIME | Y1 only |
| Occupancy strip (line 1956 footnote) | `trafficProjection.yearly[yr].occupancyPct` | — | TIME_SERIES | All hold years |

Note the panel has **no T-01/T-05/T-06 explicit headline strip** — those signals (`leasingSignals.t01WeeklyTours`, `t05ClosingRatio`, `t06WeeklyLeases`) are NOT surfaced here despite being on the source object. The funnel rows use the parallel `walkInsPerWeek/toursPerWeek/appsPerWeek/leasesPerWeek` fields from `F9TrafficYear`, which are time-series equivalents per year (T-01/T-05/T-06 themselves are point-in-time leasingSignals).

---

## §4 — Data bindings

| Question | Answer |
|---|---|
| `dealStore` fields read | None directly. The component is a leaf that consumes parent props. |
| Parent reads | `ProjectionsTab` reads `financials.trafficProjection.yearly`, `financials.trafficProjection` (null check for `isOffline`), `assumptions.holdYears` |
| Own fetch logic? | None — fully prop-driven |
| Source type | `F9DealFinancials.trafficProjection` (already on the financials object — see `types.ts:303-311`). Not fetched separately. |
| Available but unused on the source | `leasingSignals.confidence`, `leasingSignals.t01WeeklyTours`, `leasingSignals.t05ClosingRatio`, `leasingSignals.t06WeeklyLeases`, `leasingSignals.t07LeaseUpWeeksTo95`, `leasingSignals.stabilizedOccupancyPct`, `leaseUp.weeksTo90/93/95`, `calibrated.{vacancyPct,rentGrowthPct,exitCap,lastCalibrated}`, `mode.effective`, `mode.raw`, `yearly[*].vacancyPct`, `yearly[*].effRent`, `yearly[*].rentGrowthPct`, `yearly[*].t01WeeklyTours`, `yearly[*].t05ClosingRatio`, `yearly[*].t06WeeklyLeases` |

The panel uses **only 4 of the ~18 fields** available on `trafficProjection`. There is no asymmetric percentile band data on the response today (per `types.ts:303-311`), and no peer benchmark counts (`sampleCount`, `nPeerProperties`) — those would need backend work to surface.

---

## §5 — Operator interactions

| Interaction | Present? | Notes |
|---|---|---|
| Cadence toggle (W / M / Y) | Yes | Local `useState`, scales the same data by 1 / 4.33 / 52. Pure display transform — no backend write. |
| Collapse / expand | Yes | Parent-controlled via `expanded` prop + `'traffic-funnel'` key in `expandedSections` set |
| Cell-level edits | No | Fully read-only |
| Mode switcher | No | Mode is not consumed here at all |
| Inputs / dropdowns | No | Just the cadence buttons |
| Trigger M07 calibration from this panel | No | The offline message says "trigger a traffic prediction" but provides no in-panel CTA |

---

## §6 — Cross-reference with new LEASING M07 panel (Task #630) — CRITICAL SECTION

LEASING M07 panel (Task #630) headline metrics by mode:
- **Stabilized:** T-01, T-05, T-06, Derived Vacancy, Weeks to 95
- **Lease-Up:** pre-leased %, projected absorption rate (units/mo), projected stab month
- **Redevelopment:** peak down-units, post-reno absorption lag

| LEASING panel metric | Equivalent in Projections Traffic Engine UI? | Classification |
|---|---|---|
| **T-01 Walk-Ins/Week** (point-in-time leasingSignal) | NOT present here. Projections shows year-by-year `walkInsPerWeek` from `yearly[*]` — different granularity (time-series per year vs current snapshot). | **NO CONFLICT** — different field family. LEASING shows `leasingSignals.t01WeeklyTours` (snapshot); Projections shows `yearly[yr].walkInsPerWeek` (per-year). |
| **T-05 Trade-Area Capture %** | NOT present here. | **NO CONFLICT** — only on LEASING |
| **T-06 Net Leases/Wk** | NOT present here as a discrete metric. The "Leases" funnel row at line 885 binds to `yearly[yr].leasesPerWeek` (per-year), not `leasingSignals.t06WeeklyLeases` (snapshot). | **NO CONFLICT** — different field family (per-year time-series vs current snapshot) |
| **Derived Vacancy %** | Indirectly — the line-1956 footnote shows per-year `occupancyPct` (TIME_SERIES across years). LEASING would show current/equilibrium derived vacancy (POINT_IN_TIME). | **NO CONFLICT — TIME_SERIES stays here, LEASING shows snapshot** |
| **Weeks to 95% Stabilization** | NOT present here. `trafficProjection.leaseUp.weeksTo95` is on the source object but unused by `TrafficFunnelPanel`. | **NO CONFLICT — only on LEASING (newly surfaced)** |
| **Lease-Up Velocity (leases/mo)** | Adjacent — Projections "Leases" row at cadence = "M" shows `leasesPerWeek × 4.33` per year, which is the same math as the LEASING panel's lease-up velocity. But Projections shows it per year (TIME_SERIES); LEASING shows the current rate (POINT_IN_TIME). | **AMBIGUOUS — flag for review.** Both surfaces would show "leases/mo" but at different time slices. Resolution: LEASING labels its value "Current Lease Velocity"; Projections Y1 column stays as the per-year projection. No code change needed in either surface — just consistent labeling. |
| **Pre-leased %** (Lease-Up mode only) | NOT present here. | **NO CONFLICT** |
| **Projected absorption rate (units/mo)** (Lease-Up) | Indirectly — `leasesPerWeek × 4.33` per year is absorption. Projections shows it as a per-year time-series. | **NO CONFLICT — TIME_SERIES stays here** (Projections is the natural home for the absorption curve) |
| **Projected stab month** (Lease-Up) | Source field `leaseUp.weeksTo95` is not surfaced in either today. | **NO CONFLICT — both are net-new fields** |
| **Peak down-units** (Redevelopment) | Not on the response object today. | **NO CONFLICT — both pending backend** |
| **Post-reno absorption lag** (Redevelopment) | Not on the response object today. | **NO CONFLICT — both pending backend** |

**Net duplicates:** zero outright duplicates. **One ambiguous case:** lease velocity (leases/mo). Resolution established above — different time slices, consistent labeling resolves it without code changes.

---

## Final recommendation

The follow-on Projections build should be **"enhance with confidence bands + richer table"** — not "replace with time-series table."

Rationale:
1. The current `TrafficFunnelPanel` is **already a time-series table** (4 funnel rows × N year columns with W/M/Y cadence toggle). It is not a snapshot strip masquerading as one.
2. **Zero outright duplicates** with the LEASING M07 panel scope (Task #630). LEASING's headline metrics are point-in-time leasingSignals (`leasingSignals.t01/t05/t06`); Projections binds to per-year fields (`yearly[*].walkIns/tours/apps/leasesPerWeek`). Different field families, different time slices.
3. The source object carries **~14 unused fields** that could enrich this table without restructuring it: `yearly[*].vacancyPct/effRent/rentGrowthPct/t01-t06`, `leaseUp.weeksTo90/93/95`, `calibrated.*`, `mode.*`. A "richer table" build is in front of the agent already.
4. **Confidence bands are absent** here today, even though `leasingSignals.confidence` is on the response. Asymmetric percentile bands per `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` are not on the response object yet — that requires backend wiring, but a single confidence value can be surfaced today as a header/legend element.
5. The **one ambiguous case (lease velocity)** is best resolved by treating LEASING's value as "current" and Projections' Y1 column as "projected Y1," then visually linking them (e.g., callout) — not by removing either.

**Shape of follow-on build (Task #633):**
- Add a small confidence header (single value from `leasingSignals.confidence`) above the funnel table
- Add 3 more rows: per-year vacancy %, effective rent, rent growth — all already on `yearly[*]`
- Reserve a sub-panel for confidence bands once backend wires the percentile data; show "pending M07 backend wiring" placeholder until then
- No structural change; no removal of cadence toggle; no migration of fields to/from LEASING
