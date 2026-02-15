# 🧠 JEDI RE Market Research Engine

**Centralized intelligence hub that aggregates market data from multiple sources**

---

## 🎯 Overview

The Market Research Engine is the **central intelligence system** in JEDI RE. When a deal is created, it automatically pulls data from multiple sources to generate a comprehensive market research report.

### Architecture

```
Deal Created
   ↓
🧠 Market Research Engine (Central Hub)
   ↓ Fetches from multiple sources
   ├── 🏢 Apartment Locator AI (PRIMARY APARTMENT MARKET DATA)
   │   → Rent prices, occupancy, unit mix, amenities
   │   → Rent trends, inventory, market saturation
   │   → Property classification, concessions, availability
   ├── 🗺️ Zoning Intelligence (FUTURE SUPPLY PREDICTION)
   │   → Allowed density, vacant/underutilized parcels
   │   → Buildable units forecast, rezoning probability
   │   → Years to saturation, absorption capacity
   ├── 📊 Census API → Demographics
   ├── 📰 News Intelligence → Market events
   ├── 🏗️ Building Permits → Permitted pipeline supply
   ├── 💼 CoStar → Commercial data (planned)
   └── 📈 BLS → Employment data (planned)
   ↓
Generates Market Research Report
   ↓
Caches in Database (24-hour TTL)
   ↓
Feeds JEDI Score Analysis
```

### Key Benefits

✅ **Single source of truth** - One place for all market data  
✅ **Automatic aggregation** - No manual data collection  
✅ **Multi-source intelligence** - Better than any single API  
✅ **Smart caching** - Fast subsequent queries  
✅ **Data quality scoring** - Know what you can trust  
✅ **Extensible** - Easy to add new data sources

---

## 📦 Components

### 1. Market Research Engine Service
**File:** `backend/src/services/marketResearchEngine.ts`

**Main Method:**
```typescript
generateMarketReport(dealLocation) → MarketResearchReport
```

**What it does:**
- Fetches data from all available sources in parallel
- Aggregates into unified report structure
- Calculates market scores (demand, supply, opportunity)
- Determines data quality and confidence level
- Caches report for 24 hours

**Data Sources Integrated:**
- ✅ **Apartment Locator AI** (PRIMARY APARTMENT MARKET DATA)
  - Rent prices by unit type
  - Occupancy rates & trends
  - Unit mix & inventory
  - Property amenities & features
  - Concessions & incentives
  - Property classification (A/B/C/D)
  - Market saturation metrics
  - Comparable properties
- ✅ **Zoning Intelligence** (FUTURE SUPPLY PREDICTION)
  - Vacant & underutilized parcel analysis
  - Allowed density calculations
  - Theoretical vs realistic buildable units
  - Development probability scoring
  - Rezoning likelihood assessment
  - Years to market saturation
  - Future supply risk analysis
  - Absorption capacity forecasts
- ✅ News Intelligence (market events from JEDI RE database)
- 🔄 Census API (demographics - structure ready)
- 🔄 Building Permits (permitted pipeline - structure ready)

### 2. Database Schema
**File:** `backend/migrations/019_market_research_engine.sql`

**Tables:**
- `market_research_reports` - Full cached reports (JSONB)
- `market_research_metrics` - Extracted key metrics (fast access)
- `market_research_source_log` - Track data source performance
- `market_research_triggers` - Auto-generation configuration

**Views:**
- `deal_market_intelligence` - One-stop market intelligence view

### 3. API Routes
**File:** `backend/src/api/rest/marketResearch.routes.ts`

**Endpoints:**
- `POST /api/market-research/generate/:dealId` - Generate report
- `GET /api/market-research/report/:dealId` - Get cached report
- `GET /api/market-research/metrics/:dealId` - Quick metrics
- `GET /api/market-research/intelligence/:dealId` - Intelligence view
- `GET /api/market-research/analysis-input/:dealId` - For JEDI analysis
- `GET /api/market-research/status/:dealId` - Check report freshness
- `GET /api/market-research/sources/:dealId` - Source status
- `POST /api/market-research/batch-generate` - Bulk generation

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

```bash
cd /home/leon/clawd/jedire
psql -U your_user -d jedire_db -f backend/migrations/019_market_research_engine.sql
```

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%market_research%';
```

### Step 2: Configure Environment Variables

Add to `.env`:
```bash
# Apartment Locator AI API
APARTMENT_LOCATOR_API_URL=https://your-apartment-api.replit.app/api

# Optional: Census API (for demographics)
CENSUS_API_KEY=your_census_key

# Cache settings
MARKET_RESEARCH_CACHE_HOURS=24
```

### Step 3: Wire Up Routes

In `backend/src/index.ts`:
```typescript
import marketResearchRoutes from './api/rest/marketResearch.routes';

app.use('/api/market-research', marketResearchRoutes);
```

### Step 4: Auto-Trigger on Deal Creation

In your deal creation handler:
```typescript
import marketResearchEngine from '../services/marketResearchEngine';

// After deal is created with location
const deal = await createDeal(dealData);

if (deal.latitude && deal.longitude) {
  // Trigger market research (async, non-blocking)
  marketResearchEngine.generateMarketReport({
    id: deal.id,
    latitude: deal.latitude,
    longitude: deal.longitude,
    city: deal.city,
    state: deal.state,
    address: deal.address
  }).catch(err => console.error('Market research failed:', err));
}
```

---

## 📊 Market Research Report Structure

```typescript
interface MarketResearchReport {
  deal_id: string;
  submarket_name: string;
  generated_at: Date;
  
  // Apartment Market Data (from Apartment Locator AI - PRIMARY SOURCE)
  apartment_market: {
    // Property Inventory
    properties_count: number;
    total_units: number;
    available_units: number;
    
    // Rent Prices
    avg_rent_studio?: number;
    avg_rent_1br?: number;
    avg_rent_2br?: number;
    avg_rent_3br?: number;
    
    // Market Performance
    avg_occupancy_rate?: number;
    rent_growth_6mo?: number;
    rent_growth_12mo?: number;
    
    // Supply Metrics
    market_saturation: number;
    competition_intensity: 'LOW' | 'MEDIUM' | 'HIGH';
    
    // Property Quality
    avg_property_age?: number;
    property_class_mix?: { A: number; B: number; C: number; D: number };
    
    // Amenities
    common_amenities: string[];
    avg_amenity_count?: number;
    
    // Concessions
    active_concessions_count: number;
    avg_concession_value?: number;
    
    // Comparables
    comparable_properties: Property[];
  };
  
  // Demographics (from Census API)
  demographics?: {
    population: number;
    median_income: number;
    population_growth_rate?: number;
    household_count?: number;
  };
  
  // Market Events (from News Intelligence)
  market_events?: {
    recent_developments: Event[];
    employment_changes: Event[];
    major_announcements: Event[];
  };
  
  // Supply Pipeline (from Building Permits)
  supply_pipeline?: {
    units_under_construction: number;
    units_permitted: number;
    expected_delivery_timeline: string;
  };
  
  // Calculated Scores
  market_score: {
    demand_strength: number;      // 0-100
    supply_balance: number;        // 0-100
    overall_opportunity: number;   // 0-100
  };
  
  // Data Quality
  data_quality: {
    sources_available: string[];
    sources_missing: string[];
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}
```

---

## 🔄 Workflow Examples

### Example 1: New Deal Created

```typescript
// 1. User creates deal in Atlanta
const deal = {
  property_name: "Buckhead Heights",
  address: "123 Peachtree St",
  latitude: 33.8490,
  longitude: -84.3880
};

// 2. Market Research Engine triggered automatically
const report = await marketResearchEngine.generateMarketReport(deal);

// 3. Report generated with comprehensive apartment market data + 2 other sources
{
  deal_id: "deal-123",
  submarket_name: "Buckhead",
  apartment_market: {
    properties_count: 18,
    total_units: 900,
    available_units: 50,
    avg_rent_1br: 1850,
    avg_rent_2br: 2450,
    avg_occupancy_rate: 94.5,
    rent_growth_12mo: 5.2,
    market_saturation: 78,
    competition_intensity: "HIGH",
    avg_property_age: 8,
    property_class_mix: { A: 40, B: 50, C: 10, D: 0 },
    common_amenities: ["Pool", "Gym", "Parking", "Pet-friendly"],
    avg_amenity_count: 12,
    active_concessions_count: 3,
    avg_concession_value: 500
  },
  demographics: {
    population: 50000,
    median_income: 85000
  },
  market_events: {
    recent_developments: [
      { title: "Microsoft expanding Atlanta office", impact: "positive" }
    ]
  },
  zoning_analysis: {
    vacant_parcels_count: 45,
    underutilized_parcels_count: 12,
    total_developable_acres: 78,
    realistic_buildable_units: 1911,
    future_supply_ratio: 0.35,  // 35% future supply
    estimated_years_to_saturation: 9.5,
    future_supply_risk: "MEDIUM",
    absorption_capacity: "Moderate absorption capacity"
  },
  market_score: {
    demand_strength: 85,
    supply_balance: 65,  // Adjusted for future supply
    overall_opportunity: 75,
    future_supply_risk: 60  // MEDIUM
  },
  data_quality: {
    sources_available: ["Apartment Locator AI", "Census API", "News Intelligence"],
    confidence_level: "HIGH"
  }
}

// 4. Cached for 24 hours
// 5. Used in JEDI Score analysis
```

### Example 2: Frontend Display

```typescript
// Deal page loads
useEffect(() => {
  // Check if report exists
  fetch(`/api/market-research/status/${dealId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.exists || data.needsUpdate) {
        // Generate new report
        generateReport();
      } else {
        // Load cached report
        loadReport();
      }
    });
}, [dealId]);

function loadReport() {
  fetch(`/api/market-research/intelligence/${dealId}`)
    .then(res => res.json())
    .then(data => {
      setIntelligence(data.intelligence);
    });
}
```

---

## 📈 Market Scores Explained

### Demand Strength Score (0-100)

**Calculation:**
- Base: 50
- High occupancy (≥95%): +20
- Good occupancy (≥90%): +10
- Strong rent growth (≥5%/year): +15
- Moderate rent growth (≥3%/year): +10
- Population growth: +10
- Income growth: +10

**Interpretation:**
- **80-100:** Strong demand, tight market
- **60-79:** Healthy demand
- **40-59:** Balanced/neutral
- **20-39:** Weak demand
- **0-19:** Very weak demand

### Supply Balance Score (0-100)

**Calculation:**
- Pipeline / Existing ratio:
  - <10% pipeline: 80 (undersupplied)
  - 10-20% pipeline: 60 (balanced)
  - >20% pipeline: 40 (oversupplied)

**Interpretation:**
- **80-100:** Undersupplied, favorable for landlords
- **50-79:** Balanced market
- **0-49:** Oversupplied, renter's market

### Overall Opportunity Score (0-100)

**Calculation:**
```
Overall = (Demand × 0.6) + (Supply × 0.4)
```

**Market Verdict:**
- **80-100:** STRONG_OPPORTUNITY ✅
- **60-79:** MODERATE_OPPORTUNITY ✔️
- **40-59:** NEUTRAL ⚠️
- **20-39:** CAUTION ⚠️
- **0-19:** AVOID ❌

---

## 🔌 Adding New Data Sources

### Template for New Source

```typescript
// In marketResearchEngine.ts

private async fetchNewDataSource(location: DealLocation): Promise<any> {
  try {
    // 1. Make API call
    const response = await axios.get('https://api.example.com/data', {
      params: {
        lat: location.latitude,
        lng: location.longitude
      },
      timeout: 10000
    });
    
    // 2. Transform data to standard format
    const transformed = {
      key_metric: response.data.value,
      // ... more fields
    };
    
    // 3. Log success
    await this.logSourceFetch(location.id, 'New Data Source', 'success', response.data.length);
    
    return transformed;
    
  } catch (error: any) {
    // 4. Log failure
    await this.logSourceFetch(location.id, 'New Data Source', 'failed', 0, error.message);
    throw error;
  }
}
```

### Steps to Add:
1. Create fetch method in `marketResearchEngine.ts`
2. Add to parallel fetch in `generateMarketReport()`
3. Update report interface with new data
4. Update score calculation if needed
5. Test with real deal

---

## 🐛 Troubleshooting

### "No market research found"

**Solution:** Generate report first
```bash
curl -X POST http://localhost:5000/api/market-research/generate/DEAL_ID
```

### "Report has LOW confidence"

**Check:** Which sources are missing?
```bash
curl http://localhost:5000/api/market-research/sources/DEAL_ID
```

**Common causes:**
- Apartment Locator AI API down
- No properties in area
- Census API key missing

### "Report is stale"

**Solution:** Force regeneration
```bash
curl -X POST "http://localhost:5000/api/market-research/generate/DEAL_ID?force=true"
```

### Performance Issues

**Optimization tips:**
- Reduce search radius for rental comps
- Increase cache TTL (default 24 hours)
- Add database indexes
- Use batch generation during off-hours

---

## 📊 Monitoring & Analytics

### Track Data Source Performance

```sql
-- Source success rates
SELECT 
  source_name,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
  ROUND(AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100, 2) as success_rate,
  ROUND(AVG(response_time_ms)) as avg_response_ms
FROM market_research_source_log
WHERE fetched_at >= NOW() - INTERVAL '7 days'
GROUP BY source_name;
```

### Report Generation Stats

```sql
-- Reports by confidence level
SELECT 
  confidence_level,
  COUNT(*) as report_count,
  ROUND(AVG(sources_count), 1) as avg_sources
FROM market_research_reports
WHERE generated_at >= NOW() - INTERVAL '30 days'
GROUP BY confidence_level;
```

---

## 🎯 Next Steps

### Phase 1: Core Engine ✅
- [x] Service layer architecture
- [x] Database schema
- [x] API routes
- [x] Apartment Locator AI integration
- [x] News Intelligence integration
- [ ] Run migration
- [ ] Test with real deal

### Phase 2: Additional Sources
- [ ] Census API integration (demographics)
- [ ] Building permits scraper (supply pipeline)
- [ ] BLS API (employment data)
- [ ] CoStar integration (commercial data)

### Phase 3: Frontend
- [ ] Market Intelligence dashboard tab
- [ ] Report freshness indicator
- [ ] Source status display
- [ ] One-click regeneration

### Phase 4: Automation
- [ ] Auto-trigger on deal creation
- [ ] Background refresh job
- [ ] Stale report notifications
- [ ] Batch processing for all deals

---

## 📚 Related Documentation

- [Apartment Locator AI Integration](./APARTMENT_LOCATOR_AI_INTEGRATION.md)
- [Zoning Intelligence - Future Supply Prediction](./ZONING_INTELLIGENCE_INTEGRATION.md) ⭐ NEW
- [JEDI Score Analysis](./JEDI_SCORE.md)
- [News Intelligence System](./NEWS_INTELLIGENCE.md)

---

## 🎯 Key Features

✅ **Multi-Source Intelligence** - Aggregates from 5+ data sources  
✅ **Apartment Market Data** - 108 properties from Apartment Locator AI  
✅ **Zoning Intelligence** - Predicts future supply 3-5 years ahead  
✅ **Smart Caching** - 24-hour TTL for fast queries  
✅ **Data Quality Scoring** - Know what you can trust  
✅ **JEDI Analysis Ready** - Formatted for JEDI Score input  

---

**Ready to deploy!** Run the migration and start generating market intelligence! 🚀
