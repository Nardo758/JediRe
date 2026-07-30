# JediRe Mapping Surface — Product Spec & Architecture

**Status:** Architecture Draft  
**Date:** 2026-07-25  
**Owner:** Leon D  
**Scope:** Map-centric real estate analysis surface with parcel intelligence, traffic data, custom overlays, and 3D building design

---

## 1. EXECUTIVE SUMMARY

This document defines the **JediRe Mapping Surface** — a map-first digital twin for real estate analysis. It combines:

- **Parcel & Ownership Intelligence** — assessor data, parcel boundaries, ownership history
- **Contextual Data** — traffic counts, demographics, transit access, walk scores
- **Dynamic Overlays** — listings, deals, zoning districts, supply/demand heatmaps
- **3D Building Design** — parcel-level architectural modeling using Pascal Editor (React Three Fiber + WebGPU)
- **Agent-Ready Surface** — structured data layer so AI agents can run location-based analysis

The surface integrates into the existing JediRe frontend (Mapbox + React Three Fiber stack) and extends the current `MapView` / `MapBuilder` components rather than replacing them.

---

## 2. THE PROBLEM

Current JediRe has map capabilities (`MapView`, `MapBuilder`, `PipelineMapView`) but they are fragmented:

| Capability | Current State | Gap |
|---|---|---|
| Parcel boundaries | Not integrated | Need assessor API → GeoJSON overlay |
| Ownership data | Manual entry | Need automated parcel → owner lookup |
| Traffic data | Not present | Need DOT/traffic count integration |
| 3D building design | `useDesign3D` hook exists, unused | Need full Pascal Editor integration |
| Agent map analysis | Agents read data, not maps | Need structured map context for agents |
| Custom overlays | Layer system exists | Need user-defined overlay builder |

The vision: **One unified map surface where every real estate analysis starts and ends.**

---

## 3. TARGET USERS

1. **Acquisition Analysts** — Need parcel ownership, traffic counts, and comp locations on one map
2. **Developers** — Need zoning overlays + 3D massing studies on actual parcel geometry
3. **Brokers** — Need listing density, traffic patterns, and demographic overlays
4. **AI Agents** — Need structured geospatial context to answer "What should I know about this location?"

---

## 4. CORE FEATURES

### 4.1 Parcel Intelligence Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PARCEL CARD (Click any parcel on map)                                  │
│                                                                          │
│  📍 1234 Peachtree St NE, Atlanta, GA 30309                             │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Parcel ID  │  │  Owner      │  │  Land Use   │  │  Lot Size   │   │
│  │  14-0089    │  │  ABC LLC    │  │  Commercial │  │  0.87 acres │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
│  Ownership History:                                                      │
│  • 2024-01: ABC LLC purchased for $2.4M                                  │
│  • 2018-03: Smith Family Trust → ABC LLC                                 │
│  • 2005-07: Original plat recorded                                       │
│                                                                          │
│  Assessment:                                                             │
│  • Land Value: $1,200,000                                                │
│  • Improvement Value: $800,000                                           │
│  • Total Appraised: $2,000,000                                           │
│  • Last Assessment Date: 2024-01-15                                      │
│                                                                          │
│  [View Full Record] [Add to Pipeline] [Run Analysis]                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- Primary: County Assessor REST API (Fulton County, etc.)
- Fallback: Regrid API (nationwide parcel data)
- Tertiary: Manual parcel upload (GeoJSON/Shapefile)

### 4.2 Traffic & Contextual Layer

**Traffic Data Overlay:**
- Annual Average Daily Traffic (AADT) counts by road segment
- Peak hour volumes
- Traffic growth trends
- Signal timing / intersection data

**Contextual Overlays:**
- Walk Score / Bike Score
- Transit access (MARTA, bus routes)
- Demographics (census block group)
- Employment density
- Crime statistics

```
TRAFFIC LEGEND
┌──────────────────────────────────────┐
│  🔴 > 50,000 AADT   (Major arterial) │
│  🟠 25K-50K AADT   (Minor arterial)  │
│  🟡 10K-25K AADT   (Collector)       │
│  🟢 < 10K AADT     (Local)           │
│  ⚫ No data                           │
└──────────────────────────────────────┘
```

**Data Sources:**
- Georgia DOT traffic count database
- StreetLight Data (aggregated GPS)
- TomTom / HERE traffic APIs
- Census Bureau ACS

### 4.3 Dynamic Overlay System

Users can toggle any combination of layers:

```
LAYER PANEL
┌─────────────────────────────────────┐
│  ☑️ Parcels (colored by land use)   │
│  ☑️ Property Listings (MLS)         │
│  ☐ Zoning Districts                 │
│  ☑️ Traffic Counts                  │
│  ☐ Demographics (income heatmap)    │
│  ☑️ JediRe Deals (your pipeline)    │
│  ☐ Supply Pipeline (new construction)│
│  ☐ Transit Routes                   │
│  ─────────────────────────────────  │
│  + Add Custom Layer                 │
└─────────────────────────────────────┘
```

**Custom Layer Builder:**
- Upload GeoJSON/Shapefile/KML
- CSV upload with lat/lng columns → auto-clustered points
- SQL query against JediRe database → map layer
- API connector (webhook-driven layer updates)

### 4.4 3D Building Design Mode

Integrates **Pascal Editor** (`pascalorg/editor`) for parcel-level 3D design:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [2D Map Mode]  [3D Design Mode]  [Split View]                          │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │           ☀️                                                      │  │
│  │              ╱                                                    │  │
│  │         ┌─────────┐                                               │  │
│  │        ╱│  🏢    │╲         3D PARCEL VIEW                        │  │
│  │       ╱ │        │ ╲                                              │  │
│  │      │  │  12    │  │         • Site boundary (parcel polygon)    │  │
│  │      │  │ stories│  │         • Setback lines                     │  │
│  │       ╲ │        │ ╱          • Building massing                   │  │
│  │        ╲│        │╱           • Floor plates                       │  │
│  │         └─────────┘            • Parking layout                    │  │
│  │                                                                   │  │
│  │  ← Setbacks →                                                     │  │
│  │  [Front: 25ft] [Side: 10ft] [Rear: 20ft]                          │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  [Wall Tool] [Slab Tool] [Zone Tool] [Item Tool] [Measure]               │
│                                                                          │
│  Floor Area Ratio: 3.2  |  Units: 48  |  Parking: 52 spaces             │
└─────────────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. Click any parcel → "Open in 3D Design"
2. Pascal Editor loads with:
   - Parcel boundary as the `Site` node
   - Auto-calculated setback lines as `Guide` nodes
   - Default `Building` node centered on parcel
3. User designs with wall/slab/zone tools
4. Design metrics auto-calculate: FAR, units, parking, GFA
5. Export to: ProForma, PDF site plan, or save to deal

**Pascal Editor Integration Strategy:**
- Fork/adapt `pascalorg/editor` packages into `frontend/packages/editor/`
- Create `JediReSiteNode` that accepts parcel GeoJSON as boundary
- Create `JediReBuildingNode` with unit mix parametrics
- Add `FARCalculator` system to Pascal's system pipeline
- Connect `useScene` store to JediRe's deal store for bidirectional sync

### 4.5 Agent-Ready Surface

The map exposes a structured context object that agents can consume:

```typescript
interface MapAgentContext {
  viewport: {
    center: [number, number];  // lat, lng
    zoom: number;
    bounds: [number, number, number, number]; // west, south, east, north
  };
  visibleLayers: string[];
  selectedParcel?: {
    parcelId: string;
    address: string;
    owner: string;
    assessedValue: number;
    landUse: string;
    lotSizeSqft: number;
    geometry: GeoJSON.Polygon;
    // ... full assessor record
  };
  nearbyParcels: ParcelSummary[];
  trafficOnSegment: TrafficCount[];
  listingsInView: ListingSummary[];
  compsInRadius: CompRecord[];
  zoningDistrict: ZoningRecord;
  demographics: CensusBlockGroup;
}
```

When a user asks an agent: *"Analyze this location"* — the agent receives the full `MapAgentContext` and can answer with map-grounded intelligence.

---

## 5. TECHNICAL ARCHITECTURE

### 5.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React + Vite)                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Map Surface Container                          │  │
│  │                                                                        │  │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │  │
│  │   │  2D Map      │    │  Layer       │    │  Property    │            │  │
│  │   │  (Mapbox GL) │◄──►│  Manager     │◄──►│  Sidebar     │            │  │
│  │   └──────────────┘    └──────────────┘    └──────────────┘            │  │
│  │          ▲                    ▲                   ▲                    │  │
│  │          │                    │                   │                    │  │
│  │   ┌──────┴────────────────────┴───────────────────┴──────┐            │  │
│  │   │              Map Surface Store (Zustand)              │            │  │
│  │   │  • viewport, selectedParcel, activeLayers, mode      │            │  │
│  │   └──────────────────────────────────────────────────────┘            │  │
│  │                              ▲                                         │  │
│  │                              │                                         │  │
│  │   ┌──────────────────────────┴──────────────────────────┐              │  │
│  │   │              3D Design Mode (Pascal Editor)          │              │  │
│  │   │  • React Three Fiber + WebGPU                        │              │  │
│  │   │  • Parcel boundary → Site node                       │              │  │
│  │   │  • Bidirectional sync with deal store                │              │  │
│  │   └──────────────────────────────────────────────────────┘              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Agent Context Bridge                           │  │
│  │  Serializes map state → MapAgentContext → sent to AI agent             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express.js)                              │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Assessor    │  │  Traffic     │  │  Parcel      │  │  Overlay     │    │
│  │  Proxy       │  │  Service     │  │  Cache       │  │  Service     │    │
│  │              │  │              │  │              │  │              │    │
│  │  • Fulton    │  │  • GDOT      │  │  • Redis     │  │  • Custom    │    │
│  │    County API│  │  • TomTom    │  │    parcel    │  │    layers    │    │
│  │  • Regrid    │  │  • StreetLight│  │    store     │  │  • Listings  │    │
│  │  • Fallback  │  │              │  │  • GeoJSON   │  │  • Zoning    │    │
│  │    scraper   │  │              │  │    indexed   │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Data Pipeline                                  │  │
│  │  Scheduled jobs (node-cron) ingest assessor + traffic updates          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DATA SOURCES                               │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Fulton Co   │  │  Georgia DOT │  │  Regrid API  │  │  MLS /       │    │
│  │  Assessors   │  │  Traffic     │  │  (Fallback)  │  │  Listings    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Tomtom/HERE │  │  Census ACS  │  │  Mapbox      │  │  Zoning      │    │
│  │  Traffic API │  │  (Demographics│  │  Boundaries  │  │  Database    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 New Frontend Components

```
frontend/src/
├── components/
│   └── map-surface/
│       ├── MapSurface.tsx              # Main container (replaces/extends MapView)
│       ├── MapSurfaceToolbar.tsx       # Mode switcher (2D / 3D / Split)
│       ├── ParcelLayer.tsx             # GeoJSON parcel renderer
│       ├── ParcelTooltip.tsx           # Hover state for parcels
│       ├── PropertySidebar.tsx         # Full property card panel
│       ├── TrafficLayer.tsx            # AADT line renderers
│       ├── CustomOverlayUploader.tsx   # GeoJSON/CSV upload
│       ├── LayerPanelV2.tsx            # Enhanced layer manager
│       └── design/
│           ├── Design3DView.tsx        # Pascal Editor wrapper
│           ├── ParcelToSiteAdapter.ts  # Converts parcel → Pascal Site node
│           ├── FARCalculator.tsx       # Real-time FAR display
│           └── UnitMixPanel.tsx        # Residential unit config
│
├── stores/
│   └── mapSurfaceStore.ts              # Unified map surface state
│
├── services/
│   ├── assessor.service.ts             # Assessor API client
│   ├── traffic.service.ts              # Traffic data client
│   └── parcelCache.service.ts          # Local indexedDB cache
│
└── types/
    └── map-surface.types.ts            # MapAgentContext, ParcelRecord, etc.
```

### 5.3 New Backend Services

```
backend/src/
├── api/rest/
│   ├── assessor.routes.ts              # GET /api/assessor/parcel/:id
│   ├── traffic.routes.ts               # GET /api/traffic/segment/:roadId
│   └── overlay.routes.ts               # CRUD for custom layers
│
├── services/
│   ├── assessor/
│   │   ├── assessor.service.ts         # Orchestrates data fetching
│   │   ├── fulton-county.adapter.ts    # Fulton-specific API mapper
│   │   └── regrid.adapter.ts           # Regrid fallback
│   │
│   ├── traffic/
│   │   ├── traffic.service.ts
│   │   ├── gdot.adapter.ts             # Georgia DOT
│   │   └── tomtom.adapter.ts           # TomTom fallback
│   │
│   └── overlay/
│       ├── overlay.service.ts          # Custom layer CRUD
│       └── geojson.validator.ts        # Upload validation
│
└── jobs/
    └── parcel-sync.cron.ts             # Nightly assessor sync
```

### 5.4 Database Schema (Drizzle ORM)

```typescript
// parcels table
export const parcels = pgTable("parcels", {
  id: serial("id").primaryKey(),
  parcelId: varchar("parcel_id", { length: 50 }).notNull().unique(),
  address: text("address"),
  ownerName: varchar("owner_name", { length: 255 }),
  ownerMailingAddress: text("owner_mailing_address"),
  landUse: varchar("land_use", { length: 50 }),
  lotSizeSqft: integer("lot_size_sqft"),
  assessedLandValue: integer("assessed_land_value"),
  assessedImprovementValue: integer("assessed_improvement_value"),
  totalAppraisedValue: integer("total_appraised_value"),
  lastAssessmentDate: date("last_assessment_date"),
  geometry: geometry("geometry", { type: "Polygon", srid: 4326 }),
  county: varchar("county", { length: 50 }),
  state: varchar("state", { length: 2 }),
  rawAssessorData: jsonb("raw_assessor_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// parcel_ownership_history table
export const parcelOwnershipHistory = pgTable("parcel_ownership_history", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => parcels.id),
  ownerName: varchar("owner_name", { length: 255 }),
  saleDate: date("sale_date"),
  salePrice: integer("sale_price"),
  deedBook: varchar("deed_book", { length: 20 }),
  deedPage: varchar("deed_page", { length: 20 }),
});

// traffic_counts table
export const trafficCounts = pgTable("traffic_counts", {
  id: serial("id").primaryKey(),
  roadSegmentId: varchar("road_segment_id", { length: 50 }),
  aadt: integer("aadt"),  // Annual Average Daily Traffic
  year: integer("year"),
  source: varchar("source", { length: 50 }), // "gdot", "tomtom"
  geometry: geometry("geometry", { type: "LineString", srid: 4326 }),
  metadata: jsonb("metadata"),
});

// custom_overlays table
export const customOverlays = pgTable("custom_overlays", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }),
  userId: integer("user_id").references(() => users.id),
  teamId: integer("team_id").references(() => teams.id),
  sourceType: varchar("source_type", { length: 20 }), // "geojson", "csv", "sql"
  sourceData: jsonb("source_data"),  // GeoJSON FeatureCollection
  styling: jsonb("styling"),         // Mapbox layer style JSON
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 6. INTEGRATION WITH EXISTING JEDIRE

### 6.1 Map Store Consolidation

Current state: `mapStore.ts`, `mapDrawingStore.ts`, and component-local map state.

Proposed: **`mapSurfaceStore.ts`** becomes the single source of truth:

```typescript
interface MapSurfaceState {
  // Viewport
  viewport: MapViewport;
  
  // Mode
  mode: '2d' | '3d' | 'split';
  
  // Selection
  selectedParcelId: string | null;
  selectedProperty: ParcelRecord | null;
  
  // Layers
  activeLayers: LayerConfig[];
  customOverlays: CustomOverlay[];
  
  // 3D Design
  designMode: DesignState | null;  // Pascal Editor state snapshot
  
  // Agent context
  agentContext: MapAgentContext;
}
```

### 6.2 Routing

New route: `/map/surface` (initially, eventually replaces `/map`)

```typescript
// router addition
<Route path="/map/surface" element={<MapSurfacePage />} />
<Route path="/map/surface/design/:parcelId" element={<Design3DPage />} />
```

### 6.3 Deal Integration

When a parcel is added to a deal:
1. Parcel data flows into the deal's `PropertyInformation` section
2. 3D design (if created) becomes an attachment on the deal
3. Traffic analysis becomes a note in the deal's market analysis
4. Agent context is included in the deal's AI prompt context

---

## 7. DATA SOURCES & API RESEARCH

### 7.1 Assessor Data — Fulton County, GA (Atlanta Market)

**Fulton County Tax Assessor API:**
- Portal: `https://www.fultoncountyga.gov/taxes-assessor`
- Typical capabilities: Property search by address, parcel ID, owner name
- Data available: Owner, assessed values, land use, lot size, sales history, improvements
- **Action Item:** Request API access or evaluate web scraping + caching strategy

**Fallback — Regrid:**
- API: `https://regrid.com/api/`
- Pricing: ~$0.02/parcel for bulk, or subscription
- Coverage: Nationwide parcel data
- Data: Boundary GeoJSON, owner, assessed value, land use

**Fallback — Manual Upload:**
- Accept GeoJSON/Shapefile parcel uploads
- Useful for markets without API access

### 7.2 Traffic Data — Georgia

**Georgia DOT Traffic Count Database:**
- URL: `https://dot.ga.gov/GDOT/Pages/TrafficData.aspx`
- Data: AADT by road segment, vehicle classification, growth factors
- Format: Typically downloadable as CSV/Excel with lat/lng
- **Action Item:** Evaluate if API exists or build CSV ingestion pipeline

**TomTom Traffic API:**
- Endpoint: `https://api.tomtom.com/traffic/services/4/flowSegmentData/...`
- Real-time + historical traffic data
- Pricing: Free tier (5K requests/day), paid beyond

### 7.3 Demographics — US Census

**Census Bureau ACS API:**
- Endpoint: `https://api.census.gov/data/2022/acs/acs5`
- Data: Income, population, housing units, education by block group
- Free, no API key required for basic usage

---

## 8. BUILD PLAN — PHASED

### Phase 1: Foundation (Weeks 1–3)

**Goal:** Working 2D map surface with parcel overlay on Atlanta market

| Week | Deliverable |
|---|---|
| 1 | `MapSurface` container component, assessor proxy service, parcel GeoJSON renderer |
| 2 | Property sidebar panel, ownership history display, parcel search by address |
| 3 | Layer panel V2, toggle parcels/listings/zoning, custom overlay uploader (GeoJSON) |

**Exit Criteria:**
- [ ] Search Atlanta address → parcel highlights on map
- [ ] Click parcel → full property card with ownership + assessment
- [ ] Toggle at least 3 layer types
- [ ] Upload custom GeoJSON overlay

### Phase 2: Intelligence (Weeks 4–6)

**Goal:** Traffic, demographics, and agent context

| Week | Deliverable |
|---|---|
| 4 | Traffic layer (GDOT AADT data ingestion + line renderer) |
| 5 | Demographics overlay (Census ACS heatmap) |
| 6 | `MapAgentContext` bridge — map state serializes for AI agent consumption |

**Exit Criteria:**
- [ ] Traffic counts visible on major Atlanta roads
- [ ] Income heatmap toggleable
- [ ] Ask agent "Analyze this parcel" → agent receives full context

### Phase 3: 3D Design (Weeks 7–10)

**Goal:** Pascal Editor integration for parcel-level building design

| Week | Deliverable |
|---|---|
| 7 | Fork/adapt Pascal Editor packages into `frontend/packages/editor/` |
| 8 | `ParcelToSiteAdapter` — parcel GeoJSON → Pascal Site node |
| 9 | FAR calculator system, unit mix panel, setback visualization |
| 10 | Bidirectional sync: design changes → deal store, deal data → design defaults |

**Exit Criteria:**
- [ ] Click parcel → "Design in 3D" opens Pascal Editor
- [ ] Draw walls/slab on parcel with auto-setback guides
- [ ] FAR, unit count, parking auto-calculated
- [ ] Save design → attached to deal

### Phase 4: Scale & Polish (Weeks 11–12)

**Goal:** Multi-market support, performance, team features

| Week | Deliverable |
|---|---|
| 11 | Regrid integration for nationwide parcel fallback, assessor adapter pattern |
| 12 | Performance: tile-based parcel loading, viewport-culled traffic, Redis caching |

**Exit Criteria:**
- [ ] Any US market accessible via Regrid fallback
- [ ] Map surface loads < 2s for 1000 parcels
- [ ] Team annotations on map (pins, comments, shared layers)

---

## 9. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|---|---|---|
| Assessor API rate limits | High | Implement Redis cache + Regrid fallback |
| Pascal Editor WebGPU compatibility | Medium | Graceful fallback to WebGL; test target devices |
| Parcel boundary accuracy | Medium | Display data source + date; allow manual correction |
| Large GeoJSON performance | High | Tile-based loading, viewport culling, simplification |
| Multi-market assessor variance | Medium | Adapter pattern per county; Regrid as normalize layer |

---

## 10. SUCCESS METRICS

| Metric | Target |
|---|---|
| Parcel lookup latency | < 500ms (cached) |
| Map surface load time | < 2s for 1000 parcels |
| 3D design mode launch | < 3s from parcel click |
| Agent context accuracy | Agent answers location questions correctly > 90% |
| User layer uploads | > 10 custom overlays created in first month |

---

## 11. APPENDIX: PASCAL EDITOR INTEGRATION NOTES

### Package Structure

```
frontend/packages/
└── editor/                    # Adapted from pascalorg/editor
    ├── packages/
    │   ├── core/              # @pascal-app/core — schemas, stores, systems
    │   ├── viewer/            # @pascal-app/viewer — React Three Fiber renderer
    │   ├── editor/            # @pascal-app/editor — editing tools
    │   └── nodes/             # @pascal-app/nodes — built-in node types
    └── apps/
        └── jedire-design/     # Next.js host (or integrate into Vite app)
```

### JediRe-Specific Extensions

**New Node Types:**
```typescript
// JediReSiteNode — parcel boundary with GIS metadata
interface JediReSiteNode extends BaseNode {
  type: 'jedire-site';
  parcelId: string;
  boundaryGeoJSON: GeoJSON.Polygon;
  acreage: number;
  zoningDistrict: string;
}

// JediReBuildingNode — parametric building with unit mix
interface JediReBuildingNode extends BaseNode {
  type: 'jedire-building';
  unitMix: { type: string; count: number; avgSqft: number }[];
  parkingRatio: number;
  targetFAR: number;
}
```

**New Systems:**
- `FARSystem` — calculates floor area ratio from slabs and parcel size
- `SetbackSystem` — renders setback lines from parcel boundary + zoning rules
- `UnitMixSystem` — validates unit count against zoning max

---

**Next Step:** Confirm Phase 1 scope → begin implementation of `MapSurface` container + assessor proxy.


---

## 12. APPENDIX B: DESIGN AGENT ARCHITECTURE (Post-Irina)

**Added:** 2026-07-29  
**Trigger:** Comparison with @irinatoxi's Kimi K3 + Blender MCP workflow  
**Source:** https://x.com/irinatoxi/status/2080550212913725446

---

### 12.1 What Irina Proved

@irinatoxi's workflow demonstrates a **closed-loop AI 3D scene generator**:

1. **Natural language prompt** → Kimi K3 writes Blender Python
2. **Blender executes** → renders preview image
3. **Kimi K3 "looks at" render** → critiques lighting, composition, materials
4. **Rewrites code** → loop repeats until satisfied

**Key insight:** Kimi K3 can drive complex 3D software via MCP, render output, critique itself visually, and iterate. This is technically feasible **today**.

### 12.2 The Gap in JediRe's Original Plan

| Irina Has | JediRe Originally Planned |
|---|---|
| AI generates 3D from text | Manual wall/slab drawing only |
| AI self-critiques renders | Real-time metrics (FAR, units) |
| Photorealistic output | Wireframe/flat-shaded browser view |
| Zero skill required | Requires understanding setbacks, zoning |

### 12.3 The Hybrid: "JediRe Design Agent"

The updated F7 module has **three modes**:

```
[AI Generate] [Manual Design] [Split View]
```

#### AI Generate Mode (New)

> *"Design a 72-unit wrap-style garden apartment with a pool courtyard on this parcel"*

- Kimi K3 reads parcel boundary + zoning constraints
- Generates initial Pascal Editor scene
- Auto-calculates FAR, units, parking
- Self-critiques: *"FAR at 65% — recommend adding a floor"*
- User approves or revises

#### Manual Design Mode (Existing Pascal Editor)

- Precise control for power users
- Wall/slab/zone tools
- Real-time metrics

#### Render & Critique (Optional Blender MCP)

- Photorealistic renders for investor decks
- AI critiques materials, neighborhood fit

### 12.4 Design Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JEDIRe DESIGN AGENT (F7)                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     INPUT LAYER                                       │  │
│  │  • Natural language prompt                                           │  │
│  │  • Parcel boundary (from assessor)                                   │  │
│  │  • Zoning constraints (from M02)                                     │  │
│  │  • Market comps (from M05/M27)                                       │  │
│  │  • User's manual adjustments                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 AI GENERATION ENGINE (Kimi K3)                        │  │
│  │                                                                       │  │
│  │  Prompt → Constraint Analysis → Scene Generation → Self-Critique     │  │
│  │                                                                       │  │
│  │  Tools available to agent:                                           │  │
│  │  • create_wall(start, end, height)                                   │  │
│  │  • create_slab(polygon, elevation)                                   │  │
│  │  • create_zone(polygon, unit_type)                                   │  │
│  │  • calculate_far()                                                   │  │
│  │  • render_preview()                                                  │  │
│  │  • critique_design()                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 SCENE LAYER (Pascal Editor)                           │  │
│  │                                                                       │  │
│  │  Site → Building → Level → Wall/Slab/Zone (from AI or manual)        │  │
│  │  Zustand store with undo/redo                                        │  │
│  │  Real-time metric calculation                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────┬──────────────────────────────────────────┐  │
│  │    WEBGPU VIEWER         │         BLENDER MCP (Optional)           │  │
│  │    (Real-time)           │         (Photorealistic)                 │  │
│  │                          │                                          │  │
│  │  • Shadows               │  • Export glTF → Blender                 │  │
│  │  • PBR materials         │  • AI places cameras, lights             │  │
│  │  • Parcel context        │  • Render final image                    │  │
│  │  • Fast iteration        │  • AI critiques render                   │  │
│  └──────────────────────────┴──────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 SYNC LAYER                                            │  │
│  │                                                                       │  │
│  │  Design metrics → ProForma (F9)                                      │  │
│  │  Unit mix → Unit Mix Intelligence (M29)                              │  │
│  │  Scene state → Deal store (save/restore)                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.5 Constraint Critique Engine

After any design change (AI-generated or manual), the system auto-critiques:

```
Design Change: Added 6th floor
        │
        ▼
┌─────────────────────────────┐
│  Constraint Check           │
│  ❌ Exceeds max height      │
│  ⚠️ Parking now insufficient│
│  ✅ FAR still under limit   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Market Check               │
│  6 stories = elevator req   │
│  +$400k cost impact         │
│  Suggest: Stay at 5 stories │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Render Preview             │
│  [Image of 6-story building]│
│  AI: "Massing is bulky —    │
│   consider stepping back    │
│   top floor"                │
└─────────────────────────────┘
```

### 12.6 Example Prompts for Design Agent

| User Prompt | AI Action |
|---|---|
| *"Maximize density on this parcel"* | Generates to max FAR, max units, min parking |
| *"Garden style with courtyards"* | Wrap building around central zone, surface parking |
| *"Podium with tuck-under parking"* | 2-story podium, residential above, parking below |
| *"Match the neighborhood character"* | Analyzes nearby comps → suggests materials, height, massing |
| *"Compare 3 massing options for yield"* | Generates wrap/podium/courtyard → syncs each to ProForma for ROI comparison |

### 12.7 Updated Phase 3 Build Plan (3D Design + AI)

| Week | Original | Updated (Post-Irina) |
|---|---|---|
| 7 | Fork Pascal Editor | Fork Pascal Editor + add **agent tool API** to scene store |
| 8 | Parcel→Site adapter | Parcel→Site adapter + **DesignAgent prompt engineering** |
| 9 | FAR calculator | FAR calculator + **constraint critique engine** |
| 10 | Deal sync | Deal sync + **Blender MCP render pipeline** (optional) |
| **+11** | — | **AI generate mode MVP** — 5 prompt types working |
| **+12** | — | **Render critique loop** — AI critiques its own renders |

### 12.8 What to Adopt vs. Reject

**Adopt:**
- ✅ AI generate mode — NL prompt → initial scene (medium effort, massive impact)
- ✅ Constraint critique engine — auto-check zoning + market fit (low effort, high impact)
- ✅ Blender MCP render — photorealistic output for presentations (medium effort, medium impact)

**Reject:**
- ❌ Pure AI-generated workflow — real estate requires precision; AI suggests, user approves
- ❌ Blender as primary engine — web delivery is core; Blender is desktop-only
- ❌ Remove manual tools — power users need precise control

### 12.9 The Killer Feature

> *"Design me 3 massing options that maximize yield on this parcel"*
>
> → AI reads parcel boundary, zoning code, traffic data  
> → AI generates 3 massing options (wrap, podium, courtyard)  
> → Each auto-synced to ProForma for instant ROI comparison  
> → User picks one, tweaks in Pascal Editor  
> → Final render generated via Blender MCP for investor deck 

**This is the JediRe Design Agent.**

---

**Next Step:** Begin Phase 1 implementation — `PropertySurfaceModule` component with 2D parcel rendering and module registry registration (M30 / F7).
