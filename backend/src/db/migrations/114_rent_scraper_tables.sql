CREATE TABLE IF NOT EXISTS rent_scrape_targets (
  id SERIAL PRIMARY KEY,
  property_name VARCHAR(500) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100) NOT NULL DEFAULT 'Atlanta',
  state VARCHAR(2) NOT NULL DEFAULT 'GA',
  zip VARCHAR(10),
  url VARCHAR(2000),
  source VARCHAR(100) DEFAULT 'manual',
  unit_count INTEGER,
  year_built INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  market VARCHAR(100) DEFAULT 'Atlanta',
  submarket VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rent_scrape_jobs (
  id SERIAL PRIMARY KEY,
  target_id INTEGER REFERENCES rent_scrape_targets(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  records_scraped INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scraped_rents (
  id SERIAL PRIMARY KEY,
  target_id INTEGER NOT NULL REFERENCES rent_scrape_targets(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES rent_scrape_jobs(id) ON DELETE SET NULL,
  unit_type VARCHAR(50),
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  sqft INTEGER,
  rent_amount NUMERIC(10,2),
  rent_max NUMERIC(10,2),
  date_scraped DATE NOT NULL DEFAULT CURRENT_DATE,
  available_units INTEGER,
  floor_plan_name VARCHAR(200),
  specials TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rent_scrape_targets_city ON rent_scrape_targets(city, state);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_targets_market ON rent_scrape_targets(market);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_targets_active ON rent_scrape_targets(active);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_jobs_target ON rent_scrape_jobs(target_id);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_jobs_status ON rent_scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraped_rents_target ON scraped_rents(target_id);
CREATE INDEX IF NOT EXISTS idx_scraped_rents_date ON scraped_rents(date_scraped);
CREATE INDEX IF NOT EXISTS idx_scraped_rents_target_date ON scraped_rents(target_id, date_scraped);
