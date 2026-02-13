# Pipeline Map View - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Add Mapbox Token
```bash
# Frontend .env file
echo "VITE_MAPBOX_TOKEN=pk.YOUR_TOKEN_HERE" >> .env
```

Get free token: https://account.mapbox.com/access-tokens/

### 2. Start Dev Server
```bash
cd jedire/frontend
npm run dev
```

### 3. Navigate to Map
```
http://localhost:5173/pipeline?view=map
```

### 4. Test with Demo Data
```typescript
// In PipelineGridPage.tsx or any component
import { generateDemoDeals } from '@/components/pipeline/demo-data';

// Generate 50 demo deals
const demoDeals = generateDemoDeals(50);
setDeals(demoDeals);
```

## 🎨 Example Usage

### Basic Map
```tsx
import PipelineMapView from '@/components/pipeline/PipelineMapView';

<PipelineMapView
  deals={deals}
  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
  loading={isLoading}
/>
```

### With Custom Height
```tsx
<div className="h-screen">
  <PipelineMapView deals={deals} />
</div>
```

### With Error Handling
```tsx
{error ? (
  <div className="error-message">{error}</div>
) : (
  <PipelineMapView deals={deals} loading={loading} />
)}
```

## 🧪 Testing Scenarios

### Test Clustering
```typescript
import { generateTestScenarios } from '@/components/pipeline/demo-data';

const { allClustered } = generateTestScenarios();
// All deals clustered in one area - test clustering UI
```

### Test Filtering
```typescript
const { highValueOnly, withSupplyRisk } = generateTestScenarios();
// Test filter functionality with specific deal types
```

### Test Large Dataset
```typescript
import { generateDemoDeals } from '@/components/pipeline/demo-data';

const manyDeals = generateDemoDeals(500);
// Test performance with large dataset
```

## 📝 Common Tasks

### Add New Filter
```typescript
// 1. Update MapFilters interface in PipelineMapView.tsx
export interface MapFilters {
  // ... existing filters
  yourNewFilter?: string;
}

// 2. Add filter logic in filteredDeals useMemo
const filteredDeals = useMemo(() => {
  return deals.filter(deal => {
    // Your filter logic
    if (filters.yourNewFilter && deal.yourField !== filters.yourNewFilter) {
      return false;
    }
    return true;
  });
}, [deals, filters]);

// 3. Add UI in MapFiltersPanel.tsx
<div>
  <label>Your Filter</label>
  <select
    value={filters.yourNewFilter}
    onChange={(e) => onFiltersChange({
      ...filters,
      yourNewFilter: e.target.value
    })}
  >
    {/* options */}
  </select>
</div>
```

### Change Marker Style
```typescript
// PipelineMapView.tsx - marker section
<div
  className="w-8 h-8 rounded-full..."  // Change size
  style={{ backgroundColor: 'YOUR_COLOR' }}  // Change color
>
  {/* content */}
</div>
```

### Add Custom Badge
```typescript
// In marker render section
{deal.yourFlag && (
  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
    🔥
  </div>
)}
```

## 🐛 Troubleshooting

### Map Not Loading
**Problem:** Blank screen or "Map not available" message

**Solutions:**
1. Check `VITE_MAPBOX_TOKEN` in `.env`
2. Verify token at https://account.mapbox.com/
3. Restart dev server (`npm run dev`)
4. Check browser console for errors

### Markers Not Showing
**Problem:** Map loads but no markers appear

**Solutions:**
1. Check deals array is not empty: `console.log(deals.length)`
2. Verify deals have coordinates: `console.log(deals[0].lat, deals[0].lng)`
3. Check zoom level (zoom out to see more)
4. Verify geocoding is working

### Clustering Not Working
**Problem:** All markers visible individually at low zoom

**Solutions:**
1. Increase deal count (clustering needs >10 deals nearby)
2. Use test data: `generateTestScenarios().allClustered`
3. Check Supercluster initialization
4. Verify radius settings (default 75)

### Filters Not Working
**Problem:** Filtering doesn't change visible deals

**Solutions:**
1. Check filter state: `console.log(filters)`
2. Verify filter logic in `filteredDeals` useMemo
3. Check deal properties match filter fields
4. Clear all filters and try again

### Poor Performance
**Problem:** Slow rendering or laggy interactions

**Solutions:**
1. Enable clustering (should be default)
2. Reduce deal count with filters
3. Use heatmap mode for 500+ deals
4. Check React DevTools Profiler
5. Memoize expensive computations

## 🎯 Pro Tips

### 1. Use URL State
```typescript
// PipelineGridPage.tsx
const [searchParams] = useSearchParams();
const initialView = searchParams.get('view') || 'grid';

// Share links: /pipeline?view=map
```

### 2. Persist Filters
```typescript
// Save filters to localStorage
useEffect(() => {
  localStorage.setItem('pipeline-filters', JSON.stringify(filters));
}, [filters]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('pipeline-filters');
  if (saved) setFilters(JSON.parse(saved));
}, []);
```

### 3. Preload Demo Data
```typescript
// For demos/presentations
import { generateDemoDeals } from '@/components/pipeline/demo-data';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const deals = DEMO_MODE 
  ? generateDemoDeals(100)
  : await fetchRealDeals();
```

### 4. Mobile Detection
```typescript
const isMobile = window.innerWidth < 768;

<PipelineMapView 
  deals={deals}
  // Adjust for mobile
  defaultZoom={isMobile ? 8 : 10}
/>
```

### 5. Keyboard Shortcuts
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'm') setViewMode('map');
    if (e.key === 'g') setViewMode('grid');
    if (e.key === 'f') setShowFilters(!showFilters);
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

## 📦 Component Props Reference

### PipelineMapView
```typescript
interface PipelineMapViewProps {
  deals: PipelineDeal[];           // Array of pipeline deals
  onDealClick?: (deal: PipelineDeal) => void;  // Optional click handler
  loading?: boolean;                // Show loading state
}
```

### DealMapPopup
```typescript
interface DealMapPopupProps {
  deal: PipelineDeal;              // Deal to display
  onClose: () => void;             // Close handler
}
```

### MapControls
```typescript
interface MapControlsProps {
  onZoomIn: () => void;            // Zoom in handler
  onZoomOut: () => void;           // Zoom out handler
  onToggleHeatmap: () => void;     // Heatmap toggle
  onToggleFilters: () => void;     // Filters toggle
  onDrawRadius: () => void;        // Radius tool toggle
  showHeatmap: boolean;            // Heatmap state
  showFilters: boolean;            // Filters state
  drawMode: 'radius' | null;       // Draw mode state
}
```

### MapFiltersPanel
```typescript
interface MapFiltersPanelProps {
  filters: MapFilters;             // Current filters
  onFiltersChange: (filters: MapFilters) => void;  // Update handler
  deals: PipelineDeal[];           // All deals (for counts)
  filteredCount: number;           // Filtered deal count
  onClose: () => void;             // Close handler
}
```

## 🔗 Quick Links

- [Full Documentation](./README.md)
- [Database Setup](../../../backend/migrations/PIPELINE_MAP_SETUP.md)
- [Implementation Summary](../../../PIPELINE_MAP_IMPLEMENTATION.md)
- [Demo Data Generator](./demo-data.ts)

## 🆘 Need Help?

1. Check the [main README](./README.md)
2. Review [troubleshooting](#-troubleshooting) above
3. Check browser console for errors
4. Verify environment variables
5. Contact engineering team

---

**Happy Mapping! 🗺️**
