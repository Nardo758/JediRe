# Drawing Tools - Quick Reference Card

## 🚀 Quick Setup (5 Minutes)

```bash
# 1. Install dependency
npm install @mapbox/mapbox-gl-draw

# 2. Import CSS (App.tsx)
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

# 3. Use component
import PipelineMapViewWithDrawing from './components/pipeline/PipelineMapViewWithDrawing';
<PipelineMapViewWithDrawing deals={deals} userId={user.id} />

# 4. Run migration
psql -d db -f backend/migrations/MAP_ANNOTATIONS_SCHEMA.sql
```

---

## 🎨 Drawing Tools

| Tool | Button | How to Use |
|------|--------|------------|
| **📍 Marker** | Add Marker | Click map to place |
| **✏️ Polygon** | Draw Polygon | Click points, double-click to close |
| **📏 Line** | Draw Line | Click points, double-click to finish |
| **⭕ Circle** | Draw Circle | Click center, drag radius |
| **✂️ Edit** | Select & Edit | Click shape, drag vertices |

---

## 🎨 Styling

| Control | Range | Default |
|---------|-------|---------|
| **Color** | 8 preset colors | Blue (#3B82F6) |
| **Stroke Width** | 1-10px | 2px |
| **Fill Opacity** | 0-100% | 30% |

**Preset Colors:**
- 🔵 Blue (#3B82F6)
- 🟢 Green (#10B981)  
- 🔴 Red (#EF4444)
- 🟡 Yellow (#F59E0B)
- 🟣 Purple (#8B5CF6)
- 🩷 Pink (#EC4899)
- 🟠 Orange (#F97316)
- 🔷 Cyan (#06B6D4)

---

## 💾 Actions

| Action | Button | Shortcut |
|--------|--------|----------|
| **Delete** | Delete Selected | Delete/Backspace |
| **Save** | Save Drawings | - |
| **Export** | Export GeoJSON | - |
| **Share** | Share with Team | - |
| **Toggle** | Eye icon | - |

---

## ⌨️ Keyboard Shortcuts

- **Esc** - Cancel drawing / Deselect
- **Delete** / **Backspace** - Delete selected
- **Z** (while drawing) - Undo last point
- **Enter** - Finish drawing (polygon/line)

---

## 🗄️ Database

**Table:** `user_map_annotations`

```sql
CREATE TABLE user_map_annotations (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  title VARCHAR(255),
  geojson JSONB,
  color VARCHAR(7),
  shared_with_team BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/map-annotations` | List drawings |
| POST | `/api/v1/map-annotations` | Create drawing |
| PATCH | `/api/v1/map-annotations/:id` | Update drawing |
| DELETE | `/api/v1/map-annotations/:id` | Delete drawing |
| POST | `/api/v1/map-annotations/:id/share` | Share with team |

---

## 📊 GeoJSON Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], ...]]
      },
      "properties": {}
    }
  ]
}
```

**Geometry Types:**
- Point, LineString, Polygon
- MultiPoint, MultiLineString, MultiPolygon

---

## 🔧 Component Props

```typescript
<PipelineMapViewWithDrawing
  deals={pipelineDeals}
  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
  loading={isLoading}
  userId={currentUser.id}  // Required for saving
/>
```

---

## 💡 Common Tasks

### Mark a Zone
1. Click "Draw Polygon"
2. Click to draw area
3. Double-click to close
4. Click "Save Drawings"

### Measure Distance
1. Click "Draw Line"
2. Click start point
3. Click end point
4. Double-click to finish
5. See distance (use Turf.js)

### Share with Team
1. Save drawing
2. Open Saved Drawings panel
3. Click Share icon
4. Confirm

### Export for GIS
1. Click "Export GeoJSON"
2. File downloads
3. Open in QGIS/ArcGIS

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| Tools don't appear | Check CSS imported |
| Can't save | Check API endpoint |
| No team drawings | Click "Shared" tab |
| Can't edit | Click "Select & Edit" |

---

## 📚 Files Reference

```
frontend/
├── src/components/pipeline/
│   ├── PipelineMapViewWithDrawing.tsx  ← Main component
│   ├── DrawingToolbar.tsx              ← Tool controls
│   └── SavedDrawingsPanel.tsx          ← Manage saved
│
├── DRAWING_TOOLS_GUIDE.md              ← Full guide
└── package.json                         ← Add dependency

backend/
├── migrations/
│   └── MAP_ANNOTATIONS_SCHEMA.sql      ← Database
└── src/api/rest/
    └── map-annotations.example.ts       ← API routes
```

---

## 🎯 Next Steps

1. ✅ Install `@mapbox/mapbox-gl-draw`
2. ✅ Run database migration
3. ✅ Add API routes
4. ✅ Import CSS
5. ✅ Replace component
6. ✅ Test drawing
7. ✅ Share with team

---

## 📞 Help

- **Full Guide:** `frontend/DRAWING_TOOLS_GUIDE.md`
- **API Docs:** `backend/src/api/rest/map-annotations.example.ts`
- **Schema:** `backend/migrations/MAP_ANNOTATIONS_SCHEMA.sql`

---

**Version:** 1.0.0 | **Built:** Feb 2024 | **Status:** ✅ Ready
