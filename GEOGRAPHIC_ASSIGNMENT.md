# Geographic Assignment Engine - Usage Guide

**Version:** 1.0  
**Date:** February 10, 2026  
**Status:** Phase 1, Week 1 Complete

## Overview

The Geographic Assignment Engine automatically assigns news events to the appropriate geographic resolution in a 3-tier hierarchy:

```
MSA (Metro) → Submarket (Neighborhood) → Trade Area (Property-Level)
```

This enables precise impact analysis: events affecting a specific property's trade area have different weight than metro-wide news.

## Architecture

### 3-Tier Event Assignment

#### **Tier 1: Pin-Drop Events** (Exact Address)
- **Input:** Specific street address (e.g., "1234 Peachtree St NE, Atlanta, GA")
- **Method:** Polygon containment (PostGIS `ST_Contains`)
- **Assignment:** 
  - Geocode address → lat/lng
  - Find all trade areas containing point
  - Find submarket via containment
  - Find MSA via containment

#### **Tier 2: Area Events** (Named Neighborhood)
- **Input:** Named area (e.g., "Midtown", "Buckhead")
- **Method:** Submarket name matching + proportional distribution
- **Assignment:**
  - Match event location to submarket name
  - Distribute impact to all overlapping trade areas
  - Apply proximity decay

#### **Tier 3: Metro Events** (MSA-Level)
- **Input:** City/metro name (e.g., "Atlanta", "Atlanta Metro")
- **Method:** MSA-level cascade with heavy decay
- **Assignment:**
  - Match to MSA
  - Cascade to all trade areas in MSA
  - Apply distance-based decay (only significant events matter)

### Impact Decay Calculation

Every event → trade area relationship gets an **impact score** calculated as:

```
Impact Score = Event Magnitude × Decay Score
```

**Decay Score** is a weighted composite of 4 factors:

1. **Proximity Score** (30% weight)
   - Inside trade area = 100
   - 0-1 miles = 90
   - 1-3 miles = 70-50
   - 3-5 miles = 50-30
   - 5-10 miles = 30-10
   - >10 miles = <10

2. **Sector Score** (30% weight)
   - Same sector (multifamily-to-multifamily) = 100
   - Related sector (employment → multifamily) = 80
   - Transaction comps = 70
   - Amenities = 60
   - Unrelated = 40

3. **Absorption Score** (25% weight)
   - Based on supply pressure relative to existing inventory
   - Adjusted for market occupancy (tight market = higher impact)
   - Example: 1,000 new units in market with 10,000 units = 10% pressure = high impact

4. **Temporal Score** (15% weight)
   - 0-7 days = 100
   - 7-30 days = 90
   - 30-90 days = 70
   - 90-180 days = 50
   - 180-365 days = 30
   - >1 year = 10

### Database Schema

#### Core Tables

**`msas`** - Metropolitan Statistical Areas
- Geometry: `MULTIPOLYGON` (Census boundaries)
- Demographics: population, median income
- Market stats: total properties, avg rent, occupancy

**`submarkets`** - Neighborhood/District Groupings
- Geometry: `MULTIPOLYGON` (can be non-contiguous)
- Source: CoStar, manual, census
- Market stats: properties count, avg rent, cap rate

**`trade_areas`** - Property-Level Competitive Boundaries
- Geometry: `POLYGON` (1-5 mile radius or custom)
- Definition method: radius, drive_time, isochrone, custom_draw
- Stats snapshot: cached market data

**`geographic_relationships`** - Links Trade Areas → Submarkets → MSAs
- Tracks overlap percentages
- Enables hierarchy navigation

#### Event Integration Tables

**`news_events`** - Extended with geographic fields
- `msa_id`, `submarket_id`, `trade_area_id` (foreign keys)
- `geographic_tier` - enum: 'pin_drop', 'area', 'metro'

**`trade_area_event_impacts`** - Many-to-Many Impact Scores
- Stores all 4 decay factor scores
- Composite decay score
- Final impact score

## API Reference

### Base URL
```
/api/v1/geography
```

### Endpoints

#### **Trade Areas**

**GET /geography/trade-areas**
List user's trade areas
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/v1/geography/trade-areas?msa_id=1&limit=50"
```

**GET /geography/trade-areas/:id**
Get single trade area with hierarchy context

**GET /geography/trade-area/:id/events**
Get events affecting trade area (sorted by impact score)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event_category": "development",
      "event_type": "multifamily_permit_approval",
      "location_raw": "123 Peachtree St",
      "impact_score": 75.24,
      "decay_score": 82.5,
      "distance_miles": 0.8,
      "proximity_score": 85,
      "sector_score": 100,
      "absorption_score": 72,
      "temporal_score": 100
    }
  ]
}
```

#### **Submarkets**

**GET /geography/submarkets**
List submarkets (optionally filter by MSA)

**GET /geography/submarkets/:id**
Get submarket details with trade area count

#### **MSAs**

**GET /geography/msas**
List all MSAs with stats

**GET /geography/msas/:id**
Get MSA details

#### **Geocoding**

**POST /geography/geocode**
Convert address to coordinates
```json
{
  "address": "100 Peachtree St NE, Atlanta, GA 30303"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "lat": 33.7490,
    "lng": -84.3880,
    "displayName": "100 Peachtree Street Northeast, Atlanta, GA 30303",
    "city": "Atlanta",
    "state": "Georgia",
    "zipCode": "30303",
    "confidence": 0.95,
    "placeType": "address"
  }
}
```

**POST /geography/reverse-geocode**
Convert coordinates to address
```json
{
  "lat": 33.7490,
  "lng": -84.3880
}
```

#### **Event Assignment**

**POST /geography/assign-event**
Assign news event to geographic hierarchy
```json
{
  "location": {
    "address": "1234 Peachtree St NE, Atlanta, GA",
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
  "event_id": "uuid-of-news-event"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "tier": "pin_drop",
    "msa_id": 1,
    "msa_name": "Atlanta-Sandy Springs-Roswell, GA",
    "submarket_id": 2,
    "submarket_name": "Midtown Atlanta",
    "trade_area_ids": [1, 3, 7],
    "trade_area_impacts": [
      {
        "trade_area_id": 1,
        "trade_area_name": "Midtown 3-Mile Radius",
        "impact_type": "direct",
        "distance_miles": 0.0,
        "decay_score": 88.25,
        "impact_score": 75.01,
        "decay_factors": {
          "proximity_score": 100,
          "sector_score": 100,
          "absorption_score": 72,
          "temporal_score": 100
        }
      }
    ]
  }
}
```

**GET /geography/lookup**
Lookup all geographic levels for a point
```bash
curl "http://localhost:4000/api/v1/geography/lookup?lat=33.79&lng=-84.38"
```

## Usage Examples

### Example 1: Creating a Trade Area

Trade areas are typically created via the UI (Map → Draw Tool), but can also be created programmatically:

```typescript
import { query } from '../database/connection';

// Create a 3-mile radius trade area
const result = await query(
  `INSERT INTO trade_areas (
    name, user_id, geometry, definition_method, method_params, confidence_score
  ) VALUES (
    $1, $2, 
    ST_Buffer(
      ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
      $5
    )::geometry,
    'radius',
    $6,
    0.85
  ) RETURNING id`,
  [
    'Buckhead 3-Mile',
    userId,
    -84.38, // lng
    33.86,  // lat
    4828.03, // 3 miles in meters
    JSON.stringify({ radius_miles: 3, center: { lat: 33.86, lng: -84.38 } })
  ]
);
```

### Example 2: Assigning Events on News Ingestion

```typescript
import { geographicAssignmentService } from '../services/geographic-assignment.service';

// When a news event is created/extracted
const assignment = await geographicAssignmentService.assignEvent(
  {
    address: extractedAddress,
    locationRaw: rawLocationText,
    locationSpecificity: 'address'
  },
  {
    category: 'development',
    type: 'multifamily_permit_approval',
    magnitude: 85,
    sector: 'multifamily',
    unit_count: 350
  },
  publishedAt
);

// Save assignment
await geographicAssignmentService.saveEventAssignment(eventId, assignment);
```

### Example 3: Querying High-Impact Events for a Deal

```typescript
// Get deal's primary trade area
const dealTradeArea = await query(
  `SELECT ta.id 
   FROM trade_areas ta
   JOIN properties p ON p.id = ta.property_id
   WHERE p.deal_id = $1`,
  [dealId]
);

// Get high-impact events (score > 50)
const events = await query(
  `SELECT ne.*, tai.impact_score, tai.decay_score
   FROM news_events ne
   JOIN trade_area_event_impacts tai ON tai.event_id = ne.id
   WHERE tai.trade_area_id = $1 
     AND tai.impact_score >= 50
   ORDER BY tai.impact_score DESC, ne.published_at DESC
   LIMIT 20`,
  [dealTradeArea.rows[0].id]
);
```

### Example 4: Metro-Level Market Dashboard

```typescript
// Get all events in Atlanta MSA (past 12 months)
const atlantaEvents = await query(
  `SELECT 
    ne.event_category,
    ne.event_type,
    COUNT(*) as event_count,
    AVG(tai.impact_score) as avg_impact
   FROM news_events ne
   LEFT JOIN trade_area_event_impacts tai ON tai.event_id = ne.id
   WHERE ne.msa_id = $1
     AND ne.published_at > NOW() - INTERVAL '12 months'
   GROUP BY ne.event_category, ne.event_type
   ORDER BY avg_impact DESC`,
  [atlantaMsaId]
);
```

## Seed Data: Atlanta Metro

The system ships with pre-populated Atlanta metro data:

### MSA
- **Atlanta-Sandy Springs-Roswell, GA** (CBSA: 12060)
- Population: 6,144,050
- Median household income: $71,936

### Submarkets (10)
1. **Midtown Atlanta** - 142 properties, 38,500 units, 92.3% occupancy, $2,150 avg rent
2. **Buckhead** - 238 properties, 52,800 units, 93.8% occupancy, $2,380 avg rent
3. **Virginia Highland** - 87 properties, 18,200 units, 94.5% occupancy, $1,950 avg rent
4. **Sandy Springs** - 156 properties, 42,100 units, 91.2% occupancy, $1,820 avg rent
5. **Decatur** - 98 properties, 22,400 units, 92.8% occupancy, $1,780 avg rent
6. **Perimeter Center** - 185 properties, 48,900 units, 90.5% occupancy, $1,950 avg rent
7. **Cumberland/Galleria** - 172 properties, 46,200 units, 88.9% occupancy, $1,680 avg rent
8. **North Druid Hills** - 64 properties, 15,800 units, 91.4% occupancy, $1,620 avg rent
9. **West Midtown** - 76 properties, 19,200 units, 93.2% occupancy, $2,280 avg rent
10. **Vinings/Smyrna** - 143 properties, 38,700 units, 89.8% occupancy, $1,720 avg rent

### Sample Trade Areas (3)
- **Midtown 3-Mile Radius** - centered at 33.79, -84.38
- **Buckhead 2-Mile Radius** - centered at 33.86, -84.38
- **Virginia Highland 1.5-Mile Radius** - centered at 33.795, -84.35

## Testing

### Run Migrations

```bash
# Apply schema migration
psql $DATABASE_URL -f backend/src/database/migrations/021_geographic_hierarchy.sql

# Apply seed data
psql $DATABASE_URL -f backend/src/database/migrations/022_seed_atlanta_geography.sql
```

### Test Geocoding

```bash
curl -X POST http://localhost:4000/api/v1/geography/geocode \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"address": "100 Peachtree St NE, Atlanta, GA 30303"}'
```

### Test Geographic Lookup

```bash
curl "http://localhost:4000/api/v1/geography/lookup?lat=33.79&lng=-84.38" \
  -H "Authorization: Bearer <token>"
```

### Test Event Assignment

```bash
curl -X POST http://localhost:4000/api/v1/geography/assign-event \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
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
    }
  }'
```

## Configuration

### Environment Variables

```env
# Mapbox Token (for geocoding)
MAPBOX_TOKEN=pk.ey...

# Database (PostGIS required)
DATABASE_URL=postgresql://user:pass@host:5432/jedire
```

### Fallback Behavior

If `MAPBOX_TOKEN` is not set, the system automatically falls back to **OpenStreetMap Nominatim** (rate-limited to 1 request/second).

## Performance Considerations

### Spatial Indexes

All geometry columns have **GIST indexes** for fast containment queries:

```sql
CREATE INDEX idx_trade_areas_geometry ON trade_areas USING GIST(geometry);
CREATE INDEX idx_submarkets_geometry ON submarkets USING GIST(geometry);
CREATE INDEX idx_msas_geometry ON msas USING GIST(geometry);
```

### Query Optimization

- Use `ST_Contains` for point-in-polygon checks (indexed)
- Pre-compute centroids on insert/update (via triggers)
- Cache market stats in `stats_snapshot` JSONB column
- Batch geocoding requests to avoid rate limits

### Scaling Recommendations

- **< 1,000 trade areas:** Current implementation sufficient
- **1,000 - 10,000 trade areas:** Consider read replicas
- **> 10,000 trade areas:** Implement spatial partitioning by MSA

## Next Steps (Phase 1, Week 2)

1. **Demand Signal Implementation** - Connect employment events to housing demand
2. **Supply Pressure Calculator** - Track pipeline units vs absorption
3. **Market Momentum Dashboard** - Real-time metro health indicators
4. **Alert System** - Notify users of high-impact events in their trade areas

## Support

For questions or issues:
- Check API logs: `backend/logs/app.log`
- Database queries: Enable query logging in PostgreSQL
- Geocoding issues: Verify `MAPBOX_TOKEN` or check Nominatim rate limits

## License

Proprietary - JEDI RE Platform © 2026
