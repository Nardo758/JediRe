# 🏢 JEDI RE ↔ Apartment Locator AI Integration

**Complete integration connecting apartment market data to real estate deal analysis**

---

## 🎯 Overview

This integration allows JEDI RE to:
- Pull real apartment market data from Apartment Locator AI
- Calculate market metrics (rent, occupancy, competition)
- Feed data into JEDI Score analysis
- Track market trends over time

**Architecture:**
```
Apartment Locator AI (Replit Postgres)
           ↓ API
JEDI RE Apartment Market Service
           ↓
Link Comparables → Calculate Metrics → JEDI Analysis
```

---

## 📦 Components Created

### 1. Database Schema (`019_apartment_market_integration.sql`)

**Tables:**
- `deal_comparable_properties` - Links deals to apartment properties
- `trade_area_market_metrics` - Aggregated market metrics per deal/trade area
- `market_metric_history` - Historical snapshots for trend analysis
- `apartment_api_sync_log` - API sync tracking

**Views:**
- `deal_market_summary` - One-stop view of all market data for a deal

### 2. Service Layer (`apartmentMarketService.ts`)

**Key Methods:**
- `linkComparablesToDeal()` - Fetch nearby properties and link to deal
- `calculateTradeAreaMetrics()` - Aggregate market metrics
- `getMarketDataForAnalysis()` - Format data for JEDI analysis

### 3. API Routes (`apartmentMarket.routes.ts`)

**Endpoints:**
- `POST /api/apartment-market/sync-deal/:dealId` - Sync market data
- `GET /api/apartment-market/deal/:dealId/comparables` - Get comparable properties
- `GET /api/apartment-market/deal/:dealId/metrics` - Get market metrics
- `GET /api/apartment-market/deal/:dealId/analysis-input` - Data for JEDI analysis
- `GET /api/apartment-market/deal/:dealId/trends` - Historical trends
- `GET /api/apartment-market/sync-status/:dealId` - Check sync freshness

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

```bash
cd /home/leon/clawd/jedire
psql -U your_user -d jedire_db -f backend/migrations/019_apartment_market_integration.sql
```

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%apartment%';
```

Should show:
- deal_comparable_properties
- trade_area_market_metrics
- market_metric_history
- apartment_api_sync_log

### Step 2: Configure API Connection

Add to JEDI RE `.env`:
```bash
APARTMENT_LOCATOR_API_URL=http://your-replit-url/api
# or for local dev:
# APARTMENT_LOCATOR_API_URL=http://localhost:3000/api
```

### Step 3: Wire Up Routes

In `backend/src/index.ts` (or wherever routes are registered):
```typescript
import apartmentMarketRoutes from './api/rest/apartmentMarket.routes';

// ... other routes
app.use('/api/apartment-market', apartmentMarketRoutes);
```

### Step 4: Test Integration

```bash
# 1. Sync market data for a deal
curl -X POST http://localhost:5000/api/apartment-market/sync-deal/YOUR_DEAL_ID

# 2. Check sync status
curl http://localhost:5000/api/apartment-market/sync-status/YOUR_DEAL_ID

# 3. Get market metrics
curl http://localhost:5000/api/apartment-market/deal/YOUR_DEAL_ID/metrics
```

---

## 📊 Data Flow Example

### 1. User Creates Deal in JEDI RE
```javascript
// Deal created at: 33.8490° N, 84.3880° W (Buckhead)
const deal = {
  id: "deal-123",
  property_name: "Buckhead Heights",
  latitude: 33.8490,
  longitude: -84.3880
};
```

### 2. Sync Apartment Market Data
```bash
POST /api/apartment-market/sync-deal/deal-123
```

**What happens:**
1. Fetches properties from Apartment Locator AI within 3-mile radius
2. Calculates distance and relevance score for each property
3. Saves comparable properties to `deal_comparable_properties`
4. Aggregates metrics (avg rent, occupancy, competition)
5. Saves to `trade_area_market_metrics`
6. Creates historical snapshot in `market_metric_history`

### 3. View Market Metrics
```javascript
GET /api/apartment-market/deal/deal-123/metrics

Response:
{
  "deal_name": "Buckhead Heights",
  "properties_count": 18,
  "avg_rent_1br": 1850,
  "avg_rent_2br": 2450,
  "avg_occupancy_rate": 94.5,
  "rent_growth_12mo": 5.2,
  "market_saturation": 78.3,
  "competition_intensity": "HIGH",
  "comparable_properties_count": 18,
  "avg_comp_relevance": 82.5
}
```

### 4. Feed into JEDI Analysis
```javascript
GET /api/apartment-market/deal/deal-123/analysis-input

Response:
{
  "analysisInput": {
    "existing_units": 18,
    "avg_rent": 2150,
    "occupancy": 94.5,
    "rent_timeseries": [1980, 2020, 2080, 2150],
    "rent_growth_rate": 5.2,
    "market_saturation": 78.3
  }
}
```

### 5. Run JEDI Analysis
```javascript
// Existing JEDI analysis system consumes this data
const result = await analysisService.analyze({
  submarket: "Buckhead",
  existing_units: 18,
  rent_timeseries: [1980, 2020, 2080, 2150],
  // ... other inputs
});

// Result:
{
  "verdict": "STRONG_OPPORTUNITY",
  "composite_score": 8.5,
  "demand_signal": {
    "strength": "STRONG",
    "rent_growth_rate": 5.2
  },
  "supply_signal": {
    "verdict": "UNDERSUPPLIED",
    "saturation_pct": 78.3
  }
}
```

---

## 🔄 Sync Workflow

### Automatic Sync (Recommended)
Set up a cron job or background task:
```javascript
// Run nightly at 2 AM
cron.schedule('0 2 * * *', async () => {
  const activeDeals = await getActiveDeals();
  
  for (const deal of activeDeals) {
    await apartmentMarketService.linkComparablesToDeal(
      deal.id, 
      deal.latitude, 
      deal.longitude
    );
  }
});
```

### Manual Sync (On-Demand)
Trigger sync when:
- Deal location changes
- User requests market update
- Trade area is modified

### Sync Freshness Rules
- **Fresh** (< 24 hours): No action needed
- **Stale** (24-72 hours): Show "Update Available" badge
- **Old** (> 72 hours): Auto-trigger re-sync

---

## 📈 Frontend Integration

### Deal Page - Market Tab

```typescript
import { useEffect, useState } from 'react';

function DealMarketTab({ dealId }) {
  const [metrics, setMetrics] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    // Check sync status
    fetch(`/api/apartment-market/sync-status/${dealId}`)
      .then(res => res.json())
      .then(data => {
        setSyncStatus(data);
        if (data.needsSync) {
          // Trigger sync
          syncMarketData();
        } else {
          // Load existing metrics
          loadMetrics();
        }
      });
  }, [dealId]);

  const syncMarketData = async () => {
    const res = await fetch(`/api/apartment-market/sync-deal/${dealId}`, {
      method: 'POST'
    });
    const data = await res.json();
    setMetrics(data.metrics);
  };

  const loadMetrics = async () => {
    const res = await fetch(`/api/apartment-market/deal/${dealId}/metrics`);
    const data = await res.json();
    setMetrics(data.metrics);
  };

  return (
    <div>
      <h3>Market Overview</h3>
      {metrics && (
        <div>
          <p>Properties in Trade Area: {metrics.properties_count}</p>
          <p>Avg Rent (1BR): ${metrics.avg_rent_1br}</p>
          <p>Avg Rent (2BR): ${metrics.avg_rent_2br}</p>
          <p>Occupancy Rate: {metrics.avg_occupancy_rate}%</p>
          <p>Rent Growth (12mo): {metrics.rent_growth_12mo}%</p>
          <p>Competition: {metrics.competition_intensity}</p>
        </div>
      )}
      
      {syncStatus?.status === 'stale' && (
        <button onClick={syncMarketData}>
          Update Market Data
        </button>
      )}
    </div>
  );
}
```

---

## 🔧 Configuration

### Environment Variables

**JEDI RE:**
```bash
# Apartment Locator AI API endpoint
APARTMENT_LOCATOR_API_URL=https://your-apartment-api.replit.app/api

# Sync settings
APARTMENT_SYNC_RADIUS_MILES=3
APARTMENT_SYNC_MIN_RELEVANCE=50
APARTMENT_CACHE_TTL_HOURS=24
```

### Service Settings

**Modify in `apartmentMarketService.ts`:**
```typescript
// Default search radius (miles)
const DEFAULT_RADIUS = 3;

// Minimum relevance score for comparables
const MIN_RELEVANCE = 50;

// Max comparables to store per deal
const MAX_COMPARABLES = 50;

// Sync frequency (hours)
const SYNC_FRESHNESS_HOURS = 24;
```

---

## 📊 Key Metrics Calculated

### Trade Area Metrics
- **Properties Count** - # of apartment properties in area
- **Avg Rent by Bedroom** - Studio, 1BR, 2BR, 3BR averages
- **Avg Occupancy Rate** - Overall occupancy %
- **Rent Growth** - 6mo, 12mo, 24mo % change
- **Market Saturation** - Supply vs demand ratio
- **Competition Intensity** - LOW/MEDIUM/HIGH

### Comparable Property Scoring
```
Relevance Score (0-100) =
  100 base
  - (distance / 3 miles) * 30  // Distance penalty
  + 10 if built >= 2020        // Recency bonus
  + 10 if occupancy >= 90%     // Performance bonus
```

---

## 🎯 Next Steps

### Phase 1: Basic Integration ✅
- [x] Database schema
- [x] Service layer
- [x] API routes
- [ ] Run migration
- [ ] Test API endpoints

### Phase 2: Frontend Display
- [ ] Market metrics cards on Deal page
- [ ] Comparable properties list
- [ ] Rent trend charts
- [ ] Competition map view

### Phase 3: JEDI Analysis Integration
- [ ] Wire `/analysis-input` into existing analysis flow
- [ ] Auto-sync before running analysis
- [ ] Show market data sources in analysis results

### Phase 4: Automation
- [ ] Background sync job
- [ ] Stale data notifications
- [ ] Batch sync for all active deals

---

## 🐛 Troubleshooting

### "No market data found"
**Solution:** Run sync first:
```bash
curl -X POST http://localhost:5000/api/apartment-market/sync-deal/YOUR_DEAL_ID
```

### "API connection failed"
**Check:**
1. `APARTMENT_LOCATOR_API_URL` is set correctly
2. Apartment Locator AI server is running
3. Network connectivity between services

### "Sync taking too long"
**Optimize:**
- Reduce search radius (default 3 miles)
- Lower `MAX_COMPARABLES` limit
- Add indexes to Apartment Locator AI database

### "Metrics look wrong"
**Debug:**
```sql
-- Check raw comparable data
SELECT * FROM deal_comparable_properties WHERE deal_id = 'YOUR_DEAL_ID';

-- Check sync log
SELECT * FROM apartment_api_sync_log WHERE deal_id = 'YOUR_DEAL_ID' ORDER BY synced_at DESC;
```

---

## 📚 API Reference

### Full Endpoint Documentation

**Base URL:** `/api/apartment-market`

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/sync-deal/:dealId` | POST | Sync market data for deal | Required |
| `/deal/:dealId/comparables` | GET | Get comparable properties | Required |
| `/deal/:dealId/metrics` | GET | Get aggregated metrics | Required |
| `/deal/:dealId/analysis-input` | GET | Get data for JEDI analysis | Required |
| `/deal/:dealId/trends` | GET | Get historical trends | Required |
| `/sync-status/:dealId` | GET | Check sync freshness | Required |

---

**Ready to deploy!** Run the migration and start syncing market data! 🚀
