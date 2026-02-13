# Map Drawing Tools Integration Guide

## Overview

The MapDrawingTools component provides comprehensive drawing and annotation capabilities for Mapbox-powered maps in the JediRE platform. Users can draw markers, polygons, lines, measure distances, and save their annotations to the database.

## Components Created

### 1. Database Migration
**File:** `backend/src/database/migrations/007_create_map_annotations.sql`

Creates the `user_map_annotations` table to store drawings with:
- GeoJSON geometry storage
- User ownership and sharing capabilities
- Map type categorization (pipeline/assets/general)
- Visual properties (color, style)
- Measurement data for distance/area tools

### 2. Backend API
**File:** `backend/src/api/rest/mapAnnotations.routes.ts`

RESTful API endpoints:
- `GET /api/v1/map-annotations` - List all annotations
- `GET /api/v1/map-annotations/:id` - Get specific annotation
- `POST /api/v1/map-annotations` - Create new annotation
- `PUT /api/v1/map-annotations/:id` - Update annotation
- `DELETE /api/v1/map-annotations/:id` - Delete annotation
- `DELETE /api/v1/map-annotations?map_type=X` - Delete all for map type
- `POST /api/v1/map-annotations/export` - Export as GeoJSON
- `POST /api/v1/map-annotations/import` - Import from GeoJSON

### 3. Frontend Service
**File:** `frontend/src/services/mapAnnotations.service.ts`

TypeScript service providing:
- CRUD operations for annotations
- GeoJSON import/export
- Mapbox Draw integration helpers
- Distance/area calculations
- Format conversion utilities

### 4. MapDrawingTools Component
**File:** `frontend/src/components/map/MapDrawingTools.tsx`

React component with:
- Drawing modes: marker, line, polygon
- Color picker (8 preset colors)
- Measure tool (distance for lines, area for polygons)
- Edit/delete tools
- Import/Export GeoJSON
- Clear all drawings
- Auto-save to database
- Toggle visibility

## Integration Instructions

### Step 1: Run Database Migration

```bash
cd backend
psql -U your_db_user -d jedire_db -f src/database/migrations/007_create_map_annotations.sql
```

### Step 2: Import MapDrawingTools in Your Map Component

#### For AssetsMapView:

```tsx
// frontend/src/components/assets/AssetsMapView.tsx

import { useRef } from 'react';
import { MapRef } from 'react-map-gl';
import MapDrawingTools from '@/components/map/MapDrawingTools';

export default function AssetsMapView({ assets, onAssetClick }: AssetsMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  
  // ... existing state and logic ...
  
  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        // ... existing map props ...
      >
        {/* Existing map content */}
      </Map>
      
      {/* Add Drawing Tools */}
      <MapDrawingTools
        mapRef={mapRef}
        mapType="assets"
        onAnnotationsChange={(annotations) => {
          console.log('Annotations updated:', annotations);
        }}
      />
      
      {/* Existing UI elements (filters, popups, etc.) */}
    </div>
  );
}
```

#### For PipelineMapView:

```tsx
// frontend/src/components/pipeline/PipelineMapView.tsx

import { useRef } from 'react';
import { MapRef } from 'react-map-gl';
import MapDrawingTools from '@/components/map/MapDrawingTools';

export default function PipelineMapView({ deals, onDealClick }: PipelineMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  
  // ... existing state and logic ...
  
  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        // ... existing map props ...
      >
        {/* Existing map content */}
      </Map>
      
      {/* Add Drawing Tools */}
      <MapDrawingTools
        mapRef={mapRef}
        mapType="pipeline"
        onAnnotationsChange={(annotations) => {
          console.log('Annotations updated:', annotations);
        }}
      />
      
      {/* Existing UI elements */}
    </div>
  );
}
```

### Step 3: Verify API Route Registration

The route is already registered in `backend/src/api/rest/index.ts`:

```typescript
import mapAnnotationsRoutes from './mapAnnotations.routes';

// In setupRESTRoutes():
app.use(`${API_PREFIX}/map-annotations`, mapAnnotationsRoutes);
```

## Features

### Drawing Modes

1. **Select & Edit** - Click and drag to modify existing shapes
2. **Marker** - Click to place point markers with notes
3. **Line** - Draw lines to measure distances between points
4. **Polygon** - Draw areas to mark zones or neighborhoods

### Measurement Tools

- **Line measurements**: Automatically calculated in miles
- **Polygon measurements**: Automatically calculated in acres
- Measurements display in real-time during drawing
- Saved with annotations for future reference

### Color Customization

8 preset colors available:
- Blue (#3B82F6) - Default
- Red (#EF4444)
- Green (#10B981)
- Yellow (#F59E0B)
- Purple (#8B5CF6)
- Pink (#EC4899)
- Gray (#6B7280)
- Orange (#F97316)

### Data Management

- **Auto-save**: Drawings automatically saved to database
- **Export**: Download all drawings as GeoJSON
- **Import**: Upload GeoJSON files to restore drawings
- **Delete**: Remove individual or all drawings
- **Persistence**: Drawings persist across sessions
- **Sharing**: Can be shared with team (future enhancement)

### User Experience

- Real-time save status indicator
- Undo/redo support (planned)
- Keyboard shortcuts (ESC to cancel drawing)
- Hover tooltips on all tools
- Responsive design for different screen sizes

## Architecture

### Data Flow

1. User draws on map → Mapbox Draw captures geometry
2. Component processes feature → Converts to annotation format
3. Service sends to API → POST /api/v1/map-annotations
4. Database stores → PostgreSQL with PostGIS
5. Component updates → Local state synced
6. Other users see (if shared) → Real-time via WebSocket (optional)

### Storage Format

Annotations stored as:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "map_type": "pipeline",
  "annotation_type": "polygon",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "properties": {
    "fillColor": "#3B82F6",
    "fillOpacity": 0.3,
    "strokeWidth": 2
  },
  "label": "Target Market Area",
  "color": "#3B82F6",
  "measurement_value": 125.5,
  "measurement_unit": "acres"
}
```

## Testing

### Manual Testing

1. **Draw a marker**:
   - Click "Marker" button
   - Click on map
   - Verify marker appears and saves

2. **Draw a line**:
   - Click "Line" button
   - Click multiple points
   - Press Enter or double-click to finish
   - Verify distance measurement appears

3. **Draw a polygon**:
   - Click "Polygon" button
   - Click around an area
   - Close the shape
   - Verify area calculation appears

4. **Change color**:
   - Click "Color" button
   - Select a different color
   - Draw a new shape
   - Verify new color is applied

5. **Export/Import**:
   - Draw several shapes
   - Click "Export"
   - Save GeoJSON file
   - Click "Clear All"
   - Click "Import"
   - Select saved file
   - Verify shapes reappear

### API Testing

```bash
# List annotations
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/map-annotations?map_type=pipeline

# Create annotation
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "map_type": "assets",
    "annotation_type": "marker",
    "geometry": {"type":"Point","coordinates":[-84.39,33.75]},
    "label": "Important Location",
    "color": "#EF4444"
  }' \
  http://localhost:3000/api/v1/map-annotations

# Delete annotation
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/map-annotations/ANNOTATION_ID
```

## Troubleshooting

### Drawings not saving

1. Check browser console for errors
2. Verify API endpoint is accessible: `/api/v1/map-annotations`
3. Ensure user is authenticated (token in localStorage)
4. Check database connection and migration

### Mapbox Draw not loading

1. Verify `@mapbox/mapbox-gl-draw` is installed:
   ```bash
   npm list @mapbox/mapbox-gl-draw
   ```
2. Check CSS import in component
3. Verify Mapbox token is set

### Colors not updating

1. Refresh the page after changing color
2. Colors only apply to newly drawn features
3. Existing features need to be edited to change color

## Future Enhancements

- [ ] Text labels with custom font sizes
- [ ] Circle/radius drawing mode
- [ ] Rectangle drawing mode
- [ ] Undo/Redo functionality
- [ ] Copy/Paste features
- [ ] Snap to grid/features
- [ ] Layer grouping and organization
- [ ] Real-time collaboration (multi-user editing)
- [ ] Drawing templates/presets
- [ ] Advanced styling (dash patterns, opacity control)
- [ ] Attach notes/documents to drawings
- [ ] Search annotations by label
- [ ] Filter annotations by type/color/date

## Dependencies

- `@mapbox/mapbox-gl-draw` ^1.5.1 ✅ Already installed
- `mapbox-gl` ^3.0.1 ✅ Already installed
- `react-map-gl` ^8.1.0 ✅ Already installed
- PostgreSQL with PostGIS extension

## Support

For issues or questions:
1. Check console logs for error messages
2. Review database migration logs
3. Test API endpoints with curl
4. Check Mapbox Draw documentation: https://github.com/mapbox/mapbox-gl-draw

## Summary

The Map Drawing Tools provide a production-ready annotation system for portfolio maps with:
- ✅ Full CRUD API
- ✅ Database persistence with PostGIS
- ✅ Import/Export capabilities
- ✅ Real-time measurements
- ✅ Auto-save functionality
- ✅ Intuitive UI
- ✅ Type-safe TypeScript implementation

Ready to deploy to both PipelineMapView and AssetsMapView!
