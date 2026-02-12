# ApartmentIQ Integration Guide

**Version:** 1.0  
**Date:** 2026-02-05  
**Status:** Ready for API Connection

---

## 🎯 Overview

This integration allows JEDI RE to consume real-time property data from **ApartmentIQ** (Apartment Locator AI), combining consumer-facing property intelligence with institutional-grade market analysis.

### Why This Integration?

| Data Source | Strengths | Update Frequency |
|-------------|-----------|------------------|
| **CoStar** | Historical trends (26 years), institutional accuracy | Quarterly |
| **ApartmentIQ** | Real-time property data, negotiation intelligence, consumer demand signals | Daily/Weekly |
| **Combined** | Best of both: historical context + current market pressure | Real-time + Historical |

---

## 📊 What ApartmentIQ Provides

### 1. Property-Level Data
- Unit counts, rents, vacancy rates
- Building quality (Class A/B/C)
- Unit mix percentages
- Amenities and features

### 2. Market Intelligence (Proprietary)
- **Opportunity Scores** (0-10) - Negotiation potential per listing
- **Success Rates** - Historical negotiation outcomes
- **Concession Prevalence** - Market softness indicator
- **Days on Market** - Supply pressure metric

### 3. Consumer Demand Signals
- Search activity heatmaps
- Application volume trends
- Seasonal adjustments
- Price sensitivity indicators

---

## 🔧 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ApartmentIQ API                        │
│  (Apartment Locator AI - Replit-hosted)                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ REST API (JSON)
                   │
┌──────────────────▼──────────────────────────────────────────┐
│           JEDI RE - Integration Layer                       │
│  /backend/services/apartmentiq-client.ts                   │
│  - fetchMarketData()                                        │
│  - fetchTimeseries()                                        │
│  - fetchSubmarkets()                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Transform to JEDI format
                   │
┌──────────────────▼──────────────────────────────────────────┐
│           Data Aggregator                                   │
│  /backend/services/data-aggregator.ts                      │
│  - Property-level → Submarket-level                        │
│  - Merge ApartmentIQ + CoStar data                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ MarketSnapshot objects
                   │
┌──────────────────▼──────────────────────────────────────────┐
│           Python Engines                                    │
│  /backend/python-services/engines/apartmentiq_wrapper.py   │
│  - Signal Processing Engine                                 │
│  - Carrying Capacity Engine                                 │
│  - Imbalance Detector Engine                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
jedire/backend/
├── services/
│   ├── apartmentiq-client.ts        # API client + type definitions
│   └── data-aggregator.ts           # Property → Submarket aggregation
│
└── python-services/
    └── engines/
        └── apartmentiq_wrapper.py   # Python engine integration
```

---

## 🚀 Usage Examples

### TypeScript: Fetch Market Data

```typescript
import { apartmentIQClient } from './services/apartmentiq-client';

// Get all properties in Atlanta Midtown
const data = await apartmentIQClient.fetchMarketData('Atlanta', 'Midtown');

console.log(data.market_summary);
// {
//   city: 'Atlanta',
//   submarket: 'Midtown',
//   total_units: 12543,
//   vacancy_rate: 0.203,
//   avg_rent_overall: 1982,
//   avg_opportunity_score: 7.2,  // ApartmentIQ intelligence
//   negotiation_success_rate: 0.73
// }

console.log(data.properties.length);  // 45 properties
```

### TypeScript: Get Historical Trends

```typescript
// Weekly rent trends for last 90 days
const trends = await apartmentIQClient.fetchTimeseries(
  'Midtown',
  'weekly',
  90
);

console.log(trends.observations.length);  // ~13 weeks
console.log(trends.observations[0]);
// {
//   date: '2026-02-03',
//   avg_rent: 1982,
//   vacancy_rate: 0.203,
//   avg_opportunity_score: 7.2
// }
```

### TypeScript: Aggregate to Submarket

```typescript
import { dataAggregator } from './services/data-aggregator';

// Transform ApartmentIQ properties to JEDI format
const properties = data.properties.map(p => ({
  id: p.id,
  submarket: p.submarket,
  total_units: p.total_units,
  available_units: p.available_units,
  vacancy_rate: p.vacancy_rate,
  rent_avg: p.rent_avg,
  building_class: p.building_class,
  opportunity_score: p.opportunity_score,
  data_source: 'apartmentiq'
}));

// Aggregate to submarket level
const snapshot = dataAggregator.aggregateToSubmarket(
  properties,
  'Midtown',
  'Atlanta',
  'GA',
  { includeIntelligence: true }
);

console.log(snapshot);
// {
//   submarket_id: 'atlanta-ga-midtown',
//   existing_units: 12543,
//   vacancy_rate: 0.203,
//   avg_rent: { average: 1982, ... },
//   opportunity_score: 7.2,  // Aggregated intelligence
//   confidence: 0.92
// }
```

### Python: Process Signal

```python
from engines.apartmentiq_wrapper import ApartmentIQProcessor

# Initialize processor
processor = ApartmentIQProcessor()

# Mock timeseries data (from ApartmentIQ API)
timeseries = [
    {
        'date': '2026-01-15',
        'avg_rent': 1982,
        'vacancy_rate': 0.203,
        'total_supply': 12543,
        'available_units': 2546,
        'avg_opportunity_score': 7.2,
        'concessions_prevalence': 0.68,
        'avg_days_on_market': 23,
        'negotiation_success_rate': 0.73
    },
    # ... more weeks
]

# Process with Signal Processing Engine
signal = processor.process_timeseries(timeseries)

print(f"Rent Growth Rate: {signal.rent_growth_rate:.2%}")
# Output: Rent Growth Rate: 6.09%

print(f"Market Pressure: {signal.market_pressure_index:.1f}/10")
# Output: Market Pressure: 7.8/10 (soft market)

print(f"Confidence: {signal.confidence:.1%}")
# Output: Confidence: 92.5%
```

### Python: Detect Imbalance

```python
# Detect demand/supply imbalance
imbalance = processor.detect_imbalance(signal)

print(f"Imbalance Score: {imbalance.imbalance_score}/100")
# Output: Imbalance Score: 73/100

print(f"Verdict: {imbalance.verdict}")
# Output: Verdict: STRONG_OPPORTUNITY

print(f"Action: {imbalance.recommended_action}")
# Output: Action: High negotiation potential - expect significant concessions

print(f"Drivers: {', '.join(imbalance.key_drivers)}")
# Output: Drivers: High vacancy (20.3%), Widespread concessions (68.0%), Strong opportunity score (7.2/10)
```

---

## 🔀 Dual Data Source Strategy

### Approach 1: ApartmentIQ Only (Real-time)

Best for: Current market conditions, consumer-facing applications

```typescript
// Get latest market snapshot
const data = await apartmentIQClient.fetchMarketData('Atlanta');
const snapshot = apartmentIQClient.transformToMarketSnapshot(data);

// Run engines
const signal = await runSignalProcessing(snapshot);
const imbalance = await detectImbalance(signal);
```

**Pros:**
- Real-time data (daily updates)
- Consumer demand signals
- Negotiation intelligence
- Property-level granularity

**Cons:**
- Limited history (weeks/months)
- Consumer-focused (may miss institutional data)

---

### Approach 2: CoStar Only (Historical)

Best for: Long-term trends, institutional analysis, predictive modeling

```python
from engines.costar_signal_wrapper import CoStarSignalProcessor

processor = CoStarSignalProcessor()
signal = processor.get_market_signal(use_full_history=True)

print(f"26-year growth rate: {signal.rent_growth_rate:.2%}")
# Output: 26-year growth rate: 0.74%
```

**Pros:**
- 26 years of history
- Institutional accuracy
- Comprehensive market coverage

**Cons:**
- Quarterly updates (lags current conditions)
- No negotiation intelligence
- Submarket-level only (not property-level)

---

### Approach 3: Merged (Best of Both) ⭐

Best for: Complete picture, highest confidence, production use

```typescript
import { dataAggregator } from './services/data-aggregator';

// Get ApartmentIQ current snapshot
const apartmentIQData = await apartmentIQClient.fetchMarketData('Atlanta', 'Midtown');
const apartmentIQSnapshot = apartmentIQClient.transformToMarketSnapshot(apartmentIQData);

// Get CoStar historical snapshot
const costarSnapshot = await getCoStarSnapshot('Midtown');

// Merge with weighted confidence
const mergedSnapshot = dataAggregator.mergeSnapshots(
  [apartmentIQSnapshot, costarSnapshot],
  { conflictResolution: 'weighted' }
);

console.log(mergedSnapshot.data_sources);
// [
//   { name: 'apartmentiq', confidence: 0.92, coverage_pct: 0.6 },
//   { name: 'costar', confidence: 0.95, coverage_pct: 0.4 }
// ]

console.log(mergedSnapshot.confidence);
// 0.93 (weighted average)
```

**Pros:**
- Current + Historical context
- Highest confidence (cross-validated)
- Consumer + Institutional signals
- Proprietary intelligence layer

**Cons:**
- More complex integration
- Requires both API connections

---

## 🔐 Configuration

### Environment Variables

```bash
# ApartmentIQ API
APARTMENTIQ_API_URL=https://apartment-locator-ai.replit.app
APARTMENTIQ_API_KEY=your_api_key_here

# CoStar API (existing)
COSTAR_API_URL=...
COSTAR_API_KEY=...
```

### API Client Initialization

```typescript
// Automatic from environment variables
import { apartmentIQClient } from './services/apartmentiq-client';

// Or manual configuration
const client = new ApartmentIQClient();
client.setBaseUrl('https://custom-url.com');
client.setApiKey('custom-key');
```

---

## 📈 Data Quality

### Confidence Scoring

All data includes confidence scores (0-1):

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Sample Size | 30% | `min(properties / 20, 1)` |
| Data Freshness | 20% | `1 - (age_days / 30)` |
| Property Confidence | 50% | Average of individual property scores |

**Example:**
- 45 properties: `sample_score = 1.0` (>20 properties)
- Scraped today: `freshness = 1.0`
- Avg property confidence: `0.95`
- **Overall: `0.3*1.0 + 0.2*1.0 + 0.5*0.95 = 0.975`** ✅ High quality

---

## 🧪 Testing

### Mock Data Testing

```bash
# Test ApartmentIQ wrapper (uses mock data)
cd /home/leon/clawd/jedire/backend/python-services/engines
python apartmentiq_wrapper.py

# Expected output:
# 1. Processing Timeseries...
#    Current Rent: $1982
#    Rent Growth Rate: 10.67%
#    Market Pressure: 8.2/10
# 2. Processing Supply Metrics...
#    Total Supply: 12,543 units
# 3. Detecting Imbalance...
#    Imbalance Score: 84/100
#    Verdict: STRONG_OPPORTUNITY
```

### API Integration Testing

Once ApartmentIQ API is live:

```bash
# Set environment variable
export APARTMENTIQ_API_URL=https://apartment-locator-ai.replit.app

# Test TypeScript client
cd /home/leon/clawd/jedire/backend
npm run test:apartmentiq

# Test full integration
npm run test:integration
```

---

## 📊 Performance

### Expected Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Fetch market data | <500ms | 45 properties |
| Fetch timeseries | <300ms | 90 days weekly |
| Aggregate to submarket | <50ms | Local processing |
| Signal processing | <200ms | Python engine |
| Full analysis | <1s | End-to-end |

### Caching Strategy

```typescript
// Cache market data for 1 hour
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 });

async function getCachedMarketData(city: string, submarket: string) {
  const key = `${city}-${submarket}`;
  let data = cache.get(key);
  
  if (!data) {
    data = await apartmentIQClient.fetchMarketData(city, submarket);
    cache.set(key, data);
  }
  
  return data;
}
```

---

## 🚦 Next Steps

### Phase 1: ✅ COMPLETE
- [x] API client built (`apartmentiq-client.ts`)
- [x] Data aggregator built (`data-aggregator.ts`)
- [x] Python wrapper built (`apartmentiq_wrapper.py`)
- [x] Documentation complete

### Phase 2: IN PROGRESS (ApartmentIQ team)
- [ ] ApartmentIQ API endpoints deployed
- [ ] API authentication configured
- [ ] Test endpoints accessible

### Phase 3: READY TO START (when API is live)
- [ ] Connect to live API
- [ ] End-to-end testing
- [ ] Cache configuration
- [ ] Error handling refinement
- [ ] Production deployment

### Phase 4: FUTURE
- [ ] Real-time webhooks (property updates)
- [ ] Batch import for historical data
- [ ] Multi-city support
- [ ] Advanced analytics

---

## 📞 Support

**JEDI RE Integration:** RocketMan AI (via Leon)  
**ApartmentIQ API:** Replit deployment (Leon's team)  
**Questions:** Check this doc first, then ask Leon

---

**Status:** ✅ JEDI RE integration layer complete and ready for API connection

**Last Updated:** 2026-02-05 13:55 EST
