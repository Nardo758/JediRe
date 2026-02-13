# Pipeline Map View - Database Setup

## Overview
Add geocoding support to pipeline deals for the map view feature.

## Database Migration

### SQL Migration (PostgreSQL/MySQL)
```sql
-- Add geocoding columns to pipeline_deals table
ALTER TABLE pipeline_deals 
ADD COLUMN lat DECIMAL(10, 8) NULL,
ADD COLUMN lng DECIMAL(11, 8) NULL,
ADD COLUMN geocoded_at TIMESTAMP NULL;

-- Add index for geospatial queries
CREATE INDEX idx_pipeline_deals_coords ON pipeline_deals(lat, lng);

-- Add index for geocoding status
CREATE INDEX idx_pipeline_deals_geocoded ON pipeline_deals(geocoded_at) 
WHERE geocoded_at IS NULL;
```

### Prisma Migration
```prisma
// schema.prisma
model PipelineDeal {
  id                    String   @id @default(uuid())
  // ... existing fields
  
  // Geocoding
  lat                   Float?   @db.Decimal(10, 8)
  lng                   Float?   @db.Decimal(11, 8)
  geocodedAt            DateTime? @map("geocoded_at")
  
  @@index([lat, lng])
  @@index([geocodedAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_geocoding_to_pipeline_deals
```

### MongoDB Migration
```javascript
// migrations/add-geocoding-pipeline-deals.js
db.pipeline_deals.updateMany(
  {},
  {
    $set: {
      lat: null,
      lng: null,
      geocoded_at: null
    }
  }
);

// Add geospatial index
db.pipeline_deals.createIndex({ 
  location: "2dsphere" 
});

// Or if using lat/lng separately
db.pipeline_deals.createIndex({ 
  lat: 1, 
  lng: 1 
});
```

## API Updates

### Backend Endpoint Updates

#### GET /api/v1/grid/pipeline
Add coordinates to response:

```typescript
// backend/src/api/rest/pipeline.ts
router.get('/grid/pipeline', async (req, res) => {
  const deals = await db.pipelineDeals.findMany({
    select: {
      id: true,
      property_name: true,
      address: true,
      // ... other fields
      lat: true,
      lng: true,
      geocoded_at: true,
    }
  });
  
  res.json({ deals });
});
```

#### POST /api/v1/deals (Create)
Geocode on creation:

```typescript
// backend/src/api/rest/deals.ts
import { geocodeAddress } from '../services/geocoding';

router.post('/deals', async (req, res) => {
  const dealData = req.body;
  
  // Geocode address
  let coords = null;
  if (dealData.address) {
    coords = await geocodeAddress(dealData.address);
  }
  
  const deal = await db.pipelineDeals.create({
    data: {
      ...dealData,
      lat: coords?.lat,
      lng: coords?.lng,
      geocoded_at: coords ? new Date() : null,
    }
  });
  
  res.json(deal);
});
```

#### PATCH /api/v1/deals/:id (Update)
Re-geocode if address changes:

```typescript
router.patch('/deals/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Re-geocode if address changed
  if (updates.address) {
    const coords = await geocodeAddress(updates.address);
    if (coords) {
      updates.lat = coords.lat;
      updates.lng = coords.lng;
      updates.geocoded_at = new Date();
    }
  }
  
  const deal = await db.pipelineDeals.update({
    where: { id },
    data: updates
  });
  
  res.json(deal);
});
```

## Geocoding Service

### Create Geocoding Service
```typescript
// backend/src/services/geocoding.ts
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

const geocodingClient = mbxGeocoding({
  accessToken: process.env.MAPBOX_TOKEN!
});

export interface Coordinates {
  lat: number;
  lng: number;
}

export async function geocodeAddress(
  address: string
): Promise<Coordinates | null> {
  try {
    const response = await geocodingClient
      .forwardGeocode({
        query: address,
        limit: 1,
        countries: ['us'], // Adjust as needed
      })
      .send();
    
    if (response.body.features.length > 0) {
      const [lng, lat] = response.body.features[0].center;
      console.log(`Geocoded: ${address} -> (${lat}, ${lng})`);
      return { lat, lng };
    }
    
    console.warn(`No geocoding results for: ${address}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function batchGeocode(
  addresses: Array<{ id: string; address: string }>
): Promise<Map<string, Coordinates>> {
  const results = new Map<string, Coordinates>();
  
  // Rate limiting: Mapbox allows 600 requests/minute
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (const { id, address } of addresses) {
    const coords = await geocodeAddress(address);
    if (coords) {
      results.set(id, coords);
    }
    
    // Rate limit: ~10 requests/second
    await delay(100);
  }
  
  return results;
}
```

### Install Dependencies
```bash
cd backend
npm install @mapbox/mapbox-sdk
```

## Batch Geocoding Script

### CLI Command for Existing Deals
```typescript
// backend/src/scripts/geocode-pipeline-deals.ts
import { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '../services/geocoding';

const prisma = new PrismaClient();

async function geocodePipelineDeals() {
  console.log('Starting pipeline deals geocoding...');
  
  // Find deals without coordinates
  const dealsToGeocode = await prisma.pipelineDeal.findMany({
    where: {
      OR: [
        { lat: null },
        { lng: null },
        { geocodedAt: null }
      ]
    },
    select: {
      id: true,
      address: true,
      property_name: true,
    }
  });
  
  console.log(`Found ${dealsToGeocode.length} deals to geocode`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const deal of dealsToGeocode) {
    console.log(`Geocoding: ${deal.property_name || deal.address}`);
    
    const coords = await geocodeAddress(deal.address);
    
    if (coords) {
      await prisma.pipelineDeal.update({
        where: { id: deal.id },
        data: {
          lat: coords.lat,
          lng: coords.lng,
          geocodedAt: new Date()
        }
      });
      successCount++;
    } else {
      failCount++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Geocoded ${successCount} deals`);
  console.log(`❌ Failed ${failCount} deals`);
  console.log('Done!');
  
  await prisma.$disconnect();
}

geocodePipelineDeals().catch(console.error);
```

### Run Script
```bash
cd backend
npx ts-node src/scripts/geocode-pipeline-deals.ts
```

### Add to package.json
```json
{
  "scripts": {
    "geocode:pipeline": "ts-node src/scripts/geocode-pipeline-deals.ts"
  }
}
```

## Cron Job (Optional)

### Nightly Geocoding Job
```typescript
// backend/src/jobs/geocoding-job.ts
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '../services/geocoding';

const prisma = new PrismaClient();

// Run every night at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running nightly geocoding job...');
  
  const dealsToGeocode = await prisma.pipelineDeal.findMany({
    where: {
      geocodedAt: null,
      address: { not: null }
    },
    take: 100, // Limit batch size
  });
  
  for (const deal of dealsToGeocode) {
    const coords = await geocodeAddress(deal.address);
    if (coords) {
      await prisma.pipelineDeal.update({
        where: { id: deal.id },
        data: {
          lat: coords.lat,
          lng: coords.lng,
          geocodedAt: new Date()
        }
      });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`Geocoded ${dealsToGeocode.length} deals`);
});
```

## Environment Variables

### Backend .env
```env
# Mapbox API
MAPBOX_TOKEN=your_mapbox_secret_token_here

# Geocoding config
GEOCODING_ENABLED=true
GEOCODING_RATE_LIMIT=10  # requests per second
```

### Frontend .env
```env
# Mapbox public token (for maps)
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here
```

## Testing

### Test Geocoding Service
```typescript
// backend/src/services/geocoding.test.ts
import { geocodeAddress } from './geocoding';

describe('Geocoding Service', () => {
  it('should geocode valid address', async () => {
    const coords = await geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');
    
    expect(coords).toBeDefined();
    expect(coords?.lat).toBeCloseTo(37.4220, 1);
    expect(coords?.lng).toBeCloseTo(-122.0841, 1);
  });
  
  it('should return null for invalid address', async () => {
    const coords = await geocodeAddress('invalid address xyz123');
    expect(coords).toBeNull();
  });
});
```

Run tests:
```bash
npm test -- geocoding.test.ts
```

## Monitoring

### Add Logging
```typescript
// backend/src/services/geocoding.ts
import logger from './logger';

export async function geocodeAddress(address: string) {
  try {
    const start = Date.now();
    const response = await geocodingClient.forwardGeocode(/* ... */).send();
    const duration = Date.now() - start;
    
    logger.info('Geocoding request', {
      address,
      success: response.body.features.length > 0,
      duration_ms: duration
    });
    
    // ... rest of code
  } catch (error) {
    logger.error('Geocoding failed', {
      address,
      error: error.message
    });
    return null;
  }
}
```

### Metrics to Track
- Geocoding success rate
- Average geocoding time
- API quota usage
- Failed addresses (for manual review)

## Performance Optimization

### Caching
```typescript
// backend/src/services/geocoding.ts
import NodeCache from 'node-cache';

const geocodeCache = new NodeCache({ stdTTL: 86400 }); // 24 hour cache

export async function geocodeAddress(address: string) {
  // Check cache first
  const cached = geocodeCache.get<Coordinates>(address);
  if (cached) {
    console.log('Cache hit:', address);
    return cached;
  }
  
  // Geocode and cache result
  const coords = await geocodingClient.forwardGeocode(/* ... */);
  if (coords) {
    geocodeCache.set(address, coords);
  }
  
  return coords;
}
```

### Database Index
Ensure geospatial queries are fast:
```sql
-- PostgreSQL with PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE pipeline_deals 
ADD COLUMN location GEOGRAPHY(Point, 4326);

UPDATE pipeline_deals 
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX idx_pipeline_deals_location ON pipeline_deals USING GIST(location);
```

## Rollback Plan

If geocoding causes issues:

```sql
-- Remove geocoding columns
ALTER TABLE pipeline_deals 
DROP COLUMN lat,
DROP COLUMN lng,
DROP COLUMN geocoded_at;
```

Frontend will fall back to mock geocoding automatically.

## Next Steps

1. Run database migration
2. Add geocoding service to backend
3. Update API endpoints to include coordinates
4. Run batch geocoding script for existing deals
5. Test map view with real coordinates
6. Set up cron job (optional)
7. Monitor geocoding success rate

## Questions?

Contact: Engineering Team
Docs: See `frontend/src/components/pipeline/README.md`
