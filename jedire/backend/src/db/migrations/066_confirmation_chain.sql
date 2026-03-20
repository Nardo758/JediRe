-- Migration 066: Confirmation Chain Support Tables
-- Adds persistence for chain results and municipality fee schedule data

-- ============================================================================
-- Confirmation chain results (one per deal, overwritten on re-run)
-- ============================================================================

CREATE TABLE IF NOT EXISTS confirmation_chain_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  parcel_id VARCHAR(100),
  municipality VARCHAR(255),
  state CHAR(2),
  zoning_code VARCHAR(50),

  chain_json JSONB NOT NULL,
  overall_confidence DECIMAL(3,2),
  overall_status VARCHAR(20) NOT NULL
    CHECK (overall_status IN ('complete', 'partial', 'critical_gaps')),
  critical_gaps TEXT[],

  executed_at TIMESTAMPTZ,
  execution_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_chain_deal UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_chain_deal ON confirmation_chain_results(deal_id);
CREATE INDEX IF NOT EXISTS idx_chain_status ON confirmation_chain_results(overall_status);


-- ============================================================================
-- Municipality fee schedules (for Link 8: Cost)
-- ============================================================================

CREATE TABLE IF NOT EXISTS municipality_fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,
  county VARCHAR(255),

  application_fee DECIMAL(12,2),
  rezoning_fee DECIMAL(12,2),
  variance_fee DECIMAL(12,2),
  cup_fee DECIMAL(12,2),
  sap_fee DECIMAL(12,2),

  impact_fee_per_unit DECIMAL(12,2),
  impact_fee_per_sf DECIMAL(8,2),
  park_impact_fee DECIMAL(12,2),
  school_impact_fee DECIMAL(12,2),
  transportation_impact_fee DECIMAL(12,2),
  water_sewer_tap_fee DECIMAL(12,2),

  construction_cost_per_sf DECIMAL(8,2),
  land_cost_per_acre DECIMAL(12,2),

  source_url TEXT,
  source_document TEXT,
  effective_date DATE,
  last_verified DATE,

  CONSTRAINT uq_fee_schedule UNIQUE (municipality, state, effective_date),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_sched_muni ON municipality_fee_schedules(municipality, state);


-- ============================================================================
-- Zoning overlays (for Link 9: Overlays — supplements profile data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS zoning_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,

  overlay_code VARCHAR(50) NOT NULL,
  overlay_name VARCHAR(500),
  overlay_type VARCHAR(30)
    CHECK (overlay_type IN (
      'historic', 'environmental', 'tod', 'opportunity_zone',
      'floodplain', 'conservation', 'design_review', 'other'
    )),

  applies_to_code VARCHAR(50),
  capacity_impact VARCHAR(20) DEFAULT 'unknown'
    CHECK (capacity_impact IN ('increases', 'decreases', 'neutral', 'unknown')),
  capacity_modifier DECIMAL(4,2),
  
  requirements TEXT[],
  overrides TEXT[],
  code_section VARCHAR(100),
  geometry JSONB,

  source_url TEXT,
  last_verified DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoning_overlays_muni ON zoning_overlays(municipality, state);
CREATE INDEX IF NOT EXISTS idx_zoning_overlays_code ON zoning_overlays(overlay_code);


-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp_066()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'chain_results_updated') THEN
    CREATE TRIGGER chain_results_updated
      BEFORE UPDATE ON confirmation_chain_results FOR EACH ROW EXECUTE FUNCTION update_timestamp_066();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fee_schedules_updated') THEN
    CREATE TRIGGER fee_schedules_updated
      BEFORE UPDATE ON municipality_fee_schedules FOR EACH ROW EXECUTE FUNCTION update_timestamp_066();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'zoning_overlays_updated') THEN
    CREATE TRIGGER zoning_overlays_updated
      BEFORE UPDATE ON zoning_overlays FOR EACH ROW EXECUTE FUNCTION update_timestamp_066();
  END IF;
END $$;


COMMENT ON TABLE confirmation_chain_results IS 'Persisted 10-link confirmation chain results per deal';
COMMENT ON TABLE municipality_fee_schedules IS 'Municipal fee schedules for entitlement and impact fee cost estimation';
COMMENT ON TABLE zoning_overlays IS 'Overlay district definitions that modify base zoning capacity';
