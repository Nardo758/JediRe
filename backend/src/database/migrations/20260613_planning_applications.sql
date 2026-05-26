-- planning_applications: stores zoning/rezoning applications from municipal FeatureServer layers.
--
-- Sources (Task #1075):
--   - Atlanta DPCD: gis.atlantaga.gov/dpcd/rest/services — Rezoning Case Map layer
--   - Fulton County: commdist-fulcogis.opendata.arcgis.com — Zoning layer
--
-- Unique constraint on (case_number, jurisdiction) enables ON CONFLICT upsert for nightly sweeps.
-- parcel_id is nullable — not all records include a PIN (address-only cases use geocode fallback).
-- raw_json captures the full ArcGIS attributes object for schema evolution safety.

CREATE TABLE IF NOT EXISTS planning_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number      TEXT        NOT NULL,
  jurisdiction     TEXT        NOT NULL,  -- 'atlanta_dpcd' | 'fulton_county'
  application_type TEXT,                  -- REZONING | SLUP | VARIANCE | etc.
  applicant_name   TEXT,
  property_address TEXT,
  parcel_id        TEXT,                  -- county PIN; nullable if absent in source
  current_zoning   TEXT,
  proposed_zoning  TEXT,
  filed_date       DATE,
  status           TEXT,                  -- PENDING | APPROVED | DENIED | CONTINUED | WITHDRAWN
  hearing_date     DATE,
  source_url       TEXT,
  raw_json         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_planning_case_jurisdiction UNIQUE (case_number, jurisdiction)
);

-- Index for the most common queries: by parcel (for property linkage) and by filed date (for recency)
CREATE INDEX IF NOT EXISTS idx_planning_parcel_id  ON planning_applications (parcel_id) WHERE parcel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_planning_filed_date ON planning_applications (filed_date DESC);
CREATE INDEX IF NOT EXISTS idx_planning_jurisdiction ON planning_applications (jurisdiction);
CREATE INDEX IF NOT EXISTS idx_planning_status      ON planning_applications (status);
