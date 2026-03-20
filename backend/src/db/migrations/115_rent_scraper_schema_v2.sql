-- Migration 115: Rent Scraper Schema v2
-- Adds website discovery, AI extraction, and backflow fields

-- ── rent_scrape_targets additions ─────────────────────────────────────────────
ALTER TABLE rent_scrape_targets
  ADD COLUMN IF NOT EXISTS website_url       VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS listing_url       VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS url_source        VARCHAR(50)  DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS google_rating     NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS review_count      INT,
  ADD COLUMN IF NOT EXISTS phone             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS building_class    VARCHAR(5),
  ADD COLUMN IF NOT EXISTS places_search_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS amenities         JSONB DEFAULT '[]';

-- Move existing aggregator URLs to listing_url, clear url column
UPDATE rent_scrape_targets
  SET listing_url = url
  WHERE url IS NOT NULL AND listing_url IS NULL;

UPDATE rent_scrape_targets
  SET url = NULL
  WHERE listing_url IS NOT NULL;

-- ── scraped_rents additions ───────────────────────────────────────────────────
ALTER TABLE scraped_rents
  ADD COLUMN IF NOT EXISTS sqft_min          INT,
  ADD COLUMN IF NOT EXISTS sqft_max          INT,
  ADD COLUMN IF NOT EXISTS available_date    DATE,
  ADD COLUMN IF NOT EXISTS platform_detected VARCHAR(50) DEFAULT 'ai_extracted';

-- Backfill sqft_min/max from existing sqft for any existing rows
UPDATE scraped_rents
  SET sqft_min = sqft, sqft_max = sqft
  WHERE sqft IS NOT NULL AND sqft_min IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rent_targets_places_done ON rent_scrape_targets (places_search_done);
CREATE INDEX IF NOT EXISTS idx_rent_targets_website ON rent_scrape_targets (website_url) WHERE website_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scraped_rents_platform ON scraped_rents (platform_detected);
