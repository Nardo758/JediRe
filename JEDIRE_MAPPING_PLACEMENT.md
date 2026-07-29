# JediRe Mapping Surface — Platform Placement Analysis

**Status:** Research Complete  
**Date:** 2026-07-25  
**Scope:** Identify every existing map touchpoint and recommend exact placement for the new Mapping Surface

---

## 1. KEY FINDING: F7 IS UNASSIGNED

After auditing the full module registry in `frontend/src/shared/config/deal-type-visibility.ts`, **F7 has no module assigned to it.** This is the natural slot for the Mapping Surface within the Deal Detail workflow.

### Current F-Key Assignment (Deal Detail Page)

| F-Key | Module ID | Module Name | Category | Status |
|---|---|---|---|---|
| F1 | M01 | Deal Overview | Core | ✅ Assigned |
| F2 | M02 | Zoning & Entitlements | Intelligence | ✅ Assigned |
| F3 | M05 | Market Analysis | Intelligence | ✅ Assigned |
| F3 | M27 | Sale Comp Intelligence | Intelligence | ⚠️ Conflict — both F3 |
| F4 | M04 | Supply Pipeline | Intelligence | ✅ Assigned |
| F5 | M08 | Strategy Arbitrage | Core | ✅ Assigned |
| F6 | M07 | Traffic Intelligence | Intelligence | ✅ Assigned |
| **F7** | **—** | **AVAILABLE** | **—** | **🎯 OPEN SLOT** |
| F8 | M11 | Capital Structure | Financial | ✅ Assigned |
| F9 | M09 | ProForma Engine | Financial | ✅ Assigned |
| F10 | M14 | Risk Dashboard | Intelligence | ✅ Assigned |
| F11 | M21 | Deal Tools | Core | ✅ Assigned |
| F12 | M12 | Exit Analysis | Financial | ✅ Assigned |
| F12 | M35 | Event Impact Engine | Core | ⚠️ Conflict — both F12 |

> **Note:** There are existing F-key conflicts (M05/M27 both F3, M12/M35 both F12). The Mapping Surface module should take **F7** cleanly with no collision.

---

## 2. EXISTING MAP TOUCHPOINTS IN JEDIRE

### 2.1 Deal Detail Page (`/deals/:dealId/detail`)

**Current Map-Related Components:**

```
DealDetailPage.tsx (1792 lines)
├── Tab Navigation (sidebar)
│   ├── M02: Zoning & Entitlements (F2)
│   │   └── ZoningLookupTab — has a MapPlaceholder component
│   │   └── DevelopmentCapacityTab — buildable envelope visualization
│   ├── M05: Market Analysis (F3)
│   │   └── Contains supply/demand charts (no map)
│   ├── M07: Traffic Intelligence (F6)
│   │   └── TrafficEngineV2Section — trade area map, traffic counts
│   │   └── TrafficCoefficientsTab — traffic data tables
│   └── M15: Competition Analysis
│       └── Competition data tables (no map)
│
└── Standalone 3D Design Route (NOT a tab)
    └── /deals/:dealId/design → Design3DPage
```

**The Problem:** The existing 3D Design editor is a **standalone route** (`/deals/:dealId/design`) accessible via a CTA button from the Zoning module — NOT a first-class module tab. This creates friction:

1. User is in Zoning tab → sees "Design Unit Program →" CTA
2. Clicks CTA → navigates AWAY from Deal Detail to `/deals/:dealId/design`
3. Loses context of other modules (can't see ProForma, Capital Structure, etc. while designing)
4. To go back, clicks "Back to Deal" → returns to Deals list, not the specific tab they were on

**The Opportunity:** The Mapping Surface (with integrated 3D design) becomes **F7 — a first-class module tab** inside Deal Detail, keeping the user in context.

---

### 2.2 Terminal Page (`/terminal/:section`)

**Current Map-Related Components:**

```
TerminalPage.tsx (3071 lines) — Bloomberg Terminal v3
├── Terminal Sections (token-based navigation)
│   ├── dashboard → NeuralNetworkHubWidget, MorningBriefWidget
│   ├── pipeline → Pipeline grid/list views
│   ├── portfolio → F3PortfolioView
│   ├── markets → F4MarketsView (has map)
│   ├── news → NewsIntelligencePage
│   ├── strategies → StrategyBuilderPage / M08StrategyBuilderPage
│   ├── settings → SettingsPage
│   └── reports → Various report views
│
├── TerminalMapView — imported but used WHERE?
│   └── Located at: frontend/src/components/map/TerminalMapView.tsx
│
└── TickerBar — market data ticker at bottom
```

**Finding:** `TerminalMapView` is imported in TerminalPage but needs verification of where it's actually rendered. The F4 Markets view (`F4MarketsView`) is the primary map surface in Terminal, showing:
- Market heatmaps
- Supply/demand overlays
- Property bubbles
- MSA-level geographic analysis

---

### 2.3 Standalone Map Page (`/map`)

```
App.tsx routing:
<Route path="/map" element={<MapPage />} />
```

**Legacy route** — still exists but most traffic redirects to `/terminal/*` routes. MapPage likely contains the original map implementation that predates the Terminal.

---

### 2.4 3D Design Page (`/deals/:dealId/design`)

**Current Implementation:**

```
Design3DPage.tsx (521 lines)
├── Loads deal data via /api/v1/deals/:dealId
├── Loads parcel boundary from dealData.boundary
├── Loads zoning profile from /api/v1/deals/:dealId/zoning-profile
├── Loads scenarios from /api/v1/deals/:dealId/scenarios/recommendations
├── Renders Building3DEditor (full-screen)
├── Side panel: Design Metrics (unit mix, SF, FAR, parking, amenities)
├── Auto-save to localStorage
└── Export to JSON
```

**Building3DEditor** (`frontend/src/components/design/Building3DEditor.tsx`) is the current 3D editor — NOT Pascal Editor. It's a custom implementation that:
- Takes `parcelGeometry` as GeoJSON
- Has `useDesign3DStore` for state
- Tracks: totalUnits, unitMix, rentableSF, grossSF, stories, farUtilized, parkingSpaces
- Does NOT use React Three Fiber (appears to be a custom canvas-based or simpler 3D solution)

**This is the component that would be REPLACED or UPGRADED by Pascal Editor integration.**

---

### 2.5 Asset Hub Console (`/assets-owned/:dealId/property`)

```
App.tsx routing:
<Route path="/assets-owned/:dealId/property" element={<AssetHubPage />} />
```

**Post-close asset management surface.** Currently does NOT have a map view but would benefit from:
- Parcel boundary visualization
- Property context (neighborhood demographics, traffic)
- Comparison to acquisition underwrite assumptions

---

## 3. RECOMMENDED PLACEMENT FOR JEDIRE MAPPING SURFACE

### 3.1 PRIMARY: Deal Detail Module Tab — F7 "Property Surface"

**New Module Definition:**

```typescript
// Addition to MODULE_TABS in deal-type-visibility.ts
{
  moduleId: 'M30',  // Next available module ID
  name: 'Property Surface',
  fKey: 'F7',
  station: 'S1',     // Intake & Triage — maps are foundational context
  stationLabel: 'Intake & Triage',
  category: 'Intelligence',
  showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
  dealTypeNotes: 'Map-centric parcel intelligence with 3D design mode. Shows parcel boundaries, ownership, traffic, demographics, and custom overlays. Includes 3D building design for dev/redev deals.',
}
```

**Tab Content by Deal Type:**

| Deal Type | 2D Map Content | 3D Mode Content |
|---|---|---|
| **Existing** | Parcel boundary, ownership, assessed value, traffic, comps radius | Not applicable (building already exists) |
| **Development** | Parcel boundary, ownership, zoning district, traffic, demographics, nearby comps | Full Pascal Editor: setbacks, massing, unit mix, FAR calculation |
| **Redevelopment** | Parcel boundary, ownership, existing structure, zoning, traffic, comps | Pascal Editor: existing vs. proposed, renovation scenarios |

**User Flow:**

```
User opens Deal Detail
    │
    ▼
Press F7 (or click "Property Surface" in sidebar)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROPERTY SURFACE — F7                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              2D MAP (Mapbox GL)                         │   │
│  │                                                         │   │
│  │  • Parcel boundary (highlighted)                        │   │
│  │  • Ownership info card (top-left overlay)               │   │
│  │  • Traffic counts on nearby roads                       │   │
│  │  • Comp properties in 1-mile radius                     │   │
│  │  • Zoning district overlay                              │   │
│  │  • Demographics heatmap (toggleable)                    │   │
│  │                                                         │   │
│  │  [Layer Panel] ☑ Parcels ☑ Traffic ☑ Comps ☑ Zoning    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [2D Map] [3D Design] [Split View]                              │
│                                                                 │
│  Left Panel (collapsible):                                      │
│  • Parcel Details (owner, assessment, land use)                 │
│  • Ownership History                                            │
│  • Traffic Analysis                                             │
│  • Demographics Summary                                         │
│  • [Add Custom Overlay]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
Click [3D Design] (development/redevelopment deals only)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  3D DESIGN MODE                                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │         Pascal Editor (React Three Fiber)               │   │
│  │                                                         │   │
│  │  • Parcel boundary = Site node                          │   │
│  │  • Auto-calculated setback lines = Guide nodes          │   │
│  │  • Building massing with wall/slab tools                │   │
│  │  • Zone definitions for unit mix                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tools: [Select] [Wall] [Slab] [Zone] [Item] [Measure]          │
│                                                                 │
│  Metrics Panel:                                                 │
│  • FAR: 3.2 / 4.0 (80% utilized)                              │
│  • Units: 48 (studio: 8, 1BR: 24, 2BR: 16)                     │
│  • Parking: 52 spaces (1.08/unit)                              │
│  • GFA: 145,000 SF                                             │
│  • [Sync to ProForma] [Save Design] [Export]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Integration with Existing Modules:**

| Source Module | Data Flow INTO Property Surface | Data Flow FROM Property Surface |
|---|---|---|
| M02 Zoning (F2) | Zoning district, setbacks, max FAR, max units | — |
| M05 Market (F3) | Comp locations, submarket boundaries | Selected comp radius for analysis |
| M07 Traffic (F6) | Trade area polygon, traffic coefficients | Selected road segments for deep analysis |
| M09 ProForma (F9) | — | Design metrics → unit count, GFA, parking |
| M29 Unit Mix | Target unit mix | Actual designed unit mix |

---

### 3.2 SECONDARY: Terminal Section — "Map Intelligence"

**New Terminal Section:** `/terminal/maps`

This is the **macro view** — portfolio-level, market-level, and opportunity-level map intelligence:

```
Terminal Page — New Token: "maps"
┌─────────────────────────────────────────────────────────────────┐
│  MAP INTELLIGENCE — Terminal Section                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │         MARKET-LEVEL MAP (Mapbox GL)                    │   │
│  │                                                         │   │
│  │  • All deals in pipeline (color-coded by stage)         │   │
│  │  • All owned properties                                 │   │
│  │  • Supply pipeline (new construction permits)           │   │
│  │  • Traffic corridors (AADT heatmap)                     │   │
│  │  • Zoning opportunity zones                             │   │
│  │  • Demographic trends (income, population growth)       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Layer Panel:                                                   │
│  ☑ My Deals        ☑ Owned Properties    ☑ Supply Pipeline     │
│  ☑ Traffic         ☑ Zoning Changes      ☑ Demographics        │
│  ☑ Sale Comps      ☑ Custom Layer 1      ☑ Custom Layer 2      │
│                                                                 │
│  Click any parcel → "Open in Deal Detail" or "Create Deal"     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Use Cases:**
- **Acquisition team:** See all target properties on one map with traffic + comp overlay
- **Development team:** Identify zoning opportunity zones with traffic corridors
- **Asset management:** Portfolio heatmap showing all owned assets + nearby supply threat
- **Brokerage:** Map all listings + recently sold comps + traffic counts for pitch decks

---

### 3.3 TERTIARY: Asset Hub Console — "Property Context"

**Enhancement to:** `/assets-owned/:dealId/property`

Post-close map context for operating properties:
- Parcel boundary (for reference)
- Ownership verification (did the owner on record match the seller?)
- Traffic trend since acquisition (is the road getting busier?)
- New supply within 1-mile radius (threat detection)
- Demographic shift since acquisition

---

## 4. IMPLEMENTATION ORDER

Based on user impact and technical dependency:

| Priority | Placement | Effort | Impact |
|---|---|---|---|
| **P1** | Deal Detail F7 Module Tab | High | 🎯 Core workflow — every deal touches this |
| **P2** | Terminal `/terminal/maps` section | Medium | Portfolio-level intelligence |
| **P3** | Asset Hub property context | Low | Post-close monitoring |
| **P4** | Replace `/deals/:dealId/design` standalone | Medium | Deprecate old 3D page, redirect to F7 |

---

## 5. TECHNICAL INTEGRATION POINTS

### 5.1 Deal Detail Page Changes

**File:** `frontend/src/pages/DealDetailPage.tsx`

Add to tab rendering switch statement:

```typescript
// Around line ~800-900 in DealDetailPage.tsx
// In the tab content renderer:

case 'property-surface':  // F7
  return (
    <PropertySurfaceModule
      dealId={dealId}
      dealType={dealType}
      parcelBoundary={dealData.boundary}
      zoningProfile={zoningProfile}
      onDesignMetricsChange={handleDesignMetricsChange}
    />
  );
```

**New Component:** `frontend/src/components/deal/sections/PropertySurfaceModule.tsx`

### 5.2 Module Registry Changes

**File:** `frontend/src/shared/config/deal-type-visibility.ts`

Add to `MODULE_TABS` array:

```typescript
{
  moduleId: 'M30',
  name: 'Property Surface',
  fKey: 'F7',
  station: 'S1',
  stationLabel: 'Intake & Triage',
  category: 'Intelligence',
  showFor: { existing: 'full', development: 'full', redevelopment: 'full' },
  dealTypeNotes: 'Map-centric parcel intelligence with optional 3D building design. Surfaces parcel boundaries, ownership, traffic, demographics, zoning overlays, and custom layers. 3D mode available for development/redevelopment deals.',
}
```

### 5.3 Terminal Page Changes

**File:** `frontend/src/pages/TerminalPage.tsx`

Add new token to terminal navigation:

```typescript
// In the terminal token/skill system
{ token: 'maps', label: 'Map Intelligence', icon: '🗺️', shortcut: 'Ctrl+7' }
```

Render `MapIntelligenceTerminalView` when `activeToken === 'maps'`.

### 5.4 Routing Changes

**File:** `frontend/src/App.tsx`

- Keep `/deals/:dealId/design` for backward compatibility → **redirect to** `/deals/:dealId/detail?tab=property-surface&mode=3d`
- Add `/terminal/maps` route (handled within TerminalPage token system)

---

## 6. SUMMARY

### Where the Map Surface Lives

| Surface | Route | When to Use |
|---|---|---|
| **Deal Detail F7 Tab** | `/deals/:dealId/detail?tab=property-surface` | Every deal — parcel intelligence + 3D design |
| **Terminal Map Intelligence** | `/terminal/maps` | Portfolio view, market analysis, opportunity discovery |
| **Asset Hub Context** | `/assets-owned/:dealId/property` (enhanced) | Post-close monitoring |
| **Legacy 3D Design** | `/deals/:dealId/design` → **deprecated** | Redirect to F7 tab |

### The F7 Advantage

By placing the Mapping Surface as **F7 in the Deal Detail module system**, we get:

1. **Context preservation** — User never leaves the deal workflow
2. **Module adjacency** — F6 (Traffic) → F7 (Property Surface) → F8 (Capital) is a natural flow
3. **Keyboard navigation** — Power users hit F7 without mouse
4. **First-class status** — Not a hidden CTA, not a standalone page
5. **Bidirectional sync** — Design metrics flow to ProForma (F9), traffic data flows from Traffic module (F6)

---

**Next Step:** Confirm F7 = "Property Surface" module naming and begin Phase 1 implementation of the `PropertySurfaceModule` component with 2D parcel rendering.
