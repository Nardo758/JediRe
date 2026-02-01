-- =====================================================
-- Migration 004: Supply & Demand Agent Tables
-- =====================================================
-- Description: Tables for market inventory tracking and demand analysis
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Supply Agent: Inventory Tracking
-- =====================================================

CREATE TABLE supply_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Geographic area
    area_name VARCHAR(255), -- neighborhood, zip, city
    area_boundary GEOMETRY(Polygon, 4326),
    
    -- Snapshot time
    snapshot_date DATE NOT NULL,
    snapshot_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Inventory metrics
    total_listings INTEGER DEFAULT 0,
    new_listings_7d INTEGER DEFAULT 0,
    new_listings_30d INTEGER DEFAULT 0,
    
    -- By property type
    sf_listings INTEGER DEFAULT 0,
    mf_listings INTEGER DEFAULT 0,
    condo_listings INTEGER DEFAULT 0,
    land_listings INTEGER DEFAULT 0,
    
    -- Market dynamics
    avg_days_on_market INTEGER,
    median_days_on_market INTEGER,
    absorption_rate_months DECIMAL(5, 2),
    
    -- Price metrics
    median_list_price INTEGER,
    avg_list_price INTEGER,
    price_per_sqft_median INTEGER,
    
    -- Trends (vs previous period)
    inventory_change_pct DECIMAL(5, 2),
    price_change_pct DECIMAL(5, 2),
    dom_change_pct DECIMAL(5, 2),
    
    -- Supply score
    supply_score INTEGER CHECK (supply_score BETWEEN 0 AND 100),
    supply_level VARCHAR(20), -- 'very_low', 'low', 'moderate', 'high', 'very_high'
    
    -- Data source
    data_source VARCHAR(50), -- 'mls', 'zillow', 'realtor'
    raw_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert to hypertable for time-series queries
SELECT create_hypertable('supply_snapshots', 'snapshot_timestamp', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

CREATE INDEX idx_supply_market ON supply_snapshots(market_id, snapshot_date DESC);
CREATE INDEX idx_supply_area ON supply_snapshots USING GIST(area_boundary);
CREATE INDEX idx_supply_date ON supply_snapshots(snapshot_date DESC);

COMMENT ON TABLE supply_snapshots IS 'Time-series supply/inventory data by market and area';
COMMENT ON COLUMN supply_snapshots.absorption_rate_months IS 'Months to sell all inventory at current pace';

-- =====================================================
-- Supply Trends (Pre-aggregated)
-- =====================================================

CREATE TABLE supply_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    area_name VARCHAR(255),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20), -- 'week', 'month', 'quarter', 'year'
    
    -- Trend metrics
    avg_inventory INTEGER,
    max_inventory INTEGER,
    min_inventory INTEGER,
    
    avg_new_listings INTEGER,
    total_new_listings INTEGER,
    
    avg_days_on_market INTEGER,
    trend_direction VARCHAR(20), -- 'increasing', 'stable', 'decreasing'
    
    -- Price trends
    price_trend_pct DECIMAL(5, 2),
    price_volatility DECIMAL(5, 2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_supply_trend UNIQUE(market_id, area_name, period_start, period_type)
);

CREATE INDEX idx_supply_trends_market ON supply_trends(market_id);
CREATE INDEX idx_supply_trends_period ON supply_trends(period_start DESC);

COMMENT ON TABLE supply_trends IS 'Aggregated supply trends over time periods';

-- =====================================================
-- Demand Agent: Buyer Activity
-- =====================================================

CREATE TABLE demand_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- Geographic area
    area_name VARCHAR(255),
    area_boundary GEOMETRY(Polygon, 4326),
    
    -- Snapshot time
    snapshot_date DATE NOT NULL,
    snapshot_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Sales activity
    sales_last_7d INTEGER DEFAULT 0,
    sales_last_30d INTEGER DEFAULT 0,
    sales_last_90d INTEGER DEFAULT 0,
    
    -- Sale prices
    median_sale_price INTEGER,
    avg_sale_price INTEGER,
    price_per_sqft_median INTEGER,
    
    -- Market heat
    avg_days_to_sale INTEGER,
    pct_sold_above_list DECIMAL(5, 2),
    pct_sold_with_bidding_war DECIMAL(5, 2),
    
    -- Buyer competition
    avg_offers_per_property DECIMAL(5, 2),
    competition_index INTEGER CHECK (competition_index BETWEEN 0 AND 100),
    
    -- Price trends
    price_appreciation_yoy_pct DECIMAL(5, 2),
    price_appreciation_mom_pct DECIMAL(5, 2),
    
    -- Demand indicators
    search_volume_index INTEGER, -- From Zillow/Realtor traffic
    tour_request_index INTEGER,
    
    -- Demand score
    demand_score INTEGER CHECK (demand_score BETWEEN 0 AND 100),
    demand_level VARCHAR(20), -- 'very_low', 'low', 'moderate', 'high', 'very_high'
    
    -- Data source
    data_source VARCHAR(50),
    raw_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert to hypertable for time-series queries
SELECT create_hypertable('demand_metrics', 'snapshot_timestamp',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

CREATE INDEX idx_demand_market ON demand_metrics(market_id, snapshot_date DESC);
CREATE INDEX idx_demand_area ON demand_metrics USING GIST(area_boundary);
CREATE INDEX idx_demand_date ON demand_metrics(snapshot_date DESC);

COMMENT ON TABLE demand_metrics IS 'Time-series demand/buyer activity data by market and area';
COMMENT ON COLUMN demand_metrics.competition_index IS 'How competitive the market is (0-100)';

-- =====================================================
-- Demand Trends (Pre-aggregated)
-- =====================================================

CREATE TABLE demand_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    area_name VARCHAR(255),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20), -- 'week', 'month', 'quarter', 'year'
    
    -- Trend metrics
    total_sales INTEGER,
    avg_sale_price INTEGER,
    median_sale_price INTEGER,
    
    avg_days_to_sale INTEGER,
    trend_direction VARCHAR(20), -- 'heating', 'stable', 'cooling'
    
    -- Price velocity
    price_velocity_pct DECIMAL(5, 2), -- Rate of price change
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_demand_trend UNIQUE(market_id, area_name, period_start, period_type)
);

CREATE INDEX idx_demand_trends_market ON demand_trends(market_id);
CREATE INDEX idx_demand_trends_period ON demand_trends(period_start DESC);

COMMENT ON TABLE demand_trends IS 'Aggregated demand trends over time periods';

-- =====================================================
-- Supply/Demand Balance
-- =====================================================

CREATE TABLE market_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    area_name VARCHAR(255),
    
    -- Snapshot time
    snapshot_date DATE NOT NULL,
    
    -- Balance metrics
    supply_demand_ratio DECIMAL(5, 2), -- Inventory / Monthly Sales
    market_temperature VARCHAR(20), -- 'cold', 'cool', 'balanced', 'warm', 'hot'
    
    -- Scores
    supply_score INTEGER CHECK (supply_score BETWEEN 0 AND 100),
    demand_score INTEGER CHECK (demand_score BETWEEN 0 AND 100),
    balance_score INTEGER CHECK (balance_score BETWEEN 0 AND 100),
    
    -- Forecast
    forecast_direction VARCHAR(20), -- 'favor_buyers', 'neutral', 'favor_sellers'
    confidence_level DECIMAL(3, 2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_market_balance UNIQUE(market_id, area_name, snapshot_date)
);

CREATE INDEX idx_market_balance_market ON market_balance(market_id);
CREATE INDEX idx_market_balance_date ON market_balance(snapshot_date DESC);
CREATE INDEX idx_market_balance_temp ON market_balance(market_temperature);

COMMENT ON TABLE market_balance IS 'Supply/demand balance analysis for markets';
COMMENT ON COLUMN market_balance.supply_demand_ratio IS 'Months of inventory (higher = more supply)';

-- =====================================================
-- Continuous Aggregate: Monthly Supply Summary
-- =====================================================

CREATE MATERIALIZED VIEW supply_monthly
WITH (timescaledb.continuous) AS
SELECT 
    market_id,
    area_name,
    time_bucket('1 month', snapshot_timestamp) AS month,
    AVG(total_listings) AS avg_inventory,
    AVG(median_list_price) AS avg_price,
    AVG(avg_days_on_market) AS avg_dom,
    AVG(supply_score) AS avg_supply_score
FROM supply_snapshots
GROUP BY market_id, area_name, time_bucket('1 month', snapshot_timestamp);

COMMENT ON MATERIALIZED VIEW supply_monthly IS 'Monthly aggregated supply metrics';

-- =====================================================
-- Continuous Aggregate: Monthly Demand Summary
-- =====================================================

CREATE MATERIALIZED VIEW demand_monthly
WITH (timescaledb.continuous) AS
SELECT 
    market_id,
    area_name,
    time_bucket('1 month', snapshot_timestamp) AS month,
    SUM(sales_last_30d) AS total_sales,
    AVG(median_sale_price) AS avg_price,
    AVG(avg_days_to_sale) AS avg_days_to_sale,
    AVG(demand_score) AS avg_demand_score
FROM demand_metrics
GROUP BY market_id, area_name, time_bucket('1 month', snapshot_timestamp);

COMMENT ON MATERIALIZED VIEW demand_monthly IS 'Monthly aggregated demand metrics';
