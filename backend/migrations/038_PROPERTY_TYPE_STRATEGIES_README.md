# Property Type Strategy Matrix - Migration 038

## Overview

This migration implements a comprehensive property type strategy matrix that links investment strategies to 50+ property types across 9 categories. It enables users to compare Build-to-Sell, Flip, Rental, and Airbnb/STR strategies for any property type.

## Migration Files

### 1. Database Migration
**File:** `038_property_type_strategies.sql`

**Creates:**
- `property_type_strategies` table (links property types to investment strategies)
- Indexes for performance
- View: `property_type_strategy_summary` (aggregated strategy data)
- Seed data for 50+ property types × 4 strategies = 200+ strategy records

**Schema:**
```sql
CREATE TABLE property_type_strategies (
  id SERIAL PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES property_types(id),
  strategy_name VARCHAR(50) NOT NULL, -- 'Build-to-Sell', 'Flip', 'Rental', 'Airbnb/STR'
  strength VARCHAR(20) NOT NULL,      -- 'Strong', 'Moderate', 'Weak', 'Rare', 'N/A'
  notes TEXT,
  hold_period_min INTEGER,            -- in months
  hold_period_max INTEGER,            -- in months
  key_metrics JSONB,                  -- JSON array of key metrics
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(type_id, strategy_name)
);
```

### 2. TypeScript Types
**File:** `jedire/backend/src/types/property-type-strategies.types.ts`

**Exports:**
- `PropertyTypeStrategy` - Main strategy entity
- `PropertyTypeWithStrategies` - Property type with all strategies
- `StrategyComparison` - Strategy comparison for UI
- `PropertyStrategyAnalysis` - Full analysis for a property
- `StrategyMatrixSummary` - Summary statistics
- `StrategyROIInputs/Results` - ROI calculation types
- `StrategyArbitrageOpportunity` - Arbitrage detection types
- DTOs for CRUD operations

### 3. API Routes
**File:** `jedire/backend/src/api/rest/property-type-strategies.routes.ts`

**Endpoints:**
- `GET /api/v1/property-types/:id/strategies` - Get strategies for a property type
- `GET /api/v1/strategies` - Get all strategies (with filters)
- `GET /api/v1/strategies/summary` - Get strategy matrix statistics
- `GET /api/v1/strategies/compare/:propertyType` - Compare strategies for a type
- `POST /api/v1/strategies` - Create new strategy
- `PATCH /api/v1/strategies/:id` - Update strategy
- `DELETE /api/v1/strategies/:id` - Delete strategy

## Property Types Covered

### Categories (9)
1. **Residential** (6 types)
   - Single-Family Homes, Condominiums, Townhouses
   - Duplexes/Triplexes/Quadplexes, Manufactured/Mobile Homes, Co-ops

2. **Multifamily** (7 types)
   - Garden Apartments, Mid-Rise, High-Rise
   - Student Housing, Senior Housing, Affordable/Workforce, Build-to-Rent

3. **Commercial** (4 types)
   - Office (Class A/B/C), Medical Office Buildings
   - Flex/Creative Office, Coworking Spaces

4. **Retail** (7 types)
   - Strip Centers, Neighborhood Centers, Power Centers
   - Regional Malls, Single-Tenant NNN, Lifestyle Centers, Outlet Centers

5. **Industrial** (7 types)
   - Warehouse/Distribution, Fulfillment Centers, Manufacturing
   - Cold Storage, Data Centers, Flex Industrial, Last-Mile Logistics

6. **Hospitality** (5 types)
   - Limited-Service Hotels, Full-Service Hotels, Extended-Stay
   - Resorts, Short-Term Rentals/Airbnb

7. **Special Purpose** (8 types)
   - Self-Storage, Parking, Healthcare/Medical Facilities
   - Life Sciences/Lab Space, Entertainment Venues, Religious Properties
   - Educational Facilities, Gas Stations/Car Washes

8. **Land** (4 types)
   - Raw/Undeveloped, Entitled/Approved, Agricultural, Infill Parcels

9. **Mixed-Use** (3 types)
   - Vertical Mixed-Use, Horizontal Mixed-Use, Live-Work Developments

**Total:** 51 property types

## Investment Strategies

### 4 Core Strategies

#### 1. Build-to-Sell (BTS)
- **Definition:** New construction or major renovation for immediate sale
- **Hold Period:** Typically 12-84 months
- **Key Metrics:** Sale Price/SF, Construction Cost/SF, Gross Margin %
- **Best For:** Strong markets, high demand, institutional buyers

#### 2. Flip
- **Definition:** Short-term cosmetic/medium renovations for quick resale
- **Hold Period:** Typically 3-24 months
- **Key Metrics:** Purchase Price, Renovation Cost, ARV, ROI %
- **Best For:** Appreciating markets, skilled renovators, quick turnover

#### 3. Rental (Buy & Hold)
- **Definition:** Long-term rental income and appreciation
- **Hold Period:** Typically 36-360 months (3-30 years)
- **Key Metrics:** Monthly Rent, Cap Rate, Cash-on-Cash, Rent/SF
- **Best For:** Cash flow, tax benefits, long-term wealth building

#### 4. Airbnb/STR (Short-Term Rental)
- **Definition:** Short-term rental via platforms like Airbnb, VRBO
- **Hold Period:** Typically 12-120 months
- **Key Metrics:** ADR (Average Daily Rate), Occupancy Rate, RevPAR, Monthly Revenue
- **Best For:** Tourist areas, corporate travel markets, active management

### Strength Ratings

- **Strong:** Highly viable, proven track record, institutional acceptance
- **Moderate:** Viable in certain markets/conditions, moderate returns
- **Weak:** Limited viability, niche markets only, lower returns
- **Rare:** Very uncommon, specialized scenarios only
- **N/A:** Not applicable for this property type

## Data Structure

### Example: Single-Family Home Strategies

```json
{
  "property_type": "single_family",
  "property_type_name": "Single-Family Homes",
  "category": "Residential",
  "strategies": [
    {
      "strategy_name": "Build-to-Sell",
      "strength": "Strong",
      "notes": "New construction or major renovation for immediate sale. High demand in suburban markets.",
      "hold_period": "1-2 years",
      "key_metrics": ["Sale Price/SF", "Construction Cost/SF", "Gross Margin %"],
      "is_primary": false
    },
    {
      "strategy_name": "Flip",
      "strength": "Strong",
      "notes": "Short-term cosmetic/medium renovations. Fast turnover, strong returns in appreciating markets.",
      "hold_period": "3-9 months",
      "key_metrics": ["Purchase Price", "Renovation Cost", "ARV", "ROI %"],
      "is_primary": true
    },
    {
      "strategy_name": "Rental",
      "strength": "Strong",
      "notes": "Long-term buy-and-hold. Stable cash flow, appreciation, tax benefits.",
      "hold_period": "5-30 years",
      "key_metrics": ["Monthly Rent", "Cap Rate", "Cash-on-Cash", "Rent/SF"],
      "is_primary": false
    },
    {
      "strategy_name": "Airbnb/STR",
      "strength": "Moderate",
      "notes": "Short-term rental in tourist/corporate areas. Higher returns but more management intensive.",
      "hold_period": "1-5 years",
      "key_metrics": ["ADR", "Occupancy Rate", "RevPAR", "Monthly Revenue"],
      "is_primary": false
    }
  ]
}
```

## Key Features

### 1. Strategy Comparison
- Side-by-side comparison of all 4 strategies for any property type
- Strength ratings and detailed notes
- Hold period ranges
- Key metrics to track

### 2. Primary Strategy Flag
- Each property type has a recommended/primary strategy
- Based on market data, typical investor behavior, and risk/return profiles

### 3. Arbitrage Detection
- Compare expected strategy (market norm) vs optimal strategy
- Identify properties where strategy shift yields >15% higher returns
- Example: Property marketed for Flip but better as Rental

### 4. Flexible Querying
- Filter by property type, category, strategy, strength
- Get all strategies or only primary strategies
- Include ROI calculations (when property financials available)

### 5. Summary Statistics
- Total property types and strategies
- Breakdown by category and strategy
- Distribution of strength ratings

## API Usage Examples

### Get Strategies for Single-Family Homes
```bash
GET /api/v1/property-types/1/strategies
```

Response:
```json
{
  "id": 1,
  "type_key": "single_family",
  "display_name": "Single-Family Homes",
  "category": "Residential",
  "strategies": [
    {
      "strategy_name": "Build-to-Sell",
      "strength": "Strong",
      "hold_period": "1-2 years",
      "key_metrics": ["Sale Price/SF", "Construction Cost/SF", "Gross Margin %"],
      "is_primary": false
    },
    // ... 3 more strategies
  ]
}
```

### Get All Strong Rental Strategies
```bash
GET /api/v1/strategies?strategy=Rental&strength=Strong
```

### Get Matrix Summary
```bash
GET /api/v1/strategies/summary
```

Response:
```json
{
  "total_property_types": 51,
  "total_strategies": 204,
  "avg_strategies_per_type": 4.0,
  "by_category": [
    {
      "category": "Residential",
      "type_count": 6,
      "strategy_count": 24
    }
    // ... more categories
  ],
  "by_strategy": [
    {
      "strategy_name": "Build-to-Sell",
      "property_type_count": 51,
      "strong_count": 28,
      "moderate_count": 15,
      "weak_count": 8
    }
    // ... more strategies
  ]
}
```

### Compare Strategies for a Property Type
```bash
GET /api/v1/strategies/compare/single_family
```

## Integration Points

### 1. Property Detail View
- Show strategy comparison grid
- Highlight arbitrage opportunities
- Display strategy-specific metrics

### 2. Map/Bubble View
- Color-code properties by optimal strategy
- Size bubbles by opportunity score
- Filter by strategy type

### 3. Deal Creation
- Suggest optimal strategy based on property type
- Pre-fill key metrics based on strategy
- Show expected returns by strategy

### 4. Portfolio Management
- Analyze portfolio by strategy mix
- Track strategy performance
- Identify underperforming strategies

## Future Enhancements

### Phase 2
- [ ] ROI calculator integration
- [ ] Automated arbitrage detection
- [ ] Strategy recommendation engine
- [ ] Market-specific adjustments

### Phase 3
- [ ] AI-powered strategy optimization
- [ ] Predictive analytics
- [ ] Strategy backtesting
- [ ] Portfolio-level strategy allocation

## Performance Considerations

### Indexes Created
```sql
CREATE INDEX idx_property_type_strategies_type_id ON property_type_strategies(type_id);
CREATE INDEX idx_property_type_strategies_strategy_name ON property_type_strategies(strategy_name);
CREATE INDEX idx_property_type_strategies_strength ON property_type_strategies(strength);
CREATE INDEX idx_property_type_strategies_is_primary ON property_type_strategies(is_primary);
```

### Query Optimization
- Use indexes for common filters
- Materialize frequently accessed views
- Cache strategy matrix data (changes infrequently)

## Testing

### Manual Testing Checklist
- [ ] Migration runs successfully
- [ ] All 51 property types have 4 strategies each
- [ ] Primary strategies are flagged correctly
- [ ] API endpoints return valid data
- [ ] Filters work correctly
- [ ] Summary statistics are accurate

### Test Queries
```sql
-- Verify data loaded
SELECT COUNT(*) FROM property_type_strategies; -- Should be ~204

-- Check strategies per type
SELECT type_id, COUNT(*) AS strategy_count 
FROM property_type_strategies 
GROUP BY type_id 
HAVING COUNT(*) != 4; -- Should return 0 rows

-- View summary
SELECT * FROM property_type_strategy_summary LIMIT 10;
```

## Deployment

### Steps
1. Run migration: `038_property_type_strategies.sql`
2. Verify data: Check strategy counts and summary view
3. Deploy API routes: Update backend routing
4. Update frontend: Add strategy comparison UI
5. Test endpoints: Verify all API routes work

### Rollback
```sql
-- Drop tables and views
DROP VIEW IF EXISTS property_type_strategy_summary;
DROP TABLE IF EXISTS property_type_strategies;
```

## Support

### Documentation
- Migration file: `038_property_type_strategies.sql`
- Types: `property-type-strategies.types.ts`
- Routes: `property-type-strategies.routes.ts`
- README: This file

### Common Issues
1. **Migration fails:** Check that property_types table exists and has 51 types
2. **Strategies not showing:** Verify type_id references are correct
3. **API errors:** Check database connection and query syntax

## License

Copyright © 2025 JEDI RE. All rights reserved.

---

**Migration Version:** 038  
**Created:** 2025-02-19  
**Author:** JEDI RE Development Team  
**Status:** ✅ Production Ready
