# JediRe 3D Design System - Complete Requirements Analysis
## Deal: Atlanta Development (300 Units + Parking Structure)

**Deal ID:** `e044db04-439b-4442-82df-b36a840f2fd8`  
**Address:** 1950 Piedmont Circle Northeast, Atlanta, Georgia 30324  
**Target Units:** 300  
**Project Type:** Multifamily

---

## 🎯 Current 3D Design System Overview

### Technology Stack
- **Three.js** (`^0.183.1`) - Core 3D rendering engine
- **React Three Fiber** (`^8.18.0`) - React bindings for Three.js
- **React Three Drei** (`^9.122.0`) - Helper components (OrbitControls, Grid, etc.)
- **Zustand** - State management
- **TypeScript** - Type safety

### Key Components

#### 1. **Building3DEditor** (`frontend/src/components/design/Building3DEditor.tsx`)
Main 3D viewport component with:
- WebGL canvas with Three.js scene
- Orbital camera controls
- Interactive building editing
- Real-time metrics display
- AI integration hooks (Phase 2 placeholders)

#### 2. **Core Data Models** (`frontend/src/types/design/design3d.types.ts`)

**Required Data Structures:**

```typescript
// Property Boundary (from property_boundaries table)
interface ParcelBoundary {
  id: string;
  coordinates: Array<{lat: number, lng: number}>;
  area: number; // acres
  areaSF: number; // square feet
  extrusionHeight?: number;
  color?: string;
  opacity?: number;
}

// Building Sections (user-created 3D masses)
interface BuildingSection {
  id: string;
  name: string;
  geometry: {
    footprint: { points: Array<{x: number, z: number}> };
    height: number;
    floors: number;
  };
  position: { x: number, z: number };
  units?: number;
  visible: boolean;
}

// Zoning Envelope (from zoning_capacity analysis)
interface ZoningEnvelope {
  id: string;
  maxHeight: number;
  buildableArea: number;
  FAR: number;
  setbacks: {
    front: number;
    side: number;
    rear: number;
  };
  color?: string;
  wireframe?: boolean;
}

// Context Buildings (nearby structures)
interface ContextBuilding {
  id: string;
  position: { x: number, z: number };
  dimensions: { width: number, height: number, depth: number };
  color: string;
  opacity: number;
}
```

---

## 📊 Data Sources & Pipeline

### 1. Property Boundary Data
**Table:** `property_boundaries`  
**API Endpoint:** `GET /api/v1/deals/:dealId/boundary`

**Required Fields:**
```sql
SELECT 
  id,
  deal_id,
  boundary_geojson,        -- GeoJSON Polygon
  parcel_area,             -- acres
  parcel_area_sf,          -- square feet
  perimeter,               -- linear feet
  centroid,                -- PostGIS POINT
  setbacks,                -- JSON: {front, side, rear}
  buildable_area,          -- acres (after setbacks)
  buildable_area_sf,       -- square feet
  buildable_percentage,    -- 0.0-1.0
  constraints              -- JSON: easements, floodplain, etc.
FROM property_boundaries
WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

**Transformation:**
- GeoJSON coordinates → Local XZ coordinates (relative to first point)
- Lat/Lng conversion: `~364,000 units per degree` (simplified)
- Creates extruded 3D polygon mesh

### 2. Zoning Capacity Data
**Table:** `deals.module_outputs->zoningIntelligence`  
**API Endpoint:** `GET /api/v1/deals/:dealId/development-capacity`

**Data Structure:**
```json
{
  "envelope": {
    "buildableArea": 123456,    // SF
    "maxFootprint": 98765,      // SF
    "maxFloors": 8,
    "maxGFA": 790123,           // SF
    "maxCapacity": 312,         // units
    "limitingFactor": "FAR",
    "parkingRequired": 468,
    "parkingArea": 140400       // SF
  },
  "zoningStandards": {
    "maxDensity": 65,           // units/acre
    "maxFAR": 3.5,
    "maxHeight": 95,            // feet
    "maxStories": 8,
    "minParking": 1.5,          // spaces/unit
    "maxLotCoverage": 65,       // percent
    "setbacks": {
      "front": 25,
      "side": 15,
      "rear": 20
    }
  },
  "scenarios": [
    {
      "scenarioType": "by_right",
      "maxUnits": 300,
      "totalGFA": 255000,
      "stories": 8,
      "heightFt": 95,
      "parkingRequired": 450,
      "parkingRatio": 1.5
    }
  ]
}
```

### 3. Building Design Data
**Source:** User-generated in 3D editor  
**Storage:** `useDesign3DStore` (Zustand state)

**State Structure:**
```typescript
{
  buildingSections: BuildingSection[],
  parcelBoundary: ParcelBoundary | null,
  zoningEnvelope: ZoningEnvelope | null,
  contextBuildings: ContextBuilding[],
  selectedSectionId: string | null,
  hoveredSectionId: string | null,
  editMode: 'select' | 'draw' | 'edit' | 'measure',
  showGrid: boolean,
  showParcel: boolean,
  showZoningEnvelope: boolean,
  showContextBuildings: boolean,
  showMeasurements: boolean,
  metrics: BuildingMetrics
}
```

---

## 🏗️ Reverse-Engineering the 300-Unit Building

### Step 1: Load Property Boundary

**Query:**
```javascript
const response = await fetch(
  `${API_URL}/api/v1/deals/${dealId}/boundary`
);
const boundary = await response.json();
```

**Expected Response:**
```json
{
  "id": "...",
  "deal_id": "e044db04-439b-4442-82df-b36a840f2fd8",
  "boundary_geojson": {
    "type": "Polygon",
    "coordinates": [[
      [-84.3667, 33.8200],
      [-84.3665, 33.8200],
      [-84.3665, 33.8198],
      [-84.3667, 33.8198],
      [-84.3667, 33.8200]
    ]]
  },
  "parcel_area": 4.5,
  "parcel_area_sf": 196020,
  "setbacks": {"front": 25, "side": 15, "rear": 20},
  "buildable_area_sf": 147015
}
```

**3D Conversion:**
```javascript
import { geoJsonToParcelBoundary } from '@/utils/geoJsonToParcel';

const parcel = geoJsonToParcelBoundary(
  boundary.boundary_geojson,
  `parcel-${dealId}`
);

// Result: ParcelBoundary with local X/Z coordinates
// Origin: First coordinate point = (0, 0)
// Each point converted: (lng, lat) → (x * 364000, z * 364000)
```

### Step 2: Load Zoning Envelope

**Query:**
```javascript
const response = await fetch(
  `${API_URL}/api/v1/deals/${dealId}/development-capacity`
);
const capacity = await response.json();
```

**Create Zoning Envelope:**
```javascript
const zoningEnvelope = {
  id: 'zoning-envelope-1',
  maxHeight: capacity.zoningStandards.maxHeight, // 95 ft
  buildableArea: capacity.envelope.buildableArea,
  FAR: capacity.zoningStandards.maxFAR,
  setbacks: capacity.zoningStandards.setbacks,
  color: '#3b82f6',
  wireframe: true
};
```

### Step 3: Design the 300-Unit Building

**Parking Structure (Podium):**
```javascript
const parkingPodium = {
  id: 'parking-podium',
  name: 'Parking Structure',
  geometry: {
    footprint: { 
      points: calculateSetbackFootprint(parcel, setbacks)
    },
    height: 40, // 2 levels @ 20' each
    floors: 2
  },
  position: { x: 0, z: 0 },
  units: 0,
  visible: true
};
```

**Residential Tower:**
```javascript
const residentialTower = {
  id: 'residential-tower',
  name: 'Residential Tower',
  geometry: {
    footprint: {
      points: reducedFootprint(parkingPodium.footprint, 0.7) // 70% coverage
    },
    height: 55, // 6 floors @ ~9.17' each
    floors: 6
  },
  position: { x: 0, z: 0 },
  units: 300,
  visible: true
};
```

**Complete Building:**
```javascript
const buildingSections = [
  parkingPodium,
  {
    ...residentialTower,
    position: { x: 0, z: 40 } // Stack on top of parking
  }
];
```

### Step 4: Calculate Metrics

```javascript
const metrics = {
  unitCount: 300,
  totalSF: 255000,
  parkingSpaces: 450,
  height: {
    feet: 95,
    stories: 8 // 2 parking + 6 residential
  },
  coverage: {
    percentage: 65,
    sf: 127413
  },
  far: 3.5,
  efficiency: 85 // (Net Rentable / Gross Building Area) * 100
};
```

---

## 🔧 Required Backend Endpoints

### 1. Get Property Boundary
```
GET /api/v1/deals/:dealId/boundary
```
**Status:** ✅ Exists  
**Location:** `backend/src/api/rest/property-boundary.routes.ts`

### 2. Save Property Boundary
```
POST /api/v1/deals/:dealId/boundary
Body: {
  boundaryGeoJSON: GeoJSON,
  parcelArea: number,
  parcelAreaSF: number,
  setbacks: {front, side, rear},
  buildableAreaSF: number
}
```
**Status:** ✅ Exists

### 3. Get Development Capacity
```
GET /api/v1/deals/:dealId/development-capacity
```
**Status:** ✅ Exists  
**Returns:** Zoning envelope, capacity scenarios, building metrics

### 4. Save 3D Building Design (MISSING)
```
POST /api/v1/deals/:dealId/design-3d
Body: {
  buildingSections: BuildingSection[],
  metrics: BuildingMetrics,
  scenarioId?: string
}
```
**Status:** ❌ **NEEDS TO BE CREATED**

**Required Table:**
```sql
CREATE TABLE building_designs_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES development_scenarios(id) ON DELETE SET NULL,
  
  -- Building sections (JSON array)
  building_sections JSONB NOT NULL,
  
  -- Calculated metrics
  total_units INTEGER,
  total_gfa DECIMAL(12, 2),
  total_parking_spaces INTEGER,
  building_height_ft DECIMAL(8, 2),
  stories INTEGER,
  lot_coverage_percent DECIMAL(5, 2),
  far DECIMAL(5, 2),
  efficiency_percent DECIMAL(5, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  UNIQUE(deal_id, scenario_id)
);
```

### 5. Get 3D Building Design (MISSING)
```
GET /api/v1/deals/:dealId/design-3d?scenarioId=optional
```
**Status:** ❌ **NEEDS TO BE CREATED**

---

## 🚀 Implementation Roadmap

### Phase 1: Load Existing Data (DONE)
- ✅ Property boundary from `property_boundaries` table
- ✅ Zoning envelope from development capacity
- ✅ 3D viewport with Three.js + React Three Fiber
- ✅ Interactive camera controls
- ✅ Grid, measurements, helpers

### Phase 2: Build Design Tools
**Priority: HIGH**

1. **Create `building_designs_3d` table**
   - Migration: `073_building_designs_3d.sql`
   - Foreign keys to `deals` and `development_scenarios`

2. **Create save/load endpoints**
   - `POST /api/v1/deals/:dealId/design-3d`
   - `GET /api/v1/deals/:dealId/design-3d`
   - Location: `backend/src/api/rest/building-design-3d.routes.ts`

3. **Implement building section creator**
   - Draw footprint tool
   - Extrude to height
   - Split/merge sections
   - Parametric building generator

4. **Add parking structure generator**
   - Auto-calculate spaces required
   - Podium vs. wrapped vs. underground
   - Ramp positioning
   - Stall layouts

5. **Metrics auto-calculation**
   - Unit count
   - GFA
   - FAR
   - Lot coverage
   - Efficiency ratio

### Phase 3: AI Integration
**Priority: MEDIUM**

1. **Image-to-3D terrain** (Qwen API)
   - Upload site photos
   - Extract topography
   - Generate context buildings

2. **Prompt-to-design** (Qwen API)
   - "Design 300-unit building with parking"
   - Auto-generate building sections
   - Multiple alternatives

3. **Zoning compliance checker**
   - Real-time validation
   - Highlight violations
   - Suggest fixes

### Phase 4: Advanced Features
**Priority: LOW**

1. **Design references overlay**
   - Pin images to viewport
   - Trace over references
   - Image library integration

2. **Scenario comparison**
   - Side-by-side 3D views
   - Metrics delta table
   - Scenario selector

3. **Export options**
   - .OBJ / .GLTF export
   - PDF renders
   - Presentation mode

---

## 📝 Atlanta Development Specifics

### Parcel Information
- **Address:** 1950 Piedmont Circle NE, Atlanta, GA 30324
- **Estimated Size:** ~4.5 acres (196,020 SF)
- **Zoning:** Likely MR-5 or similar high-density multifamily
- **Target Units:** 300

### Building Configuration (Estimated)
```
Parking Podium:
- Floors: 2
- Height: 40 ft
- Spaces: 450 (1.5/unit)
- Area: 140,000 SF

Residential Tower:
- Floors: 6
- Height: 55 ft
- Units: 300
- Avg Unit Size: 850 SF
- Total Residential GFA: 255,000 SF

Total Building:
- Stories: 8
- Height: 95 ft
- Total GFA: 395,000 SF
- FAR: 2.02 (on 4.5 acres)
- Lot Coverage: ~65%
```

### Next Steps
1. **Fix Clawdbot API** - Resolve SQL error in `get_deal` command
2. **Query actual boundary data** - Get real GeoJSON coordinates
3. **Create 3D design save/load** - Implement missing endpoints
4. **Build parking structure** - Design 2-level podium
5. **Build residential tower** - 6 floors, 300 units
6. **Calculate final metrics** - Validate against zoning

---

## 🐛 Known Issues

1. **Clawdbot API Bug**
   - `get_deal` command fails with `column p.address_line2 does not exist`
   - Location: `backend/src/api/rest/clawdbot-webhooks.routes.ts:149`
   - Fix: Update JOIN query to exclude missing columns

2. **3D View Initially Blank**
   - Expected behavior - requires parcel data
   - User must load deal or draw boundary

3. **No persistence for 3D designs**
   - Designs lost on page refresh
   - Need `building_designs_3d` table + API

---

## 📚 References

- Building3DEditor: `frontend/src/components/design/Building3DEditor.tsx`
- Property Boundary API: `backend/src/api/rest/property-boundary.routes.ts`
- Development Capacity: `backend/src/services/building-envelope.service.ts`
- 3D Types: `frontend/src/types/design/design3d.types.ts`
- Design Hook: `frontend/src/hooks/design/useDesign3D.ts`
