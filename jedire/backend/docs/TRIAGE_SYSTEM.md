# Deal Auto-Triage System

## Overview

The Deal Auto-Triage System automatically evaluates deals after creation to provide instant insight into opportunity quality. It runs a fast, rules-based analysis that produces a **0-50 score** (not 0-100) and assigns a status: **Hot**, **Warm**, **Watch**, or **Pass**.

### Key Features

- ✅ **Automatic execution** after deal creation
- ✅ **Fast scoring** (0-50 range) based on location, market, and property signals
- ✅ **Risk identification** with actionable flags
- ✅ **Strategy recommendations** tailored to deal characteristics
- ✅ **Trade area assignment** for market context
- ✅ **Geocoding integration** for address lookup

---

## Architecture

### Flow Diagram

```
Deal Created
    ↓
Auto-Triage Service
    ↓
    ├─ 1. Geocode Address
    ├─ 2. Assign Trade Area
    ├─ 3. Look Up Properties
    ├─ 4. Calculate Metrics
    ├─ 5. Score (0-50)
    ├─ 6. Identify Strategies
    ├─ 7. Flag Risks
    └─ 8. Save Result
    ↓
Notification to User
```

### Components

1. **DealTriageService.ts** - Core orchestration service
2. **Database migration 017** - Adds `triage_result` JSONB column to `deals` table
3. **API endpoint** - `POST /api/v1/deals/:id/triage`
4. **Trade Areas table** - Geographic submarkets with market metrics

---

## Scoring System

### Score Range: 0-50 (NOT 0-100)

This is a **quick triage score**, not a comprehensive JEDI score. It's designed for speed and initial filtering.

#### Score Breakdown

| Component | Points | Description |
|-----------|--------|-------------|
| **Location Signals** | 0-15 | Trade area quality, market strength, proximity |
| **Market Signals** | 0-15 | Rent growth, population growth, job growth |
| **Property Signals** | 0-20 | Property count, avg rent, occupancy, quality |
| **Total** | **0-50** | Combined triage score |

### Status Thresholds

| Score | Status | Meaning |
|-------|--------|---------|
| 35-50 | **Hot** 🔥 | Strong opportunity - move quickly |
| 25-34 | **Warm** ☀️ | Solid opportunity - proceed with diligence |
| 15-24 | **Watch** 👀 | Uncertain - monitor or explore alternatives |
| 0-14 | **Pass** ❌ | Weak opportunity - consider passing |

---

## Triage Components

### 1. Location Signals (0-15 points)

Evaluates geographic positioning and submarket strength.

**Data Sources:**
- Trade area assignment (based on deal centroid)
- Location quality score (from trade_areas table)
- Market strength score (from trade_areas table)

**Scoring:**
```
score = ((location_quality + market_strength) / 2) * 15
```

**Example:**
- Location quality: 0.90
- Market strength: 0.85
- Average: 0.875
- Score: 13/15 points ✅

### 2. Market Signals (0-15 points)

Analyzes market trends and growth dynamics.

**Data Sources:**
- Rent growth (from trade_areas table)
- Population growth (from trade_areas table)
- Job growth (from trade_areas table)

**Scoring Logic:**
```
avg_growth = (rent_growth + pop_growth + job_growth) / 3

if avg_growth > 0.06:   score = 15 (Strong Growth)
if avg_growth > 0.04:   score = 12 (Moderate Growth)
if avg_growth > 0.02:   score = 8  (Stable)
if avg_growth > 0:      score = 5  (Slow Growth)
else:                   score = 2  (Declining)
```

**Example:**
- Rent growth: 6.5%
- Population growth: 3.2%
- Job growth: 4.5%
- Average: 4.73%
- Score: 12/15 points ☀️

### 3. Property Signals (0-20 points)

Assesses comparable properties within the deal boundary.

**Data Sources:**
- Property count (from `properties` table within deal boundary)
- Average rent
- Average occupancy (estimated from lease data)
- Quality score (based on year built)

**Scoring Breakdown:**

#### Property Count (0-5 points)
```
if count >= 50:  +5 points
if count >= 20:  +4 points
if count >= 10:  +3 points
if count >= 5:   +2 points
if count > 0:    +1 point
```

#### Average Rent (0-8 points)
```
if avg_rent >= $2,500:  +8 points
if avg_rent >= $2,000:  +6 points
if avg_rent >= $1,500:  +5 points
if avg_rent >= $1,000:  +3 points
if avg_rent > $0:       +1 point
```

#### Occupancy (0-4 points)
```
score = avg_occupancy * 4
(e.g., 90% occupancy = 3.6 points)
```

#### Quality Score (0-3 points)
```
if year_built >= 2010:  quality = 0.9
if year_built >= 2000:  quality = 0.7
if year_built >= 1990:  quality = 0.5
else:                   quality = 0.3

score = quality * 3
```

**Example:**
- Property count: 25 → 4 points
- Avg rent: $1,800 → 5 points
- Occupancy: 88% → 3.5 points
- Quality: 0.7 (built in 2005) → 2.1 points
- **Total: 14.6/20 points** 👍

---

## Strategy Identification

Strategies are automatically assigned based on score, project type, and market conditions.

### Score-Based Strategies

| Score | Recommended Strategy |
|-------|---------------------|
| 35+ | • Priority Acquisition - Fast-track due diligence<br>• Aggressive Offer - Strong competition likely |
| 25-34 | • Standard Acquisition - Proceed with normal timeline<br>• Negotiate Terms - Room for favorable conditions |
| 15-24 | • Watchlist - Monitor for changes<br>• Alternative Uses - Explore creative strategies |
| 0-14 | • Pass or Creative - Significant challenges present |

### Project-Type Strategies

**Multifamily:**
- High rent (>$1,800): *Premium Positioning*
- Low rent (<$1,200): *Affordable Housing - Explore tax credits*

**Mixed-Use:**
- Always: *Mixed-Use Development - Diversify revenue streams*

**Market-Based:**
- Rent growth >6%: *Growth Play - Leverage rent appreciation*

---

## Risk Flagging

Risks are automatically identified based on thresholds.

### Common Risk Flags

| Risk | Trigger Condition | Severity |
|------|------------------|----------|
| **Low Overall Score** | Score < 15 | 🔴 High |
| **Weak Rent Growth** | Rent growth < 2% | 🟡 Medium |
| **Stagnant Population** | Pop growth < 1% | 🟡 Medium |
| **Limited Comps** | Property count < 5 | 🟡 Medium |
| **Low Occupancy** | Occupancy < 85% | 🔴 High |
| **Older Building Stock** | Quality score < 0.5 | 🟡 Medium |
| **Weak Submarket** | Market strength < 0.6 | 🟠 High |
| **High Cost Per Unit** | Cost/unit > $400k | 🟡 Medium |
| **Low Cost Per Unit** | Cost/unit < $150k | 🟡 Medium |

### Example Risk Output

```json
{
  "risks": [
    "Weak Rent Growth - Limited pricing power",
    "Limited Comparable Data - Insufficient market intel",
    "Older Building Stock - Higher renovation costs"
  ]
}
```

---

## Database Schema

### Deals Table - New Columns

```sql
ALTER TABLE deals ADD COLUMN triage_result JSONB DEFAULT NULL;
ALTER TABLE deals ADD COLUMN triage_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE deals ADD COLUMN triage_score INTEGER DEFAULT NULL;
ALTER TABLE deals ADD COLUMN triaged_at TIMESTAMP DEFAULT NULL;
ALTER TABLE deals ADD COLUMN trade_area_id UUID REFERENCES trade_areas(id);
```

### Trade Areas Table

```sql
CREATE TABLE trade_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  municipality VARCHAR(100),
  state VARCHAR(50),
  boundary GEOMETRY(POLYGON, 4326),
  
  -- Market metrics
  avg_rent_growth DECIMAL(5,4),      -- e.g., 0.0650 = 6.5%
  population_growth DECIMAL(5,4),
  job_growth DECIMAL(5,4),
  
  -- Quality scores
  location_quality_score DECIMAL(3,2),  -- 0.00 to 1.00
  market_strength_score DECIMAL(3,2),   -- 0.00 to 1.00
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Triage Result Schema (JSONB)

```json
{
  "dealId": "uuid",
  "score": 32,
  "status": "Warm",
  "metrics": {
    "locationSignals": {
      "score": 13,
      "tradeArea": "Midtown Atlanta",
      "marketStrength": 0.85,
      "proximityScore": 0.90
    },
    "marketSignals": {
      "score": 12,
      "rentGrowth": 0.065,
      "populationGrowth": 0.032,
      "jobGrowth": 0.045,
      "trendVerdict": "Moderate Growth"
    },
    "propertySignals": {
      "score": 15,
      "propertyCount": 25,
      "avgRent": 1850,
      "avgOccupancy": 0.88,
      "qualityScore": 0.70
    }
  },
  "strategies": [
    "Standard Acquisition - Proceed with normal timeline",
    "Negotiate Terms - Room for favorable conditions",
    "Premium Positioning - Target high-income renters"
  ],
  "risks": [
    "Limited Comparable Data - Insufficient market intel"
  ],
  "recommendations": [
    "Conduct detailed market research and feasibility study",
    "Engage with key stakeholders and gather community feedback",
    "Gather additional comparable data from adjacent areas"
  ],
  "tradeAreaId": "uuid",
  "geocoded": {
    "lat": 33.785,
    "lng": -84.385,
    "municipality": "Atlanta",
    "state": "GA"
  },
  "triagedAt": "2026-02-09T12:34:56Z"
}
```

---

## API Endpoints

### POST /api/v1/deals/:id/triage

Manually trigger triage for a deal.

**Request:**
```bash
curl -X POST https://api.jedire.com/api/v1/deals/123/triage \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "dealId": "123",
  "score": 32,
  "status": "Warm",
  "metrics": { ... },
  "strategies": [ ... ],
  "risks": [ ... ],
  "recommendations": [ ... ],
  "triagedAt": "2026-02-09T12:34:56Z"
}
```

### GET /api/v1/deals/:id/triage

Get cached triage result for a deal.

**Request:**
```bash
curl -X GET https://api.jedire.com/api/v1/deals/123/triage \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** Same as POST endpoint

**Error (404):**
```json
{
  "statusCode": 404,
  "message": "Deal has not been triaged yet"
}
```

---

## Automatic Execution

### When Does Auto-Triage Run?

Triage runs **automatically after deal creation** in the background:

```typescript
// In deals.service.ts - create() method

// Auto-triage the deal (async, don't block response)
this.autoTriageDeal(deal.id).catch(error => {
  console.error(`[AutoTriage] Failed for deal ${deal.id}:`, error);
});
```

### Timing

- **Async**: Doesn't block the deal creation response
- **Timing**: Typically completes in 1-3 seconds
- **Error handling**: Failures are logged but don't affect deal creation

### Activity Log

When triage completes, an activity log entry is created:

```json
{
  "action_type": "triage_completed",
  "description": "Auto-triage completed: 32/50 (Warm)",
  "metadata": {
    "score": 32,
    "status": "Warm",
    "strategies": 3,
    "risks": 1
  }
}
```

---

## Trade Area Management

Trade areas are geographic submarkets with market metrics that inform triage scoring.

### Sample Trade Areas (Atlanta)

| Name | Rent Growth | Pop Growth | Job Growth | Location Quality | Market Strength |
|------|-------------|------------|------------|------------------|-----------------|
| **Midtown Atlanta** | 6.5% | 3.2% | 4.5% | 0.90 | 0.85 |
| **Buckhead** | 5.8% | 2.8% | 3.8% | 0.95 | 0.88 |
| **Downtown Atlanta** | 4.2% | 1.5% | 2.5% | 0.75 | 0.70 |
| **Inman Park** | 7.2% | 4.5% | 5.2% | 0.82 | 0.80 |
| **Westside** | 5.5% | 3.1% | 4.0% | 0.78 | 0.75 |

### Managing Trade Areas

Trade areas are seeded via migration but can be updated:

```sql
-- Update market metrics
UPDATE trade_areas
SET avg_rent_growth = 0.0700,
    population_growth = 0.0380,
    updated_at = NOW()
WHERE name = 'Midtown Atlanta';

-- Add new trade area
INSERT INTO trade_areas (name, municipality, state, boundary, avg_rent_growth, location_quality_score, market_strength_score)
VALUES ('West Midtown', 'Atlanta', 'GA', 
        ST_GeomFromText('POLYGON(...)', 4326),
        0.0620, 0.85, 0.82);
```

---

## Testing & Validation

### Manual Test Flow

1. **Create a deal** via API or UI
2. **Wait 1-3 seconds** for auto-triage to complete
3. **GET /api/v1/deals/:id** - Check `triage_status` and `triage_score`
4. **GET /api/v1/deals/:id/triage** - View full triage result
5. **Check activity log** - Verify `triage_completed` entry

### Expected Behavior

| Scenario | Expected Score | Expected Status |
|----------|---------------|-----------------|
| Midtown, high rent, 30 comps | 35-45 | Hot |
| Suburban, moderate rent, 15 comps | 20-30 | Warm |
| Declining area, low rent, 5 comps | 10-20 | Watch |
| No comps, weak market | 0-10 | Pass |

### Logs to Monitor

```bash
# Look for these in application logs:
[Triage] Starting triage for deal <uuid>
[Triage] Using existing coordinates: 33.785, -84.385
[Triage] Assigned to trade area: <uuid>
[Triage] Completed for deal <uuid>: 32/50 (Warm)
[Triage] Saved result to database
[Triage] Logged activity
```

---

## Future Enhancements

### Planned Features

1. **Machine Learning Layer** - Train models on historical deal outcomes
2. **Dynamic Trade Areas** - Auto-generate submarkets from property clusters
3. **Competitive Intelligence** - Factor in recent sales and listings
4. **User Feedback Loop** - Learn from user overrides and adjustments
5. **Notification System** - Alert users when "Hot" deals are triaged
6. **Re-triage Trigger** - Automatically re-run when market data updates

### Integration Points

- **Email notifications** - Alert user when triage completes
- **Dashboard widget** - Show triage status on deal cards
- **Pipeline sorting** - Filter/sort deals by triage status
- **Export to PDF** - Include triage summary in deal reports

---

## Troubleshooting

### Common Issues

**Issue: "Deal has not been triaged yet"**
- **Cause:** Auto-triage failed or is still running
- **Solution:** Manually trigger via `POST /api/v1/deals/:id/triage`

**Issue: Score is always low**
- **Cause:** No properties in deal boundary or weak trade area
- **Solution:** Check deal boundary, verify properties table has data

**Issue: No trade area assigned**
- **Cause:** Deal location outside of seeded trade areas
- **Solution:** Add more trade areas to cover geographic regions

**Issue: Geocoding fails**
- **Cause:** Invalid address or Nominatim rate limit
- **Solution:** Verify address format, check Nominatim status

---

## Code References

### Key Files

- `backend/src/services/DealTriageService.ts` - Core triage logic
- `backend/src/deals/deals.service.ts` - Integration with deal creation
- `backend/src/deals/deals.controller.ts` - API endpoints
- `backend/src/database/migrations/017_deal_triage_system.sql` - Database schema
- `backend/docs/TRIAGE_SYSTEM.md` - This documentation

### Database Functions

- `find_trade_area(lat, lng)` - Find trade area for coordinates
- `assign_deal_trade_area(deal_id)` - Auto-assign trade area to deal

---

## Summary

The Deal Auto-Triage System provides instant, data-driven insights into deal quality with:

✅ **0-50 scoring** (location + market + property signals)  
✅ **Status assignment** (Hot/Warm/Watch/Pass)  
✅ **Risk identification** with actionable flags  
✅ **Strategy recommendations** tailored to deal type  
✅ **Automatic execution** after deal creation  
✅ **Trade area integration** for market context  

This allows users to quickly prioritize deals and focus on the strongest opportunities.
