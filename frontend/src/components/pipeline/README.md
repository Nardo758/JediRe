# Pipeline Map View - Portfolio Level

## Overview
The Pipeline Map View provides a spatial visualization of all pipeline deals, enabling portfolio managers to see geographic distribution, clustering, and market insights at a glance.

## Components

### 1. PipelineMapView.tsx
Main map component that renders all pipeline deals using Mapbox GL.

**Features:**
- **Clustering**: Automatically clusters nearby deals when zoomed out using Supercluster
- **Color coding**: Deals color-coded by pipeline stage
- **Interactive markers**: Click markers to view deal details
- **Heatmap overlay**: Toggle density heatmap to identify deal concentration
- **Filtering**: Advanced filters for stage, price, score, strategy, source
- **Radius search**: Draw circles to find deals within X miles of a point
- **Saved positions**: Map position persists in localStorage
- **Stats bar**: Real-time portfolio metrics (deal count, total value, avg score)

**Stage Colors:**
- Sourcing: Green (#10B981)
- Underwriting: Blue (#3B82F6)
- Due Diligence: Amber (#F59E0B)
- Under Contract: Purple (#8B5CF6)
- Closing: Pink (#EC4899)
- Passed: Gray (#6B7280)

### 2. DealMapPopup.tsx
Popup component showing deal details when a marker is clicked.

**Displays:**
- Property name and address
- Pipeline stage and days in stage
- AI opportunity score with visual badge
- Key metrics: Ask price, units, IRR (broker & JEDI)
- JEDI adjusted price with gap indicator
- Best strategy and confidence
- Supply risk warnings
- Due diligence progress bar
- Notes count indicator
- "View Full Details" button to navigate to deal page

### 3. MapControls.tsx
Floating control panel for map interactions.

**Controls:**
- Zoom in/out
- Toggle filters panel
- Toggle heatmap
- Draw radius tool
- All with hover tooltips

### 4. MapFiltersPanel.tsx
Advanced filtering panel with multi-criteria filtering.

**Filters:**
- Pipeline stage (multi-select checkboxes)
- Price range (min/max sliders)
- Min AI opportunity score (slider)
- Strategy (multi-select)
- Source (multi-select)
- Supply risk flag (checkbox)
- Shows deal counts per filter option
- Real-time filtered count display
- Clear all button

## Usage

### Basic Implementation
```tsx
import PipelineMapView from '@/components/pipeline/PipelineMapView';

<PipelineMapView
  deals={pipelineDeals}
  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
  loading={isLoading}
/>
```

### In PipelineGridPage
Toggle between Grid and Map views:
```tsx
<button onClick={() => setViewMode('map')}>
  Map View
</button>
```

URL sync: `?view=map` automatically loads map view

## Geocoding

### Current Implementation (Demo)
Uses mock geocoding with deterministic random coordinates around Atlanta for demonstration.

### Production Implementation
Deals should include `lat` and `lng` fields. Options:

#### Option 1: Server-Side Geocoding (Recommended)
Add geocoding to deal creation/update pipeline:

```typescript
// backend/src/services/geocoding.ts
import { geocodeAddress } from '@mapbox/mapbox-sdk/services/geocoding';

export async function geocodeDeal(deal: Deal): Promise<{ lat: number; lng: number } | null> {
  const geocodingClient = geocodeAddress({
    accessToken: process.env.MAPBOX_TOKEN!
  });
  
  const response = await geocodingClient.forwardGeocode({
    query: deal.address,
    limit: 1
  }).send();
  
  if (response.body.features.length > 0) {
    const [lng, lat] = response.body.features[0].center;
    return { lat, lng };
  }
  
  return null;
}

// Update deal creation
const coords = await geocodeDeal(deal);
await db.pipelineDeals.update({
  where: { id: deal.id },
  data: { 
    lat: coords?.lat, 
    lng: coords?.lng,
    geocodedAt: new Date()
  }
});
```

#### Option 2: Client-Side Geocoding
Geocode on map load (slower, uses API quota):

```typescript
import MapboxGeocoder from '@mapbox/mapbox-sdk/services/geocoding';

const geocoder = MapboxGeocoder({ accessToken: MAPBOX_TOKEN });

const geocodeDeals = async (deals: PipelineDeal[]) => {
  return await Promise.all(
    deals.map(async (deal) => {
      if (deal.lat && deal.lng) return deal;
      
      const response = await geocoder.forwardGeocode({
        query: deal.address,
        limit: 1
      }).send();
      
      const coords = response.body.features[0]?.center;
      return {
        ...deal,
        lng: coords?.[0],
        lat: coords?.[1]
      };
    })
  );
};
```

#### Option 3: Batch Geocoding Job
Run nightly job to geocode all un-geocoded deals:

```bash
# CLI command
npm run geocode:pipeline-deals
```

### Update Types
Add coordinates to PipelineDeal:

```typescript
// types/grid.ts
export interface PipelineDeal {
  // ... existing fields
  lat?: number;
  lng?: number;
  geocodedAt?: string;
}
```

## Dependencies

Required packages (already installed):
- `react-map-gl` - Mapbox wrapper for React
- `mapbox-gl` - Mapbox GL JS
- `supercluster` - Fast point clustering
- `@heroicons/react` - Icons
- `@turf/turf` - Geospatial utilities (for radius calculations)

## Environment Variables

Required:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Get a free token at: https://account.mapbox.com/access-tokens/

## Features in Detail

### Clustering
- Automatically groups nearby deals when zoomed out
- Cluster size reflects deal count
- Cluster color reflects average AI score
- Click cluster to zoom in and expand
- Hover shows aggregate metrics (count, total value, avg score)

### Heatmap
- Toggle with fire icon button
- Density visualization weighted by AI opportunity score
- Useful for identifying market hotspots
- Color gradient from blue (low) to red (high)

### Radius Tool
- Click radius button to activate
- Click map to set center point
- Shows circular overlay
- Filters deals within specified radius
- Useful for market analysis and supply/demand studies

### Filters
- Multi-criteria filtering
- Persist across view mode switches
- Real-time count updates
- Clear all button
- Collapsible panel

### Saved Map Positions
- Map position (zoom, lat, lng) saved to localStorage
- Persists between sessions
- Key: `pipeline-map-position`

### URL Sync
- View mode synced to URL: `?view=map`
- Shareable links
- Browser back/forward support

## Performance

**Optimization Features:**
- Clustering reduces marker count from 1000s to 100s
- Memoized computations for filtering and clustering
- Lazy loading of popup components
- Debounced viewport updates
- Efficient re-renders with React.memo

**Tested With:**
- ✅ 100 deals: Instant
- ✅ 500 deals: Smooth
- ✅ 1000 deals: Performant with clustering
- ✅ 5000+ deals: Use heatmap mode for best UX

## Customization

### Add Custom Marker Badge
```typescript
// In PipelineMapView.tsx, marker section:
{deal.custom_flag && (
  <div className="absolute -top-1 -left-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
    🔥
  </div>
)}
```

### Change Stage Colors
```typescript
// In PipelineMapView.tsx
const STAGE_COLORS: Record<string, string> = {
  sourcing: '#YOUR_COLOR',
  underwriting: '#YOUR_COLOR',
  // ...
};
```

### Add New Filter
```typescript
// In MapFiltersPanel.tsx
<div>
  <label className="block text-sm font-semibold text-gray-900 mb-2">
    Your Filter
  </label>
  <select
    value={filters.yourFilter}
    onChange={(e) => onFiltersChange({
      ...filters,
      yourFilter: e.target.value
    })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  >
    <option value="">All</option>
    {/* options */}
  </select>
</div>
```

## Troubleshooting

### Map Not Loading
1. Check `VITE_MAPBOX_TOKEN` is set in `.env`
2. Verify token is valid at https://account.mapbox.com/
3. Check browser console for errors

### Markers Not Appearing
1. Verify deals have valid addresses
2. Check geocoding is working (see console logs)
3. Ensure deals array is not empty

### Clustering Not Working
1. Check zoom level (clustering only works when zoomed out)
2. Verify Supercluster is properly initialized
3. Check browser console for errors

### Poor Performance
1. Enable clustering (should be default)
2. Reduce deal count with filters
3. Use heatmap mode for large datasets
4. Check browser DevTools Performance tab

## Future Enhancements

**Planned:**
- [ ] Drawing tools (polygons, lines)
- [ ] Save custom map views
- [ ] Export visible deals to CSV
- [ ] Comparison mode (side-by-side maps)
- [ ] Timeline slider (animate deal flow over time)
- [ ] Weather overlay
- [ ] Demographics overlay
- [ ] School ratings overlay
- [ ] Transit/commute times overlay
- [ ] Market boundaries (neighborhoods, zip codes)

**Advanced:**
- [ ] 3D building visualization
- [ ] Satellite imagery toggle
- [ ] Street view integration
- [ ] Custom basemap styles
- [ ] Real-time deal updates via WebSocket
- [ ] Collaborative cursors (multi-user)
- [ ] Deal clustering by strategy/investor
- [ ] Risk heatmaps

## Credits

Built with:
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [react-map-gl](https://visgl.github.io/react-map-gl/)
- [Supercluster](https://github.com/mapbox/supercluster)
- [Heroicons](https://heroicons.com/)

## License

Proprietary - JEDI Real Estate
