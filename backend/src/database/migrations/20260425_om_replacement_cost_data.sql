-- Task #383 follow-up: dedicated table for OM-derived replacement-cost rows.
--
-- Why a new table instead of writing into data_library_cost_data:
--   `data_library_cost_data` was previously created by 20260424 with a UUID
--   PK and a different (NOT NULL: state, cost_type, as_of_date, user_id …)
--   schema for manual GC-bid uploads. Co-mingling broker-OM extracted rows
--   into that table risks NOT-NULL violations on upgraded environments where
--   the prior CREATE TABLE survived. Splitting into its own table eliminates
--   that schema collision permanently and keeps the user-curated cost
--   library and the broker-OM-extracted firehose cleanly separable.
--
-- Strictly additive. No existing PK touched.

CREATE TABLE IF NOT EXISTS om_replacement_cost_data (
  id                        BIGSERIAL PRIMARY KEY,
  source_file_id            INTEGER REFERENCES data_library_files(id) ON DELETE CASCADE,
  msa_key                   TEXT,
  submarket_key             TEXT,
  property_name             TEXT,
  property_type             TEXT,
  units                     INTEGER,
  year_built                INTEGER,
  net_rentable_sf           NUMERIC,
  land_value                NUMERIC,
  hard_cost_psf             NUMERIC,
  hard_cost_total           NUMERIC,
  soft_cost_pct             NUMERIC,
  soft_cost_total           NUMERIC,
  total_replacement_cost    NUMERIC,
  replacement_cost_per_unit NUMERIC,
  cost_source               TEXT,
  source                    TEXT NOT NULL,
  source_id                 TEXT,
  source_page               INTEGER,
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_om_replacement_cost_msa
  ON om_replacement_cost_data (msa_key);
CREATE INDEX IF NOT EXISTS idx_om_replacement_cost_submarket
  ON om_replacement_cost_data (submarket_key);
CREATE INDEX IF NOT EXISTS idx_om_replacement_cost_source_file
  ON om_replacement_cost_data (source_file_id);

-- Best-effort backfill: if any rows were already inserted into the
-- previously-shared table during the brief Task #383 rollout window in this
-- environment, copy them across. Safe no-op when the source table is the
-- pre-existing manual-uploads shape (none of those rows would have
-- source = 'broker_om').
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_library_cost_data'
      AND column_name = 'source_file_id'
  ) THEN
    INSERT INTO om_replacement_cost_data (
      source_file_id, msa_key, submarket_key, property_name, property_type,
      units, year_built, net_rentable_sf, land_value, hard_cost_psf,
      hard_cost_total, soft_cost_pct, soft_cost_total, total_replacement_cost,
      replacement_cost_per_unit, cost_source, source, source_id, source_page,
      captured_at
    )
    SELECT
      source_file_id, msa_key, submarket_key, property_name, property_type,
      units, year_built, net_rentable_sf, land_value, hard_cost_psf,
      hard_cost_total, soft_cost_pct, soft_cost_total, total_replacement_cost,
      replacement_cost_per_unit, cost_source, source, source_id, source_page,
      captured_at
    FROM data_library_cost_data
    WHERE source = 'broker_om'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
