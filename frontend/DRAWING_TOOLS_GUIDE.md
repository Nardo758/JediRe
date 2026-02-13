# Pipeline Map Drawing Tools - Complete Guide

## Overview

Comprehensive drawing/annotation tools integrated into Pipeline Map View, allowing users to mark areas, measure distances, place markers, and collaborate with team annotations.

## Features

### Drawing Tools
- 📍 **Markers/Pins** - Place custom markers on map
- ✏️ **Polygons** - Draw custom areas and zones
- 📏 **Lines** - Measure distances, mark routes
- ⭕ **Circles** - Draw circular areas (radius-based)
- ✂️ **Edit/Delete** - Modify and remove drawn shapes

### Styling Options
- 🎨 **Color Picker** - 8 preset colors
- 📐 **Stroke Width** - 1-10px line thickness
- 💧 **Fill Opacity** - 0-100% transparency
- 🖌️ **Live Preview** - See changes in real-time

### Collaboration
- 👥 **Share with Team** - Make drawings visible to all
- 👤 **Private Drawings** - Keep annotations private
- 📤 **Export** - Download as GeoJSON
- 💾 **Save/Load** - Persist drawings to database

## Installation

### 1. Install Dependencies

```bash
cd jedire/frontend
npm install @mapbox/mapbox-gl-draw
npm install @types/mapbox__mapbox-gl-draw --save-dev
```

### 2. Import CSS

```tsx
// In your main App.tsx or index.tsx
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
```

### 3. Database Setup

Run the migration:

```bash
cd jedire/backend
psql -d your_database -f migrations/MAP_ANNOTATIONS_SCHEMA.sql
```

Or with Prisma:

```prisma
// schema.prisma
model UserMapAnnotation {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  title           String
  description     String?
  geojson         Json
  color           String   @default("#3B82F6")
  strokeWidth     Int      @default(2) @map("stroke_width")
  fillOpacity     Decimal  @default(0.3) @map("fill_opacity")
  isShared        Boolean  @default(false) @map("is_shared")
  sharedWithTeam  Boolean  @default(false) @map("shared_with_team")
  sharedWithUsers String[] @map("shared_with_users")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  user User @relation(fields: [userId], references: [id])

  @@map("user_map_annotations")
  @@index([userId])
  @@index([sharedWithTeam])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_map_annotations
```

### 4. API Endpoints

Add to your backend router:

```typescript
// backend/src/index.ts
import mapAnnotationsRouter from './api/rest/map-annotations';

app.use('/api/v1/map-annotations', authenticate, mapAnnotationsRouter);
```

## Usage

### Replace PipelineMapView with Drawing-Enabled Version

```tsx
// Before
import PipelineMapView from '@/components/pipeline/PipelineMapView';

<PipelineMapView deals={deals} onDealClick={handleClick} />

// After
import PipelineMapViewWithDrawing from '@/components/pipeline/PipelineMapViewWithDrawing';

<PipelineMapViewWithDrawing 
  deals={deals} 
  onDealClick={handleClick}
  userId={currentUser.id}
/>
```

### Update PipelineGridPage

```tsx
// PipelineGridPage.tsx
import PipelineMapViewWithDrawing from '../components/pipeline/PipelineMapViewWithDrawing';

// In render:
{viewMode === 'map' && (
  <PipelineMapViewWithDrawing
    deals={deals}
    onDealClick={handleRowClick}
    loading={loading}
    userId={currentUser?.id}
  />
)}
```

## User Guide

### Drawing Shapes

#### 1. Place Marker
1. Click **"Add Marker"** button
2. Click anywhere on map to place marker
3. Marker appears with selected color

#### 2. Draw Polygon
1. Click **"Draw Polygon"** button
2. Click to add points
3. Double-click to close shape
4. Shape fills with selected color/opacity

#### 3. Draw Line
1. Click **"Draw Line"** button
2. Click to add points
3. Double-click to finish
4. See distance measurement

#### 4. Draw Circle
1. Click **"Draw Circle"** button
2. Click center point
3. Drag to set radius
4. Release to finish

### Editing Shapes

#### Select Mode
1. Click **"Select & Edit"** button
2. Click any shape to select
3. Drag vertices to reshape
4. Drag shape to move
5. Press Delete or click **"Delete Selected"**

### Styling

#### Change Color
- Select from 8 preset colors
- Applies to new drawings
- Edit existing: Select shape, change color, draw again

#### Adjust Line Width
- Use slider (1-10px)
- Thicker lines = more visible
- Thinner lines = more precise

#### Set Fill Opacity
- Use slider (0-100%)
- 0% = transparent
- 100% = solid
- 30% recommended for overlays

### Saving & Loading

#### Save Drawings
1. Draw shapes on map
2. Click **"Save Drawings"**
3. Enter title (e.g., "Atlanta Market Analysis")
4. Click Save
5. Drawings saved to your account

#### Load Saved Drawings
1. Click **"Share with Team"** (or **"Saved Drawings"** button)
2. View list of saved drawings
3. Click **"Load"** on any drawing
4. Drawing appears on map

#### Export as GeoJSON
1. Draw or load shapes
2. Click **"Export GeoJSON"**
3. File downloads automatically
4. Use in GIS software or other tools

### Sharing & Collaboration

#### Share with Team
1. Save your drawing
2. Click **"Share"** icon on saved drawing
3. Confirm sharing
4. Drawing now visible to all team members

#### View Team Drawings
1. Open Saved Drawings panel
2. Click **"Shared"** tab
3. See all team-shared drawings
4. Load any drawing to view

#### Private Drawings
- By default, drawings are private
- Only you can see them
- Share when ready

## API Reference

### Endpoints

#### GET /api/v1/map-annotations
Get user's saved annotations

**Query Params:**
- `include_shared` (boolean) - Include team shared drawings

**Response:**
```json
{
  "annotations": [
    {
      "id": "uuid",
      "user_id": "user-123",
      "user_name": "John Doe",
      "title": "Market Analysis",
      "description": "Q1 2024 target zones",
      "geojson": { "type": "FeatureCollection", "features": [...] },
      "color": "#3B82F6",
      "stroke_width": 2,
      "fill_opacity": 0.3,
      "is_shared": false,
      "shared_with_team": false,
      "feature_count": 5,
      "created_at": "2024-02-12T10:00:00Z",
      "updated_at": "2024-02-12T10:30:00Z"
    }
  ]
}
```

#### POST /api/v1/map-annotations
Create new annotation

**Body:**
```json
{
  "title": "Market Analysis",
  "description": "Optional description",
  "geojson": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "color": "#3B82F6",
  "stroke_width": 2,
  "fill_opacity": 0.3
}
```

#### PATCH /api/v1/map-annotations/:id
Update annotation

**Body:**
```json
{
  "title": "Updated Title",
  "description": "New description",
  "geojson": { ... }
}
```

#### POST /api/v1/map-annotations/:id/share
Share with team

**Body:**
```json
{
  "shared_with_team": true
}
```

#### DELETE /api/v1/map-annotations/:id
Delete annotation (soft delete)

**Response:** 204 No Content

## GeoJSON Format

### FeatureCollection Structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "id": "feature-1",
      "type": "Feature",
      "properties": {
        "name": "Zone A",
        "color": "#10B981"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-84.40, 33.75],
            [-84.39, 33.75],
            [-84.39, 33.76],
            [-84.40, 33.76],
            [-84.40, 33.75]
          ]
        ]
      }
    }
  ]
}
```

### Supported Geometry Types

- **Point** - Single marker
- **LineString** - Line or route
- **Polygon** - Area or zone
- **MultiPoint** - Multiple markers
- **MultiLineString** - Multiple lines
- **MultiPolygon** - Multiple areas

## Advanced Features

### Custom Styles

```typescript
// Custom draw styles
const draw = new MapboxDraw({
  styles: [
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      paint: {
        'fill-color': selectedColor,
        'fill-opacity': fillOpacity,
      },
    },
    {
      id: 'gl-draw-polygon-stroke',
      type: 'line',
      paint: {
        'line-color': selectedColor,
        'line-width': strokeWidth,
      },
    },
  ],
});
```

### Measurement Tools

```typescript
import * as turf from '@turf/turf';

// Measure line distance
const line = turf.lineString(coordinates);
const distance = turf.length(line, { units: 'miles' });

// Calculate polygon area
const polygon = turf.polygon(coordinates);
const area = turf.area(polygon); // square meters
```

### Batch Operations

```typescript
// Load multiple drawings
savedDrawings.forEach(drawing => {
  drawing.geojson.features.forEach(feature => {
    draw.add(feature);
  });
});

// Export all drawings
const allFeatures = draw.getAll();
const geojson = JSON.stringify(allFeatures, null, 2);
```

## Keyboard Shortcuts

- **Esc** - Cancel drawing/deselect
- **Delete** / **Backspace** - Delete selected
- **Z** (while drawing) - Undo last point
- **Enter** - Finish drawing (polygon/line)

## Tips & Best Practices

### Performance
- 🎯 Keep feature count reasonable (<100 per drawing)
- 🗜️ Simplify complex polygons
- 💾 Save frequently to avoid data loss
- 🔄 Load only needed drawings

### Collaboration
- 📝 Use descriptive titles
- 📅 Include dates in names
- 🏷️ Use consistent color coding
- 📣 Share important zones with team

### Organization
- 🗂️ Create separate drawings for different purposes
- 🎨 Use color consistently (e.g., red = risk areas)
- 📊 Export for backup and external analysis
- 🧹 Delete old/unused drawings

## Troubleshooting

### Drawings Not Saving
**Problem:** Click save but nothing happens

**Solutions:**
1. Check browser console for errors
2. Verify API endpoint is correct
3. Check authentication token
4. Ensure GeoJSON is valid

### Can't See Team Drawings
**Problem:** Team shared drawings not visible

**Solutions:**
1. Click "Shared" tab in Saved Drawings panel
2. Check `include_shared=true` query param
3. Verify sharing permissions in database
4. Refresh page

### Drawing Tool Not Working
**Problem:** Click tool but can't draw

**Solutions:**
1. Check Mapbox Draw is loaded
2. Verify Draw control is added to map
3. Check for JavaScript errors
4. Try different browser

### Exported GeoJSON Invalid
**Problem:** Downloaded file won't open in GIS software

**Solutions:**
1. Validate JSON syntax
2. Check geometry coordinates format
3. Ensure proper FeatureCollection structure
4. Use online GeoJSON validator

## Examples

### Mark Opportunity Zones
```typescript
// 1. Click "Draw Polygon"
// 2. Draw around high-value area
// 3. Set color to green (#10B981)
// 4. Save as "Q1 Target Zones"
// 5. Share with team
```

### Measure Distance Between Properties
```typescript
// 1. Click "Draw Line"
// 2. Click first property
// 3. Click second property
// 4. Double-click to finish
// 5. See distance in miles
```

### Mark Risk Areas
```typescript
// 1. Click "Draw Polygon"
// 2. Draw around risky neighborhoods
// 3. Set color to red (#EF4444)
// 4. Set opacity to 50%
// 5. Save as "Supply Risk Zones"
```

## Future Enhancements

### Planned Features
- [ ] Text labels on shapes
- [ ] Measurement display on map
- [ ] Drawing templates
- [ ] Copy/paste shapes
- [ ] Snap to grid
- [ ] Drawing history/undo stack
- [ ] Comments on shapes
- [ ] Real-time collaboration (multi-user)
- [ ] Drawing notifications
- [ ] Mobile drawing support

## Support

**Documentation:**
- This guide
- API documentation
- GeoJSON spec

**Questions?**
1. Check this guide
2. Review code comments
3. Test in browser console
4. Contact engineering team

---

**Version:** 1.0.0  
**Last Updated:** February 12, 2024  
**Built for:** JEDI Real Estate Pipeline Map View
