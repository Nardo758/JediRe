# JEDI RE - User Experience Design
**Version:** 1.0  
**Date:** 2026-02-03  
**Phase:** Pre-MVP Design

## Executive Summary

JEDI RE combines **map-based discovery** with **interactive feasibility modeling**. Users start broad (market view) and drill down to parcel-level analysis, then validate buildable scenarios in 3D. The interface prioritizes speed and clarity - answers in seconds, not spreadsheets.

---

## User Personas

### 1. **The Analyst** (Primary)
- Real estate analyst at investment firm or developer
- Needs: Fast market screening, data exports, buildable unit counts
- Tech comfort: High
- Workflow: Screen 50+ sites/week, deep-dive on 5-10

### 2. **The Principal** (Secondary)
- Managing partner, fund manager, or developer owner
- Needs: High-level insights, investment signals, quick validation
- Tech comfort: Medium
- Workflow: Review curated deals, validate gut checks, present to investors

### 3. **The Broker** (Tertiary)
- Commercial broker sourcing deals or pitching listings
- Needs: Quick comps, market stories, "What can you build here?"
- Tech comfort: Medium-Low
- Workflow: Answer client questions on the fly, create pitch decks

---

## Core User Flows

### Flow 1: Market Discovery
**Goal:** Find underutilized parcels in target submarkets

```
1. Land on map view (city-wide)
2. Filter by:
   - Submarket (dropdown/map boundary)
   - Zoning codes (MF-1, MF-2, etc.)
   - Capacity thresholds ("Show parcels with 50+ buildable units")
   - Probability score ("Show high-probability only")
3. See heatmap: Color-coded by weighted capacity
4. Click parcel → See capacity card (quick stats)
5. Add to watchlist or deep-dive
```

**UI Elements:**
- Left sidebar: Filters + layer toggles
- Center: Interactive map (Mapbox/Leaflet)
- Right panel (slides in): Parcel details card
- Bottom bar: Saved searches + watchlist

---

### Flow 2: Parcel Deep-Dive
**Goal:** Understand a specific parcel's development potential

```
1. Click parcel from map or search by address
2. See parcel detail page:
   - Hero stat: "87 buildable units (72% probability)"
   - Current state: Existing use, units, year built, owner
   - Zoning analysis: Code, max density, controlling constraint
   - Capacity breakdown: Theoretical vs practical vs weighted
   - Comparable parcels: "3 similar sites within 0.5 mi developed in last 3 years"
   - Market context: Submarket supply/demand charts
3. Actions:
   - "Model a building" → Launch 3D interface
   - "Export report" → PDF summary
   - "Add to watchlist"
   - "Share link"
```

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Back to map]           123 Main St, Atlanta            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ 87 BUILDABLE│  │ 72% LIKELY  │  │ MF-2 ZONING │    │
│  │   UNITS     │  │ TO DEVELOP  │  │  40 u/acre  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  Current State                     Capacity Analysis    │
│  • 12 units (1972)                • Theoretical: 115    │
│  • Garden-style apartments        • Practical: 103      │
│  • 0.87 acres                     • Weighted: 87        │
│  • Owned by LLC (since 2018)     • Constraint: Density  │
│                                                          │
│  [📊 View 10-year forecast]  [🏗️ Model a building]     │
│                                                          │
│  ─── Comparable Development Activity ───────────────    │
│  • 456 Oak St: 94 units, 2024 (0.3 mi away)            │
│  • 789 Elm Ave: 78 units, 2023 (0.4 mi away)           │
│  • 321 Pine Rd: 102 units, 2022 (0.5 mi away)          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 3: Interactive 3D Building Modeler
**Goal:** Validate if a building design is feasible on this parcel

```
1. From parcel page, click "Model a building"
2. Launch 3D interface:
   - Left: Parcel boundary (from GIS data)
   - Center: 3D viewport (simple massing blocks)
   - Right: Controls + real-time validation
3. User actions:
   - Drag building footprint on parcel
   - Adjust height (slider or type stories)
   - Set unit mix (studio/1br/2br/3br ratios)
4. Real-time feedback:
   ✅ "Within all zoning limits"
   ❌ "Exceeds max FAR by 0.3 (reduce to 4 stories or shrink footprint)"
   ⚠️ "Violates rear setback by 5 ft (move building north)"
   ✅ "87 units fits zoning (max 103)"
5. Export options:
   - Save scenario ("Option A: 87 units, 5 stories")
   - Generate feasibility summary (PDF)
   - Share link with team
```

**UI Layout (3D Modeler):**
```
┌─────────────────────────────────────────────────────────┐
│ 🏗️ Building Modeler: 123 Main St                       │
├──────────┬──────────────────────────────┬───────────────┤
│ Controls │   3D Viewport (Top View)     │  Validation   │
│          │                               │               │
│ Stories  │        ┌─────────┐           │ ✅ FAR: OK    │
│ [5    ]  │        │ ██████  │           │   (1.8/2.0)   │
│          │        │ ██████  │ ← Building│               │
│ Footprint│   Parcel boundary             │ ❌ Setback    │
│ [Auto  ] │        └─────────┘           │   Rear: -5ft  │
│          │                               │   (move N)    │
│ Unit Mix │   [Rotate] [Side View]       │               │
│ 1BR: 60% │                               │ ✅ Density    │
│ 2BR: 40% │   Ground Level: 18 units     │   87/103 max  │
│          │   Floors 2-5: 17 units each  │               │
│ Total    │   = 86 units                 │ ⚠️ Parking    │
│ 86 units │                               │   Need 130    │
│          │                               │   spaces      │
│          │                               │               │
│ [Save Scenario] [Export PDF]            │ [Help]        │
└──────────┴──────────────────────────────┴───────────────┘
```

**Validation Engine (Real-Time Checks):**
- FAR calculation: Building sqft / lot sqft ≤ max FAR
- Density check: Units / acres ≤ max density
- Setbacks: Building edges vs parcel boundaries
- Height: Max feet or stories
- Parking: Units × parking ratio
- Coverage: Footprint / lot size ≤ max coverage %

**Visual Feedback:**
- Green outlines = OK
- Red outlines = Violation
- Yellow = Warning (close to limit)
- Dimension labels show distances to boundaries

---

## Information Architecture

### Main Navigation

```
┌─────────────────────────────────────────────────────────┐
│ JEDI RE    [Markets ▾] [Saved] [Alerts] [Reports]  👤  │
└─────────────────────────────────────────────────────────┘
```

**Markets Dropdown:**
- Atlanta (active)
- Dallas
- Austin
- Charlotte
- Tampa
- [+ Request Market]

**Saved:**
- Watchlist (starred parcels)
- Saved searches
- Modeled scenarios

**Alerts:**
- New high-capacity parcels
- Recent development activity
- Zoning changes

**Reports:**
- Market overviews (10-year capacity by submarket)
- Pipeline analysis
- Custom exports

---

## Map Interface (Core Hub)

### Left Sidebar: Filters & Layers

```
┌─────────────────────┐
│ 🔍 FILTERS          │
├─────────────────────┤
│ Submarket           │
│ [All ▾]             │
│                     │
│ Zoning              │
│ ☑ MF-1, MF-2        │
│ ☐ MF-3, MF-4, MF-5  │
│                     │
│ Capacity            │
│ Min: [50  ] units   │
│ Max: [500 ] units   │
│                     │
│ Probability         │
│ [==●====] 60%+      │
│                     │
│ Owner Type          │
│ ☑ Individual        │
│ ☑ LLC               │
│ ☐ REIT              │
│ ☐ Institutional     │
│                     │
│ [Apply Filters]     │
│ [Reset]             │
├─────────────────────┤
│ 📊 LAYERS           │
├─────────────────────┤
│ ☑ Capacity heatmap  │
│ ☑ Zoning districts  │
│ ☐ Transit lines     │
│ ☐ Recent sales      │
│ ☐ Pipeline projects │
└─────────────────────┘
```

### Map View (Center)

**Visual Elements:**
- **Parcels:** Color-coded by weighted capacity
  - Dark green = High capacity (100+ units)
  - Light green = Moderate (50-100)
  - Yellow = Low (10-50)
  - Gray = Built out (<10)
- **Hover:** Quick tooltip (address, capacity, probability)
- **Click:** Open parcel detail card (right panel)
- **Zoom levels:**
  - City view: Submarket boundaries + aggregate stats
  - Neighborhood view: Individual parcels colored
  - Parcel view: Building footprints + labels

**Color Legend (Bottom Right):**
```
Weighted Capacity
■ 100+ units
■ 50-100 units  
■ 10-50 units
■ <10 units (built out)
```

### Right Panel: Quick View Card

**Triggered by:** Click parcel on map

```
┌─────────────────────────────────┐
│ 123 Main St                     │
│ Buckhead, Atlanta               │
├─────────────────────────────────┤
│ 87 Buildable Units              │
│ 72% Development Probability     │
│                                 │
│ Current: 12 units (1972)        │
│ Zoning: MF-2 (40 u/acre)        │
│ Lot: 0.87 acres                 │
│                                 │
│ [View Full Details]             │
│ [⭐ Add to Watchlist]           │
│ [Share]                         │
└─────────────────────────────────┘
```

---

## Key Features by Priority

### MVP (Phase 1 - Atlanta Proof of Concept)
1. **Map-based parcel discovery** with capacity heatmap
2. **Parcel detail page** with capacity analysis
3. **10-year capacity forecasts** by submarket
4. **Export to CSV/PDF**
5. **Basic user accounts** (save watchlists)

### Phase 2 (Multi-Market Expansion)
6. **Interactive 3D building modeler**
7. **Assemblage opportunity detection**
8. **Alert system** (new parcels, zoning changes)
9. **Market comparison** tool (Atlanta vs Dallas capacity)
10. **Mobile-optimized** interface

### Phase 3 (Advanced Analytics)
11. **Last Mover Advantage Index** (submarkets approaching buildout)
12. **Supply Overhang Risk Score** (hidden capacity warnings)
13. **Pricing Power Index** (rent growth vs supply forecast)
14. **Deal scoring** (investment opportunity ranking)
15. **API access** for institutional clients

---

## Design Principles

### 1. **Speed Over Depth** (For Discovery)
- Map loads in <2 seconds
- Filters apply instantly (client-side when possible)
- Hover tooltips show key stats without clicking
- "Quick actions" always visible (star, share, export)

### 2. **Progressive Disclosure** (For Analysis)
- Landing page: High-level market view
- Click parcel: Summary card (3 key stats)
- View details: Full capacity breakdown
- Model building: Deep technical validation

### 3. **Trust Through Transparency**
- Always show data sources ("Zoning from City of Atlanta, updated Q4 2025")
- Expose confidence scores ("Medium confidence: zoning rules parsed from PDF")
- Explain calculations ("Density-based: 0.87 acres × 40 u/acre = 35 max")
- Show comparable activity (proof that market is real)

### 4. **Mobile-First for Discovery, Desktop for Depth**
- Mobile: Map browsing, quick capacity checks, alerts
- Desktop: Full analysis, 3D modeling, report generation
- All views responsive (tablet = hybrid experience)

---

## Technology Stack (Suggested)

### Frontend
- **Framework:** React (fast, component-based)
- **Map:** Mapbox GL JS (vector tiles, fast rendering, 3D support)
- **3D Modeling:** Three.js (WebGL for building masses)
- **Charts:** Chart.js or Recharts (supply/demand visualizations)
- **State:** Redux or Zustand (manage filters, user state)

### Backend
- **API:** Node.js + Express (or Python + FastAPI)
- **Database:** PostgreSQL + PostGIS (spatial queries)
- **Caching:** Redis (for expensive capacity calculations)
- **File Storage:** S3 (GIS data, exports, user uploads)

### Data Pipeline
- **ETL:** Python scripts (Pandas, GeoPandas)
- **Zoning Parsing:** LLM-assisted (GPT-4 for PDF extraction)
- **Capacity Calculations:** Python engine (already designed)

---

## Wireframe Concepts (Text-Based)

### Landing Page (Logged Out)

```
┌─────────────────────────────────────────────────────────┐
│                        JEDI RE                          │
│         Real Estate Intelligence for Developers         │
│                                                          │
│  "See 10-year development capacity before your          │
│   competitors find the opportunities."                  │
│                                                          │
│           [Start Free Trial] [Watch Demo]               │
│                                                          │
│  ── Featured Insights ───────────────────────────────   │
│  • Buckhead: 2,847 units of weighted capacity           │
│  • Midtown: 89% buildout by 2030 (Last Mover window)   │
│  • Grant Park: 3 recent assemblages signal momentum     │
│                                                          │
│  ── How It Works ────────────────────────────────────   │
│  1. Choose your market (10 SE cities)                   │
│  2. Filter by capacity, zoning, probability             │
│  3. Analyze parcel feasibility in seconds               │
│  4. Model buildings in 3D to validate zoning            │
│  5. Export reports for your team                        │
│                                                          │
│  [Pricing] [Markets] [About] [Contact]                  │
└─────────────────────────────────────────────────────────┘
```

### Dashboard (Logged In)

```
┌─────────────────────────────────────────────────────────┐
│ JEDI RE    Atlanta ▾  [Saved] [Alerts] [Reports]   👤  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Your Market Snapshot (Atlanta)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 10-Year Weighted Capacity:  15,642 units         │  │
│  │ Pipeline (Under Construction):  3,891 units      │  │
│  │ Buildout Timeline:  8.3 years                    │  │
│  │                                                   │  │
│  │ Hottest Submarkets:                              │  │
│  │ 1. West Midtown: 1,247 units (68% probability)  │  │
│  │ 2. Old Fourth Ward: 891 units (74% probability) │  │
│  │ 3. Grant Park: 673 units (61% probability)      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  🎯 Your Watchlist (8 parcels)                          │
│  • 123 Main St, Buckhead: 87 units (UPDATED)            │
│  • 456 Oak St, Midtown: 94 units                        │
│  • 789 Elm Ave, Virginia-Highland: 52 units             │
│  [View All]                                              │
│                                                          │
│  🔔 Recent Alerts (3)                                    │
│  • New parcel in West Midtown: 112 units, 81% prob      │
│  • Zoning change in Buckhead (MF-2 → MF-3)             │
│  • Assemblage opportunity detected: 3-parcel block      │
│  [View All Alerts]                                       │
│                                                          │
│  [Browse Map] [Run Market Report] [Invite Team]         │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps (UX Implementation)

1. **Create clickable prototype** (Figma or Sketch)
   - Main map interface
   - Parcel detail page
   - 3D modeler mockup

2. **User testing with 5-10 analysts**
   - Watch them use prototype
   - Identify friction points
   - Validate information hierarchy

3. **Build MVP frontend** (React + Mapbox)
   - Start with map + filters + parcel cards
   - Defer 3D modeler to Phase 2
   - Focus on speed and data quality

4. **Iterate based on feedback**
   - Weekly user interviews during beta
   - Track usage analytics (which filters matter most?)
   - Refine before multi-market launch

---

## Questions to Resolve

1. **Freemium vs Paid-Only?**
   - Option A: Free tier (limited queries, Atlanta only) + Paid ($99-499/mo)
   - Option B: Trial period (14 days) → Paid only
   - Recommendation: Option A (freemium drives top-of-funnel)

2. **3D Modeler Complexity?**
   - Simple version: Rectangular blocks (quick to build)
   - Advanced: L-shapes, courtyard layouts (Phase 3)
   - Recommendation: Start simple, upgrade based on demand

3. **Export Formats?**
   - PDF: Market reports, parcel summaries
   - CSV: Bulk parcel data, capacity lists
   - API: For institutional clients to integrate
   - Recommendation: All three (API is premium feature)

4. **Mobile Strategy?**
   - Mobile web (responsive) vs Native app
   - Recommendation: Mobile web first (lower cost, faster iteration)

---

**Status:** Design doc ready for prototype phase  
**Next:** Create Figma mockups or build MVP frontend
