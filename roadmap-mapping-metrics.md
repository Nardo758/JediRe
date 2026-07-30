# Performance Metrics on Mapping Surface — Product Roadmap

## Vision
Transform `/surface` from a parcel discovery tool into the platform's **geospatial intelligence command center**. Every deal, asset, and market signal mapped with color-coded performance metrics so users spot patterns, outliers, and opportunities at a glance.

---

## Current State (Today)

| Feature | Status |
|---------|--------|
| `/surface` route + page | ✅ Live |
| Assessor parcel search (address / parcel ID) | ✅ Live |
| Parcel boundary rendering on Mapbox | ✅ Live |
| Create Deal from parcel selection | ✅ Live |
| Terminal MAP dropdown → `/surface` | ✅ Live |
| Property address links → `/surface` | ✅ Live |
| War Map (Terminal sidebar) | ✅ Live — separate surface |

**Gap**: No pipeline or portfolio data on `/surface`. No performance visualization.

---

## Phase 1: Pipeline + Portfolio Overlay (This Session)

**Goal**: See your deals on the map. Color them by performance.

### Deliverables

| # | Feature | User Value |
|---|---------|-----------|
| 1.1 | `GET /api/v1/properties/geo` endpoint | Backend serves all geo-located properties with latest metrics |
| 1.2 | Layer toggles (`☑ Parcels ☑ Pipeline ☑ Portfolio`) | User controls what's visible |
| 1.3 | **Color By** selector (`JEDI Score`, `Occupancy`, `Rent Growth`, `Concessions`, `Vacancy Loss`) | Pins color-coded by chosen metric |
| 1.4 | **Display** selector (what number shows on the flag pin) | One metric displayed per pin |
| 1.5 | SVG flag pins (🚩 shaped, colored by metric tier) | Glanceable, scannable map |
| 1.6 | Click pin → expandable modal popup | Full metrics + deal link |
| 1.7 | Legend bar (🟢 Strong 🟡 Fair 🟠 Watch 🔴 Risk) | Context for colors |

### Pin Design

```
    ┌───┐
    │ 84│  ← Display metric (e.g., JEDI Score)
    └───┘
      │
   📍══╧══  ← Flag body colored by metric tier
```

### Metric Color Scales

| Metric | 🟢 Strong | 🟡 Fair | 🟠 Watch | 🔴 Risk |
|--------|----------|---------|----------|---------|
| JEDI Score | ≥70 | 50–69 | 35–49 | <35 |
| Occupancy | ≥93% | 85–92% | 75–84% | <75% |
| Rent Growth | ≥3% | 1–2.9% | 0–0.9% | <0% |
| Concessions | <$5K | $5–15K | $15–30K | >$30K |
| Vacancy Loss | <$5K | $5–15K | $15–30K | >$30K |

### Files
- `backend/src/api/rest/property-geo.routes.ts`
- `frontend/src/components/map-surface/FlagPin.tsx`
- `frontend/src/components/map-surface/DealPinLayer.tsx`
- `frontend/src/components/map-surface/DealPinPopup.tsx`
- `frontend/src/pages/MapDiscoveryPage.tsx` (layer controls)

---

## Phase 2: Market Heatmaps + Clustering

**Goal**: See the forest, not just the trees. Understand submarket performance at a glance.

### Deliverables

| # | Feature | User Value |
|---|---------|-----------|
| 2.1 | Submarket boundary polygons overlay | Visual market boundaries |
| 2.2 | Submarket heatmap layer (color by avg occupancy, rent growth, SCHI) | Identify hot vs. cold submarkets |
| 2.3 | Deal clustering at low zoom (cluster count badge) | Clean map at city-wide view |
| 2.4 | Cluster click → spider-out of individual pins | Drill down from cluster |
| 2.5 | Comparative side-panel ("How does this deal compare to its submarket?") | Contextual intelligence |

### Visual

```
┌─────────────────────────────────────────────┐
│  [Occupancy Heatmap ▾]  [Pipeline ░░░░░]   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ████████████░░░░░░░░░░             │   │
│  │  ████████░░░░░░░░░░░░░░  ← heatmap  │   │
│  │  ████████████████░░░░░░             │   │
│  │           [14]  [8]  ← clusters      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Midtown: 94.2% avg occ │ Buckhead: 88.1%  │
└─────────────────────────────────────────────┘
```

---

## Phase 3: Predictive Intelligence Layer

**Goal**: AI surfaces patterns the user wouldn't spot manually.

### Deliverables

| # | Feature | User Value |
|---|---------|-----------|
| 3.1 | AI-suggested "anomaly" pins (deals underperforming their submarket) | Find hidden problems |
| 3.2 | AI-suggested "opportunity" pins (parcels near outperforming assets) | Find land to buy near winners |
| 3.3 | Rent growth trajectory arrows (direction + velocity) | See momentum, not just state |
| 3.4 | Supply pipeline layer (permitted units under construction nearby) | Anticipate competition |
| 3.5 | M35 event impact zones (overlay employment/infrastructure events) | Understand catalysts |

### Visual

```
┌─────────────────────────────────────────────┐
│  AI Insights:                               │
│  ⚠ 3 assets underperforming submarket       │
│  ✦ 2 parcels near outperforming comps       │
│  ↑ 5 assets with accelerating rent growth   │
│                                             │
│  [Show AI Insights]                         │
└─────────────────────────────────────────────┘
```

---

## Phase 4: Surface Unification (Single Map)

**Goal**: One map to rule them all. Retire the War Map sidebar.

### Deliverables

| # | Feature | User Value |
|---|---------|-----------|
| 4.1 | Migrate War Map layers into `/surface` (Midtown Research, Competitor Analysis, Broker Recommendations, News Intelligence) | All intelligence on one canvas |
| 4.2 | Terminal MAP button navigates directly to `/surface` (no dropdown) | Faster access |
| 4.3 | `/surface` becomes the deal detail F7 3D module's map tab | Consistent mapping everywhere |
| 4.4 | Pascal 3D editor integration: click parcel → open building design | Design on the land you found |
| 4.5 | Full-screen presentation mode (for LP/investor meetings) | Shareable, polished views |

### Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search  │  Layers ▾  │  Color By ▾  │  AI Insights ▾  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  🟢 🟠 🔴 🏠 📍 🚩 ⬆ ⚠ ✦                           │   │
│  │                                                     │   │
│  │  [Heatmap overlay]                                  │   │
│  │  [Submarket boundaries]                             │   │
│  │  [M35 event zones]                                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Legend:  🟢 Strong  🟡 Fair  🟠 Watch  🔴 Risk           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Metrics Library (expandable over time)

| Category | Metrics |
|----------|---------|
| **Financial** | JEDI Score, IRR, Equity Multiple, Cap Rate, NOI, DSCR |
| **Operations** | Occupancy, Vacancy Loss, Concessions, Avg Rent, Market Rent, Lease Expirations |
| **Market** | Rent Growth, Absorption, New Supply, SCHI, Employment Growth |
| **Risk** | Days in Stage, Alert Count, Divergence Score, Arbitrage Flag |
| **AI** | Opportunity Score, Confidence, Anomaly Flag, Trend Direction |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to spot an underperforming asset | < 10 seconds (vs. 5+ minutes in grid view) |
| Deals discovered from map | 20% of new deals created via `/surface` |
| User engagement with metrics | 60% of /surface sessions use metric coloring |
| Layer toggle usage | Pipeline + Portfolio layers active in 40% of sessions |

---

## Dependencies

| Dependency | Status |
|-----------|--------|
| `properties.lat` / `properties.lng` populated | ✅ Schema ready — verify data exists |
| `dealMonthlyActuals` data | ✅ Table exists — verify recency |
| Mapbox GL JS | ✅ Already used in War Map + PropertyBoundarySection |
| Assessor API integration | ✅ Already powering `/surface` parcel search |
| Pascal 3D editor | ✅ Vendored — integration Phase 4 |

---

## Decision: Combine Surfaces Now or Later?

**Recommendation: Build Phase 1 on `/surface` now. Unify in Phase 4.**

Rationale:
- `/surface` already has assessor parcel search + Create Deal — adding pipeline pins is additive
- War Map still serves users who need the existing layer system while we build
- No breaking changes to existing workflows
- Phase 4 unification happens after `/surface` proves its value

---

*Last updated: 2026-07-29*
*Next: Phase 1 implementation — flag pins + metric coloring + expandable popups*
