# Correlation Engine Enhancement - Testing Guide

## Overview
The correlation engine has been enhanced to compute time series correlations from the `metric_time_series` table, which contains rent, home values, rates, employment, wages, and population data for Florida geographies.

## Implementation Summary

### New Methods in `CorrelationEngineService`

1. **`async computeTimeSeriesCorrelations(geographyType: string, geographyId: string, windowMonths: number = 36): Promise<void>`**
   - Queries metrics with sufficient data (>= 24 data points)
   - Computes Pearson correlation coefficient for each metric pair
   - Computes cross-correlation with lags from -12 to +12 months
   - Calculates p-values using t-distribution approximation
   - Inserts/updates results in `metric_correlations` table
   - Logs progress with geography name

2. **`async getCorrelations(geographyType: string, geographyId: string): Promise<MetricCorrelation[]>`**
   - Retrieves pre-computed correlations from `metric_correlations` table
   - Returns results sorted by absolute correlation coefficient (strongest first)

### New Endpoints

1. **Admin Endpoint: `POST /api/v1/admin/correlations/compute`**
   ```json
   {
     "geographyType": "county",
     "geographyId": "12081"  // OR omit geographyId and use:
     // "all": true
   }
   ```
   - Computes correlations for a specific geography OR all FL counties
   - Returns success status with count of computed correlations

2. **Public Endpoint: `GET /api/v1/correlations/:geographyType/:geographyId`**
   - Returns pre-computed correlations for the specified geography
   - Returns array of MetricCorrelation objects ordered by correlation strength

## Test Commands

Once the backend server and database are running:

### 1. Compute correlations for Manatee County (12081)
```bash
curl -X POST http://localhost:4000/api/v1/admin/correlations/compute \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_ADMIN_API_KEY>" \
  -d '{
    "geographyType": "county",
    "geographyId": "12081"
  }' | jq
```

### 2. Compute correlations for Hillsborough County (12057)
```bash
curl -X POST http://localhost:4000/api/v1/admin/correlations/compute \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_ADMIN_API_KEY>" \
  -d '{
    "geographyType": "county",
    "geographyId": "12057"
  }' | jq
```

### 3. Compute correlations for all FL counties (background operation)
```bash
curl -X POST http://localhost:4000/api/v1/admin/correlations/compute \
  -H "Content-Type: application/json" \
  -H "x-api-key: <YOUR_ADMIN_API_KEY>" \
  -d '{
    "geographyType": "county",
    "all": true
  }' | jq
```

### 4. Retrieve correlations for Manatee County
```bash
curl http://localhost:4000/api/v1/correlations/county/12081 | jq
```

### 5. Retrieve correlations for Hillsborough County
```bash
curl http://localhost:4000/api/v1/correlations/county/12057 | jq
```

## Expected Response Format

### Compute Response
```json
{
  "success": true,
  "message": "Computed 28 correlations for Manatee County"
}
```

### Get Correlations Response
```json
{
  "success": true,
  "count": 28,
  "data": [
    {
      "id": 1,
      "metric_a": "RENT_GROWTH",
      "metric_b": "POPULATION",
      "geography_type": "county",
      "geography_id": "12081",
      "window_months": 36,
      "correlation_r": 0.82,
      "lead_lag_months": 3,
      "p_value": 0.0001,
      "sample_size": 36,
      "computed_at": "2026-03-14T13:34:00Z"
    },
    ...
  ]
}
```

## Data Flow

1. **Input**: `metric_time_series` table contains monthly time series for:
   - Rent growth
   - Home values
   - Interest rates
   - Employment levels
   - Wage growth
   - Population

2. **Processing**:
   - Aligns time series by period_date
   - Computes correlation coefficient (r)
   - Tests lag relationships (-12 to +12 months)
   - Calculates statistical significance (p-value)

3. **Output**: `metric_correlations` table stores:
   - Metric pair identifiers
   - Correlation strength (r value)
   - Lead-lag relationship (months)
   - Statistical significance (p-value)
   - Sample size (number of aligned data points)

## Database Schema

### metric_correlations Table
```sql
CREATE TABLE metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,
  correlation_r REAL NOT NULL,
  lead_lag_months INTEGER,
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_a, metric_b, geography_type, geography_id, window_months)
);
```

## Implementation Details

### Pearson Correlation Computation
- Formula: r = Σ(x - x̄)(y - ȳ) / √[Σ(x - x̄)² × Σ(y - ȳ)²]
- Normalized to range [-1, 1]
- Values closer to ±1 indicate stronger correlation

### Lead-Lag Analysis
- Tests shifts of metric A from -12 to +12 months
- Identifies which metric leads the other
- Returns lag with strongest absolute correlation

### P-Value Calculation
- Uses t-distribution approximation
- Formula: t = r × √(n-2) / √(1-r²)
- Two-tailed test for statistical significance
- Lower p-value = higher confidence in correlation

## Existing Methods (Unchanged)

The following methods continue to work as before:
- `computeCorrelations(city, state)` - Computes snapshot-based correlations
- `computeForProperty(propertyId, city, state)` - Returns correlations for a property
- All COR-01 through COR-20 computations remain unchanged

## Notes

- Minimum 24 data points required per metric per geography
- 36-month (3-year) window used for correlation computation
- Results are upserted (INSERT ... ON CONFLICT DO UPDATE)
- Computation is idempotent - safe to re-run for same geography
- Lead-lag detection helps identify leading economic indicators
