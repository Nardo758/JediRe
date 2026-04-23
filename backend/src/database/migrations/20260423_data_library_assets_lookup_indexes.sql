-- Lookup indexes for property-intelligence matcher and enrichment queries
-- Speeds up matcher joins on (state, city, address) and triage scans by DQ score.

CREATE INDEX IF NOT EXISTS idx_data_library_assets_state_city_address
  ON data_library_assets (state, city, address);

CREATE INDEX IF NOT EXISTS idx_data_library_assets_dq_score
  ON data_library_assets (data_quality_score);
