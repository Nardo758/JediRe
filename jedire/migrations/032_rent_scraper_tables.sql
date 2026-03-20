-- 032: Rent Scraper Tables
-- Tracks competitor apartment websites for automated rent scraping via Cloudflare Browser Rendering

CREATE TABLE IF NOT EXISTS rent_scrape_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'Atlanta',
  website_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rent_scrape_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES rent_scrape_targets(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_html TEXT,
  parsed_units JSONB,
  avg_rent NUMERIC,
  min_rent NUMERIC,
  max_rent NUMERIC,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_rent_scrape_targets_market ON rent_scrape_targets(market);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_targets_active ON rent_scrape_targets(active);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_results_target_id ON rent_scrape_results(target_id);
CREATE INDEX IF NOT EXISTS idx_rent_scrape_results_scraped_at ON rent_scrape_results(scraped_at);
