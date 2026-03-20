CREATE TABLE IF NOT EXISTS property_visibility (
  property_id VARCHAR(255) PRIMARY KEY,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessment_method VARCHAR(50) DEFAULT 'manual',
  assessed_by VARCHAR(100),

  is_corner BOOLEAN DEFAULT FALSE,
  corner_type VARCHAR(20),
  intersection_type VARCHAR(50),
  distance_to_light_feet INTEGER,

  frontage_feet DECIMAL(8, 2),
  setback_feet DECIMAL(8, 2),
  building_stories INTEGER,
  elevation_vs_street_feet DECIMAL(6, 2),

  sightline_north_feet INTEGER,
  sightline_south_feet INTEGER,
  sightline_east_feet INTEGER,
  sightline_west_feet INTEGER,

  obstruction_trees_pct INTEGER DEFAULT 0,
  obstruction_buildings_pct INTEGER DEFAULT 0,
  obstruction_street_furniture_pct INTEGER DEFAULT 0,
  obstruction_parked_cars_pct INTEGER DEFAULT 0,
  obstruction_topography_pct INTEGER DEFAULT 0,

  has_signage BOOLEAN DEFAULT FALSE,
  signage_size_sq_ft DECIMAL(8, 2),
  signage_type VARCHAR(50),
  signage_is_lit BOOLEAN DEFAULT FALSE,
  signage_visible_from_feet INTEGER,
  max_sign_size_allowed_sq_ft DECIMAL(8, 2),

  glass_to_wall_ratio DECIMAL(5, 2),
  interior_visible BOOLEAN DEFAULT FALSE,
  has_window_displays BOOLEAN DEFAULT FALSE,
  window_tint_level VARCHAR(20),

  entrance_type VARCHAR(50),
  entrance_setback_feet DECIMAL(6, 2),
  has_glass_doors BOOLEAN DEFAULT FALSE,
  has_overhang BOOLEAN DEFAULT FALSE,
  entrance_count INTEGER DEFAULT 1,
  is_ada_compliant BOOLEAN DEFAULT TRUE,

  facade_condition VARCHAR(20),
  architectural_distinctiveness VARCHAR(20),
  color_contrast_vs_neighbors VARCHAR(20),

  positional_score INTEGER,
  sightline_score INTEGER,
  setback_score INTEGER,
  signage_score INTEGER,
  transparency_score INTEGER,
  entrance_score INTEGER,
  obstruction_penalty INTEGER,
  overall_visibility_score INTEGER,
  visibility_tier VARCHAR(20),

  photos JSONB DEFAULT '[]',
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visibility_score ON property_visibility(overall_visibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_tier ON property_visibility(visibility_tier);

CREATE TABLE IF NOT EXISTS adt_counts (
  id SERIAL PRIMARY KEY,
  source_system VARCHAR(50),
  station_id VARCHAR(100),
  route_id VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  road_name VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(2),
  adt INTEGER,
  measurement_year INTEGER,
  directional_split VARCHAR(20),
  road_classification VARCHAR(50),
  number_of_lanes INTEGER,
  functional_class VARCHAR(50),
  data_source_url TEXT,
  ingested_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adt_station ON adt_counts(station_id);
CREATE INDEX IF NOT EXISTS idx_adt_location ON adt_counts(city, state);
CREATE INDEX IF NOT EXISTS idx_adt_year ON adt_counts(measurement_year);
CREATE INDEX IF NOT EXISTS idx_adt_lat_lng ON adt_counts(latitude, longitude);

CREATE TABLE IF NOT EXISTS property_traffic_context (
  property_id VARCHAR(255) PRIMARY KEY,
  primary_adt_station_id VARCHAR(100),
  primary_adt INTEGER,
  primary_adt_distance_m INTEGER,
  primary_road_name VARCHAR(255),
  primary_road_classification VARCHAR(50),
  secondary_adt_station_id VARCHAR(100),
  secondary_adt INTEGER,
  secondary_adt_distance_m INTEGER,
  secondary_road_name VARCHAR(255),
  google_realtime_factor DECIMAL(5, 3) DEFAULT 1.000,
  trend_direction VARCHAR(20),
  trend_pct DECIMAL(5, 2),
  adt_measurement_year INTEGER,
  last_updated DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_ptc_adt ON property_traffic_context(primary_adt DESC);

CREATE TABLE IF NOT EXISTS property_ga_connections (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(255) NOT NULL,
  ga_property_id VARCHAR(100) NOT NULL,
  connection_status VARCHAR(20) DEFAULT 'active',
  last_synced TIMESTAMP,
  sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(property_id, ga_property_id)
);

CREATE INDEX IF NOT EXISTS idx_ga_conn_property ON property_ga_connections(property_id);

CREATE TABLE IF NOT EXISTS property_website_analytics (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(255) NOT NULL,
  ga_property_id VARCHAR(100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(8, 2),
  bounce_rate DECIMAL(5, 4),
  organic_sessions INTEGER DEFAULT 0,
  paid_sessions INTEGER DEFAULT 0,
  direct_sessions INTEGER DEFAULT 0,
  referral_sessions INTEGER DEFAULT 0,
  social_sessions INTEGER DEFAULT 0,
  top_landing_pages JSONB DEFAULT '[]',
  device_breakdown JSONB DEFAULT '{}',
  is_comp_proxy BOOLEAN DEFAULT FALSE,
  proxy_source_properties JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(property_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pwa_property ON property_website_analytics(property_id);
CREATE INDEX IF NOT EXISTS idx_pwa_period ON property_website_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_pwa_proxy ON property_website_analytics(is_comp_proxy) WHERE is_comp_proxy = TRUE;

CREATE TABLE IF NOT EXISTS property_transit_access (
  property_id VARCHAR(255) PRIMARY KEY,
  nearest_station_id VARCHAR(100),
  nearest_station_name VARCHAR(255),
  distance_meters INTEGER,
  walking_time_minutes INTEGER,
  station_type VARCHAR(50),
  daily_ridership INTEGER,
  stations_within_800m INTEGER DEFAULT 0,
  stations_within_1600m INTEGER DEFAULT 0,
  transit_score INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pta_score ON property_transit_access(transit_score DESC);

CREATE TABLE IF NOT EXISTS property_demographics (
  property_id VARCHAR(255) NOT NULL,
  ring_distance_meters INTEGER NOT NULL,
  total_population INTEGER,
  population_density_per_sq_mi DECIMAL(10, 2),
  households INTEGER,
  pct_18_to_34 DECIMAL(5, 2),
  pct_35_to_54 DECIMAL(5, 2),
  pct_55_plus DECIMAL(5, 2),
  median_household_income INTEGER,
  avg_household_income INTEGER,
  residential_units INTEGER,
  employment_count INTEGER,
  employment_density_per_sq_mi DECIMAL(10, 2),
  daytime_population INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (property_id, ring_distance_meters)
);

CREATE INDEX IF NOT EXISTS idx_pd_property ON property_demographics(property_id);

CREATE TABLE IF NOT EXISTS property_competition (
  property_id VARCHAR(255) PRIMARY KEY,
  as_of_date DATE DEFAULT CURRENT_DATE,
  competitors_500m INTEGER DEFAULT 0,
  competitors_1km INTEGER DEFAULT 0,
  competitors_2km INTEGER DEFAULT 0,
  retail_competitors_500m INTEGER DEFAULT 0,
  multifamily_competitors_500m INTEGER DEFAULT 0,
  anchor_competitors_1km INTEGER DEFAULT 0,
  competition_score INTEGER,
  nearest_competitor_id VARCHAR(255),
  nearest_competitor_name VARCHAR(255),
  nearest_competitor_distance_m INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_score ON property_competition(competition_score DESC);

CREATE TABLE IF NOT EXISTS traffic_comp_snapshots (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(255) NOT NULL,
  trade_area_id VARCHAR(255),
  snapshot_date DATE DEFAULT CURRENT_DATE,
  property_name VARCHAR(255),
  property_address VARCHAR(255),
  units INTEGER,
  occupancy_pct DECIMAL(5, 2),
  weekly_traffic INTEGER,
  weekly_tours INTEGER,
  closing_ratio DECIMAL(5, 4),
  net_leases_per_week DECIMAL(6, 2),
  web_sessions INTEGER,
  visibility_score INTEGER,
  adt INTEGER,
  distance_miles DECIMAL(6, 2),
  data_sources JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcs_trade_area ON traffic_comp_snapshots(trade_area_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_tcs_property ON traffic_comp_snapshots(property_id);
CREATE INDEX IF NOT EXISTS idx_tcs_date ON traffic_comp_snapshots(snapshot_date DESC);
