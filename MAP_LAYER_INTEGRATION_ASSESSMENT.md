# Map Layer Integration Assessment
**Created:** 2026-02-08  
**Scope:** Add "Show on Map" functionality for 3 sidebar items: News Intelligence, Assets Owned, Pipeline  
**Approach:** Assess current architecture and design minimal, non-breaking integration

---

## 🔍 Current State Analysis

### ✅ **What Already Exists:**

1. **MapLayersContext** (`frontend/src/contexts/MapLayersContext.tsx`)
   - ✅ Context for managing layer state
   - ✅ `toggleLayer()` function to enable/disable layers
   - ✅ `updateOpacity()` for layer transparency
   - ✅ `reorderLayers()` for z-index management
   - ✅ Predefined layers:
     - `assets-owned` (🏢 Assets Owned, active by default)
     - `pipeline` (📁 Pipeline, active by default)
     - 3 custom layers (Midtown Research, Competitor Analysis, Broker Recommendations)

2. **MainLayout Sidebar** (`frontend/src/components/layout/MainLayout.tsx`)
   - ✅ Navigation structure with sections:
     - Dashboard → Portfolio, Email, **News Intelligence (3)**
     - INTELLIGENCE LAYERS → Market Data, **Assets Owned (23)**
     - DEAL MANAGEMENT → **Pipeline (8)**
   - ✅ `handleLayerToggle()` function already implemented
   - ✅ `layerId` field on Assets Owned and Pipeline
   - ✅ `getLayerState()` to check if layer is active

3. **Dashboard Map** (`frontend/src/pages/Dashboard.tsx`)
   - ✅ Mapbox GL JS initialized
   - ✅ MapboxDraw integrated (for boundary drawing)
   - ✅ `map.current` ref available for adding layers
   - ✅ Deal boundaries already rendering (with `addDealsToMap()`)

---

## ❌ **What's Missing:**

### **1. News Intelligence Layer**
- Not defined in MapLayersContext
- No layerId in MainLayout navigation
- No data source

### **2. Map Icon Buttons**
- Sidebar items lack visual "Show on Map" icons
- No visual feedback when layer is active/inactive

### **3. Layer Rendering Logic**
- Dashboard doesn't subscribe to MapLayersContext
- No code to actually ADD markers when layer is toggled on
- No code to REMOVE markers when layer is toggled off

### **4. API Endpoints**
- No `/api/v1/layers/news-intelligence` endpoint
- No `/api/v1/layers/assets-owned` endpoint
- No `/api/v1/layers/pipeline` endpoint

### **5. Layer Data Fetching**
- No service to fetch layer data
- No caching mechanism
- No loading states

---

## 🎯 Integration Plan (Minimal Changes)

### **Phase 1: Add News Intelligence Layer (15 min)**

**File:** `frontend/src/contexts/MapLayersContext.tsx`

```typescript
// ADD to initial layers array
{ 
  id: 'news-intelligence', 
  name: 'News Intelligence', 
  type: 'news', 
  icon: '📰', 
  active: false,  // Start inactive
  opacity: 1.0 
}
```

**File:** `frontend/src/components/layout/MainLayout.tsx`

```typescript
// UPDATE News Intelligence item in navigation
{ 
  name: 'News Intelligence', 
  path: '/dashboard/news', 
  icon: '📰', 
  badge: '3',
  layerId: 'news-intelligence',  // ADD THIS
  expandable: true,
  subitems: [...]
}
```

---

### **Phase 2: Add Map Icon Buttons (30 min)**

**File:** `frontend/src/components/layout/MainLayout.tsx`

**Add icon button next to layer-enabled items:**

```tsx
{/* Example for Assets Owned */}
<Link
  to={item.path}
  className="flex items-center justify-between px-4 py-2 text-sm rounded-lg hover:bg-gray-100"
>
  <div className="flex items-center gap-3">
    <span>{item.icon}</span>
    <span>{item.name}</span>
    {item.badge && <span className="badge">{item.badge}</span>}
  </div>
  
  {/* ADD THIS: Map toggle button */}
  {item.layerId && (
    <button
      onClick={(e) => handleLayerToggle(item.layerId!, e)}
      className={`p-1 rounded hover:bg-gray-200 ${
        getLayerState(item.layerId!) ? 'text-blue-600' : 'text-gray-400'
      }`}
      title={getLayerState(item.layerId!) ? 'Hide on map' : 'Show on map'}
    >
      🗺️
    </button>
  )}
</Link>
```

**Visual States:**
- **Inactive:** 🗺️ (gray, faded)
- **Active:** 🗺️ (blue, bright)
- **Hover:** Background highlight

---

### **Phase 3: Dashboard Map Integration (45 min)**

**File:** `frontend/src/pages/Dashboard.tsx`

**Step 1: Subscribe to MapLayersContext**

```typescript
import { useMapLayers } from '../contexts/MapLayersContext';

export const Dashboard: React.FC = () => {
  const { layers, getActiveLayerIds } = useMapLayers();
  const [layerMarkers, setLayerMarkers] = useState<Map<string, mapboxgl.Marker[]>>(new Map());
  
  // ... existing code
```

**Step 2: Watch for layer changes**

```typescript
// Render layers when they change
useEffect(() => {
  if (!map.current) return;

  const activeLayerIds = getActiveLayerIds();
  
  // Add new active layers
  activeLayerIds.forEach(layerId => {
    if (!layerMarkers.has(layerId)) {
      addLayerToMap(layerId);
    }
  });
  
  // Remove inactive layers
  layerMarkers.forEach((markers, layerId) => {
    if (!activeLayerIds.includes(layerId)) {
      removeLayerFromMap(layerId);
    }
  });
  
}, [layers]);
```

**Step 3: Add layer rendering functions**

```typescript
const addLayerToMap = async (layerId: string) => {
  if (!map.current) return;
  
  try {
    // Fetch layer data
    const data = await fetchLayerData(layerId);
    
    // Create markers
    const markers: mapboxgl.Marker[] = data.locations.map(loc => {
      const el = document.createElement('div');
      el.className = `layer-marker layer-${layerId}`;
      el.innerHTML = getMarkerIcon(layerId);
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new mapboxgl.Popup().setHTML(loc.popupHTML))
        .addTo(map.current!);
      
      return marker;
    });
    
    // Store markers for later removal
    setLayerMarkers(prev => new Map(prev).set(layerId, markers));
    
  } catch (error) {
    console.error(`Failed to add layer ${layerId}:`, error);
  }
};

const removeLayerFromMap = (layerId: string) => {
  const markers = layerMarkers.get(layerId);
  if (markers) {
    markers.forEach(m => m.remove());
    setLayerMarkers(prev => {
      const next = new Map(prev);
      next.delete(layerId);
      return next;
    });
  }
};

const fetchLayerData = async (layerId: string) => {
  const response = await fetch(`/api/v1/layers/${layerId}`);
  return response.json();
};

const getMarkerIcon = (layerId: string): string => {
  switch (layerId) {
    case 'news-intelligence': return '📰';
    case 'assets-owned': return '🏢';
    case 'pipeline': return '📊';
    default: return '📍';
  }
};
```

---

### **Phase 4: API Endpoints (30 min)**

**File:** `backend/src/api/rest/layers.routes.ts` (NEW)

```typescript
import { Router } from 'express';
import { query } from '../../database/connection';

const router = Router();

// GET /api/v1/layers/news-intelligence
router.get('/news-intelligence', async (req, res) => {
  try {
    // Query news events with locations
    const result = await query(`
      SELECT 
        id,
        title,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        category,
        confidence,
        impact_level
      FROM news_events
      WHERE location IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      locations: result.rows.map(row => ({
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        title: row.title,
        popupHTML: `
          <div class="p-2">
            <h4 class="font-bold">${row.title}</h4>
            <p class="text-sm">${row.category}</p>
            <p class="text-xs">Impact: ${row.impact_level}</p>
          </div>
        `
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news intelligence' });
  }
});

// GET /api/v1/layers/assets-owned
router.get('/assets-owned', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        address,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        units,
        occupancy,
        property_type
      FROM properties
      WHERE owner_id = $1
      ORDER BY name
    `, [req.user.userId]);
    
    res.json({
      success: true,
      locations: result.rows.map(row => ({
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        title: row.name,
        popupHTML: `
          <div class="p-2">
            <h4 class="font-bold">${row.name}</h4>
            <p class="text-sm">${row.address}</p>
            <p class="text-xs">${row.units} units • ${row.occupancy}% occupied</p>
          </div>
        `
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/v1/layers/pipeline
router.get('/pipeline', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        address,
        ST_Y(ST_Centroid(boundary::geometry))::geometry) as lat,
        ST_X(ST_Centroid(boundary::geometry))::geometry) as lng,
        stage,
        tier,
        budget
      FROM deals
      WHERE user_id = $1
        AND stage != 'closed'
      ORDER BY created_at DESC
    `, [req.user.userId]);
    
    res.json({
      success: true,
      locations: result.rows.map(row => ({
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        title: row.name,
        popupHTML: `
          <div class="p-2">
            <h4 class="font-bold">${row.name}</h4>
            <p class="text-sm">${row.address}</p>
            <p class="text-xs">${row.stage} • ${row.tier} tier</p>
          </div>
        `
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

export default router;
```

**Register routes in** `backend/src/api/rest/index.ts`:

```typescript
import layersRoutes from './layers.routes';

// Add with other routes
app.use(`${API_PREFIX}/layers`, layersRoutes);
```

---

## 📦 Summary of Changes

### **Files to Modify:**

| File | Changes | Lines Added | Time |
|------|---------|-------------|------|
| `contexts/MapLayersContext.tsx` | Add news-intelligence layer | ~3 | 5 min |
| `components/layout/MainLayout.tsx` | Add map icon buttons, layerId | ~15 | 20 min |
| `pages/Dashboard.tsx` | Subscribe to context, render layers | ~80 | 45 min |
| `api/rest/layers.routes.ts` | **NEW FILE** - 3 endpoints | ~150 | 30 min |
| `api/rest/index.ts` | Register layers routes | ~2 | 2 min |

**Total:** 5 files, ~250 lines, **~2 hours**

---

## 🎨 Visual Design

### **Sidebar Before:**
```
INTELLIGENCE LAYERS
🏢 Assets Owned (23)
```

### **Sidebar After:**
```
INTELLIGENCE LAYERS
🏢 Assets Owned (23)  [🗺️]  ← Clickable map icon (blue when active)
```

### **Map Before:**
- Shows only deal boundaries

### **Map After:**
- Deal boundaries (existing)
- 📰 News pins (if layer active)
- 🏢 Asset pins (if layer active)
- 📊 Pipeline pins (if layer active)

---

## 🚀 Implementation Order

### **Step 1: Backend First (30 min)**
- Create `layers.routes.ts` with 3 endpoints
- Register in `index.ts`
- Test endpoints return data

### **Step 2: Context Update (5 min)**
- Add news-intelligence layer to MapLayersContext

### **Step 3: Sidebar Icons (20 min)**
- Add map icon buttons in MainLayout
- Add layerId to News Intelligence
- Test toggle updates context state

### **Step 4: Dashboard Rendering (45 min)**
- Subscribe Dashboard to MapLayersContext
- Implement addLayerToMap() and removeLayerFromMap()
- Test end-to-end: click icon → see markers

### **Step 5: Polish (15 min)**
- Marker styling (colors, hover effects)
- Loading states
- Error handling

**Total: 2 hours 15 minutes**

---

## ✅ Non-Breaking Design

### **Principles:**

1. **Additive Only** - No existing functionality removed
2. **Opt-In** - Layers start inactive (except existing assets/pipeline)
3. **Backward Compatible** - MapLayersContext maintains existing API
4. **Isolated** - New code doesn't touch CreateDeal, TradeArea, or other flows
5. **Progressive Enhancement** - Works without layer data (graceful failure)

### **What WON'T Break:**

- ✅ Existing deal boundaries rendering
- ✅ CreateDeal modal flow
- ✅ Trade area drawing
- ✅ Sidebar navigation
- ✅ Dashboard layout

### **Rollback Plan:**

If issues arise, simply:
1. Remove map icon buttons from MainLayout
2. Remove useMapLayers hook from Dashboard
3. System reverts to current behavior

---

## 🧪 Testing Plan

### **Manual Tests:**

1. **Toggle News Intelligence:**
   - Click 🗺️ icon → News pins appear
   - Click again → News pins disappear
   
2. **Toggle Assets Owned:**
   - Click 🗺️ icon → 23 asset pins appear
   - Verify locations match property addresses
   
3. **Toggle Pipeline:**
   - Click 🗺️ icon → 8 pipeline deal pins appear
   - Verify stages shown in popups

4. **Multiple Layers:**
   - Enable all 3 → All markers visible
   - Disable one → Only that layer's markers removed

5. **Performance:**
   - Enable/disable rapidly → No lag
   - Load with 3 layers active → <2s render

6. **Edge Cases:**
   - No data available → No markers, no error
   - API fails → Graceful error message
   - Invalid coordinates → Skip that marker

---

## 📝 Next Steps

**Option A: Implement Now (2 hours)**
- Follow implementation order above
- Deploy and test

**Option B: Fix Database Persistence First (30 min)**
- Wire trade areas to database
- Then implement layer system

**Option C: Review & Adjust**
- Discuss this assessment
- Modify approach if needed

---

**Recommendation:** Option A (implement now) since this is independent of database persistence issue. Layer system doesn't need trade areas to be saved to work.

---

**Status:** Assessment complete, ready for implementation approval
