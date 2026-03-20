-- Deal Actuals Tracking
-- Monthly performance data (NOI, occupancy, rent) and traffic logs

-- ═══════════════════════════════════════════════════════════════
-- Table 1: Deal Actuals (Monthly Performance)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_actuals (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- NOI Metrics
  actual_noi DECIMAL(15,2),
  projected_noi DECIMAL(15,2),
  
  -- Occupancy
  actual_occupancy DECIMAL(5,2),  -- %
  projected_occupancy DECIMAL(5,2),
  
  -- Rent
  actual_avg_rent DECIMAL(10,2),
  projected_avg_rent DECIMAL(10,2),
  
  -- Expenses
  actual_opex DECIMAL(15,2),
  projected_opex DECIMAL(15,2),
  
  -- Revenue
  actual_revenue DECIMAL(15,2),
  projected_revenue DECIMAL(15,2),
  
  -- Units
  units_occupied INT,
  total_units INT,
  
  -- Additional Metrics
  lease_renewals INT,
  new_leases INT,
  move_outs INT,
  avg_days_vacant DECIMAL(5,1),
  
  -- Metadata
  notes TEXT,
  data_source VARCHAR(100), -- 'manual' | 'yardi' | 'realpage' | 'property_mgmt'
  verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP,
  
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id, period_start)
);

CREATE INDEX idx_deal_actuals_deal ON deal_actuals(deal_id);
CREATE INDEX idx_deal_actuals_period ON deal_actuals(period_start DESC);

COMMENT ON TABLE deal_actuals IS 'Monthly actual performance data vs projections';

-- ═══════════════════════════════════════════════════════════════
-- Table 2: Traffic Logs (Walk-in/Digital Traffic)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deal_traffic_logs (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Walk-in Traffic
  actual_walkins DECIMAL(8,2),      -- Average per week
  predicted_walkins DECIMAL(8,2),
  
  -- Digital Traffic
  website_visitors INT,
  email_inquiries INT,
  phone_calls INT,
  digital_index DECIMAL(5,1),       -- 0-100 score
  
  -- FDOT AADT (if applicable)
  fdot_aadt INT,                    -- From FDOT baseline
  real_aadt INT,                    -- Actual published data
  
  -- Conversions
  lease_conversions INT,
  tour_to_lease_rate DECIMAL(5,2), -- %
  
  -- Metadata
  notes TEXT,
  data_source VARCHAR(100),
  
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id, period_start)
);

CREATE INDEX idx_traffic_logs_deal ON deal_traffic_logs(deal_id);
CREATE INDEX idx_traffic_logs_period ON deal_traffic_logs(period_start DESC);

COMMENT ON TABLE deal_traffic_logs IS 'Traffic validation data for M07 calibration';

-- ═══════════════════════════════════════════════════════════════
-- Table 3: Flywheel Feed Status (Platform Intelligence Contributions)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS flywheel_feeds (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  target_module VARCHAR(10) NOT NULL,  -- 'M07' | 'M09' | 'M26' | 'M27' | 'M08' | 'JEDI'
  
  -- Contribution Details
  contribution_type VARCHAR(100),
  data_points INT,
  impact_level VARCHAR(20),            -- 'HIGH' | 'MEDIUM' | 'LOW'
  status VARCHAR(30),                   -- 'FEEDING' | 'VALIDATED' | 'PENDING' | 'UNDER_REVIEW'
  
  -- Calibration Shift
  calibration_description TEXT,
  calibration_applied BOOLEAN DEFAULT FALSE,
  calibration_applied_at TIMESTAMP,
  
  -- Metrics
  accuracy_before DECIMAL(5,2),        -- %
  accuracy_after DECIMAL(5,2),         -- %
  deals_affected INT,                  -- How many future deals benefit
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (deal_id, target_module)
);

CREATE INDEX idx_flywheel_feeds_deal ON flywheel_feeds(deal_id);
CREATE INDEX idx_flywheel_feeds_module ON flywheel_feeds(target_module);
CREATE INDEX idx_flywheel_feeds_status ON flywheel_feeds(status);

COMMENT ON TABLE flywheel_feeds IS 'Tracks how deals feed intelligence back to platform modules';

-- ═══════════════════════════════════════════════════════════════
-- Success
-- ═══════════════════════════════════════════════════════════════
SELECT 'Deal Actuals tables created successfully!' as status;
