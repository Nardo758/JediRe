# Apartment Locator AI + JEDI RE Integration

**Status:** ✅ Integration Layer Complete  
**Date:** Feb 14, 2026, 17:42 EST

---

## Overview

JEDI RE now integrates with Apartment Locator AI to access **real scraped property data** for market intelligence and underwriting.

**What This Enables:**
- Real market data for deal analysis
- Rent comparables from actual properties
- Supply pipeline tracking
- Absorption rate calculations
- Property class distribution
- Occupancy trends
- Rent growth analysis

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        JEDI RE                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Frontend (React)                                   │    │
│  │  • Deal Analysis pages                              │    │
│  │  • Market Intelligence tab                          │    │
│  │  • Financial Pro Forma                              │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────┐    │
│  │  Backend API (Express)                              │    │
│  │  • /api/market-intel/data                           │    │
│  │  • /api/market-intel/rent-comps                     │    │
│  │  • /api/market-intel/investment-metrics             │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────┐    │
│  │  Integration Service                                │    │
│  │  apartmentLocatorIntegration.ts                     │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
└────────────────────┼─────────────────────────────────────┘
                     │ HTTP API Calls
┌────────────────────▼─────────────────────────────────────┐
│             Apartment Locator AI                          │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Backend API (Express + Supabase)                 │   │
│  │  • /api/jedi/market-data                          │   │
│  │  • /api/jedi/rent-comps                           │   │
│  │  • /api/jedi/supply-pipeline                      │   │
│  │  • /api/admin/properties                          │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                     │
│  ┌──────────────────▼───────────────────────────────┐   │
│  │  PostgreSQL Database (Supabase)                   │   │
│  │  • 52+ scraped properties                         │   │
│  │  • Lease rates, concessions, amenities            │   │
│  │  • Rent history (trend tracking)                  │   │
│  │  • Analytical views                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Files Created

### Backend Service Layer
**File:** `backend/src/services/apartmentLocatorIntegration.ts` (11.4 KB)

**Provides:**
- `getMarketData(location)` - Complete market intelligence
- `getRentComps(location, options)` - Rent comparables
- `getSupplyPipeline(location, days)` - Properties coming online
- `getAbsorptionRate(location)` - How quickly units lease
- `getInvestmentMetrics(location)` - Key metrics for underwriting
- `getMarketSummary(location)` - Combined overview

**Usage:**
```typescript
import { getApartmentLocatorIntegration } from './services/apartmentLocatorIntegration';

const integration = getApartmentLocatorIntegration();

// Get market data for Atlanta
const market = await integration.getMarketData({ 
  city: 'Atlanta', 
  state: 'GA' 
});

console.log(market.supply.total_properties); // 52
console.log(market.pricing.rent_growth_90d); // 3.2%
console.log(market.supply.avg_occupancy); // 94.5%
```

---

### API Routes
**File:** `backend/src/api/rest/marketIntel.routes.ts` (6.8 KB)

**Endpoints:**

#### GET `/api/market-intel/data`
Complete market intelligence for a location.

**Query Params:**
- `city` (required) - City name
- `state` (required) - State code (e.g., "GA")

**Response:**
```json
{
  "success": true,
  "data": {
    "location": { "city": "Atlanta", "state": "GA" },
    "supply": {
      "total_properties": 52,
      "total_units": 8450,
      "avg_occupancy": 94.5,
      "class_distribution": { "a": 15, "b": 30, "c": 7 }
    },
    "pricing": {
      "avg_rent_by_type": { "Studio": 1200, "1BR": 1500, "2BR": 2000 },
      "rent_growth_90d": 3.2,
      "rent_growth_180d": 5.8,
      "concession_rate": 35.5,
      "avg_concession_value": 215
    },
    "demand": {
      "total_renters": 1250,
      "avg_budget": 2100,
      "lease_expirations_90d": 340
    },
    "forecast": {
      "units_delivering_30d": 120,
      "units_delivering_60d": 285,
      "units_delivering_90d": 450
    }
  }
}
```

#### GET `/api/market-intel/rent-comps`
Rent comparables for underwriting.

**Query Params:**
- `city` (required)
- `state` (required)
- `unit_type` (optional) - Filter by unit type (e.g., "2BR")
- `max_distance_miles` (optional) - Distance filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "property_name": "Elora at Buckhead",
      "address": "123 Main St",
      "unit_type": "2BR",
      "square_feet": 1100,
      "rent": 200000,
      "rent_per_sqft": 1.82,
      "occupancy": 95,
      "year_built": 2018,
      "property_class": "A",
      "concessions_active": true
    }
  ],
  "count": 50
}
```

#### GET `/api/market-intel/investment-metrics`
Key metrics for financial analysis.

**Query Params:**
- `city` (required)
- `state` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "avg_rent_growth_90d": 3.2,
    "avg_rent_growth_180d": 5.8,
    "occupancy_rate": 94.5,
    "concession_rate": 35.5,
    "absorption_days": 22,
    "supply_pressure": "moderate",
    "market_grade": "A"
  }
}
```

#### GET `/api/market-intel/summary`
Combined market overview (multiple API calls).

**Query Params:**
- `city` (required)
- `state` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "market": { /* full market data */ },
    "absorption": { /* absorption metrics */ },
    "pipeline": [ /* properties coming online */ ]
  }
}
```

#### GET `/api/market-intel/supply-pipeline`
Properties coming online (supply pressure).

**Query Params:**
- `city` (required)
- `state` (required)
- `days` (optional, default: 180) - Forecast window

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "name": "The Modern on Peachtree",
      "address": "456 Peachtree St",
      "total_units": 250,
      "property_class": "A",
      "available_date": "2026-06-15",
      "units_delivering": 250
    }
  ],
  "count": 12
}
```

#### GET `/api/market-intel/absorption-rate`
How quickly units lease up.

**Query Params:**
- `city` (required)
- `state` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "avg_days_to_lease": 22,
    "properties_tracked": 52,
    "monthly_absorption_rate": 1.36
  }
}
```

#### GET `/api/market-intel/check`
Check if market data exists for a location.

**Query Params:**
- `city` (required)
- `state` (required)

**Response:**
```json
{
  "success": true,
  "hasData": true
}
```

---

## Setup Instructions

### Step 1: Configure Integration

Add to `backend/src/index.ts` (or `index.replit.ts`):

```typescript
import { initializeApartmentLocatorIntegration } from './services/apartmentLocatorIntegration';

// Initialize integration on startup
initializeApartmentLocatorIntegration({
  baseUrl: process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:5000',
  timeout: 10000, // 10 seconds
  // apiKey: process.env.APARTMENT_LOCATOR_API_KEY, // Optional if you add auth
});
```

### Step 2: Register Routes

Add to `backend/src/api/rest/index.ts`:

```typescript
import marketIntelRoutes from './marketIntel.routes';

// Register market intelligence routes
app.use('/api/market-intel', marketIntelRoutes);
```

### Step 3: Environment Variables

Add to `.env`:

```bash
# Apartment Locator AI Integration
APARTMENT_LOCATOR_API_URL=http://localhost:5000
# APARTMENT_LOCATOR_API_KEY=your_api_key_here  # Optional
```

For production, use the actual Apartment Locator AI URL (Replit or deployed URL).

### Step 4: Test Integration

```bash
# Test market data endpoint
curl "http://localhost:3000/api/market-intel/data?city=Atlanta&state=GA"

# Test investment metrics
curl "http://localhost:3000/api/market-intel/investment-metrics?city=Atlanta&state=GA"

# Check if data exists
curl "http://localhost:3000/api/market-intel/check?city=Atlanta&state=GA"
```

---

## Frontend Integration

### Example: Market Intelligence Component

```typescript
import React, { useEffect, useState } from 'react';

interface MarketData {
  location: { city: string; state: string };
  supply: {
    total_properties: number;
    avg_occupancy: number;
  };
  pricing: {
    rent_growth_90d: number;
    concession_rate: number;
  };
}

export function MarketIntelligence({ city, state }: { city: string; state: string }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/market-intel/data?city=${city}&state=${state}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
        }
        setLoading(false);
      });
  }, [city, state]);

  if (loading) return <div>Loading market data...</div>;
  if (!data) return <div>No market data available</div>;

  return (
    <div className="market-intel">
      <h3>Market Intelligence: {data.location.city}, {data.location.state}</h3>
      
      <div className="metrics">
        <div className="metric">
          <label>Properties Tracked:</label>
          <value>{data.supply.total_properties}</value>
        </div>
        
        <div className="metric">
          <label>Avg Occupancy:</label>
          <value>{data.supply.avg_occupancy.toFixed(1)}%</value>
        </div>
        
        <div className="metric">
          <label>Rent Growth (90d):</label>
          <value>{data.pricing.rent_growth_90d.toFixed(1)}%</value>
        </div>
        
        <div className="metric">
          <label>Concession Rate:</label>
          <value>{data.pricing.concession_rate.toFixed(1)}%</value>
        </div>
      </div>
    </div>
  );
}
```

### Example: Rent Comps Table

```typescript
export function RentCompsTable({ city, state, unitType }: Props) {
  const [comps, setComps] = useState<RentComp[]>([]);

  useEffect(() => {
    fetch(`/api/market-intel/rent-comps?city=${city}&state=${state}&unit_type=${unitType}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setComps(result.data);
        }
      });
  }, [city, state, unitType]);

  return (
    <table className="rent-comps">
      <thead>
        <tr>
          <th>Property</th>
          <th>Unit Type</th>
          <th>Sq Ft</th>
          <th>Rent</th>
          <th>$/Sq Ft</th>
          <th>Class</th>
        </tr>
      </thead>
      <tbody>
        {comps.map(comp => (
          <tr key={comp.property_id}>
            <td>{comp.property_name}</td>
            <td>{comp.unit_type}</td>
            <td>{comp.square_feet}</td>
            <td>${(comp.rent / 100).toFixed(0)}</td>
            <td>${comp.rent_per_sqft?.toFixed(2)}</td>
            <td>Class {comp.property_class}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Use Cases in JEDI RE

### 1. Deal Analysis Page
- Display market intelligence for deal location
- Show rent comps for unit mix validation
- Calculate market positioning vs. comps

### 2. Financial Pro Forma
- Use market rent growth for projections
- Apply market concession rates
- Reference absorption rate for lease-up assumptions

### 3. Market Intelligence Tab
- Show supply pipeline (competition coming online)
- Display occupancy trends
- Track rent growth over time

### 4. Risk Scoring
- Factor in supply pressure (high supply = higher risk)
- Consider market grade (Class D market = higher risk)
- Use absorption rate for velocity assumptions

### 5. Investment Strategy
- Compare deal to market metrics
- Identify value-add opportunities (below-market rents)
- Assess exit timing based on market trends

---

## Data Available

**Current Coverage:**
- **52+ properties** in Apartment Locator AI database
- **Primary Market:** Atlanta, GA
- **Data Points:** Lease rates, concessions, amenities, occupancy, property characteristics
- **Historical Data:** Rent history for trend analysis

**Data Refresh:**
- Properties scraped regularly
- Rent history accumulates over time
- Market views update automatically

---

## Next Steps

### Immediate (Integration Complete):
1. ✅ Backend service created
2. ✅ API routes created
3. ✅ Documentation written
4. ⏳ Add to backend initialization
5. ⏳ Test endpoints

### Frontend Integration (2-3 hours):
1. Create MarketIntelligence component
2. Add to Deal Analysis page
3. Create RentCompsTable component
4. Add to Financial Pro Forma
5. Display in Market tab

### Data Expansion (Ongoing):
1. Scrape more properties (goal: 500+)
2. Expand to more markets
3. Increase scraping frequency
4. Enhance data quality

---

## Error Handling

Integration gracefully handles:
- ✅ Network failures (timeouts, connection errors)
- ✅ Missing data (returns empty arrays/null values)
- ✅ Invalid locations (returns 404 or empty results)
- ✅ API errors (logs error, returns user-friendly message)

**Best Practice:**
Always check for data existence before displaying:

```typescript
const hasData = await integration.hasMarketData({ city, state });
if (!hasData) {
  return <EmptyState message="No market data available for this location" />;
}
```

---

## Performance

**Response Times (Expected):**
- Market data: 200-500ms
- Rent comps: 300-800ms
- Investment metrics: 400-900ms (combines 3 API calls)
- Market summary: 500-1200ms (combines multiple calls)

**Optimization:**
- Integration service caches responses (10 second TTL)
- Database views pre-aggregate common queries
- Lazy load components (only fetch when visible)

---

## Status

✅ **Integration Layer: COMPLETE**  
⏳ **Backend Wiring: Pending**  
⏳ **Frontend Components: Pending**  
⏳ **Testing: Pending**

**Ready for deployment after:**
1. Backend initialization configured
2. Routes registered
3. Environment variables set
4. Integration tested

---

## Support

**Questions?**
- Integration service: `apartmentLocatorIntegration.ts`
- API routes: `marketIntel.routes.ts`
- Apartment Locator AI docs: `/home/leon/clawd/apartment-locator-ai/ENHANCED_SCHEMA_BUILD.md`

**Issues?**
- Check Apartment Locator AI is running
- Verify environment variables
- Check network connectivity
- Review error logs

---

**Integration complete! Ready to wire up.** 🚀
