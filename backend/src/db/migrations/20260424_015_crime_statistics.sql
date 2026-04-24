-- Migration 015: crime_statistics table + points_of_interest upsert index
-- Supports AtlantaPdCrimeService aggregation by ZIP code.
-- Also adds unique constraint on (source, source_id) so MARTA/OSM can
-- do ON CONFLICT upserts without duplicating records.

-- ── crime_statistics ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crime_statistics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code        TEXT        NOT NULL,
  city            TEXT        NOT NULL DEFAULT 'Atlanta',
  state           TEXT        NOT NULL DEFAULT 'GA',
  crime_index     NUMERIC(8,2),         -- city avg = 100
  violent_crime_index  NUMERIC(8,2),
  property_crime_index NUMERIC(8,2),
  incident_count  INTEGER,
  violent_count   INTEGER,
  property_count  INTEGER,
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT        NOT NULL DEFAULT 'atlanta_pd',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crime_statistics_zip_period
  ON crime_statistics (zip_code, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_crime_statistics_zip
  ON crime_statistics (zip_code);

CREATE INDEX IF NOT EXISTS idx_crime_statistics_computed_at
  ON crime_statistics (computed_at DESC);

-- ── points_of_interest: upsert support ───────────────────────────────────────
-- Allows MARTA GTFS and OSM services to upsert on (source, source_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_source_id
  ON points_of_interest (source, source_id)
  WHERE source_id IS NOT NULL;
