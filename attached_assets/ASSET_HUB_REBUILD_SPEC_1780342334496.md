# Asset Hub Console — Rebuild Spec (Replit)

**Target executor:** Replit Agent (UI integration)
**Canonical visual reference:** `asset_hub_console_v5.jsx` — *attach this file alongside this prompt; it is the source of truth for layout, tokens, component structure, and interaction behavior. This document is the wiring contract, IA, and scope.*
**Companion:** `ASSET_HUB_AUDIT.md` (all route/table/line citations below come from it)
**Property of record:** Highlands at Sweetwater Creek — `property_id = 7ea31caf-f070-43eb-9fd1-fe08f7123701`, `deal_id = eaabeb9f-830e-44f9-a923-56679ad0329d` (sole `is_portfolio_asset = TRUE` asset)
**Replaces:** `frontend/src/pages/AssetOwnedPage.tsx` (currently 3,166 lines, 16 tabs in 5 groups)

---

## 0. How to use this spec

1. The attached `asset_hub_console_v5.jsx` is the design. Reproduce its layout, the `T` token object, fonts, badges, panels, tables, charts, drawers, and every interaction exactly. Do **not** restyle.
2. This document tells you **what data feeds each panel** and **whether the backend for it already exists**. Each panel is tagged:
   - **WIRED** — a live route exists; call it.
   - **UNWIRED** — code/route/table exists but isn't reachable from this page; wire it (small fix).
   - **MOCK** — no real data feed at the needed grain; render from the prototype's placeholder shape and leave a `// TODO(data)` with the gap noted.
   - **NEW-BACKEND** — requires a route/service that does not exist. **Do NOT build the backend.** Code the UI against the contract in §7, render the prototype placeholder, and leave `// TODO(backend: <name>)`.
3. Do not invent endpoints. If a route isn't listed here or in the audit, treat it as NEW-BACKEND.

---

## 1. Scope

**In scope (you build):** the consolidated React console — information architecture, layout, components, interaction model, and wiring of every **WIRED**/**UNWIRED** panel to its route. Migrate page state to `dealStore`.

**Out of scope (flag, do not attempt):** all **NEW-BACKEND** items — the repricing synthesizer, M09 four-column live-tracking endpoint, per-member capital accounts, dual-waterfall modeling, RentCast/per-unit-type comp feed, running traffic predictions, `assetMode` on `DealContext`, `submarket_id` linkage (Task #1685). These are Claude Code / backend tasks; stub the UI per §7.

**Locked:** Bloomberg dark aesthetic. JetBrains Mono / IBM Plex. `≤2px` border-radius, no shadows (glow permitted only on the signal chip), `≥9px` font, no Tailwind color classes, no gradients on panels. Use the prototype's `T` object verbatim.

---

## 2. Information architecture

```
PORTFOLIO (left-nav VIEWS)
├── POSITIONS        portfolio roll-up grid          [not in this build — placeholder nav item]
├── ASSET            ← this console
│   ├── REVENUE      (default)
│   ├── PERFORMANCE  → sub-tabs: TRACKING · LIFECYCLE · EXIT
│   └── CAPITAL      → sub-tabs: DEBT & RATE · DISTRIBUTIONS · WATERFALL
└── REPORTS                                           [not in this build — placeholder nav item]

ASSET TAB BAR
├── [HIGHLANDS] active asset tab        + (add property to compare)
├── utility toolbar: EVENTS · FILES · TEAM · ACTIVITY   → right-side drawers
└── sub-nav: REVENUE | PERFORMANCE | CAPITAL

DRAWERS (right slide-over)
├── RANK & COMPS   (annual config: overall + per-unit-type rank target, editable comp set, subject pinned)
├── FILES          (DocumentsHub)
├── TEAM           (TeamSection)
├── EVENTS         (EventTimelineSection)
└── ACTIVITY       (ActivityTab)
```

Three-sub-tab-per-parent rule is enforced: ASSET has exactly 3; PERFORMANCE and CAPITAL each have exactly 3 internal sub-tabs. Files/Team/Events/Activity are drawers, **not** tabs. AI Learning is folded into PERFORMANCE thesis-checkpoint commentary, not a destination.

---

## 3. State & data architecture

- **Selected-asset state lives in `dealStore`** (Zustand), not local `useState`. The current page (`AssetOwnedPage.tsx`) uses pure local state + `apiClient` — migrate the asset id / context to `dealStore` so the console subscribes rather than prop-drills. No direct imports between panel components; they read from `dealStore` selectors.
- **Owned-asset context:** panels that call AI/analytical services must pass `assetMode: 'owned'`. The `DealContext` (`backend/src/types/dealContext.ts:604` → `ResearchAgentContext`) has **no** `assetMode` field yet → **NEW-BACKEND** (§7). Until present, omit the flag and leave `// TODO(backend: assetMode)`.
- **Keying:** ownership is keyed on `property_id` (`is_portfolio_asset = TRUE`), but the live operations routes join on `deal_id`. Always resolve through the asset's `deal_id` for operations calls; confirm the asset's `deal_id` is populated (it is, for Highlands).
- Each panel fetches in a `useEffect` keyed on `(dealId, subTab)`. **Do not** fire fetches from inside a render function (the current `RevenueMgmtTab` does this at lines 626–629, which is why the revenue tab shows empty despite 53 months of data — see §5 REVENUE).

---

## 4. Design tokens

Copy the `T` object and `css` block from `asset_hub_console_v5.jsx` unchanged. Primitives to reuse as-is: `Badge`, `PanelHeader`, `Panel`, `Table`, `StatRail`, `ChartPanel` (Recharts), `NavSection`, `Drawer`. Charts use Recharts with the prototype's exact axis/grid/tooltip styling.

---

## 5. Screen specs

Each panel below references its block in the prototype and its data source. Match the prototype layout; wire per the status tag.

### 5.1 REVENUE

| Panel (prototype block) | Data source | Status | Action |
|---|---|---|---|
| Hero chart — metric time series (occ / rent / NOI / RevPAU / loss-to-lease / concessions) | `GET /api/v1/operations/:dealId/monthly-actuals?limit=24` (`operations.routes.ts:752`) for occ/rent/NOI/RevPAU; loss-to-lease + concessions from `rent_roll_units` generated cols + `rent-roll-derivations.service.ts` (`derived_metrics` JSONB) | **WIRED** (occ/rent/NOI) / **UNWIRED** (LTL, concessions monthly series) | Wire monthly-actuals. LTL/concession monthly series: expose from rent-roll derivations; if no per-month series exists, render latest value flat and `// TODO(data)`. |
| Single-metric tile select + property COMPARE overlay (same metric, shared axis) | subject = above. Comparison properties: per-comp metric **time series** | **MOCK** | Subject line is real. Comp overlay lines: no per-comp time-series feed exists (`apartment_market_snapshots` is submarket-aggregate, 104 rows, no per-property history). Render prototype's synthetic comp lines; `// TODO(data: per-comp metric series)`. For *owned*-property compare, pull each asset's monthly-actuals. |
| Asset Overview rail (fundamentals + JEDI Score) | monthly-actuals + rent-roll derivations; JEDI Score from `f40-performance-score.service.ts` / M25 | **WIRED** except **Market Rent** | Market rent (for loss-to-lease) needs per-unit-type comp feed → **MOCK** (`// TODO(data: market rent)`). |
| JEDI SIGNAL chip (PUSH/HOLD) | repricing synthesizer | **NEW-BACKEND** | Render from course response (§7 `/revenue/course`). Stub. |
| **REPRICING COURSE** (cohorts, captured $, lift, per-cohort PUSH/HOLD/CONCEDE) | repricing synthesizer | **NEW-BACKEND** | UI reads `GET /api/v1/revenue/:dealId/course` (§7). Render placeholder; the rank-target control drives the request params. |
| LEASE ROLL (24-mo expiration waterfall + trade-out spread per cohort) | expirations: `GET /api/v1/operations/:dealId/lease-expirations` (`operations.routes.ts:302`, computed by `rent-roll-derivations.service.ts:151`) — **WIRED**. Trade-out per cohort: `lease_tradeout_events` (1,492 rows) has **no route** | **WIRED** (expirations) / **NEW-BACKEND** (trade-out detail) | Wire expirations. Trade-out spread column reads `GET /api/v1/operations/:dealId/tradeout-events` (§7). |
| MARKET SIGNALS (traffic velocity, digital share, wage-vs-rent, pipeline, comp concessions, in-migration) | `GET /api/v1/correlations/property/:propertyId` (`correlation.routes.ts:59`, 30 signals) + traffic velocity from M07 | **UNWIRED / partial** | Wire correlation signals. Traffic Velocity requires `traffic_predictions` which is **empty (0 rows)** — `// TODO(backend: run POST /api/v1/traffic/predict/:propertyId)`. Note `submarket_id = NULL` degrades submarket signals (Task #1685). |
| COMP SET & RANK (ranked leaderboard w/ subject inserted at its rank) | comps from comp set; rank/PCS from rankings service; subject = this asset | **UNWIRED / partial** | Comp set: `GET /api/v1/lifecycle/:dealId/comp-set` (used by `CompSetTab`). Rank/PCS: rankings service (`rankings.routes.ts`) — wire if present, else **MOCK** the PCS values. Subject row pinned & highlighted per prototype. |

### 5.2 PERFORMANCE — sub-tabs TRACKING · LIFECYCLE · EXIT

| Panel | Data source | Status | Action |
|---|---|---|---|
| Tracking hero — actual vs pro-forma NOI | `GET /api/v1/operations/:dealId/projected-vs-actual` (`operations.routes.ts:631`) | **WIRED** | Reuse existing `PerformanceTab` logic; restyle to prototype. |
| Underwriting Scorecard + THESIS signal | projected-vs-actual + `GET /:dealId/variances` (`:113`) | **WIRED** | |
| **LIVE TRACKING 4-col** (`CURRENT \| ACTUALS TTM \| PRO FORMA \| Δ`) | M09 4-col composition | **NEW-BACKEND** | No canonical component exists (`formula-engine.ts:951` has the M22 formula only). UI reads `GET /api/v1/operations/:dealId/live-tracking` (§7); stub. |
| Line-item variance (>10% flagged) | `GET /:dealId/variances` (`:113`) + `deal_monthly_actuals_lines` (1,653 rows, GL) | **WIRED** | Use `POST /:dealId/variances/compute` (`:135`) to refresh. |
| Cap-ex vs budget | M22 capex schedule | **UNWIRED** | Verify capex source on `deal_monthly_actuals`; if absent, **MOCK** + `// TODO(data)`. |
| Thesis checkpoints (AI commentary) | `commentary.agent.ts` (758 ln) | **UNWIRED / partial** | Commentary agent is market/acquisition-focused; pass `assetMode:'owned'` once available. Render its output; **MOCK** the asset-performance framing meanwhile. |
| LIFECYCLE sub-tab | existing `LifecycleSection` | **WIRED** | Reuse component; restyle. |
| EXIT sub-tab | existing `ExitTimingTab` | **WIRED** | Reuse component; restyle to the ranked hold/sale/refi table. |

### 5.3 CAPITAL — sub-tabs DEBT & RATE · DISTRIBUTIONS · WATERFALL

| Panel | Data source | Status | Action |
|---|---|---|---|
| DEBT & RATE hero — SOFR vs all-in, cap-strike reference line | loan record (rate, spread, index) + SOFR series (FRED; rate unification D3 merged) | **UNWIRED / partial** | Wire loan terms from the deal's debt record + FRED SOFR series. Cap strike / hedge fields likely absent → **MOCK** (`// TODO(data: rate cap / hedge)`). |
| Debt Overview rail + RATE EXPOSURE signal | loan record | **UNWIRED** | |
| Rate Sensitivity (DSCR by rate path), Refi Window, Hedge Status | computed from loan + cap terms | **MOCK** | Compute client-side from wired loan fields where present; stub cap-dependent rows. |
| DISTRIBUTIONS — per-member capital accounts | `/api/v1/capital/*` (`investor-capital.routes.ts`) | **NEW-BACKEND** | Routes exist but only **deal-level** LP/GP splits (`formula-engine.ts:1326-1327`); no per-member accounts (`capital_calls`=0, `distributions`=2). UI reads `GET /api/v1/capital/:dealId/capital-accounts` (§7); stub. `InvestorCapitalModule` exists — reuse its shell. |
| WATERFALL — dual (operating cash + capital-event, 1.40x MOIC floor) | waterfall engine | **NEW-BACKEND** | Only one deal-level waterfall modeled (`deal_waterfalls`=1). UI reads `GET /api/v1/capital/:dealId/waterfall?type=operating\|capital` (§7); stub both tiers tables. |

### 5.4 Drawers

| Drawer | Source | Status |
|---|---|---|
| FILES | `DocumentsHub` | **WIRED** — reuse |
| TEAM | `TeamSection` | **WIRED** — reuse |
| EVENTS | `EventTimelineSection` → `key_events LEFT JOIN event_forecasts` (canonical path) | **WIRED** — reuse |
| ACTIVITY | `ActivityTab` | **WIRED** — reuse |
| RANK & COMPS | comp-set edit + rank-target persistence | **UNWIRED / NEW** | comp-set read = `GET /lifecycle/:dealId/comp-set`; comp edits + rank-target (overall + per-type) persistence = `POST /api/v1/rankings/:propertyId/target` (§7, **NEW-BACKEND**). |

---

## 6. Net-new backend contracts (UI codes against these; backend built separately)

Build the UI to consume these shapes and render the prototype placeholder until each is live. Leave a `// TODO(backend: <name>)`.

```
GET /api/v1/operations/:dealId/tradeout-events
→ [{ unit_type, event_type:'new'|'renewal', prior_rent, new_rent, spread_pct, effective_date }]

GET /api/v1/operations/:dealId/leasing-observations
→ [{ week, traffic, tours, applications, leases, net_absorption }]

GET /api/v1/revenue/:dealId/course?targetRank=2&byType=false
→ { captured_per_mo, total_ltl_per_mo, net_lift_pct, signal:'PUSH'|'HOLD',
    cohorts:[{ unit_type, units, window, action:'PUSH'|'HOLD'|'CONCEDE', delta, reason }] }

GET /api/v1/operations/:dealId/live-tracking
→ [{ line_item, current, actuals_ttm, pro_forma, delta_pct }]   // M09 4-col

GET /api/v1/capital/:dealId/capital-accounts
→ { members:[{ name, role, committed, called, distributed, pref_accrued, current_tier }], summary:{...} }

GET /api/v1/capital/:dealId/waterfall?type=operating|capital
→ { tiers:[{ tier, detail, lp_split, gp_split }] }

GET  /api/v1/rankings/:propertyId
→ { current_rank, current_pcs, set_size, set_label, comps:[{ name, rank, pcs, ... }] }
POST /api/v1/rankings/:propertyId/target
  body { overall:int, byType:bool, perType:{ '1BR':int, '2BR':int, ... } }
```

---

## 7. Interaction behaviors (must match prototype exactly)

1. **Single-metric chart select.** Hero stat tiles are single-select; clicking one plots that metric in native units. No index/rebase toggle.
2. **Property COMPARE.** A property picker scoped to the selected metric: subject (Highlands) is the pinned base line; toggling a comp overlays that comp's *same metric* on the shared axis (same units). Each property has a fixed line color; the chip's color swatch is the legend. `+ owned property` is a placeholder entry.
3. **Rank target drives the course.** The annual rank target (set in the RANK & COMPS drawer) parameterizes `/revenue/course`. Higher target → more aggressive cohort actions. When "set by unit type" is on, each cohort uses its own per-type target.
4. **Rank is annual, set-and-forget.** It lives only in the drawer; the live surface shows the *result* in COMP SET & RANK and a small "edit target" link on the course header.
5. **Subject in the ranked set.** The COMP SET leaderboard inserts the subject at its rank, highlighted (amber tint + left bar + ▸). In the drawer's comp editor the subject is pinned and non-removable; user comps are removable and tagged `user` vs `platform`.
6. **Timeframe** selector (3M/6M/1Y/2Y/MAX) slices every chart.
7. **PERFORMANCE / CAPITAL sub-tabs** switch inner views; **utility drawers** open from the toolbar icons.

---

## 8. Acceptance criteria & QA gates

**Phase A — Shell & IA** *(STOP for review)*
- [ ] New console renders at the asset route with the exact prototype layout, tokens, and three ASSET tabs.
- [ ] Sub-nav, PERFORMANCE/CAPITAL sub-tabs, and all four utility drawers + RANK & COMPS drawer open/close.
- [ ] Selected-asset state reads from `dealStore`; no fetches fired from render functions.

**Phase B — Wire live data** *(STOP for review)*
- [ ] REVENUE hero shows real Highlands occ/rent/NOI from `monthly-actuals` (53 months) — **no empty state**.
- [ ] LEASE ROLL shows real expirations from `lease-expirations`.
- [ ] MARKET SIGNALS shows real correlation signals from `/correlations/property/:id`.
- [ ] PERFORMANCE Tracking + variance wired to `projected-vs-actual` + `variances`.
- [ ] LIFECYCLE/EXIT reuse existing components, restyled.
- [ ] Drawers (Files/Team/Events/Activity) reuse existing components.

**Phase C — Stub net-backend** *(STOP for review)*
- [ ] Every **NEW-BACKEND** panel renders the prototype placeholder, codes against the §6 contract, and carries a `// TODO(backend: …)`.
- [ ] No fabricated data presented as live; placeholders visibly illustrative where rank/PCS, course, 4-col, capital accounts, waterfall, debt-cap are unbuilt.

**Global**
- [ ] Aesthetic unchanged from prototype (verify tokens, radius ≤2px, no shadows/gradients, font ≥9px).
- [ ] Operations calls resolve via `deal_id`; Highlands data renders.
- [ ] No regression to existing reused components.

---

## 9. Build sequence

1. Scaffold shell + IA + drawers (Phase A). **Stop.**
2. Wire all WIRED/UNWIRED panels (Phase B), fixing the render-fetch bug. **Stop.**
3. Stub NEW-BACKEND against §6 contracts (Phase C). **Stop.**
4. Hand back; backend (Claude Code) implements §6 + `assetMode` + Task #1685 + traffic predict run; re-wire stubs as each lands.

---

## 10. Placeholders to preserve as TODO (do not present as real)

- Rank / PCS values and the rank→RevPAU gap (rankings service wiring pending).
- Repricing course cohorts/captured-$ (synthesizer pending).
- M09 four-column live tracking (endpoint pending).
- Per-comp metric time-series for the COMPARE overlay (per-comp feed pending).
- Per-member capital accounts and dual waterfall (modeling pending).
- Rate cap / hedge fields and rate-sensitivity rows (debt-cap tracking pending).
