# Strategy Engine Setup Guide

This guide explains how to set up the Strategy Engine tables and seed data for the JediRe platform.

## Overview

The Strategy Engine requires 5 core database tables:
- `geographies` — Market/submarket/property location data
- `metric_time_series` — Historical market metrics (demand, supply, trends)
- `strategy_definitions` — Strategy rules and conditions (preset + user-created)
- `strategy_runs` — Execution history and results
- `metric_correlations` — Computed correlation data between metrics

## Setup Process

### Step 1: Run Database Migrations

The migration file `130_strategy_engine_tables.sql` creates all required tables with proper indexes.

```bash
npm run migrate
```

This will create:
- `geographies` table with location data
- `metric_time_series` table with optimized indexes for metric lookups
- `strategy_definitions` table for storing strategies
- `strategy_runs` table for tracking executions
- `metric_correlations` table for metric relationships

### Step 2: Complete Setup (Recommended)

Run the automated setup script that handles presets and geographies:

```bash
npm run setup-strategy-engine
```

This script will:
1. ✓ Verify all tables exist (from migration)
2. ✓ Seed 5 preset strategies
3. ✓ Seed Florida counties and MSAs
4. ✓ Display data status

### Alternative: Manual Setup

If you prefer manual control:

#### Seed Preset Strategies
```bash
npm run seed-presets
```

Seeds 5 preset strategies:
- **Build-to-Sell** — Development in pipeline-constrained markets
- **Fix & Flip / Value-Add** — High cap rates with rent growth
- **Stabilized Rental / Hold** — Stable markets for long-term holds
- **Short-Term Rental / Airbnb** — High traffic, demand-driven markets
- **Demand Surge Detector** — Markets with early demand signals

#### Seed Florida Geographies
```bash
npm run seed-florida
```

Populates the `geographies` table with:
- 67 Florida counties with FIPS codes and centroids
- County names, latitude/longitude coordinates

## Full Setup with Migration (All-In-One)

To set up everything from scratch in Replit:

```bash
# 1. Start database (if not running)
npm run dev  # This starts the server and database

# In another shell:
# 2. Run migration
npm run migrate

# 3. Run setup
npm run setup-strategy-engine
```

## Verification

After setup, verify everything is working:

```sql
-- Check presets
SELECT COUNT(*) FROM strategy_definitions WHERE type = 'preset';

-- Check geographies
SELECT type, COUNT(*) FROM geographies GROUP BY type;

-- Check metrics (will be 0 until data is ingested)
SELECT COUNT(*) FROM metric_time_series;
```

Or use the API:

```bash
curl http://localhost:3000/api/v1/strategies
```

Should return the 5 preset strategies.

## Data Ingestion (Next Steps)

The metric ingestion services require external data sources:
- **Zillow ZHVI/ZORI** — Home value and rent indexes
- **Traffic/Demand Signals** — Desktop traffic, search volume
- **Employment Data** — Census ACS, BLS
- **Supply Metrics** — Permit data, construction pipeline

These are handled separately in the market intelligence modules (M03-M07).

## Troubleshooting

### Migration Fails with "Table already exists"
- The `IF NOT EXISTS` clause prevents errors on re-runs
- Drop and recreate tables manually if needed:
  ```sql
  DROP TABLE IF EXISTS metric_correlations, strategy_runs, strategy_definitions, metric_time_series, geographies CASCADE;
  ```
- Then re-run `npm run migrate`

### No presets appear
- Verify migration ran successfully
- Run `npm run setup-strategy-engine` to seed presets
- Check logs for SQL errors

### Geographies are empty
- Run `npm run seed-florida` to add Florida data
- For other states, custom seed scripts are needed

### Metrics are empty
- This is expected — no data ingestion has run yet
- Market intelligence modules will populate this data
- See sessions M03-M07 for ingestion scripts

## Database Schema

### geographies
```sql
CREATE TABLE geographies (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,        -- 'county', 'metro', 'msa', 'city', 'zip'
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);
```

### metric_time_series
```sql
CREATE TABLE metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,
  period_type VARCHAR(10) DEFAULT 'monthly',
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes optimized for metric lookups and latest value queries
```

### strategy_definitions
```sql
CREATE TABLE strategy_definitions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',        -- 'preset' or 'custom'
  scope VARCHAR(20) DEFAULT 'submarket',    -- 'property', 'submarket', 'metro'
  conditions JSONB NOT NULL DEFAULT '[]',
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### strategy_runs
```sql
CREATE TABLE strategy_runs (
  id UUID PRIMARY KEY,
  strategy_id UUID REFERENCES strategy_definitions(id) ON DELETE CASCADE,
  user_id UUID,
  scope VARCHAR(20),
  result_count INTEGER,
  results JSONB,
  execution_ms INTEGER,
  run_at TIMESTAMPTZ DEFAULT NOW()
);
```

### metric_correlations
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
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints (After Setup)

Once setup is complete, these endpoints are available:

### Strategies
- `GET /api/v1/strategies` — List all strategies
- `POST /api/v1/strategies` — Create new strategy
- `GET /api/v1/strategies/:id` — Get single strategy
- `PUT /api/v1/strategies/:id` — Update strategy
- `DELETE /api/v1/strategies/:id` — Delete strategy
- `POST /api/v1/strategies/preview` — Preview conditions against metrics
- `POST /api/v1/strategies/:id/run` — Execute strategy

See `backend/src/api/rest/strategies.routes.ts` for implementation.

## Related Documentation

- `strategy-wiring-prompts.md` — Implementation sessions SW1-SW4
- `strategy-engine-architecture.md` — Data model and preset definitions
- `backend/src/services/strategyExecution.service.ts` — Execution logic
