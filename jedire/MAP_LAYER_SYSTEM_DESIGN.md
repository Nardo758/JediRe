# Map Layer Creation System - Design Specification

**Created:** 2026-02-08  
**Status:** Design Phase  
**Purpose:** Enable users to compose, toggle, and manage multiple map layers from sidebar items and horizontal navigation

---

## 🎯 Overview

Transform the Dashboard map from a static view into a **composable layer system** where users can:
- Generate map layers from sidebar items (Email, News, Assets, Pipeline, Market Data)
- Create "War Maps" (saved layer compositions)
- Toggle, filter, and reorder layers like Photoshop
- Save map configurations as tabs (Midtown Research, Competitor Analysis, etc.)

---

## 📐 UI Regions

### **1. Horizontal Navigation Bar (Top)**

```
┌────────────────────────────────────────────────────────────┐
│  [War Maps ▾] [Midtown Research] [Comp Analysis] [+Map]    │
└────────────────────────────────────────────────────────────┘
```

**Elements:**
- **War Maps** (dropdown) → Opens layer composer with ALL available layers
- **Saved Map Tabs** → Each tab remembers its layer configuration
  - Midtown Research
  - Competitor Analysis
  - Broker Recommendations
- **+ Create Map** → Creates new blank map canvas, prompts to add layers
- **+ Create Deal** → Existing (creates deal with trade area)

**Behavior:**
- Clicking a saved map tab loads its layer configuration
- War Maps = "master view" with all layers available
- Each tab maintains independent layer visibility/opacity/order

---

### **2. Vertical Sidebar (Left)**

```
┌─────────────────┐
│ MY DEALS        │
│ 🔵 Deal 1       │
│ 🟢 Deal 2       │
│                 │
│ DASHBOARD       │
│ → Portfolio (3) │
│ → Email (5)     │
│ → News (3)      │
│                 │
│ INTELLIGENCE    │
│ → Market Data   │
│ → Assets (23)   │
│                 │
│ PIPELINE (8)    │
│ → Under Review  │
│ → LOI Submitted │
└─────────────────┘
```

**Layer Sources:**
Each sidebar item can generate a map layer:

| Sidebar Item | Layer Type | Content |
|-------------|-----------|---------|
| **Email (5)** | Pin layer | Properties mentioned in emails (addresses, broker intel) |
| **News Intelligence (3)** | Heatmap + Pins | Geographic locations tied to news signals |
| **Market Data** | Data overlay | Rent comps, vacancy, demographics, supply pipeline |
| **Assets Owned (23)** | Pin/Bubble layer | All owned assets, color-coded by performance |
| **Pipeline (8)** | Pin/Bubble layer | Pipeline deals with status indicators |
| **Individual Deals** | Boundary layer | Single deal's trade area boundary |

---

## 🎨 Layer Types

### **1. Pin/Marker Layers**
**Use:** Individual properties (assets, pipeline deals, email mentions)

**Features:**
- Custom icons per category (🏢 Assets, 📊 Pipeline, 📧 Email mentions)
- Color-coding (green = good, yellow = caution, red = risk)
- Click to show popup with details
- Clustering when zoomed out

**Example Data:**
```json
{
  "type": "pin",
  "name": "Assets Owned",
  "markers": [
    {
      "id": 1,
      "lat": 33.749,
      "lng": -84.388,
      "icon": "building",
      "color": "#10b981",
      "label": "Midtown Towers",
      "popup": { "occupancy": 94, "units": 250 }
    }
  ]
}
```

---

### **2. Bubble Layers**
**Use:** Properties sized by value (rent, price, units, confidence score)

**Features:**
- Circle size = metric value
- Color gradient (low → high)
- Opacity adjustable
- Min/max radius constraints

**Example:**
- Bubble size = building unit count
- Color = occupancy rate (red=70%, green=95%)

---

### **3. Heatmap Layers**
**Use:** Density/intensity visualization (news signals, market activity)

**Features:**
- Radius/intensity adjustable
- Color gradient customizable
- Blur/smoothing controls
- Weight per point (importance)

**Example:**
- News Intelligence → Heatmap of high-activity areas
- Email mentions → Broker activity hotspots

---

### **4. Boundary/Polygon Layers**
**Use:** Trade areas, submarket boundaries, zoning districts

**Features:**
- Fill color + opacity
- Border color + width
- Label placement
- Click for metadata

**Example:**
- All deal trade areas overlaid
- Submarket boundaries (Midtown, Buckhead)
- Zoning overlay

---

### **5. Data Overlay Layers (Choropleth)**
**Use:** Demographics, vacancy, rent growth by zone

**Features:**
- Color scale (e.g., vacancy: green=low, red=high)
- Legend with value ranges
- Grid or polygon-based
- Adjustable transparency

**Example:**
- Rent comp overlay by census tract
- Vacancy rate by submarket
- Population density heatmap

---

## 🎛️ Layer Controls Panel

**Position:** Floating panel (top-right or collapsible sidebar)

```
┌─────────────────────────┐
│  🗺️ ACTIVE LAYERS (4)   │
├─────────────────────────┤
│ 👁️ Assets Owned (23)    │  [Opacity: ▓▓▓▓▓░░░ 70%]
│    🔵🔵🔵 [Filter ▾]     │  [🗑️] [⚙️]
├─────────────────────────┤
│ 👁️ Pipeline (8)         │  [Opacity: ▓▓▓▓▓▓▓▓ 100%]
│    🟢🟡🔴 [Filter ▾]     │  [🗑️] [⚙️]
├─────────────────────────┤
│ 👁️ News Heatmap         │  [Opacity: ▓▓▓░░░░░ 40%]
│    🌡️ Intensity: High   │  [🗑️] [⚙️]
├─────────────────────────┤
│ 👁️ Rent Overlay         │  [Opacity: ▓▓▓▓░░░░ 50%]
│    $1800-$2500/mo       │  [🗑️] [⚙️]
└─────────────────────────┘
     [+ Add Layer]
```

**Features per Layer:**
- **Eye icon** → Toggle visibility on/off
- **Drag handle** → Reorder z-index (top layer = rendered last)
- **Opacity slider** → 0-100% transparency
- **Filter dropdown** → Category/value filtering
- **Settings gear** → Layer-specific config (color, size, clustering)
- **Trash icon** → Remove layer from map

---

## 🔄 Layer Creation Workflows

### **Workflow 1: From Sidebar (Right-Click)**

```
User Flow:
1. Right-click "Assets Owned (23)" in sidebar
2. Context menu appears:
   ┌─────────────────────┐
   │ ✓ Show on Map       │
   │   Add as Layer      │
   │   Filter...         │
   │   Export            │
   └─────────────────────┘
3. Click "Show on Map"
4. Layer appears in Layers Panel
5. 23 asset pins appear on map
```

---

### **Workflow 2: From Sidebar (Drag & Drop)**

```
User Flow:
1. User drags "Pipeline (8)" from sidebar
2. Drop zone highlights on map
3. Drop onto map
4. Layer created instantly
5. Layer controls appear in panel
```

---

### **Workflow 3: War Maps (Layer Composer)**

```
User Flow:
1. Click "War Maps" in horizontal bar
2. Layer Composer modal opens:

   ┌────────────────────────────────┐
   │  🗺️ WAR MAP COMPOSER           │
   ├────────────────────────────────┤
   │  Available Layers:             │
   │  ☐ Email Intel (5)             │
   │  ☐ News Signals (3)            │
   │  ☑ Assets Owned (23)  👁️ 80%   │
   │  ☑ Pipeline (8)       👁️ 100%  │
   │  ☐ Rent Overlay                │
   │  ☐ Vacancy Overlay             │
   │  ☐ All Deal Boundaries         │
   │                                │
   │  [Preview] [Save as Tab]       │
   └────────────────────────────────┘

3. Check layers to include
4. Adjust opacity per layer
5. Click "Save as Tab"
6. Name: "Full Market View"
7. New tab appears in horizontal bar
```

---

### **Workflow 4: Create New Map**

```
User Flow:
1. Click "+ Create Map" in horizontal bar
2. New blank map tab created: "Untitled Map 1"
3. Layer Picker panel appears:
   ┌────────────────────────────┐
   │  Add Layers to Map:        │
   │  [ ] Email Intel           │
   │  [ ] News Signals          │
   │  [ ] Assets                │
   │  [ ] Pipeline              │
   │  [ ] Market Data           │
   └────────────────────────────┘
4. User selects layers
5. Click "Add"
6. Layers render on map
7. User can name the map tab
```

---

## 💾 Data Model

### **Map Configuration**

```typescript
interface MapConfiguration {
  id: number;
  name: string; // "Midtown Research", "War Map", etc.
  user_id: number;
  is_war_map: boolean; // True = shows all layers
  center: [number, number]; // Map center
  zoom: number;
  layers: MapLayer[]; // Ordered array (z-index)
  created_at: string;
  updated_at: string;
}
```

### **Map Layer**

```typescript
interface MapLayer {
  id: string; // Unique layer ID
  type: 'pin' | 'bubble' | 'heatmap' | 'boundary' | 'overlay';
  name: string; // "Assets Owned", "Pipeline", etc.
  source: LayerSource; // Where data comes from
  visible: boolean; // Eye icon state
  opacity: number; // 0-100
  z_index: number; // Render order
  filters: LayerFilter[]; // Active filters
  style: LayerStyle; // Colors, sizes, etc.
  data?: any; // Cached data (optional)
}

interface LayerSource {
  type: 'sidebar_item' | 'api_endpoint' | 'static';
  reference: string; // "assets_owned", "/api/v1/properties", etc.
  params?: any; // Query params for API calls
}

interface LayerFilter {
  field: string; // "property_type", "status", etc.
  operator: '=' | '>' | '<' | 'in';
  value: any;
}

interface LayerStyle {
  // Pin layers
  icon?: string;
  color?: string;
  size?: number;
  
  // Bubble layers
  radius_min?: number;
  radius_max?: number;
  metric?: string; // What determines bubble size
  
  // Heatmap layers
  intensity?: number;
  radius?: number;
  gradient?: string[]; // Color gradient
  
  // Boundary layers
  fill_color?: string;
  border_color?: string;
  border_width?: number;
  
  // Overlay layers
  color_scale?: { value: number; color: string }[];
  legend?: { min: number; max: number; unit: string };
}
```

---

## 🔌 Backend Requirements

### **New API Endpoints**

```
# Map Configurations
POST   /api/v1/maps                      # Create new map
GET    /api/v1/maps                      # List user's saved maps
GET    /api/v1/maps/:id                  # Get map config
PUT    /api/v1/maps/:id                  # Update map config
DELETE /api/v1/maps/:id                  # Delete map
POST   /api/v1/maps/:id/layers           # Add layer to map
DELETE /api/v1/maps/:id/layers/:layerId  # Remove layer

# Layer Data Sources
GET    /api/v1/layers/email-intel        # Email mentions as pins
GET    /api/v1/layers/news-signals       # News intel as heatmap
GET    /api/v1/layers/assets             # All assets as pins
GET    /api/v1/layers/pipeline           # Pipeline deals as pins
GET    /api/v1/layers/market-data        # Market overlays (rent, vacancy)
GET    /api/v1/layers/deal-boundaries    # All deal trade areas
```

### **Database Schema**

```sql
-- Map configurations
CREATE TABLE map_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    is_war_map BOOLEAN DEFAULT false,
    center_lat DECIMAL(10, 7),
    center_lng DECIMAL(10, 7),
    zoom DECIMAL(4, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Map layers (many-to-many with configs)
CREATE TABLE map_layers (
    id SERIAL PRIMARY KEY,
    map_id INTEGER REFERENCES map_configurations(id) ON DELETE CASCADE,
    layer_id VARCHAR(100) NOT NULL, -- "assets_owned", "pipeline", etc.
    layer_type VARCHAR(50) NOT NULL, -- 'pin', 'bubble', 'heatmap', etc.
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_reference TEXT,
    source_params JSONB,
    visible BOOLEAN DEFAULT true,
    opacity INTEGER DEFAULT 100,
    z_index INTEGER NOT NULL,
    filters JSONB,
    style JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_map_layers_map ON map_layers(map_id);
CREATE INDEX idx_map_layers_z_index ON map_layers(map_id, z_index);
```

---

## 🎨 Frontend Components

### **New Components to Build**

```
frontend/src/components/map/
├── LayersPanel.tsx              # Main layer controls panel
├── LayerItem.tsx                # Single layer in panel (with controls)
├── LayerComposer.tsx            # War Maps modal for layer selection
├── LayerPicker.tsx              # "+ Add Layer" modal
├── LayerStyleEditor.tsx         # Layer settings modal (colors, sizes)
├── MapTabBar.tsx                # Horizontal tab bar for saved maps
├── LayerRenderer.tsx            # Renders layers on Mapbox map
└── DraggableLayerSource.tsx     # Makes sidebar items draggable
```

### **Updated Components**

```
frontend/src/pages/Dashboard.tsx
- Add MapTabBar
- Add LayersPanel
- Integrate LayerRenderer

frontend/src/components/layout/Sidebar.tsx
- Add drag handles to items
- Add right-click context menu
- "Show on Map" / "Add as Layer"
```

---

## 🚀 Implementation Phases

### **Phase 1: Foundation (Week 1, 8-10 hours)**
- [ ] Database schema for map_configurations + map_layers
- [ ] API endpoints for CRUD on maps
- [ ] LayersPanel component (basic toggle/opacity)
- [ ] LayerRenderer integration with Mapbox

**Deliverable:** Can create a map, add 2-3 hardcoded layers, toggle visibility

---

### **Phase 2: Layer Sources (Week 2, 10-12 hours)**
- [ ] API endpoints for layer data:
  - /layers/assets (23 properties → pins)
  - /layers/pipeline (8 deals → pins)
  - /layers/email-intel (email mentions → pins)
  - /layers/news-signals (news → heatmap)
- [ ] LayerPicker modal
- [ ] Drag & drop from sidebar to map
- [ ] Right-click context menu on sidebar items

**Deliverable:** Can add real layers from sidebar items

---

### **Phase 3: War Maps & Saved Tabs (Week 3, 8-10 hours)**
- [ ] LayerComposer modal
- [ ] MapTabBar component
- [ ] Save/load map configurations
- [ ] War Maps = master layer view
- [ ] Tab switching with layer persistence

**Deliverable:** Can create "Midtown Research" tab with saved layers

---

### **Phase 4: Advanced Features (Week 4, 12-15 hours)**
- [ ] Layer filtering (by category, value ranges)
- [ ] LayerStyleEditor (colors, sizes, icons)
- [ ] Bubble layers (sized by metric)
- [ ] Heatmap layers (intensity, gradient)
- [ ] Data overlay layers (choropleth)
- [ ] Z-order drag reordering
- [ ] Layer cloning/duplication

**Deliverable:** Full Photoshop-like layer system

---

### **Phase 5: Polish & Edge Cases (Week 5, 6-8 hours)**
- [ ] Performance optimization (layer caching, lazy loading)
- [ ] Mobile responsive design
- [ ] Keyboard shortcuts (toggle layers, etc.)
- [ ] Export map as image/PDF
- [ ] Share map configurations with team
- [ ] Analytics: track which layers are most used

**Deliverable:** Production-ready Map Layer System

---

## 🎯 Success Metrics

**User can:**
- ✅ Create a new map tab in <30 seconds
- ✅ Add 5 layers to a map in <2 minutes
- ✅ Toggle layer visibility instantly (no lag)
- ✅ Save "War Map" and reload it next session
- ✅ Drag sidebar item onto map to add layer
- ✅ Filter "Assets Owned" to show only multifamily
- ✅ Adjust layer opacity with visual feedback

**System performance:**
- ✅ Map renders <500ms with 5 layers active
- ✅ Layer toggle responds <100ms
- ✅ Layer data fetched <2s per source
- ✅ No memory leaks after 30 min of layer toggling

---

## 📝 Open Questions

1. **Layer Limits:** Max layers per map? (Suggest 10-15)
2. **Data Refresh:** How often do layers refresh? Real-time? On tab switch?
3. **Permissions:** Can users share maps with team members?
4. **Default Map:** Should there be a "Default" map that always loads?
5. **Layer Presets:** Should we provide "Starter Maps" (templates)?
6. **Mobile:** Do we build mobile layer controls, or desktop-only for v1?
7. **Export:** What formats? PNG, PDF, GeoJSON, KML?

---

## 🔗 Related Systems

**Integrations needed:**
- **Trade Area System** → Boundary layers
- **News Intelligence** → Heatmap layer source
- **Email System** → Pin layer from email mentions
- **Properties** → Assets Owned layer data
- **Deals/Pipeline** → Deal boundary layers
- **Market Data** (future) → Choropleth overlays

---

## 📚 Reference Implementations

**Similar systems to study:**
- **Google My Maps** → Layer creation, saving maps
- **Mapbox Studio** → Layer styling, opacity, z-order
- **ArcGIS Online** → Data overlays, choropleth maps
- **Felt** → Collaborative map layer system
- **Tableau Maps** → Data visualization layers

---

**Status:** Design complete, ready for approval before implementation

**Next Steps:**
1. Review this design with Leon
2. Confirm priorities and phase order
3. Begin Phase 1 (Foundation) implementation
4. Set up weekly progress reviews

---

**Estimated Total Time:** 44-55 hours over 5 weeks (1-2 weeks with parallel dev)
