-- News Intelligence System Tables

-- News Events - Core intelligence extraction storage
CREATE TABLE IF NOT EXISTS news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification
  event_category VARCHAR(50) NOT NULL, -- employment, development, transactions, government, amenities
  event_type VARCHAR(100) NOT NULL,    -- specific type like company_relocation_inbound, multifamily_permit_approval
  event_status VARCHAR(50) DEFAULT 'announced', -- rumored, announced, confirmed, under_construction, completed, cancelled
  
  -- Source metadata
  source_type VARCHAR(20) NOT NULL,    -- public, email_private, email_anonymized
  source_name VARCHAR(255),            -- publication name or "Email: contact_name"
  source_url TEXT,                     -- article URL or email thread ID
  source_credibility_score DECIMAL(3,2) DEFAULT 0.50,
  source_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for public sources
  
  -- Extracted data (structured JSON)
  extracted_data JSONB NOT NULL,
  
  -- Geographic data
  location_raw TEXT NOT NULL,
  location_geocoded GEOMETRY(POINT, 4326),
  location_specificity VARCHAR(20), -- address, neighborhood, city, metro, state
  city VARCHAR(100),
  state VARCHAR(2),
  
  -- Impact analysis (quantified projections)
  impact_analysis JSONB,
  impact_severity VARCHAR(20), -- minimal, moderate, significant, high, critical
  impact_radius_miles DECIMAL(5,2),
  
  -- Quality metrics
  extraction_confidence DECIMAL(3,2) DEFAULT 0.50,
  corroboration_count INTEGER DEFAULT 1,
  corroborated_by_public BOOLEAN DEFAULT FALSE,
  early_signal_days INTEGER, -- days before public confirmation (email only)
  
  -- Timestamps
  published_at TIMESTAMP NOT NULL,
  extracted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_events_category ON news_events(event_category);
CREATE INDEX idx_news_events_type ON news_events(event_type);
CREATE INDEX idx_news_events_source_type ON news_events(source_type);
CREATE INDEX idx_news_events_user ON news_events(source_user_id);
CREATE INDEX idx_news_events_location ON news_events USING GIST(location_geocoded);
CREATE INDEX idx_news_events_published ON news_events(published_at DESC);
CREATE INDEX idx_news_events_severity ON news_events(impact_severity);
CREATE INDEX idx_news_events_extracted_data ON news_events USING GIN(extracted_data);

-- News Event Geographic Impacts - Links events to geographic entities
CREATE TABLE IF NOT EXISTS news_event_geo_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Geographic entity (one of these will be set)
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Impact metadata
  impact_type VARCHAR(20) NOT NULL, -- direct (inside area) or adjacent (within radius)
  distance_miles DECIMAL(5,2),
  impact_score DECIMAL(5,2), -- 0-100 relevance score
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_geo_impacts_event ON news_event_geo_impacts(event_id);
CREATE INDEX idx_news_geo_impacts_deal ON news_event_geo_impacts(deal_id);
CREATE INDEX idx_news_geo_impacts_property ON news_event_geo_impacts(property_id);

-- News Alerts - User notifications for high-impact events
CREATE TABLE IF NOT EXISTS news_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Alert content
  alert_type VARCHAR(50) NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  suggested_action TEXT,
  
  -- Status
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  snoozed_until TIMESTAMP,
  
  -- Linking
  linked_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP
);

CREATE INDEX idx_news_alerts_user ON news_alerts(user_id);
CREATE INDEX idx_news_alerts_event ON news_alerts(event_id);
CREATE INDEX idx_news_alerts_unread ON news_alerts(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_news_alerts_severity ON news_alerts(severity);
CREATE INDEX idx_news_alerts_created ON news_alerts(created_at DESC);

-- Contact Credibility Tracking
CREATE TABLE IF NOT EXISTS news_contact_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_email VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_company VARCHAR(255),
  contact_role VARCHAR(100),
  
  -- Performance metrics
  total_signals INTEGER DEFAULT 0,
  corroborated_signals INTEGER DEFAULT 0,
  credibility_score DECIMAL(3,2) DEFAULT 0.50,
  
  -- Specialty tracking (JSONB array of {category, score, count})
  specialties JSONB,
  
  -- Last signal metadata
  last_signal_at TIMESTAMP,
  last_signal_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, contact_email)
);

CREATE INDEX idx_news_contact_user ON news_contact_credibility(user_id);
CREATE INDEX idx_news_contact_email ON news_contact_credibility(contact_email);
CREATE INDEX idx_news_contact_score ON news_contact_credibility(credibility_score DESC);

-- Event Sources (track all public sources)
CREATE TABLE IF NOT EXISTS news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(255) NOT NULL UNIQUE,
  source_type VARCHAR(50) NOT NULL, -- news_api, rss, scraper, government, sec
  source_tier INTEGER NOT NULL, -- 1-5 priority tiers
  
  -- Configuration
  source_url TEXT,
  poll_interval_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Credibility
  base_credibility DECIMAL(3,2) DEFAULT 0.80,
  
  -- Performance tracking
  last_poll_at TIMESTAMP,
  last_success_at TIMESTAMP,
  total_articles_ingested INTEGER DEFAULT 0,
  total_events_extracted INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_sources_active ON news_sources(is_active);
CREATE INDEX idx_news_sources_tier ON news_sources(source_tier);

-- Corroboration Links (track when events corroborate each other)
CREATE TABLE IF NOT EXISTS news_event_corroboration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  corroborating_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  
  -- Matching metadata
  match_score DECIMAL(3,2), -- 0-1 similarity score
  matched_fields TEXT[], -- which fields matched
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(original_event_id, corroborating_event_id)
);

CREATE INDEX idx_news_corroboration_original ON news_event_corroboration(original_event_id);
CREATE INDEX idx_news_corroboration_corroborating ON news_event_corroboration(corroborating_event_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_news_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER news_events_updated_at
BEFORE UPDATE ON news_events
FOR EACH ROW
EXECUTE FUNCTION update_news_timestamp();

CREATE TRIGGER news_contact_credibility_updated_at
BEFORE UPDATE ON news_contact_credibility
FOR EACH ROW
EXECUTE FUNCTION update_news_timestamp();

CREATE TRIGGER news_sources_updated_at
BEFORE UPDATE ON news_sources
FOR EACH ROW
EXECUTE FUNCTION update_news_timestamp();

-- Helper function: Find events near a location
CREATE OR REPLACE FUNCTION find_events_near_location(
  lat DECIMAL,
  lng DECIMAL,
  radius_miles DECIMAL DEFAULT 5.0
)
RETURNS TABLE (
  event_id UUID,
  distance_miles DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ne.id,
    ST_Distance(
      ne.location_geocoded,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    ) * 69.0 as distance -- approximate miles conversion
  FROM news_events ne
  WHERE ne.location_geocoded IS NOT NULL
    AND ST_DWithin(
      ne.location_geocoded,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326),
      radius_miles / 69.0
    )
  ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;
