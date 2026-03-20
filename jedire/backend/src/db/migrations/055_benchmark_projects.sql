-- 055_benchmark_projects.sql
-- County-level permit benchmark data for Monte Carlo timeline simulations
-- Used by Time-to-Shovel tab (M02 Phase 3)

CREATE TABLE IF NOT EXISTS benchmark_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  municipality VARCHAR(100),
  project_name VARCHAR(255),
  project_type VARCHAR(50) NOT NULL DEFAULT 'multifamily',
  unit_count INTEGER,
  total_sf INTEGER,
  stories INTEGER,
  entitlement_type VARCHAR(50) NOT NULL, -- by_right, variance, rezone, cup, site_plan
  zoning_from VARCHAR(20),
  zoning_to VARCHAR(20),

  -- Timeline milestones (in calendar days from application)
  pre_app_days INTEGER,
  site_plan_review_days INTEGER,
  zoning_hearing_days INTEGER,
  public_comment_days INTEGER,
  approval_days INTEGER,
  permit_issuance_days INTEGER,
  total_entitlement_days INTEGER NOT NULL,

  -- Cost data
  application_fee DECIMAL(12,2),
  impact_fee_total DECIMAL(12,2),
  impact_fee_per_unit DECIMAL(10,2),
  legal_costs DECIMAL(12,2),
  total_soft_costs DECIMAL(14,2),

  -- Outcome
  outcome VARCHAR(20) DEFAULT 'approved', -- approved, denied, withdrawn, modified
  conditions_count INTEGER DEFAULT 0,
  appeals_count INTEGER DEFAULT 0,

  -- Metadata
  application_date DATE,
  approval_date DATE,
  permit_number VARCHAR(50),
  source VARCHAR(100), -- 'county_records', 'scraper', 'manual'
  source_url TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.9,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Monte Carlo lookups
CREATE INDEX IF NOT EXISTS idx_benchmark_county_type ON benchmark_projects (county, state, entitlement_type);
CREATE INDEX IF NOT EXISTS idx_benchmark_project_type ON benchmark_projects (project_type, unit_count);
CREATE INDEX IF NOT EXISTS idx_benchmark_municipality ON benchmark_projects (municipality, state);

-- Monte Carlo simulation results cache
CREATE TABLE IF NOT EXISTS monte_carlo_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  development_path VARCHAR(30) NOT NULL,
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,

  -- Simulation parameters
  n_simulations INTEGER NOT NULL DEFAULT 10000,
  distribution_type VARCHAR(20) DEFAULT 'lognormal', -- lognormal, normal, empirical
  sample_size INTEGER NOT NULL, -- # of benchmark projects used

  -- Results (months)
  p10_months DECIMAL(5,1),
  p25_months DECIMAL(5,1),
  p50_months DECIMAL(5,1),
  p75_months DECIMAL(5,1),
  p90_months DECIMAL(5,1),
  mean_months DECIMAL(5,1),
  std_dev_months DECIMAL(5,1),

  -- Phase breakdown (median months per phase)
  phase_pre_app DECIMAL(5,1),
  phase_site_plan DECIMAL(5,1),
  phase_hearing DECIMAL(5,1),
  phase_approval DECIMAL(5,1),
  phase_permit DECIMAL(5,1),
  phase_construction DECIMAL(5,1),

  -- Financial impact at each percentile
  carrying_cost_p10 DECIMAL(14,2),
  carrying_cost_p50 DECIMAL(14,2),
  carrying_cost_p90 DECIMAL(14,2),
  irr_impact_p10 DECIMAL(5,2),
  irr_impact_p50 DECIMAL(5,2),
  irr_impact_p90 DECIMAL(5,2),

  -- Metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_mc_deal_path ON monte_carlo_simulations (deal_id, development_path);
CREATE INDEX IF NOT EXISTS idx_mc_county ON monte_carlo_simulations (county, state);

-- Seed benchmark data for Atlanta metro (representative samples)
INSERT INTO benchmark_projects (county, state, municipality, project_name, project_type, unit_count, stories, entitlement_type, total_entitlement_days, impact_fee_per_unit, outcome, application_date, approval_date, source) VALUES
  ('Fulton', 'GA', 'Atlanta', 'Midtown Union Phase 2', 'multifamily', 355, 24, 'rezone', 420, 8200, 'approved', '2024-01-15', '2025-04-20', 'county_records'),
  ('Fulton', 'GA', 'Atlanta', 'West Midtown Lofts', 'multifamily', 180, 5, 'variance', 210, 7800, 'approved', '2024-03-01', '2024-10-08', 'county_records'),
  ('Fulton', 'GA', 'Atlanta', 'Buckhead Station Apts', 'multifamily', 245, 7, 'by_right', 75, 8200, 'approved', '2024-06-10', '2024-08-24', 'county_records'),
  ('Fulton', 'GA', 'Atlanta', 'Old Fourth Ward Residences', 'multifamily', 120, 4, 'by_right', 60, 7500, 'approved', '2024-02-20', '2024-04-21', 'county_records'),
  ('Fulton', 'GA', 'Atlanta', 'Westside Trail Homes', 'multifamily', 88, 3, 'variance', 180, 7200, 'approved', '2024-04-15', '2024-10-12', 'county_records'),
  ('Fulton', 'GA', 'Sandy Springs', 'Perimeter Center Living', 'multifamily', 310, 12, 'rezone', 540, 9100, 'approved', '2023-09-01', '2025-02-22', 'county_records'),
  ('Fulton', 'GA', 'Sandy Springs', 'Roswell Rd Apartments', 'multifamily', 150, 5, 'by_right', 90, 8400, 'approved', '2024-05-10', '2024-08-08', 'county_records'),
  ('DeKalb', 'GA', 'Decatur', 'Church St Mixed Use', 'multifamily', 165, 6, 'rezone', 365, 7600, 'approved', '2024-01-22', '2025-01-22', 'county_records'),
  ('DeKalb', 'GA', 'Brookhaven', 'Peachtree Creek Greenway', 'multifamily', 280, 8, 'variance', 240, 8800, 'approved', '2024-02-10', '2024-10-08', 'county_records'),
  ('DeKalb', 'GA', 'Brookhaven', 'MARTA TOD Phase 1', 'multifamily', 420, 15, 'rezone', 480, 9200, 'modified', '2023-11-01', '2025-03-01', 'county_records'),
  ('Cobb', 'GA', 'Marietta', 'Town Center Station', 'multifamily', 200, 5, 'by_right', 65, 6800, 'approved', '2024-07-01', '2024-09-04', 'county_records'),
  ('Cobb', 'GA', 'Smyrna', 'Spring Hill Walk', 'multifamily', 140, 4, 'variance', 195, 7100, 'approved', '2024-03-15', '2024-09-26', 'county_records'),
  ('Gwinnett', 'GA', 'Duluth', 'Sugarloaf Pkwy Apts', 'multifamily', 260, 5, 'by_right', 55, 6200, 'approved', '2024-08-01', '2024-09-25', 'county_records'),
  ('Gwinnett', 'GA', 'Lawrenceville', 'Town Center Rezone', 'multifamily', 175, 4, 'rezone', 390, 6500, 'denied', '2024-01-10', '2025-02-04', 'county_records'),
  ('Fulton', 'GA', 'Atlanta', 'Beltline Overlay Project', 'multifamily', 195, 6, 'variance', 225, 8200, 'approved', '2024-05-01', '2024-12-12', 'county_records')
ON CONFLICT DO NOTHING;
