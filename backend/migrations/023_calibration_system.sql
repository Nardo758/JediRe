-- ============================================
-- CALIBRATION SYSTEM
-- ============================================
-- Created: 2026-02-17
-- Purpose: Track forecast accuracy and calibrate modules based on actual performance

-- Property actuals (real performance data from live properties)
CREATE TABLE property_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL, -- References properties table
  user_id UUID NOT NULL, -- Owner of the property
  
  -- Time period
  measurement_date DATE NOT NULL,
  measurement_type VARCHAR(50) NOT NULL, -- 'monthly', 'quarterly', 'annual'
  
  -- Financial actuals
  actual_noi DECIMAL(15,2),
  actual_rent_avg DECIMAL(10,2),
  actual_occupancy DECIMAL(5,2),
  actual_expenses DECIMAL(15,2),
  actual_revenue DECIMAL(15,2),
  
  -- Traffic actuals (if applicable)
  actual_traffic_weekly INTEGER,
  actual_traffic_data_source VARCHAR(100), -- 'camera', 'manual_count', 'wifi_tracking'
  
  -- Development actuals (if applicable)
  actual_construction_cost DECIMAL(15,2),
  actual_months_to_complete INTEGER,
  actual_cost_overrun_percentage DECIMAL(5,2),
  
  -- Data source & quality
  data_source VARCHAR(100) NOT NULL, -- 'yardi', 'manual', 'import', 'api'
  quality_score DECIMAL(5,2) DEFAULT 100.0, -- 0-100
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_actuals_property ON property_actuals(property_id);
CREATE INDEX idx_property_actuals_user ON property_actuals(user_id);
CREATE INDEX idx_property_actuals_date ON property_actuals(measurement_date);
CREATE INDEX idx_property_actuals_user_date ON property_actuals(user_id, measurement_date);

-- Forecast validations (comparing forecasts to actual outcomes)
CREATE TABLE forecast_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id VARCHAR(50) NOT NULL, -- 'financial', 'traffic', 'development'
  property_id UUID NOT NULL,
  capsule_id UUID, -- Original deal capsule that made the forecast
  
  -- The forecast
  forecast_metric VARCHAR(100) NOT NULL, -- 'noi_year_3', 'traffic_weekly', 'construction_cost', etc.
  forecast_value DECIMAL(15,2) NOT NULL,
  forecast_made_at TIMESTAMP NOT NULL,
  forecast_timeframe VARCHAR(50), -- 'year_3', 'month_18', 'at_stabilization'
  
  -- The actual
  actual_value DECIMAL(15,2) NOT NULL,
  actual_measured_at TIMESTAMP NOT NULL,
  actual_data_source VARCHAR(100), -- Where the actual came from
  
  -- Accuracy metrics
  error_absolute DECIMAL(15,2) GENERATED ALWAYS AS (actual_value - forecast_value) STORED,
  error_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN forecast_value = 0 THEN 0
      ELSE ((actual_value - forecast_value) / ABS(forecast_value)) * 100
    END
  ) STORED,
  
  -- Context
  deal_context JSONB, -- Original deal characteristics
  quality_score DECIMAL(5,2) DEFAULT 100.0, -- How reliable is this validation?
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_forecast_validations_user_module ON forecast_validations(user_id, module_id);
CREATE INDEX idx_forecast_validations_property ON forecast_validations(property_id);
CREATE INDEX idx_forecast_validations_capsule ON forecast_validations(capsule_id);
CREATE INDEX idx_forecast_validations_metric ON forecast_validations(forecast_metric);

-- Calibration factors (calculated adjustments based on validation data)
CREATE TABLE calibration_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id VARCHAR(50) NOT NULL,
  
  -- Calibration data (JSONB for flexibility per module)
  calibration_data JSONB NOT NULL DEFAULT '{}',
  -- Example for Financial module:
  -- {
  --   "noi_factor": 0.975,  // User is 2.5% optimistic
  --   "rent_factor": 1.02,  // User is 2% pessimistic
  --   "occupancy_bias": -1.5  // User overestimates by 1.5%
  -- }
  -- Example for Traffic module:
  -- {
  --   "traffic_factor": 0.79,  // User properties generate 21% less traffic
  --   "property_type_adjustments": {
  --     "A_class_urban": 1.07,
  --     "B_class_suburban": 0.74
  --   }
  -- }
  
  -- Performance metrics
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence DECIMAL(5,2) NOT NULL DEFAULT 0.0, -- 0-100
  mean_absolute_error DECIMAL(10,2),
  root_mean_square_error DECIMAL(10,2),
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_calibration_factors_user ON calibration_factors(user_id);
CREATE INDEX idx_calibration_factors_module ON calibration_factors(module_id);

-- View: Recent validation summary per user per module
CREATE VIEW user_validation_summary AS
SELECT 
  user_id,
  module_id,
  COUNT(*) as total_validations,
  AVG(error_percentage) as avg_error_percentage,
  STDDEV(error_percentage) as stddev_error,
  MIN(error_percentage) as min_error,
  MAX(error_percentage) as max_error,
  AVG(CASE WHEN error_percentage > 0 THEN 1 ELSE 0 END) as pct_optimistic
FROM forecast_validations
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY user_id, module_id;

-- Comments
COMMENT ON TABLE property_actuals IS 'Real performance data from live properties for calibration';
COMMENT ON TABLE forecast_validations IS 'Comparison of forecasts vs actual outcomes for accuracy tracking';
COMMENT ON TABLE calibration_factors IS 'Calculated adjustment factors based on user forecast accuracy';

COMMENT ON COLUMN property_actuals.quality_score IS 'Data quality (100 = verified from property mgmt system, lower = manual/estimated)';
COMMENT ON COLUMN forecast_validations.error_percentage IS 'Positive = forecast was too low, Negative = forecast was too high';
COMMENT ON COLUMN calibration_factors.confidence IS 'Confidence in calibration based on sample size and consistency';
