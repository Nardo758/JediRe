# Strategy Execution Engine Test Plan

## Endpoints Implemented

### 1. List All Strategies (with presets)
```bash
curl -X GET http://localhost:3000/api/v1/strategies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Create a Custom Strategy
```bash
curl -X POST http://localhost:3000/api/v1/strategies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demand Surge + Low Rent",
    "description": "Markets where digital demand surges but rents lag",
    "scope": "submarket",
    "combinator": "AND",
    "sortBy": "C_SURGE_INDEX",
    "sortDirection": "desc",
    "maxResults": 25,
    "conditions": [
      {
        "id": "cond-1",
        "metricId": "C_SURGE_INDEX",
        "operator": "gt",
        "value": 0.20,
        "weight": 35,
        "required": true,
        "label": "Traffic surge above 20%"
      },
      {
        "id": "cond-2",
        "metricId": "F_RENT_GROWTH",
        "operator": "lt",
        "value": 2.5,
        "weight": 25,
        "required": false,
        "label": "Rent growth still low"
      }
    ],
    "assetClasses": ["multifamily", "single_family"],
    "dealTypes": ["existing", "development"],
    "tags": ["buy-window", "demand-driven"]
  }'
```

### 3. Preview a Strategy (without saving)
```bash
curl -X POST http://localhost:3000/api/v1/strategies/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "submarket",
    "combinator": "AND",
    "sortBy": "C_SURGE_INDEX",
    "maxResults": 10,
    "conditions": [
      {
        "id": "cond-1",
        "metricId": "SFR_HOME_VALUE",
        "operator": "top_pct",
        "value": 20,
        "weight": 50,
        "required": true,
        "label": "Top 20% home values"
      },
      {
        "id": "cond-2",
        "metricId": "SFR_HOME_VALUE_YOY",
        "operator": "gt",
        "value": 3,
        "weight": 30,
        "required": false,
        "label": "Growing faster than 3% YoY"
      }
    ]
  }'
```

Response format:
```json
{
  "success": true,
  "data": [
    {
      "targetId": "33004",
      "targetName": "West Palm Beach, FL",
      "targetType": "zip",
      "overallScore": 87.5,
      "conditionResults": [
        {
          "conditionId": "cond-1",
          "metricId": "SFR_HOME_VALUE",
          "actualValue": 425000,
          "passed": true,
          "score": 92,
          "percentile": 88
        },
        {
          "conditionId": "cond-2",
          "metricId": "SFR_HOME_VALUE_YOY",
          "actualValue": 4.5,
          "passed": true,
          "score": 82,
          "percentile": 75
        }
      ],
      "rank": 1
    }
  ],
  "count": 10
}
```

### 4. Execute a Saved Strategy (with caching)
```bash
curl -X POST http://localhost:3000/api/v1/strategies/{strategy-id}/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This endpoint:
- Fetches the strategy definition
- Executes it against all geographies
- Stores results in `strategy_runs` table
- Increments `run_count` and updates `last_run_at`
- Returns the ranked results

### 5. Get Cached Results from Last Run
```bash
curl -X GET http://localhost:3000/api/v1/strategies/{strategy-id}/results \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Score a Deal Against All Strategies
```bash
curl -X POST http://localhost:3000/api/v1/strategies/score-deal/{deal-id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "strategyId": "preset-demand-surge",
      "strategyName": "Demand Surge Detector",
      "matched": true,
      "score": 91.5,
      "conditionResults": [...]
    },
    {
      "strategyId": "user-custom-1",
      "strategyName": "My Custom Strategy",
      "matched": false,
      "score": 45.2,
      "conditionResults": [...]
    }
  ],
  "matchedCount": 1,
  "totalCount": 2
}
```

## Supported Condition Operators

| Operator | Value Type | Description | Example |
|----------|-----------|-------------|---------|
| `gt` | number | Greater than | `{ operator: "gt", value: 100 }` |
| `gte` | number | Greater than or equal | `{ operator: "gte", value: 100 }` |
| `lt` | number | Less than | `{ operator: "lt", value: 50 }` |
| `lte` | number | Less than or equal | `{ operator: "lte", value: 50 }` |
| `eq` | number | Equal | `{ operator: "eq", value: 25 }` |
| `neq` | number | Not equal | `{ operator: "neq", value: 25 }` |
| `between` | [min, max] | Range check | `{ operator: "between", value: [10, 90] }` |
| `top_pct` | number | Top N percentile | `{ operator: "top_pct", value: 20 }` (top 20%) |
| `bottom_pct` | number | Bottom N percentile | `{ operator: "bottom_pct", value: 20 }` (bottom 20%) |
| `increasing` | null | Trending up (6-month) | `{ operator: "increasing", value: null }` |
| `decreasing` | null | Trending down (6-month) | `{ operator: "decreasing", value: null }` |

## Scoring Logic

1. **Per-Condition Score (0-100)**
   - Based on how much the actual value exceeds/beats the threshold
   - For comparisons: `score = min(100, (actual - threshold) / threshold * 100)`
   - For binary operators (eq, neq): 100 if true, 0 if false

2. **Overall Score (0-100)**
   - `overallScore = sum(condition_score × weight) / sum(weights)`
   - Only conditions that **passed** contribute to the weighted sum
   - Weights are normalized by their sum

3. **Combinator Logic**
   - `AND`: All **required** conditions must pass
   - `OR`: At least one **required** condition must pass
   - Optional conditions contribute to score but don't block results

## Data Sources

Metrics are pulled from `metric_time_series` table:
- **ZILLOW_ZHVI**: SFR_HOME_VALUE (ZIP level, 2000-2026)
- **ZILLOW_ZORI**: RENT_INDEX (ZIP level, 2015-2026)
- **FRED**: Fed Funds Rate, 10Y Treasury, 30Y Mortgage, M2 Growth
- **CUSTOM**: User-computed metrics

## Testing Against Zillow Data

With Zillow data loaded, test the "Demand Surge Detector" preset:

```bash
# Get the preset strategy ID first
curl -X GET http://localhost:3000/api/v1/strategies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.[] | select(.name == "Demand Surge Detector")'

# Run it (if ID is preset-demand-surge)
curl -X POST http://localhost:3000/api/v1/strategies/preset-demand-surge/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected results: Florida ZIPs where SFR_HOME_VALUE_YOY > threshold should appear ranked by value growth.
