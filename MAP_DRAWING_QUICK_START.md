# Map Drawing Tools - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Run Database Migration (30 seconds)

```bash
cd /home/leon/clawd/jedire/backend
psql -U postgres -d jedire_db -f src/database/migrations/007_create_map_annotations.sql
```

Expected output:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
ALTER TABLE
ALTER TABLE
```

### Step 2: Restart Backend (if running)

```bash
# Stop current backend
# Restart to load new routes
npm run dev
```

### Step 3: Add to AssetsMapView (2 minutes)

Open: `frontend/src/components/assets/AssetsMapView.tsx`

Add import at top:
```tsx
import MapDrawingTools from '@/components/map/MapDrawingTools';
```

Add before closing `</div>`:
```tsx
<MapDrawingTools
  mapRef={mapRef}
  mapType="assets"
  onAnnotationsChange={(annotations) => {
    console.log('Annotations:', annotations.length);
  }}
/>
```

### Step 4: Add to PipelineMapView (2 minutes)

Open: `frontend/src/components/pipeline/PipelineMapView.tsx`

Add import at top:
```tsx
import MapDrawingTools from '@/components/map/MapDrawingTools';
```

Add before closing `</div>`:
```tsx
<MapDrawingTools
  mapRef={mapRef}
  mapType="pipeline"
  onAnnotationsChange={(annotations) => {
    console.log('Annotations:', annotations.length);
  }}
/>
```

### Step 5: Test It!

1. Navigate to Pipeline or Assets map view
2. Look for drawing toolbar in top-right corner
3. Click "Marker" and click on map
4. See marker appear and auto-save
5. Refresh page - marker persists! ✅

## 🎨 Quick Feature Tour

### Draw a Market Area
1. Click **Polygon** button
2. Click around an area on map
3. Double-click to finish
4. See area calculation in acres
5. Auto-saved to your account!

### Measure Distance
1. Click **Line** button
2. Click start point
3. Click waypoints
4. Double-click to finish
5. See distance in miles

### Change Colors
1. Click **Color** button
2. Pick a color from palette
3. Draw new shape
4. New color applied!

### Export Your Work
1. Draw some shapes
2. Click **Export** button
3. Save GeoJSON file
4. Share with team!

### Import Saved Drawings
1. Click **Import** button
2. Select GeoJSON file
3. Drawings appear on map
4. Auto-saved to database

## 🔧 Troubleshooting

### "Drawings not appearing"
- Check browser console for errors
- Verify database migration ran successfully
- Check authentication token exists

### "Can't draw on map"
- Make sure you clicked a drawing mode button
- Blue highlight = active mode
- Gray = inactive

### "Auto-save not working"
- Check Network tab for API errors
- Verify route registered in `backend/src/api/rest/index.ts`
- Check user is authenticated

### "Wrong colors"
- Colors only apply to NEW drawings
- Change color BEFORE drawing
- To change existing: delete and redraw

## 📋 Keyboard Shortcuts

- `ESC` - Cancel current drawing
- `Delete` - Delete selected shape
- `Enter` - Finish line/polygon drawing

## 🎯 API Endpoints

All under `/api/v1/map-annotations`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List all your annotations |
| GET | `/:id` | Get specific annotation |
| POST | `/` | Create new annotation |
| PUT | `/:id` | Update annotation |
| DELETE | `/:id` | Delete annotation |
| DELETE | `/?map_type=X&confirm=true` | Delete all for map type |
| POST | `/export` | Export as GeoJSON |
| POST | `/import` | Import from GeoJSON |

## 🎨 Available Colors

1. **Blue** (#3B82F6) - Default
2. **Red** (#EF4444) - Alerts/Problems
3. **Green** (#10B981) - Good/Approved
4. **Yellow** (#F59E0B) - Warning/Caution
5. **Purple** (#8B5CF6) - Special/VIP
6. **Pink** (#EC4899) - Priority
7. **Gray** (#6B7280) - Notes/General
8. **Orange** (#F97316) - Action Items

## 📦 What Was Delivered

✅ **Database Table** - `user_map_annotations` with PostGIS support  
✅ **Backend API** - 8 RESTful endpoints with full CRUD  
✅ **Frontend Service** - TypeScript service with helpers  
✅ **Drawing Component** - React component with Mapbox Draw  
✅ **Auto-save** - Real-time persistence to database  
✅ **Import/Export** - GeoJSON support  
✅ **Measurements** - Distance (miles) and Area (acres)  
✅ **Color Picker** - 8 preset professional colors  
✅ **Documentation** - Full integration guide + quick start  

## 🚦 Status Indicators

Watch the bottom of the toolbar:

- **Saving...** (spinner) - Uploading to database
- **✓ X saved** - All changes saved successfully

## 🎓 Tips & Best Practices

1. **Use colors consistently**
   - Red = Issues/Risks
   - Green = Opportunities
   - Blue = Information
   - Yellow = Review needed

2. **Label your drawings**
   - Future: Click shape → Add label
   - For now: Use description property

3. **Export regularly**
   - Backup your work
   - Share with team
   - Use in presentations

4. **Measure before you buy**
   - Draw property boundaries
   - Calculate acreage
   - Measure distances to amenities

## 🔗 Next Steps

After setup:

1. Train team on drawing tools
2. Establish color conventions
3. Create drawing templates for common patterns
4. Set up export schedule for backups
5. Consider real-time collaboration setup

## 📞 Support

Issues? Check:
- Browser console (F12)
- Network tab for API errors
- Database connection
- Backend logs

Common fixes:
- Clear browser cache
- Re-run migration
- Check MAPBOX_TOKEN env variable
- Verify user authentication

## 🎉 You're Done!

Your portfolio maps now have professional drawing and annotation tools. Users can:
- ✅ Draw and save market areas
- ✅ Measure distances and acreage
- ✅ Mark important locations
- ✅ Export and share their work
- ✅ Import existing data

All changes auto-save and persist across sessions!

---

**Estimated Setup Time:** 5 minutes  
**Components Modified:** 2 (PipelineMapView, AssetsMapView)  
**New Files:** 4 (migration, routes, service, component)  
**Lines of Code:** ~1,200  

Ready to draw! 🎨🗺️
