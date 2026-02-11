# Pro Forma Adjustments System

**Phase 2, Component 1: News Intelligence Integration with Financial Models**

## Overview

The Pro Forma Adjustments system automatically adjusts financial model assumptions based on real-time news intelligence. News events (employment changes, development activity, regulatory shifts) trigger recalculations of key assumptions like rent growth, vacancy rates, and cap rates.

**Key Innovation:** Dual-layer assumptions (baseline always visible) with full audit trail from news event → adjustment → financial impact.

## Architecture

```
News Event → Geographic Assignment → Demand Signal → Pro Forma Adjustment
     ↓              ↓                      ↓                  ↓
  headline    trade area impact    housing demand    rent growth +1.2%
  Amazon       Lawrenceville         880 units       vacancy -8.8%
  4,500 jobs   5.2 miles away        0.40 conversion exit cap -0.15%
```

### Data Flow

1. **News Event Extracted** → Event category, employee count, location
2. **Geographic Assignment** → Determine affected trade areas and impact scores
3. **Demand Signal Generation** → Convert to quantified housing demand (units)
4. **Pro Forma Calculation** → Apply adjustment formulas to assumptions
5. **Audit Trail Created** → Link adjustment back to source news event

## Database Schema

### Core Tables

#### `proforma_assumptions`
Stores baseline and current (news-adjusted) values for all assumptions.

```sql
- deal_id (FK to deals)
- strategy ('rental', 'build_to_sell', 'flip', 'airbnb')
- rent_growth_baseline, rent_growth_current, rent_growth_user_override
- vacancy_baseline, vacancy_current, vacancy_user_override
- opex_growth_baseline, opex_growth_current, opex_growth_user_override
- exit_cap_baseline, exit_cap_current, exit_cap_user_override
- absorption_baseline, absorption_current, absorption_user_override
- last_recalculation timestamp
```

**Layer Precedence:** User Override > News-Adjusted > Baseline

#### `assumption_adjustments`
Individual adjustments triggered by news events.

```sql
- proforma_id (FK)
- news_event_id, demand_event_id (FK to source events)
- adjustment_trigger ('news_event', 'demand_signal', 'manual', 'periodic_update')
- assumption_type ('rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption')
- previous_value, new_value, adjustment_delta (calculated)
- calculation_method ('demand_supply_elasticity', etc.)
- calculation_inputs (JSONB with all formula inputs)
- confidence_score (0-100)
```

#### `adjustment_history`
Time-series snapshots for historical comparison.

```sql
- proforma_id (FK)
- snapshot_data (JSONB with all assumption values at point in time)
- trigger_type ('calculation', 'user_override', 'baseline_update', 'export')
- created_at
```

#### `adjustment_formulas`
Configurable calculation formulas (admin-editable).

```sql
- formula_name (unique)
- assumption_type
- formula_expression
- parameters (JSONB with defaults)
- trigger_thresholds (when to apply)
- min_adjustment, max_adjustment (constraints)
```

## Adjustment Formulas

### 1. Rent Growth Rate

**Formula:** `Demand-Supply Delta (%) × Rent Elasticity`

**Parameters:**
- Rent Elasticity: 0.5 (loose market) to 1.2 (tight market)
- Default: 0.8

**Triggers:**
- Demand signal change > ±5%
- Supply pipeline change > 200 units

**Example:**
```
Scenario: Amazon announces 4,500 jobs in trade area
- Trade area existing units: 10,000
- Housing demand (4,500 × 0.40 conversion): 1,800 units
- Demand delta: +18% of inventory
- Market tightness: 0.95 (tight)
- Rent elasticity: 1.2 (tight market)

Calculation:
18% × 1.2 = +21.6% → capped at +5% max → +5% adjustment
Baseline rent growth: 3.5%
New rent growth: 8.5% (3.5 + 5.0)
```

**Implementation:**
```typescript
const adjustment = demandDeltaPct * elasticity;
const constrainedAdjustment = Math.max(-5, Math.min(5, adjustment));
const newValue = baseline + constrainedAdjustment;
```

### 2. Vacancy Rate

**Formula:** `(Employee Count × Housing Conversion Rate) ÷ Total Inventory × 100`

**Parameters:**
- Housing Conversion Rate: 0.40 (standard employment)
- Occupancy Factor: 0.95

**Triggers:**
- Major employer entry/exit (>500 employees)
- Large supply delivery within 6 months

**Example:**
```
Scenario: Amazon 4,500 jobs
- Conversion rate: 0.40
- Occupancy factor: 0.95
- Housing demand: 4,500 × 0.40 × 0.95 = 1,710 units
- Total inventory: 10,000 units
- Vacancy impact: (1,710 / 10,000) × 100 = 17.1%
- Adjustment: -17.1% (negative because demand reduces vacancy)
- Capped: -15% max → -15% adjustment

Baseline vacancy: 5.0%
New vacancy: -10.0% → adjusted to 0% (can't go negative)
```

**Edge Case Handling:**
- Vacancy can never go below 0% or above 100%
- Large negative adjustments are capped to prevent unrealistic results

### 3. Operating Expense Growth

**Formula:** Direct pass-through of announced changes

**Parameters:**
- None (direct from news)

**Triggers:**
- Insurance market shift
- Tax reassessment announcement
- Utility rate change

**Example:**
```
Scenario: Georgia insurance rates increase 8% due to hurricane risk
- Announced change: +8%
- Direct pass-through: +8%
- Capped at max: +8% (within ±20% range)

Baseline opex growth: 2.8%
New opex growth: 10.8% (2.8 + 8.0)
```

**News Extraction:**
```json
{
  "event_category": "regulatory",
  "event_type": "insurance_rate_change",
  "extracted_data": {
    "expense_change_pct": 8.0,
    "effective_date": "2026-07-01"
  }
}
```

### 4. Exit Cap Rate

**Formula:** `Baseline + Momentum Adjustment (bps) + Risk Premium`

**Parameters:**
- Momentum compression: -10 to -25 basis points (strong markets)
- Risk premium: ±50 basis points

**Triggers:**
- Market momentum score > 55
- Risk signal trend

**Example:**
```
Scenario: Strong market momentum (score: 65)
- Momentum factor: (65 - 50) / 50 = 0.30
- Compression bps: -25 + (0.30 × (-10 - (-25))) = -25 + 4.5 = -20.5 bps
- Compression pct: -0.205%
- Risk premium: 0% (neutral)

Baseline exit cap: 5.50%
New exit cap: 5.295% (5.50 - 0.205)
```

**Cap Rate Intuition:**
- Strong momentum = lower cap rate (cap compression)
- Investors willing to accept lower yields in hot markets

### 5. Absorption Rate

**Formula:** `Baseline × (1 + Demand Delta) × (1 - Competitive Supply Factor)`

**Parameters:**
- Competitive radius: 3 miles
- Supply impact factor: 0.15 per 1,000 units

**Triggers:**
- New demand driver
- Competitive supply announcement

**Example:**
```
Scenario: Amazon 4,500 jobs + 800-unit competitor nearby
- Demand delta: +18%
- Competitive supply: 800 units within 3 miles
- Supply factor: (800 / 1,000) × 0.15 = 0.12

Calculation:
8.0 × (1 + 0.18) × (1 - 0.12)
= 8.0 × 1.18 × 0.88
= 8.31 leases/month

Baseline absorption: 8.0 leases/mo
New absorption: 8.31 leases/mo (+0.31 improvement)
```

## API Endpoints

### GET `/api/v1/proforma/:dealId`
Get current pro forma assumptions.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "dealId": "uuid",
    "strategy": "rental",
    "rentGrowth": {
      "baseline": 3.5,
      "current": 4.7,
      "userOverride": null,
      "effective": 4.7
    },
    "vacancy": {
      "baseline": 5.0,
      "current": 4.2,
      "userOverride": null,
      "effective": 4.2
    },
    ...
  }
}
```

### POST `/api/v1/proforma/:dealId/recalculate`
Trigger recalculation of all assumptions.

**Request:**
```json
{
  "triggerType": "periodic_update",
  "triggerEventId": "uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated proforma */ },
  "message": "Pro forma recalculated successfully"
}
```

### PATCH `/api/v1/proforma/:dealId/override`
User override for a specific assumption.

**Request:**
```json
{
  "assumptionType": "rent_growth",
  "value": 5.5,
  "reason": "Conservative estimate based on local market knowledge"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated proforma */ },
  "message": "rent_growth overridden successfully"
}
```

### GET `/api/v1/proforma/:dealId/comparison`
Get side-by-side baseline vs. adjusted comparison.

**Response:**
```json
{
  "success": true,
  "data": {
    "dealId": "uuid",
    "dealName": "The Metropolitan Apartments",
    "strategy": "rental",
    "baseline": { /* all baseline values */ },
    "adjusted": { /* all adjusted values */ },
    "differences": {
      "rentGrowth": 1.2,
      "vacancy": -0.8,
      "opexGrowth": 0.0,
      "exitCap": -0.15,
      "absorption": 2.5
    },
    "recentAdjustments": [ /* array of adjustments with news events */ ]
  }
}
```

### GET `/api/v1/proforma/:dealId/export?format=csv`
Export pro forma comparison.

**Formats:** `json`, `csv`, `markdown`

**CSV Output:**
```csv
Deal Name,Strategy,Assumption,Baseline,Adjusted,Difference,% Change
The Metropolitan,rental,Rent Growth,3.50%,4.70%,1.20%,34.3%
The Metropolitan,rental,Vacancy,5.00%,4.20%,-0.80%,-16.0%
...
```

## Frontend Component Usage

```tsx
import { ProFormaComparison } from '@/components/deal/ProFormaComparison';

<ProFormaComparison dealId={deal.id} />
```

**Features:**
- Side-by-side baseline vs. adjusted view
- Color-coded differences (green = favorable, red = unfavorable)
- Click assumption → see news events that changed it
- Toggle layer visibility (baseline, adjusted, overrides)
- Override modal with reason tracking
- Export to CSV/JSON/Markdown

## Integration with Existing Systems

### Kafka Integration

**Topic:** `signals.demand.updated`

**Consumer:**
```typescript
kafka.subscribe('signals.demand.updated', async (message) => {
  const { dealId, demandEventId } = message;
  
  await proformaAdjustmentService.recalculate({
    dealId,
    triggerType: 'demand_signal',
    triggerEventId: demandEventId
  });
});
```

### Geographic Assignment Integration

```sql
-- Get demand signals for a deal's trade area
SELECT de.*, taei.impact_score
FROM demand_events de
JOIN trade_area_event_impacts taei ON taei.event_id = de.news_event_id
JOIN trade_areas ta ON ta.id = taei.trade_area_id
JOIN properties p ON p.id = ta.property_id
WHERE p.deal_id = $1
  AND taei.impact_score >= 30
```

### JEDI Score Integration

Pro forma adjustments feed into JEDI Score momentum signal:
- Positive adjustments → higher momentum score
- Negative adjustments → lower momentum score
- Weighted by confidence and recency

## Test Scenarios

### Scenario 1: Amazon 4,500 Jobs → Lawrenceville

**Input:**
```json
{
  "newsEvent": {
    "headline": "Amazon to add 4,500 jobs at Lawrenceville fulfillment center",
    "category": "employment",
    "type": "major_hiring",
    "peopleCount": 4500,
    "location": "Lawrenceville, GA"
  }
}
```

**Expected Output:**
```json
{
  "adjustments": [
    {
      "assumptionType": "rent_growth",
      "adjustment": +1.2,
      "baseline": 3.5,
      "newValue": 4.7
    },
    {
      "assumptionType": "vacancy",
      "adjustment": -8.8,
      "baseline": 5.0,
      "newValue": -3.8 → adjusted to 0.5 (floor)
    }
  ]
}
```

### Scenario 2: Delta Layoffs 2,200 Jobs

**Input:**
```json
{
  "newsEvent": {
    "headline": "Delta announces 2,200 job cuts in Atlanta",
    "category": "employment",
    "type": "layoffs",
    "peopleCount": 2200,
    "location": "Atlanta Airport"
  }
}
```

**Expected Output:**
```json
{
  "adjustments": [
    {
      "assumptionType": "rent_growth",
      "adjustment": -0.6,
      "baseline": 3.5,
      "newValue": 2.9
    },
    {
      "assumptionType": "vacancy",
      "adjustment": +3.5,
      "baseline": 5.0,
      "newValue": 8.5
    }
  ]
}
```

### Scenario 3: 800-Unit Supply Delivery

**Input:**
```json
{
  "newsEvent": {
    "headline": "New 800-unit apartment complex breaks ground 2 miles away",
    "category": "development",
    "type": "construction_start",
    "unitCount": 800,
    "location": "Sandy Springs"
  }
}
```

**Expected Output:**
```json
{
  "adjustments": [
    {
      "assumptionType": "rent_growth",
      "adjustment": -0.8,
      "baseline": 3.5,
      "newValue": 2.7
    },
    {
      "assumptionType": "absorption",
      "adjustment": -1.2,
      "baseline": 8.0,
      "newValue": 6.8
    }
  ]
}
```

## Running the System

### 1. Apply Migration

```bash
cd /home/leon/clawd/jedire
psql -d jedire -f migrations/025_proforma_adjustments.sql
```

### 2. Test Service

```typescript
import { proformaAdjustmentService } from './services/proforma-adjustment.service';

// Initialize pro forma for a deal
const proforma = await proformaAdjustmentService.initializeProForma(
  'deal-uuid',
  'rental'
);

// Recalculate based on latest news
await proformaAdjustmentService.recalculate({
  dealId: 'deal-uuid',
  triggerType: 'periodic_update'
});

// Get comparison
const comparison = await proformaAdjustmentService.getComparison('deal-uuid');
```

### 3. Register API Routes

```typescript
// backend/src/api/rest/index.ts
import proformaRoutes from './proforma.routes';

app.use('/api/v1/proforma', proformaRoutes);
```

### 4. Use Frontend Component

```tsx
// In deal detail page
import { ProFormaComparison } from '@/components/deal/ProFormaComparison';

<ProFormaComparison dealId={deal.id} />
```

## Extending to Other Strategies

### Build-to-Sell

**Additional Assumptions:**
- Construction timeline (months)
- Presale velocity (sales/month)
- Market appreciation rate

**Adjustment Triggers:**
- Submarket sales velocity changes
- New competitive projects announced
- Zoning/permit changes

### Flip Strategy

**Additional Assumptions:**
- Rehab timeline (months)
- Market time (days to sell)
- ARV appreciation

**Adjustment Triggers:**
- Transaction comp changes
- Market absorption shifts
- Cost escalation news

### Airbnb Strategy

**Additional Assumptions:**
- Occupancy rate (%)
- Average Daily Rate (ADR)
- Regulatory risk score

**Adjustment Triggers:**
- Tourism/event news
- Regulatory changes (STR restrictions)
- Competing supply (new hotels, Airbnbs)

## Best Practices

### 1. Baseline Updates

Update baselines quarterly or when:
- Submarket fundamentals shift materially
- New transaction comps become available
- Historical trends change direction

### 2. User Overrides

Always require a reason:
- Encourages thoughtful overrides
- Creates audit trail for lenders/investors
- Prevents arbitrary adjustments

### 3. Confidence Scores

Use confidence to weight adjustments:
- High confidence (>80): Apply full adjustment
- Medium confidence (60-80): Apply 75% of adjustment
- Low confidence (<60): Flag for manual review

### 4. Review Cadence

- **Daily:** Automatically recalculate on new news events
- **Weekly:** Review all adjustments for reasonableness
- **Monthly:** Update baselines from market data
- **Quarterly:** Export for investor reporting

## Troubleshooting

### Adjustment Not Triggering

**Check:**
1. Does the news event meet trigger thresholds?
2. Is the event geographically assigned to the deal's trade area?
3. Is the demand signal confidence score high enough?

**Debug Query:**
```sql
SELECT ne.headline, taei.impact_score, de.total_units
FROM news_events ne
JOIN trade_area_event_impacts taei ON taei.event_id = ne.id
JOIN trade_areas ta ON ta.id = taei.trade_area_id
JOIN properties p ON p.id = ta.property_id
WHERE p.deal_id = 'your-deal-id'
  AND ne.published_at > NOW() - INTERVAL '30 days'
ORDER BY taei.impact_score DESC;
```

### Extreme Adjustments

If adjustments seem unrealistic:
1. Check calculation inputs in `calculation_inputs` JSONB
2. Review trigger thresholds in `adjustment_formulas`
3. Verify demand signal conversion rates
4. Consider adjusting min/max constraints

### Performance Issues

For large batch recalculations:
1. Use background job queue (Bull, BeeQueue)
2. Process deals in parallel (limit concurrency to 5-10)
3. Cache market baseline data
4. Index foreign keys properly

## Roadmap

### Phase 2.1: Supply Signal Integration
- Construction pipeline tracking
- Permit → delivery timeline predictions
- Competitive supply pressure scoring

### Phase 2.2: Risk Scoring
- Political/regulatory risk weights
- Concentration risk adjustments
- Insurance availability impact

### Phase 2.3: Machine Learning
- Learn adjustment weights from historical accuracy
- Predict adjustment magnitude before news extraction
- Anomaly detection for outlier adjustments

### Phase 2.4: Scenario Analysis
- Bull/base/bear case assumptions
- Monte Carlo simulation with news-driven ranges
- Sensitivity analysis by assumption type

## Support

**Documentation:** `/docs/proforma-adjustments/`
**API Reference:** `/api/v1/proforma` (OpenAPI spec)
**Examples:** `/examples/proforma-scenarios.ts`

**Questions?** Contact the JEDI RE team or file an issue in the repo.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-11  
**Status:** Production Ready (Rental Strategy)
