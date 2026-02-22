# Competition Analysis Module - Quick Integration Guide

This guide will help you integrate the Competition Analysis module into your JEDI RE application in under 30 minutes.

---

## Step 1: Add Route to Application (5 min)

### Frontend Router Configuration

Find your main routing file (usually `App.tsx` or `routes.tsx`) and add:

```typescript
import CompetitionPage from '@/pages/development/CompetitionPage';

// Inside your Routes/Switch
<Route 
  path="/deals/:dealId/competition" 
  element={<CompetitionPage />} 
/>
```

### Add Navigation Link

In your deal detail page or navigation menu:

```typescript
import { Building2 } from 'lucide-react';

// Add to tab navigation or sidebar
<Link 
  to={`/deals/${dealId}/competition`}
  className="nav-link"
>
  <Building2 className="h-4 w-4" />
  Competition Analysis
</Link>
```

---

## Step 2: Verify API Routes (2 min)

The backend routes are already registered. Verify by checking:

```bash
# Check if routes are loaded
grep -r "competition.routes" /home/leon/clawd/jedire/backend/src/api/rest/index.ts
```

Should show:
```typescript
import competitionRoutes from './competition.routes';
app.use(`${API_PREFIX}/deals`, competitionRoutes);
```

---

## Step 3: Test with Mock Data (5 min)

1. Start your backend:
```bash
cd /home/leon/clawd/jedire/backend
npm start
```

2. Start your frontend:
```bash
cd /home/leon/clawd/jedire/frontend
npm start
```

3. Navigate to: `http://localhost:3000/deals/YOUR_DEAL_ID/competition`

You should see the Competition Analysis page with mock data.

---

## Step 4: Connect Real Data (10 min)

### A. Ensure Database Setup

Run this SQL to prepare your database:

```sql
-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure property_records has spatial columns
ALTER TABLE property_records 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_property_records_location 
ON property_records USING GIST(
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Add property class if missing
ALTER TABLE property_records 
ADD COLUMN IF NOT EXISTS property_class VARCHAR(1) DEFAULT 'B';
```

### B. Update Competition Routes

In `/backend/src/api/rest/competition.routes.ts`, the queries are already set up to use real data from `property_records`. Just ensure your deals have:
- `latitude` and `longitude` set
- `units` count
- `year_built` value

### C. Test Real Data Query

```bash
curl http://localhost:3001/api/v1/deals/YOUR_DEAL_ID/competitors?distanceRadius=1.0 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Step 5: Customize for Your Needs (8 min)

### Add to Deal Detail Tabs

If you have a tabbed deal detail view:

```typescript
// In DealDetailPage.tsx or similar
import CompetitionPage from '@/pages/development/CompetitionPage';

const tabs = [
  { id: 'overview', label: 'Overview', component: OverviewTab },
  { id: 'financial', label: 'Financial', component: FinancialTab },
  { id: 'competition', label: 'Competition', component: CompetitionPage }, // ADD THIS
  // ... other tabs
];
```

### Customize Filters

In `CompetitionPage.tsx`, adjust default filters:

```typescript
const [filters, setFilters] = useState<CompetitionFilters>({
  sameVintage: false,
  similarSize: true,
  sameClass: true,
  distanceRadius: 1.5,  // Change default radius
});
```

### Customize Feature Matrix

In `/backend/src/api/rest/competition.routes.ts`, update the advantage matrix features:

```typescript
features: [
  { name: 'Your Feature 1', you: true, competitors: {...}, advantagePoints: 2 },
  { name: 'Your Feature 2', you: false, competitors: {...}, advantagePoints: -1 },
  // Add your specific amenities/features
]
```

---

## Optional Enhancements

### Add Map Visualization

Install a mapping library:

```bash
npm install react-leaflet leaflet @types/leaflet
```

Replace the map placeholder in `CompetitiveSetMap` component:

```typescript
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

<MapContainer 
  center={[deal.latitude, deal.longitude]} 
  zoom={13}
  className="h-[500px] rounded-lg"
>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {competitors.map(comp => (
    <Marker 
      key={comp.id} 
      position={[comp.latitude, comp.longitude]}
    >
      <Popup>{comp.name}</Popup>
    </Marker>
  ))}
</MapContainer>
```

### Add Charts

Install charting library:

```bash
npm install recharts
```

Add occupancy trend charts:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<LineChart width={500} height={300} data={occupancyData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="occupancy" stroke="#8884d8" />
</LineChart>
```

### Connect to AI Service

Update `/backend/src/api/rest/competition.routes.ts`:

```typescript
// In competition-insights endpoint
import { qwenService } from '../../services/qwen.service';

const insights = await qwenService.generateCompetitiveInsights({
  dealId,
  competitors,
  advantageMatrix,
});
```

---

## Troubleshooting

### Issue: "Deal location not set"
**Solution:** Ensure your deal has `latitude` and `longitude` values:
```sql
UPDATE deals SET latitude = 33.7710, longitude = -84.3880 WHERE id = 'YOUR_DEAL_ID';
```

### Issue: "No competitors found"
**Solution:** Check if property_records has data within radius:
```sql
SELECT COUNT(*) FROM property_records 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Issue: "PostGIS function not found"
**Solution:** Enable PostGIS extension:
```sql
CREATE EXTENSION postgis;
```

### Issue: Mock data still showing
**Solution:** The service has a try-catch that falls back to mock data. Check:
1. Backend is running
2. API URL is correct in `/frontend/src/services/api.ts`
3. Authentication token is valid

---

## Verification Checklist

- [ ] Route added to application router
- [ ] Navigation link to Competition page works
- [ ] Page loads without errors
- [ ] All 5 tabs display correctly
- [ ] Filters work (distance, vintage, size, class)
- [ ] Mock data displays in all sections
- [ ] API endpoints return 200 status
- [ ] Real data query works with test dealId
- [ ] PostGIS spatial queries return results
- [ ] Export button doesn't error (even if mock CSV)

---

## Next Steps After Integration

1. **Populate Real Data**
   - Import amenity data for properties
   - Connect to market intelligence for rent data
   - Integrate occupancy tracking

2. **Enhance Visualizations**
   - Add interactive map with property markers
   - Build occupancy trend charts
   - Create unit mix comparison graphs

3. **Connect AI Services**
   - Integrate Qwen for insights generation
   - Build automated recommendations
   - Implement predictive pricing

4. **Link to 3D Visualization**
   - Create hooks to update 3D building model
   - Build unit mix optimizer with visual feedback
   - Implement amenity space allocation tool

---

## Support

- **Design Spec:** `/jedire/DEV_ANALYSIS_MODULES_DESIGN.md` - Section 2
- **Module Docs:** `/jedire/COMPETITION_ANALYSIS_MODULE.md`
- **API Tests:** `/backend/src/api/rest/__tests__/competition.routes.test.ts`

---

**Estimated Integration Time:** 30 minutes  
**Difficulty:** Easy (all components pre-built)  
**Dependencies:** PostGIS (optional for real data)

The module is production-ready with mock data and can be enhanced incrementally with real data sources.
