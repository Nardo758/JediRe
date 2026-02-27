-- Migration 044: Site Intelligence Table
-- Stores comprehensive site analysis data for development deals

CREATE TABLE IF NOT EXISTS site_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Environmental Data
  environmental JSONB DEFAULT '{
    "soilType": null,
    "soilBearingCapacity": null,
    "contaminationHistory": [],
    "wetlandsPresent": false,
    "wetlandsArea": null,
    "treeCanopyCoverage": null,
    "protectedSpecies": [],
    "score": null
  }'::jsonb,
  
  -- Infrastructure Data
  infrastructure JSONB DEFAULT '{
    "waterCapacity": null,
    "sewerCapacity": null,
    "sewerType": null,
    "powerGridCapacity": null,
    "gasAvailable": false,
    "fiberAvailable": false,
    "stormDrainage": null,
    "nearestFireHydrant": null,
    "score": null
  }'::jsonb,
  
  -- Accessibility Data
  accessibility JSONB DEFAULT '{
    "roadAccess": null,
    "roadType": null,
    "publicTransit": [],
    "transitDistance": null,
    "walkabilityScore": null,
    "bikeScore": null,
    "parkingAvailable": null,
    "score": null
  }'::jsonb,
  
  -- Regulatory Data
  regulatory JSONB DEFAULT '{
    "permitsRequired": [],
    "historicalVariances": [],
    "easements": [],
    "restrictions": [],
    "historicDistrict": false,
    "overlayZones": [],
    "score": null
  }'::jsonb,
  
  -- Natural Hazards Data
  natural_hazards JSONB DEFAULT '{
    "floodZone": null,
    "floodRisk": null,
    "seismicRisk": null,
    "wildfireRisk": null,
    "windZone": null,
    "hurricaneRisk": null,
    "tornadoRisk": null,
    "score": null
  }'::jsonb,
  
  -- Market Context Data
  market_context JSONB DEFAULT '{
    "medianIncome": null,
    "population": null,
    "populationGrowth": null,
    "employmentRate": null,
    "nearbyComps": [],
    "trafficCount": null,
    "crimeRate": null,
    "schoolRating": null,
    "score": null
  }'::jsonb,
  
  -- Overall Scores
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  data_completeness INTEGER CHECK (data_completeness >= 0 AND data_completeness <= 100),
  
  -- API Integration Status
  fema_fetched_at TIMESTAMP,
  census_fetched_at TIMESTAMP,
  epa_fetched_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_deal_site_intelligence UNIQUE (deal_id)
);

-- Index for fast lookups
CREATE INDEX idx_site_intelligence_deal_id ON site_intelligence(deal_id);

-- Index for filtering by scores
CREATE INDEX idx_site_intelligence_overall_score ON site_intelligence(overall_score);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_site_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_intelligence_updated_at
  BEFORE UPDATE ON site_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_site_intelligence_updated_at();

COMMENT ON TABLE site_intelligence IS 'Comprehensive site analysis data for development deals';
COMMENT ON COLUMN site_intelligence.environmental IS 'Environmental factors: soil, contamination, wetlands, tree cover';
COMMENT ON COLUMN site_intelligence.infrastructure IS 'Utilities and infrastructure availability and capacity';
COMMENT ON COLUMN site_intelligence.accessibility IS 'Transportation, transit, walkability metrics';
COMMENT ON COLUMN site_intelligence.regulatory IS 'Permits, variances, easements, restrictions';
COMMENT ON COLUMN site_intelligence.natural_hazards IS 'Flood, seismic, wildfire, wind risks';
COMMENT ON COLUMN site_intelligence.market_context IS 'Demographics, comps, traffic, amenities';
