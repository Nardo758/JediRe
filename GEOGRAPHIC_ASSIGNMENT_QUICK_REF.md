# Geographic Assignment Engine - Quick Reference

## 3-Tier Event Assignment

```
Tier 1: PIN-DROP    → Exact address      → Trade Area match (ST_Contains)
Tier 2: AREA        → "Midtown", etc.    → Submarket match → proportional
Tier 3: METRO       → "Atlanta Metro"    → MSA cascade with heavy decay
```

## 4-Factor Decay Formula

```
Decay Score = (Proximity × 30%) + (Sector × 30%) + (Absorption × 25%) + (Temporal × 15%)
Impact Score = Event Magnitude × Decay Score
```

## API Endpoints

### Core Geographic Queries
```bash
# List trade areas
GET /api/v1/geography/trade-areas?msa_id=1&limit=50

# List submarkets
GET /api/v1/geography/submarkets?msa_id=1

# List MSAs
GET /api/v1/geography/msas

# Lookup all levels for a point
GET /api/v1/geography/lookup?lat=33.79&lng=-84.38
```

### Geocoding
```bash
# Address → Coordinates
POST /api/v1/geography/geocode
{"address": "100 Peachtree St NE, Atlanta, GA 30303"}

# Coordinates → Address
POST /api/v1/geography/reverse-geocode
{"lat": 33.79, "lng": -84.38}
```

### Event Assignment
```bash
# Assign event to geographic hierarchy
POST /api/v1/geography/assign-event
{
  "location": {
    "locationRaw": "Midtown Atlanta",
    "lat": 33.79,
    "lng": -84.38
  },
  "magnitude": {
    "category": "development",
    "type": "multifamily_permit_approval",
    "magnitude": 85,
    "sector": "multifamily",
    "unit_count": 350
  },
  "published_at": "2026-02-10T12:00:00Z",
  "event_id": "uuid"
}
```

### Trade Area Events
```bash
# Get events affecting trade area (sorted by impact)
GET /api/v1/geography/trade-area/:id/events?min_impact_score=50
```

## Database Queries

### Find Geographic Context for Point
```sql
-- Find submarket
SELECT * FROM find_submarket_for_point(33.79, -84.38);

-- Find MSA
SELECT * FROM find_msa_for_point(33.79, -84.38);

-- Find trade areas containing point
SELECT * FROM find_trade_areas_for_point(33.79, -84.38);
```

### Get High-Impact Events for Trade Area
```sql
SELECT 
  ne.*,
  tai.impact_score,
  tai.decay_score,
  tai.proximity_score,
  tai.sector_score,
  tai.absorption_score,
  tai.temporal_score
FROM news_events ne
JOIN trade_area_event_impacts tai ON tai.event_id = ne.id
WHERE tai.trade_area_id = $1
  AND tai.impact_score >= 50
ORDER BY tai.impact_score DESC;
```

### Create Trade Area (3-mile radius)
```sql
INSERT INTO trade_areas (
  name, user_id, geometry, definition_method, method_params, confidence_score
) VALUES (
  'Midtown 3-Mile',
  1,
  ST_Buffer(
    ST_SetSRID(ST_MakePoint(-84.38, 33.79), 4326)::geography,
    4828.03  -- 3 miles in meters
  )::geometry,
  'radius',
  '{"radius_miles": 3, "center": {"lat": 33.79, "lng": -84.38}}'::jsonb,
  0.85
);
```

## TypeScript Usage

### Geocoding
```typescript
import { geocodingService } from './services/geocoding.service';

// Single geocode
const result = await geocodingService.geocode(
  '100 Peachtree St NE, Atlanta, GA 30303'
);
// { lat: 33.749, lng: -84.388, displayName: '...', city: 'Atlanta', ... }

// Batch geocode
const results = await geocodingService.batchGeocode([
  '123 Main St, Atlanta',
  '456 Oak Ave, Sandy Springs'
]);

// Reverse geocode
const address = await geocodingService.reverseGeocode(33.79, -84.38);
```

### Event Assignment
```typescript
import { geographicAssignmentService } from './services/geographic-assignment.service';

const assignment = await geographicAssignmentService.assignEvent(
  {
    address: '1234 Peachtree St NE',
    locationRaw: 'Midtown Atlanta',
    locationSpecificity: 'address'
  },
  {
    category: 'development',
    type: 'multifamily_permit_approval',
    magnitude: 85,
    sector: 'multifamily',
    unit_count: 350
  },
  new Date()
);

// Save assignment
await geographicAssignmentService.saveEventAssignment(eventId, assignment);
```

## Seed Data: Atlanta Metro

### MSA
- **Atlanta-Sandy Springs-Roswell, GA** (CBSA: 12060)
- 6.1M population, $71,936 median income

### Submarkets (10)
1. Midtown Atlanta - $2,150 avg rent, 92.3% occ
2. Buckhead - $2,380 avg rent, 93.8% occ
3. Virginia Highland - $1,950 avg rent, 94.5% occ
4. Sandy Springs - $1,820 avg rent, 91.2% occ
5. Decatur - $1,780 avg rent, 92.8% occ
6. Perimeter Center - $1,950 avg rent, 90.5% occ
7. Cumberland/Galleria - $1,680 avg rent, 88.9% occ
8. North Druid Hills - $1,620 avg rent, 91.4% occ
9. West Midtown - $2,280 avg rent, 93.2% occ
10. Vinings/Smyrna - $1,720 avg rent, 89.8% occ

## Environment Variables

```env
# Required for Mapbox geocoding (fallback to OSM Nominatim if missing)
MAPBOX_TOKEN=pk.ey...

# Database with PostGIS
DATABASE_URL=postgresql://user:pass@host:5432/jedire
```

## Migration Commands

```bash
# Apply schema
psql $DATABASE_URL -f backend/src/database/migrations/021_geographic_hierarchy.sql

# Apply seed data
psql $DATABASE_URL -f backend/src/database/migrations/022_seed_atlanta_geography.sql

# Run test suite
./test-geographic-assignment.sh
```

## Impact Decay Cheat Sheet

| Factor | Weight | Description | Example Scores |
|--------|--------|-------------|----------------|
| **Proximity** | 30% | Distance from event | Inside TA: 100<br>0-1mi: 90<br>1-3mi: 70-50<br>3-5mi: 50-30<br>>10mi: <10 |
| **Sector** | 30% | Asset class alignment | Same sector: 100<br>Employment: 80<br>Transactions: 70<br>Amenities: 60 |
| **Absorption** | 25% | Market capacity | >10% supply: 90<br>5-10%: 70<br>2-5%: 50<br><2%: 30 |
| **Temporal** | 15% | Time decay | 0-7d: 100<br>7-30d: 90<br>30-90d: 70<br>90-180d: 50<br>>1yr: 10 |

## Next Phase: Week 2 Deliverables

1. **Demand Signal Implementation** - Employment → Housing demand conversion
2. **Supply Pressure Calculator** - Pipeline tracking vs absorption
3. **Market Momentum Dashboard** - Real-time health indicators
4. **Alert System** - High-impact event notifications
