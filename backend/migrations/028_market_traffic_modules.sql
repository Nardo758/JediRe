-- Migration 028: Market Research + Traffic Analysis Modules
-- Purpose: Add premium modules for market intelligence and traffic predictions
-- Created: 2026-02-15

-- Add new module definitions
INSERT INTO module_definitions (slug, name, category, description, price_monthly, is_free, bundles, icon, enhances, sort_order) VALUES
  (
    'market-research-pro',
    'Market Research Pro',
    'intelligence',
    'Advanced market intelligence with supply/demand analysis, per capita metrics, employment impact, and predictive modeling. Respects your market preferences.',
    4900, -- $49/month
    false,
    ARRAY['enterprise', 'developer', 'investor_pro'],
    '📊',
    ARRAY['Market Analysis section', 'Deal Intelligence', 'Market Research page'],
    40
  ),
  (
    'traffic-analysis',
    'Traffic Analysis',
    'intelligence',
    'Property-level foot traffic predictions with confidence scoring. Weekly walk-ins forecasts, peak hour analysis, and validation against actual measurements.',
    2900, -- $29/month
    false,
    ARRAY['enterprise', 'retail_pro'],
    '🚦',
    ARRAY['Market Analysis section', 'Property Intelligence'],
    41
  ),
  (
    'property-coverage-plus',
    'Property Coverage Plus',
    'data',
    'Access to 620K+ property records across Fulton & DeKalb counties. Real-time property data, owner information, and parcel intelligence.',
    3900, -- $39/month
    false,
    ARRAY['enterprise', 'developer', 'investor_pro'],
    '🗺️',
    ARRAY['Property Research', 'Deal Sourcing'],
    42
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  bundles = EXCLUDED.bundles,
  enhances = EXCLUDED.enhances;

-- Module-specific tables

-- Market Research Subscriptions (track usage)
CREATE TABLE IF NOT EXISTS market_research_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  market VARCHAR(100),
  report_type VARCHAR(50), -- 'supply_analysis', 'demand_indicators', 'employment_impact'
  accessed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_market_research_usage_user ON market_research_usage(user_id);
CREATE INDEX idx_market_research_usage_deal ON market_research_usage(deal_id);
CREATE INDEX idx_market_research_usage_date ON market_research_usage(accessed_at DESC);

-- Traffic Analysis Subscriptions (track usage)
CREATE TABLE IF NOT EXISTS traffic_analysis_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  prediction_id UUID REFERENCES traffic_predictions(id) ON DELETE SET NULL,
  accessed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_traffic_analysis_usage_user ON traffic_analysis_usage(user_id);
CREATE INDEX idx_traffic_analysis_usage_deal ON traffic_analysis_usage(deal_id);
CREATE INDEX idx_traffic_analysis_usage_date ON traffic_analysis_usage(accessed_at DESC);

-- Property Coverage Usage
CREATE TABLE IF NOT EXISTS property_coverage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_type VARCHAR(50), -- 'address', 'parcel', 'owner', 'bulk'
  county VARCHAR(100),
  accessed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_coverage_usage_user ON property_coverage_usage(user_id);
CREATE INDEX idx_property_coverage_usage_date ON property_coverage_usage(accessed_at DESC);

-- Add module categories if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_category') THEN
    CREATE TYPE module_category AS ENUM (
      'intelligence',
      'data',
      'financial',
      'strategy',
      'operations',
      'collaboration',
      'visualization'
    );
  END IF;
END $$;

-- Comments
COMMENT ON TABLE market_research_usage IS 'Track user access to market research reports for analytics and billing';
COMMENT ON TABLE traffic_analysis_usage IS 'Track traffic prediction access for analytics and billing';
COMMENT ON TABLE property_coverage_usage IS 'Track property data queries for analytics and billing';

-- Grant permissions
GRANT SELECT, INSERT ON market_research_usage TO PUBLIC;
GRANT SELECT, INSERT ON traffic_analysis_usage TO PUBLIC;
GRANT SELECT, INSERT ON property_coverage_usage TO PUBLIC;
