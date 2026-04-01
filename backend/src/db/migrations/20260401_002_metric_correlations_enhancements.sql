ALTER TABLE metric_correlations
  ADD COLUMN IF NOT EXISTS observation_start DATE,
  ADD COLUMN IF NOT EXISTS observation_end DATE;

UPDATE metric_correlations
SET observation_start = computed_at - (window_months || ' months')::interval,
    observation_end = computed_at::date
WHERE observation_start IS NULL;

ALTER TABLE metric_correlations ALTER COLUMN geography_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_mc_unique;
ALTER TABLE metric_correlations
  DROP CONSTRAINT IF EXISTS metric_correlations_metric_a_metric_b_geography_type_geogra_key;

CREATE UNIQUE INDEX idx_mc_unique
  ON metric_correlations (metric_a, metric_b, geography_type, COALESCE(geography_id, '__AGG__'), window_months);
